# MCP System Comprehensive Test Suite

## Overview

This directory contains a comprehensive test suite for the MCP (Model Context Protocol) system that ensures reliability, performance, and security across all components. The test suite follows industry best practices and provides extensive coverage for all system functionality.

## Test Structure

```
tests/
├── setup.js                 # Global test setup and utilities
├── globalSetup.js           # Jest global setup
├── globalTeardown.js        # Jest global teardown
├── run-tests.js            # Comprehensive test runner
├── mocks/                  # Mock implementations
│   ├── index.js           # Mock exports
│   └── mockKuzuClient.js  # Database mocking
├── handlers/              # Handler unit tests
│   ├── validation.test.js
│   └── codeGeneration.test.js
├── analyzers/             # Analyzer unit tests
│   └── codeAnalyzer.test.js
├── database/              # Database unit tests
│   └── kuzuClient.test.js
├── integration/           # Integration tests
│   └── mcp-workflow.test.js
├── performance/           # Performance tests
│   └── optimization.test.js
├── security/              # Security tests
│   └── validation.test.js
└── e2e/                   # End-to-end tests
    └── cli-commands.test.js
```

## Test Categories

### 1. Unit Tests
- **Purpose**: Test individual components in isolation
- **Coverage**: Functions, classes, modules
- **Mocking**: External dependencies are mocked
- **Performance**: Fast execution (< 1s per test)

### 2. Integration Tests
- **Purpose**: Test component interactions and workflows
- **Coverage**: Handler interactions, database operations, API workflows
- **Environment**: Use test databases and mock external services
- **Performance**: Moderate execution (< 30s per test suite)

### 3. Performance Tests
- **Purpose**: Validate system performance under load
- **Coverage**: Caching, database optimization, concurrent operations
- **Metrics**: Response times, throughput, memory usage
- **Thresholds**: Defined SLA requirements

### 4. Security Tests
- **Purpose**: Ensure system security against vulnerabilities
- **Coverage**: Input validation, injection attacks, authentication
- **Scope**: All user inputs and external interfaces
- **Standards**: OWASP security guidelines

### 5. End-to-End Tests
- **Purpose**: Test complete user workflows
- **Coverage**: CLI commands, full system integration
- **Environment**: Production-like setup
- **Scenarios**: Real-world usage patterns

## Running Tests

### Quick Start
```bash
# Run default tests (unit + integration)
npm test

# Run all test types
npm run test:all

# Run specific test types
npm run test:unit
npm run test:integration
npm run test:performance
npm run test:security
npm run test:e2e

# Run with coverage report
npm run test:coverage

# Run in CI environment
npm run test:ci
```

### Test Runner Options
```bash
# Run specific test categories
node tests/run-tests.js --unit --integration

# Run all tests with coverage
node tests/run-tests.js --all --coverage

# Continue on failures (for CI)
node tests/run-tests.js --all --continue-on-failure

# Verbose output
node tests/run-tests.js --all --verbose

# Help
node tests/run-tests.js --help
```

## Test Configuration

### Jest Configuration
- **File**: `jest.config.js`
- **Environment**: Node.js with ES modules support
- **Coverage**: 90% statements, 85% branches, 90% functions
- **Timeout**: 30 seconds default, configurable per test type

### Environment Variables
```bash
NODE_ENV=test
LOG_LEVEL=error
TEST_TIMEOUT=30000
TEST_DB_PATH=/tmp/test-kuzu-db
TEST_MODE=true
```

## Writing Tests

### Test Structure Template
```javascript
/**
 * Component Unit Tests
 * CONTEXT: What this test file covers
 * REASON: Why these tests are important
 * CHANGE: What functionality is being tested
 * PREVENTION: What failures these tests prevent
 */

import { jest } from '@jest/globals';
import { ComponentUnderTest } from '../../src/path/to/component.js';
import { mockDependency } from '../mocks/index.js';

describe('ComponentUnderTest', () => {
  let component;
  
  beforeEach(() => {
    component = new ComponentUnderTest();
    jest.clearAllMocks();
  });

  describe('method name', () => {
    test('should handle normal case', () => {
      // Arrange
      const input = 'test input';
      
      // Act
      const result = component.method(input);
      
      // Assert
      expect(result).toBe('expected output');
    });

    test('should handle edge cases', () => {
      // Test edge cases, error conditions, etc.
    });
  });
});
```

### Best Practices

1. **Naming Conventions**
   - Use descriptive test names: `should handle invalid input gracefully`
   - Group related tests with `describe()` blocks
   - Use consistent file naming: `component.test.js`

2. **Test Structure**
   - Follow Arrange-Act-Assert pattern
   - One assertion per test when possible
   - Clear setup and teardown

3. **Mocking**
   - Mock external dependencies
   - Use realistic mock data
   - Verify mock interactions when needed

4. **Performance Testing**
   - Use performance thresholds
   - Measure actual execution time
   - Test with realistic data sizes

5. **Security Testing**
   - Test all input validation
   - Include malicious input scenarios
   - Verify sanitization effectiveness

## Mock System

### Mock Database (MockKuzuClient)
```javascript
import { MockKuzuClient } from './mocks/mockKuzuClient.js';

const mockKuzu = new MockKuzuClient();
await mockKuzu.connect();

// Set up test data
mockKuzu.setMockData('CodeEntity', [
  { id: 'test-1', name: 'TestClass', type: 'class' }
]);

// Query returns mock data
const result = await mockKuzu.query('MATCH (e:CodeEntity) RETURN e');
```

### Mock Environment
```javascript
import { createMockEnvironment } from './mocks/index.js';

const mockEnv = createMockEnvironment();
// Provides: kuzuClient, logger, cache, server, performanceMonitor
```

## Performance Benchmarks

### Expected Performance Thresholds

| Operation | Threshold | Measurement |
|-----------|-----------|-------------|
| Cache L1 Access | < 1ms | Average response time |
| Database Query | < 100ms | Simple queries |
| Code Analysis | < 5s | 1000 line file |
| Pattern Detection | < 2s | Medium complexity |
| Validation | < 500ms | Standard code snippet |

### Performance Test Example
```javascript
test('should meet performance requirements', async () => {
  global.performanceMonitor.start('operation');
  
  await performOperation();
  
  const duration = global.performanceMonitor.end('operation');
  expect(duration).toBeWithinPerformanceThreshold(1000);
});
```

## Security Test Coverage

### Input Validation Tests
- SQL Injection prevention
- NoSQL Injection prevention
- XSS (Cross-Site Scripting) prevention
- Path traversal prevention
- Command injection prevention
- LDAP injection prevention

### Authentication & Authorization
- Token validation
- Session management
- Permission checking
- Privilege escalation prevention

### Security Headers
- CORS configuration
- Security headers validation
- Content Security Policy

## Coverage Requirements

### Minimum Coverage Thresholds
- **Statements**: 90%
- **Branches**: 85%
- **Functions**: 90%
- **Lines**: 90%

### Coverage Exclusions
- Test files themselves
- Mock implementations
- Build and configuration files
- Third-party dependencies

## Continuous Integration

### CI Test Pipeline
```yaml
# Example CI configuration
test:
  script:
    - npm install
    - npm run lint:check
    - npm run test:ci
  artifacts:
    reports:
      coverage: tests/coverage/lcov.info
      junit: tests/reports/junit.xml
```

### Quality Gates
- All tests must pass
- Coverage thresholds must be met
- No high-priority security issues
- Performance benchmarks within limits

## Troubleshooting

### Common Issues

1. **Test Timeouts**
   - Increase timeout for slow operations
   - Check for hanging promises
   - Verify mock cleanup

2. **Memory Issues**
   - Force garbage collection in tests
   - Clear mock data between tests
   - Monitor memory usage in performance tests

3. **Flaky Tests**
   - Identify timing dependencies
   - Improve test isolation
   - Use deterministic test data

4. **Coverage Issues**
   - Verify all code paths are tested
   - Check for unreachable code
   - Add tests for error conditions

### Debug Commands
```bash
# Run tests with debugging
node --inspect-brk tests/run-tests.js --unit

# Run specific test file
npx jest tests/handlers/validation.test.js --verbose

# Check test coverage
npx jest --coverage --coverageReporters=text
```

## Maintenance

### Regular Tasks
- Update test dependencies monthly
- Review and update performance thresholds quarterly
- Add tests for new features immediately
- Security test updates with threat landscape changes

### Test Health Monitoring
- Track test execution times
- Monitor flaky test patterns
- Review coverage trends
- Update test infrastructure as needed

## Contributing

### Adding New Tests
1. Follow existing patterns and conventions
2. Include appropriate test categories
3. Update documentation if needed
4. Ensure all tests pass before submitting

### Test Review Checklist
- [ ] Tests follow naming conventions
- [ ] Appropriate test coverage
- [ ] Mocks are used correctly
- [ ] Performance considerations included
- [ ] Security implications tested
- [ ] Documentation updated

## Resources

- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing Best Practices](https://github.com/goldbergyoni/javascript-testing-best-practices)
- [Security Testing Guide](https://owasp.org/www-project-web-security-testing-guide/)
- [Performance Testing Patterns](https://martinfowler.com/articles/practical-test-pyramid.html)