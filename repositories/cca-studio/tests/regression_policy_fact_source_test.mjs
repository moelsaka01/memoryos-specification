import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { referenceSnapshot } from "../web/data/studio-snapshot.js";
import {
  INVESTIGATION_CORE_VERSION,
  InvestigationCore,
} from "../web/js/investigation-core.js";
import {
  MACHINE_DEFINITION_IDENTITIES,
  MEMORYOS_POLICY_RESOURCE_PROFILE,
  REGISTERED_REGRESSION_CATEGORIES,
} from "../web/js/investigation-policy-contracts.js";
import { canonicalize } from "../web/js/mip-canonical.js";
import {
  MemoryOSPolicyError,
} from "../web/js/policy-canonical.js";
import {
  assertAuthoritativeRegressionPolicyFactSource,
  capturePolicyFactContext,
  capturePolicyFactContextAndRegressionSource,
  normalizeAuthoritativeDeterministicFactSources,
} from "../web/js/policy-fact-context.js";
import {
  DETERMINISTIC_FACT_SOURCE_REGISTRY,
  DETERMINISTIC_FACT_SOURCE_REGISTRY_DIGEST,
  DETERMINISTIC_FACT_SOURCE_REGISTRY_VERSION,
  REGRESSION_POLICY_FACT_SOURCE_DOMAIN,
  REGRESSION_POLICY_FACT_SOURCE_KIND,
  REGRESSION_POLICY_FACT_SOURCE_MODEL,
  REGRESSION_POLICY_FACT_SOURCE_MODEL_DIGEST,
  REGRESSION_POLICY_FACT_SOURCE_MODEL_VERSION,
  REGRESSION_POLICY_FACT_SOURCE_SCHEMA_IDENTIFIER,
  REGRESSION_POLICY_FACT_SOURCE_VERSION,
  cognitiveRegressionReportIdentifier,
  inspectDetachedCognitiveRegressionReport,
  isPreparedRegressionPolicyFactSource,
  normalizeDeterministicFactSources,
  parseDetachedCognitiveRegressionReport,
  prepareRegressionPolicyFactSource,
  prepareRegressionPolicyFactSourceValue,
  projectRegressionPolicyFactSource,
  regressionPolicyFactIdentifier,
  regressionPolicyFactSourceCanonicalBytes,
  regressionPolicyFactSourceDigest,
  regressionSubjectDigest,
  validateRegressionPolicyFactSource,
} from "../web/js/regression-policy-fact-source.js";
import { cloneDetached } from "../web/js/studio-model.js";

const encoder = new TextEncoder();
const DIGEST = /^sha256:[0-9a-f]{64}$/u;
const PROFILE_LIMITS = MEMORYOS_POLICY_RESOURCE_PROFILE.limits;
const ZERO_DIGEST = `sha256:${"0".repeat(64)}`;
const CATEGORY_ORDER = Object.freeze([
  "replay",
  "reflection",
  "evidence",
  "retrieval",
  "evolution",
  "verification",
  "transition",
  "lifecycle",
]);

function clone(value) {
  return structuredClone(value);
}

function policyError(action, code, expectedDetails = {}) {
  assert.throws(action, (error) => {
    assert.equal(error instanceof MemoryOSPolicyError, true);
    assert.equal(error.code, code);
    for (const [key, value] of Object.entries(expectedDetails)) {
      assert.equal(error[key], value, `${code}.${key}`);
    }
    return true;
  });
}

function changedSnapshot() {
  const snapshot = cloneDetached(referenceSnapshot);
  snapshot.longTermMemory.entries[0].value = "MO-1301 deterministic Regression change.";
  return snapshot;
}

function nativeCapture(suffix, changed = false) {
  const baselineIdentifier = `policy-regression-${suffix}-baseline`;
  const candidateIdentifier = `policy-regression-${suffix}-candidate`;
  const core = new InvestigationCore();
  core.create({ identifier: baselineIdentifier, snapshot: referenceSnapshot });
  core.create({
    identifier: candidateIdentifier,
    snapshot: changed ? changedSnapshot() : referenceSnapshot,
  });
  const pair = capturePolicyFactContextAndRegressionSource(
    core,
    baselineIdentifier,
    candidateIdentifier,
  );
  return { baselineIdentifier, candidateIdentifier, core, ...pair };
}

async function mipBytes() {
  const encoded = await readFile(
    new URL("./fixtures/mip/complete-investigation.mip.b64", import.meta.url),
    "ascii",
  );
  return new Uint8Array(Buffer.from(encoded.trim(), "base64"));
}

async function mipCapture(suffix, withTrace = false) {
  const bytes = await mipBytes();
  const baselineIdentifier = `policy-regression-${suffix}-baseline`;
  const candidateIdentifier = `policy-regression-${suffix}-candidate`;
  const core = new InvestigationCore();
  const baseline = core.import(bytes, { identifier: baselineIdentifier });
  let candidate = core.import(bytes, { identifier: candidateIdentifier });
  if (withTrace) candidate = core.trace(candidateIdentifier, {});
  const pair = capturePolicyFactContextAndRegressionSource(
    core,
    baselineIdentifier,
    candidateIdentifier,
  );
  return { baseline, baselineIdentifier, candidate, candidateIdentifier, core, ...pair };
}

function paddedJson(bytes, length) {
  assert.ok(bytes.length <= length);
  const result = new Uint8Array(length);
  result.fill(0x20);
  result.set(bytes);
  return result;
}

function sourceWithFindingCount(sourceValue, count) {
  const source = clone(sourceValue);
  const template = source.facts.findings[0];
  assert.ok(template, "the changed native fixture supplies a finding template");
  source.facts.findings = Array.from({ length: count }, (_, index) => {
    const subject = {
      category: "evidence",
      subjectDigest: `sha256:${index.toString(16).padStart(64, "0")}`,
    };
    return {
      factIdentifier: regressionPolicyFactIdentifier("findings", subject),
      subject,
      value: clone(template.value),
    };
  });
  source.facts.categories.forEach((fact) => {
    const findingCount = fact.subject.category === "evidence" ? count : 0;
    fact.value.findingCount = findingCount;
    fact.value.status = findingCount === 0 ? "identical" : "changed";
  });
  source.facts.summary.value.findingCount = count;
  source.facts.summary.value.overall = count === 0 ? "identical" : "regressionDetected";
  return source;
}

async function jsonFixture(name) {
  return JSON.parse(await readFile(
    new URL(`./fixtures/investigation-policy/1.0.0/${name}`, import.meta.url),
    "utf8",
  ));
}

test("MO-1301 freezes the Regression source-model and deterministic-source registry closure identities", async () => {
  assert.equal(REGRESSION_POLICY_FACT_SOURCE_KIND, "MemoryOSRegressionPolicyFactSource");
  assert.equal(REGRESSION_POLICY_FACT_SOURCE_VERSION, "1.0.0");
  assert.equal(REGRESSION_POLICY_FACT_SOURCE_DOMAIN, "cognitiveRegression");
  assert.equal(REGRESSION_POLICY_FACT_SOURCE_MODEL_VERSION, "1.0.0");
  assert.equal(DETERMINISTIC_FACT_SOURCE_REGISTRY_VERSION, "1.0.0");
  assert.equal(
    REGRESSION_POLICY_FACT_SOURCE_MODEL_DIGEST,
    "sha256:e7d1fdf24758f2a0ac9ad609df578f95c058bf3cbab9f02a650f9cc12dab1c0d",
  );
  assert.equal(
    DETERMINISTIC_FACT_SOURCE_REGISTRY_DIGEST,
    "sha256:392d688acb866753c6ff85b7030131b38990b27d8a2a0ef6e8e052c8c4e048de",
  );
  assert.deepEqual(REGRESSION_POLICY_FACT_SOURCE_MODEL, {
    digest: REGRESSION_POLICY_FACT_SOURCE_MODEL_DIGEST,
    domain: REGRESSION_POLICY_FACT_SOURCE_DOMAIN,
    schemaIdentifier: REGRESSION_POLICY_FACT_SOURCE_SCHEMA_IDENTIFIER,
    sourceKind: REGRESSION_POLICY_FACT_SOURCE_KIND,
    sourceModelVersion: REGRESSION_POLICY_FACT_SOURCE_MODEL_VERSION,
    wireVersion: REGRESSION_POLICY_FACT_SOURCE_VERSION,
  });
  assert.deepEqual(DETERMINISTIC_FACT_SOURCE_REGISTRY, {
    kind: "MemoryOSDeterministicFactSourceRegistry",
    registryVersion: "1.0.0",
    sources: [{
      cardinality: { maximum: 1, minimum: 0 },
      domain: "cognitiveRegression",
      schemaIdentifier: REGRESSION_POLICY_FACT_SOURCE_SCHEMA_IDENTIFIER,
      sourceKind: REGRESSION_POLICY_FACT_SOURCE_KIND,
      sourceModelDigest: REGRESSION_POLICY_FACT_SOURCE_MODEL_DIGEST,
      sourceModelVersion: "1.0.0",
      wireVersion: "1.0.0",
    }],
  });
  assert.equal(Object.isFrozen(REGRESSION_POLICY_FACT_SOURCE_MODEL), true);
  assert.equal(Object.isFrozen(DETERMINISTIC_FACT_SOURCE_REGISTRY), true);
  assert.equal(Object.isFrozen(DETERMINISTIC_FACT_SOURCE_REGISTRY.sources), true);

  const modelIdentity = MACHINE_DEFINITION_IDENTITIES.find(
    ({ identityName }) => identityName === "sourceModelDigest:cognitiveRegression@1.0.0",
  );
  const registryIdentity = MACHINE_DEFINITION_IDENTITIES.find(
    ({ identityName }) => identityName === "deterministicFactSourceRegistryDigest",
  );
  assert.equal(modelIdentity.normativeDigest, REGRESSION_POLICY_FACT_SOURCE_MODEL_DIGEST);
  assert.equal(registryIdentity.normativeDigest, DETERMINISTIC_FACT_SOURCE_REGISTRY_DIGEST);

  const golden = await jsonFixture("final-evaluation-identity-outcome-golden-vectors.json");
  const vector = golden.records.find(({ recordId }) => recordId === "vector-policy-native-regression");
  assert.ok(vector);
  assert.deepEqual(vector.logicalEvaluationIdentity.externalSources, [{
    domain: "cognitiveRegression",
    sourceDigest: "sha256:26b464e984ea53c3f9b122e642c07433f4304d3f43ef3e7c8ca97b57c226e915",
  }]);
  assert.equal(
    vector.logicalEvaluationIdentity.policyFactContext.contextDigest,
    "sha256:918aa2eafd71937bb0ef295653f565db7855aef9cc608611cca966f566418037",
  );
});

test("MO-1301 trusted native capture emits the closed zero-finding source deterministically", () => {
  const first = nativeCapture("native-zero");
  const second = nativeCapture("native-zero");
  const source = first.regressionPolicyFactSource;
  const artifact = source.artifact;
  const baseline = first.core.load(first.baselineIdentifier);
  const candidate = first.core.load(first.candidateIdentifier);

  assert.equal(isPreparedRegressionPolicyFactSource(source), true);
  assert.equal(Object.isFrozen(source), true);
  assert.equal(Object.isFrozen(artifact), true);
  assert.equal(validateRegressionPolicyFactSource(artifact), true);
  assert.equal(artifact.facts.summary.value.findingCount, 0);
  assert.equal(artifact.facts.summary.value.overall, "identical");
  assert.deepEqual(
    artifact.facts.categories.map(({ subject }) => subject.category),
    CATEGORY_ORDER,
  );
  assert.deepEqual(
    artifact.facts.categories.map(({ value }) => [value.findingCount, value.status]),
    CATEGORY_ORDER.map(() => [0, "identical"]),
  );
  assert.deepEqual(artifact.facts.findings, []);
  assert.deepEqual(REGISTERED_REGRESSION_CATEGORIES, CATEGORY_ORDER);

  assert.deepEqual(Object.keys(artifact.binding.baseline).sort(), [
    "coreVersion",
    "investigationIdentifier",
    "sourceKind",
    "transitionLogDigest",
    "workspaceIdentifier",
  ]);
  assert.deepEqual(Object.keys(artifact.binding.candidate).sort(), [
    "coreVersion",
    "investigationIdentifier",
    "policyFactContextDigest",
    "sourceKind",
    "transitionLogDigest",
    "workspaceIdentifier",
  ]);
  assert.equal(Object.hasOwn(artifact.binding.baseline, "sourceIdentifier"), false);
  assert.equal(Object.hasOwn(artifact.binding.candidate, "sourceIdentifier"), false);
  assert.equal(artifact.binding.baseline.sourceKind, "native");
  assert.equal(artifact.binding.candidate.sourceKind, "native");
  assert.equal(artifact.binding.baseline.coreVersion, INVESTIGATION_CORE_VERSION);
  assert.equal(artifact.binding.candidate.coreVersion, INVESTIGATION_CORE_VERSION);
  assert.equal(artifact.binding.baseline.transitionLogDigest, baseline.transitionLog.digest);
  assert.equal(artifact.binding.candidate.transitionLogDigest, candidate.transitionLog.digest);
  assert.equal(
    artifact.binding.candidate.policyFactContextDigest,
    first.policyFactContext.contextDigest,
  );

  assert.match(source.sourceDigest, DIGEST);
  assert.equal(source.sourceDigest, regressionPolicyFactSourceDigest(source));
  assert.equal(source.sourceDigest, regressionPolicyFactSourceDigest(artifact));
  assert.equal(source.canonicalByteLength, regressionPolicyFactSourceCanonicalBytes(source).length);
  assert.deepEqual(source.canonicalBytes(), regressionPolicyFactSourceCanonicalBytes(artifact));
  assert.equal(first.policyFactContext.contextDigest, second.policyFactContext.contextDigest);
  assert.equal(source.sourceDigest, second.regressionPolicyFactSource.sourceDigest);
  assert.deepEqual(source.canonicalBytes(), second.regressionPolicyFactSource.canonicalBytes());

  assert.equal(
    artifact.facts.summary.factIdentifier,
    regressionPolicyFactIdentifier("summary", {}),
  );
  artifact.facts.categories.forEach((fact) => {
    assert.equal(
      fact.factIdentifier,
      regressionPolicyFactIdentifier("categories", fact.subject),
    );
  });
});

test("MO-1301 trusted construction reproduces the frozen same-candidate source identities", () => {
  const core = new InvestigationCore();
  const baselineA = clone(referenceSnapshot);
  const baselineB = clone(referenceSnapshot);
  const candidate = clone(referenceSnapshot);
  baselineB.longTermMemory.entries[0].value = "CF5B-2 authoritative alternate baseline.";
  candidate.longTermMemory.entries[0].value = "CF5B-2 authoritative shared candidate.";
  core.create({ identifier: "cf5b2-source-baseline-a", snapshot: baselineA });
  core.create({ identifier: "cf5b2-source-baseline-b", snapshot: baselineB });
  core.create({ identifier: "cf5b2-source-candidate", snapshot: candidate });

  const first = capturePolicyFactContextAndRegressionSource(
    core,
    "cf5b2-source-baseline-a",
    "cf5b2-source-candidate",
  );
  const second = capturePolicyFactContextAndRegressionSource(
    core,
    "cf5b2-source-baseline-b",
    "cf5b2-source-candidate",
  );
  assert.equal(
    first.policyFactContext.contextDigest,
    "sha256:71aa1e6e0e816a30ca8ff23c749c624665c711180aa35d235e2bb29d552b588f",
  );
  assert.equal(second.policyFactContext.contextDigest, first.policyFactContext.contextDigest);
  assert.equal(
    first.regressionPolicyFactSource.sourceDigest,
    "sha256:4c3755bff4a92b4107a9a4b2e48fbe0f84e97b1444da79b4e6ced9a563557321",
  );
  assert.equal(
    second.regressionPolicyFactSource.sourceDigest,
    "sha256:4d49591c3748956cb8940924531a49e46ee8dc40c45ab7829a5e328765c64412",
  );
  assert.notEqual(
    first.regressionPolicyFactSource.artifact.binding.baseline.transitionLogDigest,
    second.regressionPolicyFactSource.artifact.binding.baseline.transitionLogDigest,
  );
});

test("MO-1301 native findings preserve report identity, fact identifiers, and frozen order", () => {
  const captured = nativeCapture("native-findings", true);
  const source = captured.regressionPolicyFactSource;
  const report = captured.core.regression(
    captured.baselineIdentifier,
    captured.candidateIdentifier,
  );
  const expected = report.categories.flatMap(({ category, differences }) => (
    differences.map((difference) => ({ category, difference }))
  ));

  assert.equal(source.artifact.facts.summary.value.overall, "regressionDetected");
  assert.equal(source.artifact.facts.summary.value.findingCount, expected.length);
  assert.equal(expected.length, 2);
  assert.equal(source.artifact.binding.report.identifier, report.identifier);
  assert.equal(cognitiveRegressionReportIdentifier(report), report.identifier);
  assert.equal(canonicalize(inspectDetachedCognitiveRegressionReport(report)), canonicalize(report));
  assert.equal(
    canonicalize(parseDetachedCognitiveRegressionReport(encoder.encode(canonicalize(report)))),
    canonicalize(report),
  );

  source.artifact.facts.findings.forEach((fact, index) => {
    const { category, difference } = expected[index];
    assert.equal(fact.subject.category, category);
    assert.equal(
      fact.subject.subjectDigest,
      regressionSubjectDigest(category, difference.subject),
    );
    assert.equal(
      fact.factIdentifier,
      regressionPolicyFactIdentifier("findings", fact.subject),
    );
    assert.equal(fact.value.afterDigest, difference.afterDigest);
    assert.equal(fact.value.beforeDigest, difference.beforeDigest);
    assert.equal(fact.value.change, difference.change);
  });
  const categoryIndexes = source.artifact.facts.findings.map((fact) => (
    CATEGORY_ORDER.indexOf(fact.subject.category)
  ));
  assert.deepEqual(categoryIndexes, categoryIndexes.toSorted((left, right) => left - right));
});

test("MO-1301 trusted MIP capture binds verified package identity for zero and nonzero reports", async () => {
  const zero = await mipCapture("mip-zero");
  const changed = await mipCapture("mip-findings", true);
  const packageIdentifier = zero.baseline.state.package.manifest.packageIdentifier;

  assert.equal(packageIdentifier, "mip-reference-complete");
  for (const binding of [
    zero.regressionPolicyFactSource.artifact.binding.baseline,
    zero.regressionPolicyFactSource.artifact.binding.candidate,
    changed.regressionPolicyFactSource.artifact.binding.baseline,
    changed.regressionPolicyFactSource.artifact.binding.candidate,
  ]) {
    assert.equal(binding.sourceKind, "mip");
    assert.equal(binding.sourceIdentifier, packageIdentifier);
    assert.equal(binding.coreVersion, INVESTIGATION_CORE_VERSION);
  }
  assert.equal(
    zero.regressionPolicyFactSource.artifact.facts.summary.value.findingCount,
    0,
  );
  assert.equal(zero.regressionPolicyFactSource.artifact.facts.summary.value.overall, "identical");
  assert.deepEqual(
    changed.regressionPolicyFactSource.artifact.facts.categories.map((fact) => (
      [fact.subject.category, fact.value.findingCount]
    )),
    [
      ["replay", 1],
      ["reflection", 0],
      ["evidence", 0],
      ["retrieval", 0],
      ["evolution", 0],
      ["verification", 0],
      ["transition", 2],
      ["lifecycle", 1],
    ],
  );
  assert.equal(
    changed.regressionPolicyFactSource.artifact.facts.summary.value.findingCount,
    4,
  );
  assert.equal(
    changed.regressionPolicyFactSource.artifact.facts.summary.value.overall,
    "regressionDetected",
  );
  assert.notEqual(
    zero.regressionPolicyFactSource.sourceDigest,
    changed.regressionPolicyFactSource.sourceDigest,
  );
  assert.equal(
    changed.regressionPolicyFactSource.artifact.binding.candidate.policyFactContextDigest,
    changed.policyFactContext.contextDigest,
  );
  assert.equal(
    assertAuthoritativeRegressionPolicyFactSource(
      changed.regressionPolicyFactSource,
      changed.core,
      changed.policyFactContext,
    ),
    true,
  );
});

test("MO-1301 authority is adapter-minted, owner-scoped, context-bound, and lost on serialization", () => {
  const captured = nativeCapture("authority", true);
  const { core, policyFactContext, regressionPolicyFactSource: source } = captured;
  assert.equal(assertAuthoritativeRegressionPolicyFactSource(source, core, policyFactContext), true);
  assert.deepEqual(
    normalizeAuthoritativeDeterministicFactSources([source], core, policyFactContext),
    [source],
  );

  const detached = prepareRegressionPolicyFactSource(source.canonicalBytes(), {
    expectedSourceDigest: source.sourceDigest,
  });
  assert.equal(detached.sourceDigest, source.sourceDigest);
  policyError(
    () => assertAuthoritativeRegressionPolicyFactSource(detached, core, policyFactContext),
    "DETERMINISTIC_FACT_SOURCE_PROVENANCE_UNTRUSTED",
  );
  policyError(
    () => normalizeAuthoritativeDeterministicFactSources(
      [detached],
      core,
      policyFactContext,
    ),
    "DETERMINISTIC_FACT_SOURCE_PROVENANCE_UNTRUSTED",
  );

  const wrongContext = capturePolicyFactContext(core, captured.baselineIdentifier);
  policyError(
    () => assertAuthoritativeRegressionPolicyFactSource(source, core, wrongContext),
    "REGRESSION_POLICY_FACT_SOURCE_CANDIDATE_BINDING_MISMATCH",
  );
  policyError(
    () => assertAuthoritativeRegressionPolicyFactSource(
      source,
      new InvestigationCore(),
      policyFactContext,
    ),
    "DETERMINISTIC_FACT_SOURCE_PROVENANCE_UNTRUSTED",
  );

  const report = core.regression(captured.baselineIdentifier, captured.candidateIdentifier);
  const projected = projectRegressionPolicyFactSource(
    report,
    core.load(captured.baselineIdentifier),
    core.load(captured.candidateIdentifier),
    policyFactContext.contextDigest,
  );
  assert.equal(isPreparedRegressionPolicyFactSource(projected), false);
  const preparedProjection = prepareRegressionPolicyFactSourceValue(projected);
  policyError(
    () => assertAuthoritativeRegressionPolicyFactSource(
      preparedProjection,
      core,
      policyFactContext,
    ),
    "DETERMINISTIC_FACT_SOURCE_PROVENANCE_UNTRUSTED",
  );

  const bytes = source.canonicalBytes();
  bytes[0] ^= 0xff;
  assert.deepEqual(source.canonicalBytes(), regressionPolicyFactSourceCanonicalBytes(source));
});

test("MO-1301 capabilities resist constructor, prototype, and intrinsic tampering", () => {
  const first = nativeCapture("capability-hardening", true);
  const source = first.regressionPolicyFactSource;
  const context = first.policyFactContext;

  assert.equal(Object.isFrozen(Object.getPrototypeOf(source)), true);
  assert.equal(Object.isFrozen(Object.getPrototypeOf(context)), true);
  assert.throws(
    () => new source.constructor({
      artifact: source.artifact,
      canonical: source.canonicalBytes(),
      sourceDigest: source.sourceDigest,
    }),
    TypeError,
  );
  assert.throws(
    () => new context.constructor(context.artifact, context.canonicalBytes(), context.contextDigest),
    TypeError,
  );

  const originalGet = WeakMap.prototype.get;
  const originalHas = WeakMap.prototype.has;
  const originalApply = Reflect.apply;
  try {
    WeakMap.prototype.get = () => ({ core: first.core, context });
    WeakMap.prototype.has = () => true;
    assert.equal(
      assertAuthoritativeRegressionPolicyFactSource(source, first.core, context),
      true,
    );
    policyError(
      () => assertAuthoritativeRegressionPolicyFactSource({}, first.core, context),
      "DETERMINISTIC_FACT_SOURCE_PROVENANCE_UNTRUSTED",
    );

    Reflect.apply = (target, receiver, argumentsList) => (
      target === InvestigationCore.prototype.load
        ? (() => { throw new Error("poisoned public load"); })()
        : originalApply(target, receiver, argumentsList)
    );
    const second = nativeCapture("reflect-apply-hardening", false);
    assert.equal(second.regressionPolicyFactSource.artifact.facts.findings.length, 0);
  } finally {
    WeakMap.prototype.get = originalGet;
    WeakMap.prototype.has = originalHas;
    Reflect.apply = originalApply;
  }
});

test("MO-1301 capability freezing and retained bytes resist post-import intrinsic poisoning", () => {
  const baselineIdentifier = "policy-regression-intrinsic-freeze-baseline";
  const candidateIdentifier = "policy-regression-intrinsic-freeze-candidate";
  const core = new InvestigationCore();
  core.create({ identifier: baselineIdentifier, snapshot: referenceSnapshot });
  core.create({ identifier: candidateIdentifier, snapshot: changedSnapshot() });

  const originalValues = Object.values;
  const originalFreeze = Object.freeze;
  const originalSlice = Uint8Array.prototype.slice;
  const originalConstructor = Object.getOwnPropertyDescriptor(Uint8Array.prototype, "constructor");
  const originalArtifact = Object.getOwnPropertyDescriptor(Object.prototype, "artifact");
  const originalSetAdd = Set.prototype.add;
  const originalSetHas = Set.prototype.has;
  const originalIterator = Array.prototype[Symbol.iterator];
  const leakedSpeciesResults = [];
  const attackerArtifact = { attackerControlled: true };
  const isPhase2FreezeFrame = (stack) => stack.split("\n").some((line) => (
    (line.includes("at deepFreeze (") && line.includes("/policy-fact-context.js:"))
    || (line.includes("at freeze (") && line.includes("/regression-policy-fact-source.js:"))
  ));
  try {
    Object.values = () => [];
    Set.prototype.has = function poisonedHas(value) {
      const stack = new Error().stack ?? "";
      if (isPhase2FreezeFrame(stack)) return true;
      return Reflect.apply(originalSetHas, this, [value]);
    };
    Set.prototype.add = function poisonedAdd(value) {
      const stack = new Error().stack ?? "";
      if (isPhase2FreezeFrame(stack)) return this;
      return Reflect.apply(originalSetAdd, this, [value]);
    };
    Array.prototype[Symbol.iterator] = function poisonedIterator() {
      const stack = new Error().stack ?? "";
      if (isPhase2FreezeFrame(stack)) {
        return Reflect.apply(originalIterator, [], []);
      }
      return Reflect.apply(originalIterator, this, []);
    };
    Object.defineProperty(Object.prototype, "artifact", {
      configurable: true,
      get: () => attackerArtifact,
      set: () => undefined,
    });
    Object.defineProperty(Uint8Array.prototype, "constructor", {
      configurable: true,
      value: {
        [Symbol.species]: function poisonedSpecies(length) {
          const result = new Uint8Array(length);
          leakedSpeciesResults.push(result);
          return result;
        },
      },
    });
    const pair = capturePolicyFactContextAndRegressionSource(
      core,
      baselineIdentifier,
      candidateIdentifier,
    );
    const { policyFactContext: context, regressionPolicyFactSource: source } = pair;
    const contextDigest = context.contextDigest;
    const sourceDigest = source.sourceDigest;

    assert.equal(Object.hasOwn(context, "artifact"), true);
    assert.equal(context.artifact === attackerArtifact, false);
    assert.equal(Object.isFrozen(context.artifact.facts.lifecycle.items[0].value), true);
    assert.equal(Object.isFrozen(source.artifact.facts.summary.value), true);
    assert.throws(() => { context.artifact.facts.lifecycle.items[0].value.state = "Archived"; }, TypeError);
    assert.throws(() => { source.artifact.facts.summary.value.findingCount = 0; }, TypeError);

    const contextBytes = context.canonicalBytes();
    const sourceBytes = source.canonicalBytes();
    assert.equal(leakedSpeciesResults.length, 0);
    Uint8Array.prototype.slice = function poisonedSlice() { return this; };
    contextBytes.fill(0);
    sourceBytes.fill(0);
    assert.notDeepEqual(context.canonicalBytes(), contextBytes);
    assert.notDeepEqual(source.canonicalBytes(), sourceBytes);
    assert.equal(context.contextDigest, contextDigest);
    assert.equal(source.sourceDigest, sourceDigest);
    assert.equal(assertAuthoritativeRegressionPolicyFactSource(source, core, context), true);
  } finally {
    Object.values = originalValues;
    Set.prototype.add = originalSetAdd;
    Set.prototype.has = originalSetHas;
    Array.prototype[Symbol.iterator] = originalIterator;
    Uint8Array.prototype.slice = originalSlice;
    Object.defineProperty(Uint8Array.prototype, "constructor", originalConstructor);
    if (originalArtifact === undefined) delete Object.prototype.artifact;
    else Object.defineProperty(Object.prototype, "artifact", originalArtifact);
  }

  try {
    Object.freeze = (value) => value;
    policyError(
      () => capturePolicyFactContext(core, candidateIdentifier),
      "POLICY_FACT_CONTEXT_SOURCE_STATE_INVALID",
    );
  } finally {
    Object.freeze = originalFreeze;
  }

  const authoritative = capturePolicyFactContextAndRegressionSource(
    core,
    baselineIdentifier,
    candidateIdentifier,
  );
  const detached = prepareRegressionPolicyFactSourceValue(
    authoritative.regressionPolicyFactSource.artifact,
  );
  const originalForEach = Array.prototype.forEach;
  try {
    Array.prototype.forEach = () => undefined;
    policyError(
      () => normalizeAuthoritativeDeterministicFactSources(
        [detached],
        core,
        authoritative.policyFactContext,
      ),
      "DETERMINISTIC_FACT_SOURCE_PROVENANCE_UNTRUSTED",
    );
  } finally {
    Array.prototype.forEach = originalForEach;
  }
});

test("MO-1301 trusted pair capture uses intrinsic Core state and rejects invalid ownership or pair binding", () => {
  const baselineIdentifier = "policy-regression-intrinsic-baseline";
  const candidateIdentifier = "policy-regression-intrinsic-candidate";
  const core = new InvestigationCore();
  core.create({ identifier: baselineIdentifier, snapshot: referenceSnapshot });
  core.create({ identifier: candidateIdentifier, snapshot: changedSnapshot() });
  Object.defineProperty(core, "load", {
    configurable: true,
    value() { throw new Error("caller-controlled load must not run"); },
  });
  const captured = capturePolicyFactContextAndRegressionSource(
    core,
    baselineIdentifier,
    candidateIdentifier,
  );
  assert.equal(captured.regressionPolicyFactSource.artifact.facts.summary.value.findingCount, 2);

  class ForeignCore extends InvestigationCore {}
  policyError(
    () => capturePolicyFactContextAndRegressionSource(new ForeignCore(), "a", "b"),
    "DETERMINISTIC_FACT_SOURCE_PROVENANCE_UNTRUSTED",
  );
  policyError(
    () => capturePolicyFactContextAndRegressionSource(core, "missing", candidateIdentifier),
    "REGRESSION_POLICY_FACT_SOURCE_ATOMIC_CAPTURE_FAILED",
  );

  const other = new InvestigationCore();
  other.create({ identifier: "other-baseline", snapshot: referenceSnapshot });
  other.create({
    identifier: "other-candidate",
    snapshot: cloneDetached({ ...referenceSnapshot, workspaceIdentifier: "other-workspace" }),
  });
  policyError(
    () => capturePolicyFactContextAndRegressionSource(other, "other-baseline", "other-candidate"),
    "REGRESSION_POLICY_FACT_SOURCE_CANDIDATE_BINDING_MISMATCH",
  );
});

test("MO-1301 serialized validity does not claim authoritative baseline provenance", () => {
  const captured = nativeCapture("serialized-provenance", true);
  const forged = clone(captured.regressionPolicyFactSource.artifact);
  forged.binding.baseline.transitionLogDigest = ZERO_DIGEST;
  const detached = prepareRegressionPolicyFactSourceValue(forged);

  assert.equal(validateRegressionPolicyFactSource(forged), true);
  assert.notEqual(detached.sourceDigest, captured.regressionPolicyFactSource.sourceDigest);
  policyError(
    () => assertAuthoritativeRegressionPolicyFactSource(
      detached,
      captured.core,
      captured.policyFactContext,
    ),
    "DETERMINISTIC_FACT_SOURCE_PROVENANCE_UNTRUSTED",
  );

  const report = captured.core.regression(
    captured.baselineIdentifier,
    captured.candidateIdentifier,
  );
  const alternate = new InvestigationCore();
  alternate.create({ identifier: "alternate-baseline", snapshot: referenceSnapshot });
  policyError(
    () => projectRegressionPolicyFactSource(
      report,
      alternate.load("alternate-baseline"),
      captured.core.load(captured.candidateIdentifier),
      captured.policyFactContext.contextDigest,
    ),
    "REGRESSION_POLICY_FACT_SOURCE_BASELINE_BINDING_INVALID",
  );
});

test("MO-1301 deterministic source normalization enforces closed 0..1 registered cardinality", () => {
  const { regressionPolicyFactSource: source } = nativeCapture("normalization", true);
  const empty = normalizeDeterministicFactSources([]);
  assert.deepEqual(empty, []);
  assert.equal(Object.isFrozen(empty), true);
  assert.deepEqual(normalizeDeterministicFactSources([source]), [source]);

  const plain = clone(source.artifact);
  const normalizedPlain = normalizeDeterministicFactSources([plain]);
  assert.equal(normalizedPlain.length, 1);
  assert.equal(isPreparedRegressionPolicyFactSource(normalizedPlain[0]), true);
  assert.equal(normalizedPlain[0].sourceDigest, source.sourceDigest);

  policyError(
    () => normalizeDeterministicFactSources([source, source]),
    "DETERMINISTIC_FACT_SOURCE_DUPLICATE",
  );
  const unsupported = clone(source.artifact);
  unsupported.domain = "futureDomain";
  policyError(
    () => normalizeDeterministicFactSources([unsupported]),
    "DETERMINISTIC_FACT_SOURCE_DOMAIN_UNSUPPORTED",
  );
  const sparse = [];
  sparse.length = 1;
  policyError(
    () => normalizeDeterministicFactSources(sparse),
    "DETERMINISTIC_FACT_SOURCE_SCHEMA_INVALID",
  );
});

test("MO-1301 serialized source validation preserves frozen classification precedence", () => {
  const { regressionPolicyFactSource: source } = nativeCapture("precedence", true);
  const valid = source.artifact;
  policyError(
    () => prepareRegressionPolicyFactSource(Uint8Array.of(0xff)),
    "DETERMINISTIC_FACT_SOURCE_SYNTAX_INVALID",
  );

  const commonInvalid = clone(valid);
  delete commonInvalid.facts;
  commonInvalid.domain = "futureDomain";
  commonInvalid.version = "2.0.0";
  policyError(
    () => prepareRegressionPolicyFactSourceValue(commonInvalid),
    "DETERMINISTIC_FACT_SOURCE_SCHEMA_INVALID",
  );

  const domainUnsupported = clone(valid);
  domainUnsupported.domain = "futureDomain";
  domainUnsupported.version = "2.0.0";
  domainUnsupported.unexpected = true;
  policyError(
    () => prepareRegressionPolicyFactSourceValue(domainUnsupported),
    "DETERMINISTIC_FACT_SOURCE_DOMAIN_UNSUPPORTED",
  );

  const versionUnsupported = clone(valid);
  versionUnsupported.version = "2.0.0";
  versionUnsupported.sourceModelVersion = "2.0.0";
  versionUnsupported.unexpected = true;
  policyError(
    () => prepareRegressionPolicyFactSourceValue(versionUnsupported),
    "DETERMINISTIC_FACT_SOURCE_VERSION_UNSUPPORTED",
  );

  const modelUnsupported = clone(valid);
  modelUnsupported.sourceModelVersion = "2.0.0";
  modelUnsupported.unexpected = true;
  policyError(
    () => prepareRegressionPolicyFactSourceValue(modelUnsupported),
    "DETERMINISTIC_FACT_SOURCE_MODEL_VERSION_UNSUPPORTED",
  );

  const sourceSchemaInvalid = clone(valid);
  sourceSchemaInvalid.unexpected = true;
  sourceSchemaInvalid.binding.report.version = "2.0.0";
  sourceSchemaInvalid.facts.summary.factIdentifier = ZERO_DIGEST;
  policyError(
    () => prepareRegressionPolicyFactSourceValue(sourceSchemaInvalid),
    "REGRESSION_POLICY_FACT_SOURCE_SCHEMA_INVALID",
  );

  const reportVersionUnsupported = clone(valid);
  reportVersionUnsupported.binding.report.version = "2.0.0";
  reportVersionUnsupported.facts.summary.factIdentifier = ZERO_DIGEST;
  policyError(
    () => prepareRegressionPolicyFactSourceValue(reportVersionUnsupported),
    "REGRESSION_REPORT_VERSION_UNSUPPORTED",
  );

  const incomplete = clone(valid);
  incomplete.facts.summary.factIdentifier = ZERO_DIGEST;
  policyError(
    () => prepareRegressionPolicyFactSourceValue(incomplete, {
      expectedSourceDigest: ZERO_DIGEST,
    }),
    "REGRESSION_POLICY_FACT_SOURCE_INCOMPLETE",
  );
  policyError(
    () => prepareRegressionPolicyFactSourceValue(valid, {
      expectedSourceDigest: ZERO_DIGEST,
    }),
    "REGRESSION_POLICY_FACT_SOURCE_DIGEST_MISMATCH",
  );
});

test("MO-1301 detached validation fails closed with stable report and source classifications", () => {
  const { core, baselineIdentifier, candidateIdentifier, regressionPolicyFactSource: source } =
    nativeCapture("detached-fail-closed", true);
  const report = core.regression(baselineIdentifier, candidateIdentifier);

  const unsupported = clone(report);
  unsupported.version = "2.0.0";
  unsupported.categories = [];
  policyError(
    () => inspectDetachedCognitiveRegressionReport(unsupported),
    "REGRESSION_REPORT_VERSION_UNSUPPORTED",
  );
  const wrongIdentity = clone(report);
  wrongIdentity.identifier = `regression:${"0".repeat(64)}`;
  policyError(
    () => inspectDetachedCognitiveRegressionReport(wrongIdentity),
    "REGRESSION_REPORT_IDENTITY_MISMATCH",
  );
  policyError(
    () => parseDetachedCognitiveRegressionReport("not bytes"),
    "REGRESSION_REPORT_INVALID",
  );

  const cyclic = clone(source.artifact);
  cyclic.self = cyclic;
  policyError(
    () => prepareRegressionPolicyFactSourceValue(cyclic),
    "DETERMINISTIC_FACT_SOURCE_SCHEMA_INVALID",
  );

  let getterCalled = false;
  const accessorReport = clone(report);
  Object.defineProperty(accessorReport, "overall", {
    enumerable: true,
    get() {
      getterCalled = true;
      return "identical";
    },
  });
  policyError(
    () => inspectDetachedCognitiveRegressionReport(accessorReport),
    "REGRESSION_REPORT_INVALID",
  );
  assert.equal(getterCalled, false);
});

test("MO-1301 raw-byte and finding-count boundaries enforce phases A and E", () => {
  const { regressionPolicyFactSource: source } = nativeCapture("resource-limits", true);
  const rawLimit = PROFILE_LIMITS["regression-policy-fact-source.raw-document-bytes"];
  const findingLimit = PROFILE_LIMITS["regression-policy-fact-source.finding-count"];
  assert.equal(rawLimit, 8192);
  assert.equal(findingLimit, 8);

  const belowRaw = paddedJson(source.canonicalBytes(), rawLimit - 1);
  assert.equal(prepareRegressionPolicyFactSource(belowRaw).sourceDigest, source.sourceDigest);
  const exactRaw = paddedJson(source.canonicalBytes(), rawLimit);
  const exactPrepared = prepareRegressionPolicyFactSource(exactRaw);
  assert.equal(exactPrepared.sourceDigest, source.sourceDigest);
  policyError(
    () => prepareRegressionPolicyFactSource(paddedJson(source.canonicalBytes(), rawLimit + 1)),
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    {
      configuredLimit: 8192,
      enforcementPhase: "A",
      limitIdentifier: "regression-policy-fact-source.raw-document-bytes",
      observedAtLeast: 8193,
    },
  );

  const belowFindings = sourceWithFindingCount(source.artifact, findingLimit - 1);
  assert.equal(
    prepareRegressionPolicyFactSourceValue(belowFindings).artifact.facts.findings.length,
    7,
  );
  const exactFindings = sourceWithFindingCount(source.artifact, findingLimit);
  const exactFindingSource = prepareRegressionPolicyFactSourceValue(exactFindings);
  assert.equal(exactFindingSource.artifact.facts.findings.length, 8);
  const aboveFindings = sourceWithFindingCount(source.artifact, findingLimit + 1);
  policyError(
    () => prepareRegressionPolicyFactSourceValue(aboveFindings),
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    {
      configuredLimit: 8,
      enforcementPhase: "E",
      limitIdentifier: "regression-policy-fact-source.finding-count",
      observedAtLeast: 9,
    },
  );
});

test("MO-1301 limit 23 cannot exceed under the frozen exact Core version", async () => {
  const manifest = await jsonFixture("boundary-v2-manifest.json");
  const limitIdentifier = "regression-policy-fact-source.canonical-document-bytes";
  const proof = manifest.reachabilityProofs.find((entry) => (
    entry.limitIdentifier === limitIdentifier
  ));
  const schemaMaximum = manifest.maximumWitnesses.find((entry) => (
    entry.witnessId === "maximum-regression-canonical-schema"
  ));
  const releasedCoreMaximum = manifest.maximumWitnesses.find((entry) => (
    entry.witnessId === "maximum-authoritative-regression-source"
  ));
  const { regressionPolicyFactSource: belowSource } = nativeCapture("canonical-limit-below", true);

  assert.equal(PROFILE_LIMITS[limitIdentifier], 7916);
  assert.ok(belowSource.canonicalByteLength < PROFILE_LIMITS[limitIdentifier]);
  assert.equal(
    prepareRegressionPolicyFactSourceValue(belowSource.artifact).sourceDigest,
    belowSource.sourceDigest,
  );
  assert.equal(proof.target, 7917);
  assert.equal(proof.attainable, 7916);
  assert.equal(
    proof.proofDigest,
    "sha256:59cef6b049776346ed2be88eecab21e5231292c9b933d8c4d2c8998156f170a6",
  );
  assert.deepEqual(proof.verifier, {
    C22: 8192,
    C23: 7916,
    C24: 8,
    maximumConstructionProofDigest:
      "sha256:0222e6b9662254713164845470a54ebb7b470f3c08150af836dabbe98ba1dc23",
  });

  assert.equal(schemaMaximum.observedValue, 7916);
  assert.equal(schemaMaximum.receipt.validityReceipt.productionAuthorityEstablished, false);
  assert.equal(schemaMaximum.receipt.constructionMaterial.baselineCoreVersionBytes, 256);
  assert.equal(schemaMaximum.receipt.constructionMaterial.candidateCoreVersionBytes, 256);
  assert.equal(encoder.encode(INVESTIGATION_CORE_VERSION).length, 5);
  assert.equal(INVESTIGATION_CORE_VERSION, "1.0.0");

  assert.equal(releasedCoreMaximum.status, "MATERIALIZED_MAXIMUM");
  assert.equal(releasedCoreMaximum.observedValue, 7414);
  assert.equal(releasedCoreMaximum.receipt.authorityEstablished, true);
  assert.equal(releasedCoreMaximum.receipt.coreVersion, INVESTIGATION_CORE_VERSION);
  assert.equal(releasedCoreMaximum.receipt.closedSchemaLongSemVerMaximumClaimed, false);
  assert.equal(
    releasedCoreMaximum.receipt.sourceDigest,
    "sha256:a96241831dbad2302598a19d192b6d2d2b64416652897b6f3199622320d8c4d2",
  );
  assert.ok(releasedCoreMaximum.observedValue < PROFILE_LIMITS[limitIdentifier]);
  assert.ok(PROFILE_LIMITS[limitIdentifier] + 1 > schemaMaximum.observedValue);
});
