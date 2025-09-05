import jwt from 'jsonwebtoken';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('TokenValidator');

export class TokenValidator {
  constructor() {
    // In production, you'd fetch the public key from your API
    // For now, we'll validate by calling the API with the token
    this.apiBaseUrl = process.env.VM_API_BASE_URL || 'https://api-dev.villagemetrics.com';
  }

  async validateToken(token) {
    if (!token) {
      throw new Error('No token provided');
    }

    try {
      // For now, decode without verification
      // In production, verify with public key
      const decoded = jwt.decode(token);
      
      if (!decoded) {
        throw new Error('Invalid token format');
      }

      // Check expiration
      if (decoded.exp && decoded.exp < Date.now() / 1000) {
        throw new Error('Token expired');
      }

      logger.debug('Token decoded', {
        userId: decoded.sub || decoded.userId,
        exp: decoded.exp ? new Date(decoded.exp * 1000).toISOString() : 'none'
      });

      return {
        userId: decoded.sub || decoded.userId,
        permissions: decoded.permissions || ['read'], // Default to read-only
        email: decoded.email,
        hasWritePermission: (decoded.permissions || ['read']).includes('write')
      };
    } catch (error) {
      logger.error('Token validation failed', { error: error.message });
      throw new Error(`Token validation failed: ${error.message}`);
    }
  }
}
