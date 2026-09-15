import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { referenceSnapshot } from "../web/data/studio-snapshot.js";
import {
  MEMORYOS_SDK_VERSION,
  MemoryOS,
  MemoryOSPolicyOperationalError,
  MemoryOSPolicyPreparationError,
} from "../web/js/memoryos-sdk.js";
import { canonicalizeRestrictedJson } from "../web/js/policy-canonical.js";
import {
  REGISTERED_LIFECYCLE_STATES,
  REGISTERED_REGRESSION_CATEGORIES,
} from "../web/js/investigation-policy-contracts.js";
import { inspectDetachedPolicyEvaluationCacheVector } from "../web/js/investigation-policy-engine.js";
import { exportMemoryInvestigationPackage } from "../web/js/memory-investigation-package.js";

const encoder = new TextEncoder();
const fixtureRoot = new URL("./fixtures/investigation-policy/1.0.0/", import.meta.url);
const clone = (value) => structuredClone(value);

function policy(identifier = "p", ruleType = "memoryos.require-verification-completed") {
  return {
    identifier,
    kind: "MemoryOSInvestigationPolicy",
    policyVersion: "1.0.0",
    rules: [{
      identifier: "r",
      parameters: ruleType === "memoryos.prohibit-regression-findings"
        ? { categories: ["reflection"] } : {},
      type: ruleType,
      version: "1.0.0",
    }],
    version: "1.0.0",
  };
}

function observed(memory, identifier, snapshot = referenceSnapshot) {
  return memory.observe(
    memory.openWorkspace(snapshot.workspaceIdentifier),
    clone(snapshot),
    { identifier },
  );
}

function changedSnapshot() {
  const snapshot = clone(referenceSnapshot);
  snapshot.observationIdentifier = "sdk-policy-changed-observation";
  snapshot.longTermMemory.entries[0].value = "sdk-policy-changed-value";
  return snapshot;
}

async function mipFixtureBytes() {
  const encoded = await readFile(new URL("./fixtures/mip/complete-investigation.mip.b64", import.meta.url), "ascii");
  return new Uint8Array(Buffer.from(encoded.trim(), "base64"));
}

function frozenRule(identifier, type, parameters = {}) {
  return { identifier, parameters, type, version: "1.0.0" };
}

function frozenPolicy(identifier, rules, metadata = undefined) {
  return {
    identifier,
    kind: "MemoryOSInvestigationPolicy",
    ...(metadata === undefined ? {} : { metadata }),
    policyVersion: "0.0.0",
    rules,
    version: "1.0.0",
  };
}

function frozenPolicySet(memory, identifier, policies, metadata = undefined) {
  return {
    identifier,
    kind: "MemoryOSInvestigationPolicySet",
    ...(metadata === undefined ? {} : { metadata }),
    policies: policies.map((child) => ({
      expectedSemanticDigest: memory.preparePolicy(canonicalizeRestrictedJson(child)).semanticDigest,
      policy: child,
    })),
    policySetVersion: "0.0.0",
    version: "1.0.0",
  };
}

function reflectionKey(investigation) {
  const node = investigation.view.currentFrame.world.nodes.find(
    ({ observationPath }) => observationPath === "Reflection.values[0]",
  ) ?? investigation.view.currentFrame.world.nodes.find(({ family }) => family === "Reflection");
  assert.ok(node);
  return node.key;
}

function completeReplay(investigation) {
  const replay = investigation.replay();
  let guard = 0;
  while (replay.state.status !== "completed") {
    replay.next();
    assert.ok((guard += 1) < 10_000);
  }
  return replay.investigation;
}

async function sourceMipValue(memory) {
  const verification = memory.verifyPackage(await mipFixtureBytes());
  assert.equal(verification.valid, true);
  assert.ok(verification.package);
  return verification.package.value;
}

async function floorMipContext(memory) {
  const packageValue = await sourceMipValue(memory);
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
  const investigation = memory.importPackage(bytes, { identifier: "i" });
  return { context: memory.capturePolicyFactContext(investigation), investigation };
}

async function activeMipContext(memory) {
  const packageValue = await sourceMipValue(memory);
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
  let investigation = memory.importPackage(bytes, { identifier: "i" });
  investigation = investigation.trace(trace.identifier);
  investigation = completeReplay(investigation);
  investigation.verify();
  return { context: memory.capturePolicyFactContext(investigation), investigation };
}

function observationBoundaryContext(memory, observationCount = 3) {
  const snapshotAt = (index) => {
    const snapshot = clone(referenceSnapshot);
    snapshot.observationIdentifier = `mo1301-boundary-observation-${index}`;
    snapshot.longTermMemory.entries[0].value = `Boundary observation ${index}.`;
    return snapshot;
  };
  const workspace = memory.openWorkspace(referenceSnapshot.workspaceIdentifier);
  let investigation = memory.observe(workspace, snapshotAt(1), {
    identifier: `mo1301-observation-boundary-${observationCount}`,
  });
  for (let index = 2; index <= observationCount; index += 1) {
    investigation = investigation.observe(snapshotAt(index));
  }
  return { context: memory.capturePolicyFactContext(investigation), investigation };
}

function evidenceAddedRegressionPair(memory) {
  const workspace = memory.openWorkspace(referenceSnapshot.workspaceIdentifier);
  const candidateSnapshot = clone(referenceSnapshot);
  candidateSnapshot.longTermMemory.entries.push({
    archived: false,
    identifier: "ltm-regression-added",
    value: "Added deterministic evidence.",
  });
  const baseline = memory.observe(workspace, clone(referenceSnapshot), {
    identifier: "evidence-added-baseline",
  });
  const candidate = memory.observe(workspace, candidateSnapshot, {
    identifier: "evidence-added-candidate",
  });
  return memory.captureRegressionPolicyFacts(baseline, candidate);
}

function eightFindingRegressionPair(memory) {
  const workspace = memory.openWorkspace(referenceSnapshot.workspaceIdentifier);
  const candidateSnapshot = clone(referenceSnapshot);
  candidateSnapshot.longTermMemory.entries[0].value = "Changed deterministic evidence.";
  const baseline = memory.observe(workspace, clone(referenceSnapshot), {
    identifier: "mo1301-authoritative-eight-baseline",
  });
  let candidate = memory.observe(workspace, candidateSnapshot, {
    identifier: "mo1301-authoritative-eight-candidate",
  });
  candidate = candidate.trace(reflectionKey(candidate));
  candidate.verify();
  return memory.captureRegressionPolicyFacts(baseline, candidate);
}

function assertSdkEvaluationMatchesVector(evaluation, vector) {
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
}

test("SDK 1.1 exposes only the frozen normative contract identity projection", () => {
  const memory = new MemoryOS();
  const identities = memory.policyContractIdentities();
  assert.equal(MEMORYOS_SDK_VERSION, "1.1.0");
  assert.deepEqual(identities, {
    kind: "MemoryOSPolicyContractIdentities",
    version: "1.0.0",
    evaluatorVersion: "1.0.0",
    factModel: {
      factModelVersion: "1.0.0",
      factModelDigest: "sha256:b36b9488161cb67d8e971e802d15ad76d662d46f96e1304182de343ba69ef7a8",
    },
    ruleRegistry: {
      ruleRegistryVersion: "1.0.0",
      ruleRegistryDigest: "sha256:aaa19116563d209f680b063cdccf49d899069683f9778271c4ca2c4559b94fd7",
    },
    deterministicFactSourceRegistry: {
      registryVersion: "1.0.0",
      registryDigest: "sha256:392d688acb866753c6ff85b7030131b38990b27d8a2a0ef6e8e052c8c4e048de",
      sources: [{
        domain: "cognitiveRegression",
        wireVersion: "1.0.0",
        sourceModelVersion: "1.0.0",
        sourceModelDigest: "sha256:e7d1fdf24758f2a0ac9ad609df578f95c058bf3cbab9f02a650f9cc12dab1c0d",
      }],
    },
    resourceProfile: {
      identifier: "memoryos.policy.resource-profile.standard",
      version: "1.0.0",
      resourceProfileDigest: "sha256:c091573dfd05481f5759ef077e15af16689382a7432fa546c6630c4caeaa5239",
    },
    outcomeContractVersion: "1.0.0",
  });
  assert.ok(Object.isFrozen(identities));
  assert.ok(Object.isFrozen(identities.deterministicFactSourceRegistry.sources));
});

test("Policy preparation retains exact immutable bytes and stable failures", () => {
  const memory = new MemoryOS();
  const bytes = canonicalizeRestrictedJson(policy());
  const prepared = memory.preparePolicy(bytes);
  assert.deepEqual(prepared.toBytes(), bytes);
  const first = prepared.toBytes();
  first[0] ^= 0xff;
  assert.deepEqual(prepared.toBytes(), bytes);
  assert.ok(Object.isFrozen(prepared));
  assert.match(prepared.documentDigest, /^sha256:[0-9a-f]{64}$/u);
  assert.match(prepared.semanticDigest, /^sha256:[0-9a-f]{64}$/u);

  assert.throws(
    () => memory.preparePolicy(encoder.encode("{")),
    (error) => error instanceof MemoryOSPolicyPreparationError
      && error.code === "POLICY_SYNTAX_INVALID"
      && error.phase === "policyArtifact",
  );
  assert.throws(() => memory.preparePolicy("not bytes"), TypeError);
});

test("authoritative native evaluation returns and verifies exact evaluator bytes", () => {
  const memory = new MemoryOS();
  const investigation = observed(memory, "sdk-policy-native");
  const context = memory.capturePolicyFactContext(investigation);
  const prepared = memory.preparePolicy(canonicalizeRestrictedJson(policy()));
  const evaluation = memory.evaluatePolicy(prepared, context);

  assert.equal(evaluation.decision, "FAIL");
  assert.equal(evaluation.outcome.result.decision, evaluation.decision);
  assert.match(evaluation.evaluationIdentityDigest, /^sha256:[0-9a-f]{64}$/u);
  assert.match(evaluation.outcomeDigest, /^sha256:[0-9a-f]{64}$/u);
  assert.deepEqual(
    canonicalizeRestrictedJson(evaluation.evaluationIdentity),
    evaluation.evaluationIdentityBytes(),
  );
  assert.deepEqual(canonicalizeRestrictedJson(evaluation.outcome), evaluation.canonicalOutcomeBytes());

  const identity = memory.verifyEvaluationIdentityArtifact(
    evaluation.evaluationIdentityBytes(), evaluation.evaluationIdentityDigest,
  );
  assert.equal(identity.verified, true);
  assert.equal(identity.verificationScope, "serializedArtifact");
  assert.equal(memory.verifyEvaluationIdentityForEvaluation(
    evaluation.evaluationIdentityBytes(), prepared, context,
  ).verificationScope, "authoritativeReconstruction");

  const outcome = memory.verifyPolicyEvaluationOutcomeArtifact(
    evaluation.canonicalOutcomeBytes(),
    {
      expectedEvaluationIdentityDigest: evaluation.evaluationIdentityDigest,
      expectedOutcomeDigest: evaluation.outcomeDigest,
    },
  );
  assert.equal(outcome.verified, true);
  assert.equal(outcome.decision, "FAIL");
  assert.equal(memory.verifyPolicyEvaluationOutcomeForEvaluation(
    evaluation.canonicalOutcomeBytes(), prepared, context,
    { expectedOutcomeDigest: evaluation.outcomeDigest },
  ).verificationScope, "authoritativeReconstruction");
});

test("serialized artifacts remain inspection-only and cannot restore authority", () => {
  const owner = new MemoryOS();
  const foreign = new MemoryOS();
  const investigation = observed(owner, "sdk-policy-authority");
  const context = owner.capturePolicyFactContext(investigation);
  const inspected = owner.inspectPolicyFactContext(context.toBytes(), {
    expectedContextDigest: context.contextDigest,
  });
  const prepared = owner.preparePolicy(canonicalizeRestrictedJson(policy("a")));

  assert.equal(inspected.authority, "inspectionOnly");
  assert.equal(inspected.contextDigest, context.contextDigest);
  assert.throws(() => owner.evaluatePolicy(prepared, inspected), (error) => (
    error instanceof MemoryOSPolicyPreparationError
      && error.code === "POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED"
  ));
  assert.throws(
    () => foreign.evaluatePolicy(prepared, context),
    (error) => error instanceof MemoryOSPolicyPreparationError
      && error.code === "POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED",
  );
});

test("prepared Policy content is transferable while Core authority remains owner-bound", () => {
  const preparingMemory = new MemoryOS();
  const evaluatingMemory = new MemoryOS();
  const prepared = preparingMemory.preparePolicy(canonicalizeRestrictedJson(policy("t")));
  const context = evaluatingMemory.capturePolicyFactContext(
    observed(evaluatingMemory, "sdk-policy-transfer"),
  );

  assert.equal(evaluatingMemory.evaluatePolicy(prepared, context).decision, "FAIL");
});

test("trusted Regression facts publish one context/source bundle and bind exact capability identity", () => {
  const memory = new MemoryOS();
  const baseline = observed(memory, "sdk-regression-baseline");
  const candidate = observed(memory, "sdk-regression-candidate", changedSnapshot());
  const facts = memory.captureRegressionPolicyFacts(baseline, candidate);
  const prepared = memory.preparePolicy(canonicalizeRestrictedJson(policy(
    "g",
    "memoryos.prohibit-regression-findings",
  )));
  const evaluation = memory.evaluatePolicy(prepared, facts.policyFactContext, {
    regressionSource: facts.regressionPolicyFactSource,
  });
  assert.equal(evaluation.evaluationIdentity.externalSources.length, 1);
  assert.equal(
    evaluation.evaluationIdentity.externalSources[0].sourceDigest,
    facts.regressionPolicyFactSource.sourceDigest,
  );
  const inspection = memory.inspectRegressionPolicyFactSource(
    facts.regressionPolicyFactSource.toBytes(),
    { expectedSourceDigest: facts.regressionPolicyFactSource.sourceDigest },
  );
  assert.equal(inspection.authority, "inspectionOnly");
  assert.throws(
    () => memory.evaluatePolicy(prepared, facts.policyFactContext, { regressionSource: inspection }),
    (error) => error instanceof MemoryOSPolicyPreparationError
      && error.code === "DETERMINISTIC_FACT_SOURCE_PROVENANCE_UNTRUSTED",
  );
  const otherContext = memory.capturePolicyFactContext(candidate);
  assert.throws(
    () => memory.evaluatePolicy(prepared, otherContext, {
      regressionSource: facts.regressionPolicyFactSource,
    }),
    (error) => error instanceof MemoryOSPolicyPreparationError
      && error.code === "REGRESSION_POLICY_FACT_SOURCE_CANDIDATE_BINDING_MISMATCH"
      && error.phase === "regressionPolicyFactSource",
  );
});

test("Policy Set evaluation shares the same owner-bound request and result contract", () => {
  const memory = new MemoryOS();
  const context = memory.capturePolicyFactContext(observed(memory, "sdk-set"));
  const child = policy("c");
  const preparedChild = memory.preparePolicy(canonicalizeRestrictedJson(child));
  const set = {
    identifier: "s",
    kind: "MemoryOSInvestigationPolicySet",
    policies: [{ expectedSemanticDigest: preparedChild.semanticDigest, policy: child }],
    policySetVersion: "1.0.0",
    version: "1.0.0",
  };
  const preparedSet = memory.preparePolicySet(canonicalizeRestrictedJson(set));
  const evaluation = memory.evaluatePolicySet(preparedSet, context);
  assert.equal(evaluation.outcome.result.kind, "MemoryOSPolicySetResult");
  assert.equal(evaluation.decision, "FAIL");
});

test("all 17 frozen CF6 identity/outcome records verify through SDK 1.1", async () => {
  const vectors = JSON.parse(await readFile(
    new URL("final-evaluation-identity-outcome-golden-vectors.json", fixtureRoot),
    "utf8",
  ));
  const memory = new MemoryOS();
  assert.equal(vectors.records.length, 17);
  for (const record of vectors.records) {
    const identityBytes = encoder.encode(record.canonicalIdentityBytes);
    const outcomeBytes = encoder.encode(record.canonicalOutcomeBytes);
    assert.equal(memory.verifyEvaluationIdentityArtifact(
      identityBytes, record.evaluationIdentityDigest,
    ).evaluationIdentityDigest, record.evaluationIdentityDigest, record.recordId);
    const verified = memory.verifyPolicyEvaluationOutcomeArtifact(outcomeBytes, {
      expectedIdentity: identityBytes,
      expectedOutcomeDigest: record.outcomeDigest,
    });
    assert.equal(verified.outcomeDigest, record.outcomeDigest, record.recordId);
    assert.deepEqual(verified.toBytes(), outcomeBytes, record.recordId);
  }
});

test("SDK 1.1 production capture and evaluation reproduce all 17 frozen vectors", async () => {
  const golden = JSON.parse(await readFile(
    new URL("final-evaluation-identity-outcome-golden-vectors.json", fixtureRoot),
    "utf8",
  ));
  const records = new Map(golden.records.map((record) => [record.recordId, record]));
  const reproduced = new Set();
  const match = (recordId, evaluation) => {
    const vector = records.get(recordId);
    assert.ok(vector, recordId);
    assertSdkEvaluationMatchesVector(evaluation, vector);
    reproduced.add(recordId);
  };

  {
    const memory = new MemoryOS();
    const context = memory.capturePolicyFactContext(observed(
      memory,
      "investigation-native-reference",
    ));
    const artifact = frozenPolicy("d", [frozenRule("a", "memoryos.require-mip-integrity")]);
    match(
      "vector-policy-native-no-regression",
      memory.evaluatePolicy(memory.preparePolicy(canonicalizeRestrictedJson(artifact)), context),
    );
  }

  {
    const memory = new MemoryOS();
    const { context } = await floorMipContext(memory);
    const passRule = frozenRule("e", "memoryos.require-mip-integrity");
    const policyCases = [
      ["vector-completed-pass", frozenPolicy("p", [passRule])],
      ["vector-metadata-a", frozenPolicy("p", [passRule], { description: "x" })],
      ["vector-metadata-b", frozenPolicy("p", [passRule], { description: "y" })],
      ["vector-resource-profile-binding", frozenPolicy("p", [passRule], { description: "x" })],
    ];
    for (const [recordId, artifact] of policyCases) {
      match(
        recordId,
        memory.evaluatePolicy(memory.preparePolicy(canonicalizeRestrictedJson(artifact)), context),
      );
    }
    const child = frozenPolicy("a", [passRule]);
    const setCases = [
      ["vector-policy-set", frozenPolicySet(memory, "s", [child])],
      ["vector-set-metadata-a", frozenPolicySet(memory, "s", [child], { description: "x" })],
      ["vector-set-metadata-b", frozenPolicySet(memory, "s", [child], { description: "y" })],
    ];
    for (const [recordId, artifact] of setCases) {
      match(
        recordId,
        memory.evaluatePolicySet(
          memory.preparePolicySet(canonicalizeRestrictedJson(artifact)),
          context,
        ),
      );
    }
  }

  {
    const memory = new MemoryOS();
    const { context } = await activeMipContext(memory);
    match(
      "vector-policy-mip",
      memory.evaluatePolicy(memory.preparePolicy(canonicalizeRestrictedJson(frozenPolicy(
        "f",
        [frozenRule("a", "memoryos.require-lifecycle-state", { allowedStates: ["Archived"] })],
      ))), context),
    );
    match(
      "vector-completed-aggregate-cne",
      memory.evaluatePolicy(memory.preparePolicy(canonicalizeRestrictedJson(frozenPolicy("p", [
        frozenRule("e", "memoryos.prohibit-regression-findings", {
          categories: REGISTERED_REGRESSION_CATEGORIES,
        }),
        frozenRule("f", "memoryos.require-mip-integrity"),
      ]))), context),
    );
  }

  {
    const memory = new MemoryOS();
    const { context } = observationBoundaryContext(memory, 3);
    match(
      "vector-completed-fail",
      memory.evaluatePolicy(memory.preparePolicy(canonicalizeRestrictedJson(frozenPolicy(
        "p",
        [frozenRule("e", "memoryos.require-mip-integrity")],
      ))), context),
    );
  }

  {
    const memory = new MemoryOS();
    const facts = evidenceAddedRegressionPair(memory);
    const artifact = frozenPolicy("a", [frozenRule(
      "a",
      "memoryos.prohibit-regression-findings",
      { categories: REGISTERED_REGRESSION_CATEGORIES },
    )]);
    match(
      "vector-policy-native-regression",
      memory.evaluatePolicy(
        memory.preparePolicy(canonicalizeRestrictedJson(artifact)),
        facts.policyFactContext,
        { regressionSource: facts.regressionPolicyFactSource },
      ),
    );
  }

  {
    const memory = new MemoryOS();
    const facts = eightFindingRegressionPair(memory);
    const artifact = frozenPolicy("p", [frozenRule(
      "a",
      "memoryos.prohibit-regression-findings",
      { categories: ["replay", "transition"] },
    )]);
    match(
      "vector-resource-limit-cne",
      memory.evaluatePolicy(
        memory.preparePolicy(canonicalizeRestrictedJson(artifact)),
        facts.policyFactContext,
        { regressionSource: facts.regressionPolicyFactSource },
      ),
    );
  }

  {
    const memory = new MemoryOS();
    const workspace = memory.openWorkspace(referenceSnapshot.workspaceIdentifier);
    let investigation = memory.observe(workspace, clone(referenceSnapshot), {
      identifier: "cf5b2-point-in-time",
    });
    const before = memory.capturePolicyFactContext(investigation);
    investigation = investigation.observe(clone(referenceSnapshot), {
      operation: "CF5B2AdditionalObservation",
    });
    const after = memory.capturePolicyFactContext(investigation);
    const artifact = frozenPolicy("a", [frozenRule(
      "a",
      "memoryos.require-lifecycle-state",
      { allowedStates: REGISTERED_LIFECYCLE_STATES },
    )]);
    const prepared = memory.preparePolicy(canonicalizeRestrictedJson(artifact));
    match("vector-transition-before", memory.evaluatePolicy(prepared, before));
    match("vector-transition-after", memory.evaluatePolicy(prepared, after));
  }

  {
    const memory = new MemoryOS();
    const workspace = memory.openWorkspace(referenceSnapshot.workspaceIdentifier);
    const baselineA = clone(referenceSnapshot);
    const baselineB = clone(referenceSnapshot);
    const candidateValue = clone(referenceSnapshot);
    baselineB.longTermMemory.entries[0].value = "CF5B-2 authoritative alternate baseline.";
    candidateValue.longTermMemory.entries[0].value = "CF5B-2 authoritative shared candidate.";
    const firstBaseline = memory.observe(workspace, baselineA, {
      identifier: "cf5b2-source-baseline-a",
    });
    const secondBaseline = memory.observe(workspace, baselineB, {
      identifier: "cf5b2-source-baseline-b",
    });
    const candidate = memory.observe(workspace, candidateValue, {
      identifier: "cf5b2-source-candidate",
    });
    const first = memory.captureRegressionPolicyFacts(firstBaseline, candidate);
    const second = memory.captureRegressionPolicyFacts(secondBaseline, candidate);
    const artifact = frozenPolicy("a", [frozenRule(
      "a",
      "memoryos.prohibit-regression-findings",
      { categories: ["replay"] },
    )]);
    const prepared = memory.preparePolicy(canonicalizeRestrictedJson(artifact));
    match(
      "vector-regression-source-control",
      memory.evaluatePolicy(prepared, first.policyFactContext, {
        regressionSource: first.regressionPolicyFactSource,
      }),
    );
    match(
      "vector-different-regression-source",
      memory.evaluatePolicy(prepared, second.policyFactContext, {
        regressionSource: second.regressionPolicyFactSource,
      }),
    );
  }

  assert.deepEqual([...reproduced].sort(), [...records.keys()].sort());
});

test("SDK 1.1 exercises all 10 frozen cache vectors at the production boundary", async () => {
  const fixture = JSON.parse(await readFile(
    new URL("cache-validation-vectors.json", fixtureRoot),
    "utf8",
  ));
  assert.equal(fixture.vectors.length, 10);
  const exercised = new Set();

  // The nine negative records model corruption inside the private retained cache. CF7 exposes
  // no cache-seeding hook, so they are classified at that private boundary, rejected through
  // public authoritative verification, and followed by a fresh public miss-to-hit evaluation.
  for (const vector of fixture.vectors) {
    assert.equal(
      inspectDetachedPolicyEvaluationCacheVector(vector),
      vector.expected,
      vector.vectorId,
    );

    const memory = new MemoryOS();
    const { context } = await floorMipContext(memory);
    assert.equal(
      context.contextDigest,
      vector.requestIdentity.policyFactContext.contextDigest,
      `${vector.vectorId}: authoritative context identity`,
    );
    const artifactBytes = canonicalizeRestrictedJson(vector.authoritativeInput.artifact);
    const prepared = memory.preparePolicy(artifactBytes);
    const first = memory.evaluatePolicy(prepared, context);
    const firstIdentityBytes = first.evaluationIdentityBytes();
    const firstOutcomeBytes = first.canonicalOutcomeBytes();
    assert.equal(first.cacheDisposition, "MISS_RECOMPUTE", vector.vectorId);
    const second = memory.evaluatePolicy(prepared, context);
    assert.equal(second.cacheDisposition, "HIT_RETURN_EXACT_RETAINED_BYTES", vector.vectorId);
    assert.deepEqual(second.evaluationIdentityBytes(), firstIdentityBytes, vector.vectorId);
    assert.deepEqual(second.canonicalOutcomeBytes(), firstOutcomeBytes, vector.vectorId);

    if (vector.vectorId === "authoritative-input-binding-mismatch") {
      assert.notDeepEqual(firstIdentityBytes, encoder.encode(fixture.expectedRequestIdentityBytes));
      assert.notDeepEqual(firstOutcomeBytes, encoder.encode(fixture.expectedOutcomeBytes));
    } else {
      assert.deepEqual(firstIdentityBytes, encoder.encode(fixture.expectedRequestIdentityBytes));
      assert.deepEqual(firstOutcomeBytes, encoder.encode(fixture.expectedOutcomeBytes));
    }

    const retainedIdentityBytes = encoder.encode(vector.retainedEvaluationIdentityBytes);
    const retainedOutcomeBytes = encoder.encode(vector.retainedOutcomeBytes);
    const checks = [
      () => memory.verifyEvaluationIdentityArtifact(retainedIdentityBytes, vector.cacheKey),
      () => memory.verifyEvaluationIdentityForEvaluation(
        retainedIdentityBytes,
        prepared,
        context,
      ),
      () => memory.verifyPolicyEvaluationOutcomeArtifact(retainedOutcomeBytes, {
        expectedIdentity: retainedIdentityBytes,
        expectedOutcomeDigest: vector.retainedOutcomeDigest,
      }),
      () => memory.verifyPolicyEvaluationOutcomeForEvaluation(
        retainedOutcomeBytes,
        prepared,
        context,
        { expectedOutcomeDigest: vector.retainedOutcomeDigest },
      ),
    ];
    const failures = checks.map((check) => {
      try {
        check();
        return null;
      } catch (error) {
        assert.equal(error instanceof MemoryOSPolicyOperationalError, true, vector.vectorId);
        assert.equal(error.code, "VERIFICATION_FAILED", vector.vectorId);
        assert.equal(error.verificationFailure, true, vector.vectorId);
        return error;
      }
    }).filter(Boolean);

    if (vector.vectorId === "exact-cache-hit") {
      assert.equal(failures.length, 0);
    } else {
      assert.ok(failures.length > 0, vector.vectorId);
    }
    exercised.add(vector.vectorId);
  }

  assert.deepEqual([...exercised].sort(), fixture.vectors.map(({ vectorId }) => vectorId).sort());
});

test("SDK 1.1 production evaluation exhausts every reachable frozen rule row", async () => {
  const initialMemory = new MemoryOS();
  const initialContext = initialMemory.capturePolicyFactContext(observed(
    initialMemory,
    "sdk-rule-row-initial",
  ));

  const replayMemory = new MemoryOS();
  let replayInvestigation = observed(replayMemory, "sdk-rule-row-replay");
  replayInvestigation = replayInvestigation.trace(reflectionKey(replayInvestigation));
  const readyContext = replayMemory.capturePolicyFactContext(replayInvestigation);
  const replay = replayInvestigation.replay();
  replay.play();
  const playingContext = replayMemory.capturePolicyFactContext(replay.investigation);
  replay.pause();
  const pausedContext = replayMemory.capturePolicyFactContext(replay.investigation);
  let guard = 0;
  while (replay.state.status !== "completed") {
    replay.next();
    assert.ok((guard += 1) < 10_000);
  }
  const completedReplayInvestigation = replay.investigation;
  const completedReplayContext = replayMemory.capturePolicyFactContext(
    completedReplayInvestigation,
  );
  completedReplayInvestigation.verify();
  const completedVerificationContext = replayMemory.capturePolicyFactContext(
    completedReplayInvestigation,
  );

  const mipMemory = new MemoryOS();
  const mip = await floorMipContext(mipMemory);

  const identicalMemory = new MemoryOS();
  const identicalWorkspace = identicalMemory.openWorkspace(referenceSnapshot.workspaceIdentifier);
  const identicalBaseline = identicalMemory.observe(
    identicalWorkspace,
    clone(referenceSnapshot),
    { identifier: "sdk-rule-row-identical-baseline" },
  );
  const identicalCandidate = identicalMemory.observe(
    identicalWorkspace,
    clone(referenceSnapshot),
    { identifier: "sdk-rule-row-identical-candidate" },
  );
  const identicalFacts = identicalMemory.captureRegressionPolicyFacts(
    identicalBaseline,
    identicalCandidate,
  );

  const changedMemory = new MemoryOS();
  const changedFacts = evidenceAddedRegressionPair(changedMemory);

  const cases = [
    {
      label: "verification absent",
      memory: initialMemory,
      context: initialContext,
      rule: frozenRule("a", "memoryos.require-verification-completed"),
      decision: "FAIL",
      code: "REQUIRE_VERIFICATION_COMPLETED_NOT_SATISFIED",
      evidence: { kind: "selection", domain: "verification", selector: "memoryos.selector.verification-all", parameters: {}, matchCount: 0 },
    },
    {
      label: "verification passed",
      memory: replayMemory,
      context: completedVerificationContext,
      rule: frozenRule("a", "memoryos.require-verification-completed"),
      decision: "PASS",
      code: "REQUIRE_VERIFICATION_COMPLETED_SATISFIED",
      evidence: { kind: "reference", domain: "verification" },
    },
    {
      label: "replay absent",
      memory: initialMemory,
      context: initialContext,
      rule: frozenRule("a", "memoryos.require-replay-completed"),
      decision: "FAIL",
      code: "REQUIRE_REPLAY_COMPLETED_NOT_SATISFIED",
      evidence: { kind: "selection", domain: "activeReplay", selector: "memoryos.selector.active-replay-all", parameters: {}, matchCount: 0 },
    },
    ...[
      ["ready", readyContext],
      ["playing", playingContext],
      ["paused", pausedContext],
    ].map(([status, context]) => ({
      label: `replay ${status}`,
      memory: replayMemory,
      context,
      rule: frozenRule("a", "memoryos.require-replay-completed"),
      decision: "FAIL",
      code: "REQUIRE_REPLAY_COMPLETED_NOT_SATISFIED",
      evidence: { kind: "reference", domain: "activeReplay", status },
    })),
    {
      label: "replay completed",
      memory: replayMemory,
      context: completedReplayContext,
      rule: frozenRule("a", "memoryos.require-replay-completed"),
      decision: "PASS",
      code: "REQUIRE_REPLAY_COMPLETED_SATISFIED",
      evidence: { kind: "reference", domain: "activeReplay", status: "completed" },
    },
    {
      label: "artifact cardinality satisfied",
      memory: initialMemory,
      context: initialContext,
      rule: frozenRule("a", "memoryos.require-artifact-cardinality", { artifactClass: "evidence", minimumCount: 1 }),
      decision: "PASS",
      code: "REQUIRE_ARTIFACT_CARDINALITY_SATISFIED",
      evidence: { kind: "selection", domain: "artifactCardinalities", selector: "memoryos.selector.artifact-cardinality-by-class", parameters: { artifactClass: "evidence" }, matchCount: 1 },
    },
    {
      label: "artifact cardinality unsatisfied",
      memory: initialMemory,
      context: initialContext,
      rule: frozenRule("a", "memoryos.require-artifact-cardinality", { artifactClass: "evidence", minimumCount: 9007199254740991 }),
      decision: "FAIL",
      code: "REQUIRE_ARTIFACT_CARDINALITY_NOT_SATISFIED",
      evidence: { kind: "selection", domain: "artifactCardinalities", selector: "memoryos.selector.artifact-cardinality-by-class", parameters: { artifactClass: "evidence" }, matchCount: 1 },
    },
    {
      label: "lifecycle satisfied",
      memory: initialMemory,
      context: initialContext,
      rule: frozenRule("a", "memoryos.require-lifecycle-state", { allowedStates: ["Observed"] }),
      decision: "PASS",
      code: "REQUIRE_LIFECYCLE_STATE_SATISFIED",
      evidence: { kind: "reference", domain: "lifecycle" },
    },
    {
      label: "lifecycle unsatisfied",
      memory: initialMemory,
      context: initialContext,
      rule: frozenRule("a", "memoryos.require-lifecycle-state", { allowedStates: ["Archived"] }),
      decision: "FAIL",
      code: "REQUIRE_LIFECYCLE_STATE_NOT_SATISFIED",
      evidence: { kind: "reference", domain: "lifecycle" },
    },
    {
      label: "Regression source absent",
      memory: initialMemory,
      context: initialContext,
      rule: frozenRule("a", "memoryos.prohibit-regression-findings", { categories: ["reflection"] }),
      decision: "COULD_NOT_EVALUATE",
      code: "PROHIBIT_REGRESSION_FINDINGS_SOURCE_NOT_SUPPLIED",
      evidence: { kind: "absence", domain: "cognitiveRegression" },
    },
    {
      label: "Regression selected findings absent",
      memory: identicalMemory,
      context: identicalFacts.policyFactContext,
      source: identicalFacts.regressionPolicyFactSource,
      rule: frozenRule("a", "memoryos.prohibit-regression-findings", { categories: REGISTERED_REGRESSION_CATEGORIES }),
      decision: "PASS",
      code: "PROHIBIT_REGRESSION_FINDINGS_SATISFIED",
      evidence: { kind: "externalSelection", domain: "cognitiveRegression", selector: "memoryos.selector.regression-findings-by-category", parameters: { categories: REGISTERED_REGRESSION_CATEGORIES }, matchCount: 0 },
    },
    {
      label: "Regression selected findings present",
      memory: changedMemory,
      context: changedFacts.policyFactContext,
      source: changedFacts.regressionPolicyFactSource,
      rule: frozenRule("a", "memoryos.prohibit-regression-findings", { categories: REGISTERED_REGRESSION_CATEGORIES }),
      decision: "FAIL",
      code: "PROHIBIT_REGRESSION_FINDINGS_NOT_SATISFIED",
      evidence: { kind: "externalSelection", domain: "cognitiveRegression", selector: "memoryos.selector.regression-findings-by-category", parameters: { categories: REGISTERED_REGRESSION_CATEGORIES }, matchCount: 2 },
    },
    {
      label: "MIP not applicable",
      memory: initialMemory,
      context: initialContext,
      rule: frozenRule("a", "memoryos.require-mip-integrity"),
      decision: "FAIL",
      code: "REQUIRE_MIP_INTEGRITY_NOT_SATISFIED",
      evidence: { kind: "domainState", domain: "mipIntegrity", availability: "notApplicable" },
    },
    {
      label: "MIP integrity passed",
      memory: mipMemory,
      context: mip.context,
      rule: frozenRule("a", "memoryos.require-mip-integrity"),
      decision: "PASS",
      code: "REQUIRE_MIP_INTEGRITY_SATISFIED",
      evidence: { kind: "reference", domain: "mipIntegrity" },
    },
  ];

  for (const entry of cases) {
    const prepared = entry.memory.preparePolicy(canonicalizeRestrictedJson(frozenPolicy(
      "p",
      [entry.rule],
    )));
    const options = entry.source === undefined ? {} : { regressionSource: entry.source };
    const evaluation = entry.memory.evaluatePolicy(prepared, entry.context, options);
    assert.equal(evaluation.decision, entry.decision, entry.label);
    assert.equal(evaluation.outcome.result.kind, "MemoryOSPolicyResult", entry.label);
    assert.equal(evaluation.outcome.result.ruleResults.length, 1, entry.label);
    const row = evaluation.outcome.result.ruleResults[0];
    assert.deepEqual({
      decision: row.decision,
      decisionCode: row.decisionCode,
      ruleIdentifier: row.ruleIdentifier,
      ruleType: row.ruleType,
      ruleVersion: row.ruleVersion,
    }, {
      decision: entry.decision,
      decisionCode: entry.code,
      ruleIdentifier: "a",
      ruleType: entry.rule.type,
      ruleVersion: "1.0.0",
    }, entry.label);
    assert.equal(row.evidence.length, 1, entry.label);
    const expected = entry.evidence;
    const contextSource = {
      contextDigest: entry.context.contextDigest,
      kind: "policyFactContext",
    };
    if (expected.kind === "reference") {
      const [fact] = entry.context.artifact.facts[expected.domain].items;
      assert.ok(fact, entry.label);
      if (expected.status !== undefined) assert.equal(fact.value.status, expected.status, entry.label);
      assert.deepEqual(row.evidence[0], {
        domain: expected.domain,
        factIdentifier: fact.factIdentifier,
        kind: "MemoryOSPolicyFactReference",
        source: contextSource,
      }, entry.label);
    } else if (expected.kind === "selection") {
      const candidates = entry.context.artifact.facts[expected.domain].items.filter((fact) => (
        expected.domain !== "artifactCardinalities"
          || fact.subject.artifactClass === expected.parameters.artifactClass
      ));
      const identifiers = candidates.map(({ factIdentifier }) => factIdentifier);
      assert.equal(identifiers.length, expected.matchCount, entry.label);
      assert.deepEqual(row.evidence[0], {
        domain: expected.domain,
        kind: "MemoryOSPolicyFactSelection",
        matchCount: expected.matchCount,
        matchedFactIdentifiers: identifiers,
        selector: {
          identifier: expected.selector,
          parameters: expected.parameters,
          version: "1.0.0",
        },
        source: contextSource,
      }, entry.label);
    } else if (expected.kind === "externalSelection") {
      const identifiers = entry.source.artifact.facts.findings
        .filter(({ subject }) => expected.parameters.categories.includes(subject.category))
        .map(({ factIdentifier }) => factIdentifier);
      assert.equal(identifiers.length, expected.matchCount, entry.label);
      assert.deepEqual(row.evidence[0], {
        domain: "cognitiveRegression",
        factDomain: "findings",
        kind: "MemoryOSPolicyFactSelection",
        matchCount: expected.matchCount,
        matchedFactIdentifiers: identifiers,
        selector: {
          identifier: expected.selector,
          parameters: expected.parameters,
          version: "1.0.0",
        },
        source: {
          externalSourceDigest: entry.source.sourceDigest,
          kind: "deterministicFactSource",
        },
      }, entry.label);
    } else if (expected.kind === "domainState") {
      assert.deepEqual(row.evidence[0], {
        availability: expected.availability,
        domain: expected.domain,
        kind: "MemoryOSPolicyFactDomainState",
        source: contextSource,
      }, entry.label);
    } else {
      assert.deepEqual(row.evidence[0], {
        domain: expected.domain,
        kind: "MemoryOSDeterministicFactSourceAbsence",
      }, entry.label);
    }
  }
});

test("SDK 1.1 preserves all Policy and Policy Set aggregation rows in authored order", () => {
  const memory = new MemoryOS();
  const context = memory.capturePolicyFactContext(observed(memory, "sdk-aggregation-matrix"));
  const rows = {
    C: frozenRule("a", "memoryos.prohibit-regression-findings", { categories: ["replay"] }),
    F: frozenRule("a", "memoryos.require-mip-integrity"),
    P: frozenRule("a", "memoryos.require-lifecycle-state", { allowedStates: ["Observed"] }),
  };
  const rowContract = {
    C: ["COULD_NOT_EVALUATE", "PROHIBIT_REGRESSION_FINDINGS_SOURCE_NOT_SUPPLIED", "MemoryOSDeterministicFactSourceAbsence"],
    F: ["FAIL", "REQUIRE_MIP_INTEGRITY_NOT_SATISFIED", "MemoryOSPolicyFactDomainState"],
    P: ["PASS", "REQUIRE_LIFECYCLE_STATE_SATISFIED", "MemoryOSPolicyFactReference"],
  };
  const combinations = [
    ["P", "P", "PASS"],
    ["P", "F", "FAIL"],
    ["P", "C", "COULD_NOT_EVALUATE"],
    ["F", "C", "FAIL"],
    ["C", "C", "COULD_NOT_EVALUATE"],
  ];

  const assertRows = (actualRows, authored, label) => {
    assert.equal(actualRows.length, 2, label);
    assert.deepEqual(actualRows.map(({ ruleIdentifier }) => ruleIdentifier), ["a", "b"], label);
    assert.deepEqual(
      actualRows.map(({ decision }) => decision),
      authored.map((key) => rowContract[key][0]),
      label,
    );
    assert.deepEqual(
      actualRows.map(({ decisionCode }) => decisionCode),
      authored.map((key) => rowContract[key][1]),
      label,
    );
    assert.deepEqual(actualRows.map(({ evidence }) => evidence.length), [1, 1], label);
    assert.deepEqual(
      actualRows.map(({ evidence }) => evidence[0].kind),
      authored.map((key) => rowContract[key][2]),
      label,
    );
  };

  for (let index = 0; index < combinations.length; index += 1) {
    const [left, right, decision] = combinations[index];
    const authored = [left, right];
    const rules = authored.map((key, ruleIndex) => ({
      ...rows[key],
      identifier: ruleIndex === 0 ? "a" : "b",
    }));
    const policyEvaluation = memory.evaluatePolicy(
      memory.preparePolicy(canonicalizeRestrictedJson(frozenPolicy("p", rules))),
      context,
    );
    assert.equal(policyEvaluation.decision, decision, `Policy ${left}+${right}`);
    assertRows(policyEvaluation.outcome.result.ruleResults, authored, `Policy ${left}+${right}`);

    const children = authored.map((key, childIndex) => frozenPolicy(
      childIndex === 0 ? "a" : "b",
      [{ ...rows[key], identifier: "a" }],
    ));
    const setEvaluation = memory.evaluatePolicySet(
      memory.preparePolicySet(canonicalizeRestrictedJson(frozenPolicySet(
        memory,
        `s${index}`,
        children,
      ))),
      context,
    );
    assert.equal(setEvaluation.decision, decision, `Policy Set ${left}+${right}`);
    assert.deepEqual(
      setEvaluation.outcome.result.policyResults.map(({ policyIdentifier }) => policyIdentifier),
      ["a", "b"],
      `Policy Set ${left}+${right}`,
    );
    const childRows = setEvaluation.outcome.result.policyResults.map(
      ({ ruleResults }) => ruleResults[0],
    );
    assert.deepEqual(
      childRows.map(({ decision: value }) => value),
      authored.map((key) => rowContract[key][0]),
    );
    assert.deepEqual(
      childRows.map(({ decisionCode }) => decisionCode),
      authored.map((key) => rowContract[key][1]),
    );
    assert.deepEqual(childRows.map(({ evidence }) => evidence.length), [1, 1]);
    assert.deepEqual(
      childRows.map(({ evidence }) => evidence[0].kind),
      authored.map((key) => rowContract[key][2]),
    );
  }
});

test("verification rejects wrong digests without fabricating a Policy decision", () => {
  const memory = new MemoryOS();
  const context = memory.capturePolicyFactContext(observed(memory, "sdk-verification-negative"));
  const prepared = memory.preparePolicy(canonicalizeRestrictedJson(policy("v")));
  const evaluation = memory.evaluatePolicy(prepared, context);
  assert.throws(
    () => memory.verifyEvaluationIdentityArtifact(
      evaluation.evaluationIdentityBytes(), `sha256:${"0".repeat(64)}`,
    ),
    (error) => error instanceof MemoryOSPolicyOperationalError
      && error.verificationFailure === true
      && error.code === "VERIFICATION_FAILED",
  );
});

test("SDK 1.1 preserves immutable bytes and opaque authority under intrinsic poisoning", () => {
  const memory = new MemoryOS();
  const prepared = memory.preparePolicy(canonicalizeRestrictedJson(policy("i")));
  const context = memory.capturePolicyFactContext(observed(memory, "sdk-intrinsic-authority"));
  const expectedBytes = prepared.toBytes();
  const forgedContext = {};

  const originalAssign = Object.assign;
  const originalFreeze = Object.freeze;
  const originalKeys = Object.keys;
  const originalValues = Object.values;
  const originalFrom = Uint8Array.from;
  const originalWeakMapGet = WeakMap.prototype.get;
  const originalWeakMapSet = WeakMap.prototype.set;
  const originalTypeError = globalThis.TypeError;
  let leakedCapability = null;
  try {
    Object.assign = (target) => target;
    Object.freeze = (value) => value;
    Object.keys = () => [];
    Object.values = () => [];
    Uint8Array.from = (value) => value;
    WeakMap.prototype.set = function poisonedSet(key, value) {
      if (value?.capability !== undefined && value?.owner !== undefined) {
        leakedCapability = value;
      }
      return Reflect.apply(originalWeakMapSet, this, [key, value]);
    };
    WeakMap.prototype.get = function poisonedGet(key) {
      if (key === forgedContext && leakedCapability !== null) return leakedCapability;
      return Reflect.apply(originalWeakMapGet, this, [key]);
    };
    globalThis.TypeError = class PoisonedTypeError extends Error {};

    const secondPrepared = memory.preparePolicy(canonicalizeRestrictedJson(policy("j")));
    const firstCopy = secondPrepared.toBytes();
    const secondCopy = secondPrepared.toBytes();
    assert.notStrictEqual(firstCopy, secondCopy);
    firstCopy[0] ^= 0xff;
    assert.deepEqual(secondPrepared.toBytes(), secondCopy);

    const identities = memory.policyContractIdentities();
    assert.ok(Object.isFrozen(identities));
    assert.ok(Object.isFrozen(identities.factModel));
    assert.ok(Object.isFrozen(identities.deterministicFactSourceRegistry.sources));
    assert.throws(
      () => memory.evaluatePolicy(prepared, context, { arbitraryOverride: true }),
      originalTypeError,
    );
    assert.equal(leakedCapability, null);
    assert.throws(
      () => memory.evaluatePolicy(prepared, forgedContext),
      (error) => error instanceof MemoryOSPolicyPreparationError
        && error.code === "POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED",
    );
    assert.deepEqual(prepared.toBytes(), expectedBytes);
  } finally {
    Object.assign = originalAssign;
    Object.freeze = originalFreeze;
    Object.keys = originalKeys;
    Object.values = originalValues;
    Uint8Array.from = originalFrom;
    WeakMap.prototype.get = originalWeakMapGet;
    WeakMap.prototype.set = originalWeakMapSet;
    globalThis.TypeError = originalTypeError;
  }
});

test("SDK 1.1 outer ownership bindings resist WeakMap interception and spoofing", () => {
  const expectedIdentities = new MemoryOS().policyContractIdentities();
  const originalWeakMapGet = WeakMap.prototype.get;
  const originalWeakMapSet = WeakMap.prototype.set;
  const intercepted = [];
  const forgedWorkspace = {};
  try {
    WeakMap.prototype.set = function interceptedSet(key, value) {
      intercepted.push({ operation: "set", key, value });
      return Reflect.apply(originalWeakMapSet, this, [key, value]);
    };
    WeakMap.prototype.get = function interceptedGet(key) {
      intercepted.push({ operation: "get", key });
      const stolenWorkspaceBinding = intercepted.find((entry) => (
        entry.operation === "set" && entry.key?.constructor?.name === "Workspace"
      ));
      if (key === forgedWorkspace && stolenWorkspaceBinding) return stolenWorkspaceBinding.value;
      return Reflect.apply(originalWeakMapGet, this, [key]);
    };

    const owner = new MemoryOS();
    const foreign = new MemoryOS();
    const investigation = observed(owner, "sdk-outer-weakmap-owner");
    const context = owner.capturePolicyFactContext(investigation);
    const prepared = owner.preparePolicy(canonicalizeRestrictedJson(policy("o")));

    assert.equal(owner.evaluatePolicy(prepared, context).decision, "FAIL");
    assert.deepEqual(owner.policyContractIdentities(), expectedIdentities);
    assert.deepEqual(foreign.policyContractIdentities(), expectedIdentities);
    assert.equal(
      owner.policyContractIdentities().resourceProfile.resourceProfileDigest,
      "sha256:c091573dfd05481f5759ef077e15af16689382a7432fa546c6630c4caeaa5239",
    );
    assert.throws(
      () => foreign.evaluatePolicy(prepared, context),
      (error) => error instanceof MemoryOSPolicyPreparationError
        && error.code === "POLICY_FACT_CONTEXT_PROVENANCE_UNTRUSTED",
    );
    assert.throws(
      () => owner.observe(forgedWorkspace, clone(referenceSnapshot), {
        identifier: "sdk-forged-workspace",
      }),
      TypeError,
    );
    assert.deepEqual(intercepted, []);
  } finally {
    WeakMap.prototype.get = originalWeakMapGet;
    WeakMap.prototype.set = originalWeakMapSet;
  }
});
