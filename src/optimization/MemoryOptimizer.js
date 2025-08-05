/**
 * CONTEXT: Advanced memory management and optimization system for MCP server
 * REASON: Efficient memory usage for large codebase analysis and preventing memory-related performance issues
 * CHANGE: Smart memory allocation, garbage collection optimization, and memory leak detection
 * PREVENTION: Memory leaks, out-of-memory errors, performance degradation, system crashes
 */

import { EventEmitter } from 'events';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export class MemoryOptimizer extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // Memory limits and thresholds
            maxHeapUsage: config.maxHeapUsage || 512 * 1024 * 1024, // 512MB
            gcThreshold: config.gcThreshold || 0.8, // Trigger GC at 80% of max
            criticalThreshold: config.criticalThreshold || 0.95, // Critical at 95%
            
            // Cache and eviction settings
            cacheEvictionRate: config.cacheEvictionRate || 0.15, // Evict 15% when needed
            aggressiveEvictionThreshold: config.aggressiveEvictionThreshold || 0.9,
            
            // Monitoring intervals
            monitorInterval: config.monitorInterval || 10000, // 10 seconds
            gcInterval: config.gcInterval || 30000, // 30 seconds
            leakDetectionInterval: config.leakDetectionInterval || 60000, // 1 minute
            
            // Memory pool settings
            enableMemoryPools: config.enableMemoryPools !== false,
            defaultPoolSize: config.defaultPoolSize || 1024 * 1024, // 1MB
            maxPoolSize: config.maxPoolSize || 16 * 1024 * 1024, // 16MB
            poolGrowthFactor: config.poolGrowthFactor || 2,
            
            // Optimization strategies
            strategies: {
                proactiveGC: config.proactiveGC !== false,
                smartEviction: config.smartEviction !== false,
                memoryPooling: config.memoryPooling !== false,
                leakDetection: config.leakDetection !== false,
                compressionOptimization: config.compressionOptimization !== false,
                ...config.strategies
            },
            
            // Advanced settings
            advanced: {
                heapSnapshotThreshold: config.heapSnapshotThreshold || 0.9,
                enableHeapDump: config.enableHeapDump || false,
                heapDumpPath: config.heapDumpPath || './heap-dumps',
                fragmentationThreshold: config.fragmentationThreshold || 0.3,
                ...config.advanced
            }
        };
        
        // Memory tracking
        this.memoryStats = {
            current: {
                heapUsed: 0,
                heapTotal: 0,
                external: 0,
                rss: 0,
                timestamp: Date.now()
            },
            peak: {
                heapUsed: 0,
                heapTotal: 0,
                external: 0,
                rss: 0,
                timestamp: Date.now()
            },
            history: [],
            growthRate: 0,
            fragmentationRatio: 0,
            gcStats: {
                collections: 0,
                totalTime: 0,
                lastCollection: null,
                averageTime: 0,
                forced: 0
            }
        };
        
        // Memory pools
        this.memoryPools = new Map();
        this.allocations = new Map();
        this.allocationCounter = 0;
        
        // Cache managers registry
        this.cacheManagers = new Map();
        
        // Memory leak detection
        this.leakDetector = new MemoryLeakDetector(this);
        
        // Optimization state
        this.isOptimizing = false;
        this.optimizationQueue = [];
        this.lastOptimization = null;
        
        // Monitoring intervals
        this.monitoringIntervals = [];
        
        // Performance metrics
        this.performanceMetrics = {
            optimizationCount: 0,
            gcTriggers: 0,
            evictionEvents: 0,
            leaksDetected: 0,
            poolAllocations: 0,
            poolDeallocations: 0,
            memoryReclaimed: 0
        };
        
        this.initialized = false;
    }

    /**
     * Initialize memory optimizer
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            logger.info('Initializing memory optimizer', {
                maxHeapUsage: this.config.maxHeapUsage,
                strategies: this.config.strategies
            });
            
            // Initialize memory pools if enabled
            if (this.config.enableMemoryPools) {
                await this.initializeMemoryPools();
            }
            
            // Initialize leak detector
            if (this.config.strategies.leakDetection) {
                await this.leakDetector.initialize();
            }
            
            // Start monitoring
            this.startMemoryMonitoring();
            
            // Configure garbage collection
            if (this.config.strategies.proactiveGC) {
                this.configureGarbageCollection();
            }
            
            // Setup heap dump generation if enabled
            if (this.config.advanced.enableHeapDump) {
                await this.setupHeapDumpGeneration();
            }
            
            this.initialized = true;
            this.emit('initialized');
            
            logger.info('Memory optimizer initialized successfully');
            
        } catch (error) {
            logger.error('Failed to initialize memory optimizer:', error);
            throw error;
        }
    }

    /**
     * Initialize memory pools for efficient allocation
     */
    async initializeMemoryPools() {
        try {
            // Create default pools for common use cases
            const poolConfigs = [
                { name: 'small', size: 64 * 1024 }, // 64KB for small objects
                { name: 'medium', size: 256 * 1024 }, // 256KB for medium objects
                { name: 'large', size: 1024 * 1024 }, // 1MB for large objects
                { name: 'analysis', size: 4 * 1024 * 1024 }, // 4MB for code analysis
                { name: 'cache', size: 8 * 1024 * 1024 } // 8MB for cache data
            ];
            
            for (const poolConfig of poolConfigs) {
                this.createMemoryPool(poolConfig.name, poolConfig.size);
            }
            
            logger.debug('Memory pools initialized', { 
                pools: Array.from(this.memoryPools.keys()) 
            });
            
        } catch (error) {
            logger.error('Failed to initialize memory pools:', error);
            throw error;
        }
    }

    /**
     * Start memory monitoring and optimization
     */
    startMemoryMonitoring() {
        // Main memory monitoring
        const memoryMonitor = setInterval(() => {
            this.collectMemoryStats();
        }, this.config.monitorInterval);
        
        // Garbage collection monitoring
        const gcMonitor = setInterval(() => {
            this.checkGarbageCollection();
        }, this.config.gcInterval);
        
        // Memory leak detection
        const leakMonitor = setInterval(() => {
            if (this.config.strategies.leakDetection) {
                this.leakDetector.detectLeaks().catch(error => {
                    logger.error('Memory leak detection failed:', error);
                });
            }
        }, this.config.leakDetectionInterval);
        
        // Optimization trigger
        const optimizationMonitor = setInterval(() => {
            this.triggerOptimizationIfNeeded().catch(error => {
                logger.error('Memory optimization failed:', error);
            });
        }, this.config.monitorInterval);
        
        this.monitoringIntervals.push(
            memoryMonitor,
            gcMonitor, 
            leakMonitor,
            optimizationMonitor
        );
        
        logger.debug('Memory monitoring started');
    }

    /**
     * Configure garbage collection optimization
     */
    configureGarbageCollection() {
        if (!global.gc) {
            logger.warn('Garbage collection not available, run with --expose-gc flag');
            return;
        }
        
        // Monitor memory pressure and trigger GC proactively
        const gcTrigger = setInterval(() => {
            const memUsage = process.memoryUsage();
            const usageRatio = memUsage.heapUsed / this.config.maxHeapUsage;
            
            if (usageRatio > this.config.gcThreshold) {
                this.forceGarbageCollection('proactive');
            }
        }, this.config.gcInterval);
        
        this.monitoringIntervals.push(gcTrigger);
        
        logger.debug('Garbage collection configured');
    }

    /**
     * Setup heap dump generation for debugging
     */
    async setupHeapDumpGeneration() {
        try {
            await fs.mkdir(this.config.advanced.heapDumpPath, { recursive: true });
            
            // Monitor for critical memory usage to generate heap dumps
            this.on('criticalMemoryUsage', async (stats) => {
                try {
                    await this.generateHeapDump(stats);
                } catch (error) {
                    logger.error('Failed to generate heap dump:', error);
                }
            });
            
            logger.debug('Heap dump generation configured');
            
        } catch (error) {
            logger.error('Failed to setup heap dump generation:', error);
        }
    }

    /**
     * Collect comprehensive memory statistics
     */
    collectMemoryStats() {
        const memUsage = process.memoryUsage();
        const timestamp = Date.now();
        
        // Update current stats
        this.memoryStats.current = {
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss,
            timestamp: timestamp
        };
        
        // Update peak values
        if (memUsage.heapUsed > this.memoryStats.peak.heapUsed) {
            this.memoryStats.peak = {
                heapUsed: memUsage.heapUsed,
                heapTotal: memUsage.heapTotal,
                external: memUsage.external,
                rss: memUsage.rss,
                timestamp: timestamp
            };
        }
        
        // Add to history
        this.memoryStats.history.push({
            ...this.memoryStats.current
        });
        
        // Limit history size
        if (this.memoryStats.history.length > 1000) {
            this.memoryStats.history.shift();
        }
        
        // Calculate growth rate and fragmentation
        this.calculateMemoryMetrics();
        
        // Check for critical memory usage
        const usageRatio = memUsage.heapUsed / this.config.maxHeapUsage;
        if (usageRatio > this.config.criticalThreshold) {
            this.emit('criticalMemoryUsage', this.memoryStats.current);
        }
        
        this.emit('memoryStats', this.memoryStats.current);
    }

    /**
     * Calculate derived memory metrics
     */
    calculateMemoryMetrics() {
        const history = this.memoryStats.history;
        if (history.length < 10) return;
        
        // Calculate memory growth rate
        const recent = history.slice(-10);
        const oldestMemory = recent[0].heapUsed;
        const newestMemory = recent[recent.length - 1].heapUsed;
        const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;
        
        this.memoryStats.growthRate = timeSpan > 0 ? 
            (newestMemory - oldestMemory) / timeSpan : 0; // bytes per ms
        
        // Calculate fragmentation ratio
        const current = this.memoryStats.current;
        this.memoryStats.fragmentationRatio = current.heapTotal > 0 ? 
            (current.heapTotal - current.heapUsed) / current.heapTotal : 0;
        
        // Emit metrics update
        this.emit('memoryMetricsUpdated', {
            growthRate: this.memoryStats.growthRate,
            fragmentationRatio: this.memoryStats.fragmentationRatio
        });
    }

    /**
     * Check if garbage collection should be triggered
     */
    checkGarbageCollection() {
        if (!global.gc || !this.config.strategies.proactiveGC) return;
        
        const memUsage = process.memoryUsage();
        const usageRatio = memUsage.heapUsed / this.config.maxHeapUsage;
        const fragmentationRatio = this.memoryStats.fragmentationRatio;
        
        // Trigger GC based on usage ratio
        if (usageRatio > this.config.gcThreshold) {
            this.forceGarbageCollection('threshold');
            return;
        }
        
        // Trigger GC based on fragmentation
        if (fragmentationRatio > this.config.advanced.fragmentationThreshold) {
            this.forceGarbageCollection('fragmentation');
            return;
        }
        
        // Trigger GC based on growth rate
        if (this.memoryStats.growthRate > 1024 * 1024) { // 1MB per second growth
            this.forceGarbageCollection('growth');
            return;
        }
    }

    /**
     * Force garbage collection with tracking
     */
    forceGarbageCollection(reason = 'manual') {
        if (!global.gc) return false;
        
        const startTime = Date.now();
        const beforeMemory = process.memoryUsage();
        
        try {
            global.gc();
            
            const endTime = Date.now();
            const afterMemory = process.memoryUsage();
            const gcTime = endTime - startTime;
            const memoryReclaimed = beforeMemory.heapUsed - afterMemory.heapUsed;
            
            // Update GC statistics
            this.memoryStats.gcStats.collections++;
            this.memoryStats.gcStats.totalTime += gcTime;
            this.memoryStats.gcStats.averageTime = 
                this.memoryStats.gcStats.totalTime / this.memoryStats.gcStats.collections;
            this.memoryStats.gcStats.lastCollection = {
                timestamp: endTime,
                reason: reason,
                duration: gcTime,
                memoryReclaimed: memoryReclaimed
            };
            
            if (reason !== 'manual') {
                this.memoryStats.gcStats.forced++;
            }
            
            // Update performance metrics
            this.performanceMetrics.gcTriggers++;
            this.performanceMetrics.memoryReclaimed += Math.max(0, memoryReclaimed);
            
            logger.debug(`Garbage collection completed`, {
                reason: reason,
                duration: gcTime,
                memoryReclaimed: memoryReclaimed,
                beforeHeap: beforeMemory.heapUsed,
                afterHeap: afterMemory.heapUsed
            });
            
            this.emit('garbageCollection', {
                reason: reason,
                duration: gcTime,
                memoryReclaimed: memoryReclaimed,
                beforeMemory: beforeMemory,
                afterMemory: afterMemory
            });
            
            return true;
            
        } catch (error) {
            logger.error('Garbage collection failed:', error);
            return false;
        }
    }

    /**
     * Trigger optimization if memory usage is high
     */
    async triggerOptimizationIfNeeded() {
        if (this.isOptimizing) return;
        
        const memUsage = process.memoryUsage();
        const usageRatio = memUsage.heapUsed / this.config.maxHeapUsage;
        
        if (usageRatio > this.config.gcThreshold) {
            await this.runMemoryOptimization();
        }
    }

    /**
     * Run comprehensive memory optimization
     */
    async runMemoryOptimization() {
        if (this.isOptimizing) return;
        
        this.isOptimizing = true;
        const startTime = Date.now();
        
        try {
            logger.info('Starting memory optimization...', {
                currentUsage: this.memoryStats.current.heapUsed,
                threshold: this.config.maxHeapUsage
            });
            
            const beforeMemory = process.memoryUsage();
            
            // 1. Evict cache entries
            if (this.config.strategies.smartEviction) {
                await this.evictCaches();
            }
            
            // 2. Clean up memory pools
            if (this.config.strategies.memoryPooling) {
                await this.optimizeMemoryPools();
            }
            
            // 3. Clean up old allocations
            this.cleanupAllocations();
            
            // 4. Force garbage collection
            if (global.gc && this.config.strategies.proactiveGC) {
                this.forceGarbageCollection('optimization');
            }
            
            // 5. Compact memory pools
            if (this.config.strategies.memoryPooling) {
                await this.compactMemoryPools();
            }
            
            const afterMemory = process.memoryUsage();
            const savedMemory = beforeMemory.heapUsed - afterMemory.heapUsed;
            const duration = Date.now() - startTime;
            
            // Update performance metrics
            this.performanceMetrics.optimizationCount++;
            this.performanceMetrics.memoryReclaimed += Math.max(0, savedMemory);
            
            this.lastOptimization = {
                timestamp: Date.now(),
                duration: duration,
                memorySaved: savedMemory,
                beforeMemory: beforeMemory,
                afterMemory: afterMemory
            };
            
            logger.info('Memory optimization completed', {
                duration: duration,
                memorySaved: savedMemory,
                newUsage: afterMemory.heapUsed
            });
            
            this.emit('memoryOptimization', this.lastOptimization);
            
        } catch (error) {
            logger.error('Memory optimization failed:', error);
            throw error;
        } finally {
            this.isOptimizing = false;
        }
    }

    /**
     * Register cache manager for optimization
     */
    registerCacheManager(name, cacheManager) {
        this.cacheManagers.set(name, cacheManager);
        logger.debug(`Cache manager registered: ${name}`);
    }

    /**
     * Unregister cache manager
     */
    unregisterCacheManager(name) {
        this.cacheManagers.delete(name);
        logger.debug(`Cache manager unregistered: ${name}`);
    }

    /**
     * Evict cache entries to free memory
     */
    async evictCaches() {
        const evictionPromises = [];
        
        for (const [name, cacheManager] of this.cacheManagers) {
            evictionPromises.push(
                this.evictCacheEntries(name, cacheManager)
            );
        }
        
        await Promise.all(evictionPromises);
        
        this.performanceMetrics.evictionEvents++;
    }

    /**
     * Evict entries from a specific cache
     */
    async evictCacheEntries(name, cacheManager) {
        try {
            const usageRatio = this.memoryStats.current.heapUsed / this.config.maxHeapUsage;
            
            // Calculate eviction rate based on memory pressure
            let evictionRate = this.config.cacheEvictionRate;
            if (usageRatio > this.config.aggressiveEvictionThreshold) {
                evictionRate = Math.min(0.5, evictionRate * 2); // More aggressive eviction
            }
            
            const cacheSize = cacheManager.size || 0;
            const evictCount = Math.floor(cacheSize * evictionRate);
            
            if (evictCount > 0 && cacheManager.evictLRU) {
                const evicted = await cacheManager.evictLRU(evictCount);
                logger.debug(`Evicted ${evicted || evictCount} entries from ${name} cache`);
                return evicted || evictCount;
            }
            
            return 0;
            
        } catch (error) {
            logger.error(`Failed to evict from cache ${name}:`, error);
            return 0;
        }
    }

    /**
     * Create a memory pool for efficient allocation
     */
    createMemoryPool(name, initialSize = this.config.defaultPoolSize) {
        if (this.memoryPools.has(name)) {
            logger.warn(`Memory pool ${name} already exists`);
            return this.memoryPools.get(name);
        }
        
        const pool = {
            name: name,
            buffer: Buffer.alloc(initialSize),
            allocated: 0,
            freed: 0,
            allocations: new Map(),
            totalAllocations: 0,
            totalDeallocations: 0,
            createdAt: Date.now(),
            lastUsed: Date.now()
        };
        
        this.memoryPools.set(name, pool);
        
        logger.debug(`Memory pool created: ${name} (${initialSize} bytes)`);
        
        this.emit('memoryPoolCreated', {
            name: name,
            size: initialSize
        });
        
        return pool;
    }

    /**
     * Allocate memory from a pool
     */
    allocateFromPool(poolName, size, identifier = null) {
        const pool = this.memoryPools.get(poolName);
        if (!pool) {
            throw new Error(`Memory pool ${poolName} not found`);
        }
        
        // Ensure pool has enough space
        if (pool.allocated + size > pool.buffer.length) {
            this.expandMemoryPool(poolName, size);
        }
        
        const allocationId = identifier || `alloc_${++this.allocationCounter}`;
        
        const allocation = {
            id: allocationId,
            poolName: poolName,
            offset: pool.allocated,
            size: size,
            timestamp: Date.now(),
            lastAccessed: Date.now()
        };
        
        pool.allocations.set(allocationId, allocation);
        pool.allocated += size;
        pool.totalAllocations++;
        pool.lastUsed = Date.now();
        
        this.allocations.set(allocationId, allocation);
        this.performanceMetrics.poolAllocations++;
        
        // Return a slice of the buffer
        const buffer = pool.buffer.slice(allocation.offset, allocation.offset + size);
        
        this.emit('memoryAllocated', {
            poolName: poolName,
            allocationId: allocationId,
            size: size
        });
        
        return {
            id: allocationId,
            buffer: buffer,
            size: size
        };
    }

    /**
     * Deallocate memory from a pool
     */
    deallocateFromPool(allocationId) {
        const allocation = this.allocations.get(allocationId);
        if (!allocation) {
            logger.warn(`Allocation ${allocationId} not found`);
            return false;
        }
        
        const pool = this.memoryPools.get(allocation.poolName);
        if (!pool) {
            logger.warn(`Pool ${allocation.poolName} not found`);
            return false;
        }
        
        pool.allocations.delete(allocationId);
        pool.freed += allocation.size;
        pool.totalDeallocations++;
        
        this.allocations.delete(allocationId);
        this.performanceMetrics.poolDeallocations++;
        
        this.emit('memoryDeallocated', {
            poolName: allocation.poolName,
            allocationId: allocationId,
            size: allocation.size
        });
        
        return true;
    }

    /**
     * Expand a memory pool when more space is needed
     */
    expandMemoryPool(poolName, minAdditionalSize) {
        const pool = this.memoryPools.get(poolName);
        if (!pool) return;
        
        const currentSize = pool.buffer.length;
        const requiredSize = pool.allocated + minAdditionalSize;
        const newSize = Math.min(
            this.config.maxPoolSize,
            Math.max(
                requiredSize,
                currentSize * this.config.poolGrowthFactor
            )
        );
        
        if (newSize > this.config.maxPoolSize) {
            throw new Error(`Pool ${poolName} cannot be expanded beyond max size`);
        }
        
        const newBuffer = Buffer.alloc(newSize);
        pool.buffer.copy(newBuffer, 0, 0, pool.allocated);
        pool.buffer = newBuffer;
        
        logger.debug(`Memory pool ${poolName} expanded from ${currentSize} to ${newSize} bytes`);
        
        this.emit('memoryPoolExpanded', {
            poolName: poolName,
            oldSize: currentSize,
            newSize: newSize
        });
    }

    /**
     * Optimize memory pools by removing unused allocations
     */
    async optimizeMemoryPools() {
        for (const [name, pool] of this.memoryPools) {
            await this.optimizeMemoryPool(name, pool);
        }
    }

    /**
     * Optimize a specific memory pool
     */
    async optimizeMemoryPool(name, pool) {
        const cutoffTime = Date.now() - (10 * 60 * 1000); // 10 minutes
        const expiredAllocations = [];
        
        // Find expired allocations
        for (const [id, allocation] of pool.allocations) {
            if (allocation.lastAccessed < cutoffTime) {
                expiredAllocations.push(id);
            }
        }
        
        // Remove expired allocations
        for (const id of expiredAllocations) {
            this.deallocateFromPool(id);
        }
        
        if (expiredAllocations.length > 0) {
            logger.debug(`Optimized pool ${name}: removed ${expiredAllocations.length} expired allocations`);
        }
    }

    /**
     * Compact memory pools to reduce fragmentation
     */
    async compactMemoryPools() {
        for (const [name, pool] of this.memoryPools) {
            if (pool.freed > pool.buffer.length * 0.3) { // If 30% or more is freed
                await this.compactMemoryPool(name, pool);
            }
        }
    }

    /**
     * Compact a specific memory pool
     */
    async compactMemoryPool(name, pool) {
        // Create new buffer with only active allocations
        const activeAllocations = Array.from(pool.allocations.values())
            .sort((a, b) => a.offset - b.offset);
        
        const newSize = activeAllocations.reduce((sum, alloc) => sum + alloc.size, 0);
        
        if (newSize === 0) {
            // Pool is empty, reset it
            pool.buffer = Buffer.alloc(this.config.defaultPoolSize);
            pool.allocated = 0;
            pool.freed = 0;
            pool.allocations.clear();
            return;
        }
        
        const newBuffer = Buffer.alloc(Math.max(newSize, this.config.defaultPoolSize));
        
        let newOffset = 0;
        for (const allocation of activeAllocations) {
            // Copy data to new location
            pool.buffer.copy(newBuffer, newOffset, allocation.offset, allocation.offset + allocation.size);
            
            // Update allocation offset
            allocation.offset = newOffset;
            newOffset += allocation.size;
        }
        
        pool.buffer = newBuffer;
        pool.allocated = newOffset;
        pool.freed = 0;
        
        logger.debug(`Compacted memory pool ${name}: reduced size to ${newBuffer.length} bytes`);
        
        this.emit('memoryPoolCompacted', {
            poolName: name,
            newSize: newBuffer.length,
            activeAllocations: activeAllocations.length
        });
    }

    /**
     * Clean up old allocations
     */
    cleanupAllocations() {
        const cutoffTime = Date.now() - (15 * 60 * 1000); // 15 minutes
        const expiredAllocations = [];
        
        for (const [id, allocation] of this.allocations) {
            if (allocation.timestamp < cutoffTime) {
                expiredAllocations.push(id);
            }
        }
        
        for (const id of expiredAllocations) {
            this.deallocateFromPool(id);
        }
        
        if (expiredAllocations.length > 0) {
            logger.debug(`Cleaned up ${expiredAllocations.length} expired allocations`);
        }
    }

    /**
     * Generate heap dump for debugging
     */
    async generateHeapDump(memoryStats) {
        try {
            const heapdump = await import('heapdump');
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `heap-${timestamp}.heapsnapshot`;
            const filepath = path.join(this.config.advanced.heapDumpPath, filename);
            
            heapdump.writeSnapshot(filepath, (err, filename) => {
                if (err) {
                    logger.error('Failed to write heap dump:', err);
                } else {
                    logger.info(`Heap dump generated: ${filename}`);
                    this.emit('heapDumpGenerated', {
                        filepath: filename,
                        memoryStats: memoryStats
                    });
                }
            });
            
        } catch (error) {
            logger.error('Heapdump module not available:', error.message);
        }
    }

    /**
     * Get comprehensive memory analytics
     */
    getMemoryAnalytics() {
        const poolStats = this.getMemoryPoolStats();
        const currentStats = this.memoryStats.current;
        
        return {
            timestamp: Date.now(),
            
            // Current memory state
            current: {
                heapUsed: currentStats.heapUsed,
                heapTotal: currentStats.heapTotal,
                external: currentStats.external,
                rss: currentStats.rss,
                usageRatio: currentStats.heapUsed / this.config.maxHeapUsage,
                fragmentationRatio: this.memoryStats.fragmentationRatio
            },
            
            // Peak usage
            peak: this.memoryStats.peak,
            
            // Growth trends
            trends: {
                growthRate: this.memoryStats.growthRate,
                growthRatePerHour: this.memoryStats.growthRate * 3600000, // per hour
                fragmentationTrend: this.calculateFragmentationTrend()
            },
            
            // Memory pools
            pools: poolStats,
            
            // Garbage collection stats
            gc: this.memoryStats.gcStats,
            
            // Performance metrics
            performance: this.performanceMetrics,
            
            // Health assessment
            health: this.assessMemoryHealth(),
            
            // Recommendations
            recommendations: this.generateMemoryRecommendations()
        };
    }

    /**
     * Get memory pool statistics
     */
    getMemoryPoolStats() {
        const stats = {};
        
        for (const [name, pool] of this.memoryPools) {
            stats[name] = {
                totalSize: pool.buffer.length,
                allocated: pool.allocated,
                freed: pool.freed,
                utilization: pool.allocated / pool.buffer.length,
                activeAllocations: pool.allocations.size,
                totalAllocations: pool.totalAllocations,
                totalDeallocations: pool.totalDeallocations,
                lastUsed: pool.lastUsed,
                age: Date.now() - pool.createdAt
            };
        }
        
        return stats;
    }

    /**
     * Calculate fragmentation trend
     */
    calculateFragmentationTrend() {
        const history = this.memoryStats.history;
        if (history.length < 10) return 'stable';
        
        const recent = history.slice(-10);
        const fragmentationValues = recent.map(h => 
            (h.heapTotal - h.heapUsed) / h.heapTotal
        );
        
        const firstHalf = fragmentationValues.slice(0, 5);
        const secondHalf = fragmentationValues.slice(5);
        
        const firstAvg = firstHalf.reduce((a, b) => a + b, 0) / firstHalf.length;
        const secondAvg = secondHalf.reduce((a, b) => a + b, 0) / secondHalf.length;
        
        if (secondAvg > firstAvg * 1.1) return 'increasing';
        if (secondAvg < firstAvg * 0.9) return 'decreasing';
        return 'stable';
    }

    /**
     * Assess overall memory health
     */
    assessMemoryHealth() {
        const currentUsage = this.memoryStats.current.heapUsed;
        const usageRatio = currentUsage / this.config.maxHeapUsage;
        const fragmentationRatio = this.memoryStats.fragmentationRatio;
        const growthRate = this.memoryStats.growthRate;
        
        let score = 1.0;
        const issues = [];
        
        // Memory usage assessment
        if (usageRatio > 0.9) {
            score -= 0.4;
            issues.push('Critical memory usage');
        } else if (usageRatio > 0.8) {
            score -= 0.2;
            issues.push('High memory usage');
        }
        
        // Fragmentation assessment
        if (fragmentationRatio > 0.4) {
            score -= 0.2;
            issues.push('High memory fragmentation');
        }
        
        // Growth rate assessment
        if (growthRate > 1024 * 1024) { // 1MB/sec
            score -= 0.3;
            issues.push('Rapid memory growth detected');
        }
        
        // Pool utilization assessment
        const poolStats = this.getMemoryPoolStats();
        const lowUtilizationPools = Object.entries(poolStats)
            .filter(([name, stats]) => stats.utilization < 0.1 && stats.age > 300000)
            .length;
        
        if (lowUtilizationPools > 0) {
            score -= 0.1;
            issues.push(`${lowUtilizationPools} underutilized memory pools`);
        }
        
        let status = 'healthy';
        if (score < 0.3) status = 'critical';
        else if (score < 0.6) status = 'warning';
        else if (score < 0.8) status = 'degraded';
        
        return {
            status: status,
            score: Math.max(0, score),
            issues: issues,
            lastOptimization: this.lastOptimization
        };
    }

    /**
     * Generate memory optimization recommendations
     */
    generateMemoryRecommendations() {
        const recommendations = [];
        const analytics = this.getMemoryAnalytics();
        
        // High memory usage recommendations
        if (analytics.current.usageRatio > 0.8) {
            recommendations.push({
                type: 'memory_usage',
                priority: analytics.current.usageRatio > 0.9 ? 'critical' : 'high',
                description: 'Memory usage is approaching limits',
                actions: [
                    'Increase cache eviction rates',
                    'Enable more aggressive garbage collection',
                    'Review memory-intensive operations',
                    'Consider increasing memory limits'
                ]
            });
        }
        
        // Fragmentation recommendations
        if (analytics.current.fragmentationRatio > 0.3) {
            recommendations.push({
                type: 'fragmentation',
                priority: 'medium',
                description: 'Memory fragmentation detected',
                actions: [
                    'Compact memory pools',
                    'Trigger garbage collection',
                    'Review allocation patterns'
                ]
            });
        }
        
        // Pool optimization recommendations
        const poolStats = analytics.pools;
        for (const [poolName, stats] of Object.entries(poolStats)) {
            if (stats.utilization < 0.1 && stats.age > 300000) {
                recommendations.push({
                    type: 'pool_optimization',
                    priority: 'low',
                    description: `Memory pool ${poolName} is underutilized`,
                    actions: [
                        'Consider reducing pool size',
                        'Merge with other pools',
                        'Remove if no longer needed'
                    ]
                });
            }
        }
        
        // Growth rate recommendations
        if (analytics.trends.growthRate > 512 * 1024) { // 512KB/sec
            recommendations.push({
                type: 'growth_rate',
                priority: 'high',
                description: 'Memory growth rate is concerning',
                actions: [
                    'Investigate memory leaks',
                    'Review allocation patterns',
                    'Implement more aggressive optimization',
                    'Monitor for runaway processes'
                ]
            });
        }
        
        return recommendations;
    }

    /**
     * Force immediate memory optimization
     */
    async forceOptimization() {
        if (this.isOptimizing) {
            logger.warn('Memory optimization already in progress');
            return this.lastOptimization;
        }
        
        logger.info('Forcing memory optimization');
        await this.runMemoryOptimization();
        
        return this.lastOptimization;
    }

    /**
     * Shutdown memory optimizer
     */
    async shutdown() {
        try {
            logger.info('Shutting down memory optimizer');
            
            // Clear monitoring intervals
            for (const interval of this.monitoringIntervals) {
                clearInterval(interval);
            }
            
            // Shutdown leak detector
            if (this.leakDetector) {
                await this.leakDetector.shutdown();
            }
            
            // Clear memory pools
            for (const [name, pool] of this.memoryPools) {
                pool.buffer = null;
                pool.allocations.clear();
            }
            
            this.memoryPools.clear();
            this.allocations.clear();
            this.cacheManagers.clear();
            
            this.initialized = false;
            this.emit('shutdown');
            
            logger.info('Memory optimizer shutdown completed');
            
        } catch (error) {
            logger.error('Error during memory optimizer shutdown:', error);
            throw error;
        }
    }
}

/**
 * Memory Leak Detector
 */
class MemoryLeakDetector {
    constructor(optimizer) {
        this.optimizer = optimizer;
        this.snapshots = [];
        this.leakThreshold = 10 * 1024 * 1024; // 10MB growth without cleanup
        this.maxSnapshots = 10;
    }

    async initialize() {
        logger.debug('Memory leak detector initialized');
    }

    async detectLeaks() {
        try {
            const currentMemory = process.memoryUsage();
            const snapshot = {
                timestamp: Date.now(),
                heapUsed: currentMemory.heapUsed,
                heapTotal: currentMemory.heapTotal,
                external: currentMemory.external,
                rss: currentMemory.rss
            };
            
            this.snapshots.push(snapshot);
            
            // Keep only recent snapshots
            if (this.snapshots.length > this.maxSnapshots) {
                this.snapshots.shift();
            }
            
            // Analyze for leaks
            if (this.snapshots.length >= 5) {
                const leak = this.analyzeForLeaks();
                if (leak) {
                    this.optimizer.performanceMetrics.leaksDetected++;
                    this.optimizer.emit('memoryLeakDetected', leak);
                    logger.warn('Memory leak detected', leak);
                }
            }
            
        } catch (error) {
            logger.error('Memory leak detection failed:', error);
        }
    }

    analyzeForLeaks() {
        const recent = this.snapshots.slice(-5);
        const oldest = recent[0];
        const newest = recent[recent.length - 1];
        
        const growth = newest.heapUsed - oldest.heapUsed;
        const timeSpan = newest.timestamp - oldest.timestamp;
        const growthRate = growth / timeSpan; // bytes per ms
        
        // Check for sustained growth
        if (growth > this.leakThreshold) {
            return {
                type: 'sustained_growth',
                growth: growth,
                growthRate: growthRate,
                timeSpan: timeSpan,
                severity: growth > this.leakThreshold * 2 ? 'critical' : 'warning'
            };
        }
        
        // Check for memory not being released after GC
        const gcStats = this.optimizer.memoryStats.gcStats;
        if (gcStats.lastCollection && 
            gcStats.lastCollection.memoryReclaimed < growth * 0.1) {
            return {
                type: 'gc_ineffective',
                growth: growth,
                lastGcReclaimed: gcStats.lastCollection.memoryReclaimed,
                severity: 'warning'
            };
        }
        
        return null;
    }

    async shutdown() {
        this.snapshots = [];
        logger.debug('Memory leak detector shutdown');
    }
}

export default MemoryOptimizer;