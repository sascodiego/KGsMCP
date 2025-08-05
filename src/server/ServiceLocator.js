/**
 * CONTEXT: Service locator pattern for dependency management
 * REASON: Eliminate dependency injection complexity and centralize service management
 * CHANGE: Create service registry for loose coupling between components
 * PREVENTION: Removes nested dependency passing and simplifies constructor parameters
 */

import { logger } from '../utils/logger.js';

export class ServiceLocator {
  constructor() {
    this.services = new Map();
    this.singletons = new Map();
    this.factories = new Map();
    this.initialized = false;
  }

  /**
   * Initialize the service locator
   */
  initialize() {
    if (this.initialized) {
      logger.warn('Service locator already initialized');
      return;
    }

    this.initialized = true;
    logger.info('Service locator initialized');
  }

  /**
   * Register a service instance
   */
  registerInstance(name, instance) {
    this.validateServiceName(name);
    this.services.set(name, instance);
    logger.debug(`Service instance registered: ${name}`);
  }

  /**
   * Register a singleton factory
   */
  registerSingleton(name, factory) {
    this.validateServiceName(name);
    this.validateFactory(factory);
    
    this.singletons.set(name, { factory, instance: null });
    logger.debug(`Singleton factory registered: ${name}`);
  }

  /**
   * Register a transient factory
   */
  registerTransient(name, factory) {
    this.validateServiceName(name);
    this.validateFactory(factory);
    
    this.factories.set(name, factory);
    logger.debug(`Transient factory registered: ${name}`);
  }

  /**
   * Get a service using strategy pattern for different service types
   */
  get(name) {
    this.validateServiceName(name);

    // Strategy pattern for service resolution
    const resolutionStrategies = {
      instance: () => this.resolveInstance(name),
      singleton: () => this.resolveSingleton(name),
      transient: () => this.resolveTransient(name)
    };

    // Determine service type and resolve using appropriate strategy
    const serviceType = this.getServiceType(name);
    const resolver = resolutionStrategies[serviceType];
    
    if (!resolver) {
      throw new Error(`Service not found: ${name}`);
    }

    return resolver();
  }

  /**
   * Determine service type using guard clauses
   */
  getServiceType(name) {
    if (this.services.has(name)) {
      return 'instance';
    }
    
    if (this.singletons.has(name)) {
      return 'singleton';
    }
    
    if (this.factories.has(name)) {
      return 'transient';
    }
    
    return null;
  }

  /**
   * Resolve service instance
   */
  resolveInstance(name) {
    return this.services.get(name);
  }

  /**
   * Resolve singleton service
   */
  resolveSingleton(name) {
    const singleton = this.singletons.get(name);
    
    // Create instance if it doesn't exist
    if (!singleton.instance) {
      try {
        singleton.instance = singleton.factory(this);
        logger.debug(`Singleton instance created: ${name}`);
      } catch (error) {
        logger.error(`Failed to create singleton ${name}:`, error);
        throw new Error(`Failed to create service: ${name}`);
      }
    }
    
    return singleton.instance;
  }

  /**
   * Resolve transient service
   */
  resolveTransient(name) {
    const factory = this.factories.get(name);
    
    try {
      const instance = factory(this);
      logger.debug(`Transient instance created: ${name}`);
      return instance;
    } catch (error) {
      logger.error(`Failed to create transient ${name}:`, error);
      throw new Error(`Failed to create service: ${name}`);
    }
  }

  /**
   * Check if a service is registered
   */
  has(name) {
    return this.services.has(name) || 
           this.singletons.has(name) || 
           this.factories.has(name);
  }

  /**
   * Get all registered service names
   */
  getServiceNames() {
    const names = new Set();
    
    this.services.forEach((_, name) => names.add(name));
    this.singletons.forEach((_, name) => names.add(name));
    this.factories.forEach((_, name) => names.add(name));
    
    return Array.from(names).sort();
  }

  /**
   * Clear all services (useful for testing)
   */
  clear() {
    this.services.clear();
    this.singletons.clear();
    this.factories.clear();
    this.initialized = false;
    logger.debug('Service locator cleared');
  }

  /**
   * Get service information for debugging
   */
  getServiceInfo(name) {
    const type = this.getServiceType(name);
    
    if (!type) {
      return null;
    }

    const info = { name, type };

    switch (type) {
      case 'instance':
        info.instance = this.services.get(name);
        break;
      case 'singleton':
        const singleton = this.singletons.get(name);
        info.hasInstance = singleton.instance !== null;
        break;
      case 'transient':
        info.factory = this.factories.get(name);
        break;
    }

    return info;
  }

  /**
   * Get all services information
   */
  getAllServicesInfo() {
    const services = [];
    
    for (const name of this.getServiceNames()) {
      services.push(this.getServiceInfo(name));
    }
    
    return services;
  }

  /**
   * Validate service name using early return
   */
  validateServiceName(name) {
    if (!name || typeof name !== 'string') {
      throw new Error('Service name must be a non-empty string');
    }
    
    if (name.trim() !== name) {
      throw new Error('Service name cannot have leading/trailing whitespace');
    }
  }

  /**
   * Validate factory function using early return
   */
  validateFactory(factory) {
    if (typeof factory !== 'function') {
      throw new Error('Factory must be a function');
    }
  }

  /**
   * Create service locator with common MCP services
   */
  static createWithDefaults(config) {
    const locator = new ServiceLocator();
    
    // Register configuration
    locator.registerInstance('config', config);
    
    // Register database as singleton
    locator.registerSingleton('database', (serviceLocator) => {
      const { KuzuClient } = require('../database/kuzuClient.js');
      const config = serviceLocator.get('config');
      return new KuzuClient(config.kuzu);
    });

    // Register validation system as singleton
    locator.registerSingleton('validationSystem', (serviceLocator) => {
      const { ValidationSystem } = require('../validation/index.js');
      const config = serviceLocator.get('config');
      return new ValidationSystem(config.validation);
    });

    // Register optimization manager as singleton
    locator.registerSingleton('optimizationManager', (serviceLocator) => {
      const { OptimizationManager } = require('../optimization/index.js');
      const config = serviceLocator.get('config');
      return new OptimizationManager(config.optimization);
    });

    // Register health monitor as singleton
    locator.registerSingleton('healthMonitor', (serviceLocator) => {
      const { HealthMonitor } = require('./HealthMonitor.js');
      const config = serviceLocator.get('config');
      return new HealthMonitor(config.health);
    });

    // Register tool registry as singleton
    locator.registerSingleton('toolRegistry', (serviceLocator) => {
      const { ToolRegistry } = require('./ToolRegistry.js');
      return new ToolRegistry();
    });

    // Register handlers as singletons
    const handlerFactories = {
      initializationHandler: () => {
        const { InitializationHandler } = require('../handlers/initialization.js');
        return new InitializationHandler(locator);
      },
      contextHandler: () => {
        const { ContextHandler } = require('../handlers/context.js');
        return new ContextHandler(locator);
      },
      codeGenerationHandler: () => {
        const { CodeGenerationHandler } = require('../handlers/codeGeneration.js');
        return new CodeGenerationHandler(locator);
      },
      validationHandler: () => {
        const { ValidationHandler } = require('../handlers/validation.js');
        return new ValidationHandler(locator);
      },
      knowledgeGraphHandler: () => {
        const { KnowledgeGraphHandler } = require('../handlers/knowledgeGraph.js');
        return new KnowledgeGraphHandler(locator);
      },
      arduinoHandler: () => {
        const { ArduinoHandler } = require('../handlers/arduinoHandler.js');
        return new ArduinoHandler(locator);
      }
    };

    for (const [name, factory] of Object.entries(handlerFactories)) {
      locator.registerSingleton(name, factory);
    }

    locator.initialize();
    return locator;
  }

  /**
   * Initialize all registered services
   */
  async initializeServices() {
    const initializationOrder = [
      'database',
      'validationSystem',
      'optimizationManager',
      'healthMonitor',
      'toolRegistry'
    ];

    for (const serviceName of initializationOrder) {
      if (this.has(serviceName)) {
        try {
          const service = this.get(serviceName);
          
          // Initialize service if it has an initialize method
          if (service && typeof service.initialize === 'function') {
            await service.initialize();
            logger.debug(`Service initialized: ${serviceName}`);
          }
        } catch (error) {
          logger.error(`Failed to initialize service ${serviceName}:`, error);
          throw error;
        }
      }
    }

    logger.info('All services initialized successfully');
  }

  /**
   * Cleanup all services
   */
  async cleanup() {
    const cleanupOrder = [
      'healthMonitor',
      'optimizationManager',
      'validationSystem',
      'database'
    ];

    for (const serviceName of cleanupOrder) {
      if (this.has(serviceName)) {
        try {
          const service = this.get(serviceName);
          
          // Cleanup service if it has a cleanup/close method
          if (service) {
            if (typeof service.cleanup === 'function') {
              await service.cleanup();
            } else if (typeof service.close === 'function') {
              await service.close();
            } else if (typeof service.stop === 'function') {
              await service.stop();
            }
            
            logger.debug(`Service cleaned up: ${serviceName}`);
          }
        } catch (error) {
          logger.error(`Failed to cleanup service ${serviceName}:`, error);
        }
      }
    }

    this.clear();
    logger.info('Service locator cleanup completed');
  }
}