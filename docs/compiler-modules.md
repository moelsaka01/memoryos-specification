# Compiler module map

All public compiler interfaces are in namespace `cca::compiler` and included
from `cca/compiler/...`.

## Pipeline modules

| Module | Public header | Responsibility |
|---|---|---|
| Source Loader | `source_loader.hpp` | Read one explicit source through an injectable interface |
| Canonical Value | `canonical_value.hpp` | Own a source-located YAML-independent recursive value |
| Parser | `parser.hpp` | Parse UTF-8 YAML into `ParsedDocument` |
| Validator | `validator.hpp` | Enforce Canonical Specification 1.0 structure |
| Analyzer | `analyzer.hpp` | Validate identity/reference semantics and produce stable counts |
| Dependency Resolver | `dependency_resolver.hpp` | Resolve directed dependencies, constraints, and order |
| Internal Model | `internal_model.hpp` | Define strong identifiers, versions, objects, and `Specification` |
| Model Builder | `model_builder.hpp` | Construct the typed model from validated syntax |
| Compiler Pipeline | `compiler_pipeline.hpp` | Order stages and stop dependent work on errors |
| Artifact Generator | `artifact_generator.hpp` | Write the fixed deterministic output bundle |
| Serialization | `serialization.hpp` | Format diagnostics, reports, inventories, and JSON strings |
| Compiler Service | `compiler_service.hpp` | Adapt pipeline requests/results to the CLI service boundary |
| CLI | `cli.hpp` | Parse commands/options and route structured results to streams |

Detailed ordering is in [pipeline.md](pipeline.md) and repository-local design
is in
[repositories/cca-compiler/docs/architecture.md](../repositories/cca-compiler/docs/architecture.md).

## Cross-cutting modules

| Module | Responsibility |
|---|---|
| Diagnostics | Stable identifiers/codes, severity, source location, suggestions, collection, and ordering |
| Logging | Explicit operational logging with null and stream implementations |
| Configuration | Immutable output/logging defaults and structural validation |
| Version | Build-generated compiler version |

## Reserved compatibility modules

`DocumentationGenerator`, `ConformanceGenerator`, and `PackageGenerator` are
IM-001 compatibility boundaries. They are not stages in IS-002:

- documentation is produced by `ArtifactGenerator`;
- conformance certification remains out of scope;
- package creation and dependency download remain out of scope.

Their presence does not authorize package, conformance, or runtime behavior.

## Public results

Processing operations return their domain result together with
`ValidationResult`. `PipelineResult` records completed stages, optional
analysis/dependency/model results, and generated file paths. CLI results are
deterministic JSON and process exit status.

An error blocks the next dependent stage. No public compiler operation reports
success for a partial or placeholder result.

## Module examples

Focused examples live under
[repositories/cca-compiler/docs/modules](../repositories/cca-compiler/docs/modules).
The [workspace example catalog](../examples/README.md) links the canonical
sources and primary public modules.
