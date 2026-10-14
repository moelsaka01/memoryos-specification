# MemoryOS CI 0.1.0 — Phase 2 integration

Status: integrated implementation under Contract Freeze 1 Correction A.
The original two-process blocker is preserved in engineering history. The
corrected Windows profile permits the supervisor, one active helper OR semantic
worker, and its owned Windows console host. A fourth process fails validation.
Phase 1 remains bound to I1/B1. Phase 2 acceptance and binding are recorded
separately in the conformance tree; final certification belongs to Phase 3.

Private, offline, native Windows 11 x64 integration over the released JavaScript
SDK 1.1.0. There are no external production npm dependencies or install hooks.
Exactly generic, GitLab, Jenkins, Azure and GitHub are implemented through
the same provider-neutral core. The engineering capability authority is
`repositories/cca-conformance/mo1306-phase2-capabilities.json`; its validated
state is established by the separate Phase 2 conformance gate. Hosted GitHub
certification and final generic certification remain Phase 3 work. GitLab,
Jenkins and Azure have no live-provider certification.

Use the pinned Node 24.21.0 executable by absolute path with exactly
`--max-old-space-size=128`, followed by the absolute `bin/memoryos-ci.mjs`.
Commands are `run --workspace <absolute-dir> --config <absolute-file>`,
`generate --config <absolute-file> --deployment <absolute-file> --output <new-dir>`,
and `verify --bundle <absolute-run-dir>`. Run optionally accepts
`--provider generic|gitlab|jenkins|azure|github`. No PATH/npm shim is the certified launcher.

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

Generation emits canonical configuration, its manifest, and for each of the
four named providers the fixed definition into an exclusively new directory. It never
overwrites existing output. The Phase 2 interface manifest lives in the
engineering conformance tree. Phase 2D records integrated packaging;
GitHub hosted certification belongs to Phase 3A.

Azure provisioning requires an existing trusted Windows pool and the three
ordinary nonsecret protected variables MEMORYOS_CI_NODE, MEMORYOS_CI_HOME,
MEMORYOS_CI_CONFIG, each an absolute path to the pinned runtime, verified
package, and trusted common configuration. Restrict definitions and variables
to trusted jobs/branches. Generated Azure files publish evidence locally only.
Offline schema/subset validation needs no Azure account, organization or pool.

GitHub uses manual dispatch, windows-2022 and contents: read. Generate using a
reviewed existing toolRevision containing this implementation, its corresponding
distribution digest, and the trusted configuration path. The tool repository
must be this workflow repository or an existing public repository. Keep the
workflow and tool/configuration revisions protected by review. Candidate data
is checked out separately and never executed. The fixed bootstrap downloads
only the frozen Node ZIP from nodejs.org, verifies its bytes and extraction,
and supplies the absolute verified Node capability. Completed verified bundles
(six semantic files or four operational files) are uploaded by explicit
basenames; the final gate re-verifies the original common exit. Generated
engineering examples pinned to the earlier source commit are contract fixtures,
not ready-to-install deployments until Phase 2D supplies matching reviewed pins.

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
