import { logger } from '../utils/logger.js';

/**
 * CONTEXT: Performance optimization system for validation operations
 * REASON: Optimize validation performance while maintaining security and accuracy
 * CHANGE: Intelligent caching, batching, and performance monitoring for validation
 * PREVENTION: Performance bottlenecks, excessive validation overhead, and resource waste
 */

export class PerformanceOptimizer {
  constructor(config = {}) {
    this.config = {
      enableCaching: config.enableCaching !== false,
      cacheSize: config.cacheSize || 1000,
      cacheTTL: config.cacheTTL || 300000, // 5 minutes
      enableBatching: config.enableBatching !== false,
      batchSize: config.batchSize || 10,
      batchTimeout: config.batchTimeout || 100, // 100ms
      enableMetrics: config.enableMetrics !== false,
      slowValidationThreshold: config.slowValidationThreshold || 1000, // 1 second
      ...config
    };

    // Performance caches
    this.validationCache = new Map();
    this.schemaCache = new Map();
    this.resultCache = new Map();
    
    // Batching queues
    this.batchQueues = new Map();
    this.batchTimers = new Map();
    
    // Performance metrics
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      batchedOperations: 0,
      slowValidations: 0,
      totalValidationTime: 0,
      totalValidations: 0,
      avgValidationTime: 0,
      memoryUsage: 0
    };

    // Optimization strategies
    this.optimizationStrategies = new Map();
    this.initializeOptimizationStrategies();

    // Setup cleanup intervals
    this.setupCleanupIntervals();

    logger.info('PerformanceOptimizer initialized', {
      enableCaching: this.config.enableCaching,
      enableBatching: this.config.enableBatching,
      cacheSize: this.config.cacheSize
    });
  }

  /**
   * Optimize validation with caching and batching
   */
  async optimizeValidation(toolName, validationFn, args, options = {}) {
    const startTime = Date.now();
    
    try {
      // Check cache first
      if (this.config.enableCaching && !options.bypassCache) {
        const cached = await this.checkCache(toolName, args);
        if (cached) {
          this.metrics.cacheHits++;
          this.updatePerformanceMetrics(Date.now() - startTime, true);
          return cached;
        }
        this.metrics.cacheMisses++;
      }

      // Check if operation can be batched
      if (this.config.enableBatching && this.canBatch(toolName, options)) {
        return await this.batchValidation(toolName, validationFn, args, options);
      }

      // Execute validation
      const result = await this.executeValidation(validationFn, args, options);
      
      // Cache the result
      if (this.config.enableCaching && result.isValid) {
        this.cacheResult(toolName, args, result);
      }

      // Update metrics
      const validationTime = Date.now() - startTime;
      this.updatePerformanceMetrics(validationTime, false);
      
      // Check for slow validations
      if (validationTime > this.config.slowValidationThreshold) {
        this.metrics.slowValidations++;
        this.analyzeSlowValidation(toolName, args, validationTime);
      }

      return result;

    } catch (error) {
      const validationTime = Date.now() - startTime;
      this.updatePerformanceMetrics(validationTime, false);
      throw error;
    }
  }

  /**
   * Check validation cache
   */
  async checkCache(toolName, args) {
    const cacheKey = this.generateCacheKey(toolName, args);
    const cached = this.validationCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.config.cacheTTL) {
      logger.debug('Validation cache hit', { toolName, cacheKey });
      return cached.result;
    }
    
    if (cached) {
      // Remove expired entry
      this.validationCache.delete(cacheKey);
    }
    
    return null;
  }

  /**
   * Cache validation result
   */
  cacheResult(toolName, args, result) {
    if (this.validationCache.size >= this.config.cacheSize) {
      // Remove oldest entries (LRU)
      const oldestKey = this.validationCache.keys().next().value;
      this.validationCache.delete(oldestKey);
    }
    
    const cacheKey = this.generateCacheKey(toolName, args);
    this.validationCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      toolName
    });
    
    logger.debug('Validation result cached', { toolName, cacheKey });
  }

  /**
   * Generate cache key from tool name and arguments
   */
  generateCacheKey(toolName, args) {
    // Create a deterministic hash from tool name and args
    const argsString = JSON.stringify(args, Object.keys(args).sort());
    return `${toolName}:${this.hashString(argsString)}`;
  }

  /**
   * Simple string hash function
   */
  hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }

  /**
   * Check if validation can be batched
   */
  canBatch(toolName, options) {
    // Don't batch critical security validations
    if (options.strictMode || options.securityCritical) {
      return false;
    }
    
    // Check if tool supports batching
    const batchableTools = [
      'validate_against_kg',
      'extract_context_from_code',
      'detect_technical_debt'
    ];
    
    return batchableTools.includes(toolName);
  }

  /**
   * Batch validation operations
   */
  async batchValidation(toolName, validationFn, args, options) {
    return new Promise((resolve, reject) => {
      // Get or create batch queue for this tool
      if (!this.batchQueues.has(toolName)) {
        this.batchQueues.set(toolName, []);
      }
      
      const queue = this.batchQueues.get(toolName);
      queue.push({
        validationFn,
        args,
        options,
        resolve,
        reject,
        timestamp: Date.now()
      });

      // Process batch if size limit reached
      if (queue.length >= this.config.batchSize) {
        this.processBatch(toolName);
      } else {
        // Set timer for batch processing
        this.scheduleBatchProcessing(toolName);
      }
    });
  }

  /**
   * Schedule batch processing with timeout
   */
  scheduleBatchProcessing(toolName) {
    if (this.batchTimers.has(toolName)) {
      return; // Timer already scheduled
    }
    
    const timer = setTimeout(() => {
      this.processBatch(toolName);
    }, this.config.batchTimeout);
    
    this.batchTimers.set(toolName, timer);
  }

  /**
   * Process batched validations
   */
  async processBatch(toolName) {
    const queue = this.batchQueues.get(toolName);
    if (!queue || queue.length === 0) return;
    
    // Clear the queue and timer
    this.batchQueues.set(toolName, []);
    if (this.batchTimers.has(toolName)) {
      clearTimeout(this.batchTimers.get(toolName));
      this.batchTimers.delete(toolName);
    }
    
    this.metrics.batchedOperations += queue.length;
    
    logger.debug('Processing batch validation', {
      toolName,
      batchSize: queue.length
    });

    // Execute all validations in parallel
    const promises = queue.map(async (item) => {
      try {
        const result = await this.executeValidation(
          item.validationFn,
          item.args,
          item.options
        );
        item.resolve(result);
      } catch (error) {
        item.reject(error);
      }
    });

    await Promise.allSettled(promises);
  }

  /**
   * Execute validation with performance monitoring
   */
  async executeValidation(validationFn, args, options) {
    const startTime = Date.now();
    
    try {
      // Apply optimization strategies
      const optimizedArgs = await this.applyOptimizations(args, options);
      
      // Execute validation
      const result = await validationFn(optimizedArgs);
      
      // Monitor memory usage
      this.monitorMemoryUsage();
      
      return result;
      
    } catch (error) {
      logger.warn('Validation execution failed', {
        error: error.message,
        executionTime: Date.now() - startTime
      });
      throw error;
    }
  }

  /**
   * Apply optimization strategies to arguments
   */
  async applyOptimizations(args, options) {
    let optimizedArgs = { ...args };
    
    for (const [name, strategy] of this.optimizationStrategies) {
      try {
        if (strategy.shouldApply(args, options)) {
          optimizedArgs = await strategy.optimize(optimizedArgs);
        }
      } catch (error) {
        logger.warn(`Optimization strategy ${name} failed:`, error.message);
      }
    }
    
    return optimizedArgs;
  }

  /**
   * Initialize optimization strategies
   */
  initializeOptimizationStrategies() {
    // String truncation strategy
    this.optimizationStrategies.set('stringTruncation', {
      shouldApply: (args) => {
        return Object.values(args).some(val => 
          typeof val === 'string' && val.length > 10000
        );
      },
      optimize: async (args) => {
        const optimized = { ...args };
        for (const [key, value] of Object.entries(optimized)) {
          if (typeof value === 'string' && value.length > 10000) {
            optimized[key] = value.substring(0, 10000) + '... [truncated]';
            logger.debug('String truncated for performance', { 
              key, 
              originalLength: value.length 
            });
          }
        }
        return optimized;
      }
    });

    // Object simplification strategy
    this.optimizationStrategies.set('objectSimplification', {
      shouldApply: (args) => {
        return this.calculateObjectComplexity(args) > 1000;
      },
      optimize: async (args) => {
        return this.simplifyComplexObjects(args);
      }
    });

    // Array limitation strategy
    this.optimizationStrategies.set('arrayLimitation', {
      shouldApply: (args) => {
        return Object.values(args).some(val => 
          Array.isArray(val) && val.length > 1000
        );
      },
      optimize: async (args) => {
        const optimized = { ...args };
        for (const [key, value] of Object.entries(optimized)) {
          if (Array.isArray(value) && value.length > 1000) {
            optimized[key] = value.slice(0, 1000);
            optimized[`${key}_truncated`] = true;
            logger.debug('Array truncated for performance', { 
              key, 
              originalLength: value.length 
            });
          }
        }
        return optimized;
      }
    });
  }

  /**
   * Calculate object complexity for optimization decisions
   */
  calculateObjectComplexity(obj, depth = 0) {
    if (depth > 10) return 1000; // Prevent infinite recursion
    
    let complexity = 0;
    
    if (Array.isArray(obj)) {
      complexity += obj.length;
      for (const item of obj.slice(0, 10)) { // Limit analysis
        complexity += this.calculateObjectComplexity(item, depth + 1);
      }
    } else if (obj && typeof obj === 'object') {
      const keys = Object.keys(obj);
      complexity += keys.length;
      for (const key of keys.slice(0, 20)) { // Limit analysis
        complexity += this.calculateObjectComplexity(obj[key], depth + 1);
      }
    } else if (typeof obj === 'string') {
      complexity += Math.ceil(obj.length / 100);
    } else {
      complexity += 1;
    }
    
    return complexity;
  }

  /**
   * Simplify complex objects for better performance
   */
  simplifyComplexObjects(args, maxDepth = 5, currentDepth = 0) {
    if (currentDepth >= maxDepth) {
      return '[Object: max depth reached]';
    }
    
    if (Array.isArray(args)) {
      return args.slice(0, 100).map(item => 
        this.simplifyComplexObjects(item, maxDepth, currentDepth + 1)
      );
    } else if (args && typeof args === 'object') {
      const simplified = {};
      const keys = Object.keys(args).slice(0, 50); // Limit keys
      
      for (const key of keys) {
        simplified[key] = this.simplifyComplexObjects(
          args[key], 
          maxDepth, 
          currentDepth + 1
        );
      }
      
      if (Object.keys(args).length > 50) {
        simplified['...'] = `[${Object.keys(args).length - 50} more keys]`;
      }
      
      return simplified;
    }
    
    return args;
  }

  /**
   * Analyze slow validation for optimization opportunities
   */
  analyzeSlowValidation(toolName, args, validationTime) {
    logger.warn('Slow validation detected', {
      toolName,
      validationTime: `${validationTime}ms`,
      argsComplexity: this.calculateObjectComplexity(args),
      cacheStatus: this.validationCache.has(this.generateCacheKey(toolName, args)) ? 'cached' : 'not_cached'
    });

    // Suggest optimizations
    const suggestions = [];
    
    if (this.calculateObjectComplexity(args) > 500) {
      suggestions.push('Consider simplifying input arguments');
    }
    
    if (!this.config.enableCaching) {
      suggestions.push('Enable caching to improve performance');
    }
    
    if (validationTime > 5000) {
      suggestions.push('Consider adding this tool to bypass list for critical paths');
    }
    
    if (suggestions.length > 0) {
      logger.info('Performance optimization suggestions', {
        toolName,
        suggestions
      });
    }
  }

  /**
   * Monitor memory usage
   */
  monitorMemoryUsage() {
    if (this.config.enableMetrics) {
      const usage = process.memoryUsage();
      this.metrics.memoryUsage = usage.heapUsed;
      
      // Clean cache if memory usage is high
      if (usage.heapUsed > 500 * 1024 * 1024) { // 500MB
        this.cleanupCache(0.5); // Remove 50% of cache
      }
    }
  }

  /**
   * Update performance metrics
   */
  updatePerformanceMetrics(validationTime, fromCache) {
    this.metrics.totalValidations++;
    
    if (!fromCache) {
      this.metrics.totalValidationTime += validationTime;
      this.metrics.avgValidationTime = 
        this.metrics.totalValidationTime / (this.metrics.totalValidations - this.metrics.cacheHits);
    }
  }

  /**
   * Setup cleanup intervals
   */
  setupCleanupIntervals() {
    // Cache cleanup every 5 minutes
    setInterval(() => {
      this.cleanupCache(0.1); // Remove 10% of old entries
    }, 5 * 60 * 1000);

    // Metrics reset every hour
    setInterval(() => {
      this.resetMetrics();
    }, 60 * 60 * 1000);
  }

  /**
   * Cleanup cache entries
   */
  cleanupCache(ratio = 0.1) {
    const entriesToRemove = Math.floor(this.validationCache.size * ratio);
    const entries = Array.from(this.validationCache.entries());
    
    // Sort by timestamp (oldest first)
    entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
    
    for (let i = 0; i < entriesToRemove && i < entries.length; i++) {
      this.validationCache.delete(entries[i][0]);
    }
    
    logger.debug('Cache cleanup completed', {
      removedEntries: entriesToRemove,
      remainingEntries: this.validationCache.size
    });
  }

  /**
   * Reset performance metrics
   */
  resetMetrics() {
    const oldMetrics = { ...this.metrics };
    
    this.metrics = {
      cacheHits: 0,
      cacheMisses: 0,
      batchedOperations: 0,
      slowValidations: 0,
      totalValidationTime: 0,
      totalValidations: 0,
      avgValidationTime: 0,
      memoryUsage: process.memoryUsage().heapUsed
    };
    
    logger.info('Performance metrics reset', {
      previousHour: {
        totalValidations: oldMetrics.totalValidations,
        avgValidationTime: oldMetrics.avgValidationTime,
        cacheHitRate: oldMetrics.totalValidations > 0 ? 
          (oldMetrics.cacheHits / oldMetrics.totalValidations * 100).toFixed(2) + '%' : '0%'
      }
    });
  }

  /**
   * Get performance statistics
   */
  getStatistics() {
    const cacheHitRate = this.metrics.totalValidations > 0 ? 
      (this.metrics.cacheHits / this.metrics.totalValidations * 100) : 0;
    
    return {
      performance: {
        ...this.metrics,
        cacheHitRate: `${cacheHitRate.toFixed(2)}%`,
        cacheSize: this.validationCache.size,
        maxCacheSize: this.config.cacheSize,
        memoryUsage: `${Math.round(this.metrics.memoryUsage / 1024 / 1024)}MB`
      },
      config: this.config,
      optimization: {
        strategiesCount: this.optimizationStrategies.size,
        activeBatches: this.batchQueues.size,
        queuedOperations: Array.from(this.batchQueues.values())
          .reduce((sum, queue) => sum + queue.length, 0)
      }
    };
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Adjust cache size if needed
    if (newConfig.cacheSize && newConfig.cacheSize < this.validationCache.size) {
      this.cleanupCache(1 - (newConfig.cacheSize / this.validationCache.size));
    }
    
    logger.debug('PerformanceOptimizer configuration updated', newConfig);
  }

  /**
   * Clear all caches
   */
  clearCaches() {
    this.validationCache.clear();
    this.schemaCache.clear();
    this.resultCache.clear();
    
    logger.info('All performance caches cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics() {
    return {
      validationCache: {
        size: this.validationCache.size,
        maxSize: this.config.cacheSize,
        hitRate: this.metrics.totalValidations > 0 ? 
          (this.metrics.cacheHits / this.metrics.totalValidations * 100).toFixed(2) + '%' : '0%'
      },
      schemaCache: {
        size: this.schemaCache.size
      },
      resultCache: {
        size: this.resultCache.size
      }
    };
  }
}

export default PerformanceOptimizer;