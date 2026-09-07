import assert from 'node:assert/strict';
import { VMApiClient } from '../src/clients/vmApiClient.js';
import { withRemoteCall } from '../src/lib/remoteCalls.js';
import { MCPCore, ToolRegistry, SessionManager } from '../src/lib/index.js';

describe('Closed MCP tool allowlist', () => {
  const allowed = ['search_journal_entries', 'get_journal_entry', 'get_hashtag_analysis', 'get_behavior_scores'];
  const options = { tokenType: 'mcp', mcpToken: 'synthetic-unused-token' };
  it('omits excluded instances before construction and rejects direct dispatch', async () => {
    const sessions = new SessionManager();
    const registry = new ToolRegistry(sessions, null, options, { allowedTools: allowed, allowChildSwitching: false });
    assert.deepEqual(registry.getToolDefinitions().map(t => t.name).sort(), [...allowed].sort());
    for (const name of ['listChildren','selectChild','getMedicationAnalysis','submitProductFeedback']) assert.equal(registry.toolInstances[name], undefined);
    await assert.rejects(registry.executeTool('get_medication_analysis', {}, 'unused'), e => e.code === 'TOOL_NOT_ALLOWED');
    const all = new ToolRegistry(sessions, null, options);
    for (const tool of Object.values(all.toolInstances)) {
      if (allowed.includes(tool.constructor.definition.name)) continue;
      tool.allowedTools = Object.freeze(allowed);
      await assert.rejects(tool.execute({}, {}), e => e.code === 'TOOL_NOT_ALLOWED');
    }
  });
  it('rejects raw traversal and other-child routes before HTTP dispatch', async () => {
    const client = new VMApiClient(options); let sent = 0;
    client.client.defaults.adapter = async config => { sent++; return { data: {}, status: 200, config }; };
    const call = { pinnedChildId: 'synthetic-child', check() {}, run: fn => fn(), deadlineEpochMs: Date.now()+60000 };
    for (const url of ['/v1/children/other/track-data/2026-09-05', '/v1/feed/other',
      '/v1/children/synthetic-child/journal/entries/../../../../feed/other',
      '/v1/children/synthetic-child/journal/entries/%2e%2e%2fsecret',
      '/v1/children/synthetic-child/journal/entries/%252e%252e/secret']) {
      await assert.rejects(withRemoteCall(call, () => client.client.get(url)), e => e.code === 'RESEARCH_CHILD_MISMATCH');
    }
    assert.equal(sent, 0);
    await withRemoteCall(call, () => client.client.get('/v1/children/synthetic-child/track-data/2026-09-05'));
    assert.equal(sent, 1);
  });
  it('keeps schema-only and library surfaces equal, and empty means no tools', async () => {
    const schemas = await new MCPCore({ schemaOnly: true, allowedTools: allowed }).getAvailableTools();
    const core = new MCPCore({ ...options, libraryMode: true, userId: 'synthetic-execution', childId: 'synthetic-child', childPreferredName: 'Synthetic', allowedTools: allowed, allowChildSwitching: false });
    assert.deepEqual(schemas.map(t => t.name).sort(), core.getAvailableTools().map(t => t.name).sort());
    assert.equal(new ToolRegistry(new SessionManager(), null, {}, { allowedTools: [] }).getToolDefinitions().length, 0);
    assert.throws(() => new MCPCore({ schemaOnly: true, allowedTools: null }), /allowedTools/);
  });
});
