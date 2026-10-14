# Standards Compiler pipeline

The IS-002 Standards Compiler runs one explicit, deterministic pipeline:

```text
Load -> Parse -> Validate -> Analyze -> Resolve Dependencies
     -> Build Internal Model -> Generate Artifacts -> Generate Reports
```

Stages communicate with typed values and accumulated `ValidationResult`
diagnostics. A stage does not recover hidden state from an earlier stage.

## Stage contracts

| Stage | Input | Successful result | Principal failures |
|---|---|---|---|
| Load | Explicit filesystem path | UTF-8 `SourceDocument` with path and bytes | Missing, unreadable, empty, or invalid source |
| Parse | `SourceDocument` | YAML-independent `CanonicalValue` tree with source locations | Malformed YAML, multiple documents, unsupported value |
| Validate | `ParsedDocument` | Schema-valid canonical tree | Required field, type, enum, identifier, version, metadata, or unknown-property violation |
| Analyze | Validated tree | Stable symbol table and `AnalysisSummary` | Duplicate identifier, unknown object type, unresolved category/reference, duplicate relationship |
| Resolve Dependencies | Analyzed tree | Deterministic dependency order | Unknown endpoint, incompatible version, duplicate edge, circular dependency |
| Build Internal Model | Validated and resolved tree | Typed `Specification` value | Inconsistent data that escaped an earlier stage |
| Generate Artifacts | `Specification` and diagnostics | Markdown, Mermaid, and JSON files | Unsafe or unwritable output path |
| Generate Reports | Model and completed-stage evidence | Final report set and command summary | Serialization or output failure |

The generator implementation may write all seven files in one transaction-like
operation, but the conceptual artifact and report stages remain distinct:
architecture-facing files are derived first and the final summaries describe
the completed model and validation result.

## Mode boundaries

The public pipeline supports four modes:

| Mode | Furthest required work |
|---|---|
| `validate` | Run source, schema, semantic, relationship, and dependency validation without writing artifacts |
| `analyze` | Return deterministic object and dependency analysis without writing artifacts |
| `compile` | Run the complete pipeline and write the full artifact bundle |
| `report` | Build the same valid model and write the documented report bundle |

All modes start at Load. No mode accepts an unvalidated internal model.

## Failure propagation

Diagnostics accumulate within a stage and are sorted before they cross a
public boundary. When any error is present, dependent stages do not run.
Warnings and notes do not block the next stage. A stopped run reports both the
diagnostics and the list of stages that completed; it never reports partial
generation as success.

An output-write failure clears the generated-file result and returns an error.
Previously existing output files are not a transactional store and may require
manual cleanup; see [limitations](limitations.md).

## Determinism

- Object and category maps use lexical key order.
- Diagnostics sort by path, line, column, code, and message.
- Dependency traversal uses stable identifier ordering.
- Generated inventories sort by object identifier and type.
- JSON member order is fixed by serializers.
- No stage reads the network, time, locale, randomness, or global mutable
  state.

Dependency injection is explicit. `CompilerPipeline` owns or observes an
`ISourceLoader`; tests can inject an in-memory loader without changing stage
behavior. The command-line executable is the composition root.

## Thread safety

Pipeline values are owned by a run. Stateless processing objects can be used
concurrently when their injected logger and diagnostic sink are also safe.
Filesystem generation targeting the same directory is not safe for concurrent
writes and must be externally serialized.
