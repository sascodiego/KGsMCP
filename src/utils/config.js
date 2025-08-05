import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import Joi from 'joi';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configuration validation schema
const configSchema = Joi.object({
  kuzu: Joi.object({
    databasePath: Joi.string().required(),
    maxRetries: Joi.number().integer().min(1).max(10).default(3),
    retryDelay: Joi.number().integer().min(100).max(10000).default(1000),
    healthCheckInterval: Joi.number().integer().min(5000).max(300000).default(30000),
    backupInterval: Joi.number().integer().min(3600000).default(86400000),
    queryTimeout: Joi.number().integer().min(1000).max(300000).default(30000)
  }).required(),
  
  logging: Joi.object({
    enabled: Joi.boolean().default(true),
    level: Joi.string().valid('error', 'warn', 'info', 'debug').default('info'),
    maxFiles: Joi.number().integer().min(1).max(20).default(10),
    maxSize: Joi.number().integer().min(1048576).default(52428800) // 50MB
  }).default(),
  
  analysis: Joi.object({
    maxFileSize: Joi.number().integer().min(1024).max(10485760).default(1048576), // 1MB
    excludedDirs: Joi.array().items(Joi.string()).default(['.git', 'node_modules', '__pycache__', '.venv', 'target', 'build', 'dist']),
    includedExtensions: Joi.array().items(Joi.string()).default(['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.h', '.hpp', '.c']),
    maxDepth: Joi.number().integer().min(1).max(20).default(10),
    parallelWorkers: Joi.number().integer().min(1).max(16).default(4)
  }).default(),
  
  security: Joi.object({
    enableRateLimit: Joi.boolean().default(true),
    maxRequestsPerMinute: Joi.number().integer().min(10).max(1000).default(100),
    enableCors: Joi.boolean().default(true),
    corsOrigins: Joi.array().items(Joi.string()).default(['*']),
    enableHelmet: Joi.boolean().default(true)
  }).default(),
  
  performance: Joi.object({
    enableCaching: Joi.boolean().default(true),
    cacheTimeout: Joi.number().integer().min(60000).max(3600000).default(300000), // 5 minutes
    maxCacheSize: Joi.number().integer().min(10).max(1000).default(100),
    enableCompression: Joi.boolean().default(true)
  }).default(),
  
  mcp: Joi.object({
    serverName: Joi.string().default('mcp-vibe-coding-kg'),
    serverVersion: Joi.string().default('1.0.0'),
    timeout: Joi.number().integer().min(1000).max(300000).default(30000),
    enableMetrics: Joi.boolean().default(true)
  }).default()
});

class Config {
  constructor() {
    // Load environment variables
    dotenv.config();
    
    this.defaultConfig = {
      kuzu: {
        databasePath: process.env.KUZU_DB_PATH || '.kg-context/knowledge-graph.kuzu',
        maxRetries: parseInt(process.env.KUZU_MAX_RETRIES || '3'),
        retryDelay: parseInt(process.env.KUZU_RETRY_DELAY || '1000'),
        healthCheckInterval: parseInt(process.env.KUZU_HEALTH_CHECK_INTERVAL || '30000'),
        backupInterval: parseInt(process.env.KUZU_BACKUP_INTERVAL || '86400000'),
        queryTimeout: parseInt(process.env.KUZU_QUERY_TIMEOUT || '30000')
      },
      logging: {
        enabled: process.env.LOG_ENABLED !== 'false',
        level: process.env.LOG_LEVEL || 'info',
        maxFiles: parseInt(process.env.LOG_MAX_FILES || '10'),
        maxSize: parseInt(process.env.LOG_MAX_SIZE || '52428800')
      },
      analysis: {
        maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '1048576'),
        excludedDirs: (process.env.EXCLUDED_DIRS || '.git,node_modules,__pycache__,.venv,target,build,dist').split(','),
        includedExtensions: (process.env.INCLUDED_EXTENSIONS || '.js,.ts,.jsx,.tsx,.py,.java,.cpp,.h,.hpp,.c').split(','),
        maxDepth: parseInt(process.env.ANALYSIS_MAX_DEPTH || '10'),
        parallelWorkers: parseInt(process.env.ANALYSIS_WORKERS || '4')
      },
      security: {
        enableRateLimit: process.env.ENABLE_RATE_LIMIT !== 'false',
        maxRequestsPerMinute: parseInt(process.env.MAX_REQUESTS_PER_MINUTE || '100'),
        enableCors: process.env.ENABLE_CORS !== 'false',
        corsOrigins: (process.env.CORS_ORIGINS || '*').split(','),
        enableHelmet: process.env.ENABLE_HELMET !== 'false'
      },
      performance: {
        enableCaching: process.env.ENABLE_CACHING !== 'false',
        cacheTimeout: parseInt(process.env.CACHE_TIMEOUT || '300000'),
        maxCacheSize: parseInt(process.env.MAX_CACHE_SIZE || '100'),
        enableCompression: process.env.ENABLE_COMPRESSION !== 'false'
      },
      mcp: {
        serverName: process.env.MCP_SERVER_NAME || 'mcp-vibe-coding-kg',
        serverVersion: process.env.MCP_SERVER_VERSION || '1.0.0',
        timeout: parseInt(process.env.MCP_TIMEOUT || '30000'),
        enableMetrics: process.env.MCP_ENABLE_METRICS !== 'false'
      }
    };
    
    this.cachedConfig = null;
    this.configPath = null;
  }

  load(configPath) {
    // DEPRECATED: Use loadAsync() for better performance in production
    // This method uses synchronous file operations which can block the event loop
    
    // Return cached config if available and path hasn't changed
    if (this.cachedConfig && this.configPath === configPath) {
      return this.cachedConfig;
    }
    
    if (configPath) {
      this.configPath = configPath;
      this.cachedConfig = this.loadFromFileSync(configPath);
      return this.cachedConfig;
    }

    // Try to load from various locations
    const possiblePaths = [
      '.mcp-vibe-config.json',
      path.join(process.cwd(), '.mcp-vibe-config.json'),
      path.join(__dirname, '../../config/default.json')
    ];

    for (const configFile of possiblePaths) {
      try {
        this.configPath = configFile;
        this.cachedConfig = this.loadFromFileSync(configFile);
        return this.cachedConfig;
      } catch (error) {
        // Continue to next path
      }
    }

    // Validate and return default config
    this.cachedConfig = this.validateConfig(this.defaultConfig);
    return this.cachedConfig;
  }

  async loadAsync(configPath) {
    // Return cached config if available and path hasn't changed
    if (this.cachedConfig && this.configPath === configPath) {
      return this.cachedConfig;
    }
    
    if (configPath) {
      this.configPath = configPath;
      this.cachedConfig = await this.loadFromFileAsync(configPath);
      return this.cachedConfig;
    }

    // Try to load from various locations
    const possiblePaths = [
      '.mcp-vibe-config.json',
      path.join(process.cwd(), '.mcp-vibe-config.json'),
      path.join(__dirname, '../../config/default.json')
    ];

    for (const configFile of possiblePaths) {
      try {
        this.configPath = configFile;
        this.cachedConfig = await this.loadFromFileAsync(configFile);
        return this.cachedConfig;
      } catch (error) {
        // Continue to next path
      }
    }

    // Validate and return default config
    this.cachedConfig = this.validateConfig(this.defaultConfig);
    return this.cachedConfig;
  }

  loadFromFileSync(configPath) {
    try {
      const data = fs.readFileSync(configPath, 'utf-8');
      const fileConfig = JSON.parse(data);
      const merged = this.mergeConfigs(this.defaultConfig, fileConfig);
      return this.validateConfig(merged);
    } catch (error) {
      throw new Error(`Failed to load config from ${configPath}: ${error.message}`);
    }
  }

  async loadFromFileAsync(configPath) {
    try {
      const data = await fs.readFile(configPath, 'utf-8');
      const fileConfig = JSON.parse(data);
      const merged = this.mergeConfigs(this.defaultConfig, fileConfig);
      return this.validateConfig(merged);
    } catch (error) {
      throw new Error(`Failed to load config from ${configPath}: ${error.message}`);
    }
  }

  mergeConfigs(defaultConfig, fileConfig) {
    const merged = { ...defaultConfig };
    
    for (const [key, value] of Object.entries(fileConfig)) {
      if (typeof value === 'object' && !Array.isArray(value) && value !== null) {
        merged[key] = { ...merged[key], ...value };
      } else {
        merged[key] = value;
      }
    }
    
    return merged;
  }

  validateConfig(config) {
    try {
      const { error, value } = configSchema.validate(config, {
        allowUnknown: false,
        abortEarly: false
      });

      if (error) {
        const details = error.details.map(d => d.message).join(', ');
        throw new Error(`Configuration validation failed: ${details}`);
      }

      return value;
    } catch (error) {
      throw new Error(`Config validation error: ${error.message}`);
    }
  }

  async saveConfig(config, configPath) {
    try {
      const validatedConfig = this.validateConfig(config);
      const configData = JSON.stringify(validatedConfig, null, 2);
      await fs.writeFile(configPath, configData, 'utf-8');
      
      // Update cache
      this.configPath = configPath;
      this.cachedConfig = validatedConfig;
      
      return validatedConfig;
    } catch (error) {
      throw new Error(`Failed to save config to ${configPath}: ${error.message}`);
    }
  }

  getSchema() {
    return configSchema;
  }

  clearCache() {
    this.cachedConfig = null;
    this.configPath = null;
  }

  // Environment-specific configurations
  isDevelopment() {
    return process.env.NODE_ENV === 'development';
  }

  isProduction() {
    return process.env.NODE_ENV === 'production';
  }

  isTest() {
    return process.env.NODE_ENV === 'test';
  }
}

// Export instance with both sync and async methods
export const config = new Config();

// Helper function to initialize config asynchronously for better performance
export async function initializeConfigAsync(configPath) {
  return await config.loadAsync(configPath);
}

// Backward compatibility export
export default config;