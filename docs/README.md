# CCA workspace documentation

Read [the architecture](../ARCHITECTURE.md) first. It is authoritative for
scope and dependency direction.

## Standards Compiler

- [Canonical format](../specification/canonical-format.md)
- [Normative schema](../specification/schema/canonical-specification-1.0.schema.json)
- [Compiler architecture](../repositories/cca-compiler/docs/architecture.md)
- [Pipeline](pipeline.md)
- [Internal model](internal-model.md)
- [Validation and diagnostics](validation.md)
- [Generators](generators.md)
- [CLI](cli.md)
- [Limitations and recommended IS-003](limitations.md)
- [Compiler module map](compiler-modules.md)

## Engineering guides

- [Repository overview](repository-overview.md)
- [Developer setup](developer-setup.md)
- [Build instructions](build-instructions.md)
- [Coding standards](coding-standards.md)
- [Public API contract](public-api-contract.md)
- [Ambiguity register](ambiguity-register.md)

## Project records

- [Architecture](../ARCHITECTURE.md)
- [Canonical specification index](../specification/README.md)
- [Roadmap and risks](../ROADMAP.md)
- [Contribution guide](../CONTRIBUTING.md)
- [Examples](../examples/README.md)

Documentation uses these terms precisely:

- **required**: established by architecture or milestone;
- **implemented**: present in source;
- **configured**: wired into build or automation;
- **verified**: observed in a recorded run;
- **planned**: proposed but not yet authorized.

Configured tests or CI are not automatically verified tests or CI.
