# MemoryOS CI 0.1.0 — Phase 1 foundation

Status: Phase 1 foundation under Contract Freeze 1 Correction A.
The original two-process blocker is preserved in engineering history. The
corrected Windows profile permits the supervisor, one active helper OR semantic
worker, and its owned Windows console host. A fourth process fails validation.
Foundation completion and evidence binding require the separate I1/B1 gates;
this package makes no final provider certification claim.

Private, offline, native Windows 11 x64 integration over the released JavaScript
SDK 1.1.0. There are no external production npm dependencies or install hooks.
Generic is FOUNDATION_IMPLEMENTED only after the Phase 1 conformance gate;
GitHub, GitLab, Jenkins and Azure remain NOT_IMPLEMENTED under MO-1306.
Provider module stubs reject execution and generation.

Use the pinned Node 24.21.0 executable by absolute path with exactly
`--max-old-space-size=128`, followed by the absolute `bin/memoryos-ci.mjs`.
Commands are `run --workspace <absolute-dir> --config <absolute-file>`,
`generate --config <absolute-file> --deployment <absolute-file> --output <new-dir>`,
and `verify --bundle <absolute-run-dir>`. Run optionally accepts
`--provider generic`. No PATH/npm shim is the certified launcher.

Configuration, result, evidence and deployment schemas are in `schemas/`.
The common contract is memoryos.cicd 1.0.0. Policy and Policy Set selection is
exclusive and requires a semantic digest pin. The candidate MIP and optional
baseline MIP are regular files inside the explicitly selected workspace.
Regression uses owner-bound SDK imports and captureRegressionPolicyFacts.
The CLI is an engineering oracle only.

Complete per-run bundles are under `.memoryos-ci/out/<UUID>/`; the completion
marker commits publication. Exit 0 means PASS, 6 FAIL, 7 COULD_NOT_EVALUATE.
Operational errors have closed codes and exits 10 through 17. Never treat an
incomplete directory as a result. The verifier checks exactly the bundle's
allowed files and their cross-links. No raw input or diagnostic log is bundled.

Only trusted shipped code executes. The operator must control the host and
grant exclusive workspace/output write access for each invocation. Lexical
checks, Windows reparse attribute checks and snapshot consistency checks are
mandatory. This is not a kernel sandbox or protection against a privileged
concurrent host writer. Network hooks deny trusted-code network routes; they
are not an OS firewall. Child environment contains only SystemRoot and WINDIR.
No provider credentials are needed or inherited. A caller that preloads code
before this entry point has already crossed the trusted-launch boundary.

Fixed ceilings are in contracts/limits.json: semantic execution at most 60 s,
overall at most 75 s including the 2 s cleanup reserve, one active direct child
and at most three attributable roles including its console host, no queue or
retry. Heap caps are V8 limits, not an OS RSS reservation. Engineering resource
measurements and actual certification scope are recorded separately.

Generic generation emits canonical configuration plus its manifest into a new
directory. It never overwrites existing output. Provider-specific workflow
generation, hosted execution and final release certification are future work.
The Phase 2 interface manifest lives in the engineering conformance tree.

Install only an externally trusted archive, offline with an empty explicit
cache, ignore-scripts, no-audit and no-fund. Verify the distribution before
execution. The package cannot establish its own origin against a malicious
replacement; archive/configuration pins must come from the trusted operator.

Node/libuv injects a fixed Windows environment list when values are omitted.
The supervisor deletes those fixed non-allowlisted parent names before
spawn without reading their values. The child environment is independently checked after actual Windows spawn.

Headless engineering launch uses Windows DETACHED_PROCESS for the Node
supervisor with redirected private pipes. The PowerShell helper remains
non-detached. Console-owning launches that add a fourth attributable process
fail the profile; do not exclude console hosts from resource accounting.
