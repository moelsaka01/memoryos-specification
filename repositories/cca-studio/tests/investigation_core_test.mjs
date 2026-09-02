import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { referenceSnapshot } from "../web/data/studio-snapshot.js";
import { anthropicSdkAdapter } from "../web/js/adapters/anthropic-sdk-adapter.js";
import { langGraphAdapter } from "../web/js/adapters/langgraph-adapter.js";
import { openAIAgentsSdkAdapter } from "../web/js/adapters/openai-agents-sdk-adapter.js";
import {
  buildComparativeReconstruction,
} from "../web/js/cognitive-comparative-reconstruction.js";
import {
  nextComparativeStep,
} from "../web/js/cognitive-comparative-replay.js";
import { compareCognitiveEvolution } from "../web/js/cognitive-evolution.js";
import { buildCognitiveReplay, nextReplayStep } from "../web/js/cognitive-replay.js";
import { buildCognitiveTrace } from "../web/js/cognitive-trace.js";
import {
  Checkpoint,
  ComparisonSession,
  Investigation,
  InvestigationCore,
  InvestigationCoreError,
  InvestigationState,
  INVESTIGATION_CORE_VERSION,
  LifecycleState,
  ReplaySession,
  TransitionLog,
  VerificationSession,
  investigationAvailability,
  investigationPhase,
  projectInvestigation,
} from "../web/js/investigation-core.js";
import {
  exportMemoryInvestigationPackage,
  importMemoryInvestigationPackage,
  verifyMemoryInvestigationPackage,
} from "../web/js/memory-investigation-package.js";
import { canonicalize, sha256Hex } from "../web/js/mip-canonical.js";
import { cloneDetached } from "../web/js/studio-model.js";
import {
  referenceSource,
} from "./fixtures/adapters/reference-sources.mjs";

const mipFixtures = Object.freeze({
  complete: "complete-investigation.mip.b64",
  extended: "noncritical-extension.mip.b64",
  minimal: "minimal-observation.mip.b64",
});

const adapterReferences = Object.freeze({
  "openai-agents": openAIAgentsSdkAdapter,
  anthropic: anthropicSdkAdapter,
  langgraph: langGraphAdapter,
});

async function mipFixture(name) {
  const encoded = await readFile(new URL(`./fixtures/mip/${mipFixtures[name]}`, import.meta.url), "ascii");
  return new Uint8Array(Buffer.from(encoded.trim(), "base64"));
}

function adapterRequest(name) {
  return {
    observationIdentifier: `observation-${name}-core`,
    observationSequence: 0,
    packageIdentifier: `mip-${name}-core`,
    sourceVersion: "reference-fixture-1.0.0",
    workspaceIdentifier: "workspace-investigation-core-adapter",
  };
}

function changedSnapshot() {
  const value = cloneDetached(referenceSnapshot);
  value.observationIdentifier = "observation-investigation-core-second";
  value.longTermMemory.entries[0].value = "Deterministically changed evidence.";
  value.semanticMemory.concepts[0].meaning = "Deterministically changed semantic meaning.";
  value.retrievalSessions[0].candidates[0].rankScore += 1;
  value.reflections[0].knowledge = "Deterministically changed reflection.";
  return value;
}

function reflectionKey(investigation, frame = investigation.state.currentFrame) {
  const node = frame.world.nodes.find(({ observationPath }) => observationPath === "Reflection.values[0]")
    ?? frame.world.nodes.find(({ family, identifier }) => (
      family === "Reflection" && identifier === "reflection-release-integrity"
    ));
  assert.ok(node, "the released reference fixture must expose an exact Reflection target");
  return node.key;
}

function nativePair(identifier = "investigation-native-pair") {
  const core = new InvestigationCore();
  core.create({ identifier, snapshot: referenceSnapshot });
  const investigation = core.observe(identifier, { snapshot: changedSnapshot() });
  return { core, identifier, investigation, targetNodeKey: reflectionKey(investigation) };
}

function completeReplay(core, identifier) {
  let investigation = core.load(identifier);
  let guard = 0;
  while (investigation.state.replayState.status !== "completed") {
    investigation = core.replay(identifier, "next");
    guard += 1;
    assert.ok(guard < 10_000, "Replay must terminate within its finite source-authored steps");
  }
  return investigation;
}

function assertCoreFailure(action, code, operation = undefined) {
  assert.throws(action, (error) => {
    assert.ok(error instanceof InvestigationCoreError);
    assert.equal(error.code, code);
    if (operation !== undefined) assert.equal(error.operation, operation);
    assert.equal(Object.isFrozen(error.diagnostics), true);
    assert.deepEqual(Object.keys(error.diagnostics[0]).slice(0, 3), ["code", "operation", "message"]);
    return true;
  });
}

function assertAtomicFailure(core, identifier, action, code, operation = undefined) {
  const before = core.load(identifier);
  const projection = canonicalize(structuredClone(projectInvestigation(before)));
  assertCoreFailure(action, code, operation);
  const after = core.load(identifier);
  assert.equal(after.transitionLog.digest, before.transitionLog.digest);
  assert.equal(after.transitionLog.transitions.length, before.transitionLog.transitions.length);
  assert.equal(canonicalize(structuredClone(projectInvestigation(after))), projection);
}

test("MO-1203 exposes the closed immutable Investigation Core contract", () => {
  assert.equal(INVESTIGATION_CORE_VERSION, "1.0.0");
  assert.deepEqual(Object.values(LifecycleState), [
    "Created", "Observed", "Traced", "ReplayReady", "Replaying",
    "ReplayComplete", "ComparisonReady", "Comparing", "Verified", "Archived",
  ]);

  const core = new InvestigationCore();
  const created = core.create({
    identifier: "investigation-contract",
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
  });
  assert.ok(created instanceof Investigation);
  assert.ok(created.state instanceof InvestigationState);
  assert.equal(created.state.lifecycle, LifecycleState.Created);
  assert.equal(investigationPhase(created), "observe");
  assert.deepEqual(created.transitionLog.transitions.map(({ kind }) => kind), ["CREATED"]);
  assert.equal(Object.isFrozen(created), true);
  assert.equal(Object.isFrozen(created.state), true);
  assert.equal(Object.isFrozen(created.transitionLog), true);
  assert.equal(Object.isFrozen(projectInvestigation(created)), true);
  assert.equal(Object.isFrozen(investigationAvailability(created)), true);

  const observed = core.observe(created.identifier, { snapshot: referenceSnapshot });
  assert.equal(observed.state.lifecycle, LifecycleState.Observed);
  assert.equal(observed.state.observationFrames.length, 1);
  assert.equal(investigationPhase(observed), "observe");

  const traced = core.trace(observed.identifier, reflectionKey(observed));
  assert.equal(traced.state.lifecycle, LifecycleState.ReplayReady);
  assert.equal(investigationPhase(traced), "trace");
  assert.ok(traced.state.replaySession instanceof ReplaySession);
  assert.deepEqual(traced.transitionLog.transitions.slice(-2).map(({ kind }) => kind), [
    "TRACE_SELECTED", "REPLAY_PREPARED",
  ]);

  const verified = core.verify(traced.identifier);
  assert.equal(verified.state.lifecycle, LifecycleState.Verified);
  assert.ok(verified.state.verificationSession instanceof VerificationSession);
  assert.equal(verified.state.verificationSession.status, "passed");
  assert.ok(verified.state.verificationSession.checks.some(({ code }) => code === "TRACE"));
  assert.ok(verified.state.verificationSession.checks.some(({ code }) => code === "REPLAY"));

  const archived = core.archive(verified.identifier);
  assert.equal(archived.state.lifecycle, LifecycleState.Archived);
  assert.equal(investigationPhase(archived), "archived");
  assert.deepEqual(investigationAvailability(archived), {
    trace: false,
    replay: false,
    compare: false,
    comparative: false,
    verify: false,
    checkpoint: true,
    export: false,
  });
  assertAtomicFailure(
    core,
    archived.identifier,
    () => core.observe(archived.identifier, { snapshot: referenceSnapshot }),
    "INVALID_TRANSITION",
  );
});

test("MO-1203 lifecycle executes Observe Trace Replay Compare and exact return transitions", () => {
  const { core, identifier, targetNodeKey } = nativePair("investigation-lifecycle");
  let investigation = core.trace(identifier, targetNodeKey);
  assert.equal(investigation.state.lifecycle, LifecycleState.ReplayReady);
  assert.equal(investigationPhase(investigation), "trace");

  investigation = core.replay(identifier, "play");
  assert.equal(investigation.state.lifecycle, LifecycleState.Replaying);
  assert.equal(investigationPhase(investigation), "replay");
  investigation = completeReplay(core, identifier);
  assert.equal(investigation.state.lifecycle, LifecycleState.ReplayComplete);

  const replayCheckpoint = investigation.state.replayState;
  investigation = core.compare(identifier, "enter");
  assert.equal(investigation.state.lifecycle, LifecycleState.ComparisonReady);
  assert.equal(investigationPhase(investigation), "evolution");
  assert.ok(investigation.state.comparisonSession instanceof ComparisonSession);
  assert.equal(investigation.state.activeTrace, null);
  assert.equal(investigation.state.activeReplay, null);

  investigation = core.compare(identifier, "start");
  assert.equal(investigation.state.lifecycle, LifecycleState.Comparing);
  assert.equal(investigationPhase(investigation), "compare");
  assert.equal(investigation.state.comparativeReplayState.status, "ready");

  investigation = core.compare(identifier, "back");
  assert.equal(investigation.state.lifecycle, LifecycleState.ComparisonReady);
  assert.equal(investigationPhase(investigation), "evolution");
  investigation = core.compare(identifier, "back");
  assert.equal(investigation.state.lifecycle, LifecycleState.ReplayComplete);
  assert.equal(investigationPhase(investigation), "replay");
  assert.deepEqual(investigation.state.replayState, replayCheckpoint);
  assert.equal(investigation.state.activeTrace.targetNodeKey, targetNodeKey);

  investigation = core.returnToWorld(identifier);
  assert.equal(investigation.state.lifecycle, LifecycleState.Observed);
  assert.equal(investigationPhase(investigation), "observe");
  assert.equal(investigation.state.activeTrace, null);
  assert.equal(investigation.state.activeReplay, null);
  assert.equal(investigation.state.evolution, null);
  assert.equal(investigation.state.observationFrames.length, 2);
});

test("MO-1203 Replay and comparison are exact projections of the released deterministic engines", () => {
  const { core, identifier, investigation: observed, targetNodeKey } = nativePair("investigation-parity");
  const expectedTrace = buildCognitiveTrace(observed.state.currentFrame, targetNodeKey);
  const expectedReplay = buildCognitiveReplay(expectedTrace);
  let investigation = core.trace(identifier, targetNodeKey);
  assert.deepEqual(investigation.state.activeTrace, expectedTrace);
  assert.deepEqual(investigation.state.activeReplay, expectedReplay);

  const directNext = nextReplayStep(expectedReplay, investigation.state.replayState);
  investigation = core.replay(identifier, "next");
  assert.deepEqual(investigation.state.replayState, directNext);
  investigation = completeReplay(core, identifier);

  const [fromFrame, toFrame] = investigation.state.observationFrames;
  const expectedEvolution = compareCognitiveEvolution(fromFrame, toFrame);
  investigation = core.compare(identifier, "enter");
  assert.deepEqual(investigation.state.evolution, expectedEvolution);

  const fromTrace = buildCognitiveTrace(fromFrame, targetNodeKey);
  const toTrace = buildCognitiveTrace(toFrame, targetNodeKey);
  const expectedComparison = buildComparativeReconstruction(fromFrame, fromTrace, toFrame, toTrace);
  investigation = core.compare(identifier, "start");
  assert.deepEqual(investigation.state.comparativeReconstruction, expectedComparison);
  const expectedStep = nextComparativeStep(expectedComparison, investigation.state.comparativeReplayState);
  investigation = core.compare(identifier, "nextStep");
  assert.deepEqual(investigation.state.comparativeReplayState, expectedStep);
  assert.deepEqual(
    investigation.state.comparisonSession.view,
    projectInvestigation(investigation).comparativeView,
  );
});

test("MO-1203 transition logs are canonical digest-bound deterministic truth", () => {
  const run = () => {
    const { core, identifier, targetNodeKey } = nativePair("investigation-log-determinism");
    core.trace(identifier, targetNodeKey);
    core.replay(identifier, "next");
    core.replay(identifier, "previous");
    core.verify(identifier);
    return core.load(identifier);
  };
  const first = run();
  const second = run();
  assert.deepEqual(first.transitionLog, second.transitionLog);
  assert.equal(first.transitionLog.digest, second.transitionLog.digest);
  assert.deepEqual(
    first.transitionLog.transitions.map(({ index }) => index),
    first.transitionLog.transitions.map((_, index) => index),
  );
  first.transitionLog.transitions.forEach((transition, index) => {
    assert.equal(Object.isFrozen(transition), true);
    assert.equal(Object.isFrozen(transition.payload), true);
    assert.equal(transition.investigationIdentifier, first.identifier);
    assert.equal(
      transition.previousLogDigest,
      index === 0
        ? new TransitionLog(first.identifier).digest
        : new TransitionLog(first.identifier, first.transitionLog.transitions.slice(0, index)).digest,
    );
  });
  first.transitionLog.transitions.forEach((transition) => {
    assert.deepEqual(Object.keys(transition), [
      "kind", "version", "investigationIdentifier", "index", "payload",
      "previousLogDigest", "identifier",
    ]);
    for (const key of ["timestamp", "duration", "camera", "layout", "timer", "random"]) {
      assert.equal(Object.hasOwn(transition, key), false);
      assert.equal(Object.hasOwn(transition.payload, key), false);
    }
  });
  const tampered = {
    ...first.transitionLog.transitions[0],
    identifier: `sha256:${"0".repeat(64)}`,
    unknown: true,
  };
  assertCoreFailure(
    () => new TransitionLog(first.identifier, [tampered]),
    "INVALID_TRANSITION",
    "transitionLog",
  );

  const core = new InvestigationCore();
  let noOp = core.create({ identifier: "investigation-log-noop", snapshot: referenceSnapshot });
  noOp = core.trace(noOp.identifier, reflectionKey(noOp));
  const before = noOp.transitionLog;
  noOp = core.replay(noOp.identifier, "pause");
  assert.equal(noOp.transitionLog.digest, before.digest);
  assert.equal(noOp.transitionLog.transitions.length, before.transitions.length);
});

test("MO-1203 invalid commands and transitions fail atomically with closed diagnostics", () => {
  const core = new InvestigationCore();
  const investigation = core.create({ identifier: "investigation-atomicity", snapshot: referenceSnapshot });
  assertAtomicFailure(core, investigation.identifier, () => core.replay(investigation.identifier, "invented"), "INVALID_COMMAND", "replay");
  assertAtomicFailure(core, investigation.identifier, () => core.compare(investigation.identifier, "enter"), "INVALID_TRANSITION", "compare");
  const semantic = investigation.state.currentFrame.world.nodes.find(({ family }) => family === "SemanticMemory");
  assert.ok(semantic);
  assertAtomicFailure(core, investigation.identifier, () => core.trace(investigation.identifier, semantic.key), "INVALID_INPUT", "trace");
  assertAtomicFailure(core, investigation.identifier, () => core.export(investigation.identifier), "CAPABILITY_UNAVAILABLE", "export");

  const foreign = cloneDetached(referenceSnapshot);
  foreign.workspaceIdentifier = "workspace-foreign";
  assertAtomicFailure(
    core,
    investigation.identifier,
    () => core.observe(investigation.identifier, { snapshot: foreign }),
    "WORKSPACE_MISMATCH",
    "observe",
  );
  const polluted = cloneDetached(referenceSnapshot);
  polluted.runtimeState = { apiKey: "must-not-enter-authoritative-history" };
  assertAtomicFailure(
    core,
    investigation.identifier,
    () => core.observe(investigation.identifier, { snapshot: polluted }),
    "INVALID_INPUT",
    "observe",
  );
});

test("MO-1203 verification is point-in-time evidence and later changes require reverification", () => {
  const core = new InvestigationCore();
  let investigation = core.create({ identifier: "investigation-verification-boundary", snapshot: referenceSnapshot });
  investigation = core.trace(investigation.identifier, reflectionKey(investigation));
  investigation = core.verify(investigation.identifier);
  const verifiedDigest = investigation.transitionLog.digest;
  assert.equal(investigation.state.verificationSession.transitionLogDigest, verifiedDigest);
  investigation = core.replay(investigation.identifier, "next");
  assert.equal(investigation.state.lifecycle, LifecycleState.Replaying);
  assert.equal(investigation.state.verificationSession, null);
  investigation = core.verify(investigation.identifier);
  assert.notEqual(investigation.state.verificationSession.transitionLogDigest, verifiedDigest);
  assert.equal(investigation.state.verificationSession.transitionLogDigest, investigation.transitionLog.digest);
});

test("MO-1203 accepted observations rebuild valid active traces without moving semantic geography", () => {
  const core = new InvestigationCore();
  let investigation = core.create({ identifier: "investigation-observation-rebuild", snapshot: referenceSnapshot });
  const targetNodeKey = reflectionKey(investigation);
  investigation = core.trace(investigation.identifier, targetNodeKey);
  const priorTraceIdentifier = investigation.state.activeTrace.identifier;
  investigation = core.observe(investigation.identifier, { snapshot: changedSnapshot() });
  assert.equal(investigation.state.lifecycle, LifecycleState.ReplayReady);
  assert.equal(investigation.state.activeTrace.targetNodeKey, targetNodeKey);
  assert.notEqual(investigation.state.activeTrace.identifier, priorTraceIdentifier);
  assert.equal(investigation.state.activeTrace.frameIdentifier, investigation.state.currentFrame.world.frame.identifier);
  assert.equal(investigation.state.replayState.status, "ready");
  assert.equal(investigation.state.traceDiagnostic, null);
});

test("MO-1203 checkpoints restore exact immutable state and reject stale or forged history", () => {
  const { core, identifier, targetNodeKey } = nativePair("investigation-checkpoint");
  core.trace(identifier, targetNodeKey);
  core.replay(identifier, "next");
  const expected = core.load(identifier);
  const checkpoint = core.checkpoint(identifier);
  assert.ok(checkpoint instanceof Checkpoint);
  assert.equal(Object.isFrozen(checkpoint), true);
  assert.equal(checkpoint.transitionLogDigest, expected.transitionLog.digest);
  assert.equal(checkpoint.transitionCount, expected.transitionLog.transitions.length);

  const restoredCore = new InvestigationCore();
  const restored = restoredCore.restore(checkpoint);
  assert.deepEqual(restored.transitionLog, expected.transitionLog);
  assert.equal(canonicalize(projectInvestigation(restored)), canonicalize(projectInvestigation(expected)));
  assert.deepEqual(restoredCore.restore(checkpoint), restored);

  restoredCore.replay(identifier, "next");
  const advanced = restoredCore.load(identifier);
  assertCoreFailure(() => restoredCore.restore(checkpoint), "CHECKPOINT_MISMATCH", "restore");
  assert.equal(restoredCore.load(identifier).transitionLog.digest, advanced.transitionLog.digest);
  assertCoreFailure(() => new InvestigationCore().restore(structuredClone(checkpoint)), "CHECKPOINT_MISMATCH", "restore");
});

test("MO-1203 complete MIP import export verification and capability playback are exact", async () => {
  const bytes = await mipFixture("complete");
  assert.equal(bytes.length, 19_519);
  assert.equal(sha256Hex(bytes), "176b81ef6caecdd6db19caf5ae4e0cdd89fe1f30b43f79d485eb72c6e3b96f32");
  const core = new InvestigationCore();
  let investigation = core.import(bytes, { identifier: "investigation-complete-mip" });
  assert.equal(investigation.state.lifecycle, LifecycleState.Observed);
  assert.equal(investigationPhase(investigation), "observe");
  assert.deepEqual(investigation.state.packageObservations.map(({ sequence }) => sequence), [10, 20]);
  assert.deepEqual(investigationAvailability(investigation), {
    trace: true,
    replay: false,
    compare: false,
    comparative: false,
    verify: true,
    checkpoint: true,
    export: true,
  });
  assert.deepEqual(core.export(investigation.identifier), bytes);

  investigation = core.trace(investigation.identifier, "trace-observation-b");
  assert.equal(investigation.state.activeTrace.identifier, "trace-observation-b");
  assert.equal(investigation.state.activeReplay.identifier, "replay-observation-b");
  assert.equal(Object.hasOwn(investigation.state.activeReplay, "kind"), false,
    "MIP Replay truth must not masquerade as a native MemoryOS 1.1 artifact");
  assert.equal(investigation.state.replaySession.view.kind, "MemoryOSInvestigationPackageReplayView");
  investigation = completeReplay(core, investigation.identifier);
  investigation = core.compare(investigation.identifier, "enter");
  assert.equal(investigation.state.evolution.identifier, "evolution-observation-a-observation-b");
  investigation = core.compare(investigation.identifier, "start");
  assert.equal(investigation.state.comparativeReconstruction.identifier, "comparative-observation-a-observation-b");
  assert.equal(Object.hasOwn(investigation.state.comparativeReconstruction, "kind"), false,
    "MIP Comparative truth must remain the exact source artifact");
  assert.equal(investigation.state.comparisonSession.view.kind, "MemoryOSInvestigationPackageComparativeView");
  investigation = core.verify(investigation.identifier);
  assert.equal(investigation.state.verificationSession.status, "passed");
  assert.ok(investigation.state.verificationSession.checks.some(({ code }) => code === "MIP"));
  assert.deepEqual(core.export(investigation.identifier), bytes);

  const exportedText = new TextDecoder().decode(core.export(investigation.identifier));
  assert.doesNotMatch(exportedText, /transitionLog|checkpoint|replayState|lifecycle|camera|layout/);
});

test("MO-1203 MIP failures are atomic and observation-only packages never fabricate capabilities", async () => {
  const minimalBytes = await mipFixture("minimal");
  const core = new InvestigationCore();
  const minimal = core.import(minimalBytes, { identifier: "investigation-minimal-mip" });
  assert.equal(minimal.state.package.traces.length, 0);
  assert.equal(minimal.state.package.replays.length, 0);
  assert.equal(minimal.state.package.evolutions.length, 0);
  assert.equal(minimal.state.package.comparativeReconstructions.length, 0);
  assert.equal(investigationAvailability(minimal).trace, false);
  assertAtomicFailure(
    core,
    minimal.identifier,
    () => core.trace(minimal.identifier, { targetIdentifier: "reflection-absent" }),
    "CAPABILITY_UNAVAILABLE",
    "trace",
  );

  const corrupted = minimalBytes.slice();
  corrupted[corrupted.length - 2] ^= 1;
  assert.throws(() => core.import(corrupted, { identifier: "investigation-corrupt-mip" }));
  assertCoreFailure(() => core.load("investigation-corrupt-mip"), "NOT_FOUND", "load");
  assert.deepEqual(core.export(minimal.identifier), minimalBytes);

  const extended = await mipFixture("extended");
  const extendedInvestigation = core.import(extended, { identifier: "investigation-extended-mip" });
  assert.deepEqual(core.export(extendedInvestigation.identifier), extended);

  const extensionPackage = importMemoryInvestigationPackage(extended);
  const extensionName = Object.keys(extensionPackage.extensions)[0];
  const criticalSource = cloneDetached(extensionPackage);
  criticalSource.extensions[extensionName].critical = true;
  const criticalBytes = exportMemoryInvestigationPackage({
    packageIdentifier: "mip-critical-extension-core",
    workspaceIdentifier: criticalSource.manifest.workspaceIdentifier,
    metadata: criticalSource.metadata,
    observations: criticalSource.observations,
    traces: criticalSource.traces,
    replays: criticalSource.replays,
    evolutions: criticalSource.evolutions,
    comparativeReconstructions: criticalSource.comparativeReconstructions,
    extensions: criticalSource.extensions,
    sourceAccepted: true,
    sourceAuthorshipAttested: true,
  }, { supportedExtensions: [extensionName] });
  const critical = core.import(criticalBytes, {
    identifier: "investigation-critical-extension-mip",
    supportedExtensions: [extensionName],
  });
  assert.deepEqual(core.export(critical.identifier), criticalBytes);
  assert.equal(core.verify(critical.identifier).state.verificationSession.status, "passed");
});

test("MO-1203 generic adapter handoff imports observation truth without invented cognition", async () => {
  for (const [name, adapter] of Object.entries(adapterReferences)) {
    const request = adapterRequest(name);
    const bytes = await adapter.exportInvestigation(await referenceSource(name), request);
    assert.equal(verifyMemoryInvestigationPackage(bytes).valid, true, name);
    const core = new InvestigationCore();
    const investigation = core.import(bytes, { identifier: `investigation-adapter-${name}` });
    assert.equal(investigation.state.sourceKind, "mip", name);
    assert.equal(investigation.state.packageObservations.length, 1, name);
    assert.deepEqual(investigation.state.package.traces, [], name);
    assert.deepEqual(investigation.state.package.replays, [], name);
    assert.deepEqual(investigation.state.package.evolutions, [], name);
    assert.deepEqual(investigation.state.package.comparativeReconstructions, [], name);
    assert.deepEqual(investigationAvailability(investigation), {
      trace: false,
      replay: false,
      compare: false,
      comparative: false,
      verify: true,
      checkpoint: true,
      export: true,
    }, name);
    assert.deepEqual(core.export(investigation.identifier), bytes, name);
  }
});

test("MO-1203 instances, investigations, and caller inputs remain isolated under concurrent use", async () => {
  const first = new InvestigationCore();
  const second = new InvestigationCore();
  const firstInitial = first.create({ identifier: "shared-identifier", snapshot: referenceSnapshot });
  const secondInitial = second.create({ identifier: "shared-identifier", snapshot: referenceSnapshot });
  first.observe(firstInitial.identifier, { snapshot: changedSnapshot() });
  assert.equal(first.load(firstInitial.identifier).state.observationFrames.length, 2);
  assert.equal(second.load(secondInitial.identifier).state.observationFrames.length, 1);
  assert.notEqual(first.load(firstInitial.identifier).transitionLog.digest, second.load(secondInitial.identifier).transitionLog.digest);

  const third = first.create({ identifier: "independent-identifier", snapshot: referenceSnapshot });
  const thirdDigest = third.transitionLog.digest;
  first.returnToWorld(firstInitial.identifier);
  assert.equal(first.load(third.identifier).transitionLog.digest, thirdDigest);

  const trapped = cloneDetached(referenceSnapshot);
  let getterRead = false;
  Object.defineProperty(trapped, "reentrant", {
    enumerable: true,
    get() {
      getterRead = true;
      first.returnToWorld(third.identifier);
      return "must-not-run";
    },
  });
  assertAtomicFailure(
    first,
    third.identifier,
    () => first.observe(third.identifier, { snapshot: trapped }),
    "INVALID_INPUT",
    "observe",
  );
  assert.equal(getterRead, false);

  const handoffs = await Promise.all(Object.entries(adapterReferences).map(async ([name, adapter]) => {
    const bytes = await adapter.exportInvestigation(await referenceSource(name), adapterRequest(`parallel-${name}`));
    const core = new InvestigationCore();
    return core.import(bytes, { identifier: `parallel-${name}` });
  }));
  assert.equal(new Set(handoffs.map(({ identifier }) => identifier)).size, handoffs.length);
  assert.ok(handoffs.every(({ state }) => state.packageObservations.length === 1));
});

test("MO-1203 Investigation Core is headless provider-neutral and renderer-independent", async () => {
  const source = await readFile(new URL("../web/js/investigation-core.js", import.meta.url), "utf8");
  assert.doesNotMatch(source, /\b(?:window|document|HTMLElement|localStorage|sessionStorage|requestAnimationFrame|setTimeout|setInterval|Date\.now|Math\.random)\b/);
  assert.doesNotMatch(source, /(?:openai-agents|anthropic-sdk|langgraph)-adapter\.js/);
  assert.doesNotMatch(source, /from\s+["']\.\/(?:app|graph)\.js["']/);
  assert.doesNotMatch(source, /\.style\b|querySelector|addEventListener|classList/);
  const imports = [...source.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
  assert.ok(imports.every((value) => value.startsWith("./")));
  assert.ok(imports.includes("./memory-investigation-package.js"));
  assert.ok(imports.includes("./cognitive-trace.js"));
  assert.ok(imports.includes("./cognitive-replay.js"));
  assert.ok(imports.includes("./cognitive-evolution.js"));
  assert.ok(imports.includes("./cognitive-comparative-reconstruction.js"));
  assert.ok(imports.includes("./cognitive-regression.js"));

  const complete = importMemoryInvestigationPackage(await mipFixture("complete"));
  assert.equal(complete.kind, "MemoryInvestigationPackage");
});
