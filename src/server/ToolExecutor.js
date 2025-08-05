/**
 * CONTEXT: Command pattern implementation for tool execution
 * REASON: Eliminate large switch statements and nested conditionals in tool execution
 * CHANGE: Create command objects for each tool with encapsulated execution logic
 * PREVENTION: Removes complex nested if/else chains and switch statements
 */

import { logger } from '../utils/logger.js';

/**
 * Base command class for tool execution
 */
class ToolCommand {
  constructor(toolName, serviceLocator) {
    this.toolName = toolName;
    this.serviceLocator = serviceLocator;
  }

  /**
   * Execute the command - to be implemented by subclasses
   */
  async execute(args, context = {}) {
    throw new Error(`Execute method not implemented for tool: ${this.toolName}`);
  }

  /**
   * Validate arguments - to be overridden by subclasses if needed
   */
  validateArgs(args) {
    return { isValid: true, errors: [] };
  }

  /**
   * Get required dependencies for this command
   */
  getDependencies() {
    return [];
  }
}

/**
 * Knowledge Graph Commands
 */
class DefineDomainOntologyCommand extends ToolCommand {
  getDependencies() {
    return ['knowledgeGraphHandler'];
  }

  async execute(args, context) {
    const handler = this.serviceLocator.get('knowledgeGraphHandler');
    return await handler.defineDomainOntology(args);
  }
}

class UpdateKGFromCodeCommand extends ToolCommand {
  getDependencies() {
    return ['knowledgeGraphHandler'];
  }

  async execute(args, context) {
    const handler = this.serviceLocator.get('knowledgeGraphHandler');
    return await handler.updateFromCode(args);
  }
}

/**
 * Context Commands
 */
class QueryContextForTaskCommand extends ToolCommand {
  getDependencies() {
    return ['contextHandler'];
  }

  async execute(args, context) {
    const handler = this.serviceLocator.get('contextHandler');
    return await handler.queryContextForTask(args);
  }
}

class ExtractContextFromCodeCommand extends ToolCommand {
  getDependencies() {
    return ['contextHandler'];
  }

  async execute(args, context) {
    const handler = this.serviceLocator.get('contextHandler');
    return await handler.extractFromCode(args);
  }
}

/**
 * Code Generation Commands
 */
class GenerateCodeWithContextCommand extends ToolCommand {
  getDependencies() {
    return ['codeGenerationHandler'];
  }

  async execute(args, context) {
    const handler = this.serviceLocator.get('codeGenerationHandler');
    return await handler.generateWithContext(args);
  }
}

class SuggestRefactoringCommand extends ToolCommand {
  getDependencies() {
    return ['codeGenerationHandler'];
  }

  async execute(args, context) {
    const handler = this.serviceLocator.get('codeGenerationHandler');
    return await handler.suggestRefactoring(args);
  }
}

/**
 * Validation Commands
 */
class ValidateAgainstKGCommand extends ToolCommand {
  getDependencies() {
    return ['validationHandler'];
  }

  async execute(args, context) {
    const handler = this.serviceLocator.get('validationHandler');
    return await handler.validateAgainstKG(args);
  }
}

class DetectTechnicalDebtCommand extends ToolCommand {
  getDependencies() {
    return ['validationHandler'];
  }

  async execute(args, context) {
    const handler = this.serviceLocator.get('validationHandler');
    return await handler.detectTechnicalDebt(args);
  }
}

/**
 * Initialization Commands
 */
class AnalyzeCodebaseCommand extends ToolCommand {
  getDependencies() {
    return ['initializationHandler'];
  }

  async execute(args, context) {
    const handler = this.serviceLocator.get('initializationHandler');
    return await handler.analyzeCodebase(args);
  }
}

/**
 * Arduino Commands
 */
class AnalyzeArduinoSketchCommand extends ToolCommand {
  getDependencies() {
    return ['arduinoHandler'];
  }

  async execute(args, context) {
    const handler = this.serviceLocator.get('arduinoHandler');
    return await handler.analyzeArduinoSketch(args);
  }
}

class ValidateHardwareConfigCommand extends ToolCommand {
  getDependencies() {
    return ['arduinoHandler'];
  }

  async execute(args, context) {
    const handler = this.serviceLocator.get('arduinoHandler');
    return await handler.validateHardwareConfiguration(args);
  }
}

class OptimizeForArduinoCommand extends ToolCommand {
  getDependencies() {
    return ['arduinoHandler'];
  }

  async execute(args, context) {
    const handler = this.serviceLocator.get('arduinoHandler');
    return await handler.optimizeForArduino(args);
  }
}

class GenerateInterruptSafeCodeCommand extends ToolCommand {
  getDependencies() {
    return ['arduinoHandler'];
  }

  async execute(args, context) {
    const handler = this.serviceLocator.get('arduinoHandler');
    return await handler.generateInterruptSafeCode(args);
  }
}

class AnalyzeTimingConstraintsCommand extends ToolCommand {
  getDependencies() {
    return ['arduinoHandler'];
  }

  async execute(args, context) {
    const handler = this.serviceLocator.get('arduinoHandler');
    return await handler.generateTimingAnalysis(args);
  }
}

/**
 * System Commands
 */
class GetKGStatisticsCommand extends ToolCommand {
  getDependencies() {
    return ['database'];
  }

  async execute(args, context) {
    // This command needs special handling since it's implemented on the server
    if (context.server && typeof context.server.getKGStatistics === 'function') {
      return await context.server.getKGStatistics(args);
    }
    throw new Error('Server context not available for KG statistics');
  }
}

class GetOptimizationReportCommand extends ToolCommand {
  getDependencies() {
    return ['optimizationManager'];
  }

  async execute(args, context) {
    if (context.server && typeof context.server.getOptimizationReport === 'function') {
      return await context.server.getOptimizationReport(args);
    }
    throw new Error('Server context not available for optimization report');
  }
}

class ForceOptimizationCommand extends ToolCommand {
  getDependencies() {
    return ['optimizationManager'];
  }

  async execute(args, context) {
    if (context.server && typeof context.server.forceOptimization === 'function') {
      return await context.server.forceOptimization(args);
    }
    throw new Error('Server context not available for force optimization');
  }
}

class GetServerHealthCommand extends ToolCommand {
  getDependencies() {
    return ['healthMonitor'];
  }

  async execute(args, context) {
    if (context.server && typeof context.server.getServerHealth === 'function') {
      return await context.server.getServerHealth(args);
    }
    throw new Error('Server context not available for health check');
  }
}

/**
 * Tool Executor manages command execution using Command pattern
 */
export class ToolExecutor {
  constructor(serviceLocator) {
    this.serviceLocator = serviceLocator;
    this.commands = new Map();
    this.middleware = [];
    this.setupCommands();
  }

  /**
   * Setup all available commands using factory pattern
   */
  setupCommands() {
    const commandFactories = {
      'define_domain_ontology': () => new DefineDomainOntologyCommand('define_domain_ontology', this.serviceLocator),
      'query_context_for_task': () => new QueryContextForTaskCommand('query_context_for_task', this.serviceLocator),
      'generate_code_with_context': () => new GenerateCodeWithContextCommand('generate_code_with_context', this.serviceLocator),
      'validate_against_kg': () => new ValidateAgainstKGCommand('validate_against_kg', this.serviceLocator),
      'extract_context_from_code': () => new ExtractContextFromCodeCommand('extract_context_from_code', this.serviceLocator),
      'detect_technical_debt': () => new DetectTechnicalDebtCommand('detect_technical_debt', this.serviceLocator),
      'suggest_refactoring': () => new SuggestRefactoringCommand('suggest_refactoring', this.serviceLocator),
      'update_kg_from_code': () => new UpdateKGFromCodeCommand('update_kg_from_code', this.serviceLocator),
      'analyze_codebase': () => new AnalyzeCodebaseCommand('analyze_codebase', this.serviceLocator),
      'get_kg_statistics': () => new GetKGStatisticsCommand('get_kg_statistics', this.serviceLocator),
      'analyze_arduino_sketch': () => new AnalyzeArduinoSketchCommand('analyze_arduino_sketch', this.serviceLocator),
      'validate_hardware_config': () => new ValidateHardwareConfigCommand('validate_hardware_config', this.serviceLocator),
      'optimize_for_arduino': () => new OptimizeForArduinoCommand('optimize_for_arduino', this.serviceLocator),
      'generate_interrupt_safe_code': () => new GenerateInterruptSafeCodeCommand('generate_interrupt_safe_code', this.serviceLocator),
      'analyze_timing_constraints': () => new AnalyzeTimingConstraintsCommand('analyze_timing_constraints', this.serviceLocator),
      'get_optimization_report': () => new GetOptimizationReportCommand('get_optimization_report', this.serviceLocator),
      'force_optimization': () => new ForceOptimizationCommand('force_optimization', this.serviceLocator),
      'get_server_health': () => new GetServerHealthCommand('get_server_health', this.serviceLocator)
    };

    // Create and register commands
    for (const [toolName, factory] of Object.entries(commandFactories)) {
      this.commands.set(toolName, factory());
    }

    logger.info('Tool executor initialized', {
      commandCount: this.commands.size
    });
  }

  /**
   * Add middleware for command execution
   */
  addMiddleware(middleware) {
    this.middleware.push(middleware);
  }

  /**
   * Execute a tool command using the command pattern
   */
  async executeCommand(toolName, args, context = {}) {
    const command = this.getCommand(toolName);
    
    if (!command) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    // Validate dependencies using early return
    const missingDependencies = this.validateDependencies(command);
    if (missingDependencies.length > 0) {
      throw new Error(`Missing dependencies for ${toolName}: ${missingDependencies.join(', ')}`);
    }

    // Execute middleware chain
    const executionContext = {
      toolName,
      args,
      context,
      command
    };

    return await this.executeWithMiddleware(executionContext);
  }

  /**
   * Get command instance
   */
  getCommand(toolName) {
    return this.commands.get(toolName);
  }

  /**
   * Validate command dependencies using guard clauses
   */
  validateDependencies(command) {
    const missingDependencies = [];
    const requiredDependencies = command.getDependencies();

    for (const dependency of requiredDependencies) {
      if (!this.serviceLocator.has(dependency)) {
        missingDependencies.push(dependency);
      }
    }

    return missingDependencies;
  }

  /**
   * Execute command with middleware chain
   */
  async executeWithMiddleware(executionContext) {
    let index = 0;

    const next = async () => {
      // If we've reached the end of middleware, execute the actual command
      if (index >= this.middleware.length) {
        return await executionContext.command.execute(
          executionContext.args, 
          executionContext.context
        );
      }

      const middleware = this.middleware[index++];
      return await middleware(executionContext, next);
    };

    return await next();
  }

  /**
   * Get all available commands
   */
  getAvailableCommands() {
    return Array.from(this.commands.keys()).sort();
  }

  /**
   * Check if a command is available
   */
  hasCommand(toolName) {
    return this.commands.has(toolName);
  }

  /**
   * Get command information
   */
  getCommandInfo(toolName) {
    const command = this.commands.get(toolName);
    if (!command) {
      return null;
    }

    return {
      toolName,
      dependencies: command.getDependencies(),
      className: command.constructor.name
    };
  }

  /**
   * Get all commands information
   */
  getAllCommandsInfo() {
    const commandsInfo = [];
    
    for (const toolName of this.getAvailableCommands()) {
      commandsInfo.push(this.getCommandInfo(toolName));
    }
    
    return commandsInfo;
  }

  /**
   * Create validation middleware
   */
  static createValidationMiddleware(validationSystem) {
    return async (executionContext, next) => {
      const { toolName, args } = executionContext;
      
      // Skip validation if system not available
      if (!validationSystem) {
        return await next();
      }

      // Validate arguments
      const validation = await validationSystem.validateToolArgs(toolName, args);
      if (!validation.isValid) {
        throw new Error(`Validation failed for ${toolName}: ${validation.errors.join(', ')}`);
      }

      return await next();
    };
  }

  /**
   * Create logging middleware
   */
  static createLoggingMiddleware() {
    return async (executionContext, next) => {
      const { toolName, args } = executionContext;
      const startTime = Date.now();
      
      logger.info(`Executing command: ${toolName}`, { 
        args: ToolExecutor.sanitizeArgsForLogging(args) 
      });
      
      try {
        const result = await next();
        const duration = Date.now() - startTime;
        
        logger.info(`Command completed: ${toolName}`, { 
          duration: `${duration}ms`,
          success: true 
        });
        
        return result;
      } catch (error) {
        const duration = Date.now() - startTime;
        
        logger.error(`Command failed: ${toolName}`, {
          duration: `${duration}ms`,
          error: error.message
        });
        
        throw error;
      }
    };
  }

  /**
   * Create metrics middleware
   */
  static createMetricsMiddleware(healthMonitor) {
    return async (executionContext, next) => {
      const startTime = Date.now();
      
      try {
        const result = await next();
        const responseTime = Date.now() - startTime;
        
        if (healthMonitor) {
          healthMonitor.updateMetrics({
            toolCalls: 1,
            responseTime: responseTime
          });
        }
        
        return result;
      } catch (error) {
        const responseTime = Date.now() - startTime;
        
        if (healthMonitor) {
          healthMonitor.updateMetrics({
            toolCalls: 1,
            errors: 1,
            responseTime: responseTime
          });
        }
        
        throw error;
      }
    };
  }

  /**
   * Sanitize arguments for logging
   */
  static sanitizeArgsForLogging(args) {
    if (!args || typeof args !== 'object') {
      return args;
    }
    
    const sanitized = { ...args };
    
    // Truncate long strings
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 200) {
        sanitized[key] = sanitized[key].substring(0, 200) + '... [truncated]';
      }
      
      // Remove sensitive data
      const sensitiveKeys = ['password', 'token', 'secret', 'key'];
      if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
        sanitized[key] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }
}