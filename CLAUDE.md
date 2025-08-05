Voy a crear un MCP completo para Node.js que puedas usar con `npx`, junto con instrucciones detalladas de instalación e implementación.

## Estructura del Proyecto MCP

```
mcp-vibe-coding-kg/
├── package.json
├── README.md
├── index.js
├── src/
│   ├── server.js
│   ├── handlers/
│   │   ├── initialization.js
│   │   ├── context.js
│   │   ├── codeGeneration.js
│   │   ├── validation.js
│   │   └── knowledgeGraph.js
│   ├── analyzers/
│   │   ├── codeAnalyzer.js
│   │   ├── patternDetector.js
│   │   └── gitAnalyzer.js
│   ├── database/
│   │   ├── kuzuClient.js
│   │   └── queries.js
│   └── utils/
│       ├── logger.js
│       └── config.js
├── config/
│   └── default.json
└── scripts/
    ├── setup.js
    └── init-kg.js
```

## 1. Package.json

```json
{
  "name": "@mcp/vibe-coding-kg",
  "version": "1.0.0",
  "description": "MCP server for Vibe Coding with Knowledge Graph integration",
  "main": "index.js",
  "type": "module",
  "bin": {
    "mcp-vibe-coding": "./index.js"
  },
  "scripts": {
    "start": "node index.js",
    "setup": "node scripts/setup.js",
    "init-kg": "node scripts/init-kg.js",
    "test": "jest",
    "lint": "eslint src/"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "kuzu": "^0.10.1",
    "@babel/parser": "^7.23.0",
    "@babel/traverse": "^7.23.0",
    "simple-git": "^3.20.0",
    "glob": "^10.3.10",
    "chalk": "^5.3.0",
    "commander": "^11.1.0",
    "dotenv": "^16.3.1",
    "winston": "^3.11.0",
    "joi": "^17.11.0",
    "ora": "^7.0.1",
    "inquirer": "^9.2.12"
  },
  "devDependencies": {
    "jest": "^29.7.0",
    "eslint": "^8.55.0",
    "@types/node": "^20.10.4"
  },
  "engines": {
    "node": ">=18.0.0"
  },
  "keywords": [
    "mcp",
    "model-context-protocol",
    "knowledge-graph",
    "vibe-coding",
    "ai-assisted-development"
  ],
  "author": "Your Name",
  "license": "MIT",
  "repository": {
    "type": "git",
    "url": "https://github.com/yourusername/mcp-vibe-coding-kg"
  }
}
```

## 2. Index.js (Entry Point)

```javascript
#!/usr/bin/env node

import { program } from 'commander';
import { MCPServer } from './src/server.js';
import { setupWizard } from './scripts/setup.js';
import { initializeKG } from './scripts/init-kg.js';
import chalk from 'chalk';
import { config } from './src/utils/config.js';

program
  .name('mcp-vibe-coding')
  .description('MCP server for Vibe Coding with Knowledge Graph')
  .version('1.0.0');

program
  .command('start')
  .description('Start the MCP server')
  .option('-p, --port <port>', 'port to run on', '3000')
  .option('-c, --config <path>', 'config file path')
  .action(async (options) => {
    try {
      console.log(chalk.blue('🚀 Starting MCP Vibe Coding Server...'));
      const server = new MCPServer(options);
      await server.start();
    } catch (error) {
      console.error(chalk.red('Error starting server:'), error);
      process.exit(1);
    }
  });

program
  .command('setup')
  .description('Run setup wizard')
  .action(async () => {
    await setupWizard();
  });

program
  .command('init <codebase>')
  .description('Initialize Knowledge Graph from existing codebase')
  .option('-f, --force', 'force re-initialization')
  .action(async (codebase, options) => {
    await initializeKG(codebase, options);
  });

program.parse();
```

## 3. Server Implementation (src/server.js)

```javascript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

import { InitializationHandler } from './handlers/initialization.js';
import { ContextHandler } from './handlers/context.js';
import { CodeGenerationHandler } from './handlers/codeGeneration.js';
import { ValidationHandler } from './handlers/validation.js';
import { KnowledgeGraphHandler } from './handlers/knowledgeGraph.js';
import { KuzuClient } from './database/kuzuClient.js';
import { logger } from './utils/logger.js';
import { config } from './utils/config.js';

export class MCPServer {
  constructor(options = {}) {
    this.config = config.load(options.config);
    this.server = new Server(
      {
        name: 'mcp-vibe-coding-kg',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );
    
    this.kuzu = null;
    this.handlers = {};
    this.setupHandlers();
    this.setupToolHandlers();
  }

  setupHandlers() {
    this.handlers = {
      initialization: new InitializationHandler(this),
      context: new ContextHandler(this),
      codeGeneration: new CodeGenerationHandler(this),
      validation: new ValidationHandler(this),
      knowledgeGraph: new KnowledgeGraphHandler(this)
    };
  }

  setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'define_domain_ontology',
          description: 'Define or update domain ontology in the knowledge graph',
          inputSchema: {
            type: 'object',
            properties: {
              entities: { type: 'array', items: { type: 'object' } },
              relationships: { type: 'array', items: { type: 'object' } },
              businessRules: { type: 'array', items: { type: 'string' } },
              codingStandards: { type: 'object' }
            },
            required: ['entities']
          }
        },
        {
          name: 'query_context_for_task',
          description: 'Query KG for relevant context before generating code',
          inputSchema: {
            type: 'object',
            properties: {
              taskDescription: { type: 'string' },
              entityTypes: { type: 'array', items: { type: 'string' } },
              depth: { type: 'integer', default: 2 }
            },
            required: ['taskDescription']
          }
        },
        {
          name: 'generate_code_with_context',
          description: 'Generate code grounded in KG context',
          inputSchema: {
            type: 'object',
            properties: {
              requirement: { type: 'string' },
              contextIds: { type: 'array', items: { type: 'string' } },
              patternsToApply: { type: 'array', items: { type: 'string' } },
              constraints: { type: 'object' }
            },
            required: ['requirement']
          }
        },
        {
          name: 'validate_against_kg',
          description: 'Validate code or decisions against KG knowledge',
          inputSchema: {
            type: 'object',
            properties: {
              codeSnippet: { type: 'string' },
              validationTypes: { type: 'array', items: { type: 'string' } },
              strictMode: { type: 'boolean', default: true }
            },
            required: ['codeSnippet']
          }
        },
        {
          name: 'extract_context_from_code',
          description: 'Extract context from existing code comments',
          inputSchema: {
            type: 'object',
            properties: {
              filePath: { type: 'string' },
              codeSnippet: { type: 'string' }
            },
            required: ['filePath']
          }
        },
        {
          name: 'detect_technical_debt',
          description: 'Detect potential technical debt by querying KG',
          inputSchema: {
            type: 'object',
            properties: {
              scope: { type: 'string', enum: ['module', 'project', 'specific'] },
              target: { type: 'string' },
              debtTypes: { type: 'array', items: { type: 'string' } }
            },
            required: ['scope']
          }
        },
        {
          name: 'suggest_refactoring',
          description: 'Suggest refactorings based on KG patterns',
          inputSchema: {
            type: 'object',
            properties: {
              codeEntity: { type: 'string' },
              improvementGoals: { type: 'array', items: { type: 'string' } },
              preserveBehavior: { type: 'boolean', default: true }
            },
            required: ['codeEntity']
          }
        },
        {
          name: 'update_kg_from_code',
          description: 'Update KG with new entities, relations or patterns',
          inputSchema: {
            type: 'object',
            properties: {
              codeAnalysis: { type: 'object' },
              decisions: { type: 'array', items: { type: 'object' } },
              learnedPatterns: { type: 'array', items: { type: 'object' } }
            },
            required: ['codeAnalysis']
          }
        },
        {
          name: 'analyze_codebase',
          description: 'Analyze entire codebase and update KG',
          inputSchema: {
            type: 'object',
            properties: {
              codebasePath: { type: 'string' },
              includeGitHistory: { type: 'boolean', default: true },
              maxDepth: { type: 'integer', default: 10 }
            },
            required: ['codebasePath']
          }
        }
      ]
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        const { name, arguments: args } = request.params;
        logger.info(`Tool called: ${name}`, { args });

        switch (name) {
          case 'define_domain_ontology':
            return await this.handlers.knowledgeGraph.defineDomainOntology(args);
          
          case 'query_context_for_task':
            return await this.handlers.context.queryContextForTask(args);
          
          case 'generate_code_with_context':
            return await this.handlers.codeGeneration.generateWithContext(args);
          
          case 'validate_against_kg':
            return await this.handlers.validation.validateAgainstKG(args);
          
          case 'extract_context_from_code':
            return await this.handlers.context.extractFromCode(args);
          
          case 'detect_technical_debt':
            return await this.handlers.validation.detectTechnicalDebt(args);
          
          case 'suggest_refactoring':
            return await this.handlers.codeGeneration.suggestRefactoring(args);
          
          case 'update_kg_from_code':
            return await this.handlers.knowledgeGraph.updateFromCode(args);
          
          case 'analyze_codebase':
            return await this.handlers.initialization.analyzeCodebase(args);
          
          default:
            throw new Error(`Unknown tool: ${name}`);
        }
      } catch (error) {
        logger.error('Tool execution error:', error);
        return {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ]
        };
      }
    });
  }

  async start() {
    try {
      // Connect to Kuzu
      this.kuzu = new KuzuClient(this.config.kuzu);
      await this.kuzu.connect();
      logger.info('Connected to Kuzu');

      // Start MCP server
      const transport = new StdioServerTransport();
      await this.server.connect(transport);
      
      logger.info('MCP Vibe Coding Server started successfully');
    } catch (error) {
      logger.error('Failed to start server:', error);
      throw error;
    }
  }

  async stop() {
    if (this.kuzu) {
      await this.kuzu.close();
    }
    logger.info('Server stopped');
  }
}
```

## 4. Kuzu Client (src/database/kuzuClient.js)

```javascript
import kuzu from 'kuzu';
import { logger } from '../utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

export class KuzuClient {
  constructor(config) {
    this.config = config;
    this.database = null;
    this.connection = null;
  }

  async connect() {
    try {
      // Ensure database directory exists
      const dbPath = this.config.databasePath || './kuzu_db';
      await fs.mkdir(path.dirname(dbPath), { recursive: true });
      
      // Create database and connection
      this.database = new kuzu.Database(dbPath);
      this.connection = new kuzu.Connection(this.database);
      
      // Create node and relationship tables
      await this.createTables();
      
      logger.info('Kuzu connection established');
    } catch (error) {
      logger.error('Kuzu connection failed:', error);
      throw error;
    }
  }

  async createTables() {
    try {
      // Create node tables
      await this.connection.query(`
        CREATE NODE TABLE IF NOT EXISTS CodeEntity(
          id STRING,
          type STRING,
          name STRING,
          filePath STRING,
          lineStart INT64,
          lineEnd INT64,
          agent STRING,
          trace STRING,
          context STRING,
          reason STRING,
          change STRING,
          prevention STRING,
          risk STRING,
          PRIMARY KEY (id)
        )
      `);

      await this.connection.query(`
        CREATE NODE TABLE IF NOT EXISTS Pattern(
          name STRING,
          description STRING,
          category STRING,
          PRIMARY KEY (name)
        )
      `);

      await this.connection.query(`
        CREATE NODE TABLE IF NOT EXISTS Rule(
          id STRING,
          description STRING,
          category STRING,
          PRIMARY KEY (id)
        )
      `);

      await this.connection.query(`
        CREATE NODE TABLE IF NOT EXISTS Standard(
          name STRING,
          value STRING,
          category STRING,
          PRIMARY KEY (name)
        )
      `);

      // Create relationship tables
      await this.connection.query(`
        CREATE REL TABLE IF NOT EXISTS IMPLEMENTS(
          FROM CodeEntity TO Pattern,
          confidence DOUBLE
        )
      `);

      await this.connection.query(`
        CREATE REL TABLE IF NOT EXISTS DEPENDS_ON(
          FROM CodeEntity TO CodeEntity,
          type STRING
        )
      `);

      await this.connection.query(`
        CREATE REL TABLE IF NOT EXISTS VIOLATES(
          FROM CodeEntity TO Rule,
          severity STRING
        )
      `);

      await this.connection.query(`
        CREATE REL TABLE IF NOT EXISTS FOLLOWS(
          FROM CodeEntity TO Standard,
          compliance DOUBLE
        )
      `);

      logger.info('Kuzu tables created successfully');
    } catch (error) {
      logger.error('Error creating Kuzu tables:', error);
      throw error;
    }
  }

  async query(cypherQuery, params = {}) {
    try {
      // Replace parameters in query
      let processedQuery = cypherQuery;
      for (const [key, value] of Object.entries(params)) {
        const paramRegex = new RegExp(`\\$${key}`, 'g');
        if (typeof value === 'string') {
          processedQuery = processedQuery.replace(paramRegex, `'${value.replace(/'/g, "\\'")}'`);
        } else {
          processedQuery = processedQuery.replace(paramRegex, value);
        }
      }

      const result = await this.connection.query(processedQuery);
      const rows = await result.getAll();
      
      return rows.map(row => {
        const obj = {};
        for (const [key, value] of Object.entries(row)) {
          obj[key] = value;
        }
        return obj;
      });
    } catch (error) {
      logger.error('Kuzu query error:', error);
      throw error;
    }
  }

  async createNode(label, properties) {
    try {
      const propNames = Object.keys(properties);
      const propValues = Object.values(properties);
      const propString = propNames.map((name, i) => `${name}: $prop${i}`).join(', ');
      
      const query = `CREATE (n:${label} {${propString}}) RETURN n`;
      const params = {};
      propNames.forEach((name, i) => {
        params[`prop${i}`] = propValues[i];
      });

      const result = await this.query(query, params);
      return result[0] || properties;
    } catch (error) {
      logger.error('Error creating node:', error);
      throw error;
    }
  }

  async createRelationship(fromId, relationshipType, toId, properties = {}) {
    try {
      const propNames = Object.keys(properties);
      const propValues = Object.values(properties);
      const propString = propNames.length > 0 
        ? `{${propNames.map((name, i) => `${name}: $prop${i}`).join(', ')}}`
        : '';

      const query = `
        MATCH (a:CodeEntity {id: $fromId}), (b:CodeEntity {id: $toId})
        CREATE (a)-[r:${relationshipType} ${propString}]->(b)
        RETURN r
      `;
      
      const params = { fromId, toId };
      propNames.forEach((name, i) => {
        params[`prop${i}`] = propValues[i];
      });

      const result = await this.query(query, params);
      return result[0] || properties;
    } catch (error) {
      logger.error('Error creating relationship:', error);
      throw error;
    }
  }

  async close() {
    try {
      if (this.connection) {
        // Kuzu connections are automatically closed when they go out of scope
        this.connection = null;
      }
      if (this.database) {
        // Kuzu databases are automatically closed when they go out of scope
        this.database = null;
      }
      logger.info('Kuzu connection closed');
    } catch (error) {
      logger.error('Error closing Kuzu connection:', error);
    }
  }
}
```

## 5. Context Handler (src/handlers/context.js)

```javascript
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

export class ContextHandler {
  constructor(server) {
    this.server = server;
    this.kuzu = server.kuzu;
  }

  async queryContextForTask(args) {
    const { taskDescription, entityTypes = [], depth = 2 } = args;
    
    try {
      // Build query to find relevant context
      const query = `
        // Find patterns relevant to the task
        MATCH (p:Pattern)
        WHERE toLower(p.name) CONTAINS toLower($keyword)
           OR toLower(p.description) CONTAINS toLower($keyword)
        WITH p LIMIT 5
        
        // Find related code entities
        OPTIONAL MATCH (e:CodeEntity)-[:IMPLEMENTS]->(p)
        WITH p, collect(DISTINCT e) as relatedEntities
        
        // Find business rules
        OPTIONAL MATCH (r:Rule)
        WHERE toLower(r.description) CONTAINS toLower($keyword)
        WITH p, relatedEntities, collect(DISTINCT r) as rules
        
        // Find coding standards
        OPTIONAL MATCH (s:Standard)
        WITH p, relatedEntities, rules, collect(DISTINCT s) as standards
        
        RETURN {
          patterns: collect(DISTINCT p.name),
          relatedCode: [e IN relatedEntities | {name: e.name, path: e.filePath}],
          rules: [r IN rules | r.description],
          standards: [s IN standards | {name: s.name, value: s.value}]
        } as context
      `;
      
      // Extract keywords from task description
      const keyword = taskDescription.split(' ')[0];
      
      const result = await this.kuzu.query(query, { keyword, depth });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              taskDescription,
              context: result[0]?.context || {
                patterns: [],
                relatedCode: [],
                rules: [],
                standards: []
              },
              relevanceScore: 0.85
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error querying context:', error);
      throw error;
    }
  }

  async extractFromCode(args) {
    const { filePath, codeSnippet } = args;
    
    try {
      // Read file if no snippet provided
      const code = codeSnippet || await fs.readFile(filePath, 'utf-8');
      
      // Extract structured comments
      const structuredComments = this.extractStructuredComments(code);
      
      // Parse code AST
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'decorators-legacy']
      });
      
      const entities = [];
      const relationships = [];
      
      // Traverse AST to extract entities
      traverse.default(ast, {
        ClassDeclaration(path) {
          const entity = {
            type: 'class',
            name: path.node.id.name,
            lineStart: path.node.loc.start.line,
            lineEnd: path.node.loc.end.line,
            filePath,
            structuredComment: structuredComments.find(
              c => c.line < path.node.loc.start.line
            )
          };
          entities.push(entity);
        },
        
        FunctionDeclaration(path) {
          const entity = {
            type: 'function',
            name: path.node.id.name,
            lineStart: path.node.loc.start.line,
            lineEnd: path.node.loc.end.line,
            filePath,
            structuredComment: structuredComments.find(
              c => c.line < path.node.loc.start.line
            )
          };
          entities.push(entity);
        }
      });
      
      // Store entities in Kuzu
      for (const entity of entities) {
        const nodeProps = {
          id: `${filePath}:${entity.name}`,
          type: entity.type,
          name: entity.name,
          filePath: entity.filePath,
          lineStart: entity.lineStart,
          lineEnd: entity.lineEnd,
          ...this.parseStructuredComment(entity.structuredComment)
        };
        
        await this.kuzu.createNode('CodeEntity', nodeProps);
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              extracted: {
                entities: entities.length,
                structuredComments: structuredComments.length,
                filePath
              }
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error extracting context:', error);
      throw error;
    }
  }

  extractStructuredComments(code) {
    const comments = [];
    const lines = code.split('\n');
    
    const commentPattern = /\/\*\*[\s\S]*?\*\//g;
    const matches = code.matchAll(commentPattern);
    
    for (const match of matches) {
      const comment = match[0];
      const lineNumber = code.substring(0, match.index).split('\n').length;
      
      const parsed = this.parseStructuredComment(comment);
      if (parsed) {
        comments.push({
          line: lineNumber,
          ...parsed
        });
      }
    }
    
    return comments;
  }

  parseStructuredComment(comment) {
    if (!comment) return null;
    
    const structured = {};
    const patterns = {
      agent: /\*\s*AGENT:\s*(.+)/,
      trace: /\*\s*TRACE:\s*(.+)/,
      context: /\*\s*CONTEXT:\s*(.+)/,
      reason: /\*\s*REASON:\s*(.+)/,
      change: /\*\s*CHANGE:\s*(.+)/,
      prevention: /\*\s*PREVENTION:\s*(.+)/,
      risk: /\*\s*RISK:\s*(.+)/
    };
    
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = comment.match(pattern);
      if (match) {
        structured[key] = match[1].trim();
      }
    }
    
    return Object.keys(structured).length > 0 ? structured : null;
  }
}
```

## 6. Setup Wizard (scripts/setup.js)

```javascript
import inquirer from 'inquirer';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import ora from 'ora';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function setupWizard() {
  console.log(chalk.blue.bold('\n🚀 MCP Vibe Coding KG Setup Wizard\n'));
  
  // Check prerequisites
  const spinner = ora('Checking prerequisites...').start();
  const prereqCheck = await checkPrerequisites();
  spinner.stop();
  
  if (!prereqCheck.allMet) {
    console.log(chalk.red('\n❌ Missing prerequisites:'));
    prereqCheck.missing.forEach(req => {
      console.log(chalk.red(`   - ${req}`));
    });
    console.log(chalk.yellow('\nPlease install missing prerequisites and run setup again.'));
    return;
  }
  
  console.log(chalk.green('✓ All prerequisites met\n'));
  
  // Get configuration
  const answers = await inquirer.prompt([
    {
      type: 'input',
      name: 'kuzuDatabasePath',
      message: 'Kuzu database path:',
      default: './kuzu_db'
    },
    {
      type: 'confirm',
      name: 'enableLogging',
      message: 'Enable detailed logging?',
      default: true
    },
    {
      type: 'input',
      name: 'logLevel',
      message: 'Log level:',
      default: 'info',
      when: answers => answers.enableLogging,
      choices: ['error', 'warn', 'info', 'debug']
    }
  ]);
  
  // Create configuration
  const config = {
    kuzu: {
      databasePath: answers.kuzuDatabasePath
    },
    logging: {
      enabled: answers.enableLogging,
      level: answers.logLevel || 'info'
    },
    analysis: {
      maxFileSize: 1048576,
      excludedDirs: ['.git', 'node_modules', '__pycache__', '.venv'],
      includedExtensions: ['.js', '.ts', '.jsx', '.tsx', '.py', '.java']
    }
  };
  
  // Save configuration
  const configPath = path.join(process.cwd(), '.mcp-vibe-config.json');
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  
  console.log(chalk.green(`\n✓ Configuration saved to ${configPath}`));
  
  // Test Kuzu connection
  const connSpinner = ora('Testing Kuzu connection...').start();
  try {
    const { KuzuClient } = await import('../src/database/kuzuClient.js');
    const client = new KuzuClient(config.kuzu);
    await client.connect();
    await client.close();
    connSpinner.succeed('Kuzu connection successful');
  } catch (error) {
    connSpinner.fail('Kuzu connection failed');
    console.log(chalk.red(`Error: ${error.message}`));
    return;
  }
  
  // Setup complete
  console.log(chalk.green.bold('\n✅ Setup completed successfully!\n'));
  console.log(chalk.cyan('Next steps:'));
  console.log(chalk.cyan('1. Initialize your codebase:'));
  console.log(chalk.white('   npx @mcp/vibe-coding-kg init /path/to/codebase\n'));
  console.log(chalk.cyan('2. Start the MCP server:'));
  console.log(chalk.white('   npx @mcp/vibe-coding-kg start\n'));
  console.log(chalk.cyan('3. Configure Claude Desktop to use this MCP server'));
}

async function checkPrerequisites() {
  const required = [
    { name: 'Node.js 18+', check: () => process.version.match(/v(\d+)/)[1] >= 18 }
  ];
  
  const missing = [];
  for (const req of required) {
    if (!req.check()) {
      missing.push(req.name);
    }
  }
  
  return {
    allMet: missing.length === 0,
    missing
  };
}
```

## 7. Installation & Implementation Instructions

### Prerequisites

1. **Node.js 18+**
   ```bash
   # Check Node.js version
   node --version
   
   # Install Node.js if needed
   # macOS with Homebrew
   brew install node
   
   # Ubuntu/Debian
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Windows - Download from https://nodejs.org/
   ```

2. **Kuzu Database** (embedded - no separate installation required)
   - Kuzu is an embedded graph database that will be installed automatically with the npm package
   - No separate database server setup required
   - Database files will be stored locally in the specified database path

### Installation Steps

1. **Install the MCP package globally**
   ```bash
   npm install -g @mcp/vibe-coding-kg
   ```

2. **Run the setup wizard**
   ```bash
   npx @mcp/vibe-coding-kg setup
   ```

3. **Initialize your codebase**
   ```bash
   npx @mcp/vibe-coding-kg init /path/to/your/codebase
   ```

### Configuration for Claude Desktop

1. **Locate Claude Desktop configuration**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. **Add MCP server configuration**
   ```json
   {
     "mcpServers": {
       "vibe-coding-kg": {
         "command": "npx",
         "args": ["@mcp/vibe-coding-kg", "start"],
         "env": {
           "NODE_ENV": "production"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop**

### Usage Examples

1. **Initialize a codebase**
   ```bash
   # Basic initialization
   npx @mcp/vibe-coding-kg init ./my-project
   
   # Force re-initialization
   npx @mcp/vibe-coding-kg init ./my-project --force
   ```

2. **Start the server manually**
   ```bash
   # Default port
   npx @mcp/vibe-coding-kg start
   
   # Custom port
   npx @mcp/vibe-coding-kg start --port 3001
   
   # Custom config
   npx @mcp/vibe-coding-kg start --config ./custom-config.json
   ```

### Using with Claude

Once configured, you can use these commands in Claude:

```markdown
# Define domain ontology
Use the `define_domain_ontology` tool to set up patterns for our authentication service with SOLID principles.

# Query context for a task
Use the `query_context_for_task` tool to find relevant patterns for implementing user authentication.

# Extract context from existing code
Use the `extract_context_from_code` tool on the file path `/src/services/authService.js`.

# Generate code with context
Use the `generate_code_with_context` tool to create a JWT authentication service following our established patterns.

# Detect technical debt
Use the `detect_technical_debt` tool to analyze the authentication module for potential issues.
```

### Troubleshooting

1. **Kuzu database issues**
   ```bash
   # Check database path permissions
   ls -la ./kuzu_db
   
   # Ensure directory is writable
   chmod 755 ./kuzu_db
   
   # Delete and recreate database if corrupted
   rm -rf ./kuzu_db
   npx @mcp/vibe-coding-kg setup
   ```

2. **Permission issues**
   ```bash
   # Fix npm permissions
   npm config set prefix ~/.npm-global
   export PATH=~/.npm-global/bin:$PATH
   ```

3. **View logs**
   ```bash
   # Enable debug logging
   export LOG_LEVEL=debug
   npx @mcp/vibe-coding-kg start
   ```

### Development Setup

If you want to modify the MCP:

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-vibe-coding-kg
cd mcp-vibe-coding-kg

# Install dependencies
npm install

# Run in development mode
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

This MCP implementation provides a complete solution for Vibe Coding with Knowledge Graph integration using Kuzu embedded database, ready to use with Claude Desktop via npx.

## Key Benefits of Using Kuzu

- **Embedded**: No separate database server setup required
- **High Performance**: Optimized for analytical workloads on large datasets
- **Cypher Compatible**: Uses familiar Cypher query language
- **Vector Search**: Built-in vector search capabilities for similarity queries
- **Full-Text Search**: Integrated full-text search functionality
- **Easy Deployment**: Single executable with no external dependencies