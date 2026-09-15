import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import test from "node:test";

import {
  MACHINE_DEFINITION_IDENTITIES,
  MEMORYOS_POLICY_RESOURCE_PROFILE,
  MEMORYOS_POLICY_RESOURCE_PROFILE_DIGEST,
  verifyMachineContractDefinition,
  verifyMemoryOSPolicyResourceProfile,
} from "../../cca-studio/web/js/investigation-policy-contracts.js";
import {
  inspectDetachedPolicyEvaluationCacheVector,
  policyEvaluationIdentityDigest,
  policyEvaluationOutcomeDigest,
  validateEvaluationIdentity,
  validatePolicyEvaluationOutcome,
} from "../../cca-studio/web/js/investigation-policy-engine.js";
import { MEMORYOS_POLICY_CONTRACT_IDENTITIES } from "../../cca-studio/web/js/investigation-policy-integration.js";
import {
  canonicalizeRestrictedJson,
  parseRestrictedJson,
} from "../../cca-studio/web/js/policy-canonical.js";
import { MEMORYOS_SDK_VERSION, MemoryOS } from "../../cca-studio/web/js/memoryos-sdk.js";
import { policyCommandNames } from "../../memoryos-cli/src/policy-arguments.js";
import { policyEvaluationIdentifiers } from "../../memoryos-cli/src/policy-commands.js";
import { parseCliJson, readMipFixture, runCli } from "./support/conformance-support.mjs";
import {
  MO1301_INVENTORY_PATH,
  MO1301_WORKSPACE_ROOT,
  MO1302_HANDOFF_PATH,
  assertExactMembers,
  assertOrderedUnique,
  decisionExitCode,
  normativeErrorProjection,
  rawSha256,
  readJson,
  verifyPublicationGeneration,
} from "./support/mo1301-conformance-support.mjs";

const EXPECTED_LOGICAL_SUITES = Object.freeze([
  "aggregation",
  "cache",
  "cli",
  "cross-language",
  "cross-platform",
  "evaluation-identity",
  "evidence",
  "fact-context",
  "mo1302-handoff",
  "outcome",
  "policy-artifact",
  "policy-set",
  "provenance",
  "regression-source",
  "resource-profile",
  "rule-evaluation",
  "rule-registry",
  "sdk-cpp",
  "sdk-js",
  "sdk-python",
]);

function utf8(value) {
  return new TextEncoder().encode(value);
}

function assertEvaluationIdentityCrossBindsContractPin(identity, contractPin) {
  assert.equal(identity.evaluatorVersion, contractPin.evaluatorVersion);
  assert.deepEqual(
    identity.deterministicFactSourceRegistry,
    {
      registryDigest: contractPin.deterministicFactSourceRegistry.registryDigest,
      registryVersion: contractPin.deterministicFactSourceRegistry.registryVersion,
    },
  );
  assert.deepEqual(
    {
      factModelDigest: identity.policyFactContext.factModelDigest,
      factModelVersion: identity.policyFactContext.factModelVersion,
    },
    contractPin.factModel,
  );
  assert.equal(identity.outcomeContractVersion, contractPin.outcomeContractVersion);
  assert.deepEqual(identity.resourceProfile, contractPin.resourceProfile);
  assert.deepEqual(identity.ruleRegistry, contractPin.ruleRegistry);
}

function pythonExecutable() {
  return process.env.MEMORYOS_CONFORMANCE_PYTHON
    ?? process.env.Python3_EXECUTABLE ?? process.env.PYTHON ?? "python";
}

function runFocusedNodeSuite(paths) {
  const result = spawnSync(process.execPath, [
    "--test",
    "--test-concurrency=1",
    ...paths.map((path) => resolve(MO1301_WORKSPACE_ROOT, path)),
  ], {
    cwd: MO1301_WORKSPACE_ROOT,
    encoding: "utf8",
    env: { ...process.env, FORCE_COLOR: "0", NO_COLOR: "1", TZ: "UTC" },
    maxBuffer: 256 * 1024 * 1024,
    timeout: 120_000,
    windowsHide: true,
  });
  assert.ifError(result.error);
  assert.equal(result.status, 0, `${paths.join(", ")}\n${result.stdout}\n${result.stderr}`);
}

test("MO-1301 has a separate closed conformance inventory over the immutable v1.2.1 baseline", async () => {
  const inventory = await readJson(MO1301_INVENTORY_PATH);
  assertExactMembers(inventory, [
    "baseline", "contractIdentities", "documentationSurface", "exampleSurface",
    "historicalArtifacts", "implementationSurface", "kind", "logicalSuites", "machineDefinitions",
    "productIntegration", "publication", "resourceLimits", "testSurface", "vectors", "version",
  ], "MO-1301 inventory");
  assert.equal(inventory.kind, "MemoryOSMO1301ConformanceInventory");
  assert.equal(inventory.version, "1.0.0");
  assert.deepEqual(inventory.baseline, {
    compatibilityCommit: "2c3a5491a9bdefd723fe47e79c9d9d59d08de4a5",
    compatibilityRelease: "v1.2.1",
    phase1Commit: "5e8cad68a53aad4a800a568da1ca9fc44c91db1b",
    phase2Commit: "21aae07731467daa7a7d1c603870b9008486722f",
    phase3Commit: "9653bb33fc68e8ed5caf3d0a74c280a7521cce57",
  });
  assert.deepEqual(inventory.logicalSuites, EXPECTED_LOGICAL_SUITES);
  assertOrderedUnique(inventory.logicalSuites, "MO-1301 logical suites");
  assert.deepEqual(inventory.productIntegration, {
    cliVersion: "1.1.0",
    sdkVersions: { cpp: "1.1.0", javascript: "1.1.0", python: "1.1.0" },
  });
  assert.deepEqual(inventory.publication, {
    currentNormativeStandard: "CCA-MEMORYOS-1.0",
    intendedNormativeTarget: "CCA-MEMORYOS-1.1",
    releaseStatus: "unreleased",
    standard11Status: "not-published",
  });
  assertExactMembers(inventory.implementationSurface, [
    "authoritativeEvaluator", "buildAndDistribution", "cli", "conformance", "sdk",
  ], "MO-1301 implementation surface");
  for (const [area, paths] of Object.entries(inventory.implementationSurface)) {
    assertOrderedUnique(paths, `${area} implementation paths`);
    for (const path of paths) {
      assert.equal(path.startsWith(".github/") || /\.ya?ml$/u.test(path), false,
        `${path} must not implement MO-1302`);
      await readFile(resolve(MO1301_WORKSPACE_ROOT, path));
    }
  }
  for (const name of ["documentationSurface", "exampleSurface"]) {
    assertOrderedUnique(inventory[name], `MO-1301 ${name}`);
    for (const path of inventory[name]) await readFile(resolve(MO1301_WORKSPACE_ROOT, path));
  }
  assertOrderedUnique(inventory.testSurface, "MO-1301 test paths");
  for (const path of inventory.testSurface) {
    await readFile(resolve(MO1301_WORKSPACE_ROOT, path));
  }
  assertExactMembers(inventory.vectors, [
    "boundaryCeilingProofs", "boundaryManifest", "cache", "golden", "mo1302Handoff",
  ], "MO-1301 vector inventory");
});

test("the new inventory authenticates every retained v1.2.1 conformance artifact without rewriting it", async () => {
  const { historicalArtifacts } = await readJson(MO1301_INVENTORY_PATH);
  assert.equal(historicalArtifacts.length, 10);
  assertOrderedUnique(historicalArtifacts.map(({ path }) => path), "historical artifact paths");
  for (const artifact of historicalArtifacts) {
    const bytes = await readFile(resolve(MO1301_WORKSPACE_ROOT, artifact.path));
    assert.equal(rawSha256(bytes), artifact.rawDigest, artifact.path);
  }
});

test("all sixteen frozen machine definitions and public contract identities remain exact", async () => {
  const inventory = await readJson(MO1301_INVENTORY_PATH);
  assertExactMembers(inventory.machineDefinitions, [
    "identityCount", "manifestPath", "manifestRawDigest", "parameterSchemaCount",
    "ruleModelCount",
  ], "machine-definition inventory");
  const manifestPath = resolve(
    MO1301_WORKSPACE_ROOT,
    inventory.machineDefinitions.manifestPath,
  );
  const manifestBytes = await readFile(manifestPath);
  assert.equal(rawSha256(manifestBytes), inventory.machineDefinitions.manifestRawDigest);
  const manifest = JSON.parse(manifestBytes.toString("utf8"));
  assert.equal(manifest.identityCount, inventory.machineDefinitions.identityCount);
  assert.equal(manifest.identities.length, inventory.machineDefinitions.identityCount);
  assert.equal(
    manifest.identities.filter(({ identityName }) => identityName.startsWith("parameterSchemaDigest:"))
      .length,
    inventory.machineDefinitions.parameterSchemaCount,
  );
  assert.equal(
    manifest.identities.filter(({ identityName }) => identityName.startsWith("ruleModelDigest:"))
      .length,
    inventory.machineDefinitions.ruleModelCount,
  );
  assert.deepEqual(
    manifest.identities,
    MACHINE_DEFINITION_IDENTITIES.map((identity) => ({
      artifactPath: identity.artifactPath,
      canonicalByteCount: identity.canonicalByteCount,
      digestDomain: identity.digestDomain,
      identityName: identity.identityName,
      normativeDigest: identity.normativeDigest,
      ordinal: identity.ordinal,
      rawSHA256: identity.rawSHA256,
    })),
  );
  const definitionRoot = resolve(
    MO1301_WORKSPACE_ROOT,
    "repositories/cca-studio/web/data/investigation-policy/1.0.0",
  );
  for (const identity of MACHINE_DEFINITION_IDENTITIES) {
    const bytes = await readFile(resolve(definitionRoot, identity.artifactPath));
    assert.equal(verifyMachineContractDefinition(bytes, identity).kind,
      identity.expectedKind, identity.identityName);
  }
  assert.deepEqual(MEMORYOS_POLICY_CONTRACT_IDENTITIES, {
    deterministicFactSourceRegistry: {
      registryDigest: inventory.contractIdentities.deterministicFactSourceRegistry.digest,
      registryVersion: inventory.contractIdentities.deterministicFactSourceRegistry.version,
      sources: [{
        domain: "cognitiveRegression",
        sourceModelDigest: inventory.contractIdentities.regressionSourceModel.digest,
        sourceModelVersion: inventory.contractIdentities.regressionSourceModel.version,
        wireVersion: "1.0.0",
      }],
    },
    evaluatorVersion: inventory.contractIdentities.evaluatorVersion,
    factModel: {
      factModelDigest: inventory.contractIdentities.factModel.digest,
      factModelVersion: inventory.contractIdentities.factModel.version,
    },
    kind: "MemoryOSPolicyContractIdentities",
    outcomeContractVersion: inventory.contractIdentities.outcomeContractVersion,
    resourceProfile: {
      identifier: inventory.contractIdentities.resourceProfile.identifier,
      resourceProfileDigest: inventory.contractIdentities.resourceProfile.digest,
      version: inventory.contractIdentities.resourceProfile.version,
    },
    ruleRegistry: {
      ruleRegistryDigest: inventory.contractIdentities.ruleRegistry.digest,
      ruleRegistryVersion: inventory.contractIdentities.ruleRegistry.version,
    },
    version: "1.0.0",
  });
});

test("the frozen Resource Profile contains all 31 limits and the 4060-byte outcome closure", async () => {
  const inventory = await readJson(MO1301_INVENTORY_PATH);
  assertExactMembers(inventory.resourceLimits, [
    "count", "outcomeCanonicalBytes", "profilePath", "profileRawDigest",
  ], "resource-limit inventory");
  const profilePath = resolve(MO1301_WORKSPACE_ROOT, inventory.resourceLimits.profilePath);
  const profileBytes = await readFile(profilePath);
  assert.equal(rawSha256(profileBytes), inventory.resourceLimits.profileRawDigest);
  const profile = await readJson(profilePath);
  assert.deepEqual(
    canonicalizeRestrictedJson(verifyMemoryOSPolicyResourceProfile(profileBytes)),
    new Uint8Array(profileBytes),
  );
  assert.deepEqual(profile, MEMORYOS_POLICY_RESOURCE_PROFILE);
  assert.equal(Object.keys(profile.limits).length, inventory.resourceLimits.count);
  assert.equal(profile.limits["evaluation.outcome-canonical-bytes"], 4060);
  assert.equal(inventory.resourceLimits.outcomeCanonicalBytes, 4060);
  assert.equal(MEMORYOS_POLICY_RESOURCE_PROFILE_DIGEST,
    "sha256:c091573dfd05481f5759ef077e15af16689382a7432fa546c6630c4caeaa5239");
});

test("all 17 final CF6 records retain exact canonical identity and outcome bytes", async () => {
  const inventory = await readJson(MO1301_INVENTORY_PATH);
  const vectorPath = resolve(MO1301_WORKSPACE_ROOT, inventory.vectors.golden.path);
  const vectorBytes = await readFile(vectorPath);
  assert.equal(rawSha256(vectorBytes), inventory.vectors.golden.rawDigest);
  const vectors = JSON.parse(vectorBytes.toString("utf8"));
  assert.equal(vectors.records.length, inventory.vectors.golden.count);
  assert.equal(vectors.resourceProfileDigest,
    inventory.contractIdentities.resourceProfile.digest);
  for (const record of vectors.records) {
    const identityBytes = utf8(record.canonicalIdentityBytes);
    const outcomeBytes = utf8(record.canonicalOutcomeBytes);
    assert.equal(identityBytes.byteLength, record.canonicalIdentityByteCount, record.recordId);
    assert.equal(outcomeBytes.byteLength, record.canonicalOutcomeByteCount, record.recordId);
    const identity = parseRestrictedJson(identityBytes);
    const outcome = parseRestrictedJson(outcomeBytes);
    assert.deepEqual(canonicalizeRestrictedJson(record.logicalEvaluationIdentity), identityBytes,
      record.recordId);
    assert.deepEqual(canonicalizeRestrictedJson(record.logicalOutcome), outcomeBytes, record.recordId);
    assert.deepEqual(canonicalizeRestrictedJson(identity), identityBytes, record.recordId);
    assert.deepEqual(canonicalizeRestrictedJson(outcome), outcomeBytes, record.recordId);
    assert.equal(validateEvaluationIdentity(identity), true, record.recordId);
    assert.equal(policyEvaluationIdentityDigest(identity), record.evaluationIdentityDigest,
      record.recordId);
    assert.equal(validatePolicyEvaluationOutcome(outcome, {
      expectedIdentity: identity,
      expectedOutcomeDigest: record.outcomeDigest,
    }), true, record.recordId);
    assert.equal(policyEvaluationOutcomeDigest(outcome), record.outcomeDigest, record.recordId);
  }
});

test("all 10 final cache classifications retain their frozen exact result", async () => {
  const inventory = await readJson(MO1301_INVENTORY_PATH);
  const vectorPath = resolve(MO1301_WORKSPACE_ROOT, inventory.vectors.cache.path);
  const vectorBytes = await readFile(vectorPath);
  assert.equal(rawSha256(vectorBytes), inventory.vectors.cache.rawDigest);
  const vectors = JSON.parse(vectorBytes.toString("utf8"));
  assert.equal(vectors.vectors.length, inventory.vectors.cache.count);
  for (const vector of vectors.vectors) {
    assert.equal(inspectDetachedPolicyEvaluationCacheVector(vector), vector.expected,
      vector.vectorId);
  }
});

test("the resource-boundary corpus retains its frozen manifest and ceiling-proof bytes", async () => {
  const { vectors } = await readJson(MO1301_INVENTORY_PATH);
  for (const name of ["boundaryCeilingProofs", "boundaryManifest"]) {
    assertExactMembers(vectors[name], ["path", "rawDigest"], `${name} inventory`);
    const bytes = await readFile(resolve(MO1301_WORKSPACE_ROOT, vectors[name].path));
    assert.equal(rawSha256(bytes), vectors[name].rawDigest, name);
  }
});

test("MO-1302 handoff vectors bind independent distribution and contract pins", async () => {
  const inventory = await readJson(MO1301_INVENTORY_PATH);
  const handoffBytes = await readFile(MO1302_HANDOFF_PATH);
  assert.equal(rawSha256(handoffBytes), inventory.vectors.mo1302Handoff.rawDigest);
  const handoff = JSON.parse(handoffBytes.toString("utf8"));
  assertExactMembers(handoff, [
    "artifactRetention", "contractIdentityPin", "decisionMapping", "distributionPin",
    "failureMapping", "kind", "policyPin", "policySetPin", "publicationGeneration",
    "summaryProjection", "version",
  ], "MO-1302 handoff fixture");
  assert.equal(handoff.kind, "MemoryOSMO1302HandoffVectors");
  assert.equal(handoff.version, "1.0.0");
  assert.deepEqual(handoff.contractIdentityPin, MEMORYOS_POLICY_CONTRACT_IDENTITIES);
  assert.deepEqual(handoff.artifactRetention, {
    required: [
      "canonicalEvaluationIdentity",
      "canonicalOutcome",
      "evaluationIdentityDigest",
      "outcomeDigest",
      "policyOrSetSemanticDigest",
      "policyFactContextDigest",
    ],
    sourceConditional: ["regressionPolicyFactSourceDigest"],
    sensitiveInvestigationBodiesRequired: false,
  });
  assert.deepEqual(handoff.distributionPin, {
    allowedIdentityKinds: ["immutableRevision", "sha256"],
    required: true,
    substitutesForContractIdentityPin: false,
  });
  assert.deepEqual(handoff.decisionMapping, [
    { cliExitCode: 0, decision: "PASS", workflowGate: "success" },
    { cliExitCode: 6, decision: "FAIL", workflowGate: "failure" },
    { cliExitCode: 7, decision: "COULD_NOT_EVALUATE", workflowGate: "failure" },
  ]);
  for (const row of handoff.decisionMapping) {
    assert.equal(decisionExitCode(row.decision), row.cliExitCode);
  }
  assert.deepEqual(handoff.failureMapping, [
    { cliExitCode: 1, failureClass: "usage", workflowGate: "tool-failure" },
    { cliExitCode: 2, failureClass: "preparation", workflowGate: "tool-failure" },
    { cliExitCode: 3, failureClass: "operational", workflowGate: "tool-failure" },
    { cliExitCode: 4, failureClass: "operational", workflowGate: "tool-failure" },
    { cliExitCode: 5, failureClass: "operational", workflowGate: "tool-failure" },
  ]);
  assert.deepEqual(handoff.publicationGeneration, {
    auxiliaryArtifactsRequireOutcomeCrossVerification: true,
    finalCommitMarker: "canonicalOutcome",
    mixedGenerationAccepted: false,
    requestedArtifacts: [
      "canonicalEvaluationIdentity",
      "canonicalOutcome",
      "evaluationIdentityDigest",
      "outcomeDigest",
    ],
  });
  assertOrderedUnique(
    handoff.publicationGeneration.requestedArtifacts,
    "publication-generation artifacts",
  );
  assert.deepEqual(handoff.summaryProjection, {
    allowed: ["decision", "digests", "evidenceReferences", "ruleDecisions", "stableCodes"],
    normative: false,
    replacesCanonicalOutcome: false,
  });
  assertOrderedUnique(handoff.summaryProjection.allowed, "summary-projection fields");

  const goldenPath = resolve(MO1301_WORKSPACE_ROOT, inventory.vectors.golden.path);
  const { records } = await readJson(goldenPath);
  const pinFor = (recordId) => {
    const record = records.find((candidate) => candidate.recordId === recordId);
    assert.ok(record, recordId);
    return {
      artifactKind: record.logicalEvaluationIdentity.evaluatedArtifact.kind,
      semanticDigest: record.logicalEvaluationIdentity.evaluatedArtifact.semanticDigest,
    };
  };
  assert.deepEqual(handoff.policyPin, pinFor("vector-policy-native-no-regression"));
  assert.deepEqual(handoff.policySetPin, pinFor("vector-policy-set"));
  assertEvaluationIdentityCrossBindsContractPin(
    records[0].logicalEvaluationIdentity,
    handoff.contractIdentityPin,
  );
});

test("one retained golden record forms a complete cross-verifying publication generation", async () => {
  const inventory = await readJson(MO1301_INVENTORY_PATH);
  const { records } = await readJson(resolve(MO1301_WORKSPACE_ROOT, inventory.vectors.golden.path));
  const record = records[0];
  const verified = verifyPublicationGeneration({
    evaluationIdentityBytes: utf8(record.canonicalIdentityBytes),
    evaluationIdentityDigest: record.evaluationIdentityDigest,
    outcomeBytes: utf8(record.canonicalOutcomeBytes),
    outcomeDigest: record.outcomeDigest,
  });
  assert.equal(verified.outcome.result.decision, "FAIL");
  assert.throws(() => verifyPublicationGeneration({
    evaluationIdentityBytes: utf8(record.canonicalIdentityBytes),
    evaluationIdentityDigest: record.evaluationIdentityDigest,
    outcomeBytes: utf8(record.canonicalOutcomeBytes),
    outcomeDigest: record.outcomeDigest.replace(/.$/u, "1"),
  }));
});

test("presentation diagnostics are excluded from the exact normative JSON error projection", () => {
  const stable = {
    command: "policy validate",
    error: {
      artifactKind: "MemoryOSInvestigationPolicy",
      code: "POLICY_SCHEMA_INVALID",
      details: { platform: "presentation-only" },
      exitCode: 2,
      failureClass: "preparation",
      limitIdentifier: null,
      message: "first presentation",
      phase: "policyArtifact",
    },
    ok: false,
    schemaVersion: "1.1",
  };
  const alternate = structuredClone(stable);
  alternate.error.message = "different language and platform text";
  alternate.error.details = ["different", "presentation"];
  assert.deepEqual(normativeErrorProjection(stable), normativeErrorProjection(alternate));
  assertExactMembers(normativeErrorProjection(stable).error, [
    "artifactKind", "code", "exitCode", "failureClass", "limitIdentifier", "phase",
  ], "normative error");
});

test("JavaScript, Python, CLI, and the private C++ bridge report one contract identity", () => {
  const javascript = new MemoryOS().policyContractIdentities();
  const normativeBytes = canonicalizeRestrictedJson(javascript);
  assert.equal(MEMORYOS_SDK_VERSION, "1.1.0");

  const cliResult = runCli(["policy", "identities", "--json"]);
  assert.equal(cliResult.status, 0, cliResult.stderr);
  assert.equal(cliResult.stderr, "");
  assert.equal(cliResult.stdout.endsWith("\n"), true);
  assert.equal(cliResult.stdout.endsWith("\n\n"), false);
  const cli = parseCliJson(cliResult);
  assert.deepEqual(cli.result, javascript);
  assert.deepEqual(utf8(JSON.stringify(cli.result)), normativeBytes);
  assert.equal(cli.schemaVersion, "1.1");

  const pythonScript = [
    "import json, os",
    "from collections.abc import Mapping",
    "from memoryos import MemoryOS",
    "def thaw(value):",
    "    if isinstance(value, Mapping): return {key: thaw(value[key]) for key in value}",
    "    if isinstance(value, tuple): return [thaw(item) for item in value]",
    "    return value",
    "with MemoryOS(node_executable=os.environ['MEMORYOS_NODE']) as memory:",
    "    print(json.dumps(thaw(memory.policy_contract_identities()), separators=(',', ':'), sort_keys=True))",
  ].join("\n");
  const pythonResult = spawnSync(pythonExecutable(), ["-c", pythonScript], {
    cwd: MO1301_WORKSPACE_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      MEMORYOS_NODE: process.execPath,
      PYTHONPATH: resolve(MO1301_WORKSPACE_ROOT, "repositories/cca-sdk/python/src"),
    },
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  assert.ifError(pythonResult.error);
  assert.equal(pythonResult.status, 0, pythonResult.stderr);
  assert.equal(pythonResult.stderr, "");
  assert.deepEqual(JSON.parse(pythonResult.stdout), javascript);
  assert.deepEqual(utf8(pythonResult.stdout.trimEnd()), normativeBytes);

  const bridgeResult = spawnSync(process.execPath, [resolve(
    MO1301_WORKSPACE_ROOT,
    "repositories/cca-sdk/bridge/investigation-core-host.mjs",
  )], {
    cwd: MO1301_WORKSPACE_ROOT,
    encoding: "utf8",
    input: `${JSON.stringify({
      id: 0,
      method: "policyContractIdentities",
      params: {},
      version: "1.0.0",
    })}\n`,
    maxBuffer: 4 * 1024 * 1024,
    windowsHide: true,
  });
  assert.ifError(bridgeResult.error);
  assert.equal(bridgeResult.status, 0, bridgeResult.stderr);
  assert.equal(bridgeResult.stderr, "");
  const bridge = JSON.parse(bridgeResult.stdout);
  assert.equal(bridge.ok, true);
  assert.deepEqual(bridge.result.identities, javascript);
  assert.deepEqual(utf8(JSON.stringify(bridge.result.identities)), normativeBytes);
});

test("one frozen MIP-backed Policy has exact bytes and digests across JS, Python, CLI, and bridge", async () => {
  const packageBytes = await readMipFixture("complete-investigation");
  const policyBytes = canonicalizeRestrictedJson({
    identifier: "d",
    kind: "MemoryOSInvestigationPolicy",
    policyVersion: "0.0.0",
    rules: [{
      identifier: "a",
      parameters: {},
      type: "memoryos.require-mip-integrity",
      version: "1.0.0",
    }],
    version: "1.0.0",
  });
  const candidateIdentifier = policyEvaluationIdentifiers.candidate;

  const javascriptMemory = new MemoryOS();
  const javascriptPolicy = javascriptMemory.preparePolicy(policyBytes);
  const javascriptCandidate = javascriptMemory.importPackage(packageBytes, {
    identifier: candidateIdentifier,
  });
  const javascriptContext = javascriptMemory.capturePolicyFactContext(javascriptCandidate);
  const javascriptEvaluation = javascriptMemory.evaluatePolicy(
    javascriptPolicy,
    javascriptContext,
  );
  const handoff = await readJson(MO1302_HANDOFF_PATH);
  assert.deepEqual(
    {
      artifactKind: javascriptPolicy.kind,
      semanticDigest: javascriptPolicy.semanticDigest,
    },
    handoff.policyPin,
  );
  assertEvaluationIdentityCrossBindsContractPin(
    javascriptEvaluation.evaluationIdentity,
    handoff.contractIdentityPin,
  );
  const expected = {
    canonicalPolicyBytesBase64: Buffer.from(javascriptPolicy.toBytes()).toString("base64"),
    decision: javascriptEvaluation.decision,
    documentDigest: javascriptPolicy.documentDigest,
    evaluationIdentityBytesBase64: Buffer.from(
      javascriptEvaluation.evaluationIdentityBytes(),
    ).toString("base64"),
    evaluationIdentityDigest: javascriptEvaluation.evaluationIdentityDigest,
    outcomeBytesBase64: Buffer.from(
      javascriptEvaluation.canonicalOutcomeBytes(),
    ).toString("base64"),
    outcomeDigest: javascriptEvaluation.outcomeDigest,
    semanticDigest: javascriptPolicy.semanticDigest,
  };
  assert.equal(expected.decision, "PASS");

  const pythonScript = [
    "import base64, json, os, sys",
    "from memoryos import MemoryOS",
    "request = json.load(sys.stdin)",
    "package_bytes = base64.b64decode(request['packageBytesBase64'])",
    "policy_bytes = base64.b64decode(request['policyBytesBase64'])",
    "with MemoryOS(node_executable=os.environ['MEMORYOS_NODE']) as memory:",
    "    prepared = memory.prepare_policy(policy_bytes)",
    "    candidate = memory.import_package(package_bytes, identifier=request['candidateIdentifier'])",
    "    context = memory.capture_policy_fact_context(candidate)",
    "    evaluation = memory.evaluate_policy(prepared, context)",
    "    result = {",
    "        'canonicalPolicyBytesBase64': base64.b64encode(prepared.canonical_bytes).decode('ascii'),",
    "        'decision': evaluation.decision,",
    "        'documentDigest': prepared.document_digest,",
    "        'evaluationIdentityBytesBase64': base64.b64encode(evaluation.evaluation_identity_bytes).decode('ascii'),",
    "        'evaluationIdentityDigest': evaluation.evaluation_identity_digest,",
    "        'outcomeBytesBase64': base64.b64encode(evaluation.canonical_outcome_bytes).decode('ascii'),",
    "        'outcomeDigest': evaluation.outcome_digest,",
    "        'semanticDigest': prepared.semantic_digest,",
    "    }",
    "    print(json.dumps(result, separators=(',', ':'), sort_keys=True))",
  ].join("\n");
  const pythonResult = spawnSync(pythonExecutable(), ["-c", pythonScript], {
    cwd: MO1301_WORKSPACE_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      MEMORYOS_NODE: process.execPath,
      PYTHONPATH: resolve(MO1301_WORKSPACE_ROOT, "repositories/cca-sdk/python/src"),
    },
    input: JSON.stringify({
      candidateIdentifier,
      packageBytesBase64: Buffer.from(packageBytes).toString("base64"),
      policyBytesBase64: Buffer.from(policyBytes).toString("base64"),
    }),
    maxBuffer: 16 * 1024 * 1024,
    timeout: 30_000,
    windowsHide: true,
  });
  assert.ifError(pythonResult.error);
  assert.equal(pythonResult.status, 0, pythonResult.stderr);
  assert.equal(pythonResult.stderr, "");
  assert.deepEqual(JSON.parse(pythonResult.stdout), expected);

  const bridgeRequests = [
    {
      id: 0,
      method: "preparePolicy",
      params: { bytesBase64: Buffer.from(policyBytes).toString("base64") },
      version: "1.0.0",
    },
    {
      id: 1,
      method: "importPackage",
      params: {
        bytesBase64: Buffer.from(packageBytes).toString("base64"),
        identifier: candidateIdentifier,
        supportedExtensions: [],
      },
      version: "1.0.0",
    },
    {
      id: 2,
      method: "capturePolicyFactContext",
      params: { investigationIdentifier: candidateIdentifier },
      version: "1.0.0",
    },
    {
      id: 3,
      method: "evaluatePolicy",
      params: {
        artifactBytesBase64: Buffer.from(policyBytes).toString("base64"),
        policyFactContextToken: "policy-fact-context:0",
      },
      version: "1.0.0",
    },
  ];
  const bridgeResult = spawnSync(process.execPath, [resolve(
    MO1301_WORKSPACE_ROOT,
    "repositories/cca-sdk/bridge/investigation-core-host.mjs",
  )], {
    cwd: MO1301_WORKSPACE_ROOT,
    encoding: "utf8",
    input: `${bridgeRequests.map((request) => JSON.stringify(request)).join("\n")}\n`,
    maxBuffer: 16 * 1024 * 1024,
    timeout: 30_000,
    windowsHide: true,
  });
  assert.ifError(bridgeResult.error);
  assert.equal(bridgeResult.status, 0, bridgeResult.stderr);
  assert.equal(bridgeResult.stderr, "");
  const bridge = bridgeResult.stdout.trimEnd().split("\n").map((line) => JSON.parse(line));
  assert.deepEqual(bridge.map(({ id, ok }) => ({ id, ok })), [
    { id: 0, ok: true },
    { id: 1, ok: true },
    { id: 2, ok: true },
    { id: 3, ok: true },
  ]);
  assert.deepEqual({
    canonicalPolicyBytesBase64: bridge[0].result.bytesBase64,
    decision: bridge[3].result.decision,
    documentDigest: bridge[0].result.documentDigest,
    evaluationIdentityBytesBase64: bridge[3].result.evaluationIdentityBytesBase64,
    evaluationIdentityDigest: bridge[3].result.evaluationIdentityDigest,
    outcomeBytesBase64: bridge[3].result.canonicalOutcomeBytesBase64,
    outcomeDigest: bridge[3].result.outcomeDigest,
    semanticDigest: bridge[0].result.semanticDigest,
  }, expected);

  const temporaryDirectory = await mkdtemp(join(tmpdir(), "memoryos-mo1301-parity-"));
  try {
    const policyPath = join(temporaryDirectory, "policy.json");
    const packagePath = join(temporaryDirectory, "candidate.mip.json");
    const canonicalPolicyPath = join(temporaryDirectory, "canonical-policy.json");
    const identityPath = join(temporaryDirectory, "evaluation-identity.json");
    const identityDigestPath = join(temporaryDirectory, "evaluation-identity.sha256");
    const outcomePath = join(temporaryDirectory, "outcome.json");
    const outcomeDigestPath = join(temporaryDirectory, "outcome.sha256");
    await writeFile(policyPath, policyBytes);
    await writeFile(packagePath, packageBytes);

    const digestResult = runCli([
      "policy", "digest", "--policy", policyPath,
      "--canonical-output", canonicalPolicyPath, "--json",
    ]);
    assert.equal(digestResult.status, 0, digestResult.stderr);
    const digest = parseCliJson(digestResult).result;

    const evaluationResult = runCli([
      "policy", "evaluate", "--policy", policyPath, "--package", packagePath,
      "--outcome", outcomePath, "--identity-output", identityPath,
      "--evaluation-identity-digest-output", identityDigestPath,
      "--outcome-digest-output", outcomeDigestPath, "--json",
    ]);
    assert.equal(evaluationResult.status, 0, evaluationResult.stderr);
    const evaluation = parseCliJson(evaluationResult).result;
    assert.deepEqual({
      canonicalPolicyBytesBase64: Buffer.from(await readFile(canonicalPolicyPath)).toString("base64"),
      decision: evaluation.decision,
      documentDigest: digest.documentDigest,
      evaluationIdentityBytesBase64: Buffer.from(await readFile(identityPath)).toString("base64"),
      evaluationIdentityDigest: (await readFile(identityDigestPath, "ascii")),
      outcomeBytesBase64: Buffer.from(await readFile(outcomePath)).toString("base64"),
      outcomeDigest: (await readFile(outcomeDigestPath, "ascii")),
      semanticDigest: digest.semanticDigest,
    }, expected);
  } finally {
    await rm(temporaryDirectory, { recursive: true });
  }
});

test("CLI 1.1 exposes exactly the seven frozen Policy commands", () => {
  assert.deepEqual(policyCommandNames, [
    "validate", "digest", "inspect", "evaluate", "verify-identity", "verify-outcome", "identities",
  ]);
  const versionResult = runCli(["version", "--json"]);
  assert.equal(versionResult.status, 0, versionResult.stderr);
  const version = parseCliJson(versionResult);
  assert.equal(version.result.cliVersion, "1.1.0");
  assert.equal(version.result.sdkVersion, "1.1.0");
});

test("the registered Phase 1-4, Python, and CLI Policy suites are green through conformance", () => {
  for (const paths of [
    [
      "repositories/cca-studio/tests/policy_canonical_test.mjs",
      "repositories/cca-studio/tests/investigation_policy_contracts_test.mjs",
      "repositories/cca-studio/tests/investigation_policy_test.mjs",
    ],
    [
      "repositories/cca-studio/tests/policy_fact_context_test.mjs",
      "repositories/cca-studio/tests/regression_policy_fact_source_test.mjs",
    ],
    ["repositories/cca-studio/tests/investigation_policy_engine_test.mjs"],
    ["repositories/cca-studio/tests/memoryos_policy_sdk_test.mjs"],
    ["repositories/memoryos-cli/tests/policy-cli.test.mjs"],
  ]) {
    runFocusedNodeSuite(paths);
  }

  const pythonResult = spawnSync(pythonExecutable(), [
    "-m", "unittest", "repositories/cca-sdk/python/tests/test_investigation_policy_sdk.py", "-v",
  ], {
    cwd: MO1301_WORKSPACE_ROOT,
    encoding: "utf8",
    env: {
      ...process.env,
      MEMORYOS_NODE: process.execPath,
      PYTHONPATH: resolve(MO1301_WORKSPACE_ROOT, "repositories/cca-sdk/python/src"),
    },
    maxBuffer: 32 * 1024 * 1024,
    timeout: 120_000,
    windowsHide: true,
  });
  assert.ifError(pythonResult.error);
  assert.equal(pythonResult.status, 0, `${pythonResult.stdout}\n${pythonResult.stderr}`);
});
