# cca-core

Shared, dependency-light infrastructure for the CCA reference ecosystem.

This foundation currently provides:

- immutable in-memory configuration values and a builder;
- dependency-injected logging sinks;
- deterministic ASCII string helpers;
- a semantic version value backed by the root build version;
- a recording log sink for tests.

It does not contain CCA domain semantics, memory, reasoning, AI, networking,
database, or plugin behavior.

## Build independently

```sh
cmake -S . -B build -DBUILD_TESTING=OFF
cmake --build build
```

Tests use GoogleTest from the workspace dependency configuration. The public-class
examples and design boundaries are documented in `docs/`, and executable example
source is in `examples/core_usage.cpp`.
