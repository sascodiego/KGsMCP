import { logger } from '../utils/logger.js';
import { parse } from '@babel/parser';
import traverse from '@babel/traverse';

export class CodeGenerationHandler {
  constructor(server) {
    this.server = server;
    this.kuzu = server.kuzu;
    
    // Template registry for different types of code generation
    this.templates = {
      class: this.getClassTemplate.bind(this),
      function: this.getFunctionTemplate.bind(this),
      interface: this.getInterfaceTemplate.bind(this),
      test: this.getTestTemplate.bind(this),
      component: this.getComponentTemplate.bind(this)
    };
  }

  async generateWithContext(args) {
    const { requirement, contextIds = [], patternsToApply = [], constraints = {} } = args;
    
    try {
      // Retrieve context from KG
      const contextQuery = `
        MATCH (p:Pattern)
        WHERE p.name IN $patterns
        OPTIONAL MATCH (e:CodeEntity)-[:IMPLEMENTS]->(p)
        WITH p, collect(DISTINCT e) as implementations
        
        OPTIONAL MATCH (r:Rule)
        WHERE toLower(r.description) CONTAINS toLower($keyword)
        WITH p, implementations, collect(DISTINCT r) as rules
        
        RETURN {
          patterns: collect(DISTINCT {
            name: p.name,
            description: p.description,
            implementation: p.implementation,
            examples: [impl IN implementations | {name: impl.name, path: impl.filePath}]
          }),
          rules: [rule IN rules | rule.description]
        } as context
      `;
      
      const keyword = requirement.split(' ')[0];
      const context = await this.kuzu.query(contextQuery, { 
        patterns: patternsToApply, 
        keyword 
      });
      
      // Generate code guidance based on context
      const guidance = this.generateCodeGuidance(requirement, context[0]?.context, constraints);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              requirement,
              guidance,
              context: context[0]?.context || { patterns: [], rules: [] },
              constraints
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error generating code with context:', error);
      throw error;
    }
  }

  async suggestRefactoring(args) {
    const { codeEntity, improvementGoals = [], preserveBehavior = true } = args;
    
    try {
      // Query for refactoring patterns
      const refactoringQuery = `
        MATCH (e:CodeEntity {name: $entityName})
        OPTIONAL MATCH (e)-[:HAS_ISSUE]->(issue:TechnicalDebt)
        WITH e, collect(DISTINCT issue) as issues
        
        // Find applicable refactoring patterns
        MATCH (pattern:RefactoringPattern)
        WHERE any(goal IN $goals WHERE toLower(pattern.solves) CONTAINS toLower(goal))
        
        RETURN {
          entity: {name: e.name, type: e.type, filePath: e.filePath},
          issues: [i IN issues | {type: i.type, description: i.description}],
          suggestions: collect(DISTINCT {
            pattern: pattern.name,
            description: pattern.description,
            steps: pattern.steps,
            preservesBehavior: pattern.preservesBehavior
          })
        } as refactoring
      `;
      
      const result = await this.kuzu.query(refactoringQuery, { 
        entityName: codeEntity, 
        goals: improvementGoals 
      });
      
      const refactoringSuggestions = this.generateRefactoringSuggestions(
        result[0]?.refactoring, 
        improvementGoals, 
        preserveBehavior
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              codeEntity,
              improvementGoals,
              preserveBehavior,
              suggestions: refactoringSuggestions
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error suggesting refactoring:', error);
      throw error;
    }
  }

  generateCodeGuidance(requirement, context, constraints) {
    const guidance = {
      structure: [],
      patterns: [],
      bestPractices: [],
      implementation: []
    };

    // Add structure guidance based on context
    if (context?.patterns?.length > 0) {
      guidance.structure.push(
        "Follow established patterns found in the codebase:",
        ...context.patterns.map(p => `- ${p.name}: ${p.description}`)
      );
    }

    // Add pattern recommendations
    guidance.patterns = context?.patterns?.map(p => ({
      name: p.name,
      description: p.description,
      examples: p.examples
    })) || [];

    // Add best practices from rules
    if (context?.rules?.length > 0) {
      guidance.bestPractices = context.rules;
    }

    // Add implementation guidance
    guidance.implementation = [
      "1. Start with the main interface/contract",
      "2. Implement core functionality following established patterns",
      "3. Add error handling and validation",
      "4. Include comprehensive tests",
      "5. Document with structured comments (AGENT, TRACE, CONTEXT, etc.)"
    ];

    return guidance;
  }

  generateRefactoringSuggestions(refactoringData, goals, preserveBehavior) {
    if (!refactoringData) {
      return {
        suggestions: [],
        message: "No specific refactoring patterns found for this entity"
      };
    }

    const suggestions = refactoringData.suggestions.filter(s => 
      !preserveBehavior || s.preservesBehavior
    );

    return {
      entity: refactoringData.entity,
      issues: refactoringData.issues,
      suggestions: suggestions.map(s => ({
        pattern: s.pattern,
        description: s.description,
        steps: s.steps,
        priority: this.calculatePriority(s, goals, refactoringData.issues)
      })),
      estimatedImpact: this.estimateRefactoringImpact(suggestions, refactoringData.issues)
    };
  }

  calculatePriority(suggestion, goals, issues) {
    let priority = 'medium';
    
    // Higher priority if addresses critical issues
    if (issues.some(i => i.type === 'critical')) {
      priority = 'high';
    }
    
    // Lower priority if no specific goals match
    if (goals.length === 0) {
      priority = 'low';
    }
    
    return priority;
  }

  estimateRefactoringImpact(suggestions, issues) {
    return {
      complexity: suggestions.length > 2 ? 'high' : 'medium',
      riskLevel: issues.some(i => i.type === 'critical') ? 'high' : 'low',
      estimatedEffort: `${suggestions.length * 2}-${suggestions.length * 4} hours`,
      benefits: [
        'Improved code maintainability',
        'Better separation of concerns',
        'Enhanced testability'
      ]
    };
  }

  // New method: Generate code from templates
  async generateFromTemplate(args) {
    const { templateType, name, requirements = {}, language = 'javascript' } = args;
    
    try {
      // Get existing patterns and conventions for this type
      const contextQuery = `
        MATCH (p:Pattern)
        WHERE toLower(p.category) CONTAINS toLower($templateType)
        OPTIONAL MATCH (s:Standard)
        WHERE toLower(s.category) CONTAINS 'naming'
        RETURN {
          patterns: collect(DISTINCT p),
          standards: collect(DISTINCT s)
        } as context
      `;
      
      const context = await this.kuzu.query(contextQuery, { templateType });
      
      // Generate code based on template and context
      const template = this.templates[templateType];
      if (!template) {
        throw new Error(`Template type '${templateType}' not supported`);
      }
      
      const generatedCode = template(name, requirements, context[0]?.context || {}, language);
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              templateType,
              name,
              language,
              generatedCode,
              guidance: this.generateTemplateGuidance(templateType, requirements, context[0]?.context),
              nextSteps: this.generateNextSteps(templateType, name)
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error generating code from template:', error);
      throw error;
    }
  }

  // New method: Analyze existing code and suggest improvements
  async analyzeAndImprove(args) {
    const { codeSnippet, focus = 'all' } = args;
    
    try {
      // Parse the code
      const ast = parse(codeSnippet, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'decorators-legacy']
      });
      
      // Extract characteristics
      const characteristics = this.extractCodeCharacteristics(ast);
      
      // Query for improvement suggestions
      const improvementQuery = `
        MATCH (rule:Rule)
        WHERE rule.category IN ['performance', 'maintainability', 'security']
        OPTIONAL MATCH (pattern:Pattern)
        WHERE pattern.category = 'optimization'
        RETURN {
          rules: collect(DISTINCT rule),
          patterns: collect(DISTINCT pattern)
        } as suggestions
      `;
      
      const suggestions = await this.kuzu.query(improvementQuery);
      
      // Generate improvement recommendations
      const improvements = this.generateImprovements(
        characteristics, 
        suggestions[0]?.suggestions || {}, 
        focus
      );
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              analysis: characteristics,
              improvements: improvements,
              focus: focus,
              estimatedImpact: this.estimateImprovementImpact(improvements)
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error analyzing and improving code:', error);
      throw error;
    }
  }

  // Template methods
  getClassTemplate(name, requirements, context, language) {
    const className = this.formatName(name, 'PascalCase');
    const template = language === 'typescript' ? this.getTypeScriptClassTemplate : this.getJavaScriptClassTemplate;
    
    return template(className, requirements, context);
  }

  getJavaScriptClassTemplate(className, requirements, context) {
    const hasConstructor = requirements.constructor !== false;
    const methods = requirements.methods || [];
    const properties = requirements.properties || [];
    
    return `/**
 * AGENT: Generated class following established patterns
 * CONTEXT: ${className} class implementation
 * REASON: User requested class generation with specific requirements
 * CHANGE: New class implementation
 * PREVENTION: Boilerplate code duplication
 */

class ${className} {${hasConstructor ? `
  constructor(${this.generateConstructorParams(properties)}) {
    ${this.generatePropertyAssignments(properties)}
  }` : ''}
  ${methods.map(method => this.generateMethodTemplate(method)).join('\n  ')}
}

export { ${className} };`;
  }

  getTypeScriptClassTemplate(className, requirements, context) {
    const hasConstructor = requirements.constructor !== false;
    const methods = requirements.methods || [];
    const properties = requirements.properties || [];
    const interfaces = requirements.implements || [];
    
    return `/**
 * AGENT: Generated TypeScript class following established patterns
 * CONTEXT: ${className} class implementation
 * REASON: User requested TypeScript class generation
 * CHANGE: New class implementation with type safety
 * PREVENTION: Type-related errors and boilerplate code
 */

${interfaces.length > 0 ? `interface I${className} {
  ${properties.map(prop => `${prop.name}: ${prop.type || 'any'};`).join('\n  ')}
  ${methods.map(method => `${method.name}(${this.generateMethodParams(method)}): ${method.returnType || 'void'};`).join('\n  ')}
}

` : ''}class ${className}${interfaces.length > 0 ? ` implements I${className}` : ''} {
  ${properties.map(prop => `private ${prop.name}: ${prop.type || 'any'};`).join('\n  ')}
${hasConstructor ? `
  constructor(${this.generateConstructorParams(properties, true)}) {
    ${this.generatePropertyAssignments(properties)}
  }` : ''}
  ${methods.map(method => this.generateMethodTemplate(method, true)).join('\n  ')}
}

export { ${className}${interfaces.length > 0 ? `, I${className}` : ''} };`;
  }

  getFunctionTemplate(name, requirements, context, language) {
    const functionName = this.formatName(name, 'camelCase');
    const isAsync = requirements.async || false;
    const params = requirements.parameters || [];
    const returnType = language === 'typescript' ? (requirements.returnType || 'void') : '';
    const typeAnnotation = language === 'typescript' ? `: ${returnType}` : '';
    
    return `/**
 * AGENT: Generated function following established patterns
 * CONTEXT: ${functionName} function implementation
 * REASON: User requested function generation
 * CHANGE: New function implementation
 * PREVENTION: Boilerplate code and pattern inconsistency
 * 
 * @param {${params.map(p => `${p.type || 'any'} ${p.name}`).join(', ')}}
 * @returns {${returnType || 'void'}}
 */
${isAsync ? 'async ' : ''}function ${functionName}(${this.generateFunctionParams(params, language === 'typescript')})${typeAnnotation} {
  try {
    // TODO: Implement function logic
    ${this.generateFunctionBody(requirements)}
  } catch (error) {
    logger.error('Error in ${functionName}:', error);
    throw error;
  }
}

export { ${functionName} };`;
  }

  getInterfaceTemplate(name, requirements, context, language) {
    if (language !== 'typescript') {
      throw new Error('Interfaces are only supported in TypeScript');
    }
    
    const interfaceName = this.formatName(name, 'PascalCase', 'I');
    const properties = requirements.properties || [];
    const methods = requirements.methods || [];
    
    return `/**
 * AGENT: Generated interface following TypeScript conventions
 * CONTEXT: ${interfaceName} interface definition
 * REASON: User requested interface for type safety
 * CHANGE: New interface definition
 * PREVENTION: Type inconsistencies across implementations
 */

interface ${interfaceName} {
  ${properties.map(prop => `${prop.name}${prop.optional ? '?' : ''}: ${prop.type || 'any'};`).join('\n  ')}
  ${methods.map(method => `${method.name}(${this.generateMethodParams(method)}): ${method.returnType || 'void'};`).join('\n  ')}
}

export { ${interfaceName} };`;
  }

  getTestTemplate(name, requirements, context, language) {
    const testName = this.formatName(name, 'camelCase');
    const framework = requirements.framework || 'jest';
    
    return `/**
 * AGENT: Generated test following established testing patterns
 * CONTEXT: ${testName} test suite
 * REASON: User requested test generation
 * CHANGE: New test implementation
 * PREVENTION: Inconsistent test patterns and missing coverage
 */

import { ${testName} } from './${testName}';

describe('${testName}', () => {
  ${this.generateTestCases(requirements.testCases || [], framework)}
});`;
  }

  getComponentTemplate(name, requirements, context, language) {
    const componentName = this.formatName(name, 'PascalCase');
    const framework = requirements.framework || 'react';
    
    if (framework === 'react') {
      return this.getReactComponentTemplate(componentName, requirements, context, language);
    }
    
    throw new Error(`Framework ${framework} not supported for component generation`);
  }

  getReactComponentTemplate(componentName, requirements, context, language) {
    const isTypeScript = language === 'typescript';
    const hasProps = requirements.props && requirements.props.length > 0;
    const propsInterface = hasProps && isTypeScript ? `I${componentName}Props` : '';
    
    return `/**
 * AGENT: Generated React component following established patterns
 * CONTEXT: ${componentName} React component
 * REASON: User requested React component generation
 * CHANGE: New component implementation
 * PREVENTION: Inconsistent component patterns
 */

import React${hasProps ? ', { FC }' : ''} from 'react';
${requirements.imports ? requirements.imports.map(imp => `import ${imp};`).join('\n') : ''}

${hasProps && isTypeScript ? `interface ${propsInterface} {
  ${requirements.props.map(prop => `${prop.name}${prop.optional ? '?' : ''}: ${prop.type || 'any'};`).join('\n  ')}
}

` : ''}${hasProps && isTypeScript ? `const ${componentName}: FC<${propsInterface}> = (${this.generateComponentProps(requirements.props, true)})` : `function ${componentName}(${this.generateComponentProps(requirements.props || [], false)})`} => {
  return (
    <div className="${this.formatName(componentName, 'kebab-case')}">
      {/* TODO: Implement component UI */}
      <h1>${componentName}</h1>
    </div>
  );
};

export default ${componentName};`;
  }

  // Helper methods
  formatName(name, caseType, prefix = '') {
    const cleanName = name.replace(/[^a-zA-Z0-9]/g, '');
    
    switch (caseType) {
      case 'camelCase':
        return prefix + cleanName.charAt(0).toLowerCase() + cleanName.slice(1);
      case 'PascalCase':
        return prefix + cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
      case 'kebab-case':
        return cleanName.toLowerCase().replace(/([a-z])([A-Z])/g, '$1-$2');
      case 'snake_case':
        return cleanName.toLowerCase().replace(/([a-z])([A-Z])/g, '$1_$2');
      default:
        return prefix + cleanName;
    }
  }

  generateConstructorParams(properties, typed = false) {
    return properties.map(prop => {
      const type = typed && prop.type ? `: ${prop.type}` : '';
      return `${prop.name}${type}`;
    }).join(', ');
  }

  generatePropertyAssignments(properties) {
    return properties.map(prop => `    this.${prop.name} = ${prop.name};`).join('\n');
  }

  generateMethodTemplate(method, typed = false) {
    const params = this.generateMethodParams(method, typed);
    const returnType = typed && method.returnType ? `: ${method.returnType}` : '';
    const asyncModifier = method.async ? 'async ' : '';
    
    return `${asyncModifier}${method.name}(${params})${returnType} {
    // TODO: Implement ${method.name}
    ${method.body || 'throw new Error("Method not implemented");'}
  }`;
  }

  generateMethodParams(method, typed = false) {
    if (!method.parameters) return '';
    
    return method.parameters.map(param => {
      const type = typed && param.type ? `: ${param.type}` : '';
      const optional = param.optional ? '?' : '';
      return `${param.name}${optional}${type}`;
    }).join(', ');
  }

  generateFunctionParams(params, typed = false) {
    return params.map(param => {
      const type = typed && param.type ? `: ${param.type}` : '';
      const optional = param.optional ? '?' : '';
      return `${param.name}${optional}${type}`;
    }).join(', ');
  }

  generateFunctionBody(requirements) {
    if (requirements.body) return requirements.body;
    
    return `// Implementation needed
    throw new Error('Function not implemented');`;
  }

  generateTestCases(testCases, framework) {
    if (testCases.length === 0) {
      return `test('should work correctly', () => {
    // TODO: Implement test
    expect(true).toBe(true);
  });`;
    }
    
    return testCases.map(testCase => 
      `test('${testCase.description}', ${testCase.async ? 'async ' : ''}() => {
    ${testCase.setup || '// Setup'}
    ${testCase.action || '// Action'}
    ${testCase.assertion || '// Assertion'}
  });`
    ).join('\n  ');
  }

  generateComponentProps(props, typed = false) {
    if (props.length === 0) return '';
    
    if (typed) {
      return `{ ${props.map(prop => prop.name).join(', ')} }`;
    } else {
      return `{ ${props.map(prop => prop.name).join(', ')} }`;
    }
  }

  generateTemplateGuidance(templateType, requirements, context) {
    return {
      nextSteps: [
        'Review the generated code for completeness',
        'Implement TODO items marked in the code',
        'Add appropriate error handling',
        'Write comprehensive tests',
        'Update documentation'
      ],
      patterns: context.patterns ? context.patterns.map(p => p.name) : [],
      standards: context.standards ? context.standards.map(s => s.name) : []
    };
  }

  generateNextSteps(templateType, name) {
    const steps = {
      class: [
        'Implement constructor logic',
        'Add method implementations',
        'Create unit tests',
        'Add JSDoc documentation'
      ],
      function: [
        'Implement function logic',
        'Handle edge cases',
        'Add input validation',
        'Create unit tests'
      ],
      interface: [
        'Review interface properties',
        'Implement concrete classes',
        'Update existing code to use interface',
        'Add documentation'
      ],
      test: [
        'Implement test cases',
        'Add edge case testing',
        'Set up test data',
        'Configure CI/CD integration'
      ],
      component: [
        'Implement component logic',
        'Add styling',
        'Create component tests',
        'Add to storybook'
      ]
    };
    
    return steps[templateType] || ['Review generated code', 'Implement missing functionality'];
  }

  extractCodeCharacteristics(ast) {
    const characteristics = {
      functions: [],
      classes: [],
      complexity: 0,
      imports: [],
      exports: []
    };
    
    traverse.default(ast, {
      FunctionDeclaration(path) {
        characteristics.functions.push({
          name: path.node.id ? path.node.id.name : 'anonymous',
          params: path.node.params.length,
          async: path.node.async
        });
      },
      
      ClassDeclaration(path) {
        characteristics.classes.push({
          name: path.node.id.name,
          methods: path.node.body.body.filter(m => m.type === 'MethodDefinition').length
        });
      },
      
      ImportDeclaration(path) {
        characteristics.imports.push({
          source: path.node.source.value,
          specifiers: path.node.specifiers.length
        });
      },
      
      ExportNamedDeclaration(path) {
        characteristics.exports.push('named');
      },
      
      ExportDefaultDeclaration(path) {
        characteristics.exports.push('default');
      }
    });
    
    return characteristics;
  }

  generateImprovements(characteristics, suggestions, focus) {
    const improvements = [];
    
    // Performance improvements
    if (focus === 'all' || focus === 'performance') {
      if (characteristics.functions.length > 10) {
        improvements.push({
          type: 'performance',
          priority: 'medium',
          description: 'Consider breaking down large modules into smaller, focused modules',
          implementation: 'Split functions into separate modules based on functionality'
        });
      }
    }
    
    // Maintainability improvements
    if (focus === 'all' || focus === 'maintainability') {
      if (characteristics.complexity > 15) {
        improvements.push({
          type: 'maintainability',
          priority: 'high',
          description: 'High complexity detected, consider refactoring',
          implementation: 'Extract complex logic into smaller, focused functions'
        });
      }
    }
    
    return improvements;
  }

  estimateImprovementImpact(improvements) {
    const highPriority = improvements.filter(i => i.priority === 'high').length;
    const mediumPriority = improvements.filter(i => i.priority === 'medium').length;
    
    return {
      totalImprovements: improvements.length,
      estimatedEffort: `${improvements.length * 1}-${improvements.length * 3} hours`,
      risk: highPriority > 2 ? 'high' : 'low',
      benefits: [
        'Improved code quality',
        'Better maintainability',
        'Enhanced performance',
        'Reduced technical debt'
      ]
    };
  }
}