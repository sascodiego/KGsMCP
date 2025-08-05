# Migration Guide

## Table of Contents

1. [Migration Overview](#migration-overview)
2. [Version Compatibility](#version-compatibility)
3. [Pre-Migration Preparation](#pre-migration-preparation)
4. [Migration Procedures](#migration-procedures)
5. [Configuration Updates](#configuration-updates)
6. [Database Schema Migration](#database-schema-migration)
7. [API Changes](#api-changes)
8. [Breaking Changes](#breaking-changes)
9. [Post-Migration Validation](#post-migration-validation)
10. [Rollback Procedures](#rollback-procedures)

---

## Migration Overview

This guide covers upgrading between versions of the MCP Vibe Coding Knowledge Graph system. Each version may introduce new features, bug fixes, security improvements, and potentially breaking changes that require careful migration.

### Migration Types

1. **Patch Updates** (1.0.x → 1.0.y): Bug fixes, minor improvements
2. **Minor Updates** (1.x → 1.y): New features, backwards compatible
3. **Major Updates** (x → y): Breaking changes, significant architecture updates

### Migration Principles

- **Safety First**: Always backup before migration
- **Validate Thoroughly**: Test in development environment first
- **Monitor Closely**: Watch for issues during and after migration
- **Have Rollback Plan**: Be prepared to revert if needed

---

## Version Compatibility

### Version 1.0.x to 1.1.x (Minor Update)

**Release Date**: Q2 2024
**Migration Difficulty**: Low
**Estimated Downtime**: < 5 minutes

**New Features:**
- Enhanced Arduino ESP32 support
- Improved query optimization
- Real-time performance monitoring
- Advanced caching system

**Breaking Changes:** None

**Configuration Changes:**
- New optimization settings (optional)
- Enhanced validation options (optional)

### Version 1.x to 2.0.x (Major Update - Future)

**Release Date**: Q4 2024 (Planned)
**Migration Difficulty**: High
**Estimated Downtime**: 30-60 minutes

**New Features:**
- Distributed architecture support
- Advanced AI integration
- Multi-tenant support
- GraphQL API

**Breaking Changes:**
- Database schema changes
- Configuration format updates
- Tool interface modifications
- Deprecated handler removal

---

## Pre-Migration Preparation

### 1. System Assessment

Before starting any migration, assess your current system:

```bash
# Check current version
npx @mcp/vibe-coding-kg --version

# Get system health report
npx @mcp/vibe-coding-kg health

# Check knowledge graph statistics
npx @mcp/vibe-coding-kg get_kg_statistics --includeDetails true

# Review current configuration
cat .mcp-vibe-config.json
```

### 2. Backup Procedures

**Critical**: Always create a complete backup before migration.

```bash
# Create timestamped backup
BACKUP_DATE=$(date +%Y%m%d_%H%M%S)
npx @mcp/vibe-coding-kg backup ./backups/pre-migration-${BACKUP_DATE}.tar.gz

# Backup configuration files
cp .mcp-vibe-config.json ./backups/config-${BACKUP_DATE}.json
cp ~/.config/Claude/claude_desktop_config.json ./backups/claude-config-${BACKUP_DATE}.json

# Backup custom modifications (if any)
tar -czf ./backups/custom-modifications-${BACKUP_DATE}.tar.gz src/ config/ docs/
```

### 3. Environment Preparation

```bash
# Create migration staging environment
mkdir migration-staging
cd migration-staging

# Install current version for testing
npm init -y
npm install @mcp/vibe-coding-kg@current

# Test current functionality
npx @mcp/vibe-coding-kg setup
npx @mcp/vibe-coding-kg init ./test-codebase
```

### 4. Dependency Check

```bash
# Check Node.js version compatibility
node --version

# Check npm version
npm --version

# Check disk space
df -h .

# Check memory availability
free -h
```

---

## Migration Procedures

### Patch Updates (1.0.x → 1.0.y)

Patch updates are typically safe and can be applied with minimal risk.

```bash
# Step 1: Update package
npm update -g @mcp/vibe-coding-kg

# Step 2: Verify installation
npx @mcp/vibe-coding-kg --version

# Step 3: Test basic functionality
npx @mcp/vibe-coding-kg health

# Step 4: Restart Claude Desktop
# Restart Claude Desktop application
```

### Minor Updates (1.x → 1.y)

Minor updates may include new features and configuration options.

```bash
# Step 1: Stop MCP server (if running standalone)
pkill -f "mcp-vibe-coding"

# Step 2: Create backup
npx @mcp/vibe-coding-kg backup ./backups/pre-minor-update.tar.gz

# Step 3: Update package
npm update -g @mcp/vibe-coding-kg

# Step 4: Run migration script (if available)
npx @mcp/vibe-coding-kg migrate --from=1.0 --to=1.1

# Step 5: Update configuration (if needed)
npx @mcp/vibe-coding-kg setup --upgrade

# Step 6: Validate database schema
npx @mcp/vibe-coding-kg validate-schema

# Step 7: Test functionality
npx @mcp/vibe-coding-kg health
npx @mcp/vibe-coding-kg get_kg_statistics

# Step 8: Restart Claude Desktop
```

### Major Updates (x → y)

Major updates require careful planning and may involve breaking changes.

```bash
# Step 1: Comprehensive backup
./scripts/create-full-backup.sh

# Step 2: Export data in portable format
npx @mcp/vibe-coding-kg export --format=json --output=./migration-data.json

# Step 3: Stop all services
pkill -f "mcp-vibe-coding"

# Step 4: Install new major version
npm uninstall -g @mcp/vibe-coding-kg
npm install -g @mcp/vibe-coding-kg@2.0.0

# Step 5: Run major migration script
npx @mcp/vibe-coding-kg migrate-major --from=1.x --to=2.0

# Step 6: Import data with transformation
npx @mcp/vibe-coding-kg import --input=./migration-data.json --transform=v2

# Step 7: Update configuration
npx @mcp/vibe-coding-kg setup --major-upgrade

# Step 8: Comprehensive validation
npx @mcp/vibe-coding-kg validate-migration

# Step 9: Performance testing
npx @mcp/vibe-coding-kg test-performance
```

---

## Configuration Updates

### Configuration Schema Evolution

#### Version 1.0 to 1.1 Configuration Changes

**New Optional Settings:**

```json
{
  "optimization": {
    "cache": {
      "enabled": true,
      "layers": {
        "l1": { "maxSize": 500, "ttl": 300000 },
        "l2": { "maxSize": 5000, "ttl": 3600000 }
      }
    },
    "query": {
      "enableAdvancedOptimization": true,
      "adaptiveQueryPlanning": true
    }
  },
  "monitoring": {
    "realTimeMetrics": true,
    "performanceAlerts": true,
    "alertThresholds": {
      "responseTime": 2000,
      "memoryUsage": 80,
      "errorRate": 5
    }
  }
}
```

### Automated Configuration Migration

```bash
# Migrate configuration automatically
npx @mcp/vibe-coding-kg migrate-config \
  --input=.mcp-vibe-config.json \
  --output=.mcp-vibe-config-v1.1.json \
  --target-version=1.1

# Validate new configuration
npx @mcp/vibe-coding-kg validate-config .mcp-vibe-config-v1.1.json

# Apply new configuration
mv .mcp-vibe-config.json .mcp-vibe-config-v1.0-backup.json
mv .mcp-vibe-config-v1.1.json .mcp-vibe-config.json
```

### Manual Configuration Updates

If automatic migration is not available:

```javascript
// Example: Manual configuration update script
const fs = require('fs');
const path = require('path');

function migrateConfig(oldConfigPath, newConfigPath) {
  const oldConfig = JSON.parse(fs.readFileSync(oldConfigPath, 'utf8'));
  
  // Add new v1.1 features with defaults
  const newConfig = {
    ...oldConfig,
    optimization: {
      ...oldConfig.optimization,
      cache: {
        enabled: true,
        layers: {
          l1: { maxSize: 500, ttl: 300000 },
          l2: { maxSize: 5000, ttl: 3600000 }
        }
      }
    },
    monitoring: {
      realTimeMetrics: true,
      performanceAlerts: false, // Conservative default
      alertThresholds: {
        responseTime: 2000,
        memoryUsage: 80,
        errorRate: 5
      }
    }
  };
  
  fs.writeFileSync(newConfigPath, JSON.stringify(newConfig, null, 2));
  console.log(`Configuration migrated: ${oldConfigPath} → ${newConfigPath}`);
}

// Usage
migrateConfig('.mcp-vibe-config.json', '.mcp-vibe-config-v1.1.json');
```

---

## Database Schema Migration

### Automatic Schema Migration

```bash
# Check current schema version
npx @mcp/vibe-coding-kg schema-version

# Run schema migration
npx @mcp/vibe-coding-kg migrate-schema --target=latest

# Verify schema integrity
npx @mcp/vibe-coding-kg validate-schema --verbose
```

### Manual Schema Updates

For major version migrations, manual intervention might be required:

#### Version 1.0 to 2.0 Schema Changes

**New Tables:**
- `UserSession`: User authentication sessions
- `ProjectAccess`: Project-based access control
- `PerformanceMetrics`: System performance tracking

**Modified Tables:**
- `CodeEntity`: Added `projectId`, `accessLevel` fields
- `Pattern`: Added `confidence`, `usage_count` fields
- `Decision`: Added `approver`, `status` fields

**Migration Script:**

```javascript
// Database schema migration script
export class SchemaMigrator {
  async migrateToV2() {
    console.log('Starting schema migration to v2.0...');
    
    try {
      // 1. Create new tables
      await this.createNewTables();
      
      // 2. Add new columns to existing tables
      await this.addNewColumns();
      
      // 3. Migrate existing data
      await this.migrateExistingData();
      
      // 4. Create new indexes
      await this.createNewIndexes();
      
      // 5. Update schema version
      await this.updateSchemaVersion('2.0');
      
      console.log('Schema migration completed successfully');
      
    } catch (error) {
      console.error('Schema migration failed:', error);
      throw error;
    }
  }

  async createNewTables() {
    const newTables = [
      `CREATE NODE TABLE IF NOT EXISTS UserSession(
        id STRING,
        userId STRING,
        token STRING,
        createdAt INT64,
        expiresAt INT64,
        active BOOLEAN,
        PRIMARY KEY (id)
      )`,
      
      `CREATE NODE TABLE IF NOT EXISTS ProjectAccess(
        id STRING,
        userId STRING,
        projectId STRING,
        accessLevel STRING,
        grantedAt INT64,
        grantedBy STRING,
        PRIMARY KEY (id)
      )`,
      
      `CREATE NODE TABLE IF NOT EXISTS PerformanceMetrics(
        id STRING,
        metricType STRING,
        value DOUBLE,
        timestamp INT64,
        context STRING,
        PRIMARY KEY (id)
      )`
    ];

    for (const table of newTables) {
      await this.kuzu.query(table);
    }
  }

  async addNewColumns() {
    // Note: Kuzu doesn't support ALTER TABLE ADD COLUMN yet
    // For now, we'll handle this through data migration
    console.log('Column additions will be handled during data migration');
  }

  async migrateExistingData() {
    // Migrate CodeEntity data with new fields
    const entities = await this.kuzu.query(`
      MATCH (e:CodeEntity)
      RETURN e
    `);

    for (const entity of entities) {
      const updatedEntity = {
        ...entity,
        projectId: entity.projectId || 'default',
        accessLevel: entity.accessLevel || 'public'
      };

      // Re-create entity with new structure
      await this.recreateEntity(entity.id, updatedEntity);
    }
  }

  async recreateEntity(entityId, newData) {
    // Delete old entity
    await this.kuzu.query(`
      MATCH (e:CodeEntity {id: $entityId})
      DELETE e
    `, { entityId });

    // Create new entity
    await this.kuzu.createNode('CodeEntity', newData);
  }
}
```

### Data Transformation Scripts

```bash
# Run data transformation for v2.0
npx @mcp/vibe-coding-kg transform-data \
  --script=./migrations/v2.0-data-transform.js \
  --backup=./backups/pre-transform-backup.tar.gz \
  --dry-run

# Apply transformation if dry-run looks good
npx @mcp/vibe-coding-kg transform-data \
  --script=./migrations/v2.0-data-transform.js \
  --apply
```

---

## API Changes

### Tool Interface Changes

#### Version 1.0 to 1.1 Changes

**Enhanced Arduino Tools:**

```javascript
// Old interface (v1.0)
await handlers.arduino.analyzeArduinoSketch({
  sketchPath: '/path/to/sketch.ino',
  targetBoard: 'uno'
});

// New interface (v1.1) - backward compatible
await handlers.arduino.analyzeArduinoSketch({
  sketchPath: '/path/to/sketch.ino',
  targetBoard: 'uno',
  includeLibraries: true,           // New optional parameter
  optimizationLevel: 'standard',   // New optional parameter
  hardwareProfile: 'default'       // New optional parameter
});
```

**New Response Format:**

```javascript
// v1.0 Response
{
  "memoryUsage": { "ram": 1234, "flash": 5678 },
  "optimization": ["suggestion1", "suggestion2"]
}

// v1.1 Response (enhanced)
{
  "memoryUsage": { 
    "ram": 1234, 
    "flash": 5678,
    "eeprom": 128,           // New field
    "percentages": {         // New field
      "ram": 60.4,
      "flash": 17.6
    }
  },
  "optimization": [
    {
      "type": "memory",      // Enhanced structure
      "description": "Use PROGMEM for strings",
      "impact": "Save 200 bytes",
      "difficulty": "easy"
    }
  ],
  "compatibility": {         // New section
    "warnings": [],
    "errors": []
  }
}
```

### Client Code Updates

```javascript
// Update client code to handle new response format
function handleArduinoAnalysis(response) {
  // Handle both old and new formats
  const analysis = JSON.parse(response.content[0].text);
  
  // Access memory usage (works with both versions)
  const ramUsage = analysis.memoryUsage.ram;
  
  // Access percentage (v1.1+ only)
  const ramPercentage = analysis.memoryUsage.percentages?.ram || 
    calculatePercentage(ramUsage, 'uno');
  
  // Handle optimizations
  const optimizations = Array.isArray(analysis.optimization)
    ? analysis.optimization.map(opt => 
        typeof opt === 'string' ? { description: opt } : opt
      )
    : [];
  
  return { ramUsage, ramPercentage, optimizations };
}
```

---

## Breaking Changes

### Version 2.0 Breaking Changes (Future)

#### Configuration Format Changes

**Before (v1.x):**
```json
{
  "kuzu": {
    "databasePath": ".kg-context/knowledge-graph.kuzu"
  },
  "logging": {
    "level": "info"
  }
}
```

**After (v2.0):**
```json
{
  "database": {
    "type": "kuzu",
    "connection": {
      "path": ".kg-context/knowledge-graph.kuzu",
      "poolSize": 10
    }
  },
  "logging": {
    "level": "info",
    "format": "structured",
    "outputs": ["console", "file"]
  },
  "features": {
    "multiTenant": false,
    "distributed": false
  }
}
```

#### Deprecated Tool Removal

Tools marked as deprecated in v1.x will be removed in v2.0:

```javascript
// Removed in v2.0
await handlers.legacy.analyzeLegacyCode(args);  // REMOVED

// Replacement
await handlers.analysis.analyzeCode(args);      // Use this instead
```

#### Handler Interface Changes

```javascript
// v1.x Handler
class CodeGenerationHandler {
  async generateWithContext(args) {
    // v1.x implementation
  }
}

// v2.0 Handler (breaking change)
class CodeGenerationHandler {
  async generateWithContext(args, context = {}) {  // New context parameter
    // v2.0 implementation with context support
  }
  
  // New required method
  async validatePermissions(user, operation) {
    // Permission validation required in v2.0
  }
}
```

### Migration Scripts for Breaking Changes

```bash
# Automated migration for breaking changes
npx @mcp/vibe-coding-kg migrate-breaking-changes \
  --from=1.x \
  --to=2.0 \
  --config=.mcp-vibe-config.json \
  --preview

# Apply breaking change migrations
npx @mcp/vibe-coding-kg migrate-breaking-changes \
  --from=1.x \
  --to=2.0 \
  --config=.mcp-vibe-config.json \
  --apply
```

---

## Post-Migration Validation

### Comprehensive Testing Suite

```bash
# Run full validation suite
npx @mcp/vibe-coding-kg validate-migration --comprehensive

# Test specific functionality
npx @mcp/vibe-coding-kg test-tools --all
npx @mcp/vibe-coding-kg test-database --integrity
npx @mcp/vibe-coding-kg test-performance --baseline

# Validate data integrity
npx @mcp/vibe-coding-kg validate-data --compare-with-backup
```

### Manual Validation Checklist

#### Functional Testing

- [ ] **Server Startup**: Server starts without errors
- [ ] **Tool Availability**: All expected tools are available
- [ ] **Database Connection**: Database connects successfully
- [ ] **Basic Operations**: Basic CRUD operations work
- [ ] **Claude Integration**: Claude Desktop integration functions

#### Data Integrity Testing

- [ ] **Entity Count**: Same number of entities before/after migration
- [ ] **Relationship Count**: Relationships preserved correctly
- [ ] **Pattern Data**: Design patterns maintained
- [ ] **Configuration**: Settings preserved or properly migrated
- [ ] **Custom Data**: Any custom modifications preserved

#### Performance Testing

```bash
# Benchmark performance after migration
npx @mcp/vibe-coding-kg benchmark \
  --test=query_performance \
  --iterations=100 \
  --output=./post-migration-benchmark.json

# Compare with pre-migration benchmarks
npx @mcp/vibe-coding-kg compare-benchmarks \
  --before=./pre-migration-benchmark.json \
  --after=./post-migration-benchmark.json
```

### Validation Scripts

```javascript
// Automated validation script
export class MigrationValidator {
  async validateMigration(backupPath) {
    const results = {
      dataIntegrity: await this.validateDataIntegrity(backupPath),
      functionality: await this.validateFunctionality(),
      performance: await this.validatePerformance(),
      configuration: await this.validateConfiguration()
    };

    return this.generateValidationReport(results);
  }

  async validateDataIntegrity(backupPath) {
    // Compare entity counts
    const beforeCounts = await this.getEntityCountsFromBackup(backupPath);
    const afterCounts = await this.getCurrentEntityCounts();

    const integrity = {
      codeEntities: this.compareCounts(beforeCounts.codeEntities, afterCounts.codeEntities),
      patterns: this.compareCounts(beforeCounts.patterns, afterCounts.patterns),
      rules: this.compareCounts(beforeCounts.rules, afterCounts.rules),
      relationships: this.compareCounts(beforeCounts.relationships, afterCounts.relationships)
    };

    return {
      passed: Object.values(integrity).every(check => check.passed),
      details: integrity
    };
  }

  async validateFunctionality() {
    const tests = [
      { name: 'query_context_for_task', test: () => this.testContextQuery() },
      { name: 'generate_code_with_context', test: () => this.testCodeGeneration() },
      { name: 'validate_against_kg', test: () => this.testValidation() },
      { name: 'analyze_arduino_sketch', test: () => this.testArduinoAnalysis() }
    ];

    const results = {};
    for (const test of tests) {
      try {
        await test.test();
        results[test.name] = { passed: true };
      } catch (error) {
        results[test.name] = { passed: false, error: error.message };
      }
    }

    return {
      passed: Object.values(results).every(test => test.passed),
      details: results
    };
  }
}
```

---

## Rollback Procedures

### When to Rollback

Consider rollback if:
- Critical functionality is broken
- Data corruption is detected
- Performance degradation > 50%
- Security vulnerabilities introduced
- Client integrations fail

### Rollback Steps

#### Quick Rollback (Patch/Minor Updates)

```bash
# Step 1: Stop current version
pkill -f "mcp-vibe-coding"

# Step 2: Downgrade package
npm install -g @mcp/vibe-coding-kg@1.0.5  # Previous version

# Step 3: Restore configuration if needed
cp ./backups/config-backup.json .mcp-vibe-config.json

# Step 4: Restart services
npx @mcp/vibe-coding-kg health

# Step 5: Verify functionality
npx @mcp/vibe-coding-kg test-basic-functionality
```

#### Full Rollback (Major Updates)

```bash
# Step 1: Stop all services
pkill -f "mcp-vibe-coding"

# Step 2: Remove current version
npm uninstall -g @mcp/vibe-coding-kg

# Step 3: Install previous version
npm install -g @mcp/vibe-coding-kg@1.9.9

# Step 4: Restore database from backup
rm -rf .kg-context/knowledge-graph.kuzu
npx @mcp/vibe-coding-kg restore ./backups/pre-migration-backup.tar.gz

# Step 5: Restore configuration
cp ./backups/config-pre-migration.json .mcp-vibe-config.json

# Step 6: Verify rollback
npx @mcp/vibe-coding-kg validate-rollback

# Step 7: Test functionality
npx @mcp/vibe-coding-kg test-comprehensive
```

### Rollback Validation

```bash
# Validate rollback success
npx @mcp/vibe-coding-kg validate-rollback \
  --version=1.9.9 \
  --backup=./backups/pre-migration-backup.tar.gz \
  --config=./backups/config-pre-migration.json

# Test specific functionality that failed
npx @mcp/vibe-coding-kg test-specific \
  --tool=analyze_codebase \
  --tool=generate_code_with_context
```

---

## Migration Best Practices

### Planning Phase

1. **Test in Staging**: Always test migration in a staging environment first
2. **Read Release Notes**: Understand all changes and potential impacts
3. **Schedule Downtime**: Plan for appropriate maintenance windows
4. **Prepare Team**: Ensure team is aware of migration and potential issues
5. **Have Communication Plan**: Prepare user communication about downtime

### Execution Phase

1. **Create Checkpoints**: Create backups at each major step
2. **Monitor Progress**: Watch for errors or unexpected behavior
3. **Validate Each Step**: Test functionality after each migration step
4. **Document Issues**: Record any problems encountered
5. **Be Prepared to Rollback**: Have rollback plan ready to execute

### Post-Migration Phase

1. **Monitor Closely**: Watch system closely for 24-48 hours
2. **Performance Baseline**: Establish new performance baselines
3. **User Feedback**: Collect feedback from users
4. **Document Lessons**: Record lessons learned for future migrations
5. **Update Documentation**: Update all relevant documentation

### Emergency Procedures

```bash
# Emergency rollback script
#!/bin/bash
set -e

echo "🚨 EMERGENCY ROLLBACK INITIATED"

# Stop services immediately
pkill -f "mcp-vibe-coding" || true

# Quick downgrade
npm install -g @mcp/vibe-coding-kg@${PREVIOUS_VERSION}

# Restore from latest backup
LATEST_BACKUP=$(ls -t ./backups/*.tar.gz | head -1)
npx @mcp/vibe-coding-kg restore "${LATEST_BACKUP}"

# Restore configuration
cp ./backups/config-emergency.json .mcp-vibe-config.json

# Quick health check
npx @mcp/vibe-coding-kg health

echo "✅ Emergency rollback completed"
echo "📊 Run comprehensive validation: npx @mcp/vibe-coding-kg validate-rollback"
```

By following this migration guide, you can safely upgrade your MCP Vibe Coding Knowledge Graph system while minimizing downtime and risk. Remember that careful planning and testing are key to successful migrations.