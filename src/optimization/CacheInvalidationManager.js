/**
 * CONTEXT: Intelligent cache invalidation with dependency tracking and strategies
 * REASON: Ensure cache consistency while maximizing cache efficiency
 * CHANGE: Advanced invalidation strategies with graph-based dependency tracking
 * PREVENTION: Stale cache data, inconsistent state, performance degradation
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';

export class CacheInvalidationManager extends EventEmitter {
    constructor(cache, config = {}) {
        super();
        
        this.cache = cache;
        this.config = {
            // Invalidation strategies
            strategies: {
                timeBasedInvalidation: config.strategies?.timeBasedInvalidation !== false,
                dependencyBasedInvalidation: config.strategies?.dependencyBasedInvalidation !== false,
                versionBasedInvalidation: config.strategies?.versionBasedInvalidation !== false,
                eventBasedInvalidation: config.strategies?.eventBasedInvalidation !== false,
                patternBasedInvalidation: config.strategies?.patternBasedInvalidation !== false
            },
            
            // Dependency tracking
            dependencyTracking: {
                enabled: config.dependencyTracking?.enabled !== false,
                maxDepth: config.dependencyTracking?.maxDepth || 5,
                trackReverse: config.dependencyTracking?.trackReverse !== false,
                autoDetectDependencies: config.dependencyTracking?.autoDetectDependencies || false
            },
            
            // Invalidation policies
            policies: {
                cascadeInvalidation: config.policies?.cascadeInvalidation !== false,
                batchInvalidation: config.policies?.batchInvalidation !== false,
                delayedInvalidation: config.policies?.delayedInvalidation || false,
                smartInvalidation: config.policies?.smartInvalidation !== false
            },
            
            // Performance settings
            performance: {
                batchSize: config.performance?.batchSize || 100,
                invalidationDelay: config.performance?.invalidationDelay || 0,
                maxConcurrentInvalidations: config.performance?.maxConcurrentInvalidations || 10,
                enableMetrics: config.performance?.enableMetrics !== false
            }
        };
        
        // Dependency graph
        this.dependencyGraph = new DependencyGraph();
        
        // Version tracking
        this.versions = new Map();
        
        // Invalidation queue
        this.invalidationQueue = [];
        this.isProcessingQueue = false;
        
        // Event subscriptions
        this.eventSubscriptions = new Map();
        
        // Pattern matchers
        this.patternMatchers = new Map();
        
        // Metrics
        this.metrics = {
            invalidations: {
                total: 0,
                byStrategy: {
                    time: 0,
                    dependency: 0,
                    version: 0,
                    event: 0,
                    pattern: 0,
                    manual: 0
                },
                byType: {
                    single: 0,
                    cascade: 0,
                    batch: 0,
                    pattern: 0
                }
            },
            dependencies: {
                totalTracked: 0,
                averageDepth: 0,
                maxDepth: 0
            },
            performance: {
                averageInvalidationTime: 0,
                totalInvalidationTime: 0,
                queueLength: 0,
                maxQueueLength: 0
            }
        };
        
        // Cleanup intervals
        this.cleanupIntervals = [];
        
        this.initialize();
    }

    /**
     * Initialize the invalidation manager
     */
    initialize() {
        // Start background tasks
        this.startBackgroundTasks();
        
        // Setup cache event listeners
        this.setupCacheEventListeners();
        
        logger.info('Cache invalidation manager initialized', {
            strategies: Object.keys(this.config.strategies).filter(k => this.config.strategies[k]),
            dependencyTracking: this.config.dependencyTracking.enabled
        });
    }

    /**
     * Register a dependency between cache keys
     */
    registerDependency(dependentKey, dependsOnKey, metadata = {}) {
        try {
            this.dependencyGraph.addDependency(dependentKey, dependsOnKey, metadata);
            this.metrics.dependencies.totalTracked++;
            
            // Update metrics
            const depth = this.dependencyGraph.getDependencyDepth(dependentKey);
            this.metrics.dependencies.averageDepth = 
                (this.metrics.dependencies.averageDepth + depth) / 2;
            this.metrics.dependencies.maxDepth = Math.max(this.metrics.dependencies.maxDepth, depth);
            
            this.emit('dependencyRegistered', { dependentKey, dependsOnKey, metadata });
            
            logger.debug('Dependency registered', { dependentKey, dependsOnKey, metadata });
            
        } catch (error) {
            logger.error('Failed to register dependency:', { 
                dependentKey, 
                dependsOnKey, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Remove a dependency
     */
    removeDependency(dependentKey, dependsOnKey) {
        try {
            this.dependencyGraph.removeDependency(dependentKey, dependsOnKey);
            this.metrics.dependencies.totalTracked--;
            
            this.emit('dependencyRemoved', { dependentKey, dependsOnKey });
            
            logger.debug('Dependency removed', { dependentKey, dependsOnKey });
            
        } catch (error) {
            logger.error('Failed to remove dependency:', { 
                dependentKey, 
                dependsOnKey, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Register a pattern-based invalidation rule
     */
    registerPatternRule(name, pattern, targetPattern, options = {}) {
        const rule = {
            pattern: new RegExp(pattern),
            targetPattern: new RegExp(targetPattern),
            options: {
                cascadeDepth: options.cascadeDepth || 1,
                excludePattern: options.excludePattern ? new RegExp(options.excludePattern) : null,
                delayMs: options.delayMs || 0,
                onlyIfExists: options.onlyIfExists || false
            }
        };
        
        this.patternMatchers.set(name, rule);
        
        logger.debug('Pattern rule registered', { name, pattern, targetPattern, options });
    }

    /**
     * Remove a pattern rule
     */
    removePatternRule(name) {
        this.patternMatchers.delete(name);
        logger.debug('Pattern rule removed', { name });
    }

    /**
     * Subscribe to cache events for invalidation
     */
    subscribeToEvent(eventName, invalidationCallback) {
        if (!this.eventSubscriptions.has(eventName)) {
            this.eventSubscriptions.set(eventName, new Set());
        }
        
        this.eventSubscriptions.get(eventName).add(invalidationCallback);
        
        logger.debug('Event subscription added', { eventName });
    }

    /**
     * Unsubscribe from cache events
     */
    unsubscribeFromEvent(eventName, invalidationCallback) {
        const subscribers = this.eventSubscriptions.get(eventName);
        if (subscribers) {
            subscribers.delete(invalidationCallback);
            if (subscribers.size === 0) {
                this.eventSubscriptions.delete(eventName);
            }
        }
        
        logger.debug('Event subscription removed', { eventName });
    }

    /**
     * Set version for a cache key
     */
    setVersion(key, version) {
        this.versions.set(key, version);
        logger.debug('Version set', { key, version });
    }

    /**
     * Get version for a cache key
     */
    getVersion(key) {
        return this.versions.get(key);
    }

    /**
     * Invalidate cache key(s) using various strategies
     */
    async invalidate(keys, strategy = 'manual', options = {}) {
        const startTime = Date.now();
        
        try {
            // Normalize keys to array
            const keyArray = Array.isArray(keys) ? keys : [keys];
            
            logger.debug('Starting cache invalidation', { 
                keys: keyArray, 
                strategy, 
                options 
            });
            
            // Validate keys
            for (const key of keyArray) {
                this.validateKey(key);
            }
            
            // Determine invalidation type
            const invalidationType = this.determineInvalidationType(keyArray, options);
            
            // Execute invalidation based on strategy
            let invalidatedKeys = [];
            
            switch (strategy) {
                case 'dependency':
                    invalidatedKeys = await this.invalidateByDependency(keyArray, options);
                    break;
                    
                case 'pattern':
                    invalidatedKeys = await this.invalidateByPattern(keyArray, options);
                    break;
                    
                case 'version':
                    invalidatedKeys = await this.invalidateByVersion(keyArray, options);
                    break;
                    
                case 'time':
                    invalidatedKeys = await this.invalidateByTime(keyArray, options);
                    break;
                    
                case 'event':
                    invalidatedKeys = await this.invalidateByEvent(keyArray, options);
                    break;
                    
                default: // manual
                    invalidatedKeys = await this.invalidateManual(keyArray, options);
                    break;
            }
            
            // Update metrics
            const invalidationTime = Date.now() - startTime;
            this.updateMetrics(strategy, invalidationType, invalidatedKeys.length, invalidationTime);
            
            this.emit('invalidationCompleted', { 
                keys: keyArray, 
                invalidatedKeys, 
                strategy, 
                invalidationType,
                time: invalidationTime 
            });
            
            logger.info('Cache invalidation completed', {
                requestedKeys: keyArray.length,
                invalidatedKeys: invalidatedKeys.length,
                strategy,
                time: `${invalidationTime}ms`
            });
            
            return invalidatedKeys;
            
        } catch (error) {
            logger.error('Cache invalidation failed:', { 
                keys, 
                strategy, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Invalidate by dependency relationships
     */
    async invalidateByDependency(keys, options = {}) {
        const invalidatedKeys = new Set();
        const processed = new Set();
        
        for (const key of keys) {
            if (processed.has(key)) continue;
            
            // Get all dependent keys
            const dependentKeys = this.dependencyGraph.getDependents(key, {
                maxDepth: options.maxDepth || this.config.dependencyTracking.maxDepth,
                includeTransitive: options.includeTransitive !== false
            });
            
            // Invalidate cascade
            if (this.config.policies.cascadeInvalidation) {
                for (const dependentKey of dependentKeys) {
                    if (!processed.has(dependentKey)) {
                        await this.invalidateSingle(dependentKey);
                        invalidatedKeys.add(dependentKey);
                        processed.add(dependentKey);
                    }
                }
            }
            
            // Invalidate original key
            await this.invalidateSingle(key);
            invalidatedKeys.add(key);
            processed.add(key);
        }
        
        this.metrics.invalidations.byStrategy.dependency++;
        return Array.from(invalidatedKeys);
    }

    /**
     * Invalidate by pattern matching
     */
    async invalidateByPattern(keys, options = {}) {
        const invalidatedKeys = new Set();
        
        for (const key of keys) {
            // Apply pattern rules
            for (const [ruleName, rule] of this.patternMatchers) {
                if (rule.pattern.test(key)) {
                    // Find matching keys in cache
                    const allKeys = await this.getAllCacheKeys();
                    const matchingKeys = allKeys.filter(cacheKey => 
                        rule.targetPattern.test(cacheKey) &&
                        (!rule.options.excludePattern || !rule.options.excludePattern.test(cacheKey))
                    );
                    
                    // Apply delay if specified
                    if (rule.options.delayMs > 0) {
                        setTimeout(async () => {
                            for (const matchingKey of matchingKeys) {
                                await this.invalidateSingle(matchingKey);
                                invalidatedKeys.add(matchingKey);
                            }
                        }, rule.options.delayMs);
                    } else {
                        for (const matchingKey of matchingKeys) {
                            await this.invalidateSingle(matchingKey);
                            invalidatedKeys.add(matchingKey);
                        }
                    }
                    
                    logger.debug('Pattern rule applied', { 
                        ruleName, 
                        triggerKey: key, 
                        matchingKeys: matchingKeys.length 
                    });
                }
            }
            
            // Invalidate original key
            await this.invalidateSingle(key);
            invalidatedKeys.add(key);
        }
        
        this.metrics.invalidations.byStrategy.pattern++;
        return Array.from(invalidatedKeys);
    }

    /**
     * Invalidate by version comparison
     */
    async invalidateByVersion(keys, options = {}) {
        const invalidatedKeys = [];
        
        for (const key of keys) {
            const currentVersion = this.versions.get(key);
            const requiredVersion = options.version || options.versions?.[key];
            
            if (requiredVersion && currentVersion !== requiredVersion) {
                await this.invalidateSingle(key);
                invalidatedKeys.push(key);
                
                // Update version
                if (options.updateVersion !== false) {
                    this.versions.set(key, requiredVersion);
                }
            }
        }
        
        this.metrics.invalidations.byStrategy.version++;
        return invalidatedKeys;
    }

    /**
     * Invalidate by time-based rules
     */
    async invalidateByTime(keys, options = {}) {
        const invalidatedKeys = [];
        const now = Date.now();
        
        for (const key of keys) {
            let shouldInvalidate = false;
            
            if (options.olderThan) {
                // Check if cache entry is older than specified time
                const cacheEntry = await this.getCacheEntryMetadata(key);
                if (cacheEntry && (now - cacheEntry.created) > options.olderThan) {
                    shouldInvalidate = true;
                }
            } else if (options.expiredOnly) {
                // Only invalidate if already expired
                const cacheEntry = await this.getCacheEntryMetadata(key);
                if (cacheEntry && cacheEntry.expires && now > cacheEntry.expires) {
                    shouldInvalidate = true;
                }
            } else {
                // Default: invalidate all
                shouldInvalidate = true;
            }
            
            if (shouldInvalidate) {
                await this.invalidateSingle(key);
                invalidatedKeys.push(key);
            }
        }
        
        this.metrics.invalidations.byStrategy.time++;
        return invalidatedKeys;
    }

    /**
     * Invalidate by event triggers
     */
    async invalidateByEvent(keys, options = {}) {
        const invalidatedKeys = [];
        const eventName = options.eventName;
        
        if (eventName) {
            const subscribers = this.eventSubscriptions.get(eventName);
            if (subscribers) {
                for (const callback of subscribers) {
                    try {
                        const result = await callback(keys, options);
                        if (result && Array.isArray(result)) {
                            invalidatedKeys.push(...result);
                        }
                    } catch (error) {
                        logger.error('Event invalidation callback error:', { 
                            eventName, 
                            error: error.message 
                        });
                    }
                }
            }
        }
        
        // Always invalidate the requested keys
        for (const key of keys) {
            await this.invalidateSingle(key);
            if (!invalidatedKeys.includes(key)) {
                invalidatedKeys.push(key);
            }
        }
        
        this.metrics.invalidations.byStrategy.event++;
        return invalidatedKeys;
    }

    /**
     * Manual invalidation (direct)
     */
    async invalidateManual(keys, options = {}) {
        const invalidatedKeys = [];
        
        if (this.config.policies.batchInvalidation && keys.length > 1) {
            // Batch invalidation for better performance
            await this.invalidateBatch(keys);
            invalidatedKeys.push(...keys);
        } else {
            // Individual invalidation
            for (const key of keys) {
                await this.invalidateSingle(key);
                invalidatedKeys.push(key);
            }
        }
        
        this.metrics.invalidations.byStrategy.manual++;
        return invalidatedKeys;
    }

    /**
     * Invalidate a single cache key
     */
    async invalidateSingle(key) {
        try {
            await this.cache.delete(key, { invalidateDependents: false });
            
            // Remove from dependency graph
            this.dependencyGraph.removeNode(key);
            
            // Remove version tracking
            this.versions.delete(key);
            
            this.emit('keyInvalidated', { key });
            
        } catch (error) {
            logger.error('Failed to invalidate single key:', { key, error: error.message });
            throw error;
        }
    }

    /**
     * Batch invalidate multiple keys
     */
    async invalidateBatch(keys) {
        const batchSize = this.config.performance.batchSize;
        const batches = [];
        
        // Split into batches
        for (let i = 0; i < keys.length; i += batchSize) {
            batches.push(keys.slice(i, i + batchSize));
        }
        
        // Process batches with concurrency limit
        const semaphore = new Semaphore(this.config.performance.maxConcurrentInvalidations);
        
        const promises = batches.map(batch => 
            semaphore.acquire().then(async (release) => {
                try {
                    await Promise.all(batch.map(key => this.invalidateSingle(key)));
                } finally {
                    release();
                }
            })
        );
        
        await Promise.all(promises);
    }

    /**
     * Queue invalidation for delayed processing
     */
    queueInvalidation(keys, strategy, options = {}) {
        const invalidationRequest = {
            keys: Array.isArray(keys) ? keys : [keys],
            strategy,
            options,
            timestamp: Date.now(),
            id: this.generateRequestId()
        };
        
        this.invalidationQueue.push(invalidationRequest);
        this.metrics.performance.queueLength = this.invalidationQueue.length;
        this.metrics.performance.maxQueueLength = Math.max(
            this.metrics.performance.maxQueueLength, 
            this.invalidationQueue.length
        );
        
        // Process queue if not already processing
        if (!this.isProcessingQueue) {
            this.processInvalidationQueue();
        }
        
        return invalidationRequest.id;
    }

    /**
     * Process the invalidation queue
     */
    async processInvalidationQueue() {
        if (this.isProcessingQueue) return;
        
        this.isProcessingQueue = true;
        
        try {
            while (this.invalidationQueue.length > 0) {
                const request = this.invalidationQueue.shift();
                this.metrics.performance.queueLength = this.invalidationQueue.length;
                
                try {
                    await this.invalidate(request.keys, request.strategy, request.options);
                } catch (error) {
                    logger.error('Queued invalidation failed:', { 
                        requestId: request.id, 
                        error: error.message 
                    });
                }
                
                // Add delay if configured
                if (this.config.performance.invalidationDelay > 0) {
                    await this.delay(this.config.performance.invalidationDelay);
                }
            }
        } finally {
            this.isProcessingQueue = false;
        }
    }

    /**
     * Setup cache event listeners
     */
    setupCacheEventListeners() {
        // Listen for cache set events to detect dependencies
        this.cache.on('set', ({ key }) => {
            if (this.config.dependencyTracking.autoDetectDependencies) {
                this.autoDetectDependencies(key);
            }
        });
        
        // Listen for cache operations for metrics
        this.cache.on('get', ({ key, hit }) => {
            if (hit && this.config.strategies.timeBasedInvalidation) {
                this.checkTimeBasedInvalidation(key);
            }
        });
    }

    /**
     * Auto-detect dependencies based on cache access patterns
     */
    autoDetectDependencies(key) {
        // Implement heuristic-based dependency detection
        // This could analyze key patterns, access sequences, etc.
        
        // Example: if key contains a file path, create dependency on directory
        if (key.includes('/')) {
            const parentPath = key.substring(0, key.lastIndexOf('/'));
            if (parentPath) {
                this.registerDependency(key, parentPath, { type: 'auto-detected', pattern: 'path-hierarchy' });
            }
        }
        
        // Example: version-based dependencies
        const versionMatch = key.match(/(.*):v(\d+)/);
        if (versionMatch) {
            const baseKey = versionMatch[1];
            this.registerDependency(key, baseKey, { type: 'auto-detected', pattern: 'version' });
        }
    }

    /**
     * Check time-based invalidation rules
     */
    async checkTimeBasedInvalidation(key) {
        // Implement time-based invalidation logic
        // This could check TTL, last access time, etc.
    }

    /**
     * Start background maintenance tasks
     */
    startBackgroundTasks() {
        // Periodic cleanup of expired dependencies
        const cleanupInterval = setInterval(() => {
            this.cleanupExpiredDependencies().catch(error => {
                logger.error('Dependency cleanup error:', error);
            });
        }, 5 * 60 * 1000); // Every 5 minutes
        
        this.cleanupIntervals.push(cleanupInterval);
        
        // Periodic metrics update
        const metricsInterval = setInterval(() => {
            this.updatePerformanceMetrics();
        }, 60 * 1000); // Every minute
        
        this.cleanupIntervals.push(metricsInterval);
        
        // Process invalidation queue periodically
        const queueInterval = setInterval(() => {
            if (!this.isProcessingQueue && this.invalidationQueue.length > 0) {
                this.processInvalidationQueue();
            }
        }, 10 * 1000); // Every 10 seconds
        
        this.cleanupIntervals.push(queueInterval);
    }

    /**
     * Cleanup expired dependencies
     */
    async cleanupExpiredDependencies() {
        const expiredDependencies = this.dependencyGraph.getExpiredDependencies();
        
        for (const { dependentKey, dependsOnKey } of expiredDependencies) {
            this.removeDependency(dependentKey, dependsOnKey);
        }
        
        if (expiredDependencies.length > 0) {
            logger.debug(`Cleaned up ${expiredDependencies.length} expired dependencies`);
        }
    }

    /**
     * Update performance metrics
     */
    updatePerformanceMetrics() {
        // Calculate averages and update metrics
        this.emit('metricsUpdated', this.metrics);
    }

    /**
     * Utility methods
     */
    determineInvalidationType(keys, options) {
        if (keys.length === 1) return 'single';
        if (this.config.policies.batchInvalidation) return 'batch';
        if (options.pattern) return 'pattern';
        if (this.config.policies.cascadeInvalidation) return 'cascade';
        return 'multiple';
    }

    async getAllCacheKeys() {
        // This would need to be implemented based on the cache implementation
        // For now, return an empty array
        return [];
    }

    async getCacheEntryMetadata(key) {
        // This would need to be implemented based on the cache implementation
        return null;
    }

    validateKey(key) {
        if (typeof key !== 'string' || key.length === 0) {
            throw new Error('Invalid cache key');
        }
    }

    generateRequestId() {
        return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    updateMetrics(strategy, type, count, time) {
        this.metrics.invalidations.total += count;
        this.metrics.invalidations.byStrategy[strategy] += count;
        this.metrics.invalidations.byType[type] += count;
        
        this.metrics.performance.totalInvalidationTime += time;
        this.metrics.performance.averageInvalidationTime = 
            this.metrics.performance.totalInvalidationTime / this.metrics.invalidations.total;
    }

    /**
     * Get invalidation statistics
     */
    getStatistics() {
        return {
            ...this.metrics,
            dependencyGraph: this.dependencyGraph.getStatistics(),
            queueStatus: {
                length: this.invalidationQueue.length,
                isProcessing: this.isProcessingQueue
            }
        };
    }

    /**
     * Shutdown the invalidation manager
     */
    async shutdown() {
        logger.info('Shutting down cache invalidation manager');
        
        // Process remaining queue
        if (this.invalidationQueue.length > 0) {
            logger.info(`Processing ${this.invalidationQueue.length} remaining invalidation requests`);
            await this.processInvalidationQueue();
        }
        
        // Clear intervals
        for (const interval of this.cleanupIntervals) {
            clearInterval(interval);
        }
        
        // Clear data structures
        this.dependencyGraph.clear();
        this.versions.clear();
        this.eventSubscriptions.clear();
        this.patternMatchers.clear();
        this.invalidationQueue.length = 0;
        
        this.emit('shutdown');
        logger.info('Cache invalidation manager shutdown completed');
    }
}

/**
 * Dependency graph for tracking cache key relationships
 */
class DependencyGraph {
    constructor() {
        this.dependencies = new Map(); // key -> Set of keys it depends on
        this.dependents = new Map();   // key -> Set of keys that depend on it
        this.metadata = new Map();     // edge metadata
    }

    addDependency(dependentKey, dependsOnKey, metadata = {}) {
        // Add to dependencies
        if (!this.dependencies.has(dependentKey)) {
            this.dependencies.set(dependentKey, new Set());
        }
        this.dependencies.get(dependentKey).add(dependsOnKey);
        
        // Add to dependents
        if (!this.dependents.has(dependsOnKey)) {
            this.dependents.set(dependsOnKey, new Set());
        }
        this.dependents.get(dependsOnKey).add(dependentKey);
        
        // Store metadata
        const edgeKey = `${dependentKey}->${dependsOnKey}`;
        this.metadata.set(edgeKey, {
            ...metadata,
            created: Date.now()
        });
    }

    removeDependency(dependentKey, dependsOnKey) {
        // Remove from dependencies
        const deps = this.dependencies.get(dependentKey);
        if (deps) {
            deps.delete(dependsOnKey);
            if (deps.size === 0) {
                this.dependencies.delete(dependentKey);
            }
        }
        
        // Remove from dependents
        const dependents = this.dependents.get(dependsOnKey);
        if (dependents) {
            dependents.delete(dependentKey);
            if (dependents.size === 0) {
                this.dependents.delete(dependsOnKey);
            }
        }
        
        // Remove metadata
        const edgeKey = `${dependentKey}->${dependsOnKey}`;
        this.metadata.delete(edgeKey);
    }

    removeNode(key) {
        // Remove all dependencies for this key
        const deps = this.dependencies.get(key);
        if (deps) {
            for (const dep of deps) {
                this.removeDependency(key, dep);
            }
        }
        
        // Remove all dependents of this key
        const dependents = this.dependents.get(key);
        if (dependents) {
            for (const dependent of dependents) {
                this.removeDependency(dependent, key);
            }
        }
    }

    getDependents(key, options = {}) {
        const visited = new Set();
        const result = new Set();
        const maxDepth = options.maxDepth || Infinity;
        
        const traverse = (currentKey, depth) => {
            if (depth >= maxDepth || visited.has(currentKey)) {
                return;
            }
            
            visited.add(currentKey);
            const dependents = this.dependents.get(currentKey);
            
            if (dependents) {
                for (const dependent of dependents) {
                    result.add(dependent);
                    if (options.includeTransitive !== false) {
                        traverse(dependent, depth + 1);
                    }
                }
            }
        };
        
        traverse(key, 0);
        return Array.from(result);
    }

    getDependencies(key, options = {}) {
        const visited = new Set();
        const result = new Set();
        const maxDepth = options.maxDepth || Infinity;
        
        const traverse = (currentKey, depth) => {
            if (depth >= maxDepth || visited.has(currentKey)) {
                return;
            }
            
            visited.add(currentKey);
            const deps = this.dependencies.get(currentKey);
            
            if (deps) {
                for (const dep of deps) {
                    result.add(dep);
                    if (options.includeTransitive !== false) {
                        traverse(dep, depth + 1);
                    }
                }
            }
        };
        
        traverse(key, 0);
        return Array.from(result);
    }

    getDependencyDepth(key) {
        const visited = new Set();
        let maxDepth = 0;
        
        const traverse = (currentKey, depth) => {
            if (visited.has(currentKey)) {
                return depth;
            }
            
            visited.add(currentKey);
            maxDepth = Math.max(maxDepth, depth);
            
            const deps = this.dependencies.get(currentKey);
            if (deps) {
                for (const dep of deps) {
                    traverse(dep, depth + 1);
                }
            }
            
            return depth;
        };
        
        traverse(key, 0);
        return maxDepth;
    }

    getExpiredDependencies() {
        const expired = [];
        const now = Date.now();
        
        for (const [edgeKey, metadata] of this.metadata.entries()) {
            if (metadata.expires && now > metadata.expires) {
                const [dependentKey, dependsOnKey] = edgeKey.split('->');
                expired.push({ dependentKey, dependsOnKey, metadata });
            }
        }
        
        return expired;
    }

    getStatistics() {
        return {
            totalDependencies: this.dependencies.size,
            totalDependents: this.dependents.size,
            totalEdges: this.metadata.size,
            averageDependencies: this.dependencies.size > 0 ? 
                Array.from(this.dependencies.values()).reduce((sum, deps) => sum + deps.size, 0) / this.dependencies.size : 0,
            averageDependents: this.dependents.size > 0 ? 
                Array.from(this.dependents.values()).reduce((sum, deps) => sum + deps.size, 0) / this.dependents.size : 0
        };
    }

    clear() {
        this.dependencies.clear();
        this.dependents.clear();
        this.metadata.clear();
    }
}

/**
 * Simple semaphore for concurrency control
 */
class Semaphore {
    constructor(max) {
        this.max = max;
        this.current = 0;
        this.queue = [];
    }

    async acquire() {
        return new Promise((resolve) => {
            if (this.current < this.max) {
                this.current++;
                resolve(() => this.release());
            } else {
                this.queue.push(() => {
                    this.current++;
                    resolve(() => this.release());
                });
            }
        });
    }

    release() {
        this.current--;
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            next();
        }
    }
}

export default CacheInvalidationManager;