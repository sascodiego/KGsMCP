import { logger } from '../utils/logger.js';
import Joi from 'joi';

/**
 * CONTEXT: Comprehensive MCP input validation and sanitization system
 * REASON: Secure and validate all inputs to MCP tools and handlers
 * CHANGE: Multi-layered validation with schema validation, security checks, and sanitization
 * PREVENTION: Injection attacks, data corruption, invalid inputs, and security vulnerabilities
 */

export class MCPInputValidator {
  constructor(config = {}) {
    this.config = {
      maxStringLength: config.maxStringLength || 100000,
      maxArrayLength: config.maxArrayLength || 10000,
      maxObjectDepth: config.maxObjectDepth || 10,
      maxObjectKeys: config.maxObjectKeys || 1000,
      enableSanitization: config.enableSanitization !== false,
      strictMode: config.strictMode !== false,
      enableLogging: config.enableLogging !== false,
      rateLimiting: {
        enabled: config.rateLimiting?.enabled || false,
        maxRequestsPerMinute: config.rateLimiting?.maxRequestsPerMinute || 100,
        maxRequestsPerHour: config.rateLimiting?.maxRequestsPerHour || 1000
      },
      ...config
    };

    // Validation schemas for each MCP tool
    this.toolSchemas = new Map();
    this.customValidators = new Map();
    this.sanitizationRules = new Map();
    
    // Rate limiting tracking
    this.requestCounts = new Map();
    this.requestCountsHourly = new Map();
    
    // Statistics
    this.stats = {
      totalValidations: 0,
      validInputs: 0,
      invalidInputs: 0,
      sanitizedInputs: 0,
      blockedInputs: 0,
      rateLimitedRequests: 0
    };

    this.initializeDefaultSchemas();
    this.initializeDefaultValidators();
    this.initializeDefaultSanitizers();
    this.setupRateLimitCleanup();

    logger.info('MCPInputValidator initialized', {
      strictMode: this.config.strictMode,
      rateLimitingEnabled: this.config.rateLimiting.enabled,
      schemasCount: this.toolSchemas.size
    });
  }

  /**
   * Main validation entry point for MCP tool calls
   */
  async validateToolInput(toolName, args, clientInfo = {}) {
    const startTime = Date.now();
    this.stats.totalValidations++;

    try {
      // Rate limiting check
      if (this.config.rateLimiting.enabled) {
        const rateLimitResult = await this.checkRateLimit(clientInfo);
        if (!rateLimitResult.allowed) {
          this.stats.rateLimitedRequests++;
          this.stats.blockedInputs++;
          
          return {
            isValid: false,
            sanitized: false,
            errors: ['Rate limit exceeded'],
            warnings: [],
            originalArgs: args,
            validatedArgs: null,
            metadata: {
              validationTime: Date.now() - startTime,
              riskLevel: 'HIGH',
              rateLimited: true
            }
          };
        }
      }

      const result = {
        isValid: true,
        sanitized: false,
        errors: [],
        warnings: [],
        originalArgs: args,
        validatedArgs: args,
        metadata: {
          validationTime: 0,
          riskLevel: 'LOW',
          rateLimited: false
        }
      };

      // Step 1: Schema validation
      await this.performSchemaValidation(toolName, args, result);
      
      if (!result.isValid && this.config.strictMode) {
        this.stats.invalidInputs++;
        return result;
      }

      // Step 2: Security validation
      await this.performSecurityValidation(args, result);
      
      if (!result.isValid && this.config.strictMode) {
        this.stats.blockedInputs++;
        return result;
      }

      // Step 3: Custom validation
      await this.performCustomValidation(toolName, args, result);

      // Step 4: Sanitization
      if (this.config.enableSanitization) {
        await this.performSanitization(toolName, result);
      }

      // Step 5: Final validation of sanitized data
      if (result.sanitized) {
        await this.performFinalValidation(toolName, result);
      }

      // Update statistics and metadata
      const validationTime = Date.now() - startTime;
      result.metadata.validationTime = validationTime;

      if (result.isValid) {
        this.stats.validInputs++;
        if (result.sanitized) {
          this.stats.sanitizedInputs++;
        }
      } else {
        this.stats.invalidInputs++;
      }

      if (this.config.enableLogging) {
        logger.debug('Input validation completed', {
          toolName,
          isValid: result.isValid,
          sanitized: result.sanitized,
          errorCount: result.errors.length,
          warningCount: result.warnings.length,
          validationTime: `${validationTime}ms`,
          riskLevel: result.metadata.riskLevel
        });
      }

      return result;

    } catch (error) {
      this.stats.invalidInputs++;
      
      logger.error('Input validation failed', {
        toolName,
        error: error.message,
        args: this.sanitizeArgsForLogging(args)
      });

      return {
        isValid: false,
        sanitized: false,
        errors: [`Validation error: ${error.message}`],
        warnings: [],
        originalArgs: args,
        validatedArgs: null,
        metadata: {
          validationTime: Date.now() - startTime,
          riskLevel: 'HIGH',
          rateLimited: false
        }
      };
    }
  }

  /**
   * Perform schema validation using Joi
   */
  async performSchemaValidation(toolName, args, result) {
    const schema = this.toolSchemas.get(toolName);
    
    if (!schema) {
      result.warnings.push(`No schema defined for tool: ${toolName}`);
      return;
    }

    try {
      const { error, value, warning } = schema.validate(args, {
        abortEarly: false,
        stripUnknown: true,
        convert: true
      });

      if (error) {
        result.errors.push(...error.details.map(detail => detail.message));
        result.isValid = false;
        result.metadata.riskLevel = 'MEDIUM';
      } else {
        result.validatedArgs = value;
        
        if (warning) {
          result.warnings.push(...warning.details.map(detail => detail.message));
        }
      }
    } catch (validationError) {
      result.errors.push(`Schema validation failed: ${validationError.message}`);
      result.isValid = false;
      result.metadata.riskLevel = 'HIGH';
    }
  }

  /**
   * Perform security validation
   */
  async performSecurityValidation(args, result) {
    // Check for injection patterns
    const injectionPatterns = [
      /(?:;|\|\||&&|\$\(|\`)/,  // Command injection
      /<script|javascript:|vbscript:|onload=/i,  // XSS patterns
      /(\%27)|(\')|(\')|(\-\-)|(\%23)|(#)/,  // SQL injection
      /(\bEXEC\b|\bEVAL\b|\bSYSTEM\b)/i,  // Dangerous functions
      /\${.*}|<%.*%>/,  // Template injection
    ];

    await this.validateRecursive(args, (value, path) => {
      if (typeof value === 'string') {
        // Check for suspicious patterns
        for (const pattern of injectionPatterns) {
          if (pattern.test(value)) {
            result.errors.push(`Potential injection detected at ${path}: ${pattern.source}`);
            result.isValid = false;
            result.metadata.riskLevel = 'CRITICAL';
          }
        }

        // Check for excessively long strings
        if (value.length > this.config.maxStringLength) {
          result.errors.push(`String too long at ${path}: ${value.length} > ${this.config.maxStringLength}`);
          result.isValid = false;
          result.metadata.riskLevel = 'HIGH';
        }

        // Check for binary data disguised as text
        if (this.containsBinaryData(value)) {
          result.warnings.push(`Potential binary data detected at ${path}`);
          result.metadata.riskLevel = 'MEDIUM';
        }

        // Check for encoded payloads
        if (this.hasEncodedPayload(value)) {
          result.warnings.push(`Encoded payload detected at ${path}`);
          result.metadata.riskLevel = 'MEDIUM';
        }
      }
    });

    // Check object structure limits
    const structureCheck = this.validateObjectStructure(args);
    if (!structureCheck.valid) {
      result.errors.push(...structureCheck.errors);
      result.isValid = false;
      result.metadata.riskLevel = 'HIGH';
    }
  }

  /**
   * Perform custom validation based on tool-specific rules
   */
  async performCustomValidation(toolName, args, result) {
    const validator = this.customValidators.get(toolName);
    
    if (validator) {
      try {
        const customResult = await validator(args, result);
        
        if (customResult && !customResult.isValid) {
          result.errors.push(...(customResult.errors || []));
          result.warnings.push(...(customResult.warnings || []));
          result.isValid = false;
          
          if (customResult.riskLevel) {
            result.metadata.riskLevel = customResult.riskLevel;
          }
        }
      } catch (error) {
        result.warnings.push(`Custom validation failed: ${error.message}`);
      }
    }
  }

  /**
   * Perform sanitization
   */
  async performSanitization(toolName, result) {
    const sanitizer = this.sanitizationRules.get(toolName) || this.sanitizationRules.get('default');
    
    if (sanitizer) {
      try {
        const sanitizationResult = await sanitizer(result.validatedArgs);
        
        if (sanitizationResult.modified) {
          result.validatedArgs = sanitizationResult.sanitizedArgs;
          result.sanitized = true;
          result.warnings.push('Input was sanitized');
          
          if (this.config.enableLogging) {
            logger.debug('Input sanitized', {
              toolName,
              original: this.sanitizeArgsForLogging(result.originalArgs),
              sanitized: this.sanitizeArgsForLogging(result.validatedArgs)
            });
          }
        }
      } catch (error) {
        result.warnings.push(`Sanitization failed: ${error.message}`);
      }
    }
  }

  /**
   * Final validation after sanitization
   */
  async performFinalValidation(toolName, result) {
    // Re-run security validation on sanitized data
    const finalSecurityResult = {
      isValid: true,
      errors: [],
      warnings: [],
      metadata: { riskLevel: 'LOW' }
    };

    await this.performSecurityValidation(result.validatedArgs, finalSecurityResult);
    
    if (!finalSecurityResult.isValid) {
      result.errors.push('Sanitized data still contains security issues');
      result.isValid = false;
      result.metadata.riskLevel = 'HIGH';
    }
  }

  /**
   * Check rate limits
   */
  async checkRateLimit(clientInfo) {
    const clientId = clientInfo.id || clientInfo.ip || 'anonymous';
    const now = Date.now();
    const minuteKey = `${clientId}:${Math.floor(now / 60000)}`;
    const hourKey = `${clientId}:${Math.floor(now / 3600000)}`;

    // Check minute limit
    const minuteCount = this.requestCounts.get(minuteKey) || 0;
    if (minuteCount >= this.config.rateLimiting.maxRequestsPerMinute) {
      return {
        allowed: false,
        reason: 'Rate limit exceeded (per minute)',
        retryAfter: 60 - (Math.floor(now / 1000) % 60)
      };
    }

    // Check hourly limit
    const hourCount = this.requestCountsHourly.get(hourKey) || 0;
    if (hourCount >= this.config.rateLimiting.maxRequestsPerHour) {
      return {
        allowed: false,
        reason: 'Rate limit exceeded (per hour)',
        retryAfter: 3600 - (Math.floor(now / 1000) % 3600)
      };
    }

    // Update counters
    this.requestCounts.set(minuteKey, minuteCount + 1);
    this.requestCountsHourly.set(hourKey, hourCount + 1);

    return { allowed: true };
  }

  /**
   * Validate object structure to prevent DoS attacks
   */
  validateObjectStructure(obj, depth = 0, path = 'root') {
    const errors = [];

    if (depth > this.config.maxObjectDepth) {
      errors.push(`Object nesting too deep at ${path}: ${depth} > ${this.config.maxObjectDepth}`);
      return { valid: false, errors };
    }

    if (Array.isArray(obj)) {
      if (obj.length > this.config.maxArrayLength) {
        errors.push(`Array too large at ${path}: ${obj.length} > ${this.config.maxArrayLength}`);
        return { valid: false, errors };
      }

      for (let i = 0; i < obj.length; i++) {
        const result = this.validateObjectStructure(obj[i], depth + 1, `${path}[${i}]`);
        if (!result.valid) {
          errors.push(...result.errors);
        }
      }
    } else if (obj && typeof obj === 'object') {
      const keys = Object.keys(obj);
      
      if (keys.length > this.config.maxObjectKeys) {
        errors.push(`Object has too many keys at ${path}: ${keys.length} > ${this.config.maxObjectKeys}`);
        return { valid: false, errors };
      }

      for (const key of keys) {
        const result = this.validateObjectStructure(obj[key], depth + 1, `${path}.${key}`);
        if (!result.valid) {
          errors.push(...result.errors);
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Recursively validate values
   */
  async validateRecursive(obj, validator, path = 'root') {
    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        await this.validateRecursive(obj[i], validator, `${path}[${i}]`);
      }
    } else if (obj && typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        await this.validateRecursive(value, validator, `${path}.${key}`);
      }
    } else {
      await validator(obj, path);
    }
  }

  /**
   * Check if string contains binary data
   */
  containsBinaryData(str) {
    // Check for null bytes and other binary indicators
    return /[\x00-\x08\x0E-\x1F\x7F-\xFF]/.test(str);
  }

  /**
   * Check for encoded payloads
   */
  hasEncodedPayload(str) {
    // Check for various encoding patterns
    const encodingPatterns = [
      /%[0-9A-Fa-f]{2}/,  // URL encoding
      /&#[0-9]+;|&#x[0-9A-Fa-f]+;/,  // HTML entities
      /\\u[0-9A-Fa-f]{4}/,  // Unicode escapes
      /\\x[0-9A-Fa-f]{2}/,  // Hex escapes
      /[A-Za-z0-9+/]{20,}={0,2}/  // Base64-like patterns
    ];

    return encodingPatterns.some(pattern => pattern.test(str));
  }

  /**
   * Initialize default schemas for MCP tools
   */
  initializeDefaultSchemas() {
    // Schema for define_domain_ontology
    this.toolSchemas.set('define_domain_ontology', Joi.object({
      entities: Joi.array().items(
        Joi.object({
          name: Joi.string().pattern(/^[a-zA-Z_][a-zA-Z0-9_]*$/).max(100).required(),
          type: Joi.string().valid('class', 'interface', 'enum', 'function', 'variable').required(),
          properties: Joi.object().pattern(Joi.string(), Joi.any()).max(50).optional(),
          description: Joi.string().max(1000).optional()
        })
      ).max(1000).required(),
      relationships: Joi.array().items(
        Joi.object({
          from: Joi.string().max(100).required(),
          to: Joi.string().max(100).required(),
          type: Joi.string().valid('implements', 'extends', 'uses', 'depends_on', 'contains').required(),
          properties: Joi.object().pattern(Joi.string(), Joi.any()).max(20).optional()
        })
      ).max(5000).optional(),
      businessRules: Joi.array().items(
        Joi.string().max(2000)
      ).max(100).optional(),
      codingStandards: Joi.object().pattern(
        Joi.string().max(50),
        Joi.alternatives().try(
          Joi.string().max(500),
          Joi.number(),
          Joi.boolean(),
          Joi.object().max(10)
        )
      ).max(100).optional()
    }));

    // Schema for query_context_for_task
    this.toolSchemas.set('query_context_for_task', Joi.object({
      taskDescription: Joi.string().min(5).max(5000).required(),
      entityTypes: Joi.array().items(
        Joi.string().max(50)
      ).max(100).optional(),
      depth: Joi.number().integer().min(1).max(10).default(2).optional()
    }));

    // Schema for generate_code_with_context
    this.toolSchemas.set('generate_code_with_context', Joi.object({
      requirement: Joi.string().min(10).max(10000).required(),
      contextIds: Joi.array().items(
        Joi.string().pattern(/^[a-zA-Z0-9_\-:.]+$/).max(200)
      ).max(1000).optional(),
      patternsToApply: Joi.array().items(
        Joi.string().max(100)
      ).max(50).optional(),
      constraints: Joi.object().pattern(
        Joi.string().max(50),
        Joi.alternatives().try(Joi.string().max(500), Joi.number(), Joi.boolean())
      ).max(50).optional()
    }));

    // Schema for validate_against_kg
    this.toolSchemas.set('validate_against_kg', Joi.object({
      codeSnippet: Joi.string().min(1).max(50000).required(),
      validationTypes: Joi.array().items(
        Joi.string().valid('patterns', 'rules', 'standards', 'security', 'performance')
      ).max(10).default(['patterns', 'rules', 'standards']).optional(),
      strictMode: Joi.boolean().default(true).optional()
    }));

    // Schema for extract_context_from_code
    this.toolSchemas.set('extract_context_from_code', Joi.object({
      filePath: Joi.string().pattern(/^[a-zA-Z0-9_\-./\\:]+$/).max(500).required(),
      codeSnippet: Joi.string().max(100000).optional()
    }));

    // Schema for detect_technical_debt
    this.toolSchemas.set('detect_technical_debt', Joi.object({
      scope: Joi.string().valid('module', 'project', 'specific').required(),
      target: Joi.string().max(500).required(),
      debtTypes: Joi.array().items(
        Joi.string().valid('complexity', 'duplication', 'coupling', 'cohesion', 'naming', 'documentation')
      ).max(10).default(['complexity', 'duplication', 'coupling']).optional()
    }));

    // Schema for suggest_refactoring
    this.toolSchemas.set('suggest_refactoring', Joi.object({
      codeEntity: Joi.string().max(500).required(),
      improvementGoals: Joi.array().items(
        Joi.string().valid('performance', 'maintainability', 'readability', 'testability', 'reusability')
      ).max(10).optional(),
      preserveBehavior: Joi.boolean().default(true).optional()
    }));

    // Schema for update_kg_from_code
    this.toolSchemas.set('update_kg_from_code', Joi.object({
      codeAnalysis: Joi.object({
        entities: Joi.array().items(Joi.object()).max(10000).optional(),
        relationships: Joi.array().items(Joi.object()).max(50000).optional(),
        patterns: Joi.array().items(Joi.object()).max(1000).optional(),
        metrics: Joi.object().optional()
      }).required(),
      decisions: Joi.array().items(
        Joi.object({
          id: Joi.string().max(100).required(),
          description: Joi.string().max(2000).required(),
          rationale: Joi.string().max(5000).optional(),
          alternatives: Joi.array().items(Joi.string().max(1000)).max(10).optional()
        })
      ).max(100).optional(),
      learnedPatterns: Joi.array().items(
        Joi.object({
          name: Joi.string().max(100).required(),
          description: Joi.string().max(2000).required(),
          confidence: Joi.number().min(0).max(1).optional(),
          examples: Joi.array().items(Joi.string().max(1000)).max(10).optional()
        })
      ).max(100).optional()
    }));

    // Schema for analyze_codebase
    this.toolSchemas.set('analyze_codebase', Joi.object({
      codebasePath: Joi.string().pattern(/^[a-zA-Z0-9_\-./\\:]+$/).max(1000).required(),
      includeGitHistory: Joi.boolean().default(true).optional(),
      maxDepth: Joi.number().integer().min(1).max(20).default(10).optional()
    }));

    // Schema for get_kg_statistics
    this.toolSchemas.set('get_kg_statistics', Joi.object({
      includeDetails: Joi.boolean().default(false).optional(),
      entityType: Joi.string().max(50).optional()
    }));

    // Arduino-specific schemas
    this.toolSchemas.set('analyze_arduino_sketch', Joi.object({
      sketchPath: Joi.string().pattern(/^[a-zA-Z0-9_\-./\\:]+$/).max(500).required(),
      targetBoard: Joi.string().valid('uno', 'mega2560', 'nano', 'esp32').default('uno').optional(),
      includeLibraries: Joi.boolean().default(true).optional()
    }));

    this.toolSchemas.set('validate_hardware_config', Joi.object({
      board: Joi.string().valid('uno', 'mega2560', 'nano', 'esp32').required(),
      components: Joi.array().items(
        Joi.object({
          pin: Joi.string().pattern(/^[A-Za-z0-9_]+$/).max(10).required(),
          usage: Joi.array().items(Joi.string().max(50)).max(10).required(),
          type: Joi.string().max(50).required()
        })
      ).max(100).required(),
      connections: Joi.array().items(
        Joi.object().pattern(Joi.string(), Joi.any())
      ).max(500).optional()
    }));

    this.toolSchemas.set('optimize_for_arduino', Joi.object({
      memoryUsage: Joi.object({
        ram: Joi.number().integer().min(0).max(1000000).optional(),
        flash: Joi.number().integer().min(0).max(10000000).optional(),
        eeprom: Joi.number().integer().min(0).max(100000).optional()
      }).optional(),
      targetBoard: Joi.string().valid('uno', 'mega2560', 'nano', 'esp32').required(),
      complexity: Joi.number().integer().min(0).max(1000).optional(),
      constraints: Joi.object({
        maxRAM: Joi.number().integer().min(0).max(1000000).optional(),
        maxFlash: Joi.number().integer().min(0).max(10000000).optional(),
        maxLoopTime: Joi.number().integer().min(0).max(1000000).optional()
      }).optional()
    }));

    this.toolSchemas.set('generate_interrupt_safe_code', Joi.object({
      functionality: Joi.string().min(5).max(2000).required(),
      interruptType: Joi.string().valid('external', 'timer', 'serial').default('external').optional(),
      sharedVariables: Joi.array().items(
        Joi.string().pattern(/^[a-zA-Z_][a-zA-Z0-9_]*$/).max(50)
      ).max(50).optional()
    }));

    this.toolSchemas.set('analyze_timing_constraints', Joi.object({
      codeEntity: Joi.string().max(500).required(),
      constraints: Joi.object({
        maxExecutionTime: Joi.number().integer().min(0).max(1000000).optional(),
        maxLoopTime: Joi.number().integer().min(0).max(1000000).optional(),
        realTimeDeadline: Joi.number().integer().min(0).max(1000000).optional()
      }).optional()
    }));

    logger.debug('Default validation schemas initialized', {
      schemaCount: this.toolSchemas.size
    });
  }

  /**
   * Initialize default custom validators
   */
  initializeDefaultValidators() {
    // File path validator
    this.customValidators.set('extract_context_from_code', async (args, result) => {
      const { filePath } = args;
      
      // Check for path traversal attempts
      if (filePath.includes('..') || filePath.includes('~')) {
        return {
          isValid: false,
          errors: ['Path traversal attempt detected'],
          riskLevel: 'CRITICAL'
        };
      }

      // Check for suspicious file extensions
      const suspiciousExtensions = ['.exe', '.bat', '.sh', '.cmd', '.com', '.scr'];
      const extension = filePath.toLowerCase().split('.').pop();
      
      if (suspiciousExtensions.includes(`.${extension}`)) {
        return {
          isValid: false,
          errors: ['Suspicious file extension detected'],
          riskLevel: 'HIGH'
        };
      }

      return { isValid: true };
    });

    // Code snippet validator
    this.customValidators.set('validate_against_kg', async (args, result) => {
      const { codeSnippet } = args;
      
      // Check for obfuscated code patterns
      const obfuscationPatterns = [
        /[a-zA-Z0-9]{50,}/,  // Long random strings
        /\\x[0-9A-Fa-f]{2}{10,}/,  // Excessive hex escapes
        /eval\s*\(/i,  // Eval usage
        /Function\s*\(/i,  // Function constructor
        /setTimeout\s*\(\s*["'].*["']/i  // String-based setTimeout
      ];

      for (const pattern of obfuscationPatterns) {
        if (pattern.test(codeSnippet)) {
          return {
            isValid: false,
            errors: ['Potentially obfuscated or malicious code detected'],
            riskLevel: 'HIGH'
          };
        }
      }

      return { isValid: true };
    });

    // Arduino hardware validator
    this.customValidators.set('validate_hardware_config', async (args, result) => {
      const { board, components } = args;
      
      // Board-specific pin validation
      const boardPins = {
        uno: { digital: 14, analog: 6, pwm: 6 },
        mega2560: { digital: 54, analog: 16, pwm: 15 },
        nano: { digital: 14, analog: 8, pwm: 6 },
        esp32: { digital: 34, analog: 18, pwm: 16 }
      };

      const boardConfig = boardPins[board];
      if (!boardConfig) {
        return {
          isValid: false,
          errors: ['Unknown board type'],
          riskLevel: 'MEDIUM'
        };
      }

      // Check for pin conflicts
      const usedPins = new Set();
      const errors = [];

      for (const component of components) {
        const pin = component.pin;
        
        if (usedPins.has(pin)) {
          errors.push(`Pin conflict detected: ${pin} used by multiple components`);
        }
        
        usedPins.add(pin);
        
        // Validate pin number
        if (pin.startsWith('D') || pin.startsWith('d')) {
          const pinNum = parseInt(pin.substring(1));
          if (pinNum >= boardConfig.digital) {
            errors.push(`Invalid digital pin: ${pin} (max: D${boardConfig.digital - 1})`);
          }
        } else if (pin.startsWith('A') || pin.startsWith('a')) {
          const pinNum = parseInt(pin.substring(1));
          if (pinNum >= boardConfig.analog) {
            errors.push(`Invalid analog pin: ${pin} (max: A${boardConfig.analog - 1})`);
          }
        }
      }

      if (errors.length > 0) {
        return {
          isValid: false,
          errors,
          riskLevel: 'MEDIUM'
        };
      }

      return { isValid: true };
    });

    logger.debug('Default custom validators initialized', {
      validatorCount: this.customValidators.size
    });
  }

  /**
   * Initialize default sanitizers
   */
  initializeDefaultSanitizers() {
    // Default sanitizer for all tools
    this.sanitizationRules.set('default', async (args) => {
      let modified = false;
      const sanitizedArgs = this.deepClone(args);

      // Sanitize all string values recursively
      const sanitizeValue = (obj, path = '') => {
        if (typeof obj === 'string') {
          const original = obj;
          let sanitized = obj;

          // Remove null bytes
          sanitized = sanitized.replace(/\x00/g, '');
          
          // Normalize Unicode
          try {
            sanitized = sanitized.normalize('NFKC');
          } catch (e) {
            // Ignore normalization errors
          }

          // Trim excessive whitespace
          sanitized = sanitized.replace(/\s{2,}/g, ' ').trim();

          // Limit length to prevent DoS
          if (sanitized.length > 50000) {
            sanitized = sanitized.substring(0, 50000) + '... [truncated]';
          }

          if (sanitized !== original) {
            modified = true;
          }

          return sanitized;

        } else if (Array.isArray(obj)) {
          return obj.map((item, index) => sanitizeValue(item, `${path}[${index}]`));
        } else if (obj && typeof obj === 'object') {
          const result = {};
          for (const [key, value] of Object.entries(obj)) {
            result[key] = sanitizeValue(value, `${path}.${key}`);
          }
          return result;
        }

        return obj;
      };

      const result = sanitizeValue(sanitizedArgs);
      
      return {
        modified,
        sanitizedArgs: result
      };
    });

    // Specific sanitizer for code snippets
    this.sanitizationRules.set('validate_against_kg', async (args) => {
      const sanitizedArgs = { ...args };
      let modified = false;

      if (sanitizedArgs.codeSnippet) {
        const original = sanitizedArgs.codeSnippet;
        let sanitized = original;

        // Remove dangerous patterns while preserving code structure
        sanitized = sanitized.replace(/eval\s*\(/gi, 'eval_SANITIZED(');
        sanitized = sanitized.replace(/Function\s*\(/gi, 'Function_SANITIZED(');
        sanitized = sanitized.replace(/document\s*\.\s*write/gi, 'document_write_SANITIZED');

        if (sanitized !== original) {
          modified = true;
          sanitizedArgs.codeSnippet = sanitized;
        }
      }

      return {
        modified,
        sanitizedArgs
      };
    });

    // Sanitizer for file paths
    this.sanitizationRules.set('extract_context_from_code', async (args) => {
      const sanitizedArgs = { ...args };
      let modified = false;

      if (sanitizedArgs.filePath) {
        const original = sanitizedArgs.filePath;
        let sanitized = original;

        // Normalize path separators
        sanitized = sanitized.replace(/\\/g, '/');
        
        // Remove double slashes
        sanitized = sanitized.replace(/\/+/g, '/');
        
        // Remove trailing slash
        sanitized = sanitized.replace(/\/$/, '');

        if (sanitized !== original) {
          modified = true;
          sanitizedArgs.filePath = sanitized;
        }
      }

      return {
        modified,
        sanitizedArgs
      };
    });

    logger.debug('Default sanitization rules initialized', {
      sanitizerCount: this.sanitizationRules.size
    });
  }

  /**
   * Setup rate limit cleanup
   */
  setupRateLimitCleanup() {
    if (!this.config.rateLimiting.enabled) return;

    // Cleanup old rate limit entries every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const currentMinute = Math.floor(now / 60000);
      const currentHour = Math.floor(now / 3600000);

      // Clean up minute counters older than 2 minutes
      for (const [key] of this.requestCounts) {
        const keyMinute = parseInt(key.split(':')[1]);
        if (currentMinute - keyMinute > 2) {
          this.requestCounts.delete(key);
        }
      }

      // Clean up hour counters older than 2 hours
      for (const [key] of this.requestCountsHourly) {
        const keyHour = parseInt(key.split(':')[1]);
        if (currentHour - keyHour > 2) {
          this.requestCountsHourly.delete(key);
        }
      }
    }, 5 * 60 * 1000);
  }

  /**
   * Add custom validation schema for a tool
   */
  addToolSchema(toolName, schema) {
    if (!Joi.isSchema(schema)) {
      throw new Error('Schema must be a Joi schema object');
    }
    
    this.toolSchemas.set(toolName, schema);
    logger.debug('Custom schema added', { toolName });
  }

  /**
   * Add custom validator for a tool
   */
  addCustomValidator(toolName, validator) {
    if (typeof validator !== 'function') {
      throw new Error('Validator must be a function');
    }
    
    this.customValidators.set(toolName, validator);
    logger.debug('Custom validator added', { toolName });
  }

  /**
   * Add custom sanitizer for a tool
   */
  addSanitizationRule(toolName, sanitizer) {
    if (typeof sanitizer !== 'function') {
      throw new Error('Sanitizer must be a function');
    }
    
    this.sanitizationRules.set(toolName, sanitizer);
    logger.debug('Custom sanitizer added', { toolName });
  }

  /**
   * Get validation statistics
   */
  getStatistics() {
    return {
      ...this.stats,
      successRate: this.stats.totalValidations > 0 ? 
        (this.stats.validInputs / this.stats.totalValidations * 100).toFixed(2) + '%' : '0%',
      sanitizationRate: this.stats.totalValidations > 0 ? 
        (this.stats.sanitizedInputs / this.stats.totalValidations * 100).toFixed(2) + '%' : '0%',
      blockRate: this.stats.totalValidations > 0 ? 
        (this.stats.blockedInputs / this.stats.totalValidations * 100).toFixed(2) + '%' : '0%',
      rateLimitRate: this.stats.totalValidations > 0 ? 
        (this.stats.rateLimitedRequests / this.stats.totalValidations * 100).toFixed(2) + '%' : '0%'
    };
  }

  /**
   * Reset statistics
   */
  resetStatistics() {
    this.stats = {
      totalValidations: 0,
      validInputs: 0,
      invalidInputs: 0,
      sanitizedInputs: 0,
      blockedInputs: 0,
      rateLimitedRequests: 0
    };
    
    logger.debug('Validation statistics reset');
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    logger.debug('MCPInputValidator configuration updated', newConfig);
  }

  /**
   * Utility: Deep clone object
   */
  deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (Array.isArray(obj)) return obj.map(item => this.deepClone(item));
    
    const cloned = {};
    for (const [key, value] of Object.entries(obj)) {
      cloned[key] = this.deepClone(value);
    }
    return cloned;
  }

  /**
   * Utility: Sanitize args for logging (remove sensitive data)
   */
  sanitizeArgsForLogging(args) {
    const sanitized = this.deepClone(args);
    
    const sanitizeRecursive = (obj) => {
      if (typeof obj === 'string') {
        if (obj.length > 200) {
          return obj.substring(0, 200) + '... [truncated for logging]';
        }
        return obj;
      } else if (Array.isArray(obj)) {
        return obj.slice(0, 10).map(item => sanitizeRecursive(item));
      } else if (obj && typeof obj === 'object') {
        const result = {};
        const keys = Object.keys(obj).slice(0, 20);
        for (const key of keys) {
          result[key] = sanitizeRecursive(obj[key]);
        }
        if (Object.keys(obj).length > 20) {
          result['...'] = `[${Object.keys(obj).length - 20} more keys]`;
        }
        return result;
      }
      return obj;
    };
    
    return sanitizeRecursive(sanitized);
  }
}

export default MCPInputValidator;