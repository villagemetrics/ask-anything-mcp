import { createLogger } from '../../utils/logger.js';
import { VMApiClient } from '../../clients/vmApiClient.js';

const logger = createLogger('GetMedicationDetailedAnalysisTool');

export class GetMedicationDetailedAnalysisTool {
  constructor(sessionManager, apiOptions = {}) {
    this.sessionManager = sessionManager;
    this.apiClient = new VMApiClient(apiOptions);
  }

  static get definition() {
    return {
      name: 'get_medication_detailed_analysis',
      description: `Get comprehensive, detailed analysis for a specific medication combination including full dosage breakdowns (AM/midday/PM), hashtag trends, behavior concepts, and in-depth analytics. This provides all the detailed information for one specific medication combination that you identified from the main medication analysis.
      
Best for answering:
- "Show me detailed dosage schedules and timing effects for this specific medication combination"
- "What are the specific AM/midday/PM impacts for this medication combination?"
- "Which hashtags correlate with this medication combination's effectiveness?"
- "How do behavior concepts change with this specific medication combination?"
- "What are the detailed analytics for this medication period?"
- "Show me comprehensive effectiveness metrics for this specific medication combination"

Use this tool AFTER using get_medication_analysis to drill down into a specific medication combination that looks interesting.`,
      inputSchema: {
        type: 'object',
        properties: {
          cocktailId: {
            type: 'string',
            description: 'The medication combination ID to analyze in detail (from medication analysis results)'
          },
          timeRange: {
            type: 'string',
            description: 'Analysis time period (optional - will use the period covered by this medication combination if not specified)',
            enum: ['last_7_days', 'last_30_days', 'last_90_days', 'last_180_days', 'last_365_days']
          }
        },
        required: ['cocktailId']
      }
    };
  }

  async execute(args, session) {
    const { cocktailId, timeRange } = args;
    
    if (!cocktailId) {
      throw new Error('Cocktail ID is required - use get_medication_analysis first to find medication combination IDs');
    }

    // timeRange is optional for detailed analysis
    if (timeRange) {
      const validTimeRanges = ['last_7_days', 'last_30_days', 'last_90_days', 'last_180_days', 'last_365_days'];
      if (!validTimeRanges.includes(timeRange)) {
        throw new Error(`Invalid time range. Must be one of: ${validTimeRanges.join(', ')}`);
      }
    }

    // Ensure child is selected (stateful - childId comes from session)
    const { childId, childName } = this.sessionManager.getSelectedChild(session.sessionId);
    
    try {
      // Get analysis data from API - use timeRange if provided, otherwise get comprehensive data
      const analysisTimeRange = timeRange || 'last_365_days';
      const [rawAnalysisData, rawMedicationsData] = await Promise.all([
        this.apiClient.getAnalysisData(childId, analysisTimeRange, 'medication'),
        this.apiClient.getMedications(childId)
      ]);
      
      // Transform to detailed format for the specific cocktail ID
      const transformed = this.transformMedicationDetails(rawAnalysisData, rawMedicationsData, childName, cocktailId, timeRange);
      
      logger.debug('Medication details retrieved', { 
        childId, 
        timeRange, 
        hasData: transformed.hasData,
        detailLevel: 'comprehensive'
      });
      
      return transformed;
    } catch (error) {
      if (error.response?.status === 403) {
        return {
          timeRange,
          childName,
          message: `Access denied: You don't have permission to view detailed medication analysis for ${childName}. Contact a parent or guardian to request access.`,
          hasData: false,
          permissionError: true
        };
      }
      
      if (error.response?.status === 404) {
        return {
          timeRange,
          childName,
          message: `No detailed medication data found for ${childName} in the ${timeRange} period. Analysis may not be available yet or there may be insufficient data.`,
          hasData: false
        };
      }
      
      logger.error('Failed to get medication details', { error: error.message, timeRange });
      throw new Error(`Failed to get medication details: ${error.message}`);
    }
  }

  /**
   * Transform medication analysis data for comprehensive detailed analysis of a specific cocktail
   */
  transformMedicationDetails(rawAnalysisData, rawMedicationsData, childName, cocktailId, timeRange) {
    if (!rawAnalysisData) {
      return {
        cocktailId,
        childName,
        message: `No medication analysis data available for ${childName} to find cocktail ${cocktailId}.`
      };
    }

    // Find the specific medication combination by cocktailId
    let specificCombination = null;
    
    if (rawAnalysisData?.analysisData?.medicationEffectiveness) {
      const effectiveness = rawAnalysisData.analysisData.medicationEffectiveness;
      const allCombinations = [];
      
      if (effectiveness.currentCocktail) allCombinations.push(effectiveness.currentCocktail);
      if (effectiveness.previousCocktail) allCombinations.push(effectiveness.previousCocktail);
      if (Array.isArray(effectiveness.cocktails)) {
        allCombinations.push(...effectiveness.cocktails);
      }
      
      specificCombination = allCombinations.find(combo => combo.cocktailId === cocktailId);
    }
    
    if (!specificCombination) {
      return {
        cocktailId,
        childName,
        message: `Medication combination with ID ${cocktailId} not found. Use get_medication_analysis first to see available medication combinations.`
      };
    }

    const result = {
      cocktailId,
      childName,
      startDate: new Date(specificCombination.startDate).toLocaleDateString(),
      endDate: new Date(specificCombination.endDate).toLocaleDateString(),
      durationDays: specificCombination.durationDays,
      averageBehaviorScore: specificCombination.averageScore,
      comparedToPrevious: `${specificCombination.scoreChangePercentage >= 0 ? '+' : ''}${Math.round((specificCombination.scoreChangePercentage || 0) * 100)}%`,
      comparedToAll: `${specificCombination.comparedToAveragePercentage >= 0 ? '+' : ''}${Math.round((specificCombination.comparedToAveragePercentage || 0) * 100)}%`,
      _scoreRange: "Behavior scores range from 1 (very challenging day) to 4 (excellent day). Higher scores indicate better behavior.",
      
      // FULL medication details with dosage breakdowns
      medications: specificCombination.medications?.map(med => {
        // Try to find detailed dosage info from rawMedicationsData
        const detailedMedData = rawMedicationsData?.medications?.find(rawMed => 
          rawMed.name === med.name && 
          rawMed.startDate <= specificCombination.endDate &&
          (!rawMed.endDate || rawMed.endDate >= specificCombination.startDate)
        );
        
        return {
          name: med.name,
          totalDosage: med.totalDosage,
          unit: med.unit,
          medicationPhase: med.medicationPhase || 'Unknown',
          dosageChange: med.change ? `${med.change >= 0 ? '+' : ''}${med.change} ${med.unit}` : null,
          
          // Detailed dosage breakdowns by time of day from raw medication data
          dosageBreakdown: detailedMedData ? {
            morning: detailedMedData.dosages?.am || null,
            midday: detailedMedData.dosages?.midday || null, 
            evening: detailedMedData.dosages?.pm || null,
            totalDailyDosage: med.totalDosage || 0
          } : {
            totalDailyDosage: med.totalDosage || 0,
            note: "Detailed AM/midday/PM breakdown not available - showing total only"
          }
        };
      }) || [],
      
      // Analytics for this combination
      daysWithObservations: specificCombination.daysWithObservations,
      dataCoveragePercentage: `${Math.round((specificCombination.dataCoveragePercentage || 0) * 100)}%`,
      totalBehaviorScores: specificCombination.totalBehaviorScoresAllCaregivers || 0,
      
      // Behavior concepts from hashtag trends
      behaviorConcepts: specificCombination.hashtagTrends?.behaviorConcepts ? 
        Object.entries(specificCombination.hashtagTrends.behaviorConcepts).map(([hashtag, data]) => ({
          hashtag: hashtag,
          occurrenceCount: data.occurrenceCount,
          ratePerJournalEntry: Math.round(data.ratePerJournalEntry * 100),
          changeFromPrior: data.changePercentFromPriorCocktail ? 
            `${data.changePercentFromPriorCocktail >= 0 ? '+' : ''}${Math.round(data.changePercentFromPriorCocktail * 100)}%` : 'N/A',
          changeFromAll: data.changePercentFromAllCocktails ? 
            `${data.changePercentFromAllCocktails >= 0 ? '+' : ''}${Math.round(data.changePercentFromAllCocktails * 100)}%` : 'N/A'
        })) : [],
      
      // Incidents from hashtag trends  
      incidents: specificCombination.hashtagTrends?.incidents ? 
        Object.entries(specificCombination.hashtagTrends.incidents).map(([hashtag, data]) => ({
          hashtag: hashtag,
          occurrenceCount: data.occurrenceCount,
          ratePerJournalEntry: Math.round(data.ratePerJournalEntry * 100),
          changeFromPrior: data.changePercentFromPriorCocktail ? 
            `${data.changePercentFromPriorCocktail >= 0 ? '+' : ''}${Math.round(data.changePercentFromPriorCocktail * 100)}%` : 'N/A',
          changeFromAll: data.changePercentFromAllCocktails ? 
            `${data.changePercentFromAllCocktails >= 0 ? '+' : ''}${Math.round(data.changePercentFromAllCocktails * 100)}%` : 'N/A'
        })) : []
    };

    return result;
  }
}