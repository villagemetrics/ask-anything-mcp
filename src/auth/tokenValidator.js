import axios from 'axios';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('TokenValidator');

export class TokenValidator {
  constructor() {
    this.apiBaseUrl = process.env.VM_API_BASE_URL || 'https://api.villagemetrics.com';
  }

  async validateToken(token) {
    if (!token) {
      throw new Error('No token provided');
    }

    // Basic MCP token format check - API will validate if token actually exists
    if (!token.startsWith('vm_mcp_')) {
      throw new Error('Invalid MCP token format. Token must start with vm_mcp_. Generate a new token in Settings → Connect AI Tools');
    }
    
    // Simple length check to catch obvious issues
    if (token.length < 20) {
      throw new Error('MCP token appears too short. Generate a new token in Settings → Connect AI Tools');
    }

    try {
      logger.debug('Validating MCP token', { tokenPrefix: token.substring(0, 10) + '...' });

      // Simple approach: make any authenticated API call to test the token
      // If it succeeds, the token is valid. If it fails, the token is invalid.
      const response = await axios.get(`${this.apiBaseUrl}/v1/profile/me`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        timeout: 10000 // 10 second timeout
      });

      // If we get here, the token is valid and we have user context
      if (response.status === 200 && response.data.userId) {
        logger.debug('MCP token validated successfully');
        return {
          userId: response.data.userId,
          email: response.data.email, // Note: email not logged, only returned for internal use
          permissions: ['read'], // MCP tokens are read-only
          hasWritePermission: false
        };
      } else {
        throw new Error('Unable to get user context from validated token');
      }
    } catch (error) {
      if (error.response) {
        const status = error.response.status;
        const message = error.response.data?.error || 'Unknown API error';
        
        if (status === 401) {
          logger.error('MCP token validation failed - unauthorized', { error: message });
          throw new Error('Invalid or expired MCP token. Go to Settings → Connect AI Tools to generate a new token');
        } else if (status === 404) {
          logger.error('MCP token validation failed - not found', { error: message });
          throw new Error('MCP token not found or revoked. Go to Settings → Connect AI Tools to generate a new token');
        } else {
          logger.error('MCP token validation failed - API error', { status, error: message });
          throw new Error(`Token validation failed: ${message}. Go to Settings → Connect AI Tools to check your token`);
        }
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ETIMEDOUT') {
        logger.error('MCP token validation failed - connection error', { error: error.message });
        throw new Error('Unable to connect to Village Metrics API for token validation. Check your network connection');
      } else {
        logger.error('MCP token validation failed', { error: error.message });
        throw new Error(`Token validation failed: ${error.message}. Go to Settings → Connect AI Tools to check your token`);
      }
    }
  }
}
