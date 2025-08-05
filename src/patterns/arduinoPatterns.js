export const arduinoPatterns = [
  {
    id: 'arduino_state_machine',
    name: 'Non-blocking State Machine',
    category: 'behavioral',
    type: 'arduino',
    description: 'Non-blocking state machine pattern for Arduino to avoid delay() calls',
    template: `enum State {
  STATE_IDLE,
  STATE_READING,
  STATE_PROCESSING,
  STATE_COMPLETE,
  STATE_ERROR
};

State currentState = STATE_IDLE;
unsigned long stateTimer = 0;
const unsigned long STATE_TIMEOUT = 5000; // 5 seconds

void setup() {
  Serial.begin(9600);
  currentState = STATE_IDLE;
}

void loop() {
  updateStateMachine();
  // Other non-blocking operations can run here
}

void updateStateMachine() {
  switch(currentState) {
    case STATE_IDLE:
      if (shouldStartReading()) {
        currentState = STATE_READING;
        stateTimer = millis();
        Serial.println("Starting reading...");
      }
      break;
      
    case STATE_READING:
      if (readingComplete()) {
        currentState = STATE_PROCESSING;
        stateTimer = millis();
      } else if (millis() - stateTimer > STATE_TIMEOUT) {
        currentState = STATE_ERROR;
      }
      break;
      
    case STATE_PROCESSING:
      if (processingComplete()) {
        currentState = STATE_COMPLETE;
      } else if (millis() - stateTimer > STATE_TIMEOUT) {
        currentState = STATE_ERROR;
      }
      break;
      
    case STATE_COMPLETE:
      Serial.println("Operation complete!");
      currentState = STATE_IDLE;
      break;
      
    case STATE_ERROR:
      Serial.println("Error occurred, resetting...");
      currentState = STATE_IDLE;
      break;
  }
}`,
    benefits: [
      'Avoids blocking delay() calls',
      'Allows multiple operations to run concurrently',
      'Provides timeout protection',
      'Clear state transitions',
      'Easy to debug and extend'
    ],
    applicability: [
      'Sensor reading sequences',
      'Communication protocols',
      'User interface handling',
      'Multi-step operations'
    ],
    antipatterns: [
      'Using delay() in main loop',
      'Blocking operations',
      'No timeout handling'
    ]
  },

  {
    id: 'arduino_interrupt_safe_data',
    name: 'Interrupt-Safe Data Sharing',
    category: 'concurrency',
    type: 'arduino',
    description: 'Safe pattern for sharing data between ISRs and main code',
    template: `// Shared data between ISR and main code
volatile bool dataReady = false;
volatile uint16_t sensorData = 0;
volatile unsigned long lastReadTime = 0;

// Buffer for multiple readings
#define BUFFER_SIZE 8
volatile uint16_t dataBuffer[BUFFER_SIZE];
volatile uint8_t bufferHead = 0;
volatile uint8_t bufferTail = 0;

void setup() {
  Serial.begin(9600);
  
  // Configure interrupt (example for Timer1)
  cli(); // Disable interrupts during setup
  
  // Timer1 configuration for 1Hz interrupts
  TCCR1A = 0;
  TCCR1B = 0;
  TCNT1 = 0;
  OCR1A = 15624; // (16MHz / (1024 * 1Hz)) - 1
  TCCR1B |= (1 << WGM12); // CTC mode
  TCCR1B |= (1 << CS12) | (1 << CS10); // 1024 prescaler
  TIMSK1 |= (1 << OCIE1A); // Enable timer compare interrupt
  
  sei(); // Enable interrupts
}

// ISR - Keep minimal and fast
ISR(TIMER1_COMPA_vect) {
  // Read sensor data
  sensorData = analogRead(A0);
  lastReadTime = millis();
  
  // Add to circular buffer
  uint8_t nextHead = (bufferHead + 1) % BUFFER_SIZE;
  if (nextHead != bufferTail) { // Buffer not full
    dataBuffer[bufferHead] = sensorData;
    bufferHead = nextHead;
  }
  
  dataReady = true;
}

void loop() {
  // Check for new data
  if (dataReady) {
    // Critical section - disable interrupts
    cli();
    
    // Copy volatile data to local variables
    uint16_t localData = sensorData;
    unsigned long localTime = lastReadTime;
    bool hasBufferData = (bufferHead != bufferTail);
    
    // Clear flag
    dataReady = false;
    
    sei(); // Re-enable interrupts
    
    // Process data safely outside critical section
    Serial.print("Sensor reading: ");
    Serial.print(localData);
    Serial.print(" at time: ");
    Serial.println(localTime);
    
    // Process buffer data if available
    if (hasBufferData) {
      processBufferData();
    }
  }
  
  // Other main loop operations
  handleUserInput();
}

void processBufferData() {
  while (bufferHead != bufferTail) {
    cli(); // Start critical section
    uint16_t data = dataBuffer[bufferTail];
    bufferTail = (bufferTail + 1) % BUFFER_SIZE;
    sei(); // End critical section
    
    // Process individual data point
    analyzeData(data);
  }
}`,
    benefits: [
      'Thread-safe data sharing',
      'Minimal ISR execution time',
      'Prevents data corruption',
      'Circular buffer for multiple readings'
    ],
    applicability: [
      'Timer-based sensor readings',
      'External interrupt handling',
      'Serial communication',
      'Real-time data acquisition'
    ],
    rules: [
      'Always use volatile for shared variables',
      'Keep ISR code minimal',
      'Use critical sections for multi-byte data',
      'Never use Serial.print() in ISR'
    ]
  },

  {
    id: 'arduino_memory_optimization',
    name: 'Memory-Efficient Programming',
    category: 'optimization',
    type: 'arduino',
    description: 'Patterns for optimizing memory usage on resource-constrained devices',
    template: `// Use PROGMEM for string literals and constants
const char WELCOME_MSG[] PROGMEM = "Welcome to Arduino System";
const char ERROR_MSG[] PROGMEM = "Error: Invalid input";
const char STATUS_MSG[] PROGMEM = "System status: OK";

// Store lookup tables in flash memory
const uint8_t SINE_TABLE[] PROGMEM = {
  128, 131, 134, 137, 140, 143, 146, 149,
  152, 155, 158, 162, 165, 167, 170, 173
  // ... more values
};

// Use appropriate data types
uint8_t ledPin = 13;        // 1 byte instead of int (2 bytes)
bool systemEnabled = false; // 1 byte instead of int
uint16_t sensorValue;       // 2 bytes for values 0-65535

// Bit manipulation for multiple boolean flags
#define FLAG_SENSOR_ACTIVE    0
#define FLAG_LED_STATE        1
#define FLAG_COMM_READY       2
#define FLAG_ERROR_DETECTED   3

uint8_t systemFlags = 0;    // 8 flags in 1 byte

void setup() {
  Serial.begin(9600);
  
  // Initialize flags
  bitSet(systemFlags, FLAG_SENSOR_ACTIVE);
  bitClear(systemFlags, FLAG_ERROR_DETECTED);
}

void loop() {
  // Check flags efficiently
  if (bitRead(systemFlags, FLAG_SENSOR_ACTIVE)) {
    readSensors();
  }
  
  if (bitRead(systemFlags, FLAG_COMM_READY)) {
    handleCommunication();
  }
  
  // Use F() macro for debug strings
  if (bitRead(systemFlags, FLAG_ERROR_DETECTED)) {
    Serial.println(F("System error detected"));
  }
}

// Function to read from PROGMEM
void printMessage(const char* message) {
  char buffer[64];
  strcpy_P(buffer, message);
  Serial.println(buffer);
}

// Memory-efficient string handling
void handleCommand(const __FlashStringHelper* cmd) {
  if (strcmp_P((char*)cmd, PSTR("start")) == 0) {
    bitSet(systemFlags, FLAG_SENSOR_ACTIVE);
    printMessage(STATUS_MSG);
  } else if (strcmp_P((char*)cmd, PSTR("stop")) == 0) {
    bitClear(systemFlags, FLAG_SENSOR_ACTIVE);
  }
}

// Use unions for different data interpretations
union DataConverter {
  float floatValue;
  uint8_t bytes[4];
  uint32_t longValue;
};

// Stack-efficient recursive alternative
void processDataIterative(uint8_t* data, uint8_t length) {
  for (uint8_t i = 0; i < length; i++) {
    // Process each element
    data[i] = data[i] * 2 + 1;
  }
}`,
    benefits: [
      'Reduced RAM usage',
      'More space for variables',
      'Better system stability',
      'Efficient flag management'
    ],
    techniques: [
      'PROGMEM for constants',
      'Appropriate data types',
      'Bit manipulation',
      'F() macro for strings',
      'Avoid recursion'
    ],
    applicability: [
      'Arduino Uno/Nano projects',
      'Systems with many string messages',
      'Multiple boolean states',
      'Lookup tables and constants'
    ]
  },

  {
    id: 'arduino_sensor_manager',
    name: 'Multi-Sensor Management',
    category: 'structural',
    type: 'arduino',
    description: 'Organized approach to handling multiple sensors with different read intervals',
    template: `// Sensor structure for organized management
struct Sensor {
  uint8_t pin;
  unsigned long interval;
  unsigned long lastRead;
  uint16_t value;
  uint16_t minValue;
  uint16_t maxValue;
  bool active;
  void (*readFunction)(struct Sensor*);
};

// Forward declarations
void readTemperature(struct Sensor* sensor);
void readHumidity(struct Sensor* sensor);
void readLight(struct Sensor* sensor);

// Sensor definitions
Sensor sensors[] = {
  {A0, 1000, 0, 0, 0, 1023, true, readTemperature},  // Temperature every 1s
  {A1, 2000, 0, 0, 0, 1023, true, readHumidity},     // Humidity every 2s
  {A2, 500,  0, 0, 0, 1023, true, readLight},        // Light every 0.5s
};

const uint8_t SENSOR_COUNT = sizeof(sensors) / sizeof(Sensor);

void setup() {
  Serial.begin(9600);
  Serial.println(F("Multi-Sensor Manager Starting..."));
  
  // Initialize sensors
  for (uint8_t i = 0; i < SENSOR_COUNT; i++) {
    sensors[i].lastRead = millis();
  }
}

void loop() {
  updateSensors();
  checkAlerts();
  handleSerial();
  
  // Small delay to prevent overwhelming the system
  delay(10);
}

void updateSensors() {
  unsigned long currentTime = millis();
  
  for (uint8_t i = 0; i < SENSOR_COUNT; i++) {
    if (sensors[i].active && 
        (currentTime - sensors[i].lastRead >= sensors[i].interval)) {
      
      // Read sensor using function pointer
      sensors[i].readFunction(&sensors[i]);
      sensors[i].lastRead = currentTime;
      
      // Update min/max values
      if (sensors[i].value < sensors[i].minValue) {
        sensors[i].minValue = sensors[i].value;
      }
      if (sensors[i].value > sensors[i].maxValue) {
        sensors[i].maxValue = sensors[i].value;
      }
    }
  }
}

// Sensor reading functions
void readTemperature(struct Sensor* sensor) {
  sensor->value = analogRead(sensor->pin);
  
  // Convert to temperature (example for TMP36)
  float voltage = sensor->value * 5.0 / 1024.0;
  float temperature = (voltage - 0.5) * 100.0;
  
  Serial.print(F("Temperature: "));
  Serial.print(temperature);
  Serial.println(F("°C"));
}

void readHumidity(struct Sensor* sensor) {
  sensor->value = analogRead(sensor->pin);
  
  // Convert to humidity percentage
  float humidity = map(sensor->value, 0, 1023, 0, 100);
  
  Serial.print(F("Humidity: "));
  Serial.print(humidity);
  Serial.println(F("%"));
}

void readLight(struct Sensor* sensor) {
  sensor->value = analogRead(sensor->pin);
  
  Serial.print(F("Light level: "));
  Serial.println(sensor->value);
}

void checkAlerts() {
  // Check for alert conditions
  if (sensors[0].value > 800) { // Temperature too high
    Serial.println(F("ALERT: High temperature!"));
  }
  
  if (sensors[2].value < 100) { // Too dark
    Serial.println(F("ALERT: Low light level!"));
  }
}

void handleSerial() {
  if (Serial.available()) {
    String command = Serial.readStringUntil('\\n');
    command.trim();
    
    if (command == "status") {
      printSensorStatus();
    } else if (command == "reset") {
      resetMinMax();
    } else if (command.startsWith("disable ")) {
      uint8_t sensorIndex = command.substring(8).toInt();
      if (sensorIndex < SENSOR_COUNT) {
        sensors[sensorIndex].active = false;
        Serial.println(F("Sensor disabled"));
      }
    }
  }
}

void printSensorStatus() {
  Serial.println(F("\\n=== Sensor Status ==="));
  for (uint8_t i = 0; i < SENSOR_COUNT; i++) {
    Serial.print(F("Sensor "));
    Serial.print(i);
    Serial.print(F(": Value="));
    Serial.print(sensors[i].value);
    Serial.print(F(", Min="));
    Serial.print(sensors[i].minValue);
    Serial.print(F(", Max="));
    Serial.print(sensors[i].maxValue);
    Serial.print(F(", Active="));
    Serial.println(sensors[i].active ? F("Yes") : F("No"));
  }
  Serial.println();
}

void resetMinMax() {
  for (uint8_t i = 0; i < SENSOR_COUNT; i++) {
    sensors[i].minValue = 1023;
    sensors[i].maxValue = 0;
  }
  Serial.println(F("Min/Max values reset"));
}`,
    benefits: [
      'Organized sensor management',
      'Different read intervals',
      'Function pointer flexibility',
      'Automatic min/max tracking',
      'Serial command interface'
    ],
    applicability: [
      'Environmental monitoring',
      'Data logging systems',
      'IoT sensor nodes',
      'Home automation'
    ]
  },

  {
    id: 'arduino_power_management',
    name: 'Power-Efficient Operation',
    category: 'optimization',
    type: 'arduino',
    description: 'Patterns for minimizing power consumption in battery-powered projects',
    template: `#include <avr/sleep.h>
#include <avr/wdt.h>
#include <avr/power.h>

// Power management states
enum PowerMode {
  POWER_ACTIVE,
  POWER_IDLE,
  POWER_SLEEP,
  POWER_DEEP_SLEEP
};

PowerMode currentPowerMode = POWER_ACTIVE;
volatile bool wakeupFlag = false;
volatile uint8_t watchdogCount = 0;

// Configuration
const uint8_t SENSOR_PIN = A0;
const uint8_t LED_PIN = 13;
const uint8_t WAKEUP_PIN = 2;

// Timing
const uint16_t ACTIVE_TIME = 5000;      // 5 seconds active
const uint8_t SLEEP_CYCLES = 8;         // 8 * 8 seconds = 64 seconds sleep
unsigned long lastActiveTime = 0;

void setup() {
  Serial.begin(9600);
  
  // Configure pins
  pinMode(LED_PIN, OUTPUT);
  pinMode(WAKEUP_PIN, INPUT_PULLUP);
  
  // Configure external interrupt for wakeup
  attachInterrupt(digitalPinToInterrupt(WAKEUP_PIN), wakeupISR, FALLING);
  
  // Disable unused peripherals to save power
  disableUnusedPeripherals();
  
  Serial.println(F("Power Management System Started"));
  lastActiveTime = millis();
}

void loop() {
  switch (currentPowerMode) {
    case POWER_ACTIVE:
      handleActiveMode();
      break;
      
    case POWER_IDLE:
      handleIdleMode();
      break;
      
    case POWER_SLEEP:
      handleSleepMode();
      break;
      
    case POWER_DEEP_SLEEP:
      handleDeepSleepMode();
      break;
  }
}

void handleActiveMode() {
  // Perform normal operations
  uint16_t sensorValue = analogRead(SENSOR_PIN);
  
  // Blink LED to show activity
  digitalWrite(LED_PIN, HIGH);
  delay(100);
  digitalWrite(LED_PIN, LOW);
  
  Serial.print(F("Sensor: "));
  Serial.println(sensorValue);
  
  // Check if it's time to sleep
  if (millis() - lastActiveTime > ACTIVE_TIME) {
    Serial.println(F("Entering sleep mode"));
    Serial.flush(); // Wait for serial transmission to complete
    
    currentPowerMode = POWER_DEEP_SLEEP;
    watchdogCount = 0;
  }
  
  delay(1000);
}

void handleIdleMode() {
  // Light sleep - can wake up quickly
  set_sleep_mode(SLEEP_MODE_IDLE);
  sleep_enable();
  sleep_mode();
  sleep_disable();
  
  // Check for wakeup conditions
  if (wakeupFlag) {
    wakeupFlag = false;
    currentPowerMode = POWER_ACTIVE;
    lastActiveTime = millis();
  }
}

void handleSleepMode() {
  // Power-down sleep with watchdog timer
  setupWatchdog(WDTO_8S); // 8-second watchdog
  
  set_sleep_mode(SLEEP_MODE_PWR_DOWN);
  sleep_enable();
  
  // Turn off BOD (Brown-out Detector) for maximum power savings
  sleep_bod_disable();
  sleep_mode();
  
  // Execution resumes here after wakeup
  sleep_disable();
  
  // Check wakeup source
  if (wakeupFlag) {
    wakeupFlag = false;
    currentPowerMode = POWER_ACTIVE;
    lastActiveTime = millis();
    Serial.println(F("Woken up by external interrupt"));
  } else {
    watchdogCount++;
    if (watchdogCount >= SLEEP_CYCLES) {
      currentPowerMode = POWER_ACTIVE;
      lastActiveTime = millis();
      Serial.println(F("Woken up by watchdog timer"));
    }
  }
}

void handleDeepSleepMode() {
  // Prepare for deep sleep
  prepareForSleep();
  
  // Enter deep sleep
  handleSleepMode();
  
  // Restore after wakeup
  restoreAfterWakeup();
}

// Interrupt Service Routines
void wakeupISR() {
  wakeupFlag = true;
}

ISR(WDT_vect) {
  // Watchdog interrupt - used for timed wakeup
}

// Power management functions
void disableUnusedPeripherals() {
  // Disable unused modules to save power
  power_adc_disable();    // Disable ADC (enable when needed)
  power_spi_disable();    // Disable SPI
  power_twi_disable();    // Disable I2C
  power_timer1_disable(); // Disable Timer1
  power_timer2_disable(); // Disable Timer2
}

void prepareForSleep() {
  // Turn off all LEDs
  digitalWrite(LED_PIN, LOW);
  
  // Disable ADC
  ADCSRA &= ~(1 << ADEN);
  
  // Set all pins to minimize current draw
  for (uint8_t pin = 0; pin < 20; pin++) {
    if (pin != WAKEUP_PIN) {
      pinMode(pin, INPUT);
      digitalWrite(pin, LOW);
    }
  }
}

void restoreAfterWakeup() {
  // Re-enable ADC
  ADCSRA |= (1 << ADEN);
  
  // Restore pin configurations
  pinMode(LED_PIN, OUTPUT);
  pinMode(SENSOR_PIN, INPUT);
  
  // Re-enable needed peripherals
  power_adc_enable();
}

void setupWatchdog(uint8_t prescaler) {
  wdt_reset();
  
  // Start timed sequence
  WDTCSR = (1 << WDCE) | (1 << WDE);
  
  // Set new watchdog timeout and enable interrupt mode
  WDTCSR = (1 << WDIE) | prescaler;
}

// Power measurement helper
uint16_t readVcc() {
  // Read internal 1.1V reference against AVcc
  ADMUX = _BV(REFS0) | _BV(MUX3) | _BV(MUX2) | _BV(MUX1);
  delay(2); // Wait for Vref to settle
  
  ADCSRA |= _BV(ADSC); // Convert
  while (bit_is_set(ADCSRA, ADSC));
  
  uint16_t result = ADCL;
  result |= ADCH << 8;
  result = 1126400L / result; // Back-calculate AVcc in mV
  
  return result;
}`,
    benefits: [
      'Significant power savings',
      'Extended battery life',
      'Configurable sleep modes',
      'Watchdog timer integration',
      'External interrupt wakeup'
    ],
    powerSavings: [
      'Active mode: ~20mA',
      'Idle mode: ~15mA',
      'Power-down mode: ~0.1mA',
      'Deep sleep: <0.01mA'
    ],
    applicability: [
      'Battery-powered sensors',
      'Remote monitoring stations',
      'Wearable devices',
      'Low-power IoT nodes'
    ]
  }
];

// Function to get pattern by ID
export function getArduinoPattern(patternId) {
  return arduinoPatterns.find(pattern => pattern.id === patternId);
}

// Function to get patterns by category
export function getPatternsByCategory(category) {
  return arduinoPatterns.filter(pattern => pattern.category === category);
}

// Function to get all Arduino pattern IDs
export function getArduinoPatternIds() {
  return arduinoPatterns.map(pattern => pattern.id);
}

// Function to search patterns by keyword
export function searchArduinoPatterns(keyword) {
  const lowerKeyword = keyword.toLowerCase();
  return arduinoPatterns.filter(pattern => 
    pattern.name.toLowerCase().includes(lowerKeyword) ||
    pattern.description.toLowerCase().includes(lowerKeyword) ||
    pattern.category.toLowerCase().includes(lowerKeyword)
  );
}