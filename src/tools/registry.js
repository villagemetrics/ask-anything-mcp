import { createLogger } from '../utils/logger.js';
// Session management tools
import { ListChildrenTool } from './session/listChildren.js';
import { SelectChildTool } from './session/selectChild.js';
// Tracking tools
import { GetBehaviorScoresTool } from './tracking/getBehaviorScores.js';
import { GetDateRangeMetadataTool } from './tracking/getDateRangeMetadata.js';
// Journal tools
import { SearchJournalsTool } from './journal/searchJournals.js';
import { GetJournalEntryTool } from './journal/getJournalEntry.js';
import { GetJournalDetailsTool } from './journal/getJournalDetails.js';

const logger = createLogger('ToolRegistry');

export class ToolRegistry {
  constructor(sessionManager, tokenValidator) {
    this.sessionManager = sessionManager;
    this.tokenValidator = tokenValidator;
    
    // Initialize tool instances
    this.toolInstances = {
      // Session tools
      listChildren: new ListChildrenTool(sessionManager),
      selectChild: new SelectChildTool(sessionManager),
      // Tracking tools
      getBehaviorScores: new GetBehaviorScoresTool(sessionManager),
      getDateRangeMetadata: new GetDateRangeMetadataTool(sessionManager),
      // Journal tools
      searchJournals: new SearchJournalsTool(sessionManager),
      getJournalEntry: new GetJournalEntryTool(sessionManager),
      getJournalDetails: new GetJournalDetailsTool(sessionManager),
      // Future tools will be added here:
      // Medical tools
      // Analysis tools
      // Math tools
    };
    
    // Register all tools
    this.tools = new Map();
    this.registerTools();
  }

  registerTools() {
    // Register session management tools
    this.registerToolClass(ListChildrenTool, this.toolInstances.listChildren);
    this.registerToolClass(SelectChildTool, this.toolInstances.selectChild);
    
    // Register tracking tools
    this.registerToolClass(GetBehaviorScoresTool, this.toolInstances.getBehaviorScores);
    this.registerToolClass(GetDateRangeMetadataTool, this.toolInstances.getDateRangeMetadata);
    
    // Register journal tools
    this.registerToolClass(SearchJournalsTool, this.toolInstances.searchJournals);
    this.registerToolClass(GetJournalEntryTool, this.toolInstances.getJournalEntry);
    this.registerToolClass(GetJournalDetailsTool, this.toolInstances.getJournalDetails);
    
    logger.info('Tools registered', { count: this.tools.size });
  }
  
  registerToolClass(ToolClass, instance) {
    const definition = ToolClass.definition;
    this.registerTool({
      ...definition,
      handler: instance.execute.bind(instance)
    });
  }

  registerTool(toolDefinition) {
    this.tools.set(toolDefinition.name, toolDefinition);
    logger.debug('Tool registered', { name: toolDefinition.name });
  }

  getToolDefinitions() {
    return Array.from(this.tools.values()).map(tool => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema
    }));
  }

  async executeTool(name, args, sessionId) {
    const tool = this.tools.get(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }

    const session = this.sessionManager.getSession(sessionId);
    logger.debug('Executing tool', { tool: name, userId: session.userId, sessionId });

    try {
      const result = await tool.handler(args, session);
      logger.debug('Tool executed successfully', { tool: name });
      return result;
    } catch (error) {
      logger.error('Tool execution failed', { 
        tool: name, 
        error: error.message,
        stack: error.stack 
      });
      throw error;
    }
  }
}
