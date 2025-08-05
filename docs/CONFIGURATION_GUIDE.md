# Configuration Guide

## Overview

The MCP Vibe Coding Knowledge Graph server supports comprehensive configuration through JSON files, environment variables, and runtime options. This guide covers all available configuration options and best practices.

## Configuration Sources

Configuration is loaded in the following order (later sources override earlier ones):

1. **Default configuration** (`config/default.json`)
2. **Environment-specific config** (`config/production.json`, `config/development.json`)
3. **Custom config file** (specified via `--config` option)
4. **Environment variables**
5. **Command-line arguments**

## Default Configuration

### Location
- Default config: `config/default.json`
- Custom config: Specify with `--config` option
- User config: `.mcp-vibe-config.json` (created by setup wizard)

### Configuration Structure

```json
{
  "kuzu": { },
  "logging": { },
  "analysis": { },
  "patterns": { },
  "validation": { },
  "optimization": { },
  "mcp": { }
}
```

---

## Database Configuration (`kuzu`)

### Basic Settings

```json
{
  "kuzu": {
    "databasePath": ".kg-context/knowledge-graph.kuzu",
    "maxConnections": 10,
    "queryTimeout": 30000,
    "enableWAL": true,
    "bufferPoolSize": "256MB",
    "maxRetries": 3,
    "retryDelay": 1000,
    "healthCheckInterval": 30000
  }
}
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `databasePath` | string | `.kg-context/knowledge-graph.kuzu` | Path to Kuzu database directory |
| `maxConnections` | integer | 10 | Maximum concurrent database connections |
| `queryTimeout` | integer | 30000 | Query timeout in milliseconds |
| `enableWAL` | boolean | true | Enable Write-Ahead Logging for durability |
| `bufferPoolSize` | string | "256MB" | Memory buffer pool size |
| `maxRetries` | integer | 3 | Maximum retry attempts for failed operations |
| `retryDelay` | integer | 1000 | Delay between retries in milliseconds |
| `healthCheckInterval` | integer | 30000 | Health check interval in milliseconds |

### Advanced Database Settings

```json
{
  "kuzu": {
    "performance": {
      "enableQueryCache": true,
      "queryCacheSize": 1000,
      "queryCacheTTL": 300000,
      "enableIndexes": true,
      "autoVacuum": true,
      "vacuumInterval": 86400000
    },
    "backup": {
      "enableAutoBackup": false,
      "backupInterval": 86400000,
      "backupRetention": 7,
      "backupDirectory": ".kg-context/backups"
    },
    "security": {
      "enableEncryption": false,
      "encryptionKey": null,
      "enableAuditLog": false,
      "auditLogPath": ".kg-context/audit.log"
    }
  }
}
```

### Environment Variables

```bash
KUZU_DB_PATH=".kg-context/knowledge-graph.kuzu"
KUZU_MAX_CONNECTIONS=10
KUZU_QUERY_TIMEOUT=30000
KUZU_BUFFER_POOL_SIZE="256MB"
KUZU_ENABLE_WAL=true
```

---

## Logging Configuration (`logging`)

### Basic Logging

```json
{
  "logging": {
    "enabled": true,
    "level": "info",
    "format": "combined",
    "timestamp": true,
    "colorize": true,
    "maxFileSize": "10MB",
    "maxFiles": 5,
    "logDirectory": "logs"
  }
}
```

#### Log Levels
- `error`: Error messages only
- `warn`: Warnings and errors
- `info`: Informational messages (default)
- `debug`: Detailed debugging information
- `trace`: Most verbose logging

### Advanced Logging

```json
{
  "logging": {
    "transports": {
      "console": {
        "enabled": true,
        "level": "info",
        "colorize": true,
        "timestamp": true
      },
      "file": {
        "enabled": true,
        "level": "debug",
        "filename": "logs/combined.log",
        "maxsize": 10485760,
        "maxFiles": 5,
        "tailable": true
      },
      "error": {
        "enabled": true,
        "level": "error",
        "filename": "logs/error.log",
        "maxsize": 10485760,
        "maxFiles": 5
      }
    },
    "exceptions": {
      "enabled": true,
      "filename": "logs/exceptions.log"
    },
    "rejections": {
      "enabled": true,
      "filename": "logs/rejections.log"
    }
  }
}
```

### Environment Variables

```bash
LOG_LEVEL=info
LOG_ENABLED=true
LOG_FORMAT=json
LOG_DIRECTORY=logs
LOG_MAX_SIZE=10MB
LOG_MAX_FILES=5
```

---

## Analysis Configuration (`analysis`)

### File Analysis Settings

```json
{
  "analysis": {
    "maxFileSize": 1048576,
    "maxConcurrentFiles": 10,
    "timeoutPerFile": 30000,
    "excludedDirs": [
      ".git",
      "node_modules",
      "__pycache__",
      ".venv",
      "dist",
      "build",
      ".next",
      ".nuxt",
      "target",
      "bin",
      "obj"
    ],
    "includedExtensions": [
      ".js", ".ts", ".jsx", ".tsx",
      ".py", ".java", ".go", ".rs",
      ".php", ".rb", ".cs",
      ".cpp", ".c", ".h", ".ino"
    ]
  }
}
```

#### Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxFileSize` | integer | 1048576 | Maximum file size to analyze (bytes) |
| `maxConcurrentFiles` | integer | 10 | Maximum files to analyze concurrently |
| `timeoutPerFile` | integer | 30000 | Timeout per file analysis (ms) |
| `excludedDirs` | array | See above | Directories to skip during analysis |
| `includedExtensions` | array | See above | File extensions to analyze |

### Language-Specific Analysis

```json
{
  "analysis": {
    "languages": {
      "javascript": {
        "parser": "babel",
        "plugins": ["jsx", "typescript", "decorators-legacy"],
        "enableComplexityAnalysis": true,
        "enableDependencyAnalysis": true
      },
      "cpp": {
        "parser": "tree-sitter",
        "enableHardwareAnalysis": true,
        "boardProfiles": ["uno", "mega2560", "nano", "esp32"],
        "enableTimingAnalysis": true,
        "enableMemoryAnalysis": true
      },
      "python": {
        "parser": "ast",
        "enableImportAnalysis": true,
        "enableComplexityAnalysis": true
      }
    }
  }
}
```

### Git Analysis Settings

```json
{
  "analysis": {
    "git": {
      "enabled": true,
      "maxCommits": 1000,
      "includeAuthors": true,
      "includeBranches": ["main", "master", "develop"],
      "excludePaths": ["package-lock.json", "yarn.lock"],
      "analyzeCommitMessages": true,
      "detectHotspots": true
    }
  }
}
```

---

## Pattern Detection Configuration (`patterns`)

### Basic Pattern Settings

```json
{
  "patterns": {
    "confidence_threshold": 0.6,
    "max_patterns_per_file": 10,
    "enable_fuzzy_matching": true,
    "enable_context_analysis": true
  }
}
```

### Pattern Categories

```json
{
  "patterns": {
    "categories": {
      "creational": {
        "enabled": true,
        "patterns": ["Singleton", "Factory", "Builder", "Prototype"],
        "confidence_threshold": 0.7
      },
      "structural": {
        "enabled": true,
        "patterns": ["Adapter", "Decorator", "Facade", "Proxy"],
        "confidence_threshold": 0.6
      },
      "behavioral": {
        "enabled": true,
        "patterns": ["Observer", "Strategy", "Command", "State"],
        "confidence_threshold": 0.65
      },
      "architectural": {
        "enabled": true,
        "patterns": ["MVC", "Repository", "Service Layer"],
        "confidence_threshold": 0.8
      }
    }
  }
}
```

### Arduino-Specific Patterns

```json
{
  "patterns": {
    "arduino": {
      "enabled": true,
      "patterns": {
        "state_machine": {
          "confidence_threshold": 0.7,
          "keywords": ["switch", "case", "state", "mode"]
        },
        "interrupt_handler": {
          "confidence_threshold": 0.9,
          "keywords": ["ISR", "interrupt", "volatile"]
        },
        "non_blocking": {
          "confidence_threshold": 0.6,
          "keywords": ["millis", "delay", "timer"]
        }
      }
    }
  }
}
```

---

## Validation Configuration (`validation`)

### Basic Validation Settings

```json
{
  "validation": {
    "enabled": true,
    "strictMode": false,
    "enableLogging": true,
    "enableSanitization": true,
    "enableASTValidation": true,
    "enableSecurityAnalysis": true,
    "enablePerformanceValidation": true
  }
}
```

### Input Validation

```json
{
  "validation": {
    "input": {
      "maxStringLength": 100000,
      "maxArrayLength": 10000,
      "maxObjectDepth": 10,
      "maxObjectKeys": 1000,
      "allowedFileExtensions": [".js", ".ts", ".cpp", ".h", ".ino"],
      "forbiddenPatterns": ["eval\\(", "exec\\(", "system\\("],
      "enablePathTraversalProtection": true
    }
  }
}
```

### Rate Limiting

```json
{
  "validation": {
    "rateLimiting": {
      "enabled": false,
      "maxRequestsPerMinute": 100,
      "maxRequestsPerHour": 1000,
      "maxRequestsPerDay": 10000,
      "blockDuration": 300000,
      "whitelistedIPs": ["127.0.0.1"],
      "enableIpTracking": false
    }
  }
}
```

### Performance Validation

```json
{
  "validation": {
    "performance": {
      "enableCaching": true,
      "cacheSize": 1000,
      "cacheTTL": 300000,
      "enableBatching": true,
      "batchSize": 10,
      "batchTimeout": 100,
      "slowValidationThreshold": 1000,
      "enableAsyncValidation": true
    }
  }
}
```

### Security Validation

```json
{
  "validation": {
    "security": {
      "enableXSSProtection": true,
      "enableSQLInjectionProtection": true,
      "enableCodeInjectionProtection": true,
      "enablePathTraversalProtection": true,
      "maxUploadSize": 10485760,
      "allowedMimeTypes": ["text/plain", "application/javascript"],
      "scanForMalware": false,
      "enableContentFilter": true
    }
  }
}
```

### Monitoring & Alerting

```json
{
  "validation": {
    "monitoring": {
      "enableRealTimeMonitoring": true,
      "enableAlerting": true,
      "enableMetricsCollection": true,
      "metricsRetentionPeriod": 86400000,
      "alertThresholds": {
        "errorRate": 10,
        "avgResponseTime": 2000,
        "securityThreatCount": 5,
        "memoryUsage": 80,
        "cpuUsage": 70
      },
      "alertChannels": {
        "email": {
          "enabled": false,
          "recipients": ["admin@example.com"]
        },
        "webhook": {
          "enabled": false,
          "url": "https://hooks.slack.com/..."
        }
      }
    }
  }
}
```

---

## Optimization Configuration (`optimization`)

### Cache Configuration

```json
{
  "optimization": {
    "cache": {
      "enabled": true,
      "layers": {
        "l1": {
          "type": "memory",
          "maxSize": 100,
          "ttl": 300000
        },
        "l2": {
          "type": "disk",
          "maxSize": 1000,
          "ttl": 3600000,
          "directory": ".kg-context/cache"
        }
      },
      "strategies": {
        "eviction": "lru",
        "compression": true,
        "serialization": "json"
      }
    }
  }
}
```

### Query Optimization

```json
{
  "optimization": {
    "query": {
      "enabled": true,
      "cacheSize": 1000,
      "cacheTTL": 300000,
      "enableQueryRewriting": true,
      "enableIndexHints": true,
      "enableStatistics": true,
      "slowQueryThreshold": 1000,
      "enableQueryPlan": true
    }
  }
}
```

### Memory Management

```json
{
  "optimization": {
    "memory": {
      "enabled": true,
      "gcInterval": 300000,
      "heapLimit": "1GB",
      "enableMemoryProfiling": false,
      "memoryAlertThreshold": 80,
      "enableCompaction": true,
      "compactionInterval": 3600000
    }
  }
}
```

### Performance Monitoring

```json
{
  "optimization": {
    "monitoring": {
      "enabled": true,
      "metricsInterval": 30000,
      "enableCPUProfiling": false,
      "enableMemoryProfiling": false,
      "enableIOProfiling": false,
      "profileDuration": 60000,
      "profileDirectory": ".kg-context/profiles"
    }
  }
}
```

---

## MCP Server Configuration (`mcp`)

### Basic Server Settings

```json
{
  "mcp": {
    "serverName": "mcp-vibe-coding-kg",
    "serverVersion": "1.0.0",
    "maxConcurrentRequests": 10,
    "requestTimeout": 30000,
    "enableCompression": true,
    "enableKeepAlive": true
  }
}
```

### Tool Configuration

```json
{
  "mcp": {
    "tools": {
      "enabled": ["*"],
      "disabled": [],
      "timeouts": {
        "analyze_codebase": 300000,
        "generate_code_with_context": 60000,
        "default": 30000
      },
      "rateLimits": {
        "analyze_codebase": {
          "requests": 5,
          "period": 3600000
        },
        "default": {
          "requests": 100,
          "period": 60000
        }
      }
    }
  }
}
```

### Capabilities Configuration

```json
{
  "mcp": {
    "capabilities": {
      "tools": {
        "enabled": true,
        "maxTools": 50
      },
      "resources": {
        "enabled": false,
        "maxResources": 100
      },
      "prompts": {
        "enabled": false,
        "maxPrompts": 50
      }
    }
  }
}
```

---

## Environment-Specific Configuration

### Development Configuration

Create `config/development.json`:

```json
{
  "logging": {
    "level": "debug",
    "transports": {
      "console": {
        "colorize": true
      }
    }
  },
  "validation": {
    "strictMode": false,
    "enableSecurityAnalysis": false
  },
  "optimization": {
    "cache": {
      "enabled": false
    }
  }
}
```

### Production Configuration

Create `config/production.json`:

```json
{
  "logging": {
    "level": "info",
    "transports": {
      "console": {
        "colorize": false
      },
      "file": {
        "enabled": true
      }
    }
  },
  "validation": {
    "strictMode": true,
    "enableSecurityAnalysis": true,
    "rateLimiting": {
      "enabled": true
    }
  },
  "optimization": {
    "cache": {
      "enabled": true
    },
    "memory": {
      "enabled": true
    }
  },
  "kuzu": {
    "enableWAL": true,
    "backup": {
      "enableAutoBackup": true
    }
  }
}
```

### Testing Configuration

Create `config/test.json`:

```json
{
  "kuzu": {
    "databasePath": ".kg-context/test-db",
    "maxConnections": 2
  },
  "logging": {
    "level": "error",
    "transports": {
      "console": {
        "enabled": false
      }
    }
  },
  "validation": {
    "rateLimiting": {
      "enabled": false
    }
  }
}
```

---

## Environment Variables

### Complete Environment Variable List

```bash
# Node.js Environment
NODE_ENV=production

# Database Configuration
KUZU_DB_PATH=".kg-context/knowledge-graph.kuzu"
KUZU_MAX_CONNECTIONS=10
KUZU_QUERY_TIMEOUT=30000
KUZU_BUFFER_POOL_SIZE="256MB"
KUZU_ENABLE_WAL=true

# Logging Configuration
LOG_LEVEL=info
LOG_ENABLED=true
LOG_FORMAT=combined
LOG_DIRECTORY=logs
LOG_MAX_SIZE=10MB
LOG_MAX_FILES=5

# Validation Configuration
VALIDATION_ENABLED=true
VALIDATION_STRICT_MODE=false
VALIDATION_MAX_STRING_LENGTH=100000
VALIDATION_RATE_LIMITING_ENABLED=false

# Optimization Configuration
OPTIMIZATION_CACHE_ENABLED=true
OPTIMIZATION_MEMORY_ENABLED=true
OPTIMIZATION_QUERY_CACHE_SIZE=1000

# MCP Configuration
MCP_SERVER_NAME="mcp-vibe-coding-kg"
MCP_MAX_CONCURRENT_REQUESTS=10
MCP_REQUEST_TIMEOUT=30000

# Security Configuration
ENABLE_SECURITY_ANALYSIS=true
ENABLE_XSS_PROTECTION=true
ENABLE_SQL_INJECTION_PROTECTION=true

# Performance Configuration
ENABLE_PERFORMANCE_MONITORING=true
SLOW_QUERY_THRESHOLD=1000
MEMORY_ALERT_THRESHOLD=80
```

### Loading Environment Variables

Create a `.env` file in the project root:

```env
# Database
KUZU_DB_PATH=.kg-context/knowledge-graph.kuzu

# Logging
LOG_LEVEL=debug
LOG_ENABLED=true

# Development Settings
NODE_ENV=development
VALIDATION_STRICT_MODE=false
```

---

## Configuration Validation

The system validates configuration on startup and provides detailed error messages for invalid settings.

### Common Validation Errors

1. **Invalid database path**: Path not writable or doesn't exist
2. **Invalid log level**: Must be one of: error, warn, info, debug, trace
3. **Invalid buffer pool size**: Must be a valid memory size (e.g., "256MB")
4. **Invalid timeout values**: Must be positive integers
5. **Missing required fields**: Some fields are required for certain features

### Configuration Schema

The system uses JSON Schema validation for configuration files. You can validate your configuration using:

```bash
npm run validate-config /path/to/config.json
```

---

## Best Practices

### 1. Environment Separation
- Use separate configurations for development, staging, and production
- Never commit sensitive configuration to version control
- Use environment variables for secrets and environment-specific values

### 2. Performance Tuning
- Adjust `bufferPoolSize` based on available memory
- Enable caching in production environments
- Set appropriate timeouts for your use case
- Monitor memory usage and adjust limits accordingly

### 3. Security Configuration
- Enable security analysis in production
- Use rate limiting to prevent abuse
- Enable audit logging for compliance
- Regularly review and update security settings

### 4. Monitoring Configuration
- Enable comprehensive logging in production
- Set up alerting for critical issues
- Monitor performance metrics
- Enable health checks and auto-recovery

### 5. Backup Configuration
- Enable automatic backups in production
- Test backup and restore procedures
- Set appropriate retention policies
- Store backups in secure, separate locations

---

## Troubleshooting Configuration Issues

### Configuration Not Loading
1. Check file permissions and existence
2. Verify JSON syntax validity
3. Check environment variable names and values
4. Review startup logs for configuration errors

### Performance Issues
1. Increase buffer pool size for large datasets
2. Enable query caching for repeated queries
3. Adjust timeout values for complex operations
4. Enable optimization features

### Memory Issues
1. Reduce buffer pool size if running out of memory
2. Enable memory management features
3. Adjust cache sizes
4. Monitor memory usage patterns

### Database Connection Issues
1. Verify database path permissions
2. Check if database directory exists and is writable
3. Adjust connection pool settings
4. Review health check settings

For additional help, enable debug logging and review the detailed log output.