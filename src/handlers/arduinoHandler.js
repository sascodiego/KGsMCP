import { logger } from '../utils/logger.js';
import { CppAnalyzer } from '../analyzers/cppAnalyzer.js';
import fs from 'fs/promises';
import path from 'path';

export class ArduinoHandler {
  constructor(server) {
    this.server = server;
    this.kuzu = server.kuzu;
    this.cppAnalyzer = new CppAnalyzer(server.config);
    
    // Arduino board specifications
    this.boardSpecs = {
      'uno': {
        ram: 2048,
        flash: 32768,
        eeprom: 1024,
        clockSpeed: 16000000,
        maxInterrupts: 2,
        interruptPins: [2, 3],
        pwmPins: [3, 5, 6, 9, 10, 11],
        analogPins: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5'],
        digitalPins: Array.from({length: 14}, (_, i) => i),
        i2cPins: { sda: 'A4', scl: 'A5' },
        spiPins: { mosi: 11, miso: 12, sck: 13, ss: 10 },
        serialPins: { rx: 0, tx: 1 }
      },
      'mega2560': {
        ram: 8192,
        flash: 262144,
        eeprom: 4096,
        clockSpeed: 16000000,
        maxInterrupts: 6,
        interruptPins: [2, 3, 18, 19, 20, 21],
        pwmPins: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 44, 45, 46],
        analogPins: Array.from({length: 16}, (_, i) => `A${i}`),
        digitalPins: Array.from({length: 54}, (_, i) => i),
        i2cPins: { sda: 20, scl: 21 },
        spiPins: { mosi: 51, miso: 50, sck: 52, ss: 53 },
        serialPins: { rx: 0, tx: 1 }
      },
      'nano': {
        ram: 2048,
        flash: 32768,
        eeprom: 1024,
        clockSpeed: 16000000,
        maxInterrupts: 2,
        interruptPins: [2, 3],
        pwmPins: [3, 5, 6, 9, 10, 11],
        analogPins: ['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7'],
        digitalPins: Array.from({length: 14}, (_, i) => i),
        i2cPins: { sda: 'A4', scl: 'A5' },
        spiPins: { mosi: 11, miso: 12, sck: 13, ss: 10 },
        serialPins: { rx: 0, tx: 1 }
      },
      'esp32': {
        ram: 520000,
        flash: 4194304,
        eeprom: 4096,
        clockSpeed: 240000000,
        maxInterrupts: 32,
        interruptPins: Array.from({length: 40}, (_, i) => i).filter(i => ![6,7,8,9,10,11].includes(i)),
        pwmPins: Array.from({length: 16}, (_, i) => i),
        analogPins: Array.from({length: 18}, (_, i) => i),
        digitalPins: Array.from({length: 40}, (_, i) => i),
        i2cPins: { sda: 21, scl: 22 },
        spiPins: { mosi: 23, miso: 19, sck: 18, ss: 5 },
        serialPins: { rx: 3, tx: 1 }
      }
    };
  }

  async analyzeArduinoSketch(args) {
    const { sketchPath, targetBoard = 'uno', includeLibraries = true } = args;
    
    try {
      // Validate sketch path
      const stats = await fs.stat(sketchPath);
      if (!stats.isFile() && !stats.isDirectory()) {
        throw new Error('Invalid sketch path');
      }
      
      let filesToAnalyze = [];
      
      if (stats.isDirectory()) {
        // Analyze entire sketch folder
        const files = await fs.readdir(sketchPath);
        filesToAnalyze = files
          .filter(file => ['.ino', '.cpp', '.h'].includes(path.extname(file)))
          .map(file => path.join(sketchPath, file));
      } else {
        filesToAnalyze = [sketchPath];
      }
      
      const analysis = {
        sketchPath,
        targetBoard,
        files: [],
        overallComplexity: 0,
        memoryEstimate: {
          ram: 0,
          flash: 0,
          eeprom: 0
        },
        hardwareUsage: {
          pins: new Map(),
          protocols: [],
          interrupts: [],
          timers: []
        },
        optimization: {
          recommendations: [],
          warnings: [],
          errors: []
        },
        compatibility: {
          boardSupported: this.boardSpecs.hasOwnProperty(targetBoard),
          requiredFeatures: []
        }
      };
      
      // Analyze each file
      for (const filePath of filesToAnalyze) {
        try {
          const fileAnalysis = await this.cppAnalyzer.analyzeFile(filePath);
          analysis.files.push(fileAnalysis);
          
          // Aggregate complexity
          analysis.overallComplexity += fileAnalysis.complexity;
          
          // Aggregate memory usage
          if (fileAnalysis.memoryUsage) {
            analysis.memoryEstimate.ram += fileAnalysis.memoryUsage.estimatedRAM || 0;
            analysis.memoryEstimate.flash += fileAnalysis.memoryUsage.estimatedFlash || 0;
            analysis.memoryEstimate.eeprom += fileAnalysis.memoryUsage.estimatedEEPROM || 0;
          }
          
          // Aggregate hardware usage
          if (fileAnalysis.hardwareComponents) {
            fileAnalysis.hardwareComponents.forEach(component => {
              if (component.type === 'pin') {
                const currentUsage = analysis.hardwareUsage.pins.get(component.identifier) || [];
                currentUsage.push(...component.usage);
                analysis.hardwareUsage.pins.set(component.identifier, [...new Set(currentUsage)]);
              } else {
                analysis.hardwareUsage.protocols.push(component);
              }
            });
          }
          
          // Aggregate interrupts
          if (fileAnalysis.interrupts) {
            analysis.hardwareUsage.interrupts.push(...fileAnalysis.interrupts);
          }
          
        } catch (error) {
          analysis.optimization.warnings.push({
            type: 'analysis_error',
            file: filePath,
            message: `Failed to analyze file: ${error.message}`
          });
        }
      }
      
      // Validate hardware configuration
      const validation = await this.validateHardwareConfiguration({
        board: targetBoard,
        components: Array.from(analysis.hardwareUsage.pins.entries()).map(([pin, usage]) => ({
          pin,
          usage,
          type: 'pin'
        })),
        connections: analysis.hardwareUsage.protocols
      });
      
      analysis.optimization.errors.push(...validation.content[0].text ? JSON.parse(validation.content[0].text).issues : []);
      analysis.optimization.warnings.push(...validation.content[0].text ? JSON.parse(validation.content[0].text).warnings : []);
      
      // Generate optimization suggestions
      const optimizations = await this.optimizeForArduino({
        memoryUsage: analysis.memoryEstimate,
        targetBoard,
        complexity: analysis.overallComplexity
      });
      
      analysis.optimization.recommendations.push(...optimizations.content[0].text ? JSON.parse(optimizations.content[0].text) : []);
      
      // Store analysis in Knowledge Graph
      await this.storeArduinoAnalysis(analysis);
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(analysis, null, 2)
        }]
      };
      
    } catch (error) {
      logger.error('Error analyzing Arduino sketch:', error);
      throw error;
    }
  }

  async validateHardwareConfiguration(args) {
    const { board, components, connections = [] } = args;
    
    const validation = {
      board,
      issues: [],
      warnings: [],
      suggestions: [],
      pinMap: new Map()
    };
    
    if (!this.boardSpecs[board]) {
      validation.issues.push({
        type: 'unsupported_board',
        message: `Board '${board}' is not supported`,
        severity: 'error'
      });
      return { content: [{ type: 'text', text: JSON.stringify(validation, null, 2) }] };
    }
    
    const boardSpec = this.boardSpecs[board];
    
    // Track pin usage
    components.forEach(component => {
      if (component.type === 'pin') {
        const pin = component.pin;
        const usage = component.usage || [];
        
        // Check if pin exists on board
        const pinNum = parseInt(pin) || pin;
        if (!boardSpec.digitalPins.includes(pinNum) && !boardSpec.analogPins.includes(pin)) {
          validation.issues.push({
            type: 'invalid_pin',
            message: `Pin ${pin} does not exist on ${board}`,
            severity: 'error',
            pin
          });
          return;
        }
        
        // Check for pin conflicts
        if (validation.pinMap.has(pin)) {
          const existingUsage = validation.pinMap.get(pin);
          const conflict = usage.some(u => 
            (u.includes('Write') && existingUsage.some(e => e.includes('Write'))) ||
            (u.includes('Read') && existingUsage.some(e => e.includes('Write')))
          );
          
          if (conflict) {
            validation.issues.push({
              type: 'pin_conflict',
              message: `Pin ${pin} has conflicting usage: ${usage.join(', ')} vs ${existingUsage.join(', ')}`,
              severity: 'error',
              pin
            });
          }
        } else {
          validation.pinMap.set(pin, usage);
        }
        
        // Check PWM usage on non-PWM pins
        if (usage.includes('analogWrite') && !boardSpec.pwmPins.includes(pinNum)) {
          validation.warnings.push({
            type: 'invalid_pwm',
            message: `Pin ${pin} does not support PWM output`,
            severity: 'warning',
            pin
          });
        }
        
        // Check analog read on digital-only pins
        if (usage.includes('analogRead') && !boardSpec.analogPins.includes(pin)) {
          validation.warnings.push({
            type: 'invalid_analog_read',
            message: `Pin ${pin} does not support analog input`,
            severity: 'warning',
            pin
          });
        }
      }
    });
    
    // Check interrupt usage
    const interruptCount = components.filter(c => c.useInterrupt).length;
    if (interruptCount > boardSpec.maxInterrupts) {
      validation.issues.push({
        type: 'too_many_interrupts',
        message: `Board supports only ${boardSpec.maxInterrupts} external interrupts, ${interruptCount} requested`,
        severity: 'error'
      });
    }
    
    // Check special pin usage conflicts
    this.checkSpecialPinConflicts(validation, boardSpec);
    
    // Generate suggestions
    this.generateHardwareSuggestions(validation, boardSpec, components);
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(validation, null, 2)
      }]
    };
  }

  async generateTimingAnalysis(args) {
    const { codeEntity, constraints = {} } = args;
    
    try {
      // Query for the code entity
      const entityQuery = `
        MATCH (e:CodeEntity {name: $entityName})
        OPTIONAL MATCH (e)-[:CALLS]->(called:CodeEntity)
        RETURN e, collect(called) as calledFunctions
      `;
      
      const result = await this.kuzu.query(entityQuery, { entityName: codeEntity });
      
      if (result.length === 0) {
        throw new Error(`Code entity '${codeEntity}' not found`);
      }
      
      const entity = result[0].e.properties;
      const calledFunctions = result[0].calledFunctions.map(f => f.properties);
      
      const analysis = {
        entity: entity.name,
        timing: {
          estimatedExecutionTime: this.estimateExecutionTime(entity, calledFunctions),
          worstCaseTime: this.calculateWorstCaseTime(entity, calledFunctions),
          averageTime: this.calculateAverageTime(entity, calledFunctions),
          isTimingCritical: entity.isISR || entity.timingCritical || false
        },
        loops: {
          hasLoops: entity.complexity > 2,
          estimatedIterations: this.estimateLoopIterations(entity),
          worstCaseIterations: this.estimateWorstCaseIterations(entity)
        },
        interrupts: {
          canBeInterrupted: !entity.isISR,
          interruptLatency: entity.isISR ? this.calculateInterruptLatency(entity) : null,
          criticalSections: this.findCriticalSections(entity)
        },
        recommendations: []
      };
      
      // Check against constraints
      if (constraints.maxExecutionTime && 
          analysis.timing.worstCaseTime > constraints.maxExecutionTime) {
        analysis.recommendations.push({
          type: 'timing_violation',
          priority: 'high',
          message: `Worst-case execution time (${analysis.timing.worstCaseTime}µs) exceeds constraint (${constraints.maxExecutionTime}µs)`,
          suggestions: [
            'Break function into smaller parts',
            'Use interrupts for time-critical operations',
            'Optimize loops and conditional statements'
          ]
        });
      }
      
      if (constraints.maxLoopTime && entity.isLoop && 
          analysis.timing.averageTime > constraints.maxLoopTime) {
        analysis.recommendations.push({
          type: 'loop_timing',
          priority: 'medium',
          message: `Loop execution time may exceed real-time constraints`,
          suggestions: [
            'Implement non-blocking patterns',
            'Use state machines for complex logic',
            'Move heavy computations to interrupts'
          ]
        });
      }
      
      if (entity.isISR && analysis.timing.estimatedExecutionTime > 50) {
        analysis.recommendations.push({
          type: 'isr_optimization',
          priority: 'high',
          message: 'ISR execution time should be kept minimal',
          suggestions: [
            'Set flags instead of processing data in ISR',
            'Use volatile variables for ISR communication',
            'Minimize ISR code complexity'
          ]
        });
      }
      
      return {
        content: [{
          type: 'text',
          text: JSON.stringify(analysis, null, 2)
        }]
      };
      
    } catch (error) {
      logger.error('Error generating timing analysis:', error);
      throw error;
    }
  }

  async optimizeForArduino(args) {
    const { memoryUsage, targetBoard, complexity, constraints = {} } = args;
    
    const boardSpec = this.boardSpecs[targetBoard] || this.boardSpecs['uno'];
    const optimizations = [];
    
    // Memory optimizations
    if (memoryUsage.ram > boardSpec.ram * 0.8) {
      optimizations.push({
        type: 'memory_critical',
        priority: 'critical',
        category: 'memory',
        description: `RAM usage (${memoryUsage.ram} bytes) approaching limit (${boardSpec.ram} bytes)`,
        recommendations: [
          'Use PROGMEM for string literals: Serial.println(F("text"))',
          'Replace int with int8_t/uint8_t where possible',
          'Use local variables instead of globals',
          'Consider using EEPROM for non-volatile data storage'
        ],
        potentialSavings: Math.floor(memoryUsage.ram * 0.3),
        example: {
          before: 'char message[] = "Hello World";',
          after: 'const char message[] PROGMEM = "Hello World";'
        }
      });
    } else if (memoryUsage.ram > boardSpec.ram * 0.6) {
      optimizations.push({
        type: 'memory_warning',
        priority: 'high',
        category: 'memory',
        description: `RAM usage (${memoryUsage.ram} bytes) is high`,
        recommendations: [
          'Monitor memory usage closely',
          'Use F() macro for debugging strings',
          'Consider smaller data types'
        ]
      });
    }
    
    if (memoryUsage.flash > boardSpec.flash * 0.9) {
      optimizations.push({
        type: 'flash_critical',
        priority: 'critical',
        category: 'flash',
        description: `Flash usage approaching limit`,
        recommendations: [
          'Remove unused libraries and functions',
          'Use compiler optimization flags',
          'Consider bootloader space requirements'
        ]
      });
    }
    
    // Performance optimizations
    if (complexity > 50) {
      optimizations.push({
        type: 'complexity_high',
        priority: 'medium',
        category: 'performance',
        description: `High code complexity detected (${complexity})`,
        recommendations: [
          'Break down complex functions',
          'Use state machines for complex logic',
          'Implement non-blocking patterns'
        ],
        example: {
          before: `void loop() {
  // Many nested if statements and loops
  if (condition1) {
    for (int i = 0; i < 100; i++) {
      if (condition2) {
        // Complex logic
      }
    }
  }
}`,
          after: `// State machine approach
enum State { IDLE, PROCESSING, COMPLETE };
State currentState = IDLE;
int counter = 0;

void loop() {
  switch (currentState) {
    case IDLE:
      if (condition1) currentState = PROCESSING;
      break;
    case PROCESSING:
      if (condition2 && counter < 100) {
        // Process one item per loop
        counter++;
      } else {
        currentState = COMPLETE;
      }
      break;
    case COMPLETE:
      counter = 0;
      currentState = IDLE;
      break;
  }
}`
        }
      });
    }
    
    // Board-specific optimizations
    if (targetBoard === 'uno' || targetBoard === 'nano') {
      optimizations.push({
        type: 'board_specific',
        priority: 'low',
        category: 'optimization',
        description: 'Arduino Uno/Nano optimizations',
        recommendations: [
          'Use int8_t instead of int for small values',
          'Avoid floating-point math when possible',
          'Use bit manipulation for flags',
          'Minimize Serial.print() in production code'
        ],
        example: {
          before: 'int ledState = 0; // Uses 2 bytes',
          after: 'bool ledState = false; // Uses 1 byte'
        }
      });
    }
    
    if (targetBoard === 'esp32') {
      optimizations.push({
        type: 'esp32_specific',
        priority: 'low',
        category: 'optimization',
        description: 'ESP32 optimizations',
        recommendations: [
          'Use FreeRTOS tasks for complex operations',
          'Leverage dual-core capabilities',
          'Use hardware timers for precise timing',
          'Take advantage of larger memory'
        ]
      });
    }
    
    // Power optimization
    optimizations.push({
      type: 'power_optimization',
      priority: 'low',
      category: 'power',
      description: 'Power consumption optimizations',
      recommendations: [
        'Use sleep modes when idle',
        'Turn off unused peripherals',
        'Use pull-up resistors instead of external ones',
        'Minimize LED usage'
      ],
      example: {
        before: `void loop() {
  // Constant polling
  if (digitalRead(button)) {
    // Handle button
  }
  delay(10);
}`,
        after: `// Interrupt-driven approach
volatile bool buttonPressed = false;

void setup() {
  attachInterrupt(digitalPinToInterrupt(button), buttonISR, FALLING);
}

void buttonISR() {
  buttonPressed = true;
}

void loop() {
  if (buttonPressed) {
    buttonPressed = false;
    // Handle button
  }
  // Enter sleep mode
  LowPower.powerDown(SLEEP_1S, ADC_OFF, BOD_OFF);
}`
      }
    });
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(optimizations, null, 2)
      }]
    };
  }

  async generateInterruptSafeCode(args) {
    const { functionality, interruptType = 'external', sharedVariables = [] } = args;
    
    const patterns = {
      external: {
        template: `volatile bool ${functionality}Flag = false;
volatile ${sharedVariables.length > 0 ? sharedVariables[0] + '_type' : 'int'} ${functionality}Data;

void setup() {
  attachInterrupt(digitalPinToInterrupt(PIN), ${functionality}ISR, CHANGE);
}

void ${functionality}ISR() {
  ${functionality}Data = /* read sensor/input */;
  ${functionality}Flag = true;
}

void loop() {
  if (${functionality}Flag) {
    // Disable interrupts during critical section
    noInterrupts();
    ${sharedVariables.length > 0 ? sharedVariables[0] + '_type' : 'int'} localData = ${functionality}Data;
    ${functionality}Flag = false;
    interrupts();
    
    // Process data safely
    process${functionality}(localData);
  }
}`,
        description: 'External interrupt pattern with safe data sharing'
      },
      
      timer: {
        template: `volatile bool ${functionality}Ready = false;
volatile unsigned long ${functionality}Counter = 0;

ISR(TIMER1_COMPA_vect) {
  ${functionality}Counter++;
  if (${functionality}Counter >= TARGET_COUNT) {
    ${functionality}Ready = true;
    ${functionality}Counter = 0;
  }
}

void setup() {
  // Configure Timer1
  cli();
  TCCR1A = 0;
  TCCR1B = 0;
  TCNT1 = 0;
  
  // Set compare match register
  OCR1A = 15624; // 1 second at 16MHz with 1024 prescaler
  
  TCCR1B |= (1 << WGM12); // CTC mode
  TCCR1B |= (1 << CS12) | (1 << CS10); // 1024 prescaler
  TIMSK1 |= (1 << OCIE1A); // Enable timer compare interrupt
  sei();
}

void loop() {
  if (${functionality}Ready) {
    ${functionality}Ready = false;
    // Execute timed functionality
    execute${functionality}();
  }
}`,
        description: 'Timer interrupt pattern for periodic operations'
      },
      
      serial: {
        template: `volatile bool ${functionality}Available = false;
volatile char ${functionality}Buffer[BUFFER_SIZE];
volatile uint8_t ${functionality}Index = 0;

void setup() {
  Serial.begin(9600);
}

void serialEvent() {
  while (Serial.available()) {
    char c = Serial.read();
    
    if (c == '\\n' || ${functionality}Index >= BUFFER_SIZE - 1) {
      ${functionality}Buffer[${functionality}Index] = '\\0';
      ${functionality}Available = true;
      ${functionality}Index = 0;
    } else {
      ${functionality}Buffer[${functionality}Index++] = c;
    }
  }
}

void loop() {
  if (${functionality}Available) {
    ${functionality}Available = false;
    
    // Copy buffer safely
    char localBuffer[BUFFER_SIZE];
    noInterrupts();
    strcpy(localBuffer, (char*)${functionality}Buffer);
    interrupts();
    
    // Process command
    process${functionality}Command(localBuffer);
  }
}`,
        description: 'Serial interrupt pattern for command processing'
      }
    };
    
    const selectedPattern = patterns[interruptType] || patterns.external;
    
    const codeGeneration = {
      functionality,
      interruptType,
      pattern: selectedPattern,
      safetyGuidelines: [
        'Always use volatile for variables shared between ISR and main code',
        'Keep ISR code as short as possible',
        'Use atomic operations for critical sections',
        'Avoid Serial.print() and delays in ISR',
        'Use flags for communication between ISR and main loop'
      ],
      sharedVariables: sharedVariables.map(variable => ({
        name: variable,
        declaration: `volatile ${this.inferVariableType(variable)} ${variable};`,
        accessPattern: 'Read in ISR, process in main loop'
      })),
      optimizations: [
        'Use bit manipulation for flags to save memory',
        'Consider using ring buffers for data streams',
        'Implement debouncing for mechanical inputs',
        'Use watchdog timer for system reliability'
      ]
    };
    
    return {
      content: [{
        type: 'text',
        text: JSON.stringify(codeGeneration, null, 2)
      }]
    };
  }

  // Helper methods
  checkSpecialPinConflicts(validation, boardSpec) {
    const pinMap = validation.pinMap;
    
    // Check I2C pin conflicts
    if (pinMap.has(boardSpec.i2cPins.sda) || pinMap.has(boardSpec.i2cPins.scl)) {
      validation.warnings.push({
        type: 'i2c_conflict',
        message: `I2C pins (SDA: ${boardSpec.i2cPins.sda}, SCL: ${boardSpec.i2cPins.scl}) are being used for other purposes`,
        severity: 'warning'
      });
    }
    
    // Check SPI pin conflicts
    const spiPins = Object.values(boardSpec.spiPins);
    const spiConflicts = spiPins.filter(pin => pinMap.has(pin));
    if (spiConflicts.length > 0) {
      validation.warnings.push({
        type: 'spi_conflict',
        message: `SPI pins (${spiConflicts.join(', ')}) are being used for other purposes`,
        severity: 'warning'
      });
    }
    
    // Check Serial pin conflicts
    if (pinMap.has(boardSpec.serialPins.rx) || pinMap.has(boardSpec.serialPins.tx)) {
      validation.warnings.push({
        type: 'serial_conflict',
        message: `Serial pins (RX: ${boardSpec.serialPins.rx}, TX: ${boardSpec.serialPins.tx}) are being used for other purposes`,
        severity: 'warning'
      });
    }
  }

  generateHardwareSuggestions(validation, boardSpec, components) {
    // Suggest alternative pins for conflicts
    validation.issues.filter(issue => issue.type === 'pin_conflict').forEach(conflict => {
      const availablePins = boardSpec.digitalPins.filter(pin => 
        !validation.pinMap.has(pin) && pin !== conflict.pin
      );
      
      if (availablePins.length > 0) {
        validation.suggestions.push({
          type: 'alternative_pin',
          message: `Consider using alternative pins: ${availablePins.slice(0, 3).join(', ')}`,
          conflictPin: conflict.pin
        });
      }
    });
    
    // Suggest power considerations
    const totalComponents = components.length;
    if (totalComponents > 5) {
      validation.suggestions.push({
        type: 'power_consideration',
        message: 'Consider external power supply for multiple components',
        reason: `${totalComponents} components detected`
      });
    }
  }

  estimateExecutionTime(entity, calledFunctions) {
    // Rough estimation based on complexity and function calls
    let baseTime = entity.complexity * 2; // 2µs per complexity point
    
    // Add time for function calls
    calledFunctions.forEach(func => {
      baseTime += (func.complexity || 1) * 1.5;
    });
    
    // Add time for hardware calls
    if (entity.hardwareCalls) {
      baseTime += entity.hardwareCalls * 5; // 5µs per hardware call
    }
    
    return Math.round(baseTime);
  }

  calculateWorstCaseTime(entity, calledFunctions) {
    return this.estimateExecutionTime(entity, calledFunctions) * 2;
  }

  calculateAverageTime(entity, calledFunctions) {
    return this.estimateExecutionTime(entity, calledFunctions) * 0.7;
  }

  calculateInterruptLatency(entity) {
    // ISR entry/exit overhead + execution time
    const overhead = 4; // µs for context switching
    const executionTime = this.estimateExecutionTime(entity, []);
    return overhead + executionTime;
  }

  estimateLoopIterations(entity) {
    // Simple heuristic based on complexity
    return Math.max(1, Math.floor(entity.complexity / 3));
  }

  estimateWorstCaseIterations(entity) {
    return this.estimateLoopIterations(entity) * 10;
  }

  findCriticalSections(entity) {
    const sections = [];
    
    if (entity.usesInterrupts) {
      sections.push('Interrupt enable/disable sections');
    }
    
    if (entity.isISR) {
      sections.push('Entire ISR is critical');
    }
    
    return sections;
  }

  inferVariableType(variableName) {
    const name = variableName.toLowerCase();
    
    if (name.includes('count') || name.includes('index')) return 'uint16_t';
    if (name.includes('flag') || name.includes('state')) return 'bool';
    if (name.includes('buffer') || name.includes('data')) return 'uint8_t';
    if (name.includes('time') || name.includes('millis')) return 'unsigned long';
    
    return 'int'; // Default
  }

  async storeArduinoAnalysis(analysis) {
    try {
      // Store sketch analysis as a project entity
      const sketchProps = {
        id: `sketch:${path.basename(analysis.sketchPath)}`,
        name: path.basename(analysis.sketchPath),
        type: 'arduino_sketch',
        filePath: analysis.sketchPath,
        targetBoard: analysis.targetBoard,
        complexity: analysis.overallComplexity,
        ramUsage: analysis.memoryEstimate.ram,
        flashUsage: analysis.memoryEstimate.flash,
        eepromUsage: analysis.memoryEstimate.eeprom,
        analyzedAt: new Date().toISOString()
      };
      
      await this.kuzu.createNode('CodeEntity', sketchProps);
      
      // Store hardware components
      for (const [pin, usage] of analysis.hardwareUsage.pins.entries()) {
        const componentProps = {
          id: `hw:${analysis.targetBoard}:pin:${pin}`,
          type: 'pin',
          pin: pin,
          usage: JSON.stringify(usage),
          board: analysis.targetBoard,
          sketchId: sketchProps.id
        };
        
        await this.kuzu.createNode('HardwareComponent', componentProps);
        
        // Create relationship
        await this.kuzu.createRelationship(
          sketchProps.id,
          'USES_HARDWARE',
          componentProps.id
        );
      }
      
      // Store protocol usage
      for (const protocol of analysis.hardwareUsage.protocols) {
        const protocolProps = {
          id: `hw:${analysis.targetBoard}:${protocol.type}:${Date.now()}`,
          type: protocol.type,
          board: analysis.targetBoard,
          sketchId: sketchProps.id,
          ...protocol
        };
        
        await this.kuzu.createNode('HardwareComponent', protocolProps);
        
        await this.kuzu.createRelationship(
          sketchProps.id,
          'USES_PROTOCOL',
          protocolProps.id
        );
      }
      
      logger.info(`Stored Arduino analysis for ${analysis.sketchPath}`);
      
    } catch (error) {
      logger.error('Error storing Arduino analysis:', error);
    }
  }
}