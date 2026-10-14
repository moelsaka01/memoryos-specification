# Architecture ambiguity register

This register prevents missing requirements from turning into accidental
architecture. An unresolved entry is not permission to choose the most
convenient option.

Status meanings:

- **Blocker**: dependent implementation or external activity must not proceed.
- **Open**: foundation work can continue, but affected contracts must remain
  provisional or absent.
- **Deferred**: explicitly outside the milestone; no implementation is allowed.
- **Resolved for IS-002**: the increment records a scoped decision; broader
  future behavior may still require a new decision.
- **Resolved for CCA-MEMORYOS-1.0**: the MemoryOS Standard records a scoped
  decision; broader CCA governance remains open.

## Register

| ID | Status | Ambiguity | Required decision or evidence |
|---|---|---|---|
| CCA-A001 | Blocker | No project license, copyright holder, or inbound contribution terms are specified. | Authorized owner selects terms and records repository/documentation/artifact coverage before distribution or external contribution intake. |
| CCA-A002 | Resolved for IS-002 | Canonical source authority and version were previously absent. | Canonical Specification 1.0 schema and architecture are the approved IS-002 contracts; broader CCA semantic governance remains future work. |
| CCA-A003 | Open | The directories are described as independent repositories, but the long-term topology is not defined. | Decide monorepo, superproject/submodules, or another integration model, including atomic change policy. |
| CCA-A004 | Open | General CCA public API, ABI, and source-compatibility guarantees are not defined. | Select compatibility scope, supported consumers, deprecation policy, visibility, and versioning rules before promising stability outside the CCA-MEMORYOS-1.0 behavioral contracts. |
| CCA-A005 | Resolved for IS-002 | Pipeline ordering and failure propagation were previously unspecified. | The architecture fixes Load through Generate Reports with typed stage results and error blocking. |
| CCA-A006 | Resolved for IS-002 | Initial documentation/report outputs were previously unspecified. | The fixed seven-file bundle is approved; conformance, packages, and production code remain excluded. |
| CCA-A007 | Resolved for IS-002 | Diagnostic structure and ordering were previously unspecified. | IS-002 fixes identifier, code, severity, message, suggestion, location, category, and deterministic order. |
| CCA-A008 | Open | Durable configuration format, schema, precedence, environment mapping, and compatibility are unspecified. | Approve configuration sources and precedence before file/environment loading is added. |
| CCA-A009 | Open | Dependency approval, pinning, update cadence, provenance, and license review policy are unspecified. | Adopt a supply-chain policy and approved dependency process. |
| CCA-A010 | Blocker for public community operation | Conduct contact, private reporting channel, enforcement authority, and appeal process are unspecified. | Project governance names responsible roles and a private channel before opening public participation. |
| CCA-A011 | Resolved for CCA-MEMORYOS-1.0 | MemoryOS Standard, Reference Implementation, MIP, Core, adapter, SDK, CLI, report, Explorer, and conformance-suite versions previously lacked a governed relationship. | CCA-MEMORYOS-1.0 now requires independent identities and an explicit assessed compatibility matrix. Cross-repository coordination outside that MemoryOS baseline remains open. |
| CCA-A012 | Open | Supported compilers, minimum CMake/vcpkg revisions, and platform support windows are not fixed. | Publish and test a support matrix before making compatibility commitments. |
| CCA-A013 | Resolved for IS-002 | The compiler quality threshold was previously unspecified. | CI enforces warnings-as-errors, format/static-analysis checks, and at least 90% line coverage; exception governance remains future work. |
| CCA-A014 | Resolved for IS-002 | Compiler command grammar and output were previously provisional. | `validate`, `analyze`, `compile`, and `report`, JSON stream rules, options, and exit statuses are documented in `docs/cli.md`. |
| CCA-A015 | Resolved for IS-002 | Output normalization was previously unspecified. | IS-002 fixes lexical ordering, JSON member order, generic displayed paths, and exclusion of clock, locale, randomness, host, and network state. |
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
