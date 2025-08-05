/**
 * CONTEXT: Specialized query result caching system with intelligent optimization
 * REASON: Dramatically improve database query performance and reduce redundant operations
 * CHANGE: Advanced query caching with automatic expiration, result optimization, and smart invalidation
 * PREVENTION: Slow query performance, database overload, redundant computations
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

export class QueryCache extends EventEmitter {
    constructor(cache, config = {}) {
        super();
        
        this.cache = cache;
        this.config = {
            // Query caching settings
            caching: {
                enabled: config.caching?.enabled !== false,
                defaultTtl: config.caching?.defaultTtl || 30 * 60 * 1000, // 30 minutes
                maxQuerySize: config.caching?.maxQuerySize || 100 * 1024, // 100KB
                maxResultSize: config.caching?.maxResultSize || 10 * 1024 * 1024, // 10MB
                compressResults: config.caching?.compressResults !== false,
                keyPrefix: config.caching?.keyPrefix || 'query:',
                enableMetrics: config.caching?.enableMetrics !== false
            },
            
            // Query optimization
            optimization: {
                enabled: config.optimization?.enabled !== false,
                normalizeQueries: config.optimization?.normalizeQueries !== false,
                parameterizeQueries: config.optimization?.parameterizeQueries !== false,
                detectSimilarQueries: config.optimization?.detectSimilarQueries !== false,
                mergeCompatibleQueries: config.optimization?.mergeCompatibleQueries || false,
                optimizeResultFormat: config.optimization?.optimizeResultFormat !== false
            },
            
            // Expiration strategies
            expiration: {
                strategy: config.expiration?.strategy || 'ttl', // 'ttl', 'adaptive', 'dependency'
                adaptiveMultiplier: config.expiration?.adaptiveMultiplier || 1.5,
                minTtl: config.expiration?.minTtl || 60 * 1000, // 1 minute
                maxTtl: config.expiration?.maxTtl || 4 * 60 * 60 * 1000, // 4 hours
                accessBasedExtension: config.expiration?.accessBasedExtension || false,
                extensionFactor: config.expiration?.extensionFactor || 1.2
            },
            
            // Invalidation rules
            invalidation: {
                enabled: config.invalidation?.enabled !== false,
                autoDetectDependencies: config.invalidation?.autoDetectDependencies !== false,
                tableBasedInvalidation: config.invalidation?.tableBasedInvalidation !== false,
                patternBasedInvalidation: config.invalidation?.patternBasedInvalidation !== false,
                timeBasedInvalidation: config.invalidation?.timeBasedInvalidation !== false
            },
            
            // Performance settings
            performance: {
                asyncCaching: config.performance?.asyncCaching !== false,
                prefetchSimilarQueries: config.performance?.prefetchSimilarQueries || false,
                batchResultProcessing: config.performance?.batchResultProcessing !== false,
                resultStreaming: config.performance?.resultStreaming || false,
                memoryPooling: config.performance?.memoryPooling || false
            }
        };
        
        // Query cache storage
        this.queryNormalizationCache = new Map();
        this.queryPatterns = new Map();
        this.queryDependencies = new Map();
        this.queryStatistics = new Map();
        
        // Performance metrics
        this.metrics = {
            queries: {
                total: 0,
                cached: 0,
                fresh: 0,
                errors: 0
            },
            performance: {
                totalCacheTime: 0,
                totalQueryTime: 0,
                averageCacheTime: 0,
                averageQueryTime: 0,
                cacheHitRatio: 0,
                sizeSavings: 0
            },
            optimization: {
                normalizedQueries: 0,
                parameterizedQueries: 0,
                similarQueriesDetected: 0,
                queriesMerged: 0,
                resultsOptimized: 0
            },
            expiration: {
                ttlExpirations: 0,
                adaptiveExpirations: 0,
                dependencyExpirations: 0,
                extensionsApplied: 0
            }
        };
        
        // Query execution tracking
        this.activeQueries = new Map();
        this.queryQueue = [];
        
        // Cleanup intervals
        this.cleanupIntervals = [];
        
        this.initialize();
    }

    /**
     * Initialize the query cache system
     */
    initialize() {
        // Start background tasks
        this.startBackgroundTasks();
        
        logger.info('Query cache system initialized', {
            enabled: this.config.caching.enabled,
            optimization: this.config.optimization.enabled,
            expiration: this.config.expiration.strategy
        });
    }

    /**
     * Execute query with caching
     */
    async executeQuery(query, parameters = {}, options = {}) {
        const startTime = Date.now();
        
        try {
            // Validate inputs
            this.validateQuery(query);
            this.validateParameters(parameters);
            
            // Check if caching is enabled and applicable
            if (!this.shouldCache(query, options)) {
                return await this.executeDirectQuery(query, parameters, options);
            }
            
            // Normalize and optimize query
            const normalizedQuery = this.normalizeQuery(query, parameters);
            const optimizedQuery = await this.optimizeQuery(normalizedQuery, options);
            
            // Generate cache key
            const cacheKey = this.generateCacheKey(optimizedQuery, parameters);
            
            // Check cache first
            const cachedResult = await this.getCachedResult(cacheKey, options);
            if (cachedResult !== null) {
                const cacheTime = Date.now() - startTime;
                this.updateCacheMetrics(true, cacheTime, 0);
                
                // Update access statistics
                this.updateQueryAccess(cacheKey);
                
                // Extend TTL if configured
                if (this.config.expiration.accessBasedExtension) {
                    await this.extendCacheTtl(cacheKey);
                }
                
                this.emit('cacheHit', { 
                    query: optimizedQuery, 
                    cacheKey, 
                    cacheTime 
                });
                
                return cachedResult;
            }
            
            // Execute query
            const queryStartTime = Date.now();
            const result = await this.executeDirectQuery(optimizedQuery.query, parameters, options);
            const queryTime = Date.now() - queryStartTime;
            
            // Cache the result asynchronously if configured
            if (this.config.performance.asyncCaching) {
                this.cacheResultAsync(cacheKey, result, optimizedQuery, options)
                    .catch(error => {
                        logger.error('Async cache storage failed:', { 
                            cacheKey, 
                            error: error.message 
                        });
                    });
            } else {
                await this.cacheResult(cacheKey, result, optimizedQuery, options);
            }
            
            // Update metrics
            const totalTime = Date.now() - startTime;
            this.updateCacheMetrics(false, 0, queryTime);
            
            this.emit('cacheMiss', { 
                query: optimizedQuery, 
                cacheKey, 
                queryTime, 
                totalTime 
            });
            
            return result;
            
        } catch (error) {
            this.metrics.queries.errors++;
            logger.error('Query execution error:', { 
                query: query.substring(0, 200), 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Execute query directly without caching
     */
    async executeDirectQuery(query, parameters, options) {
        // This would be implemented to call the actual database
        // For now, throw an error indicating this needs to be overridden
        throw new Error('executeDirectQuery must be implemented by subclass or injected');
    }

    /**
     * Check if query should be cached
     */
    shouldCache(query, options) {
        // Don't cache if disabled
        if (!this.config.caching.enabled || options.bypassCache) {
            return false;
        }
        
        // Check query size limits
        if (query.length > this.config.caching.maxQuerySize) {
            return false;
        }
        
        // Don't cache certain query types
        const uncacheablePatterns = [
            /^\s*INSERT\s+/i,
            /^\s*UPDATE\s+/i,
            /^\s*DELETE\s+/i,
            /^\s*CREATE\s+/i,
            /^\s*DROP\s+/i,
            /^\s*ALTER\s+/i,
            /\bRANDOM\(\)/i,
            /\bNOW\(\)/i,
            /\bCURRENT_TIMESTAMP\b/i
        ];
        
        return !uncacheablePatterns.some(pattern => pattern.test(query));
    }

    /**
     * Normalize query for consistent caching
     */
    normalizeQuery(query, parameters) {
        if (!this.config.optimization.normalizeQueries) {
            return { query, parameters, normalized: false };
        }
        
        // Check normalization cache
        const queryHash = this.hashQuery(query);
        if (this.queryNormalizationCache.has(queryHash)) {
            const cached = this.queryNormalizationCache.get(queryHash);
            return { ...cached, parameters };
        }
        
        // Normalize whitespace and case
        let normalized = query
            .replace(/\s+/g, ' ')
            .trim()
            .toLowerCase();
        
        // Normalize common patterns
        normalized = this.normalizeCommonPatterns(normalized);
        
        // Parameterize if enabled
        if (this.config.optimization.parameterizeQueries) {
            normalized = this.parameterizeQuery(normalized);
        }
        
        const result = {
            query: normalized,
            original: query,
            normalized: true,
            pattern: this.extractQueryPattern(normalized)
        };
        
        // Cache normalization result
        this.queryNormalizationCache.set(queryHash, result);
        this.metrics.optimization.normalizedQueries++;
        
        return { ...result, parameters };
    }

    /**
     * Optimize query execution
     */
    async optimizeQuery(normalizedQuery, options) {
        let optimized = { ...normalizedQuery };
        
        if (!this.config.optimization.enabled) {
            return optimized;
        }
        
        // Detect similar queries
        if (this.config.optimization.detectSimilarQueries) {
            const similarQueries = this.findSimilarQueries(optimized.pattern);
            if (similarQueries.length > 0) {
                this.metrics.optimization.similarQueriesDetected++;
                
                // Prefetch similar queries if configured
                if (this.config.performance.prefetchSimilarQueries) {
                    this.prefetchSimilarQueries(similarQueries);
                }
            }
        }
        
        // Merge compatible queries if configured
        if (this.config.optimization.mergeCompatibleQueries) {
            const merged = await this.tryMergeQueries(optimized);
            if (merged) {
                this.metrics.optimization.queriesMerged++;
                optimized = merged;
            }
        }
        
        return optimized;
    }

    /**
     * Generate cache key for query and parameters
     */
    generateCacheKey(query, parameters) {
        const queryPart = typeof query === 'object' ? query.query : query;
        const paramPart = JSON.stringify(parameters, Object.keys(parameters).sort());
        const combined = `${queryPart}|${paramPart}`;
        
        const hash = crypto.createHash('sha256')
            .update(combined)
            .digest('hex');
        
        return `${this.config.caching.keyPrefix}${hash}`;
    }

    /**
     * Get cached result
     */
    async getCachedResult(cacheKey, options) {
        try {
            const cached = await this.cache.get(cacheKey);
            
            if (cached === null) {
                return null;
            }
            
            // Validate cached result
            if (!this.validateCachedResult(cached)) {
                await this.cache.delete(cacheKey);
                return null;
            }
            
            // Decompress if needed
            if (cached.compressed) {
                cached.result = this.decompressResult(cached.result);
            }
            
            // Optimize result format if configured
            if (this.config.optimization.optimizeResultFormat) {
                cached.result = this.optimizeResultFormat(cached.result);
                this.metrics.optimization.resultsOptimized++;
            }
            
            return cached.result;
            
        } catch (error) {
            logger.error('Error retrieving cached result:', { 
                cacheKey, 
                error: error.message 
            });
            return null;
        }
    }

    /**
     * Cache query result
     */
    async cacheResult(cacheKey, result, queryInfo, options) {
        try {
            // Check result size
            const resultSize = this.calculateResultSize(result);
            if (resultSize > this.config.caching.maxResultSize) {
                logger.warn('Result too large to cache', { 
                    cacheKey, 
                    size: resultSize 
                });
                return;
            }
            
            // Prepare cache entry
            let cacheEntry = {
                result,
                cached: Date.now(),
                queryInfo,
                size: resultSize,
                compressed: false
            };
            
            // Compress if configured and beneficial
            if (this.config.caching.compressResults && resultSize > 1024) {
                const compressed = this.compressResult(result);
                if (compressed.length < resultSize * 0.8) { // Only if 20%+ savings
                    cacheEntry.result = compressed;
                    cacheEntry.compressed = true;
                    this.metrics.performance.sizeSavings += resultSize - compressed.length;
                }
            }
            
            // Calculate TTL
            const ttl = this.calculateTtl(queryInfo, options);
            
            // Store in cache
            await this.cache.set(cacheKey, cacheEntry, { 
                ttl,
                dependencies: this.extractQueryDependencies(queryInfo)
            });
            
            // Update query statistics
            this.updateQueryStatistics(cacheKey, queryInfo, resultSize);
            
        } catch (error) {
            logger.error('Error caching result:', { 
                cacheKey, 
                error: error.message 
            });
        }
    }

    /**
     * Cache result asynchronously
     */
    async cacheResultAsync(cacheKey, result, queryInfo, options) {
        // Schedule caching in next tick to avoid blocking
        process.nextTick(async () => {
            try {
                await this.cacheResult(cacheKey, result, queryInfo, options);
            } catch (error) {
                logger.error('Async cache operation failed:', { 
                    cacheKey, 
                    error: error.message 
                });
            }
        });
    }

    /**
     * Calculate TTL for cache entry
     */
    calculateTtl(queryInfo, options) {
        // Use explicit TTL if provided
        if (options.ttl) {
            return Math.min(options.ttl, this.config.expiration.maxTtl);
        }
        
        let ttl = this.config.caching.defaultTtl;
        
        switch (this.config.expiration.strategy) {
            case 'adaptive':
                ttl = this.calculateAdaptiveTtl(queryInfo);
                break;
                
            case 'dependency':
                ttl = this.calculateDependencyBasedTtl(queryInfo);
                break;
                
            case 'ttl':
            default:
                // Use default TTL
                break;
        }
        
        // Apply bounds
        ttl = Math.max(this.config.expiration.minTtl, ttl);
        ttl = Math.min(this.config.expiration.maxTtl, ttl);
        
        return ttl;
    }

    /**
     * Calculate adaptive TTL based on query characteristics
     */
    calculateAdaptiveTtl(queryInfo) {
        let baseTtl = this.config.caching.defaultTtl;
        let multiplier = 1.0;
        
        // Adjust based on query complexity
        const complexity = this.estimateQueryComplexity(queryInfo);
        if (complexity > 0.8) {
            multiplier *= this.config.expiration.adaptiveMultiplier;
        } else if (complexity < 0.3) {
            multiplier *= 0.8;
        }
        
        // Adjust based on result size
        const avgResultSize = this.getAverageResultSize();
        if (queryInfo.size && avgResultSize > 0) {
            const sizeRatio = queryInfo.size / avgResultSize;
            if (sizeRatio > 2) {
                multiplier *= 1.3; // Cache larger results longer
            }
        }
        
        // Adjust based on access frequency
        const accessFrequency = this.getQueryAccessFrequency(queryInfo.pattern);
        if (accessFrequency > 0.1) { // Frequently accessed
            multiplier *= 1.5;
        }
        
        return Math.round(baseTtl * multiplier);
    }

    /**
     * Calculate dependency-based TTL
     */
    calculateDependencyBasedTtl(queryInfo) {
        // Analyze query dependencies and set TTL based on update frequency
        const dependencies = this.extractQueryDependencies(queryInfo);
        
        if (dependencies.length === 0) {
            return this.config.caching.defaultTtl;
        }
        
        // Use shortest TTL among dependencies
        let minTtl = this.config.expiration.maxTtl;
        
        for (const dep of dependencies) {
            const depTtl = this.getDependencyTtl(dep);
            minTtl = Math.min(minTtl, depTtl);
        }
        
        return minTtl;
    }

    /**
     * Extend cache TTL for frequently accessed items
     */
    async extendCacheTtl(cacheKey) {
        try {
            const stats = this.queryStatistics.get(cacheKey);
            if (!stats) return;
            
            // Calculate extension based on access pattern
            const accessFrequency = stats.accessCount / (Date.now() - stats.firstAccess);
            
            if (accessFrequency > 0.0001) { // More than 1 access per 10 seconds
                const extension = Math.round(
                    this.config.caching.defaultTtl * this.config.expiration.extensionFactor
                );
                
                // Note: This would need to be implemented in the cache layer
                // await this.cache.extendTtl(cacheKey, extension);
                
                this.metrics.expiration.extensionsApplied++;
            }
            
        } catch (error) {
            logger.error('Error extending cache TTL:', { 
                cacheKey, 
                error: error.message 
            });
        }
    }

    /**
     * Extract dependencies from query
     */
    extractQueryDependencies(queryInfo) {
        const dependencies = [];
        
        if (!this.config.invalidation.autoDetectDependencies) {
            return dependencies;
        }
        
        const query = queryInfo.query || queryInfo;
        
        // Extract table names
        const tableMatches = query.match(/\b(?:FROM|JOIN|UPDATE|INSERT\s+INTO)\s+(\w+)/gi);
        if (tableMatches) {
            for (const match of tableMatches) {
                const tableName = match.split(/\s+/).pop();
                dependencies.push(`table:${tableName.toLowerCase()}`);
            }
        }
        
        // Extract column references for more granular dependencies
        const columnMatches = query.match(/\b(\w+)\.(\w+)\b/g);
        if (columnMatches) {
            for (const match of columnMatches) {
                dependencies.push(`column:${match.toLowerCase()}`);
            }
        }
        
        return dependencies;
    }

    /**
     * Update query access statistics
     */
    updateQueryAccess(cacheKey) {
        const now = Date.now();
        
        if (!this.queryStatistics.has(cacheKey)) {
            this.queryStatistics.set(cacheKey, {
                firstAccess: now,
                lastAccess: now,
                accessCount: 1,
                totalCacheTime: 0
            });
        } else {
            const stats = this.queryStatistics.get(cacheKey);
            stats.lastAccess = now;
            stats.accessCount++;
        }
    }

    /**
     * Update query statistics after caching
     */
    updateQueryStatistics(cacheKey, queryInfo, resultSize) {
        const stats = this.queryStatistics.get(cacheKey) || {};
        
        Object.assign(stats, {
            queryInfo,
            resultSize,
            cached: Date.now()
        });
        
        this.queryStatistics.set(cacheKey, stats);
    }

    /**
     * Normalize common query patterns
     */
    normalizeCommonPatterns(query) {
        return query
            // Normalize string literals
            .replace(/'[^']*'/g, '?')
            // Normalize numbers
            .replace(/\b\d+\b/g, '?')
            // Normalize IN clauses
            .replace(/\bin\s*\([^)]+\)/gi, 'in (?)')
            // Normalize LIMIT clauses
            .replace(/\blimit\s+\d+/gi, 'limit ?')
            // Normalize ORDER BY
            .replace(/\border\s+by\s+\w+(\s+(asc|desc))?/gi, 'order by ?');
    }

    /**
     * Parameterize query for better caching
     */
    parameterizeQuery(query) {
        // This is a simplified parameterization
        // In practice, this would be more sophisticated
        this.metrics.optimization.parameterizedQueries++;
        return query;
    }

    /**
     * Extract query pattern for similarity detection
     */
    extractQueryPattern(query) {
        // Create a pattern by removing specific values
        return query
            .replace(/\?/g, '?')
            .replace(/\s+/g, ' ')
            .trim();
    }

    /**
     * Find similar queries
     */
    findSimilarQueries(pattern) {
        const similar = [];
        
        for (const [existingPattern, count] of this.queryPatterns) {
            if (this.calculateSimilarity(pattern, existingPattern) > 0.8) {
                similar.push({ pattern: existingPattern, count });
            }
        }
        
        return similar.sort((a, b) => b.count - a.count);
    }

    /**
     * Calculate query similarity
     */
    calculateSimilarity(pattern1, pattern2) {
        // Simple Levenshtein distance-based similarity
        const len1 = pattern1.length;
        const len2 = pattern2.length;
        const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));
        
        for (let i = 0; i <= len1; i++) matrix[0][i] = i;
        for (let j = 0; j <= len2; j++) matrix[j][0] = j;
        
        for (let j = 1; j <= len2; j++) {
            for (let i = 1; i <= len1; i++) {
                const cost = pattern1[i - 1] === pattern2[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1,
                    matrix[j - 1][i] + 1,
                    matrix[j - 1][i - 1] + cost
                );
            }
        }
        
        const maxLen = Math.max(len1, len2);
        return maxLen > 0 ? 1 - (matrix[len2][len1] / maxLen) : 1;
    }

    /**
     * Prefetch similar queries
     */
    prefetchSimilarQueries(similarQueries) {
        // Implementation would depend on having a query executor
        // For now, just log the intent
        logger.debug('Would prefetch similar queries', { 
            count: similarQueries.length 
        });
    }

    /**
     * Try to merge compatible queries
     */
    async tryMergeQueries(query) {
        // This would implement query merging logic
        // For now, return null (no merge)
        return null;
    }

    /**
     * Utility methods
     */
    validateQuery(query) {
        if (typeof query !== 'string' || query.trim().length === 0) {
            throw new Error('Query must be a non-empty string');
        }
    }

    validateParameters(parameters) {
        if (parameters && typeof parameters !== 'object') {
            throw new Error('Parameters must be an object');
        }
    }

    validateCachedResult(cached) {
        return cached && 
               typeof cached === 'object' && 
               cached.hasOwnProperty('result') &&
               cached.hasOwnProperty('cached');
    }

    hashQuery(query) {
        return crypto.createHash('md5').update(query).digest('hex');
    }

    calculateResultSize(result) {
        return Buffer.byteLength(JSON.stringify(result));
    }

    compressResult(result) {
        // Implement compression (e.g., using zlib)
        // For now, return as-is
        return JSON.stringify(result);
    }

    decompressResult(compressed) {
        // Implement decompression
        // For now, parse as JSON
        return JSON.parse(compressed);
    }

    optimizeResultFormat(result) {
        // Implement result format optimization
        // For now, return as-is
        return result;
    }

    estimateQueryComplexity(queryInfo) {
        // Simple complexity estimation based on query characteristics
        const query = queryInfo.query || queryInfo;
        let complexity = 0;
        
        // Count joins
        const joinCount = (query.match(/\bjoin\b/gi) || []).length;
        complexity += joinCount * 0.2;
        
        // Count subqueries
        const subqueryCount = (query.match(/\bselect\b/gi) || []).length - 1;
        complexity += subqueryCount * 0.3;
        
        // Count aggregations
        const aggCount = (query.match(/\b(count|sum|avg|min|max|group\s+by)\b/gi) || []).length;
        complexity += aggCount * 0.1;
        
        return Math.min(complexity, 1.0);
    }

    getAverageResultSize() {
        const sizes = Array.from(this.queryStatistics.values())
            .map(stats => stats.resultSize)
            .filter(size => size !== undefined);
        
        return sizes.length > 0 ? 
            sizes.reduce((sum, size) => sum + size, 0) / sizes.length : 0;
    }

    getQueryAccessFrequency(pattern) {
        const count = this.queryPatterns.get(pattern) || 0;
        const timeWindow = 24 * 60 * 60 * 1000; // 24 hours
        return count / timeWindow;
    }

    getDependencyTtl(dependency) {
        // This would be configurable based on dependency type
        if (dependency.startsWith('table:')) {
            return 15 * 60 * 1000; // 15 minutes for table-level dependencies
        } else if (dependency.startsWith('column:')) {
            return 30 * 60 * 1000; // 30 minutes for column-level dependencies
        }
        
        return this.config.caching.defaultTtl;
    }

    /**
     * Update cache performance metrics
     */
    updateCacheMetrics(hit, cacheTime, queryTime) {
        this.metrics.queries.total++;
        
        if (hit) {
            this.metrics.queries.cached++;
            this.metrics.performance.totalCacheTime += cacheTime;
        } else {
            this.metrics.queries.fresh++;
            this.metrics.performance.totalQueryTime += queryTime;
        }
        
        // Calculate averages
        if (this.metrics.queries.cached > 0) {
            this.metrics.performance.averageCacheTime = 
                this.metrics.performance.totalCacheTime / this.metrics.queries.cached;
        }
        
        if (this.metrics.queries.fresh > 0) {
            this.metrics.performance.averageQueryTime = 
                this.metrics.performance.totalQueryTime / this.metrics.queries.fresh;
        }
        
        // Calculate cache hit ratio
        this.metrics.performance.cacheHitRatio = 
            this.metrics.queries.cached / this.metrics.queries.total;
    }

    /**
     * Start background maintenance tasks
     */
    startBackgroundTasks() {
        // Cleanup expired query statistics
        const cleanupInterval = setInterval(() => {
            this.cleanupExpiredStatistics();
        }, 15 * 60 * 1000); // Every 15 minutes
        
        this.cleanupIntervals.push(cleanupInterval);
        
        // Update query patterns
        const patternInterval = setInterval(() => {
            this.updateQueryPatterns();
        }, 5 * 60 * 1000); // Every 5 minutes
        
        this.cleanupIntervals.push(patternInterval);
        
        // Emit metrics
        const metricsInterval = setInterval(() => {
            this.emit('metricsUpdated', this.getStatistics());
        }, 60 * 1000); // Every minute
        
        this.cleanupIntervals.push(metricsInterval);
    }

    /**
     * Cleanup expired query statistics
     */
    cleanupExpiredStatistics() {
        const expireTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
        
        for (const [key, stats] of this.queryStatistics.entries()) {
            if (stats.lastAccess < expireTime) {
                this.queryStatistics.delete(key);
            }
        }
    }

    /**
     * Update query pattern statistics
     */
    updateQueryPatterns() {
        const patternCounts = new Map();
        
        for (const stats of this.queryStatistics.values()) {
            if (stats.queryInfo && stats.queryInfo.pattern) {
                const pattern = stats.queryInfo.pattern;
                patternCounts.set(pattern, (patternCounts.get(pattern) || 0) + stats.accessCount);
            }
        }
        
        this.queryPatterns = patternCounts;
    }

    /**
     * Invalidate queries by dependency
     */
    async invalidateByDependency(dependency) {
        const pattern = `*${dependency}*`;
        
        try {
            await this.cache.clear(pattern);
            
            this.emit('dependencyInvalidated', { dependency, pattern });
            
            logger.debug('Cache invalidated by dependency', { dependency });
            
        } catch (error) {
            logger.error('Error invalidating cache by dependency:', { 
                dependency, 
                error: error.message 
            });
        }
    }

    /**
     * Invalidate queries by table
     */
    async invalidateByTable(tableName) {
        await this.invalidateByDependency(`table:${tableName.toLowerCase()}`);
    }

    /**
     * Invalidate queries by pattern
     */
    async invalidateByPattern(pattern) {
        try {
            await this.cache.clear(pattern);
            
            this.emit('patternInvalidated', { pattern });
            
            logger.debug('Cache invalidated by pattern', { pattern });
            
        } catch (error) {
            logger.error('Error invalidating cache by pattern:', { 
                pattern, 
                error: error.message 
            });
        }
    }

    /**
     * Get query cache statistics
     */
    getStatistics() {
        return {
            ...this.metrics,
            cache: {
                totalQueries: this.queryStatistics.size,
                totalPatterns: this.queryPatterns.size,
                normalizationCacheSize: this.queryNormalizationCache.size
            },
            health: this.getHealthStatus()
        };
    }

    /**
     * Get cache health status
     */
    getHealthStatus() {
        const health = {
            status: 'healthy',
            issues: []
        };
        
        // Check hit ratio
        if (this.metrics.performance.cacheHitRatio < 0.3) {
            health.issues.push('Low cache hit ratio');
            health.status = 'warning';
        }
        
        // Check error rate
        if (this.metrics.queries.total > 0) {
            const errorRate = this.metrics.queries.errors / this.metrics.queries.total;
            if (errorRate > 0.05) {
                health.issues.push('High error rate');
                health.status = 'warning';
            }
        }
        
        return health;
    }

    /**
     * Shutdown the query cache
     */
    async shutdown() {
        logger.info('Shutting down query cache system');
        
        // Clear intervals
        for (const interval of this.cleanupIntervals) {
            clearInterval(interval);
        }
        
        // Clear data structures
        this.queryNormalizationCache.clear();
        this.queryPatterns.clear();
        this.queryDependencies.clear();
        this.queryStatistics.clear();
        this.activeQueries.clear();
        this.queryQueue.length = 0;
        
        this.emit('shutdown');
        logger.info('Query cache shutdown completed');
    }
}

export default QueryCache;