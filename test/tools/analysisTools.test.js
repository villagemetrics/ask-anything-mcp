import { expect } from 'chai';
import { SessionManager } from '../../src/session/sessionManager.js';
import { GetOverviewAnalysisTool } from '../../src/tools/analysis/getOverviewAnalysis.js';
import { GetBehaviorAnalysisTool } from '../../src/tools/analysis/getBehaviorAnalysis.js';
import { GetMedicationAnalysisTool } from '../../src/tools/analysis/getMedicationAnalysis.js';
import { GetJournalAnalysisTool } from '../../src/tools/analysis/getJournalAnalysis.js';
import { GetHashtagAnalysisTool } from '../../src/tools/analysis/getHashtagAnalysis.js';
import { GetMedicationDetailedAnalysisTool } from '../../src/tools/analysis/getMedicationDetailedAnalysis.js';
import { ListChildrenTool } from '../../src/tools/session/listChildren.js';
import { SelectChildTool } from '../../src/tools/session/selectChild.js';

describe('Analysis Tools', function() {
  let sessionManager;
  let listChildrenTool;
  let selectChildTool;
  let testSessionId;

  // Analysis tools
  let overviewAnalysisTool;
  let behaviorAnalysisTool;
  let medicationAnalysisTool;
  let medicationDetailedAnalysisTool;
  let journalAnalysisTool;
  let hashtagAnalysisTool;

  beforeEach(function() {
    sessionManager = new SessionManager();
    listChildrenTool = new ListChildrenTool(sessionManager);
    selectChildTool = new SelectChildTool(sessionManager);
    
    // Initialize all analysis tools
    overviewAnalysisTool = new GetOverviewAnalysisTool(sessionManager);
    behaviorAnalysisTool = new GetBehaviorAnalysisTool(sessionManager);
    medicationAnalysisTool = new GetMedicationAnalysisTool(sessionManager);
    medicationDetailedAnalysisTool = new GetMedicationDetailedAnalysisTool(sessionManager);
    journalAnalysisTool = new GetJournalAnalysisTool(sessionManager);
    hashtagAnalysisTool = new GetHashtagAnalysisTool(sessionManager);
    
    // Create a test session
    testSessionId = sessionManager.createSession('test-user');
  });

  describe('Tool Definitions', function() {
    it('should have correct tool definitions for all analysis tools', function() {
      const definitions = [
        GetOverviewAnalysisTool.definition,
        GetBehaviorAnalysisTool.definition,
        GetMedicationAnalysisTool.definition,
        GetMedicationDetailedAnalysisTool.definition,
        GetJournalAnalysisTool.definition,
        GetHashtagAnalysisTool.definition
      ];

      definitions.forEach(def => {
        expect(def.name).to.exist;
        expect(def.description).to.exist;
        expect(def.inputSchema).to.exist;
        
        // Different tools have different required parameters
        if (def.name === 'get_medication_detailed_analysis') {
          // Medication detailed analysis requires cocktailId, not timeRange
          expect(def.inputSchema.properties.cocktailId).to.exist;
          expect(def.inputSchema.required).to.include('cocktailId');
        } else {
          // All other analysis tools require timeRange
          expect(def.inputSchema.properties.timeRange).to.exist;
          expect(def.inputSchema.required).to.include('timeRange');
        }
        
        // Hashtag analysis also requires hashtagType
        if (def.name === 'get_hashtag_analysis') {
          expect(def.inputSchema.properties.hashtagType).to.exist;
          expect(def.inputSchema.required).to.include('hashtagType');
        }
      });
    });

    it('should have unique tool names', function() {
      const names = [
        GetOverviewAnalysisTool.definition.name,
        GetBehaviorAnalysisTool.definition.name,
        GetMedicationAnalysisTool.definition.name,
        GetMedicationDetailedAnalysisTool.definition.name,
        GetJournalAnalysisTool.definition.name,
        GetHashtagAnalysisTool.definition.name
      ];

      const uniqueNames = new Set(names);
      expect(uniqueNames.size).to.equal(names.length);
    });
  });

  describe('Input Validation', function() {
    const tools = [
      { name: 'overview', tool: null },
      { name: 'behavior', tool: null },
      { name: 'medication', tool: null },
      { name: 'medication_details', tool: null },
      { name: 'journal', tool: null },
      { name: 'hashtag', tool: null }
    ];

    beforeEach(function() {
      tools[0].tool = overviewAnalysisTool;
      tools[1].tool = behaviorAnalysisTool;
      tools[2].tool = medicationAnalysisTool;
      tools[3].tool = medicationDetailedAnalysisTool;
      tools[4].tool = journalAnalysisTool;
      tools[5].tool = hashtagAnalysisTool;
    });

    tools.forEach(({ name, tool }, index) => {
      it(`${name} analysis should require child selection`, async function() {
        const session = { sessionId: testSessionId, userId: 'test-user' };
        const currentTool = tools[index].tool;
        
        try {
          let args;
          if (name === 'medication_details') {
            args = { cocktailId: 'test-cocktail-id' };
          } else {
            args = { timeRange: 'last_30_days' };
            // Hashtag analysis requires hashtagType parameter
            if (name === 'hashtag') {
              args.hashtagType = 'BehaviorConcept';
            }
          }
          await currentTool.execute(args, session);
          expect.fail(`${name} analysis should have thrown error for no child selected`);
        } catch (error) {
          expect(error.message).to.contain('No child selected');
        }
      });

      it(`${name} analysis should validate parameters`, async function() {
        const session = { sessionId: testSessionId, userId: 'test-user' };
        const currentTool = tools[index].tool;
        
        try {
          let args;
          if (name === 'medication_details') {
            // For detailed analysis, test missing cocktailId
            args = {};
          } else {
            // For other tools, test invalid time range
            args = { timeRange: 'invalid_range' };
            // Hashtag analysis requires hashtagType parameter
            if (name === 'hashtag') {
              args.hashtagType = 'BehaviorConcept';
            }
          }
          await currentTool.execute(args, session);
          expect.fail(`${name} analysis should have thrown error for invalid parameters`);
        } catch (error) {
          if (name === 'medication_details') {
            expect(error.message).to.contain('Cocktail ID is required');
          } else {
            expect(error.message).to.contain('Invalid time range');
          }
        }
      });
    });

    it('should validate hashtag type parameter for hashtag analysis', async function() {
      const session = { sessionId: testSessionId, userId: 'test-user' };
      
      try {
        await hashtagAnalysisTool.execute({ 
          hashtagType: 'InvalidType', 
          timeRange: 'last_30_days' 
        }, session);
        expect.fail('Hashtag analysis should have thrown error for invalid hashtag type');
      } catch (error) {
        expect(error.message).to.contain('Invalid hashtag type');
      }
    });

    it('should require hashtag type parameter for hashtag analysis', async function() {
      const session = { sessionId: testSessionId, userId: 'test-user' };
      
      try {
        await hashtagAnalysisTool.execute({ 
          timeRange: 'last_30_days' 
        }, session);
        expect.fail('Hashtag analysis should have thrown error for missing hashtag type');
      } catch (error) {
        expect(error.message).to.contain('Hashtag type is required');
      }
    });
  });

  describe('API Integration', function() {
    this.timeout(30000);

    async function setupChildSelection(session) {
      const childrenResult = await listChildrenTool.execute({}, session);
      if (childrenResult.children && childrenResult.children.length > 0) {
        const child = childrenResult.children[0];
        await selectChildTool.execute({ 
          childId: child.childId,
          childName: child.preferredName || child.fullName
        }, session);
        return child;
      }
      return null;
    }

    it('should successfully get overview analysis', async function() {
      const session = { sessionId: testSessionId, userId: 'test-user' };
      const child = await setupChildSelection(session);
      
      if (child) {
        const result = await overviewAnalysisTool.execute({
          timeRange: 'last_30_days'
        }, session);

        expect(result.timeRange).to.equal('last_30_days');
        expect(result.childName).to.exist;
        
        // compressionInfo is no longer returned to LLMs (kept in debug logs only)
        expect(result.compressionInfo).to.not.exist;
      } else {
        console.log('No children available for testing - skipping overview analysis test');
      }
    });

    it('should successfully get behavior analysis', async function() {
      const session = { sessionId: testSessionId, userId: 'test-user' };
      const child = await setupChildSelection(session);
      
      if (child) {
        const result = await behaviorAnalysisTool.execute({
          timeRange: 'last_30_days'
        }, session);

        expect(result.timeRange).to.equal('last_30_days');
        expect(result.childName).to.exist;
        // behaviorGoals section was removed to avoid duplication with behaviorGoalAnalysis
        
        // compressionInfo is no longer returned to LLMs (kept in debug logs only)
        expect(result.compressionInfo).to.not.exist;
      } else {
        console.log('No children available for testing - skipping behavior analysis test');
      }
    });

    it('should successfully get medication analysis', async function() {
      const session = { sessionId: testSessionId, userId: 'test-user' };
      const child = await setupChildSelection(session);
      
      if (child) {
        const result = await medicationAnalysisTool.execute({
          timeRange: 'last_30_days'
        }, session);

        expect(result.timeRange).to.equal('last_30_days');
        expect(result.childName).to.exist;
        // Result could have medicationHistory or just a message if no data
        expect(result.message || result.medicationHistory).to.exist;
        
        // compressionInfo is no longer returned to LLMs (kept in debug logs only)
        expect(result.compressionInfo).to.not.exist;
      } else {
        console.log('No children available for testing - skipping medication analysis test');
      }
    });

    it('should successfully get medication details', async function() {
      const session = { sessionId: testSessionId, userId: 'test-user' };
      const child = await setupChildSelection(session);
      
      if (child) {
        const result = await medicationDetailedAnalysisTool.execute({
          cocktailId: 'test-cocktail-id'
        }, session);

        expect(result.cocktailId).to.equal('test-cocktail-id');
        expect(result.childName).to.exist;
        
        // The cocktail might not exist, in which case we get an error message
        if (result.message) {
          expect(result.message).to.contain('not found');
        } else {
          // Should have detailed medication information if cocktail exists
          expect(result.medications).to.exist;
          expect(result.averageBehaviorScore).to.exist;
        }
      } else {
        console.log('No children available for testing - skipping medication details test');
      }
    });

    it('should successfully get journal analysis', async function() {
      const session = { sessionId: testSessionId, userId: 'test-user' };
      const child = await setupChildSelection(session);
      
      if (child) {
        const result = await journalAnalysisTool.execute({
          timeRange: 'last_30_days'
        }, session);

        expect(result.timeRange).to.equal('last_30_days');
        expect(result.childName).to.exist;
        
        // compressionInfo is no longer returned to LLMs (kept in debug logs only)
        expect(result.compressionInfo).to.not.exist;
        // Should have journal-specific data, not hashtag data
        expect(result.hashtags).to.not.exist;
      } else {
        console.log('No children available for testing - skipping journal analysis test');
      }
    });

    it('should successfully get hashtag analysis', async function() {
      const session = { sessionId: testSessionId, userId: 'test-user' };
      const child = await setupChildSelection(session);
      
      if (child) {
        const result = await hashtagAnalysisTool.execute({
          hashtagType: 'BehaviorConcept',
          timeRange: 'last_30_days'
        }, session);

        expect(result.timeRange).to.equal('last_30_days');
        expect(result.hashtagType).to.equal('BehaviorConcept');
        expect(result.childName).to.exist;
        
        // Should have hashtag-specific data structure
        if (result.hashtagsByType && result.hashtagsByType.length > 0) {
          expect(result.hashtagsByType[0].type).to.equal('BehaviorConcept');
          expect(Array.isArray(result.hashtagsByType[0].hashtags)).to.be.true;
        }
        
        // compressionInfo is no longer returned to LLMs (kept in debug logs only)
        expect(result.compressionInfo).to.not.exist;
        // Should not have journal-specific data like keyMoments
        expect(result.keyMoments).to.not.exist;
      } else {
        console.log('No children available for testing - skipping hashtag analysis test');
      }
    });

    it('should handle different time ranges correctly', async function() {
      const session = { sessionId: testSessionId, userId: 'test-user' };
      const child = await setupChildSelection(session);
      
      if (child) {
        const timeRanges = ['last_7_days', 'last_30_days', 'last_90_days'];
        
        for (const timeRange of timeRanges) {
          const result = await overviewAnalysisTool.execute({ timeRange }, session);
          expect(result.timeRange).to.equal(timeRange);
          expect(result.childName).to.exist;
        }
      } else {
        console.log('No children available for testing - skipping time range test');
      }
    });

    it('should return consistent data structure across all tools', async function() {
      const session = { sessionId: testSessionId, userId: 'test-user' };
      const child = await setupChildSelection(session);
      
      if (child) {
        const tools = [
          overviewAnalysisTool,
          behaviorAnalysisTool,
          medicationAnalysisTool,
          medicationDetailedAnalysisTool,
          journalAnalysisTool,
          hashtagAnalysisTool
        ];

        for (const tool of tools) {
          let result;
          
          // Different tools have different parameters
          if (tool === medicationDetailedAnalysisTool) {
            result = await tool.execute({ cocktailId: 'test-cocktail-id' }, session);
            // For detailed analysis, check different properties
            expect(result.cocktailId).to.equal('test-cocktail-id');
            expect(result.childName).to.exist;
            // Could have message if cocktail not found, or actual data
            expect(result.message || result.medications).to.exist;
          } else if (tool === hashtagAnalysisTool) {
            result = await tool.execute({ hashtagType: 'Activity', timeRange: 'last_30_days' }, session);
            // Hashtag analysis should return these properties
            expect(result.timeRange).to.equal('last_30_days');
            expect(result.hashtagType).to.equal('Activity');
            expect(result.childName).to.exist;
          } else {
            result = await tool.execute({ timeRange: 'last_30_days' }, session);
            // All other tools should return these base properties
            expect(result.timeRange).to.equal('last_30_days');
            expect(result.childName).to.exist;
          }
          
          // No tool should return compressionInfo (kept in debug logs only)
          expect(result.compressionInfo).to.not.exist;
        }
      } else {
        console.log('No children available for testing - skipping consistency test');
      }
    });
  });
});