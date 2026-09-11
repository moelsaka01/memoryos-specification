import { scopeDefinitions } from "../data/studio-snapshot.js";
import { canonicalObservation } from "./semantic-world.js";

export const operationCodes = Object.freeze({
  ok: { code: "OK", message: "" },
  forgotten: { code: "SESSION_FORGOTTEN", message: "studio session is forgotten" },
  notObserved: { code: "SESSION_NOT_OBSERVED", message: "studio session has no observed view" },
  mismatch: { code: "WORKSPACE_MISMATCH", message: "workspace identifiers do not match" },
  invalidView: { code: "INVALID_VIEW", message: "studio view is invalid" },
  invalidQuery: { code: "INVALID_QUERY", message: "studio query is invalid" },
  notFound: { code: "NOT_FOUND", message: "studio query matched no observation" },
});

const declaredScopes = new Set(scopeDefinitions.map(({ value }) => value));

export function cloneDetached(value) {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

export function routeForScope(scope) {
  return scopeDefinitions.find(({ value }) => value === scope)?.route ?? "complete";
}

export function scopeForRoute(route) {
  return scopeDefinitions.find((entry) => entry.route === route)?.value ?? "Complete";
}

function result(snapshot, state, payload = {}) {
  const selected = operationCodes[state];
  return {
    workspaceIdentifier: snapshot.workspaceIdentifier,
    succeeded: selected.code === "OK",
    code: selected.code,
    message: selected.message,
    observations: [],
    explanationChains: [],
    ...payload,
  };
}

function emptyPaths(snapshot, scope) {
  const paths = {
    Memory: [
      "Memory",
      ...snapshot.memory.entries.map((_, index) => `Memory.entries[${index}]`),
    ],
    WorkingMemory: [
      "WorkingMemory",
      ...snapshot.workingMemory.entries.map((_, index) => `WorkingMemory.entries[${index}]`),
    ],
    LongTermMemory: [
      "LongTermMemory",
      ...snapshot.longTermMemory.entries.map((_, index) => `LongTermMemory.entries[${index}]`),
    ],
    SemanticMemory: [
      "SemanticMemory",
      ...snapshot.semanticMemory.concepts.map((_, index) => `SemanticMemory.concepts[${index}]`),
    ],
    EpisodicMemory: [
      "EpisodicMemory",
      ...snapshot.episodicMemory.episodes.map((_, index) => `EpisodicMemory.episodes[${index}]`),
    ],
    ProceduralMemory: [
      "ProceduralMemory",
      ...snapshot.proceduralMemory.procedures.map((_, index) => `ProceduralMemory.procedures[${index}]`),
    ],
    Retrieval: snapshot.retrievalSessions.flatMap((session, outer) => [
      `Retrieval.sessions[${outer}]`,
      ...session.candidates.map((_, inner) => `Retrieval.sessions[${outer}].candidates[${inner}]`),
    ]),
    Consolidation: snapshot.consolidationSessions.map((_, index) =>
      `Consolidation.sessions[${index}]`),
    Reflection: [
      ...snapshot.reflections.flatMap((reflection, outer) => [
        `Reflection.values[${outer}]`,
        ...reflection.sources.map((_, inner) => `Reflection.values[${outer}].sources[${inner}]`),
      ]),
      ...snapshot.reflectionSessions.flatMap((session, outer) => [
        `Reflection.sessions[${outer}]`,
        ...(session.sources ?? []).map((_, inner) =>
          `Reflection.sessions[${outer}].sources[${inner}]`),
      ]),
    ],
    Providers: snapshot.providerSessions.flatMap((session, outer) => [
      `Providers.sessions[${outer}]`,
      ...session.descriptors.map((_, inner) => `Providers.sessions[${outer}].descriptors[${inner}]`),
    ]),
  };

  if (scope === "Complete") {
    return scopeDefinitions.slice(1).flatMap(({ value }) => paths[value]);
  }
  return paths[scope] ?? [];
}

function exactPaths(snapshot, scope, identifier) {
  const paths = {
    Memory: snapshot.memory.entries.flatMap((entry, index) =>
      entry.identifier === identifier ? [`Memory.entries[${index}]`] : []),
    WorkingMemory: snapshot.workingMemory.entries.flatMap((entry, index) =>
      entry.identifier === identifier ? [`WorkingMemory.entries[${index}]`] : []),
    LongTermMemory: snapshot.longTermMemory.entries.flatMap((entry, index) =>
      entry.identifier === identifier ? [`LongTermMemory.entries[${index}]`] : []),
    SemanticMemory: snapshot.semanticMemory.concepts.flatMap((concept, index) =>
      concept.identifier === identifier ? [`SemanticMemory.concepts[${index}]`] : []),
    EpisodicMemory: snapshot.episodicMemory.episodes.flatMap((episode, index) =>
      episode.identifier === identifier ? [`EpisodicMemory.episodes[${index}]`] : []),
    ProceduralMemory: snapshot.proceduralMemory.procedures.flatMap((procedure, index) =>
      procedure.identifier === identifier ? [`ProceduralMemory.procedures[${index}]`] : []),
    Retrieval: snapshot.retrievalSessions.flatMap((session, outer) =>
      session.candidates.flatMap((candidate, inner) =>
        candidate.sourceIdentifier === identifier
          ? [`Retrieval.sessions[${outer}].candidates[${inner}]`]
          : [])),
    Consolidation: snapshot.consolidationSessions.flatMap((session, index) => {
      const identifiers = [
        session.request?.entryIdentifier,
        session.candidate?.workingMemoryIdentifier,
        session.candidate?.longTermMemoryIdentifier,
      ];
      return identifiers.includes(identifier) ? [`Consolidation.sessions[${index}]`] : [];
    }),
    Reflection: [
      ...snapshot.reflections.flatMap((reflection, outer) => {
        const rows = reflection.identifier === identifier
          ? [`Reflection.values[${outer}]`]
          : [];
        reflection.sources.forEach((source, inner) => {
          if (source.sourceIdentifier === identifier) {
            rows.push(`Reflection.values[${outer}].sources[${inner}]`);
          }
        });
        return rows;
      }),
      ...snapshot.reflectionSessions.flatMap((session, outer) => {
        const rows = [session.query?.identifier, session.reflection?.identifier]
          .includes(identifier)
          ? [`Reflection.sessions[${outer}]`]
          : [];
        (session.sources ?? []).forEach((source, inner) => {
          if (source.sourceIdentifier === identifier) {
            rows.push(`Reflection.sessions[${outer}].sources[${inner}]`);
          }
        });
        return rows;
      }),
    ],
    Providers: snapshot.providerSessions.flatMap((session, outer) =>
      session.descriptors.flatMap((descriptor, inner) =>
        descriptor.identifier === identifier
          ? [`Providers.sessions[${outer}].descriptors[${inner}]`]
          : [])),
  };

  if (scope === "Complete") {
    return scopeDefinitions.slice(1).flatMap(({ value }) => paths[value]);
  }
  return paths[scope] ?? [];
}

function validateSession(snapshot, sessionState, query) {
  if (sessionState === "Forgotten") return "forgotten";
  if (sessionState !== "Observed") return "notObserved";
  if (query.workspaceIdentifier !== snapshot.workspaceIdentifier) return "mismatch";
  if (!declaredScopes.has(query.scope)) return "invalidQuery";
  return null;
}

export function inspectSnapshot(snapshot, sessionState, query) {
  const failure = validateSession(snapshot, sessionState, query);
  if (failure) return result(snapshot, failure);
  const observations = query.identifier.length === 0
    ? emptyPaths(snapshot, query.scope)
    : exactPaths(snapshot, query.scope, query.identifier);
  if (query.identifier.length > 0 && observations.length === 0) {
    return result(snapshot, "notFound");
  }
  return result(snapshot, "ok", { observations, view: cloneDetached(snapshot) });
}

const indexPattern = "(0|[1-9][0-9]*)";
const inspectionResolvers = Object.freeze([
  [new RegExp(`^Reflection\\.values\\[${indexPattern}\\]\\.sources\\[${indexPattern}\\]\\.semanticConcept$`), "Semantic concept", (view, outer, inner) => view.reflections?.[outer]?.sources?.[inner]?.semanticConcept],
  [new RegExp(`^Reflection\\.values\\[${indexPattern}\\]\\.sources\\[${indexPattern}\\]\\.semanticConcept\\.sourceEntries\\[${indexPattern}\\]$`), "Provenance snapshot", (view, outer, inner, evidence) => view.reflections?.[outer]?.sources?.[inner]?.semanticConcept?.sourceEntries?.[evidence]],
  [new RegExp(`^Reflection\\.values\\[${indexPattern}\\]\\.sources\\[${indexPattern}\\]\\.episode$`), "Episode", (view, outer, inner) => view.reflections?.[outer]?.sources?.[inner]?.episode],
  [new RegExp(`^Reflection\\.values\\[${indexPattern}\\]\\.sources\\[${indexPattern}\\]\\.episode\\.sourceEntries\\[${indexPattern}\\]$`), "Provenance snapshot", (view, outer, inner, evidence) => view.reflections?.[outer]?.sources?.[inner]?.episode?.sourceEntries?.[evidence]],
  [new RegExp(`^Reflection\\.values\\[${indexPattern}\\]\\.sources\\[${indexPattern}\\]\\.procedure$`), "Procedure", (view, outer, inner) => view.reflections?.[outer]?.sources?.[inner]?.procedure],
  [new RegExp(`^Reflection\\.values\\[${indexPattern}\\]\\.sources\\[${indexPattern}\\]\\.procedure\\.sourceEntries\\[${indexPattern}\\]$`), "Provenance snapshot", (view, outer, inner, evidence) => view.reflections?.[outer]?.sources?.[inner]?.procedure?.sourceEntries?.[evidence]],
  [new RegExp(`^Reflection\\.sessions\\[${indexPattern}\\]\\.reflection$`), "Reflection", (view, outer) => view.reflectionSessions?.[outer]?.reflection],
  [new RegExp(`^Reflection\\.sessions\\[${indexPattern}\\]\\.reflection\\.sources\\[${indexPattern}\\]$`), "Reflection source", (view, outer, inner) => view.reflectionSessions?.[outer]?.reflection?.sources?.[inner]],
  [new RegExp(`^Reflection\\.sessions\\[${indexPattern}\\]\\.reflection\\.sources\\[${indexPattern}\\]\\.semanticConcept$`), "Semantic concept", (view, outer, inner) => view.reflectionSessions?.[outer]?.reflection?.sources?.[inner]?.semanticConcept],
  [new RegExp(`^Reflection\\.sessions\\[${indexPattern}\\]\\.reflection\\.sources\\[${indexPattern}\\]\\.semanticConcept\\.sourceEntries\\[${indexPattern}\\]$`), "Provenance snapshot", (view, outer, inner, evidence) => view.reflectionSessions?.[outer]?.reflection?.sources?.[inner]?.semanticConcept?.sourceEntries?.[evidence]],
  [new RegExp(`^Reflection\\.sessions\\[${indexPattern}\\]\\.reflection\\.sources\\[${indexPattern}\\]\\.episode$`), "Episode", (view, outer, inner) => view.reflectionSessions?.[outer]?.reflection?.sources?.[inner]?.episode],
  [new RegExp(`^Reflection\\.sessions\\[${indexPattern}\\]\\.reflection\\.sources\\[${indexPattern}\\]\\.episode\\.sourceEntries\\[${indexPattern}\\]$`), "Provenance snapshot", (view, outer, inner, evidence) => view.reflectionSessions?.[outer]?.reflection?.sources?.[inner]?.episode?.sourceEntries?.[evidence]],
  [new RegExp(`^Reflection\\.sessions\\[${indexPattern}\\]\\.reflection\\.sources\\[${indexPattern}\\]\\.procedure$`), "Procedure", (view, outer, inner) => view.reflectionSessions?.[outer]?.reflection?.sources?.[inner]?.procedure],
  [new RegExp(`^Reflection\\.sessions\\[${indexPattern}\\]\\.reflection\\.sources\\[${indexPattern}\\]\\.procedure\\.sourceEntries\\[${indexPattern}\\]$`), "Provenance snapshot", (view, outer, inner, evidence) => view.reflectionSessions?.[outer]?.reflection?.sources?.[inner]?.procedure?.sourceEntries?.[evidence]],
  [/^Memory$/, "Memory", (view) => view.memory],
  [new RegExp(`^Memory\\.entries\\[${indexPattern}\\]$`), "Memory entry", (view, outer) => view.memory?.entries?.[outer]],
  [/^WorkingMemory$/, "WorkingMemory", (view) => view.workingMemory],
  [new RegExp(`^WorkingMemory\\.entries\\[${indexPattern}\\]$`), "Working Memory entry", (view, outer) => view.workingMemory?.entries?.[outer]],
  [/^LongTermMemory$/, "LongTermMemory", (view) => view.longTermMemory],
  [new RegExp(`^LongTermMemory\\.entries\\[${indexPattern}\\]$`), "Long-Term Memory entry", (view, outer) => view.longTermMemory?.entries?.[outer]],
  [/^SemanticMemory$/, "SemanticMemory", (view) => view.semanticMemory],
  [new RegExp(`^SemanticMemory\\.concepts\\[${indexPattern}\\]$`), "Semantic concept", (view, outer) => view.semanticMemory?.concepts?.[outer]],
  [new RegExp(`^SemanticMemory\\.concepts\\[${indexPattern}\\]\\.categories\\[${indexPattern}\\]$`), "Semantic category", (view, outer, inner) => view.semanticMemory?.concepts?.[outer]?.categories?.[inner]],
  [/^EpisodicMemory$/, "EpisodicMemory", (view) => view.episodicMemory],
  [new RegExp(`^EpisodicMemory\\.episodes\\[${indexPattern}\\]$`), "Episode", (view, outer) => view.episodicMemory?.episodes?.[outer]],
  [/^ProceduralMemory$/, "ProceduralMemory", (view) => view.proceduralMemory],
  [new RegExp(`^ProceduralMemory\\.procedures\\[${indexPattern}\\]$`), "Procedure", (view, outer) => view.proceduralMemory?.procedures?.[outer]],
  [new RegExp(`^ProceduralMemory\\.procedures\\[${indexPattern}\\]\\.steps\\[${indexPattern}\\]$`), "Procedure step", (view, outer, inner) => view.proceduralMemory?.procedures?.[outer]?.steps?.[inner]],
  [new RegExp(`^Retrieval\\.sessions\\[${indexPattern}\\]$`), "Retrieval session", (view, outer) => view.retrievalSessions?.[outer]],
  [new RegExp(`^Retrieval\\.sessions\\[${indexPattern}\\]\\.candidates\\[${indexPattern}\\]$`), "Retrieval candidate", (view, outer, inner) => view.retrievalSessions?.[outer]?.candidates?.[inner]],
  [new RegExp(`^Consolidation\\.sessions\\[${indexPattern}\\]$`), "Consolidation session", (view, outer) => view.consolidationSessions?.[outer]],
  [new RegExp(`^Reflection\\.values\\[${indexPattern}\\]$`), "Reflection", (view, outer) => view.reflections?.[outer]],
  [new RegExp(`^Reflection\\.values\\[${indexPattern}\\]\\.sources\\[${indexPattern}\\]$`), "Reflection source", (view, outer, inner) => view.reflections?.[outer]?.sources?.[inner]],
  [new RegExp(`^Reflection\\.sessions\\[${indexPattern}\\]$`), "Reflection session", (view, outer) => view.reflectionSessions?.[outer]],
  [new RegExp(`^Reflection\\.sessions\\[${indexPattern}\\]\\.sources\\[${indexPattern}\\]$`), "Reflection session source", (view, outer, inner) => view.reflectionSessions?.[outer]?.sources?.[inner]],
  [new RegExp(`^Providers\\.sessions\\[${indexPattern}\\]$`), "Provider session", (view, outer) => view.providerSessions?.[outer]],
  [new RegExp(`^Providers\\.sessions\\[${indexPattern}\\]\\.descriptors\\[${indexPattern}\\]$`), "Provider descriptor", (view, outer, inner) => view.providerSessions?.[outer]?.descriptors?.[inner]],
]);

export function resolveInspectionDetails(view, paths) {
  if (!view || !Array.isArray(paths)) return [];
  return paths.flatMap((path) => {
    for (const [pattern, family, resolve] of inspectionResolvers) {
      const match = pattern.exec(path);
      if (!match) continue;
      const indices = match.slice(1).map(Number);
      const value = resolve(view, ...indices);
      return value === undefined ? [] : [{ path, family, value }];
    }
    return [];
  });
}

function traceRows(snapshot) {
  return [
    ...snapshot.retrievalSessions.flatMap((session) =>
      session.candidates.map((candidate) => ({
        family: "Retrieval",
        parentIdentifiers: [],
        sourceIdentifier: candidate.sourceIdentifier,
        chain: candidate.explanationChain,
      }))),
    ...snapshot.reflections.flatMap((reflection) =>
      reflection.sources.map((source) => ({
        family: "Reflection",
        parentIdentifiers: [reflection.identifier],
        sourceIdentifier: source.sourceIdentifier,
        chain: source.chain,
      }))),
    ...snapshot.reflectionSessions.flatMap((session) =>
      (session.sources ?? []).map((source) => ({
        family: "Reflection",
        parentIdentifiers: [session.query?.identifier, session.reflection?.identifier]
          .filter((identifier) => identifier !== undefined),
        sourceIdentifier: source.sourceIdentifier,
        chain: source.chain,
      }))),
  ];
}

export function traceSnapshot(snapshot, sessionState, query) {
  const failure = validateSession(snapshot, sessionState, query);
  if (failure) return result(snapshot, failure);
  if (!["Complete", "Retrieval", "Reflection"].includes(query.scope)) {
    return result(snapshot, "invalidQuery");
  }

  const rows = traceRows(snapshot).filter((row) => {
    if (query.scope !== "Complete" && row.family !== query.scope) return false;
    if (query.identifier.length === 0) return true;
    return row.parentIdentifiers.includes(query.identifier) || row.sourceIdentifier === query.identifier;
  });
  if (query.identifier.length > 0 && rows.length === 0) return result(snapshot, "notFound");
  return result(snapshot, "ok", { explanationChains: rows.map(({ chain }) => [...chain]) });
}

function countState(items, state) {
  return items.filter((item) => item.state === state).length;
}

export function summaryLines(snapshot, scope) {
  const families = {
    Memory: [`Memory.entries=${snapshot.memory.entries.length}`],
    WorkingMemory: [
      `WorkingMemory.active=${snapshot.workingMemory.active ? "true" : "false"}`,
      `WorkingMemory.entries=${snapshot.workingMemory.entries.length}`,
    ],
    LongTermMemory: [
      `LongTermMemory.entries=${snapshot.longTermMemory.entries.length}`,
      `LongTermMemory.archived=${snapshot.longTermMemory.entries.filter(({ archived }) => archived).length}`,
    ],
    SemanticMemory: [`SemanticMemory.concepts=${snapshot.semanticMemory.concepts.length}`],
    EpisodicMemory: [`EpisodicMemory.episodes=${snapshot.episodicMemory.episodes.length}`],
    ProceduralMemory: [`ProceduralMemory.procedures=${snapshot.proceduralMemory.procedures.length}`],
    Retrieval: [
      `Retrieval.sessions=${snapshot.retrievalSessions.length}`,
      `Retrieval.sessions.Ready=${countState(snapshot.retrievalSessions, "Ready")}`,
      `Retrieval.sessions.Started=${countState(snapshot.retrievalSessions, "Started")}`,
      `Retrieval.sessions.Forgotten=${countState(snapshot.retrievalSessions, "Forgotten")}`,
      `Retrieval.candidates=${snapshot.retrievalSessions.reduce((sum, item) => sum + item.candidates.length, 0)}`,
    ],
    Consolidation: [
      `Consolidation.sessions=${snapshot.consolidationSessions.length}`,
      ...["Pristine", "Analyzed", "Promoted", "Retained", "Forgotten"].map((state) =>
        `Consolidation.sessions.${state}=${countState(snapshot.consolidationSessions, state)}`),
      `Consolidation.candidates=${snapshot.consolidationSessions.filter(({ candidate }) => candidate !== null).length}`,
    ],
    Reflection: [
      `Reflection.values=${snapshot.reflections.length}`,
      `Reflection.sessions=${snapshot.reflectionSessions.length}`,
      ...["Pristine", "Prepared", "Derived", "Forgotten"].map((state) =>
        `Reflection.sessions.${state}=${countState(snapshot.reflectionSessions, state)}`),
      `Reflection.sources=${snapshot.reflections.reduce((sum, item) => sum + item.sources.length, 0)
        + snapshot.reflectionSessions.reduce((sum, item) => sum + (item.sources ?? []).length, 0)}`,
    ],
    Providers: [
      `Providers.sessions=${snapshot.providerSessions.length}`,
      ...["Open", "Exported", "Imported", "Forgotten"].map((state) =>
        `Providers.sessions.${state}=${countState(snapshot.providerSessions, state)}`),
      `Providers.descriptors=${snapshot.providerSessions.reduce((sum, item) => sum + item.descriptors.length, 0)}`,
    ],
  };
  if (scope === "Complete") {
    return scopeDefinitions.slice(1).flatMap(({ value }) => families[value]);
  }
  return families[scope] ?? [];
}

export function summarizeSnapshot(snapshot, sessionState, query) {
  const failure = validateSession(snapshot, sessionState, query);
  if (failure) return result(snapshot, failure);
  if (query.identifier.length > 0) return result(snapshot, "invalidQuery");
  return result(snapshot, "ok", { observations: summaryLines(snapshot, query.scope) });
}

function hasCompleteViewShape(view) {
  return Array.isArray(view.memory?.entries)
    && Array.isArray(view.workingMemory?.entries)
    && Array.isArray(view.longTermMemory?.entries)
    && Array.isArray(view.semanticMemory?.concepts)
    && Array.isArray(view.episodicMemory?.episodes)
    && Array.isArray(view.proceduralMemory?.procedures)
    && Array.isArray(view.retrievalSessions)
    && view.retrievalSessions.every((session) => Array.isArray(session.candidates))
    && Array.isArray(view.consolidationSessions)
    && Array.isArray(view.reflections)
    && view.reflections.every((reflection) => Array.isArray(reflection.sources))
    && Array.isArray(view.reflectionSessions)
    && view.reflectionSessions.every((session) => Array.isArray(session.sources)
      && (session.reflection === null || session.reflection === undefined
        || Array.isArray(session.reflection.sources)))
    && Array.isArray(view.providerSessions)
    && view.providerSessions.every((session) => Array.isArray(session.descriptors));
}

function viewHasWorkspaceMismatch(view) {
  const workspace = view.workspaceIdentifier;
  const differs = (value) => value?.workspaceIdentifier !== workspace;
  const aggregates = [
    view.memory,
    view.workingMemory,
    view.longTermMemory,
    view.semanticMemory,
    view.episodicMemory,
    view.proceduralMemory,
  ];
  if (aggregates.some(differs)) return true;
  for (const session of view.retrievalSessions) {
    if (differs(session) || session.candidates.some(differs)) return true;
  }
  for (const session of view.consolidationSessions) {
    if (differs(session)
      || (session.request !== null && session.request !== undefined && differs(session.request))
      || (session.candidate !== null && session.candidate !== undefined && differs(session.candidate))
      || (session.workingMemory !== null && session.workingMemory !== undefined && differs(session.workingMemory))
      || (session.longTermMemory !== null && session.longTermMemory !== undefined && differs(session.longTermMemory))) {
      return true;
    }
  }
  for (const reflection of view.reflections) {
    if (differs(reflection) || reflection.sources.some(differs)) return true;
  }
  for (const session of view.reflectionSessions) {
    if (differs(session)
      || (session.query !== null && session.query !== undefined && differs(session.query))
      || session.sources.some(differs)
      || (session.reflection !== null && session.reflection !== undefined
        && (differs(session.reflection) || session.reflection.sources?.some(differs)))) {
      return true;
    }
  }
  for (const session of view.providerSessions) {
    if (differs(session) || session.descriptors.some(differs)) return true;
  }
  return false;
}

export function observeSnapshot(snapshot, sessionState, view) {
  if (sessionState === "Forgotten") return result(snapshot, "forgotten");
  if (!view || typeof view !== "object") return result(snapshot, "invalidView");
  if (view.workspaceIdentifier !== snapshot.workspaceIdentifier) return result(snapshot, "mismatch");
  if (!hasCompleteViewShape(view)) return result(snapshot, "invalidView");
  if (viewHasWorkspaceMismatch(view)) return result(snapshot, "mismatch");
  return result(snapshot, "ok", { view: cloneDetached(view) });
}

export function exportSnapshot(snapshot, sessionState) {
  if (sessionState === "Forgotten") return result(snapshot, "forgotten");
  if (sessionState !== "Observed") return result(snapshot, "notObserved");
  return result(snapshot, "ok", { view: cloneDetached(snapshot) });
}

export function forgetSnapshot(snapshot) {
  return result(snapshot, "ok");
}

export function findObservation(snapshot, identifier) {
  const candidates = [
    ...snapshot.memory.entries.map((value) => ({ family: "Memory", value })),
    ...snapshot.workingMemory.entries.map((value) => ({ family: "WorkingMemory", value })),
    ...snapshot.longTermMemory.entries.map((value) => ({ family: "LongTermMemory", value })),
    ...snapshot.semanticMemory.concepts.map((value) => ({ family: "SemanticMemory", value })),
    ...snapshot.episodicMemory.episodes.map((value) => ({ family: "EpisodicMemory", value })),
    ...snapshot.proceduralMemory.procedures.map((value) => ({ family: "ProceduralMemory", value })),
  ];
  return candidates.filter(({ value }) => value.identifier === identifier);
}

function encodedIdentity(value) {
  return encodeURIComponent(String(value));
}

function stableKeys(kind, values, identityOf = (value) => value.identifier) {
  const occurrences = new Map();
  return values.map((value) => {
    const identity = String(identityOf(value));
    const occurrence = occurrences.get(identity) ?? 0;
    occurrences.set(identity, occurrence + 1);
    return `${kind}:${encodedIdentity(identity)}:${occurrence}`;
  });
}

function keysByIdentifier(entries, keys) {
  const index = new Map();
  entries.forEach((entry, position) => {
    const matches = index.get(entry.identifier) ?? [];
    matches.push(keys[position]);
    index.set(entry.identifier, matches);
  });
  return index;
}

function firstKey(index, identifier) {
  return index.get(identifier)?.[0] ?? null;
}

export function buildGraph(snapshot) {
  const workspaceKey = "workspace";
  const nodes = [{
    key: workspaceKey,
    identifier: snapshot.workspaceIdentifier,
    label: "Workspace",
    kind: "workspace",
    family: "Workspace",
    size: 21,
    aggregate: true,
    revision: canonicalObservation({ workspaceIdentifier: snapshot.workspaceIdentifier }),
  }];
  const edges = [];
  const aggregateDefinitions = [
    ["memory", "Memory", "Memory aggregate", snapshot.memory],
    ["working", "Working", "WorkingMemory aggregate", snapshot.workingMemory],
    ["consolidation", "Consolidation", "Consolidation aggregate", snapshot.consolidationSessions],
    ["long-term", "Long-Term", "LongTermMemory aggregate", snapshot.longTermMemory],
    ["semantic", "Semantic", "SemanticMemory aggregate", snapshot.semanticMemory],
    ["episodic", "Episodic", "EpisodicMemory aggregate", snapshot.episodicMemory],
    ["procedural", "Procedural", "ProceduralMemory aggregate", snapshot.proceduralMemory],
    ["retrieval", "Retrieval", "Retrieval aggregate", snapshot.retrievalSessions],
    ["reflection", "Reflection", "Reflection aggregate", [snapshot.reflections, snapshot.reflectionSessions]],
    ["providers", "Providers", "Providers aggregate", snapshot.providerSessions],
    ["validation", "Validation", "Validation aggregate", snapshot.validation],
  ];
  const aggregateKeys = Object.fromEntries(aggregateDefinitions.map(([kind, label, family, value]) => {
    const key = `aggregate:${kind}`;
    nodes.push({
      key,
      identifier: `capability-${kind}`,
      label,
      kind,
      family,
      size: 14,
      aggregate: true,
      revision: canonicalObservation(value),
    });
    edges.push({ from: workspaceKey, to: key, relation: "contains" });
    return [kind, key];
  }));
  const addMember = (aggregateKind, member) => {
    nodes.push(member);
    edges.push({ from: aggregateKeys[aggregateKind], to: member.key, relation: "contains" });
    return member.key;
  };
  const addReleasedMembers = (aggregateKind, values, keys, {
    family,
    size,
    path,
  }) => values.map((value, index) => addMember(aggregateKind, {
    key: keys[index],
    identifier: value.identifier,
    label: value.identifier,
    kind: aggregateKind,
    family,
    size,
    observationPath: path(index),
    revision: canonicalObservation(value),
  }));

  const memorySemanticKeys = stableKeys("memory", snapshot.memory.entries);
  const workingSemanticKeys = stableKeys("working", snapshot.workingMemory.entries);
  const consolidationSemanticKeys = stableKeys("consolidation", snapshot.consolidationSessions);
  const longTermSemanticKeys = stableKeys("long-term", snapshot.longTermMemory.entries);
  const semanticSemanticKeys = stableKeys("semantic", snapshot.semanticMemory.concepts);
  const episodicSemanticKeys = stableKeys("episodic", snapshot.episodicMemory.episodes);
  const proceduralSemanticKeys = stableKeys("procedural", snapshot.proceduralMemory.procedures);
  const retrievalSemanticKeys = stableKeys("retrieval", snapshot.retrievalSessions);
  const reflectionSemanticKeys = stableKeys("reflection", snapshot.reflections);
  const reflectionSessionSemanticKeys = stableKeys("reflection-session", snapshot.reflectionSessions);
  const providerSessionSemanticKeys = stableKeys("providers", snapshot.providerSessions);

  const memoryKeys = addReleasedMembers("memory", snapshot.memory.entries, memorySemanticKeys, { family: "Memory", size: 5.5, path: (index) => `Memory.entries[${index}]` });
  const workingKeys = addReleasedMembers("working", snapshot.workingMemory.entries, workingSemanticKeys, { family: "WorkingMemory", size: 6, path: (index) => `WorkingMemory.entries[${index}]` });
  const consolidationKeys = addReleasedMembers("consolidation", snapshot.consolidationSessions, consolidationSemanticKeys, { family: "Consolidation session", size: 7, path: (index) => `Consolidation.sessions[${index}]` });
  const longTermKeys = addReleasedMembers("long-term", snapshot.longTermMemory.entries, longTermSemanticKeys, { family: "LongTermMemory", size: 6, path: (index) => `LongTermMemory.entries[${index}]` });
  const semanticKeys = addReleasedMembers("semantic", snapshot.semanticMemory.concepts, semanticSemanticKeys, { family: "SemanticMemory", size: 8, path: (index) => `SemanticMemory.concepts[${index}]` });
  const episodicKeys = addReleasedMembers("episodic", snapshot.episodicMemory.episodes, episodicSemanticKeys, { family: "EpisodicMemory", size: 8, path: (index) => `EpisodicMemory.episodes[${index}]` });
  const proceduralKeys = addReleasedMembers("procedural", snapshot.proceduralMemory.procedures, proceduralSemanticKeys, { family: "ProceduralMemory", size: 8, path: (index) => `ProceduralMemory.procedures[${index}]` });
  const retrievalKeys = addReleasedMembers("retrieval", snapshot.retrievalSessions, retrievalSemanticKeys, { family: "Retrieval session", size: 7, path: (index) => `Retrieval.sessions[${index}]` });
  const reflectionKeys = addReleasedMembers("reflection", snapshot.reflections, reflectionSemanticKeys, { family: "Reflection", size: 11, path: (index) => `Reflection.values[${index}]` });
  const reflectionSessionKeys = addReleasedMembers("reflection", snapshot.reflectionSessions, reflectionSessionSemanticKeys, { family: "Reflection session", size: 7, path: (index) => `Reflection.sessions[${index}]` });
  const providerSessionKeys = addReleasedMembers("providers", snapshot.providerSessions, providerSessionSemanticKeys, { family: "Provider session", size: 7, path: (index) => `Providers.sessions[${index}]` });

  if (snapshot.workingMemory.activeTaskIdentifier) {
    addMember("working", {
      key: `working-task:${encodedIdentity(snapshot.workingMemory.activeTaskIdentifier)}:0`,
      identifier: snapshot.workingMemory.activeTaskIdentifier,
      label: snapshot.workingMemory.activeTaskIdentifier,
      kind: "working",
      family: "Working task",
      size: 4,
      detail: true,
      revision: canonicalObservation({
        identifier: snapshot.workingMemory.activeTaskIdentifier,
        active: snapshot.workingMemory.active,
      }),
    });
  }
  snapshot.validation.forEach((check, index) => addMember("validation", {
    key: stableKeys("validation", snapshot.validation)[index],
    identifier: check.identifier,
    label: check.label,
    kind: "validation",
    family: "Validation check",
    size: 5,
    revision: canonicalObservation(check),
  }));

  const memoryByIdentifier = keysByIdentifier(snapshot.memory.entries, memoryKeys);
  const workingByIdentifier = keysByIdentifier(snapshot.workingMemory.entries, workingKeys);
  const longTermByIdentifier = keysByIdentifier(snapshot.longTermMemory.entries, longTermKeys);
  const semanticByIdentifier = keysByIdentifier(snapshot.semanticMemory.concepts, semanticKeys);
  const episodicByIdentifier = keysByIdentifier(snapshot.episodicMemory.episodes, episodicKeys);
  const proceduralByIdentifier = keysByIdentifier(snapshot.proceduralMemory.procedures, proceduralKeys);
  const sourceIndexes = {
    Memory: memoryByIdentifier,
    WorkingMemory: workingByIdentifier,
    LongTermMemory: longTermByIdentifier,
    Semantic: semanticByIdentifier,
    Episodic: episodicByIdentifier,
    Procedural: proceduralByIdentifier,
  };
  const sourceKey = (kind, identifier) => firstKey(sourceIndexes[kind] ?? new Map(), identifier);

  snapshot.semanticMemory.concepts.forEach((concept, conceptIndex) => {
    const categoryKeys = stableKeys(`${semanticKeys[conceptIndex]}:category`, concept.categories, (category) => category);
    concept.categories.forEach((category, categoryIndex) => {
      const key = addMember("semantic", {
        key: categoryKeys[categoryIndex],
        identifier: concept.identifier,
        label: category,
        kind: "semantic",
        family: "SemanticMemory",
        size: 3,
        detail: true,
        observationPath: `SemanticMemory.concepts[${conceptIndex}].categories[${categoryIndex}]`,
        revision: canonicalObservation(category),
      });
      edges.push({ from: semanticKeys[conceptIndex], to: key, relation: "contains" });
    });
  });
  snapshot.proceduralMemory.procedures.forEach((procedure, procedureIndex) => {
    const stepKeys = stableKeys(`${proceduralKeys[procedureIndex]}:step`, procedure.steps, (step) => step);
    procedure.steps.forEach((step, stepIndex) => {
      const key = addMember("procedural", {
        key: stepKeys[stepIndex],
        identifier: procedure.identifier,
        label: step,
        kind: "procedural",
        family: "ProceduralMemory",
        size: 3,
        detail: true,
        observationPath: `ProceduralMemory.procedures[${procedureIndex}].steps[${stepIndex}]`,
        revision: canonicalObservation(step),
      });
      edges.push({ from: proceduralKeys[procedureIndex], to: key, relation: "contains" });
    });
  });
  snapshot.retrievalSessions.forEach((session, sessionIndex) => {
    const candidateKeys = stableKeys(
      `${retrievalKeys[sessionIndex]}:candidate`,
      session.candidates,
      (candidate) => canonicalObservation(candidate),
    );
    session.candidates.forEach((candidate, candidateIndex) => {
      const key = addMember("retrieval", {
        key: candidateKeys[candidateIndex],
        identifier: candidate.sourceIdentifier,
        label: candidate.sourceIdentifier,
        kind: "retrieval",
        family: "Retrieval candidate",
        size: 4,
        detail: true,
        observationPath: `Retrieval.sessions[${sessionIndex}].candidates[${candidateIndex}]`,
        revision: canonicalObservation(candidate),
      });
      edges.push({ from: retrievalKeys[sessionIndex], to: key, relation: "contains" });
      const target = sourceKey(candidate.kind, candidate.sourceIdentifier);
      if (target) edges.push({ from: key, to: target, relation: "links" });
    });
  });
  snapshot.providerSessions.forEach((session, sessionIndex) => {
    const descriptorKeys = stableKeys(
      `${providerSessionKeys[sessionIndex]}:descriptor`,
      session.descriptors,
    );
    session.descriptors.forEach((descriptor, descriptorIndex) => {
      const key = addMember("providers", {
        key: descriptorKeys[descriptorIndex],
        identifier: descriptor.identifier,
        label: descriptor.identifier,
        kind: "providers",
        family: "Provider descriptor",
        size: 4,
        detail: true,
        observationPath: `Providers.sessions[${sessionIndex}].descriptors[${descriptorIndex}]`,
        revision: canonicalObservation(descriptor),
      });
      edges.push({ from: providerSessionKeys[sessionIndex], to: key, relation: "contains" });
    });
  });

  snapshot.semanticMemory.concepts.forEach((concept, index) => {
    concept.sourceEntries.forEach((sourceEntry) => {
      const source = firstKey(longTermByIdentifier, sourceEntry.identifier);
      if (source) edges.push({ from: source, to: semanticKeys[index], relation: "evidence" });
    });
    concept.linkedConceptIdentifiers.forEach((linked) => {
      (semanticByIdentifier.get(linked) ?? []).forEach((target) => edges.push({ from: semanticKeys[index], to: target, relation: "links" }));
    });
  });
  snapshot.episodicMemory.episodes.forEach((episode, index) => {
    episode.sourceEntries.forEach((sourceEntry) => {
      const source = firstKey(longTermByIdentifier, sourceEntry.identifier);
      if (source) edges.push({ from: source, to: episodicKeys[index], relation: "evidence" });
    });
    episode.linkedEpisodeIdentifiers.forEach((linked) => {
      (episodicByIdentifier.get(linked) ?? []).forEach((target) => edges.push({ from: episodicKeys[index], to: target, relation: "links" }));
    });
  });
  snapshot.proceduralMemory.procedures.forEach((procedure, index) => {
    procedure.sourceEntries.forEach((sourceEntry) => {
      const source = firstKey(longTermByIdentifier, sourceEntry.identifier);
      if (source) edges.push({ from: source, to: proceduralKeys[index], relation: "evidence" });
    });
    procedure.linkedProcedureIdentifiers.forEach((linked) => {
      (proceduralByIdentifier.get(linked) ?? []).forEach((target) => edges.push({ from: proceduralKeys[index], to: target, relation: "links" }));
    });
  });
  snapshot.consolidationSessions.forEach((session, index) => {
    const working = session.request
      ? firstKey(workingByIdentifier, session.request.entryIdentifier)
      : null;
    if (working) edges.push({ from: working, to: consolidationKeys[index], relation: "contributes" });
    const longTerm = session.candidate
      ? firstKey(longTermByIdentifier, session.candidate.longTermMemoryIdentifier)
      : null;
    if (longTerm) edges.push({ from: consolidationKeys[index], to: longTerm, relation: "links" });
  });

  const reflectionSourceDefinitions = Object.freeze({
    Semantic: Object.freeze({ property: "semanticConcept", kind: "semantic", family: "Semantic concept" }),
    Episodic: Object.freeze({ property: "episode", kind: "episodic", family: "Episode" }),
    Procedural: Object.freeze({ property: "procedure", kind: "procedural", family: "Procedure" }),
  });
  const addReflectionProjection = (reflection, targetKey, targetPath) => {
    const sources = Array.isArray(reflection?.sources) ? reflection.sources : [];
    const candidateKeys = stableKeys(
      `${targetKey}:source-candidate`,
      sources,
      (candidate) => `${candidate.kind}:${candidate.sourceIdentifier}`,
    );
    sources.forEach((candidate, candidateIndex) => {
      const candidatePath = `${targetPath}.sources[${candidateIndex}]`;
      const candidateKey = addMember("reflection", {
        key: candidateKeys[candidateIndex],
        identifier: candidate.sourceIdentifier,
        label: candidate.sourceIdentifier,
        kind: "retrieval",
        family: "Reflection source",
        size: 4,
        detail: true,
        observationPath: candidatePath,
        revision: canonicalObservation(candidate),
      });
      edges.push({
        from: candidateKey,
        to: targetKey,
        relation: "contributes",
        observationPath: candidatePath,
      });

      const definition = reflectionSourceDefinitions[candidate.kind];
      const source = definition ? candidate[definition.property] : null;
      if (!source || typeof source !== "object") return;

      const sourcePath = `${candidatePath}.${definition.property}`;
      const sourceNodeKey = addMember("reflection", {
        key: stableKeys(`${candidateKey}:source`, [source])[0],
        identifier: source.identifier,
        label: source.identifier,
        kind: definition.kind,
        family: definition.family,
        size: 7,
        detail: true,
        observationPath: sourcePath,
        revision: canonicalObservation(source),
      });
      edges.push({
        from: candidateKey,
        to: sourceNodeKey,
        relation: "links",
        observationPath: sourcePath,
      });

      const evidenceEntries = Array.isArray(source.sourceEntries) ? source.sourceEntries : [];
      const evidenceKeys = stableKeys(
        `${sourceNodeKey}:evidence`,
        evidenceEntries,
        (evidence) => evidence.identifier,
      );
      evidenceEntries.forEach((evidence, evidenceIndex) => {
        const evidencePath = `${sourcePath}.sourceEntries[${evidenceIndex}]`;
        const evidenceKey = addMember("reflection", {
          key: evidenceKeys[evidenceIndex],
          identifier: evidence.identifier,
          label: evidence.identifier,
          kind: "long-term",
          family: "Provenance snapshot",
          size: 5,
          detail: true,
          observationPath: evidencePath,
          revision: canonicalObservation(evidence),
        });
        edges.push({
          from: evidenceKey,
          to: sourceNodeKey,
          relation: "evidence",
          observationPath: evidencePath,
        });
      });
    });
  };

  snapshot.reflections.forEach((reflection, index) => {
    addReflectionProjection(reflection, reflectionKeys[index], `Reflection.values[${index}]`);
  });
  snapshot.reflectionSessions.forEach((session, index) => {
    if (!session.reflection || typeof session.reflection !== "object") return;
    const targetPath = `Reflection.sessions[${index}].reflection`;
    const targetKey = addMember("reflection", {
      key: stableKeys(`${reflectionSessionKeys[index]}:reflection`, [session.reflection])[0],
      identifier: session.reflection.identifier,
      label: session.reflection.identifier,
      kind: "reflection",
      family: "Reflection",
      size: 11,
      observationPath: targetPath,
      revision: canonicalObservation(session.reflection),
    });
    edges.push({
      from: reflectionSessionKeys[index],
      to: targetKey,
      relation: "contains",
      observationPath: targetPath,
    });
    addReflectionProjection(session.reflection, targetKey, targetPath);
  });

  return {
    identity: "Memory intelligence graph",
    description: "One deterministic topology of MemoryOS state, provenance, retrieval, reflection, providers, and validation.",
    nodes,
    edges,
  };
}
