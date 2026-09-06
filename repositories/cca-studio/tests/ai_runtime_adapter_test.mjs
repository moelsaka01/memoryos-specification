import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AI_RUNTIME_ADAPTER_CONTRACT_VERSION,
  AIRuntimeAdapterError,
  defineAIRuntimeAdapter,
  isAIRuntimeAdapter,
  snapshotRuntimeEvent,
} from "../web/js/ai-runtime-adapter.js";
import { anthropicSdkAdapter } from "../web/js/adapters/anthropic-sdk-adapter.js";
import { langGraphAdapter } from "../web/js/adapters/langgraph-adapter.js";
import { openAIAgentsSdkAdapter } from "../web/js/adapters/openai-agents-sdk-adapter.js";
import {
  MemoryInvestigationPackageError,
  importMemoryInvestigationPackage,
  verifyMemoryInvestigationPackage,
} from "../web/js/memory-investigation-package.js";
import { canonicalize, sha256Hex, utf8Encode } from "../web/js/mip-canonical.js";
import {
  fixture,
  langGraphStream,
  openAIStream,
  referenceSource,
} from "./fixtures/adapters/reference-sources.mjs";

const references = Object.freeze({
  "openai-agents": Object.freeze({
    adapter: openAIAgentsSdkAdapter,
    bytes: 3259,
    cognitionDigest: "sha256:dd6a7d6151b8df8d668155cec1b48f494bb6db57f598c891bda4577ade7ca178",
    packageDigest: "sha256:cd2e167042d7c439fc54af39972d5f21eab439f71a0e3ec5066de90e088055c1",
    records: 3,
    sha256: "1f4bf525fdd4cae3a2e159ddcbc80f9d83c4364bcb48dc8e889589ca40374745",
  }),
  anthropic: Object.freeze({
    adapter: anthropicSdkAdapter,
    bytes: 2646,
    cognitionDigest: "sha256:3642313ece5aee63f0440f882d2d5c91322cbe14739061f7c0e702eeb9f35596",
    packageDigest: "sha256:0334885796b328ab746367dc0fc85b43eee78f8321523c94ee2c9b716496cef3",
    records: 1,
    sha256: "a8c568ca3e8e8d3dc65b1e7261592583be456f1bfe76551069116ab00fa230fa",
  }),
  langgraph: Object.freeze({
    adapter: langGraphAdapter,
    bytes: 2666,
    cognitionDigest: "sha256:b8f93a435e17d9ed4c0d2900687e9ab16d586f532a878cbdb1e7a8d162d6b03b",
    packageDigest: "sha256:8ee53188bd6b0a3f6caf92d256746e92ab740897260bf5c4d5b37aef53591417",
    records: 1,
    sha256: "2b114b40f42102e0bf718225e6cd0d40e4b7ea1efba625460030e6e8b6b40db0",
  }),
});

function request(name = "generic") {
  return {
    observationIdentifier: `observation-${name}-reference`,
    observationSequence: 0,
    packageIdentifier: `mip-adapter-${name}-reference`,
    sourceVersion: "reference-fixture-1.0.0",
    workspaceIdentifier: "workspace-adapter-reference",
  };
}

async function referenceBytes(name) {
  return new Uint8Array(await readFile(new URL(
    `../examples/ai-runtime-adapters/reference-packages/${name}-reference.mip`,
    import.meta.url,
  )));
}

async function adapterFailure(promise, code, eventIndex = undefined) {
  await assert.rejects(promise, (error) => {
    assert.ok(error instanceof AIRuntimeAdapterError);
    assert.equal(error.code, code);
    if (eventIndex !== undefined) assert.equal(error.eventIndex, eventIndex);
    return true;
  });
}

function customAdapter(overrides = {}) {
  return defineAIRuntimeAdapter({
    descriptor: {
      eventKind: "memoryos.adapter.test.output",
      identifier: "org.memoryos.adapter.test",
      name: "Test adapter",
      sourceName: "Test runtime",
      version: "1.0.0",
    },
    initialize: overrides.initialize ?? (() => ({ events: [] })),
    observeEvent: overrides.observeEvent ?? ((event, { state }) => { state.events.push(event); }),
    finalize: overrides.finalize ?? (({ request: value, state }) => ({
      accepted: true,
      records: state.events.map((event, sourceOrder) => ({
        identifier: event.id ?? value.observationIdentifier,
        kind: "memoryos.adapter.test.output",
        revision: { value: event.value ?? event.type ?? "event" },
        sourceOrder,
      })),
      relationships: [],
    })),
    sourceAuthorshipAttested: true,
  });
}

test("MO-1202 generic contract is immutable, provider-independent, and explicitly attested", () => {
  assert.equal(AI_RUNTIME_ADAPTER_CONTRACT_VERSION, "1.0.0");
  for (const { adapter } of Object.values(references)) {
    assert.equal(isAIRuntimeAdapter(adapter), true);
    assert.equal(adapter.sourceAuthorshipAttested, true);
    assert.ok(Object.isFrozen(adapter));
    assert.ok(Object.isFrozen(adapter.descriptor));
    assert.deepEqual(Object.keys(adapter).sort(), [
      "contractVersion", "createArtifact", "createInvestigation", "descriptor",
      "exportInvestigation", "sourceAuthorshipAttested",
    ]);
  }
  assert.throws(() => defineAIRuntimeAdapter({
    descriptor: openAIAgentsSdkAdapter.descriptor,
    finalize() {},
    observeEvent() {},
  }), /attest source authorship/);
});

test("CCA-MOS-ADAPT-009: empty streams, adapter hooks, and MIP failures preserve the closed diagnostic contract", async () => {
  const closedCodes = [
    "EMPTY_RUNTIME_STREAM",
    "INVALID_RUNTIME_EVENT",
    "EVENT_ORDER_VIOLATION",
    "INCOMPLETE_RUNTIME_STREAM",
    "RUNTIME_STREAM_FAILURE",
    "RUNTIME_EVENT_RESOURCE_LIMIT",
  ];
  for (const code of closedCodes) {
    assert.equal(new AIRuntimeAdapterError(code).code, code);
  }
  assert.throws(
    () => new AIRuntimeAdapterError("PRIVATE_PROVIDER_FAILURE"),
    /closed adapter diagnostic set/u,
  );

  await adapterFailure(
    customAdapter().createInvestigation([], request()),
    "EMPTY_RUNTIME_STREAM",
  );

  const forged = new AIRuntimeAdapterError("INVALID_RUNTIME_EVENT");
  forged.code = "PRIVATE_PROVIDER_FAILURE";
  await adapterFailure(
    customAdapter({ initialize() { throw forged; } }).createInvestigation([{}], request()),
    "INVALID_RUNTIME_EVENT",
  );
  await adapterFailure(
    customAdapter({ observeEvent() { throw forged; } }).createInvestigation([{}], request()),
    "INVALID_RUNTIME_EVENT",
    0,
  );
  await adapterFailure(
    customAdapter({ finalize() { throw forged; } }).createInvestigation([{}], request()),
    "INCOMPLETE_RUNTIME_STREAM",
  );

  const hostileDiagnostic = (member) => {
    const error = Object.create(AIRuntimeAdapterError.prototype);
    Object.defineProperties(error, {
      code: { configurable: true, value: "INVALID_RUNTIME_EVENT" },
      eventIndex: { configurable: true, value: null },
      message: { configurable: true, value: "hostile diagnostic" },
    });
    Object.defineProperty(error, member, {
      get() { throw new Error(`${member} accessor escaped`); },
    });
    return error;
  };
  await adapterFailure(
    customAdapter({ initialize() { throw hostileDiagnostic("code"); } })
      .createInvestigation([{}], request()),
    "INVALID_RUNTIME_EVENT",
  );
  await adapterFailure(
    customAdapter({ observeEvent() { throw hostileDiagnostic("eventIndex"); } })
      .createInvestigation([{}], request()),
    "INVALID_RUNTIME_EVENT",
    0,
  );
  await adapterFailure(
    customAdapter({ finalize() { throw hostileDiagnostic("message"); } })
      .createInvestigation([{}], request()),
    "INCOMPLETE_RUNTIME_STREAM",
  );

  const mipFailure = customAdapter({ finalize: () => ({
    accepted: true,
    records: [{
      identifier: "prohibited",
      kind: "memoryos.adapter.test.output",
      revision: { screenshot: "data:image/png;base64,AAAA" },
      sourceOrder: 0,
    }],
    relationships: [],
  }) });
  await assert.rejects(mipFailure.createInvestigation([{}], request()), (error) => {
    assert.ok(error instanceof MemoryInvestigationPackageError);
    assert.equal(error.diagnostics[0].code, "PROHIBITED_CONTENT");
    return true;
  });
});

test("MO-1202 published reference streams reproduce canonical verified MIP packages", async () => {
  for (const [name, expected] of Object.entries(references)) {
    const bytes = await expected.adapter.exportInvestigation(await referenceSource(name), request(name));
    const golden = await referenceBytes(name);
    assert.deepEqual(bytes, golden, name);
    assert.equal(bytes.length, expected.bytes, name);
    assert.equal(sha256Hex(bytes), expected.sha256, name);
    const verification = verifyMemoryInvestigationPackage(bytes);
    assert.equal(verification.valid, true, `${name}: ${JSON.stringify(verification.diagnostics)}`);
    assert.equal(verification.package.observations[0].records.length, expected.records, name);
    assert.equal(verification.package.integrity.packageDigest, expected.packageDigest, name);
    assert.equal(verification.package.integrity.cognitionDigest, expected.cognitionDigest, name);
  }
});

test("MO-1202 packages contain completed cognition, never transport/runtime residue", async () => {
  for (const [name, { adapter }] of Object.entries(references)) {
    const packageValue = await adapter.createInvestigation(await referenceSource(name), request(name));
    const text = canonicalize(packageValue);
    assert.ok(packageValue.observations[0].records.every(
      ({ role, provenance }) => role === "context" && provenance.length === 0,
    ));
    assert.deepEqual(packageValue.observations[0].relationships, []);
    assert.deepEqual(packageValue.traces, []);
    assert.deepEqual(packageValue.replays, []);
    assert.deepEqual(packageValue.evolutions, []);
    assert.deepEqual(packageValue.comparativeReconstructions, []);
    assert.doesNotMatch(text, /sequence_number|timestamp|namespace|usage|token|lifecycle|raw_model_stream_event|run_item_stream_event|ping/);
  }
});

test("MO-1202 Anthropic transport chunking does not change cognition", async () => {
  const split = await fixture("anthropic");
  const combined = structuredClone(split);
  combined.splice(2, 2, {
    type: "content_block_delta",
    index: 0,
    delta: { type: "text_delta", text: "Deterministic observation." },
  });
  assert.deepEqual(
    await anthropicSdkAdapter.exportInvestigation(split, request("anthropic")),
    await anthropicSdkAdapter.exportInvestigation(combined, request("anthropic")),
  );
});

test("MO-1202 LangGraph wall-clock and namespace runtime IDs do not change cognition", async () => {
  const events = await fixture("langgraph");
  const output = await fixture("langgraph", "output");
  const changed = structuredClone(events);
  changed.forEach((event, index) => {
    event.params.timestamp += (index + 1) * 97_531;
    event.params.namespace = event.params.namespace.map((part) => part.replace("reference", "other-runtime"));
  });
  assert.deepEqual(
    await langGraphAdapter.exportInvestigation(langGraphStream(events, output), request("langgraph")),
    await langGraphAdapter.exportInvestigation(langGraphStream(changed, output), request("langgraph")),
  );
});

test("MO-1202 OpenAI waits for settled output and rejects non-success terminal states", async () => {
  const events = await fixture("openai-agents");
  const output = await fixture("openai-agents", "output");
  await adapterFailure(openAIAgentsSdkAdapter.createInvestigation(events, request("openai-agents")), "INCOMPLETE_RUNTIME_STREAM");
  await adapterFailure(openAIAgentsSdkAdapter.createInvestigation(
    openAIStream(events, output, { cancelled: true }), request("openai-agents"),
  ), "INCOMPLETE_RUNTIME_STREAM");
  await adapterFailure(openAIAgentsSdkAdapter.createInvestigation(
    openAIStream(events, output, { error: new Error("failed") }), request("openai-agents"),
  ), "INCOMPLETE_RUNTIME_STREAM");
  await adapterFailure(openAIAgentsSdkAdapter.createInvestigation(
    openAIStream(events, output, { interruptions: [{}] }), request("openai-agents"),
  ), "INCOMPLETE_RUNTIME_STREAM");
  await adapterFailure(openAIAgentsSdkAdapter.createInvestigation(
    openAIStream(events, output, { completed: Promise.reject(new Error("failed")) }), request("openai-agents"),
  ), "INCOMPLETE_RUNTIME_STREAM");
  const failed = structuredClone(events);
  failed.at(-1).data.type = "response.failed";
  await adapterFailure(openAIAgentsSdkAdapter.createInvestigation(
    openAIStream(failed, output), request("openai-agents"),
  ), "INCOMPLETE_RUNTIME_STREAM");
});

test("MO-1202 OpenAI accepts official callId/result shapes and preserves their pairing", async () => {
  const events = await fixture("openai-agents");
  const output = await fixture("openai-agents", "output");
  const packageValue = await openAIAgentsSdkAdapter.createInvestigation(
    openAIStream(events, output), request("openai-agents"),
  );
  const revisions = packageValue.observations[0].records.map(({ revision }) => revision);
  const call = revisions.find(({ type }) => type === "function_call");
  const result = revisions.find(({ type }) => type === "function_call_result");
  assert.equal(call.callId, "call-weather");
  assert.equal(call.name, "lookup_weather");
  assert.equal(call.arguments, "{\"city\":\"Dubai\"}");
  assert.equal(result.callId, call.callId);
  assert.equal(result.name, call.name);
  assert.equal(result.output, "{\"temperatureC\":34}");
  assert.equal(Object.hasOwn(call, "call_id"), false);
  assert.equal(Object.hasOwn(result, "call_id"), false);
});

test("MO-1202 OpenAI response sequences restart only after completion and must finish", async () => {
  const events = await fixture("openai-agents");
  const output = await fixture("openai-agents", "output");
  const secondResponse = [
    {
      type: "raw_model_stream_event",
      data: { type: "response.created", sequence_number: 0, response: { id: "resp-second" } },
    },
    {
      type: "raw_model_stream_event",
      data: {
        type: "response.completed",
        sequence_number: 1,
        response: { id: "resp-second", status: "completed" },
      },
    },
  ];
  await openAIAgentsSdkAdapter.createInvestigation(
    openAIStream([...events, ...secondResponse], output), request("openai-agents"),
  );

  const badRestart = structuredClone(secondResponse);
  badRestart[0].data.sequence_number = 1;
  await adapterFailure(openAIAgentsSdkAdapter.createInvestigation(
    openAIStream([...events, ...badRestart], output), request("openai-agents"),
  ), "EVENT_ORDER_VIOLATION", events.length);

});

test("MO-1202 OpenAI cannot publish an unterminated response sequence", async () => {
  const events = await fixture("openai-agents");
  const output = await fixture("openai-agents", "output");
  const nextResponse = {
    type: "raw_model_stream_event",
    data: { type: "response.created", sequence_number: 0, response: { id: "resp-next" } },
  };
  await adapterFailure(openAIAgentsSdkAdapter.createInvestigation(
    openAIStream([...events, nextResponse], output), request("openai-agents"),
  ), "INCOMPLETE_RUNTIME_STREAM");
});

test("MO-1202 OpenAI Responses events require their authoritative sequence", async () => {
  const events = await fixture("openai-agents");
  const output = await fixture("openai-agents", "output");
  const missingSequence = structuredClone(events);
  delete missingSequence[0].data.sequence_number;
  await adapterFailure(openAIAgentsSdkAdapter.createInvestigation(
    openAIStream(missingSequence, output), request("openai-agents"),
  ), "INVALID_RUNTIME_EVENT", 0);
});

test("MO-1202 OpenAI projects model output without retaining Agent or RunItem objects", async () => {
  const events = await fixture("openai-agents");
  const output = await fixture("openai-agents", "output");
  class Agent {
    constructor() {
      this.name = "Reference";
      this.instructions = () => "must never be serialized";
      this.self = this;
    }
  }
  events[1].agent = new Agent();
  events[2].item = { agent: events[1].agent, type: "tool_call_item" };
  const packageValue = await openAIAgentsSdkAdapter.createInvestigation(
    openAIStream(events, output), request("openai-agents"),
  );
  const text = canonicalize(packageValue);
  assert.doesNotMatch(text, /instructions|must never be serialized|Weather Agent|Reference/);
  assert.match(text, /lookup_weather|temperatureC|observed temperature/);
});

test("MO-1202 OpenAI fails closed for unsupported, provider, or media output", async () => {
  const events = await fixture("openai-agents");
  const output = await fixture("openai-agents", "output");
  for (const changed of [
    [{ type: "reasoning", id: "reasoning-1", encrypted_content: "opaque" }],
    [{ ...output.at(-1), providerData: { requestId: "provider" } }],
    [{ ...output.at(-1), content: [{ type: "image", image: "data:image/png;base64,AAAA" }] }],
  ]) {
    await adapterFailure(openAIAgentsSdkAdapter.createInvestigation(
      openAIStream(events, changed), request("openai-agents"),
    ), "INVALID_RUNTIME_EVENT");
  }
});

test("MO-1202 OpenAI fails closed instead of stripping hidden or symbolic output state", async () => {
  const events = await fixture("openai-agents");
  const output = await fixture("openai-agents", "output");
  const hidden = structuredClone(output);
  Object.defineProperty(hidden[0], "credential", {
    configurable: true,
    enumerable: false,
    value: "must-not-be-stripped",
  });
  await adapterFailure(openAIAgentsSdkAdapter.createInvestigation(
    openAIStream(events, hidden), request("openai-agents"),
  ), "INVALID_RUNTIME_EVENT");

  const symbolic = structuredClone(output);
  symbolic[0][Symbol("provider-state")] = "must-not-be-stripped";
  await adapterFailure(openAIAgentsSdkAdapter.createInvestigation(
    openAIStream(events, symbolic), request("openai-agents"),
  ), "INVALID_RUNTIME_EVENT");
});

test("MO-1202 OpenAI never discards a malformed supplied source identifier", async () => {
  const events = await fixture("openai-agents");
  const output = await fixture("openai-agents", "output");
  for (const itemIndex of [0, 1, 2]) {
    const changed = structuredClone(output);
    changed[itemIndex].id = 42;
    await adapterFailure(openAIAgentsSdkAdapter.createInvestigation(
      openAIStream(events, changed), request("openai-agents"),
    ), "INVALID_RUNTIME_EVENT");
  }
});

test("MO-1202 OpenAI preserves source-authored strict JSON strings exactly", async () => {
  const events = await fixture("openai-agents");
  const output = await fixture("openai-agents", "output");
  const argumentsText = "{\"apiKey\":\"source-authored-placeholder\"}";
  const outputText = "{\"credential\":\"source-authored-placeholder\"}";
  const changed = output.map((item, index) => {
    if (index === 0) return { ...item, arguments: argumentsText };
    if (index === 1) return { ...item, output: outputText };
    return item;
  });
  const packageValue = await openAIAgentsSdkAdapter.createInvestigation(
    openAIStream(events, changed), request("openai-agents"),
  );
  const revisions = packageValue.observations[0].records.map(({ revision }) => revision);
  assert.equal(revisions.find(({ type }) => type === "function_call").arguments, argumentsText);
  assert.equal(revisions.find(({ type }) => type === "function_call_result").output, outputText);
});

test("MO-1202 OpenAI bounds decoded function argument structure before projection", async () => {
  const events = await fixture("openai-agents");
  const output = (valueCount) => [{
    arguments: JSON.stringify({ values: Array.from({ length: valueCount }, (_, index) => index) }),
    callId: "call-bounded",
    name: "bounded_operation",
    status: "completed",
    type: "function_call",
  }];
  const boundedRequest = { ...request("openai-agents"), maxSourceValues: 64 };

  await openAIAgentsSdkAdapter.createInvestigation(
    openAIStream(events, output(8)),
    boundedRequest,
  );
  await adapterFailure(
    openAIAgentsSdkAdapter.createInvestigation(
      openAIStream(events, output(128)),
      boundedRequest,
    ),
    "RUNTIME_EVENT_RESOURCE_LIMIT",
  );
});

test("MO-1202 Anthropic enforces its complete documented stream lifecycle", async () => {
  const source = await fixture("anthropic");
  await adapterFailure(anthropicSdkAdapter.createInvestigation(source.slice(0, -1), request("anthropic")), "INCOMPLETE_RUNTIME_STREAM");
  await adapterFailure(anthropicSdkAdapter.createInvestigation([source[0], source.at(-1)], request("anthropic")), "INVALID_RUNTIME_EVENT");
  const zeroBlockDelta = source.filter(({ type }) => type !== "content_block_delta");
  await adapterFailure(anthropicSdkAdapter.createInvestigation(zeroBlockDelta, request("anthropic")), "INVALID_RUNTIME_EVENT");
  const noMessageDelta = source.filter(({ type }) => type !== "message_delta");
  await adapterFailure(anthropicSdkAdapter.createInvestigation(noMessageDelta, request("anthropic")), "INVALID_RUNTIME_EVENT");
  const lateBlock = structuredClone(source);
  lateBlock.splice(-1, 0, { type: "content_block_start", index: 1, content_block: { type: "text", text: "" } });
  await adapterFailure(anthropicSdkAdapter.createInvestigation(lateBlock, request("anthropic")), "INVALID_RUNTIME_EVENT");
  await adapterFailure(anthropicSdkAdapter.createInvestigation([
    source[0], { type: "error", error: { type: "overloaded_error" } },
  ], request("anthropic")), "INCOMPLETE_RUNTIME_STREAM");

  const overlap = structuredClone(source);
  overlap.splice(2, 0, {
    type: "content_block_start",
    index: 1,
    content_block: { type: "text", text: "" },
  });
  await adapterFailure(
    anthropicSdkAdapter.createInvestigation(overlap, request("anthropic")),
    "INVALID_RUNTIME_EVENT",
    2,
  );

  const missingStopReason = structuredClone(source);
  missingStopReason.find(({ type }) => type === "message_delta").delta.stop_reason = null;
  await adapterFailure(
    anthropicSdkAdapter.createInvestigation(missingStopReason, request("anthropic")),
    "INCOMPLETE_RUNTIME_STREAM",
  );

  const partialStopReason = structuredClone(source);
  const messageDeltaIndex = partialStopReason.findIndex(({ type }) => type === "message_delta");
  partialStopReason[messageDeltaIndex].delta.stop_reason = null;
  partialStopReason.splice(messageDeltaIndex + 1, 0, {
    type: "message_delta",
    delta: { stop_reason: "end_turn", stop_sequence: null },
    usage: { output_tokens: 8 },
  });
  await anthropicSdkAdapter.createInvestigation(partialStopReason, request("anthropic"));

  const conflictingStopSequence = structuredClone(source);
  const conflictingDeltaIndex = conflictingStopSequence.findIndex(({ type }) => type === "message_delta");
  conflictingStopSequence[conflictingDeltaIndex].delta = {
    stop_reason: null,
    stop_sequence: "first",
  };
  conflictingStopSequence.splice(conflictingDeltaIndex + 1, 0, {
    type: "message_delta",
    delta: { stop_reason: "stop_sequence", stop_sequence: "second" },
    usage: { output_tokens: 8 },
  });
  await adapterFailure(
    anthropicSdkAdapter.createInvestigation(conflictingStopSequence, request("anthropic")),
    "INVALID_RUNTIME_EVENT",
  );

  for (const extraSemanticMember of [
    (() => {
      const changed = structuredClone(source);
      changed.find(({ type }) => type === "content_block_start").content_block.providerData = {};
      return changed;
    })(),
    (() => {
      const changed = structuredClone(source);
      changed.find(({ type }) => type === "content_block_delta").delta.providerData = {};
      return changed;
    })(),
  ]) {
    await adapterFailure(
      anthropicSdkAdapter.createInvestigation(extraSemanticMember, request("anthropic")),
      "INVALID_RUNTIME_EVENT",
    );
  }
});

test("MO-1202 Anthropic rejects truncation and continuation stop reasons", async () => {
  const source = await fixture("anthropic");
  for (const stopReason of ["max_tokens", "model_context_window_exceeded", "pause_turn"]) {
    const changed = structuredClone(source);
    changed.find(({ type }) => type === "message_delta").delta.stop_reason = stopReason;
    await adapterFailure(
      anthropicSdkAdapter.createInvestigation(changed, request("anthropic")),
      "INCOMPLETE_RUNTIME_STREAM",
    );
  }
});

test("MO-1202 Anthropic bounds reconstructed tool input structure before projection", async () => {
  const source = (valueCount) => [
    { type: "message_start", message: { id: "msg-bounded", role: "assistant", content: [] } },
    {
      type: "content_block_start",
      index: 0,
      content_block: { type: "tool_use", id: "tool-bounded", name: "bounded_operation", input: {} },
    },
    {
      type: "content_block_delta",
      index: 0,
      delta: {
        type: "input_json_delta",
        partial_json: JSON.stringify({ values: Array.from({ length: valueCount }, (_, index) => index) }),
      },
    },
    { type: "content_block_stop", index: 0 },
    {
      type: "message_delta",
      delta: { stop_reason: "tool_use", stop_sequence: null },
      usage: { output_tokens: 8 },
    },
    { type: "message_stop" },
  ];
  const boundedRequest = { ...request("anthropic"), maxSourceValues: 64 };

  await anthropicSdkAdapter.createInvestigation(source(8), boundedRequest);
  await adapterFailure(
    anthropicSdkAdapter.createInvestigation(source(128), boundedRequest),
    "RUNTIME_EVENT_RESOURCE_LIMIT",
    3,
  );
});

test("MO-1202 Anthropic enforces retained-byte bounds incrementally and closes the source", async () => {
  let consumed = 0;
  let cleaned = false;
  async function* source() {
    try {
      for (const event of [
        { type: "message_start", message: { id: "m", role: "assistant", content: [] } },
        { type: "content_block_start", index: 0, content_block: { type: "text", text: "" } },
        { type: "content_block_delta", index: 0, delta: { type: "text_delta", text: "12345678" } },
        { type: "content_block_stop", index: 0 },
        { type: "message_delta", delta: { stop_reason: "end_turn" }, usage: {} },
        { type: "message_stop" },
      ]) {
        consumed += 1;
        yield event;
      }
    } finally {
      cleaned = true;
    }
  }
  await adapterFailure(anthropicSdkAdapter.createInvestigation(source(), {
    ...request("anthropic"),
    maxSourceBytes: 8,
  }), "RUNTIME_EVENT_RESOURCE_LIMIT", 2);
  assert.equal(consumed, 3);
  assert.equal(cleaned, true);
});

test("MO-1202 Anthropic never strips hidden, symbolic, or accessor-backed semantic content", async () => {
  const source = await fixture("anthropic");
  const hidden = structuredClone(source);
  Object.defineProperty(
    hidden.find(({ type }) => type === "content_block_start").content_block,
    "providerData",
    { enumerable: false, value: "must-not-be-stripped" },
  );
  await adapterFailure(
    anthropicSdkAdapter.createInvestigation(hidden, request("anthropic")),
    "INVALID_RUNTIME_EVENT",
  );

  const symbolic = structuredClone(source);
  symbolic.find(({ type }) => type === "content_block_delta").delta[Symbol("provider-state")] = true;
  await adapterFailure(
    anthropicSdkAdapter.createInvestigation(symbolic, request("anthropic")),
    "INVALID_RUNTIME_EVENT",
  );

  const accessor = structuredClone(source);
  let getterRead = false;
  const delta = accessor.find(({ type }) => type === "content_block_delta").delta;
  Object.defineProperty(delta, "text", {
    enumerable: true,
    get() { getterRead = true; return "must-not-be-read"; },
  });
  await adapterFailure(
    anthropicSdkAdapter.createInvestigation(accessor, request("anthropic")),
    "INVALID_RUNTIME_EVENT",
  );
  assert.equal(getterRead, false);
});

test("MO-1202 Anthropic accepts a zero-delta fallback boundary without changing cognition", async () => {
  const source = await fixture("anthropic");
  const withFallback = structuredClone(source);
  withFallback.splice(1, 0,
    { type: "content_block_start", index: 0, content_block: { type: "fallback", from: {}, to: {} } },
    { type: "content_block_stop", index: 0 });
  withFallback.forEach((event, index) => {
    if (index >= 3 && Number.isSafeInteger(event.index)) event.index += 1;
  });
  assert.deepEqual(
    await anthropicSdkAdapter.exportInvestigation(source, request("anthropic")),
    await anthropicSdkAdapter.exportInvestigation(withFallback, request("anthropic")),
  );
});

test("MO-1202 LangGraph validates v3 ordering, lifecycle, and explicit cognition projection", async () => {
  const events = await fixture("langgraph");
  const output = await fixture("langgraph", "output");
  for (const value of [events[0].seq, events[0].seq - 1]) {
    const invalid = structuredClone(events);
    invalid[1].seq = value;
    await adapterFailure(langGraphAdapter.createInvestigation(
      langGraphStream(invalid, output), request("langgraph"),
    ), "EVENT_ORDER_VIOLATION", 1);
  }
  for (const terminal of ["failed", "interrupted"]) {
    const invalid = structuredClone(events);
    invalid.at(-1).params.data.event = terminal;
    await adapterFailure(langGraphAdapter.createInvestigation(
      langGraphStream(invalid, output), request("langgraph"),
    ), "INCOMPLETE_RUNTIME_STREAM");
  }
  await adapterFailure(langGraphAdapter.createInvestigation(
    langGraphStream(events.slice(0, -1), output), request("langgraph"),
  ), "INCOMPLETE_RUNTIME_STREAM");
  await adapterFailure(langGraphAdapter.createInvestigation(
    langGraphStream(events, { unrelatedState: true }), request("langgraph"),
  ), "INCOMPLETE_RUNTIME_STREAM");

  const postTerminal = structuredClone(events);
  postTerminal.push({
    seq: 120,
    method: "custom",
    params: { namespace: [], timestamp: 1770000010000, data: "late" },
  });
  await adapterFailure(langGraphAdapter.createInvestigation(
    langGraphStream(postTerminal, output), request("langgraph"),
  ), "INVALID_RUNTIME_EVENT", events.length);

  const missingRelationships = structuredClone(output);
  delete missingRelationships.memoryosInvestigation.relationships;
  await adapterFailure(langGraphAdapter.createInvestigation(
    langGraphStream(events, missingRelationships), request("langgraph"),
  ), "INCOMPLETE_RUNTIME_STREAM");

  const extraProjectionMember = structuredClone(output);
  extraProjectionMember.memoryosInvestigation.providerState = {};
  await adapterFailure(langGraphAdapter.createInvestigation(
    langGraphStream(events, extraProjectionMember), request("langgraph"),
  ), "INVALID_RUNTIME_EVENT");
});

test("MO-1202 LangGraph accepts provider-defined passive scalar and debug data", async () => {
  const events = await fixture("langgraph");
  const output = await fixture("langgraph", "output");
  const augmented = structuredClone(events);
  augmented.splice(1, 0,
    {
      seq: 11,
      method: "custom",
      params: { namespace: ["provider"], timestamp: 1, data: "opaque provider event" },
    },
    {
      seq: 12,
      method: "debug",
      params: { namespace: ["provider"], timestamp: 2, data: 42 },
    });
  assert.deepEqual(
    await langGraphAdapter.exportInvestigation(
      langGraphStream(augmented, output), request("langgraph"),
    ),
    await langGraphAdapter.exportInvestigation(
      langGraphStream(events, output), request("langgraph"),
    ),
  );
});

test("MO-1202 async hooks remain sequential and failures publish no package", async () => {
  const calls = [];
  const adapter = customAdapter({
    async initialize() { calls.push("initialize"); return { values: [] }; },
    async observeEvent(event, { state }) { calls.push(`observe:${event.value}`); state.values.push(event.value); },
    async finalize({ state }) {
      calls.push("finalize");
      return {
        accepted: true,
        records: state.values.map((value, sourceOrder) => ({
          identifier: `value-${value}`, kind: "memoryos.adapter.test.output", revision: { value }, sourceOrder,
        })),
        relationships: [],
      };
    },
  });
  await adapter.createInvestigation([{ value: 1 }, { value: 2 }], request());
  assert.deepEqual(calls, ["initialize", "observe:1", "observe:2", "finalize"]);

  const failing = customAdapter({ async finalize() { throw new Error("not complete"); } });
  await adapterFailure(failing.createInvestigation([{ value: 1 }], request()), "INCOMPLETE_RUNTIME_STREAM");

  let acquired = false;
  const initializeFailure = customAdapter({ async initialize() { throw new Error("initialize"); } });
  await adapterFailure(initializeFailure.createInvestigation({
    [Symbol.iterator]() { acquired = true; return [][Symbol.iterator](); },
  }, request()), "INVALID_RUNTIME_EVENT");
  assert.equal(acquired, false);

  let cleaned = false;
  const observeFailure = customAdapter({
    async observeEvent() { throw new Error("observe"); },
  });
  async function* observedSource() {
    try { yield { value: 1 }; } finally { cleaned = true; }
  }
  await adapterFailure(observeFailure.createInvestigation(observedSource(), request()), "INVALID_RUNTIME_EVENT", 0);
  assert.equal(cleaned, true);

  const frozenDiagnostic = Object.freeze(new AIRuntimeAdapterError("INVALID_RUNTIME_EVENT"));
  const frozenFailure = customAdapter({
    async observeEvent() { throw frozenDiagnostic; },
  });
  await adapterFailure(
    frozenFailure.createInvestigation([{ value: 1 }], request()),
    "INVALID_RUNTIME_EVENT",
    0,
  );
  assert.equal(frozenDiagnostic.eventIndex, null);
});

test("MO-1202 concurrent adaptations keep hook state isolated", async () => {
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const adapter = customAdapter({
    initialize: () => ({ values: [] }),
    async observeEvent(event, { state }) {
      if (event.id === "first") await firstGate;
      else releaseFirst();
      state.values.push(event.id);
    },
    finalize: ({ state }) => ({
      accepted: true,
      records: state.values.map((value, sourceOrder) => ({
        identifier: value,
        kind: "memoryos.adapter.test.output",
        revision: { value },
        sourceOrder,
      })),
      relationships: [],
    }),
  });
  const [first, second] = await Promise.all([
    adapter.createInvestigation([{ id: "first" }], { ...request(), packageIdentifier: "mip-first" }),
    adapter.createInvestigation([{ id: "second" }], { ...request(), packageIdentifier: "mip-second" }),
  ]);
  assert.deepEqual(first.observations[0].records.map(({ reference }) => reference.identifier), ["first"]);
  assert.deepEqual(second.observations[0].records.map(({ reference }) => reference.identifier), ["second"]);
});

test("MO-1202 canonical snapshot rejects hidden, accessor, symbolic, and structured state", () => {
  for (const value of [new Date(0), new Map([["truth", 1]]), new Set([1]), /truth/, new Error("truth"), new Uint8Array([1])]) {
    assert.throws(() => snapshotRuntimeEvent({ value }), AIRuntimeAdapterError);
  }
  const customArray = [1];
  customArray.extra = "truth";
  assert.throws(() => snapshotRuntimeEvent({ customArray }), AIRuntimeAdapterError);
  const symbolic = [1];
  symbolic[Symbol("truth")] = 1;
  assert.throws(() => snapshotRuntimeEvent({ symbolic }), AIRuntimeAdapterError);
  const hidden = { type: "event" };
  Object.defineProperty(hidden, "credential", { value: "secret", enumerable: false });
  assert.throws(() => snapshotRuntimeEvent(hidden), AIRuntimeAdapterError);
  let getterRead = false;
  const accessor = { type: "event" };
  Object.defineProperty(accessor, "value", { enumerable: true, get() { getterRead = true; return 1; } });
  assert.throws(() => snapshotRuntimeEvent(accessor), AIRuntimeAdapterError);
  assert.equal(getterRead, false);
  class DetachedEvent { constructor() { this.type = "event"; this.value = 1; } }
  assert.throws(() => snapshotRuntimeEvent(new DetachedEvent()), AIRuntimeAdapterError);
  const inherited = Object.create({ credential: "hidden by prototype" });
  inherited.type = "event";
  assert.throws(() => snapshotRuntimeEvent(inherited), AIRuntimeAdapterError);

  const sparse = [];
  sparse.length = 3;
  assert.throws(() => snapshotRuntimeEvent({ sparse }), (error) => {
    assert.ok(error instanceof AIRuntimeAdapterError);
    assert.equal(error.code, "INVALID_RUNTIME_EVENT");
    return true;
  });
  const hugeSparse = [];
  hugeSparse.length = 1_000_001;
  assert.throws(() => snapshotRuntimeEvent({ hugeSparse }), (error) => {
    assert.ok(error instanceof AIRuntimeAdapterError);
    assert.equal(error.code, "RUNTIME_EVENT_RESOURCE_LIMIT");
    return true;
  });
});

test("MO-1202 iterator failures, cleanup, and state isolation are deterministic", async () => {
  const adapter = customAdapter();
  const getterFailure = {};
  Object.defineProperty(getterFailure, Symbol.asyncIterator, { get() { throw new Error("broken"); } });
  await adapterFailure(adapter.createInvestigation(getterFailure, request()), "RUNTIME_STREAM_FAILURE", 0);
  await adapterFailure(adapter.createInvestigation({ [Symbol.iterator]() { return null; } }, request()), "RUNTIME_STREAM_FAILURE", 0);
  await adapterFailure(adapter.createInvestigation({
    [Symbol.asyncIterator]: true,
    *[Symbol.iterator]() { yield { value: "must-not-fallback" }; },
  }, request()), "RUNTIME_STREAM_FAILURE", 0);
  await adapterFailure(adapter.createInvestigation({
    [Symbol.iterator]() {
      return Object.defineProperty({}, "next", { get() { throw new Error("broken next"); } });
    },
  }, request()), "RUNTIME_STREAM_FAILURE", 0);

  let cleaned = false;
  const failing = customAdapter({
    observeEvent(event) {
      if (event.type === "invalid") throw new AIRuntimeAdapterError("INVALID_RUNTIME_EVENT", null);
    },
    finalize() { throw new Error("unreachable"); },
  });
  async function* source() {
    try { yield { type: "invalid" }; } finally { cleaned = true; throw new Error("cleanup"); }
  }
  await adapterFailure(failing.createInvestigation(source(), request()), "INVALID_RUNTIME_EVENT", 0);
  assert.equal(cleaned, true);
  const good = await adapter.createInvestigation([{ id: "after-failure", value: "valid" }], request());
  assert.equal(good.observations[0].records[0].revision.value, "valid");

  const asyncPreferred = {
    async *[Symbol.asyncIterator]() { yield { id: "async", value: "preferred" }; },
  };
  Object.defineProperty(asyncPreferred, Symbol.iterator, {
    get() { throw new Error("sync iterator must not be read"); },
  });
  const preferred = await adapter.createInvestigation(asyncPreferred, request());
  assert.equal(preferred.observations[0].records[0].revision.value, "preferred");

  let nextCalls = 0;
  let failureClosed = false;
  const nextFailure = {
    [Symbol.asyncIterator]() {
      return {
        async next() {
          if (nextCalls++ === 0) return { done: false, value: { id: "first", value: 1 } };
          throw new Error("source failure");
        },
        async return() { failureClosed = true; return { done: true }; },
      };
    },
  };
  await adapterFailure(adapter.createInvestigation(nextFailure, request()), "RUNTIME_STREAM_FAILURE", 1);
  assert.equal(failureClosed, true);

  let limitClosed = false;
  let limitIndex = 0;
  const limited = {
    [Symbol.iterator]() {
      return {
        next() { return { done: false, value: { id: `limit-${limitIndex++}`, value: limitIndex } }; },
        return() { limitClosed = true; return { done: true }; },
      };
    },
  };
  await adapterFailure(adapter.createInvestigation(limited, {
    ...request(),
    maxEvents: 1,
  }), "RUNTIME_EVENT_RESOURCE_LIMIT", 1);
  assert.equal(limitClosed, true);
});

test("MO-1202 resource limits apply before investigation publication", async () => {
  const projection = {
    accepted: true,
    records: [{
      identifier: "resource",
      kind: "memoryos.adapter.test.output",
      revision: { value: "bounded" },
      sourceOrder: 0,
    }],
    relationships: [],
  };
  const adapter = customAdapter({ finalize: () => projection });
  const exact = utf8Encode(canonicalize(projection)).byteLength;
  await adapter.createInvestigation([{}], { ...request(), maxSourceBytes: exact });
  await adapterFailure(adapter.createInvestigation([{}], {
    ...request(), maxSourceBytes: exact - 1,
  }), "RUNTIME_EVENT_RESOURCE_LIMIT");
  await adapterFailure(adapter.createInvestigation([{}], {
    ...request(), maxSourceValues: 2,
  }), "RUNTIME_EVENT_RESOURCE_LIMIT");
  await adapterFailure(adapter.createInvestigation([{}], {
    ...request(), maxPackageBytes: 100,
  }), "RUNTIME_EVENT_RESOURCE_LIMIT");
});

test("MO-1202 projection contract preserves colliding identities as contiguous occurrences", async () => {
  const record = {
    identifier: "same",
    kind: "memoryos.adapter.test.output",
    revision: { value: "same" },
    sourceOrder: 0,
  };
  const collisions = customAdapter({ finalize: () => ({
    accepted: true,
    records: [record, { ...record, revision: { value: "different" }, sourceOrder: 1 }],
    relationships: [],
  }) });
  const packageValue = await collisions.createInvestigation([{}], request());
  assert.equal(packageValue.observations[0].records.length, 2);
  assert.deepEqual(packageValue.observations[0].records.map(({ reference }) => reference.occurrence), [0, 1]);
  assert.deepEqual(packageValue.observations[0].records.map(({ revision }) => revision.sourceOrdinal), [undefined, undefined]);
  assert.equal(Object.hasOwn(record.revision, "sourceOrdinal"), false);

  for (const projection of [
    { accepted: false, records: [record], relationships: [] },
    { accepted: true, records: [record], relationships: [{}] },
    { accepted: true, records: [record], relationships: [], unexpected: true },
    { accepted: true, records: [record, { ...record, sourceOrder: 0 }], relationships: [] },
    { accepted: true, records: [{ ...record, kind: "memoryos.adapter.other.output" }], relationships: [] },
  ]) {
    const invalid = customAdapter({ finalize: () => projection });
    await assert.rejects(invalid.createInvestigation([{}], request()), AIRuntimeAdapterError);
  }
});

test("MO-1202 source ordering is deterministic and affects only repeated identities", async () => {
  const projection = (identifiers) => ({
    accepted: true,
    records: identifiers.map((identifier, sourceOrder) => ({
      identifier,
      kind: "memoryos.adapter.test.output",
      revision: { value: identifier },
      sourceOrder,
    })),
    relationships: [],
  });
  const forward = customAdapter({ finalize: () => projection(["a", "b"]) });
  const reverse = customAdapter({ finalize: () => projection(["b", "a"]) });
  assert.deepEqual(
    await forward.exportInvestigation([{}], request()),
    await reverse.exportInvestigation([{}], request()),
  );

  const collisionsForward = customAdapter({ finalize: () => ({
    accepted: true,
    records: [
      { identifier: "same", kind: "memoryos.adapter.test.output", revision: { value: "a" }, sourceOrder: 0 },
      { identifier: "same", kind: "memoryos.adapter.test.output", revision: { value: "b" }, sourceOrder: 1 },
    ],
    relationships: [],
  }) });
  const collisionsReverse = customAdapter({ finalize: () => ({
    accepted: true,
    records: [
      { identifier: "same", kind: "memoryos.adapter.test.output", revision: { value: "b" }, sourceOrder: 0 },
      { identifier: "same", kind: "memoryos.adapter.test.output", revision: { value: "a" }, sourceOrder: 1 },
    ],
    relationships: [],
  }) });
  assert.notDeepEqual(
    await collisionsForward.exportInvestigation([{}], request()),
    await collisionsReverse.exportInvestigation([{}], request()),
  );
});

test("MO-1202 MIP-prohibited source cognition fails safely and is never stripped", async () => {
  for (const revision of [
    { credential: "must-not-enter-a-package" },
    { screenshot: "data:image/png;base64,AAAA" },
    { runtimeState: { eventBus: "live" } },
  ]) {
    const adapter = customAdapter({ finalize: () => ({
      accepted: true,
      records: [{ identifier: "prohibited", kind: "memoryos.adapter.test.output", revision, sourceOrder: 0 }],
      relationships: [],
    }) });
    await assert.rejects(adapter.createInvestigation([{}], request()), (error) => {
      assert.ok(error instanceof MemoryInvestigationPackageError);
      assert.equal(error.diagnostics[0].code, "PROHIBITED_CONTENT");
      return true;
    });
  }
});

test("MO-1202 artifact output is a verified .mip and failures are atomic", async () => {
  const artifact = await openAIAgentsSdkAdapter.createArtifact(
    await referenceSource("openai-agents"), request("openai-agents"), "openai-investigation.mip",
  );
  assert.equal(artifact.name, "openai-investigation.mip");
  const imported = importMemoryInvestigationPackage(Uint8Array.from(artifact.bytes));
  assert.equal(imported.manifest.packageIdentifier, request("openai-agents").packageIdentifier);
});

test("MO-1202 adapter modules remain SDK-, Runtime-, renderer-, network-, clock-, and timer-independent", async () => {
  const files = [
    "../web/js/ai-runtime-adapter.js",
    "../web/js/adapters/openai-agents-sdk-adapter.js",
    "../web/js/adapters/anthropic-sdk-adapter.js",
    "../web/js/adapters/langgraph-adapter.js",
  ];
  const source = (await Promise.all(files.map((file) => readFile(new URL(file, import.meta.url), "utf8")))).join("\n");
  assert.doesNotMatch(source, /from\s+["'](?:@openai|@anthropic|@langchain|langgraph)/);
  assert.doesNotMatch(source, /\b(?:fetch|XMLHttpRequest|WebSocket|document|window)\b/);
  assert.doesNotMatch(source, /\b(?:Date\.now|new\s+Date|Math\.random|setTimeout|setInterval)\b/);
  assert.doesNotMatch(source, /\.\/app\.js|\.\/graph\.js|\.\/studio-model\.js|cca\/runtime/);
});
