# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2025-01-10

### Added
- Initial release of Ask Anything MCP server
- Complete MCP server implementation for Village Metrics API integration
- Token-based authentication with VM_MCP_TOKEN support
- Comprehensive tool set for behavioral data, journal search, and analysis
- Data transformation layer optimized for LLM consumption (90%+ reduction)
- Stateful session management with child selection
- Full test suite with real API integration
- Documentation and quick start guide
- GitHub Actions workflow for automated NPM publishing

### Features
- **Child Selection**: List and select children for session context
- **Behavior Data**: Get behavior scores and date range metadata
- **Journal Search**: Semantic search of journal entries with data reduction
- **Journal Details**: Get full journal entries with analysis
- **Analysis Tools**: Overview, behavior, medication, hashtag, and journal analysis

### Technical
- Pure API client with no private package dependencies
- HTTPS enforcement for all API connections
- Comprehensive error handling with user-friendly messages
- Bunyan logging with configurable levels
- Node.js 18+ compatibility
