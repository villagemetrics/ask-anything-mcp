import assert from 'node:assert/strict';
import { SearchJournalsTool } from '../../src/tools/journal/searchJournals.js';
import { SessionManager } from '../../src/session/sessionManager.js';

// Fault injection complements api/test/strict-journal-search.test.js, which
// exercises this tool over HTTPS through real development S3/DynamoDB/Pinecone.
describe('Strict journal search response faults', function () {
  const args = { query: 'synthetic history', mode: 'insight_evidence', startDate: '2024-01-01', endDate: '2024-01-02' };
  const valid = () => ({
    results: [{ document: { journalEntryId: 'journal_entry_00000000-0000-4000-8000-000000000001', date: '2024-01-01' } }],
    searchExecutionId: 'synthetic-execution', requestedFilter: { startDate: args.startDate, endDate: args.endDate },
    effectiveFilter: { startDate: args.startDate, endDate: args.endDate },
    retrieval: { mode: 'date_filtered_vector', dateCoverageStatus: 'complete', candidateLimit: 2000, rawCandidateCount: 1,
      truncationKnown: true, truncated: false, enrichmentFailureCount: 0, incompleteReasons: [] },
    completed: true, pagination: { exhausted: true, total: 1, limit: 10 }
  });
  async function execute(response) {
    const sessions = new SessionManager();
    const sessionId = sessions.createSession('synthetic-user');
    sessions.setSelectedChild(sessionId, 'synthetic-child', 'Synthetic');
    const tool = new SearchJournalsTool(sessions, { tokenType: 'mcp', mcpToken: 'synthetic-not-a-token' });
    tool.apiClient.searchJournals = async () => response;
    return tool.execute(args, sessions.getSession(sessionId));
  }
  it('rejects older or malformed completion fields and source IDs', async () => {
    const paths = ['searchExecutionId', 'requestedFilter', 'effectiveFilter', 'completed', 'results', 'pagination.exhausted',
      'retrieval.mode', 'retrieval.dateCoverageStatus', 'retrieval.candidateLimit', 'retrieval.rawCandidateCount',
      'retrieval.truncationKnown', 'retrieval.truncated', 'retrieval.enrichmentFailureCount', 'retrieval.incompleteReasons',
      'results.0.document.journalEntryId'];
    for (const path of paths) {
      const response = valid(), parts = path.split('.');
      const parent = parts.slice(0, -1).reduce((value, part) => value[part], response);
      delete parent[parts.at(-1)];
      await assert.rejects(execute(response), /STRICT_SEARCH_RESPONSE_INCOMPLETE/, path);
    }
    const wrongCount = valid(); wrongCount.retrieval.rawCandidateCount = '1';
    await assert.rejects(execute(wrongCount), /STRICT_SEARCH_RESPONSE_INCOMPLETE/);
    const undrainable = valid(); undrainable.pagination.exhausted = false; undrainable.completed = false;
    await assert.rejects(execute(undrainable), /STRICT_SEARCH_RESPONSE_INCOMPLETE/);
  });
  it('rejects success that contradicts truncation, missing enrichment or requested bounds', async () => {
    for (const mutate of [r => { r.retrieval.truncated = true; }, r => { r.retrieval.enrichmentFailureCount = 1; },
      r => { r.effectiveFilter.startDate = '2023-01-01'; }, r => { r.retrieval.dateCoverageStatus = 'legacy_or_unknown'; }]) {
      const response = valid(); mutate(response);
      await assert.rejects(execute(response), /STRICT_SEARCH_COMPLETION_INCONSISTENT/);
    }
  });
});
