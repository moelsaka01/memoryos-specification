import { reject } from './errors.mjs';

/** Parse JSON before schema validation; duplicate decoded keys never get assigned. */
export function parseJSON(bytes, maximum = 16384, code = 'CONFIG_INVALID') {
  const limits = {bytes:maximum, depth:8, members:256, nodes:1024, keyCodeUnits:64, stringCodeUnits:maximum, totalStringCodeUnits:maximum};
  if (!(bytes instanceof Uint8Array)) reject(code);
  if (bytes.length > limits.bytes) reject(code);
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) reject(code);
  let source;
  try { source = new TextDecoder('utf-8', {fatal: true, ignoreBOM: true}).decode(bytes); }
  catch { reject(code); }
  let position = 0, nodes = 0, members = 0, stringUnits = 0;
  const syntax = () => reject(code);
  const bound = (value, maximum) => { if (value > maximum) reject(code); };
  function space() {
    while (position < source.length && [' ', '\n', '\r', '\t'].includes(source[position])) position++;
  }
  function string(key = false) {
    const start = position++;
    let closed = false;
    while (position < source.length) {
      const code = source.charCodeAt(position++);
      if (code === 34) { closed = true; break; }
      if (code < 32) syntax();
      if (code === 92) {
        const escaped = source[position++];
        if (escaped === 'u') {
          if (!/^[0-9a-fA-F]{4}$/.test(source.slice(position, position + 4))) syntax();
          position += 4;
        } else if (escaped === undefined || !'"\\/bfnrt'.includes(escaped)) syntax();
      }
    }
    if (!closed) syntax();
    let decoded;
    try { decoded = JSON.parse(source.slice(start, position)); } catch { syntax(); }
    if (!decoded.isWellFormed() || /[\x00-\x1f\x7f]/u.test(decoded)) syntax();
    if (key && ['__proto__','prototype','constructor'].includes(decoded)) syntax();
    bound(decoded.length, key ? limits.keyCodeUnits : limits.stringCodeUnits);
    stringUnits += decoded.length;
    bound(stringUnits, limits.totalStringCodeUnits);
    return decoded;
  }
  function value(depth) {
    space();
    bound(++nodes, limits.nodes);
    const char = source[position];
    if (char === '"') return string();
    if (char === '{' || char === '[') {
      bound(depth + 1, limits.depth);
      const object = char === '{';
      const output = object ? Object.create(null) : [];
      const closing = object ? '}' : ']';
      position++; space();
      if (source[position] === closing) { position++; return output; }
      for (;;) {
        if (object) {
          if (source[position] !== '"') syntax();
          bound(++members, limits.members);
          const key = string(true);
          if (Object.hasOwn(output, key)) syntax();
          space(); if (source[position++] !== ':') syntax();
          output[key] = value(depth + 1);
        } else output.push(value(depth + 1));
        space();
        if (source[position] === closing) { position++; return output; }
        if (source[position++] !== ',') syntax();
        space();
      }
    }
    for (const [token, result] of [['true', true], ['false', false], ['null', null]]) {
      if (source.startsWith(token, position)) { position += token.length; return result; }
    }
    const start = position;
    if (source[position] === '-') position++;
    if (source[position] === '0') position++;
    else {
      if (source[position] === undefined || source[position] < '1' || source[position] > '9') syntax();
      while (position < source.length && source[position] >= '0' && source[position] <= '9') position++;
    }
    const token = source.slice(start, position);
    const result = Number(token);
    if (token.startsWith('-') || !Number.isSafeInteger(result)) syntax();
    return result;
  }
  const result = value(0);
  space();
  if (position !== source.length) syntax();
  return result;
}
