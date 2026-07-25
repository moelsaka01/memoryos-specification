# Compiler Architecture

The compiler repository is a dependency-light C++23 boundary layer. It defines
the eleven modules required by the foundation milestone without selecting a CCA
source grammar, intermediate representation, validation rule set, artifact
schema, documentation format, conformance format, or package format.

## Dependency direction

`Parser`, `Validator`, `Analyzer`, and the four generators depend only on the
logging and diagnostics abstractions. `Cli` depends on `Configuration` and
writes to caller-owned streams. The executable is the composition root.
Nothing in this repository performs file I/O, network I/O, persistence, AI,
reasoning, or plugin discovery.

Logging and diagnostic dependencies use `std::shared_ptr` because a composition
root may share one sink across several independently owned modules. Null-object
implementations make the default constructors deterministic without global
state. Streams passed to `Cli` and `StreamLogger` remain caller-owned and must
outlive the receiving object.

Processing and generation objects have no mutable module state, but concurrent
calls are safe only when their injected logger and diagnostic sink are safe for
concurrent use. `StreamLogger` and `CollectingDiagnosticSink` serialize their
own state. `Cli` does not synchronize caller-owned streams and requires
external synchronization. Configuration and status values support concurrent
read-only access.

## Foundation behavior

Pipeline requests contain paths only as boundary placeholders. Empty required
paths return `StatusCode::invalid_argument` (`2`). Well-formed requests emit a
module-specific note and return `StatusCode::not_implemented` (`69`). These
calls never inspect the path or create output.

The numeric statuses, diagnostic identifiers, CLI spelling, and CLI output are
deterministic values for this foundation release, not a long-term compatibility
commitment. Their normative compatibility policy remains an architecture
decision.

The request shapes are intentionally narrow. Future milestones must replace or
extend them only after the authoritative CCA grammar, model, artifact, and
package contracts are approved.

## Source layout

- `include/cca/compiler`: documented public API
- `src`: implementation and CLI composition root
- `tests`: one GoogleTest translation unit per module
- `docs/modules`: module contract and example usage

The workspace build supplies target policy and GoogleTest helpers. A standalone
build generates the same `cca::version` API and uses an installed GoogleTest
package when available.

Examples in `docs/modules` are function-body fragments intended to compile
when placed in an appropriate function. They exercise only foundation behavior.
