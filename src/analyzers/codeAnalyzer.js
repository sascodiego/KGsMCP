/**
 * CONTEXT: Enhanced CodeAnalyzer with GitAnalyzer integration
 * REASON: Combine static code analysis with Git historical insights for comprehensive understanding
 * CHANGE: Added Git integration and enhanced analysis capabilities
 * PREVENTION: Missing historical context in code analysis
 */
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';
import { CppAnalyzer } from './cppAnalyzer.js';

export class CodeAnalyzer {
  constructor(config = {}) {
    this.config = {
      maxComplexity: config.maxComplexity || 10,
      maxFunctionLength: config.maxFunctionLength || 50,
      maxClassSize: config.maxClassSize || 200,
      maxFileSize: config.maxFileSize || 1048576,
      enableGitIntegration: config.enableGitIntegration || false,
      ...config
    };
    
    // Initialize specialized analyzers
    this.cppAnalyzer = new CppAnalyzer(config);
    this.gitAnalyzer = null; // Will be set if Git integration is enabled
    
    // Language configurations
    this.languageConfigs = {
      javascript: {
        extensions: ['.js', '.jsx', '.mjs'],
        plugins: ['jsx', 'asyncGenerators', 'functionBind', 'decorators-legacy', 'doExpressions', 'objectRestSpread', 'functionSent', 'exportDefaultFrom', 'throwExpressions', 'dynamicImport', 'numericSeparator', 'optionalChaining', 'importMeta', 'bigInt', 'optionalCatchBinding', 'exportNamespaceFrom', 'nullishCoalescingOperator']
      },
      typescript: {
        extensions: ['.ts', '.tsx'],
        plugins: ['typescript', 'jsx', 'decorators-legacy', 'asyncGenerators', 'functionBind', 'doExpressions', 'objectRestSpread', 'functionSent', 'exportDefaultFrom', 'throwExpressions', 'dynamicImport', 'numericSeparator', 'optionalChaining', 'importMeta', 'bigInt', 'optionalCatchBinding', 'exportNamespaceFrom', 'nullishCoalescingOperator']
      }
    };
  }

  /**
   * Set GitAnalyzer instance for enhanced analysis with Git context
   */
  setGitAnalyzer(gitAnalyzer) {
    this.gitAnalyzer = gitAnalyzer;
    this.config.enableGitIntegration = true;
    logger.info('Git integration enabled for CodeAnalyzer');
  }

  async analyzeFile(filePath, content = null) {
    try {
      const fileContent = content || await this.readFile(filePath);
      const language = this.detectLanguage(filePath);
      
      if (fileContent.length > this.config.maxFileSize) {
        logger.warn(`Skipping large file: ${filePath} (${fileContent.length} bytes)`);
        return this.createEmptyAnalysis(filePath, language);
      }

      return await this.analyzeCode(fileContent, filePath, language);
    } catch (error) {
      logger.error(`Error analyzing file ${filePath}:`, error);
      return this.createEmptyAnalysis(filePath, 'unknown');
    }
  }

  async readFile(filePath) {
    return await fs.readFile(filePath, 'utf-8');
  }

  detectLanguage(filePath) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (['.ts', '.tsx'].includes(ext)) return 'typescript';
    if (['.js', '.jsx', '.mjs'].includes(ext)) return 'javascript';
    if (['.py'].includes(ext)) return 'python';
    if (['.cpp', '.cc', '.cxx', '.c++'].includes(ext)) return 'cpp';
    if (['.c', '.h'].includes(ext)) return 'c';
    if (['.java'].includes(ext)) return 'java';
    if (['.ino', '.pde'].includes(ext)) return 'arduino';
    
    return 'unknown';
  }

  createEmptyAnalysis(filePath, language) {
    return {
      filePath,
      language,
      entities: [],
      imports: [],
      exports: [],
      dependencies: [],
      metrics: {
        linesOfCode: 0,
        complexity: 0,
        maintainabilityIndex: 0
      },
      structuredComments: [],
      issues: [],
      patterns: [],
      errors: []
    };
  }

  async analyzeCode(code, filePath, language = 'javascript') {
    try {
      switch (language) {
        case 'javascript':
        case 'typescript':
          return await this.analyzeJavaScript(code, filePath);
        case 'python':
          return await this.analyzePython(code, filePath);
        case 'cpp':
        case 'c++':
        case 'arduino':
          return await this.cppAnalyzer.analyzeFile(filePath);
        default:
          return this.analyzeGeneric(code, filePath);
      }
    } catch (error) {
      logger.error(`Error analyzing code in ${filePath}:`, error);
      return {
        entities: [],
        metrics: {},
        issues: [],
        patterns: []
      };
    }
  }

  async analyzeJavaScript(code, filePath) {
    const ast = parse(code, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript', 'decorators-legacy'],
      errorRecovery: true
    });

    const analysis = {
      entities: [],
      metrics: {
        linesOfCode: code.split('\n').length,
        complexity: 0,
        maintainabilityIndex: 0
      },
      issues: [],
      patterns: []
    };

    // Extract entities and calculate metrics
    traverse.default(ast, {
      FunctionDeclaration: (path) => {
        const func = this.analyzeFunctionDeclaration(path, filePath);
        analysis.entities.push(func.entity);
        analysis.metrics.complexity += func.complexity;
        analysis.issues.push(...func.issues);
      },

      ClassDeclaration: (path) => {
        const cls = this.analyzeClassDeclaration(path, filePath);
        analysis.entities.push(cls.entity);
        analysis.issues.push(...cls.issues);
      },

      VariableDeclarator: (path) => {
        const variable = this.analyzeVariable(path, filePath);
        if (variable) {
          analysis.entities.push(variable);
        }
      }
    });

    // Calculate maintainability index
    analysis.metrics.maintainabilityIndex = this.calculateMaintainabilityIndex(analysis);

    return analysis;
  }

  analyzeFunctionDeclaration(path, filePath) {
    const node = path.node;
    const entity = {
      type: 'function',
      name: node.id.name,
      filePath,
      lineStart: node.loc.start.line,
      lineEnd: node.loc.end.line,
      params: node.params.length,
      async: node.async,
      generator: node.generator
    };

    const complexity = this.calculateCyclomaticComplexity(path);
    const lineCount = node.loc.end.line - node.loc.start.line + 1;

    const issues = [];
    
    // Check for issues
    if (complexity > this.config.maxComplexity) {
      issues.push({
        type: 'complexity',
        severity: 'high',
        message: `High cyclomatic complexity: ${complexity}`,
        line: node.loc.start.line,
        entity: node.id.name
      });
    }

    if (lineCount > this.config.maxFunctionLength) {
      issues.push({
        type: 'length',
        severity: 'medium',
        message: `Function too long: ${lineCount} lines`,
        line: node.loc.start.line,
        entity: node.id.name
      });
    }

    return {
      entity,
      complexity,
      issues
    };
  }

  analyzeClassDeclaration(path, filePath) {
    const node = path.node;
    const methods = node.body.body.filter(m => m.type === 'MethodDefinition');
    
    const entity = {
      type: 'class',
      name: node.id.name,
      filePath,
      lineStart: node.loc.start.line,
      lineEnd: node.loc.end.line,
      methodCount: methods.length,
      methods: methods.map(m => ({
        name: m.key.name,
        kind: m.kind,
        static: m.static,
        async: m.value.async
      }))
    };

    const issues = [];
    const lineCount = node.loc.end.line - node.loc.start.line + 1;

    if (lineCount > this.config.maxClassSize) {
      issues.push({
        type: 'size',
        severity: 'high',
        message: `Class too large: ${lineCount} lines`,
        line: node.loc.start.line,
        entity: node.id.name
      });
    }

    if (methods.length > 15) {
      issues.push({
        type: 'responsibility',
        severity: 'medium',
        message: `Too many methods: ${methods.length}`,
        line: node.loc.start.line,
        entity: node.id.name
      });
    }

    return {
      entity,
      issues
    };
  }

  analyzeVariable(path, filePath) {
    const node = path.node;
    
    if (node.id.type === 'Identifier' && node.init) {
      return {
        type: 'variable',
        name: node.id.name,
        filePath,
        lineStart: node.loc.start.line,
        valueType: node.init.type,
        constant: path.parent.kind === 'const'
      };
    }

    return null;
  }

  calculateCyclomaticComplexity(path) {
    let complexity = 1; // Base complexity

    traverse.default(path.node, {
      IfStatement: () => complexity++,
      ConditionalExpression: () => complexity++,
      LogicalExpression: (subPath) => {
        if (subPath.node.operator === '&&' || subPath.node.operator === '||') {
          complexity++;
        }
      },
      ForStatement: () => complexity++,
      ForInStatement: () => complexity++,
      ForOfStatement: () => complexity++,
      WhileStatement: () => complexity++,
      DoWhileStatement: () => complexity++,
      SwitchCase: (subPath) => {
        if (subPath.node.test) complexity++; // Don't count default case
      },
      CatchClause: () => complexity++
    });

    return complexity;
  }

  async analyzePython(code, filePath) {
    // Basic Python analysis - would need python-ast parser for full analysis
    const lines = code.split('\n');
    const analysis = {
      entities: [],
      metrics: {
        linesOfCode: lines.length,
        complexity: 0,
        maintainabilityIndex: 0.8 // Default estimate
      },
      issues: [],
      patterns: []
    };

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      
      // Class detection
      const classMatch = trimmed.match(/^class\s+(\w+)/);
      if (classMatch) {
        analysis.entities.push({
          type: 'class',
          name: classMatch[1],
          filePath,
          lineStart: index + 1,
          language: 'python'
        });
      }

      // Function detection
      const funcMatch = trimmed.match(/^def\s+(\w+)/);
      if (funcMatch) {
        analysis.entities.push({
          type: 'function',
          name: funcMatch[1],
          filePath,
          lineStart: index + 1,
          language: 'python'
        });
      }

      // Basic complexity indicators
      if (trimmed.match(/^(if|elif|for|while|try|except|with)/)) {
        analysis.metrics.complexity++;
      }
    });

    return analysis;
  }

  analyzeGeneric(code, filePath) {
    const lines = code.split('\n');
    return {
      entities: [],
      metrics: {
        linesOfCode: lines.length,
        complexity: 0,
        maintainabilityIndex: 0.5
      },
      issues: [],
      patterns: []
    };
  }

  calculateMaintainabilityIndex(analysis) {
    const { linesOfCode, complexity } = analysis.metrics;
    const issueCount = analysis.issues.length;
    
    // Simplified maintainability index calculation
    let index = 100;
    
    // Deduct for complexity
    index -= Math.min(complexity * 2, 30);
    
    // Deduct for size
    index -= Math.min(linesOfCode / 10, 20);
    
    // Deduct for issues
    index -= issueCount * 5;
    
    return Math.max(0, Math.min(100, index));
  }

  extractDependencies(ast) {
    const dependencies = [];
    
    traverse.default(ast, {
      ImportDeclaration: (path) => {
        dependencies.push({
          type: 'import',
          source: path.node.source.value,
          specifiers: path.node.specifiers.map(s => ({
            type: s.type,
            local: s.local.name,
            imported: s.imported?.name
          }))
        });
      },

      CallExpression: (path) => {
        if (path.node.callee.name === 'require' && 
            path.node.arguments[0]?.type === 'StringLiteral') {
          dependencies.push({
            type: 'require',
            source: path.node.arguments[0].value
          });
        }
      }
    });

    return dependencies;
  }

  detectCodeSmells(analysis) {
    const smells = [];

    // Large class smell
    const largeClasses = analysis.entities.filter(e => 
      e.type === 'class' && (e.lineEnd - e.lineStart) > 200
    );
    
    largeClasses.forEach(cls => {
      smells.push({
        type: 'large_class',
        entity: cls.name,
        severity: 'medium',
        description: 'Class is too large and may have too many responsibilities'
      });
    });

    // Long method smell
    const longMethods = analysis.entities.filter(e => 
      e.type === 'function' && (e.lineEnd - e.lineStart) > 50
    );
    
    longMethods.forEach(method => {
      smells.push({
        type: 'long_method',
        entity: method.name,
        severity: 'medium',
        description: 'Method is too long and should be broken down'
      });
    });

    return smells;
  }
}