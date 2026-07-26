# Cognitive Computing Architecture reference workspace

This workspace contains the C++23 reference engineering foundation and the
first working CCA Standards Compiler. IS-002 adds a versioned canonical YAML
format, deterministic validation and analysis, a typed internal model,
dependency resolution, structured diagnostics, and a fixed report bundle.

The compiler is architecture-neutral. It describes architecture records; it
does not implement MemoryOS, cognition, AI, persistence, plugins, networking,
or any other runtime.

## Start here

- [Authoritative architecture](ARCHITECTURE.md)
- [Canonical format and schema](specification/README.md)
- [Comprehensive specification example](examples/specifications/reference-architecture.yaml)
- [Compiler pipeline](docs/pipeline.md)
- [CLI reference](docs/cli.md)
- [Generated artifacts](docs/generators.md)
- [Limitations and recommended IS-003](docs/limitations.md)

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

`cca-core` and `cca-compiler` are the only implementation repositories in
IS-002. The other repository directories remain reserved scope boundaries.

## Architecture authority

[ARCHITECTURE.md](ARCHITECTURE.md) is authoritative for implementation scope
and dependency direction. The
[Canonical Specification 1.0 schema](specification/schema/canonical-specification-1.0.schema.json)
is authoritative for source-data shape. Code and supporting documentation
implement these records; they do not silently redefine them.

Unresolved decisions remain in the
[ambiguity register](docs/ambiguity-register.md). A future milestone requires
architecture approval before crossing a documented limitation.

## Project status and licensing

IS-002 stops at the Standards Compiler. Interfaces outside that boundary must
not be read as evidence that a runtime, SDK, Studio, conformance engine, or
package manager exists.

The project license has not been selected. [LICENSE](LICENSE) is a
pending-decision notice, not an open-source license grant. Licensing must be
resolved before external distribution or contribution intake.
