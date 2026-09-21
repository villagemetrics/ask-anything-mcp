import assert from 'node:assert/strict';
import { SearchJournalsTool } from '../../src/tools/journal/searchJournals.js';
import { SessionManager } from '../../src/session/sessionManager.js';
import { VMApiClient } from '../../src/clients/vmApiClient.js';
import { ToolRegistry } from '../../src/tools/registry.js';
import {
  EXECUTION_CONTRACT, MAX_PROVIDER_ATTEMPTS, REJECTION_MESSAGES,
  assertForwardableEnvelope, validatePaidSearchRequest, wrapSingleProviderAttempt
} from '../../src/lib/executionContract.js';

// The wire shape and the forwarding boundary's refusals. The envelope's parity
// with the shared llm-proxy definition, and its behavior against the real API,
// are proven in api/test/strict-journal-search.test.js.
describe('Bounded proactive journal search envelope', function () {
  const strict = { q: 'synthetic history', limit: 10, offset: 0, mode: 'insight_evidence', startDate: '2024-01-01', endDate: '2024-01-02' };
  const args = { query: strict.q, mode: strict.mode, startDate: strict.startDate, endDate: strict.endDate };

  function tool({ bounded = true, response } = {}) {
    const sessions = new SessionManager();
    const sessionId = sessions.createSession('synthetic-user');
    sessions.setSelectedChild(sessionId, 'synthetic-child', 'Synthetic');
    const instance = new SearchJournalsTool(sessions, { tokenType: 'mcp', mcpToken: 'synthetic-not-a-token', boundedSearchExecution: bounded });
    if (response) instance.apiClient.searchJournals = async (childId, query, options) => response(options);
    return { instance, session: sessions.getSession(sessionId) };
  }

  const valid = (overrides = {}) => ({
    results: [{ document: { journalEntryId: 'journal_entry_00000000-0000-4000-8000-000000000001', date: '2024-01-01' } }],
    searchExecutionId: 'synthetic-execution', requestedFilter: { startDate: strict.startDate, endDate: strict.endDate },
    effectiveFilter: { startDate: strict.startDate, endDate: strict.endDate },
    retrieval: { mode: 'date_filtered_vector', dateCoverageStatus: 'complete', candidateLimit: 2000, rawCandidateCount: 1,
      truncationKnown: true, truncated: false, enrichmentFailureCount: 0, incompleteReasons: [] },
    completed: true, pagination: { exhausted: true, total: 1, limit: 10 },
    embeddingUsage: [attemptUsage()],
    providerUsage: [attemptUsage()],
    usageIncomplete: false,
    ...overrides
  });
  const attemptUsage = (overrides = {}) => ({ model: 'amazon.titan-embed-text-v2:0', region: 'us-east-1', cacheOutcome: 'bypassed',
    inputTokens: 4, outputTokens: 0, costUsd: 0.0000001, pricingAsOfDate: '2026-09-14', unpricedCallCount: 0,
    status: 'success', usageIncomplete: false, ...overrides });

  it('builds the exact three-field envelope with a cache-bypassed strict payload', function () {
    const envelope = wrapSingleProviderAttempt({ ...strict, forceBypassCache: true });
    assert.deepEqual(Object.keys(envelope).sort(), ['executionContract', 'maxProviderAttempts', 'paidRequest']);
    assert.equal(envelope.executionContract, EXECUTION_CONTRACT);
    assert.equal(envelope.maxProviderAttempts, MAX_PROVIDER_ATTEMPTS);
    assert.equal(envelope.paidRequest.forceBypassCache, true);
    // No top-level field selects an inference operation, which is exactly what
    // makes a receiver without the contract reject on its missing required `q`.
    for (const field of ['q', 'model', 'prompt', 'inputText', 'messages', 'method']) {
      assert.equal(envelope[field], undefined, field);
    }
    assert.equal(assertForwardableEnvelope(envelope), envelope);
  });

  it('refuses a paid request that could produce another provider invocation', function () {
    const cases = [
      [{ ...strict }, /forceBypassCache/],
      [{ ...strict, forceBypassCache: false }, /forceBypassCache/],
      [{ ...strict, forceBypassCache: true, maxOutputTokens: 512 }, /maxOutputTokens does not apply/],
      [{ ...strict, forceBypassCache: true, mode: 'conversational' }, /mode insight_evidence/],
      [{ ...strict, forceBypassCache: true, method: 'generate' }, /alternate inference operation/],
      [{ ...strict, forceBypassCache: true, prompt: 'synthetic' }, /alternate inference operation/],
      [{ ...strict, forceBypassCache: true, fallbackModels: ['x'] }, /must not carry fallbackModels/],
      [{ ...strict, forceBypassCache: true, modelThrottlingRetries: 2 }, /must not carry modelThrottlingRetries/],
      [{ ...strict, forceBypassCache: true, maxGeneralServiceRetries: 2 }, /must not carry maxGeneralServiceRetries/],
      [{ ...strict, forceBypassCache: true, debug_region_override_list: ['us-west-2'] }, /must not carry debug_region_override_list/],
      [{ ...strict, forceBypassCache: true, executionContract: EXECUTION_CONTRACT }, /must not nest executionContract/]
    ];
    for (const [paidRequest, expected] of cases) {
      assert.throws(() => validatePaidSearchRequest(paidRequest), expected, JSON.stringify(Object.keys(paidRequest)));
    }
    for (const body of [
      { executionContract: 'other_v1', maxProviderAttempts: 1, paidRequest: { ...strict, forceBypassCache: true } },
      { executionContract: EXECUTION_CONTRACT, maxProviderAttempts: 2, paidRequest: { ...strict, forceBypassCache: true } },
      { executionContract: EXECUTION_CONTRACT, maxProviderAttempts: 1, q: strict.q, paidRequest: { ...strict, forceBypassCache: true } },
      { executionContract: EXECUTION_CONTRACT, maxProviderAttempts: 1, paidRequest: 'not-an-object' },
      'not-an-object'
    ]) {
      assert.throws(() => assertForwardableEnvelope(body));
    }
  });

  it('gives each rejection its own reason, from a closed set', function () {
    const cases = [
      [null, 'Request body must be an object'],
      [{ executionContract: 'other_v1' }, 'Unsupported executionContract'],
      [{ executionContract: EXECUTION_CONTRACT, maxProviderAttempts: 3 }, 'maxProviderAttempts must be 1'],
      [{ executionContract: EXECUTION_CONTRACT, maxProviderAttempts: 1, model: 'x', paidRequest: {} }, 'Envelope must not carry top-level model'],
      [{ executionContract: EXECUTION_CONTRACT, maxProviderAttempts: 1, paidRequest: 1 }, 'paidRequest must be an object'],
      [{ executionContract: EXECUTION_CONTRACT, maxProviderAttempts: 1, paidRequest: { ...strict } }, 'paidRequest must set forceBypassCache to true'],
      [{ executionContract: EXECUTION_CONTRACT, maxProviderAttempts: 1, paidRequest: { ...strict, forceBypassCache: true, fallbackModels: [] } }, 'paidRequest must not carry fallbackModels'],
      [{ executionContract: EXECUTION_CONTRACT, maxProviderAttempts: 1, paidRequest: { ...strict, forceBypassCache: true, mode: 'conversational' } }, 'paidRequest must use mode insight_evidence']
    ];
    const seen = new Set();
    for (const [body, expected] of cases) {
      assert.throws(() => assertForwardableEnvelope(body), error => {
        assert.equal(error.message, expected, JSON.stringify(body));
        assert(REJECTION_MESSAGES.has(error.message), error.message);
        seen.add(error.message);
        return true;
      });
    }
    // Distinct bodies must not collapse onto one reason.
    assert.equal(seen.size, cases.length);
  });

  it('sends the envelope on every page and only in a bounded host', async function () {
    const sent = [];
    const client = new VMApiClient({ tokenType: 'mcp', mcpToken: 'synthetic-not-a-token' });
    client.client = { post: async (url, body) => { sent.push(body); return { data: valid({ embeddingUsage: [], providerUsage: [] }) }; } };
    await client.searchJournals('synthetic-child', strict.q, { ...strict, limit: 10, boundedExecution: true });
    await client.searchJournals('synthetic-child', strict.q, { ...strict, limit: 10, continuationToken: 'synthetic-token', boundedExecution: true });
    await client.searchJournals('synthetic-child', strict.q, { ...strict, limit: 10 });
    assert.equal(sent.length, 3);
    for (const body of sent.slice(0, 2)) {
      assert.equal(body.executionContract, EXECUTION_CONTRACT);
      assert.equal(body.q, undefined);
      assert.equal(body.paidRequest.mode, 'insight_evidence');
      assert.equal(body.paidRequest.forceBypassCache, true);
    }
    assert.equal(sent[1].paidRequest.continuationToken, 'synthetic-token');
    // An unbounded host keeps the legacy body exactly as before.
    assert.equal(sent[2].executionContract, undefined);
    assert.equal(sent[2].q, strict.q);
    assert.equal(sent[2].forceBypassCache, undefined);
  });

  it('bounds only strict search and never lets a model choose the contract', async function () {
    const { instance, session } = tool({ response: () => valid() });
    await assert.rejects(instance.execute({ query: strict.q }, session), /BOUNDED_SEARCH_MODE_REQUIRED/);
    // The contract is not an advertised tool argument, so a model cannot request it.
    const advertised = Object.keys(SearchJournalsTool.definition.inputSchema.properties);
    for (const field of ['executionContract', 'maxProviderAttempts', 'paidRequest', 'forceBypassCache']) {
      assert(!advertised.includes(field), field);
    }
    const unbounded = new ToolRegistry(new SessionManager(), null, { tokenType: 'mcp', mcpToken: 'synthetic-not-a-token' }, {});
    assert.equal(unbounded.toolInstances.searchJournals.boundedExecution, false);
    const bounded = new ToolRegistry(new SessionManager(), null, { tokenType: 'mcp', mcpToken: 'synthetic-not-a-token' }, { boundedSearchExecution: true });
    assert.equal(bounded.toolInstances.searchJournals.boundedExecution, true);
  });

  it('passes the attempt through both accounting channels without rounding it away', async function () {
    // Attempt COUNTS against the real boundary are proven in the engine and api
    // suites; what this proves is that the transform hands the caller the usage
    // unaltered — cost, price date and freshness included.
    const first = tool({ response: () => valid() });
    const page = await first.instance.execute(args, first.session);
    assert.deepEqual(page.embeddingUsage, [attemptUsage()]);
    assert.deepEqual(page.providerUsage, [attemptUsage()]);
    assert.equal(page.usageIncomplete, false);

    const continued = tool({ response: () => valid({ embeddingUsage: [], providerUsage: [] }) });
    const second = await continued.instance.execute({ ...args, continuationToken: 'synthetic-token' }, continued.session);
    assert.deepEqual(second.embeddingUsage, []);
    assert.deepEqual(second.providerUsage, []);
  });

  it('reports an unknown cost as unknown rather than as zero', async function () {
    // The proxy returns a null cost and price date when pricing is unavailable. A
    // real proxy cannot be made to lose its price table, so the condition is
    // simulated; what matters is that nothing between here and the caller
    // substitutes a number for the unknown.
    const unknown = attemptUsage({ costUsd: null, pricingAsOfDate: null, unpricedCallCount: 1, usageIncomplete: true });
    const { instance, session } = tool({ response: () => valid({ embeddingUsage: [unknown], providerUsage: [unknown], usageIncomplete: true }) });
    const page = await instance.execute(args, session);
    assert.equal(page.embeddingUsage[0].costUsd, null);
    assert.equal(page.embeddingUsage[0].pricingAsOfDate, null);
    assert.equal(page.embeddingUsage[0].unpricedCallCount, 1);
    assert.equal(page.usageIncomplete, true, 'An attempt with an unknown cost leaves accounting incomplete');
  });

  it('refuses a page whose attempts or cache outcome contradict the bound, without losing what it paid', async function () {
    // Each refusal below happens AFTER the embedding was already charged, so the
    // caller must still receive the attempt — it cannot admit another paid step
    // against a total that silently dropped this one.
    const paid = attemptUsage();
    const rejects = async (overrides, pattern, execArgs = args) => {
      const { instance, session } = tool({ response: () => valid(overrides) });
      await assert.rejects(instance.execute(execArgs, session), error => {
        assert.match(error.message, pattern);
        assert.deepEqual(error.providerUsage, overrides.providerUsage ?? [paid]);
        assert.equal(error.usageIncomplete, overrides.usageIncomplete ?? false);
        return true;
      });
    };
    await rejects({ embeddingUsage: [paid, { ...paid }], providerUsage: [paid, { ...paid }] }, /BOUNDED_SEARCH_ATTEMPTS_UNEXPECTED/);
    await rejects({ embeddingUsage: [], providerUsage: [] }, /BOUNDED_SEARCH_ATTEMPTS_UNEXPECTED/);
    await rejects({}, /BOUNDED_SEARCH_ATTEMPTS_UNEXPECTED/, { ...args, continuationToken: 'synthetic-token' });
    await rejects({ embeddingUsage: [{ ...paid, cacheOutcome: 'hit' }], providerUsage: [{ ...paid, cacheOutcome: 'hit' }] }, /BOUNDED_SEARCH_CACHE_NOT_BYPASSED/);
  });

  it('leaves an unbounded strict search unchecked for attempts', async function () {
    const { instance, session } = tool({ bounded: false, response: () => valid({ embeddingUsage: [], providerUsage: [] }) });
    const page = await instance.execute(args, session);
    assert.equal(page.completed, true);
  });
});
