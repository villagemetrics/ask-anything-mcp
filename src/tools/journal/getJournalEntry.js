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
      description: 'Get a journal entry by ID. Returns essential information only: full text content, basic hashtag names, and overall behavior score. Use get_journal_entry_analysis for detailed professional analysis, insights, and scoring breakdowns.',
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

    // Essential information only - hand-picked fields to prevent bloat
    const transformed = {
      childName,
      journalEntryId: entry.journalEntryId,
      date: entry.date,
      entryType: entry.entryType,
      // Short title for quick reference
      shortTitle: results.shortTitle || '',
      // Full text content only (no summaries - those go in detailed analysis)
      fullText: results.cleanVersion || entry.text || '',
      // Overall behavior score for basic context
      overallBehaviorScore: results.inferredBehaviorScores?.overall || null,
      // Simple hashtags - just the tag names
      hashtags: (results.hashtags || []).map(h => h.hashtag).filter(Boolean),
      // Note about getting more details
      note: "Use get_journal_entry_analysis tool to get detailed professional analysis, insights, scoring breakdowns, and analytical summaries for this same journal entry"
    };

    return transformed;
  }
}
