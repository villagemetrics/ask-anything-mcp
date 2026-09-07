// A closed allowlist is checked before construction and again by each tool.
// Undefined preserves the existing interactive tool surface; [] allows nothing.
export function normalizeAllowedTools(value) {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some(name => typeof name !== 'string' || !name)) {
    throw new TypeError('allowedTools must be an array of tool names');
  }
  return Object.freeze([...new Set(value)]);
}

export function assertToolAllowed(allowedTools, name) {
  if (allowedTools !== undefined && !allowedTools.includes(name)) {
    throw Object.assign(new Error('TOOL_NOT_ALLOWED'), { code: 'TOOL_NOT_ALLOWED' });
  }
}
