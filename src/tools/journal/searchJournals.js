import { createLogger } from '../../utils/logger.js';
import { VMApiClient } from '../../clients/vmApiClient.js';
import { transformJournalSearchResults } from '../../transformers/journalData.js';

const logger = createLogger('SearchJournalsTool');

export class SearchJournalsTool {
  constructor(sessionManager, apiOptions = {}) {
    this.sessionManager = sessionManager;
    this.apiClient = new VMApiClient(apiOptions);
  }

  static get definition() {
    return {
      name: 'search_journal_entries',
      description: 'Search journal entries using semantic (meaning-based) search powered by AI. Finds content related to the overall meaning of your query, not just exact keyword matches. Works best with natural language descriptions of what you\'re looking for. Results include scoring to help you decide which entries warrant full retrieval with get_journal_entry.',
      inputSchema: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'Natural language search query describing what you\'re looking for. The search uses semantic understanding to find relevant content based on meaning, not just exact word matches. Examples: "tantrum at bedtime", "successful strategies for transitions", "funny moments with siblings". Avoid keyword stuffing (lists of similar terms) - the search engine captures meaning and context automatically. Use descriptive phrases that express your search intent clearly. Note: Multiple concepts in one query work like weighted OR (entries matching some concepts will be returned with lower scores than entries matching all concepts). Use separate searches when you want comprehensive coverage of distinct topics or when combining concepts might dilute your results.'
          },
          limit: {
            type: 'number',
            description: 'Maximum number of results to return (default: 10)',
            minimum: 1,
            maximum: 360
          },
          mode: { type: 'string', enum: ['conversational', 'insight_evidence'], description: 'Strict insight evidence preserves bounded coverage and stable pagination.' },
          startDate: { type: 'string', description: 'Inclusive observed day, YYYY-MM-DD; required in insight_evidence mode.' },
          endDate: { type: 'string', description: 'Inclusive observed day, YYYY-MM-DD; required in insight_evidence mode.' },
          continuationToken: { type: 'string', description: 'Opaque token from the previous strict page; keep query and dates unchanged.' },
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
    const { query, limit = 10, offset = 0, mode, startDate, endDate, continuationToken } = args;
    
    if (!query) {
      throw new Error('Search query is required');
    }
    if (mode && !['conversational', 'insight_evidence'].includes(mode)) throw new Error('INVALID_SEARCH_MODE');
    if (!Number.isInteger(limit) || limit < 1 || limit > (mode === 'insight_evidence' ? 360 : 50)) throw new Error('INVALID_SEARCH_LIMIT');
    if (mode === 'insight_evidence' && (!startDate || !endDate || offset !== 0)) throw new Error('INVALID_STRICT_SEARCH_REQUEST');
    if (mode !== 'insight_evidence' && (startDate || endDate || continuationToken)) throw new Error('STRICT_SEARCH_MODE_REQUIRED');

    // Ensure child is selected (stateful - childId comes from session)
    const { childId, childName } = this.sessionManager.getSelectedChild(session.sessionId);
    
    let response;
    try {
      // Call the journal search API endpoint
      response = await this.apiClient.searchJournals(childId, query, { limit, offset, mode, startDate, endDate, continuationToken });
      if (mode === 'insight_evidence') {
        const r = response.retrieval, p = response.pagination;
        const count = value => Number.isInteger(value) && value >= 0;
        if (!response.searchExecutionId || !r || !Array.isArray(response.results) ||
            response.results.some(item => !item.document?.journalEntryId) ||
            response.requestedFilter?.startDate !== startDate || response.requestedFilter?.endDate !== endDate ||
            !response.effectiveFilter?.startDate || !response.effectiveFilter?.endDate ||
            !['date_filtered_vector', 'legacy_post_filter'].includes(r.mode) ||
            !['complete', 'legacy_or_unknown'].includes(r.dateCoverageStatus) ||
            !count(r.candidateLimit) || r.candidateLimit === 0 || !count(r.rawCandidateCount) || !count(r.enrichmentFailureCount) ||
            typeof r.truncated !== 'boolean' || typeof r.truncationKnown !== 'boolean' || !Array.isArray(r.incompleteReasons) ||
            typeof response.completed !== 'boolean' || typeof p?.exhausted !== 'boolean' ||
            (!p.exhausted && !p.nextContinuationToken)) throw new Error('STRICT_SEARCH_RESPONSE_INCOMPLETE');
        const complete = response.effectiveFilter.startDate === startDate && response.effectiveFilter.endDate === endDate &&
          r.mode === 'date_filtered_vector' && r.dateCoverageStatus === 'complete' && r.truncationKnown && !r.truncated &&
          p.exhausted && r.enrichmentFailureCount === 0 && r.incompleteReasons.length === 0;
        if (response.completed !== complete) throw new Error('STRICT_SEARCH_COMPLETION_INCONSISTENT');
      }
      
      logger.debug('Journal search completed', { 
        childId, 
        queryCharCount: query.length,
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
      if (response) { error.providerUsage = response.providerUsage || []; error.usageIncomplete = response.usageIncomplete ?? true; }
      logger.error('Failed to search journals', { 
        error: error.message,
        childId,
        queryCharCount: query.length
      });
      if (['CANCELLED', 'DEADLINE_EXCEEDED'].includes(error.code)) throw error;
      throw Object.assign(new Error(`Failed to search journals: ${error.message}`), { providerUsage: error.providerUsage, usageIncomplete: error.usageIncomplete });
    }
  }
}
