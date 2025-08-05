import { logger } from '../utils/logger.js';

export class KnowledgeGraphHandler {
  constructor(server) {
    this.server = server;
    this.kuzu = server.kuzu;
  }

  async defineDomainOntology(args) {
    const { entities, relationships, businessRules = [], codingStandards = {} } = args;
    
    try {
      const results = {
        entitiesCreated: 0,
        relationshipsCreated: 0,
        rulesCreated: 0,
        standardsCreated: 0
      };
      
      // Create entities
      for (const entity of entities) {
        await this.createEntity(entity);
        results.entitiesCreated++;
      }
      
      // Create relationships
      if (relationships) {
        for (const relationship of relationships) {
          await this.createRelationship(relationship);
          results.relationshipsCreated++;
        }
      }
      
      // Create business rules
      for (const rule of businessRules) {
        await this.createBusinessRule(rule);
        results.rulesCreated++;
      }
      
      // Create coding standards
      for (const [name, value] of Object.entries(codingStandards)) {
        await this.createCodingStandard(name, value);
        results.standardsCreated++;
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              message: 'Domain ontology defined successfully',
              results,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error defining domain ontology:', error);
      throw error;
    }
  }

  async updateFromCode(args) {
    const { codeAnalysis, decisions = [], learnedPatterns = [] } = args;
    
    try {
      const results = {
        entitiesUpdated: 0,
        decisionsRecorded: 0,
        patternsLearned: 0
      };
      
      // Update entities from code analysis
      if (codeAnalysis.entities) {
        for (const entity of codeAnalysis.entities) {
          await this.updateCodeEntity(entity);
          results.entitiesUpdated++;
        }
      }
      
      // Record architectural decisions
      for (const decision of decisions) {
        await this.recordDecision(decision);
        results.decisionsRecorded++;
      }
      
      // Learn new patterns
      for (const pattern of learnedPatterns) {
        await this.learnPattern(pattern);
        results.patternsLearned++;
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              message: 'Knowledge graph updated from code analysis',
              results,
              timestamp: new Date().toISOString()
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error updating KG from code:', error);
      throw error;
    }
  }

  async createEntity(entity) {
    const { type, name, properties = {}, labels = [] } = entity;
    
    const nodeProperties = {
      id: this.generateEntityId(type, name),
      type,
      name,
      createdAt: new Date().toISOString(),
      ...properties
    };
    
    const allLabels = ['DomainEntity', type, ...labels].filter(Boolean);
    const labelString = allLabels.map(l => `:${l}`).join('');
    
    const query = `
      MERGE (e${labelString} {id: $id})
      SET e += $properties
      RETURN e
    `;
    
    await this.kuzu.query(query, { id: nodeProperties.id, properties: nodeProperties });
    logger.info(`Created entity: ${type}:${name}`);
  }

  async createRelationship(relationship) {
    const { from, to, type, properties = {} } = relationship;
    
    const query = `
      MATCH (a {id: $fromId}), (b {id: $toId})
      MERGE (a)-[r:${type}]->(b)
      SET r += $properties
      RETURN r
    `;
    
    await this.kuzu.query(query, {
      fromId: from,
      toId: to,
      properties: {
        createdAt: new Date().toISOString(),
        ...properties
      }
    });
    
    logger.info(`Created relationship: ${from} -[${type}]-> ${to}`);
  }

  async createBusinessRule(rule) {
    const ruleId = this.generateRuleId(rule);
    
    const nodeProperties = {
      id: ruleId,
      description: rule.description || rule,
      type: rule.type || 'business',
      severity: rule.severity || 'medium',
      domain: rule.domain || 'general',
      createdAt: new Date().toISOString()
    };
    
    await this.kuzu.createNode('Rule', nodeProperties);
    logger.info(`Created business rule: ${ruleId}`);
  }

  async createCodingStandard(name, value) {
    const standardProperties = {
      id: `standard:${name}`,
      name,
      value: typeof value === 'string' ? value : JSON.stringify(value),
      type: this.inferStandardType(name),
      createdAt: new Date().toISOString()
    };
    
    await this.kuzu.createNode('Standard', standardProperties);
    logger.info(`Created coding standard: ${name}`);
  }

  async updateCodeEntity(entity) {
    const { id, filePath, type, name, properties = {} } = entity;
    
    const nodeProperties = {
      id: id || `${filePath}:${name}`,
      filePath,
      type,
      name,
      lastAnalyzed: new Date().toISOString(),
      ...properties
    };
    
    const query = `
      MERGE (e:CodeEntity {id: $id})
      SET e += $properties
      RETURN e
    `;
    
    await this.kuzu.query(query, { id: nodeProperties.id, properties: nodeProperties });
  }

  async recordDecision(decision) {
    const { title, description, context, alternatives = [], chosen, rationale } = decision;
    
    const decisionProperties = {
      id: this.generateDecisionId(title),
      title,
      description,
      context,
      alternatives: JSON.stringify(alternatives),
      chosen,
      rationale,
      decidedAt: new Date().toISOString()
    };
    
    await this.kuzu.createNode('ArchitecturalDecision', decisionProperties);
    
    // Link to related entities if context includes entity references
    if (context && context.entities) {
      for (const entityId of context.entities) {
        await this.kuzu.createRelationship(
          decisionProperties.id,
          'AFFECTS',
          entityId,
          { impact: context.impact || 'medium' }
        );
      }
    }
  }

  async learnPattern(pattern) {
    const { name, description, implementation, examples = [], category } = pattern;
    
    const patternProperties = {
      id: `pattern:${name}`,
      name,
      description,
      implementation: typeof implementation === 'string' ? implementation : JSON.stringify(implementation),
      category: category || 'learned',
      confidence: pattern.confidence || 0.8,
      learnedAt: new Date().toISOString()
    };
    
    const query = `
      MERGE (p:Pattern {id: $id})
      SET p += $properties
      RETURN p
    `;
    
    await this.kuzu.query(query, { id: patternProperties.id, properties: patternProperties });
    
    // Link pattern to examples
    for (const example of examples) {
      if (example.entityId) {
        await this.kuzu.createRelationship(
          example.entityId,
          'IMPLEMENTS',
          patternProperties.id,
          { quality: example.quality || 'good' }
        );
      }
    }
  }

  generateEntityId(type, name) {
    return `${type}:${name}`.toLowerCase().replace(/[^a-z0-9:]/g, '_');
  }

  generateRuleId(rule) {
    const description = rule.description || rule;
    const hash = this.simpleHash(description);
    return `rule:${hash}`;
  }

  generateDecisionId(title) {
    const hash = this.simpleHash(title);
    return `decision:${hash}`;
  }

  inferStandardType(name) {
    const nameLower = name.toLowerCase();
    
    if (nameLower.includes('naming') || nameLower.includes('name')) return 'naming';
    if (nameLower.includes('format') || nameLower.includes('style')) return 'formatting';
    if (nameLower.includes('structure') || nameLower.includes('architecture')) return 'architectural';
    if (nameLower.includes('test') || nameLower.includes('spec')) return 'testing';
    
    return 'general';
  }

  simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return Math.abs(hash).toString(36);
  }
}