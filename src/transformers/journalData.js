import { createLogger } from '../utils/logger.js';

const logger = createLogger('JournalDataTransformer');

/**
 * Calculate days ago from a date string
 * @param {string} dateString - Date in YYYY-MM-DD or ISO format
 * @returns {number|null} Days ago (0 for today, 1 for yesterday, etc.) or null if invalid
 */
function calculateDaysAgo(dateString) {
  if (!dateString) return null;
  
  try {
    // Extract just the date part if it's a full datetime
    const datePart = dateString.split('T')[0];
    const entryDate = new Date(datePart + 'T00:00:00.000Z');
    const today = new Date();
    today.setHours(0, 0, 0, 0); // Reset to midnight for accurate day calculation
    
    if (isNaN(entryDate.getTime())) {
      return null; // Invalid date
    }
    
    const diffTime = today.getTime() - entryDate.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    return Math.max(0, diffDays); // Ensure non-negative
  } catch (error) {
    logger.warn('Failed to calculate days ago', { dateString, error: error.message });
    return null;
  }
}

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
        daysAgo: calculateDaysAgo(document.date),
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
