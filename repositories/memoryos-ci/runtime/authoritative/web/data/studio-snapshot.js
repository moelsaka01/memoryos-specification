const workspaceIdentifier = "workspace-memoryos-release";

export const scopeDefinitions = Object.freeze([
  { route: "complete", value: "Complete", label: "Complete" },
  { route: "memory", value: "Memory", label: "Memory" },
  { route: "working", value: "WorkingMemory", label: "Working Memory" },
  { route: "long-term", value: "LongTermMemory", label: "Long-Term Memory" },
  { route: "semantic", value: "SemanticMemory", label: "Semantic Knowledge" },
  { route: "episodic", value: "EpisodicMemory", label: "Episodic Knowledge" },
  { route: "procedural", value: "ProceduralMemory", label: "Procedural Knowledge" },
  { route: "retrieval", value: "Retrieval", label: "Memory Retrieval" },
  { route: "consolidation", value: "Consolidation", label: "Memory Consolidation" },
  { route: "reflection", value: "Reflection", label: "Memory Reflection" },
  { route: "providers", value: "Providers", label: "Memory Providers" },
]);

const source = (identifier, value, archived = false) => ({
  identifier,
  value,
  archived,
});

const semanticDeterminism = () => ({
  identifier: "sem-determinism",
  meaning: "Equivalent observations produce the same public order.",
  categories: ["behavior", "determinism"],
  linkedConceptIdentifiers: ["sem-provenance"],
  sourceEntries: [source("ltm-002", "Equivalent inputs preserve deterministic order.")],
});

const releaseReviewProcedure = () => ({
  identifier: "proc-release-review",
  activity: "Perform a MemoryOS release review",
  steps: ["Observe a coherent view", "Inspect each scope", "Trace evidence", "Verify validation state"],
  linkedProcedureIdentifiers: ["proc-provider-check"],
  sourceEntries: [
    source("ltm-001", "Workspace ownership is invariant."),
    source("ltm-002", "Equivalent inputs preserve deterministic order."),
  ],
});

const releaseReflectionSources = () => [
  {
    kind: "Semantic",
    workspaceIdentifier,
    sourceIdentifier: "sem-determinism",
    rankScore: 4,
    semanticConcept: semanticDeterminism(),
    episode: null,
    procedure: null,
    chain: ["ltm-002", "sem-determinism"],
  },
  {
    kind: "Procedural",
    workspaceIdentifier,
    sourceIdentifier: "proc-release-review",
    rankScore: 87,
    semanticConcept: null,
    episode: null,
    procedure: releaseReviewProcedure(),
    chain: ["ltm-001", "ltm-002", "proc-release-review"],
  },
];

const releaseReflection = () => ({
  identifier: "reflection-release-integrity",
  workspaceIdentifier,
  knowledge: "Release integrity depends on deterministic observation and preserved evidence.",
  sources: releaseReflectionSources(),
});

export const referenceSnapshot = Object.freeze({
  contract: "CCA-STUDIO-1.0",
  source: "deterministic-reference-observation",
  workspaceIdentifier,
  observationIdentifier: "observation-0001",
  session: {
    identifier: "studio-session-011",
    state: "Observed",
  },
  result: {
    succeeded: true,
    code: "OK",
    message: "",
  },
  memory: {
    workspaceIdentifier,
    entries: [
      { identifier: "mem-001", value: "Architecture review decision" },
      { identifier: "mem-002", value: "Provider boundary observation" },
      { identifier: "mem-003", value: "Deterministic retrieval note" },
      { identifier: "mem-004", value: "Workspace ownership invariant" },
    ],
  },
  workingMemory: {
    workspaceIdentifier,
    active: true,
    activeTaskIdentifier: "task-release-review",
    entries: [
      { identifier: "wm-001", value: "Verify release evidence", expirationPoint: 48 },
      { identifier: "wm-002", value: "Inspect provider session", expirationPoint: 64 },
      { identifier: "wm-003", value: "Trace reflection provenance", expirationPoint: null },
    ],
  },
  longTermMemory: {
    workspaceIdentifier,
    entries: [
      source("ltm-001", "Workspace ownership is invariant."),
      source("ltm-002", "Equivalent inputs preserve deterministic order."),
      source("ltm-003", "Long-Term Memory is authoritative evidence."),
      source("ltm-004", "Runtime lifetime does not own durable memory."),
      source("ltm-005", "Provider transport preserves public semantics.", true),
    ],
  },
  semanticMemory: {
    workspaceIdentifier,
    concepts: [
      {
        identifier: "sem-ownership",
        meaning: "Workspace ownership remains stable across MemoryOS capabilities.",
        categories: ["architecture", "ownership"],
        linkedConceptIdentifiers: ["sem-determinism"],
        sourceEntries: [source("ltm-001", "Workspace ownership is invariant.")],
      },
      semanticDeterminism(),
      {
        identifier: "sem-provenance",
        meaning: "Derived knowledge retains explicit evidence references.",
        categories: ["evidence", "integrity"],
        linkedConceptIdentifiers: ["sem-ownership"],
        sourceEntries: [source("ltm-003", "Long-Term Memory is authoritative evidence.")],
      },
    ],
  },
  episodicMemory: {
    workspaceIdentifier,
    episodes: [
      {
        identifier: "epi-review-opened",
        occurrence: "The independent release review began.",
        context: "MemoryOS release gate",
        chronology: 100,
        linkedEpisodeIdentifiers: ["epi-evidence-verified"],
        sourceEntries: [source("ltm-001", "Workspace ownership is invariant.")],
      },
      {
        identifier: "epi-evidence-verified",
        occurrence: "Deterministic evidence ordering was verified.",
        context: "MemoryOS release gate",
        chronology: 110,
        linkedEpisodeIdentifiers: ["epi-provider-checked"],
        sourceEntries: [source("ltm-002", "Equivalent inputs preserve deterministic order.")],
      },
      {
        identifier: "epi-provider-checked",
        occurrence: "Provider-independent transport was observed.",
        context: "MemoryOS release gate",
        chronology: 120,
        linkedEpisodeIdentifiers: [],
        sourceEntries: [source("ltm-005", "Provider transport preserves public semantics.", true)],
      },
    ],
  },
  proceduralMemory: {
    workspaceIdentifier,
    procedures: [
      releaseReviewProcedure(),
      {
        identifier: "proc-provider-check",
        activity: "Verify provider-independent transport",
        steps: ["Enumerate descriptors", "Inspect session state", "Confirm Workspace identity"],
        linkedProcedureIdentifiers: [],
        sourceEntries: [source("ltm-005", "Provider transport preserves public semantics.", true)],
      },
    ],
  },
  retrievalSessions: [
    {
      identifier: "retrieval-session-001",
      workspaceIdentifier,
      state: "Started",
      candidates: [
        {
          kind: "Semantic",
          workspaceIdentifier,
          sourceIdentifier: "sem-ownership",
          rankScore: 98,
          explanationChain: ["ltm-001", "sem-ownership"],
        },
        {
          kind: "Episodic",
          workspaceIdentifier,
          sourceIdentifier: "epi-evidence-verified",
          rankScore: 91,
          explanationChain: ["ltm-002", "epi-evidence-verified"],
        },
        {
          kind: "Procedural",
          workspaceIdentifier,
          sourceIdentifier: "proc-release-review",
          rankScore: 87,
          explanationChain: ["ltm-001", "ltm-002", "proc-release-review"],
        },
      ],
    },
    {
      identifier: "retrieval-session-002",
      workspaceIdentifier,
      state: "Ready",
      candidates: [],
    },
  ],
  consolidationSessions: [
    {
      identifier: "consolidation-session-001",
      workspaceIdentifier,
      state: "Retained",
      request: {
        workspaceIdentifier,
        taskIdentifier: "task-release-review",
        entryIdentifier: "wm-001",
      },
      candidate: {
        workspaceIdentifier,
        taskIdentifier: "task-release-review",
        sourcePosition: 0,
        workingMemoryIdentifier: "wm-001",
        longTermMemoryIdentifier: "ltm-006",
        retainedPosition: 5,
      },
      workingMemory: { workspaceIdentifier },
      longTermMemory: { workspaceIdentifier },
    },
    {
      identifier: "consolidation-session-002",
      workspaceIdentifier,
      state: "Pristine",
      request: null,
      candidate: null,
    },
  ],
  reflections: [releaseReflection()],
  reflectionSessions: [
    {
      identifier: "reflection-session-001",
      workspaceIdentifier,
      state: "Derived",
      query: {
        workspaceIdentifier,
        identifier: "reflection-release-integrity",
        knowledge: "Release integrity depends on deterministic observation and preserved evidence.",
      },
      sources: releaseReflectionSources(),
      reflection: releaseReflection(),
    },
  ],
  providerSessions: [
    {
      identifier: "provider-session-001",
      workspaceIdentifier,
      state: "Exported",
      descriptors: [
        { identifier: "provider-reference-a", workspaceIdentifier },
        { identifier: "provider-reference-b", workspaceIdentifier },
      ],
    },
    {
      identifier: "provider-session-002",
      workspaceIdentifier,
      state: "Open",
      descriptors: [{ identifier: "provider-reference-c", workspaceIdentifier }],
    },
  ],
  validation: [
    { identifier: "workspace", label: "Workspace identity", state: "Passed", detail: "All observed values use workspace-memoryos-release." },
    { identifier: "aggregates", label: "Required aggregates", state: "Passed", detail: "All six aggregate observations are present." },
    { identifier: "ordering", label: "Deterministic ordering", state: "Passed", detail: "Fixed capability and released stored order are retained." },
    { identifier: "provenance", label: "Provenance chains", state: "Passed", detail: "Released retrieval and reflection chains remain aligned." },
    { identifier: "providers", label: "Provider boundary", state: "Passed", detail: "Only provider-session observations are present." },
    { identifier: "runtime", label: "Runtime independence", state: "Passed", detail: "No Runtime implementation state is observed." },
  ],
});

export function resolveSnapshot() {
  const injected = globalThis.__CCA_STUDIO_SNAPSHOT__;
  return injected && typeof injected === "object" ? injected : referenceSnapshot;
}
