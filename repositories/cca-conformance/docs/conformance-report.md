# MemoryOS Conformance Report Guide

## Purpose

This informative guide describes the official machine-readable MemoryOS
Conformance Report and its generated Markdown projection. It does not redefine
the normative report contract in CCA-MEMORYOS-1.0 `conformance.md` and
`certification.md`.

## Bundled report

The suite publishes the MemoryOS 1.2.0 Reference Implementation assessment in:

- [`reference-implementation-1.2.0.json`](../reports/reference-implementation-1.2.0.json)
- [`reference-implementation-1.2.0.md`](../reports/reference-implementation-1.2.0.md)

The JSON document is the authoritative machine-readable result. The Markdown
document is a deterministic human-readable projection of the same data.

## Report contents

A report identifies:

- the exact MemoryOS Standard, publication date, and publication digest;
- conformance specification, suite, and exact assessment-manifest digest;
- complete or named-profile scope;
- the assessed implementation and version;
- the incorporated Runtime Foundation and MIP publications;
- the declared native projection profile for a complete assessment or an
  assessment selecting `Native Investigation Artifacts`, `Investigation Core`,
  or `SDK`, and when otherwise included for an implementation-specific raw
  snapshot-to-Frame projection;
- the immutable evidence root, exact canonical evidence digest, assessor,
  assessment date, and assessment level;
- for C3, the retained independent-assessment artifact binding;
- attributable evidence records;
- exactly one `PASS`, `FAIL`, or `NOT APPLICABLE` result per requirement;
- every known failure; and
- summary counts that equal the result matrix.

For a complete CCA-MEMORYOS-1.0 claim, the result matrix contains all 218
requirements and cannot contain `NOT APPLICABLE`.

## Evidence records

Each evidence record names the assessed implementation, covered requirement
identifiers, method, versioned inputs, expected outcome, observed outcome, and
durable evidence reference. Automated evidence also records its deterministic
command. Review evidence records the reviewed artifacts, immutable revision,
criterion, reviewer, date, and result.

A report cannot manufacture a pass from a missing evidence record. Schema-only
validation is not a substitute for behavioral evidence.

## Deterministic generation

The report generator accepts an explicit assessment manifest, evidence,
implementation identity, assessor, date, evidence root, and native-profile
identity. It emits canonical JSON plus the matching Markdown table and binds
the canonical manifest digest. It does not read the wall clock or infer omitted
assessment facts.

The checked-in report is generated once and then validated in place. The tool
uses exclusive creation for new report paths so an existing assessment cannot
be overwritten accidentally.

Evidence is retained first at a content-addressed filename derived from its
canonical SHA-256 digest. The familiar versioned evidence filename is only a
convenience alias with identical bytes. A report binds both the durable root
and the exact digest; changing even otherwise-valid evidence bytes makes the
report binding invalid.

For another implementation, `tools/portable-report.mjs` creates or validates a
C1/C2 report using explicit content-addressed assessment and authoritative
normative manifests, retained evidence bytes, and an evidence reference. The
portable tool derives identity, assessor, date, statuses, and native-profile
identity from evidence; it does not substitute Reference Implementation paths
or selectors. Output creation is exclusive. The authoritative published
`CCA-MEMORYOS-1.0` package must be available at its adjacent workspace location
or through `MEMORYOS_STANDARD_ROOT`; the portable C1/C2 and C3 tools fail closed
unless the normative manifest authenticates against that publication.

`nativeProjectionProfile` is mandatory for complete scope and for any scoped
assessment selecting `Native Investigation Artifacts`, `Investigation Core`,
or `SDK`. Other scoped reports may omit it when their assessment begins with
an already published Frame. The bundled Reference Implementation report includes
`cca-studio-native-observation` version `1.1.0` because its retained evidence
exercises that implementation-specific raw projection.

A C3 report can be created only from a valid C2 source report. Its retained
independent-assessment artifact binds the exact source evidence digest and
result matrix. The independent assessment date cannot precede the source C2
assessment date, and the independent assessor identity must differ from the
source assessor identity.

## Validation

From the workspace root:

```console
npm --prefix repositories/cca-conformance run report:validate
```

The report tests verify closed member sets, requirement order and coverage,
status derivation, evidence references, incorporated-publication identity,
summary arithmetic, known failures, scope rules, assessment level, canonical
serialization, and byte-equivalent Markdown regeneration.

The JSON contract is published in
[`conformance-report-1.0.schema.json`](../schema/conformance-report-1.0.schema.json).
The portable C3 attestation contract is published in
[`independent-assessment-1.0.schema.json`](../schema/independent-assessment-1.0.schema.json).
The current assessment-manifest alias is published as
[`requirements-manifest.json`](../requirements-manifest.json). Immutable
assessment manifests are retained under `../manifests/`; each report binds the
canonical digest of the exact assessment manifest used, not the alias path.
Within every assessment manifest, `normativeRegistryDigest` separately binds
the implementation-neutral profile, evidence-group coverage, and 218-row
requirement registry.
