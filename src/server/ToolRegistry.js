/**
 * CONTEXT: Tool registry for MCP server tool management
 * REASON: Extract tool registration and management logic from God class
 * CHANGE: Create dedicated class for tool definitions and dispatching
 * PREVENTION: Eliminates nested switch statements and centralizes tool management
 */

import { logger } from '../utils/logger.js';

export class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.toolDefinitions = new Map();
    this.handlers = new Map();
  }

  /**
   * Initialize the registry with tool definitions
   */
  initialize() {
    this.registerToolDefinitions();
    logger.info('Tool registry initialized', {
      toolCount: this.toolDefinitions.size
    });
  }

  /**
   * Register all available tools with their schemas
   */
  registerToolDefinitions() {
    // Core knowledge graph tools
    this.addToolDefinition('define_domain_ontology', {
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
      },
      handler: 'knowledgeGraph',
      method: 'defineDomainOntology'
    });

    this.addToolDefinition('query_context_for_task', {
      description: 'Query KG for relevant context before generating code',
      inputSchema: {
        type: 'object',
        properties: {
          taskDescription: { type: 'string' },
          entityTypes: { type: 'array', items: { type: 'string' } },
          depth: { type: 'integer', default: 2 }
        },
        required: ['taskDescription']
      },
      handler: 'context',
      method: 'queryContextForTask'
    });

    this.addToolDefinition('generate_code_with_context', {
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
      },
      handler: 'codeGeneration',
      method: 'generateWithContext'
    });

    this.addToolDefinition('validate_against_kg', {
      description: 'Validate code or decisions against KG knowledge',
      inputSchema: {
        type: 'object',
        properties: {
          codeSnippet: { type: 'string' },
          validationTypes: { type: 'array', items: { type: 'string' } },
          strictMode: { type: 'boolean', default: true }
        },
        required: ['codeSnippet']
      },
      handler: 'validation',
      method: 'validateAgainstKG'
    });

    this.addToolDefinition('extract_context_from_code', {
      description: 'Extract context from existing code comments',
      inputSchema: {
        type: 'object',
        properties: {
          filePath: { type: 'string' },
          codeSnippet: { type: 'string' }
        },
        required: ['filePath']
      },
      handler: 'context',
      method: 'extractFromCode'
    });

    this.addToolDefinition('detect_technical_debt', {
      description: 'Detect potential technical debt by querying KG',
      inputSchema: {
        type: 'object',
        properties: {
          scope: { type: 'string', enum: ['module', 'project', 'specific'] },
          target: { type: 'string' },
          debtTypes: { type: 'array', items: { type: 'string' } }
        },
        required: ['scope']
      },
      handler: 'validation',
      method: 'detectTechnicalDebt'
    });

    this.addToolDefinition('suggest_refactoring', {
      description: 'Suggest refactorings based on KG patterns',
      inputSchema: {
        type: 'object',
        properties: {
          codeEntity: { type: 'string' },
          improvementGoals: { type: 'array', items: { type: 'string' } },
          preserveBehavior: { type: 'boolean', default: true }
        },
        required: ['codeEntity']
      },
      handler: 'codeGeneration',
      method: 'suggestRefactoring'
    });

    this.addToolDefinition('update_kg_from_code', {
      description: 'Update KG with new entities, relations or patterns',
      inputSchema: {
        type: 'object',
        properties: {
          codeAnalysis: { type: 'object' },
          decisions: { type: 'array', items: { type: 'object' } },
          learnedPatterns: { type: 'array', items: { type: 'object' } }
        },
        required: ['codeAnalysis']
      },
      handler: 'knowledgeGraph',
      method: 'updateFromCode'
    });

    this.addToolDefinition('analyze_codebase', {
      description: 'Analyze entire codebase and update KG',
      inputSchema: {
        type: 'object',
        properties: {
          codebasePath: { type: 'string' },
          includeGitHistory: { type: 'boolean', default: true },
          maxDepth: { type: 'integer', default: 10 }
        },
        required: ['codebasePath']
      },
      handler: 'initialization',
      method: 'analyzeCodebase'
    });

    this.addToolDefinition('get_kg_statistics', {
      description: 'Get comprehensive statistics about the Knowledge Graph',
      inputSchema: {
        type: 'object',
        properties: {
          includeDetails: { type: 'boolean', default: false },
          entityType: { type: 'string' }
        }
      },
      handler: 'server',
      method: 'getKGStatistics'
    });

    // Arduino/C++ specific tools
    this.registerArduinoTools();

    // System tools
    this.registerSystemTools();
  }

  /**
   * Register Arduino-specific tools
   */
  registerArduinoTools() {
    this.addToolDefinition('analyze_arduino_sketch', {
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
      },
      handler: 'arduino',
      method: 'analyzeArduinoSketch'
    });

    this.addToolDefinition('validate_hardware_config', {
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
      },
      handler: 'arduino',
      method: 'validateHardwareConfiguration'
    });

    this.addToolDefinition('optimize_for_arduino', {
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
      },
      handler: 'arduino',
      method: 'optimizeForArduino'
    });

    this.addToolDefinition('generate_interrupt_safe_code', {
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
      },
      handler: 'arduino',
      method: 'generateInterruptSafeCode'
    });

    this.addToolDefinition('analyze_timing_constraints', {
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
      },
      handler: 'arduino',
      method: 'generateTimingAnalysis'
    });
  }

  /**
   * Register system management tools
   */
  registerSystemTools() {
    this.addToolDefinition('get_optimization_report', {
      description: 'Get comprehensive performance optimization report',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      },
      handler: 'server',
      method: 'getOptimizationReport'
    });

    this.addToolDefinition('force_optimization', {
      description: 'Force immediate optimization of all system components',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      },
      handler: 'server',
      method: 'forceOptimization'
    });

    this.addToolDefinition('get_server_health', {
      description: 'Get comprehensive server health status',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      },
      handler: 'server',
      method: 'getServerHealth'
    });
  }

  /**
   * Add a tool definition to the registry
   */
  addToolDefinition(name, definition) {
    this.toolDefinitions.set(name, definition);
  }

  /**
   * Register handlers for tool execution
   */
  registerHandlers(handlers) {
    for (const [name, handler] of Object.entries(handlers)) {
      this.handlers.set(name, handler);
    }
  }

  /**
   * Get all tool definitions for MCP ListTools response
   */
  getToolDefinitions() {
    const tools = [];
    
    for (const [name, definition] of this.toolDefinitions) {
      tools.push({
        name,
        description: definition.description,
        inputSchema: definition.inputSchema
      });
    }
    
    return tools;
  }

  /**
   * Get handler information for a tool
   */
  getToolHandler(toolName) {
    const definition = this.toolDefinitions.get(toolName);
    if (!definition) {
      return null;
    }

    return {
      handler: definition.handler,
      method: definition.method,
      definition
    };
  }

  /**
   * Execute a tool with its registered handler
   */
  async executeTool(toolName, args, context = {}) {
    const toolHandler = this.getToolHandler(toolName);
    if (!toolHandler) {
      throw new Error(`Unknown tool: ${toolName}`);
    }

    const { handler: handlerName, method } = toolHandler;
    const handler = this.handlers.get(handlerName);
    
    if (!handler) {
      throw new Error(`Handler not found for tool: ${toolName} (${handlerName})`);
    }

    // Special case for server methods
    if (handlerName === 'server' && context.server) {
      const serverMethod = context.server[method];
      if (!serverMethod) {
        throw new Error(`Server method not found: ${method}`);
      }
      return await serverMethod.call(context.server, args);
    }

    // Regular handler method execution
    const handlerMethod = handler[method];
    if (!handlerMethod) {
      throw new Error(`Method not found: ${method} on handler ${handlerName}`);
    }

    return await handlerMethod.call(handler, args);
  }

  /**
   * Check if a tool is code-related for validation purposes
   */
  isCodeRelatedTool(toolName) {
    const codeTools = new Set([
      'validate_against_kg',
      'extract_context_from_code',
      'generate_code_with_context',
      'suggest_refactoring',
      'analyze_arduino_sketch',
      'generate_interrupt_safe_code'
    ]);
    return codeTools.has(toolName);
  }

  /**
   * Check if a tool is security-sensitive
   */
  isSensitiveTool(toolName) {
    const sensitiveTools = new Set([
      'analyze_codebase',
      'update_kg_from_code',
      'extract_context_from_code',
      'define_domain_ontology'
    ]);
    return sensitiveTools.has(toolName);
  }

  /**
   * Get tool categories for organization
   */
  getToolsByCategory() {
    const categories = {
      knowledge_graph: [],
      code_generation: [],
      validation: [],
      arduino: [],
      system: []
    };

    for (const [name, definition] of this.toolDefinitions) {
      const { handler } = definition;
      
      switch (handler) {
        case 'knowledgeGraph':
          categories.knowledge_graph.push(name);
          break;
        case 'context':
        case 'codeGeneration':
          categories.code_generation.push(name);
          break;
        case 'validation':
          categories.validation.push(name);
          break;
        case 'arduino':
          categories.arduino.push(name);
          break;
        case 'server':
          categories.system.push(name);
          break;
      }
    }

    return categories;
  }
}