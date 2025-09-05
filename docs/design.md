# Ask Anything MCP Server - Technical Design

## 1. Overview

This MCP server provides AI agents with access to Village Metrics behavioral data through a stateful, session-based interface. The server acts as a pure API client, transforming verbose Village Metrics API responses into concise, LLM-optimized formats.

**Key Features**:
- **Stateful Sessions**: Select child once, use for all subsequent tools
- **Data Transformation**: 90%+ reduction in API response size
- **Pure API Client**: No dependencies on private Village Metrics packages
- **Comprehensive Tools**: Child selection, behavior data, journal search, analysis tools

## 2. Project Structure

```
ask-anything-mcp/
├── src/
│   ├── index.js              # MCP server entry point
│   ├── auth/                 # JWT validation
│   ├── session/              # Stateful session management
│   ├── tools/                # Tool implementations
│   │   ├── session/          # Child selection tools
│   │   ├── tracking/         # Behavior data tools
│   │   ├── journal/          # Journal search tools
│   │   ├── medical/          # Medication tools
│   │   ├── analysis/         # Analysis tools
│   │   └── math/             # Math calculation tools
│   ├── transformers/         # API response condensation
│   ├── clients/              # Village Metrics API client
│   └── utils/                # Logging utilities
├── test/                     # Mocha tests organized by tool
├── docs/
│   └── design.md             # MCP-specific technical details
└── package.json
```

### Abstraction Layers Explained

1. **API Client Layer** (`clients/vmApiClient.js`)
   - Makes raw HTTP calls to Village Metrics API
   - Returns unmodified API responses
   - Handles authentication and errors

2. **Tool Layer** (`tools/*/*.js`)
   - Implements MCP tool interface
   - Manages session state (stateful)
   - Calls API client for data
   - Passes data to transformers

3. **Transformer Layer** (`transformers/*.js`)
   - Converts verbose API responses to LLM-friendly format
   - Reduces token usage by 50%+
   - Preserves semantic meaning

## 3. Authentication Flow

### 3.1 Token Generation (Via Existing API)
```javascript
// Mobile app calls YOUR EXISTING API (not MCP) to generate token
// This endpoint would be added to api.villagemetrics.com
const response = await api.post('/v1/auth/mcp-token', {
  purpose: 'claude_desktop_access',
  expiresIn: '30d'  // Long-lived for desktop use
  // Mobile app can request different expiry based on use case
});

// Returns your existing JWT token or a new scoped token
{
  "token": "existing_jwt_token_or_scoped_version",
  "expiresAt": "2024-02-15T12:00:00Z",
  "permissions": ["read", "write"]  // Support both read and write operations
  // Write permissions would enable future tools like:
  // - create_behavior_goal
  // - delete_behavior_goal
  // - add_journal_entry
}
```

### 3.2 MCP Server Validation
```javascript
class TokenValidator {
  async validateToken(token) {
    // Verify JWT signature
    const decoded = jwt.verify(token, publicKey);
    
    // Extract user context
    return {
      userId: decoded.sub,
      permissions: decoded.permissions,
      expiresAt: decoded.exp
    };
  }
}
```

## 4. Session Management

### 4.1 Session State
```javascript
class SessionManager {
  constructor() {
    this.sessions = new Map();
  }
  
  createSession(userId) {
    const session = {
      userId,
      selectedChildId: null,
      childrenCache: null,
      createdAt: Date.now()
    };
    const sessionId = uuid();
    this.sessions.set(sessionId, session);
    return sessionId;
  }
  
  setSelectedChild(sessionId, childId) {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.selectedChildId = childId;
    }
  }
}
```

## 5. Tool Implementation

### 5.1 Tool Manifest Structure

**Note**: We'll migrate and adapt the existing tool manifest from `ask-anything-engine/src/tools/manifest.yaml` as our starting point.

```javascript
const toolManifest = {
  tools: [
    {
      name: "list_children",
      description: "List all children you have access to",
      inputSchema: {
        type: "object",
        properties: {},
        required: []
      }
      // Output: List of children with names and IDs
    },
    {
      name: "select_child", 
      description: "Select a child to work with by name. This sets the active child for all subsequent tool calls in this session.",
      inputSchema: {
        type: "object",
        properties: {
          childName: {
            type: "string",
            description: "Name of the child (can be full name, preferred name, or nickname)"
          }
        },
        required: ["childName"]
      }
      // Effect: Sets session state with childId
      // Output: Confirmation message with selected child name
    },
    {
      name: "get_behavior_scores",
      description: "Get behavior tracking scores for the selected child",
      inputSchema: {
        type: "object",
        properties: {
          date: {
            type: "string",
            format: "date",
            description: "Date (YYYY-MM-DD)"
          }
        },
        required: ["date"]
      }
      // Note: Uses childId from session state (set by select_child)
      // Output: Behavior scores as numbers (1.0-4.0) for each goal
    }
    // ... additional tools based on API endpoints
  ]
};
```

### 5.2 Tool Handler Example
```javascript
async function handleGetBehaviorScores(params, session) {
  // Check child selection
  if (!session.selectedChildId) {
    throw new Error("No child selected. Please use 'select_child' first.");
  }
  
  // Call API
  const rawData = await vmApiClient.get(
    `/v1/children/${session.selectedChildId}/track-data/${params.startDate}`
  );
  
  // Transform data
  return transformBehaviorData(rawData);
}
```

## 6. Data Transformation Layer

### 6.1 Transformation Principles
- Remove internal IDs and metadata
- Summarize arrays over 10 items
- Convert verbose enums to readable strings
- Add natural language summaries for complex data
- Preserve semantic meaning while reducing tokens

### 6.2 Example Transformation
```javascript
function transformBehaviorData(raw) {
  // From: 50+ fields with metadata, IDs, timestamps
  // To: Concise, meaningful data
  
  // Extract actual numeric scores for each goal
  const scores = {};
  raw.goals.forEach(goal => {
    // Preserve exact decimal values (1.0 - 4.0)
    scores[goal.name] = goal.score;
  });
  
  return {
    date: raw.date,
    scores: scores,  // Numeric values preserved for LLM analysis
    // Add goal-specific context
    goalDescriptions: {
      // Map scores to meaningful labels per goal
      // 1: "Struggling", 2: "Emerging", 3: "Capable", 4: "Thriving"
    },
    averageScore: calculateAverage(Object.values(scores)),
    noteCount: raw.journalEntries?.length || 0,
    highlightedNote: raw.journalEntries?.[0]?.snippet || null,
    // Don't generate overall summary - let LLM interpret based on individual goals
  };
}
```

## 7. MCP Protocol Implementation

### 7.1 Server Initialization
```javascript
#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

const server = new Server({
  name: "ask-anything-mcp",
  version: "1.0.0"
}, {
  capabilities: {
    tools: {}
  }
});

// Register tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return { tools: toolManifest.tools };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  return await handleToolCall(name, args);
});

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
```

### 7.2 Error Handling
```javascript
class MCPError extends Error {
  constructor(message, code, details) {
    super(message);
    this.code = code;
    this.details = details;
  }
}

async function handleToolCall(toolName, args) {
  try {
    const result = await executeToolCall(toolName, args);
    return {
      content: [{
        type: "text",
        text: JSON.stringify(result, null, 2)
      }]
    };
  } catch (error) {
    if (error instanceof MCPError) {
      return {
        content: [{
          type: "text",
          text: `Error: ${error.message}\nDetails: ${error.details}`
        }],
        isError: true
      };
    }
    throw error;
  }
}
```

## 8. Configuration

### 8.1 Environment Variables
```bash
# Required
VM_API_BASE_URL=https://api-dev.villagemetrics.com  # Full URL (api-dev for dev, api for prod)
VM_API_TOKEN=<user_jwt_token>  # User's JWT from login (NOT admin token)

# Optional
VM_LOG_LEVEL=info  # Bunyan log levels: trace, debug, info, warn, error, fatal
VM_CACHE_TTL=300
VM_MAX_RESULTS=10
```

### 8.2 Getting a User Token
For testing, you need a real user JWT token from Village Metrics:

1. **Current method** (manual):
   - Log into the dev environment app
   - Use browser dev tools to capture JWT from API calls
   - Export as `VM_API_TOKEN`

2. **Future method** (streamlined):
   - App provides "Generate MCP Token" button
   - Returns long-lived token for desktop use

### 8.2 Claude Desktop Configuration
```json
{
  "mcpServers": {
    "ask-anything": {
      "command": "npx",
      "args": ["@villagemetrics/ask-anything-mcp"],
      "env": {
        "VM_API_TOKEN": "<token_from_app>"
      }
    }
  }
}
```

## 9. Testing Strategy

### 9.1 Unit Tests
```javascript
describe('Behavior Data Transformer', () => {
  it('should condense behavior data correctly', () => {
    const raw = loadFixture('raw-behavior-data.json');
    const result = transformBehaviorData(raw);
    
    expect(result.scores).toBeDefined();
    expect(result.summary).toMatch(/day/);
    expect(Object.keys(result).length).toBeLessThan(
      Object.keys(raw).length / 2
    );
  });
});
```

### 9.2 Integration Tests
```javascript
describe('MCP Server', () => {
  it('should handle select_child tool', async () => {
    const response = await mcpClient.callTool('select_child', {
      childName: 'Sydney'
    });
    
    expect(response.content[0].text).toContain('Selected child: Sydney');
  });
});
```

## 10. Deployment

### 10.1 NPM Package
```json
{
  "name": "@villagemetrics/ask-anything-mcp",
  "version": "1.0.0",
  "bin": {
    "ask-anything-mcp": "./src/index.js"
  },
  "type": "module",
  "dependencies": {
    "@modelcontextprotocol/sdk": "^0.5.0",
    "axios": "^1.6.0",
    "jsonwebtoken": "^9.0.0"
  }
}
```

### 10.2 Usage Instructions
```bash
# Install globally
npm install -g @villagemetrics/ask-anything-mcp

# Or use directly with npx
npx @villagemetrics/ask-anything-mcp
```

## 11. Security Considerations

- JWT tokens are validated on every request
- All API calls use HTTPS
- Tokens are read-only with minimal permissions
- No PHI is logged or cached beyond session
- Session data is cleared after 24 hours
- Rate limiting prevents abuse

## 12. Future Enhancements

- [ ] Streaming responses for large datasets
- [ ] Caching layer for frequently accessed data
- [ ] WebSocket transport for persistent connections
- [ ] Multi-language support for international users
- [ ] Custom tool definitions per user
- [ ] Batch operations for efficiency
