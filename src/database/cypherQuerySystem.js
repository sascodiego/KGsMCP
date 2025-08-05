import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';
import CypherQueryBuilder from './cypherQueryBuilder.js';
import QueryOptimizer from './queryOptimizer.js';
import QueryTemplateManager from './queryTemplates.js';
import QueryValidator from './queryValidator.js';
import BatchOperationManager from './batchOperations.js';
import PerformanceMonitor from './performanceMonitor.js';
import TransactionManager from './transactionManager.js';

/**
 * CONTEXT: Integrated Cypher query system for comprehensive Kuzu database management
 * REASON: Unified interface combining all query system components with intelligent orchestration
 * CHANGE: Complete query system with optimization, validation, monitoring, and batch processing
 * PREVENTION: System complexity, performance issues, data integrity problems, and operational overhead
 */

export class CypherQuerySystem extends EventEmitter {
  constructor(client, config = {}) {
    super();
    this.client = client;
    this.config = {
      enableOptimization: config.enableOptimization !== false,
      enableValidation: config.enableValidation !== false,
      enableMonitoring: config.enableMonitoring !== false,
      enableBatchOperations: config.enableBatchOperations !== false,
      enableTransactions: config.enableTransactions !== false,
      enableTemplates: config.enableTemplates !== false,
      autoOptimize: config.autoOptimize !== false,
      strictValidation: config.strictValidation !== false,
      cacheQueries: config.cacheQueries !== false,
      maxConcurrentQueries: config.maxConcurrentQueries || 10,
      defaultTimeout: config.defaultTimeout || 30000,
      ...config
    };

    // Initialize all subsystems
    this.initializeSubsystems();

    // System state
    this.isInitialized = false;
    this.startTime = Date.now();
    this.queryCount = 0;
    this.systemHealth = {
      status: 'INITIALIZING',
      lastCheck: Date.now(),
      issues: []
    };

    logger.info('CypherQuerySystem initializing', {
      enableOptimization: this.config.enableOptimization,
      enableValidation: this.config.enableValidation,
      enableMonitoring: this.config.enableMonitoring
    });
  }

  /**
   * Initialize all subsystems
   */
  initializeSubsystems() {
    try {
      // Initialize query optimizer
      if (this.config.enableOptimization) {
        this.optimizer = new QueryOptimizer({
          cacheSize: this.config.optimizerCacheSize || 1000,
          optimizationLevel: this.config.optimizationLevel || 'balanced',
          enableStatistics: this.config.enableMonitoring
        });
        
        this.optimizer.on('queryOptimized', (event) => {
          this.emit('queryOptimized', event);
        });
      }

      // Initialize query validator
      if (this.config.enableValidation) {
        this.validator = new QueryValidator({
          strictMode: this.config.strictValidation,
          maxQueryLength: this.config.maxQueryLength || 100000,
          enableLogging: this.config.enableMonitoring
        });
      }

      // Initialize performance monitor
      if (this.config.enableMonitoring) {
        this.monitor = new PerformanceMonitor(this.client, {
          enableRealTimeMonitoring: true,
          samplingInterval: this.config.monitoringSampleInterval || 5000,
          slowQueryThreshold: this.config.slowQueryThreshold || 5000
        });

        this.monitor.on('alertTriggered', (alert) => {
          this.handlePerformanceAlert(alert);
        });

        this.monitor.on('slowQueryDetected', (query) => {
          this.handleSlowQuery(query);
        });
      }

      // Initialize transaction manager
      if (this.config.enableTransactions) {
        this.transactionManager = new TransactionManager(this.client, {
          defaultTimeout: this.config.defaultTimeout,
          enableDeadlockDetection: true,
          enableRecovery: true
        });

        this.transactionManager.on('transactionError', (event) => {
          this.handleTransactionError(event);
        });
      }

      // Initialize batch operations
      if (this.config.enableBatchOperations) {
        this.batchManager = new BatchOperationManager(this.client, {
          batchSize: this.config.batchSize || 1000,
          maxConcurrency: this.config.maxConcurrentQueries
        });

        this.batchManager.on('batchCompleted', (event) => {
          this.emit('batchCompleted', event);
        });
      }

      // Initialize template manager
      if (this.config.enableTemplates) {
        this.templateManager = new QueryTemplateManager(
          this.client, 
          this.optimizer
        );
      }

      logger.debug('All subsystems initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize subsystems:', error.message);
      throw new Error(`CypherQuerySystem initialization failed: ${error.message}`);
    }
  }

  /**
   * Initialize the complete system
   */
  async initialize() {
    try {
      logger.info('Starting CypherQuerySystem initialization');

      // Verify client connection
      if (!this.client) {
        throw new Error('Database client is required');
      }

      // Test basic connectivity
      await this.testConnectivity();

      // Initialize monitoring if enabled
      if (this.monitor) {
        await this.startMonitoring();
      }

      // Setup system health checks
      this.setupHealthChecks();

      // Setup event listeners
      this.setupEventListeners();

      this.isInitialized = true;
      this.systemHealth.status = 'HEALTHY';
      
      logger.info('CypherQuerySystem initialized successfully', {
        initializationTime: Date.now() - this.startTime,
        subsystems: this.getEnabledSubsystems()
      });

      this.emit('systemInitialized');

    } catch (error) {
      this.systemHealth.status = 'FAILED';
      this.systemHealth.issues.push({
        type: 'INITIALIZATION_ERROR',
        message: error.message,
        timestamp: Date.now()
      });

      logger.error('CypherQuerySystem initialization failed:', error.message);
      this.emit('systemError', error);
      throw error;
    }
  }

  /**
   * Create a new query builder
   */
  createQueryBuilder() {
    if (!this.isInitialized) {
      throw new Error('CypherQuerySystem not initialized');
    }

    const builder = new CypherQueryBuilder(this);
    
    logger.debug('Query builder created');
    return builder;
  }

  /**
   * Execute a query with full system integration
   */
  async query(cypherQuery, parameters = {}, options = {}) {
    if (!this.isInitialized) {
      throw new Error('CypherQuerySystem not initialized');
    }

    const queryId = this.generateQueryId();
    const startTime = Date.now();
    
    try {
      this.queryCount++;

      // Prepare execution context
      const executionContext = {
        queryId,
        query: cypherQuery,
        parameters,
        options: {
          enableOptimization: options.enableOptimization !== false && this.config.enableOptimization,
          enableValidation: options.enableValidation !== false && this.config.enableValidation,
          enableCaching: options.enableCaching !== false && this.config.cacheQueries,
          timeout: options.timeout || this.config.defaultTimeout,
          ...options
        },
        startTime
      };

      logger.debug('Executing query', {
        queryId,
        query: cypherQuery.substring(0, 100),
        paramCount: Object.keys(parameters).length
      });

      // Step 1: Query validation
      let validationResult = null;
      if (executionContext.options.enableValidation && this.validator) {
        validationResult = await this.validator.validateQuery(
          cypherQuery, 
          parameters, 
          executionContext.options
        );

        if (!validationResult.isValid) {
          throw new Error(`Query validation failed: ${validationResult.errors.join(', ')}`);
        }

        // Use sanitized query if available
        if (validationResult.sanitized) {
          executionContext.query = validationResult.query;
          executionContext.parameters = validationResult.parameters;
        }
      }

      // Step 2: Query optimization
      let optimizationResult = null;
      if (executionContext.options.enableOptimization && this.optimizer) {
        optimizationResult = await this.optimizer.optimizeQuery(
          executionContext.query,
          executionContext.parameters,
          { queryId, originalQuery: cypherQuery }
        );

        // Use optimized query if improvement is significant
        if (optimizationResult.estimatedImprovement > 10) {
          executionContext.query = optimizationResult.optimizedQuery;
          executionContext.optimized = true;
        }
      }

      // Step 3: Check cache
      let cachedResult = null;
      if (executionContext.options.enableCaching && this.optimizer) {
        const querySignature = this.generateQuerySignature(
          executionContext.query,
          executionContext.parameters
        );
        cachedResult = this.optimizer.getCachedResult(querySignature);
        
        if (cachedResult) {
          const executionTime = Date.now() - startTime;
          
          logger.debug('Query served from cache', {
            queryId,
            executionTime: `${executionTime}ms`
          });

          // Record metrics
          if (this.monitor) {
            this.monitor.recordQueryMetric({
              query: cypherQuery,
              parameters,
              executionTime,
              resultCount: cachedResult.length,
              cacheHit: true,
              optimized: !!optimizationResult
            });
          }

          return this.formatQueryResult({
            queryId,
            result: cachedResult,
            executionTime,
            cached: true,
            optimized: !!optimizationResult,
            validated: !!validationResult
          });
        }
      }

      // Step 4: Execute query
      const result = await this.executeQueryDirect(executionContext);

      // Step 5: Cache result if applicable
      if (executionContext.options.enableCaching && this.optimizer && result.length > 0) {
        const querySignature = this.generateQuerySignature(
          executionContext.query,
          executionContext.parameters
        );
        this.optimizer.cacheResult(querySignature, result);
      }

      const executionTime = Date.now() - startTime;

      // Step 6: Record metrics
      if (this.monitor) {
        this.monitor.recordQueryMetric({
          query: cypherQuery,
          parameters,
          executionTime,
          resultCount: result.length,
          cacheHit: false,
          optimized: !!optimizationResult
        });
      }

      logger.debug('Query executed successfully', {
        queryId,
        executionTime: `${executionTime}ms`,
        resultCount: result.length,
        optimized: !!optimizationResult,
        validated: !!validationResult
      });

      return this.formatQueryResult({
        queryId,
        result,
        executionTime,
        cached: false,
        optimized: !!optimizationResult,
        validated: !!validationResult,
        validationWarnings: validationResult?.warnings || [],
        optimizationImprovement: optimizationResult?.estimatedImprovement || 0
      });

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      // Record error metrics
      if (this.monitor) {
        this.monitor.recordQueryError({
          query: cypherQuery,
          parameters,
          error
        });
      }

      logger.error('Query execution failed', {
        queryId,
        error: error.message,
        executionTime: `${executionTime}ms`,
        query: cypherQuery.substring(0, 200)
      });

      this.emit('queryError', {
        queryId,
        query: cypherQuery,
        parameters,
        error,
        executionTime
      });

      throw new CypherQueryError(`Query execution failed: ${error.message}`, {
        queryId,
        originalError: error,
        executionTime
      });
    }
  }

  /**
   * Execute query directly through client
   */
  async executeQueryDirect(executionContext) {
    return await this.client.query(
      executionContext.query,
      executionContext.parameters,
      {
        timeout: executionContext.options.timeout
      }
    );
  }

  /**
   * Execute template
   */
  async executeTemplate(templateName, parameters = {}, options = {}) {
    if (!this.templateManager) {
      throw new Error('Template manager not enabled');
    }

    const startTime = Date.now();
    
    try {
      const result = await this.templateManager.executeTemplate(
        templateName,
        parameters,
        options
      );

      logger.debug('Template executed successfully', {
        templateName,
        executionTime: result.executionTime,
        resultCount: result.result.length
      });

      return result;

    } catch (error) {
      logger.error('Template execution failed', {
        templateName,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Execute batch operations
   */
  async executeBatch(operations, options = {}) {
    if (!this.batchManager) {
      throw new Error('Batch operations not enabled');
    }

    return await this.batchManager.executeBatch(operations, options);
  }

  /**
   * Create streaming query
   */
  createQueryStream(query, parameters = {}, options = {}) {
    if (!this.batchManager) {
      throw new Error('Batch operations not enabled');
    }

    return this.batchManager.createQueryStream(query, parameters, options);
  }

  /**
   * Begin transaction
   */
  async beginTransaction(options = {}) {
    if (!this.transactionManager) {
      throw new Error('Transaction manager not enabled');
    }

    return await this.transactionManager.beginTransaction(options);
  }

  /**
   * Execute transaction
   */
  async executeTransaction(operations, options = {}) {
    if (!this.transactionManager) {
      throw new Error('Transaction manager not enabled');
    }

    return await this.transactionManager.executeTransaction(operations, options);
  }

  /**
   * Get system status and health
   */
  getSystemStatus() {
    const status = {
      isInitialized: this.isInitialized,
      health: { ...this.systemHealth },
      uptime: Date.now() - this.startTime,
      queryCount: this.queryCount,
      subsystems: {},
      performance: {}
    };

    // Subsystem status
    if (this.optimizer) {
      status.subsystems.optimizer = this.optimizer.getStatistics();
    }

    if (this.validator) {
      status.subsystems.validator = this.validator.getStatistics();
    }

    if (this.monitor) {
      status.subsystems.monitor = this.monitor.getRealTimeStatistics();
      status.performance = this.monitor.getPerformanceReport('1h');
    }

    if (this.transactionManager) {
      status.subsystems.transactions = this.transactionManager.getMetrics();
    }

    if (this.batchManager) {
      status.subsystems.batchOperations = this.batchManager.getBatchStatistics();
    }

    if (this.templateManager) {
      status.subsystems.templates = this.templateManager.getTemplateStatistics();
    }

    return status;
  }

  /**
   * Get performance report
   */
  getPerformanceReport(timeRange = '1h') {
    if (!this.monitor) {
      throw new Error('Performance monitoring not enabled');
    }

    return this.monitor.getPerformanceReport(timeRange);
  }

  /**
   * Test system connectivity
   */
  async testConnectivity() {
    try {
      // Simple test query
      await this.client.query('RETURN 1 as test');
      
      logger.debug('Connectivity test passed');
      return true;

    } catch (error) {
      logger.error('Connectivity test failed:', error.message);
      throw new Error(`Database connectivity test failed: ${error.message}`);
    }
  }

  /**
   * Start monitoring
   */
  async startMonitoring() {
    if (!this.monitor) {
      return;
    }

    // Start performance monitoring
    // The monitor starts automatically when created
    
    logger.debug('Monitoring started');
  }

  /**
   * Setup health checks
   */
  setupHealthChecks() {
    // Periodic health check
    this.healthCheckInterval = setInterval(async () => {
      await this.performHealthCheck();
    }, 60000); // Every minute

    logger.debug('Health checks configured');
  }

  /**
   * Perform system health check
   */
  async performHealthCheck() {
    try {
      this.systemHealth.lastCheck = Date.now();
      this.systemHealth.issues = [];

      // Test database connectivity
      await this.testConnectivity();

      // Check subsystem health
      if (this.monitor) {
        const stats = this.monitor.getRealTimeStatistics();
        
        if (stats.errorRate > 10) {
          this.systemHealth.issues.push({
            type: 'HIGH_ERROR_RATE',
            message: `Error rate: ${stats.errorRate.toFixed(2)}%`,
            severity: 'HIGH'
          });
        }

        if (stats.averageQueryTime > 10000) {
          this.systemHealth.issues.push({
            type: 'SLOW_QUERIES',
            message: `Average query time: ${stats.averageQueryTime.toFixed(2)}ms`,
            severity: 'MEDIUM'
          });
        }
      }

      // Check transaction manager
      if (this.transactionManager) {
        const txMetrics = this.transactionManager.getMetrics();
        
        if (txMetrics.activeTransactions > 50) {
          this.systemHealth.issues.push({
            type: 'HIGH_TRANSACTION_COUNT',
            message: `Active transactions: ${txMetrics.activeTransactions}`,
            severity: 'MEDIUM'
          });
        }
      }

      // Update health status
      if (this.systemHealth.issues.length === 0) {
        this.systemHealth.status = 'HEALTHY';
      } else {
        const highSeverityIssues = this.systemHealth.issues.filter(i => i.severity === 'HIGH');
        this.systemHealth.status = highSeverityIssues.length > 0 ? 'UNHEALTHY' : 'WARNING';
      }

      this.emit('healthCheck', this.systemHealth);

    } catch (error) {
      this.systemHealth.status = 'UNHEALTHY';
      this.systemHealth.issues.push({
        type: 'HEALTH_CHECK_FAILED',
        message: error.message,
        severity: 'HIGH'
      });

      logger.error('Health check failed:', error.message);
    }
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Listen to client events if available
    if (this.client && this.client.on) {
      this.client.on('error', (error) => {
        this.handleClientError(error);
      });

      this.client.on('disconnected', () => {
        this.handleClientDisconnection();
      });
    }
  }

  /**
   * Handle performance alerts
   */
  handlePerformanceAlert(alert) {
    logger.warn('Performance alert received', {
      alertType: alert.type,
      severity: alert.severity,
      message: alert.message
    });

    // Auto-optimization if enabled
    if (this.config.autoOptimize && alert.type === 'slow_query') {
      this.triggerAutoOptimization(alert);
    }

    this.emit('performanceAlert', alert);
  }

  /**
   * Handle slow queries
   */
  handleSlowQuery(queryMetric) {
    logger.warn('Slow query detected', {
      query: queryMetric.query.substring(0, 100),
      executionTime: queryMetric.executionTime
    });

    this.emit('slowQuery', queryMetric);
  }

  /**
   * Handle transaction errors
   */
  handleTransactionError(event) {
    logger.error('Transaction error', {
      transactionId: event.transactionId,
      operation: event.operation,
      error: event.error.message
    });

    this.emit('transactionError', event);
  }

  /**
   * Handle client errors
   */
  handleClientError(error) {
    logger.error('Database client error:', error.message);
    
    this.systemHealth.status = 'UNHEALTHY';
    this.systemHealth.issues.push({
      type: 'CLIENT_ERROR',
      message: error.message,
      timestamp: Date.now()
    });

    this.emit('clientError', error);
  }

  /**
   * Handle client disconnection
   */
  handleClientDisconnection() {
    logger.error('Database client disconnected');
    
    this.systemHealth.status = 'UNHEALTHY';
    this.systemHealth.issues.push({
      type: 'CLIENT_DISCONNECTED',
      message: 'Database client lost connection',
      timestamp: Date.now()
    });

    this.emit('clientDisconnected');
  }

  /**
   * Trigger auto-optimization
   */
  async triggerAutoOptimization(alert) {
    try {
      logger.info('Triggering auto-optimization', {
        alertType: alert.type,
        data: alert.data
      });

      // Implement auto-optimization logic based on alert type
      // This is a placeholder for more sophisticated optimization

      this.emit('autoOptimizationTriggered', alert);

    } catch (error) {
      logger.error('Auto-optimization failed:', error.message);
    }
  }

  /**
   * Format query result
   */
  formatQueryResult(resultData) {
    return {
      queryId: resultData.queryId,
      data: resultData.result,
      metadata: {
        executionTime: resultData.executionTime,
        resultCount: resultData.result.length,
        cached: resultData.cached || false,
        optimized: resultData.optimized || false,
        validated: resultData.validated || false,
        validationWarnings: resultData.validationWarnings || [],
        optimizationImprovement: resultData.optimizationImprovement || 0,
        timestamp: Date.now()
      }
    };
  }

  /**
   * Generate query signature for caching
   */
  generateQuerySignature(query, parameters) {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim().toLowerCase();
    const paramString = JSON.stringify(parameters, Object.keys(parameters).sort());
    return `${normalizedQuery}:${paramString}`;
  }

  /**
   * Generate unique query ID
   */
  generateQueryId() {
    return `query_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get enabled subsystems
   */
  getEnabledSubsystems() {
    const subsystems = [];
    
    if (this.optimizer) subsystems.push('optimizer');
    if (this.validator) subsystems.push('validator');
    if (this.monitor) subsystems.push('monitor');
    if (this.transactionManager) subsystems.push('transactions');
    if (this.batchManager) subsystems.push('batchOperations');
    if (this.templateManager) subsystems.push('templates');
    
    return subsystems;
  }

  /**
   * Shutdown the system gracefully
   */
  async shutdown() {
    logger.info('Shutting down CypherQuerySystem');

    try {
      // Stop health checks
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
      }

      // Shutdown subsystems
      if (this.monitor) {
        this.monitor.stop();
      }

      if (this.transactionManager) {
        await this.transactionManager.shutdown();
      }

      this.systemHealth.status = 'SHUTDOWN';
      this.emit('systemShutdown');
      
      logger.info('CypherQuerySystem shutdown completed');

    } catch (error) {
      logger.error('Error during shutdown:', error.message);
      throw error;
    }
  }
}

/**
 * Custom error class for query system
 */
class CypherQueryError extends Error {
  constructor(message, details = {}) {
    super(message);
    this.name = 'CypherQueryError';
    this.details = details;
    this.timestamp = Date.now();
  }
}

// Static factory method
CypherQuerySystem.create = async function(client, config = {}) {
  const system = new CypherQuerySystem(client, config);
  await system.initialize();
  return system;
};

export { CypherQuerySystem, CypherQueryError };
export default CypherQuerySystem;