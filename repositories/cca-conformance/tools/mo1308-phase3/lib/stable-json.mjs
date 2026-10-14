// MO-1308 Phase 3 shared library: deterministic JSON for campaign records.
// These records are conformance evidence, not MO-1308-authored product bytes, so they use a plain stable form (keys sorted
// by UTF-16 code unit, two-space indentation, one trailing LF) rather than the Standard's JCS. Only integers, strings,
// booleans, null, arrays and plain objects are allowed: a fraction or an `undefined` would make the bytes depend on the
// producer, so they are rejected.
export function stableValue(value, path = '$') {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) throw new TypeError(`stable JSON: ${path} is not a safe integer`);
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => stableValue(item, `${path}[${index}]`));
  if (typeof value === 'object') {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) throw new TypeError(`stable JSON: ${path} is not a plain object`);
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (value[key] === undefined) throw new TypeError(`stable JSON: ${path}.${key} is undefined`);
      out[key] = stableValue(value[key], `${path}.${key}`);
    }
    return out;
  }
  throw new TypeError(`stable JSON: ${path} has unsupported type ${typeof value}`);
}

export const stableStringify = (value) => `${JSON.stringify(stableValue(value), null, 2)}\n`;
export const stableBytes = (value) => Buffer.from(stableStringify(value), 'utf8');
