# CCA examples catalog

## Canonical specifications

- [Comprehensive valid specification](specifications/reference-architecture.yaml)
- [Invalid fixture catalog](specifications/invalid/README.md)

The comprehensive source exercises every root collection and all five object
types. Invalid fixtures isolate schema, identity, reference, relationship,
dependency-cycle, and version-compatibility failures.

Validate or compile from the workspace root:

```console
cca validate examples/specifications/reference-architecture.yaml
cca compile examples/specifications/reference-architecture.yaml --output cca-out
```

## Shared foundation

[core-foundation.md](core-foundation.md) shows `cca-core` configuration,
logging, string utility, and version usage. Those examples remain engineering
utilities and do not define CCA domain behavior.

## Runtime Foundation

[runtime_foundation.cpp](runtime_foundation.cpp) is a minimal, valid headless
CCA-RF-1.0 host lifecycle. It creates one identified Runtime with no service
Providers, advances it through startup and normal shutdown, and removes it from
the host. The no-service composition keeps the example focused on the stable
`RuntimeHost` and `RuntimeBuilder` APIs.

The [Runtime Foundation programming model](../repositories/cca-core/docs/runtime-programming-model.md)
documents typed contracts, Provider composition, dependency injection,
asynchronous events, ownership, errors, and thread safety. The example does
not define Domain Engine or MemoryOS behavior.

## Process Foundation

The Process implementation provides two deterministic IM-005 examples:

- [direct Process execution](../repositories/cca-core/examples/process_usage.cpp);
  and
- [Runtime-hosted Process execution](../repositories/cca-core/examples/process_runtime_usage.cpp).

The [Process Foundation programming model](../repositories/cca-core/docs/process-foundation.md)
documents the public API, structural execution order, lifecycle, ownership,
errors, Runtime composition, and thread safety. The
[conformance evidence mapping](../repositories/cca-core/docs/process-conformance-evidence.md)
maps all CCA-PROC-001 through CCA-PROC-038 requirements to automated tests.

## Compiler API examples

Module contracts live with the compiler repository under
[repositories/cca-compiler/docs/modules](../repositories/cca-compiler/docs/modules):

- [Parser](../repositories/cca-compiler/docs/modules/parser.md)
- [Validator](../repositories/cca-compiler/docs/modules/validator.md)
- [Analyzer](../repositories/cca-compiler/docs/modules/analyzer.md)
- [Artifact Generator](../repositories/cca-compiler/docs/modules/artifact-generator.md)
- [CLI](../repositories/cca-compiler/docs/modules/cli.md)
- [Diagnostics](../repositories/cca-compiler/docs/modules/diagnostics.md)
- [Configuration](../repositories/cca-compiler/docs/modules/configuration.md)
- [Logging](../repositories/cca-compiler/docs/modules/logging.md)

Compiler conformance, documentation, and package generator seams remain
reserved and are not part of the working IS-002 pipeline. The IM-003 Runtime
Foundation and its evidence mapping are separate from those compiler seams.

## MemoryOS 1.2 adapters

The [AI runtime adapter example](../repositories/cca-studio/examples/ai_runtime_adapter_usage.mjs)
uses an offline OpenAI Agents SDK `StreamedRunResult`-shaped source to create a
verified MIP. Its provider events are private lifecycle-validation input; only
the settled, source-authored output enters the package. No SDK package,
credential, network request, live agent, Runtime instance, or Studio process is
required.

Run it from the workspace root:

```text
node repositories/cca-studio/examples/ai_runtime_adapter_usage.mjs
```

## MemoryOS 1.2 Investigation Core

The [Investigation Core example](../repositories/cca-studio/examples/investigation_core_usage.mjs)
drives native Observe → Trace → Replay → Compare behavior through the single
execution authority, restores an integrity-bound checkpoint, and imports and
re-exports a verified Observation-only adapter MIP without inventing missing
cognitive artifacts.

```text
node repositories/cca-studio/examples/investigation_core_usage.mjs
```

## MemoryOS 1.2 SDK

The [MemoryOS SDK examples](../repositories/cca-sdk/examples/) exercise the
same frozen Investigation Core through public Python and C++ facades. They use
explicit snapshots, selections, comparison sessions, checkpoints, and MIP
bytes; none constructs cognitive artifacts locally.

- [Python examples](../repositories/cca-sdk/examples/python/) cover Observe,
  Replay, staged Compare, Verify, exact import/export, batch verification, and
  deterministic regression.
- [C++ quick start](../repositories/cca-sdk/examples/cpp_quickstart.cpp) covers
  explicit native observation and Core-owned verification.
- [C++ regression](../repositories/cca-sdk/examples/cpp_regression.cpp) compares
  two imported investigations through the SDK and prints the Core report.

The examples are registered in the SDK's automated verification rather than
being documentation-only snippets.

## MemoryOS 1.2 CLI

The [MemoryOS CLI examples](../repositories/memoryos-cli/examples/) execute all
twelve public commands through the released SDK facade. They decode the approved
complete MIP fixture, use the detached reference snapshot, verify byte-exact
export, compare two explicit packages for deterministic regression, and exercise
session-scoped checkpoint restoration without serializing an opaque checkpoint.

```text
node repositories/memoryos-cli/examples/run-cli-examples.mjs
```

The example runner is also registered as an automated CTest and npm test.

## Example quality rules

- State whether an example is valid, intentionally invalid, or conceptual.
- Check command status and structured diagnostics.
- Keep input and expected output deterministic.
- Never require network, database, plugin, live AI/LLM execution, or ambient
  MemoryOS behavior; capability-specific examples use detached fixtures.
- Update schema, example, compiler validation, and tests together.

Examples demonstrate the format and implementation. Only the checked-in schema
and architecture records are normative.
