/**
 * CONTEXT: Health monitoring system for MCP server
 * REASON: Extract health monitoring logic from God class into focused component
 * CHANGE: Create dedicated class for system health monitoring and metrics
 * PREVENTION: Eliminates nested conditionals and centralizes health check logic
 */

import { logger } from '../utils/logger.js';

export class HealthMonitor {
  constructor(config = {}) {
    this.config = {
      checkInterval: config.checkInterval || 30000, // 30 seconds
      healthThresholds: {
        maxResponseTime: config.maxResponseTime || 5000,
        maxErrorRate: config.maxErrorRate || 0.1, // 10%
        maxValidationErrorRate: config.maxValidationErrorRate || 0.05 // 5%
      },
      ...config
    };
    
    this.metrics = {
      toolCalls: 0,
      errors: 0,
      totalResponseTime: 0,
      startTime: Date.now(),
      validationStats: {
        totalValidations: 0,
        validationErrors: 0,
        sanitizedInputs: 0
      }
    };

    this.healthHistory = [];
    this.alertsSent = new Set();
    this.monitoringActive = false;
    this.healthCheckInterval = null;
  }

  /**
   * Initialize health monitoring
   */
  initialize(dependencies = {}) {
    this.kuzu = dependencies.kuzu;
    this.validationSystem = dependencies.validationSystem;
    this.optimizationManager = dependencies.optimizationManager;
    
    logger.info('Health monitoring initialized', {
      checkInterval: this.config.checkInterval,
      thresholds: this.config.healthThresholds
    });
  }

  /**
   * Start health monitoring
   */
  startMonitoring() {
    if (this.monitoringActive) {
      logger.warn('Health monitoring already active');
      return;
    }

    this.monitoringActive = true;
    this.healthCheckInterval = setInterval(
      () => this.performHealthCheck(),
      this.config.checkInterval
    );
    
    logger.info('Health monitoring started');
  }

  /**
   * Stop health monitoring
   */
  stopMonitoring() {
    if (!this.monitoringActive) {
      return;
    }

    this.monitoringActive = false;
    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
      this.healthCheckInterval = null;
    }
    
    logger.info('Health monitoring stopped');
  }

  /**
   * Perform comprehensive health check
   */
  async performHealthCheck() {
    try {
      const healthStatus = await this.getComprehensiveHealth();
      
      // Store health history (keep last 100 entries)
      this.healthHistory.push({
        timestamp: Date.now(),
        status: healthStatus.status,
        metrics: healthStatus.metrics
      });
      
      if (this.healthHistory.length > 100) {
        this.healthHistory.shift();
      }

      // Check for alerts
      this.checkHealthAlerts(healthStatus);
      
      if (healthStatus.status !== 'healthy') {
        logger.warn('Health check warning:', healthStatus);
      }
      
    } catch (error) {
      logger.error('Health monitoring error:', error);
    }
  }

  /**
   * Get comprehensive server health status
   */
  async getComprehensiveHealth() {
    const healthComponents = await Promise.allSettled([
      this.getDatabaseHealth(),
      this.getValidationHealth(),
      this.getOptimizationHealth(),
      this.getSystemHealth()
    ]);

    const [dbHealth, validationHealth, optimizationHealth, systemHealth] = 
      healthComponents.map(result => 
        result.status === 'fulfilled' ? result.value : { status: 'error', error: result.reason }
      );

    // Determine overall status using early return pattern
    const overallStatus = this.determineOverallStatus([
      dbHealth, validationHealth, optimizationHealth, systemHealth
    ]);

    const uptime = Date.now() - this.metrics.startTime;
    const avgResponseTime = this.calculateAverageResponseTime();

    return {
      status: overallStatus.status,
      issues: overallStatus.issues,
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(uptime / 1000)}s`,
      components: {
        database: dbHealth,
        validation: validationHealth,
        optimization: optimizationHealth,
        system: systemHealth
      },
      metrics: {
        ...this.metrics,
        avgResponseTime: `${avgResponseTime.toFixed(2)}ms`,
        errorRate: this.calculateErrorRate(),
        validationErrorRate: this.calculateValidationErrorRate()
      }
    };
  }

  /**
   * Get database health using guard clauses
   */
  async getDatabaseHealth() {
    if (!this.kuzu) {
      return {
        status: 'unavailable',
        message: 'Database client not initialized'
      };
    }

    try {
      const dbMetrics = await this.kuzu.getHealthMetrics();
      
      if (!dbMetrics.isConnected) {
        return {
          status: 'unhealthy',
          message: 'Database connection failed',
          metrics: dbMetrics
        };
      }

      if (dbMetrics.queryErrors > 10) {
        return {
          status: 'degraded',
          message: 'High query error rate detected',
          metrics: dbMetrics
        };
      }

      return {
        status: 'healthy',
        message: 'Database operating normally',
        metrics: dbMetrics
      };

    } catch (error) {
      return {
        status: 'error',
        message: 'Health check failed',
        error: error.message
      };
    }
  }

  /**
   * Get validation system health
   */
  getValidationHealth() {
    if (!this.validationSystem) {
      return {
        status: 'disabled',
        message: 'Validation system not initialized'
      };
    }

    try {
      const validationMetrics = this.validationSystem.getSystemHealth();
      
      // Use guard clauses for status determination
      if (validationMetrics.status === 'unhealthy') {
        return {
          status: 'unhealthy',
          message: 'Validation system reporting unhealthy status',
          metrics: validationMetrics
        };
      }

      const errorRate = this.calculateValidationErrorRate();
      if (errorRate > this.config.healthThresholds.maxValidationErrorRate) {
        return {
          status: 'degraded',
          message: `High validation error rate: ${(errorRate * 100).toFixed(2)}%`,
          metrics: validationMetrics
        };
      }

      return {
        status: 'healthy',
        message: 'Validation system operating normally',
        metrics: validationMetrics
      };

    } catch (error) {
      return {
        status: 'error',
        message: 'Validation health check failed',
        error: error.message
      };
    }
  }

  /**
   * Get optimization system health
   */
  getOptimizationHealth() {
    if (!this.optimizationManager) {
      return {
        status: 'disabled',
        message: 'Optimization system not available'
      };
    }

    try {
      const optimizationReport = this.optimizationManager.getOptimizationReport();
      
      // Guard clause for failed optimizations
      if (optimizationReport.failedOptimizations > 5) {
        return {
          status: 'degraded',
          message: 'Multiple optimization failures detected',
          metrics: optimizationReport
        };
      }

      return {
        status: 'healthy',
        message: 'Optimization system operating normally',
        metrics: optimizationReport
      };

    } catch (error) {
      return {
        status: 'error',
        message: 'Optimization health check failed',
        error: error.message
      };
    }
  }

  /**
   * Get system health metrics
   */
  getSystemHealth() {
    const avgResponseTime = this.calculateAverageResponseTime();
    const errorRate = this.calculateErrorRate();
    
    // Use guard clauses for performance checks
    if (avgResponseTime > this.config.healthThresholds.maxResponseTime) {
      return {
        status: 'degraded',
        message: `High response times detected: ${avgResponseTime.toFixed(2)}ms`,
        metrics: { avgResponseTime, errorRate }
      };
    }

    if (errorRate > this.config.healthThresholds.maxErrorRate) {
      return {
        status: 'degraded',
        message: `High error rate detected: ${(errorRate * 100).toFixed(2)}%`,
        metrics: { avgResponseTime, errorRate }
      };
    }

    return {
      status: 'healthy',
      message: 'System performance within normal parameters',
      metrics: { avgResponseTime, errorRate }
    };
  }

  /**
   * Determine overall status using strategy pattern
   */
  determineOverallStatus(componentHealths) {
    const statusStrategies = {
      error: () => ({ status: 'unhealthy', priority: 4 }),
      unhealthy: () => ({ status: 'unhealthy', priority: 3 }),
      degraded: () => ({ status: 'degraded', priority: 2 }),
      disabled: () => ({ status: 'healthy', priority: 0 }), // Disabled components don't affect health
      healthy: () => ({ status: 'healthy', priority: 1 })
    };

    let worstStatus = 'healthy';
    let worstPriority = 0;
    const issues = [];

    for (const health of componentHealths) {
      const strategy = statusStrategies[health.status];
      if (!strategy) continue;

      const result = strategy();
      if (result.priority > worstPriority) {
        worstStatus = result.status;
        worstPriority = result.priority;
      }

      if (health.status !== 'healthy' && health.status !== 'disabled') {
        issues.push(health.message || `Component status: ${health.status}`);
      }
    }

    return { status: worstStatus, issues };
  }

  /**
   * Check for health alerts and send notifications
   */
  checkHealthAlerts(healthStatus) {
    const alertKey = `${healthStatus.status}_${Date.now() - (Date.now() % 300000)}`; // 5-minute windows
    
    if (this.alertsSent.has(alertKey)) {
      return; // Already sent alert for this time window
    }

    const alertStrategies = {
      unhealthy: () => this.sendAlert('CRITICAL', healthStatus),
      degraded: () => this.sendAlert('WARNING', healthStatus)
    };

    const alertStrategy = alertStrategies[healthStatus.status];
    if (alertStrategy) {
      alertStrategy();
      this.alertsSent.add(alertKey);
      
      // Clean up old alert keys (keep last 24 windows = 2 hours)
      if (this.alertsSent.size > 24) {
        const oldAlerts = Array.from(this.alertsSent).sort().slice(0, -24);
        oldAlerts.forEach(key => this.alertsSent.delete(key));
      }
    }
  }

  /**
   * Send health alert
   */
  sendAlert(level, healthStatus) {
    logger.warn(`Health alert [${level}]:`, {
      status: healthStatus.status,
      issues: healthStatus.issues,
      timestamp: healthStatus.timestamp,
      metrics: healthStatus.metrics
    });
    
    // Here you could integrate with external alerting systems
    // e.g., PagerDuty, Slack, email notifications
  }

  /**
   * Update metrics from tool execution
   */
  updateMetrics(metrics) {
    this.metrics.toolCalls += metrics.toolCalls || 0;
    this.metrics.errors += metrics.errors || 0;
    this.metrics.totalResponseTime += metrics.responseTime || 0;
    
    if (metrics.validationStats) {
      this.metrics.validationStats.totalValidations += metrics.validationStats.totalValidations || 0;
      this.metrics.validationStats.validationErrors += metrics.validationStats.validationErrors || 0;
      this.metrics.validationStats.sanitizedInputs += metrics.validationStats.sanitizedInputs || 0;
    }
  }

  /**
   * Calculate average response time using guard clause
   */
  calculateAverageResponseTime() {
    if (this.metrics.toolCalls === 0) {
      return 0;
    }
    return this.metrics.totalResponseTime / this.metrics.toolCalls;
  }

  /**
   * Calculate error rate using guard clause
   */
  calculateErrorRate() {
    if (this.metrics.toolCalls === 0) {
      return 0;
    }
    return this.metrics.errors / this.metrics.toolCalls;
  }

  /**
   * Calculate validation error rate using guard clause
   */
  calculateValidationErrorRate() {
    if (this.metrics.validationStats.totalValidations === 0) {
      return 0;
    }
    return this.metrics.validationStats.validationErrors / this.metrics.validationStats.totalValidations;
  }

  /**
   * Get health history for trend analysis
   */
  getHealthHistory(minutes = 30) {
    const cutoff = Date.now() - (minutes * 60 * 1000);
    return this.healthHistory.filter(entry => entry.timestamp > cutoff);
  }

  /**
   * Get current metrics snapshot
   */
  getMetricsSnapshot() {
    return {
      ...this.metrics,
      uptime: Date.now() - this.metrics.startTime,
      avgResponseTime: this.calculateAverageResponseTime(),
      errorRate: this.calculateErrorRate(),
      validationErrorRate: this.calculateValidationErrorRate(),
      timestamp: Date.now()
    };
  }

  /**
   * Reset metrics (useful for testing or periodic resets)
   */
  resetMetrics() {
    this.metrics = {
      toolCalls: 0,
      errors: 0,
      totalResponseTime: 0,
      startTime: Date.now(),
      validationStats: {
        totalValidations: 0,
        validationErrors: 0,
        sanitizedInputs: 0
      }
    };
    
    logger.info('Health metrics reset');
  }

  /**
   * Get health summary for dashboard/monitoring
   */
  getHealthSummary() {
    const recentHistory = this.getHealthHistory(30);
    const healthyCount = recentHistory.filter(h => h.status === 'healthy').length;
    const totalChecks = recentHistory.length;
    
    return {
      currentStatus: this.healthHistory.length > 0 
        ? this.healthHistory[this.healthHistory.length - 1].status 
        : 'unknown',
      availability: totalChecks > 0 ? ((healthyCount / totalChecks) * 100).toFixed(2) + '%' : '0%',
      uptime: Date.now() - this.metrics.startTime,
      totalToolCalls: this.metrics.toolCalls,
      currentErrorRate: (this.calculateErrorRate() * 100).toFixed(2) + '%',
      avgResponseTime: this.calculateAverageResponseTime().toFixed(2) + 'ms',
      lastHealthCheck: this.healthHistory.length > 0 
        ? new Date(this.healthHistory[this.healthHistory.length - 1].timestamp).toISOString()
        : null
    };
  }
}