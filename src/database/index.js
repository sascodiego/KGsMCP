/**
 * CONTEXT: Main export file for the comprehensive Cypher query system
 * REASON: Provide convenient access to all query system components
 * CHANGE: Centralized exports with clear API surface
 * PREVENTION: Import confusion and inconsistent component access
 */

// Core database client
export { KuzuClient } from './kuzuClient.js';

// Query system components
export { default as CypherQuerySystem } from './cypherQuerySystem.js';
export { default as CypherQueryBuilder } from './cypherQueryBuilder.js';
export { default as QueryOptimizer } from './queryOptimizer.js';
export { default as QueryTemplateManager } from './queryTemplates.js';
export { default as QueryValidator } from './queryValidator.js';
export { default as BatchOperationManager } from './batchOperations.js';
export { default as PerformanceMonitor } from './performanceMonitor.js';
export { default as TransactionManager, Transaction, TransactionError } from './transactionManager.js';

// Example and utilities
export { demonstrateQuerySystem } from './examples/querySystemExample.js';

/**
 * Factory function to create a fully configured Kuzu client with advanced features
 * 
 * @param {Object} config - Configuration options
 * @param {string} config.databasePath - Path to the Kuzu database
 * @param {boolean} config.enableAdvancedQueries - Enable the advanced query system
 * @param {boolean} config.enableOptimization - Enable query optimization
 * @param {boolean} config.enableValidation - Enable query validation
 * @param {boolean} config.enableMonitoring - Enable performance monitoring
 * @param {boolean} config.enableBatchOperations - Enable batch operations
 * @param {boolean} config.enableTransactions - Enable advanced transaction management
 * @param {boolean} config.enableTemplates - Enable query templates
 * @param {boolean} config.autoOptimize - Enable automatic optimization
 * @param {boolean} config.cacheQueries - Enable query result caching
 * @param {boolean} config.strictValidation - Enable strict validation mode
 * @returns {Promise<KuzuClient>} Configured and connected client
 */
export async function createAdvancedKuzuClient(config = {}) {
  const defaultConfig = {
    databasePath: '.kg-context/knowledge-graph.kuzu',
    enableAdvancedQueries: true,
    enableOptimization: true,
    enableValidation: true,
    enableMonitoring: true,
    enableBatchOperations: true,
    enableTransactions: true,
    enableTemplates: true,
    autoOptimize: false,
    cacheQueries: true,
    strictValidation: false,
    queryTimeout: 30000,
    batchSize: 1000,
    maxConcurrentQueries: 10
  };

  const finalConfig = { ...defaultConfig, ...config };
  
  const client = new KuzuClient(finalConfig);
  await client.connect();
  
  return client;
}

/**
 * Factory function to create a basic Kuzu client without advanced features
 * 
 * @param {Object} config - Configuration options
 * @returns {Promise<KuzuClient>} Basic configured and connected client
 */
export async function createBasicKuzuClient(config = {}) {
  const basicConfig = {
    databasePath: '.kg-context/knowledge-graph.kuzu',
    enableAdvancedQueries: false,
    ...config
  };
  
  const client = new KuzuClient(basicConfig);
  await client.connect();
  
  return client;
}

/**
 * Query system configuration presets
 */
export const QuerySystemPresets = {
  // Maximum performance and features
  FULL_FEATURED: {
    enableAdvancedQueries: true,
    enableOptimization: true,
    enableValidation: true,
    enableMonitoring: true,
    enableBatchOperations: true,
    enableTransactions: true,
    enableTemplates: true,
    autoOptimize: true,
    cacheQueries: true,
    strictValidation: false
  },

  // Performance focused
  PERFORMANCE: {
    enableAdvancedQueries: true,
    enableOptimization: true,
    enableValidation: false,
    enableMonitoring: true,
    enableBatchOperations: true,
    enableTransactions: false,
    enableTemplates: true,
    autoOptimize: true,
    cacheQueries: true,
    strictValidation: false
  },

  // Security focused
  SECURE: {
    enableAdvancedQueries: true,
    enableOptimization: false,
    enableValidation: true,
    enableMonitoring: true,
    enableBatchOperations: false,
    enableTransactions: true,
    enableTemplates: false,
    autoOptimize: false,
    cacheQueries: false,
    strictValidation: true
  },

  // Development mode
  DEVELOPMENT: {
    enableAdvancedQueries: true,
    enableOptimization: true,
    enableValidation: true,
    enableMonitoring: true,
    enableBatchOperations: true,
    enableTransactions: true,
    enableTemplates: true,
    autoOptimize: false,
    cacheQueries: true,
    strictValidation: false
  },

  // Production mode
  PRODUCTION: {
    enableAdvancedQueries: true,
    enableOptimization: true,
    enableValidation: true,
    enableMonitoring: true,
    enableBatchOperations: true,
    enableTransactions: true,
    enableTemplates: true,
    autoOptimize: true,
    cacheQueries: true,
    strictValidation: false
  },

  // Minimal setup
  MINIMAL: {
    enableAdvancedQueries: false
  }
};

/**
 * Create a client with a specific preset configuration
 * 
 * @param {string} presetName - Name of the preset (FULL_FEATURED, PERFORMANCE, etc.)
 * @param {Object} overrides - Configuration overrides
 * @returns {Promise<KuzuClient>} Configured and connected client
 */
export async function createKuzuClientWithPreset(presetName, overrides = {}) {
  const preset = QuerySystemPresets[presetName];
  
  if (!preset) {
    throw new Error(`Unknown preset: ${presetName}. Available presets: ${Object.keys(QuerySystemPresets).join(', ')}`);
  }
  
  const config = { ...preset, ...overrides };
  return await createAdvancedKuzuClient(config);
}

// Re-export common types and constants for convenience
export const QueryTypes = {
  READ: 'READ',
  WRITE: 'WRITE',
  UPDATE: 'UPDATE',
  DELETE: 'DELETE'
};

export const AlertSeverity = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

export const TransactionStatus = {
  PENDING: 'PENDING',
  ACTIVE: 'ACTIVE',
  COMMITTED: 'COMMITTED',
  ROLLED_BACK: 'ROLLED_BACK',
  FAILED: 'FAILED'
};

/**
 * Version information
 */
export const VERSION = '1.0.0';
export const SUPPORTED_KUZU_VERSION = '0.10.x';

export default {
  KuzuClient,
  CypherQuerySystem,
  CypherQueryBuilder,
  QueryOptimizer,
  QueryTemplateManager,
  QueryValidator,
  BatchOperationManager,
  PerformanceMonitor,
  TransactionManager,
  Transaction,
  TransactionError,
  createAdvancedKuzuClient,
  createBasicKuzuClient,
  createKuzuClientWithPreset,
  QuerySystemPresets,
  QueryTypes,
  AlertSeverity,
  TransactionStatus,
  demonstrateQuerySystem,
  VERSION,
  SUPPORTED_KUZU_VERSION
};