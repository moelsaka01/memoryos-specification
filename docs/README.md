# CCA workspace documentation

Read [the architecture](../ARCHITECTURE.md) first. It is authoritative; the
documents in this directory explain developer workflows and contracts without
adding architecture.

## Guides

- [Repository overview](repository-overview.md): workspace and repository
  responsibilities.
- [Developer setup](developer-setup.md): prerequisites and first-time setup.
- [Build instructions](build-instructions.md): configure, build, test, format,
  analysis, and coverage workflows.
- [Coding standards](coding-standards.md): C++23 design and source policy.
- [Compiler modules](compiler-modules.md): module-by-module skeleton behavior.
- [Public API contract](public-api-contract.md): documentation, test, and
  example expectations for every public class.
- [Ambiguity register](ambiguity-register.md): decisions the implementation is
  forbidden to guess.

Project-level records:

- [Architecture](../ARCHITECTURE.md)
- [Reserved specification boundary](../specification/README.md)
- [Roadmap and risks](../ROADMAP.md)
- [Contribution guide](../CONTRIBUTING.md)
- [Examples](../examples/README.md)

Documentation should distinguish all of the following:

- **required**: established by the architecture or milestone;
- **implemented**: present in source;
- **configured**: wired into build or automation files;
- **verified**: actually observed in a recorded run;
- **planned**: proposed but not authorized implementation.

Do not replace one of these terms with another. In particular, configured
tests or CI are not automatically verified tests or CI.
