/**
 * MCP Workflow Integration Tests
 * CONTEXT: End-to-end testing of complete MCP tool workflows
 * REASON: Ensure all components work together correctly in realistic scenarios
 * CHANGE: Comprehensive integration testing for MCP server and tools
 * PREVENTION: Integration failures, workflow breakdowns, system inconsistencies
 */

import { jest } from '@jest/globals';
import { MCPServer } from '../../src/server.js';
import { MockKuzuClient, createMockEnvironment, testUtils } from '../mocks/index.js';
import { mockLogger } from '../mocks/index.js';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies
jest.mock('../../src/utils/logger.js', () => ({
  logger: mockLogger
}));

jest.mock('fs/promises');

describe('MCP Workflow Integration Tests', () => {
  let mcpServer;
  let mockEnv;
  let testCodebase;

  beforeEach(async () => {
    // Create mock environment
    mockEnv = createMockEnvironment();
    
    // Create test codebase structure
    testCodebase = {
      '/src/services/UserService.js': `
        /**
         * CONTEXT: User service for managing user data
         * REASON: Centralized user management with validation
         * CHANGE: Service layer implementation following clean architecture
         * PREVENTION: Scattered user logic and validation inconsistencies
         */
        import { DatabaseManager } from '../database/DatabaseManager.js';
        import { UserValidator } from '../validators/UserValidator.js';
        
        export class UserService {
          constructor() {
            this.db = new DatabaseManager();
            this.validator = new UserValidator();
          }
          
          async createUser(userData) {
            if (!this.validator.validate(userData)) {
              throw new Error('Invalid user data');
            }
            
            const user = await this.db.insert('users', userData);
            return user;
          }
          
          async getUser(id) {
            return await this.db.findById('users', id);
          }
          
          async updateUser(id, updates) {
            const existingUser = await this.getUser(id);
            if (!existingUser) {
              throw new Error('User not found');
            }
            
            const validatedUpdates = this.validator.validateUpdates(updates);
            return await this.db.update('users', id, validatedUpdates);
          }
          
          async deleteUser(id) {
            const user = await this.getUser(id);
            if (!user) {
              throw new Error('User not found');
            }
            
            return await this.db.delete('users', id);
          }
        }
      `,
      
      '/src/database/DatabaseManager.js': `
        /**
         * CONTEXT: Database abstraction layer
         * REASON: Centralized database operations with connection pooling
         * CHANGE: Database manager with transaction support
         * PREVENTION: Database connection leaks and inconsistent queries
         */
        export class DatabaseManager {
          constructor() {
            this.connection = null;
            this.transactionActive = false;
          }
          
          async connect() {
            // Database connection logic
            this.connection = { connected: true };
          }
          
          async insert(table, data) {
            return { id: 'generated-id', ...data };
          }
          
          async findById(table, id) {
            return { id, name: 'Test User' };
          }
          
          async update(table, id, data) {
            return { id, ...data, updatedAt: new Date() };
          }
          
          async delete(table, id) {
            return { deleted: true, id };
          }
        }
      `,
      
      '/src/validators/UserValidator.js': `
        /**
         * CONTEXT: User data validation logic
         * REASON: Consistent validation rules across the application
         * CHANGE: Centralized validation with comprehensive rules
         * PREVENTION: Invalid data persistence and security vulnerabilities
         */
        export class UserValidator {
          validate(userData) {
            if (!userData.name || userData.name.trim().length === 0) {
              return false;
            }
            
            if (!userData.email || !this.isValidEmail(userData.email)) {
              return false;
            }
            
            return true;
          }
          
          validateUpdates(updates) {
            const validatedUpdates = {};
            
            if (updates.name && updates.name.trim().length > 0) {
              validatedUpdates.name = updates.name.trim();
            }
            
            if (updates.email && this.isValidEmail(updates.email)) {
              validatedUpdates.email = updates.email;
            }
            
            return validatedUpdates;
          }
          
          isValidEmail(email) {
            const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
            return emailRegex.test(email);
          }
        }
      `,
      
      '/package.json': JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        type: 'module',
        dependencies: {
          'express': '^4.18.0'
        }
      }, null, 2)
    };

    // Mock file system
    fs.readFile.mockImplementation((filePath) => {
      const content = testCodebase[filePath];
      if (content) {
        return Promise.resolve(content);
      }
      throw new Error(`File not found: ${filePath}`);
    });

    fs.readdir.mockResolvedValue(Object.keys(testCodebase));
    fs.stat.mockResolvedValue({ isFile: () => true, size: 1000 });

    // Initialize MCP Server with mock environment
    mcpServer = new MCPServer({
      kuzu: mockEnv.kuzuClient,
      logger: mockEnv.logger,
      config: {
        kuzu: { databasePath: '/test/db' },
        logging: { level: 'error' }
      }
    });

    // Setup mock data in database
    await setupMockKnowledgeGraph(mockEnv.kuzuClient);
  });

  afterEach(async () => {
    if (mcpServer) {
      await mcpServer.stop();
    }
    jest.clearAllMocks();
  });

  async function setupMockKnowledgeGraph(kuzuClient) {
    // Setup patterns
    kuzuClient.setMockData('Pattern', [
      {
        name: 'Service Layer',
        description: 'Service layer pattern for business logic',
        category: 'architectural',
        implementation: 'class Service { constructor() {} }',
        rules: ['single_responsibility', 'dependency_injection']
      },
      {
        name: 'Repository',
        description: 'Repository pattern for data access',
        category: 'data_access',
        implementation: 'class Repository { findById() {} }',
        rules: ['data_abstraction']
      },
      {
        name: 'Validator',
        description: 'Validation pattern for input checking',
        category: 'validation',
        implementation: 'class Validator { validate() {} }',
        rules: ['input_validation']
      }
    ]);

    // Setup rules
    kuzuClient.setMockData('Rule', [
      {
        description: 'Functions should not exceed 50 lines',
        type: 'function_length',
        severity: 'warning',
        category: 'maintainability'
      },
      {
        description: 'Classes should have single responsibility',
        type: 'single_responsibility',
        severity: 'error',
        category: 'design'
      },
      {
        description: 'Validate all user inputs',
        type: 'input_validation',
        severity: 'critical',
        category: 'security'
      }
    ]);

    // Setup standards
    kuzuClient.setMockData('Standard', [
      {
        name: 'camelCase',
        value: 'functions',
        type: 'naming',
        category: 'coding_standards'
      },
      {
        name: 'PascalCase',
        value: 'classes',
        type: 'naming',
        category: 'coding_standards'
      }
    ]);
  }

  describe('Complete Analysis Workflow', () => {
    test('should analyze entire codebase and update knowledge graph', async () => {
      const result = await mcpServer.handlers.initialization.analyzeCodebase({
        codebasePath: '/test/project',
        includeGitHistory: false,
        maxDepth: 10
      });

      expect(result.content).toBeDefined();
      const analysis = JSON.parse(result.content[0].text);
      
      expect(analysis.summary.totalFiles).toBeGreaterThan(0);
      expect(analysis.summary.entitiesExtracted).toBeGreaterThan(0);
      expect(analysis.summary.patternsDetected).toBeDefined();
      expect(analysis.languages).toContain('javascript');

      // Verify entities were stored in knowledge graph
      const storedEntities = mockEnv.kuzuClient.getMockData('CodeEntity');
      expect(storedEntities.length).toBeGreaterThan(0);
    });

    test('should detect and store patterns from codebase', async () => {
      // First analyze the codebase
      await mcpServer.handlers.initialization.analyzeCodebase({
        codebasePath: '/test/project',
        includeGitHistory: false
      });

      // Then query for detected patterns
      const result = await mcpServer.handlers.context.queryContextForTask({
        taskDescription: 'Create a new service following existing patterns',
        entityTypes: ['class', 'service'],
        depth: 2
      });

      const context = JSON.parse(result.content[0].text);
      expect(context.context.patterns).toBeDefined();
      expect(context.context.patterns.length).toBeGreaterThan(0);
    });

    test('should maintain relationships between entities', async () => {
      await mcpServer.handlers.initialization.analyzeCodebase({
        codebasePath: '/test/project'
      });

      // Check for dependency relationships
      const relationships = mockEnv.kuzuClient.getMockData('relationships');
      const dependencyRels = relationships.get('DEPENDS_ON') || [];
      
      expect(dependencyRels.length).toBeGreaterThan(0);
      
      // UserService should depend on DatabaseManager and UserValidator
      const userServiceDeps = dependencyRels.filter(rel => 
        rel.from.includes('UserService')
      );
      expect(userServiceDeps.length).toBeGreaterThan(0);
    });
  });

  describe('Code Generation Workflow', () => {
    test('should generate code with context from knowledge graph', async () => {
      // Setup knowledge graph with existing patterns
      await mcpServer.handlers.initialization.analyzeCodebase({
        codebasePath: '/test/project'
      });

      // Generate new code using context
      const result = await mcpServer.handlers.codeGeneration.generateWithContext({
        requirement: 'Create a ProductService following existing service patterns',
        patternsToApply: ['Service Layer', 'Repository'],
        constraints: {
          language: 'javascript',
          includeValidation: true
        }
      });

      const guidance = JSON.parse(result.content[0].text);
      
      expect(guidance.requirement).toContain('ProductService');
      expect(guidance.guidance.patterns).toBeDefined();
      expect(guidance.guidance.patterns.length).toBeGreaterThan(0);
      expect(guidance.guidance.implementation).toBeDefined();
      expect(guidance.context.patterns).toBeDefined();
    });

    test('should suggest refactoring based on detected issues', async () => {
      // Create a problematic code entity
      mockEnv.kuzuClient.setMockData('CodeEntity', [
        {
          name: 'LegacyService',
          type: 'class',
          filePath: '/src/legacy/LegacyService.js',
          complexity: 15
        }
      ]);

      mockEnv.kuzuClient.setMockData('TechnicalDebt', [
        {
          type: 'complexity',
          severity: 'high',
          description: 'High cyclomatic complexity detected',
          entity: 'LegacyService'
        }
      ]);

      const result = await mcpServer.handlers.codeGeneration.suggestRefactoring({
        codeEntity: 'LegacyService',
        improvementGoals: ['reduce complexity', 'improve maintainability'],
        preserveBehavior: true
      });

      const suggestions = JSON.parse(result.content[0].text);
      
      expect(suggestions.codeEntity).toBe('LegacyService');
      expect(suggestions.suggestions).toBeDefined();
      expect(suggestions.improvementGoals).toContain('reduce complexity');
    });
  });

  describe('Validation Workflow', () => {
    test('should validate code against established patterns and rules', async () => {
      // Setup knowledge graph
      await mcpServer.handlers.initialization.analyzeCodebase({
        codebasePath: '/test/project'
      });

      const codeToValidate = `
        export class ProductService {
          constructor() {
            this.db = new DatabaseManager();
          }
          
          async createProduct(productData) {
            // Missing validation!
            return await this.db.insert('products', productData);
          }
        }
      `;

      const result = await mcpServer.handlers.validation.validateAgainstKG({
        codeSnippet: codeToValidate,
        validationTypes: ['patterns', 'rules', 'standards'],
        strictMode: true
      });

      const validation = JSON.parse(result.content[0].text);
      
      expect(validation.validationResults).toBeDefined();
      expect(validation.overallScore).toBeDefined();
      expect(validation.recommendations).toBeDefined();
      
      // Should detect missing validation
      const hasValidationIssue = validation.validationResults.rules?.violations?.some(
        v => v.message.includes('validation') || v.rule.includes('validation')
      );
      expect(hasValidationIssue).toBe(true);
    });

    test('should detect technical debt across codebase', async () => {
      // Setup codebase analysis
      await mcpServer.handlers.initialization.analyzeCodebase({
        codebasePath: '/test/project'
      });

      const result = await mcpServer.handlers.validation.detectTechnicalDebt({
        scope: 'project',
        debtTypes: ['complexity', 'duplication', 'coupling']
      });

      const debtAnalysis = JSON.parse(result.content[0].text);
      
      expect(debtAnalysis.scope).toBe('project');
      expect(debtAnalysis.analysis).toBeDefined();
      expect(debtAnalysis.recommendations).toBeDefined();
    });
  });

  describe('Context Extraction Workflow', () => {
    test('should extract and store structured comments', async () => {
      const result = await mcpServer.handlers.context.extractFromCode({
        filePath: '/src/services/UserService.js'
      });

      const extraction = JSON.parse(result.content[0].text);
      
      expect(extraction.extracted.entities).toBeGreaterThan(0);
      expect(extraction.extracted.structuredComments).toBeGreaterThan(0);
      
      // Verify structured comments were stored in knowledge graph
      const storedEntities = mockEnv.kuzuClient.getMockData('CodeEntity');
      const entityWithContext = storedEntities.find(e => 
        e.context && e.context.includes('User service')
      );
      expect(entityWithContext).toBeDefined();
    });

    test('should provide relevant context for development tasks', async () => {
      // Setup knowledge graph
      await mcpServer.handlers.initialization.analyzeCodebase({
        codebasePath: '/test/project'
      });

      const result = await mcpServer.handlers.context.queryContextForTask({
        taskDescription: 'Implement user authentication service',
        entityTypes: ['service', 'validator'],
        depth: 3
      });

      const context = JSON.parse(result.content[0].text);
      
      expect(context.taskDescription).toContain('authentication');
      expect(context.context.patterns).toBeDefined();
      expect(context.context.relatedCode).toBeDefined();
      expect(context.relevanceScore).toBeGreaterThan(0);
    });
  });

  describe('Knowledge Graph Updates', () => {
    test('should update knowledge graph with new patterns and relationships', async () => {
      const newAnalysis = {
        entities: [
          {
            id: 'new-service-1',
            type: 'class',
            name: 'NotificationService',
            filePath: '/src/services/NotificationService.js'
          }
        ],
        patterns: [
          {
            name: 'Observer',
            confidence: 0.9,
            entities: ['NotificationService']
          }
        ],
        relationships: [
          {
            from: 'NotificationService',
            to: 'UserService',
            type: 'NOTIFIES',
            confidence: 0.85
          }
        ]
      };

      const result = await mcpServer.handlers.knowledgeGraph.updateFromCode({
        codeAnalysis: newAnalysis,
        decisions: [
          {
            decision: 'Implemented Observer pattern for notifications',
            rationale: 'Loose coupling between services',
            impact: 'Improved maintainability'
          }
        ]
      });

      const update = JSON.parse(result.content[0].text);
      
      expect(update.summary.entitiesCreated).toBeGreaterThan(0);
      expect(update.summary.relationshipsCreated).toBeGreaterThan(0);
      expect(update.summary.patternsDetected).toBeGreaterThan(0);
    });

    test('should maintain knowledge graph consistency during updates', async () => {
      // Initial analysis
      await mcpServer.handlers.initialization.analyzeCodebase({
        codebasePath: '/test/project'
      });

      const initialEntities = mockEnv.kuzuClient.getMockData('CodeEntity');
      const initialCount = initialEntities.length;

      // Update with new code
      await mcpServer.handlers.knowledgeGraph.updateFromCode({
        codeAnalysis: {
          entities: [
            {
              id: 'new-entity',
              type: 'function',
              name: 'newFunction'
            }
          ]
        }
      });

      const updatedEntities = mockEnv.kuzuClient.getMockData('CodeEntity');
      expect(updatedEntities.length).toBe(initialCount + 1);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('should handle database connection failures gracefully', async () => {
      // Simulate database failure
      mockEnv.kuzuClient.simulateError('connection');

      await expect(mcpServer.handlers.initialization.analyzeCodebase({
        codebasePath: '/test/project'
      })).rejects.toThrow('Connection lost');

      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should handle malformed code gracefully', async () => {
      const malformedCode = {
        '/src/broken.js': 'class MissingBrace { method() { console.log("broken"'
      };

      fs.readFile.mockImplementation((filePath) => {
        if (malformedCode[filePath]) {
          return Promise.resolve(malformedCode[filePath]);
        }
        return Promise.reject(new Error('File not found'));
      });

      const result = await mcpServer.handlers.validation.validateAgainstKG({
        codeSnippet: malformedCode['/src/broken.js'],
        validationTypes: ['patterns']
      });

      // Should handle parsing errors gracefully
      expect(result.content).toBeDefined();
      const validation = JSON.parse(result.content[0].text);
      expect(validation.validationResults).toBeDefined();
    });

    test('should recover from query failures', async () => {
      // Setup successful initial state
      await mcpServer.handlers.initialization.analyzeCodebase({
        codebasePath: '/test/project'
      });

      // Simulate query failure
      mockEnv.kuzuClient.query = jest.fn().mockRejectedValue(new Error('Query failed'));

      await expect(mcpServer.handlers.context.queryContextForTask({
        taskDescription: 'Test task'
      })).rejects.toThrow('Query failed');

      // Should log error
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });

  describe('Performance and Scalability', () => {
    test('should handle large codebase analysis efficiently', async () => {
      // Create large codebase
      const largeCodebase = {};
      for (let i = 0; i < 100; i++) {
        largeCodebase[`/src/services/Service${i}.js`] = `
          export class Service${i} {
            method${i}() {
              return "service${i}";
            }
          }
        `;
      }

      fs.readFile.mockImplementation((filePath) => {
        if (largeCodebase[filePath]) {
          return Promise.resolve(largeCodebase[filePath]);
        }
        throw new Error('File not found');
      });

      fs.readdir.mockResolvedValue(Object.keys(largeCodebase));

      global.performanceMonitor.start('large-codebase-analysis');
      
      const result = await mcpServer.handlers.initialization.analyzeCodebase({
        codebasePath: '/test/large-project',
        maxDepth: 10
      });

      const duration = global.performanceMonitor.end('large-codebase-analysis');

      expect(result.content).toBeDefined();
      expect(duration).toBeWithinPerformanceThreshold(10000); // 10 seconds max
    });

    test('should handle concurrent tool requests', async () => {
      // Setup knowledge graph
      await mcpServer.handlers.initialization.analyzeCodebase({
        codebasePath: '/test/project'
      });

      // Execute multiple tools concurrently
      const concurrentRequests = [
        mcpServer.handlers.context.queryContextForTask({
          taskDescription: 'Task 1'
        }),
        mcpServer.handlers.validation.validateAgainstKG({
          codeSnippet: 'function test() {}',
          validationTypes: ['patterns']
        }),
        mcpServer.handlers.codeGeneration.generateWithContext({
          requirement: 'Generate service',
          patternsToApply: ['Service Layer']
        })
      ];

      const results = await Promise.all(concurrentRequests);

      expect(results).toHaveLength(3);
      results.forEach(result => {
        expect(result.content).toBeDefined();
      });
    });
  });
});