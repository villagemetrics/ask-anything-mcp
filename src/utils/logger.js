import bunyan from 'bunyan';

// Create a bunyan logger that outputs to stderr only
// This keeps stdout clean for MCP protocol communication
export function createLogger(label) {
  const logLevel = process.env.VM_LOG_LEVEL || 'info';
  
  return bunyan.createLogger({
    name: 'ask-anything-mcp',
    component: label,
    level: logLevel,
    streams: [{
      stream: process.stderr
    }],
    serializers: bunyan.stdSerializers
  });
}
