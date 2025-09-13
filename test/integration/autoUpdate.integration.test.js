import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import { AutoUpdater } from '../../src/utils/autoUpdater.js';

describe('AutoUpdater Integration Tests', function() {
  let autoUpdater;
  
  // Longer timeout for network requests
  this.timeout(10000);
  
  beforeEach(function() {
    autoUpdater = new AutoUpdater();
  });
  
  afterEach(function() {
    if (autoUpdater.updateCheckInterval) {
      autoUpdater.stopPeriodicChecks();
    }
  });

  describe('NPM Registry Integration', function() {
    it('should successfully check NPM registry for package info', async function() {
      // This test actually hits NPM registry but doesn't update
      try {
        const result = await autoUpdater.checkForUpdates();
        
        // Should complete without throwing
        expect(typeof result).to.equal('boolean');
        
        // Should update lastCheckTime
        expect(autoUpdater.lastCheckTime).to.not.be.null;
        expect(autoUpdater.lastCheckTime).to.be.instanceOf(Date);
        
        // Check should have happened recently (within last 5 seconds)
        const timeDiff = Date.now() - autoUpdater.lastCheckTime.getTime();
        expect(timeDiff).to.be.lessThan(5000);
        
      } catch (error) {
        // If network is down, skip test gracefully
        if (error.message.includes('network') || error.message.includes('ENOTFOUND')) {
          this.skip();
        } else {
          throw error;
        }
      }
    });
    
    it('should handle NPM registry errors gracefully', async function() {
      // Create updater with invalid package name to test error handling
      const originalPackageName = autoUpdater.packageName;
      autoUpdater.packageName = 'this-package-definitely-does-not-exist-12345';
      
      const result = await autoUpdater.checkForUpdates();
      
      // Should return false (no update) rather than throw
      expect(result).to.be.false;
      
      // Restore original package name
      autoUpdater.packageName = originalPackageName;
    });
  });
  
  describe('Version Comparison', function() {
    it('should correctly identify when current version is latest', async function() {
      // Since we're testing with current version, should not detect update needed
      const result = await autoUpdater.checkForUpdates();
      
      // Current 0.1.6 should match NPM's latest (assuming just published)
      expect(result).to.be.false;
    });
  });
});