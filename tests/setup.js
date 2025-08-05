/**
 * Jest test setup and configuration
 * CONTEXT: Global test environment setup for all test suites
 * REASON: Consistent test environment with proper mocking and utilities
 * CHANGE: Test environment initialization with database mocking
 * PREVENTION: Test environment inconsistencies, setup failures, resource leaks
 */

import { jest } from '@jest/globals';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Extend Jest matchers
expect.extend({
  toBeValidEntityId(received) {
    const pass = typeof received === 'string' && received.length > 0 && !received.includes(' ');
    return {
      message: () => pass 
        ? `Expected ${received} not to be a valid entity ID`
        : `Expected ${received} to be a valid entity ID`,
      pass
    };
  },
  
  toHaveValidStructure(received, expectedSchema) {
    const pass = this.validateSchema(received, expectedSchema);
    return {
      message: () => pass
        ? `Expected object not to match schema`
        : `Expected object to match schema`,
      pass
    };
  },
  
  toBeWithinPerformanceThreshold(received, threshold) {
    const pass = received <= threshold;
    return {
      message: () => pass
        ? `Expected ${received}ms not to be within threshold ${threshold}ms`
        : `Expected ${received}ms to be within threshold ${threshold}ms`,
      pass
    };
  }
});

// Global test utilities
global.testUtils = {
  // Create temporary directory for tests
  async createTempDir(prefix = 'mcp-test-') {
    const tempDir = await fs.mkdtemp(path.join('/tmp', prefix));
    return tempDir;
  },
  
  // Clean up temporary directory
  async cleanupTempDir(dirPath) {
    try {
      await fs.rmdir(dirPath, { recursive: true });
    } catch (error) {
      console.warn(`Failed to cleanup temp dir ${dirPath}:`, error.message);
    }
  },
  
  // Wait for condition with timeout
  async waitFor(condition, timeout = 5000, interval = 100) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      if (await condition()) {
        return true;
      }
      await new Promise(resolve => setTimeout(resolve, interval));
    }
    throw new Error(`Condition not met within ${timeout}ms`);
  },
  
  // Generate test data
  generateTestCode(language = 'javascript') {
    const templates = {
      javascript: `
        /**
         * CONTEXT: Test class for validation
         * REASON: Unit testing purposes
         * CHANGE: Created for test scenario
         * PREVENTION: Runtime errors in test environment
         */
        class TestClass {
          constructor(name) {
            this.name = name;
          }
          
          getName() {
            return this.name;
          }
        }
        
        export default TestClass;
      `,
      cpp: `
        /**
         * CONTEXT: Test C++ class for analysis
         * REASON: Testing C++ pattern detection
         * CHANGE: Test fixture implementation
         * PREVENTION: Compilation errors in test scenarios
         */
        #include <string>
        
        class TestClass {
        private:
          std::string name;
          
        public:
          TestClass(const std::string& name) : name(name) {}
          
          std::string getName() const {
            return name;
          }
        };
      `,
      arduino: `
        /**
         * CONTEXT: Arduino test sketch
         * REASON: Testing embedded code analysis
         * CHANGE: Test sensor implementation
         * PREVENTION: Hardware simulation issues
         */
        #include <Arduino.h>
        
        const int sensorPin = A0;
        
        void setup() {
          Serial.begin(9600);
          pinMode(sensorPin, INPUT);
        }
        
        void loop() {
          int sensorValue = analogRead(sensorPin);
          Serial.println(sensorValue);
          delay(1000);
        }
      `
    };
    
    return templates[language] || templates.javascript;
  },
  
  // Mock file system structure
  createMockFileSystem() {
    return {
      '/src/components/Button.js': this.generateTestCode('javascript'),
      '/src/utils/helpers.cpp': this.generateTestCode('cpp'),
      '/arduino/sensor.ino': this.generateTestCode('arduino'),
      '/package.json': JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        dependencies: {}
      }, null, 2)
    };
  }
};

// Mock console methods for cleaner test output
const originalConsole = { ...console };
global.mockConsole = {
  restore: () => {
    Object.assign(console, originalConsole);
  },
  
  mock: () => {
    console.log = jest.fn();
    console.error = jest.fn();
    console.warn = jest.fn();
    console.info = jest.fn();
    console.debug = jest.fn();
  }
};

// Global test data
global.testData = {
  sampleEntities: [
    {
      id: 'test-entity-1',
      type: 'class',
      name: 'TestClass',
      filePath: '/src/TestClass.js',
      lineStart: 1,
      lineEnd: 10,
      context: 'Test entity for validation',
      reason: 'Unit testing',
      change: 'Created for tests',
      prevention: 'Test failures'
    },
    {
      id: 'test-entity-2',
      type: 'function',
      name: 'testFunction',
      filePath: '/src/utils.js',
      lineStart: 15,
      lineEnd: 25,
      context: 'Utility function',
      reason: 'Helper functionality',
      change: 'Test implementation',
      prevention: 'Logic errors'
    }
  ],
  
  samplePatterns: [
    {
      name: 'Factory',
      description: 'Factory pattern implementation',
      category: 'creational',
      confidence: 0.95
    },
    {
      name: 'Observer',
      description: 'Observer pattern implementation',
      category: 'behavioral',
      confidence: 0.87
    }
  ],
  
  sampleRelationships: [
    {
      from: 'test-entity-1',
      to: 'test-entity-2',
      type: 'DEPENDS_ON',
      confidence: 0.9
    }
  ]
};

// Performance monitoring for tests
global.performanceMonitor = {
  measurements: new Map(),
  
  start(label) {
    this.measurements.set(label, process.hrtime.bigint());
  },
  
  end(label) {
    const start = this.measurements.get(label);
    if (start) {
      const end = process.hrtime.bigint();
      const duration = Number(end - start) / 1000000; // Convert to milliseconds
      this.measurements.delete(label);
      return duration;
    }
    return 0;
  },
  
  reset() {
    this.measurements.clear();
  }
};

// Global error handler for unhandled rejections in tests
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection in test:', reason);
  // Don't exit process in tests, but log the error
});

// Cleanup after each test
afterEach(() => {
  global.performanceMonitor.reset();
  jest.clearAllTimers();
});

console.log('Test environment setup completed');