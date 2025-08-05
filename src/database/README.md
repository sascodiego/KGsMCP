# Comprehensive Cypher Query System for Kuzu

A complete, production-ready query system for Kuzu graph database with advanced features including optimization, validation, monitoring, batch operations, and transaction management.

## 🚀 Features

### Core Components

- **🔨 Query Builder**: Fluent API for building complex Cypher queries
- **⚡ Query Optimizer**: Intelligent query optimization with caching
- **📝 Template System**: Reusable query templates for common operations
- **🛡️ Query Validator**: Security validation and sanitization
- **📦 Batch Operations**: Efficient bulk operations and streaming
- **📊 Performance Monitor**: Real-time monitoring and alerting
- **🔄 Transaction Manager**: ACID transactions with savepoints and recovery
- **🎯 Integrated System**: Unified interface combining all components

### Advanced Features

- **Automatic Query Optimization**: Intelligent query rewriting and execution plan optimization
- **Result Caching**: Adaptive caching with intelligent TTL management
- **Query Validation**: Multi-layer security validation preventing injection attacks
- **Performance Monitoring**: Real-time metrics, alerting, and trend analysis
- **Batch Processing**: Efficient handling of large-scale operations
- **Transaction Safety**: Full ACID compliance with savepoints and deadlock detection
- **Streaming Results**: Memory-efficient processing of large result sets
- **Error Recovery**: Sophisticated error handling and automatic recovery

## 📦 Installation

```bash
npm install kuzu
```

## 🏁 Quick Start

### Basic Usage

```javascript
import { createAdvancedKuzuClient } from './src/database/index.js';

// Create client with all advanced features
const client = await createAdvancedKuzuClient({
  databasePath: './my-knowledge-graph.kuzu',
  enableOptimization: true,
  enableValidation: true,
  enableMonitoring: true
});

// Simple query
const result = await client.queryAdvanced(`
  MATCH (e:CodeEntity)
  WHERE e.type = $type
  RETURN e.name, e.filePath
`, { type: 'function' });

console.log(`Found ${result.data.length} functions`);
```

### Using Query Builder

```javascript
// Build complex queries with fluent API
const builder = client.createQueryBuilder();

const result = await builder
  .match('(e:CodeEntity)')
  .where('e.type = $type', { type: 'class' })
  .optionalMatch('(e)-[:IMPLEMENTS]->(p:Pattern)')
  .where('p.confidence > $minConfidence', { minConfidence: 0.8 }, 'AND')
  .return(['e.name', 'e.filePath', 'p.name as pattern'])
  .orderBy('e.name')
  .limit(50)
  .cached(3600) // Cache for 1 hour
  .execute();

console.log(`Query executed in ${result.metadata.executionTime}ms`);
console.log(`Results cached: ${result.metadata.cached}`);
console.log(`Query optimized: ${result.metadata.optimized}`);
```

### Using Templates

```javascript
// Execute predefined templates
const patterns = await client.executeTemplate('findPatternsForEntity', {
  entityId: 'my-function-id'
});

// Get analytics
const stats = await client.executeTemplate('getEntityStatistics');
console.log(`Total entities: ${stats.result[0].totalEntities}`);
```

### Batch Operations

```javascript
// Process multiple operations efficiently
const operations = [
  {
    type: 'INSERT',
    table: 'CodeEntity',
    data: { id: '1', type: 'function', name: 'calculateTotal' }
  },
  {
    type: 'INSERT', 
    table: 'CodeEntity',
    data: { id: '2', type: 'class', name: 'Calculator' }
  },
  {
    query: `
      MATCH (f:CodeEntity {id: '1'}), (c:CodeEntity {id: '2'})
      CREATE (f)-[:BELONGS_TO]->(c)
    `
  }
];

const batchResult = await client.executeBatch(operations, {
  batchSize: 100,
  useTransaction: true
});

console.log(`Processed ${batchResult.successCount} operations successfully`);
```

### Transactions

```javascript
// Execute operations in transaction
const txResult = await client.executeTransaction([
  {
    query: 'CREATE (e:CodeEntity {id: $id, name: $name})',
    parameters: { id: 'entity-1', name: 'MyClass' }
  },
  {
    query: 'CREATE (p:Pattern {name: $pattern})',
    parameters: { pattern: 'Singleton' }
  },
  {
    query: `
      MATCH (e:CodeEntity {id: 'entity-1'}), (p:Pattern {name: 'Singleton'})
      CREATE (e)-[:IMPLEMENTS {confidence: 0.9}]->(p)
    `
  }
], {
  timeout: 30000,
  enableSavepoints: true
});

console.log(`Transaction ${txResult.success ? 'succeeded' : 'failed'}`);
```

### Streaming Large Results

```javascript
// Stream large result sets efficiently
const stream = client.getQuerySystem().createQueryStream(
  'MATCH (e:CodeEntity) RETURN e',
  {},
  { batchSize: 1000 }
);

let count = 0;
stream.on('data', (chunk) => {
  count += Array.isArray(chunk) ? chunk.length : 1;
  console.log(`Processed ${count} entities`);
});

stream.on('end', () => {
  console.log(`Streaming completed: ${count} total entities`);
});
```

## 🎛️ Configuration

### Preset Configurations

```javascript
import { createKuzuClientWithPreset, QuerySystemPresets } from './src/database/index.js';

// Use predefined presets
const devClient = await createKuzuClientWithPreset('DEVELOPMENT');
const prodClient = await createKuzuClientWithPreset('PRODUCTION');
const secureClient = await createKuzuClientWithPreset('SECURE');

// Override preset settings
const customClient = await createKuzuClientWithPreset('PERFORMANCE', {
  cacheQueries: false,
  batchSize: 500
});
```

### Custom Configuration

```javascript
const client = await createAdvancedKuzuClient({
  // Database settings
  databasePath: './my-graph.kuzu',
  queryTimeout: 30000,
  
  // Feature toggles
  enableOptimization: true,
  enableValidation: true,
  enableMonitoring: true,
  enableBatchOperations: true,
  enableTransactions: true,
  enableTemplates: true,
  
  // Optimization settings
  autoOptimize: true,
  cacheQueries: true,
  optimizationLevel: 'balanced', // 'aggressive', 'balanced', 'conservative'
  
  // Validation settings
  strictValidation: false,
  maxQueryLength: 100000,
  
  // Performance settings
  batchSize: 1000,
  maxConcurrentQueries: 10,
  
  // Monitoring settings
  slowQueryThreshold: 5000,
  enableRealTimeMonitoring: true,
  
  // Transaction settings
  defaultTimeout: 30000,
  enableDeadlockDetection: true,
  enableRecovery: true
});
```

## 📊 Monitoring & Performance

### Get Performance Reports

```javascript
// Get performance metrics
const report = client.getPerformanceReport('1h');

console.log('Performance Summary:');
console.log(`- Total queries: ${report.summary.totalQueries}`);
console.log(`- Average time: ${report.summary.averageQueryTime}ms`);
console.log(`- Error rate: ${report.summary.errorRate}%`);
console.log(`- Cache hit rate: ${report.summary.cacheHitRate}%`);

// Get real-time statistics
const stats = client.getQuerySystem().getRealTimeStatistics();
console.log(`Current QPS: ${stats.queriesPerSecond}`);
console.log(`Memory usage: ${stats.memoryUsage}%`);
```

### Event Monitoring

```javascript
// Listen to system events
client.on('queryOptimized', (event) => {
  console.log(`Query optimized: ${event.estimatedImprovement}% improvement`);
});

client.on('performanceAlert', (alert) => {
  console.log(`Performance alert: ${alert.message}`);
});

client.on('slowQuery', (query) => {
  console.log(`Slow query detected: ${query.executionTime}ms`);
});

client.on('transactionError', (event) => {
  console.log(`Transaction error: ${event.error.message}`);
});
```

### System Health

```javascript
// Check system health
const status = client.getSystemStatus();

console.log(`System Status: ${status.querySystem.health.status}`);
console.log(`Uptime: ${Math.round(status.querySystem.uptime / 1000)}s`);
console.log(`Active queries: ${status.querySystem.activeQueries}`);
console.log(`Health issues: ${status.querySystem.health.issues.length}`);

// Get detailed subsystem status
console.log('Subsystem Status:');
console.log(`- Optimizer: ${status.querySystem.subsystems.optimizer ? 'Active' : 'Inactive'}`);
console.log(`- Validator: ${status.querySystem.subsystems.validator ? 'Active' : 'Inactive'}`);
console.log(`- Monitor: ${status.querySystem.subsystems.monitor ? 'Active' : 'Inactive'}`);
```

## 🛡️ Security & Validation

### Query Validation

```javascript
// Enable strict validation
const client = await createAdvancedKuzuClient({
  enableValidation: true,
  strictValidation: true,
  maxQueryLength: 50000
});

// Queries are automatically validated
const result = await client.queryAdvanced(`
  MATCH (e:CodeEntity)
  WHERE e.name = $name
  RETURN e
`, { name: "user'input" }); // Automatically sanitized
```

### Custom Validation Rules

```javascript
const querySystem = client.getQuerySystem();
const validator = querySystem.validator;

// Add custom validation rule
validator.addValidationRule('customRule', (query) => {
  return !query.includes('DROP');
});

// Add custom sanitization rule
validator.addSanitizationRule('customSanitizer', async (query, params) => {
  const sanitizedQuery = query.replace(/--.*$/gm, '');
  return {
    modified: sanitizedQuery !== query,
    query: sanitizedQuery,
    parameters: params
  };
});
```

## 🔧 Advanced Usage

### Custom Query Templates

```javascript
const templateManager = client.getQuerySystem().templateManager;

// Register custom template
templateManager.registerTemplate('findComplexPatterns', {
  description: 'Find complex patterns with multiple relationships',
  parameters: ['entityType', 'minComplexity'],
  template: (params) => client.createQueryBuilder()
    .match('(e:CodeEntity)-[:IMPLEMENTS]->(p:Pattern)')
    .where('e.type = $entityType AND p.complexity >= $minComplexity', params)
    .return(['e.name', 'p.name', 'p.complexity'])
    .orderBy('p.complexity', 'DESC'),
  category: 'analysis',
  complexity: 4
});

// Use custom template
const complexPatterns = await client.executeTemplate('findComplexPatterns', {
  entityType: 'class',
  minComplexity: 5
});
```

### Query Optimization

```javascript
const optimizer = client.getQuerySystem().optimizer;

// Get optimization statistics
const optimizerStats = optimizer.getStatistics();
console.log(`Cache hit rate: ${optimizerStats.cache.hitRate}%`);
console.log(`Queries optimized: ${optimizerStats.optimization.queriesOptimized}`);

// Clear caches
optimizer.clearCaches();

// Invalidate specific cache patterns
optimizer.invalidateCache('CodeEntity');
```

### Transaction Management

```javascript
// Begin manual transaction
const transaction = await client.beginTransaction({
  timeout: 60000,
  enableSavepoints: true
});

try {
  // Execute operations
  await transaction.query('CREATE (e:CodeEntity {id: $id})', { id: '1' });
  
  // Create savepoint
  const savepoint = await transaction.createSavepoint('checkpoint1');
  
  await transaction.query('CREATE (p:Pattern {name: $name})', { name: 'TestPattern' });
  
  // Rollback to savepoint if needed
  // await transaction.rollbackToSavepoint('checkpoint1');
  
  // Commit transaction
  await transaction.commit();
  
} catch (error) {
  // Automatic rollback on error
  await transaction.rollback();
  throw error;
}
```

## 📈 Performance Optimization

### Best Practices

1. **Use Query Templates**: Reuse common query patterns for better performance
2. **Enable Caching**: Cache frequently used queries with appropriate TTL
3. **Batch Operations**: Use batch operations for bulk data processing  
4. **Stream Large Results**: Use streaming for large result sets
5. **Monitor Performance**: Keep track of query performance and optimize bottlenecks
6. **Use Transactions**: Group related operations in transactions
7. **Validate Queries**: Enable validation to catch issues early
8. **Index Optimization**: Use suggested indexes for frequently filtered fields

### Performance Tuning

```javascript
// Optimize for different scenarios
const performanceConfig = {
  // High-throughput scenario
  highThroughput: {
    enableOptimization: true,
    cacheQueries: true,
    batchSize: 2000,
    maxConcurrentQueries: 20,
    autoOptimize: true
  },
  
  // Low-latency scenario  
  lowLatency: {
    enableOptimization: true,
    cacheQueries: true,
    batchSize: 100,
    maxConcurrentQueries: 5,
    queryTimeout: 5000
  },
  
  // Memory-constrained scenario
  memoryConstrained: {
    enableOptimization: false,
    cacheQueries: false,
    batchSize: 50,
    maxConcurrentQueries: 2,
    streamThreshold: 1000
  }
};
```

## 🐛 Error Handling

### Comprehensive Error Handling

```javascript
try {
  const result = await client.queryAdvanced(query, params);
} catch (error) {
  if (error.name === 'CypherQueryError') {
    console.log(`Query ID: ${error.details.queryId}`);
    console.log(`Execution time: ${error.details.executionTime}ms`);
    console.log(`Original error: ${error.details.originalError.message}`);
  } else if (error.name === 'TransactionError') {
    console.log('Transaction failed - automatic rollback performed');
  } else {
    console.log('Unexpected error:', error.message);
  }
}
```

### Recovery and Retry

```javascript
// Automatic retry for transient errors
const retryableQuery = async () => {
  let retries = 3;
  while (retries > 0) {
    try {
      return await client.queryAdvanced(query, params);
    } catch (error) {
      if (isRetryableError(error) && retries > 1) {
        retries--;
        await delay(1000 * (4 - retries)); // Exponential backoff
        continue;
      }
      throw error;
    }
  }
};

function isRetryableError(error) {
  return error.message.includes('TIMEOUT') || 
         error.message.includes('CONNECTION_LOST');
}
```

## 🧪 Testing

### Example Test Usage

```javascript
import { createBasicKuzuClient } from './src/database/index.js';

describe('Cypher Query System', () => {
  let client;
  
  beforeAll(async () => {
    client = await createBasicKuzuClient({
      databasePath: './test-db.kuzu'
    });
  });
  
  afterAll(async () => {
    await client.close();
  });
  
  test('should execute basic query', async () => {
    const result = await client.query('RETURN 1 as test');
    expect(result[0].test).toBe(1);
  });
  
  test('should use query builder', async () => {
    if (!client.getQuerySystem()) return; // Skip if advanced features disabled
    
    const result = await client.createQueryBuilder()
      .match('(e:CodeEntity)')
      .return(['count(e) as total'])
      .execute();
      
    expect(result.data[0].total).toBeGreaterThanOrEqual(0);
  });
});
```

## 📚 API Reference

### Core Classes

- **KuzuClient**: Main database client with query system integration
- **CypherQuerySystem**: Integrated query system combining all components
- **CypherQueryBuilder**: Fluent API for building queries
- **QueryOptimizer**: Query optimization and caching
- **QueryTemplateManager**: Template system for reusable queries
- **QueryValidator**: Security validation and sanitization
- **BatchOperationManager**: Bulk operations and streaming
- **PerformanceMonitor**: Real-time monitoring and alerting
- **TransactionManager**: ACID transaction management

### Factory Functions

- **createAdvancedKuzuClient(config)**: Create client with all features
- **createBasicKuzuClient(config)**: Create basic client without advanced features
- **createKuzuClientWithPreset(preset, overrides)**: Create client with preset configuration

### Configuration Presets

- **FULL_FEATURED**: All features enabled for maximum functionality
- **PERFORMANCE**: Optimized for high performance scenarios
- **SECURE**: Focused on security with strict validation
- **DEVELOPMENT**: Balanced configuration for development
- **PRODUCTION**: Production-ready configuration with monitoring
- **MINIMAL**: Basic functionality only

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add tests for new functionality
4. Ensure all tests pass
5. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details

## 🔗 Related Projects

- [Kuzu Database](https://github.com/kuzudb/kuzu)
- [Cypher Query Language](https://opencypher.org/)
- [Graph Database Concepts](https://neo4j.com/developer/graph-database/)

---

**Built with ❤️ for the MCP Knowledge Graph project**