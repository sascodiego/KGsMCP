import fs from 'fs/promises';
import path from 'path';
import tar from 'tar';
import { logger } from './logger.js';
// Factory function to get appropriate KuzuClient
async function getKuzuClient() {
  try {
    const kuzuModule = await import('../database/kuzuClient.js');
    return kuzuModule.KuzuClient;
  } catch (error) {
    logger.warn('Real Kuzu not available, using mock client');
    const mockModule = await import('../database/mockKuzuClient.js');
    return mockModule.MockKuzuClient;
  }
}
import { EventEmitter } from 'events';

/**
 * CONTEXT: Backup and restore functionality for the MCP Knowledge Graph
 * REASON: Provides reliable data backup and recovery mechanisms
 * CHANGE: New backup manager with compression, validation, and incremental backups
 * PREVENTION: Data loss, corruption, manual intervention required for recovery
 */
export class BackupManager extends EventEmitter {
  constructor(config) {
    super();
    this.config = {
      backupDirectory: '.kg-context/backups',
      compressionLevel: 6,
      maxBackups: 10,
      includeMetadata: true,
      validateBackups: true,
      ...config
    };
    
    this.kuzu = null;
    this.backupInProgress = false;
    this.restoreInProgress = false;
  }

  /**
   * Initialize backup manager with database connection
   */
  async initialize(databaseConfig) {
    try {
      const KuzuClient = await getKuzuClient();
      this.kuzu = new KuzuClient(databaseConfig);
      await this.kuzu.connect();
      
      // Ensure backup directory exists
      await fs.mkdir(this.config.backupDirectory, { recursive: true });
      
      logger.info('Backup manager initialized', {
        backupDirectory: this.config.backupDirectory,
        maxBackups: this.config.maxBackups
      });
      
    } catch (error) {
      logger.error('Failed to initialize backup manager', { error: error.message });
      throw error;
    }
  }

  /**
   * Create a full backup of the knowledge graph
   */
  async createBackup(backupPath, options = {}) {
    if (this.backupInProgress) {
      throw new Error('Backup already in progress');
    }

    this.backupInProgress = true;
    const startTime = Date.now();
    
    try {
      logger.info('Starting backup creation', { backupPath });
      this.emit('backupStarted', { backupPath });

      // Generate backup metadata
      const metadata = await this.generateBackupMetadata(options);
      
      // Create temporary directory for backup files
      const tempDir = path.join(this.config.backupDirectory, '.temp', `backup_${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });

      try {
        // Export database tables
        const exportedFiles = await this.exportDatabaseTables(tempDir);
        
        // Add metadata
        const metadataPath = path.join(tempDir, 'metadata.json');
        await fs.writeFile(metadataPath, JSON.stringify(metadata, null, 2));
        exportedFiles.push('metadata.json');

        // Create compressed archive
        const actualBackupPath = await this.createCompressedArchive(tempDir, backupPath, exportedFiles);
        
        // Validate backup if enabled
        if (this.config.validateBackups) {
          await this.validateBackup(actualBackupPath);
        }

        // Cleanup old backups
        await this.cleanupOldBackups();

        const duration = Date.now() - startTime;
        logger.info('Backup completed successfully', {
          backupPath: actualBackupPath,
          duration: `${duration}ms`,
          size: await this.getFileSize(actualBackupPath)
        });

        this.emit('backupCompleted', { 
          backupPath: actualBackupPath, 
          duration, 
          metadata 
        });

        return {
          success: true,
          backupPath: actualBackupPath,
          metadata,
          duration
        };

      } finally {
        // Clean up temporary directory
        await fs.rm(tempDir, { recursive: true, force: true });
      }

    } catch (error) {
      logger.error('Backup creation failed', { error: error.message, backupPath });
      this.emit('backupFailed', { backupPath, error });
      throw error;
    } finally {
      this.backupInProgress = false;
    }
  }

  /**
   * Restore from backup archive
   */
  async restoreFromBackup(backupPath, options = {}) {
    if (this.restoreInProgress) {
      throw new Error('Restore already in progress');
    }

    if (!await this.fileExists(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`);
    }

    this.restoreInProgress = true;
    const startTime = Date.now();

    try {
      logger.info('Starting restore from backup', { backupPath });
      this.emit('restoreStarted', { backupPath });

      // Validate backup before restore
      if (this.config.validateBackups) {
        await this.validateBackup(backupPath);
      }

      // Create temporary directory for extraction
      const tempDir = path.join(this.config.backupDirectory, '.temp', `restore_${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });

      try {
        // Extract backup archive
        await this.extractBackupArchive(backupPath, tempDir);

        // Load and validate metadata
        const metadata = await this.loadBackupMetadata(tempDir);
        logger.info('Backup metadata loaded', { 
          version: metadata.version,
          timestamp: new Date(metadata.timestamp).toISOString(),
          tables: Object.keys(metadata.tables || {}).length
        });

        // Check compatibility
        if (!await this.isBackupCompatible(metadata)) {
          if (!options.force) {
            throw new Error('Backup version incompatible. Use --force to override.');
          }
          logger.warn('Forcing restore of incompatible backup');
        }

        // Backup current database if not forcing overwrite
        if (!options.force && await this.databaseHasData()) {
          const preRestoreBackup = await this.createPreRestoreBackup();
          logger.info('Created pre-restore backup', { path: preRestoreBackup });
        }

        // Import database tables
        await this.importDatabaseTables(tempDir, metadata, options);

        const duration = Date.now() - startTime;
        logger.info('Restore completed successfully', {
          backupPath,
          duration: `${duration}ms`,
          tablesRestored: Object.keys(metadata.tables || {}).length
        });

        this.emit('restoreCompleted', { 
          backupPath, 
          duration, 
          metadata 
        });

        return {
          success: true,
          backupPath,
          metadata,
          duration
        };

      } finally {
        // Clean up temporary directory
        await fs.rm(tempDir, { recursive: true, force: true });
      }

    } catch (error) {
      logger.error('Restore failed', { error: error.message, backupPath });
      this.emit('restoreFailed', { backupPath, error });
      throw error;
    } finally {
      this.restoreInProgress = false;
    }
  }

  /**
   * Generate backup metadata
   */
  async generateBackupMetadata(options) {
    const metadata = {
      version: '1.0.0',
      timestamp: Date.now(),
      description: options.description || 'Automated backup',
      type: options.incremental ? 'incremental' : 'full',
      source: {
        databasePath: this.kuzu.config.databasePath,
        hostname: process.env.HOSTNAME || 'unknown',
        platform: process.platform,
        nodeVersion: process.version
      },
      tables: {},
      statistics: {}
    };

    try {
      // Get table statistics
      const healthMetrics = await this.kuzu.getHealthMetrics();
      if (healthMetrics.tableCounts) {
        metadata.tables = healthMetrics.tableCounts;
        metadata.statistics.totalRecords = Object.values(healthMetrics.tableCounts)
          .reduce((sum, count) => sum + count, 0);
      }

      // Get database metrics
      metadata.statistics.queryMetrics = healthMetrics.metrics;
      metadata.statistics.backupSize = 0; // Will be updated after compression

    } catch (error) {
      logger.warn('Failed to generate complete metadata', { error: error.message });
    }

    return metadata;
  }

  /**
   * Export all database tables to JSON files
   */
  async exportDatabaseTables(outputDir) {
    const exportedFiles = [];
    const tables = ['CodeEntity', 'Pattern', 'Rule', 'Standard', 'Decision'];
    
    for (const table of tables) {
      try {
        const query = `MATCH (n:${table}) RETURN n`;
        const results = await this.kuzu.query(query);
        
        const outputFile = `${table.toLowerCase()}.json`;
        const outputPath = path.join(outputDir, outputFile);
        
        await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
        exportedFiles.push(outputFile);
        
        logger.debug(`Exported ${table}`, { 
          records: results.length, 
          file: outputFile 
        });
        
      } catch (error) {
        logger.warn(`Failed to export table ${table}`, { error: error.message });
        // Continue with other tables
      }
    }

    // Export relationships
    const relationships = ['IMPLEMENTS', 'DEPENDS_ON', 'VIOLATES', 'FOLLOWS', 'SUPPORTS'];
    
    for (const rel of relationships) {
      try {
        const query = `MATCH ()-[r:${rel}]->() RETURN r, startNode(r) as source, endNode(r) as target`;
        const results = await this.kuzu.query(query);
        
        const outputFile = `${rel.toLowerCase()}_relationships.json`;
        const outputPath = path.join(outputDir, outputFile);
        
        await fs.writeFile(outputPath, JSON.stringify(results, null, 2));
        exportedFiles.push(outputFile);
        
        logger.debug(`Exported ${rel} relationships`, { 
          records: results.length, 
          file: outputFile 
        });
        
      } catch (error) {
        logger.warn(`Failed to export relationship ${rel}`, { error: error.message });
        // Continue with other relationships
      }
    }

    return exportedFiles;
  }

  /**
   * Create compressed archive from exported files
   */
  async createCompressedArchive(sourceDir, targetPath, files) {
    const actualTargetPath = targetPath.endsWith('.tar.gz') ? targetPath : `${targetPath}.tar.gz`;
    
    await tar.create({
      file: actualTargetPath,
      cwd: sourceDir,
      gzip: {
        level: this.config.compressionLevel
      }
    }, files);

    logger.debug('Compressed archive created', {
      path: actualTargetPath,
      files: files.length,
      size: await this.getFileSize(actualTargetPath)
    });

    return actualTargetPath;
  }

  /**
   * Extract backup archive
   */
  async extractBackupArchive(backupPath, targetDir) {
    await tar.extract({
      file: backupPath,
      cwd: targetDir
    });

    logger.debug('Backup archive extracted', {
      backupPath,
      targetDir
    });
  }

  /**
   * Load backup metadata
   */
  async loadBackupMetadata(backupDir) {
    const metadataPath = path.join(backupDir, 'metadata.json');
    
    if (!await this.fileExists(metadataPath)) {
      throw new Error('Backup metadata not found');
    }

    const metadataContent = await fs.readFile(metadataPath, 'utf-8');
    return JSON.parse(metadataContent);
  }

  /**
   * Check if backup is compatible with current system
   */
  async isBackupCompatible(metadata) {
    // Simple version compatibility check
    const [majorVersion] = metadata.version.split('.');
    const [currentMajor] = '1.0.0'.split('.');
    
    return majorVersion === currentMajor;
  }

  /**
   * Check if database has existing data
   */
  async databaseHasData() {
    try {
      const healthMetrics = await this.kuzu.getHealthMetrics();
      const totalRecords = Object.values(healthMetrics.tableCounts || {})
        .reduce((sum, count) => sum + count, 0);
      
      return totalRecords > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create pre-restore backup
   */
  async createPreRestoreBackup() {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = path.join(
      this.config.backupDirectory,
      `pre-restore-${timestamp}.tar.gz`
    );
    
    const result = await this.createBackup(backupPath, {
      description: 'Pre-restore backup'
    });
    
    return result.backupPath;
  }

  /**
   * Import database tables from backup
   */
  async importDatabaseTables(backupDir, metadata, options) {
    const tables = ['CodeEntity', 'Pattern', 'Rule', 'Standard', 'Decision'];
    
    // Clear existing data if not incremental
    if (!options.incremental) {
      await this.clearAllTables();
    }
    
    for (const table of tables) {
      const dataFile = path.join(backupDir, `${table.toLowerCase()}.json`);
      
      if (await this.fileExists(dataFile)) {
        await this.importTableData(table, dataFile);
      }
    }

    // Import relationships
    const relationships = ['IMPLEMENTS', 'DEPENDS_ON', 'VIOLATES', 'FOLLOWS', 'SUPPORTS'];
    
    for (const rel of relationships) {
      const dataFile = path.join(backupDir, `${rel.toLowerCase()}_relationships.json`);
      
      if (await this.fileExists(dataFile)) {
        await this.importRelationshipData(rel, dataFile);
      }
    }
  }

  /**
   * Clear all database tables
   */
  async clearAllTables() {
    const tables = ['CodeEntity', 'Pattern', 'Rule', 'Standard', 'Decision'];
    
    for (const table of tables) {
      try {
        await this.kuzu.query(`MATCH (n:${table}) DELETE n`);
        logger.debug(`Cleared table ${table}`);
      } catch (error) {
        logger.warn(`Failed to clear table ${table}`, { error: error.message });
      }
    }
  }

  /**
   * Import table data from JSON file
   */
  async importTableData(tableName, dataFile) {
    try {
      const data = JSON.parse(await fs.readFile(dataFile, 'utf-8'));
      
      for (const record of data) {
        // Extract node properties (remove internal Kuzu metadata)
        const nodeProps = record.n || record;
        if (nodeProps && typeof nodeProps === 'object') {
          await this.kuzu.createNode(tableName, nodeProps);
        }
      }
      
      logger.debug(`Imported ${tableName}`, { records: data.length });
      
    } catch (error) {
      logger.error(`Failed to import ${tableName}`, { error: error.message });
      throw error;
    }
  }

  /**
   * Import relationship data from JSON file
   */
  async importRelationshipData(relationshipType, dataFile) {
    try {
      const data = JSON.parse(await fs.readFile(dataFile, 'utf-8'));
      
      for (const record of data) {
        const rel = record.r;
        const source = record.source;
        const target = record.target;
        
        if (source?.id && target?.id && rel) {
          await this.kuzu.createRelationship(source.id, relationshipType, target.id, rel);
        }
      }
      
      logger.debug(`Imported ${relationshipType} relationships`, { records: data.length });
      
    } catch (error) {
      logger.error(`Failed to import ${relationshipType} relationships`, { error: error.message });
      throw error;
    }
  }

  /**
   * Validate backup integrity
   */
  async validateBackup(backupPath) {
    try {
      // Check if file exists and is readable
      const stats = await fs.stat(backupPath);
      if (stats.size === 0) {
        throw new Error('Backup file is empty');
      }

      // Create temporary directory for validation
      const tempDir = path.join(this.config.backupDirectory, '.temp', `validate_${Date.now()}`);
      await fs.mkdir(tempDir, { recursive: true });

      try {
        // Extract and validate metadata
        await this.extractBackupArchive(backupPath, tempDir);
        const metadata = await this.loadBackupMetadata(tempDir);
        
        // Basic validation checks
        if (!metadata.version || !metadata.timestamp) {
          throw new Error('Invalid backup metadata');
        }

        // Check if required files exist
        const requiredFiles = ['metadata.json', 'codeentity.json'];
        for (const file of requiredFiles) {
          const filePath = path.join(tempDir, file);
          if (!await this.fileExists(filePath)) {
            throw new Error(`Required backup file missing: ${file}`);
          }
        }

        logger.debug('Backup validation successful', { backupPath });
        return true;

      } finally {
        await fs.rm(tempDir, { recursive: true, force: true });
      }

    } catch (error) {
      logger.error('Backup validation failed', { backupPath, error: error.message });
      throw new Error(`Backup validation failed: ${error.message}`);
    }
  }

  /**
   * Clean up old backups based on retention policy
   */
  async cleanupOldBackups() {
    try {
      const backupFiles = await this.getBackupFiles();
      
      if (backupFiles.length <= this.config.maxBackups) {
        return; // No cleanup needed
      }

      // Sort by modification time (oldest first)
      backupFiles.sort((a, b) => a.mtime - b.mtime);
      
      const filesToDelete = backupFiles.slice(0, backupFiles.length - this.config.maxBackups);
      
      for (const file of filesToDelete) {
        try {
          await fs.unlink(file.path);
          logger.debug('Deleted old backup', { path: file.path });
        } catch (error) {
          logger.warn('Failed to delete old backup', { path: file.path, error: error.message });
        }
      }
      
      logger.info('Cleanup completed', { 
        deleted: filesToDelete.length,
        remaining: this.config.maxBackups
      });
      
    } catch (error) {
      logger.error('Backup cleanup failed', { error: error.message });
    }
  }

  /**
   * Get list of backup files
   */
  async getBackupFiles() {
    try {
      const files = await fs.readdir(this.config.backupDirectory);
      const backupFiles = [];
      
      for (const file of files) {
        if (file.endsWith('.tar.gz') && !file.startsWith('.')) {
          const filePath = path.join(this.config.backupDirectory, file);
          const stats = await fs.stat(filePath);
          
          backupFiles.push({
            name: file,
            path: filePath,
            size: stats.size,
            mtime: stats.mtime.getTime()
          });
        }
      }
      
      return backupFiles;
    } catch (error) {
      logger.error('Failed to list backup files', { error: error.message });
      return [];
    }
  }

  /**
   * Get file size in human readable format
   */
  async getFileSize(filePath) {
    try {
      const stats = await fs.stat(filePath);
      const bytes = stats.size;
      
      if (bytes === 0) return '0 B';
      
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      
      return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    } catch (error) {
      return 'Unknown';
    }
  }

  /**
   * Check if file exists
   */
  async fileExists(filePath) {
    try {
      await fs.access(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Close database connection
   */
  async close() {
    if (this.kuzu) {
      await this.kuzu.close();
      this.kuzu = null;
    }
  }
}