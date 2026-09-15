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
  "POLICY_FACT_CONTEXT_SYNTAX_INVALID",
  "POLICY_FACT_CONTEXT_SCHEMA_INVALID",
  "POLICY_FACT_CONTEXT_VERSION_UNSUPPORTED",
  "POLICY_FACT_MODEL_VERSION_UNSUPPORTED",
  "POLICY_FACT_CONTEXT_TRANSITION_BINDING_MISMATCH",
  "POLICY_FACT_CONTEXT_INCOMPLETE",
  "POLICY_FACT_CONTEXT_DIGEST_MISMATCH",
  "POLICY_FACT_CONTEXT_ATOMIC_CAPTURE_FAILED",
  "POLICY_FACT_CONTEXT_SOURCE_STATE_INVALID",
  "POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED",
  "DETERMINISTIC_FACT_SOURCE_SYNTAX_INVALID",
  "DETERMINISTIC_FACT_SOURCE_SCHEMA_INVALID",
  "DETERMINISTIC_FACT_SOURCE_DOMAIN_UNSUPPORTED",
  "DETERMINISTIC_FACT_SOURCE_VERSION_UNSUPPORTED",
  "DETERMINISTIC_FACT_SOURCE_MODEL_VERSION_UNSUPPORTED",
  "DETERMINISTIC_FACT_SOURCE_DUPLICATE",
  "REGRESSION_POLICY_FACT_SOURCE_SCHEMA_INVALID",
  "REGRESSION_REPORT_VERSION_UNSUPPORTED",
  "REGRESSION_POLICY_FACT_SOURCE_INCOMPLETE",
  "REGRESSION_POLICY_FACT_SOURCE_DIGEST_MISMATCH",
  "REGRESSION_POLICY_FACT_SOURCE_ATOMIC_CAPTURE_FAILED",
  "REGRESSION_REPORT_INVALID",
  "REGRESSION_REPORT_IDENTITY_MISMATCH",
  "REGRESSION_POLICY_FACT_SOURCE_BASELINE_BINDING_INVALID",
  "REGRESSION_POLICY_FACT_SOURCE_CANDIDATE_BINDING_MISMATCH",
  "DETERMINISTIC_FACT_SOURCE_PROVENANCE_UNTRUSTED",
  "POLICY_EVALUATION_OUTCOME_IDENTITY_MISMATCH",
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
const intrinsicReflectApply = Reflect.apply;
const intrinsicReflectOwnKeys = Reflect.ownKeys;
const intrinsicObjectCreate = Object.create;
const intrinsicObjectDefineProperty = Object.defineProperty;
const intrinsicObjectEntries = Object.entries;
const intrinsicObjectFreeze = Object.freeze;
const intrinsicObjectGetOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
const intrinsicObjectGetOwnPropertyNames = Object.getOwnPropertyNames;
const intrinsicObjectGetOwnPropertySymbols = Object.getOwnPropertySymbols;
const intrinsicObjectGetPrototypeOf = Object.getPrototypeOf;
const intrinsicObjectIs = Object.is;
const intrinsicArrayIsArray = Array.isArray;
const intrinsicArrayJoin = Array.prototype.join;
const intrinsicArraySort = Array.prototype.sort;
const intrinsicSetAdd = Set.prototype.add;
const intrinsicSetDelete = Set.prototype.delete;
const intrinsicSetHas = Set.prototype.has;
const intrinsicMapGet = Map.prototype.get;
const intrinsicMapHas = Map.prototype.has;
const intrinsicMapSet = Map.prototype.set;
const intrinsicJsonParse = JSON.parse;
const intrinsicJsonStringify = JSON.stringify;
const intrinsicRegExpExec = RegExp.prototype.exec;
const intrinsicStringCharCodeAt = String.prototype.charCodeAt;
const intrinsicStringIncludes = String.prototype.includes;
const intrinsicStringSlice = String.prototype.slice;
const intrinsicStringStartsWith = String.prototype.startsWith;
const intrinsicNumberToString = Number.prototype.toString;
const intrinsicTextDecoderDecode = TextDecoder.prototype.decode;
const intrinsicMathMax = Math.max;
const intrinsicMathMin = Math.min;
const intrinsicNumberIsSafeInteger = Number.isSafeInteger;
const IntrinsicBigInt = BigInt;
const IntrinsicNumber = Number;
const IntrinsicString = String;
const IntrinsicSet = Set;
const IntrinsicMap = Map;
const intrinsicObjectPrototype = Object.prototype;
const intrinsicArrayPrototype = Array.prototype;
const intrinsicMaximumSafeInteger = Number.MAX_SAFE_INTEGER;
const DIGEST_SEPARATOR = new IntrinsicUint8Array(1);
const PRINTABLE_ASCII_PATTERN = /^[\x21-\x7e]+$/u;

function intrinsicRegexMatches(pattern, value) {
  // RegExp.prototype.test performs a live lookup of this.exec. Calling the
  // captured intrinsic exec directly prevents post-import prototype mutation
  // from changing Policy parsing, validation, or digest semantics.
  return intrinsicReflectApply(intrinsicRegExpExec, pattern, [value]) !== null;
}

function typedByteLength(value) {
  return intrinsicReflectApply(typedArrayByteLengthGetter, value, []);
}

function entriesForEach(entries, callback) {
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    callback(entry[0], entry[1]);
  }
}

function immutableDetails(details) {
  const copy = intrinsicObjectCreate(null);
  entriesForEach(intrinsicObjectEntries(details ?? {}), (name, value) => {
    copy[name] = value;
  });
  return intrinsicObjectFreeze(copy);
}

export class MemoryOSPolicyError extends Error {
  constructor(code, message, details = {}) {
    if (!intrinsicReflectApply(intrinsicSetHas, POLICY_FAILURE_CODE_SET, [code])) {
      throw new TypeError(`Unknown MemoryOS Policy failure code: ${IntrinsicString(code)}`);
    }
    super(IntrinsicString(message));
    this.name = "MemoryOSPolicyError";
    this.code = code;
    this.details = immutableDetails(details);
    entriesForEach(intrinsicObjectEntries(this.details), (name, value) => {
      if (!(name in this)) intrinsicObjectDefineProperty(this, name, { enumerable: true, value });
    });
    intrinsicObjectFreeze(this);
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
    intrinsicObjectFreeze(this);
  }
}

function isSharedArrayBuffer(value) {
  if (sharedArrayBufferByteLengthGetter === undefined) return false;
  try {
    intrinsicReflectApply(sharedArrayBufferByteLengthGetter, value, []);
    return true;
  } catch {
    return false;
  }
}

function arrayBufferByteLength(value) {
  try {
    return intrinsicReflectApply(arrayBufferByteLengthGetter, value, []);
  } catch {
    return undefined;
  }
}

function inspectView(value) {
  try {
    return {
      byteLength: intrinsicReflectApply(typedArrayByteLengthGetter, value, []),
      byteOffset: intrinsicReflectApply(typedArrayByteOffsetGetter, value, []),
      storage: intrinsicReflectApply(typedArrayBufferGetter, value, []),
    };
  } catch {
    return {
      byteLength: intrinsicReflectApply(dataViewByteLengthGetter, value, []),
      byteOffset: intrinsicReflectApply(dataViewByteOffsetGetter, value, []),
      storage: intrinsicReflectApply(dataViewBufferGetter, value, []),
    };
  }
}

export function inspectByteInput(value, label = "Byte input") {
  let byteLength;
  let byteOffset = 0;
  let storage;
  if (intrinsicReflectApply(arrayBufferIsView, ArrayBuffer, [value])) {
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
  return intrinsicObjectFreeze({
    byteLength,
    snapshot() {
      const source = new IntrinsicUint8Array(storage, byteOffset, byteLength);
      const result = new IntrinsicUint8Array(byteLength);
      intrinsicReflectApply(uint8ArraySet, result, [source, 0]);
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
    const code = intrinsicReflectApply(intrinsicStringCharCodeAt, value, [index]);
    if (code >= 0xd800 && code <= 0xdbff) {
      if (index + 1 >= value.length) return false;
      const following = intrinsicReflectApply(intrinsicStringCharCodeAt, value, [index + 1]);
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
  for (let index = 0; index < intrinsicMathMin(left.length, right.length); index += 1) {
    const difference = intrinsicReflectApply(intrinsicStringCharCodeAt, left, [index])
      - intrinsicReflectApply(intrinsicStringCharCodeAt, right, [index]);
    if (difference !== 0) return difference;
  }
  return left.length - right.length;
}

export function isStableSemVer(value) {
  return typeof value === "string"
    && intrinsicRegexMatches(STABLE_SEMVER_PATTERN, value);
}

export function isDottedIdentifier(value) {
  return typeof value === "string"
    && intrinsicRegexMatches(DOTTED_IDENTIFIER_PATTERN, value);
}

function parseIntegerToken(token) {
  if (!intrinsicRegexMatches(INTEGER_PATTERN, token) || token === "-0") {
    throw new RestrictedJsonError("JSON number is not a permitted restricted safe integer.");
  }
  let exact;
  try {
    exact = IntrinsicBigInt(token);
  } catch {
    throw new RestrictedJsonError("JSON integer is invalid.");
  }
  if (exact < IntrinsicBigInt(RESTRICTED_JSON_SAFE_INTEGER_MIN)
      || exact > IntrinsicBigInt(RESTRICTED_JSON_SAFE_INTEGER_MAX)) {
    throw new RestrictedJsonError("JSON integer is outside the restricted safe-integer range.");
  }
  return IntrinsicNumber(exact);
}

function decodeRestrictedUtf8(bytes) {
  if (typedByteLength(bytes) >= 3
      && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    throw new RestrictedJsonError("A UTF-8 BOM is prohibited.");
  }
  let source;
  try {
    source = intrinsicReflectApply(intrinsicTextDecoderDecode, textDecoder, [bytes]);
  } catch {
    throw new RestrictedJsonError("Input is not valid UTF-8.");
  }
  if (!isUnicodeScalarString(source)) {
    throw new RestrictedJsonError("Input contains a lone Unicode surrogate.");
  }
  return source;
}

function normalizeParserLimit(value, label) {
  if (value === undefined) return intrinsicMaximumSafeInteger;
  if (!intrinsicNumberIsSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer.`);
  }
  return value;
}

function parseRestrictedJsonInternal(bytesLike, limits = {}, deferResourceLimits = false) {
  if (limits === null || typeof limits !== "object" || intrinsicArrayIsArray(limits)) {
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
    const saturated = configuredLimit === intrinsicMaximumSafeInteger
      ? value
      : intrinsicMathMin(value, configuredLimit + 1);
    observed[metric] = intrinsicMathMax(observed[metric], saturated);
    if (value > configuredLimit) {
      resourceLimitExceeded = true;
      if (deferResourceLimits) return;
      throw new RestrictedJsonResourceLimitError(metric, configuredLimit);
    }
  };

  const recordString = (value) => {
    recordMetric(
      "maximumStringUtf8Bytes",
      typedByteLength(utf8Encode(value)),
      maximumStringUtf8Bytes,
    );
    return value;
  };

  const skipWhitespace = () => {
    while (offset < source.length
      && intrinsicReflectApply(intrinsicSetHas, JSON_WHITESPACE, [
        intrinsicReflectApply(intrinsicStringCharCodeAt, source, [offset]),
      ])) offset += 1;
  };

  const fail = (message) => {
    throw new RestrictedJsonError(`${message} at UTF-16 offset ${offset}.`);
  };

  const parseString = () => {
    if (intrinsicReflectApply(intrinsicStringCharCodeAt, source, [offset]) !== 0x22) fail("Expected JSON string");
    const start = offset;
    offset += 1;
    while (offset < source.length) {
      const code = intrinsicReflectApply(intrinsicStringCharCodeAt, source, [offset]);
      if (code === 0x22) {
        offset += 1;
        let result;
        try {
          result = intrinsicJsonParse(intrinsicReflectApply(intrinsicStringSlice, source, [start, offset]));
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
        if (!intrinsicReflectApply(intrinsicStringIncludes, '"\\/bfnrtu', [escape])) fail("JSON string contains an invalid escape");
        if (escape === "u") {
          const digits = intrinsicReflectApply(intrinsicStringSlice, source, [offset + 1, offset + 5]);
          if (!intrinsicRegexMatches(/^[0-9A-Fa-f]{4}$/u, digits)) fail("JSON string contains an invalid Unicode escape");
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
        if (!resourceLimitExceeded) {
          intrinsicObjectDefineProperty(result, result.length, {
            configurable: true,
            enumerable: true,
            value: child,
            writable: true,
          });
        }
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
      const result = resourceLimitExceeded ? undefined : intrinsicObjectCreate(null);
      const decodedNames = new IntrinsicSet();
      skipWhitespace();
      if (source[offset] === "}") {
        offset += 1;
        return resourceLimitExceeded ? omitted : result;
      }
      while (true) {
        skipWhitespace();
        const memberName = parseString();
        if (intrinsicReflectApply(intrinsicSetHas, decodedNames, [memberName])) fail("Duplicate decoded object member");
        intrinsicReflectApply(intrinsicSetAdd, decodedNames, [memberName]);
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

    if (intrinsicReflectApply(intrinsicStringStartsWith, source, ["true", offset])) {
      offset += 4;
      return resourceLimitExceeded ? omitted : true;
    }
    if (intrinsicReflectApply(intrinsicStringStartsWith, source, ["false", offset])) {
      offset += 5;
      return resourceLimitExceeded ? omitted : false;
    }
    if (intrinsicReflectApply(intrinsicStringStartsWith, source, ["null", offset])) {
      offset += 4;
      return resourceLimitExceeded ? omitted : null;
    }

    const numeric = intrinsicReflectApply(
      intrinsicRegExpExec,
      /^-?(?:0|[1-9][0-9]*)/u,
      [intrinsicReflectApply(intrinsicStringSlice, source, [offset])],
    );
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
  return intrinsicObjectFreeze({
    census: intrinsicObjectFreeze({
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
  if (value === null || typeof value !== "object" || intrinsicArrayIsArray(value)) return false;
  const prototype = intrinsicObjectGetPrototypeOf(value);
  return prototype === null || prototype === intrinsicObjectPrototype;
}

function assertDataDescriptor(descriptor) {
  if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
    throw new TypeError("Canonical JSON values may contain only enumerable data properties.");
  }
}

function canonicalText(value, ancestors = new IntrinsicSet()) {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") {
    if (!intrinsicNumberIsSafeInteger(value) || intrinsicObjectIs(value, -0)) {
      throw new TypeError("Canonical JSON numbers must be restricted safe integers.");
    }
    return intrinsicReflectApply(intrinsicNumberToString, value, []);
  }
  if (typeof value === "string") {
    requireScalarString(value, "Canonical JSON string");
    return intrinsicJsonStringify(value);
  }
  if (typeof value !== "object") {
    throw new TypeError("Value contains a non-JSON value category.");
  }
  if (intrinsicReflectApply(intrinsicSetHas, ancestors, [value])) throw new TypeError("Canonical JSON values must be acyclic.");
  intrinsicReflectApply(intrinsicSetAdd, ancestors, [value]);
  try {
    if (intrinsicArrayIsArray(value)) {
      if (intrinsicObjectGetPrototypeOf(value) !== intrinsicArrayPrototype) {
        throw new TypeError("Canonical arrays must use the intrinsic Array prototype.");
      }
      const ownKeys = intrinsicReflectOwnKeys(value);
      let containsSymbol = false;
      for (let index = 0; index < ownKeys.length; index += 1) {
        if (typeof ownKeys[index] === "symbol") containsSymbol = true;
      }
      if (containsSymbol || ownKeys.length !== value.length + 1) {
        throw new TypeError("Canonical arrays must be dense and have no custom properties.");
      }
      const items = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = intrinsicObjectGetOwnPropertyDescriptor(value, IntrinsicString(index));
        assertDataDescriptor(descriptor);
        items[items.length] = canonicalText(descriptor.value, ancestors);
      }
      return `[${intrinsicReflectApply(intrinsicArrayJoin, items, [","])}]`;
    }
    if (!isJsonObject(value)) {
      throw new TypeError("Canonical JSON objects must have an Object or null prototype.");
    }
    if (intrinsicObjectGetOwnPropertySymbols(value).length !== 0) {
      throw new TypeError("Canonical JSON objects cannot contain symbol properties.");
    }
    const names = intrinsicObjectGetOwnPropertyNames(value);
    for (let index = 0; index < names.length; index += 1) {
      requireScalarString(names[index], "Canonical JSON member name");
    }
    intrinsicReflectApply(intrinsicArraySort, names, [utf16Compare]);
    const members = [];
    for (let index = 0; index < names.length; index += 1) {
      const name = names[index];
      const descriptor = intrinsicObjectGetOwnPropertyDescriptor(value, name);
      assertDataDescriptor(descriptor);
      members[index] = `${intrinsicJsonStringify(name)}:${canonicalText(descriptor.value, ancestors)}`;
    }
    return `{${intrinsicReflectApply(intrinsicArrayJoin, members, [","])}}`;
  } finally {
    intrinsicReflectApply(intrinsicSetDelete, ancestors, [value]);
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
      result.maximumStringUtf8Bytes = intrinsicMathMax(
        result.maximumStringUtf8Bytes,
        typedByteLength(utf8Encode(current)),
      );
      return;
    }
    if (intrinsicArrayIsArray(current)) {
      const depth = openContainers + 1;
      result.maximumDepth = intrinsicMathMax(result.maximumDepth, depth);
      for (let index = 0; index < current.length; index += 1) visit(current[index], depth);
      return;
    }
    if (isJsonObject(current)) {
      const depth = openContainers + 1;
      result.maximumDepth = intrinsicMathMax(result.maximumDepth, depth);
      const entries = intrinsicObjectEntries(current);
      for (let index = 0; index < entries.length; index += 1) {
        const entry = entries[index];
        const name = entry[0];
        const item = entry[1];
        requireScalarString(name, "JSON member name");
        result.maximumStringUtf8Bytes = intrinsicMathMax(
          result.maximumStringUtf8Bytes,
          typedByteLength(utf8Encode(name)),
        );
        visit(item, depth);
      }
    }
  };
  visit(value, 0);
  return intrinsicObjectFreeze(result);
}

export function validateRegisteredOrderedStringSet(value, registeredOrder) {
  if (!intrinsicArrayIsArray(value) || !intrinsicArrayIsArray(registeredOrder) || value.length === 0) return false;
  const positions = new IntrinsicMap();
  for (let index = 0; index < registeredOrder.length; index += 1) {
    intrinsicReflectApply(intrinsicMapSet, positions, [registeredOrder[index], index]);
  }
  const seen = new IntrinsicSet();
  let previous = -1;
  for (let index = 0; index < value.length; index += 1) {
    const member = value[index];
    if (!isUnicodeScalarString(member)
        || intrinsicReflectApply(intrinsicSetHas, seen, [member])
        || !intrinsicReflectApply(intrinsicMapHas, positions, [member])) return false;
    const position = intrinsicReflectApply(intrinsicMapGet, positions, [member]);
    if (position <= previous) return false;
    intrinsicReflectApply(intrinsicSetAdd, seen, [member]);
    previous = position;
  }
  return true;
}

function concatenate(parts) {
  let length = 0;
  for (let index = 0; index < parts.length; index += 1) {
    length += typedByteLength(parts[index]);
  }
  if (!intrinsicNumberIsSafeInteger(length)) throw new RangeError("Digest input is too large.");
  const result = new IntrinsicUint8Array(length);
  let offset = 0;
  for (let index = 0; index < parts.length; index += 1) {
    const part = parts[index];
    intrinsicReflectApply(uint8ArraySet, result, [part, offset]);
    offset += typedByteLength(part);
  }
  return result;
}

export function domainSeparatedDigest(domain, canonicalBytesLike) {
  requireScalarString(domain, "Digest domain", false);
  if (!intrinsicRegexMatches(PRINTABLE_ASCII_PATTERN, domain)) {
    throw new TypeError("Digest domain must be non-empty printable ASCII without NUL.");
  }
  const domainBytes = utf8Encode(domain);
  const canonicalBytes = toUint8Array(canonicalBytesLike, "Canonical digest input");
  return `sha256:${sha256Hex(concatenate([domainBytes, DIGEST_SEPARATOR, canonicalBytes]))}`;
}
