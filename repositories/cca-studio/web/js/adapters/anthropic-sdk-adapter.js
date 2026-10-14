import { parseStrictJson, utf8Encode } from "../mip-canonical.js";
import {
  AIRuntimeAdapterError,
  defineAIRuntimeAdapter,
} from "../ai-runtime-adapter.js";

const OUTPUT_KIND = "memoryos.adapter.anthropic.message";
const COMPLETE_STOP_REASONS = new Set(["end_turn", "refusal", "stop_sequence", "tool_use"]);

function invalid(eventIndex, message, code = "INVALID_RUNTIME_EVENT") {
  throw new AIRuntimeAdapterError(code, eventIndex, message);
}

function object(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function exactKeys(value, allowed, eventIndex, label) {
  if (!object(value)) invalid(eventIndex, `${label} must be an object.`);
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    invalid(eventIndex, `${label} must contain detached data.`);
  }
  for (const key of Reflect.ownKeys(value)) {
    if (typeof key !== "string") invalid(eventIndex, `${label} contains symbolic data.`);
    if (!allowed.has(key)) invalid(eventIndex, `${label} contains unsupported member ${key}.`);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
      invalid(eventIndex, `${label} contains non-data member ${key}.`);
    }
  }
}

function blockIndex(event, eventIndex) {
  if (!Number.isSafeInteger(event.index) || event.index < 0) {
    invalid(eventIndex, "An Anthropic content-block event requires a non-negative block index.");
  }
  return event.index;
}

function initialize() {
  return {
    blocks: new Map(),
    completedContent: [],
    messageDeltaCount: 0,
    messageIdentifier: null,
    nextBlockIndex: 0,
    phase: "before-message",
    retainedBytes: 0,
    stopReason: null,
    stopSequence: null,
  };
}

function retainString(value, eventIndex, state, request) {
  if (value.length > request.maxSourceBytes - state.retainedBytes) {
    invalid(eventIndex, "Anthropic completed content exceeds the adapter byte policy.", "RUNTIME_EVENT_RESOURCE_LIMIT");
  }
  const bytes = utf8Encode(value).byteLength;
  if (bytes > request.maxSourceBytes - state.retainedBytes) {
    invalid(eventIndex, "Anthropic completed content exceeds the adapter byte policy.", "RUNTIME_EVENT_RESOURCE_LIMIT");
  }
  state.retainedBytes += bytes;
  return value;
}

function startBlock(event, eventIndex, state, request) {
  if (state.phase !== "content") invalid(eventIndex, "Anthropic content blocks must precede message_delta.");
  if ([...state.blocks.values()].some((value) => !value.closed)) {
    invalid(eventIndex, "Anthropic content blocks cannot overlap.");
  }
  const index = blockIndex(event, eventIndex);
  const block = event.content_block;
  exactKeys(
    block,
    new Set(["from", "id", "input", "name", "text", "to", "type"]),
    eventIndex,
    "Anthropic content block",
  );
  if (index !== state.nextBlockIndex || !object(block) || typeof block.type !== "string" || block.type.length === 0) {
    invalid(eventIndex, "Anthropic content_block_start must open the next contiguous typed block.");
  }
  if (!new Set(["text", "tool_use", "fallback"]).has(block.type)) {
    invalid(eventIndex, `Anthropic content block ${block.type} cannot be represented by MIP-001.`);
  }
  if (state.blocks.size >= request.maxSourceValues) {
    invalid(eventIndex, "Anthropic content exceeds the adapter value policy.", "RUNTIME_EVENT_RESOURCE_LIMIT");
  }
  const accumulator = { deltaCount: 0, type: block.type };
  if (block.type === "text") {
    exactKeys(block, new Set(["text", "type"]), eventIndex, "Anthropic text block");
    if (block.text !== "") invalid(eventIndex, "An Anthropic streaming text block must begin empty.");
    accumulator.textChunks = [];
  } else if (block.type === "tool_use") {
    exactKeys(block, new Set(["id", "input", "name", "type"]), eventIndex, "Anthropic tool_use block");
    if (typeof block.id !== "string" || block.id.length === 0
      || typeof block.name !== "string" || block.name.length === 0
      || !object(block.input) || Object.keys(block.input).length !== 0) {
      invalid(eventIndex, "An Anthropic tool_use block requires id, name, and initially empty input.");
    }
    exactKeys(block.input, new Set(), eventIndex, "Anthropic initial tool input");
    accumulator.id = retainString(block.id, eventIndex, state, request);
    accumulator.name = retainString(block.name, eventIndex, state, request);
    accumulator.partialJsonChunks = [];
  } else {
    exactKeys(block, new Set(["from", "to", "type"]), eventIndex, "Anthropic fallback block");
  }
  state.blocks.set(index, accumulator);
  state.nextBlockIndex += 1;
}

function appendDelta(event, eventIndex, state, request) {
  const index = blockIndex(event, eventIndex);
  const block = state.blocks.get(index);
  exactKeys(
    event.delta,
    new Set(["partial_json", "text", "type"]),
    eventIndex,
    "Anthropic content delta",
  );
  if (!block || block.closed || typeof event.delta.type !== "string") {
    invalid(eventIndex, "Anthropic content_block_delta must belong to an open block.");
  }
  if (block.type === "text" && event.delta.type === "text_delta" && typeof event.delta.text === "string") {
    exactKeys(event.delta, new Set(["text", "type"]), eventIndex, "Anthropic text delta");
    block.textChunks.push(retainString(event.delta.text, eventIndex, state, request));
  } else if (block.type === "tool_use" && event.delta.type === "input_json_delta"
    && typeof event.delta.partial_json === "string") {
    exactKeys(event.delta, new Set(["partial_json", "type"]), eventIndex, "Anthropic tool input delta");
    block.partialJsonChunks.push(retainString(event.delta.partial_json, eventIndex, state, request));
  } else {
    invalid(eventIndex, "Anthropic content delta type does not match its open block.");
  }
  block.deltaCount += 1;
}

function closeBlock(event, eventIndex, state, request) {
  const index = blockIndex(event, eventIndex);
  const block = state.blocks.get(index);
  if (!block || block.closed) invalid(eventIndex, "Anthropic content_block_stop must close an open block.");
  if (block.type !== "fallback" && block.deltaCount === 0) {
    invalid(eventIndex, "Anthropic content blocks require at least one delta; only fallback may be empty.");
  }
  block.closed = true;
  if (block.type === "text") {
    state.completedContent.push({ text: block.textChunks.join(""), type: "text" });
  } else if (block.type === "tool_use") {
    let input;
    try {
      input = parseStrictJson(block.partialJsonChunks.join(""), {
        maxDepth: 128,
        maxValues: request.maxSourceValues,
      });
    } catch (error) {
      if (error?.code === "RESOURCE_LIMIT_EXCEEDED") {
        invalid(eventIndex, "Anthropic tool input exceeds the adapter value policy.", "RUNTIME_EVENT_RESOURCE_LIMIT");
      }
      invalid(eventIndex, "Anthropic tool input deltas must form one strict JSON value.");
    }
    if (!object(input)) invalid(eventIndex, "Anthropic tool input must reconstruct an object.");
    state.completedContent.push({ id: block.id, input, name: block.name, type: "tool_use" });
  }
}

function observeEvent(event, { eventIndex, request, state }) {
  if (!object(event) || typeof event.type !== "string" || event.type.length === 0) {
    invalid(eventIndex, "An Anthropic SDK event requires a non-empty type.");
  }
  if (state.phase === "stopped") invalid(eventIndex, "Anthropic message_stop must be the final source event.");
  switch (event.type) {
    case "message_start": {
      const message = event.message;
      if (eventIndex !== 0 || state.phase !== "before-message" || !object(message)
        || typeof message.id !== "string" || message.id.length === 0
        || message.role !== "assistant" || !Array.isArray(message.content) || message.content.length !== 0) {
        invalid(eventIndex, "Anthropic message_start must begin an empty assistant message.");
      }
      state.messageIdentifier = retainString(message.id, eventIndex, state, request);
      state.phase = "content";
      break;
    }
    case "content_block_start":
      startBlock(event, eventIndex, state, request);
      break;
    case "content_block_delta":
      if (state.phase !== "content") invalid(eventIndex, "Anthropic content deltas must precede message_delta.");
      appendDelta(event, eventIndex, state, request);
      break;
    case "content_block_stop":
      if (state.phase !== "content") invalid(eventIndex, "Anthropic content blocks must close before message_delta.");
      closeBlock(event, eventIndex, state, request);
      break;
    case "message_delta": {
      if (state.phase !== "content" && state.phase !== "message-delta") {
        invalid(eventIndex, "Anthropic message_delta is out of order.");
      }
      if ([...state.blocks.values()].some((block) => !block.closed)
        || !object(event.delta) || !object(event.usage)) {
        invalid(eventIndex, "Anthropic message_delta requires all content blocks to be closed.");
      }
      exactKeys(event.delta, new Set(["stop_reason", "stop_sequence"]), eventIndex, "Anthropic message delta");
      if (event.delta.stop_reason !== undefined && event.delta.stop_reason !== null) {
        if (typeof event.delta.stop_reason !== "string") invalid(eventIndex, "Anthropic stop_reason must be a string or null.");
        if (state.stopReason !== null && state.stopReason !== event.delta.stop_reason) {
          invalid(eventIndex, "Anthropic message_delta cannot change stop_reason.");
        }
        state.stopReason = retainString(event.delta.stop_reason, eventIndex, state, request);
      }
      if (event.delta.stop_sequence !== undefined) {
        if (event.delta.stop_sequence !== null && typeof event.delta.stop_sequence !== "string") {
          invalid(eventIndex, "Anthropic stop_sequence must be a string or null.");
        }
        if (state.stopSequence !== null && event.delta.stop_sequence !== state.stopSequence) {
          invalid(eventIndex, "Anthropic message_delta cannot change stop_sequence.");
        }
        state.stopSequence = event.delta.stop_sequence === null
          ? null
          : retainString(event.delta.stop_sequence, eventIndex, state, request);
      }
      state.messageDeltaCount += 1;
      state.phase = "message-delta";
      break;
    }
    case "message_stop":
      if (state.phase !== "message-delta" || state.messageDeltaCount === 0) {
        invalid(eventIndex, "Anthropic message_stop requires one or more message_delta events.");
      }
      state.phase = "stopped";
      break;
    case "ping":
      if (state.phase === "before-message") invalid(eventIndex, "Anthropic ping cannot precede message_start.");
      break;
    case "error":
      invalid(eventIndex, "An Anthropic error event cannot publish a completed investigation.", "INCOMPLETE_RUNTIME_STREAM");
      break;
    default:
      invalid(eventIndex, `Unsupported Anthropic event type: ${event.type}.`);
  }
}

function finalize({ state }) {
  if (state.phase !== "stopped" || state.completedContent.length === 0
    || !COMPLETE_STOP_REASONS.has(state.stopReason)) {
    invalid(null, "The Anthropic stream did not produce a completed semantic message.", "INCOMPLETE_RUNTIME_STREAM");
  }
  return {
    accepted: true,
    records: [{
      identifier: state.messageIdentifier,
      kind: OUTPUT_KIND,
      revision: {
        content: state.completedContent,
        role: "assistant",
        type: "message",
      },
      sourceOrder: 0,
    }],
    relationships: [],
  };
}

export const anthropicSdkAdapter = defineAIRuntimeAdapter({
  descriptor: {
    eventKind: OUTPUT_KIND,
    identifier: "org.memoryos.adapter.anthropic",
    name: "Anthropic SDK adapter",
    sourceName: "Anthropic SDK",
    version: "1.0.0",
  },
  finalize,
  initialize,
  observeEvent,
  sourceAuthorshipAttested: true,
});
