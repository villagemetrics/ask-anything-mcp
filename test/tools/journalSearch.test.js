import { expect } from 'chai';
import { VMApiClient } from '../../src/clients/vmApiClient.js';
import { SessionManager } from '../../src/session/sessionManager.js';
import { SearchJournalsTool } from '../../src/tools/journal/searchJournals.js';

describe('Journal Search Tool', function() {
  
  // Integration tests (real API - journal search already API-based)
  describe('API Integration', function() {
    this.timeout(30000);
    let sessionManager;
    let searchTool;
    let sessionId;
    let apiClient;
    
    before(function() {
      if (!process.env.VM_API_TOKEN) {
        throw new Error('VM_API_TOKEN environment variable is required for integration tests');
      }
      if (!process.env.VM_API_BASE_URL) {
        throw new Error('VM_API_BASE_URL environment variable is required for integration tests');
      }
      
      sessionManager = new SessionManager();
      apiClient = new VMApiClient();
      searchTool = new SearchJournalsTool(sessionManager);
    });

    beforeEach(async function() {
      // Set up session with selected child
      const children = await apiClient.getChildren('test-user');
      if (children.length === 0) {
        throw new Error('No children found for this user - cannot test journal search');
      }
      
      sessionId = sessionManager.createSession('test-user');
      sessionManager.setSelectedChild(sessionId, children[0].childId, children[0].fullName);
    });

    it('should search journals and return structured results', async function() {
      const session = sessionManager.getSession(sessionId);
      const searchQuery = 'behavior challenges';
      
      const result = await searchTool.execute({ query: searchQuery }, session);
      
      expect(result).to.have.property('message');
      expect(result).to.have.property('results');
      expect(result).to.have.property('pagination');
      expect(result).to.have.property('childName');
      
      // Results can be empty or have data - both are valid
      expect(result.results).to.be.an('array');
      expect(result.pagination).to.have.property('total');
    });

    it('should handle empty search results gracefully', async function() {
      const session = sessionManager.getSession(sessionId);
      const searchQuery = 'extremely unlikely search term xyz123';
      
      const result = await searchTool.execute({ query: searchQuery }, session);
      
      expect(result).to.have.property('message');
      expect(result.results).to.be.an('array');
      expect(result.results).to.have.length(0);
    });

    it('should require child selection', async function() {
      // Create session without selecting a child
      const emptySessionId = sessionManager.createSession('test-user');
      const emptySession = sessionManager.getSession(emptySessionId);
      
      try {
        await searchTool.execute({ query: 'test' }, emptySession);
        expect.fail('Should have thrown error for no selected child');
      } catch (error) {
        expect(error.message).to.include('No child selected');
      }
    });

    it('should handle pagination parameters correctly', async function() {
      const session = sessionManager.getSession(sessionId);
      
      // Test with limit
      const result = await searchTool.execute({ 
        query: 'silly',
        limit: 3,
        offset: 0
      }, session);
      
      expect(result.pagination).to.have.property('limit');
      expect(result.pagination).to.have.property('total');
      expect(result.pagination).to.have.property('offset');
      expect(result.pagination).to.have.property('hasMore');
      
      // If there are results, check limit is respected
      if (result.results.length > 0) {
        expect(result.results.length).to.be.at.most(3);
      }
    });

    it('should handle pagination offset correctly', async function() {
      const session = sessionManager.getSession(sessionId);
      
      // Get first page
      const firstPage = await searchTool.execute({ 
        query: 'behavior',
        limit: 2,
        offset: 0
      }, session);
      
      // If we have enough results for a second page, test it
      if (firstPage.pagination.hasMore) {
        const secondPage = await searchTool.execute({ 
          query: 'behavior',
          limit: 2,
          offset: firstPage.pagination.nextOffset
        }, session);
        
        expect(secondPage.pagination.offset).to.equal(firstPage.pagination.nextOffset);
        expect(secondPage.results).to.be.an('array');
        
        // Results should be different (different offset)
        if (firstPage.results.length > 0 && secondPage.results.length > 0) {
          expect(secondPage.results[0].journalEntryId).to.not.equal(firstPage.results[0].journalEntryId);
        }
      }
    });
  });
});
