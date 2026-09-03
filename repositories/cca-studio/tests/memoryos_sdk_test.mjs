import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { referenceSnapshot } from "../web/data/studio-snapshot.js";
import {
  InvestigationCore,
  InvestigationCoreError,
  LifecycleState,
  projectInvestigation,
} from "../web/js/investigation-core.js";
import {
  Checkpoint,
  ComparisonSession,
  Investigation,
  InvestigationQuery,
  InvestigationResult,
  MEMORYOS_SDK_VERSION,
  MemoryInvestigationPackage,
  MemoryOS,
  RegressionReport,
  ReplaySession,
  VerificationResult,
  Workspace,
} from "../web/js/memoryos-sdk.js";
import { canonicalize } from "../web/js/mip-canonical.js";
import { cloneDetached } from "../web/js/studio-model.js";

function changedSnapshot() {
  const value = cloneDetached(referenceSnapshot);
  value.observationIdentifier = "observation-memoryos-sdk-second";
  value.longTermMemory.entries[0].value = "SDK-visible deterministic evidence.";
  value.semanticMemory.concepts[0].meaning = "SDK-visible deterministic meaning.";
  value.retrievalSessions[0].candidates[0].rankScore += 1;
  value.reflections[0].knowledge = "SDK-visible deterministic reflection.";
  return value;
}

function reflectionKey(investigation) {
  const node = investigation.view.currentFrame.world.nodes.find(({ observationPath }) => (
    observationPath === "Reflection.values[0]"
  ));
  assert.ok(node, "the reference view must expose one exact Reflection");
  return node.key;
}

function completeReplay(session) {
  let guard = 0;
  while (session.state.status !== "completed") {
    session.next();
    guard += 1;
    assert.ok(guard < 10_000, "the finite deterministic Replay must complete");
  }
  return session.investigation;
}

function completeCoreReplay(core, identifier) {
  let value = core.load(identifier);
  let guard = 0;
  while (value.state.replayState.status !== "completed") {
    value = core.replay(identifier, "next");
    guard += 1;
    assert.ok(guard < 10_000, "the finite deterministic Core Replay must complete");
  }
  return value;
}

async function completeMipFixture() {
  const encoded = await readFile(new URL("./fixtures/mip/complete-investigation.mip.b64", import.meta.url), "ascii");
  return new Uint8Array(Buffer.from(encoded.trim(), "base64"));
}

test("MO-1204 exposes immutable versioned SDK objects without exposing Core construction", () => {
  const memory = new MemoryOS();
  const workspace = memory.openWorkspace(referenceSnapshot.workspaceIdentifier);
  const investigation = memory.observe(workspace, referenceSnapshot, { identifier: "sdk-contract" });

  assert.equal(MEMORYOS_SDK_VERSION, "1.0.0");
  assert.ok(workspace instanceof Workspace);
  assert.ok(investigation instanceof Investigation);
  assert.equal(workspace.identifier, referenceSnapshot.workspaceIdentifier);
  assert.equal(investigation.lifecycle, LifecycleState.Observed);
  assert.equal(investigation.phase, "observe");
  assert.equal(Object.isFrozen(memory), true);
  assert.equal(Object.isFrozen(workspace), true);
  assert.equal(Object.isFrozen(investigation), true);
  assert.equal(Object.isFrozen(investigation.view), true);
  assert.equal(Object.isFrozen(new InvestigationQuery()), true);
  assert.throws(() => new Workspace(), /created by MemoryOS/);
  assert.throws(() => new Investigation(), /created by MemoryOS/);
  assert.throws(() => new RegressionReport(), /created by MemoryOS/);
});

test("MO-1204 default observation operations preserve cross-language Core parity", () => {
  const memory = new MemoryOS();
  const workspace = memory.openWorkspace(referenceSnapshot.workspaceIdentifier);
  const initial = memory.observe(workspace, referenceSnapshot, {
    identifier: "sdk-default-parity",
  });
  const initialDigest = initial.transitionLog.digest;
  const appended = initial.observe(changedSnapshot());

  assert.equal(
    initialDigest,
    "sha256:73d96188aee03223d8cab1693ea89a5f856a52aca3412250ff0693ad81e1a35e",
  );
  assert.equal(
    appended.transitionLog.digest,
    "sha256:d71ea86ef5987acf507f57dfb61ca538e2ced64bad381cc799828a46060e142b",
  );
  assert.deepEqual(
    appended.transitionLog.transitions.map(({ payload }) => payload.operation).filter(Boolean),
    ["InitialObservation", "Observe"],
  );
});

test("MO-1204 native SDK commands produce the exact Core transition history and projections", () => {
  const identifier = "sdk-core-parity";
  const memory = new MemoryOS();
  const workspace = memory.openWorkspace(referenceSnapshot.workspaceIdentifier);
  let investigation = memory.observe(workspace, referenceSnapshot, { identifier });
  const core = new InvestigationCore();
  let direct = core.create({ identifier, snapshot: referenceSnapshot });
  assert.deepEqual(investigation.transitionLog, direct.transitionLog);

  const target = reflectionKey(investigation);
  investigation = investigation.trace(target);
  direct = core.trace(identifier, target);
  assert.deepEqual(investigation.transitionLog, direct.transitionLog);
  assert.equal(canonicalize(investigation.view), canonicalize(projectInvestigation(direct)));

  const replay = investigation.replay();
  assert.ok(replay instanceof ReplaySession);
  assert.equal(Object.isFrozen(replay), true);
  replay.next();
  investigation = replay.investigation;
  direct = core.replay(identifier, "next");
  assert.deepEqual(investigation.transitionLog, direct.transitionLog);
  assert.equal(canonicalize(investigation.view), canonicalize(projectInvestigation(direct)));
});

test("MO-1204 exposes comparison as an explicit non-semantic session and preserves Core stages", () => {
  const identifier = "sdk-comparison";
  const memory = new MemoryOS();
  const workspace = memory.openWorkspace(referenceSnapshot.workspaceIdentifier);
  let investigation = memory.observe(workspace, referenceSnapshot, { identifier });
  investigation = investigation.observe(changedSnapshot());
  const target = reflectionKey(investigation);
  investigation = investigation.trace(target);
  investigation = completeReplay(investigation.replay());
  assert.equal(investigation.lifecycle, LifecycleState.ReplayComplete);

  const core = new InvestigationCore();
  core.create({ identifier, snapshot: referenceSnapshot });
  core.observe(identifier, { snapshot: changedSnapshot() });
  core.trace(identifier, target);
  completeCoreReplay(core, identifier);

  const transitionDigest = investigation.transitionLog.digest;
  const acquired = investigation.comparisonSession(null);
  assert.ok(acquired instanceof ComparisonSession);
  assert.equal(Object.isFrozen(acquired), true);
  assert.throws(() => acquired.next(), /activated through Investigation\.compare/);
  assert.equal(investigation.lifecycle, LifecycleState.ReplayComplete,
    "session acquisition must not create a Core transition");
  assert.equal(investigation.transitionLog.digest, transitionDigest);
  const comparison = investigation.compare(acquired);
  assert.equal(comparison, acquired);
  const direct = core.compare(identifier, { action: "enter", evolutionIdentifier: null });
  assert.deepEqual(comparison.investigation.transitionLog, direct.transitionLog);
  assert.equal(
    canonicalize(comparison.investigation.view),
    canonicalize(projectInvestigation(direct)),
  );
  assert.throws(() => investigation.compare(), /explicit ComparisonSession/);
  assert.throws(() => investigation.compare(comparison), /already active/);
  assert.throws(() => investigation.comparisonSession(), /explicit Cognitive Evolution identifier/);
  assert.throws(
    () => investigation.comparisonSession("not-a-native-evolution"),
    /Native comparison requires an explicit null/,
  );

  assert.equal(comparison.lifecycle, LifecycleState.ComparisonReady);
  assert.throws(
    () => comparison.start({ comparativeIdentifier: null, targetNodeKey: null }),
    /explicit target node key/,
  );
  assert.throws(
    () => comparison.start({ comparativeIdentifier: "conflict", targetNodeKey: target }),
    /exactly one explicit target node key/,
  );
  comparison.start(target);
  assert.equal(comparison.lifecycle, LifecycleState.Comparing);
  comparison.next();
  assert.ok(comparison.state.cursor >= 0);
  comparison.back();
  assert.equal(comparison.lifecycle, LifecycleState.ComparisonReady);
  comparison.back();
  assert.equal(comparison.lifecycle, LifecycleState.ReplayComplete);
});

test("MO-1204 verification and Checkpoint restoration remain Core-owned", () => {
  const memory = new MemoryOS();
  const workspace = memory.openWorkspace(referenceSnapshot.workspaceIdentifier);
  const investigation = memory.observe(workspace, referenceSnapshot, { identifier: "sdk-restore" });
  const checkpoint = investigation.checkpoint();

  assert.ok(checkpoint instanceof Checkpoint);
  assert.equal(Object.isFrozen(checkpoint), true);
  const restored = memory.restore(checkpoint);
  assert.equal(restored.lifecycle, LifecycleState.Observed);
  assert.equal(restored.transitionLog.digest, checkpoint.transitionLogDigest);
  const verification = restored.verify();
  assert.ok(verification instanceof VerificationResult);
  assert.equal(Object.isFrozen(verification), true);
  assert.equal(verification.valid, true);
  assert.equal(restored.lifecycle, LifecycleState.Verified);

  const foreignMemory = new MemoryOS();
  assert.throws(() => foreignMemory.restore(checkpoint), /different MemoryOS binding/);
  assert.throws(() => investigation.restore(new InvestigationQuery()), /Checkpoint belongs/);
});

test("MO-1204 package verification import and export preserve exact MIP bytes", async () => {
  const bytes = await completeMipFixture();
  const memory = new MemoryOS();
  const verification = memory.verifyPackage(bytes);

  assert.ok(verification instanceof VerificationResult);
  assert.equal(verification.valid, true);
  assert.ok(verification.package instanceof MemoryInvestigationPackage);
  assert.deepEqual(verification.package.toBytes(), bytes);
  assert.equal(Object.isFrozen(verification.package), true);

  let investigation = memory.importPackage(verification.package, { identifier: "sdk-package" });
  const exported = memory.exportPackage(investigation);
  assert.ok(exported instanceof MemoryInvestigationPackage);
  assert.deepEqual(exported.toBytes(), bytes);
  assert.equal(memory.verifyPackage(exported).valid, true);

  investigation = investigation.trace("trace-observation-b");
  investigation = completeReplay(investigation.replay());
  assert.throws(
    () => investigation.comparisonSession(null),
    /Package comparison requires an exact Cognitive Evolution identifier/,
  );
  const comparison = investigation.compare(
    investigation.comparisonSession("evolution-observation-a-observation-b"),
  );
  assert.equal(comparison.lifecycle, LifecycleState.ComparisonReady);
  assert.throws(
    () => comparison.start({ targetNodeKey: "reflection-b" }),
    /Package Comparative Reconstruction requires exactly one explicit Comparative Reconstruction identifier/,
  );
  comparison.start({ comparativeIdentifier: "comparative-observation-a-observation-b" });
  assert.equal(comparison.lifecycle, LifecycleState.Comparing);
  assert.deepEqual(memory.exportPackage(comparison.investigation).toBytes(), bytes);

  const nativeMemory = new MemoryOS();
  const native = nativeMemory.observe(
    nativeMemory.openWorkspace(referenceSnapshot.workspaceIdentifier),
    referenceSnapshot,
    { identifier: "sdk-native-no-package-invention" },
  );
  assert.throws(
    () => nativeMemory.exportPackage(native),
    (error) => error instanceof InvestigationCoreError && error.code === "CAPABILITY_UNAVAILABLE",
  );
  assert.equal(memory.verifyPackage(new Uint8Array([0xff])).valid, false);
  const emptyVerification = memory.verifyPackage(new Uint8Array());
  assert.equal(emptyVerification.valid, false);
  assert.ok(emptyVerification.diagnostics.length > 0);
});

test("MO-1206 exposes one immutable read-only Regression path with exact Core parity", () => {
  const memory = new MemoryOS();
  const workspace = memory.openWorkspace(referenceSnapshot.workspaceIdentifier);
  const baseline = memory.observe(workspace, referenceSnapshot, {
    identifier: "sdk-regression-baseline",
  });
  const candidateSnapshot = changedSnapshot();
  const candidate = memory.observe(workspace, candidateSnapshot, {
    identifier: "sdk-regression-candidate",
  });
  const baselineDigest = baseline.transitionLog.digest;
  const candidateDigest = candidate.transitionLog.digest;
  const report = memory.regression(baseline, candidate);

  assert.ok(report instanceof RegressionReport);
  assert.equal(report.kind, "MemoryOSCognitiveRegressionReport");
  assert.equal(report.version, "1.0.0");
  assert.equal(report.regressionDetected, true);
  assert.equal(report.overall, "regressionDetected");
  assert.equal(Object.isFrozen(report), true);
  assert.equal(Object.isFrozen(report.categories), true);
  assert.equal(baseline.transitionLog.digest, baselineDigest);
  assert.equal(candidate.transitionLog.digest, candidateDigest);

  const core = new InvestigationCore();
  core.create({ identifier: baseline.identifier, snapshot: referenceSnapshot });
  core.create({ identifier: candidate.identifier, snapshot: candidateSnapshot });
  assert.equal(
    canonicalize(structuredClone(report)),
    canonicalize(core.regression(baseline.identifier, candidate.identifier)),
  );

  const foreignMemory = new MemoryOS();
  const foreign = foreignMemory.observe(
    foreignMemory.openWorkspace(referenceSnapshot.workspaceIdentifier),
    referenceSnapshot,
    { identifier: "sdk-regression-foreign" },
  );
  assert.throws(
    () => memory.regression(baseline, foreign),
    /must belong to this MemoryOS instance/,
  );
});

test("MO-1207 SDK navigates regression evidence with exact Core parity", () => {
  const memory = new MemoryOS();
  const workspace = memory.openWorkspace(referenceSnapshot.workspaceIdentifier);
  const baseline = memory.observe(workspace, referenceSnapshot, {
    identifier: "sdk-explorer-baseline",
  });
  const candidateSnapshot = changedSnapshot();
  const candidate = memory.observe(workspace, candidateSnapshot, {
    identifier: "sdk-explorer-candidate",
  });
  const report = memory.regression(baseline, candidate);
  const query = new InvestigationQuery({ category: "reflection" });
  const result = memory.investigate(report, query);

  assert.ok(result instanceof InvestigationResult);
  assert.equal(result.kind, "MemoryOSCognitiveInvestigationResult");
  assert.equal(result.version, "1.0.0");
  assert.equal(result.regressionIdentifier, report.identifier);
  assert.equal(result.workspaceIdentifier, workspace.identifier);
  assert.equal(result.status, "matched");
  assert.ok(result.matchCount > 0);
  assert.equal(result.matches.length, result.matchCount);
  assert.equal(Object.isFrozen(result), true);
  assert.equal(Object.isFrozen(result.matches), true);

  const core = new InvestigationCore();
  const directBaseline = core.create({
    identifier: baseline.identifier,
    snapshot: referenceSnapshot,
  });
  const directCandidate = core.create({
    identifier: candidate.identifier,
    snapshot: candidateSnapshot,
  });
  const directReport = core.regression(directBaseline.identifier, directCandidate.identifier);
  assert.equal(
    canonicalize(structuredClone(result)),
    canonicalize(core.investigate(directReport, { category: "reflection" })),
  );

  const raw = structuredClone(report);
  const envelope = {
    command: "regression",
    ok: true,
    result: raw,
    schemaVersion: "1.0",
  };
  assert.equal(
    canonicalize(structuredClone(memory.investigate(raw, query))),
    canonicalize(structuredClone(result)),
  );
  assert.equal(
    canonicalize(structuredClone(memory.investigate(envelope, query))),
    canonicalize(structuredClone(result)),
  );

  const empty = memory.investigate(report, { category: "replay" });
  assert.equal(empty.status, "empty");
  assert.equal(empty.matchCount, 0);
  assert.throws(
    () => memory.investigate(report, new InvestigationQuery({ category: "unknown" })),
    /category|query/iu,
  );
  assert.throws(
    () => new InvestigationQuery({ transition: "" }),
    /non-empty string/u,
  );
  assert.throws(
    () => memory.investigate(report, { unsupported: true }),
    /unsupported member/u,
  );
});

test("MO-1204 rejects implicit selections and cross-instance handles", () => {
  const first = new MemoryOS();
  const second = new MemoryOS();
  const workspace = first.openWorkspace(referenceSnapshot.workspaceIdentifier);
  const investigation = first.observe(workspace, referenceSnapshot, { identifier: "sdk-explicit-inputs" });

  assert.throws(() => second.observe(workspace, referenceSnapshot), /different MemoryOS instance/);
  assert.throws(() => investigation.trace(), /explicit Reflection selection/);
  assert.throws(() => investigation.replay(), /Replay is not prepared/);
  assert.throws(() => investigation.compare(), /explicit ComparisonSession/);

  const traced = investigation.trace(reflectionKey(investigation));
  const staleReplay = traced.replay();
  traced.observe(changedSnapshot());
  assert.throws(
    () => staleReplay.next(),
    (error) => error instanceof InvestigationCoreError && error.code === "SESSION_MISMATCH",
  );
});

test("MO-1204 keeps concurrent SDK instances isolated", async () => {
  const identifier = "sdk-concurrent-isolation";
  const [first, second] = await Promise.all([0, 1].map(async (index) => {
    const memory = new MemoryOS();
    const workspace = memory.openWorkspace(referenceSnapshot.workspaceIdentifier);
    let investigation = memory.observe(workspace, referenceSnapshot, { identifier });
    if (index === 0) {
      investigation = investigation.observe(changedSnapshot());
      investigation = investigation.trace(reflectionKey(investigation));
    }
    return { memory, investigation };
  }));

  assert.equal(first.investigation.lifecycle, LifecycleState.ReplayReady);
  assert.equal(first.investigation.view.observationFrames.length, 2);
  assert.equal(second.investigation.lifecycle, LifecycleState.Observed);
  assert.equal(second.investigation.view.observationFrames.length, 1);
  assert.notEqual(first.investigation.transitionLog.digest, second.investigation.transitionLog.digest);
  assert.throws(
    () => second.memory.restore(first.investigation.checkpoint()),
    /different MemoryOS binding/,
  );
});

test("MO-1204 makes Studio an SDK client while keeping the private binding thin", async () => {
  const [appSource, sdkSource, hostSource] = await Promise.all([
    readFile(new URL("../web/js/app.js", import.meta.url), "utf8"),
    readFile(new URL("../web/js/memoryos-sdk.js", import.meta.url), "utf8"),
    readFile(new URL("../../cca-sdk/bridge/investigation-core-host.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(appSource, /from ["']\.\/memoryos-sdk\.js["']/);
  assert.doesNotMatch(appSource, /from ["']\.\/investigation-core\.js["']|\bInvestigationCore\b/);
  assert.match(sdkSource, /from ["']\.\/investigation-core\.js["']/);
  assert.match(sdkSource, /from ["']\.\/memory-investigation-package\.js["']/);
  assert.doesNotMatch(sdkSource, /from ["']\.\/cognitive-(?:trace|replay|evolution|comparative)/);
  const comparisonDispatch = hostSource.match(/case "compare":([\s\S]*?)case "verifyInvestigation":/u)?.[1] ?? "";
  assert.doesNotMatch(comparisonDispatch, /sourceKind|core\.load|Evolution selector|Comparative entry/);
  for (const command of [
    "investigation.trace(node.key)",
    "investigation.observe(nextSnapshot",
    "investigation.returnToWorld()",
    "investigation.archive()",
    "investigation.comparisonSession(input.evolutionIdentifier ?? null)",
    "investigation.compare(pending)",
    "session.previousObservation()",
    "session.nextObservation()",
    "session.start(",
    "session.advance()",
    "session.back()",
  ]) assert.match(appSource, new RegExp(command.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});
