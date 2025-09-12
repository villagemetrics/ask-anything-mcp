import { createLogger } from '../../utils/logger.js';
import { VMApiClient } from '../../clients/vmApiClient.js';
import { transformDateRangeMetadata } from '../../transformers/dateRangeData.js';

const logger = createLogger('GetDateRangeMetadataTool');

export class GetDateRangeMetadataTool {
  constructor(sessionManager, apiOptions = {}) {
    this.sessionManager = sessionManager;
    this.apiClient = new VMApiClient(apiOptions);
  }

  static get definition() {
    return {
      name: 'get_date_range_metadata',
      description: 'Get metadata about available tracking data date ranges and recent daily journal activity. Shows data coverage and recency to help determine what questions can be answered.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }

  async execute(args, session) {
    // Ensure child is selected
    const { childId, childName } = this.sessionManager.getSelectedChild(session.sessionId);
    
    try {
      // Call the date range metadata API endpoint
      const rawData = await this.apiClient.getDateRangeMetadata(childId);
      
      // Transform to LLM-friendly format
      const transformed = transformDateRangeMetadata(rawData, session.selectedChildName);
      
      logger.debug('Date range metadata retrieved', { 
        childId, 
        hasData: !!rawData,
        dataGeneratedOn: rawData.recentDailyActivity?.endDate
      });
      
      return transformed;
      
    } catch (error) {
      logger.error('Failed to get date range metadata', { 
        error: error.message,
        childId
      });
      throw new Error(`Failed to get date range metadata: ${error.message}`);
    }
  }
}
