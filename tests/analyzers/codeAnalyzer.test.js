/**
 * CodeAnalyzer Unit Tests
 * CONTEXT: Comprehensive testing for code analysis functionality
 * REASON: Ensure accurate code parsing and analysis across multiple languages
 * CHANGE: Complete test coverage for code analysis features and edge cases
 * PREVENTION: Analysis inaccuracies, missing entities, parsing failures
 */

import { jest } from '@jest/globals';
import { CodeAnalyzer } from '../../src/analyzers/codeAnalyzer.js';
import { mockLogger } from '../mocks/index.js';
import fs from 'fs/promises';

// Mock dependencies
jest.mock('../../src/utils/logger.js', () => ({
  logger: mockLogger
}));

jest.mock('fs/promises');

// Mock the CppAnalyzer dependency
jest.mock('../../src/analyzers/cppAnalyzer.js', () => ({
  CppAnalyzer: jest.fn().mockImplementation(() => ({
    analyzeCode: jest.fn().mockResolvedValue({
      entities: [],
      metrics: { complexity: 0, linesOfCode: 0 }
    })
  }))
}));

describe('CodeAnalyzer', () => {
  let codeAnalyzer;

  beforeEach(() => {
    codeAnalyzer = new CodeAnalyzer({
      maxComplexity: 10,
      maxFunctionLength: 50,
      maxFileSize: 1048576,
      enableGitIntegration: false
    });
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('constructor', () => {
    test('should initialize with default configuration', () => {
      const analyzer = new CodeAnalyzer();
      
      expect(analyzer.config.maxComplexity).toBe(10);
      expect(analyzer.config.maxFunctionLength).toBe(50);
      expect(analyzer.config.maxClassSize).toBe(200);
      expect(analyzer.config.maxFileSize).toBe(1048576);
    });

    test('should override default configuration', () => {
      const config = {
        maxComplexity: 15,
        maxFunctionLength: 100,
        maxClassSize: 300
      };
      
      const analyzer = new CodeAnalyzer(config);
      
      expect(analyzer.config.maxComplexity).toBe(15);
      expect(analyzer.config.maxFunctionLength).toBe(100);
      expect(analyzer.config.maxClassSize).toBe(300);
    });

    test('should initialize language configurations', () => {
      expect(codeAnalyzer.languageConfigs.javascript).toBeDefined();
      expect(codeAnalyzer.languageConfigs.typescript).toBeDefined();
      expect(codeAnalyzer.languageConfigs.javascript.extensions).toContain('.js');
      expect(codeAnalyzer.languageConfigs.typescript.extensions).toContain('.ts');
    });
  });

  describe('detectLanguage', () => {
    test('should detect JavaScript files', () => {
      expect(codeAnalyzer.detectLanguage('test.js')).toBe('javascript');
      expect(codeAnalyzer.detectLanguage('test.jsx')).toBe('javascript');
      expect(codeAnalyzer.detectLanguage('test.mjs')).toBe('javascript');
    });

    test('should detect TypeScript files', () => {
      expect(codeAnalyzer.detectLanguage('test.ts')).toBe('typescript');
      expect(codeAnalyzer.detectLanguage('test.tsx')).toBe('typescript');
    });

    test('should detect C++ files', () => {
      expect(codeAnalyzer.detectLanguage('test.cpp')).toBe('cpp');
      expect(codeAnalyzer.detectLanguage('test.cc')).toBe('cpp');
      expect(codeAnalyzer.detectLanguage('test.cxx')).toBe('cpp');
      expect(codeAnalyzer.detectLanguage('test.c++')).toBe('cpp');
    });

    test('should detect Arduino files', () => {
      expect(codeAnalyzer.detectLanguage('sketch.ino')).toBe('arduino');
      expect(codeAnalyzer.detectLanguage('sketch.pde')).toBe('arduino');
    });

    test('should detect other languages', () => {
      expect(codeAnalyzer.detectLanguage('test.py')).toBe('python');
      expect(codeAnalyzer.detectLanguage('test.java')).toBe('java');
      expect(codeAnalyzer.detectLanguage('test.c')).toBe('c');
      expect(codeAnalyzer.detectLanguage('test.h')).toBe('c');
    });

    test('should return unknown for unrecognized extensions', () => {
      expect(codeAnalyzer.detectLanguage('test.xyz')).toBe('unknown');
      expect(codeAnalyzer.detectLanguage('README.md')).toBe('unknown');
    });

    test('should handle case insensitive extensions', () => {
      expect(codeAnalyzer.detectLanguage('test.JS')).toBe('javascript');
      expect(codeAnalyzer.detectLanguage('test.TS')).toBe('typescript');
    });
  });

  describe('analyzeFile', () => {
    const sampleJavaScriptCode = `
      /**
       * CONTEXT: User service for handling user operations
       * REASON: Centralized user management logic
       * CHANGE: New service implementation
       * PREVENTION: Scattered user logic across application
       */
      import { Database } from './database.js';
      import { Validator } from './validator.js';
      
      export class UserService {
        constructor() {
          this.db = new Database();
          this.validator = new Validator();
        }
        
        async createUser(userData) {
          if (!this.validator.validate(userData)) {
            throw new Error('Invalid user data');
          }
          
          return await this.db.insert('users', userData);
        }
        
        async getUser(id) {
          return await this.db.findById('users', id);
        }
        
        async updateUser(id, updates) {
          const user = await this.getUser(id);
          if (!user) {
            throw new Error('User not found');
          }
          
          return await this.db.update('users', id, updates);
        }
      }
    `;

    beforeEach(() => {
      fs.readFile.mockResolvedValue(sampleJavaScriptCode);
    });

    test('should analyze JavaScript file successfully', async () => {
      const result = await codeAnalyzer.analyzeFile('test.js');

      expect(result).toBeDefined();
      expect(result.filePath).toBe('test.js');
      expect(result.language).toBe('javascript');
      expect(result.entities).toBeDefined();
      expect(result.imports).toBeDefined();
      expect(result.exports).toBeDefined();
      expect(result.metrics).toBeDefined();
    });

    test('should read file content when not provided', async () => {
      await codeAnalyzer.analyzeFile('test.js');

      expect(fs.readFile).toHaveBeenCalledWith('test.js', 'utf-8');
    });

    test('should use provided content instead of reading file', async () => {
      const customCode = 'function test() { return "hello"; }';
      
      const result = await codeAnalyzer.analyzeFile('test.js', customCode);

      expect(fs.readFile).not.toHaveBeenCalled();
      expect(result.filePath).toBe('test.js');
    });

    test('should handle large files by skipping analysis', async () => {
      const largeContent = 'x'.repeat(2000000); // 2MB content
      fs.readFile.mockResolvedValue(largeContent);

      const result = await codeAnalyzer.analyzeFile('large.js');

      expect(result.entities).toEqual([]);
      expect(result.metrics.linesOfCode).toBe(0);
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Skipping large file')
      );
    });

    test('should handle file reading errors gracefully', async () => {
      fs.readFile.mockRejectedValue(new Error('File not found'));

      const result = await codeAnalyzer.analyzeFile('nonexistent.js');

      expect(result.language).toBe('unknown');
      expect(result.entities).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should extract class entities', async () => {
      const result = await codeAnalyzer.analyzeFile('test.js');

      const classEntities = result.entities.filter(e => e.type === 'class');
      expect(classEntities.length).toBeGreaterThan(0);
      
      const userServiceClass = classEntities.find(e => e.name === 'UserService');
      expect(userServiceClass).toBeDefined();
      expect(userServiceClass.methods).toBeDefined();
      expect(userServiceClass.methods.length).toBeGreaterThan(0);
    });

    test('should extract function entities', async () => {
      const result = await codeAnalyzer.analyzeFile('test.js');

      const functionEntities = result.entities.filter(e => e.type === 'method');
      expect(functionEntities.length).toBeGreaterThan(0);
      
      const createUserMethod = functionEntities.find(e => e.name === 'createUser');
      expect(createUserMethod).toBeDefined();
      expect(createUserMethod.async).toBe(true);
      expect(createUserMethod.parameters).toBeDefined();
    });

    test('should extract import statements', async () => {
      const result = await codeAnalyzer.analyzeFile('test.js');

      expect(result.imports.length).toBeGreaterThan(0);
      
      const databaseImport = result.imports.find(imp => 
        imp.source === './database.js'
      );
      expect(databaseImport).toBeDefined();
      expect(databaseImport.specifiers).toContain('Database');
    });

    test('should extract export statements', async () => {
      const result = await codeAnalyzer.analyzeFile('test.js');

      expect(result.exports.length).toBeGreaterThan(0);
      expect(result.exports).toContain('UserService');
    });

    test('should calculate complexity metrics', async () => {
      const result = await codeAnalyzer.analyzeFile('test.js');

      expect(result.metrics.complexity).toBeGreaterThan(0);
      expect(result.metrics.linesOfCode).toBeGreaterThan(0);
      expect(result.metrics.maintainabilityIndex).toBeGreaterThan(0);
    });

    test('should extract structured comments', async () => {
      const result = await codeAnalyzer.analyzeFile('test.js');

      expect(result.structuredComments.length).toBeGreaterThan(0);
      
      const contextComment = result.structuredComments.find(comment => 
        comment.context === 'User service for handling user operations'
      );
      expect(contextComment).toBeDefined();
      expect(contextComment.reason).toBeDefined();
      expect(contextComment.change).toBeDefined();
      expect(contextComment.prevention).toBeDefined();
    });
  });

  describe('analyzeCode', () => {
    test('should analyze TypeScript code with type annotations', async () => {
      const typeScriptCode = `
        interface User {
          id: string;
          name: string;
          email?: string;
        }
        
        class UserManager {
          private users: User[] = [];
          
          addUser(user: User): void {
            this.users.push(user);
          }
          
          getUser(id: string): User | undefined {
            return this.users.find(u => u.id === id);
          }
        }
      `;

      const result = await codeAnalyzer.analyzeCode(typeScriptCode, 'test.ts', 'typescript');

      expect(result.language).toBe('typescript');
      expect(result.entities.length).toBeGreaterThan(0);
      
      const interfaceEntity = result.entities.find(e => e.type === 'interface');
      expect(interfaceEntity).toBeDefined();
      expect(interfaceEntity.name).toBe('User');
    });

    test('should handle code with syntax errors', async () => {
      const invalidCode = `
        class InvalidClass {
          method() {
            console.log('missing brace'
          // Missing closing brace
      `;

      const result = await codeAnalyzer.analyzeCode(invalidCode, 'invalid.js', 'javascript');

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(issue => issue.type === 'syntax_error')).toBe(true);
    });

    test('should detect high complexity functions', async () => {
      const complexCode = `
        function complexFunction(input) {
          if (input > 0) {
            if (input > 10) {
              if (input > 20) {
                if (input > 30) {
                  if (input > 40) {
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
          return 'negative';
        }
      `;

      const result = await codeAnalyzer.analyzeCode(complexCode, 'complex.js', 'javascript');

      const complexityIssues = result.issues.filter(issue => 
        issue.type === 'high_complexity'
      );
      expect(complexityIssues.length).toBeGreaterThan(0);
    });

    test('should detect security issues', async () => {
      const unsafeCode = `
        function dangerousFunction(userInput) {
          return eval(userInput);
        }
        
        function unsafeHTML(content) {
          document.getElementById('output').innerHTML = content;
        }
      `;

      const result = await codeAnalyzer.analyzeCode(unsafeCode, 'unsafe.js', 'javascript');

      const securityIssues = result.issues.filter(issue => 
        issue.type === 'security_issue'
      );
      expect(securityIssues.length).toBeGreaterThan(0);
      
      const evalIssue = securityIssues.find(issue => 
        issue.description.includes('eval')
      );
      expect(evalIssue).toBeDefined();
    });

    test('should detect code smells', async () => {
      const smellCode = `
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
          method12() {}
          method13() {}
          method14() {}
          method15() {}
          method16() {}
        }
      `;

      const result = await codeAnalyzer.analyzeCode(smellCode, 'smell.js', 'javascript');

      const codeSmells = result.issues.filter(issue => 
        issue.type === 'code_smell'
      );
      expect(codeSmells.length).toBeGreaterThan(0);
    });
  });

  describe('Git integration', () => {
    test('should set Git analyzer for enhanced analysis', () => {
      const mockGitAnalyzer = {
        getFileHistory: jest.fn(),
        getCommitInfo: jest.fn()
      };

      codeAnalyzer.setGitAnalyzer(mockGitAnalyzer);

      expect(codeAnalyzer.gitAnalyzer).toBe(mockGitAnalyzer);
      expect(codeAnalyzer.config.enableGitIntegration).toBe(true);
      expect(mockLogger.info).toHaveBeenCalledWith(
        'Git integration enabled for CodeAnalyzer'
      );
    });

    test('should enhance analysis with Git context when available', async () => {
      const mockGitAnalyzer = {
        getFileHistory: jest.fn().mockResolvedValue([
          { hash: 'abc123', date: '2024-01-01', message: 'Initial commit' }
        ]),
        getCommitInfo: jest.fn().mockResolvedValue({
          author: 'John Doe',
          date: '2024-01-01'
        })
      };

      codeAnalyzer.setGitAnalyzer(mockGitAnalyzer);
      
      const code = 'function test() { return "hello"; }';
      const result = await codeAnalyzer.analyzeCode(code, 'test.js', 'javascript');

      // Enhanced analysis should include Git context
      expect(result.gitContext).toBeDefined();
    });
  });

  describe('specialized language handling', () => {
    test('should delegate C++ analysis to CppAnalyzer', async () => {
      const cppCode = `
        #include <iostream>
        
        class TestClass {
        public:
          void testMethod() {
            std::cout << "Hello World" << std::endl;
          }
        };
      `;

      const result = await codeAnalyzer.analyzeCode(cppCode, 'test.cpp', 'cpp');

      expect(codeAnalyzer.cppAnalyzer.analyzeCode).toHaveBeenCalledWith(
        cppCode, 'test.cpp'
      );
    });

    test('should handle unknown languages gracefully', async () => {
      const unknownCode = 'Some unknown language code';
      
      const result = await codeAnalyzer.analyzeCode(unknownCode, 'test.xyz', 'unknown');

      expect(result.language).toBe('unknown');
      expect(result.entities).toEqual([]);
      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues[0].type).toBe('unsupported_language');
    });
  });

  describe('performance considerations', () => {
    test('should handle large files efficiently', async () => {
      // Generate a large but valid JavaScript file
      const largeCode = Array.from({ length: 1000 }, (_, i) => 
        `function func${i}() { return ${i}; }`
      ).join('\n');

      global.performanceMonitor.start('large-file-analysis');
      
      const result = await codeAnalyzer.analyzeCode(largeCode, 'large.js', 'javascript');
      
      const duration = global.performanceMonitor.end('large-file-analysis');

      expect(result.entities.length).toBe(1000);
      expect(duration).toBeWithinPerformanceThreshold(5000); // 5 seconds max
    });

    test('should cache analysis results when appropriate', async () => {
      const code = 'function test() { return "cached"; }';

      // First analysis
      const start1 = Date.now();
      const result1 = await codeAnalyzer.analyzeCode(code, 'test.js', 'javascript');
      const duration1 = Date.now() - start1;

      // Second analysis (should be faster if cached)
      const start2 = Date.now();
      const result2 = await codeAnalyzer.analyzeCode(code, 'test.js', 'javascript');
      const duration2 = Date.now() - start2;

      expect(result1).toEqual(result2);
      // Note: This assumes caching is implemented
      expect(duration2).toBeLessThanOrEqual(duration1);
    });
  });

  describe('error handling', () => {
    test('should handle parsing errors gracefully', async () => {
      const invalidCode = 'class { invalid syntax }';
      
      const result = await codeAnalyzer.analyzeCode(invalidCode, 'invalid.js', 'javascript');

      expect(result.issues.length).toBeGreaterThan(0);
      expect(result.issues.some(issue => issue.type === 'syntax_error')).toBe(true);
      expect(mockLogger.error).toHaveBeenCalled();
    });

    test('should handle memory-intensive analysis', async () => {
      // Create code that might cause memory issues
      const memoryIntensiveCode = `
        const largeObject = {
          ${Array.from({ length: 10000 }, (_, i) => `prop${i}: "value${i}"`).join(',\n')}
        };
      `;

      const result = await codeAnalyzer.analyzeCode(
        memoryIntensiveCode, 
        'memory-test.js', 
        'javascript'
      );

      expect(result).toBeDefined();
      expect(result.entities.length).toBeGreaterThan(0);
    });
  });
});