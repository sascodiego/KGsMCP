import { logger } from '../utils/logger.js';
import { MCPInputValidator } from './MCPInputValidator.js';
import { PerformanceOptimizer } from './PerformanceOptimizer.js';
import { ValidationMonitor } from './ValidationMonitor.js';

/**
 * CONTEXT: Validation middleware for seamless integration with MCP server
 * REASON: Provide consistent validation across all MCP tool calls
 * CHANGE: Middleware layer that intercepts and validates all tool inputs
 * PREVENTION: Inconsistent validation, security vulnerabilities, and data corruption
 */

export class ValidationMiddleware {
  constructor(config = {}) {
    this.config = {
      enabled: config.enabled !== false,
      bypassValidation: config.bypassValidation || false,
      logValidationResults: config.logValidationResults !== false,
      throwOnValidationError: config.throwOnValidationError !== false,
      collectMetrics: config.collectMetrics !== false,
      ...config
    };

    this.validator = new MCPInputValidator(config.validatorConfig);
    
    // Initialize performance optimizer and monitor if provided
    this.performanceOptimizer = config.performanceOptimizer || 
      new PerformanceOptimizer(config.performanceConfig || {});
    this.monitor = config.monitor || 
      new ValidationMonitor(config.monitoringConfig || {});
    
    // Performance metrics
    this.metrics = {
      totalRequests: 0,
      validatedRequests: 0,
      bypassedRequests: 0,
      validationErrors: 0,
      averageValidationTime: 0,
      totalValidationTime: 0
    };

    // Tool-specific configurations
    this.toolConfigs = new Map();
    this.bypassList = new Set(config.bypassTools || []);
    this.strictModeTools = new Set(config.strictModeTools || []);

    logger.info('ValidationMiddleware initialized', {
      enabled: this.config.enabled,
      bypassValidation: this.config.bypassValidation,
      strictModeToolsCount: this.strictModeTools.size
    });
  }

  /**
   * Main middleware function to wrap MCP tool handlers
   */
  wrap(toolHandler, toolName, options = {}) {
    if (!this.config.enabled || this.config.bypassValidation) {
      return toolHandler;
    }

    return async (args, context = {}) => {
      const startTime = Date.now();
      this.metrics.totalRequests++;

      try {
        // Check if tool should bypass validation
        if (this.bypassList.has(toolName)) {
          this.metrics.bypassedRequests++;
          
          if (this.config.logValidationResults) {
            logger.debug('Validation bypassed for tool', { toolName });
          }
          
          return await toolHandler(args, context);
        }

        // Perform validation with performance optimization
        const validationResult = await this.performanceOptimizer.optimizeValidation(
          toolName,
          async (optimizedArgs) => this.validateInput(toolName, optimizedArgs, context, options),
          args,
          { ...options, context }
        );
        
        this.metrics.validatedRequests++;
        const validationTime = Date.now() - startTime;
        this.updateValidationMetrics(validationTime);
        
        // Record monitoring event
        this.monitor.recordValidationEvent(toolName, {
          ...validationResult,
          responseTime: validationTime,
          success: validationResult.isValid
        });

        // Handle validation failure
        if (!validationResult.isValid) {
          this.metrics.validationErrors++;
          
          if (this.config.logValidationResults) {
            logger.warn('Input validation failed', {
              toolName,
              errors: validationResult.errors,
              warnings: validationResult.warnings,
              riskLevel: validationResult.metadata.riskLevel
            });
          }

          if (this.config.throwOnValidationError || this.strictModeTools.has(toolName)) {
            const error = new ValidationError(
              `Input validation failed for ${toolName}`,
              validationResult.errors,
              validationResult.warnings,
              validationResult.metadata
            );
            throw error;
          }

          // Return validation error response in MCP format
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: 'Input validation failed',
                  toolName,
                  errors: validationResult.errors,
                  warnings: validationResult.warnings,
                  metadata: validationResult.metadata
                }, null, 2)
              }
            ]
          };
        }

        // Log successful validation
        if (this.config.logValidationResults && validationResult.warnings.length > 0) {
          logger.info('Input validation completed with warnings', {
            toolName,
            warnings: validationResult.warnings,
            sanitized: validationResult.sanitized,
            riskLevel: validationResult.metadata.riskLevel
          });
        }

        // Call original handler with validated/sanitized args
        const handlerStartTime = Date.now();
        const handlerResult = await toolHandler(validationResult.validatedArgs, {
          ...context,
          validation: {
            original: validationResult.originalArgs,
            sanitized: validationResult.sanitized,
            warnings: validationResult.warnings,
            metadata: validationResult.metadata
          }
        });
        
        // Record performance event for the handler execution
        const handlerTime = Date.now() - handlerStartTime;
        this.monitor.recordPerformanceEvent(toolName, {
          responseTime: handlerTime,
          memoryUsage: process.memoryUsage().heapUsed,
          cacheHit: false,
          handlerExecution: true
        });

        // Enhance result with validation metadata if requested
        if (options.includeValidationMetadata) {
          return this.enhanceResultWithValidationMetadata(handlerResult, validationResult);
        }

        return handlerResult;

      } catch (error) {
        const validationTime = Date.now() - startTime;
        this.updateValidationMetrics(validationTime);

        if (error instanceof ValidationError) {
          this.metrics.validationErrors++;
          
          logger.error('Validation error in middleware', {
            toolName,
            error: error.message,
            errors: error.validationErrors,
            warnings: error.validationWarnings
          });

          // Return error in MCP format
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  error: error.message,
                  toolName,
                  validationErrors: error.validationErrors,
                  validationWarnings: error.validationWarnings,
                  metadata: error.metadata
                }, null, 2)
              }
            ]
          };
        }

        // Re-throw non-validation errors
        logger.error('Unexpected error in validation middleware', {
          toolName,
          error: error.message,
          stack: error.stack
        });
        
        throw error;
      }
    };
  }

  /**
   * Validate input using the MCPInputValidator
   */
  async validateInput(toolName, args, context, options) {
    const clientInfo = this.extractClientInfo(context);
    
    const validationOptions = {
      ...options,
      strictMode: this.strictModeTools.has(toolName)
    };

    const result = await this.validator.validateToolInput(toolName, args, clientInfo);
    
    // Apply tool-specific configurations
    const toolConfig = this.toolConfigs.get(toolName);
    if (toolConfig) {
      this.applyToolSpecificConfig(result, toolConfig);
    }

    return result;
  }

  /**
   * Extract client information from context for rate limiting
   */
  extractClientInfo(context) {
    return {
      id: context.clientId || context.userId || 'unknown',
      ip: context.clientIP || context.remoteAddress || 'unknown',
      userAgent: context.userAgent || 'unknown',
      sessionId: context.sessionId || 'unknown'
    };
  }

  /**
   * Apply tool-specific configuration to validation result
   */
  applyToolSpecificConfig(result, toolConfig) {
    if (toolConfig.allowWarnings === false && result.warnings.length > 0) {
      result.errors.push(...result.warnings.map(w => `Warning treated as error: ${w}`));
      result.isValid = false;
      result.warnings = [];
    }

    if (toolConfig.maxWarnings && result.warnings.length > toolConfig.maxWarnings) {
      result.errors.push(`Too many warnings: ${result.warnings.length} > ${toolConfig.maxWarnings}`);
      result.isValid = false;
    }

    if (toolConfig.requireSanitization && !result.sanitized) {
      result.warnings.push('Tool requires sanitization but none was applied');
    }

    if (toolConfig.maxRiskLevel) {
      const riskLevels = { 'LOW': 1, 'MEDIUM': 2, 'HIGH': 3, 'CRITICAL': 4 };
      const currentLevel = riskLevels[result.metadata.riskLevel] || 0;
      const maxLevel = riskLevels[toolConfig.maxRiskLevel] || 0;
      
      if (currentLevel > maxLevel) {
        result.errors.push(`Risk level too high: ${result.metadata.riskLevel} > ${toolConfig.maxRiskLevel}`);
        result.isValid = false;
      }
    }
  }

  /**
   * Update validation performance metrics
   */
  updateValidationMetrics(validationTime) {
    if (!this.config.collectMetrics) return;

    this.metrics.totalValidationTime += validationTime;
    this.metrics.averageValidationTime = this.metrics.totalValidationTime / this.metrics.validatedRequests;
  }

  /**
   * Enhance result with validation metadata
   */
  enhanceResultWithValidationMetadata(result, validationResult) {
    if (!result || typeof result !== 'object') return result;

    // Add validation metadata to the result
    const enhancedResult = {
      ...result,
      validationMetadata: {
        sanitized: validationResult.sanitized,
        warnings: validationResult.warnings,
        riskLevel: validationResult.metadata.riskLevel,
        validationTime: validationResult.metadata.validationTime
      }
    };

    // If result has content array, add validation info as a separate content item
    if (result.content && Array.isArray(result.content)) {
      enhancedResult.content = [
        ...result.content,
        {
          type: 'text',
          text: JSON.stringify({
            validationInfo: {
              sanitized: validationResult.sanitized,
              warningCount: validationResult.warnings.length,
              riskLevel: validationResult.metadata.riskLevel,
              validationTime: `${validationResult.metadata.validationTime}ms`
            }
          }, null, 2)
        }
      ];
    }

    return enhancedResult;
  }

  /**
   * Create a batch validator for multiple tools
   */
  createBatchValidator(toolHandlers) {
    const wrappedHandlers = {};
    
    for (const [toolName, handler] of Object.entries(toolHandlers)) {
      wrappedHandlers[toolName] = this.wrap(handler, toolName);
    }
    
    return wrappedHandlers;
  }

  /**
   * Add tool-specific configuration
   */
  addToolConfig(toolName, config) {
    this.toolConfigs.set(toolName, {
      allowWarnings: true,
      maxWarnings: 10,
      requireSanitization: false,
      maxRiskLevel: 'HIGH',
      ...config
    });
    
    logger.debug('Tool-specific validation config added', { toolName, config });
  }

  /**
   * Add tool to bypass list
   */
  addBypassTool(toolName) {
    this.bypassList.add(toolName);
    logger.debug('Tool added to validation bypass list', { toolName });
  }

  /**
   * Remove tool from bypass list
   */
  removeBypassTool(toolName) {
    this.bypassList.delete(toolName);
    logger.debug('Tool removed from validation bypass list', { toolName });
  }

  /**
   * Add tool to strict mode list
   */
  addStrictModeTool(toolName) {
    this.strictModeTools.add(toolName);
    logger.debug('Tool added to strict mode list', { toolName });
  }

  /**
   * Remove tool from strict mode list
   */
  removeStrictModeTool(toolName) {
    this.strictModeTools.delete(toolName);
    logger.debug('Tool removed from strict mode list', { toolName });
  }

  /**
   * Get validation middleware statistics
   */
  getStatistics() {
    const validatorStats = this.validator.getStatistics();
    
    return {
      middleware: {
        ...this.metrics,
        validationRate: this.metrics.totalRequests > 0 ? 
          (this.metrics.validatedRequests / this.metrics.totalRequests * 100).toFixed(2) + '%' : '0%',
        errorRate: this.metrics.validatedRequests > 0 ? 
          (this.metrics.validationErrors / this.metrics.validatedRequests * 100).toFixed(2) + '%' : '0%',
        bypassRate: this.metrics.totalRequests > 0 ? 
          (this.metrics.bypassedRequests / this.metrics.totalRequests * 100).toFixed(2) + '%' : '0%'
      },
      validator: validatorStats
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.metrics = {
      totalRequests: 0,
      validatedRequests: 0,
      bypassedRequests: 0,
      validationErrors: 0,
      averageValidationTime: 0,
      totalValidationTime: 0
    };
    
    this.validator.resetStatistics();
    logger.debug('Validation middleware statistics reset');
  }

  /**
   * Get health status
   */
  getHealthStatus() {
    const stats = this.getStatistics();
    const errorRate = parseFloat(stats.middleware.errorRate);
    const avgValidationTime = this.metrics.averageValidationTime;

    let status = 'healthy';
    const issues = [];

    if (errorRate > 10) {
      status = 'unhealthy';
      issues.push(`High validation error rate: ${errorRate}%`);
    } else if (errorRate > 5) {
      status = 'degraded';
      issues.push(`Moderate validation error rate: ${errorRate}%`);
    }

    if (avgValidationTime > 1000) {
      status = 'degraded';
      issues.push(`High validation latency: ${avgValidationTime.toFixed(2)}ms`);
    }

    return {
      status,
      issues,
      metrics: stats,
      recommendations: this.generateHealthRecommendations(errorRate, avgValidationTime)
    };
  }

  /**
   * Generate health recommendations
   */
  generateHealthRecommendations(errorRate, avgValidationTime) {
    const recommendations = [];

    if (errorRate > 10) {
      recommendations.push({
        type: 'error_rate',
        message: 'Consider reviewing validation schemas and input quality',
        priority: 'high'
      });
    }

    if (avgValidationTime > 1000) {
      recommendations.push({
        type: 'performance',
        message: 'Consider optimizing validation rules or adding more tools to bypass list',
        priority: 'medium'
      });
    }

    if (this.metrics.totalRequests > 10000 && this.metrics.bypassedRequests === 0) {
      recommendations.push({
        type: 'optimization',
        message: 'Consider adding frequently used tools to bypass list for better performance',
        priority: 'low'
      });
    }

    return recommendations;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.validatorConfig) {
      this.validator.updateConfig(newConfig.validatorConfig);
    }
    
    logger.debug('ValidationMiddleware configuration updated', newConfig);
  }

  /**
   * Get current configuration
   */
  getConfig() {
    return {
      ...this.config,
      toolConfigs: Object.fromEntries(this.toolConfigs),
      bypassList: Array.from(this.bypassList),
      strictModeTools: Array.from(this.strictModeTools)
    };
  }
}

/**
 * Custom validation error class
 */
export class ValidationError extends Error {
  constructor(message, validationErrors = [], validationWarnings = [], metadata = {}) {
    super(message);
    this.name = 'ValidationError';
    this.validationErrors = validationErrors;
    this.validationWarnings = validationWarnings;
    this.metadata = metadata;
  }
}

export default ValidationMiddleware;