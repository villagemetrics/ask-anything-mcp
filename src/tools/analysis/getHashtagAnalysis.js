import { createLogger } from '../../utils/logger.js';
import { VMApiClient } from '../../clients/vmApiClient.js';
import { transformHashtagAnalysis } from '../../transformers/analysisData.js';

const logger = createLogger('GetHashtagAnalysisTool');

export class GetHashtagAnalysisTool {
  constructor(sessionManager, apiOptions = {}) {
    this.sessionManager = sessionManager;
    this.apiClient = new VMApiClient(apiOptions);
  }

  static get definition() {
    return {
      name: 'get_hashtag_analysis',
      description: `Get hashtag analysis for a specific category of hashtags, showing patterns, frequency, and impact on behavior scores with example journal entries.

Available hashtag types and what they track:
- BehaviorConcept: Core behavioral patterns (AttentionSeeking, ControlSeeking, SensorySeeking, etc.)
- Incident: Problematic behaviors (Hitting, Tantrum, Aggression, PropertyDestruction, etc.)
- Activity: Structured activities (Swimming, ABATherapy, VR, CraftTime, etc.)
- Emotion: Emotional states (Happiness, Frustration, Anxiety, Calmness, etc.)
- Person: Key individuals (Therapist, Sibling, Teacher, Grandparents, etc.)
- Place: Important locations (Home, School, Playground, Doctor, etc.)
- RootCause: Underlying triggers (Transitions, WaitTime, RoutineDisruption, etc.)
- Outcome: Positive results (Compliance, SchoolSuccess, SelfCalmed, etc.)
- BehaviorMethod: Intervention strategies (PositiveReinforcement, TokenEconomy, etc.)
- Food: Dietary influences (Dairy, Gluten, Caffeine, ProcessedFood, etc.)
- Time: Temporal patterns (Morning, Bedtime, AfterSchool, etc.)
- Object: Important items (iPad, SensoryToy, WaterBottle, etc.)
- Event: External circumstances (DoctorVisit, FireAlarm, SnowDay, etc.)
- Action: Physical behaviors (Jumping, Clapping, Drawing, Talking, etc.)
- HealthSymptom: Health factors (MinorAilment, StomachAche, Fatigue, etc.)
- EnvironmentalFactor: Environmental influences (LoudNoises, BrightLights, CrowdedPlace, etc.)
- CommunicationMode: Communication methods (AACDevice, SignLanguage, NonVerbal, etc.)

Best for answering:
- "Show me all behavior concepts and their impact on behavior"
- "What incidents occur most frequently and in what contexts?"  
- "Which activities correlate with better behavior scores?"
- "What emotional patterns do we see in the journals?"
- "Show me examples of specific intervention methods being used"

NOTE: Due to response length, you must specify ONE hashtag type per call. Use multiple calls if you need to compare different types.`,
      inputSchema: {
        type: 'object',
        properties: {
          hashtagType: {
            type: 'string',
            description: 'The specific hashtag type to analyze',
            enum: ['BehaviorConcept', 'Incident', 'Activity', 'Emotion', 'Person', 'Place', 'RootCause', 'Outcome', 'BehaviorMethod', 'Food', 'Time', 'Object', 'Event', 'Action', 'HealthSymptom', 'EnvironmentalFactor', 'CommunicationMode']
          },
          timeRange: {
            type: 'string',
            description: 'Analysis time period',
            enum: ['last_7_days', 'last_30_days', 'last_90_days', 'last_180_days', 'last_365_days']
          }
        },
        required: ['hashtagType', 'timeRange']
      }
    };
  }

  async execute(args, session) {
    const { hashtagType, timeRange } = args;
    
    if (!hashtagType) {
      throw new Error('Hashtag type is required');
    }
    
    if (!timeRange) {
      throw new Error('Time range is required');
    }

    const validHashtagTypes = ['BehaviorConcept', 'Incident', 'Activity', 'Emotion', 'Person', 'Place', 'RootCause', 'Outcome', 'BehaviorMethod', 'Food', 'Time', 'Object', 'Event', 'Action', 'HealthSymptom', 'EnvironmentalFactor', 'CommunicationMode'];
    if (!validHashtagTypes.includes(hashtagType)) {
      throw new Error(`Invalid hashtag type. Must be one of: ${validHashtagTypes.join(', ')}`);
    }

    const validTimeRanges = ['last_7_days', 'last_30_days', 'last_90_days', 'last_180_days', 'last_365_days'];
    if (!validTimeRanges.includes(timeRange)) {
      throw new Error(`Invalid time range. Must be one of: ${validTimeRanges.join(', ')}`);
    }

    // Ensure child is selected (stateful - childId comes from session)
    const { childId, childName } = this.sessionManager.getSelectedChild(session.sessionId);
    
    try {
      // Get journal analysis data from API (contains hashtag data)
      const rawData = await this.apiClient.getAnalysisData(childId, timeRange, 'journal');
      
      // Transform to LLM-friendly format (extracts only hashtag-related data for the specified type)
      const transformed = transformHashtagAnalysis(rawData, childName, timeRange, hashtagType);
      
      logger.debug('Hashtag analysis retrieved', { 
        childId, 
        timeRange,
        hashtagType,
        hasData: transformed.hasData,
        hashtagCount: rawData?.hashtags?.length || 0,
        typeCount: rawData?.hashtagsByType?.length || 0,
        filteredHashtagCount: transformed.hashtagsByType?.[0]?.hashtags?.length || 0
      });
      
      return transformed;
    } catch (error) {
      if (error.response?.status === 403) {
        return {
          timeRange,
          hashtagType,
          childName,
          message: `Access denied: You don't have permission to view journal entries for ${childName}. This requires journal viewing permissions. Contact a parent or guardian to request access.`,
          hasData: false,
          permissionError: true
        };
      }
      
      if (error.response?.status === 404) {
        return {
          timeRange,
          hashtagType,
          childName,
          message: `No hashtag analysis data found for ${childName} in the ${timeRange} period. Journal entries with hashtags may not exist yet or analysis may not be available.`,
          hasData: false
        };
      }
      
      logger.error('Failed to get hashtag analysis', { error: error.message, timeRange, hashtagType });
      throw new Error(`Failed to get hashtag analysis: ${error.message}`);
    }
  }
}