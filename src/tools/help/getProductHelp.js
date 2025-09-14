import { createLogger } from '../../utils/logger.js';

const logger = createLogger('GetProductHelpTool');

export class GetProductHelpTool {
  constructor(sessionManager, apiOptions = {}) {
    this.sessionManager = sessionManager;
    this.baseUrl = 'https://docs.villagemetrics.com/raw';
  }

  static get definition() {
    return {
      name: 'get_product_help',
      description: 'Get VillageMetrics product documentation for feature usage, troubleshooting, and technical details',
      inputSchema: {
        type: 'object',
        properties: {
          section: {
            type: 'string',
            description: 'Help topic area',
            enum: [
              'getting-started-setup',           // Initial setup and navigation
              'journal-recording-processing',    // Voice recording and processing details 
              'behavior-tracking-goals',         // Goal setting and behavior analysis
              'village-invitations-management',  // Caregiver invites and permissions
              'analysis-insights-troubleshooting', // Analysis not loading/updating
              'medication-tracking-analysis',    // Medication tracking and analysis
              'search-ask-anything-features',    // Search and AI features
              'data-export-sharing-permissions', // Export and sharing options
              'account-settings-privacy',        // Settings and privacy controls
              'hashtag-organization-system',     // Hashtag usage and categories
              'ai-tools-integration',            // External AI tool connections
              'subscription-billing-access',     // Billing and access issues
              'troubleshooting-technical-issues' // General technical problems
            ]
          }
        },
        required: ['section']
      }
    };
  }

  // Define the file mapping for each section
  getSectionFiles(section) {
    const mapping = {
      'getting-started-setup': {
        main: ['getting-started.md', 'account-setup.md'],
        supplemental: []
      },
      'journal-recording-processing': {
        main: ['journal-entries.md'],
        supplemental: ['ai-supplemental/journal-processing-details.md']
      },
      'behavior-tracking-goals': {
        main: ['behavior-goals.md'],
        supplemental: []
      },
      'village-invitations-management': {
        main: ['village-system.md'],
        supplemental: ['ai-supplemental/village-management-details.md']
      },
      'analysis-insights-troubleshooting': {
        main: ['analysis-insights.md'],
        supplemental: ['ai-supplemental/analysis-system-details.md']
      },
      'medication-tracking-analysis': {
        main: ['medication-tracking.md'],
        supplemental: ['ai-supplemental/medication-analysis-details.md']
      },
      'search-ask-anything-features': {
        main: ['search-ask-anything.md'],
        supplemental: []
      },
      'data-export-sharing-permissions': {
        main: ['data-export-sharing.md'],
        supplemental: ['ai-supplemental/export-specifications-detailed.md']
      },
      'account-settings-privacy': {
        main: ['settings-privacy.md'],
        supplemental: ['ai-supplemental/permission-system-details.md']
      },
      'hashtag-organization-system': {
        main: ['hashtag-system.md'],
        supplemental: ['ai-supplemental/hashtag-categories-complete-list.md', 'ai-supplemental/caregiver-types-complete-list.md']
      },
      'ai-tools-integration': {
        main: ['ai-tools-integration.md'],
        supplemental: ['ai-supplemental/technical-specifications-detailed.md']
      },
      'subscription-billing-access': {
        main: [],
        supplemental: ['ai-supplemental/subscription-access-details.md']
      },
      'troubleshooting-technical-issues': {
        main: ['troubleshooting.md', 'best-practices.md'],
        supplemental: []
      }
    };

    return mapping[section] || { main: [], supplemental: [] };
  }

  async fetchMarkdownContent(filePath) {
    const url = `${this.baseUrl}/${filePath}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        if (response.status === 404) {
          logger.warn('Documentation file not found', { filePath, status: response.status });
          return null;
        }
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const content = await response.text();
      
      // Basic validation - should be markdown content, not HTML
      if (content.includes('<!doctype html') || content.includes('<html')) {
        logger.warn('Received HTML instead of markdown', { filePath });
        return null;
      }

      return content;
    } catch (error) {
      logger.error('Failed to fetch documentation', { filePath, error: error.message });
      throw new Error(`Failed to fetch ${filePath}: ${error.message}`);
    }
  }

  async execute(args, session) {
    const { section } = args;
    
    if (!section) {
      throw new Error('Section is required');
    }

    const files = this.getSectionFiles(section);
    const allFiles = [...files.main, ...files.supplemental];
    
    if (allFiles.length === 0) {
      throw new Error(`No documentation files configured for section: ${section}`);
    }

    try {
      logger.debug('Fetching product help', { section, fileCount: allFiles.length });

      // Fetch all files in parallel
      const fetchPromises = allFiles.map(async (file) => {
        const content = await this.fetchMarkdownContent(file);
        return { file, content };
      });

      const results = await Promise.all(fetchPromises);
      
      // Filter out failed fetches and organize content
      const mainContent = [];
      const supplementalContent = [];

      for (const result of results) {
        if (!result.content) continue;

        const isSupplemental = result.file.startsWith('ai-supplemental/');
        
        if (isSupplemental) {
          supplementalContent.push({
            file: result.file,
            content: result.content
          });
        } else {
          mainContent.push({
            file: result.file,
            content: result.content
          });
        }
      }

      // Track failed fetches for user feedback
      const failedFiles = results.filter(r => !r.content).map(r => r.file);
      const totalExpected = allFiles.length;
      const totalFetched = mainContent.length + supplementalContent.length;

      const response = {
        section,
        mainDocumentation: mainContent,
        supplementalDocumentation: supplementalContent,
        hasMainDocs: mainContent.length > 0,
        hasSupplementalDocs: supplementalContent.length > 0,
        totalFiles: totalFetched,
        totalExpected,
        sourceUrl: `${this.baseUrl}/`,
        // Include error info if some files failed to load
        ...(failedFiles.length > 0 && {
          warnings: [`${failedFiles.length} documentation file(s) could not be accessed: ${failedFiles.join(', ')}`],
          accessibleFiles: totalFetched,
          inaccessibleFiles: failedFiles.length
        })
      };

      // Handle case where no files were accessible at all
      if (totalFetched === 0) {
        return {
          section,
          error: `No documentation files could be accessed for section '${section}'. This may be due to a temporary issue with the documentation service.`,
          mainDocumentation: [],
          supplementalDocumentation: [],
          hasMainDocs: false,
          hasSupplementalDocs: false,
          totalFiles: 0,
          totalExpected,
          sourceUrl: `${this.baseUrl}/`,
          failedFiles
        };
      }

      logger.debug('Product help retrieved', { 
        section, 
        mainFiles: mainContent.length,
        supplementalFiles: supplementalContent.length,
        failedFiles: failedFiles.length
      });

      return response;

    } catch (error) {
      logger.error('Failed to get product help', { section, error: error.message });
      throw new Error(`Failed to get product help for ${section}: ${error.message}`);
    }
  }
}