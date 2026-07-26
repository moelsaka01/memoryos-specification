# Public API contract

This document defines the quality bar for public C++ interfaces. It does not
promise a frozen ABI; that policy remains unresolved in CCA-A004.

## Required documentation

Every public class or value must state:

1. its single responsibility and exclusions;
2. ownership and dependency lifetimes;
3. input preconditions;
4. returned value and diagnostic meaning;
5. observable I/O or stream effects;
6. determinism and ordering;
7. thread-safety status;
8. current limitations and compatibility status.

Implemented behavior requires public-behavior tests and an example or
integration fixture. A reserved compatibility seam must say plainly that it is
not part of the IS-002 pipeline.

## Standards Compiler surfaces

| Area | Principal public types | Contract focus |
|---|---|---|
| Source | `SourceDocument`, `LoadResult`, `ISourceLoader`, `FileSourceLoader` | Explicit, injectable, network-free input |
| Syntax | `CanonicalValue`, `ParsedDocument`, `ParseResult`, `Parser` | Owned source-located YAML-independent values |
| Schema | `Validator` | Canonical Specification 1.0 shape and metadata |
| Analysis | `AnalysisSummary`, `AnalysisResult`, `Analyzer` | Deterministic identity/reference facts |
| Dependencies | `DependencyResolution`, `DependencyResolver` | Endpoint, constraint, cycle, and stable order |
| Model | `Identifier`, `Version`, `Metadata`, typed objects, `Specification` | Strong value semantics and composition |
| Construction | `ModelBuildResult`, `ModelBuilder` | Validated syntax to typed model |
| Generation | `GenerationResult`, `ArtifactGenerator` | Fixed deterministic bundle beneath explicit output |
| Pipeline | `PipelineMode`, `PipelineRequest`, `PipelineResult`, `CompilerPipeline` | Ordered orchestration and failure propagation |
| CLI service | `CommandRequest`, `CommandResult`, `ICommandService`, `CompilerCommandService` | Pipeline-to-JSON adaptation |
| CLI | `CliExitCode`, `CompilerCommand`, `Cli` | Deterministic parsing, streams, and exit status |
| Diagnostics | `Diagnostic`, `DiagnosticLocation`, `ValidationResult`, diagnostic sinks | Stable identity, location, suggestion, and ordering |
| Serialization | JSON/report free functions | Fixed escaping and member order |
| Cross-cutting | `CompilerConfiguration`, logger interfaces, version | Explicit environment and observation |

Path-only IM-001 request overloads are compatibility seams, not a second
compiler pipeline.

## Ownership

- Prefer owned values for source, syntax, model, result, and diagnostic data.
- Use `std::unique_ptr` for sole dynamic ownership.
- Use `std::shared_ptr` only for deliberately shared injected interfaces.
- References and raw pointers are non-owning and require documented lifetime.
- Caller-owned CLI and logger streams must outlive their observers.
- No interface may depend on mutable global state.

## Results and errors

Typed stages return their domain result together with `ValidationResult`.
Expected source/schema/semantic failures are diagnostics, not log scraping.
Errors block dependent stages; warnings and notes do not.

Diagnostic identifiers and codes are the machine contract. Message prose may
improve. Standard-library allocation and I/O may throw unless an operation
documents a stronger guarantee; public composition boundaries convert expected
failures to structured results.

## Determinism

Equivalent explicit input and dependencies produce equivalent public values,
diagnostic order, JSON, and artifact bytes. Public collections that affect
serialization have documented lexical or pipeline order. Tests do not depend
on clock, randomness, locale, network, environment discovery, or global
mutation.

## Thread safety

Thread safety is documented per type. Immutable values support concurrent
reading. Stateful sinks document synchronization. `Cli` and output-directory
generation require external synchronization when callers share streams or
paths.

## Reserved types

`DocumentationGenerator`, `ConformanceGenerator`, and `PackageGenerator` remain
compatibility boundaries. They do not define alternate documentation,
certification, packaging, registry, or runtime behavior.
