/**
 * CONTEXT: Optimization system exports for MCP server performance enhancement
 * REASON: Centralized export of all optimization components for easy integration
 * CHANGE: Complete optimization system with performance monitoring, caching, and resource management
 * PREVENTION: Import confusion, missing components, integration complexity
 */

// Core optimization components
export { default as OptimizationManager } from './OptimizationManager.js';
export { default as PerformanceMonitor } from './PerformanceMonitor.js';
export { default as MemoryOptimizer } from './MemoryOptimizer.js';
export { default as DatabaseOptimizer } from './DatabaseOptimizer.js';

// Caching system components
export { default as MultiLayerCache } from './MultiLayerCache.js';
export { default as CacheWarmer } from './CacheWarmer.js';
export { default as CacheCoherence } from './CacheCoherence.js';

// Existing optimization components (if they exist)
export { default as CacheInvalidationManager } from './CacheInvalidationManager.js';
export { default as CodeAnalysisCache } from './CodeAnalysisCache.js';
export { default as QueryCache } from './QueryCache.js';

/**
 * Create optimized MCP server configuration
 */
export function createOptimizedConfig(userConfig = {}) {
    return {
        // Performance monitoring configuration
        performanceMonitoring: {
            enabled: true,
            metricsInterval: 5000,
            alertThresholds: {
                responseTime: 2000,
                memoryUsage: 500 * 1024 * 1024, // 500MB
                cpuUsage: 80,
                errorRate: 0.05,
                cacheHitRate: 0.6,
                queryTime: 1000
            },
            optimization: {
                autoOptimization: true,
                gcOptimization: true,
                cacheOptimization: true,
                queryOptimization: true
            },
            ...userConfig.performanceMonitoring
        },

        // Memory optimization configuration
        memoryOptimization: {
            enabled: true,
            maxHeapUsage: 512 * 1024 * 1024, // 512MB
            gcThreshold: 0.8,
            cacheEvictionRate: 0.15,
            enableMemoryPools: true,
            strategies: {
                proactiveGC: true,
                smartEviction: true,
                memoryPooling: true,
                leakDetection: true
            },
            ...userConfig.memoryOptimization
        },

        // Database optimization configuration
        databaseOptimization: {
            enabled: true,
            pool: {
                min: 2,
                max: 10,
                acquireTimeoutMillis: 60000,
                idleTimeoutMillis: 30000
            },
            query: {
                cacheEnabled: true,
                cacheSize: 1000,
                cacheTTL: 300000, // 5 minutes
                slowQueryThreshold: 1000,
                enablePreparedStatements: true
            },
            monitoring: {
                enabled: true,
                trackSlowQueries: true,
                alertOnSlowQueries: true
            },
            ...userConfig.databaseOptimization
        },

        // Cache optimization configuration
        cacheOptimization: {
            enabled: true,
            multiLayerCache: true,
            cacheWarming: true,
            cacheCoherence: true,
            
            // Multi-layer cache settings
            memory: {
                enabled: true,
                maxSize: 100 * 1024 * 1024, // 100MB
                maxItems: 10000,
                ttl: 30 * 60 * 1000 // 30 minutes
            },
            
            disk: {
                enabled: true,
                cacheDir: './.kg-context/cache',
                maxSize: 1024 * 1024 * 1024, // 1GB
                maxFiles: 50000,
                ttl: 24 * 60 * 60 * 1000 // 24 hours
            },
            
            // Cache warming settings
            strategies: {
                predictiveWarming: true,
                patternBasedWarming: true,
                timeBasedWarming: true,
                dependencyWarming: true
            },
            
            // Cache coherence settings
            coherenceStrategy: 'strong',
            invalidation: {
                enabled: true,
                strategy: 'push',
                batchSize: 100
            },
            
            ...userConfig.cacheOptimization
        },

        // Integration settings
        integration: {
            handlerOptimization: true,
            requestOptimization: true,
            responseOptimization: true,
            batchOptimization: true,
            ...userConfig.integration
        },

        // Global optimization settings
        enabled: true,
        autoOptimization: true,
        aggressiveOptimization: false,
        
        ...userConfig
    };
}

/**
 * Create and initialize optimization manager with default configuration
 */
export async function createOptimizationManager(config = {}) {
    const optimizedConfig = createOptimizedConfig(config);
    const manager = new OptimizationManager(optimizedConfig);
    
    await manager.initialize();
    
    return manager;
}

/**
 * Optimization utility functions
 */
export const OptimizationUtils = {
    /**
     * Calculate performance improvement metrics
     */
    calculateImprovement(beforeMetrics, afterMetrics) {
        const improvements = {};
        
        // Response time improvement
        if (beforeMetrics.responseTime && afterMetrics.responseTime) {
            improvements.responseTime = {
                before: beforeMetrics.responseTime,
                after: afterMetrics.responseTime,
                improvement: ((beforeMetrics.responseTime - afterMetrics.responseTime) / beforeMetrics.responseTime) * 100,
                unit: 'percent'
            };
        }
        
        // Memory usage improvement
        if (beforeMetrics.memoryUsage && afterMetrics.memoryUsage) {
            improvements.memoryUsage = {
                before: beforeMetrics.memoryUsage,
                after: afterMetrics.memoryUsage,
                improvement: ((beforeMetrics.memoryUsage - afterMetrics.memoryUsage) / beforeMetrics.memoryUsage) * 100,
                unit: 'percent'
            };
        }
        
        // Cache hit rate improvement
        if (beforeMetrics.cacheHitRate !== undefined && afterMetrics.cacheHitRate !== undefined) {
            improvements.cacheHitRate = {
                before: beforeMetrics.cacheHitRate,
                after: afterMetrics.cacheHitRate,
                improvement: afterMetrics.cacheHitRate - beforeMetrics.cacheHitRate,
                unit: 'ratio'
            };
        }
        
        return improvements;
    },

    /**
     * Format optimization metrics for display
     */
    formatMetrics(metrics) {
        const formatted = {};
        
        // Format memory values
        if (metrics.memoryUsage) {
            formatted.memoryUsage = `${Math.round(metrics.memoryUsage / 1024 / 1024)}MB`;
        }
        
        // Format response times
        if (metrics.responseTime) {
            formatted.responseTime = `${metrics.responseTime}ms`;
        }
        
        // Format percentages
        if (metrics.cacheHitRate !== undefined) {
            formatted.cacheHitRate = `${(metrics.cacheHitRate * 100).toFixed(1)}%`;
        }
        
        // Format error rates
        if (metrics.errorRate !== undefined) {
            formatted.errorRate = `${(metrics.errorRate * 100).toFixed(2)}%`;
        }
        
        return formatted;
    },

    /**
     * Generate optimization summary
     */
    generateSummary(optimizationReport) {
        const summary = {
            overall: 'healthy',
            issues: [],
            recommendations: [],
            improvements: []
        };
        
        // Analyze overall health
        const componentHealth = Object.values(optimizationReport.components);
        const healthyComponents = componentHealth.filter(c => c === true).length;
        const totalComponents = componentHealth.length;
        
        if (healthyComponents / totalComponents < 0.5) {
            summary.overall = 'critical';
        } else if (healthyComponents / totalComponents < 0.8) {
            summary.overall = 'warning';
        }
        
        // Extract key issues
        if (optimizationReport.componentReports) {
            const { performance, memory, database, cache } = optimizationReport.componentReports;
            
            if (performance?.healthScore < 0.6) {
                summary.issues.push('Performance degradation detected');
            }
            
            if (memory?.health?.status !== 'healthy') {
                summary.issues.push('Memory optimization needed');
            }
            
            if (database?.performance?.healthScore < 0.6) {
                summary.issues.push('Database performance issues');
            }
            
            if (cache?.hitRatio?.overall < 0.6) {
                summary.issues.push('Low cache efficiency');
            }
        }
        
        // Extract recommendations
        if (optimizationReport.recommendations) {
            summary.recommendations = optimizationReport.recommendations
                .filter(r => r.priority === 'high' || r.priority === 'critical')
                .slice(0, 5); // Top 5 recommendations
        }
        
        return summary;
    },

    /**
     * Validate optimization configuration
     */
    validateConfig(config) {
        const errors = [];
        const warnings = [];
        
        // Check memory limits
        if (config.memoryOptimization?.maxHeapUsage) {
            const maxHeap = config.memoryOptimization.maxHeapUsage;
            if (maxHeap < 256 * 1024 * 1024) {
                warnings.push('Memory limit is very low, may cause performance issues');
            }
            if (maxHeap > 2 * 1024 * 1024 * 1024) {
                warnings.push('Memory limit is very high, may cause resource contention');
            }
        }
        
        // Check cache configuration
        if (config.cacheOptimization?.memory?.maxSize && 
            config.cacheOptimization?.disk?.maxSize) {
            const memCache = config.cacheOptimization.memory.maxSize;
            const diskCache = config.cacheOptimization.disk.maxSize;
            
            if (diskCache < memCache) {
                warnings.push('Disk cache is smaller than memory cache');
            }
        }
        
        // Check database pool configuration
        if (config.databaseOptimization?.pool) {
            const { min, max } = config.databaseOptimization.pool;
            if (min >= max) {
                errors.push('Database pool minimum must be less than maximum');
            }
            if (min < 1) {
                errors.push('Database pool minimum must be at least 1');
            }
        }
        
        return { errors, warnings };
    }
};

/**
 * Default optimization profiles for different use cases
 */
export const OptimizationProfiles = {
    /**
     * Development profile - lighter optimization for development
     */
    development: {
        performanceMonitoring: {
            enabled: true,
            metricsInterval: 10000, // Less frequent monitoring
            optimization: {
                autoOptimization: false // Manual optimization in development
            }
        },
        memoryOptimization: {
            enabled: true,
            maxHeapUsage: 256 * 1024 * 1024, // 256MB
            strategies: {
                proactiveGC: false,
                leakDetection: true
            }
        },
        cacheOptimization: {
            enabled: true,
            memory: {
                maxSize: 50 * 1024 * 1024 // 50MB
            },
            disk: {
                enabled: false // No disk cache in development
            }
        },
        autoOptimization: false
    },

    /**
     * Production profile - full optimization for production
     */
    production: {
        performanceMonitoring: {
            enabled: true,
            metricsInterval: 5000,
            optimization: {
                autoOptimization: true
            },
            reporting: {
                enabled: true,
                detailed: true
            }
        },
        memoryOptimization: {
            enabled: true,
            maxHeapUsage: 1024 * 1024 * 1024, // 1GB
            strategies: {
                proactiveGC: true,
                smartEviction: true,
                memoryPooling: true,
                leakDetection: true
            }
        },
        cacheOptimization: {
            enabled: true,
            memory: {
                maxSize: 200 * 1024 * 1024 // 200MB
            },
            disk: {
                enabled: true,
                maxSize: 2 * 1024 * 1024 * 1024 // 2GB
            },
            strategies: {
                predictiveWarming: true,
                patternBasedWarming: true,
                timeBasedWarming: true,
                dependencyWarming: true
            }
        },
        autoOptimization: true,
        aggressiveOptimization: false
    },

    /**
     * High-performance profile - maximum optimization
     */
    highPerformance: {
        performanceMonitoring: {
            enabled: true,
            metricsInterval: 2000, // Very frequent monitoring
            optimization: {
                autoOptimization: true
            }
        },
        memoryOptimization: {
            enabled: true,
            maxHeapUsage: 2 * 1024 * 1024 * 1024, // 2GB
            gcThreshold: 0.7, // More aggressive GC
            strategies: {
                proactiveGC: true,
                smartEviction: true,
                memoryPooling: true,
                leakDetection: true
            }
        },
        cacheOptimization: {
            enabled: true,
            memory: {
                maxSize: 500 * 1024 * 1024 // 500MB
            },
            disk: {
                enabled: true,
                maxSize: 5 * 1024 * 1024 * 1024 // 5GB
            },
            strategies: {
                predictiveWarming: true,
                patternBasedWarming: true,
                timeBasedWarming: true,
                dependencyWarming: true,
                adaptiveWarming: true
            }
        },
        autoOptimization: true,
        aggressiveOptimization: true
    }
};

export default OptimizationManager;