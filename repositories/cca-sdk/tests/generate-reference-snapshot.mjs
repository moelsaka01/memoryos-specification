import { writeFile } from "node:fs/promises";

import { referenceSnapshot } from "../../cca-studio/web/data/studio-snapshot.js";
import { canonicalize } from "../../cca-studio/web/js/mip-canonical.js";

const output = process.argv[2];
const changedOutput = process.argv[3];
if (!output) throw new Error("An output path is required.");
await writeFile(output, canonicalize(referenceSnapshot), "utf8");

if (changedOutput) {
  const changed = structuredClone(referenceSnapshot);
  changed.observationIdentifier = "observation-memoryos-sdk-second";
  changed.longTermMemory.entries[0].value = "SDK-visible deterministic evidence.";
  changed.semanticMemory.concepts[0].meaning = "SDK-visible deterministic meaning.";
  changed.retrievalSessions[0].candidates[0].rankScore += 1;
  changed.reflections[0].knowledge = "SDK-visible deterministic reflection.";
  await writeFile(changedOutput, canonicalize(changed), "utf8");
}
