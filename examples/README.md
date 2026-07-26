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

Foundation-era conformance, documentation, and package generator seams remain
reserved and are not part of the working IS-002 pipeline.

## Example quality rules

- State whether an example is valid, intentionally invalid, or conceptual.
- Check command status and structured diagnostics.
- Keep input and expected output deterministic.
- Never require network, database, plugin, AI, cognition, LLM, or MemoryOS
  behavior.
- Update schema, example, compiler validation, and tests together.

Examples demonstrate the format and implementation. Only the checked-in schema
and architecture records are normative.
