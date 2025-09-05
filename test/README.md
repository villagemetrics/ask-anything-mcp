# Testing

## Prerequisites

Tests require real Village Metrics API access:

```bash
export VM_API_TOKEN="<your_jwt_token>"
export VM_API_BASE_URL="https://api-dev.villagemetrics.com"
```

## Running Tests

```bash
npm test        # Run all tests (unit + integration)
npm run test:manual  # Interactive MCP testing
```

## Test Organization

Tests are organized by **feature/tool**, not by test type. Each test file includes both:
- **Unit tests** for data transformations (mocked where needed)
- **Integration tests** for API calls (real API)

```
test/
  ├── tools/
  │   ├── behaviorScores.test.js     # Behavior data transformation + API
  │   ├── dateRangeMetadata.test.js  # Date range transformation + API  
  │   └── childSelection.test.js     # Child listing/selection + API
  └── README.md
```

## Test Approach

Following Village Metrics patterns:
- **Prefer real API calls** over mocking
- **Mock only when necessary** (unpredictable data like date ranges)
- **Single test command** - no separation of unit vs integration
- **Tests fail clearly** if dependencies (token, API access) are missing
