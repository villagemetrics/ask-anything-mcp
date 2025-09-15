import { expect } from 'chai';
import { SubmitProductFeedbackTool } from '../../src/tools/feedback/submitProductFeedback.js';

describe('Submit Product Feedback Tool', () => {
  let tool;
  let mockSessionManager;
  let mockApiClient;

  beforeEach(() => {
    mockSessionManager = {};
    mockApiClient = {
      submitProductFeedback: async (feedbackText, source) => ({
        success: true,
        message: 'Product feedback submitted successfully'
      })
    };
    
    tool = new SubmitProductFeedbackTool(mockSessionManager);
    tool.apiClient = mockApiClient; // Override with mock
  });

  describe('Tool Definition', () => {
    it('should have correct tool definition', () => {
      const definition = SubmitProductFeedbackTool.definition;
      
      expect(definition.name).to.equal('submit_product_feedback');
      expect(definition.description).to.include('Submit feedback about Village Metrics');
      expect(definition.inputSchema.properties.feedbackText).to.exist;
      expect(definition.inputSchema.properties.source).to.exist;
      expect(definition.inputSchema.required).to.deep.equal(['feedbackText']);
    });

    it('should have correct source enum values', () => {
      const definition = SubmitProductFeedbackTool.definition;
      const sourceEnum = definition.inputSchema.properties.source.enum;
      
      expect(sourceEnum).to.deep.equal(['ask-anything', 'journal-entry', 'general']);
      expect(definition.inputSchema.properties.source.default).to.equal('ask-anything');
    });

    it('should have correct feedbackText constraints', () => {
      const definition = SubmitProductFeedbackTool.definition;
      const feedbackText = definition.inputSchema.properties.feedbackText;
      
      expect(feedbackText.minLength).to.equal(1);
      expect(feedbackText.maxLength).to.equal(10000);
    });
  });

  describe('Input Validation', () => {
    it('should require feedbackText parameter', async () => {
      try {
        await tool.execute({}, { userId: 'test-user' });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Feedback text is required');
      }
    });

    it('should reject empty feedbackText', async () => {
      try {
        await tool.execute({ feedbackText: '   ' }, { userId: 'test-user' });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Feedback text is required');
      }
    });

    it('should reject feedbackText that is too long', async () => {
      const longText = 'a'.repeat(10001);
      try {
        await tool.execute({ feedbackText: longText }, { userId: 'test-user' });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('less than 10,000 characters');
      }
    });
  });

  describe('Successful Execution', () => {
    it('should submit feedback with default source', async () => {
      let capturedFeedback, capturedSource;
      mockApiClient.submitProductFeedback = async (feedbackText, source) => {
        capturedFeedback = feedbackText;
        capturedSource = source;
        return { success: true, message: 'Feedback submitted successfully' };
      };

      const result = await tool.execute({
        feedbackText: 'Great product!'
      }, { userId: 'test-user' });

      expect(capturedFeedback).to.equal('Great product!');
      expect(capturedSource).to.equal('ask-anything');
      expect(result.success).to.be.true;
      expect(result.message).to.include('Thank you for your feedback');
      expect(result.submissionDetails.source).to.equal('ask-anything');
      expect(result.submissionDetails.feedbackLength).to.equal(14);
    });

    it('should submit feedback with specified source', async () => {
      let capturedFeedback, capturedSource;
      mockApiClient.submitProductFeedback = async (feedbackText, source) => {
        capturedFeedback = feedbackText;
        capturedSource = source;
        return { success: true, message: 'Feedback submitted successfully' };
      };

      const result = await tool.execute({
        feedbackText: 'The journal feature is excellent!',
        source: 'journal-entry'
      }, { userId: 'test-user' });

      expect(capturedFeedback).to.equal('The journal feature is excellent!');
      expect(capturedSource).to.equal('journal-entry');
      expect(result.success).to.be.true;
      expect(result.submissionDetails.source).to.equal('journal-entry');
    });

    it('should trim whitespace from feedback text', async () => {
      let capturedFeedback;
      mockApiClient.submitProductFeedback = async (feedbackText, source) => {
        capturedFeedback = feedbackText;
        return { success: true, message: 'Feedback submitted successfully' };
      };

      const result = await tool.execute({
        feedbackText: '   Feedback with spaces   '
      }, { userId: 'test-user' });

      expect(capturedFeedback).to.equal('Feedback with spaces');
      expect(result.submissionDetails.feedbackLength).to.equal(20);
    });

    it('should include submission timestamp', async () => {
      const beforeTime = new Date();
      
      const result = await tool.execute({
        feedbackText: 'Test feedback'
      }, { userId: 'test-user' });

      const afterTime = new Date();
      const submittedAt = new Date(result.submissionDetails.submittedAt);
      
      expect(submittedAt).to.be.at.least(beforeTime);
      expect(submittedAt).to.be.at.most(afterTime);
    });
  });

  describe('Error Handling', () => {
    it('should handle 400 validation errors', async () => {
      mockApiClient.submitProductFeedback = async () => {
        const error = new Error('Invalid request');
        error.response = { status: 400 };
        throw error;
      };

      try {
        await tool.execute({
          feedbackText: 'Test feedback'
        }, { userId: 'test-user' });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Feedback validation error');
      }
    });

    it('should handle 401 authentication errors', async () => {
      mockApiClient.submitProductFeedback = async () => {
        const error = new Error('Unauthorized');
        error.response = { status: 401 };
        throw error;
      };

      try {
        await tool.execute({
          feedbackText: 'Test feedback'
        }, { userId: 'test-user' });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Authentication failed');
      }
    });

    it('should handle 500 server errors', async () => {
      mockApiClient.submitProductFeedback = async () => {
        const error = new Error('Internal server error');
        error.response = { status: 500 };
        throw error;
      };

      try {
        await tool.execute({
          feedbackText: 'Test feedback'
        }, { userId: 'test-user' });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Server error occurred');
      }
    });

    it('should handle generic network errors', async () => {
      mockApiClient.submitProductFeedback = async () => {
        throw new Error('Network error');
      };

      try {
        await tool.execute({
          feedbackText: 'Test feedback'
        }, { userId: 'test-user' });
        expect.fail('Should have thrown error');
      } catch (error) {
        expect(error.message).to.include('Failed to submit feedback: Network error');
      }
    });
  });
});