# Security Guide

## Table of Contents

1. [Security Overview](#security-overview)
2. [Threat Model](#threat-model)
3. [Input Validation and Sanitization](#input-validation-and-sanitization)
4. [Code Analysis Security](#code-analysis-security)
5. [Database Security](#database-security)
6. [Network Security](#network-security)
7. [Access Control](#access-control)
8. [Audit and Monitoring](#audit-and-monitoring)
9. [Secure Configuration](#secure-configuration)
10. [Incident Response](#incident-response)

---

## Security Overview

The MCP Vibe Coding Knowledge Graph system handles potentially sensitive code and architectural information. This guide outlines security best practices and mechanisms to protect against various threats while maintaining system functionality.

### Security Principles

1. **Defense in Depth**: Multiple layers of security controls
2. **Least Privilege**: Minimal necessary permissions
3. **Input Validation**: Comprehensive input sanitization
4. **Secure by Default**: Secure default configurations
5. **Transparency**: Clear audit trails and logging

### Security Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Security Layers                          │
├─────────────────────────────────────────────────────────────┤
│  Input Validation & Sanitization                           │
├─────────────────────────────────────────────────────────────┤
│  Authentication & Authorization                             │
├─────────────────────────────────────────────────────────────┤
│  Secure Communication (MCP Protocol)                       │
├─────────────────────────────────────────────────────────────┤
│  Code Analysis Security                                     │
├─────────────────────────────────────────────────────────────┤
│  Database Security & Encryption                            │
├─────────────────────────────────────────────────────────────┤
│  System Security & Monitoring                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Threat Model

### Identified Threats

#### 1. Code Injection Attacks

**Risk Level**: HIGH
**Description**: Malicious code execution through crafted input
**Attack Vectors**:
- Crafted file paths for directory traversal
- Malicious code snippets for analysis
- SQL injection through parameters

**Mitigation**:
- Comprehensive input validation
- Path sanitization
- Parameterized queries
- Sandboxed code analysis

#### 2. Information Disclosure

**Risk Level**: MEDIUM
**Description**: Unauthorized access to sensitive code or architecture
**Attack Vectors**:
- Error messages revealing system information
- Log files containing sensitive data
- Database queries exposing internal structure

**Mitigation**:
- Error message sanitization
- Secure logging practices
- Access controls on sensitive data
- Data classification and handling

#### 3. Denial of Service (DoS)

**Risk Level**: MEDIUM
**Description**: System resource exhaustion
**Attack Vectors**:
- Large file uploads for analysis
- Complex queries causing resource exhaustion
- Memory exhaustion through large datasets

**Mitigation**:
- Resource limits and quotas
- Rate limiting
- Input size restrictions
- Query complexity limits

#### 4. Data Tampering

**Risk Level**: MEDIUM
**Description**: Unauthorized modification of knowledge graph data
**Attack Vectors**:
- Malicious updates to patterns or rules
- Injection of false architectural decisions
- Corruption of analysis results

**Mitigation**:
- Input validation and sanitization
- Transaction integrity
- Audit logging
- Data backup and recovery

---

## Input Validation and Sanitization

### Comprehensive Input Validation

```javascript
/**
 * CONTEXT: Multi-layer input validation system
 * REASON: Prevent injection attacks and ensure data integrity
 * CHANGE: Comprehensive validation with sanitization and security checks
 * PREVENTION: Code injection, data corruption, and security vulnerabilities
 */

import Joi from 'joi';
import DOMPurify from 'isomorphic-dompurify';
import path from 'path';

export class SecurityValidator {
  constructor() {
    this.maxStringLength = 100000;
    this.maxArrayLength = 10000;
    this.maxObjectDepth = 10;
    
    // Define dangerous patterns
    this.dangerousPatterns = [
      /eval\s*\(/i,
      /exec\s*\(/i,
      /system\s*\(/i,
      /require\s*\(/i,
      /import\s*\(/i,
      /__proto__/i,
      /constructor/i,
      /prototype/i,
      /function\s*\*\s*\(/i,
      /javascript:/i,
      /data:.*script/i,
      /vbscript:/i
    ];
    
    // File path traversal patterns
    this.pathTraversalPatterns = [
      /\.\./,
      /~\//,
      /\/etc\//,
      /\/proc\//,
      /\/sys\//,
      /\/dev\//,
      /\\windows\\/i,
      /\\system32\\/i
    ];
  }

  validateToolInput(toolName, input) {
    try {
      // Basic structure validation
      this.validateBasicStructure(input);
      
      // Tool-specific validation
      this.validateToolSpecific(toolName, input);
      
      // Security validation
      this.validateSecurity(input);
      
      // Sanitize input
      return this.sanitizeInput(input);
      
    } catch (error) {
      throw new SecurityError(`Input validation failed: ${error.message}`);
    }
  }

  validateBasicStructure(input) {
    if (typeof input !== 'object' || input === null) {
      throw new Error('Input must be a valid object');
    }

    // Check object depth
    this.validateObjectDepth(input, 0);
    
    // Check for prototype pollution
    this.validatePrototypePollution(input);
  }

  validateObjectDepth(obj, currentDepth) {
    if (currentDepth > this.maxObjectDepth) {
      throw new Error(`Object depth exceeds maximum allowed (${this.maxObjectDepth})`);
    }

    if (typeof obj === 'object' && obj !== null) {
      const keys = Object.keys(obj);
      
      if (keys.length > 1000) {
        throw new Error('Object has too many properties');
      }

      for (const key of keys) {
        this.validateObjectDepth(obj[key], currentDepth + 1);
      }
    }
  }

  validatePrototypePollution(obj) {
    const dangerousKeys = ['__proto__', 'constructor', 'prototype'];
    
    function checkObject(current, path = '') {
      if (typeof current !== 'object' || current === null) return;
      
      for (const key of Object.keys(current)) {
        if (dangerousKeys.includes(key)) {
          throw new SecurityError(`Potentially dangerous property: ${path}.${key}`);
        }
        
        checkObject(current[key], `${path}.${key}`);
      }
    }
    
    checkObject(obj);
  }

  validateSecurity(input) {
    // Validate all string values for dangerous patterns
    this.validateStringValues(input);
    
    // Validate file paths
    this.validateFilePaths(input);
    
    // Validate code snippets
    this.validateCodeSnippets(input);
  }

  validateStringValues(obj, path = '') {
    if (typeof obj === 'string') {
      // Check string length
      if (obj.length > this.maxStringLength) {
        throw new SecurityError(`String too long at ${path}: ${obj.length} > ${this.maxStringLength}`);
      }
      
      // Check for dangerous patterns
      for (const pattern of this.dangerousPatterns) {
        if (pattern.test(obj)) {
          throw new SecurityError(`Dangerous pattern detected at ${path}: ${pattern}`);
        }
      }
      
    } else if (Array.isArray(obj)) {
      if (obj.length > this.maxArrayLength) {
        throw new SecurityError(`Array too long at ${path}: ${obj.length} > ${this.maxArrayLength}`);
      }
      
      obj.forEach((item, index) => {
        this.validateStringValues(item, `${path}[${index}]`);
      });
      
    } else if (typeof obj === 'object' && obj !== null) {
      for (const [key, value] of Object.entries(obj)) {
        this.validateStringValues(value, path ? `${path}.${key}` : key);
      }
    }
  }

  validateFilePaths(input) {
    const pathFields = ['filePath', 'sketchPath', 'codebasePath', 'target'];
    
    for (const field of pathFields) {
      if (input[field]) {
        this.validateSingleFilePath(input[field], field);
      }
    }
  }

  validateSingleFilePath(filePath, fieldName) {
    if (typeof filePath !== 'string') {
      throw new SecurityError(`${fieldName} must be a string`);
    }

    // Check for path traversal attempts
    for (const pattern of this.pathTraversalPatterns) {
      if (pattern.test(filePath)) {
        throw new SecurityError(`Path traversal detected in ${fieldName}: ${filePath}`);
      }
    }

    // Normalize and validate path
    const normalized = path.normalize(filePath);
    if (normalized !== filePath) {
      throw new SecurityError(`Invalid path format in ${fieldName}: ${filePath}`);
    }

    // Check for absolute paths (optional restriction)
    if (path.isAbsolute(filePath)) {
      // Log absolute path usage but don't block (might be legitimate)
      console.warn(`Absolute path used in ${fieldName}: ${filePath}`);
    }
  }

  validateCodeSnippets(input) {
    const codeFields = ['codeSnippet', 'codeEntity', 'requirement'];
    
    for (const field of codeFields) {
      if (input[field]) {
        this.validateCodeSnippet(input[field], field);
      }
    }
  }

  validateCodeSnippet(code, fieldName) {
    if (typeof code !== 'string') return;

    // Check for obviously malicious code patterns
    const maliciousPatterns = [
      /process\.exit/i,
      /child_process/i,
      /fs\.unlink/i,
      /fs\.rmdir/i,
      /rm\s+-rf/i,
      /\.\/etc\/passwd/i,
      /fetch\s*\(/i,
      /XMLHttpRequest/i,
      /addEventListener/i,
      /document\.cookie/i,
      /window\.location/i,
      /eval\s*\(/i,
      /new\s+Function/i
    ];

    for (const pattern of maliciousPatterns) {
      if (pattern.test(code)) {
        throw new SecurityError(`Potentially malicious code pattern in ${fieldName}: ${pattern}`);
      }
    }

    // Check for suspiciously long lines (potential obfuscation)
    const lines = code.split('\n');
    for (let i = 0; i < lines.length; i++) {
      if (lines[i].length > 1000) {
        throw new SecurityError(`Suspiciously long line in ${fieldName} at line ${i + 1}`);
      }
    }
  }

  sanitizeInput(input) {
    if (typeof input === 'string') {
      // Basic HTML sanitization
      return DOMPurify.sanitize(input, { ALLOWED_TAGS: [] });
      
    } else if (Array.isArray(input)) {
      return input.map(item => this.sanitizeInput(item));
      
    } else if (typeof input === 'object' && input !== null) {
      const sanitized = {};
      for (const [key, value] of Object.entries(input)) {
        // Sanitize key names
        const sanitizedKey = key.replace(/[^a-zA-Z0-9_]/g, '');
        sanitized[sanitizedKey] = this.sanitizeInput(value);
      }
      return sanitized;
      
    } else {
      return input;
    }
  }
}

// Custom security error class
export class SecurityError extends Error {
  constructor(message) {
    super(message);
    this.name = 'SecurityError';
    this.severity = 'HIGH';
  }
}
```

### Schema-based Validation

```javascript
// Tool-specific validation schemas
export const secureToolSchemas = {
  analyze_codebase: Joi.object({
    codebasePath: Joi.string()
      .max(1000)
      .pattern(/^[a-zA-Z0-9._/-]+$/)
      .required(),
    includeGitHistory: Joi.boolean().default(true),
    maxDepth: Joi.number().integer().min(1).max(50).default(10)
  }),

  validate_against_kg: Joi.object({
    codeSnippet: Joi.string()
      .max(50000)
      .required(),
    validationTypes: Joi.array()
      .items(Joi.string().valid('patterns', 'rules', 'standards', 'security'))
      .max(10),
    strictMode: Joi.boolean().default(true)
  }),

  generate_code_with_context: Joi.object({
    requirement: Joi.string()
      .max(5000)
      .required(),
    contextIds: Joi.array()
      .items(Joi.string().max(100))
      .max(50),
    patternsToApply: Joi.array()
      .items(Joi.string().max(100))
      .max(20),
    constraints: Joi.object().max(20)
  })
};
```

---

## Code Analysis Security

### Sandboxed Code Analysis

```javascript
/**
 * CONTEXT: Secure code analysis with sandboxing
 * REASON: Prevent malicious code execution during analysis
 * CHANGE: Isolated analysis environment with resource limits
 * PREVENTION: Code injection and system compromise
 */

import { Worker } from 'worker_threads';
import vm from 'vm';
import fs from 'fs/promises';

export class SecureCodeAnalyzer {
  constructor(options = {}) {
    this.timeout = options.timeout || 30000;
    this.memoryLimit = options.memoryLimit || 256 * 1024 * 1024; // 256MB
    this.cpuLimit = options.cpuLimit || 5000; // 5 seconds
  }

  async analyzeCodeSecurely(code, language, filePath) {
    try {
      // Pre-analysis security checks
      this.validateCodeForAnalysis(code, filePath);
      
      // Choose analysis method based on risk level
      const riskLevel = this.assessRisk(code, language);
      
      if (riskLevel === 'HIGH') {
        return await this.analyzeInWorker(code, language, filePath);
      } else {
        return await this.analyzeInSandbox(code, language, filePath);
      }
      
    } catch (error) {
      throw new SecurityError(`Secure analysis failed: ${error.message}`);
    }
  }

  validateCodeForAnalysis(code, filePath) {
    // Check file size
    if (code.length > 1000000) { // 1MB limit
      throw new SecurityError('Code file too large for analysis');
    }

    // Check for binary content
    if (this.isBinaryContent(code)) {
      throw new SecurityError('Binary content detected, analysis skipped');
    }

    // Check file extension
    const allowedExtensions = ['.js', '.ts', '.jsx', '.tsx', '.py', '.java', '.cpp', '.c', '.h', '.ino'];
    const ext = path.extname(filePath);
    if (!allowedExtensions.includes(ext)) {
      throw new SecurityError(`File type not allowed for analysis: ${ext}`);
    }
  }

  isBinaryContent(content) {
    // Simple binary detection - check for null bytes and non-printable characters
    const nullByteIndex = content.indexOf('\0');
    if (nullByteIndex !== -1 && nullByteIndex < 1000) {
      return true;
    }

    // Check ratio of printable to non-printable characters
    let printableCount = 0;
    const sampleSize = Math.min(1000, content.length);
    
    for (let i = 0; i < sampleSize; i++) {
      const charCode = content.charCodeAt(i);
      if ((charCode >= 32 && charCode <= 126) || charCode === 9 || charCode === 10 || charCode === 13) {
        printableCount++;
      }
    }

    return (printableCount / sampleSize) < 0.7;
  }

  assessRisk(code, language) {
    const highRiskPatterns = [
      /eval\s*\(/i,
      /exec\s*\(/i,
      /system\s*\(/i,
      /child_process/i,
      /process\.spawn/i,
      /fs\.unlink/i,
      /fs\.writeFile/i,
      /require\s*\(\s*['"]child_process['"]\s*\)/i,
      /import.*child_process/i,
      /\$\{.*\}/,  // Template literals with expressions
      /document\.write/i,
      /innerHTML/i,
      /outerHTML/i
    ];

    for (const pattern of highRiskPatterns) {
      if (pattern.test(code)) {
        return 'HIGH';
      }
    }

    // Check for obfuscation
    if (this.isObfuscated(code)) {
      return 'HIGH';
    }

    return 'MEDIUM';
  }

  isObfuscated(code) {
    // Simple obfuscation detection
    const lines = code.split('\n');
    let suspiciousLines = 0;

    for (const line of lines) {
      // Very long lines
      if (line.length > 500) suspiciousLines++;
      
      // High density of special characters
      const specialChars = (line.match(/[^a-zA-Z0-9\s]/g) || []).length;
      if (specialChars > line.length * 0.3) suspiciousLines++;
      
      // Encoded patterns
      if (/\\x[0-9a-f]{2}/gi.test(line) || /\\u[0-9a-f]{4}/gi.test(line)) {
        suspiciousLines++;
      }
    }

    return suspiciousLines > lines.length * 0.1;
  }

  async analyzeInWorker(code, language, filePath) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(`
        const { parentPort } = require('worker_threads');
        const { analyzeCode } = require('./secureAnalysisWorker.js');
        
        parentPort.on('message', async ({ code, language, filePath }) => {
          try {
            const result = await analyzeCode(code, language, filePath);
            parentPort.postMessage({ success: true, result });
          } catch (error) {
            parentPort.postMessage({ success: false, error: error.message });
          }
        });
      `, { eval: true });

      // Set resource limits
      const timeout = setTimeout(() => {
        worker.terminate();
        reject(new SecurityError('Analysis timeout'));
      }, this.timeout);

      worker.on('message', ({ success, result, error }) => {
        clearTimeout(timeout);
        worker.terminate();
        
        if (success) {
          resolve(result);
        } else {
          reject(new SecurityError(error));
        }
      });

      worker.on('error', (error) => {
        clearTimeout(timeout);
        worker.terminate();
        reject(new SecurityError(`Worker error: ${error.message}`));
      });

      worker.postMessage({ code, language, filePath });
    });
  }

  async analyzeInSandbox(code, language, filePath) {
    const sandbox = this.createSecureSandbox();
    
    try {
      const script = new vm.Script(`
        (function() {
          ${this.getAnalysisCode(language)}
          return analyzeCode(code, filePath);
        })();
      `);

      const result = script.runInContext(sandbox, {
        timeout: this.timeout,
        breakOnSigint: true
      });

      return result;
    } catch (error) {
      throw new SecurityError(`Sandboxed analysis failed: ${error.message}`);
    }
  }

  createSecureSandbox() {
    const sandbox = {
      // Minimal safe globals
      Object: Object,
      Array: Array,
      String: String,
      Number: Number,
      Boolean: Boolean,
      Date: Date,
      Math: Math,
      JSON: JSON,
      
      // Safe utilities
      console: {
        log: () => {}, // Disable console output
        error: () => {},
        warn: () => {}
      },
      
      // Analysis-specific globals
      code: '',
      filePath: '',
      
      // Blocked globals
      require: undefined,
      process: undefined,
      global: undefined,
      Buffer: undefined,
      setTimeout: undefined,
      setInterval: undefined,
      clearTimeout: undefined,
      clearInterval: undefined
    };

    return vm.createContext(sandbox);
  }
}
```

---

## Database Security

### Query Security

```javascript
/**
 * CONTEXT: Secure database query system
 * REASON: Prevent SQL injection and ensure query safety
 * CHANGE: Parameterized queries with validation and monitoring
 * PREVENTION: Database compromise and data corruption
 */

export class SecureQueryExecutor {
  constructor(kuzuClient) {
    this.kuzu = kuzuClient;
    this.queryValidator = new QueryValidator();
    this.auditLogger = new AuditLogger();
  }

  async executeSecureQuery(query, parameters = {}, context = {}) {
    try {
      // Validate query structure
      this.queryValidator.validateQuery(query);
      
      // Validate parameters
      this.queryValidator.validateParameters(parameters);
      
      // Check permissions (if applicable)
      await this.checkQueryPermissions(query, context);
      
      // Log query for audit
      this.auditLogger.logQuery(query, parameters, context);
      
      // Execute with timeout and monitoring
      return await this.executeWithSafeguards(query, parameters);
      
    } catch (error) {
      this.auditLogger.logQueryError(query, parameters, error, context);
      throw error;
    }
  }

  async executeWithSafeguards(query, parameters) {
    const startTime = Date.now();
    
    try {
      // Set query timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Query timeout')), 30000);
      });
      
      // Execute query with timeout
      const queryPromise = this.kuzu.query(query, parameters);
      const result = await Promise.race([queryPromise, timeoutPromise]);
      
      // Log successful execution
      const duration = Date.now() - startTime;
      this.auditLogger.logQuerySuccess(query, duration, result.length);
      
      return result;
      
    } catch (error) {
      const duration = Date.now() - startTime;
      this.auditLogger.logQueryFailure(query, duration, error);
      throw error;
    }
  }

  async checkQueryPermissions(query, context) {
    // Basic query pattern analysis
    const queryType = this.analyzeQueryType(query);
    
    // Check if destructive operations are allowed
    if (queryType.isDestructive && !context.allowDestructive) {
      throw new SecurityError('Destructive operations not allowed in this context');
    }
    
    // Check resource limits
    if (queryType.complexity > 100) {
      throw new SecurityError('Query complexity exceeds allowed limits');
    }
  }

  analyzeQueryType(query) {
    const normalizedQuery = query.toUpperCase().trim();
    
    return {
      isDestructive: /\b(DELETE|DROP|REMOVE)\b/.test(normalizedQuery),
      isModifying: /\b(CREATE|SET|MERGE|DELETE)\b/.test(normalizedQuery),
      isReading: /\b(MATCH|RETURN|WHERE)\b/.test(normalizedQuery),
      complexity: this.calculateQueryComplexity(query)
    };
  }

  calculateQueryComplexity(query) {
    let complexity = 0;
    
    // Count pattern matching complexity
    const matchCount = (query.match(/MATCH/gi) || []).length;
    complexity += matchCount * 10;
    
    // Count relationship traversals
    const relationshipCount = (query.match(/-\[.*?\]->/g) || []).length;
    complexity += relationshipCount * 5;
    
    // Count nested queries
    const nestedCount = (query.match(/\{[^}]*MATCH/gi) || []).length;
    complexity += nestedCount * 20;
    
    return complexity;
  }
}

class QueryValidator {
  validateQuery(query) {
    if (typeof query !== 'string') {
      throw new SecurityError('Query must be a string');
    }

    if (query.length > 10000) {
      throw new SecurityError('Query too long');
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      /;\s*DROP/i,
      /;\s*DELETE/i,
      /;\s*EXEC/i,
      /;\s*EXECUTE/i,
      /UNION.*SELECT/i,
      /\/\*.*\*\//s,  // Comments (potential for injection)
      /--.*$/m,       // Comments
      /'.*OR.*'.*=/i,  // SQL injection patterns
      /".*OR.*".*=/i
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(query)) {
        throw new SecurityError(`Dangerous query pattern detected: ${pattern}`);
      }
    }
  }

  validateParameters(parameters) {
    if (typeof parameters !== 'object' || parameters === null) {
      throw new SecurityError('Parameters must be an object');
    }

    // Check parameter count
    if (Object.keys(parameters).length > 100) {
      throw new SecurityError('Too many parameters');
    }

    // Validate each parameter
    for (const [key, value] of Object.entries(parameters)) {
      this.validateParameter(key, value);
    }
  }

  validateParameter(key, value) {
    // Validate parameter name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
      throw new SecurityError(`Invalid parameter name: ${key}`);
    }

    // Validate parameter value
    if (value === null || value === undefined) {
      return; // Allow null/undefined
    }

    const type = typeof value;
    if (!['string', 'number', 'boolean'].includes(type) && !Array.isArray(value)) {
      throw new SecurityError(`Invalid parameter type: ${type}`);
    }

    if (type === 'string' && value.length > 10000) {
      throw new SecurityError(`Parameter value too long: ${key}`);
    }

    if (Array.isArray(value) && value.length > 1000) {
      throw new SecurityError(`Parameter array too long: ${key}`);
    }
  }
}
```

### Data Encryption

```javascript
/**
 * CONTEXT: Data encryption for sensitive information
 * REASON: Protect sensitive code patterns and architectural decisions
 * CHANGE: Transparent encryption for sensitive fields
 * PREVENTION: Data exposure and unauthorized access
 */

import crypto from 'crypto';

export class DataEncryption {
  constructor(encryptionKey) {
    this.algorithm = 'aes-256-gcm';
    this.key = this.deriveKey(encryptionKey);
  }

  deriveKey(password) {
    return crypto.scryptSync(password, 'salt', 32);
  }

  encrypt(text) {
    if (!text || typeof text !== 'string') {
      return text;
    }

    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(this.algorithm, this.key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  decrypt(encryptedData) {
    if (!encryptedData || typeof encryptedData !== 'object') {
      return encryptedData;
    }

    const { encrypted, iv, authTag } = encryptedData;
    const decipher = crypto.createDecipher(this.algorithm, this.key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(authTag, 'hex'));
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  }

  encryptSensitiveFields(entity) {
    const sensitiveFields = ['context', 'reason', 'change', 'prevention'];
    const encrypted = { ...entity };

    for (const field of sensitiveFields) {
      if (encrypted[field]) {
        encrypted[field] = this.encrypt(encrypted[field]);
      }
    }

    return encrypted;
  }

  decryptSensitiveFields(entity) {
    const sensitiveFields = ['context', 'reason', 'change', 'prevention'];
    const decrypted = { ...entity };

    for (const field of sensitiveFields) {
      if (decrypted[field] && typeof decrypted[field] === 'object') {
        decrypted[field] = this.decrypt(decrypted[field]);
      }
    }

    return decrypted;
  }
}
```

---

## Network Security

### Secure MCP Communication

```javascript
/**
 * CONTEXT: Secure MCP protocol communication
 * REASON: Ensure secure communication between Claude Desktop and MCP server
 * CHANGE: Added security layers for MCP transport
 * PREVENTION: Man-in-the-middle attacks and data interception
 */

export class SecureMCPTransport {
  constructor(options = {}) {
    this.encryptionEnabled = options.encryption || false;
    this.compressionEnabled = options.compression || false;
    this.rateLimiter = new RateLimiter(options.rateLimit);
  }

  async processRequest(request, context = {}) {
    try {
      // Rate limiting
      await this.rateLimiter.checkLimit(context.clientId);
      
      // Request validation
      this.validateRequest(request);
      
      // Decrypt if needed
      if (this.encryptionEnabled) {
        request = this.decryptRequest(request);
      }
      
      // Security headers validation
      this.validateSecurityHeaders(request, context);
      
      return request;
      
    } catch (error) {
      throw new SecurityError(`Request processing failed: ${error.message}`);
    }
  }

  validateRequest(request) {
    // Basic request structure validation
    if (!request || typeof request !== 'object') {
      throw new SecurityError('Invalid request structure');
    }

    // Check required fields
    if (!request.method || !request.params) {
      throw new SecurityError('Missing required request fields');
    }

    // Validate method name
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(request.method)) {
      throw new SecurityError('Invalid method name');
    }

    // Check request size
    const requestSize = JSON.stringify(request).length;
    if (requestSize > 1000000) { // 1MB limit
      throw new SecurityError('Request too large');
    }
  }

  validateSecurityHeaders(request, context) {
    // Validate origin if provided
    if (context.origin && !this.isAllowedOrigin(context.origin)) {
      throw new SecurityError('Invalid origin');
    }

    // Check for security headers
    if (context.headers) {
      this.validateHeaders(context.headers);
    }
  }

  isAllowedOrigin(origin) {
    const allowedOrigins = [
      'claude-desktop://local',
      'https://claude.ai',
      'http://localhost' // For development
    ];

    return allowedOrigins.some(allowed => origin.startsWith(allowed));
  }

  validateHeaders(headers) {
    // Check for suspicious headers
    const suspiciousHeaders = [
      'x-forwarded-for',
      'x-real-ip',
      'x-originating-ip'
    ];

    for (const header of suspiciousHeaders) {
      if (headers[header]) {
        console.warn(`Suspicious header detected: ${header}`);
      }
    }
  }
}

class RateLimiter {
  constructor(options = {}) {
    this.maxRequests = options.maxRequests || 100;
    this.timeWindow = options.timeWindow || 60000; // 1 minute
    this.clients = new Map();
  }

  async checkLimit(clientId = 'default') {
    const now = Date.now();
    const client = this.clients.get(clientId) || { requests: [], blocked: false };

    // Clean old requests
    client.requests = client.requests.filter(time => now - time < this.timeWindow);

    // Check if client is blocked
    if (client.blocked && now - client.blockedAt < this.timeWindow) {
      throw new SecurityError('Rate limit exceeded, client temporarily blocked');
    }

    // Check request count
    if (client.requests.length >= this.maxRequests) {
      client.blocked = true;
      client.blockedAt = now;
      this.clients.set(clientId, client);
      throw new SecurityError('Rate limit exceeded');
    }

    // Add current request
    client.requests.push(now);
    client.blocked = false;
    this.clients.set(clientId, client);
  }
}
```

---

## Access Control

### Role-Based Access Control (Future Enhancement)

```javascript
/**
 * CONTEXT: Role-based access control system
 * REASON: Control access to sensitive operations and data
 * CHANGE: Granular permissions for different user roles
 * PREVENTION: Unauthorized access and privilege escalation
 */

export class AccessControl {
  constructor() {
    this.roles = new Map();
    this.permissions = new Map();
    this.setupDefaultRoles();
  }

  setupDefaultRoles() {
    // Define default roles and permissions
    this.defineRole('viewer', [
      'query_context_for_task',
      'get_kg_statistics',
      'extract_context_from_code'
    ]);

    this.defineRole('developer', [
      'query_context_for_task',
      'get_kg_statistics',
      'extract_context_from_code',
      'generate_code_with_context',
      'validate_against_kg',
      'detect_technical_debt',
      'suggest_refactoring'
    ]);

    this.defineRole('architect', [
      'query_context_for_task',
      'get_kg_statistics',
      'extract_context_from_code',
      'generate_code_with_context',
      'validate_against_kg',
      'detect_technical_debt',
      'suggest_refactoring',
      'define_domain_ontology',
      'update_kg_from_code'
    ]);

    this.defineRole('admin', [
      '*' // All permissions
    ]);
  }

  defineRole(roleName, permissions) {
    this.roles.set(roleName, {
      name: roleName,
      permissions: new Set(permissions),
      created: Date.now()
    });
  }

  async checkPermission(user, tool, context = {}) {
    try {
      // Get user role
      const userRole = await this.getUserRole(user);
      const role = this.roles.get(userRole);

      if (!role) {
        throw new SecurityError(`Unknown role: ${userRole}`);
      }

      // Check permissions
      if (role.permissions.has('*') || role.permissions.has(tool)) {
        return true;
      }

      // Check context-specific permissions
      if (await this.checkContextPermission(user, tool, context)) {
        return true;
      }

      throw new SecurityError(`Access denied for tool: ${tool}`);

    } catch (error) {
      this.logAccessAttempt(user, tool, false, error.message);
      throw error;
    }
  }

  async getUserRole(user) {
    // In a real implementation, this would query a user database
    // For now, return a default role
    return user.role || 'developer';
  }

  async checkContextPermission(user, tool, context) {
    // Context-specific permission logic
    // For example, users might have access to certain projects only
    
    if (context.projectId) {
      return await this.hasProjectAccess(user, context.projectId);
    }

    return false;
  }

  async hasProjectAccess(user, projectId) {
    // Check if user has access to specific project
    // This would typically query a database
    return true; // Placeholder
  }

  logAccessAttempt(user, tool, success, message) {
    console.log({
      timestamp: new Date().toISOString(),
      user: user.id,
      tool,
      success,
      message,
      ip: user.ip
    });
  }
}
```

---

## Audit and Monitoring

### Security Audit Logging

```javascript
/**
 * CONTEXT: Comprehensive security audit logging
 * REASON: Track security events and detect suspicious activity
 * CHANGE: Detailed logging with security focus
 * PREVENTION: Undetected security breaches and compliance violations
 */

export class SecurityAuditLogger {
  constructor() {
    this.auditLog = [];
    this.securityEvents = new Map();
    this.suspiciousPatterns = new SuspiciousActivityDetector();
  }

  logSecurityEvent(event) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      eventId: this.generateEventId(),
      ...event
    };

    this.auditLog.push(auditEntry);
    this.analyzeForSuspiciousActivity(auditEntry);
    this.persistAuditEntry(auditEntry);
  }

  logAuthenticationAttempt(user, success, method, details = {}) {
    this.logSecurityEvent({
      type: 'AUTHENTICATION',
      subtype: success ? 'SUCCESS' : 'FAILURE',
      user: user.id,
      method,
      ip: user.ip,
      userAgent: user.userAgent,
      details
    });
  }

  logToolAccess(user, tool, success, parameters = {}) {
    const sanitizedParams = this.sanitizeParameters(parameters);
    
    this.logSecurityEvent({
      type: 'TOOL_ACCESS',
      subtype: success ? 'SUCCESS' : 'DENIED',
      user: user.id,
      tool,
      ip: user.ip,
      parameters: sanitizedParams
    });
  }

  logDataAccess(user, dataType, operation, entityId, success) {
    this.logSecurityEvent({
      type: 'DATA_ACCESS',
      subtype: operation.toUpperCase(),
      user: user.id,
      dataType,
      entityId,
      success,
      ip: user.ip
    });
  }

  logSecurityViolation(user, violationType, details) {
    this.logSecurityEvent({
      type: 'SECURITY_VIOLATION',
      subtype: violationType,
      user: user.id,
      severity: 'HIGH',
      details,
      ip: user.ip,
      requiresInvestigation: true
    });

    // Immediate alert for security violations
    this.triggerSecurityAlert(user, violationType, details);
  }

  logSystemEvent(eventType, details) {
    this.logSecurityEvent({
      type: 'SYSTEM_EVENT',
      subtype: eventType,
      details,
      automated: true
    });
  }

  sanitizeParameters(parameters) {
    const sanitized = { ...parameters };
    
    // Remove sensitive data from logs
    const sensitiveKeys = ['password', 'token', 'key', 'secret', 'codeSnippet'];
    
    for (const key of sensitiveKeys) {
      if (sanitized[key]) {
        sanitized[key] = '[REDACTED]';
      }
    }

    // Truncate long values
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string' && value.length > 100) {
        sanitized[key] = value.substring(0, 100) + '...[TRUNCATED]';
      }
    }

    return sanitized;
  }

  analyzeForSuspiciousActivity(auditEntry) {
    this.suspiciousPatterns.analyze(auditEntry);
  }

  triggerSecurityAlert(user, violationType, details) {
    console.error('SECURITY ALERT', {
      timestamp: new Date().toISOString(),
      user: user.id,
      violationType,
      details,
      severity: 'CRITICAL'
    });

    // In production, this would integrate with alerting systems
    // this.alertingService.sendAlert(alert);
  }

  generateEventId() {
    return crypto.randomBytes(16).toString('hex');
  }

  async persistAuditEntry(entry) {
    // In production, persist to secure audit database
    // For now, just ensure it's in memory
    
    // Keep only last 10000 entries in memory
    if (this.auditLog.length > 10000) {
      this.auditLog.shift();
    }
  }

  getAuditReport(timeRange = '24h', eventTypes = []) {
    const cutoff = this.getTimeRangeCutoff(timeRange);
    
    let filteredEntries = this.auditLog.filter(entry => 
      new Date(entry.timestamp) > cutoff
    );

    if (eventTypes.length > 0) {
      filteredEntries = filteredEntries.filter(entry =>
        eventTypes.includes(entry.type)
      );
    }

    return {
      totalEvents: filteredEntries.length,
      events: filteredEntries,
      summary: this.generateSummary(filteredEntries),
      securityAlerts: this.getSecurityAlerts(filteredEntries)
    };
  }

  getTimeRangeCutoff(timeRange) {
    const now = new Date();
    const cutoffs = {
      '1h': new Date(now.getTime() - 60 * 60 * 1000),
      '24h': new Date(now.getTime() - 24 * 60 * 60 * 1000),
      '7d': new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
      '30d': new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    };

    return cutoffs[timeRange] || cutoffs['24h'];
  }
}

class SuspiciousActivityDetector {
  constructor() {
    this.userActivity = new Map();
    this.thresholds = {
      maxFailedAttempts: 5,
      maxToolCallsPerMinute: 20,
      suspiciousToolPatterns: ['analyze_codebase', 'update_kg_from_code']
    };
  }

  analyze(auditEntry) {
    if (auditEntry.type === 'AUTHENTICATION' && auditEntry.subtype === 'FAILURE') {
      this.trackFailedAuthentication(auditEntry);
    }

    if (auditEntry.type === 'TOOL_ACCESS') {
      this.trackToolUsage(auditEntry);
    }

    if (auditEntry.type === 'SECURITY_VIOLATION') {
      this.trackSecurityViolation(auditEntry);
    }
  }

  trackFailedAuthentication(entry) {
    const key = `auth_failures_${entry.user}_${entry.ip}`;
    const failures = this.userActivity.get(key) || [];
    
    failures.push(entry.timestamp);
    
    // Keep only recent failures (last hour)
    const recentFailures = failures.filter(timestamp =>
      new Date() - new Date(timestamp) < 60 * 60 * 1000
    );

    if (recentFailures.length >= this.thresholds.maxFailedAttempts) {
      this.flagSuspiciousActivity('MULTIPLE_FAILED_LOGINS', entry);
    }

    this.userActivity.set(key, recentFailures);
  }

  trackToolUsage(entry) {
    const key = `tool_usage_${entry.user}`;
    const usage = this.userActivity.get(key) || [];
    
    usage.push(entry.timestamp);
    
    // Keep only recent usage (last minute)
    const recentUsage = usage.filter(timestamp =>
      new Date() - new Date(timestamp) < 60 * 1000
    );

    if (recentUsage.length >= this.thresholds.maxToolCallsPerMinute) {
      this.flagSuspiciousActivity('HIGH_TOOL_USAGE', entry);
    }

    this.userActivity.set(key, recentUsage);
  }

  flagSuspiciousActivity(activityType, entry) {
    console.warn('SUSPICIOUS ACTIVITY DETECTED', {
      activityType,
      user: entry.user,
      timestamp: entry.timestamp,
      ip: entry.ip
    });
  }
}
```

---

## Secure Configuration

### Production Security Configuration

```json
{
  "security": {
    "encryption": {
      "enabled": true,
      "algorithm": "aes-256-gcm",
      "keyRotationInterval": 2592000000
    },
    "authentication": {
      "enabled": true,
      "method": "token",
      "tokenExpiry": 3600000,
      "maxFailedAttempts": 5,
      "lockoutDuration": 900000
    },
    "validation": {
      "strictMode": true,
      "enableSecurityAnalysis": true,
      "maxInputSize": 1000000,
      "enableRateLimiting": true,
      "rateLimits": {
        "maxRequestsPerMinute": 60,
        "maxRequestsPerHour": 1000
      }
    },
    "audit": {
      "enableLogging": true,
      "logLevel": "INFO",
      "retentionPeriod": 2592000000,
      "realTimeMonitoring": true
    },
    "database": {
      "encryption": true,
      "accessControl": true,
      "auditQueries": true,
      "queryTimeout": 30000
    },
    "network": {
      "allowedOrigins": ["claude-desktop://local"],
      "enableCompression": false,
      "maxRequestSize": 10485760
    }
  }
}
```

### Environment Variables for Security

```bash
# Encryption keys (use strong, randomly generated keys)
ENCRYPTION_KEY="your-secure-encryption-key-here"
JWT_SECRET="your-jwt-secret-here"

# Security settings
SECURITY_STRICT_MODE=true
SECURITY_ENABLE_AUDIT=true
SECURITY_RATE_LIMITING=true

# Database security
DB_ENCRYPTION_ENABLED=true
DB_AUDIT_QUERIES=true

# Network security
ALLOWED_ORIGINS="claude-desktop://local,https://claude.ai"
MAX_REQUEST_SIZE=10485760

# Monitoring
SECURITY_MONITORING=true
ALERT_WEBHOOK_URL="https://your-monitoring-system.com/alerts"
```

---

## Incident Response

### Security Incident Response Plan

```javascript
/**
 * CONTEXT: Security incident response system
 * REASON: Rapid response to security threats and breaches
 * CHANGE: Automated incident detection and response procedures
 * PREVENTION: Security breach escalation and data compromise
 */

export class IncidentResponseSystem {
  constructor() {
    this.incidentTypes = {
      AUTHENTICATION_BREACH: 'critical',
      CODE_INJECTION: 'critical',
      DATA_EXFILTRATION: 'critical',
      PRIVILEGE_ESCALATION: 'high',
      SUSPICIOUS_ACTIVITY: 'medium',
      RATE_LIMIT_VIOLATION: 'low'
    };

    this.activeIncidents = new Map();
    this.responseTeam = new NotificationService();
  }

  async handleSecurityIncident(incidentType, details, context = {}) {
    try {
      const incident = this.createIncident(incidentType, details, context);
      
      // Immediate containment actions
      await this.containThreat(incident);
      
      // Notification and escalation
      await this.notifyResponseTeam(incident);
      
      // Evidence collection
      await this.collectEvidence(incident);
      
      // Automated response actions
      await this.executeAutomatedResponse(incident);
      
      return incident;
      
    } catch (error) {
      console.error('Incident response failed:', error);
      throw error;
    }
  }

  createIncident(type, details, context) {
    const incident = {
      id: this.generateIncidentId(),
      type,
      severity: this.incidentTypes[type] || 'medium',
      status: 'active',
      createdAt: new Date().toISOString(),
      details,
      context,
      timeline: [],
      evidence: [],
      actions: []
    };

    this.activeIncidents.set(incident.id, incident);
    this.logIncidentEvent(incident, 'CREATED');
    
    return incident;
  }

  async containThreat(incident) {
    const containmentActions = [];

    switch (incident.type) {
      case 'AUTHENTICATION_BREACH':
        containmentActions.push(
          this.blockUser(incident.context.userId),
          this.invalidateUserSessions(incident.context.userId),
          this.alertAdministrators(incident)
        );
        break;

      case 'CODE_INJECTION':
        containmentActions.push(
          this.blockIP(incident.context.ip),
          this.pauseCodeAnalysis(),
          this.quarantineInput(incident.details.input)
        );
        break;

      case 'SUSPICIOUS_ACTIVITY':
        containmentActions.push(
          this.increaseMonitoring(incident.context.userId),
          this.requireAdditionalValidation(incident.context.userId)
        );
        break;
    }

    await Promise.all(containmentActions);
    this.logIncidentEvent(incident, 'CONTAINED');
  }

  async blockUser(userId) {
    // Implement user blocking logic
    console.log(`Blocking user: ${userId}`);
    return { action: 'block_user', userId, timestamp: new Date().toISOString() };
  }

  async blockIP(ip) {
    // Implement IP blocking logic
    console.log(`Blocking IP: ${ip}`);
    return { action: 'block_ip', ip, timestamp: new Date().toISOString() };
  }

  async collectEvidence(incident) {
    const evidence = [];

    // Collect relevant logs
    const logs = await this.getRelevantLogs(incident);
    evidence.push({ type: 'logs', data: logs });

    // Collect system state
    const systemState = await this.captureSystemState();
    evidence.push({ type: 'system_state', data: systemState });

    // Collect network data
    if (incident.context.ip) {
      const networkData = await this.getNetworkData(incident.context.ip);
      evidence.push({ type: 'network', data: networkData });
    }

    incident.evidence = evidence;
    this.logIncidentEvent(incident, 'EVIDENCE_COLLECTED');
  }

  async getRelevantLogs(incident) {
    // Collect logs from the time period around the incident
    const timeWindow = 30 * 60 * 1000; // 30 minutes
    const incidentTime = new Date(incident.createdAt);
    
    const startTime = new Date(incidentTime.getTime() - timeWindow);
    const endTime = new Date(incidentTime.getTime() + timeWindow);

    // This would query your logging system
    return {
      timeRange: { start: startTime, end: endTime },
      auditLogs: [], // Filtered audit logs
      errorLogs: [], // Filtered error logs
      securityLogs: [] // Filtered security logs
    };
  }

  generateIncidentId() {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `INC-${timestamp}-${random}`.toUpperCase();
  }

  logIncidentEvent(incident, eventType) {
    const event = {
      timestamp: new Date().toISOString(),
      type: eventType,
      incidentId: incident.id
    };

    incident.timeline.push(event);
    console.log('Incident Event:', event);
  }
}
```

### Recovery Procedures

```javascript
export class SecurityRecoveryProcedures {
  async recoverFromIncident(incident) {
    switch (incident.type) {
      case 'CODE_INJECTION':
        return await this.recoverFromCodeInjection(incident);
      
      case 'DATA_BREACH':
        return await this.recoverFromDataBreach(incident);
      
      case 'AUTHENTICATION_BREACH':
        return await this.recoverFromAuthBreach(incident);
      
      default:
        return await this.genericRecovery(incident);
    }
  }

  async recoverFromCodeInjection(incident) {
    // 1. Restore from clean backup
    await this.restoreFromBackup();
    
    // 2. Update security patches
    await this.updateSecurityPatches();
    
    // 3. Strengthen validation
    await this.strengthenValidation();
    
    // 4. Verify system integrity
    await this.verifySystemIntegrity();
    
    return { status: 'recovered', actions: ['backup_restore', 'security_update'] };
  }

  async verifySystemIntegrity() {
    // Check file integrity
    const integrityCheck = await this.checkFileIntegrity();
    
    // Verify database consistency
    const dbCheck = await this.checkDatabaseConsistency();
    
    // Test security controls
    const securityCheck = await this.testSecurityControls();
    
    return {
      fileIntegrity: integrityCheck,
      databaseIntegrity: dbCheck,
      securityControls: securityCheck
    };
  }
}
```

---

## Security Best Practices Summary

### Development Security Checklist

- [ ] **Input Validation**: All inputs validated and sanitized
- [ ] **Output Encoding**: All outputs properly encoded
- [ ] **Authentication**: Strong authentication mechanisms
- [ ] **Authorization**: Proper access controls implemented
- [ ] **Encryption**: Sensitive data encrypted at rest and in transit
- [ ] **Logging**: Comprehensive security audit logging
- [ ] **Error Handling**: Secure error handling without information disclosure
- [ ] **Dependencies**: Regular security updates for dependencies
- [ ] **Configuration**: Secure default configurations
- [ ] **Testing**: Regular security testing and penetration testing

### Deployment Security Checklist

- [ ] **Environment Separation**: Clear separation between dev/staging/prod
- [ ] **Secret Management**: Secure storage and rotation of secrets
- [ ] **Network Security**: Proper firewall and network controls
- [ ] **Monitoring**: Real-time security monitoring and alerting
- [ ] **Backup Security**: Secure backup procedures and testing
- [ ] **Incident Response**: Tested incident response procedures
- [ ] **Compliance**: Meeting relevant security compliance requirements
- [ ] **Documentation**: Up-to-date security documentation

### Ongoing Security Maintenance

- [ ] **Regular Updates**: Keep all dependencies and systems updated
- [ ] **Security Reviews**: Regular code and configuration reviews
- [ ] **Penetration Testing**: Regular security assessments
- [ ] **Training**: Security training for development team
- [ ] **Monitoring**: Continuous security monitoring and improvement
- [ ] **Incident Learning**: Learn from incidents and improve procedures

By following this security guide, you can ensure that your MCP Vibe Coding Knowledge Graph system maintains a strong security posture while providing valuable functionality to users. Remember that security is an ongoing process that requires continuous attention and improvement.