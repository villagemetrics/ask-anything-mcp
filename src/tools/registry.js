import { normalizeAllowedTools, assertToolAllowed } from '../lib/toolAccess.js';
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
import { ListNotableJournalEntriesTool } from './analysis/listNotableJournalEntries.js';
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
    
    this.allowedTools = normalizeAllowedTools(mcpOptions.allowedTools);
    // Bounded proactive search is a host decision made at construction, alongside
    // the closed tool list — never a model-supplied tool argument.
    this.apiOptions = { ...apiOptions, allowedTools: this.allowedTools, boundedSearchExecution: mcpOptions.boundedSearchExecution === true };
    const create = (ToolClass, ...args) => {
      if (this.allowedTools !== undefined && !this.allowedTools.includes(ToolClass.definition.name)) return undefined;
      if (ToolClass === SelectChildTool && mcpOptions.allowChildSwitching === false) return undefined;
      return new ToolClass(...args);
    };
    this.toolInstances = {
      listChildren: create(ListChildrenTool, sessionManager, this.apiOptions),
      selectChild: create(SelectChildTool, sessionManager, this.apiOptions, mcpOptions),
      listVillageMembers: create(ListVillageMembersTool, sessionManager, this.apiOptions),
      getBehaviorScores: create(GetBehaviorScoresTool, sessionManager, this.apiOptions),
      getDateRangeMetadata: create(GetDateRangeMetadataTool, sessionManager, this.apiOptions),
      searchJournals: create(SearchJournalsTool, sessionManager, this.apiOptions),
      getJournalEntry: create(GetJournalEntryTool, sessionManager, this.apiOptions),
      getJournalDetails: create(GetJournalDetailsTool, sessionManager, this.apiOptions),
      listJournalEntries: create(ListJournalEntriesTool, sessionManager, this.apiOptions),
      getOverviewAnalysis: create(GetOverviewAnalysisTool, sessionManager, this.apiOptions),
      getBehaviorAnalysis: create(GetBehaviorAnalysisTool, sessionManager, this.apiOptions),
      getMedicationAnalysis: create(GetMedicationAnalysisTool, sessionManager, this.apiOptions),
      getMedicationDetailedAnalysis: create(GetMedicationDetailedAnalysisTool, sessionManager, this.apiOptions),
      listNotableJournalEntries: create(ListNotableJournalEntriesTool, sessionManager, this.apiOptions),
      getHashtagAnalysis: create(GetHashtagAnalysisTool, sessionManager, this.apiOptions),
      getVersionInfo: create(GetVersionInfoTool, autoUpdater, this.apiOptions),
      getProductHelp: create(GetProductHelpTool, sessionManager, this.apiOptions),
      submitProductFeedback: create(SubmitProductFeedbackTool, sessionManager, this.apiOptions),
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
    this.registerToolClass(ListNotableJournalEntriesTool, this.toolInstances.listNotableJournalEntries);
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
    if (!instance) return;
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
    assertToolAllowed(this.allowedTools, name);
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
      
      // Return the result directly without timing noise
      return finalResult;
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
