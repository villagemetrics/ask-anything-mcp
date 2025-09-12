#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createLogger } from './utils/logger.js';
import { ToolRegistry } from './tools/registry.js';
import { SessionManager } from './session/sessionManager.js';
import { TokenValidator } from './auth/tokenValidator.js';

const logger = createLogger('MCPServer');

// Read version from package.json
import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageJson = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf-8'));

// Initialize server
const server = new Server(
  {
    name: "ask-anything-mcp",
    version: packageJson.version,
    description: "Access VillageMetrics behavioral tracking data for families with children who have behavioral challenges. VillageMetrics transforms daily voice journal entries into behavioral insights through AI analysis. Query journal entries, behavior scores, medication tracking, and analysis to understand patterns and support child development.",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Initialize components
const tokenValidator = new TokenValidator();
const sessionManager = new SessionManager();
const toolRegistry = new ToolRegistry(sessionManager, tokenValidator);

// Validate token on startup
async function validateEnvironment() {
  const token = process.env.VM_MCP_TOKEN;
  if (!token) {
    logger.error('VM_MCP_TOKEN environment variable is required');
    process.stderr.write('ERROR: VM_MCP_TOKEN environment variable is required\n');
    process.stderr.write('Please set your MCP token from Village Metrics and try again.\n');
    process.exit(1);
  }

  try {
    const userContext = await tokenValidator.validateToken(token);
    const sessionId = sessionManager.createSession(userContext.userId);
    logger.info('MCP server initialized successfully', { userId: userContext.userId, sessionId });
    
    // Store session ID globally for this process
    server.sessionId = sessionId;
    return { userContext, sessionId };
  } catch (error) {
    logger.error('Token validation failed', { error: error.message });
    process.stderr.write(`ERROR: Invalid token - ${error.message}\n`);
    process.stderr.write('Please check your VM_MCP_TOKEN and try again.\n');
    process.exit(1);
  }
}

// Register handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  logger.debug('Listing available tools');
  return {
    tools: toolRegistry.getToolDefinitions(),
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  logger.debug('Tool call requested', { tool: name, args });

  try {
    const result = await toolRegistry.executeTool(name, args, server.sessionId);
    
    return {
      content: [
        {
          type: "text",
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error) {
    logger.error('Tool execution failed', { tool: name, error: error.message });
    
    return {
      content: [
        {
          type: "text",
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start server
async function main() {
  // This will exit(1) if token validation fails
  const { userContext } = await validateEnvironment();
  
  const transport = new StdioServerTransport();
  await server.connect(transport);
  
  logger.info('MCP server started and listening on stdio', { userId: userContext.userId });
  process.stderr.write('MCP server ready\n');
}

main().catch((error) => {
  logger.error('Failed to start MCP server', { error: error.message, stack: error.stack });
  
  process.stderr.write(`\nFATAL ERROR: MCP Server crashed during startup\n`);
  process.stderr.write(`Reason: ${error.message}\n`);
  
  if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch')) {
    process.stderr.write(`\nThis appears to be a network/API connection issue.\n`);
    process.stderr.write(`Please check:\n`);
    process.stderr.write(`1. VM_API_BASE_URL is set correctly: ${process.env.VM_API_BASE_URL}\n`);
    process.stderr.write(`2. You have internet connectivity\n`);
    process.stderr.write(`3. The Village Metrics API is accessible\n\n`);
  } else if (error.message.includes('node') || error.message.includes('binary')) {
    process.stderr.write(`\nThis appears to be a Node.js compatibility issue.\n`);
    process.stderr.write(`Please check:\n`);
    process.stderr.write(`1. You're using Node.js 18 or later\n`);
    process.stderr.write(`2. Your Node.js installation is compatible with your system architecture\n`);
    process.stderr.write(`3. Try running: npx @villagemetrics-public/ask-anything-mcp directly in terminal\n\n`);
  }
  
  process.stderr.write(`Full error details:\n${error.stack}\n\n`);
  process.stderr.write(`For more help, visit: https://github.com/villagemetrics/ask-anything-mcp/issues\n`);
  
  process.exit(1);
});
