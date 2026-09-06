import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { referenceSnapshot } from "../../cca-studio/web/data/studio-snapshot.js";
import {
  AIRuntimeAdapterError,
  defineAIRuntimeAdapter,
  snapshotRuntimeEvent,
} from "../../cca-studio/web/js/ai-runtime-adapter.js";
import {
  buildComparativeReconstruction,
  validateComparativeReconstruction,
} from "../../cca-studio/web/js/cognitive-comparative-reconstruction.js";
import { compareCognitiveEvolution } from "../../cca-studio/web/js/cognitive-evolution.js";
import { buildCognitiveTrace } from "../../cca-studio/web/js/cognitive-trace.js";
import {
  InvestigationCore,
  InvestigationCoreError,
  LifecycleState,
  TransitionLog,
  investigationAvailability,
  investigationPhase,
} from "../../cca-studio/web/js/investigation-core.js";
import {
  appendObservationFrame,
  createObservationTimeline,
} from "../../cca-studio/web/js/observation-timeline.js";
import { MemoryOS } from "../../cca-studio/web/js/memoryos-sdk.js";
import { buildGraph, cloneDetached } from "../../cca-studio/web/js/studio-model.js";
import { commandNames, parseArguments } from "../../memoryos-cli/src/arguments.js";
import {
  parseCliJson,
  readMipFixture,
  runCli,
} from "./support/conformance-support.mjs";

const differenceNames = Object.freeze([
  "addedEvidence",
  "removedEvidence",
  "addedSemanticTransformations",
  "removedSemanticTransformations",
  "addedRetrievals",
  "removedRetrievals",
  "addedReflections",
  "removedReflections",
  "addedRelationships",
  "removedRelationships",
  "modifiedRelationships",
]);

function reflectionNode(investigationOrFrame) {
  const frame = investigationOrFrame.state?.currentFrame ?? investigationOrFrame;
  const node = frame.world.nodes.find(
    ({ observationPath }) => observationPath === "Reflection.values[0]",
  );
  assert.ok(node, "the normative fixture must expose its standalone Reflection");
  return node;
}

function changedSnapshot(identifier = "observation-normative-candidate") {
  const value = cloneDetached(referenceSnapshot);
  value.observationIdentifier = identifier;
  value.longTermMemory.entries[0].value = "Normative evidence changed.";
  value.semanticMemory.concepts[0].meaning = "Normative meaning changed.";
  value.retrievalSessions[0].candidates[0].rankScore += 1;
  value.reflections[0].knowledge = "Normative reflection changed.";
  return value;
}

function replaceExactStrings(value, before, after) {
  if (Array.isArray(value)) {
    value.forEach((child, index) => {
      if (child === before) value[index] = after;
      else replaceExactStrings(child, before, after);
    });
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const key of Object.keys(value)) {
    if (value[key] === before) value[key] = after;
    else replaceExactStrings(value[key], before, after);
  }
}

function observationPair(before, after) {
  const first = appendObservationFrame(createObservationTimeline(), {
    snapshot: before,
    graph: buildGraph(before),
    operation: "InitialObservation",
    resultCode: "OK",
  });
  const second = appendObservationFrame(first.frames, {
    snapshot: after,
    graph: buildGraph(after),
    operation: "Observe",
    resultCode: "OK",
  });
  return { from: first.current, to: second.current };
}

function adapterRequest(overrides = {}) {
  return {
    observationIdentifier: "observation-adapter-vector",
    packageIdentifier: "mip-adapter-vector",
    sourceVersion: "1.0.0",
    workspaceIdentifier: "workspace-adapter-vector",
    ...overrides,
  };
}

function vectorAdapter(capture = () => {}) {
  return defineAIRuntimeAdapter({
    descriptor: {
      eventKind: "memoryos.adapter.vector.output",
      identifier: "org.memoryos.adapter.vector",
      name: "Normative vector adapter",
      sourceName: "Normative vector runtime",
      version: "1.0.0",
    },
    initialize(request) {
      capture(request);
      return { events: [] };
    },
    observeEvent(event, { state }) {
      state.events.push(event);
    },
    finalize({ state }) {
      return {
        accepted: true,
        records: state.events.map((event, sourceOrder) => ({
          identifier: event.identifier,
          kind: "memoryos.adapter.vector.output",
          revision: { value: event.value },
          sourceOrder,
        })),
        relationships: [],
      };
    },
    sourceAuthorshipAttested: true,
  });
}

test("known Core identity and transition digest vectors remain exact", async () => {
  const explicit = new InvestigationCore().create({
    identifier: "conformance-transition-vector",
    sourceIdentifier: "source-vector",
    workspaceIdentifier: "workspace-vector",
  });
  assert.equal(
    new TransitionLog("conformance-transition-vector").digest,
    "sha256:a2b0d310579a0c8cce26572b567408e60174b3de5a9cf077d3df2b6983d7f2df",
  );
  assert.equal(
    explicit.transitionLog.transitions[0].identifier,
    "sha256:c9ba949e3ce0e2fb577364a34224c1e3ad7340f1ba9b00ddd2149475b2137400",
  );
  assert.equal(
    explicit.transitionLog.digest,
    "sha256:9b588b67b864ae9403ff55b43988dd0777967badae8111491d3bd1beffc02588",
  );
  assert.equal(
    new InvestigationCore().create({
      sourceIdentifier: "source-vector",
      workspaceIdentifier: "workspace-vector",
    }).identifier,
    "investigation:059c2e5b80e2295899a152a25c070f11e4601630b4befb53d989ff4bcfaeab81",
  );
  assert.equal(
    new InvestigationCore().create({ snapshot: referenceSnapshot }).identifier,
    "investigation:6f74cde6055d46e99a283710c76a822a73af859fe68dd2a66a1d75751e9cd496",
  );
  assert.equal(
    new InvestigationCore().import(await readMipFixture("complete-investigation")).identifier,
    "investigation:6ddd151fdda99dc00abd1c4f3f92bc93c5d35138e6e79c4a11ac97f100f811cf",
  );
});

test("the declared native projection maps exact Frame values and rejects invalid input", () => {
  const investigation = new InvestigationCore().create({ snapshot: referenceSnapshot });
  const frame = investigation.state.currentFrame;
  assert.deepEqual(Object.keys(frame), [
    "kind", "version", "sequence", "operation", "query", "resultCode", "snapshot", "world", "activity",
  ]);
  assert.equal(frame.kind, "MemoryOSObservationFrame");
  assert.equal(frame.version, "1.1");
  assert.equal(frame.world.kind, "MemoryOSSemanticWorld");
  assert.equal(frame.world.version, "1.1");
  assert.equal(frame.world.identity, "Memory intelligence graph");
  assert.equal(frame.world.layout.identifier, "memoryos-semantic-world-v1");
  assert.equal(frame.world.frame.identifier, "observation-0001:0:c78324d6");
  assert.equal(frame.world.frame.observationFingerprint, "f1cc0d70");
  assert.equal(frame.world.frame.topologyFingerprint, "e32df439");
  assert.deepEqual(frame.activity, {
    nodes: { added: [], changed: [], removed: [] },
    edges: { added: [], changed: [], removed: [] },
    nodeKeys: [],
    edgeKeys: [],
  });

  const nestedFailure = cloneDetached(referenceSnapshot);
  nestedFailure.result = { succeeded: false, code: "SOURCE_ERROR", message: "source fact" };
  const accepted = new InvestigationCore().create({ snapshot: nestedFailure });
  assert.deepEqual(accepted.state.currentFrame.snapshot.result, nestedFailure.result);
  assert.equal(accepted.state.currentFrame.resultCode, "OK");

  for (const invalid of [
    () => new InvestigationCore().create({
      identifier: "outer-failure-vector",
      snapshot: referenceSnapshot,
      resultCode: "SOURCE_ERROR",
    }),
    () => {
      const foreign = cloneDetached(referenceSnapshot);
      foreign.uiState = { selected: "reflection" };
      return new InvestigationCore().create({ identifier: "foreign-member-vector", snapshot: foreign });
    },
    () => {
      const surrogate = cloneDetached(referenceSnapshot);
      replaceExactStrings(
        surrogate,
        referenceSnapshot.workspaceIdentifier,
        `workspace-${String.fromCharCode(0xd800)}`,
      );
      return new InvestigationCore().create({ identifier: "surrogate-vector", snapshot: surrogate });
    },
  ]) {
    assert.throws(invalid, (error) => error instanceof InvestigationCoreError
      && error.code === "INVALID_INPUT");
  }
});

test("phase, availability, Trace rebuild, and missing-target diagnostics are exact", () => {
  const core = new InvestigationCore();
  let investigation = core.create({
    identifier: "phase-vector",
    sourceIdentifier: "created",
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
  });
  assert.equal(investigationPhase(investigation), "observe");
  assert.deepEqual(investigationAvailability(investigation), {
    trace: false,
    replay: false,
    compare: false,
    comparative: false,
    verify: true,
    checkpoint: true,
    export: false,
  });

  investigation = core.observe(investigation.identifier, { snapshot: referenceSnapshot });
  assert.equal(investigation.state.lifecycle, LifecycleState.Observed);
  assert.equal(investigationPhase(investigation), "observe");
  assert.equal(investigationAvailability(investigation).trace, true);
  investigation = core.trace(investigation.identifier, reflectionNode(investigation).key);
  const firstTraceIdentifier = investigation.state.activeTrace.identifier;
  assert.equal(investigation.state.lifecycle, LifecycleState.ReplayReady);
  assert.equal(investigationPhase(investigation), "trace");
  assert.equal(investigationAvailability(investigation).replay, true);

  investigation = core.observe(investigation.identifier, { snapshot: changedSnapshot() });
  assert.equal(investigation.state.lifecycle, LifecycleState.ReplayReady);
  assert.notEqual(investigation.state.activeTrace.identifier, firstTraceIdentifier);
  assert.equal(investigation.state.activeTrace.frameIdentifier, investigation.state.currentFrame.world.frame.identifier);
  assert.equal(investigation.state.traceDiagnostic, null);

  investigation = core.replay(investigation.identifier, "next");
  assert.equal(investigationPhase(investigation), "replay");
  const withoutReflection = cloneDetached(referenceSnapshot);
  withoutReflection.observationIdentifier = "observation-no-reflection";
  withoutReflection.reflections = [];
  withoutReflection.reflectionSessions = [];
  investigation = core.observe(investigation.identifier, { snapshot: withoutReflection });
  assert.equal(investigation.state.lifecycle, LifecycleState.Observed);
  assert.equal(investigation.state.activeTrace, null);
  assert.equal(investigation.state.activeReplay, null);
  assert.deepEqual(investigation.state.traceDiagnostic, {
    code: "INVALID_TRACE",
    message: "The prior Reflection is absent from the accepted observation.",
    targetNodeKey: "reflection:reflection-release-integrity:0",
  });
});

test("native Trace evidence rejection is atomic across JS and private SDK-host boundaries", () => {
  const snapshot = cloneDetached(referenceSnapshot);
  snapshot.observationIdentifier = "observation-invalid-trace-evidence";
  snapshot.reflections[0].sources[0].semanticConcept.sourceEntries = [];
  const targetNodeKey = "reflection:reflection-release-integrity:0";

  const memory = new MemoryOS();
  const workspace = memory.openWorkspace(snapshot.workspaceIdentifier);
  const investigation = memory.observe(workspace, snapshot, { identifier: "js-trace-evidence-vector" });
  const beforeDigest = investigation.transitionLog.digest;
  assert.throws(
    () => investigation.trace(targetNodeKey),
    (error) => error.code === "MISSING_EVIDENCE"
      && error.message === "A Reflection source candidate has no owned Long-Term evidence.",
  );
  assert.equal(investigation.refresh().transitionLog.digest, beforeDigest);
  assert.equal(investigation.refresh().lifecycle, LifecycleState.Observed);

  const requests = [
    {
      id: 0,
      method: "observe",
      params: {
        identifier: "host-trace-evidence-vector",
        snapshot,
        workspaceIdentifier: snapshot.workspaceIdentifier,
      },
      version: "1.0.0",
    },
    {
      id: 1,
      method: "trace",
      params: {
        investigationIdentifier: "host-trace-evidence-vector",
        selection: targetNodeKey,
      },
      version: "1.0.0",
    },
    {
      id: 2,
      method: "load",
      params: { investigationIdentifier: "host-trace-evidence-vector" },
      version: "1.0.0",
    },
  ];
  const host = spawnSync(
    process.execPath,
    [fileURLToPath(new URL("../../cca-sdk/bridge/investigation-core-host.mjs", import.meta.url))],
    {
      encoding: "utf8",
      input: `${requests.map((request) => JSON.stringify(request)).join("\n")}\n`,
      maxBuffer: 64 * 1024 * 1024,
      windowsHide: true,
    },
  );
  assert.ifError(host.error);
  assert.equal(host.status, 0, host.stderr);
  assert.equal(host.stderr, "");
  const responses = host.stdout.trimEnd().split(/\r?\n/u).map((line) => JSON.parse(line));
  assert.equal(responses.length, 3);
  assert.equal(responses[0].ok, true);
  assert.deepEqual(responses[1], {
    error: {
      code: "BINDING_FAILURE",
      diagnostics: [{
        code: "BINDING_FAILURE",
        message: "The private Investigation Core binding failed.",
        operation: "trace",
      }],
      message: "The private Investigation Core binding failed.",
      operation: "trace",
    },
    id: 1,
    ok: false,
    version: "1.0.0",
  });
  assert.equal(responses[2].ok, true);
  assert.equal(responses[2].result.investigation.lifecycle, LifecycleState.Observed);
  assert.equal(responses[2].result.transitionLog.count, 2);
  assert.equal(
    responses[2].result.transitionLog.digest,
    responses[0].result.transitionLog.digest,
  );
});

test("Trace identifiers use the exact encodeURIComponent vector", () => {
  const snapshot = cloneDetached(referenceSnapshot);
  replaceExactStrings(
    snapshot,
    referenceSnapshot.workspaceIdentifier,
    "workspace:/é 💡",
  );
  snapshot.observationIdentifier = "obs:/é 💡";
  const investigation = new InvestigationCore().create({ snapshot });
  const trace = buildCognitiveTrace(investigation.state.currentFrame, reflectionNode(investigation).key);
  assert.equal(
    trace.identifier,
    "trace:workspace%3A%2F%C3%A9%20%F0%9F%92%A1:obs%3A%2F%C3%A9%20%F0%9F%92%A1%3A0%3A924b2450:reflection%3Areflection-release-integrity%3A0",
  );
  assert.equal(Object.isFrozen(trace), true);
});

test("Evolution excludes aggregate and detail-only changes from its eleven semantic classes", () => {
  const changed = cloneDetached(referenceSnapshot);
  changed.observationIdentifier = "observation-aggregate-detail-vector";
  changed.memory.entries[0].value = "aggregate-owned detail changed";
  changed.validation[0].detail = "validation detail changed";
  const pair = observationPair(referenceSnapshot, changed);
  const evolution = compareCognitiveEvolution(pair.from, pair.to);
  assert.deepEqual(Object.keys(evolution.differences), differenceNames);
  assert.deepEqual(
    Object.fromEntries(differenceNames.map((name) => [name, evolution.differences[name].length])),
    Object.fromEntries(differenceNames.map((name) => [name, 0])),
  );
  assert.notEqual(pair.from.world.frame.identifier, pair.to.world.frame.identifier);
});

test("Comparative producer immutability is deep while detached validation checks its published surface", () => {
  const changed = changedSnapshot("observation-comparative-vector");
  const pair = observationPair(referenceSnapshot, changed);
  const fromTrace = buildCognitiveTrace(pair.from, reflectionNode(pair.from).key);
  const toTrace = buildCognitiveTrace(pair.to, reflectionNode(pair.to).key);
  const reconstruction = buildComparativeReconstruction(pair.from, fromTrace, pair.to, toTrace);
  assert.equal(Object.isFrozen(reconstruction), true);
  assert.equal(Object.isFrozen(reconstruction.moments[0]), true);
  assert.equal(Object.isFrozen(reconstruction.world.nodes), true);

  const detached = structuredClone(reconstruction);
  Object.freeze(detached.moments);
  Object.freeze(detached.world);
  Object.freeze(detached);
  assert.equal(Object.isFrozen(detached.moments[0]), false);
  assert.equal(Object.isFrozen(detached.world.nodes), false);
  assert.equal(validateComparativeReconstruction(detached), true);
});

test("adapter defaults, resource limits, and descriptor rejection use exact contract values", async () => {
  let normalized = null;
  const adapter = vectorAdapter((request) => { normalized = request; });
  const packageValue = await adapter.createInvestigation(
    [{ identifier: "event-1", value: "accepted" }],
    adapterRequest(),
  );
  assert.deepEqual(normalized, {
    maxEvents: 10000,
    maxPackageBytes: 16777216,
    maxSourceBytes: 8388608,
    maxSourceValues: 1000000,
    observationIdentifier: "observation-adapter-vector",
    observationSequence: 0,
    packageIdentifier: "mip-adapter-vector",
    sourceVersion: "1.0.0",
    workspaceIdentifier: "workspace-adapter-vector",
  });
  assert.equal(Object.isFrozen(normalized), true);
  assert.deepEqual(packageValue.observations[0].records[0], {
    provenance: [],
    reference: {
      identifier: "event-1",
      kind: "memoryos.adapter.vector.output",
      occurrence: 0,
    },
    revision: { value: "accepted" },
    role: "context",
  });
  await assert.rejects(
    adapter.createInvestigation(
      [{ identifier: "event-1", value: "one" }, { identifier: "event-2", value: "two" }],
      adapterRequest({ maxEvents: 1 }),
    ),
    (error) => error instanceof AIRuntimeAdapterError
      && error.code === "RUNTIME_EVENT_RESOURCE_LIMIT"
      && error.eventIndex === 1,
  );
  assert.throws(
    () => snapshotRuntimeEvent({ value: "too long" }, { maxBytes: 3 }),
    (error) => error instanceof AIRuntimeAdapterError
      && error.code === "RUNTIME_EVENT_RESOURCE_LIMIT",
  );
  assert.throws(() => defineAIRuntimeAdapter({
    descriptor: {
      eventKind: "event",
      identifier: "Invalid.Adapter",
      name: "Invalid",
      sourceName: "Runtime",
      version: "1.0.0",
    },
    observeEvent() {},
    finalize() {},
    sourceAuthorshipAttested: true,
  }), /lowercase dot notation/u);
  assert.throws(() => defineAIRuntimeAdapter({
    descriptor: {
      eventKind: "event",
      identifier: "valid.adapter",
      name: "Invalid",
      sourceName: "Runtime",
      version: "1.0.0",
      unknown: "forbidden",
    },
    observeEvent() {},
    finalize() {},
    sourceAuthorshipAttested: true,
  }), /Unknown adapter descriptor member/u);
  assert.throws(() => defineAIRuntimeAdapter({
    descriptor: {
      eventKind: "event",
      identifier: "valid.adapter",
      name: "Invalid",
      sourceName: "Runtime",
      version: "1.0.0",
    },
    observeEvent() {},
    finalize() {},
  }), /attest source authorship/u);
});

test("CLI aliases and closed JSON result member sets are exact", async (t) => {
  assert.deepEqual(commandNames, [
    "version", "help", "observe", "trace", "replay", "compare", "regression",
    "investigate", "verify", "import", "export", "inspect", "session",
  ]);
  assert.deepEqual(parseArguments([]), { command: "help", options: {}, positionals: [] });
  assert.deepEqual(parseArguments(["--help"]), { command: "help", options: {}, positionals: [] });
  assert.deepEqual(parseArguments(["-h"]), { command: "help", options: {}, positionals: [] });
  assert.deepEqual(parseArguments(["--version"]), { command: "version", options: {}, positionals: [] });
  assert.deepEqual(parseArguments(["-V"]), { command: "version", options: {}, positionals: [] });
  assert.equal(runCli([]).stdout, runCli(["-h"]).stdout);
  assert.equal(runCli(["version"]).stdout, runCli(["-V"]).stdout);

  const version = parseCliJson(runCli(["version", "--json"]));
  assert.deepEqual(Object.keys(version), ["command", "ok", "result", "schemaVersion"]);
  assert.deepEqual(Object.keys(version.result), ["cliVersion", "sdkVersion"]);
  const help = parseCliJson(runCli(["help", "--json"]));
  assert.deepEqual(Object.keys(help.result), ["topic", "usage"]);

  const temporary = await mkdtemp(join(tmpdir(), "memoryos-cli-vector-"));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const packagePath = join(temporary, "complete.mip");
  await writeFile(packagePath, await readMipFixture("complete-investigation"));
  const inspection = parseCliJson(runCli(["inspect", packagePath, "--json"]));
  assert.deepEqual(Object.keys(inspection.result), [
    "availability", "identifier", "lifecycle", "phase", "sourceKind",
    "transitionCount", "transitionLogDigest", "workspaceIdentifier",
  ]);
  assert.deepEqual(Object.keys(inspection.result.availability), [
    "checkpoint", "comparative", "compare", "export", "replay", "trace", "verify",
  ]);
  const verification = parseCliJson(runCli(["verify", packagePath, "--json"]));
  assert.deepEqual(Object.keys(verification.result), [
    "diagnosticCount", "diagnostics", "status", "valid",
  ]);
});

test("SDK bindings expose the complete projection and common semantic operation families", async () => {
  assert.deepEqual(Object.getOwnPropertyNames(MemoryOS.prototype).sort(), [
    "constructor", "exportPackage", "importPackage", "investigate", "observe",
    "openWorkspace", "regression", "restore", "verifyPackage",
  ]);
  const cpp = await readFile(new URL(
    "../../cca-sdk/include/memoryos/memoryos.hpp",
    import.meta.url,
  ), "utf8");
  const python = await readFile(new URL(
    "../../cca-sdk/python/src/memoryos/_sdk.py",
    import.meta.url,
  ), "utf8");
  const pythonModels = await readFile(new URL(
    "../../cca-sdk/python/src/memoryos/_models.py",
    import.meta.url,
  ), "utf8");
  for (const operation of [
    "openWorkspace", "observe", "importPackage", "exportPackage", "verifyPackage",
    "regression", "investigate", "restore",
  ]) {
    assert.match(cpp, new RegExp(`\\b${operation}\\s*\\(`, "u"), operation);
  }
  assert.match(cpp, /const std::string& canonicalJson\(\) const noexcept/u);
  for (const operation of [
    "open_workspace", "observe", "import_package", "export_package", "verify_package",
    "regression", "investigate", "restore",
  ]) {
    assert.match(python, new RegExp(`def ${operation}\\s*\\(`, "u"), operation);
  }
  assert.match(pythonModels, /projection: FrozenMap/u);
  assert.match(pythonModels, /transition_log_digest: str/u);
});
