# Canonical CCA specification format

This directory contains the versioned, architecture-neutral input contract for
the CCA Standards Compiler. The canonical format is the single source of truth
consumed by IS-002: documentation and reports are derived from it rather than
maintained as separate architectural records.

The format describes architecture; it does not implement a runtime. A
specification may inventory runtime-facing contracts as data, but this
milestone contains no MemoryOS, cognition, AI, persistence, plugin, network, or
runtime behavior.

## Normative resources

- [Canonical Specification 1.0 JSON Schema](schema/canonical-specification-1.0.schema.json)
- [Format reference](canonical-format.md)
- [Comprehensive valid example](../examples/specifications/reference-architecture.yaml)
- [Validation fixtures](../examples/specifications/invalid/README.md)

The JSON Schema uses Draft 2020-12. It validates JSON directly and YAML after
YAML is parsed to the equivalent JSON data model. Canonical source files use
UTF-8 YAML and contain exactly one document.

Every source document identifies this schema:

```yaml
$schema: cca://schemas/canonical-specification/1.0
format_version: 1.0.0
kind: canonical_specification
```

`$schema` selects the schema family. `format_version` selects the compatible
format revision. The IS-002 compiler accepts `1.x.y` and rejects other major
versions. The specification's own `version` is independent: it versions the
architecture content rather than the serialization format.

## Validation layers

Validation is intentionally split:

1. YAML parsing establishes a typed, source-located value tree.
2. Schema validation checks required fields, shapes, enums, patterns, and
   closed core records.
3. Semantic validation checks uniqueness, references, relationship identity,
   dependency cycles, and compatible version constraints.
4. Analysis and model construction run only when errors do not block them.

The checked-in invalid fixtures identify which layer is expected to reject
each document. The compiler emits structured diagnostics; it never requires a
consumer to scrape log messages.

## Extension policy

Core records reject unknown properties. Deliberate customization belongs in an
`extensions` map, whose keys use the same lowercase dotted or hyphenated form
as identifiers. Extension values may be any YAML value representable in the
JSON data model.

`annotations` are lightweight scalar facts for tools and readers. They are not
compiler directives. `properties`, artifact `options`, and extension values
are preserved deterministically, but IS-002 does not attach unapproved runtime
semantics to them.

## Change control

Backward-compatible 1.x additions must remain valid under the 1.0 schema or
ship a new schema URI and documented compatibility rule. A breaking field,
meaning, identifier rule, or processing rule requires a new major format
version. Schema, format documentation, examples, compiler validation, and
tests change together.

The workspace [architecture](../ARCHITECTURE.md) is authoritative for
implementation scope. The canonical format is authoritative for
specification-data shape within that scope.
