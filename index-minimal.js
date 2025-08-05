#!/usr/bin/env node

import { program } from 'commander';
import chalk from 'chalk';

program
  .name('mcp-vibe-coding')
  .description('MCP server for Vibe Coding with Knowledge Graph integration using Kuzu')
  .version('1.0.0');

program
  .command('backup <output>')
  .description('Create a backup of the Knowledge Graph')
  .option('-c, --config <path>', 'config file path')
  .option('-d, --description <text>', 'backup description')
  .option('--validate', 'validate backup after creation', true)
  .action(async (output, options) => {
    try {
      console.log(chalk.blue(`💾 Creating backup: ${output}`));
      
      // Dynamic import to avoid early loading issues
      const { config } = await import('./src/utils/config.js');
      const { BackupManager } = await import('./src/utils/backupManager.js');
      
      // Load configuration
      const cfg = config.load(options.config);
      
      // Initialize backup manager
      const backupManager = new BackupManager({
        backupDirectory: require('path').dirname(output) || '.kg-context/backups',
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
  .command('clean')
  .description('Clean up temporary files and reset database')
  .option('--force', 'skip confirmation prompt')
  .option('--temp-only', 'only clean temporary files, keep database')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🧹 Starting cleanup...'));
      
      if (!options.force) {
        console.log(chalk.yellow('⚠️  This will delete Knowledge Graph data!'));
        console.log(chalk.yellow('Use --force to skip this confirmation'));
        return;
      }
      
      // Simple cleanup implementation
      const fs = await import('fs/promises');
      const path = await import('path');
      const { glob } = await import('glob');
      
      let cleanedItems = 0;
      
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
      
      console.log(chalk.green(`✅ Cleanup completed! Removed ${cleanedItems} items.`));
      
    } catch (error) {
      console.error(chalk.red('❌ Cleanup failed:'), error.message);
      process.exit(1);
    }
  });

// Show help if no command provided
if (process.argv.length <= 2) {
  program.help();
}

program.parse();