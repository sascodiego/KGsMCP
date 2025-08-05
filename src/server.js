import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { InitializationHandler } from './handlers/initialization.js';
import { ContextHandler } from './handlers/context.js';
import { CodeGenerationHandler } from './handlers/codeGeneration.js';
import { ValidationHandler } from './handlers/validation.js';
import { KnowledgeGraphHandler } from './handlers/knowledgeGraph.js';
import { ArduinoHandler } from './handlers/arduinoHandler.js';
import { KuzuClient } from './database/kuzuClient.js';
import { logger } from './utils/logger.js';
import { config, initializeConfigAsync } from './utils/config.js';
import { ValidationSystem } from './validation/index.js';
import { OptimizationManager, createOptimizedConfig } from './optimization/index.js';

export class MCPServer {
  constructor(options = {}) {
    this.options = options;
    this.config = config.load(options.config);
    this.server = new Server(
      {
        name: this.config.mcp.serverName,
        version: this.config.mcp.serverVersion,
      },
      {
        capabilities: {
          tools: {},
          resources: {},
          prompts: {}
        },
      }
    );
    
    this.kuzu = null;
    this.handlers = {};
    this.validationSystem = null;
    this.optimizationManager = null;
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
    
    this.setupValidation();
    this.setupHandlers();
    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  /**
   * Initialize server with async configuration loading
   * Use this method for better performance in production
   */
  static async createAsync(options = {}) {
    try {
      // Load configuration asynchronously
      const configInstance = await initializeConfigAsync(options.config);
      
      // Create server instance with pre-loaded config
      const server = new MCPServer(options);
      server.config = configInstance;
      
      // Reinitialize with new config
      server.server = new Server(
        {
          name: server.config.mcp.serverName,
          version: server.config.mcp.serverVersion,
        },
        {
          capabilities: {
            tools: {},
            resources: {},
            prompts: {}
          },
        }
      );
      
      logger.info('Server created with async configuration loading', {
        configPath: server.options.config || 'default'
      });
      
      return server;
    } catch (error) {
      logger.error('Failed to create server with async config:', error);
      throw error;
    }
  }

  setupValidation() {
    // Initialize comprehensive validation system
    const validationConfig = {
      inputValidator: {
        maxStringLength: this.config.validation?.maxStringLength || 100000,
        maxArrayLength: this.config.validation?.maxArrayLength || 10000,
        maxObjectDepth: this.config.validation?.maxObjectDepth || 10,
        enableSanitization: this.config.validation?.enableSanitization !== false,
        strictMode: this.config.validation?.strictMode || false,
        rateLimiting: {
          enabled: this.config.validation?.rateLimiting?.enabled || false,
          maxRequestsPerMinute: this.config.validation?.rateLimiting?.maxRequestsPerMinute || 100,
          maxRequestsPerHour: this.config.validation?.rateLimiting?.maxRequestsPerHour || 1000
        }
      },
      middleware: {
        enabled: this.config.validation?.enabled !== false,
        strictMode: this.config.validation?.strictMode || false,
        enableLogging: this.config.validation?.enableLogging !== false,
        throwOnValidationError: false,
        collectMetrics: true
      },
      advancedValidators: {
        enableASTValidation: this.config.validation?.enableASTValidation !== false,
        enableSecurityAnalysis: this.config.validation?.enableSecurityAnalysis !== false,
        enablePerformanceValidation: this.config.validation?.enablePerformanceValidation !== false
      },
      performance: this.config.validation?.performance || {},
      monitoring: this.config.validation?.monitoring || {}
    };

    this.validationSystem = new ValidationSystem(validationConfig);

    // Configure tool-specific validation settings
    this.configureToolValidation();

    logger.info('Comprehensive validation system initialized', {
      enabled: validationConfig.middleware.enabled,
      rateLimitingEnabled: validationConfig.inputValidator.rateLimiting.enabled,
      strictMode: validationConfig.middleware.strictMode,
      performanceOptimization: validationConfig.performance.enableCaching,
      monitoring: validationConfig.monitoring.enableRealTimeMonitoring
    });
  }

  configureToolValidation() {
    const middleware = this.validationSystem.getMiddleware();
    
    // Configure strict mode for critical tools
    const criticalTools = [
      'define_domain_ontology',
      'update_kg_from_code',
      'analyze_codebase'
    ];
    
    criticalTools.forEach(tool => {
      middleware.addStrictModeTool(tool);
    });

    // Configure tool-specific validation rules
    middleware.addToolConfig('validate_against_kg', {
      allowWarnings: true,
      maxWarnings: 5,
      requireSanitization: true,
      maxRiskLevel: 'HIGH'
    });

    middleware.addToolConfig('extract_context_from_code', {
      allowWarnings: true,
      maxWarnings: 3,
      requireSanitization: false,
      maxRiskLevel: 'MEDIUM'
    });

    // Add tools that can bypass validation for performance
    const performanceTools = [
      'get_kg_statistics'
    ];
    
    performanceTools.forEach(tool => {
      middleware.addBypassTool(tool);
    });
  }

  setupHandlers() {
    // Create handlers without validation middleware first
    const rawHandlers = {
      initialization: new InitializationHandler(this),
      context: new ContextHandler(this),
      codeGeneration: new CodeGenerationHandler(this),
      validation: new ValidationHandler(this),
      knowledgeGraph: new KnowledgeGraphHandler(this),
      arduino: new ArduinoHandler(this)
    };

    // Wrap handlers with validation middleware
    const middleware = this.validationSystem.getMiddleware();
    this.handlers = {};
    
    for (const [name, handler] of Object.entries(rawHandlers)) {
      this.handlers[name] = handler;
      
      // Store wrapped methods for validation
      if (handler.defineDomainOntology) {
        handler.defineDomainOntology = middleware.wrap(
          handler.defineDomainOntology.bind(handler),
          'define_domain_ontology'
        );
      }
      
      if (handler.queryContextForTask) {
        handler.queryContextForTask = middleware.wrap(
          handler.queryContextForTask.bind(handler),
          'query_context_for_task'
        );
      }
      
      if (handler.generateWithContext) {
        handler.generateWithContext = middleware.wrap(
          handler.generateWithContext.bind(handler),
          'generate_code_with_context'
        );
      }
      
      if (handler.validateAgainstKG) {
        handler.validateAgainstKG = middleware.wrap(
          handler.validateAgainstKG.bind(handler),
          'validate_against_kg'
        );
      }
      
      if (handler.extractFromCode) {
        handler.extractFromCode = middleware.wrap(
          handler.extractFromCode.bind(handler),
          'extract_context_from_code'
        );
      }
      
      if (handler.detectTechnicalDebt) {
        handler.detectTechnicalDebt = middleware.wrap(
          handler.detectTechnicalDebt.bind(handler),
          'detect_technical_debt'
        );
      }
      
      if (handler.suggestRefactoring) {
        handler.suggestRefactoring = middleware.wrap(
          handler.suggestRefactoring.bind(handler),
          'suggest_refactoring'
        );
      }
      
      if (handler.updateFromCode) {
        handler.updateFromCode = middleware.wrap(
          handler.updateFromCode.bind(handler),
          'update_kg_from_code'
        );
      }
      
      if (handler.analyzeCodebase) {
        handler.analyzeCodebase = middleware.wrap(
          handler.analyzeCodebase.bind(handler),
          'analyze_codebase'
        );
      }
      
      // Arduino-specific methods
      if (handler.analyzeArduinoSketch) {
        handler.analyzeArduinoSketch = middleware.wrap(
          handler.analyzeArduinoSketch.bind(handler),
          'analyze_arduino_sketch'
        );
      }
      
      if (handler.validateHardwareConfiguration) {
        handler.validateHardwareConfiguration = middleware.wrap(
          handler.validateHardwareConfiguration.bind(handler),
          'validate_hardware_config'
        );
      }
      
      if (handler.optimizeForArduino) {
        handler.optimizeForArduino = middleware.wrap(
          handler.optimizeForArduino.bind(handler),
          'optimize_for_arduino'
        );
      }
      
      if (handler.generateInterruptSafeCode) {
        handler.generateInterruptSafeCode = middleware.wrap(
          handler.generateInterruptSafeCode.bind(handler),
          'generate_interrupt_safe_code'
        );
      }
      
      if (handler.generateTimingAnalysis) {
        handler.generateTimingAnalysis = middleware.wrap(
          handler.generateTimingAnalysis.bind(handler),
          'analyze_timing_constraints'
        );
      }
    }
  }

  setupErrorHandling() {
    // Global error handling for the server
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.gracefulShutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // Setup MCP server error handling
    this.server.onerror = (error) => {
      logger.error('MCP Server Error:', error);
      this.metrics.errors++;
    };
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'define_domain_ontology',
          description: 'Define or update domain ontology in the knowledge graph',
          inputSchema: {
            type: 'object',
            properties: {
              entities: { type: 'array', items: { type: 'object' } },
              relationships: { type: 'array', items: { type: 'object' } },
              businessRules: { type: 'array', items: { type: 'string' } },
              codingStandards: { type: 'object' }
            },
            required: ['entities']
          }
        },
        {
          name: 'query_context_for_task',
          description: 'Query KG for relevant context before generating code',
          inputSchema: {
            type: 'object',
            properties: {
              taskDescription: { type: 'string' },
              entityTypes: { type: 'array', items: { type: 'string' } },
              depth: { type: 'integer', default: 2 }
            },
            required: ['taskDescription']
          }
        },
        {
          name: 'generate_code_with_context',
          description: 'Generate code grounded in KG context',
          inputSchema: {
            type: 'object',
            properties: {
              requirement: { type: 'string' },
              contextIds: { type: 'array', items: { type: 'string' } },
              patternsToApply: { type: 'array', items: { type: 'string' } },
              constraints: { type: 'object' }
            },
            required: ['requirement']
          }
        },
        {
          name: 'validate_against_kg',
          description: 'Validate code or decisions against KG knowledge',
          inputSchema: {
            type: 'object',
            properties: {
              codeSnippet: { type: 'string' },
              validationTypes: { type: 'array', items: { type: 'string' } },
              strictMode: { type: 'boolean', default: true }
            },
            required: ['codeSnippet']
          }
        },
        {
          name: 'extract_context_from_code',
          description: 'Extract context from existing code comments',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: { type: 'string' },
              codeSnippet: { type: 'string' }
            },
            required: ['filePath']
          }
        },
        {
          name: 'detect_technical_debt',
          description: 'Detect potential technical debt by querying KG',
          inputSchema: {
            type: 'object',
            properties: {
              scope: { type: 'string', enum: ['module', 'project', 'specific'] },
              target: { type: 'string' },
              debtTypes: { type: 'array', items: { type: 'string' } }
            },
            required: ['scope']
          }
        },
        {
          name: 'suggest_refactoring',
          description: 'Suggest refactorings based on KG patterns',
          inputSchema: {
            type: 'object',
            properties: {
              codeEntity: { type: 'string' },
              improvementGoals: { type: 'array', items: { type: 'string' } },
              preserveBehavior: { type: 'boolean', default: true }
            },
            required: ['codeEntity']
          }
        },
        {
          name: 'update_kg_from_code',
          description: 'Update KG with new entities, relations or patterns',
          inputSchema: {
            type: 'object',
            properties: {
              codeAnalysis: { type: 'object' },
              decisions: { type: 'array', items: { type: 'object' } },
              learnedPatterns: { type: 'array', items: { type: 'object' } }
            },
            required: ['codeAnalysis']
          }
        },
        {
          name: 'analyze_codebase',
          description: 'Analyze entire codebase and update KG',
          inputSchema: {
            type: 'object',
            properties: {
              codebasePath: { type: 'string' },
              includeGitHistory: { type: 'boolean', default: true },
              maxDepth: { type: 'integer', default: 10 }
            },
            required: ['codebasePath']
          }
        },
        {
          name: 'get_kg_statistics',
          description: 'Get comprehensive statistics about the Knowledge Graph',
          inputSchema: {
            type: 'object',
            properties: {
              includeDetails: { type: 'boolean', default: false },
              entityType: { type: 'string' }
            }
          }
        },
        // Arduino/C++ specific tools
        {
          name: 'analyze_arduino_sketch',
          description: 'Analyze Arduino sketch for hardware usage and optimization',
          inputSchema: {
            type: 'object',
            properties: {
              sketchPath: { type: 'string' },
              targetBoard: { 
                type: 'string', 
                enum: ['uno', 'mega2560', 'nano', 'esp32'],
                default: 'uno'
              },
              includeLibraries: { type: 'boolean', default: true }
            },
            required: ['sketchPath']
          }
        },
        {
          name: 'validate_hardware_config',
          description: 'Validate pin assignments and hardware compatibility',
          inputSchema: {
            type: 'object',
            properties: {
              board: { 
                type: 'string',
                enum: ['uno', 'mega2560', 'nano', 'esp32']
              },
              components: { 
                type: 'array', 
                items: { 
                  type: 'object',
                  properties: {
                    pin: { type: 'string' },
                    usage: { type: 'array', items: { type: 'string' } },
                    type: { type: 'string' }
                  }
                }
              },
              connections: { type: 'array', items: { type: 'object' } }
            },
            required: ['board', 'components']
          }
        },
        {
          name: 'optimize_for_arduino',
          description: 'Suggest optimizations for memory and performance',
          inputSchema: {
            type: 'object',
            properties: {
              memoryUsage: {
                type: 'object',
                properties: {
                  ram: { type: 'integer' },
                  flash: { type: 'integer' },
                  eeprom: { type: 'integer' }
                }
              },
              targetBoard: { 
                type: 'string',
                enum: ['uno', 'mega2560', 'nano', 'esp32']
              },
              complexity: { type: 'integer' },
              constraints: {
                type: 'object',
                properties: {
                  maxRAM: { type: 'integer' },
                  maxFlash: { type: 'integer' },
                  maxLoopTime: { type: 'integer' }
                }
              }
            },
            required: ['targetBoard']
          }
        },
        {
          name: 'generate_interrupt_safe_code',
          description: 'Generate code patterns safe for interrupt contexts',
          inputSchema: {
            type: 'object',
            properties: {
              functionality: { type: 'string' },
              interruptType: { 
                type: 'string', 
                enum: ['external', 'timer', 'serial'],
                default: 'external'
              },
              sharedVariables: { 
                type: 'array', 
                items: { type: 'string' } 
              }
            },
            required: ['functionality']
          }
        },
        {
          name: 'analyze_timing_constraints',
          description: 'Analyze timing requirements and constraints for real-time code',
          inputSchema: {
            type: 'object',
            properties: {
              codeEntity: { type: 'string' },
              constraints: {
                type: 'object',
                properties: {
                  maxExecutionTime: { type: 'integer' },
                  maxLoopTime: { type: 'integer' },
                  realTimeDeadline: { type: 'integer' }
                }
              }
            },
            required: ['codeEntity']
          }
        },
        {
          name: 'get_optimization_report',
          description: 'Get comprehensive performance optimization report',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'force_optimization',
          description: 'Force immediate optimization of all system components',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        }
      ]
    }));

    // Handle tool calls with enhanced validation and monitoring
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const startTime = Date.now();
      
      try {
        const { name, arguments: args } = request.params;
        
        // Enhanced logging with sanitized args
        const sanitizedArgs = this.sanitizeArgsForLogging(args);
        logger.info(`Tool called: ${name}`, { args: sanitizedArgs });

        this.metrics.toolCalls++;
        
        // Perform advanced validation for code-related tools
        if (this.isCodeRelatedTool(name) && args.codeSnippet) {
          const advancedValidators = this.validationSystem.getComponents().advancedValidators;
          const advancedValidation = await advancedValidators.validateCodeStructure(
            args.codeSnippet,
            { toolName: name }
          );
          
          if (!advancedValidation.isValid) {
            this.metrics.validationStats.validationErrors++;
            
            logger.warn('Advanced code validation failed', {
              toolName: name,
              errors: advancedValidation.errors,
              securityIssues: advancedValidation.metadata.securityIssues
            });
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    error: 'Advanced validation failed',
                    toolName: name,
                    validationErrors: advancedValidation.errors,
                    securityIssues: advancedValidation.metadata.securityIssues,
                    recommendations: 'Please review and sanitize your code input'
                  }, null, 2)
                }
              ]
            };
          }
          
          if (advancedValidation.warnings.length > 0) {
            logger.info('Advanced validation warnings', {
              toolName: name,
              warnings: advancedValidation.warnings,
              complexity: advancedValidation.metadata.complexity
            });
          }
        }
        
        // Perform security threat analysis for sensitive operations
        if (this.isSensitiveTool(name)) {
          const advancedValidators = this.validationSystem.getComponents().advancedValidators;
          const securityValidation = await advancedValidators.validateSecurityThreats(
            args,
            { toolName: name, userPrivileges: request.meta?.userPrivileges }
          );
          
          if (!securityValidation.isValid) {
            this.metrics.validationStats.validationErrors++;
            
            logger.error('Security threat detected', {
              toolName: name,
              threatLevel: securityValidation.metadata.threatLevel,
              detectedThreats: securityValidation.metadata.detectedThreats
            });
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    error: 'Security threat detected',
                    toolName: name,
                    threatLevel: securityValidation.metadata.threatLevel,
                    detectedThreats: securityValidation.metadata.detectedThreats,
                    recommendations: securityValidation.metadata.recommendedActions
                  }, null, 2)
                }
              ]
            };
          }
        }

        let result;

        // Use optimization manager if available, otherwise fall back to direct execution
        if (this.optimizationManager) {
          result = await this.executeOptimizedToolCall(name, args, request);
        } else {
          result = await this.executeDirectToolCall(name, args);
        }

          
          case 'validate_against_kg':
            result = await this.handlers.validation.validateAgainstKG(args);
            break;
          
          case 'extract_context_from_code':
            result = await this.handlers.context.extractFromCode(args);
            break;
          
          case 'detect_technical_debt':
            result = await this.handlers.validation.detectTechnicalDebt(args);
            break;
          
          case 'suggest_refactoring':
            result = await this.handlers.codeGeneration.suggestRefactoring(args);
            break;
          
          case 'update_kg_from_code':
            result = await this.handlers.knowledgeGraph.updateFromCode(args);
            break;
          
          case 'analyze_codebase':
            result = await this.handlers.initialization.analyzeCodebase(args);
            break;
          
          case 'get_kg_statistics':
            result = await this.getKGStatistics(args);
            break;
          
          // Arduino/C++ specific tools
          case 'analyze_arduino_sketch':
            result = await this.handlers.arduino.analyzeArduinoSketch(args);
            break;
          
          case 'validate_hardware_config':
            result = await this.handlers.arduino.validateHardwareConfiguration(args);
            break;
          
          case 'optimize_for_arduino':
            result = await this.handlers.arduino.optimizeForArduino(args);
            break;
          
          case 'generate_interrupt_safe_code':
            result = await this.handlers.arduino.generateInterruptSafeCode(args);
            break;
          
          case 'analyze_timing_constraints':
            result = await this.handlers.arduino.generateTimingAnalysis(args);
            break;
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }

        // Track response time and validation metrics
        const responseTime = Date.now() - startTime;
        this.metrics.totalResponseTime += responseTime;
        this.metrics.validationStats.totalValidations++;
        
        // Update validation statistics
        const validationStats = this.validationSystem.getMiddleware().getStatistics();
        this.metrics.validationStats = {
          ...this.metrics.validationStats,
          ...validationStats.middleware
        };
        
        logger.info(`Tool completed: ${name}`, {
          responseTime: `${responseTime}ms`,
          success: true,
          validationMetrics: {
            totalValidations: validationStats.middleware.totalRequests,
            errorRate: validationStats.middleware.errorRate,
            avgValidationTime: validationStats.middleware.averageValidationTime
          }
        });

        return result;

      } catch (error) {
        const responseTime = Date.now() - startTime;
        this.metrics.totalResponseTime += responseTime;
        this.metrics.errors++;

        // Enhanced error logging with validation context
        const sanitizedArgs = this.sanitizeArgsForLogging(request.params.arguments);
        
        logger.error('Tool execution error:', {
          tool: request.params.name,
          error: error.message,
          responseTime: `${responseTime}ms`,
          args: sanitizedArgs,
          validationStats: this.metrics.validationStats,
          errorType: error.name
        });

        return {
          content: [
            {
              type: 'text',
              text: `Error executing ${request.params.name}: ${error.message}`
            }
          ]
        };
      }
    });
  }

  /**
   * Execute tool call with optimization
   */
  async executeOptimizedToolCall(toolName, args, request) {
    try {
      const handlerName = this.getHandlerForTool(toolName);
      if (!handlerName) {
        return await this.executeDirectToolCall(toolName, args);
      }
      
      // Create handler function that wraps the tool execution
      const handlerFunction = async (request, options) => {
        return await this.executeDirectToolCall(toolName, request);
      };
      
      // Execute with optimization
      return await this.optimizationManager.optimizeHandlerRequest(
        handlerName,
        args,
        { tool: toolName, originalRequest: request }
      );
      
    } catch (error) {
      logger.error(`Optimized tool execution failed for ${toolName}:`, error);
      // Fall back to direct execution
      return await this.executeDirectToolCall(toolName, args);
    }
  }

  /**
   * Execute tool call directly without optimization
   */
  async executeDirectToolCall(toolName, args) {
    switch (toolName) {
      case 'define_domain_ontology':
        return await this.handlers.knowledgeGraph.defineDomainOntology(args);
      
      case 'query_context_for_task':
        return await this.handlers.context.queryContextForTask(args);
      
      case 'generate_code_with_context':
        return await this.handlers.codeGeneration.generateWithContext(args);
      
      case 'validate_against_kg':
        return await this.handlers.validation.validateAgainstKG(args);
      
      case 'extract_context_from_code':
        return await this.handlers.context.extractFromCode(args);
      
      case 'detect_technical_debt':
        return await this.handlers.validation.detectTechnicalDebt(args);
      
      case 'suggest_refactoring':
        return await this.handlers.codeGeneration.suggestRefactoring(args);
      
      case 'update_kg_from_code':
        return await this.handlers.knowledgeGraph.updateFromCode(args);
      
      case 'analyze_codebase':
        return await this.handlers.initialization.analyzeCodebase(args);
      
      case 'get_kg_statistics':
        return await this.getKGStatistics(args);
      
      // Arduino/C++ specific tools
      case 'analyze_arduino_sketch':
        return await this.handlers.arduino.analyzeArduinoSketch(args);
      
      case 'validate_hardware_config':
        return await this.handlers.arduino.validateHardwareConfiguration(args);
      
      case 'optimize_for_arduino':
        return await this.handlers.arduino.optimizeForArduino(args);
      
      case 'generate_interrupt_safe_code':
        return await this.handlers.arduino.generateInterruptSafeCode(args);
      
      case 'analyze_timing_constraints':
        return await this.handlers.arduino.generateTimingAnalysis(args);
      
      case 'get_server_health':
        return await this.getServerHealth();
      
      case 'get_optimization_report':
        return await this.getOptimizationReport();
      
      case 'force_optimization':
        return await this.forceOptimization();
      
      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  }

  /**
   * Get handler name for tool
   */
  getHandlerForTool(toolName) {
    const toolToHandlerMap = {
      'define_domain_ontology': 'knowledgeGraph',
      'query_context_for_task': 'context',
      'generate_code_with_context': 'codeGeneration',
      'validate_against_kg': 'validation',
      'extract_context_from_code': 'context',
      'detect_technical_debt': 'validation',
      'suggest_refactoring': 'codeGeneration',
      'update_kg_from_code': 'knowledgeGraph',
      'analyze_codebase': 'initialization',
      'analyze_arduino_sketch': 'arduino',
      'validate_hardware_config': 'arduino',
      'optimize_for_arduino': 'arduino',
      'generate_interrupt_safe_code': 'arduino',
      'analyze_timing_constraints': 'arduino'
    };
    
    return toolToHandlerMap[toolName];
  }

  /**
   * Get optimization report
   */
  async getOptimizationReport() {
    if (!this.optimizationManager) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Optimization system not available',
              status: 'disabled'
            }, null, 2)
          }
        ]
      };
    }
    
    try {
      const report = this.optimizationManager.getOptimizationReport();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(report, null, 2)
          }
        ]
      };
      
    } catch (error) {
      logger.error('Failed to get optimization report:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Failed to generate optimization report',
              message: error.message
            }, null, 2)
          }
        ]
      };
    }
  }

  /**
   * Force optimization
   */
  async forceOptimization() {
    if (!this.optimizationManager) {
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Optimization system not available',
              status: 'disabled'
            }, null, 2)
          }
        ]
      };
    }
    
    try {
      const startTime = Date.now();
      await this.optimizationManager.forceOptimization();
      const duration = Date.now() - startTime;
      
      const report = this.optimizationManager.getOptimizationReport();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: 'Optimization completed successfully',
              duration: `${duration}ms`,
              report: report
            }, null, 2)
          }
        ]
      };
      
    } catch (error) {
      logger.error('Failed to force optimization:', error);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              error: 'Failed to force optimization',
              message: error.message
            }, null, 2)
          }
        ]
      };
    }
  }

  async getKGStatistics(args) {
    const { includeDetails = false, entityType } = args;
    
    try {
      // Basic statistics using Kuzu
      const basicStats = await this.getBasicKGStats();
      
      // Detailed statistics if requested
      let detailedStats = {};
      
      if (includeDetails) {
        // Entity breakdown by type
        const entityBreakdown = await this.kuzu.query(`
          MATCH (e:CodeEntity)
          RETURN e.type as type, count(*) as count, avg(e.complexity) as avgComplexity
          ORDER BY count DESC
        `);
        
        // Pattern statistics
        const patternStats = await this.kuzu.query(`
          MATCH (p:Pattern)
          RETURN p.category as category, count(*) as count, avg(p.confidence) as avgConfidence
          ORDER BY count DESC
        `);
        
        // File analysis
        const fileStats = await this.kuzu.query(`
          MATCH (e:CodeEntity)
          WITH e.filePath as file, count(*) as entityCount, avg(e.complexity) as avgComplexity
          ORDER BY entityCount DESC
          LIMIT 20
          RETURN file, entityCount, avgComplexity
        `);
        
        // Rule breakdown
        const ruleStats = await this.kuzu.query(`
          MATCH (r:Rule)
          RETURN r.category as category, r.severity as severity, count(*) as count
        `);
        
        detailedStats = {
          entityBreakdown,
          patternStats,
          topFiles: fileStats.slice(0, 10),
          ruleBreakdown: ruleStats
        };
      }
      
      // Specific entity type analysis if requested
      let entityTypeStats = {};
      if (entityType) {
        const typeResults = await this.kuzu.query(`
          MATCH (e:CodeEntity)
          WHERE e.type = $entityType
          RETURN 
            count(*) as total,
            avg(e.complexity) as avgComplexity,
            max(e.complexity) as maxComplexity
        `, { entityType });

        const sampleFiles = await this.kuzu.query(`
          MATCH (e:CodeEntity)
          WHERE e.type = $entityType
          RETURN DISTINCT e.filePath as filePath
          LIMIT 10
        `, { entityType });
        
        entityTypeStats = {
          ...typeResults[0],
          sampleFiles: sampleFiles.map(r => r.filePath)
        };
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              timestamp: new Date().toISOString(),
              basicStatistics: basicStats,
              detailedAnalysis: includeDetails ? detailedStats : null,
              entityTypeAnalysis: entityType ? entityTypeStats : null,
              summary: {
                totalNodes: (basicStats.codeEntities || 0) + (basicStats.patterns || 0) + (basicStats.rules || 0) + (basicStats.standards || 0),
                healthStatus: this.assessKGHealth(basicStats),
                recommendations: this.generateKGRecommendations(basicStats)
              }
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error getting KG statistics:', error);
      throw error;
    }
  }

  async getBasicKGStats() {
    try {
      const [
        codeEntityCount,
        patternCount,
        ruleCount,
        standardCount,
        decisionCount,
        relationshipCounts
      ] = await Promise.all([
        this.kuzu.query('MATCH (e:CodeEntity) RETURN count(e) as count'),
        this.kuzu.query('MATCH (p:Pattern) RETURN count(p) as count'),
        this.kuzu.query('MATCH (r:Rule) RETURN count(r) as count'),
        this.kuzu.query('MATCH (s:Standard) RETURN count(s) as count'),
        this.kuzu.query('MATCH (d:Decision) RETURN count(d) as count'),
        this.kuzu.query(`
          MATCH ()-[r]->()
          RETURN type(r) as relType, count(*) as count
        `)
      ]);

      return {
        codeEntities: codeEntityCount[0]?.count || 0,
        patterns: patternCount[0]?.count || 0,
        rules: ruleCount[0]?.count || 0,
        standards: standardCount[0]?.count || 0,
        decisions: decisionCount[0]?.count || 0,
        relationships: relationshipCounts.reduce((acc, r) => {
          acc[r.relType] = r.count;
          return acc;
        }, {}),
        totalRelationships: relationshipCounts.reduce((sum, r) => sum + r.count, 0)
      };
    } catch (error) {
      logger.error('Error getting basic KG stats:', error);
      return {
        codeEntities: 0,
        patterns: 0,
        rules: 0,
        standards: 0,
        decisions: 0,
        relationships: {},
        totalRelationships: 0
      };
    }
  }

  assessKGHealth(stats) {
    if (!stats || stats.codeEntities === 0) {
      return {
        status: 'empty',
        message: 'Knowledge Graph is empty. Run initialization first.'
      };
    }
    
    if (stats.codeEntities < 10) {
      return {
        status: 'minimal',
        message: 'Knowledge Graph has minimal data. Consider analyzing more code.'
      };
    }
    
    if (stats.patterns === 0) {
      return {
        status: 'basic',
        message: 'No patterns detected yet. Analysis may need more complex code.'
      };
    }

    if (stats.totalRelationships === 0) {
      return {
        status: 'disconnected',
        message: 'Entities exist but no relationships found. Run deeper analysis.'
      };
    }
    
    return {
      status: 'healthy',
      message: 'Knowledge Graph is well-populated and ready for use.'
    };
  }

  generateKGRecommendations(stats) {
    const recommendations = [];
    
    if (stats.codeEntities === 0) {
      recommendations.push({
        type: 'initialization',
        message: 'Initialize the Knowledge Graph with your codebase',
        action: 'Run: mcp-vibe-coding init /path/to/codebase'
      });
    }
    
    if (stats.patterns === 0 && stats.codeEntities > 0) {
      recommendations.push({
        type: 'patterns',
        message: 'No design patterns detected',
        action: 'Use define_domain_ontology to establish architectural patterns'
      });
    }
    
    if (stats.rules < 5) {
      recommendations.push({
        type: 'rules',
        message: 'Limited coding rules defined',
        action: 'Use define_domain_ontology to add more business rules and standards'
      });
    }
    
    if (stats.codeEntities > 100 && stats.standards === 0) {
      recommendations.push({
        type: 'standards',
        message: 'Large codebase without defined standards',
        action: 'Define coding standards to maintain consistency'
      });
    }

    if (stats.totalRelationships === 0 && stats.codeEntities > 0) {
      recommendations.push({
        type: 'relationships',
        message: 'Code entities exist but no relationships mapped',
        action: 'Run deeper analysis to detect dependencies and patterns'
      });
    }

    if (stats.decisions === 0 && stats.codeEntities > 50) {
      recommendations.push({
        type: 'decisions',
        message: 'No architectural decisions documented',
        action: 'Use update_kg_from_code to capture decision rationale'
      });
    }
    
    return recommendations;
  }

  async start() {
    const startTime = Date.now();
    
    try {
      logger.info('Starting MCP Vibe Coding Server', {
        version: this.config.mcp.serverVersion,
        environment: process.env.NODE_ENV || 'development'
      });

      // Connect to Kuzu
      this.kuzu = new KuzuClient(this.config.kuzu);
      await this.kuzu.connect();
      logger.info('Connected to Kuzu database', {
        path: this.config.kuzu.databasePath
      });

      // Setup database event listeners
      this.setupDatabaseEventListeners();

      // Initialize optimization system
      await this.initializeOptimizationSystem();

      // Start MCP server
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      const bootTime = Date.now() - startTime;
      logger.info('MCP Vibe Coding Server started successfully', {
        bootTime: `${bootTime}ms`,
        pid: process.pid
      });

      // Start health monitoring
      this.startHealthMonitoring();
      
    } catch (error) {
      logger.error('Failed to start server:', error);
      throw error;
    }
  }

  setupDatabaseEventListeners() {
    if (this.kuzu) {
      this.kuzu.on('connected', () => {
        logger.info('Database connected event received');
      });

      this.kuzu.on('error', (error) => {
        logger.error('Database error event:', error);
        this.metrics.errors++;
      });

      this.kuzu.on('queryError', ({ queryId, error, query }) => {
        logger.error('Database query error:', { queryId, error, query });
        this.metrics.errors++;
      });

      this.kuzu.on('healthCheck', ({ status, error }) => {
        if (status === 'unhealthy') {
          logger.warn('Database health check failed:', error);
        }
      });
    }
  }

  async initializeOptimizationSystem() {
    try {
      logger.info('Initializing optimization system...');
      
      // Create optimized configuration
      const optimizationConfig = createOptimizedConfig(this.config.optimization);
      
      // Initialize optimization manager
      this.optimizationManager = new OptimizationManager(optimizationConfig);
      await this.optimizationManager.initialize();
      
      // Initialize database optimization with connection factory
      if (this.kuzu) {
        await this.optimizationManager.initializeDatabaseConnection(
          () => this.kuzu.getConnection()
        );
      }
      
      // Register all handlers for optimization
      this.registerHandlersForOptimization();
      
      // Setup optimization event listeners
      this.setupOptimizationEventListeners();
      
      logger.info('Optimization system initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize optimization system:', error);
      // Continue without optimization if it fails
    }
  }

  registerHandlersForOptimization() {
    if (!this.optimizationManager) return;
    
    const handlerConfigs = {
      initialization: { cacheEnabled: true, batchingEnabled: false, priority: 'high' },
      context: { cacheEnabled: true, batchingEnabled: true, priority: 'medium' },
      codeGeneration: { cacheEnabled: true, batchingEnabled: false, priority: 'high' },
      validation: { cacheEnabled: true, batchingEnabled: true, priority: 'medium' },
      knowledgeGraph: { cacheEnabled: true, batchingEnabled: true, priority: 'high' },
      arduino: { cacheEnabled: true, batchingEnabled: false, priority: 'medium' }
    };
    
    for (const [name, handler] of Object.entries(this.handlers)) {
      const config = handlerConfigs[name] || { priority: 'medium' };
      this.optimizationManager.registerHandler(name, handler, config);
    }
  }

  setupOptimizationEventListeners() {
    if (!this.optimizationManager) return;
    
    this.optimizationManager.on('alert', (alert) => {
      logger.warn(`Optimization alert: ${alert.type}`, alert);
    });
    
    this.optimizationManager.on('optimizationCompleted', (optimization) => {
      logger.info(`Optimization completed: ${optimization.type}`, {
        duration: optimization.duration,
        success: optimization.success
      });
    });
    
    this.optimizationManager.on('requestOptimized', (request) => {
      logger.debug(`Request optimized for handler: ${request.handler}`, {
        duration: request.duration,
        success: request.success
      });
    });
  }

  startHealthMonitoring() {
    // Monitor server health every 30 seconds
    setInterval(async () => {
      try {
        const health = await this.getServerHealth();
        if (health.status !== 'healthy') {
          logger.warn('Server health check warning:', health);
        }
      } catch (error) {
        logger.error('Health monitoring error:', error);
      }
    }, 30000);
  }

  /**
   * Check if tool is code-related and needs advanced validation
   */
  isCodeRelatedTool(toolName) {
    const codeTools = [
      'validate_against_kg',
      'extract_context_from_code',
      'generate_code_with_context',
      'suggest_refactoring',
      'analyze_arduino_sketch',
      'generate_interrupt_safe_code'
    ];
    return codeTools.includes(toolName);
  }

  /**
   * Check if tool is sensitive and needs security validation
   */
  isSensitiveTool(toolName) {
    const sensitiveTools = [
      'analyze_codebase',
      'update_kg_from_code',
      'extract_context_from_code',
      'define_domain_ontology'
    ];
    return sensitiveTools.includes(toolName);
  }

  /**
   * Sanitize arguments for logging (remove sensitive data)
   */
  sanitizeArgsForLogging(args) {
    if (!args || typeof args !== 'object') return args;
    
    const sanitized = { ...args };
    
    // Truncate long strings
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 200) {
        sanitized[key] = sanitized[key].substring(0, 200) + '... [truncated for logging]';
      }
      
      // Remove potential credentials
      if (key.toLowerCase().includes('password') || 
          key.toLowerCase().includes('token') || 
          key.toLowerCase().includes('secret') ||
          key.toLowerCase().includes('key')) {
        sanitized[key] = '[REDACTED]';
      }
    });
    
    return sanitized;
  }

  /**
   * Get validation health metrics
   */
  getValidationHealth() {
    if (!this.validationSystem) {
      return { status: 'disabled', message: 'Validation system not initialized' };
    }
    
    return this.validationSystem.getSystemHealth();
  }

  /**
   * Get comprehensive server health including validation metrics
   */
  async getServerHealth() {
    try {
      const dbHealth = await this.kuzu.getHealthMetrics();
      const uptime = Date.now() - this.metrics.startTime;
      const avgResponseTime = this.metrics.toolCalls > 0 
        ? this.metrics.totalResponseTime / this.metrics.toolCalls 
        : 0;

      // Get validation health
      const validationHealth = this.getValidationHealth();
      
      // Determine overall health status
      let overallStatus = 'healthy';
      const issues = [];
      
      if (!dbHealth.isConnected) {
        overallStatus = 'unhealthy';
        issues.push('Database connection failed');
      }
      
      if (validationHealth.status === 'unhealthy') {
        overallStatus = 'degraded';
        issues.push('Validation system unhealthy');
      }
      
      if (avgResponseTime > 5000) {
        overallStatus = 'degraded';
        issues.push('High response times detected');
      }

      return {
        status: overallStatus,
        issues,
        uptime: `${Math.floor(uptime / 1000)}s`,
        database: dbHealth,
        validation: validationHealth,
        metrics: {
          ...this.metrics,
          avgResponseTime: `${avgResponseTime.toFixed(2)}ms`,
          errorRate: this.metrics.toolCalls > 0 
            ? (this.metrics.errors / this.metrics.toolCalls * 100).toFixed(2) + '%'
            : '0%',
          validationErrorRate: this.metrics.validationStats.totalValidations > 0
            ? (this.metrics.validationStats.validationErrors / this.metrics.validationStats.totalValidations * 100).toFixed(2) + '%'
            : '0%'
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message,
        issues: ['Health check failed']
      };
    }
  }

  async gracefulShutdown() {
    logger.info('Initiating graceful shutdown...');
    
    try {
      // Stop accepting new requests
      if (this.server) {
        await this.server.close?.();
      }

      // Close database connection
      if (this.kuzu) {
        await this.kuzu.close();
      }

      // Log final metrics
      const finalMetrics = {
        ...this.metrics,
        totalUptime: Date.now() - this.metrics.startTime
      };
      logger.info('Server shutdown complete', { finalMetrics });

      process.exit(0);
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  async stop() {
    await this.gracefulShutdown();
  }
}