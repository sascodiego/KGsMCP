import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';
import { Readable, Transform } from 'stream';

/**
 * CONTEXT: Batch operations and streaming results system for Kuzu database
 * REASON: Handle large-scale operations efficiently with memory management
 * CHANGE: Comprehensive batch processing with streaming and parallel execution
 * PREVENTION: Memory exhaustion, long-running operations, and resource starvation
 */

export class BatchOperationManager extends EventEmitter {
  constructor(client, config = {}) {
    super();
    this.client = client;
    this.config = {
      batchSize: config.batchSize || 1000,
      maxConcurrency: config.maxConcurrency || 5,
      streamThreshold: config.streamThreshold || 10000,
      retryAttempts: config.retryAttempts || 3,
      retryDelay: config.retryDelay || 1000,
      progressReporting: config.progressReporting !== false,
      enableOptimization: config.enableOptimization !== false,
      memoryLimit: config.memoryLimit || 500 * 1024 * 1024, // 500MB
      timeout: config.timeout || 300000, // 5 minutes
      ...config
    };

    this.activeBatches = new Map();
    this.batchStats = {
      totalBatches: 0,
      completedBatches: 0,
      failedBatches: 0,
      totalItems: 0,
      processedItems: 0,
      totalTime: 0,
      averageTime: 0
    };

    this.streamingQueries = new Map();
    this.memoryUsage = {
      current: 0,
      peak: 0,
      threshold: this.config.memoryLimit
    };

    logger.info('BatchOperationManager initialized', {
      batchSize: this.config.batchSize,
      maxConcurrency: this.config.maxConcurrency,
      streamThreshold: this.config.streamThreshold
    });
  }

  /**
   * Execute batch operations with automatic batching
   */
  async executeBatch(operations, options = {}) {
    const batchId = this.generateBatchId();
    const startTime = Date.now();

    try {
      // Validate input
      if (!Array.isArray(operations) || operations.length === 0) {
        throw new Error('Operations must be a non-empty array');
      }

      const batchConfig = {
        batchSize: options.batchSize || this.config.batchSize,
        maxConcurrency: options.maxConcurrency || this.config.maxConcurrency,
        useTransaction: options.useTransaction !== false,
        validateOperations: options.validateOperations !== false,
        retryFailed: options.retryFailed !== false,
        progressCallback: options.progressCallback,
        ...options
      };

      logger.info('Starting batch execution', {
        batchId,
        operationCount: operations.length,
        batchSize: batchConfig.batchSize,
        maxConcurrency: batchConfig.maxConcurrency
      });

      // Register batch
      this.activeBatches.set(batchId, {
        id: batchId,
        startTime,
        totalOperations: operations.length,
        completedOperations: 0,
        failedOperations: 0,
        status: 'running',
        config: batchConfig
      });

      // Validate operations if requested
      if (batchConfig.validateOperations) {
        await this.validateOperations(operations);
      }

      // Split into batches
      const batches = this.splitIntoBatches(operations, batchConfig.batchSize);
      
      // Execute batches
      const results = await this.executeBatches(
        batchId,
        batches,
        batchConfig
      );

      // Update statistics
      const executionTime = Date.now() - startTime;
      this.updateBatchStats(operations.length, executionTime, true);

      // Clean up
      this.activeBatches.delete(batchId);

      logger.info('Batch execution completed', {
        batchId,
        operationCount: operations.length,
        executionTime: `${executionTime}ms`,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length
      });

      this.emit('batchCompleted', {
        batchId,
        operationCount: operations.length,
        results,
        executionTime
      });

      return {
        batchId,
        results,
        executionTime,
        statistics: this.getBatchStatistics(batchId)
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateBatchStats(operations.length, executionTime, false);
      
      // Update batch status
      const batch = this.activeBatches.get(batchId);
      if (batch) {
        batch.status = 'failed';
        batch.error = error.message;
      }

      logger.error('Batch execution failed', {
        batchId,
        error: error.message,
        operationCount: operations.length
      });

      this.emit('batchFailed', {
        batchId,
        error,
        operationCount: operations.length
      });

      throw error;
    }
  }

  /**
   * Create a streaming query result
   */
  createQueryStream(query, parameters = {}, options = {}) {
    const streamId = this.generateStreamId();
    
    const streamConfig = {
      batchSize: options.batchSize || this.config.batchSize,
      timeout: options.timeout || this.config.timeout,
      highWaterMark: options.highWaterMark || 16,
      objectMode: true,
      ...options
    };

    logger.debug('Creating query stream', {
      streamId,
      query: query.substring(0, 100),
      batchSize: streamConfig.batchSize
    });

    const queryStream = new QueryResultStream(
      this.client,
      query,
      parameters,
      streamConfig
    );

    // Register stream
    this.streamingQueries.set(streamId, {
      id: streamId,
      query,
      parameters,
      config: streamConfig,
      stream: queryStream,
      startTime: Date.now(),
      rowsRead: 0,
      status: 'active'
    });

    // Handle stream events
    queryStream.on('data', (chunk) => {
      const streamInfo = this.streamingQueries.get(streamId);
      if (streamInfo) {
        streamInfo.rowsRead += Array.isArray(chunk) ? chunk.length : 1;
      }
      this.emit('streamData', { streamId, chunk });
    });

    queryStream.on('end', () => {
      const streamInfo = this.streamingQueries.get(streamId);
      if (streamInfo) {
        streamInfo.status = 'completed';
        streamInfo.endTime = Date.now();
      }
      this.emit('streamEnd', { streamId });
      logger.debug('Query stream ended', { streamId });
    });

    queryStream.on('error', (error) => {
      const streamInfo = this.streamingQueries.get(streamId);
      if (streamInfo) {
        streamInfo.status = 'error';
        streamInfo.error = error.message;
      }
      this.emit('streamError', { streamId, error });
      logger.error('Query stream error', { streamId, error: error.message });
    });

    return queryStream;
  }

  /**
   * Execute bulk insert operations
   */
  async bulkInsert(tableName, records, options = {}) {
    if (!Array.isArray(records) || records.length === 0) {
      throw new Error('Records must be a non-empty array');
    }

    const startTime = Date.now();
    const batchId = this.generateBatchId();

    try {
      const insertConfig = {
        batchSize: options.batchSize || this.config.batchSize,
        useTransaction: options.useTransaction !== false,
        validateRecords: options.validateRecords !== false,
        onConflict: options.onConflict || 'ERROR', // ERROR, IGNORE, MERGE
        ...options
      };

      logger.info('Starting bulk insert', {
        batchId,
        tableName,
        recordCount: records.length,
        batchSize: insertConfig.batchSize
      });

      // Validate records if requested
      if (insertConfig.validateRecords) {
        this.validateRecords(records);
      }

      // Prepare insert operations
      const insertOperations = records.map(record => ({
        type: 'INSERT',
        table: tableName,
        data: record
      }));

      // Execute batch insert
      const result = await this.executeBatch(insertOperations, {
        ...insertConfig,
        progressCallback: options.progressCallback
      });

      const executionTime = Date.now() - startTime;

      logger.info('Bulk insert completed', {
        batchId,
        tableName,
        recordCount: records.length,
        executionTime: `${executionTime}ms`,
        successCount: result.results.filter(r => r.success).length
      });

      return {
        batchId: result.batchId,
        tableName,
        recordCount: records.length,
        successCount: result.results.filter(r => r.success).length,
        failureCount: result.results.filter(r => !r.success).length,
        executionTime
      };

    } catch (error) {
      logger.error('Bulk insert failed', {
        batchId,
        tableName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Execute bulk update operations
   */
  async bulkUpdate(updates, options = {}) {
    if (!Array.isArray(updates) || updates.length === 0) {
      throw new Error('Updates must be a non-empty array');
    }

    const startTime = Date.now();
    const batchId = this.generateBatchId();

    try {
      const updateConfig = {
        batchSize: options.batchSize || this.config.batchSize,
        useTransaction: options.useTransaction !== false,
        validateUpdates: options.validateUpdates !== false,
        ...options
      };

      logger.info('Starting bulk update', {
        batchId,
        updateCount: updates.length,
        batchSize: updateConfig.batchSize
      });

      // Validate updates if requested
      if (updateConfig.validateUpdates) {
        this.validateUpdates(updates);
      }

      // Prepare update operations
      const updateOperations = updates.map(update => ({
        type: 'UPDATE',
        query: update.query,
        parameters: update.parameters || {}
      }));

      // Execute batch update
      const result = await this.executeBatch(updateOperations, updateConfig);

      const executionTime = Date.now() - startTime;

      logger.info('Bulk update completed', {
        batchId,
        updateCount: updates.length,
        executionTime: `${executionTime}ms`,
        successCount: result.results.filter(r => r.success).length
      });

      return {
        batchId: result.batchId,
        updateCount: updates.length,
        successCount: result.results.filter(r => r.success).length,
        failureCount: result.results.filter(r => !r.success).length,
        executionTime
      };

    } catch (error) {
      logger.error('Bulk update failed', {
        batchId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Execute parallel queries
   */
  async executeParallel(queries, options = {}) {
    if (!Array.isArray(queries) || queries.length === 0) {
      throw new Error('Queries must be a non-empty array');
    }

    const startTime = Date.now();
    const batchId = this.generateBatchId();

    try {
      const parallelConfig = {
        maxConcurrency: options.maxConcurrency || this.config.maxConcurrency,
        timeout: options.timeout || this.config.timeout,
        failFast: options.failFast !== false,
        ...options
      };

      logger.info('Starting parallel query execution', {
        batchId,
        queryCount: queries.length,
        maxConcurrency: parallelConfig.maxConcurrency
      });

      // Execute queries in parallel with concurrency control
      const results = await this.executeWithConcurrency(
        queries,
        parallelConfig.maxConcurrency,
        async (query, index) => {
          try {
            const queryResult = await this.client.query(
              query.query || query,
              query.parameters || {},
              { timeout: parallelConfig.timeout }
            );

            return {
              index,
              success: true,
              result: queryResult,
              query: query.query || query
            };

          } catch (error) {
            if (parallelConfig.failFast) {
              throw error;
            }

            return {
              index,
              success: false,
              error: error.message,
              query: query.query || query
            };
          }
        }
      );

      const executionTime = Date.now() - startTime;

      logger.info('Parallel query execution completed', {
        batchId,
        queryCount: queries.length,
        executionTime: `${executionTime}ms`,
        successCount: results.filter(r => r.success).length
      });

      return {
        batchId,
        results,
        executionTime,
        successCount: results.filter(r => r.success).length,
        failureCount: results.filter(r => !r.success).length
      };

    } catch (error) {
      logger.error('Parallel query execution failed', {
        batchId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Split operations into batches
   */
  splitIntoBatches(operations, batchSize) {
    const batches = [];
    
    for (let i = 0; i < operations.length; i += batchSize) {
      batches.push(operations.slice(i, i + batchSize));
    }
    
    return batches;
  }

  /**
   * Execute multiple batches with concurrency control
   */
  async executeBatches(batchId, batches, config) {
    const results = [];
    const semaphore = new Semaphore(config.maxConcurrency);
    
    const batchPromises = batches.map(async (batch, batchIndex) => {
      await semaphore.acquire();
      
      try {
        const batchResults = await this.executeSingleBatch(
          batchId,
          batch,
          batchIndex,
          config
        );
        
        results.push(...batchResults);
        
        // Update progress
        const batchInfo = this.activeBatches.get(batchId);
        if (batchInfo) {
          batchInfo.completedOperations += batch.length;
          
          if (config.progressCallback) {
            config.progressCallback({
              batchId,
              completed: batchInfo.completedOperations,
              total: batchInfo.totalOperations,
              percentage: (batchInfo.completedOperations / batchInfo.totalOperations) * 100
            });
          }
        }
        
        this.emit('batchProgress', {
          batchId,
          batchIndex,
          completed: batch.length,
          total: batches.length
        });
        
      } finally {
        semaphore.release();
      }
    });

    await Promise.all(batchPromises);
    
    return results.sort((a, b) => a.index - b.index);
  }

  /**
   * Execute a single batch
   */
  async executeSingleBatch(batchId, batch, batchIndex, config) {
    const results = [];
    let retryAttempts = 0;
    
    while (retryAttempts <= this.config.retryAttempts) {
      try {
        if (config.useTransaction && batch.length > 1) {
          // Execute as transaction
          const transactionResults = await this.executeTransaction(batch);
          results.push(...transactionResults);
        } else {
          // Execute individually
          for (let i = 0; i < batch.length; i++) {
            const operation = batch[i];
            try {
              const result = await this.executeOperation(operation);
              results.push({
                index: batchIndex * config.batchSize + i,
                success: true,
                result,
                operation
              });
            } catch (error) {
              results.push({
                index: batchIndex * config.batchSize + i,
                success: false,
                error: error.message,
                operation
              });
            }
          }
        }
        
        break; // Success, exit retry loop
        
      } catch (error) {
        retryAttempts++;
        
        if (retryAttempts <= this.config.retryAttempts) {
          logger.warn(`Batch ${batchIndex} failed, retrying (${retryAttempts}/${this.config.retryAttempts})`, {
            batchId,
            error: error.message
          });
          
          await this.delay(this.config.retryDelay * retryAttempts);
        } else {
          logger.error(`Batch ${batchIndex} failed after ${this.config.retryAttempts} retries`, {
            batchId,
            error: error.message
          });
          
          // Mark all operations in batch as failed
          for (let i = 0; i < batch.length; i++) {
            results.push({
              index: batchIndex * config.batchSize + i,
              success: false,
              error: error.message,
              operation: batch[i]
            });
          }
        }
      }
    }
    
    return results;
  }

  /**
   * Execute operations in a transaction
   */
  async executeTransaction(operations) {
    const queries = operations.map(op => {
      if (op.type === 'INSERT') {
        return this.buildInsertQuery(op.table, op.data);
      } else if (op.type === 'UPDATE') {
        return { query: op.query, params: op.parameters };
      } else {
        return { query: op.query || op, params: op.parameters || {} };
      }
    });

    // Use client's transaction method if available
    if (this.client.transaction) {
      return await this.client.transaction(queries);
    } else {
      // Fallback: execute individually (not atomic)
      const results = [];
      for (const query of queries) {
        const result = await this.client.query(query.query, query.params);
        results.push(result);
      }
      return results;
    }
  }

  /**
   * Execute a single operation
   */
  async executeOperation(operation) {
    if (operation.type === 'INSERT') {
      const query = this.buildInsertQuery(operation.table, operation.data);
      return await this.client.query(query.query, query.params);
    } else if (operation.type === 'UPDATE') {
      return await this.client.query(operation.query, operation.parameters || {});
    } else {
      return await this.client.query(
        operation.query || operation,
        operation.parameters || {}
      );
    }
  }

  /**
   * Build insert query for a record
   */
  buildInsertQuery(tableName, record) {
    const fields = Object.keys(record);
    const params = {};
    
    const fieldAssignments = fields.map(field => {
      const paramName = `${field}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
      params[paramName] = record[field];
      return `${field}: $${paramName}`;
    }).join(', ');

    const query = `CREATE (n:${tableName} {${fieldAssignments}}) RETURN n`;
    
    return { query, params };
  }

  /**
   * Execute with concurrency control
   */
  async executeWithConcurrency(items, maxConcurrency, executor) {
    const semaphore = new Semaphore(maxConcurrency);
    const results = [];

    const promises = items.map(async (item, index) => {
      await semaphore.acquire();
      
      try {
        return await executor(item, index);
      } finally {
        semaphore.release();
      }
    });

    return await Promise.all(promises);
  }

  /**
   * Validate operations
   */
  validateOperations(operations) {
    for (let i = 0; i < operations.length; i++) {
      const operation = operations[i];
      
      if (!operation || typeof operation !== 'object') {
        throw new Error(`Invalid operation at index ${i}: must be an object`);
      }
      
      if (operation.type === 'INSERT') {
        if (!operation.table || !operation.data) {
          throw new Error(`Invalid INSERT operation at index ${i}: missing table or data`);
        }
      } else if (operation.type === 'UPDATE') {
        if (!operation.query) {
          throw new Error(`Invalid UPDATE operation at index ${i}: missing query`);
        }
      } else if (!operation.query && typeof operation !== 'string') {
        throw new Error(`Invalid operation at index ${i}: missing query`);
      }
    }
  }

  /**
   * Validate records for bulk insert
   */
  validateRecords(records) {
    if (records.length === 0) {
      throw new Error('Records array cannot be empty');
    }

    const firstRecord = records[0];
    const expectedFields = Object.keys(firstRecord);

    for (let i = 0; i < records.length; i++) {
      const record = records[i];
      
      if (!record || typeof record !== 'object') {
        throw new Error(`Invalid record at index ${i}: must be an object`);
      }

      const recordFields = Object.keys(record);
      
      // Check for missing fields
      for (const field of expectedFields) {
        if (!(field in record)) {
          throw new Error(`Record at index ${i} missing field: ${field}`);
        }
      }

      // Check for extra fields
      for (const field of recordFields) {
        if (!expectedFields.includes(field)) {
          logger.warn(`Record at index ${i} has unexpected field: ${field}`);
        }
      }
    }
  }

  /**
   * Validate updates for bulk update
   */
  validateUpdates(updates) {
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];
      
      if (!update || typeof update !== 'object') {
        throw new Error(`Invalid update at index ${i}: must be an object`);
      }
      
      if (!update.query || typeof update.query !== 'string') {
        throw new Error(`Invalid update at index ${i}: missing or invalid query`);
      }
    }
  }

  /**
   * Get batch statistics
   */
  getBatchStatistics(batchId = null) {
    if (batchId) {
      const batch = this.activeBatches.get(batchId);
      return batch ? { ...batch } : null;
    }
    
    return {
      ...this.batchStats,
      activeBatches: this.activeBatches.size,
      activeStreams: this.streamingQueries.size,
      memoryUsage: { ...this.memoryUsage }
    };
  }

  /**
   * Update batch statistics
   */
  updateBatchStats(itemCount, executionTime, success) {
    this.batchStats.totalBatches++;
    this.batchStats.totalItems += itemCount;
    this.batchStats.totalTime += executionTime;
    
    if (success) {
      this.batchStats.completedBatches++;
      this.batchStats.processedItems += itemCount;
    } else {
      this.batchStats.failedBatches++;
    }
    
    this.batchStats.averageTime = this.batchStats.totalTime / this.batchStats.totalBatches;
  }

  /**
   * Generate unique batch ID
   */
  generateBatchId() {
    return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique stream ID
   */
  generateStreamId() {
    return `stream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Cancel a batch operation
   */
  cancelBatch(batchId) {
    const batch = this.activeBatches.get(batchId);
    
    if (batch) {
      batch.status = 'cancelled';
      this.activeBatches.delete(batchId);
      
      logger.info('Batch operation cancelled', { batchId });
      this.emit('batchCancelled', { batchId });
      
      return true;
    }
    
    return false;
  }

  /**
   * Get active batches
   */
  getActiveBatches() {
    return Array.from(this.activeBatches.values());
  }

  /**
   * Get streaming queries
   */
  getStreamingQueries() {
    return Array.from(this.streamingQueries.values());
  }

  /**
   * Cleanup completed operations
   */
  cleanup() {
    // Clean up completed batches older than 1 hour
    const cutoff = Date.now() - (60 * 60 * 1000);
    
    for (const [batchId, batch] of this.activeBatches) {
      if (batch.status !== 'running' && batch.startTime < cutoff) {
        this.activeBatches.delete(batchId);
      }
    }

    // Clean up completed streams
    for (const [streamId, stream] of this.streamingQueries) {
      if (stream.status !== 'active' && stream.startTime < cutoff) {
        this.streamingQueries.delete(streamId);
      }
    }

    logger.debug('Batch operation cleanup completed', {
      activeBatches: this.activeBatches.size,
      activeStreams: this.streamingQueries.size
    });
  }
}

/**
 * Semaphore class for concurrency control
 */
class Semaphore {
  constructor(maxCount) {
    this.maxCount = maxCount;
    this.currentCount = 0;
    this.waitQueue = [];
  }

  async acquire() {
    if (this.currentCount < this.maxCount) {
      this.currentCount++;
      return;
    }

    return new Promise(resolve => {
      this.waitQueue.push(resolve);
    });
  }

  release() {
    if (this.waitQueue.length > 0) {
      const nextResolve = this.waitQueue.shift();
      nextResolve();
    } else {
      this.currentCount--;
    }
  }
}

/**
 * Streaming query result class
 */
class QueryResultStream extends Readable {
  constructor(client, query, parameters, options) {
    super({ objectMode: true, ...options });
    
    this.client = client;
    this.query = query;
    this.parameters = parameters;
    this.batchSize = options.batchSize || 1000;
    this.currentOffset = 0;
    this.isFinished = false;
    this.timeout = options.timeout || 300000;
  }

  async _read() {
    if (this.isFinished) {
      this.push(null);
      return;
    }

    try {
      // Modify query to add SKIP and LIMIT for pagination
      const paginatedQuery = this.addPagination(this.query, this.currentOffset, this.batchSize);
      
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), this.timeout);
      });

      const queryPromise = this.client.query(paginatedQuery, this.parameters);
      
      const results = await Promise.race([queryPromise, timeoutPromise]);

      if (!results || results.length === 0) {
        this.isFinished = true;
        this.push(null);
        return;
      }

      if (results.length < this.batchSize) {
        this.isFinished = true;
      }

      this.currentOffset += results.length;
      
      // Push results in chunks or individually based on size
      if (results.length <= 10) {
        for (const result of results) {
          this.push(result);
        }
      } else {
        this.push(results);
      }

    } catch (error) {
      this.emit('error', error);
    }
  }

  addPagination(query, offset, limit) {
    // Simple pagination addition - in practice this would be more sophisticated
    let paginatedQuery = query;
    
    if (!query.toUpperCase().includes('SKIP')) {
      paginatedQuery += ` SKIP ${offset}`;
    }
    
    if (!query.toUpperCase().includes('LIMIT')) {
      paginatedQuery += ` LIMIT ${limit}`;
    }
    
    return paginatedQuery;
  }
}

export default BatchOperationManager;