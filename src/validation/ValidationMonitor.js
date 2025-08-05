import { logger } from '../utils/logger.js';

/**
 * CONTEXT: Comprehensive monitoring and logging system for validation operations
 * REASON: Provide detailed insights into validation performance, security events, and system health
 * CHANGE: Real-time monitoring, alerting, and comprehensive validation event logging
 * PREVENTION: Undetected security threats, performance degradation, and validation failures
 */

export class ValidationMonitor {
  constructor(config = {}) {
    this.config = {
      enableRealTimeMonitoring: config.enableRealTimeMonitoring !== false,
      enableAlerting: config.enableAlerting !== false,
      enableMetricsCollection: config.enableMetricsCollection !== false,
      metricsRetentionPeriod: config.metricsRetentionPeriod || 24 * 60 * 60 * 1000, // 24 hours
      alertThresholds: {
        errorRate: config.alertThresholds?.errorRate || 10, // 10%
        avgResponseTime: config.alertThresholds?.avgResponseTime || 2000, // 2 seconds
        securityThreatCount: config.alertThresholds?.securityThreatCount || 5,
        memoryUsage: config.alertThresholds?.memoryUsage || 80, // 80%
        ...config.alertThresholds
      },
      ...config
    };

    // Event storage
    this.events = [];
    this.metrics = new Map();
    this.alerts = [];
    this.securityEvents = [];
    
    // Real-time tracking
    this.currentMetrics = {
      validationCount: 0,
      errorCount: 0,
      warningCount: 0,
      securityThreatCount: 0,
      performanceIssueCount: 0,
      avgResponseTime: 0,
      totalResponseTime: 0,
      lastResetTime: Date.now()
    };

    // Event listeners
    this.eventListeners = new Map();
    this.alertHandlers = new Map();

    // Initialize monitoring
    this.initializeEventListeners();
    this.initializeAlertHandlers();
    this.setupPeriodicTasks();

    logger.info('ValidationMonitor initialized', {
      enableRealTimeMonitoring: this.config.enableRealTimeMonitoring,
      enableAlerting: this.config.enableAlerting,
      metricsRetentionHours: this.config.metricsRetentionPeriod / (60 * 60 * 1000)
    });
  }

  /**
   * Record validation event
   */
  recordValidationEvent(toolName, event) {
    const validationEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      toolName,
      type: 'validation',
      ...event
    };

    // Store event
    this.events.push(validationEvent);
    
    // Update real-time metrics
    this.updateRealTimeMetrics(validationEvent);
    
    // Check for alerts
    if (this.config.enableAlerting) {
      this.checkAlertConditions(validationEvent);
    }
    
    // Emit event to listeners
    this.emitEvent('validation', validationEvent);
    
    // Log based on severity
    this.logEvent(validationEvent);
    
    // Cleanup old events
    this.cleanupOldEvents();
  }

  /**
   * Record security event
   */
  recordSecurityEvent(toolName, securityData) {
    const securityEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      toolName,
      type: 'security',
      threatLevel: securityData.threatLevel || 'UNKNOWN',
      detectedThreats: securityData.detectedThreats || [],
      blocked: securityData.blocked || false,
      ...securityData
    };

    // Store security event
    this.securityEvents.push(securityEvent);
    this.events.push(securityEvent);
    
    // Update metrics
    this.currentMetrics.securityThreatCount++;
    
    // Critical security events trigger immediate alerts
    if (securityEvent.threatLevel === 'CRITICAL' || securityEvent.threatLevel === 'HIGH') {
      this.triggerSecurityAlert(securityEvent);
    }
    
    // Emit event
    this.emitEvent('security', securityEvent);
    
    // Log security event
    this.logSecurityEvent(securityEvent);
  }

  /**
   * Record performance event
   */
  recordPerformanceEvent(toolName, performanceData) {
    const performanceEvent = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      toolName,
      type: 'performance',
      responseTime: performanceData.responseTime,
      memoryUsage: performanceData.memoryUsage,
      cacheHit: performanceData.cacheHit || false,
      ...performanceData
    };

    // Store event
    this.events.push(performanceEvent);
    
    // Update metrics
    if (performanceData.responseTime > this.config.alertThresholds.avgResponseTime) {
      this.currentMetrics.performanceIssueCount++;
    }
    
    // Check performance alerts
    if (this.config.enableAlerting) {
      this.checkPerformanceAlerts(performanceEvent);
    }
    
    // Emit event
    this.emitEvent('performance', performanceEvent);
  }

  /**
   * Update real-time metrics
   */
  updateRealTimeMetrics(event) {
    this.currentMetrics.validationCount++;
    
    if (event.errors && event.errors.length > 0) {
      this.currentMetrics.errorCount++;
    }
    
    if (event.warnings && event.warnings.length > 0) {
      this.currentMetrics.warningCount++;
    }
    
    if (event.responseTime) {
      this.currentMetrics.totalResponseTime += event.responseTime;
      this.currentMetrics.avgResponseTime = 
        this.currentMetrics.totalResponseTime / this.currentMetrics.validationCount;
    }
  }

  /**
   * Check alert conditions
   */
  checkAlertConditions(event) {
    // Error rate alert
    const errorRate = (this.currentMetrics.errorCount / this.currentMetrics.validationCount) * 100;
    if (errorRate > this.config.alertThresholds.errorRate) {
      this.triggerAlert('high_error_rate', {
        currentRate: errorRate,
        threshold: this.config.alertThresholds.errorRate,
        details: `Error rate ${errorRate.toFixed(2)}% exceeds threshold ${this.config.alertThresholds.errorRate}%`
      });
    }
    
    // Response time alert
    if (event.responseTime > this.config.alertThresholds.avgResponseTime) {
      this.triggerAlert('slow_response', {
        responseTime: event.responseTime,
        threshold: this.config.alertThresholds.avgResponseTime,
        toolName: event.toolName,
        details: `Slow validation response: ${event.responseTime}ms`
      });
    }
    
    // Security threat count alert
    if (this.currentMetrics.securityThreatCount > this.config.alertThresholds.securityThreatCount) {
      this.triggerAlert('security_threat_surge', {
        currentCount: this.currentMetrics.securityThreatCount,
        threshold: this.config.alertThresholds.securityThreatCount,
        details: `Security threat count exceeded threshold`
      });
    }
  }

  /**
   * Check performance-specific alerts
   */
  checkPerformanceAlerts(event) {
    // Memory usage alert
    if (event.memoryUsage) {
      const memoryUsageMB = event.memoryUsage / (1024 * 1024);
      const memoryUsagePercent = (event.memoryUsage / (process.memoryUsage().heapTotal)) * 100;
      
      if (memoryUsagePercent > this.config.alertThresholds.memoryUsage) {
        this.triggerAlert('high_memory_usage', {
          memoryUsageMB: memoryUsageMB.toFixed(2),
          memoryUsagePercent: memoryUsagePercent.toFixed(2),
          threshold: this.config.alertThresholds.memoryUsage,
          details: `Memory usage ${memoryUsagePercent.toFixed(2)}% exceeds threshold`
        });
      }
    }
  }

  /**
   * Trigger security alert
   */
  triggerSecurityAlert(securityEvent) {
    const alert = {
      id: this.generateEventId(),
      timestamp: Date.now(),
      type: 'security_alert',
      severity: this.mapThreatLevelToSeverity(securityEvent.threatLevel),
      toolName: securityEvent.toolName,
      threatLevel: securityEvent.threatLevel,
      detectedThreats: securityEvent.detectedThreats,
      details: `Security threat detected: ${securityEvent.threatLevel}`,
      actionRequired: true
    };

    this.triggerAlert('security_threat', alert);
    
    // Log critical security alert
    logger.error('SECURITY ALERT', {
      alertId: alert.id,
      threatLevel: securityEvent.threatLevel,
      toolName: securityEvent.toolName,
      threats: securityEvent.detectedThreats
    });
  }

  /**
   * Trigger general alert
   */
  triggerAlert(alertType, alertData) {
    const alert = {
      id: alertData.id || this.generateEventId(),
      timestamp: Date.now(),
      type: alertType,
      severity: alertData.severity || 'MEDIUM',
      ...alertData
    };

    // Store alert
    this.alerts.push(alert);
    
    // Execute alert handlers
    const handlers = this.alertHandlers.get(alertType) || [];
    handlers.forEach(handler => {
      try {
        handler(alert);
      } catch (error) {
        logger.error('Alert handler failed', { alertType, error: error.message });
      }
    });
    
    // Emit alert event
    this.emitEvent('alert', alert);
    
    // Log alert
    logger.warn('Alert triggered', {
      alertId: alert.id,
      type: alertType,
      severity: alert.severity,
      details: alert.details
    });
  }

  /**
   * Generate comprehensive monitoring report
   */
  generateMonitoringReport(timeRange = 3600000) { // Default: 1 hour
    const cutoffTime = Date.now() - timeRange;
    const recentEvents = this.events.filter(event => event.timestamp > cutoffTime);
    
    const report = {
      timeRange: {
        start: new Date(cutoffTime).toISOString(),
        end: new Date().toISOString(),
        durationMs: timeRange
      },
      summary: this.generateSummaryStats(recentEvents),
      validation: this.generateValidationStats(recentEvents),
      security: this.generateSecurityStats(recentEvents),
      performance: this.generatePerformanceStats(recentEvents),
      alerts: this.generateAlertStats(recentEvents),
      trends: this.generateTrendAnalysis(recentEvents),
      recommendations: this.generateRecommendations(recentEvents)
    };

    return report;
  }

  /**
   * Generate summary statistics
   */
  generateSummaryStats(events) {
    const validationEvents = events.filter(e => e.type === 'validation');
    const securityEvents = events.filter(e => e.type === 'security');
    const performanceEvents = events.filter(e => e.type === 'performance');
    
    return {
      totalEvents: events.length,
      validationEvents: validationEvents.length,
      securityEvents: securityEvents.length,
      performanceEvents: performanceEvents.length,
      errorEvents: validationEvents.filter(e => e.errors && e.errors.length > 0).length,
      warningEvents: validationEvents.filter(e => e.warnings && e.warnings.length > 0).length,
      criticalSecurityEvents: securityEvents.filter(e => e.threatLevel === 'CRITICAL').length
    };
  }

  /**
   * Generate validation statistics
   */
  generateValidationStats(events) {
    const validationEvents = events.filter(e => e.type === 'validation');
    
    if (validationEvents.length === 0) {
      return { totalValidations: 0, errorRate: 0, toolBreakdown: {} };
    }
    
    const errorEvents = validationEvents.filter(e => e.errors && e.errors.length > 0);
    const toolBreakdown = {};
    
    validationEvents.forEach(event => {
      if (!toolBreakdown[event.toolName]) {
        toolBreakdown[event.toolName] = { total: 0, errors: 0, warnings: 0 };
      }
      toolBreakdown[event.toolName].total++;
      
      if (event.errors && event.errors.length > 0) {
        toolBreakdown[event.toolName].errors++;
      }
      
      if (event.warnings && event.warnings.length > 0) {
        toolBreakdown[event.toolName].warnings++;
      }
    });
    
    return {
      totalValidations: validationEvents.length,
      errorRate: (errorEvents.length / validationEvents.length * 100).toFixed(2) + '%',
      successRate: ((validationEvents.length - errorEvents.length) / validationEvents.length * 100).toFixed(2) + '%',
      toolBreakdown
    };
  }

  /**
   * Generate security statistics
   */
  generateSecurityStats(events) {
    const securityEvents = events.filter(e => e.type === 'security');
    
    if (securityEvents.length === 0) {
      return { totalSecurityEvents: 0, threatLevelBreakdown: {} };
    }
    
    const threatLevelBreakdown = {};
    const threatTypeBreakdown = {};
    
    securityEvents.forEach(event => {
      // Threat level breakdown
      const threatLevel = event.threatLevel || 'UNKNOWN';
      threatLevelBreakdown[threatLevel] = (threatLevelBreakdown[threatLevel] || 0) + 1;
      
      // Threat type breakdown
      if (event.detectedThreats) {
        event.detectedThreats.forEach(threat => {
          const threatType = threat.type || 'unknown';
          threatTypeBreakdown[threatType] = (threatTypeBreakdown[threatType] || 0) + 1;
        });
      }
    });
    
    return {
      totalSecurityEvents: securityEvents.length,
      threatLevelBreakdown,
      threatTypeBreakdown,
      blockedThreats: securityEvents.filter(e => e.blocked).length,
      criticalThreats: securityEvents.filter(e => e.threatLevel === 'CRITICAL').length
    };
  }

  /**
   * Generate performance statistics
   */
  generatePerformanceStats(events) {
    const performanceEvents = events.filter(e => e.type === 'performance');
    
    if (performanceEvents.length === 0) {
      return { totalPerformanceEvents: 0 };
    }
    
    const responseTimes = performanceEvents
      .filter(e => e.responseTime)
      .map(e => e.responseTime);
    
    if (responseTimes.length === 0) {
      return { totalPerformanceEvents: performanceEvents.length };
    }
    
    responseTimes.sort((a, b) => a - b);
    
    return {
      totalPerformanceEvents: performanceEvents.length,
      responseTimeStats: {
        avg: (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(2) + 'ms',
        min: responseTimes[0] + 'ms',
        max: responseTimes[responseTimes.length - 1] + 'ms',
        median: responseTimes[Math.floor(responseTimes.length / 2)] + 'ms',
        p95: responseTimes[Math.floor(responseTimes.length * 0.95)] + 'ms'
      },
      slowOperations: performanceEvents.filter(e => 
        e.responseTime > this.config.alertThresholds.avgResponseTime
      ).length,
      cacheHitRate: this.calculateCacheHitRate(performanceEvents)
    };
  }

  /**
   * Generate alert statistics
   */
  generateAlertStats(events) {
    const alertEvents = events.filter(e => e.type.includes('alert') || this.alerts.some(a => a.id === e.id));
    
    if (alertEvents.length === 0) {
      return { totalAlerts: 0 };
    }
    
    const severityBreakdown = {};
    const typeBreakdown = {};
    
    this.alerts.forEach(alert => {
      severityBreakdown[alert.severity] = (severityBreakdown[alert.severity] || 0) + 1;
      typeBreakdown[alert.type] = (typeBreakdown[alert.type] || 0) + 1;
    });
    
    return {
      totalAlerts: this.alerts.length,
      severityBreakdown,
      typeBreakdown,
      recentAlerts: this.alerts.slice(-5).map(alert => ({
        id: alert.id,
        type: alert.type,
        severity: alert.severity,
        timestamp: new Date(alert.timestamp).toISOString(),
        details: alert.details
      }))
    };
  }

  /**
   * Generate trend analysis
   */
  generateTrendAnalysis(events) {
    // Group events by hour for trend analysis
    const hourlyBreakdown = {};
    
    events.forEach(event => {
      const hour = new Date(event.timestamp).toISOString().substring(0, 13) + ':00:00.000Z';
      if (!hourlyBreakdown[hour]) {
        hourlyBreakdown[hour] = { total: 0, errors: 0, security: 0 };
      }
      
      hourlyBreakdown[hour].total++;
      
      if (event.type === 'validation' && event.errors && event.errors.length > 0) {
        hourlyBreakdown[hour].errors++;
      }
      
      if (event.type === 'security') {
        hourlyBreakdown[hour].security++;
      }
    });
    
    return {
      hourlyBreakdown,
      trends: this.analyzeTrends(hourlyBreakdown)
    };
  }

  /**
   * Generate recommendations based on monitoring data
   */
  generateRecommendations(events) {
    const recommendations = [];
    
    const validationEvents = events.filter(e => e.type === 'validation');
    const securityEvents = events.filter(e => e.type === 'security');
    const performanceEvents = events.filter(e => e.type === 'performance');
    
    // Validation recommendations
    if (validationEvents.length > 0) {
      const errorRate = (validationEvents.filter(e => e.errors && e.errors.length > 0).length / validationEvents.length) * 100;
      
      if (errorRate > 15) {
        recommendations.push({
          type: 'validation',
          priority: 'HIGH',
          message: 'High validation error rate detected',
          action: 'Review input validation schemas and error handling'
        });
      }
    }
    
    // Security recommendations
    if (securityEvents.length > 0) {
      const criticalThreats = securityEvents.filter(e => e.threatLevel === 'CRITICAL').length;
      
      if (criticalThreats > 0) {
        recommendations.push({
          type: 'security',
          priority: 'CRITICAL',
          message: `${criticalThreats} critical security threats detected`,
          action: 'Immediate security review and threat mitigation required'
        });
      }
    }
    
    // Performance recommendations
    if (performanceEvents.length > 0) {
      const slowOperations = performanceEvents.filter(e => 
        e.responseTime > this.config.alertThresholds.avgResponseTime
      ).length;
      
      if (slowOperations > performanceEvents.length * 0.2) {
        recommendations.push({
          type: 'performance',
          priority: 'MEDIUM',
          message: 'High number of slow validation operations',
          action: 'Consider optimization strategies or caching improvements'
        });
      }
    }
    
    return recommendations;
  }

  /**
   * Calculate cache hit rate from performance events
   */
  calculateCacheHitRate(performanceEvents) {
    const cacheableEvents = performanceEvents.filter(e => e.hasOwnProperty('cacheHit'));
    if (cacheableEvents.length === 0) return 'N/A';
    
    const cacheHits = cacheableEvents.filter(e => e.cacheHit).length;
    return ((cacheHits / cacheableEvents.length) * 100).toFixed(2) + '%';
  }

  /**
   * Analyze trends in hourly data
   */
  analyzeTrends(hourlyBreakdown) {
    const hours = Object.keys(hourlyBreakdown).sort();
    if (hours.length < 2) return {};
    
    const latest = hourlyBreakdown[hours[hours.length - 1]];
    const previous = hourlyBreakdown[hours[hours.length - 2]];
    
    return {
      totalEventsChange: this.calculatePercentageChange(previous.total, latest.total),
      errorEventsChange: this.calculatePercentageChange(previous.errors, latest.errors),
      securityEventsChange: this.calculatePercentageChange(previous.security, latest.security)
    };
  }

  /**
   * Calculate percentage change between two values
   */
  calculatePercentageChange(oldValue, newValue) {
    if (oldValue === 0) return newValue > 0 ? '+∞%' : '0%';
    const change = ((newValue - oldValue) / oldValue) * 100;
    return (change >= 0 ? '+' : '') + change.toFixed(1) + '%';
  }

  /**
   * Map threat level to alert severity
   */
  mapThreatLevelToSeverity(threatLevel) {
    const mapping = {
      'CRITICAL': 'CRITICAL',
      'HIGH': 'HIGH',
      'MEDIUM': 'MEDIUM',
      'LOW': 'LOW',
      'MINIMAL': 'LOW'
    };
    return mapping[threatLevel] || 'MEDIUM';
  }

  /**
   * Initialize event listeners
   */
  initializeEventListeners() {
    // Default event listener for logging
    this.addEventListener('validation', (event) => {
      if (event.errors && event.errors.length > 0) {
        logger.warn('Validation failed', {
          toolName: event.toolName,
          errors: event.errors,
          eventId: event.id
        });
      }
    });
    
    this.addEventListener('security', (event) => {
      logger.info('Security event recorded', {
        toolName: event.toolName,
        threatLevel: event.threatLevel,
        eventId: event.id
      });
    });
    
    this.addEventListener('performance', (event) => {
      if (event.responseTime > this.config.alertThresholds.avgResponseTime) {
        logger.debug('Slow validation detected', {
          toolName: event.toolName,
          responseTime: event.responseTime,
          eventId: event.id
        });
      }
    });
  }

  /**
   * Initialize alert handlers
   */
  initializeAlertHandlers() {
    // Default alert handler for logging
    this.addAlertHandler('security_threat', (alert) => {
      logger.error('Security threat alert', {
        alertId: alert.id,
        threatLevel: alert.threatLevel,
        toolName: alert.toolName
      });
    });
    
    this.addAlertHandler('high_error_rate', (alert) => {
      logger.warn('High error rate alert', {
        alertId: alert.id,
        currentRate: alert.currentRate,
        threshold: alert.threshold
      });
    });
  }

  /**
   * Setup periodic tasks
   */
  setupPeriodicTasks() {
    // Cleanup old events every hour
    setInterval(() => {
      this.cleanupOldEvents();
    }, 60 * 60 * 1000);
    
    // Reset current metrics every hour
    setInterval(() => {
      this.resetCurrentMetrics();
    }, 60 * 60 * 1000);
    
    // Generate hourly monitoring report
    setInterval(() => {
      const report = this.generateMonitoringReport(60 * 60 * 1000); // Last hour
      logger.info('Hourly monitoring report', { report });
    }, 60 * 60 * 1000);
  }

  /**
   * Utility methods
   */
  generateEventId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  cleanupOldEvents() {
    const cutoffTime = Date.now() - this.config.metricsRetentionPeriod;
    const initialCount = this.events.length;
    
    this.events = this.events.filter(event => event.timestamp > cutoffTime);
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoffTime);
    this.securityEvents = this.securityEvents.filter(event => event.timestamp > cutoffTime);
    
    const cleanedCount = initialCount - this.events.length;
    if (cleanedCount > 0) {
      logger.debug('Cleaned up old monitoring events', { cleanedCount });
    }
  }

  resetCurrentMetrics() {
    const oldMetrics = { ...this.currentMetrics };
    
    this.currentMetrics = {
      validationCount: 0,
      errorCount: 0,
      warningCount: 0,
      securityThreatCount: 0,
      performanceIssueCount: 0,
      avgResponseTime: 0,
      totalResponseTime: 0,
      lastResetTime: Date.now()
    };
    
    logger.info('Current metrics reset', { previousMetrics: oldMetrics });
  }

  logEvent(event) {
    if (event.errors && event.errors.length > 0) {
      logger.warn('Validation event with errors', {
        eventId: event.id,
        toolName: event.toolName,
        errorCount: event.errors.length
      });
    } else if (event.warnings && event.warnings.length > 0) {
      logger.info('Validation event with warnings', {
        eventId: event.id,
        toolName: event.toolName,
        warningCount: event.warnings.length
      });
    } else {
      logger.debug('Validation event recorded', {
        eventId: event.id,
        toolName: event.toolName
      });
    }
  }

  logSecurityEvent(event) {
    const logLevel = event.threatLevel === 'CRITICAL' || event.threatLevel === 'HIGH' ? 'error' : 'warn';
    
    logger[logLevel]('Security event', {
      eventId: event.id,
      toolName: event.toolName,
      threatLevel: event.threatLevel,
      threatCount: event.detectedThreats.length,
      blocked: event.blocked
    });
  }

  emitEvent(eventType, event) {
    const listeners = this.eventListeners.get(eventType) || [];
    listeners.forEach(listener => {
      try {
        listener(event);
      } catch (error) {
        logger.error('Event listener failed', { eventType, error: error.message });
      }
    });
  }

  addEventListener(eventType, listener) {
    if (!this.eventListeners.has(eventType)) {
      this.eventListeners.set(eventType, []);
    }
    this.eventListeners.get(eventType).push(listener);
  }

  addAlertHandler(alertType, handler) {
    if (!this.alertHandlers.has(alertType)) {
      this.alertHandlers.set(alertType, []);
    }
    this.alertHandlers.get(alertType).push(handler);
  }

  /**
   * Get current monitoring status
   */
  getMonitoringStatus() {
    return {
      isEnabled: this.config.enableRealTimeMonitoring,
      currentMetrics: this.currentMetrics,
      eventCounts: {
        totalEvents: this.events.length,
        securityEvents: this.securityEvents.length,
        alerts: this.alerts.length
      },
      configuration: this.config
    };
  }

  /**
   * Export monitoring data
   */
  exportMonitoringData(format = 'json') {
    const data = {
      exportTimestamp: new Date().toISOString(),
      events: this.events,
      alerts: this.alerts,
      securityEvents: this.securityEvents,
      currentMetrics: this.currentMetrics,
      configuration: this.config
    };

    if (format === 'json') {
      return JSON.stringify(data, null, 2);
    }

    return data;
  }
}

export default ValidationMonitor;