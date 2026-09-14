import { sha256Hex, utf8Encode } from "./mip-canonical.js";

export const RESTRICTED_JSON_SAFE_INTEGER_MIN = -9007199254740991;
export const RESTRICTED_JSON_SAFE_INTEGER_MAX = 9007199254740991;

export const POLICY_FAILURE_CODES = Object.freeze([
  "POLICY_SYNTAX_INVALID",
  "POLICY_SCHEMA_INVALID",
  "POLICY_VERSION_UNSUPPORTED",
  "RULE_TYPE_UNSUPPORTED",
  "RULE_VERSION_UNSUPPORTED",
  "POLICY_SET_INVALID",
  "POLICY_DIGEST_MISMATCH",
  "POLICY_RESOURCE_PROFILE_SYNTAX_INVALID",
  "POLICY_RESOURCE_PROFILE_SCHEMA_INVALID",
  "POLICY_RESOURCE_PROFILE_IDENTIFIER_UNSUPPORTED",
  "POLICY_RESOURCE_PROFILE_VERSION_UNSUPPORTED",
  "POLICY_RESOURCE_PROFILE_DIGEST_MISMATCH",
  "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
  "POLICY_EVALUATION_RESOURCE_LIMIT_EXCEEDED",
]);

const POLICY_FAILURE_CODE_SET = new Set(POLICY_FAILURE_CODES);
const JSON_WHITESPACE = new Set([0x09, 0x0a, 0x0d, 0x20]);
const INTEGER_PATTERN = /^(?:0|-?[1-9][0-9]*)$/u;
const STABLE_SEMVER_PATTERN = /^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$/u;
const DOTTED_IDENTIFIER_PATTERN = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*(?:\.[a-z][a-z0-9]*(?:-[a-z0-9]+)*)*$/u;
const textDecoder = new TextDecoder("utf-8", { fatal: true });
const IntrinsicUint8Array = Uint8Array;
const arrayBufferIsView = ArrayBuffer.isView;
const arrayBufferByteLengthGetter = Object.getOwnPropertyDescriptor(ArrayBuffer.prototype, "byteLength").get;
const sharedArrayBufferByteLengthGetter = typeof SharedArrayBuffer === "function"
  ? Object.getOwnPropertyDescriptor(SharedArrayBuffer.prototype, "byteLength").get
  : undefined;
const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
const typedArrayBufferGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, "buffer").get;
const typedArrayByteLengthGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, "byteLength").get;
const typedArrayByteOffsetGetter = Object.getOwnPropertyDescriptor(typedArrayPrototype, "byteOffset").get;
const dataViewBufferGetter = Object.getOwnPropertyDescriptor(DataView.prototype, "buffer").get;
const dataViewByteLengthGetter = Object.getOwnPropertyDescriptor(DataView.prototype, "byteLength").get;
const dataViewByteOffsetGetter = Object.getOwnPropertyDescriptor(DataView.prototype, "byteOffset").get;
const uint8ArraySet = Uint8Array.prototype.set;

function immutableDetails(details) {
  const copy = Object.create(null);
  for (const [name, value] of Object.entries(details ?? {})) copy[name] = value;
  return Object.freeze(copy);
}

export class MemoryOSPolicyError extends Error {
  constructor(code, message, details = {}) {
    if (!POLICY_FAILURE_CODE_SET.has(code)) {
      throw new TypeError(`Unknown MemoryOS Policy failure code: ${String(code)}`);
    }
    super(String(message));
    this.name = "MemoryOSPolicyError";
    this.code = code;
    this.details = immutableDetails(details);
    for (const [name, value] of Object.entries(this.details)) {
      if (!(name in this)) Object.defineProperty(this, name, { enumerable: true, value });
    }
    Object.freeze(this);
  }
}

export class RestrictedJsonError extends SyntaxError {
  constructor(message) {
    super(message);
    this.name = "RestrictedJsonError";
  }
}

export class RestrictedJsonResourceLimitError extends RangeError {
  constructor(metric, configuredLimit) {
    super(`Restricted JSON exceeds ${metric}.`);
    this.name = "RestrictedJsonResourceLimitError";
    this.metric = metric;
    this.configuredLimit = configuredLimit;
    this.observedAtLeast = configuredLimit + 1;
    Object.freeze(this);
  }
}

function isSharedArrayBuffer(value) {
  if (sharedArrayBufferByteLengthGetter === undefined) return false;
  try {
    Reflect.apply(sharedArrayBufferByteLengthGetter, value, []);
    return true;
  } catch {
    return false;
  }
}

function arrayBufferByteLength(value) {
  try {
    return Reflect.apply(arrayBufferByteLengthGetter, value, []);
  } catch {
    return undefined;
  }
}

function inspectView(value) {
  try {
    return {
      byteLength: Reflect.apply(typedArrayByteLengthGetter, value, []),
      byteOffset: Reflect.apply(typedArrayByteOffsetGetter, value, []),
      storage: Reflect.apply(typedArrayBufferGetter, value, []),
    };
  } catch {
    return {
      byteLength: Reflect.apply(dataViewByteLengthGetter, value, []),
      byteOffset: Reflect.apply(dataViewByteOffsetGetter, value, []),
      storage: Reflect.apply(dataViewBufferGetter, value, []),
    };
  }
}

export function inspectByteInput(value, label = "Byte input") {
  let byteLength;
  let byteOffset = 0;
  let storage;
  if (Reflect.apply(arrayBufferIsView, ArrayBuffer, [value])) {
    ({ byteLength, byteOffset, storage } = inspectView(value));
  } else {
    storage = value;
    byteLength = arrayBufferByteLength(value);
  }
  if (isSharedArrayBuffer(storage)) {
    throw new TypeError(`${label} must not use shared mutable storage.`);
  }
  if (byteLength === undefined) {
    throw new TypeError(`${label} must be an ArrayBuffer or typed-array view.`);
  }
  return Object.freeze({
    byteLength,
    snapshot() {
      const source = new IntrinsicUint8Array(storage, byteOffset, byteLength);
      const result = new IntrinsicUint8Array(byteLength);
      Reflect.apply(uint8ArraySet, result, [source, 0]);
      return result;
    },
  });
}

export function byteInputLength(value, label = "Byte input") {
  return inspectByteInput(value, label).byteLength;
}

export function toUint8Array(value, label = "Byte input") {
  return inspectByteInput(value, label).snapshot();
}

export { utf8Encode };

export function isUnicodeScalarString(value) {
  if (typeof value !== "string") return false;
  for (let index = 0; index < value.length; index += 1) {
    const code = value.charCodeAt(index);
    if (code >= 0xd800 && code <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const following = value.charCodeAt(index + 1);
      if (following < 0xdc00 || following > 0xdfff) return false;
      index += 1;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      return false;
    }
  }
  return true;
}

function requireScalarString(value, label, allowEmpty = true) {
  if (!isUnicodeScalarString(value) || (!allowEmpty && value.length === 0)) {
    throw new TypeError(`${label} must be ${allowEmpty ? "a" : "a non-empty"} Unicode scalar string.`);
  }
}

export function utf16Compare(left, right) {
  for (let index = 0; index < Math.min(left.length, right.length); index += 1) {
    const difference = left.charCodeAt(index) - right.charCodeAt(index);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

export function isStableSemVer(value) {
  return typeof value === "string" && STABLE_SEMVER_PATTERN.test(value);
}

export function isDottedIdentifier(value) {
  return typeof value === "string" && DOTTED_IDENTIFIER_PATTERN.test(value);
}

function parseIntegerToken(token) {
  if (!INTEGER_PATTERN.test(token) || token === "-0") {
    throw new RestrictedJsonError("JSON number is not a permitted restricted safe integer.");
  }
  let exact;
  try {
    exact = BigInt(token);
  } catch {
    throw new RestrictedJsonError("JSON integer is invalid.");
  }
  if (exact < BigInt(RESTRICTED_JSON_SAFE_INTEGER_MIN)
      || exact > BigInt(RESTRICTED_JSON_SAFE_INTEGER_MAX)) {
    throw new RestrictedJsonError("JSON integer is outside the restricted safe-integer range.");
  }
  return Number(exact);
}

function decodeRestrictedUtf8(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new RestrictedJsonError("A UTF-8 BOM is prohibited.");
  }
  let source;
  try {
    source = textDecoder.decode(bytes);
  } catch {
    throw new RestrictedJsonError("Input is not valid UTF-8.");
  }
  if (!isUnicodeScalarString(source)) {
    throw new RestrictedJsonError("Input contains a lone Unicode surrogate.");
  }
  return source;
}

function normalizeParserLimit(value, label) {
  if (value === undefined) return Number.MAX_SAFE_INTEGER;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer.`);
  }
  return value;
}

function parseRestrictedJsonInternal(bytesLike, limits = {}, deferResourceLimits = false) {
  if (limits === null || typeof limits !== "object" || Array.isArray(limits)) {
    throw new TypeError("Restricted JSON parser limits must be an object.");
  }
  const maximumDepth = normalizeParserLimit(limits.maximumDepth, "maximumDepth");
  const maximumValueCount = normalizeParserLimit(limits.maximumValueCount, "maximumValueCount");
  const maximumStringUtf8Bytes = normalizeParserLimit(
    limits.maximumStringUtf8Bytes,
    "maximumStringUtf8Bytes",
  );
  const source = decodeRestrictedUtf8(toUint8Array(bytesLike));
  const omitted = Symbol("omittedRestrictedJsonValue");
  let offset = 0;
  let resourceLimitExceeded = false;
  const observed = {
    maximumDepth: 0,
    maximumStringUtf8Bytes: 0,
    maximumValueCount: 0,
  };

  const recordMetric = (metric, value, configuredLimit) => {
    const saturated = configuredLimit === Number.MAX_SAFE_INTEGER
      ? value
      : Math.min(value, configuredLimit + 1);
    observed[metric] = Math.max(observed[metric], saturated);
    if (value > configuredLimit) {
      resourceLimitExceeded = true;
      if (deferResourceLimits) return;
      throw new RestrictedJsonResourceLimitError(metric, configuredLimit);
    }
  };

  const recordString = (value) => {
    recordMetric(
      "maximumStringUtf8Bytes",
      utf8Encode(value).length,
      maximumStringUtf8Bytes,
    );
    return value;
  };

  const skipWhitespace = () => {
    while (offset < source.length && JSON_WHITESPACE.has(source.charCodeAt(offset))) offset += 1;
  };

  const fail = (message) => {
    throw new RestrictedJsonError(`${message} at UTF-16 offset ${offset}.`);
  };

  const parseString = () => {
    if (source.charCodeAt(offset) !== 0x22) fail("Expected JSON string");
    const start = offset;
    offset += 1;
    while (offset < source.length) {
      const code = source.charCodeAt(offset);
      if (code === 0x22) {
        offset += 1;
        let result;
        try {
          result = JSON.parse(source.slice(start, offset));
        } catch {
          fail("Invalid JSON string");
        }
        if (!isUnicodeScalarString(result)) fail("JSON string contains a lone Unicode surrogate");
        return recordString(result);
      }
      if (code < 0x20) fail("JSON string contains an unescaped control character");
      if (code === 0x5c) {
        offset += 1;
        if (offset >= source.length) fail("JSON string contains a truncated escape");
        const escape = source[offset];
        if (!'"\\/bfnrtu'.includes(escape)) fail("JSON string contains an invalid escape");
        if (escape === "u") {
          const digits = source.slice(offset + 1, offset + 5);
          if (!/^[0-9A-Fa-f]{4}$/u.test(digits)) fail("JSON string contains an invalid Unicode escape");
          offset += 4;
        }
      }
      offset += 1;
    }
    fail("Unterminated JSON string");
  };

  const parseValue = (openContainers = 0) => {
    skipWhitespace();
    if (offset >= source.length) fail("Missing JSON value");
    recordMetric(
      "maximumValueCount",
      observed.maximumValueCount + 1,
      maximumValueCount,
    );
    const current = source[offset];

    if (current === '"') {
      const value = parseString();
      return resourceLimitExceeded ? omitted : value;
    }

    if (current === "[") {
      const depth = openContainers + 1;
      recordMetric("maximumDepth", depth, maximumDepth);
      offset += 1;
      const result = resourceLimitExceeded ? undefined : [];
      skipWhitespace();
      if (source[offset] === "]") {
        offset += 1;
        return resourceLimitExceeded ? omitted : result;
      }
      while (true) {
        const child = parseValue(depth);
        if (!resourceLimitExceeded) result.push(child);
        skipWhitespace();
        if (source[offset] === "]") {
          offset += 1;
          return resourceLimitExceeded ? omitted : result;
        }
        if (source[offset] !== ",") fail("Expected array comma or closing bracket");
        offset += 1;
      }
    }

    if (current === "{") {
      const depth = openContainers + 1;
      recordMetric("maximumDepth", depth, maximumDepth);
      offset += 1;
      const result = resourceLimitExceeded ? undefined : Object.create(null);
      const decodedNames = new Set();
      skipWhitespace();
      if (source[offset] === "}") {
        offset += 1;
        return resourceLimitExceeded ? omitted : result;
      }
      while (true) {
        skipWhitespace();
        const memberName = parseString();
        if (decodedNames.has(memberName)) fail("Duplicate decoded object member");
        decodedNames.add(memberName);
        skipWhitespace();
        if (source[offset] !== ":") fail("Expected object-member colon");
        offset += 1;
        const child = parseValue(depth);
        if (!resourceLimitExceeded) result[memberName] = child;
        skipWhitespace();
        if (source[offset] === "}") {
          offset += 1;
          return resourceLimitExceeded ? omitted : result;
        }
        if (source[offset] !== ",") fail("Expected object comma or closing brace");
        offset += 1;
      }
    }

    for (const [token, value] of [["true", true], ["false", false], ["null", null]]) {
      if (source.startsWith(token, offset)) {
        offset += token.length;
        return resourceLimitExceeded ? omitted : value;
      }
    }

    const numeric = /^-?(?:0|[1-9][0-9]*)/u.exec(source.slice(offset));
    if (!numeric) fail("Prohibited or invalid JSON value");
    offset += numeric[0].length;
    const following = source[offset];
    if (following === "." || following === "e" || following === "E") {
      fail("Fractions and exponent notation are prohibited");
    }
    const value = parseIntegerToken(numeric[0]);
    return resourceLimitExceeded ? omitted : value;
  };

  const result = parseValue();
  skipWhitespace();
  if (offset !== source.length) fail("Trailing JSON input or a second JSON value is prohibited");
  return Object.freeze({
    census: Object.freeze({
      maximumDepth: observed.maximumDepth,
      maximumStringUtf8Bytes: observed.maximumStringUtf8Bytes,
      valueCount: observed.maximumValueCount,
    }),
    resourceLimitExceeded,
    value: resourceLimitExceeded || result === omitted ? undefined : result,
  });
}

export function parseRestrictedJson(bytesLike, limits = {}) {
  return parseRestrictedJsonInternal(bytesLike, limits, false).value;
}

export function parseRestrictedJsonWithCensus(bytesLike, limits) {
  return parseRestrictedJsonInternal(bytesLike, limits, true);
}

function isJsonObject(value) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === null || prototype === Object.prototype;
}

function assertDataDescriptor(descriptor) {
  if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
    throw new TypeError("Canonical JSON values may contain only enumerable data properties.");
  }
}

function canonicalText(value, ancestors = new Set()) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!Number.isSafeInteger(value) || Object.is(value, -0)) {
      throw new TypeError("Canonical JSON numbers must be restricted safe integers.");
    }
    return String(value);
  }
  if (typeof value === "string") {
    requireScalarString(value, "Canonical JSON string");
    return JSON.stringify(value);
  }
  if (typeof value !== "object") {
    throw new TypeError("Value contains a non-JSON value category.");
  }
  if (ancestors.has(value)) throw new TypeError("Canonical JSON values must be acyclic.");
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        throw new TypeError("Canonical arrays must use the intrinsic Array prototype.");
      }
      const ownKeys = Reflect.ownKeys(value);
      if (ownKeys.some((key) => typeof key === "symbol") || ownKeys.length !== value.length + 1) {
        throw new TypeError("Canonical arrays must be dense and have no custom properties.");
      }
      const items = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        assertDataDescriptor(descriptor);
        items.push(canonicalText(descriptor.value, ancestors));
      }
      return `[${items.join(",")}]`;
    }
    if (!isJsonObject(value)) {
      throw new TypeError("Canonical JSON objects must have an Object or null prototype.");
    }
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw new TypeError("Canonical JSON objects cannot contain symbol properties.");
    }
    const names = Object.getOwnPropertyNames(value);
    names.forEach((name) => requireScalarString(name, "Canonical JSON member name"));
    names.sort(utf16Compare);
    return `{${names.map((name) => {
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      assertDataDescriptor(descriptor);
      return `${JSON.stringify(name)}:${canonicalText(descriptor.value, ancestors)}`;
    }).join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalizeRestrictedJsonText(value) {
  return canonicalText(value);
}

export function canonicalizeRestrictedJson(value) {
  return utf8Encode(canonicalText(value));
}

export function jsonCensus(value) {
  const result = { maximumDepth: 0, maximumStringUtf8Bytes: 0, valueCount: 0 };
  const visit = (current, openContainers) => {
    result.valueCount += 1;
    if (typeof current === "string") {
      requireScalarString(current, "JSON string");
      result.maximumStringUtf8Bytes = Math.max(result.maximumStringUtf8Bytes, utf8Encode(current).length);
      return;
    }
    if (Array.isArray(current)) {
      const depth = openContainers + 1;
      result.maximumDepth = Math.max(result.maximumDepth, depth);
      for (const item of current) visit(item, depth);
      return;
    }
    if (isJsonObject(current)) {
      const depth = openContainers + 1;
      result.maximumDepth = Math.max(result.maximumDepth, depth);
      for (const [name, item] of Object.entries(current)) {
        requireScalarString(name, "JSON member name");
        result.maximumStringUtf8Bytes = Math.max(result.maximumStringUtf8Bytes, utf8Encode(name).length);
        visit(item, depth);
      }
    }
  };
  visit(value, 0);
  return Object.freeze(result);
}

export function validateRegisteredOrderedStringSet(value, registeredOrder) {
  if (!Array.isArray(value) || !Array.isArray(registeredOrder) || value.length === 0) return false;
  const positions = new Map(registeredOrder.map((member, index) => [member, index]));
  const seen = new Set();
  let previous = -1;
  for (const member of value) {
    if (!isUnicodeScalarString(member) || seen.has(member) || !positions.has(member)) return false;
    const position = positions.get(member);
    if (position <= previous) return false;
    seen.add(member);
    previous = position;
  }
  return true;
}

function concatenate(parts) {
  const length = parts.reduce((total, part) => total + part.length, 0);
  if (!Number.isSafeInteger(length)) throw new RangeError("Digest input is too large.");
  const result = new Uint8Array(length);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }
  return result;
}

export function domainSeparatedDigest(domain, canonicalBytesLike) {
  requireScalarString(domain, "Digest domain", false);
  if (!/^[\x21-\x7e]+$/u.test(domain)) {
    throw new TypeError("Digest domain must be non-empty printable ASCII without NUL.");
  }
  const domainBytes = utf8Encode(domain);
  const canonicalBytes = toUint8Array(canonicalBytesLike, "Canonical digest input");
  return `sha256:${sha256Hex(concatenate([domainBytes, Uint8Array.of(0), canonicalBytes]))}`;
}
