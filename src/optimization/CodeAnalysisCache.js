/**
 * CONTEXT: Code analysis result caching with file hash-based invalidation
 * REASON: Cache expensive code analysis operations and invalidate based on file changes
 * CHANGE: Smart caching system with content fingerprinting and dependency tracking
 * PREVENTION: Redundant code analysis, slow response times, resource waste
 */

import { EventEmitter } from 'events';
import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

export class CodeAnalysisCache extends EventEmitter {
    constructor(cache, config = {}) {
        super();
        
        this.cache = cache;
        this.config = {
            // File tracking settings
            fileTracking: {
                enabled: config.fileTracking?.enabled !== false,
                trackStats: config.fileTracking?.trackStats !== false,
                trackContent: config.fileTracking?.trackContent !== false,
                hashAlgorithm: config.fileTracking?.hashAlgorithm || 'sha256',
                chunkSize: config.fileTracking?.chunkSize || 64 * 1024, // 64KB
                ignorePatterns: config.fileTracking?.ignorePatterns || [
                    '**/.git/**',
                    '**/node_modules/**',
                    '**/.vscode/**',
                    '**/*.log',
                    '**/*.tmp'
                ]
            },
            
            // Caching strategies
            caching: {
                enabled: config.caching?.enabled !== false,
                ttl: config.caching?.ttl || 24 * 60 * 60 * 1000, // 24 hours
                maxCacheSize: config.caching?.maxCacheSize || 500 * 1024 * 1024, // 500MB
                keyPrefix: config.caching?.keyPrefix || 'analysis:',
                compressResults: config.caching?.compressResults !== false,
                versionAnalysisResults: config.caching?.versionAnalysisResults !== false
            },
            
            // Dependency tracking
            dependencies: {
                enabled: config.dependencies?.enabled !== false,
                trackImports: config.dependencies?.trackImports !== false,
                trackIncludes: config.dependencies?.trackIncludes !== false,
                trackReferences: config.dependencies?.trackReferences !== false,
                maxDepth: config.dependencies?.maxDepth || 5,
                autoInvalidate: config.dependencies?.autoInvalidate !== false
            },
            
            // Analysis types
            analysisTypes: {
                ast: { enabled: true, ttl: 60 * 60 * 1000 }, // 1 hour
                patterns: { enabled: true, ttl: 4 * 60 * 60 * 1000 }, // 4 hours
                complexity: { enabled: true, ttl: 12 * 60 * 60 * 1000 }, // 12 hours
                dependencies: { enabled: true, ttl: 24 * 60 * 60 * 1000 }, // 24 hours
                metrics: { enabled: true, ttl: 6 * 60 * 60 * 1000 }, // 6 hours
                security: { enabled: true, ttl: 30 * 60 * 1000 }, // 30 minutes
                documentation: { enabled: true, ttl: 2 * 60 * 60 * 1000 }, // 2 hours
                ...config.analysisTypes
            },
            
            // Performance settings
            performance: {
                batchProcessing: config.performance?.batchProcessing !== false,
                parallelAnalysis: config.performance?.parallelAnalysis !== false,
                maxParallelFiles: config.performance?.maxParallelFiles || 10,
                incrementalAnalysis: config.performance?.incrementalAnalysis !== false,
                asyncCaching: config.performance?.asyncCaching !== false
            }
        };
        
        // File tracking storage
        this.fileHashes = new Map(); // filePath -> hash info
        this.fileStats = new Map();  // filePath -> file stats
        this.fileDependencies = new Map(); // filePath -> Set of dependent files
        
        // Analysis cache mappings
        this.analysisKeys = new Map(); // filePath:analysisType -> cacheKey
        this.analysisMetadata = new Map(); // cacheKey -> metadata
        
        // Content fingerprinting
        this.contentFingerprints = new Map(); // filePath -> content fingerprint
        this.fingerprintIndex = new Map(); // fingerprint -> Set of file paths
        
        // Batch processing queue
        this.analysisQueue = [];
        this.isProcessingQueue = false;
        
        // Metrics
        this.metrics = {
            files: {
                tracked: 0,
                analyzed: 0,
                cacheHits: 0,
                cacheMisses: 0,
                invalidations: 0
            },
            analysis: {
                totalTime: 0,
                cacheTime: 0,
                averageAnalysisTime: 0,
                averageCacheTime: 0,
                typeBreakdown: {}
            },
            dependencies: {
                tracked: 0,
                invalidationCascades: 0,
                averageDependencyDepth: 0
            },
            performance: {
                batchSize: 0,
                parallelJobs: 0,
                queueLength: 0
            }
        };
        
        // Cleanup intervals
        this.cleanupIntervals = [];
        
        this.initialize();
    }

    /**
     * Initialize the code analysis cache
     */
    initialize() {
        this.startBackgroundTasks();
        
        logger.info('Code analysis cache initialized', {
            fileTracking: this.config.fileTracking.enabled,
            dependencies: this.config.dependencies.enabled,
            analysisTypes: Object.keys(this.config.analysisTypes).filter(
                type => this.config.analysisTypes[type].enabled
            )
        });
    }

    /**
     * Analyze file with caching
     */
    async analyzeFile(filePath, analysisType, options = {}) {
        const startTime = Date.now();
        
        try {
            // Validate inputs
            this.validateFilePath(filePath);
            this.validateAnalysisType(analysisType);
            
            // Normalize file path
            const normalizedPath = path.resolve(filePath);
            
            // Check if file should be ignored
            if (this.shouldIgnoreFile(normalizedPath)) {
                throw new Error(`File is ignored: ${filePath}`);
            }
            
            // Get file hash and stats
            const fileInfo = await this.getFileInfo(normalizedPath);
            
            // Generate cache key
            const cacheKey = this.generateCacheKey(normalizedPath, analysisType, fileInfo);
            
            // Check cache first
            const cachedResult = await this.getCachedAnalysis(cacheKey, analysisType);
            if (cachedResult !== null && !options.forceRefresh) {
                const cacheTime = Date.now() - startTime;
                this.updateMetrics('cache_hit', analysisType, cacheTime);
                
                this.emit('cacheHit', { 
                    filePath: normalizedPath, 
                    analysisType, 
                    cacheKey, 
                    cacheTime 
                });
                
                return cachedResult;
            }
            
            // Perform analysis
            const analysisStartTime = Date.now();
            const result = await this.performAnalysis(normalizedPath, analysisType, fileInfo, options);
            const analysisTime = Date.now() - analysisStartTime;
            
            // Cache the result
            await this.cacheAnalysisResult(cacheKey, result, normalizedPath, analysisType, fileInfo);
            
            // Update dependencies if enabled
            if (this.config.dependencies.enabled) {
                await this.updateFileDependencies(normalizedPath, result, analysisType);
            }
            
            // Update metrics
            const totalTime = Date.now() - startTime;
            this.updateMetrics('cache_miss', analysisType, totalTime, analysisTime);
            
            this.emit('cacheMiss', { 
                filePath: normalizedPath, 
                analysisType, 
                cacheKey, 
                analysisTime, 
                totalTime 
            });
            
            return result;
            
        } catch (error) {
            logger.error('File analysis error:', { 
                filePath, 
                analysisType, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Analyze multiple files with batch processing
     */
    async analyzeFiles(filePaths, analysisType, options = {}) {
        if (!this.config.performance.batchProcessing) {
            // Process individually
            const results = [];
            for (const filePath of filePaths) {
                const result = await this.analyzeFile(filePath, analysisType, options);
                results.push({ filePath, result });
            }
            return results;
        }
        
        // Batch processing
        const batch = {
            filePaths: filePaths.map(fp => path.resolve(fp)),
            analysisType,
            options,
            timestamp: Date.now(),
            id: this.generateBatchId()
        };
        
        if (this.config.performance.parallelAnalysis) {
            return await this.processBatchParallel(batch);
        } else {
            return await this.processBatchSequential(batch);
        }
    }

    /**
     * Invalidate analysis cache for file
     */
    async invalidateFile(filePath, options = {}) {
        try {
            const normalizedPath = path.resolve(filePath);
            
            // Get all analysis types for this file
            const analysisTypes = this.getFileAnalysisTypes(normalizedPath);
            
            // Invalidate all cached analyses for this file
            const invalidationPromises = [];
            
            for (const analysisType of analysisTypes) {
                const cacheKey = this.analysisKeys.get(`${normalizedPath}:${analysisType}`);
                if (cacheKey) {
                    invalidationPromises.push(this.cache.delete(cacheKey));
                    this.analysisKeys.delete(`${normalizedPath}:${analysisType}`);
                    this.analysisMetadata.delete(cacheKey);
                }
            }
            
            await Promise.all(invalidationPromises);
            
            // Cascade invalidation to dependent files if enabled
            if (this.config.dependencies.autoInvalidate && !options.noCascade) {
                await this.invalidateDependentFiles(normalizedPath);
            }
            
            // Update file tracking
            this.fileHashes.delete(normalizedPath);
            this.fileStats.delete(normalizedPath);
            this.removeFingerprintTracking(normalizedPath);
            
            this.metrics.files.invalidations++;
            
            this.emit('fileInvalidated', { 
                filePath: normalizedPath, 
                analysisTypes: analysisTypes.length,
                cascaded: this.config.dependencies.autoInvalidate && !options.noCascade
            });
            
            logger.debug('File cache invalidated', { 
                filePath: normalizedPath, 
                analysisTypes: analysisTypes.length 
            });
            
        } catch (error) {
            logger.error('File invalidation error:', { 
                filePath, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Watch directory for file changes
     */
    async watchDirectory(directoryPath, options = {}) {
        try {
            const normalizedPath = path.resolve(directoryPath);
            
            // Scan directory for initial file tracking
            await this.scanDirectory(normalizedPath, options);
            
            // Setup file watching if available
            if (fs.watch) {
                const watcher = fs.watch(normalizedPath, { recursive: true }, 
                    async (eventType, filename) => {
                        if (filename) {
                            const fullPath = path.join(normalizedPath, filename);
                            await this.handleFileChange(fullPath, eventType);
                        }
                    }
                );
                
                this.emit('watchStarted', { directoryPath: normalizedPath });
                
                return watcher;
            }
            
        } catch (error) {
            logger.error('Directory watching error:', { 
                directoryPath, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Scan directory and build file tracking
     */
    async scanDirectory(directoryPath, options = {}) {
        try {
            const files = await this.getDirectoryFiles(directoryPath, options);
            
            for (const filePath of files) {
                if (!this.shouldIgnoreFile(filePath)) {
                    await this.trackFile(filePath);
                }
            }
            
            logger.info('Directory scanned for analysis cache', { 
                directoryPath, 
                filesTracked: files.length 
            });
            
        } catch (error) {
            logger.error('Directory scan error:', { 
                directoryPath, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Get file information including hash and stats
     */
    async getFileInfo(filePath) {
        try {
            // Check if we have cached file info
            const cachedHash = this.fileHashes.get(filePath);
            const cachedStats = this.fileStats.get(filePath);
            
            // Get current file stats
            const stats = await fs.stat(filePath);
            
            // Check if file has changed
            if (cachedStats && 
                cachedStats.mtime.getTime() === stats.mtime.getTime() &&
                cachedStats.size === stats.size) {
                // File hasn't changed, return cached info
                return {
                    hash: cachedHash.hash,
                    stats,
                    fingerprint: cachedHash.fingerprint,
                    changed: false
                };
            }
            
            // File has changed or is new, compute new hash
            const { hash, fingerprint } = await this.computeFileHash(filePath);
            
            // Update cache
            this.fileHashes.set(filePath, { hash, fingerprint, computed: Date.now() });
            this.fileStats.set(filePath, stats);
            this.updateFingerprintIndex(filePath, fingerprint);
            
            return {
                hash,
                stats,
                fingerprint,
                changed: true
            };
            
        } catch (error) {
            logger.error('Error getting file info:', { 
                filePath, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Compute file hash and content fingerprint
     */
    async computeFileHash(filePath) {
        try {
            const hash = crypto.createHash(this.config.fileTracking.hashAlgorithm);
            const fingerprintHash = crypto.createHash('md5');
            
            const fileHandle = await fs.open(filePath, 'r');
            const buffer = Buffer.alloc(this.config.fileTracking.chunkSize);
            
            try {
                let position = 0;
                let bytesRead;
                
                do {
                    const result = await fileHandle.read(buffer, 0, buffer.length, position);
                    bytesRead = result.bytesRead;
                    
                    if (bytesRead > 0) {
                        const chunk = buffer.slice(0, bytesRead);
                        hash.update(chunk);
                        
                        // Create content fingerprint (simpler for similarity detection)
                        const normalizedChunk = this.normalizeContentChunk(chunk);
                        fingerprintHash.update(normalizedChunk);
                        
                        position += bytesRead;
                    }
                } while (bytesRead > 0);
                
            } finally {
                await fileHandle.close();
            }
            
            return {
                hash: hash.digest('hex'),
                fingerprint: fingerprintHash.digest('hex')
            };
            
        } catch (error) {
            logger.error('Error computing file hash:', { 
                filePath, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Normalize content chunk for fingerprinting
     */
    normalizeContentChunk(chunk) {
        // Remove whitespace variations and comments for similarity detection
        return chunk
            .toString('utf8')
            .replace(/\s+/g, ' ')
            .replace(/\/\*[\s\S]*?\*\//g, '')
            .replace(/\/\/.*$/gm, '')
            .trim();
    }

    /**
     * Generate cache key for analysis result
     */
    generateCacheKey(filePath, analysisType, fileInfo) {
        const keyData = {
            filePath: path.relative(process.cwd(), filePath),
            analysisType,
            hash: fileInfo.hash,
            version: this.getAnalysisVersion(analysisType)
        };
        
        const keyString = JSON.stringify(keyData);
        const cacheKey = `${this.config.caching.keyPrefix}${crypto
            .createHash('sha256')
            .update(keyString)
            .digest('hex')}`;
        
        // Store mapping
        this.analysisKeys.set(`${filePath}:${analysisType}`, cacheKey);
        
        return cacheKey;
    }

    /**
     * Get cached analysis result
     */
    async getCachedAnalysis(cacheKey, analysisType) {
        try {
            const cached = await this.cache.get(cacheKey);
            
            if (cached === null) {
                return null;
            }
            
            // Validate cached result
            if (!this.validateCachedAnalysis(cached)) {
                await this.cache.delete(cacheKey);
                return null;
            }
            
            // Check if analysis type configuration has changed
            const currentVersion = this.getAnalysisVersion(analysisType);
            if (cached.version !== currentVersion) {
                await this.cache.delete(cacheKey);
                return null;
            }
            
            return cached.result;
            
        } catch (error) {
            logger.error('Error retrieving cached analysis:', { 
                cacheKey, 
                error: error.message 
            });
            return null;
        }
    }

    /**
     * Cache analysis result
     */
    async cacheAnalysisResult(cacheKey, result, filePath, analysisType, fileInfo) {
        try {
            const cacheEntry = {
                result,
                metadata: {
                    filePath: path.relative(process.cwd(), filePath),
                    analysisType,
                    fileHash: fileInfo.hash,
                    fingerprint: fileInfo.fingerprint,
                    version: this.getAnalysisVersion(analysisType),
                    cached: Date.now(),
                    size: this.calculateResultSize(result)
                }
            };
            
            // Compress if configured and beneficial
            if (this.config.caching.compressResults) {
                const compressed = this.compressResult(result);
                if (compressed.length < JSON.stringify(result).length * 0.8) {
                    cacheEntry.result = compressed;
                    cacheEntry.metadata.compressed = true;
                }
            }
            
            // Calculate TTL
            const ttl = this.config.analysisTypes[analysisType]?.ttl || this.config.caching.ttl;
            
            // Store in cache
            await this.cache.set(cacheKey, cacheEntry, { ttl });
            
            // Store metadata
            this.analysisMetadata.set(cacheKey, cacheEntry.metadata);
            
            logger.debug('Analysis result cached', { 
                filePath, 
                analysisType, 
                cacheKey, 
                size: cacheEntry.metadata.size 
            });
            
        } catch (error) {
            logger.error('Error caching analysis result:', { 
                cacheKey, 
                error: error.message 
            });
            throw error;
        }
    }

    /**
     * Perform actual analysis (to be implemented by specific analyzers)
     */
    async performAnalysis(filePath, analysisType, fileInfo, options) {
        // This is a placeholder that should be overridden or injected
        throw new Error(`Analysis implementation for '${analysisType}' not provided`);
    }

    /**
     * Update file dependencies based on analysis results
     */
    async updateFileDependencies(filePath, analysisResult, analysisType) {
        try {
            const dependencies = this.extractDependencies(analysisResult, analysisType);
            
            if (dependencies.length > 0) {
                // Update dependency tracking
                this.fileDependencies.set(filePath, new Set(dependencies));
                
                // Register reverse dependencies
                for (const dep of dependencies) {
                    const reverseDeps = this.fileDependencies.get(dep) || new Set();
                    reverseDeps.add(filePath);
                    this.fileDependencies.set(dep, reverseDeps);
                }
                
                this.metrics.dependencies.tracked += dependencies.length;
                
                logger.debug('File dependencies updated', { 
                    filePath, 
                    dependencies: dependencies.length 
                });
            }
            
        } catch (error) {
            logger.error('Error updating file dependencies:', { 
                filePath, 
                error: error.message 
            });
        }
    }

    /**
     * Extract dependencies from analysis result
     */
    extractDependencies(analysisResult, analysisType) {
        const dependencies = [];
        
        switch (analysisType) {
            case 'ast':
            case 'dependencies':
                if (analysisResult.imports) {
                    dependencies.push(...analysisResult.imports.map(imp => imp.path || imp.source));
                }
                if (analysisResult.requires) {
                    dependencies.push(...analysisResult.requires.map(req => req.path || req.source));
                }
                if (analysisResult.includes) {
                    dependencies.push(...analysisResult.includes.map(inc => inc.path || inc.source));
                }
                break;
                
            case 'patterns':
                if (analysisResult.references) {
                    dependencies.push(...analysisResult.references.map(ref => ref.file));
                }
                break;
        }
        
        // Filter out invalid paths and resolve relative paths
        return dependencies
            .filter(dep => dep && typeof dep === 'string')
            .map(dep => {
                try {
                    return path.resolve(path.dirname(filePath), dep);
                } catch {
                    return null;
                }
            })
            .filter(dep => dep !== null);
    }

    /**
     * Invalidate dependent files
     */
    async invalidateDependentFiles(filePath) {
        try {
            const dependents = this.getDependentFiles(filePath);
            
            if (dependents.length > 0) {
                this.metrics.dependencies.invalidationCascades++;
                
                // Invalidate dependents (but don't cascade further to avoid infinite loops)
                const invalidationPromises = dependents.map(dep => 
                    this.invalidateFile(dep, { noCascade: true })
                );
                
                await Promise.all(invalidationPromises);
                
                logger.debug('Dependent files invalidated', { 
                    filePath, 
                    dependents: dependents.length 
                });
            }
            
        } catch (error) {
            logger.error('Error invalidating dependent files:', { 
                filePath, 
                error: error.message 
            });
        }
    }

    /**
     * Get files that depend on the given file
     */
    getDependentFiles(filePath, visited = new Set()) {
        if (visited.has(filePath)) {
            return []; // Avoid cycles
        }
        
        visited.add(filePath);
        const dependents = [];
        
        for (const [file, deps] of this.fileDependencies.entries()) {
            if (deps.has(filePath)) {
                dependents.push(file);
                
                // Recursively get dependents (up to max depth)
                if (visited.size < this.config.dependencies.maxDepth) {
                    dependents.push(...this.getDependentFiles(file, visited));
                }
            }
        }
        
        return [...new Set(dependents)]; // Remove duplicates
    }

    /**
     * Process batch of files in parallel
     */
    async processBatchParallel(batch) {
        const maxParallel = Math.min(
            this.config.performance.maxParallelFiles,
            batch.filePaths.length
        );
        
        const results = [];
        const semaphore = new Semaphore(maxParallel);
        
        const promises = batch.filePaths.map(async (filePath) => {
            const release = await semaphore.acquire();
            
            try {
                const result = await this.analyzeFile(filePath, batch.analysisType, batch.options);
                return { filePath, result, success: true };
            } catch (error) {
                return { filePath, error: error.message, success: false };
            } finally {
                release();
            }
        });
        
        return await Promise.all(promises);
    }

    /**
     * Process batch of files sequentially
     */
    async processBatchSequential(batch) {
        const results = [];
        
        for (const filePath of batch.filePaths) {
            try {
                const result = await this.analyzeFile(filePath, batch.analysisType, batch.options);
                results.push({ filePath, result, success: true });
            } catch (error) {
                results.push({ filePath, error: error.message, success: false });
            }
        }
        
        return results;
    }

    /**
     * Handle file system changes
     */
    async handleFileChange(filePath, eventType) {
        try {
            if (this.shouldIgnoreFile(filePath)) {
                return;
            }
            
            switch (eventType) {
                case 'change':
                    // File modified, invalidate cache
                    await this.invalidateFile(filePath);
                    break;
                    
                case 'rename':
                    // File renamed or deleted, clean up tracking
                    try {
                        await fs.access(filePath);
                        // File still exists, treat as new file
                        await this.trackFile(filePath);
                    } catch {
                        // File was deleted
                        await this.invalidateFile(filePath);
                    }
                    break;
            }
            
        } catch (error) {
            logger.error('Error handling file change:', { 
                filePath, 
                eventType, 
                error: error.message 
            });
        }
    }

    /**
     * Track a new file
     */
    async trackFile(filePath) {
        try {
            await this.getFileInfo(filePath);
            this.metrics.files.tracked++;
            
            this.emit('fileTracked', { filePath });
            
        } catch (error) {
            logger.error('Error tracking file:', { 
                filePath, 
                error: error.message 
            });
        }
    }

    /**
     * Utility methods
     */
    shouldIgnoreFile(filePath) {
        return this.config.fileTracking.ignorePatterns.some(pattern => {
            // Simple glob matching
            const regex = new RegExp(
                pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*')
            );
            return regex.test(filePath);
        });
    }

    validateFilePath(filePath) {
        if (typeof filePath !== 'string' || filePath.trim().length === 0) {
            throw new Error('File path must be a non-empty string');
        }
    }

    validateAnalysisType(analysisType) {
        if (!this.config.analysisTypes[analysisType]) {
            throw new Error(`Unknown analysis type: ${analysisType}`);
        }
        
        if (!this.config.analysisTypes[analysisType].enabled) {
            throw new Error(`Analysis type disabled: ${analysisType}`);
        }
    }

    validateCachedAnalysis(cached) {
        return cached && 
               cached.result && 
               cached.metadata &&
               cached.metadata.cached &&
               cached.metadata.version;
    }

    getAnalysisVersion(analysisType) {
        return this.config.analysisTypes[analysisType]?.version || '1.0';
    }

    getFileAnalysisTypes(filePath) {
        const types = [];
        for (const [key, cacheKey] of this.analysisKeys.entries()) {
            if (key.startsWith(`${filePath}:`)) {
                const analysisType = key.split(':').pop();
                types.push(analysisType);
            }
        }
        return types;
    }

    updateFingerprintIndex(filePath, fingerprint) {
        // Remove old fingerprint
        const oldFingerprint = this.contentFingerprints.get(filePath);
        if (oldFingerprint) {
            const oldSet = this.fingerprintIndex.get(oldFingerprint);
            if (oldSet) {
                oldSet.delete(filePath);
                if (oldSet.size === 0) {
                    this.fingerprintIndex.delete(oldFingerprint);
                }
            }
        }
        
        // Add new fingerprint
        this.contentFingerprints.set(filePath, fingerprint);
        if (!this.fingerprintIndex.has(fingerprint)) {
            this.fingerprintIndex.set(fingerprint, new Set());
        }
        this.fingerprintIndex.get(fingerprint).add(filePath);
    }

    removeFingerprintTracking(filePath) {
        const fingerprint = this.contentFingerprints.get(filePath);
        if (fingerprint) {
            const fingerprintSet = this.fingerprintIndex.get(fingerprint);
            if (fingerprintSet) {
                fingerprintSet.delete(filePath);
                if (fingerprintSet.size === 0) {
                    this.fingerprintIndex.delete(fingerprint);
                }
            }
            this.contentFingerprints.delete(filePath);
        }
    }

    async getDirectoryFiles(directoryPath, options = {}) {
        const files = [];
        
        const scan = async (dir) => {
            const entries = await fs.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory() && (!options.maxDepth || files.length < options.maxDepth)) {
                    await scan(fullPath);
                } else if (entry.isFile()) {
                    files.push(fullPath);
                }
            }
        };
        
        await scan(directoryPath);
        return files;
    }

    calculateResultSize(result) {
        return Buffer.byteLength(JSON.stringify(result));
    }

    compressResult(result) {
        // Implement compression (placeholder)
        return JSON.stringify(result);
    }

    generateBatchId() {
        return `batch_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    updateMetrics(type, analysisType, totalTime, analysisTime = 0) {
        this.metrics.files[type === 'cache_hit' ? 'cacheHits' : 'cacheMisses']++;
        
        if (type === 'cache_hit') {
            this.metrics.analysis.cacheTime += totalTime;
            this.metrics.analysis.averageCacheTime = 
                this.metrics.analysis.cacheTime / this.metrics.files.cacheHits;
        } else {
            this.metrics.analysis.totalTime += analysisTime;
            this.metrics.files.analyzed++;
            this.metrics.analysis.averageAnalysisTime = 
                this.metrics.analysis.totalTime / this.metrics.files.analyzed;
        }
        
        // Update type breakdown
        if (!this.metrics.analysis.typeBreakdown[analysisType]) {
            this.metrics.analysis.typeBreakdown[analysisType] = { hits: 0, misses: 0 };
        }
        this.metrics.analysis.typeBreakdown[analysisType][type === 'cache_hit' ? 'hits' : 'misses']++;
    }

    /**
     * Start background maintenance tasks
     */
    startBackgroundTasks() {
        // Cleanup expired file tracking
        const cleanupInterval = setInterval(() => {
            this.cleanupExpiredFileTracking();
        }, 30 * 60 * 1000); // Every 30 minutes
        
        this.cleanupIntervals.push(cleanupInterval);
        
        // Update metrics
        const metricsInterval = setInterval(() => {
            this.emit('metricsUpdated', this.getStatistics());
        }, 60 * 1000); // Every minute
        
        this.cleanupIntervals.push(metricsInterval);
    }

    /**
     * Cleanup expired file tracking data
     */
    cleanupExpiredFileTracking() {
        const expireTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours
        
        for (const [filePath, hashInfo] of this.fileHashes.entries()) {
            if (hashInfo.computed < expireTime) {
                this.fileHashes.delete(filePath);
                this.fileStats.delete(filePath);
                this.removeFingerprintTracking(filePath);
            }
        }
    }

    /**
     * Get cache statistics
     */
    getStatistics() {
        return {
            ...this.metrics,
            tracking: {
                filesTracked: this.fileHashes.size,
                fingerprints: this.fingerprintIndex.size,
                dependencies: this.fileDependencies.size,
                analysisKeys: this.analysisKeys.size
            },
            health: this.getHealthStatus()
        };
    }

    /**
     * Get health status
     */
    getHealthStatus() {
        const health = {
            status: 'healthy',
            issues: []
        };
        
        // Check hit ratio
        const totalRequests = this.metrics.files.cacheHits + this.metrics.files.cacheMisses;
        if (totalRequests > 0) {
            const hitRatio = this.metrics.files.cacheHits / totalRequests;
            if (hitRatio < 0.4) {
                health.issues.push('Low cache hit ratio');
                health.status = 'warning';
            }
        }
        
        return health;
    }

    /**
     * Shutdown the analysis cache
     */
    async shutdown() {
        logger.info('Shutting down code analysis cache');
        
        // Clear intervals
        for (const interval of this.cleanupIntervals) {
            clearInterval(interval);
        }
        
        // Clear data structures
        this.fileHashes.clear();
        this.fileStats.clear();
        this.fileDependencies.clear();
        this.analysisKeys.clear();
        this.analysisMetadata.clear();
        this.contentFingerprints.clear();
        this.fingerprintIndex.clear();
        this.analysisQueue.length = 0;
        
        this.emit('shutdown');
        logger.info('Code analysis cache shutdown completed');
    }
}

/**
 * Simple semaphore for concurrency control
 */
class Semaphore {
    constructor(max) {
        this.max = max;
        this.current = 0;
        this.queue = [];
    }

    async acquire() {
        return new Promise((resolve) => {
            if (this.current < this.max) {
                this.current++;
                resolve(() => this.release());
            } else {
                this.queue.push(() => {
                    this.current++;
                    resolve(() => this.release());
                });
            }
        });
    }

    release() {
        this.current--;
        if (this.queue.length > 0) {
            const next = this.queue.shift();
            next();
        }
    }
}

export default CodeAnalysisCache;