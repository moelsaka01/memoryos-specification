# MO-1305 Phase 3B-R corrected release-artifact recertification

All requested artifact and supply-chain gates passed for the exact corrected C3/C3B candidate. The prior environment failure and failed long-path harness attempt remain separate historical records. Production bytes are unchanged.

This report is prepared before the single certification commit to avoid embedding its own future identity. The final task response supplies the verified commit hash and clean Git status.

| # | Requested item | Result |
|---:|---|---|
| 1 | Baseline | Clean required dedicated workspace and branch at C3B 4ac43c4368f41ec14ea443aa303bf3a69503f2de; release tag absent before work. |
| 2 | Previous blocker preservation | history/attempt-1-blocked.md preserves the original environment-only failure; separately preserved installed-attempt-1 harness failure is not PASS evidence. |
| 3 | Validator cache path | .cache/mo1305-phase3-correction/schema-runtime inside this dedicated workspace. |
| 4 | Validator permission root cause | Validation ran as DESKTOP-5IVGB5K\CodexSandboxOffline (SID ending 1012); pip-created protected ACLs granted owner/SYSTEM/Administrators and excluded that process account. Owner is DESKTOP-5IVGB5K\melsa. ACL snapshots retained. |
| 5 | Environment repair | Task-cache read/execute grants; exact pinned generated launcher and RECORD restored. The launcher differed only in four ZIP timestamp bytes; neither pins nor validator source changed. |
| 6 | Permission scope | Only the task-owned schema-runtime subtree, only validation-account RX; no Everyone grant, system Python/security/antivirus or unrelated-cache changes. |
| 7 | Expected validator files | 150. |
| 8 | Visible/readable after repair | 150 visible, 150 readable, zero missing/extra; all exact lengths/hashes. |
| 9 | Validator inventory identity | Manifest 22489 bytes; SHA-256 dfd658d188212e96a74c9258683edad5c97217aaeeca75ee5030692ad00ccbf0; ordered file inventory SHA-256 09113948994dff01263d5468ab1a0128202a69989a31a00f2fc84bed08c72496. |
| 10 | jsonschema version | 4.25.1 Draft7Validator; engineering-only Python 3.12.14. Official SPDX 2.3 Draft-7 schema: 45312 bytes, SHA-256 239208b7ac287b3cf5d9a9af23f9d69863971102a5e1587a27a398b43490b89b. |
| 11 | Refresh wrapper | PASS: real refresh context/C3/C3B graph checked, immutable original correction checks evaluated through explicit branch/HEAD adapter; literal historical main-only CLI was not run. No other worktrees inspected. |
| 12 | Refresh wrapper tests | 18 PASS: branch/baseline/C3/C3B/archive/inventory rejections, optimized Python refusal, authorized child and postcommit dirty-state refusal. |
| 13 | Cheap structural gate | PASS before clean assemblies/install/advisarial/advisory campaigns; all original content checks preserved. |
| 14 | Archive filename | memoryos-rest-0.1.0.tgz |
| 15 | Archive length | 191823 bytes. |
| 16 | Archive SHA-256 | faac95f7ad8939bcf7bbc33952efabebc1468d0c5654ea3eaac03f40402a7382 |
| 17 | Package name/version | memoryos-rest@0.1.0. |
| 18 | Package files | 58; package-inventory.json gives exact paths, lengths and SHA-256. |
| 19 | Runtime files | 25 authoritative closure files. |
| 20 | External dependencies | 0 external production npm dependencies; external Node/npm/component scope remains represented. |
| 21 | OpenAPI identity | 114491 bytes; SHA-256 36ed9f1dac58007881ebd8f666c930e7fb1ae767c2be2d5b6be28f5fb0cae03a. Remote implemented, explicit opt-in, assigned RFC1918 IPv4, local default; stale pending absent. |
| 22 | SBOM identity | 44094 bytes; SHA-256 ab0a60fc4273390fe353df5c8464571b581043c2ddc90587039afa1299ad3b7b. 25 packages, 56 files, 81 relationships. |
| 23 | SPDX root errors | 0. |
| 24 | SPDX package errors | 0. |
| 25 | SPDX file errors | 0. |
| 26 | SPDX relationship errors | 0. |
| 27 | SPDX other errors | 0. |
| 28 | SPDX TOTAL errors | 0; complete pinned schema, no ignored errors. |
| 29 | SPDX semantic validation | PASS: comment/licenseInfoInFiles, SHA1/SHA256, verification codes, licenses, relationships/ownership, two analyzed packages, 23 unanalyzed external packages, two documented recursive-output exclusions. |
| 30 | Package allowlist | PASS: exact 58 members, permitted scripts/import graph, no unexpected cache/Git/temporary/credential/dependency content or task absolute paths. PEM regex literal in src/config.mjs explicitly distinguished from key material. |
| 31 | Runtime closure | PASS: all 25 paths, lengths and hashes match corrected distribution; runtime-closure.json. |
| 32 | Reproducibility | PASS: two fresh clean roots, independent builder processes, byte-for-byte equal to exact required archive; restored historical cache copies excluded. |
| 33 | Offline install | PASS: initially empty explicit cache; --offline --ignore-scripts --no-audit --no-fund; copied archive/tools/fixtures. Logical source independence within dedicated workspace; checkout not hidden by OS. |
| 34 | Installed execution | PASS: five positive TLS1.3 HTTP/1.1 requests (health/readiness/version/identities/evaluatePolicy) plus missing-auth401. Installed entry point, schemas/contracts/OpenAPI/SBOM/FINAL limits/semantic closure verified. |
| 35 | Installed integrity | PASS: all 58 before/after inventories identical; no prohibited persistence; credentials/stage removed; host NORMAL/AVAILABLE. Windows long-path harness regression passed at 310 characters. |
| 36 | Package adversarial result | 19 PASS witnesses: missing/extra and metadata/runtime changes, rebound runtime substitution, Node substitution, injected dependency/lifecycle hook, corruption/truncation, unsafe paths/content. Hash tamper cases establish integrity rejection; independent metadata negatives separately establish semantics. |
| 37 | Four metadata regression negatives | PASS: PHASE_2_PENDING, false filesAnalyzed with files, documentComment, licenseInfoInFile. 34 metadata checks plus 12 contract/OpenAPI tests all PASS. |
| 38 | Lockfile/npm graph | PASS: v3 root-only graph, zero external/optional/development acquisitions, lifecycle downloaders or native addons. External npm tool dependencies are not gateway production dependencies. |
| 39 | Component/SBOM coverage | PASS: gateway, 25-file semantic closure, Node/npm and established embedded runtime scope; ABI/ICU data retained as metadata and empty components excluded. |
| 40 | Licenses/notices | PASS: three shipped notices exact; complete Node LICENSE byte-identical to official distribution; npm Artistic-2.0 primary declaration. NOASSERTION conclusions retained; no blanket license claim. |
| 41 | Node identity | 24.21.0; SHA-256 ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32; Authenticode Valid; official zip and all 1994 extracted files verified. |
| 42 | npm identity | 11.19.0; npm CLI SHA-256 3ce7cba6f5128dd5f54c98b6a5036b0f850496878cc2e21044b675fe3c594e3e; complete distribution inventory matched official Node zip. |
| 43 | Advisory snapshot | 2026-09-25 UTC: 25 components, 38 selected advisory/release records, 10 fresh primary HTTPS sources. |
| 44 | Advisory dispositions | No unresolved applicable advisory in the explicitly reviewed set; fixed versions/outside affected ranges. Not an exhaustive census or zero-vulnerability claim; npm bundled transitive advisory graph not independently scanned. See advisory-review.md. |
| 45 | Provenance | PASS: C3 62a70cafac68e89366740ec197074bd13fbce934, C3B 4ac43c4368f41ec14ea443aa303bf3a69503f2de, source-tree identities, toolchain, runtime, OpenAPI/SBOM/limits/manifests/archive bound. B2 parent metadata retained as historical source provenance; no future commit/self-reference. |
| 46 | Tamper detection | PASS: archive/content identities, schema/semantic regressions and forged wrapper contexts reject; receipt validator additionally rechecks complete toolchain and evidence identities. |
| 47 | Release artifact receipt | receipt.json: canonical MemoryOSRESTPhase3BReleaseArtifactRecertification v1.0.0; evidence/tooling/artifact/validator bindings; final release binding remains PENDING_PHASE_3D. |
| 48 | Validators | Receipt, full SPDX, package/distribution, refresh wrapper, unchanged correction content checks, advisory evidence and contract/OpenAPI tests PASS; read-only commands in tooling README. |
| 49 | Workspace verification | PASS: tools/verify_workspace.py --root . |
| 50 | git diff --check | PASS; staged and final commit checks also required by commit protocol and reported in final task response. |
| 51 | Production unchanged | All baseline files, product runtime, release metadata and original correction tools unchanged. Only new Phase3B-R tooling/evidence files added. |
| 52 | Commit hash | Reported from Git after creation; deliberately not embedded in its own evidence. Exact requested subject: cert(memoryos-1.3): certify corrected MO-1305 release artifact. |
| 53 | Commit parent | 4ac43c4368f41ec14ea443aa303bf3a69503f2de |
| 54 | Final Git status | Required clean authorized certification child; verified after commit and reported separately. |
| 55 | No merge | Confirmed. |
| 56 | No push | Confirmed. |
| 57 | No tag | Confirmed; memoryos-1.3-mo1305 absent. |
| 58 | Phase 3D integration | Integrate this certificate with separate 3A-R and 3C-R refreshes. Bind the exact archive and this receipt using the certification commit identity from Git. Do not treat historical B2/provisional copies or original correction-only receipts as new 3B certification. No final release tag/binding created here. |

The schema, package and source identities are exact-byte assertions. The advisory review is explicitly bounded; consult [advisory review](advisory-review.md) for authoritative sources, version ranges and limitations. The installed execution proves the release artifact through copied tools and installed imports; it does not repeat the independent Windows certification or claim OS concealment of the checkout.
