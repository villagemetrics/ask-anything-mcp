import assert from 'node:assert/strict';
import { VMApiClient } from '../src/clients/vmApiClient.js';
import { withRemoteCall } from '../src/lib/remoteCalls.js';
// Transport-failure injection complements the real HTTPS usage integration in API.
const context = () => {
  const controller = new AbortController();
  return { deadlineEpochMs: Date.now() + 60000, cancellationId: '00000000-0000-4000-8000-000000000001', signal: controller.signal,
    cancel(code) { controller.abort(Object.assign(new Error('Remote call ended'), { code, retryable: true, settlement: 'unknown' })); },
    check() { if (controller.signal.aborted) throw controller.signal.reason; },
    run(work) { this.check(); return work(); }
  };
};
describe('Remote HTTP error accounting', () => {
  const row = { model: 'amazon.titan-embed-text-v2:0', costUsd: 0.00001, stage: 'embedding' };
  it('preserves paid usage on typed cancellation and ordinary API failures', async () => {
    for (const code of ['DEADLINE_EXCEEDED', 'SEARCH_ERROR']) {
      const api = new VMApiClient({ tokenType: 'mcp', mcpToken: 'synthetic-not-a-token' });
      api.client.defaults.adapter = async config => { throw Object.assign(new Error('HTTP failure'), { config, response: { status: 504, data: { code, providerUsage: [row], usageIncomplete: true } } }); };
      await assert.rejects(withRemoteCall(context(), () => api.searchJournals('synthetic', 'synthetic')), error => {
        assert.deepEqual(error.providerUsage, [row]);
        if (code === 'DEADLINE_EXCEEDED') { assert.equal(error.code, code); assert.equal(error.retryable, true); assert.equal(error.settlement, 'unknown'); }
        return true;
      });
    }
  });
  it('maps a shorter transport timeout to a retryable unknown outcome', async () => {
    const api = new VMApiClient({ tokenType: 'mcp', mcpToken: 'synthetic-not-a-token' });
    api.client.defaults.adapter = async config => { throw Object.assign(new Error('timeout'), { config, code: 'ECONNABORTED' }); };
    await assert.rejects(withRemoteCall(context(), () => api.searchJournals('synthetic', 'synthetic')), error => error.code === 'DEADLINE_EXCEEDED' && error.retryable && error.settlement === 'unknown');
  });
});
