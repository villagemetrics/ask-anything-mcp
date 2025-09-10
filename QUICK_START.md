# Quick Start Guide

## Installation

```bash
cd ~/devel/vm/ask-anything-mcp
npm install
```

## Testing Locally

### 1. Get Your MCP Token

**For testing, you need a Village Metrics MCP token** (generated specifically for connecting AI tools).

**How to get it**:
1. Log into the Village Metrics app
2. Go to Settings → Connect AI Tools
3. Click "Generate Token"
4. Accept the consent terms
5. Copy the generated MCP token (starts with `vm_mcp_`)

**Note**: MCP tokens are separate from regular user JWT tokens and are designed specifically for AI tool integration with limited permissions.

### 2. Manual Testing (Recommended First)

```bash
# Set your MCP token
export VM_MCP_TOKEN="vm_mcp_a1b2_c3d4_e5f6_g7h8"  # Your MCP token from step 1
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
        "VM_MCP_TOKEN": "vm_mcp_xxxx_xxxx_xxxx_xxxx",
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
1. **Check token expiration**: MCP tokens expire based on your selected period (90 days, 1 year, 2 years)
2. **Generate a new token**: Go to Settings → Connect AI Tools in the Village Metrics app
3. **Verify token format**: Should start with `vm_mcp_` (MCP token format)
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
3. Enhance MCP token validation and error handling
4. Publish as public npm package
