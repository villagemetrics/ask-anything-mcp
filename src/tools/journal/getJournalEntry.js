import { createLogger } from '../../utils/logger.js';
import { VMApiClient } from '../../clients/vmApiClient.js';

const logger = createLogger('GetJournalEntryTool');

export class GetJournalEntryTool {
  constructor(sessionManager, apiOptions = {}) {
    this.sessionManager = sessionManager;
    this.apiClient = new VMApiClient(apiOptions);
  }

  static get definition() {
    return {
      name: 'get_journal_entry',
      description: 'Get a journal entry by ID. Returns core information: text content (title, summaries, full text), overall behavior score, sentiment, key insights (challenges/successes), and simplified hashtags. Use get_journal_details for professional analysis and detailed scores.',
      inputSchema: {
        type: 'object',
        properties: {
          journalEntryId: {
            type: 'string',
            description: 'The journal entry ID (e.g., journal_entry_39c6888b-e7cb-4a93-a797-56a6ebb48db5)'
          }
        },
        required: ['journalEntryId']
      }
    };
  }

  async execute(args, session) {
    const { journalEntryId } = args;
    
    // Ensure child is selected (stateful - childId comes from session)
    const { childId, childName } = this.sessionManager.getSelectedChild(session.sessionId);
    
    logger.info('Getting journal entry', { 
      childId, 
      journalEntryId
    });

    try {
      // Get the full journal entry directly using simplified API endpoint
      const journalEntry = await this.apiClient.getJournalEntry(childId, journalEntryId);

      if (!journalEntry) {
        return {
          error: 'Journal entry not found'
        };
      }

      // Transform the data for the LLM
      const transformed = this.transformJournalEntry(journalEntry, childName);
      
      logger.info('Journal entry retrieved and transformed successfully');
      return transformed;

    } catch (error) {
      logger.error('Failed to get journal entry', { error: error.message, journalEntryId });
      throw new Error(`Failed to get journal entry: ${error.message}`);
    }
  }

  transformJournalEntry(entry, childName) {
    const results = entry.results || {};
    
    // Core information that's most commonly needed
    const transformed = {
      childName,
      journalEntryId: entry.journalEntryId,
      date: entry.date,
      entryType: entry.entryType,
      
      // Text summaries
      shortTitle: results.shortTitle || '',
      summary: results.summary || '',
      longSummary: results.longSummary || '',
      
      // Clean version of the full text
      fullText: results.cleanVersion || entry.text || '',
      
      // Overall sentiment and key scores
      sentiment: results.sentiment || 0,
      keyMomentScore: results.keyMomentScore || 0,
      effectiveStrategiesScore: results.effectiveStrategiesScore || 0,
      
      // Overall behavior score
      overallBehaviorScore: results.inferredBehaviorScores?.overall || null,
      
      // Simplified hashtags (just names and commentary)
      hashtags: (results.hashtags || []).map(h => ({
        tag: h.hashtag,
        reason: h.commentary || '',
        type: h.type || ''
      })),
      
      // Key insights
      identifiedChallenges: results.identifiedChallenges || [],
      notableSuccesses: results.notableSuccesses || [],
      
      // Note about getting more details
      note: "Use get_journal_details tool for behavior score breakdowns, BCBA analysis, child profile, and detailed hashtag metadata"
    };

    return transformed;
  }
}
