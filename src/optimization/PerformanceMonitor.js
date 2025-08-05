/**
 * CONTEXT: Comprehensive performance monitoring system for MCP server optimization
 * REASON: Real-time performance tracking and analysis to identify bottlenecks and optimization opportunities
 * CHANGE: Advanced performance monitoring with detailed metrics, alerting, and analytics
 * PREVENTION: Performance degradation, resource exhaustion, system failures, poor user experience
 */

import { EventEmitter } from 'events';
import { performance, PerformanceObserver } from 'perf_hooks';
import { promisify } from 'util';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export class PerformanceMonitor extends EventEmitter {
    constructor(config = {}) {
        super();
        
        this.config = {
            // Monitoring intervals
            metricsInterval: config.metricsInterval || 5000, // 5 seconds
            alertingInterval: config.alertingInterval || 10000, // 10 seconds
            cleanupInterval: config.cleanupInterval || 60000, // 1 minute
            
            // Data retention
            historyRetention: config.historyRetention || 24 * 60 * 60 * 1000, // 24 hours
            metricsRetention: config.metricsRetention || 7 * 24 * 60 * 60 * 1000, // 7 days
            
            // Alert thresholds
            alertThresholds: {
                responseTime: config.responseTimeThreshold || 2000, // 2 seconds
                memoryUsage: config.memoryThreshold || 500 * 1024 * 1024, // 500MB
                cpuUsage: config.cpuThreshold || 80, // 80%
                errorRate: config.errorRateThreshold || 0.05, // 5%
                concurrentRequests: config.concurrentRequestsThreshold || 100,
                diskUsage: config.diskThreshold || 80, // 80%
                cacheHitRate: config.cacheHitRateThreshold || 0.6, // 60%
                queryTime: config.queryTimeThreshold || 1000, // 1 second
                ...config.alertThresholds
            },
            
            // Performance optimization settings
            optimization: {
                autoOptimization: config.autoOptimization !== false,
                gcOptimization: config.gcOptimization !== false,
                cacheOptimization: config.cacheOptimization !== false,
                queryOptimization: config.queryOptimization !== false,
                ...config.optimization
            },
            
            // Reporting settings
            reporting: {
                generateReports: config.generateReports !== false,
                reportInterval: config.reportInterval || 60 * 60 * 1000, // 1 hour
                reportPath: config.reportPath || './reports',
                ...config.reporting
            }
        };
        
        // Performance metrics storage
        this.metrics = {
            // Request metrics
            requests: {
                total: 0,
                successful: 0,
                failed: 0,
                inProgress: 0,
                byTool: new Map(),
                byHandler: new Map(),
                responseTimeHistory: [],
                concurrentRequests: 0,
                peakConcurrentRequests: 0,
                averageResponseTime: 0,
                p95ResponseTime: 0,
                p99ResponseTime: 0
            },
            
            // System resource metrics
            resources: {
                memory: {
                    heapUsed: 0,
                    heapTotal: 0,
                    external: 0,
                    rss: 0,
                    history: [],
                    peak: 0,
                    growthRate: 0
                },
                cpu: {
                    usage: 0,
                    user: 0,
                    system: 0,
                    history: [],
                    peak: 0,
                    loadAverage: []
                },
                disk: {
                    usage: 0,
                    available: 0,
                    total: 0,
                    ioOperations: 0,
                    readThroughput: 0,
                    writeThroughput: 0
                },
                network: {
                    bytesIn: 0,
                    bytesOut: 0,
                    connectionsActive: 0,
                    connectionsPeak: 0
                }
            },
            
            // Database performance metrics
            database: {
                queryCount: 0,
                successfulQueries: 0,
                failedQueries: 0,
                averageQueryTime: 0,
                slowQueries: [],
                queryTypeStats: new Map(),
                connectionPoolStats: {
                    active: 0,
                    idle: 0,
                    waiting: 0,
                    peak: 0
                },
                indexHitRate: 0,
                transactionStats: {
                    total: 0,
                    committed: 0,
                    rolledBack: 0,
                    averageDuration: 0
                }
            },
            
            // Cache performance metrics
            cache: {
                hitRate: 0,
                missRate: 0,
                hitsByLayer: new Map(),
                evictions: 0,
                size: 0,
                maxSize: 0,
                averageAccessTime: 0,
                invalidations: 0,
                refreshes: 0
            },
            
            // Pattern detection metrics
            patterns: {
                detectionsPerSecond: 0,
                averageDetectionTime: 0,
                patternCacheHitRate: 0,
                analyzedFiles: 0,
                detectedPatterns: 0,
                complexityScore: 0
            },
            
            // System health metrics
            system: {
                uptime: 0,
                startTime: Date.now(),
                restarts: 0,
                errors: [],
                healthScore: 1.0,
                alerts: [],
                lastGC: null,
                gcStats: {
                    collections: 0,
                    totalTime: 0,
                    averageTime: 0
                }
            }
        };
        
        // Performance observer for timing measurements
        this.performanceObserver = null;
        this.monitoringIntervals = [];
        this.alertingRules = new Map();
        
        // Active operation tracking
        this.activeOperations = new Map();
        this.operationCounter = 0;
        
        // Performance analysis
        this.analysisEngine = new PerformanceAnalysisEngine(this);
        this.optimizationEngine = new OptimizationEngine(this);
        
        // Report generation
        this.reportGenerator = new ReportGenerator(this);
        
        this.initialized = false;
    }

    /**
     * Initialize performance monitoring system
     */
    async initialize() {
        if (this.initialized) return;
        
        try {
            logger.info('Initializing performance monitoring system', {
                config: this.config
            });
            
            // Setup performance observer
            await this.setupPerformanceObserver();
            
            // Start resource monitoring
            await this.startResourceMonitoring();
            
            // Setup alerting system
            await this.setupAlertingSystem();
            
            // Initialize analysis engine
            await this.analysisEngine.initialize();
            
            // Initialize optimization engine
            await this.optimizationEngine.initialize();
            
            // Setup report generation
            if (this.config.reporting.generateReports) {
                await this.setupReportGeneration();
            }
            
            // Start monitoring tasks
            this.startMonitoringTasks();
            
            this.initialized = true;
            this.emit('initialized');
            
            logger.info('Performance monitoring system initialized successfully');
            
        } catch (error) {
            logger.error('Failed to initialize performance monitoring:', error);
            throw error;
        }
    }

    /**
     * Setup performance observer for timing measurements
     */
    async setupPerformanceObserver() {
        try {
            this.performanceObserver = new PerformanceObserver((list) => {
                const entries = list.getEntries();
                for (const entry of entries) {
                    this.processPerformanceEntry(entry);
                }
            });
            
            this.performanceObserver.observe({ 
                entryTypes: ['measure', 'mark', 'navigation', 'resource', 'function'] 
            });
            
            logger.debug('Performance observer initialized');
            
        } catch (error) {
            logger.error('Failed to setup performance observer:', error);
            throw error;
        }
    }

    /**
     * Start system resource monitoring
     */
    async startResourceMonitoring() {
        // Memory monitoring
        const memoryMonitor = setInterval(() => {
            this.collectMemoryMetrics();
        }, this.config.metricsInterval);
        
        // CPU monitoring
        const cpuMonitor = setInterval(() => {
            this.collectCpuMetrics();
        }, this.config.metricsInterval);
        
        // Disk monitoring
        const diskMonitor = setInterval(() => {
            this.collectDiskMetrics().catch(error => {
                logger.error('Disk monitoring error:', error);
            });
        }, this.config.metricsInterval * 2); // Less frequent for disk
        
        // Network monitoring
        const networkMonitor = setInterval(() => {
            this.collectNetworkMetrics();
        }, this.config.metricsInterval);
        
        this.monitoringIntervals.push(
            memoryMonitor, 
            cpuMonitor, 
            diskMonitor, 
            networkMonitor
        );
        
        logger.debug('Resource monitoring started');
    }

    /**
     * Setup alerting system with configurable rules
     */
    async setupAlertingSystem() {
        // Memory usage alerting
        this.alertingRules.set('memory_usage', {
            check: () => {
                const memUsage = this.metrics.resources.memory.heapUsed;
                const threshold = this.config.alertThresholds.memoryUsage;
                
                return memUsage > threshold ? {
                    type: 'memory_high',
                    severity: memUsage > threshold * 1.2 ? 'critical' : 'warning',
                    value: memUsage,
                    threshold: threshold,
                    message: `Memory usage ${Math.round(memUsage / 1024 / 1024)}MB exceeds threshold ${Math.round(threshold / 1024 / 1024)}MB`
                } : null;
            },
            interval: this.config.alertingInterval
        });
        
        // Response time alerting
        this.alertingRules.set('response_time', {
            check: () => {
                const avgResponseTime = this.metrics.requests.averageResponseTime;
                const threshold = this.config.alertThresholds.responseTime;
                
                return avgResponseTime > threshold ? {
                    type: 'response_time_high',
                    severity: avgResponseTime > threshold * 2 ? 'critical' : 'warning',
                    value: avgResponseTime,
                    threshold: threshold,
                    message: `Average response time ${avgResponseTime}ms exceeds threshold ${threshold}ms`
                } : null;
            },
            interval: this.config.alertingInterval
        });
        
        // Error rate alerting
        this.alertingRules.set('error_rate', {
            check: () => {
                const total = this.metrics.requests.total;
                const failed = this.metrics.requests.failed;
                const errorRate = total > 0 ? failed / total : 0;
                const threshold = this.config.alertThresholds.errorRate;
                
                return errorRate > threshold ? {
                    type: 'error_rate_high',
                    severity: errorRate > threshold * 2 ? 'critical' : 'warning',
                    value: errorRate,
                    threshold: threshold,
                    message: `Error rate ${(errorRate * 100).toFixed(2)}% exceeds threshold ${(threshold * 100).toFixed(2)}%`
                } : null;
            },
            interval: this.config.alertingInterval
        });
        
        // CPU usage alerting
        this.alertingRules.set('cpu_usage', {
            check: () => {
                const cpuUsage = this.metrics.resources.cpu.usage;
                const threshold = this.config.alertThresholds.cpuUsage;
                
                return cpuUsage > threshold ? {
                    type: 'cpu_high',
                    severity: cpuUsage > threshold * 1.2 ? 'critical' : 'warning',
                    value: cpuUsage,
                    threshold: threshold,
                    message: `CPU usage ${cpuUsage.toFixed(2)}% exceeds threshold ${threshold}%`
                } : null;
            },
            interval: this.config.alertingInterval
        });
        
        // Cache hit rate alerting
        this.alertingRules.set('cache_hit_rate', {
            check: () => {
                const hitRate = this.metrics.cache.hitRate;
                const threshold = this.config.alertThresholds.cacheHitRate;
                
                return hitRate < threshold ? {
                    type: 'cache_hit_rate_low',
                    severity: hitRate < threshold * 0.5 ? 'critical' : 'warning',
                    value: hitRate,
                    threshold: threshold,
                    message: `Cache hit rate ${(hitRate * 100).toFixed(2)}% below threshold ${(threshold * 100).toFixed(2)}%`
                } : null;
            },
            interval: this.config.alertingInterval
        });
        
        // Database query time alerting
        this.alertingRules.set('query_time', {
            check: () => {
                const avgQueryTime = this.metrics.database.averageQueryTime;
                const threshold = this.config.alertThresholds.queryTime;
                
                return avgQueryTime > threshold ? {
                    type: 'query_time_high',
                    severity: avgQueryTime > threshold * 2 ? 'critical' : 'warning',
                    value: avgQueryTime,
                    threshold: threshold,
                    message: `Average query time ${avgQueryTime}ms exceeds threshold ${threshold}ms`
                } : null;
            },
            interval: this.config.alertingInterval
        });
        
        // Start alerting checks
        for (const [name, rule] of this.alertingRules) {
            const interval = setInterval(() => {
                try {
                    const alert = rule.check();
                    if (alert) {
                        this.handleAlert(alert);
                    }
                } catch (error) {
                    logger.error(`Alerting rule ${name} failed:`, error);
                }
            }, rule.interval);
            
            this.monitoringIntervals.push(interval);
        }
        
        logger.debug('Alerting system initialized');
    }

    /**
     * Setup report generation
     */
    async setupReportGeneration() {
        try {
            // Ensure reports directory exists
            await fs.mkdir(this.config.reporting.reportPath, { recursive: true });
            
            // Schedule periodic report generation
            const reportInterval = setInterval(() => {
                this.reportGenerator.generatePerformanceReport().catch(error => {
                    logger.error('Report generation failed:', error);
                });
            }, this.config.reporting.reportInterval);
            
            this.monitoringIntervals.push(reportInterval);
            
            logger.debug('Report generation scheduled');
            
        } catch (error) {
            logger.error('Failed to setup report generation:', error);
        }
    }

    /**
     * Start monitoring maintenance tasks
     */
    startMonitoringTasks() {
        // Cleanup old metrics
        const cleanupInterval = setInterval(() => {
            this.cleanupOldMetrics();
        }, this.config.cleanupInterval);
        
        // Update calculated metrics
        const calculationInterval = setInterval(() => {
            this.updateCalculatedMetrics();
        }, this.config.metricsInterval);
        
        // Run performance analysis
        const analysisInterval = setInterval(() => {
            this.analysisEngine.analyzePerformance().catch(error => {
                logger.error('Performance analysis failed:', error);
            });
        }, this.config.metricsInterval * 6); // Every 30 seconds
        
        // Run optimization if enabled
        if (this.config.optimization.autoOptimization) {
            const optimizationInterval = setInterval(() => {
                this.optimizationEngine.runOptimizations().catch(error => {
                    logger.error('Auto-optimization failed:', error);
                });
            }, this.config.metricsInterval * 12); // Every minute
        }
        
        this.monitoringIntervals.push(
            cleanupInterval,
            calculationInterval,
            analysisInterval
        );
        
        if (this.config.optimization.autoOptimization) {
            this.monitoringIntervals.push(optimizationInterval);
        }
    }

    /**
     * Start tracking an operation
     */
    startOperation(operationId, operationType, metadata = {}) {
        const operation = {
            id: operationId || `op_${++this.operationCounter}`,
            type: operationType,
            startTime: Date.now(),
            metadata: metadata
        };
        
        this.activeOperations.set(operation.id, operation);
        this.metrics.requests.inProgress++;
        this.metrics.requests.concurrentRequests++;
        
        if (this.metrics.requests.concurrentRequests > this.metrics.requests.peakConcurrentRequests) {
            this.metrics.requests.peakConcurrentRequests = this.metrics.requests.concurrentRequests;
        }
        
        // Mark performance timing
        performance.mark(`operation-start-${operation.id}`);
        
        this.emit('operationStart', operation);
        
        return operation.id;
    }

    /**
     * End tracking an operation
     */
    endOperation(operationId, success = true, result = null, error = null) {
        const operation = this.activeOperations.get(operationId);
        if (!operation) {
            logger.warn(`Attempted to end unknown operation: ${operationId}`);
            return;
        }
        
        const endTime = Date.now();
        const duration = endTime - operation.startTime;
        
        // Mark performance timing
        performance.mark(`operation-end-${operationId}`);
        performance.measure(`operation-${operationId}`, 
            `operation-start-${operationId}`, 
            `operation-end-${operationId}`
        );
        
        // Update metrics
        this.metrics.requests.total++;
        this.metrics.requests.inProgress--;
        this.metrics.requests.concurrentRequests--;
        
        if (success) {
            this.metrics.requests.successful++;
        } else {
            this.metrics.requests.failed++;
            
            // Track error
            this.metrics.system.errors.push({
                timestamp: endTime,
                operationId: operationId,
                operationType: operation.type,
                error: error?.message || 'Unknown error',
                duration: duration
            });
        }
        
        // Update operation type statistics
        if (!this.metrics.requests.byTool.has(operation.type)) {
            this.metrics.requests.byTool.set(operation.type, {
                count: 0,
                totalTime: 0,
                errors: 0,
                averageTime: 0,
                minTime: Infinity,
                maxTime: 0
            });
        }
        
        const toolStats = this.metrics.requests.byTool.get(operation.type);
        toolStats.count++;
        toolStats.totalTime += duration;
        toolStats.averageTime = toolStats.totalTime / toolStats.count;
        toolStats.minTime = Math.min(toolStats.minTime, duration);
        toolStats.maxTime = Math.max(toolStats.maxTime, duration);
        
        if (!success) {
            toolStats.errors++;
        }
        
        // Update response time history
        this.metrics.requests.responseTimeHistory.push({
            timestamp: endTime,
            operationId: operationId,
            operationType: operation.type,
            duration: duration,
            success: success
        });
        
        // Clean up
        this.activeOperations.delete(operationId);
        
        // Clean up performance marks
        performance.clearMarks(`operation-start-${operationId}`);
        performance.clearMarks(`operation-end-${operationId}`);
        
        const completedOperation = {
            ...operation,
            endTime: endTime,
            duration: duration,
            success: success,
            result: result,
            error: error
        };
        
        this.emit('operationEnd', completedOperation);
        
        return completedOperation;
    }

    /**
     * Track database query performance
     */
    trackDatabaseQuery(queryType, duration, success = true, metadata = {}) {
        this.metrics.database.queryCount++;
        
        if (success) {
            this.metrics.database.successfulQueries++;
        } else {
            this.metrics.database.failedQueries++;
        }
        
        // Update average query time
        const totalTime = this.metrics.database.averageQueryTime * (this.metrics.database.queryCount - 1) + duration;
        this.metrics.database.averageQueryTime = totalTime / this.metrics.database.queryCount;
        
        // Track slow queries
        if (duration > this.config.alertThresholds.queryTime) {
            this.metrics.database.slowQueries.push({
                timestamp: Date.now(),
                queryType: queryType,
                duration: duration,
                success: success,
                metadata: metadata
            });
            
            // Keep only recent slow queries
            if (this.metrics.database.slowQueries.length > 100) {
                this.metrics.database.slowQueries.shift();
            }
        }
        
        // Update query type statistics
        if (!this.metrics.database.queryTypeStats.has(queryType)) {
            this.metrics.database.queryTypeStats.set(queryType, {
                count: 0,
                totalTime: 0,
                averageTime: 0,
                errors: 0
            });
        }
        
        const typeStats = this.metrics.database.queryTypeStats.get(queryType);
        typeStats.count++;
        typeStats.totalTime += duration;
        typeStats.averageTime = typeStats.totalTime / typeStats.count;
        
        if (!success) {
            typeStats.errors++;
        }
        
        this.emit('databaseQuery', {
            queryType: queryType,
            duration: duration,
            success: success,
            metadata: metadata
        });
    }

    /**
     * Track cache performance
     */
    trackCacheOperation(operation, layer, hit, duration = 0) {
        if (operation === 'get') {
            if (hit) {
                this.metrics.cache.hitsByLayer.set(layer, 
                    (this.metrics.cache.hitsByLayer.get(layer) || 0) + 1);
            }
            
            // Update cache access time
            if (duration > 0) {
                this.metrics.cache.averageAccessTime = 
                    (this.metrics.cache.averageAccessTime + duration) / 2;
            }
        } else if (operation === 'evict') {
            this.metrics.cache.evictions++;
        } else if (operation === 'invalidate') {
            this.metrics.cache.invalidations++;
        } else if (operation === 'refresh') {
            this.metrics.cache.refreshes++;
        }
        
        this.emit('cacheOperation', {
            operation: operation,
            layer: layer,
            hit: hit,
            duration: duration
        });
    }

    /**
     * Track pattern detection performance
     */
    trackPatternDetection(fileCount, duration, patternsFound, complexity = 0) {
        const detectionsPerSecond = fileCount / (duration / 1000);
        
        // Update running averages
        this.metrics.patterns.detectionsPerSecond = 
            (this.metrics.patterns.detectionsPerSecond + detectionsPerSecond) / 2;
        
        this.metrics.patterns.averageDetectionTime = 
            (this.metrics.patterns.averageDetectionTime + duration) / 2;
        
        this.metrics.patterns.analyzedFiles += fileCount;
        this.metrics.patterns.detectedPatterns += patternsFound;
        
        if (complexity > 0) {
            this.metrics.patterns.complexityScore = 
                (this.metrics.patterns.complexityScore + complexity) / 2;
        }
        
        this.emit('patternDetection', {
            fileCount: fileCount,
            duration: duration,
            patternsFound: patternsFound,
            complexity: complexity
        });
    }

    /**
     * Collect memory metrics
     */
    collectMemoryMetrics() {
        const memUsage = process.memoryUsage();
        const timestamp = Date.now();
        
        // Update current metrics
        this.metrics.resources.memory.heapUsed = memUsage.heapUsed;
        this.metrics.resources.memory.heapTotal = memUsage.heapTotal;
        this.metrics.resources.memory.external = memUsage.external;
        this.metrics.resources.memory.rss = memUsage.rss;
        
        // Track peak usage
        if (memUsage.heapUsed > this.metrics.resources.memory.peak) {
            this.metrics.resources.memory.peak = memUsage.heapUsed;
        }
        
        // Add to history
        this.metrics.resources.memory.history.push({
            timestamp: timestamp,
            heapUsed: memUsage.heapUsed,
            heapTotal: memUsage.heapTotal,
            external: memUsage.external,
            rss: memUsage.rss
        });
        
        // Calculate growth rate
        if (this.metrics.resources.memory.history.length > 10) {
            const recent = this.metrics.resources.memory.history.slice(-10);
            const oldestMemory = recent[0].heapUsed;
            const newestMemory = recent[recent.length - 1].heapUsed;
            const timeSpan = recent[recent.length - 1].timestamp - recent[0].timestamp;
            
            this.metrics.resources.memory.growthRate = 
                (newestMemory - oldestMemory) / timeSpan; // bytes per ms
        }
        
        this.emit('memoryMetrics', this.metrics.resources.memory);
    }

    /**
     * Collect CPU metrics
     */
    collectCpuMetrics() {
        const startUsage = process.cpuUsage();
        const timestamp = Date.now();
        
        setTimeout(() => {
            const endUsage = process.cpuUsage(startUsage);
            const totalUsage = (endUsage.user + endUsage.system) / 1000; // Convert to ms
            const cpuPercent = (totalUsage / this.config.metricsInterval) * 100;
            
            // Update current metrics
            this.metrics.resources.cpu.usage = cpuPercent;
            this.metrics.resources.cpu.user = endUsage.user / 1000;
            this.metrics.resources.cpu.system = endUsage.system / 1000;
            
            // Track peak usage
            if (cpuPercent > this.metrics.resources.cpu.peak) {
                this.metrics.resources.cpu.peak = cpuPercent;
            }
            
            // Add to history
            this.metrics.resources.cpu.history.push({
                timestamp: timestamp,
                usage: cpuPercent,
                user: endUsage.user / 1000,
                system: endUsage.system / 1000
            });
            
            this.emit('cpuMetrics', this.metrics.resources.cpu);
            
        }, 100); // Sample for 100ms
    }

    /**
     * Collect disk metrics
     */
    async collectDiskMetrics() {
        try {
            // This is a simplified implementation
            // In a real-world scenario, you would use system-specific APIs
            // or libraries like 'systeminformation' for accurate disk metrics
            
            const stats = await fs.stat(process.cwd());
            
            // Placeholder metrics - implement actual disk monitoring
            this.metrics.resources.disk.usage = 0;
            this.metrics.resources.disk.available = 0;
            this.metrics.resources.disk.total = 0;
            
            this.emit('diskMetrics', this.metrics.resources.disk);
            
        } catch (error) {
            logger.debug('Failed to collect disk metrics:', error.message);
        }
    }

    /**
     * Collect network metrics
     */
    collectNetworkMetrics() {
        // Placeholder for network metrics
        // In a real implementation, you would track network I/O
        this.emit('networkMetrics', this.metrics.resources.network);
    }

    /**
     * Process performance observer entries
     */
    processPerformanceEntry(entry) {
        if (entry.entryType === 'measure' && entry.name.startsWith('operation-')) {
            const operationId = entry.name.split('-')[1];
            const duration = entry.duration;
            
            // This is handled in endOperation, but we can add additional processing here
            this.emit('performanceEntry', {
                operationId: operationId,
                duration: duration,
                entry: entry
            });
        }
    }

    /**
     * Handle alert notifications
     */
    handleAlert(alert) {
        // Add to alerts history
        this.metrics.system.alerts.push({
            timestamp: Date.now(),
            ...alert
        });
        
        // Keep only recent alerts
        if (this.metrics.system.alerts.length > 100) {
            this.metrics.system.alerts.shift();
        }
        
        // Log alert
        const logLevel = alert.severity === 'critical' ? 'error' : 'warn';
        logger[logLevel](`Performance alert: ${alert.message}`, alert);
        
        // Emit alert event
        this.emit('alert', alert);
        
        // Trigger auto-optimization if configured
        if (this.config.optimization.autoOptimization) {
            this.optimizationEngine.handleAlert(alert).catch(error => {
                logger.error('Auto-optimization after alert failed:', error);
            });
        }
    }

    /**
     * Update calculated metrics
     */
    updateCalculatedMetrics() {
        // Update system uptime
        this.metrics.system.uptime = Date.now() - this.metrics.system.startTime;
        
        // Calculate average response time
        if (this.metrics.requests.responseTimeHistory.length > 0) {
            const recentResponses = this.metrics.requests.responseTimeHistory
                .slice(-100); // Last 100 responses
            
            const sum = recentResponses.reduce((acc, resp) => acc + resp.duration, 0);
            this.metrics.requests.averageResponseTime = sum / recentResponses.length;
            
            // Calculate percentiles
            const sortedTimes = recentResponses
                .map(r => r.duration)
                .sort((a, b) => a - b);
            
            const p95Index = Math.floor(sortedTimes.length * 0.95);
            const p99Index = Math.floor(sortedTimes.length * 0.99);
            
            this.metrics.requests.p95ResponseTime = sortedTimes[p95Index] || 0;
            this.metrics.requests.p99ResponseTime = sortedTimes[p99Index] || 0;
        }
        
        // Calculate cache hit rate
        const totalHits = Array.from(this.metrics.cache.hitsByLayer.values())
            .reduce((sum, hits) => sum + hits, 0);
        const totalRequests = totalHits + this.metrics.cache.evictions + this.metrics.cache.invalidations;
        
        if (totalRequests > 0) {
            this.metrics.cache.hitRate = totalHits / totalRequests;
            this.metrics.cache.missRate = 1 - this.metrics.cache.hitRate;
        }
        
        // Calculate system health score
        this.calculateHealthScore();
        
        this.emit('metricsUpdated', this.metrics);
    }

    /**
     * Calculate overall system health score
     */
    calculateHealthScore() {
        let score = 1.0;
        const factors = [];
        
        // Memory usage factor (weight: 0.3)
        const memoryUsageRatio = this.metrics.resources.memory.heapUsed / 
            this.config.alertThresholds.memoryUsage;
        const memoryFactor = Math.max(0, 1 - memoryUsageRatio);
        factors.push({ factor: memoryFactor, weight: 0.3, name: 'memory' });
        
        // Response time factor (weight: 0.25)
        const responseTimeRatio = this.metrics.requests.averageResponseTime / 
            this.config.alertThresholds.responseTime;
        const responseTimeFactor = Math.max(0, 1 - responseTimeRatio);
        factors.push({ factor: responseTimeFactor, weight: 0.25, name: 'responseTime' });
        
        // Error rate factor (weight: 0.2)
        const errorRate = this.metrics.requests.total > 0 ? 
            this.metrics.requests.failed / this.metrics.requests.total : 0;
        const errorFactor = Math.max(0, 1 - (errorRate / this.config.alertThresholds.errorRate));
        factors.push({ factor: errorFactor, weight: 0.2, name: 'errorRate' });
        
        // Cache hit rate factor (weight: 0.15)
        const cacheHitFactor = this.metrics.cache.hitRate;
        factors.push({ factor: cacheHitFactor, weight: 0.15, name: 'cacheHitRate' });
        
        // CPU usage factor (weight: 0.1)
        const cpuUsageRatio = this.metrics.resources.cpu.usage / 
            this.config.alertThresholds.cpuUsage;
        const cpuFactor = Math.max(0, 1 - cpuUsageRatio);
        factors.push({ factor: cpuFactor, weight: 0.1, name: 'cpuUsage' });
        
        // Calculate weighted score
        score = factors.reduce((total, { factor, weight }) => 
            total + (factor * weight), 0);
        
        this.metrics.system.healthScore = Math.max(0, Math.min(1, score));
        
        this.emit('healthScoreUpdated', {
            score: this.metrics.system.healthScore,
            factors: factors
        });
    }

    /**
     * Clean up old metrics data
     */
    cleanupOldMetrics() {
        const cutoffTime = Date.now() - this.config.historyRetention;
        
        // Clean up response time history
        this.metrics.requests.responseTimeHistory = 
            this.metrics.requests.responseTimeHistory.filter(
                entry => entry.timestamp > cutoffTime
            );
        
        // Clean up memory history
        this.metrics.resources.memory.history = 
            this.metrics.resources.memory.history.filter(
                entry => entry.timestamp > cutoffTime
            );
        
        // Clean up CPU history
        this.metrics.resources.cpu.history = 
            this.metrics.resources.cpu.history.filter(
                entry => entry.timestamp > cutoffTime
            );
        
        // Clean up error history
        this.metrics.system.errors = 
            this.metrics.system.errors.filter(
                error => error.timestamp > cutoffTime
            );
        
        // Clean up alerts history
        this.metrics.system.alerts = 
            this.metrics.system.alerts.filter(
                alert => alert.timestamp > cutoffTime
            );
        
        // Clean up slow queries
        this.metrics.database.slowQueries = 
            this.metrics.database.slowQueries.filter(
                query => query.timestamp > cutoffTime
            );
    }

    /**
     * Get comprehensive performance report
     */
    getPerformanceReport() {
        return {
            timestamp: Date.now(),
            uptime: this.metrics.system.uptime,
            healthScore: this.metrics.system.healthScore,
            
            summary: {
                totalRequests: this.metrics.requests.total,
                successfulRequests: this.metrics.requests.successful,
                failedRequests: this.metrics.requests.failed,
                averageResponseTime: this.metrics.requests.averageResponseTime,
                p95ResponseTime: this.metrics.requests.p95ResponseTime,
                p99ResponseTime: this.metrics.requests.p99ResponseTime,
                concurrentRequests: this.metrics.requests.concurrentRequests,
                peakConcurrentRequests: this.metrics.requests.peakConcurrentRequests,
                errorRate: this.metrics.requests.total > 0 ? 
                    this.metrics.requests.failed / this.metrics.requests.total : 0
            },
            
            resources: {
                memory: {
                    current: this.metrics.resources.memory.heapUsed,
                    peak: this.metrics.resources.memory.peak,
                    growthRate: this.metrics.resources.memory.growthRate,
                    utilization: this.metrics.resources.memory.heapUsed / 
                        this.config.alertThresholds.memoryUsage
                },
                cpu: {
                    current: this.metrics.resources.cpu.usage,
                    peak: this.metrics.resources.cpu.peak,
                    utilization: this.metrics.resources.cpu.usage / 
                        this.config.alertThresholds.cpuUsage
                }
            },
            
            database: {
                totalQueries: this.metrics.database.queryCount,
                successfulQueries: this.metrics.database.successfulQueries,
                failedQueries: this.metrics.database.failedQueries,
                averageQueryTime: this.metrics.database.averageQueryTime,
                slowQueriesCount: this.metrics.database.slowQueries.length,
                queryTypes: Object.fromEntries(this.metrics.database.queryTypeStats)
            },
            
            cache: {
                hitRate: this.metrics.cache.hitRate,
                missRate: this.metrics.cache.missRate,
                averageAccessTime: this.metrics.cache.averageAccessTime,
                evictions: this.metrics.cache.evictions,
                invalidations: this.metrics.cache.invalidations,
                hitsByLayer: Object.fromEntries(this.metrics.cache.hitsByLayer)
            },
            
            patterns: {
                detectionsPerSecond: this.metrics.patterns.detectionsPerSecond,
                averageDetectionTime: this.metrics.patterns.averageDetectionTime,
                totalAnalyzedFiles: this.metrics.patterns.analyzedFiles,
                totalDetectedPatterns: this.metrics.patterns.detectedPatterns,
                complexityScore: this.metrics.patterns.complexityScore
            },
            
            operations: {
                byTool: Object.fromEntries(this.metrics.requests.byTool),
                activeOperations: this.activeOperations.size
            },
            
            alerts: {
                recent: this.metrics.system.alerts.slice(-10),
                totalAlerts: this.metrics.system.alerts.length
            },
            
            recommendations: this.analysisEngine.generateRecommendations()
        };
    }

    /**
     * Get current system status
     */
    getSystemStatus() {
        const healthScore = this.metrics.system.healthScore;
        let status = 'healthy';
        
        if (healthScore < 0.3) {
            status = 'critical';
        } else if (healthScore < 0.6) {
            status = 'warning';
        } else if (healthScore < 0.8) {
            status = 'degraded';
        }
        
        return {
            status: status,
            healthScore: healthScore,
            uptime: this.metrics.system.uptime,
            activeOperations: this.activeOperations.size,
            memoryUsage: this.metrics.resources.memory.heapUsed,
            cpuUsage: this.metrics.resources.cpu.usage,
            recentAlerts: this.metrics.system.alerts.slice(-5),
            lastUpdate: Date.now()
        };
    }

    /**
     * Reset all metrics
     */
    resetMetrics() {
        // Reset counters but preserve configuration
        this.metrics.requests.total = 0;
        this.metrics.requests.successful = 0;
        this.metrics.requests.failed = 0;
        this.metrics.requests.responseTimeHistory = [];
        
        this.metrics.database.queryCount = 0;
        this.metrics.database.successfulQueries = 0;
        this.metrics.database.failedQueries = 0;
        this.metrics.database.slowQueries = [];
        this.metrics.database.queryTypeStats.clear();
        
        this.metrics.cache.hitsByLayer.clear();
        this.metrics.cache.evictions = 0;
        this.metrics.cache.invalidations = 0;
        
        this.metrics.system.errors = [];
        this.metrics.system.alerts = [];
        this.metrics.system.startTime = Date.now();
        
        this.emit('metricsReset');
        
        logger.info('Performance metrics reset');
    }

    /**
     * Shutdown performance monitoring
     */
    async shutdown() {
        try {
            logger.info('Shutting down performance monitoring system');
            
            // Clear all intervals
            for (const interval of this.monitoringIntervals) {
                clearInterval(interval);
            }
            
            // Disconnect performance observer
            if (this.performanceObserver) {
                this.performanceObserver.disconnect();
            }
            
            // Shutdown sub-systems
            await this.analysisEngine.shutdown();
            await this.optimizationEngine.shutdown();
            
            // Generate final report if configured
            if (this.config.reporting.generateReports) {
                await this.reportGenerator.generateFinalReport();
            }
            
            this.initialized = false;
            this.emit('shutdown');
            
            logger.info('Performance monitoring system shutdown completed');
            
        } catch (error) {
            logger.error('Error during performance monitoring shutdown:', error);
            throw error;
        }
    }
}

/**
 * Performance Analysis Engine
 */
class PerformanceAnalysisEngine {
    constructor(monitor) {
        this.monitor = monitor;
        this.analysisHistory = [];
        this.patterns = new Map();
    }

    async initialize() {
        logger.debug('Performance analysis engine initialized');
    }

    async analyzePerformance() {
        const analysis = {
            timestamp: Date.now(),
            trends: this.analyzeTrends(),
            bottlenecks: this.identifyBottlenecks(),
            anomalies: this.detectAnomalies(),
            predictions: this.generatePredictions()
        };
        
        this.analysisHistory.push(analysis);
        
        // Keep only recent analyses
        if (this.analysisHistory.length > 100) {
            this.analysisHistory.shift();
        }
        
        this.monitor.emit('performanceAnalysis', analysis);
        
        return analysis;
    }

    analyzeTrends() {
        const metrics = this.monitor.metrics;
        const trends = {};
        
        // Memory usage trend
        if (metrics.resources.memory.history.length > 10) {
            const recent = metrics.resources.memory.history.slice(-10);
            const slope = this.calculateTrend(recent.map(h => h.heapUsed));
            trends.memoryUsage = slope > 0 ? 'increasing' : 'stable';
        }
        
        // Response time trend
        if (metrics.requests.responseTimeHistory.length > 10) {
            const recent = metrics.requests.responseTimeHistory.slice(-10);
            const slope = this.calculateTrend(recent.map(h => h.duration));
            trends.responseTime = slope > 0 ? 'degrading' : 'stable';
        }
        
        return trends;
    }

    identifyBottlenecks() {
        const metrics = this.monitor.metrics;
        const bottlenecks = [];
        
        // High memory usage
        if (metrics.resources.memory.heapUsed > 
            this.monitor.config.alertThresholds.memoryUsage * 0.8) {
            bottlenecks.push({
                type: 'memory',
                severity: 'high',
                description: 'Memory usage approaching limits'
            });
        }
        
        // Slow database queries
        if (metrics.database.averageQueryTime > 
            this.monitor.config.alertThresholds.queryTime * 0.8) {
            bottlenecks.push({
                type: 'database',
                severity: 'medium',
                description: 'Database queries running slowly'
            });
        }
        
        // Low cache hit rate
        if (metrics.cache.hitRate < 
            this.monitor.config.alertThresholds.cacheHitRate) {
            bottlenecks.push({
                type: 'cache',
                severity: 'medium',
                description: 'Low cache hit rate affecting performance'
            });
        }
        
        return bottlenecks;
    }

    detectAnomalies() {
        // Implement anomaly detection algorithms
        return [];
    }

    generatePredictions() {
        // Implement predictive analytics
        return {};
    }

    generateRecommendations() {
        const metrics = this.monitor.metrics;
        const recommendations = [];
        
        // Memory optimization recommendations
        if (metrics.resources.memory.heapUsed > 
            this.monitor.config.alertThresholds.memoryUsage * 0.7) {
            recommendations.push({
                type: 'memory',
                priority: 'high',
                description: 'High memory usage detected',
                suggestions: [
                    'Enable garbage collection optimization',
                    'Increase cache eviction rates',
                    'Review memory-intensive operations'
                ]
            });
        }
        
        // Performance optimization recommendations
        if (metrics.requests.averageResponseTime > 
            this.monitor.config.alertThresholds.responseTime * 0.7) {
            recommendations.push({
                type: 'performance',
                priority: 'medium',
                description: 'Response times approaching limits',
                suggestions: [
                    'Optimize database queries',
                    'Implement request caching',
                    'Enable query result caching'
                ]
            });
        }
        
        // Cache optimization recommendations
        if (metrics.cache.hitRate < 0.7) {
            recommendations.push({
                type: 'cache',
                priority: 'medium',
                description: 'Cache hit rate could be improved',
                suggestions: [
                    'Implement cache warming strategies',
                    'Review cache key design',
                    'Increase cache size limits'
                ]
            });
        }
        
        return recommendations;
    }

    calculateTrend(values) {
        if (values.length < 2) return 0;
        
        const n = values.length;
        const sumX = (n * (n - 1)) / 2;
        const sumY = values.reduce((sum, val) => sum + val, 0);
        const sumXY = values.reduce((sum, val, i) => sum + (i * val), 0);
        const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
        
        return (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    }

    async shutdown() {
        logger.debug('Performance analysis engine shutdown');
    }
}

/**
 * Optimization Engine
 */
class OptimizationEngine {
    constructor(monitor) {
        this.monitor = monitor;
        this.optimizations = new Map();
        this.isOptimizing = false;
    }

    async initialize() {
        // Setup optimization strategies
        this.optimizations.set('memory', this.optimizeMemory.bind(this));
        this.optimizations.set('cache', this.optimizeCache.bind(this));
        this.optimizations.set('database', this.optimizeDatabase.bind(this));
        
        logger.debug('Optimization engine initialized');
    }

    async runOptimizations() {
        if (this.isOptimizing) return;
        
        this.isOptimizing = true;
        
        try {
            const metrics = this.monitor.metrics;
            const optimizations = [];
            
            // Check if memory optimization is needed
            if (metrics.resources.memory.heapUsed > 
                this.monitor.config.alertThresholds.memoryUsage * 0.8) {
                optimizations.push('memory');
            }
            
            // Check if cache optimization is needed
            if (metrics.cache.hitRate < 0.6) {
                optimizations.push('cache');
            }
            
            // Check if database optimization is needed
            if (metrics.database.averageQueryTime > 
                this.monitor.config.alertThresholds.queryTime * 0.8) {
                optimizations.push('database');
            }
            
            // Run optimizations
            for (const optimization of optimizations) {
                const optimizeFunc = this.optimizations.get(optimization);
                if (optimizeFunc) {
                    await optimizeFunc();
                }
            }
            
        } finally {
            this.isOptimizing = false;
        }
    }

    async handleAlert(alert) {
        // Handle specific alerts with targeted optimizations
        switch (alert.type) {
            case 'memory_high':
                await this.optimizeMemory();
                break;
            case 'cache_hit_rate_low':
                await this.optimizeCache();
                break;
            case 'query_time_high':
                await this.optimizeDatabase();
                break;
        }
    }

    async optimizeMemory() {
        logger.info('Running memory optimization');
        
        // Force garbage collection if available
        if (global.gc && this.monitor.config.optimization.gcOptimization) {
            global.gc();
            logger.debug('Forced garbage collection');
        }
        
        this.monitor.emit('optimization', {
            type: 'memory',
            action: 'garbage_collection',
            timestamp: Date.now()
        });
    }

    async optimizeCache() {
        logger.info('Running cache optimization');
        
        // Implement cache optimization logic
        this.monitor.emit('optimization', {
            type: 'cache',
            action: 'eviction',
            timestamp: Date.now()
        });
    }

    async optimizeDatabase() {
        logger.info('Running database optimization');
        
        // Implement database optimization logic
        this.monitor.emit('optimization', {
            type: 'database',
            action: 'query_optimization',
            timestamp: Date.now()
        });
    }

    async shutdown() {
        logger.debug('Optimization engine shutdown');
    }
}

/**
 * Report Generator
 */
class ReportGenerator {
    constructor(monitor) {
        this.monitor = monitor;
    }

    async generatePerformanceReport() {
        const report = this.monitor.getPerformanceReport();
        const timestamp = new Date().toISOString();
        const filename = `performance-report-${timestamp.replace(/[:.]/g, '-')}.json`;
        const filepath = path.join(this.monitor.config.reporting.reportPath, filename);
        
        try {
            await fs.writeFile(filepath, JSON.stringify(report, null, 2));
            logger.debug(`Performance report generated: ${filepath}`);
            
            this.monitor.emit('reportGenerated', {
                type: 'performance',
                filepath: filepath,
                timestamp: Date.now()
            });
            
        } catch (error) {
            logger.error('Failed to generate performance report:', error);
        }
    }

    async generateFinalReport() {
        const finalReport = {
            ...this.monitor.getPerformanceReport(),
            sessionSummary: {
                totalUptime: this.monitor.metrics.system.uptime,
                finalHealthScore: this.monitor.metrics.system.healthScore,
                totalAlerts: this.monitor.metrics.system.alerts.length,
                totalOptimizations: 0 // Would track optimizations
            }
        };
        
        const filename = `final-performance-report-${Date.now()}.json`;
        const filepath = path.join(this.monitor.config.reporting.reportPath, filename);
        
        try {
            await fs.writeFile(filepath, JSON.stringify(finalReport, null, 2));
            logger.info(`Final performance report generated: ${filepath}`);
            
        } catch (error) {
            logger.error('Failed to generate final performance report:', error);
        }
    }
}

export default PerformanceMonitor;