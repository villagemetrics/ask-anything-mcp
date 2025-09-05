# Quick Start Guide

## Installation

```bash
cd ~/devel/vm/ask-anything-mcp
npm install
```

## Testing Locally

### 1. Get Your Authentication Token

**For testing, you need your regular Village Metrics user JWT token** (the same one you get when logging into the app).

**How to get it**:
1. Log into AWS Console with your `vmdev` profile
2. Go to DynamoDB
3. Find the authentication tokens table
4. Look up the token associated with your email address
5. Copy the token value

*Alternative*: Extract from browser dev tools by logging into the VM app and capturing the `Authorization: Bearer <token>` from API requests

**Note**: There's no special "MCP token" yet - we're using your normal user token. The MCP token endpoint mentioned in the design docs is a future enhancement to make this easier.

### 2. Manual Testing (Recommended First)

```bash
# Set your regular user JWT token
export VM_API_TOKEN="eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9..."  # Your JWT from step 1
export VM_API_BASE_URL="https://api-dev.villagemetrics.com"

# Run the manual test script
npm run test:manual
```

This will start an interactive session where you can:
1. List available tools
2. List children
3. Select a child
4. Get behavior scores

### 3. Testing with Claude Desktop (After Manual Testing Works)

Once manual testing works, you can try Claude Desktop:

#### Step 2: Configure Claude Desktop

Add to your Claude Desktop config file:
- Mac: `~/Library/Application Support/Claude/claude_desktop_config.json`
- Windows: `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "village-metrics": {
      "command": "node",
      "args": ["/Users/YOUR_USERNAME/devel/vm/ask-anything-mcp/src/index.js"],
      "env": {
        "VM_API_TOKEN": "your_jwt_token_here",
        "VM_API_BASE_URL": "https://api-dev.villagemetrics.com"
      }
    }
  }
}
```

#### Step 3: Restart Claude Desktop
Completely quit and restart Claude Desktop for the config to take effect.

#### Step 4: Test in Claude
Start a new conversation and try:
- "What tools do you have available?"
- "List the children I have access to"
- "Select Sydney"  
- "Get behavior scores for 2024-01-15"

## Troubleshooting

### Token Issues
If you see "Invalid token" errors:
1. **Check token expiration**: User JWTs typically expire after 24 hours
2. **Get a fresh token**: Log out and back into the app, capture new token
3. **Verify token format**: Should start with `eyJ` (JWT format)
4. **Check API URL**: Make sure you're using `api-dev.villagemetrics.com` for dev tokens

### Connection Issues  
If Claude can't connect to MCP:
1. Check the path in config is correct
2. Ensure Node.js is in your PATH
3. Check Claude Desktop logs: `~/Library/Logs/Claude/`

### Debug Logs
To see detailed logs:
```bash
export VM_LOG_LEVEL=debug
npm run dev
```

## Next Steps

Once basic testing works:
1. Add remaining tools (medications, analysis, etc.)
2. Test with Claude Desktop
3. Add proper JWT validation with public key
4. Publish as public npm package
