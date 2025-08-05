import traverse from '@babel/traverse';
import { logger } from '../utils/logger.js';

export class PatternDetector {
  constructor() {
    this.patterns = new Map();
    this.initializePatterns();
  }

  initializePatterns() {
    // Design Pattern Detectors
    this.patterns.set('singleton', {
      name: 'Singleton Pattern',
      detector: this.detectSingleton.bind(this),
      confidence: 0.8
    });

    this.patterns.set('factory', {
      name: 'Factory Pattern',
      detector: this.detectFactory.bind(this),
      confidence: 0.7
    });

    this.patterns.set('observer', {
      name: 'Observer Pattern',
      detector: this.detectObserver.bind(this),
      confidence: 0.6
    });

    this.patterns.set('decorator', {
      name: 'Decorator Pattern',
      detector: this.detectDecorator.bind(this),
      confidence: 0.5
    });

    this.patterns.set('strategy', {
      name: 'Strategy Pattern',
      detector: this.detectStrategy.bind(this),
      confidence: 0.6
    });

    // Architectural Patterns
    this.patterns.set('mvc', {
      name: 'MVC Pattern',
      detector: this.detectMVC.bind(this),
      confidence: 0.7
    });

    this.patterns.set('repository', {
      name: 'Repository Pattern',
      detector: this.detectRepository.bind(this),
      confidence: 0.8
    });

    // Functional Patterns
    this.patterns.set('higher_order_function', {
      name: 'Higher Order Function',
      detector: this.detectHigherOrderFunction.bind(this),
      confidence: 0.9
    });

    this.patterns.set('currying', {
      name: 'Currying Pattern',
      detector: this.detectCurrying.bind(this),
      confidence: 0.8
    });
  }

  async detectPatterns(content, filePath) {
    try {
      // Parse the content if it's a string
      let ast;
      if (typeof content === 'string') {
        const { parse } = await import('@babel/parser');
        ast = parse(content, {
          sourceType: 'module',
          plugins: ['jsx', 'typescript', 'decorators-legacy'],
          errorRecovery: true
        });
      } else {
        ast = content; // Assume it's already an AST
      }

      const detectedPatterns = [];

      for (const [patternType, pattern] of this.patterns) {
        try {
          const instances = pattern.detector(ast, filePath);
          instances.forEach(instance => {
            detectedPatterns.push({
              type: patternType,
              name: pattern.name,
              confidence: pattern.confidence,
              filePath,
              relatedEntities: instance.relatedEntities || [],
              instances: instance.instances || [instance],
              ...instance
            });
          });
        } catch (error) {
          logger.warn(`Error detecting pattern ${patternType}:`, error.message);
        }
      }

      return detectedPatterns;
    } catch (error) {
      logger.error(`Error in pattern detection for ${filePath}:`, error);
      return [];
    }
  }

  detectPatterns(ast, filePath) {
    const detectedPatterns = [];

    for (const [patternType, pattern] of this.patterns) {
      try {
        const instances = pattern.detector(ast, filePath);
        instances.forEach(instance => {
          detectedPatterns.push({
            type: patternType,
            name: pattern.name,
            confidence: pattern.confidence,
            filePath,
            relatedEntities: instance.relatedEntities || [],
            instances: instance.instances || [instance],
            ...instance
          });
        });
      } catch (error) {
        logger.warn(`Error detecting pattern ${patternType}:`, error.message);
      }
    }

    return detectedPatterns;
  }

  detectSingleton(ast, filePath) {
    const instances = [];

    traverse.default(ast, {
      ClassDeclaration: (path) => {
        const className = path.node.id.name;
        const methods = path.node.body.body.filter(m => m.type === 'MethodDefinition');
        
        const hasGetInstance = methods.some(m => 
          m.key.name === 'getInstance' && m.static
        );
        
        const hasPrivateConstructor = methods.some(m => 
          m.kind === 'constructor' && this.isPrivateMethod(m)
        );
        
        const hasStaticInstance = path.node.body.body.some(m =>
          m.type === 'ClassProperty' && m.static && m.key.name.includes('instance')
        );

        if (hasGetInstance && (hasPrivateConstructor || hasStaticInstance)) {
          instances.push({
            entity: className,
            lineStart: path.node.loc.start.line,
            lineEnd: path.node.loc.end.line,
            evidence: {
              hasGetInstance,
              hasPrivateConstructor,
              hasStaticInstance
            }
          });
        }
      }
    });

    return instances;
  }

  detectFactory(ast, filePath) {
    const instances = [];

    traverse.default(ast, {
      ClassDeclaration: (path) => {
        const className = path.node.id.name;
        const methods = path.node.body.body.filter(m => m.type === 'MethodDefinition');
        
        const factoryMethods = methods.filter(m => {
          const name = m.key.name.toLowerCase();
          return name.includes('create') || 
                 name.includes('make') || 
                 name.includes('build') ||
                 name.includes('factory');
        });

        if (factoryMethods.length > 0) {
          instances.push({
            entity: className,
            lineStart: path.node.loc.start.line,
            lineEnd: path.node.loc.end.line,
            factoryMethods: factoryMethods.map(m => m.key.name),
            evidence: {
              factoryMethodCount: factoryMethods.length
            }
          });
        }
      },

      FunctionDeclaration: (path) => {
        const funcName = path.node.id.name;
        const name = funcName.toLowerCase();
        
        if ((name.includes('create') || name.includes('make') || name.includes('factory')) &&
            this.returnsObject(path)) {
          instances.push({
            entity: funcName,
            lineStart: path.node.loc.start.line,
            lineEnd: path.node.loc.end.line,
            type: 'function_factory',
            evidence: {
              returnsObject: true
            }
          });
        }
      }
    });

    return instances;
  }

  detectObserver(ast, filePath) {
    const instances = [];

    traverse.default(ast, {
      ClassDeclaration: (path) => {
        const className = path.node.id.name;
        const methods = path.node.body.body.filter(m => m.type === 'MethodDefinition');
        
        const hasSubscribe = methods.some(m => 
          m.key.name.toLowerCase().includes('subscribe') ||
          m.key.name.toLowerCase().includes('addeventlistener') ||
          m.key.name.toLowerCase().includes('on')
        );
        
        const hasUnsubscribe = methods.some(m =>
          m.key.name.toLowerCase().includes('unsubscribe') ||
          m.key.name.toLowerCase().includes('removeeventlistener') ||
          m.key.name.toLowerCase().includes('off')
        );
        
        const hasNotify = methods.some(m =>
          m.key.name.toLowerCase().includes('notify') ||
          m.key.name.toLowerCase().includes('emit') ||
          m.key.name.toLowerCase().includes('trigger')
        );

        if (hasSubscribe && (hasUnsubscribe || hasNotify)) {
          instances.push({
            entity: className,
            lineStart: path.node.loc.start.line,
            lineEnd: path.node.loc.end.line,
            evidence: {
              hasSubscribe,
              hasUnsubscribe,
              hasNotify
            }
          });
        }
      }
    });

    return instances;
  }

  detectDecorator(ast, filePath) {
    const instances = [];

    traverse.default(ast, {
      Decorator: (path) => {
        instances.push({
          entity: path.node.expression.name || 'decorator',
          lineStart: path.node.loc.start.line,
          lineEnd: path.node.loc.end.line,
          decoratorName: path.node.expression.name,
          evidence: {
            isDecorator: true
            }
        });
      },

      FunctionDeclaration: (path) => {
        // Higher-order function that wraps another function
        if (this.isDecoratorFunction(path)) {
          instances.push({
            entity: path.node.id.name,
            lineStart: path.node.loc.start.line,
            lineEnd: path.node.loc.end.line,
            type: 'function_decorator',
            evidence: {
              wrapsFunction: true
            }
          });
        }
      }
    });

    return instances;
  }

  detectStrategy(ast, filePath) {
    const instances = [];

    traverse.default(ast, {
      ClassDeclaration: (path) => {
        const className = path.node.id.name;
        
        // Look for strategy-like method names
        const methods = path.node.body.body.filter(m => m.type === 'MethodDefinition');
        const hasSetStrategy = methods.some(m =>
          m.key.name.toLowerCase().includes('strategy') ||
          m.key.name.toLowerCase().includes('algorithm') ||
          m.key.name.toLowerCase().includes('setstrategy')
        );
        
        const hasExecute = methods.some(m =>
          m.key.name.toLowerCase().includes('execute') ||
          m.key.name.toLowerCase().includes('apply') ||
          m.key.name.toLowerCase().includes('run')
        );

        if (hasSetStrategy && hasExecute) {
          instances.push({
            entity: className,
            lineStart: path.node.loc.start.line,
            lineEnd: path.node.loc.end.line,
            evidence: {
              hasSetStrategy,
              hasExecute
            }
          });
        }
      }
    });

    return instances;
  }

  detectMVC(ast, filePath) {
    const instances = [];
    const fileName = filePath.toLowerCase();
    
    // Check if file structure suggests MVC
    if (fileName.includes('controller') || 
        fileName.includes('view') || 
        fileName.includes('model')) {
      
      traverse.default(ast, {
        ClassDeclaration: (path) => {
          const className = path.node.id.name.toLowerCase();
          
          let componentType = 'unknown';
          if (className.includes('controller') || fileName.includes('controller')) {
            componentType = 'controller';
          } else if (className.includes('view') || fileName.includes('view')) {
            componentType = 'view';
          } else if (className.includes('model') || fileName.includes('model')) {
            componentType = 'model';
          }

          if (componentType !== 'unknown') {
            instances.push({
              entity: path.node.id.name,
              lineStart: path.node.loc.start.line,
              lineEnd: path.node.loc.end.line,
              componentType,
              evidence: {
                fileStructure: true,
                namingConvention: true
              }
            });
          }
        }
      });
    }

    return instances;
  }

  detectRepository(ast, filePath) {
    const instances = [];

    traverse.default(ast, {
      ClassDeclaration: (path) => {
        const className = path.node.id.name;
        const methods = path.node.body.body.filter(m => m.type === 'MethodDefinition');
        
        const hasCrudMethods = this.hasCrudMethods(methods);
        const isRepository = className.toLowerCase().includes('repository') ||
                           className.toLowerCase().includes('dao');

        if (hasCrudMethods.count >= 3 || isRepository) {
          instances.push({
            entity: className,
            lineStart: path.node.loc.start.line,
            lineEnd: path.node.loc.end.line,
            evidence: {
              crudMethods: hasCrudMethods.methods,
              isNamedRepository: isRepository
            }
          });
        }
      }
    });

    return instances;
  }

  detectHigherOrderFunction(ast, filePath) {
    const instances = [];

    traverse.default(ast, {
      FunctionDeclaration: (path) => {
        const funcName = path.node.id.name;
        
        if (this.isFunctionReturningFunction(path) || 
            this.takesFunctionAsParameter(path)) {
          
          instances.push({
            entity: funcName,
            lineStart: path.node.loc.start.line,
            lineEnd: path.node.loc.end.line,
            evidence: {
              returnsFunction: this.isFunctionReturningFunction(path),
              takesFunctionParam: this.takesFunctionAsParameter(path)
            }
          });
        }
      }
    });

    return instances;
  }

  detectCurrying(ast, filePath) {
    const instances = [];

    traverse.default(ast, {
      FunctionDeclaration: (path) => {
        if (this.isCurriedFunction(path)) {
          instances.push({
            entity: path.node.id.name,
            lineStart: path.node.loc.start.line,
            lineEnd: path.node.loc.end.line,
            evidence: {
              returnsNestedFunction: true,
              partialApplication: true
            }
          });
        }
      }
    });

    return instances;
  }

  // Helper methods
  isPrivateMethod(method) {
    // Simple heuristic - look for leading underscore or private keyword
    return method.key.name.startsWith('_') || 
           (method.decorators && method.decorators.some(d => 
             d.expression.name === 'private'
           ));
  }

  returnsObject(path) {
    let returnsObject = false;
    
    traverse.default(path.node, {
      ReturnStatement: (returnPath) => {
        if (returnPath.node.argument) {
          const argType = returnPath.node.argument.type;
          if (argType === 'ObjectExpression' || 
              argType === 'NewExpression' ||
              argType === 'CallExpression') {
            returnsObject = true;
          }
        }
      }
    });

    return returnsObject;
  }

  isDecoratorFunction(path) {
    // Check if function takes a function and returns a function
    const takesFunctionParam = this.takesFunctionAsParameter(path);
    const returnsFunction = this.isFunctionReturningFunction(path);
    
    return takesFunctionParam && returnsFunction;
  }

  hasCrudMethods(methods) {
    const crudKeywords = ['create', 'read', 'update', 'delete', 'find', 'save', 'remove', 'get', 'set'];
    const foundMethods = [];
    
    methods.forEach(method => {
      const name = method.key.name.toLowerCase();
      crudKeywords.forEach(keyword => {
        if (name.includes(keyword)) {
          foundMethods.push(method.key.name);
        }
      });
    });

    return {
      count: foundMethods.length,
      methods: [...new Set(foundMethods)]
    };
  }

  isFunctionReturningFunction(path) {
    let returnsFunction = false;
    
    traverse.default(path.node, {
      ReturnStatement: (returnPath) => {
        if (returnPath.node.argument) {
          const argType = returnPath.node.argument.type;
          if (argType === 'FunctionExpression' || 
              argType === 'ArrowFunctionExpression') {
            returnsFunction = true;
          }
        }
      }
    });

    return returnsFunction;
  }

  takesFunctionAsParameter(path) {
    return path.node.params.some(param => {
      if (param.type === 'Identifier') {
        const name = param.name.toLowerCase();
        return name.includes('callback') || 
               name.includes('handler') || 
               name.includes('fn') ||
               name.includes('func');
      }
      return false;
    });
  }

  isCurriedFunction(path) {
    // Look for nested function returns that use outer parameters
    let hasNestedReturn = false;
    let usesOuterParams = false;
    
    const outerParams = path.node.params.map(p => p.name);
    
    traverse.default(path.node, {
      ReturnStatement: (returnPath) => {
        if (returnPath.node.argument && 
            (returnPath.node.argument.type === 'FunctionExpression' ||
             returnPath.node.argument.type === 'ArrowFunctionExpression')) {
          hasNestedReturn = true;
          
          // Check if the nested function uses outer parameters
          traverse.default(returnPath.node.argument, {
            Identifier: (idPath) => {
              if (outerParams.includes(idPath.node.name)) {
                usesOuterParams = true;
              }
            }
          });
        }
      }
    });

    return hasNestedReturn && usesOuterParams;
  }

  analyzePatternComplexity(patterns) {
    const complexity = {
      total: patterns.length,
      byType: {},
      averageConfidence: 0,
      recommendations: []
    };

    // Group by pattern type
    patterns.forEach(pattern => {
      if (!complexity.byType[pattern.type]) {
        complexity.byType[pattern.type] = 0;
      }
      complexity.byType[pattern.type]++;
    });

    // Calculate average confidence
    if (patterns.length > 0) {
      complexity.averageConfidence = patterns.reduce((sum, p) => 
        sum + p.confidence, 0) / patterns.length;
    }

    // Generate recommendations
    if (patterns.length > 10) {
      complexity.recommendations.push({
        type: 'pattern_overuse',
        message: 'High number of patterns detected. Consider simplifying architecture.'
      });
    }

    if (complexity.averageConfidence < 0.6) {
      complexity.recommendations.push({
        type: 'low_confidence',
        message: 'Low pattern detection confidence. Manual review recommended.'
      });
    }

    return complexity;
  }
}