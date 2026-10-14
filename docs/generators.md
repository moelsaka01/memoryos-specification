# IS-002 artifact generators

`compile` and `report` derive a fixed, deterministic bundle from a valid
`Specification`. Generation is architecture-neutral and contains no
production code generator.

## Output bundle

| Path | Format and purpose |
|---|---|
| `documentation-index.md` | Human-readable entry point linking the generated bundle |
| `dependency-graph.mmd` | Mermaid directed graph of top-level dependency edges |
| `specification-report.json` | Specification identity, format, counts, and diagnostic summary |
| `validation-report.json` | Complete structured diagnostic array and severity totals |
| `object-inventory.json` | Lexically ordered object identity, type, category, name, and version |
| `architecture-summary.md` | Human-readable specification and typed-object summary |
| `generated/README.md` | Explicit placeholder stating that production code generation is not implemented |

JSON is UTF-8, compact, and newline-terminated. Serializers use a fixed member
order and escape control characters. Markdown tables escape delimiters.
Mermaid node names are assigned from lexically sorted identifiers so source
ordering cannot change the graph.

## Generation contract

The generator receives:

- a fully validated typed `Specification`;
- the accumulated `ValidationResult`;
- an explicit output directory.

It creates the output directory and `generated` child when necessary. It never
chooses an output directory from environment state and never writes outside
the explicit directory. Artifact request paths are descriptive inputs in the
canonical model; the IS-002 filenames above are fixed so downstream tooling
has one stable contract.

No timestamps, host names, random identifiers, absolute input paths, network
data, or locale-formatted values appear in successful artifacts.

## Failure behavior

An empty, unsafe, or unwritable output location yields a structured artifact
diagnostic. The command returns failure and does not claim generated files.
IS-002 does not provide an atomic directory swap, overwrite confirmation,
incremental cache, signing, packaging, or rollback facility.

## Code-generation boundary

`placeholder_code` is deliberately represented by `generated/README.md`.
There are no source templates, target languages, build invocations, executable
artifacts, or runtime behavior. A future milestone must authorize a specific
code contract before this boundary changes.
