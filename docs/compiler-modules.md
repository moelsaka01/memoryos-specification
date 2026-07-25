# Compiler module descriptions

## Foundation behavior

All compiler interfaces are in namespace `cca::compiler` and public headers are
included from `cca/compiler/...`. This milestone establishes testable seams; it
does not implement compiler semantics.

For the processing and generation modules:

- a request with an empty required path is structurally invalid and returns
  `StatusCode::invalid_argument`;
- a structurally acceptable request returns
  `StatusCode::not_implemented`;
- the operation emits a corresponding structured diagnostic through its
  diagnostic seam;
- no source parsing, validation, analysis, or output generation occurs.

These placeholder outcomes are deliberately deterministic. They are not a
long-term source-language, error, or compatibility contract. Do not build a
consumer that interprets `not_implemented` as partial domain success.

No ordering among these modules is authorized. In particular, the list below
does not define a parser-to-validator-to-analyzer pipeline.

## Processing modules

| Module | Public header and operation | Foundation responsibility | Not defined in this milestone |
|---|---|---|---|
| Parser | `<cca/compiler/parser.hpp>`; `Parser::parse(const ParseRequest&)` | Accept a parser request, check the required source path, and expose a diagnostic/test seam | Grammar, tokens, syntax tree, recovery, encodings, includes, or incremental parsing |
| Validator | `<cca/compiler/validator.hpp>`; `Validator::validate(const ValidationRequest&)` | Accept a validation request, check the required input path, and expose a diagnostic/test seam | Validation rules, schema, symbol resolution, specification version, or relationship to parsing |
| Analyzer | `<cca/compiler/analyzer.hpp>`; `Analyzer::analyze(const AnalysisRequest&)` | Accept an analysis request, check the required input path, and expose a diagnostic/test seam | Semantic model, type system, graph analysis, optimization, ordering, or intermediate representation |

The nouns "parse," "validate," and "analyze" describe intended module
boundaries only. They do not establish input formats or valid CCA content.

## Generator modules

| Module | Public header and operation | Foundation responsibility | Not defined in this milestone |
|---|---|---|---|
| Artifact Generator | `<cca/compiler/artifact_generator.hpp>`; `ArtifactGenerator::generate(const ArtifactGenerationRequest&)` | Accept a request, validate required paths, and expose a deterministic unavailable result | Artifact schemas, code generation, naming, layout, normalization, or writes |
| Documentation Generator | `<cca/compiler/documentation_generator.hpp>`; `DocumentationGenerator::generate(const DocumentationGenerationRequest&)` | Accept a request, validate required paths, and expose a deterministic unavailable result | Documentation model, renderer, templates, output format, links, or writes |
| Conformance Generator | `<cca/compiler/conformance_generator.hpp>`; `ConformanceGenerator::generate(const ConformanceGenerationRequest&)` | Accept a request, validate required paths, and expose a deterministic unavailable result | Conformance definition, fixtures, evidence format, certification, or writes |
| Package Generator | `<cca/compiler/package_generator.hpp>`; `PackageGenerator::generate(const PackageGenerationRequest&)` | Accept a request, validate required paths, and expose a deterministic unavailable result | Package format, manifests, signing, dependency resolution, installation, or writes |

Generator class names do not authorize creation of files. Real output requires
approved format, normalization, overwrite, provenance, and reproducibility
contracts. See ambiguity entries CCA-A006, CCA-A015, and CCA-A020.

## CLI

`<cca/compiler/cli.hpp>` exposes
`Cli::run(std::span<const std::string_view>)` for
in-process dispatch and the `cca` executable provides the process entry point.
The placeholder surface is:

| Invocation | Placeholder outcome |
|---|---|
| `cca` | Shows help and returns success |
| `cca help` | Shows help and returns success |
| `cca version` | Reports the foundation version and returns success |
| `cca doctor` | Reports foundation readiness and returns success |
| `cca compile <input>` | Returns unavailable because compilation is not implemented |
| `cca validate <input>` | Returns unavailable because validation is not implemented |
| `cca generate <input>` | Returns unavailable because generation is not implemented |
| missing required input or unknown command | Reports command-line misuse |

The implementation currently maps success to `0`, command-line misuse to `2`,
and unavailable placeholder compiler operations to `69`. Text and numeric
values remain provisional until CCA-A014 is resolved. `doctor` checks the
foundation surface only; it does not certify a functional compiler,
dependencies outside the process, platform support, or conformance.

## Configuration

`<cca/compiler/configuration.hpp>` exposes `CompilerConfiguration`, including a
deterministic `defaults()` construction path and a `validate()` seam.
Foundation defaults use output directory `cca-out`, minimum log level `info`,
and enabled diagnostics.
Configuration file syntax, environment mapping, precedence, project discovery,
and forward/backward compatibility are not implemented or implied.

## Logging

`<cca/compiler/logging.hpp>` provides:

- `ILogger`, the injectable operational logging boundary;
- `NullLogger`, which deliberately discards log messages;
- `StreamLogger`, which writes basic messages to an explicitly supplied
  stream.

Logging is not a machine-readable compiler result and must not replace
diagnostics. No global logger, asynchronous logger, structured event schema,
file sink, rotation, remote sink, or telemetry behavior is authorized.

## Diagnostics

`<cca/compiler/diagnostics.hpp>` provides:

- `Status` and `StatusCode` for operation outcomes;
- `Diagnostic` and `DiagnosticSeverity` for structured detail;
- `IDiagnosticSink` as an injected reporting boundary;
- `NullDiagnosticSink` for consumers that deliberately discard diagnostics;
- `CollectingDiagnosticSink` for thread-safe in-memory collection.

A status is the caller-visible operation outcome. A diagnostic adds detail. A
log entry is operational observation. Consumers must not assume these are
interchangeable.

Stable long-term diagnostic codes, source spans, serialization, localization,
and compatibility are unresolved.

## Module documentation and examples

Detailed examples owned by the compiler repository are under
[`repositories/cca-compiler/docs/modules`](../repositories/cca-compiler/docs/modules).
The workspace example catalog in [../examples/README.md](../examples/README.md)
indexes them without duplicating API details.

If a compiler header and its module document disagree, the mismatch must be
fixed. Neither may redefine [the architecture](../ARCHITECTURE.md).
