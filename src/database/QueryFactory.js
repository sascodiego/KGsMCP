/**
 * CONTEXT: Factory pattern for database query creation
 * REASON: Eliminate nested query building logic and centralize query creation
 * CHANGE: Create factory classes for different types of database operations
 * PREVENTION: Reduces code duplication and improves query maintainability
 */

import { logger } from '../utils/logger.js';

/**
 * Base query builder interface
 */
class QueryBuilder {
  constructor() {
    this.query = '';
    this.parameters = {};
  }

  build() {
    return {
      query: this.query,
      parameters: this.parameters
    };
  }

  setParameter(key, value) {
    this.parameters[key] = value;
    return this;
  }

  validate() {
    return { isValid: true, errors: [] };
  }
}

/**
 * Knowledge Graph statistics query builder
 */
class KGStatisticsQueryBuilder extends QueryBuilder {
  constructor() {
    super();
    this.includeDetails = false;
    this.entityType = null;
  }

  withDetails(includeDetails = true) {
    this.includeDetails = includeDetails;
    return this;
  }

  forEntityType(entityType) {
    this.entityType = entityType;
    return this;
  }

  build() {
    if (this.entityType) {
      return this.buildEntityTypeQuery();
    }

    if (this.includeDetails) {
      return this.buildDetailedQuery();
    }

    return this.buildBasicQuery();
  }

  buildBasicQuery() {
    this.query = `
      MATCH (e:CodeEntity) WITH count(e) as codeEntities
      MATCH (p:Pattern) WITH codeEntities, count(p) as patterns
      MATCH (r:Rule) WITH codeEntities, patterns, count(r) as rules
      MATCH (s:Standard) WITH codeEntities, patterns, rules, count(s) as standards
      OPTIONAL MATCH (d:Decision)
      RETURN {
        codeEntities: codeEntities,
        patterns: patterns,
        rules: rules,
        standards: standards,
        decisions: count(d)
      } as stats
    `;
    return super.build();
  }

  buildDetailedQuery() {
    this.query = `
      // Basic counts
      MATCH (e:CodeEntity) WITH count(e) as codeEntities
      MATCH (p:Pattern) WITH codeEntities, count(p) as patterns
      MATCH (r:Rule) WITH codeEntities, patterns, count(r) as rules
      
      // Entity breakdown by type
      MATCH (e:CodeEntity)
      WITH codeEntities, patterns, rules, 
           collect({type: e.type, count: count(*)}) as entityBreakdown
      
      // Pattern statistics
      MATCH (p:Pattern)
      WITH codeEntities, patterns, rules, entityBreakdown,
           collect({category: p.category, count: count(*), avgConfidence: avg(p.confidence)}) as patternStats
      
      RETURN {
        basicStats: {
          codeEntities: codeEntities,
          patterns: patterns,
          rules: rules
        },
        entityBreakdown: entityBreakdown,
        patternStats: patternStats
      } as detailedStats
    `;
    return super.build();
  }

  buildEntityTypeQuery() {
    this.query = `
      MATCH (e:CodeEntity)
      WHERE e.type = $entityType
      RETURN {
        total: count(e),
        avgComplexity: avg(e.complexity),
        maxComplexity: max(e.complexity),
        sampleFiles: collect(DISTINCT e.filePath)[0..10]
      } as entityTypeStats
    `;
    this.setParameter('entityType', this.entityType);
    return super.build();
  }
}

/**
 * Technical debt query builder
 */
class TechnicalDebtQueryBuilder extends QueryBuilder {
  constructor() {
    super();
    this.scope = null;
    this.target = null;
    this.debtTypes = [];
  }

  withScope(scope) {
    this.scope = scope;
    return this;
  }

  withTarget(target) {
    this.target = target;
    return this;
  }

  withDebtTypes(debtTypes) {
    this.debtTypes = Array.isArray(debtTypes) ? debtTypes : [debtTypes];
    return this;
  }

  build() {
    const scopeBuilders = {
      module: () => this.buildModuleQuery(),
      project: () => this.buildProjectQuery(),
      specific: () => this.buildSpecificQuery()
    };

    const builder = scopeBuilders[this.scope];
    if (!builder) {
      throw new Error(`Unknown debt analysis scope: ${this.scope}`);
    }

    return builder();
  }

  buildModuleQuery() {
    this.query = `
      MATCH (e:CodeEntity)
      WHERE e.filePath CONTAINS $target
      OPTIONAL MATCH (e)-[:HAS_ISSUE]->(debt:TechnicalDebt)
      WHERE debt.type IN $debtTypes
      RETURN {
        module: $target,
        entities: collect(DISTINCT {name: e.name, type: e.type, complexity: e.complexity}),
        debts: collect(DISTINCT {
          type: debt.type,
          severity: debt.severity,
          description: debt.description,
          entity: e.name,
          impact: debt.impact
        })
      } as analysis
    `;
    
    this.setParameter('target', this.target)
        .setParameter('debtTypes', this.debtTypes);
    
    return super.build();
  }

  buildProjectQuery() {
    this.query = `
      MATCH (debt:TechnicalDebt)
      WHERE debt.type IN $debtTypes
      OPTIONAL MATCH (e:CodeEntity)-[:HAS_ISSUE]->(debt)
      WITH debt, e
      RETURN {
        project: "entire",
        totalDebtItems: count(DISTINCT debt),
        byType: collect(DISTINCT {
          type: debt.type,
          count: size((debt)<-[:HAS_ISSUE]-()),
          avgSeverity: avg(CASE debt.severity 
            WHEN 'high' THEN 3 
            WHEN 'medium' THEN 2 
            WHEN 'low' THEN 1 
            ELSE 0 END)
        }),
        byModule: collect(DISTINCT {
          module: split(e.filePath, '/')[0],
          debts: count(debt),
          worstSeverity: max(CASE debt.severity 
            WHEN 'high' THEN 3 
            WHEN 'medium' THEN 2 
            WHEN 'low' THEN 1 
            ELSE 0 END)
        })
      } as analysis
    `;
    
    this.setParameter('debtTypes', this.debtTypes);
    return super.build();
  }

  buildSpecificQuery() {
    this.query = `
      MATCH (e:CodeEntity {name: $target})
      OPTIONAL MATCH (e)-[:HAS_ISSUE]->(debt:TechnicalDebt)
      WHERE debt.type IN $debtTypes
      OPTIONAL MATCH (e)-[:DEPENDS_ON]->(deps:CodeEntity)
      OPTIONAL MATCH (dependents:CodeEntity)-[:DEPENDS_ON]->(e)
      RETURN {
        entity: {
          name: e.name, 
          type: e.type, 
          filePath: e.filePath,
          complexity: e.complexity,
          dependencies: count(DISTINCT deps),
          dependents: count(DISTINCT dependents)
        },
        debts: collect(DISTINCT {
          type: debt.type,
          severity: debt.severity,
          description: debt.description,
          impact: debt.impact,
          estimatedEffort: debt.estimatedEffort
        }),
        riskAssessment: CASE 
          WHEN count(debt) = 0 THEN 'low'
          WHEN count(debt) < 3 THEN 'medium'
          ELSE 'high'
        END
      } as analysis
    `;
    
    this.setParameter('target', this.target)
        .setParameter('debtTypes', this.debtTypes);
    
    return super.build();
  }

  validate() {
    const errors = [];
    
    if (!this.scope) {
      errors.push('Scope is required for technical debt analysis');
    }
    
    if (['module', 'specific'].includes(this.scope) && !this.target) {
      errors.push(`Target is required for ${this.scope} scope`);
    }
    
    if (this.debtTypes.length === 0) {
      errors.push('At least one debt type must be specified');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Pattern detection query builder
 */
class PatternDetectionQueryBuilder extends QueryBuilder {
  constructor() {
    super();
    this.codeEntityId = null;
    this.patternTypes = [];
    this.confidenceThreshold = 0.5;
  }

  forCodeEntity(entityId) {
    this.codeEntityId = entityId;
    return this;
  }

  withPatternTypes(patternTypes) {
    this.patternTypes = Array.isArray(patternTypes) ? patternTypes : [patternTypes];
    return this;
  }

  withConfidenceThreshold(threshold) {
    this.confidenceThreshold = threshold;
    return this;
  }

  build() {
    if (this.codeEntityId) {
      return this.buildEntityPatternQuery();
    }
    
    return this.buildAllPatternsQuery();
  }

  buildEntityPatternQuery() {
    this.query = `
      MATCH (e:CodeEntity {id: $entityId})
      OPTIONAL MATCH (e)-[impl:IMPLEMENTS]->(p:Pattern)
      WHERE ($patternTypes = [] OR p.name IN $patternTypes)
        AND impl.confidence >= $confidenceThreshold
      RETURN {
        entity: {name: e.name, type: e.type, filePath: e.filePath},
        implementedPatterns: collect({
          name: p.name,
          confidence: impl.confidence,
          category: p.category,
          description: p.description
        }),
        patternCount: count(p),
        avgConfidence: avg(impl.confidence)
      } as patternAnalysis
    `;
    
    this.setParameter('entityId', this.codeEntityId)
        .setParameter('patternTypes', this.patternTypes)
        .setParameter('confidenceThreshold', this.confidenceThreshold);
    
    return super.build();
  }

  buildAllPatternsQuery() {
    this.query = `
      MATCH (p:Pattern)
      WHERE ($patternTypes = [] OR p.name IN $patternTypes)
      OPTIONAL MATCH (e:CodeEntity)-[impl:IMPLEMENTS]->(p)
      WHERE impl.confidence >= $confidenceThreshold
      RETURN {
        patterns: collect(DISTINCT {
          name: p.name,
          category: p.category,
          description: p.description,
          usageCount: count(e),
          avgConfidence: avg(impl.confidence),
          implementations: collect(DISTINCT {
            entity: e.name,
            confidence: impl.confidence
          })[0..5]
        })
      } as patternAnalysis
    `;
    
    this.setParameter('patternTypes', this.patternTypes)
        .setParameter('confidenceThreshold', this.confidenceThreshold);
    
    return super.build();
  }
}

/**
 * Context retrieval query builder
 */
class ContextQueryBuilder extends QueryBuilder {
  constructor() {
    super();
    this.taskDescription = '';
    this.entityTypes = [];
    this.depth = 2;
    this.keywords = [];
  }

  withTaskDescription(description) {
    this.taskDescription = description;
    this.keywords = this.extractKeywords(description);
    return this;
  }

  withEntityTypes(entityTypes) {
    this.entityTypes = Array.isArray(entityTypes) ? entityTypes : [entityTypes];
    return this;
  }

  withDepth(depth) {
    this.depth = Math.max(1, Math.min(depth, 5)); // Limit depth between 1 and 5
    return this;
  }

  extractKeywords(description) {
    // Simple keyword extraction - could be enhanced with NLP
    return description
      .toLowerCase()
      .split(/\s+/)
      .filter(word => word.length > 3)
      .slice(0, 5); // Take first 5 meaningful words
  }

  build() {
    this.query = `
      // Find patterns relevant to the task
      MATCH (p:Pattern)
      WHERE ANY(keyword IN $keywords WHERE 
        toLower(p.name) CONTAINS keyword OR 
        toLower(p.description) CONTAINS keyword)
      WITH p LIMIT 5
      
      // Find related code entities
      OPTIONAL MATCH (e:CodeEntity)-[:IMPLEMENTS]->(p)
      WHERE ($entityTypes = [] OR e.type IN $entityTypes)
      WITH p, collect(DISTINCT {
        name: e.name, 
        type: e.type, 
        filePath: e.filePath,
        complexity: e.complexity
      }) as relatedEntities
      
      // Find business rules
      OPTIONAL MATCH (r:Rule)
      WHERE ANY(keyword IN $keywords WHERE 
        toLower(r.description) CONTAINS keyword)
      WITH p, relatedEntities, collect(DISTINCT {
        name: r.name,
        description: r.description,
        severity: r.severity
      }) as rules
      
      // Find coding standards
      OPTIONAL MATCH (s:Standard)
      WHERE ($entityTypes = [] OR s.category IN $entityTypes)
      WITH p, relatedEntities, rules, collect(DISTINCT {
        name: s.name, 
        value: s.value,
        category: s.category
      }) as standards
      
      // Find related decisions
      OPTIONAL MATCH (d:Decision)
      WHERE ANY(keyword IN $keywords WHERE 
        toLower(d.rationale) CONTAINS keyword)
      
      RETURN {
        taskDescription: $taskDescription,
        patterns: collect(DISTINCT {
          name: p.name,
          category: p.category,
          description: p.description
        }),
        relatedCode: relatedEntities,
        rules: rules,
        standards: standards,
        decisions: collect(DISTINCT {
          title: d.title,
          rationale: d.rationale,
          status: d.status
        }),
        relevanceScore: CASE 
          WHEN size(collect(DISTINCT p)) > 2 THEN 0.9
          WHEN size(collect(DISTINCT p)) > 0 THEN 0.7
          ELSE 0.3
        END
      } as context
    `;
    
    this.setParameter('keywords', this.keywords)
        .setParameter('taskDescription', this.taskDescription)
        .setParameter('entityTypes', this.entityTypes);
    
    return super.build();
  }

  validate() {
    const errors = [];
    
    if (!this.taskDescription.trim()) {
      errors.push('Task description is required');
    }
    
    if (this.taskDescription.length > 1000) {
      errors.push('Task description too long (max 1000 characters)');
    }
    
    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

/**
 * Main query factory using factory pattern
 */
export class QueryFactory {
  static createKGStatisticsQuery() {
    return new KGStatisticsQueryBuilder();
  }

  static createTechnicalDebtQuery() {
    return new TechnicalDebtQueryBuilder();
  }

  static createPatternDetectionQuery() {
    return new PatternDetectionQueryBuilder();
  }

  static createContextQuery() {
    return new ContextQueryBuilder();
  }

  /**
   * Create query builder by type
   */
  static create(type, options = {}) {
    const builders = {
      'kg-statistics': () => this.createKGStatisticsQuery(),
      'technical-debt': () => this.createTechnicalDebtQuery(),
      'pattern-detection': () => this.createPatternDetectionQuery(),
      'context': () => this.createContextQuery()
    };

    const builder = builders[type];
    if (!builder) {
      throw new Error(`Unknown query type: ${type}`);
    }

    const queryBuilder = builder();

    // Apply options if provided
    this.applyOptions(queryBuilder, options);

    return queryBuilder;
  }

  /**
   * Apply options to query builder
   */
  static applyOptions(queryBuilder, options) {
    // Generic option application
    for (const [key, value] of Object.entries(options)) {
      const methodName = `with${key.charAt(0).toUpperCase()}${key.slice(1)}`;
      if (typeof queryBuilder[methodName] === 'function') {
        queryBuilder[methodName](value);
      } else if (typeof queryBuilder[key] !== 'undefined') {
        queryBuilder[key] = value;
      }
    }
  }

  /**
   * Validate query builder
   */
  static validate(queryBuilder) {
    if (!queryBuilder || typeof queryBuilder.validate !== 'function') {
      return { isValid: false, errors: ['Invalid query builder'] };
    }

    return queryBuilder.validate();
  }

  /**
   * Execute query with error handling
   */
  static async execute(queryBuilder, kuzuClient) {
    try {
      // Validate query builder
      const validation = this.validate(queryBuilder);
      if (!validation.isValid) {
        throw new Error(`Query validation failed: ${validation.errors.join(', ')}`);
      }

      // Build query
      const { query, parameters } = queryBuilder.build();
      
      // Log query for debugging
      logger.debug('Executing query:', {
        query: query.substring(0, 200) + '...',
        parameterKeys: Object.keys(parameters)
      });

      // Execute query
      const result = await kuzuClient.query(query, parameters);
      
      logger.debug('Query executed successfully', {
        resultCount: result.length
      });

      return result;

    } catch (error) {
      logger.error('Query execution failed:', {
        error: error.message,
        queryType: queryBuilder.constructor.name
      });
      throw error;
    }
  }

  /**
   * Get available query types
   */
  static getAvailableTypes() {
    return [
      {
        type: 'kg-statistics',
        description: 'Knowledge Graph statistics and metrics',
        builder: 'KGStatisticsQueryBuilder'
      },
      {
        type: 'technical-debt',
        description: 'Technical debt detection and analysis',
        builder: 'TechnicalDebtQueryBuilder'
      },
      {
        type: 'pattern-detection',
        description: 'Design pattern detection and analysis',
        builder: 'PatternDetectionQueryBuilder'
      },
      {
        type: 'context',
        description: 'Context retrieval for task assistance',
        builder: 'ContextQueryBuilder'
      }
    ];
  }
}