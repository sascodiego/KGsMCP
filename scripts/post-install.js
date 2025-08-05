#!/usr/bin/env node

import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';

/**
 * Post-install script that runs after npm install
 * Sets up initial directories and checks system compatibility
 */

async function postInstall() {
  try {
    console.log(chalk.blue('🔧 Running post-install setup...'));

    // Create logs directory
    const logsDir = './logs';
    try {
      await fs.mkdir(logsDir, { recursive: true });
      console.log(chalk.green('✓ Created logs directory'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  Logs directory already exists or couldn\'t be created'));
    }

    // Check Node.js version
    const nodeVersion = process.version.match(/v(\d+)/)[1];
    if (nodeVersion < 18) {
      console.log(chalk.red('❌ Node.js 18+ is required. Current version:', process.version));
      console.log(chalk.yellow('Please upgrade Node.js and reinstall.'));
      process.exit(1);
    }
    console.log(chalk.green(`✓ Node.js version check passed (${process.version})`));

    // Create example configuration if it doesn't exist
    const exampleConfigPath = './config/example.json';
    const exampleConfig = {
      kuzu: {
        databasePath: "./kuzu_db",
        maxRetries: 3,
        retryDelay: 1000,
        healthCheckInterval: 30000,
        backupInterval: 86400000,
        queryTimeout: 30000
      },
      logging: {
        enabled: true,
        level: "info",
        maxFiles: 10,
        maxSize: 52428800
      },
      analysis: {
        maxFileSize: 1048576,
        excludedDirs: [".git", "node_modules", "__pycache__", ".venv", "target", "build", "dist"],
        includedExtensions: [".js", ".ts", ".jsx", ".tsx", ".py", ".java", ".cpp", ".h", ".hpp", ".c"],
        maxDepth: 10,
        parallelWorkers: 4
      },
      security: {
        enableRateLimit: true,
        maxRequestsPerMinute: 100,
        enableCors: true,
        corsOrigins: ["*"],
        enableHelmet: true
      },
      performance: {
        enableCaching: true,
        cacheTimeout: 300000,
        maxCacheSize: 100,
        enableCompression: true
      },
      mcp: {
        serverName: "mcp-vibe-coding-kg",
        serverVersion: "1.0.0",
        timeout: 30000,
        enableMetrics: true
      }
    };

    try {
      await fs.mkdir('./config', { recursive: true });
      await fs.writeFile(exampleConfigPath, JSON.stringify(exampleConfig, null, 2));
      console.log(chalk.green('✓ Created example configuration file'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  Example config file already exists or couldn\'t be created'));
    }

    console.log(chalk.green.bold('\n✅ Post-install setup completed!\n'));
    
    console.log(chalk.cyan('🚀 Next steps:'));
    console.log(chalk.white('1. Run setup wizard: mcp-vibe-coding setup'));
    console.log(chalk.white('2. Initialize your project: mcp-vibe-coding init /path/to/project'));
    console.log(chalk.white('3. Start the server: mcp-vibe-coding start\n'));
    
    console.log(chalk.gray('For help: mcp-vibe-coding --help'));

  } catch (error) {
    console.error(chalk.red('❌ Post-install setup failed:'), error.message);
    process.exit(1);
  }
}

// Only run if this script is called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  postInstall();
}

export { postInstall };