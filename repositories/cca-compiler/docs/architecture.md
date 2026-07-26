# Standards Compiler architecture

`cca-compiler` is a dependency-injected C++23 implementation of the Canonical
Specification 1.0 vertical slice. It depends on `cca-core` engineering
utilities and yaml-cpp; it does not depend on any reserved runtime repository.

## Layers

```text
CLI / CompilerCommandService
              |
       CompilerPipeline
              |
 SourceLoader -> Parser -> Validator -> Analyzer -> DependencyResolver
                                                |
                                           ModelBuilder
                                                |
                           ArtifactGenerator / Serialization
```

- `ISourceLoader` is the environmental input seam.
- `Parser` converts YAML to source-located `CanonicalValue`.
- `Validator` enforces the canonical schema profile.
- `Analyzer` builds symbols and validates identity and references.
- `DependencyResolver` validates directed edges, version constraints, and
  cycles.
- `ModelBuilder` constructs the typed `Specification`.
- `ArtifactGenerator` and serialization functions derive fixed outputs.
- `CompilerPipeline` owns ordering and failure propagation.
- `CompilerCommandService` adapts pipeline results to deterministic CLI JSON.

The executable is the composition root. Module code does not use a service
locator or mutable global registry.

## Data boundaries

`SourceDocument` owns the explicit path and UTF-8 bytes. `ParsedDocument` owns
the YAML-independent syntax tree. `AnalysisSummary` and
`DependencyResolution` contain deterministic semantic facts.
`Specification` is the typed model accepted by generators.
`PipelineResult` owns all caller-visible values for one run.

The syntax tree preserves source locations for diagnostics. The typed model
uses `Identifier`, `Version`, metadata, and separate Package, Domain,
Component, Contract, and Requirement values composed from common fields.

## Diagnostics

Every processing boundary returns a value that includes `ValidationResult`.
Errors stop dependent stages; warnings and notes do not. Diagnostics are sorted
before public serialization. Injected `IDiagnosticSink` remains available for
embedding, but the returned validation value is authoritative.

Logging is operational observation and is never required to determine command
success.

## I/O

Loading reads exactly the requested source. Generation writes exactly the
fixed IS-002 bundle beneath the requested output directory. No module accesses
the network, database, clock, randomness, runtime repository, or plugin
discovery.

## Compatibility seams

Some IM-001 path-only request overloads remain source-compatibility seams. They
do not bypass the ordered pipeline and should not be used for new
orchestration. The canonical format and structured command results are the
IS-002 integration contracts; a stable C++ ABI is not promised.

## Thread safety

Pipeline processors are stateless or own immutable configuration. Concurrent
use requires thread-safe injected loggers/sinks. Caller-owned streams used by
`Cli` require external synchronization. Runs that write to the same output
directory must be serialized.

## Source layout

- `include/cca/compiler`: documented public declarations
- `src`: implementations and executable composition root
- `tests`: unit, integration, fixture, generator, and CLI tests
- `docs/modules`: focused module contracts and examples

The workspace build is the integration path; standalone compiler builds still
use the same public target and generated version contract.
