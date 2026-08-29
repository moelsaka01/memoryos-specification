import {
  cloneCanonical,
  deepFreeze,
  canonicalize,
  utf8Encode,
} from "./mip-canonical.js";
import {
  createMemoryInvestigationPackage,
  createMemoryInvestigationPackageArtifact,
  exportMemoryInvestigationPackage,
} from "./memory-investigation-package.js";

export const AI_RUNTIME_ADAPTER_CONTRACT_VERSION = "1.0.0";
export const AI_RUNTIME_ADAPTER_PRODUCER = Object.freeze({
  name: "MemoryOS AI Runtime Adapters",
  version: "1.0.0",
});

const DEFAULT_MAX_EVENTS = 10_000;
const DEFAULT_MAX_PACKAGE_BYTES = 16 * 1024 * 1024;
const DEFAULT_MAX_SOURCE_BYTES = 8 * 1024 * 1024;
const MAX_SNAPSHOT_DEPTH = 128;
const MAX_SNAPSHOT_VALUES = 1_000_000;
const ADAPTERS = new WeakSet();
const ADAPTER_HOOKS = new WeakMap();

function plainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function requireNonEmptyString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError(`${label} must be a non-empty string.`);
  }
  return value;
}

function requireSafeSequence(value, label) {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${label} must be a non-negative safe integer.`);
  }
  return value;
}

function adapterError(code, eventIndex, message) {
  return new AIRuntimeAdapterError(code, eventIndex, message);
}

export class AIRuntimeAdapterError extends Error {
  constructor(code, eventIndex = null, message = "The AI runtime event stream is invalid.") {
    super(message);
    this.name = "AIRuntimeAdapterError";
    this.code = requireNonEmptyString(code, "Adapter error code");
    this.eventIndex = eventIndex;
  }
}

function snapshotValue(value, path, ancestors, budget, depth) {
  budget.count += 1;
  if (budget.count > budget.maxValues || depth > MAX_SNAPSHOT_DEPTH) {
    throw adapterError("RUNTIME_EVENT_RESOURCE_LIMIT", null, "A runtime event exceeds the adapter resource policy.");
  }
  if (typeof value === "string") {
    budget.stringUnits += value.length;
    if (budget.stringUnits > budget.maxStringUnits) {
      throw adapterError("RUNTIME_EVENT_RESOURCE_LIMIT", null, "A runtime event exceeds the adapter byte policy.");
    }
    return value;
  }
  if (value === null || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value) || Object.is(value, -0)
      || (Number.isInteger(value) && !Number.isSafeInteger(value))) {
      throw adapterError("INVALID_RUNTIME_EVENT", null, `Runtime event value ${path} is not canonical JSON.`);
    }
    return value;
  }
  if (typeof value !== "object") {
    throw adapterError("INVALID_RUNTIME_EVENT", null, `Runtime event value ${path} is not canonical JSON.`);
  }
  if (ancestors.has(value)) {
    throw adapterError("INVALID_RUNTIME_EVENT", null, `Runtime event value ${path} is cyclic.`);
  }
  ancestors.add(value);
  try {
    if (Array.isArray(value)) {
      if (value.length > budget.maxValues - budget.count) {
        throw adapterError("RUNTIME_EVENT_RESOURCE_LIMIT", null, "A runtime event exceeds the adapter resource policy.");
      }
      const keys = Reflect.ownKeys(value);
      const expected = new Set(["length"]);
      for (let index = 0; index < value.length; index += 1) expected.add(String(index));
      if (keys.length !== expected.size || keys.some((key) => typeof key !== "string" || !expected.has(key))) {
        throw adapterError("INVALID_RUNTIME_EVENT", null, `Runtime event value ${path} contains unsupported array data.`);
      }
      const output = [];
      for (let index = 0; index < value.length; index += 1) {
        const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
        if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
          throw adapterError("INVALID_RUNTIME_EVENT", null, `Runtime event value ${path}[${index}] is not detached data.`);
        }
        output.push(snapshotValue(descriptor.value, `${path}[${index}]`, ancestors, budget, depth + 1));
      }
      return output;
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      throw adapterError("INVALID_RUNTIME_EVENT", null, `Runtime event value ${path} uses unsupported structured data.`);
    }
    const keys = Reflect.ownKeys(value);
    if (keys.length > budget.maxValues - budget.count) {
      throw adapterError("RUNTIME_EVENT_RESOURCE_LIMIT", null, "A runtime event exceeds the adapter resource policy.");
    }
    if (keys.some((key) => typeof key !== "string")) {
      throw adapterError("INVALID_RUNTIME_EVENT", null, `Runtime event value ${path} uses unsupported structured data.`);
    }
    const output = Object.create(null);
    for (const name of keys) {
      if (typeof name !== "string") {
        throw adapterError("INVALID_RUNTIME_EVENT", null, `Runtime event value ${path} contains symbol data.`);
      }
      budget.stringUnits += name.length;
      if (budget.stringUnits > budget.maxStringUnits) {
        throw adapterError("RUNTIME_EVENT_RESOURCE_LIMIT", null, "A runtime event exceeds the adapter byte policy.");
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, name);
      if (!descriptor || !descriptor.enumerable || !Object.hasOwn(descriptor, "value")) {
        throw adapterError("INVALID_RUNTIME_EVENT", null, `Runtime event value ${path}.${name} is not detached data.`);
      }
      output[name] = snapshotValue(descriptor.value, `${path}.${name}`, ancestors, budget, depth + 1);
    }
    return output;
  } finally {
    ancestors.delete(value);
  }
}

function snapshotRuntimeEventWithBudget(value, budget, maxBytes) {
  try {
    const detached = snapshotValue(value, "$", new Set(), budget, 0);
    const canonical = canonicalize(detached);
    const bytes = utf8Encode(canonical).byteLength;
    if (bytes > maxBytes) {
      throw adapterError("RUNTIME_EVENT_RESOURCE_LIMIT", null, "A runtime event exceeds the adapter byte policy.");
    }
    return {
      bytes,
      snapshot: deepFreeze(cloneCanonical(detached)),
    };
  } catch (error) {
    if (error instanceof AIRuntimeAdapterError) throw error;
    throw adapterError("INVALID_RUNTIME_EVENT", null, "A runtime event cannot be represented as canonical JSON.");
  }
}

export function snapshotRuntimeEvent(value, options = {}) {
  if (!plainObject(options)) throw new TypeError("Snapshot options must be an object.");
  const allowed = new Set(["maxBytes", "maxValues"]);
  for (const key of Object.keys(options)) {
    if (!allowed.has(key)) throw new TypeError(`Unknown snapshot option: ${key}.`);
  }
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_SOURCE_BYTES;
  const maxValues = options.maxValues ?? MAX_SNAPSHOT_VALUES;
  for (const [name, value] of [["maxBytes", maxBytes], ["maxValues", maxValues]]) {
    if (!Number.isSafeInteger(value) || value < 1) {
      throw new TypeError(`${name} must be a positive safe integer.`);
    }
  }
  return snapshotRuntimeEventWithBudget(
    value,
    {
      count: 0,
      maxStringUnits: maxBytes,
      maxValues,
      stringUnits: 0,
    },
    maxBytes,
  ).snapshot;
}

function validateDescriptor(descriptor) {
  if (!plainObject(descriptor)) throw new TypeError("An adapter descriptor is required.");
  const allowed = new Set(["identifier", "name", "version", "sourceName", "eventKind"]);
  for (const key of Object.keys(descriptor)) {
    if (!allowed.has(key)) throw new TypeError(`Unknown adapter descriptor member: ${key}.`);
  }
  for (const key of allowed) requireNonEmptyString(descriptor[key], `Adapter descriptor ${key}`);
  if (!/^[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(descriptor.identifier)) {
    throw new TypeError("Adapter descriptor identifier must use lowercase dot notation.");
  }
  return deepFreeze(cloneCanonical(descriptor));
}

function validateDefinition(definition) {
  if (!plainObject(definition)) throw new TypeError("An adapter definition is required.");
  const allowed = new Set([
    "descriptor", "initialize", "observeEvent", "finalize", "sourceAuthorshipAttested",
  ]);
  for (const key of Object.keys(definition)) {
    if (!allowed.has(key)) throw new TypeError(`Unknown adapter definition member: ${key}.`);
  }
  if (definition.sourceAuthorshipAttested !== true) {
    throw new TypeError("An adapter definition must explicitly attest source authorship.");
  }
  for (const key of ["observeEvent", "finalize"]) {
    if (typeof definition[key] !== "function") throw new TypeError(`An adapter ${key} function is required.`);
  }
  for (const key of ["initialize"]) {
    if (definition[key] !== undefined && typeof definition[key] !== "function") {
      throw new TypeError(`Adapter ${key} must be a function.`);
    }
  }
}

function validateRequest(request) {
  if (!plainObject(request)) throw new TypeError("An adapter request is required.");
  const allowed = new Set([
    "packageIdentifier", "workspaceIdentifier", "observationIdentifier",
    "observationSequence", "sourceVersion", "maxEvents", "maxPackageBytes",
    "maxSourceBytes", "maxSourceValues",
  ]);
  for (const key of Object.keys(request)) {
    if (!allowed.has(key)) throw new TypeError(`Unknown adapter request member: ${key}.`);
  }
  const normalized = {
    maxEvents: request.maxEvents ?? DEFAULT_MAX_EVENTS,
    maxPackageBytes: request.maxPackageBytes ?? DEFAULT_MAX_PACKAGE_BYTES,
    maxSourceBytes: request.maxSourceBytes ?? DEFAULT_MAX_SOURCE_BYTES,
    maxSourceValues: request.maxSourceValues ?? MAX_SNAPSHOT_VALUES,
    observationIdentifier: requireNonEmptyString(request.observationIdentifier, "Observation identifier"),
    observationSequence: request.observationSequence ?? 0,
    packageIdentifier: requireNonEmptyString(request.packageIdentifier, "Package identifier"),
    sourceVersion: requireNonEmptyString(request.sourceVersion, "Source version"),
    workspaceIdentifier: requireNonEmptyString(request.workspaceIdentifier, "Workspace identifier"),
  };
  requireSafeSequence(normalized.observationSequence, "Observation sequence");
  for (const name of ["maxEvents", "maxPackageBytes", "maxSourceBytes", "maxSourceValues"]) {
    if (!Number.isSafeInteger(normalized[name]) || normalized[name] < 1) {
      throw new TypeError(`${name} must be a positive safe integer.`);
    }
  }
  return Object.freeze(normalized);
}

function eventIterator(events) {
  if (events === null || events === undefined || typeof events === "string") {
    throw new TypeError("Runtime events must be an iterable or async iterable of event objects.");
  }
  let asyncFactory;
  try {
    asyncFactory = events[Symbol.asyncIterator];
  } catch {
    throw adapterError("RUNTIME_STREAM_FAILURE", 0, "The runtime event stream could not be acquired.");
  }
  let factory = asyncFactory;
  if (factory !== undefined && factory !== null && typeof factory !== "function") {
    throw adapterError("RUNTIME_STREAM_FAILURE", 0, "The runtime event stream exposes an invalid async iterator factory.");
  }
  if (factory === undefined || factory === null) {
    try {
      factory = events[Symbol.iterator];
    } catch {
      throw adapterError("RUNTIME_STREAM_FAILURE", 0, "The runtime event stream could not be acquired.");
    }
  }
  if (typeof factory !== "function") {
    throw new TypeError("Runtime events must be an iterable or async iterable of event objects.");
  }
  let iterator;
  try {
    iterator = factory.call(events);
  } catch {
    throw adapterError("RUNTIME_STREAM_FAILURE", 0, "The runtime event stream could not be acquired.");
  }
  if (iterator === null || (typeof iterator !== "object" && typeof iterator !== "function")) {
    throw adapterError("RUNTIME_STREAM_FAILURE", 0, "The runtime event stream returned an invalid iterator.");
  }
  let next;
  try {
    next = iterator.next;
  } catch {
    throw adapterError("RUNTIME_STREAM_FAILURE", 0, "The runtime event stream returned an invalid iterator.");
  }
  if (typeof next !== "function") {
    throw adapterError("RUNTIME_STREAM_FAILURE", 0, "The runtime event stream returned an invalid iterator.");
  }
  return { iterator, next };
}

function validateProjection(value, observationIdentifier, eventKind) {
  if (!plainObject(value)) {
    throw adapterError("INCOMPLETE_RUNTIME_STREAM", null, "The adapter did not produce a completed investigation projection.");
  }
  const allowed = new Set(["accepted", "records", "relationships"]);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) throw adapterError("INVALID_RUNTIME_EVENT", null, `Unknown investigation projection member: ${key}.`);
  }
  if (value.accepted !== true || !Array.isArray(value.records)
    || !Array.isArray(value.relationships) || value.relationships.length !== 0) {
    throw adapterError("INCOMPLETE_RUNTIME_STREAM", null, "Only an accepted context-only investigation may be published.");
  }
  const occurrences = new Map();
  let previousOrder = null;
  const records = [];
  value.records.forEach((record, index) => {
    if (!plainObject(record)) {
      throw adapterError("INVALID_RUNTIME_EVENT", null, `Investigation record ${index} is invalid.`);
    }
    const recordAllowed = new Set(["identifier", "kind", "sourceOrder", "revision"]);
    for (const key of Object.keys(record)) {
      if (!recordAllowed.has(key)) throw adapterError("INVALID_RUNTIME_EVENT", null, `Unknown investigation record member: ${key}.`);
    }
    const identifier = record.identifier ?? observationIdentifier;
    if (typeof identifier !== "string" || identifier.length === 0
      || typeof record.kind !== "string" || record.kind.length === 0
      || !Number.isSafeInteger(record.sourceOrder) || record.sourceOrder < 0
      || !plainObject(record.revision)) {
      throw adapterError("INVALID_RUNTIME_EVENT", null, `Investigation record ${index} is incomplete.`);
    }
    if (record.kind !== eventKind) {
      throw adapterError("INVALID_RUNTIME_EVENT", null, `Investigation record ${index} does not match the adapter event kind.`);
    }
    if (previousOrder !== null && record.sourceOrder <= previousOrder) {
      throw adapterError("EVENT_ORDER_VIOLATION", null, "Completed cognition must use strictly increasing source order.");
    }
    previousOrder = record.sourceOrder;
    const identity = canonicalize([record.kind, identifier]);
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    records.push({
      provenance: [],
      reference: { identifier, kind: record.kind, occurrence },
      revision: record.revision,
      role: "context",
    });
  });
  if (records.length === 0) {
    throw adapterError("INCOMPLETE_RUNTIME_STREAM", null, "A completed investigation requires source-authored cognition.");
  }
  return { records, relationships: [] };
}

async function adapt(adapter, events, request) {
  if (!ADAPTERS.has(adapter)) throw new TypeError("A defined AI runtime adapter is required.");
  const normalizedRequest = validateRequest(request);
  const hooks = ADAPTER_HOOKS.get(adapter);
  let state;
  try {
    state = hooks.initialize ? await hooks.initialize(normalizedRequest, events) : Object.create(null);
  } catch (error) {
    if (error instanceof AIRuntimeAdapterError) throw error;
    throw adapterError("INVALID_RUNTIME_EVENT", null, "The adapter could not initialize an investigation.");
  }
  let eventIndex = 0;
  let iterator = null;
  let completed = false;
  try {
    const acquired = eventIterator(events);
    iterator = acquired.iterator;
    while (true) {
      let step;
      let event;
      try {
        step = await acquired.next.call(iterator);
        if (step === null || (typeof step !== "object" && typeof step !== "function")
          || typeof step.done !== "boolean") {
          throw new TypeError("Invalid iterator result.");
        }
        if (step.done) break;
        event = step.value;
      } catch {
        throw adapterError("RUNTIME_STREAM_FAILURE", eventIndex, "The runtime event stream failed before a complete investigation was captured.");
      }
      if (eventIndex >= normalizedRequest.maxEvents) {
        throw adapterError("RUNTIME_EVENT_RESOURCE_LIMIT", eventIndex, "The runtime event count exceeds maxEvents.");
      }
      try {
        await hooks.observeEvent(event, Object.freeze({
          eventIndex,
          request: normalizedRequest,
          state,
        }));
      } catch (error) {
        if (error instanceof AIRuntimeAdapterError) {
          if (error.eventIndex === null) {
            throw adapterError(error.code, eventIndex, error.message);
          }
          throw error;
        }
        throw adapterError("INVALID_RUNTIME_EVENT", eventIndex, "The runtime event does not satisfy the adapter contract.");
      }
      eventIndex += 1;
    }
    completed = true;
  } catch (error) {
    if (error instanceof AIRuntimeAdapterError) throw error;
    throw adapterError("RUNTIME_STREAM_FAILURE", eventIndex, "The runtime event stream failed before a complete investigation was captured.");
  } finally {
    if (!completed && iterator !== null) {
      try {
        const close = iterator.return;
        if (typeof close === "function") await close.call(iterator);
      } catch {
        // The first source failure is authoritative. Cleanup failure cannot
        // publish a package or replace the stable adapter diagnostic.
      }
    }
  }
  if (eventIndex === 0) {
    throw adapterError("EMPTY_RUNTIME_STREAM", null, "A runtime investigation requires at least one source event.");
  }
  let projection;
  try {
    projection = await hooks.finalize(Object.freeze({
      eventCount: eventIndex,
      request: normalizedRequest,
      source: events,
      state,
    }));
  } catch (error) {
    if (error instanceof AIRuntimeAdapterError) throw error;
    throw adapterError("INCOMPLETE_RUNTIME_STREAM", null, "The runtime event stream ended before its documented lifecycle completed.");
  }
  const captured = snapshotRuntimeEventWithBudget(
    projection,
    {
      count: 0,
      maxStringUnits: normalizedRequest.maxSourceBytes,
      maxValues: normalizedRequest.maxSourceValues,
      stringUnits: 0,
    },
    normalizedRequest.maxSourceBytes,
  ).snapshot;
  const observation = validateProjection(
    captured,
    normalizedRequest.observationIdentifier,
    adapter.descriptor.eventKind,
  );
  const packageValue = createMemoryInvestigationPackage({
    comparativeReconstructions: [],
    evolutions: [],
    extensions: {},
    metadata: {
      producer: AI_RUNTIME_ADAPTER_PRODUCER,
      source: {
        name: adapter.descriptor.sourceName,
        version: normalizedRequest.sourceVersion,
      },
    },
    observations: [{
      identifier: normalizedRequest.observationIdentifier,
      records: observation.records,
      relationships: observation.relationships,
      sequence: normalizedRequest.observationSequence,
      workspaceIdentifier: normalizedRequest.workspaceIdentifier,
    }],
    packageIdentifier: normalizedRequest.packageIdentifier,
    replays: [],
    sourceAccepted: true,
    sourceAuthorshipAttested: true,
    traces: [],
    workspaceIdentifier: normalizedRequest.workspaceIdentifier,
  });
  if (utf8Encode(canonicalize(packageValue)).byteLength > normalizedRequest.maxPackageBytes) {
    throw adapterError("RUNTIME_EVENT_RESOURCE_LIMIT", null, "The investigation exceeds the adapter package byte policy.");
  }
  return packageValue;
}

export function defineAIRuntimeAdapter(definition) {
  validateDefinition(definition);
  const descriptor = validateDescriptor(definition.descriptor);
  const adapter = {
    contractVersion: AI_RUNTIME_ADAPTER_CONTRACT_VERSION,
    descriptor,
    sourceAuthorshipAttested: true,
    createInvestigation(events, request) {
      return adapt(adapter, events, request);
    },
    async exportInvestigation(events, request) {
      return exportMemoryInvestigationPackage(await adapt(adapter, events, request));
    },
    async createArtifact(events, request, fileName = null) {
      return createMemoryInvestigationPackageArtifact(await adapt(adapter, events, request), fileName);
    },
  };
  Object.freeze(adapter);
  ADAPTERS.add(adapter);
  ADAPTER_HOOKS.set(adapter, Object.freeze({
    finalize: definition.finalize,
    initialize: definition.initialize,
    observeEvent: definition.observeEvent,
  }));
  return adapter;
}

export function isAIRuntimeAdapter(value) {
  return ADAPTERS.has(value);
}
