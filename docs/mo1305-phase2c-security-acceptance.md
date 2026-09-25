# MO-1305 Phase 2C security acceptance

Phase 2C owns security/adversarial acceptance and interoperability in the dedicated
`cca-mo1305-2c` worktree on `mo1305/phase2c`. The verified clean baseline is
`b6c397b99e1f8bfcd04be972f35069f8737a4137`. The machine-readable acceptance result
is [the Phase 2C index](../repositories/cca-conformance/evidence/mo1305-phase2c/index.json).
It is independently revalidated from the retained artifacts, without launching
a gateway or requiring the local `.cache` directory:

```powershell
node repositories/cca-conformance/tools/mo1305-phase2c/runner.mjs verify
```

The current checker rehashes the production distribution, SDK closure, fixture
inputs, contracts, FINAL limits, harness, regression implementations/fixtures and authority inputs. It verifies the
frozen case catalog, module/attempt references, exact gateway status mappings,
process exit records, category records, exact regression commands/source membership/counts,
regression logs and original Windows
host-event classification. Changing relevant inputs intentionally invalidates
a receipt; a PASS string alone is insufficient. The evidence validator has
76 passing tests, including negative tests for weakened or malformed evidence.

## Accepted result

The final acceptance index is PASS: seven modules, 437 records, 23 error-code
mappings, 76 validator tests, and 19 category receipts. The 437 module records
comprise 429 security/interoperability checks and eight regression-group records
containing 283 passing leaf tests, with zero failed or skipped leaf tests. These
counts are reported separately to avoid double-counting regression groups.

| Module | Accepted records |
| --- | ---: |
| transport | 164 |
| capabilities | 141 |
| interop | 51 |
| resources | 45 |
| dispatch | 23 |
| startup | 5 |
| regressions | 8 |

Every accepted module has a NORMAL window with AVAILABLE Windows event evidence;
there are zero HOST_INTERRUPTED attempts. The two missing-test-dependency failures
below remain FAIL and are excluded from accepted counts. This run used Windows
11 Home 25H2, build 10.0.26200.9457, x64, and the pinned Node 24.21.0 executable.
The registry's legacy ProductName string is retained verbatim in receipts beside
the actual OS version, rather than silently rewriting either value.

The final read-only checker validates all 19 category receipts, including all
23 frozen status/wire mappings. Nineteen codes have current wire or cancellation
log witnesses; the four exceptional controlled paths retain their explicitly
qualified Phase 1 proofs described below.

## Production correction and shared files

A real authenticated request without Host exposed a Node-generated 400 with a
Date header, chunked framing, no Content-Length and no frozen JSON error body.
The raw gate had correctly preserved the bytes, but Node rejected the request
before the existing authenticated Host policy could run.

`repositories/memoryos-rest/src/server.mjs` now passes `requireHostHeader:false`
to the unbound strict Node HTTP server. The existing gateway policy still requires
the canonical configured Host. Missing Host returns 403/FORBIDDEN with the frozen
envelope, while a missing credential returns 401/UNAUTHENTICATED first. Duplicate
Host and framing violations remain rejected by the raw gate. The strict parser,
TLS policy, semantic worker and frozen contract are unchanged.

`repositories/memoryos-rest/distribution-manifest.json` updates only the byte
length and SHA-256 of `src/server.mjs`, so every isolated test process verifies
the exact corrected file.

`.gitattributes` adds a single-path `-blank-at-eof` whitespace exception for the
executed `mo1305-phase2c/transport.mjs` harness. The staged check found an extra
blank line at its end after execution. Preserving the exact already-bound bytes
keeps every accepted and retained failed receipt independently verifiable; the
exception changes no production code, parser behavior, or other whitespace checks.
These are the three pre-existing shared files changed. All remaining Phase 2C
changes are this report and new harness/evidence files.
No SDK/Core/MIP/Policy/MCP/VS Code source, Phase 1 receipt, FINAL limit, contract,
OpenAPI or dependency/SBOM metadata was modified.

## Execution and scope

Transport, capabilities, interoperability, resource and credential-rotation
witnesses launch the actual `bin/memoryos-rest.mjs` entry point using the exact
Node 24.21.0 executable (SHA-256
`ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`).
The harness materializes the 58-file manifest set beneath this worktree's ignored
cache, verifies every source byte, creates a short-lived ECDSA P-256 test
certificate, protects local secret files and runs the existing trusted launcher
ACL/hash check. This is security testing of the corrected candidate; it does not
replace Phase 2B installation/distribution certification.

Clients use real TCP, native TLS 1.3 and HTTP/1.1, with normal test-CA/IP validation.
No insecure client option is used. All nine endpoints are exercised by Node
built-in fetch, Windows curl and raw TLS. Expected semantic products are computed
fresh from the independently verified public SDK source closure; REST is never
its own oracle. Exact canonical artifacts, document/semantic/evaluation/outcome
digests, inspection-only verification and PASS/FAIL/COULD_NOT_EVALUATE are compared.
JSON whitespace, escaped spelling, member order and media-type case do not alter
normative results.

The transport suite covers malformed request lines/forms/versions, Host and
framing duplicates, CL/TE/chunks/trailers, invalid headers and controls, EOF,
excess bytes, pipelining, keep-alive, authentication precedence, proxy/browser
headers, negotiation, wire limits, TLS downgrade/bad trust/handshake failures,
log injection and secret-safe diagnostics. Separate startup witnesses cover
wrong IP SAN, absent IP SAN, expiry, key mismatch and restart-only token loading.

Capability witnesses cover strict JSON structural limits, schemas/Base64,
filesystem paths, UNC/device/ADS/workspace/home strings, URI/SSRF forms, absent
execution/proxy/MCP/VS Code routes and unsupported acquisition members. Operator
startup inputs are distinguished from untrusted HTTP input. Isolated environments
exercise NODE_OPTIONS, NODE_PATH, preloads, loaders, debug/proxy influences,
runtime substitution and semantic closure substitution, including post-listen
integrity failure. No persistent environment or security policy is changed.

A supplemental observer imports the same production entry point and forwards
the original Worker constructor arguments unchanged. It observes zero workers
for pre-admission attacks and one created/reaped worker for a valid semantic
request. Its write-capacity mode deliberately holds TLS completion callbacks;
this is labelled controlled backpressure, not natural Windows socket saturation.
The ordinary entrypoint suites remain the primary real-process evidence.

Resource acceptance uses FINAL body/header/target/JSON and admission limits,
including per-operation body boundaries, 32 connections, four request/write
slots, semantic BUSY, global request exhaustion/refill, authentication failure
consuming tokens, and recovery. Small deterministic production-primitive tests
supplement actual socket evidence for exact nanosecond and slot boundaries.
No resource characterization or unrelated lifecycle campaign is repeated.

## Evidence limits and reuse

All 23 frozen error codes have an independently transcribed HTTP/wire mapping
check. Current client-triggered wire witnesses are distinguished from startup
fatal diagnostics and log-only CLIENT_CANCELLED. INTERNAL_FAILURE,
OPERATION_TIMEOUT, OUTPUT_LIMIT and UNAVAILABLE retain explicitly controlled
Phase 1 fault/projection evidence, with original source/archive identities and
current hashes of those immutable receipts. They are not claimed as ordinary
client-triggered semantic failures. The missing-Host correction changes only
Node's early Host check; the reused worker, projector, serializer, schema,
admission, limit and fault-harness behavior remains unchanged. New wire tests
cover the changed HTTP path.

A calibrated Windows loopback HTTP sentinel receives one positive calibration
request and zero client-directed attack acquisitions. All selected semantics
complete using the fixed worker boundary; 27 actual worker denial probes cover
network/DNS/process/nested-worker/native-addon/file-write entry points. This is
not OS firewall enforcement, exhaustive packet capture or confinement of hostile
replacement runtime code. No stronger OS-level denial is claimed.

Preload/loader markers explicitly demonstrate that injected code can execute
before entry-point refusal. This is the frozen trusted-launcher exclusion, not
a promise to undo pre-entry execution. Constant-time authentication evidence
checks the fixed 32-byte timingSafeEqual mechanism; it does not claim statistical
side-channel resistance or constant latency.

Each final module records a monotonic/UTC window and raw bounded Windows
Kernel-Power evidence. The existing host-interruption policy is recomputed during
verification. Proven interrupted attempts remain HOST_INTERRUPTED and count
neither as PASS nor product failure; only the affected bounded module is rerun,
with at most three replacements. Unknown event evidence never fabricates sleep.
Development failures while refining harness scheduling are not accepted receipts.

The fixed security/semantic regression subset covers 27 REST guards, 21 host
interruption checks, and the six established predecessor groups: SDK Policy,
Core/MIP, MO-1302 projections, MO-1303 I/O/inspection, MO-1304 semantic/integrity,
and CLI projections. No predecessor evidence is rewritten.

## Retained regression setup failures

Two regression attempts passed REST, host-guard, SDK, Core/MIP and MO-1302 groups,
then the VS Code group failed before its assertions because this worktree lacked
first `esbuild`, then `typescript`. Both original FAIL attempts and their
Windows NORMAL/AVAILABLE observations are retained:

- [Missing esbuild receipt](../repositories/cca-conformance/evidence/mo1305-phase2c/regressions-setup-failure.json) and [original TAP log](../repositories/cca-conformance/evidence/mo1305-phase2c/regressions/4435b085-c116-415d-8351-d564d5cdbe12/mo1303-io-inspection.tap).
- [Missing TypeScript receipt](../repositories/cca-conformance/evidence/mo1305-phase2c/regressions-setup-failure-typescript.json) and [original TAP log](../repositories/cca-conformance/evidence/mo1305-phase2c/regressions/a1c2e09d-7549-4d6c-adaf-ab9ddb181c7c/mo1303-io-inspection.tap).

These are not relabelled HOST_INTERRUPTED or counted as acceptance PASS. Only the
lockfile-pinned VS Code test dependencies `esbuild` and `@esbuild/win32-x64` 0.28.2
and `typescript` 7.0.2 were installed into this worktree's ignored `node_modules`.
All three npm archives passed the existing package-lock SHA-512 integrity checks
before extraction. A native TypeScript transform and complete regression-builder
import then passed. The selected MCP tests also require the existing locked
three-package production dependency closure. Preparation used `npm ci --omit=dev
--ignore-scripts`, followed the existing hash-verified development-file exclusions,
and passed the 748-file dependency and 25-file runtime integrity checks. No
tracked dependency manifest or lockfile changed.

The complete bounded regression module was rerun against the same frozen source
binding after dependency preparation; the six passing security/interoperability
modules did not require repetition.

## Phase 2D integration

Integrate this branch together with Phase 2A/2B in Phase 2D; this branch neither
merges them nor creates B2. Preserve `requireHostHeader:false` when reconciling
`server.mjs` with Phase 2A. Regenerate the final distribution manifest together
with Phase 2B package/dependency/SBOM provenance after combining changes; this
branch's manifest identifies only its own security-tested candidate.

The read-only receipt verifier works before integration and rejects changed
production/harness inputs afterward. Phase 2D must preserve these original
receipts, document which relevant behavior is unchanged, and run affected
bounded modules against its integrated candidate. In particular rerun transport,
dispatch, authentication/TLS and independent-client parity if shared server
changes affect them. Remote RFC1918 deployment/lifecycle remains Phase 2A's
responsibility; final package/distribution remains Phase 2B's. These local
security receipts do not claim final Windows certification or release binding.

No branch, worktree, merge, push, tag, B2, or sibling-workspace modification is
part of Phase 2C. The task creates exactly one scoped commit directly above the
verified baseline after acceptance, regression, workspace and diff checks pass.

## Final validation

The final `runner.mjs verify` check passed without starting a gateway and reported
seven modules, 437 records, 23 error codes, 76 validator tests, 19 categories and
zero interrupted attempts. `tools/verify_workspace.py --root .` and
`git diff --check` passed. The staged check uses only the explicit frozen-harness
EOF exception described above. All report links resolve to retained local files.
Shared production edits, harness assertions, evidence validation, and the scope
qualifications received separate read-only review.

## Changed-file inventory

78 files comprise the exact Phase 2C scope. Three are existing shared files;
all others are this report and new scoped harness/evidence files. Retained
setup-failure logs are intentionally included and are not acceptance passes.

```text
.gitattributes
docs/mo1305-phase2c-security-acceptance.md
repositories/cca-conformance/evidence/mo1305-phase2c/capabilities.json
repositories/cca-conformance/evidence/mo1305-phase2c/categories/authentication.json
repositories/cca-conformance/evidence/mo1305-phase2c/categories/authorization.json
repositories/cca-conformance/evidence/mo1305-phase2c/categories/client-interoperability.json
repositories/cca-conformance/evidence/mo1305-phase2c/categories/content-negotiation.json
repositories/cca-conformance/evidence/mo1305-phase2c/categories/dispatch-observation.json
repositories/cca-conformance/evidence/mo1305-phase2c/categories/environment-runtime.json
repositories/cca-conformance/evidence/mo1305-phase2c/categories/error-catalog.json
repositories/cca-conformance/evidence/mo1305-phase2c/categories/error-contract.json
repositories/cca-conformance/evidence/mo1305-phase2c/categories/filesystem.json
repositories/cca-conformance/evidence/mo1305-phase2c/categories/host-proxy.json
repositories/cca-conformance/evidence/mo1305-phase2c/categories/http-framing.json
repositories/cca-conformance/evidence/mo1305-phase2c/categories/json.json
repositories/cca-conformance/evidence/mo1305-phase2c/categories/logging-secrets.json
repositories/cca-conformance/evidence/mo1305-phase2c/categories/network-authority.json
repositories/cca-conformance/evidence/mo1305-phase2c/categories/resource-abuse.json
repositories/cca-conformance/evidence/mo1305-phase2c/categories/schema.json
repositories/cca-conformance/evidence/mo1305-phase2c/categories/security-regressions.json
repositories/cca-conformance/evidence/mo1305-phase2c/categories/tls.json
repositories/cca-conformance/evidence/mo1305-phase2c/categories/uri-ssrf.json
repositories/cca-conformance/evidence/mo1305-phase2c/dispatch.json
repositories/cca-conformance/evidence/mo1305-phase2c/index.json
repositories/cca-conformance/evidence/mo1305-phase2c/interop.json
repositories/cca-conformance/evidence/mo1305-phase2c/regressions-setup-failure-typescript.json
repositories/cca-conformance/evidence/mo1305-phase2c/regressions-setup-failure.json
repositories/cca-conformance/evidence/mo1305-phase2c/regressions.json
repositories/cca-conformance/evidence/mo1305-phase2c/regressions/4435b085-c116-415d-8351-d564d5cdbe12/core-mip.tap
repositories/cca-conformance/evidence/mo1305-phase2c/regressions/4435b085-c116-415d-8351-d564d5cdbe12/host-interruption.tap
repositories/cca-conformance/evidence/mo1305-phase2c/regressions/4435b085-c116-415d-8351-d564d5cdbe12/mo1301-sdk.tap
repositories/cca-conformance/evidence/mo1305-phase2c/regressions/4435b085-c116-415d-8351-d564d5cdbe12/mo1302-projections.tap
repositories/cca-conformance/evidence/mo1305-phase2c/regressions/4435b085-c116-415d-8351-d564d5cdbe12/mo1303-io-inspection.tap
repositories/cca-conformance/evidence/mo1305-phase2c/regressions/4435b085-c116-415d-8351-d564d5cdbe12/rest-security.tap
repositories/cca-conformance/evidence/mo1305-phase2c/regressions/a1c2e09d-7549-4d6c-adaf-ab9ddb181c7c/core-mip.tap
repositories/cca-conformance/evidence/mo1305-phase2c/regressions/a1c2e09d-7549-4d6c-adaf-ab9ddb181c7c/host-interruption.tap
repositories/cca-conformance/evidence/mo1305-phase2c/regressions/a1c2e09d-7549-4d6c-adaf-ab9ddb181c7c/mo1301-sdk.tap
repositories/cca-conformance/evidence/mo1305-phase2c/regressions/a1c2e09d-7549-4d6c-adaf-ab9ddb181c7c/mo1302-projections.tap
repositories/cca-conformance/evidence/mo1305-phase2c/regressions/a1c2e09d-7549-4d6c-adaf-ab9ddb181c7c/mo1303-io-inspection.tap
repositories/cca-conformance/evidence/mo1305-phase2c/regressions/a1c2e09d-7549-4d6c-adaf-ab9ddb181c7c/rest-security.tap
repositories/cca-conformance/evidence/mo1305-phase2c/regressions/b25a987d-6bd1-47e6-8598-863c0c4aa026/cli-secondary.tap
repositories/cca-conformance/evidence/mo1305-phase2c/regressions/b25a987d-6bd1-47e6-8598-863c0c4aa026/core-mip.tap
repositories/cca-conformance/evidence/mo1305-phase2c/regressions/b25a987d-6bd1-47e6-8598-863c0c4aa026/host-interruption.tap
repositories/cca-conformance/evidence/mo1305-phase2c/regressions/b25a987d-6bd1-47e6-8598-863c0c4aa026/mo1301-sdk.tap
repositories/cca-conformance/evidence/mo1305-phase2c/regressions/b25a987d-6bd1-47e6-8598-863c0c4aa026/mo1302-projections.tap
repositories/cca-conformance/evidence/mo1305-phase2c/regressions/b25a987d-6bd1-47e6-8598-863c0c4aa026/mo1303-io-inspection.tap
repositories/cca-conformance/evidence/mo1305-phase2c/regressions/b25a987d-6bd1-47e6-8598-863c0c4aa026/mo1304-semantic-integrity.tap
repositories/cca-conformance/evidence/mo1305-phase2c/regressions/b25a987d-6bd1-47e6-8598-863c0c4aa026/rest-security.tap
repositories/cca-conformance/evidence/mo1305-phase2c/resources.json
repositories/cca-conformance/evidence/mo1305-phase2c/runs/capabilities-943a4fc6-46be-4ecb-8808-07f2d425e2dd.json
repositories/cca-conformance/evidence/mo1305-phase2c/runs/dispatch-9d7a9ae6-aa23-4ada-a2d7-536772d67e0b.json
repositories/cca-conformance/evidence/mo1305-phase2c/runs/interop-3192f51e-e5da-4a09-83b0-2f9a5917bf5c.json
repositories/cca-conformance/evidence/mo1305-phase2c/runs/regressions-7be695bc-98d2-440a-a643-f12cefde9790.json
repositories/cca-conformance/evidence/mo1305-phase2c/runs/regressions-8ce06422-3b35-454d-bc64-d6f2288d2b8b.json
repositories/cca-conformance/evidence/mo1305-phase2c/runs/regressions-9854b160-5dae-47ef-b6a8-b0b1e49c32c3.json
repositories/cca-conformance/evidence/mo1305-phase2c/runs/resources-c75fab5a-9bab-4f75-a236-a53876fd91ea.json
repositories/cca-conformance/evidence/mo1305-phase2c/runs/startup-3c981f90-8339-409e-a53b-7ec5e34c2dd5.json
repositories/cca-conformance/evidence/mo1305-phase2c/runs/transport-40ae5061-0b27-4206-84d9-fdb336d88e49.json
repositories/cca-conformance/evidence/mo1305-phase2c/startup.json
repositories/cca-conformance/evidence/mo1305-phase2c/transport.json
repositories/cca-conformance/evidence/mo1305-phase2c/validator-tests.tap
repositories/cca-conformance/evidence/mo1305-phase2c/validator.json
repositories/cca-conformance/tools/mo1305-phase2c/capabilities.mjs
repositories/cca-conformance/tools/mo1305-phase2c/case-catalog.json
repositories/cca-conformance/tools/mo1305-phase2c/common.mjs
repositories/cca-conformance/tools/mo1305-phase2c/dispatch-server.mjs
repositories/cca-conformance/tools/mo1305-phase2c/dispatch.mjs
repositories/cca-conformance/tools/mo1305-phase2c/evidence.mjs
repositories/cca-conformance/tools/mo1305-phase2c/evidence.test.mjs
repositories/cca-conformance/tools/mo1305-phase2c/fetch-client.mjs
repositories/cca-conformance/tools/mo1305-phase2c/interop.mjs
repositories/cca-conformance/tools/mo1305-phase2c/regressions.mjs
repositories/cca-conformance/tools/mo1305-phase2c/resources.mjs
repositories/cca-conformance/tools/mo1305-phase2c/runner.mjs
repositories/cca-conformance/tools/mo1305-phase2c/startup.mjs
repositories/cca-conformance/tools/mo1305-phase2c/transport.mjs
repositories/memoryos-rest/distribution-manifest.json
repositories/memoryos-rest/src/server.mjs
```
