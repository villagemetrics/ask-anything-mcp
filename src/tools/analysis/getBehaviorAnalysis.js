import { createLogger } from '../../utils/logger.js';
import { VMApiClient } from '../../clients/vmApiClient.js';
import { transformBehaviorAnalysis } from '../../transformers/analysisData.js';

const logger = createLogger('GetBehaviorAnalysisTool');

export class GetBehaviorAnalysisTool {
  constructor(sessionManager, apiOptions = {}) {
    this.sessionManager = sessionManager;
    this.apiClient = new VMApiClient(apiOptions);
  }

  static get definition() {
    return {
      name: 'get_behavior_analysis',
      description: `Get detailed behavior goals progress analysis including individual goal consistency, achievement patterns, statistical correlations, and goal-specific insights for the selected child. Analyzes behavior scores (1-4 scale) to show performance trends. Includes both the configured behavior goals and their performance analysis.
      
Best for answering:
- "Which behavior goals is the child meeting most consistently?"
- "What strategies work best for specific goals?"
- "Which goals show the most improvement?"
- "Which goals are declining and need focus?"
- "How is progress on individual behavior goals?"
- "What's the achievement rate for different goals?"
- "Which goals have statistical significance in their trends?"`,
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
      // Get both analysis data and raw goals data
      const [rawAnalysisData, rawGoalsData] = await Promise.all([
        this.apiClient.getAnalysisData(childId, timeRange, 'behaviorGoals'),
        this.apiClient.getBehaviorGoals(childId)
      ]);
      
      // Transform to LLM-friendly format
      const transformed = transformBehaviorAnalysis(rawAnalysisData, rawGoalsData, childName, timeRange);
      
      logger.debug('Behavior analysis retrieved', { 
        childId, 
        timeRange, 
        hasData: transformed.hasData,
        goalCount: rawGoalsData?.length || 0,
        compressionRatio: transformed.compressionInfo?.compressionRatio
      });
      
      return transformed;
    } catch (error) {
      if (error.response?.status === 403) {
        return {
          timeRange,
          childName,
          message: `Access denied: You don't have permission to view behavior data for ${childName}. Contact a parent or guardian to request access.`,
          hasData: false,
          permissionError: true
        };
      }
      
      if (error.response?.status === 404) {
        return {
          timeRange,
          childName,
          message: `No behavior goals or analysis data found for ${childName} in the ${timeRange} period. Behavior goals may not be configured yet or analysis may not be available.`,
          hasData: false
        };
      }
      
      logger.error('Failed to get behavior analysis', { error: error.message, timeRange });
      throw new Error(`Failed to get behavior analysis: ${error.message}`);
    }
  }
}