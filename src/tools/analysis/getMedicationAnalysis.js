import { createLogger } from '../../utils/logger.js';
import { VMApiClient } from '../../clients/vmApiClient.js';
import { transformMedicationAnalysis } from '../../transformers/analysisData.js';

const logger = createLogger('GetMedicationAnalysisTool');

export class GetMedicationAnalysisTool {
  constructor(sessionManager, apiOptions = {}) {
    this.sessionManager = sessionManager;
    this.apiClient = new VMApiClient(apiOptions);
  }

  static get definition() {
    return {
      name: 'get_medication_analysis',
      description: `Get detailed medication effectiveness analysis including current and past medications with effectiveness analysis, duration tracking, dosage correlations, and behavioral impact assessment for the selected child. Includes both the medication list and their effectiveness analysis.
      
Best for answering:
- "How effective are the current medications?"
- "Which medication cocktail worked best?"
- "How long should we try a medication combination?"
- "What's the longest successful medication duration?"
- "How do specific behaviors change with different medications?"
- "Which medication phases are most effective?"
- "Do we have enough data to assess medication effectiveness?"
- "Which behaviors improve/worsen with medication changes?"`,
      inputSchema: {
        type: 'object',
        properties: {
          timeRange: {
            type: 'string',
            description: 'Analysis time period',
            enum: ['last_7_days', 'last_30_days', 'last_90_days', 'last_180_days', 'last_365_days']
          }
        },
        required: ['timeRange']
      }
    };
  }

  async execute(args, session) {
    const { timeRange } = args;
    
    if (!timeRange) {
      throw new Error('Time range is required');
    }

    const validTimeRanges = ['last_7_days', 'last_30_days', 'last_90_days', 'last_180_days', 'last_365_days'];
    if (!validTimeRanges.includes(timeRange)) {
      throw new Error(`Invalid time range. Must be one of: ${validTimeRanges.join(', ')}`);
    }

    // Ensure child is selected (stateful - childId comes from session)
    const { childId, childName } = this.sessionManager.getSelectedChild(session.sessionId);
    
    try {
      // Get both analysis data and raw medications data
      const [rawAnalysisData, rawMedicationsData] = await Promise.all([
        this.apiClient.getAnalysisData(childId, timeRange, 'medication'),
        this.apiClient.getMedications(childId)
      ]);
      
      // Enhanced logging to help debug medication data issues
      logger.debug('Raw data retrieved', { 
        childId, 
        timeRange,
        hasAnalysisData: !!rawAnalysisData,
        analysisDataSize: rawAnalysisData ? JSON.stringify(rawAnalysisData).length : 0,
        medicationsDataType: typeof rawMedicationsData,
        medicationsIsArray: Array.isArray(rawMedicationsData),
        medicationsLength: Array.isArray(rawMedicationsData) ? rawMedicationsData.length : 'N/A',
        medicationsData: rawMedicationsData // Add this temporarily for debugging
      });
      
      // Transform to LLM-friendly format
      const transformed = transformMedicationAnalysis(rawAnalysisData, rawMedicationsData, childName, timeRange);
      
      logger.debug('Medication analysis retrieved', { 
        childId, 
        timeRange, 
        hasData: transformed.hasData,
        medicationCount: Array.isArray(rawMedicationsData) ? rawMedicationsData.length : 0,
        currentMeds: Array.isArray(rawMedicationsData) ? rawMedicationsData.filter(m => !m.archived).length : 0,
        compressionRatio: transformed.compressionInfo?.compressionRatio
      });
      
      return transformed;
    } catch (error) {
      if (error.response?.status === 403) {
        return {
          timeRange,
          childName,
          message: `Access denied: You don't have permission to view medication data for ${childName}. This requires medical data viewing permissions. Contact a parent or guardian to request access.`,
          permissionError: true
        };
      }
      
      if (error.response?.status === 404) {
        // Analysis data not found, but we might still have medication data
        // Call transformer with null analysis data but include any medication data we got
        const transformed = transformMedicationAnalysis(null, rawMedicationsData, childName, timeRange);
        
        logger.debug('Medication analysis retrieved (404 fallback)', { 
          childId, 
          timeRange, 
          hasAnalysisData: false,
          medicationCount: Array.isArray(rawMedicationsData) ? rawMedicationsData.length : 0,
          currentMeds: Array.isArray(rawMedicationsData) ? rawMedicationsData.filter(m => !m.archived).length : 0
        });
        
        return transformed;
      }
      
      logger.error('Failed to get medication analysis', { error: error.message, timeRange });
      throw new Error(`Failed to get medication analysis: ${error.message}`);
    }
  }
}