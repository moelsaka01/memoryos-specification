# Architecture ambiguity register

This register prevents missing requirements from turning into accidental
architecture. An unresolved entry is not permission to choose the most
convenient option.

Status meanings:

- **Blocker**: dependent implementation or external activity must not proceed.
- **Open**: foundation work can continue, but affected contracts must remain
  provisional or absent.
- **Deferred**: explicitly outside the milestone; no implementation is allowed.

## Register

| ID | Status | Ambiguity | Required decision or evidence |
|---|---|---|---|
| CCA-A001 | Blocker | No project license, copyright holder, or inbound contribution terms are specified. | Authorized owner selects terms and records repository/documentation/artifact coverage before distribution or external contribution intake. |
| CCA-A002 | Blocker for compiler logic | The authoritative CCA specification, its owner, version, and change process are not provided. | Identify the normative specification and establish versioning and approval authority before language or semantic behavior is implemented. |
| CCA-A003 | Open | The directories are described as independent repositories, but the long-term topology is not defined. | Decide monorepo, superproject/submodules, or another integration model, including atomic change policy. |
| CCA-A004 | Open | Public API, ABI, and source-compatibility guarantees are not defined. | Select compatibility scope, supported consumers, deprecation policy, visibility, and versioning rules before promising stability. |
| CCA-A005 | Blocker for compiler logic | Compiler stage ordering, orchestration, intermediate representations, and failure propagation are unspecified. | Approve data contracts and control flow before one module calls another. |
| CCA-A006 | Blocker for generators | Artifact, documentation, conformance, and package formats and ownership are unspecified. | Approve schemas, normalization, versioning, and normative status before generators emit real outputs. |
| CCA-A007 | Open | Long-term diagnostic identifiers, source locations, serialization, localization, and stability are unspecified. | Define the diagnostic compatibility contract before consumers persist or compare diagnostics. |
| CCA-A008 | Open | Durable configuration format, schema, precedence, environment mapping, and compatibility are unspecified. | Approve configuration sources and precedence before file/environment loading is added. |
| CCA-A009 | Open | Dependency approval, pinning, update cadence, provenance, and license review policy are unspecified. | Adopt a supply-chain policy and approved dependency process. |
| CCA-A010 | Blocker for public community operation | Conduct contact, private reporting channel, enforcement authority, and appeal process are unspecified. | Project governance names responsible roles and a private channel before opening public participation. |
| CCA-A011 | Open | Cross-repository versioning and release coordination are unspecified. | Decide independent versus synchronized versions, compatibility matrix ownership, and release evidence. |
| CCA-A012 | Open | Supported compilers, minimum CMake/vcpkg revisions, and platform support windows are not fixed. | Publish and test a support matrix before making compatibility commitments. |
| CCA-A013 | Open | Coverage thresholds, warning policy, analyzer baseline, and required versus advisory CI checks are unspecified. | Establish measurable quality gates and exception handling. |
| CCA-A014 | Open | CLI spelling was requested only as commands "similar to" the examples; output text and exit-code compatibility are not normative. | Approve CLI grammar, stdout/stderr rules, exit codes, and stability policy before treating placeholders as a public protocol. |
| CCA-A015 | Open | Deterministic output requirements do not yet define paths, locale, timestamps, ordering, environment capture, or reproducible-build evidence. | Define normalized inputs and reproducibility rules before artifact generation. |
| CCA-A016 | Deferred | Security, privacy, threat, and trust models for future domain behavior are unspecified. | Perform dedicated architecture work before MemoryOS, AI, database, plugin, or network implementation. |
| CCA-A017 | Deferred | Plugin and network architectures are unspecified and explicitly excluded. | No decision is needed in this milestone; future work requires an approved architecture. |
| CCA-A018 | Deferred | MemoryOS boundaries and behavior are unspecified and explicitly excluded. | Do not implement MemoryOS in this or the recommended next milestone. |
| CCA-A019 | Open | Ownership boundaries for future TypeScript/React and Qt applications are not defined. | Decide frontend repositories, API boundaries, and support policy before adding frontend implementation. |
| CCA-A020 | Open | Generated-source policy and whether generated artifacts are committed are not specified. | Decide generator provenance, reproducibility, review, and source-control policy before real generation. |

## Decision procedure

For a blocker or open item:

1. cite the affected ID in the proposal;
2. list viable options, constraints, and consequences;
3. identify the authorized decision maker;
4. record the selected option and rationale in the architecture record;
5. update affected public contracts, tests, and examples;
6. only then implement dependent behavior.

Closing an ambiguity by changing code alone is invalid. If implementation and
[../ARCHITECTURE.md](../ARCHITECTURE.md) disagree, the implementation must stop
and be reconciled with the architecture.
