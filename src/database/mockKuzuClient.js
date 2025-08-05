import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';
import { EventEmitter } from 'events';

/**
 * CONTEXT: Mock Kuzu client for development and testing when Kuzu is not available
 * REASON: Allows CLI testing and development without Kuzu installation issues
 * CHANGE: Mock implementation that simulates Kuzu behavior for demonstration
 * PREVENTION: Blocking development due to native library issues
 */
export class MockKuzuClient extends EventEmitter {
  constructor(config) {
    super();
    this.config = {
      databasePath: '.kg-context/knowledge-graph.kuzu',
      maxRetries: 3,
      retryDelay: 1000,
      healthCheckInterval: 30000,
      backupInterval: 86400000,
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
    
    // Mock data storage
    this.mockData = {
      CodeEntity: [],
      Pattern: [],
      Rule: [],
      Standard: [],
      Decision: []
    };
    
    // Graceful shutdown handling
    process.on('SIGINT', () => this.gracefulShutdown());
    process.on('SIGTERM', () => this.gracefulShutdown());
  }

  async connect() {
    const startTime = Date.now();
    
    try {
      logger.info('Connecting to Mock Kuzu database', {
        path: this.config.databasePath,
        attempt: this.connectionAttempts + 1
      });

      // Ensure database directory exists
      await this.ensureDatabaseDirectory();
      
      // Simulate connection delay
      await this.delay(100);
      
      this.isConnected = true;
      this.connectionAttempts = 0;
      this.lastHealthCheck = Date.now();
      
      const connectionTime = Date.now() - startTime;
      logger.info('Mock Kuzu database connection established', {
        connectionTime: `${connectionTime}ms`,
        databasePath: this.config.databasePath
      });
      
      this.emit('connected');
      
    } catch (error) {
      this.connectionAttempts++;
      logger.error('Mock Kuzu connection failed', {
        error: error.message,
        attempt: this.connectionAttempts,
        maxRetries: this.config.maxRetries
      });
      
      this.emit('error', error);
      throw new Error(`Failed to connect to Mock Kuzu: ${error.message}`);
    }
  }

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
      
      logger.info('Mock Knowledge graph context directory initialized', {
        path: kgContextDir,
        subdirs: subdirs.length
      });
      
    } catch (error) {
      logger.error('Database directory setup failed', { error: error.message });
      throw new Error(`Database directory setup failed: ${error.message}`);
    }
  }

  async query(cypherQuery, params = {}, options = {}) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }

    const startTime = Date.now();
    const queryId = this.generateQueryId();
    
    try {
      logger.debug('Executing mock query', { 
        queryId, 
        query: cypherQuery.substring(0, 100) + '...',
        params 
      });

      // Simulate query execution delay
      await this.delay(Math.random() * 50 + 10);
      
      // Mock query responses
      let results = [];
      
      if (cypherQuery.includes('RETURN 1 as test')) {
        results = [{ test: 1 }];
      } else if (cypherQuery.includes('MATCH (e:CodeEntity)')) {
        results = this.mockData.CodeEntity.map(e => ({ e }));
      } else if (cypherQuery.includes('MATCH (p:Pattern)')) {
        results = this.mockData.Pattern.map(p => ({ p }));
      } else if (cypherQuery.includes('count(')) {
        const match = cypherQuery.match(/MATCH \((\w+):(\w+)\)/);
        if (match) {
          const [, variable, nodeType] = match;
          const count = this.mockData[nodeType]?.length || 0;
          results = [{ count }];
        }
      }
      
      // Update metrics
      const queryTime = Date.now() - startTime;
      this.updateMetrics(queryTime, true);
      
      logger.debug('Mock query executed successfully', {
        queryId,
        duration: `${queryTime}ms`,
        rowCount: results.length
      });

      return results;
      
    } catch (error) {
      const queryTime = Date.now() - startTime;
      this.updateMetrics(queryTime, false);
      
      logger.error('Mock query execution failed', {
        queryId,
        error: error.message,
        duration: `${queryTime}ms`,
        query: cypherQuery.substring(0, 200)
      });
      
      this.emit('queryError', { queryId, error, query: cypherQuery });
      throw new Error(`Mock query execution failed: ${error.message}`);
    }
  }

  async createNode(label, properties) {
    try {
      if (!properties.id) {
        throw new Error('Node ID is required');
      }

      const nodeProps = {
        ...properties,
        lastModified: Date.now()
      };

      // Store in mock data
      if (!this.mockData[label]) {
        this.mockData[label] = [];
      }
      
      // Remove existing node with same ID
      this.mockData[label] = this.mockData[label].filter(n => n.id !== properties.id);
      
      // Add new node
      this.mockData[label].push(nodeProps);
      
      logger.debug('Mock node created', { label, id: properties.id });
      this.emit('nodeCreated', { label, properties });
      
      return nodeProps;
      
    } catch (error) {
      logger.error('Failed to create mock node', { 
        label, 
        id: properties.id, 
        error: error.message 
      });
      throw error;
    }
  }

  async createRelationship(fromId, relationshipType, toId, properties = {}) {
    try {
      if (!fromId || !toId) {
        throw new Error('Both fromId and toId are required');
      }

      const relProps = {
        ...properties,
        timestamp: Date.now(),
        fromId,
        toId,
        type: relationshipType
      };

      // Store relationship in mock data
      if (!this.mockData.relationships) {
        this.mockData.relationships = [];
      }
      
      this.mockData.relationships.push(relProps);
      
      logger.debug('Mock relationship created', { 
        from: fromId, 
        to: toId, 
        type: relationshipType 
      });
      
      this.emit('relationshipCreated', { fromId, toId, relationshipType, properties });
      
      return relProps;
      
    } catch (error) {
      logger.error('Failed to create mock relationship', {
        from: fromId,
        to: toId,
        type: relationshipType,
        error: error.message
      });
      throw error;
    }
  }

  async getHealthMetrics() {
    try {
      const stats = {
        isConnected: this.isConnected,
        uptime: Date.now() - (this.lastHealthCheck || Date.now()),
        metrics: { ...this.metrics },
        databasePath: this.config.databasePath,
        mode: 'mock'
      };

      // Get table counts from mock data
      stats.tableCounts = {
        codeEntities: this.mockData.CodeEntity?.length || 0,
        patterns: this.mockData.Pattern?.length || 0,
        rules: this.mockData.Rule?.length || 0,
        standards: this.mockData.Standard?.length || 0,
        decisions: this.mockData.Decision?.length || 0
      };

      return stats;
      
    } catch (error) {
      logger.error('Failed to get mock health metrics', { error: error.message });
      return {
        isConnected: false,
        error: error.message,
        metrics: this.metrics,
        mode: 'mock'
      };
    }
  }

  updateMetrics(queryTime, success) {
    this.metrics.queries++;
    this.metrics.totalQueryTime += queryTime;
    this.metrics.avgQueryTime = this.metrics.totalQueryTime / this.metrics.queries;
    
    if (!success) {
      this.metrics.errors++;
    }
  }

  generateQueryId() {
    return `q_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async gracefulShutdown() {
    logger.info('Initiating mock graceful shutdown');
    
    try {
      this.isConnected = false;
      this.emit('disconnected');
      
      logger.info('Mock graceful shutdown completed');
      
    } catch (error) {
      logger.error('Error during mock graceful shutdown', { error: error.message });
    }
  }

  async close() {
    await this.gracefulShutdown();
  }
}