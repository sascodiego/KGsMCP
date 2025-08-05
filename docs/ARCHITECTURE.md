# Architecture Documentation

## System Overview

The MCP Vibe Coding Knowledge Graph system is a sophisticated Model Context Protocol server that integrates AI-assisted development with knowledge graph technology. The system provides context-aware code generation, pattern detection, technical debt analysis, and specialized Arduino/C++ embedded development support.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Claude Desktop                           │
└─────────────────────┬───────────────────────────────────────────┘
                      │ MCP Protocol
┌─────────────────────▼───────────────────────────────────────────┐
│                   MCP Server                                    │
│  ┌─────────────────┬───────────────────┬─────────────────────┐  │
│  │  Tool Handlers  │  Validation Layer │  Optimization Layer │  │
│  └─────────────────┴───────────────────┴─────────────────────┘  │
└─────────────────────┬───────────────────────────────────────────┘
                      │
┌─────────────────────▼───────────────────────────────────────────┐
│                Knowledge Graph (Kuzu)                          │
│  ┌─────────────┬─────────────┬─────────────┬─────────────────┐  │
│  │ Code Entities│  Patterns   │    Rules    │   Decisions     │  │
│  └─────────────┴─────────────┴─────────────┴─────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. MCP Server Core (`src/server.js`)

The central server component that orchestrates all operations:

- **Tool Registry**: Manages 19+ MCP tools for various development tasks
- **Request Handling**: Processes tool calls with comprehensive validation
- **Error Management**: Robust error handling with graceful degradation
- **Health Monitoring**: Real-time system health checks and metrics

### 2. Handler Layer (`src/handlers/`)

Specialized handlers for different domains:

#### Context Handler (`context.js`)
- Extracts structured comments from code
- Queries relevant context for development tasks
- Maintains context relationships in the knowledge graph

#### Code Generation Handler (`codeGeneration.js`)
- Generates code based on established patterns
- Provides refactoring suggestions
- Ensures consistency with project standards

#### Validation Handler (`validation.js`)
- Validates code against stored rules and patterns
- Detects technical debt and anti-patterns
- Provides quality assessments and recommendations

#### Knowledge Graph Handler (`knowledgeGraph.js`)
- Manages domain ontology definitions
- Updates graph with new learnings
- Maintains graph integrity and consistency

#### Arduino Handler (`arduinoHandler.js`)
- Specialized Arduino/C++ analysis
- Hardware configuration validation
- Memory optimization for embedded systems
- Interrupt-safe code generation

#### Initialization Handler (`initialization.js`)
- Analyzes entire codebases
- Populates initial knowledge graph
- Extracts patterns and relationships

### 3. Analysis Layer (`src/analyzers/`)

Code analysis engines for different languages and aspects:

#### Code Analyzer (`codeAnalyzer.js`)
- Multi-language AST parsing using Babel
- Entity extraction (classes, functions, variables)
- Complexity metrics calculation
- Cross-file dependency analysis

#### C++ Analyzer (`cppAnalyzer.js`)
- Specialized C++/Arduino code analysis
- Memory usage estimation
- Hardware pin usage detection
- Interrupt service routine analysis

#### Pattern Detector (`patternDetector.js`)
- Automatic design pattern recognition
- Architectural pattern detection
- Anti-pattern identification
- Confidence scoring for detected patterns

#### Git Analyzer (`gitAnalyzer.js`)
- Repository history analysis
- Developer activity tracking
- Change pattern detection
- Evolution timeline construction

### 4. Database Layer (`src/database/`)

Kuzu graph database integration with advanced features:

#### Core Client (`kuzuClient.js`)
- Connection management with health monitoring
- Query execution with retry logic
- Transaction support
- Event-driven architecture

#### Query System (`cypherQuerySystem.js`)
- Template-based query generation
- Query optimization and caching
- Performance monitoring
- Batch operations support

#### Performance Components
- **Query Cache**: Intelligent caching with TTL
- **Query Optimizer**: Automatic query optimization
- **Batch Operations**: Efficient bulk data operations
- **Transaction Manager**: ACID transaction support

### 5. Validation System (`src/validation/`)

Comprehensive multi-layer validation:

#### Input Validator (`MCPInputValidator.js`)
- Schema validation with Joi
- Input sanitization and normalization
- Rate limiting and abuse prevention
- Security threat detection

#### Advanced Validators (`AdvancedValidators.js`)
- AST-based code structure validation
- Security vulnerability scanning
- Performance impact analysis
- Complexity assessment

#### Validation Middleware (`ValidationMiddleware.js`)
- Request/response interception
- Tool-specific validation rules
- Metrics collection and monitoring
- Error handling and reporting

### 6. Optimization System (`src/optimization/`)

Performance optimization across multiple layers:

#### Cache System
- **Multi-Layer Cache**: L1 (memory) + L2 (disk) caching
- **Code Analysis Cache**: Specialized caching for analysis results
- **Query Cache**: Database query result caching
- **Cache Coherence**: Intelligent cache invalidation

#### Memory Management
- **Memory Optimizer**: Proactive memory management
- **Resource Monitoring**: Real-time resource usage tracking
- **Garbage Collection**: Optimized GC strategies

#### Performance Monitoring
- Real-time performance metrics
- Bottleneck identification
- Automatic optimization triggers
- Performance reporting

## Data Flow Architecture

### 1. Tool Request Flow

```
Claude Desktop → MCP Protocol → Server → Validation → Handler → Database → Response
```

1. **Request Reception**: MCP server receives tool call from Claude
2. **Validation**: Multi-layer validation including security checks
3. **Handler Routing**: Request routed to appropriate handler
4. **Database Operations**: Knowledge graph queries/updates
5. **Response Generation**: Structured response with metadata
6. **Optimization**: Response optimization and caching

### 2. Code Analysis Flow

```
Codebase → File Discovery → AST Parsing → Entity Extraction → Pattern Detection → Graph Update
```

1. **Discovery**: Recursive file system scanning with filters
2. **Parsing**: Language-specific AST generation
3. **Extraction**: Entity and relationship extraction
4. **Analysis**: Pattern detection and metrics calculation
5. **Storage**: Knowledge graph population
6. **Indexing**: Search index creation and maintenance

### 3. Context Query Flow

```
Task Description → Context Search → Pattern Matching → Relevance Scoring → Response Assembly
```

1. **Query Processing**: Natural language task analysis
2. **Graph Traversal**: Multi-hop graph queries
3. **Pattern Matching**: Similarity scoring algorithms
4. **Ranking**: Relevance-based result ranking
5. **Response**: Structured context with recommendations

## Knowledge Graph Schema

### Node Types

#### Core Entities
- **CodeEntity**: Classes, functions, variables with metadata
- **Pattern**: Design patterns with confidence scores
- **Rule**: Business rules and coding standards
- **Standard**: Project conventions and guidelines
- **Decision**: Architectural decisions with rationale

#### Domain Entities
- **DomainEntity**: Business domain concepts
- **Requirement**: Functional and non-functional requirements
- **TestCase**: Test scenarios and validation criteria

#### Arduino/Embedded Entities
- **HardwareComponent**: Pins, sensors, actuators
- **Board**: Arduino board specifications
- **Library**: Dependencies and libraries
- **Interrupt**: ISR definitions and handlers
- **TimingConstraint**: Real-time requirements
- **MemorySegment**: Memory allocation tracking

### Relationship Types

#### Code Relationships
- **IMPLEMENTS**: Pattern implementation
- **DEPENDS_ON**: Dependency relationships
- **CALLS**: Function call relationships
- **INHERITS**: Inheritance hierarchies
- **CONTAINS**: Composition relationships

#### Pattern Relationships
- **FOLLOWS**: Standard compliance
- **VIOLATES**: Rule violations
- **SUGGESTS**: Recommended patterns
- **CONFLICTS**: Pattern conflicts

#### Hardware Relationships
- **USES_HARDWARE**: Hardware component usage
- **COMPATIBLE_WITH**: Compatibility matrices
- **HANDLES**: Interrupt handling
- **ALLOCATES**: Memory allocation
- **CONSTRAINS**: Timing constraints

## Security Architecture

### 1. Input Validation
- Multi-layer schema validation
- Code injection prevention
- Path traversal protection
- Resource consumption limits

### 2. Data Sanitization
- HTML/script tag removal
- SQL injection prevention
- File path normalization
- Content type validation

### 3. Access Control
- Tool-level permission checking
- Resource access restrictions
- Rate limiting enforcement
- Audit logging

### 4. Data Protection
- Sensitive data redaction
- Secure credential handling
- Privacy-preserving analytics
- Data retention policies

## Performance Characteristics

### 1. Response Times
- Tool calls: < 2 seconds (95th percentile)
- Database queries: < 100ms (average)
- Code analysis: < 5 seconds per 1000 LOC
- Pattern detection: < 1 second per file

### 2. Scalability
- Concurrent connections: 10+ (configurable)
- Database size: Millions of nodes/relationships
- Memory usage: < 500MB for large codebases
- CPU usage: < 50% during analysis

### 3. Reliability
- Uptime: 99.9% target
- Error rate: < 1% of requests
- Data consistency: ACID transactions
- Recovery time: < 30 seconds

## Configuration Management

### 1. Environment-Based Configuration
- Development, staging, production profiles
- Environment variable overrides
- Dynamic configuration reloading
- Configuration validation

### 2. Feature Flags
- Validation system toggles
- Optimization feature controls
- Experimental feature gates
- Performance tuning parameters

### 3. Monitoring Configuration
- Health check intervals
- Alert thresholds
- Metrics collection settings
- Log level controls

## Deployment Architecture

### 1. Standalone Deployment
- Single Node.js process
- Embedded Kuzu database
- Local file system storage
- CLI management tools

### 2. Distributed Deployment (Future)
- Multiple server instances
- Shared database cluster
- Load balancing support
- Service discovery

### 3. Container Deployment
- Docker containerization
- Kubernetes orchestration
- Volume management
- Resource constraints

## Extension Points

### 1. Handler Extensions
- Custom tool implementations
- Domain-specific handlers
- Third-party integrations
- Plugin architecture

### 2. Analyzer Extensions
- New language support
- Custom metrics calculators
- Additional pattern detectors
- Integration analyzers

### 3. Validation Extensions
- Custom validation rules
- Security scanners
- Quality gates
- Compliance checkers

### 4. Database Extensions
- Custom node types
- Additional relationships
- Query optimizations
- Index strategies

## Technology Stack

### Core Technologies
- **Node.js 18+**: Runtime environment
- **Kuzu Database**: Embedded graph database
- **Model Context Protocol**: Communication protocol
- **Babel**: JavaScript/TypeScript AST parsing

### Supporting Libraries
- **Winston**: Structured logging
- **Joi**: Schema validation
- **Commander**: CLI interface
- **Chalk**: Terminal styling
- **Simple-git**: Git integration
- **Glob**: File pattern matching

### Development Tools
- **Jest**: Testing framework
- **ESLint**: Code linting
- **Prettier**: Code formatting
- **Nodemon**: Development server

## Future Architecture Considerations

### 1. Microservices Migration
- Service decomposition strategies
- Inter-service communication
- Data consistency patterns
- Service mesh integration

### 2. Cloud Native Features
- Auto-scaling capabilities
- Container orchestration
- Service monitoring
- Distributed tracing

### 3. AI/ML Integration
- Pattern learning algorithms
- Predictive analytics
- Natural language processing
- Recommendation engines

### 4. Real-time Features
- Live code analysis
- Streaming updates
- WebSocket support
- Event-driven architecture