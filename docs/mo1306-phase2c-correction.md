# MO-1306 Phase 2C correction and completion

## Scope and history

B1 is `dbafc0061aa493da2517ee5564f9ea6adb90f52d`. Original Phase 2C is
`e1c990bf65d0c7925a68eea8222cd304f8ce6db6`, retained without amendment.
It was an incomplete adapter foundation, not final PASS evidence. This correction
is exclusively on `mo1306/phase2c`; it does not integrate 2A/2B or start 2D.

The read-only main source-gate diagnostic and preflight are retained, with source
paths and hashes, under `repositories/cca-conformance/evidence/mo1306/phase2c/`.
Comparison with the freeze, interfaces, original generator and original small
test independently confirms all five reported GitHub defects: absent frozen Node
bootstrap, unconditional `complete=false`, absent `run-id`, directory-wide upload,
and tests that did not establish those requirements. Original Azure tests also
lacked retained pinned schema bytes/provenance, full-schema and independent subset
validation. These old observations are not relabelled as successful evidence.

## Corrected GitHub contract

The generated artifact is `.github/workflows/memoryos-ci.yml`.
It is a separate workflow named `MemoryOS Provider-Neutral CI`, with job
`memoryos_ci` / `MemoryOS CI`, `windows-2022`, ten-minute timeout, manual
`workflow_dispatch` only, and exactly `contents: read`. No secrets, PR trigger,
fork trigger, reusable workflow, cache, SDK or extra step is introduced.
The closed six-step sequence is tools, data, bootstrap, evaluate, upload, gate.

Trusted tooling is checked out at a reviewed immutable revision; candidate data is
checked out separately at `github.sha`. Both disable persistent credentials, LFS
and submodules. Actions remain pinned to:

- checkout: `3d3c42e5aac5ba805825da76410c181273ba90b1`
- upload-artifact: `043fb46d1a93c77aae656e7c1c64a875d1fc6a0a`

Exact action metadata, source URLs, lengths and hashes are retained in the
`fixtures/mo1306-phase2c/actions` inventory. No bootstrap action was added. This
is immutable metadata revalidation, not a fresh complete advisory audit or action
runtime certification; those remain Phase 3B.

`Initialize-GitHubCI.ps1` implements the frozen Node 24.21.0 win-x64 ZIP bootstrap,
not PATH Node. ZIP length is 37,618,919 bytes and SHA-256 is
`158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541`.
The selected `node.exe` is 93,580,104 bytes with SHA-256
`ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`.
Acquisition forbids redirects/proxy reuse; extraction checks archive entries,
collisions, traversal and substituted file types. Runtime version, architecture,
configuration and distribution identities are verified before handoff. Offline
tests exercise the exact production extraction statements with the retained real
ZIP and hostile archives; no hosted HTTP/bootstrap certification is claimed.

Evaluation captures the real common summary and original process exit, then
independently verifies the complete publication, result hash, provider, metadata,
configuration pin and distribution pin. Only verified complete bundles produce
`complete=true` and a UUID `run-id`. PASS, FAIL and COULD_NOT_EVALUATE retain exits
0, 6 and 7; complete operational-error bundles retain their common error exits.
Incomplete, mismatched or invalid evidence cannot acquire completion authority.
The always-run gate rechecks the bundle, propagates the original common exit,
rejects unavailable evaluation and treats upload failure as publication failure.

`GITHUB_RUN_ID` maps only to `evidence.metadata.runId`. The output `run-id` is the
common runner's publication UUID, not the GitHub numeric run ID. Provider metadata
does not enter normative MemoryOS identities; changed metadata is tested against
identical normative fixture bytes.

Upload names exactly six literal basenames in the verified UUID directory:
`evaluation-identity.json`, `memoryos-ci-artifacts.json`,
`memoryos-ci-complete.json`, `memoryos-ci-evidence.json`,
`memoryos-ci-result.json`, and `policy-outcome.json`. Operational bundles have only
the four common files. Before publishing completion, verification requires the
exact applicable set and rejects extra/nested entries, case confusion, traversal,
links/reparse substitution and mismatched hashes/run identities. No directory glob
is uploaded. Filesystem checks are fail-closed but not a claim of an OS-level
immutable snapshot against an independently privileged concurrent attacker.

The independent workflow validator uses a strict safe YAML AST, closed ordered
objects, exact scalar types, fixed expression positions, literal expected script
contracts, and native PowerShell AST checks. Its mutation corpus tests structure,
trust, pins, expressions, script injection, encoding and artifact boundaries.
Pure adapter tests, real wrapper execution, bootstrap execution and public CLI
generation complement it; they do not substitute substring tests for structure.

GitHub status: IMPLEMENTED, HOSTED_EXECUTION_CERTIFICATION_PENDING. Phase 3A alone
can establish hosted execution certification.

## Azure schema and restricted subset

The exact engineering schema is `microsoft/azure-pipelines-vscode`, commit
`9e40e814abd20917f273dd587497086f0476a563`, path `service-schema.json`.
Retained length is 1,640,523 bytes; SHA-256 is
`f00a9630f6550204148634d9a13f634b5750a225559886effe09a751482f0459`.
Draft-07 and upstream comment `v1.261.1` are recorded. The upstream `$id` containing
`main` is an identifier only, never the acquisition/resolution authority. Exact
bytes and MIT license notice are retained with acquisition provenance.

The unmodified Microsoft editor schema describes boolean and numeric YAML scalar
lexemes as strings. Full-schema validation therefore uses a separately parsed
safe lexical AST representation; the independent restricted subset simultaneously
requires actual YAML boolean/integer types where frozen. This is not a weakened
schema or conversion of arbitrary data into accepted values. All 698 references
resolve locally. Behavioral `firstProperty` and `ignoreCase` assertions are
implemented and separately tested; editor annotation keywords have no behavioral
authority. Socket access is disabled during ordinary Python validation.

The independent strict parser rejects duplicates, aliases, anchors, tags, unsafe
scalars, unknown fields and noncanonical layout. The closed Azure pipeline fixes
trigger/pr to none, a Windows-demand pool, one five-minute job with one-minute
cancellation timeout, protected Node/home/config variables, exact launcher and
configuration/distribution pins, exit propagation and local-only publication.
Native PowerShell AST parsing and the focused negative corpus supplement the full
schema. No Azure service/API/task dependency is needed or introduced.

All eleven common classifications are checked against independently enumerated
projections, including configuration/input/integrity, timeout and cancellation.
Native Windows cases additionally cover Policy PASS/FAIL/CNE, PolicySet, regression,
metadata changes, missing input and semantic integrity rejection. Actual normative
bytes are compared with frozen common fixtures or the unchanged SDK oracle.

Azure status: IMPLEMENTED, CONTRACT_VALIDATED, NOT_LIVE_PROVIDER_CERTIFIED.

## Phase 2D reconciliation notes

No Phase 2A or 2B implementation bytes were copied. Necessary B1-relative shared
overlaps are explicit:

- `src/generator.mjs`: full normalized deployment validation and safe own-property
  dispatch for generic/Azure/GitHub; no GitLab/Jenkins implementation. Its imported
  `src/generated-structure.mjs` parses bounded typed ordered YAML and enforces the
  closed inventoried grammar before any generation manifest or file publication.
  Engineering mutation tests include non-ASCII indentation, not merely text
  matching against the renderer.
- `bin/memoryos-ci.mjs`: fixed nested generated artifact paths, staged verification,
  manifest-last moves and existing no-overwrite behavior.
- `scripts/Invoke-MemoryOSCI.ps1`: provider selection, fixed Node/package pins,
  clearing Node injection variables, captured exit/summary and verified result
  handoff through PowerShell success output (so nested wrappers can capture it).
- `scripts/verify-provider-result.mjs`: bounded stdin summary parsing and common
  result/publication identity verification, with no semantic recomputation.
- `src/core.mjs`: selected implemented adapter, fixed operational metadata mapping,
  provider-aware installation and evidence adapter identity.
- `src/integrity.mjs` and `src/verification.mjs`: per-adapter closure/template
  identities and selection when verifying a provider bundle.
- `package.json`, `contracts/contract.json`, `distribution-manifest.json`: include
  fixed templates and mechanically refresh the branch-local package inventory.
- The common contract test no longer labels implemented Azure/GitHub unsupported;
  GitLab/Jenkins remain unsupported on this B1-relative branch.

Phase 2D must reconcile these surfaces with 2A/2B and recompute the final integrated
distribution. Retained generated workflows are engineering contract fixtures
pinned to the existing original 2C revision; that revision does not contain this
correction. They are NOT deployable certification candidates until regenerated
using an existing reviewed corrected/integrated commit and its matching pins.
No workflow has been installed in the repository's live `.github` directory.

## Evidence and verification

`evidence/mo1306/phase2c/acceptance.json` mechanically binds the original source-gate
diagnostics, package sources, independent tools/corpora, schema/provenance, action
inventory, generated artifacts, native bundles, suite receipts and this document.
`tools/mo1306-phase2c/evidence.py verify --post-commit` validates bound hashes,
history, required gates and clean exact child-commit state. Per-suite receipts are
the authority for exact test counts; unrelated totals are not inflated by counting
the same fixture in multiple wrappers. Failed engineering attempts are retained
separately, not overwritten or relabelled PASS.

The test host initially blocked script execution with Restricted ExecutionPolicy;
the engineering parent PowerShell process now uses a process-only Bypass flag.
No machine policy was changed and generated production commands were not given
new policy overrides. The outer test environment also supplies a fixed `PATHEXT`:
without this Windows PowerShell prerequisite, an `.exe` invocation can return no
native exit code. The shared launcher now explicitly rejects missing/stale native
exit or summary values, preventing an empty execution from projecting success.
Offline bootstrap harness attempts also record their test
setup corrections. These are distinguished from final successful runs.
Independent review then exposed non-ASCII indentation accepted by the new
production parser. The in-flight native validation runs bound to the preceding
package identity were stopped, their partial records retained, and both offending
indentation forms added as rejection tests. Those interruptions are not product
cancellation witnesses or final PASS evidence. Final acceptance selects only the
complete native cases bound to the corrected distribution identity.

Production dependencies remain zero. Engineering Python/YAML/jsonschema wheels
reuse exact frozen lock identities, are outside the production graph, and are
validated offline after separately authorized acquisition. Native tests use the
frozen verified Node executable. MO-1302 workflows, historical identities and
released runtime semantics are unchanged; targeted regressions and workspace
verification are recorded. No provider account, Azure subscription, hosted run,
Linux/Ubuntu/WSL or VM is used. No merge, push or tag is performed.

The next task after successful completion is **MEMORYOS 1.3 MO-1306 PROVIDER-NEUTRAL
CI/CD INTEGRATION PHASE 2D INTEGRATION RETRY**.
