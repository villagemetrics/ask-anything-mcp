import { createLogger } from '../utils/logger.js';
import { ToolRegistry } from '../tools/registry.js';
import { SessionManager } from '../session/sessionManager.js';
import { TokenValidator } from '../auth/tokenValidator.js';

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
      ...options
    };
    
    this.tokenValidator = new TokenValidator();
    this.sessionManager = new SessionManager();
    
    // For internal usage, we can bypass API validation
    if (this.options.bypassApiValidation) {
      // Set a dummy token to bypass VMApiClient validation
      process.env.VM_MCP_TOKEN = process.env.VM_MCP_TOKEN || 'internal-bypass-token';
    }
    
    this.toolRegistry = new ToolRegistry(this.sessionManager, this.tokenValidator);
    this.sessionId = null;
    this.userContext = null;
    
    logger.info('MCP Core initialized', this.options);
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
   * @returns {Array} Array of tool definitions
   */
  getAvailableTools() {
    return this.toolRegistry.getToolDefinitions();
  }

  /**
   * Execute a tool
   * @param {string} toolName - Name of the tool to execute
   * @param {Object} args - Arguments for the tool
   * @returns {Promise<any>} Tool execution result
   */
  async executeTool(toolName, args = {}) {
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