/** MCP projection serialization. Never used to canonicalize MemoryOS artifacts. */
export function J(value) {
  const seen = new Set();
  function string(text) {
    if (!text.isWellFormed()) throw new TypeError('INVALID_UNICODE');
    return JSON.stringify(text).replace(/[\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/gu,
      (character) => `\\u${character.charCodeAt(0).toString(16).padStart(4, '0')}`);
  }
  function visit(item) {
    if (item === null) return 'null';
    if (typeof item === 'string') return string(item);
    if (typeof item === 'boolean') return item ? 'true' : 'false';
    if (typeof item === 'number' && Number.isFinite(item)) return JSON.stringify(item);
    if (typeof item !== 'object' || seen.has(item)) throw new TypeError('NON_JSON');
    seen.add(item);
    let result;
    if (Array.isArray(item)) {
      if (Object.keys(item).length !== item.length) throw new TypeError('SPARSE_ARRAY');
      result = `[${item.map(visit).join(',')}]`;
    } else {
      if (![Object.prototype, null].includes(Object.getPrototypeOf(item))) throw new TypeError('NON_JSON');
      result = `{${Object.keys(item).sort().map((key) => `${string(key)}:${visit(item[key])}`).join(',')}}`;
    }
    seen.delete(item);
    return result;
  }
  return visit(value);
}
