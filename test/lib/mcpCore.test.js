import { expect } from 'chai';
import { MCPCore } from '../../src/lib/mcpCore.js';

describe('MCPCore Library', function() {
  let mcpCore;
  
  beforeEach(function() {
    mcpCore = new MCPCore();
  });
  
  afterEach(function() {
    if (mcpCore) {
      mcpCore.cleanup();
    }
  });

  describe('Initialization', function() {
    it('should create MCPCore instance', function() {
      expect(mcpCore).to.be.instanceOf(MCPCore);
      expect(mcpCore.sessionId).to.be.null;
      expect(mcpCore.userContext).to.be.null;
    });

    it('should initialize with pre-selected child in library mode', function() {
      const testChildId = 'test-child-123';
      const userContext = {
        userId: 'test-user-123',
        userName: 'Test User'
      };
      
      const mcpCoreWithChild = new MCPCore({
        libraryMode: true,
        preSelectedChildId: testChildId,
        allowChildSwitching: false
      });
      
      expect(mcpCoreWithChild.options.preSelectedChildId).to.equal(testChildId);
      expect(mcpCoreWithChild.options.allowChildSwitching).to.be.false;
      
      const sessionId = mcpCoreWithChild.initializeWithUserContext(userContext);
      expect(sessionId).to.be.a('string');
      
      // Verify child is auto-selected in session
      const session = mcpCoreWithChild.sessionManager.getSession(sessionId);
      expect(session.selectedChildId).to.equal(testChildId);
      
      mcpCoreWithChild.cleanup();
    });

    it('should initialize with user context for internal usage', function() {
      const userContext = {
        userId: 'test-user-123',
        userName: 'Test User'
      };
      
      const sessionId = mcpCore.initializeWithUserContext(userContext);
      
      expect(sessionId).to.be.a('string');
      expect(sessionId).to.include('session_');
      expect(mcpCore.sessionId).to.equal(sessionId);
      expect(mcpCore.userContext).to.deep.equal(userContext);
    });

    it('should throw error when initializing with invalid user context', function() {
      expect(() => {
        mcpCore.initializeWithUserContext(null);
      }).to.throw('Valid user context with userId is required');

      expect(() => {
        mcpCore.initializeWithUserContext({});
      }).to.throw('Valid user context with userId is required');
    });
  });

  describe('Tool Management', function() {
    beforeEach(function() {
      const userContext = { userId: 'test-user-123' };
      mcpCore.initializeWithUserContext(userContext);
    });

    it('should get available tools', function() {
      const tools = mcpCore.getAvailableTools();
      
      expect(tools).to.be.an('array');
      expect(tools.length).to.be.greaterThan(0);
      
      // Check that each tool has required properties
      tools.forEach(tool => {
        expect(tool).to.have.property('name');
        expect(tool).to.have.property('description');
        expect(tool).to.have.property('inputSchema');
      });
      
      // Check for some expected tools
      const toolNames = tools.map(t => t.name);
      expect(toolNames).to.include('list_children');
      expect(toolNames).to.include('get_behavior_scores');
      expect(toolNames).to.include('search_journal_entries');
    });

    it('should throw error when executing tool without initialization', async function() {
      const uninitializedCore = new MCPCore();
      
      try {
        await uninitializedCore.executeTool('listChildren');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('MCP Core not initialized');
      }
    });

    it('should throw error for non-existent tool', async function() {
      try {
        await mcpCore.executeTool('nonExistentTool');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('Tool not found');
      }
    });

    it('should execute multiple tools in sequence', async function() {
      const toolCalls = [
        { name: 'listChildren', arguments: {} },
        { name: 'getBehaviorScores', arguments: { date: '2025-01-15' } }
      ];
      
      const results = await mcpCore.executeTools(toolCalls);
      
      expect(results).to.be.an('array');
      expect(results.length).to.equal(2);
      
      results.forEach((result, index) => {
        expect(result).to.have.property('toolName', toolCalls[index].name);
        expect(result).to.have.property('success');
        
        if (result.success) {
          expect(result).to.have.property('result');
        } else {
          expect(result).to.have.property('error');
        }
      });
    });

    it('should handle invalid toolCalls parameter', async function() {
      try {
        await mcpCore.executeTools('not-an-array');
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('toolCalls must be an array');
      }
    });
  });

  describe('Session Management', function() {
    beforeEach(function() {
      const userContext = { userId: 'test-user-123' };
      mcpCore.initializeWithUserContext(userContext);
    });

    it('should get session information', function() {
      const session = mcpCore.getSession();
      
      expect(session).to.be.an('object');
      expect(session).to.have.property('sessionId');
      expect(session).to.have.property('userId', 'test-user-123');
      expect(session).to.have.property('selectedChildId', null);
      expect(session).to.have.property('createdAt');
      expect(session).to.have.property('lastActivity');
    });

    it('should update session data', function() {
      const updates = { customData: 'test-value' };
      const updatedSession = mcpCore.updateSession(updates);
      
      expect(updatedSession).to.have.property('customData', 'test-value');
    });

    it('should set and get selected child', function() {
      const childId = 'child-123';
      const childName = 'Test Child';
      
      const updatedSession = mcpCore.setSelectedChild(childId, childName);
      expect(updatedSession).to.have.property('selectedChildId', childId);
      expect(updatedSession).to.have.property('selectedChildName', childName);
      
      const selectedChild = mcpCore.getSelectedChild();
      expect(selectedChild).to.deep.equal({
        childId: childId,
        childName: childName
      });
    });

    it('should throw error when getting selected child if none selected', function() {
      expect(() => {
        mcpCore.getSelectedChild();
      }).to.throw('No child selected');
    });
  });

  describe('Cleanup', function() {
    it('should clean up session data', function() {
      const userContext = { userId: 'test-user-123' };
      const sessionId = mcpCore.initializeWithUserContext(userContext);
      
      expect(mcpCore.sessionId).to.equal(sessionId);
      expect(mcpCore.userContext).to.deep.equal(userContext);
      
      mcpCore.cleanup();
      
      expect(mcpCore.sessionId).to.be.null;
      expect(mcpCore.userContext).to.be.null;
    });
  });
});