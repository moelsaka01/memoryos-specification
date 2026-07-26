# CCA Standards Compiler

`cca-compiler` is the C++23 implementation of the architecture-neutral
Canonical Specification 1.0 compiler. It loads UTF-8 YAML, parses to a
format-independent tree, validates schema and semantics, analyzes references,
resolves dependencies, builds a typed model, and generates deterministic
documentation and reports.

The executable supports:

```text
cca validate specification.yaml
cca analyze specification.yaml
cca compile specification.yaml [--output directory]
cca report specification.yaml [--output directory]
```

Compiler commands emit deterministic JSON. A successful compile or report
writes the seven-file IS-002 bundle documented in
[the generator contract](../../docs/generators.md).

## Build

From the workspace root:

```sh
cmake --preset default
cmake --build --preset default
ctest --preset default
```

The repository can also be configured independently when `yaml-cpp` and,
for tests, GoogleTest are discoverable:

```sh
cmake -S repositories/cca-compiler -B build
cmake --build build
ctest --test-dir build --output-on-failure
```

Public headers are under `include/cca/compiler`. Module contracts and examples
are under [docs](docs/architecture.md). The canonical format, pipeline,
validation, CLI, and limitations are documented in the workspace
[documentation index](../../docs/README.md).

IS-002 does not implement runtime execution, MemoryOS, cognition, AI,
persistence, plugins, networking, conformance certification, packaging, or
production code generation.
