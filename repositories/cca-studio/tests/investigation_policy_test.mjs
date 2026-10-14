import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import test from "node:test";

import { sha256Hex } from "../web/js/mip-canonical.js";

import {
  INVESTIGATION_POLICY_DIGEST_DOMAINS,
  INVESTIGATION_POLICY_KIND,
  INVESTIGATION_POLICY_SET_KIND,
  assertPreparedInvestigationPolicyArtifact,
  enforcePolicyJsonResourceLimits,
  isPreparedInvestigationPolicyArtifact,
  policySemanticProjection,
  preparedInvestigationPolicyArtifactEvaluationView,
  prepareInvestigationPolicy,
  prepareInvestigationPolicySet,
} from "../web/js/investigation-policy.js";
import {
  MEMORYOS_POLICY_RESOURCE_PROFILE,
  REGISTERED_LIFECYCLE_STATES,
  REGISTERED_REGRESSION_CATEGORIES,
} from "../web/js/investigation-policy-contracts.js";
import {
  MemoryOSPolicyError,
  canonicalizeRestrictedJson,
  canonicalizeRestrictedJsonText,
  domainSeparatedDigest,
  jsonCensus,
  parseRestrictedJson,
  utf8Encode,
} from "../web/js/policy-canonical.js";

const fixtureRoot = new URL("./fixtures/investigation-policy/1.0.0/", import.meta.url);
const readFixture = (relative) => readFile(new URL(relative, fixtureRoot));
const LIMITS = MEMORYOS_POLICY_RESOURCE_PROFILE.limits;

function rule(identifier = "a", type = "memoryos.require-mip-integrity", parameters = {}, version = "1.0.0") {
  return { identifier, parameters, type, version };
}

function policy(identifier = "a", rules = [rule()]) {
  return {
    identifier,
    kind: INVESTIGATION_POLICY_KIND,
    policyVersion: "0.0.0",
    rules,
    version: "1.0.0",
  };
}

function preparePolicyValue(value) {
  return prepareInvestigationPolicy(canonicalizeRestrictedJson(value));
}

function policySet(identifier, children) {
  return {
    identifier,
    kind: INVESTIGATION_POLICY_SET_KIND,
    policies: children.map((child) => ({
      expectedSemanticDigest: preparePolicyValue(child).semanticDigest,
      policy: child,
    })),
    policySetVersion: "0.0.0",
    version: "1.0.0",
  };
}

function assertCode(operation, code, limitIdentifier = undefined) {
  try {
    operation();
  } catch (error) {
    assert.ok(error instanceof MemoryOSPolicyError, String(error));
    assert.equal(error.code, code);
    if (limitIdentifier !== undefined) {
      assert.equal(error.limitIdentifier, limitIdentifier);
      assert.equal(error.configuredLimit, LIMITS[limitIdentifier]);
      assert.equal(error.observedAtLeast, LIMITS[limitIdentifier] + 1);
    }
    return error;
  }
  assert.fail(`Expected ${code}.`);
}

test("minimal frozen Policy fixture has exact canonical bytes and identities", async () => {
  const closure = JSON.parse(await readFixture("cache-validation-vectors.json"));
  const artifact = closure.authoritativeInput.artifact;
  const canonical = canonicalizeRestrictedJson(artifact);
  const prepared = prepareInvestigationPolicy(canonical);
  assert.equal(canonical.length, 200);
  assert.deepEqual(prepared.canonicalBytes(), canonical);
  assert.equal(prepared.documentDigest, "sha256:404824a78efb555cd62abd69f6448a9910d4f54c73ad2fb6830576f6528b1fd7");
  assert.equal(prepared.semanticDigest, "sha256:1ce5ef94974203130a465df33dc5c95ca9b6fad202bebd7bf50742e090a1190a");
  assert.equal(
    prepared.documentDigest,
    domainSeparatedDigest(INVESTIGATION_POLICY_DIGEST_DOMAINS.document, prepared.canonicalBytes()),
  );
  assert.equal(
    prepared.semanticDigest,
    domainSeparatedDigest(INVESTIGATION_POLICY_DIGEST_DOMAINS.semantic, prepared.semanticBytes()),
  );
  assert.deepEqual(prepared.semanticBytes(), canonicalizeRestrictedJson(policySemanticProjection(artifact)));
  assert.ok(Object.isFrozen(prepared));
  assert.ok(Object.isFrozen(prepared.artifact));
  const first = prepared.canonicalBytes();
  first[0] = 0;
  assert.deepEqual(prepared.canonicalBytes(), canonical);
});

test("prepared Policy authority is unforgeable and its evaluator view exposes only immutable data and byte copies", () => {
  const prepared = preparePolicyValue(policy("p", [rule("e")]));
  const view = preparedInvestigationPolicyArtifactEvaluationView(prepared);

  assert.equal(isPreparedInvestigationPolicyArtifact(prepared), true);
  assert.equal(assertPreparedInvestigationPolicyArtifact(prepared), true);
  assert.equal(isPreparedInvestigationPolicyArtifact({ ...prepared }), false);
  assert.throws(() => assertPreparedInvestigationPolicyArtifact({ ...prepared }), TypeError);
  assert.throws(
    () => new prepared.constructor({ artifact: prepared.artifact }),
    TypeError,
  );
  assert.equal(Object.isFrozen(Object.getPrototypeOf(prepared)), true);
  assert.equal(Object.isFrozen(view), true);
  assert.equal(Object.isFrozen(view.artifact), true);
  assert.equal(Object.isFrozen(view.semanticProjection), true);
  assert.equal(Object.isFrozen(view.policies), true);

  const canonical = view.canonicalBytes;
  const semantic = view.semanticBytes;
  canonical.fill(0);
  semantic.fill(0);
  assert.deepEqual(prepared.canonicalBytes(), canonicalizeRestrictedJson(prepared.artifact));
  assert.deepEqual(
    prepared.semanticBytes(),
    canonicalizeRestrictedJson(prepared.semanticProjection),
  );
});

test("Policy preparation and retained authority resist post-import intrinsic poisoning", () => {
  const source = canonicalizeRestrictedJson(policy("p", [
    rule("a", "memoryos.require-artifact-cardinality", {
      artifactClass: "evidence",
      minimumCount: 1,
    }),
  ]));
  const expected = prepareInvestigationPolicy(source);
  const expectedCanonical = expected.canonicalBytes();
  const expectedSemantic = expected.semanticBytes();
  const expectedDocumentDigest = expected.documentDigest;
  const expectedSemanticDigest = expected.semanticDigest;

  const originalArrayIsArray = Array.isArray;
  const originalArrayIterator = Array.prototype[Symbol.iterator];
  const originalArrayIncludes = Array.prototype.includes;
  const originalArrayMap = Array.prototype.map;
  const originalArraySome = Array.prototype.some;
  const originalArraySort = Array.prototype.sort;
  const originalJsonParse = JSON.parse;
  const originalJsonStringify = JSON.stringify;
  const originalNumberIsSafeInteger = Number.isSafeInteger;
  const originalNumberToString = Number.prototype.toString;
  const originalObjectEntries = Object.entries;
  const originalObjectFreeze = Object.freeze;
  const originalObjectGetOwnPropertyNames = Object.getOwnPropertyNames;
  const originalObjectHasOwn = Object.hasOwn;
  const originalObjectKeys = Object.keys;
  const originalObjectValues = Object.values;
  const originalReflectApply = Reflect.apply;
  const originalRegExpTest = RegExp.prototype.test;
  const originalSetAdd = Set.prototype.add;
  const originalSetHas = Set.prototype.has;
  const originalStringPadStart = String.prototype.padStart;
  const originalTextEncoderEncode = TextEncoder.prototype.encode;
  const originalUint8ArraySet = Uint8Array.prototype.set;
  const originalUint8ArraySlice = Uint8Array.prototype.slice;
  let actual;
  let view;
  try {
    Array.isArray = () => false;
    Array.prototype[Symbol.iterator] = function poisonedIterator() {
      return originalReflectApply(originalArrayIterator, [], []);
    };
    Array.prototype.includes = () => true;
    Array.prototype.map = () => [];
    Array.prototype.some = () => false;
    Array.prototype.sort = () => [];
    JSON.parse = () => ({ attackerControlled: true });
    JSON.stringify = () => "{}";
    Number.isSafeInteger = () => false;
    Number.prototype.toString = () => "0";
    Object.entries = () => [];
    Object.freeze = (value) => value;
    Object.getOwnPropertyNames = () => [];
    Object.hasOwn = () => false;
    Object.keys = () => [];
    Object.values = () => [];
    Reflect.apply = () => { throw new Error("poisoned Reflect.apply"); };
    RegExp.prototype.test = () => false;
    Set.prototype.add = function poisonedAdd() { return this; };
    Set.prototype.has = () => true;
    String.prototype.padStart = () => "00000000";
    TextEncoder.prototype.encode = () => new Uint8Array([0]);
    Uint8Array.prototype.set = () => undefined;
    Uint8Array.prototype.slice = function poisonedSlice() { return this; };

    actual = prepareInvestigationPolicy(source);
    view = preparedInvestigationPolicyArtifactEvaluationView(actual);
  } finally {
    Array.isArray = originalArrayIsArray;
    Array.prototype[Symbol.iterator] = originalArrayIterator;
    Array.prototype.includes = originalArrayIncludes;
    Array.prototype.map = originalArrayMap;
    Array.prototype.some = originalArraySome;
    Array.prototype.sort = originalArraySort;
    JSON.parse = originalJsonParse;
    JSON.stringify = originalJsonStringify;
    Number.isSafeInteger = originalNumberIsSafeInteger;
    Number.prototype.toString = originalNumberToString;
    Object.entries = originalObjectEntries;
    Object.freeze = originalObjectFreeze;
    Object.getOwnPropertyNames = originalObjectGetOwnPropertyNames;
    Object.hasOwn = originalObjectHasOwn;
    Object.keys = originalObjectKeys;
    Object.values = originalObjectValues;
    Reflect.apply = originalReflectApply;
    RegExp.prototype.test = originalRegExpTest;
    Set.prototype.add = originalSetAdd;
    Set.prototype.has = originalSetHas;
    String.prototype.padStart = originalStringPadStart;
    TextEncoder.prototype.encode = originalTextEncoderEncode;
    Uint8Array.prototype.set = originalUint8ArraySet;
    Uint8Array.prototype.slice = originalUint8ArraySlice;
  }

  assert.deepEqual(actual.canonicalBytes(), expectedCanonical);
  assert.deepEqual(actual.semanticBytes(), expectedSemantic);
  assert.equal(actual.documentDigest, expectedDocumentDigest);
  assert.equal(actual.semanticDigest, expectedSemanticDigest);
  assert.deepEqual(view.canonicalBytes, expectedCanonical);
  assert.deepEqual(view.semanticBytes, expectedSemantic);
  assert.equal(Object.isFrozen(actual.artifact.rules[0].parameters), true);
  assert.throws(() => { actual.artifact.rules[0].parameters.minimumCount = 2; }, TypeError);
});

test("Policy accepts surrounding whitespace but derives the exact canonical document", () => {
  const value = policy("p");
  const expected = canonicalizeRestrictedJson(value);
  const source = utf8Encode(` \n${canonicalizeRestrictedJsonText(value)}\t `);
  const prepared = prepareInvestigationPolicy(source);
  assert.deepEqual(prepared.canonicalBytes(), expected);
});

test("Policy metadata is valid, non-semantic, and document-identifying", () => {
  const documentA = policy("p", [rule("e")]);
  documentA.metadata = { description: "x" };
  const documentB = policy("p", [rule("e")]);
  documentB.metadata = { description: "y" };
  const left = preparePolicyValue(documentA);
  const right = preparePolicyValue(documentB);
  assert.equal(
    canonicalizeRestrictedJsonText(left.artifact),
    '{"identifier":"p","kind":"MemoryOSInvestigationPolicy","metadata":{"description":"x"},"policyVersion":"0.0.0","rules":[{"identifier":"e","parameters":{},"type":"memoryos.require-mip-integrity","version":"1.0.0"}],"version":"1.0.0"}',
  );
  assert.equal(
    canonicalizeRestrictedJsonText(right.artifact),
    '{"identifier":"p","kind":"MemoryOSInvestigationPolicy","metadata":{"description":"y"},"policyVersion":"0.0.0","rules":[{"identifier":"e","parameters":{},"type":"memoryos.require-mip-integrity","version":"1.0.0"}],"version":"1.0.0"}',
  );
  assert.equal(left.documentDigest, "sha256:3cba4e98bb721ac34f817be344a26c1173ef42b6c0dc904afd9d4f809bf19010");
  assert.equal(right.documentDigest, "sha256:4a855edc4f44b8b0c6f677e9911e65cd18ef5a602808cdde320a26afd9f065d3");
  assert.notEqual(left.documentDigest, right.documentDigest);
  assert.equal(left.semanticDigest, "sha256:1ce5ef94974203130a465df33dc5c95ca9b6fad202bebd7bf50742e090a1190a");
  assert.equal(right.semanticDigest, "sha256:1ce5ef94974203130a465df33dc5c95ca9b6fad202bebd7bf50742e090a1190a");
  assert.deepEqual(left.semanticBytes(), right.semanticBytes());
  assert.equal(Object.hasOwn(left.semanticProjection, "metadata"), false);
});

test("Policy validates a multi-rule sequence against all registered parameter classes", () => {
  const value = policy("p", [
    rule("a", "memoryos.require-verification-completed"),
    rule("b", "memoryos.require-artifact-cardinality", { artifactClass: "semanticTransformation", minimumCount: 1 }),
    rule("c", "memoryos.require-lifecycle-state", { allowedStates: ["Created", "ReplayComplete", "Archived"] }),
    rule("d", "memoryos.prohibit-regression-findings", { categories: ["replay", "evidence", "lifecycle"] }),
  ]);
  const prepared = preparePolicyValue(value);
  assert.equal(prepared.artifact.rules.length, 4);
  assert.deepEqual(prepared.semanticProjection.rules.map(({ identifier }) => identifier), ["a", "b", "c", "d"]);
});

test("all six initial rule registrations prepare without executing", () => {
  const cases = [
    ["memoryos.require-verification-completed", {}],
    ["memoryos.require-replay-completed", {}],
    ["memoryos.require-artifact-cardinality", { artifactClass: "evidence", minimumCount: 9007199254740991 }],
    ["memoryos.require-lifecycle-state", { allowedStates: REGISTERED_LIFECYCLE_STATES }],
    ["memoryos.prohibit-regression-findings", { categories: REGISTERED_REGRESSION_CATEGORIES }],
    ["memoryos.require-mip-integrity", {}],
  ];
  for (const [type, parameters] of cases) {
    assert.doesNotThrow(() => preparePolicyValue(policy("p", [rule("a", type, parameters)])), type);
  }
});

test("Policy rejects duplicates, unknown members, and invalid stable versions", () => {
  assertCode(() => preparePolicyValue(policy("p", [])), "POLICY_SCHEMA_INVALID");
  assertCode(() => preparePolicyValue(policy("p", [rule("a"), rule("a")])), "POLICY_SCHEMA_INVALID");
  assertCode(() => preparePolicyValue({ ...policy("p"), script: "pass" }), "POLICY_SCHEMA_INVALID");
  assertCode(() => preparePolicyValue({ ...policy("p"), metadata: { description: "x", author: "a" } }), "POLICY_SCHEMA_INVALID");
  assertCode(() => preparePolicyValue({ ...policy("p"), policyVersion: "1.0.0-alpha" }), "POLICY_SCHEMA_INVALID");
  assertCode(() => preparePolicyValue({ ...policy("p"), version: "1.0" }), "POLICY_SCHEMA_INVALID");
  assertCode(() => preparePolicyValue({ ...policy("p"), version: "2.0.0" }), "POLICY_VERSION_UNSUPPORTED");
  assertCode(() => preparePolicyValue({ ...policy("p"), identifier: "P" }), "POLICY_SCHEMA_INVALID");
  const missingRuleMember = rule();
  delete missingRuleMember.parameters;
  assertCode(() => preparePolicyValue(policy("p", [missingRuleMember])), "POLICY_SCHEMA_INVALID");
  assertCode(() => preparePolicyValue(policy("p", [{ ...rule(), extra: true }])), "POLICY_SCHEMA_INVALID");
});

test("Policy preserves unsupported rule type and version classifications", () => {
  assertCode(
    () => preparePolicyValue(policy("p", [rule("a", "memoryos.unknown")])),
    "RULE_TYPE_UNSUPPORTED",
  );
  assertCode(
    () => preparePolicyValue(policy("p", [rule("a", "constructor")])),
    "RULE_TYPE_UNSUPPORTED",
  );
  assertCode(
    () => preparePolicyValue(policy("p", [rule("a", "memoryos.require-mip-integrity", {}, "2.0.0")])),
    "RULE_VERSION_UNSUPPORTED",
  );
  assertCode(
    () => preparePolicyValue(policy("p", [rule("a", "memoryos.require-mip-integrity", {}, "latest")])),
    "POLICY_SCHEMA_INVALID",
  );
  assertCode(
    () => preparePolicyValue(policy("p", [rule("a"), rule("a"), rule("b", "memoryos.unknown")])),
    "RULE_TYPE_UNSUPPORTED",
  );
  assertCode(
    () => preparePolicyValue(policy("p", [
      rule("a", "memoryos.unknown"),
      { ...rule("b"), extra: true },
    ])),
    "POLICY_SCHEMA_INVALID",
  );
});

test("registered parameter schemas are closed and enforce exact primitive/value contracts", () => {
  const invalid = [
    rule("a", "memoryos.require-mip-integrity", { extra: true }),
    rule("a", "memoryos.require-artifact-cardinality", { artifactClass: "evidence", minimumCount: true }),
    rule("a", "memoryos.require-artifact-cardinality", { artifactClass: "evidence", minimumCount: null }),
    rule("a", "memoryos.require-artifact-cardinality", { artifactClass: "other", minimumCount: 1 }),
    rule("a", "memoryos.require-artifact-cardinality", { artifactClass: "evidence", minimumCount: 0 }),
    rule("a", "memoryos.require-lifecycle-state", { allowedStates: ["Archived", "Created"] }),
    rule("a", "memoryos.require-lifecycle-state", { allowedStates: ["Created", "Created"] }),
    rule("a", "memoryos.prohibit-regression-findings", { categories: [] }),
    rule("a", "memoryos.prohibit-regression-findings", { categories: ["unknown"] }),
  ];
  for (const item of invalid) assertCode(() => preparePolicyValue(policy("p", [item])), "POLICY_SCHEMA_INVALID");
  const unsafe = canonicalizeRestrictedJsonText(policy("p", [
    rule("a", "memoryos.require-artifact-cardinality", { artifactClass: "evidence", minimumCount: 1 }),
  ])).replace('"minimumCount":1', '"minimumCount":9007199254740992');
  assertCode(
    () => prepareInvestigationPolicy(utf8Encode(unsafe)),
    "POLICY_SYNTAX_INVALID",
  );
});

test("Policy syntax failures never become PASS, FAIL, or CNE", () => {
  for (const source of ["{", '{"a":1,"a":2}', '{"n":1.5}', "{}{}"] ) {
    assertCode(() => prepareInvestigationPolicy(utf8Encode(source)), "POLICY_SYNTAX_INVALID");
  }
});

test("minimal and multiple-child Policy Sets preserve order and semantic pins", () => {
  const a = policy("a", [rule("a", "memoryos.require-mip-integrity")]);
  const b = policy("b", [rule("b", "memoryos.require-replay-completed")]);
  const one = prepareInvestigationPolicySet(canonicalizeRestrictedJson(policySet("s", [a])));
  assert.equal(one.preparedPolicies().length, 1);
  const forward = prepareInvestigationPolicySet(canonicalizeRestrictedJson(policySet("s", [a, b])));
  const reverse = prepareInvestigationPolicySet(canonicalizeRestrictedJson(policySet("s", [b, a])));
  assert.deepEqual(forward.semanticProjection.policies, forward.preparedPolicies().map(({ semanticDigest }) => ({ semanticDigest })));
  assert.notEqual(forward.semanticDigest, reverse.semanticDigest);
  assert.notEqual(forward.documentDigest, reverse.documentDigest);
});

test("Policy Set metadata isolation preserves the frozen semantic identity", () => {
  const documentA = policySet("s", [policy("a", [rule("e")])]);
  documentA.metadata = { description: "x" };
  const documentB = policySet("s", [policy("a", [rule("e")])]);
  documentB.metadata = { description: "y" };
  const left = prepareInvestigationPolicySet(canonicalizeRestrictedJson(documentA));
  const right = prepareInvestigationPolicySet(canonicalizeRestrictedJson(documentB));
  assert.equal(
    canonicalizeRestrictedJsonText(left.artifact),
    '{"identifier":"s","kind":"MemoryOSInvestigationPolicySet","metadata":{"description":"x"},"policies":[{"expectedSemanticDigest":"sha256:80a2723e99a9677f8c1cf18553d9cb729d3d53f96269055adf0082b5f4c4ecb8","policy":{"identifier":"a","kind":"MemoryOSInvestigationPolicy","policyVersion":"0.0.0","rules":[{"identifier":"e","parameters":{},"type":"memoryos.require-mip-integrity","version":"1.0.0"}],"version":"1.0.0"}}],"policySetVersion":"0.0.0","version":"1.0.0"}',
  );
  assert.equal(left.documentDigest, "sha256:ca656e7a50dfcb9e837652dcc9645247fdb61e1c3e4e8dd8168fd4ba3c71648a");
  assert.equal(right.documentDigest, "sha256:0de7f244359b9de6ba32e4cedbc8d233983156098742b532cf5f6893dea1c606");
  assert.notEqual(left.documentDigest, right.documentDigest);
  assert.equal(left.semanticDigest, "sha256:9b32da8ceb8c3759e056a4a2c9bac7c692b653093cef6bac26295ac54c50b243");
  assert.equal(left.semanticDigest, right.semanticDigest);
  assert.deepEqual(left.semanticBytes(), right.semanticBytes());
});

test("Policy Set rejects zero children, malformed members, nested Sets, and unknown composition", () => {
  const wrongTypedPolicies = policySet("s", [policy("a")]);
  wrongTypedPolicies.policies = null;
  assertCode(
    () => prepareInvestigationPolicySet(canonicalizeRestrictedJson(wrongTypedPolicies)),
    "POLICY_SCHEMA_INVALID",
  );
  const empty = policySet("s", [policy("a")]);
  empty.policies = [];
  assertCode(() => prepareInvestigationPolicySet(canonicalizeRestrictedJson(empty)), "POLICY_SET_INVALID");
  const malformed = policySet("s", [policy("a")]);
  malformed.policies[0].extra = true;
  assertCode(() => prepareInvestigationPolicySet(canonicalizeRestrictedJson(malformed)), "POLICY_SET_INVALID");
  const nested = policySet("s", [policy("a")]);
  nested.policies[0].policy = policySet("n", [policy("b")]);
  assertCode(() => prepareInvestigationPolicySet(canonicalizeRestrictedJson(nested)), "POLICY_SET_INVALID");
  const combining = { ...policySet("s", [policy("a")]), combiningAlgorithm: "all" };
  assertCode(() => prepareInvestigationPolicySet(canonicalizeRestrictedJson(combining)), "POLICY_SCHEMA_INVALID");
  const missingPin = policySet("s", [policy("a")]);
  delete missingPin.policies[0].expectedSemanticDigest;
  assertCode(() => prepareInvestigationPolicySet(canonicalizeRestrictedJson(missingPin)), "POLICY_SET_INVALID");
  const malformedPin = policySet("s", [policy("a")]);
  malformedPin.policies[0].expectedSemanticDigest = "SHA256:00";
  assertCode(() => prepareInvestigationPolicySet(canonicalizeRestrictedJson(malformedPin)), "POLICY_SET_INVALID");
  assertCode(
    () => prepareInvestigationPolicySet(canonicalizeRestrictedJson({ ...policySet("s", [policy("a")]), version: "1.0" })),
    "POLICY_SCHEMA_INVALID",
  );
  assertCode(
    () => prepareInvestigationPolicySet(canonicalizeRestrictedJson({ ...policySet("s", [policy("a")]), version: "2.0.0" })),
    "POLICY_VERSION_UNSUPPORTED",
  );
  assertCode(
    () => prepareInvestigationPolicySet(canonicalizeRestrictedJson({ ...policySet("s", [policy("a")]), identifier: "S" })),
    "POLICY_SCHEMA_INVALID",
  );
  const unsupportedChildAndMalformedPin = policySet("s", [policy("a")]);
  unsupportedChildAndMalformedPin.policies[0].policy.version = "2.0.0";
  unsupportedChildAndMalformedPin.policies[0].expectedSemanticDigest = "malformed";
  assertCode(
    () => prepareInvestigationPolicySet(canonicalizeRestrictedJson(unsupportedChildAndMalformedPin)),
    "POLICY_VERSION_UNSUPPORTED",
  );
});

test("Policy Set rejects duplicate child identifiers and duplicate semantic digests", () => {
  const first = policy("a");
  const second = policy("a", [rule("b", "memoryos.require-replay-completed")]);
  assertCode(
    () => prepareInvestigationPolicySet(canonicalizeRestrictedJson(policySet("s", [first, second]))),
    "POLICY_SET_INVALID",
  );
  assertCode(
    () => prepareInvestigationPolicySet(canonicalizeRestrictedJson(policySet("s", [first, structuredClone(first)]))),
    "POLICY_SET_INVALID",
  );
});

test("Policy Set rejects a syntactically valid but incorrect semantic pin", () => {
  const value = policySet("s", [policy("a")]);
  value.policies[0].expectedSemanticDigest = `sha256:${"0".repeat(64)}`;
  assertCode(() => prepareInvestigationPolicySet(canonicalizeRestrictedJson(value)), "POLICY_DIGEST_MISMATCH");
});

test("Policy Set outer raw gate precedes syntax and inline children have no raw transport gate", () => {
  const canonical = canonicalizeRestrictedJson(policySet("s", [policy("a")]));
  const padded = new Uint8Array(LIMITS["policy-set.raw-document-bytes"] + 1);
  padded.fill(0x20);
  padded.set(canonical);
  assertCode(
    () => prepareInvestigationPolicySet(padded),
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    "policy-set.raw-document-bytes",
  );
});

test("Policy Set phase E is limit-major and pin verification precedes Set uniqueness", () => {
  const tooManyRules = policy("a", [rule("a"), rule("b"), rule("c"), rule("d"), rule("e")]);
  const overlongIdentifier = policy("aaa");
  const crossLimit = {
    identifier: "s",
    kind: INVESTIGATION_POLICY_SET_KIND,
    policies: [tooManyRules, overlongIdentifier].map((child) => ({
      expectedSemanticDigest: `sha256:${"0".repeat(64)}`,
      policy: child,
    })),
    policySetVersion: "0.0.0",
    version: "1.0.0",
  };
  assertCode(
    () => prepareInvestigationPolicySet(canonicalizeRestrictedJson(crossLimit)),
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    "policy.identifier-utf8-bytes",
  );

  const first = policy("a");
  const second = policy("a");
  second.metadata = { description: "xx" };
  const duplicate = {
    ...crossLimit,
    policies: [first, second].map((child) => ({
      expectedSemanticDigest: `sha256:${"0".repeat(64)}`,
      policy: child,
    })),
  };
  assertCode(
    () => prepareInvestigationPolicySet(canonicalizeRestrictedJson(duplicate)),
    "POLICY_DIGEST_MISMATCH",
  );

  const correctlyPinnedDuplicate = policySet("s", [first, second]);
  assertCode(
    () => prepareInvestigationPolicySet(canonicalizeRestrictedJson(correctlyPinnedDuplicate)),
    "POLICY_SET_INVALID",
  );
});

test("Phase-1 semantic identities intersect the final CF6 golden corpus exactly", async () => {
  const cache = JSON.parse(await readFixture("cache-validation-vectors.json"));
  const golden = JSON.parse(await readFixture("final-evaluation-identity-outcome-golden-vectors.json"));
  const preparedPolicy = preparePolicyValue(cache.authoritativeInput.artifact);
  const policyRecord = golden.records.find(({ recordId }) => recordId === "vector-metadata-a");
  assert.equal(policyRecord.logicalEvaluationIdentity.evaluatedArtifact.semanticDigest, preparedPolicy.semanticDigest);

  const setRecord = golden.records.find(({ recordId }) => recordId === "vector-policy-set");
  assert.equal(setRecord.logicalEvaluationIdentity.evaluatedArtifact.semanticDigest, "sha256:9b32da8ceb8c3759e056a4a2c9bac7c692b653093cef6bac26295ac54c50b243");
  assert.equal(golden.resourceProfileDigest, "sha256:c091573dfd05481f5759ef077e15af16689382a7432fa546c6630c4caeaa5239");
});

test("the final closure vector corpora retain their reviewed source-byte identities", async () => {
  const expected = new Map([
    ["cache-validation-vectors.json", [114988, "sha256:4c3432d9f66595977f2ff7510869fab82e493b838882c07f1b69b12add46de1f"]],
    ["final-evaluation-identity-outcome-golden-vectors.json", [116743, "sha256:fe5d4212ae4e725cfa32c680d739d4ab13739fa983b7b5edabf84618a7ddb524"]],
  ]);
  for (const [name, [byteCount, digest]] of expected) {
    const raw = await readFixture(name);
    assert.equal(raw.length, byteCount, name);
    assert.equal(`sha256:${sha256Hex(raw)}`, digest, name);
    assert.doesNotThrow(() => parseRestrictedJson(raw), name);
  }
});

const boundaryRegistry = [
  [1, "json.nesting-depth", "generic"],
  [2, "json.value-count", "generic"],
  [3, "json.string-utf8-bytes", "generic"],
  [4, "policy.raw-document-bytes", "policy"],
  [5, "policy.canonical-document-bytes", "policy"],
  [6, "policy.identifier-utf8-bytes", "policy"],
  [7, "policy.authored-version-utf8-bytes", "policy"],
  [8, "policy.description-utf8-bytes", "policy"],
  [9, "policy.rule-identifier-utf8-bytes", "policy"],
  [10, "policy.rule-count", "policy"],
  [11, "policy-set.raw-document-bytes", "set"],
  [12, "policy-set.canonical-document-bytes", "set"],
  [13, "policy-set.identifier-utf8-bytes", "set"],
  [14, "policy-set.authored-version-utf8-bytes", "set"],
  [15, "policy-set.description-utf8-bytes", "set"],
  [16, "policy-set.policy-count", "set"],
];

function measuredValue(index, value, rawLength) {
  const census = jsonCensus(value);
  if (index === 1) return census.maximumDepth;
  if (index === 2) return census.valueCount;
  if (index === 3) return census.maximumStringUtf8Bytes;
  if (index === 4 || index === 11) return rawLength;
  if (index === 5 || index === 12) return canonicalizeRestrictedJson(value).length;
  if (index === 6 || index === 13) return utf8Encode(value.identifier).length;
  if (index === 7) return utf8Encode(value.policyVersion).length;
  if (index === 8 || index === 15) return utf8Encode(value.metadata?.description ?? "").length;
  if (index === 9) return Math.max(...value.rules.map(({ identifier }) => utf8Encode(identifier).length));
  if (index === 10) return value.rules.length;
  if (index === 14) return utf8Encode(value.policySetVersion).length;
  return value.policies.length;
}

function enforceCarrier(kind, raw, value) {
  if (kind === "generic") return enforcePolicyJsonResourceLimits(value, "MemoryOSRestrictedJson");
  if (kind === "policy") return prepareInvestigationPolicy(raw);
  return prepareInvestigationPolicySet(raw);
}

test("frozen boundary carriers enforce below/exact/first-above for limits 1-16", async () => {
  const carrierUrl = new URL("boundary-carriers/", fixtureRoot);
  const names = (await readdir(carrierUrl)).sort();
  assert.equal(names.length, 46);
  const manifestRaw = await readFixture("boundary-v2-manifest.json");
  assert.equal(manifestRaw.length, 604716);
  assert.equal(
    `sha256:${sha256Hex(manifestRaw)}`,
    "sha256:902cece3543aa53af6fb9cc8f4c6411b531e6d96384c891142c84d1ea7580811",
  );
  const manifest = parseRestrictedJson(manifestRaw);
  const inventory = new Map(manifest.artifacts
    .filter(({ artifactId }) => /^b(?:0[1-9]|1[0-6])-/u.test(artifactId))
    .map((record) => [record.path.replace(/^carriers\//u, ""), record]));
  assert.equal(inventory.size, 46);
  for (const name of names) {
    const raw = await readFile(new URL(name, carrierUrl));
    const record = inventory.get(name);
    assert.ok(record, name);
    assert.equal(raw.length, record.rawBytes, name);
    assert.equal(`sha256:${sha256Hex(raw)}`, record.sha256, name);
  }
  for (const [index, limitIdentifier, kind] of boundaryRegistry) {
    const prefix = `b${String(index).padStart(2, "0")}-`;
    const candidates = names.filter((name) => name.includes(prefix));
    const belowName = candidates.find((name) => name.includes("nearest-reachable-below"));
    const exactName = candidates.find((name) => name.includes("exact-candidate"));
    const aboveName = candidates.find((name) => name.includes("first-reachable-above"));
    for (const [name, expected] of [[belowName, LIMITS[limitIdentifier] - 1], [exactName, LIMITS[limitIdentifier]]]) {
      const raw = await readFile(new URL(name, carrierUrl));
      const value = parseRestrictedJson(raw);
      assert.equal(measuredValue(index, value, raw.length), expected, `${limitIdentifier} ${name}`);
      assert.doesNotThrow(() => enforceCarrier(kind, raw, value), `${limitIdentifier} ${name}`);
    }
    if (aboveName !== undefined) {
      const raw = await readFile(new URL(aboveName, carrierUrl));
      const value = parseRestrictedJson(raw);
      assert.equal(measuredValue(index, value, raw.length), LIMITS[limitIdentifier] + 1, `${limitIdentifier} ${aboveName}`);
      assertCode(() => enforceCarrier(kind, raw, value), "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED", limitIdentifier);
    } else {
      assert.ok(index === 5 || index === 12, `${limitIdentifier} unexpectedly lacks an above carrier`);
    }
  }
});

test("limits 5 and 12 use the frozen machine-verifiable first-above unreachability proofs", async () => {
  const manifest = parseRestrictedJson(await readFixture("boundary-v2-manifest.json"));
  const proofDocument = await readFixture("boundary-v2-ceiling-proofs.json");
  assert.equal(proofDocument.length, 7174);
  assert.equal(
    `sha256:${sha256Hex(proofDocument)}`,
    "sha256:9d49bc8d96fc07a558566a6749601ef90f9234dd088c12afe74e69f9f525a3b5",
  );
  const expected = new Map([
    ["policy.canonical-document-bytes", {
      digest: "sha256:bf50ba1c9be081d40c034576185a927f82988bb055435baafa9212e3c3dce8bd",
      equation: "canonicalBytes<=rawBytes<=C4",
      target: 1025,
    }],
    ["policy-set.canonical-document-bytes", {
      digest: "sha256:b03860c2f784e6b37188c7ea2cec09f14ae15baf04739004dae4258330b93a35",
      equation: "canonicalBytes<=rawBytes<=C11",
      target: 2049,
    }],
  ]);
  let verified = 0;
  for (const proof of manifest.reachabilityProofs.filter(({ limitIdentifier }) => expected.has(limitIdentifier))) {
    const frozen = expected.get(proof.limitIdentifier);
    assert.equal(proof.proofDigest, frozen.digest);
    assert.equal(proof.target, frozen.target);
    assert.equal(proof.attainable, frozen.target - 1);
    assert.equal(proof.verifier.equation, frozen.equation);
    const material = Object.fromEntries(Object.entries(proof).filter(([name]) => name !== "proofDigest"));
    assert.equal(
      domainSeparatedDigest(
        "MEMORYOS-MO1301-CF5B-V2-REACHABILITY-PROOF",
        canonicalizeRestrictedJson(material),
      ),
      proof.proofDigest,
    );
    verified += 1;
  }
  assert.equal(verified, 2);
});
