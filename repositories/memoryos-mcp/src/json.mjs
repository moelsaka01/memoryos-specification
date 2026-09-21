/** Bounded protocol parser; detects duplicate decoded names before JSON.parse can erase evidence. */
export class JsonBoundaryError extends Error {
  constructor(code = -32700) { super('INVALID_JSON'); this.code = code; }
}
export function strictJson(bytes, limits) {
  let text;
  try {
    if (bytes.length > limits.requestFrameBytes || bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) throw 0;
    text = new TextDecoder('utf-8', { fatal: true, ignoreBOM: true }).decode(bytes);
  } catch { throw new JsonBoundaryError(-32600); }
  let index = 0;
  let nodes = 0;
  let members = 0;
  const invalid = () => { throw new JsonBoundaryError(); };
  function whitespace() { while (index < text.length && /[\x20\x09\x0a\x0d]/u.test(text[index])) index++; }
  function string() {
    const start = index++;
    while (index < text.length) {
      const character = text[index++];
      if (character === '"') {
        let value;
        try { value = JSON.parse(text.slice(start, index)); } catch { invalid(); }
        if (!value.isWellFormed() || value.length > limits.jsonStringCodeUnits) invalid();
        return value;
      }
      if (character === '\\') index++;
      else if (character.charCodeAt(0) < 32) invalid();
      if (index - start > limits.requestFrameBytes) invalid();
    }
    invalid();
  }
  function value(depth) {
    if (++nodes > limits.jsonNodes || depth > limits.jsonDepth) invalid();
    whitespace();
    if (text[index] === '"') return string();
    if (text[index] === '{') {
      index++; whitespace();
      const result = Object.create(null);
      if (text[index] === '}') { index++; return result; }
      for (;;) {
        if (text[index] !== '"' || ++members > limits.jsonMembers) invalid();
        const key = string(); whitespace();
        if (Object.hasOwn(result, key) || text[index++] !== ':') invalid();
        result[key] = value(depth + 1); whitespace();
        if (text[index] === '}') { index++; return result; }
        if (text[index++] !== ',') invalid();
        whitespace();
      }
    }
    if (text[index] === '[') {
      index++; whitespace();
      const result = [];
      if (text[index] === ']') { index++; return result; }
      for (;;) {
        result.push(value(depth + 1)); whitespace();
        if (text[index] === ']') { index++; return result; }
        if (text[index++] !== ',') invalid();
      }
    }
    const token = /^(?:true|false|null|-?(?:0|[1-9][0-9]*)(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?)/u.exec(text.slice(index));
    if (!token) invalid();
    index += token[0].length;
    const primitive = JSON.parse(token[0]);
    if (typeof primitive === 'number' && !Number.isFinite(primitive)) invalid();
    return primitive;
  }
  const result = value(1); whitespace();
  if (index !== text.length) invalid();
  return result;
}
