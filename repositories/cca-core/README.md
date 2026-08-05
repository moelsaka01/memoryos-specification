# cca-core

Shared, dependency-light infrastructure, the CCA-RF-1.0 Runtime Foundation,
the CCA-REP-1.0 Representation Foundation, the CCA-PROC-1.0 Process
Foundation, the CCA-PERSIST-1.0 Persistence Foundation, and the CCA-MEM-1.0
Memory Foundation, including the CCA-WMEM-1.0 Working Memory and
CCA-LTMEM-1.0 Long-Term Memory, CCA-SEMMEM-1.0 Semantic Memory, and
CCA-EPMEM-1.0 Episodic Memory, and CCA-PRMEM-1.0 Procedural Memory
capabilities, for the CCA reference ecosystem.

This foundation currently provides:

- immutable in-memory configuration values and a builder;
- dependency-injected logging sinks;
- deterministic ASCII string helpers;
- a semantic version value backed by the root build version;
- a recording log sink for tests;
- the headless, multi-instance `cca-runtime` host;
- the complete Runtime lifecycle, Runtime Freeze, typed service composition,
  dependency injection, deterministic startup and shutdown, typed asynchronous
  events, and instance-scoped observability;
- the passive Representation document model, typed values, deterministic
  document-local identity, validation, transactions, queries, and freeze
  lifecycle; and
- deterministic Process definition materialization, isolated execution
  contexts, terminal results, and Runtime-hosted ProcessEngine service
  composition;
- provider-independent Workspace snapshot preservation and restoration; and
- Workspace-owned Memory with deterministic store, retrieve, search, and
  forget behavior; and
- temporary, task-oriented Working Memory with explicit activation and logical
  expiration; and
- Workspace-owned Long-Term Memory with deterministic retention, archival,
  irreversible forgetting, and provider-independent restoration; and
- Workspace-owned Semantic Memory with source-preserving conceptual
  derivation, evidence provenance, direct links, and deterministic forgetting.
- Workspace-owned Episodic Memory with source-preserving experiences,
  explicit logical chronology, direct links, and deterministic forgetting.
- Workspace-owned Procedural Memory with source-preserving activity knowledge,
  ordered descriptive steps, direct links, and deterministic forgetting.

The Runtime Foundation contains exactly Lifecycle Manager, Service Registry,
Dependency Injector, Event Bus, Configuration Manager, and Observability.
`Runtime`, `RuntimeBuilder`, `RuntimeContext`, `RuntimeState`, and
`RuntimeHost` are implementation surfaces around those components, not
additional components. Logging, diagnostics, metrics, and health are facets of
Observability.

It does not contain MemoryOS, reasoning, AI, networking, database, GUI,
plugin, scheduling, BPMN, or workflow-engine behavior.

## Runtime Foundation

- [Programming model](docs/runtime-programming-model.md)
- [CCA-RF-1.0 conformance evidence mapping](docs/runtime-conformance-evidence.md)
- [Minimal headless example](../../examples/runtime_foundation.cpp)

## Representation Foundation

- [Public API, developer guide, architecture, and RR-001 coverage](docs/representation-foundation.md)
- [Complete usage example](examples/representation_usage.cpp)

## Process Foundation

- [Programming model and API guide](docs/process-foundation.md)
- [CCA-PROC-1.0 conformance evidence mapping](docs/process-conformance-evidence.md)
- [Direct execution example](examples/process_usage.cpp)
- [Runtime-hosted execution example](examples/process_runtime_usage.cpp)

## Persistence Foundation

- [Programming model and API guide](docs/persistence-foundation.md)
- [Save and restore example](examples/persistence_usage.cpp)

## Memory Foundation

- [Programming model, API guide, and requirement evidence](docs/memory-foundation.md)
- [Store, retrieve, search, and forget example](examples/memory_usage.cpp)

## Working Memory

- [Programming model, API guide, and requirement evidence](docs/working-memory.md)
- [Activation, expiration, and entry operations example](examples/working_memory_usage.cpp)

## Long-Term Memory

- [Programming model, API guide, and requirement evidence](docs/long-term-memory.md)
- [Retention, archival, forgetting, and restoration example](examples/long_term_memory_usage.cpp)

## Semantic Memory

- [Programming model, API guide, and requirement evidence](docs/semantic-memory.md)
- [Classification, categorization, linking, retrieval, search, update, and forgetting example](examples/semantic_memory_usage.cpp)

## Episodic Memory

- [Programming model, API guide, and requirement evidence](docs/episodic-memory.md)
- [Recording, retrospective derivation, linking, retrieval, search, update, and forgetting example](examples/episodic_memory_usage.cpp)

## Procedural Memory

- [Programming model, API guide, and requirement evidence](docs/procedural-memory.md)
- [Single-source derivation, multi-source composition, linking, retrieval, search, update, and forgetting example](examples/procedural_memory_usage.cpp)

## Memory Retrieval

- [Programming model, API guide, and requirement evidence](docs/memory-retrieval.md)
- [Cross-category retrieval, filtering, ranking, explanation, and session-forgetting example](examples/knowledge_retrieval_usage.cpp)

## Build independently

```sh
cmake -S . -B build -DBUILD_TESTING=OFF
cmake --build build
```

Tests use GoogleTest from the workspace dependency configuration. The
public-class examples and design boundaries are documented in `docs/`.
Foundation utility examples are in `examples/core_usage.cpp`; the workspace
Runtime example is `../../examples/runtime_foundation.cpp`; the Representation
example is `examples/representation_usage.cpp`; and the Process examples are
`examples/process_usage.cpp` and `examples/process_runtime_usage.cpp`. The
Persistence and Memory examples are `examples/persistence_usage.cpp`,
`examples/memory_usage.cpp`, `examples/working_memory_usage.cpp`, and
`examples/long_term_memory_usage.cpp`, and
`examples/semantic_memory_usage.cpp`, and
`examples/episodic_memory_usage.cpp`, and
`examples/procedural_memory_usage.cpp`, and
`examples/knowledge_retrieval_usage.cpp`.
