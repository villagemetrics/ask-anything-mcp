import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Setup paths and environment
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.join(__dirname, '..');

// Load environment variables
dotenv.config({ path: path.join(projectRoot, '.env.local') });
dotenv.config({ path: path.join(projectRoot, '.env.secrets.local') });

// Check for required token
if (!process.env.VM_MCP_TOKEN) {
  console.error('ERROR: VM_MCP_TOKEN not found in environment variables.');
  console.error('Please create .env.secrets.local with your JWT token.');
  process.exit(1);
}

const env = {
  ...process.env,
  VM_LOG_LEVEL: 'warn' // Reduce log noise
};

let messageId = 1;
let outputContent = '';
let currentDate = new Date().toISOString();

// Parse command line arguments for output directory
const args = process.argv.slice(2);
const outputDirArg = args.find(arg => arg.startsWith('--output='));
const customOutputDir = outputDirArg ? outputDirArg.split('=')[1] : null;

// Output file - use custom directory if provided, otherwise default to local examples/
const outputDir = customOutputDir ? path.resolve(customOutputDir) : path.join(projectRoot, 'examples');
const outputFile = path.join(outputDir, 'ask-anything-mcp-tool-examples.md');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

// Tool configurations
const TOOLS = [
  {
    name: 'List Tools',
    method: 'tools/list',
    params: {}
  },
  {
    name: 'List Children',
    method: 'tools/call',
    params: {
      name: 'list_children',
      arguments: {}
    }
  },
  {
    name: 'Select Child (Sydney Kerwin)',
    method: 'tools/call',
    params: {
      name: 'select_child',
      arguments: { childName: 'Sydney Kerwin' }
    }
  },
  {
    name: 'Get Date Range Metadata',
    method: 'tools/call',
    params: {
      name: 'get_date_range_metadata',
      arguments: {}
    }
  },
  {
    name: 'Get Behavior Scores',
    method: 'tools/call',
    params: {
      name: 'get_behavior_scores',
      arguments: { date: new Date().toISOString().split('T')[0] } // Today's date
    }
  },
  {
    name: 'Search Journal Entries',
    method: 'tools/call',
    params: {
      name: 'search_journal_entries',
      arguments: { query: 'good day', limit: 3 }
    }
  },
  {
    name: 'Get Overview Analysis',
    method: 'tools/call',
    params: {
      name: 'get_overview_analysis',
      arguments: { timeRange: 'last_30_days' }
    }
  },
  {
    name: 'Get Behavior Analysis',
    method: 'tools/call',
    params: {
      name: 'get_behavior_analysis',
      arguments: { timeRange: 'last_30_days' }
    }
  },
  {
    name: 'Get Medication Analysis',
    method: 'tools/call',
    params: {
      name: 'get_medication_analysis',
      arguments: { timeRange: 'last_30_days' }
    }
  },
  {
    name: 'Get Journal Analysis',
    method: 'tools/call',
    params: {
      name: 'get_journal_analysis',
      arguments: { timeRange: 'last_30_days' }
    }
  },
  {
    name: 'Get Hashtag Analysis - BehaviorConcept',
    method: 'tools/call',
    params: {
      name: 'get_hashtag_analysis',
      arguments: { hashtagType: 'BehaviorConcept', timeRange: 'last_30_days' }
    }
  },
  {
    name: 'Get Hashtag Analysis - Activity',
    method: 'tools/call',
    params: {
      name: 'get_hashtag_analysis',
      arguments: { hashtagType: 'Activity', timeRange: 'last_30_days' }
    }
  },
  {
    name: 'Get Hashtag Analysis - Incident',
    method: 'tools/call',
    params: {
      name: 'get_hashtag_analysis',
      arguments: { hashtagType: 'Incident', timeRange: 'last_30_days' }
    }
  },
  {
    name: 'List Journal Entries',
    method: 'tools/call',
    params: {
      name: 'list_journal_entries',
      arguments: { timeRange: 'last_30_days' }
    }
  },
  {
    name: 'List Village Members',
    method: 'tools/call',
    params: {
      name: 'list_village_members',
      arguments: { includeInvitationDetails: true }
    }
  },
  {
    name: 'Submit Product Feedback',
    method: 'tools/call',
    params: {
      name: 'submit_product_feedback',
      arguments: { 
        feedbackText: 'The Ask Anything MCP tool is working great! This is an example feedback submission for documentation purposes.',
        source: 'ask-anything'
      }
    }
  }
];

// We'll add medication detailed analysis after we get a cocktail ID from the medication analysis

function addToOutput(title, request, response) {
  outputContent += `\n## ${title}\n\n`;
  
  // For tools/call requests, show just the arguments
  if (request.method === 'tools/call' && request.params?.arguments) {
    outputContent += `**Tool:** \`${request.params.name}\`\n\n`;
    outputContent += `**Arguments:**\n\`\`\`json\n${JSON.stringify(request.params.arguments, null, 2)}\n\`\`\`\n\n`;
  } else {
    outputContent += `**Request:**\n\`\`\`json\n${JSON.stringify(request, null, 2)}\n\`\`\`\n\n`;
  }
  
  // Extract and pretty-print the actual content from the response
  if (response.result?.content?.[0]?.text) {
    outputContent += `**Response:**\n`;
    try {
      // Parse the JSON string from the text field
      const actualContent = JSON.parse(response.result.content[0].text);
      outputContent += `\`\`\`json\n${JSON.stringify(actualContent, null, 2)}\n\`\`\`\n\n`;
    } catch (e) {
      // If it's not JSON, just show the text content
      outputContent += `\`\`\`\n${response.result.content[0].text}\n\`\`\`\n\n`;
    }
  } else if (response.result) {
    // For tools/list and other direct responses
    outputContent += `**Response:**\n\`\`\`json\n${JSON.stringify(response.result, null, 2)}\n\`\`\`\n\n`;
  } else if (response.error) {
    outputContent += `**Error:**\n\`\`\`json\n${JSON.stringify(response.error, null, 2)}\n\`\`\`\n\n`;
  }
  
  outputContent += `---\n`;
}

function sendMessage(mcp, method, params = {}) {
  return new Promise((resolve, reject) => {
    const message = {
      jsonrpc: "2.0",
      id: messageId++,
      method: method,
      params: params
    };
    
    console.log(`Sending: ${method}${params.name ? ` (${params.name})` : ''}`);
    
    let responseData = '';
    let hasResponded = false;
    
    const timeout = setTimeout(() => {
      if (!hasResponded) {
        hasResponded = true;
        reject(new Error('Request timeout'));
      }
    }, 15000); // 15 second timeout
    
    const dataHandler = (data) => {
      responseData += data.toString();
      
      try {
        const response = JSON.parse(responseData);
        if (response.id === message.id && !hasResponded) {
          hasResponded = true;
          clearTimeout(timeout);
          mcp.stdout.off('data', dataHandler);
          resolve({ request: message, response });
        }
      } catch (e) {
        // Not complete JSON yet, keep accumulating
      }
    };
    
    mcp.stdout.on('data', dataHandler);
    mcp.stdin.write(JSON.stringify(message) + '\n');
  });
}

async function runAllTools() {
  console.log('Starting MCP server...');
  
  // Spawn the MCP server
  const mcp = spawn('node', ['src/index.js'], { 
    env,
    cwd: projectRoot,
    stdio: ['pipe', 'pipe', 'pipe']
  });

  // Handle server errors but don't log them (too noisy)
  mcp.stderr.on('data', () => {
    // Ignore server logs
  });

  // Wait for server to start
  await new Promise(resolve => setTimeout(resolve, 2000));

  // Initialize output file
  outputContent = `# Ask Anything MCP Tool Examples\n\nGenerated on: ${currentDate}  \nGenerated by: \`ask-anything-mcp/scripts/generate-example-responses.js\`\n\nThis file contains example requests and responses for all Ask Anything MCP tools to serve as a reference.\n\n`;

  try {
    let cocktailId = null;

    // Run all configured tools
    for (const tool of TOOLS) {
      try {
        const { request, response } = await sendMessage(mcp, tool.method, tool.params);
        addToOutput(tool.name, request, response);
        
        // Extract cocktail ID from medication analysis for detailed analysis
        if (tool.params.name === 'get_medication_analysis' && 
            response.result?.content?.[0]?.text) {
          try {
            const medicationData = JSON.parse(response.result.content[0].text);
            if (medicationData.medicationHistory?.[0]?.cocktailId) {
              cocktailId = medicationData.medicationHistory[0].cocktailId;
              console.log(`Found cocktail ID: ${cocktailId}`);
            }
          } catch (e) {
            console.warn('Could not extract cocktail ID from medication analysis');
          }
        }
        
        console.log(`✓ ${tool.name}`);
      } catch (error) {
        console.error(`✗ ${tool.name}: ${error.message}`);
        addToOutput(`${tool.name} (ERROR)`, { method: tool.method, params: tool.params }, { error: error.message });
      }
      
      // Small delay between requests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // Run medication detailed analysis if we got a cocktail ID
    if (cocktailId) {
      try {
        const detailedTool = {
          name: 'Get Medication Detailed Analysis',
          method: 'tools/call',
          params: {
            name: 'get_medication_detailed_analysis',
            arguments: { cocktailId: cocktailId }
          }
        };
        
        const { request, response } = await sendMessage(mcp, detailedTool.method, detailedTool.params);
        addToOutput(detailedTool.name, request, response);
        console.log(`✓ ${detailedTool.name}`);
      } catch (error) {
        console.error(`✗ Get Medication Detailed Analysis: ${error.message}`);
      }
    }

    // Try to get a journal entry for the journal entry tools
    try {
      // First search for any journal entry to get an ID
      const searchResult = await sendMessage(mcp, 'tools/call', {
        name: 'search_journal_entries',
        arguments: { query: 'day', limit: 1 }
      });
      
      if (searchResult.response.result?.content?.[0]?.text) {
        const searchData = JSON.parse(searchResult.response.result.content[0].text);
        if (searchData.results?.[0]?.journalEntryId) {
          const journalEntryId = searchData.results[0].journalEntryId;
          
          // Get journal entry
          const entryResult = await sendMessage(mcp, 'tools/call', {
            name: 'get_journal_entry',
            arguments: { journalEntryId: journalEntryId }
          });
          addToOutput('Get Journal Entry', entryResult.request, entryResult.response);
          console.log('✓ Get Journal Entry');
          
          // Get journal entry details
          const detailsResult = await sendMessage(mcp, 'tools/call', {
            name: 'get_journal_entry_details',
            arguments: { journalEntryId: journalEntryId }
          });
          addToOutput('Get Journal Entry Details', detailsResult.request, detailsResult.response);
          console.log('✓ Get Journal Entry Details');
        }
      }
    } catch (error) {
      console.error(`✗ Journal entry tools: ${error.message}`);
    }

  } finally {
    // Clean up
    mcp.kill();
  }

  // Write output file
  fs.writeFileSync(outputFile, outputContent);
  console.log(`\n✅ Example responses saved to: ${outputFile}`);
  if (customOutputDir) {
    console.log(`📁 Used custom output directory: ${customOutputDir}`);
  }
  console.log(`📊 Generated ${TOOLS.length + 3} tool examples`); // +3 for journal entry tools and detailed medication
}

// Handle process termination
process.on('SIGINT', () => {
  console.log('\nStopping...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nStopping...');
  process.exit(0);
});

// Run the script
runAllTools().catch(error => {
  console.error('Script failed:', error);
  process.exit(1);
});