# Public API contract

This document defines the conceptual quality bar for every public class in the
foundation. It does not grant long-term API or ABI stability; that policy is
unresolved in CCA-A004.

## Required documentation for each public class

Public class documentation must answer:

1. What single responsibility does the class own?
2. What behavior is explicitly outside that responsibility?
3. Who owns the object and every dependency it observes?
4. Which operations mutate logical or externally visible state?
5. What input preconditions are enforced?
6. What does each returned status or value mean?
7. What diagnostics, logs, stream writes, or other side effects occur?
8. Is behavior deterministic for equivalent explicit inputs?
9. What is the thread-safety status?
10. Which behavior is a milestone placeholder?

Avoid vague phrases such as "handles compilation" when the class only validates
a request and returns `not_implemented`.

## Required verification and example seam

Every public class requires:

- a discoverable unit-test file or clearly named unit-test placeholder;
- a construction or invocation example in its owning repository;
- coverage of implemented structural behavior only;
- no assertion that future compiler semantics already exist.

An honest test placeholder may verify constructibility, injected dependency
use, structural input rejection, deterministic unavailable status, or safe
empty behavior. A comment that merely says `TODO` without identifying the
future contract is not sufficient.

Canonical compiler module examples belong under
[`repositories/cca-compiler/docs/modules`](../repositories/cca-compiler/docs/modules).
Shared foundation examples are cataloged in
[`examples/core-foundation.md`](../examples/core-foundation.md).

## Shared foundation public-class inventory

| Public class | Conceptual contract | Required example focus |
|---|---|---|
| `cca::core::ConfigurationKey` | Validated strong key that rejects empty text and provides deterministic lexical comparison | Construct a key and use it without replacing it with a raw string |
| `cca::core::Configuration` | Immutable ordered snapshot of string values with lookup, fallback, presence, and size queries; it does not load files or environment variables | Query a snapshot produced by a builder |
| `cca::core::ConfigurationBuilder` | Mutable construction boundary whose repeated `set` deterministically replaces a value before producing an immutable snapshot | Set values and build through lvalue and rvalue paths |
| `cca::core::SemanticVersion` | Value representation of major, minor, patch, prerelease, and build metadata with deterministic text conversion and value comparison | Call `current_version()`, inspect fields, and render the generated workspace version |
| `cca::core::LogSink` | Polymorphic output boundary; concrete sinks define synchronization and are shared by `Logger` instances | Implement or inject a narrowly scoped sink |
| `cca::core::Logger` | Small logger with deterministic minimum-severity filtering and shared sink lifetime | Inject a sink and show filtered versus accepted entries |
| `cca::core::NullLogSink` | Safe sink that intentionally discards entries | Construct quiet logging without null checks or global state |
| `cca::core::OstreamLogSink` | Thread-safe sink writing stable human-readable lines to a caller-owned stream; stream must outlive the sink | Capture output in an `std::ostringstream` |
| `cca::testing::RecordingLogSink` | Thread-safe test sink that owns copied entries and exposes snapshot/clear operations | Record, snapshot, and clear test output |

`current_version()` is the public source of the configured
`SemanticVersion`. `LogLevel` and `LogEntry` are public value contracts, and
the string utility functions are public free-function contracts. They follow
the same documentation, deterministic behavior, test, and example requirements
even though they are not classes.

## Compiler public-class inventory

This inventory states the conceptual expectation for each planned compiler
class. Header documentation and repository examples supply precise signatures.

| Public class | Conceptual contract | Required example focus |
|---|---|---|
| `Status` | Immutable operation outcome with an explicit `StatusCode`, message, and success query; does not carry logs or a domain result | Construct/query the provided factory outcomes |
| `IDiagnosticSink` | Polymorphic reporting abstraction implemented by a consumer; compiler modules share ownership of injected sinks | Minimal shared sink receiving one `Diagnostic` |
| `NullDiagnosticSink` | Safe sink that intentionally discards reports | Inject when diagnostics are intentionally ignored |
| `CollectingDiagnosticSink` | Thread-safe in-memory collection with snapshot and clear operations; owns its stored copies | Collect, snapshot, and clear without relying on ordering beyond its documented contract |
| `ILogger` | Operational message boundary implemented or supplied by a consumer; compiler modules share ownership of injected loggers; not a result or diagnostic channel | Inject a shared logger without global registration |
| `NullLogger` | Safe logger that intentionally discards messages | Construct deterministic quiet operation |
| `StreamLogger` | Logger that writes to an explicitly supplied stream whose lifetime outlives the logger | Capture basic output in an owned stream |
| `CompilerConfiguration` | Value/facade containing output directory, minimum log level, and diagnostic enablement, with deterministic defaults and structural validation; does not load unspecified files or environment state | Create defaults, query fields, and inspect validation status |
| `Parser` | Accepts `ParseRequest`, validates required structure, reports diagnostics, and otherwise returns unavailable | Empty-path rejection and well-formed placeholder outcome |
| `Validator` | Accepts `ValidationRequest`, validates required structure, reports diagnostics, and otherwise returns unavailable | Empty-path rejection and well-formed placeholder outcome |
| `Analyzer` | Accepts `AnalysisRequest`, validates required structure, reports diagnostics, and otherwise returns unavailable | Empty-path rejection and well-formed placeholder outcome |
| `ArtifactGenerator` | Accepts `ArtifactGenerationRequest` without creating artifacts in this milestone | Required-path rejection and no-output placeholder |
| `DocumentationGenerator` | Accepts `DocumentationGenerationRequest` without rendering or writing documentation | Required-path rejection and no-output placeholder |
| `ConformanceGenerator` | Accepts `ConformanceGenerationRequest` without defining conformance or producing evidence | Required-path rejection and no-output placeholder |
| `PackageGenerator` | Accepts `PackageGenerationRequest` without creating packages or resolving dependencies | Required-path rejection and no-output placeholder |
| `Cli` | Move-only PImpl facade that dispatches an argument span excluding `argv[0]` to placeholder commands and caller-owned output/error streams | Help/version/doctor plus unavailable compiler command |

If the public headers add, remove, or rename a class, this inventory and the
owning module documentation must be updated in the same change.

## Public value types

Public request structures and enums are also contracts even when the original
quality requirement says "class." They require:

- documented field meaning and units;
- clear required versus optional fields;
- no hidden filesystem or environment discovery;
- defined equality or ordering only when consumers need it;
- explicit default-state validity;
- no implication of future source, intermediate, or artifact formats.

This applies to `StatusCode`, `DiagnosticSeverity`, `Diagnostic`,
`cca::compiler::LogLevel`, `LogRecord`, `CliExitCode`, and all module request
structures.

The current request shapes are intentionally path-only:

- `ParseRequest`, `ValidationRequest`, and `AnalysisRequest` each contain a
  source path;
- artifact, documentation, and conformance generation requests contain a
  source path and output-directory path;
- `PackageGenerationRequest` contains an input-directory path and output-package
  path.

These fields exercise public seams. They do not define approved source,
intermediate, artifact, documentation, conformance, or package formats.

## Ownership and lifetime

- Raw pointers and references are non-owning and require documented lifetime.
- Use `std::unique_ptr` for exclusive heap ownership.
- Use `std::shared_ptr` only when multiple owners truly participate in
  lifetime.
- Prefer values for small immutable requests, statuses, and diagnostics.
- RAII objects release resources in their destructors.
- A PImpl may hide private implementation details but does not by itself create
  ABI guarantees.

## Errors and exceptions

Expected caller-visible operational outcomes should use the documented status
contract. Do not catch and hide programmer errors or invent an exception
guarantee that the interface does not state. Allocation and standard-library
operations may still throw unless an operation is explicitly documented
`noexcept`.

The long-term error taxonomy is unresolved. Do not persist placeholder messages
or depend on exact prose.

## Determinism and thread safety

Document thread safety per class. "Const" is not by itself proof of thread
safety. If an object is not documented as safe for concurrent access, callers
must externally synchronize it.

Equivalent explicit inputs and dependencies must produce equivalent
placeholder outcomes. Examples and tests must not depend on wall-clock time,
randomness, locale, network state, or global mutable state.
