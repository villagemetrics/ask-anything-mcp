import axios from 'axios';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('VMApiClient');

export class VMApiClient {
  constructor() {
    this.baseUrl = process.env.VM_API_BASE_URL || 'https://api.villagemetrics.com';
    this.token = process.env.VM_MCP_TOKEN;
    
    if (!this.token) {
      throw new Error('VM_MCP_TOKEN is required');
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
      timeout: 30000  // 30 seconds for potentially slow vector searches
    });

    // Add response interceptor for consistent error logging
    this.client.interceptors.response.use(
      response => {
        logger.debug('API request successful', {
          method: response.config.method,
          url: response.config.url,
          status: response.status
        });
        return response;
      },
      error => {
        const errorDetails = {
          method: error.config?.method,
          url: error.config?.url,
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

    logger.info('API client initialized', { baseUrl: this.baseUrl });
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
}