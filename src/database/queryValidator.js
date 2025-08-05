import { logger } from '../utils/logger.js';

/**
 * CONTEXT: Comprehensive query validation and sanitization system for Kuzu database
 * REASON: Ensure query security, prevent injection attacks, and validate syntax
 * CHANGE: Multi-layered validation with security checks and syntax analysis
 * PREVENTION: SQL injection, malformed queries, security vulnerabilities, and data corruption
 */

export class QueryValidator {
  constructor(config = {}) {
    this.config = {
      maxQueryLength: config.maxQueryLength || 100000,
      maxParameterCount: config.maxParameterCount || 1000,
      maxParameterLength: config.maxParameterLength || 10000,
      allowedKeywords: config.allowedKeywords || this.getDefaultAllowedKeywords(),
      forbiddenPatterns: config.forbiddenPatterns || this.getDefaultForbiddenPatterns(),
      strictMode: config.strictMode !== false,
      enableLogging: config.enableLogging !== false,
      maxDepth: config.maxDepth || 10,
      maxComplexity: config.maxComplexity || 100,
      ...config
    };

    this.validationRules = new Map();
    this.sanitizationRules = new Map();
    this.validationStats = {
      totalValidations: 0,
      validQueries: 0,
      invalidQueries: 0,
      sanitizedQueries: 0,
      blockedQueries: 0
    };

    this.initializeValidationRules();
    this.initializeSanitizationRules();

    logger.info('QueryValidator initialized', {
      strictMode: this.config.strictMode,
      maxQueryLength: this.config.maxQueryLength,
      rulesCount: this.validationRules.size
    });
  }

  /**
   * Validate and sanitize a query
   */
  async validateQuery(query, parameters = {}, options = {}) {
    const startTime = Date.now();
    this.validationStats.totalValidations++;

    try {
      const result = {
        isValid: true,
        query: query,
        parameters: parameters,
        sanitized: false,
        warnings: [],
        errors: [],
        metadata: {
          complexity: 0,
          riskLevel: 'LOW',
          validationTime: 0
        }
      };

      // Step 1: Basic validation
      await this.performBasicValidation(query, parameters, result);
      
      if (!result.isValid && this.config.strictMode) {
        this.validationStats.invalidQueries++;
        return result;
      }

      // Step 2: Security validation
      await this.performSecurityValidation(query, parameters, result);
      
      if (!result.isValid && this.config.strictMode) {
        this.validationStats.blockedQueries++;
        return result;
      }

      // Step 3: Syntax validation
      await this.performSyntaxValidation(query, result);

      // Step 4: Complexity analysis
      await this.performComplexityAnalysis(query, result);

      // Step 5: Parameter validation
      await this.validateParameters(parameters, result);

      // Step 6: Sanitization (if needed and allowed)
      if (!this.config.strictMode || options.allowSanitization) {
        await this.performSanitization(result);
      }

      // Step 7: Final validation
      await this.performFinalValidation(result);

      // Update statistics
      const validationTime = Date.now() - startTime;
      result.metadata.validationTime = validationTime;

      if (result.isValid) {
        this.validationStats.validQueries++;
        if (result.sanitized) {
          this.validationStats.sanitizedQueries++;
        }
      } else {
        this.validationStats.invalidQueries++;
      }

      if (this.config.enableLogging) {
        logger.debug('Query validation completed', {
          isValid: result.isValid,
          sanitized: result.sanitized,
          warningCount: result.warnings.length,
          errorCount: result.errors.length,
          complexity: result.metadata.complexity,
          riskLevel: result.metadata.riskLevel,
          validationTime: `${validationTime}ms`
        });
      }

      return result;

    } catch (error) {
      this.validationStats.invalidQueries++;
      
      logger.error('Query validation failed', {
        error: error.message,
        query: query.substring(0, 200)
      });

      return {
        isValid: false,
        query,
        parameters,
        sanitized: false,
        warnings: [],
        errors: [`Validation error: ${error.message}`],
        metadata: {
          complexity: 0,
          riskLevel: 'HIGH',
          validationTime: Date.now() - startTime
        }
      };
    }
  }

  /**
   * Perform basic validation checks
   */
  async performBasicValidation(query, parameters, result) {
    // Check query length
    if (query.length > this.config.maxQueryLength) {
      result.errors.push(`Query length exceeds maximum: ${query.length} > ${this.config.maxQueryLength}`);
      result.isValid = false;
    }

    // Check if query is empty or only whitespace
    if (!query || query.trim().length === 0) {
      result.errors.push('Query cannot be empty');
      result.isValid = false;
    }

    // Check parameter count
    if (Object.keys(parameters).length > this.config.maxParameterCount) {
      result.errors.push(`Too many parameters: ${Object.keys(parameters).length} > ${this.config.maxParameterCount}`);
      result.isValid = false;
    }

    // Check for basic structure
    if (!this.hasValidCypherStructure(query)) {
      result.errors.push('Query does not contain valid Cypher structure');
      result.isValid = false;
    }
  }

  /**
   * Perform security validation
   */
  async performSecurityValidation(query, parameters, result) {
    // Check for forbidden patterns
    for (const pattern of this.config.forbiddenPatterns) {
      if (pattern.test(query)) {
        result.errors.push(`Query contains forbidden pattern: ${pattern.source}`);
        result.isValid = false;
        result.metadata.riskLevel = 'HIGH';
      }
    }

    // Check for potential injection attempts
    const injectionPatterns = [
      /;\s*(DROP|DELETE\s+(?:FROM|NODE|REL))/i,
      /--\s*[^\r\n]*/g,
      /\/\*[\s\S]*?\*\//g,
      /\bEXEC\s*\(/i,
      /\bEVAL\s*\(/i,
      /\${.*}/g  // Template literal injection
    ];

    for (const pattern of injectionPatterns) {
      if (pattern.test(query)) {
        result.errors.push(`Potential injection attempt detected: ${pattern.source}`);
        result.isValid = false;
        result.metadata.riskLevel = 'CRITICAL';
      }
    }

    // Check for suspicious parameter patterns
    for (const [key, value] of Object.entries(parameters)) {
      if (typeof value === 'string') {
        if (value.includes(';') || value.includes('--') || value.includes('/*')) {
          result.warnings.push(`Suspicious parameter value detected: ${key}`);
          result.metadata.riskLevel = 'MEDIUM';
        }
      }
    }

    // Check for dynamic query construction vulnerabilities
    if (query.includes('$') && !this.hasProperParameterUsage(query, parameters)) {
      result.warnings.push('Query may be vulnerable to parameter injection');
      result.metadata.riskLevel = 'MEDIUM';
    }
  }

  /**
   * Perform syntax validation
   */
  async performSyntaxValidation(query, result) {
    // Check for balanced parentheses
    if (!this.hasBalancedParentheses(query)) {
      result.errors.push('Unbalanced parentheses in query');
      result.isValid = false;
    }

    // Check for balanced brackets
    if (!this.hasBalancedBrackets(query)) {
      result.errors.push('Unbalanced brackets in query');
      result.isValid = false;
    }

    // Check for balanced braces
    if (!this.hasBalancedBraces(query)) {
      result.errors.push('Unbalanced braces in query');
      result.isValid = false;
    }

    // Check for valid keywords
    const keywords = this.extractKeywords(query);
    for (const keyword of keywords) {
      if (!this.config.allowedKeywords.includes(keyword.toUpperCase())) {
        if (this.config.strictMode) {
          result.errors.push(`Forbidden keyword: ${keyword}`);
          result.isValid = false;
        } else {
          result.warnings.push(`Potentially unsafe keyword: ${keyword}`);
        }
      }
    }

    // Check for proper Cypher syntax patterns
    const syntaxChecks = [
      {
        pattern: /MATCH\s*\([^)]*\)/i,
        required: true,
        message: 'MATCH clause should contain valid node pattern'
      },
      {
        pattern: /RETURN\s+[^;]*/i,
        required: false,
        message: 'RETURN clause syntax may be invalid'
      },
      {
        pattern: /WHERE\s+[^;]*/i,
        required: false,
        message: 'WHERE clause syntax may be invalid'
      }
    ];

    for (const check of syntaxChecks) {
      if (query.toUpperCase().includes(check.pattern.source.replace(/\\s\*|\[|\]|\(|\)|\|/g, '').split('\\')[0])) {
        if (!check.pattern.test(query) && check.required) {
          result.errors.push(check.message);
          result.isValid = false;
        }
      }
    }
  }

  /**
   * Perform complexity analysis
   */
  async performComplexityAnalysis(query, result) {
    let complexity = 0;

    // Count pattern complexity
    const patterns = query.match(/\([^)]*\)/g) || [];
    complexity += patterns.length;

    // Count relationship complexity
    const relationships = query.match(/-\[.*?\]-/g) || [];
    complexity += relationships.length * 2;

    // Count variable length path complexity
    const variablePaths = query.match(/\*\d*\.\.\d*/g) || [];
    complexity += variablePaths.length * 10;

    // Count nesting complexity
    const nestingDepth = this.calculateNestingDepth(query);
    complexity += nestingDepth * 5;

    // Count aggregation complexity
    const aggregations = query.match(/\b(count|sum|avg|max|min|collect)\s*\(/gi) || [];
    complexity += aggregations.length * 3;

    // Count subquery complexity
    const subqueries = query.match(/\bWITH\b/gi) || [];
    complexity += subqueries.length * 5;

    result.metadata.complexity = complexity;

    if (complexity > this.config.maxComplexity) {
      if (this.config.strictMode) {
        result.errors.push(`Query complexity too high: ${complexity} > ${this.config.maxComplexity}`);
        result.isValid = false;
      } else {
        result.warnings.push(`High query complexity: ${complexity}`);
      }
      result.metadata.riskLevel = 'HIGH';
    } else if (complexity > this.config.maxComplexity * 0.7) {
      result.warnings.push(`Moderate query complexity: ${complexity}`);
      result.metadata.riskLevel = 'MEDIUM';
    }
  }

  /**
   * Validate parameters
   */
  async validateParameters(parameters, result) {
    for (const [key, value] of Object.entries(parameters)) {
      // Validate parameter name
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        result.errors.push(`Invalid parameter name: ${key}`);
        result.isValid = false;
      }

      // Validate parameter value
      if (value === null || value === undefined) {
        // Null/undefined is generally OK
        continue;
      }

      if (typeof value === 'string') {
        if (value.length > this.config.maxParameterLength) {
          result.errors.push(`Parameter ${key} exceeds maximum length: ${value.length} > ${this.config.maxParameterLength}`);
          result.isValid = false;
        }

        // Check for potential injection in string parameters
        if (value.includes(';') || value.includes('--') || /\/\*.*\*\//.test(value)) {
          result.warnings.push(`Parameter ${key} contains potentially dangerous characters`);
          result.metadata.riskLevel = 'MEDIUM';
        }
      } else if (typeof value === 'number') {
        if (!Number.isFinite(value)) {
          result.errors.push(`Parameter ${key} is not a finite number`);
          result.isValid = false;
        }
      } else if (Array.isArray(value)) {
        if (value.length > 1000) {
          result.errors.push(`Parameter ${key} array is too large: ${value.length} > 1000`);
          result.isValid = false;
        }

        // Validate array elements
        for (let i = 0; i < value.length; i++) {
          const element = value[i];
          if (typeof element === 'string' && element.length > this.config.maxParameterLength) {
            result.errors.push(`Parameter ${key}[${i}] exceeds maximum length`);
            result.isValid = false;
          }
        }
      } else if (typeof value === 'object') {
        // Validate object parameters
        const jsonString = JSON.stringify(value);
        if (jsonString.length > this.config.maxParameterLength) {
          result.errors.push(`Parameter ${key} object is too large`);
          result.isValid = false;
        }
      } else if (!['boolean'].includes(typeof value)) {
        result.warnings.push(`Parameter ${key} has unusual type: ${typeof value}`);
      }
    }
  }

  /**
   * Perform sanitization
   */
  async performSanitization(result) {
    let sanitized = false;
    let sanitizedQuery = result.query;
    let sanitizedParameters = { ...result.parameters };

    // Apply sanitization rules
    for (const [ruleName, rule] of this.sanitizationRules) {
      try {
        const ruleResult = await rule(sanitizedQuery, sanitizedParameters);
        
        if (ruleResult.modified) {
          sanitizedQuery = ruleResult.query;
          sanitizedParameters = ruleResult.parameters;
          sanitized = true;
          
          result.warnings.push(`Applied sanitization rule: ${ruleName}`);
          
          logger.debug(`Sanitization rule applied: ${ruleName}`, {
            original: result.query.substring(0, 100),
            sanitized: sanitizedQuery.substring(0, 100)
          });
        }
      } catch (error) {
        logger.warn(`Sanitization rule ${ruleName} failed:`, error.message);
      }
    }

    if (sanitized) {
      result.query = sanitizedQuery;
      result.parameters = sanitizedParameters;
      result.sanitized = true;
    }
  }

  /**
   * Perform final validation
   */
  async performFinalValidation(result) {
    // Re-validate sanitized query for any new issues
    if (result.sanitized) {
      const basicChecks = {
        hasValidStructure: this.hasValidCypherStructure(result.query),
        hasBalancedParentheses: this.hasBalancedParentheses(result.query),
        hasBalancedBrackets: this.hasBalancedBrackets(result.query)
      };

      for (const [check, passed] of Object.entries(basicChecks)) {
        if (!passed) {
          result.errors.push(`Sanitized query failed ${check}`);
          result.isValid = false;
        }
      }
    }

    // Final risk assessment
    if (result.errors.length > 0) {
      result.metadata.riskLevel = 'HIGH';
    } else if (result.warnings.length > 3) {
      result.metadata.riskLevel = 'MEDIUM';
    } else if (result.warnings.length > 0) {
      result.metadata.riskLevel = 'LOW';
    } else {
      result.metadata.riskLevel = 'MINIMAL';
    }
  }

  /**
   * Initialize validation rules
   */
  initializeValidationRules() {
    // Length validation rule
    this.validationRules.set('maxLength', (query) => {
      return query.length <= this.config.maxQueryLength;
    });

    // Keyword validation rule
    this.validationRules.set('allowedKeywords', (query) => {
      const keywords = this.extractKeywords(query);
      return keywords.every(keyword => 
        this.config.allowedKeywords.includes(keyword.toUpperCase())
      );
    });

    // Pattern validation rule
    this.validationRules.set('forbiddenPatterns', (query) => {
      return !this.config.forbiddenPatterns.some(pattern => pattern.test(query));
    });

    // Complexity validation rule
    this.validationRules.set('complexity', (query) => {
      const complexity = this.calculateQueryComplexity(query);
      return complexity <= this.config.maxComplexity;
    });

    logger.debug('Validation rules initialized', {
      ruleCount: this.validationRules.size
    });
  }

  /**
   * Initialize sanitization rules
   */
  initializeSanitizationRules() {
    // Remove comments
    this.sanitizationRules.set('removeComments', async (query, parameters) => {
      const original = query;
      const sanitized = query
        .replace(/\/\*[\s\S]*?\*\//g, ' ')
        .replace(/--.*$/gm, '')
        .replace(/\s+/g, ' ')
        .trim();

      return {
        modified: original !== sanitized,
        query: sanitized,
        parameters
      };
    });

    // Normalize whitespace
    this.sanitizationRules.set('normalizeWhitespace', async (query, parameters) => {
      const original = query;
      const sanitized = query
        .replace(/\s+/g, ' ')
        .replace(/\s*;\s*/g, '; ')
        .trim();

      return {
        modified: original !== sanitized,
        query: sanitized,
        parameters
      };
    });

    // Escape dangerous characters in parameters
    this.sanitizationRules.set('escapeParameters', async (query, parameters) => {
      const sanitizedParams = {};
      let modified = false;

      for (const [key, value] of Object.entries(parameters)) {
        if (typeof value === 'string') {
          const sanitized = value
            .replace(/'/g, "''")
            .replace(/\\/g, '\\\\');
          
          if (sanitized !== value) {
            modified = true;
          }
          
          sanitizedParams[key] = sanitized;
        } else {
          sanitizedParams[key] = value;
        }
      }

      return {
        modified,
        query,
        parameters: sanitizedParams
      };
    });

    logger.debug('Sanitization rules initialized', {
      ruleCount: this.sanitizationRules.size
    });
  }

  /**
   * Get default allowed Cypher keywords
   */
  getDefaultAllowedKeywords() {
    return [
      // Basic clauses
      'MATCH', 'RETURN', 'WHERE', 'WITH', 'CREATE', 'MERGE', 'DELETE', 'REMOVE', 'SET',
      
      // Conditional
      'CASE', 'WHEN', 'THEN', 'ELSE', 'END',
      
      // Aggregation
      'COUNT', 'SUM', 'AVG', 'MAX', 'MIN', 'COLLECT', 'DISTINCT',
      
      // String functions
      'SUBSTRING', 'TRIM', 'UPPER', 'LOWER', 'REPLACE', 'SPLIT', 'REVERSE',
      'LEFT', 'RIGHT', 'SIZE', 'LENGTH', 'TOSTRING', 'TOINTEGER', 'TOFLOAT',
      
      // Math functions
      'ABS', 'CEIL', 'FLOOR', 'ROUND', 'SQRT', 'SIN', 'COS', 'TAN', 'RAND',
      
      // Date/Time
      'DATE', 'TIME', 'DATETIME', 'TIMESTAMP', 'DURATION',
      
      // List functions
      'HEAD', 'TAIL', 'LAST', 'RANGE', 'FILTER', 'EXTRACT', 'REDUCE',
      
      // Predicates
      'EXISTS', 'ALL', 'ANY', 'NONE', 'SINGLE',
      
      // Path functions
      'NODES', 'RELATIONSHIPS', 'LENGTH',
      
      // Operators
      'AND', 'OR', 'NOT', 'XOR', 'IN', 'STARTS', 'ENDS', 'CONTAINS',
      'IS', 'NULL', 'TRUE', 'FALSE',
      
      // Order and limit
      'ORDER', 'BY', 'ASC', 'DESC', 'SKIP', 'LIMIT',
      
      // Union
      'UNION', 'ALL',
      
      // Schema
      'INDEX', 'CONSTRAINT', 'UNIQUE', 'ON', 'ASSERT',
      
      // Explain
      'EXPLAIN', 'PROFILE'
    ];
  }

  /**
   * Get default forbidden patterns
   */
  getDefaultForbiddenPatterns() {
    return [
      // Dangerous SQL-like operations
      /\b(DROP|TRUNCATE|ALTER)\s+/i,
      
      // System commands
      /\b(EXEC|EXECUTE|EVAL|SYSTEM)\s*\(/i,
      
      // File operations
      /\b(LOAD\s+CSV|USING\s+PERIODIC\s+COMMIT)\b/i,
      
      // Administrative operations
      /\b(SHOW\s+USERS|CREATE\s+USER|DROP\s+USER)\b/i,
      
      // Dangerous patterns
      /;\s*--/,
      /\bSCRIPT\b/i,
      
      // Nested queries with suspicious patterns
      /\bCALL\s+\{.*\}/i
    ];
  }

  /**
   * Check if query has valid Cypher structure
   */
  hasValidCypherStructure(query) {
    const cypherKeywords = ['MATCH', 'RETURN', 'CREATE', 'MERGE', 'WITH', 'WHERE', 'SET', 'DELETE', 'REMOVE'];
    const upperQuery = query.toUpperCase();
    
    return cypherKeywords.some(keyword => upperQuery.includes(keyword));
  }

  /**
   * Check for balanced parentheses
   */
  hasBalancedParentheses(query) {
    let count = 0;
    let inString = false;
    let stringChar = null;
    
    for (let i = 0; i < query.length; i++) {
      const char = query[i];
      const prevChar = i > 0 ? query[i - 1] : null;
      
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && prevChar !== '\\') {
        inString = false;
        stringChar = null;
      } else if (!inString) {
        if (char === '(') {
          count++;
        } else if (char === ')') {
          count--;
          if (count < 0) return false;
        }
      }
    }
    
    return count === 0;
  }

  /**
   * Check for balanced brackets
   */
  hasBalancedBrackets(query) {
    let count = 0;
    let inString = false;
    let stringChar = null;
    
    for (let i = 0; i < query.length; i++) {
      const char = query[i];
      const prevChar = i > 0 ? query[i - 1] : null;
      
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && prevChar !== '\\') {
        inString = false;
        stringChar = null;
      } else if (!inString) {
        if (char === '[') {
          count++;
        } else if (char === ']') {
          count--;
          if (count < 0) return false;
        }
      }
    }
    
    return count === 0;
  }

  /**
   * Check for balanced braces
   */
  hasBalancedBraces(query) {
    let count = 0;
    let inString = false;
    let stringChar = null;
    
    for (let i = 0; i < query.length; i++) {
      const char = query[i];
      const prevChar = i > 0 ? query[i - 1] : null;
      
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && prevChar !== '\\') {
        inString = false;
        stringChar = null;
      } else if (!inString) {
        if (char === '{') {
          count++;
        } else if (char === '}') {
          count--;
          if (count < 0) return false;
        }
      }
    }
    
    return count === 0;
  }

  /**
   * Extract keywords from query
   */
  extractKeywords(query) {
    const keywordPattern = /\b[A-Z][A-Z_]+\b/g;
    const matches = query.match(keywordPattern) || [];
    return [...new Set(matches)]; // Remove duplicates
  }

  /**
   * Calculate nesting depth
   */
  calculateNestingDepth(query) {
    let maxDepth = 0;
    let currentDepth = 0;
    let inString = false;
    let stringChar = null;
    
    for (let i = 0; i < query.length; i++) {
      const char = query[i];
      const prevChar = i > 0 ? query[i - 1] : null;
      
      if (!inString && (char === '"' || char === "'")) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar && prevChar !== '\\') {
        inString = false;
        stringChar = null;
      } else if (!inString) {
        if (char === '(' || char === '[' || char === '{') {
          currentDepth++;
          maxDepth = Math.max(maxDepth, currentDepth);
        } else if (char === ')' || char === ']' || char === '}') {
          currentDepth--;
        }
      }
    }
    
    return maxDepth;
  }

  /**
   * Calculate overall query complexity
   */
  calculateQueryComplexity(query) {
    let complexity = 1;
    
    // Basic patterns
    complexity += (query.match(/MATCH/gi) || []).length * 2;
    complexity += (query.match(/CREATE/gi) || []).length * 3;
    complexity += (query.match(/MERGE/gi) || []).length * 4;
    
    // Relationships
    complexity += (query.match(/-\[.*?\]-/g) || []).length * 2;
    
    // Variable length paths
    complexity += (query.match(/\*\d*\.\.\d*/g) || []).length * 10;
    
    // Aggregations
    complexity += (query.match(/\b(count|sum|avg|max|min|collect)\s*\(/gi) || []).length * 3;
    
    // Subqueries
    complexity += (query.match(/\bWITH\b/gi) || []).length * 5;
    
    // Nesting
    const depth = this.calculateNestingDepth(query);
    complexity += depth * 2;
    
    return complexity;
  }

  /**
   * Check if query uses parameters properly
   */
  hasProperParameterUsage(query, parameters) {
    const parameterNames = Object.keys(parameters);
    
    // Find all parameter references in query
    const paramRefs = query.match(/\$[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
    
    // Check if all parameter references have corresponding parameters
    for (const ref of paramRefs) {
      const paramName = ref.substring(1); // Remove $
      if (!parameterNames.includes(paramName)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Add custom validation rule
   */
  addValidationRule(name, rule) {
    if (typeof rule !== 'function') {
      throw new Error('Validation rule must be a function');
    }
    
    this.validationRules.set(name, rule);
    
    logger.debug('Custom validation rule added', { name });
  }

  /**
   * Add custom sanitization rule
   */
  addSanitizationRule(name, rule) {
    if (typeof rule !== 'function') {
      throw new Error('Sanitization rule must be a function');
    }
    
    this.sanitizationRules.set(name, rule);
    
    logger.debug('Custom sanitization rule added', { name });
  }

  /**
   * Get validation statistics
   */
  getStatistics() {
    return {
      ...this.validationStats,
      successRate: this.validationStats.totalValidations > 0 ? 
        (this.validationStats.validQueries / this.validationStats.totalValidations * 100) : 0,
      sanitizationRate: this.validationStats.totalValidations > 0 ? 
        (this.validationStats.sanitizedQueries / this.validationStats.totalValidations * 100) : 0,
      blockRate: this.validationStats.totalValidations > 0 ? 
        (this.validationStats.blockedQueries / this.validationStats.totalValidations * 100) : 0
    };
  }

  /**
   * Reset validation statistics
   */
  resetStatistics() {
    this.validationStats = {
      totalValidations: 0,
      validQueries: 0,
      invalidQueries: 0,
      sanitizedQueries: 0,
      blockedQueries: 0
    };
    
    logger.debug('Validation statistics reset');
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    
    logger.debug('QueryValidator configuration updated', newConfig);
  }
}

export default QueryValidator;