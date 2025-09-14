import { expect } from 'chai';
import { VMApiClient } from '../../src/clients/vmApiClient.js';
import { SessionManager } from '../../src/session/sessionManager.js';
import { ListVillageMembersTool } from '../../src/tools/session/listVillageMembers.js';

describe('List Village Members Tool', function() {
  
  // Unit tests for data transformation
  describe('Data Transformation', function() {
    let tool;
    
    beforeEach(function() {
      const sessionManager = new SessionManager();
      tool = new ListVillageMembersTool(sessionManager, { bypassApiValidation: true });
    });

    it('should transform API response correctly with all member data', function() {
      const mockApiResponse = {
        members: [
          {
            name: 'Alice Smith',
            role: 'Parent',
            inviteStatus: 'accepted',
            journalEntryCount: 45,
            joinedDate: '2024-01-15',
            activitySummary: {
              lastActiveDate: '2025-09-13',
              daysSinceLastActivity: 1,
              totalDaysActive: 120
            }
          },
          {
            name: 'Bob Johnson',
            role: 'Therapist',
            inviteStatus: 'accepted',
            journalEntryCount: 23,
            joinedDate: '2024-03-20'
          },
          {
            fullName: 'Carol Wilson',
            caregiverType: 'Grandparent',
            inviteStatus: 'pending',
            journalEntryCount: 0,
            invitationDetails: {
              sentDate: '2025-09-01',
              expirationDate: '2025-09-15',
              isExpired: false
            }
          }
        ]
      };

      const result = tool.transformVillageMembers(mockApiResponse, 'Test Child', true);
      
      expect(result).to.have.property('childName', 'Test Child');
      expect(result).to.have.property('totalMembers', 3);
      expect(result).to.have.property('statusSummary');
      expect(result.statusSummary).to.deep.equal({ accepted: 2, pending: 1 });
      
      expect(result.members).to.have.length(3);
      
      // Check first member (should be sorted by status then journal count)
      const alice = result.members[0];
      expect(alice.name).to.equal('Alice Smith');
      expect(alice.role).to.equal('Parent');
      expect(alice.status).to.equal('accepted');
      expect(alice.journalEntryCount).to.equal(45);
      expect(alice.activitySummary).to.exist;
      expect(alice.activitySummary.lastActiveDate).to.equal('2025-09-13');
      
      // Check member with different field names
      const carol = result.members.find(m => m.name === 'Carol Wilson');
      expect(carol.role).to.equal('Grandparent');
      expect(carol.status).to.equal('pending');
      expect(carol.invitationDetails).to.exist;
      expect(carol.invitationDetails.sentDate).to.equal('2025-09-01');
      expect(carol.invitationDetails.isExpired).to.be.false;
    });

    it('should handle empty members list', function() {
      const mockApiResponse = { members: [] };
      
      const result = tool.transformVillageMembers(mockApiResponse, 'Test Child', true);
      
      expect(result.childName).to.equal('Test Child');
      expect(result.totalMembers).to.equal(0);
      expect(result.members).to.be.empty;
      expect(result.message).to.equal('Found 0 village members for Test Child. 0 accepted, 0 pending invitations, 0 expired invitations.');
    });

    it('should sort members by status and activity', function() {
      const mockApiResponse = {
        members: [
          { name: 'Expired User', inviteStatus: 'expired', journalEntryCount: 10 },
          { name: 'Pending User', inviteStatus: 'pending', journalEntryCount: 0 },
          { name: 'Low Activity', inviteStatus: 'accepted', journalEntryCount: 5 },
          { name: 'High Activity', inviteStatus: 'accepted', journalEntryCount: 50 },
          { name: 'Another Pending', inviteStatus: 'pending', journalEntryCount: 2 }
        ]
      };

      const result = tool.transformVillageMembers(mockApiResponse, 'Test Child', false);
      
      // Should be sorted: accepted (by journal count desc), pending (by journal count desc), expired
      expect(result.members[0].name).to.equal('High Activity');
      expect(result.members[1].name).to.equal('Low Activity');
      expect(result.members[2].name).to.equal('Another Pending');
      expect(result.members[3].name).to.equal('Pending User');
      expect(result.members[4].name).to.equal('Expired User');
    });

    it('should handle missing invitation details when includeInvitationDetails is false', function() {
      const mockApiResponse = {
        members: [
          {
            name: 'Test User',
            inviteStatus: 'pending',
            invitationDetails: {
              sentDate: '2025-09-01',
              expirationDate: '2025-09-15'
            }
          }
        ]
      };

      const result = tool.transformVillageMembers(mockApiResponse, 'Test Child', false);
      
      expect(result.members[0]).to.not.have.property('invitationDetails');
    });

    it('should generate correct status summary message', function() {
      const mockApiResponse = {
        members: [
          { name: 'Accepted 1', inviteStatus: 'accepted' },
          { name: 'Accepted 2', inviteStatus: 'accepted' },
          { name: 'Pending 1', inviteStatus: 'pending' },
          { name: 'Expired 1', inviteStatus: 'expired' }
        ]
      };

      const result = tool.transformVillageMembers(mockApiResponse, 'Test Child', false);
      
      expect(result.message).to.equal('Found 4 village members for Test Child. 2 accepted, 1 pending invitations, 1 expired invitations.');
    });
  });

  // Integration test (requires real API endpoint)
  describe('API Integration', function() {
    this.timeout(30000);
    let sessionManager;
    let villageTool;
    let sessionId;
    let testChildId = 'b1b62071-e5f7-460e-ae78-197d20fbe022';
    
    before(async function() {
      sessionManager = new SessionManager();
      villageTool = new ListVillageMembersTool(sessionManager);
      
      // Create session and select child
      sessionId = sessionManager.createSession('test-user');
      sessionManager.setSelectedChild(sessionId, testChildId, 'Sydney Kerwin');
    });

    it('should list village members successfully', async function() {
      const session = sessionManager.getSession(sessionId);
      const args = { includeInvitationDetails: true };
      
      try {
        const result = await villageTool.execute(args, session);
        
        expect(result).to.have.property('childName');
        expect(result).to.have.property('totalMembers');
        expect(result).to.have.property('members');
        expect(result).to.have.property('statusSummary');
        expect(result).to.have.property('message');
        
        if (result.totalMembers > 0) {
          const member = result.members[0];
          expect(member).to.have.property('name');
          expect(member).to.have.property('role');
          expect(member).to.have.property('status');
          expect(member).to.have.property('journalEntryCount');
        }
      } catch (error) {
        // If API endpoint doesn't exist yet (404), skip this test
        if (error.message.includes('404')) {
          this.skip();
        } else {
          throw error;
        }
      }
    });

    it('should handle includeInvitationDetails parameter', async function() {
      const session = sessionManager.getSession(sessionId);
      const args = { includeInvitationDetails: false };
      
      try {
        const result = await villageTool.execute(args, session);
        
        expect(result).to.have.property('members');
        
        // Check that invitation details are not included when requested
        result.members.forEach(member => {
          expect(member).to.not.have.property('invitationDetails');
        });
      } catch (error) {
        // If API endpoint doesn't exist yet (404), skip this test
        if (error.message.includes('404')) {
          this.skip();
        } else {
          throw error;
        }
      }
    });

    it('should require child selection', async function() {
      const sessionWithoutChild = sessionManager.createSession('test-user-no-child');
      const args = { includeInvitationDetails: true };
      
      try {
        const session = sessionManager.getSession(sessionWithoutChild);
        await villageTool.execute(args, session);
        throw new Error('Should have thrown an error');
      } catch (error) {
        expect(error.message).to.include('child');
      }
    });

    it('should handle default parameters correctly', async function() {
      const session = sessionManager.getSession(sessionId);
      const args = {}; // No parameters - should use defaults
      
      try {
        const result = await villageTool.execute(args, session);
        
        expect(result).to.have.property('members');
        // Default should include invitation details
      } catch (error) {
        // If API endpoint doesn't exist yet (404), skip this test
        if (error.message.includes('404')) {
          this.skip();
        } else {
          throw error;
        }
      }
    });
  });
});