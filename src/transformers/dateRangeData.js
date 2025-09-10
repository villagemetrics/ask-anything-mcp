import { createLogger } from '../utils/logger.js';

const logger = createLogger('DateRangeDataTransformer');

/**
 * Transform date range metadata to handle stale data and make it LLM-friendly
 * Based on actual structure from analysis job processor
 */
export function transformDateRangeMetadata(rawData, childName) {
  if (!rawData) {
    return {
      childName,
      hasData: false,
      message: 'No date range metadata available'
    };
  }

  try {
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD in UTC
    
    // Calculate staleness first (needed for all data transformations)
    let daysBehind = 0;
    if (rawData.recentDailyActivity && rawData.recentDailyActivity.endDate) {
      const endDateStr = rawData.recentDailyActivity.endDate.split('T')[0];
      daysBehind = calculateDaysBehind(endDateStr, today);
    }
    
    let adjustedDailyActivity = null;
    let dataFreshnessNote = '';
    
    if (rawData.recentDailyActivity) {
      
      adjustedDailyActivity = rawData.recentDailyActivity.dailyEntries;
      dataFreshnessNote = daysBehind === 0 ? 'current' : `${daysBehind} day${daysBehind === 1 ? '' : 's'} behind`;
      
      logger.debug('Using raw daily activity data', {
        daysBehind,
        dailyEntriesCount: adjustedDailyActivity?.length,
        firstEntry: adjustedDailyActivity?.[0],
        entriesWithData: adjustedDailyActivity?.filter(d => d.journalEntryCount > 0).length || 0
      });
    }

    // Clean up date ranges - only include useful LLM data
    const dateRanges = {};
    if (rawData.dateRanges) {
      Object.entries(rawData.dateRanges).forEach(([_, data]) => {
        // Only include valid ranges, use readable keys
        if (data.valid && data.type) {
          dateRanges[data.type] = {
            journalEntryCount: data.dataQuality?.journalEntryCount || 0,
            daysWithEntries: data.dataQuality?.daysWithEntries || 0,
            coveragePercent: Math.round(data.dataQuality?.coveragePercent || 0)
          };
        }
      });
    }

    return {
      childName,
      hasData: true,
      allTimeDataCoverage: {
        earliestEntry: rawData.earliestDataDate?.split('T')[0] || 'unknown',
        latestEntry: rawData.latestDataDate?.split('T')[0] || 'unknown',
        timeSpanDays: rawData.dataSpanDays || 0,
        daysWithEntries: rawData.totalUniqueDataDays || 0
      },
      dataFreshness: daysBehind > 0 ? `${daysBehind} day${daysBehind === 1 ? '' : 's'} behind` : 'current',
      availablePeriods: dateRanges,
      recentActivity: compactRecentActivity(adjustedDailyActivity, daysBehind)
    };

  } catch (error) {
    logger.error('Failed to transform date range data', { error: error.message, stack: error.stack });
    return {
      childName,
      hasData: false,
      error: `Failed to process date range metadata: ${error.message}`
    };
  }
}

function calculateDaysBehind(endDate, today) {
  if (!endDate) return 0;
  
  const endDateObj = new Date(endDate + 'T00:00:00Z');
  const todayObj = new Date(today + 'T00:00:00Z');
  
  const diffTime = todayObj.getTime() - endDateObj.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

function adjustRecentDailyData(dailyEntries, daysBehind) {
  if (!dailyEntries || daysBehind === 0) {
    return dailyEntries;
  }

  // Remove the oldest entries and add new zero entries for recent days
  const adjustedEntries = dailyEntries.slice(daysBehind);
  
  // Add zero entries for the missing recent days (no explanatory notes)
  for (let i = 0; i < daysBehind; i++) {
    adjustedEntries.unshift({
      date: calculateDateDaysAgo(i),
      journalEntryCount: 0
    });
  }

  // Keep only 14 days
  return adjustedEntries.slice(0, 14);
}

function compactRecentActivity(dailyEntries, daysBehind) {
  if (!dailyEntries) return { period: '14 days', summary: 'No data available' };
  
  logger.debug('Compacting recent activity', {
    inputCount: dailyEntries.length,
    daysBehind,
    firstDay: dailyEntries[0],
    lastDay: dailyEntries[dailyEntries.length - 1]
  });
  
  // Just show dates with non-zero counts, plus summary  
  const withEntries = dailyEntries.filter(day => day.journalEntryCount > 0);
  const totalEntries = dailyEntries.reduce((sum, day) => sum + day.journalEntryCount, 0);
  
  logger.debug('Recent activity summary', {
    totalEntries,
    daysWithEntries: withEntries.length,
    entriesFound: withEntries
  });
  
  return {
    period: 'last 14 days',
    totalEntries: totalEntries,
    daysWithEntries: withEntries.length,
    datesWithEntries: withEntries.length > 0 ? withEntries : []
  };
}

function calculateDateDaysAgo(daysAgo) {
  const date = new Date();
  date.setDate(date.getDate() - daysAgo);
  return date.toISOString().split('T')[0];
}
