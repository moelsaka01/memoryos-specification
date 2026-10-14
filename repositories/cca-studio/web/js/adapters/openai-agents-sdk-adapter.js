import {
  AIRuntimeAdapterError,
  defineAIRuntimeAdapter,
  snapshotRuntimeEvent,
} from "../ai-runtime-adapter.js";
import { parseStrictJson } from "../mip-canonical.js";

const OUTPUT_KIND = "memoryos.adapter.openai.output";

function invalid(eventIndex, message, code = "INVALID_RUNTIME_EVENT") {
  throw new AIRuntimeAdapterError(code, eventIndex, message);
}

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, allowed, eventIndex, label) {
  if (!object(value)) invalid(eventIndex, `${label} must be an object.`);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) invalid(eventIndex, `${label} contains unsupported member ${key}.`);
  }
}

function optionalIdentifier(value) {
  for (const key of ["id", "callId"]) {
    if (!Object.hasOwn(value, key)) continue;
    if (typeof value[key] !== "string" || value[key].length === 0) {
      invalid(null, `OpenAI output ${key} must be a non-empty string when present.`);
    }
    return value[key];
  }
  return null;
}

function projectCaller(caller) {
  if (caller === undefined) return undefined;
  if (!object(caller) || (caller.type !== "direct" && caller.type !== "program")) {
    invalid(null, "An OpenAI function caller must be direct or program.");
  }
  if (caller.type === "direct") {
    exactKeys(caller, new Set(["type"]), null, "OpenAI direct caller");
    return { type: "direct" };
  }
  exactKeys(caller, new Set(["callerId", "type"]), null, "OpenAI program caller");
  if (typeof caller.callerId !== "string" || caller.callerId.length === 0) {
    invalid(null, "An OpenAI program caller requires callerId.");
  }
  return { callerId: caller.callerId, type: "program" };
}

function projectFunctionOutput(output) {
  if (typeof output === "string") return output;
  exactKeys(output, new Set(["text", "type"]), null, "OpenAI function result text");
  if (output.type !== "text" || typeof output.text !== "string") {
    invalid(null, "An OpenAI function result must be string or plain text output.");
  }
  return { text: output.text, type: "text" };
}

function projectArguments(value, maxValues) {
  try {
    parseStrictJson(value, { maxDepth: 128, maxValues });
    return value;
  } catch (error) {
    if (error?.code === "RESOURCE_LIMIT_EXCEEDED") {
      invalid(null, "OpenAI function arguments exceed the adapter value policy.", "RUNTIME_EVENT_RESOURCE_LIMIT");
    }
    invalid(null, "OpenAI function arguments must contain strict JSON.");
  }
}

function projectContent(content, index) {
  if (!Array.isArray(content)) invalid(null, `OpenAI output item ${index} requires content.`);
  return content.map((part, partIndex) => {
    if (!object(part) || typeof part.type !== "string") {
      invalid(null, `OpenAI output item ${index} content ${partIndex} is invalid.`);
    }
    if (part.type === "output_text") {
      exactKeys(part, new Set(["type", "text"]), null, "OpenAI output text");
      if (typeof part.text !== "string") invalid(null, "OpenAI output text must be a string.");
      return { text: part.text, type: part.type };
    }
    if (part.type === "refusal") {
      exactKeys(part, new Set(["type", "refusal"]), null, "OpenAI refusal");
      if (typeof part.refusal !== "string") invalid(null, "OpenAI refusal must be a string.");
      return { refusal: part.refusal, type: part.type };
    }
    invalid(null, `OpenAI content type ${part.type} cannot be represented by MIP-001.`);
  });
}

function projectOutputItem(item, index, maxValues) {
  if (!object(item)) invalid(null, `OpenAI output item ${index} must be detached model data.`);
  const type = item.type ?? (item.role === "assistant" ? "message" : null);
  if (type === "message") {
    exactKeys(item, new Set(["content", "id", "phase", "role", "status", "type"]), null, "OpenAI message");
    if (item.role !== "assistant" || item.status !== "completed") {
      invalid(null, "Only completed OpenAI assistant messages may enter an investigation.", "INCOMPLETE_RUNTIME_STREAM");
    }
    const revision = {
      content: projectContent(item.content, index),
      role: item.role,
      status: item.status,
      type: "message",
    };
    if (item.phase !== undefined) {
      if (item.phase !== "commentary" && item.phase !== "final_answer") invalid(null, "OpenAI message phase is invalid.");
      revision.phase = item.phase;
    }
    return { identifier: optionalIdentifier(item), revision };
  }
  if (type === "function_call") {
    exactKeys(item, new Set(["arguments", "callId", "caller", "id", "name", "namespace", "status", "type"]), null, "OpenAI function call");
    if (typeof item.name !== "string" || item.name.length === 0
      || typeof item.arguments !== "string" || typeof item.callId !== "string" || item.callId.length === 0) {
      invalid(null, "An OpenAI function call requires name, callId, and exact arguments.");
    }
    if (item.status !== undefined && item.status !== "completed") {
      invalid(null, "Only completed OpenAI function calls may enter an investigation.", "INCOMPLETE_RUNTIME_STREAM");
    }
    if (item.namespace !== undefined && (typeof item.namespace !== "string" || item.namespace.length === 0)) {
      invalid(null, "An OpenAI function namespace must be a non-empty string.");
    }
    const revision = { arguments: projectArguments(item.arguments, maxValues), callId: item.callId, name: item.name, type };
    const caller = projectCaller(item.caller);
    if (caller !== undefined) revision.caller = caller;
    if (item.namespace !== undefined) revision.namespace = item.namespace;
    if (item.status !== undefined) revision.status = item.status;
    return { identifier: optionalIdentifier(item), revision };
  }
  if (type === "function_call_result") {
    exactKeys(item, new Set(["callId", "caller", "id", "name", "namespace", "output", "status", "type"]), null, "OpenAI function result");
    if (typeof item.callId !== "string" || item.callId.length === 0
      || typeof item.name !== "string" || item.name.length === 0
      || item.status !== "completed") {
      invalid(null, "A completed OpenAI function result requires callId, name, and completed status.", "INCOMPLETE_RUNTIME_STREAM");
    }
    if (item.namespace !== undefined && (typeof item.namespace !== "string" || item.namespace.length === 0)) {
      invalid(null, "An OpenAI function namespace must be a non-empty string.");
    }
    const revision = {
      callId: item.callId,
      name: item.name,
      output: projectFunctionOutput(item.output),
      status: item.status,
      type,
    };
    const caller = projectCaller(item.caller);
    if (caller !== undefined) revision.caller = caller;
    if (item.namespace !== undefined) revision.namespace = item.namespace;
    return { identifier: optionalIdentifier(item), revision };
  }
  invalid(null, `OpenAI output type ${String(type)} cannot be represented by MIP-001.`);
}

function initialize() {
  return {
    lastResponseSequence: null,
    responseFailure: false,
    responseTerminal: null,
    sawResponse: false,
  };
}

function rawResponseEvent(event) {
  if (!object(event.data)) return null;
  return object(event.data.event) ? event.data.event : event.data;
}

function observeEvent(event, { eventIndex, state }) {
  if (!object(event) || typeof event.type !== "string" || event.type.length === 0) {
    invalid(eventIndex, "An OpenAI Agents SDK stream event requires a non-empty type.");
  }
  if (event.type === "raw_model_stream_event") {
    const raw = rawResponseEvent(event);
    if (!object(raw) || typeof raw.type !== "string" || raw.type.length === 0) {
      invalid(eventIndex, "An OpenAI raw model stream event requires a typed Responses event.");
    }
    if (!Number.isSafeInteger(raw.sequence_number) || raw.sequence_number < 0) {
      invalid(eventIndex, "OpenAI Responses events require a non-negative sequence_number.");
    }
    if (state.responseTerminal !== null) {
      if (state.responseTerminal !== "response.completed"
        || raw.sequence_number !== 0 || raw.type !== "response.created") {
        invalid(eventIndex, "OpenAI Responses sequence_number may restart only with response.created after a completed response.", "EVENT_ORDER_VIOLATION");
      }
      state.lastResponseSequence = null;
      state.responseTerminal = null;
    }
    if (state.lastResponseSequence === null
      && (raw.sequence_number !== 0 || raw.type !== "response.created")) {
      invalid(eventIndex, "An OpenAI Responses lifecycle must begin with response.created at sequence_number zero.", "EVENT_ORDER_VIOLATION");
    }
    if (state.lastResponseSequence !== null && raw.sequence_number <= state.lastResponseSequence) {
      invalid(eventIndex, "OpenAI Responses sequence_number must be strictly increasing.", "EVENT_ORDER_VIOLATION");
    }
    state.lastResponseSequence = raw.sequence_number;
    state.sawResponse = true;
    if (["response.completed", "response.failed", "response.incomplete"].includes(raw.type)) {
      state.responseTerminal = raw.type;
      if (raw.type !== "response.completed") state.responseFailure = true;
    }
    return;
  }
  if (event.type === "run_item_stream_event") {
    if (typeof event.name !== "string" || event.name.length === 0 || !object(event.item)) {
      invalid(eventIndex, "An OpenAI run item event requires name and item.");
    }
    return;
  }
  if (event.type === "agent_updated_stream_event") {
    if (!object(event.agent)) invalid(eventIndex, "An OpenAI agent update requires an Agent value.");
    return;
  }
  invalid(eventIndex, `Unsupported OpenAI Agents SDK event family: ${event.type}.`);
}

async function finalize({ request, source, state }) {
  let completed;
  try {
    completed = source?.completed;
  } catch {
    invalid(null, "OpenAI completion state could not be read.", "INCOMPLETE_RUNTIME_STREAM");
  }
  if (completed === null || (typeof completed !== "object" && typeof completed !== "function")
    || typeof completed.then !== "function") {
    invalid(null, "OpenAI adaptation requires a StreamedRunResult with a completed promise.", "INCOMPLETE_RUNTIME_STREAM");
  }
  try {
    await completed;
  } catch {
    invalid(null, "The OpenAI run did not complete successfully.", "INCOMPLETE_RUNTIME_STREAM");
  }
  if (source.error || source.cancelled === true
    || (Array.isArray(source.interruptions) && source.interruptions.length !== 0)
    || state.responseFailure) {
    invalid(null, "Failed, cancelled, incomplete, or interrupted OpenAI runs cannot publish MIP.", "INCOMPLETE_RUNTIME_STREAM");
  }
  if (state.sawResponse && state.responseTerminal !== "response.completed") {
    invalid(null, "The final OpenAI Responses lifecycle did not complete.", "INCOMPLETE_RUNTIME_STREAM");
  }
  let output;
  try {
    output = snapshotRuntimeEvent(source.output, {
      maxBytes: request.maxSourceBytes,
      maxValues: request.maxSourceValues,
    });
  } catch (error) {
    if (error instanceof AIRuntimeAdapterError) throw error;
    invalid(null, "OpenAI settled output could not be read.", "INCOMPLETE_RUNTIME_STREAM");
  }
  if (!Array.isArray(output) || output.length === 0) {
    invalid(null, "A completed OpenAI run requires model-shaped output.", "INCOMPLETE_RUNTIME_STREAM");
  }
  return {
    accepted: true,
    records: output.map((item, index) => {
      const projected = projectOutputItem(item, index, request.maxSourceValues);
      return {
        identifier: projected.identifier ?? request.observationIdentifier,
        kind: OUTPUT_KIND,
        revision: projected.revision,
        sourceOrder: index,
      };
    }),
    relationships: [],
  };
}

export const openAIAgentsSdkAdapter = defineAIRuntimeAdapter({
  descriptor: {
    eventKind: OUTPUT_KIND,
    identifier: "org.memoryos.adapter.openai-agents",
    name: "OpenAI Agents SDK adapter",
    sourceName: "OpenAI Agents SDK",
    version: "1.0.0",
  },
  finalize,
  initialize,
  observeEvent,
  sourceAuthorshipAttested: true,
});
