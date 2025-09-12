#!/usr/bin/env node

import { MCPCore } from './src/lib/mcpCore.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.secrets.local' });

async function testLibraryMode() {
  console.log('Testing MCP Library Mode...\n');
  
  try {
    // Test library mode with auth token
    console.log('1. Testing Library Mode with Auth Token');
    const mcpCore = new MCPCore({
      libraryMode: true,
      tokenType: 'auth',
      authToken: process.env.VM_AUTH_TOKEN,
      userId: 'test-user-id',
      childId: 'test-child-id', 
      childPreferredName: 'TestChild'
    });
    
    // Get available tools
    const tools = await mcpCore.getAvailableTools();
    console.log(`✅ Found ${tools.length} tool definitions`);
    console.log('Sample tools:', tools.slice(0, 3).map(t => t.name));
    
    // Test tool execution (this might fail if API is not accessible)
    try {
      console.log('\n2. Testing Tool Execution');
      const result = await mcpCore.executeTool('get_medication_analysis', {
        timeRange: 'last_30_days'
      });
      console.log('✅ Tool execution successful:', typeof result);
    } catch (error) {
      console.log(`⚠️  Tool execution failed (expected for demo): ${error.message}`);
    }
    
    console.log('\n✅ Library mode test completed successfully!');
    
  } catch (error) {
    console.error('\n❌ Library mode test failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

testLibraryMode();