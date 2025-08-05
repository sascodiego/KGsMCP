# MCP Vibe Coding with Knowledge Graph

A comprehensive Model Context Protocol (MCP) server that integrates Vibe Coding methodology with Knowledge Graph technology for AI-assisted software development.

## 🚀 Features

- **Knowledge Graph Integration**: Store and query code context, patterns, and decisions
- **Vibe Coding Support**: Track reasoning traces and prevent anti-patterns  
- **Pattern Detection**: Automatically identify design patterns in codebases
- **Technical Debt Analysis**: Detect and track technical debt using graph queries
- **Context-Aware Code Generation**: Generate code based on existing patterns and standards
- **Git History Analysis**: Extract insights from repository evolution
- **Multi-Language Support**: JavaScript, TypeScript, Python, Java, C++, Arduino, and more
- **Arduino/C++ Analysis**: Specialized analysis for embedded development with hardware validation
- **Hardware Configuration Validation**: Pin conflicts, interrupt limits, and board compatibility checking
- **Memory Optimization**: RAM, Flash, and EEPROM usage analysis with optimization suggestions
- **Real-time Constraints**: Timing analysis for interrupt service routines and real-time operations

## 📋 Prerequisites

- **Node.js 18+**
- **Kuzu Database** (embedded graph database - automatically created)

## 🔧 Installation

### 1. Install Globally

```bash
npm install -g @mcp/vibe-coding-kg
```

### 2. Run Setup Wizard

```bash
npx @mcp/vibe-coding-kg setup
```

The setup wizard will:
- Check prerequisites  
- Configure Kuzu database path
- Set logging preferences
- Test the database connection
- **Automatically create database schema**
- **Initialize with coding rules and standards**

### 3. Initialize Your Codebase

```bash
npx @mcp/vibe-coding-kg init /path/to/your/codebase
```

This analyzes your codebase and populates the knowledge graph with:
- Code entities (classes, functions, variables) with complexity metrics
- Design patterns (Singleton, Factory, Observer, etc.)
- File relationships and dependencies
- Git history insights
- **Comprehensive analysis reports**
- **Actionable recommendations**

#### Advanced Options:
```bash
# Force reinitialize (clears existing data)
npx @mcp/vibe-coding-kg init /path/to/codebase --force

# Add to existing knowledge graph
npx @mcp/vibe-coding-kg init /path/to/codebase
# Choose "Add to existing" when prompted
```

## ⚙️ Configuration for Claude Desktop

### 1. Locate Configuration File

- **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
- **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`
- **Linux**: `~/.config/Claude/claude_desktop_config.json`

### 2. Add MCP Server

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

### 3. Restart Claude Desktop

## 🎯 Available Tools

### Domain Ontology
- `define_domain_ontology`: Define business entities, rules, and coding standards

### Context Querying  
- `query_context_for_task`: Find relevant patterns and context for development tasks
- `extract_context_from_code`: Extract structured information from code comments

### Code Generation
- `generate_code_with_context`: Generate code following established patterns
- `suggest_refactoring`: Get refactoring suggestions based on detected patterns

### Validation & Analysis
- `validate_against_kg`: Validate code against stored patterns and rules
- `detect_technical_debt`: Identify technical debt using graph analysis
- `update_kg_from_code`: Update knowledge graph with new learning
- `analyze_codebase`: Perform comprehensive codebase analysis

### Database Management
- `get_kg_statistics`: Get comprehensive statistics and health status of the Knowledge Graph

### Arduino/C++ Development
- `analyze_arduino_sketch`: Comprehensive analysis of Arduino sketches and C++ projects
- `validate_hardware_config`: Validate pin assignments, interrupt usage, and board compatibility
- `optimize_for_arduino`: Memory and performance optimization suggestions for embedded systems
- `generate_interrupt_safe_code`: Generate interrupt-safe code patterns and shared data structures
- `analyze_timing_constraints`: Real-time timing analysis and constraint validation

## 🚀 Automatic Database Generation

The MCP automatically creates and manages your Kuzu database:

### ✅ What's Created Automatically:

1. **Database Schema**:
   - Node constraints (unique IDs)
   - Performance indexes
   - Full-text search indexes

2. **Initial Data**:
   - 10+ coding rules (complexity, naming, memory efficiency, etc.)
   - Clean code standards and SOLID principles
   - Arduino-specific rules (ISR optimization, volatile variables, non-blocking patterns)
   - C++ resource management guidelines

3. **During Codebase Analysis**:
   - Code entities with metadata
   - Design pattern instances
   - File relationships
   - Complexity metrics

### 🔄 Zero Configuration Required:

```bash
# This is all you need!
npx @mcp/vibe-coding-kg setup      # Creates schema + rules
npx @mcp/vibe-coding-kg init ./code # Populates with your code
```

### 📊 Verify Your Database:

```markdown
# In Claude Desktop:
Use the `get_kg_statistics` tool with includeDetails: true to see comprehensive database statistics.
```

## 📚 Usage Examples

### 1. Define Domain Patterns

```markdown
Use the `define_domain_ontology` tool to establish patterns for our e-commerce platform:

Entities:
- Product (with attributes: id, name, price, category)
- Order (with attributes: id, customerId, items, total)
- Customer (with attributes: id, email, preferences)

Relationships:
- Customer PLACES Order
- Order CONTAINS Product

Business Rules:
- "Orders must have at least one item"
- "Product prices must be positive"
- "Customer email must be unique"

Coding Standards:
- Use camelCase for variables
- Prefix interfaces with 'I'
- Maximum function length: 50 lines
```

### 2. Query Context for Development

```markdown
Use the `query_context_for_task` tool to find relevant context for:
"Implement user authentication with JWT tokens"

This will return:
- Existing authentication patterns
- Related security standards  
- Similar implementations in the codebase
- Applicable business rules
```

### 3. Generate Context-Aware Code

```markdown
Use the `generate_code_with_context` tool with:

Requirement: "Create a user registration service"
Patterns to apply: ["repository", "validation", "error-handling"]
Constraints: {"language": "typescript", "testing": "jest"}

This generates code following established patterns and includes:
- Repository pattern implementation
- Input validation logic
- Comprehensive error handling
- Jest test templates
```

### 4. Validate Code Quality

```markdown
Use the `validate_against_kg` tool to check if this code follows our standards:

```typescript
class UserService {
  constructor(private repository: UserRepository) {}
  
  async createUser(userData: CreateUserDto): Promise<User> {
    // implementation
  }
}
```

Validation types: ["patterns", "rules", "standards"]
Strict mode: true
```

## 🔍 Technical Debt Detection

```markdown
Use the `detect_technical_debt` tool to analyze:

Scope: "module" 
Target: "src/services/auth"
Debt types: ["complexity", "duplication", "coupling"]

Returns analysis of:
- High complexity functions
- Duplicated code blocks
- Tight coupling issues
- Recommendations for improvement
```

## 🔧 Arduino/C++ Development Examples

### 1. Analyze Arduino Sketch

```markdown
Use the `analyze_arduino_sketch` tool to analyze an Arduino project:

Sketch path: "/path/to/sketch/led_controller.ino"
Target board: "uno"
Include libraries: true

Returns comprehensive analysis including:
- Memory usage estimation (RAM, Flash, EEPROM)
- Hardware pin usage and conflicts
- Interrupt service routine analysis
- Timing constraint violations
- Optimization recommendations
- Board compatibility warnings
```

### 2. Validate Hardware Configuration

```markdown
Use the `validate_hardware_config` tool to check pin assignments:

Board: "mega2560"
Components:
- Pin 2: ["digitalRead", "interrupt"]
- Pin 13: ["digitalWrite", "LED"]
- Pin A0: ["analogRead", "sensor"]

Returns validation including:
- Pin conflict detection
- PWM capability checks
- Interrupt pin validation
- I2C/SPI/Serial pin conflicts
- Alternative pin suggestions
```

### 3. Generate Interrupt-Safe Code

```markdown
Use the `generate_interrupt_safe_code` tool to create safe patterns:

Functionality: "sensor_reading"
Interrupt type: "external"
Shared variables: ["sensorData", "dataReady"]

Generates:
- Volatile variable declarations
- ISR implementation with minimal code
- Critical section handling
- Safe data copying patterns
- Timing optimization tips
```

### 4. Memory Optimization Analysis

```markdown
Use the `optimize_for_arduino` tool for memory efficiency:

Memory usage: 
- RAM: 1800 bytes
- Flash: 28000 bytes
Target board: "uno"
Complexity: 45

Returns optimization strategies:
- PROGMEM usage for string literals
- Data type optimization suggestions
- Code simplification recommendations
- Memory-efficient programming patterns
```

## 🛠️ Development Setup

### Clone and Install

```bash
git clone https://github.com/yourusername/mcp-vibe-coding-kg
cd mcp-vibe-coding-kg
npm install
```

### Development Commands

```bash
# Start in development mode
npm run dev

# Run tests
npm test

# Lint code  
npm run lint

# Build for production
npm run build
```

### Environment Variables

Create a `.env` file:

```env
KUZU_DB_PATH=.kg-context/knowledge-graph.kuzu
LOG_LEVEL=debug
LOG_ENABLED=true
```

## 🏗️ Architecture

```
mcp-vibe-coding-kg/
├── src/
│   ├── handlers/          # MCP tool handlers
│   │   ├── context.js     # Context extraction & querying
│   │   ├── codeGeneration.js  # Code generation logic
│   │   ├── validation.js  # Code validation against KG
│   │   ├── knowledgeGraph.js  # KG management
│   │   ├── initialization.js  # Codebase analysis
│   │   └── arduinoHandler.js  # Arduino/C++ specific tools
│   ├── analyzers/         # Code analysis engines
│   │   ├── codeAnalyzer.js    # Multi-language AST analysis
│   │   ├── cppAnalyzer.js     # C++/Arduino specialized analysis
│   │   ├── patternDetector.js # Design pattern detection
│   │   └── gitAnalyzer.js     # Git history analysis
│   ├── patterns/          # Pattern definitions
│   │   └── arduinoPatterns.js # Arduino-specific patterns
│   ├── database/          # Kuzu integration
│   │   └── kuzuClient.js  # Database client & queries
│   └── utils/             # Utilities
│       ├── logger.js      # Logging configuration
│       └── config.js      # Configuration management
├── scripts/               # Setup & initialization
│   ├── setup.js          # Interactive setup wizard
│   └── init-kg.js        # Codebase initialization
└── config/               # Default configurations
    └── default.json      # Default settings
```

## 🧪 Testing

```bash
# Run all tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test suite
npm test -- --grep "pattern detection"
```

## 📊 Kuzu Graph Schema

### Node Types

- **CodeEntity**: Classes, functions, variables from code
- **Pattern**: Detected design patterns  
- **Rule**: Business rules and constraints
- **Standard**: Coding standards and conventions
- **ArchitecturalDecision**: Recorded design decisions
- **DomainEntity**: Business domain concepts
- **HardwareComponent**: Arduino pins, sensors, actuators
- **Board**: Arduino board specifications and capabilities
- **Library**: Arduino/C++ libraries and dependencies
- **Interrupt**: Interrupt service routines and handlers
- **TimingConstraint**: Real-time timing requirements
- **MemorySegment**: Memory usage analysis for embedded systems

### Relationship Types

- **IMPLEMENTS**: CodeEntity implements Pattern
- **VIOLATES**: CodeEntity violates Rule  
- **DEPENDS_ON**: Dependency relationships
- **AFFECTS**: Decision affects Entity
- **COLOCATED**: Entities in same file
- **USES_HARDWARE**: Sketch uses HardwareComponent
- **USES_PROTOCOL**: Sketch uses communication protocol
- **COMPATIBLE_WITH**: Component compatible with Board
- **HANDLES**: Function handles Interrupt
- **CONSTRAINS**: TimingConstraint applies to CodeEntity
- **ALLOCATES**: CodeEntity allocates MemorySegment

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)  
5. Open Pull Request

## 🐛 Troubleshooting

### Kuzu Database Issues

```bash
# Check if database directory exists
ls -la .kg-context/

# Check database permissions
ls -la .kg-context/knowledge-graph.kuzu

# Clear database and reinitialize
npm run clean && npm run init-kg
```

### Permission Issues

```bash
# Fix npm permissions (Unix/Mac)
npm config set prefix ~/.npm-global
export PATH=~/.npm-global/bin:$PATH

# Or use a Node version manager
nvm use 18
```

### Debug Logging

```bash
# Enable debug mode
export LOG_LEVEL=debug
npx @mcp/vibe-coding-kg start
```

### Claude Desktop Issues

1. Verify MCP server configuration in Claude Desktop settings
2. Check that the npx command is accessible from PATH
3. Restart Claude Desktop after configuration changes
4. Check logs for connection errors

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- [Model Context Protocol](https://github.com/modelcontextprotocol) for the MCP specification
- [Kuzu](https://kuzudb.com/) for embedded graph database technology
- [Babel](https://babeljs.io/) for JavaScript AST parsing
- The Vibe Coding methodology for context-aware development

## 🔗 Links

- [Documentation](https://docs.example.com/mcp-vibe-coding-kg)
- [Issue Tracker](https://github.com/yourusername/mcp-vibe-coding-kg/issues)
- [Discussions](https://github.com/yourusername/mcp-vibe-coding-kg/discussions)
- [Kuzu Documentation](https://kuzudb.com/docs/)
- [MCP Specification](https://spec.modelcontextprotocol.io/)

---

**Made with ❤️ for the AI-assisted development community**