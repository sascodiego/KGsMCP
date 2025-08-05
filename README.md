# MCP Vibe Coding Knowledge Graph

A comprehensive Model Context Protocol (MCP) server that integrates Vibe Coding methodology with Knowledge Graph technology for AI-assisted software development using Kuzu embedded database.

## 🚀 Features

### 🧠 **Knowledge Graph Intelligence**
- **Kuzu Graph Database**: High-performance embedded graph database with Cypher queries
- **Intelligent Caching**: Multi-layer caching system with automatic optimization
- **Pattern Detection**: Advanced design pattern recognition across multiple languages
- **Technical Debt Analysis**: Comprehensive debt detection and remediation tracking
- **Context-Aware Generation**: Code generation based on existing patterns and standards

### 🔍 **Multi-Language Code Analysis**
- **JavaScript/TypeScript**: Full AST analysis with framework detection
- **C++/Arduino**: Specialized embedded development support
- **Go, Rust, Python, Java**: Comprehensive language support
- **Git Integration**: Repository history analysis and collaboration metrics
- **Performance Analysis**: Memory usage, timing constraints, and optimization

### 🛡️ **Enterprise Security & Performance**
- **Input Validation**: Multi-layer security with injection prevention
- **Performance Monitoring**: Real-time metrics and optimization
- **Backup & Recovery**: Automated backup system with compression
- **Health Monitoring**: Comprehensive system health and alerting
- **Scalable Architecture**: Designed for enterprise-grade deployment

### 🔧 **Arduino/Embedded Development**
- **Hardware Validation**: Pin conflict detection and board compatibility
- **Memory Optimization**: RAM, Flash, and EEPROM usage analysis
- **Interrupt Safety**: ISR-safe code generation and validation
- **Timing Analysis**: Real-time constraint validation
- **Board Support**: Arduino Uno, Mega, Nano, ESP32

## 📋 Prerequisites

- **Node.js 18+**
- **Kuzu Database** (embedded - automatically installed)

## 🔧 Quick Start

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/mcp-vibe-coding-kg
cd mcp-vibe-coding-kg

# Install dependencies
npm install

# Run setup wizard
npm run setup
```

### 2. Initialize Your Codebase

```bash
# Analyze your codebase and build knowledge graph
npm run init /path/to/your/codebase

# Advanced options
npm run init /path/to/codebase --force --depth 15 --parallel 8
```

### 3. Configure Claude Desktop

**Configuration file locations:**
- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

**Add MCP server configuration:**

```json
{
  "mcpServers": {
    "vibe-coding-kg": {
      "command": "node",
      "args": ["index.js", "start"],
      "cwd": "/path/to/mcp-vibe-coding-kg",
      "env": {
        "NODE_ENV": "production"
      }
    }
  }
}
```

### 4. Start Using

```bash
# Start the MCP server
npm start

# Check system health
npm run health

# Create backup
npm run backup my-backup.tar.gz
```

## 🎯 Available MCP Tools

### 📊 **Knowledge Graph Management**
- `define_domain_ontology` - Define business entities, rules, and coding standards
- `get_kg_statistics` - Comprehensive knowledge graph statistics and health
- `update_kg_from_code` - Update graph with new patterns and decisions

### 🔍 **Code Analysis & Context**
- `analyze_codebase` - Comprehensive codebase analysis with Git integration
- `query_context_for_task` - Find relevant patterns for development tasks
- `extract_context_from_code` - Extract structured information from comments
- `detect_technical_debt` - Multi-dimensional technical debt analysis

### 🛠️ **Code Generation & Validation**
- `generate_code_with_context` - Context-aware code generation with templates
- `suggest_refactoring` - Intelligent refactoring recommendations
- `validate_against_kg` - Multi-layer code validation against patterns and rules

### 🔧 **Arduino/C++ Development**
- `analyze_arduino_sketch` - Complete Arduino project analysis
- `validate_hardware_config` - Pin conflicts and board compatibility
- `optimize_for_arduino` - Memory and performance optimization
- `generate_interrupt_safe_code` - ISR-safe code patterns
- `analyze_timing_constraints` - Real-time timing analysis

### ⚡ **Performance & Optimization**
- `get_optimization_report` - Comprehensive performance analysis
- `force_optimization` - Trigger immediate system optimization

## 🏗️ System Architecture

```
KGsMCP/
├── src/
│   ├── handlers/              # MCP tool implementations
│   │   ├── validation.js      # Multi-layer validation system
│   │   ├── codeGeneration.js  # Template-based code generation
│   │   ├── context.js         # Context extraction and querying
│   │   ├── knowledgeGraph.js  # Graph management operations
│   │   ├── initialization.js  # Codebase analysis engine
│   │   └── arduinoHandler.js  # Arduino/C++ specialized tools
│   ├── analyzers/             # Code analysis engines
│   │   ├── codeAnalyzer.js    # Multi-language AST analysis
│   │   ├── gitAnalyzer.js     # Git history and collaboration
│   │   └── patternDetector.js # Design pattern recognition
│   ├── database/              # Kuzu database integration
│   │   ├── kuzuClient.js      # Enhanced database client
│   │   ├── cypherQueryBuilder.js # Fluent query builder
│   │   ├── queryOptimizer.js  # Performance optimization
│   │   └── transactionManager.js # ACID transactions
│   ├── validation/            # Security and validation
│   │   ├── MCPInputValidator.js # Schema-based validation
│   │   ├── ValidationMiddleware.js # Consistent validation
│   │   └── AdvancedValidators.js # Security threat detection
│   ├── optimization/          # Performance systems
│   │   ├── PerformanceMonitor.js # Real-time monitoring
│   │   ├── MemoryOptimizer.js # Memory management
│   │   └── CacheManager.js    # Multi-layer caching
│   └── utils/                 # Shared utilities
│       ├── backupManager.js   # Backup and recovery
│       ├── config.js          # Configuration management
│       └── logger.js          # Structured logging
├── tests/                     # Comprehensive test suite
│   ├── unit/                  # Unit tests
│   ├── integration/           # Integration tests
│   ├── performance/           # Performance tests
│   └── security/              # Security tests
├── docs/                      # Complete documentation
│   ├── API_REFERENCE.md       # API documentation
│   ├── ARCHITECTURE.md        # System architecture
│   ├── USER_GUIDE.md          # User manual
│   └── DEVELOPER_GUIDE.md     # Development guide
└── config/                    # Configuration files
    └── default.json           # Default settings
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test categories
npm run test:unit
npm run test:integration
npm run test:performance
npm run test:security

# Run with coverage
npm run test:coverage

# Continuous testing
npm run test:watch
```

## 📊 Database Schema

### Node Types
- **CodeEntity**: Classes, functions, variables with complexity metrics
- **Pattern**: Design patterns (Singleton, Factory, Observer, etc.)
- **Rule**: Business rules and coding standards
- **Standard**: Naming conventions and formatting rules
- **TechnicalDebt**: Identified debt with severity and remediation
- **HardwareComponent**: Arduino pins, sensors, actuators
- **TimingConstraint**: Real-time timing requirements

### Relationship Types
- **IMPLEMENTS**: Code implements design pattern
- **VIOLATES**: Code violates rule or standard
- **DEPENDS_ON**: Dependency relationships
- **COUPLED_WITH**: Code coupling analysis
- **USES_HARDWARE**: Hardware component usage
- **HANDLES**: Interrupt handling relationships

## 🚀 Usage Examples

### Define Domain Architecture

```markdown
Use the `define_domain_ontology` tool to establish your system architecture:

Entities:
- UserService (authentication, authorization)
- ProductCatalog (inventory, pricing)
- OrderProcessor (workflow, payments)

Relationships:
- UserService AUTHENTICATES OrderProcessor
- ProductCatalog PROVIDES OrderProcessor

Business Rules:
- "All API endpoints must have authentication"
- "Database connections must use connection pooling"
- "Error responses must include correlation IDs"

Coding Standards:
- Use TypeScript for type safety
- Follow SOLID principles
- Maximum function complexity: 10
```

### Analyze Arduino Project

```markdown
Use the `analyze_arduino_sketch` tool for embedded analysis:

Sketch path: "./arduino/sensor_hub/sensor_hub.ino"
Target board: "mega2560"
Include libraries: true

Returns comprehensive analysis:
- Memory usage: RAM 1.2KB/8KB, Flash 15KB/256KB
- Pin conflicts: None detected
- Interrupt usage: 2/6 available
- Timing violations: Loop takes 45ms (target: <50ms)
- Optimization suggestions: Use PROGMEM for strings
```

### Generate Context-Aware Code

```markdown
Use the `generate_code_with_context` tool:

Requirement: "Create API endpoint for user registration"
Patterns to apply: ["repository", "validation", "error-handling"]
Constraints: {"language": "typescript", "framework": "express"}

Generates:
- Repository pattern implementation
- Input validation with Joi schemas
- Structured error handling
- Comprehensive logging
- Unit test templates
```

## 🔧 Development

### Environment Setup

```bash
# Install development dependencies
npm install

# Copy environment template
cp .env.example .env

# Edit configuration
nano .env
```

### Development Commands

```bash
# Start in development mode with hot reload
npm run dev

# Run linting
npm run lint

# Fix linting issues
npm run lint:fix

# Type checking
npm run typecheck

# Build for production
npm run build
```

### Environment Variables

```env
# Database configuration
KUZU_DB_PATH=.kg-context/knowledge-graph.kuzu
KUZU_MAX_RETRIES=3
KUZU_QUERY_TIMEOUT=30000

# Logging configuration
LOG_LEVEL=info
LOG_ENABLED=true
LOG_MAX_FILES=10

# Performance configuration
ENABLE_CACHING=true
CACHE_TIMEOUT=300000
MAX_CACHE_SIZE=100

# Security configuration
ENABLE_RATE_LIMIT=true
MAX_REQUESTS_PER_MINUTE=100
```

## 🛠️ CLI Commands

```bash
# Server management
node index.js start [--config path] [--debug] [--verify]
node index.js health [--config path]

# Setup and initialization
node index.js setup [--force]
node index.js init <codebase> [--force] [--depth N] [--parallel N]

# Backup and recovery
node index.js backup <output> [--description text] [--validate]
node index.js restore <backup> [--force] [--incremental]
node index.js clean [--force] [--backup] [--temp-only]
```

## 🐛 Troubleshooting

### Common Issues

**Database Connection Issues:**
```bash
# Check database directory
ls -la .kg-context/

# Verify permissions
chmod 755 .kg-context/

# Restart with debug logging
LOG_LEVEL=debug node index.js start
```

**Memory Issues:**
```bash
# Check memory usage
node index.js health

# Clean temporary files
node index.js clean --temp-only

# Force optimization
npm run optimize
```

**Performance Issues:**
```bash
# Get optimization report
# Use get_optimization_report tool in Claude

# Check cache statistics
# Use get_kg_statistics tool with includeDetails: true

# Force cache refresh
node index.js clean --temp-only
```

### Debug Mode

```bash
# Enable comprehensive debugging
export LOG_LEVEL=debug
export NODE_ENV=development
node index.js start --debug
```

## 📈 Performance

- **Response Time**: <100ms for simple queries, <5s for complex analysis
- **Memory Usage**: ~50MB baseline, scales with codebase size
- **Cache Hit Rate**: >90% for repeated operations
- **Concurrent Requests**: Supports 100+ simultaneous tool calls
- **Database Size**: ~1MB per 10K lines of analyzed code

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Make changes with proper Vibe Coding comments
4. Add comprehensive tests
5. Commit: `git commit -m 'Add amazing feature'`
6. Push: `git push origin feature/amazing-feature`
7. Open Pull Request

### Code Standards

- Follow Vibe Coding methodology with structured comments
- Include AGENT, CONTEXT, REASON, CHANGE, PREVENTION metadata
- Maintain >90% test coverage
- Use TypeScript for type safety
- Follow SOLID principles

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- **Model Context Protocol**: Foundation for AI-tool integration
- **Kuzu Database**: High-performance embedded graph database
- **Babel Parser**: JavaScript/TypeScript AST analysis
- **Jest**: Comprehensive testing framework
- **Joi**: Schema validation and sanitization

---

**🎯 Ready for production • 🚀 Enterprise-grade • 🧠 AI-powered • 🔧 Developer-friendly**

Built with ❤️ for the AI-assisted development community