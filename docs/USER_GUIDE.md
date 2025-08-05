# User Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Installation and Setup](#installation-and-setup)
3. [Basic Workflows](#basic-workflows)
4. [Advanced Features](#advanced-features)
5. [Arduino/C++ Development](#arduinoc-development)
6. [Practical Examples](#practical-examples)
7. [Tips and Best Practices](#tips-and-best-practices)
8. [Troubleshooting](#troubleshooting)

## Getting Started

The MCP Vibe Coding Knowledge Graph is an AI-powered development assistant that helps you write better code by learning from your existing codebase and established patterns. It integrates with Claude Desktop to provide context-aware code generation, pattern detection, and technical debt analysis.

### What You Can Do

- **Analyze your codebase** to extract patterns and build a knowledge graph
- **Generate code** that follows your project's established patterns
- **Detect technical debt** and get refactoring suggestions
- **Validate code** against your project's standards and rules
- **Optimize Arduino/C++ code** for embedded systems
- **Track architectural decisions** and their rationale

### How It Works

1. **Knowledge Graph**: Your codebase is analyzed and stored as a graph of entities, patterns, and relationships
2. **Pattern Recognition**: The system learns from your code to identify design patterns and best practices
3. **Context-Aware Generation**: New code is generated based on existing patterns and standards
4. **Continuous Learning**: The system updates its knowledge as your codebase evolves

---

## Installation and Setup

### Prerequisites

Before you begin, ensure you have:

- **Node.js 18 or higher** installed on your system
- **Claude Desktop** application installed
- **Git** (optional, for repository analysis)

### Step 1: Install the MCP Server

Install the MCP server globally using npm:

```bash
npm install -g @mcp/vibe-coding-kg
```

Alternatively, you can use it directly with npx:

```bash
npx @mcp/vibe-coding-kg --help
```

### Step 2: Run the Setup Wizard

The setup wizard will guide you through the initial configuration:

```bash
npx @mcp/vibe-coding-kg setup
```

The wizard will:
1. Check that all prerequisites are installed
2. Help you configure the database path
3. Set up logging preferences
4. Test the database connection
5. Create the initial knowledge graph schema

### Step 3: Configure Claude Desktop

Add the MCP server to your Claude Desktop configuration:

#### On macOS:
Edit `~/Library/Application Support/Claude/claude_desktop_config.json`

#### On Windows:
Edit `%APPDATA%\Claude\claude_desktop_config.json`

#### On Linux:
Edit `~/.config/Claude/claude_desktop_config.json`

Add this configuration:

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

### Step 4: Initialize Your Codebase

Analyze your existing codebase to populate the knowledge graph:

```bash
npx @mcp/vibe-coding-kg init /path/to/your/project
```

This process will:
- Scan all supported files in your project
- Extract code entities (classes, functions, variables)
- Detect design patterns
- Analyze Git history (if available)
- Build relationships between code components

### Step 5: Restart Claude Desktop

Restart Claude Desktop to load the new MCP server configuration.

---

## Basic Workflows

### Workflow 1: Starting a New Feature

When beginning work on a new feature, use the knowledge graph to understand relevant context and patterns.

#### Step 1: Query Context

```markdown
Use the `query_context_for_task` tool to find relevant context for:
"Implement user authentication with OAuth2"
```

This will return:
- Existing authentication patterns in your codebase
- Related security standards and rules
- Similar implementations you can learn from

#### Step 2: Generate Initial Code

```markdown
Use the `generate_code_with_context` tool with:

Requirement: "Create OAuth2 authentication service"
Patterns to apply: ["service-layer", "dependency-injection", "error-handling"]
Constraints: {"language": "typescript", "framework": "express"}
```

The generated code will follow your project's established patterns and include proper error handling, logging, and documentation.

#### Step 3: Validate the Implementation

```markdown
Use the `validate_against_kg` tool to check the generated code against your project standards:

```typescript
// Your generated code here
```

Validation types: ["patterns", "rules", "standards"]
```

### Workflow 2: Refactoring Existing Code

Use the knowledge graph to identify refactoring opportunities and ensure consistency.

#### Step 1: Detect Technical Debt

```markdown
Use the `detect_technical_debt` tool to analyze:

Scope: "module"
Target: "src/services/user"
Debt types: ["complexity", "duplication", "coupling"]
```

#### Step 2: Get Refactoring Suggestions

```markdown
Use the `suggest_refactoring` tool for:

Code entity: "UserService.validateUser method"
Improvement goals: ["reduce complexity", "improve testability"]
```

#### Step 3: Update Knowledge Graph

After implementing changes, update the knowledge graph:

```markdown
Use the `update_kg_from_code` tool with your refactoring results to help the system learn from your improvements.
```

### Workflow 3: Code Review and Quality Assurance

Use the validation tools during code review to ensure consistency and quality.

#### Step 1: Validate New Code

```markdown
Use the `validate_against_kg` tool to check if this pull request follows our standards:

```typescript
// Code from the pull request
```

Validation types: ["patterns", "rules", "standards", "security"]
Strict mode: true
```

#### Step 2: Check for Technical Debt

```markdown
Use the `detect_technical_debt` tool to ensure the changes don't introduce new technical debt:

Scope: "specific"
Target: "src/components/NewComponent.tsx"
```

---

## Advanced Features

### Domain Ontology Management

Define and maintain your project's domain model, business rules, and coding standards.

#### Defining Business Entities

```markdown
Use the `define_domain_ontology` tool to establish our e-commerce domain:

Entities:
- User (type: "aggregate_root", attributes: ["id", "email", "profile", "preferences"])
- Product (type: "entity", attributes: ["id", "name", "price", "category", "inventory"])
- Order (type: "aggregate_root", attributes: ["id", "userId", "items", "total", "status"])
- CartItem (type: "value_object", attributes: ["productId", "quantity", "price"])

Relationships:
- User PLACES Order
- Order CONTAINS CartItem
- CartItem REFERENCES Product

Business Rules:
- "Users must be authenticated to place orders"
- "Product prices must be positive numbers"
- "Orders cannot be modified after confirmation"
- "Cart items must reference valid products"

Coding Standards:
- naming: {"entities": "PascalCase", "fields": "camelCase", "methods": "camelCase"}
- structure: {"maxMethodLength": 20, "maxClassLength": 200}
- testing: {"requireUnitTests": true, "minCoverage": 80}
```

#### Updating Standards Over Time

```markdown
Use the `define_domain_ontology` tool to add new coding standards:

Coding Standards:
- documentation: {"requireJSDoc": true, "requireTypeAnnotations": true}
- error_handling: {"useCustomErrors": true, "logAllErrors": true}
- performance: {"maxDatabaseQueries": 5, "cacheExpensiveOperations": true}
```

### Pattern-Based Code Generation

Generate code that follows specific design patterns from your knowledge graph.

#### Repository Pattern Implementation

```markdown
Use the `generate_code_with_context` tool to create a repository:

Requirement: "Create a UserRepository following our established repository pattern"
Patterns to apply: ["repository", "dependency-injection", "async-await"]
Context IDs: ["pattern:repository", "entity:User"]
Constraints: {"includeTests": true, "useTypeScript": true, "framework": "typeorm"}
```

#### Service Layer Pattern

```markdown
Use the `generate_code_with_context` tool for:

Requirement: "Create OrderService with business logic validation"
Patterns to apply: ["service-layer", "validation", "error-handling", "logging"]
Constraints: {"followDomainRules": true, "includeMetrics": true}
```

### Architectural Decision Tracking

Track and query architectural decisions made in your project.

#### Recording Decisions

```markdown
Use the `update_kg_from_code` tool to record decisions:

Decisions: [
  {
    "decision": "Use Redis for session storage",
    "reason": "Better performance and horizontal scaling",
    "alternatives": ["In-memory sessions", "Database sessions"],
    "consequences": ["Additional infrastructure dependency", "Improved scalability"],
    "date": "2024-01-15",
    "author": "architecture-team"
  }
]
```

#### Querying Past Decisions

```markdown
Use the `query_context_for_task` tool to find decisions about:
"session management and user authentication"
```

### Knowledge Graph Analytics

Monitor and analyze your knowledge graph to understand your codebase evolution.

#### Comprehensive Statistics

```markdown
Use the `get_kg_statistics` tool with:

Include details: true
```

This provides:
- Entity counts by type
- Pattern detection statistics
- Code complexity metrics
- Technical debt trends
- Health assessment and recommendations

#### Entity-Specific Analysis

```markdown
Use the `get_kg_statistics` tool to analyze:

Entity type: "service"
Include details: true
```

---

## Arduino/C++ Development

The system provides specialized support for Arduino and embedded C++ development.

### Arduino Sketch Analysis

#### Comprehensive Sketch Analysis

```markdown
Use the `analyze_arduino_sketch` tool to analyze:

Sketch path: "/path/to/smart_thermostat.ino"
Target board: "uno"
Include libraries: true
```

This provides:
- **Memory Usage**: RAM, Flash, and EEPROM consumption estimates
- **Hardware Analysis**: Pin usage, conflicts, and availability
- **Timing Analysis**: Interrupt handlers and real-time constraints
- **Optimization Suggestions**: Memory and performance improvements
- **Compatibility Warnings**: Board-specific limitations

#### Example Response Interpretation

```json
{
  "memoryUsage": {
    "estimatedRAM": 1234,     // 60% of Arduino Uno's 2KB
    "estimatedFlash": 15678,  // 48% of Arduino Uno's 32KB
    "percentRAM": 60.4,
    "percentFlash": 48.9
  },
  "optimizations": [
    {
      "type": "memory",
      "description": "Use PROGMEM for string constants",
      "savings": "~200 bytes Flash"
    }
  ]
}
```

### Hardware Configuration Validation

#### Pin Assignment Validation

```markdown
Use the `validate_hardware_config` tool to check:

Board: "mega2560"
Components:
- Pin 2: usage ["digitalRead", "interrupt"], type "button"
- Pin 3: usage ["digitalRead", "interrupt"], type "encoder"
- Pin 13: usage ["digitalWrite"], type "status_led"
- Pin A0: usage ["analogRead"], type "temperature_sensor"
- Pin 20: usage ["I2C_SDA"], type "display"
- Pin 21: usage ["I2C_SCL"], type "display"

Connections:
- {"from": "pin2", "to": "emergency_stop", "protocol": "digital_interrupt"}
- {"from": "pin3", "to": "rotary_encoder", "protocol": "digital_interrupt"}
- {"from": "pins20_21", "to": "lcd_display", "protocol": "I2C"}
```

The system will check for:
- Pin conflicts and overlapping usage
- Interrupt pin limitations
- I2C/SPI pin availability
- PWM capabilities
- Power consumption estimates

### Memory Optimization

#### Arduino Memory Analysis

```markdown
Use the `optimize_for_arduino` tool for:

Memory usage: {"ram": 1800, "flash": 28000, "eeprom": 100}
Target board: "uno"
Complexity: 15
Constraints: {"maxRAM": 1500, "maxFlash": 25000, "maxLoopTime": 50}
```

#### Optimization Strategies

The system provides specific recommendations:

1. **PROGMEM Usage**: Move string literals and constant data to program memory
2. **Data Type Optimization**: Use smaller data types where possible
3. **Function Inlining**: Reduce function call overhead for critical paths
4. **Array Optimization**: Use appropriate array sizes and types
5. **Library Alternatives**: Suggest lightweight library alternatives

### Interrupt-Safe Code Generation

#### Creating ISR-Safe Code

```markdown
Use the `generate_interrupt_safe_code` tool for:

Functionality: "encoder_reading"
Interrupt type: "external"
Shared variables: ["encoderPosition", "encoderDirection", "lastEncoderTime"]
```

This generates:
- Proper volatile variable declarations
- Minimal ISR implementations
- Safe data copying patterns
- Critical section handling

#### Example Generated Code

```cpp
/**
 * CONTEXT: Interrupt-safe encoder reading
 * REASON: Prevent data corruption in concurrent access
 * CHANGE: Volatile variables and atomic operations
 * PREVENTION: Race conditions and data inconsistency
 */

// Shared variables (volatile for interrupt safety)
volatile long encoderPosition = 0;
volatile bool encoderDirection = true;
volatile unsigned long lastEncoderTime = 0;

// Interrupt service routine (minimal processing)
void encoderISR() {
  // Read pins and update position atomically
  bool currentA = digitalRead(ENCODER_PIN_A);
  bool currentB = digitalRead(ENCODER_PIN_B);
  
  if (currentA != currentB) {
    encoderPosition++;
    encoderDirection = true;
  } else {
    encoderPosition--;
    encoderDirection = false;
  }
  
  lastEncoderTime = micros();
}

// Safe reading in main loop
long readEncoderPosition() {
  noInterrupts();
  long position = encoderPosition;
  interrupts();
  return position;
}
```

### Real-Time Timing Analysis

#### Timing Constraint Validation

```markdown
Use the `analyze_timing_constraints` tool for:

Code entity: "control_loop"
Constraints: {
  "maxExecutionTime": 1000,    // 1ms maximum
  "maxLoopTime": 10000,        // 10ms loop period
  "realTimeDeadline": 5000     // 5ms hard deadline
}
```

The analysis provides:
- Execution time estimates
- Critical path identification
- Deadline miss predictions
- Optimization recommendations

---

## Practical Examples

### Example 1: Building a REST API

#### Step 1: Define the Domain

```markdown
Use the `define_domain_ontology` tool to establish our API domain:

Entities:
- APIEndpoint (type: "resource", attributes: ["path", "method", "handler", "middleware"])
- RequestModel (type: "value_object", attributes: ["schema", "validation"])
- ResponseModel (type: "value_object", attributes: ["schema", "statusCode"])

Business Rules:
- "All endpoints must have input validation"
- "All responses must include proper HTTP status codes"
- "Authentication required for non-public endpoints"

Coding Standards:
- naming: {"endpoints": "kebab-case", "handlers": "camelCase"}
- structure: {"maxHandlerLength": 30, "separateValidation": true}
- error_handling: {"useStandardErrors": true, "logAllRequests": true}
```

#### Step 2: Generate the User Controller

```markdown
Use the `generate_code_with_context` tool with:

Requirement: "Create a UserController with CRUD operations"
Patterns to apply: ["controller", "validation", "error-handling", "repository"]
Context IDs: ["entity:User", "pattern:rest-api"]
Constraints: {"framework": "express", "includeTests": true, "useTypeScript": true}
```

#### Step 3: Validate the Implementation

```markdown
Use the `validate_against_kg` tool to check the generated controller:

Validation types: ["patterns", "rules", "standards", "security"]
Strict mode: true
```

### Example 2: Refactoring a Legacy Component

#### Step 1: Analyze Current State

```markdown
Use the `detect_technical_debt` tool to analyze:

Scope: "specific"
Target: "src/legacy/UserManager.js"
Debt types: ["complexity", "coupling", "patterns", "testing"]
```

#### Step 2: Get Refactoring Plan

```markdown
Use the `suggest_refactoring` tool for:

Code entity: "UserManager class"
Improvement goals: ["reduce coupling", "improve testability", "modernize patterns"]
Preserve behavior: true
```

#### Step 3: Implement Modern Patterns

```markdown
Use the `generate_code_with_context` tool to create:

Requirement: "Refactor UserManager using modern patterns and dependency injection"
Patterns to apply: ["service-layer", "dependency-injection", "repository", "factory"]
Context IDs: ["entity:User", "decision:modernization"]
```

### Example 3: Arduino IoT Sensor Network

#### Step 1: Hardware Configuration

```markdown
Use the `validate_hardware_config` tool for our sensor node:

Board: "esp32"
Components:
- Pin 2: usage ["digitalRead"], type "motion_sensor"
- Pin 4: usage ["analogRead"], type "temperature_sensor"
- Pin 5: usage ["digitalRead"], type "light_sensor"
- Pin 18: usage ["SPI_CLK"], type "sd_card"
- Pin 19: usage ["SPI_MISO"], type "sd_card"
- Pin 23: usage ["SPI_MOSI"], type "sd_card"
- Pin 21: usage ["I2C_SDA"], type "rtc_module"
- Pin 22: usage ["I2C_SCL"], type "rtc_module"
```

#### Step 2: Optimize for Low Power

```markdown
Use the `optimize_for_arduino` tool for:

Target board: "esp32"
Constraints: {"maxCurrent": 100, "sleepMode": true, "batteryPowered": true}
```

#### Step 3: Generate Sensor Reading Code

```markdown
Use the `generate_code_with_context` tool for:

Requirement: "Create low-power sensor reading with WiFi transmission"
Patterns to apply: ["state-machine", "non-blocking", "power-management"]
Constraints: {"deepSleep": true, "transmissionInterval": 300000}
```

### Example 4: Database Migration and Schema Evolution

#### Step 1: Analyze Current Schema

```markdown
Use the `extract_context_from_code` tool on:
"/src/models/database-schema.sql"
```

#### Step 2: Plan Migration Strategy

```markdown
Use the `query_context_for_task` tool for:
"Database schema migration from v1.0 to v2.0 with user profile enhancements"
```

#### Step 3: Generate Migration Code

```markdown
Use the `generate_code_with_context` tool with:

Requirement: "Create database migration for user profile schema changes"
Patterns to apply: ["migration", "rollback", "data-validation"]
Context IDs: ["entity:User", "entity:Profile", "decision:schema-v2"]
Constraints: {"preserveData": true, "rollbackSupport": true}
```

---

## Tips and Best Practices

### Maximizing Knowledge Graph Value

1. **Start Small**: Begin with a focused module or component
2. **Be Consistent**: Use consistent naming and patterns across your codebase
3. **Document Decisions**: Record architectural decisions and their rationale
4. **Regular Updates**: Keep the knowledge graph updated as your code evolves
5. **Team Standards**: Ensure all team members follow the established patterns

### Writing Effective Queries

1. **Be Specific**: Provide detailed task descriptions for better context matching
2. **Use Context IDs**: Reference specific entities or patterns when known
3. **Set Constraints**: Specify technical constraints and requirements
4. **Iterative Refinement**: Refine queries based on results and feedback

### Code Generation Best Practices

1. **Review Generated Code**: Always review and test generated code
2. **Customize Patterns**: Adapt patterns to your specific use case
3. **Maintain Consistency**: Ensure generated code follows your project style
4. **Test Thoroughly**: Write tests for all generated components
5. **Learn from Results**: Update patterns based on what works well

### Arduino/C++ Optimization Tips

1. **Memory First**: Always check memory usage before functionality
2. **Profile Performance**: Measure actual performance, don't just estimate
3. **Hardware Constraints**: Consider board limitations and pin availability
4. **Power Consumption**: Optimize for battery life in portable projects
5. **Interrupt Efficiency**: Keep ISRs minimal and fast

### Validation and Quality Assurance

1. **Enable Strict Mode**: Use strict validation for production code
2. **Multiple Validation Types**: Check patterns, rules, and security
3. **Continuous Monitoring**: Regularly check for technical debt
4. **Team Reviews**: Use validation tools during code reviews
5. **Metrics Tracking**: Monitor code quality metrics over time

---

## Troubleshooting

### Common Issues and Solutions

#### "Knowledge Graph is Empty"

**Problem**: Tools return empty results or "no context found"

**Solutions**:
1. Run the initialization: `npx @mcp/vibe-coding-kg init /path/to/code`
2. Check if your files are in supported formats (.js, .ts, .cpp, etc.)
3. Verify file permissions and directory access
4. Check the analysis configuration in your settings

#### "Database Connection Failed"

**Problem**: Cannot connect to the Kuzu database

**Solutions**:
1. Check database path permissions: `ls -la .kg-context/`
2. Ensure the directory is writable: `chmod 755 .kg-context/`
3. Delete and recreate the database: `rm -rf .kg-context/knowledge-graph.kuzu`
4. Run setup again: `npx @mcp/vibe-coding-kg setup`

#### "Tool Not Found" in Claude Desktop

**Problem**: Claude Desktop doesn't recognize the MCP tools

**Solutions**:
1. Verify the configuration file path and format
2. Check that the npx command is in your PATH
3. Restart Claude Desktop after configuration changes
4. Test the server manually: `npx @mcp/vibe-coding-kg start`

#### "Memory Usage Too High"

**Problem**: Arduino memory analysis shows excessive usage

**Solutions**:
1. Use the optimization tool for specific recommendations
2. Move string constants to PROGMEM
3. Reduce array sizes and optimize data types
4. Remove unused libraries and variables
5. Consider using a board with more memory

#### "Validation Errors"

**Problem**: Code validation returns unexpected errors

**Solutions**:
1. Check if your coding standards are properly defined
2. Review the validation rules in your configuration
3. Use non-strict mode for initial validation
4. Update patterns based on your current codebase

#### "Slow Performance"

**Problem**: Tools take too long to respond

**Solutions**:
1. Enable caching in your configuration
2. Reduce the scope of analysis operations
3. Check database performance and optimize queries
4. Monitor system resources and available memory
5. Use the optimization tools to improve performance

### Getting Help

1. **Enable Debug Logging**: Set `LOG_LEVEL=debug` for detailed information
2. **Check System Health**: Use `get_kg_statistics` to assess system status
3. **Review Documentation**: Consult the configuration guide for settings
4. **Community Support**: Join discussions and report issues
5. **Professional Support**: Contact support for enterprise deployments

### Performance Optimization

1. **Database Tuning**: Adjust buffer pool size and connection limits
2. **Cache Configuration**: Enable and tune caching for better performance
3. **Query Optimization**: Use the query optimizer for complex operations
4. **Memory Management**: Monitor and optimize memory usage
5. **Concurrent Operations**: Limit concurrent analysis operations

### Security Considerations

1. **Input Validation**: Enable comprehensive input validation
2. **Code Analysis**: Be cautious when analyzing untrusted code
3. **File Permissions**: Ensure proper file and directory permissions
4. **Network Security**: Secure network connections if using remote features
5. **Data Protection**: Protect sensitive code and configuration data

---

## Next Steps

After mastering the basics, consider exploring:

1. **Advanced Patterns**: Implement complex architectural patterns
2. **Custom Rules**: Define project-specific validation rules
3. **Integration**: Integrate with CI/CD pipelines and development tools
4. **Team Workflows**: Establish team-wide development patterns
5. **Monitoring**: Set up continuous monitoring and quality metrics

The MCP Vibe Coding Knowledge Graph grows more valuable as you use it. The system learns from your code and decisions, becoming an increasingly powerful assistant for your development workflow.