#!/usr/bin/env node

import chalk from 'chalk';

console.log(chalk.green('CLI test successful!'));
console.log('Available commands:');
console.log('  backup <output>    - Create backup of Knowledge Graph');
console.log('  restore <backup>   - Restore from backup');
console.log('  clean             - Clean database and temp files');
console.log('  health            - Check system health');