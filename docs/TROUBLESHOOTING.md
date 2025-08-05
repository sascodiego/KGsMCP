# Troubleshooting Guide

## Table of Contents

1. [Common Issues](#common-issues)
2. [Installation Problems](#installation-problems)
3. [Database Issues](#database-issues)
4. [Performance Problems](#performance-problems)
5. [Claude Desktop Integration](#claude-desktop-integration)
6. [Arduino/C++ Analysis Issues](#arduinoc-analysis-issues)
7. [Debugging Techniques](#debugging-techniques)
8. [Error Messages](#error-messages)
9. [Recovery Procedures](#recovery-procedures)
10. [Getting Help](#getting-help)

---

## Common Issues

### Issue: "Knowledge Graph is Empty"

**Symptoms:**
- Tools return "no context found"
- `get_kg_statistics` shows 0 entities
- Generated code lacks project-specific patterns

**Diagnosis:**
```bash
# Check if database exists
ls -la .kg-context/

# Check database contents
npx @mcp/vibe-coding-kg get_kg_statistics
```

**Solutions:**

1. **Initialize the Knowledge Graph**
   ```bash
   npx @mcp/vibe-coding-kg init /path/to/your/codebase
   ```

2. **Check File Permissions**
   ```bash
   # Ensure database directory is writable
   chmod 755 .kg-context/
   chmod 644 .kg-context/*
   ```

3. **Verify Supported File Types**
   - Supported: `.js`, `.ts`, `.jsx`, `.tsx`, `.py`, `.java`, `.cpp`, `.c`, `.h`, `.ino`
   - Check `config/default.json` for `includedExtensions`

4. **Check Analysis Configuration**
   ```json
   {
     "analysis": {
       "maxFileSize": 1048576,
       "excludedDirs": [".git", "node_modules"],
       "includedExtensions": [".js", ".ts", ".cpp"]
     }
   }
   ```

### Issue: "Tool Not Found" in Claude Desktop

**Symptoms:**
- Claude Desktop shows "No tools available"
- Error: "Tool 'analyze_codebase' not found"

**Diagnosis:**
```bash
# Test MCP server directly
npx @mcp/vibe-coding-kg start

# Check Claude Desktop configuration
cat ~/.config/Claude/claude_desktop_config.json  # Linux
cat ~/Library/Application\ Support/Claude/claude_desktop_config.json  # macOS
```

**Solutions:**

1. **Verify Configuration**
   ```json
   {
     "mcpServers": {
       "vibe-coding-kg": {
         "command": "npx",
         "args": ["@mcp/vibe-coding-kg", "start"],
         "env": {
           "NODE_ENV": "production"
         }
       }
     }
   }
   ```

2. **Check PATH Environment**
   ```bash
   # Ensure npx is in PATH
   which npx
   
   # Test npx command
   npx @mcp/vibe-coding-kg --help
   ```

3. **Restart Claude Desktop**
   - Close Claude Desktop completely
   - Wait 10 seconds
   - Restart Claude Desktop

4. **Check Logs**
   ```bash
   # Enable debug mode
   LOG_LEVEL=debug npx @mcp/vibe-coding-kg start
   ```

### Issue: "High Memory Usage"

**Symptoms:**
- System becomes slow during analysis
- Out of memory errors
- Process killed by OS

**Diagnosis:**
```bash
# Monitor memory usage
top -p $(pgrep -f "mcp-vibe-coding")

# Check Node.js memory
node --max-old-space-size=4096 --inspect index.js
```

**Solutions:**

1. **Increase Node.js Memory Limit**
   ```bash
   export NODE_OPTIONS="--max-old-space-size=4096"
   npx @mcp/vibe-coding-kg start
   ```

2. **Enable Memory Optimization**
   ```json
   {
     "optimization": {
       "memory": {
         "enabled": true,
         "gcInterval": 300000,
         "heapLimit": "2GB"
       }
     }
   }
   ```

3. **Reduce Analysis Scope**
   ```json
   {
     "analysis": {
       "maxFileSize": 512000,
       "maxConcurrentFiles": 5,
       "excludedDirs": ["node_modules", "dist", "build"]
     }
   }
   ```

---

## Installation Problems

### Issue: "npm install" Fails

**Common Error Messages:**
- `gyp ERR! stack Error: EACCES: permission denied`
- `npm ERR! code ELIFECYCLE`
- `Python executable not found`

**Solutions:**

1. **Fix npm Permissions**
   ```bash
   # Option 1: Use npm's default directory
   mkdir ~/.npm-global
   npm config set prefix '~/.npm-global'
   echo 'export PATH=~/.npm-global/bin:$PATH' >> ~/.profile
   source ~/.profile
   
   # Option 2: Use Node Version Manager
   curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
   nvm install 18
   nvm use 18
   ```

2. **Install Build Tools**
   ```bash
   # Ubuntu/Debian
   sudo apt-get install build-essential python3
   
   # macOS
   xcode-select --install
   
   # Windows
   npm install --global windows-build-tools
   ```

3. **Clear npm Cache**
   ```bash
   npm cache clean --force
   rm -rf node_modules package-lock.json
   npm install
   ```

### Issue: "Kuzu Database Installation Failed"

**Error Messages:**
- `Error: Cannot find module 'kuzu'`
- `node-pre-gyp WARN Pre-built binaries not found`

**Solutions:**

1. **Install from Source**
   ```bash
   npm install kuzu --build-from-source
   ```

2. **Check System Requirements**
   ```bash
   # Check Node.js version
   node --version  # Should be 18+
   
   # Check Python version
   python3 --version  # Should be 3.7+
   ```

3. **Platform-Specific Solutions**
   ```bash
   # macOS - Install Xcode Command Line Tools
   xcode-select --install
   
   # Linux - Install development tools
   sudo apt-get install build-essential cmake
   
   # Windows - Use Visual Studio Build Tools
   npm install --global windows-build-tools
   ```

---

## Database Issues

### Issue: "Database Connection Failed"

**Error Messages:**
- `Failed to connect to Kuzu after 3 attempts`
- `Database not connected`
- `Connection verification failed`

**Diagnosis:**
```bash
# Check database files
ls -la .kg-context/knowledge-graph.kuzu/

# Check permissions
ls -la .kg-context/

# Test database creation
rm -rf .kg-context/knowledge-graph.kuzu
npx @mcp/vibe-coding-kg setup
```

**Solutions:**

1. **Reset Database**
   ```bash
   # Backup existing data (optional)
   npx @mcp/vibe-coding-kg backup ./backup-$(date +%Y%m%d).tar.gz
   
   # Remove corrupted database
   rm -rf .kg-context/knowledge-graph.kuzu
   
   # Recreate database
   npx @mcp/vibe-coding-kg setup
   ```

2. **Fix Permissions**
   ```bash
   # Make directory writable
   chmod 755 .kg-context/
   
   # Fix ownership (Linux/macOS)
   sudo chown -R $USER:$USER .kg-context/
   ```

3. **Check Disk Space**
   ```bash
   # Check available disk space
   df -h .
   
   # Clean up if needed
   npx @mcp/vibe-coding-kg clean
   ```

### Issue: "Query Execution Failed"

**Error Messages:**
- `Query execution failed: Binder exception`
- `Query timeout after 30000ms`
- `Invalid query syntax`

**Diagnosis:**
```bash
# Enable query logging
LOG_LEVEL=debug npx @mcp/vibe-coding-kg start

# Check query logs
tail -f logs/queries.log
```

**Solutions:**

1. **Increase Query Timeout**
   ```json
   {
     "kuzu": {
       "queryTimeout": 60000,
       "maxRetries": 5
     }
   }
   ```

2. **Optimize Database**
   ```bash
   # Use optimization tools
   npx @mcp/vibe-coding-kg force_optimization
   ```

3. **Check Query Complexity**
   - Reduce analysis scope
   - Use simpler queries
   - Enable query caching

---

## Performance Problems

### Issue: "Slow Response Times"

**Symptoms:**
- Tools take > 10 seconds to respond
- Timeouts in Claude Desktop
- High CPU usage

**Diagnosis:**
```bash
# Profile performance
LOG_LEVEL=debug npx @mcp/vibe-coding-kg start

# Monitor system resources
htop

# Check optimization status
npx @mcp/vibe-coding-kg get_optimization_report
```

**Solutions:**

1. **Enable Optimization Features**
   ```json
   {
     "optimization": {
       "cache": {
         "enabled": true,
         "layers": {
           "l1": { "maxSize": 100, "ttl": 300000 },
           "l2": { "maxSize": 1000, "ttl": 3600000 }
         }
       },
       "query": {
         "enabled": true,
         "cacheSize": 1000
       }
     }
   }
   ```

2. **Optimize Database Configuration**
   ```json
   {
     "kuzu": {
       "bufferPoolSize": "512MB",
       "maxConnections": 5,
       "enableWAL": true
     }
   }
   ```

3. **Reduce Analysis Scope**
   ```json
   {
     "analysis": {
       "maxFileSize": 524288,
       "maxConcurrentFiles": 3,
       "timeoutPerFile": 15000
     }
   }
   ```

### Issue: "Memory Leaks"

**Symptoms:**
- Memory usage grows over time
- System becomes unresponsive
- Process eventually crashes

**Diagnosis:**
```bash
# Monitor memory over time
while true; do
  ps aux | grep mcp-vibe-coding | grep -v grep
  sleep 10
done

# Use Node.js memory profiling
node --inspect --max-old-space-size=4096 index.js
```

**Solutions:**

1. **Enable Garbage Collection**
   ```bash
   export NODE_OPTIONS="--expose-gc --max-old-space-size=2048"
   npx @mcp/vibe-coding-kg start
   ```

2. **Configure Memory Management**
   ```json
   {
     "optimization": {
       "memory": {
         "enabled": true,
         "gcInterval": 300000,
         "enableCompaction": true
       }
     }
   }
   ```

3. **Restart Periodically**
   ```bash
   # Use process manager
   pm2 start npx --name mcp-vibe-coding -- @mcp/vibe-coding-kg start
   pm2 restart mcp-vibe-coding --cron "0 */6 * * *"  # Restart every 6 hours
   ```

---

## Claude Desktop Integration

### Issue: "MCP Server Not Starting"

**Error Messages:**
- Claude Desktop shows "Connection failed"
- No response from MCP server

**Diagnosis:**
```bash
# Test server manually
npx @mcp/vibe-coding-kg start

# Check Claude Desktop logs (macOS)
tail -f ~/Library/Logs/Claude/claude_desktop.log

# Check process status
ps aux | grep mcp-vibe-coding
```

**Solutions:**

1. **Verify Configuration Syntax**
   ```bash
   # Validate JSON syntax
   python3 -m json.tool ~/.config/Claude/claude_desktop_config.json
   ```

2. **Use Absolute Paths**
   ```json
   {
     "mcpServers": {
       "vibe-coding-kg": {
         "command": "/usr/local/bin/npx",
         "args": ["@mcp/vibe-coding-kg", "start"]
       }
     }
   }
   ```

3. **Debug Environment Variables**
   ```json
   {
     "mcpServers": {
       "vibe-coding-kg": {
         "command": "npx",
         "args": ["@mcp/vibe-coding-kg", "start"],
         "env": {
           "NODE_ENV": "production",
           "LOG_LEVEL": "debug",
           "PATH": "/usr/local/bin:/usr/bin:/bin"
         }
       }
     }
   }
   ```

### Issue: "Tools Not Appearing"

**Symptoms:**
- Server starts but no tools available
- Some tools missing from list

**Diagnosis:**
```bash
# List available tools
curl -X POST http://localhost:3000/mcp/list_tools

# Check tool registration
grep -r "tools:" src/server.js
```

**Solutions:**

1. **Verify Tool Registration**
   - Check `ListToolsRequestSchema` handler
   - Ensure all tools are in the tools array
   - Verify tool schemas are valid

2. **Check Tool Dependencies**
   ```bash
   # Verify all handlers are imported
   grep -r "import.*Handler" src/server.js
   ```

3. **Enable Debug Logging**
   ```json
   {
     "logging": {
       "level": "debug",
       "enabled": true
     }
   }
   ```

---

## Arduino/C++ Analysis Issues

### Issue: "Arduino Analysis Failed"

**Error Messages:**
- `Failed to analyze Arduino sketch`
- `Board configuration not found`
- `Pin analysis failed`

**Diagnosis:**
```bash
# Test Arduino analysis directly
node -e "
const { ArduinoHandler } = require('./src/handlers/arduinoHandler.js');
const handler = new ArduinoHandler();
handler.analyzeArduinoSketch({
  sketchPath: '/path/to/sketch.ino',
  targetBoard: 'uno'
}).then(console.log).catch(console.error);
"
```

**Solutions:**

1. **Verify File Paths**
   ```bash
   # Check file exists and is readable
   ls -la /path/to/sketch.ino
   
   # Check file permissions
   chmod 644 /path/to/sketch.ino
   ```

2. **Validate Board Configuration**
   ```javascript
   // Check supported boards
   const supportedBoards = ['uno', 'mega2560', 'nano', 'esp32'];
   ```

3. **Update Arduino Patterns**
   ```bash
   # Check pattern definitions
   cat src/patterns/arduinoPatterns.js
   ```

### Issue: "Memory Analysis Incorrect"

**Symptoms:**
- Memory estimates seem wrong
- RAM/Flash calculations don't match Arduino IDE

**Solutions:**

1. **Update Board Specifications**
   ```javascript
   // In src/patterns/arduinoPatterns.js
   const boardSpecs = {
     uno: { ram: 2048, flash: 32768, eeprom: 1024 },
     mega2560: { ram: 8192, flash: 262144, eeprom: 4096 }
   };
   ```

2. **Calibrate Analysis Algorithm**
   - Compare with Arduino IDE compilation
   - Adjust estimation formulas
   - Account for libraries and overhead

---

## Debugging Techniques

### Enable Debug Logging

```bash
# Set environment variables
export LOG_LEVEL=debug
export DEBUG=mcp:*

# Run with debug output
npx @mcp/vibe-coding-kg start 2>&1 | tee debug.log
```

### Use Node.js Inspector

```bash
# Start with inspector
node --inspect index.js

# Open Chrome DevTools
# Navigate to chrome://inspect
# Click "Open dedicated DevTools for Node"
```

### Memory Profiling

```bash
# Generate heap snapshot
node --inspect --expose-gc index.js

# In DevTools Console:
# global.gc(); // Force garbage collection
# Click "Take heap snapshot" in Memory tab
```

### Database Debugging

```bash
# Enable query logging
export LOG_LEVEL=trace

# Monitor database files
watch -n 1 'ls -lah .kg-context/'

# Check database integrity
npx @mcp/vibe-coding-kg get_kg_statistics --includeDetails true
```

### Performance Profiling

```bash
# CPU profiling
node --prof index.js

# After stopping server
node --prof-process isolate-*.log > profile.txt

# Analyze profile
less profile.txt
```

---

## Error Messages

### Database Errors

| Error | Cause | Solution |
|-------|--------|----------|
| `Connection verification failed` | Database corrupted | Reset database |
| `Schema initialization failed` | Permission denied | Fix file permissions |
| `Query timeout after 30000ms` | Query too complex | Increase timeout, optimize query |
| `Parameter processing failed` | Invalid input | Validate input parameters |

### Analysis Errors

| Error | Cause | Solution |
|-------|--------|----------|
| `AST parsing failed` | Invalid syntax | Check file syntax |
| `File too large` | Exceeds maxFileSize | Increase limit or exclude file |
| `Unsupported file type` | Extension not supported | Add to includedExtensions |
| `Analysis timeout` | File too complex | Increase timeout or simplify |

### Validation Errors

| Error | Cause | Solution |
|-------|--------|----------|
| `Security threat detected` | Potentially malicious input | Review and sanitize input |
| `Rate limit exceeded` | Too many requests | Wait or disable rate limiting |
| `Input validation failed` | Invalid parameters | Check parameter format |
| `Schema validation error` | Incorrect tool schema | Fix schema definition |

---

## Recovery Procedures

### Database Recovery

1. **Backup Current State**
   ```bash
   npx @mcp/vibe-coding-kg backup ./emergency-backup.tar.gz
   ```

2. **Reset Database**
   ```bash
   rm -rf .kg-context/knowledge-graph.kuzu
   npx @mcp/vibe-coding-kg setup
   ```

3. **Restore from Backup**
   ```bash
   npx @mcp/vibe-coding-kg restore ./backup-file.tar.gz
   ```

### Configuration Recovery

1. **Reset to Defaults**
   ```bash
   rm -f .mcp-vibe-config.json
   npx @mcp/vibe-coding-kg setup
   ```

2. **Validate Configuration**
   ```bash
   node -e "console.log(JSON.parse(require('fs').readFileSync('.mcp-vibe-config.json')))"
   ```

### Clean Installation

1. **Remove All Data**
   ```bash
   npm uninstall -g @mcp/vibe-coding-kg
   rm -rf .kg-context/
   rm -f .mcp-vibe-config.json
   ```

2. **Fresh Install**
   ```bash
   npm install -g @mcp/vibe-coding-kg
   npx @mcp/vibe-coding-kg setup
   ```

---

## Getting Help

### Self-Diagnosis

1. **Health Check**
   ```bash
   npx @mcp/vibe-coding-kg health
   ```

2. **System Information**
   ```bash
   # Collect system info
   echo "Node.js: $(node --version)"
   echo "npm: $(npm --version)"
   echo "OS: $(uname -a)"
   echo "Memory: $(free -h)"
   echo "Disk: $(df -h .)"
   ```

3. **Log Analysis**
   ```bash
   # Check recent errors
   tail -100 logs/error.log

   # Search for specific errors
   grep -i "error\|failed\|timeout" logs/combined.log
   ```

### Community Support

1. **GitHub Issues**
   - Search existing issues
   - Provide reproduction steps
   - Include system information
   - Attach relevant logs

2. **Documentation**
   - Check configuration guide
   - Review API documentation
   - Read user guide examples

3. **Debug Information to Include**
   ```bash
   # Generate debug report
   {
     echo "=== System Information ==="
     node --version
     npm --version
     uname -a
     
     echo "=== Configuration ==="
     cat .mcp-vibe-config.json
     
     echo "=== Recent Logs ==="
     tail -50 logs/error.log
     
     echo "=== Health Status ==="
     npx @mcp/vibe-coding-kg get_kg_statistics
   } > debug-report.txt
   ```

### Professional Support

For enterprise deployments:
- Performance optimization consulting
- Custom integration development
- 24/7 technical support
- Training and onboarding

Contact: support@example.com

---

## Prevention Tips

### Regular Maintenance

1. **Automated Health Checks**
   ```bash
   # Add to crontab
   0 */6 * * * /usr/local/bin/npx @mcp/vibe-coding-kg health >> /var/log/mcp-health.log
   ```

2. **Backup Schedule**
   ```bash
   # Daily backups
   0 2 * * * /usr/local/bin/npx @mcp/vibe-coding-kg backup /backups/mcp-$(date +\%Y\%m\%d).tar.gz
   ```

3. **Log Rotation**
   ```bash
   # Configure logrotate
   echo "/path/to/mcp/logs/*.log {
     daily
     rotate 7
     compress
     missingok
     notifempty
   }" > /etc/logrotate.d/mcp-vibe-coding
   ```

### Monitoring Setup

1. **Resource Monitoring**
   ```bash
   # Monitor memory usage
   watch -n 30 'ps aux | grep mcp-vibe-coding | grep -v grep'
   ```

2. **Performance Alerts**
   ```javascript
   // In your monitoring system
   if (response_time > 5000) {
     alert("MCP response time high");
   }
   
   if (memory_usage > 1000000000) {
     alert("MCP memory usage high");
   }
   ```

3. **Automated Recovery**
   ```bash
   # Process watchdog script
   #!/bin/bash
   if ! pgrep -f "mcp-vibe-coding" > /dev/null; then
     echo "MCP server not running, restarting..."
     npx @mcp/vibe-coding-kg start &
   fi
   ```

By following this troubleshooting guide, you should be able to diagnose and resolve most common issues with the MCP Vibe Coding Knowledge Graph system. Remember to always backup your data before making major changes, and don't hesitate to reach out for help when needed.