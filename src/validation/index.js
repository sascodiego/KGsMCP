/**
 * CONTEXT: Comprehensive MCP input validation and sanitization system exports
 * REASON: Centralized export for all validation components
 * CHANGE: Single import point for validation system components
 * PREVENTION: Import inconsistencies and missing dependencies
 */

export { MCPInputValidator } from './MCPInputValidator.js';
export { ValidationMiddleware, ValidationError } from './ValidationMiddleware.js';
export { AdvancedValidators } from './AdvancedValidators.js';
export { PerformanceOptimizer } from './PerformanceOptimizer.js';
export { ValidationMonitor } from './ValidationMonitor.js';

/**
 * Validation system factory for easy initialization
 */
export class ValidationSystem {
  constructor(config = {}) {
    this.config = config;
    this.components = {};
    
    // Initialize components
    this.initializeComponents();
  }

  initializeComponents() {
    // Core validator
    this.components.inputValidator = new MCPInputValidator(this.config.inputValidator);
    
    // Advanced validators
    this.components.advancedValidators = new AdvancedValidators(this.config.advancedValidators);
    
    // Performance optimizer
    this.components.performanceOptimizer = new PerformanceOptimizer(this.config.performance);
    
    // Monitoring system
    this.components.monitor = new ValidationMonitor(this.config.monitoring);
    
    // Middleware (initialized with all components)
    this.components.middleware = new ValidationMiddleware({
      ...this.config.middleware,
      validatorConfig: this.config.inputValidator,
      performanceOptimizer: this.components.performanceOptimizer,
      monitor: this.components.monitor
    });
    
    // Setup inter-component communication
    this.setupComponentIntegration();
  }

  setupComponentIntegration() {
    // Integrate performance optimizer with middleware
    const originalWrap = this.components.middleware.wrap.bind(this.components.middleware);
    this.components.middleware.wrap = (handler, toolName, options = {}) => {
      const wrappedHandler = originalWrap(handler, toolName, options);
      
      return async (args, context = {}) => {
        const startTime = Date.now();
        
        try {
          // Use performance optimizer for validation
          const result = await this.components.performanceOptimizer.optimizeValidation(
            toolName,
            async (optimizedArgs) => wrappedHandler(optimizedArgs, context),
            args,
            { ...options, context }
          );
          
          const responseTime = Date.now() - startTime;
          
          // Record performance event
          this.components.monitor.recordPerformanceEvent(toolName, {
            responseTime,
            memoryUsage: process.memoryUsage().heapUsed,
            cacheHit: false // This would be determined by the optimizer
          });
          
          return result;
          
        } catch (error) {
          const responseTime = Date.now() - startTime;
          
          // Record validation event with error
          this.components.monitor.recordValidationEvent(toolName, {
            errors: [error.message],
            warnings: [],
            responseTime,
            success: false
          });
          
          throw error;
        }
      };
    };
    
    // Integrate monitor with input validator
    const originalValidate = this.components.inputValidator.validateToolInput.bind(this.components.inputValidator);
    this.components.inputValidator.validateToolInput = async (toolName, args, clientInfo = {}) => {
      const startTime = Date.now();
      
      try {
        const result = await originalValidate(toolName, args, clientInfo);
        const responseTime = Date.now() - startTime;
        
        // Record validation event
        this.components.monitor.recordValidationEvent(toolName, {
          ...result,
          responseTime,
          success: result.isValid
        });
        
        // Record security events if threats detected
        if (result.metadata && result.metadata.riskLevel && 
            ['HIGH', 'CRITICAL'].includes(result.metadata.riskLevel)) {
          this.components.monitor.recordSecurityEvent(toolName, {
            threatLevel: result.metadata.riskLevel,
            detectedThreats: result.errors || [],
            blocked: !result.isValid
          });
        }
        
        return result;
        
      } catch (error) {
        const responseTime = Date.now() - startTime;
        
        // Record failed validation
        this.components.monitor.recordValidationEvent(toolName, {
          errors: [error.message],
          warnings: [],
          responseTime,
          success: false
        });
        
        throw error;
      }
    };
  }

  /**
   * Get all validation components
   */
  getComponents() {
    return this.components;
  }

  /**
   * Get validation middleware (most commonly used)
   */
  getMiddleware() {
    return this.components.middleware;
  }

  /**
   * Get monitoring system
   */
  getMonitor() {
    return this.components.monitor;
  }

  /**
   * Get comprehensive system statistics
   */
  getSystemStatistics() {
    return {
      inputValidator: this.components.inputValidator.getStatistics(),
      middleware: this.components.middleware.getStatistics(),
      performanceOptimizer: this.components.performanceOptimizer.getStatistics(),
      advancedValidators: this.components.advancedValidators.getStatistics(),
      monitor: this.components.monitor.getMonitoringStatus()
    };
  }

  /**
   * Generate comprehensive system health report
   */
  getSystemHealth() {
    const middlewareHealth = this.components.middleware.getHealthStatus();
    const monitoringStatus = this.components.monitor.getMonitoringStatus();
    
    let overallStatus = 'healthy';
    const issues = [];
    const recommendations = [];
    
    // Check middleware health
    if (middlewareHealth.status === 'unhealthy') {
      overallStatus = 'unhealthy';
      issues.push('Validation middleware unhealthy');
      recommendations.push(...middlewareHealth.recommendations);
    } else if (middlewareHealth.status === 'degraded') {
      if (overallStatus === 'healthy') overallStatus = 'degraded';
      issues.push('Validation middleware degraded');
      recommendations.push(...middlewareHealth.recommendations);
    }
    
    // Check monitoring status
    if (!monitoringStatus.isEnabled) {
      if (overallStatus === 'healthy') overallStatus = 'degraded';
      issues.push('Real-time monitoring disabled');
      recommendations.push({
        type: 'monitoring',
        message: 'Enable real-time monitoring for better observability',
        priority: 'medium'
      });
    }
    
    return {
      status: overallStatus,
      issues,
      recommendations,
      components: {
        middleware: middlewareHealth,
        monitoring: monitoringStatus
      },
      statistics: this.getSystemStatistics()
    };
  }

  /**
   * Update system configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    // Update component configurations
    if (newConfig.inputValidator) {
      this.components.inputValidator.updateConfig(newConfig.inputValidator);
    }
    
    if (newConfig.middleware) {
      this.components.middleware.updateConfig(newConfig.middleware);
    }
    
    if (newConfig.performance) {
      this.components.performanceOptimizer.updateConfig(newConfig.performance);
    }
  }

  /**
   * Reset all system statistics
   */
  resetStatistics() {
    this.components.inputValidator.resetStatistics();
    this.components.middleware.resetStatistics();
    // Performance optimizer has its own cleanup schedule
    // Monitor has its own reset schedule
  }

  /**
   * Export system configuration and statistics
   */
  exportSystemData() {
    return {
      configuration: this.config,
      statistics: this.getSystemStatistics(),
      health: this.getSystemHealth(),
      monitoringData: this.components.monitor.exportMonitoringData()
    };
  }
}

export default ValidationSystem;