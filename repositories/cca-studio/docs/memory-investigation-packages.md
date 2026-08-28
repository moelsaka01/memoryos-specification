# Memory Investigation Packages

## Purpose

The MO-1201 module implements the frozen MIP-001 wire contract for deterministic
Memory Investigation Packages (`.mip`). It is a headless, renderer-independent
Producer, Consumer, and Verifier. It does not change MemoryOS Runtime, Studio,
Replay, Evolution, or Comparative Reconstruction behavior.

The implementation is in:

- `web/js/mip-canonical.js` — strict UTF-8 and JSON, RFC 8785 serialization,
  and dependency-free SHA-256;
- `web/js/memory-investigation-package.js` — package construction, import,
  verification, semantic reconstruction, and export.

## Public module operations

```js
import {
  createMemoryInvestigationPackage,
  exportMemoryInvestigationPackage,
  importMemoryInvestigationPackage,
  verifyMemoryInvestigationPackage,
} from "./web/js/memory-investigation-package.js";
```

### Export

```js
const bytes = exportMemoryInvestigationPackage({
  packageIdentifier: "investigation-001",
  workspaceIdentifier: "workspace-001",
  metadata: {
    producer: { name: "MemoryOS", version: "1.2.0" },
    source: { name: "MemoryOS", version: "1.1.0" },
  },
  observations,
  traces,
  replays,
  evolutions,
  comparativeReconstructions,
  extensions: {},
  sourceAccepted: true,
  sourceAuthorshipAttested: true,
});
```

The two final flags are export-boundary attestations and are never serialized.
They state that the input is a coherent detached source result and that textual
cognition was copied from that source without exporter-generated explanation.
No clock, random identifier, renderer value, or Runtime state is consulted.

The exporter sorts only collections whose order MIP-001 defines as canonical.
It preserves provenance arrays and arrays inside semantic revisions exactly.
It constructs the manifest, inventory, feature declarations, verification
evidence, section digests, cognition digest, and package digest privately. No
bytes are returned unless the complete package passes the same importer and
verifier used for external input.

### Import

```js
const investigation = importMemoryInvestigationPackage(bytes, {
  supportedExtensions: ["org.example.memory.signature"],
  maxBytes: 16 * 1024 * 1024,
  maxDepth: 128,
  maxValues: 1_000_000,
  maxAlignmentCells: 4_000_000,
});
```

Import accepts a UTF-8 string, `Uint8Array`, byte array, or `ArrayBuffer`. It
returns a deeply immutable package only after every validation phase succeeds.
On failure it throws `MemoryInvestigationPackageError`; existing caller state
is untouched.

For file-envelope validation, use `importMemoryInvestigationPackageFile()`.
It additionally requires a `.mip` name and media type
`application/vnd.memoryos.mip+json`.

### Verification

```js
const result = verifyMemoryInvestigationPackage(bytes);

if (!result.valid) {
  for (const diagnostic of result.diagnostics) {
    console.error(diagnostic.code, diagnostic.path);
  }
}
```

Diagnostics contain only a stable MIP-001 code and RFC 6901 path. Validation
uses the normative phase order and publishes no partial package.

## Validation pipeline

The verifier performs, in order:

1. resource-limit preflight;
2. strict UTF-8 and JSON parsing;
3. duplicate-member and canonical-byte checks;
4. closed MIP-001 structural and version validation;
5. section, cognition, and package hash verification;
6. Workspace, identity, ordering, inventory, and reference validation;
7. provenance grammar, connectivity, and cycle validation;
8. independent Trace reconstruction;
9. independent Replay reconstruction;
10. independent Evolution reconstruction;
11. independent Comparative Reconstruction using deterministic LCS with the
    required Observation-A tie preference;
12. extension compatibility and prohibited-content validation;
13. verification-evidence comparison.

Stored derived artifacts are never trusted as source truth for their own
validation.

## Integrity and compatibility

All hashes use the exact MIP-001 domain separators and SHA-256. Embedded hashes
establish integrity, not producer authenticity. Unknown noncritical extensions
are preserved in byte-identical round trips. Unknown critical extensions fail
atomically unless explicitly listed in `supportedExtensions`. Stable same-major
wire versions are accepted; unknown major and prerelease/build versions are
rejected.

## Conformance evidence

The [MIP-001 conformance matrix](mip-conformance-matrix.md) maps every mandatory
requirement `CCA-MIP-001` through `CCA-MIP-064` to its implementation surface
and exact automated test names. It records 62 requirements as directly covered
by executable evidence and two external assurance/governance requirements as
review evidence. The suite establishes requirement-level conformance without
claiming a Cartesian mutation of every equivalent schema field or
prohibited-content location.

The MIP test surface comprises:

- `tests/mip_canonical_test.mjs`;
- `tests/memory_investigation_package_test.mjs`;
- `tests/mip_adversarial_conformance_test.mjs`;
- `tests/mip_ordering_conformance_test.mjs`;
- `tests/mip_derived_edge_conformance_test.mjs`;
- `tests/mip_pipeline_conformance_test.mjs`; and
- `tests/mip_schema_conformance_test.mjs`, which independently evaluates the
  frozen Draft 2020-12 schema assertions used by MIP-001.

The suite verifies:

- exact published bytes and checksums for the minimal, complete, and unknown
  noncritical-extension examples;
- byte-identical import/export round trips;
- representative invalid-vector diagnostics and deterministic phase
  precedence;
- complete provenance → Trace → Replay → Evolution → Comparative
  Reconstruction derivation;
- scalar/occurrence/chronology boundaries, multi-branch Trace and Replay, and
  Comparative LCS/reason-code edge behavior;
- all thirteen validation phases and every stable diagnostic code;
- deterministic output, resource limits, immutable imports, and atomic failure;
- lossless extension/version round trips at every public serialization path;
- package/renderer/Runtime/Provider independence.

Publication atomicity is defined at the module's detached-value boundary. A
successful call returns a new immutable package value or byte array only after
complete verification; a failed call returns no partial result and preserves
caller-owned state. The module does not write files or claim host-filesystem
transaction semantics.

Exact copies of the frozen JSON Schema and the minimal, complete, and unknown
noncritical-extension golden vectors are vendored as Base64 text fixtures under
`tests/fixtures/mip/`. Tests decode them to their original bytes and assert the
published schema and vector SHA-256 values before using them. This makes the
Studio test run independent of a sibling specification checkout without
changing the authoritative MIP-001 package, which remains frozen.
