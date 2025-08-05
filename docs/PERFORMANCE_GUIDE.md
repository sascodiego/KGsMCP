# Performance Tuning Guide

## Table of Contents

1. [Performance Overview](#performance-overview)
2. [System Requirements](#system-requirements)
3. [Configuration Optimization](#configuration-optimization)
4. [Database Performance](#database-performance)
5. [Caching Strategies](#caching-strategies)
6. [Memory Management](#memory-management)
7. [Query Optimization](#query-optimization)
8. [Monitoring and Metrics](#monitoring-and-metrics)
9. [Troubleshooting Performance Issues](#troubleshooting-performance-issues)
10. [Best Practices](#best-practices)

---

## Performance Overview

The MCP Vibe Coding Knowledge Graph system is designed to handle large codebases efficiently while maintaining sub-second response times for most operations. This guide covers optimization strategies for different deployment scenarios.

### Performance Targets

| Operation | Target Response Time | Acceptable Range |
|-----------|---------------------|------------------|
| Tool calls | < 2 seconds | < 5 seconds |
| Database queries | < 100ms | < 500ms |
| Code analysis (per file) | < 1 second | < 3 seconds |
| Codebase initialization | < 30 seconds per 1000 files | < 60 seconds |
| Pattern detection | < 500ms | < 2 seconds |

### System Architecture Performance

```
┌─────────────────────────────────────────────────────────────┐
│                    Performance Layers                        │
├─────────────────────────────────────────────────────────────┤
│  L1 Cache (Memory) - 1-10ms response                        │
├─────────────────────────────────────────────────────────────┤
│  L2 Cache (Disk) - 10-50ms response                         │
├─────────────────────────────────────────────────────────────┤
│  Database Queries - 50-200ms response                       │
├─────────────────────────────────────────────────────────────┤
│  Code Analysis - 500ms-2s response                          │
└─────────────────────────────────────────────────────────────┘
```

---

## System Requirements

### Minimum Requirements

- **CPU**: 2 cores, 2.0 GHz
- **RAM**: 4 GB
- **Storage**: 1 GB free space
- **Node.js**: 18.0.0 or higher

### Recommended for Production

- **CPU**: 4+ cores, 3.0+ GHz
- **RAM**: 8+ GB
- **Storage**: SSD with 10+ GB free space
- **Node.js**: 18 LTS or 20 LTS

### High-Performance Configuration

- **CPU**: 8+ cores, 3.5+ GHz
- **RAM**: 16+ GB
- **Storage**: NVMe SSD with 50+ GB free space
- **Network**: Low-latency connection for remote databases

### Performance Scaling by Codebase Size

| Codebase Size | Recommended RAM | Estimated Init Time | Query Response |
|---------------|-----------------|-------------------|----------------|
| < 10K LOC | 2 GB | < 30 seconds | < 100ms |
| 10K-100K LOC | 4 GB | 1-5 minutes | < 200ms |
| 100K-1M LOC | 8 GB | 5-15 minutes | < 500ms |
| 1M+ LOC | 16+ GB | 15+ minutes | < 1 second |

---

## Configuration Optimization

### Production Configuration

```json
{
  "kuzu": {
    "databasePath": ".kg-context/knowledge-graph.kuzu",
    "bufferPoolSize": "1GB",
    "maxConnections": 20,
    "queryTimeout": 30000,
    "enableWAL": true,
    "healthCheckInterval": 30000
  },
  "optimization": {
    "cache": {
      "enabled": true,
      "layers": {
        "l1": {
          "type": "memory",
          "maxSize": 500,
          "ttl": 300000
        },
        "l2": {
          "type": "disk",
          "maxSize": 5000,
          "ttl": 3600000,
          "directory": ".kg-context/cache"
        }
      }
    },
    "query": {
      "enabled": true,
      "cacheSize": 2000,
      "cacheTTL": 600000,
      "enableQueryRewriting": true,
      "enableIndexHints": true
    },
    "memory": {
      "enabled": true,
      "gcInterval": 300000,
      "heapLimit": "4GB",
      "enableCompaction": true
    }
  },
  "validation": {
    "performance": {
      "enableCaching": true,
      "cacheSize": 2000,
      "enableBatching": true,
      "batchSize": 20
    }
  }
}
```

### Environment Variables for Performance

```bash
# Node.js optimization
export NODE_OPTIONS="--max-old-space-size=4096 --optimize-for-size"

# V8 performance flags
export NODE_OPTIONS="$NODE_OPTIONS --expose-gc --always-compact"

# CPU optimization
export UV_THREADPOOL_SIZE=8

# Garbage collection tuning
export NODE_OPTIONS="$NODE_OPTIONS --gc-interval=100"
```

### Development vs Production Settings

| Setting | Development | Production | High Performance |
|---------|-------------|------------|------------------|
| Buffer Pool Size | 128MB | 1GB | 2GB+ |
| Cache L1 Size | 50 | 500 | 1000+ |
| Cache L2 Size | 500 | 5000 | 10000+ |
| Max Connections | 5 | 20 | 50+ |
| GC Interval | 600000 | 300000 | 180000 |
| Validation Caching | false | true | true |

---

## Database Performance

### Buffer Pool Optimization

The buffer pool is crucial for database performance. Size it based on available memory:

```json
{
  "kuzu": {
    "bufferPoolSize": "2GB"  // 50-75% of available RAM
  }
}
```

**Sizing Guidelines:**
- **Small deployments** (< 4GB RAM): 128-256MB
- **Medium deployments** (4-8GB RAM): 512MB-1GB
- **Large deployments** (8+ GB RAM): 1-4GB

### Connection Pool Tuning

```json
{
  "kuzu": {
    "maxConnections": 20,
    "connectionTimeout": 5000,
    "idleTimeout": 30000,
    "acquireTimeout": 60000
  }
}
```

**Connection Pool Best Practices:**
- Start with 2x CPU cores
- Monitor connection usage
- Increase gradually if needed
- Consider connection lifetime

### Query Performance Optimization

#### 1. Index Usage

Kuzu automatically creates indexes for primary keys. For optimal performance:

```javascript
// Ensure queries use indexed fields
const query = `
  MATCH (e:CodeEntity {id: $entityId})
  RETURN e
`;  // Uses primary key index

// Avoid full table scans
const inefficientQuery = `
  MATCH (e:CodeEntity)
  WHERE e.name CONTAINS $searchTerm
  RETURN e
`;  // Requires full scan
```

#### 2. Query Structure Optimization

```javascript
// Optimized query structure
const optimizedQuery = `
  MATCH (e:CodeEntity)-[:IMPLEMENTS]->(p:Pattern)
  WHERE e.type = $entityType
    AND p.confidence > $minConfidence
  RETURN e, p
  LIMIT $limit
`;

// Avoid Cartesian products
const inefficientQuery = `
  MATCH (e:CodeEntity), (p:Pattern)
  WHERE e.complexity > 10 AND p.confidence > 0.8
  RETURN e, p
`;
```

#### 3. Result Limiting

Always use LIMIT for large result sets:

```javascript
const query = `
  MATCH (e:CodeEntity)
  WHERE e.type = $type
  RETURN e
  ORDER BY e.complexity DESC
  LIMIT 50
`;
```

### Database Maintenance

```javascript
// Automated maintenance tasks
class DatabaseMaintenance {
  async performMaintenance() {
    // Cleanup old data
    await this.cleanupOldEntries();
    
    // Update statistics
    await this.updateStatistics();
    
    // Optimize storage
    await this.optimizeStorage();
  }

  async cleanupOldEntries() {
    const cutoffTime = Date.now() - (30 * 24 * 60 * 60 * 1000); // 30 days
    
    await this.kuzu.query(`
      MATCH (e:CodeEntity)
      WHERE e.lastModified < $cutoffTime
        AND e.type = 'temporary'
      DELETE e
    `, { cutoffTime });
  }
}
```

---

## Caching Strategies

### Multi-Layer Cache Architecture

```javascript
// Cache configuration for optimal performance
{
  "cache": {
    "enabled": true,
    "layers": {
      "l1": {
        "type": "memory",
        "maxSize": 1000,        // Number of items
        "ttl": 300000,          // 5 minutes
        "algorithm": "lru"
      },
      "l2": {
        "type": "disk",
        "maxSize": 10000,       // Number of items
        "ttl": 3600000,         // 1 hour
        "directory": ".kg-context/cache",
        "compression": true
      }
    },
    "strategies": {
      "writeThrough": true,     // Write to all layers
      "readAside": true,        // Check cache before database
      "invalidation": "smart"   // Smart cache invalidation
    }
  }
}
```

### Cache Key Strategies

```javascript
// Effective cache key generation
class CacheKeyGenerator {
  generateToolKey(toolName, args) {
    // Create deterministic key from arguments
    const sortedArgs = JSON.stringify(args, Object.keys(args).sort());
    const hash = crypto.createHash('sha256')
      .update(`${toolName}:${sortedArgs}`)
      .digest('hex').substring(0, 16);
    
    return `tool:${toolName}:${hash}`;
  }

  generateQueryKey(query, params) {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    const paramHash = crypto.createHash('md5')
      .update(JSON.stringify(params))
      .digest('hex').substring(0, 8);
    
    return `query:${paramHash}:${normalizedQuery.length}`;
  }
}
```

### Cache Warming

```javascript
// Preload frequently accessed data
class CacheWarmer {
  async warmCache() {
    logger.info('Starting cache warming process');
    
    // Warm frequently used patterns
    await this.warmPatterns();
    
    // Warm common queries
    await this.warmCommonQueries();
    
    // Warm recent entities
    await this.warmRecentEntities();
  }

  async warmPatterns() {
    const patterns = await this.kuzu.query(`
      MATCH (p:Pattern)
      WHERE p.occurrences > 5
      RETURN p
      ORDER BY p.occurrences DESC
      LIMIT 50
    `);

    for (const pattern of patterns) {
      await this.cache.set(`pattern:${pattern.name}`, pattern);
    }
  }
}
```

### Cache Invalidation

```javascript
// Smart cache invalidation strategies
class CacheInvalidation {
  async invalidateByEntity(entityId) {
    // Invalidate all caches related to this entity
    const patterns = [
      `entity:${entityId}:*`,
      `pattern:*:${entityId}`,
      `query:*:${entityId}*`
    ];

    for (const pattern of patterns) {
      await this.cache.invalidatePattern(pattern);
    }
  }

  async invalidateByFileChange(filePath) {
    // Invalidate caches when files change
    const affectedEntities = await this.kuzu.query(`
      MATCH (e:CodeEntity)
      WHERE e.filePath = $filePath
      RETURN e.id
    `, { filePath });

    for (const entity of affectedEntities) {
      await this.invalidateByEntity(entity.id);
    }
  }
}
```

---

## Memory Management

### Node.js Memory Optimization

```bash
# Optimal Node.js memory settings
export NODE_OPTIONS="
  --max-old-space-size=4096
  --max-new-space-size=1024
  --optimize-for-size
  --gc-interval=100
  --expose-gc
"
```

### Memory Monitoring

```javascript
class MemoryMonitor {
  constructor() {
    this.memoryThresholds = {
      warning: 0.8,    // 80% of heap limit
      critical: 0.9    // 90% of heap limit
    };
  }

  startMonitoring() {
    setInterval(() => {
      this.checkMemoryUsage();
    }, 30000); // Check every 30 seconds
  }

  checkMemoryUsage() {
    const usage = process.memoryUsage();
    const heapUsedMB = usage.heapUsed / 1024 / 1024;
    const heapTotalMB = usage.heapTotal / 1024 / 1024;
    const utilization = heapUsedMB / heapTotalMB;

    if (utilization > this.memoryThresholds.critical) {
      logger.error('Critical memory usage', {
        heapUsed: `${heapUsedMB.toFixed(2)}MB`,
        heapTotal: `${heapTotalMB.toFixed(2)}MB`,
        utilization: `${(utilization * 100).toFixed(1)}%`
      });
      
      this.triggerGarbageCollection();
    } else if (utilization > this.memoryThresholds.warning) {
      logger.warn('High memory usage', {
        heapUsed: `${heapUsedMB.toFixed(2)}MB`,
        utilization: `${(utilization * 100).toFixed(1)}%`
      });
    }
  }

  triggerGarbageCollection() {
    if (global.gc) {
      logger.info('Triggering garbage collection');
      global.gc();
    }
  }
}
```

### Memory Leak Prevention

```javascript
// Proper cleanup in handlers
export class PerformantHandler {
  constructor(server) {
    this.server = server;
    this.activeRequests = new Map();
    this.cleanupInterval = setInterval(() => {
      this.cleanupStaleRequests();
    }, 60000);
  }

  async handleRequest(requestId, args) {
    try {
      // Track active request
      this.activeRequests.set(requestId, {
        startTime: Date.now(),
        args
      });

      const result = await this.processRequest(args);
      
      return result;
    } finally {
      // Always cleanup
      this.activeRequests.delete(requestId);
    }
  }

  cleanupStaleRequests() {
    const maxAge = 5 * 60 * 1000; // 5 minutes
    const now = Date.now();

    for (const [requestId, request] of this.activeRequests) {
      if (now - request.startTime > maxAge) {
        logger.warn('Cleaning up stale request', { requestId });
        this.activeRequests.delete(requestId);
      }
    }
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
    this.activeRequests.clear();
  }
}
```

---

## Query Optimization

### Query Patterns for Performance

#### 1. Use Specific Patterns Instead of Broad Searches

```javascript
// Optimized: Specific entity lookup
const optimized = `
  MATCH (e:CodeEntity {id: $entityId})
  RETURN e
`;

// Unoptimized: Broad search
const unoptimized = `
  MATCH (e:CodeEntity)
  WHERE e.name CONTAINS $searchTerm
  RETURN e
`;
```

#### 2. Limit Result Sets Early

```javascript
// Optimized: Early limiting
const optimized = `
  MATCH (e:CodeEntity)
  WHERE e.type = $type
  RETURN e
  ORDER BY e.complexity DESC
  LIMIT 10
`;

// Unoptimized: Late limiting
const unoptimized = `
  MATCH (e:CodeEntity)
  RETURN e
  ORDER BY e.complexity DESC
  LIMIT 10
`;
```

#### 3. Use Indexed Properties in WHERE Clauses

```javascript
// Optimized: Use indexed properties first
const optimized = `
  MATCH (e:CodeEntity {type: $type})
  WHERE e.complexity > $minComplexity
  RETURN e
`;

// Unoptimized: Non-indexed filter first
const unoptimized = `
  MATCH (e:CodeEntity)
  WHERE e.complexity > $minComplexity
    AND e.type = $type
  RETURN e
`;
```

### Query Caching

```javascript
class QueryCache {
  constructor(options = {}) {
    this.cache = new Map();
    this.maxSize = options.maxSize || 1000;
    this.ttl = options.ttl || 300000; // 5 minutes
    this.stats = { hits: 0, misses: 0 };
  }

  async query(cypherQuery, params = {}) {
    const cacheKey = this.generateKey(cypherQuery, params);
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.ttl) {
      this.stats.hits++;
      return cached.result;
    }

    this.stats.misses++;
    const result = await this.executeQuery(cypherQuery, params);
    
    this.cache.set(cacheKey, {
      result,
      timestamp: Date.now()
    });

    this.enforceMaxSize();
    return result;
  }

  generateKey(query, params) {
    const normalizedQuery = query.replace(/\s+/g, ' ').trim();
    const paramString = JSON.stringify(params, Object.keys(params).sort());
    return `${normalizedQuery}|${paramString}`;
  }

  enforceMaxSize() {
    if (this.cache.size > this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
  }

  getStats() {
    const total = this.stats.hits + this.stats.misses;
    return {
      ...this.stats,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      cacheSize: this.cache.size
    };
  }
}
```

### Batch Operations

```javascript
class BatchQueryProcessor {
  constructor(batchSize = 100) {
    this.batchSize = batchSize;
    this.pendingOperations = [];
  }

  async addOperation(operation) {
    this.pendingOperations.push(operation);
    
    if (this.pendingOperations.length >= this.batchSize) {
      await this.processBatch();
    }
  }

  async processBatch() {
    if (this.pendingOperations.length === 0) return;

    const batch = this.pendingOperations.splice(0, this.batchSize);
    
    try {
      // Group operations by type
      const grouped = this.groupOperations(batch);
      
      // Execute each group efficiently
      for (const [type, operations] of Object.entries(grouped)) {
        await this.executeOperationGroup(type, operations);
      }
    } catch (error) {
      logger.error('Batch processing failed:', error);
      throw error;
    }
  }

  groupOperations(operations) {
    return operations.reduce((groups, op) => {
      if (!groups[op.type]) groups[op.type] = [];
      groups[op.type].push(op);
      return groups;
    }, {});
  }

  async executeOperationGroup(type, operations) {
    switch (type) {
      case 'createNode':
        await this.batchCreateNodes(operations);
        break;
      case 'createRelationship':
        await this.batchCreateRelationships(operations);
        break;
      case 'query':
        await this.batchExecuteQueries(operations);
        break;
    }
  }
}
```

---

## Monitoring and Metrics

### Performance Metrics Collection

```javascript
class PerformanceMonitor {
  constructor() {
    this.metrics = {
      toolCalls: new Map(),
      queryTimes: [],
      memoryUsage: [],
      errorRates: new Map(),
      cacheStats: { hits: 0, misses: 0 }
    };
    
    this.startCollection();
  }

  startCollection() {
    // Collect metrics every 30 seconds
    setInterval(() => {
      this.collectMetrics();
    }, 30000);
  }

  collectMetrics() {
    const memUsage = process.memoryUsage();
    
    this.metrics.memoryUsage.push({
      timestamp: Date.now(),
      heapUsed: memUsage.heapUsed,
      heapTotal: memUsage.heapTotal,
      external: memUsage.external,
      rss: memUsage.rss
    });

    // Keep only last 1000 data points
    if (this.metrics.memoryUsage.length > 1000) {
      this.metrics.memoryUsage.shift();
    }
  }

  recordToolCall(toolName, duration, success) {
    if (!this.metrics.toolCalls.has(toolName)) {
      this.metrics.toolCalls.set(toolName, {
        count: 0,
        totalTime: 0,
        errors: 0,
        avgTime: 0
      });
    }

    const stats = this.metrics.toolCalls.get(toolName);
    stats.count++;
    stats.totalTime += duration;
    stats.avgTime = stats.totalTime / stats.count;
    
    if (!success) {
      stats.errors++;
    }
  }

  recordQueryTime(duration) {
    this.metrics.queryTimes.push({
      timestamp: Date.now(),
      duration
    });

    // Keep only last 1000 queries
    if (this.metrics.queryTimes.length > 1000) {
      this.metrics.queryTimes.shift();
    }
  }

  getPerformanceReport() {
    return {
      toolMetrics: this.getToolMetrics(),
      queryMetrics: this.getQueryMetrics(),
      memoryMetrics: this.getMemoryMetrics(),
      systemHealth: this.getSystemHealth()
    };
  }

  getToolMetrics() {
    const metrics = {};
    
    for (const [toolName, stats] of this.metrics.toolCalls) {
      metrics[toolName] = {
        ...stats,
        errorRate: stats.count > 0 ? stats.errors / stats.count : 0
      };
    }

    return metrics;
  }

  getQueryMetrics() {
    const recentQueries = this.metrics.queryTimes.slice(-100);
    
    if (recentQueries.length === 0) {
      return { avgTime: 0, p95: 0, p99: 0 };
    }

    const times = recentQueries.map(q => q.duration).sort((a, b) => a - b);
    
    return {
      avgTime: times.reduce((sum, time) => sum + time, 0) / times.length,
      p95: times[Math.floor(times.length * 0.95)],
      p99: times[Math.floor(times.length * 0.99)],
      count: times.length
    };
  }

  getMemoryMetrics() {
    const recent = this.metrics.memoryUsage.slice(-10);
    
    if (recent.length === 0) {
      return {};
    }

    const latest = recent[recent.length - 1];
    const avgHeapUsed = recent.reduce((sum, m) => sum + m.heapUsed, 0) / recent.length;
    
    return {
      current: {
        heapUsed: latest.heapUsed,
        heapTotal: latest.heapTotal,
        rss: latest.rss
      },
      average: {
        heapUsed: avgHeapUsed
      },
      utilization: latest.heapUsed / latest.heapTotal
    };
  }
}
```

### Real-time Performance Dashboard

```javascript
class PerformanceDashboard {
  constructor(monitor) {
    this.monitor = monitor;
    this.alertThresholds = {
      responseTime: 2000,
      memoryUtilization: 0.8,
      errorRate: 0.05,
      queryTime: 500
    };
  }

  async generateReport() {
    const report = this.monitor.getPerformanceReport();
    
    return {
      ...report,
      alerts: this.checkAlerts(report),
      recommendations: this.generateRecommendations(report),
      timestamp: new Date().toISOString()
    };
  }

  checkAlerts(report) {
    const alerts = [];

    // Check response times
    for (const [tool, metrics] of Object.entries(report.toolMetrics)) {
      if (metrics.avgTime > this.alertThresholds.responseTime) {
        alerts.push({
          type: 'high_response_time',
          tool,
          value: metrics.avgTime,
          threshold: this.alertThresholds.responseTime
        });
      }

      if (metrics.errorRate > this.alertThresholds.errorRate) {
        alerts.push({
          type: 'high_error_rate',
          tool,
          value: metrics.errorRate,
          threshold: this.alertThresholds.errorRate
        });
      }
    }

    // Check memory utilization
    if (report.memoryMetrics.utilization > this.alertThresholds.memoryUtilization) {
      alerts.push({
        type: 'high_memory_usage',
        value: report.memoryMetrics.utilization,
        threshold: this.alertThresholds.memoryUtilization
      });
    }

    return alerts;
  }

  generateRecommendations(report) {
    const recommendations = [];

    // Memory recommendations
    if (report.memoryMetrics.utilization > 0.7) {
      recommendations.push({
        type: 'memory',
        message: 'Consider increasing Node.js heap size or enabling garbage collection optimization',
        priority: 'medium'
      });
    }

    // Query performance recommendations
    if (report.queryMetrics.avgTime > 200) {
      recommendations.push({
        type: 'database',
        message: 'Database queries are slower than optimal. Consider optimizing queries or increasing buffer pool size',
        priority: 'high'
      });
    }

    return recommendations;
  }
}
```

---

## Troubleshooting Performance Issues

### Common Performance Problems

#### 1. Slow Tool Response Times

**Symptoms:**
- Tools take > 5 seconds to respond
- Timeouts in Claude Desktop

**Diagnosis:**
```bash
# Check tool performance
LOG_LEVEL=debug npx @mcp/vibe-coding-kg start

# Monitor system resources
htop
iostat -x 1
```

**Solutions:**
- Enable query caching
- Optimize database buffer pool
- Reduce analysis scope
- Enable performance optimizations

#### 2. High Memory Usage

**Symptoms:**
- Memory usage grows over time
- Out of memory errors
- System becomes unresponsive

**Diagnosis:**
```bash
# Memory profiling
node --inspect --max-old-space-size=4096 index.js

# Monitor memory trends
watch -n 5 'ps aux | grep mcp-vibe-coding'
```

**Solutions:**
- Increase Node.js heap size
- Enable garbage collection
- Implement memory monitoring
- Optimize data structures

#### 3. Database Performance Issues

**Symptoms:**
- Queries take > 1 second
- Database connection timeouts
- High disk I/O

**Diagnosis:**
```bash
# Database profiling
tail -f logs/queries.log

# I/O monitoring
iotop -a
```

**Solutions:**
- Increase buffer pool size
- Optimize query patterns
- Use query caching
- Consider SSD storage

### Performance Debugging Tools

```javascript
// Performance profiler for specific operations
class OperationProfiler {
  constructor() {
    this.profiles = new Map();
  }

  startProfile(operationId) {
    this.profiles.set(operationId, {
      startTime: process.hrtime.bigint(),
      startMemory: process.memoryUsage()
    });
  }

  endProfile(operationId) {
    const profile = this.profiles.get(operationId);
    if (!profile) return null;

    const endTime = process.hrtime.bigint();
    const endMemory = process.memoryUsage();

    const result = {
      duration: Number(endTime - profile.startTime) / 1000000, // ms
      memoryDelta: {
        heapUsed: endMemory.heapUsed - profile.startMemory.heapUsed,
        heapTotal: endMemory.heapTotal - profile.startMemory.heapTotal,
        external: endMemory.external - profile.startMemory.external
      }
    };

    this.profiles.delete(operationId);
    return result;
  }
}

// Usage example
const profiler = new OperationProfiler();

async function profiledOperation(operationId) {
  profiler.startProfile(operationId);
  
  try {
    // Your operation here
    const result = await someExpensiveOperation();
    return result;
  } finally {
    const profile = profiler.endProfile(operationId);
    logger.info('Operation profile', { operationId, profile });
  }
}
```

---

## Best Practices

### Configuration Best Practices

1. **Size buffer pool appropriately**
   - Use 50-75% of available RAM
   - Monitor cache hit rates
   - Adjust based on workload

2. **Enable caching strategically**
   - Cache frequently accessed data
   - Use appropriate TTL values
   - Monitor cache hit rates

3. **Optimize connection pools**
   - Start with 2x CPU cores
   - Monitor connection usage
   - Adjust based on load

### Code Best Practices

1. **Efficient query patterns**
   ```javascript
   // Good: Use specific lookups
   const entity = await kuzu.query(`
     MATCH (e:CodeEntity {id: $id}) RETURN e
   `, { id });

   // Bad: Full table scan
   const entities = await kuzu.query(`
     MATCH (e:CodeEntity) WHERE e.name = $name RETURN e
   `, { name });
   ```

2. **Proper resource cleanup**
   ```javascript
   class ResourceManager {
     constructor() {
       this.resources = new Set();
     }

     acquire(resource) {
       this.resources.add(resource);
       return resource;
     }

     release(resource) {
       if (this.resources.has(resource)) {
         resource.cleanup?.();
         this.resources.delete(resource);
       }
     }

     cleanup() {
       for (const resource of this.resources) {
         resource.cleanup?.();
       }
       this.resources.clear();
     }
   }
   ```

3. **Batch operations when possible**
   ```javascript
   // Good: Batch multiple operations
   await batchProcessor.addOperations(operations);
   await batchProcessor.execute();

   // Bad: Individual operations
   for (const operation of operations) {
     await executeOperation(operation);
   }
   ```

### Monitoring Best Practices

1. **Set up performance alerts**
   - Response time thresholds
   - Memory usage alerts
   - Error rate monitoring

2. **Regular performance reviews**
   - Weekly performance reports
   - Trend analysis
   - Capacity planning

3. **Continuous optimization**
   - A/B test configuration changes
   - Monitor impact of optimizations
   - Regular performance profiling

By following this performance tuning guide, you can ensure your MCP Vibe Coding Knowledge Graph system operates efficiently at scale. Remember to measure before optimizing, and always test performance changes in a staging environment before deploying to production.