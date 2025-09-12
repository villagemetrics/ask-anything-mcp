import { createLogger } from '../../utils/logger.js';
import { VMApiClient } from '../../clients/vmApiClient.js';

const logger = createLogger('GetJournalDetailsTool');

export class GetJournalDetailsTool {
  constructor(sessionManager, apiOptions = {}) {
    this.sessionManager = sessionManager;
    this.apiClient = new VMApiClient(apiOptions);
  }

  static get definition() {
    return {
      name: 'get_journal_entry_details',
      description: 'Get additional detailed analysis of a journal entry. Returns DIFFERENT data than get_journal_entry: BCBA professional analysis, per-goal behavior scores with reasoning, child profile (likes/dislikes/strengths), detailed hashtag metrics, and all scoring metrics. Call get_journal_entry first for basic content.',
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
    
    logger.info('Getting detailed journal entry analysis', { 
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

      // Transform to show detailed analysis
      const transformed = this.transformJournalDetails(journalEntry, childName);
      
      logger.info('Journal entry details retrieved successfully');
      return transformed;

    } catch (error) {
      logger.error('Failed to get journal details', { error: error.message, journalEntryId });
      throw new Error(`Failed to get journal details: ${error.message}`);
    }
  }

  transformJournalDetails(entry, childName) {
    const results = entry.results || {};
    
    return {
      childName,
      journalEntryId: entry.journalEntryId,
      date: entry.date,
      
      // BCBA Analysis
      professionalAnalysis: {
        bcbaAnalysis: results.bcbaAnalysis || '',
        caregiverHypotheses: results.caregiverHypotheses || []
      },
      
      // Detailed behavior scores with reasoning
      behaviorScoresDetailed: {
        overall: results.inferredBehaviorScores?.overall || null,
        perGoal: (results.inferredBehaviorScores?.perGoal || []).map(g => ({
          goalName: g.name,
          score: g.score,
          reasoning: g.whyThisScore || ''
        }))
      },
      
      // Child profile insights
      childProfile: {
        likes: results.childProfile?.likes || [],
        dislikes: results.childProfile?.dislikes || [],
        strengths: results.childProfile?.strengths || [],
        struggles: results.childProfile?.struggles || [],
        memoryFacts: results.childProfile?.memoryFacts || []
      },
      
      // Full hashtag metadata
      hashtagsDetailed: (results.hashtags || []).map(h => ({
        tag: h.hashtag,
        type: h.type || '',
        confidence: h.confidence || 0,
        impact: h.impact || 0,
        occurrences: h.occurrences || 0,
        intensity: h.intensity || 0,
        prominence: h.prominence || 0
      })),
      
      // All scoring metrics
      detailedScores: {
        sentiment: results.sentiment || 0,
        detailScore: results.detailScore || 0,
        keyMomentScore: results.keyMomentScore || 0,
        dayCompleteness: results.dayCompleteness || 0,
        singleDayFocusScore: results.singleDayFocusScore || 0,
        effectiveStrategiesScore: results.effectiveStrategiesScore || 0,
        turnaroundScore: results.turnaroundScore || null,
        cutenessScore: results.cutenessScore || 0,
        funnyStoryScore: results.funnyStoryScore || 0,
        heartfeltScore: results.heartfeltScore || 0,
        crazyStoryScore: results.crazyStoryScore || 0
      },
      
      // Empathy response if applicable
      empathyResponse: results.empathyResponse || '',
      
      // Product feedback if any
      productFeedback: results.productFeedback || ''
    };
  }
}
