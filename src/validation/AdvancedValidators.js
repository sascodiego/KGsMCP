import { logger } from '../utils/logger.js';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

/**
 * CONTEXT: Advanced and domain-specific validators for specialized use cases
 * REASON: Provide deep validation for code analysis, security, and domain-specific scenarios
 * CHANGE: Specialized validators with advanced detection capabilities
 * PREVENTION: Complex attack vectors, domain-specific vulnerabilities, and edge cases
 */

export class AdvancedValidators {
  constructor(config = {}) {
    this.config = {
      enableASTValidation: config.enableASTValidation !== false,
      enableSecurityAnalysis: config.enableSecurityAnalysis !== false,
      enablePerformanceValidation: config.enablePerformanceValidation !== false,
      maxASTNodes: config.maxASTNodes || 10000,
      maxComplexity: config.maxComplexity || 100,
      ...config
    };

    // Security pattern databases
    this.securityPatterns = this.initializeSecurityPatterns();
    this.vulnerabilitySignatures = this.initializeVulnerabilitySignatures();
    this.malwareSignatures = this.initializeMalwareSignatures();
    
    // Performance validation rules
    this.performanceRules = this.initializePerformanceRules();
    
    // Domain-specific validators
    this.domainValidators = new Map();
    this.initializeDomainValidators();

    logger.info('AdvancedValidators initialized', {
      enableASTValidation: this.config.enableASTValidation,
      enableSecurityAnalysis: this.config.enableSecurityAnalysis,
      securityPatternsCount: this.securityPatterns.length,
      domainValidatorsCount: this.domainValidators.size
    });
  }

  /**
   * Advanced code validation using AST analysis
   */
  async validateCodeStructure(codeSnippet, options = {}) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {
        complexity: 0,
        riskLevel: 'LOW',
        astNodes: 0,
        securityIssues: [],
        performanceIssues: []
      }
    };

    if (!this.config.enableASTValidation) {
      return result;
    }

    try {
      // Parse code into AST
      const ast = this.parseCodeSafely(codeSnippet, result);
      if (!ast) return result;

      // Count AST nodes
      result.metadata.astNodes = this.countASTNodes(ast);
      
      if (result.metadata.astNodes > this.config.maxASTNodes) {
        result.errors.push(`Code complexity too high: ${result.metadata.astNodes} nodes > ${this.config.maxASTNodes}`);
        result.isValid = false;
        result.metadata.riskLevel = 'HIGH';
        return result;
      }

      // Security analysis
      if (this.config.enableSecurityAnalysis) {
        await this.performSecurityAnalysis(ast, result);
      }

      // Performance analysis
      if (this.config.enablePerformanceValidation) {
        await this.performPerformanceAnalysis(ast, result);
      }

      // Code quality analysis
      await this.performCodeQualityAnalysis(ast, result);

      // Calculate overall complexity
      result.metadata.complexity = this.calculateCodeComplexity(ast);
      
      if (result.metadata.complexity > this.config.maxComplexity) {
        result.warnings.push(`High code complexity: ${result.metadata.complexity}`);
        if (result.metadata.riskLevel === 'LOW') {
          result.metadata.riskLevel = 'MEDIUM';
        }
      }

    } catch (error) {
      result.errors.push(`Code analysis failed: ${error.message}`);
      result.isValid = false;
      result.metadata.riskLevel = 'HIGH';
    }

    return result;
  }

  /**
   * Advanced security validation
   */
  async validateSecurityThreats(input, context = {}) {
    const result = {
      isValid: true,
      errors: [],
      warnings: [],
      metadata: {
        threatLevel: 'LOW',
        detectedThreats: [],
        recommendedActions: []
      }
    };

    if (!this.config.enableSecurityAnalysis) {
      return result;
    }

    try {
      // Multi-layer security analysis
      await this.analyzeInjectionThreats(input, result);
      await this.analyzeMalwareSignatures(input, result);
      await this.analyzeObfuscationPatterns(input, result);
      await this.analyzeDataExfiltrationPatterns(input, result);
      await this.analyzePrivilegeEscalationPatterns(input, result);

      // Context-aware security analysis
      if (context.userPrivileges) {
        await this.analyzePrivilegeContext(input, context, result);
      }

      // Determine overall threat level
      result.metadata.threatLevel = this.calculateThreatLevel(result.metadata.detectedThreats);

      if (result.metadata.detectedThreats.length > 0) {
        result.metadata.recommendedActions = this.generateSecurityRecommendations(result.metadata.detectedThreats);
      }

    } catch (error) {
      result.errors.push(`Security analysis failed: ${error.message}`);
      result.isValid = false;
      result.metadata.threatLevel = 'CRITICAL';
    }

    return result;
  }

  /**
   * Domain-specific validation
   */
  async validateDomainSpecific(toolName, args, context = {}) {
    const validator = this.domainValidators.get(toolName);
    
    if (!validator) {
      return { isValid: true, errors: [], warnings: [], metadata: {} };
    }

    try {
      return await validator(args, context);
    } catch (error) {
      return {
        isValid: false,
        errors: [`Domain validation failed: ${error.message}`],
        warnings: [],
        metadata: { error: error.message }
      };
    }
  }

  /**
   * Parse code safely with error handling
   */
  parseCodeSafely(codeSnippet, result) {
    try {
      return parse(codeSnippet, {
        sourceType: 'module',
        allowImportExportEverywhere: true,
        allowAwaitOutsideFunction: true,
        allowReturnOutsideFunction: true,
        allowUndeclaredExports: true,
        plugins: [
          'jsx',
          'typescript',
          'decorators-legacy',
          'classProperties',
          'functionBind',
          'exportDefaultFrom',
          'exportNamespaceFrom',
          'dynamicImport',
          'nullishCoalescingOperator',
          'optionalChaining',
          'optionalCatchBinding',
          'topLevelAwait'
        ]
      });
    } catch (parseError) {
      // Try as script instead of module
      try {
        return parse(codeSnippet, {
          sourceType: 'script',
          plugins: ['jsx', 'typescript']
        });
      } catch (scriptError) {
        result.warnings.push(`Code parsing failed: ${parseError.message}`);
        return null;
      }
    }
  }

  /**
   * Count AST nodes for complexity assessment
   */
  countASTNodes(ast) {
    let count = 0;
    
    traverse.default(ast, {
      enter() {
        count++;
      }
    });
    
    return count;
  }

  /**
   * Perform comprehensive security analysis on AST
   */
  async performSecurityAnalysis(ast, result) {
    const securityIssues = [];

    traverse.default(ast, {
      // Detect dangerous function calls
      CallExpression(path) {
        const { callee } = path.node;
        
        if (callee.type === 'Identifier') {
          const dangerousFunctions = [
            'eval', 'Function', 'setTimeout', 'setInterval', 'setImmediate',
            'exec', 'spawn', 'execSync', 'spawnSync'
          ];
          
          if (dangerousFunctions.includes(callee.name)) {
            securityIssues.push({
              type: 'dangerous_function',
              function: callee.name,
              severity: 'HIGH',
              line: path.node.loc?.start.line,
              message: `Dangerous function call: ${callee.name}`
            });
          }
        }
        
        // Check for dynamic code execution patterns
        if (callee.type === 'MemberExpression') {
          const obj = callee.object;
          const prop = callee.property;
          
          if (obj.name === 'document' && prop.name === 'write') {
            securityIssues.push({
              type: 'dom_manipulation',
              severity: 'MEDIUM',
              line: path.node.loc?.start.line,
              message: 'Unsafe DOM manipulation detected'
            });
          }
          
          if (obj.name === 'window' && prop.name === 'eval') {
            securityIssues.push({
              type: 'eval_variant',
              severity: 'HIGH',
              line: path.node.loc?.start.line,
              message: 'Window.eval usage detected'
            });
          }
        }
      },

      // Detect potential XSS vectors
      MemberExpression(path) {
        const { object, property } = path.node;
        
        if (object.name === 'document' || (object.object && object.object.name === 'document')) {
          const dangerousProps = ['innerHTML', 'outerHTML', 'insertAdjacentHTML'];
          
          if (property.name && dangerousProps.includes(property.name)) {
            securityIssues.push({
              type: 'xss_vector',
              property: property.name,
              severity: 'HIGH',
              line: path.node.loc?.start.line,
              message: `Potential XSS vector: ${property.name}`
            });
          }
        }
      },

      // Detect hardcoded credentials or secrets
      StringLiteral(path) {
        const value = path.node.value;
        
        // Check for potential credentials
        const credentialPatterns = [
          /password\s*[:=]\s*["'][^"']+["']/i,
          /api[_-]?key\s*[:=]\s*["'][^"']+["']/i,
          /secret\s*[:=]\s*["'][^"']+["']/i,
          /token\s*[:=]\s*["'][^"']+["']/i,
          /aws[_-]?access[_-]?key/i,
          /private[_-]?key/i
        ];

        for (const pattern of credentialPatterns) {
          if (pattern.test(value)) {
            securityIssues.push({
              type: 'hardcoded_credential',
              severity: 'CRITICAL',
              line: path.node.loc?.start.line,
              message: 'Hardcoded credential detected'
            });
            break;
          }
        }

        // Check for SQL injection patterns
        if (value.includes('SELECT') || value.includes('INSERT') || value.includes('UPDATE') || value.includes('DELETE')) {
          if (value.includes('${') || value.includes('%s') || value.includes('$1')) {
            securityIssues.push({
              type: 'sql_injection_risk',
              severity: 'HIGH',
              line: path.node.loc?.start.line,
              message: 'Potential SQL injection vulnerability'
            });
          }
        }
      },

      // Detect dangerous imports
      ImportDeclaration(path) {
        const source = path.node.source.value;
        const dangerousModules = [
          'child_process', 'fs', 'vm', 'cluster', 'dgram', 'dns', 'net', 'tls'
        ];
        
        if (dangerousModules.includes(source)) {
          securityIssues.push({
            type: 'dangerous_import',
            module: source,
            severity: 'MEDIUM',
            line: path.node.loc?.start.line,
            message: `Potentially dangerous module import: ${source}`
          });
        }
      }
    });

    result.metadata.securityIssues = securityIssues;
    
    // Add errors for critical security issues
    const criticalIssues = securityIssues.filter(issue => issue.severity === 'CRITICAL');
    const highIssues = securityIssues.filter(issue => issue.severity === 'HIGH');
    
    if (criticalIssues.length > 0) {
      result.errors.push(...criticalIssues.map(issue => issue.message));
      result.isValid = false;
      result.metadata.riskLevel = 'CRITICAL';
    } else if (highIssues.length > 0) {
      result.warnings.push(...highIssues.map(issue => issue.message));
      result.metadata.riskLevel = 'HIGH';
    }
  }

  /**
   * Perform performance analysis on AST
   */
  async performPerformanceAnalysis(ast, result) {
    const performanceIssues = [];

    traverse.default(ast, {
      // Detect inefficient loops
      ForStatement(path) {
        const test = path.node.test;
        
        // Check for potential infinite loops
        if (!test) {
          performanceIssues.push({
            type: 'potential_infinite_loop',
            severity: 'HIGH',
            line: path.node.loc?.start.line,
            message: 'Potential infinite loop detected'
          });
        }
        
        // Check for inefficient array operations in loops
        path.traverse({
          CallExpression(innerPath) {
            const { callee } = innerPath.node;
            
            if (callee.type === 'MemberExpression' && 
                callee.property.name === 'indexOf' ||
                callee.property.name === 'includes') {
              performanceIssues.push({
                type: 'inefficient_loop_operation',
                severity: 'MEDIUM',
                line: innerPath.node.loc?.start.line,
                message: 'Inefficient array operation in loop'
              });
            }
          }
        });
      },

      // Detect memory leaks
      FunctionDeclaration(path) {
        let hasSetInterval = false;
        let hasClearInterval = false;
        
        path.traverse({
          CallExpression(innerPath) {
            const { callee } = innerPath.node;
            
            if (callee.type === 'Identifier') {
              if (callee.name === 'setInterval' || callee.name === 'setTimeout') {
                hasSetInterval = true;
              }
              if (callee.name === 'clearInterval' || callee.name === 'clearTimeout') {
                hasClearInterval = true;
              }
            }
          }
        });
        
        if (hasSetInterval && !hasClearInterval) {
          performanceIssues.push({
            type: 'potential_memory_leak',
            severity: 'MEDIUM',
            line: path.node.loc?.start.line,
            message: 'Timer created without cleanup - potential memory leak'
          });
        }
      },

      // Detect blocking operations
      CallExpression(path) {
        const { callee } = path.node;
        
        if (callee.type === 'MemberExpression') {
          const blockingMethods = ['readFileSync', 'writeFileSync', 'execSync'];
          
          if (blockingMethods.includes(callee.property.name)) {
            performanceIssues.push({
              type: 'blocking_operation',
              method: callee.property.name,
              severity: 'MEDIUM',
              line: path.node.loc?.start.line,
              message: `Blocking operation detected: ${callee.property.name}`
            });
          }
        }
      }
    });

    result.metadata.performanceIssues = performanceIssues;
    
    const highIssues = performanceIssues.filter(issue => issue.severity === 'HIGH');
    if (highIssues.length > 0) {
      result.warnings.push(...highIssues.map(issue => issue.message));
      if (result.metadata.riskLevel === 'LOW') {
        result.metadata.riskLevel = 'MEDIUM';
      }
    }
  }

  /**
   * Perform code quality analysis
   */
  async performCodeQualityAnalysis(ast, result) {
    let complexity = 0;
    let nestingDepth = 0;
    let maxNesting = 0;
    const issues = [];

    traverse.default(ast, {
      enter(path) {
        // Track nesting depth
        if (['IfStatement', 'ForStatement', 'WhileStatement', 'DoWhileStatement', 
             'SwitchStatement', 'TryStatement'].includes(path.node.type)) {
          nestingDepth++;
          maxNesting = Math.max(maxNesting, nestingDepth);
          complexity++;
        }
      },
      
      exit(path) {
        if (['IfStatement', 'ForStatement', 'WhileStatement', 'DoWhileStatement', 
             'SwitchStatement', 'TryStatement'].includes(path.node.type)) {
          nestingDepth--;
        }
      },

      FunctionDeclaration(path) {
        const params = path.node.params.length;
        
        if (params > 5) {
          issues.push({
            type: 'too_many_parameters',
            count: params,
            line: path.node.loc?.start.line,
            message: `Function has too many parameters: ${params}`
          });
        }
      },

      ConditionalExpression() {
        complexity++;
      },

      LogicalExpression(path) {
        if (path.node.operator === '&&' || path.node.operator === '||') {
          complexity++;
        }
      }
    });

    if (maxNesting > 4) {
      issues.push({
        type: 'deep_nesting',
        depth: maxNesting,
        message: `Deep nesting detected: ${maxNesting} levels`
      });
    }

    result.metadata.qualityIssues = issues;
    result.metadata.nestingDepth = maxNesting;
    
    if (issues.length > 5) {
      result.warnings.push('Multiple code quality issues detected');
    }
  }

  /**
   * Calculate code complexity
   */
  calculateCodeComplexity(ast) {
    let complexity = 1; // Base complexity
    
    traverse.default(ast, {
      // Control flow statements
      IfStatement() { complexity++; },
      ConditionalExpression() { complexity++; },
      SwitchCase() { complexity++; },
      ForStatement() { complexity++; },
      ForInStatement() { complexity++; },
      ForOfStatement() { complexity++; },
      WhileStatement() { complexity++; },
      DoWhileStatement() { complexity++; },
      CatchClause() { complexity++; },
      
      // Logical operators
      LogicalExpression(path) {
        if (path.node.operator === '&&' || path.node.operator === '||') {
          complexity++;
        }
      },
      
      // Function declarations add to complexity
      FunctionDeclaration() { complexity++; },
      FunctionExpression() { complexity++; },
      ArrowFunctionExpression() { complexity++; }
    });
    
    return complexity;
  }

  /**
   * Analyze injection threats
   */
  async analyzeInjectionThreats(input, result) {
    const inputStr = JSON.stringify(input);
    const threats = [];

    for (const pattern of this.securityPatterns.injection) {
      if (pattern.regex.test(inputStr)) {
        threats.push({
          type: 'injection',
          subtype: pattern.type,
          severity: pattern.severity,
          description: pattern.description,
          pattern: pattern.name
        });
      }
    }

    if (threats.length > 0) {
      result.metadata.detectedThreats.push(...threats);
      
      const criticalThreats = threats.filter(t => t.severity === 'CRITICAL');
      if (criticalThreats.length > 0) {
        result.errors.push(...criticalThreats.map(t => t.description));
        result.isValid = false;
      } else {
        result.warnings.push(...threats.map(t => t.description));
      }
    }
  }

  /**
   * Analyze malware signatures
   */
  async analyzeMalwareSignatures(input, result) {
    const inputStr = JSON.stringify(input);
    const detected = [];

    for (const signature of this.malwareSignatures) {
      if (signature.regex.test(inputStr)) {
        detected.push({
          type: 'malware',
          name: signature.name,
          severity: 'CRITICAL',
          description: `Malware signature detected: ${signature.name}`
        });
      }
    }

    if (detected.length > 0) {
      result.metadata.detectedThreats.push(...detected);
      result.errors.push(...detected.map(d => d.description));
      result.isValid = false;
    }
  }

  /**
   * Analyze obfuscation patterns
   */
  async analyzeObfuscationPatterns(input, result) {
    const inputStr = JSON.stringify(input);
    const patterns = [
      {
        name: 'Base64 encoding',
        regex: /[A-Za-z0-9+/]{40,}={0,2}/,
        severity: 'MEDIUM'
      },
      {
        name: 'Hex encoding',
        regex: /\\x[0-9A-Fa-f]{2}{10,}/,
        severity: 'MEDIUM'
      },
      {
        name: 'Unicode escapes',
        regex: /\\u[0-9A-Fa-f]{4}{5,}/,
        severity: 'MEDIUM'
      },
      {
        name: 'Excessive string concatenation',
        regex: /["'][^"']*["']\s*\+\s*["'][^"']*["'](\s*\+\s*["'][^"']*["']){3,}/,
        severity: 'HIGH'
      }
    ];

    const detected = [];
    
    for (const pattern of patterns) {
      if (pattern.regex.test(inputStr)) {
        detected.push({
          type: 'obfuscation',
          name: pattern.name,
          severity: pattern.severity,
          description: `Obfuscation pattern detected: ${pattern.name}`
        });
      }
    }

    if (detected.length > 0) {
      result.metadata.detectedThreats.push(...detected);
      result.warnings.push(...detected.map(d => d.description));
    }
  }

  /**
   * Analyze data exfiltration patterns
   */
  async analyzeDataExfiltrationPatterns(input, result) {
    const inputStr = JSON.stringify(input);
    const patterns = [
      {
        name: 'External HTTP requests',
        regex: /https?:\/\/(?!localhost|127\.0\.0\.1|0\.0\.0\.0)/i,
        severity: 'MEDIUM'
      },
      {
        name: 'Base64 data transmission',
        regex: /btoa\s*\(|atob\s*\(/,
        severity: 'MEDIUM'
      },
      {
        name: 'WebSocket connections',
        regex: /new\s+WebSocket\s*\(/,
        severity: 'MEDIUM'
      },
      {
        name: 'XMLHttpRequest usage',
        regex: /new\s+XMLHttpRequest\s*\(/,
        severity: 'LOW'
      }
    ];

    const detected = [];
    
    for (const pattern of patterns) {
      if (pattern.regex.test(inputStr)) {
        detected.push({
          type: 'data_exfiltration',
          name: pattern.name,
          severity: pattern.severity,
          description: `Data exfiltration pattern detected: ${pattern.name}`
        });
      }
    }

    if (detected.length > 0) {
      result.metadata.detectedThreats.push(...detected);
      
      const highSeverity = detected.filter(d => d.severity === 'HIGH');
      if (highSeverity.length > 0) {
        result.warnings.push(...highSeverity.map(d => d.description));
      }
    }
  }

  /**
   * Analyze privilege escalation patterns
   */
  async analyzePrivilegeEscalationPatterns(input, result) {
    const inputStr = JSON.stringify(input);
    const patterns = [
      {
        name: 'Process execution',
        regex: /exec\s*\(|spawn\s*\(|system\s*\(/,
        severity: 'HIGH'
      },
      {
        name: 'File system access',
        regex: /readFile|writeFile|unlink|rmdir/,
        severity: 'MEDIUM'
      },
      {
        name: 'Environment variable access',
        regex: /process\.env|getenv/,
        severity: 'LOW'
      }
    ];

    const detected = [];
    
    for (const pattern of patterns) {
      if (pattern.regex.test(inputStr)) {
        detected.push({
          type: 'privilege_escalation',
          name: pattern.name,
          severity: pattern.severity,
          description: `Privilege escalation pattern detected: ${pattern.name}`
        });
      }
    }

    if (detected.length > 0) {
      result.metadata.detectedThreats.push(...detected);
      result.warnings.push(...detected.map(d => d.description));
    }
  }

  /**
   * Analyze privilege context
   */
  async analyzePrivilegeContext(input, context, result) {
    const userPrivileges = context.userPrivileges || [];
    const requiredPrivileges = this.extractRequiredPrivileges(input);
    
    const missingPrivileges = requiredPrivileges.filter(req => 
      !userPrivileges.includes(req)
    );

    if (missingPrivileges.length > 0) {
      result.warnings.push(`Missing required privileges: ${missingPrivileges.join(', ')}`);
      result.metadata.detectedThreats.push({
        type: 'privilege_violation',
        missingPrivileges,
        severity: 'HIGH',
        description: 'Operation requires privileges not granted to user'
      });
    }
  }

  /**
   * Extract required privileges from input
   */
  extractRequiredPrivileges(input) {
    const inputStr = JSON.stringify(input);
    const privileges = [];

    if (/readFile|writeFile|fs\./i.test(inputStr)) {
      privileges.push('file_system');
    }
    
    if (/exec|spawn|child_process/i.test(inputStr)) {
      privileges.push('process_execution');
    }
    
    if (/https?:\/\//i.test(inputStr)) {
      privileges.push('network_access');
    }

    return privileges;
  }

  /**
   * Calculate overall threat level
   */
  calculateThreatLevel(threats) {
    if (threats.some(t => t.severity === 'CRITICAL')) return 'CRITICAL';
    if (threats.some(t => t.severity === 'HIGH')) return 'HIGH';
    if (threats.some(t => t.severity === 'MEDIUM')) return 'MEDIUM';
    if (threats.length > 0) return 'LOW';
    return 'MINIMAL';
  }

  /**
   * Generate security recommendations
   */
  generateSecurityRecommendations(threats) {
    const recommendations = [];
    const threatTypes = [...new Set(threats.map(t => t.type))];

    for (const type of threatTypes) {
      switch (type) {
        case 'injection':
          recommendations.push({
            type: 'security',
            action: 'Implement input sanitization and parameterized queries',
            priority: 'HIGH'
          });
          break;
        case 'malware':
          recommendations.push({
            type: 'security',
            action: 'Block execution and quarantine input for analysis',
            priority: 'CRITICAL'
          });
          break;
        case 'obfuscation':
          recommendations.push({
            type: 'security',
            action: 'Review code for legitimate use of encoding techniques',
            priority: 'MEDIUM'
          });
          break;
        case 'data_exfiltration':
          recommendations.push({
            type: 'security',
            action: 'Monitor network activity and validate external connections',
            priority: 'HIGH'
          });
          break;
        case 'privilege_escalation':
          recommendations.push({
            type: 'security',
            action: 'Verify user permissions and implement privilege controls',
            priority: 'HIGH'
          });
          break;
      }
    }

    return recommendations;
  }

  /**
   * Initialize security patterns database
   */
  initializeSecurityPatterns() {
    return {
      injection: [
        {
          name: 'SQL Injection',
          type: 'sql_injection',
          regex: /['"]?\s*(UNION|SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC)\s+/i,
          severity: 'CRITICAL',
          description: 'Potential SQL injection attack detected'
        },
        {
          name: 'Command Injection',
          type: 'command_injection',
          regex: /[;&|`$()]/,
          severity: 'HIGH',
          description: 'Potential command injection attack detected'
        },
        {
          name: 'LDAP Injection',
          type: 'ldap_injection',
          regex: /[()&|!]/,
          severity: 'HIGH',
          description: 'Potential LDAP injection attack detected'
        },
        {
          name: 'XPath Injection',
          type: 'xpath_injection',
          regex: /['"\s]*(\[|\]|and|or|not|text\(\)|node\(\))/i,
          severity: 'HIGH',
          description: 'Potential XPath injection attack detected'
        }
      ]
    };
  }

  /**
   * Initialize vulnerability signatures
   */
  initializeVulnerabilitySignatures() {
    return [
      {
        name: 'Buffer Overflow',
        regex: /A{100,}|0x[0-9A-Fa-f]{100,}/,
        severity: 'HIGH'
      },
      {
        name: 'Format String',
        regex: /%[dioxX]|%[cdiouxX]/g,
        severity: 'MEDIUM'
      },
      {
        name: 'Path Traversal',
        regex: /\.\.[\/\\]/,
        severity: 'HIGH'
      }
    ];
  }

  /**
   * Initialize malware signatures
   */
  initializeMalwareSignatures() {
    return [
      {
        name: 'Suspicious PowerShell',
        regex: /powershell.*-encodedcommand/i
      },
      {
        name: 'Encoded Payload',
        regex: /eval\s*\(\s*atob\s*\(/i
      },
      {
        name: 'Reverse Shell',
        regex: /nc\s+-l\s+-p\s+\d+|\/bin\/sh.*>&/i
      }
    ];
  }

  /**
   * Initialize performance rules
   */
  initializePerformanceRules() {
    return [
      {
        name: 'Nested Loops',
        check: (ast) => this.checkNestedLoops(ast),
        severity: 'MEDIUM'
      },
      {
        name: 'Memory Leaks',
        check: (ast) => this.checkMemoryLeaks(ast),
        severity: 'HIGH'
      }
    ];
  }

  /**
   * Initialize domain validators
   */
  initializeDomainValidators() {
    // Arduino/IoT specific validator
    this.domainValidators.set('arduino_constraints', async (args, context) => {
      const result = { isValid: true, errors: [], warnings: [], metadata: {} };
      
      if (args.targetBoard) {
        const boardLimits = {
          'uno': { ram: 2048, flash: 32768 },
          'nano': { ram: 2048, flash: 32768 },
          'mega2560': { ram: 8192, flash: 262144 },
          'esp32': { ram: 520000, flash: 4194304 }
        };
        
        const limits = boardLimits[args.targetBoard];
        if (limits && args.memoryUsage) {
          if (args.memoryUsage.ram > limits.ram) {
            result.errors.push(`RAM usage exceeds board limit: ${args.memoryUsage.ram} > ${limits.ram}`);
            result.isValid = false;
          }
          
          if (args.memoryUsage.flash > limits.flash) {
            result.errors.push(`Flash usage exceeds board limit: ${args.memoryUsage.flash} > ${limits.flash}`);
            result.isValid = false;
          }
        }
      }
      
      return result;
    });

    // Git analysis validator
    this.domainValidators.set('git_safety', async (args, context) => {
      const result = { isValid: true, errors: [], warnings: [], metadata: {} };
      
      if (args.includeGitHistory && args.maxDepth > 1000) {
        result.warnings.push('Deep git history analysis may impact performance');
      }
      
      return result;
    });

    // File path security validator
    this.domainValidators.set('path_security', async (args, context) => {
      const result = { isValid: true, errors: [], warnings: [], metadata: {} };
      
      ['filePath', 'codebasePath', 'sketchPath'].forEach(pathField => {
        if (args[pathField]) {
          if (args[pathField].includes('..')) {
            result.errors.push(`Path traversal detected in ${pathField}`);
            result.isValid = false;
          }
          
          if (args[pathField].startsWith('/proc') || args[pathField].startsWith('/sys')) {
            result.errors.push(`Access to system paths not allowed: ${pathField}`);
            result.isValid = false;
          }
        }
      });
      
      return result;
    });
  }

  /**
   * Add custom domain validator
   */
  addDomainValidator(name, validator) {
    if (typeof validator !== 'function') {
      throw new Error('Domain validator must be a function');
    }
    
    this.domainValidators.set(name, validator);
    logger.debug('Custom domain validator added', { name });
  }

  /**
   * Get validation statistics
   */
  getStatistics() {
    return {
      securityPatternsCount: this.securityPatterns.injection.length,
      vulnerabilitySignaturesCount: this.vulnerabilitySignatures.length,
      malwareSignaturesCount: this.malwareSignatures.length,
      domainValidatorsCount: this.domainValidators.size,
      config: this.config
    };
  }
}

export default AdvancedValidators;