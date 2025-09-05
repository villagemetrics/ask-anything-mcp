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
- **Math Tools**: Calculations to avoid LLM arithmetic
- **More tools**: Medications, analysis data (coming soon)

For detailed technical information, see [docs/design.md](docs/design.md).