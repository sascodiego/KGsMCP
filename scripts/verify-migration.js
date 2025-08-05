#!/usr/bin/env node

/**
 * CONTEXT: Verification script to ensure Neo4j to Kuzu migration is complete
 * REASON: Validate that all Neo4j references have been removed and Kuzu is properly configured
 * CHANGE: Complete migration verification with database path validation
 * PREVENTION: Runtime errors due to missing Neo4j to Kuzu migration
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { glob } from 'glob';
import { config } from '../src/utils/config.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

class MigrationVerifier {
  constructor() {
    this.errors = [];
    this.warnings = [];
    this.success = [];
  }

  async verify() {
    console.log(chalk.blue.bold('\n🔍 Verifying Neo4j to Kuzu Migration\n'));

    // 1. Check for remaining Neo4j references
    await this.checkNeo4jReferences();

    // 2. Verify Kuzu configuration
    await this.verifyKuzuConfiguration();

    // 3. Check database path configuration
    await this.checkDatabasePathConfiguration();

    // 4. Verify package.json dependencies
    await this.verifyPackageDependencies();

    // 5. Check handlers for correct database client usage
    await this.verifyHandlerDatabaseUsage();

    // 6. Verify environment files
    await this.verifyEnvironmentFiles();

    // 7. Check documentation consistency
    await this.verifyDocumentation();

    // Print results
    this.printResults();

    return this.errors.length === 0;
  }

  async checkNeo4jReferences() {
    console.log(chalk.yellow('Checking for remaining Neo4j references...'));

    try {
      const files = await glob('**/*.{js,json,md,txt}', {
        cwd: projectRoot,
        ignore: [
          'node_modules/**',
          '.git/**',
          'scripts/verify-migration.js', // Ignore this file
          '**/*.log'
        ]
      });

      for (const file of files) {
        const filePath = path.join(projectRoot, file);
        try {
          const content = await fs.readFile(filePath, 'utf-8');
          const lines = content.split('\n');
          
          lines.forEach((line, index) => {
            if (line.toLowerCase().includes('neo4j')) {
              this.errors.push({
                type: 'neo4j_reference',
                file: file,
                line: index + 1,
                content: line.trim(),
                message: 'Found Neo4j reference that should be removed or updated'
              });
            }
          });
        } catch (error) {
          // Skip files that can't be read as text
        }
      }

      if (this.errors.filter(e => e.type === 'neo4j_reference').length === 0) {
        this.success.push('✅ No Neo4j references found in codebase');
      }
    } catch (error) {
      this.errors.push({
        type: 'search_error',
        message: `Failed to search for Neo4j references: ${error.message}`
      });
    }
  }

  async verifyKuzuConfiguration() {
    console.log(chalk.yellow('Verifying Kuzu configuration...'));

    try {
      const loadedConfig = config.load();
      
      // Check if Kuzu config exists
      if (!loadedConfig.kuzu) {
        this.errors.push({
          type: 'config_missing',
          message: 'Kuzu configuration is missing from config'
        });
        return;
      }

      // Check required Kuzu config properties
      const requiredProps = ['databasePath', 'maxRetries', 'retryDelay', 'queryTimeout'];
      for (const prop of requiredProps) {
        if (!(prop in loadedConfig.kuzu)) {
          this.errors.push({
            type: 'config_property_missing',
            message: `Required Kuzu config property '${prop}' is missing`
          });
        }
      }

      // Check database path points to .kg-context
      if (loadedConfig.kuzu.databasePath && 
          !loadedConfig.kuzu.databasePath.includes('.kg-context')) {
        this.warnings.push({
          type: 'database_path_warning',
          message: `Database path '${loadedConfig.kuzu.databasePath}' does not use .kg-context directory`
        });
      }

      this.success.push('✅ Kuzu configuration is properly set up');
    } catch (error) {
      this.errors.push({
        type: 'config_load_error',
        message: `Failed to load configuration: ${error.message}`
      });
    }
  }

  async checkDatabasePathConfiguration() {
    console.log(chalk.yellow('Checking database path configuration...'));

    try {
      // Check default.json
      const defaultConfigPath = path.join(projectRoot, 'config', 'default.json');
      const defaultConfig = JSON.parse(await fs.readFile(defaultConfigPath, 'utf-8'));
      
      if (defaultConfig.kuzu && defaultConfig.kuzu.databasePath) {
        if (defaultConfig.kuzu.databasePath.includes('.kg-context')) {
          this.success.push('✅ default.json uses .kg-context directory');
        } else {
          this.warnings.push({
            type: 'config_path_warning',
            message: 'default.json database path does not use .kg-context'
          });
        }
      }

      // Check kuzuClient.js default path
      const kuzuClientPath = path.join(projectRoot, 'src', 'database', 'kuzuClient.js');
      const kuzuClientContent = await fs.readFile(kuzuClientPath, 'utf-8');
      
      if (kuzuClientContent.includes('.kg-context')) {
        this.success.push('✅ KuzuClient uses .kg-context directory');
      } else {
        this.warnings.push({
          type: 'client_path_warning',  
          message: 'KuzuClient default path does not use .kg-context'
        });
      }

    } catch (error) {
      this.errors.push({
        type: 'path_check_error',
        message: `Failed to check database paths: ${error.message}`
      });
    }
  }

  async verifyPackageDependencies() {
    console.log(chalk.yellow('Verifying package.json dependencies...'));

    try {
      const packagePath = path.join(projectRoot, 'package.json');
      const packageJson = JSON.parse(await fs.readFile(packagePath, 'utf-8'));
      
      // Check that neo4j-driver is not in dependencies
      if (packageJson.dependencies && packageJson.dependencies['neo4j-driver']) {
        this.errors.push({
          type: 'dependency_error',
          message: 'neo4j-driver dependency still present in package.json'
        });
      }

      if (packageJson.devDependencies && packageJson.devDependencies['neo4j-driver']) {
        this.errors.push({
          type: 'dependency_error',
          message: 'neo4j-driver devDependency still present in package.json'
        });
      }

      // Check that kuzu dependency exists
      if (!packageJson.dependencies || !packageJson.dependencies.kuzu) {
        this.errors.push({
          type: 'dependency_missing',
          message: 'kuzu dependency is missing from package.json'
        });
      } else {
        this.success.push('✅ Kuzu dependency is present in package.json');
      }

      // Check clean script uses .kg-context
      if (packageJson.scripts && packageJson.scripts.clean) {
        if (packageJson.scripts.clean.includes('.kg-context')) {
          this.success.push('✅ Clean script uses .kg-context directory');
        } else {
          this.warnings.push({
            type: 'script_warning',
            message: 'Clean script does not reference .kg-context directory'
          });
        }
      }

    } catch (error) {
      this.errors.push({
        type: 'package_error',
        message: `Failed to verify package.json: ${error.message}`
      });
    }
  }

  async verifyHandlerDatabaseUsage() {
    console.log(chalk.yellow('Verifying handler database client usage...'));

    try {
      const handlerFiles = await glob('src/handlers/*.js', { cwd: projectRoot });
      
      for (const file of handlerFiles) {
        const filePath = path.join(projectRoot, file);
        const content = await fs.readFile(filePath, 'utf-8');
        
        // Check for this.neo4j usage (should be this.kuzu)
        if (content.includes('this.neo4j')) {
          this.errors.push({
            type: 'handler_database_error',
            file: file,
            message: 'Handler still uses this.neo4j instead of this.kuzu'
          });
        }
        
        // Check for correct kuzu usage
        if (content.includes('this.kuzu')) {
          this.success.push(`✅ ${file} uses Kuzu database client`);
        }
      }
    } catch (error) {
      this.errors.push({
        type: 'handler_check_error',
        message: `Failed to verify handlers: ${error.message}`
      });
    }
  }

  async verifyEnvironmentFiles() {
    console.log(chalk.yellow('Verifying environment files...'));

    try {
      const envExamplePath = path.join(projectRoot, '.env.example');
      const envExample = await fs.readFile(envExamplePath, 'utf-8');
      
      if (envExample.includes('KUZU_DB_PATH')) {
        this.success.push('✅ .env.example includes Kuzu configuration');
      } else {
        this.warnings.push({
          type: 'env_warning',
          message: '.env.example missing Kuzu configuration'
        });
      }

      if (envExample.toLowerCase().includes('neo4j')) {
        this.errors.push({
          type: 'env_error',
          message: '.env.example still contains Neo4j configuration'
        });
      }
    } catch (error) {
      this.warnings.push({
        type: 'env_file_warning',
        message: 'Could not verify .env.example file'
      });
    }
  }

  async verifyDocumentation() {
    console.log(chalk.yellow('Verifying documentation...'));

    try {
      const readmePath = path.join(projectRoot, 'README.md');
      const readme = await fs.readFile(readmePath, 'utf-8');
      
      if (readme.includes('Kuzu')) {
        this.success.push('✅ README.md mentions Kuzu database');
      } else {
        this.warnings.push({
          type: 'docs_warning',
          message: 'README.md does not mention Kuzu database'
        });
      }

      if (readme.toLowerCase().includes('neo4j')) {
        this.errors.push({
          type: 'docs_error',
          message: 'README.md still contains Neo4j references'
        });
      }
    } catch (error) {
      this.warnings.push({
        type: 'docs_warning',
        message: 'Could not verify README.md'
      });
    }
  }

  printResults() {
    console.log('\n' + '='.repeat(60));
    console.log(chalk.blue.bold('  MIGRATION VERIFICATION RESULTS'));
    console.log('='.repeat(60));

    // Print success messages
    if (this.success.length > 0) {
      console.log(chalk.green.bold('\n✅ SUCCESS:'));
      this.success.forEach(msg => console.log(chalk.green(`  ${msg}`)));
    }

    // Print warnings
    if (this.warnings.length > 0) {
      console.log(chalk.yellow.bold('\n⚠️  WARNINGS:'));
      this.warnings.forEach(warning => {
        if (warning.file) {
          console.log(chalk.yellow(`  ${warning.message} (${warning.file}:${warning.line || '?'})`));
        } else {
          console.log(chalk.yellow(`  ${warning.message}`));
        }
      });
    }

    // Print errors
    if (this.errors.length > 0) {
      console.log(chalk.red.bold('\n❌ ERRORS:'));
      this.errors.forEach(error => {
        if (error.file) {
          console.log(chalk.red(`  ${error.message} (${error.file}:${error.line || '?'})`));
          if (error.content) {
            console.log(chalk.gray(`     Content: ${error.content}`));
          }
        } else {
          console.log(chalk.red(`  ${error.message}`));
        }
      });
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    if (this.errors.length === 0) {
      console.log(chalk.green.bold('🎉 MIGRATION VERIFICATION PASSED!'));
      console.log(chalk.green('The Neo4j to Kuzu migration is complete.'));
    } else {
      console.log(chalk.red.bold('❌ MIGRATION VERIFICATION FAILED!'));
      console.log(chalk.red(`Found ${this.errors.length} error(s) that need to be fixed.`));
    }
    
    console.log(chalk.gray(`\nChecked: ${this.success.length} passed, ${this.warnings.length} warnings, ${this.errors.length} errors`));
    console.log('='.repeat(60) + '\n');
  }
}

// Run verification if this file is executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const verifier = new MigrationVerifier();
  const success = await verifier.verify();
  process.exit(success ? 0 : 1);
}

export { MigrationVerifier };