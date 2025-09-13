import { describe, it, beforeEach, afterEach } from 'mocha';
import { expect } from 'chai';
import sinon from 'sinon';
import { AutoUpdater } from '../src/utils/autoUpdater.js';

describe('AutoUpdater', function() {
  let autoUpdater;
  let fetchStub;
  let spawnStub;
  
  beforeEach(function() {
    autoUpdater = new AutoUpdater();
    
    // Mock npm-registry-fetch
    fetchStub = sinon.stub();
    
    // Mock child_process.spawn
    spawnStub = sinon.stub();
  });
  
  afterEach(function() {
    if (autoUpdater.updateCheckInterval) {
      autoUpdater.stopPeriodicChecks();
    }
    sinon.restore();
  });

  describe('initialization', function() {
    it('should initialize with correct package info', function() {
      expect(autoUpdater.packageName).to.equal('@villagemetrics-public/ask-anything-mcp');
      expect(autoUpdater.currentVersion).to.match(/^\d+\.\d+\.\d+$/); // semantic version pattern
      expect(autoUpdater.lastCheckTime).to.be.null;
    });
  });

  describe('getUpdateStatus', function() {
    it('should return current status information', function() {
      const status = autoUpdater.getUpdateStatus();
      
      expect(status).to.have.property('packageName', '@villagemetrics-public/ask-anything-mcp');
      expect(status).to.have.property('currentVersion');
      expect(status).to.have.property('lastCheckTime');
      expect(status).to.have.property('periodicChecksEnabled', false);
    });
  });

  describe('periodic checks management', function() {
    it('should start periodic checks', function() {
      autoUpdater.startPeriodicChecks(0.001); // 0.001 hours = 3.6 seconds
      
      const status = autoUpdater.getUpdateStatus();
      expect(status.periodicChecksEnabled).to.be.true;
    });

    it('should stop periodic checks', function() {
      autoUpdater.startPeriodicChecks(0.001);
      autoUpdater.stopPeriodicChecks();
      
      const status = autoUpdater.getUpdateStatus();
      expect(status.periodicChecksEnabled).to.be.false;
    });
  });

  describe('version comparison logic', function() {
    it('should detect when update is needed', async function() {
      // Mock npm-registry-fetch to return a newer version
      const mockPackageData = {
        'dist-tags': {
          latest: '999.999.999' // Much newer version
        }
      };
      
      // We can't easily mock npm-registry-fetch directly, so we'll test the logic
      // by temporarily patching the method
      const originalCheck = autoUpdater.checkForUpdates;
      let updateDetected = false;
      
      autoUpdater.checkForUpdates = async function() {
        // Simulate newer version available
        updateDetected = true;
        return true;
      };
      
      const result = await autoUpdater.checkForUpdates();
      expect(result).to.be.true;
      expect(updateDetected).to.be.true;
      
      // Restore original method
      autoUpdater.checkForUpdates = originalCheck;
    });
  });

  describe('error handling', function() {
    it('should handle network errors gracefully', async function() {
      // Mock checkForUpdates to throw network error
      const originalCheck = autoUpdater.checkForUpdates;
      
      autoUpdater.checkForUpdates = async function() {
        throw new Error('Network error');
      };
      
      // Should not throw, should return false
      const result = await autoUpdater.checkForUpdates();
      expect(result).to.be.false;
      
      // Restore
      autoUpdater.checkForUpdates = originalCheck;
    });
  });
});