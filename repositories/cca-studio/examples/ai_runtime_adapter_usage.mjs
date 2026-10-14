import { openAIAgentsSdkAdapter } from "../web/js/adapters/openai-agents-sdk-adapter.js";
import { verifyMemoryInvestigationPackage } from "../web/js/memory-investigation-package.js";

// Pass a real completed @openai/agents StreamedRunResult directly. This local
// shape demonstrates the same released surface without requiring the SDK.
const stream = {
  cancelled: false,
  completed: Promise.resolve(),
  error: null,
  interruptions: [],
  output: [
    {
      callId: "call-memory-001",
      id: "call-memory-001",
      name: "lookup_memory",
      arguments: "{\"identifier\":\"evidence-001\"}",
      status: "completed",
      type: "function_call",
    },
    {
      callId: "call-memory-001",
      id: "output-memory-001",
      name: "lookup_memory",
      output: "{\"identifier\":\"evidence-001\",\"retained\":true}",
      status: "completed",
      type: "function_call_result",
    },
  ],
  async *[Symbol.asyncIterator]() {
    yield {
      type: "raw_model_stream_event",
      data: { type: "response.created", sequence_number: 0 },
    };
    yield {
      type: "raw_model_stream_event",
      data: { type: "response.completed", sequence_number: 1 },
    };
  },
};

const artifact = await openAIAgentsSdkAdapter.createArtifact(
  stream,
  {
    observationIdentifier: "agents-run-001",
    observationSequence: 0,
    packageIdentifier: "investigation-agents-run-001",
    sourceVersion: "your-installed-sdk-version",
    workspaceIdentifier: "workspace-001",
  },
  "agents-run-001.mip",
);

const verification = verifyMemoryInvestigationPackage(Uint8Array.from(artifact.bytes));
if (!verification.valid) throw new Error("The generated package did not verify.");

process.stdout.write(`${artifact.name}\n`);
process.stdout.write(`${verification.package.integrity.packageDigest}\n`);
