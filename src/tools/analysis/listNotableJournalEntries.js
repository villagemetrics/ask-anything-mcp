import { createLogger } from '../../utils/logger.js';
import { VMApiClient } from '../../clients/vmApiClient.js';
import { transformJournalAnalysis } from '../../transformers/analysisData.js';

const logger = createLogger('ListNotableJournalEntriesTool');

export class ListNotableJournalEntriesTool {
  constructor(sessionManager, apiOptions = {}) {
    this.sessionManager = sessionManager;
    this.apiClient = new VMApiClient(apiOptions);
  }

  static get definition() {
    return {
      name: 'list_notable_journal_entries',
      description: `List journal entries that stand out as particularly noteworthy based on algorithmic scoring. Returns a curated list of entries that scored highly (0.7+) in special categories like key moments, heartfelt stories, funny moments, effective strategies, turnarounds, and more. Also provides journal statistics for the time period.

Best for answering:
- "What were the most important moments recently?"
- "Show me heartfelt or touching stories"
- "What funny things happened lately?" 
- "List entries showing effective strategies working"
- "What key breakthroughs or turnarounds occurred?"
- "Show me the most significant events in this period"
- "What notable successes should we celebrate?"
- "List entries that stand out from the routine"`,
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
      
      logger.debug('Notable journal entries retrieved', { 
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
          message: `No notable journal entries found for ${childName} in the ${timeRange} period. Journal entries may not exist yet or none may have scored highly in special categories.`,
          hasData: false
        };
      }
      
      logger.error('Failed to find notable journal entries', { error: error.message, timeRange });
      throw new Error(`Failed to find notable journal entries: ${error.message}`);
    }
  }
}