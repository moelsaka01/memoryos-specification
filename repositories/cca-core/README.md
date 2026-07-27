# cca-core

Shared, dependency-light infrastructure and the CCA-RF-1.0 Runtime Foundation
for the CCA reference ecosystem.

This foundation currently provides:

- immutable in-memory configuration values and a builder;
- dependency-injected logging sinks;
- deterministic ASCII string helpers;
- a semantic version value backed by the root build version;
- a recording log sink for tests;
- the headless, multi-instance `cca-runtime` host;
- the complete Runtime lifecycle, Runtime Freeze, typed service composition,
  dependency injection, deterministic startup and shutdown, typed asynchronous
  events, and instance-scoped observability.

The Runtime Foundation contains exactly Lifecycle Manager, Service Registry,
Dependency Injector, Event Bus, Configuration Manager, and Observability.
`Runtime`, `RuntimeBuilder`, `RuntimeContext`, `RuntimeState`, and
`RuntimeHost` are implementation surfaces around those components, not
additional components. Logging, diagnostics, metrics, and health are facets of
Observability.

It does not contain CCA Domain Engine semantics, MemoryOS, memory behavior,
Representation, Process, Persistence, reasoning, AI, networking, database,
GUI, or plugin behavior.

## Runtime Foundation

- [Programming model](docs/runtime-programming-model.md)
- [CCA-RF-1.0 conformance evidence mapping](docs/runtime-conformance-evidence.md)
- [Minimal headless example](../../examples/runtime_foundation.cpp)

## Build independently

```sh
cmake -S . -B build -DBUILD_TESTING=OFF
cmake --build build
```

Tests use GoogleTest from the workspace dependency configuration. The
public-class examples and design boundaries are documented in `docs/`.
Foundation utility examples are in `examples/core_usage.cpp`; the workspace
Runtime example is `../../examples/runtime_foundation.cpp`.
