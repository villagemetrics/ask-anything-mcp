import { createLogger } from '../../utils/logger.js';
import { VMApiClient } from '../../clients/vmApiClient.js';

const logger = createLogger('SubmitProductFeedbackTool');

export class SubmitProductFeedbackTool {
  constructor(sessionManager, apiOptions = {}) {
    this.sessionManager = sessionManager;
    this.apiClient = new VMApiClient(apiOptions);
  }

  static get definition() {
    return {
      name: 'submit_product_feedback',
      description: 'Submit feedback about Village Metrics features, functionality, or user experience. Use this to share suggestions, report issues, or provide general feedback about the application.',
      inputSchema: {
        type: 'object',
        properties: {
          feedbackText: {
            type: 'string',
            description: 'Your feedback about the product. This can include feature requests, bug reports, suggestions for improvement, or general comments about your experience with Village Metrics.',
            minLength: 1,
            maxLength: 10000
          },
          source: {
            type: 'string',
            enum: ['ask-anything', 'journal-entry', 'general'],
            description: 'The source context for this feedback. Use "ask-anything" for feedback related to this AI assistant, "journal-entry" for feedback about journal features, or "general" for other feedback.',
            default: 'ask-anything'
          }
        },
        required: ['feedbackText']
      }
    };
  }

  async execute(args, session) {
    try {
      const { feedbackText, source = 'ask-anything' } = args;

      // Validate feedback text length
      if (!feedbackText || feedbackText.trim().length === 0) {
        throw new Error('Feedback text is required and cannot be empty');
      }

      if (feedbackText.length > 10000) {
        throw new Error('Feedback text must be less than 10,000 characters');
      }

      logger.info('Submitting product feedback', { 
        userId: session.userId, 
        source,
        feedbackLength: feedbackText.length 
      });

      // Submit feedback to API
      const response = await this.apiClient.submitProductFeedback(feedbackText.trim(), source);

      logger.info('Product feedback submitted successfully', { 
        userId: session.userId, 
        source,
        success: response.success 
      });

      return {
        success: true,
        message: 'Thank you for your feedback! Your input has been submitted to the Village Metrics team and will help us improve the application.',
        submissionDetails: {
          source,
          feedbackLength: feedbackText.trim().length,
          submittedAt: new Date().toISOString()
        }
      };
    } catch (error) {
      logger.error('Failed to submit product feedback', { 
        error: error.message,
        userId: session.userId,
        source: args?.source
      });
      
      // Provide user-friendly error messages
      if (error.response?.status === 400) {
        throw new Error(`Feedback validation error: ${error.message}`);
      } else if (error.response?.status === 401) {
        throw new Error('Authentication failed. Please check your connection and try again.');
      } else if (error.response?.status === 500) {
        throw new Error('Server error occurred while submitting feedback. Please try again later.');
      } else {
        throw new Error(`Failed to submit feedback: ${error.message}`);
      }
    }
  }
}