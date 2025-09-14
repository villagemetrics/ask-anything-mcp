import { createLogger } from '../../utils/logger.js';
import { VMApiClient } from '../../clients/vmApiClient.js';

const logger = createLogger('ListVillageMembersTool');

export class ListVillageMembersTool {
  constructor(sessionManager, apiOptions = {}) {
    this.sessionManager = sessionManager;
    this.apiClient = new VMApiClient(apiOptions);
  }

  static get definition() {
    return {
      name: 'list_village_members',
      description: 'List all caregivers and village members for the selected child. Shows caregiver names, roles, invitation status, and journal contribution statistics.',
      inputSchema: {
        type: 'object',
        properties: {
          includeInvitationDetails: {
            type: 'boolean',
            default: true,
            description: 'Include invitation status details (pending, expired, accepted)'
          }
        }
      }
    };
  }

  async execute(args, session) {
    const { includeInvitationDetails = true } = args;
    
    // Ensure child is selected (stateful - childId comes from session)
    const { childId, childName } = this.sessionManager.getSelectedChild(session.sessionId);
    
    try {
      logger.debug('Listing village members', { 
        childId, 
        includeInvitationDetails 
      });
      
      // Call the village members API endpoint
      const response = await this.apiClient.getVillageMembers(childId, {
        includeInvitationDetails
      });
      
      logger.debug('Village members retrieved', { 
        childId, 
        memberCount: response.members?.length || 0,
        activeMembers: response.members?.filter(m => m.status === 'active').length || 0,
        pendingInvites: response.members?.filter(m => m.status === 'pending').length || 0
      });
      
      // Transform response for LLM-friendly format
      const transformed = this.transformVillageMembers(response, childName, includeInvitationDetails);
      
      logger.debug('Village members transformed', {
        originalSize: JSON.stringify(response).length,
        transformedSize: JSON.stringify(transformed).length,
        memberCount: transformed.members.length
      });
      
      return transformed;
      
    } catch (error) {
      logger.error('Failed to list village members', { 
        error: error.message,
        childId
      });
      throw new Error(`Failed to list village members: ${error.message}`);
    }
  }

  /**
   * Transform village members response to LLM-friendly format
   * @private
   */
  transformVillageMembers(rawResponse, childName, includeInvitationDetails) {
    if (!rawResponse || !rawResponse.members || rawResponse.members.length === 0) {
      return {
        childName,
        totalMembers: 0,
        statusSummary: { accepted: 0, pending: 0, expired: 0 },
        members: [],
        message: `Found 0 village members for ${childName}. 0 accepted, 0 pending invitations, 0 expired invitations.`
      };
    }

    const members = rawResponse.members.map(member => {
      const transformed = {
        name: member.name || member.fullName || 'Unknown',
        role: member.role || member.caregiverType || 'Caregiver',
        status: member.inviteStatus || 'active', // accepted, pending, expired
        journalEntryCount: member.journalEntryCount || 0,
        joinedDate: member.joinedDate || member.createdAt
      };

      // Add invitation details if requested and available
      if (includeInvitationDetails && member.invitationDetails) {
        transformed.invitationDetails = {
          sentDate: member.invitationDetails.sentDate,
          expirationDate: member.invitationDetails.expirationDate,
          acceptedDate: member.invitationDetails.acceptedDate,
          isExpired: member.invitationDetails.isExpired || false
        };
      }

      // Add activity summary if available
      if (member.activitySummary) {
        transformed.activitySummary = {
          lastActiveDate: member.activitySummary.lastActiveDate,
          daysSinceLastActivity: member.activitySummary.daysSinceLastActivity,
          totalDaysActive: member.activitySummary.totalDaysActive
        };
      }

      return transformed;
    });

    // Sort by status (accepted first) then by journal count (most active first)
    members.sort((a, b) => {
      // Accepted members first
      if (a.status !== b.status) {
        if (a.status === 'accepted') return -1;
        if (b.status === 'accepted') return 1;
        if (a.status === 'pending') return -1;
        if (b.status === 'pending') return 1;
      }
      
      // Then by journal entry count (descending)
      return (b.journalEntryCount || 0) - (a.journalEntryCount || 0);
    });

    const statusCounts = members.reduce((counts, member) => {
      counts[member.status] = (counts[member.status] || 0) + 1;
      return counts;
    }, {});

    return {
      childName,
      totalMembers: members.length,
      statusSummary: statusCounts,
      members,
      message: `Found ${members.length} village members for ${childName}. ${statusCounts.accepted || 0} accepted, ${statusCounts.pending || 0} pending invitations, ${statusCounts.expired || 0} expired invitations.`
    };
  }
}