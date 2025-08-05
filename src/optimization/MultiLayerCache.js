/**
 * CONTEXT: Multi-layer caching system for MCP server performance optimization
 * REASON: Reduce redundant operations and improve response times across all MCP components
 * CHANGE: Comprehensive caching with memory, disk, and distributed layers
 * PREVENTION: Performance degradation, resource waste, redundant computations
 */

import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { logger } from '../utils/logger.js';

export class MultiLayerCache extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // Memory cache configuration
            memory: {
                enabled: true,
                maxSize: config.memory?.maxSize || 100 * 1024 * 1024, // 100MB
                maxItems: config.memory?.maxItems || 10000,
                ttl: config.memory?.ttl || 30 * 60 * 1000, // 30 minutes
                checkPeriod: config.memory?.checkPeriod || 5 * 60 * 1000, // 5 minutes
                ...config.memory
            },
            
            // Disk cache configuration
            disk: {
                enabled: config.disk?.enabled !== false,
                cacheDir: config.disk?.cacheDir || './.kg-context/cache',
                maxSize: config.disk?.maxSize || 1024 * 1024 * 1024, // 1GB
                maxFiles: config.disk?.maxFiles || 50000,
                ttl: config.disk?.ttl || 24 * 60 * 60 * 1000, // 24 hours
                compression: config.disk?.compression !== false,
                ...config.disk
            },
            
            // Distributed cache configuration (future extension)
            distributed: {
                enabled: config.distributed?.enabled || false,
                provider: config.distributed?.provider || 'redis',
                connectionString: config.distributed?.connectionString,
                keyPrefix: config.distributed?.keyPrefix || 'mcp:cache:',
                ttl: config.distributed?.ttl || 60 * 60 * 1000, // 1 hour
                ...config.distributed
            },
            
            // Cache strategies
            strategies: {
                defaultTtl: config.strategies?.defaultTtl || 30 * 60 * 1000,
                lruEviction: config.strategies?.lruEviction !== false,
                writeThrough: config.strategies?.writeThrough !== false,
                refreshAhead: config.strategies?.refreshAhead || false,
                ...config.strategies
            },
            
            // Performance settings
            performance: {
                compressionThreshold: config.performance?.compressionThreshold || 1024,
                asyncWrites: config.performance?.asyncWrites !== false,
                batchOperations: config.performance?.batchOperations !== false,
                prefetchEnabled: config.performance?.prefetchEnabled || false,
                ...config.performance
            }
        };
        
        // Cache layers
        this.memoryCache = new Map();
        this.memoryMeta = new Map(); // Metadata for memory cache entries
        this.diskCache = null;
        this.distributedCache = null;
        
        // Cache statistics
        this.stats = {
            hits: { memory: 0, disk: 0, distributed: 0 },
            misses: { memory: 0, disk: 0, distributed: 0 },
            sets: { memory: 0, disk: 0, distributed: 0 },
            deletes: { memory: 0, disk: 0, distributed: 0 },
            evictions: { memory: 0, disk: 0, distributed: 0 },
            errors: { memory: 0, disk: 0, distributed: 0 },
            totalSize: { memory: 0, disk: 0, distributed: 0 },
            totalItems: { memory: 0, disk: 0, distributed: 0 },
            avgAccessTime: { memory: 0, disk: 0, distributed: 0 },
            hitRatio: { memory: 0, disk: 0, distributed: 0, overall: 0 }
        };
        
        // Cache dependency tracking
        this.dependencies = new Map(); // key -> Set of dependent keys
        this.dependents = new Map();   // key -> Set of keys this depends on
        
        // Cleanup intervals
        this.cleanupIntervals = [];
        
        // Performance monitoring
        this.performanceMetrics = {
            operationTimes: new Map(),
            hitRatios: [],
            memoryUsage: [],
            diskUsage: []
        };
        
        this.initialized = false;
    }

    /**
     * Initialize the multi-layer cache system
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            logger.info('Initializing multi-layer cache system', {
                memoryEnabled: this.config.memory.enabled,
                diskEnabled: this.config.disk.enabled,
                distributedEnabled: this.config.distributed.enabled
            });
            
            // Initialize disk cache
            if (this.config.disk.enabled) {
                await this.initializeDiskCache();
            }
            
            // Initialize distributed cache
            if (this.config.distributed.enabled) {
                await this.initializeDistributedCache();
            }
            
            // Start maintenance tasks
            this.startMaintenanceTasks();
            
            // Start performance monitoring
            this.startPerformanceMonitoring();
            
            this.initialized = true;
            this.emit('initialized');
            
            logger.info('Multi-layer cache system initialized successfully');
            
        } catch (error) {
            logger.error('Failed to initialize cache system:', error);
            throw error;
        }
    }

    /**
     * Initialize disk cache
     */
    async initializeDiskCache() {
        try {
            const cacheDir = this.config.disk.cacheDir;
            
            // Create cache directory structure
            await fs.mkdir(cacheDir, { recursive: true });
            await fs.mkdir(path.join(cacheDir, 'data'), { recursive: true });
            await fs.mkdir(path.join(cacheDir, 'meta'), { recursive: true });
            await fs.mkdir(path.join(cacheDir, 'temp'), { recursive: true });
            
            // Create cache index file if it doesn't exist
            const indexPath = path.join(cacheDir, 'index.json');
            try {
                await fs.access(indexPath);
            } catch {
                await fs.writeFile(indexPath, JSON.stringify({ version: '1.0', entries: {} }));
            }
            
            this.diskCache = new DiskCache(this.config.disk);
            await this.diskCache.initialize();
            
            logger.info('Disk cache initialized', { cacheDir });
            
        } catch (error) {
            logger.error('Failed to initialize disk cache:', error);
            throw error;
        }
    }

    /**
     * Initialize distributed cache (Redis, etc.)
     */
    async initializeDistributedCache() {
        try {
            if (this.config.distributed.provider === 'redis') {
                this.distributedCache = new RedisCache(this.config.distributed);
            } else {
                throw new Error(`Unsupported distributed cache provider: ${this.config.distributed.provider}`);
            }
            
            await this.distributedCache.initialize();
            logger.info('Distributed cache initialized', { 
                provider: this.config.distributed.provider 
            });
            
        } catch (error) {
            logger.warn('Failed to initialize distributed cache:', error);
            // Don't throw - continue with memory and disk cache only
            this.config.distributed.enabled = false;
        }
    }

    /**
     * Get value from cache with multi-layer lookup
     */
    async get(key, options = {}) {
        const startTime = Date.now();
        
        try {
            // Validate key
            this.validateKey(key);
            
            let value = null;
            let source = null;
            
            // Try memory cache first
            if (this.config.memory.enabled) {
                value = await this.getFromMemory(key);
                if (value !== null) {
                    source = 'memory';
                    this.stats.hits.memory++;
                } else {
                    this.stats.misses.memory++;
                }
            }
            
            // Try disk cache if not found in memory
            if (value === null && this.config.disk.enabled && this.diskCache) {
                value = await this.getFromDisk(key);
                if (value !== null) {
                    source = 'disk';
                    this.stats.hits.disk++;
                    
                    // Promote to memory cache if configured
                    if (this.config.memory.enabled && this.config.strategies.writeThrough) {
                        await this.setToMemory(key, value, options);
                    }
                } else {
                    this.stats.misses.disk++;
                }
            }
            
            // Try distributed cache if not found
            if (value === null && this.config.distributed.enabled && this.distributedCache) {
                value = await this.getFromDistributed(key);
                if (value !== null) {
                    source = 'distributed';
                    this.stats.hits.distributed++;
                    
                    // Promote to local caches if configured
                    if (this.config.strategies.writeThrough) {
                        if (this.config.memory.enabled) {
                            await this.setToMemory(key, value, options);
                        }
                        if (this.config.disk.enabled) {
                            await this.setToDisk(key, value, options);
                        }
                    }
                } else {
                    this.stats.misses.distributed++;
                }
            }
            
            // Update performance metrics
            const accessTime = Date.now() - startTime;
            this.updateAccessTime(source || 'miss', accessTime);
            
            // Check for refresh-ahead strategy
            if (value !== null && this.config.strategies.refreshAhead) {
                this.checkRefreshAhead(key, source);
            }
            
            this.emit('get', { key, hit: value !== null, source, accessTime });
            
            return value;
            
        } catch (error) {
            logger.error('Cache get error:', { key, error: error.message });
            this.stats.errors[source || 'unknown']++;
            throw error;
        }
    }

    /**
     * Set value in cache with multi-layer storage
     */
    async set(key, value, options = {}) {
        const startTime = Date.now();
        
        try {
            // Validate inputs
            this.validateKey(key);
            this.validateValue(value);
            
            const ttl = options.ttl || this.config.strategies.defaultTtl;
            const setOptions = { ...options, ttl };
            
            // Set in all enabled cache layers
            const promises = [];
            
            // Memory cache
            if (this.config.memory.enabled) {
                promises.push(this.setToMemory(key, value, setOptions));
            }
            
            // Disk cache
            if (this.config.disk.enabled && this.diskCache) {
                if (this.config.performance.asyncWrites) {
                    // Async write for better performance
                    this.setToDisk(key, value, setOptions).catch(error => {
                        logger.error('Async disk cache set failed:', { key, error: error.message });
                        this.stats.errors.disk++;
                    });
                } else {
                    promises.push(this.setToDisk(key, value, setOptions));
                }
            }
            
            // Distributed cache
            if (this.config.distributed.enabled && this.distributedCache) {
                if (this.config.performance.asyncWrites) {
                    // Async write for better performance
                    this.setToDistributed(key, value, setOptions).catch(error => {
                        logger.error('Async distributed cache set failed:', { key, error: error.message });
                        this.stats.errors.distributed++;
                    });
                } else {
                    promises.push(this.setToDistributed(key, value, setOptions));
                }
            }
            
            // Wait for synchronous operations
            await Promise.all(promises);
            
            // Update dependencies if specified
            if (options.dependencies) {
                this.updateDependencies(key, options.dependencies);
            }
            
            const setTime = Date.now() - startTime;
            this.emit('set', { key, setTime, layers: promises.length });
            
            return true;
            
        } catch (error) {
            logger.error('Cache set error:', { key, error: error.message });
            throw error;
        }
    }

    /**
     * Delete key from all cache layers
     */
    async delete(key, options = {}) {
        try {
            this.validateKey(key);
            
            const promises = [];
            
            // Delete from all cache layers
            if (this.config.memory.enabled) {
                promises.push(this.deleteFromMemory(key));
            }
            
            if (this.config.disk.enabled && this.diskCache) {
                promises.push(this.deleteFromDisk(key));
            }
            
            if (this.config.distributed.enabled && this.distributedCache) {
                promises.push(this.deleteFromDistributed(key));
            }
            
            await Promise.all(promises);
            
            // Handle dependent cache invalidation
            if (options.invalidateDependents !== false) {
                await this.invalidateDependents(key);
            }
            
            // Clean up dependency tracking
            this.cleanupDependencies(key);
            
            this.emit('delete', { key });
            
            return true;
            
        } catch (error) {
            logger.error('Cache delete error:', { key, error: error.message });
            throw error;
        }
    }

    /**
     * Clear cache with optional pattern matching
     */
    async clear(pattern = null) {
        try {
            const promises = [];
            
            if (this.config.memory.enabled) {
                promises.push(this.clearMemory(pattern));
            }
            
            if (this.config.disk.enabled && this.diskCache) {
                promises.push(this.clearDisk(pattern));
            }
            
            if (this.config.distributed.enabled && this.distributedCache) {
                promises.push(this.clearDistributed(pattern));
            }
            
            await Promise.all(promises);
            
            // Clear dependency tracking
            if (!pattern) {
                this.dependencies.clear();
                this.dependents.clear();
            }
            
            this.emit('clear', { pattern });
            
            return true;
            
        } catch (error) {
            logger.error('Cache clear error:', { pattern, error: error.message });
            throw error;
        }
    }

    /**
     * Get from memory cache
     */
    async getFromMemory(key) {
        if (!this.config.memory.enabled) return null;
        
        const entry = this.memoryCache.get(key);
        if (!entry) return null;
        
        const meta = this.memoryMeta.get(key);
        
        // Check expiration
        if (meta && meta.expires && Date.now() > meta.expires) {
            this.memoryCache.delete(key);
            this.memoryMeta.delete(key);
            this.stats.evictions.memory++;
            return null;
        }
        
        // Update access time for LRU
        if (meta) {
            meta.lastAccess = Date.now();
            meta.accessCount++;
        }
        
        return entry;
    }

    /**
     * Set to memory cache
     */
    async setToMemory(key, value, options = {}) {
        if (!this.config.memory.enabled) return;
        
        // Check if eviction is needed
        await this.evictFromMemoryIfNeeded();
        
        const serializedValue = this.serializeValue(value);
        const size = this.calculateSize(serializedValue);
        
        this.memoryCache.set(key, value);
        this.memoryMeta.set(key, {
            size,
            created: Date.now(),
            lastAccess: Date.now(),
            accessCount: 1,
            expires: options.ttl ? Date.now() + options.ttl : null
        });
        
        this.stats.sets.memory++;
        this.stats.totalSize.memory += size;
        this.stats.totalItems.memory++;
    }

    /**
     * Delete from memory cache
     */
    async deleteFromMemory(key) {
        if (!this.config.memory.enabled) return;
        
        const meta = this.memoryMeta.get(key);
        if (meta) {
            this.stats.totalSize.memory -= meta.size;
            this.stats.totalItems.memory--;
        }
        
        this.memoryCache.delete(key);
        this.memoryMeta.delete(key);
        this.stats.deletes.memory++;
    }

    /**
     * Clear memory cache
     */
    async clearMemory(pattern = null) {
        if (!this.config.memory.enabled) return;
        
        if (pattern) {
            const regex = new RegExp(pattern);
            for (const key of this.memoryCache.keys()) {
                if (regex.test(key)) {
                    await this.deleteFromMemory(key);
                }
            }
        } else {
            this.memoryCache.clear();
            this.memoryMeta.clear();
            this.stats.totalSize.memory = 0;
            this.stats.totalItems.memory = 0;
        }
    }

    /**
     * Evict from memory cache if needed
     */
    async evictFromMemoryIfNeeded() {
        const maxSize = this.config.memory.maxSize;
        const maxItems = this.config.memory.maxItems;
        
        // Check size constraint
        if (this.stats.totalSize.memory > maxSize) {
            await this.evictFromMemoryBySize();
        }
        
        // Check item count constraint
        if (this.stats.totalItems.memory > maxItems) {
            await this.evictFromMemoryByCount();
        }
    }

    /**
     * Evict from memory by size (LRU)
     */
    async evictFromMemoryBySize() {
        const targetSize = this.config.memory.maxSize * 0.8; // Evict to 80% capacity
        
        // Sort by last access time (LRU)
        const entries = Array.from(this.memoryMeta.entries())
            .sort((a, b) => a[1].lastAccess - b[1].lastAccess);
        
        for (const [key, meta] of entries) {
            if (this.stats.totalSize.memory <= targetSize) break;
            
            await this.deleteFromMemory(key);
            this.stats.evictions.memory++;
        }
    }

    /**
     * Evict from memory by count (LRU)
     */
    async evictFromMemoryByCount() {
        const targetCount = this.config.memory.maxItems * 0.8; // Evict to 80% capacity
        
        // Sort by last access time (LRU)
        const entries = Array.from(this.memoryMeta.entries())
            .sort((a, b) => a[1].lastAccess - b[1].lastAccess);
        
        for (const [key, meta] of entries) {
            if (this.stats.totalItems.memory <= targetCount) break;
            
            await this.deleteFromMemory(key);
            this.stats.evictions.memory++;
        }
    }

    /**
     * Get from disk cache
     */
    async getFromDisk(key) {
        if (!this.config.disk.enabled || !this.diskCache) return null;
        
        try {
            return await this.diskCache.get(key);
        } catch (error) {
            this.stats.errors.disk++;
            logger.error('Disk cache get error:', { key, error: error.message });
            return null;
        }
    }

    /**
     * Set to disk cache
     */
    async setToDisk(key, value, options = {}) {
        if (!this.config.disk.enabled || !this.diskCache) return;
        
        try {
            await this.diskCache.set(key, value, options);
            this.stats.sets.disk++;
        } catch (error) {
            this.stats.errors.disk++;
            logger.error('Disk cache set error:', { key, error: error.message });
            throw error;
        }
    }

    /**
     * Delete from disk cache
     */
    async deleteFromDisk(key) {
        if (!this.config.disk.enabled || !this.diskCache) return;
        
        try {
            await this.diskCache.delete(key);
            this.stats.deletes.disk++;
        } catch (error) {
            this.stats.errors.disk++;
            logger.error('Disk cache delete error:', { key, error: error.message });
            throw error;
        }
    }

    /**
     * Clear disk cache
     */
    async clearDisk(pattern = null) {
        if (!this.config.disk.enabled || !this.diskCache) return;
        
        try {
            await this.diskCache.clear(pattern);
        } catch (error) {
            this.stats.errors.disk++;
            logger.error('Disk cache clear error:', { pattern, error: error.message });
            throw error;
        }
    }

    /**
     * Get from distributed cache
     */
    async getFromDistributed(key) {
        if (!this.config.distributed.enabled || !this.distributedCache) return null;
        
        try {
            return await this.distributedCache.get(key);
        } catch (error) {
            this.stats.errors.distributed++;
            logger.error('Distributed cache get error:', { key, error: error.message });
            return null;
        }
    }

    /**
     * Set to distributed cache
     */
    async setToDistributed(key, value, options = {}) {
        if (!this.config.distributed.enabled || !this.distributedCache) return;
        
        try {
            await this.distributedCache.set(key, value, options);
            this.stats.sets.distributed++;
        } catch (error) {
            this.stats.errors.distributed++;
            logger.error('Distributed cache set error:', { key, error: error.message });
            throw error;
        }
    }

    /**
     * Delete from distributed cache
     */
    async deleteFromDistributed(key) {
        if (!this.config.distributed.enabled || !this.distributedCache) return;
        
        try {
            await this.distributedCache.delete(key);
            this.stats.deletes.distributed++;
        } catch (error) {
            this.stats.errors.distributed++;
            logger.error('Distributed cache delete error:', { key, error: error.message });
            throw error;
        }
    }

    /**
     * Clear distributed cache
     */
    async clearDistributed(pattern = null) {
        if (!this.config.distributed.enabled || !this.distributedCache) return;
        
        try {
            await this.distributedCache.clear(pattern);
        } catch (error) {
            this.stats.errors.distributed++;
            logger.error('Distributed cache clear error:', { pattern, error: error.message });
            throw error;
        }
    }

    /**
     * Update cache dependencies
     */
    updateDependencies(key, dependencies) {
        // Clear existing dependencies for this key
        const existingDeps = this.dependents.get(key);
        if (existingDeps) {
            for (const dep of existingDeps) {
                const depSet = this.dependencies.get(dep);
                if (depSet) {
                    depSet.delete(key);
                    if (depSet.size === 0) {
                        this.dependencies.delete(dep);
                    }
                }
            }
        }
        
        // Set new dependencies
        this.dependents.set(key, new Set(dependencies));
        
        for (const dep of dependencies) {
            if (!this.dependencies.has(dep)) {
                this.dependencies.set(dep, new Set());
            }
            this.dependencies.get(dep).add(key);
        }
    }

    /**
     * Invalidate dependent cache entries
     */
    async invalidateDependents(key) {
        const dependents = this.dependencies.get(key);
        if (!dependents) return;
        
        const promises = [];
        for (const dependent of dependents) {
            promises.push(this.delete(dependent, { invalidateDependents: false }));
        }
        
        await Promise.all(promises);
        this.dependencies.delete(key);
    }

    /**
     * Clean up dependency tracking for a key
     */
    cleanupDependencies(key) {
        // Remove from dependencies
        const dependents = this.dependencies.get(key);
        if (dependents) {
            for (const dependent of dependents) {
                const depSet = this.dependents.get(dependent);
                if (depSet) {
                    depSet.delete(key);
                    if (depSet.size === 0) {
                        this.dependents.delete(dependent);
                    }
                }
            }
            this.dependencies.delete(key);
        }
        
        // Remove from dependents
        const deps = this.dependents.get(key);
        if (deps) {
            for (const dep of deps) {
                const depSet = this.dependencies.get(dep);
                if (depSet) {
                    depSet.delete(key);
                    if (depSet.size === 0) {
                        this.dependencies.delete(dep);
                    }
                }
            }
            this.dependents.delete(key);
        }
    }

    /**
     * Check for refresh-ahead strategy
     */
    checkRefreshAhead(key, source) {
        // Implement refresh-ahead logic here
        // This could trigger background refresh of the cache entry
        // before it expires to maintain performance
        this.emit('refreshAhead', { key, source });
    }

    /**
     * Start maintenance tasks
     */
    startMaintenanceTasks() {
        // Cleanup expired entries
        const cleanupInterval = setInterval(() => {
            this.cleanupExpiredEntries().catch(error => {
                logger.error('Cleanup task error:', error);
            });
        }, this.config.memory.checkPeriod);
        
        this.cleanupIntervals.push(cleanupInterval);
        
        // Update statistics
        const statsInterval = setInterval(() => {
            this.updateStatistics();
        }, 60000); // Every minute
        
        this.cleanupIntervals.push(statsInterval);
    }

    /**
     * Start performance monitoring
     */
    startPerformanceMonitoring() {
        const monitorInterval = setInterval(() => {
            this.collectPerformanceMetrics();
        }, 30000); // Every 30 seconds
        
        this.cleanupIntervals.push(monitorInterval);
    }

    /**
     * Cleanup expired entries from memory
     */
    async cleanupExpiredEntries() {
        const now = Date.now();
        const expiredKeys = [];
        
        for (const [key, meta] of this.memoryMeta.entries()) {
            if (meta.expires && now > meta.expires) {
                expiredKeys.push(key);
            }
        }
        
        for (const key of expiredKeys) {
            await this.deleteFromMemory(key);
            this.stats.evictions.memory++;
        }
        
        if (expiredKeys.length > 0) {
            logger.debug(`Cleaned up ${expiredKeys.length} expired cache entries`);
        }
    }

    /**
     * Update cache statistics
     */
    updateStatistics() {
        // Calculate hit ratios
        const totalHits = this.stats.hits.memory + this.stats.hits.disk + this.stats.hits.distributed;
        const totalMisses = this.stats.misses.memory + this.stats.misses.disk + this.stats.misses.distributed;
        const totalRequests = totalHits + totalMisses;
        
        if (totalRequests > 0) {
            this.stats.hitRatio.overall = totalHits / totalRequests;
            this.stats.hitRatio.memory = this.stats.hits.memory / (this.stats.hits.memory + this.stats.misses.memory || 1);
            this.stats.hitRatio.disk = this.stats.hits.disk / (this.stats.hits.disk + this.stats.misses.disk || 1);
            this.stats.hitRatio.distributed = this.stats.hits.distributed / (this.stats.hits.distributed + this.stats.misses.distributed || 1);
        }
        
        this.emit('statisticsUpdated', this.stats);
    }

    /**
     * Collect performance metrics
     */
    collectPerformanceMetrics() {
        const metrics = {
            timestamp: Date.now(),
            memory: {
                usage: this.stats.totalSize.memory,
                items: this.stats.totalItems.memory,
                hitRatio: this.stats.hitRatio.memory
            },
            disk: {
                hitRatio: this.stats.hitRatio.disk
            },
            distributed: {
                hitRatio: this.stats.hitRatio.distributed
            },
            overall: {
                hitRatio: this.stats.hitRatio.overall
            }
        };
        
        this.performanceMetrics.hitRatios.push(metrics.overall.hitRatio);
        this.performanceMetrics.memoryUsage.push(metrics.memory.usage);
        
        // Keep only last 100 data points
        if (this.performanceMetrics.hitRatios.length > 100) {
            this.performanceMetrics.hitRatios.shift();
        }
        if (this.performanceMetrics.memoryUsage.length > 100) {
            this.performanceMetrics.memoryUsage.shift();
        }
        
        this.emit('performanceMetrics', metrics);
    }

    /**
     * Update access time metrics
     */
    updateAccessTime(source, time) {
        if (!this.performanceMetrics.operationTimes.has(source)) {
            this.performanceMetrics.operationTimes.set(source, []);
        }
        
        const times = this.performanceMetrics.operationTimes.get(source);
        times.push(time);
        
        // Keep only last 100 measurements
        if (times.length > 100) {
            times.shift();
        }
        
        // Update average
        this.stats.avgAccessTime[source] = times.reduce((a, b) => a + b, 0) / times.length;
    }

    /**
     * Validate cache key
     */
    validateKey(key) {
        if (typeof key !== 'string' || key.length === 0) {
            throw new Error('Cache key must be a non-empty string');
        }
        
        if (key.length > 250) {
            throw new Error('Cache key too long (max 250 characters)');
        }
        
        // Check for invalid characters
        if (!/^[\w\-:._/]+$/.test(key)) {
            throw new Error('Cache key contains invalid characters');
        }
    }

    /**
     * Validate cache value
     */
    validateValue(value) {
        if (value === undefined) {
            throw new Error('Cache value cannot be undefined');
        }
        
        // Check size limit
        const serialized = this.serializeValue(value);
        const size = this.calculateSize(serialized);
        
        if (size > 10 * 1024 * 1024) { // 10MB limit per value
            throw new Error('Cache value too large (max 10MB)');
        }
    }

    /**
     * Serialize value for storage
     */
    serializeValue(value) {
        if (typeof value === 'string') {
            return value;
        }
        
        try {
            return JSON.stringify(value);
        } catch (error) {
            throw new Error(`Failed to serialize cache value: ${error.message}`);
        }
    }

    /**
     * Calculate size of serialized value
     */
    calculateSize(value) {
        return Buffer.byteLength(typeof value === 'string' ? value : JSON.stringify(value), 'utf8');
    }

    /**
     * Get cache statistics
     */
    getStatistics() {
        return {
            ...this.stats,
            performance: {
                hitRatios: [...this.performanceMetrics.hitRatios],
                memoryUsage: [...this.performanceMetrics.memoryUsage],
                averageAccessTimes: { ...this.stats.avgAccessTime }
            },
            dependencies: {
                totalDependencies: this.dependencies.size,
                totalDependents: this.dependents.size
            }
        };
    }

    /**
     * Get cache health status
     */
    getHealthStatus() {
        const health = {
            status: 'healthy',
            issues: [],
            layers: {
                memory: this.config.memory.enabled,
                disk: this.config.disk.enabled && !!this.diskCache,
                distributed: this.config.distributed.enabled && !!this.distributedCache
            }
        };
        
        // Check memory usage
        if (this.stats.totalSize.memory > this.config.memory.maxSize * 0.9) {
            health.issues.push('Memory cache near capacity');
            health.status = 'warning';
        }
        
        // Check error rates
        const totalOps = this.stats.sets.memory + this.stats.gets + this.stats.deletes.memory;
        const totalErrors = this.stats.errors.memory + this.stats.errors.disk + this.stats.errors.distributed;
        
        if (totalOps > 0 && totalErrors / totalOps > 0.05) {
            health.issues.push('High error rate detected');
            health.status = 'warning';
        }
        
        // Check hit ratio
        if (this.stats.hitRatio.overall < 0.5) {
            health.issues.push('Low cache hit ratio');
            health.status = 'warning';
        }
        
        return health;
    }

    /**
     * Shutdown cache system
     */
    async shutdown() {
        try {
            logger.info('Shutting down multi-layer cache system');
            
            // Clear cleanup intervals
            for (const interval of this.cleanupIntervals) {
                clearInterval(interval);
            }
            
            // Shutdown cache layers
            if (this.diskCache) {
                await this.diskCache.shutdown();
            }
            
            if (this.distributedCache) {
                await this.distributedCache.shutdown();
            }
            
            // Clear memory
            this.memoryCache.clear();
            this.memoryMeta.clear();
            this.dependencies.clear();
            this.dependents.clear();
            
            this.initialized = false;
            this.emit('shutdown');
            
            logger.info('Cache system shutdown completed');
            
        } catch (error) {
            logger.error('Error during cache shutdown:', error);
            throw error;
        }
    }
}

/**
 * Disk cache implementation
 */
class DiskCache {
    constructor(config) {
        this.config = config;
        this.cacheDir = config.cacheDir;
        this.index = new Map();
        this.indexPath = path.join(this.cacheDir, 'index.json');
    }

    async initialize() {
        // Load existing index
        try {
            const indexData = await fs.readFile(this.indexPath, 'utf8');
            const parsed = JSON.parse(indexData);
            this.index = new Map(Object.entries(parsed.entries || {}));
        } catch (error) {
            // Index doesn't exist or is corrupted, start fresh
            this.index = new Map();
        }
    }

    async get(key) {
        const entry = this.index.get(key);
        if (!entry) return null;
        
        // Check expiration
        if (entry.expires && Date.now() > entry.expires) {
            await this.delete(key);
            return null;
        }
        
        try {
            const filePath = path.join(this.cacheDir, 'data', this.getFileName(key));
            const data = await fs.readFile(filePath, 'utf8');
            
            // Decompress if needed
            if (entry.compressed) {
                // Implement decompression logic here
                return JSON.parse(data);
            }
            
            return JSON.parse(data);
            
        } catch (error) {
            // File doesn't exist or is corrupted
            await this.delete(key);
            return null;
        }
    }

    async set(key, value, options = {}) {
        const fileName = this.getFileName(key);
        const filePath = path.join(this.cacheDir, 'data', fileName);
        const metaPath = path.join(this.cacheDir, 'meta', fileName + '.meta');
        
        // Serialize value
        const serialized = JSON.stringify(value);
        const compressed = this.shouldCompress(serialized);
        
        // Write data file
        await fs.writeFile(filePath, serialized);
        
        // Write metadata
        const meta = {
            key,
            created: Date.now(),
            expires: options.ttl ? Date.now() + options.ttl : null,
            size: Buffer.byteLength(serialized),
            compressed
        };
        
        await fs.writeFile(metaPath, JSON.stringify(meta));
        
        // Update index
        this.index.set(key, meta);
        await this.saveIndex();
    }

    async delete(key) {
        const fileName = this.getFileName(key);
        
        try {
            await fs.unlink(path.join(this.cacheDir, 'data', fileName));
            await fs.unlink(path.join(this.cacheDir, 'meta', fileName + '.meta'));
        } catch (error) {
            // Files may not exist, ignore
        }
        
        this.index.delete(key);
        await this.saveIndex();
    }

    async clear(pattern = null) {
        if (pattern) {
            const regex = new RegExp(pattern);
            for (const key of this.index.keys()) {
                if (regex.test(key)) {
                    await this.delete(key);
                }
            }
        } else {
            // Clear all
            const dataDir = path.join(this.cacheDir, 'data');
            const metaDir = path.join(this.cacheDir, 'meta');
            
            try {
                await fs.rm(dataDir, { recursive: true, force: true });
                await fs.rm(metaDir, { recursive: true, force: true });
                await fs.mkdir(dataDir, { recursive: true });
                await fs.mkdir(metaDir, { recursive: true });
            } catch (error) {
                // Ignore errors
            }
            
            this.index.clear();
            await this.saveIndex();
        }
    }

    getFileName(key) {
        return crypto.createHash('sha256').update(key).digest('hex');
    }

    shouldCompress(data) {
        return this.config.compression && data.length > this.config.compressionThreshold;
    }

    async saveIndex() {
        const indexData = {
            version: '1.0',
            entries: Object.fromEntries(this.index.entries())
        };
        
        await fs.writeFile(this.indexPath, JSON.stringify(indexData, null, 2));
    }

    async shutdown() {
        await this.saveIndex();
    }
}

/**
 * Redis cache implementation (placeholder)
 */
class RedisCache {
    constructor(config) {
        this.config = config;
        this.client = null;
    }

    async initialize() {
        // Initialize Redis client here
        throw new Error('Redis cache not implemented yet');
    }

    async get(key) {
        // Implement Redis get
    }

    async set(key, value, options = {}) {
        // Implement Redis set
    }

    async delete(key) {
        // Implement Redis delete
    }

    async clear(pattern = null) {
        // Implement Redis clear
    }

    async shutdown() {
        // Implement Redis shutdown
    }
}

export default MultiLayerCache;