import { expect } from 'chai';
import { transformDateRangeMetadata } from '../../src/transformers/dateRangeData.js';
import { VMApiClient } from '../../src/clients/vmApiClient.js';

describe('Date Range Metadata Tool', function() {
  
  // Unit tests with mocked data (since real data is unpredictable)
  describe('Data Transformation', function() {
    it('should handle current data correctly', function() {
      const today = new Date().toISOString().split('T')[0];
      
      const mockApiData = {
        generatedOn: '2025-09-05T09:18:51.983Z',
        childId: 'test-child',
        earliestDataDate: '2024-05-28T00:00:00Z',
        latestDataDate: '2025-09-05T00:00:00Z',
        dataSpanDays: 365,
        totalUniqueDataDays: 200,
        recentDailyActivity: {
          endDate: `${today}T00:00:00Z`,
          dailyEntries: [
            { date: today, journalEntryCount: 2 },
            { date: '2025-09-04', journalEntryCount: 1 }
          ]
        },
        dateRanges: {
          '0': { type: 'last_7_days', valid: true, dataQuality: { journalEntryCount: 5, daysWithEntries: 3, coveragePercent: 42.8 } }
        }
      };

      const result = transformDateRangeMetadata(mockApiData, 'Test Child');

      expect(result.dataFreshness).to.equal('current');
      expect(result.recentActivity.totalEntries).to.equal(3);
      expect(result.availablePeriods.last_7_days.journalEntryCount).to.equal(5);
    });

    it('should detect stale data correctly', function() {
      const sixDaysAgo = new Date();
      sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
      const staleDateStr = sixDaysAgo.toISOString().split('T')[0];
      
      const mockApiData = {
        recentDailyActivity: {
          endDate: `${staleDateStr}T00:00:00Z`,
          dailyEntries: [
            { date: staleDateStr, journalEntryCount: 1 }
          ]
        },
        dateRanges: {}
      };

      const result = transformDateRangeMetadata(mockApiData, 'Test Child');
      
      expect(result.dataFreshness).to.equal('6 days behind');
    });
  });

  // Integration tests (real API)
  describe('API Integration', function() {
    this.timeout(30000);
    
    before(function() {
      if (!process.env.VM_MCP_TOKEN) {
        throw new Error('VM_MCP_TOKEN environment variable is required for integration tests');
      }
      if (!process.env.VM_API_BASE_URL) {
        throw new Error('VM_API_BASE_URL environment variable is required for integration tests');
      }
    });

    it('should retrieve real date range metadata', async function() {
      const apiClient = new VMApiClient();
      const children = await apiClient.getChildren('test-user');
      
      if (children.length === 0) {
        throw new Error('No children found for this user - cannot test date range metadata');
      }
      
      const testChildId = children[0].childId;
      const metadata = await apiClient.getDateRangeMetadata(testChildId);
      
      if (metadata) {
        expect(metadata).to.have.property('recentDailyActivity');
        expect(metadata).to.have.property('dateRanges');
        
        // Test the transformation with real data
        const transformed = transformDateRangeMetadata(metadata, children[0].preferredName);
        expect(transformed.hasData).to.be.true;
        expect(transformed).to.have.property('availablePeriods');
      }
    });
  });
});
