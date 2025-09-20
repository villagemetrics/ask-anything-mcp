import { expect } from 'chai';
import { VMApiClient } from '../../src/clients/vmApiClient.js';
import { SessionManager } from '../../src/session/sessionManager.js';
import { GetJournalEntryTool } from '../../src/tools/journal/getJournalEntry.js';
import { GetJournalDetailsTool } from '../../src/tools/journal/getJournalDetails.js';

describe('Journal Entry Tools', function() {
  let apiClient;
  let sessionManager;
  let getJournalEntryTool;
  let getJournalDetailsTool;
  let sessionId;
  let testChildId;
  let testJournalEntryId;

  before(function() {
    // Fail fast if environment variables are missing
    if (!process.env.VM_MCP_TOKEN) {
      throw new Error('VM_MCP_TOKEN environment variable is required for integration tests');
    }
    if (!process.env.VM_API_BASE_URL) {
      throw new Error('VM_API_BASE_URL environment variable is required for integration tests');
    }

    apiClient = new VMApiClient();
    sessionManager = new SessionManager();
    
    // API configuration for tests - will use default token behavior (MCP token preferred)
    const apiOptions = {};
    getJournalEntryTool = new GetJournalEntryTool(sessionManager, apiOptions);
    getJournalDetailsTool = new GetJournalDetailsTool(sessionManager, apiOptions);
  });

  beforeEach(async function() {
    // Create session and select first available child
    const children = await apiClient.getChildren();
    if (!children.length) {
      throw new Error('No children found for testing');
    }

    testChildId = children[0].childId;
    sessionId = sessionManager.createSession('test-user');
    sessionManager.setSelectedChild(sessionId, testChildId, children[0].fullName);

    // Get a journal entry ID from search for testing (try multiple search terms)
    let searchResults;
    const searchTerms = ['silly', 'happy', 'sister', 'VR'];
    
    for (const term of searchTerms) {
      searchResults = await apiClient.searchJournals(testChildId, term, { limit: 1 });
      if (searchResults?.results?.length > 0) {
        break;
      }
    }
    
    if (!searchResults?.results?.length) {
      throw new Error('No journal entries found for testing - tried multiple search terms');
    }
    
    // Extract journal entry ID from search results structure
    const searchResult = searchResults.results[0];
    testJournalEntryId = searchResult.documentId || searchResult.document?.journalEntryId || searchResult.journalEntryId;
  });

  describe('GetJournalEntryTool', function() {
    it('should retrieve journal entry with core information', async function() {
      const session = sessionManager.getSession(sessionId);
      
      const result = await getJournalEntryTool.execute(
        { journalEntryId: testJournalEntryId }, 
        session
      );

      expect(result).to.be.an('object');
      expect(result.error).to.be.undefined;
      
      // Check core fields are present
      expect(result.childName).to.be.a('string');
      expect(result.journalEntryId).to.equal(testJournalEntryId);
      expect(result.date).to.be.a('string');
      expect(result.entryType).to.be.a('string');
      
      // Check only fullText is present (no summaries in streamlined main tool)
      expect(result.fullText).to.be.a('string');
      
      // Check hashtags array (should be simple array of strings)
      expect(result.hashtags).to.be.an('array');
      if (result.hashtags.length > 0) {
        expect(result.hashtags[0]).to.be.a('string');
      }
      
      // Check optional overall behavior score
      if (result.overallBehaviorScore !== null && result.overallBehaviorScore !== undefined) {
        expect(result.overallBehaviorScore).to.be.a('number');
      }
      
      // Check note about get_journal_entry_analysis
      expect(result.note).to.include('get_journal_entry_analysis');
      
      // Verify analytical fields are NOT present (moved to detailed analysis tool)
      expect(result.shortTitle).to.be.undefined;
      expect(result.summary).to.be.undefined;
      expect(result.longSummary).to.be.undefined;
      expect(result.sentiment).to.be.undefined;
      expect(result.keyMomentScore).to.be.undefined;
      expect(result.effectiveStrategiesScore).to.be.undefined;
      expect(result.identifiedChallenges).to.be.undefined;
      expect(result.notableSuccesses).to.be.undefined;
    });

    it('should handle journal entry not found', async function() {
      const session = sessionManager.getSession(sessionId);
      
      const result = await getJournalEntryTool.execute(
        { journalEntryId: 'nonexistent_entry_id' }, 
        session
      );

      expect(result).to.be.an('object');
      expect(result.error).to.equal('Journal entry not found');
    });

    it('should fail when no child is selected', async function() {
      const newSessionId = sessionManager.createSession('test-user-2');
      const session = sessionManager.getSession(newSessionId);
      
      try {
        await getJournalEntryTool.execute(
          { journalEntryId: testJournalEntryId }, 
          session
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('No child selected');
      }
    });
  });

  describe('GetJournalDetailsTool', function() {
    it('should retrieve detailed journal analysis', async function() {
      const session = sessionManager.getSession(sessionId);
      
      const result = await getJournalDetailsTool.execute(
        { journalEntryId: testJournalEntryId }, 
        session
      );

      expect(result).to.be.an('object');
      expect(result.error).to.be.undefined;
      
      // Check basic info
      expect(result.childName).to.be.a('string');
      expect(result.journalEntryId).to.equal(testJournalEntryId);
      expect(result.date).to.be.a('string');
      
      // Check professional analysis
      expect(result.professionalAnalysis).to.be.an('object');
      expect(result.professionalAnalysis.bcbaAnalysis).to.be.a('string');
      expect(result.professionalAnalysis.caregiverHypotheses).to.be.an('array');
      
      // Check detailed behavior scores
      expect(result.behaviorScoresDetailed).to.be.an('object');
      expect(result.behaviorScoresDetailed.perGoal).to.be.an('array');
      if (result.behaviorScoresDetailed.perGoal.length > 0) {
        const goalScore = result.behaviorScoresDetailed.perGoal[0];
        expect(goalScore.goalName).to.be.a('string');
        expect(goalScore.reasoning).to.be.a('string');
      }
      
      // Check child profile
      expect(result.childProfile).to.be.an('object');
      expect(result.childProfile.likes).to.be.an('array');
      expect(result.childProfile.dislikes).to.be.an('array');
      expect(result.childProfile.strengths).to.be.an('array');
      expect(result.childProfile.struggles).to.be.an('array');
      expect(result.childProfile.memoryFacts).to.be.an('array');
      
      // Check detailed hashtags
      expect(result.hashtagsDetailed).to.be.an('array');
      if (result.hashtagsDetailed.length > 0) {
        const hashtag = result.hashtagsDetailed[0];
        expect(hashtag.tag).to.be.a('string');
        expect(hashtag.type).to.be.a('string');
        expect(hashtag.confidence).to.be.a('number');
        expect(hashtag.impact).to.be.a('number');
        expect(hashtag.occurrences).to.be.a('number');
        expect(hashtag.intensity).to.be.a('number');
        expect(hashtag.prominence).to.be.a('number');
      }
      
      // Check detailed scores
      expect(result.detailedScores).to.be.an('object');
      expect(result.detailedScores.sentiment).to.be.a('number');
      expect(result.detailedScores.detailScore).to.be.a('number');
      expect(result.detailedScores.keyMomentScore).to.be.a('number');
      expect(result.detailedScores.dayCompleteness).to.be.a('number');
      
      // Check empathy response (string, could be empty)
      expect(result.empathyResponse).to.be.a('string');
      
      // Check product feedback (string, could be empty)  
      expect(result.productFeedback).to.be.a('string');
    });

    it('should handle journal entry not found', async function() {
      const session = sessionManager.getSession(sessionId);
      
      const result = await getJournalDetailsTool.execute(
        { journalEntryId: 'nonexistent_entry_id' }, 
        session
      );

      expect(result).to.be.an('object');
      expect(result.error).to.equal('Journal entry not found');
    });

    it('should fail when no child is selected', async function() {
      const newSessionId = sessionManager.createSession('test-user-3');
      const session = sessionManager.getSession(newSessionId);
      
      try {
        await getJournalDetailsTool.execute(
          { journalEntryId: testJournalEntryId }, 
          session
        );
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('No child selected');
      }
    });
  });

  describe('Journal Entry Tools Integration', function() {
    it('should work together - core then details for same entry', async function() {
      const session = sessionManager.getSession(sessionId);
      
      // Get core info
      const coreResult = await getJournalEntryTool.execute(
        { journalEntryId: testJournalEntryId }, 
        session
      );
      
      // Get detailed info
      const detailedResult = await getJournalDetailsTool.execute(
        { journalEntryId: testJournalEntryId }, 
        session
      );
      
      // Both should succeed
      expect(coreResult.error).to.be.undefined;
      expect(detailedResult.error).to.be.undefined;
      
      // Should have same basic identifiers
      expect(coreResult.journalEntryId).to.equal(detailedResult.journalEntryId);
      expect(coreResult.date).to.equal(detailedResult.date);
      expect(coreResult.childName).to.equal(detailedResult.childName);
      
      // Should have different data (non-overlapping)
      expect(coreResult.fullText).to.exist;
      expect(detailedResult.fullText).to.be.undefined;
      
      expect(detailedResult.professionalAnalysis).to.exist;
      expect(coreResult.professionalAnalysis).to.be.undefined;
    });
  });
});
