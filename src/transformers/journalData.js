import { createLogger } from '../utils/logger.js';

const logger = createLogger('JournalDataTransformer');

/**
 * Transform journal search results for LLM decision-making
 * Keep only essential data to help LLM decide which entries to examine further
 */
export function transformJournalSearchResults(rawResults, childName) {
  if (!rawResults || !rawResults.results) {
    return {
      childName,
      totalResults: 0,
      results: [],
      message: 'No journal entries found'
    };
  }

  try {
    const transformedResults = rawResults.results.map(item => {
      const document = item.document;
      const metadata = item.searchMetadata;
      
      return {
        journalEntryId: document.journalEntryId,
        date: document.date,
        authorName: document.userName || 'Unknown',
        // Use the most relevant summary available
        summary: document.results?.shortTitle || 
                document.results?.redactedSummary || 
                'No summary available',
        // The semantic chunk that actually matched the search
        matchingChunk: metadata?.rawSnippet || 
                      metadata?.snippet?.replace(/<\/?mark>/g, '') || 
                      'No matching content',
        // Simple relevance score for LLM to understand match quality
        relevanceScore: Math.round((metadata?.searchScore || 0) * 100)
        
        // Removed: entryType (all are text), full text, hashtags, detailed metadata, etc.
        // These can be retrieved with a separate get_journal_entry call
      };
    });

    logger.debug('Journal search results transformed', {
      originalResultCount: rawResults.results.length,
      transformedResultCount: transformedResults.length,
      avgRelevanceScore: transformedResults.reduce((sum, r) => sum + r.relevanceScore, 0) / transformedResults.length
    });

    return {
      childName,
      totalResults: rawResults.pagination?.total || transformedResults.length,
      results: transformedResults,
      pagination: rawResults.pagination,
      message: `Found ${transformedResults.length} relevant entries. Use journal entry IDs for full details.`
    };

  } catch (error) {
    logger.error('Failed to transform journal search results', { error: error.message });
    return {
      childName,
      totalResults: 0,
      results: [],
      error: 'Failed to process journal search results'
    };
  }
}
