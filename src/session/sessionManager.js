import { createLogger } from '../utils/logger.js';

const logger = createLogger('SessionManager');

export class SessionManager {
  constructor() {
    this.sessions = new Map();
  }

  createSession(userId) {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const session = {
      sessionId,
      userId,
      selectedChildId: null,
      selectedChildName: null,
      childrenCache: null,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString()
    };

    this.sessions.set(sessionId, session);
    logger.info('Session created', { sessionId, userId });
    
    return sessionId;
  }

  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }
    
    // Update last activity
    session.lastActivity = new Date().toISOString();
    return session;
  }

  updateSession(sessionId, updates) {
    const session = this.getSession(sessionId);
    Object.assign(session, updates, {
      lastActivity: new Date().toISOString()
    });
    
    // Log session update but exclude PHI from updates object
    const safeUpdates = { ...updates };
    if (safeUpdates.selectedChildName) {
      safeUpdates.selectedChildName = '[CHILD_NAME_REDACTED]';
    }
    if (safeUpdates.childrenCache) {
      safeUpdates.childrenCache = `[${safeUpdates.childrenCache.length} children cached]`;
    }
    logger.debug('Session updated', { sessionId, updates: safeUpdates });
    return session;
  }

  setSelectedChild(sessionId, childId, childName) {
    return this.updateSession(sessionId, {
      selectedChildId: childId,
      selectedChildName: childName
    });
  }

  getSelectedChild(sessionId) {
    const session = this.getSession(sessionId);
    if (!session.selectedChildId) {
      throw new Error('No child selected. Please use the "select_child" tool first.');
    }
    return {
      childId: session.selectedChildId,
      childName: session.selectedChildName
    };
  }

  cleanupOldSessions() {
    const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
    
    for (const [sessionId, session] of this.sessions.entries()) {
      const lastActivity = new Date(session.lastActivity).getTime();
      if (lastActivity < oneDayAgo) {
        this.sessions.delete(sessionId);
        logger.info('Session cleaned up', { sessionId });
      }
    }
  }
}
