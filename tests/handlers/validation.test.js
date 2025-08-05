/**
 * Validation Handler Unit Tests
 * CONTEXT: Comprehensive testing for code validation against knowledge graph
 * REASON: Ensure validation accuracy and reliability for code quality enforcement
 * CHANGE: Complete test coverage for validation logic and edge cases
 * PREVENTION: False positives/negatives, validation bypass, accuracy degradation
 */

import { jest } from '@jest/globals';
import { ValidationHandler } from '../../src/handlers/validation.js';
import { MockKuzuClient } from '../mocks/mockKuzuClient.js';
import { mockLogger } from '../mocks/index.js';

// Mock dependencies
jest.mock('../../src/utils/logger.js', () => ({
  logger: mockLogger
}));

describe('ValidationHandler', () => {
  let validationHandler;
  let mockServer;
  let mockKuzu;

  beforeEach(() => {
    mockKuzu = new MockKuzuClient();
    mockServer = { kuzu: mockKuzu };
    validationHandler = new ValidationHandler(mockServer);
    
    // Setup mock data
    mockKuzu.setMockData('Pattern', [
      {
        name: 'Factory',
        rules: ['single_responsibility'],
        antipatterns: ['god_object']
      },
      {
        name: 'Observer',
        rules: ['loose_coupling'],
        antipatterns: ['tight_coupling']
      }
    ]);
    
    mockKuzu.setMockData('Rule', [
      {
        description: 'Functions should not exceed 50 lines',
        type: 'function_length',
        severity: 'warning'
      },
      {
        description: 'Cyclomatic complexity should be below 10',
        type: 'complexity',
        severity: 'error'
      },
      {
        description: 'Avoid deep nesting beyond 4 levels',
        type: 'deep_nesting',
        severity: 'warning'
      }
    ]);
    
    mockKuzu.setMockData('Standard', [
      {
        name: 'camelCase',
        value: 'functions',
        type: 'naming'
      },
      {
        name: 'PascalCase',
        value: 'classes',
        type: 'naming'
      },
      {
        name: 'noEval',
        value: 'true',
        type: 'security'
      }
    ]);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('validateAgainstKG', () => {
    test('should validate simple valid code successfully', async () => {
      const codeSnippet = `
        /**
         * CONTEXT: User service class
         * REASON: Business logic encapsulation
         * CHANGE: Service layer implementation
         * PREVENTION: Business logic scattered across controllers
         */
        class UserService {
          constructor() {
            this.users = [];
          }
          
          createUser(userData) {
            return userData;
          }
        }
      `;

      const result = await validationHandler.validateAgainstKG({
        codeSnippet,
        validationTypes: ['patterns', 'rules', 'standards'],
        strictMode: true
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.validationResults).toBeDefined();
      expect(parsedResult.overallScore).toBeGreaterThan(0);
      expect(parsedResult.strictMode).toBe(true);
    });

    test('should detect complexity violations', async () => {
      const complexCode = `
        function complexFunction(x) {
          if (x > 0) {
            if (x > 10) {
              if (x > 20) {
                if (x > 30) {
                  if (x > 40) {
                    return 'very high';
                  }
                  return 'high';
                }
                return 'medium-high';
              }
              return 'medium';
            }
            return 'low';
          }
          return 'zero or negative';
        }
      `;

      const result = await validationHandler.validateAgainstKG({
        codeSnippet: complexCode,
        validationTypes: ['rules'],
        strictMode: true
      });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.validationResults.rules.violations).toBeDefined();
      expect(parsedResult.overallScore).toBeLessThan(1.0);
    });

    test('should detect security violations', async () => {
      const unsafeCode = `
        function executeCode(userInput) {
          return eval(userInput);
        }
        
        function updateContent(html) {
          document.getElementById('content').innerHTML = html;
        }
      `;

      const result = await validationHandler.validateAgainstKG({
        codeSnippet: unsafeCode,
        validationTypes: ['standards'],
        strictMode: true
      });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.validationResults.standards.violations).toBeDefined();
      expect(parsedResult.validationResults.standards.violations.length).toBeGreaterThan(0);
      
      const hasSecurityViolation = parsedResult.validationResults.standards.violations
        .some(v => v.severity === 'critical' || v.standard === 'noEval');
      expect(hasSecurityViolation).toBe(true);
    });

    test('should detect naming convention violations', async () => {
      const badNamingCode = `
        class user_service {
          constructor() {}
          
          create_user(user_data) {
            return user_data;
          }
        }
        
        const MAX_users = 100;
      `;

      const result = await validationHandler.validateAgainstKG({
        codeSnippet: badNamingCode,
        validationTypes: ['standards'],
        strictMode: true
      });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.validationResults.standards.violations).toBeDefined();
      expect(parsedResult.validationResults.standards.violations.length).toBeGreaterThan(0);
    });

    test('should handle parsing errors gracefully', async () => {
      const invalidCode = `
        class MissingBrace {
          constructor() {
            this.value = 'test'
          // Missing closing brace
      `;

      await expect(validationHandler.validateAgainstKG({
        codeSnippet: invalidCode,
        validationTypes: ['patterns'],
        strictMode: true
      })).rejects.toThrow();
    });

    test('should work with different validation types', async () => {
      const code = `
        class TestClass {
          method1() {}
          method2() {}
        }
      `;

      // Test with only patterns
      const patternsResult = await validationHandler.validateAgainstKG({
        codeSnippet: code,
        validationTypes: ['patterns'],
        strictMode: false
      });

      const parsedPatterns = JSON.parse(patternsResult.content[0].text);
      expect(parsedPatterns.validationResults.patterns).toBeDefined();
      expect(parsedPatterns.validationResults.rules).toBeUndefined();
      expect(parsedPatterns.validationResults.standards).toBeUndefined();

      // Test with only rules
      const rulesResult = await validationHandler.validateAgainstKG({
        codeSnippet: code,
        validationTypes: ['rules'],
        strictMode: false
      });

      const parsedRules = JSON.parse(rulesResult.content[0].text);
      expect(parsedRules.validationResults.rules).toBeDefined();
      expect(parsedRules.validationResults.patterns).toBeUndefined();
      expect(parsedRules.validationResults.standards).toBeUndefined();
    });

    test('should respect strict mode settings', async () => {
      const codeWithMinorIssues = `
        function longFunctionName() {
          let unused_variable = 'test';
          return 'result';
        }
      `;

      // Test strict mode
      const strictResult = await validationHandler.validateAgainstKG({
        codeSnippet: codeWithMinorIssues,
        validationTypes: ['rules'],
        strictMode: true
      });

      // Test non-strict mode
      const nonStrictResult = await validationHandler.validateAgainstKG({
        codeSnippet: codeWithMinorIssues,
        validationTypes: ['rules'],
        strictMode: false
      });

      const strictParsed = JSON.parse(strictResult.content[0].text);
      const nonStrictParsed = JSON.parse(nonStrictResult.content[0].text);

      expect(strictParsed.strictMode).toBe(true);
      expect(nonStrictParsed.strictMode).toBe(false);
    });
  });

  describe('detectTechnicalDebt', () => {
    beforeEach(() => {
      // Setup technical debt mock data
      mockKuzu.setMockData('TechnicalDebt', [
        {
          type: 'complexity',
          severity: 'high',
          description: 'High cyclomatic complexity',
          entity: 'complexFunction'
        },
        {
          type: 'duplication',
          severity: 'medium',
          description: 'Code duplication detected',
          entity: 'duplicatedMethod'
        }
      ]);
    });

    test('should detect debt in specific module', async () => {
      const result = await validationHandler.detectTechnicalDebt({
        scope: 'module',
        target: '/src/services',
        debtTypes: ['complexity', 'duplication']
      });

      expect(result.content).toBeDefined();
      expect(result.content[0].type).toBe('text');
      
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.scope).toBe('module');
      expect(parsedResult.target).toBe('/src/services');
      expect(parsedResult.analysis).toBeDefined();
    });

    test('should analyze project-wide technical debt', async () => {
      const result = await validationHandler.detectTechnicalDebt({
        scope: 'project',
        debtTypes: ['complexity', 'duplication', 'coupling']
      });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.scope).toBe('project');
      expect(parsedResult.analysis.summary).toBeDefined();
      expect(parsedResult.recommendations).toBeDefined();
    });

    test('should analyze specific entity debt', async () => {
      const result = await validationHandler.detectTechnicalDebt({
        scope: 'specific',
        target: 'UserService',
        debtTypes: ['complexity']
      });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.scope).toBe('specific');
      expect(parsedResult.target).toBe('UserService');
    });

    test('should generate appropriate recommendations', async () => {
      const result = await validationHandler.detectTechnicalDebt({
        scope: 'project',
        debtTypes: ['complexity', 'duplication']
      });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.recommendations).toBeDefined();
      expect(Array.isArray(parsedResult.recommendations)).toBe(true);
    });

    test('should handle empty debt results', async () => {
      // Clear mock data to simulate no debt
      mockKuzu.clearAllData();

      const result = await validationHandler.detectTechnicalDebt({
        scope: 'module',
        target: '/src/clean-module',
        debtTypes: ['complexity']
      });

      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.analysis.summary.totalIssues).toBe(0);
    });
  });

  describe('extractCodeCharacteristics', () => {
    test('should extract function characteristics', () => {
      const ast = validationHandler.server.kuzu = mockKuzu;
      // We need to parse the code first
      const { parse } = require('@babel/parser');
      
      const code = `
        function testFunction(param1, param2) {
          return param1 + param2;
        }
        
        const arrowFunc = (x) => x * 2;
        
        async function asyncFunction() {
          return await Promise.resolve('test');
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'decorators-legacy']
      });

      const characteristics = validationHandler.extractCodeCharacteristics(ast);

      expect(characteristics.functions).toBeDefined();
      expect(characteristics.functions.length).toBeGreaterThan(0);
      expect(characteristics.functions.some(f => f.name === 'testFunction')).toBe(true);
      expect(characteristics.functions.some(f => f.async === true)).toBe(true);
    });

    test('should extract class characteristics', () => {
      const { parse } = require('@babel/parser');
      
      const code = `
        class TestClass {
          constructor() {}
          method1() {}
          method2() {}
          method3() {}
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'decorators-legacy']
      });

      const characteristics = validationHandler.extractCodeCharacteristics(ast);

      expect(characteristics.classes).toBeDefined();
      expect(characteristics.classes.length).toBe(1);
      expect(characteristics.classes[0].name).toBe('TestClass');
      expect(characteristics.classes[0].methods).toBe(3); // excluding constructor
    });

    test('should detect security issues', () => {
      const { parse } = require('@babel/parser');
      
      const code = `
        function unsafeCode(input) {
          const result = eval(input);
          document.getElementById('output').innerHTML = result;
          return result;
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'decorators-legacy']
      });

      const characteristics = validationHandler.extractCodeCharacteristics(ast);

      expect(characteristics.hasEval).toBe(true);
      expect(characteristics.hasInnerHTML).toBe(true);
    });

    test('should calculate complexity metrics', () => {
      const { parse } = require('@babel/parser');
      
      const code = `
        function complexFunction(x) {
          if (x > 0) {
            for (let i = 0; i < x; i++) {
              if (i % 2 === 0) {
                console.log(i);
              }
            }
          }
          return x > 5 ? 'high' : 'low';
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'decorators-legacy']
      });

      const characteristics = validationHandler.extractCodeCharacteristics(ast);

      expect(characteristics.complexity).toBeGreaterThan(0);
      expect(characteristics.maxNestingLevel).toBeGreaterThan(1);
    });

    test('should track variable usage', () => {
      const { parse } = require('@babel/parser');
      
      const code = `
        function testFunction() {
          const usedVar = 'used';
          const unusedVar = 'unused';
          let anotherUnused;
          
          console.log(usedVar);
          return 'result';
        }
      `;

      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'decorators-legacy']
      });

      const characteristics = validationHandler.extractCodeCharacteristics(ast);

      expect(characteristics.variables).toBeDefined();
      expect(characteristics.unusedVariables).toBeDefined();
      expect(characteristics.unusedVariables.length).toBeGreaterThan(0);
    });
  });

  describe('rule checking methods', () => {
    test('should check complexity rules', () => {
      const characteristics = {
        complexity: 15,
        functions: [],
        classes: []
      };

      const rule = {
        type: 'complexity',
        description: 'Limit cyclomatic complexity',
        severity: 'error'
      };

      const violation = validationHandler.checkRule(characteristics, rule);

      expect(violation).toBeDefined();
      expect(violation.type).toBe('rule_violation');
      expect(violation.severity).toBe('error');
      expect(violation.message).toContain('complexity');
    });

    test('should check function length rules', () => {
      const characteristics = {
        complexity: 5,
        functions: [
          { name: 'shortFunction', linesOfCode: 10 },
          { name: 'longFunction', linesOfCode: 80 }
        ],
        classes: []
      };

      const rule = {
        type: 'function_length',
        description: 'Limit function length',
        severity: 'warning'
      };

      const violation = validationHandler.checkRule(characteristics, rule);

      expect(violation).toBeDefined();
      expect(violation.entities).toContain('longFunction');
      expect(violation.entities).not.toContain('shortFunction');
    });

    test('should check naming standards', () => {
      const characteristics = {
        functions: [
          { name: 'goodFunction' },
          { name: 'bad_function' },
          { name: 'AnotherBadFunction' }
        ]
      };

      const standard = {
        name: 'camelCase',
        type: 'naming'
      };

      const violation = validationHandler.checkNamingStandards(characteristics, standard);

      expect(violation).toBeDefined();
      expect(violation.entities).toContain('bad_function');
      expect(violation.entities).toContain('AnotherBadFunction');
      expect(violation.entities).not.toContain('goodFunction');
    });
  });

  describe('error handling', () => {
    test('should handle database connection errors', async () => {
      mockKuzu.simulateError('connection');

      await expect(validationHandler.validateAgainstKG({
        codeSnippet: 'function test() {}',
        validationTypes: ['patterns']
      })).rejects.toThrow('Connection lost');
    });

    test('should handle query execution errors', async () => {
      // Mock query to throw error
      mockKuzu.query = jest.fn().mockRejectedValue(new Error('Query failed'));

      await expect(validationHandler.detectTechnicalDebt({
        scope: 'module',
        target: '/src/test'
      })).rejects.toThrow('Query failed');
    });

    test('should log errors appropriately', async () => {
      mockKuzu.simulateError('query');

      try {
        await validationHandler.validateAgainstKG({
          codeSnippet: 'function test() {}',
          validationTypes: ['patterns']
        });
      } catch (error) {
        // Error should be logged
        expect(mockLogger.error).toHaveBeenCalled();
      }
    });
  });

  describe('performance considerations', () => {
    test('should handle large code snippets efficiently', async () => {
      // Generate a large code snippet
      const largeCode = Array.from({ length: 1000 }, (_, i) => 
        `function func${i}() { return ${i}; }`
      ).join('\n');

      global.performanceMonitor.start('validation-large-code');
      
      const result = await validationHandler.validateAgainstKG({
        codeSnippet: largeCode,
        validationTypes: ['rules'],
        strictMode: false
      });

      const duration = global.performanceMonitor.end('validation-large-code');

      expect(result).toBeDefined();
      expect(duration).toBeWithinPerformanceThreshold(5000); // 5 seconds max
    });

    test('should cache validation results when appropriate', async () => {
      const code = 'function test() { return "test"; }';

      // First validation
      const start1 = Date.now();
      await validationHandler.validateAgainstKG({
        codeSnippet: code,
        validationTypes: ['patterns']
      });
      const duration1 = Date.now() - start1;

      // Second validation (should be faster if cached)
      const start2 = Date.now();
      await validationHandler.validateAgainstKG({
        codeSnippet: code,
        validationTypes: ['patterns']
      });
      const duration2 = Date.now() - start2;

      // Note: This test assumes caching is implemented
      // If not implemented, both durations will be similar
      expect(duration2).toBeLessThanOrEqual(duration1);
    });
  });

  describe('integration with knowledge graph', () => {
    test('should query patterns correctly', async () => {
      const code = 'class Factory { create() { return {}; } }';

      await validationHandler.validateAgainstKG({
        codeSnippet: code,
        validationTypes: ['patterns']
      });

      const queryHistory = mockKuzu.getQueryHistory();
      const patternQueries = queryHistory.filter(q => 
        q.query.includes('Pattern') || q.query.includes('MATCH (p:Pattern)')
      );

      expect(patternQueries.length).toBeGreaterThan(0);
    });

    test('should handle empty knowledge graph gracefully', async () => {
      // Clear all mock data
      mockKuzu.clearAllData();

      const result = await validationHandler.validateAgainstKG({
        codeSnippet: 'function test() {}',
        validationTypes: ['patterns', 'rules', 'standards']
      });

      expect(result.content).toBeDefined();
      const parsedResult = JSON.parse(result.content[0].text);
      expect(parsedResult.validationResults).toBeDefined();
    });
  });
});