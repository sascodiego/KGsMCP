/**
 * Mock Kuzu client for testing
 * CONTEXT: Database mocking for isolated unit tests
 * REASON: Avoid real database dependencies in unit tests
 * CHANGE: In-memory mock implementation with query simulation
 * PREVENTION: Test flakiness, database cleanup issues, external dependencies
 */

import { jest } from '@jest/globals';

export class MockKuzuClient {
  constructor(config = {}) {
    this.config = config;
    this.isConnected = false;
    this.nodes = new Map();
    this.relationships = new Map();
    this.queryHistory = [];
    this.transactionActive = false;
    
    // Mock data store
    this.mockData = {
      CodeEntity: new Map(),
      Pattern: new Map(),
      Rule: new Map(),
      Standard: new Map(),
      relationships: new Map()
    };
    
    // Performance metrics
    this.metrics = {
      queryCount: 0,
      averageQueryTime: 50,
      connectionCount: 0
    };
  }

  async connect() {
    if (this.isConnected) {
      throw new Error('Already connected');
    }
    
    this.isConnected = true;
    this.metrics.connectionCount++;
    
    // Simulate connection delay
    await new Promise(resolve => setTimeout(resolve, 10));
    
    return true;
  }

  async close() {
    if (!this.isConnected) {
      return false;
    }
    
    this.isConnected = false;
    this.clearAllData();
    return true;
  }

  async query(cypherQuery, params = {}) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    
    this.metrics.queryCount++;
    this.queryHistory.push({ query: cypherQuery, params, timestamp: Date.now() });
    
    // Simulate query execution time
    await new Promise(resolve => 
      setTimeout(resolve, Math.random() * this.metrics.averageQueryTime)
    );
    
    // Parse and execute mock query
    return this.executeMockQuery(cypherQuery, params);
  }

  async createNode(label, properties) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    
    const id = properties.id || `mock-${Date.now()}-${Math.random()}`;
    const node = { id, label, ...properties };
    
    if (!this.mockData[label]) {
      this.mockData[label] = new Map();
    }
    
    this.mockData[label].set(id, node);
    this.nodes.set(id, node);
    
    return node;
  }

  async createRelationship(fromId, relationshipType, toId, properties = {}) {
    if (!this.isConnected) {
      throw new Error('Database not connected');
    }
    
    const fromNode = this.nodes.get(fromId);
    const toNode = this.nodes.get(toId);
    
    if (!fromNode || !toNode) {
      throw new Error('One or both nodes not found');
    }
    
    const relId = `rel-${Date.now()}-${Math.random()}`;
    const relationship = {
      id: relId,
      type: relationshipType,
      from: fromId,
      to: toId,
      ...properties
    };
    
    this.relationships.set(relId, relationship);
    
    if (!this.mockData.relationships.has(relationshipType)) {
      this.mockData.relationships.set(relationshipType, []);
    }
    this.mockData.relationships.get(relationshipType).push(relationship);
    
    return relationship;
  }

  executeMockQuery(cypherQuery, params) {
    const query = cypherQuery.toLowerCase().trim();
    
    // Match CREATE operations
    if (query.includes('create node table')) {
      return [{ success: true, message: 'Table created' }];
    }
    
    if (query.includes('create rel table')) {
      return [{ success: true, message: 'Relationship table created' }];
    }
    
    // Match MATCH operations
    if (query.includes('match')) {
      return this.executeMockMatch(cypherQuery, params);
    }
    
    // Match CREATE operations
    if (query.includes('create (')) {
      return this.executeMockCreate(cypherQuery, params);
    }
    
    // Match COUNT operations
    if (query.includes('count(')) {
      return this.executeMockCount(cypherQuery, params);
    }
    
    // Match RETURN operations
    if (query.includes('return')) {
      return this.executeMockReturn(cypherQuery, params);
    }
    
    // Default response
    return [{ result: 'success', affectedRows: 1 }];
  }

  executeMockMatch(cypherQuery, params) {
    const results = [];
    
    // Extract node labels from query
    const labelMatches = cypherQuery.match(/\((\w+):(\w+)\)/g);
    
    if (labelMatches) {
      for (const match of labelMatches) {
        const [, variable, label] = match.match(/\((\w+):(\w+)\)/);
        
        if (this.mockData[label]) {
          for (const [id, node] of this.mockData[label]) {
            const result = {};
            result[variable] = node;
            results.push(result);
          }
        }
      }
    }
    
    // Apply WHERE conditions if present
    if (cypherQuery.includes('WHERE')) {
      return this.applyWhereClause(results, cypherQuery, params);
    }
    
    return results;
  }

  executeMockCreate(cypherQuery, params) {
    // Extract label and properties from CREATE query
    const createMatch = cypherQuery.match(/CREATE \((\w+):(\w+)\s*\{([^}]+)\}\)/);
    
    if (createMatch) {
      const [, variable, label, propsString] = createMatch;
      
      // Parse properties
      const properties = this.parseProperties(propsString, params);
      const node = this.createNode(label, properties);
      
      const result = {};
      result[variable] = node;
      return [result];
    }
    
    return [{ created: true }];
  }

  executeMockCount(cypherQuery, params) {
    const countMatch = cypherQuery.match(/count\((\w+)\)/);
    
    if (countMatch) {
      const [, variable] = countMatch;
      
      // Find the label from the MATCH clause
      const labelMatch = cypherQuery.match(new RegExp(`\\(${variable}:(\\w+)\\)`));
      
      if (labelMatch) {
        const [, label] = labelMatch;
        const count = this.mockData[label] ? this.mockData[label].size : 0;
        return [{ [`count(${variable})`]: count }];
      }
    }
    
    return [{ count: 0 }];
  }

  executeMockReturn(cypherQuery, params) {
    // Simple return statement handling
    if (cypherQuery.includes('RETURN 1')) {
      return [{ '1': 1 }];
    }
    
    return [{ result: 'returned' }];
  }

  applyWhereClause(results, cypherQuery, params) {
    const whereClause = cypherQuery.match(/WHERE\s+(.+?)(?:\s+RETURN|\s+WITH|$)/i);
    
    if (!whereClause) {
      return results;
    }
    
    const condition = whereClause[1].trim();
    
    return results.filter(result => {
      // Simple property matching
      if (condition.includes('=')) {
        const [left, right] = condition.split('=').map(s => s.trim());
        
        // Handle parameter substitution
        let rightValue = right;
        if (right.startsWith('$')) {
          const paramName = right.substring(1);
          rightValue = params[paramName];
        } else if (right.startsWith("'") && right.endsWith("'")) {
          rightValue = right.slice(1, -1);
        }
        
        // Extract property value from result
        const leftParts = left.split('.');
        if (leftParts.length === 2) {
          const [variable, property] = leftParts;
          const node = result[variable];
          
          if (node && node[property] === rightValue) {
            return true;
          }
        }
      }
      
      return false;
    });
  }

  parseProperties(propsString, params) {
    const properties = {};
    const propPairs = propsString.split(',');
    
    for (const pair of propPairs) {
      const [key, value] = pair.split(':').map(s => s.trim());
      
      if (value.startsWith('$')) {
        const paramName = value.substring(1);
        properties[key] = params[paramName];
      } else if (value.startsWith("'") && value.endsWith("'")) {
        properties[key] = value.slice(1, -1);
      } else {
        properties[key] = value;
      }
    }
    
    return properties;
  }

  // Test utilities
  clearAllData() {
    this.nodes.clear();
    this.relationships.clear();
    for (const store of Object.values(this.mockData)) {
      if (store instanceof Map) {
        store.clear();
      }
    }
    this.queryHistory = [];
  }

  getQueryHistory() {
    return [...this.queryHistory];
  }

  getMetrics() {
    return { ...this.metrics };
  }

  setMockData(label, data) {
    if (!this.mockData[label]) {
      this.mockData[label] = new Map();
    }
    
    if (Array.isArray(data)) {
      data.forEach(item => {
        const id = item.id || `mock-${Date.now()}-${Math.random()}`;
        this.mockData[label].set(id, { id, ...item });
        this.nodes.set(id, { id, label, ...item });
      });
    } else {
      const id = data.id || `mock-${Date.now()}-${Math.random()}`;
      this.mockData[label].set(id, { id, ...data });
      this.nodes.set(id, { id, label, ...data });
    }
  }

  getMockData(label) {
    return this.mockData[label] ? Array.from(this.mockData[label].values()) : [];
  }

  // Simulate database errors
  simulateError(errorType = 'connection') {
    const errors = {
      connection: () => { throw new Error('Connection lost'); },
      query: () => { throw new Error('Query execution failed'); },
      timeout: () => { throw new Error('Query timeout'); },
      constraint: () => { throw new Error('Constraint violation'); }
    };
    
    if (errors[errorType]) {
      errors[errorType]();
    }
  }

  // Simulate performance issues
  setQueryDelay(delayMs) {
    this.metrics.averageQueryTime = delayMs;
  }

  // Transaction simulation
  async beginTransaction() {
    this.transactionActive = true;
    return { success: true };
  }

  async commitTransaction() {
    this.transactionActive = false;
    return { success: true };
  }

  async rollbackTransaction() {
    this.transactionActive = false;
    // In a real scenario, this would undo changes
    return { success: true };
  }
}

// Factory function for tests
export function createMockKuzuClient(config = {}) {
  return new MockKuzuClient(config);
}

// Jest mock factory
export const mockKuzuClientFactory = jest.fn(() => new MockKuzuClient());