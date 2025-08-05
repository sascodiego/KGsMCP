import chalk from 'chalk';
import ora from 'ora';
import fs from 'fs/promises';
import path from 'path';
import inquirer from 'inquirer';
import { InitializationHandler } from '../src/handlers/initialization.js';
import { KuzuClient } from '../src/database/kuzuClient.js';
import { CodeAnalyzer } from '../src/analyzers/codeAnalyzer.js';
import { PatternDetector } from '../src/analyzers/patternDetector.js';
import { config } from '../src/utils/config.js';
import { logger } from '../src/utils/logger.js';

export async function initializeKG(codebasePath, options = {}) {
  console.log(chalk.blue.bold('\n🚀 Initializing Knowledge Graph from Codebase\n'));
  
  // Validate codebase path
  try {
    const resolvedPath = path.resolve(codebasePath);
    const stats = await fs.stat(resolvedPath);
    if (!stats.isDirectory()) {
      console.log(chalk.red(`❌ Error: ${codebasePath} is not a directory`));
      return;
    }
    codebasePath = resolvedPath;
  } catch (error) {
    console.log(chalk.red(`❌ Error: Cannot access ${codebasePath}`));
    console.log(chalk.gray(`   ${error.message}`));
    return;
  }
  
  const spinner = ora('Loading configuration...').start();
  
  try {
    // Load configuration
    let appConfig;
    try {
      appConfig = config.load();
      spinner.succeed('Configuration loaded');
    } catch (error) {
      spinner.fail('Configuration not found');
      console.log(chalk.red('❌ Configuration file not found. Please run setup first:'));
      console.log(chalk.white('   npx @mcp/vibe-coding-kg setup\n'));
      return;
    }
    
    // Connect to Kuzu
    spinner.start('Connecting to Kuzu database...');
    const kuzuClient = new KuzuClient(appConfig.kuzu);
    
    try {
      await kuzuClient.connect();
      spinner.succeed('Connected to Kuzu database');
    } catch (error) {
      spinner.fail('Kuzu connection failed');
      console.log(chalk.red('❌ Cannot connect to Kuzu database'));
      console.log(chalk.yellow('   Make sure the database path is accessible and configuration is correct'));
      console.log(chalk.gray(`   Error: ${error.message}\n`));
      return;
    }
    
    // Check if KG already exists and handle accordingly
    const existingStats = await kuzuClient.getHealthMetrics();
    const hasExistingData = existingStats && (
      existingStats.entities > 0 || 
      existingStats.patterns > 0 || 
      existingStats.decisions > 0
    );
    
    if (hasExistingData && !options.force) {
      console.log(chalk.yellow('⚠️  Knowledge Graph already contains data:'));
      console.log(chalk.white(`   • Entities: ${existingStats.entities}`));
      console.log(chalk.white(`   • Patterns: ${existingStats.patterns}`));
      console.log(chalk.white(`   • Rules: ${existingStats.rules}`));
      
      const { action } = await inquirer.prompt([
        {
          type: 'list',
          name: 'action',
          message: 'How would you like to proceed?',
          choices: [
            { name: 'Add to existing Knowledge Graph', value: 'add' },
            { name: 'Clear and reinitialize (DESTRUCTIVE)', value: 'clear' },
            { name: 'Cancel', value: 'cancel' }
          ],
          default: 'add'
        }
      ]);
      
      if (action === 'cancel') {
        await kuzuClient.close();
        console.log(chalk.gray('Initialization cancelled'));
        return;
      }
      
      if (action === 'clear') {
        spinner.start('Clearing existing Knowledge Graph...');
        await kuzuClient.clearDatabase();
        spinner.succeed('Knowledge graph cleared');
      }
    } else if (options.force) {
      spinner.start('Clearing existing Knowledge Graph...');
      await kuzuClient.clearDatabase();
      spinner.succeed('Knowledge graph cleared');
    }
    
    // Discover and validate files
    spinner.start('Discovering files...');
    const { includedExtensions, excludedDirs, maxFileSize } = appConfig.analysis;
    const files = await discoverFiles(codebasePath, includedExtensions, excludedDirs);
    
    if (files.length === 0) {
      spinner.fail('No supported files found');
      console.log(chalk.yellow('⚠️  No files with supported extensions found in:'));
      console.log(chalk.white(`   ${codebasePath}`));
      console.log(chalk.gray(`   Supported: ${includedExtensions.join(', ')}`));
      await kuzuClient.close();
      return;
    }
    
    spinner.succeed(`Discovered ${files.length} files to analyze`);
    
    // Create comprehensive analysis
    const analysis = {
      summary: {
        path: codebasePath,
        startTime: new Date().toISOString(),
        filesDiscovered: files.length,
        filesAnalyzed: 0,
        entitiesFound: 0,
        patternsDetected: 0,
        relationshipsCreated: 0
      },
      entities: [],
      patterns: [],
      relationships: []
    };
    
    // Analyze each file with progress tracking
    const progressSpinner = ora(`Analyzing files (0/${files.length})`).start();
    
    const codeAnalyzer = new CodeAnalyzer(appConfig.analysis);
    const patternDetector = new PatternDetector();
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      progressSpinner.text = `Analyzing files (${i + 1}/${files.length}): ${path.relative(codebasePath, file)}`;
      
      try {
        // Check file size
        const stats = await fs.stat(file);
        if (stats.size > maxFileSize) {
          continue; // Skip large files
        }
        
        // Read and analyze file
        const content = await fs.readFile(file, 'utf-8');
        const ext = path.extname(file);
        const language = getLanguageFromExtension(ext);
        
        const fileAnalysis = await codeAnalyzer.analyzeCode(content, file, language);
        
        // Detect patterns in the AST if it's a JavaScript/TypeScript file
        if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
          try {
            const { parse } = await import('@babel/parser');
            const ast = parse(content, {
              sourceType: 'module',
              plugins: ['jsx', 'typescript', 'decorators-legacy'],
              errorRecovery: true
            });
            
            const patterns = patternDetector.detectPatterns(ast, file);
            analysis.patterns.push(...patterns);
          } catch (parseError) {
            // Skip pattern detection if parsing fails
          }
        }
        
        // Add entities to analysis
        analysis.entities.push(...fileAnalysis.entities || []);
        analysis.summary.filesAnalyzed++;
        
      } catch (error) {
        // Log error but continue with other files
        logger.warn(`Failed to analyze ${file}:`, error.message);
      }
    }
    
    progressSpinner.succeed(`Analyzed ${analysis.summary.filesAnalyzed} files successfully`);
    
    // Store results in Kuzu
    spinner.start('Storing analysis results...');
    
    // Store entities
    for (const entity of analysis.entities) {
      const nodeProps = {
        id: entity.id || `${entity.filePath}:${entity.name}`,
        name: entity.name,
        type: entity.type,
        filePath: entity.filePath,
        lineStart: entity.lineStart || 0,
        lineEnd: entity.lineEnd || 0,
        complexity: entity.complexity || 0,
        agent: entity.agent || 'auto-detected',
        context: entity.context || '',
        language: entity.language || getLanguageFromExtension(path.extname(entity.filePath)),
        analyzedAt: new Date().toISOString()
      };
      
      try {
        await kuzuClient.createNode('CodeEntity', nodeProps);
        analysis.summary.entitiesFound++;
      } catch (error) {
        logger.warn(`Failed to store entity ${entity.name}:`, error.message);
      }
    }
    
    // Store patterns
    for (const pattern of analysis.patterns) {
      const nodeProps = {
        id: `pattern:${pattern.type}:${pattern.entity}:${Date.now()}`,
        name: pattern.name,
        type: pattern.type,
        entity: pattern.entity,
        filePath: pattern.filePath,
        confidence: pattern.confidence,
        lineStart: pattern.lineStart || 0,
        lineEnd: pattern.lineEnd || 0,
        evidence: JSON.stringify(pattern.evidence || {}),
        detectedAt: new Date().toISOString()
      };
      
      try {
        await kuzuClient.createNode('DetectedPattern', nodeProps);
        analysis.summary.patternsDetected++;
        
        // Create relationship between entity and pattern if entity exists
        if (pattern.entity) {
          const entityId = `${pattern.filePath}:${pattern.entity}`;
          try {
            await kuzuClient.createRelationship(
              entityId,
              'IMPLEMENTS_PATTERN',
              nodeProps.id,
              { confidence: pattern.confidence }
            );
            analysis.summary.relationshipsCreated++;
          } catch (error) {
            // Relationship creation failed, continue
          }
        }
      } catch (error) {
        logger.warn(`Failed to store pattern ${pattern.name}:`, error.message);
      }
    }
    
    spinner.succeed('Analysis results stored in Knowledge Graph');
    
    // Update summary
    analysis.summary.endTime = new Date().toISOString();
    
    // Generate final statistics and recommendations
    const finalStats = await kuzuClient.getDatabaseStats();
    
    // Display comprehensive results
    console.log(chalk.green.bold('\n✅ Knowledge Graph Initialization Complete!\n'));
    
    console.log(chalk.cyan('📊 Analysis Summary:'));
    console.log(chalk.white(`   • Codebase: ${path.relative(process.cwd(), codebasePath)}`));
    console.log(chalk.white(`   • Files discovered: ${analysis.summary.filesDiscovered}`));
    console.log(chalk.white(`   • Files analyzed: ${analysis.summary.filesAnalyzed}`));
    console.log(chalk.white(`   • Entities found: ${analysis.summary.entitiesFound}`));
    console.log(chalk.white(`   • Patterns detected: ${analysis.summary.patternsDetected}`));
    console.log(chalk.white(`   • Relationships created: ${analysis.summary.relationshipsCreated}`));
    
    console.log(chalk.cyan('\n💾 Database Contents:'));
    console.log(chalk.white(`   • Total entities: ${finalStats.entities}`));
    console.log(chalk.white(`   • Total patterns: ${finalStats.patterns}`));
    console.log(chalk.white(`   • Total rules: ${finalStats.rules}`));
    console.log(chalk.white(`   • Total standards: ${finalStats.standards}`));
    
    // Generate insights and recommendations
    await generateRecommendations(kuzuClient, codebasePath, analysis);
    
    // Close connection
    await kuzuClient.close();
    
    console.log(chalk.green.bold('\n🎉 Ready to use with Claude Desktop!'));
    console.log(chalk.cyan('\n📖 Next steps:'));
    console.log(chalk.white('   1. Start the MCP server:'));
    console.log(chalk.gray('      npx @mcp/vibe-coding-kg start'));
    console.log(chalk.white('   2. Use with Claude Desktop'));
    console.log(chalk.white('   3. Try: "Use query_context_for_task to explore the knowledge graph"'));
    
  } catch (error) {
    spinner.fail('Initialization failed');
    console.log(chalk.red(`\n❌ Error: ${error.message}`));
    logger.error('Initialization error:', error);
    
    // Provide helpful error context
    if (error.message.includes('ECONNREFUSED')) {
      console.log(chalk.yellow('\n💡 Troubleshooting:'));
      console.log(chalk.white('   • Make sure Kuzu database path is accessible'));
      console.log(chalk.white('   • Check connection settings in config'));
    }
    
    process.exit(1);
  }
}

async function discoverFiles(basePath, includedExtensions, excludedDirs) {
  const { glob } = await import('glob');
  
  const patterns = includedExtensions.map(ext => `**/*${ext}`);
  const files = [];
  
  for (const pattern of patterns) {
    try {
      const foundFiles = await glob(pattern, {
        cwd: basePath,
        ignore: excludedDirs.map(dir => `**/${dir}/**`),
        absolute: true,
        maxDepth: 15
      });
      files.push(...foundFiles);
    } catch (error) {
      logger.warn(`Failed to glob pattern ${pattern}:`, error.message);
    }
  }
  
  return [...new Set(files)]; // Remove duplicates
}

function getLanguageFromExtension(ext) {
  const languageMap = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.py': 'python',
    '.java': 'java',
    '.go': 'go',
    '.rs': 'rust',
    '.php': 'php',
    '.rb': 'ruby',
    '.cs': 'csharp',
    '.cpp': 'cpp',
    '.c': 'c',
    '.h': 'c'
  };
  
  return languageMap[ext] || 'unknown';
}

async function generateRecommendations(kuzuClient, codebasePath, analysis) {
  try {
    console.log(chalk.cyan('\n📊 Analysis Results & Recommendations\n'));
    
    // Get comprehensive statistics
    const entityStats = await kuzuClient.query(`
      MATCH (e:CodeEntity)
      RETURN e.type as type, e.language as language, count(*) as count, avg(e.complexity) as avgComplexity
      ORDER BY count DESC
    `);
    
    const patternStats = await kuzuClient.query(`
      MATCH (p:DetectedPattern)
      RETURN p.type as type, count(*) as count, avg(p.confidence) as avgConfidence
      ORDER BY count DESC
    `);
    
    const fileStats = await kuzuClient.query(`
      MATCH (e:CodeEntity)
      RETURN e.filePath as file, e.language as language, count(*) as entityCount, avg(e.complexity) as avgComplexity
      ORDER BY entityCount DESC
      LIMIT 10
    `);
    
    const complexityStats = await kuzuClient.query(`
      MATCH (e:CodeEntity)
      WHERE e.complexity > 0
      RETURN max(e.complexity) as maxComplexity, avg(e.complexity) as avgComplexity, count(*) as totalWithComplexity
    `);
    
    // Display entity breakdown
    console.log(chalk.yellow('📈 Code Entity Analysis:'));
    if (entityStats.length > 0) {
      entityStats.forEach(stat => {
        const complexityText = stat.avgComplexity > 0 ? ` (avg complexity: ${stat.avgComplexity.toFixed(1)})` : '';
        console.log(chalk.white(`   • ${stat.type} (${stat.language || 'unknown'}): ${stat.count} entities${complexityText}`));
      });
    } else {
      console.log(chalk.gray('   • No entities found'));
    }
    
    // Display pattern analysis
    console.log(chalk.yellow('\n🎯 Design Pattern Detection:'));
    if (patternStats.length > 0) {
      patternStats.forEach(stat => {
        const confidence = (stat.avgConfidence * 100).toFixed(1);
        const confidenceColor = stat.avgConfidence > 0.7 ? chalk.green : stat.avgConfidence > 0.5 ? chalk.yellow : chalk.red;
        console.log(chalk.white(`   • ${stat.type}: ${stat.count} instances (${confidenceColor(confidence + '%')} confidence)`));
      });
    } else {
      console.log(chalk.gray('   • No design patterns detected'));
    }
    
    // Display complexity analysis
    if (complexityStats[0]?.totalWithComplexity > 0) {
      const stats = complexityStats[0];
      console.log(chalk.yellow('\n🔍 Complexity Analysis:'));
      console.log(chalk.white(`   • Functions analyzed: ${stats.totalWithComplexity}`));
      console.log(chalk.white(`   • Average complexity: ${stats.avgComplexity.toFixed(1)}`));
      console.log(chalk.white(`   • Maximum complexity: ${stats.maxComplexity}`));
      
      if (stats.maxComplexity > 15) {
        console.log(chalk.red(`   ⚠️  High complexity detected (max: ${stats.maxComplexity})`));
      }
    }
    
    // Display file hotspots
    console.log(chalk.yellow('\n📁 File Complexity Hotspots:'));
    if (fileStats.length > 0) {
      fileStats.slice(0, 5).forEach((stat, index) => {
        const relativePath = path.relative(codebasePath, stat.file);
        const complexityText = stat.avgComplexity > 0 ? ` (complexity: ${stat.avgComplexity.toFixed(1)})` : '';
        const hotspotIcon = index === 0 ? '🔥' : index < 3 ? '⚡' : '📄';
        console.log(chalk.white(`   ${hotspotIcon} ${relativePath}: ${stat.entityCount} entities${complexityText}`));
      });
    }
    
    // Generate actionable recommendations
    console.log(chalk.yellow('\n💡 Actionable Recommendations:'));
    
    const recommendations = [];
    
    // Complexity recommendations
    if (complexityStats[0]?.maxComplexity > 15) {
      recommendations.push({
        priority: '🔴 HIGH',
        message: `Reduce cyclomatic complexity (max: ${complexityStats[0].maxComplexity})`,
        action: 'Break down complex functions into smaller, more manageable pieces'
      });
    }
    
    // File size recommendations
    const largeFiles = fileStats.filter(f => f.entityCount > 15);
    if (largeFiles.length > 0) {
      recommendations.push({
        priority: '🟡 MEDIUM',
        message: `${largeFiles.length} files have many entities (>15)`,
        action: 'Consider splitting large files to improve maintainability'
      });
    }
    
    // Pattern diversity recommendations
    if (patternStats.length < 3) {
      recommendations.push({
        priority: '🟢 LOW',
        message: 'Limited design pattern usage detected',
        action: 'Consider implementing common patterns (Factory, Observer, Strategy) where appropriate'
      });
    }
    
    // Confidence recommendations
    const lowConfidencePatterns = patternStats.filter(p => p.avgConfidence < 0.6);
    if (lowConfidencePatterns.length > 0) {
      recommendations.push({
        priority: '🟡 MEDIUM',
        message: `${lowConfidencePatterns.length} patterns detected with low confidence`,
        action: 'Review and verify pattern implementations manually'
      });
    }
    
    // Language diversity analysis
    const languages = [...new Set(entityStats.map(s => s.language).filter(Boolean))];
    if (languages.length > 3) {
      recommendations.push({
        priority: '🟢 INFO',
        message: `Multi-language codebase detected (${languages.join(', ')})`,
        action: 'Ensure consistent patterns and standards across all languages'
      });
    }
    
    // Default recommendation if nothing specific found
    if (recommendations.length === 0) {
      recommendations.push({
        priority: '✅ GOOD',
        message: 'Codebase appears well-structured',
        action: 'Continue monitoring with regular analysis and maintain current practices'
      });
    }
    
    recommendations.forEach((rec, index) => {
      console.log(chalk.white(`   ${index + 1}. ${rec.priority} ${rec.message}`));
      console.log(chalk.gray(`      → ${rec.action}`));
    });
    
    // Usage tips
    console.log(chalk.yellow('\n🎯 Usage Tips:'));
    console.log(chalk.white('   • Use "query_context_for_task" to find relevant patterns for new features'));
    console.log(chalk.white('   • Use "detect_technical_debt" to identify areas needing refactoring'));
    console.log(chalk.white('   • Use "validate_against_kg" to check new code against established patterns'));
    
  } catch (error) {
    logger.warn('Failed to generate recommendations:', error);
  }
}

// Export for CLI usage
if (import.meta.url === `file://${process.argv[1]}`) {
  const codebasePath = process.argv[2];
  const force = process.argv.includes('--force');
  
  if (!codebasePath) {
    console.log(chalk.red('Usage: node init-kg.js <codebase-path> [--force]'));
    process.exit(1);
  }
  
  initializeKG(codebasePath, { force });
}