/**
 * CONTEXT: Example demonstrating the comprehensive Cypher query system
 * REASON: Show practical usage of the integrated query system with all features
 * CHANGE: Complete example with optimization, validation, monitoring, and transactions
 * PREVENTION: Implementation confusion and incorrect usage patterns
 */

import { KuzuClient } from '../kuzuClient.js';
import { logger } from '../../utils/logger.js';

async function demonstrateQuerySystem() {
  console.log('🚀 Demonstrating Comprehensive Cypher Query System\n');

  // Initialize Kuzu client with advanced features enabled
  const client = new KuzuClient({
    databasePath: '.kg-context/example-knowledge-graph.kuzu',
    enableAdvancedQueries: true,
    enableOptimization: true,
    enableValidation: true,
    enableMonitoring: true,
    enableBatchOperations: true,
    enableTransactions: true,
    enableTemplates: true,
    autoOptimize: true,
    cacheQueries: true,
    strictValidation: false // Allow sanitization
  });

  try {
    // Connect to database
    await client.connect();
    console.log('✅ Connected to Kuzu database with advanced query system\n');

    // Get the advanced query system
    const querySystem = client.getQuerySystem();
    
    if (!querySystem) {
      throw new Error('Query system not available');
    }

    console.log('📊 System Status:', JSON.stringify(querySystem.getSystemStatus(), null, 2));
    console.log('\n');

    // 1. Demonstrate Query Builder
    console.log('🔨 1. Query Builder Example');
    console.log('Building complex query with fluent API...');
    
    const builder = client.createQueryBuilder();
    const complexQuery = await builder
      .match('(e:CodeEntity)')
      .where('e.type = $entityType', { entityType: 'function' })
      .optionalMatch('(e)-[:IMPLEMENTS]->(p:Pattern)')
      .where('p.confidence > $minConfidence', { minConfidence: 0.8 }, 'AND')
      .return(['e.name', 'e.filePath', 'p.name as pattern'])
      .orderBy('e.name')
      .limit(10)
      .cached(3600) // Cache for 1 hour
      .execute();

    console.log(`Query executed successfully: ${complexQuery.metadata.resultCount} results`);
    console.log(`Execution time: ${complexQuery.metadata.executionTime}ms`);
    console.log(`Cached: ${complexQuery.metadata.cached}`);
    console.log(`Optimized: ${complexQuery.metadata.optimized}\n`);

    // 2. Demonstrate Templates
    console.log('📝 2. Template System Example');
    console.log('Using predefined template for common operations...');

    // Create some test data first
    await client.queryAdvanced(`
      CREATE (e1:CodeEntity {
        id: 'test-func-1',
        type: 'function',
        name: 'calculateTotal',
        filePath: '/src/utils/math.js'
      })
    `);

    await client.queryAdvanced(`
      CREATE (p1:Pattern {
        name: 'Calculator Pattern',
        description: 'Pattern for mathematical calculations',
        category: 'utility'
      })
    `);

    await client.queryAdvanced(`
      MATCH (e:CodeEntity {id: 'test-func-1'}), (p:Pattern {name: 'Calculator Pattern'})
      CREATE (e)-[:IMPLEMENTS {confidence: 0.9, timestamp: timestamp()}]->(p)
    `);

    // Use template
    const templateResult = await client.executeTemplate('findPatternsForEntity', {
      entityId: 'test-func-1'
    });

    console.log(`Template executed: ${templateResult.result.length} patterns found`);
    console.log(`Template execution time: ${templateResult.executionTime}ms\n`);

    // 3. Demonstrate Batch Operations
    console.log('📦 3. Batch Operations Example');
    console.log('Processing multiple operations efficiently...');

    const batchOperations = [
      {
        type: 'INSERT',
        table: 'CodeEntity',
        data: {
          id: 'batch-entity-1',
          type: 'class',
          name: 'UserService',
          filePath: '/src/services/user.js'
        }
      },
      {
        type: 'INSERT',
        table: 'CodeEntity',
        data: {
          id: 'batch-entity-2',
          type: 'class',
          name: 'DataService',
          filePath: '/src/services/data.js'
        }
      },
      {
        query: `
          MATCH (e1:CodeEntity {id: 'batch-entity-1'}), (e2:CodeEntity {id: 'batch-entity-2'})
          CREATE (e1)-[:DEPENDS_ON {type: 'composition', strength: 0.8}]->(e2)
        `
      }
    ];

    const batchResult = await client.executeBatch(batchOperations, {
      batchSize: 2,
      useTransaction: true
    });

    console.log(`Batch operation completed: ${batchResult.results.filter(r => r.success).length}/${batchResult.results.length} successful`);
    console.log(`Batch execution time: ${batchResult.executionTime}ms\n`);

    // 4. Demonstrate Transactions
    console.log('🔄 4. Transaction Example');
    console.log('Executing operations in transaction...');

    const transactionResult = await querySystem.executeTransaction([
      {
        query: `
          CREATE (e:CodeEntity {
            id: 'tx-entity-1',
            type: 'interface',
            name: 'IRepository',
            filePath: '/src/interfaces/repository.js'
          })
        `
      },
      {
        query: `
          CREATE (r:Rule {
            id: 'interface-rule-1',
            description: 'Interfaces should follow naming convention',
            category: 'naming',
            severity: 'medium'
          })
        `
      },
      {
        query: `
          MATCH (e:CodeEntity {id: 'tx-entity-1'}), (r:Rule {id: 'interface-rule-1'})
          CREATE (e)-[:FOLLOWS {compliance: 1.0, verified: true}]->(r)
        `
      }
    ], {
      timeout: 30000,
      enableSavepoints: true
    });

    console.log(`Transaction completed: ${transactionResult.success}`);
    console.log(`Transaction time: ${transactionResult.executionTime}ms`);
    console.log(`Operations: ${transactionResult.results.filter(r => r.success).length}/${transactionResult.results.length} successful\n`);

    // 5. Demonstrate Query Optimization
    console.log('⚡ 5. Query Optimization Example');
    console.log('Comparing optimized vs non-optimized queries...');

    const testQuery = `
      MATCH (e:CodeEntity)-[:IMPLEMENTS]->(p:Pattern)
      WHERE e.type = 'function' AND p.confidence > 0.5
      RETURN e.name, p.name, p.confidence
      ORDER BY p.confidence DESC
    `;

    // Execute without optimization
    const unoptimizedResult = await client.queryAdvanced(testQuery, {}, {
      enableOptimization: false
    });

    // Execute with optimization
    const optimizedResult = await client.queryAdvanced(testQuery, {}, {
      enableOptimization: true
    });

    console.log(`Unoptimized: ${unoptimizedResult.metadata.executionTime}ms`);
    console.log(`Optimized: ${optimizedResult.metadata.executionTime}ms`);
    console.log(`Improvement: ${optimizedResult.metadata.optimizationImprovement || 0}%\n`);

    // 6. Demonstrate Performance Monitoring
    console.log('📈 6. Performance Monitoring Example');
    console.log('Getting performance metrics...');

    const performanceReport = client.getPerformanceReport('1h');
    console.log('Performance Summary:');
    console.log(`- Total queries: ${performanceReport.summary.totalQueries}`);
    console.log(`- Average query time: ${performanceReport.summary.averageQueryTime.toFixed(2)}ms`);
    console.log(`- Error rate: ${performanceReport.summary.errorRate.toFixed(2)}%`);
    console.log(`- Cache hit rate: ${performanceReport.summary.cacheHitRate.toFixed(2)}%`);
    console.log(`- Active alerts: ${performanceReport.alerts.length}\n`);

    // 7. Demonstrate Query Validation
    console.log('🛡️ 7. Query Validation Example');
    console.log('Testing query validation and sanitization...');

    // Test with potentially problematic query
    const problematicQuery = `
      MATCH (e:CodeEntity)  
      WHERE e.name = 'test'  --comment
      RETURN e.*
      /* multi-line comment */
    `;

    const validatedResult = await client.queryAdvanced(problematicQuery, {}, {
      enableValidation: true
    });

    console.log(`Validation successful: ${validatedResult.metadata.validated}`);
    console.log(`Sanitization applied: ${validatedResult.metadata.validationWarnings.length > 0}`);
    console.log(`Warnings: ${validatedResult.metadata.validationWarnings.length}\n`);

    // 8. Demonstrate Streaming Queries
    console.log('🌊 8. Streaming Query Example');
    console.log('Processing large result sets with streaming...');

    // Create a query stream for large result sets
    const stream = querySystem.createQueryStream(
      'MATCH (e:CodeEntity) RETURN e.id, e.name, e.type',
      {},
      { batchSize: 5 }
    );

    let streamedCount = 0;
    
    stream.on('data', (chunk) => {
      streamedCount += Array.isArray(chunk) ? chunk.length : 1;
    });

    stream.on('end', () => {
      console.log(`Streaming completed: ${streamedCount} records processed\n`);
    });

    stream.on('error', (error) => {
      console.error('Streaming error:', error.message);
    });

    // Wait for streaming to complete
    await new Promise((resolve) => {
      stream.on('end', resolve);
    });

    // 9. System Health Check
    console.log('🏥 9. System Health Check');
    const systemStatus = client.getSystemStatus();
    console.log(`System Status: ${systemStatus.querySystem.health.status}`);
    console.log(`Uptime: ${Math.round(systemStatus.querySystem.uptime / 1000)}s`);
    console.log(`Query System Available: ${systemStatus.querySystemAvailable}`);
    console.log(`Health Issues: ${systemStatus.querySystem.health.issues.length}\n`);

    console.log('✅ All examples completed successfully!');
    console.log('\n🎯 Key Features Demonstrated:');
    console.log('- Fluent Query Builder API');
    console.log('- Query Templates and Reusability');
    console.log('- Batch Operations and Transactions');
    console.log('- Automatic Query Optimization');
    console.log('- Real-time Performance Monitoring');
    console.log('- Query Validation and Sanitization');
    console.log('- Streaming for Large Result Sets');
    console.log('- Comprehensive Error Handling');
    console.log('- System Health Monitoring');

  } catch (error) {
    console.error('❌ Example failed:', error.message);
    logger.error('Query system example failed:', error);
  } finally {
    // Clean up
    try {
      await client.close();
      console.log('\n🔌 Database connection closed');
    } catch (error) {
      console.error('Error closing connection:', error.message);
    }
  }
}

// Event listeners for monitoring
function setupEventListeners(client) {
  client.on('queryOptimized', (event) => {
    console.log(`🔧 Query optimized: ${event.estimatedImprovement}% improvement`);
  });

  client.on('performanceAlert', (alert) => {
    console.log(`⚠️ Performance alert: ${alert.message}`);
  });

  client.on('slowQuery', (query) => {
    console.log(`🐌 Slow query detected: ${query.executionTime}ms`);
  });

  client.on('transactionError', (event) => {
    console.log(`❌ Transaction error: ${event.error.message}`);
  });
}

// Run the example
if (import.meta.url === `file://${process.argv[1]}`) {
  demonstrateQuerySystem().catch(console.error);
}

export { demonstrateQuerySystem };