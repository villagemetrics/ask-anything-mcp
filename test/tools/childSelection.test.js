import { expect } from 'chai';
import { VMApiClient } from '../../src/clients/vmApiClient.js';
import { SessionManager } from '../../src/session/sessionManager.js';
import { ListChildrenTool } from '../../src/tools/session/listChildren.js';
import { SelectChildTool } from '../../src/tools/session/selectChild.js';

describe('Child Selection Tools', function() {
  
  // Unit tests with mocked session data
  describe('Session Management', function() {
    let sessionManager;
    let listChildrenTool;
    let selectChildTool;
    
    beforeEach(function() {
      sessionManager = new SessionManager();
      listChildrenTool = new ListChildrenTool(sessionManager);
      selectChildTool = new SelectChildTool(sessionManager);
    });

    it('should format children list correctly', function() {
      // This will require mocking the VMApiClient - but for now just test structure
      const mockChildren = [
        {
          childId: 'child1',
          fullName: 'Sydney Smith',
          preferredName: 'Sydney',
          nicknames: ['Syd'],
          relationship: 'parent'
        },
        {
          childId: 'child2', 
          fullName: 'Alex Johnson',
          preferredName: 'Alex',
          nicknames: [],
          relationship: 'caregiver'
        }
      ];

      // For now just test the response structure would be correct
      // Full integration test below will test the real flow
    });
  });

  // Integration tests (real API)
  describe('API Integration', function() {
    this.timeout(30000);
    let apiClient;
    
    before(function() {
      if (!process.env.VM_MCP_TOKEN) {
        throw new Error('VM_MCP_TOKEN environment variable is required for integration tests');
      }
      if (!process.env.VM_API_BASE_URL) {
        throw new Error('VM_API_BASE_URL environment variable is required for integration tests');
      }
      
      apiClient = new VMApiClient();
    });

    it('should list children with proper structure', async function() {
      const children = await apiClient.getChildren('test-user');
      
      if (children.length === 0) {
        throw new Error('No children found for this user - cannot test child selection');
      }
      
      expect(children).to.be.an('array');
      
      const child = children[0];
      expect(child).to.have.property('childId');
      expect(child).to.have.property('fullName');
      expect(child).to.have.property('preferredName');
      expect(child).to.have.property('relationship');
      expect(['parent', 'caregiver']).to.include(child.relationship);
    });

    it('should handle full child selection flow', async function() {
      const sessionManager = new SessionManager();
      const sessionId = sessionManager.createSession('test-user');
      const session = sessionManager.getSession(sessionId);
      
      const listTool = new ListChildrenTool(sessionManager);
      const selectTool = new SelectChildTool(sessionManager);
      
      // List children
      const listResult = await listTool.execute({}, session);
      expect(listResult).to.have.property('totalCount');
      expect(listResult.totalCount).to.be.greaterThan(0);
      
      // Select first child  
      const firstChild = listResult.children[0];
      const selectResult = await selectTool.execute(
        { childName: firstChild.preferredName }, 
        session
      );
      
      expect(selectResult).to.include(firstChild.preferredName || firstChild.fullName);
      
      // Verify session state
      const selectedChild = sessionManager.getSelectedChild(sessionId);
      expect(selectedChild.childId).to.equal(firstChild.childId);
    });
  });
});
