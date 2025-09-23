import { expect } from 'chai';
import { SessionManager } from '../../src/session/sessionManager.js';
import { GetJournalEntryTool } from '../../src/tools/journal/getJournalEntry.js';

describe('GetJournalEntryTool Unit Tests', function() {
  it('should transform journal entry with shortTitle', function() {
    const sessionManager = new SessionManager();
    const sessionId = sessionManager.createSession('test-user');
    sessionManager.setSelectedChild(sessionId, 'test-child-id', 'Test Child');

    const getJournalEntryTool = new GetJournalEntryTool(sessionManager);

    // Mock journal entry data with shortTitle
    const mockJournalEntry = {
      journalEntryId: 'test-entry-123',
      date: '2024-12-28',
      entryType: 'text',
      results: {
        shortTitle: 'Sydney had a pretty good day',
        cleanVersion: 'Full text content here...',
        inferredBehaviorScores: {
          overall: 0.85
        },
        hashtags: [
          { hashtag: 'good-day' },
          { hashtag: 'playful' }
        ]
      }
    };

    const session = sessionManager.getSession(sessionId);
    const result = getJournalEntryTool.transformJournalEntry(mockJournalEntry, 'Test Child');

    expect(result).to.be.an('object');
    expect(result.shortTitle).to.equal('Sydney had a pretty good day');
    expect(result.journalEntryId).to.equal('test-entry-123');
    expect(result.date).to.equal('2024-12-28');
    expect(result.entryType).to.equal('text');
    expect(result.fullText).to.equal('Full text content here...');
    expect(result.overallBehaviorScore).to.equal(0.85);
    expect(result.hashtags).to.deep.equal(['good-day', 'playful']);
    expect(result.note).to.include('get_journal_entry_analysis');
  });

  it('should handle journal entry without shortTitle', function() {
    const sessionManager = new SessionManager();
    const sessionId = sessionManager.createSession('test-user');
    sessionManager.setSelectedChild(sessionId, 'test-child-id', 'Test Child');

    const getJournalEntryTool = new GetJournalEntryTool(sessionManager);

    // Mock journal entry data without shortTitle
    const mockJournalEntry = {
      journalEntryId: 'test-entry-123',
      date: '2024-12-28',
      entryType: 'text',
      results: {
        cleanVersion: 'Full text content here...',
        inferredBehaviorScores: {
          overall: 0.75
        },
        hashtags: []
      }
    };

    const session = sessionManager.getSession(sessionId);
    const result = getJournalEntryTool.transformJournalEntry(mockJournalEntry, 'Test Child');

    expect(result).to.be.an('object');
    expect(result.shortTitle).to.equal(''); // Should be empty string when not present
    expect(result.fullText).to.equal('Full text content here...');
    expect(result.hashtags).to.deep.equal([]);
  });
});
