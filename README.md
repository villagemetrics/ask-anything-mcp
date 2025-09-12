# Ask Anything MCP
*Model Context Protocol server for Village Metrics behavioral tracking data*

An MCP server that provides AI agents with access to Village Metrics data through authenticated API calls. Acts as a bridge between AI assistants (like Claude) and the Village Metrics API, transforming verbose responses into LLM-optimized formats.

Enables AI agents to query behavioral tracking data, journal entries, and analysis results for authenticated users.

## Quick Start

See [QUICK_START.md](QUICK_START.md) for installation and testing instructions.

## Usage Modes

### 1. MCP Server Mode
Run as a Model Context Protocol server for Claude Desktop or other MCP clients.

### 2. Library Mode (Internal Use)
**Note: Library mode is designed specifically for internal Village Metrics ecosystem integration.** While this package is public on npm, library mode is primarily intended for Village Metrics' own closed-source applications (like ask-anything-engine) to reuse the MCP tool definitions, execution logic, and data transformations while maintaining tight integration with our AI chat experience. External users should use the standard MCP server mode with Claude Desktop or other MCP clients.

Library mode allows our internal services to leverage the same tool schemas and transformations used by the MCP server, ensuring consistency across our AI infrastructure while supporting user authentication tokens directly (rather than MCP tokens).

```javascript
import { MCPCore } from '@villagemetrics-public/ask-anything-mcp';

// Library mode with user auth token (internal use)
const mcpCore = new MCPCore({
  libraryMode: true,
  tokenType: 'auth',
  authToken: userAuthToken,    // User's regular auth token
  userId: 'user-123',
  childId: 'child-456',
  childPreferredName: 'Sydney'
});

// Execute tools directly
const result = await mcpCore.executeTool('get_medication_analysis', {
  timeRange: 'last_30_days'
});
```

## Architecture

- **Pure API Client**: No dependencies on private packages
- **Data Transformation**: Reduces API response size by 90%+
- **Stateful Sessions**: Select child once, use for all tools
- **Flexible Authentication**: MCP tokens OR user auth tokens
- **Multiple Modes**: MCP server, Library, or Schema-only

## Available Tools

- **Child Selection**: List and select children
- **Behavior Data**: Get behavior scores and date range metadata  
- **Journal Search**: Semantic search of journal entries with 97% data reduction
- **Journal Details**: Get full journal entries with core or detailed analysis
- **Analysis Tools**: Pre-computed behavioral insights and data analysis

For detailed technical information, see [docs/design.md](docs/design.md).

## Development & Testing

### Environment Setup

Create `.env.secrets.local` (gitignored) with authentication tokens:

```bash
# .env.secrets.local
VM_MCP_TOKEN=vm_mcp_xxxx_xxxx_xxxx_xxxx    # For MCP server mode
VM_AUTH_TOKEN=your_user_auth_token_here    # For library mode testing
```

**Getting an MCP Token:**
- Generate from Village Metrics app: Settings → Connect AI Tools → Generate Token
- Use the full token starting with `vm_mcp_` format

### Running Tests

```bash
npm test           # Run all tests (automatically loads .env files)
npm run test:manual  # Interactive MCP testing
```

### Generate Example Responses

Generate reference documentation with example responses from all MCP tools:

```bash
# Generate to local examples/ directory (gitignored for manual copy)
node scripts/generate-example-responses.js

# Generate directly to the product repo documentation
node scripts/generate-example-responses.js --output=../product/docs/mcp
```

This creates `ask-anything-mcp-tool-examples.md` with pretty-printed request/response examples for all tools, useful for debugging and documentation.

**Note:** The generated examples file contains real API responses with personal data, so it's excluded from this repo via `.gitignore`. The examples are published in the `@villagemetrics/product` repository at `docs/mcp/ask-anything-mcp-tool-examples.md`.

Tests use real API calls following Village Metrics patterns - no mocking unless necessary. Tests fail clearly if dependencies are missing.