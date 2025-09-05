import { createLogger } from '../../utils/logger.js';
import { VMApiClient } from '../../clients/vmApiClient.js';

const logger = createLogger('SelectChildTool');

export class SelectChildTool {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    this.apiClient = new VMApiClient();
  }

  static get definition() {
    return {
      name: 'select_child',
      description: 'Select a child to work with by name. This sets the active child for all subsequent tool calls in this session.',
      inputSchema: {
        type: 'object',
        properties: {
          childName: {
            type: 'string',
            description: 'Name of the child (full name, preferred name, or nickname)'
          }
        },
        required: ['childName']
      }
    };
  }

  async execute(args, session) {
    const { childName } = args;
    
    if (!childName) {
      throw new Error('Child name is required');
    }

    // Get cached children or fetch
    let children = session.childrenCache;
    if (!children) {
      children = await this.apiClient.getChildren(session.userId);
      this.sessionManager.updateSession(session.sessionId, {
        childrenCache: children
      });
    }

    // Find matching child (case-insensitive)
    const searchName = childName.toLowerCase();
    const child = children.find(c => {
      if (c.fullName?.toLowerCase() === searchName) return true;
      if (c.preferredName?.toLowerCase() === searchName) return true;
      if (c.nicknames?.some(n => n.toLowerCase() === searchName)) return true;
      // Also check if the search name is contained in any name
      if (c.fullName?.toLowerCase().includes(searchName)) return true;
      if (c.preferredName?.toLowerCase().includes(searchName)) return true;
      return false;
    });

    if (!child) {
      const availableNames = children.map(c => c.preferredName || c.fullName).join(', ');
      throw new Error(`Child "${childName}" not found. Available children: ${availableNames}`);
    }

    // Set selected child in session state - use full name for consistency
    this.sessionManager.setSelectedChild(session.sessionId, child.childId, child.fullName);
    
    logger.info('Child selected', { 
      childId: child.childId, 
      childName: child.fullName 
    });

    return `Selected child: ${child.fullName} (${child.preferredName}). You can now ask questions about this child's behavior, journal entries, medications, and more.`;
  }
}
