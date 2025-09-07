# Ask Anything MCP
*Model Context Protocol server for Village Metrics behavioral tracking data*

An MCP server that provides AI agents with access to Village Metrics data through authenticated API calls. Acts as a bridge between AI assistants (like Claude) and the Village Metrics API, transforming verbose responses into LLM-optimized formats.

Enables AI agents to query behavioral tracking data, journal entries, and analysis results for authenticated users.

## Quick Start

See [QUICK_START.md](QUICK_START.md) for installation and testing instructions.

## Architecture

- **Pure API Client**: No dependencies on private packages
- **Data Transformation**: Reduces API response size by 90%+
- **Stateful Sessions**: Select child once, use for all tools
- **Token Authentication**: Uses Village Metrics JWT tokens

## Available Tools

- **Child Selection**: List and select children
- **Behavior Data**: Get behavior scores and date range metadata  
- **Journal Search**: Semantic search of journal entries with 97% data reduction
- **Journal Details**: Get full journal entries with core or detailed analysis
- **Math Tools**: Calculations to avoid LLM arithmetic (coming soon)
- **More tools**: Medications, analysis data (coming soon)

For detailed technical information, see [docs/design.md](docs/design.md).

## Development & Testing

### Environment Setup

Create `.env.secrets.local` (gitignored) with your JWT token:

```bash
# .env.secrets.local
VM_API_TOKEN=your_actual_jwt_token_here
```

**Getting a JWT Token:**
- Extract from AWS DynamoDB `user_tokens` table for your email
- Browser dev tools from VM app login → Network tab → Look for `Authorization: Bearer eyJ...`

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