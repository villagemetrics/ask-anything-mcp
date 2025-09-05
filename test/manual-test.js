import { spawn } from 'child_process';
import readline from 'readline';

// Create readline interface for interactive testing
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Starting MCP server for manual testing...\n');

// Set test token (you'll need to replace with a real one)
const env = {
  ...process.env,
  VM_API_TOKEN: process.env.VM_API_TOKEN || 'your_test_token_here',
  VM_LOG_LEVEL: 'debug'
};

// Spawn the MCP server
const mcp = spawn('node', ['src/index.js'], { env });

let messageId = 1;

// Handle server stderr (logs)
mcp.stderr.on('data', (data) => {
  console.error('[SERVER LOG]:', data.toString());
});

// Handle server stdout (MCP responses)
mcp.stdout.on('data', (data) => {
  try {
    const response = JSON.parse(data.toString());
    console.log('\n[MCP RESPONSE]:');
    
    // Pretty print the content if it's JSON
    if (response.result?.content?.[0]?.text) {
      try {
        const contentJson = JSON.parse(response.result.content[0].text);
        console.log('Content (formatted):');
        console.log(JSON.stringify(contentJson, null, 2));
        console.log('\nFull Response:');
        console.log(JSON.stringify(response, null, 2));
      } catch (e) {
        // Not JSON content, show as-is
        console.log(JSON.stringify(response, null, 2));
      }
    } else {
      console.log(JSON.stringify(response, null, 2));
    }
  } catch (e) {
    console.log('[RAW OUTPUT]:', data.toString());
  }
  console.log('\n---\n');
});

// Handle server errors
mcp.on('error', (error) => {
  console.error('Failed to start MCP server:', error);
  process.exit(1);
});

// Send test messages
function sendMessage(method, params = {}) {
  const message = {
    jsonrpc: "2.0",
    id: messageId++,
    method: method,
    params: params
  };
  
  console.log('[SENDING]:', JSON.stringify(message, null, 2));
  mcp.stdin.write(JSON.stringify(message) + '\n');
}

// Interactive menu
function showMenu() {
  console.log('\nAvailable commands:');
  console.log('1. List tools');
  console.log('2. List children');
  console.log('3. Select child');
  console.log('4. Get date range metadata');
  console.log('5. Get behavior scores');
  console.log('6. Search journals');
  console.log('9. Send custom JSON-RPC');
  console.log('q. Quit');
  console.log('');
  
  rl.question('Enter command: ', (answer) => {
    switch(answer) {
      case '1':
        sendMessage('tools/list');
        setTimeout(showMenu, 5000);
        break;
        
      case '2':
        sendMessage('tools/call', {
          name: 'list_children',
          arguments: {}
        });
        setTimeout(showMenu, 5000); // Give more time for response
        break;
        
      case '3':
        rl.question('Enter child name: ', (childName) => {
          sendMessage('tools/call', {
            name: 'select_child',
            arguments: { childName }
          });
          setTimeout(showMenu, 5000);
        });
        break;
        
      case '4':
        sendMessage('tools/call', {
          name: 'get_date_range_metadata',
          arguments: {}
        });
        setTimeout(showMenu, 5000);
        break;
        
      case '5':
        rl.question('Enter date (YYYY-MM-DD): ', (date) => {
          sendMessage('tools/call', {
            name: 'get_behavior_scores',
            arguments: { date }
          });
          setTimeout(showMenu, 5000);
        });
        break;
        
      case '6':
        rl.question('Enter search query: ', (query) => {
          sendMessage('tools/call', {
            name: 'search_journals',
            arguments: { query }
          });
          setTimeout(showMenu, 5000);
        });
        break;
        
      case '9':
        rl.question('Enter JSON-RPC message: ', (json) => {
          try {
            const message = JSON.parse(json);
            mcp.stdin.write(JSON.stringify(message) + '\n');
          } catch (e) {
            console.error('Invalid JSON:', e.message);
          }
          setTimeout(showMenu, 5000);
        });
        break;
        
      case 'q':
        console.log('Shutting down...');
        mcp.kill();
        rl.close();
        process.exit(0);
        break;
        
      default:
        console.log('Unknown command');
        showMenu();
    }
  });
}

// Wait for server to start, then show menu
setTimeout(() => {
  console.log('Server started. Testing connection...\n');
  sendMessage('tools/list');
  setTimeout(showMenu, 2000);
}, 500);
