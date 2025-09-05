import { createLogger } from '../../utils/logger.js';
import { VMApiClient } from '../../clients/vmApiClient.js';
import { transformJournalSearchResults } from '../../transformers/journalData.js';

const logger = createLogger('SearchJournalsTool');

export class SearchJournalsTool {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    this.apiClient = new VMApiClient();
  }

  static get definition() {
    return {
      name: 'search_journals',
      description: 'Search journal entries using natural language queries. Returns relevant entries based on semantic similarity.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language search query (e.g., "tantrums last week", "bedtime struggles")'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)',
            minimum: 1,
            maximum: 50
          },
          offset: {
            type: 'number',
            description: 'Offset for pagination (default: 0)',
            minimum: 0
          }
        },
        required: ['query']
      }
    };
  }

  async execute(args, session) {
    const { query, limit = 10, offset = 0 } = args;
    
    if (!query) {
      throw new Error('Search query is required');
    }

    // Ensure child is selected (stateful - childId comes from session)
    const { childId, childName } = this.sessionManager.getSelectedChild(session.sessionId);
    
    try {
      // Call the journal search API endpoint
      const response = await this.apiClient.searchJournals(childId, query, { limit, offset });
      
      logger.debug('Journal search completed', { 
        childId, 
        query: query.substring(0, 100),
        resultCount: response.results?.length || 0,
        totalResults: response.pagination?.total || 0
      });
      
      // Transform verbose API response to LLM decision-making format
      const transformed = transformJournalSearchResults(response, session.selectedChildName);
      
      logger.debug('Journal search transformed', {
        originalSize: JSON.stringify(response).length,
        transformedSize: JSON.stringify(transformed).length,
        reduction: `${Math.round((1 - JSON.stringify(transformed).length / JSON.stringify(response).length) * 100)}%`
      });
      
      return transformed;
      
    } catch (error) {
      logger.error('Failed to search journals', { 
        error: error.message,
        childId,
        query: query.substring(0, 100)
      });
      throw new Error(`Failed to search journals: ${error.message}`);
    }
  }
}
