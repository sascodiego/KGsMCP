/**
 * CONTEXT: Refactored MCP Server with modular architecture
 * REASON: Replace God class with loosely coupled, focused components
 * CHANGE: Implement Service Locator, Command, and Strategy patterns
 * PREVENTION: Eliminates nested conditionals, reduces complexity, improves maintainability
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { ServiceLocator } from './ServiceLocator.js';
import { ToolRegistry } from './ToolRegistry.js';
import { ToolExecutor } from './ToolExecutor.js';
import { HealthMonitor } from './HealthMonitor.js';
import { logger } from '../utils/logger.js';
import { config, initializeConfigAsync } from '../utils/config.js';

export class RefactoredMCPServer {
  constructor(options = {}) {
    this.options = options;
    this.config = this.loadConfiguration(options);
    this.serviceLocator = null;
    this.toolRegistry = null;
    this.toolExecutor = null;
    this.healthMonitor = null;
    this.server = null;
    this.initialized = false;
  }

  /**
   * Load configuration using early return pattern
   */
  loadConfiguration(options) {
    if (options.configInstance) {
      return options.configInstance;
    }
    
    return config.load(options.config);
  }

  /**
   * Create server with async configuration loading
   */
  static async createAsync(options = {}) {
    try {
      const configInstance = await initializeConfigAsync(options.config);
      const serverOptions = { ...options, configInstance };
      
      const server = new RefactoredMCPServer(serverOptions);
      
      logger.info('Server created with async configuration loading', {
        configPath: options.config || 'default'
      });
      
      return server;
    } catch (error) {
      logger.error('Failed to create server with async config:', error);
      throw error;
    }
  }

  /**
   * Initialize server components using dependency injection
   */
  async initialize() {
    if (this.initialized) {
      logger.warn('Server already initialized');
      return;
    }

    try {
      // Initialize service locator with default services
      this.serviceLocator = ServiceLocator.createWithDefaults(this.config);
      
      // Initialize all services
      await this.serviceLocator.initializeServices();
      
      // Get core services
      this.toolRegistry = this.serviceLocator.get('toolRegistry');
      this.healthMonitor = this.serviceLocator.get('healthMonitor');
      
      // Initialize tool registry
      this.toolRegistry.initialize();
      
      // Create tool executor with middleware
      this.createToolExecutor();
      
      // Create MCP server instance
      this.createMCPServer();
      
      // Setup MCP request handlers
      this.setupRequestHandlers();
      
      // Setup error handling
      this.setupErrorHandling();
      
      // Initialize health monitoring with dependencies
      this.initializeHealthMonitoring();
      
      this.initialized = true;
      logger.info('Server components initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize server:', error);
      throw error;
    }
  }

  /**
   * Create tool executor with middleware pipeline
   */
  createToolExecutor() {
    this.toolExecutor = new ToolExecutor(this.serviceLocator);
    
    // Add middleware in order of execution
    this.addExecutionMiddleware();
    
    // Register handlers with tool registry
    this.registerToolHandlers();
  }

  /**
   * Add execution middleware using strategy pattern
   */
  addExecutionMiddleware() {
    // Logging middleware (first to execute, last to complete)
    this.toolExecutor.addMiddleware(
      ToolExecutor.createLoggingMiddleware()
    );
    
    // Metrics middleware
    this.toolExecutor.addMiddleware(
      ToolExecutor.createMetricsMiddleware(this.healthMonitor)
    );
    
    // Validation middleware (if available)
    const validationSystem = this.serviceLocator.has('validationSystem') 
      ? this.serviceLocator.get('validationSystem') 
      : null;
      
    if (validationSystem) {
      this.toolExecutor.addMiddleware(
        ToolExecutor.createValidationMiddleware(validationSystem)
      );
    }
  }

  /**
   * Register tool handlers with registry
   */
  registerToolHandlers() {
    const handlers = {
      initialization: this.serviceLocator.get('initializationHandler'),
      context: this.serviceLocator.get('contextHandler'),
      codeGeneration: this.serviceLocator.get('codeGenerationHandler'),
      validation: this.serviceLocator.get('validationHandler'),
      knowledgeGraph: this.serviceLocator.get('knowledgeGraphHandler'),
      arduino: this.serviceLocator.get('arduinoHandler'),
      server: this // Special case for server methods
    };
    
    this.toolRegistry.registerHandlers(handlers);
  }

  /**
   * Create MCP server instance
   */
  createMCPServer() {
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
  }

  /**
   * Setup MCP request handlers using early return pattern
   */
  setupRequestHandlers() {
    // List tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, () => {
      return { tools: this.toolRegistry.getToolDefinitions() };
    });

    // Call tool handler with simplified logic
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      return await this.handleToolCall(request);
    });
  }

  /**
   * Handle tool call with clean architecture
   */
  async handleToolCall(request) {
    const { name: toolName, arguments: args } = request.params;
    
    try {
      // Create execution context
      const context = {
        server: this,
        request,
        toolName,
        timestamp: Date.now()
      };
      
      // Execute command using command pattern
      const result = await this.toolExecutor.executeCommand(toolName, args, context);
      
      return result;
      
    } catch (error) {
      logger.error(`Tool execution failed: ${toolName}`, {
        error: error.message,
        toolName,
        args: this.sanitizeArgsForLogging(args)
      });
      
      return this.createErrorResponse(toolName, error);
    }
  }

  /**
   * Create error response with consistent format
   */
  createErrorResponse(toolName, error) {
    return {
      content: [
        {
          type: 'text',
          text: `Error executing ${toolName}: ${error.message}`
        }
      ]
    };
  }

  /**
   * Initialize health monitoring with proper dependencies
   */
  initializeHealthMonitoring() {
    const dependencies = {
      kuzu: this.serviceLocator.has('database') ? this.serviceLocator.get('database') : null,
      validationSystem: this.serviceLocator.has('validationSystem') ? this.serviceLocator.get('validationSystem') : null,
      optimizationManager: this.serviceLocator.has('optimizationManager') ? this.serviceLocator.get('optimizationManager') : null
    };
    
    this.healthMonitor.initialize(dependencies);
  }

  /**
   * Setup error handling with clean separation
   */
  setupErrorHandling() {
    // Global error handlers
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception:', error);
      this.gracefulShutdown();
    });

    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    });

    // MCP server error handling
    if (this.server) {
      this.server.onerror = (error) => {
        logger.error('MCP Server Error:', error);
        this.healthMonitor.updateMetrics({ errors: 1 });
      };
    }
  }

  /**
   * Start the server with clean initialization flow
   */
  async start() {
    const startTime = Date.now();
    
    try {
      logger.info('Starting Refactored MCP Server', {
        version: this.config.mcp.serverVersion,
        environment: process.env.NODE_ENV || 'development'
      });

      // Initialize if not already done
      if (!this.initialized) {
        await this.initialize();
      }

      // Connect database
      await this.connectDatabase();
      
      // Start MCP server transport
      await this.startTransport();
      
      // Start health monitoring
      this.healthMonitor.startMonitoring();
      
      const bootTime = Date.now() - startTime;
      logger.info('Refactored MCP Server started successfully', {
        bootTime: `${bootTime}ms`,
        pid: process.pid,
        components: this.getComponentStatus()
      });
      
    } catch (error) {
      logger.error('Failed to start server:', error);
      throw error;
    }
  }

  /**
   * Connect to database using service locator
   */
  async connectDatabase() {
    if (!this.serviceLocator.has('database')) {
      logger.warn('Database service not available');
      return;
    }

    const database = this.serviceLocator.get('database');
    await database.connect();
    
    logger.info('Database connected successfully', {
      path: this.config.kuzu.databasePath
    });
  }

  /**
   * Start MCP transport
   */
  async startTransport() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('MCP transport connected');
  }

  /**
   * Get component status for monitoring
   */
  getComponentStatus() {
    return {
      serviceLocator: this.serviceLocator ? 'initialized' : 'not initialized',
      toolRegistry: this.toolRegistry ? 'initialized' : 'not initialized',
      toolExecutor: this.toolExecutor ? 'initialized' : 'not initialized',
      healthMonitor: this.healthMonitor ? 'initialized' : 'not initialized',
      server: this.server ? 'initialized' : 'not initialized'
    };
  }

  /**
   * Server-specific methods (called by tool commands)
   */
  async getKGStatistics(args) {
    if (!this.serviceLocator.has('database')) {
      throw new Error('Database service not available');
    }

    const database = this.serviceLocator.get('database');
    const { includeDetails = false, entityType } = args;
    
    try {
      const basicStats = await this.getBasicKGStats(database);
      let detailedStats = {};
      let entityTypeStats = {};
      
      if (includeDetails) {
        detailedStats = await this.getDetailedKGStats(database);
      }
      
      if (entityType) {
        entityTypeStats = await this.getEntityTypeStats(database, entityType);
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
                totalNodes: Object.values(basicStats).reduce((sum, count) => sum + (count || 0), 0),
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

  /**
   * Get basic KG statistics using factory pattern
   */
  async getBasicKGStats(database) {
    const queries = [
      { name: 'codeEntities', query: 'MATCH (e:CodeEntity) RETURN count(e) as count' },
      { name: 'patterns', query: 'MATCH (p:Pattern) RETURN count(p) as count' },
      { name: 'rules', query: 'MATCH (r:Rule) RETURN count(r) as count' },
      { name: 'standards', query: 'MATCH (s:Standard) RETURN count(s) as count' },
      { name: 'decisions', query: 'MATCH (d:Decision) RETURN count(d) as count' }
    ];

    const results = await Promise.all(
      queries.map(async ({ name, query }) => {
        try {
          const result = await database.query(query);
          return [name, result[0]?.count || 0];
        } catch (error) {
          logger.error(`Failed to get ${name} count:`, error);
          return [name, 0];
        }
      })
    );

    return Object.fromEntries(results);
  }

  /**
   * Get detailed KG statistics
   */
  async getDetailedKGStats(database) {
    // Implementation would go here - keeping it simple for now
    return {
      entityBreakdown: [],
      patternStats: [],
      topFiles: [],
      ruleBreakdown: []
    };
  }

  /**
   * Get entity type statistics
   */
  async getEntityTypeStats(database, entityType) {
    // Implementation would go here - keeping it simple for now
    return {
      total: 0,
      avgComplexity: 0,
      maxComplexity: 0,
      sampleFiles: []
    };
  }

  /**
   * Assess KG health using strategy pattern
   */
  assessKGHealth(stats) {
    const healthStrategies = {
      empty: (stats) => stats.codeEntities === 0,
      minimal: (stats) => stats.codeEntities < 10,
      basic: (stats) => stats.patterns === 0,
      disconnected: (stats) => stats.codeEntities > 0 && Object.keys(stats.relationships || {}).length === 0,
      healthy: () => true
    };

    for (const [status, check] of Object.entries(healthStrategies)) {
      if (check(stats)) {
        return { status, message: this.getHealthMessage(status) };
      }
    }

    return { status: 'unknown', message: 'Unable to determine health status' };
  }

  /**
   * Get health message for status
   */
  getHealthMessage(status) {
    const messages = {
      empty: 'Knowledge Graph is empty. Run initialization first.',
      minimal: 'Knowledge Graph has minimal data. Consider analyzing more code.',
      basic: 'No patterns detected yet. Analysis may need more complex code.',
      disconnected: 'Entities exist but no relationships found. Run deeper analysis.',
      healthy: 'Knowledge Graph is well-populated and ready for use.'
    };

    return messages[status] || 'Status message not available';
  }

  /**
   * Generate KG recommendations
   */
  generateKGRecommendations(stats) {
    const recommendations = [];
    
    const recommendationStrategies = [
      {
        condition: (stats) => stats.codeEntities === 0,
        recommendation: {
          type: 'initialization',
          message: 'Initialize the Knowledge Graph with your codebase',
          action: 'Run: mcp-vibe-coding init /path/to/codebase'
        }
      },
      {
        condition: (stats) => stats.patterns === 0 && stats.codeEntities > 0,
        recommendation: {
          type: 'patterns',
          message: 'No design patterns detected',
          action: 'Use define_domain_ontology to establish architectural patterns'
        }
      }
    ];

    for (const strategy of recommendationStrategies) {
      if (strategy.condition(stats)) {
        recommendations.push(strategy.recommendation);
      }
    }

    return recommendations;
  }

  /**
   * Get optimization report
   */
  async getOptimizationReport() {
    if (!this.serviceLocator.has('optimizationManager')) {
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
      const optimizationManager = this.serviceLocator.get('optimizationManager');
      const report = optimizationManager.getOptimizationReport();
      
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
      return this.createErrorResponse('get_optimization_report', error);
    }
  }

  /**
   * Force optimization
   */
  async forceOptimization() {
    if (!this.serviceLocator.has('optimizationManager')) {
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
      const optimizationManager = this.serviceLocator.get('optimizationManager');
      
      await optimizationManager.forceOptimization();
      const duration = Date.now() - startTime;
      const report = optimizationManager.getOptimizationReport();
      
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
      return this.createErrorResponse('force_optimization', error);
    }
  }

  /**
   * Get server health
   */
  async getServerHealth() {
    try {
      const healthStatus = await this.healthMonitor.getComprehensiveHealth();
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(healthStatus, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Failed to get server health:', error);
      return this.createErrorResponse('get_server_health', error);
    }
  }

  /**
   * Sanitize arguments for logging
   */
  sanitizeArgsForLogging(args) {
    return ToolExecutor.sanitizeArgsForLogging(args);
  }

  /**
   * Graceful shutdown with proper cleanup
   */
  async gracefulShutdown() {
    logger.info('Initiating graceful shutdown...');
    
    try {
      // Stop health monitoring
      if (this.healthMonitor) {
        this.healthMonitor.stopMonitoring();
      }

      // Close MCP server
      if (this.server) {
        await this.server.close?.();
      }

      // Cleanup all services
      if (this.serviceLocator) {
        await this.serviceLocator.cleanup();
      }

      logger.info('Graceful shutdown completed');
      process.exit(0);
      
    } catch (error) {
      logger.error('Error during graceful shutdown:', error);
      process.exit(1);
    }
  }

  /**
   * Stop the server
   */
  async stop() {
    await this.gracefulShutdown();
  }
}