import { createLogger } from '../../utils/logger.js';
import { VMApiClient } from '../../clients/vmApiClient.js';

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
   * Calculate limit based on time range (since feed API doesn't support date filtering)
   * @private
   */
  _calculateLimitForTimeRange(timeRange) {
    switch (timeRange) {
      case 'last_7_days':
        return 20; // Usually ~2-3 entries per day
      case 'last_14_days':
        return 35;
      case 'last_30_days':
        return 50; // Max allowed by feed API
      case 'last_60_days':
        return 50; // Max allowed by feed API
      default:
        return 50; // Default
    }
  }

  /**
   * Format score as label with value for display
   * @private
   */
  _formatScoreLabel(label, score) {
    return `${label} (${score.toFixed(2)}/1.0)`;
  }

  /**
   * Get detail level label and formatted string based on score
   * @private
   */
  _getDetailLevel(detailScore) {
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
    
    return this._formatScoreLabel(label, detailScore);
  }

  /**
   * Get moment significance label and formatted string based on score
   * Only returns a value if score >= 0.55
   * @private
   */
  _getMomentSignificance(keyMomentScore) {
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
    
    return this._formatScoreLabel(label, keyMomentScore);
  }

  /**
   * Get crisis level label and formatted string based on score
   * Only returns a value if score >= 0.55
   * @private
   */
  _getCrisisLevel(crisisIntensityScore) {
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
    
    return this._formatScoreLabel(label, crisisIntensityScore);
  }

  /**
   * Get effective strategies label and formatted string based on score
   * Only returns a value if score >= 0.55
   * @private
   */
  _getEffectiveStrategies(effectiveStrategiesScore) {
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
    
    return this._formatScoreLabel(label, effectiveStrategiesScore);
  }

  /**
   * Transform feed entries to list format
   * @private
   */
  transformFeedToList(response, childName) {
    if (!response || !response.results) {
      return {
        childName,
        totalResults: 0,
        results: [],
        message: 'No journal entries found'
      };
    }

    const transformedResults = response.results.map(item => {
      const result = {
        journalEntryId: item.journalEntryId,
        date: new Date(item.epoch * 1000).toISOString().split('T')[0], // Convert epoch to YYYY-MM-DD
        daysAgo: Math.floor((Date.now() - item.epoch * 1000) / (1000 * 60 * 60 * 24)),
        authorName: item.userName || 'Unknown',
        summary: item.shortTitle || 'No summary available',
        excerpt: item.summary || 'No excerpt available'
      };

      // Add scoring fields like search results
      // Always include detail level
      const detailLevel = this._getDetailLevel(item.detailScore);
      if (detailLevel) {
        result.detailLevel = detailLevel;
      }
      
      // Conditionally include moment significance (≥0.55 threshold)
      const momentSignificance = this._getMomentSignificance(item.keyMomentScore);
      if (momentSignificance) {
        result.momentSignificance = momentSignificance;
      }
      
      // Conditionally include crisis level (≥0.55 threshold)
      const crisisLevel = this._getCrisisLevel(item.crisisIntensityScore);
      if (crisisLevel) {
        result.crisisLevel = crisisLevel;
      }
      
      // Conditionally include effective strategies (≥0.55 threshold)
      const effectiveStrategies = this._getEffectiveStrategies(item.effectiveStrategiesScore);
      if (effectiveStrategies) {
        result.effectiveStrategies = effectiveStrategies;
      }

      return result;
    });

    return {
      childName,
      totalResults: transformedResults.length,
      results: transformedResults,
      hasMore: response.hasMore,
      nextOffset: response.nextOffset,
      message: `Found ${transformedResults.length} entries. Use journal entry IDs for full details. Scoring fields help you decide which entries to retrieve: detailLevel (always present: Brief/Moderate/High), momentSignificance (≥0.55: Minor/Notable/Major key moment), crisisLevel (≥0.55: Elevated/High intensity/Crisis situation), effectiveStrategies (≥0.55: Helpful/Good/Highly effective strategies).`
    };
  }

  async execute(args, session) {
    const { timeRange = 'last_30_days' } = args;
    
    // Ensure child is selected (stateful - childId comes from session)
    const { childId, childName } = this.sessionManager.getSelectedChild(session.sessionId);
    
    try {
      const limit = this._calculateLimitForTimeRange(timeRange);
      
      logger.debug('Listing journal entries from feed', { 
        childId, 
        timeRange,
        limit
      });
      
      // Call the journal list API endpoint (via feed)
      const response = await this.apiClient.listJournalEntries(childId, {
        limit,
        offset: 0
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
      
      // Transform response from feed format to list format
      const transformed = this.transformFeedToList(transformedResponse, childName);
      
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
      transformed.note = `Showing the ${limit} most recent journal entries (feed-based, chronological order).`;
      
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