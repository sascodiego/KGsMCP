/**
 * Jest global setup - runs once before all tests
 * CONTEXT: Global test environment initialization
 * REASON: Setup test databases, mock services, and test infrastructure
 * CHANGE: Initialize test environment with proper isolation
 * PREVENTION: Test environment conflicts, resource leaks, setup failures
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function globalSetup() {
  console.log('🧪 Setting up global test environment...');
  
  try {
    // Create test directories
    const testDirs = [
      path.join(__dirname, 'temp'),
      path.join(__dirname, 'fixtures'),
      path.join(__dirname, 'data'),
      path.join(__dirname, 'db')
    ];
    
    for (const dir of testDirs) {
      await fs.mkdir(dir, { recursive: true });
    }
    
    // Create test database directory
    const testDbPath = path.join(__dirname, 'db', 'test-kuzu-db');
    await fs.mkdir(testDbPath, { recursive: true });
    
    // Set environment variables for tests
    process.env.NODE_ENV = 'test';
    process.env.LOG_LEVEL = 'error'; // Reduce logging noise in tests
    process.env.TEST_DB_PATH = testDbPath;
    process.env.TEST_MODE = 'true';
    
    // Create test configuration
    const testConfig = {
      kuzu: {
        databasePath: testDbPath,
        readOnly: false,
        bufferPoolSize: '512MB',
        maxNumThreads: 2
      },
      logging: {
        enabled: false,
        level: 'error'
      },
      testing: {
        mockExternalServices: true,
        enablePerformanceMetrics: true,
        timeoutMs: 30000
      }
    };
    
    await fs.writeFile(
      path.join(__dirname, 'config', 'test.json'),
      JSON.stringify(testConfig, null, 2)
    );
    
    // Initialize test fixtures
    await createTestFixtures();
    
    console.log('✅ Global test environment setup complete');
    
  } catch (error) {
    console.error('❌ Global test setup failed:', error);
    throw error;
  }
}

async function createTestFixtures() {
  const fixturesDir = path.join(__dirname, 'fixtures');
  
  // Create sample codebase structure
  const sampleCodebase = {
    'package.json': JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      type: 'module',
      dependencies: {
        'express': '^4.18.0',
        'lodash': '^4.17.21'
      }
    }, null, 2),
    
    'src/index.js': `
/**
 * CONTEXT: Main application entry point
 * REASON: Centralized application initialization
 * CHANGE: Express server setup with middleware
 * PREVENTION: Server startup failures, middleware conflicts
 */
import express from 'express';
import { userRouter } from './routes/userRouter.js';
import { DatabaseManager } from './database/DatabaseManager.js';

const app = express();
const dbManager = new DatabaseManager();

app.use(express.json());
app.use('/api/users', userRouter);

app.listen(3000, () => {
  console.log('Server running on port 3000');
});

export default app;
    `,
    
    'src/routes/userRouter.js': `
/**
 * CONTEXT: User management routes
 * REASON: RESTful API for user operations
 * CHANGE: Express router with CRUD operations
 * PREVENTION: Route conflicts, validation bypass
 */
import { Router } from 'express';
import { UserService } from '../services/UserService.js';

const router = Router();
const userService = new UserService();

router.get('/', async (req, res) => {
  try {
    const users = await userService.getAllUsers();
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', async (req, res) => {
  try {
    const user = await userService.createUser(req.body);
    res.status(201).json(user);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

export { router as userRouter };
    `,
    
    'src/services/UserService.js': `
/**
 * CONTEXT: User business logic service
 * REASON: Encapsulation of user-related operations
 * CHANGE: Service layer with validation and database access
 * PREVENTION: Business logic scattered across controllers
 */
import { DatabaseManager } from '../database/DatabaseManager.js';
import { UserValidator } from '../validators/UserValidator.js';

export class UserService {
  constructor() {
    this.db = new DatabaseManager();
    this.validator = new UserValidator();
  }
  
  async getAllUsers() {
    return await this.db.query('SELECT * FROM users');
  }
  
  async createUser(userData) {
    this.validator.validate(userData);
    return await this.db.insert('users', userData);
  }
  
  async getUserById(id) {
    return await this.db.findById('users', id);
  }
}
    `,
    
    'hardware/sensor.ino': `
/**
 * CONTEXT: Temperature sensor Arduino sketch
 * REASON: Environmental monitoring system
 * CHANGE: Sensor reading with calibration and filtering
 * PREVENTION: Noisy sensor readings, calibration drift
 */
#include <Arduino.h>
#include <OneWire.h>
#include <DallasTemperature.h>

#define ONE_WIRE_BUS 2
#define TEMPERATURE_PRECISION 12

OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

void setup() {
  Serial.begin(9600);
  sensors.begin();
  sensors.setResolution(TEMPERATURE_PRECISION);
}

void loop() {
  sensors.requestTemperatures();
  float temperature = sensors.getTempCByIndex(0);
  
  if (temperature != DEVICE_DISCONNECTED_C) {
    Serial.print("Temperature: ");
    Serial.print(temperature);
    Serial.println(" °C");
  } else {
    Serial.println("Error: Could not read temperature");
  }
  
  delay(1000);
}
    `,
    
    'src/utils/helpers.cpp': `
/**
 * CONTEXT: C++ utility functions for data processing
 * REASON: Performance-critical operations in native code
 * CHANGE: Optimized algorithms with memory management
 * PREVENTION: Memory leaks, buffer overflows, performance degradation
 */
#include <vector>
#include <string>
#include <algorithm>
#include <memory>

class DataProcessor {
private:
    std::vector<double> data;
    
public:
    explicit DataProcessor(size_t capacity) {
        data.reserve(capacity);
    }
    
    void addValue(double value) {
        data.push_back(value);
    }
    
    double calculateAverage() const {
        if (data.empty()) return 0.0;
        
        double sum = 0.0;
        for (const auto& value : data) {
            sum += value;
        }
        return sum / data.size();
    }
    
    std::vector<double> getMovingAverage(size_t windowSize) const {
        std::vector<double> result;
        if (data.size() < windowSize) return result;
        
        for (size_t i = windowSize - 1; i < data.size(); ++i) {
            double sum = 0.0;
            for (size_t j = i - windowSize + 1; j <= i; ++j) {
                sum += data[j];
            }
            result.push_back(sum / windowSize);
        }
        
        return result;
    }
};
    `
  };
  
  // Create directory structure and files
  for (const [filePath, content] of Object.entries(sampleCodebase)) {
    const fullPath = path.join(fixturesDir, 'sample-codebase', filePath);
    await fs.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.writeFile(fullPath, content.trim());
  }
  
  // Create test configuration directory
  await fs.mkdir(path.join(__dirname, 'config'), { recursive: true });
}