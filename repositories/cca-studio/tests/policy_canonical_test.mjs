import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { runInNewContext } from "node:vm";

import {
  MemoryOSPolicyError,
  POLICY_FAILURE_CODES,
  RESTRICTED_JSON_SAFE_INTEGER_MAX,
  RESTRICTED_JSON_SAFE_INTEGER_MIN,
  RestrictedJsonError,
  canonicalizeRestrictedJson,
  canonicalizeRestrictedJsonText,
  domainSeparatedDigest,
  isDottedIdentifier,
  isStableSemVer,
  jsonCensus,
  parseRestrictedJson,
  parseRestrictedJsonWithCensus,
  toUint8Array,
  utf16Compare,
  utf8Encode,
  validateRegisteredOrderedStringSet,
} from "../web/js/policy-canonical.js";

const bytes = (text) => new TextEncoder().encode(text);
const text = (value) => new TextDecoder().decode(value);

test("restricted JSON accepts strict UTF-8 scalar strings and preserves them", () => {
  const value = parseRestrictedJson(bytes('{"clef":"𝄞","word":"café"}'));
  assert.equal(value.clef, "𝄞");
  assert.equal(value.word, "café");
  assert.equal(text(canonicalizeRestrictedJson(value)), '{"clef":"𝄞","word":"café"}');
});

test("restricted JSON rejects malformed UTF-8 and a UTF-8 BOM", () => {
  assert.throws(() => parseRestrictedJson(Uint8Array.of(0xc3, 0x28)), RestrictedJsonError);
  assert.throws(
    () => parseRestrictedJson(Uint8Array.from([0xef, 0xbb, 0xbf, ...bytes("{}")])) ,
    RestrictedJsonError,
  );
});

test("restricted JSON rejects decoded duplicate names before construction", () => {
  assert.throws(() => parseRestrictedJson(bytes('{"a":1,"\\u0061":2}')), RestrictedJsonError);
  assert.throws(() => parseRestrictedJson(bytes('{"outer":{"x":1,"x":2}}')), RestrictedJsonError);
});

test("restricted JSON accepts only the four JSON whitespace bytes around one value", () => {
  assert.equal(canonicalizeRestrictedJsonText(parseRestrictedJson(bytes("\t\r\n { \"a\" : 1 } \n"))), '{"a":1}');
  assert.throws(() => parseRestrictedJson(bytes("{} {}")), RestrictedJsonError);
  assert.throws(() => parseRestrictedJson(bytes("{}x")), RestrictedJsonError);
  assert.throws(() => parseRestrictedJson(bytes("\u00a0{}")), RestrictedJsonError);
});

test("restricted JSON rejects escaped lone surrogates", () => {
  assert.throws(() => parseRestrictedJson(bytes('"\\ud800"')), RestrictedJsonError);
  assert.throws(() => parseRestrictedJson(bytes('"\\udc00"')), RestrictedJsonError);
  assert.equal(parseRestrictedJson(bytes('"\\ud834\\udd1e"')), "𝄞");
});

test("restricted JSON does not normalize Unicode", () => {
  const composed = parseRestrictedJson(bytes('"é"'));
  const decomposed = parseRestrictedJson(bytes('"é"'));
  assert.notEqual(composed, decomposed);
  assert.notDeepEqual(canonicalizeRestrictedJson(composed), canonicalizeRestrictedJson(decomposed));
});

test("restricted integer grammar accepts zero, negatives, and both safe endpoints", () => {
  assert.equal(parseRestrictedJson(bytes("0")), 0);
  assert.equal(parseRestrictedJson(bytes("-7")), -7);
  assert.equal(parseRestrictedJson(bytes(String(RESTRICTED_JSON_SAFE_INTEGER_MAX))), RESTRICTED_JSON_SAFE_INTEGER_MAX);
  assert.equal(parseRestrictedJson(bytes(String(RESTRICTED_JSON_SAFE_INTEGER_MIN))), RESTRICTED_JSON_SAFE_INTEGER_MIN);
});

test("restricted integer grammar rejects unsafe, negative-zero, fractional, and exponent forms", () => {
  for (const source of ["9007199254740992", "-9007199254740992", "-0", "1.0", "1e0", "1E+2", "01"]) {
    assert.throws(() => parseRestrictedJson(bytes(source)), RestrictedJsonError, source);
  }
});

test("canonical object ordering compares UTF-16 code units", () => {
  const supplementary = "𐀀";
  const bmp = "";
  assert.ok(utf16Compare(supplementary, bmp) < 0);
  assert.equal(canonicalizeRestrictedJsonText({ [bmp]: 2, [supplementary]: 1 }), `{"${supplementary}":1,"${bmp}":2}`);
});

test("canonical arrays retain sequence order and registered sets require registry order", () => {
  assert.equal(canonicalizeRestrictedJsonText([2, 1, 2]), "[2,1,2]");
  const registry = ["Created", "Observed", "Verified", "Archived"];
  assert.equal(validateRegisteredOrderedStringSet(["Created", "Verified"], registry), true);
  assert.equal(validateRegisteredOrderedStringSet(["Verified", "Created"], registry), false);
  assert.equal(validateRegisteredOrderedStringSet(["Created", "Created"], registry), false);
  assert.equal(validateRegisteredOrderedStringSet(["Created", "Unknown"], registry), false);
});

test("canonicalization rejects sparse, accessor, symbol, non-data, subclassed, and cyclic values", () => {
  assert.throws(() => canonicalizeRestrictedJson(Array(1)), TypeError);
  const accessor = {};
  Object.defineProperty(accessor, "a", { enumerable: true, get: () => 1 });
  assert.throws(() => canonicalizeRestrictedJson(accessor), TypeError);
  const symbol = { a: 1 };
  symbol[Symbol("hidden")] = 2;
  assert.throws(() => canonicalizeRestrictedJson(symbol), TypeError);
  const nonEnumerable = { a: 1 };
  Object.defineProperty(nonEnumerable, "hidden", { value: 2 });
  assert.throws(() => canonicalizeRestrictedJson(nonEnumerable), TypeError);
  class ArraySubclass extends Array {}
  assert.throws(() => canonicalizeRestrictedJson(new ArraySubclass(1)), TypeError);
  const cyclic = {};
  cyclic.self = cyclic;
  assert.throws(() => canonicalizeRestrictedJson(cyclic), TypeError);
});

test("canonical output is exact UTF-8 without BOM or trailing LF", () => {
  const canonical = canonicalizeRestrictedJson({ z: "é", a: true });
  assert.deepEqual(canonical, utf8Encode('{"a":true,"z":"é"}'));
  assert.notEqual(canonical[0], 0xef);
  assert.notEqual(canonical.at(-1), 0x0a);
});

test("JSON census uses value occurrences, open-container depth, and decoded string/name bytes", () => {
  assert.deepEqual(
    jsonCensus(parseRestrictedJson(bytes('{"é":["𝄞",true]}'))),
    { maximumDepth: 2, maximumStringUtf8Bytes: 4, valueCount: 4 },
  );
});

test("bounded parsing saturates counters, stops materializing, and still completes syntax", () => {
  const limits = { maximumDepth: 4, maximumStringUtf8Bytes: 128, maximumValueCount: 64 };
  const over = parseRestrictedJsonWithCensus(
    bytes(JSON.stringify({ a: [[[["x".repeat(200)]]]], b: Array.from({ length: 80 }, () => 0) })),
    limits,
  );
  assert.equal(over.resourceLimitExceeded, true);
  assert.equal(over.value, undefined);
  assert.deepEqual(over.census, {
    maximumDepth: 5,
    maximumStringUtf8Bytes: 129,
    valueCount: 65,
  });
  assert.throws(
    () => parseRestrictedJsonWithCensus(bytes(`[${"0,".repeat(80)}`), limits),
    RestrictedJsonError,
  );
});

test("domain-separated SHA-256 uses exactly domain, NUL, and canonical bytes", () => {
  const canonical = bytes('{"a":1}');
  const expected = `sha256:${createHash("sha256").update(Buffer.concat([
    Buffer.from("MEMORYOS-POLICY-TEST-1.0", "ascii"),
    Buffer.of(0),
    Buffer.from(canonical),
  ])).digest("hex")}`;
  const actual = domainSeparatedDigest("MEMORYOS-POLICY-TEST-1.0", canonical);
  assert.equal(actual, expected);
  assert.match(actual, /^sha256:[0-9a-f]{64}$/u);
  assert.equal(Buffer.byteLength(actual, "ascii"), 71);
  assert.notEqual(actual, domainSeparatedDigest("MEMORYOS-POLICY-TEST-2.0", canonical));
  assert.notEqual(actual, domainSeparatedDigest("MEMORYOS-POLICY-TEST-1.0", bytes('{"a":2}')));
  assert.throws(() => domainSeparatedDigest("mémoire", canonical), TypeError);
});

test("stable SemVer and dotted identifiers use their exact frozen grammars", () => {
  for (const version of ["0.0.0", "1.0.0", "10.20.30"]) assert.equal(isStableSemVer(version), true);
  for (const version of ["01.0.0", "1.0", "1.0.0-alpha", "1.0.0+build", "latest"]) assert.equal(isStableSemVer(version), false);
  for (const identifier of ["a", "a0", "memoryos.policy", "memoryos.require-mip-integrity"]) assert.equal(isDottedIdentifier(identifier), true);
  for (const identifier of ["A", "a_1", "a..b", "-a", "a/../b", "https://a"]) assert.equal(isDottedIdentifier(identifier), false);
});

test("stable machine errors preserve exact non-localized codes and immutable details", () => {
  assert.deepEqual(POLICY_FAILURE_CODES, [
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
  for (const code of POLICY_FAILURE_CODES) assert.match(code, /^[A-Z][A-Z0-9_]*$/u);
  assert.equal(new Set(POLICY_FAILURE_CODES).size, POLICY_FAILURE_CODES.length);
  const error = new MemoryOSPolicyError("POLICY_SCHEMA_INVALID", "diagnostic", { phase: "policyArtifact" });
  assert.equal(error.code, "POLICY_SCHEMA_INVALID");
  assert.equal(error.phase, "policyArtifact");
  assert.ok(Object.isFrozen(error.details));
  assert.throws(() => new MemoryOSPolicyError("policy_schema_invalid", "bad"), TypeError);
});

test("byte intake snapshots mutable buffers and rejects shared mutable storage", () => {
  const input = bytes('{"a":1}');
  const snapshot = toUint8Array(input);
  input.fill(0);
  assert.equal(text(snapshot), '{"a":1}');
  const parseInput = bytes('{"a":1}');
  const parsed = parseRestrictedJson(parseInput);
  parseInput.fill(0);
  assert.equal(parsed.a, 1);
  const speciesBuffer = new ArrayBuffer(2);
  new Uint8Array(speciesBuffer).set([1, 2]);
  Object.defineProperty(speciesBuffer, "constructor", {
    value: { [Symbol.species]: class extends ArrayBuffer { constructor() { super(5000); } } },
  });
  assert.deepEqual(toUint8Array(speciesBuffer), Uint8Array.of(1, 2));
  if (typeof SharedArrayBuffer === "function") {
    assert.throws(() => parseRestrictedJson(new Uint8Array(new SharedArrayBuffer(8))), TypeError);
    const foreignSharedView = runInNewContext("new Uint8Array(new SharedArrayBuffer(8))");
    assert.throws(() => toUint8Array(foreignSharedView), TypeError);
    const poisonedSharedBuffer = new SharedArrayBuffer(8);
    Object.defineProperty(poisonedSharedBuffer, "constructor", { get() { throw new Error("must not run"); } });
    assert.throws(() => toUint8Array(new Uint8Array(poisonedSharedBuffer)), TypeError);
  }
});
