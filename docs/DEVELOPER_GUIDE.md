# Developer Guide

## Table of Contents

1. [Development Environment Setup](#development-environment-setup)
2. [Project Structure](#project-structure)
3. [Contributing Guidelines](#contributing-guidelines)
4. [Adding New Features](#adding-new-features)
5. [Testing Strategy](#testing-strategy)
6. [Code Quality Standards](#code-quality-standards)
7. [Debugging and Monitoring](#debugging-and-monitoring)
8. [Release Process](#release-process)

## Development Environment Setup

### Prerequisites

Before you start developing, ensure you have:

- **Node.js 18+** (LTS recommended)
- **Git** for version control
- **VS Code** or preferred IDE
- **Docker** (optional, for container development)

### Clone and Setup

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-vibe-coding-kg
cd mcp-vibe-coding-kg

# Install dependencies
npm install

# Install development tools globally
npm install -g nodemon jest eslint prettier

# Setup environment
cp .env.example .env
```

### IDE Configuration

#### VS Code Settings

Create `.vscode/settings.json`:

```json
{
  "editor.formatOnSave": true,
  "editor.defaultFormatter": "esbenp.prettier-vscode",
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true,
    "source.organizeImports": true
  },
  "javascript.preferences.importModuleSpecifier": "relative",
  "typescript.preferences.importModuleSpecifier": "relative",
  "files.exclude": {
    "node_modules/": true,
    ".kg-context/": true,
    "logs/": true
  },
  "search.exclude": {
    "node_modules/": true,
    ".kg-context/": true,
    "logs/": true
  }
}
```

#### Recommended Extensions

```json
{
  "recommendations": [
    "esbenp.prettier-vscode",
    "ms-vscode.vscode-eslint",
    "bradlc.vscode-tailwindcss",
    "ms-vscode.vscode-json",
    "ms-vscode.vscode-typescript-next",
    "streetsidesoftware.code-spell-checker",
    "gruntfuggly.todo-tree",
    "ms-vscode.vscode-docker"
  ]
}
```

### Development Scripts

```bash
# Start development server with auto-reload
npm run dev

# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:performance

# Lint and format code
npm run lint
npm run format

# Check code quality
npm run lint:check
npm run format:check

# Build project
npm run build

# Health check
npm run health

# Clean up
npm run clean
```

### Environment Configuration

Create `.env` file:

```env
# Development Configuration
NODE_ENV=development

# Database
KUZU_DB_PATH=.kg-context/knowledge-graph.kuzu

# Logging
LOG_LEVEL=debug
LOG_ENABLED=true
LOG_FORMAT=combined

# Validation
VALIDATION_ENABLED=true
VALIDATION_STRICT_MODE=false

# Optimization
OPTIMIZATION_CACHE_ENABLED=false
OPTIMIZATION_MEMORY_ENABLED=false

# Testing
TEST_TIMEOUT=30000
TEST_PARALLEL=true
```

---

## Project Structure

### Overview

```
mcp-vibe-coding-kg/
├── src/                    # Source code
│   ├── handlers/          # MCP tool handlers
│   ├── analyzers/         # Code analysis engines
│   ├── database/          # Database layer
│   ├── validation/        # Validation system
│   ├── optimization/      # Performance optimization
│   ├── utils/             # Shared utilities
│   └── server.js          # Main server
├── tests/                 # Test suites
├── docs/                  # Documentation
├── config/                # Configuration files
├── scripts/               # Build and deployment scripts
└── tools/                 # Development tools
```

### Core Modules

#### Handlers (`src/handlers/`)

Tool handlers implement MCP protocol functionality:

```javascript
// Handler structure
export class HandlerName {
  constructor(server) {
    this.server = server;
    this.kuzu = server.kuzu;
    this.config = server.config;
  }

  async toolMethod(args) {
    // Implementation
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }
      ]
    };
  }
}
```

#### Analyzers (`src/analyzers/`)

Code analysis engines process different file types:

```javascript
// Analyzer structure
export class AnalyzerName {
  constructor(config = {}) {
    this.config = { ...defaultConfig, ...config };
  }

  async analyzeFile(filePath) {
    // Implementation
    return {
      entities: [],
      patterns: [],
      metrics: {},
      issues: []
    };
  }
}
```

#### Database Layer (`src/database/`)

Kuzu database integration with advanced features:

- **KuzuClient**: Core database connection and queries
- **CypherQuerySystem**: Advanced query system with optimization
- **QueryOptimizer**: Query performance optimization
- **BatchOperations**: Bulk data operations
- **TransactionManager**: ACID transactions

### File Naming Conventions

- **PascalCase**: Class files (`CodeAnalyzer.js`, `ValidationSystem.js`)
- **camelCase**: Function files (`queryBuilder.js`, `configLoader.js`)
- **kebab-case**: Script files (`init-kg.js`, `setup-wizard.js`)
- **UPPERCASE**: Constants files (`CONSTANTS.js`, `SCHEMAS.js`)

---

## Contributing Guidelines

### Git Workflow

1. **Fork the Repository**
   ```bash
   git clone https://github.com/yourusername/mcp-vibe-coding-kg
   cd mcp-vibe-coding-kg
   git remote add upstream https://github.com/original/mcp-vibe-coding-kg
   ```

2. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Make Changes**
   - Follow coding standards
   - Write tests
   - Update documentation

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   ```

5. **Push and Create PR**
   ```bash
   git push origin feature/your-feature-name
   # Create pull request via GitHub
   ```

### Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

Types:
- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation changes
- **style**: Code style changes
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Adding tests
- **chore**: Maintenance tasks

Examples:
```bash
feat(handlers): add Arduino timing analysis tool
fix(database): resolve connection pool exhaustion
docs(api): update tool documentation with examples
perf(cache): optimize query result caching
```

### Pull Request Guidelines

1. **Before Creating PR**
   - Ensure all tests pass
   - Run linting and formatting
   - Update documentation
   - Add/update tests for new functionality

2. **PR Description**
   - Clear title describing the change
   - Detailed description of what was changed
   - Link to related issues
   - Screenshots for UI changes
   - Breaking changes documentation

3. **Review Process**
   - Address review feedback
   - Keep PR focused and small
   - Rebase on main branch before merge

---

## Adding New Features

### 1. Adding a New MCP Tool

#### Step 1: Define Tool Schema

Add to `src/server.js` in the tools array:

```javascript
{
  name: 'your_new_tool',
  description: 'Description of what your tool does',
  inputSchema: {
    type: 'object',
    properties: {
      param1: { type: 'string' },
      param2: { type: 'integer', default: 10 }
    },
    required: ['param1']
  }
}
```

#### Step 2: Create Handler Method

Add method to appropriate handler or create new handler:

```javascript
// In src/handlers/yourHandler.js
export class YourHandler {
  async yourNewTool(args) {
    try {
      // Validate input
      this.validateInput(args);
      
      // Process request
      const result = await this.processRequest(args);
      
      // Return formatted response
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Tool execution failed:', error);
      throw error;
    }
  }

  validateInput(args) {
    // Input validation logic
  }

  async processRequest(args) {
    // Main processing logic
  }
}
```

#### Step 3: Register Tool Handler

Add to tool routing in `src/server.js`:

```javascript
case 'your_new_tool':
  result = await this.handlers.yourHandler.yourNewTool(args);
  break;
```

#### Step 4: Add Tests

Create test file `tests/handlers/yourHandler.test.js`:

```javascript
import { describe, test, expect, beforeEach } from '@jest/globals';
import { YourHandler } from '../../src/handlers/yourHandler.js';

describe('YourHandler', () => {
  let handler;

  beforeEach(() => {
    handler = new YourHandler(mockServer);
  });

  test('should process valid input', async () => {
    const args = { param1: 'test' };
    const result = await handler.yourNewTool(args);
    
    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');
  });

  test('should handle invalid input', async () => {
    const args = {};
    
    await expect(handler.yourNewTool(args))
      .rejects.toThrow('param1 is required');
  });
});
```

### 2. Adding a New Analyzer

#### Step 1: Create Analyzer Class

```javascript
// In src/analyzers/yourAnalyzer.js
export class YourAnalyzer {
  constructor(config = {}) {
    this.config = {
      maxFileSize: 1048576,
      enableMetrics: true,
      ...config
    };
  }

  async analyzeFile(filePath) {
    try {
      const content = await this.readFile(filePath);
      const analysis = await this.analyze(content, filePath);
      return this.formatResults(analysis);
    } catch (error) {
      logger.error('Analysis failed:', error);
      throw error;
    }
  }

  async analyze(content, filePath) {
    // Analysis implementation
    return {
      entities: this.extractEntities(content),
      patterns: this.detectPatterns(content),
      metrics: this.calculateMetrics(content),
      issues: this.findIssues(content)
    };
  }

  extractEntities(content) {
    // Entity extraction logic
  }

  detectPatterns(content) {
    // Pattern detection logic
  }

  calculateMetrics(content) {
    // Metrics calculation logic
  }

  findIssues(content) {
    // Issue detection logic
  }
}
```

#### Step 2: Register Analyzer

Add to `CodeAnalyzer` in `src/analyzers/codeAnalyzer.js`:

```javascript
import { YourAnalyzer } from './yourAnalyzer.js';

export class CodeAnalyzer {
  constructor(config) {
    // ... existing code
    this.yourAnalyzer = new YourAnalyzer(config.yourAnalyzer);
  }

  async analyzeCode(code, filePath, language) {
    switch (language) {
      case 'your_language':
        return await this.yourAnalyzer.analyzeFile(filePath);
      // ... existing cases
    }
  }
}
```

### 3. Adding Database Entities

#### Step 1: Define Node/Relationship Schema

Add to `src/database/kuzuClient.js`:

```javascript
// In createNodeTables method
{
  name: 'YourEntity',
  schema: `
    CREATE NODE TABLE IF NOT EXISTS YourEntity(
      id STRING,
      name STRING,
      type STRING,
      properties STRING,
      timestamp INT64,
      PRIMARY KEY (id)
    )
  `
}

// In createRelationshipTables method
{
  name: 'YOUR_RELATIONSHIP',
  schema: `
    CREATE REL TABLE IF NOT EXISTS YOUR_RELATIONSHIP(
      FROM YourEntity TO CodeEntity,
      strength DOUBLE,
      metadata STRING
    )
  `
}
```

#### Step 2: Add Helper Methods

```javascript
// In KuzuClient class
async createYourEntity(properties) {
  const entityData = {
    id: this.generateEntityId('your_entity'),
    timestamp: Date.now(),
    ...properties
  };

  return await this.createNode('YourEntity', entityData);
}

async linkYourEntity(entityId, targetId, relationship = 'YOUR_RELATIONSHIP') {
  return await this.createRelationship(
    entityId, 
    relationship, 
    targetId, 
    { strength: 1.0 }
  );
}
```

### 4. Adding Validation Rules

#### Step 1: Define Validation Schema

```javascript
// In src/validation/schemas/yourSchema.js
export const yourToolSchema = {
  type: 'object',
  properties: {
    param1: {
      type: 'string',
      minLength: 1,
      maxLength: 1000
    },
    param2: {
      type: 'integer',
      minimum: 0,
      maximum: 100
    }
  },
  required: ['param1'],
  additionalProperties: false
};
```

#### Step 2: Register Schema

Add to validation middleware configuration:

```javascript
// In src/server.js setupValidation method
const toolSchemas = {
  'your_new_tool': yourToolSchema,
  // ... existing schemas
};
```

---

## Testing Strategy

### Test Organization

```
tests/
├── unit/                  # Unit tests
│   ├── handlers/
│   ├── analyzers/
│   ├── database/
│   └── utils/
├── integration/           # Integration tests
│   ├── mcp-workflow.test.js
│   └── database-integration.test.js
├── performance/           # Performance tests
│   └── optimization.test.js
├── security/              # Security tests
│   └── validation.test.js
├── e2e/                   # End-to-end tests
│   └── full-workflow.test.js
├── mocks/                 # Test mocks
│   └── mockKuzuClient.js
├── fixtures/              # Test data
│   └── sample-code/
└── helpers/               # Test utilities
    └── testHelpers.js
```

### Writing Tests

#### Unit Test Example

```javascript
import { describe, test, expect, beforeEach, afterEach } from '@jest/globals';
import { CodeAnalyzer } from '../../src/analyzers/codeAnalyzer.js';

describe('CodeAnalyzer', () => {
  let analyzer;

  beforeEach(() => {
    analyzer = new CodeAnalyzer({
      maxComplexity: 10,
      maxFunctionLength: 50
    });
  });

  test('should analyze JavaScript function complexity', async () => {
    const code = `
      function complexFunction(a, b, c) {
        if (a > 0) {
          if (b > 0) {
            if (c > 0) {
              return a + b + c;
            }
          }
        }
        return 0;
      }
    `;

    const result = await analyzer.analyzeJavaScript(code, 'test.js');
    
    expect(result.entities).toHaveLength(1);
    expect(result.entities[0].type).toBe('function');
    expect(result.entities[0].name).toBe('complexFunction');
    expect(result.metrics.complexity).toBeGreaterThan(1);
  });

  test('should detect high complexity issues', async () => {
    const code = 'function highComplexity() { /* very complex code */ }';
    const result = await analyzer.analyzeJavaScript(code, 'test.js');
    
    const complexityIssues = result.issues.filter(
      issue => issue.type === 'complexity'
    );
    expect(complexityIssues.length).toBeGreaterThan(0);
  });
});
```

#### Integration Test Example

```javascript
import { describe, test, expect, beforeAll, afterAll } from '@jest/globals';
import { MCPServer } from '../../src/server.js';
import { setupTestEnvironment, cleanupTestEnvironment } from '../helpers/testHelpers.js';

describe('MCP Workflow Integration', () => {
  let server;

  beforeAll(async () => {
    await setupTestEnvironment();
    server = new MCPServer({ config: 'test' });
    await server.start();
  });

  afterAll(async () => {
    await server.stop();
    await cleanupTestEnvironment();
  });

  test('should complete full analysis workflow', async () => {
    // Test complete workflow from file analysis to pattern detection
    const codebasePath = '/path/to/test/codebase';
    
    // 1. Analyze codebase
    const analysisResult = await server.handlers.initialization
      .analyzeCodebase({ codebasePath });
    
    expect(analysisResult.content[0].text).toContain('filesAnalyzed');
    
    // 2. Query patterns
    const contextResult = await server.handlers.context
      .queryContextForTask({ taskDescription: 'test task' });
    
    expect(contextResult.content[0].text).toContain('patterns');
    
    // 3. Validate implementation
    const validationResult = await server.handlers.validation
      .validateAgainstKG({ codeSnippet: 'function test() {}' });
    
    expect(validationResult.content[0].text).toContain('validation');
  });
});
```

### Performance Testing

```javascript
import { describe, test, expect } from '@jest/globals';
import { performance } from 'perf_hooks';

describe('Performance Tests', () => {
  test('query execution should be under 100ms', async () => {
    const start = performance.now();
    
    const result = await kuzu.query('MATCH (n:CodeEntity) RETURN count(n)');
    
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(100);
    expect(result).toBeDefined();
  });

  test('large codebase analysis should complete within timeout', async () => {
    const start = performance.now();
    
    const result = await analyzer.analyzeLargeCodebase('/path/to/large/codebase');
    
    const duration = performance.now() - start;
    expect(duration).toBeLessThan(30000); // 30 seconds
    expect(result.entities.length).toBeGreaterThan(100);
  }, 35000);
});
```

### Test Configuration

```javascript
// jest.config.js
export default {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/**/*.test.js'
  ],
  coverageThreshold: {
    global: {
      branches: 80,
      functions: 80,
      lines: 80,
      statements: 80
    }
  },
  setupFilesAfterEnv: ['<rootDir>/tests/setup.js'],
  globalSetup: '<rootDir>/tests/globalSetup.js',
  globalTeardown: '<rootDir>/tests/globalTeardown.js',
  testTimeout: 30000
};
```

---

## Code Quality Standards

### ESLint Configuration

```javascript
// .eslintrc.js
export default {
  env: {
    node: true,
    es2022: true,
    jest: true
  },
  extends: [
    'eslint:recommended',
    'prettier'
  ],
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module'
  },
  rules: {
    'no-console': 'warn',
    'no-debugger': 'error',
    'no-unused-vars': 'error',
    'prefer-const': 'error',
    'no-var': 'error',
    'eqeqeq': 'error',
    'curly': 'error',
    'complexity': ['warn', 10],
    'max-len': ['warn', { code: 100 }],
    'max-params': ['warn', 5],
    'max-depth': ['warn', 4]
  }
};
```

### Prettier Configuration

```javascript
// .prettierrc.js
export default {
  semi: true,
  trailingComma: 'es5',
  singleQuote: true,
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  bracketSpacing: true,
  arrowParens: 'avoid',
  endOfLine: 'lf'
};
```

### Documentation Standards

#### Function Documentation

```javascript
/**
 * Analyzes code complexity and detects patterns
 * 
 * @param {string} code - Source code to analyze
 * @param {string} filePath - Path to the source file
 * @param {Object} options - Analysis options
 * @param {boolean} options.includeMetrics - Include complexity metrics
 * @param {number} options.maxComplexity - Maximum allowed complexity
 * @returns {Promise<Object>} Analysis results with entities, patterns, and metrics
 * @throws {Error} When code analysis fails
 * 
 * @example
 * const result = await analyzer.analyzeCode(
 *   'function test() { return 42; }',
 *   'test.js',
 *   { includeMetrics: true }
 * );
 */
async analyzeCode(code, filePath, options = {}) {
  // Implementation
}
```

#### Vibe Coding Comments

```javascript
/**
 * CONTEXT: Multi-language code analysis with pattern detection
 * REASON: Support diverse development environments and languages
 * CHANGE: Unified analyzer interface with language-specific implementations
 * PREVENTION: Inconsistent analysis results and missing language features
 */
export class CodeAnalyzer {
  // Implementation
}
```

### Code Review Checklist

- [ ] **Functionality**: Code works as intended
- [ ] **Performance**: No obvious performance issues
- [ ] **Security**: No security vulnerabilities
- [ ] **Maintainability**: Code is readable and maintainable
- [ ] **Tests**: Adequate test coverage
- [ ] **Documentation**: Code is properly documented
- [ ] **Error Handling**: Proper error handling
- [ ] **Logging**: Appropriate logging
- [ ] **Configuration**: Configurable where appropriate
- [ ] **Backwards Compatibility**: No breaking changes

---

## Debugging and Monitoring

### Logging Best Practices

```javascript
import { logger } from '../utils/logger.js';

// Structured logging with context
logger.info('Processing analysis request', {
  filePath,
  fileSize: stats.size,
  language,
  requestId: req.id
});

// Error logging with stack traces
logger.error('Analysis failed', {
  error: error.message,
  stack: error.stack,
  filePath,
  context: { /* relevant context */ }
});

// Performance logging
const start = Date.now();
// ... operation
logger.debug('Operation completed', {
  operation: 'codeAnalysis',
  duration: Date.now() - start,
  success: true
});
```

### Debug Configuration

```bash
# Enable debug logging
DEBUG=mcp:* npm run dev

# Debug specific modules
DEBUG=mcp:server,mcp:database npm run dev

# Debug with verbose output
LOG_LEVEL=trace npm run dev
```

### Performance Monitoring

```javascript
// Built-in performance monitoring
const performanceMonitor = new PerformanceMonitor({
  enableMetrics: true,
  alertThresholds: {
    responseTime: 2000,
    memoryUsage: 80,
    errorRate: 5
  }
});

// Custom metrics
performanceMonitor.recordMetric('tool.execution.time', duration);
performanceMonitor.recordMetric('database.query.count', queryCount);
```

### Health Checks

```javascript
// Health check endpoint
app.get('/health', async (req, res) => {
  const health = await server.getServerHealth();
  res.status(health.status === 'healthy' ? 200 : 503).json(health);
});

// Monitoring integration
const healthCheck = {
  database: await kuzu.getHealthMetrics(),
  memory: process.memoryUsage(),
  uptime: process.uptime(),
  version: process.version
};
```

---

## Release Process

### Version Management

Follow [Semantic Versioning](https://semver.org/):

- **MAJOR**: Breaking changes
- **MINOR**: New features (backwards compatible)
- **PATCH**: Bug fixes (backwards compatible)

### Release Checklist

1. **Pre-Release**
   - [ ] All tests pass
   - [ ] Code coverage meets threshold
   - [ ] Documentation updated
   - [ ] Changelog updated
   - [ ] Version bumped

2. **Release**
   ```bash
   # Update version
   npm version patch|minor|major
   
   # Build and test
   npm run build
   npm test
   
   # Create release
   git tag v1.0.0
   git push origin main --tags
   
   # Publish to npm
   npm publish
   ```

3. **Post-Release**
   - [ ] GitHub release created
   - [ ] Documentation deployed
   - [ ] Monitoring alerts configured
   - [ ] Team notified

### Automated Release

```yaml
# .github/workflows/release.yml
name: Release
on:
  push:
    tags:
      - 'v*'

jobs:
  release:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-node@v2
        with:
          node-version: '18'
      - run: npm ci
      - run: npm test
      - run: npm run build
      - run: npm publish
        env:
          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}
```

### Changelog Format

```markdown
# Changelog

## [1.2.0] - 2024-01-15

### Added
- New Arduino timing analysis tool
- Support for ESP32 board configurations
- Advanced query optimization features

### Changed
- Improved error messages in validation system
- Updated dependencies to latest versions

### Fixed
- Memory leak in code analysis cache
- Database connection pool exhaustion

### Deprecated
- Legacy pattern detection methods (will be removed in v2.0)

### Security
- Fixed potential code injection vulnerability in query processor
```

## Best Practices Summary

### Code Organization
- Keep functions small and focused
- Use consistent naming conventions
- Organize imports logically
- Minimize dependencies between modules

### Error Handling
- Use structured error objects
- Provide meaningful error messages
- Log errors with context
- Implement graceful degradation

### Performance
- Profile before optimizing
- Use caching strategically
- Minimize database queries
- Implement proper connection pooling

### Security
- Validate all inputs
- Sanitize user data
- Use parameterized queries
- Implement proper authentication

### Testing
- Write tests first (TDD)
- Maintain high test coverage
- Use meaningful test names
- Test edge cases and error conditions

### Documentation
- Keep documentation up to date
- Include examples in API docs
- Document architectural decisions
- Maintain clear README files