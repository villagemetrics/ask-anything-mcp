import { createLogger } from '../utils/logger.js';

const logger = createLogger('JournalDataTransformer');

/**
 * Format score as label with value for display
 * @param {string} label - The label to display (e.g., "High detail")
 * @param {number} score - The score value (0-1)
 * @returns {string} Formatted string like "High detail (0.85/1.0)"
 */
function formatScoreLabel(label, score) {
  return `${label} (${score.toFixed(2)}/1.0)`;
}

/**
 * Get detail level label and formatted string based on score
 * @param {number} detailScore - Detail score from 0-1
 * @returns {string|null} Formatted detail level or null if score invalid
 */
function getDetailLevel(detailScore) {
  if (typeof detailScore !== 'number' || detailScore < 0 || detailScore > 1) {
    return null;
  }
  
  let label;
  if (detailScore >= 0.75) {
    label = 'High detail';
  } else if (detailScore >= 0.45) {
    label = 'Moderate detail';
  } else {
    label = 'Brief detail';
  }
  
  return formatScoreLabel(label, detailScore);
}

/**
 * Get moment significance label and formatted string based on score
 * Only returns a value if score >= 0.55
 * @param {number} keyMomentScore - Key moment score from 0-1
 * @returns {string|null} Formatted moment significance or null if below threshold
 */
function getMomentSignificance(keyMomentScore) {
  if (typeof keyMomentScore !== 'number' || keyMomentScore < 0.55) {
    return null;
  }
  
  let label;
  if (keyMomentScore >= 0.75) {
    label = 'Major key moment';
  } else if (keyMomentScore >= 0.65) {
    label = 'Notable key moment';
  } else {
    label = 'Minor key moment';
  }
  
  return formatScoreLabel(label, keyMomentScore);
}

/**
 * Get crisis level label and formatted string based on score
 * Only returns a value if score >= 0.55
 * @param {number} crisisIntensityScore - Crisis intensity score from 0-1
 * @returns {string|null} Formatted crisis level or null if below threshold
 */
function getCrisisLevel(crisisIntensityScore) {
  if (typeof crisisIntensityScore !== 'number' || crisisIntensityScore < 0.55) {
    return null;
  }
  
  let label;
  if (crisisIntensityScore >= 0.75) {
    label = 'Crisis situation';
  } else if (crisisIntensityScore >= 0.65) {
    label = 'High intensity';
  } else {
    label = 'Elevated situation';
  }
  
  return formatScoreLabel(label, crisisIntensityScore);
}

/**
 * Get effective strategies label and formatted string based on score
 * Only returns a value if score >= 0.55
 * @param {number} effectiveStrategiesScore - Effective strategies score from 0-1
 * @returns {string|null} Formatted strategies level or null if below threshold
 */
function getEffectiveStrategies(effectiveStrategiesScore) {
  if (typeof effectiveStrategiesScore !== 'number' || effectiveStrategiesScore < 0.55) {
    return null;
  }
  
  let label;
  if (effectiveStrategiesScore >= 0.75) {
    label = 'Highly effective strategies';
  } else if (effectiveStrategiesScore >= 0.65) {
    label = 'Good strategies';
  } else {
    label = 'Helpful strategies';
  }
  
  return formatScoreLabel(label, effectiveStrategiesScore);
}

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
      
      // Build base result object
      const result = {
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
      };
      
      // Add scoring fields for LLM decision-making
      const results = document.results || {};
      
      // Always include detail level
      const detailLevel = getDetailLevel(results.detailScore);
      if (detailLevel) {
        result.detailLevel = detailLevel;
      }
      
      // Conditionally include moment significance (≥0.55 threshold)
      const momentSignificance = getMomentSignificance(results.keyMomentScore);
      if (momentSignificance) {
        result.momentSignificance = momentSignificance;
      }
      
      // Conditionally include crisis level (≥0.55 threshold)
      const crisisLevel = getCrisisLevel(results.crisisIntensityScore);
      if (crisisLevel) {
        result.crisisLevel = crisisLevel;
      }
      
      // Conditionally include effective strategies (≥0.55 threshold)
      const effectiveStrategies = getEffectiveStrategies(results.effectiveStrategiesScore);
      if (effectiveStrategies) {
        result.effectiveStrategies = effectiveStrategies;
      }
      
      return result;
        
        // Removed: entryType (all are text), full text, hashtags, detailed metadata, etc.
        // These can be retrieved with a separate get_journal_entry call
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
      message: `Found ${transformedResults.length} relevant entries. Use journal entry IDs for full details. Scoring fields help you decide which entries to retrieve: detailLevel (always present: Brief/Moderate/High), momentSignificance (≥0.55: Minor/Notable/Major key moment), crisisLevel (≥0.55: Elevated/High intensity/Crisis situation), effectiveStrategies (≥0.55: Helpful/Good/Highly effective strategies).`
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
