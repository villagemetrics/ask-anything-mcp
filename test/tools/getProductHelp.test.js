import { expect } from 'chai';
import { GetProductHelpTool } from '../../src/tools/help/getProductHelp.js';

describe('Get Product Help Tool', () => {
  let tool;
  let mockSessionManager;

  beforeEach(() => {
    mockSessionManager = {};
    tool = new GetProductHelpTool(mockSessionManager);
  });

  describe('Tool Definition', () => {
    it('should have correct tool definition', () => {
      const definition = GetProductHelpTool.definition;
      
      expect(definition.name).to.equal('get_product_help');
      expect(definition.description).to.include('VillageMetrics product documentation');
      expect(definition.inputSchema.properties.section).to.exist;
      expect(definition.inputSchema.properties.section.enum).to.be.an('array');
      expect(definition.inputSchema.properties.section.enum).to.have.length.greaterThan(10);
    });

    it('should include expected section enums', () => {
      const definition = GetProductHelpTool.definition;
      const sections = definition.inputSchema.properties.section.enum;
      
      expect(sections).to.include('getting-started-setup');
      expect(sections).to.include('journal-recording-processing');
      expect(sections).to.include('behavior-tracking-goals');
      expect(sections).to.include('analysis-insights-troubleshooting');
      expect(sections).to.include('subscription-billing-access');
    });
  });

  describe('Section File Mapping', function() {
    // Increase timeout for network requests
    this.timeout(10000);

    it('should return correct files for getting-started-setup', async () => {
      const files = await tool.getSectionFiles('getting-started-setup');

      expect(files.main).to.deep.equal(['getting-started.md', 'account-setup.md']);
      expect(files.supplemental).to.deep.equal([]);
    });

    it('should return correct files for journal-recording-processing', async () => {
      const files = await tool.getSectionFiles('journal-recording-processing');

      expect(files.main).to.deep.equal(['journal-entries.md']);
      expect(files.supplemental).to.deep.equal(['ai-supplemental/journal-processing-details.md']);
    });

    it('should return correct files for hashtag-organization-system', async () => {
      const files = await tool.getSectionFiles('hashtag-organization-system');

      expect(files.main).to.deep.equal(['hashtag-system.md']);
      expect(files.supplemental).to.deep.equal([
        'ai-supplemental/hashtag-categories-complete-list.md',
        'ai-supplemental/caregiver-types-complete-list.md'
      ]);
    });

    it('should return correct files for analysis-insights-troubleshooting including automated insights', async () => {
      const files = await tool.getSectionFiles('analysis-insights-troubleshooting');

      expect(files.main).to.deep.equal(['analysis-insights.md']);
      expect(files.supplemental).to.include('ai-supplemental/automated-insights-details.md');
      expect(files.supplemental).to.include('ai-supplemental/analysis-system-details.md');
    });

    it('should return empty arrays for unknown section', async () => {
      const files = await tool.getSectionFiles('unknown-section');

      expect(files.main).to.deep.equal([]);
      expect(files.supplemental).to.deep.equal([]);
    });

    it('should cache the mapping and reuse it', async () => {
      // First call - should fetch from remote
      const files1 = await tool.getSectionFiles('getting-started-setup');
      const cacheTime1 = tool.mappingCacheTime;

      // Second call - should use cache
      const files2 = await tool.getSectionFiles('journal-recording-processing');
      const cacheTime2 = tool.mappingCacheTime;

      expect(cacheTime1).to.equal(cacheTime2); // Same cache time = cache was used
      expect(files1.main).to.have.length.greaterThan(0);
      expect(files2.main).to.have.length.greaterThan(0);
    });
  });

  describe('Input Validation', () => {
    it('should require section parameter', async () => {
      try {
        await tool.execute({}, {});
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Section is required');
      }
    });

    it('should handle unknown section gracefully', async () => {
      try {
        await tool.execute({ section: 'unknown-section' }, {});
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('No documentation files configured');
      }
    });
  });

  describe('Real Documentation Integration', function() {
    // Increase timeout for network requests
    this.timeout(10000);

    it('should successfully fetch getting started documentation', async () => {
      const result = await tool.execute({ section: 'getting-started-setup' }, {});
      
      expect(result.section).to.equal('getting-started-setup');
      expect(result.hasMainDocs).to.be.true;
      expect(result.hasSupplementalDocs).to.be.false;
      expect(result.mainDocumentation).to.have.length(2);
      expect(result.supplementalDocumentation).to.have.length(0);
      
      // Check that we got actual content
      const gettingStartedDoc = result.mainDocumentation.find(doc => doc.file === 'getting-started.md');
      const accountSetupDoc = result.mainDocumentation.find(doc => doc.file === 'account-setup.md');
      
      expect(gettingStartedDoc).to.exist;
      expect(gettingStartedDoc.content).to.include('Getting Started');
      expect(accountSetupDoc).to.exist;
      expect(accountSetupDoc.content).to.include('Account Setup');
    });

    it('should successfully fetch journal documentation with supplemental content', async () => {
      const result = await tool.execute({ section: 'journal-recording-processing' }, {});
      
      expect(result.section).to.equal('journal-recording-processing');
      expect(result.hasMainDocs).to.be.true;
      expect(result.hasSupplementalDocs).to.be.true;
      expect(result.mainDocumentation).to.have.length(1);
      expect(result.supplementalDocumentation).to.have.length(1);
      
      // Check main content
      const mainDoc = result.mainDocumentation[0];
      expect(mainDoc.file).to.equal('journal-entries.md');
      expect(mainDoc.content).to.include('Journal Entries');
      
      // Check supplemental content
      const supplementalDoc = result.supplementalDocumentation[0];
      expect(supplementalDoc.file).to.equal('ai-supplemental/journal-processing-details.md');
      expect(supplementalDoc.content).to.include('Processing');
    });

    it('should handle subscription section with only supplemental docs', async () => {
      const result = await tool.execute({ section: 'subscription-billing-access' }, {});
      
      expect(result.section).to.equal('subscription-billing-access');
      expect(result.hasMainDocs).to.be.false;
      expect(result.hasSupplementalDocs).to.be.true;
      expect(result.mainDocumentation).to.have.length(0);
      expect(result.supplementalDocumentation).to.have.length(1);
      
      // Check supplemental content
      const supplementalDoc = result.supplementalDocumentation[0];
      expect(supplementalDoc.file).to.equal('ai-supplemental/subscription-access-details.md');
      expect(supplementalDoc.content).to.include('subscription');
    });

    it('should include proper response metadata', async () => {
      const result = await tool.execute({ section: 'getting-started-setup' }, {});
      
      expect(result.sourceUrl).to.equal('https://docs.villagemetrics.com/raw/');
      expect(result.totalFiles).to.equal(2);
      expect(result.section).to.equal('getting-started-setup');
    });

    it('should handle 404 errors gracefully', async () => {
      // Temporarily modify the tool to test 404 handling
      const originalSectionFiles = tool.getSectionFiles;
      tool.getSectionFiles = async () => ({
        main: ['nonexistent-file.md'],
        supplemental: ['ai-supplemental/also-missing.md']
      });

      try {
        const result = await tool.execute({ section: 'test-404' }, {});

        // Should return error response when no files are accessible
        expect(result.error).to.include('No documentation files could be accessed');
        expect(result.totalFiles).to.equal(0);
        expect(result.failedFiles).to.have.length(2);
        expect(result.hasMainDocs).to.be.false;
        expect(result.hasSupplementalDocs).to.be.false;
      } finally {
        // Restore original method
        tool.getSectionFiles = originalSectionFiles;
      }
    });

    it('should provide warnings for partial failures', async () => {
      // Test case where some files load and others fail
      const originalSectionFiles = tool.getSectionFiles;
      tool.getSectionFiles = async () => ({
        main: ['getting-started.md'], // This should work
        supplemental: ['ai-supplemental/nonexistent.md'] // This should fail
      });

      try {
        const result = await tool.execute({ section: 'test-partial' }, {});

        expect(result.warnings).to.exist;
        expect(result.warnings[0]).to.include('1 documentation file(s) could not be accessed');
        expect(result.totalFiles).to.equal(1); // Only one successful
        expect(result.inaccessibleFiles).to.equal(1);
        expect(result.hasMainDocs).to.be.true;
        expect(result.hasSupplementalDocs).to.be.false;
      } finally {
        // Restore original method
        tool.getSectionFiles = originalSectionFiles;
      }
    });
  });
});