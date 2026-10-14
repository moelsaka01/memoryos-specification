# CCA workspace documentation

Read [the architecture](../ARCHITECTURE.md) first. It is authoritative for
scope and dependency direction.

## MemoryOS

- [MemoryOS 1.3 Investigation Policies](investigation-policies.md)
- [MO-1301 conformance and release readiness](../repositories/cca-conformance/docs/mo1301-conformance.md)
- [MO-1302 handoff contract](../repositories/cca-conformance/docs/mo1302-handoff.md)
- [MemoryOS 1.2 product overview](../README.md)
- [MemoryOS Standard and official conformance suite](../repositories/cca-conformance/README.md)
- [MemoryOS 1.2.0 Reference Implementation guide](../repositories/cca-conformance/docs/reference-implementation-guide.md)
- [MemoryOS compatibility guide](../repositories/cca-conformance/docs/compatibility-guide.md)
- [MemoryOS versioning guide](../repositories/cca-conformance/docs/versioning-guide.md)
- [MemoryOS certification guide](../repositories/cca-conformance/docs/certification-guide.md)
- [MemoryOS 1.2.0 conformance report](../repositories/cca-conformance/docs/conformance-report.md)
- [MemoryOS 1.2 Memory Investigation Packages](../repositories/cca-studio/docs/memory-investigation-packages.md)
- [MemoryOS 1.2 AI Runtime Adapters](../repositories/cca-studio/docs/ai-runtime-adapters.md)
- [MemoryOS 1.2 Investigation Core](../repositories/cca-studio/docs/investigation-core.md)
- [Investigation Core conformance evidence](../repositories/cca-studio/docs/investigation-core-conformance-evidence.md)
- [Cognitive Regression Analysis](../repositories/cca-studio/docs/cognitive-regression.md)
- [Cognitive Regression engineering guide](../repositories/cca-studio/docs/cognitive-regression-engineering-guide.md)
- [Cognitive Regression report schema](../repositories/cca-studio/docs/schemas/cognitive-regression-report-1.0.schema.json)
- [Cognitive Regression conformance report](../repositories/cca-studio/docs/cognitive-regression-conformance-report.md)
- [Cognitive Investigation Explorer](../repositories/cca-studio/docs/cognitive-investigation-explorer.md)
- [Cognitive Investigation Explorer engineering guide](../repositories/cca-studio/docs/cognitive-investigation-explorer-engineering-guide.md)
- [Cognitive Investigation Explorer architecture review](../repositories/cca-studio/docs/cognitive-investigation-explorer-architecture-review.md)
- [Cognitive Investigation Explorer conformance report](../repositories/cca-studio/docs/cognitive-investigation-explorer-conformance-report.md)
- [MemoryOS SDK](../repositories/cca-sdk/README.md)
- [MemoryOS SDK API reference](../repositories/cca-sdk/docs/api-reference.md)
- [MemoryOS SDK regression guide](../repositories/cca-sdk/docs/regression-guide.md)
- [MemoryOS SDK developer guide](../repositories/cca-sdk/docs/developer-guide.md)
- [MemoryOS SDK conformance report](../repositories/cca-sdk/docs/conformance-report.md)
- [MemoryOS CLI](../repositories/memoryos-cli/README.md)
- [MemoryOS CLI quick start](../repositories/memoryos-cli/docs/quick-start.md)
- [MemoryOS CLI command reference](../repositories/memoryos-cli/docs/command-reference.md)
- [MemoryOS CLI automation guide](../repositories/memoryos-cli/docs/automation-guide.md)
- [MemoryOS CLI conformance report](../repositories/memoryos-cli/docs/conformance-report.md)
- [MemoryOS CLI regression conformance report](../repositories/memoryos-cli/docs/regression-conformance-report.md)
- [MemoryOS 1.2 release notes](../RELEASE_NOTES.md)
- [MemoryOS changelog](../CHANGELOG.md)
- [MemoryOS 1.2 known issues](../KNOWN_ISSUES.md)
- RC-001B repository audit (historical record; not retained in the v1.2.1 source archive)
- [MemoryOS Studio documentation and evidence index](../repositories/cca-studio/docs/README.md)
- [Memory Studio public API and behavior](../repositories/cca-studio/docs/memory-studio.md)
- [Memory Studio conformance evidence](../repositories/cca-studio/docs/memory-studio-conformance-evidence.md)
- [MemoryOS 1.1 engineering architecture review](../repositories/cca-studio/docs/memoryos-1.1-engineering-architecture-review.md)
- MemoryOS 1.1 performance report (historical record; not retained in the v1.2.1 source archive)
- MemoryOS 1.1 scalability report (historical record; not retained in the v1.2.1 source archive)
- MemoryOS 1.1 engineering benchmark (historical record; not retained in the v1.2.1 source archive)
- MemoryOS 1.1 UX audit (historical record; not retained in the v1.2.1 source archive)
- MemoryOS 1.1 accessibility audit (historical record; not retained in the v1.2.1 source archive)
- MemoryOS 1.1 documentation audit (historical record; not retained in the v1.2.1 source archive)
- [Official MemoryOS 1.2 demonstration](../repositories/cca-studio/docs/media/memoryos-v1.2-demo.gif)
- [Full-quality MemoryOS 1.2 demonstration](../repositories/cca-studio/docs/media/memoryos-v1.2-demo.mp4)
- Historical MemoryOS 1.1 demonstration (historical media; not retained in the v1.2.1 source archive)

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
- [Engineering tools](../tools/README.md)

## Project records

- [Repository landing page](../README.md)
- [Release notes](../RELEASE_NOTES.md)
- [Changelog](../CHANGELOG.md)
- [Known issues](../KNOWN_ISSUES.md)
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
