import { expect } from 'chai';
import { transformBehaviorData } from '../../src/transformers/behaviorData.js';
import { VMApiClient } from '../../src/clients/vmApiClient.js';

describe('Behavior Scores Tool', function() {
  
  // Unit tests for transformer (mocked data)
  describe('Data Transformation', function() {
    it('should transform API response correctly', function() {
      const rawApiData = {
        date: '2025-08-30',
        goals: [
          { name: 'Maintained Safety', value: 3 },
          { name: 'Followed Directions', value: 2 },
          { name: 'Stayed Calm', value: 4 }
        ],
        journalEntries: [
          { content: 'Had a good day today with some challenges...' }
        ],
        trackingComplete: true
      };

      const result = transformBehaviorData(rawApiData, 'Sydney');

      expect(result.individualBehaviorGoalScores).to.deep.equal({
        'Maintained Safety': 3,
        'Followed Directions': 2, 
        'Stayed Calm': 4
      });
      expect(result.averageBehaviorScoreAcrossAllGoals).to.equal(3);
      expect(result.journalEntriesThisDate).to.equal(1);
    });

    it('should handle no goals gracefully', function() {
      const rawApiData = {
        date: '2025-08-30',
        goals: [],
        journalEntries: [],
        trackingComplete: false
      };

      const result = transformBehaviorData(rawApiData, 'Sydney');
      
      expect(result.individualBehaviorGoalScores).to.deep.equal({});
      expect(result.averageBehaviorScoreAcrossAllGoals).to.be.null;
    });
  });

  // Integration tests (real API - requires token)
  describe('API Integration', function() {
    this.timeout(30000);
    
    before(function() {
      if (!process.env.VM_MCP_TOKEN) {
        throw new Error('VM_MCP_TOKEN environment variable is required for integration tests');
      }
      if (!process.env.VM_API_BASE_URL) {
        throw new Error('VM_API_BASE_URL environment variable is required for integration tests');
      }
    });

    it('should retrieve real behavior data', async function() {
      const apiClient = new VMApiClient();
      const children = await apiClient.getChildren('test-user');
      
      if (children.length === 0) {
        throw new Error('No children found for this user - cannot test behavior scores');
      }
      
      const testChildId = children[0].childId;
      const testDate = '2025-08-30';
      
      const behaviorData = await apiClient.getBehaviorData(testChildId, testDate);
      
      if (behaviorData) {
        expect(behaviorData).to.have.property('goals');
        expect(behaviorData.goals).to.be.an('array');
        
        // Test the full transformation
        const transformed = transformBehaviorData(behaviorData, children[0].preferredName);
        expect(transformed).to.have.property('individualBehaviorGoalScores');
        expect(transformed).to.have.property('averageBehaviorScoreAcrossAllGoals');
      }
    });
  });
});
