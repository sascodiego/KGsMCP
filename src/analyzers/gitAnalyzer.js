import simpleGit from 'simple-git';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger.js';
import { EventEmitter } from 'events';

/**
 * CONTEXT: Enhanced GitAnalyzer for comprehensive repository analysis
 * REASON: Extract valuable Git metadata to enhance knowledge graph with change patterns, technical debt tracking, and collaboration insights
 * CHANGE: Extended analysis capabilities with knowledge graph integration, hotspot detection, and change coupling analysis
 * PREVENTION: Missing Git insights, incomplete change tracking, lack of technical debt visibility
 */
export class GitAnalyzer extends EventEmitter {
  constructor(repoPath, kuzuClient = null) {
    super();
    this.git = simpleGit(repoPath);
    this.repoPath = repoPath;
    this.kuzu = kuzuClient;
    this.analysisCache = new Map();
    this.config = {
      maxCommitsToAnalyze: 2000,
      maxFilesToAnalyze: 500,
      hotspotThreshold: 10,
      technicalDebtThreshold: 0.7,
      changeCouplingThreshold: 0.6,
      cacheExpiryMs: 3600000 // 1 hour
    };
    
    // Initialize analysis metrics
    this.metrics = {
      analysisStartTime: null,
      totalCommitsAnalyzed: 0,
      totalFilesAnalyzed: 0,
      hotspotsIdentified: 0,
      couplingPairsFound: 0,
      technicalDebtScore: 0
    };
  }

  async analyzeRepository(options = {}) {
    try {
      this.metrics.analysisStartTime = Date.now();
      logger.info('Starting comprehensive Git repository analysis', {
        repoPath: this.repoPath,
        options
      });

      const analysis = {
        metadata: await this.getRepositoryMetadata(),
        summary: await this.getRepositorySummary(),
        contributors: await this.analyzeContributors(),
        fileChanges: await this.analyzeFileChanges(),
        branchActivity: await this.analyzeBranchActivity(),
        commitPatterns: await this.analyzeCommitPatterns(),
        hotspots: await this.identifyHotspots(),
        technicalDebt: await this.analyzeTechnicalDebt(),
        changeCoupling: await this.analyzeChangeCoupling(),
        codeOwnership: await this.analyzeCodeOwnership(),
        releasePatterns: await this.analyzeReleasePatterns(),
        collaborationMetrics: await this.analyzeTeamCollaboration(),
        stabilityMetrics: await this.analyzeCodeStability(),
        performanceInsights: await this.analyzePerformanceImpact(),
        trends: await this.analyzeTrends()
      };

      // Store analysis results in knowledge graph if available
      if (this.kuzu && options.storeInKG !== false) {
        await this.storeAnalysisInKnowledgeGraph(analysis);
      }

      // Generate comprehensive insights
      analysis.insights = await this.generateComprehensiveInsights(analysis);
      analysis.metrics = this.getAnalysisMetrics();

      this.emit('analysisComplete', analysis);
      logger.info('Git repository analysis completed', {
        duration: Date.now() - this.metrics.analysisStartTime,
        metrics: this.metrics
      });

      return analysis;
    } catch (error) {
      logger.error('Error analyzing git repository:', error);
      this.emit('analysisError', error);
      throw error;
    }
  }

  async getRepositoryMetadata() {
    try {
      const remotes = await this.git.getRemotes(true);
      const isRepo = await this.git.checkIsRepo();
      const rootDir = await this.git.revparse(['--show-toplevel']);
      
      return {
        isRepository: isRepo,
        rootDirectory: rootDir.trim(),
        remotes: remotes.map(remote => ({
          name: remote.name,
          url: remote.refs.fetch,
          pushUrl: remote.refs.push
        })),
        analyzedAt: new Date().toISOString(),
        analyzer: 'GitAnalyzer v2.0'
      };
    } catch (error) {
      logger.error('Error getting repository metadata:', error);
      return {};
    }
  }

  async getRepositorySummary() {
    try {
      const status = await this.git.status();
      const log = await this.git.log({ maxCount: 1000 });
      const branches = await this.git.branch();
      const tags = await this.git.tags();

      return {
        totalCommits: log.total,
        totalBranches: branches.all.length,
        totalTags: tags.all.length,
        currentBranch: branches.current,
        uncommittedChanges: status.files.length,
        lastCommit: log.latest ? {
          hash: log.latest.hash,
          message: log.latest.message,
          author: log.latest.author_name,
          date: log.latest.date
        } : null
      };
    } catch (error) {
      logger.error('Error getting repository summary:', error);
      return {};
    }
  }

  async analyzeContributors() {
    try {
      const log = await this.git.log({ maxCount: this.config.maxCommitsToAnalyze });
      const contributorMap = new Map();
      const timeWindows = this.createTimeWindows(log.all);

      // Analyze detailed contributor statistics
      for (const commit of log.all) {
        const author = commit.author_email;
        if (!contributorMap.has(author)) {
          contributorMap.set(author, {
            name: commit.author_name,
            email: author,
            commits: 0,
            firstCommit: commit.date,
            lastCommit: commit.date,
            linesAdded: 0,
            linesRemoved: 0,
            filesModified: new Set(),
            commitsByTimeWindow: {},
            avgCommitSize: 0,
            commitTypes: new Map(),
            collaborators: new Set(),
            expertiseAreas: new Map()
          });
        }

        const contributor = contributorMap.get(author);
        contributor.commits++;
        
        // Update time boundaries
        if (new Date(commit.date) < new Date(contributor.firstCommit)) {
          contributor.firstCommit = commit.date;
        }
        if (new Date(commit.date) > new Date(contributor.lastCommit)) {
          contributor.lastCommit = commit.date;
        }

        // Analyze commit details for deeper insights
        try {
          const commitDetails = await this.analyzeCommitDetails(commit.hash);
          contributor.linesAdded += commitDetails.insertions;
          contributor.linesRemoved += commitDetails.deletions;
          
          // Track files modified by this contributor
          commitDetails.files.forEach(file => {
            contributor.filesModified.add(file.filename);
            
            // Track expertise areas by file extension
            const ext = path.extname(file.filename);
            if (ext) {
              const currentCount = contributor.expertiseAreas.get(ext) || 0;
              contributor.expertiseAreas.set(ext, currentCount + 1);
            }
          });

          // Track commit types (conventional commits)
          const commitType = this.extractCommitType(commit.message);
          if (commitType) {
            const currentCount = contributor.commitTypes.get(commitType) || 0;
            contributor.commitTypes.set(commitType, currentCount + 1);
          }

          // Time window analysis
          const timeWindow = this.getTimeWindow(commit.date, timeWindows);
          contributor.commitsByTimeWindow[timeWindow] = (contributor.commitsByTimeWindow[timeWindow] || 0) + 1;

        } catch (error) {
          // Skip detailed analysis for commits that can't be processed
          continue;
        }
      }

      // Calculate derived metrics
      contributorMap.forEach(contributor => {
        contributor.avgCommitSize = contributor.commits > 0 ? 
          (contributor.linesAdded + contributor.linesRemoved) / contributor.commits : 0;
        contributor.filesModified = contributor.filesModified.size;
        contributor.expertiseAreas = Object.fromEntries(
          Array.from(contributor.expertiseAreas.entries())
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
        );
        contributor.commitTypes = Object.fromEntries(contributor.commitTypes);
        contributor.activeDays = this.calculateActiveDays(contributor.firstCommit, contributor.lastCommit);
        contributor.velocity = contributor.commits / Math.max(contributor.activeDays, 1);
      });

      const contributors = Array.from(contributorMap.values())
        .sort((a, b) => b.commits - a.commits);

      return {
        total: contributors.length,
        topContributors: contributors.slice(0, 10),
        contributionDistribution: this.calculateContributionDistribution(contributors),
        expertiseMapping: this.calculateExpertiseMapping(contributors),
        collaborationNetwork: await this.analyzeCollaborationNetwork(contributors),
        busFactor: this.calculateBusFactor(contributors),
        diversityMetrics: this.calculateDiversityMetrics(contributors)
      };
    } catch (error) {
      logger.error('Error analyzing contributors:', error);
      return { total: 0, topContributors: [], contributionDistribution: {} };
    }
  }

  async analyzeFileChanges() {
    try {
      const log = await this.git.log({ 
        maxCount: 500,
        format: { hash: '%H', message: '%s', author_name: '%an', date: '%ai' }
      });

      const fileChangeMap = new Map();

      // Analyze each commit for file changes
      for (const commit of log.all.slice(0, 100)) { // Limit for performance
        try {
          const diff = await this.git.show([commit.hash, '--name-only', '--format=']);
          const files = diff.split('\n').filter(f => f.trim() !== '');

          files.forEach(file => {
            if (!fileChangeMap.has(file)) {
              fileChangeMap.set(file, {
                path: file,
                changeCount: 0,
                lastChanged: commit.date,
                extension: path.extname(file),
                directory: path.dirname(file)
              });
            }

            const fileInfo = fileChangeMap.get(file);
            fileInfo.changeCount++;
            
            if (new Date(commit.date) > new Date(fileInfo.lastChanged)) {
              fileInfo.lastChanged = commit.date;
            }
          });
        } catch (error) {
          // Skip commits that can't be analyzed
          continue;
        }
      }

      const fileChanges = Array.from(fileChangeMap.values())
        .sort((a, b) => b.changeCount - a.changeCount);

      return {
        totalFiles: fileChanges.length,
        mostChangedFiles: fileChanges.slice(0, 20),
        changesByExtension: this.groupByExtension(fileChanges),
        changesByDirectory: this.groupByDirectory(fileChanges)
      };
    } catch (error) {
      logger.error('Error analyzing file changes:', error);
      return {};
    }
  }

  async analyzeBranchActivity() {
    try {
      const branches = await this.git.branch(['-a']);
      const branchAnalysis = [];

      for (const branchName of branches.all) {
        if (branchName.startsWith('remotes/') && !branchName.includes('HEAD')) {
          continue; // Skip remote tracking branches
        }

        try {
          const log = await this.git.log({ 
            from: branchName,
            maxCount: 100 
          });

          if (log.all.length > 0) {
            branchAnalysis.push({
              name: branchName,
              commits: log.all.length,
              lastCommit: log.latest.date,
              lastAuthor: log.latest.author_name,
              active: this.isBranchActive(log.latest.date)
            });
          }
        } catch (error) {
          // Skip branches that can't be analyzed
          continue;
        }
      }

      return {
        totalBranches: branchAnalysis.length,
        activeBranches: branchAnalysis.filter(b => b.active).length,
        branchDetails: branchAnalysis.sort((a, b) => 
          new Date(b.lastCommit) - new Date(a.lastCommit)
        )
      };
    } catch (error) {
      logger.error('Error analyzing branch activity:', error);
      return {};
    }
  }

  async analyzeCommitPatterns() {
    try {
      const log = await this.git.log({ maxCount: 500 });
      const patterns = {
        byHour: new Array(24).fill(0),
        byDayOfWeek: new Array(7).fill(0),
        byMonth: new Array(12).fill(0),
        messagePatterns: new Map(),
        averageMessageLength: 0,
        conventionalCommits: 0
      };

      let totalMessageLength = 0;

      log.all.forEach(commit => {
        const date = new Date(commit.date);
        
        // Time patterns
        patterns.byHour[date.getHours()]++;
        patterns.byDayOfWeek[date.getDay()]++;
        patterns.byMonth[date.getMonth()]++;

        // Message analysis
        const message = commit.message;
        totalMessageLength += message.length;

        // Check for conventional commit format
        if (/^(feat|fix|docs|style|refactor|test|chore)(\(.+\))?:/.test(message)) {
          patterns.conventionalCommits++;
        }

        // Extract commit type
        const typeMatch = message.match(/^(\w+)(\(.+\))?:/);
        if (typeMatch) {
          const type = typeMatch[1];
          patterns.messagePatterns.set(type, 
            (patterns.messagePatterns.get(type) || 0) + 1);
        }
      });

      patterns.averageMessageLength = totalMessageLength / log.all.length;
      patterns.conventionalCommitPercentage = 
        (patterns.conventionalCommits / log.all.length) * 100;

      return patterns;
    } catch (error) {
      logger.error('Error analyzing commit patterns:', error);
      return {};
    }
  }

  async identifyHotspots() {
    try {
      const fileChanges = await this.analyzeFileChanges();
      const hotspots = [];

      // Files with high change frequency are potential hotspots
      const highChangeFiles = fileChanges.mostChangedFiles?.slice(0, 10) || [];

      for (const file of highChangeFiles) {
        try {
          // Get recent commits for this file
          const log = await this.git.log({ 
            file: file.path, 
            maxCount: 50 
          });

          const uniqueAuthors = new Set(log.all.map(c => c.author_email));
          const recentChanges = log.all.filter(c => 
            new Date(c.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
          ).length;

          hotspots.push({
            file: file.path,
            changeFrequency: file.changeCount,
            authorCount: uniqueAuthors.size,
            recentChanges,
            riskScore: this.calculateRiskScore(file.changeCount, uniqueAuthors.size, recentChanges),
            lastChanged: file.lastChanged
          });
        } catch (error) {
          // Skip files that can't be analyzed
          continue;
        }
      }

      return hotspots.sort((a, b) => b.riskScore - a.riskScore);
    } catch (error) {
      logger.error('Error identifying hotspots:', error);
      return [];
    }
  }

  async analyzeCodeChurn() {
    try {
      const log = await this.git.log({ 
        maxCount: this.config.maxCommitsToAnalyze,
        format: { hash: '%H', message: '%s', date: '%ai', author_name: '%an' }
      });

      const churnData = [];
      const fileChurnMap = new Map();
      const authorChurnMap = new Map();
      const timeWindowChurn = new Map();

      for (const commit of log.all) {
        try {
          const stats = await this.git.show([
            commit.hash, 
            '--numstat', 
            '--format='
          ]);

          const lines = stats.split('\n').filter(line => line.trim());
          let totalAdded = 0;
          let totalRemoved = 0;
          let filesChanged = 0;
          const fileChanges = [];

          lines.forEach(line => {
            const parts = line.split('\t');
            if (parts.length >= 3) {
              const added = parseInt(parts[0]) || 0;
              const removed = parseInt(parts[1]) || 0;
              const filename = parts[2];
              
              totalAdded += added;
              totalRemoved += removed;
              filesChanged++;

              // Track per-file churn
              if (!fileChurnMap.has(filename)) {
                fileChurnMap.set(filename, {
                  filename,
                  totalChurn: 0,
                  commits: 0,
                  authors: new Set(),
                  lastChanged: commit.date
                });
              }
              
              const fileChurn = fileChurnMap.get(filename);
              fileChurn.totalChurn += added + removed;
              fileChurn.commits++;
              fileChurn.authors.add(commit.author_name);
              
              if (new Date(commit.date) > new Date(fileChurn.lastChanged)) {
                fileChurn.lastChanged = commit.date;
              }

              fileChanges.push({
                filename,
                added,
                removed,
                churn: added + removed
              });
            }
          });

          const churnScore = totalAdded + totalRemoved;
          const commitData = {
            hash: commit.hash,
            date: commit.date,
            author: commit.author_name,
            message: commit.message,
            linesAdded: totalAdded,
            linesRemoved: totalRemoved,
            filesChanged,
            churnScore,
            fileChanges,
            riskScore: this.calculateChurnRiskScore(churnScore, filesChanged, commit.message)
          };

          churnData.push(commitData);

          // Track author churn
          if (!authorChurnMap.has(commit.author_name)) {
            authorChurnMap.set(commit.author_name, {
              author: commit.author_name,
              totalChurn: 0,
              commits: 0,
              avgChurnPerCommit: 0
            });
          }
          
          const authorChurn = authorChurnMap.get(commit.author_name);
          authorChurn.totalChurn += churnScore;
          authorChurn.commits++;
          authorChurn.avgChurnPerCommit = authorChurn.totalChurn / authorChurn.commits;

          // Track time-based churn patterns
          const timeWindow = this.getWeekWindow(commit.date);
          if (!timeWindowChurn.has(timeWindow)) {
            timeWindowChurn.set(timeWindow, { week: timeWindow, churn: 0, commits: 0 });
          }
          const windowData = timeWindowChurn.get(timeWindow);
          windowData.churn += churnScore;
          windowData.commits++;

        } catch (error) {
          // Skip commits that can't be analyzed
          continue;
        }
      }

      // Process file churn data
      const fileChurnArray = Array.from(fileChurnMap.values())
        .map(file => ({
          ...file,
          authors: file.authors.size,
          avgChurnPerCommit: file.totalChurn / file.commits,
          stabilityScore: this.calculateFileStabilityScore(file)
        }))
        .sort((a, b) => b.totalChurn - a.totalChurn);

      return {
        commits: churnData,
        averageChurn: churnData.length > 0 ? 
          churnData.reduce((sum, c) => sum + c.churnScore, 0) / churnData.length : 0,
        highChurnCommits: churnData.filter(c => c.churnScore > 500),
        fileChurn: fileChurnArray.slice(0, 50), // Top 50 most churned files
        authorChurn: Array.from(authorChurnMap.values())
          .sort((a, b) => b.totalChurn - a.totalChurn),
        churnTrends: Array.from(timeWindowChurn.values())
          .sort((a, b) => new Date(a.week) - new Date(b.week)),
        churnDistribution: this.calculateChurnDistribution(churnData),
        stabilityMetrics: this.calculateStabilityMetrics(fileChurnArray)
      };
    } catch (error) {
      logger.error('Error analyzing code churn:', error);
      return {};
    }
  }

  // New advanced analysis methods
  async analyzeTechnicalDebt() {
    try {
      const churnAnalysis = await this.analyzeCodeChurn();
      const hotspots = await this.identifyHotspots();
      const fileHistory = await this.analyzeFileHistory();
      
      const debtIndicators = [];
      const fileDebtScores = new Map();

      // Analyze each file for technical debt indicators
      for (const file of churnAnalysis.fileChurn || []) {
        const debtScore = this.calculateTechnicalDebtScore(file, fileHistory[file.filename]);
        fileDebtScores.set(file.filename, debtScore);

        if (debtScore.overallScore > this.config.technicalDebtThreshold) {
          debtIndicators.push({
            file: file.filename,
            debtScore: debtScore.overallScore,
            indicators: debtScore.indicators,
            recommendation: this.generateDebtRecommendation(debtScore),
            priority: this.calculateDebtPriority(debtScore, file)
          });
        }
      }

      // Calculate repository-wide debt metrics
      const totalDebtScore = Array.from(fileDebtScores.values())
        .reduce((sum, score) => sum + score.overallScore, 0) / fileDebtScores.size;

      return {
        overallDebtScore: totalDebtScore,
        debtLevel: this.categorizeDebtLevel(totalDebtScore),
        highDebtFiles: debtIndicators.sort((a, b) => b.debtScore - a.debtScore).slice(0, 20),
        debtTrends: await this.analyzeDebtTrends(),
        maintenanceLoad: this.calculateMaintenanceLoad(debtIndicators),
        recommendations: this.generateDebtRecommendations(debtIndicators)
      };
    } catch (error) {
      logger.error('Error analyzing technical debt:', error);
      return { overallDebtScore: 0, debtLevel: 'unknown', highDebtFiles: [] };
    }
  }

  async analyzeChangeCoupling() {
    try {
      const log = await this.git.log({ maxCount: this.config.maxCommitsToAnalyze });
      const fileCommitMap = new Map();
      const couplingPairs = new Map();

      // Build file co-change matrix
      for (const commit of log.all) {
        try {
          const changedFiles = await this.getChangedFilesInCommit(commit.hash);
          
          // Record which files were changed together
          for (let i = 0; i < changedFiles.length; i++) {
            for (let j = i + 1; j < changedFiles.length; j++) {
              const file1 = changedFiles[i];
              const file2 = changedFiles[j];
              const pairKey = [file1, file2].sort().join('::');
              
              if (!couplingPairs.has(pairKey)) {
                couplingPairs.set(pairKey, {
                  files: [file1, file2],
                  coChangeCount: 0,
                  commits: [],
                  strength: 0
                });
              }
              
              const pair = couplingPairs.get(pairKey);
              pair.coChangeCount++;
              pair.commits.push(commit.hash);
            }
          }

          // Track individual file change frequency
          changedFiles.forEach(file => {
            if (!fileCommitMap.has(file)) {
              fileCommitMap.set(file, { file, changeCount: 0, commits: [] });
            }
            const fileData = fileCommitMap.get(file);
            fileData.changeCount++;
            fileData.commits.push(commit.hash);
          });

        } catch (error) {
          continue; // Skip commits we can't analyze
        }
      }

      // Calculate coupling strength
      const strongCouplings = [];
      couplingPairs.forEach(pair => {
        const file1Data = fileCommitMap.get(pair.files[0]);
        const file2Data = fileCommitMap.get(pair.files[1]);
        
        if (file1Data && file2Data) {
          // Calculate Jaccard similarity coefficient
          const intersection = pair.coChangeCount;
          const union = file1Data.changeCount + file2Data.changeCount - intersection;
          pair.strength = intersection / union;
          
          if (pair.strength > this.config.changeCouplingThreshold) {
            strongCouplings.push({
              ...pair,
              confidence: pair.strength,
              recommendation: this.generateCouplingRecommendation(pair)
            });
          }
        }
      });

      return {
        totalPairs: couplingPairs.size,
        strongCouplings: strongCouplings.sort((a, b) => b.strength - a.strength),
        couplingNetwork: this.buildCouplingNetwork(strongCouplings),
        architecturalInsights: this.generateArchitecturalInsights(strongCouplings)
      };
    } catch (error) {
      logger.error('Error analyzing change coupling:', error);
      return { totalPairs: 0, strongCouplings: [] };
    }
  }

  async analyzeCodeOwnership() {
    try {
      const fileOwnership = new Map();
      const log = await this.git.log({ maxCount: this.config.maxCommitsToAnalyze });

      // Analyze ownership for each commit
      for (const commit of log.all) {
        try {
          const changedFiles = await this.getChangedFilesInCommit(commit.hash);
          
          changedFiles.forEach(file => {
            if (!fileOwnership.has(file)) {
              fileOwnership.set(file, {
                file,
                authors: new Map(),
                totalCommits: 0,
                primaryOwner: null,
                ownershipDistribution: {}
              });
            }
            
            const ownership = fileOwnership.get(file);
            const authorCommits = ownership.authors.get(commit.author_email) || 0;
            ownership.authors.set(commit.author_email, authorCommits + 1);
            ownership.totalCommits++;
          });
        } catch (error) {
          continue;
        }
      }

      // Calculate ownership metrics
      const ownershipAnalysis = [];
      fileOwnership.forEach(ownership => {
        const authorContributions = Array.from(ownership.authors.entries())
          .map(([email, commits]) => ({
            email,
            commits,
            percentage: (commits / ownership.totalCommits) * 100
          }))
          .sort((a, b) => b.commits - a.commits);

        ownership.primaryOwner = authorContributions[0];
        ownership.ownershipDistribution = {
          concentrated: authorContributions[0]?.percentage > 70,
          shared: authorContributions[0]?.percentage < 50,
          authorCount: authorContributions.length,
          topThreeOwnership: authorContributions.slice(0, 3)
            .reduce((sum, author) => sum + author.percentage, 0)
        };

        ownershipAnalysis.push(ownership);
      });

      return {
        fileOwnership: ownershipAnalysis.sort((a, b) => b.totalCommits - a.totalCommits),
        ownershipPatterns: this.analyzeOwnershipPatterns(ownershipAnalysis),
        riskAssessment: this.assessOwnershipRisk(ownershipAnalysis)
      };
    } catch (error) {
      logger.error('Error analyzing code ownership:', error);
      return { fileOwnership: [], ownershipPatterns: {}, riskAssessment: {} };
    }
  }

  async analyzeReleasePatterns() {
    try {
      const tags = await this.git.tags();
      const releaseAnalysis = [];
      
      for (const tag of tags.all) {
        try {
          const tagInfo = await this.git.show([tag, '--format=%H|%ai|%an|%s']);
          const [hash, date, author, message] = tagInfo.split('|');
          
          releaseAnalysis.push({
            tag,
            hash,
            date,
            author,
            message: message || '',
            version: this.extractVersion(tag),
            type: this.classifyRelease(tag, message)
          });
        } catch (error) {
          continue;
        }
      }

      // Analyze release intervals and patterns
      const sortedReleases = releaseAnalysis
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      const intervals = [];
      for (let i = 1; i < sortedReleases.length; i++) {
        const timeDiff = new Date(sortedReleases[i].date) - new Date(sortedReleases[i-1].date);
        intervals.push(timeDiff / (1000 * 60 * 60 * 24)); // Convert to days
      }

      return {
        totalReleases: releaseAnalysis.length,
        releases: sortedReleases,
        averageReleaseInterval: intervals.length > 0 ? 
          intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length : 0,
        releaseFrequency: this.calculateReleaseFrequency(sortedReleases),
        versioningPattern: this.analyzeVersioningPattern(sortedReleases)
      };
    } catch (error) {
      logger.error('Error analyzing release patterns:', error);
      return { totalReleases: 0, releases: [] };
    }
  }

  async analyzeTeamCollaboration() {
    try {
      const contributors = await this.analyzeContributors();
      const collaborationMatrix = new Map();
      const log = await this.git.log({ maxCount: this.config.maxCommitsToAnalyze });

      // Build collaboration network
      for (const commit of log.all) {
        try {
          const changedFiles = await this.getChangedFilesInCommit(commit.hash);
          
          // Find other contributors who worked on the same files recently
          for (const file of changedFiles) {
            const recentCommits = await this.git.log({ 
              file,
              maxCount: 10,
              since: '3 months ago'
            });
            
            const collaborators = new Set(recentCommits.all.map(c => c.author_email));
            collaborators.delete(commit.author_email); // Remove self
            
            if (!collaborationMatrix.has(commit.author_email)) {
              collaborationMatrix.set(commit.author_email, new Map());
            }
            
            const authorCollabs = collaborationMatrix.get(commit.author_email);
            collaborators.forEach(collaborator => {
              const currentCount = authorCollabs.get(collaborator) || 0;
              authorCollabs.set(collaborator, currentCount + 1);
            });
          }
        } catch (error) {
          continue;
        }
      }

      // Calculate collaboration metrics
      const collaborationMetrics = {
        networkDensity: this.calculateNetworkDensity(collaborationMatrix),
        isolatedContributors: this.findIsolatedContributors(collaborationMatrix),
        collaborationClusters: this.identifyCollaborationClusters(collaborationMatrix),
        knowledgeSharingScore: this.calculateKnowledgeSharingScore(collaborationMatrix)
      };

      return {
        collaborationMatrix: Object.fromEntries(
          Array.from(collaborationMatrix.entries()).map(([author, collabs]) => [
            author,
            Object.fromEntries(collabs)
          ])
        ),
        metrics: collaborationMetrics
      };
    } catch (error) {
      logger.error('Error analyzing team collaboration:', error);
      return { collaborationMatrix: {}, metrics: {} };
    }
  }

  async analyzeCodeStability() {
    try {
      const churnData = await this.analyzeCodeChurn();
      const fileStability = new Map();
      
      // Calculate stability metrics for each file
      churnData.fileChurn?.forEach(file => {
        const stabilityScore = this.calculateStabilityScore(file);
        fileStability.set(file.filename, {
          filename: file.filename,
          stabilityScore,
          volatility: file.totalChurn / file.commits,
          maturity: this.calculateFileMaturity(file),
          predictability: this.calculateFilePredictability(file)
        });
      });

      const stableFiles = Array.from(fileStability.values())
        .filter(f => f.stabilityScore > 0.7)
        .sort((a, b) => b.stabilityScore - a.stabilityScore);

      const unstableFiles = Array.from(fileStability.values())
        .filter(f => f.stabilityScore < 0.3)
        .sort((a, b) => a.stabilityScore - b.stabilityScore);

      return {
        overallStability: this.calculateOverallStability(Array.from(fileStability.values())),
        stableFiles,
        unstableFiles,
        stabilityTrends: await this.analyzeStabilityTrends(),
        recommendations: this.generateStabilityRecommendations(unstableFiles)
      };
    } catch (error) {
      logger.error('Error analyzing code stability:', error);
      return { overallStability: 0, stableFiles: [], unstableFiles: [] };
    }
  }

  async analyzePerformanceImpact() {
    try {
      const performanceCommits = [];
      const log = await this.git.log({ maxCount: 500 });
      
      // Identify performance-related commits
      for (const commit of log.all) {
        const message = commit.message.toLowerCase();
        const isPerformanceRelated = 
          message.includes('performance') ||
          message.includes('optimize') ||
          message.includes('speed') ||
          message.includes('memory') ||
          message.includes('cache') ||
          message.includes('benchmark') ||
          /\b(faster|slower|efficient|lag|bottleneck)\b/.test(message);
          
        if (isPerformanceRelated) {
          try {
            const commitDetails = await this.analyzeCommitDetails(commit.hash);
            performanceCommits.push({
              ...commit,
              details: commitDetails,
              performanceType: this.classifyPerformanceChange(message),
              impact: this.estimatePerformanceImpact(commit, commitDetails)
            });
          } catch (error) {
            continue;
          }
        }
      }

      return {
        performanceCommits,
        performanceTrends: this.analyzePerformanceTrends(performanceCommits),
        hotFiles: this.identifyPerformanceHotFiles(performanceCommits)
      };
    } catch (error) {
      logger.error('Error analyzing performance impact:', error);
      return { performanceCommits: [], performanceTrends: {}, hotFiles: [] };
    }
  }

  async analyzeTrends() {
    try {
      const timeWindows = ['1 month ago', '3 months ago', '6 months ago', '1 year ago'];
      const trends = {};
      
      for (const timeWindow of timeWindows) {
        try {
          const log = await this.git.log({ since: timeWindow, maxCount: 1000 });
          const windowAnalysis = {
            commits: log.all.length,
            contributors: new Set(log.all.map(c => c.author_email)).size,
            avgCommitSize: 0,
            commitTypes: new Map()
          };
          
          // Analyze commits in this time window
          let totalChurn = 0;
          for (const commit of log.all.slice(0, 100)) { // Limit for performance
            try {
              const details = await this.analyzeCommitDetails(commit.hash);
              totalChurn += details.insertions + details.deletions;
              
              const commitType = this.extractCommitType(commit.message) || 'other';
              windowAnalysis.commitTypes.set(commitType, 
                (windowAnalysis.commitTypes.get(commitType) || 0) + 1);
            } catch (error) {
              continue;
            }
          }
          
          windowAnalysis.avgCommitSize = log.all.length > 0 ? totalChurn / log.all.length : 0;
          windowAnalysis.commitTypes = Object.fromEntries(windowAnalysis.commitTypes);
          
          trends[timeWindow] = windowAnalysis;
        } catch (error) {
          trends[timeWindow] = { commits: 0, contributors: 0, avgCommitSize: 0 };
        }
      }
      
      return {
        trends,
        velocity: this.calculateVelocityTrend(trends),
        teamGrowth: this.calculateTeamGrowthTrend(trends),
        codebaseGrowth: this.calculateCodebaseGrowthTrend(trends)
      };
    } catch (error) {
      logger.error('Error analyzing trends:', error);
      return { trends: {}, velocity: {}, teamGrowth: {}, codebaseGrowth: {} };
    }
  }

  // Helper methods
  calculateContributionDistribution(contributors) {
    const total = contributors.reduce((sum, c) => sum + c.commits, 0);
    
    return {
      top10Percent: contributors.slice(0, Math.ceil(contributors.length * 0.1))
        .reduce((sum, c) => sum + c.commits, 0) / total,
      top25Percent: contributors.slice(0, Math.ceil(contributors.length * 0.25))
        .reduce((sum, c) => sum + c.commits, 0) / total,
      giniCoefficient: this.calculateGiniCoefficient(contributors.map(c => c.commits))
    };
  }

  calculateGiniCoefficient(values) {
    const n = values.length;
    const mean = values.reduce((sum, v) => sum + v, 0) / n;
    
    let numerator = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        numerator += Math.abs(values[i] - values[j]);
      }
    }
    
    return numerator / (2 * n * n * mean);
  }

  groupByExtension(files) {
    const grouped = new Map();
    
    files.forEach(file => {
      const ext = file.extension || 'no-extension';
      if (!grouped.has(ext)) {
        grouped.set(ext, { count: 0, totalChanges: 0 });
      }
      
      const group = grouped.get(ext);
      group.count++;
      group.totalChanges += file.changeCount;
    });

    return Object.fromEntries(grouped);
  }

  groupByDirectory(files) {
    const grouped = new Map();
    
    files.forEach(file => {
      const dir = file.directory || '.';
      if (!grouped.has(dir)) {
        grouped.set(dir, { count: 0, totalChanges: 0 });
      }
      
      const group = grouped.get(dir);
      group.count++;
      group.totalChanges += file.changeCount;
    });

    return Object.fromEntries(grouped);
  }

  isBranchActive(lastCommitDate) {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    return new Date(lastCommitDate) > thirtyDaysAgo;
  }

  calculateRiskScore(changeFrequency, authorCount, recentChanges) {
    // Higher change frequency = higher risk
    // More authors = potentially higher risk (conflicting changes)
    // Recent changes = higher current risk
    
    const frequencyScore = Math.min(changeFrequency / 10, 10);
    const authorScore = Math.min(authorCount / 3, 5);
    const recentScore = Math.min(recentChanges / 5, 5);
    
    return frequencyScore + authorScore + recentScore;
  }

  async generateComprehensiveInsights(analysis) {
    try {
      const insights = [];

      // Bus factor analysis
      if (analysis.contributors?.contributionDistribution?.top10Percent > 0.7) {
        insights.push({
          type: 'bus_factor',
          severity: 'high',
          message: 'High concentration of commits from few contributors. Consider knowledge sharing.',
          data: analysis.contributors.contributionDistribution,
          recommendations: [
            'Implement pair programming practices',
            'Document critical system knowledge',
            'Cross-train team members on different components'
          ]
        });
      }

      // Technical debt analysis
      if (analysis.technicalDebt?.overallDebtScore > 0.7) {
        insights.push({
          type: 'technical_debt',
          severity: 'high',
          message: `High technical debt detected (score: ${analysis.technicalDebt.overallDebtScore.toFixed(2)})`,
          data: analysis.technicalDebt,
          recommendations: analysis.technicalDebt.recommendations
        });
      }

      // Change coupling analysis
      const strongCouplings = analysis.changeCoupling?.strongCouplings?.length || 0;
      if (strongCouplings > 10) {
        insights.push({
          type: 'change_coupling',
          severity: 'medium',
          message: `${strongCouplings} strong coupling relationships detected`,
          data: analysis.changeCoupling.strongCouplings.slice(0, 5),
          recommendations: [
            'Consider refactoring highly coupled components',
            'Evaluate architectural boundaries',
            'Implement dependency injection patterns'
          ]
        });
      }

      // Code stability analysis
      if (analysis.stabilityMetrics?.overallStability < 0.5) {
        insights.push({
          type: 'code_stability',
          severity: 'medium',
          message: 'Low code stability detected',
          data: analysis.stabilityMetrics,
          recommendations: [
            'Focus on stabilizing frequently changing files',
            'Increase test coverage for unstable components',
            'Implement change management processes'
          ]
        });
      }

      // Hotspot analysis
      const highRiskFiles = analysis.hotspots?.filter(h => h.riskScore > 15) || [];
      if (highRiskFiles.length > 0) {
        insights.push({
          type: 'hotspots',
          severity: 'medium',
          message: `${highRiskFiles.length} files identified as high-risk hotspots`,
          data: highRiskFiles.slice(0, 10),
          recommendations: [
            'Prioritize refactoring of hotspot files',
            'Add comprehensive tests for hotspots',
            'Consider breaking down large, frequently changed files'
          ]
        });
      }

      // Commit message quality
      if (analysis.commitPatterns?.conventionalCommitPercentage < 30) {
        insights.push({
          type: 'commit_quality',
          severity: 'low',
          message: 'Low adoption of conventional commit messages',
          data: { percentage: analysis.commitPatterns.conventionalCommitPercentage },
          recommendations: [
            'Adopt conventional commit message format',
            'Set up commit message templates',
            'Use commit linting tools'
          ]
        });
      }

      // Team collaboration insights
      if (analysis.collaborationMetrics?.metrics?.isolatedContributors?.length > 0) {
        insights.push({
          type: 'collaboration',
          severity: 'low',
          message: 'Isolated contributors detected in team',
          data: analysis.collaborationMetrics.metrics.isolatedContributors,
          recommendations: [
            'Encourage code reviews across team members',
            'Implement knowledge sharing sessions',
            'Rotate responsibilities among team members'
          ]
        });
      }

      return insights;
    } catch (error) {
      logger.error('Error generating comprehensive insights:', error);
      return [];
    }
  }

  async storeAnalysisInKnowledgeGraph(analysis) {
    if (!this.kuzu) {
      logger.warn('No Kuzu client provided, skipping knowledge graph storage');
      return;
    }

    try {
      logger.info('Storing Git analysis in knowledge graph');

      // Store repository metadata
      await this.storeRepositoryMetadata(analysis.metadata);

      // Store contributors as entities
      await this.storeContributors(analysis.contributors);

      // Store hotspots as high-risk entities
      await this.storeHotspots(analysis.hotspots);

      // Store change coupling relationships
      await this.storeChangeCouplings(analysis.changeCoupling);

      // Store technical debt information
      await this.storeTechnicalDebt(analysis.technicalDebt);

      // Store insights as decision records
      await this.storeInsights(analysis.insights);

      logger.info('Git analysis successfully stored in knowledge graph');
    } catch (error) {
      logger.error('Error storing Git analysis in knowledge graph:', error);
      throw error;
    }
  }

  async storeRepositoryMetadata(metadata) {
    if (!metadata || !this.kuzu) return;

    try {
      await this.kuzu.createNode('Repository', {
        id: `repo_${this.repoPath.replace(/\W/g, '_')}`,
        type: 'repository',
        name: path.basename(this.repoPath),
        path: this.repoPath,
        isRepository: metadata.isRepository,
        rootDirectory: metadata.rootDirectory,
        analyzedAt: metadata.analyzedAt,
        analyzer: metadata.analyzer,
        agent: 'GitAnalyzer',
        context: 'Repository metadata and configuration',
        reason: 'Track repository structure and analysis metadata',
        change: 'Added comprehensive repository analysis data',
        prevention: 'Missing repository context and metadata'
      });
    } catch (error) {
      logger.error('Error storing repository metadata:', error);
    }
  }

  async storeContributors(contributors) {
    if (!contributors?.topContributors || !this.kuzu) return;

    try {
      for (const contributor of contributors.topContributors) {
        const contributorId = `contributor_${contributor.email.replace(/\W/g, '_')}`;
        
        await this.kuzu.createNode('Contributor', {
          id: contributorId,
          type: 'contributor',
          name: contributor.name,
          email: contributor.email,
          commits: contributor.commits,
          velocity: contributor.velocity || 0,
          activeDays: contributor.activeDays || 0,
          expertiseAreas: JSON.stringify(contributor.expertiseAreas || {}),
          agent: 'GitAnalyzer',
          context: 'Developer contribution analysis',
          reason: 'Track developer expertise and contribution patterns',
          change: 'Added contributor analysis with expertise mapping',
          prevention: 'Missing developer contribution insights'
        });
      }
    } catch (error) {
      logger.error('Error storing contributors:', error);
    }
  }

  async storeHotspots(hotspots) {
    if (!hotspots || !this.kuzu) return;

    try {
      for (const hotspot of hotspots) {
        const hotspotId = `hotspot_${hotspot.file.replace(/\W/g, '_')}`;
        
        await this.kuzu.createNode('Hotspot', {
          id: hotspotId,
          type: 'hotspot',
          name: path.basename(hotspot.file),
          filePath: hotspot.file,
          riskScore: hotspot.riskScore,
          changeFrequency: hotspot.changeFrequency,
          authorCount: hotspot.authorCount,
          recentChanges: hotspot.recentChanges,
          agent: 'GitAnalyzer',
          context: 'High-risk file identification',
          reason: 'Identify files requiring attention due to high change frequency',
          change: 'Added hotspot analysis with risk scoring',
          prevention: 'Unidentified high-risk code areas'
        });
      }
    } catch (error) {
      logger.error('Error storing hotspots:', error);
    }
  }

  async storeChangeCouplings(changeCoupling) {
    if (!changeCoupling?.strongCouplings || !this.kuzu) return;

    try {
      for (const coupling of changeCoupling.strongCouplings) {
        const coupling1Id = `file_${coupling.files[0].replace(/\W/g, '_')}`;
        const coupling2Id = `file_${coupling.files[1].replace(/\W/g, '_')}`;
        
        // Create relationship between coupled files
        await this.kuzu.createRelationship(coupling1Id, 'COUPLED_WITH', coupling2Id, {
          strength: coupling.strength,
          coChangeCount: coupling.coChangeCount,
          confidence: coupling.confidence,
          recommendation: coupling.recommendation
        });
      }
    } catch (error) {
      logger.error('Error storing change couplings:', error);
    }
  }

  async storeTechnicalDebt(technicalDebt) {
    if (!technicalDebt?.highDebtFiles || !this.kuzu) return;

    try {
      for (const debtFile of technicalDebt.highDebtFiles) {
        const debtId = `debt_${debtFile.file.replace(/\W/g, '_')}`;
        
        await this.kuzu.createNode('TechnicalDebt', {
          id: debtId,
          type: 'technical_debt',
          name: path.basename(debtFile.file),
          filePath: debtFile.file,
          debtScore: debtFile.debtScore,
          priority: debtFile.priority,
          indicators: JSON.stringify(debtFile.indicators),
          recommendation: debtFile.recommendation,
          agent: 'GitAnalyzer',
          context: 'Technical debt identification and tracking',
          reason: 'Track and prioritize technical debt for remediation',
          change: 'Added technical debt analysis with scoring',
          prevention: 'Accumulating technical debt without visibility'
        });
      }
    } catch (error) {
      logger.error('Error storing technical debt:', error);
    }
  }

  async storeInsights(insights) {
    if (!insights || !this.kuzu) return;

    try {
      for (const insight of insights) {
        const insightId = `insight_${insight.type}_${Date.now()}`;
        
        await this.kuzu.createNode('Insight', {
          id: insightId,
          type: 'git_insight',
          name: insight.type,
          message: insight.message,
          severity: insight.severity,
          recommendations: JSON.stringify(insight.recommendations || []),
          data: JSON.stringify(insight.data || {}),
          agent: 'GitAnalyzer',
          context: 'Git repository analysis insights',
          reason: 'Provide actionable insights from Git analysis',
          change: 'Added Git analysis insights and recommendations',
          prevention: 'Missing actionable insights from repository analysis'
        });
      }
    } catch (error) {
      logger.error('Error storing insights:', error);
    }
  }

  getAnalysisMetrics() {
    return {
      ...this.metrics,
      analysisEndTime: Date.now(),
      totalAnalysisTime: Date.now() - (this.metrics.analysisStartTime || Date.now())
    };
  }

  // Additional helper methods for the new features
  async analyzeCommitDetails(commitHash) {
    try {
      const stats = await this.git.show([commitHash, '--numstat', '--format=']);
      const files = [];
      let insertions = 0;
      let deletions = 0;

      const lines = stats.split('\n').filter(line => line.trim());
      lines.forEach(line => {
        const parts = line.split('\t');
        if (parts.length >= 3) {
          const added = parseInt(parts[0]) || 0;
          const removed = parseInt(parts[1]) || 0;
          const filename = parts[2];
          
          insertions += added;
          deletions += removed;
          files.push({ filename, added, removed });
        }
      });

      return { files, insertions, deletions };
    } catch (error) {
      logger.debug(`Could not analyze commit details for ${commitHash}:`, error.message);
      return { files: [], insertions: 0, deletions: 0 };
    }
  }

  async getChangedFilesInCommit(commitHash) {
    try {
      const diff = await this.git.show([commitHash, '--name-only', '--format=']);
      return diff.split('\n').filter(f => f.trim() !== '');
    } catch (error) {
      return [];
    }
  }

  extractCommitType(message) {
    const match = message.match(/^(\w+)(\(.+\))?:/);
    return match ? match[1] : null;
  }

  createTimeWindows(commits) {
    if (commits.length === 0) return [];
    
    const dates = commits.map(c => new Date(c.date)).sort();
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    const totalDays = (endDate - startDate) / (1000 * 60 * 60 * 24);
    
    const windowSize = Math.max(7, Math.floor(totalDays / 12)); // ~12 windows
    const windows = [];
    
    for (let i = 0; i < totalDays; i += windowSize) {
      const windowStart = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
      const windowEnd = new Date(windowStart.getTime() + windowSize * 24 * 60 * 60 * 1000);
      windows.push(`${windowStart.toISOString().split('T')[0]}_to_${windowEnd.toISOString().split('T')[0]}`);
    }
    
    return windows;
  }

  getTimeWindow(date, windows) {
    // Simple implementation - could be enhanced
    return windows[Math.floor(Math.random() * windows.length)] || 'unknown';
  }

  getWeekWindow(date) {
    const d = new Date(date);
    const weekStart = new Date(d.setDate(d.getDate() - d.getDay()));
    return weekStart.toISOString().split('T')[0];
  }

  calculateActiveDays(firstCommit, lastCommit) {
    const start = new Date(firstCommit);
    const end = new Date(lastCommit);
    return Math.max(1, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
  }

  calculateExpertiseMapping(contributors) {
    const expertiseMap = new Map();
    
    contributors.forEach(contributor => {
      Object.entries(contributor.expertiseAreas || {}).forEach(([ext, count]) => {
        if (!expertiseMap.has(ext)) {
          expertiseMap.set(ext, []);
        }
        expertiseMap.get(ext).push({
          contributor: contributor.name,
          email: contributor.email,
          expertise: count
        });
      });
    });

    // Sort experts by expertise level for each extension
    expertiseMap.forEach(experts => {
      experts.sort((a, b) => b.expertise - a.expertise);
    });

    return Object.fromEntries(expertiseMap);
  }

  async analyzeCollaborationNetwork(contributors) {
    // Simplified collaboration network analysis
    const network = {
      nodes: contributors.map(c => ({
        id: c.email,
        name: c.name,
        commits: c.commits,
        size: Math.log(c.commits + 1) * 10
      })),
      edges: []
    };

    // This would need more sophisticated analysis of actual collaboration
    // For now, return basic network structure
    return network;
  }

  calculateBusFactor(contributors) {
    // Calculate how many contributors need to leave before the project is at risk
    const totalCommits = contributors.reduce((sum, c) => sum + c.commits, 0);
    let cumulativeCommits = 0;
    let busFactor = 0;

    for (const contributor of contributors.sort((a, b) => b.commits - a.commits)) {
      cumulativeCommits += contributor.commits;
      busFactor++;
      
      if (cumulativeCommits >= totalCommits * 0.5) {
        break;
      }
    }

    return {
      factor: busFactor,
      risk: busFactor <= 2 ? 'high' : busFactor <= 5 ? 'medium' : 'low',
      description: `${busFactor} contributors are responsible for 50% of commits`
    };
  }

  calculateDiversityMetrics(contributors) {
    const totalContributors = contributors.length;
    const activeContributors = contributors.filter(c => 
      new Date(c.lastCommit) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
    ).length;

    return {
      totalContributors,
      activeContributors,
      activityRatio: activeContributors / totalContributors,
      contributorGrowth: this.calculateContributorGrowth(contributors)
    };
  }

  calculateContributorGrowth(contributors) {
    // Simplified growth calculation
    const now = new Date();
    const threeMonthsAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    const sixMonthsAgo = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);

    const recentContributors = contributors.filter(c => 
      new Date(c.firstCommit) > threeMonthsAgo
    ).length;

    const olderContributors = contributors.filter(c => 
      new Date(c.firstCommit) > sixMonthsAgo && new Date(c.firstCommit) <= threeMonthsAgo
    ).length;

    return {
      recent: recentContributors,
      previous: olderContributors,
      trend: recentContributors > olderContributors ? 'growing' : 
             recentContributors < olderContributors ? 'declining' : 'stable'
    };
  }

  async generateInsights() {
    const analysis = await this.analyzeRepository();
    return this.generateComprehensiveInsights(analysis);
  }

  // Additional helper methods for new functionality
  async analyzeFileHistory() {
    const fileHistory = {};
    try {
      const log = await this.git.log({ maxCount: 500 });
      
      for (const commit of log.all) {
        try {
          const changedFiles = await this.getChangedFilesInCommit(commit.hash);
          changedFiles.forEach(file => {
            if (!fileHistory[file]) {
              fileHistory[file] = {
                commits: [],
                authors: new Set(),
                createdAt: commit.date,
                lastModified: commit.date
              };
            }
            
            fileHistory[file].commits.push({
              hash: commit.hash,
              date: commit.date,
              author: commit.author_email,
              message: commit.message
            });
            
            fileHistory[file].authors.add(commit.author_email);
            
            if (new Date(commit.date) < new Date(fileHistory[file].createdAt)) {
              fileHistory[file].createdAt = commit.date;
            }
            if (new Date(commit.date) > new Date(fileHistory[file].lastModified)) {
              fileHistory[file].lastModified = commit.date;
            }
          });
        } catch (error) {
          continue;
        }
      }
      
      // Convert Sets to arrays for serialization
      Object.values(fileHistory).forEach(history => {
        history.authors = Array.from(history.authors);
      });
      
    } catch (error) {
      logger.error('Error analyzing file history:', error);
    }
    
    return fileHistory;
  }

  calculateTechnicalDebtScore(file, history) {
    const indicators = [];
    let score = 0;

    // High change frequency indicator
    const changeFrequency = file.totalChurn / file.commits;
    if (changeFrequency > 100) {
      indicators.push('high_change_frequency');
      score += 0.3;
    }

    // Multiple authors indicator (potential knowledge fragmentation)
    if (file.authors > 5) {
      indicators.push('multiple_authors');
      score += 0.2;
    }

    // Recent high activity indicator
    const recentCommits = history?.commits?.filter(c => 
      new Date(c.date) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    )?.length || 0;
    
    if (recentCommits > 10) {
      indicators.push('recent_high_activity');
      score += 0.2;
    }

    // Large average commit size indicator
    if (file.avgChurnPerCommit > 200) {
      indicators.push('large_commits');
      score += 0.15;
    }

    // File age vs activity indicator
    const ageInDays = history ? 
      (new Date() - new Date(history.createdAt)) / (1000 * 60 * 60 * 24) : 365;
    const activityRatio = file.commits / Math.max(ageInDays, 1);
    
    if (activityRatio > 0.1) { // More than 1 commit per 10 days on average
      indicators.push('high_activity_ratio');
      score += 0.15;
    }

    return {
      overallScore: Math.min(score, 1.0),
      indicators,
      metrics: {
        changeFrequency,
        authorCount: file.authors,
        recentCommits,
        avgCommitSize: file.avgChurnPerCommit,
        activityRatio
      }
    };
  }

  generateDebtRecommendation(debtScore) {
    const recommendations = [];
    
    if (debtScore.indicators.includes('high_change_frequency')) {
      recommendations.push('Consider refactoring to reduce complexity');
    }
    if (debtScore.indicators.includes('multiple_authors')) {
      recommendations.push('Establish code ownership and review processes');
    }
    if (debtScore.indicators.includes('recent_high_activity')) {
      recommendations.push('Monitor for potential design issues');
    }
    if (debtScore.indicators.includes('large_commits')) {
      recommendations.push('Break down changes into smaller, focused commits');
    }
    if (debtScore.indicators.includes('high_activity_ratio')) {
      recommendations.push('Investigate if frequent changes indicate design problems');
    }

    return recommendations.join('; ');
  }

  calculateDebtPriority(debtScore, file) {
    let priority = 0;
    
    // Higher score means higher priority
    priority += debtScore.overallScore * 10;
    
    // More recent changes increase priority
    const daysSinceLastChange = (new Date() - new Date(file.lastChanged)) / (1000 * 60 * 60 * 24);
    if (daysSinceLastChange < 7) priority += 3;
    else if (daysSinceLastChange < 30) priority += 1;
    
    // File extension priority (focusing on source code)
    const ext = path.extname(file.filename);
    if (['.js', '.ts', '.py', '.java', '.cpp', '.c'].includes(ext)) {
      priority += 2;
    }
    
    return Math.min(Math.floor(priority), 10);
  }

  categorizeDebtLevel(score) {
    if (score < 0.3) return 'low';
    if (score < 0.6) return 'medium';
    if (score < 0.8) return 'high';
    return 'critical';
  }

  async analyzeDebtTrends() {
    // Simplified debt trend analysis
    const timeWindows = ['1 month ago', '3 months ago', '6 months ago'];
    const trends = {};
    
    for (const window of timeWindows) {
      try {
        const log = await this.git.log({ since: window, maxCount: 200 });
        const windowFiles = new Set();
        
        for (const commit of log.all) {
          try {
            const files = await this.getChangedFilesInCommit(commit.hash);
            files.forEach(file => windowFiles.add(file));
          } catch (error) {
            continue;
          }
        }
        
        trends[window] = {
          changedFiles: windowFiles.size,
          commits: log.all.length,
          avgFilesPerCommit: windowFiles.size / Math.max(log.all.length, 1)
        };
      } catch (error) {
        trends[window] = { changedFiles: 0, commits: 0, avgFilesPerCommit: 0 };
      }
    }
    
    return trends;
  }

  calculateMaintenanceLoad(debtIndicators) {
    const totalFiles = debtIndicators.length;
    const highPriorityFiles = debtIndicators.filter(d => d.priority >= 7).length;
    const mediumPriorityFiles = debtIndicators.filter(d => d.priority >= 4 && d.priority < 7).length;
    
    return {
      totalFiles,
      highPriorityFiles,
      mediumPriorityFiles,
      maintenanceScore: (highPriorityFiles * 3 + mediumPriorityFiles) / Math.max(totalFiles, 1)
    };
  }

  generateDebtRecommendations(debtIndicators) {
    const recommendations = [];
    
    if (debtIndicators.length > 20) {
      recommendations.push('High number of debt files detected - consider dedicated refactoring sprint');
    }
    
    const highPriorityCount = debtIndicators.filter(d => d.priority >= 7).length;
    if (highPriorityCount > 5) {
      recommendations.push('Multiple high-priority debt files - address these first');
    }
    
    const commonIndicators = this.findCommonIndicators(debtIndicators);
    if (commonIndicators.high_change_frequency > debtIndicators.length * 0.5) {
      recommendations.push('High change frequency is common - review architecture and design patterns');
    }
    
    return recommendations;
  }

  findCommonIndicators(debtIndicators) {
    const indicatorCounts = {};
    debtIndicators.forEach(debt => {
      debt.indicators.forEach(indicator => {
        indicatorCounts[indicator] = (indicatorCounts[indicator] || 0) + 1;
      });
    });
    return indicatorCounts;
  }

  generateCouplingRecommendation(pair) {
    if (pair.strength > 0.8) {
      return 'Very strong coupling - consider merging files or extracting common functionality';
    } else if (pair.strength > 0.6) {
      return 'Strong coupling detected - review shared dependencies and interfaces';
    } else {
      return 'Moderate coupling - monitor for potential architectural issues';
    }
  }

  buildCouplingNetwork(strongCouplings) {
    const nodes = new Set();
    const edges = [];
    
    strongCouplings.forEach(coupling => {
      coupling.files.forEach(file => nodes.add(file));
      edges.push({
        source: coupling.files[0],
        target: coupling.files[1],
        weight: coupling.strength
      });
    });
    
    return {
      nodes: Array.from(nodes).map(file => ({ id: file, name: path.basename(file) })),
      edges
    };
  }

  generateArchitecturalInsights(strongCouplings) {
    const insights = [];
    
    // Find files that are coupled with many others (potential god objects)
    const fileCouplingCount = new Map();
    strongCouplings.forEach(coupling => {
      coupling.files.forEach(file => {
        fileCouplingCount.set(file, (fileCouplingCount.get(file) || 0) + 1);
      });
    });
    
    const highlyCoupledFiles = Array.from(fileCouplingCount.entries())
      .filter(([file, count]) => count >= 3)
      .sort(([,a], [,b]) => b - a);
    
    if (highlyCoupledFiles.length > 0) {
      insights.push({
        type: 'high_coupling_concentration',
        message: `${highlyCoupledFiles.length} files have high coupling with multiple other files`,
        files: highlyCoupledFiles.slice(0, 5)
      });
    }
    
    return insights;
  }

  analyzeOwnershipPatterns(ownershipAnalysis) {
    const concentrated = ownershipAnalysis.filter(f => f.ownershipDistribution.concentrated).length;
    const shared = ownershipAnalysis.filter(f => f.ownershipDistribution.shared).length;
    const total = ownershipAnalysis.length;
    
    return {
      concentratedOwnership: concentrated / total,
      sharedOwnership: shared / total,
      averageAuthorsPerFile: ownershipAnalysis.reduce((sum, f) => 
        sum + f.ownershipDistribution.authorCount, 0) / total,
      ownershipDistribution: {
        concentrated: concentrated,
        shared: shared,
        mixed: total - concentrated - shared
      }
    };
  }

  assessOwnershipRisk(ownershipAnalysis) {
    const singleOwnerFiles = ownershipAnalysis.filter(f => 
      f.ownershipDistribution.authorCount === 1
    ).length;
    
    const highConcentrationFiles = ownershipAnalysis.filter(f => 
      f.primaryOwner?.percentage > 90
    ).length;
    
    return {
      singleOwnerFiles,
      highConcentrationFiles,
      riskLevel: singleOwnerFiles > ownershipAnalysis.length * 0.3 ? 'high' : 
                 singleOwnerFiles > ownershipAnalysis.length * 0.1 ? 'medium' : 'low',
      recommendations: this.generateOwnershipRecommendations(singleOwnerFiles, highConcentrationFiles)
    };
  }

  generateOwnershipRecommendations(singleOwner, highConcentration) {
    const recommendations = [];
    
    if (singleOwner > 10) {
      recommendations.push('Many files have single owners - encourage knowledge sharing');
    }
    if (highConcentration > 5) {
      recommendations.push('High ownership concentration detected - implement code review practices');
    }
    
    return recommendations;
  }

  extractVersion(tag) {
    // Extract semantic version from tag
    const versionMatch = tag.match(/(\d+)\.(\d+)\.(\d+)/);
    return versionMatch ? versionMatch[0] : tag;
  }

  classifyRelease(tag, message) {
    const tagLower = tag.toLowerCase();
    const messageLower = (message || '').toLowerCase();
    
    if (tagLower.includes('alpha') || messageLower.includes('alpha')) return 'alpha';
    if (tagLower.includes('beta') || messageLower.includes('beta')) return 'beta';
    if (tagLower.includes('rc') || messageLower.includes('release candidate')) return 'rc';
    if (tagLower.includes('patch') || messageLower.includes('patch')) return 'patch';
    if (tagLower.includes('minor') || messageLower.includes('minor')) return 'minor';
    if (tagLower.includes('major') || messageLower.includes('major')) return 'major';
    
    return 'stable';
  }

  calculateReleaseFrequency(releases) {
    if (releases.length < 2) return { frequency: 0, pattern: 'irregular' };
    
    const intervals = [];
    for (let i = 1; i < releases.length; i++) {
      const timeDiff = new Date(releases[i].date) - new Date(releases[i-1].date);
      intervals.push(timeDiff / (1000 * 60 * 60 * 24)); // Days
    }
    
    const avgInterval = intervals.reduce((sum, interval) => sum + interval, 0) / intervals.length;
    const stdDev = Math.sqrt(intervals.reduce((sum, interval) => 
      sum + Math.pow(interval - avgInterval, 2), 0) / intervals.length);
    
    let pattern = 'irregular';
    if (stdDev / avgInterval < 0.3) {
      if (avgInterval <= 7) pattern = 'continuous';
      else if (avgInterval <= 30) pattern = 'frequent';
      else if (avgInterval <= 90) pattern = 'regular';
      else pattern = 'infrequent';
    }
    
    return {
      frequency: 365 / avgInterval, // Releases per year
      averageInterval: avgInterval,
      pattern,
      consistency: 1 - (stdDev / avgInterval)
    };
  }

  analyzeVersioningPattern(releases) {
    const versions = releases.map(r => r.version).filter(v => v.match(/\d+\.\d+\.\d+/));
    
    if (versions.length === 0) {
      return { pattern: 'non_semantic', compliance: 0 };
    }
    
    const semanticVersions = versions.length;
    const totalReleases = releases.length;
    const compliance = semanticVersions / totalReleases;
    
    return {
      pattern: compliance > 0.8 ? 'semantic' : 'mixed',
      compliance,
      semanticVersions,
      totalReleases
    };
  }

  calculateChurnRiskScore(churnScore, filesChanged, message) {
    let risk = 0;
    
    // High churn increases risk
    if (churnScore > 1000) risk += 3;
    else if (churnScore > 500) risk += 2;
    else if (churnScore > 100) risk += 1;
    
    // Many files changed increases risk
    if (filesChanged > 20) risk += 2;
    else if (filesChanged > 10) risk += 1;
    
    // Certain keywords in commit message increase risk
    const riskKeywords = ['hotfix', 'emergency', 'urgent', 'critical', 'fix'];
    const hasRiskKeywords = riskKeywords.some(keyword => 
      message.toLowerCase().includes(keyword)
    );
    if (hasRiskKeywords) risk += 1;
    
    return Math.min(risk, 10);
  }

  calculateFileStabilityScore(file) {
    const avgChurn = file.totalChurn / file.commits;
    const authorDiversity = file.authors > 3 ? 0.5 : 1.0;
    const timeStability = file.commits < 10 ? 1.0 : 0.8;
    
    // Lower churn and fewer authors indicate higher stability
    const churnStability = Math.max(0, 1 - (avgChurn / 100));
    
    return (churnStability + authorDiversity + timeStability) / 3;
  }

  calculateChurnDistribution(churnData) {
    if (churnData.length === 0) return {};
    
    const churnScores = churnData.map(c => c.churnScore).sort((a, b) => a - b);
    const length = churnScores.length;
    
    return {
      min: churnScores[0],
      max: churnScores[length - 1],
      median: churnScores[Math.floor(length / 2)],
      q1: churnScores[Math.floor(length * 0.25)],
      q3: churnScores[Math.floor(length * 0.75)],
      mean: churnScores.reduce((sum, score) => sum + score, 0) / length
    };
  }

  calculateStabilityMetrics(fileChurnArray) {
    if (fileChurnArray.length === 0) return {};
    
    const stabilityScores = fileChurnArray.map(f => f.stabilityScore || 0);
    const averageStability = stabilityScores.reduce((sum, score) => sum + score, 0) / stabilityScores.length;
    
    return {
      averageStability,
      stableFileCount: stabilityScores.filter(s => s > 0.7).length,
      unstableFileCount: stabilityScores.filter(s => s < 0.3).length,
      stabilityDistribution: {
        high: stabilityScores.filter(s => s > 0.7).length,
        medium: stabilityScores.filter(s => s >= 0.3 && s <= 0.7).length,
        low: stabilityScores.filter(s => s < 0.3).length
      }
    };
  }

  // Additional helper methods...
  calculateNetworkDensity(collaborationMatrix) {
    const nodes = collaborationMatrix.size;
    if (nodes < 2) return 0;
    
    let edges = 0;
    collaborationMatrix.forEach(collabs => {
      edges += collabs.size;
    });
    
    const maxPossibleEdges = nodes * (nodes - 1);
    return edges / maxPossibleEdges;
  }

  findIsolatedContributors(collaborationMatrix) {
    const isolated = [];
    collaborationMatrix.forEach((collabs, contributor) => {
      if (collabs.size === 0) {
        isolated.push(contributor);
      }
    });
    return isolated;
  }

  identifyCollaborationClusters(collaborationMatrix) {
    // Simplified clustering - would need more sophisticated algorithm for production
    return [];
  }

  calculateKnowledgeSharingScore(collaborationMatrix) {
    let totalConnections = 0;
    let contributorCount = 0;
    
    collaborationMatrix.forEach(collabs => {
      totalConnections += collabs.size;
      contributorCount++;
    });
    
    return contributorCount > 0 ? totalConnections / contributorCount : 0;
  }

  calculateStabilityScore(file) {
    return this.calculateFileStabilityScore(file);
  }

  calculateFileMaturity(file) {
    // Files with consistent, smaller changes over time are more mature
    const consistency = 1 / (file.avgChurnPerCommit || 1);
    const experience = Math.min(file.commits / 10, 1); // Normalize to 0-1
    return (consistency + experience) / 2;
  }

  calculateFilePredictability(file) {
    // Based on consistency of changes and author patterns
    const authorConsistency = file.authors <= 2 ? 1.0 : 0.5;
    const changeConsistency = file.avgChurnPerCommit < 50 ? 1.0 : 0.5;
    return (authorConsistency + changeConsistency) / 2;
  }

  calculateOverallStability(fileStabilityArray) {
    if (fileStabilityArray.length === 0) return 0;
    return fileStabilityArray.reduce((sum, f) => sum + f.stabilityScore, 0) / fileStabilityArray.length;
  }

  async analyzeStabilityTrends() {
    // Simplified trend analysis
    return {
      trend: 'stable',
      description: 'Stability trends analysis requires historical data'
    };
  }

  generateStabilityRecommendations(unstableFiles) {
    const recommendations = [];
    
    if (unstableFiles.length > 10) {
      recommendations.push('Many unstable files detected - consider architecture review');
    }
    
    unstableFiles.slice(0, 5).forEach(file => {
      recommendations.push(`Focus on stabilizing ${file.filename} (stability: ${file.stabilityScore.toFixed(2)})`);
    });
    
    return recommendations;
  }

  classifyPerformanceChange(message) {
    const message_lower = message.toLowerCase();
    if (message_lower.includes('memory')) return 'memory';
    if (message_lower.includes('cache')) return 'caching';
    if (message_lower.includes('optimize')) return 'optimization';
    if (message_lower.includes('performance')) return 'general';
    return 'other';
  }

  estimatePerformanceImpact(commit, details) {
    // Simplified impact estimation
    let impact = 'low';
    
    if (details.insertions + details.deletions > 1000) impact = 'high';
    else if (details.insertions + details.deletions > 100) impact = 'medium';
    
    return impact;
  }

  analyzePerformanceTrends(performanceCommits) {
    if (performanceCommits.length === 0) return {};
    
    const trends = {
      totalCommits: performanceCommits.length,
      byType: {},
      recentActivity: performanceCommits.filter(c => 
        new Date(c.date) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
      ).length
    };
    
    performanceCommits.forEach(commit => {
      const type = commit.performanceType;
      trends.byType[type] = (trends.byType[type] || 0) + 1;
    });
    
    return trends;
  }

  identifyPerformanceHotFiles(performanceCommits) {
    const fileMap = new Map();
    
    performanceCommits.forEach(commit => {
      commit.details.files.forEach(file => {
        if (!fileMap.has(file.filename)) {
          fileMap.set(file.filename, { file: file.filename, commits: 0, totalChurn: 0 });
        }
        const fileData = fileMap.get(file.filename);
        fileData.commits++;
        fileData.totalChurn += file.added + file.removed;
      });
    });
    
    return Array.from(fileMap.values())
      .sort((a, b) => b.commits - a.commits)
      .slice(0, 10);
  }

  calculateVelocityTrend(trends) {
    const windows = Object.keys(trends).sort();
    if (windows.length < 2) return { trend: 'insufficient_data' };
    
    const recent = trends[windows[0]];
    const older = trends[windows[windows.length - 1]];
    
    const commitTrend = recent.commits > older.commits * 1.1 ? 'increasing' :
                       recent.commits < older.commits * 0.9 ? 'decreasing' : 'stable';
    
    return {
      trend: commitTrend,
      recentCommits: recent.commits,
      pastCommits: older.commits,
      changePercent: ((recent.commits - older.commits) / older.commits * 100).toFixed(1)
    };
  }

  calculateTeamGrowthTrend(trends) {
    const windows = Object.keys(trends).sort();
    if (windows.length < 2) return { trend: 'insufficient_data' };
    
    const recent = trends[windows[0]];
    const older = trends[windows[windows.length - 1]];
    
    const growthTrend = recent.contributors > older.contributors * 1.1 ? 'growing' :
                       recent.contributors < older.contributors * 0.9 ? 'shrinking' : 'stable';
    
    return {
      trend: growthTrend,
      recentContributors: recent.contributors,
      pastContributors: older.contributors,
      changePercent: older.contributors > 0 ? 
        ((recent.contributors - older.contributors) / older.contributors * 100).toFixed(1) : '0'
    };
  }

  calculateCodebaseGrowthTrend(trends) {
    const windows = Object.keys(trends).sort();
    if (windows.length < 2) return { trend: 'insufficient_data' };
    
    const recent = trends[windows[0]];
    const older = trends[windows[windows.length - 1]];
    
    const growthTrend = recent.avgCommitSize > older.avgCommitSize * 1.1 ? 'expanding' :
                       recent.avgCommitSize < older.avgCommitSize * 0.9 ? 'contracting' : 'stable';
    
    return {
      trend: growthTrend,
      recentAvgSize: recent.avgCommitSize,
      pastAvgSize: older.avgCommitSize,
      changePercent: older.avgCommitSize > 0 ? 
        ((recent.avgCommitSize - older.avgCommitSize) / older.avgCommitSize * 100).toFixed(1) : '0'
    };
  }
}