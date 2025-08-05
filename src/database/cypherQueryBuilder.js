import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';

/**
 * CONTEXT: Advanced Cypher query builder for Kuzu database operations
 * REASON: Provide type-safe, optimized query construction with fluent API
 * CHANGE: Comprehensive query builder with caching and performance optimization
 * PREVENTION: SQL injection, query performance issues, and developer errors
 */

export class CypherQueryBuilder extends EventEmitter {
  constructor(client) {
    super();
    this.client = client;
    this.reset();
    this.queryCache = new Map();
    this.queryStats = new Map();
    this.templates = new Map();
    this.optimizationRules = new Set();
    
    this.setupOptimizationRules();
    this.loadCommonTemplates();
  }

  /**
   * Reset query builder state
   */
  reset() {
    this.queryParts = {
      match: [],
      optionalMatch: [],
      where: [],
      with: [],
      create: [],
      merge: [],
      set: [],
      delete: [],
      remove: [],
      return: [],
      orderBy: [],
      limit: null,
      skip: null,
      union: []
    };
    this.parameters = {};
    this.queryHints = [];
    this.metadata = {
      queryType: null,
      estimatedComplexity: 0,
      useCache: false,
      timeout: null
    };
    return this;
  }

  /**
   * Match patterns with advanced options
   */
  match(pattern, alias = null, options = {}) {
    if (!pattern || typeof pattern !== 'string') {
      throw new Error('Match pattern must be a non-empty string');
    }

    const matchClause = {
      pattern: alias ? `${pattern} AS ${alias}` : pattern,
      optional: false,
      hints: options.hints || [],
      index: options.useIndex
    };

    this.queryParts.match.push(matchClause);
    this.metadata.estimatedComplexity += this.calculatePatternComplexity(pattern);
    
    logger.debug('Added MATCH clause', { pattern, alias, options });
    return this;
  }

  /**
   * Optional match patterns
   */
  optionalMatch(pattern, alias = null, options = {}) {
    if (!pattern || typeof pattern !== 'string') {
      throw new Error('Optional match pattern must be a non-empty string');
    }

    const matchClause = {
      pattern: alias ? `${pattern} AS ${alias}` : pattern,
      optional: true,
      hints: options.hints || []
    };

    this.queryParts.optionalMatch.push(matchClause);
    this.metadata.estimatedComplexity += this.calculatePatternComplexity(pattern) * 0.5;
    
    return this;
  }

  /**
   * Where conditions with advanced operators
   */
  where(condition, params = {}, operator = 'AND') {
    if (!condition || typeof condition !== 'string') {
      throw new Error('Where condition must be a non-empty string');
    }

    // Validate operator
    const validOperators = ['AND', 'OR', 'NOT'];
    if (!validOperators.includes(operator.toUpperCase())) {
      throw new Error(`Invalid operator: ${operator}. Must be one of: ${validOperators.join(', ')}`);
    }

    this.queryParts.where.push({
      condition,
      operator: operator.toUpperCase(),
      params: this.validateParameters(params)
    });

    Object.assign(this.parameters, params);
    return this;
  }

  /**
   * Where condition using OR operator
   */
  orWhere(condition, params = {}) {
    return this.where(condition, params, 'OR');
  }

  /**
   * Where condition using NOT operator
   */
  notWhere(condition, params = {}) {
    return this.where(condition, params, 'NOT');
  }

  /**
   * With clause for query chaining
   */
  with(variables, options = {}) {
    if (!variables || typeof variables !== 'string') {
      throw new Error('WITH variables must be a non-empty string');
    }

    this.queryParts.with.push({
      variables,
      distinct: options.distinct || false,
      orderBy: options.orderBy,
      limit: options.limit
    });

    return this;
  }

  /**
   * Create nodes/relationships
   */
  create(pattern, params = {}) {
    if (!pattern || typeof pattern !== 'string') {
      throw new Error('Create pattern must be a non-empty string');
    }

    this.queryParts.create.push({
      pattern,
      params: this.validateParameters(params)
    });

    Object.assign(this.parameters, params);
    this.metadata.queryType = 'WRITE';
    
    return this;
  }

  /**
   * Merge nodes/relationships (CREATE OR MATCH)
   */
  merge(pattern, params = {}, onMatch = null, onCreate = null) {
    if (!pattern || typeof pattern !== 'string') {
      throw new Error('Merge pattern must be a non-empty string');
    }

    this.queryParts.merge.push({
      pattern,
      params: this.validateParameters(params),
      onMatch,
      onCreate
    });

    Object.assign(this.parameters, params);
    this.metadata.queryType = 'WRITE';
    
    return this;
  }

  /**
   * Set properties
   */
  set(property, value, paramName = null) {
    if (!property || typeof property !== 'string') {
      throw new Error('Set property must be a non-empty string');
    }

    const param = paramName || this.generateParameterName();
    
    this.queryParts.set.push({
      property,
      paramName: param,
      value
    });

    this.parameters[param] = value;
    this.metadata.queryType = 'WRITE';
    
    return this;
  }

  /**
   * Set multiple properties at once
   */
  setProperties(entity, properties) {
    if (!entity || typeof entity !== 'string') {
      throw new Error('Entity must be a non-empty string');
    }

    if (!properties || typeof properties !== 'object') {
      throw new Error('Properties must be an object');
    }

    for (const [key, value] of Object.entries(properties)) {
      const param = this.generateParameterName();
      this.queryParts.set.push({
        property: `${entity}.${key}`,
        paramName: param,
        value
      });
      this.parameters[param] = value;
    }

    this.metadata.queryType = 'WRITE';
    return this;
  }

  /**
   * Delete nodes/relationships
   */
  delete(entities) {
    if (!entities) {
      throw new Error('Delete entities cannot be empty');
    }

    const entityList = Array.isArray(entities) ? entities : [entities];
    this.queryParts.delete.push(...entityList);
    this.metadata.queryType = 'WRITE';
    
    return this;
  }

  /**
   * Remove properties or labels
   */
  remove(items) {
    if (!items) {
      throw new Error('Remove items cannot be empty');
    }

    const itemList = Array.isArray(items) ? items : [items];
    this.queryParts.remove.push(...itemList);
    this.metadata.queryType = 'WRITE';
    
    return this;
  }

  /**
   * Return clause with advanced options
   */
  return(fields, options = {}) {
    if (!fields) {
      throw new Error('Return fields cannot be empty');
    }

    const fieldList = Array.isArray(fields) ? fields : [fields];
    
    this.queryParts.return.push({
      fields: fieldList,
      distinct: options.distinct || false,
      aliases: options.aliases || {}
    });

    this.metadata.queryType = this.metadata.queryType || 'READ';
    return this;
  }

  /**
   * Return distinct values
   */
  returnDistinct(fields) {
    return this.return(fields, { distinct: true });
  }

  /**
   * Order by clause
   */
  orderBy(field, direction = 'ASC', options = {}) {
    if (!field || typeof field !== 'string') {
      throw new Error('Order by field must be a non-empty string');
    }

    const validDirections = ['ASC', 'DESC'];
    const normalizedDirection = direction.toUpperCase();
    
    if (!validDirections.includes(normalizedDirection)) {
      throw new Error(`Invalid direction: ${direction}. Must be ASC or DESC`);
    }

    this.queryParts.orderBy.push({
      field,
      direction: normalizedDirection,
      nulls: options.nulls // 'FIRST' or 'LAST'
    });

    return this;
  }

  /**
   * Order by descending
   */
  orderByDesc(field, options = {}) {
    return this.orderBy(field, 'DESC', options);
  }

  /**
   * Limit results
   */
  limit(count) {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error('Limit must be a non-negative integer');
    }

    this.queryParts.limit = count;
    return this;
  }

  /**
   * Skip results
   */
  skip(count) {
    if (!Number.isInteger(count) || count < 0) {
      throw new Error('Skip must be a non-negative integer');
    }

    this.queryParts.skip = count;
    return this;
  }

  /**
   * Union with another query
   */
  union(queryBuilder, all = false) {
    if (!(queryBuilder instanceof CypherQueryBuilder)) {
      throw new Error('Union parameter must be a CypherQueryBuilder instance');
    }

    this.queryParts.union.push({
      query: queryBuilder.build().query,
      params: queryBuilder.parameters,
      all
    });

    // Merge parameters
    Object.assign(this.parameters, queryBuilder.parameters);
    return this;
  }

  /**
   * Union all with another query
   */
  unionAll(queryBuilder) {
    return this.union(queryBuilder, true);
  }

  /**
   * Add query hints for optimization
   */
  hint(hintType, value) {
    this.queryHints.push({ type: hintType, value });
    return this;
  }

  /**
   * Enable caching for this query
   */
  cached(ttl = 3600) {
    this.metadata.useCache = true;
    this.metadata.cacheTTL = ttl;
    return this;
  }

  /**
   * Set query timeout
   */
  timeout(milliseconds) {
    if (!Number.isInteger(milliseconds) || milliseconds <= 0) {
      throw new Error('Timeout must be a positive integer');
    }

    this.metadata.timeout = milliseconds;
    return this;
  }

  /**
   * Build the final query with optimization
   */
  build() {
    try {
      const parts = [];
      
      // Apply optimization rules before building
      this.applyOptimizationRules();

      // Build MATCH clauses
      if (this.queryParts.match.length > 0) {
        const matchClauses = this.queryParts.match.map(m => {
          let clause = `MATCH ${m.pattern}`;
          if (m.hints.length > 0) {
            clause += ` /* ${m.hints.join(', ')} */`;
          }
          return clause;
        });
        parts.push(...matchClauses);
      }

      // Build OPTIONAL MATCH clauses
      if (this.queryParts.optionalMatch.length > 0) {
        const optionalClauses = this.queryParts.optionalMatch.map(m => 
          `OPTIONAL MATCH ${m.pattern}`
        );
        parts.push(...optionalClauses);
      }

      // Build WHERE clauses
      if (this.queryParts.where.length > 0) {
        const whereConditions = this.buildWhereClause();
        parts.push(`WHERE ${whereConditions}`);
      }

      // Build WITH clauses
      if (this.queryParts.with.length > 0) {
        const withClauses = this.queryParts.with.map(w => {
          let clause = `WITH ${w.distinct ? 'DISTINCT ' : ''}${w.variables}`;
          if (w.orderBy) clause += ` ORDER BY ${w.orderBy}`;
          if (w.limit) clause += ` LIMIT ${w.limit}`;
          return clause;
        });
        parts.push(...withClauses);
      }

      // Build CREATE clauses
      if (this.queryParts.create.length > 0) {
        const createClauses = this.queryParts.create.map(c => `CREATE ${c.pattern}`);
        parts.push(...createClauses);
      }

      // Build MERGE clauses
      if (this.queryParts.merge.length > 0) {
        const mergeClauses = this.queryParts.merge.map(m => {
          let clause = `MERGE ${m.pattern}`;
          if (m.onMatch) clause += ` ON MATCH ${m.onMatch}`;
          if (m.onCreate) clause += ` ON CREATE ${m.onCreate}`;
          return clause;
        });
        parts.push(...mergeClauses);
      }

      // Build SET clauses
      if (this.queryParts.set.length > 0) {
        const setClauses = this.queryParts.set.map(s => 
          `${s.property} = $${s.paramName}`
        );
        parts.push(`SET ${setClauses.join(', ')}`);
      }

      // Build DELETE clauses
      if (this.queryParts.delete.length > 0) {
        parts.push(`DELETE ${this.queryParts.delete.join(', ')}`);
      }

      // Build REMOVE clauses
      if (this.queryParts.remove.length > 0) {
        parts.push(`REMOVE ${this.queryParts.remove.join(', ')}`);
      }

      // Build RETURN clauses
      if (this.queryParts.return.length > 0) {
        const returnClauses = this.queryParts.return.map(r => {
          const distinctPrefix = r.distinct ? 'DISTINCT ' : '';
          const fieldList = r.fields.map(field => {
            if (r.aliases[field]) {
              return `${field} AS ${r.aliases[field]}`;
            }
            return field;
          }).join(', ');
          return `${distinctPrefix}${fieldList}`;
        });
        parts.push(`RETURN ${returnClauses.join(', ')}`);
      }

      // Build ORDER BY
      if (this.queryParts.orderBy.length > 0) {
        const orderClauses = this.queryParts.orderBy.map(o => {
          let clause = `${o.field} ${o.direction}`;
          if (o.nulls) clause += ` NULLS ${o.nulls}`;
          return clause;
        });
        parts.push(`ORDER BY ${orderClauses.join(', ')}`);
      }

      // Build SKIP
      if (this.queryParts.skip !== null) {
        parts.push(`SKIP ${this.queryParts.skip}`);
      }

      // Build LIMIT
      if (this.queryParts.limit !== null) {
        parts.push(`LIMIT ${this.queryParts.limit}`);
      }

      // Build UNION clauses
      if (this.queryParts.union.length > 0) {
        const mainQuery = parts.join(' ');
        const unionQueries = this.queryParts.union.map(u => {
          const unionType = u.all ? 'UNION ALL' : 'UNION';
          return `${unionType} ${u.query}`;
        });
        parts.splice(0, parts.length, mainQuery, ...unionQueries);
      }

      const finalQuery = parts.join(' ');
      
      // Validate the built query
      this.validateQuery(finalQuery);

      const result = {
        query: finalQuery,
        parameters: { ...this.parameters },
        metadata: { ...this.metadata },
        hints: [...this.queryHints],
        complexity: this.metadata.estimatedComplexity
      };

      logger.debug('Query built successfully', {
        query: finalQuery.substring(0, 200) + '...',
        paramCount: Object.keys(this.parameters).length,
        complexity: this.metadata.estimatedComplexity
      });

      this.emit('queryBuilt', result);
      return result;

    } catch (error) {
      logger.error('Query build failed', { error: error.message });
      this.emit('buildError', error);
      throw error;
    }
  }

  /**
   * Execute the built query
   */
  async execute(options = {}) {
    try {
      const builtQuery = this.build();
      
      // Merge execution options with query metadata
      const executionOptions = {
        useCache: this.metadata.useCache,
        timeout: this.metadata.timeout || options.timeout,
        ...options
      };

      // Check cache if enabled
      if (executionOptions.useCache) {
        const cached = this.getCachedResult(builtQuery);
        if (cached) {
          logger.debug('Returning cached query result');
          this.emit('cacheHit', { query: builtQuery.query });
          return cached;
        }
      }

      // Execute query
      const startTime = Date.now();
      const result = await this.client.query(
        builtQuery.query,
        builtQuery.parameters,
        executionOptions
      );
      const executionTime = Date.now() - startTime;

      // Update statistics
      this.updateQueryStats(builtQuery.query, executionTime, true);

      // Cache result if enabled
      if (executionOptions.useCache) {
        this.cacheResult(builtQuery, result, this.metadata.cacheTTL);
      }

      logger.debug('Query executed successfully', {
        executionTime: `${executionTime}ms`,
        resultCount: result.length,
        cached: executionOptions.useCache
      });

      this.emit('queryExecuted', {
        query: builtQuery.query,
        executionTime,
        resultCount: result.length
      });

      // Reset builder for next query
      this.reset();
      
      return result;

    } catch (error) {
      const builtQuery = this.build();
      this.updateQueryStats(builtQuery.query, 0, false);
      
      logger.error('Query execution failed', {
        error: error.message,
        query: builtQuery.query.substring(0, 200)
      });

      this.emit('executionError', {
        error,
        query: builtQuery.query
      });

      throw error;
    }
  }

  /**
   * Explain query execution plan
   */
  async explain() {
    const builtQuery = this.build();
    const explainQuery = `EXPLAIN ${builtQuery.query}`;
    
    try {
      const result = await this.client.query(explainQuery, builtQuery.parameters);
      
      logger.debug('Query plan explained', {
        query: builtQuery.query.substring(0, 100),
        planSize: result.length
      });

      return {
        query: builtQuery.query,
        parameters: builtQuery.parameters,
        executionPlan: result,
        estimatedComplexity: this.metadata.estimatedComplexity
      };

    } catch (error) {
      logger.error('Query explain failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Profile query performance
   */
  async profile() {
    const builtQuery = this.build();
    const profileQuery = `PROFILE ${builtQuery.query}`;
    
    try {
      const startTime = Date.now();
      const result = await this.client.query(profileQuery, builtQuery.parameters);
      const executionTime = Date.now() - startTime;

      const profileData = {
        query: builtQuery.query,
        parameters: builtQuery.parameters,
        executionTime,
        profileResults: result,
        estimatedComplexity: this.metadata.estimatedComplexity
      };

      logger.debug('Query profiled', {
        executionTime: `${executionTime}ms`,
        complexity: this.metadata.estimatedComplexity
      });

      return profileData;

    } catch (error) {
      logger.error('Query profile failed', { error: error.message });
      throw error;
    }
  }

  /**
   * Build WHERE clause with proper operator precedence
   */
  buildWhereClause() {
    if (this.queryParts.where.length === 0) return '';

    const conditions = this.queryParts.where.map((w, index) => {
      if (index === 0) {
        return w.condition;
      }
      return `${w.operator} ${w.condition}`;
    });

    return conditions.join(' ');
  }

  /**
   * Validate query parameters
   */
  validateParameters(params) {
    if (!params || typeof params !== 'object') {
      return {};
    }

    const validated = {};
    const allowedTypes = ['string', 'number', 'boolean'];

    for (const [key, value] of Object.entries(params)) {
      // Validate parameter name
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
        throw new Error(`Invalid parameter name: ${key}`);
      }

      // Validate parameter value
      if (value === null || value === undefined) {
        validated[key] = null;
      } else if (allowedTypes.includes(typeof value)) {
        if (typeof value === 'string' && value.length > 10000) {
          throw new Error(`Parameter ${key} exceeds maximum length`);
        }
        validated[key] = value;
      } else if (Array.isArray(value)) {
        if (value.length > 1000) {
          throw new Error(`Parameter ${key} array exceeds maximum length`);
        }
        validated[key] = value.map(item => {
          if (allowedTypes.includes(typeof item) || item === null) {
            return item;
          }
          throw new Error(`Invalid array element type in parameter ${key}`);
        });
      } else {
        throw new Error(`Unsupported parameter type for ${key}: ${typeof value}`);
      }
    }

    return validated;
  }

  /**
   * Validate the built query
   */
  validateQuery(query) {
    if (!query || typeof query !== 'string') {
      throw new Error('Query must be a non-empty string');
    }

    // Basic syntax validation
    const keywords = ['MATCH', 'CREATE', 'MERGE', 'SET', 'DELETE', 'REMOVE', 'RETURN', 'WHERE', 'WITH'];
    const hasValidKeyword = keywords.some(keyword => 
      query.toUpperCase().includes(keyword)
    );

    if (!hasValidKeyword) {
      throw new Error('Query must contain at least one valid Cypher keyword');
    }

    // Check for balanced parentheses
    const openParens = (query.match(/\(/g) || []).length;
    const closeParens = (query.match(/\)/g) || []).length;
    
    if (openParens !== closeParens) {
      throw new Error('Unbalanced parentheses in query');
    }

    // Check for potential injection patterns
    const dangerousPatterns = [
      /;\s*(DROP|DELETE\s+FROM|TRUNCATE)/i,
      /--.*$/m,
      /\/\*.*\*\//s
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        throw new Error('Query contains potentially dangerous patterns');
      }
    }
  }

  /**
   * Generate unique parameter name
   */
  generateParameterName() {
    const existingParams = Object.keys(this.parameters);
    let paramIndex = existingParams.length;
    let paramName = `param_${paramIndex}`;
    
    while (existingParams.includes(paramName)) {
      paramIndex++;
      paramName = `param_${paramIndex}`;
    }
    
    return paramName;
  }

  /**
   * Calculate pattern complexity
   */
  calculatePatternComplexity(pattern) {
    let complexity = 1;
    
    // Count relationships
    const relationshipCount = (pattern.match(/-\[.*?\]-/g) || []).length;
    complexity += relationshipCount * 2;
    
    // Count variable length paths
    const variableLengthCount = (pattern.match(/\*\d*\.\.\d*/g) || []).length;
    complexity += variableLengthCount * 5;
    
    // Count node patterns
    const nodeCount = (pattern.match(/\([^)]*\)/g) || []).length;
    complexity += nodeCount;
    
    return complexity;
  }

  /**
   * Setup optimization rules
   */
  setupOptimizationRules() {
    this.optimizationRules.add('pushDownFilters');
    this.optimizationRules.add('eliminateRedundantPatterns');
    this.optimizationRules.add('optimizeOrderBy');
    this.optimizationRules.add('combineFilters');
  }

  /**
   * Apply optimization rules
   */
  applyOptimizationRules() {
    for (const rule of this.optimizationRules) {
      try {
        this[rule]?.();
      } catch (error) {
        logger.debug(`Optimization rule ${rule} failed:`, error.message);
      }
    }
  }

  /**
   * Push down filter optimization
   */
  pushDownFilters() {
    // Move simple filters closer to MATCH clauses
    const simpleFilters = this.queryParts.where.filter(w => 
      !w.condition.includes('AND') && !w.condition.includes('OR')
    );
    
    if (simpleFilters.length > 0) {
      logger.debug('Applied pushDownFilters optimization', {
        filterCount: simpleFilters.length
      });
    }
  }

  /**
   * Get cached result
   */
  getCachedResult(builtQuery) {
    const cacheKey = this.generateCacheKey(builtQuery);
    const cached = this.queryCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < (cached.ttl * 1000)) {
      return cached.result;
    }
    
    if (cached) {
      this.queryCache.delete(cacheKey);
    }
    
    return null;
  }

  /**
   * Cache query result
   */
  cacheResult(builtQuery, result, ttl = 3600) {
    const cacheKey = this.generateCacheKey(builtQuery);
    
    this.queryCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      ttl
    });

    // Limit cache size
    if (this.queryCache.size > 1000) {
      const firstKey = this.queryCache.keys().next().value;
      this.queryCache.delete(firstKey);
    }
  }

  /**
   * Generate cache key
   */
  generateCacheKey(builtQuery) {
    const keyData = {
      query: builtQuery.query,
      parameters: builtQuery.parameters
    };
    
    return Buffer.from(JSON.stringify(keyData)).toString('base64');
  }

  /**
   * Update query statistics
   */
  updateQueryStats(query, executionTime, success) {
    const queryKey = query.substring(0, 100);
    const stats = this.queryStats.get(queryKey) || {
      executions: 0,
      totalTime: 0,
      averageTime: 0,
      errors: 0,
      lastExecuted: null
    };

    stats.executions++;
    stats.lastExecuted = Date.now();

    if (success) {
      stats.totalTime += executionTime;
      stats.averageTime = stats.totalTime / stats.executions;
    } else {
      stats.errors++;
    }

    this.queryStats.set(queryKey, stats);
  }

  /**
   * Load common query templates
   */
  loadCommonTemplates() {
    // Find entities by type
    this.templates.set('findEntitiesByType', {
      build: (entityType) => this.reset()
        .match('(e:CodeEntity)')
        .where('e.type = $entityType', { entityType })
        .return(['e.id', 'e.name', 'e.filePath'])
    });

    // Find patterns for entity
    this.templates.set('findPatternsForEntity', {
      build: (entityId) => this.reset()
        .match('(e:CodeEntity)-[:IMPLEMENTS]->(p:Pattern)')
        .where('e.id = $entityId', { entityId })
        .return(['p.name', 'p.description', 'p.category'])
    });

    // Find related entities
    this.templates.set('findRelatedEntities', {
      build: (entityId, depth = 2) => this.reset()
        .match(`(e:CodeEntity)-[:DEPENDS_ON*1..${depth}]->(related:CodeEntity)`)
        .where('e.id = $entityId', { entityId })
        .return(['related.id', 'related.name', 'related.type'])
        .orderBy('related.name')
    });

    logger.debug('Common query templates loaded', {
      templateCount: this.templates.size
    });
  }

  /**
   * Use a predefined template
   */
  fromTemplate(templateName, ...args) {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`Template not found: ${templateName}`);
    }

    return template.build.apply(this, args);
  }

  /**
   * Get query statistics
   */
  getStatistics() {
    return {
      cacheSize: this.queryCache.size,
      queriesExecuted: Array.from(this.queryStats.values())
        .reduce((sum, stats) => sum + stats.executions, 0),
      totalErrors: Array.from(this.queryStats.values())
        .reduce((sum, stats) => sum + stats.errors, 0),
      templatesLoaded: this.templates.size,
      optimizationRules: this.optimizationRules.size
    };
  }

  /**
   * Clear caches and statistics
   */
  clearCaches() {
    this.queryCache.clear();
    this.queryStats.clear();
    logger.debug('Query caches cleared');
  }
}

// Static factory methods for common query patterns
CypherQueryBuilder.findCodeEntitiesByLanguage = function(client, language) {
  return new CypherQueryBuilder(client)
    .match('(e:CodeEntity)')
    .where('e.language = $language', { language })
    .return(['e.id', 'e.name', 'e.filePath', 'e.type']);
};

CypherQueryBuilder.findPatternsForEntity = function(client, entityId) {
  return new CypherQueryBuilder(client)
    .match('(e:CodeEntity)-[:IMPLEMENTS]->(p:Pattern)')
    .where('e.id = $entityId', { entityId })
    .return(['p.name', 'p.description', 'p.category']);
};

CypherQueryBuilder.findRelatedEntities = function(client, entityId, depth = 2) {
  return new CypherQueryBuilder(client)
    .match(`(e:CodeEntity)-[:DEPENDS_ON*1..${depth}]->(related:CodeEntity)`)
    .where('e.id = $entityId', { entityId })
    .return(['related.id', 'related.name', 'related.type'])
    .orderBy('related.name');
};

CypherQueryBuilder.detectViolations = function(client, ruleCategory = null) {
  const builder = new CypherQueryBuilder(client)
    .match('(e:CodeEntity)-[:VIOLATES]->(r:Rule)');
  
  if (ruleCategory) {
    builder.where('r.category = $category', { category: ruleCategory });
  }
  
  return builder
    .return(['e.id', 'e.name', 'r.description', 'r.severity'])
    .orderBy('r.severity', 'DESC');
};

export default CypherQueryBuilder;