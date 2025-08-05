import { logger } from '../utils/logger.js';
import CypherQueryBuilder from './cypherQueryBuilder.js';

/**
 * CONTEXT: Query template system for common Kuzu database operations
 * REASON: Provide standardized, optimized queries for frequent operations
 * CHANGE: Comprehensive template library with customizable parameters
 * PREVENTION: Query duplication, inconsistencies, and performance issues
 */

export class QueryTemplateManager {
  constructor(client, optimizer = null) {
    this.client = client;
    this.optimizer = optimizer;
    this.templates = new Map();
    this.customTemplates = new Map();
    this.templateStats = new Map();
    
    this.initializeBuiltinTemplates();
    
    logger.info('QueryTemplateManager initialized', {
      builtinTemplates: this.templates.size
    });
  }

  /**
   * Initialize built-in query templates
   */
  initializeBuiltinTemplates() {
    // Entity Management Templates
    this.registerTemplate('findEntityById', {
      description: 'Find a specific entity by ID',
      parameters: ['entityId'],
      template: (params) => new CypherQueryBuilder(this.client)
        .match('(e:CodeEntity)')
        .where('e.id = $entityId', { entityId: params.entityId })
        .return(['e.*']),
      category: 'entity',
      complexity: 1
    });

    this.registerTemplate('findEntitiesByType', {
      description: 'Find all entities of a specific type',
      parameters: ['entityType', 'limit?'],
      template: (params) => {
        const builder = new CypherQueryBuilder(this.client)
          .match('(e:CodeEntity)')
          .where('e.type = $entityType', { entityType: params.entityType })
          .return(['e.id', 'e.name', 'e.filePath', 'e.type'])
          .orderBy('e.name');
        
        if (params.limit) {
          builder.limit(params.limit);
        }
        
        return builder;
      },
      category: 'entity',
      complexity: 2
    });

    this.registerTemplate('findEntitiesByFile', {
      description: 'Find all entities in a specific file',
      parameters: ['filePath'],
      template: (params) => new CypherQueryBuilder(this.client)
        .match('(e:CodeEntity)')
        .where('e.filePath = $filePath', { filePath: params.filePath })
        .return(['e.id', 'e.name', 'e.type', 'e.lineStart', 'e.lineEnd'])
        .orderBy('e.lineStart'),
      category: 'entity',
      complexity: 2
    });

    this.registerTemplate('createEntity', {
      description: 'Create a new code entity',
      parameters: ['id', 'type', 'name', 'filePath', 'properties?'],
      template: (params) => {
        const properties = {
          id: params.id,
          type: params.type,
          name: params.name,
          filePath: params.filePath,
          lastModified: Date.now(),
          ...params.properties
        };
        
        return new CypherQueryBuilder(this.client)
          .create('(e:CodeEntity $properties)', { properties })
          .return(['e']);
      },
      category: 'entity',
      complexity: 2,
      type: 'WRITE'
    });

    this.registerTemplate('updateEntityProperties', {
      description: 'Update properties of an existing entity',
      parameters: ['entityId', 'properties'],
      template: (params) => new CypherQueryBuilder(this.client)
        .match('(e:CodeEntity)')
        .where('e.id = $entityId', { entityId: params.entityId })
        .setProperties('e', { ...params.properties, lastModified: Date.now() })
        .return(['e']),
      category: 'entity',
      complexity: 2,
      type: 'WRITE'
    });

    // Pattern Analysis Templates
    this.registerTemplate('findPatternsForEntity', {
      description: 'Find all patterns implemented by an entity',
      parameters: ['entityId'],
      template: (params) => new CypherQueryBuilder(this.client)
        .match('(e:CodeEntity)-[impl:IMPLEMENTS]->(p:Pattern)')
        .where('e.id = $entityId', { entityId: params.entityId })
        .return(['p.name', 'p.description', 'p.category', 'impl.confidence'])
        .orderBy('impl.confidence', 'DESC'),
      category: 'pattern',
      complexity: 3
    });

    this.registerTemplate('findEntitiesImplementingPattern', {
      description: 'Find entities that implement a specific pattern',
      parameters: ['patternName', 'minConfidence?'],
      template: (params) => {
        const builder = new CypherQueryBuilder(this.client)
          .match('(e:CodeEntity)-[impl:IMPLEMENTS]->(p:Pattern)')
          .where('p.name = $patternName', { patternName: params.patternName });
        
        if (params.minConfidence) {
          builder.where('impl.confidence >= $minConfidence', 
            { minConfidence: params.minConfidence }, 'AND');
        }
        
        return builder
          .return(['e.id', 'e.name', 'e.type', 'e.filePath', 'impl.confidence'])
          .orderBy('impl.confidence', 'DESC');
      },
      category: 'pattern',
      complexity: 3
    });

    this.registerTemplate('createPatternImplementation', {
      description: 'Create a relationship between entity and pattern',
      parameters: ['entityId', 'patternName', 'confidence'],
      template: (params) => new CypherQueryBuilder(this.client)
        .match('(e:CodeEntity), (p:Pattern)')
        .where('e.id = $entityId AND p.name = $patternName', {
          entityId: params.entityId,
          patternName: params.patternName
        })
        .create('(e)-[impl:IMPLEMENTS {confidence: $confidence, timestamp: $timestamp}]->(p)', {
          confidence: params.confidence,
          timestamp: Date.now()
        })
        .return(['impl']),
      category: 'pattern',
      complexity: 3,
      type: 'WRITE'
    });

    // Dependency Analysis Templates
    this.registerTemplate('findDirectDependencies', {
      description: 'Find direct dependencies of an entity',
      parameters: ['entityId'],
      template: (params) => new CypherQueryBuilder(this.client)
        .match('(e:CodeEntity)-[dep:DEPENDS_ON]->(target:CodeEntity)')
        .where('e.id = $entityId', { entityId: params.entityId })
        .return(['target.id', 'target.name', 'target.type', 'dep.type', 'dep.strength'])
        .orderBy('dep.strength', 'DESC'),
      category: 'dependency',
      complexity: 3
    });

    this.registerTemplate('findTransitiveDependencies', {
      description: 'Find transitive dependencies of an entity',
      parameters: ['entityId', 'maxDepth?'],
      template: (params) => {
        const depth = params.maxDepth || 3;
        return new CypherQueryBuilder(this.client)
          .match(`(e:CodeEntity)-[:DEPENDS_ON*1..${depth}]->(target:CodeEntity)`)
          .where('e.id = $entityId', { entityId: params.entityId })
          .return(['target.id', 'target.name', 'target.type'])
          .returnDistinct(['target.id', 'target.name', 'target.type'])
          .orderBy('target.name');
      },
      category: 'dependency',
      complexity: 5
    });

    this.registerTemplate('findDependents', {
      description: 'Find entities that depend on this entity',
      parameters: ['entityId'],
      template: (params) => new CypherQueryBuilder(this.client)
        .match('(dependent:CodeEntity)-[dep:DEPENDS_ON]->(e:CodeEntity)')
        .where('e.id = $entityId', { entityId: params.entityId })
        .return(['dependent.id', 'dependent.name', 'dependent.type', 'dep.type'])
        .orderBy('dependent.name'),
      category: 'dependency',
      complexity: 3
    });

    this.registerTemplate('createDependency', {
      description: 'Create a dependency relationship between entities',
      parameters: ['fromEntityId', 'toEntityId', 'dependencyType', 'strength?'],
      template: (params) => new CypherQueryBuilder(this.client)
        .match('(from:CodeEntity), (to:CodeEntity)')
        .where('from.id = $fromEntityId AND to.id = $toEntityId', {
          fromEntityId: params.fromEntityId,
          toEntityId: params.toEntityId
        })
        .create('(from)-[dep:DEPENDS_ON {type: $depType, strength: $strength}]->(to)', {
          depType: params.dependencyType,
          strength: params.strength || 1.0
        })
        .return(['dep']),
      category: 'dependency',
      complexity: 3,
      type: 'WRITE'
    });

    // Rule Violation Templates
    this.registerTemplate('findViolationsByEntity', {
      description: 'Find rule violations for a specific entity',
      parameters: ['entityId'],
      template: (params) => new CypherQueryBuilder(this.client)
        .match('(e:CodeEntity)-[viol:VIOLATES]->(r:Rule)')
        .where('e.id = $entityId', { entityId: params.entityId })
        .return(['r.id', 'r.description', 'r.category', 'viol.severity', 'viol.message'])
        .orderBy('viol.severity', 'DESC'),
      category: 'validation',
      complexity: 3
    });

    this.registerTemplate('findViolationsByRule', {
      description: 'Find all violations of a specific rule',
      parameters: ['ruleId'],
      template: (params) => new CypherQueryBuilder(this.client)
        .match('(e:CodeEntity)-[viol:VIOLATES]->(r:Rule)')
        .where('r.id = $ruleId', { ruleId: params.ruleId })
        .return(['e.id', 'e.name', 'e.filePath', 'viol.severity', 'viol.message'])
        .orderBy('viol.severity', 'DESC'),
      category: 'validation',
      complexity: 3
    });

    this.registerTemplate('findViolationsBySeverity', {
      description: 'Find violations by severity level',
      parameters: ['severity', 'limit?'],
      template: (params) => {
        const builder = new CypherQueryBuilder(this.client)
          .match('(e:CodeEntity)-[viol:VIOLATES]->(r:Rule)')
          .where('viol.severity = $severity', { severity: params.severity })
          .return(['e.id', 'e.name', 'e.filePath', 'r.description', 'viol.message'])
          .orderBy('e.filePath');
        
        if (params.limit) {
          builder.limit(params.limit);
        }
        
        return builder;
      },
      category: 'validation',
      complexity: 3
    });

    this.registerTemplate('createViolation', {
      description: 'Create a rule violation relationship',
      parameters: ['entityId', 'ruleId', 'severity', 'message?'],
      template: (params) => new CypherQueryBuilder(this.client)
        .match('(e:CodeEntity), (r:Rule)')
        .where('e.id = $entityId AND r.id = $ruleId', {
          entityId: params.entityId,
          ruleId: params.ruleId
        })
        .create('(e)-[viol:VIOLATES {severity: $severity, message: $message, timestamp: $timestamp}]->(r)', {
          severity: params.severity,
          message: params.message || '',
          timestamp: Date.now()
        })
        .return(['viol']),
      category: 'validation',
      complexity: 3,
      type: 'WRITE'
    });

    // Analytics Templates
    this.registerTemplate('getEntityStatistics', {
      description: 'Get comprehensive statistics about entities',
      parameters: [],
      template: () => new CypherQueryBuilder(this.client)
        .match('(e:CodeEntity)')
        .return([
          'count(e) as totalEntities',
          'count(DISTINCT e.type) as entityTypes',
          'count(DISTINCT e.filePath) as filesWithEntities',
          'avg(e.complexity) as avgComplexity'
        ]),
      category: 'analytics',
      complexity: 4
    });

    this.registerTemplate('getPatternStatistics', {
      description: 'Get statistics about pattern implementations',
      parameters: [],
      template: () => new CypherQueryBuilder(this.client)
        .match('(p:Pattern)<-[impl:IMPLEMENTS]-(e:CodeEntity)')
        .return([
          'p.name as pattern',
          'count(impl) as implementations',
          'avg(impl.confidence) as avgConfidence',
          'max(impl.confidence) as maxConfidence'
        ])
        .orderBy('count(impl)', 'DESC'),
      category: 'analytics',
      complexity: 4
    });

    this.registerTemplate('getViolationStatistics', {
      description: 'Get statistics about rule violations',
      parameters: [],
      template: () => new CypherQueryBuilder(this.client)
        .match('(e:CodeEntity)-[viol:VIOLATES]->(r:Rule)')
        .return([
          'viol.severity as severity',
          'count(viol) as violationCount',
          'count(DISTINCT e) as affectedEntities',
          'count(DISTINCT r) as violatedRules'
        ])
        .orderBy('violationCount', 'DESC'),
      category: 'analytics',
      complexity: 4
    });

    this.registerTemplate('getDependencyComplexity', {
      description: 'Analyze dependency complexity for entities',
      parameters: ['entityType?'],
      template: (params) => {
        const builder = new CypherQueryBuilder(this.client)
          .match('(e:CodeEntity)')
          .optionalMatch('(e)-[:DEPENDS_ON]->(out:CodeEntity)')
          .optionalMatch('(in:CodeEntity)-[:DEPENDS_ON]->(e)');
        
        if (params.entityType) {
          builder.where('e.type = $entityType', { entityType: params.entityType });
        }
        
        return builder
          .return([
            'e.id as entityId',
            'e.name as entityName',
            'e.type as entityType',
            'count(DISTINCT out) as outgoingDependencies',
            'count(DISTINCT in) as incomingDependencies',
            '(count(DISTINCT out) + count(DISTINCT in)) as totalConnections'
          ])
          .orderBy('totalConnections', 'DESC');
      },
      category: 'analytics',
      complexity: 5
    });

    // Search Templates
    this.registerTemplate('searchEntitiesByName', {
      description: 'Search entities by name pattern',
      parameters: ['searchTerm', 'limit?'],
      template: (params) => {
        const builder = new CypherQueryBuilder(this.client)
          .match('(e:CodeEntity)')
          .where('toLower(e.name) CONTAINS toLower($searchTerm)', { 
            searchTerm: params.searchTerm 
          })
          .return(['e.id', 'e.name', 'e.type', 'e.filePath'])
          .orderBy('e.name');
        
        if (params.limit) {
          builder.limit(params.limit);
        }
        
        return builder;
      },
      category: 'search',
      complexity: 3
    });

    this.registerTemplate('searchByContext', {
      description: 'Search entities by context information',
      parameters: ['contextTerm', 'limit?'],
      template: (params) => {
        const builder = new CypherQueryBuilder(this.client)
          .match('(e:CodeEntity)')
          .where('toLower(e.context) CONTAINS toLower($contextTerm)', { 
            contextTerm: params.contextTerm 
          })
          .return(['e.id', 'e.name', 'e.type', 'e.context'])
          .orderBy('e.name');
        
        if (params.limit) {
          builder.limit(params.limit);
        }
        
        return builder;
      },
      category: 'search',
      complexity: 3
    });

    // Maintenance Templates
    this.registerTemplate('cleanupOrphanedEntities', {
      description: 'Find entities without any relationships',
      parameters: [],
      template: () => new CypherQueryBuilder(this.client)
        .match('(e:CodeEntity)')
        .where('NOT (e)-[]-() AND NOT ()-[]-(e)')
        .return(['e.id', 'e.name', 'e.type', 'e.filePath'])
        .orderBy('e.filePath'),
      category: 'maintenance',
      complexity: 4
    });

    this.registerTemplate('findDuplicateEntities', {
      description: 'Find potentially duplicate entities',
      parameters: [],
      template: () => new CypherQueryBuilder(this.client)
        .match('(e1:CodeEntity), (e2:CodeEntity)')
        .where('e1.name = e2.name AND e1.type = e2.type AND e1.id <> e2.id')
        .return(['e1.id as id1', 'e2.id as id2', 'e1.name as name', 'e1.type as type'])
        .orderBy('e1.name'),
      category: 'maintenance',
      complexity: 5
    });

    logger.info('Built-in query templates initialized', {
      templateCount: this.templates.size,
      categories: this.getTemplateCategories()
    });
  }

  /**
   * Register a new query template
   */
  registerTemplate(name, templateConfig) {
    if (!name || typeof name !== 'string') {
      throw new Error('Template name must be a non-empty string');
    }

    if (!templateConfig.template || typeof templateConfig.template !== 'function') {
      throw new Error('Template must have a template function');
    }

    const template = {
      name,
      description: templateConfig.description || '',
      parameters: templateConfig.parameters || [],
      template: templateConfig.template,
      category: templateConfig.category || 'custom',
      complexity: templateConfig.complexity || 1,
      type: templateConfig.type || 'READ',
      customizable: templateConfig.customizable !== false,
      createdAt: Date.now(),
      ...templateConfig
    };

    // Validate template by testing with dummy parameters
    try {
      const dummyParams = this.generateDummyParameters(template.parameters);
      const builder = template.template(dummyParams);
      
      if (!(builder instanceof CypherQueryBuilder)) {
        throw new Error('Template must return a CypherQueryBuilder instance');
      }
      
      // Test that we can build the query
      builder.build();
      
    } catch (error) {
      throw new Error(`Template validation failed: ${error.message}`);
    }

    this.templates.set(name, template);
    
    // Initialize statistics
    this.templateStats.set(name, {
      usageCount: 0,
      totalExecutionTime: 0,
      averageExecutionTime: 0,
      errors: 0,
      lastUsed: null
    });

    logger.debug('Template registered', {
      name,
      category: template.category,
      complexity: template.complexity
    });

    return template;
  }

  /**
   * Execute a template with parameters
   */
  async executeTemplate(templateName, parameters = {}, options = {}) {
    const template = this.templates.get(templateName);
    
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    const startTime = Date.now();
    
    try {
      // Validate parameters
      this.validateTemplateParameters(template, parameters);
      
      // Create query builder from template
      const builder = template.template(parameters);
      
      if (!(builder instanceof CypherQueryBuilder)) {
        throw new Error(`Template ${templateName} did not return a CypherQueryBuilder`);
      }

      // Apply optimization if optimizer is available
      if (this.optimizer && !options.skipOptimization) {
        const builtQuery = builder.build();
        const optimization = await this.optimizer.optimizeQuery(
          builtQuery.query,
          builtQuery.parameters,
          { template: templateName, ...builtQuery.metadata }
        );
        
        // Use optimized query if significantly better
        if (optimization.estimatedImprovement > 10) {
          const result = await this.client.query(
            optimization.optimizedQuery,
            optimization.parameters,
            options
          );
          
          const executionTime = Date.now() - startTime;
          this.updateTemplateStats(templateName, executionTime, true);
          
          return {
            result,
            template: templateName,
            optimized: true,
            executionTime,
            estimatedImprovement: optimization.estimatedImprovement
          };
        }
      }

      // Execute original query
      const result = await builder.execute(options);
      const executionTime = Date.now() - startTime;
      
      this.updateTemplateStats(templateName, executionTime, true);
      
      logger.debug('Template executed successfully', {
        templateName,
        executionTime: `${executionTime}ms`,
        resultCount: result.length
      });

      return {
        result,
        template: templateName,
        optimized: false,
        executionTime
      };

    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.updateTemplateStats(templateName, executionTime, false);
      
      logger.error('Template execution failed', {
        templateName,
        error: error.message,
        parameters
      });

      throw new Error(`Template execution failed: ${error.message}`);
    }
  }

  /**
   * Get a template builder without executing
   */
  getTemplate(templateName, parameters = {}) {
    const template = this.templates.get(templateName);
    
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    this.validateTemplateParameters(template, parameters);
    
    return template.template(parameters);
  }

  /**
   * List available templates
   */
  listTemplates(category = null) {
    const templates = Array.from(this.templates.values());
    
    if (category) {
      return templates.filter(t => t.category === category);
    }
    
    return templates.map(t => ({
      name: t.name,
      description: t.description,
      category: t.category,
      parameters: t.parameters,
      complexity: t.complexity,
      type: t.type
    }));
  }

  /**
   * Get template categories
   */
  getTemplateCategories() {
    const categories = new Set();
    
    for (const template of this.templates.values()) {
      categories.add(template.category);
    }
    
    return Array.from(categories);
  }

  /**
   * Get template statistics
   */
  getTemplateStatistics(templateName = null) {
    if (templateName) {
      const stats = this.templateStats.get(templateName);
      const template = this.templates.get(templateName);
      
      if (!stats || !template) {
        return null;
      }
      
      return {
        template: templateName,
        ...stats,
        successRate: stats.usageCount > 0 ? 
          ((stats.usageCount - stats.errors) / stats.usageCount * 100) : 0
      };
    }
    
    // Return all statistics
    const allStats = {};
    
    for (const [name, stats] of this.templateStats) {
      allStats[name] = {
        ...stats,
        successRate: stats.usageCount > 0 ? 
          ((stats.usageCount - stats.errors) / stats.usageCount * 100) : 0
      };
    }
    
    return allStats;
  }

  /**
   * Create a custom template from an existing query
   */
  createCustomTemplate(name, query, parameters = [], options = {}) {
    const template = {
      description: options.description || `Custom template: ${name}`,
      parameters,
      template: (params) => {
        // Create a new builder and parse the query
        const builder = new CypherQueryBuilder(this.client);
        
        // This is a simplified approach - in practice you'd need
        // a more sophisticated query parser
        const { query: processedQuery, parameters: processedParams } = 
          this.processCustomQuery(query, params);
        
        return builder.reset().match('').build = () => ({
          query: processedQuery,
          parameters: processedParams
        });
      },
      category: options.category || 'custom',
      complexity: options.complexity || this.estimateQueryComplexity(query),
      type: options.type || this.detectQueryType(query),
      customizable: true
    };

    return this.registerTemplate(name, template);
  }

  /**
   * Export templates to JSON
   */
  exportTemplates(category = null) {
    const templates = this.listTemplates(category);
    const stats = this.getTemplateStatistics();
    
    return {
      templates: templates.map(t => ({
        ...t,
        statistics: stats[t.name] || null
      })),
      exportedAt: new Date().toISOString(),
      category
    };
  }

  /**
   * Validate template parameters
   */
  validateTemplateParameters(template, parameters) {
    const requiredParams = template.parameters.filter(p => !p.endsWith('?'));
    const optionalParams = template.parameters.filter(p => p.endsWith('?'))
      .map(p => p.slice(0, -1));
    
    // Check required parameters
    for (const param of requiredParams) {
      if (!(param in parameters)) {
        throw new Error(`Required parameter missing: ${param}`);
      }
      
      if (parameters[param] === null || parameters[param] === undefined) {
        throw new Error(`Parameter ${param} cannot be null or undefined`);
      }
    }
    
    // Check for unknown parameters
    const allValidParams = [...requiredParams, ...optionalParams];
    for (const param of Object.keys(parameters)) {
      if (!allValidParams.includes(param)) {
        logger.warn(`Unknown parameter provided to template ${template.name}: ${param}`);
      }
    }
  }

  /**
   * Generate dummy parameters for template validation
   */
  generateDummyParameters(parameterNames) {
    const dummyParams = {};
    
    for (const param of parameterNames) {
      const cleanParam = param.endsWith('?') ? param.slice(0, -1) : param;
      
      // Generate appropriate dummy values based on parameter name
      if (cleanParam.includes('Id')) {
        dummyParams[cleanParam] = 'dummy-id-123';
      } else if (cleanParam.includes('Type')) {
        dummyParams[cleanParam] = 'function';
      } else if (cleanParam.includes('Name')) {
        dummyParams[cleanParam] = 'dummyName';
      } else if (cleanParam.includes('Path')) {
        dummyParams[cleanParam] = '/dummy/path.js';
      } else if (cleanParam.includes('limit') || cleanParam.includes('Limit')) {
        dummyParams[cleanParam] = 10;
      } else if (cleanParam.includes('confidence') || cleanParam.includes('Confidence')) {
        dummyParams[cleanParam] = 0.8;
      } else {
        dummyParams[cleanParam] = 'dummy-value';
      }
    }
    
    return dummyParams;
  }

  /**
   * Update template usage statistics
   */
  updateTemplateStats(templateName, executionTime, success) {
    const stats = this.templateStats.get(templateName);
    
    if (stats) {
      stats.usageCount++;
      stats.lastUsed = Date.now();
      
      if (success) {
        stats.totalExecutionTime += executionTime;
        stats.averageExecutionTime = stats.totalExecutionTime / 
          (stats.usageCount - stats.errors);
      } else {
        stats.errors++;
      }
    }
  }

  /**
   * Process custom query with parameter substitution
   */
  processCustomQuery(query, parameters) {
    let processedQuery = query;
    const processedParams = {};
    
    // Simple parameter substitution - in practice this would be more sophisticated
    for (const [key, value] of Object.entries(parameters)) {
      const paramRegex = new RegExp(`\\$${key}\\b`, 'g');
      if (processedQuery.includes(`$${key}`)) {
        processedParams[key] = value;
      }
    }
    
    return { query: processedQuery, parameters: processedParams };
  }

  /**
   * Estimate query complexity
   */
  estimateQueryComplexity(query) {
    let complexity = 1;
    
    complexity += (query.match(/MATCH/gi) || []).length;
    complexity += (query.match(/-\[.*?\]-/g) || []).length * 2;
    complexity += (query.match(/\*\d*\.\.\d*/g) || []).length * 5;
    
    return Math.min(complexity, 10);
  }

  /**
   * Detect query type
   */
  detectQueryType(query) {
    const upperQuery = query.toUpperCase();
    
    if (upperQuery.includes('CREATE') || upperQuery.includes('MERGE')) {
      return 'WRITE';
    } else if (upperQuery.includes('DELETE') || upperQuery.includes('REMOVE')) {
      return 'DELETE';
    } else if (upperQuery.includes('SET')) {
      return 'UPDATE';
    } else {
      return 'READ';
    }
  }

  /**
   * Clear template statistics
   */
  clearStatistics(templateName = null) {
    if (templateName) {
      const stats = this.templateStats.get(templateName);
      if (stats) {
        Object.assign(stats, {
          usageCount: 0,
          totalExecutionTime: 0,
          averageExecutionTime: 0,
          errors: 0,
          lastUsed: null
        });
      }
    } else {
      for (const stats of this.templateStats.values()) {
        Object.assign(stats, {
          usageCount: 0,
          totalExecutionTime: 0,
          averageExecutionTime: 0,
          errors: 0,
          lastUsed: null
        });
      }
    }
    
    logger.debug('Template statistics cleared', { templateName });
  }

  /**
   * Remove a template
   */
  removeTemplate(templateName) {
    const removed = this.templates.delete(templateName);
    this.templateStats.delete(templateName);
    
    if (removed) {
      logger.debug('Template removed', { templateName });
    }
    
    return removed;
  }
}

export default QueryTemplateManager;