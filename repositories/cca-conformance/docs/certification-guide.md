# MemoryOS Certification Guide

## Purpose

This informative guide explains how to turn deterministic conformance evidence
into a MemoryOS assessment. It does not grant certification and does not add to
the normative procedure in CCA-MEMORYOS-1.0 `certification.md`.

## Assessment levels

| Level | Meaning | Claim permitted |
| --- | --- | --- |
| C0 — Identified | The target and governing versions are identified before assessment begins. | Pre-assessment registration only; no report or conformance claim |
| C1 — Assessed | Every requirement has a result and attributable evidence. | Assessment only |
| C2 — Conformant | Every required result is `PASS`. | `CCA-MEMORYOS-1.0 Conformant` |
| C3 — Independently Verified | An independent assessor reproduced or reviewed the complete C2 evidence. | `CCA-MEMORYOS-1.0 Independently Verified` |

`C0` is not a conformance-report level. It is a pre-assessment registration
state used before a complete requirement matrix exists. Machine-readable
conformance reports use only `C1`, `C2`, or `C3`.

The bundled Reference Implementation report is a C2 assessment. The suite does
not self-award C3 because its report generator deliberately records the bundled
assessment as non-independent.

## Complete assessment procedure

1. Identify the implementation, implementation version, MemoryOS Standard,
   conformance specification, suite, Runtime Foundation, MIP publication, and
   native projection profile under assessment.
2. Freeze an assessment-specific manifest containing the implementation's own
   versioned inputs, executions, and exact criterion selectors, then retain it
   by canonical content digest together with the evidence root.
3. Run the complete deterministic evidence set from clean, versioned inputs.
4. Record one result for every direct and incorporated normative requirement.
5. Treat missing, stale, non-attributable, or irreproducible evidence as
   `FAIL`.
6. Retain the canonical evidence bytes at a content-addressed location and
   record their exact SHA-256 digest in the machine-readable report.
7. Validate the machine-readable report, its exact evidence-byte binding, and
   all durable evidence references.
8. For C3, have an identified independent assessor reproduce or review the
   complete C2 evidence set after the source assessment. The independent
   assessor identity must differ from the source assessor identity.

The complete CCA-MEMORYOS-1.0 assessment contains 218 rows: 114 direct
MemoryOS requirements, 40 incorporated CCA-RF-1.0 requirements, and 64
incorporated CCA-MIP-1.0 requirements. `NOT APPLICABLE` is not permitted in a
complete claim.

## Scoped assessments

A scoped assessment names every profile it covers and reports all requirements
applicable to those profiles. It may use `NOT APPLICABLE` only with a factual,
non-empty applicability reason. A scoped report must not present itself as
complete MemoryOS conformance.

The normative requirement and evidence-group registry is implementation-neutral.
Each assessed implementation supplies its own concrete manifest bindings; it is
not required to reproduce the Reference Implementation's repository paths,
commands, execution identifiers, or selectors. Each manifest records the same
`normativeRegistryDigest`, computed only from profile applicability,
evidence-group requirement coverage, and the complete normative requirement
projection.

## Reproduction

From the workspace root, run the official suite:

```console
npm --prefix repositories/cca-conformance test
```

For an adjacent authoritative publication, set `MEMORYOS_STANDARD_ROOT` to the
published `CCA-MEMORYOS-1.0` directory before executing the suite. Native
Runtime and SDK evidence is registered under the `memoryos-standard` CTest
label in a configured workspace build.

Validate the bundled report with:

```console
npm --prefix repositories/cca-conformance run report:validate
```

For C3, use `tools/independent-assessment.mjs` to bind an identified
independent review or reproduction to the canonical source-evidence bytes and
all requirement results, then emit a new C3 report. The tool accepts only a C2
source report and records a date no earlier than that source assessment. The retained artifact
conforms to
[`independent-assessment-1.0.schema.json`](../schema/independent-assessment-1.0.schema.json).

See [the report guide](conformance-report.md) for report fields and
[the Reference Implementation guide](reference-implementation-guide.md) for
the assessed component map.

## Claim discipline

A passing test run is evidence, not a certification decision. A later report
supersedes an earlier report by reference; it never rewrites prior evidence.
Version equality, use of the Reference Implementation, or use of this suite is
not by itself proof of conformance.
