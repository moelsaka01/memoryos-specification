# Cognitive Computing Architecture reference workspace

This workspace is the engineering foundation for the official reference
implementation of the Cognitive Computing Architecture (CCA). The current
milestone establishes shared C++23 infrastructure and a compiler framework. It
does not implement a CCA language, compilation semantics, or runtime behavior.

## Architecture authority

[ARCHITECTURE.md](ARCHITECTURE.md) is the authoritative architecture record for
this workspace. Code and supporting documentation implement that architecture;
they do not redefine it. When a requirement is unclear, record it in the
[ambiguity register](docs/ambiguity-register.md) and stop at the boundary rather
than embedding an assumption in code.

## Current milestone

In scope:

- a cross-platform workspace and repository layout;
- shared build, dependency, quality, test, and versioning foundations;
- reusable logging, configuration, utility, and testing interfaces;
- the `cca-compiler` module and CLI skeletons;
- documentation, public-interface expectations, and example placeholders.

Explicitly out of scope:

- MemoryOS;
- artificial intelligence, reasoning, or LLM integration;
- databases or persistence services;
- plugin systems;
- networking;
- production parsing, validation, analysis, generation, packaging, or
  conformance logic.

An interface in this milestone is a stable place for future behavior, not
evidence that the behavior exists.

## Workspace map

```text
.
|-- CMakeLists.txt
|-- CMakePresets.json
|-- ARCHITECTURE.md
|-- CODE_OF_CONDUCT.md
|-- CONTRIBUTING.md
|-- LICENSE
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

Only `cca-core` and `cca-compiler` are implementation targets for this
milestone. The other repository directories are reserved boundaries and must
not acquire implementation merely because they appear in the workspace.

See [repositories/README.md](repositories/README.md) for repository
responsibilities and [docs/repository-overview.md](docs/repository-overview.md)
for the workspace-level view.

## Getting started

1. Review the prerequisites and dependency setup in
   [docs/developer-setup.md](docs/developer-setup.md).
2. Use only the configure and build commands documented in
   [docs/build-instructions.md](docs/build-instructions.md).
3. Read [docs/coding-standards.md](docs/coding-standards.md) before changing
   C++.
4. Consult [docs/compiler-modules.md](docs/compiler-modules.md) before working
   on a compiler interface.
5. Check [docs/ambiguity-register.md](docs/ambiguity-register.md) before making
   a new architectural choice.

The standard first-time bootstrap is:

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

Build and test tooling is configured as an engineering foundation. This
document intentionally makes no claim that any particular build, test, static
analysis, or coverage run has passed in the reader's environment.

## Documentation

- [Architecture](ARCHITECTURE.md)
- [Reserved specification boundary](specification/README.md)
- [Documentation index](docs/README.md)
- [Developer setup](docs/developer-setup.md)
- [Build instructions](docs/build-instructions.md)
- [Coding standards](docs/coding-standards.md)
- [Compiler modules](docs/compiler-modules.md)
- [Public API contract](docs/public-api-contract.md)
- [Ambiguity register](docs/ambiguity-register.md)
- [Roadmap, risks, and recommended next milestone](ROADMAP.md)
- [Examples catalog](examples/README.md)

## Project status and licensing

This is foundation-stage work. Interfaces and repository boundaries may not be
used to infer unspecified CCA semantics.

The project license has not been selected. [LICENSE](LICENSE) is a
pending-decision notice, not an open-source license grant. Licensing must be
resolved before external distribution or contribution intake.
