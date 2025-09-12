import { createLogger } from '../../utils/logger.js';
import { VMApiClient } from '../../clients/vmApiClient.js';
import { transformBehaviorData } from '../../transformers/behaviorData.js';

const logger = createLogger('GetBehaviorScoresTool');

export class GetBehaviorScoresTool {
  constructor(sessionManager, apiOptions = {}) {
    this.sessionManager = sessionManager;
    this.apiClient = new VMApiClient(apiOptions);
  }

  static get definition() {
    return {
      name: 'get_behavior_scores',
      description: 'Get behavior tracking scores for the selected child on a specific date',
      inputSchema: {
        type: 'object',
        properties: {
          date: {
            type: 'string',
            description: 'Date to retrieve scores for (YYYY-MM-DD)'
          }
        },
        required: ['date']
      }
    };
  }

  async execute(args, session) {
    const { date } = args;
    
    if (!date) {
      throw new Error('Date is required (format: YYYY-MM-DD)');
    }

    // Ensure child is selected (stateful - childId comes from session)
    const { childId, childName } = this.sessionManager.getSelectedChild(session.sessionId);
    
    try {
      // Get raw data from API
      const rawData = await this.apiClient.getBehaviorData(childId, date);
      
      // Transform to LLM-friendly format
      const transformed = transformBehaviorData(rawData, session.selectedChildName);
      
      logger.debug('Behavior data retrieved', { 
        childId, 
        date, 
        hasData: !!rawData,
        scoreCount: Object.keys(transformed.scores || {}).length 
      });
      
      return transformed;
    } catch (error) {
      if (error.response?.status === 404) {
        return {
          date,
          childName,
          message: `No behavior data found for ${childName} on ${date}. This could mean no data was tracked that day.`,
          scores: {},
          hasData: false
        };
      }
      
      logger.error('Failed to get behavior data', { error: error.message });
      throw new Error(`Failed to get behavior data: ${error.message}`);
    }
  }
}
