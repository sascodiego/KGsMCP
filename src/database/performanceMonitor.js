import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';
import fs from 'fs/promises';
import path from 'path';

/**
 * CONTEXT: Comprehensive performance monitoring and metrics system for Kuzu database
 * REASON: Track, analyze, and optimize database performance in real-time
 * CHANGE: Advanced monitoring with alerting, profiling, and automated optimization
 * PREVENTION: Performance degradation, resource waste, and system bottlenecks
 */

export class PerformanceMonitor extends EventEmitter {
  constructor(client, config = {}) {
    super();
    this.client = client;
    this.config = {
      enableRealTimeMonitoring: config.enableRealTimeMonitoring !== false,
      metricsRetentionDays: config.metricsRetentionDays || 30,
      samplingInterval: config.samplingInterval || 5000, // 5 seconds
      alertThresholds: {
        queryExecutionTime: config.alertThresholds?.queryExecutionTime || 10000, // 10s
        memoryUsage: config.alertThresholds?.memoryUsage || 80, // 80%
        errorRate: config.alertThresholds?.errorRate || 5, // 5%
        connectionPoolUsage: config.alertThresholds?.connectionPoolUsage || 90, // 90%
        ...config.alertThresholds
      },
      profileSlowQueries: config.profileSlowQueries !== false,
      slowQueryThreshold: config.slowQueryThreshold || 5000, // 5s
      maxMetricsInMemory: config.maxMetricsInMemory || 10000,
      enableMetricsPersistence: config.enableMetricsPersistence !== false,
      metricsFilePath: config.metricsFilePath || '.kg-context/logs/performance-metrics.jsonl',
      ...config
    };

    // Performance metrics storage
    this.metrics = {
      queries: new Map(),
      system: new Map(),
      connections: new Map(),
      caching: new Map(),
      transactions: new Map()
    };

    // Real-time statistics
    this.realtimeStats = {
      currentConnections: 0,
      activeQueries: 0,
      queriesPerSecond: 0,
      averageQueryTime: 0,
      errorRate: 0,
      cacheHitRate: 0,
      memoryUsage: 0,
      cpuUsage: 0
    };

    // Performance alerts
    this.alerts = new Map();
    this.alertHistory = [];

    // Query profiling
    this.queryProfiles = new Map();
    this.slowQueries = [];

    // Trend analysis
    this.trends = {
      queryTimes: [],
      errorRates: [],
      throughput: [],
      resourceUsage: []
    };

    this.startTime = Date.now();
    this.lastMetricsCleanup = Date.now();
    this.lastStatisticsUpdate = Date.now();

    this.initializeMonitoring();

    logger.info('PerformanceMonitor initialized', {
      samplingInterval: this.config.samplingInterval,
      slowQueryThreshold: this.config.slowQueryThreshold,
      enableRealTimeMonitoring: this.config.enableRealTimeMonitoring
    });
  }

  /**
   * Initialize monitoring systems
   */
  initializeMonitoring() {
    if (this.config.enableRealTimeMonitoring) {
      this.startRealTimeMonitoring();
    }

    // Set up periodic cleanup
    this.cleanupInterval = setInterval(() => {
      this.cleanupOldMetrics();
    }, 60000); // Every minute

    // Set up statistics update
    this.statsInterval = setInterval(() => {
      this.updateRealtimeStatistics();
    }, 1000); // Every second

    // Set up trend analysis
    this.trendInterval = setInterval(() => {
      this.updateTrendAnalysis();
    }, 60000); // Every minute

    // Listen to client events for automatic monitoring
    if (this.client && this.client.on) {
      this.client.on('queryExecuted', (event) => {
        this.recordQueryMetric(event);
      });

      this.client.on('queryError', (event) => {
        this.recordQueryError(event);
      });

      this.client.on('connected', () => {
        this.recordSystemEvent('connection_established');
      });

      this.client.on('disconnected', () => {
        this.recordSystemEvent('connection_lost');
      });
    }
  }

  /**
   * Start real-time monitoring
   */
  startRealTimeMonitoring() {
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.collectSystemMetrics();
        await this.checkAlertConditions();
        
        if (this.config.enableMetricsPersistence) {
          await this.persistMetrics();
        }

      } catch (error) {
        logger.error('Real-time monitoring error:', error.message);
      }
    }, this.config.samplingInterval);

    logger.debug('Real-time monitoring started', {
      interval: this.config.samplingInterval
    });
  }

  /**
   * Record query execution metrics
   */
  recordQueryMetric(queryEvent) {
    const timestamp = Date.now();
    const querySignature = this.generateQuerySignature(queryEvent.query);

    const metric = {
      timestamp,
      querySignature,
      query: queryEvent.query.substring(0, 200),
      executionTime: queryEvent.executionTime || 0,
      resultCount: queryEvent.resultCount || 0,
      success: true,
      parameters: Object.keys(queryEvent.parameters || {}).length,
      cacheHit: queryEvent.cacheHit || false,
      optimized: queryEvent.optimized || false
    };

    // Store in queries metrics
    if (!this.metrics.queries.has(querySignature)) {
      this.metrics.queries.set(querySignature, []);
    }
    
    const queryMetrics = this.metrics.queries.get(querySignature);
    queryMetrics.push(metric);

    // Limit memory usage
    if (queryMetrics.length > 1000) {
      queryMetrics.shift(); // Remove oldest
    }

    // Check for slow query
    if (queryEvent.executionTime > this.config.slowQueryThreshold) {
      this.recordSlowQuery(metric);
    }

    // Profile query if enabled
    if (this.config.profileSlowQueries && queryEvent.executionTime > this.config.slowQueryThreshold) {
      this.profileQuery(queryEvent);
    }

    // Update real-time stats
    this.realtimeStats.activeQueries = Math.max(0, this.realtimeStats.activeQueries);
    
    logger.debug('Query metric recorded', {
      querySignature: querySignature.substring(0, 50),
      executionTime: queryEvent.executionTime,
      resultCount: queryEvent.resultCount
    });

    this.emit('queryMetricRecorded', metric);
  }

  /**
   * Record query error
   */
  recordQueryError(errorEvent) {
    const timestamp = Date.now();
    const querySignature = this.generateQuerySignature(errorEvent.query);

    const errorMetric = {
      timestamp,
      querySignature,
      query: errorEvent.query.substring(0, 200),
      error: errorEvent.error.message,
      success: false,
      executionTime: 0,
      parameters: Object.keys(errorEvent.parameters || {}).length
    };

    // Store in queries metrics
    if (!this.metrics.queries.has(querySignature)) {
      this.metrics.queries.set(querySignature, []);
    }
    
    this.metrics.queries.get(querySignature).push(errorMetric);

    logger.debug('Query error recorded', {
      querySignature: querySignature.substring(0, 50),
      error: errorEvent.error.message
    });

    this.emit('queryErrorRecorded', errorMetric);
  }

  /**
   * Record system event
   */
  recordSystemEvent(eventType, data = {}) {
    const timestamp = Date.now();
    
    const systemMetric = {
      timestamp,
      eventType,
      data
    };

    if (!this.metrics.system.has(eventType)) {
      this.metrics.system.set(eventType, []);
    }
    
    this.metrics.system.get(eventType).push(systemMetric);

    logger.debug('System event recorded', { eventType, data });
    this.emit('systemEventRecorded', systemMetric);
  }

  /**
   * Collect system metrics
   */
  async collectSystemMetrics() {
    const timestamp = Date.now();
    
    try {
      // Memory usage
      const memoryUsage = process.memoryUsage();
      this.recordSystemMetric('memory', {
        timestamp,
        rss: memoryUsage.rss,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        usagePercentage: (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100
      });

      // CPU usage (approximation)
      const cpuUsage = process.cpuUsage();
      this.recordSystemMetric('cpu', {
        timestamp,
        user: cpuUsage.user,
        system: cpuUsage.system,
        total: cpuUsage.user + cpuUsage.system
      });

      // Database health metrics
      if (this.client && this.client.getHealthMetrics) {
        const dbHealth = await this.client.getHealthMetrics();
        this.recordSystemMetric('database_health', {
          timestamp,
          ...dbHealth
        });
      }

      // Event loop delay
      const eventLoopDelay = this.measureEventLoopDelay();
      this.recordSystemMetric('event_loop', {
        timestamp,
        delay: eventLoopDelay
      });

    } catch (error) {
      logger.error('Failed to collect system metrics:', error.message);
    }
  }

  /**
   * Record system metric
   */
  recordSystemMetric(metricType, data) {
    if (!this.metrics.system.has(metricType)) {
      this.metrics.system.set(metricType, []);
    }
    
    const metrics = this.metrics.system.get(metricType);
    metrics.push(data);

    // Limit memory usage
    if (metrics.length > this.config.maxMetricsInMemory) {
      metrics.shift();
    }
  }

  /**
   * Profile a slow query
   */
  async profileQuery(queryEvent) {
    try {
      const querySignature = this.generateQuerySignature(queryEvent.query);
      
      if (this.queryProfiles.has(querySignature)) {
        return; // Already profiled
      }

      // Execute EXPLAIN to get query plan
      const explainQuery = `EXPLAIN ${queryEvent.query}`;
      let executionPlan = null;

      try {
        const planResult = await this.client.query(explainQuery, queryEvent.parameters || {});
        executionPlan = planResult;
      } catch (error) {
        logger.debug('Failed to get execution plan:', error.message);
      }

      const profile = {
        querySignature,
        query: queryEvent.query,
        executionTime: queryEvent.executionTime,
        resultCount: queryEvent.resultCount,
        executionPlan,
        timestamp: Date.now(),
        optimizationSuggestions: this.generateOptimizationSuggestions(queryEvent)
      };

      this.queryProfiles.set(querySignature, profile);

      logger.debug('Query profiled', {
        querySignature: querySignature.substring(0, 50),
        executionTime: queryEvent.executionTime
      });

      this.emit('queryProfiled', profile);

    } catch (error) {
      logger.error('Query profiling failed:', error.message);
    }
  }

  /**
   * Record slow query
   */
  recordSlowQuery(metric) {
    this.slowQueries.push({
      ...metric,
      timestamp: Date.now()
    });

    // Limit slow queries history
    if (this.slowQueries.length > 1000) {
      this.slowQueries.shift();
    }

    // Trigger alert for very slow queries
    if (metric.executionTime > this.config.alertThresholds.queryExecutionTime) {
      this.triggerAlert('slow_query', {
        query: metric.query,
        executionTime: metric.executionTime,
        threshold: this.config.alertThresholds.queryExecutionTime
      });
    }

    this.emit('slowQueryDetected', metric);
  }

  /**
   * Update real-time statistics
   */
  updateRealtimeStatistics() {
    const now = Date.now();
    const lastMinute = now - 60000;

    // Calculate queries per second
    let recentQueries = 0;
    let totalExecutionTime = 0;
    let errorCount = 0;
    let cacheHits = 0;
    let totalQueries = 0;

    for (const queryMetrics of this.metrics.queries.values()) {
      const recentMetrics = queryMetrics.filter(m => m.timestamp > lastMinute);
      recentQueries += recentMetrics.length;
      
      for (const metric of recentMetrics) {
        totalQueries++;
        totalExecutionTime += metric.executionTime;
        
        if (!metric.success) {
          errorCount++;
        }
        
        if (metric.cacheHit) {
          cacheHits++;
        }
      }
    }

    this.realtimeStats.queriesPerSecond = recentQueries / 60;
    this.realtimeStats.averageQueryTime = totalQueries > 0 ? totalExecutionTime / totalQueries : 0;
    this.realtimeStats.errorRate = totalQueries > 0 ? (errorCount / totalQueries) * 100 : 0;
    this.realtimeStats.cacheHitRate = totalQueries > 0 ? (cacheHits / totalQueries) * 100 : 0;

    // Update memory usage
    const memoryMetrics = this.metrics.system.get('memory');
    if (memoryMetrics && memoryMetrics.length > 0) {
      const latestMemory = memoryMetrics[memoryMetrics.length - 1];
      this.realtimeStats.memoryUsage = latestMemory.usagePercentage;
    }

    this.lastStatisticsUpdate = now;
    this.emit('statisticsUpdated', this.realtimeStats);
  }

  /**
   * Update trend analysis
   */
  updateTrendAnalysis() {
    const now = Date.now();
    const lastHour = now - 3600000;

    // Query time trends
    const recentQueryTimes = [];
    for (const queryMetrics of this.metrics.queries.values()) {
      const recentMetrics = queryMetrics.filter(m => 
        m.timestamp > lastHour && m.success
      );
      
      for (const metric of recentMetrics) {
        recentQueryTimes.push(metric.executionTime);
      }
    }

    if (recentQueryTimes.length > 0) {
      const avgQueryTime = recentQueryTimes.reduce((a, b) => a + b, 0) / recentQueryTimes.length;
      this.trends.queryTimes.push({
        timestamp: now,
        value: avgQueryTime
      });
    }

    // Error rate trends
    const recentErrors = [];
    for (const queryMetrics of this.metrics.queries.values()) {
      const recentMetrics = queryMetrics.filter(m => m.timestamp > lastHour);
      const errorRate = recentMetrics.length > 0 ? 
        (recentMetrics.filter(m => !m.success).length / recentMetrics.length) * 100 : 0;
      
      if (recentMetrics.length > 0) {
        recentErrors.push(errorRate);
      }
    }

    if (recentErrors.length > 0) {
      const avgErrorRate = recentErrors.reduce((a, b) => a + b, 0) / recentErrors.length;
      this.trends.errorRates.push({
        timestamp: now,
        value: avgErrorRate
      });
    }

    // Limit trend data
    const maxTrendPoints = 1440; // 24 hours of minute data
    Object.values(this.trends).forEach(trend => {
      if (trend.length > maxTrendPoints) {
        trend.splice(0, trend.length - maxTrendPoints);
      }
    });

    this.emit('trendsUpdated', this.trends);
  }

  /**
   * Check alert conditions
   */
  async checkAlertConditions() {
    const thresholds = this.config.alertThresholds;

    // Check average query time
    if (this.realtimeStats.averageQueryTime > thresholds.queryExecutionTime) {
      this.triggerAlert('high_query_time', {
        current: this.realtimeStats.averageQueryTime,
        threshold: thresholds.queryExecutionTime
      });
    }

    // Check error rate
    if (this.realtimeStats.errorRate > thresholds.errorRate) {
      this.triggerAlert('high_error_rate', {
        current: this.realtimeStats.errorRate,
        threshold: thresholds.errorRate
      });
    }

    // Check memory usage
    if (this.realtimeStats.memoryUsage > thresholds.memoryUsage) {
      this.triggerAlert('high_memory_usage', {
        current: this.realtimeStats.memoryUsage,
        threshold: thresholds.memoryUsage
      });
    }

    // Check for performance degradation trends
    this.checkPerformanceTrends();
  }

  /**
   * Check performance trends for degradation
   */
  checkPerformanceTrends() {
    const recentTrends = this.trends.queryTimes.slice(-10); // Last 10 data points
    
    if (recentTrends.length >= 5) {
      const oldAvg = recentTrends.slice(0, 3).reduce((a, b) => a + b.value, 0) / 3;
      const newAvg = recentTrends.slice(-3).reduce((a, b) => a + b.value, 0) / 3;
      
      // Check for 50% increase in query times
      if (newAvg > oldAvg * 1.5) {
        this.triggerAlert('performance_degradation', {
          oldAverage: oldAvg,
          newAverage: newAvg,
          degradationPercentage: ((newAvg - oldAvg) / oldAvg) * 100
        });
      }
    }
  }

  /**
   * Trigger an alert
   */
  triggerAlert(alertType, data) {
    const alert = {
      id: this.generateAlertId(),
      type: alertType,
      severity: this.getAlertSeverity(alertType),
      message: this.generateAlertMessage(alertType, data),
      data,
      timestamp: Date.now(),
      acknowledged: false
    };

    // Check if similar alert exists recently
    const recentSimilarAlert = this.alertHistory
      .filter(a => a.type === alertType && (Date.now() - a.timestamp) < 300000) // 5 minutes
      .pop();

    if (recentSimilarAlert) {
      // Don't spam similar alerts
      return;
    }

    this.alerts.set(alert.id, alert);
    this.alertHistory.push(alert);

    // Limit alert history
    if (this.alertHistory.length > 1000) {
      this.alertHistory.shift();
    }

    logger.warn(`Performance alert triggered: ${alert.message}`, {
      alertId: alert.id,
      type: alertType,
      severity: alert.severity,
      data
    });

    this.emit('alertTriggered', alert);
  }

  /**
   * Get alert severity
   */
  getAlertSeverity(alertType) {
    const severityMap = {
      slow_query: 'MEDIUM',
      high_query_time: 'HIGH',
      high_error_rate: 'HIGH',
      high_memory_usage: 'HIGH',
      performance_degradation: 'CRITICAL',
      connection_pool_exhausted: 'CRITICAL'
    };

    return severityMap[alertType] || 'MEDIUM';
  }

  /**
   * Generate alert message
   */
  generateAlertMessage(alertType, data) {
    const messages = {
      slow_query: `Slow query detected: ${data.executionTime}ms (threshold: ${data.threshold}ms)`,
      high_query_time: `High average query time: ${data.current.toFixed(2)}ms (threshold: ${data.threshold}ms)`,
      high_error_rate: `High error rate: ${data.current.toFixed(2)}% (threshold: ${data.threshold}%)`,
      high_memory_usage: `High memory usage: ${data.current.toFixed(2)}% (threshold: ${data.threshold}%)`,
      performance_degradation: `Performance degradation detected: ${data.degradationPercentage.toFixed(2)}% increase in query times`,
      connection_pool_exhausted: 'Connection pool exhausted'
    };

    return messages[alertType] || `Alert: ${alertType}`;
  }

  /**
   * Generate optimization suggestions
   */
  generateOptimizationSuggestions(queryEvent) {
    const suggestions = [];

    // High execution time suggestions
    if (queryEvent.executionTime > 10000) {
      suggestions.push({
        type: 'performance',
        message: 'Consider adding indexes for frequently filtered fields',
        priority: 'HIGH'
      });

      suggestions.push({
        type: 'performance',
        message: 'Review query complexity and consider breaking into smaller operations',
        priority: 'MEDIUM'
      });
    }

    // Large result set suggestions
    if (queryEvent.resultCount > 10000) {
      suggestions.push({
        type: 'optimization',
        message: 'Consider adding LIMIT clause or pagination for large result sets',
        priority: 'MEDIUM'
      });
    }

    // Missing cache suggestions
    if (!queryEvent.cacheHit && queryEvent.executionTime > 1000) {
      suggestions.push({
        type: 'caching',
        message: 'Query could benefit from caching',
        priority: 'LOW'
      });
    }

    return suggestions;
  }

  /**
   * Get performance report
   */
  getPerformanceReport(timeRange = '1h') {
    const now = Date.now();
    const timeRanges = {
      '1h': 3600000,
      '6h': 21600000,
      '24h': 86400000,
      '7d': 604800000
    };
    
    const rangeMs = timeRanges[timeRange] || timeRanges['1h'];
    const startTime = now - rangeMs;

    // Collect metrics for the time range
    const report = {
      timeRange,
      startTime,
      endTime: now,
      summary: {
        totalQueries: 0,
        successfulQueries: 0,
        failedQueries: 0,
        averageQueryTime: 0,
        slowestQuery: null,
        fastestQuery: null,
        errorRate: 0,
        cacheHitRate: 0
      },
      topSlowQueries: [],
      topErrorQueries: [],
      systemMetrics: {
        averageMemoryUsage: 0,
        peakMemoryUsage: 0,
        averageCpuUsage: 0
      },
      alerts: this.alertHistory.filter(a => a.timestamp > startTime),
      trends: {
        queryTimes: this.trends.queryTimes.filter(t => t.timestamp > startTime),
        errorRates: this.trends.errorRates.filter(t => t.timestamp > startTime)
      }
    };

    // Process query metrics
    let totalExecutionTime = 0;
    let slowestTime = 0;
    let fastestTime = Infinity;
    let cacheHits = 0;
    const queryErrors = new Map();

    for (const [signature, queryMetrics] of this.metrics.queries) {
      const rangeMetrics = queryMetrics.filter(m => m.timestamp > startTime);
      
      for (const metric of rangeMetrics) {
        report.summary.totalQueries++;
        
        if (metric.success) {
          report.summary.successfulQueries++;
          totalExecutionTime += metric.executionTime;
          
          if (metric.executionTime > slowestTime) {
            slowestTime = metric.executionTime;
            report.summary.slowestQuery = {
              query: metric.query,
              executionTime: metric.executionTime,
              timestamp: metric.timestamp
            };
          }
          
          if (metric.executionTime < fastestTime) {
            fastestTime = metric.executionTime;
            report.summary.fastestQuery = {
              query: metric.query,
              executionTime: metric.executionTime,
              timestamp: metric.timestamp
            };
          }
          
          if (metric.cacheHit) {
            cacheHits++;
          }
        } else {
          report.summary.failedQueries++;
          
          if (!queryErrors.has(signature)) {
            queryErrors.set(signature, {
              query: metric.query,
              count: 0,
              lastError: null
            });
          }
          
          const errorInfo = queryErrors.get(signature);
          errorInfo.count++;
          errorInfo.lastError = metric.error;
        }
      }
    }

    // Calculate averages
    if (report.summary.successfulQueries > 0) {
      report.summary.averageQueryTime = totalExecutionTime / report.summary.successfulQueries;
      report.summary.cacheHitRate = (cacheHits / report.summary.successfulQueries) * 100;
    }

    if (report.summary.totalQueries > 0) {
      report.summary.errorRate = (report.summary.failedQueries / report.summary.totalQueries) * 100;
    }

    // Top slow queries
    report.topSlowQueries = this.slowQueries
      .filter(q => q.timestamp > startTime)
      .sort((a, b) => b.executionTime - a.executionTime)
      .slice(0, 10);

    // Top error queries
    report.topErrorQueries = Array.from(queryErrors.entries())
      .map(([signature, info]) => ({ signature, ...info }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // System metrics
    const memoryMetrics = this.metrics.system.get('memory') || [];
    const rangeMemoryMetrics = memoryMetrics.filter(m => m.timestamp > startTime);
    
    if (rangeMemoryMetrics.length > 0) {
      report.systemMetrics.averageMemoryUsage = 
        rangeMemoryMetrics.reduce((sum, m) => sum + m.usagePercentage, 0) / rangeMemoryMetrics.length;
      report.systemMetrics.peakMemoryUsage = 
        Math.max(...rangeMemoryMetrics.map(m => m.usagePercentage));
    }

    return report;
  }

  /**
   * Get real-time statistics
   */
  getRealTimeStatistics() {
    return {
      ...this.realtimeStats,
      uptime: Date.now() - this.startTime,
      lastUpdate: this.lastStatisticsUpdate,
      activeAlerts: this.alerts.size,
      totalSlowQueries: this.slowQueries.length
    };
  }

  /**
   * Clean up old metrics
   */
  cleanupOldMetrics() {
    const now = Date.now();
    const retentionMs = this.config.metricsRetentionDays * 24 * 60 * 60 * 1000;
    const cutoff = now - retentionMs;

    let cleanedCount = 0;

    // Clean up query metrics
    for (const [signature, metrics] of this.metrics.queries) {
      const filteredMetrics = metrics.filter(m => m.timestamp > cutoff);
      
      if (filteredMetrics.length === 0) {
        this.metrics.queries.delete(signature);
      } else {
        this.metrics.queries.set(signature, filteredMetrics);
      }
      
      cleanedCount += metrics.length - filteredMetrics.length;
    }

    // Clean up system metrics
    for (const [metricType, metrics] of this.metrics.system) {
      const filteredMetrics = metrics.filter(m => m.timestamp > cutoff);
      this.metrics.system.set(metricType, filteredMetrics);
      cleanedCount += metrics.length - filteredMetrics.length;
    }

    // Clean up alert history
    this.alertHistory = this.alertHistory.filter(a => a.timestamp > cutoff);

    // Clean up slow queries
    this.slowQueries = this.slowQueries.filter(q => q.timestamp > cutoff);

    if (cleanedCount > 0) {
      logger.debug('Metrics cleanup completed', {
        cleanedCount,
        retentionDays: this.config.metricsRetentionDays
      });
    }

    this.lastMetricsCleanup = now;
  }

  /**
   * Persist metrics to file
   */
  async persistMetrics() {
    if (!this.config.enableMetricsPersistence) {
      return;
    }

    try {
      const metricsData = {
        timestamp: Date.now(),
        realtimeStats: this.realtimeStats,
        systemMetrics: this.getLatestSystemMetrics(),
        activeAlerts: Array.from(this.alerts.values()),
        trends: this.trends
      };

      const metricsLine = JSON.stringify(metricsData) + '\n';
      
      // Ensure directory exists
      await fs.mkdir(path.dirname(this.config.metricsFilePath), { recursive: true });
      
      // Append to metrics file
      await fs.appendFile(this.config.metricsFilePath, metricsLine);

    } catch (error) {
      logger.error('Failed to persist metrics:', error.message);
    }
  }

  /**
   * Get latest system metrics
   */
  getLatestSystemMetrics() {
    const latest = {};
    
    for (const [metricType, metrics] of this.metrics.system) {
      if (metrics.length > 0) {
        latest[metricType] = metrics[metrics.length - 1];
      }
    }
    
    return latest;
  }

  /**
   * Measure event loop delay
   */
  measureEventLoopDelay() {
    const start = process.hrtime.bigint();
    
    setImmediate(() => {
      const delay = Number(process.hrtime.bigint() - start) / 1000000; // Convert to ms
      return delay;
    });
    
    return 0; // Simplified implementation
  }

  /**
   * Generate query signature
   */
  generateQuerySignature(query) {
    return query
      .replace(/\s+/g, ' ')
      .replace(/\$\w+/g, '$PARAM')
      .trim()
      .toLowerCase()
      .substring(0, 100);
  }

  /**
   * Generate alert ID
   */
  generateAlertId() {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Acknowledge alert
   */
  acknowledgeAlert(alertId) {
    const alert = this.alerts.get(alertId);
    
    if (alert) {
      alert.acknowledged = true;
      alert.acknowledgedAt = Date.now();
      
      logger.debug('Alert acknowledged', { alertId });
      this.emit('alertAcknowledged', alert);
      
      return true;
    }
    
    return false;
  }

  /**
   * Get active alerts
   */
  getActiveAlerts() {
    return Array.from(this.alerts.values()).filter(a => !a.acknowledged);
  }

  /**
   * Stop monitoring
   */
  stop() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
    }
    
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    
    if (this.statsInterval) {
      clearInterval(this.statsInterval);
    }
    
    if (this.trendInterval) {
      clearInterval(this.trendInterval);
    }

    logger.info('PerformanceMonitor stopped');
    this.emit('stopped');
  }
}

export default PerformanceMonitor;