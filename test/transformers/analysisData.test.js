import { expect } from 'chai';
import {
  transformOverviewAnalysis,
  transformBehaviorAnalysis
} from '../../src/transformers/analysisData.js';

// Pure-function unit tests for the analysis transformers. These exercise the
// previous-period-date-range surfacing without hitting the API, using synthetic
// rawData objects shaped exactly like the analysis-job-processor output
// (analysisMeta.previousPeriodDateRange, produced by AnalysisContext.toMetadata()).

describe('analysisData transformers - previous period context', function() {
  const childName = 'Test Child';

  describe('transformOverviewAnalysis', function() {
    it('surfaces previousPeriodDateRange when present in analysisMeta', function() {
      const rawData = {
        analysisMeta: {
          dateRange: { startDate: '2025-09-05', endDate: '2025-12-03' },
          previousPeriodDateRange: { startDate: '2025-06-08', endDate: '2025-09-04' }
        },
        analysisData: {
          overallBehavior: {
            averageScore: 3.13,
            previousPeriodScore: 2.78,
            scoreChange: 0.35,
            daysWithData: 8
          }
        }
      };

      const result = transformOverviewAnalysis(rawData, childName, 'last_90_days');

      expect(result.previousPeriodDateRange).to.exist;
      expect(result.previousPeriodDateRange.startDate).to.be.a('string').and.contain('2025');
      expect(result.previousPeriodDateRange.endDate).to.be.a('string').and.contain('2025');
      // The current dateRange should still be surfaced alongside it
      expect(result.dateRange).to.exist;
      // The explanatory note that references previousPeriodDateRange should be present
      expect(result.overallBehavior._previousScoreNote).to.contain('previousPeriodDateRange');
      expect(result.overallBehavior.previousScore).to.equal(2.78);
    });

    it('omits previousPeriodDateRange gracefully when absent (no crash)', function() {
      const rawData = {
        analysisMeta: {
          dateRange: { startDate: '2025-10-22', endDate: '2025-11-20' }
          // no previousPeriodDateRange (e.g. insufficient history for last_30_days)
        },
        analysisData: {
          overallBehavior: {
            averageScore: 3.11,
            previousPeriodScore: 3.25,
            scoreChange: -0.14,
            daysWithData: 5
          }
        }
      };

      const result = transformOverviewAnalysis(rawData, childName, 'last_30_days');

      expect(result.previousPeriodDateRange).to.be.undefined;
      expect(result.dateRange).to.exist;
      // previousScore is still present even when the range isn't, so the note stays useful
      expect(result.overallBehavior.previousScore).to.equal(3.25);
    });
  });

  describe('transformBehaviorAnalysis', function() {
    it('surfaces previousPeriodDateRange and per-goal note when present', function() {
      const rawAnalysisData = {
        analysisMeta: {
          dateRange: { startDate: '2025-09-05', endDate: '2025-12-03' },
          previousPeriodDateRange: { startDate: '2025-06-08', endDate: '2025-09-04' }
        },
        analysisData: {
          overallBehavior: {
            averageScore: 3.13,
            previousPeriodScore: 2.78,
            scoreChange: 0.35,
            daysWithData: 8
          },
          behaviorGoals: [
            {
              name: 'Maintained Safety',
              averageScore: 3.38,
              previousPeriodScore: 3.0,
              scoreChange: 0.38,
              whatWorks: [],
              whatNotWorks: []
            }
          ]
        }
      };

      const result = transformBehaviorAnalysis(rawAnalysisData, [], childName, 'last_90_days');

      expect(result.previousPeriodDateRange).to.exist;
      expect(result.previousPeriodDateRange.startDate).to.be.a('string').and.contain('2025');
      expect(result.previousPeriodDateRange.endDate).to.be.a('string').and.contain('2025');
      expect(result.behaviorGoalAnalysis).to.have.lengthOf(1);
      expect(result.behaviorGoalAnalysis[0].previousScore).to.equal(3.0);
      expect(result.behaviorGoalAnalysis[0]._previousScoreNote).to.contain('previousPeriodDateRange');
    });

    it('omits previousPeriodDateRange gracefully when absent (no crash)', function() {
      const rawAnalysisData = {
        analysisMeta: {
          dateRange: { startDate: '2025-10-22', endDate: '2025-11-20' }
        },
        analysisData: {
          behaviorGoals: []
        }
      };

      const result = transformBehaviorAnalysis(rawAnalysisData, [], childName, 'last_30_days');

      expect(result.previousPeriodDateRange).to.be.undefined;
      expect(result.dateRange).to.exist;
    });
  });
});
