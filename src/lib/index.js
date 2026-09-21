// Export core library functionality
export { MCPCore } from './mcpCore.js';

// Re-export useful components for advanced usage
export { ToolRegistry } from '../tools/registry.js';
export { SessionManager } from '../session/sessionManager.js';
export { TokenValidator } from '../auth/tokenValidator.js';

// Export utility functions
export { createLogger } from '../utils/logger.js';
export { withRemoteCall } from './remoteCalls.js';

// The bounded proactive search envelope this package builds at the search
// boundary. Exported so a consumer's tests can prove parity against the shared
// llm-proxy definition this file deliberately mirrors.
export {
  EXECUTION_CONTRACT,
  MAX_PROVIDER_ATTEMPTS,
  REJECTION_MESSAGES,
  assertForwardableEnvelope,
  validatePaidSearchRequest,
  wrapSingleProviderAttempt
} from './executionContract.js';
