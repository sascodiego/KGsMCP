import { parse } from '@babel/parser';
import traverse from '@babel/traverse';
import fs from 'fs/promises';
import path from 'path';
import { logger } from '../utils/logger.js';

export class ContextHandler {
  constructor(server) {
    this.server = server;
    this.kuzu = server.kuzu;
  }

  async queryContextForTask(args) {
    const { taskDescription, entityTypes = [], depth = 2 } = args;
    
    try {
      // Build query to find relevant context
      const query = `
        // Find patterns relevant to the task
        MATCH (p:Pattern)
        WHERE toLower(p.name) CONTAINS toLower($keyword)
           OR toLower(p.description) CONTAINS toLower($keyword)
        WITH p LIMIT 5
        
        // Find related code entities
        OPTIONAL MATCH (e:CodeEntity)-[:IMPLEMENTS]->(p)
        WITH p, collect(DISTINCT e) as relatedEntities
        
        // Find business rules
        OPTIONAL MATCH (r:Rule)
        WHERE toLower(r.description) CONTAINS toLower($keyword)
        WITH p, relatedEntities, collect(DISTINCT r) as rules
        
        // Find coding standards
        OPTIONAL MATCH (s:Standard)
        WITH p, relatedEntities, rules, collect(DISTINCT s) as standards
        
        RETURN {
          patterns: collect(DISTINCT p.name),
          relatedCode: [e IN relatedEntities | {name: e.name, path: e.filePath}],
          rules: [r IN rules | r.description],
          standards: [s IN standards | {name: s.name, value: s.value}]
        } as context
      `;
      
      // Extract keywords from task description
      const keyword = taskDescription.split(' ')[0];
      
      const result = await this.kuzu.query(query, { keyword, depth });
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              taskDescription,
              context: result[0]?.context || {
                patterns: [],
                relatedCode: [],
                rules: [],
                standards: []
              },
              relevanceScore: 0.85
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error querying context:', error);
      throw error;
    }
  }

  async extractFromCode(args) {
    const { filePath, codeSnippet } = args;
    
    try {
      // Read file if no snippet provided
      const code = codeSnippet || await fs.readFile(filePath, 'utf-8');
      
      // Extract structured comments
      const structuredComments = this.extractStructuredComments(code);
      
      // Parse code AST
      const ast = parse(code, {
        sourceType: 'module',
        plugins: ['jsx', 'typescript', 'decorators-legacy']
      });
      
      const entities = [];
      const relationships = [];
      
      // Traverse AST to extract entities
      traverse.default(ast, {
        ClassDeclaration(path) {
          const entity = {
            type: 'class',
            name: path.node.id.name,
            lineStart: path.node.loc.start.line,
            lineEnd: path.node.loc.end.line,
            filePath,
            structuredComment: structuredComments.find(
              c => c.line < path.node.loc.start.line
            )
          };
          entities.push(entity);
        },
        
        FunctionDeclaration(path) {
          const entity = {
            type: 'function',
            name: path.node.id.name,
            lineStart: path.node.loc.start.line,
            lineEnd: path.node.loc.end.line,
            filePath,
            structuredComment: structuredComments.find(
              c => c.line < path.node.loc.start.line
            )
          };
          entities.push(entity);
        }
      });
      
      // Store entities in Kuzu
      for (const entity of entities) {
        const nodeProps = {
          id: `${filePath}:${entity.name}`,
          type: entity.type,
          name: entity.name,
          filePath: entity.filePath,
          lineStart: entity.lineStart,
          lineEnd: entity.lineEnd,
          ...this.parseStructuredComment(entity.structuredComment)
        };
        
        await this.kuzu.createNode('CodeEntity', nodeProps);
      }
      
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              extracted: {
                entities: entities.length,
                structuredComments: structuredComments.length,
                filePath
              }
            }, null, 2)
          }
        ]
      };
    } catch (error) {
      logger.error('Error extracting context:', error);
      throw error;
    }
  }

  extractStructuredComments(code) {
    const comments = [];
    const lines = code.split('\n');
    
    const commentPattern = /\/\*\*[\s\S]*?\*\//g;
    const matches = code.matchAll(commentPattern);
    
    for (const match of matches) {
      const comment = match[0];
      const lineNumber = code.substring(0, match.index).split('\n').length;
      
      const parsed = this.parseStructuredComment(comment);
      if (parsed) {
        comments.push({
          line: lineNumber,
          ...parsed
        });
      }
    }
    
    return comments;
  }

  parseStructuredComment(comment) {
    if (!comment) return null;
    
    const structured = {};
    const patterns = {
      agent: /\*\s*AGENT:\s*(.+)/,
      trace: /\*\s*TRACE:\s*(.+)/,
      context: /\*\s*CONTEXT:\s*(.+)/,
      reason: /\*\s*REASON:\s*(.+)/,
      change: /\*\s*CHANGE:\s*(.+)/,
      prevention: /\*\s*PREVENTION:\s*(.+)/,
      risk: /\*\s*RISK:\s*(.+)/
    };
    
    for (const [key, pattern] of Object.entries(patterns)) {
      const match = comment.match(pattern);
      if (match) {
        structured[key] = match[1].trim();
      }
    }
    
    return Object.keys(structured).length > 0 ? structured : null;
  }
}