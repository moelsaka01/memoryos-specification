# MO-1305 Phase 3A-R targeted Windows certification refresh

The corrected C3/C3B candidate passes the bounded Windows refresh. Runtime evidence is reused only for mechanically identical files. The original B2 Windows receipt is unchanged. This report records certification results; the enclosing commit identity is resolved from Git after creation.

| # | Requested item | Result |
|---:|---|---|
| 1 | Baseline | PASS: dedicated `cca-mo1305-3a-refresh`; `mo1305/phase3a-refresh`; initial clean HEAD `4ac43c4368f41ec14ea443aa303bf3a69503f2de`; expected subject; MO-1305 tag absent. |
| 2 | Cheap structural validators | PASS before installation: complete pinned schema, semantic SPDX, OpenAPI, stale-pending rejection, package/archive and branch-neutral correction conformance. 34 metadata witnesses and 12 binding negatives. |
| 3 | Corrected archive identity | `memoryos-rest-0.1.0.tgz`; 191823 bytes; SHA-256 `faac95f7ad8939bcf7bbc33952efabebc1468d0c5654ea3eaac03f40402a7382` |
| 4 | Corrected OpenAPI identity | 114491 bytes; SHA-256 `36ed9f1dac58007881ebd8f666c930e7fb1ae767c2be2d5b6be28f5fb0cae03a` |
| 5 | Corrected SBOM identity | 44094 bytes; SHA-256 `ab0a60fc4273390fe353df5c8464571b581043c2ddc90587039afa1299ad3b7b` |
| 6 | SPDX schema error count | 0 across root, packages, files, relationships and other locations; full pinned SPDX 2.3 Draft-7 schema. |
| 7 | Runtime-byte equivalence | PASS: 52 unchanged package members; 42 executable/runtime; all 25 authoritative closure files. Compared with both B2/A3 Git bytes and original installed-file inventory. |
| 8 | Reused original evidence | Historical Phase 3A PASS at `9bb679532b90016b9cc30bf5e1cdb41d376e2ff7`. Original receipt and its referenced artifacts preserved. Reuse full security/client/lifecycle/semantic evidence, accepted limits attempt 3, and transitive unchanged resource characterization; old failures remain historical. No historical test is counted as a fresh check. |
| 9 | Actual Windows edition | Microsoft Windows 11 Home |
| 10 | Windows release | 25H2 |
| 11 | Windows build | 26200.9457 |
| 12 | Architecture | x64 |
| 13 | Node version/hash | 24.21.0; 93580104 bytes; SHA-256 `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32` |
| 14 | npm version | 11.19.0 |
| 15 | Offline install | PASS: exactly one fresh external installation; copied archive/toolchain/harness/oracle, empty explicit cache, --offline --ignore-scripts --no-audit --no-fund. Zero external production npm dependencies. |
| 16 | Installed file count | 58, all compared to corrected archive inventory. |
| 17 | Installed metadata | PASS: exact OpenAPI, SBOM, distribution manifest, dependency/source provenance, FINAL limits, API contract/schemas and closure manifest. |
| 18 | Loopback | PASS: actual installed entrypoint; health, readiness, version and contract identities. |
| 19 | Remote mode | PASS: explicit opt-in at `192.168.1.53` (assigned `/24`), same host. Missing opt-in, wildcard and public binding refused. No off-host reachability claim. |
| 20 | TLS | PASS: TLS 1.3; HTTP/1.1; trusted certificate; TLS 1.2 refused. |
| 21 | Authentication | PASS: authenticated success; missing and incorrect bearer token refused. |
| 22 | Host/missing Host | PASS: authenticated missing Host = 403; missing Host plus missing authentication = 401; bad Host plus wrong authentication = 401. |
| 23 | Six-capability confirmation | PASS: getContractIdentities, preparePolicy, preparePolicySet, evaluatePolicy, verifyEvaluationIdentity, verifyPolicyOutcome. |
| 24 | PASS decision | Exact independent SDK parity. |
| 25 | FAIL decision | Exact independent SDK parity. |
| 26 | COULD_NOT_EVALUATE decision | Exact independent SDK parity. |
| 27 | Semantic parity | PASS: nine bounded oracle fixtures, exact canonical response and normative artifact/digest bytes; independent 25-file authoritative SDK closure, freshly evaluated. |
| 28 | Limits | PASS: unchanged FINAL identity; 31400 ms semantic deadline; 60000 ms absolute ceiling. Fresh body 4096/4097, header count/value and target-length enforcement. No resource characterization or deadline campaign rerun. |
| 29 | Security confirmation | PASS: TLS/auth/Host, remote mode, trusted launcher and environment, disposable closure substitution, filesystem/URL authority, calibrated no-acquisition target, secret-safe diagnostics. |
| 30 | Node fetch | PASS: two bounded semantic requests with verified certificate. |
| 31 | curl | PASS: policy-set preparation; TLS 1.3, HTTP/1.1, certificate result 0. |
| 32 | Raw TLS | PASS: actual raw HTTP/1.1 requests, six capabilities and targeted protocol witnesses. |
| 33 | Pre/post integrity | PASS: all 58 installed files unchanged; service cwd/temp empty; no prohibited persistence; 74 retained files scanned for actual secrets; temporary credentials removed. |
| 34 | Host interruptions | 0: NORMAL/AVAILABLE; unchanged policy recomputed over whole run and all 51 case windows. No replacement run. |
| 35 | Refresh receipt | New canonical `repositories/cca-conformance/evidence/mo1305-phase3a-refresh/windows-refresh-receipt.json`; binds C3, C3B and historical A3 separately. |
| 36 | Validators | PASS: receipt and Windows certification refresh gates; 32 negative witness mutations rejected. Validators execute no gateway campaign. 51 bounded recorded runtime checks, 16 gateway processes. |
| 37 | Workspace verification | PASS: `tools/verify_workspace.py --root .`. |
| 38 | git diff --check | PASS; staged and post-commit checks also required by the commit procedure. |
| 39 | Production unchanged | PASS: all C3B package members unchanged; additions only in refresh tooling/evidence and this report. |
| 40 | Commit hash | Resolve from the sole certification commit containing this report; reported separately after creation to avoid self-reference. |
| 41 | Commit parent | Exactly `4ac43c4368f41ec14ea443aa303bf3a69503f2de`. |
| 42 | Final Git status | Require clean after the certification commit; verified in the final handoff. |
| 43 | No merge | No merge performed. |
| 44 | No push | No push performed. |
| 45 | No tag | No tag created; `memoryos-1.3-mo1305` absent. |
| 46 | Integration notes for Phase 3D | Integrate this certification commit with independent 3B-R and 3C-R results. Preserve C3/C3B candidate identities and historical A3 evidence. Final release binding remains pending until Phase 3D; no product regeneration or tagging here. |

C3 is `62a70cafac68e89366740ec197074bd13fbce934`; C3B is `4ac43c4368f41ec14ea443aa303bf3a69503f2de`. The new receipt is 6754 bytes; SHA-256 `cce9d18540cfab79b115165f483db405df86e92f6eaa3859f57d1be2f8fd81f4`.

The refresh-owned correction gate checks the immutable correction graph, artifacts, source provenance, accepted evidence, registration and negative witnesses using named Git objects. The historical correction CLI assumes `main` and was not altered. The refresh gate intentionally enforces the dedicated branch and direct C3B parent. Phase 3D should bind these immutable receipts and the named certification commit in its integration gate.

The isolated checkout was not hidden by the operating system. Closed imports and copied input identities establish source-checkout independence. Filesystem/URL witnesses cover supplied authority and a calibrated loopback target, not OS-wide access denial. Launcher checks establish pre-start refusal; the entrypoint cannot undo code already preloaded by a hostile launcher. Fresh resource characterization, full historical client matrices and exhaustive security campaigns were intentionally not repeated.

Reproduction commands and frozen-input details: `repositories/cca-conformance/tools/mo1305-phase3a-refresh/README.md`. Current evidence is exclusively `repositories/cca-conformance/evidence/mo1305-phase3a-refresh/`; original certification evidence remains in the original Git commit.
