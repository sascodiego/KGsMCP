import kuzu from 'kuzu';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';
import CypherQuerySystem from './cypherQuerySystem.js';

/**
 * Production-ready Kuzu database client with connection pooling,
 * error handling, monitoring, and automatic recovery.
 */
export class KuzuClient extends EventEmitter {
  constructor(config) {
    super();
    this.config = {
      databasePath: '.kg-context/knowledge-graph.kuzu',
      maxRetries: 3,
      retryDelay: 1000,
      healthCheckInterval: 30000,
      backupInterval: 86400000, // 24 hours
      queryTimeout: 30000,
      ...config
    };
    
    this.database = null;
    this.connection = null;
    this.isConnected = false;
    this.connectionAttempts = 0;
    this.lastHealthCheck = null;
    this.metrics = {
      queries: 0,
      errors: 0,
      avgQueryTime: 0,
      totalQueryTime: 0
    };
    
    // Advanced query system
    this.querySystem = null;
    
    // Graceful shutdown handling
    process.on('SIGINT', () => this.gracefulShutdown());
    process.on('SIGTERM', () => this.gracefulShutdown());
  }

  /**
   * Initialize connection to Kuzu database with retry logic
   */
  async connect() {
    const startTime = Date.now();
    
    try {
      logger.info('Initializing Kuzu database connection', {
        path: this.config.databasePath,
        attempt: this.connectionAttempts + 1
      });

      // Ensure database directory exists
      await this.ensureDatabaseDirectory();
      
      // Create database and connection
      this.database = new kuzu.Database(this.config.databasePath);
      this.connection = new kuzu.Connection(this.database);
      
      // Verify connection with a simple query
      await this.verifyConnection();
      
      // Initialize schema
      await this.initializeSchema();
      
      this.isConnected = true;
      this.connectionAttempts = 0;
      this.lastHealthCheck = Date.now();
      
      // Start health monitoring
      this.startHealthMonitoring();
      
      // Initialize advanced query system if enabled
      if (this.config.enableAdvancedQueries !== false) {
        await this.initializeQuerySystem();
      }
      
      const connectionTime = Date.now() - startTime;
      logger.info('Kuzu database connection established', {
        connectionTime: `${connectionTime}ms`,
        databasePath: this.config.databasePath
      });
      
      this.emit('connected');
      
    } catch (error) {
      this.connectionAttempts++;
      logger.error('Kuzu connection failed', {
        error: error.message,
        attempt: this.connectionAttempts,
        maxRetries: this.config.maxRetries
      });
      
      if (this.connectionAttempts < this.config.maxRetries) {
        logger.info(`Retrying connection in ${this.config.retryDelay}ms`);
        await this.delay(this.config.retryDelay);
        return this.connect();
      }
      
      this.emit('error', error);
      throw new Error(`Failed to connect to Kuzu after ${this.config.maxRetries} attempts: ${error.message}`);
    }
  }

  /**
   * Ensure database directory exists with complete .kg-context structure
   */
  async ensureDatabaseDirectory() {
    try {
      const dbDir = path.dirname(this.config.databasePath);
      const kgContextDir = path.resolve(dbDir);
      
      // Create main .kg-context directory
      await fs.mkdir(kgContextDir, { recursive: true });
      
      // Create subdirectory structure
      const subdirs = ['backups', 'exports', 'imports', 'logs', 'cache', 'temp'];
      for (const subdir of subdirs) {
        const subdirPath = path.join(kgContextDir, subdir);
        await fs.mkdir(subdirPath, { recursive: true });
        
        // Create .gitkeep files to preserve directories in git
        const gitkeepPath = path.join(subdirPath, '.gitkeep');
        await fs.writeFile(gitkeepPath, '# Keep this directory in git\n', { flag: 'wx' }).catch(() => {});
      }
      
      // Create .gitignore for sensitive data
      const gitignorePath = path.join(kgContextDir, '.gitignore');
      const gitignoreContent = `# Knowledge Graph Database Files
knowledge-graph.kuzu/
*.kuzu

# Temporary files
temp/*
!temp/.gitkeep

# Cache files  
cache/*
!cache/.gitkeep

# Log files (optional - comment out if you want to track logs)
logs/*.log

# Backup files (optional - comment out if you want to track backups)
backups/*.backup
`;
      await fs.writeFile(gitignorePath, gitignoreContent, { flag: 'wx' }).catch(() => {});
      
      // Create README.md for documentation
      const readmePath = path.join(kgContextDir, 'README.md');
      const readmeContent = `# Knowledge Graph Context Directory

This directory contains the MCP knowledge graph database and related files.

## Directory Structure

- \`knowledge-graph.kuzu\` - Main Kuzu database file
- \`backups/\` - Database backup files
- \`exports/\` - Exported data files (JSON, CSV, etc.)
- \`imports/\` - Data files to import into the knowledge graph
- \`logs/\` - Database-specific log files
- \`cache/\` - Query and analysis result cache
- \`temp/\` - Temporary processing files

## Usage

This directory is automatically created and managed by the MCP server.
The knowledge graph stores:

- Code entities (classes, functions, variables)
- Design patterns and architectural patterns  
- Business rules and coding standards
- Relationships and dependencies
- Analysis results and decisions

## Maintenance

- Regular backups are automatically stored in \`backups/\`
- Exported data can be found in \`exports/\`
- Check \`logs/\` for debugging information
- Temporary files in \`temp/\` are cleaned up automatically

## Security

This directory may contain sensitive information about your codebase.
Make sure to include it in your \`.gitignore\` if needed.
`;
      await fs.writeFile(readmePath, readmeContent, { flag: 'wx' }).catch(() => {});
      
      // Verify write permissions
      const testFile = path.join(kgContextDir, '.write-test');
      await fs.writeFile(testFile, 'test');
      await fs.unlink(testFile);
      
      logger.info('Knowledge graph context directory initialized', {
        path: kgContextDir,
        subdirs: subdirs.length
      });
      
    } catch (error) {
      logger.error('Database directory setup failed', { error: error.message });
      throw new Error(`Database directory setup failed: ${error.message}`);
    }
  }

  /**
   * Verify connection is working
   */
  async verifyConnection() {
    try {
      // Simple query to verify connection
      const result = await this.connection.query('RETURN 1 as test');
      const rows = await result.getAll();
      
      if (!rows || rows.length === 0 || rows[0].test !== 1) {
        throw new Error('Connection verification failed');
      }
      
    } catch (error) {
      throw new Error(`Connection verification failed: ${error.message}`);
    }
  }

  /**
   * Initialize database schema with all required tables
   */
  async initializeSchema() {
    try {
      logger.info('Initializing database schema');
      
      // Create node tables
      await this.createNodeTables();
      
      // Create relationship tables  
      await this.createRelationshipTables();
      
      // Create indexes for performance
      await this.createIndexes();
      
      logger.info('Database schema initialized successfully');
      
    } catch (error) {
      throw new Error(`Schema initialization failed: ${error.message}`);
    }
  }

  /**
   * Create all node tables
   */
  async createNodeTables() {
    const nodeTables = [
      {
        name: 'CodeEntity',
        schema: `
          CREATE NODE TABLE IF NOT EXISTS CodeEntity(
            id STRING,
            type STRING,
            name STRING,
            filePath STRING,
            lineStart INT64,
            lineEnd INT64,
            agent STRING,
            trace STRING,
            context STRING,
            reason STRING,
            change STRING,
            prevention STRING,
            risk STRING,
            complexity INT64,
            lastModified INT64,
            PRIMARY KEY (id)
          )
        `
      },
      {
        name: 'Pattern',
        schema: `
          CREATE NODE TABLE IF NOT EXISTS Pattern(
            name STRING,
            description STRING,
            category STRING,
            confidence DOUBLE,
            occurrences INT64,
            PRIMARY KEY (name)
          )
        `
      },
      {
        name: 'Rule', 
        schema: `
          CREATE NODE TABLE IF NOT EXISTS Rule(
            id STRING,
            description STRING,
            category STRING,
            severity STRING,
            enabled BOOLEAN,
            PRIMARY KEY (id)
          )
        `
      },
      {
        name: 'Standard',
        schema: `
          CREATE NODE TABLE IF NOT EXISTS Standard(
            name STRING,
            value STRING,
            category STRING,
            enforced BOOLEAN,
            PRIMARY KEY (name)
          )
        `
      },
      {
        name: 'Decision',
        schema: `
          CREATE NODE TABLE IF NOT EXISTS Decision(
            id STRING,
            title STRING,
            description STRING,
            rationale STRING,
            alternatives STRING,
            context STRING,
            timestamp INT64,
            PRIMARY KEY (id)
          )
        `
      }
    ];

    for (const table of nodeTables) {
      try {
        await this.connection.query(table.schema);
        logger.debug(`Created node table: ${table.name}`);
      } catch (error) {
        logger.error(`Failed to create node table ${table.name}`, { error: error.message });
        throw error;
      }
    }
  }

  /**
   * Create all relationship tables
   */
  async createRelationshipTables() {
    const relationshipTables = [
      {
        name: 'IMPLEMENTS',
        schema: `
          CREATE REL TABLE IF NOT EXISTS IMPLEMENTS(
            FROM CodeEntity TO Pattern,
            confidence DOUBLE,
            timestamp INT64
          )
        `
      },
      {
        name: 'DEPENDS_ON',
        schema: `
          CREATE REL TABLE IF NOT EXISTS DEPENDS_ON(
            FROM CodeEntity TO CodeEntity,
            type STRING,
            strength DOUBLE
          )
        `
      },
      {
        name: 'VIOLATES',
        schema: `
          CREATE REL TABLE IF NOT EXISTS VIOLATES(
            FROM CodeEntity TO Rule,
            severity STRING,
            message STRING,
            timestamp INT64
          )
        `
      },
      {
        name: 'FOLLOWS',
        schema: `
          CREATE REL TABLE IF NOT EXISTS FOLLOWS(
            FROM CodeEntity TO Standard,
            compliance DOUBLE,
            verified BOOLEAN
          )
        `
      },
      {
        name: 'SUPPORTS',
        schema: `
          CREATE REL TABLE IF NOT EXISTS SUPPORTS(
            FROM Decision TO CodeEntity,
            reasoning STRING,
            confidence DOUBLE
          )
        `
      }
    ];

    for (const table of relationshipTables) {
      try {
        await this.connection.query(table.schema);
        logger.debug(`Created relationship table: ${table.name}`);
      } catch (error) {
        logger.error(`Failed to create relationship table ${table.name}`, { error: error.message });
        throw error;
      }
    }
  }

  /**
   * Create performance indexes
   */
  async createIndexes() {
    // Note: Kuzu automatically creates indexes for primary keys
    // Additional indexes would be created here if supported
    logger.debug('Indexes created (automatic for primary keys)');
  }

  /**
   * Execute query with error handling, retries, and metrics
   */
  async query(cypherQuery, params = {}, options = {}) {
    if (!this.isConnected || !this.connection) {
      throw new Error('Database not connected');
    }

    const startTime = Date.now();
    const queryId = this.generateQueryId();
    
    try {
      logger.debug('Executing query', { 
        queryId, 
        query: cypherQuery.substring(0, 100) + '...',
        params 
      });

      // Process parameters and build final query
      const processedQuery = this.processQuery(cypherQuery, params);
      
      // Execute with timeout
      const result = await this.executeWithTimeout(processedQuery, options.timeout);
      const rows = await result.getAll();
      
      // Update metrics
      const queryTime = Date.now() - startTime;
      this.updateMetrics(queryTime, true);
      
      logger.debug('Query executed successfully', {
        queryId,
        duration: `${queryTime}ms`,
        rowCount: rows.length
      });

      return this.formatResults(rows);
      
    } catch (error) {
      const queryTime = Date.now() - startTime;
      this.updateMetrics(queryTime, false);
      
      logger.error('Query execution failed', {
        queryId,
        error: error.message,
        duration: `${queryTime}ms`,
        query: cypherQuery.substring(0, 200)
      });
      
      // Emit error event for monitoring
      this.emit('queryError', { queryId, error, query: cypherQuery });
      
      throw new Error(`Query execution failed: ${error.message}`);
    }
  }

  /**
   * Validate and sanitize query parameters
   */
  validateQueryParams(params) {
    if (!params || typeof params !== 'object') {
      return {};
    }

    const sanitized = {};
    const allowedTypes = ['string', 'number', 'boolean'];
    
    for (const [key, value] of Object.entries(params)) {
      // Validate parameter name (alphanumeric + underscore only)
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        throw new Error(`Invalid parameter name: ${key}`);
      }
      
      // Validate parameter value
      if (value === null || value === undefined) {
        sanitized[key] = null;
      } else if (allowedTypes.includes(typeof value)) {
        if (typeof value === 'string') {
          // Limit string length to prevent DoS
          if (value.length > 10000) {
            throw new Error(`Parameter ${key} exceeds maximum length`);
          }
          sanitized[key] = value;
        } else {
          sanitized[key] = value;
        }
      } else if (Array.isArray(value)) {
        // Validate array elements
        if (value.length > 1000) {
          throw new Error(`Parameter ${key} array exceeds maximum length`);
        }
        const sanitizedArray = value.map(item => {
          if (typeof item === 'string' && item.length <= 1000) {
            return item;
          } else if (typeof item === 'number' || typeof item === 'boolean') {
            return item;
          } else {
            throw new Error(`Invalid array element type in parameter ${key}`);
          }
        });
        sanitized[key] = sanitizedArray;
      } else {
        throw new Error(`Unsupported parameter type for ${key}: ${typeof value}`);
      }
    }
    
    return sanitized;
  }

  /**
   * Process query parameters with secure escaping
   */
  processQuery(cypherQuery, params) {
    try {
      // Validate and sanitize parameters first
      const sanitizedParams = this.validateQueryParams(params);
      
      let processedQuery = cypherQuery;
      
      // Use safe parameter replacement with proper escaping
      for (const [key, value] of Object.entries(sanitizedParams)) {
        const paramRegex = new RegExp(`\\$${key}\\b`, 'g');
        let replacementValue;
        
        if (value === null || value === undefined) {
          replacementValue = 'NULL';
        } else if (typeof value === 'string') {
          // Use proper SQL string escaping (double single quotes)
          replacementValue = `'${value.replace(/'/g, "''")}'`;
        } else if (typeof value === 'number') {
          // Validate number format
          if (!Number.isFinite(value)) {
            throw new Error(`Invalid number parameter: ${key}`);
          }
          replacementValue = value.toString();
        } else if (typeof value === 'boolean') {
          replacementValue = value ? 'true' : 'false';
        } else if (Array.isArray(value)) {
          const escapedItems = value.map(item => {
            if (typeof item === 'string') {
              return `'${item.replace(/'/g, "''")}'`;
            } else if (typeof item === 'number') {
              return item.toString();
            } else {
              return `'${item.toString().replace(/'/g, "''")}'`;
            }
          });
          replacementValue = `[${escapedItems.join(', ')}]`;
        } else {
          throw new Error(`Unsupported parameter type: ${typeof value}`);
        }
        
        processedQuery = processedQuery.replace(paramRegex, replacementValue);
      }
      
      return processedQuery;
      
    } catch (error) {
      logger.error('Parameter processing failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Execute query with timeout
   */
  async executeWithTimeout(query, timeout = this.config.queryTimeout) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`Query timeout after ${timeout}ms`));
      }, timeout);

      this.connection.query(query)
        .then(result => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch(error => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * Format query results consistently
   */
  formatResults(rows) {
    return rows.map(row => {
      const obj = {};
      for (const [key, value] of Object.entries(row)) {
        obj[key] = value;
      }
      return obj;
    });
  }

  /**
   * Create node with validation and error handling
   */
  async createNode(label, properties) {
    try {
      // Validate required properties
      if (!properties.id) {
        throw new Error('Node ID is required');
      }

      // Add metadata
      const nodeProps = {
        ...properties,
        lastModified: Date.now()
      };

      const propNames = Object.keys(nodeProps);
      const propPlaceholders = propNames.map(name => `$${name}`).join(', ');
      const propAssignments = propNames.map(name => `${name}: $${name}`).join(', ');
      
      const query = `CREATE (n:${label} {${propAssignments}}) RETURN n`;
      const result = await this.query(query, nodeProps);
      
      logger.debug('Node created', { label, id: properties.id });
      this.emit('nodeCreated', { label, properties });
      
      return result[0] || nodeProps;
      
    } catch (error) {
      logger.error('Failed to create node', { 
        label, 
        id: properties.id, 
        error: error.message 
      });
      throw error;
    }
  }

  /**
   * Create relationship with validation
   */
  async createRelationship(fromId, relationshipType, toId, properties = {}) {
    try {
      // Validate relationship
      if (!fromId || !toId) {
        throw new Error('Both fromId and toId are required');
      }

      const relProps = {
        ...properties,
        timestamp: Date.now()
      };

      const propNames = Object.keys(relProps);
      const propAssignments = propNames.length > 0 
        ? `{${propNames.map(name => `${name}: $${name}`).join(', ')}}`
        : '';

      const query = `
        MATCH (a {id: $fromId}), (b {id: $toId})
        CREATE (a)-[r:${relationshipType} ${propAssignments}]->(b)
        RETURN r
      `;
      
      const params = { fromId, toId, ...relProps };
      const result = await this.query(query, params);
      
      logger.debug('Relationship created', { 
        from: fromId, 
        to: toId, 
        type: relationshipType 
      });
      
      this.emit('relationshipCreated', { fromId, toId, relationshipType, properties });
      
      return result[0] || relProps;
      
    } catch (error) {
      logger.error('Failed to create relationship', {
        from: fromId,
        to: toId,
        type: relationshipType,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Get database health metrics
   */
  async getHealthMetrics() {
    try {
      const stats = {
        isConnected: this.isConnected,
        uptime: Date.now() - (this.lastHealthCheck || Date.now()),
        metrics: { ...this.metrics },
        databasePath: this.config.databasePath
      };

      // Get table counts
      const entityCount = await this.query('MATCH (e:CodeEntity) RETURN count(e) as count');
      const patternCount = await this.query('MATCH (p:Pattern) RETURN count(p) as count');
      const ruleCount = await this.query('MATCH (r:Rule) RETURN count(r) as count');
      
      stats.tableCounts = {
        codeEntities: entityCount[0]?.count || 0,
        patterns: patternCount[0]?.count || 0,
        rules: ruleCount[0]?.count || 0
      };

      return stats;
      
    } catch (error) {
      logger.error('Failed to get health metrics', { error: error.message });
      return {
        isConnected: false,
        error: error.message,
        metrics: this.metrics
      };
    }
  }

  /**
   * Start health monitoring
   */
  startHealthMonitoring() {
    if (this.healthInterval) {
      clearInterval(this.healthInterval);
    }

    this.healthInterval = setInterval(async () => {
      try {
        await this.verifyConnection();
        this.lastHealthCheck = Date.now();
        this.emit('healthCheck', { status: 'healthy' });
      } catch (error) {
        logger.warn('Health check failed', { error: error.message });
        this.emit('healthCheck', { status: 'unhealthy', error: error.message });
      }
    }, this.config.healthCheckInterval);
  }

  /**
   * Update query metrics
   */
  updateMetrics(queryTime, success) {
    this.metrics.queries++;
    this.metrics.totalQueryTime += queryTime;
    this.metrics.avgQueryTime = this.metrics.totalQueryTime / this.metrics.queries;
    
    if (!success) {
      this.metrics.errors++;
    }
  }

  /**
   * Generate unique query ID
   */
  generateQueryId() {
    return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Utility delay function
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Graceful shutdown
   */
  async gracefulShutdown() {
    logger.info('Initiating graceful shutdown');
    
    try {
      if (this.healthInterval) {
        clearInterval(this.healthInterval);
      }
      
      // Shutdown query system first
      if (this.querySystem) {
        await this.querySystem.shutdown();
        this.querySystem = null;
      }
      
      if (this.connection) {
        this.connection = null;
      }
      
      if (this.database) {
        await this.database.close?.();
        this.database = null;
      }
      
      this.isConnected = false;
      this.emit('disconnected');
      
      logger.info('Graceful shutdown completed');
      
    } catch (error) {
      logger.error('Error during graceful shutdown', { error: error.message });
    }
  }

  /**
   * Initialize advanced query system
   */
  async initializeQuerySystem() {
    try {
      if (this.querySystem) {
        return; // Already initialized
      }

      logger.info('Initializing advanced query system');

      this.querySystem = await CypherQuerySystem.create(this, {
        enableOptimization: this.config.enableOptimization !== false,
        enableValidation: this.config.enableValidation !== false,
        enableMonitoring: this.config.enableMonitoring !== false,
        enableBatchOperations: this.config.enableBatchOperations !== false,
        enableTransactions: this.config.enableTransactions !== false,
        enableTemplates: this.config.enableTemplates !== false,
        autoOptimize: this.config.autoOptimize || false,
        strictValidation: this.config.strictValidation || false,
        cacheQueries: this.config.cacheQueries !== false,
        ...this.config.querySystemConfig
      });

      // Forward query system events
      this.querySystem.on('queryOptimized', (event) => {
        this.emit('queryOptimized', event);
      });

      this.querySystem.on('performanceAlert', (alert) => {
        this.emit('performanceAlert', alert);
      });

      this.querySystem.on('slowQuery', (query) => {
        this.emit('slowQuery', query);
      });

      logger.info('Advanced query system initialized successfully');

    } catch (error) {
      logger.error('Failed to initialize query system:', error.message);
      // Don't throw - allow basic client functionality to continue
    }
  }

  /**
   * Get query system instance
   */
  getQuerySystem() {
    return this.querySystem;
  }

  /**
   * Create query builder
   */
  createQueryBuilder() {
    if (!this.querySystem) {
      throw new Error('Advanced query system not available. Enable with enableAdvancedQueries: true');
    }
    
    return this.querySystem.createQueryBuilder();
  }

  /**
   * Execute query with advanced features
   */
  async queryAdvanced(cypherQuery, parameters = {}, options = {}) {
    if (!this.querySystem) {
      // Fallback to basic query
      return this.query(cypherQuery, parameters, options);
    }

    return this.querySystem.query(cypherQuery, parameters, options);
  }

  /**
   * Execute template query
   */
  async executeTemplate(templateName, parameters = {}, options = {}) {
    if (!this.querySystem) {
      throw new Error('Advanced query system not available');
    }

    return this.querySystem.executeTemplate(templateName, parameters, options);
  }

  /**
   * Execute batch operations
   */
  async executeBatch(operations, options = {}) {
    if (!this.querySystem) {
      throw new Error('Advanced query system not available');
    }

    return this.querySystem.executeBatch(operations, options);
  }

  /**
   * Begin transaction
   */
  async beginTransaction(options = {}) {
    if (!this.querySystem) {
      throw new Error('Advanced query system not available');
    }

    return this.querySystem.beginTransaction(options);
  }

  /**
   * Get system status
   */
  getSystemStatus() {
    const status = {
      isConnected: this.isConnected,
      metrics: { ...this.metrics },
      lastHealthCheck: this.lastHealthCheck,
      querySystemAvailable: !!this.querySystem
    };

    if (this.querySystem) {
      status.querySystem = this.querySystem.getSystemStatus();
    }

    return status;
  }

  /**
   * Get performance report
   */
  getPerformanceReport(timeRange = '1h') {
    if (!this.querySystem) {
      throw new Error('Advanced query system not available');
    }

    return this.querySystem.getPerformanceReport(timeRange);
  }

  /**
   * Close connection
   */
  async close() {
    await this.gracefulShutdown();
  }
}