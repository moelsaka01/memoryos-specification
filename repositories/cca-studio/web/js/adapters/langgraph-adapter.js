import {
  AIRuntimeAdapterError,
  defineAIRuntimeAdapter,
  snapshotRuntimeEvent,
} from "../ai-runtime-adapter.js";

const OUTPUT_KIND = "memoryos.adapter.langgraph.output";
const MESSAGE_EVENTS = new Set([
  "message-start", "content-block-start", "content-block-delta",
  "content-block-finish", "message-finish", "message-error",
]);
const TOOL_EVENTS = new Set([
  "tool-started", "tool-output-delta", "tool-finished", "tool-error",
]);
const LIFECYCLE_EVENTS = new Set(["started", "running", "completed", "failed", "interrupted"]);
const PASSIVE_METHODS = new Set(["checkpoints", "custom", "debug", "input", "tasks", "updates", "values"]);

function invalid(eventIndex, message, code = "INVALID_RUNTIME_EVENT") {
  throw new AIRuntimeAdapterError(code, eventIndex, message);
}

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function initialize() {
  return { lastSequence: null, rootLifecycle: null };
}

function validateEnvelope(event, eventIndex, state) {
  if (!object(event) || !Number.isSafeInteger(event.seq) || event.seq < 0
    || typeof event.method !== "string" || event.method.length === 0 || !object(event.params)
    || !Array.isArray(event.params.namespace)
    || event.params.namespace.some((part) => typeof part !== "string")
    || !Number.isFinite(event.params.timestamp) || !Object.hasOwn(event.params, "data")) {
    invalid(eventIndex, "A LangGraph v3 event requires seq, method, namespace, timestamp, and data.");
  }
  if (state.lastSequence !== null && event.seq <= state.lastSequence) {
    invalid(eventIndex, "LangGraph seq must be strictly increasing.", "EVENT_ORDER_VIOLATION");
  }
  state.lastSequence = event.seq;
}

function observeLifecycle(event, eventIndex, state) {
  if (!object(event.params.data)) invalid(eventIndex, "LangGraph lifecycle data must be an object.");
  const lifecycle = event.params.data.event;
  if (!LIFECYCLE_EVENTS.has(lifecycle)) invalid(eventIndex, "LangGraph lifecycle event is not a v3 lifecycle value.");
  if (event.params.namespace.length !== 0) return;
  if (state.rootLifecycle === "completed" || state.rootLifecycle === "failed" || state.rootLifecycle === "interrupted") {
    invalid(eventIndex, "LangGraph root terminal lifecycle must be final.");
  }
  if (lifecycle === "started") {
    if (state.rootLifecycle !== null) invalid(eventIndex, "LangGraph root may start exactly once.");
  } else if (state.rootLifecycle === null) {
    invalid(eventIndex, "LangGraph root lifecycle must begin with started.");
  }
  state.rootLifecycle = lifecycle;
}

function observeEvent(event, { eventIndex, state }) {
  validateEnvelope(event, eventIndex, state);
  if (state.rootLifecycle === "completed" || state.rootLifecycle === "failed" || state.rootLifecycle === "interrupted") {
    invalid(eventIndex, "LangGraph root terminal lifecycle must be the final source event.");
  }
  if (event.method === "lifecycle") {
    observeLifecycle(event, eventIndex, state);
    return;
  }
  if (event.method === "messages") {
    if (!object(event.params.data)) invalid(eventIndex, "LangGraph messages data must be an object.");
    if (!MESSAGE_EVENTS.has(event.params.data.event)) {
      invalid(eventIndex, "LangGraph messages event is not a v3 messages value.");
    }
    return;
  }
  if (event.method === "tools") {
    if (!object(event.params.data)) invalid(eventIndex, "LangGraph tools data must be an object.");
    if (!TOOL_EVENTS.has(event.params.data.event)) {
      invalid(eventIndex, "LangGraph tools event is not a v3 tools value.");
    }
    return;
  }
  if (PASSIVE_METHODS.has(event.method) || event.method.startsWith("custom:")) return;
  invalid(eventIndex, `Unsupported LangGraph v3 method: ${event.method}.`);
}

async function finalize({ request, source, state }) {
  if (state.rootLifecycle !== "completed") {
    invalid(null, "Only a completed LangGraph root run may publish MIP.", "INCOMPLETE_RUNTIME_STREAM");
  }
  let outputPromise;
  try {
    outputPromise = source?.output;
  } catch {
    invalid(null, "LangGraph output projection could not be read.", "INCOMPLETE_RUNTIME_STREAM");
  }
  if (outputPromise === null || (typeof outputPromise !== "object" && typeof outputPromise !== "function")
    || typeof outputPromise.then !== "function") {
    invalid(null, "LangGraph adaptation requires the v3 run output promise.", "INCOMPLETE_RUNTIME_STREAM");
  }
  let output;
  try {
    output = await outputPromise;
  } catch {
    invalid(null, "The LangGraph output projection failed.", "INCOMPLETE_RUNTIME_STREAM");
  }
  let projection;
  if (!object(output) || !Object.hasOwn(output, "memoryosInvestigation")) {
    invalid(null, "LangGraph output must explicitly designate a memoryosInvestigation projection.", "INCOMPLETE_RUNTIME_STREAM");
  }
  try {
    projection = snapshotRuntimeEvent(output.memoryosInvestigation, {
      maxBytes: request.maxSourceBytes,
      maxValues: request.maxSourceValues,
    });
  } catch (error) {
    if (error instanceof AIRuntimeAdapterError) throw error;
    invalid(null, "LangGraph output projection could not be read.", "INCOMPLETE_RUNTIME_STREAM");
  }
  if (!object(projection) || !Array.isArray(projection.records)
    || !Array.isArray(projection.relationships)) {
    invalid(null, "LangGraph output must explicitly designate memoryosInvestigation records and relationships.", "INCOMPLETE_RUNTIME_STREAM");
  }
  const projectionKeys = Object.keys(projection);
  if (projectionKeys.length !== 2
    || !projectionKeys.includes("records") || !projectionKeys.includes("relationships")) {
    invalid(null, "LangGraph memoryosInvestigation must not contain unrepresented members.");
  }
  return {
    accepted: true,
    records: projection.records,
    relationships: projection.relationships,
  };
}

export const langGraphAdapter = defineAIRuntimeAdapter({
  descriptor: {
    eventKind: OUTPUT_KIND,
    identifier: "org.memoryos.adapter.langgraph",
    name: "LangGraph adapter",
    sourceName: "LangGraph",
    version: "1.0.0",
  },
  finalize,
  initialize,
  observeEvent,
  sourceAuthorshipAttested: true,
});
