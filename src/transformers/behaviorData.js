import { createLogger } from '../utils/logger.js';

const logger = createLogger('BehaviorDataTransformer');

/**
 * Transform raw API behavior data to LLM-friendly format
 * Reduces token usage while preserving semantic meaning
 */
export function transformBehaviorData(rawData, childName) {
  if (!rawData) {
    return {
      date: null,
      childName,
      hasData: false,
      message: 'No behavior data available'
    };
  }

  try {
    // Extract scores from goals - preserve exact decimal values
    const scores = {};
    let totalScore = 0;
    let scoreCount = 0;

    if (rawData.goals && Array.isArray(rawData.goals)) {
      rawData.goals.forEach(goal => {
        if (goal.name && goal.value !== undefined) {
          // Preserve exact decimal value (1.0 - 4.0)
          // API uses 'value' not 'score'
          scores[goal.name] = goal.value;
          totalScore += goal.value;
          scoreCount++;
        }
      });
    }

    // Calculate average (keep as number)
    const averageScore = scoreCount > 0 ? parseFloat((totalScore / scoreCount).toFixed(2)) : null;
    const journalCount = rawData.journalEntries?.length || 0;

    const transformed = {
      date: rawData.date,
      childName, // Keep for LLM context
      journalEntriesThisDate: journalCount,
      individualBehaviorGoalScores: scores,
      averageBehaviorScoreAcrossAllGoals: averageScore,
      behaviorGoalScoringGuide: {
        "1": "Not at all",
        "2": "A little", 
        "3": "Mostly",
        "4": "Completely"
      },
      note: "Scores represent daily averages across all caregivers for each behavior goal"
    };

    logger.debug('Behavior data transformed', {
      date: rawData.date,
      originalSize: JSON.stringify(rawData).length,
      transformedSize: JSON.stringify(transformed).length,
      reduction: `${Math.round((1 - JSON.stringify(transformed).length / JSON.stringify(rawData).length) * 100)}%`
    });

    return transformed;
  } catch (error) {
    logger.error('Failed to transform behavior data', { error: error.message });
    return {
      date: rawData.date || null,
      childName,
      hasData: false,
      error: 'Failed to process behavior data'
    };
  }
}

// Removed generateBehaviorSummary function
// Let the LLM interpret scores based on individual goals
// since each goal has different meaning (e.g., "Maintain Safety" vs "Stay Calm")
