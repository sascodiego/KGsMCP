import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

const execAsync = promisify(exec);

export class CppAnalyzer {
  constructor(config) {
    this.config = config;
    this.arduinoPatterns = {
      setup: /void\s+setup\s*\(\s*\)/,
      loop: /void\s+loop\s*\(\s*\)/,
      interrupt: /ISR\s*\(/,
      attachInterrupt: /attachInterrupt\s*\(/,
      pinMode: /pinMode\s*\(/,
      digitalRead: /digital(Read|Write)\s*\(/,
      analogRead: /analog(Read|Write)\s*\(/,
      serial: /Serial\.(begin|print|println|read|available)/,
      timer: /(Timer|timer)\d+/,
      pwm: /analogWrite\s*\(/,
      i2c: /(Wire\.|I2C)/,
      spi: /(SPI\.|spi)/,
      eeprom: /EEPROM\./,
      servo: /Servo/,
      softwareSerial: /SoftwareSerial/,
      delay: /(delay|delayMicroseconds)\s*\(/,
      millis: /(millis|micros)\s*\(/,
      watchdog: /wdt_/,
      powerDown: /(sleep_mode|power_down|idle)/i
    };
    
    this.cppKeywords = new Set([
      'class', 'struct', 'namespace', 'template', 'typename',
      'public', 'private', 'protected', 'virtual', 'override',
      'const', 'static', 'inline', 'explicit', 'friend',
      'volatile', 'mutable', 'constexpr', 'noexcept'
    ]);
  }

  async analyzeFile(filePath) {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const analysis = {
        entities: [],
        relationships: [],
        hardwareComponents: [],
        interrupts: [],
        memoryUsage: {},
        arduinoSpecific: {},
        cppFeatures: {},
        libraries: [],
        complexity: 0
      };

      // Detectar tipo de archivo Arduino/C++
      const fileType = this.detectFileType(filePath, content);
      analysis.fileType = fileType;
      
      // Analizar estructura básica
      analysis.entities = await this.extractEntities(content, filePath);
      
      // Analizar hardware específico (solo para archivos Arduino)
      if (fileType === 'sketch' || fileType === 'arduino_cpp') {
        analysis.hardwareComponents = this.detectHardwareComponents(content);
        analysis.interrupts = this.detectInterrupts(content);
        analysis.arduinoSpecific = this.detectArduinoPatterns(content);
        analysis.memoryUsage = await this.analyzeMemoryUsage(content);
      }
      
      // Analizar características C++
      analysis.cppFeatures = this.detectCppFeatures(content);
      
      // Analizar dependencias de librerías
      analysis.libraries = this.extractLibraries(content);
      
      // Calcular complejidad
      analysis.complexity = this.calculateComplexity(content);
      
      // Detectar relaciones
      analysis.relationships = this.inferRelationships(analysis.entities);
      
      return analysis;
      
    } catch (error) {
      logger.error(`Error analyzing C++ file ${filePath}:`, error);
      return {
        entities: [],
        relationships: [],
        hardwareComponents: [],
        interrupts: [],
        memoryUsage: {},
        arduinoSpecific: {},
        cppFeatures: {},
        libraries: [],
        complexity: 0,
        error: error.message
      };
    }
  }

  detectFileType(filePath, content) {
    const ext = path.extname(filePath).toLowerCase();
    
    if (ext === '.ino') return 'sketch';
    if (ext === '.pde') return 'sketch'; // Older Arduino files
    
    if (['.cpp', '.cc', '.cxx'].includes(ext)) {
      if (this.arduinoPatterns.setup.test(content) || 
          this.arduinoPatterns.loop.test(content) ||
          content.includes('#include <Arduino.h>')) {
        return 'arduino_cpp';
      }
      return 'cpp';
    }
    
    if (['.h', '.hpp', '.hxx'].includes(ext)) {
      if (content.includes('Arduino.h') || content.includes('WProgram.h')) {
        return 'arduino_header';
      }
      return 'header';
    }
    
    return 'unknown';
  }

  async extractEntities(content, filePath) {
    const entities = [];
    
    // Extraer clases
    const classRegex = /(?:template\s*<[^>]*>\s*)?class\s+(\w+)(?:\s*:\s*(?:public|private|protected)\s+([\w:]+(?:\s*,\s*(?:public|private|protected)\s+[\w:]+)*))?\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/gs;
    let match;
    
    while ((match = classRegex.exec(content)) !== null) {
      const className = match[1];
      const inheritance = match[2] ? match[2].split(',').map(s => s.trim()) : [];
      const classBody = match[3];
      
      const entity = {
        type: 'class',
        name: className,
        inheritance,
        filePath,
        lineStart: content.substring(0, match.index).split('\n').length,
        lineEnd: content.substring(0, match.index + match[0].length).split('\n').length,
        members: this.extractClassMembers(classBody),
        isTemplate: match[0].includes('template'),
        isArduinoLibrary: this.isArduinoLibrary(className),
        accessSpecifiers: this.extractAccessSpecifiers(classBody)
      };
      
      entities.push(entity);
    }
    
    // Extraer estructuras
    const structRegex = /struct\s+(\w+)\s*\{([^}]*)\}/gs;
    while ((match = structRegex.exec(content)) !== null) {
      entities.push({
        type: 'struct',
        name: match[1],
        filePath,
        lineStart: content.substring(0, match.index).split('\n').length,
        members: this.extractStructMembers(match[2])
      });
    }
    
    // Extraer funciones (incluyendo setup y loop)
    const functionRegex = /(?:(?:static|inline|virtual|const|explicit)?\s+)*(?:template\s*<[^>]*>\s*)?(\w+(?:\s*[*&])?|\w+::\w+)\s+(\w+)\s*\(([^)]*)\)\s*(?:const)?\s*(?:override)?\s*(?:noexcept)?\s*(?:\{|;)/g;
    
    while ((match = functionRegex.exec(content)) !== null) {
      const returnType = match[1];
      const functionName = match[2];
      const parameters = match[3];
      const isDeclaration = match[0].endsWith(';');
      
      if (this.cppKeywords.has(functionName)) continue; // Skip keywords
      
      const functionBody = isDeclaration ? '' : this.extractFunctionBody(content, match.index + match[0].length - 1);
      
      const entity = {
        type: 'function',
        name: functionName,
        returnType,
        parameters: this.parseParameters(parameters),
        filePath,
        lineStart: content.substring(0, match.index).split('\n').length,
        isDeclaration,
        isSetup: functionName === 'setup',
        isLoop: functionName === 'loop',
        isISR: content.substring(Math.max(0, match.index - 50), match.index).includes('ISR'),
        isConstructor: functionName === returnType,
        isDestructor: functionName.startsWith('~'),
        isOperator: functionName.startsWith('operator'),
        isTemplate: match[0].includes('template'),
        complexity: this.calculateFunctionComplexity(functionBody)
      };
      
      // Analizar llamadas específicas de Arduino
      if (functionBody) {
        entity.hardwareCalls = this.countHardwareCalls(functionBody);
        entity.timingCritical = this.isTimingCritical(functionBody);
        entity.usesInterrupts = this.usesInterrupts(functionBody);
      }
      
      entities.push(entity);
    }
    
    // Extraer variables globales (importantes en Arduino)
    const globalVarRegex = /^(?:extern\s+)?(?:const\s+)?(?:volatile\s+)?(?:static\s+)?(\w+(?:\s*[*&])?)\s+(\w+)(?:\[([^\]]+)\])?(?:\s*=\s*([^;]+))?;/gm;
    
    while ((match = globalVarRegex.exec(content)) !== null) {
      const dataType = match[1];
      const varName = match[2];
      const arraySize = match[3];
      const initialValue = match[4];
      
      entities.push({
        type: 'global_variable',
        dataType,
        name: varName,
        arraySize,
        initialValue,
        filePath,
        lineStart: content.substring(0, match.index).split('\n').length,
        isVolatile: content.substring(Math.max(0, match.index - 30), match.index).includes('volatile'),
        isConst: content.substring(Math.max(0, match.index - 30), match.index).includes('const'),
        isStatic: content.substring(Math.max(0, match.index - 30), match.index).includes('static'),
        isExtern: content.substring(Math.max(0, match.index - 30), match.index).includes('extern'),
        estimatedSize: this.estimateVariableSize(dataType, arraySize)
      });
    }
    
    // Extraer enums
    const enumRegex = /enum(?:\s+class)?\s+(\w+)\s*(?::\s*(\w+))?\s*\{([^}]*)\}/gs;
    while ((match = enumRegex.exec(content)) !== null) {
      entities.push({
        type: 'enum',
        name: match[1],
        underlyingType: match[2] || 'int',
        values: this.parseEnumValues(match[3]),
        filePath,
        lineStart: content.substring(0, match.index).split('\n').length,
        isScopedEnum: match[0].includes('enum class')
      });
    }
    
    // Extraer typedefs y using declarations
    const typedefRegex = /(?:typedef\s+(.+)\s+(\w+)|using\s+(\w+)\s*=\s*(.+));/g;
    while ((match = typedefRegex.exec(content)) !== null) {
      entities.push({
        type: 'type_alias',
        name: match[2] || match[3],
        originalType: match[1] || match[4],
        filePath,
        lineStart: content.substring(0, match.index).split('\n').length,
        isUsingDeclaration: match[0].startsWith('using')
      });
    }
    
    return entities;
  }

  detectHardwareComponents(content) {
    const components = [];
    const pins = new Set();
    
    // Detectar pines utilizados
    const pinRegex = /(?:pinMode|digitalRead|digitalWrite|analogRead|analogWrite)\s*\(\s*([A-Za-z_]\w*|\d+)/g;
    let match;
    
    while ((match = pinRegex.exec(content)) !== null) {
      pins.add(match[1]);
    }
    
    pins.forEach(pin => {
      components.push({
        type: 'pin',
        identifier: pin,
        usage: this.detectPinUsage(content, pin),
        isPWM: this.isPWMPin(content, pin),
        isAnalog: this.isAnalogPin(content, pin),
        isDigital: this.isDigitalPin(content, pin)
      });
    });
    
    // Detectar comunicación serial
    const serialRegex = /Serial(\d*)\.begin\s*\(\s*(\d+)/g;
    while ((match = serialRegex.exec(content)) !== null) {
      components.push({
        type: 'serial',
        instance: match[1] || '0',
        baudRate: parseInt(match[2])
      });
    }
    
    // Detectar I2C
    if (/Wire\.begin/.test(content)) {
      const slaveMatch = /Wire\.begin\s*\(\s*(\d+)\s*\)/.exec(content);
      components.push({
        type: 'i2c',
        mode: slaveMatch ? 'slave' : 'master',
        address: slaveMatch ? parseInt(slaveMatch[1]) : null
      });
    }
    
    // Detectar SPI
    if (/SPI\.begin/.test(content)) {
      components.push({
        type: 'spi',
        settings: this.extractSPISettings(content)
      });
    }
    
    // Detectar servos
    const servoRegex = /Servo\s+(\w+)/g;
    while ((match = servoRegex.exec(content)) !== null) {
      components.push({
        type: 'servo',
        name: match[1],
        pin: this.extractServoPin(content, match[1])
      });
    }
    
    // Detectar sensores comunes
    components.push(...this.detectCommonSensors(content));
    
    // Detectar displays
    components.push(...this.detectDisplays(content));
    
    return components;
  }

  detectInterrupts(content) {
    const interrupts = [];
    
    // ISR (Interrupt Service Routines)
    const isrRegex = /ISR\s*\(\s*(\w+)\s*\)\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/gs;
    let match;
    
    while ((match = isrRegex.exec(content)) !== null) {
      const vector = match[1];
      const body = match[2];
      
      interrupts.push({
        type: 'isr',
        vector,
        body,
        lineNumber: content.substring(0, match.index).split('\n').length,
        complexity: this.calculateFunctionComplexity(body),
        sharedVariables: this.findSharedVariables(body),
        isTimingCritical: this.isTimingCritical(body),
        estimatedExecutionTime: this.estimateISRTime(body)
      });
    }
    
    // attachInterrupt calls
    const attachRegex = /attachInterrupt\s*\(\s*([^,]+)\s*,\s*([^,]+)\s*,\s*([^)]+)\s*\)/g;
    
    while ((match = attachRegex.exec(content)) !== null) {
      interrupts.push({
        type: 'external',
        pin: match[1].trim(),
        handler: match[2].trim(),
        mode: match[3].trim(),
        lineNumber: content.substring(0, match.index).split('\n').length
      });
    }
    
    // Timer interrupts
    const timerInterruptRegex = /(Timer\d+|TIMER\d+).*interrupt/gi;
    while ((match = timerInterruptRegex.exec(content)) !== null) {
      interrupts.push({
        type: 'timer',
        timer: match[1],
        lineNumber: content.substring(0, match.index).split('\n').length
      });
    }
    
    return interrupts;
  }

  async analyzeMemoryUsage(content) {
    const memory = {
      estimatedRAM: 0,
      estimatedFlash: 0,
      estimatedEEPROM: 0,
      largeArrays: [],
      stringLiterals: [],
      globalVariables: [],
      stackUsage: 0
    };
    
    // Detectar arrays grandes
    const arrayRegex = /(\w+)\s+(\w+)\[(\d+)\](?:\[(\d+)\])?/g;
    let match;
    
    while ((match = arrayRegex.exec(content)) !== null) {
      const dataType = match[1];
      const name = match[2];
      const size1 = parseInt(match[3]);
      const size2 = match[4] ? parseInt(match[4]) : 1;
      const totalSize = size1 * size2;
      const typeSize = this.getTypeSize(dataType);
      const bytes = totalSize * typeSize;
      
      if (bytes > 50) { // Considerar arrays > 50 bytes como "grandes"
        memory.largeArrays.push({
          name,
          dataType,
          size: totalSize,
          bytes,
          dimensions: match[4] ? 2 : 1
        });
      }
      
      memory.estimatedRAM += bytes;
    }
    
    // Detectar strings literales
    const stringRegex = /"([^"]*)"/g;
    while ((match = stringRegex.exec(content)) !== null) {
      const str = match[1];
      memory.stringLiterals.push({
        content: str,
        length: str.length,
        usesPROGMEM: content.substring(Math.max(0, match.index - 10), match.index).includes('F(')
      });
      
      // Strings van a Flash si usan F() macro, sino a RAM
      if (content.substring(Math.max(0, match.index - 10), match.index).includes('F(')) {
        memory.estimatedFlash += str.length + 1;
      } else {
        memory.estimatedRAM += str.length + 1;
      }
    }
    
    // Analizar variables globales
    const globalVarRegex = /^(?:const\s+)?(?:volatile\s+)?(?:static\s+)?(\w+)\s+(\w+)(?:\s*=\s*([^;]+))?;/gm;
    while ((match = globalVarRegex.exec(content)) !== null) {
      const dataType = match[1];
      const name = match[2];
      const size = this.getTypeSize(dataType);
      
      memory.globalVariables.push({
        name,
        dataType,
        size
      });
      
      memory.estimatedRAM += size;
    }
    
    // Estimar uso de EEPROM
    const eepromRegex = /EEPROM\.(read|write|update|put|get)/g;
    if (eepromRegex.test(content)) {
      memory.estimatedEEPROM = this.estimateEEPROMUsage(content);
    }
    
    // Estimar uso del stack (funciones recursivas, profundidad de llamadas)
    memory.stackUsage = this.estimateStackUsage(content);
    
    return memory;
  }

  detectArduinoPatterns(content) {
    const patterns = {
      hasSetupLoop: false,
      usesInterrupts: false,
      usesTimers: false,
      communicationProtocols: [],
      powerManagement: false,
      realTimeConstraints: false,
      statemachine: false,
      nonBlockingCode: false,
      memoryOptimized: false,
      hardwareAbstraction: false
    };
    
    // Patrón setup/loop
    patterns.hasSetupLoop = this.arduinoPatterns.setup.test(content) && 
                           this.arduinoPatterns.loop.test(content);
    
    // Interrupciones
    patterns.usesInterrupts = this.arduinoPatterns.interrupt.test(content) ||
                             this.arduinoPatterns.attachInterrupt.test(content);
    
    // Timers
    patterns.usesTimers = this.arduinoPatterns.timer.test(content);
    
    // Protocolos de comunicación
    if (this.arduinoPatterns.serial.test(content)) patterns.communicationProtocols.push('Serial');
    if (this.arduinoPatterns.i2c.test(content)) patterns.communicationProtocols.push('I2C');
    if (this.arduinoPatterns.spi.test(content)) patterns.communicationProtocols.push('SPI');
    
    // Power management
    patterns.powerManagement = this.arduinoPatterns.powerDown.test(content) ||
                              content.includes('LowPower') ||
                              content.includes('sleep');
    
    // Real-time constraints
    patterns.realTimeConstraints = this.arduinoPatterns.millis.test(content) ||
                                  this.arduinoPatterns.delay.test(content);
    
    // State machine pattern
    patterns.statemachine = /enum.*[Ss]tate|switch.*[Ss]tate|currentState|nextState/i.test(content);
    
    // Non-blocking code
    patterns.nonBlockingCode = content.includes('millis()') && 
                              !content.includes('delay(') &&
                              /unsigned long.*timer|lastTime|previousTime/i.test(content);
    
    // Memory optimization
    patterns.memoryOptimized = content.includes('F(') || 
                              content.includes('PROGMEM') ||
                              /int8_t|uint8_t|byte/.test(content);
    
    // Hardware abstraction
    patterns.hardwareAbstraction = /class.*Sensor|class.*Driver|class.*Device/i.test(content);
    
    return patterns;
  }

  detectCppFeatures(content) {
    const features = {
      usesClasses: /class\s+\w+/.test(content),
      usesTemplates: /template\s*</.test(content),
      usesNamespaces: /namespace\s+\w+/.test(content),
      usesInheritance: /class\s+\w+\s*:\s*public/.test(content),
      usesPolymorphism: /virtual\s+/.test(content),
      usesOperatorOverloading: /operator\s*[+\-*\/=<>]/.test(content),
      usesSTL: /#include\s*<(vector|string|map|set|list|algorithm|iterator)>/.test(content),
      usesSmartPointers: /unique_ptr|shared_ptr|weak_ptr/.test(content),
      usesLambdas: /\[.*\]\s*\(.*\)\s*\{/.test(content),
      usesAutoKeyword: /\bauto\s+\w+/.test(content),
      usesConstexpr: /constexpr/.test(content),
      usesNoexcept: /noexcept/.test(content),
      cppStandard: this.detectCppStandard(content)
    };
    
    return features;
  }

  extractLibraries(content) {
    const libraries = [];
    const includeRegex = /#include\s*[<"]([^>"]+)[>"]/g;
    let match;
    
    while ((match = includeRegex.exec(content)) !== null) {
      const libName = match[1];
      const isSystem = match[0].includes('<');
      
      libraries.push({
        name: libName,
        isSystem,
        isArduinoCore: this.isArduinoCoreLibrary(libName),
        isSTL: this.isSTLLibrary(libName),
        category: this.categorizeLibrary(libName)
      });
    }
    
    return libraries;
  }

  // Helper methods
  extractClassMembers(classBody) {
    const members = [];
    
    // Extract methods
    const methodRegex = /(?:public|private|protected):\s*(?:[^{}]*?)(\w+)\s+(\w+)\s*\(([^)]*)\)/g;
    let match;
    
    while ((match = methodRegex.exec(classBody)) !== null) {
      members.push({
        type: 'method',
        returnType: match[1],
        name: match[2],
        parameters: this.parseParameters(match[3]),
        visibility: this.findVisibility(classBody, match.index)
      });
    }
    
    // Extract member variables
    const memberVarRegex = /(?:public|private|protected):\s*(?:[^{}]*?)(\w+)\s+(\w+);/g;
    
    while ((match = memberVarRegex.exec(classBody)) !== null) {
      members.push({
        type: 'member_variable',
        dataType: match[1],
        name: match[2],
        visibility: this.findVisibility(classBody, match.index)
      });
    }
    
    return members;
  }

  extractStructMembers(structBody) {
    const members = [];
    const memberRegex = /(\w+)\s+(\w+)(?:\[([^\]]+)\])?;/g;
    let match;
    
    while ((match = memberRegex.exec(structBody)) !== null) {
      members.push({
        dataType: match[1],
        name: match[2],
        arraySize: match[3]
      });
    }
    
    return members;
  }

  parseParameters(paramString) {
    if (!paramString || paramString.trim() === '') return [];
    
    return paramString.split(',').map(param => {
      const trimmed = param.trim();
      const parts = trimmed.split(/\s+/);
      if (parts.length >= 2) {
        return {
          type: parts.slice(0, -1).join(' '),
          name: parts[parts.length - 1].replace(/[*&]/, '')
        };
      }
      return { type: trimmed, name: '' };
    });
  }

  parseEnumValues(enumBody) {
    return enumBody.split(',')
      .map(value => value.trim())
      .filter(value => value)
      .map(value => {
        const [name, val] = value.split('=').map(s => s.trim());
        return { name, value: val || null };
      });
  }

  getTypeSize(dataType) {
    const sizes = {
      'char': 1, 'int8_t': 1, 'uint8_t': 1, 'byte': 1, 'bool': 1, 'boolean': 1,
      'short': 2, 'int': 2, 'int16_t': 2, 'uint16_t': 2, 'word': 2,
      'long': 4, 'int32_t': 4, 'uint32_t': 4, 'float': 4,
      'double': 4, // En Arduino, double es igual a float
      'long long': 8, 'int64_t': 8, 'uint64_t': 8
    };
    
    // Handle pointers
    if (dataType.includes('*')) return 2; // 16-bit pointers on AVR
    
    // Handle arrays
    const arrayMatch = dataType.match(/(\w+)\[(\d+)\]/);
    if (arrayMatch) {
      const baseSize = sizes[arrayMatch[1]] || 1;
      return baseSize * parseInt(arrayMatch[2]);
    }
    
    return sizes[dataType] || 1;
  }

  estimateVariableSize(dataType, arraySize) {
    const baseSize = this.getTypeSize(dataType);
    if (arraySize) {
      return baseSize * parseInt(arraySize);
    }
    return baseSize;
  }

  calculateComplexity(content) {
    let complexity = 1; // Base complexity
    
    // Count control structures
    complexity += (content.match(/if\s*\(/g) || []).length;
    complexity += (content.match(/else\s+if\s*\(/g) || []).length;
    complexity += (content.match(/while\s*\(/g) || []).length;
    complexity += (content.match(/for\s*\(/g) || []).length;
    complexity += (content.match(/switch\s*\(/g) || []).length;
    complexity += (content.match(/case\s+/g) || []).length;
    complexity += (content.match(/catch\s*\(/g) || []).length;
    complexity += (content.match(/&&|\|\|/g) || []).length;
    
    return complexity;
  }

  calculateFunctionComplexity(functionBody) {
    if (!functionBody) return 1;
    return this.calculateComplexity(functionBody);
  }

  countHardwareCalls(functionBody) {
    let count = 0;
    for (const pattern of Object.values(this.arduinoPatterns)) {
      const matches = functionBody.match(pattern);
      if (matches) count += matches.length;
    }
    return count;
  }

  isTimingCritical(code) {
    return /micros\(\)|delayMicroseconds|noInterrupts|ATOMIC_BLOCK/.test(code);
  }

  usesInterrupts(code) {
    return /attachInterrupt|detachInterrupt|interrupts\(\)|noInterrupts\(\)|ISR/.test(code);
  }

  isArduinoCoreLibrary(libName) {
    const coreLibs = [
      'Arduino.h', 'WProgram.h', 'Wire.h', 'SPI.h', 'EEPROM.h', 
      'SoftwareSerial.h', 'Servo.h', 'Stepper.h', 'LiquidCrystal.h',
      'SD.h', 'Ethernet.h', 'WiFi.h', 'WiFi101.h', 'WiFiNINA.h',
      'IRremote.h', 'OneWire.h', 'DallasTemperature.h'
    ];
    return coreLibs.includes(libName);
  }

  isSTLLibrary(libName) {
    const stlLibs = [
      'vector', 'string', 'map', 'set', 'list', 'algorithm', 
      'iterator', 'memory', 'functional', 'utility', 'array'
    ];
    return stlLibs.includes(libName);
  }

  categorizeLibrary(libName) {
    if (this.isArduinoCoreLibrary(libName)) return 'arduino_core';
    if (this.isSTLLibrary(libName)) return 'stl';
    if (libName.includes('.h')) return 'custom';
    return 'system';
  }

  detectCppStandard(content) {
    if (/constexpr|nullptr|auto\s+\w+\s*=/.test(content)) return 'C++11';
    if (/std::unique_ptr|std::shared_ptr/.test(content)) return 'C++11';
    if (/\[\[.*\]\]/.test(content)) return 'C++11';
    if (/override|final/.test(content)) return 'C++11';
    return 'C++98';
  }

  inferRelationships(entities) {
    const relationships = [];
    
    // Find inheritance relationships
    entities.filter(e => e.type === 'class' && e.inheritance).forEach(cls => {
      cls.inheritance.forEach(base => {
        relationships.push({
          from: cls.name,
          to: base.replace(/^(public|private|protected)\s+/, ''),
          type: 'INHERITS_FROM',
          visibility: base.match(/^(public|private|protected)/) ? base.match(/^(public|private|protected)/)[1] : 'private'
        });
      });
    });
    
    // Find function calls
    entities.filter(e => e.type === 'function').forEach(func => {
      entities.filter(e => e.type === 'function' && e.name !== func.name).forEach(other => {
        if (func.body && func.body.includes(other.name + '(')) {
          relationships.push({
            from: func.name,
            to: other.name,
            type: 'CALLS'
          });
        }
      });
    });
    
    return relationships;
  }

  // Additional helper methods for Arduino-specific detection
  detectPinUsage(content, pin) {
    const usage = [];
    if (new RegExp(`pinMode\\s*\\(\\s*${pin}`).test(content)) usage.push('pinMode');
    if (new RegExp(`digitalRead\\s*\\(\\s*${pin}`).test(content)) usage.push('digitalRead');
    if (new RegExp(`digitalWrite\\s*\\(\\s*${pin}`).test(content)) usage.push('digitalWrite');
    if (new RegExp(`analogRead\\s*\\(\\s*${pin}`).test(content)) usage.push('analogRead');
    if (new RegExp(`analogWrite\\s*\\(\\s*${pin}`).test(content)) usage.push('analogWrite');
    return usage;
  }

  isPWMPin(content, pin) {
    return new RegExp(`analogWrite\\s*\\(\\s*${pin}`).test(content);
  }

  isAnalogPin(content, pin) {
    return new RegExp(`analogRead\\s*\\(\\s*${pin}`).test(content) || 
           pin.toString().startsWith('A');
  }

  isDigitalPin(content, pin) {
    return new RegExp(`digital(Read|Write)\\s*\\(\\s*${pin}`).test(content);
  }

  extractSPISettings(content) {
    const settings = {};
    const settingsMatch = content.match(/SPISettings\s*\(\s*(\d+)\s*,\s*(\w+)\s*,\s*(\w+)\s*\)/);
    if (settingsMatch) {
      settings.clockSpeed = parseInt(settingsMatch[1]);
      settings.bitOrder = settingsMatch[2];
      settings.dataMode = settingsMatch[3];
    }
    return settings;
  }

  extractServoPin(content, servoName) {
    const attachMatch = new RegExp(`${servoName}\\.attach\\s*\\(\\s*(\\d+)`).exec(content);
    return attachMatch ? parseInt(attachMatch[1]) : null;
  }

  detectCommonSensors(content) {
    const sensors = [];
    
    // DHT sensors
    if (/DHT\d+|dht\d+/.test(content)) {
      sensors.push({ type: 'dht_sensor', protocol: 'onewire' });
    }
    
    // Ultrasonic sensors
    if (/HC-?SR04|ultrasonic/i.test(content)) {
      sensors.push({ type: 'ultrasonic', interface: 'trigger_echo' });
    }
    
    // Accelerometer/Gyroscope
    if (/MPU6050|MPU9250|ADXL345/i.test(content)) {
      sensors.push({ type: 'imu', protocol: 'i2c' });
    }
    
    return sensors;
  }

  detectDisplays(content) {
    const displays = [];
    
    // LCD displays
    if (/LiquidCrystal|lcd\./i.test(content)) {
      displays.push({ type: 'lcd', interface: 'parallel' });
    }
    
    // OLED displays
    if (/SSD1306|OLED/i.test(content)) {
      displays.push({ type: 'oled', protocol: 'i2c' });
    }
    
    // LED Matrix
    if (/MAX7219|matrix/i.test(content)) {
      displays.push({ type: 'led_matrix', protocol: 'spi' });
    }
    
    return displays;
  }

  findSharedVariables(code) {
    const variables = [];
    const volatileVars = code.match(/volatile\s+\w+\s+(\w+)/g);
    if (volatileVars) {
      variables.push(...volatileVars.map(v => v.match(/(\w+)$/)[1]));
    }
    return variables;
  }

  estimateISRTime(body) {
    // Very rough estimation based on instruction count
    const instructions = body.split(/[;{}]/).length;
    return instructions * 0.5; // Assume 0.5 microseconds per instruction at 16MHz
  }

  estimateEEPROMUsage(content) {
    const reads = (content.match(/EEPROM\.read/g) || []).length;
    const writes = (content.match(/EEPROM\.write|EEPROM\.update/g) || []).length;
    return Math.max(reads, writes) * 4; // Rough estimate
  }

  estimateStackUsage(content) {
    // Count function depth and local variables
    const maxDepth = this.calculateMaxCallDepth(content);
    const avgLocalVars = 5; // Rough estimate
    return maxDepth * avgLocalVars * 2; // 2 bytes per int on AVR
  }

  calculateMaxCallDepth(content) {
    // This is a simplified calculation
    const functionCalls = (content.match(/\w+\s*\(/g) || []).length;
    return Math.min(functionCalls / 10, 8); // Cap at reasonable depth
  }

  extractFunctionBody(content, startIndex) {
    let braceCount = 0;
    let i = startIndex;
    const start = i;
    
    while (i < content.length) {
      if (content[i] === '{') braceCount++;
      else if (content[i] === '}') braceCount--;
      
      if (braceCount === 0 && content[i] === '}') {
        return content.substring(start, i + 1);
      }
      i++;
    }
    
    return '';
  }

  extractAccessSpecifiers(classBody) {
    const specifiers = [];
    const regex = /(public|private|protected):/g;
    let match;
    
    while ((match = regex.exec(classBody)) !== null) {
      specifiers.push({
        type: match[1],
        position: match.index
      });
    }
    
    return specifiers;
  }

  findVisibility(classBody, position) {
    const specifiers = this.extractAccessSpecifiers(classBody);
    let currentVisibility = 'private'; // Default for classes
    
    for (const spec of specifiers) {
      if (spec.position < position) {
        currentVisibility = spec.type;
      } else {
        break;
      }
    }
    
    return currentVisibility;
  }

  isArduinoLibrary(className) {
    const arduinoLibClasses = [
      'Wire', 'SPI', 'Serial', 'Ethernet', 'WiFi', 'SD', 'Servo',
      'LiquidCrystal', 'Stepper', 'SoftwareSerial'
    ];
    return arduinoLibClasses.includes(className);
  }
}