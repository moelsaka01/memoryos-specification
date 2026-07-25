# CCA Compiler

`cca-compiler` is the C++23 framework for the reference Cognitive Computing
Architecture compiler. This foundation release defines module boundaries,
dependency-injection seams, deterministic diagnostics, and the `cca` command
line interface. It deliberately contains no parsing, compilation, generation,
AI, reasoning, persistence, networking, or plugin behavior.

## Build

From the workspace root:

```sh
cmake --preset default
cmake --build --preset default
ctest --preset default
```

The repository can also be configured independently:

```sh
cmake -S . -B build -DBUILD_TESTING=ON
cmake --build build
ctest --test-dir build --output-on-failure
```

When included by the workspace, the repository consumes
`cca_configure_target()` and `cca_add_google_test()`. The independent build
uses an already installed GoogleTest package when one is available.

## Modules

Public headers are under `include/cca/compiler`. Per-module contracts and
examples are under `docs/modules`.

All pipeline operations return either `StatusCode::invalid_argument` for an
empty required path or `StatusCode::not_implemented` for a well-formed
request. This behavior is intentional and is covered by tests.

See [docs/architecture.md](docs/architecture.md) for dependency direction and
the boundaries reserved for later milestones.
