import { expect } from 'chai';
import { ToolRegistry } from '../../src/tools/registry.js';
import { SessionManager } from '../../src/session/sessionManager.js';

describe('Tool Registry', function() {
  let sessionManager;
  
  beforeEach(function() {
    sessionManager = new SessionManager();
  });

  describe('Tool Registration', function() {
    it('should include select_child tool by default', function() {
      const registry = new ToolRegistry(sessionManager, null, {}, {});
      const tools = registry.getToolDefinitions();
      
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).to.include('select_child');
      expect(toolNames).to.include('list_children');
    });

    it('should exclude select_child tool when child switching is disabled', function() {
      const mcpOptions = { allowChildSwitching: false };
      const registry = new ToolRegistry(sessionManager, null, {}, mcpOptions);
      const tools = registry.getToolDefinitions();
      
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).to.not.include('select_child');
      expect(toolNames).to.include('list_children'); // Should still be available
    });

    it('should include select_child tool when child switching is explicitly enabled', function() {
      const mcpOptions = { allowChildSwitching: true };
      const registry = new ToolRegistry(sessionManager, null, {}, mcpOptions);
      const tools = registry.getToolDefinitions();
      
      const toolNames = tools.map(tool => tool.name);
      expect(toolNames).to.include('select_child');
      expect(toolNames).to.include('list_children');
    });

    it('should include all other expected tools regardless of child switching setting', function() {
      const mcpOptions = { allowChildSwitching: false };
      const registry = new ToolRegistry(sessionManager, null, {}, mcpOptions);
      const tools = registry.getToolDefinitions();
      
      const toolNames = tools.map(tool => tool.name);
      
      // Core tools should always be available
      expect(toolNames).to.include('list_children');
      expect(toolNames).to.include('get_behavior_scores');
      expect(toolNames).to.include('get_date_range_metadata');
      expect(toolNames).to.include('search_journal_entries');
      expect(toolNames).to.include('get_journal_entry');
      expect(toolNames).to.include('get_journal_entry_details');
      
      // Analysis tools
      expect(toolNames).to.include('get_overview_analysis');
      expect(toolNames).to.include('get_behavior_analysis');
      expect(toolNames).to.include('get_medication_analysis');
      expect(toolNames).to.include('get_journal_analysis');
      expect(toolNames).to.include('get_hashtag_analysis');
      expect(toolNames).to.include('get_medication_detailed_analysis');
    });
  });

  describe('Tool Count', function() {
    it('should have 13 tools when child switching is enabled', function() {
      const mcpOptions = { allowChildSwitching: true };
      const registry = new ToolRegistry(sessionManager, null, {}, mcpOptions);
      const tools = registry.getToolDefinitions();
      
      expect(tools).to.have.lengthOf(13);
    });

    it('should have 12 tools when child switching is disabled', function() {
      const mcpOptions = { allowChildSwitching: false };
      const registry = new ToolRegistry(sessionManager, null, {}, mcpOptions);
      const tools = registry.getToolDefinitions();
      
      expect(tools).to.have.lengthOf(12);
    });
  });
});