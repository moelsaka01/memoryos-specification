import { J } from './serialization.mjs';
import { reject } from './errors.mjs';

const allowed = new Set(['$schema', '$id', '$defs', '$ref', 'title', 'description', 'type', 'const', 'enum',
  'properties', 'required', 'additionalProperties', 'items', 'minItems', 'maxItems', 'minLength', 'maxLength',
  'pattern', 'minimum', 'maximum', 'oneOf', 'anyOf', 'x-memoryos-base64-max-bytes']);

export function decodeBase64(text, maximum) {
  if (typeof text !== 'string' || text.length === 0 || text.length % 4 !== 0) reject('REQUEST_SCHEMA');
  let pad = 0;
  if (text.endsWith('=')) pad++;
  if (text.endsWith('==')) pad++;
  for (let i = 0; i < text.length - pad; i++) {
    const c = text.charCodeAt(i);
    if (!((c >= 65 && c <= 90) || (c >= 97 && c <= 122) || (c >= 48 && c <= 57) || c === 43 || c === 47)) {
      reject('REQUEST_SCHEMA');
    }
  }
  // Check discarded padding bits without first allocating the decoded content.
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  if (pad === 2 && (alphabet.indexOf(text[text.length - 3]) & 15) !== 0) reject('REQUEST_SCHEMA');
  if (pad === 1 && (alphabet.indexOf(text[text.length - 2]) & 3) !== 0) reject('REQUEST_SCHEMA');
  const length = text.length / 4 * 3 - pad;
  if (length > maximum) reject('INPUT_LIMIT');
  const bytes = Buffer.from(text, 'base64');
  if (bytes.length !== length || bytes.toString('base64') !== text) reject('REQUEST_SCHEMA');
  return bytes;
}

/** Compile only the frozen finite dialect. Unknown keywords are a contract error. */
export function schemaValidator(root) {
  const checked = new WeakSet();
  function lookup(reference) {
    if (typeof reference !== 'string' || !/^#\/\$defs\/[A-Za-z][A-Za-z0-9]*$/.test(reference)) throw new Error('Invalid schema reference');
    const target = root.$defs?.[reference.slice(8)];
    if (!target) throw new Error('Missing schema reference');
    return target;
  }
  function inspect(schema, ancestors = new Set()) {
    if (!schema || typeof schema !== 'object' || Array.isArray(schema) || ancestors.has(schema)) throw new Error('Invalid schema');
    if (checked.has(schema)) return;
    const chain = new Set(ancestors); chain.add(schema);
    for (const key of Object.keys(schema)) if (!allowed.has(key)) throw new Error('Unsupported schema keyword');
    if (schema.additionalProperties !== undefined && schema.additionalProperties !== false) throw new Error('Open schema prohibited');
    if (schema.type !== undefined && !['object', 'array', 'string', 'integer', 'number', 'boolean', 'null'].includes(schema.type)) throw new Error('Invalid schema type');
    if (schema.type === 'object' && schema.additionalProperties !== false) throw new Error('Closed object required');
    for (const key of ['$defs', 'properties']) {
      if (schema[key] !== undefined && (schema[key] === null || typeof schema[key] !== 'object' || Array.isArray(schema[key]))) throw new Error('Invalid schema map');
    }
    if (Object.hasOwn(schema, '$ref') && typeof schema.$ref !== 'string') throw new Error('Invalid schema reference');
    if (Object.hasOwn(schema, '$ref')) lookup(schema.$ref);
    if (schema.enum !== undefined && (!Array.isArray(schema.enum) || !schema.enum.length || new Set(schema.enum.map(J)).size !== schema.enum.length)) throw new Error('Invalid schema enum');
    if (schema.pattern !== undefined) {
      if (typeof schema.pattern !== 'string' || !schema.pattern.startsWith('^') || !schema.pattern.endsWith('$')) throw new Error('Unanchored schema pattern');
      new RegExp(schema.pattern, 'u');
    }
    for (const key of ['minItems', 'maxItems', 'minLength', 'maxLength', 'minimum', 'maximum', 'x-memoryos-base64-max-bytes']) {
      if (schema[key] !== undefined && !Number.isSafeInteger(schema[key])) throw new Error('Invalid schema bound');
    }
    for (const [low, high] of [['minItems','maxItems'], ['minLength','maxLength'], ['minimum','maximum']]) {
      if (schema[low] !== undefined && schema[high] !== undefined && schema[low] > schema[high]) throw new Error('Inverted schema bounds');
    }
    for (const key of ['minItems','maxItems','minLength','maxLength','x-memoryos-base64-max-bytes']) if (schema[key] !== undefined && schema[key] < 0) throw new Error('Negative schema bound');
    if (schema.required !== undefined && (!Array.isArray(schema.required) || new Set(schema.required).size !== schema.required.length
      || schema.required.some((key) => typeof key !== 'string' || !Object.hasOwn(schema.properties ?? {}, key)))) throw new Error('Invalid required fields');
    if (schema.$ref) inspect(lookup(schema.$ref), chain);
    for (const item of Object.values(schema.$defs ?? {})) inspect(item, chain);
    for (const item of Object.values(schema.properties ?? {})) inspect(item, chain);
    if (schema.items) inspect(schema.items, chain);
    for (const combinator of ['oneOf', 'anyOf']) {
      if (schema[combinator] !== undefined) {
        if (!Array.isArray(schema[combinator]) || !schema[combinator].length) throw new Error('Invalid schema alternatives');
        for (const item of schema[combinator]) inspect(item, chain);
      }
    }
    checked.add(schema);
  }
  inspect(root);
  function matches(schema, input) {
    if (schema.$ref && !matches(lookup(schema.$ref), input)) return false;
    if (Object.hasOwn(schema, 'const') && J(input) !== J(schema.const)) return false;
    if (schema.enum && !schema.enum.some((item) => J(input) === J(item))) return false;
    if (schema.oneOf && schema.oneOf.filter((item) => matches(item, input)).length !== 1) return false;
    if (schema.anyOf && !schema.anyOf.some((item) => matches(item, input))) return false;
    if (schema.type) {
      const kind = input === null ? 'null' : Array.isArray(input) ? 'array' : typeof input;
      if (schema.type === 'integer' || schema.type === 'number') {
        if (kind !== 'number' || !Number.isSafeInteger(input) || Object.is(input, -0)) return false;
      } else if (kind !== schema.type) return false;
    }
    if (typeof input === 'string') {
      if (!input.isWellFormed()) return false;
      let length = 0;
      for (const character of input) length++;
      if (schema.minLength !== undefined && length < schema.minLength) return false;
      if (schema.maxLength !== undefined && length > schema.maxLength) return false;
      if (schema['x-memoryos-base64-max-bytes'] !== undefined) {
        try { decodeBase64(input, schema['x-memoryos-base64-max-bytes']); } catch { return false; }
      }
      if (schema.pattern && !new RegExp(schema.pattern, 'u').test(input)) return false;
    }
    if (typeof input === 'number' && ((schema.minimum !== undefined && input < schema.minimum)
      || (schema.maximum !== undefined && input > schema.maximum))) return false;
    if (Array.isArray(input)) {
      if (schema.minItems !== undefined && input.length < schema.minItems) return false;
      if (schema.maxItems !== undefined && input.length > schema.maxItems) return false;
      if (schema.items && !input.every((item) => matches(schema.items, item))) return false;
    } else if (input !== null && typeof input === 'object') {
      if (schema.required?.some((key) => !Object.hasOwn(input, key))) return false;
      for (const key of Object.keys(input)) {
        if (!Object.hasOwn(schema.properties ?? {}, key)) {
          if (schema.additionalProperties === false) return false;
        } else if (!matches(schema.properties[key], input[key])) return false;
      }
    }
    return true;
  }
  return (name, input) => {
    try { return matches(lookup('#/$defs/' + name), input); } catch { return false; }
  };
}
