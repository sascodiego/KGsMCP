/**
 * Jest global teardown - runs once after all tests
 * CONTEXT: Global test environment cleanup
 * REASON: Clean up test resources, databases, and temporary files
 * CHANGE: Comprehensive cleanup to prevent resource leaks
 * PREVENTION: Resource leaks, file system pollution, hanging processes
 */

import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default async function globalTeardown() {
  console.log('🧹 Cleaning up global test environment...');
  
  try {
    // Clean up test directories
    const testDirs = [
      path.join(__dirname, 'temp'),
      path.join(__dirname, 'db'),
      path.join(__dirname, 'fixtures'),
      path.join(__dirname, 'data')
    ];
    
    for (const dir of testDirs) {
      try {
        await fs.rmdir(dir, { recursive: true });
      } catch (error) {
        // Directory might not exist or might be in use
        console.warn(`Warning: Could not remove ${dir}:`, error.message);
      }
    }
    
    // Clear environment variables
    delete process.env.TEST_DB_PATH;
    delete process.env.TEST_MODE;
    
    // Force garbage collection if available
    if (global.gc) {
      global.gc();
    }
    
    console.log('✅ Global test environment cleanup complete');
    
  } catch (error) {
    console.error('❌ Global test teardown failed:', error);
    // Don't throw error as it might prevent other cleanup
  }
}