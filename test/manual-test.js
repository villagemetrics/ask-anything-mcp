import { spawn } from 'child_process';
import readline from 'readline';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables for manual testing
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Load non-secret environment variables first
dotenv.config({ path: path.join(projectRoot, '.env.local') });
// Load secret environment variables (overrides any duplicates)
dotenv.config({ path: path.join(projectRoot, '.env.secrets.local') });

// Create readline interface for interactive testing
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('Starting MCP server for manual testing...\n');

// Check for required token
if (!process.env.VM_API_TOKEN) {
  console.error('ERROR: VM_API_TOKEN not found in environment variables.');
  console.error('Please create .env.secrets.local with your JWT token.');
  console.error('See README.md for instructions on getting a token.');
  process.exit(1);
}

const env = {
  ...process.env,
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
  console.log('=== Basic Tools ===');
  console.log('1. List tools');
  console.log('2. List children');
  console.log('3. Select child');
  console.log('4. Get date range metadata');
  console.log('5. Get behavior scores');
  console.log('6. Search journal entries');
  console.log('7. Get journal entry');
  console.log('8. Get journal entry details');
  console.log('=== Analysis Tools ===');
  console.log('9. Get overview analysis');
  console.log('10. Get behavior analysis');
  console.log('11. Get medication analysis');
  console.log('12. Get medication detailed analysis');
  console.log('13. Get journal analysis');
  console.log('14. Get hashtag analysis');
  console.log('=== Other ===');
  console.log('15. Send custom JSON-RPC');
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
        
      case '7':
        rl.question('Enter journal entry ID: ', (journalEntryId) => {
          sendMessage('tools/call', {
            name: 'get_journal_entry',
            arguments: { journalEntryId }
          });
          setTimeout(showMenu, 5000);
        });
        break;
        
      case '8':
        rl.question('Enter journal entry ID: ', (journalEntryId) => {
          sendMessage('tools/call', {
            name: 'get_journal_entry_details',
            arguments: { journalEntryId }
          });
          setTimeout(showMenu, 5000);
        });
        break;
        
      case '9':
        rl.question('Enter time range (last_7_days, last_30_days, last_90_days, last_180_days, last_365_days): ', (timeRange) => {
          sendMessage('tools/call', {
            name: 'get_overview_analysis',
            arguments: { timeRange }
          });
          setTimeout(showMenu, 8000); // Longer timeout for analysis
        });
        break;
        
      case '10':
        rl.question('Enter time range (last_7_days, last_30_days, last_90_days, last_180_days, last_365_days): ', (timeRange) => {
          sendMessage('tools/call', {
            name: 'get_behavior_analysis',
            arguments: { timeRange }
          });
          setTimeout(showMenu, 8000);
        });
        break;
        
      case '11':
        rl.question('Enter time range (last_7_days, last_30_days, last_90_days, last_180_days, last_365_days): ', (timeRange) => {
          sendMessage('tools/call', {
            name: 'get_medication_analysis',
            arguments: { timeRange }
          });
          setTimeout(showMenu, 8000);
        });
        break;
        
      case '12':
        rl.question('Enter cocktail ID (from medication analysis): ', (cocktailId) => {
          sendMessage('tools/call', {
            name: 'get_medication_detailed_analysis',
            arguments: { cocktailId }
          });
          setTimeout(showMenu, 10000); // Extra time for detailed analysis
        });
        break;
        
      case '13':
        rl.question('Enter time range (last_7_days, last_30_days, last_90_days, last_180_days, last_365_days): ', (timeRange) => {
          sendMessage('tools/call', {
            name: 'get_journal_analysis',
            arguments: { timeRange }
          });
          setTimeout(showMenu, 8000);
        });
        break;
        
      case '14':
        console.log('Available hashtag types: BehaviorConcept, Incident, Activity, Emotion, Person, Place, RootCause, Outcome, BehaviorMethod, Food, Time, Object, Event, Action, HealthSymptom, EnvironmentalFactor, CommunicationMode');
        rl.question('Enter hashtag type: ', (hashtagType) => {
          rl.question('Enter time range (last_7_days, last_30_days, last_90_days, last_180_days, last_365_days): ', (timeRange) => {
            sendMessage('tools/call', {
              name: 'get_hashtag_analysis',
              arguments: { hashtagType, timeRange }
            });
            setTimeout(showMenu, 8000);
          });
        });
        break;
        
      case '15':
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
