# cca-core

Shared, dependency-light infrastructure, the CCA-RF-1.0 Runtime Foundation,
the CCA-REP-1.0 Representation Foundation, and the CCA-PROC-1.0 Process
Foundation for the CCA reference ecosystem.

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
  composition.

The Runtime Foundation contains exactly Lifecycle Manager, Service Registry,
Dependency Injector, Event Bus, Configuration Manager, and Observability.
`Runtime`, `RuntimeBuilder`, `RuntimeContext`, `RuntimeState`, and
`RuntimeHost` are implementation surfaces around those components, not
additional components. Logging, diagnostics, metrics, and health are facets of
Observability.

It does not contain MemoryOS, memory behavior, Persistence, reasoning, AI,
networking, database, GUI, plugin, scheduling, BPMN, or workflow-engine
behavior.

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
`examples/process_usage.cpp` and `examples/process_runtime_usage.cpp`.
