import { createLogger } from './logger.js';
import fetch from 'npm-registry-fetch';
import semver from 'semver';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';
import { promisify } from 'util';

const logger = createLogger('AutoUpdater');

export class AutoUpdater {
  constructor() {
    // Read package.json once at initialization
    const __dirname = dirname(fileURLToPath(import.meta.url));
    this.packageJson = JSON.parse(readFileSync(join(__dirname, '..', '..', 'package.json'), 'utf-8'));
    this.packageName = this.packageJson.name;
    this.currentVersion = this.packageJson.version;
    this.updateCheckInterval = null;
    this.lastCheckTime = null;
    
    logger.info('AutoUpdater initialized', { 
      packageName: this.packageName, 
      currentVersion: this.currentVersion 
    });
  }

  async checkForUpdates() {
    try {
      logger.debug('Checking for updates...');
      this.lastCheckTime = new Date();

      // Fetch package metadata from NPM registry
      const packageData = await fetch.json(this.packageName);
      const latestVersion = packageData['dist-tags'].latest;

      logger.debug('Version comparison', {
        current: this.currentVersion,
        latest: latestVersion,
        isNewer: semver.gt(latestVersion, this.currentVersion)
      });

      if (semver.gt(latestVersion, this.currentVersion)) {
        logger.info('Update available', {
          current: this.currentVersion,
          latest: latestVersion
        });

        await this.performUpdate(latestVersion);
        return true;
      } else {
        logger.debug('No update needed', {
          current: this.currentVersion,
          latest: latestVersion
        });
        return false;
      }
    } catch (error) {
      logger.error('Failed to check for updates', { 
        error: error.message,
        stack: error.stack 
      });
      return false;
    }
  }

  async performUpdate(newVersion) {
    try {
      logger.info('Starting update process', {
        from: this.currentVersion,
        to: newVersion
      });

      // Install the new version globally using npm
      const installCommand = 'npm';
      const installArgs = ['install', '-g', `${this.packageName}@${newVersion}`];

      logger.info('Running update command', {
        command: installCommand,
        args: installArgs
      });

      const installProcess = spawn(installCommand, installArgs, {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      // Collect output
      let stdout = '';
      let stderr = '';

      installProcess.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      installProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      // Wait for process to complete
      await new Promise((resolve, reject) => {
        installProcess.on('close', (code) => {
          if (code === 0) {
            logger.info('Update completed successfully', {
              version: newVersion,
              stdout: stdout.trim()
            });
            resolve();
          } else {
            logger.error('Update failed', {
              code,
              stdout: stdout.trim(),
              stderr: stderr.trim()
            });
            reject(new Error(`Update failed with code ${code}: ${stderr}`));
          }
        });

        installProcess.on('error', (error) => {
          logger.error('Update process error', { error: error.message });
          reject(error);
        });
      });

      // If we get here, the update was successful
      logger.info('Update successful - new version ready on next restart', {
        from: this.currentVersion,
        to: newVersion,
        message: 'New version will be active when MCP client restarts'
      });
      
      // Set flag that update is pending
      this.pendingUpdateVersion = newVersion;
      
      // IMPORTANT: Do NOT call process.exit() here!
      // Previously we called process.exit(0) which killed the MCP server process
      // and broke the stdio connection to Claude/MCP clients, causing them to hang.
      // Instead, we keep the current version running and notify users that a restart
      // is needed to activate the new version. The update is already installed globally
      // and will be used the next time the MCP client starts this server.

    } catch (error) {
      logger.error('Update process failed', {
        error: error.message,
        stack: error.stack
      });
      throw error;
    }
  }

  startPeriodicChecks(intervalHours = 1) {
    // Clear any existing interval
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
    }

    const intervalMs = intervalHours * 60 * 60 * 1000; // Convert hours to milliseconds
    
    logger.info('Starting periodic update checks', { intervalHours });

    // Check immediately on startup
    this.checkForUpdates().catch(error => {
      logger.error('Initial update check failed', { error: error.message });
    });

    // Then check periodically
    this.updateCheckInterval = setInterval(() => {
      this.checkForUpdates().catch(error => {
        logger.error('Periodic update check failed', { error: error.message });
      });
    }, intervalMs);
  }

  stopPeriodicChecks() {
    if (this.updateCheckInterval) {
      clearInterval(this.updateCheckInterval);
      this.updateCheckInterval = null;
      logger.info('Stopped periodic update checks');
    }
  }

  getUpdateStatus() {
    return {
      packageName: this.packageName,
      currentVersion: this.currentVersion,
      lastCheckTime: this.lastCheckTime,
      periodicChecksEnabled: !!this.updateCheckInterval,
      pendingUpdateVersion: this.pendingUpdateVersion || null,
      hasPendingUpdate: !!this.pendingUpdateVersion
    };
  }

  getPendingUpdateNotification() {
    if (!this.pendingUpdateVersion) {
      return null;
    }
    
    return `📦 Update: Version ${this.pendingUpdateVersion} is installed. Restart your MCP client to use the new version.`;
  }
}