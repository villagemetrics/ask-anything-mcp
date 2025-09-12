import { createLogger } from '../../utils/logger.js';
import { VMApiClient } from '../../clients/vmApiClient.js';
import { transformJournalAnalysis } from '../../transformers/analysisData.js';

const logger = createLogger('GetJournalAnalysisTool');

export class GetJournalAnalysisTool {
  constructor(sessionManager, apiOptions = {}) {
    this.sessionManager = sessionManager;
    this.apiClient = new VMApiClient(apiOptions);
  }

  static get definition() {
    return {
      name: 'get_journal_analysis',
      description: `Get qualitative insights from journal entries including key moments, significant events, behavioral milestones, and journal statistics for the selected child. Focuses on narrative insights and important events rather than hashtag effectiveness.
      
Best for answering:
- "What significant events happened recently?"
- "What were the most challenging days?"
- "What key moments show progress or setbacks?"
- "What detailed context explains behavior changes?"
- "What themes emerge from journal entries?"
- "Which events had the biggest behavioral impact?"
- "What successes should we build on?"
- "What challenges are caregivers facing?"`,
      inputSchema: {
        type: 'object',
        properties: {
          timeRange: {
            type: 'string',
            description: 'Analysis time period',
            enum: ['last_7_days', 'last_30_days', 'last_90_days', 'last_180_days', 'last_365_days']
          }
        },
        required: ['timeRange']
      }
    };
  }

  async execute(args, session) {
    const { timeRange } = args;
    
    if (!timeRange) {
      throw new Error('Time range is required');
    }

    const validTimeRanges = ['last_7_days', 'last_30_days', 'last_90_days', 'last_180_days', 'last_365_days'];
    if (!validTimeRanges.includes(timeRange)) {
      throw new Error(`Invalid time range. Must be one of: ${validTimeRanges.join(', ')}`);
    }

    // Ensure child is selected (stateful - childId comes from session)
    const { childId, childName } = this.sessionManager.getSelectedChild(session.sessionId);
    
    try {
      // Get journal analysis data from API
      const rawData = await this.apiClient.getAnalysisData(childId, timeRange, 'journal');
      
      // Transform to LLM-friendly format (extracts only journal-related data)
      const transformed = transformJournalAnalysis(rawData, childName, timeRange);
      
      logger.debug('Journal analysis retrieved', { 
        childId, 
        timeRange, 
        hasData: transformed.hasData,
        keyMomentCount: rawData?.keyMoments?.length || 0,
        compressionRatio: transformed.compressionInfo?.compressionRatio
      });
      
      return transformed;
    } catch (error) {
      if (error.response?.status === 403) {
        return {
          timeRange,
          childName,
          message: `Access denied: You don't have permission to view journal entries for ${childName}. This requires journal viewing permissions. Contact a parent or guardian to request access.`,
          hasData: false,
          permissionError: true
        };
      }
      
      if (error.response?.status === 404) {
        return {
          timeRange,
          childName,
          message: `No journal analysis data found for ${childName} in the ${timeRange} period. Journal entries may not exist yet or analysis may not be available.`,
          hasData: false
        };
      }
      
      logger.error('Failed to get journal analysis', { error: error.message, timeRange });
      throw new Error(`Failed to get journal analysis: ${error.message}`);
    }
  }
}