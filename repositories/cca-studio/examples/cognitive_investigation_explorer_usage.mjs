import { referenceSnapshot } from "../web/data/studio-snapshot.js";
import {
  InvestigationCore,
} from "../web/js/investigation-core.js";
import { serializeCognitiveInvestigationResult } from "../web/js/cognitive-investigation-explorer.js";

const baselineSnapshot = structuredClone(referenceSnapshot);
const candidateSnapshot = structuredClone(referenceSnapshot);
candidateSnapshot.longTermMemory.entries[0].value = "Workspace identity remains stable.";

const core = new InvestigationCore();
const baseline = core.create({
  identifier: "explorer-example-baseline",
  snapshot: baselineSnapshot,
});
const candidate = core.create({
  identifier: "explorer-example-candidate",
  snapshot: candidateSnapshot,
});
const report = core.regression(baseline.identifier, candidate.identifier);

// A persisted regression report is a detached transport value. The Core owns
// its canonicalization, integrity validation, and deterministic navigation.
const parsedReport = JSON.parse(JSON.stringify(report));
const evidence = core.investigate(parsedReport, { category: "evidence" });

process.stdout.write(`${serializeCognitiveInvestigationResult(evidence)}\n`);
