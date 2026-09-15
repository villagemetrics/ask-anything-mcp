import { currentRemoteCall } from '../lib/remoteCalls.js';
import bunyan from 'bunyan';

// Create a bunyan logger that outputs to stderr only
// This keeps stdout clean for MCP protocol communication
export function createLogger(label) {
  const logLevel = process.env.VM_LOG_LEVEL || 'info';
  
  const logger = bunyan.createLogger({
    name: 'ask-anything-mcp',
    component: label,
    level: logLevel,
    streams: [{
      stream: process.stderr
    }],
    serializers: bunyan.stdSerializers
  });
  for (const level of ['trace', 'debug', 'info', 'warn', 'error', 'fatal']) {
    const emit = logger[level].bind(logger);
    logger[level] = (...args) => {
      const metadata = currentRemoteCall()?.automatedMetadata;
      if (!metadata || !args.length) return emit(...args);
      return emit({ ...metadata, event: 'automated_mcp_operation' }, 'automated_mcp_operation');
    };
  }
  return logger;
}
