import { createLogger } from '../utils/logger.js';
import { ToolRegistry } from '../tools/registry.js';
import { SessionManager } from '../session/sessionManager.js';
import { TokenValidator } from '../auth/tokenValidator.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const logger = createLogger('MCPCore');

/**
 * Core MCP functionality that can be used as a library
 * Independent of the MCP server transport layer
 */
export class MCPCore {
  constructor(options = {}) {
    this.options = {
      // Default configuration
      loggerName: 'MCPCore',
      enableTokenValidation: true,
      bypassApiValidation: false, // Allow bypassing API token requirements for internal usage
      schemaOnly: false, // Only provide tool schemas without initializing tool instances
      ...options
    };
    
    this.sessionId = null;
    this.userContext = null;
    
    if (this.options.schemaOnly) {
      // Schema-only mode: just provide tool definitions without VM API client dependencies
      this.toolRegistry = null; // No tool instances
      this.tokenValidator = null;
      this.sessionManager = null;
      logger.info('MCP Core initialized in schema-only mode (no token required)', this.options);
    } else {
      // Full mode: initialize everything
      this.tokenValidator = new TokenValidator();
      this.sessionManager = new SessionManager();
      
      // For internal usage, ensure VM_MCP_TOKEN is available
      // The token should come from environment (e.g., .env.secrets.local)
      if (this.options.bypassApiValidation && !process.env.VM_MCP_TOKEN) {
        logger.warn('VM_MCP_TOKEN not found in environment. API calls will fail with 401.');
      }
      
      this.toolRegistry = new ToolRegistry(this.sessionManager, this.tokenValidator);
      logger.info('MCP Core initialized in full mode', this.options);
    }
  }

  /**
   * Initialize with token validation (for external usage)
   * @param {string} token - MCP token
   * @returns {Promise<Object>} User context and session ID
   */
  async initializeWithToken(token) {
    if (!token) {
      throw new Error('Token is required for MCP Core initialization');
    }

    try {
      this.userContext = await this.tokenValidator.validateToken(token);
      this.sessionId = this.sessionManager.createSession(this.userContext.userId);
      
      logger.info('MCP Core initialized with token', { 
        userId: this.userContext.userId, 
        sessionId: this.sessionId 
      });
      
      return { userContext: this.userContext, sessionId: this.sessionId };
    } catch (error) {
      logger.error('Token validation failed', { error: error.message });
      throw new Error(`Invalid token: ${error.message}`);
    }
  }

  /**
   * Initialize with existing user context (for internal usage)
   * @param {Object} userContext - Pre-validated user context
   * @returns {string} Session ID
   */
  initializeWithUserContext(userContext) {
    if (!userContext || !userContext.userId) {
      throw new Error('Valid user context with userId is required');
    }

    this.userContext = userContext;
    this.sessionId = this.sessionManager.createSession(this.userContext.userId);
    
    logger.info('MCP Core initialized with user context', { 
      userId: this.userContext.userId, 
      sessionId: this.sessionId 
    });
    
    return this.sessionId;
  }

  /**
   * Get available tool definitions
   * @returns {Promise<Array>|Array} Array of tool definitions (Promise in schema-only mode)
   */
  getAvailableTools() {
    if (this.options.schemaOnly) {
      // Return promise for static tool definitions without initializing tool instances
      return this.getStaticToolDefinitions();
    }
    return this.toolRegistry.getToolDefinitions();
  }

  /**
   * Get static tool definitions for schema-only mode
   * Auto-discover all tool classes in the tools directory
   * @returns {Promise<Array>} Array of static tool definitions
   */
  async getStaticToolDefinitions() {
    const toolsDir = path.join(__dirname, '../tools');
    const toolDefinitions = [];
    
    // Recursively find all .js files in the tools directory
    const findToolFiles = (dir) => {
      const files = [];
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          files.push(...findToolFiles(fullPath));
        } else if (entry.isFile() && entry.name.endsWith('.js') && entry.name !== 'registry.js') {
          files.push(fullPath);
        }
      }
      
      return files;
    };
    
    const toolFiles = findToolFiles(toolsDir);
    
    // Dynamically import each tool file and extract its definition
    for (const toolFile of toolFiles) {
      try {
        const relativePath = path.relative(__dirname, toolFile);
        const importPath = './' + relativePath.replace(/\\/g, '/'); // Normalize path separators
        
        const module = await import(importPath);
        
        // Find the tool class (look for exports that have a definition property)
        for (const exportName of Object.keys(module)) {
          const exportedClass = module[exportName];
          if (exportedClass && exportedClass.definition) {
            const definition = exportedClass.definition;
            toolDefinitions.push({
              name: definition.name,
              description: definition.description,
              inputSchema: definition.inputSchema
            });
            break; // Only take the first tool class per file
          }
        }
      } catch (error) {
        // Log warning but don't fail - some files might not be tool classes
        logger.warn(`Failed to import tool from ${toolFile}`, { error: error.message });
      }
    }
    
    logger.info(`Auto-discovered ${toolDefinitions.length} tool definitions`);
    return toolDefinitions;
  }

  /**
   * Execute a tool
   * @param {string} toolName - Name of the tool to execute
   * @param {Object} args - Arguments for the tool
   * @returns {Promise<any>} Tool execution result
   */
  async executeTool(toolName, args = {}) {
    if (this.options.schemaOnly) {
      throw new Error(`Cannot execute tools in schema-only mode. Tool '${toolName}' requires full MCP Core initialization.`);
    }

    if (!this.sessionId) {
      throw new Error('MCP Core not initialized. Call initializeWithToken() or initializeWithUserContext() first.');
    }

    logger.debug('Executing tool', { tool: toolName, args, sessionId: this.sessionId });

    try {
      const result = await this.toolRegistry.executeTool(toolName, args, this.sessionId);
      logger.debug('Tool executed successfully', { tool: toolName });
      return result;
    } catch (error) {
      logger.error('Tool execution failed', { 
        tool: toolName, 
        error: error.message,
        args 
      });
      throw error;
    }
  }

  /**
   * Execute multiple tools in sequence
   * @param {Array} toolCalls - Array of {name, arguments} objects
   * @returns {Promise<Array>} Array of results
   */
  async executeTools(toolCalls) {
    if (this.options.schemaOnly) {
      throw new Error('Cannot execute tools in schema-only mode. Tools require full MCP Core initialization.');
    }

    if (!Array.isArray(toolCalls)) {
      throw new Error('toolCalls must be an array');
    }

    const results = [];
    for (const toolCall of toolCalls) {
      try {
        const result = await this.executeTool(toolCall.name, toolCall.arguments);
        results.push({
          toolName: toolCall.name,
          success: true,
          result
        });
      } catch (error) {
        results.push({
          toolName: toolCall.name,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  /**
   * Get session information
   * @returns {Object} Session details
   */
  getSession() {
    if (!this.sessionId) {
      throw new Error('MCP Core not initialized');
    }
    
    return this.sessionManager.getSession(this.sessionId);
  }

  /**
   * Update session data
   * @param {Object} updates - Updates to apply to session
   * @returns {Object} Updated session
   */
  updateSession(updates) {
    if (!this.sessionId) {
      throw new Error('MCP Core not initialized');
    }
    
    return this.sessionManager.updateSession(this.sessionId, updates);
  }

  /**
   * Set selected child for the session
   * @param {string} childId - Child ID
   * @param {string} childName - Child name
   * @returns {Object} Updated session
   */
  setSelectedChild(childId, childName) {
    if (!this.sessionId) {
      throw new Error('MCP Core not initialized');
    }
    
    return this.sessionManager.setSelectedChild(this.sessionId, childId, childName);
  }

  /**
   * Get selected child for the session
   * @returns {Object} Selected child info
   */
  getSelectedChild() {
    if (!this.sessionId) {
      throw new Error('MCP Core not initialized');
    }
    
    return this.sessionManager.getSelectedChild(this.sessionId);
  }

  /**
   * Clean up session data
   */
  cleanup() {
    if (this.sessionId) {
      // Remove this specific session
      this.sessionManager.sessions.delete(this.sessionId);
      logger.info('Session cleaned up', { sessionId: this.sessionId });
    }
    
    this.sessionId = null;
    this.userContext = null;
  }
}