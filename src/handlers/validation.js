import { logger } from '../utils/logger.js';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

export class ValidationHandler {
  constructor(server) {
    this.server = server;
    this.kuzu = server.kuzu;
  }

  async validateAgainstKG(args) {
    const { codeSnippet, validationTypes = ['patterns', 'rules', 'standards'], strictMode = true } = args;
    
    try {
      const validationResults = {};
      
      // Parse code snippet
      const ast = parse(codeSnippet, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'decorators-legacy']
      });
      
      // Extract code characteristics
      const codeCharacteristics = this.extractCodeCharacteristics(ast);
      
      // Validate against each type
      for (const validationType of validationTypes) {
        switch (validationType) {
          case 'patterns':
            validationResults.patterns = await this.validatePatterns(codeCharacteristics, strictMode);
            break;
          case 'rules':
            validationResults.rules = await this.validateRules(codeCharacteristics, strictMode);
            break;
          case 'standards':
            validationResults.standards = await this.validateStandards(codeCharacteristics, strictMode);
            break;
        }
      }
      
      const overallScore = this.calculateOverallScore(validationResults);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              codeSnippet: codeSnippet.substring(0, 200) + '...',
              validationResults,
              overallScore,
              strictMode,
              recommendations: this.generateRecommendations(validationResults)
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error validating against KG:', error);
      throw error;
    }
  }

  async detectTechnicalDebt(args) {
    const { scope, target, debtTypes = ['complexity', 'duplication', 'coupling'] } = args;
    
    try {
      let query;
      let params;
      
      switch (scope) {
        case 'module':
          query = `
            MATCH (e:CodeEntity)
            WHERE e.filePath CONTAINS $target
            OPTIONAL MATCH (e)-[:HAS_ISSUE]->(debt:TechnicalDebt)
            WHERE debt.type IN $debtTypes
            RETURN {
              module: $target,
              entities: collect(DISTINCT {name: e.name, type: e.type}),
              debts: collect(DISTINCT {
                type: debt.type,
                severity: debt.severity,
                description: debt.description,
                entity: e.name
              })
            } as analysis
          `;
          params = { target, debtTypes };
          break;
          
        case 'project':
          query = `
            MATCH (debt:TechnicalDebt)
            WHERE debt.type IN $debtTypes
            OPTIONAL MATCH (e:CodeEntity)-[:HAS_ISSUE]->(debt)
            RETURN {
              project: "entire",
              totalDebtItems: count(DISTINCT debt),
              byType: collect(DISTINCT {
                type: debt.type,
                count: size((debt)<-[:HAS_ISSUE]-())
              }),
              byModule: collect(DISTINCT {
                module: split(e.filePath, '/')[0],
                debts: count(debt)
              })
            } as analysis
          `;
          params = { debtTypes };
          break;
          
        case 'specific':
          query = `
            MATCH (e:CodeEntity {name: $target})
            OPTIONAL MATCH (e)-[:HAS_ISSUE]->(debt:TechnicalDebt)
            WHERE debt.type IN $debtTypes
            RETURN {
              entity: {name: e.name, type: e.type, filePath: e.filePath},
              debts: collect(DISTINCT {
                type: debt.type,
                severity: debt.severity,
                description: debt.description,
                impact: debt.impact
              })
            } as analysis
          `;
          params = { target, debtTypes };
          break;
      }
      
      const result = await this.kuzu.query(query, params);
      const analysis = result[0]?.analysis || {};
      
      const debtAnalysis = this.analyzeDebtResults(analysis, scope, debtTypes);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              scope,
              target,
              debtTypes,
              analysis: debtAnalysis,
              recommendations: this.generateDebtRecommendations(debtAnalysis)
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error detecting technical debt:', error);
      throw error;
    }
  }

  extractCodeCharacteristics(ast) {
    const characteristics = {
      functions: [],
      classes: [],
      variables: [],
      imports: [],
      complexity: 0,
      patterns: [],
      maxNestingLevel: 0,
      maxLineLength: 0,
      hasEval: false,
      hasInnerHTML: false,
      unusedVariables: []
    };
    
    let currentNestingLevel = 0;
    const declaredVariables = new Set();
    const usedVariables = new Set();
    
    traverse.default(ast, {
      enter(path) {
        // Track nesting level
        if (['IfStatement', 'ForStatement', 'WhileStatement', 'DoWhileStatement', 'SwitchStatement'].includes(path.node.type)) {
          currentNestingLevel++;
          characteristics.maxNestingLevel = Math.max(characteristics.maxNestingLevel, currentNestingLevel);
        }
        
        // Check for security issues
        if (path.node.type === 'CallExpression' && path.node.callee && path.node.callee.name === 'eval') {
          characteristics.hasEval = true;
        }
        
        if (path.node.type === 'MemberExpression' && path.node.property && path.node.property.name === 'innerHTML') {
          characteristics.hasInnerHTML = true;
        }
      },
      
      exit(path) {
        // Track nesting level
        if (['IfStatement', 'ForStatement', 'WhileStatement', 'DoWhileStatement', 'SwitchStatement'].includes(path.node.type)) {
          currentNestingLevel--;
        }
      },
      
      FunctionDeclaration(path) {
        const startLine = path.node.loc ? path.node.loc.start.line : 0;
        const endLine = path.node.loc ? path.node.loc.end.line : 0;
        const linesOfCode = endLine - startLine + 1;
        
        // Check for documentation
        const hasDocumentation = path.node.leadingComments && 
          path.node.leadingComments.some(comment => comment.value.includes('*'));
        
        characteristics.functions.push({
          name: path.node.id ? path.node.id.name : 'anonymous',
          params: path.node.params.length,
          async: path.node.async,
          linesOfCode: linesOfCode,
          hasDocumentation: hasDocumentation
        });
      },
      
      FunctionExpression(path) {
        characteristics.functions.push({
          name: path.node.id ? path.node.id.name : 'anonymous',
          params: path.node.params.length,
          async: path.node.async,
          linesOfCode: 1,
          hasDocumentation: false
        });
      },
      
      ArrowFunctionExpression(path) {
        characteristics.functions.push({
          name: 'arrow_function',
          params: path.node.params.length,
          async: path.node.async,
          linesOfCode: 1,
          hasDocumentation: false
        });
      },
      
      ClassDeclaration(path) {
        const methods = path.node.body.body.filter(m => m.type === 'MethodDefinition').length;
        
        characteristics.classes.push({
          name: path.node.id.name,
          methods: methods
        });
      },
      
      VariableDeclarator(path) {
        if (path.node.id && path.node.id.name) {
          const isConstant = path.parent.kind === 'const';
          declaredVariables.add(path.node.id.name);
          
          characteristics.variables.push({
            name: path.node.id.name,
            isConstant: isConstant,
            hasInitializer: !!path.node.init
          });
        }
      },
      
      Identifier(path) {
        // Track variable usage (simplified)
        if (path.isReferencedIdentifier()) {
          usedVariables.add(path.node.name);
        }
      },
      
      ImportDeclaration(path) {
        characteristics.imports.push({
          source: path.node.source.value,
          specifiers: path.node.specifiers.length
        });
      },
      
      IfStatement() {
        characteristics.complexity++;
      },
      
      ForStatement() {
        characteristics.complexity++;
      },
      
      WhileStatement() {
        characteristics.complexity++;
      },
      
      DoWhileStatement() {
        characteristics.complexity++;
      },
      
      SwitchCase() {
        characteristics.complexity++;
      },
      
      ConditionalExpression() {
        characteristics.complexity++;
      },
      
      LogicalExpression(path) {
        if (path.node.operator === '&&' || path.node.operator === '||') {
          characteristics.complexity++;
        }
      }
    });
    
    // Find unused variables
    characteristics.unusedVariables = Array.from(declaredVariables)
      .filter(variable => !usedVariables.has(variable));
    
    return characteristics;
  }

  async validatePatterns(characteristics, strictMode) {
    const query = `
      MATCH (p:Pattern)
      RETURN p.name as name, p.rules as rules, p.antipatterns as antipatterns
    `;
    
    const patterns = await this.kuzu.query(query);
    const violations = [];
    const matches = [];
    
    // Simple pattern matching logic
    for (const pattern of patterns) {
      if (pattern.rules) {
        const ruleMatches = this.checkPatternRules(characteristics, pattern.rules);
        if (ruleMatches.violations.length === 0) {
          matches.push(pattern.name);
        } else if (strictMode) {
          violations.push(...ruleMatches.violations);
        }
      }
    }
    
    return {
      matches,
      violations,
      score: violations.length === 0 ? 1.0 : Math.max(0, 1 - (violations.length * 0.2))
    };
  }

  async validateRules(characteristics, strictMode) {
    const query = `
      MATCH (r:Rule)
      RETURN r.description as description, r.type as type, r.severity as severity
    `;
    
    const rules = await this.kuzu.query(query);
    const violations = [];
    
    for (const rule of rules) {
      const violation = this.checkRule(characteristics, rule);
      if (violation && (strictMode || rule.severity === 'critical')) {
        violations.push(violation);
      }
    }
    
    return {
      violations,
      score: violations.length === 0 ? 1.0 : Math.max(0, 1 - (violations.length * 0.15))
    };
  }

  async validateStandards(characteristics, strictMode) {
    const query = `
      MATCH (s:Standard)
      RETURN s.name as name, s.value as value, s.type as type
    `;
    
    const standards = await this.kuzu.query(query);
    const violations = [];
    
    for (const standard of standards) {
      const violation = this.checkStandard(characteristics, standard);
      if (violation && strictMode) {
        violations.push(violation);
      }
    }
    
    return {
      violations,
      score: violations.length === 0 ? 1.0 : Math.max(0, 1 - (violations.length * 0.1))
    };
  }

  checkPatternRules(characteristics, rules) {
    // Simplified rule checking logic
    const violations = [];
    
    if (rules.includes('single_responsibility') && characteristics.classes.length > 0) {
      const largeClasses = characteristics.classes.filter(c => c.methods > 10);
      if (largeClasses.length > 0) {
        violations.push({
          type: 'pattern_violation',
          message: 'Large classes detected, may violate Single Responsibility Principle',
          entities: largeClasses.map(c => c.name)
        });
      }
    }
    
    return { violations };
  }

  checkRule(characteristics, rule) {
    // Enhanced rule checking with multiple rule types
    switch (rule.type) {
      case 'complexity':
        if (characteristics.complexity > 10) {
          return {
            type: 'rule_violation',
            rule: rule.description,
            severity: rule.severity,
            message: `High cyclomatic complexity detected: ${characteristics.complexity}`,
            suggestion: 'Consider breaking down complex functions into smaller, more focused functions'
          };
        }
        break;
        
      case 'function_length':
        const longFunctions = characteristics.functions.filter(f => f.linesOfCode > 50);
        if (longFunctions.length > 0) {
          return {
            type: 'rule_violation',
            rule: rule.description,
            severity: rule.severity,
            message: `Long functions detected: ${longFunctions.map(f => f.name).join(', ')}`,
            suggestion: 'Consider breaking down long functions for better maintainability',
            entities: longFunctions.map(f => f.name)
          };
        }
        break;
        
      case 'class_size':
        const largeClasses = characteristics.classes.filter(c => c.methods > 15);
        if (largeClasses.length > 0) {
          return {
            type: 'rule_violation',
            rule: rule.description,
            severity: rule.severity,
            message: `Large classes detected: ${largeClasses.map(c => c.name).join(', ')}`,
            suggestion: 'Consider applying Single Responsibility Principle to break down large classes',
            entities: largeClasses.map(c => c.name)
          };
        }
        break;
        
      case 'deep_nesting':
        if (characteristics.maxNestingLevel > 4) {
          return {
            type: 'rule_violation',
            rule: rule.description,
            severity: rule.severity,
            message: `Deep nesting detected: ${characteristics.maxNestingLevel} levels`,
            suggestion: 'Consider extracting nested logic into separate functions'
          };
        }
        break;
        
      case 'unused_variables':
        if (characteristics.unusedVariables && characteristics.unusedVariables.length > 0) {
          return {
            type: 'rule_violation',
            rule: rule.description,
            severity: rule.severity || 'warning',
            message: `Unused variables detected: ${characteristics.unusedVariables.join(', ')}`,
            suggestion: 'Remove unused variables to clean up the code',
            entities: characteristics.unusedVariables
          };
        }
        break;
    }
    
    return null;
  }

  checkStandard(characteristics, standard) {
    // Enhanced standard checking with multiple standard types
    switch (standard.type) {
      case 'naming':
        return this.checkNamingStandards(characteristics, standard);
        
      case 'formatting':
        return this.checkFormattingStandards(characteristics, standard);
        
      case 'documentation':
        return this.checkDocumentationStandards(characteristics, standard);
        
      case 'security':
        return this.checkSecurityStandards(characteristics, standard);
        
      default:
        return null;
    }
  }

  checkNamingStandards(characteristics, standard) {
    switch (standard.name) {
      case 'camelCase':
        const invalidFunctions = characteristics.functions.filter(f => 
          !/^[a-z][a-zA-Z0-9]*$/.test(f.name)
        );
        
        if (invalidFunctions.length > 0) {
          return {
            type: 'standard_violation',
            standard: standard.name,
            message: 'Non-camelCase function names detected',
            suggestion: 'Use camelCase naming convention for functions',
            entities: invalidFunctions.map(f => f.name)
          };
        }
        break;
        
      case 'PascalCase':
        const invalidClasses = characteristics.classes.filter(c => 
          !/^[A-Z][a-zA-Z0-9]*$/.test(c.name)
        );
        
        if (invalidClasses.length > 0) {
          return {
            type: 'standard_violation',
            standard: standard.name,
            message: 'Non-PascalCase class names detected',
            suggestion: 'Use PascalCase naming convention for classes',
            entities: invalidClasses.map(c => c.name)
          };
        }
        break;
        
      case 'CONSTANT_CASE':
        const invalidConstants = characteristics.variables.filter(v => 
          v.isConstant && !/^[A-Z][A-Z0-9_]*$/.test(v.name)
        );
        
        if (invalidConstants.length > 0) {
          return {
            type: 'standard_violation',
            standard: standard.name,
            message: 'Non-CONSTANT_CASE constant names detected',
            suggestion: 'Use CONSTANT_CASE naming convention for constants',
            entities: invalidConstants.map(v => v.name)
          };
        }
        break;
    }
    
    return null;
  }

  checkFormattingStandards(characteristics, standard) {
    // Check indentation, line length, etc.
    if (standard.name === 'maxLineLength' && standard.value) {
      const maxLength = parseInt(standard.value);
      if (characteristics.maxLineLength > maxLength) {
        return {
          type: 'standard_violation',
          standard: standard.name,
          message: `Line length exceeds standard: ${characteristics.maxLineLength} > ${maxLength}`,
          suggestion: `Keep lines under ${maxLength} characters`
        };
      }
    }
    
    return null;
  }

  checkDocumentationStandards(characteristics, standard) {
    if (standard.name === 'functionDocumentation') {
      const undocumentedFunctions = characteristics.functions.filter(f => !f.hasDocumentation);
      
      if (undocumentedFunctions.length > 0) {
        return {
          type: 'standard_violation',
          standard: standard.name,
          message: 'Undocumented functions detected',
          suggestion: 'Add JSDoc comments to all public functions',
          entities: undocumentedFunctions.map(f => f.name)
        };
      }
    }
    
    return null;
  }

  checkSecurityStandards(characteristics, standard) {
    if (standard.name === 'noEval' && characteristics.hasEval) {
      return {
        type: 'standard_violation',
        standard: standard.name,
        message: 'Use of eval() detected',
        suggestion: 'Avoid using eval() for security reasons',
        severity: 'critical'
      };
    }
    
    if (standard.name === 'noInnerHTML' && characteristics.hasInnerHTML) {
      return {
        type: 'standard_violation',
        standard: standard.name,
        message: 'Use of innerHTML detected',
        suggestion: 'Use textContent or DOM manipulation methods instead of innerHTML',
        severity: 'high'
      };
    }
    
    return null;
  }

  calculateOverallScore(results) {
    const scores = Object.values(results).map(r => r.score || 0);
    return scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : 0;
  }

  generateRecommendations(results) {
    const recommendations = [];
    
    Object.entries(results).forEach(([type, result]) => {
      if (result.violations && result.violations.length > 0) {
        recommendations.push({
          category: type,
          priority: this.getPriorityFromViolations(result.violations),
          actions: result.violations.map(v => v.message || v.description)
        });
      }
    });
    
    return recommendations;
  }

  analyzeDebtResults(analysis, scope, debtTypes) {
    return {
      summary: {
        scope,
        totalIssues: analysis.debts?.length || analysis.totalDebtItems || 0,
        highSeverity: analysis.debts?.filter(d => d.severity === 'high').length || 0
      },
      details: analysis,
      riskAssessment: this.assessDebtRisk(analysis)
    };
  }

  generateDebtRecommendations(analysis) {
    const recommendations = [];
    
    if (analysis.summary.highSeverity > 0) {
      recommendations.push({
        priority: 'high',
        action: 'Address high-severity technical debt immediately',
        impact: 'Critical for code maintainability'
      });
    }
    
    if (analysis.summary.totalIssues > 10) {
      recommendations.push({
        priority: 'medium',
        action: 'Plan gradual debt reduction strategy',
        impact: 'Improve long-term code quality'
      });
    }
    
    return recommendations;
  }

  getPriorityFromViolations(violations) {
    return violations.some(v => v.severity === 'critical') ? 'high' : 'medium';
  }

  assessDebtRisk(analysis) {
    const totalIssues = analysis.totalDebtItems || analysis.debts?.length || 0;
    
    if (totalIssues > 20) return 'high';
    if (totalIssues > 10) return 'medium';
    return 'low';
  }
}