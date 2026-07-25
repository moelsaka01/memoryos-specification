# CCA examples catalog

This directory is the workspace-level catalog. Canonical, version-matched
compiler examples live with `cca-compiler` so a public header and its example
can change together.

## Shared foundation example

[`core-foundation.md`](core-foundation.md) shows configuration snapshots,
severity-filtered logging, the null sink, stream sink, and recording test sink.
The snippets exercise engineering utilities only; they are not CCA domain
behavior.

## Compiler module examples

Start with the compiler repository's
[`docs/modules`](../repositories/cca-compiler/docs/modules) directory:

| Module | Example and contract |
|---|---|
| Parser | [`parser.md`](../repositories/cca-compiler/docs/modules/parser.md) |
| Validator | [`validator.md`](../repositories/cca-compiler/docs/modules/validator.md) |
| Analyzer | [`analyzer.md`](../repositories/cca-compiler/docs/modules/analyzer.md) |
| Artifact Generator | [`artifact-generator.md`](../repositories/cca-compiler/docs/modules/artifact-generator.md) |
| Documentation Generator | [`documentation-generator.md`](../repositories/cca-compiler/docs/modules/documentation-generator.md) |
| Conformance Generator | [`conformance-generator.md`](../repositories/cca-compiler/docs/modules/conformance-generator.md) |
| Package Generator | [`package-generator.md`](../repositories/cca-compiler/docs/modules/package-generator.md) |
| CLI | [`cli.md`](../repositories/cca-compiler/docs/modules/cli.md) |
| Configuration | [`configuration.md`](../repositories/cca-compiler/docs/modules/configuration.md) |
| Logging | [`logging.md`](../repositories/cca-compiler/docs/modules/logging.md) |
| Diagnostics | [`diagnostics.md`](../repositories/cca-compiler/docs/modules/diagnostics.md) |

Those examples demonstrate construction, dependency injection, request
validation, and deterministic placeholder outcomes. They do not demonstrate
CCA source parsing, compilation, validation, analysis, generation, packaging,
or conformance.

## CLI walkthrough

After building the `cca` executable, the safe foundation commands are:

```console
cca help
cca version
cca doctor
```

The compiler-shaped commands are present only to exercise dispatch:

```console
cca compile path/to/input
cca validate path/to/input
cca generate path/to/input
```

They return an unavailable/not-implemented outcome. Do not use them in a
pipeline that expects artifacts or domain validation. Exact output text and
exit-code compatibility are provisional; see CCA-A014 in the
[ambiguity register](../docs/ambiguity-register.md).

## Example quality rules

- State whether an example is expected to compile or is conceptual.
- Keep executable examples in the repository that owns the public API.
- Check statuses and show diagnostics; do not ignore failures.
- Inject streams, loggers, sinks, paths, and other environmental dependencies.
- Never claim unimplemented semantics.
- Avoid network, database, plugin, AI, reasoning, LLM, or MemoryOS dependencies.
- Update an example in the same change as the public interface it uses.

No example in this foundation is a normative CCA specification or conformance
fixture.
