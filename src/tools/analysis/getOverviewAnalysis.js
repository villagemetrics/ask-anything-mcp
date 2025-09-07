import { createLogger } from '../../utils/logger.js';
import { VMApiClient } from '../../clients/vmApiClient.js';
import { transformOverviewAnalysis } from '../../transformers/analysisData.js';

const logger = createLogger('GetOverviewAnalysisTool');

export class GetOverviewAnalysisTool {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    this.apiClient = new VMApiClient();
  }

  static get definition() {
    return {
      name: 'get_overview_analysis',
      description: `Get comprehensive behavior analysis including overall trends, daily patterns, caregiver effectiveness, and temporal analysis for the selected child. 
      
Best for answering:
- "How has behavior changed over time?"
- "Is behavior improving or declining?" 
- "Which caregivers see the best outcomes?"
- "What patterns exist by day of week?"
- "Which days are typically better/worse?"
- "How consistent are behavior scores?"
- "What activities enhance good behavior?"
- "What triggers challenging behavior?"`,
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
      // Get analysis data from API
      const rawData = await this.apiClient.getAnalysisData(childId, timeRange, 'overview');
      
      // Transform to LLM-friendly format
      const transformed = transformOverviewAnalysis(rawData, childName, timeRange);
      
      logger.debug('Overview analysis retrieved', { 
        childId, 
        timeRange, 
        hasData: transformed.hasData,
        compressionRatio: transformed.compressionInfo?.compressionRatio
      });
      
      return transformed;
    } catch (error) {
      if (error.response?.status === 403) {
        return {
          timeRange,
          childName,
          message: `Access denied: You don't have permission to view behavior analysis data for ${childName}. Contact a parent or guardian to request access.`,
          permissionError: true
        };
      }
      
      if (error.response?.status === 404) {
        return {
          timeRange,
          childName,
          message: `No overview analysis data found for ${childName} in the ${timeRange} period. Analysis may not be available yet or there may be insufficient data.`,
          hasData: false
        };
      }
      
      logger.error('Failed to get overview analysis', { error: error.message, timeRange });
      throw new Error(`Failed to get overview analysis: ${error.message}`);
    }
  }
}