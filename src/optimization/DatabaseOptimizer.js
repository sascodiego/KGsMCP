/**
 * CONTEXT: Database connection pooling and query optimization system for MCP server
 * REASON: Optimize database performance, reduce connection overhead, and improve query execution
 * CHANGE: Advanced connection pooling, query caching, and database performance optimization
 * PREVENTION: Database bottlenecks, connection exhaustion, slow query performance, resource waste
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

export class DatabaseOptimizer extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // Connection pool settings
            pool: {
                min: config.pool?.min || 2,
                max: config.pool?.max || 10,
                acquireTimeoutMillis: config.pool?.acquireTimeoutMillis || 60000,
                createTimeoutMillis: config.pool?.createTimeoutMillis || 30000,
                destroyTimeoutMillis: config.pool?.destroyTimeoutMillis || 5000,
                idleTimeoutMillis: config.pool?.idleTimeoutMillis || 30000,
                reapIntervalMillis: config.pool?.reapIntervalMillis || 1000,
                createRetryIntervalMillis: config.pool?.createRetryIntervalMillis || 200,
                validateOnBorrow: config.pool?.validateOnBorrow !== false,
                ...config.pool
            },
            
            // Query optimization settings
            query: {
                cacheEnabled: config.query?.cacheEnabled !== false,
                cacheSize: config.query?.cacheSize || 1000,
                cacheTTL: config.query?.cacheTTL || 300000, // 5 minutes
                slowQueryThreshold: config.query?.slowQueryThreshold || 1000, // 1 second
                analyzeQueries: config.query?.analyzeQueries !== false,
                enablePreparedStatements: config.query?.enablePreparedStatements !== false,
                batchSize: config.query?.batchSize || 100,
                ...config.query
            },
            
            // Performance monitoring
            monitoring: {
                enabled: config.monitoring?.enabled !== false,
                metricsInterval: config.monitoring?.metricsInterval || 30000, // 30 seconds
                trackSlowQueries: config.monitoring?.trackSlowQueries !== false,
                trackConnectionEvents: config.monitoring?.trackConnectionEvents !== false,
                alertOnSlowQueries: config.monitoring?.alertOnSlowQueries !== false,
                ...config.monitoring
            },
            
            // Optimization strategies
            optimization: {
                autoOptimize: config.optimization?.autoOptimize !== false,
                optimizationInterval: config.optimization?.optimizationInterval || 300000, // 5 minutes
                connectionPoolOptimization: config.optimization?.connectionPoolOptimization !== false,
                queryOptimization: config.optimization?.queryOptimization !== false,
                indexOptimization: config.optimization?.indexOptimization !== false,
                ...config.optimization
            }
        };
        
        // Connection pool
        this.connectionPool = null;
        this.connectionFactory = null;
        
        // Query cache
        this.queryCache = new Map();
        this.cacheStats = {
            hits: 0,
            misses: 0,
            evictions: 0,
            size: 0
        };
        
        // Performance metrics
        this.metrics = {
            connections: {
                created: 0,
                destroyed: 0,
                acquired: 0,
                released: 0,
                active: 0,
                idle: 0,
                pending: 0,
                failed: 0,
                timeouts: 0
            },
            queries: {
                total: 0,
                successful: 0,
                failed: 0,
                slow: 0,
                cached: 0,
                averageTime: 0,
                totalTime: 0,
                byType: new Map()
            },
            cache: {
                hits: 0,
                misses: 0,
                hitRate: 0,
                size: 0,
                evictions: 0
            },
            performance: {
                avgConnectionTime: 0,
                avgQueryTime: 0,
                throughput: 0,
                errorRate: 0
            }
        };
        
        // Query analysis
        this.queryAnalyzer = new QueryAnalyzer(this);
        this.slowQueries = [];
        this.queryPatterns = new Map();
        
        // Optimization engine
        this.optimizationEngine = new DatabaseOptimizationEngine(this);
        
        // Monitoring intervals
        this.monitoringIntervals = [];
        
        // Prepared statements cache
        this.preparedStatements = new Map();
        
        this.initialized = false;
    }

    /**
     * Initialize database optimizer
     */
    async initialize(connectionFactory) {
        if (this.initialized) return;
        
        try {
            logger.info('Initializing database optimizer', {
                poolConfig: this.config.pool,
                queryConfig: this.config.query
            });
            
            this.connectionFactory = connectionFactory;
            
            // Initialize connection pool
            await this.initializeConnectionPool();
            
            // Initialize query analyzer
            await this.queryAnalyzer.initialize();
            
            // Initialize optimization engine
            await this.optimizationEngine.initialize();
            
            // Start monitoring
            if (this.config.monitoring.enabled) {
                this.startMonitoring();
            }
            
            this.initialized = true;
            this.emit('initialized');
            
            logger.info('Database optimizer initialized successfully');
            
        } catch (error) {
            logger.error('Failed to initialize database optimizer:', error);
            throw error;
        }
    }

    /**
     * Initialize connection pool
     */
    async initializeConnectionPool() {
        this.connectionPool = new ConnectionPool(this.config.pool, this.connectionFactory);
        
        // Setup connection pool events
        this.connectionPool.on('createRequest', () => {
            this.metrics.connections.created++;
        });
        
        this.connectionPool.on('createSuccess', (connection) => {
            this.emit('connectionCreated', connection);
        });
        
        this.connectionPool.on('createFail', (error) => {
            this.metrics.connections.failed++;
            this.emit('connectionCreateFailed', error);
        });
        
        this.connectionPool.on('acquireRequest', () => {
            this.metrics.connections.pending++;
        });
        
        this.connectionPool.on('acquireSuccess', (connection) => {
            this.metrics.connections.acquired++;
            this.metrics.connections.active++;
            this.metrics.connections.pending--;
        });
        
        this.connectionPool.on('acquireFail', (error) => {
            this.metrics.connections.timeouts++;
            this.metrics.connections.pending--;
            this.emit('connectionAcquireFailed', error);
        });
        
        this.connectionPool.on('release', (connection) => {
            this.metrics.connections.released++;
            this.metrics.connections.active--;
            this.metrics.connections.idle++;
        });
        
        this.connectionPool.on('destroy', (connection) => {
            this.metrics.connections.destroyed++;
            this.metrics.connections.idle--;
        });
        
        await this.connectionPool.initialize();
        
        logger.debug('Connection pool initialized', {
            min: this.config.pool.min,
            max: this.config.pool.max
        });
    }

    /**
     * Start performance monitoring
     */
    startMonitoring() {
        // Metrics collection
        const metricsInterval = setInterval(() => {
            this.collectMetrics();
        }, this.config.monitoring.metricsInterval);
        
        // Pool optimization
        const poolOptimizationInterval = setInterval(() => {
            if (this.config.optimization.autoOptimize) {
                this.optimizationEngine.optimizeConnectionPool().catch(error => {
                    logger.error('Connection pool optimization failed:', error);
                });
            }
        }, this.config.optimization.optimizationInterval);
        
        // Query cache cleanup
        const cacheCleanupInterval = setInterval(() => {
            this.cleanupQueryCache();
        }, 60000); // Every minute
        
        this.monitoringIntervals.push(
            metricsInterval,
            poolOptimizationInterval,
            cacheCleanupInterval
        );
        
        logger.debug('Database monitoring started');
    }

    /**
     * Execute query with optimization
     */
    async executeQuery(query, params = [], options = {}) {
        const startTime = Date.now();
        const queryId = this.generateQueryId(query, params);
        
        try {
            // Check query cache first
            if (this.config.query.cacheEnabled && options.cache !== false) {
                const cachedResult = this.getFromQueryCache(queryId);
                if (cachedResult) {
                    this.metrics.queries.cached++;
                    this.metrics.cache.hits++;
                    this.emit('queryCacheHit', { queryId, query });
                    return cachedResult;
                }
                this.metrics.cache.misses++;
            }
            
            // Acquire connection from pool
            const connection = await this.connectionPool.acquire();
            
            try {
                // Execute query
                let result;
                if (this.config.query.enablePreparedStatements && this.shouldUsePreparedStatement(query)) {
                    result = await this.executePreparedStatement(connection, query, params);
                } else {
                    result = await this.executeRawQuery(connection, query, params);
                }
                
                const duration = Date.now() - startTime;
                
                // Update metrics
                this.updateQueryMetrics(query, duration, true, options);
                
                // Cache result if enabled
                if (this.config.query.cacheEnabled && options.cache !== false && this.shouldCacheQuery(query)) {
                    this.setQueryCache(queryId, result);
                }
                
                // Analyze query performance
                if (this.config.query.analyzeQueries) {
                    await this.queryAnalyzer.analyzeQuery(query, params, duration, result);
                }
                
                // Check for slow query
                if (duration > this.config.query.slowQueryThreshold) {
                    this.handleSlowQuery(query, params, duration);
                }
                
                this.emit('queryExecuted', {
                    query: query,
                    params: params,
                    duration: duration,
                    success: true,
                    cached: false
                });
                
                return result;
                
            } finally {
                // Always release connection back to pool
                this.connectionPool.release(connection);
            }
            
        } catch (error) {
            const duration = Date.now() - startTime;
            
            // Update metrics
            this.updateQueryMetrics(query, duration, false, options);
            
            logger.error('Query execution failed:', {
                query: query,
                params: params,
                duration: duration,
                error: error.message
            });
            
            this.emit('queryFailed', {
                query: query,
                params: params,
                duration: duration,
                error: error
            });
            
            throw error;
        }
    }

    /**
     * Execute batch queries with optimization
     */
    async executeBatch(queries, options = {}) {
        const batchSize = options.batchSize || this.config.query.batchSize;
        const results = [];
        
        // Process queries in batches
        for (let i = 0; i < queries.length; i += batchSize) {
            const batch = queries.slice(i, i + batchSize);
            const batchPromises = batch.map(queryInfo => 
                this.executeQuery(queryInfo.query, queryInfo.params, queryInfo.options)
            );
            
            const batchResults = await Promise.all(batchPromises);
            results.push(...batchResults);
        }
        
        this.emit('batchExecuted', {
            totalQueries: queries.length,
            batchSize: batchSize,
            success: true
        });
        
        return results;
    }

    /**
     * Execute raw query
     */
    async executeRawQuery(connection, query, params) {
        if (connection.query) {
            return await connection.query(query, params);
        } else {
            // For Kuzu or other custom connections
            return await connection.execute ? 
                await connection.execute(query, params) :
                await connection.run(query, params);
        }
    }

    /**
     * Execute prepared statement
     */
    async executePreparedStatement(connection, query, params) {
        const statementKey = this.generateStatementKey(query);
        
        let statement = this.preparedStatements.get(statementKey);
        if (!statement) {
            statement = await connection.prepare(query);
            this.preparedStatements.set(statementKey, statement);
        }
        
        return await statement.execute(params);
    }

    /**
     * Generate query ID for caching
     */
    generateQueryId(query, params) {
        const normalizedQuery = query.replace(/\s+/g, ' ').trim().toLowerCase();
        const paramString = JSON.stringify(params);
        return `${normalizedQuery}:${paramString}`;
    }

    /**
     * Generate statement key for prepared statements
     */
    generateStatementKey(query) {
        return query.replace(/\s+/g, ' ').trim().toLowerCase();
    }

    /**
     * Check if query should use prepared statement
     */
    shouldUsePreparedStatement(query) {
        // Use prepared statements for parameterized queries
        return query.includes('$') || query.includes('?');
    }

    /**
     * Check if query result should be cached
     */
    shouldCacheQuery(query) {
        const lowerQuery = query.toLowerCase().trim();
        
        // Cache SELECT queries, avoid caching INSERT/UPDATE/DELETE
        return lowerQuery.startsWith('select') ||
               lowerQuery.startsWith('match') ||
               lowerQuery.startsWith('with');
    }

    /**
     * Get result from query cache
     */
    getFromQueryCache(queryId) {
        const cached = this.queryCache.get(queryId);
        if (!cached) return null;
        
        // Check if cache entry has expired
        if (Date.now() > cached.expires) {
            this.queryCache.delete(queryId);
            this.metrics.cache.evictions++;
            return null;
        }
        
        // Update access time for LRU
        cached.lastAccess = Date.now();
        
        return cached.result;
    }

    /**
     * Set result in query cache
     */
    setQueryCache(queryId, result) {
        // Check cache size limit
        if (this.queryCache.size >= this.config.query.cacheSize) {
            this.evictFromQueryCache();
        }
        
        const expires = Date.now() + this.config.query.cacheTTL;
        
        this.queryCache.set(queryId, {
            result: result,
            created: Date.now(),
            lastAccess: Date.now(),
            expires: expires
        });
        
        this.metrics.cache.size = this.queryCache.size;
    }

    /**
     * Evict entries from query cache (LRU)
     */
    evictFromQueryCache() {
        // Find least recently used entries
        const entries = Array.from(this.queryCache.entries());
        entries.sort((a, b) => a[1].lastAccess - b[1].lastAccess);
        
        // Remove oldest 10% of entries
        const evictCount = Math.ceil(entries.length * 0.1);
        for (let i = 0; i < evictCount; i++) {
            this.queryCache.delete(entries[i][0]);
            this.metrics.cache.evictions++;
        }
        
        this.metrics.cache.size = this.queryCache.size;
    }

    /**
     * Clean up expired cache entries
     */
    cleanupQueryCache() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [key, entry] of this.queryCache.entries()) {
            if (now > entry.expires) {
                expiredKeys.push(key);
            }
        }
        
        for (const key of expiredKeys) {
            this.queryCache.delete(key);
            this.metrics.cache.evictions++;
        }
        
        this.metrics.cache.size = this.queryCache.size;
        
        if (expiredKeys.length > 0) {
            logger.debug(`Cleaned up ${expiredKeys.length} expired cache entries`);
        }
    }

    /**
     * Update query metrics
     */
    updateQueryMetrics(query, duration, success, options) {
        this.metrics.queries.total++;
        this.metrics.queries.totalTime += duration;
        this.metrics.queries.averageTime = this.metrics.queries.totalTime / this.metrics.queries.total;
        
        if (success) {
            this.metrics.queries.successful++;
        } else {
            this.metrics.queries.failed++;
        }
        
        if (duration > this.config.query.slowQueryThreshold) {
            this.metrics.queries.slow++;
        }
        
        // Update query type statistics
        const queryType = this.getQueryType(query);
        if (!this.metrics.queries.byType.has(queryType)) {
            this.metrics.queries.byType.set(queryType, {
                count: 0,
                totalTime: 0,
                averageTime: 0,
                errors: 0
            });
        }
        
        const typeStats = this.metrics.queries.byType.get(queryType);
        typeStats.count++;
        typeStats.totalTime += duration;
        typeStats.averageTime = typeStats.totalTime / typeStats.count;
        
        if (!success) {
            typeStats.errors++;
        }
        
        // Update performance metrics
        this.updatePerformanceMetrics();
    }

    /**
     * Get query type from SQL
     */
    getQueryType(query) {
        const normalized = query.trim().toLowerCase();
        
        if (normalized.startsWith('select') || normalized.startsWith('match')) return 'SELECT';
        if (normalized.startsWith('insert') || normalized.startsWith('create (')) return 'INSERT';
        if (normalized.startsWith('update') || normalized.startsWith('set')) return 'UPDATE';
        if (normalized.startsWith('delete') || normalized.startsWith('detach')) return 'DELETE';
        if (normalized.startsWith('create table') || normalized.startsWith('create node')) return 'CREATE';
        if (normalized.startsWith('drop')) return 'DROP';
        if (normalized.startsWith('alter')) return 'ALTER';
        
        return 'OTHER';
    }

    /**
     * Handle slow query detection
     */
    handleSlowQuery(query, params, duration) {
        const slowQuery = {
            query: query,
            params: params,
            duration: duration,
            timestamp: Date.now()
        };
        
        this.slowQueries.push(slowQuery);
        
        // Keep only recent slow queries
        if (this.slowQueries.length > 100) {
            this.slowQueries.shift();
        }
        
        logger.warn('Slow query detected', {
            query: query.substring(0, 200),
            duration: duration,
            threshold: this.config.query.slowQueryThreshold
        });
        
        this.emit('slowQuery', slowQuery);
        
        // Alert if configured
        if (this.config.monitoring.alertOnSlowQueries) {
            this.emit('alert', {
                type: 'slow_query',
                severity: duration > this.config.query.slowQueryThreshold * 2 ? 'critical' : 'warning',
                query: query.substring(0, 200),
                duration: duration,
                threshold: this.config.query.slowQueryThreshold
            });
        }
    }

    /**
     * Update performance metrics
     */
    updatePerformanceMetrics() {
        // Calculate error rate
        this.metrics.performance.errorRate = this.metrics.queries.total > 0 ?
            this.metrics.queries.failed / this.metrics.queries.total : 0;
        
        // Calculate throughput (queries per second)
        const uptime = Date.now() - (this.startTime || Date.now());
        this.metrics.performance.throughput = uptime > 0 ?
            (this.metrics.queries.total / uptime) * 1000 : 0;
        
        // Update cache hit rate
        const totalCacheRequests = this.metrics.cache.hits + this.metrics.cache.misses;
        this.metrics.cache.hitRate = totalCacheRequests > 0 ?
            this.metrics.cache.hits / totalCacheRequests : 0;
    }

    /**
     * Collect comprehensive metrics
     */
    collectMetrics() {
        // Update connection pool metrics
        if (this.connectionPool) {
            const poolStats = this.connectionPool.getStats();
            this.metrics.connections.active = poolStats.active;
            this.metrics.connections.idle = poolStats.idle;
            this.metrics.connections.pending = poolStats.pending;
        }
        
        // Update performance metrics
        this.updatePerformanceMetrics();
        
        // Emit metrics event
        this.emit('metricsCollected', this.metrics);
    }

    /**
     * Get comprehensive database performance report
     */
    getPerformanceReport() {
        return {
            timestamp: Date.now(),
            
            // Connection pool statistics
            connections: {
                ...this.metrics.connections,
                poolStats: this.connectionPool ? this.connectionPool.getStats() : {}
            },
            
            // Query performance
            queries: {
                total: this.metrics.queries.total,
                successful: this.metrics.queries.successful,
                failed: this.metrics.queries.failed,
                slow: this.metrics.queries.slow,
                cached: this.metrics.queries.cached,
                averageTime: this.metrics.queries.averageTime,
                byType: Object.fromEntries(this.metrics.queries.byType),
                slowQueries: this.slowQueries.slice(-10) // Recent slow queries
            },
            
            // Cache performance
            cache: {
                ...this.metrics.cache,
                hitRate: this.metrics.cache.hitRate,
                efficiency: this.calculateCacheEfficiency()
            },
            
            // Overall performance
            performance: {
                ...this.metrics.performance,
                healthScore: this.calculateHealthScore()
            },
            
            // Optimization recommendations
            recommendations: this.generateRecommendations()
        };
    }

    /**
     * Calculate cache efficiency
     */
    calculateCacheEfficiency() {
        const totalRequests = this.metrics.cache.hits + this.metrics.cache.misses;
        if (totalRequests === 0) return 0;
        
        const hitRate = this.metrics.cache.hits / totalRequests;
        const sizeUtilization = this.queryCache.size / this.config.query.cacheSize;
        
        return (hitRate * 0.7) + (sizeUtilization * 0.3);
    }

    /**
     * Calculate overall database health score
     */
    calculateHealthScore() {
        let score = 1.0;
        
        // Error rate impact (40% weight)
        const errorRate = this.metrics.performance.errorRate;
        score -= (errorRate * 0.4);
        
        // Query performance impact (30% weight)
        const avgTime = this.metrics.queries.averageTime;
        const slowRatio = avgTime > this.config.query.slowQueryThreshold ? 
            Math.min(1, avgTime / (this.config.query.slowQueryThreshold * 2)) : 0;
        score -= (slowRatio * 0.3);
        
        // Connection pool health (20% weight)
        const poolStats = this.connectionPool ? this.connectionPool.getStats() : {};
        const poolUtilization = poolStats.active / (poolStats.active + poolStats.idle || 1);
        if (poolUtilization > 0.9) score -= 0.2;
        else if (poolUtilization > 0.8) score -= 0.1;
        
        // Cache efficiency (10% weight)
        const cacheEfficiency = this.calculateCacheEfficiency();
        score -= ((1 - cacheEfficiency) * 0.1);
        
        return Math.max(0, Math.min(1, score));
    }

    /**
     * Generate optimization recommendations
     */
    generateRecommendations() {
        const recommendations = [];
        
        // Query performance recommendations
        if (this.metrics.queries.averageTime > this.config.query.slowQueryThreshold * 0.8) {
            recommendations.push({
                type: 'query_performance',
                priority: 'high',
                description: 'Query performance is degrading',
                suggestions: [
                    'Analyze slow queries for optimization opportunities',
                    'Consider adding database indexes',
                    'Review query patterns and complexity',
                    'Enable query result caching'
                ]
            });
        }
        
        // Cache recommendations
        if (this.metrics.cache.hitRate < 0.6) {
            recommendations.push({
                type: 'cache_optimization',
                priority: 'medium',
                description: 'Cache hit rate is below optimal',
                suggestions: [
                    'Increase cache size',
                    'Review cache TTL settings',
                    'Implement cache warming strategies',
                    'Optimize query patterns for better caching'
                ]
            });
        }
        
        // Connection pool recommendations
        const poolStats = this.connectionPool ? this.connectionPool.getStats() : {};
        const poolUtilization = poolStats.active / (poolStats.active + poolStats.idle || 1);
        
        if (poolUtilization > 0.9) {
            recommendations.push({
                type: 'connection_pool',
                priority: 'high',
                description: 'Connection pool utilization is very high',
                suggestions: [
                    'Increase maximum pool size',
                    'Optimize query execution time',
                    'Review connection timeout settings',
                    'Consider connection pooling optimization'
                ]
            });
        }
        
        // Error rate recommendations
        if (this.metrics.performance.errorRate > 0.05) {
            recommendations.push({
                type: 'error_rate',
                priority: 'critical',
                description: 'Database error rate is too high',
                suggestions: [
                    'Investigate root cause of database errors',
                    'Review connection stability',
                    'Check database health and resources',
                    'Implement better error handling and retry logic'
                ]
            });
        }
        
        return recommendations;
    }

    /**
     * Clear query cache
     */
    clearQueryCache() {
        this.queryCache.clear();
        this.metrics.cache.size = 0;
        this.emit('queryCacheCleared');
        logger.info('Query cache cleared');
    }

    /**
     * Get connection pool statistics
     */
    getConnectionPoolStats() {
        return this.connectionPool ? this.connectionPool.getStats() : {};
    }

    /**
     * Shutdown database optimizer
     */
    async shutdown() {
        try {
            logger.info('Shutting down database optimizer');
            
            // Clear monitoring intervals
            for (const interval of this.monitoringIntervals) {
                clearInterval(interval);
            }
            
            // Shutdown optimization engine
            await this.optimizationEngine.shutdown();
            
            // Shutdown query analyzer
            await this.queryAnalyzer.shutdown();
            
            // Close connection pool
            if (this.connectionPool) {
                await this.connectionPool.shutdown();
            }
            
            // Clear caches
            this.queryCache.clear();
            this.preparedStatements.clear();
            
            this.initialized = false;
            this.emit('shutdown');
            
            logger.info('Database optimizer shutdown completed');
            
        } catch (error) {
            logger.error('Error during database optimizer shutdown:', error);
            throw error;
        }
    }
}

/**
 * Connection Pool Implementation
 */
class ConnectionPool extends EventEmitter {
    constructor(config, connectionFactory) {
        super();
        this.config = config;
        this.connectionFactory = connectionFactory;
        
        this.connections = {
            idle: [],
            active: new Set(),
            pending: []
        };
        
        this.stats = {
            created: 0,
            destroyed: 0,
            acquired: 0,
            released: 0,
            active: 0,
            idle: 0,
            pending: 0,
            errors: 0
        };
        
        this.initialized = false;
    }

    async initialize() {
        // Create minimum connections
        for (let i = 0; i < this.config.min; i++) {
            try {
                const connection = await this.createConnection();
                this.connections.idle.push(connection);
                this.stats.idle++;
            } catch (error) {
                logger.error('Failed to create initial connection:', error);
            }
        }
        
        this.initialized = true;
        logger.debug(`Connection pool initialized with ${this.connections.idle.length} connections`);
    }

    async createConnection() {
        this.emit('createRequest');
        
        try {
            const connection = await this.connectionFactory();
            this.stats.created++;
            
            // Add connection metadata
            connection._poolMetadata = {
                id: `conn_${this.stats.created}`,
                created: Date.now(),
                lastUsed: Date.now(),
                useCount: 0
            };
            
            this.emit('createSuccess', connection);
            return connection;
            
        } catch (error) {
            this.stats.errors++;
            this.emit('createFail', error);
            throw error;
        }
    }

    async acquire() {
        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.emit('acquireFail', new Error('Connection acquire timeout'));
                reject(new Error('Connection acquire timeout'));
            }, this.config.acquireTimeoutMillis);
            
            this.emit('acquireRequest');
            
            // Try to get idle connection
            if (this.connections.idle.length > 0) {
                const connection = this.connections.idle.pop();
                this.connections.active.add(connection);
                
                // Update metadata
                connection._poolMetadata.lastUsed = Date.now();
                connection._poolMetadata.useCount++;
                
                this.stats.idle--;
                this.stats.active++;
                this.stats.acquired++;
                
                clearTimeout(timeoutId);
                this.emit('acquireSuccess', connection);
                resolve(connection);
                return;
            }
            
            // Create new connection if under max limit
            if (this.connections.active.size < this.config.max) {
                this.createConnection()
                    .then(connection => {
                        this.connections.active.add(connection);
                        
                        connection._poolMetadata.lastUsed = Date.now();
                        connection._poolMetadata.useCount++;
                        
                        this.stats.active++;
                        this.stats.acquired++;
                        
                        clearTimeout(timeoutId);
                        this.emit('acquireSuccess', connection);
                        resolve(connection);
                    })
                    .catch(error => {
                        clearTimeout(timeoutId);
                        this.emit('acquireFail', error);
                        reject(error);
                    });
                return;
            }
            
            // Add to pending queue
            this.connections.pending.push({ resolve, reject, timeoutId });
            this.stats.pending++;
        });
    }

    release(connection) {
        if (!this.connections.active.has(connection)) {
            logger.warn('Attempted to release connection not in active set');
            return;
        }
        
        this.connections.active.delete(connection);
        this.stats.active--;
        this.stats.released++;
        
        // Check if there are pending requests
        if (this.connections.pending.length > 0) {
            const pending = this.connections.pending.shift();
            this.connections.active.add(connection);
            
            clearTimeout(pending.timeoutId);
            this.stats.pending--;
            this.stats.active++;
            this.stats.acquired++;
            
            connection._poolMetadata.lastUsed = Date.now();
            connection._poolMetadata.useCount++;
            
            this.emit('acquireSuccess', connection);
            pending.resolve(connection);
            return;
        }
        
        // Return to idle pool
        this.connections.idle.push(connection);
        this.stats.idle++;
        
        this.emit('release', connection);
    }

    async destroy(connection) {
        // Remove from all sets
        this.connections.active.delete(connection);
        const idleIndex = this.connections.idle.indexOf(connection);
        if (idleIndex >= 0) {
            this.connections.idle.splice(idleIndex, 1);
            this.stats.idle--;
        }
        
        try {
            if (connection.close) {
                await connection.close();
            } else if (connection.destroy) {
                await connection.destroy();
            }
        } catch (error) {
            logger.error('Error destroying connection:', error);
        }
        
        this.stats.destroyed++;
        this.emit('destroy', connection);
    }

    getStats() {
        return {
            ...this.stats,
            total: this.connections.active.size + this.connections.idle.length,
            utilization: this.stats.active / this.config.max
        };
    }

    async shutdown() {
        // Destroy all connections
        const allConnections = [
            ...this.connections.active,
            ...this.connections.idle
        ];
        
        for (const connection of allConnections) {
            await this.destroy(connection);
        }
        
        // Reject pending requests
        for (const pending of this.connections.pending) {
            clearTimeout(pending.timeoutId);
            pending.reject(new Error('Connection pool is shutting down'));
        }
        
        this.connections.pending = [];
        this.stats.pending = 0;
        
        logger.debug('Connection pool shutdown completed');
    }
}

/**
 * Query Analyzer
 */
class QueryAnalyzer {
    constructor(optimizer) {
        this.optimizer = optimizer;
        this.queryPatterns = new Map();
        this.performanceHistory = [];
    }

    async initialize() {
        logger.debug('Query analyzer initialized');
    }

    async analyzeQuery(query, params, duration, result) {
        const pattern = this.extractQueryPattern(query);
        
        if (!this.queryPatterns.has(pattern)) {
            this.queryPatterns.set(pattern, {
                count: 0,
                totalTime: 0,
                averageTime: 0,
                minTime: Infinity,
                maxTime: 0,
                examples: []
            });
        }
        
        const patternStats = this.queryPatterns.get(pattern);
        patternStats.count++;
        patternStats.totalTime += duration;
        patternStats.averageTime = patternStats.totalTime / patternStats.count;
        patternStats.minTime = Math.min(patternStats.minTime, duration);
        patternStats.maxTime = Math.max(patternStats.maxTime, duration);
        
        // Store example if it's particularly slow
        if (duration > this.optimizer.config.query.slowQueryThreshold && 
            patternStats.examples.length < 5) {
            patternStats.examples.push({
                query: query,
                params: params,
                duration: duration,
                timestamp: Date.now()
            });
        }
        
        // Add to performance history
        this.performanceHistory.push({
            pattern: pattern,
            duration: duration,
            timestamp: Date.now()
        });
        
        // Keep only recent history
        if (this.performanceHistory.length > 1000) {
            this.performanceHistory.shift();
        }
    }

    extractQueryPattern(query) {
        // Normalize query to extract pattern
        return query
            .replace(/\$\d+/g, '$?')           // Replace parameter placeholders
            .replace(/'\w+'|"\w+"/g, "'?'")    // Replace string literals
            .replace(/\d+/g, '?')              // Replace numbers
            .replace(/\s+/g, ' ')              // Normalize whitespace
            .trim()
            .toLowerCase();
    }

    getQueryPatterns() {
        return Object.fromEntries(this.queryPatterns);
    }

    async shutdown() {
        this.queryPatterns.clear();
        this.performanceHistory = [];
        logger.debug('Query analyzer shutdown');
    }
}

/**
 * Database Optimization Engine
 */
class DatabaseOptimizationEngine {
    constructor(optimizer) {
        this.optimizer = optimizer;
        this.optimizations = new Map();
    }

    async initialize() {
        // Setup optimization strategies
        this.optimizations.set('connection_pool', this.optimizeConnectionPool.bind(this));
        this.optimizations.set('query_cache', this.optimizeQueryCache.bind(this));
        this.optimizations.set('prepared_statements', this.optimizePreparedStatements.bind(this));
        
        logger.debug('Database optimization engine initialized');
    }

    async optimizeConnectionPool() {
        const stats = this.optimizer.getConnectionPoolStats();
        const utilization = stats.utilization || 0;
        
        // Adjust pool size based on utilization
        if (utilization > 0.9 && stats.total < this.optimizer.config.pool.max) {
            logger.info('High connection pool utilization, consider increasing pool size');
            this.optimizer.emit('optimization', {
                type: 'connection_pool',
                action: 'increase_size',
                current: stats.total,
                recommended: Math.min(stats.total + 2, this.optimizer.config.pool.max)
            });
        } else if (utilization < 0.3 && stats.total > this.optimizer.config.pool.min) {
            logger.info('Low connection pool utilization, consider decreasing pool size');
            this.optimizer.emit('optimization', {
                type: 'connection_pool',
                action: 'decrease_size',
                current: stats.total,
                recommended: Math.max(stats.total - 1, this.optimizer.config.pool.min)
            });
        }
    }

    async optimizeQueryCache() {
        const hitRate = this.optimizer.metrics.cache.hitRate;
        
        if (hitRate < 0.6) {
            this.optimizer.emit('optimization', {
                type: 'query_cache',
                action: 'increase_size',
                currentHitRate: hitRate,
                recommendation: 'Consider increasing cache size or TTL'
            });
        }
    }

    async optimizePreparedStatements() {
        // Clean up unused prepared statements
        const cutoffTime = Date.now() - (30 * 60 * 1000); // 30 minutes
        
        for (const [key, statement] of this.optimizer.preparedStatements) {
            if (statement.lastUsed && statement.lastUsed < cutoffTime) {
                try {
                    await statement.close();
                    this.optimizer.preparedStatements.delete(key);
                } catch (error) {
                    logger.error('Failed to close prepared statement:', error);
                }
            }
        }
    }

    async shutdown() {
        logger.debug('Database optimization engine shutdown');
    }
}

export default DatabaseOptimizer;