# Ask Anything MCP
*Model Context Protocol server for Village Metrics behavioral tracking data*

An MCP server that provides AI agents with access to Village Metrics data through authenticated API calls. This server acts as a bridge between AI assistants (like Claude) and the Village Metrics API, transforming verbose responses into LLM-optimized formats.

Enables AI agents to query behavioral tracking data, journal entries, and analysis results for authenticated users.

## Architecture

- **Pure API Client**: No direct dependencies on private packages
- **Data Transformation**: Converts verbose API responses to LLM-friendly formats
- **Stateful Sessions**: Manages child selection and context across tool calls
- **Token-Based Authentication**: Validates user access via Village Metrics JWT tokens
