import axios from 'axios';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('VMApiClient');

export class VMApiClient {
  constructor() {
    this.baseUrl = process.env.VM_API_BASE_URL || 'https://api-dev.villagemetrics.com';
    this.token = process.env.VM_API_TOKEN;
    
    if (!this.token) {
      throw new Error('VM_API_TOKEN is required');
    }

    // Enforce HTTPS for security - no exceptions
    const url = new URL(this.baseUrl);
    if (url.protocol !== 'https:') {
      throw new Error(`HTTPS required for API connections. Got: ${url.protocol}//${url.hostname}`);
    }

    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      timeout: 30000
    });

    // Add response interceptor for consistent error logging
    this.client.interceptors.response.use(
      // Success responses pass through unchanged
      (response) => response,
      // Error responses get enhanced logging
      (error) => {
        logger.error('API request failed', {
          method: error.config?.method?.toUpperCase(),
          url: error.config?.url,
          status: error.response?.status,
          statusText: error.response?.statusText,
          responseData: error.response?.data,
          requestData: error.config?.data,
          errorMessage: error.message
        });
        
        // Re-throw the error so calling code can still handle it
        return Promise.reject(error);
      }
    );

    logger.info('API client initialized', { baseUrl: this.baseUrl });
  }

  async getChildren(userId) {
    try {
      // Use the actual endpoint from your API
      const response = await this.client.get(`/v1/children/me/all`);
      
      // API returns { parentChildren: [...], caregiverChildren: [...] }
      // Add relationship metadata to each child
      const parentChildren = (response.data.parentChildren || []).map(child => ({
        ...child,
        relationship: 'parent'
      }));
      
      const caregiverChildren = (response.data.caregiverChildren || []).map(child => ({
        ...child,
        relationship: 'caregiver'
      }));
      
      const allChildren = [...parentChildren, ...caregiverChildren];
      
      logger.debug('Retrieved children', { 
        userId, 
        parentCount: parentChildren.length,
        caregiverCount: caregiverChildren.length,
        totalCount: allChildren.length 
      });
      
      return allChildren;
    } catch (error) {
      // Interceptor already logged the details, just throw a clean error
      throw new Error(`Failed to get children: ${error.response?.status || 'Unknown'} - ${error.message}`);
    }
  }

  async getBehaviorData(childId, date) {
    try {
      const response = await this.client.get(`/v1/children/${childId}/track-data/${date}`);
      
      // Log the raw response structure to debug the empty scores issue
      logger.debug('Raw behavior data received', {
        childId,
        date,
        responseKeys: Object.keys(response.data || {}),
        goalsExists: !!response.data.goals,
        goalsCount: response.data.goals?.length || 0,
        goalsStructure: response.data.goals?.slice(0, 2) // Show first 2 goals structure
      });
      
      return response.data;
    } catch (error) {
      if (error.response?.status === 404) {
        logger.debug('No behavior data found', { childId, date });
        return null;
      }
      // Interceptor already logged the HTTP details
      throw error;
    }
  }

  async searchJournals(childId, query, options = {}) {
    try {
      const { limit = 10, offset = 0 } = options;
      
      const response = await this.client.post(`/v1/children/${childId}/journal/search`, {
        q: query,
        limit,
        offset
      });
      
      logger.debug('Journal search API call completed', { 
        childId,
        query: query.substring(0, 100),
        resultCount: response.data.results?.length || 0
      });
      
      return response.data;
    } catch (error) {
      // Interceptor already logged the HTTP details, just add context
      logger.error('Failed to search journals via API', { 
        childId,
        query: query.substring(0, 100)
      });
      throw error;
    }
  }

  async getDateRangeMetadata(childId) {
    try {
      const response = await this.client.get(`/v1/children/${childId}/analysis/date-range-metadata`);
      
      logger.debug('Date range metadata received', {
        childId,
        responseKeys: Object.keys(response.data || {}),
        hasRecentActivity: !!response.data.recentDailyActivity,
        lastAnalysisDate: response.data.recentDailyActivity?.endDate,
        // Debug the missing Aug 30th issue
        recentDailyCount: response.data.recentDailyActivity?.dailyEntries?.length || 0,
        firstRecentDay: response.data.recentDailyActivity?.dailyEntries?.[0],
        lastRecentDay: response.data.recentDailyActivity?.dailyEntries?.[response.data.recentDailyActivity?.dailyEntries?.length - 1]
      });
      
      return response.data;
    } catch (error) {
      logger.error('Failed to get date range metadata', { 
        childId,
        error: error.message,
        status: error.response?.status 
      });
      throw error;
    }
  }
}
