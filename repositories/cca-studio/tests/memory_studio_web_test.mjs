import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { request } from "node:http";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { referenceSnapshot, scopeDefinitions } from "../web/data/studio-snapshot.js";
import {
  buildGraph,
  cloneDetached,
  findObservation,
  inspectSnapshot,
  observeSnapshot,
  resolveInspectionDetails,
  summarizeSnapshot,
  summaryLines,
  traceSnapshot,
} from "../web/js/studio-model.js";
import { createReferenceAdapter, operationNames, resolveCommandAdapter } from "../web/js/host-adapter.js";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(testDirectory, "..");

test("the visual query model exposes the frozen scope order", () => {
  assert.deepEqual(scopeDefinitions.map(({ value }) => value), [
    "Complete",
    "Memory",
    "WorkingMemory",
    "LongTermMemory",
    "SemanticMemory",
    "EpisodicMemory",
    "ProceduralMemory",
    "Retrieval",
    "Consolidation",
    "Reflection",
    "Providers",
  ]);
});

test("complete summaries use the exact closed key contract and fixed order", () => {
  assert.deepEqual(summaryLines(referenceSnapshot, "Complete"), [
    "Memory.entries=4",
    "WorkingMemory.active=true",
    "WorkingMemory.entries=3",
    "LongTermMemory.entries=5",
    "LongTermMemory.archived=1",
    "SemanticMemory.concepts=3",
    "EpisodicMemory.episodes=3",
    "ProceduralMemory.procedures=2",
    "Retrieval.sessions=2",
    "Retrieval.sessions.Ready=1",
    "Retrieval.sessions.Started=1",
    "Retrieval.sessions.Forgotten=0",
    "Retrieval.candidates=3",
    "Consolidation.sessions=2",
    "Consolidation.sessions.Pristine=1",
    "Consolidation.sessions.Analyzed=0",
    "Consolidation.sessions.Promoted=0",
    "Consolidation.sessions.Retained=1",
    "Consolidation.sessions.Forgotten=0",
    "Consolidation.candidates=1",
    "Reflection.values=1",
    "Reflection.sessions=1",
    "Reflection.sessions.Pristine=0",
    "Reflection.sessions.Prepared=0",
    "Reflection.sessions.Derived=1",
    "Reflection.sessions.Forgotten=0",
    "Reflection.sources=4",
    "Providers.sessions=2",
    "Providers.sessions.Open=1",
    "Providers.sessions.Exported=1",
    "Providers.sessions.Imported=0",
    "Providers.sessions.Forgotten=0",
    "Providers.descriptors=3",
  ]);
});

test("inspection is exact, case-sensitive, deterministic, and does not search content", () => {
  const exact = inspectSnapshot(referenceSnapshot, "Observed", {
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
    scope: "Complete",
    identifier: "ltm-001",
  });
  assert.equal(exact.code, "OK");
  assert.deepEqual(exact.observations, ["LongTermMemory.entries[0]"]);
  assert.notEqual(exact.view, referenceSnapshot);
  assert.notEqual(exact.view.longTermMemory, referenceSnapshot.longTermMemory);

  const wrongCase = inspectSnapshot(referenceSnapshot, "Observed", {
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
    scope: "LongTermMemory",
    identifier: "LTM-001",
  });
  assert.equal(wrongCase.code, "NOT_FOUND");

  const content = inspectSnapshot(referenceSnapshot, "Observed", {
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
    scope: "LongTermMemory",
    identifier: "Workspace ownership is invariant.",
  });
  assert.equal(content.code, "NOT_FOUND");
});

test("inspection details resolve every returned location from the detached result view", () => {
  const changed = cloneDetached(referenceSnapshot);
  changed.longTermMemory.entries[0].value = "newly observed value";
  const longTerm = inspectSnapshot(changed, "Observed", {
    workspaceIdentifier: changed.workspaceIdentifier,
    scope: "LongTermMemory",
    identifier: "ltm-001",
  });
  assert.equal(resolveInspectionDetails(longTerm.view, longTerm.observations)[0].value.value, "newly observed value");

  const consolidation = inspectSnapshot(referenceSnapshot, "Observed", {
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
    scope: "Consolidation",
    identifier: "ltm-006",
  });
  assert.deepEqual(consolidation.observations, ["Consolidation.sessions[0]"]);
  const [detail] = resolveInspectionDetails(consolidation.view, consolidation.observations);
  assert.equal(detail.family, "Consolidation session");
  assert.equal(detail.value.identifier, "consolidation-session-001");
  assert.equal(detail.value.candidate.longTermMemoryIdentifier, "ltm-006");
});

test("trace exposes only released Retrieval and Reflection chains", () => {
  const trace = traceSnapshot(referenceSnapshot, "Observed", {
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
    scope: "Complete",
    identifier: "sem-ownership",
  });
  assert.equal(trace.code, "OK");
  assert.deepEqual(trace.explanationChains, [["ltm-001", "sem-ownership"]]);

  const invalid = traceSnapshot(referenceSnapshot, "Observed", {
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
    scope: "SemanticMemory",
    identifier: "",
  });
  assert.equal(invalid.code, "INVALID_QUERY");

  const retrievalSessionIdentifier = traceSnapshot(referenceSnapshot, "Observed", {
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
    scope: "Retrieval",
    identifier: "retrieval-session-001",
  });
  assert.equal(retrievalSessionIdentifier.code, "NOT_FOUND");

  const reflectionSessionIdentifier = inspectSnapshot(referenceSnapshot, "Observed", {
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
    scope: "Reflection",
    identifier: "reflection-session-001",
  });
  assert.equal(reflectionSessionIdentifier.code, "NOT_FOUND");
});

test("ReflectionSession sources remain inspectable and traceable without a standalone Reflection", () => {
  const sessionOnly = cloneDetached(referenceSnapshot);
  sessionOnly.reflections = [];
  const query = {
    workspaceIdentifier: sessionOnly.workspaceIdentifier,
    scope: "Reflection",
    identifier: "sem-determinism",
  };
  const inspection = inspectSnapshot(sessionOnly, "Observed", query);
  assert.deepEqual(inspection.observations, ["Reflection.sessions[0].sources[0]"]);
  assert.equal(resolveInspectionDetails(inspection.view, inspection.observations)[0].value.sourceIdentifier, "sem-determinism");
  assert.deepEqual(traceSnapshot(sessionOnly, "Observed", query).explanationChains, [["ltm-002", "sem-determinism"]]);
  assert.deepEqual(traceSnapshot(sessionOnly, "Observed", {
    ...query,
    identifier: "reflection-release-integrity",
  }).explanationChains, [
    ["ltm-002", "sem-determinism"],
    ["ltm-001", "ltm-002", "proc-release-review"],
  ]);
});

test("duplicate Retrieval source identities preserve every kind and path", () => {
  const duplicate = cloneDetached(referenceSnapshot);
  duplicate.retrievalSessions[0].candidates.push({
    kind: "Episodic",
    workspaceIdentifier: duplicate.workspaceIdentifier,
    sourceIdentifier: "sem-ownership",
    rankScore: 80,
    explanationChain: ["ltm-003", "sem-ownership"],
  });
  const result = inspectSnapshot(duplicate, "Observed", {
    workspaceIdentifier: duplicate.workspaceIdentifier,
    scope: "Retrieval",
    identifier: "sem-ownership",
  });
  assert.deepEqual(result.observations, [
    "Retrieval.sessions[0].candidates[0]",
    "Retrieval.sessions[0].candidates[3]",
  ]);
  assert.deepEqual(resolveInspectionDetails(result.view, result.observations).map(({ value }) => value.kind), ["Semantic", "Episodic"]);
});

test("session and query failures use the frozen result codes", () => {
  const query = {
    workspaceIdentifier: referenceSnapshot.workspaceIdentifier,
    scope: "Complete",
    identifier: "",
  };
  assert.equal(summarizeSnapshot(referenceSnapshot, "Forgotten", query).code, "SESSION_FORGOTTEN");
  assert.equal(summarizeSnapshot(referenceSnapshot, "Open", query).code, "SESSION_NOT_OBSERVED");
  assert.equal(summarizeSnapshot(referenceSnapshot, "Observed", { ...query, identifier: "mem-001" }).code, "INVALID_QUERY");
  assert.equal(inspectSnapshot(referenceSnapshot, "Observed", { ...query, workspaceIdentifier: "another-workspace" }).code, "WORKSPACE_MISMATCH");
});

test("observe validates every released outer and nested Workspace location", () => {
  assert.equal(observeSnapshot(referenceSnapshot, "Observed", referenceSnapshot).code, "OK");
  const mismatches = [
    ["aggregate", (view) => { view.memory.workspaceIdentifier = "wrong"; }],
    ["Retrieval session", (view) => { view.retrievalSessions[0].workspaceIdentifier = "wrong"; }],
    ["Retrieval candidate", (view) => { view.retrievalSessions[0].candidates[0].workspaceIdentifier = "wrong"; }],
    ["Consolidation session", (view) => { view.consolidationSessions[0].workspaceIdentifier = "wrong"; }],
    ["Consolidation request", (view) => { view.consolidationSessions[0].request.workspaceIdentifier = "wrong"; }],
    ["Consolidation candidate", (view) => { view.consolidationSessions[0].candidate.workspaceIdentifier = "wrong"; }],
    ["Consolidation WorkingMemory", (view) => { view.consolidationSessions[0].workingMemory.workspaceIdentifier = "wrong"; }],
    ["Consolidation LongTermMemory", (view) => { view.consolidationSessions[0].longTermMemory.workspaceIdentifier = "wrong"; }],
    ["Reflection", (view) => { view.reflections[0].workspaceIdentifier = "wrong"; }],
    ["Reflection source", (view) => { view.reflections[0].sources[0].workspaceIdentifier = "wrong"; }],
    ["Reflection session", (view) => { view.reflectionSessions[0].workspaceIdentifier = "wrong"; }],
    ["Reflection query", (view) => { view.reflectionSessions[0].query.workspaceIdentifier = "wrong"; }],
    ["Reflection session source", (view) => { view.reflectionSessions[0].sources[0].workspaceIdentifier = "wrong"; }],
    ["Session Reflection", (view) => { view.reflectionSessions[0].reflection.workspaceIdentifier = "wrong"; }],
    ["Session Reflection source", (view) => { view.reflectionSessions[0].reflection.sources[0].workspaceIdentifier = "wrong"; }],
    ["Provider session", (view) => { view.providerSessions[0].workspaceIdentifier = "wrong"; }],
    ["Provider descriptor", (view) => { view.providerSessions[0].descriptors[0].workspaceIdentifier = "wrong"; }],
  ];
  for (const [label, mutate] of mismatches) {
    const view = cloneDetached(referenceSnapshot);
    mutate(view);
    assert.equal(observeSnapshot(referenceSnapshot, "Observed", view).code, "WORKSPACE_MISMATCH", label);
  }

  const incomplete = cloneDetached(referenceSnapshot);
  delete incomplete.memory;
  assert.equal(observeSnapshot(referenceSnapshot, "Observed", incomplete).code, "INVALID_VIEW");
  incomplete.workspaceIdentifier = "wrong";
  assert.equal(observeSnapshot(referenceSnapshot, "Observed", incomplete).code, "WORKSPACE_MISMATCH");
});

test("the graph contains only explicit observation relationships", () => {
  const graph = buildGraph(referenceSnapshot);
  assert.ok(graph.nodes.some(({ family }) => family === "Workspace"));
  assert.ok(graph.edges.length > 0);
  assert.ok(graph.edges.every(({ relation }) => ["contains", "evidence", "links", "contributes"].includes(relation)));
  assert.equal(graph.edges.some(({ relation }) => relation === "inferred"), false);
  assert.equal(new Set(graph.nodes.map(({ key }) => key)).size, graph.nodes.length);
});

test("equal identifiers in different families retain distinct locations", () => {
  const duplicate = cloneDetached(referenceSnapshot);
  duplicate.memory.entries.push({ identifier: "shared-id", value: "memory" });
  duplicate.longTermMemory.entries.push({ identifier: "shared-id", value: "long-term", archived: false });
  duplicate.semanticMemory.concepts.push({
    identifier: "shared-id",
    meaning: "semantic",
    categories: [],
    linkedConceptIdentifiers: [],
    sourceEntries: [],
  });
  assert.deepEqual(findObservation(duplicate, "shared-id").map(({ family }) => family), ["Memory", "LongTermMemory", "SemanticMemory"]);
  const graph = buildGraph(duplicate);
  const matching = graph.nodes.filter(({ identifier }) => identifier === "shared-id");
  assert.equal(matching.length, 2, "graph-bearing families remain separate");
  assert.equal(new Set(graph.nodes.map(({ key }) => key)).size, graph.nodes.length);
});

test("the host adapter requires and exposes all six frozen operations", async () => {
  assert.deepEqual(operationNames, ["observe", "inspect", "trace", "summarize", "exportView", "forgetSession"]);
  assert.throws(() => {
    globalThis.__CCA_STUDIO_COMMANDS__ = { inspect() {} };
    resolveCommandAdapter(referenceSnapshot);
  }, /missing/);
  delete globalThis.__CCA_STUDIO_COMMANDS__;

  const adapter = createReferenceAdapter(referenceSnapshot);
  const first = await adapter.exportView();
  assert.equal(first.code, "OK");
  first.view.memory.entries[0].value = "changed detached result";
  const second = await adapter.exportView();
  assert.notEqual(second.view.memory.entries[0].value, first.view.memory.entries[0].value);
  const providerMismatch = cloneDetached(referenceSnapshot);
  providerMismatch.providerSessions[0].workspaceIdentifier = "wrong";
  assert.equal((await adapter.observe(providerMismatch)).code, "WORKSPACE_MISMATCH");
  assert.equal((await adapter.observe(referenceSnapshot)).code, "OK");
  assert.equal((await adapter.inspect({ workspaceIdentifier: referenceSnapshot.workspaceIdentifier, scope: "Complete", identifier: "" })).code, "OK");
  assert.equal((await adapter.trace({ workspaceIdentifier: referenceSnapshot.workspaceIdentifier, scope: "Complete", identifier: "" })).code, "OK");
  assert.equal((await adapter.summarize({ workspaceIdentifier: referenceSnapshot.workspaceIdentifier, scope: "Complete", identifier: "" })).code, "OK");
  assert.equal((await adapter.forgetSession()).code, "OK");
  assert.equal((await adapter.exportView()).code, "SESSION_FORGOTTEN");
});

test("the application shell is local, accessible, responsive, and injection-ready", async () => {
  const [html, css, app, hostAdapter, data] = await Promise.all([
    readFile(resolve(studioRoot, "web/index.html"), "utf8"),
    readFile(resolve(studioRoot, "web/styles.css"), "utf8"),
    readFile(resolve(studioRoot, "web/js/app.js"), "utf8"),
    readFile(resolve(studioRoot, "web/js/host-adapter.js"), "utf8"),
    readFile(resolve(studioRoot, "web/data/studio-snapshot.js"), "utf8"),
  ]);

  assert.match(html, /<main class="main-content"/);
  assert.match(html, /aria-label="Memory Studio scopes"/);
  assert.match(html, /aria-live="polite"/);
  assert.match(html, /<dialog class="confirm-dialog"/);
  for (const control of ["observe-view", "run-inspect", "run-trace", "run-summary", "export-view", "forget-session"]) {
    assert.match(html, new RegExp(`id="${control}"`));
  }
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /\[hidden\]\s*\{[^}]*display:\s*none\s*!important/);
  assert.match(css, /--runtime: #1e88e5/);
  assert.match(css, /--representation: #43b581/);
  assert.match(css, /--commit: #7c4dff/);
  assert.match(css, /--process: #fb8c00/);
  assert.match(hostAdapter, /__CCA_STUDIO_COMMANDS__/);
  assert.doesNotMatch(app, /\.sort\(/);
  assert.match(app, /toggleAttribute\("inert"/);
  assert.match(app, /resolveInspectionDetails\(operationResult\.view, operationResult\.observations\)/);
  assert.match(app, /snapshot = cloneDetached\(result\.view\)/);
  assert.doesNotMatch(app, /inspectorFamilyByScope/);
  assert.match(data, /__CCA_STUDIO_SNAPSHOT__/);
  assert.doesNotMatch(html, /https?:\/\//);
  assert.doesNotMatch(app, /setInterval|WebSocket|EventSource/);
});

test("the local server rejects malformed encoding without terminating", async (context) => {
  const serverPath = resolve(studioRoot, "scripts/serve.mjs");
  const child = spawn(process.execPath, [serverPath, "0"], { stdio: ["ignore", "pipe", "pipe"] });
  context.after(() => child.kill());
  const port = await new Promise((resolvePort, reject) => {
    const timeout = setTimeout(() => reject(new Error("server did not start")), 5000);
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      const match = chunk.match(/127\.0\.0\.1:(\d+)/);
      if (match) {
        clearTimeout(timeout);
        resolvePort(Number(match[1]));
      }
    });
    child.once("exit", (code) => reject(new Error(`server exited early: ${code}`)));
  });

  const status = await new Promise((resolveStatus, reject) => {
    const outgoing = request({ host: "127.0.0.1", port, path: "/%", method: "GET" }, (response) => {
      response.resume();
      response.on("end", () => resolveStatus(response.statusCode));
    });
    outgoing.on("error", reject);
    outgoing.end();
  });
  assert.equal(status, 400);
  const healthy = await fetch(`http://127.0.0.1:${port}/`);
  assert.equal(healthy.status, 200);
  assert.match(await healthy.text(), /CCA Memory Studio/);
});
