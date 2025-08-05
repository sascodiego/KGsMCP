import fs from 'fs/promises';
import path from 'path';
import { glob } from 'glob';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import simpleGit from 'simple-git';
import { logger } from '../utils/logger.js';

export class InitializationHandler {
  constructor(server) {
    this.server = server;
    this.kuzu = server.kuzu;
    this.config = server.config;
  }

  async analyzeCodebase(args) {
    const { codebasePath, includeGitHistory = true, maxDepth = 10 } = args;
    
    try {
      logger.info(`Starting codebase analysis: ${codebasePath}`);
      
      const analysis = {
        summary: {
          path: codebasePath,
          startTime: new Date().toISOString(),
          filesAnalyzed: 0,
          entitiesFound: 0,
          patternsDetected: 0
        },
        entities: [],
        relationships: [],
        patterns: [],
        gitHistory: null
      };
      
      // Analyze file structure
      const files = await this.discoverFiles(codebasePath, maxDepth);
      logger.info(`Found ${files.length} files to analyze`);
      
      // Analyze each file
      for (const file of files) {
        try {
          const fileAnalysis = await this.analyzeFile(file);
          
          analysis.entities.push(...fileAnalysis.entities);
          analysis.relationships.push(...fileAnalysis.relationships);
          analysis.patterns.push(...fileAnalysis.patterns);
          analysis.summary.filesAnalyzed++;
          
        } catch (error) {
          logger.warn(`Failed to analyze file ${file}:`, error.message);
        }
      }
      
      // Analyze git history if requested
      if (includeGitHistory) {
        try {
          analysis.gitHistory = await this.analyzeGitHistory(codebasePath);
        } catch (error) {
          logger.warn('Failed to analyze git history:', error.message);
        }
      }
      
      // Store analysis results in Kuzu
      await this.storeAnalysisResults(analysis);
      
      analysis.summary.endTime = new Date().toISOString();
      analysis.summary.entitiesFound = analysis.entities.length;
      analysis.summary.patternsDetected = analysis.patterns.length;
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              message: 'Codebase analysis completed',
              summary: analysis.summary,
              entitiesFound: analysis.entities.length,
              patternsDetected: analysis.patterns.length
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error analyzing codebase:', error);
      throw error;
    }
  }

  async discoverFiles(basePath, maxDepth) {
    const { includedExtensions, excludedDirs } = this.config.analysis;
    
    const patterns = includedExtensions.map(ext => 
      `**/*${ext}`
    );
    
    const files = [];
    
    for (const pattern of patterns) {
      const foundFiles = await glob(pattern, {
        cwd: basePath,
        ignore: excludedDirs.map(dir => `**/${dir}/**`),
        absolute: true,
        maxDepth
      });
      files.push(...foundFiles);
    }
    
    return [...new Set(files)];
  }

  async analyzeFile(filePath) {
    const analysis = {
      entities: [],
      relationships: [],
      patterns: []
    };
    
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      
      // Skip if file is too large
      if (content.length > this.config.analysis.maxFileSize) {
        logger.warn(`Skipping large file: ${filePath}`);
        return analysis;
      }
      
      // Parse file based on extension
      const ext = path.extname(filePath);
      
      if (['.js', '.ts', '.jsx', '.tsx'].includes(ext)) {
        await this.analyzeJavaScriptFile(filePath, content, analysis);
      } else if (['.py'].includes(ext)) {
        await this.analyzePythonFile(filePath, content, analysis);
      } else if (['.java'].includes(ext)) {
        await this.analyzeJavaFile(filePath, content, analysis);
      }
      
    } catch (error) {
      logger.warn(`Error analyzing file ${filePath}:`, error.message);
    }
    
    return analysis;
  }

  async analyzeJavaScriptFile(filePath, content, analysis) {
    try {
      const ast = parse(content, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'decorators-legacy'],
        errorRecovery: true
      });
      
      const entities = this.extractEntitiesFromAST(ast, filePath);
      const patterns = this.detectPatternsInCode(ast, filePath);
      
      analysis.entities.push(...entities);
      analysis.patterns.push(...patterns);
      
      // Create relationships between entities
      const relationships = this.inferRelationships(entities);
      analysis.relationships.push(...relationships);
      
    } catch (error) {
      logger.warn(`Failed to parse JavaScript file ${filePath}:`, error.message);
    }
  }

  async analyzePythonFile(filePath, content, analysis) {
    // Basic Python analysis - can be enhanced with Python AST parser
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Simple class detection
      const classMatch = line.match(/^class\s+(\w+)/);
      if (classMatch) {
        analysis.entities.push({
          type: 'class',
          name: classMatch[1],
          filePath,
          language: 'python',
          lineNumber: index + 1
        });
      }
      
      // Simple function detection
      const funcMatch = line.match(/^def\s+(\w+)/);
      if (funcMatch) {
        analysis.entities.push({
          type: 'function',
          name: funcMatch[1],
          filePath,
          language: 'python',
          lineNumber: index + 1
        });
      }
    });
  }

  async analyzeJavaFile(filePath, content, analysis) {
    // Basic Java analysis - can be enhanced with Java AST parser
    const lines = content.split('\n');
    
    lines.forEach((line, index) => {
      // Simple class detection
      const classMatch = line.match(/(?:public\s+)?class\s+(\w+)/);
      if (classMatch) {
        analysis.entities.push({
          type: 'class',
          name: classMatch[1],
          filePath,
          language: 'java',
          lineNumber: index + 1
        });
      }
      
      // Simple method detection
      const methodMatch = line.match(/(?:public|private|protected)\s+(?:static\s+)?\w+\s+(\w+)\s*\(/);
      if (methodMatch) {
        analysis.entities.push({
          type: 'method',
          name: methodMatch[1],
          filePath,
          language: 'java',
          lineNumber: index + 1
        });
      }
    });
  }

  extractEntitiesFromAST(ast, filePath) {
    const entities = [];
    
    traverse.default(ast, {
      ClassDeclaration(path) {
        const entity = {
          type: 'class',
          name: path.node.id.name,
          filePath,
          lineStart: path.node.loc.start.line,
          lineEnd: path.node.loc.end.line,
          methods: [],
          properties: []
        };
        
        // Extract methods and properties
        path.node.body.body.forEach(member => {
          if (member.type === 'MethodDefinition') {
            entity.methods.push({
              name: member.key.name,
              kind: member.kind,
              static: member.static
            });
          }
        });
        
        entities.push(entity);
      },
      
      FunctionDeclaration(path) {
        entities.push({
          type: 'function',
          name: path.node.id.name,
          filePath,
          lineStart: path.node.loc.start.line,
          lineEnd: path.node.loc.end.line,
          params: path.node.params.length,
          async: path.node.async
        });
      },
      
      VariableDeclarator(path) {
        if (path.node.id.type === 'Identifier' && path.node.init) {
          entities.push({
            type: 'variable',
            name: path.node.id.name,
            filePath,
            lineStart: path.node.loc.start.line,
            valueType: path.node.init.type
          });
        }
      }
    });
    
    return entities;
  }

  detectPatternsInCode(ast, filePath) {
    const patterns = [];
    
    // Detect common patterns
    traverse.default(ast, {
      ClassDeclaration(path) {
        // Singleton pattern detection
        if (this.isSingletonPattern(path)) {
          patterns.push({
            type: 'singleton',
            name: 'Singleton Pattern',
            entity: path.node.id.name,
            filePath,
            confidence: 0.8
          });
        }
        
        // Factory pattern detection
        if (this.isFactoryPattern(path)) {
          patterns.push({
            type: 'factory',
            name: 'Factory Pattern',
            entity: path.node.id.name,
            filePath,
            confidence: 0.7
          });
        }
      },
      
      FunctionDeclaration(path) {
        // Higher-order function pattern
        if (this.isHigherOrderFunction(path)) {
          patterns.push({
            type: 'higher_order_function',
            name: 'Higher Order Function',
            entity: path.node.id.name,
            filePath,
            confidence: 0.9
          });
        }
      }
    });
    
    return patterns;
  }

  inferRelationships(entities) {
    const relationships = [];
    
    // Simple relationship inference based on naming and structure
    entities.forEach((entity, index) => {
      entities.slice(index + 1).forEach(otherEntity => {
        if (entity.filePath === otherEntity.filePath) {
          relationships.push({
            from: entity.name,
            to: otherEntity.name,
            type: 'COLOCATED',
            filePath: entity.filePath
          });
        }
      });
    });
    
    return relationships;
  }

  async analyzeGitHistory(codebasePath) {
    const git = simpleGit(codebasePath);
    
    try {
      const log = await git.log({ maxCount: 100 });
      const summary = {
        totalCommits: log.total,
        contributors: [...new Set(log.all.map(commit => commit.author_email))],
        recentActivity: log.all.slice(0, 10).map(commit => ({
          hash: commit.hash,
          message: commit.message,
          author: commit.author_name,
          date: commit.date
        }))
      };
      
      return summary;
    } catch (error) {
      logger.warn('Git analysis failed:', error.message);
      return null;
    }
  }

  async storeAnalysisResults(analysis) {
    try {
      // Store entities
      for (const entity of analysis.entities) {
        const nodeProps = {
          id: `${entity.filePath}:${entity.name}`,
          ...entity,
          analyzedAt: new Date().toISOString()
        };
        
        await this.kuzu.createNode('CodeEntity', nodeProps);
      }
      
      // Store patterns
      for (const pattern of analysis.patterns) {
        const nodeProps = {
          id: `pattern:${pattern.type}:${pattern.entity}`,
          ...pattern,
          detectedAt: new Date().toISOString()
        };
        
        await this.kuzu.createNode('DetectedPattern', nodeProps);
      }
      
      // Store relationships
      for (const rel of analysis.relationships) {
        await this.kuzu.createRelationship(
          `${rel.filePath}:${rel.from}`,
          rel.type,
          `${rel.filePath}:${rel.to}`
        );
      }
      
      logger.info('Analysis results stored in Kuzu');
    } catch (error) {
      logger.error('Failed to store analysis results:', error);
      throw error;
    }
  }

  // Pattern detection helper methods
  isSingletonPattern(classPath) {
    const methods = classPath.node.body.body.filter(m => m.type === 'MethodDefinition');
    const hasGetInstance = methods.some(m => m.key.name === 'getInstance' && m.static);
    const hasPrivateConstructor = methods.some(m => m.key.name === 'constructor' && m.kind === 'constructor');
    
    return hasGetInstance && hasPrivateConstructor;
  }

  isFactoryPattern(classPath) {
    const methods = classPath.node.body.body.filter(m => m.type === 'MethodDefinition');
    const hasCreateMethods = methods.some(m => 
      m.key.name.toLowerCase().includes('create') ||
      m.key.name.toLowerCase().includes('make') ||
      m.key.name.toLowerCase().includes('build')
    );
    
    return hasCreateMethods;
  }

  isHigherOrderFunction(funcPath) {
    // Check if function returns a function or takes a function as parameter
    let returnsFunctionFound = false;
    let takesFunctionParam = false;
    
    // Check parameters
    takesFunctionParam = funcPath.node.params.some(param => 
      param.type === 'Identifier' && 
      (param.name.includes('callback') || param.name.includes('handler'))
    );
    
    // Simple check for function return
    traverse.default(funcPath.node, {
      ReturnStatement(returnPath) {
        if (returnPath.node.argument && 
            (returnPath.node.argument.type === 'FunctionExpression' ||
             returnPath.node.argument.type === 'ArrowFunctionExpression')) {
          returnsFunctionFound = true;
        }
      }
    });
    
    return returnsFunctionFound || takesFunctionParam;
  }
}