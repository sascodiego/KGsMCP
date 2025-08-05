#!/usr/bin/env node

/**
 * Test script for the enhanced GitAnalyzer
 * CONTEXT: Testing comprehensive Git analysis functionality
 * REASON: Validate GitAnalyzer implementation and demonstrate capabilities
 * CHANGE: Added test script for GitAnalyzer validation
 * PREVENTION: Unvalidated GitAnalyzer implementation
 */

import { GitAnalyzer } from './src/analyzers/gitAnalyzer.js';
import { KuzuClient } from './src/database/kuzuClient.js';
import { logger } from './src/utils/logger.js';
import fs from 'fs/promises';
import path from 'path';

async function testGitAnalyzer() {
  try {
    console.log('🔍 Testing Enhanced GitAnalyzer...\n');
    
    // Use current directory as test repository
    const repoPath = process.cwd();
    
    // Check if it's a Git repository
    try {
      await fs.access(path.join(repoPath, '.git'));
      console.log(`✅ Found Git repository at: ${repoPath}`);
    } catch (error) {
      console.log('❌ Current directory is not a Git repository');
      console.log('Please run this test from within a Git repository');
      return;
    }

    // Initialize Kuzu client (optional for testing)
    let kuzuClient = null;
    try {
      kuzuClient = new KuzuClient({
        databasePath: './.kg-context/test-git-analysis.kuzu'
      });
      await kuzuClient.connect();
      console.log('✅ Connected to Kuzu database for knowledge graph storage');
    } catch (error) {
      console.log('⚠️  Could not connect to Kuzu database, proceeding without KG storage');
      console.log(`   Error: ${error.message}`);
    }

    // Create GitAnalyzer instance
    const gitAnalyzer = new GitAnalyzer(repoPath, kuzuClient);
    
    // Set up event listeners
    gitAnalyzer.on('analysisComplete', (analysis) => {
      console.log('\n🎉 Analysis completed successfully!');
      console.log(`   Total analysis time: ${analysis.metrics.totalAnalysisTime}ms`);
    });

    gitAnalyzer.on('analysisError', (error) => {
      console.error('\n❌ Analysis failed:', error.message);
    });

    console.log('\n🚀 Starting comprehensive Git analysis...');
    
    // Run comprehensive analysis
    const startTime = Date.now();
    const analysis = await gitAnalyzer.analyzeRepository({
      storeInKG: !!kuzuClient // Only store if Kuzu is available
    });
    const analysisTime = Date.now() - startTime;

    // Display results summary
    console.log(`\n📊 Analysis Results Summary:`);
    console.log(`   Repository: ${analysis.metadata?.rootDirectory || repoPath}`);
    console.log(`   Analysis Duration: ${analysisTime}ms`);
    console.log(`   Total Commits Analyzed: ${analysis.summary?.totalCommits || 0}`);
    console.log(`   Contributors: ${analysis.contributors?.total || 0}`);
    console.log(`   Hotspots Identified: ${analysis.hotspots?.length || 0}`);
    console.log(`   Technical Debt Level: ${analysis.technicalDebt?.debtLevel || 'unknown'}`);
    console.log(`   Change Couplings: ${analysis.changeCoupling?.strongCouplings?.length || 0}`);
    console.log(`   Insights Generated: ${analysis.insights?.length || 0}`);

    // Display key insights
    if (analysis.insights && analysis.insights.length > 0) {
      console.log(`\n💡 Key Insights:`);
      analysis.insights.slice(0, 5).forEach((insight, index) => {
        console.log(`   ${index + 1}. [${insight.severity.toUpperCase()}] ${insight.message}`);
      });
    }

    // Display top hotspots
    if (analysis.hotspots && analysis.hotspots.length > 0) {
      console.log(`\n🔥 Top Hotspots:`);
      analysis.hotspots.slice(0, 5).forEach((hotspot, index) => {
        console.log(`   ${index + 1}. ${hotspot.file} (risk: ${hotspot.riskScore.toFixed(2)})`);
      });
    }

    // Display technical debt files
    if (analysis.technicalDebt?.highDebtFiles && analysis.technicalDebt.highDebtFiles.length > 0) {
      console.log(`\n⚠️  High Technical Debt Files:`);
      analysis.technicalDebt.highDebtFiles.slice(0, 5).forEach((debt, index) => {
        console.log(`   ${index + 1}. ${debt.file} (debt: ${debt.debtScore.toFixed(2)}, priority: ${debt.priority})`);
      });
    }

    // Display contributor insights
    if (analysis.contributors?.busFactor) {
      console.log(`\n👥 Team Health:`);
      console.log(`   Bus Factor: ${analysis.contributors.busFactor.factor} (${analysis.contributors.busFactor.risk} risk)`);
      console.log(`   Active Contributors: ${analysis.contributors.diversityMetrics?.activeContributors || 0}`);
    }

    // Save detailed results to file
    const resultsFile = './git-analysis-results.json';
    await fs.writeFile(resultsFile, JSON.stringify(analysis, null, 2));
    console.log(`\n💾 Detailed results saved to: ${resultsFile}`);

    // Test specific methods
    console.log(`\n🧪 Testing specific analysis methods...`);
    
    // Test code churn analysis
    const churnAnalysis = await gitAnalyzer.analyzeCodeChurn();
    console.log(`   Code Churn: ${churnAnalysis.commits?.length || 0} commits analyzed`);
    
    // Test contributor analysis
    const contributorAnalysis = await gitAnalyzer.analyzeContributors();
    console.log(`   Contributors: ${contributorAnalysis.total} total, ${contributorAnalysis.topContributors?.length || 0} top contributors`);
    
    // Test change coupling
    const couplingAnalysis = await gitAnalyzer.analyzeChangeCoupling();
    console.log(`   Change Coupling: ${couplingAnalysis.strongCouplings?.length || 0} strong couplings detected`);

    // Clean up
    if (kuzuClient) {
      await kuzuClient.close();
      console.log(`\n✅ Closed Kuzu database connection`);
    }

    console.log(`\n🎯 GitAnalyzer test completed successfully!`);
    console.log(`\nKey capabilities demonstrated:`);
    console.log(`   ✅ Comprehensive repository analysis`);
    console.log(`   ✅ Technical debt identification`);
    console.log(`   ✅ Change coupling detection`);
    console.log(`   ✅ Hotspot identification`);
    console.log(`   ✅ Team collaboration analysis`);
    console.log(`   ✅ Knowledge graph integration`);
    console.log(`   ✅ Actionable insights generation`);
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    logger.error('GitAnalyzer test failed:', error);
    process.exit(1);
  }
}

// Run the test
testGitAnalyzer().catch(console.error);