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

// Initialize server
const server = new Server(
  {
    name: "ask-anything-mcp",
    version: "0.1.0",
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
  const token = process.env.VM_API_TOKEN;
  if (!token) {
    logger.error('VM_API_TOKEN environment variable is required');
    process.stderr.write('ERROR: VM_API_TOKEN environment variable is required\n');
    process.stderr.write('Please set your JWT token from Village Metrics and try again.\n');
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
    process.stderr.write('Please check your VM_API_TOKEN and try again.\n');
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
  process.stderr.write(`FATAL ERROR: Failed to start MCP server - ${error.message}\n`);
  process.exit(1);
});
