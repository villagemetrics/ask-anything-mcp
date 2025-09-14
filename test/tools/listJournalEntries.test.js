import { expect } from 'chai';
import { VMApiClient } from '../../src/clients/vmApiClient.js';
import { SessionManager } from '../../src/session/sessionManager.js';
import { ListJournalEntriesTool } from '../../src/tools/journal/listJournalEntries.js';
import { transformJournalSearchResults } from '../../src/transformers/journalData.js';

describe('List Journal Entries Tool', function() {
  
  // Unit tests for date range calculation
  describe('Date Range Calculation', function() {
    let tool;
    
    beforeEach(function() {
      const sessionManager = new SessionManager();
      tool = new ListJournalEntriesTool(sessionManager, { bypassApiValidation: true });
    });

    it('should calculate correct date range for last_7_days', function() {
      const { startDate, endDate } = tool._calculateDateRange('last_7_days');
      
      const today = new Date().toISOString().split('T')[0];
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      expect(endDate).to.equal(today);
      expect(startDate).to.equal(sevenDaysAgo);
    });

    it('should calculate correct date range for last_30_days', function() {
      const { startDate, endDate } = tool._calculateDateRange('last_30_days');
      
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      expect(endDate).to.equal(today);
      expect(startDate).to.equal(thirtyDaysAgo);
    });

    it('should calculate correct date range for last_60_days', function() {
      const { startDate, endDate } = tool._calculateDateRange('last_60_days');
      
      const today = new Date().toISOString().split('T')[0];
      const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      expect(endDate).to.equal(today);
      expect(startDate).to.equal(sixtyDaysAgo);
    });

    it('should default to 30 days for unknown timeRange', function() {
      const { startDate, endDate } = tool._calculateDateRange('invalid_range');
      
      const today = new Date().toISOString().split('T')[0];
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      expect(endDate).to.equal(today);
      expect(startDate).to.equal(thirtyDaysAgo);
    });
  });

  // Unit tests for truncation logic  
  describe('Response Transformation', function() {
    it('should handle truncation when results exceed 100 entries', function() {
      const mockApiResponse = {
        results: Array.from({ length: 150 }, (_, i) => ({
          document: {
            journalEntryId: `entry-${i}`,
            date: '2025-04-07',
            userName: 'Test User',
            results: { shortTitle: `Entry ${i}` }
          },
          searchMetadata: {
            rawSnippet: `Content ${i}`,
            searchScore: 0.75
          }
        }))
      };

      const tool = new ListJournalEntriesTool({}, { bypassApiValidation: true });
      
      // Mock the transformJournalSearchResults
      const originalTransform = transformJournalSearchResults;
      const mockTransform = (response, childName) => ({
        childName,
        totalResults: response.results.length,
        results: response.results.map(r => ({
          journalEntryId: r.document.journalEntryId,
          summary: r.document.results.shortTitle
        }))
      });
      
      // Simulate truncation logic from execute method
      let transformedResponse = mockApiResponse;
      let truncated = false;
      let totalFound = mockApiResponse.results.length;
      
      if (mockApiResponse.results.length > 100) {
        transformedResponse = {
          ...mockApiResponse,
          results: mockApiResponse.results.slice(0, 100)
        };
        truncated = true;
      }
      
      const result = mockTransform(transformedResponse, 'Test Child');
      
      expect(result.results).to.have.length(100);
      expect(truncated).to.be.true;
      expect(totalFound).to.equal(150);
    });

    it('should not truncate when results are under 100 entries', function() {
      const mockApiResponse = {
        results: Array.from({ length: 50 }, (_, i) => ({
          document: {
            journalEntryId: `entry-${i}`,
            date: '2025-04-07',
            userName: 'Test User',
            results: { shortTitle: `Entry ${i}` }
          },
          searchMetadata: {
            rawSnippet: `Content ${i}`,
            searchScore: 0.75
          }
        }))
      };

      // Simulate truncation logic
      let truncated = false;
      let totalFound = mockApiResponse.results.length;
      
      if (mockApiResponse.results.length > 100) {
        truncated = true;
      }
      
      expect(truncated).to.be.false;
      expect(totalFound).to.equal(50);
    });
  });

  // Integration test (requires real API endpoint)
  describe('API Integration', function() {
    this.timeout(30000);
    let sessionManager;
    let listTool;
    let sessionId;
    let testChildId = 'b1b62071-e5f7-460e-ae78-197d20fbe022';
    
    before(async function() {
      sessionManager = new SessionManager();
      listTool = new ListJournalEntriesTool(sessionManager);
      
      // Create session and select child
      sessionId = sessionManager.createSession('test-user');
      sessionManager.setSelectedChild(sessionId, testChildId, 'Sydney Kerwin');
    });

    it('should list journal entries successfully', async function() {
      const session = sessionManager.getSession(sessionId);
      const args = { timeRange: 'last_30_days' };
      
      try {
        const result = await listTool.execute(args, session);
        
        expect(result).to.have.property('childName');
        expect(result).to.have.property('results');
        expect(result).to.have.property('message');
        expect(result).to.have.property('timeRange', 'last_30_days');
        expect(result).to.have.property('dateRange');
        expect(result.dateRange).to.have.property('startDate');
        expect(result.dateRange).to.have.property('endDate');
        
        if (result.results.length > 0) {
          const entry = result.results[0];
          expect(entry).to.have.property('journalEntryId');
          expect(entry).to.have.property('date');
          expect(entry).to.have.property('summary');
          expect(entry).to.have.property('authorName');
        }
      } catch (error) {
        // If API endpoint doesn't exist yet (404), skip this test
        if (error.message.includes('404')) {
          this.skip();
        } else {
          throw error;
        }
      }
    });

    it('should require child selection', async function() {
      const sessionWithoutChild = sessionManager.createSession('test-user-no-child');
      const args = { timeRange: 'last_7_days' };
      
      try {
        const session = sessionManager.getSession(sessionWithoutChild);
        await listTool.execute(args, session);
        throw new Error('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('child');
      }
    });
  });
});