import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createGraphViewState,
  toggleGraphRegionIsolation,
} from "../web/js/graph-view-state.js";
import { semanticWorldLayout } from "../web/js/semantic-world.js";

const testDirectory = dirname(fileURLToPath(import.meta.url));
const studioRoot = resolve(testDirectory, "..");

const [appSource, graphSource, htmlSource, stylesSource, viewStateSource, semanticWorldSource, investigationCoreSource, memoryOSSDKSource] = await Promise.all([
  readFile(resolve(studioRoot, "web/js/app.js"), "utf8"),
  readFile(resolve(studioRoot, "web/js/graph.js"), "utf8"),
  readFile(resolve(studioRoot, "web/index.html"), "utf8"),
  readFile(resolve(studioRoot, "web/styles.css"), "utf8"),
  readFile(resolve(studioRoot, "web/js/graph-view-state.js"), "utf8"),
  readFile(resolve(studioRoot, "web/js/semantic-world.js"), "utf8"),
  readFile(resolve(studioRoot, "web/js/investigation-core.js"), "utf8"),
  readFile(resolve(studioRoot, "web/js/memoryos-sdk.js"), "utf8"),
]);

function functionSource(source, name, nextName) {
  const start = source.indexOf(`function ${name}(`);
  const end = source.indexOf(`function ${nextName}(`, start + 1);
  assert.notEqual(start, -1, `${name} must remain an explicit application boundary`);
  assert.notEqual(end, -1, `${nextName} must delimit ${name}`);
  return source.slice(start, end);
}

function ordered(source, values, message) {
  let previous = -1;
  for (const value of values) {
    const index = source.indexOf(value);
    assert.ok(index > previous, `${message}: ${value}`);
    previous = index;
  }
}

test("MO-1108 region isolation is deterministic, reversible, and presentation-only", () => {
  const baseline = createGraphViewState({
    selectedKey: "Reflection:reflection-release-integrity",
    followedKey: "Reflection:reflection-release-integrity",
    interactionMode: "pan",
    camera: { scale: 1.18, x: 24, y: -16 },
  });

  const first = toggleGraphRegionIsolation(baseline, "reflection");
  const repeatedFromSameState = toggleGraphRegionIsolation(baseline, "reflection");
  assert.deepEqual(first, repeatedFromSameState, "the same state and action must produce the same view");
  assert.equal(first.filteredKind, "reflection");
  assert.equal(baseline.filteredKind, null, "isolation must not mutate the previous view state");

  const restored = toggleGraphRegionIsolation(first, "reflection");
  assert.deepEqual(restored, baseline, "activating the isolated region again restores the prior view");
  assert.deepEqual(
    { ...first, filteredKind: baseline.filteredKind },
    baseline,
    "region isolation may change only the presentation filter",
  );

  assert.throws(() => toggleGraphRegionIsolation(baseline, ""), /region kind/i);
  assert.doesNotMatch(
    viewStateSource,
    /studio-model|host-adapter|observation-timeline|cognitive-(?:trace|replay|evolution|comparative)|snapshot|runtime/i,
    "serializable graph view state must not depend on cognition engines or runtime values",
  );

  const isolationStart = graphSource.indexOf("const toggleRegionIsolation = (kind) =>");
  const isolationEnd = graphSource.indexOf("const svg = svgElement", isolationStart);
  assert.notEqual(isolationStart, -1);
  assert.notEqual(isolationEnd, -1);
  const isolationHandler = graphSource.slice(isolationStart, isolationEnd);
  assert.match(isolationHandler, /toggleGraphRegionIsolation\(currentViewState\(\), kind\)/);
  assert.match(isolationHandler, /synchronizeIsolationControls\(\)/);
  assert.match(isolationHandler, /applyGraphEmphasis\(\)/);
  assert.match(isolationHandler, /emitViewState\(\)/);
  assert.doesNotMatch(isolationHandler, /buildGraph|resolveSnapshot|commandAdapter|acceptObservationFrame/);
  assert.match(stylesSource, /\.cognitive-region\[role="button"\]/);
  assert.match(stylesSource, /\.cognitive-region\.is-isolated/);
});

test("MO-1108 calibrates the renderer viewport without changing semantic geography", () => {
  assert.deepEqual(semanticWorldLayout.viewBox, {
    width: 960,
    height: 540,
    centerX: 480,
    centerY: 270,
  });

  const normalizedSemanticWorld = semanticWorldSource.replaceAll("\r\n", "\n");
  assert.equal(
    createHash("sha256").update(normalizedSemanticWorld).digest("hex"),
    "1d49a1efc103f1b987a8efc239720736d7c6c2db08ceb8e0f9ee94f539665031",
    "the stable semantic-world source is unchanged by renderer calibration",
  );
  assert.doesNotMatch(semanticWorldSource, /rendererViewBox|viewport padding|camera calibration/i);

  assert.match(graphSource, /const viewBox = semanticWorldLayout\.viewBox/);
  assert.match(graphSource, /const rendererViewBox = Object\.freeze\(\{\s*x: -72,\s*y: -42,\s*width: viewBox\.width \+ 144,\s*height: viewBox\.height \+ 84,/);
  assert.match(
    graphSource,
    /viewBox: `\$\{rendererViewBox\.x\} \$\{rendererViewBox\.y\} \$\{rendererViewBox\.width\} \$\{rendererViewBox\.height\}`/,
  );
  assert.match(graphSource, /camera\.scale = 1;\s*camera\.x = 0;\s*camera\.y = 0;/);
  assert.doesNotMatch(graphSource, /semanticWorldLayout\.viewBox\s*=|viewBox\.width\s*=|viewBox\.height\s*=/);
});

test("MO-1108 exposes one exact Observe to Trace to Replay to Compare to Return workflow", () => {
  const phase = functionSource(appSource, "workflowPhase", "executeReplayCommand");
  assert.match(phase, /return investigation\.phase/,
    "Studio consumes the SDK lifecycle projection backed by the Core");

  const view = functionSource(appSource, "investigationWorkflowView", "refreshInvestigationWorkflow");
  ordered(view, [
    'id: "observe"',
    'id: "trace"',
    'id: "replay"',
    'id: "compare"',
  ], "the visible workflow must preserve the investigation order");
  assert.match(view, /data-workflow-action="\$\{step\.id\}"/);
  assert.match(view, /data-workflow-action="return"/);

  const actions = functionSource(appSource, "handleWorkflowAction", "bindInvestigationWorkflow");
  ordered(actions, [
    'action === "return"',
    'action === "observe"',
    'action === "trace"',
    'action === "replay"',
    'action === "compare"',
  ], "workflow actions must be handled explicitly");
  assert.match(actions, /returnFromInvestigation\(\)/);
  assert.match(actions, /returnToSemanticWorld\(\)/);
  assert.match(actions, /restoreTraceFromComparison\(\)/);
  assert.match(actions, /updateReplay\("restart"\)/);
  assert.match(actions, /updateReplay\(state\.replayState\.status === "completed" \? "restart" : "play"\)/);
  assert.match(actions, /updateEvolution\("compare"\)/);
  assert.match(actions, /activateComparativeReconstruction\(\)/);
  assert.match(appSource, /investigation\.returnToWorld\(\)/);
  assert.match(appSource, /from ["']\.\/memoryos-sdk\.js["']/);
  assert.doesNotMatch(appSource, /from ["']\.\/investigation-core\.js["']/);
  assert.match(memoryOSSDKSource, /from ["']\.\/investigation-core\.js["']/);
  assert.match(investigationCoreSource, /export function investigationPhase\(value\)/);

  const returnPath = functionSource(appSource, "returnFromInvestigation", "restoreTraceFromComparison");
  assert.match(returnPath, /state\.comparativeActive[\s\S]*updateComparativeReplay\("back"\)/);
  assert.match(returnPath, /state\.evolutionController\.active[\s\S]*updateEvolution\("compare"\)/);
  assert.match(returnPath, /state\.activeTrace[\s\S]*clearGraphSelection\(\)/);
  assert.match(stylesSource, /\.investigation-workflow/);
  assert.match(stylesSource, /\.workflow-step\.is-active/);
});

test("RC-001 resolves exact investigation ownership and gates Compare on completed Replay", () => {
  const matching = functionSource(appSource, "matchingWorldNode", "observationsForWorldNode");
  assert.match(matching, /node\.observationPath === observationPath/);
  assert.match(matching, /node\.identifier === identifier/);
  assert.match(matching, /familyHint === null \|\| node\.family === familyHint/);
  assert.match(matching, /if \(observationPath\) \{[\s\S]*\?\? null;[\s\S]*\}/, "an explicit path mismatch must not fall back to identifier resolution");
  assert.match(matching, /matches\.length === 1 \? matches\[0\] : null/);

  const selection = functionSource(appSource, "selectObservation", "renderGraphContext");
  assert.match(selection, /reconcileActiveTraceForSelection\(worldNode\)/);
  assert.doesNotMatch(selection, /matches\[0\]|\.at\(-1\)|sort\(/, "selection must never choose an identifier-only fallback");
  const traceQuery = functionSource(appSource, "queryTraceForNode", "reconcileActiveTraceForSelection");
  assert.match(traceQuery, /investigation\.trace\(node\.key\)/);
  assert.match(investigationCoreSource, /resolveCognitiveTraceTarget\(state\.currentFrame\.world, payload\.selectedNodeKey\)/);

  const availability = functionSource(appSource, "comparisonAvailability", "captureInvestigationCheckpoint");
  assert.match(availability, /!state\.coreAvailability\.compare/);
  assert.match(availability, /state\.evolutionController\.active \|\| state\.comparativeActive/);
  assert.match(availability, /!state\.activeTrace \|\| !state\.activeReplay \|\| state\.replayState\?\.status !== "completed"/);
  assert.match(availability, /Complete Cognitive Replay before comparing deterministic cognition/);

  const evolution = functionSource(appSource, "updateEvolution", "returnFromInvestigation");
  assert.match(evolution, /action === "compare" && !state\.evolutionController\.active && !comparisonAvailability\(\)\.available/);
  assert.match(evolution, /executeComparisonCommand\(coreAction\)/);
  assert.doesNotMatch(evolution, /compareCognitiveEvolution|buildComparativeReconstruction/);

  const actions = functionSource(appSource, "handleWorkflowAction", "bindInvestigationWorkflow");
  assert.match(actions, /action === "compare"[\s\S]*!comparisonAvailability\(\)\.available[\s\S]*updateEvolution\("compare"\)/);

  const rendererProjection = functionSource(appSource, "renderNeuralPerspective", "refreshReplayPresentation");
  assert.match(rendererProjection, /const comparison = comparisonAvailability\(\)/);
  assert.match(rendererProjection, /available: comparison\.available/);
  assert.match(rendererProjection, /unavailableReason: comparison\.reason/);
  assert.match(graphSource, /evolutionControl\.unavailableReason \|\| "Observe another frame to compare cognition\."/);
});

test("RC-001 clears invisible comparative targets whenever Evolution selection changes", () => {
  const renderer = functionSource(appSource, "renderNeuralPerspective", "refreshReplayPresentation");
  assert.match(renderer, /graphselectionclear[\s\S]*state\.evolutionSelection = null;[\s\S]*state\.comparativeTargetKey = null;[\s\S]*refreshInvestigationWorkflow\(\)/);

  const context = functionSource(appSource, "bindGraphContext", "selectInspectionResult");
  assert.match(context, /data-evolution-clear[\s\S]*state\.evolutionSelection = null;[\s\S]*state\.comparativeTargetKey = null;[\s\S]*refreshInvestigationWorkflow\(\)/);
});

test("MO-1108 comparison checkpoints restore the exact trace and replay state", () => {
  const capture = functionSource(appSource, "captureInvestigationCheckpoint", "restoreInvestigationCheckpoint");
  const restore = functionSource(appSource, "restoreInvestigationCheckpoint", "focusGraphControl");
  const evolution = functionSource(appSource, "updateEvolution", "returnFromInvestigation");

  assert.match(capture, /Object\.freeze\(\{/);
  assert.match(capture, /frameIdentifier: state\.activeTrace\.frameIdentifier/);
  assert.match(capture, /targetNodeKey: state\.activeTrace\.targetNodeKey/);
  assert.match(capture, /graphViewState: createGraphViewState\(state\.graphViewState\)/);
  assert.doesNotMatch(capture, /replayState:|snapshotReplayState/,
    "the application checkpoint contains presentation state only");

  assert.match(restore, /state\.investigationCheckpoint = null/);
  assert.match(restore, /checkpoint\.frameIdentifier !== state\.activeTrace\.frameIdentifier/);
  assert.match(restore, /checkpoint\.targetNodeKey !== state\.activeTrace\.targetNodeKey/);
  assert.match(restore, /find\(\(\{ key \}\) => key === checkpoint\.targetNodeKey\)/);
  assert.doesNotMatch(restore, /restoreReplayState|buildCognitiveTrace/);
  assert.doesNotMatch(
    restore,
    /matchingWorldNode|graphSelection\?\.nodeKey|graphViewState\.selectedKey|findAnyObservations\(checkpoint|\?\?\s*state\./,
    "checkpoint restoration must never substitute a fallback investigation target",
  );

  assert.match(evolution, /captureInvestigationCheckpoint\(\)/);
  assert.match(evolution, /state\.investigationCheckpoint = checkpoint/);
  assert.match(evolution, /restoreInvestigationCheckpoint\(\)/);
  assert.match(investigationCoreSource, /comparisonCheckpoint = deepFreeze\(\{/);
  assert.match(investigationCoreSource, /snapshotReplayState\(state\.activeReplay, state\.replayState\)/);
  assert.match(investigationCoreSource, /restoreReplayState\(state\.activeReplay, checkpoint\.replayState\)/);
});

test("MO-1108 route changes clear every transient investigation controller", () => {
  const start = appSource.indexOf('window.addEventListener("hashchange"');
  const end = appSource.indexOf('document.querySelector("#run-inspect")', start);
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const cleanup = appSource.slice(start, end);

  for (const contract of [
    /clearReplayTimer\(\)/,
    /clearComparativeReplayTimer\(\)/,
    /investigation\.returnToWorld\(\)/,
    /state\.evolutionSelection = null/,
    /state\.comparativeTargetKey = null/,
    /state\.comparativeDiagnostic = null/,
    /state\.investigationCheckpoint = null/,
    /state\.traceDiagnostic = null/,
    /clearObservedSelection\(\)/,
    /state\.lastOperation = null/,
  ]) assert.match(cleanup, contract);
  const synchronization = functionSource(appSource, "synchronizeFromMemoryOS", "workflowPhase");
  for (const field of ["activeTrace", "activeReplay", "replayState", "evolution", "comparativeReconstruction", "comparativeReplayState"]) {
    assert.match(synchronization, new RegExp(`state\\.${field} = investigationView\\.`));
  }
});

test("MO-1108 surfaces detached Evidence, Summary, and Export results", () => {
  const presentation = functionSource(appSource, "presentOperationResult", "primitiveRows");
  assert.match(presentation, /\["Trace", "Summarize", "ExportView"\]\.includes\(name\)/);
  assert.match(presentation, /name === "Trace"/);
  assert.match(presentation, /title = "Evidence report"/);
  assert.match(presentation, /result\.explanationChains/);
  assert.match(presentation, /exact explanation/);
  assert.match(presentation, /name === "Summarize"/);
  assert.match(presentation, /Observed scope summary/);
  assert.match(presentation, /result\.observations/);
  assert.match(presentation, /title = "Exported observation view"/);
  assert.match(presentation, /Detached export/);
  assert.match(presentation, /id="download-export-result"/);
  assert.match(presentation, /downloadDetachedView\(result\.view\)/);
  assert.match(presentation, /setInspectorClosed\(false, \{ focusInside: true \}\)/);

  const execute = functionSource(appSource, "execute", "executeSessionOperation");
  const sessionOperation = functionSource(appSource, "executeSessionOperation", "showToast");
  assert.match(execute, /\["Trace", "Summarize"\]\.includes\(name\)[\s\S]*presentOperationResult\(name, operationResult, query\)/);
  assert.match(sessionOperation, /name === "exportView"[\s\S]*presentOperationResult\("ExportView", result\)/);
  assert.match(stylesSource, /\.operation-result-panel/);
  assert.match(stylesSource, /\.operation-result-chain/);
  assert.match(stylesSource, /\.operation-result-values/);
});

test("MO-1108 gives every disabled graph control an explicit reason", () => {
  const helperStart = graphSource.indexOf("const setControlDisabled = (button, disabled, reason) =>");
  const helperEnd = graphSource.indexOf("const selectModeButton", helperStart);
  assert.notEqual(helperStart, -1);
  assert.notEqual(helperEnd, -1);
  const helper = graphSource.slice(helperStart, helperEnd);
  assert.match(helper, /button\.disabled = Boolean\(disabled\)/);
  assert.match(helper, /button\.title = reason/);
  assert.match(helper, /button\.setAttribute\("aria-description", reason\)/);
  assert.match(helper, /button\.removeAttribute\("aria-description"\)/);

  const graphWithoutHelper = `${graphSource.slice(0, helperStart)}${graphSource.slice(helperEnd)}`;
  assert.doesNotMatch(
    graphWithoutHelper,
    /\.disabled\s*=/,
    "graph controls must be disabled only through the reason-bearing helper",
  );
  assert.ok((graphSource.match(/setControlDisabled\(/g) ?? []).length >= 20, "all replay, evolution, and comparison states use the helper");

  const workflow = functionSource(appSource, "investigationWorkflowView", "refreshInvestigationWorkflow");
  assert.match(workflow, /step\.available \? "" : " disabled"/);
  assert.match(workflow, /title="\$\{escapeHtml\(title\)\}"/);
  assert.match(workflow, /data-disabled-reason="\$\{escapeHtml\(step\.reason\)\}"/);
  assert.match(workflow, /aria-description="\$\{escapeHtml\(step\.available \? step\.title : step\.reason\)\}"/);
});

test("release interaction audit connects hit targets, enabled state, and renderer feedback", () => {
  const workflow = functionSource(appSource, "investigationWorkflowView", "refreshInvestigationWorkflow");
  assert.match(workflow, /available: phase !== "observe"/);
  assert.match(workflow, /available: hasInvestigation && phase !== "trace"/);
  assert.match(workflow, /available: hasInvestigation && replayActionable/);
  assert.match(workflow, /phase !== "compare"/);
  assert.match(workflow, /state\.comparisonFrames/);
  assert.match(workflow, /Boolean\(evolutionPair && comparableReflectionTarget\(evolutionPair\)\)/);

  const rendererCallback = functionSource(appSource, "renderNeuralPerspective", "refreshReplayPresentation");
  assert.match(rendererCallback, /updateReplay\("pause"\)[\s\S]*refreshReplayPresentation\(\)/);
  const replayUpdate = functionSource(appSource, "updateReplay", "scheduleReplay");
  assert.match(replayUpdate, /executeReplayCommand\(action\)/);
  assert.match(rendererCallback, /state\.comparativeTargetKey = comparable \? node\.key : null;[\s\S]*refreshInvestigationWorkflow\(\)/);
  assert.match(rendererCallback, /graphselectionclear[\s\S]*state\.evolutionSelection = null;[\s\S]*renderGraphContext\(\)/);

  assert.match(graphSource, /if \(interactionMode !== "pan"\) event\.stopPropagation\(\)/);
  assert.match(graphSource, /if \(interactionMode === "pan"\) return;[\s\S]*toggleRegionIsolation\(definition\.kind\)/);
  assert.match(graphSource, /"aria-disabled": interactionMode === "pan" \? "true" : "false"/);
  assert.match(graphSource, /setControlDisabled\(selectModeButton, mode === "select"/);
  assert.match(graphSource, /setControlDisabled\(panModeButton, mode === "pan"/);
  assert.match(graphSource, /setControlDisabled\(zoomOutButton, camera\.scale <= \.75/);
  assert.match(graphSource, /setControlDisabled\(zoomInButton, camera\.scale >= 2\.5/);
  assert.match(graphSource, /setControlDisabled\(fitButton, atHome/);
  assert.match(graphSource, /nextReplayView\.currentNodeKey[\s\S]*focusCameraOn\(nextFollowNode\)/);
  assert.match(graphSource, /toggleRegionIsolation\(kind\)/);
  assert.ok(
    (graphSource.match(/if \(selectedKey === node\.key\)[\s\S]{0,320}graphselectionclear/g) ?? []).length >= 3,
    "graph, trace inventory, and accessible inventory all toggle the selected node clear",
  );
  assert.doesNotMatch(graphSource, /button\.addEventListener\("click", \(\) => \{\s*filteredKind = kind;/);

  assert.match(stylesSource, /\.graph-tool:hover:not\(:disabled\)/);
  assert.match(stylesSource, /\.graph-tool:disabled,[\s\S]*cursor: not-allowed/);
  const finalCalibration = stylesSource.slice(stylesSource.indexOf("Final MO-1108 row calibration"));
  assert.match(finalCalibration, /\.workflow-reason,[\s\S]*\.neural-signal-ribbon[\s\S]*pointer-events: none !important/);
  assert.match(finalCalibration, /has-comparative-reconstruction \.graph-toolbar[\s\S]*overflow-x: auto/);
  assert.match(finalCalibration, /\.has-investigation \.cognitive-trace-accessible-list,[\s\S]*\.comparative-reconstruction-accessible-list[\s\S]*bottom: calc\(88px/);
  assert.match(finalCalibration, /studio-shell\.inspector-open \.session-actions,[\s\S]*\.graph-accessible-list[\s\S]*visibility: hidden !important/);
  assert.match(stylesSource, /studio-shell\.inspector-open \.investigation-workflow[\s\S]*right: 384px !important/);
  assert.match(finalCalibration, /@media \(max-width: 1399px\)[\s\S]*studio-shell\.inspector-open \.topology-interface \.graph-toolbar[\s\S]*neural-flow-ribbon[\s\S]*visibility: hidden !important/);

  const availability = functionSource(appSource, "setStaticControlDisabled", "execute");
  assert.match(availability, /state\.sessionState === "Forgotten"/);
  assert.match(availability, /The production Studio host adapter is unavailable/);
  assert.match(availability, /elements\.globalQuery/);
});

test("MO-1108 keeps trace, replay, evolution, and comparison engines out of the renderer", () => {
  const importBoundary = graphSource.slice(0, graphSource.indexOf("const viewBox"));
  assert.doesNotMatch(importBoundary, /from\s+["']\.\/cognitive-(?:trace|replay|evolution|comparative)[^"']*["']/);
  assert.doesNotMatch(
    graphSource,
    /\b(?:buildCognitiveTrace|queryCognitiveTrace|buildCognitiveReplay|advanceReplay|compareCognitiveEvolution|buildComparativeReconstruction|advanceComparativeReplay)\b/,
  );
  assert.match(graphSource, /prepareTraceRenderingState\(world, trace\)/);
  assert.match(graphSource, /prepareEvolutionRenderingState\(world, evolutionView\)/);
  assert.match(graphSource, /prepareComparativeRenderingState\(world, comparativeView\)/);
});

test("MO-1108 preserves all six frozen Studio operation controls", () => {
  const controls = [
    ["observe-view", /executeSessionOperation\("observe"\)/],
    ["run-inspect", /execute\("Inspect"\)/],
    ["run-trace", /execute\("Trace"\)/],
    ["run-summary", /execute\("Summarize"\)/],
    ["export-view", /executeSessionOperation\("exportView"\)/],
    ["forget-session", /forgetDialog\.showModal\(\)/],
  ];
  for (const [identifier, binding] of controls) {
    assert.equal((htmlSource.match(new RegExp(`id="${identifier}"`, "g")) ?? []).length, 1, `${identifier} remains unique`);
    assert.match(appSource, new RegExp(`querySelector\\("#${identifier}"\\)\\.addEventListener\\("click"`));
    assert.match(appSource, binding);
  }
});

test("release control inventory keeps every application-chrome control connected or explicitly unavailable", () => {
  const clickBindings = [
    ["menu-toggle", /elements\.menuToggle\.addEventListener\("click"/],
    ["nav-backdrop", /elements\.backdrop\.addEventListener\("click"/],
    ["inspector-toggle", /querySelector\("#inspector-toggle"\)\.addEventListener\("click"/],
    ["inspector-close", /querySelector\("#inspector-close"\)\.addEventListener\("click"/],
  ];
  for (const [identifier, binding] of clickBindings) {
    assert.equal((htmlSource.match(new RegExp(`id="${identifier}"`, "g")) ?? []).length, 1);
    assert.match(appSource, binding);
  }
  assert.match(appSource, /elements\.globalQuery\.addEventListener\("keydown"/);
  assert.match(appSource, /elements\.queryIdentifier\.addEventListener\("keydown"/);
  assert.match(appSource, /elements\.forgetDialog\.addEventListener\("close"/);
  assert.match(appSource, /item\.setAttribute\("aria-disabled", "true"\)/);
  assert.match(appSource, /brand\?\.setAttribute\("aria-disabled", String\(brandCurrent\)\)/);
  assert.match(appSource, /aria-current="page" aria-disabled="true" tabindex="-1"/);
  assert.match(appSource, /Current perspective/);
  assert.match(appSource, /elements\.shell\.classList\.toggle\("inspector-open", !closed\)/);
});
