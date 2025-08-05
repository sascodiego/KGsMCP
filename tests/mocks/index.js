/**
 * Mock exports for testing
 * CONTEXT: Centralized mock implementations for test isolation
 * REASON: Consistent mocking across all test suites
 * CHANGE: Comprehensive mock factory with service mocking
 * PREVENTION: Test interdependencies, external service calls, resource conflicts
 */

import { jest } from '@jest/globals';
import { MockKuzuClient } from './mockKuzuClient.js';

// Mock logger
export const mockLogger = {
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  child: jest.fn(() => mockLogger),
  level: 'error'
};

// Mock file system operations
export const mockFs = {
  readFile: jest.fn(),
  writeFile: jest.fn(),
  mkdir: jest.fn(),
  rmdir: jest.fn(),
  access: jest.fn(),
  stat: jest.fn(),
  readdir: jest.fn()
};

// Mock Git operations
export const mockGit = {
  log: jest.fn(() => Promise.resolve({
    all: [
      {
        hash: 'abc123',
        date: '2024-01-01',
        message: 'Test commit',
        author_name: 'Test Author',
        author_email: 'test@example.com'
      }
    ]
  })),
  diff: jest.fn(() => Promise.resolve('diff content')),
  status: jest.fn(() => Promise.resolve({
    files: [],
    staged: [],
    modified: []
  })),
  show: jest.fn(() => Promise.resolve('file content'))
};

// Mock performance monitor
export const mockPerformanceMonitor = {
  startMeasurement: jest.fn(),
  endMeasurement: jest.fn(() => 100),
  getMetrics: jest.fn(() => ({
    averageQueryTime: 50,
    totalQueries: 10,
    cacheHitRate: 0.85
  })),
  reset: jest.fn()
};

// Mock cache implementation
export class MockCache {
  constructor() {
    this.data = new Map();
    this.hitCount = 0;
    this.missCount = 0;
  }

  async get(key) {
    if (this.data.has(key)) {
      this.hitCount++;
      return this.data.get(key);
    }
    this.missCount++;
    return null;
  }

  async set(key, value, ttl = 0) {
    this.data.set(key, { value, expires: ttl > 0 ? Date.now() + ttl : 0 });
    return true;
  }

  async delete(key) {
    return this.data.delete(key);
  }

  async clear() {
    this.data.clear();
    this.hitCount = 0;
    this.missCount = 0;
  }

  getStats() {
    return {
      size: this.data.size,
      hitCount: this.hitCount,
      missCount: this.missCount,
      hitRate: this.hitCount / (this.hitCount + this.missCount) || 0
    };
  }
}

// Mock MCP server
export class MockMCPServer {
  constructor() {
    this.tools = new Map();
    this.requests = [];
    this.connected = false;
  }

  registerTool(name, handler) {
    this.tools.set(name, handler);
  }

  async handleRequest(toolName, args) {
    this.requests.push({ toolName, args, timestamp: Date.now() });
    
    const handler = this.tools.get(toolName);
    if (handler) {
      return await handler(args);
    }
    
    throw new Error(`Unknown tool: ${toolName}`);
  }

  connect() {
    this.connected = true;
  }

  disconnect() {
    this.connected = false;
  }

  getRequestHistory() {
    return [...this.requests];
  }

  clearHistory() {
    this.requests = [];
  }
}

// Mock external services
export const mockExternalServices = {
  aiService: {
    generateCode: jest.fn(() => Promise.resolve({
      code: 'function mockGenerated() { return "test"; }',
      confidence: 0.95
    })),
    analyzeCode: jest.fn(() => Promise.resolve({
      patterns: ['Factory'],
      complexity: 0.3,
      suggestions: []
    }))
  },
  
  validationService: {
    validateSyntax: jest.fn(() => Promise.resolve({ valid: true, errors: [] })),
    checkSecurity: jest.fn(() => Promise.resolve({ secure: true, issues: [] })),
    analyzePerformance: jest.fn(() => Promise.resolve({ score: 85, bottlenecks: [] }))
  }
};

// Factory functions
export function createMockEnvironment() {
  return {
    kuzuClient: new MockKuzuClient(),
    logger: mockLogger,
    cache: new MockCache(),
    server: new MockMCPServer(),
    performanceMonitor: mockPerformanceMonitor
  };
}

export function createTestData() {
  return {
    entities: [
      {
        id: 'test-entity-1',
        type: 'class',
        name: 'TestClass',
        filePath: '/src/TestClass.js',
        lineStart: 1,
        lineEnd: 20,
        context: 'Test class implementation',
        reason: 'Unit testing purposes',
        change: 'Created for test scenarios',
        prevention: 'Runtime errors in test environment'
      },
      {
        id: 'test-entity-2',
        type: 'function',
        name: 'processData',
        filePath: '/src/utils.js',
        lineStart: 25,
        lineEnd: 45,
        context: 'Data processing utility',
        reason: 'Performance optimization',
        change: 'Optimized algorithm implementation',
        prevention: 'Data corruption and performance issues'
      }
    ],
    patterns: [
      {
        name: 'Factory',
        description: 'Factory pattern for object creation',
        category: 'creational',
        confidence: 0.92
      },
      {
        name: 'Observer',
        description: 'Observer pattern for event handling',
        category: 'behavioral',
        confidence: 0.88
      }
    ],
    relationships: [
      {
        from: 'test-entity-1',
        to: 'test-entity-2',
        type: 'DEPENDS_ON',
        confidence: 0.95
      }
    ]
  };
}

// Test utilities
export const testUtils = {
  async waitFor(condition, timeout = 5000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  },

  createTempFile(content = '', extension = '.js') {
    const filename = `temp-${Date.now()}${extension}`;
    return { filename, content, cleanup: () => {} };
  },

  generateRandomString(length = 10) {
    return Math.random().toString(36).substring(2, 2 + length);
  },

  assertAsyncThrows(asyncFn, expectedError) {
    return expect(asyncFn()).rejects.toThrow(expectedError);
  },

  measureExecutionTime(fn) {
    const start = process.hrtime.bigint();
    const result = fn();
    const end = process.hrtime.bigint();
    return {
      result,
      duration: Number(end - start) / 1000000 // Convert to milliseconds
    };
  }
};

// Performance test helpers
export const performanceHelpers = {
  async runBenchmark(fn, iterations = 100) {
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const start = process.hrtime.bigint();
      await fn();
      const end = process.hrtime.bigint();
      times.push(Number(end - start) / 1000000);
    }
    
    return {
      min: Math.min(...times),
      max: Math.max(...times),
      average: times.reduce((a, b) => a + b) / times.length,
      median: times.sort()[Math.floor(times.length / 2)],
      iterations
    };
  },

  createLoadTestData(count = 1000) {
    return Array.from({ length: count }, (_, i) => ({
      id: `load-test-${i}`,
      name: `TestEntity${i}`,
      type: 'test',
      data: testUtils.generateRandomString(100)
    }));
  }
};

export default {
  MockKuzuClient,
  MockCache,
  MockMCPServer,
  mockLogger,
  mockFs,
  mockGit,
  mockPerformanceMonitor,
  mockExternalServices,
  createMockEnvironment,
  createTestData,
  testUtils,
  performanceHelpers
};