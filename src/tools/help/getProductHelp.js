import { createLogger } from '../../utils/logger.js';

const logger = createLogger('GetProductHelpTool');

export class GetProductHelpTool {
  constructor(sessionManager, apiOptions = {}) {
    this.sessionManager = sessionManager;
    this.baseUrl = 'https://docs.villagemetrics.com/raw';
    this.mappingUrl = 'https://docs.villagemetrics.com/mcp-file-mapping.json';
    this.cachedMapping = null;
    this.mappingCacheTime = null;
    this.mappingCacheTTL = 5 * 60 * 1000; // 5 minutes
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

  /**
   * Fetch the file mapping from docs.villagemetrics.com
   * Uses a simple cache to avoid excessive fetches
   */
  async fetchFileMapping() {
    // Return cached mapping if still valid
    if (this.cachedMapping && this.mappingCacheTime) {
      const age = Date.now() - this.mappingCacheTime;
      if (age < this.mappingCacheTTL) {
        logger.debug('Using cached file mapping', { age, ttl: this.mappingCacheTTL });
        return this.cachedMapping;
      }
    }

    logger.debug('Fetching file mapping from remote', { url: this.mappingUrl });
    const response = await fetch(this.mappingUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch file mapping: HTTP ${response.status} ${response.statusText}`);
    }

    const mapping = await response.json();

    // Validate structure
    if (!mapping.sections || typeof mapping.sections !== 'object') {
      throw new Error('Invalid mapping structure: missing sections object');
    }

    // Cache the mapping
    this.cachedMapping = mapping;
    this.mappingCacheTime = Date.now();

    logger.debug('File mapping fetched and cached', {
      version: mapping.version,
      sectionCount: Object.keys(mapping.sections).length
    });

    return mapping;
  }

  /**
   * Get the file list for a specific section from the mapping
   */
  async getSectionFiles(section) {
    const mapping = await this.fetchFileMapping();
    const sectionData = mapping.sections[section];

    if (!sectionData) {
      logger.warn('Section not found in mapping', { section });
      return { main: [], supplemental: [] };
    }

    return {
      main: sectionData.main || [],
      supplemental: sectionData.supplemental || []
    };
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

    const files = await this.getSectionFiles(section);
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