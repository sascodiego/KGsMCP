import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import ora from 'ora';
import { config } from '../src/utils/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function setupWizard(options = {}) {
  console.log(chalk.blue.bold('\n🚀 MCP Vibe Coding KG Setup Wizard\n'));
  console.log(chalk.cyan('   Powered by Kuzu embedded graph database\n'));
  
  // Check prerequisites
  const spinner = ora('Checking prerequisites...').start();
  const prereqCheck = await checkPrerequisites();
  spinner.stop();
  
  if (!prereqCheck.allMet) {
    console.log(chalk.red('\n❌ Missing prerequisites:'));
    prereqCheck.missing.forEach(req => {
      console.log(chalk.red(`   - ${req}`));
    });
    console.log(chalk.yellow('\nPlease install missing prerequisites and run setup again.'));
    return;
  }
  
  console.log(chalk.green('✓ All prerequisites met\n'));

  // Check if config already exists
  const configPath = path.join(process.cwd(), '.mcp-vibe-config.json');
  let existingConfig = null;

  try {
    const configData = await fs.readFile(configPath, 'utf-8');
    existingConfig = JSON.parse(configData);
    
    if (!options.force) {
      const overwrite = await inquirer.prompt([{
        type: 'confirm',
        name: 'overwrite',
        message: 'Configuration file already exists. Overwrite?',
        default: false
      }]);
      
      if (!overwrite.overwrite) {
        console.log(chalk.yellow('Setup cancelled. Use --force to overwrite existing configuration.'));
        return;
      }
    }
  } catch (error) {
    // Config doesn't exist, continue with setup
  }
  
  // Get configuration
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'kuzuDatabasePath',
      message: 'Kuzu database path:',
      default: existingConfig?.kuzu?.databasePath || './kuzu_db',
      validate: input => input.length > 0 || 'Database path is required'
    },
    {
      type: 'confirm',
      name: 'enableLogging',
      message: 'Enable detailed logging?',
      default: existingConfig?.logging?.enabled ?? true
    },
    {
      type: 'list',
      name: 'logLevel',
      message: 'Log level:',
      choices: ['error', 'warn', 'info', 'debug'],
      default: existingConfig?.logging?.level || 'info',
      when: answers => answers.enableLogging
    },
    {
      type: 'number',
      name: 'maxFileSize',
      message: 'Maximum file size to analyze (bytes):',
      default: existingConfig?.analysis?.maxFileSize || 1048576,
      validate: input => input > 0 || 'Must be greater than 0'
    },
    {
      type: 'input',
      name: 'excludedDirs',
      message: 'Directories to exclude (comma-separated):',
      default: existingConfig?.analysis?.excludedDirs?.join(', ') || '.git, node_modules, __pycache__, .venv, target, build, dist'
    },
    {
      type: 'input',
      name: 'includedExtensions',
      message: 'File extensions to include (comma-separated):',
      default: existingConfig?.analysis?.includedExtensions?.join(', ') || '.js, .ts, .jsx, .tsx, .py, .java, .cpp, .h, .hpp, .c'
    },
    {
      type: 'number',
      name: 'parallelWorkers',
      message: 'Number of parallel analysis workers:',
      default: existingConfig?.analysis?.parallelWorkers || 4,
      validate: input => input > 0 && input <= 16 || 'Must be between 1 and 16'
    }
  ]);
  
  // Create configuration
  const newConfig = {
    kuzu: {
      databasePath: answers.kuzuDatabasePath,
      maxRetries: 3,
      retryDelay: 1000,
      healthCheckInterval: 30000,
      backupInterval: 86400000,
      queryTimeout: 30000
    },
    logging: {
      enabled: answers.enableLogging,
      level: answers.logLevel || 'info',
      maxFiles: 10,
      maxSize: 52428800
    },
    analysis: {
      maxFileSize: answers.maxFileSize,
      excludedDirs: answers.excludedDirs.split(',').map(d => d.trim()),
      includedExtensions: answers.includedExtensions.split(',').map(e => e.trim()),
      maxDepth: 10,
      parallelWorkers: answers.parallelWorkers
    },
    security: {
      enableRateLimit: true,
      maxRequestsPerMinute: 100,
      enableCors: true,
      corsOrigins: ['*'],
      enableHelmet: true
    },
    performance: {
      enableCaching: true,
      cacheTimeout: 300000,
      maxCacheSize: 100,
      enableCompression: true
    },
    mcp: {
      serverName: 'mcp-vibe-coding-kg',
      serverVersion: '1.0.0',
      timeout: 30000,
      enableMetrics: true
    }
  };
  
  // Validate configuration
  try {
    const validatedConfig = await config.saveConfig(newConfig, configPath);
    console.log(chalk.green(`\n✓ Configuration saved to ${configPath}`));
    
    // Test Kuzu connection
    const connSpinner = ora('Testing Kuzu database connection...').start();
    try {
      const { KuzuClient } = await import('../src/database/kuzuClient.js');
      const client = new KuzuClient(validatedConfig.kuzu);
      await client.connect();
      await client.close();
      connSpinner.succeed('Kuzu database connection successful');
    } catch (error) {
      connSpinner.fail('Kuzu database connection failed');
      console.log(chalk.red(`Error: ${error.message}`));
      
      // Offer to continue anyway
      const continueAnyway = await inquirer.prompt([{
        type: 'confirm',
        name: 'continue',
        message: 'Database connection failed. Continue with setup anyway?',
        default: true
      }]);
      
      if (!continueAnyway.continue) {
        return;
      }
    }
    
    // Setup complete
    console.log(chalk.green.bold('\n✅ Setup completed successfully!\n'));
    console.log(chalk.cyan('🎯 What you can do next:\n'));
    
    console.log(chalk.cyan('1. Initialize your codebase:'));
    console.log(chalk.white('   mcp-vibe-coding init /path/to/your/project\n'));
    
    console.log(chalk.cyan('2. Check system health:'));
    console.log(chalk.white('   mcp-vibe-coding health\n'));
    
    console.log(chalk.cyan('3. Start the MCP server:'));
    console.log(chalk.white('   mcp-vibe-coding start\n'));
    
    console.log(chalk.cyan('4. Configure Claude Desktop to use this MCP server:'));
    console.log(chalk.white('   Add to claude_desktop_config.json:\n'));
    console.log(chalk.gray('   {'));
    console.log(chalk.gray('     "mcpServers": {'));
    console.log(chalk.gray('       "vibe-coding-kg": {'));
    console.log(chalk.gray('         "command": "mcp-vibe-coding",'));
    console.log(chalk.gray('         "args": ["start"]'));
    console.log(chalk.gray('       }'));
    console.log(chalk.gray('     }'));
    console.log(chalk.gray('   }\n'));
    
    console.log(chalk.green('🚀 Happy coding with AI-enhanced knowledge graphs!'));
    
  } catch (error) {
    console.log(chalk.red(`\n❌ Configuration validation failed: ${error.message}`));
    return;
  }
}

async function checkPrerequisites() {
  const required = [
    { name: 'Node.js 18+', check: () => process.version.match(/v(\d+)/)[1] >= 18 }
  ];
  
  const missing = [];
  for (const req of required) {
    if (!req.check()) {
      missing.push(req.name);
    }
  }
  
  return {
    allMet: missing.length === 0,
    missing
  };
}