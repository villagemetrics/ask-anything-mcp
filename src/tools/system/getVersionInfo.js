import { createLogger } from '../../utils/logger.js';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import os from 'os';
import { VMApiClient } from '../../clients/vmApiClient.js';

const logger = createLogger('GetVersionInfoTool');

export class GetVersionInfoTool {
  constructor(autoUpdater = null, apiOptions = {}) {
    // Read package.json once at initialization
    const __dirname = dirname(fileURLToPath(import.meta.url));
    this.packageJson = JSON.parse(readFileSync(join(__dirname, '..', '..', '..', 'package.json'), 'utf-8'));
    this.autoUpdater = autoUpdater;
    
    // Create API client to get base URL for debugging
    this.apiClient = new VMApiClient(apiOptions);
  }

  static get definition() {
    return {
      name: 'get_version_info',
      description: 'Get detailed version, system, and API connection information for the Ask Anything MCP. Useful for troubleshooting and support.',
      inputSchema: {
        type: 'object',
        properties: {},
        required: []
      }
    };
  }

  async execute(args, session) {
    try {
      const versionInfo = {
        mcp: {
          name: this.packageJson.name,
          version: this.packageJson.version,
          description: this.packageJson.description,
          author: this.packageJson.author,
          license: this.packageJson.license,
          npmRegistry: 'https://www.npmjs.com/package/@villagemetrics-public/ask-anything-mcp'
        },
        runtime: {
          nodeVersion: process.version,
          platform: process.platform,
          architecture: process.arch,
          osType: os.type(),
          osRelease: os.release(),
          totalMemory: `${Math.round(os.totalmem() / 1024 / 1024 / 1024 * 100) / 100} GB`,
          freeMemory: `${Math.round(os.freemem() / 1024 / 1024 / 1024 * 100) / 100} GB`
        },
        process: {
          pid: process.pid,
          uptime: `${Math.round(process.uptime())} seconds`,
          workingDirectory: process.cwd(),
          memoryUsage: {
            rss: `${Math.round(process.memoryUsage().rss / 1024 / 1024 * 100) / 100} MB`,
            heapTotal: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024 * 100) / 100} MB`,
            heapUsed: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024 * 100) / 100} MB`
          }
        },
        session: {
          userId: session.userId,
          sessionId: session.sessionId,
          selectedChildId: session.selectedChildId || 'none'
        },
        api: {
          baseUrl: this.apiClient.baseUrl,
          tokenType: this.apiClient.tokenType
        },
        autoUpdater: this.autoUpdater ? this.autoUpdater.getUpdateStatus() : {
          enabled: false,
          message: 'Auto-updater not available'
        },
        timestamp: new Date().toISOString()
      };

      logger.debug('Version info requested', { userId: session.userId });

      return {
        ...versionInfo,
        supportInfo: {
          message: 'For technical support, please include this version information when reporting issues.',
          contact: 'hello@villagemetrics.com',
          githubIssues: 'https://github.com/villagemetrics/ask-anything-mcp/issues',
          documentation: 'https://docs.villagemetrics.com/mcp'
        }
      };
    } catch (error) {
      logger.error('Failed to get version info', { error: error.message });
      throw new Error(`Failed to get version info: ${error.message}`);
    }
  }
}