/**
 * Code Generation Handler Unit Tests
 * CONTEXT: Comprehensive testing for code generation with context awareness
 * REASON: Ensure code generation accuracy and template quality
 * CHANGE: Complete test coverage for code generation features
 * PREVENTION: Generated code quality issues, template errors, context misalignment
 */

import { jest } from '@jest/globals';
import { CodeGenerationHandler } from '../../src/handlers/codeGeneration.js';
import { MockKuzuClient } from '../mocks/mockKuzuClient.js';
import { mockLogger } from '../mocks/index.js';

// Mock dependencies
jest.mock('../../src/utils/logger.js', () => ({
  logger: mockLogger
}));

describe('CodeGenerationHandler', () => {
  let codeGenerationHandler;
  let mockServer;
  let mockKuzu;

  beforeEach(() => {
    mockKuzu = new MockKuzuClient();
    mockServer = { kuzu: mockKuzu };
    codeGenerationHandler = new CodeGenerationHandler(mockServer);
    
    // Setup mock data
    mockKuzu.setMockData('Pattern', [
      {
        name: 'Factory',
        description: 'Factory pattern for object creation',
        implementation: 'class Factory { create() { return new Object(); } }',
        category: 'creational'
      },
      {
        name: 'Observer',
        description: 'Observer pattern for event handling',
        implementation: 'class Observer { update() {} }',
        category: 'behavioral'
      }
    ]);
    
    mockKuzu.setMockData('Rule', [
      {
        description: 'Use meaningful function names',
        category: 'naming'
      },
      {
        description: 'Limit function parameters to 5 or fewer',
        category: 'maintainability'
      }
    ]);
    
    mockKuzu.setMockData('Standard', [
      {
        name: 'camelCase',
        category: 'naming',
        value: 'functions'
      },
      {
        name: 'PascalCase',
        category: 'naming',
        value: 'classes'
      }
    ]);
    
    mockKuzu.setMockData('RefactoringPattern', [
      {
        name: 'Extract Method',
        description: 'Extract complex logic into separate methods',
        steps: ['Identify complex code', 'Create new method', 'Replace with method call'],
        solves: 'complexity',
        preservesBehavior: true
      }
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateWithContext', () => {
    test('should generate code guidance with patterns and rules', async () => {
      const result = await codeGenerationHandler.generateWithContext({
        requirement: 'Create a user service with factory pattern',
        patternsToApply: ['Factory'],
        constraints: {
          language: 'javascript',
          framework: 'express'
        }
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.requirement).toBe('Create a user service with factory pattern');
      expect(parsedResult.guidance).toBeDefined();
      expect(parsedResult.context).toBeDefined();
      expect(parsedResult.constraints).toBeDefined();
    });

    test('should include patterns in guidance', async () => {
      const result = await codeGenerationHandler.generateWithContext({
        requirement: 'Implement observer pattern for notifications',
        patternsToApply: ['Observer'],
        constraints: {}
      });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.guidance.patterns).toBeDefined();
      expect(parsedResult.guidance.structure).toBeDefined();
      expect(parsedResult.guidance.bestPractices).toBeDefined();
      expect(parsedResult.guidance.implementation).toBeDefined();
    });

    test('should handle empty patterns gracefully', async () => {
      const result = await codeGenerationHandler.generateWithContext({
        requirement: 'Create a simple utility function',
        patternsToApply: [],
        constraints: {}
      });

      expect(result.content).toBeDefined();
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.guidance).toBeDefined();
    });

    test('should respect language constraints', async () => {
      const result = await codeGenerationHandler.generateWithContext({
        requirement: 'Create a data model',
        patternsToApply: ['Factory'],
        constraints: {
          language: 'typescript',
          useInterfaces: true
        }
      });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.constraints.language).toBe('typescript');
      expect(parsedResult.constraints.useInterfaces).toBe(true);
    });
  });

  describe('suggestRefactoring', () => {
    beforeEach(() => {
      mockKuzu.setMockData('CodeEntity', [
        {
          name: 'ComplexService',
          type: 'class',
          filePath: '/src/services/ComplexService.js'
        }
      ]);
      
      mockKuzu.setMockData('TechnicalDebt', [
        {
          type: 'complexity',
          description: 'High cyclomatic complexity'
        }
      ]);
    });

    test('should provide refactoring suggestions for complex code', async () => {
      const result = await codeGenerationHandler.suggestRefactoring({
        codeEntity: 'ComplexService',
        improvementGoals: ['reduce complexity', 'improve maintainability'],
        preserveBehavior: true
      });

      expect(result.content).toBeDefined();
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.codeEntity).toBe('ComplexService');
      expect(parsedResult.improvementGoals).toContain('reduce complexity');
      expect(parsedResult.preserveBehavior).toBe(true);
      expect(parsedResult.suggestions).toBeDefined();
    });

    test('should filter suggestions based on behavior preservation', async () => {
      // Add a pattern that doesn't preserve behavior
      mockKuzu.setMockData('RefactoringPattern', [
        {
          name: 'Complete Rewrite',
          description: 'Rewrite the entire module',
          steps: ['Analyze requirements', 'Rewrite code'],
          solves: 'complexity',
          preservesBehavior: false
        }
      ]);

      const result = await codeGenerationHandler.suggestRefactoring({
        codeEntity: 'ComplexService',
        improvementGoals: ['reduce complexity'],
        preserveBehavior: true
      });

      const parsedResult = JSON.parse(result.content[0].text);
      // Should not include patterns that don't preserve behavior
      const behaviorBreakingPatterns = parsedResult.suggestions.suggestions?.filter(
        s => s.pattern === 'Complete Rewrite'
      );
      expect(behaviorBreakingPatterns?.length || 0).toBe(0);
    });

    test('should calculate appropriate priorities', async () => {
      const result = await codeGenerationHandler.suggestRefactoring({
        codeEntity: 'ComplexService',
        improvementGoals: ['reduce complexity'],
        preserveBehavior: true
      });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.suggestions.estimatedImpact).toBeDefined();
      expect(['low', 'medium', 'high']).toContain(parsedResult.suggestions.estimatedImpact.riskLevel);
    });

    test('should handle non-existent entities', async () => {
      const result = await codeGenerationHandler.suggestRefactoring({
        codeEntity: 'NonExistentService',
        improvementGoals: ['improve'],
        preserveBehavior: true
      });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.suggestions.message).toBeDefined();
    });
  });

  describe('generateFromTemplate', () => {
    test('should generate JavaScript class template', async () => {
      const result = await codeGenerationHandler.generateFromTemplate({
        templateType: 'class',
        name: 'UserService',
        requirements: {
          properties: [
            { name: 'users', type: 'array' }
          ],
          methods: [
            { name: 'getUser', parameters: [{ name: 'id', type: 'string' }] },
            { name: 'createUser', parameters: [{ name: 'userData', type: 'object' }] }
          ]
        },
        language: 'javascript'
      });

      expect(result.content).toBeDefined();
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.templateType).toBe('class');
      expect(parsedResult.name).toBe('UserService');
      expect(parsedResult.language).toBe('javascript');
      expect(parsedResult.generatedCode).toBeDefined();
      expect(parsedResult.generatedCode).toContain('class UserService');
      expect(parsedResult.generatedCode).toContain('constructor');
      expect(parsedResult.generatedCode).toContain('getUser');
      expect(parsedResult.generatedCode).toContain('createUser');
    });

    test('should generate TypeScript class template', async () => {
      const result = await codeGenerationHandler.generateFromTemplate({
        templateType: 'class',
        name: 'DataProcessor',
        requirements: {
          properties: [
            { name: 'data', type: 'T[]' }
          ],
          methods: [
            { name: 'process', returnType: 'Promise<T[]>' }
          ],
          implements: ['IDataProcessor']
        },
        language: 'typescript'
      });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.generatedCode).toContain('interface IDataProcessor');
      expect(parsedResult.generatedCode).toContain('implements IDataProcessor');
      expect(parsedResult.generatedCode).toContain('private data: T[]');
    });

    test('should generate function template', async () => {
      const result = await codeGenerationHandler.generateFromTemplate({
        templateType: 'function',
        name: 'calculateSum',
        requirements: {
          parameters: [
            { name: 'numbers', type: 'number[]' }
          ],
          returnType: 'number',
          async: false
        },
        language: 'javascript'
      });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.generatedCode).toContain('function calculateSum');
      expect(parsedResult.generatedCode).toContain('numbers');
      expect(parsedResult.generatedCode).toContain('try {');
      expect(parsedResult.generatedCode).toContain('catch (error)');
    });

    test('should generate async function template', async () => {
      const result = await codeGenerationHandler.generateFromTemplate({
        templateType: 'function',
        name: 'fetchUserData',
        requirements: {
          parameters: [
            { name: 'userId', type: 'string' }
          ],
          returnType: 'Promise<User>',
          async: true
        },
        language: 'typescript'
      });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.generatedCode).toContain('async function fetchUserData');
      expect(parsedResult.generatedCode).toContain('userId: string');
      expect(parsedResult.generatedCode).toContain(': Promise<User>');
    });

    test('should generate TypeScript interface template', async () => {
      const result = await codeGenerationHandler.generateFromTemplate({
        templateType: 'interface',
        name: 'User',
        requirements: {
          properties: [
            { name: 'id', type: 'string' },
            { name: 'name', type: 'string' },
            { name: 'email', type: 'string', optional: true }
          ],
          methods: [
            { name: 'validate', returnType: 'boolean' }
          ]
        },
        language: 'typescript'
      });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.generatedCode).toContain('interface IUser');
      expect(parsedResult.generatedCode).toContain('id: string');
      expect(parsedResult.generatedCode).toContain('email?: string');
      expect(parsedResult.generatedCode).toContain('validate(): boolean');
    });

    test('should generate test template', async () => {
      const result = await codeGenerationHandler.generateFromTemplate({
        templateType: 'test',
        name: 'UserService',
        requirements: {
          framework: 'jest',
          testCases: [
            {
              description: 'should create user successfully',
              setup: 'const service = new UserService();',
              action: 'const user = service.createUser({name: "test"});',
              assertion: 'expect(user).toBeDefined();'
            }
          ]
        },
        language: 'javascript'
      });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.generatedCode).toContain('describe(\'UserService\'');
      expect(parsedResult.generatedCode).toContain('should create user successfully');
      expect(parsedResult.generatedCode).toContain('const service = new UserService()');
    });

    test('should generate React component template', async () => {
      const result = await codeGenerationHandler.generateFromTemplate({
        templateType: 'component',
        name: 'UserCard',
        requirements: {
          framework: 'react',
          props: [
            { name: 'user', type: 'User' },
            { name: 'onClick', type: '() => void', optional: true }
          ]
        },
        language: 'typescript'
      });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.generatedCode).toContain('interface IUserCardProps');
      expect(parsedResult.generatedCode).toContain('user: User');
      expect(parsedResult.generatedCode).toContain('onClick?: () => void');
      expect(parsedResult.generatedCode).toContain('const UserCard: FC<IUserCardProps>');
    });

    test('should handle unsupported template types', async () => {
      await expect(codeGenerationHandler.generateFromTemplate({
        templateType: 'unsupported',
        name: 'Test',
        requirements: {},
        language: 'javascript'
      })).rejects.toThrow('Template type \'unsupported\' not supported');
    });

    test('should throw error for interface in JavaScript', async () => {
      await expect(codeGenerationHandler.generateFromTemplate({
        templateType: 'interface',
        name: 'User',
        requirements: {},
        language: 'javascript'
      })).rejects.toThrow('Interfaces are only supported in TypeScript');
    });
  });

  describe('analyzeAndImprove', () => {
    test('should analyze code and suggest improvements', async () => {
      const codeSnippet = `
        class LargeClass {
          method1() {}
          method2() {}
          method3() {}
          method4() {}
          method5() {}
          method6() {}
          method7() {}
          method8() {}
          method9() {}
          method10() {}
          method11() {}
        }
      `;

      const result = await codeGenerationHandler.analyzeAndImprove({
        codeSnippet,
        focus: 'maintainability'
      });

      expect(result.content).toBeDefined();
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.analysis).toBeDefined();
      expect(parsedResult.improvements).toBeDefined();
      expect(parsedResult.focus).toBe('maintainability');
      expect(parsedResult.estimatedImpact).toBeDefined();
    });

    test('should focus on performance improvements', async () => {
      const codeSnippet = `
        function func1() {}
        function func2() {}
        function func3() {}
        function func4() {}
        function func5() {}
        function func6() {}
        function func7() {}
        function func8() {}
        function func9() {}
        function func10() {}
        function func11() {}
      `;

      const result = await codeGenerationHandler.analyzeAndImprove({
        codeSnippet,
        focus: 'performance'
      });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.focus).toBe('performance');
      
      const performanceImprovements = parsedResult.improvements.filter(
        imp => imp.type === 'performance'
      );
      expect(performanceImprovements.length).toBeGreaterThan(0);
    });

    test('should handle malformed code gracefully', async () => {
      const malformedCode = `
        class MissingBrace {
          method() {
            console.log('test')
          // Missing closing brace
      `;

      await expect(codeGenerationHandler.analyzeAndImprove({
        codeSnippet: malformedCode,
        focus: 'all'
      })).rejects.toThrow();
    });
  });

  describe('helper methods', () => {
    test('should format names correctly', () => {
      expect(codeGenerationHandler.formatName('user-service', 'camelCase')).toBe('userService');
      expect(codeGenerationHandler.formatName('user-service', 'PascalCase')).toBe('UserService');
      expect(codeGenerationHandler.formatName('UserService', 'kebab-case')).toBe('user-service');
      expect(codeGenerationHandler.formatName('UserService', 'snake_case')).toBe('user_service');
      expect(codeGenerationHandler.formatName('User', 'PascalCase', 'I')).toBe('IUser');
    });

    test('should generate constructor parameters', () => {
      const properties = [
        { name: 'id', type: 'string' },
        { name: 'name', type: 'string' }
      ];
      
      const untypedParams = codeGenerationHandler.generateConstructorParams(properties, false);
      expect(untypedParams).toBe('id, name');
      
      const typedParams = codeGenerationHandler.generateConstructorParams(properties, true);
      expect(typedParams).toBe('id: string, name: string');
    });

    test('should generate property assignments', () => {
      const properties = [
        { name: 'id' },
        { name: 'name' }
      ];
      
      const assignments = codeGenerationHandler.generatePropertyAssignments(properties);
      expect(assignments).toContain('this.id = id');
      expect(assignments).toContain('this.name = name');
    });

    test('should generate method templates', () => {
      const method = {
        name: 'getUser',
        parameters: [{ name: 'id', type: 'string' }],
        returnType: 'User',
        async: true
      };
      
      const methodTemplate = codeGenerationHandler.generateMethodTemplate(method, true);
      expect(methodTemplate).toContain('async getUser');
      expect(methodTemplate).toContain('id: string');
      expect(methodTemplate).toContain(': User');
    });

    test('should generate function parameters', () => {
      const params = [
        { name: 'id', type: 'string' },
        { name: 'options', type: 'object', optional: true }
      ];
      
      const functionParams = codeGenerationHandler.generateFunctionParams(params, true);
      expect(functionParams).toBe('id: string, options?: object');
    });
  });

  describe('error handling', () => {
    test('should handle database connection errors', async () => {
      mockKuzu.simulateError('connection');

      await expect(codeGenerationHandler.generateWithContext({
        requirement: 'Create a service',
        patternsToApply: ['Factory']
      })).rejects.toThrow('Connection lost');
    });

    test('should handle query execution errors', async () => {
      mockKuzu.query = jest.fn().mockRejectedValue(new Error('Query failed'));

      await expect(codeGenerationHandler.suggestRefactoring({
        codeEntity: 'TestService',
        improvementGoals: ['improve']
      })).rejects.toThrow('Query failed');
    });

    test('should log errors appropriately', async () => {
      mockKuzu.simulateError('query');

      try {
        await codeGenerationHandler.generateWithContext({
          requirement: 'Test requirement',
          patternsToApply: []
        });
      } catch (error) {
        expect(mockLogger.error).toHaveBeenCalled();
      }
    });
  });

  describe('performance considerations', () => {
    test('should handle large template generation efficiently', async () => {
      const largeRequirements = {
        properties: Array.from({ length: 50 }, (_, i) => ({
          name: `property${i}`,
          type: 'string'
        })),
        methods: Array.from({ length: 50 }, (_, i) => ({
          name: `method${i}`,
          parameters: [{ name: 'param', type: 'any' }]
        }))
      };

      global.performanceMonitor.start('large-template-generation');
      
      const result = await codeGenerationHandler.generateFromTemplate({
        templateType: 'class',
        name: 'LargeClass',
        requirements: largeRequirements,
        language: 'typescript'
      });

      const duration = global.performanceMonitor.end('large-template-generation');

      expect(result).toBeDefined();
      expect(duration).toBeWithinPerformanceThreshold(3000); // 3 seconds max
    });

    test('should cache template results when appropriate', async () => {
      const templateRequest = {
        templateType: 'class',
        name: 'CachedClass',
        requirements: {
          methods: [{ name: 'test' }]
        },
        language: 'javascript'
      };

      // First generation
      const start1 = Date.now();
      await codeGenerationHandler.generateFromTemplate(templateRequest);
      const duration1 = Date.now() - start1;

      // Second generation (should be faster if cached)
      const start2 = Date.now();
      await codeGenerationHandler.generateFromTemplate(templateRequest);
      const duration2 = Date.now() - start2;

      // Note: This assumes caching is implemented
      expect(duration2).toBeLessThanOrEqual(duration1);
    });
  });
});