#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';

// Handle unhandled rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error(chalk.red('Unhandled Rejection at:'), promise, chalk.red('reason:'), reason);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error(chalk.red('Uncaught Exception:'), error);
  process.exit(1);
});

program
  .name('mcp-vibe-coding')
  .description('MCP server for Vibe Coding with Knowledge Graph integration using Kuzu')
  .version('1.0.0');

program
  .command('start')
  .description('Start the MCP server')
  .option('-c, --config <path>', 'config file path')
  .option('-d, --debug', 'enable debug logging')
  .option('--verify', 'verify setup before starting')
  .action(async (options) => {
    try {
      if (options.debug) {
        process.env.LOG_LEVEL = 'debug';
      }

      console.log(chalk.blue('🚀 Starting MCP Vibe Coding Server...'));
      
      if (options.verify) {
        console.log(chalk.cyan('🔍 Verifying setup...'));
        await verifySetup(options.config);
      }

      // Dynamic import to avoid early loading issues
      const { MCPServer } = await import('./src/server.js');
      const server = await MCPServer.createAsync(options);
      await server.start();
      
    } catch (error) {
      console.error(chalk.red('❌ Error starting server:'), error.message);
      process.exit(1);
    }
  });

program
  .command('setup')
  .description('Run interactive setup wizard')
  .option('-f, --force', 'force overwrite existing configuration')
  .action(async (options) => {
    try {
      const { setupWizard } = await import('./scripts/setup.js');
      await setupWizard(options);
    } catch (error) {
      console.error(chalk.red('❌ Setup failed:'), error.message);
      process.exit(1);
    }
  });

program
  .command('init <codebase>')
  .description('Initialize Knowledge Graph from existing codebase')
  .option('-f, --force', 'force re-initialization')
  .option('-d, --depth <number>', 'maximum analysis depth', '10')
  .option('--parallel <number>', 'number of parallel workers', '4')
  .action(async (codebase, options) => {
    try {
      console.log(chalk.blue(`🔍 Initializing Knowledge Graph from: ${codebase}`));
      const { initializeKG } = await import('./scripts/init-kg.js');
      await initializeKG(codebase, options);
      console.log(chalk.green('✅ Knowledge Graph initialization completed!'));
    } catch (error) {
      console.error(chalk.red('❌ Initialization failed:'), error.message);
      process.exit(1);
    }
  });

program
  .command('health')
  .description('Check system health and database status')
  .option('-c, --config <path>', 'config file path')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🏥 Checking system health...'));
      
      // Dynamic imports
      const { config } = await import('./src/utils/config.js');
      const cfg = config.load(options.config);
      
      // Try to get appropriate KuzuClient
      let KuzuClient;
      try {
        const kuzuModule = await import('./src/database/kuzuClient.js');
        KuzuClient = kuzuModule.KuzuClient;
        console.log(chalk.green('✅ Using real Kuzu database'));
      } catch (error) {
        console.log(chalk.yellow('⚠️  Real Kuzu not available, using mock client'));
        const mockModule = await import('./src/database/mockKuzuClient.js');
        KuzuClient = mockModule.MockKuzuClient;
      }
      
      const kuzu = new KuzuClient(cfg.kuzu);
      
      console.log(chalk.cyan('📊 Database connection...'));
      await kuzu.connect();
      
      const health = await kuzu.getHealthMetrics();
      console.log(chalk.green('✅ Database: Connected'));
      if (health.mode === 'mock') {
        console.log(chalk.yellow('ℹ️  Mode: Mock (for development)'));
      }
      console.log(chalk.cyan('📈 Statistics:'));
      console.log(`   - Code Entities: ${health.tableCounts?.codeEntities || 0}`);
      console.log(`   - Patterns: ${health.tableCounts?.patterns || 0}`);
      console.log(`   - Rules: ${health.tableCounts?.rules || 0}`);
      console.log(`   - Standards: ${health.tableCounts?.standards || 0}`);
      console.log(`   - Decisions: ${health.tableCounts?.decisions || 0}`);
      
      await kuzu.close();
      
    } catch (error) {
      console.error(chalk.red('❌ Health check failed:'), error.message);
      process.exit(1);
    }
  });

program
  .command('backup <output>')
  .description('Create a backup of the Knowledge Graph')
  .option('-c, --config <path>', 'config file path')
  .option('-d, --description <text>', 'backup description')
  .option('--validate', 'validate backup after creation', true)
  .action(async (output, options) => {
    try {
      console.log(chalk.blue(`💾 Creating backup: ${output}`));
      
      // Dynamic imports
      const { config } = await import('./src/utils/config.js');
      const { BackupManager } = await import('./src/utils/backupManager.js');
      
      // Load configuration
      const cfg = config.load(options.config);
      
      // Initialize backup manager
      const backupManager = new BackupManager({
        backupDirectory: path.dirname(output) || '.kg-context/backups',
        validateBackups: options.validate
      });
      
      // Setup progress reporting
      backupManager.on('backupStarted', () => {
        console.log(chalk.cyan('📦 Exporting database tables...'));
      });
      
      backupManager.on('backupCompleted', (data) => {
        console.log(chalk.green(`✅ Backup completed successfully!`));
        console.log(chalk.cyan(`   File: ${data.backupPath}`));
        console.log(chalk.cyan(`   Duration: ${data.duration}ms`));
        console.log(chalk.cyan(`   Tables: ${Object.keys(data.metadata.tables || {}).length}`));
      });
      
      // Initialize and create backup
      await backupManager.initialize(cfg.kuzu);
      await backupManager.createBackup(output, {
        description: options.description
      });
      
      await backupManager.close();
      
    } catch (error) {
      console.error(chalk.red('❌ Backup failed:'), error.message);
      process.exit(1);
    }
  });

program
  .command('restore <backup>')
  .description('Restore Knowledge Graph from backup')
  .option('-c, --config <path>', 'config file path')
  .option('-f, --force', 'force overwrite existing data')
  .option('--incremental', 'incremental restore (add to existing data)')
  .option('--validate', 'validate backup before restore', true)
  .action(async (backup, options) => {
    try {
      console.log(chalk.blue(`📥 Restoring from backup: ${backup}`));
      
      // Check if backup file exists
      try {
        await fs.access(backup);
      } catch {
        throw new Error(`Backup file not found: ${backup}`);
      }
      
      // Dynamic imports
      const { config } = await import('./src/utils/config.js');
      const { BackupManager } = await import('./src/utils/backupManager.js');
      
      // Load configuration
      const cfg = config.load(options.config);
      
      // Initialize backup manager
      const backupManager = new BackupManager({
        validateBackups: options.validate
      });
      
      // Setup progress reporting
      backupManager.on('restoreStarted', () => {
        console.log(chalk.cyan('📂 Extracting backup archive...'));
      });
      
      backupManager.on('restoreCompleted', (data) => {
        console.log(chalk.green(`✅ Restore completed successfully!`));
        console.log(chalk.cyan(`   Source: ${data.backupPath}`));
        console.log(chalk.cyan(`   Duration: ${data.duration}ms`));
        console.log(chalk.cyan(`   Tables restored: ${Object.keys(data.metadata.tables || {}).length}`));
      });
      
      // Confirmation prompt unless forced
      if (!options.force && !options.incremental) {
        console.log(chalk.yellow('⚠️  This will replace all existing Knowledge Graph data!'));
        
        const answer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: 'Are you sure you want to continue?',
            default: false
          }
        ]);
        
        if (!answer.proceed) {
          console.log(chalk.yellow('Restore cancelled.'));
          return;
        }
      }
      
      // Initialize and restore
      await backupManager.initialize(cfg.kuzu);
      await backupManager.restoreFromBackup(backup, {
        force: options.force,
        incremental: options.incremental
      });
      
      await backupManager.close();
      
    } catch (error) {
      console.error(chalk.red('❌ Restore failed:'), error.message);
      process.exit(1);
    }
  });

program
  .command('clean')
  .description('Clean up temporary files and reset database')
  .option('-c, --config <path>', 'config file path')
  .option('--force', 'skip confirmation prompt')
  .option('--backup', 'create backup before cleaning')
  .option('--temp-only', 'only clean temporary files, keep database')
  .action(async (options) => {
    try {
      // Dynamic imports
      const { config } = await import('./src/utils/config.js');
      const cfg = config.load(options.config);
      
      // Show what will be cleaned
      console.log(chalk.blue('🧹 Clean operation will remove:'));
      
      const itemsToClean = [];
      
      if (!options.tempOnly) {
        itemsToClean.push('• Knowledge Graph database');
        itemsToClean.push('• All cached analysis results');
      }
      itemsToClean.push('• Temporary processing files');
      itemsToClean.push('• Log files (optional)');
      itemsToClean.push('• Cache files');
      
      itemsToClean.forEach(item => console.log(chalk.yellow(`  ${item}`)));
      
      // Confirmation prompt unless forced
      if (!options.force) {
        console.log(chalk.yellow('\n⚠️  This operation cannot be undone!'));
        
        const answer = await inquirer.prompt([
          {
            type: 'confirm',
            name: 'proceed',
            message: 'Are you sure you want to continue?',
            default: false
          }
        ]);
        
        if (!answer.proceed) {
          console.log(chalk.yellow('Clean operation cancelled.'));
          return;
        }
      }
      
      // Create backup if requested
      if (options.backup && !options.tempOnly) {
        console.log(chalk.cyan('💾 Creating backup before cleaning...'));
        
        try {
          const { BackupManager } = await import('./src/utils/backupManager.js');
          const backupManager = new BackupManager();
          await backupManager.initialize(cfg.kuzu);
          
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const backupPath = `.kg-context/backups/pre-clean-${timestamp}.tar.gz`;
          
          await backupManager.createBackup(backupPath, {
            description: 'Pre-clean backup'
          });
          console.log(chalk.green(`✅ Backup created: ${backupPath}`));
          await backupManager.close();
        } catch (backupError) {
          console.log(chalk.yellow(`⚠️  Backup failed: ${backupError.message}`));
          
          const continueAnswer = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'continueWithoutBackup',
              message: 'Continue cleaning without backup?',
              default: false
            }
          ]);
          
          if (!continueAnswer.continueWithoutBackup) {
            console.log(chalk.yellow('Clean operation cancelled.'));
            return;
          }
        }
      }
      
      console.log(chalk.blue('🧹 Starting cleanup...'));
      let cleanedItems = 0;
      
      // Clean database
      if (!options.tempOnly) {
        try {
          const dbPath = cfg.kuzu.databasePath;
          const dbDir = path.dirname(dbPath);
          
          // Remove database files
          const dbFiles = await glob(path.join(dbDir, 'knowledge-graph.kuzu*'));
          for (const file of dbFiles) {
            await fs.rm(file, { recursive: true, force: true });
            console.log(chalk.gray(`   Removed: ${path.relative(process.cwd(), file)}`));
            cleanedItems++;
          }
          
        } catch (error) {
          console.warn('Failed to remove database files', error.message);
        }
      }
      
      // Clean temporary files
      const tempDirs = [
        '.kg-context/temp',
        '.kg-context/cache'
      ];
      
      for (const tempDir of tempDirs) {
        try {
          const files = await glob(path.join(tempDir, '*'));
          for (const file of files) {
            if (!file.endsWith('.gitkeep')) {
              await fs.rm(file, { recursive: true, force: true });
              console.log(chalk.gray(`   Removed: ${path.relative(process.cwd(), file)}`));
              cleanedItems++;
            }
          }
        } catch (error) {
          // Directory might not exist, ignore error
        }
      }
      
      // Clean log files (optional)
      try {
        const logFiles = await glob('.kg-context/logs/*.log');
        if (logFiles.length > 0) {
          const cleanLogs = await inquirer.prompt([
            {
              type: 'confirm',
              name: 'removeLogs',
              message: `Remove ${logFiles.length} log files?`,
              default: false
            }
          ]);
          
          if (cleanLogs.removeLogs) {
            for (const logFile of logFiles) {
              await fs.rm(logFile, { force: true });
              console.log(chalk.gray(`   Removed: ${path.relative(process.cwd(), logFile)}`));
              cleanedItems++;
            }
          }
        }
      } catch (error) {
        // Log directory might not exist, ignore error
      }
      
      console.log(chalk.green(`✅ Cleanup completed! Removed ${cleanedItems} items.`));
      
      if (!options.tempOnly) {
        console.log(chalk.cyan('\n💡 Next steps:'));
        console.log(chalk.cyan('   1. Run "mcp-vibe-coding init <codebase>" to rebuild the Knowledge Graph'));
        console.log(chalk.cyan('   2. Or restore from a backup using "mcp-vibe-coding restore <backup>"'));
      }
      
    } catch (error) {
      console.error(chalk.red('❌ Cleanup failed:'), error.message);
      process.exit(1);
    }
  });

async function verifySetup(configPath) {
  try {
    const { config } = await import('./src/utils/config.js');
    const cfg = config.load(configPath);
    
    // Verify configuration
    console.log(chalk.cyan('   ✓ Configuration loaded'));
    
    // Try to get appropriate KuzuClient
    let KuzuClient;
    try {
      const kuzuModule = await import('./src/database/kuzuClient.js');
      KuzuClient = kuzuModule.KuzuClient;
    } catch (error) {
      console.log(chalk.yellow('   Real Kuzu not available, using mock client'));
      const mockModule = await import('./src/database/mockKuzuClient.js');
      KuzuClient = mockModule.MockKuzuClient;
    }
    
    const kuzu = new KuzuClient(cfg.kuzu);
    await kuzu.connect();
    await kuzu.close();
    console.log(chalk.cyan('   ✓ Database connection successful'));
    
    console.log(chalk.green('✅ Setup verification completed'));
    
  } catch (error) {
    console.error(chalk.red('❌ Setup verification failed:'), error.message);
    throw error;
  }
}

// Show help if no command provided
if (process.argv.length <= 2) {
  program.help();
}

program.parse();