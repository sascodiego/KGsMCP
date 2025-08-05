# API Reference

## Overview

The MCP Vibe Coding Knowledge Graph server provides 19+ MCP tools for AI-assisted development. All tools follow the Model Context Protocol specification and return structured JSON responses.

## Tool Categories

### Domain Ontology Management
- [`define_domain_ontology`](#define_domain_ontology)

### Context Operations
- [`query_context_for_task`](#query_context_for_task)
- [`extract_context_from_code`](#extract_context_from_code)

### Code Generation
- [`generate_code_with_context`](#generate_code_with_context)
- [`suggest_refactoring`](#suggest_refactoring)

### Validation & Analysis
- [`validate_against_kg`](#validate_against_kg)
- [`detect_technical_debt`](#detect_technical_debt)
- [`analyze_codebase`](#analyze_codebase)

### Knowledge Graph Management
- [`update_kg_from_code`](#update_kg_from_code)
- [`get_kg_statistics`](#get_kg_statistics)

### Arduino/C++ Development
- [`analyze_arduino_sketch`](#analyze_arduino_sketch)
- [`validate_hardware_config`](#validate_hardware_config)
- [`optimize_for_arduino`](#optimize_for_arduino)
- [`generate_interrupt_safe_code`](#generate_interrupt_safe_code)
- [`analyze_timing_constraints`](#analyze_timing_constraints)

### System Management
- [`get_optimization_report`](#get_optimization_report)
- [`force_optimization`](#force_optimization)

---

## Domain Ontology Management

### `define_domain_ontology`

Define or update the domain ontology in the knowledge graph with business entities, relationships, rules, and coding standards.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "entities": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "type": { "type": "string" },
          "attributes": { "type": "array", "items": { "type": "string" } },
          "description": { "type": "string" }
        },
        "required": ["name", "type"]
      }
    },
    "relationships": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "from": { "type": "string" },
          "to": { "type": "string" },
          "type": { "type": "string" },
          "description": { "type": "string" }
        },
        "required": ["from", "to", "type"]
      }
    },
    "businessRules": {
      "type": "array",
      "items": { "type": "string" }
    },
    "codingStandards": {
      "type": "object",
      "properties": {
        "naming": { "type": "object" },
        "structure": { "type": "object" },
        "documentation": { "type": "object" }
      }
    }
  },
  "required": ["entities"]
}
```

#### Example Usage

```markdown
Use the `define_domain_ontology` tool to establish patterns for our e-commerce platform:

Entities:
- Product (type: "business_entity", attributes: ["id", "name", "price", "category"])
- Order (type: "business_entity", attributes: ["id", "customerId", "items", "total"])
- Customer (type: "business_entity", attributes: ["id", "email", "preferences"])

Relationships:
- Customer PLACES Order
- Order CONTAINS Product

Business Rules:
- "Orders must have at least one item"
- "Product prices must be positive"
- "Customer email must be unique"

Coding Standards:
- naming: { "variables": "camelCase", "interfaces": "PascalCase with I prefix" }
- structure: { "maxFunctionLength": 50, "maxClassLength": 300 }
```

#### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"success\": true, \"entitiesCreated\": 3, \"relationshipsCreated\": 2, \"rulesCreated\": 3, \"standardsUpdated\": 2}"
    }
  ]
}
```

---

## Context Operations

### `query_context_for_task`

Query the knowledge graph for relevant context before generating code, including patterns, related entities, and applicable rules.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "taskDescription": { "type": "string" },
    "entityTypes": { "type": "array", "items": { "type": "string" } },
    "depth": { "type": "integer", "default": 2 }
  },
  "required": ["taskDescription"]
}
```

#### Example Usage

```markdown
Use the `query_context_for_task` tool to find relevant context for:
"Implement user authentication with JWT tokens"

Entity types: ["authentication", "user", "security"]
Depth: 3
```

#### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"taskDescription\": \"Implement user authentication with JWT tokens\", \"context\": {\"patterns\": [\"Repository\", \"Factory\", \"Strategy\"], \"relatedCode\": [{\"name\": \"AuthService\", \"path\": \"/src/auth/authService.js\"}], \"rules\": [\"Always hash passwords\", \"Use secure token storage\"], \"standards\": [{\"name\": \"errorHandling\", \"value\": \"Use structured error responses\"}]}, \"relevanceScore\": 0.92}"
    }
  ]
}
```

### `extract_context_from_code`

Extract structured context information from existing code comments and populate the knowledge graph.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "filePath": { "type": "string" },
    "codeSnippet": { "type": "string" }
  },
  "required": ["filePath"]
}
```

#### Example Usage

```markdown
Use the `extract_context_from_code` tool on the file:
"/src/services/authService.js"
```

#### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"extracted\": {\"entities\": 5, \"structuredComments\": 3, \"filePath\": \"/src/services/authService.js\"}, \"patterns\": [\"Service Layer\", \"Dependency Injection\"], \"decisions\": [{\"decision\": \"Use JWT for stateless auth\", \"reason\": \"Better scalability\"}]}"
    }
  ]
}
```

---

## Code Generation

### `generate_code_with_context`

Generate code grounded in knowledge graph context, following established patterns and standards.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "requirement": { "type": "string" },
    "contextIds": { "type": "array", "items": { "type": "string" } },
    "patternsToApply": { "type": "array", "items": { "type": "string" } },
    "constraints": { "type": "object" }
  },
  "required": ["requirement"]
}
```

#### Example Usage

```markdown
Use the `generate_code_with_context` tool with:

Requirement: "Create a user registration service"
Patterns to apply: ["repository", "validation", "error-handling"]
Constraints: {"language": "typescript", "testing": "jest", "maxComplexity": 10}
Context IDs: ["pattern:repository", "entity:user"]
```

#### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "```typescript\n/**\n * CONTEXT: User registration service following repository pattern\n * REASON: Separation of concerns and testability\n * CHANGE: New service with validation and error handling\n * PREVENTION: Data inconsistency and security vulnerabilities\n */\nexport class UserRegistrationService {\n  constructor(\n    private userRepository: IUserRepository,\n    private validator: IValidator\n  ) {}\n\n  async registerUser(userData: CreateUserDto): Promise<User> {\n    // Validation logic\n    const validation = await this.validator.validate(userData);\n    if (!validation.isValid) {\n      throw new ValidationError('Invalid user data', validation.errors);\n    }\n\n    // Check for existing user\n    const existingUser = await this.userRepository.findByEmail(userData.email);\n    if (existingUser) {\n      throw new ConflictError('User already exists');\n    }\n\n    // Create and save user\n    const user = User.create(userData);\n    return await this.userRepository.save(user);\n  }\n}\n```"
    }
  ]
}
```

### `suggest_refactoring`

Suggest refactorings based on detected patterns and knowledge graph analysis.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "codeEntity": { "type": "string" },
    "improvementGoals": { "type": "array", "items": { "type": "string" } },
    "preserveBehavior": { "type": "boolean", "default": true }
  },
  "required": ["codeEntity"]
}
```

#### Example Usage

```markdown
Use the `suggest_refactoring` tool for:

Code entity: "UserService.createUser method"
Improvement goals: ["reduce complexity", "improve testability", "better error handling"]
Preserve behavior: true
```

#### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"refactorings\": [{\"type\": \"Extract Method\", \"description\": \"Extract validation logic into separate method\", \"impact\": \"Reduces cyclomatic complexity from 8 to 5\", \"confidence\": 0.9}, {\"type\": \"Dependency Injection\", \"description\": \"Inject validator instead of direct instantiation\", \"impact\": \"Improves testability and follows SOLID principles\", \"confidence\": 0.85}], \"estimatedEffort\": \"2-4 hours\", \"riskLevel\": \"Low\"}"
    }
  ]
}
```

---

## Validation & Analysis

### `validate_against_kg`

Validate code or decisions against knowledge graph rules, patterns, and standards.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "codeSnippet": { "type": "string" },
    "validationTypes": { "type": "array", "items": { "type": "string" } },
    "strictMode": { "type": "boolean", "default": true }
  },
  "required": ["codeSnippet"]
}
```

#### Example Usage

```markdown
Use the `validate_against_kg` tool to check this code:

```typescript
class UserService {
  constructor(private repository: UserRepository) {}
  
  async createUser(userData: any): Promise<any> {
    return this.repository.save(userData);
  }
}
```

Validation types: ["patterns", "rules", "standards", "types"]
Strict mode: true
```

#### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"validation\": {\"isValid\": false, \"score\": 0.6, \"violations\": [{\"rule\": \"Avoid 'any' type\", \"severity\": \"medium\", \"line\": 4, \"suggestion\": \"Use specific interface types\"}, {\"rule\": \"Missing input validation\", \"severity\": \"high\", \"line\": 4, \"suggestion\": \"Add validation before repository call\"}], \"patterns\": [{\"detected\": \"Repository Pattern\", \"confidence\": 0.8, \"status\": \"correctly_implemented\"}], \"recommendations\": [\"Define UserCreateDto interface\", \"Add input validation layer\", \"Implement proper error handling\"]}}"
    }
  ]
}
```

### `detect_technical_debt`

Detect potential technical debt by analyzing code against knowledge graph patterns and rules.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "scope": { "type": "string", "enum": ["module", "project", "specific"] },
    "target": { "type": "string" },
    "debtTypes": { "type": "array", "items": { "type": "string" } }
  },
  "required": ["scope"]
}
```

#### Example Usage

```markdown
Use the `detect_technical_debt` tool to analyze:

Scope: "module"
Target: "src/services/auth"
Debt types: ["complexity", "duplication", "coupling", "documentation"]
```

#### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"debtAnalysis\": {\"totalDebtScore\": 7.2, \"debtItems\": [{\"type\": \"complexity\", \"location\": \"authService.js:45\", \"severity\": \"high\", \"description\": \"Function has cyclomatic complexity of 12\", \"effort\": \"4 hours\"}, {\"type\": \"duplication\", \"locations\": [\"authService.js:23\", \"userService.js:34\"], \"severity\": \"medium\", \"description\": \"Validation logic duplicated\", \"effort\": \"2 hours\"}], \"recommendations\": [\"Extract common validation logic\", \"Break down complex functions\", \"Add unit tests for edge cases\"], \"estimatedFixTime\": \"6-8 hours\"}}"
    }
  ]
}
```

### `analyze_codebase`

Perform comprehensive analysis of an entire codebase and update the knowledge graph.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "codebasePath": { "type": "string" },
    "includeGitHistory": { "type": "boolean", "default": true },
    "maxDepth": { "type": "integer", "default": 10 }
  },
  "required": ["codebasePath"]
}
```

#### Example Usage

```markdown
Use the `analyze_codebase` tool to analyze:

Codebase path: "/path/to/project"
Include git history: true
Max depth: 15
```

#### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"analysisResults\": {\"filesAnalyzed\": 234, \"entitiesExtracted\": 1456, \"patternsDetected\": 23, \"rulesViolated\": 8, \"technicalDebtScore\": 6.4, \"testCoverage\": \"78%\", \"complexity\": {\"average\": 4.2, \"highest\": 15, \"files\": [\"src/complex/processor.js\"]}, \"recommendations\": [\"Add tests for uncovered modules\", \"Refactor high-complexity functions\", \"Implement missing error handling\"]}}"
    }
  ]
}
```

---

## Knowledge Graph Management

### `update_kg_from_code`

Update the knowledge graph with new entities, relationships, or patterns learned from code analysis.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "codeAnalysis": { "type": "object" },
    "decisions": { "type": "array", "items": { "type": "object" } },
    "learnedPatterns": { "type": "array", "items": { "type": "object" } }
  },
  "required": ["codeAnalysis"]
}
```

#### Example Usage

```markdown
Use the `update_kg_from_code` tool with:

Code analysis: {
  "newEntities": [{"name": "PaymentProcessor", "type": "service", "complexity": 6}],
  "newRelationships": [{"from": "OrderService", "to": "PaymentProcessor", "type": "DEPENDS_ON"}]
}

Decisions: [
  {"decision": "Use Stripe for payment processing", "reason": "Better API and documentation", "alternatives": ["PayPal", "Square"]}
]

Learned patterns: [
  {"name": "Payment Gateway Adapter", "confidence": 0.85, "description": "Abstracts payment provider details"}
]
```

#### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"updateResults\": {\"entitiesAdded\": 1, \"relationshipsAdded\": 1, \"decisionsRecorded\": 1, \"patternsLearned\": 1, \"graphStats\": {\"totalNodes\": 1457, \"totalRelationships\": 2341}, \"confidence\": 0.89}}"
    }
  ]
}
```

### `get_kg_statistics`

Get comprehensive statistics about the knowledge graph including health metrics and recommendations.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "includeDetails": { "type": "boolean", "default": false },
    "entityType": { "type": "string" }
  }
}
```

#### Example Usage

```markdown
Use the `get_kg_statistics` tool with:

Include details: true
Entity type: "CodeEntity"
```

#### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"timestamp\": \"2024-01-15T10:30:00Z\", \"basicStatistics\": {\"codeEntities\": 1456, \"patterns\": 23, \"rules\": 15, \"standards\": 8, \"decisions\": 12, \"relationships\": {\"IMPLEMENTS\": 234, \"DEPENDS_ON\": 567}, \"totalRelationships\": 2341}, \"detailedAnalysis\": {\"entityBreakdown\": [{\"type\": \"class\", \"count\": 234, \"avgComplexity\": 5.2}], \"patternStats\": [{\"category\": \"Creational\", \"count\": 8, \"avgConfidence\": 0.84}]}, \"summary\": {\"totalNodes\": 1514, \"healthStatus\": {\"status\": \"healthy\", \"message\": \"Knowledge Graph is well-populated and ready for use.\"}, \"recommendations\": [{\"type\": \"standards\", \"message\": \"Consider adding more coding standards\", \"action\": \"Use define_domain_ontology to add standards\"}]}}"
    }
  ]
}
```

---

## Arduino/C++ Development

### `analyze_arduino_sketch`

Analyze Arduino sketches for hardware usage, memory consumption, and optimization opportunities.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "sketchPath": { "type": "string" },
    "targetBoard": { 
      "type": "string", 
      "enum": ["uno", "mega2560", "nano", "esp32"],
      "default": "uno"
    },
    "includeLibraries": { "type": "boolean", "default": true }
  },
  "required": ["sketchPath"]
}
```

#### Example Usage

```markdown
Use the `analyze_arduino_sketch` tool to analyze:

Sketch path: "/path/to/led_controller.ino"
Target board: "uno"
Include libraries: true
```

#### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"analysis\": {\"memoryUsage\": {\"estimatedRAM\": 1234, \"estimatedFlash\": 15678, \"percentRAM\": 60.4, \"percentFlash\": 48.9}, \"hardwareUsage\": {\"digitalPins\": [2, 3, 13], \"analogPins\": [\"A0\", \"A1\"], \"interrupts\": [\"INT0\"], \"timers\": [\"Timer1\"]}, \"optimizations\": [{\"type\": \"memory\", \"description\": \"Use PROGMEM for string constants\", \"savings\": \"~200 bytes Flash\"}, {\"type\": \"performance\", \"description\": \"Use direct port manipulation for pin 13\", \"improvement\": \"~50% faster\"}], \"compatibility\": {\"boardSupported\": true, \"warnings\": [\"Timer1 conflicts with Servo library\"]}, \"complexity\": {\"cyclomaticComplexity\": 8, \"linesOfCode\": 156}}}"
    }
  ]
}
```

### `validate_hardware_config`

Validate pin assignments and hardware compatibility for Arduino projects.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "board": { 
      "type": "string",
      "enum": ["uno", "mega2560", "nano", "esp32"]
    },
    "components": { 
      "type": "array", 
      "items": { 
        "type": "object",
        "properties": {
          "pin": { "type": "string" },
          "usage": { "type": "array", "items": { "type": "string" } },
          "type": { "type": "string" }
        }
      }
    },
    "connections": { "type": "array", "items": { "type": "object" } }
  },
  "required": ["board", "components"]
}
```

#### Example Usage

```markdown
Use the `validate_hardware_config` tool to validate:

Board: "uno"
Components:
- Pin 2: usage ["digitalRead", "interrupt"], type "button"
- Pin 13: usage ["digitalWrite"], type "LED"
- Pin A0: usage ["analogRead"], type "sensor"

Connections:
- {"from": "pin2", "to": "button", "protocol": "digital"}
- {"from": "pin13", "to": "LED", "protocol": "digital"}
```

#### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"validation\": {\"isValid\": true, \"conflicts\": [], \"warnings\": [{\"pin\": \"13\", \"message\": \"Pin 13 has onboard LED, may affect external LED\", \"severity\": \"low\"}], \"capabilities\": {\"pin2\": {\"digital\": true, \"interrupt\": \"INT0\", \"pwm\": false}, \"pin13\": {\"digital\": true, \"pwm\": false, \"builtin_led\": true}, \"pinA0\": {\"analog\": true, \"digital\": true}}, \"alternatives\": [], \"powerAnalysis\": {\"estimatedCurrent\": \"45mA\", \"withinLimits\": true}}}"
    }
  ]
}
```

### `optimize_for_arduino`

Suggest optimizations for memory usage and performance in Arduino projects.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "memoryUsage": {
      "type": "object",
      "properties": {
        "ram": { "type": "integer" },
        "flash": { "type": "integer" },
        "eeprom": { "type": "integer" }
      }
    },
    "targetBoard": { 
      "type": "string",
      "enum": ["uno", "mega2560", "nano", "esp32"]
    },
    "complexity": { "type": "integer" },
    "constraints": {
      "type": "object",
      "properties": {
        "maxRAM": { "type": "integer" },
        "maxFlash": { "type": "integer" },
        "maxLoopTime": { "type": "integer" }
      }
    }
  },
  "required": ["targetBoard"]
}
```

#### Example Usage

```markdown
Use the `optimize_for_arduino` tool for:

Memory usage: {"ram": 1800, "flash": 28000}
Target board: "uno"
Complexity: 12
Constraints: {"maxRAM": 1500, "maxFlash": 25000, "maxLoopTime": 50}
```

#### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"optimizations\": [{\"category\": \"memory\", \"type\": \"PROGMEM\", \"description\": \"Move string literals to program memory\", \"impact\": \"Save ~300 bytes RAM\", \"priority\": \"high\", \"effort\": \"low\"}, {\"category\": \"performance\", \"type\": \"algorithm\", \"description\": \"Replace String concatenation with char arrays\", \"impact\": \"Reduce memory fragmentation\", \"priority\": \"medium\", \"effort\": \"medium\"}], \"codePatterns\": [\"Use const char* instead of String\", \"Implement state machines for complex logic\", \"Use bitwise operations for flags\"], \"boardSpecific\": [{\"board\": \"uno\", \"recommendation\": \"Consider using EEPROM for configuration data\"}]}"
    }
  ]
}
```

### `generate_interrupt_safe_code`

Generate code patterns that are safe for use in interrupt contexts.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "functionality": { "type": "string" },
    "interruptType": { 
      "type": "string", 
      "enum": ["external", "timer", "serial"],
      "default": "external"
    },
    "sharedVariables": { 
      "type": "array", 
      "items": { "type": "string" } 
    }
  },
  "required": ["functionality"]
}
```

#### Example Usage

```markdown
Use the `generate_interrupt_safe_code` tool for:

Functionality: "button_debouncing"
Interrupt type: "external"
Shared variables: ["buttonState", "lastDebounceTime", "debounceDelay"]
```

#### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "```cpp\n/**\n * CONTEXT: Interrupt-safe button debouncing\n * REASON: Prevent button bounce artifacts in interrupt handlers\n * CHANGE: Volatile variables and minimal ISR implementation\n * PREVENTION: Race conditions and timing issues\n */\n\n// Shared variables (declared volatile for interrupt safety)\nvolatile bool buttonState = false;\nvolatile unsigned long lastDebounceTime = 0;\nconst unsigned long debounceDelay = 50;\n\n// Interrupt service routine (keep minimal)\nvoid buttonISR() {\n  // Only update timestamp in ISR\n  lastDebounceTime = millis();\n}\n\n// Main loop debounce handling\nvoid updateButtonState() {\n  static bool lastReading = HIGH;\n  bool currentReading = digitalRead(BUTTON_PIN);\n  \n  // Check if enough time has passed\n  if ((millis() - lastDebounceTime) > debounceDelay) {\n    if (currentReading != lastReading) {\n      buttonState = (currentReading == LOW);\n      lastReading = currentReading;\n    }\n  }\n}\n```"
    }
  ]
}
```

### `analyze_timing_constraints`

Analyze timing requirements and constraints for real-time Arduino code.

#### Input Schema

```json
{
  "type": "object",
  "properties": {
    "codeEntity": { "type": "string" },
    "constraints": {
      "type": "object",
      "properties": {
        "maxExecutionTime": { "type": "integer" },
        "maxLoopTime": { "type": "integer" },
        "realTimeDeadline": { "type": "integer" }
      }
    }
  },
  "required": ["codeEntity"]
}
```

#### Example Usage

```markdown
Use the `analyze_timing_constraints` tool for:

Code entity: "sensor_reading_loop"
Constraints: {"maxExecutionTime": 1000, "maxLoopTime": 100, "realTimeDeadline": 50}
```

#### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"timingAnalysis\": {\"estimatedExecutionTime\": 850, \"loopTime\": 45, \"criticalPath\": [\"sensor_read(): 30μs\", \"data_processing(): 10μs\", \"serial_output(): 5μs\"], \"constraintViolations\": [], \"recommendations\": [{\"type\": \"optimization\", \"description\": \"Use non-blocking serial communication\", \"impact\": \"Reduce worst-case execution time\"}, {\"type\": \"architecture\", \"description\": \"Consider using timer interrupts for precise timing\", \"impact\": \"Improve real-time performance\"}], \"realTimeScore\": 0.92}}"
    }
  ]
}
```

---

## System Management

### `get_optimization_report`

Get a comprehensive performance optimization report for the MCP server.

#### Input Schema

```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```

#### Example Usage

```markdown
Use the `get_optimization_report` tool to get current performance metrics.
```

#### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"optimizationReport\": {\"cachePerformance\": {\"hitRate\": 0.85, \"size\": \"45MB\", \"evictions\": 23}, \"queryPerformance\": {\"avgQueryTime\": \"45ms\", \"slowQueries\": 2, \"optimizedQueries\": 156}, \"memoryUsage\": {\"current\": \"340MB\", \"peak\": \"450MB\", \"limit\": \"1GB\"}, \"recommendations\": [\"Increase cache size for better hit rate\", \"Optimize slow queries in validation module\"], \"systemHealth\": \"Good\"}}"
    }
  ]
}
```

### `force_optimization`

Force immediate optimization of all system components.

#### Input Schema

```json
{
  "type": "object",
  "properties": {},
  "required": []
}
```

#### Example Usage

```markdown
Use the `force_optimization` tool to trigger immediate system optimization.
```

#### Response Format

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"success\": true, \"message\": \"Optimization completed successfully\", \"duration\": \"1250ms\", \"report\": {\"cachesCleared\": 3, \"queriesOptimized\": 45, \"memoryReclaimed\": \"120MB\", \"indexesRebuilt\": 8}}"
    }
  ]
}
```

---

## Error Handling

All tools follow consistent error handling patterns:

### Validation Errors

```json
{
  "content": [
    {
      "type": "text", 
      "text": "{\"error\": \"Validation failed\", \"details\": [\"Field 'sketchPath' is required\", \"Invalid board type 'invalid_board'\"], \"code\": \"VALIDATION_ERROR\"}"
    }
  ]
}
```

### System Errors

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"error\": \"Database connection failed\", \"message\": \"Unable to connect to Kuzu database\", \"code\": \"DATABASE_ERROR\", \"retryable\": true}"
    }
  ]
}
```

### Security Errors

```json
{
  "content": [
    {
      "type": "text",
      "text": "{\"error\": \"Security threat detected\", \"threatLevel\": \"HIGH\", \"detectedThreats\": [\"code_injection\"], \"recommendations\": [\"Sanitize input parameters\"], \"blocked\": true}"
    }
  ]
}
```

## Rate Limiting

All tools respect rate limiting configurations:

- Default: 100 requests per minute
- Configurable via validation.rateLimiting settings
- Rate limit headers included in responses
- Graceful degradation when limits exceeded

## Authentication

Currently, the MCP server runs in trusted mode with Claude Desktop. Future versions may include:

- API key authentication
- Role-based access control
- Tool-level permissions
- Audit logging

## Versioning

The API follows semantic versioning:

- Current version: 1.0.0
- Breaking changes increment major version
- New tools increment minor version
- Bug fixes increment patch version