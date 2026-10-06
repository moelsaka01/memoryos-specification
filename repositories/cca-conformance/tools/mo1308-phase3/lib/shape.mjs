// MO-1308 Phase 3 shared library: a tiny closed-shape validator for campaign records. A validator is a function
// (value, path, problems) that pushes a message per violation; `check` runs one and returns the messages.
export const check = (validator, value) => { const problems = []; validator(value, '$', problems); return problems; };

export const str = (min = 0, max = 4096) => (value, path, problems) => {
  if (typeof value !== 'string' || value.length < min || value.length > max) problems.push(`${path}: expected a string of ${min}..${max} characters`);
};
export const int = (min = 0, max = Number.MAX_SAFE_INTEGER) => (value, path, problems) => {
  if (!Number.isSafeInteger(value) || value < min || value > max) problems.push(`${path}: expected an integer ${min}..${max}`);
};
export const bool = (value, path, problems) => { if (typeof value !== 'boolean') problems.push(`${path}: expected a boolean`); };
export const lit = (expected) => (value, path, problems) => { if (value !== expected) problems.push(`${path}: expected ${JSON.stringify(expected)}`); };
export const oneOf = (values) => (value, path, problems) => { if (!values.includes(value)) problems.push(`${path}: expected one of ${values.join(', ')}`); };
export const nullable = (inner) => (value, path, problems) => { if (value !== null) inner(value, path, problems); };
export const arrayOf = (inner) => (value, path, problems) => {
  if (!Array.isArray(value)) { problems.push(`${path}: expected an array`); return; }
  value.forEach((item, index) => inner(item, `${path}[${index}]`, problems));
};
export const any = () => undefined;
export const isDigest = (value, path, problems) => {
  if (typeof value !== 'string' || !/^[0-9a-f]{64}$/.test(value)) problems.push(`${path}: expected 64 lower-case hex characters`);
};
export const isPrefixedDigest = (value, path, problems) => {
  if (typeof value !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(value)) problems.push(`${path}: expected sha256:<64 hex>`);
};
export const isIsoTime = (value, path, problems) => {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value)) || !value.endsWith('Z')) problems.push(`${path}: expected a UTC ISO time`);
};
export const closedObject = (spec) => (value, path, problems) => {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) { problems.push(`${path}: expected an object`); return; }
  const actual = Object.keys(value).sort();
  const expected = Object.keys(spec).sort();
  for (const key of actual) if (!expected.includes(key)) problems.push(`${path}.${key}: unexpected member`);
  for (const key of expected) {
    if (!(key in value)) problems.push(`${path}.${key}: missing member`);
    else spec[key](value[key], `${path}.${key}`, problems);
  }
};
export const fileRecord = closedObject({ path: str(1, 512), byteLength: int(), sha256: isDigest });
