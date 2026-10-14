import { readFile } from "node:fs/promises";

import { referenceSnapshot } from "../web/data/studio-snapshot.js";
import {
  InvestigationCore,
  investigationPhase,
  projectInvestigation,
} from "../web/js/investigation-core.js";
import { buildGraph } from "../web/js/studio-model.js";

const core = new InvestigationCore();
const first = structuredClone(referenceSnapshot);
const second = structuredClone(referenceSnapshot);
second.observationIdentifier = "observation-0002";
second.memory.entries.push({
  identifier: "mem-005",
  value: "Investigation Core remains renderer-independent.",
});

let investigation = core.create({ snapshot: first });
investigation = core.observe(investigation.identifier, {
  operation: "AcceptObservation",
  snapshot: second,
});

const reflection = buildGraph(second).nodes.find(({ key }) => (
  key.startsWith("reflection:") && !key.includes(":source-")
));
if (!reflection) throw new Error("The reference observation has no Reflection.");

investigation = core.trace(investigation.identifier, reflection.key);
while (investigation.state.replayState.status !== "completed") {
  investigation = core.replay(investigation.identifier, "next");
}

const replayCheckpoint = core.checkpoint(investigation.identifier);
investigation = core.compare(investigation.identifier, "enter");
investigation = core.compare(investigation.identifier, {
  action: "start",
  targetNodeKey: reflection.key,
});
investigation = core.compare(investigation.identifier, "nextStep");
investigation = core.compare(investigation.identifier, "back");
investigation = core.compare(investigation.identifier, "back");

const restoredCore = new InvestigationCore();
const restored = restoredCore.restore(replayCheckpoint);
const verified = restoredCore.verify(restored.identifier);
const archived = restoredCore.archive(verified.identifier);

const referencePackage = await readFile(new URL(
  "./ai-runtime-adapters/reference-packages/openai-agents-reference.mip",
  import.meta.url,
));
const packageCore = new InvestigationCore();
const imported = packageCore.import(referencePackage);
const canonicalPackage = packageCore.export(imported.identifier);

console.log(JSON.stringify({
  nativeInvestigation: {
    identifier: archived.identifier,
    lifecycle: archived.state.lifecycle,
    phaseBeforeArchive: investigationPhase(restored),
    transitionCount: archived.transitionLog.transitions.length,
    workspaceIdentifier: projectInvestigation(archived).workspaceIdentifier,
  },
  mipInvestigation: {
    identifier: imported.identifier,
    lifecycle: imported.state.lifecycle,
    observationCount: imported.state.packageObservations.length,
    traceAvailable: projectInvestigation(imported).availability.trace,
    exportedBytes: canonicalPackage.byteLength,
  },
}, null, 2));
