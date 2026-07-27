# Cognitive Computing Architecture reference workspace

This workspace contains the C++23 reference engineering foundation, the first
working CCA Standards Compiler, and the IM-003 Runtime Foundation reference
implementation. IS-002 adds a versioned canonical YAML format, deterministic
validation and analysis, a typed internal model, dependency resolution,
structured diagnostics, and a fixed report bundle. IM-003 implements the
headless `cca-runtime` host and the CCA-RF-1.0 lifecycle, composition,
communication, configuration, and observability contracts.

The compiler remains architecture-neutral: it describes architecture records
and does not execute them. The Runtime Foundation is a separate Layer 3
implementation in `cca-core`; it does not implement MemoryOS, the
Representation, Process, or Persistence domain engines, a GUI, plugins,
networking, cognition, or AI.

## Start here

- [Authoritative architecture](ARCHITECTURE.md)
- [Canonical format and schema](specification/README.md)
- [Comprehensive specification example](examples/specifications/reference-architecture.yaml)
- [Compiler pipeline](docs/pipeline.md)
- [CLI reference](docs/cli.md)
- [Generated artifacts](docs/generators.md)
- [Limitations and recommended IS-003](docs/limitations.md)
- [Runtime Foundation programming model](repositories/cca-core/docs/runtime-programming-model.md)
- [Runtime Foundation conformance evidence](repositories/cca-core/docs/runtime-conformance-evidence.md)
- [Minimal headless Runtime example](examples/runtime_foundation.cpp)

## Build and test

Bootstrap the pinned dependencies, then configure, build, and test:

```sh
bash scripts/bootstrap.sh
cmake --build --preset default
ctest --preset default
```

On Windows PowerShell:

```powershell
pwsh -File scripts/bootstrap.ps1
cmake --build --preset default
ctest --preset default
```

See [developer setup](docs/developer-setup.md) and
[build instructions](docs/build-instructions.md) for prerequisites, presets,
formatting, static analysis, and the coverage gate.

## Compile a canonical specification

```console
cca validate examples/specifications/reference-architecture.yaml
cca analyze examples/specifications/reference-architecture.yaml
cca compile examples/specifications/reference-architecture.yaml --output cca-out
cca report examples/specifications/reference-architecture.yaml --output cca-out
```

Compiler commands emit deterministic JSON. `compile` and `report` create:

```text
cca-out/
|-- documentation-index.md
|-- dependency-graph.mmd
|-- specification-report.json
|-- validation-report.json
|-- object-inventory.json
|-- architecture-summary.md
`-- generated/
    `-- README.md
```

The generated README is an explicit code-generation placeholder. No
production code is generated.

## Workspace map

```text
.
|-- CMakeLists.txt
|-- CMakePresets.json
|-- ARCHITECTURE.md
|-- ROADMAP.md
|-- docs/
|-- examples/
|-- specification/
|-- scripts/
|-- tests/
|-- tools/
`-- repositories/
    |-- cca-core/
    |-- cca-compiler/
    |-- memoryos/
    |-- cca-studio/
    |-- cca-sdk/
    |-- cca-conformance/
    `-- cca-atlas/
```

`cca-core` owns the shared foundation and the IM-003 Runtime Foundation.
`cca-compiler` owns the IS-002 Standards Compiler. The other repository
directories remain reserved scope boundaries.

## Architecture authority

[ARCHITECTURE.md](ARCHITECTURE.md) is authoritative for workspace
implementation scope and dependency direction. CCA-RF-1.0 is authoritative
for Runtime Foundation behavior. The
[Canonical Specification 1.0 schema](specification/schema/canonical-specification-1.0.schema.json)
is authoritative for source-data shape. Code and supporting documentation
implement these records; they do not silently redefine them.

Unresolved decisions remain in the
[ambiguity register](docs/ambiguity-register.md). A future milestone requires
architecture approval before crossing a documented limitation.

## Project status and licensing

IS-002 stops at the Standards Compiler. IM-003 adds only the approved headless
Runtime Foundation: the six components are Lifecycle Manager, Service
Registry, Dependency Injector, Event Bus, Configuration Manager, and
Observability. `Runtime`, `RuntimeBuilder`, `RuntimeContext`, `RuntimeState`,
and `RuntimeHost` are implementation surfaces, not additional peer
components. Logging, diagnostics, metrics, and health are Observability
facets. Nothing in IM-003 is evidence that MemoryOS, a domain engine, SDK,
Studio, GUI, plugin system, conformance certification engine, or package
manager exists.

The project license has not been selected. [LICENSE](LICENSE) is a
pending-decision notice, not an open-source license grant. Licensing must be
resolved before external distribution or contribution intake.
