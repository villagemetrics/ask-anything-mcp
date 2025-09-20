import axios from 'axios';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('VMApiClient');

export class VMApiClient {
  constructor(options = {}) {
    this.baseUrl = process.env.VM_API_BASE_URL || 'https://api.villagemetrics.com';
    
    // Explicit token selection with clear precedence
    if (options.tokenType === 'auth' || options.tokenType === 'user') {
      this.token = options.authToken || process.env.VM_AUTH_TOKEN;
      this.tokenType = 'auth';
    } else if (options.tokenType === 'mcp') {
      this.token = options.mcpToken || process.env.VM_MCP_TOKEN;  
      this.tokenType = 'mcp';
    } else {
      // Default behavior: MCP token preferred when both available
      if (process.env.VM_MCP_TOKEN) {
        this.token = process.env.VM_MCP_TOKEN;
        this.tokenType = 'mcp';
      } else if (process.env.VM_AUTH_TOKEN) {
        this.token = process.env.VM_AUTH_TOKEN;
        this.tokenType = 'auth';
      } else {
        throw new Error('Either VM_MCP_TOKEN or VM_AUTH_TOKEN is required');
      }
    }
    
    if (!this.token) {
      throw new Error(`Token not found for type '${this.tokenType}'. Provide token directly or set appropriate environment variable.`);
    }

    // Enforce HTTPS always
    if (!this.baseUrl.startsWith('https://')) {
      throw new Error('VM_API_BASE_URL must use HTTPS');
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000,  // 30 seconds for potentially slow vector searches
      // Improve connection handling for production
      maxRedirects: 5,
      httpAgent: false, // Use global agent for connection pooling
      httpsAgent: false // Use global agent for connection pooling
    });

    // Add request interceptor to log outgoing requests
    this.client.interceptors.request.use(
      config => {
        const fullUrl = `${this.baseUrl}${config.url}`;
        logger.debug('API request starting', {
          method: config.method,
          fullUrl: fullUrl
        });
        return config;
      }
    );

    // Add response interceptor for consistent success/error logging
    this.client.interceptors.response.use(
      response => {
        const fullUrl = `${this.baseUrl}${response.config.url}`;
        logger.debug('API request successful', {
          method: response.config.method,
          fullUrl: fullUrl,
          status: response.status
        });
        return response;
      },
      error => {
        const fullUrl = `${this.baseUrl}${error.config?.url || ''}`;
          
        const errorDetails = {
          method: error.config?.method,
          fullUrl: fullUrl,
          status: error.response?.status,
          statusText: error.response?.statusText,
          // HIPAA Compliance: Response data may contain PHI, so we comment out for production
          // Uncomment for debugging non-production environments
          // data: error.response?.data,
          // requestData: error.config?.data,
          message: error.message
        };
        
        logger.error('API request failed', errorDetails);
        
        // Enhance error message with HTTP details
        if (error.response) {
          error.message = `API Error ${error.response.status}: ${error.response.statusText}`;
          if (error.response.data?.message) {
            error.message += ` - ${error.response.data.message}`;
          }
        }
        
        return Promise.reject(error);
      }
    );

    logger.debug('API client initialized', { 
      baseUrl: this.baseUrl, 
      tokenType: this.tokenType,
      hasToken: !!this.token,
      tokenLength: this.token?.length || 0,
      tokenSource: options.authToken ? 'options.authToken' : 
                   options.mcpToken ? 'options.mcpToken' :
                   process.env.VM_AUTH_TOKEN ? 'VM_AUTH_TOKEN env var' :
                   process.env.VM_MCP_TOKEN ? 'VM_MCP_TOKEN env var' : 'unknown',
      tokenPrefix: this.token?.substring(0, 20) + '...' || 'none'
    });
  }

  async getChildren() {
    try {
      const response = await this.client.get('/v1/children/me/all');
      logger.debug('Children API response received', { 
        parentChildrenCount: response.data.parentChildren?.length || 0,
        caregiverChildrenCount: response.data.caregiverChildren?.length || 0
      });
      
      // Combine parent and caregiver children into a single array
      const allChildren = [];
      
      if (response.data.parentChildren) {
        response.data.parentChildren.forEach(child => {
          allChildren.push({
            ...child,
            relationship: 'parent'
          });
        });
      }
      
      if (response.data.caregiverChildren) {
        response.data.caregiverChildren.forEach(child => {
          allChildren.push({
            ...child,
            relationship: 'caregiver'
          });
        });
      }
      
      return allChildren;
    } catch (error) {
      throw error;
    }
  }

  async getBehaviorData(childId, date) {
    try {
      const response = await this.client.get(`/v1/children/${childId}/track-data/${date}`);
      logger.debug('Behavior data API response received', { 
        date,
        hasData: !!response.data,
        scoreCount: response.data?.goals?.length || 0
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async searchJournals(childId, query, options = {}) {
    try {
      const response = await this.client.post(`/v1/children/${childId}/journal/search`, {
        q: query,  // API expects 'q' not 'query'
        limit: options.limit || 10,
        offset: options.offset || 0
      });
      logger.debug('Journal search API response received', { 
        query,
        resultCount: response.data?.results?.length || 0,
        hasMore: response.data?.hasMore || false
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async listJournalEntries(childId, options = {}) {
    try {
      // Use the feed endpoint to get journal entries
      const params = {
        limit: options.limit || 50,  // Max allowed by feed API
        offset: options.offset || 0
      };
      
      const response = await this.client.get(`/v1/feed/${childId}`, { params });
      logger.debug('Journal entries from feed API response received', { 
        childId,
        limit: params.limit,
        offset: params.offset,
        totalItems: response.data?.items?.length || 0,
        journalEntries: response.data?.items?.filter(item => item.type === 'journalentry').length || 0
      });
      
      // Filter to only journal entries and transform to expected format
      const journalEntries = response.data?.items?.filter(item => item.type === 'journalentry') || [];
      
      return {
        results: journalEntries,
        hasMore: response.data?.nextOffset !== null,
        nextOffset: response.data?.nextOffset
      };
    } catch (error) {
      throw error;
    }
  }

  async getDateRangeMetadata(childId) {
    try {
      const response = await this.client.get(`/v1/children/${childId}/analysis/date-range-metadata`);
      logger.debug('Date range metadata API response received', { 
        hasData: !!response.data,
        dataAgeInDays: response.data?.daysBehindToday
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }

  async getJournalEntry(childId, journalEntryId) {
    try {
      // Use the new simplified endpoint that doesn't require userId/date
      const url = `/v1/children/${childId}/journal/entries/${journalEntryId}`;
      
      const response = await this.client.get(url);
      logger.debug('Journal entry API response received', { 
        journalEntryId,
        hasResults: !!response.data?.results,
        hashtagCount: response.data?.results?.hashtags?.length || 0
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getAnalysisData(childId, timeRange, analysisType) {
    try {
      // Fix: Use plural form 'medications' not singular 'medication'
      const analysisTypeFixed = analysisType === 'medication' ? 'medications' : analysisType;
      const response = await this.client.get(`/v1/children/${childId}/analysis/${timeRange}/users/village/${analysisTypeFixed}`);
      logger.debug('Analysis data API response received', { 
        childId,
        timeRange,
        analysisType: analysisTypeFixed,
        hasData: !!response.data,
        dataSize: JSON.stringify(response.data).length
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getBehaviorGoals(childId) {
    try {
      const response = await this.client.get(`/v1/children/${childId}/goals`);
      logger.debug('Behavior goals API response received', { 
        childId,
        goalCount: response.data?.length || 0
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getMedications(childId) {
    try {
      const response = await this.client.get(`/v1/children/${childId}/medications`);
      logger.debug('Medications API response received', { 
        childId,
        hasData: !!response.data,
        medicationCount: Array.isArray(response.data) ? response.data.length : 0,
        currentMeds: Array.isArray(response.data) ? response.data.filter(m => !m.archived).length : 0,
        archivedMeds: Array.isArray(response.data) ? response.data.filter(m => m.archived).length : 0
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        return null;
      }
      throw error;
    }
  }

  async getVillageMembers(childId, options = {}) {
    try {
      const params = {};
      if (options.includeInvitationDetails !== undefined) {
        params.includeInvitationDetails = options.includeInvitationDetails;
      }

      const response = await this.client.get(`/v1/children/${childId}/village`, {
        params
      });
      logger.debug('Village members API response received', { 
        childId,
        hasData: !!response.data,
        memberCount: response.data?.village?.length || 0,
        activeMembers: response.data?.village?.filter(m => m.inviteStatus === 'accepted').length || 0,
        pendingMembers: response.data?.village?.filter(m => m.inviteStatus === 'pending').length || 0
      });
      
      // Transform to expected format - API returns { village: [...] } but we expect { members: [...] }
      return {
        members: response.data?.village || []
      };
    } catch (error) {
      if (error.response?.status === 404) {
        return { members: [] };
      }
      throw error;
    }
  }

  async submitProductFeedback(feedbackText, source = 'ask-anything') {
    try {
      const response = await this.client.post('/v1/product-feedback', {
        feedbackText,
        source
      });
      logger.debug('Product feedback API response received', { 
        success: response.data?.success,
        source,
        feedbackLength: feedbackText?.length || 0
      });
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}