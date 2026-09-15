import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { referenceSnapshot } from "../web/data/studio-snapshot.js";
import { InvestigationCore } from "../web/js/investigation-core.js";
import {
  MEMORYOS_POLICY_RESOURCE_PROFILE,
  MEMORYOS_POLICY_RESOURCE_PROFILE_DIGEST,
  REGISTERED_LIFECYCLE_STATES,
  REGISTERED_REGRESSION_CATEGORIES,
} from "../web/js/investigation-policy-contracts.js";
import {
  createInvestigationPolicyEvaluator,
  evaluateInvestigationPolicy,
  inspectDetachedPolicyEvaluationCacheVector,
  isPreparedPolicyEvaluation,
  policyEvaluationIdentityDigest,
  policyEvaluationOutcomeDigest,
  validateEvaluationIdentity,
  validatePolicyEvaluationOutcome,
} from "../web/js/investigation-policy-engine.js";
import {
  prepareInvestigationPolicy,
  prepareInvestigationPolicySet,
} from "../web/js/investigation-policy.js";
import { exportMemoryInvestigationPackage } from "../web/js/memory-investigation-package.js";
import {
  capturePolicyFactContext,
  capturePolicyFactContextAndRegressionSource,
  policyFactContextCanonicalBytes,
  policyFactContextDigest,
} from "../web/js/policy-fact-context.js";
import { MemoryOSPolicyError, canonicalizeRestrictedJson } from "../web/js/policy-canonical.js";
import { cloneDetached } from "../web/js/studio-model.js";

const fixtureRoot = new URL("./fixtures/investigation-policy/1.0.0/", import.meta.url);
const encoder = new TextEncoder();
const LIMITS = MEMORYOS_POLICY_RESOURCE_PROFILE.limits;
const clone = (value) => structuredClone(value);

async function jsonFixture(name) {
  return JSON.parse(await readFile(new URL(name, fixtureRoot), "utf8"));
}

async function mipFixture() {
  const encoded = await readFile(
    new URL("./fixtures/mip/complete-investigation.mip.b64", import.meta.url),
    "ascii",
  );
  return new Uint8Array(Buffer.from(encoded.trim(), "base64"));
}

function rule(identifier, type, parameters = {}) {
  return { identifier, parameters, type, version: "1.0.0" };
}

function policy(identifier, rules, metadata = undefined) {
  return {
    identifier,
    kind: "MemoryOSInvestigationPolicy",
    ...(metadata === undefined ? {} : { metadata }),
    policyVersion: "0.0.0",
    rules,
    version: "1.0.0",
  };
}

function preparePolicy(value) {
  return prepareInvestigationPolicy(canonicalizeRestrictedJson(value));
}

function policySet(identifier, policies, metadata = undefined) {
  return {
    identifier,
    kind: "MemoryOSInvestigationPolicySet",
    ...(metadata === undefined ? {} : { metadata }),
    policies: policies.map((child) => ({
      expectedSemanticDigest: preparePolicy(child).semanticDigest,
      policy: child,
    })),
    policySetVersion: "0.0.0",
    version: "1.0.0",
  };
}

function prepareSet(value) {
  return prepareInvestigationPolicySet(canonicalizeRestrictedJson(value));
}

function nativeContext(identifier = "phase3-native") {
  const core = new InvestigationCore();
  core.create({ identifier, snapshot: clone(referenceSnapshot) });
  return { context: capturePolicyFactContext(core, identifier), core, identifier };
}

function reflectionKey(investigation) {
  const node = investigation.state.currentFrame.world.nodes.find(
    ({ observationPath }) => observationPath === "Reflection.values[0]",
  ) ?? investigation.state.currentFrame.world.nodes.find(({ family }) => family === "Reflection");
  assert.ok(node);
  return node.key;
}

function completedNativeContext(identifier = "phase3-native-completed") {
  const core = new InvestigationCore();
  let investigation = core.create({ identifier, snapshot: clone(referenceSnapshot) });
  investigation = core.trace(identifier, reflectionKey(investigation));
  let guard = 0;
  while (investigation.state.replayState.status !== "completed") {
    investigation = core.replay(identifier, "next");
    assert.ok((guard += 1) < 10_000);
  }
  core.verify(identifier);
  return { context: capturePolicyFactContext(core, identifier), core, identifier };
}

function changedSnapshot() {
  const snapshot = cloneDetached(referenceSnapshot);
  snapshot.observationIdentifier = "changed";
  snapshot.longTermMemory.entries[0].value = "x";
  snapshot.semanticMemory.concepts[0].meaning = "x";
  snapshot.retrievalSessions[0].candidates[0].rankScore += 1;
  snapshot.reflections[0].knowledge = "x";
  return snapshot;
}

function regressionPair(suffix, changed) {
  const core = new InvestigationCore();
  const baselineIdentifier = `phase3-${suffix}-baseline`;
  const candidateIdentifier = `phase3-${suffix}-candidate`;
  core.create({ identifier: baselineIdentifier, snapshot: clone(referenceSnapshot) });
  core.create({
    identifier: candidateIdentifier,
    snapshot: changed ? changedSnapshot() : clone(referenceSnapshot),
  });
  const pair = capturePolicyFactContextAndRegressionSource(
    core, baselineIdentifier, candidateIdentifier,
  );
  return { core, ...pair };
}

async function activeMipContext() {
  const sourceCore = new InvestigationCore();
  const source = sourceCore.import(await mipFixture(), { identifier: "phase3-mip-source" });
  const packageValue = source.state.package;
  const observation = packageValue.observations[0];
  const trace = packageValue.traces.find(
    (entry) => entry.observationIdentifier === observation.identifier,
  );
  const replay = packageValue.replays.find((entry) => entry.traceIdentifier === trace?.identifier);
  assert.ok(trace && replay);
  const bytes = exportMemoryInvestigationPackage({
    packageIdentifier: "i",
    workspaceIdentifier: packageValue.manifest.workspaceIdentifier,
    metadata: packageValue.metadata,
    observations: [observation],
    traces: [trace],
    replays: [replay],
    evolutions: [],
    comparativeReconstructions: [],
    extensions: {},
    sourceAccepted: true,
    sourceAuthorshipAttested: true,
  });
  const core = new InvestigationCore();
  core.import(bytes, { identifier: "i" });
  core.trace("i", trace.identifier);
  let investigation = core.load("i");
  let guard = 0;
  while (investigation.state.replayState.status !== "completed") {
    investigation = core.replay("i", "next");
    assert.ok((guard += 1) < 10_000);
  }
  core.verify("i");
  return { context: capturePolicyFactContext(core, "i"), core };
}

async function floorMipImportedContext() {
  const sourceCore = new InvestigationCore();
  const source = sourceCore.import(await mipFixture(), { identifier: "phase3-floor-mip-source" });
  const packageValue = source.state.package;
  const observation = clone(packageValue.observations[0]);
  const trace = clone(packageValue.traces.find(
    (entry) => entry.observationIdentifier === observation.identifier,
  ));
  const replay = clone(packageValue.replays.find(
    (entry) => entry.traceIdentifier === trace?.identifier,
  ));
  assert.ok(trace && replay);
  observation.identifier = "o";
  observation.workspaceIdentifier = "w";
  observation.sequence = 0;
  trace.identifier = "t";
  trace.observationIdentifier = "o";
  trace.workspaceIdentifier = "w";
  replay.identifier = "r";
  replay.traceIdentifier = "t";
  replay.observationIdentifier = "o";
  replay.workspaceIdentifier = "w";
  const bytes = exportMemoryInvestigationPackage({
    packageIdentifier: "p",
    workspaceIdentifier: "w",
    metadata: packageValue.metadata,
    observations: [observation],
    traces: [trace],
    replays: [replay],
    evolutions: [],
    comparativeReconstructions: [],
    extensions: {},
    sourceAccepted: true,
    sourceAuthorshipAttested: true,
  });
  const core = new InvestigationCore();
  core.import(bytes, { identifier: "i" });
  return { context: capturePolicyFactContext(core, "i"), core };
}

function observationBoundaryContext(observationCount = 3) {
  const snapshotAt = (index) => {
    const snapshot = clone(referenceSnapshot);
    snapshot.observationIdentifier = `mo1301-boundary-observation-${index}`;
    snapshot.longTermMemory.entries[0].value = `Boundary observation ${index}.`;
    return snapshot;
  };
  const core = new InvestigationCore();
  const identifier = `mo1301-observation-boundary-${observationCount}`;
  core.create({ identifier, snapshot: snapshotAt(1) });
  for (let index = 2; index <= observationCount; index += 1) {
    core.observe(identifier, { snapshot: snapshotAt(index) });
  }
  return { context: capturePolicyFactContext(core, identifier), core };
}

function evidenceAddedRegressionPair() {
  const core = new InvestigationCore();
  const candidateSnapshot = clone(referenceSnapshot);
  candidateSnapshot.longTermMemory.entries.push({
    archived: false,
    identifier: "ltm-regression-added",
    value: "Added deterministic evidence.",
  });
  core.create({ identifier: "evidence-added-baseline", snapshot: clone(referenceSnapshot) });
  core.create({ identifier: "evidence-added-candidate", snapshot: candidateSnapshot });
  return {
    core,
    ...capturePolicyFactContextAndRegressionSource(
      core, "evidence-added-baseline", "evidence-added-candidate",
    ),
  };
}

function eightFindingRegressionPair() {
  const core = new InvestigationCore();
  const candidateSnapshot = clone(referenceSnapshot);
  candidateSnapshot.longTermMemory.entries[0].value = "Changed deterministic evidence.";
  core.create({
    identifier: "mo1301-authoritative-eight-baseline",
    snapshot: clone(referenceSnapshot),
  });
  let candidate = core.create({
    identifier: "mo1301-authoritative-eight-candidate",
    snapshot: candidateSnapshot,
  });
  candidate = core.trace(candidate.identifier, reflectionKey(candidate));
  core.verify(candidate.identifier);
  return {
    core,
    ...capturePolicyFactContextAndRegressionSource(
      core,
      "mo1301-authoritative-eight-baseline",
      "mo1301-authoritative-eight-candidate",
    ),
  };
}

function evaluate(core, context, value, sources = []) {
  return evaluateInvestigationPolicy(
    createInvestigationPolicyEvaluator(core), preparePolicy(value), context, sources,
  );
}

function assertPolicyError(action, code, limitIdentifier = undefined) {
  assert.throws(action, (error) => {
    assert.equal(error instanceof MemoryOSPolicyError, true, String(error));
    assert.equal(error.code, code);
    if (limitIdentifier !== undefined) {
      assert.equal(error.limitIdentifier, limitIdentifier);
      assert.equal(error.configuredLimit, LIMITS[limitIdentifier]);
      assert.equal(error.observedAtLeast, LIMITS[limitIdentifier] + 1);
    }
    return true;
  });
}

function assertResourceResult(evaluation, limitIdentifier) {
  assert.deepEqual(evaluation.outcome.result, {
    code: "POLICY_EVALUATION_RESOURCE_LIMIT_EXCEEDED",
    configuredLimit: LIMITS[limitIdentifier],
    decision: "COULD_NOT_EVALUATE",
    kind: "MemoryOSPolicyEvaluationResourceLimitResult",
    limitIdentifier,
    observedAtLeast: LIMITS[limitIdentifier] + 1,
  });
}

function assertEvaluationMatchesVector(evaluation, vector) {
  assert.equal(evaluation.evaluationIdentityDigest, vector.evaluationIdentityDigest, vector.recordId);
  assert.equal(evaluation.outcomeDigest, vector.outcomeDigest, vector.recordId);
  assert.deepEqual(
    evaluation.evaluationIdentityBytes(),
    encoder.encode(vector.canonicalIdentityBytes),
    vector.recordId,
  );
  assert.deepEqual(
    evaluation.canonicalOutcomeBytes(),
    encoder.encode(vector.canonicalOutcomeBytes),
    vector.recordId,
  );
  assert.deepEqual(
    JSON.parse(new TextDecoder().decode(evaluation.canonicalOutcomeBytes())),
    vector.logicalOutcome,
    vector.recordId,
  );
}

function flatCompletedRuleResults(result) {
  if (result.kind === "MemoryOSPolicyResult") return result.ruleResults;
  return result.policyResults.flatMap(({ ruleResults }) => ruleResults);
}

function evidenceFactIdentifierCount(result) {
  return flatCompletedRuleResults(result).reduce((total, ruleResult) => {
    const item = ruleResult.evidence[0];
    if (item.kind === "MemoryOSPolicyFactReference") return total + 1;
    if (item.kind === "MemoryOSPolicyFactSelection") {
      return total + item.matchedFactIdentifiers.length;
    }
    return total;
  }, 0);
}

function evidenceCanonicalByteCount(result) {
  return flatCompletedRuleResults(result).reduce(
    (total, ruleResult) => total + canonicalizeRestrictedJson(ruleResult.evidence).length,
    0,
  );
}

let exactMaximumPolicy;

function exactSemanticBytePolicy(targetBytes = 1024) {
  if (exactMaximumPolicy !== undefined) return clone(exactMaximumPolicy);
  const ruleIdentifiers = ["aa", "ab", "ac", "ad"];
  const baseAllowedStates = [REGISTERED_LIFECYCLE_STATES[0]];
  const artifact = {
    identifier: "aa",
    kind: "MemoryOSInvestigationPolicy",
    policyVersion: "1000.0.0",
    rules: ruleIdentifiers.map((identifier) => rule(
      identifier,
      "memoryos.require-lifecycle-state",
      { allowedStates: baseAllowedStates },
    )),
    version: "1.0.0",
  };
  const baseRuleBytes = canonicalizeRestrictedJson(artifact.rules[0]).length;
  const choicesByDelta = new Map();
  for (let mask = 1; mask < (1 << REGISTERED_LIFECYCLE_STATES.length); mask += 1) {
    const allowedStates = REGISTERED_LIFECYCLE_STATES.filter(
      (_state, index) => (mask & (1 << index)) !== 0,
    );
    const candidate = rule(
      "aa",
      "memoryos.require-lifecycle-state",
      { allowedStates },
    );
    const delta = canonicalizeRestrictedJson(candidate).length - baseRuleBytes;
    if (!choicesByDelta.has(delta)) choicesByDelta.set(delta, allowedStates);
  }
  const requiredDelta = targetBytes - canonicalizeRestrictedJson(artifact).length;
  let reachable = new Map([[0, []]]);
  const choices = [...choicesByDelta.entries()].sort(([left], [right]) => left - right);
  for (let slot = 0; slot < ruleIdentifiers.length; slot += 1) {
    const next = new Map();
    for (const [priorDelta, selections] of reachable) {
      for (const [delta, allowedStates] of choices) {
        const total = priorDelta + delta;
        if (total <= requiredDelta && !next.has(total)) {
          next.set(total, [...selections, allowedStates]);
        }
      }
    }
    reachable = next;
  }
  const selection = reachable.get(requiredDelta);
  assert.ok(selection, `No frozen lifecycle-policy carrier reaches ${targetBytes} bytes.`);
  artifact.rules = ruleIdentifiers.map((identifier, index) => rule(
    identifier,
    "memoryos.require-lifecycle-state",
    { allowedStates: selection[index] },
  ));
  assert.equal(canonicalizeRestrictedJson(artifact).length, targetBytes);
  const prepared = preparePolicy(artifact);
  assert.equal(prepared.semanticBytes().length, targetBytes);
  exactMaximumPolicy = artifact;
  return clone(exactMaximumPolicy);
}

function solveExtensionNameLengths(delta) {
  if (delta === 0) return [];
  for (let count = 1; count <= 64; count += 1) {
    const nameBytes = delta - (3 * count) + 1;
    if (nameBytes < 5 * count || nameBytes > 256 * count) continue;
    const lengths = Array(count).fill(5);
    let remaining = nameBytes - (5 * count);
    for (let index = 0; index < count && remaining > 0; index += 1) {
      const addition = Math.min(251, remaining);
      lengths[index] += addition;
      remaining -= addition;
    }
    if (remaining === 0) return lengths;
  }
  assert.fail(`No optional-extension name construction reaches delta ${delta}.`);
}

function extensionNameOfLength(length, index) {
  const labelCount = Math.max(3, Math.ceil((length + 1) / 64));
  const lengths = Array(labelCount).fill(1);
  let remaining = length - (labelCount - 1) - labelCount;
  for (let label = 0; label < labelCount && remaining > 0; label += 1) {
    const addition = Math.min(62, remaining);
    lengths[label] += addition;
    remaining -= addition;
  }
  assert.equal(remaining, 0);
  const token = `x${index.toString(36)}`;
  assert.ok(lengths[0] >= token.length);
  const labels = lengths.map((labelLength, label) => {
    if (label === 0) return token + "a".repeat(labelLength - token.length);
    return String.fromCharCode(98 + (label % 24)).repeat(labelLength);
  });
  const name = labels.join(".");
  assert.equal(name.length, length);
  return name;
}

async function mipContextWithCanonicalBytes(targetBytes) {
  const source = JSON.parse(await readFile(new URL(
    "../examples/ai-runtime-adapters/reference-packages/anthropic-reference.mip",
    import.meta.url,
  ), "utf8"));
  const baseCanonicalBytes = 5655;
  const lengths = solveExtensionNameLengths(targetBytes - baseCanonicalBytes);
  const names = lengths.map((length, index) => extensionNameOfLength(length, index));
  const extensions = Object.fromEntries(names.map((name) => [name, {
    critical: false,
    payload: {},
    version: "1.0.0",
  }]));
  const bytes = exportMemoryInvestigationPackage({
    comparativeReconstructions: source.comparativeReconstructions,
    evolutions: source.evolutions,
    extensions,
    formatVersion: source.formatVersion,
    metadata: source.metadata,
    observations: source.observations,
    packageIdentifier: "p",
    replays: source.replays,
    sourceAccepted: true,
    sourceAuthorshipAttested: true,
    traces: source.traces,
    workspaceIdentifier: source.manifest.workspaceIdentifier,
  }, { supportedExtensions: names });
  const core = new InvestigationCore();
  const identifier = `mo1301-context-canonical-${targetBytes}`;
  core.import(bytes, { identifier, supportedExtensions: names });
  const context = capturePolicyFactContext(core, identifier);
  assert.equal(policyFactContextCanonicalBytes(context).length, targetBytes);
  return { context, core };
}

function transitionOnlyRegressionPair() {
  const core = new InvestigationCore();
  const baselineIdentifier = "mo1301-authoritative-transition-1-baseline";
  const candidateIdentifier = "mo1301-authoritative-transition-1-candidate";
  core.create({ identifier: baselineIdentifier, snapshot: clone(referenceSnapshot) });
  core.create({ identifier: candidateIdentifier, snapshot: clone(referenceSnapshot) });
  core.observe(candidateIdentifier, { snapshot: clone(referenceSnapshot) });
  return {
    core,
    ...capturePolicyFactContextAndRegressionSource(core, baselineIdentifier, candidateIdentifier),
  };
}

function verificationRegressionPair() {
  const core = new InvestigationCore();
  const baselineIdentifier = "mo1301-authoritative-verification-baseline";
  const candidateIdentifier = "mo1301-authoritative-verification-candidate";
  core.create({ identifier: baselineIdentifier, snapshot: clone(referenceSnapshot) });
  core.create({ identifier: candidateIdentifier, snapshot: clone(referenceSnapshot) });
  core.verify(candidateIdentifier);
  return {
    core,
    ...capturePolicyFactContextAndRegressionSource(core, baselineIdentifier, candidateIdentifier),
  };
}

test("all frozen Evaluation Identity and outcome golden vectors validate byte-for-byte", async () => {
  const fixture = await jsonFixture("final-evaluation-identity-outcome-golden-vectors.json");
  assert.equal(fixture.records.length, 17);
  assert.equal(fixture.resourceProfileDigest, MEMORYOS_POLICY_RESOURCE_PROFILE_DIGEST);
  for (const vector of fixture.records) {
    assert.equal(validateEvaluationIdentity(vector.logicalEvaluationIdentity), true, vector.recordId);
    assert.equal(validatePolicyEvaluationOutcome(vector.logicalOutcome), true, vector.recordId);
    const identityBytes = canonicalizeRestrictedJson(vector.logicalEvaluationIdentity);
    const outcomeBytes = canonicalizeRestrictedJson(vector.logicalOutcome);
    assert.deepEqual(identityBytes, encoder.encode(vector.canonicalIdentityBytes), vector.recordId);
    assert.deepEqual(outcomeBytes, encoder.encode(vector.canonicalOutcomeBytes), vector.recordId);
    assert.equal(identityBytes.length, vector.canonicalIdentityByteCount, vector.recordId);
    assert.equal(outcomeBytes.length, vector.canonicalOutcomeByteCount, vector.recordId);
    assert.equal(policyEvaluationIdentityDigest(vector.logicalEvaluationIdentity), vector.evaluationIdentityDigest);
    assert.equal(policyEvaluationOutcomeDigest(vector.logicalOutcome), vector.outcomeDigest);
  }
});

test("trusted native evaluation reproduces the frozen no-Regression vector", async () => {
  const golden = await jsonFixture("final-evaluation-identity-outcome-golden-vectors.json");
  const vector = golden.records.find(({ recordId }) => recordId === "vector-policy-native-no-regression");
  const { context, core } = nativeContext("investigation-native-reference");
  const prepared = preparePolicy(policy("d", [rule("a", "memoryos.require-mip-integrity")]));
  const result = evaluateInvestigationPolicy(createInvestigationPolicyEvaluator(core), prepared, context, []);
  assert.equal(isPreparedPolicyEvaluation(result), true);
  assert.equal(result.evaluationIdentityDigest, vector.evaluationIdentityDigest);
  assert.equal(result.outcomeDigest, vector.outcomeDigest);
  assert.deepEqual(result.evaluationIdentityBytes(), encoder.encode(vector.canonicalIdentityBytes));
  assert.deepEqual(result.canonicalOutcomeBytes(), encoder.encode(vector.canonicalOutcomeBytes));
  assert.deepEqual(result.outcome, vector.logicalOutcome);
});

test("trusted MIP evaluation reproduces the frozen lifecycle and aggregate-CNE vectors", async () => {
  const golden = await jsonFixture("final-evaluation-identity-outcome-golden-vectors.json");
  const mip = await activeMipContext();
  const cases = [
    [
      "vector-policy-mip",
      policy("f", [rule(
        "a",
        "memoryos.require-lifecycle-state",
        { allowedStates: ["Archived"] },
      )]),
    ],
    [
      "vector-completed-aggregate-cne",
      policy("p", [
        rule(
          "e",
          "memoryos.prohibit-regression-findings",
          { categories: REGISTERED_REGRESSION_CATEGORIES },
        ),
        rule("f", "memoryos.require-mip-integrity"),
      ]),
    ],
  ];
  for (const [recordId, artifact] of cases) {
    const vector = golden.records.find((record) => record.recordId === recordId);
    const evaluation = evaluate(mip.core, mip.context, artifact);
    assert.equal(evaluation.evaluationIdentityDigest, vector.evaluationIdentityDigest, recordId);
    assert.equal(evaluation.outcomeDigest, vector.outcomeDigest, recordId);
    assert.deepEqual(evaluation.evaluationIdentityBytes(), encoder.encode(vector.canonicalIdentityBytes), recordId);
    assert.deepEqual(evaluation.canonicalOutcomeBytes(), encoder.encode(vector.canonicalOutcomeBytes), recordId);
    assert.deepEqual(evaluation.outcome, vector.logicalOutcome, recordId);
  }
});

test("trusted retained CF5B-2 recipes reproduce every remaining golden vector family", async () => {
  const golden = await jsonFixture("final-evaluation-identity-outcome-golden-vectors.json");
  const vector = (recordId) => {
    const found = golden.records.find((record) => record.recordId === recordId);
    assert.ok(found, recordId);
    return found;
  };

  const mip = await floorMipImportedContext();
  assert.equal(
    policyFactContextDigest(mip.context),
    vector("vector-completed-pass").logicalEvaluationIdentity.policyFactContext.contextDigest,
  );
  const mipEvaluator = createInvestigationPolicyEvaluator(mip.core);
  const passRule = rule("e", "memoryos.require-mip-integrity");
  const passCases = [
    ["vector-completed-pass", policy("p", [passRule])],
    ["vector-metadata-a", policy("p", [passRule], { description: "x" })],
    ["vector-metadata-b", policy("p", [passRule], { description: "y" })],
    ["vector-resource-profile-binding", policy("p", [passRule], { description: "x" })],
  ];
  for (const [recordId, artifact] of passCases) {
    assertEvaluationMatchesVector(
      evaluateInvestigationPolicy(mipEvaluator, preparePolicy(artifact), mip.context, []),
      vector(recordId),
    );
  }

  const child = policy("a", [passRule]);
  const setCases = [
    ["vector-policy-set", policySet("s", [child])],
    ["vector-set-metadata-a", policySet("s", [child], { description: "x" })],
    ["vector-set-metadata-b", policySet("s", [child], { description: "y" })],
  ];
  for (const [recordId, artifact] of setCases) {
    assertEvaluationMatchesVector(
      evaluateInvestigationPolicy(mipEvaluator, prepareSet(artifact), mip.context, []),
      vector(recordId),
    );
  }

  const nativeFail = observationBoundaryContext(3);
  assert.equal(
    policyFactContextDigest(nativeFail.context),
    vector("vector-completed-fail").logicalEvaluationIdentity.policyFactContext.contextDigest,
  );
  assertEvaluationMatchesVector(
    evaluateInvestigationPolicy(
      createInvestigationPolicyEvaluator(nativeFail.core),
      preparePolicy(policy("p", [passRule])),
      nativeFail.context,
      [],
    ),
    vector("vector-completed-fail"),
  );

  const regression = evidenceAddedRegressionPair();
  assert.equal(
    policyFactContextDigest(regression.policyFactContext),
    vector("vector-policy-native-regression").logicalEvaluationIdentity.policyFactContext.contextDigest,
  );
  assertEvaluationMatchesVector(
    evaluateInvestigationPolicy(
      createInvestigationPolicyEvaluator(regression.core),
      preparePolicy(policy("a", [rule(
        "a",
        "memoryos.prohibit-regression-findings",
        { categories: REGISTERED_REGRESSION_CATEGORIES },
      )])),
      regression.policyFactContext,
      [regression.regressionPolicyFactSource],
    ),
    vector("vector-policy-native-regression"),
  );

  const resource = eightFindingRegressionPair();
  assert.equal(
    policyFactContextDigest(resource.policyFactContext),
    vector("vector-resource-limit-cne").logicalEvaluationIdentity.policyFactContext.contextDigest,
  );
  const resourceEvaluation = evaluateInvestigationPolicy(
    createInvestigationPolicyEvaluator(resource.core),
    preparePolicy(policy("p", [rule(
      "a",
      "memoryos.prohibit-regression-findings",
      { categories: ["replay", "transition"] },
    )])),
    resource.policyFactContext,
    [resource.regressionPolicyFactSource],
  );
  assertResourceResult(
    resourceEvaluation,
    "evaluation.selection-matched-fact-identifier-count",
  );
  assertEvaluationMatchesVector(resourceEvaluation, vector("vector-resource-limit-cne"));
});

test("all reachable truth rows for the six frozen rules have exact decisions and evidence", async () => {
  const initial = nativeContext("phase3-truth-initial");
  const completed = completedNativeContext();
  const mip = await activeMipContext();
  const identical = regressionPair("truth-identical", false);
  const changed = regressionPair("truth-changed", true);
  const cases = [
    [initial, rule("a", "memoryos.require-verification-completed"), [], "FAIL", "REQUIRE_VERIFICATION_COMPLETED_NOT_SATISFIED", "MemoryOSPolicyFactSelection"],
    [completed, rule("a", "memoryos.require-verification-completed"), [], "PASS", "REQUIRE_VERIFICATION_COMPLETED_SATISFIED", "MemoryOSPolicyFactReference"],
    [initial, rule("a", "memoryos.require-replay-completed"), [], "FAIL", "REQUIRE_REPLAY_COMPLETED_NOT_SATISFIED", "MemoryOSPolicyFactSelection"],
    [completed, rule("a", "memoryos.require-replay-completed"), [], "PASS", "REQUIRE_REPLAY_COMPLETED_SATISFIED", "MemoryOSPolicyFactReference"],
    [initial, rule("a", "memoryos.require-artifact-cardinality", { artifactClass: "evidence", minimumCount: 1 }), [], "PASS", "REQUIRE_ARTIFACT_CARDINALITY_SATISFIED", "MemoryOSPolicyFactSelection"],
    [initial, rule("a", "memoryos.require-artifact-cardinality", { artifactClass: "evidence", minimumCount: 9007199254740991 }), [], "FAIL", "REQUIRE_ARTIFACT_CARDINALITY_NOT_SATISFIED", "MemoryOSPolicyFactSelection"],
    [initial, rule("a", "memoryos.require-lifecycle-state", { allowedStates: ["Observed"] }), [], "PASS", "REQUIRE_LIFECYCLE_STATE_SATISFIED", "MemoryOSPolicyFactReference"],
    [initial, rule("a", "memoryos.require-lifecycle-state", { allowedStates: ["Verified"] }), [], "FAIL", "REQUIRE_LIFECYCLE_STATE_NOT_SATISFIED", "MemoryOSPolicyFactReference"],
    [initial, rule("a", "memoryos.prohibit-regression-findings", { categories: ["reflection"] }), [], "COULD_NOT_EVALUATE", "PROHIBIT_REGRESSION_FINDINGS_SOURCE_NOT_SUPPLIED", "MemoryOSDeterministicFactSourceAbsence"],
    [{ core: identical.core, context: identical.policyFactContext }, rule("a", "memoryos.prohibit-regression-findings", { categories: ["reflection"] }), [identical.regressionPolicyFactSource], "PASS", "PROHIBIT_REGRESSION_FINDINGS_SATISFIED", "MemoryOSPolicyFactSelection"],
    [{ core: changed.core, context: changed.policyFactContext }, rule("a", "memoryos.prohibit-regression-findings", { categories: ["reflection"] }), [changed.regressionPolicyFactSource], "FAIL", "PROHIBIT_REGRESSION_FINDINGS_NOT_SATISFIED", "MemoryOSPolicyFactSelection"],
    [{ core: changed.core, context: changed.policyFactContext }, rule("a", "memoryos.prohibit-regression-findings", { categories: ["replay"] }), [changed.regressionPolicyFactSource], "PASS", "PROHIBIT_REGRESSION_FINDINGS_SATISFIED", "MemoryOSPolicyFactSelection"],
    [initial, rule("a", "memoryos.require-mip-integrity"), [], "FAIL", "REQUIRE_MIP_INTEGRITY_NOT_SATISFIED", "MemoryOSPolicyFactDomainState"],
    [mip, rule("a", "memoryos.require-mip-integrity"), [], "PASS", "REQUIRE_MIP_INTEGRITY_SATISFIED", "MemoryOSPolicyFactReference"],
  ];
  for (let index = 0; index < cases.length; index += 1) {
    const [capture, frozenRule, sources, decision, decisionCode, evidenceKind] = cases[index];
    const result = evaluate(capture.core, capture.context, policy("p", [frozenRule]), sources);
    const row = result.outcome.result.ruleResults[0];
    assert.equal(row.decision, decision, `case ${index}`);
    assert.equal(row.decisionCode, decisionCode, `case ${index}`);
    assert.equal(row.evidence.length, 1, `case ${index}`);
    assert.equal(row.evidence[0].kind, evidenceKind, `case ${index}`);
    assert.equal(result.outcome.result.decision, decision, `case ${index}`);
  }
});

test("authoritative Replay ready, playing, and paused states deterministically FAIL completion", () => {
  const core = new InvestigationCore();
  const identifier = "phase3-replay-incomplete-states";
  const investigation = core.create({ identifier, snapshot: clone(referenceSnapshot) });
  core.trace(identifier, reflectionKey(investigation));
  const assertIncomplete = (expectedStatus) => {
    const context = capturePolicyFactContext(core, identifier);
    assert.equal(context.artifact.facts.activeReplay.items[0].value.status, expectedStatus);
    const evaluation = evaluate(
      core,
      context,
      policy("p", [rule("a", "memoryos.require-replay-completed")]),
    );
    const result = evaluation.outcome.result.ruleResults[0];
    assert.equal(result.decision, "FAIL");
    assert.equal(result.decisionCode, "REQUIRE_REPLAY_COMPLETED_NOT_SATISFIED");
    assert.equal(result.evidence[0].kind, "MemoryOSPolicyFactReference");
  };
  assertIncomplete("ready");
  core.replay(identifier, "play");
  assertIncomplete("playing");
  core.replay(identifier, "pause");
  assertIncomplete("paused");
});

test("Policy and Policy Set aggregation retains order and applies FAIL over CNE over PASS", () => {
  const { context, core } = nativeContext("phase3-aggregation");
  const combined = policy("p", [
    rule("a", "memoryos.require-lifecycle-state", { allowedStates: ["Observed"] }),
    rule("b", "memoryos.prohibit-regression-findings", { categories: ["replay"] }),
    rule("c", "memoryos.require-replay-completed"),
    rule("d", "memoryos.require-mip-integrity"),
  ]);
  const result = evaluate(core, context, combined);
  assert.equal(result.outcome.result.decision, "FAIL");
  assert.deepEqual(result.outcome.result.ruleResults.map(({ ruleIdentifier }) => ruleIdentifier), [
    "a", "b", "c", "d",
  ]);
  assert.deepEqual(result.outcome.result.ruleResults.map(({ decision }) => decision), [
    "PASS", "COULD_NOT_EVALUATE", "FAIL", "FAIL",
  ]);

  const pass = policy("a", [
    rule("a", "memoryos.require-lifecycle-state", { allowedStates: ["Observed"] }),
  ]);
  const cne = policy("b", [
    rule("a", "memoryos.prohibit-regression-findings", { categories: ["replay"] }),
  ]);
  const fail = policy("c", [rule("a", "memoryos.require-mip-integrity")]);
  const cneResult = evaluateInvestigationPolicy(
    createInvestigationPolicyEvaluator(core), prepareSet(policySet("s", [pass, cne])), context, [],
  );
  assert.equal(cneResult.outcome.result.decision, "COULD_NOT_EVALUATE");
  assert.deepEqual(cneResult.outcome.result.policyResults.map(({ policyIdentifier }) => policyIdentifier), ["a", "b"]);
  const failResult = evaluateInvestigationPolicy(
    createInvestigationPolicyEvaluator(core), prepareSet(policySet("t", [pass, cne, fail])), context, [],
  );
  assert.equal(failResult.outcome.result.decision, "FAIL");
  assert.deepEqual(failResult.outcome.result.policyResults.map(({ decision }) => decision), [
    "PASS", "COULD_NOT_EVALUATE", "FAIL",
  ]);
});

test("Policy and Policy Set aggregation exhaust the frozen two-result precedence matrix", () => {
  const { context, core } = nativeContext("phase3-aggregation-matrix");
  const rows = {
    C: rule("a", "memoryos.prohibit-regression-findings", { categories: ["replay"] }),
    F: rule("a", "memoryos.require-mip-integrity"),
    P: rule("a", "memoryos.require-lifecycle-state", { allowedStates: ["Observed"] }),
  };
  const cases = [
    ["P", "P", "PASS"],
    ["P", "F", "FAIL"],
    ["P", "C", "COULD_NOT_EVALUATE"],
    ["F", "C", "FAIL"],
    ["C", "C", "COULD_NOT_EVALUATE"],
  ];

  for (let index = 0; index < cases.length; index += 1) {
    const [left, right, expected] = cases[index];
    const policyResult = evaluate(core, context, policy("p", [
      { ...rows[left], identifier: "a" },
      { ...rows[right], identifier: "b" },
    ]));
    assert.equal(policyResult.outcome.result.decision, expected, `Policy ${left}+${right}`);
    assert.equal(policyResult.outcome.result.ruleResults.length, 2);

    const setResult = evaluateInvestigationPolicy(
      createInvestigationPolicyEvaluator(core),
      prepareSet(policySet("s", [
        policy("a", [{ ...rows[left], identifier: "a" }]),
        policy("b", [{ ...rows[right], identifier: "a" }]),
      ])),
      context,
      [],
    );
    assert.equal(setResult.outcome.result.decision, expected, `Policy Set ${left}+${right}`);
    assert.equal(setResult.outcome.result.policyResults.length, 2);
  }
});

test("metadata is non-semantic while transition-log state is evaluation-identifying", async () => {
  const capture = nativeContext("phase3-metadata");
  const evaluator = createInvestigationPolicyEvaluator(capture.core);
  const rules = [rule("a", "memoryos.require-mip-integrity")];
  const left = preparePolicy(policy("p", rules, { description: "x" }));
  const right = preparePolicy(policy("p", rules, { description: "y" }));
  assert.notEqual(left.documentDigest, right.documentDigest);
  assert.equal(left.semanticDigest, right.semanticDigest);
  const first = evaluateInvestigationPolicy(evaluator, left, capture.context, []);
  const second = evaluateInvestigationPolicy(evaluator, right, capture.context, []);
  assert.equal(first.evaluationIdentityDigest, second.evaluationIdentityDigest);
  assert.equal(first.outcomeDigest, second.outcomeDigest);
  assert.equal(second.cacheDisposition, "HIT_RETURN_EXACT_RETAINED_BYTES");

  const child = policy("a", [rule("a", "memoryos.require-mip-integrity")]);
  const leftSet = prepareSet(policySet("s", [child], { description: "x" }));
  const rightSet = prepareSet(policySet("s", [child], { description: "y" }));
  assert.notEqual(leftSet.documentDigest, rightSet.documentDigest);
  assert.equal(leftSet.semanticDigest, rightSet.semanticDigest);
  const firstSet = evaluateInvestigationPolicy(evaluator, leftSet, capture.context, []);
  const secondSet = evaluateInvestigationPolicy(evaluator, rightSet, capture.context, []);
  assert.equal(firstSet.evaluationIdentityDigest, secondSet.evaluationIdentityDigest);
  assert.equal(firstSet.outcomeDigest, secondSet.outcomeDigest);
  assert.equal(secondSet.cacheDisposition, "HIT_RETURN_EXACT_RETAINED_BYTES");

  const core = new InvestigationCore();
  const identifier = "cf5b2-point-in-time";
  core.create({ identifier, snapshot: clone(referenceSnapshot) });
  const before = capturePolicyFactContext(core, identifier);
  core.observe(identifier, {
    operation: "CF5B2AdditionalObservation",
    snapshot: clone(referenceSnapshot),
  });
  const after = capturePolicyFactContext(core, identifier);
  const prepared = preparePolicy(policy("a", [rule(
    "a", "memoryos.require-lifecycle-state", { allowedStates: REGISTERED_LIFECYCLE_STATES },
  )]));
  const transitionEvaluator = createInvestigationPolicyEvaluator(core);
  const beforeResult = evaluateInvestigationPolicy(transitionEvaluator, prepared, before, []);
  const afterResult = evaluateInvestigationPolicy(transitionEvaluator, prepared, after, []);
  const golden = await jsonFixture("final-evaluation-identity-outcome-golden-vectors.json");
  const beforeVector = golden.records.find(({ recordId }) => recordId === "vector-transition-before");
  const afterVector = golden.records.find(({ recordId }) => recordId === "vector-transition-after");
  assertEvaluationMatchesVector(beforeResult, beforeVector);
  assertEvaluationMatchesVector(afterResult, afterVector);
  assert.notEqual(beforeResult.evaluationIdentityDigest, afterResult.evaluationIdentityDigest);
});

test("different trusted Regression baselines change external-source, identity, and outcome bytes", async () => {
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
    core, "cf5b2-source-baseline-a", "cf5b2-source-candidate",
  );
  const second = capturePolicyFactContextAndRegressionSource(
    core, "cf5b2-source-baseline-b", "cf5b2-source-candidate",
  );
  assert.equal(policyFactContextDigest(first.policyFactContext), policyFactContextDigest(second.policyFactContext));
  const prepared = preparePolicy(policy("a", [rule(
    "a", "memoryos.prohibit-regression-findings", { categories: ["replay"] },
  )]));
  const evaluator = createInvestigationPolicyEvaluator(core);
  const left = evaluateInvestigationPolicy(
    evaluator, prepared, first.policyFactContext, [first.regressionPolicyFactSource],
  );
  const absent = evaluateInvestigationPolicy(evaluator, prepared, first.policyFactContext, []);
  const right = evaluateInvestigationPolicy(
    evaluator, prepared, second.policyFactContext, [second.regressionPolicyFactSource],
  );
  const golden = await jsonFixture("final-evaluation-identity-outcome-golden-vectors.json");
  const leftVector = golden.records.find(({ recordId }) => recordId === "vector-regression-source-control");
  const rightVector = golden.records.find(({ recordId }) => recordId === "vector-different-regression-source");
  assertEvaluationMatchesVector(left, leftVector);
  assertEvaluationMatchesVector(right, rightVector);
  assert.deepEqual(absent.outcome.evaluationIdentity.externalSources, []);
  assert.notEqual(absent.evaluationIdentityDigest, left.evaluationIdentityDigest);
  assert.notEqual(absent.outcomeDigest, left.outcomeDigest);
  assert.notDeepEqual(left.evaluationIdentityBytes(), right.evaluationIdentityBytes());
  assert.notDeepEqual(left.canonicalOutcomeBytes(), right.canonicalOutcomeBytes());
});

test("frozen cache vectors classify exactly and production hits return retained immutable bytes", async () => {
  const fixture = await jsonFixture("cache-validation-vectors.json");
  assert.equal(fixture.vectors.length, 10);
  for (const vector of fixture.vectors) {
    assert.equal(inspectDetachedPolicyEvaluationCacheVector(vector), vector.expected, vector.vectorId);
    assert.equal(vector.observed, vector.expected, vector.vectorId);
  }
  const exact = fixture.vectors.find(({ vectorId }) => vectorId === "exact-cache-hit");
  const wrongExistingIdentifier = exact.authoritativeInput.policyFactContext.facts.lifecycle
    .items[0].factIdentifier;
  for (const factIdentifier of [`sha256:${"0".repeat(64)}`, wrongExistingIdentifier]) {
    const tampered = clone(exact);
    const outcome = JSON.parse(tampered.retainedOutcomeBytes);
    outcome.result.ruleResults[0].evidence[0].factIdentifier = factIdentifier;
    assert.equal(validatePolicyEvaluationOutcome(outcome), true);
    tampered.retainedOutcomeBytes = new TextDecoder().decode(canonicalizeRestrictedJson(outcome));
    tampered.retainedOutcomeDigest = policyEvaluationOutcomeDigest(outcome);
    assert.equal(
      inspectDetachedPolicyEvaluationCacheVector(tampered),
      "MISS_RECOMPUTE_OUTCOME_SEMANTIC_MISMATCH",
    );
  }
  const { context, core } = nativeContext("phase3-cache");
  const prepared = preparePolicy(policy("p", [rule("a", "memoryos.require-mip-integrity")]));
  const evaluator = createInvestigationPolicyEvaluator(core);
  const miss = evaluateInvestigationPolicy(evaluator, prepared, context, []);
  assert.equal(miss.cacheDisposition, "MISS_RECOMPUTE");
  const identityBytes = miss.evaluationIdentityBytes();
  const outcomeBytes = miss.canonicalOutcomeBytes();
  identityBytes[0] ^= 0xff;
  outcomeBytes[0] ^= 0xff;
  const hit = evaluateInvestigationPolicy(evaluator, prepared, context, []);
  assert.equal(hit.cacheDisposition, "HIT_RETURN_EXACT_RETAINED_BYTES");
  assert.notEqual(hit.evaluationIdentityBytes()[0], identityBytes[0]);
  assert.notEqual(hit.canonicalOutcomeBytes()[0], outcomeBytes[0]);
  assert.equal(hit.evaluationIdentityDigest, miss.evaluationIdentityDigest);
  assert.equal(hit.outcomeDigest, miss.outcomeDigest);
});

test("authority precedes cache lookup and prepared/evaluator/evaluation capabilities cannot be forged", () => {
  const owner = nativeContext("phase3-authority-owner");
  const prepared = preparePolicy(policy("p", [rule("a", "memoryos.require-mip-integrity")]));
  const evaluator = createInvestigationPolicyEvaluator(owner.core);
  const warm = evaluateInvestigationPolicy(evaluator, prepared, owner.context, []);
  assert.equal(warm.cacheDisposition, "MISS_RECOMPUTE");
  assert.throws(() => new prepared.constructor(), TypeError);
  assert.throws(() => new evaluator.constructor(), TypeError);
  assert.throws(() => new warm.constructor(), TypeError);
  assert.equal(Object.isFrozen(Object.getPrototypeOf(prepared)), true);
  assert.equal(Object.isFrozen(Object.getPrototypeOf(evaluator)), true);
  assert.equal(Object.isFrozen(Object.getPrototypeOf(warm)), true);
  assert.throws(() => evaluateInvestigationPolicy({}, prepared, owner.context, []), TypeError);
  assert.throws(() => evaluateInvestigationPolicy(
    evaluator, structuredClone(prepared), owner.context, [],
  ));
  assert.throws(() => evaluateInvestigationPolicy(evaluator, new Proxy(prepared, {}), owner.context, []));
  assertPolicyError(
    () => evaluateInvestigationPolicy(evaluator, prepared, clone(owner.context.artifact), []),
    "POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED",
  );
  const foreign = nativeContext("phase3-authority-foreign");
  assertPolicyError(
    () => evaluateInvestigationPolicy(evaluator, prepared, foreign.context, []),
    "POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED",
  );

  const pair = regressionPair("authority-source", false);
  const sourceEvaluator = createInvestigationPolicyEvaluator(pair.core);
  const sourcePolicy = preparePolicy(policy("q", [rule(
    "a", "memoryos.prohibit-regression-findings", { categories: ["replay"] },
  )]));
  evaluateInvestigationPolicy(
    sourceEvaluator, sourcePolicy, pair.policyFactContext, [pair.regressionPolicyFactSource],
  );
  const wrongContext = capturePolicyFactContext(pair.core, "phase3-authority-source-baseline");
  assertPolicyError(
    () => evaluateInvestigationPolicy(
      sourceEvaluator, sourcePolicy, wrongContext, [pair.regressionPolicyFactSource],
    ),
    "REGRESSION_POLICY_FACT_SOURCE_CANDIDATE_BINDING_MISMATCH",
  );
  assert.throws(() => evaluateInvestigationPolicy(
    sourceEvaluator,
    sourcePolicy,
    pair.policyFactContext,
    [structuredClone(pair.regressionPolicyFactSource)],
  ));
  let untrustedGetterReads = 0;
  const untrustedSource = {};
  Object.defineProperty(untrustedSource, "domain", {
    enumerable: true,
    get() {
      untrustedGetterReads += 1;
      return "cognitiveRegression";
    },
  });
  assertPolicyError(
    () => evaluateInvestigationPolicy(
      sourceEvaluator,
      sourcePolicy,
      pair.policyFactContext,
      [untrustedSource],
    ),
    "DETERMINISTIC_FACT_SOURCE_PROVENANCE_UNTRUSTED",
  );
  assert.equal(untrustedGetterReads, 0);
});

test("captured intrinsics prevent prototype poisoning from splitting semantics or Core head binding", () => {
  const value = policy("p", [rule("a", "memoryos.require-mip-integrity")]);
  const expected = preparePolicy(value);
  const expectedBytes = expected.canonicalBytes();

  const originalSlice = Uint8Array.prototype.slice;
  Uint8Array.prototype.slice = function poisonedSlice() { return this; };
  try {
    const exposed = expected.canonicalBytes();
    exposed[0] ^= 0xff;
  } finally {
    Uint8Array.prototype.slice = originalSlice;
  }
  assert.deepEqual(expected.canonicalBytes(), expectedBytes);

  const setValue = policySet("s", [value]);
  const expectedSet = prepareSet(setValue);
  const originalValues = Object.values;
  let valuesPrepared;
  Object.values = () => [];
  try {
    valuesPrepared = prepareSet(setValue);
  } finally {
    Object.values = originalValues;
  }
  assert.equal(valuesPrepared.artifact.policies.length, 1);
  assert.equal(valuesPrepared.artifact.policies[0].expectedSemanticDigest, expected.semanticDigest);
  assert.equal(valuesPrepared.semanticDigest, expectedSet.semanticDigest);
  assert.deepEqual(valuesPrepared.semanticBytes(), expectedSet.semanticBytes());

  const originalMap = Array.prototype.map;
  let mapPrepared;
  Array.prototype.map = () => [];
  try {
    mapPrepared = preparePolicy(value);
  } finally {
    Array.prototype.map = originalMap;
  }
  assert.equal(mapPrepared.semanticDigest, expected.semanticDigest);
  assert.deepEqual(mapPrepared.semanticBytes(), expected.semanticBytes());

  const core = new InvestigationCore();
  core.create({ identifier: "phase3-poisoned-head", snapshot: clone(referenceSnapshot) });
  const authoritative = core.load("phase3-poisoned-head");
  const actualHead = authoritative.transitionLog.transitions[
    authoritative.transitionLog.transitions.length - 1
  ].identifier;
  const first = authoritative.transitionLog.transitions[0].identifier;
  assert.notEqual(first, actualHead);
  const originalAt = Array.prototype.at;
  let context;
  Array.prototype.at = function poisonedAt() { return this[0]; };
  try {
    context = capturePolicyFactContext(core, "phase3-poisoned-head");
  } finally {
    Array.prototype.at = originalAt;
  }
  assert.equal(context.artifact.transitionLog.headTransitionIdentifier, actualHead);
  assert.notEqual(context.artifact.transitionLog.headTransitionIdentifier, first);
});

test("Phase H enforces the exact 16383/16384/16385 canonical-input boundary", async () => {
  const artifact = exactSemanticBytePolicy(1024);
  const prepared = preparePolicy(artifact);
  assert.equal(prepared.semanticBytes().length, 1024);
  for (const [contextBytes, inputBytes] of [[15359, 16383], [15360, 16384]]) {
    const { context, core } = await mipContextWithCanonicalBytes(contextBytes);
    assert.equal(prepared.semanticBytes().length + policyFactContextCanonicalBytes(context).length, inputBytes);
    const evaluation = evaluateInvestigationPolicy(
      createInvestigationPolicyEvaluator(core), prepared, context, [],
    );
    assert.equal(isPreparedPolicyEvaluation(evaluation), true);
  }
  const above = await mipContextWithCanonicalBytes(15361);
  assert.equal(
    prepared.semanticBytes().length + policyFactContextCanonicalBytes(above.context).length,
    16385,
  );
  assertPolicyError(
    () => evaluateInvestigationPolicy(
      createInvestigationPolicyEvaluator(above.core), prepared, above.context, [],
    ),
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    "evaluation.input-canonical-bytes",
  );
});

test("Phase H enforces exact 3/4/5 rule and 15/16/17 selector-visit boundaries", () => {
  const { context, core } = nativeContext("phase3-limit-26");
  const three = policy("a", [
    rule("a", "memoryos.require-mip-integrity"),
    rule("b", "memoryos.require-mip-integrity"),
    rule("c", "memoryos.require-mip-integrity"),
  ]);
  const four = policy("a", [
    rule("a", "memoryos.require-mip-integrity"),
    rule("b", "memoryos.require-mip-integrity"),
    rule("c", "memoryos.require-mip-integrity"),
    rule("d", "memoryos.require-mip-integrity"),
  ]);
  assert.equal(evaluate(core, context, three).outcome.result.ruleResults.length, 3);
  assert.equal(evaluate(core, context, four).outcome.result.ruleResults.length, 4);
  const fifth = policy("b", [
    rule("a", "memoryos.require-lifecycle-state", { allowedStates: ["Observed"] }),
  ]);
  const overRules = prepareSet(policySet("s", [four, fifth]));
  assertPolicyError(
    () => evaluateInvestigationPolicy(
      createInvestigationPolicyEvaluator(core), overRules, context, [],
    ),
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    "evaluation.rule-evaluation-count",
  );

  const contextWithObservations = (count) => {
    const visitCore = new InvestigationCore();
    const identifier = `phase3-limit-27-${count}`;
    for (let index = 0; index < count; index += 1) {
      const snapshot = clone(referenceSnapshot);
      snapshot.observationIdentifier = `phase3-limit-27-${count}-${index}`;
      if (index === 0) visitCore.create({ identifier, snapshot });
      else visitCore.observe(identifier, { operation: `Observation${index}`, snapshot });
    }
    return { context: capturePolicyFactContext(visitCore, identifier), core: visitCore };
  };
  const below = contextWithObservations(3);
  const exact = contextWithObservations(4);
  assert.equal(below.context.artifact.facts.artifactCardinalities.items.length, 12);
  assert.equal(exact.context.artifact.facts.artifactCardinalities.items.length, 16);

  const cardinality = rule(
    "a", "memoryos.require-artifact-cardinality", { artifactClass: "evidence", minimumCount: 1 },
  );
  const lifecycle = (identifier) => rule(
    identifier, "memoryos.require-lifecycle-state", { allowedStates: ["Observed"] },
  );
  const fifteenVisits = policy("p", [cardinality, lifecycle("b"), lifecycle("c"), lifecycle("d")]);
  assert.equal(12 + 1 + 1 + 1, 15);
  assert.equal(isPreparedPolicyEvaluation(evaluate(below.core, below.context, fifteenVisits)), true);

  const sixteenVisits = policy("p", [cardinality]);
  assert.equal(isPreparedPolicyEvaluation(evaluate(exact.core, exact.context, sixteenVisits)), true);

  const seventeenVisits = policy("p", [cardinality, lifecycle("b")]);
  assertPolicyError(
    () => evaluate(exact.core, exact.context, seventeenVisits),
    "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED",
    "evaluation.selector-candidate-visit-count",
  );
  assert.equal(16 + 1, 17);
});

test("Phase I enforces exact 3/4/5 per-selection and aggregate identifier boundaries", () => {
  const changed = regressionPair("resource", true);
  const findingCounts = Object.fromEntries(REGISTERED_REGRESSION_CATEGORIES.map((category) => [
    category,
    changed.regressionPolicyFactSource.artifact.facts.findings.filter(
      ({ subject }) => subject.category === category,
    ).length,
  ]));
  assert.deepEqual(findingCounts, {
    evidence: 1,
    evolution: 3,
    lifecycle: 0,
    reflection: 1,
    replay: 0,
    retrieval: 1,
    transition: 1,
    verification: 0,
  });

  const selectionCases = [
    [["evolution"], 3],
    [["reflection", "evolution"], 4],
  ];
  for (const [categories, expected] of selectionCases) {
    const evaluation = evaluate(
      changed.core,
      changed.policyFactContext,
      policy("p", [rule("a", "memoryos.prohibit-regression-findings", { categories })]),
      [changed.regressionPolicyFactSource],
    );
    const evidence = evaluation.outcome.result.ruleResults[0].evidence[0];
    assert.equal(evidence.matchCount, expected);
    assert.equal(evidence.matchedFactIdentifiers.length, expected);
    assert.equal(evidenceFactIdentifierCount(evaluation.outcome.result), expected);
  }

  const fiveInOneSelection = evaluate(
    changed.core,
    changed.policyFactContext,
    policy("p", [rule(
      "a",
      "memoryos.prohibit-regression-findings",
      { categories: ["reflection", "evidence", "evolution"] },
    )]),
    [changed.regressionPolicyFactSource],
  );
  assert.equal(findingCounts.reflection + findingCounts.evidence + findingCounts.evolution, 5);
  assertResourceResult(
    fiveInOneSelection,
    "evaluation.selection-matched-fact-identifier-count",
  );

  const fiveAcrossSelections = evaluate(
    changed.core,
    changed.policyFactContext,
    policy("p", [
      rule("a", "memoryos.prohibit-regression-findings", { categories: ["evolution"] }),
      rule("b", "memoryos.prohibit-regression-findings", { categories: ["reflection", "evidence"] }),
    ]),
    [changed.regressionPolicyFactSource],
  );
  assert.equal(findingCounts.evolution + findingCounts.reflection + findingCounts.evidence, 5);
  assertResourceResult(fiveAcrossSelections, "evaluation.evidence-fact-identifier-count");
});

test("Phase I enforces the exact 1023/1024/1025 aggregate evidence-byte boundary", () => {
  const captured = transitionOnlyRegressionPair();
  assert.equal(
    captured.policyFactContext.contextDigest,
    "sha256:705f79d4f8f7dc45e0c2e55509ce45bf8cfc54a31762e51860540581eeb551a1",
  );
  assert.equal(
    captured.regressionPolicyFactSource.sourceDigest,
    "sha256:ac75f4079a8ca77d240eb9ee90f32462bd0d0bb10fe9bfcc746976cf99c7147c",
  );
  const source = [captured.regressionPolicyFactSource];
  const categoryPairs = [
    [
      ["reflection", "retrieval", "evolution", "verification"],
      ["reflection", "evidence", "retrieval", "evolution", "verification", "transition", "lifecycle"],
      1023,
    ],
    [
      ["replay", "evidence", "retrieval", "evolution"],
      REGISTERED_REGRESSION_CATEGORIES,
      1024,
    ],
  ];
  for (const [firstCategories, secondCategories, expectedBytes] of categoryPairs) {
    const evaluation = evaluate(
      captured.core,
      captured.policyFactContext,
      policy("p", [
        rule("a", "memoryos.prohibit-regression-findings", { categories: firstCategories }),
        rule("b", "memoryos.prohibit-regression-findings", { categories: secondCategories }),
      ]),
      source,
    );
    assert.equal(evidenceCanonicalByteCount(evaluation.outcome.result), expectedBytes);
  }

  const firstCategories = ["replay", "reflection", "evidence", "retrieval"];
  const secondCategories = REGISTERED_REGRESSION_CATEGORIES;
  const individualBytes = [firstCategories, secondCategories].reduce((total, categories, index) => {
    const evaluation = evaluate(
      captured.core,
      captured.policyFactContext,
      policy("p", [rule(
        index === 0 ? "a" : "b",
        "memoryos.prohibit-regression-findings",
        { categories },
      )]),
      source,
    );
    return total + evidenceCanonicalByteCount(evaluation.outcome.result);
  }, 0);
  assert.equal(individualBytes, 1025);
  const above = evaluate(
    captured.core,
    captured.policyFactContext,
    policy("p", [
      rule("a", "memoryos.prohibit-regression-findings", { categories: firstCategories }),
      rule("b", "memoryos.prohibit-regression-findings", { categories: secondCategories }),
    ]),
    source,
  );
  assertResourceResult(above, "evaluation.evidence-canonical-bytes");
});

test("limit 31 admits the production 4059/4060 maximum and freezes 4061 as unreachable", () => {
  const captured = verificationRegressionPair();
  const children = [
    policy("pa", [rule("ra", "memoryos.require-mip-integrity")]),
    policy("pb", [rule("rb", "memoryos.require-mip-integrity")]),
    policy("pc", [rule("rc", "memoryos.require-verification-completed")]),
    policy("pd", [rule("rd", "memoryos.require-verification-completed")]),
  ];
  const evaluator = createInvestigationPolicyEvaluator(captured.core);
  const evaluateSet = (identifier) => evaluateInvestigationPolicy(
    evaluator,
    prepareSet(policySet(identifier, children)),
    captured.policyFactContext,
    [captured.regressionPolicyFactSource],
  );
  const below = evaluateSet("s");
  const exact = evaluateSet("ss");
  assert.equal(below.outcome.result.kind, "MemoryOSPolicySetResult");
  assert.equal(exact.outcome.result.kind, "MemoryOSPolicySetResult");
  assert.equal(below.canonicalOutcomeBytes().length, 4059);
  assert.equal(exact.canonicalOutcomeBytes().length, 4060);
  assert.equal(exact.canonicalOutcomeBytes().length, LIMITS["evaluation.outcome-canonical-bytes"]);

  const frozenAboveProof = Object.freeze({
    classification: "UNREACHABLE_BECAUSE_EXACT_GLOBAL_U_EQUALS_C31",
    exactReachableUpperBound: 4060,
    targetCanonicalOutcomeByteCount: 4061,
    upperBoundProofDigest: "sha256:8ea7cb379aef94b5543f6ff5df557967cd9a3817686d2d38d48c032b9981363c",
  });
  assert.equal(frozenAboveProof.exactReachableUpperBound, LIMITS["evaluation.outcome-canonical-bytes"]);
  assert.equal(
    frozenAboveProof.targetCanonicalOutcomeByteCount,
    frozenAboveProof.exactReachableUpperBound + 1,
  );
  assert.equal(frozenAboveProof.classification, "UNREACHABLE_BECAUSE_EXACT_GLOBAL_U_EQUALS_C31");
  assert.match(frozenAboveProof.upperBoundProofDigest, /^sha256:[0-9a-f]{64}$/);
});

test("frozen Phase H/I proofs and non-recursive limit-31 closure bind the profile", async () => {
  const manifest = await jsonFixture("boundary-v2-manifest.json");
  const proofs = await jsonFixture("boundary-v2-ceiling-proofs.json");
  const expectedLimits = [
    [25, "evaluation.input-canonical-bytes", 16384, "H"],
    [26, "evaluation.rule-evaluation-count", 4, "H"],
    [27, "evaluation.selector-candidate-visit-count", 16, "H"],
    [28, "evaluation.selection-matched-fact-identifier-count", 4, "I"],
    [29, "evaluation.evidence-fact-identifier-count", 4, "I"],
    [30, "evaluation.evidence-canonical-bytes", 1024, "I"],
  ];
  for (const [index, limitIdentifier, candidate, phase] of expectedLimits) {
    const entry = manifest.registry.find((item) => item.index === index);
    assert.deepEqual([entry.limitIdentifier, entry.candidate, entry.phase], [
      limitIdentifier, candidate, phase,
    ]);
    assert.equal(LIMITS[limitIdentifier], candidate);
    const maximum = manifest.observations.find(
      ({ group, limitIdentifier: value }) => group === "maximum" && value === limitIdentifier,
    );
    assert.equal(maximum.expectedCode, phase === "H"
      ? "POLICY_INPUT_RESOURCE_LIMIT_EXCEEDED"
      : "POLICY_EVALUATION_RESOURCE_LIMIT_EXCEEDED");
    const proof = proofs.ceilingProofs.find(
      ({ limitIdentifier: value }) => value === limitIdentifier,
    );
    assert.equal(proof.value, entry.upstreamCeiling);
  }

  assert.equal(LIMITS["evaluation.outcome-canonical-bytes"], 4060);
  const golden = await jsonFixture("final-evaluation-identity-outcome-golden-vectors.json");
  assert.ok(golden.records.every(
    ({ canonicalOutcomeByteCount }) => canonicalOutcomeByteCount <= 4060,
  ));
  const identity = clone(golden.records[0].logicalEvaluationIdentity);
  const resourceOutcome = {
    evaluationIdentity: identity,
    evaluationIdentityDigest: policyEvaluationIdentityDigest(identity),
    kind: "MemoryOSPolicyEvaluationOutcome",
    result: {
      code: "POLICY_EVALUATION_RESOURCE_LIMIT_EXCEEDED",
      configuredLimit: 4060,
      decision: "COULD_NOT_EVALUATE",
      kind: "MemoryOSPolicyEvaluationResourceLimitResult",
      limitIdentifier: "evaluation.outcome-canonical-bytes",
      observedAtLeast: 4061,
    },
    version: "1.0.0",
  };
  assert.equal(validatePolicyEvaluationOutcome(resourceOutcome), true);
  assert.ok(canonicalizeRestrictedJson(resourceOutcome).length <= 4060);
});

test("unsupported outcome version is rejected before root/identity cross-binding", async () => {
  const golden = await jsonFixture("final-evaluation-identity-outcome-golden-vectors.json");
  const outcome = clone(golden.records[0].logicalOutcome);
  outcome.version = "1.0.1";
  assert.throws(() => validatePolicyEvaluationOutcome(outcome), (error) => {
    assert.notEqual(error?.code, "POLICY_EVALUATION_OUTCOME_IDENTITY_MISMATCH");
    assert.match(error.message, /version is unsupported/);
    return true;
  });
});

test("outcome validation rejects unknown, mis-cardinalized, row-incompatible, and identity-unbound evidence", async () => {
  const golden = await jsonFixture("final-evaluation-identity-outcome-golden-vectors.json");
  const base = golden.records.find(
    ({ recordId }) => recordId === "vector-policy-native-no-regression",
  ).logicalOutcome;

  const unknown = clone(base);
  unknown.result.ruleResults[0].evidence[0].kind = "MemoryOSUnknownEvidence";
  assert.throws(() => validatePolicyEvaluationOutcome(unknown));

  const wrongCardinality = clone(base);
  wrongCardinality.result.ruleResults[0].evidence = [];
  assert.throws(() => validatePolicyEvaluationOutcome(wrongCardinality));

  const wrongVariant = clone(base);
  wrongVariant.result.ruleResults[0].evidence = [{
    domain: "mipIntegrity",
    factIdentifier: `sha256:${"0".repeat(64)}`,
    kind: "MemoryOSPolicyFactReference",
    source: {
      contextDigest: wrongVariant.evaluationIdentity.policyFactContext.contextDigest,
      kind: "policyFactContext",
    },
  }];
  assert.throws(() => validatePolicyEvaluationOutcome(wrongVariant));

  const wrongCoreIdentity = clone(base);
  wrongCoreIdentity.result.ruleResults[0].evidence[0].source.contextDigest =
    `sha256:${"0".repeat(64)}`;
  assert.throws(() => validatePolicyEvaluationOutcome(wrongCoreIdentity));
  assert.throws(() => policyEvaluationOutcomeDigest(wrongCoreIdentity));

  const external = clone(golden.records.find(
    ({ recordId }) => recordId === "vector-policy-native-regression",
  ).logicalOutcome);
  const externalEvidence = external.result.ruleResults.find(
    ({ ruleType }) => ruleType === "memoryos.prohibit-regression-findings",
  ).evidence[0];
  externalEvidence.source.externalSourceDigest = `sha256:${"0".repeat(64)}`;
  assert.throws(() => validatePolicyEvaluationOutcome(external));

  const externalReference = clone(golden.records.find(
    ({ recordId }) => recordId === "vector-policy-native-regression",
  ).logicalOutcome);
  const selection = externalReference.result.ruleResults[0].evidence[0];
  externalReference.result.ruleResults[0].evidence[0] = {
    domain: "cognitiveRegression",
    factDomain: "findings",
    factIdentifier: selection.matchedFactIdentifiers[0],
    kind: "MemoryOSPolicyFactReference",
    source: clone(selection.source),
  };
  assert.throws(() => validatePolicyEvaluationOutcome(externalReference), {
    message: /Rule evidence does not match its frozen rule-model decision row/,
  });
  const missingFactDomain = clone(externalReference);
  delete missingFactDomain.result.ruleResults[0].evidence[0].factDomain;
  assert.throws(() => validatePolicyEvaluationOutcome(missingFactDomain), {
    message: /Fact-reference evidence shape is invalid/,
  });
  const openReference = clone(externalReference);
  openReference.result.ruleResults[0].evidence[0].extra = true;
  assert.throws(() => validatePolicyEvaluationOutcome(openReference), {
    message: /Fact-reference evidence shape is invalid/,
  });
});

test("detached completed outcomes cannot bypass post-identity limits 28 through 31", async () => {
  const golden = await jsonFixture("final-evaluation-identity-outcome-golden-vectors.json");
  const externalBase = golden.records.find(
    ({ recordId }) => recordId === "vector-policy-native-regression",
  ).logicalOutcome;
  const digest = (index) => `sha256:${index.toString(16).padStart(64, "0")}`;

  const limit28 = clone(externalBase);
  const selection28 = limit28.result.ruleResults[0].evidence[0];
  selection28.matchedFactIdentifiers = Array.from({ length: 5 }, (_, index) => digest(index));
  selection28.matchCount = 5;

  const limit29 = clone(externalBase);
  const selection29 = limit29.result.ruleResults[0].evidence[0];
  selection29.matchedFactIdentifiers = Array.from({ length: 4 }, (_, index) => digest(index));
  selection29.matchCount = 4;
  limit29.result.ruleResults.push({
    decision: "PASS",
    decisionCode: "REQUIRE_LIFECYCLE_STATE_SATISFIED",
    evidence: [{
      domain: "lifecycle",
      factIdentifier: digest(9),
      kind: "MemoryOSPolicyFactReference",
      source: {
        contextDigest: limit29.evaluationIdentity.policyFactContext.contextDigest,
        kind: "policyFactContext",
      },
    }],
    ruleIdentifier: "b",
    ruleType: "memoryos.require-lifecycle-state",
    ruleVersion: "1.0.0",
  });

  const limit30 = clone(externalBase);
  const selection30 = limit30.result.ruleResults[0].evidence[0];
  selection30.matchedFactIdentifiers = [];
  selection30.matchCount = 0;
  limit30.result.ruleResults[0].decision = "PASS";
  limit30.result.ruleResults[0].decisionCode = "PROHIBIT_REGRESSION_FINDINGS_SATISFIED";
  limit30.result.ruleResults = ["a", "b", "c"].map((ruleIdentifier) => ({
    ...clone(limit30.result.ruleResults[0]),
    ruleIdentifier,
  }));
  limit30.result.decision = "PASS";

  const limit31 = clone(golden.records.find(
    ({ recordId }) => recordId === "vector-policy-native-no-regression",
  ).logicalOutcome);
  limit31.result.policyIdentifier = "x".repeat(5000);

  for (const outcome of [limit28, limit29, limit30, limit31]) {
    assert.throws(() => validatePolicyEvaluationOutcome(outcome));
    assert.throws(() => policyEvaluationOutcomeDigest(outcome));
  }
});

test("a detached five-rule result cannot claim an identity that Phase H could never form", async () => {
  const golden = await jsonFixture("final-evaluation-identity-outcome-golden-vectors.json");
  const outcome = clone(golden.records.find(
    ({ recordId }) => recordId === "vector-completed-aggregate-cne",
  ).logicalOutcome);
  const cne = outcome.result.ruleResults.find(
    ({ decision }) => decision === "COULD_NOT_EVALUATE",
  );
  outcome.result.ruleResults = ["a", "b", "c", "d", "e"].map(
    (ruleIdentifier) => ({ ...clone(cne), ruleIdentifier }),
  );
  outcome.result.decision = "COULD_NOT_EVALUATE";
  assert.ok(canonicalizeRestrictedJson(outcome).length < 4060);
  assert.throws(() => validatePolicyEvaluationOutcome(outcome));
  assert.throws(() => policyEvaluationOutcomeDigest(outcome));
});

test("detached validators reject Policy/Set rule totals and source-specific selection overclaims", async () => {
  const golden = await jsonFixture("final-evaluation-identity-outcome-golden-vectors.json");
  const digest = (index) => `sha256:${index.toString(16).padStart(64, "0")}`;

  const setOutcome = clone(golden.records.find(
    ({ recordId }) => recordId === "vector-policy-set",
  ).logicalOutcome);
  const child = setOutcome.result.policyResults[0];
  setOutcome.result.policyResults = [0, 1, 2, 3, 4].map((index) => ({
    ...clone(child),
    policyIdentifier: String.fromCharCode(97 + index),
    policySemanticDigest: digest(index + 1),
  }));
  assert.throws(() => validatePolicyEvaluationOutcome(setOutcome), {
    message: /Policy Set result is invalid/,
  });

  const external = clone(golden.records.find(
    ({ recordId }) => recordId === "vector-policy-native-regression",
  ).logicalOutcome);
  const externalSelection = external.result.ruleResults[0].evidence[0];
  externalSelection.matchedFactIdentifiers = Array.from({ length: 9 }, (_, index) => digest(index));
  externalSelection.matchCount = 9;
  assert.throws(() => validatePolicyEvaluationOutcome(external), {
    message: /Selection evidence cardinality is invalid/,
  });

  const native = nativeContext("phase3-detached-core-selection-cap");
  const completed = evaluate(native.core, native.context, policy("p", [rule(
    "a",
    "memoryos.require-artifact-cardinality",
    { artifactClass: "evidence", minimumCount: 1 },
  )]));
  const coreOverclaim = clone(completed.outcome);
  const coreSelection = coreOverclaim.result.ruleResults[0].evidence[0];
  coreSelection.matchedFactIdentifiers = Array.from({ length: 5 }, (_, index) => digest(index + 20));
  coreSelection.matchCount = 5;
  assert.throws(() => validatePolicyEvaluationOutcome(coreOverclaim), {
    message: /Selection evidence cardinality is invalid/,
  });
});

test("authoritative evaluation is invariant under post-import String, Array, RegExp, and typed-byte poisoning", () => {
  const native = nativeContext("phase3-evaluator-intrinsics");
  const nativePolicy = preparePolicy(policy("p", [
    rule("a", "memoryos.require-mip-integrity"),
  ]));
  const nativeEvaluator = createInvestigationPolicyEvaluator(native.core);
  const nativeBefore = evaluateInvestigationPolicy(
    nativeEvaluator,
    nativePolicy,
    native.context,
    [],
  );

  const regression = regressionPair("evaluator-intrinsics", true);
  const regressionPolicy = preparePolicy(policy("p", [rule(
    "a",
    "memoryos.prohibit-regression-findings",
    { categories: ["evidence"] },
  )]));
  const regressionEvaluator = createInvestigationPolicyEvaluator(regression.core);
  const regressionBefore = evaluateInvestigationPolicy(
    regressionEvaluator,
    regressionPolicy,
    regression.policyFactContext,
    [regression.regressionPolicyFactSource],
  );

  const originalArrayIsArray = Array.isArray;
  const originalString = globalThis.String;
  const originalRegExpExec = RegExp.prototype.exec;
  const originalRegExpTest = RegExp.prototype.test;
  const typedArrayPrototype = Object.getPrototypeOf(Uint8Array.prototype);
  const originalLength = Object.getOwnPropertyDescriptor(typedArrayPrototype, "length");
  let nativeAfter;
  let regressionAfter;
  try {
    globalThis.String = () => { throw new Error("poisoned global String"); };
    Array.isArray = () => false;
    RegExp.prototype.exec = () => { throw new Error("poisoned RegExp.prototype.exec"); };
    RegExp.prototype.test = () => false;
    Object.defineProperty(typedArrayPrototype, "length", {
      configurable: true,
      get() { return 0; },
    });
    nativeAfter = evaluateInvestigationPolicy(
      nativeEvaluator,
      nativePolicy,
      native.context,
      [],
    );
    regressionAfter = evaluateInvestigationPolicy(
      regressionEvaluator,
      regressionPolicy,
      regression.policyFactContext,
      [regression.regressionPolicyFactSource],
    );
  } finally {
    globalThis.String = originalString;
    Array.isArray = originalArrayIsArray;
    RegExp.prototype.exec = originalRegExpExec;
    RegExp.prototype.test = originalRegExpTest;
    Object.defineProperty(typedArrayPrototype, "length", originalLength);
  }

  for (const [before, after] of [
    [nativeBefore, nativeAfter],
    [regressionBefore, regressionAfter],
  ]) {
    assert.equal(after.cacheDisposition, "HIT_RETURN_EXACT_RETAINED_BYTES");
    assert.equal(after.evaluationIdentityDigest, before.evaluationIdentityDigest);
    assert.equal(after.outcomeDigest, before.outcomeDigest);
    assert.deepEqual(after.evaluationIdentityBytes(), before.evaluationIdentityBytes());
    assert.deepEqual(after.canonicalOutcomeBytes(), before.canonicalOutcomeBytes());
  }
});
