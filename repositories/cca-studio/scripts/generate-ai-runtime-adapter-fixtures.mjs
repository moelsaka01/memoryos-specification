import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { anthropicSdkAdapter } from "../web/js/adapters/anthropic-sdk-adapter.js";
import { langGraphAdapter } from "../web/js/adapters/langgraph-adapter.js";
import { openAIAgentsSdkAdapter } from "../web/js/adapters/openai-agents-sdk-adapter.js";
import { referenceSource } from "../tests/fixtures/adapters/reference-sources.mjs";

const studioRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageRoot = resolve(studioRoot, "examples", "ai-runtime-adapters", "reference-packages");

const references = Object.freeze([
  Object.freeze({ adapter: openAIAgentsSdkAdapter, name: "openai-agents" }),
  Object.freeze({ adapter: anthropicSdkAdapter, name: "anthropic" }),
  Object.freeze({ adapter: langGraphAdapter, name: "langgraph" }),
]);

await mkdir(packageRoot, { recursive: true });

for (const { adapter, name } of references) {
  const bytes = await adapter.exportInvestigation(await referenceSource(name), {
    observationIdentifier: `observation-${name}-reference`,
    observationSequence: 0,
    packageIdentifier: `mip-adapter-${name}-reference`,
    sourceVersion: "reference-fixture-1.0.0",
    workspaceIdentifier: "workspace-adapter-reference",
  });
  await writeFile(resolve(packageRoot, `${name}-reference.mip`), bytes);
}
