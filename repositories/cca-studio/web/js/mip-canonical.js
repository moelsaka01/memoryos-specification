const UTF8_BOM = Object.freeze([0xef, 0xbb, 0xbf]);
const NUL = new Uint8Array([0]);
const SHA256_INITIAL = Object.freeze([
  0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
  0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
]);
const SHA256_ROUND = Object.freeze([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5,
  0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
  0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc,
  0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7,
  0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
  0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3,
  0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5,
  0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
  0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

export class MipCanonicalError extends Error {
  constructor(code, message, { path = "$", offset = null, text = null, cause = undefined } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = "MipCanonicalError";
    this.code = code;
    this.path = path;
    this.offset = offset;
    this.line = null;
    this.column = null;
    if (text !== null && offset !== null) {
      const prefix = text.slice(0, offset);
      const lines = prefix.split("\n");
      this.line = lines.length;
      this.column = lines[lines.length - 1].length + 1;
    }
  }
}

function canonicalError(code, message, path = "$") {
  return new MipCanonicalError(code, message, { path });
}

function requireValidUnicode(value, path = "$") {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const next = value.charCodeAt(index + 1);
      if (!(next >= 0xdc00 && next <= 0xdfff)) {
        throw canonicalError("INVALID_UNICODE", "A high surrogate must be followed by a low surrogate.", path);
      }
      index += 1;
    } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      throw canonicalError("INVALID_UNICODE", "A low surrogate must follow a high surrogate.", path);
    }
  }
  return value;
}

export function utf8Encode(text) {
  if (typeof text !== "string") {
    throw new TypeError("UTF-8 input must be a string.");
  }
  requireValidUnicode(text);
  return new TextEncoder().encode(text);
}

export function decodeUtf8(bytes) {
  const input = toUint8Array(bytes, "UTF-8 input");
  if (input.length >= UTF8_BOM.length
      && UTF8_BOM.every((byte, index) => input[index] === byte)) {
    throw canonicalError("INVALID_UTF8_BOM", "MIP canonical bytes must not contain a UTF-8 byte-order mark.");
  }
  try {
    const decoded = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(input);
    return requireValidUnicode(decoded);
  } catch (error) {
    if (error instanceof MipCanonicalError) throw error;
    throw new MipCanonicalError("INVALID_UTF8", "Input is not valid UTF-8.", { cause: error });
  }
}

function childPath(path, member) {
  return `${path}[${JSON.stringify(member)}]`;
}

class StrictJsonParser {
  constructor(text, limits = {}) {
    if (typeof text !== "string") throw new TypeError("JSON input must be a string.");
    this.text = text;
    this.index = 0;
    this.maxDepth = limits.maxDepth ?? Number.MAX_SAFE_INTEGER;
    this.maxValues = limits.maxValues ?? Number.MAX_SAFE_INTEGER;
    this.valueCount = 0;
  }

  error(code, message, path = "$", offset = this.index) {
    throw new MipCanonicalError(code, message, {
      path,
      offset,
      text: this.text,
    });
  }

  skipWhitespace() {
    while (this.index < this.text.length) {
      const char = this.text.charCodeAt(this.index);
      if (char !== 0x20 && char !== 0x09 && char !== 0x0a && char !== 0x0d) break;
      this.index += 1;
    }
  }

  parse() {
    this.skipWhitespace();
    if (this.index === this.text.length) this.error("INVALID_JSON", "A JSON value is required.");
    const value = this.parseValue("$", 1);
    this.skipWhitespace();
    if (this.index !== this.text.length) {
      this.error("INVALID_JSON", "Unexpected content follows the JSON value.");
    }
    return value;
  }

  parseValue(path, depth) {
    this.valueCount += 1;
    if (depth > this.maxDepth || this.valueCount > this.maxValues) {
      this.error("RESOURCE_LIMIT_EXCEEDED", "JSON input exceeds the configured structural resource policy.", path);
    }
    this.skipWhitespace();
    const char = this.text[this.index];
    if (char === "{") return this.parseObject(path, depth);
    if (char === "[") return this.parseArray(path, depth);
    if (char === "\"") return this.parseString(path);
    if (char === "t") return this.parseLiteral("true", true, path);
    if (char === "f") return this.parseLiteral("false", false, path);
    if (char === "n") return this.parseLiteral("null", null, path);
    if (char === "-" || (char >= "0" && char <= "9")) return this.parseNumber(path);
    this.error("INVALID_JSON", "Expected a JSON value.", path);
  }

  parseLiteral(token, value, path) {
    if (this.text.slice(this.index, this.index + token.length) !== token) {
      this.error("INVALID_JSON", `Expected ${token}.`, path);
    }
    this.index += token.length;
    return value;
  }

  parseObject(path, depth) {
    this.index += 1;
    const value = {};
    const names = new Set();
    this.skipWhitespace();
    if (this.text[this.index] === "}") {
      this.index += 1;
      return value;
    }

    while (this.index < this.text.length) {
      this.skipWhitespace();
      if (this.text[this.index] !== "\"") {
        this.error("INVALID_JSON", "Object member names must be JSON strings.", path);
      }
      const nameOffset = this.index;
      const name = this.parseString(path);
      const memberPath = childPath(path, name);
      if (names.has(name)) {
        this.error("DUPLICATE_MEMBER", `Duplicate object member ${JSON.stringify(name)}.`, memberPath, nameOffset);
      }
      names.add(name);
      this.skipWhitespace();
      if (this.text[this.index] !== ":") {
        this.error("INVALID_JSON", "Expected ':' after an object member name.", memberPath);
      }
      this.index += 1;
      const memberValue = this.parseValue(memberPath, depth + 1);
      Object.defineProperty(value, name, {
        value: memberValue,
        enumerable: true,
        configurable: true,
        writable: true,
      });
      this.skipWhitespace();
      const delimiter = this.text[this.index];
      if (delimiter === "}") {
        this.index += 1;
        return value;
      }
      if (delimiter !== ",") {
        this.error("INVALID_JSON", "Expected ',' or '}' after an object member.", path);
      }
      this.index += 1;
      this.skipWhitespace();
      if (this.text[this.index] === "}") {
        this.error("INVALID_JSON", "Trailing commas are not valid JSON.", path);
      }
    }
    this.error("INVALID_JSON", "Unterminated JSON object.", path);
  }

  parseArray(path, depth) {
    this.index += 1;
    const value = [];
    this.skipWhitespace();
    if (this.text[this.index] === "]") {
      this.index += 1;
      return value;
    }

    let itemIndex = 0;
    while (this.index < this.text.length) {
      value.push(this.parseValue(`${path}[${itemIndex}]`, depth + 1));
      itemIndex += 1;
      this.skipWhitespace();
      const delimiter = this.text[this.index];
      if (delimiter === "]") {
        this.index += 1;
        return value;
      }
      if (delimiter !== ",") {
        this.error("INVALID_JSON", "Expected ',' or ']' after an array item.", path);
      }
      this.index += 1;
      this.skipWhitespace();
      if (this.text[this.index] === "]") {
        this.error("INVALID_JSON", "Trailing commas are not valid JSON.", path);
      }
    }
    this.error("INVALID_JSON", "Unterminated JSON array.", path);
  }

  parseString(path) {
    this.index += 1;
    let value = "";
    while (this.index < this.text.length) {
      const char = this.text[this.index];
      const codeUnit = this.text.charCodeAt(this.index);
      if (char === "\"") {
        this.index += 1;
        try {
          return requireValidUnicode(value, path);
        } catch (error) {
          if (error instanceof MipCanonicalError) {
            error.offset = this.index - 1;
            const prefix = this.text.slice(0, error.offset);
            const lines = prefix.split("\n");
            error.line = lines.length;
            error.column = lines[lines.length - 1].length + 1;
          }
          throw error;
        }
      }
      if (codeUnit < 0x20) {
        this.error("INVALID_JSON", "Unescaped control character in JSON string.", path);
      }
      if (char !== "\\") {
        value += char;
        this.index += 1;
        continue;
      }

      this.index += 1;
      if (this.index >= this.text.length) this.error("INVALID_JSON", "Unterminated JSON escape.", path);
      const escape = this.text[this.index];
      const simple = {
        "\"": "\"",
        "\\": "\\",
        "/": "/",
        b: "\b",
        f: "\f",
        n: "\n",
        r: "\r",
        t: "\t",
      };
      if (Object.hasOwn(simple, escape)) {
        value += simple[escape];
        this.index += 1;
        continue;
      }
      if (escape !== "u") this.error("INVALID_JSON", "Invalid JSON string escape.", path);
      const hex = this.text.slice(this.index + 1, this.index + 5);
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
        this.error("INVALID_JSON", "A Unicode escape requires four hexadecimal digits.", path);
      }
      value += String.fromCharCode(Number.parseInt(hex, 16));
      this.index += 5;
    }
    this.error("INVALID_JSON", "Unterminated JSON string.", path);
  }

  parseNumber(path) {
    const start = this.index;
    if (this.text[this.index] === "-") this.index += 1;
    if (this.text[this.index] === "0") {
      this.index += 1;
      if (this.text[this.index] >= "0" && this.text[this.index] <= "9") {
        this.error("INVALID_NUMBER", "Leading zeroes are not valid in JSON numbers.", path, start);
      }
    } else {
      const first = this.text[this.index];
      if (!(first >= "1" && first <= "9")) {
        this.error("INVALID_NUMBER", "A JSON number requires an integer component.", path, start);
      }
      while (this.text[this.index] >= "0" && this.text[this.index] <= "9") this.index += 1;
    }
    if (this.text[this.index] === ".") {
      this.index += 1;
      const fractionStart = this.index;
      while (this.text[this.index] >= "0" && this.text[this.index] <= "9") this.index += 1;
      if (this.index === fractionStart) {
        this.error("INVALID_NUMBER", "A decimal point requires a fractional component.", path, start);
      }
    }
    if (this.text[this.index] === "e" || this.text[this.index] === "E") {
      this.index += 1;
      if (this.text[this.index] === "+" || this.text[this.index] === "-") this.index += 1;
      const exponentStart = this.index;
      while (this.text[this.index] >= "0" && this.text[this.index] <= "9") this.index += 1;
      if (this.index === exponentStart) {
        this.error("INVALID_NUMBER", "An exponent requires at least one digit.", path, start);
      }
    }

    const number = Number(this.text.slice(start, this.index));
    if (!Number.isFinite(number)) {
      this.error("INVALID_NUMBER", "MIP numbers must be finite.", path, start);
    }
    if (Object.is(number, -0)) {
      this.error("INVALID_NUMBER", "Negative zero is not a valid MIP number.", path, start);
    }
    if (Number.isInteger(number) && !Number.isSafeInteger(number)) {
      this.error("INVALID_NUMBER", "MIP integer numbers must be within the interoperable safe-integer range.", path, start);
    }
    return number;
  }
}

export function parseStrictJson(text, limits = {}) {
  requireValidUnicode(text);
  return new StrictJsonParser(text, limits).parse();
}

function assertCanonicalNumber(value, path) {
  if (!Number.isFinite(value)) {
    throw canonicalError("INVALID_NUMBER", "MIP numbers must be finite.", path);
  }
  if (Object.is(value, -0)) {
    throw canonicalError("INVALID_NUMBER", "Negative zero is not a valid MIP number.", path);
  }
  if (Number.isInteger(value) && !Number.isSafeInteger(value)) {
    throw canonicalError("INVALID_NUMBER", "MIP integer numbers must be within the interoperable safe-integer range.", path);
  }
}

function assertDataDescriptor(descriptor, path) {
  if (!descriptor || !("value" in descriptor) || !descriptor.enumerable) {
    throw canonicalError("INVALID_JSON_VALUE", "Canonical JSON values may contain only enumerable data properties.", path);
  }
}

function serializeCanonical(value, path, ancestors) {
  if (value === null) return "null";
  if (typeof value === "string") {
    requireValidUnicode(value, path);
    return JSON.stringify(value);
  }
  if (typeof value === "number") {
    assertCanonicalNumber(value, path);
    return JSON.stringify(value);
  }
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value !== "object") {
    throw canonicalError("INVALID_JSON_VALUE", `Unsupported JSON value type ${typeof value}.`, path);
  }
  if (ancestors.has(value)) {
    throw canonicalError("CYCLIC_VALUE", "Canonical JSON values must be acyclic.", path);
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (Object.getPrototypeOf(value) !== Array.prototype) {
        throw canonicalError("INVALID_JSON_VALUE", "Array subclasses are not canonical JSON values.", path);
      }
      const ownKeys = Reflect.ownKeys(value);
      if (ownKeys.some((key) => typeof key === "symbol") || ownKeys.length !== value.length + 1) {
        throw canonicalError("INVALID_JSON_VALUE", "Canonical arrays must be dense and have no custom properties.", path);
      }
      const items = [];
      for (let index = 0; index < value.length; index += 1) {
        const itemPath = `${path}[${index}]`;
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        assertDataDescriptor(descriptor, itemPath);
        items.push(serializeCanonical(descriptor.value, itemPath, ancestors));
      }
      return `[${items.join(",")}]`;
    }

    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw canonicalError("INVALID_JSON_VALUE", "Canonical JSON objects must have an Object or null prototype.", path);
    }
    if (Object.getOwnPropertySymbols(value).length !== 0) {
      throw canonicalError("INVALID_JSON_VALUE", "Canonical JSON objects cannot contain symbol properties.", path);
    }
    const names = Object.getOwnPropertyNames(value);
    names.forEach((name) => requireValidUnicode(name, childPath(path, name)));
    names.sort();
    const members = names.map((name) => {
      const memberPath = childPath(path, name);
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      assertDataDescriptor(descriptor, memberPath);
      return `${JSON.stringify(name)}:${serializeCanonical(descriptor.value, memberPath, ancestors)}`;
    });
    return `{${members.join(",")}}`;
  } finally {
    ancestors.delete(value);
  }
}

export function canonicalize(value) {
  return serializeCanonical(value, "$", new Set());
}

function toUint8Array(value, label = "Byte input") {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  throw new TypeError(`${label} must be a string, ArrayBuffer, or typed-array view.`);
}

function rotateRight(value, count) {
  return ((value >>> count) | (value << (32 - count))) >>> 0;
}

export function sha256Hex(bytesOrString) {
  const input = typeof bytesOrString === "string" ? utf8Encode(bytesOrString) : toUint8Array(bytesOrString);
  const paddedLength = Math.ceil((input.length + 9) / 64) * 64;
  if (!Number.isSafeInteger(paddedLength)) throw new RangeError("SHA-256 input is too large.");
  const padded = new Uint8Array(paddedLength);
  padded.set(input);
  padded[input.length] = 0x80;
  const bitLength = BigInt(input.length) * 8n;
  const view = new DataView(padded.buffer);
  view.setUint32(paddedLength - 8, Number((bitLength >> 32n) & 0xffffffffn), false);
  view.setUint32(paddedLength - 4, Number(bitLength & 0xffffffffn), false);

  const hash = SHA256_INITIAL.slice();
  const words = new Uint32Array(64);
  for (let offset = 0; offset < padded.length; offset += 64) {
    for (let index = 0; index < 16; index += 1) {
      words[index] = view.getUint32(offset + (index * 4), false);
    }
    for (let index = 16; index < 64; index += 1) {
      const s0 = rotateRight(words[index - 15], 7)
        ^ rotateRight(words[index - 15], 18)
        ^ (words[index - 15] >>> 3);
      const s1 = rotateRight(words[index - 2], 17)
        ^ rotateRight(words[index - 2], 19)
        ^ (words[index - 2] >>> 10);
      words[index] = (words[index - 16] + s0 + words[index - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, h] = hash;
    for (let index = 0; index < 64; index += 1) {
      const sigma1 = rotateRight(e, 6) ^ rotateRight(e, 11) ^ rotateRight(e, 25);
      const choice = (e & f) ^ (~e & g);
      const temporary1 = (h + sigma1 + choice + SHA256_ROUND[index] + words[index]) >>> 0;
      const sigma0 = rotateRight(a, 2) ^ rotateRight(a, 13) ^ rotateRight(a, 22);
      const majority = (a & b) ^ (a & c) ^ (b & c);
      const temporary2 = (sigma0 + majority) >>> 0;
      h = g;
      g = f;
      f = e;
      e = (d + temporary1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temporary1 + temporary2) >>> 0;
    }
    hash[0] = (hash[0] + a) >>> 0;
    hash[1] = (hash[1] + b) >>> 0;
    hash[2] = (hash[2] + c) >>> 0;
    hash[3] = (hash[3] + d) >>> 0;
    hash[4] = (hash[4] + e) >>> 0;
    hash[5] = (hash[5] + f) >>> 0;
    hash[6] = (hash[6] + g) >>> 0;
    hash[7] = (hash[7] + h) >>> 0;
  }
  return hash.map((word) => word.toString(16).padStart(8, "0")).join("");
}

function concatenate(parts) {
  const length = parts.reduce((sum, part) => sum + part.length, 0);
  if (!Number.isSafeInteger(length)) throw new RangeError("Digest input is too large.");
  const result = new Uint8Array(length);
  let offset = 0;
  parts.forEach((part) => {
    result.set(part, offset);
    offset += part.length;
  });
  return result;
}

export function mipDigest(domain, ...parts) {
  if (typeof domain !== "string" || domain.length === 0) {
    throw new TypeError("A non-empty MIP digest domain is required.");
  }
  const encoded = [utf8Encode("MIP-1"), NUL, utf8Encode(domain)];
  parts.forEach((part) => {
    encoded.push(NUL);
    encoded.push(typeof part === "string" ? utf8Encode(part) : toUint8Array(part, "Digest part"));
  });
  return `sha256:${sha256Hex(concatenate(encoded))}`;
}

export function cloneCanonical(value) {
  return parseStrictJson(canonicalize(value));
}

export function deepFreeze(value, seen = new Set()) {
  if (value === null || typeof value !== "object" || seen.has(value)) return value;
  seen.add(value);
  Reflect.ownKeys(value).forEach((key) => deepFreeze(value[key], seen));
  return Object.freeze(value);
}
