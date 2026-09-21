// The proactive-only single-provider-attempt envelope, at the journal-search
// boundary.
//
// This is a deliberate mirror of `execution-contract.js` in llm-proxy (whose own
// two copies live in llm-proxy-lambda/ and llm-proxy-client/src/). This package
// is published publicly and cannot depend on @villagemetrics/llm-proxy-client,
// so the constants and rejection strings are restated here rather than imported.
// Parity is proven by behavior, not by byte comparison: the proactive-insights
// generator's suite, the first consumer with this package and llm-proxy-client
// both at their bounded versions, asserts that an envelope built here is exactly
// what the shared `unwrapSingleProviderAttempt` accepts.
const EXECUTION_CONTRACT = 'single_provider_attempt_v1';
const MAX_PROVIDER_ATTEMPTS = 1;

// Top-level fields that let a receiver select an inference operation. A receiver
// that does not understand the envelope must see none of them, so its existing
// required-field validation rejects before any provider dispatch — for the search
// route, the absent `q` is what produces that rejection.
const INFERENCE_SELECTOR_FIELDS = ['model', 'prompt', 'inputText', 'messages', 'method', 'q'];
const ENVELOPE_FIELDS = ['executionContract', 'maxProviderAttempts', 'paidRequest'];

// Fields whose only purpose is to produce another provider invocation. A
// forwarding boundary refuses them rather than relying on every receiver to
// ignore them once it has admitted the request.
const REPEAT_INFERENCE_FIELDS = ['fallbackModels', 'modelThrottlingRetries', 'maxGeneralServiceRetries',
  'debug_region_override_list', 'debug_force_region_failover_on_model'];

const REJECTIONS = {
  NOT_AN_OBJECT: 'Request body must be an object',
  UNSUPPORTED_CONTRACT: 'Unsupported executionContract',
  BAD_ATTEMPTS: `maxProviderAttempts must be ${MAX_PROVIDER_ATTEMPTS}`,
  PAID_REQUEST_NOT_AN_OBJECT: 'paidRequest must be an object',
  ALTERNATE_OPERATION: 'paidRequest must not select an alternate inference operation',
  CACHE_NOT_BYPASSED: 'paidRequest must set forceBypassCache to true',
  UNSUPPORTED_OUTPUT_CEILING: 'maxOutputTokens does not apply to this operation',
  STRICT_MODE_REQUIRED: 'paidRequest must use mode insight_evidence',
  nestedEnvelopeField: field => `paidRequest must not nest ${field}`,
  topLevelSelector: field => `Envelope must not carry top-level ${field}`,
  repeatInferenceField: field => `paidRequest must not carry ${field}`
};

const isPlainObject = value => !!value && typeof value === 'object' && !Array.isArray(value);

class ExecutionContractError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ValidationError';
    this.code = 'INVALID_EXECUTION_CONTRACT';
  }
}

/**
 * Validates the nested strict-search payload. A bounded search is an embedding
 * operation, so it never carries an output ceiling, and its one content-bearing
 * model call never reads or writes the shared cache.
 */
function validatePaidSearchRequest(paidRequest) {
  if (!isPlainObject(paidRequest)) throw new ExecutionContractError(REJECTIONS.PAID_REQUEST_NOT_AN_OBJECT);
  for (const field of ENVELOPE_FIELDS) {
    if (paidRequest[field] !== undefined) throw new ExecutionContractError(REJECTIONS.nestedEnvelopeField(field));
  }
  if (paidRequest.method !== undefined || paidRequest.prompt !== undefined) {
    throw new ExecutionContractError(REJECTIONS.ALTERNATE_OPERATION);
  }
  for (const field of REPEAT_INFERENCE_FIELDS) {
    if (paidRequest[field] !== undefined) throw new ExecutionContractError(REJECTIONS.repeatInferenceField(field));
  }
  if (paidRequest.forceBypassCache !== true) throw new ExecutionContractError(REJECTIONS.CACHE_NOT_BYPASSED);
  if (paidRequest.maxOutputTokens !== undefined) throw new ExecutionContractError(REJECTIONS.UNSUPPORTED_OUTPUT_CEILING);
  // Conversational search runs query parsing and semantic highlighting, which are
  // further model calls this envelope cannot bound. Only strict evidence search
  // is bounded; Ask Anything's own search path is untouched.
  if (paidRequest.mode !== 'insight_evidence') throw new ExecutionContractError(REJECTIONS.STRICT_MODE_REQUIRED);
  return paidRequest;
}

/** Builds the envelope around an already-prepared strict-search payload. */
function wrapSingleProviderAttempt(paidRequest) {
  validatePaidSearchRequest(paidRequest);
  return { executionContract: EXECUTION_CONTRACT, maxProviderAttempts: MAX_PROVIDER_ATTEMPTS, paidRequest };
}

/**
 * Validates an envelope this boundary is about to forward. A forwarding boundary
 * checks the contract and the attempt bound before it sends anything on, so a
 * malformed envelope never becomes a request another receiver has to judge.
 */
function assertForwardableEnvelope(body) {
  if (!isPlainObject(body)) throw new ExecutionContractError(REJECTIONS.NOT_AN_OBJECT);
  if (body.executionContract !== EXECUTION_CONTRACT) throw new ExecutionContractError(REJECTIONS.UNSUPPORTED_CONTRACT);
  if (body.maxProviderAttempts !== MAX_PROVIDER_ATTEMPTS) throw new ExecutionContractError(REJECTIONS.BAD_ATTEMPTS);
  for (const field of INFERENCE_SELECTOR_FIELDS) {
    if (body[field] !== undefined) throw new ExecutionContractError(REJECTIONS.topLevelSelector(field));
  }
  validatePaidSearchRequest(body.paidRequest);
  return body;
}

/** Every message an envelope rejection can produce, for closed error projections. */
const REJECTION_MESSAGES = new Set([
  ...Object.values(REJECTIONS).filter(value => typeof value === 'string'),
  ...ENVELOPE_FIELDS.map(REJECTIONS.nestedEnvelopeField),
  ...INFERENCE_SELECTOR_FIELDS.map(REJECTIONS.topLevelSelector),
  ...REPEAT_INFERENCE_FIELDS.map(REJECTIONS.repeatInferenceField)
]);

export {
  EXECUTION_CONTRACT,
  MAX_PROVIDER_ATTEMPTS,
  INFERENCE_SELECTOR_FIELDS,
  REPEAT_INFERENCE_FIELDS,
  REJECTION_MESSAGES,
  ExecutionContractError,
  assertForwardableEnvelope,
  validatePaidSearchRequest,
  wrapSingleProviderAttempt
};
