/**
 * CONTEXT: Refactored validation handler using Strategy pattern
 * REASON: Eliminate nested conditionals and switch statements in validation logic
 * CHANGE: Apply Strategy pattern for different validation types and debt detection
 * PREVENTION: Reduces cyclomatic complexity and improves maintainability
 */

import { logger } from '../utils/logger.js';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

/**
 * Base validation strategy interface
 */
class ValidationStrategy {
  async validate(characteristics, strictMode) {
    throw new Error('Validate method must be implemented by subclasses');
  }
}

/**
 * Pattern validation strategy
 */
class PatternValidationStrategy extends ValidationStrategy {
  constructor(kuzu) {
    super();
    this.kuzu = kuzu;
  }

  async validate(characteristics, strictMode) {
    try {
      const detectedPatterns = await this.detectPatterns(characteristics);
      const validationScore = this.calculatePatternScore(detectedPatterns, strictMode);
      
      return {
        type: 'patterns',
        score: validationScore,
        detectedPatterns,
        violations: this.findPatternViolations(characteristics, detectedPatterns),
        suggestions: this.generatePatternSuggestions(characteristics, detectedPatterns)
      };
    } catch (error) {
      logger.error('Pattern validation failed:', error);
      return this.createErrorResult('patterns', error);
    }
  }

  async detectPatterns(characteristics) {
    const patterns = [];
    
    // Singleton pattern detection
    if (this.isSingletonPattern(characteristics)) {
      patterns.push({ name: 'Singleton', confidence: 0.8 });
    }
    
    // Factory pattern detection
    if (this.isFactoryPattern(characteristics)) {
      patterns.push({ name: 'Factory', confidence: 0.7 });
    }
    
    // Observer pattern detection
    if (this.isObserverPattern(characteristics)) {
      patterns.push({ name: 'Observer', confidence: 0.6 });
    }
    
    return patterns;
  }

  isSingletonPattern(characteristics) {
    return characteristics.classes.some(cls => 
      cls.methods.some(method => method.name === 'getInstance') &&
      cls.properties.some(prop => prop.static && prop.name.includes('instance'))
    );
  }

  isFactoryPattern(characteristics) {
    return characteristics.functions.some(func => 
      func.name.toLowerCase().includes('create') || 
      func.name.toLowerCase().includes('factory')
    );
  }

  isObserverPattern(characteristics) {
    return characteristics.classes.some(cls =>
      cls.methods.some(method => 
        ['addEventListener', 'subscribe', 'notify'].includes(method.name)
      )
    );
  }

  calculatePatternScore(detectedPatterns, strictMode) {
    if (detectedPatterns.length === 0) {
      return strictMode ? 0.3 : 0.6;
    }
    
    const avgConfidence = detectedPatterns.reduce((sum, p) => sum + p.confidence, 0) / detectedPatterns.length;
    return Math.min(avgConfidence + 0.2, 1.0);
  }

  findPatternViolations(characteristics, detectedPatterns) {
    const violations = [];
    
    // Check for pattern implementation issues
    for (const pattern of detectedPatterns) {
      if (pattern.name === 'Singleton' && pattern.confidence < 0.9) {
        violations.push({
          type: 'incomplete_singleton',
          message: 'Singleton pattern implementation appears incomplete',
          severity: 'warning'
        });
      }
    }
    
    return violations;
  }

  generatePatternSuggestions(characteristics, detectedPatterns) {
    const suggestions = [];
    
    if (detectedPatterns.length === 0 && characteristics.classes.length > 0) {
      suggestions.push('Consider implementing design patterns for better code organization');
    }
    
    return suggestions;
  }

  createErrorResult(type, error) {
    return {
      type,
      score: 0,
      error: error.message,
      detectedPatterns: [],
      violations: [],
      suggestions: []
    };
  }
}

/**
 * Rules validation strategy
 */
class RulesValidationStrategy extends ValidationStrategy {
  constructor(kuzu) {
    super();
    this.kuzu = kuzu;
  }

  async validate(characteristics, strictMode) {
    try {
      const ruleViolations = await this.checkRuleViolations(characteristics);
      const validationScore = this.calculateRulesScore(ruleViolations, strictMode);
      
      return {
        type: 'rules',
        score: validationScore,
        violations: ruleViolations,
        appliedRules: await this.getAppliedRules(),
        suggestions: this.generateRulesSuggestions(ruleViolations)
      };
    } catch (error) {
      logger.error('Rules validation failed:', error);
      return this.createErrorResult('rules', error);
    }
  }

  async checkRuleViolations(characteristics) {
    const violations = [];
    
    // Security rule violations
    violations.push(...this.checkSecurityRules(characteristics));
    
    // Complexity rule violations
    violations.push(...this.checkComplexityRules(characteristics));
    
    // Code quality rule violations
    violations.push(...this.checkQualityRules(characteristics));
    
    return violations;
  }

  checkSecurityRules(characteristics) {
    const violations = [];
    
    if (characteristics.hasEval) {
      violations.push({
        rule: 'no-eval',
        severity: 'high',
        message: 'Use of eval() is not allowed',
        line: null
      });
    }
    
    if (characteristics.hasInnerHTML) {
      violations.push({
        rule: 'no-inner-html',
        severity: 'medium',
        message: 'Direct innerHTML usage can lead to XSS vulnerabilities',
        line: null
      });
    }
    
    return violations;
  }

  checkComplexityRules(characteristics) {
    const violations = [];
    
    if (characteristics.maxNestingLevel > 4) {
      violations.push({
        rule: 'max-nesting-depth',
        severity: 'medium',
        message: `Nesting depth ${characteristics.maxNestingLevel} exceeds maximum of 4`,
        line: null
      });
    }
    
    if (characteristics.complexity > 10) {
      violations.push({
        rule: 'max-complexity',
        severity: 'high',
        message: `Cyclomatic complexity ${characteristics.complexity} exceeds maximum of 10`,
        line: null
      });
    }
    
    return violations;
  }

  checkQualityRules(characteristics) {
    const violations = [];
    
    if (characteristics.unusedVariables.length > 0) {
      violations.push({
        rule: 'no-unused-vars',
        severity: 'low',
        message: `${characteristics.unusedVariables.length} unused variables found`,
        line: null
      });
    }
    
    return violations;
  }

  async getAppliedRules() {
    try {
      const result = await this.kuzu.query(`
        MATCH (r:Rule)
        RETURN r.name as name, r.severity as severity, r.description as description
        ORDER BY r.severity DESC
      `);
      
      return result;
    } catch (error) {
      logger.error('Error getting applied rules:', error);
      return [];
    }
  }

  calculateRulesScore(violations, strictMode) {
    if (violations.length === 0) {
      return 1.0;
    }
    
    const severityWeights = { high: 0.4, medium: 0.2, low: 0.1 };
    const penalty = violations.reduce((sum, v) => sum + (severityWeights[v.severity] || 0.1), 0);
    
    const baseScore = Math.max(0, 1.0 - penalty);
    return strictMode ? baseScore * 0.8 : baseScore;
  }

  generateRulesSuggestions(violations) {
    const suggestions = [];
    
    const severityGroups = violations.reduce((groups, v) => {
      groups[v.severity] = (groups[v.severity] || 0) + 1;
      return groups;
    }, {});
    
    if (severityGroups.high > 0) {
      suggestions.push('Address high-severity rule violations immediately');
    }
    
    if (severityGroups.medium > 2) {
      suggestions.push('Consider refactoring to reduce medium-severity violations');
    }
    
    return suggestions;
  }

  createErrorResult(type, error) {
    return {
      type,
      score: 0,
      error: error.message,
      violations: [],
      appliedRules: [],
      suggestions: []
    };
  }
}

/**
 * Standards validation strategy
 */
class StandardsValidationStrategy extends ValidationStrategy {
  constructor(kuzu) {
    super();
    this.kuzu = kuzu;
  }

  async validate(characteristics, strictMode) {
    try {
      const standardsCompliance = await this.checkStandardsCompliance(characteristics);
      const validationScore = this.calculateStandardsScore(standardsCompliance, strictMode);
      
      return {
        type: 'standards',
        score: validationScore,
        compliance: standardsCompliance,
        appliedStandards: await this.getAppliedStandards(),
        suggestions: this.generateStandardsSuggestions(standardsCompliance)
      };
    } catch (error) {
      logger.error('Standards validation failed:', error);
      return this.createErrorResult('standards', error);
    }
  }

  async checkStandardsCompliance(characteristics) {
    const compliance = [];
    
    // Naming conventions
    compliance.push(...this.checkNamingConventions(characteristics));
    
    // Code formatting
    compliance.push(...this.checkCodeFormatting(characteristics));
    
    // Documentation standards
    compliance.push(...this.checkDocumentationStandards(characteristics));
    
    return compliance;
  }

  checkNamingConventions(characteristics) {
    const compliance = [];
    
    // Check camelCase for functions
    const badFunctionNames = characteristics.functions.filter(func => 
      !/^[a-z][a-zA-Z0-9]*$/.test(func.name)
    );
    
    if (badFunctionNames.length > 0) {
      compliance.push({
        standard: 'camelCase-functions',
        status: 'violation',
        message: `${badFunctionNames.length} functions don't follow camelCase convention`,
        details: badFunctionNames.map(f => f.name)
      });
    } else {
      compliance.push({
        standard: 'camelCase-functions',
        status: 'compliant',
        message: 'All functions follow camelCase convention'
      });
    }
    
    return compliance;
  }

  checkCodeFormatting(characteristics) {
    const compliance = [];
    
    if (characteristics.maxLineLength > 80) {
      compliance.push({
        standard: 'line-length',
        status: 'violation',
        message: `Line length ${characteristics.maxLineLength} exceeds 80 characters`
      });
    } else {
      compliance.push({
        standard: 'line-length',
        status: 'compliant',
        message: 'Line length within standards'
      });
    }
    
    return compliance;
  }

  checkDocumentationStandards(characteristics) {
    const compliance = [];
    
    const undocumentedFunctions = characteristics.functions.filter(func => 
      !func.hasDocumentation
    );
    
    if (undocumentedFunctions.length > 0) {
      compliance.push({
        standard: 'function-documentation',
        status: 'violation',
        message: `${undocumentedFunctions.length} functions lack documentation`
      });
    } else {
      compliance.push({
        standard: 'function-documentation',
        status: 'compliant',
        message: 'All functions are documented'
      });
    }
    
    return compliance;
  }

  async getAppliedStandards() {
    try {
      const result = await this.kuzu.query(`
        MATCH (s:Standard)
        RETURN s.name as name, s.value as value, s.category as category
        ORDER BY s.category, s.name
      `);
      
      return result;
    } catch (error) {
      logger.error('Error getting applied standards:', error);
      return [];
    }
  }

  calculateStandardsScore(compliance, strictMode) {
    const total = compliance.length;
    if (total === 0) return strictMode ? 0.5 : 0.7;
    
    const compliant = compliance.filter(c => c.status === 'compliant').length;
    const baseScore = compliant / total;
    
    return strictMode ? baseScore * 0.9 : baseScore;
  }

  generateStandardsSuggestions(compliance) {
    const suggestions = [];
    const violations = compliance.filter(c => c.status === 'violation');
    
    if (violations.length > 0) {
      suggestions.push('Review and fix coding standards violations');
      
      const categories = [...new Set(violations.map(v => v.standard))];
      if (categories.length > 1) {
        suggestions.push('Consider using automated formatting tools');
      }
    }
    
    return suggestions;
  }

  createErrorResult(type, error) {
    return {
      type,
      score: 0,
      error: error.message,
      compliance: [],
      appliedStandards: [],
      suggestions: []
    };
  }
}

/**
 * Technical debt detection strategies
 */
class TechnicalDebtStrategy {
  constructor(kuzu) {
    this.kuzu = kuzu;
  }

  async detectDebt(scope, target, debtTypes) {
    const detectionStrategies = {
      module: () => this.detectModuleDebt(target, debtTypes),
      project: () => this.detectProjectDebt(debtTypes),
      specific: () => this.detectSpecificDebt(target, debtTypes)
    };

    const strategy = detectionStrategies[scope];
    if (!strategy) {
      throw new Error(`Unknown debt detection scope: ${scope}`);
    }

    return await strategy();
  }

  async detectModuleDebt(target, debtTypes) {
    const query = `
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
    
    const result = await this.kuzu.query(query, { target, debtTypes });
    return result[0]?.analysis || {};
  }

  async detectProjectDebt(debtTypes) {
    const query = `
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
    
    const result = await this.kuzu.query(query, { debtTypes });
    return result[0]?.analysis || {};
  }

  async detectSpecificDebt(target, debtTypes) {
    const query = `
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
    
    const result = await this.kuzu.query(query, { target, debtTypes });
    return result[0]?.analysis || {};
  }
}

/**
 * Refactored validation handler using Strategy pattern
 */
export class RefactoredValidationHandler {
  constructor(serviceLocator) {
    this.serviceLocator = serviceLocator;
    this.kuzu = serviceLocator.get('database');
    
    // Initialize validation strategies
    this.validationStrategies = {
      patterns: new PatternValidationStrategy(this.kuzu),
      rules: new RulesValidationStrategy(this.kuzu),
      standards: new StandardsValidationStrategy(this.kuzu)
    };
    
    this.debtStrategy = new TechnicalDebtStrategy(this.kuzu);
  }

  /**
   * Validate code against KG using strategy pattern
   */
  async validateAgainstKG(args) {
    const { 
      codeSnippet, 
      validationTypes = ['patterns', 'rules', 'standards'], 
      strictMode = true 
    } = args;
    
    try {
      // Parse code and extract characteristics
      const ast = this.parseCode(codeSnippet);
      const characteristics = this.extractCodeCharacteristics(ast);
      
      // Execute validation strategies
      const validationResults = await this.executeValidationStrategies(
        validationTypes, 
        characteristics, 
        strictMode
      );
      
      const overallScore = this.calculateOverallScore(validationResults);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              codeSnippet: this.truncateCode(codeSnippet),
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

  /**
   * Detect technical debt using strategy pattern
   */
  async detectTechnicalDebt(args) {
    const { 
      scope, 
      target, 
      debtTypes = ['complexity', 'duplication', 'coupling'] 
    } = args;
    
    try {
      const analysis = await this.debtStrategy.detectDebt(scope, target, debtTypes);
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

  /**
   * Parse code with error handling
   */
  parseCode(codeSnippet) {
    try {
      return parse(codeSnippet, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'decorators-legacy']
      });
    } catch (error) {
      logger.warn('Failed to parse code snippet:', error.message);
      // Return a minimal AST for basic analysis
      return { type: 'Program', body: [] };
    }
  }

  /**
   * Execute validation strategies in parallel
   */
  async executeValidationStrategies(validationTypes, characteristics, strictMode) {
    const validationPromises = validationTypes.map(async (type) => {
      const strategy = this.validationStrategies[type];
      if (!strategy) {
        logger.warn(`Unknown validation type: ${type}`);
        return null;
      }
      
      try {
        return await strategy.validate(characteristics, strictMode);
      } catch (error) {
        logger.error(`Validation strategy ${type} failed:`, error);
        return {
          type,
          error: error.message,
          score: 0
        };
      }
    });

    const results = await Promise.all(validationPromises);
    return results.filter(result => result !== null);
  }

  /**
   * Extract code characteristics using visitor pattern
   */
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
    
    const visitor = new CodeCharacteristicsVisitor(characteristics);
    visitor.visit(ast);
    
    return characteristics;
  }

  /**
   * Calculate overall validation score
   */
  calculateOverallScore(validationResults) {
    if (validationResults.length === 0) return 0;
    
    const totalScore = validationResults.reduce((sum, result) => sum + (result.score || 0), 0);
    return Number((totalScore / validationResults.length).toFixed(2));
  }

  /**
   * Generate validation recommendations
   */
  generateRecommendations(validationResults) {
    const recommendations = [];
    
    for (const result of validationResults) {
      if (result.suggestions && result.suggestions.length > 0) {
        recommendations.push(...result.suggestions);
      }
      
      if (result.score < 0.5) {
        recommendations.push(`Improve ${result.type} validation score (currently ${result.score})`);
      }
    }
    
    return [...new Set(recommendations)]; // Remove duplicates
  }

  /**
   * Analyze debt detection results
   */
  analyzeDebtResults(analysis, scope, debtTypes) {
    return {
      summary: this.createDebtSummary(analysis, scope),
      details: analysis,
      metrics: this.calculateDebtMetrics(analysis, debtTypes),
      trends: this.analyzeDebtTrends(analysis)
    };
  }

  createDebtSummary(analysis, scope) {
    switch (scope) {
      case 'module':
        return {
          scope: 'module',
          totalEntities: analysis.entities?.length || 0,
          totalDebts: analysis.debts?.length || 0,
          avgDebtsPerEntity: analysis.entities?.length > 0 
            ? ((analysis.debts?.length || 0) / analysis.entities.length).toFixed(2)
            : 0
        };
      case 'project':
        return {
          scope: 'project',
          totalDebtItems: analysis.totalDebtItems || 0,
          moduleCount: analysis.byModule?.length || 0,
          typeCount: analysis.byType?.length || 0
        };
      case 'specific':
        return {
          scope: 'specific',
          entity: analysis.entity?.name || 'unknown',
          totalDebts: analysis.debts?.length || 0
        };
      default:
        return { scope, error: 'Unknown scope' };
    }
  }

  calculateDebtMetrics(analysis, debtTypes) {
    // Implementation would calculate various debt metrics
    return {
      debtTypes: debtTypes,
      coverage: 0.8, // Example metric
      severity: 'medium' // Example metric
    };
  }

  analyzeDebtTrends(analysis) {
    // Implementation would analyze trends in technical debt
    return {
      trend: 'stable',
      recommendation: 'Monitor for increases'
    };
  }

  /**
   * Generate debt recommendations
   */
  generateDebtRecommendations(debtAnalysis) {
    const recommendations = [];
    
    if (debtAnalysis.summary.totalDebts > 10) {
      recommendations.push('High debt detected - prioritize refactoring efforts');
    }
    
    if (debtAnalysis.metrics.severity === 'high') {
      recommendations.push('Address high-severity debt items immediately');
    }
    
    return recommendations;
  }

  /**
   * Truncate code for display
   */
  truncateCode(codeSnippet, maxLength = 200) {
    return codeSnippet.length > maxLength 
      ? codeSnippet.substring(0, maxLength) + '...'
      : codeSnippet;
  }
}

/**
 * Visitor pattern for code characteristics extraction
 */
class CodeCharacteristicsVisitor {
  constructor(characteristics) {
    this.characteristics = characteristics;
    this.nestingLevel = 0;
  }

  visit(node) {
    if (!node) return;
    
    this.enter(node);
    
    // Visit child nodes
    for (const key in node) {
      const child = node[key];
      if (Array.isArray(child)) {
        child.forEach(c => this.visit(c));
      } else if (child && typeof child === 'object' && child.type) {
        this.visit(child);
      }
    }
    
    this.exit(node);
  }

  enter(node) {
    const nodeHandlers = {
      FunctionDeclaration: () => this.handleFunction(node),
      ClassDeclaration: () => this.handleClass(node),
      VariableDeclarator: () => this.handleVariable(node),
      ImportDeclaration: () => this.handleImport(node),
      IfStatement: () => this.handleComplexity(node),
      CallExpression: () => this.handleCallExpression(node),
      MemberExpression: () => this.handleMemberExpression(node)
    };

    const handler = nodeHandlers[node.type];
    if (handler) {
      handler();
    }

    // Track nesting
    if (this.isNestingNode(node)) {
      this.nestingLevel++;
      this.characteristics.maxNestingLevel = Math.max(
        this.characteristics.maxNestingLevel, 
        this.nestingLevel
      );
    }
  }

  exit(node) {
    if (this.isNestingNode(node)) {
      this.nestingLevel--;
    }
  }

  handleFunction(node) {
    this.characteristics.functions.push({
      name: node.id?.name || 'anonymous',
      hasDocumentation: this.hasLeadingComments(node),
      params: node.params?.length || 0
    });
  }

  handleClass(node) {
    this.characteristics.classes.push({
      name: node.id?.name || 'anonymous',
      methods: [],
      properties: []
    });
  }

  handleVariable(node) {
    if (node.id?.name) {
      this.characteristics.variables.push({
        name: node.id.name,
        type: node.init?.type || 'unknown'
      });
    }
  }

  handleImport(node) {
    this.characteristics.imports.push({
      source: node.source?.value || 'unknown',
      specifiers: node.specifiers?.length || 0
    });
  }

  handleComplexity(node) {
    this.characteristics.complexity++;
  }

  handleCallExpression(node) {
    if (node.callee?.name === 'eval') {
      this.characteristics.hasEval = true;
    }
  }

  handleMemberExpression(node) {
    if (node.property?.name === 'innerHTML') {
      this.characteristics.hasInnerHTML = true;
    }
  }

  isNestingNode(node) {
    return [
      'IfStatement', 'ForStatement', 'WhileStatement', 
      'DoWhileStatement', 'SwitchStatement'
    ].includes(node.type);
  }

  hasLeadingComments(node) {
    return node.leadingComments && node.leadingComments.length > 0;
  }
}