# MemoryOS Conformance Suite

This repository contains the official deterministic assessment harness for
CCA-MEMORYOS-1.0. It turns versioned product inputs, executable checks, and
explicit review decisions into attributable evidence and an immutable
conformance report. The published MemoryOS Standard remains authoritative.

MemoryOS v1.2.1 is the corrected Reference Implementation baseline. The
v1.2.0 assessment artifacts remain immutable historical evidence and are not
overwritten or relabeled by this assessment.

The suite verifies observable behavior and compatibility. It does not define
MemoryOS behavior and contains no Runtime, Investigation Core, MIP, adapter,
SDK, CLI, Cognitive Regression, or Explorer implementation logic.

## What the suite covers

An assessment-specific manifest binds an implementation's evidence selectors
to an implementation-neutral normative registry covering all 114 direct
MemoryOS requirements, 40 incorporated CCA-RF-1.0 requirements, and 64
incorporated CCA-MIP-1.0 requirements. Evidence is organized around:

- Runtime ordering and lifecycle determinism;
- Investigation lifecycle and single-Core authority;
- native investigation artifacts and the declared Observation projection;
- canonical MIP validation, integrity, and compatibility;
- AI Runtime Adapter translation boundaries;
- SDK and CLI behavior and language-boundary parity;
- Cognitive Regression and Cognitive Investigation Explorer behavior;
- Standard publication identity and requirement traceability; and
- conformance evidence and report integrity.

No check treats pixels, layout, timing, randomized values, generated prose, or
implementation-private state as cognition.

## Prerequisites

The complete Reference Implementation assessment requires:

- Node.js 20 or newer;
- Python 3.12 or newer;
- CMake 3.28 or newer plus the workspace's configured C++23 toolchain and
  dependencies;
- the adjacent authoritative publication at
  `../cca-specifications/specifications/CCA-MEMORYOS-1.0/`; and
- clean, versioned source inputs and new output paths for every retained
  assessment artifact.

The JavaScript runner resolves Python from `MEMORYOS_CONFORMANCE_PYTHON`,
`Python3_EXECUTABLE`, or `PYTHON`, then from `python3` or `python`. It fails
closed when no usable interpreter is available. The Runtime and C++ SDK tests
must be built for complete C2 evidence. The boundary suite also uses Python,
so the complete JavaScript suite is not dependency-free.

## Run the registered suites

From the workspace root, configure and build the workspace, then run every
test carrying the conformance label:

```console
cmake --preset ci
cmake --build --preset ci
ctest --preset ci -L memoryos-standard
```

After the retained review, evidence, and report artifacts described below
exist, run the deterministic JavaScript package runner with an explicit Python
interpreter when necessary:

```console
MEMORYOS_CONFORMANCE_PYTHON=/absolute/path/to/python npm --prefix repositories/cca-conformance test
```

On PowerShell:

```powershell
$env:MEMORYOS_CONFORMANCE_PYTHON = 'C:\absolute\path\to\python.exe'
npm --prefix repositories/cca-conformance test
```

The package runner inventories and executes these eleven `*_test.mjs` files in
lexical order with deterministic environment settings and no concurrency:

- `boundary_contract_conformance_test.mjs`
- `compatibility_conformance_test.mjs`
- `component_evidence_conformance_test.mjs`
- `coverage_gap_conformance_test.mjs`
- `independent_assessment_conformance_test.mjs`
- `normative_vectors_conformance_test.mjs`
- `reference_implementation_conformance_test.mjs`
- `report_conformance_test.mjs`
- `requirement_selector_catalog_test.mjs`
- `schema_validation_conformance_test.mjs`
- `specification_conformance_test.mjs`

## Reproduce the Reference Implementation assessment

The following flow creates a new Reference Implementation assessment. It does
not overwrite an earlier assessment. Run all commands from the workspace root
and replace placeholders with explicit local values.

1. Rebuild the Reference Implementation assessment manifest from the authoritative
   publications and current versioned product inputs. This refreshes the current
   `requirements-manifest.json` alias and retains an immutable content-addressed
   copy under `manifests/`. The builder requires both repositories to be clean,
   verifies the approved specifications commit, and rejects non-LF declared text
   inputs. If the clean publication worktree is not at the default adjacent path,
   set `MEMORYOS_STANDARD_ROOT` to its exact `CCA-MEMORYOS-1.0` directory.

   ```console
   npm --prefix repositories/cca-conformance run manifest:build
   ```

2. Complete `repositories/cca-conformance/review-outcomes.input.json` with an
   identified reviewer, assessment date, immutable reviewed revision, and an
   explicit outcome for every non-automated requirement. Retain the canonical
   review artifact at its versioned path.

   ```console
   node repositories/cca-conformance/tools/create-review-attestations.mjs --manifest /absolute/path/to/requirements-manifest-sha256-DIGEST.json --input repositories/cca-conformance/review-outcomes.input.json --output repositories/cca-conformance/evidence/reference-implementation-review-1.2.1.json
   ```

3. Execute the complete suite from a new native build directory and retain the
   resulting evidence artifact. The runner configures and builds the exact
   `cca_core_tests` and `memoryos_sdk_cpp_tests` targets itself. It publishes
   the canonical bytes at both the versioned alias shown below and an immutable
   `reference-implementation-1.2.1-sha256-<64hex>.json` filename; the two files
   must remain byte-identical.

   ```console
   node repositories/cca-conformance/tools/run-reference-evidence.mjs --manifest /absolute/path/to/requirements-manifest-sha256-DIGEST.json --cmake /absolute/path/to/cmake --ninja /absolute/path/to/ninja --cxx /absolute/path/to/cxx-wrapper --ar /absolute/path/to/ar-wrapper --ranlib /absolute/path/to/ranlib-wrapper --compiler /absolute/path/to/compiler --gtest-root /absolute/path/to/gtest --build-dir /new/absolute/build/path --python /absolute/path/to/python --reviews repositories/cca-conformance/evidence/reference-implementation-review-1.2.1.json --assessor "ASSESSOR" --date YYYY-MM-DD
   ```

   The CMake, Ninja, compiler, compiler wrappers, and GoogleTest root are
   explicit assessed inputs. `--build-dir` must name a path that does not yet
   exist; the runner creates it and records the controlled native builds.

4. Generate the canonical JSON report and its Markdown projection from that
   retained evidence.

   ```console
   node repositories/cca-conformance/tools/conformance-report.mjs generate repositories/cca-conformance/evidence/reference-implementation-1.2.1.json repositories/cca-conformance/reports/reference-implementation-1.2.1.json repositories/cca-conformance/reports/reference-implementation-1.2.1.md "MemoryOS Reference Implementation" 1.2.1 "ASSESSOR" YYYY-MM-DD evidence/reference-implementation-1.2.1.json cca-studio-native-observation 1.1.0 /absolute/path/to/requirements-manifest-sha256-DIGEST.json
   ```

5. Validate the retained report and its exact evidence binding.

   ```console
   node repositories/cca-conformance/tools/conformance-report.mjs validate repositories/cca-conformance/reports/reference-implementation-1.2.1.json /absolute/path/to/requirements-manifest-sha256-DIGEST.json
   npm --prefix repositories/cca-conformance test
   ```

   When the manifest argument is omitted from bundled report validation, the
   validator derives the immutable content-addressed manifest filename from
   the report's embedded `manifestDigest`; it never validates against the
   mutable current alias.

6. For a later C3 assessment, independently review or reproduce the complete
   C2 evidence, then create a new independent-assessment artifact and C3 report
   at new paths:

   The authoritative published `CCA-MEMORYOS-1.0` package must either be
   adjacent to the workspace at its standard location or be supplied through
   `MEMORYOS_STANDARD_ROOT`. Both the assessment and normative manifests are
   validated against that publication before any artifact is accepted.

   ```console
   node repositories/cca-conformance/tools/independent-assessment.mjs create --manifest /exact/content-addressed/assessment-manifest.json --normative-manifest /authoritative/content-addressed/normative-manifest.json --source-report repositories/cca-conformance/reports/reference-implementation-1.2.1.json --evidence repositories/cca-conformance/evidence/reference-implementation-1.2.1.json --assessment-output /new/assessment.json --assessment-reference evidence/independent-assessment.json --report-output /new/c3-report.json --assessor "INDEPENDENT ASSESSOR" --date YYYY-MM-DD --method reviewed
   node repositories/cca-conformance/tools/independent-assessment.mjs validate --manifest /exact/content-addressed/assessment-manifest.json --normative-manifest /authoritative/content-addressed/normative-manifest.json --report /new/c3-report.json --evidence repositories/cca-conformance/evidence/reference-implementation-1.2.1.json --assessment /new/assessment.json
   ```

The review, evidence, and report tools use exclusive creation for retained
outputs. Use a new versioned artifact path for a later assessment; never
rewrite published evidence. Pre-publication report builder and validator
fixtures are part of the retained specification execution. Validation of the
newly generated final report is a separate mandatory post-generation gate, so
the report is never used as evidence for its own creation.

## Create or validate a portable C1/C2 report

Another implementation supplies its own content-addressed assessment manifest
and the authoritative manifest whose normative registry projection is used to
verify the implementation-neutral requirements. Create a canonical report at
a new path:

The authoritative published `CCA-MEMORYOS-1.0` package must either be adjacent
to the workspace at its standard location or be supplied through
`MEMORYOS_STANDARD_ROOT`. Portable creation and validation fail closed when the
publication is unavailable or does not authenticate the normative manifest.

```console
node repositories/cca-conformance/tools/portable-report.mjs create --manifest /exact/content-addressed/assessment-manifest.json --normative-manifest /authoritative/content-addressed/normative-manifest.json --evidence /exact/evidence.json --evidence-reference evidence/implementation-version.json --output /new/conformance-report.json --profiles complete
```

Use a comma-separated, lexically ordered list of published profile names in
place of `complete` for a scoped assessment. Validate the retained bytes with
the same manifest and evidence bindings:

```console
node repositories/cca-conformance/tools/portable-report.mjs validate --manifest /exact/content-addressed/assessment-manifest.json --normative-manifest /authoritative/content-addressed/normative-manifest.json --evidence /exact/evidence.json --evidence-reference evidence/implementation-version.json --report /new/conformance-report.json
```

The tool derives implementation identity, assessor, date, status, and any
native projection profile only from retained evidence. It emits C1 when any
applicable requirement fails and C2 only when every applicable requirement
passes. It never rewrites an existing report.

## Requirement selectors

`tools/requirement-selector-catalog.mjs` is the single criterion-level selector
catalog used by manifest generation and evidence attribution. Every automated
requirement maps to an exact execution identifier, source path, and selector.
Review requirements deliberately have no executable selector: an unrelated
passing test cannot replace a required human review.

For an explicit adjacent-publication check, set `MEMORYOS_STANDARD_ROOT` to the
published `CCA-MEMORYOS-1.0` directory and run the specification suite.

## Artifacts and schemas

- `requirements-manifest.json` is the current assessment-manifest alias. Each
  assessment manifest binds the frozen publications and requirement/evidence-group
  registry to the assessed implementation's own inputs, executions, and selectors.
  `normativeRegistryDigest` commits the implementation-neutral profile,
  evidence-group coverage, and complete 218-row normative registry while
  excluding those implementation-specific bindings.
  Immutable copies are retained as
  `manifests/requirements-manifest-sha256-<64hex>.json`; reports bind the exact
  canonical manifest digest rather than the mutable alias path.
- `review-outcomes.input.json` is the assessor-completed source for retained
  review attestations.
- `evidence/` contains immutable machine-readable review and execution
  evidence once materialized. Reference evidence is retained under a
  content-addressed `reference-implementation-1.2.1-sha256-<64hex>.json`
  filename, with `reference-implementation-1.2.1.json` as a byte-identical
  convenience alias. Reports bind the exact canonical evidence digest, so the
  alias cannot substitute different valid evidence.
- `reports/` contains the immutable JSON conformance report and its generated
  Markdown projection once materialized.
- `schema/` publishes the manifest, review, evidence, report, and independent
  assessment JSON contracts.
- `tools/json-schema-validator.mjs` independently validates the published
  Draft 2020-12 contracts in addition to the semantic conformance validators.
- `tools/portable-report.mjs` creates and validates portable C1/C2 reports
  against an assessment-specific manifest and authoritative normative registry.
- `docs/` explains certification, compatibility, versioning, report fields,
  and the Reference Implementation map.

A report uses exactly `PASS`, `FAIL`, or `NOT APPLICABLE` for requirement
results. Missing, stale, non-attributable, or irreproducible evidence is a
failure. A passing test run is necessary evidence, not authorization to make a
certification claim. See [the certification guide](docs/certification-guide.md)
and [the conformance report guide](docs/conformance-report.md).
