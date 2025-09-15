import { describe, it, beforeEach } from 'mocha';
import { expect } from 'chai';
import { GetVersionInfoTool } from '../src/tools/system/getVersionInfo.js';
import { AutoUpdater } from '../src/utils/autoUpdater.js';

describe('GetVersionInfoTool', function() {
  let versionTool;
  let mockSession;
  let mockAutoUpdater;
  
  beforeEach(function() {
    mockAutoUpdater = new AutoUpdater();
    
    // Use apiOptions to test API connection info
    const apiOptions = {
      tokenType: 'mcp'
    };
    
    versionTool = new GetVersionInfoTool(mockAutoUpdater, apiOptions);
    
    mockSession = {
      userId: 'test-user-123',
      sessionId: 'test-session-456',
      selectedChildId: 'test-child-789'
    };
  });

  describe('tool definition', function() {
    it('should have correct tool definition', function() {
      const definition = GetVersionInfoTool.definition;
      
      expect(definition).to.have.property('name', 'get_version_info');
      expect(definition).to.have.property('description');
      expect(definition.description).to.include('version');
      expect(definition.description).to.include('API connection');
      expect(definition).to.have.property('inputSchema');
      expect(definition.inputSchema.type).to.equal('object');
      expect(definition.inputSchema.required).to.be.an('array').that.is.empty;
    });
  });

  describe('execute', function() {
    it('should return comprehensive version information', async function() {
      const result = await versionTool.execute({}, mockSession);
      
      // Check MCP info
      expect(result).to.have.property('mcp');
      expect(result.mcp).to.have.property('name', '@villagemetrics-public/ask-anything-mcp');
      expect(result.mcp).to.have.property('version');
      expect(result.mcp.version).to.match(/^\d+\.\d+\.\d+$/);
      expect(result.mcp).to.have.property('description');
      expect(result.mcp).to.have.property('npmRegistry');
      
      // Check runtime info
      expect(result).to.have.property('runtime');
      expect(result.runtime).to.have.property('nodeVersion');
      expect(result.runtime).to.have.property('platform');
      expect(result.runtime).to.have.property('architecture');
      
      // Check process info
      expect(result).to.have.property('process');
      expect(result.process).to.have.property('pid');
      expect(result.process).to.have.property('uptime');
      expect(result.process).to.have.property('memoryUsage');
      
      // Check session info
      expect(result).to.have.property('session');
      expect(result.session).to.have.property('userId', 'test-user-123');
      expect(result.session).to.have.property('sessionId', 'test-session-456');
      expect(result.session).to.have.property('selectedChildId', 'test-child-789');
      
      // Check API connection info
      expect(result).to.have.property('api');
      expect(result.api).to.have.property('baseUrl');
      expect(result.api.baseUrl).to.be.a('string');
      expect(result.api.baseUrl).to.match(/^https:\/\//); // Must be HTTPS
      expect(result.api).to.have.property('tokenType', 'mcp');
      expect(result.api.tokenType).to.be.oneOf(['mcp', 'auth']);
      
      // Check auto-updater info
      expect(result).to.have.property('autoUpdater');
      expect(result.autoUpdater).to.have.property('packageName');
      expect(result.autoUpdater).to.have.property('currentVersion');
      
      // Check support info
      expect(result).to.have.property('supportInfo');
      expect(result.supportInfo).to.have.property('message');
      expect(result.supportInfo).to.have.property('githubIssues');
      
      // Check timestamp
      expect(result).to.have.property('timestamp');
      expect(new Date(result.timestamp)).to.be.instanceOf(Date);
    });
    
    it('should handle missing autoUpdater gracefully', async function() {
      const toolWithoutUpdater = new GetVersionInfoTool(null, {});
      const result = await toolWithoutUpdater.execute({}, mockSession);
      
      expect(result).to.have.property('autoUpdater');
      expect(result.autoUpdater).to.have.property('enabled', false);
      expect(result.autoUpdater).to.have.property('message', 'Auto-updater not available');
    });
    
    it('should include memory usage in human-readable format', async function() {
      const result = await versionTool.execute({}, mockSession);
      
      expect(result.runtime.totalMemory).to.match(/\d+(\.\d+)? GB/);
      expect(result.runtime.freeMemory).to.match(/\d+(\.\d+)? GB/);
      expect(result.process.memoryUsage.rss).to.match(/\d+(\.\d+)? MB/);
      expect(result.process.memoryUsage.heapTotal).to.match(/\d+(\.\d+)? MB/);
      expect(result.process.memoryUsage.heapUsed).to.match(/\d+(\.\d+)? MB/);
    });
    
    it('should include process uptime in seconds', async function() {
      const result = await versionTool.execute({}, mockSession);
      
      expect(result.process.uptime).to.match(/\d+ seconds/);
    });
    
    it('should support different token types', async function() {
      // Test with auth token type
      const authTool = new GetVersionInfoTool(mockAutoUpdater, { tokenType: 'auth' });
      const result = await authTool.execute({}, mockSession);
      
      expect(result.api).to.have.property('tokenType', 'auth');
      expect(result.api.tokenType).to.be.oneOf(['mcp', 'auth']);
    });
    
    it('should include API base URL for debugging', async function() {
      const result = await versionTool.execute({}, mockSession);
      
      // Should include the base URL (either from env or default)
      expect(result.api.baseUrl).to.be.a('string');
      expect(result.api.baseUrl.length).to.be.greaterThan(0);
      expect(result.api.baseUrl).to.match(/^https:\/\/.*\.villagemetrics\.com$/);
    });
  });
});