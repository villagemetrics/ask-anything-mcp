import { createLogger } from '../utils/logger.js';
// Session management tools
import { ListChildrenTool } from './session/listChildren.js';
import { SelectChildTool } from './session/selectChild.js';
import { ListVillageMembersTool } from './session/listVillageMembers.js';
// Tracking tools
import { GetBehaviorScoresTool } from './tracking/getBehaviorScores.js';
import { GetDateRangeMetadataTool } from './tracking/getDateRangeMetadata.js';
// Journal tools
import { SearchJournalsTool } from './journal/searchJournals.js';
import { GetJournalEntryTool } from './journal/getJournalEntry.js';
import { GetJournalDetailsTool } from './journal/getJournalDetails.js';
import { ListJournalEntriesTool } from './journal/listJournalEntries.js';
// Analysis tools
import { GetOverviewAnalysisTool } from './analysis/getOverviewAnalysis.js';
import { GetBehaviorAnalysisTool } from './analysis/getBehaviorAnalysis.js';
import { GetMedicationAnalysisTool } from './analysis/getMedicationAnalysis.js';
import { GetJournalAnalysisTool } from './analysis/getJournalAnalysis.js';
import { GetHashtagAnalysisTool } from './analysis/getHashtagAnalysis.js';
import { GetMedicationDetailedAnalysisTool } from './analysis/getMedicationDetailedAnalysis.js';
// System tools
import { GetVersionInfoTool } from './system/getVersionInfo.js';
// Help tools
import { GetProductHelpTool } from './help/getProductHelp.js';
// Feedback tools
import { SubmitProductFeedbackTool } from './feedback/submitProductFeedback.js';

const logger = createLogger('ToolRegistry');

export class ToolRegistry {
  constructor(sessionManager, tokenValidator, apiOptions = {}, mcpOptions = {}, autoUpdater = null) {
    this.sessionManager = sessionManager;
    this.tokenValidator = tokenValidator;
    this.apiOptions = apiOptions; // Token configuration for VMApiClient
    this.mcpOptions = mcpOptions; // MCP configuration (preSelectedChildId, allowChildSwitching, etc.)
    this.autoUpdater = autoUpdater; // Store autoUpdater for pending update notifications
    
    // Initialize tool instances with API options
    this.toolInstances = {
      // Session tools - conditionally include selectChild based on allowChildSwitching
      listChildren: new ListChildrenTool(sessionManager, apiOptions),
      ...(mcpOptions.allowChildSwitching !== false ? { selectChild: new SelectChildTool(sessionManager, apiOptions, mcpOptions) } : {}),
      listVillageMembers: new ListVillageMembersTool(sessionManager, apiOptions),
      // Tracking tools
      getBehaviorScores: new GetBehaviorScoresTool(sessionManager, apiOptions),
      getDateRangeMetadata: new GetDateRangeMetadataTool(sessionManager, apiOptions),
      // Journal tools
      searchJournals: new SearchJournalsTool(sessionManager, apiOptions),
      getJournalEntry: new GetJournalEntryTool(sessionManager, apiOptions),
      getJournalDetails: new GetJournalDetailsTool(sessionManager, apiOptions),
      listJournalEntries: new ListJournalEntriesTool(sessionManager, apiOptions),
      // Analysis tools
      getOverviewAnalysis: new GetOverviewAnalysisTool(sessionManager, apiOptions),
      getBehaviorAnalysis: new GetBehaviorAnalysisTool(sessionManager, apiOptions),
      getMedicationAnalysis: new GetMedicationAnalysisTool(sessionManager, apiOptions),
      getMedicationDetailedAnalysis: new GetMedicationDetailedAnalysisTool(sessionManager, apiOptions),
      getJournalAnalysis: new GetJournalAnalysisTool(sessionManager, apiOptions),
      getHashtagAnalysis: new GetHashtagAnalysisTool(sessionManager, apiOptions),
      // System tools
      getVersionInfo: new GetVersionInfoTool(autoUpdater, apiOptions),
      // Help tools
      getProductHelp: new GetProductHelpTool(sessionManager, apiOptions),
      // Feedback tools
      submitProductFeedback: new SubmitProductFeedbackTool(sessionManager, apiOptions),
      // Future tools will be added here:
      // Math tools
    };
    
    // Register all tools
    this.tools = new Map();
    this.registerTools();
  }

  registerTools() {
    // Register session management tools
    this.registerToolClass(ListChildrenTool, this.toolInstances.listChildren);
    if (this.toolInstances.selectChild) {
      this.registerToolClass(SelectChildTool, this.toolInstances.selectChild);
    }
    this.registerToolClass(ListVillageMembersTool, this.toolInstances.listVillageMembers);
    
    // Register tracking tools
    this.registerToolClass(GetBehaviorScoresTool, this.toolInstances.getBehaviorScores);
    this.registerToolClass(GetDateRangeMetadataTool, this.toolInstances.getDateRangeMetadata);
    
    // Register journal tools
    this.registerToolClass(SearchJournalsTool, this.toolInstances.searchJournals);
    this.registerToolClass(GetJournalEntryTool, this.toolInstances.getJournalEntry);
    this.registerToolClass(GetJournalDetailsTool, this.toolInstances.getJournalDetails);
    this.registerToolClass(ListJournalEntriesTool, this.toolInstances.listJournalEntries);
    
    // Register analysis tools
    this.registerToolClass(GetOverviewAnalysisTool, this.toolInstances.getOverviewAnalysis);
    this.registerToolClass(GetBehaviorAnalysisTool, this.toolInstances.getBehaviorAnalysis);
    this.registerToolClass(GetMedicationAnalysisTool, this.toolInstances.getMedicationAnalysis);
    this.registerToolClass(GetMedicationDetailedAnalysisTool, this.toolInstances.getMedicationDetailedAnalysis);
    this.registerToolClass(GetJournalAnalysisTool, this.toolInstances.getJournalAnalysis);
    this.registerToolClass(GetHashtagAnalysisTool, this.toolInstances.getHashtagAnalysis);
    
    // Register system tools
    this.registerToolClass(GetVersionInfoTool, this.toolInstances.getVersionInfo);
    
    // Register help tools
    this.registerToolClass(GetProductHelpTool, this.toolInstances.getProductHelp);
    
    // Register feedback tools
    this.registerToolClass(SubmitProductFeedbackTool, this.toolInstances.submitProductFeedback);
    
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

    const startTime = Date.now();
    try {
      const result = await tool.handler(args, session);
      const duration = Date.now() - startTime;
      logger.debug('Tool executed successfully', { tool: name, durationMs: duration });
      
      // Check for pending update notification
      const updateNotification = this.autoUpdater?.getPendingUpdateNotification();
      
      // Prepare the final result
      let finalResult = result;
      if (updateNotification) {
        // Append update notification to the result
        if (typeof result === 'string') {
          finalResult = `${result}\n\n${updateNotification}`;
        } else if (result && typeof result === 'object') {
          // If result is an object, add the notification as a property
          finalResult = {
            ...result,
            updateNotification
          };
        }
      }
      
      // Wrap result with timing information
      return {
        result: finalResult,
        timing: {
          duration
        }
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      logger.error('Tool execution failed', { 
        tool: name, 
        error: error.message,
        stack: error.stack,
        durationMs: duration
      });
      throw error;
    }
  }
}
