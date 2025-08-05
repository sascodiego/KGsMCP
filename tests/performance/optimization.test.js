/**
 * Performance and Optimization Tests
 * CONTEXT: Testing performance characteristics and optimization systems
 * REASON: Ensure system performance meets requirements under load
 * CHANGE: Comprehensive performance testing with metrics validation
 * PREVENTION: Performance degradation, memory leaks, scalability issues
 */

import { jest } from '@jest/globals';
import { OptimizationManager } from '../../src/optimization/OptimizationManager.js';
import { MultiLayerCache } from '../../src/optimization/MultiLayerCache.js';
import { DatabaseOptimizer } from '../../src/optimization/DatabaseOptimizer.js';
import { PerformanceMonitor } from '../../src/optimization/PerformanceMonitor.js';
import { MockKuzuClient, performanceHelpers } from '../mocks/index.js';

describe('Performance and Optimization Tests', () => {
  let optimizationManager;
  let multiLayerCache;
  let databaseOptimizer;
  let performanceMonitor;
  let mockKuzu;

  beforeEach(() => {
    mockKuzu = new MockKuzuClient();
    
    optimizationManager = new OptimizationManager({
      enableCaching: true,
      enableQueryOptimization: true,
      enablePerformanceMonitoring: true
    });
    
    multiLayerCache = new MultiLayerCache({
      l1Size: 100,
      l2Size: 1000,
      ttl: 60000
    });
    
    databaseOptimizer = new DatabaseOptimizer(mockKuzu);
    performanceMonitor = new PerformanceMonitor();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('MultiLayerCache Performance', () => {
    test('should provide fast L1 cache access', async () => {
      const key = 'test-key';
      const value = { data: 'test-value', timestamp: Date.now() };
      
      // Set value
      await multiLayerCache.set(key, value);
      
      // Measure L1 access time
      const benchmark = await performanceHelpers.runBenchmark(async () => {
        await multiLayerCache.get(key);
      }, 1000);
      
      expect(benchmark.average).toBeLessThan(1); // < 1ms average
      expect(benchmark.max).toBeLessThan(5); // < 5ms max
    });

    test('should handle high concurrency', async () => {
      const concurrentRequests = 100;
      const testData = performanceHelpers.createLoadTestData(concurrentRequests);
      
      global.performanceMonitor.start('cache-concurrency');
      
      // Concurrent writes
      const writePromises = testData.map(item => 
        multiLayerCache.set(item.id, item)
      );
      await Promise.all(writePromises);
      
      // Concurrent reads
      const readPromises = testData.map(item => 
        multiLayerCache.get(item.id)
      );
      const results = await Promise.all(readPromises);
      
      const duration = global.performanceMonitor.end('cache-concurrency');
      
      expect(results).toHaveLength(concurrentRequests);
      expect(results.every(result => result !== null)).toBe(true);
      expect(duration).toBeWithinPerformanceThreshold(1000); // < 1 second
    });

    test('should maintain performance under memory pressure', async () => {
      // Fill cache beyond L1 capacity
      const largeDataSet = Array.from({ length: 500 }, (_, i) => ({
        id: `large-item-${i}`,
        data: 'x'.repeat(1000) // 1KB per item
      }));
      
      global.performanceMonitor.start('memory-pressure');
      
      // Insert large dataset
      for (const item of largeDataSet) {
        await multiLayerCache.set(item.id, item);
      }
      
      // Test access performance under pressure
      const benchmark = await performanceHelpers.runBenchmark(async () => {
        const randomIndex = Math.floor(Math.random() * largeDataSet.length);
        await multiLayerCache.get(`large-item-${randomIndex}`);
      }, 100);
      
      const duration = global.performanceMonitor.end('memory-pressure');
      
      expect(benchmark.average).toBeLessThan(10); // < 10ms average under pressure
      expect(duration).toBeWithinPerformanceThreshold(5000); // < 5 seconds total
    });

    test('should provide efficient cache statistics', () => {
      const stats = multiLayerCache.getStats();
      
      expect(stats).toHaveProperty('l1Stats');
      expect(stats).toHaveProperty('l2Stats');
      expect(stats).toHaveProperty('overallHitRate');
      expect(stats).toHaveProperty('totalSize');
      expect(stats).toHaveProperty('memoryUsage');
      
      // Stats calculation should be fast
      global.performanceMonitor.start('stats-calculation');
      for (let i = 0; i < 1000; i++) {
        multiLayerCache.getStats();
      }
      const duration = global.performanceMonitor.end('stats-calculation');
      
      expect(duration).toBeLessThan(100); // < 100ms for 1000 calls
    });

    test('should handle cache eviction efficiently', async () => {
      // Configure small cache for testing eviction
      const smallCache = new MultiLayerCache({
        l1Size: 10,
        l2Size: 20,
        ttl: 60000
      });
      
      // Fill beyond capacity
      const items = Array.from({ length: 50 }, (_, i) => ({
        id: `eviction-test-${i}`,
        data: `data-${i}`
      }));
      
      global.performanceMonitor.start('eviction-test');
      
      for (const item of items) {
        await smallCache.set(item.id, item);
      }
      
      const duration = global.performanceMonitor.end('eviction-test');
      
      // Should handle eviction without significant performance impact
      expect(duration).toBeWithinPerformanceThreshold(1000);
      
      const stats = smallCache.getStats();
      expect(stats.totalSize).toBeLessThanOrEqual(30); // L1 + L2 capacity
    });
  });

  describe('Database Optimization Performance', () => {
    test('should optimize query execution plans', async () => {
      const complexQuery = `
        MATCH (e:CodeEntity)-[:IMPLEMENTS]->(p:Pattern)
        WHERE e.complexity > 10
        WITH e, p, count(*) as implCount
        MATCH (e)-[:DEPENDS_ON*1..3]->(dep:CodeEntity)
        RETURN e.name, p.name, implCount, collect(dep.name) as dependencies
        ORDER BY implCount DESC
        LIMIT 50
      `;
      
      global.performanceMonitor.start('query-optimization');
      
      const optimizedQuery = await databaseOptimizer.optimizeQuery(complexQuery);
      
      const duration = global.performanceMonitor.end('query-optimization');
      
      expect(optimizedQuery).toBeDefined();
      expect(duration).toBeWithinPerformanceThreshold(500); // < 500ms
      
      // Verify optimization actually improves performance
      const originalExecutionTime = await measureQueryExecution(complexQuery);
      const optimizedExecutionTime = await measureQueryExecution(optimizedQuery);
      
      expect(optimizedExecutionTime).toBeLessThanOrEqual(originalExecutionTime);
    });

    test('should handle batch operations efficiently', async () => {
      const batchSize = 1000;
      const entities = performanceHelpers.createLoadTestData(batchSize);
      
      global.performanceMonitor.start('batch-operations');
      
      // Test batch insert performance
      const batchResult = await databaseOptimizer.batchInsert('CodeEntity', entities);
      
      const duration = global.performanceMonitor.end('batch-operations');
      
      expect(batchResult.success).toBe(true);
      expect(batchResult.insertedCount).toBe(batchSize);
      expect(duration).toBeWithinPerformanceThreshold(5000); // < 5 seconds for 1000 items
      
      // Should be significantly faster than individual inserts
      const avgBatchTime = duration / batchSize;
      expect(avgBatchTime).toBeLessThan(10); // < 10ms per item in batch
    });

    test('should maintain query performance under load', async () => {
      // Setup test data
      const testData = performanceHelpers.createLoadTestData(500);
      await databaseOptimizer.batchInsert('CodeEntity', testData);
      
      // Test concurrent query performance
      const concurrentQueries = Array.from({ length: 50 }, () => 
        'MATCH (e:CodeEntity) RETURN count(e)'
      );
      
      global.performanceMonitor.start('concurrent-queries');
      
      const queryPromises = concurrentQueries.map(query => 
        mockKuzu.query(query)
      );
      
      const results = await Promise.all(queryPromises);
      
      const duration = global.performanceMonitor.end('concurrent-queries');
      
      expect(results).toHaveLength(50);
      expect(duration).toBeWithinPerformanceThreshold(3000); // < 3 seconds
      
      // Average query time should be reasonable
      const avgQueryTime = duration / 50;
      expect(avgQueryTime).toBeLessThan(100); // < 100ms per query
    });

    async function measureQueryExecution(query) {
      const start = Date.now();
      await mockKuzu.query(query);
      return Date.now() - start;
    }
  });

  describe('Performance Monitor', () => {
    test('should track metrics with minimal overhead', async () => {
      const operationCount = 10000;
      
      // Measure overhead of performance monitoring
      const withoutMonitoring = await performanceHelpers.runBenchmark(() => {
        // Simulate operation without monitoring
        Math.random() * 1000;
      }, operationCount);
      
      const withMonitoring = await performanceHelpers.runBenchmark(() => {
        performanceMonitor.startMeasurement('test-operation');
        Math.random() * 1000;
        performanceMonitor.endMeasurement('test-operation');
      }, operationCount);
      
      // Monitoring overhead should be minimal
      const overhead = withMonitoring.average - withoutMonitoring.average;
      expect(overhead).toBeLessThan(0.1); // < 0.1ms overhead
    });

    test('should provide real-time metrics efficiently', () => {
      // Generate some test metrics
      for (let i = 0; i < 100; i++) {
        performanceMonitor.startMeasurement('test-metric');
        // Simulate work
        const start = Date.now();
        while (Date.now() - start < Math.random() * 10) {
          // Wait
        }
        performanceMonitor.endMeasurement('test-metric');
      }
      
      global.performanceMonitor.start('metrics-retrieval');
      
      const metrics = performanceMonitor.getMetrics();
      
      const duration = global.performanceMonitor.end('metrics-retrieval');
      
      expect(metrics).toBeDefined();
      expect(metrics['test-metric']).toBeDefined();
      expect(duration).toBeLessThan(10); // < 10ms to retrieve metrics
    });

    test('should handle metric aggregation efficiently', () => {
      // Generate large amount of metrics data
      const metricNames = ['operation-a', 'operation-b', 'operation-c'];
      
      global.performanceMonitor.start('metric-generation');
      
      for (let i = 0; i < 10000; i++) {
        const metricName = metricNames[i % metricNames.length];
        performanceMonitor.startMeasurement(metricName);
        performanceMonitor.endMeasurement(metricName);
      }
      
      const generationTime = global.performanceMonitor.end('metric-generation');
      
      global.performanceMonitor.start('metric-aggregation');
      
      const aggregatedMetrics = performanceMonitor.getAggregatedMetrics();
      
      const aggregationTime = global.performanceMonitor.end('metric-aggregation');
      
      expect(aggregatedMetrics).toBeDefined();
      expect(Object.keys(aggregatedMetrics)).toHaveLength(3);
      expect(generationTime).toBeWithinPerformanceThreshold(1000);
      expect(aggregationTime).toBeWithinPerformanceThreshold(100);
    });
  });

  describe('Memory Management', () => {
    test('should not have memory leaks during long operations', async () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Perform many operations that could potentially leak memory
      for (let i = 0; i < 1000; i++) {
        const key = `memory-test-${i}`;
        const value = {
          data: new Array(100).fill(i),
          timestamp: Date.now()
        };
        
        await multiLayerCache.set(key, value);
        await multiLayerCache.get(key);
        
        // Periodic cleanup
        if (i % 100 === 0) {
          if (global.gc) global.gc();
        }
      }
      
      // Force garbage collection
      if (global.gc) global.gc();
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });

    test('should handle large object caching efficiently', async () => {
      const largeObject = {
        id: 'large-object',
        data: new Array(100000).fill(0).map((_, i) => ({
          index: i,
          value: `value-${i}`,
          metadata: {
            created: Date.now(),
            processed: false
          }
        }))
      };
      
      global.performanceMonitor.start('large-object-caching');
      
      await multiLayerCache.set('large-object', largeObject);
      const retrieved = await multiLayerCache.get('large-object');
      
      const duration = global.performanceMonitor.end('large-object-caching');
      
      expect(retrieved).toBeDefined();
      expect(retrieved.data.length).toBe(100000);
      expect(duration).toBeWithinPerformanceThreshold(1000); // < 1 second
    });
  });

  describe('Optimization Manager Integration', () => {
    test('should coordinate optimizations effectively', async () => {
      // Configure optimization manager with test data
      await optimizationManager.initialize({
        kuzu: mockKuzu,
        cache: multiLayerCache,
        performanceMonitor: performanceMonitor
      });
      
      global.performanceMonitor.start('optimization-coordination');
      
      // Simulate workload
      const operations = Array.from({ length: 100 }, (_, i) => ({
        type: 'query',
        query: `MATCH (e:CodeEntity {id: 'entity-${i}'}) RETURN e`,
        cacheKey: `entity-${i}`
      }));
      
      const results = await Promise.all(
        operations.map(op => optimizationManager.executeOptimizedOperation(op))
      );
      
      const duration = global.performanceMonitor.end('optimization-coordination');
      
      expect(results).toHaveLength(100);
      expect(duration).toBeWithinPerformanceThreshold(2000); // < 2 seconds
      
      // Verify optimization benefits
      const stats = optimizationManager.getOptimizationStats();
      expect(stats.cacheHitRate).toBeGreaterThan(0);
      expect(stats.averageResponseTime).toBeLessThan(50); // < 50ms average
    });

    test('should adapt optimizations based on usage patterns', async () => {
      await optimizationManager.initialize({
        kuzu: mockKuzu,
        cache: multiLayerCache,
        performanceMonitor: performanceMonitor
      });
      
      // Simulate usage pattern with hotspots
      const hotspotOperations = Array.from({ length: 200 }, () => ({
        type: 'query',
        query: 'MATCH (e:CodeEntity) WHERE e.type = "hotspot" RETURN e',
        cacheKey: 'hotspot-query'
      }));
      
      const coldOperations = Array.from({ length: 20 }, (_, i) => ({
        type: 'query',
        query: `MATCH (e:CodeEntity) WHERE e.id = "cold-${i}" RETURN e`,
        cacheKey: `cold-query-${i}`
      }));
      
      global.performanceMonitor.start('adaptive-optimization');
      
      // Execute hotspot operations
      await Promise.all(
        hotspotOperations.map(op => optimizationManager.executeOptimizedOperation(op))
      );
      
      // Execute cold operations
      await Promise.all(
        coldOperations.map(op => optimizationManager.executeOptimizedOperation(op))
      );
      
      const duration = global.performanceMonitor.end('adaptive-optimization');
      
      const stats = optimizationManager.getOptimizationStats();
      
      // Hotspot queries should have high cache hit rate
      expect(stats.cacheHitRate).toBeGreaterThan(0.8);
      expect(duration).toBeWithinPerformanceThreshold(3000);
      
      // Optimization should adapt to patterns
      expect(stats.adaptiveOptimizationsApplied).toBeGreaterThan(0);
    });
  });

  describe('Load Testing', () => {
    test('should handle sustained high load', async () => {
      const loadDuration = 10000; // 10 seconds
      const requestsPerSecond = 50;
      const totalRequests = (loadDuration / 1000) * requestsPerSecond;
      
      let completedRequests = 0;
      let errorCount = 0;
      const startTime = Date.now();
      
      const loadTest = async () => {
        while (Date.now() - startTime < loadDuration) {
          try {
            const operation = {
              type: 'query',
              query: `MATCH (e:CodeEntity) RETURN count(e)`,
              cacheKey: `load-test-${Math.floor(Math.random() * 100)}`
            };
            
            await optimizationManager.executeOptimizedOperation(operation);
            completedRequests++;
            
            // Control request rate
            await new Promise(resolve => setTimeout(resolve, 1000 / requestsPerSecond));
          } catch (error) {
            errorCount++;
          }
        }
      };
      
      // Start load test
      await loadTest();
      
      const actualDuration = Date.now() - startTime;
      const actualRPS = completedRequests / (actualDuration / 1000);
      
      expect(completedRequests).toBeGreaterThan(totalRequests * 0.9); // 90% success rate
      expect(errorCount).toBeLessThan(totalRequests * 0.1); // < 10% error rate
      expect(actualRPS).toBeGreaterThan(requestsPerSecond * 0.8); // 80% of target RPS
    });

    test('should maintain response times under load', async () => {
      const responseTimes = [];
      const requestCount = 100;
      
      global.performanceMonitor.start('load-response-times');
      
      const requests = Array.from({ length: requestCount }, async (_, i) => {
        const requestStart = Date.now();
        
        await optimizationManager.executeOptimizedOperation({
          type: 'query',
          query: `MATCH (e:CodeEntity {id: 'test-${i}'}) RETURN e`,
          cacheKey: `response-time-test-${i}`
        });
        
        const requestTime = Date.now() - requestStart;
        responseTimes.push(requestTime);
      });
      
      await Promise.all(requests);
      
      const totalDuration = global.performanceMonitor.end('load-response-times');
      
      const averageResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const p95ResponseTime = responseTimes.sort((a, b) => a - b)[Math.floor(responseTimes.length * 0.95)];
      
      expect(averageResponseTime).toBeLessThan(100); // < 100ms average
      expect(p95ResponseTime).toBeLessThan(200); // < 200ms 95th percentile
      expect(totalDuration).toBeWithinPerformanceThreshold(10000); // < 10 seconds total
    });
  });
});