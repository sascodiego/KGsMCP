/**
 * Jest configuration for comprehensive MCP testing
 * CONTEXT: Testing framework configuration for Node.js MCP server
 * REASON: Comprehensive test coverage with proper ESM support and mocking
 * CHANGE: Jest config with coverage reporting and test environment setup
 * PREVENTION: Test execution failures, missing coverage, configuration issues
 */

export default {
  // Use ES modules
  preset: 'default',
  extensionsToTreatAsEsm: ['.js'],
  globals: {
    'ts-jest': {
      useESM: true
    }
  },
  moduleNameMapping: {
    '^(\\.{1,2}/.*)\\.js$': '$1'
  },

  // Test environment
  testEnvironment: 'node',
  
  // Test file patterns
  testMatch: [
    '**/tests/**/*.test.js',
    '**/src/**/*.test.js',
    '**/__tests__/**/*.js'
  ],
  
  // Coverage configuration
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: [
    'text',
    'lcov',
    'html',
    'json'
  ],
  
  // Coverage thresholds
  coverageThreshold: {
    global: {
      branches: 85,
      functions: 90,
      lines: 90,
      statements: 90
    }
  },
  
  // Files to collect coverage from
  collectCoverageFrom: [
    'src/**/*.js',
    'scripts/**/*.js',
    '!src/**/*.test.js',
    '!src/**/mock*.js',
    '!**/node_modules/**',
    '!**/coverage/**'
  ],
  
  // Setup files
  setupFilesAfterEnv: [
    '<rootDir>/tests/setup.js'
  ],
  
  // Module directories
  moduleDirectories: [
    'node_modules',
    '<rootDir>/src',
    '<rootDir>/tests'
  ],
  
  // Test timeout
  testTimeout: 30000,
  
  // Transform configuration
  transform: {},
  
  // Clear mocks between tests
  clearMocks: true,
  restoreMocks: true,
  
  // Verbose output
  verbose: true,
  
  // Test result processors
  reporters: [
    'default',
    ['jest-html-reporters', {
      publicDir: './coverage',
      filename: 'test-report.html',
      expand: true
    }]
  ],
  
  // Mock patterns
  modulePathIgnorePatterns: [
    '<rootDir>/node_modules/'
  ],
  
  // Global test setup
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  
  // Error handling
  errorOnDeprecated: true,
  
  // Parallel execution
  maxWorkers: '50%'
};