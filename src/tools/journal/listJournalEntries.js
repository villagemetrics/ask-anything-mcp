import { createLogger } from '../../utils/logger.js';
import { VMApiClient } from '../../clients/vmApiClient.js';
import { transformJournalSearchResults } from '../../transformers/journalData.js';

const logger = createLogger('ListJournalEntriesTool');

export class ListJournalEntriesTool {
  constructor(sessionManager, apiOptions = {}) {
    this.sessionManager = sessionManager;
    this.apiClient = new VMApiClient(apiOptions);
  }

  static get definition() {
    return {
      name: 'list_journal_entries',
      description: 'List recent journal entries chronologically. Returns summary information to help decide which entries need full retrieval with get_journal_entry.',
      inputSchema: {
        type: 'object',
        properties: {
          timeRange: {
            type: 'string',
            enum: ['last_7_days', 'last_14_days', 'last_30_days', 'last_60_days'],
            default: 'last_30_days',
            description: 'Time period to retrieve entries from'
          }
        }
      }
    };
  }

  /**
   * Calculate date range from timeRange parameter
   * @private
   */
  _calculateDateRange(timeRange) {
    const now = new Date();
    const endDate = now.toISOString().split('T')[0]; // Today in YYYY-MM-DD
    
    let daysBack;
    switch (timeRange) {
      case 'last_7_days':
        daysBack = 7;
        break;
      case 'last_14_days':
        daysBack = 14;
        break;
      case 'last_30_days':
        daysBack = 30;
        break;
      case 'last_60_days':
        daysBack = 60;
        break;
      default:
        daysBack = 30; // Default fallback
    }
    
    const startDate = new Date(now.getTime() - (daysBack * 24 * 60 * 60 * 1000));
    const startDateString = startDate.toISOString().split('T')[0];
    
    return { startDate: startDateString, endDate };
  }

  async execute(args, session) {
    const { timeRange = 'last_30_days' } = args;
    
    // Ensure child is selected (stateful - childId comes from session)
    const { childId, childName } = this.sessionManager.getSelectedChild(session.sessionId);
    
    try {
      const { startDate, endDate } = this._calculateDateRange(timeRange);
      
      logger.debug('Listing journal entries', { 
        childId, 
        timeRange,
        startDate,
        endDate
      });
      
      // Call the journal list API endpoint
      const response = await this.apiClient.listJournalEntries(childId, {
        startDate,
        endDate,
        sortOrder: 'desc' // Most recent first
      });
      
      logger.debug('Journal entries listed', { 
        childId, 
        timeRange,
        resultCount: response.results?.length || 0,
        totalResults: response.results?.length || 0
      });
      
      // Check for truncation at 100 entries
      let transformedResponse = response;
      let truncated = false;
      let totalFound = response.results?.length || 0;
      
      if (response.results && response.results.length > 100) {
        transformedResponse = {
          ...response,
          results: response.results.slice(0, 100)
        };
        truncated = true;
      }
      
      // Transform response to match search results format for consistency
      const transformed = transformJournalSearchResults(transformedResponse, childName);
      
      // Add truncation info if needed
      if (truncated) {
        transformed.truncated = true;
        transformed.totalFound = totalFound;
        transformed.message = `Found ${totalFound} entries for ${timeRange}. Showing first 100. Consider using a shorter timeRange for complete results.`;
      } else {
        transformed.message = `Found ${totalFound} entries for ${timeRange}.`;
      }
      
      // Add time range info
      transformed.timeRange = timeRange;
      transformed.dateRange = { startDate, endDate };
      
      logger.debug('Journal entries transformed', {
        originalSize: JSON.stringify(response).length,
        transformedSize: JSON.stringify(transformed).length,
        truncated,
        totalFound
      });
      
      return transformed;
      
    } catch (error) {
      logger.error('Failed to list journal entries', { 
        error: error.message,
        childId,
        timeRange
      });
      throw new Error(`Failed to list journal entries: ${error.message}`);
    }
  }
}