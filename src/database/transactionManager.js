import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';

/**
 * CONTEXT: Enhanced transaction management and error handling for Kuzu database
 * REASON: Ensure ACID properties and robust error recovery for complex operations
 * CHANGE: Comprehensive transaction system with savepoints, recovery, and monitoring
 * PREVENTION: Data corruption, inconsistent state, and resource leaks
 */

export class TransactionManager extends EventEmitter {
  constructor(client, config = {}) {
    super();
    this.client = client;
    this.config = {
      defaultTimeout: config.defaultTimeout || 30000, // 30 seconds
      maxRetries: config.maxRetries || 3,
      retryDelay: config.retryDelay || 1000,
      deadlockTimeout: config.deadlockTimeout || 5000,
      enableSavepoints: config.enableSavepoints !== false,
      enableDeadlockDetection: config.enableDeadlockDetection !== false,
      transactionIsolation: config.transactionIsolation || 'READ_COMMITTED',
      maxActiveTransactions: config.maxActiveTransactions || 100,
      enableMetrics: config.enableMetrics !== false,
      enableRecovery: config.enableRecovery !== false,
      recoveryLogPath: config.recoveryLogPath || '.kg-context/logs/transaction-recovery.log',
      ...config
    };

    // Transaction state management
    this.activeTransactions = new Map();
    this.transactionPool = new Set();
    this.savepoints = new Map();
    this.deadlockDetector = new DeadlockDetector(this);
    
    // Transaction metrics
    this.metrics = {
      transactionsStarted: 0,
      transactionsCommitted: 0,
      transactionsRolledBack: 0,
      transactionsFailed: 0,
      deadlocksDetected: 0,
      averageTransactionTime: 0,
      totalTransactionTime: 0,
      savepointsCreated: 0,
      savepointsReleased: 0
    };

    // Error handling
    this.errorRecovery = new ErrorRecoveryManager(this);
    this.retryPolicy = new RetryPolicy(this.config);

    // Transaction queue for fairness
    this.transactionQueue = [];
    this.isProcessingQueue = false;

    this.initializeTransactionManager();

    logger.info('TransactionManager initialized', {
      defaultTimeout: this.config.defaultTimeout,
      maxRetries: this.config.maxRetries,
      enableSavepoints: this.config.enableSavepoints,
      transactionIsolation: this.config.transactionIsolation
    });
  }

  /**
   * Initialize transaction management
   */
  initializeTransactionManager() {
    // Start periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredTransactions();
    }, 30000); // Every 30 seconds

    // Start deadlock detection
    if (this.config.enableDeadlockDetection) {
      this.deadlockDetector.start();
    }

    // Initialize error recovery
    if (this.config.enableRecovery) {
      this.errorRecovery.initialize();
    }
  }

  /**
   * Begin a new transaction
   */
  async beginTransaction(options = {}) {
    const transactionId = this.generateTransactionId();
    const startTime = Date.now();

    try {
      // Check transaction limits
      if (this.activeTransactions.size >= this.config.maxActiveTransactions) {
        throw new Error('Maximum number of active transactions exceeded');
      }

      const transactionConfig = {
        id: transactionId,
        timeout: options.timeout || this.config.defaultTimeout,
        isolation: options.isolation || this.config.transactionIsolation,
        readOnly: options.readOnly || false,
        autoCommit: options.autoCommit || false,
        retryable: options.retryable !== false,
        savepoints: options.enableSavepoints !== false && this.config.enableSavepoints,
        startTime,
        ...options
      };

      logger.debug('Beginning transaction', {
        transactionId,
        timeout: transactionConfig.timeout,
        isolation: transactionConfig.isolation
      });

      // Create transaction context
      const transaction = new Transaction(this, transactionConfig);
      
      // Store transaction
      this.activeTransactions.set(transactionId, transaction);

      // Initialize transaction in database
      await transaction.begin();

      // Update metrics
      this.metrics.transactionsStarted++;

      this.emit('transactionStarted', {
        transactionId,
        startTime,
        config: transactionConfig
      });

      logger.debug('Transaction started successfully', {
        transactionId,
        activeTransactions: this.activeTransactions.size
      });

      return transaction;

    } catch (error) {
      this.metrics.transactionsFailed++;
      
      logger.error('Failed to begin transaction', {
        transactionId,
        error: error.message
      });

      this.emit('transactionError', {
        transactionId,
        operation: 'BEGIN',
        error
      });

      throw new TransactionError(`Failed to begin transaction: ${error.message}`, error);
    }
  }

  /**
   * Execute operations within a transaction
   */
  async executeTransaction(operations, options = {}) {
    let transaction = null;
    const startTime = Date.now();

    try {
      // Begin transaction
      transaction = await this.beginTransaction(options);

      logger.debug('Executing transaction operations', {
        transactionId: transaction.id,
        operationCount: operations.length
      });

      const results = [];

      // Execute operations
      for (let i = 0; i < operations.length; i++) {
        const operation = operations[i];
        
        try {
          // Create savepoint if enabled
          let savepointId = null;
          if (transaction.config.savepoints && operation.createSavepoint !== false) {
            savepointId = await transaction.createSavepoint(`sp_${i}`);
          }

          // Execute operation
          const result = await this.executeOperationInTransaction(transaction, operation);
          results.push({
            index: i,
            success: true,
            result,
            operation
          });

          // Release savepoint if successful
          if (savepointId) {
            await transaction.releaseSavepoint(savepointId);
          }

        } catch (error) {
          // Handle operation error
          const shouldRollback = await this.handleOperationError(
            transaction,
            operation,
            error,
            i
          );

          if (shouldRollback) {
            throw error;
          }

          results.push({
            index: i,
            success: false,
            error: error.message,
            operation
          });
        }
      }

      // Commit transaction
      await transaction.commit();

      const executionTime = Date.now() - startTime;
      
      logger.info('Transaction executed successfully', {
        transactionId: transaction.id,
        operationCount: operations.length,
        successCount: results.filter(r => r.success).length,
        executionTime: `${executionTime}ms`
      });

      return {
        transactionId: transaction.id,
        results,
        executionTime,
        success: true
      };

    } catch (error) {
      // Rollback transaction
      if (transaction) {
        try {
          await transaction.rollback();
        } catch (rollbackError) {
          logger.error('Failed to rollback transaction', {
            transactionId: transaction.id,
            originalError: error.message,
            rollbackError: rollbackError.message
          });
        }
      }

      const executionTime = Date.now() - startTime;
      
      logger.error('Transaction execution failed', {
        transactionId: transaction?.id,
        error: error.message,
        executionTime: `${executionTime}ms`
      });

      throw new TransactionError(`Transaction execution failed: ${error.message}`, error);
    }
  }

  /**
   * Execute a single operation within a transaction
   */
  async executeOperationInTransaction(transaction, operation) {
    const startTime = Date.now();
    
    try {
      let result;

      if (typeof operation === 'function') {
        // Execute function with transaction context
        result = await operation(transaction);
      } else if (typeof operation === 'object' && operation.query) {
        // Execute query operation
        result = await transaction.query(operation.query, operation.parameters || {});
      } else if (typeof operation === 'string') {
        // Execute string query
        result = await transaction.query(operation);
      } else {
        throw new Error('Invalid operation type');
      }

      const executionTime = Date.now() - startTime;
      
      logger.debug('Operation executed in transaction', {
        transactionId: transaction.id,
        executionTime: `${executionTime}ms`,
        resultCount: Array.isArray(result) ? result.length : 1
      });

      return result;

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      logger.error('Operation failed in transaction', {
        transactionId: transaction.id,
        error: error.message,
        executionTime: `${executionTime}ms`
      });

      throw error;
    }
  }

  /**
   * Handle operation error within transaction
   */
  async handleOperationError(transaction, operation, error, operationIndex) {
    logger.warn('Operation error in transaction', {
      transactionId: transaction.id,
      operationIndex,
      error: error.message
    });

    // Check if error is retryable
    if (this.isRetryableError(error) && transaction.config.retryable) {
      const retryResult = await this.retryPolicy.executeWithRetry(
        () => this.executeOperationInTransaction(transaction, operation),
        error
      );

      if (retryResult.success) {
        logger.debug('Operation retry succeeded', {
          transactionId: transaction.id,
          operationIndex,
          retryAttempt: retryResult.attempts
        });
        return false; // Don't rollback
      }
    }

    // Check if we can rollback to savepoint
    if (transaction.config.savepoints && operation.rollbackToSavepoint !== false) {
      const savepointId = `sp_${operationIndex}`;
      
      try {
        await transaction.rollbackToSavepoint(savepointId);
        logger.debug('Rolled back to savepoint', {
          transactionId: transaction.id,
          savepointId
        });
        return false; // Don't rollback entire transaction
      } catch (savepointError) {
        logger.warn('Failed to rollback to savepoint', {
          transactionId: transaction.id,
          savepointId,
          error: savepointError.message
        });
      }
    }

    // Check error handling strategy
    const strategy = operation.errorStrategy || 'ROLLBACK';
    
    switch (strategy) {
      case 'CONTINUE':
        return false; // Continue with other operations
      
      case 'ROLLBACK':
        return true; // Rollback entire transaction
      
      case 'RETRY':
        // Already handled above
        return true;
      
      default:
        return true; // Default to rollback
    }
  }

  /**
   * Check if error is retryable
   */
  isRetryableError(error) {
    const retryableErrors = [
      'DEADLOCK',
      'TIMEOUT',
      'CONNECTION_LOST',
      'TEMPORARY_FAILURE',
      'LOCK_TIMEOUT'
    ];

    const errorMessage = error.message.toUpperCase();
    return retryableErrors.some(retryableError => 
      errorMessage.includes(retryableError)
    );
  }

  /**
   * Get transaction by ID
   */
  getTransaction(transactionId) {
    return this.activeTransactions.get(transactionId);
  }

  /**
   * Get all active transactions
   */
  getActiveTransactions() {
    return Array.from(this.activeTransactions.values()).map(tx => ({
      id: tx.id,
      startTime: tx.startTime,
      status: tx.status,
      operations: tx.operations.length,
      savepoints: tx.savepoints.size
    }));
  }

  /**
   * Force rollback of a transaction
   */
  async forceRollback(transactionId, reason = 'Manual rollback') {
    const transaction = this.activeTransactions.get(transactionId);
    
    if (!transaction) {
      throw new Error(`Transaction not found: ${transactionId}`);
    }

    try {
      await transaction.rollback();
      
      logger.warn('Transaction force-rolled back', {
        transactionId,
        reason
      });

      this.emit('transactionForceRollback', {
        transactionId,
        reason
      });

      return true;

    } catch (error) {
      logger.error('Failed to force rollback transaction', {
        transactionId,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Clean up expired transactions
   */
  cleanupExpiredTransactions() {
    const now = Date.now();
    const expiredTransactions = [];

    for (const [transactionId, transaction] of this.activeTransactions) {
      const age = now - transaction.startTime;
      
      if (age > transaction.config.timeout) {
        expiredTransactions.push(transaction);
      }
    }

    for (const transaction of expiredTransactions) {
      logger.warn('Transaction expired, forcing rollback', {
        transactionId: transaction.id,
        age: now - transaction.startTime,
        timeout: transaction.config.timeout
      });

      this.forceRollback(transaction.id, 'Transaction timeout')
        .catch(error => {
          logger.error('Failed to cleanup expired transaction', {
            transactionId: transaction.id,
            error: error.message
          });
        });
    }

    if (expiredTransactions.length > 0) {
      this.emit('transactionsExpired', {
        count: expiredTransactions.length,
        transactionIds: expiredTransactions.map(tx => tx.id)
      });
    }
  }

  /**
   * Get transaction metrics
   */
  getMetrics() {
    const activeCount = this.activeTransactions.size;
    const avgTime = this.metrics.transactionsCommitted > 0 ? 
      this.metrics.totalTransactionTime / this.metrics.transactionsCommitted : 0;

    return {
      ...this.metrics,
      averageTransactionTime: avgTime,
      activeTransactions: activeCount,
      successRate: this.metrics.transactionsStarted > 0 ? 
        (this.metrics.transactionsCommitted / this.metrics.transactionsStarted) * 100 : 0,
      failureRate: this.metrics.transactionsStarted > 0 ? 
        (this.metrics.transactionsFailed / this.metrics.transactionsStarted) * 100 : 0
    };
  }

  /**
   * Generate unique transaction ID
   */
  generateTransactionId() {
    return `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Shutdown transaction manager
   */
  async shutdown() {
    logger.info('Shutting down TransactionManager');

    // Stop intervals
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }

    // Stop deadlock detection
    this.deadlockDetector.stop();

    // Rollback all active transactions
    const activeTransactions = Array.from(this.activeTransactions.values());
    
    for (const transaction of activeTransactions) {
      try {
        await transaction.rollback();
        logger.debug('Rolled back transaction during shutdown', {
          transactionId: transaction.id
        });
      } catch (error) {
        logger.error('Failed to rollback transaction during shutdown', {
          transactionId: transaction.id,
          error: error.message
        });
      }
    }

    this.activeTransactions.clear();
    this.emit('shutdown');
    
    logger.info('TransactionManager shutdown completed');
  }
}

/**
 * Transaction class representing a single database transaction
 */
class Transaction extends EventEmitter {
  constructor(manager, config) {
    super();
    this.manager = manager;
    this.config = config;
    this.id = config.id;
    this.startTime = config.startTime;
    this.status = 'PENDING';
    this.operations = [];
    this.savepoints = new Map();
    this.connection = null;
  }

  /**
   * Begin the transaction
   */
  async begin() {
    try {
      // Get database connection
      this.connection = await this.manager.client.getConnection?.() || this.manager.client;
      
      // Begin transaction in database
      if (this.connection.beginTransaction) {
        await this.connection.beginTransaction();
      } else if (this.connection.query) {
        await this.connection.query('BEGIN');
      }

      this.status = 'ACTIVE';
      
      logger.debug('Transaction begun in database', {
        transactionId: this.id
      });

    } catch (error) {
      this.status = 'FAILED';
      throw error;
    }
  }

  /**
   * Execute query within transaction
   */
  async query(cypherQuery, parameters = {}) {
    if (this.status !== 'ACTIVE') {
      throw new Error(`Cannot execute query in transaction with status: ${this.status}`);
    }

    try {
      const operation = {
        type: 'QUERY',
        query: cypherQuery,
        parameters,
        timestamp: Date.now()
      };

      this.operations.push(operation);

      // Execute query
      const result = await this.connection.query(cypherQuery, parameters);

      operation.success = true;
      operation.resultCount = Array.isArray(result) ? result.length : 1;
      
      return result;

    } catch (error) {
      const operation = this.operations[this.operations.length - 1];
      if (operation) {
        operation.success = false;
        operation.error = error.message;
      }

      throw error;
    }
  }

  /**
   * Create savepoint
   */
  async createSavepoint(savepointName) {
    if (!this.config.savepoints) {
      throw new Error('Savepoints not enabled for this transaction');
    }

    if (this.status !== 'ACTIVE') {
      throw new Error(`Cannot create savepoint in transaction with status: ${this.status}`);
    }

    try {
      const savepointId = `${this.id}_${savepointName}_${Date.now()}`;
      
      // Create savepoint in database
      if (this.connection.savepoint) {
        await this.connection.savepoint(savepointId);
      } else if (this.connection.query) {
        await this.connection.query(`SAVEPOINT ${savepointId}`);
      }

      this.savepoints.set(savepointName, {
        id: savepointId,
        name: savepointName,
        timestamp: Date.now()
      });

      this.manager.metrics.savepointsCreated++;

      logger.debug('Savepoint created', {
        transactionId: this.id,
        savepointName,
        savepointId
      });

      return savepointId;

    } catch (error) {
      logger.error('Failed to create savepoint', {
        transactionId: this.id,
        savepointName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Rollback to savepoint
   */
  async rollbackToSavepoint(savepointName) {
    const savepoint = this.savepoints.get(savepointName);
    
    if (!savepoint) {
      throw new Error(`Savepoint not found: ${savepointName}`);
    }

    try {
      // Rollback to savepoint in database
      if (this.connection.rollbackToSavepoint) {
        await this.connection.rollbackToSavepoint(savepoint.id);
      } else if (this.connection.query) {
        await this.connection.query(`ROLLBACK TO SAVEPOINT ${savepoint.id}`);
      }

      logger.debug('Rolled back to savepoint', {
        transactionId: this.id,
        savepointName,
        savepointId: savepoint.id
      });

    } catch (error) {
      logger.error('Failed to rollback to savepoint', {
        transactionId: this.id,
        savepointName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Release savepoint
   */
  async releaseSavepoint(savepointName) {
    const savepoint = this.savepoints.get(savepointName);
    
    if (!savepoint) {
      return; // Savepoint doesn't exist, nothing to release
    }

    try {
      // Release savepoint in database
      if (this.connection.releaseSavepoint) {
        await this.connection.releaseSavepoint(savepoint.id);
      } else if (this.connection.query) {
        await this.connection.query(`RELEASE SAVEPOINT ${savepoint.id}`);
      }

      this.savepoints.delete(savepointName);
      this.manager.metrics.savepointsReleased++;

      logger.debug('Savepoint released', {
        transactionId: this.id,
        savepointName
      });

    } catch (error) {
      logger.error('Failed to release savepoint', {
        transactionId: this.id,
        savepointName,
        error: error.message
      });
      // Don't throw - savepoint release failure shouldn't fail transaction
    }
  }

  /**
   * Commit transaction
   */
  async commit() {
    if (this.status !== 'ACTIVE') {
      throw new Error(`Cannot commit transaction with status: ${this.status}`);
    }

    try {
      // Commit transaction in database
      if (this.connection.commit) {
        await this.connection.commit();
      } else if (this.connection.query) {
        await this.connection.query('COMMIT');
      }

      this.status = 'COMMITTED';
      
      // Update metrics
      const executionTime = Date.now() - this.startTime;
      this.manager.metrics.transactionsCommitted++;
      this.manager.metrics.totalTransactionTime += executionTime;

      // Clean up
      this.cleanup();

      logger.debug('Transaction committed', {
        transactionId: this.id,
        executionTime: `${executionTime}ms`,
        operationCount: this.operations.length
      });

      this.manager.emit('transactionCommitted', {
        transactionId: this.id,
        executionTime,
        operationCount: this.operations.length
      });

    } catch (error) {
      this.status = 'FAILED';
      
      logger.error('Failed to commit transaction', {
        transactionId: this.id,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Rollback transaction
   */
  async rollback() {
    if (this.status === 'COMMITTED' || this.status === 'ROLLED_BACK') {
      return; // Already completed
    }

    try {
      // Rollback transaction in database
      if (this.connection.rollback) {
        await this.connection.rollback();
      } else if (this.connection.query) {
        await this.connection.query('ROLLBACK');
      }

      this.status = 'ROLLED_BACK';
      
      // Update metrics
      this.manager.metrics.transactionsRolledBack++;

      // Clean up
      this.cleanup();

      logger.debug('Transaction rolled back', {
        transactionId: this.id,
        operationCount: this.operations.length
      });

      this.manager.emit('transactionRolledBack', {
        transactionId: this.id,
        operationCount: this.operations.length
      });

    } catch (error) {
      this.status = 'FAILED';
      
      logger.error('Failed to rollback transaction', {
        transactionId: this.id,
        error: error.message
      });

      throw error;
    }
  }

  /**
   * Clean up transaction resources
   */
  cleanup() {
    // Release connection
    if (this.connection && this.manager.client.releaseConnection) {
      this.manager.client.releaseConnection(this.connection);
    }

    // Remove from active transactions
    this.manager.activeTransactions.delete(this.id);

    // Clear savepoints
    this.savepoints.clear();
  }
}

/**
 * Deadlock detection system
 */
class DeadlockDetector {
  constructor(transactionManager) {
    this.transactionManager = transactionManager;
    this.detectionInterval = 5000; // 5 seconds
    this.isRunning = false;
  }

  start() {
    if (this.isRunning) return;
    
    this.isRunning = true;
    this.interval = setInterval(() => {
      this.detectDeadlocks();
    }, this.detectionInterval);
    
    logger.debug('Deadlock detector started');
  }

  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.interval) {
      clearInterval(this.interval);
    }
    
    logger.debug('Deadlock detector stopped');
  }

  detectDeadlocks() {
    // Simplified deadlock detection
    const activeTransactions = this.transactionManager.getActiveTransactions();
    const longRunningTransactions = activeTransactions.filter(tx => 
      Date.now() - tx.startTime > this.transactionManager.config.deadlockTimeout
    );

    if (longRunningTransactions.length > 1) {
      logger.warn('Potential deadlock detected', {
        transactionCount: longRunningTransactions.length,
        transactionIds: longRunningTransactions.map(tx => tx.id)
      });

      this.transactionManager.metrics.deadlocksDetected++;
      
      this.transactionManager.emit('deadlockDetected', {
        transactions: longRunningTransactions
      });
    }
  }
}

/**
 * Error recovery manager
 */
class ErrorRecoveryManager {
  constructor(transactionManager) {
    this.transactionManager = transactionManager;
    this.recoveryLog = [];
  }

  initialize() {
    // Initialize recovery system
    logger.debug('Error recovery manager initialized');
  }

  async recoverFromError(transaction, error) {
    // Implement error recovery logic
    logger.debug('Attempting error recovery', {
      transactionId: transaction.id,
      error: error.message
    });

    // Recovery strategies based on error type
    // This is a simplified implementation
    return false; // Recovery failed
  }
}

/**
 * Retry policy
 */
class RetryPolicy {
  constructor(config) {
    this.maxRetries = config.maxRetries || 3;
    this.retryDelay = config.retryDelay || 1000;
  }

  async executeWithRetry(operation, initialError) {
    let lastError = initialError;
    
    for (let attempt = 1; attempt <= this.maxRetries; attempt++) {
      try {
        await this.delay(this.retryDelay * attempt);
        const result = await operation();
        
        return {
          success: true,
          result,
          attempts: attempt
        };
        
      } catch (error) {
        lastError = error;
        
        if (attempt === this.maxRetries) {
          break;
        }
      }
    }
    
    return {
      success: false,
      error: lastError,
      attempts: this.maxRetries
    };
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Transaction error class
 */
class TransactionError extends Error {
  constructor(message, originalError = null) {
    super(message);
    this.name = 'TransactionError';
    this.originalError = originalError;
    this.timestamp = Date.now();
  }
}

export { TransactionManager, Transaction, TransactionError };
export default TransactionManager;