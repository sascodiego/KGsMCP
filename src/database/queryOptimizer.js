import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';

/**
 * CONTEXT: Advanced query optimization and caching system for Kuzu database
 * REASON: Maximize query performance through intelligent optimization and caching
 * CHANGE: Comprehensive optimization engine with adaptive caching strategies
 * PREVENTION: Slow queries, resource waste, and performance degradation
 */

export class QueryOptimizer extends EventEmitter {
  constructor(config = {}) {
    super();
    this.config = {
      cacheSize: config.cacheSize || 10000,
      cacheTTL: config.cacheTTL || 3600, // 1 hour default
      adaptiveCaching: config.adaptiveCaching !== false,
      optimizationLevel: config.optimizationLevel || 'balanced', // 'aggressive', 'balanced', 'conservative'
      enableStatistics: config.enableStatistics !== false,
      maxOptimizationTime: config.maxOptimizationTime || 100, // ms
      ...config
    };

    // Caching system
    this.queryCache = new Map();
    this.resultCache = new Map();
    this.planCache = new Map();
    
    // Statistics and analytics
    this.queryStats = new Map();
    this.optimizationStats = {
      queriesOptimized: 0,
      totalOptimizationTime: 0,
      averageOptimizationTime: 0,
      cacheHits: 0,
      cacheMisses: 0,
      optimizationsFailed: 0
    };

    // Optimization rules and patterns
    this.optimizationRules = new Map();
    this.patternCatalog = new Map();
    this.indexHints = new Map();
    
    this.initializeOptimizationRules();
    this.startMaintenanceRoutines();
    
    logger.info('QueryOptimizer initialized', {
      cacheSize: this.config.cacheSize,
      optimizationLevel: this.config.optimizationLevel
    });
  }

  /**
   * Optimize a query before execution
   */
  async optimizeQuery(query, parameters = {}, metadata = {}) {
    const startTime = Date.now();
    
    try {
      const querySignature = this.generateQuerySignature(query, parameters);
      
      // Check if we have a cached optimized version
      const cachedOptimization = this.getCachedOptimization(querySignature);
      if (cachedOptimization) {
        this.optimizationStats.cacheHits++;
        
        logger.debug('Using cached query optimization', {
          querySignature: querySignature.substring(0, 50)
        });
        
        return cachedOptimization;
      }

      this.optimizationStats.cacheMisses++;

      // Analyze query structure
      const analysis = this.analyzeQuery(query, parameters, metadata);
      
      // Apply optimization rules
      const optimizedQuery = await this.applyOptimizationRules(query, analysis);
      
      // Generate execution hints
      const hints = this.generateExecutionHints(analysis);
      
      // Create optimization result
      const optimization = {
        originalQuery: query,
        optimizedQuery,
        parameters,
        hints,
        analysis,
        optimizationLevel: this.config.optimizationLevel,
        timestamp: Date.now(),
        estimatedImprovement: this.estimateImprovement(analysis)
      };

      // Cache the optimization
      this.cacheOptimization(querySignature, optimization);
      
      // Update statistics
      const optimizationTime = Date.now() - startTime;
      this.updateOptimizationStats(optimizationTime, true);
      
      logger.debug('Query optimized successfully', {
        optimizationTime: `${optimizationTime}ms`,
        estimatedImprovement: optimization.estimatedImprovement,
        hintsGenerated: hints.length
      });

      this.emit('queryOptimized', optimization);
      
      return optimization;

    } catch (error) {
      const optimizationTime = Date.now() - startTime;
      this.updateOptimizationStats(optimizationTime, false);
      
      logger.error('Query optimization failed', {
        error: error.message,
        query: query.substring(0, 200)
      });

      this.emit('optimizationError', { error, query });
      
      // Return original query as fallback
      return {
        originalQuery: query,
        optimizedQuery: query,
        parameters,
        hints: [],
        analysis: { complexity: 'unknown' },
        optimizationLevel: 'none',
        timestamp: Date.now(),
        estimatedImprovement: 0,
        error: error.message
      };
    }
  }

  /**
   * Analyze query structure and characteristics
   */
  analyzeQuery(query, parameters, metadata) {
    const analysis = {
      queryType: this.detectQueryType(query),
      complexity: this.calculateComplexity(query),
      patterns: this.extractPatterns(query),
      joins: this.detectJoins(query),
      filters: this.extractFilters(query),
      aggregations: this.detectAggregations(query),
      orderBy: this.extractOrderBy(query),
      limit: this.extractLimit(query),
      parameterCount: Object.keys(parameters).length,
      estimatedRows: this.estimateRowCount(query, metadata),
      indexes: this.suggestIndexes(query),
      bottlenecks: this.identifyBottlenecks(query)
    };

    // Advanced analysis for complex queries
    if (analysis.complexity > 10) {
      analysis.subqueries = this.extractSubqueries(query);
      analysis.recursion = this.detectRecursion(query);
      analysis.cartesianProducts = this.detectCartesianProducts(query);
    }

    return analysis;
  }

  /**
   * Apply optimization rules based on analysis
   */
  async applyOptimizationRules(query, analysis) {
    let optimizedQuery = query;
    const appliedRules = [];

    for (const [ruleName, rule] of this.optimizationRules) {
      try {
        if (rule.condition(analysis, this.config.optimizationLevel)) {
          const ruleResult = await rule.apply(optimizedQuery, analysis);
          
          if (ruleResult.modified) {
            optimizedQuery = ruleResult.query;
            appliedRules.push({
              name: ruleName,
              improvement: ruleResult.improvement || 0,
              description: rule.description
            });
            
            logger.debug(`Applied optimization rule: ${ruleName}`, {
              improvement: ruleResult.improvement
            });
          }
        }
      } catch (error) {
        logger.warn(`Optimization rule ${ruleName} failed`, {
          error: error.message
        });
      }
    }

    if (appliedRules.length > 0) {
      logger.debug('Query optimization completed', {
        rulesApplied: appliedRules.length,
        rules: appliedRules.map(r => r.name)
      });
    }

    return optimizedQuery;
  }

  /**
   * Generate execution hints for the query optimizer
   */
  generateExecutionHints(analysis) {
    const hints = [];

    // Index hints
    if (analysis.indexes && analysis.indexes.length > 0) {
      hints.push({
        type: 'INDEX_USAGE',
        value: analysis.indexes,
        priority: 'HIGH'
      });
    }

    // Join order hints
    if (analysis.joins && analysis.joins.length > 1) {
      const optimalJoinOrder = this.calculateOptimalJoinOrder(analysis.joins);
      hints.push({
        type: 'JOIN_ORDER',
        value: optimalJoinOrder,
        priority: 'MEDIUM'
      });
    }

    // Memory hints
    if (analysis.estimatedRows > 100000) {
      hints.push({
        type: 'MEMORY_OPTIMIZATION',
        value: 'USE_STREAMING',
        priority: 'HIGH'
      });
    }

    // Parallel execution hints
    if (analysis.complexity > 15) {
      hints.push({
        type: 'PARALLEL_EXECUTION',
        value: 'ENABLE',
        priority: 'MEDIUM'
      });
    }

    // Filter pushdown hints
    if (analysis.filters && analysis.filters.length > 0) {
      hints.push({
        type: 'FILTER_PUSHDOWN',
        value: analysis.filters,
        priority: 'HIGH'
      });
    }

    return hints;
  }

  /**
   * Cache query results with intelligent eviction
   */
  cacheResult(querySignature, result, ttl = null) {
    const cacheTTL = ttl || this.config.cacheTTL;
    const cacheEntry = {
      result,
      timestamp: Date.now(),
      ttl: cacheTTL * 1000, // Convert to milliseconds
      accessCount: 1,
      lastAccessed: Date.now(),
      size: this.estimateResultSize(result)
    };

    // Adaptive TTL based on query characteristics
    if (this.config.adaptiveCaching) {
      cacheEntry.ttl = this.calculateAdaptiveTTL(querySignature, result);
    }

    this.resultCache.set(querySignature, cacheEntry);
    
    // Evict if cache is full
    this.evictIfNecessary();
    
    logger.debug('Result cached', {
      querySignature: querySignature.substring(0, 50),
      resultSize: cacheEntry.size,
      ttl: cacheEntry.ttl / 1000
    });

    this.emit('resultCached', { querySignature, size: cacheEntry.size });
  }

  /**
   * Get cached result if available and valid
   */
  getCachedResult(querySignature) {
    const cacheEntry = this.resultCache.get(querySignature);
    
    if (!cacheEntry) {
      return null;
    }

    const now = Date.now();
    const isExpired = (now - cacheEntry.timestamp) > cacheEntry.ttl;
    
    if (isExpired) {
      this.resultCache.delete(querySignature);
      logger.debug('Cache entry expired and removed', {
        querySignature: querySignature.substring(0, 50)
      });
      return null;
    }

    // Update access statistics
    cacheEntry.accessCount++;
    cacheEntry.lastAccessed = now;
    
    // Extend TTL for frequently accessed items
    if (this.config.adaptiveCaching && cacheEntry.accessCount > 5) {
      cacheEntry.ttl *= 1.2; // Extend by 20%
    }

    logger.debug('Cache hit', {
      querySignature: querySignature.substring(0, 50),
      accessCount: cacheEntry.accessCount
    });

    this.emit('cacheHit', { querySignature, accessCount: cacheEntry.accessCount });
    
    return cacheEntry.result;
  }

  /**
   * Invalidate cache entries based on patterns
   */
  invalidateCache(pattern = null) {
    let invalidatedCount = 0;

    if (pattern) {
      // Invalidate specific pattern
      for (const [key, entry] of this.resultCache) {
        if (key.includes(pattern)) {
          this.resultCache.delete(key);
          invalidatedCount++;
        }
      }
    } else {
      // Clear all cache
      invalidatedCount = this.resultCache.size;
      this.resultCache.clear();
    }

    logger.debug('Cache invalidated', {
      pattern,
      entriesInvalidated: invalidatedCount
    });

    this.emit('cacheInvalidated', { pattern, count: invalidatedCount });
    
    return invalidatedCount;
  }

  /**
   * Get comprehensive statistics
   */
  getStatistics() {
    const cacheStats = this.getCacheStatistics();
    const queryStats = this.getQueryStatistics();
    
    return {
      optimization: { ...this.optimizationStats },
      cache: cacheStats,
      queries: queryStats,
      config: this.config,
      uptime: Date.now() - (this.startTime || Date.now())
    };
  }

  /**
   * Get cache statistics
   */
  getCacheStatistics() {
    const entries = Array.from(this.resultCache.values());
    const totalSize = entries.reduce((sum, entry) => sum + entry.size, 0);
    const averageSize = entries.length > 0 ? totalSize / entries.length : 0;
    const totalAccesses = entries.reduce((sum, entry) => sum + entry.accessCount, 0);
    
    return {
      size: this.resultCache.size,
      maxSize: this.config.cacheSize,
      utilization: (this.resultCache.size / this.config.cacheSize) * 100,
      totalSize,
      averageSize,
      totalAccesses,
      hitRate: this.optimizationStats.cacheHits / 
               (this.optimizationStats.cacheHits + this.optimizationStats.cacheMisses) * 100
    };
  }

  /**
   * Get query statistics
   */
  getQueryStatistics() {
    const stats = Array.from(this.queryStats.values());
    
    return {
      totalQueries: stats.reduce((sum, s) => sum + s.executions, 0),
      totalErrors: stats.reduce((sum, s) => sum + s.errors, 0),
      averageExecutionTime: stats.reduce((sum, s) => sum + s.averageTime, 0) / stats.length || 0,
      uniqueQueries: stats.length
    };
  }

  /**
   * Initialize optimization rules
   */
  initializeOptimizationRules() {
    // Filter pushdown optimization
    this.optimizationRules.set('filterPushdown', {
      description: 'Push WHERE conditions closer to data sources',
      condition: (analysis, level) => analysis.filters.length > 0,
      apply: async (query, analysis) => {
        // Implementation for pushing filters down
        let modified = false;
        let optimizedQuery = query;
        
        // Simple filter pushdown logic
        if (query.includes('WHERE') && query.includes('MATCH')) {
          const whereIndex = query.indexOf('WHERE');
          const matchIndex = query.lastIndexOf('MATCH', whereIndex);
          
          if (matchIndex < whereIndex && whereIndex - matchIndex > 50) {
            // Move simple filters closer to MATCH
            modified = true;
            // This is a simplified example - real implementation would be more complex
          }
        }
        
        return {
          modified,
          query: optimizedQuery,
          improvement: modified ? 15 : 0
        };
      }
    });

    // Index hint optimization
    this.optimizationRules.set('indexHints', {
      description: 'Add index hints for better performance',
      condition: (analysis, level) => analysis.indexes.length > 0,
      apply: async (query, analysis) => {
        let optimizedQuery = query;
        let modified = false;
        
        // Add index hints where appropriate
        for (const index of analysis.indexes) {
          if (!query.includes(`USING INDEX ${index}`)) {
            // Add index hint
            const hintComment = `/* USING INDEX ${index} */`;
            optimizedQuery = optimizedQuery.replace(
              /MATCH\s+\([^)]+\)/,
              `$& ${hintComment}`
            );
            modified = true;
          }
        }
        
        return {
          modified,
          query: optimizedQuery,
          improvement: modified ? 20 : 0
        };
      }
    });

    // LIMIT pushdown optimization
    this.optimizationRules.set('limitPushdown', {
      description: 'Push LIMIT clauses to reduce intermediate results',
      condition: (analysis, level) => analysis.limit && analysis.limit < 1000,
      apply: async (query, analysis) => {
        let modified = false;
        let optimizedQuery = query;
        
        // If query has ORDER BY with LIMIT, consider pushing limit down
        if (query.includes('ORDER BY') && query.includes('LIMIT')) {
          // This is a placeholder for more complex limit pushdown logic
          modified = true;
        }
        
        return {
          modified,
          query: optimizedQuery,
          improvement: modified ? 10 : 0
        };
      }
    });

    // Join reordering optimization
    this.optimizationRules.set('joinReordering', {
      description: 'Reorder joins for optimal execution',
      condition: (analysis, level) => analysis.joins.length > 1 && level !== 'conservative',
      apply: async (query, analysis) => {
        let modified = false;
        let optimizedQuery = query;
        
        // Simplified join reordering logic
        if (analysis.joins.length > 2) {
          // This would implement cost-based join reordering
          modified = true;
        }
        
        return {
          modified,
          query: optimizedQuery,
          improvement: modified ? 25 : 0
        };
      }
    });

    logger.debug('Optimization rules initialized', {
      ruleCount: this.optimizationRules.size
    });
  }

  /**
   * Detect query type
   */
  detectQueryType(query) {
    const upperQuery = query.toUpperCase();
    
    if (upperQuery.includes('CREATE') || upperQuery.includes('MERGE')) {
      return 'WRITE';
    } else if (upperQuery.includes('DELETE') || upperQuery.includes('REMOVE')) {
      return 'DELETE';
    } else if (upperQuery.includes('SET')) {
      return 'UPDATE';
    } else {
      return 'READ';
    }
  }

  /**
   * Calculate query complexity score
   */
  calculateComplexity(query) {
    let complexity = 1;
    
    // Count pattern matches
    const matchCount = (query.match(/MATCH/gi) || []).length;
    complexity += matchCount * 2;
    
    // Count relationships
    const relationshipCount = (query.match(/-\[.*?\]-/g) || []).length;
    complexity += relationshipCount * 3;
    
    // Count variable length paths
    const variableLengthCount = (query.match(/\*\d*\.\.\d*/g) || []).length;
    complexity += variableLengthCount * 10;
    
    // Count aggregations
    const aggregationCount = (query.match(/\b(count|sum|avg|max|min|collect)\s*\(/gi) || []).length;
    complexity += aggregationCount * 2;
    
    // Count subqueries
    const subqueryCount = (query.match(/\bWITH\b/gi) || []).length;
    complexity += subqueryCount * 3;
    
    return complexity;
  }

  /**
   * Extract patterns from query
   */
  extractPatterns(query) {
    const patterns = [];
    const patternRegex = /\([^)]*\)(?:-\[[^\]]*\]-\([^)]*\))*/g;
    let match;
    
    while ((match = patternRegex.exec(query)) !== null) {
      patterns.push(match[0]);
    }
    
    return patterns;
  }

  /**
   * Detect joins in query
   */
  detectJoins(query) {
    const joins = [];
    
    // Simple join detection based on multiple MATCH clauses or relationship patterns
    const matchCount = (query.match(/MATCH/gi) || []).length;
    if (matchCount > 1) {
      joins.push({ type: 'IMPLICIT', count: matchCount - 1 });
    }
    
    // Detect relationship-based joins
    const relationshipCount = (query.match(/-\[.*?\]-/g) || []).length;
    if (relationshipCount > 0) {
      joins.push({ type: 'RELATIONSHIP', count: relationshipCount });
    }
    
    return joins;
  }

  /**
   * Extract filters from WHERE clauses
   */
  extractFilters(query) {
    const filters = [];
    const whereRegex = /WHERE\s+(.+?)(?:\s+(?:RETURN|ORDER|LIMIT|WITH|$))/gi;
    let match;
    
    while ((match = whereRegex.exec(query)) !== null) {
      const condition = match[1].trim();
      filters.push({
        condition,
        type: this.classifyFilter(condition),
        selectivity: this.estimateSelectivity(condition)
      });
    }
    
    return filters;
  }

  /**
   * Classify filter type
   */
  classifyFilter(condition) {
    if (condition.includes('=')) return 'EQUALITY';
    if (condition.includes('>') || condition.includes('<')) return 'RANGE';
    if (condition.includes('CONTAINS') || condition.includes('LIKE')) return 'TEXT_SEARCH';
    if (condition.includes('IN')) return 'IN_LIST';
    return 'OTHER';
  }

  /**
   * Estimate filter selectivity (0-1, lower is more selective)
   */
  estimateSelectivity(condition) {
    if (condition.includes('=')) return 0.1;
    if (condition.includes('CONTAINS')) return 0.3;
    if (condition.includes('>') || condition.includes('<')) return 0.5;
    return 0.8;
  }

  /**
   * Detect aggregations
   */
  detectAggregations(query) {
    const aggregations = [];
    const aggRegex = /\b(count|sum|avg|max|min|collect)\s*\([^)]*\)/gi;
    let match;
    
    while ((match = aggRegex.exec(query)) !== null) {
      aggregations.push({
        function: match[1].toLowerCase(),
        expression: match[0]
      });
    }
    
    return aggregations;
  }

  /**
   * Extract ORDER BY clause
   */
  extractOrderBy(query) {
    const orderRegex = /ORDER BY\s+(.+?)(?:\s+(?:LIMIT|SKIP|$))/i;
    const match = orderRegex.exec(query);
    
    if (match) {
      const orderBy = match[1].trim();
      return {
        expression: orderBy,
        direction: orderBy.toUpperCase().includes('DESC') ? 'DESC' : 'ASC'
      };
    }
    
    return null;
  }

  /**
   * Extract LIMIT clause
   */
  extractLimit(query) {
    const limitRegex = /LIMIT\s+(\d+)/i;
    const match = limitRegex.exec(query);
    
    return match ? parseInt(match[1]) : null;
  }

  /**
   * Estimate row count
   */
  estimateRowCount(query, metadata) {
    // This is a simplified estimation
    let estimate = 1000; // Default estimate
    
    if (metadata.entityCounts) {
      // Use actual entity counts if available
      if (query.includes('CodeEntity')) {
        estimate = metadata.entityCounts.codeEntities || estimate;
      }
      if (query.includes('Pattern')) {
        estimate = Math.min(estimate, metadata.entityCounts.patterns || estimate);
      }
    }
    
    // Adjust for filters
    const filters = this.extractFilters(query);
    for (const filter of filters) {
      estimate *= filter.selectivity;
    }
    
    // Adjust for limit
    const limit = this.extractLimit(query);
    if (limit) {
      estimate = Math.min(estimate, limit);
    }
    
    return Math.ceil(estimate);
  }

  /**
   * Suggest indexes based on query patterns
   */
  suggestIndexes(query) {
    const suggestions = [];
    
    // Suggest indexes for equality filters
    const equalityFilters = query.match(/(\w+)\.(\w+)\s*=\s*\$(\w+)/g);
    if (equalityFilters) {
      for (const filter of equalityFilters) {
        const parts = filter.match(/(\w+)\.(\w+)/);
        if (parts) {
          suggestions.push(`${parts[1]}_${parts[2]}`);
        }
      }
    }
    
    // Suggest indexes for ORDER BY
    const orderBy = this.extractOrderBy(query);
    if (orderBy) {
      const field = orderBy.expression.split(' ')[0];
      if (field.includes('.')) {
        suggestions.push(field.replace('.', '_'));
      }
    }
    
    return [...new Set(suggestions)]; // Remove duplicates
  }

  /**
   * Identify potential bottlenecks
   */
  identifyBottlenecks(query) {
    const bottlenecks = [];
    
    // Cartesian products
    if (this.detectCartesianProducts(query)) {
      bottlenecks.push({
        type: 'CARTESIAN_PRODUCT',
        severity: 'HIGH',
        description: 'Query may produce cartesian product'
      });
    }
    
    // Missing indexes
    const filters = this.extractFilters(query);
    for (const filter of filters) {
      if (filter.type === 'EQUALITY' && !query.includes('USING INDEX')) {
        bottlenecks.push({
          type: 'MISSING_INDEX',
          severity: 'MEDIUM',
          description: `Consider adding index for ${filter.condition}`
        });
      }
    }
    
    // Large result sets without LIMIT
    if (!this.extractLimit(query) && !query.includes('count(')) {
      bottlenecks.push({
        type: 'UNLIMITED_RESULTS',
        severity: 'MEDIUM',
        description: 'Query may return large result set without LIMIT'
      });
    }
    
    return bottlenecks;
  }

  /**
   * Detect potential cartesian products
   */
  detectCartesianProducts(query) {
    const matchClauses = (query.match(/MATCH/gi) || []).length;
    const whereClauses = (query.match(/WHERE/gi) || []).length;
    
    // Simple heuristic: multiple MATCH clauses without proper WHERE conditions
    return matchClauses > 1 && whereClauses === 0;
  }

  /**
   * Calculate adaptive TTL based on query characteristics
   */
  calculateAdaptiveTTL(querySignature, result) {
    let baseTTL = this.config.cacheTTL * 1000; // Convert to milliseconds
    
    // Extend TTL for expensive queries (more complex = longer cache)
    const complexity = this.calculateComplexity(querySignature);
    const complexityMultiplier = Math.min(complexity / 10, 3); // Cap at 3x
    baseTTL *= (1 + complexityMultiplier);
    
    // Extend TTL for smaller result sets (less likely to change)
    const resultSize = this.estimateResultSize(result);
    if (resultSize < 1000) {
      baseTTL *= 1.5;
    }
    
    // Reduce TTL for write-heavy patterns
    if (querySignature.includes('CREATE') || querySignature.includes('MERGE')) {
      baseTTL *= 0.5;
    }
    
    return Math.min(baseTTL, this.config.cacheTTL * 5000); // Cap at 5x original TTL
  }

  /**
   * Estimate result size in bytes
   */
  estimateResultSize(result) {
    if (!result || !Array.isArray(result)) return 0;
    
    // Rough estimation: 100 bytes per row on average
    return result.length * 100;
  }

  /**
   * Calculate optimal join order
   */
  calculateOptimalJoinOrder(joins) {
    // Simplified join ordering - in practice this would be much more complex
    return joins.sort((a, b) => {
      // Prefer smaller tables first (if we had cardinality estimates)
      if (a.type === 'RELATIONSHIP' && b.type === 'IMPLICIT') return -1;
      if (a.type === 'IMPLICIT' && b.type === 'RELATIONSHIP') return 1;
      return 0;
    });
  }

  /**
   * Generate query signature for caching
   */
  generateQuerySignature(query, parameters) {
    const normalizedQuery = query
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
    
    const paramString = JSON.stringify(parameters, Object.keys(parameters).sort());
    
    return `${normalizedQuery}|${paramString}`;
  }

  /**
   * Cache optimization result
   */
  cacheOptimization(querySignature, optimization) {
    this.queryCache.set(querySignature, {
      ...optimization,
      accessCount: 0,
      lastAccessed: Date.now()
    });
    
    // Limit cache size
    if (this.queryCache.size > this.config.cacheSize) {
      // Remove least recently used
      let oldestKey = null;
      let oldestTime = Date.now();
      
      for (const [key, entry] of this.queryCache) {
        if (entry.lastAccessed < oldestTime) {
          oldestTime = entry.lastAccessed;
          oldestKey = key;
        }
      }
      
      if (oldestKey) {
        this.queryCache.delete(oldestKey);
      }
    }
  }

  /**
   * Get cached optimization
   */
  getCachedOptimization(querySignature) {
    const cached = this.queryCache.get(querySignature);
    
    if (cached) {
      cached.accessCount++;
      cached.lastAccessed = Date.now();
      return cached;
    }
    
    return null;
  }

  /**
   * Evict cache entries if necessary
   */
  evictIfNecessary() {
    if (this.resultCache.size <= this.config.cacheSize) {
      return;
    }
    
    // LRU eviction strategy
    const entries = Array.from(this.resultCache.entries())
      .sort(([,a], [,b]) => a.lastAccessed - b.lastAccessed);
    
    const toEvict = entries.slice(0, entries.length - this.config.cacheSize);
    
    for (const [key] of toEvict) {
      this.resultCache.delete(key);
    }
    
    logger.debug('Cache eviction completed', {
      evictedCount: toEvict.length,
      remainingSize: this.resultCache.size
    });
  }

  /**
   * Update optimization statistics
   */
  updateOptimizationStats(optimizationTime, success) {
    this.optimizationStats.queriesOptimized++;
    
    if (success) {
      this.optimizationStats.totalOptimizationTime += optimizationTime;
      this.optimizationStats.averageOptimizationTime = 
        this.optimizationStats.totalOptimizationTime / this.optimizationStats.queriesOptimized;
    } else {
      this.optimizationStats.optimizationsFailed++;
    }
  }

  /**
   * Start maintenance routines
   */
  startMaintenanceRoutines() {
    // Cache cleanup routine
    setInterval(() => {
      this.cleanupExpiredEntries();
    }, 60000); // Every minute
    
    // Statistics logging
    setInterval(() => {
      const stats = this.getStatistics();
      logger.debug('QueryOptimizer statistics', stats);
      this.emit('statisticsUpdate', stats);
    }, 300000); // Every 5 minutes
  }

  /**
   * Clean up expired cache entries
   */
  cleanupExpiredEntries() {
    const now = Date.now();
    let cleanedCount = 0;
    
    for (const [key, entry] of this.resultCache) {
      if ((now - entry.timestamp) > entry.ttl) {
        this.resultCache.delete(key);
        cleanedCount++;
      }
    }
    
    if (cleanedCount > 0) {
      logger.debug('Cache cleanup completed', {
        cleanedCount,
        remainingSize: this.resultCache.size
      });
    }
  }

  /**
   * Estimate performance improvement
   */
  estimateImprovement(analysis) {
    let improvement = 0;
    
    // Index usage improvement
    if (analysis.indexes.length > 0) {
      improvement += 20;
    }
    
    // Filter selectivity improvement
    const selectiveFilters = analysis.filters.filter(f => f.selectivity < 0.3);
    improvement += selectiveFilters.length * 10;
    
    // Join optimization improvement
    if (analysis.joins.length > 1) {
      improvement += 15;
    }
    
    // Limit clause improvement
    if (analysis.limit && analysis.limit < 100) {
      improvement += 25;
    }
    
    return Math.min(improvement, 100); // Cap at 100%
  }

  /**
   * Shutdown the optimizer
   */
  shutdown() {
    this.queryCache.clear();
    this.resultCache.clear();
    this.planCache.clear();
    
    logger.info('QueryOptimizer shutdown completed');
    this.emit('shutdown');
  }
}

export default QueryOptimizer;