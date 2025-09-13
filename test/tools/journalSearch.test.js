import { expect } from 'chai';
import { VMApiClient } from '../../src/clients/vmApiClient.js';
import { SessionManager } from '../../src/session/sessionManager.js';
import { SearchJournalsTool } from '../../src/tools/journal/searchJournals.js';
import { transformJournalSearchResults } from '../../src/transformers/journalData.js';

describe('Journal Search Tool', function() {
  
  // Unit tests for transformer
  describe('Journal Search Results Transformer', function() {
    it('should include daysAgo field in transformed results', function() {
      const today = new Date();
      const threeDaysAgo = new Date(today.getTime() - (3 * 24 * 60 * 60 * 1000));
      const mockApiResponse = {
        results: [
          {
            document: {
              journalEntryId: 'test-entry-1',
              date: threeDaysAgo.toISOString().split('T')[0], // YYYY-MM-DD format
              userName: 'Test User',
              results: {
                shortTitle: 'Test Entry Title'
              }
            },
            searchMetadata: {
              rawSnippet: 'Test matching content',
              searchScore: 0.85
            }
          },
          {
            document: {
              journalEntryId: 'test-entry-2', 
              date: today.toISOString().split('T')[0], // Today
              userName: 'Test User',
              results: {
                shortTitle: 'Another Test Entry'
              }
            },
            searchMetadata: {
              rawSnippet: 'More test content',
              searchScore: 0.75
            }
          }
        ],
        pagination: { total: 2 }
      };

      const result = transformJournalSearchResults(mockApiResponse, 'Test Child');
      
      expect(result.results).to.have.length(2);
      expect(result.results[0]).to.have.property('daysAgo');
      expect(result.results[0].daysAgo).to.be.oneOf([2, 3]); // Allow for timezone differences
      expect(result.results[1]).to.have.property('daysAgo');
      expect(result.results[1].daysAgo).to.equal(0);
      
      // Verify other expected fields are still present
      expect(result.results[0]).to.have.property('journalEntryId');
      expect(result.results[0]).to.have.property('date');
      expect(result.results[0]).to.have.property('authorName');
      expect(result.results[0]).to.have.property('summary');
      expect(result.results[0]).to.have.property('matchingChunk');
      expect(result.results[0]).to.have.property('relevanceScore');
    });

    it('should handle null daysAgo for invalid dates', function() {
      const mockApiResponse = {
        results: [{
          document: {
            journalEntryId: 'test-entry',
            date: null, // Invalid date
            userName: 'Test User',
            results: { shortTitle: 'Test Entry' }
          },
          searchMetadata: {
            rawSnippet: 'Test content',
            searchScore: 0.75
          }
        }],
        pagination: { total: 1 }
      };

      const result = transformJournalSearchResults(mockApiResponse, 'Test Child');
      
      expect(result.results[0].daysAgo).to.be.null;
    });

    it('should include all scoring fields when scores are high', function() {
      const mockApiResponse = {
        results: [{
          document: {
            journalEntryId: 'test-entry-high-scores',
            date: '2025-04-07',
            userName: 'Test User',
            results: {
              shortTitle: 'High scoring entry',
              detailScore: 0.85,
              keyMomentScore: 0.78,
              crisisIntensityScore: 0.82,
              effectiveStrategiesScore: 0.89
            }
          },
          searchMetadata: {
            rawSnippet: 'Test content with high scores',
            searchScore: 0.95
          }
        }],
        pagination: { total: 1 }
      };

      const result = transformJournalSearchResults(mockApiResponse, 'Test Child');
      const entry = result.results[0];
      
      expect(entry.detailLevel).to.equal('High detail (0.85/1.0)');
      expect(entry.momentSignificance).to.equal('Major key moment (0.78/1.0)');
      expect(entry.crisisLevel).to.equal('Crisis situation (0.82/1.0)');
      expect(entry.effectiveStrategies).to.equal('Highly effective strategies (0.89/1.0)');
    });

    it('should only include detailLevel when conditional scores are below threshold', function() {
      const mockApiResponse = {
        results: [{
          document: {
            journalEntryId: 'test-entry-low-scores',
            date: '2025-04-07',
            userName: 'Test User',
            results: {
              shortTitle: 'Low scoring entry',
              detailScore: 0.45,
              keyMomentScore: 0.35,
              crisisIntensityScore: 0.25,
              effectiveStrategiesScore: 0.40
            }
          },
          searchMetadata: {
            rawSnippet: 'Test content with low scores',
            searchScore: 0.65
          }
        }],
        pagination: { total: 1 }
      };

      const result = transformJournalSearchResults(mockApiResponse, 'Test Child');
      const entry = result.results[0];
      
      expect(entry.detailLevel).to.equal('Moderate detail (0.45/1.0)');
      expect(entry.momentSignificance).to.be.undefined;
      expect(entry.crisisLevel).to.be.undefined;
      expect(entry.effectiveStrategies).to.be.undefined;
    });

    it('should handle mixed scoring thresholds correctly', function() {
      const mockApiResponse = {
        results: [{
          document: {
            journalEntryId: 'test-entry-mixed-scores',
            date: '2025-04-07',
            userName: 'Test User',
            results: {
              shortTitle: 'Mixed scoring entry',
              detailScore: 0.68,
              keyMomentScore: 0.65, // Above threshold
              crisisIntensityScore: 0.45, // Below threshold
              effectiveStrategiesScore: 0.75 // Above threshold
            }
          },
          searchMetadata: {
            rawSnippet: 'Test content with mixed scores',
            searchScore: 0.75
          }
        }],
        pagination: { total: 1 }
      };

      const result = transformJournalSearchResults(mockApiResponse, 'Test Child');
      const entry = result.results[0];
      
      expect(entry.detailLevel).to.equal('Moderate detail (0.68/1.0)');
      expect(entry.momentSignificance).to.equal('Notable key moment (0.65/1.0)');
      expect(entry.crisisLevel).to.be.undefined; // Below 0.55 threshold
      expect(entry.effectiveStrategies).to.equal('Highly effective strategies (0.75/1.0)');
    });

    it('should handle missing or null score fields gracefully', function() {
      const mockApiResponse = {
        results: [{
          document: {
            journalEntryId: 'test-entry-missing-scores',
            date: '2025-04-07',
            userName: 'Test User',
            results: {
              shortTitle: 'Entry with missing scores',
              detailScore: null,
              // Other scores missing entirely
            }
          },
          searchMetadata: {
            rawSnippet: 'Test content with missing scores',
            searchScore: 0.65
          }
        }],
        pagination: { total: 1 }
      };

      const result = transformJournalSearchResults(mockApiResponse, 'Test Child');
      const entry = result.results[0];
      
      expect(entry.detailLevel).to.be.undefined;
      expect(entry.momentSignificance).to.be.undefined;
      expect(entry.crisisLevel).to.be.undefined;
      expect(entry.effectiveStrategies).to.be.undefined;
    });
  });
  
  // Integration tests (real API - journal search already API-based)
  describe('API Integration', function() {
    this.timeout(30000);
    let sessionManager;
    let searchTool;
    let sessionId;
    let apiClient;
    
    before(function() {
      if (!process.env.VM_MCP_TOKEN) {
        throw new Error('VM_MCP_TOKEN environment variable is required for integration tests');
      }
      if (!process.env.VM_API_BASE_URL) {
        throw new Error('VM_API_BASE_URL environment variable is required for integration tests');
      }
      
      sessionManager = new SessionManager();
    
    // API configuration for tests - will use default token behavior (MCP token preferred)
    const apiOptions = {};
      apiClient = new VMApiClient();
      searchTool = new SearchJournalsTool(sessionManager, apiOptions);
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
