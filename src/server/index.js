/**
 * CONTEXT: Index file for refactored server components
 * REASON: Provide clean exports for all refactored MCP server components
 * CHANGE: Export modular architecture components for easy integration
 * PREVENTION: Avoids direct file imports and provides clean API surface
 */

// Main refactored server implementation
export { RefactoredMCPServer } from './RefactoredMCPServer.js';

// Core architecture components
export { ServiceLocator } from './ServiceLocator.js';
export { ToolRegistry } from './ToolRegistry.js';
export { ToolExecutor } from './ToolExecutor.js';
export { HealthMonitor } from './HealthMonitor.js';

// Refactored handlers
export { RefactoredValidationHandler } from '../handlers/RefactoredValidationHandler.js';

// Database factory pattern
export { QueryFactory } from '../database/QueryFactory.js';

// Legacy server for backwards compatibility
export { MCPServer } from '../server.js';

/**
 * Create a new refactored MCP server instance
 * @param {Object} options - Server configuration options
 * @returns {RefactoredMCPServer} Configured server instance
 */
export function createRefactoredServer(options = {}) {
  return new RefactoredMCPServer(options);
}

/**
 * Create a new refactored MCP server instance with async configuration
 * @param {Object} options - Server configuration options
 * @returns {Promise<RefactoredMCPServer>} Promise resolving to configured server instance
 */
export async function createRefactoredServerAsync(options = {}) {
  return await RefactoredMCPServer.createAsync(options);
}

/**
 * Migration utility to help transition from original to refactored server
 * @param {MCPServer} originalServer - Original server instance
 * @returns {Promise<RefactoredMCPServer>} Refactored server instance with migrated configuration
 */
export async function migrateToRefactoredServer(originalServer) {
  if (!originalServer || !originalServer.config) {
    throw new Error('Original server instance required for migration');
  }

  const options = {
    configInstance: originalServer.config,
    preserveMetrics: true
  };

  const refactoredServer = await createRefactoredServerAsync(options);

  // Transfer metrics if health monitor exists
  if (originalServer.metrics && refactoredServer.healthMonitor) {
    refactoredServer.healthMonitor.updateMetrics(originalServer.metrics);
  }

  return refactoredServer;
}

/**
 * Get information about the refactored architecture
 * @returns {Object} Architecture information
 */
export function getArchitectureInfo() {
  return {
    patterns: [
      'Service Locator - Centralized dependency management',
      'Command Pattern - Tool execution encapsulation',
      'Strategy Pattern - Validation and debt detection strategies',
      'Factory Pattern - Query builder creation',
      'Observer/Publisher - Health monitoring and alerting'
    ],
    benefits: [
      'Eliminated God class anti-pattern',
      'Reduced cyclomatic complexity',
      'Removed nested conditionals and switch statements',
      'Improved testability and maintainability',
      'Better separation of concerns',
      'Enhanced error handling and logging'
    ],
    components: {
      'RefactoredMCPServer': 'Main server orchestrator with clean architecture',
      'ServiceLocator': 'Dependency injection and service management',
      'ToolRegistry': 'Tool definition and metadata management',
      'ToolExecutor': 'Command pattern implementation for tool execution',
      'HealthMonitor': 'System health monitoring and alerting',
      'RefactoredValidationHandler': 'Strategy pattern for validation logic',
      'QueryFactory': 'Factory pattern for database query builders'
    }
  };
}

/**
 * Performance comparison utilities
 */
export const Performance = {
  /**
   * Compare method execution times between original and refactored implementations
   */
  async compareExecutionTime(originalMethod, refactoredMethod, iterations = 100) {
    const results = {
      original: [],
      refactored: [],
      improvement: null
    };

    // Test original implementation
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await originalMethod();
      results.original.push(Date.now() - start);
    }

    // Test refactored implementation
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      await refactoredMethod();
      results.refactored.push(Date.now() - start);
    }

    const originalAvg = results.original.reduce((a, b) => a + b, 0) / iterations;
    const refactoredAvg = results.refactored.reduce((a, b) => a + b, 0) / iterations;

    results.improvement = {
      originalAverage: originalAvg,
      refactoredAverage: refactoredAvg,
      improvementPercent: ((originalAvg - refactoredAvg) / originalAvg * 100).toFixed(2),
      faster: refactoredAvg < originalAvg
    };

    return results;
  },

  /**
   * Memory usage comparison
   */
  getMemoryUsage() {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      const usage = process.memoryUsage();
      return {
        heapUsed: (usage.heapUsed / 1024 / 1024).toFixed(2) + ' MB',
        heapTotal: (usage.heapTotal / 1024 / 1024).toFixed(2) + ' MB',
        external: (usage.external / 1024 / 1024).toFixed(2) + ' MB',
        rss: (usage.rss / 1024 / 1024).toFixed(2) + ' MB'
      };
    }
    return null;
  }
};

/**
 * Development utilities for testing and debugging
 */
export const DevUtils = {
  /**
   * Create a mock service locator for testing
   */
  createMockServiceLocator() {
    const mockLocator = new ServiceLocator();
    
    // Register mock services
    mockLocator.registerInstance('config', {
      mcp: { serverName: 'test', serverVersion: '1.0.0' },
      kuzu: { databasePath: ':memory:' },
      validation: { enabled: true },
      optimization: { enabled: false }
    });

    return mockLocator;
  },

  /**
   * Create a test health monitor
   */
  createTestHealthMonitor() {
    return new HealthMonitor({
      checkInterval: 1000, // 1 second for testing
      healthThresholds: {
        maxResponseTime: 1000,
        maxErrorRate: 0.05
      }
    });
  },

  /**
   * Create a test tool registry
   */
  createTestToolRegistry() {
    const registry = new ToolRegistry();
    registry.initialize();
    return registry;
  },

  /**
   * Validate refactored architecture compliance
   */
  validateArchitecture(serverInstance) {
    const checks = {
      hasServiceLocator: !!serverInstance.serviceLocator,
      hasToolRegistry: !!serverInstance.toolRegistry,
      hasToolExecutor: !!serverInstance.toolExecutor,
      hasHealthMonitor: !!serverInstance.healthMonitor,
      isInitialized: serverInstance.initialized === true
    };

    const passed = Object.values(checks).filter(Boolean).length;
    const total = Object.keys(checks).length;

    return {
      checks,
      compliance: (passed / total * 100).toFixed(2) + '%',
      passed,
      total,
      isCompliant: passed === total
    };
  }
};

// Export default as the main refactored server class
export default RefactoredMCPServer;