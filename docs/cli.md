# CCA Standards Compiler CLI

The `cca` executable exposes the first working Standards Compiler. Commands
accept one explicit canonical YAML file and write one deterministic JSON
result line. Human-oriented `help` and `version` are the exceptions.

## Commands

```console
cca validate specification.yaml
cca analyze specification.yaml
cca compile specification.yaml
cca report specification.yaml
```

`compile` and `report` default to `cca-out`. Select another output directory
with either spelling:

```console
cca compile specification.yaml --output build/cca
cca report specification.yaml -o build/reports
```

Supporting commands:

```console
cca doctor
cca version
cca help
```

`doctor` reports compiler and format readiness as JSON. It does not validate a
project or certify platform conformance.

## Output protocol

Successful compiler commands write JSON to standard output. Failed compiler or
usage commands write JSON to standard error. Result objects contain the
command, status, completed stages, diagnostics, and mode-appropriate analysis
or generated-file information. JSON member and diagnostic order are stable.

Paths in JSON use generic forward-slash spelling. A result contains no
timestamp, terminal color, progress animation, or locale-dependent text.
Operational logging is separate from the command result.

## Exit status

| Value | Name | Meaning |
|---:|---|---|
| `0` | success | Requested operation completed without errors |
| `1` | validation error | Source, schema, reference, dependency, or generation diagnostic blocked completion |
| `2` | usage error | Unknown command, missing source, or invalid option |
| `69` | unavailable | Reserved compatibility value for an unavailable operation |
| `70` | software error | Compiler service or unexpected internal failure |

Consumers should check both the process status and JSON `status`. Exact message
prose is not a protocol; diagnostic identifiers and codes are.

## Examples

Validate the checked-in comprehensive source:

```console
cca validate examples/specifications/reference-architecture.yaml
```

Run the full pipeline:

```console
cca compile examples/specifications/reference-architecture.yaml --output cca-out
```

Inspect an intentionally invalid fixture:

```console
cca validate examples/specifications/invalid/circular-dependency.yaml
```

The command performs no network access and does not discover implicit project
files from the current directory.
