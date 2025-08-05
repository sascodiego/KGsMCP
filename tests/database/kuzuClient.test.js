/**
 * KuzuClient Unit Tests
 * CONTEXT: Comprehensive testing for database client functionality
 * REASON: Ensure database reliability, connection handling, and query execution
 * CHANGE: Complete test coverage for database operations and error scenarios
 * PREVENTION: Database connection failures, query errors, data corruption
 */

import { jest } from '@jest/globals';
import { KuzuClient } from '../../src/database/kuzuClient.js';
import { mockLogger } from '../mocks/index.js';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies
jest.mock('../../src/utils/logger.js', () => ({
  logger: mockLogger
}));

jest.mock('kuzu', () => ({
  default: {
    Database: jest.fn(),
    Connection: jest.fn()
  }
}));

jest.mock('fs/promises');

describe('KuzuClient', () => {
  let kuzuClient;
  let mockDatabase;
  let mockConnection;
  let mockQuery;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock Kuzu classes
    mockQuery = jest.fn();
    mockConnection = {
      query: mockQuery
    };
    mockDatabase = {};
    
    // Setup Kuzu module mocks
    const kuzu = require('kuzu').default;
    kuzu.Database.mockImplementation(() => mockDatabase);
    kuzu.Connection.mockImplementation(() => mockConnection);
    
    // Mock file system
    fs.mkdir.mockResolvedValue();
    fs.access.mockResolvedValue();
    
    // Create client with test config
    kuzuClient = new KuzuClient({
      databasePath: '/test/db',
      maxRetries: 2,
      retryDelay: 100,
      healthCheckInterval: 1000,
      queryTimeout: 5000
    });
  });

  afterEach(async () => {
    if (kuzuClient) {
      await kuzuClient.close();
    }
  });

  describe('constructor', () => {
    test('should initialize with default config', () => {
      const client = new KuzuClient();
      expect(client.config.databasePath).toBe('.kg-context/knowledge-graph.kuzu');
      expect(client.config.maxRetries).toBe(3);
      expect(client.isConnected).toBe(false);
    });

    test('should override default config with provided options', () => {
      const config = {
        databasePath: '/custom/path',
        maxRetries: 5,
        retryDelay: 2000
      };
      
      const client = new KuzuClient(config);
      expect(client.config.databasePath).toBe('/custom/path');
      expect(client.config.maxRetries).toBe(5);
      expect(client.config.retryDelay).toBe(2000);
    });

    test('should initialize as EventEmitter', () => {
      expect(kuzuClient.on).toBeDefined();
      expect(kuzuClient.emit).toBeDefined();
    });
  });

  describe('connect', () => {
    test('should connect successfully on first attempt', async () => {
      // Mock successful connection
      mockQuery.mockResolvedValue([{ result: 'RETURN 1' }]);

      await kuzuClient.connect();

      expect(kuzuClient.isConnected).toBe(true);
      expect(kuzuClient.connectionAttempts).toBe(0);
      expect(fs.mkdir).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('connection established'),
        expect.any(Object)
      );
    });

    test('should create database directory if it does not exist', async () => {
      mockQuery.mockResolvedValue([{ result: 'RETURN 1' }]);

      await kuzuClient.connect();

      expect(fs.mkdir).toHaveBeenCalledWith(
        path.dirname('/test/db'),
        { recursive: true }
      );
    });

    test('should verify connection with test query', async () => {
      mockQuery.mockResolvedValue([{ result: 'RETURN 1' }]);

      await kuzuClient.connect();

      expect(mockQuery).toHaveBeenCalledWith('RETURN 1');
    });

    test('should retry connection on failure', async () => {
      // First two attempts fail, third succeeds
      const kuzu = require('kuzu').default;
      kuzu.Database
        .mockImplementationOnce(() => { throw new Error('Connection failed'); })
        .mockImplementationOnce(() => { throw new Error('Connection failed'); })
        .mockImplementationOnce(() => mockDatabase);
      
      mockQuery.mockResolvedValue([{ result: 'RETURN 1' }]);

      await kuzuClient.connect();

      expect(kuzuClient.isConnected).toBe(true);
      expect(kuzu.Database).toHaveBeenCalledTimes(3);
    });

    test('should fail after max retries', async () => {
      const kuzu = require('kuzu').default;
      kuzu.Database.mockImplementation(() => { 
        throw new Error('Persistent connection failure'); 
      });

      await expect(kuzuClient.connect()).rejects.toThrow('Persistent connection failure');
      expect(kuzuClient.isConnected).toBe(false);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should emit connected event on successful connection', async () => {
      mockQuery.mockResolvedValue([{ result: 'RETURN 1' }]);
      
      const connectedPromise = new Promise(resolve => {
        kuzuClient.on('connected', resolve);
      });

      await kuzuClient.connect();
      await connectedPromise;

      expect(kuzuClient.isConnected).toBe(true);
    });

    test('should initialize schema after connection', async () => {
      mockQuery.mockResolvedValue([{ result: 'success' }]);

      await kuzuClient.connect();

      // Verify schema initialization queries were called
      const schemaCalls = mockQuery.mock.calls.filter(call => 
        call[0].includes('CREATE NODE TABLE') || call[0].includes('CREATE REL TABLE')
      );
      expect(schemaCalls.length).toBeGreaterThan(0);
    });
  });

  describe('query', () => {
    beforeEach(async () => {
      mockQuery.mockResolvedValue([{ result: 'RETURN 1' }]);
      await kuzuClient.connect();
      jest.clearAllMocks();
    });

    test('should execute query successfully', async () => {
      const expectedResult = [{ name: 'test', value: 123 }];
      mockQuery.mockResolvedValue(expectedResult);

      const result = await kuzuClient.query('MATCH (n) RETURN n');

      expect(mockQuery).toHaveBeenCalledWith('MATCH (n) RETURN n');
      expect(result).toEqual(expectedResult);
    });

    test('should handle parameterized queries', async () => {
      const expectedResult = [{ user: 'john' }];
      mockQuery.mockResolvedValue(expectedResult);

      const result = await kuzuClient.query(
        'MATCH (u:User {name: $name}) RETURN u',
        { name: 'john' }
      );

      expect(mockQuery).toHaveBeenCalledWith(
        "MATCH (u:User {name: 'john'}) RETURN u"
      );
      expect(result).toEqual(expectedResult);
    });

    test('should handle different parameter types', async () => {
      mockQuery.mockResolvedValue([{ result: 'success' }]);

      await kuzuClient.query(
        'CREATE (n:Test {name: $name, age: $age, active: $active})',
        { name: 'test', age: 25, active: true }
      );

      expect(mockQuery).toHaveBeenCalledWith(
        "CREATE (n:Test {name: 'test', age: 25, active: true})"
      );
    });

    test('should escape string parameters properly', async () => {
      mockQuery.mockResolvedValue([{ result: 'success' }]);

      await kuzuClient.query(
        'CREATE (n:Test {description: $desc})',
        { desc: "It's a test with 'quotes'" }
      );

      expect(mockQuery).toHaveBeenCalledWith(
        "CREATE (n:Test {description: 'It\\'s a test with \\'quotes\\''})"
      );
    });

    test('should throw error if not connected', async () => {
      kuzuClient.isConnected = false;

      await expect(kuzuClient.query('MATCH (n) RETURN n'))
        .rejects.toThrow('Database not connected');
    });

    test('should track query metrics', async () => {
      mockQuery.mockResolvedValue([{ result: 'success' }]);

      await kuzuClient.query('RETURN 1');
      await kuzuClient.query('RETURN 2');

      expect(kuzuClient.metrics.queries).toBe(2);
      expect(kuzuClient.metrics.totalQueryTime).toBeGreaterThan(0);
    });

    test('should handle query timeout', async () => {
      // Mock a query that never resolves
      mockQuery.mockImplementation(() => new Promise(() => {}));
      
      kuzuClient.config.queryTimeout = 100; // 100ms timeout

      await expect(kuzuClient.query('SLOW QUERY'))
        .rejects.toThrow('Query timeout');
    });

    test('should increment error metrics on query failure', async () => {
      mockQuery.mockRejectedValue(new Error('Query failed'));

      await expect(kuzuClient.query('INVALID QUERY'))
        .rejects.toThrow('Query failed');

      expect(kuzuClient.metrics.errors).toBe(1);
    });
  });

  describe('createNode', () => {
    beforeEach(async () => {
      mockQuery.mockResolvedValue([{ result: 'RETURN 1' }]);
      await kuzuClient.connect();
      jest.clearAllMocks();
    });

    test('should create node with properties', async () => {
      const nodeProperties = { id: 'test1', name: 'Test Node', type: 'test' };
      mockQuery.mockResolvedValue([nodeProperties]);

      const result = await kuzuClient.createNode('TestNode', nodeProperties);

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (n:TestNode'),
        expect.any(Object)
      );
      expect(result).toEqual(nodeProperties);
    });

    test('should handle empty properties', async () => {
      mockQuery.mockResolvedValue([{ id: 'generated' }]);

      const result = await kuzuClient.createNode('EmptyNode', {});

      expect(mockQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test('should handle special characters in properties', async () => {
      const properties = { 
        name: "Node with 'quotes' and \"double quotes\"",
        description: 'Line 1\nLine 2'
      };
      mockQuery.mockResolvedValue([properties]);

      await kuzuClient.createNode('SpecialNode', properties);

      expect(mockQuery).toHaveBeenCalled();
    });
  });

  describe('createRelationship', () => {
    beforeEach(async () => {
      mockQuery.mockResolvedValue([{ result: 'RETURN 1' }]);
      await kuzuClient.connect();
      jest.clearAllMocks();
    });

    test('should create relationship between nodes', async () => {
      const relProperties = { strength: 0.8, type: 'dependency' };
      mockQuery.mockResolvedValue([relProperties]);

      const result = await kuzuClient.createRelationship(
        'node1', 'DEPENDS_ON', 'node2', relProperties
      );

      expect(mockQuery).toHaveBeenCalledWith(
        expect.stringContaining('CREATE (a)-[r:DEPENDS_ON'),
        expect.objectContaining({
          fromId: 'node1',
          toId: 'node2'
        })
      );
      expect(result).toEqual(relProperties);
    });

    test('should create relationship without properties', async () => {
      mockQuery.mockResolvedValue([{}]);

      const result = await kuzuClient.createRelationship(
        'node1', 'CONNECTS_TO', 'node2'
      );

      expect(mockQuery).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    test('should handle non-existent nodes gracefully', async () => {
      mockQuery.mockRejectedValue(new Error('Node not found'));

      await expect(kuzuClient.createRelationship(
        'nonexistent1', 'RELATES_TO', 'nonexistent2'
      )).rejects.toThrow('Node not found');
    });
  });

  describe('health monitoring', () => {
    test('should start health monitoring after connection', async () => {
      mockQuery.mockResolvedValue([{ result: 'RETURN 1' }]);
      
      await kuzuClient.connect();

      expect(kuzuClient.lastHealthCheck).toBeTruthy();
    });

    test('should perform periodic health checks', async () => {
      mockQuery.mockResolvedValue([{ result: 'RETURN 1' }]);
      kuzuClient.config.healthCheckInterval = 50; // 50ms for testing
      
      await kuzuClient.connect();
      
      // Wait for health check
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const healthCheckCalls = mockQuery.mock.calls.filter(call => 
        call[0] === 'RETURN 1'
      );
      expect(healthCheckCalls.length).toBeGreaterThan(1);
    });

    test('should emit error event on health check failure', async () => {
      mockQuery.mockResolvedValue([{ result: 'RETURN 1' }]);
      await kuzuClient.connect();
      
      // Make health check fail
      mockQuery.mockRejectedValue(new Error('Health check failed'));
      
      const errorPromise = new Promise(resolve => {
        kuzuClient.on('error', resolve);
      });
      
      // Trigger health check
      await kuzuClient.performHealthCheck();
      
      const error = await errorPromise;
      expect(error.message).toContain('Health check failed');
    });
  });

  describe('close', () => {
    test('should close connection gracefully', async () => {
      mockQuery.mockResolvedValue([{ result: 'RETURN 1' }]);
      await kuzuClient.connect();

      await kuzuClient.close();

      expect(kuzuClient.isConnected).toBe(false);
      expect(kuzuClient.connection).toBeNull();
      expect(kuzuClient.database).toBeNull();
    });

    test('should clear health check interval on close', async () => {
      mockQuery.mockResolvedValue([{ result: 'RETURN 1' }]);
      await kuzuClient.connect();
      
      const clearIntervalSpy = jest.spyOn(global, 'clearInterval');
      
      await kuzuClient.close();
      
      expect(clearIntervalSpy).toHaveBeenCalled();
    });

    test('should handle close when not connected', async () => {
      await expect(kuzuClient.close()).resolves.not.toThrow();
    });
  });

  describe('error handling', () => {
    test('should handle database initialization errors', async () => {
      const kuzu = require('kuzu').default;
      kuzu.Database.mockImplementation(() => {
        throw new Error('Database initialization failed');
      });

      await expect(kuzuClient.connect()).rejects.toThrow();
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should handle connection verification errors', async () => {
      mockQuery.mockRejectedValue(new Error('Verification failed'));

      await expect(kuzuClient.connect()).rejects.toThrow();
    });

    test('should handle schema initialization errors', async () => {
      mockQuery
        .mockResolvedValueOnce([{ result: 'RETURN 1' }]) // Verification succeeds
        .mockRejectedValue(new Error('Schema creation failed')); // Schema fails

      await expect(kuzuClient.connect()).rejects.toThrow('Schema creation failed');
    });

    test('should handle query parameter errors', async () => {
      mockQuery.mockResolvedValue([{ result: 'RETURN 1' }]);
      await kuzuClient.connect();

      // Test with circular reference (should not crash)
      const circularObj = {};
      circularObj.self = circularObj;

      await expect(kuzuClient.query('RETURN $param', { param: circularObj }))
        .rejects.toThrow();
    });
  });

  describe('metrics', () => {
    beforeEach(async () => {
      mockQuery.mockResolvedValue([{ result: 'RETURN 1' }]);
      await kuzuClient.connect();
      jest.clearAllMocks();
    });

    test('should track query execution time', async () => {
      mockQuery.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([]), 50))
      );

      await kuzuClient.query('SLOW QUERY');

      expect(kuzuClient.metrics.queries).toBe(1);
      expect(kuzuClient.metrics.totalQueryTime).toBeGreaterThan(40);
      expect(kuzuClient.metrics.avgQueryTime).toBeGreaterThan(40);
    });

    test('should update average query time correctly', async () => {
      mockQuery.mockResolvedValue([]);

      await kuzuClient.query('QUERY 1');
      await kuzuClient.query('QUERY 2');
      await kuzuClient.query('QUERY 3');

      expect(kuzuClient.metrics.queries).toBe(3);
      expect(kuzuClient.metrics.avgQueryTime).toBeGreaterThan(0);
    });

    test('should provide metrics summary', () => {
      const metrics = kuzuClient.getMetrics();

      expect(metrics).toHaveProperty('queries');
      expect(metrics).toHaveProperty('errors');
      expect(metrics).toHaveProperty('avgQueryTime');
      expect(metrics).toHaveProperty('totalQueryTime');
      expect(metrics).toHaveProperty('uptime');
      expect(metrics).toHaveProperty('isConnected');
    });
  });

  describe('graceful shutdown', () => {
    test('should handle graceful shutdown', async () => {
      mockQuery.mockResolvedValue([{ result: 'RETURN 1' }]);
      await kuzuClient.connect();

      const closeSpy = jest.spyOn(kuzuClient, 'close');
      
      await kuzuClient.gracefulShutdown();

      expect(closeSpy).toHaveBeenCalled();
      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.stringContaining('Graceful shutdown')
      );
    });

    test('should handle shutdown errors', async () => {
      mockQuery.mockResolvedValue([{ result: 'RETURN 1' }]);
      await kuzuClient.connect();

      jest.spyOn(kuzuClient, 'close').mockRejectedValue(new Error('Close failed'));
      
      await kuzuClient.gracefulShutdown();

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Error during shutdown'),
        expect.any(Object)
      );
    });
  });

  describe('performance optimization', () => {
    beforeEach(async () => {
      mockQuery.mockResolvedValue([{ result: 'RETURN 1' }]);
      await kuzuClient.connect();
      jest.clearAllMocks();
    });

    test('should handle concurrent queries', async () => {
      const queries = Array.from({ length: 10 }, (_, i) => 
        kuzuClient.query(`RETURN ${i}`)
      );

      mockQuery.mockImplementation(query => 
        Promise.resolve([{ result: query }])
      );

      const results = await Promise.all(queries);

      expect(results).toHaveLength(10);
      expect(mockQuery).toHaveBeenCalledTimes(10);
    });

    test('should handle large result sets efficiently', async () => {
      const largeResult = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        name: `Item ${i}`,
        data: 'large data string'.repeat(10)
      }));

      mockQuery.mockResolvedValue(largeResult);

      global.performanceMonitor.start('large-query');
      const result = await kuzuClient.query('MATCH (n) RETURN n');
      const duration = global.performanceMonitor.end('large-query');

      expect(result).toHaveLength(10000);
      expect(duration).toBeWithinPerformanceThreshold(1000); // 1 second max
    });
  });
});