import { createLogger } from '../../utils/logger.js';
import { VMApiClient } from '../../clients/vmApiClient.js';

const logger = createLogger('ListChildrenTool');

export class ListChildrenTool {
  constructor(sessionManager, apiOptions = {}) {
    this.sessionManager = sessionManager;
    this.apiClient = new VMApiClient(apiOptions);
  }

  static get definition() {
    return {
      name: 'list_children',
      description: 'List all children you have access to, showing names and relationship type (parent vs caregiver). Returns structured JSON for child selection.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }

  async execute(args, session) {
    try {
      // Get children from API
      const children = await this.apiClient.getChildren(session.userId);
      
      // Cache in session
      this.sessionManager.updateSession(session.sessionId, {
        childrenCache: children
      });

      // Return JSON format for better AI agent processing
      if (!children || children.length === 0) {
        return {
          totalCount: 0,
          children: [],
          message: 'You do not have access to any children.'
        };
      }

      // Return only data needed for child selection - keep it focused
      const structuredChildren = children.map(child => ({
        childId: child.childId,
        fullName: child.fullName,
        preferredName: child.preferredName,
        nicknames: child.nicknames || [],
        relationship: child.relationship // 'parent' or 'caregiver'
        // Removed: conditions, permissions, caregiverType 
        // These can be separate tools if needed (get_child_details, get_permissions, etc.)
      }));

      return {
        totalCount: children.length,
        parentCount: children.filter(c => c.relationship === 'parent').length,
        caregiverCount: children.filter(c => c.relationship === 'caregiver').length,
        children: structuredChildren,
        message: `You have access to ${children.length} ${children.length === 1 ? 'child' : 'children'}. Use select_child with any name to continue.`
      };
    } catch (error) {
      logger.error('Failed to list children', { error: error.message });
      throw new Error(`Failed to list children: ${error.message}`);
    }
  }
}
