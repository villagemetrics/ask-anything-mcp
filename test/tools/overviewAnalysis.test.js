import { expect } from 'chai';
import { SessionManager } from '../../src/session/sessionManager.js';
import { GetOverviewAnalysisTool } from '../../src/tools/analysis/getOverviewAnalysis.js';
import { ListChildrenTool } from '../../src/tools/session/listChildren.js';
import { SelectChildTool } from '../../src/tools/session/selectChild.js';

describe('Overview Analysis Tool', function() {
  let sessionManager;
  let overviewAnalysisTool;
  let listChildrenTool;
  let selectChildTool;
  let testSessionId;

  beforeEach(function() {
    sessionManager = new SessionManager();
    overviewAnalysisTool = new GetOverviewAnalysisTool(sessionManager);
    listChildrenTool = new ListChildrenTool(sessionManager);
    selectChildTool = new SelectChildTool(sessionManager);
    
    // Create a test session
    testSessionId = sessionManager.createSession('test-user');
  });

  it('should require child selection before getting overview analysis', async function() {
    const session = { sessionId: testSessionId, userId: 'test-user' };
    
    try {
      await overviewAnalysisTool.execute({ timeRange: 'last_30_days' }, session);
      expect.fail('Should have thrown error for no child selected');
    } catch (error) {
      expect(error.message).to.contain('No child selected');
    }
  });

  it('should validate time range parameter', async function() {
    const session = { sessionId: testSessionId, userId: 'test-user' };
    
    // First select a child
    const childrenResult = await listChildrenTool.execute({}, session);
    if (childrenResult.children && childrenResult.children.length > 0) {
      const child = childrenResult.children[0];
      await selectChildTool.execute({ 
        childId: child.childId,
        childName: child.preferredName || child.fullName
      }, session);
    }

    try {
      await overviewAnalysisTool.execute({ timeRange: 'invalid_range' }, session);
      expect.fail('Should have thrown error for invalid time range');
    } catch (error) {
      expect(error.message).to.contain('Invalid time range');
    }
  });

  // Integration tests (real API)
  describe('API Integration', function() {
    this.timeout(30000);

    it('should successfully get overview analysis for selected child', async function() {
      const session = { sessionId: testSessionId, userId: 'test-user' };
      
      // First select a child
      const childrenResult = await listChildrenTool.execute({}, session);
      if (childrenResult.children && childrenResult.children.length > 0) {
        const child = childrenResult.children[0];
        await selectChildTool.execute({ 
          childId: child.childId,
          childName: child.preferredName || child.fullName
        }, session);

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

    it('should handle missing data gracefully', async function() {
      const session = { sessionId: testSessionId, userId: 'test-user' };
      
      // First select a child
      const childrenResult = await listChildrenTool.execute({}, session);
      if (childrenResult.children && childrenResult.children.length > 0) {
        const child = childrenResult.children[0];
        await selectChildTool.execute({ 
          childId: child.childId,
          childName: child.preferredName || child.fullName
        }, session);

        const result = await overviewAnalysisTool.execute({
          timeRange: 'last_7_days'
        }, session);

        expect(result.timeRange).to.equal('last_7_days');
        expect(result.childName).to.exist;
        
        // Should handle cases where no data exists
        if (result.message) {
          expect(result.message).to.contain('No overview analysis data');
        }
      }
    });
  });
});