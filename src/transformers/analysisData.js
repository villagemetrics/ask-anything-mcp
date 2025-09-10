import { createLogger } from '../utils/logger.js';

const logger = createLogger('AnalysisDataTransformer');

// Configuration for analysis data condensation
const CONDENSATION_CONFIG = {
  // Arrays to truncate and how many items to keep
  arrayTruncation: {
    dailyBehaviorScores: 3,
    contributingUsers: 2,
    village: 2,
    topCaregivers: 2,
    bottomCaregivers: 2,
    enhancers: 2,
    triggers: 2,
    medicationChanges: 2,
    journalEntries: 3,
    hashtags: 3,
    keyMoments: 2,
    hashtagsByType: 3,
    behaviorGoals: 3,
    medications: 3
  },
  // Maximum items to keep for any unspecified array
  defaultArrayLimit: 3,
  // Minimum array size to truncate (don't truncate small arrays)
  minSizeToTruncate: 4
};

/**
 * Condense an array by truncating if it's large enough
 * @param {Array} arr - Array to condense
 * @param {string} key - Key name of this array
 * @returns {Array} Condensed array with truncation metadata
 */
function condenseArray(arr, key) {
  if (!Array.isArray(arr) || arr.length < CONDENSATION_CONFIG.minSizeToTruncate) {
    // Don't truncate small arrays, but still process their contents
    return arr.map(item => condenseObject(item));
  }
  
  // Determine how many items to keep
  const limit = CONDENSATION_CONFIG.arrayTruncation[key] || CONDENSATION_CONFIG.defaultArrayLimit;
  
  if (arr.length <= limit) {
    // Array is not large enough to truncate
    return arr.map(item => condenseObject(item));
  }
  
  // Truncate the array and add metadata
  const truncated = arr.slice(0, limit).map(item => condenseObject(item));
  const remainingCount = arr.length - limit;
  
  truncated.push({
    _truncated: `${remainingCount} more items (${arr.length} total)`,
    _note: `Original array had ${arr.length} items, showing first ${limit}`
  });
  
  return truncated;
}

/**
 * Recursively condense an object by truncating large arrays
 * @param {any} obj - Object to condense
 * @param {string} parentKey - Key name of this object in parent
 * @returns {any} Condensed object
 */
function condenseObject(obj, parentKey = '') {
  if (Array.isArray(obj)) {
    return condenseArray(obj, parentKey);
  }
  
  if (obj && typeof obj === 'object') {
    const result = {};
    
    for (const [key, value] of Object.entries(obj)) {
      result[key] = condenseObject(value, key);
    }
    
    return result;
  }
  
  return obj;
}

/**
 * Transform overview analysis data for LLM consumption
 */
export function transformOverviewAnalysis(rawData, childName, timeRange) {
  if (!rawData) {
    return {
      timeRange,
      childName,
      message: `No overview analysis data available for ${childName} in the ${timeRange} period.`
    };
  }

  // Calculate compression stats for debug logging only
  const originalSize = JSON.stringify(rawData).length;
  
  // Extract and simplify only the essential data for LLMs
  const result = {
    timeRange,
    childName
  };

  // Add date range info in human readable format
  if (rawData.analysisMeta?.dateRange) {
    const startDate = new Date(rawData.analysisMeta.dateRange.startDate).toLocaleDateString();
    const endDate = new Date(rawData.analysisMeta.dateRange.endDate).toLocaleDateString();
    result.dateRange = { startDate, endDate };
  }

  // Add overall behavior score (from analysisData.overallBehavior)
  if (rawData.analysisData?.overallBehavior) {
    const behavior = rawData.analysisData.overallBehavior;
    result.overallBehavior = {
      averageScore: behavior.averageScore,
      previousScore: behavior.previousPeriodScore,
      scoreChange: behavior.scoreChange,
      daysWithData: behavior.daysWithData,
      _scoreRange: "Behavior scores range from 1 (very challenging day) to 4 (excellent day). Higher scores indicate better behavior."
    };
  }

  // Add behavior by day of week (all 7 days, compact format)
  if (rawData.analysisData?.behaviorByDayOfWeek) {
    result.behaviorByDayOfWeek = rawData.analysisData.behaviorByDayOfWeek.map(day => ({
      day: day.day,
      score: day.score
    }));
  }

  // Simplify caregiver effectiveness (merge top/bottom into one sorted list)
  if (rawData.analysisData?.caregiverEffectiveness) {
    const effectiveness = rawData.analysisData.caregiverEffectiveness;
    const allCaregivers = [
      ...(effectiveness.topCaregivers || []),
      ...(effectiveness.bottomCaregivers || [])
    ];
    
    if (allCaregivers.length > 0) {
      result.caregiverEffectiveness = allCaregivers
        .map(caregiver => ({
          name: caregiver.name,
          role: caregiver.role,
          daysPresent: caregiver.daysPresent,
          behaviorScore: caregiver.behaviorScore
        }))
        .sort((a, b) => b.behaviorScore - a.behaviorScore); // Sort by score descending
    }
  }

  // Simplify behavior enhancers (only essential fields)
  if (rawData.analysisData?.behaviorEnhancers) {
    result.behaviorEnhancers = rawData.analysisData.behaviorEnhancers.map(enhancer => ({
      hashtag: enhancer.hashtag,
      averageScore: enhancer.averageScore,
      occurrences: enhancer.occurrences,
      impactVsAverage: `${enhancer.percentageImpact >= 0 ? '+' : ''}${enhancer.percentageImpact}%`
    }));
  }

  // Simplify behavior triggers (only essential fields)
  if (rawData.analysisData?.behaviorTriggers) {
    result.behaviorTriggers = rawData.analysisData.behaviorTriggers.map(trigger => ({
      hashtag: trigger.hashtag,
      averageScore: trigger.averageScore,
      occurrences: trigger.occurrences,
      impactVsAverage: `${trigger.percentageImpact >= 0 ? '+' : ''}${trigger.percentageImpact}%`
    }));
  }

  // Calculate final compression stats for debug logging
  const condensedSize = JSON.stringify(result).length;
  const compressionRatio = ((originalSize - condensedSize) / originalSize * 100).toFixed(1);

  logger.debug('Overview analysis transformed', {
    originalSize,
    condensedSize,
    compressionRatio: `${compressionRatio}%`,
    timeRange,
    removedSections: ['analysisMeta', 'dailyBehaviorScores', 'medicationChanges', 'medicationEffectiveness', 'analysisAssets']
  });

  return result;
}

/**
 * Transform behavior goals analysis data for LLM consumption
 */
export function transformBehaviorAnalysis(rawAnalysisData, rawGoalsData, childName, timeRange) {
  if (!rawAnalysisData && !rawGoalsData) {
    return {
      timeRange,
      childName,
      message: `No behavior goals or analysis data available for ${childName} in the ${timeRange} period.`
    };
  }

  // Calculate compression stats for debug logging only
  const originalSize = JSON.stringify({ analysis: rawAnalysisData, goals: rawGoalsData }).length;
  
  const result = {
    timeRange,
    childName
  };

  // Add date range info in human readable format
  if (rawAnalysisData?.analysisMeta?.dateRange) {
    const startDate = new Date(rawAnalysisData.analysisMeta.dateRange.startDate).toLocaleDateString();
    const endDate = new Date(rawAnalysisData.analysisMeta.dateRange.endDate).toLocaleDateString();
    result.dateRange = { startDate, endDate };
  }

  // Note: We don't include behaviorGoals separately as they're included in behaviorGoalAnalysis below to avoid duplication

  // Add overall behavior with score context
  if (rawAnalysisData?.analysisData?.overallBehavior) {
    const behavior = rawAnalysisData.analysisData.overallBehavior;
    result.overallBehavior = {
      averageScore: behavior.averageScore,
      previousScore: behavior.previousPeriodScore,
      scoreChange: behavior.scoreChange,
      daysWithData: behavior.daysWithData,
      _scoreRange: "Behavior scores range from 1 (very challenging day) to 4 (excellent day). Higher scores indicate better behavior."
    };
  }

  // Simplify behavior goal analysis (remove unnecessary fields from whatWorks/whatNotWorks)
  if (rawAnalysisData?.analysisData?.behaviorGoals) {
    result.behaviorGoalAnalysis = rawAnalysisData.analysisData.behaviorGoals.map(goal => ({
      goalName: goal.name,
      averageScore: goal.averageScore,
      previousScore: goal.previousPeriodScore,
      scoreChange: goal.scoreChange,
      whatWorks: goal.whatWorks?.map(item => ({
        hashtag: item.hashtag,
        averageScore: item.averageScore,
        occurrences: item.occurrences,
        impactVsAverage: `${item.percentageImpact >= 0 ? '+' : ''}${item.percentageImpact}%`
      })) || [],
      whatNotWorks: goal.whatNotWorks?.map(item => ({
        hashtag: item.hashtag,
        averageScore: item.averageScore,
        occurrences: item.occurrences,
        impactVsAverage: `${item.percentageImpact >= 0 ? '+' : ''}${item.percentageImpact}%`
      })) || []
    }));
  }

  // Calculate final compression stats for debug logging
  const condensedSize = JSON.stringify(result).length;
  const compressionRatio = ((originalSize - condensedSize) / originalSize * 100).toFixed(1);

  logger.debug('Behavior analysis transformed', {
    originalSize,
    condensedSize,
    compressionRatio: `${compressionRatio}%`,
    timeRange,
    goalCount: rawGoalsData?.length || 0,
    removedSections: ['analysisMeta', 'goalId', 'dailyBehaviorScores', 'analysisAssets', 'correlation', 'pValue', 'confidenceLevel']
  });

  return result;
}

/**
 * Transform medication analysis data for LLM consumption
 */
export function transformMedicationAnalysis(rawAnalysisData, rawMedicationsData, childName, timeRange) {
  // Handle both direct array format and object with medications property
  const medicationsArray = Array.isArray(rawMedicationsData) ? 
    rawMedicationsData : 
    (rawMedicationsData?.medications && Array.isArray(rawMedicationsData.medications) ? 
      rawMedicationsData.medications : []);
  
  // Check if we have no analysis data AND either no medication data or empty medication data
  if (!rawAnalysisData && (!rawMedicationsData || medicationsArray.length === 0)) {
    return {
      timeRange,
      childName,
      message: `No medication data or analysis available for ${childName} in the ${timeRange} period.`
    };
  }
  
  // If we only have medication data but no analysis, return basic medication info
  if (!rawAnalysisData && rawMedicationsData && medicationsArray.length > 0) {
    const medicationHistory = medicationsArray
      .map(med => ({
        name: med.name,
        totalDosage: med.dosages?.am?.amount + (med.dosages?.midday?.amount || 0) + (med.dosages?.pm?.amount || 0),
        unit: med.dosages?.am?.unit || med.dosages?.pm?.unit,
        startDate: med.startDate,
        endDate: med.endDate || "Currently taking",
        durationDays: med.endDate ? 
          Math.ceil((new Date(med.endDate) - new Date(med.startDate)) / (1000 * 60 * 60 * 24)) : 
          Math.ceil((new Date() - new Date(med.startDate)) / (1000 * 60 * 60 * 24))
      }))
      .sort((a, b) => new Date(b.startDate) - new Date(a.startDate)); // Most recent first
    
    const currentMedsCount = medicationsArray.filter(med => !med.archived && !med.endDate).length;
    
    return {
      timeRange,
      childName,
      medicationHistory,
      message: `Found ${currentMedsCount} current medications but no analysis data available for ${childName} in the ${timeRange} period.`
    };
  }

  // If we have analysis data, use it with minimal transformation
  if (rawAnalysisData?.analysisData) {
    const result = {
      timeRange,
      childName
    };

    // Add date range info in human readable format
    if (rawAnalysisData.analysisMeta?.dateRange) {
      const startDate = new Date(rawAnalysisData.analysisMeta.dateRange.startDate).toLocaleDateString();
      const endDate = new Date(rawAnalysisData.analysisMeta.dateRange.endDate).toLocaleDateString();
      result.dateRange = { startDate, endDate };
    }

    const analysisData = rawAnalysisData.analysisData;
    
    // Add score range explanation
    result._scoreRange = "Behavior scores range from 1 (very challenging day) to 4 (excellent day). Higher scores indicate better behavior.";
    
    // Pass through medication history with cross-reference to current medications
    if (analysisData.medicationEffectiveness?.cocktails && Array.isArray(analysisData.medicationEffectiveness.cocktails)) {
      const effectiveness = analysisData.medicationEffectiveness;
      
      // Sort by most recent first to identify the most recent medication combination
      const sortedCocktails = effectiveness.cocktails.sort((a, b) => new Date(b.startDate) - new Date(a.startDate));
      
      result.medicationHistory = sortedCocktails.map((combo, index) => {
        let endDate = combo.endDate ? new Date(combo.endDate).toLocaleDateString() : "Currently taking";
        
        // For the most recent medication combination, cross-reference with actual medication data
        if (index === 0 && medicationsArray.length > 0) {
          // Check if any current medications match this combination's medications
          const currentMeds = medicationsArray.filter(med => !med.archived && !med.endDate);
          const comboMedNames = new Set(combo.medications?.map(m => m.name) || []);
          const hasMatchingCurrentMeds = currentMeds.some(med => comboMedNames.has(med.name));
          
          if (hasMatchingCurrentMeds) {
            endDate = "Currently taking";
          }
        }
        
        return {
          cocktailId: combo.cocktailId, // Keep for detailed analysis tool
          durationDays: combo.durationDays,
          startDate: new Date(combo.startDate).toLocaleDateString(),
          endDate: endDate,
          averageBehaviorScore: combo.averageScore,
          comparedToPrevious: `${combo.scoreChangePercentage >= 0 ? '+' : ''}${Math.round((combo.scoreChangePercentage || 0) * 100)}%`,
          comparedToAll: `${combo.comparedToAveragePercentage >= 0 ? '+' : ''}${Math.round((combo.comparedToAveragePercentage || 0) * 100)}%`,
          medications: combo.medications?.map(med => ({
            name: med.name,
            totalDosage: med.totalDosage,
            unit: med.unit
          })) || [],
          daysWithObservations: combo.daysWithObservations,
          dataCoveragePercentage: `${Math.round((combo.dataCoveragePercentage || 0) * 100)}%`
        };
      });
    }

    logger.debug('Medication analysis transformed', {
      timeRange,
      hasAnalysisData: true,
      medicationCount: medicationsArray.length,
      currentMeds: medicationsArray.filter(m => !m.archived && !m.endDate).length,
      medicationHistoryCount: result.medicationHistory?.length || 0
    });

    return result;
  }

  // Fallback - shouldn't reach here
  return {
    timeRange,
    childName,
    message: `Unable to process medication data for ${childName} in the ${timeRange} period.`
  };
}

/**
 * Transform journal analysis data (key moments and events) for LLM consumption
 */
export function transformJournalAnalysis(rawData, childName, timeRange) {
  if (!rawData) {
    return {
      timeRange,
      childName,
      message: `No journal analysis data available for ${childName} in the ${timeRange} period.`
    };
  }

  // Calculate compression stats for debug logging only
  const originalSize = JSON.stringify(rawData).length;
  
  const result = {
    timeRange,
    childName,
    _badgeScoreRange: "Badge scores range from 0 to 1, with 0.7+ required to earn a badge. Higher scores indicate stronger confidence in that category.",
    _behaviorScoreRange: "Behavior scores range from 1 (very challenging day) to 4 (excellent day). Higher scores indicate better behavior."
  };

  // Add date range info in human readable format
  if (rawData.analysisMeta?.dateRange) {
    const startDate = new Date(rawData.analysisMeta.dateRange.startDate).toLocaleDateString();
    const endDate = new Date(rawData.analysisMeta.dateRange.endDate).toLocaleDateString();
    result.dateRange = { startDate, endDate };
  }

  // Extract journal stats
  if (rawData.analysisData?.journalStats) {
    result.journalStats = rawData.analysisData.journalStats;
  }

  // Collect all notable journal entries with their badges/scores
  const notableEntries = new Map(); // Use Map to avoid duplicates
  
  // Add key moments
  if (rawData.analysisData?.keyMoments) {
    rawData.analysisData.keyMoments.forEach(moment => {
      const entryId = moment.journalEntryId || `journal_entry_${moment.date}`;
      if (!notableEntries.has(entryId)) {
        notableEntries.set(entryId, {
          journalEntryId: entryId,
          date: moment.date,
          title: moment.title,
          summary: moment.summary,
          behaviorScore: moment.behaviorScore,
          authorName: moment.fullName || moment.preferredName,
          badges: {}
        });
      }
      notableEntries.get(entryId).badges.keyMoment = moment.keyMomentScore;
    });
  }

  // Process all journal entries for special category scores
  if (rawData.analysisData?.journalEntries) {
    rawData.analysisData.journalEntries.forEach(entry => {
      const scores = entry.results || {};
      const entryId = entry.journalEntryId;
      
      // Check if this entry has any notable scores
      const hasNotableScore = 
        scores.keyMomentScore > 0.7 ||
        scores.heartfeltScore > 0.7 ||
        scores.funnyStoryScore > 0.7 ||
        scores.cutenessScore > 0.7 ||
        scores.turnaroundScore > 0.7 ||
        scores.effectiveStrategiesScore > 0.7 ||
        scores.crazyStoryScore > 0.7;
      
      if (hasNotableScore) {
        if (!notableEntries.has(entryId)) {
          notableEntries.set(entryId, {
            journalEntryId: entryId,
            date: entry.date,
            title: scores.shortTitle || 'No title',
            summary: scores.summary || scores.longSummary || 'No summary',
            behaviorScore: scores.inferredBehaviorScores?.overall,
            authorName: entry.fullName || entry.preferredName,
            badges: {}
          });
        }
        
        const entryData = notableEntries.get(entryId);
        
        // Add all qualifying badges with their scores
        if (scores.keyMomentScore > 0.7) entryData.badges.keyMoment = scores.keyMomentScore;
        if (scores.heartfeltScore > 0.7) entryData.badges.heartfelt = scores.heartfeltScore;
        if (scores.funnyStoryScore > 0.7) entryData.badges.funny = scores.funnyStoryScore;
        if (scores.cutenessScore > 0.7) entryData.badges.cute = scores.cutenessScore;
        if (scores.turnaroundScore > 0.7) entryData.badges.turnaround = scores.turnaroundScore;
        if (scores.effectiveStrategiesScore > 0.7) entryData.badges.effectiveStrategies = scores.effectiveStrategiesScore;
        if (scores.crazyStoryScore > 0.7) entryData.badges.crazy = scores.crazyStoryScore;
      }
    });
  }
  
  // Convert Map to array and sort by date (most recent first)
  if (notableEntries.size > 0) {
    result.notableEntries = Array.from(notableEntries.values())
      .sort((a, b) => new Date(b.date) - new Date(a.date))
      .slice(0, 20); // Limit to top 20 most recent notable entries
  }

  // Calculate final compression stats for debug logging
  const condensedSize = JSON.stringify(result).length;
  const compressionRatio = ((originalSize - condensedSize) / originalSize * 100).toFixed(1);

  logger.debug('Journal analysis transformed', {
    originalSize,
    condensedSize,
    compressionRatio: `${compressionRatio}%`,
    timeRange,
    keyMomentCount: rawData.keyMoments?.length || 0,
    removedSections: ['analysisMeta', 'hashtags', 'analysisAssets']
  });

  return result;
}

/**
 * Transform hashtag analysis data for LLM consumption
 */
export function transformHashtagAnalysis(rawData, childName, timeRange, hashtagType) {
  if (!rawData) {
    return {
      timeRange,
      childName,
      hashtagType,
      message: `No hashtag analysis data available for ${childName} in the ${timeRange} period.`
    };
  }

  if (!hashtagType) {
    return {
      timeRange,
      childName,
      message: `Hashtag type is required. Please specify one of: BehaviorConcept, Incident, Activity, Emotion, Person, Place, RootCause, Outcome, BehaviorMethod, Food, Time, Object, Event, Action, HealthSymptom, EnvironmentalFactor, CommunicationMode`
    };
  }

  // Calculate compression stats for debug logging only
  const originalSize = JSON.stringify(rawData).length;
  
  const result = {
    timeRange,
    childName,
    hashtagType
  };

  // Add date range info in human readable format
  if (rawData.analysisMeta?.dateRange) {
    const startDate = new Date(rawData.analysisMeta.dateRange.startDate).toLocaleDateString();
    const endDate = new Date(rawData.analysisMeta.dateRange.endDate).toLocaleDateString();
    result.dateRange = { startDate, endDate };
  }

  // Filter to only the requested hashtag type
  if (rawData.analysisData?.hashtagsByType) {
    const requestedTypeGroup = rawData.analysisData.hashtagsByType.find(typeGroup => typeGroup.type === hashtagType);
    
    if (!requestedTypeGroup) {
      return {
        timeRange,
        childName,
        hashtagType,
        message: `No hashtags of type "${hashtagType}" found for ${childName} in the ${timeRange} period.`
      };
    }

    result.hashtagsByType = [{
      type: requestedTypeGroup.type,
      hashtags: requestedTypeGroup.hashtags?.map(hashtag => {
        // Find full hashtag data with example entries from the main hashtags array
        const fullHashtagData = rawData.analysisData?.hashtags?.find(h => h.tag === hashtag.tag);
        
        return {
          tag: hashtag.tag,
          occurrences: hashtag.occurrences,
          averageBehaviorScore: hashtag.averageBehaviorScore,
          overallAverageScore: fullHashtagData?.overallAverageScore,
          percentageImpact: hashtag.percentageImpact,
          // Standardized example journal entries (consistent with search results)
          exampleJournalEntries: fullHashtagData?.exampleEntries?.map(entry => ({
            journalEntryId: entry.id,
            date: entry.date,
            title: entry.title,
            summary: entry.summary,
            behaviorScore: entry.behaviorScore,
            authorName: entry.fullName
          })) || []
        };
      }) || []
    }];
  }

  // Calculate final compression stats for debug logging
  const condensedSize = JSON.stringify(result).length;
  const compressionRatio = ((originalSize - condensedSize) / originalSize * 100).toFixed(1);

  logger.debug('Hashtag analysis transformed', {
    originalSize,
    condensedSize,
    compressionRatio: `${compressionRatio}%`,
    timeRange,
    hashtagType,
    filteredHashtagCount: result.hashtagsByType?.[0]?.hashtags?.length || 0,
    removedSections: ['analysisMeta', 'keyMoments', 'journalEntries', 'analysisAssets', 'other hashtag types']
  });

  return result;
}