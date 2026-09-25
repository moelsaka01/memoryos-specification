# MO-1305 release metadata correction — BLOCKED

The user-authorized correction stopped before C3/C3B because an additional release blocker was discovered during the required SPDX structural review. This report does not certify the provisional archive.

Both B2 and the provisional correction SBOM contain the root property `documentComment`. The official [SPDX 2.3 JSON schema](https://raw.githubusercontent.com/spdx/spdx-spec/v2.3/schemas/spdx-schema.json) defines `comment`, does not define `documentComment`, and sets root `additionalProperties` to false. A direct comparison against the downloaded schema mechanically rejects the field in both artifacts. This is independent of the original package file-analysis contradiction. The schema snapshot is 45,312 bytes, SHA-256 `239208b7ac287b3cf5d9a9af23f9d69863971102a5e1587a27a398b43490b89b`.

The governing user instruction is: “If another release blocker appears: MO-1305 PHASE 3 CORRECTION BLOCKED.” No automatic repair of this third defect, further acceptance campaign, staging, or commit was performed. The required next correction would replace the JSON field with `comment`, extend structural validation, regenerate affected metadata/archive identities, and refresh the affected provisional evidence; that work is not performed here.

SPDX file-analysis and verification-code requirements were checked against [SPDX 2.3 package information](https://spdx.github.io/spdx-spec/v2.3/package-information/) and [file checksum requirements](https://spdx.github.io/spdx-spec/v2.3/file-information/#84-file-checksum-field). SHA-1 is used only for mandatory SPDX identifiers; SHA-256 archive and file integrity binding remains in place.

All six Phase 2/3 worktrees were rehashed and their HEAD/status compared with the initial snapshot. They are unchanged, including pre-existing untracked Phase 3C evidence. The original B2 archive is retained. The three historical certification outcomes are not rewritten.

| # | Requested item | Result |
|---:|---|---|
| 1 | Baseline | Verified clean `main` at `2fcc588979675462d30c582f24f42fa9ec3ec729`, expected B2 subject, workspace `C:\Users\melsa\Documents\Codex\cca-workspace`; predecessor tags unchanged and MO-1305 tag absent. |
| 2 | Phase 3A state | Historical PASS at `9bb679532b90016b9cc30bf5e1cdb41d376e2ff7`, for original B2 archive. Windows receipt and validation state read directly; evidence preserved. |
| 3 | Phase 3B blocker verification | Direct B2 SBOM check: gateway 31 and closure 25 CONTAINS file relationships with filesAnalyzed=false. Stopped task produced no worktree report; its final report is preserved in phase3b-report.md with task provenance. |
| 4 | Phase 3C blocker verification | Direct B2 OpenAPI check confirmed PHASE_2_PENDING. The report and release-blocker.json were read from the preserved Phase 3C worktree. |
| 5 | OpenAPI root cause | Phase 1 make_openapi() and shipped expectedOpenAPI() each independently hardcoded the obsolete pending string. |
| 6 | Old remote-mode metadata | `PHASE_2_PENDING`. |
| 7 | Correct remote-mode metadata | Contract deployment.remoteMode: `{"mode":"remote","implemented":true,"explicitOptIn":true,"bindAddressPolicy":"assigned RFC1918 IPv4"}`. deployment.defaultMode is local. No public/wildcard/off-host certification claim. |
| 8 | Generator/source correction | Uncommitted api-contract deployment metadata and make_openapi(api,limits) projection corrected. The new correction builder verifies the authoritative projection. Historical Phase 2D builder/policy remain unchanged for B2 reproduction. |
| 9 | Verifier correction | Shipped expectedOpenAPI() derives remoteMode from the contract deployment state. |
| 10 | OpenAPI negative regression | PASS: stale PHASE_2_PENDING rejected as OPENAPI_RUNTIME_DRIFT; corrected projection accepted. |
| 11 | Old OpenAPI | 114407 bytes; SHA-256 `a13b3467c2fd926d5444e6f654cb858b74f656faed2fe7ac416dcb5b4d7cf784` |
| 12 | Provisional new OpenAPI | 114491 bytes; SHA-256 `36ed9f1dac58007881ebd8f666c930e7fb1ae767c2be2d5b6be28f5fb0cae03a` |
| 13 | SPDX root cause | Phase 2D builder set every package filesAnalyzed=false, including file-owning packages; verifier checked file/checksum/relationship inventories but not the contradiction. |
| 14 | Old SBOM | 38729 bytes; SHA-256 `1e40cecc24599e134b0cc8e7c013f6cb096f59a1f5957e431ee16fb286e2c707` |
| 15 | Corrected filesAnalyzed semantics | Provisional builder sets gateway and closure true for their 31/25 directly owned files. External Node/npm/component metadata remains false without analyzed file fields. |
| 16 | Verification-code/related semantics | Added mandatory SHA1 file checksums alongside SHA256, independently recomputed package codes, and licenseInfoFromFiles=NOASSERTION. Gateway excludes ./sbom.spdx.json and ./distribution-manifest.json as recursive analysis outputs; archive identity binds both. Closure is a separate direct file scope/code. Root schema validation subsequently FAILED; no claim of valid overall SPDX. |
| 17 | SPDX builder correction | New tools/mo1305-phase3-correction/distribution.py. The original analysis contradiction is corrected locally; the newly found documentComment field defect remains unfixed under the explicit stop condition. |
| 18 | SPDX verifier correction | New independent spdx.py reads actual package bytes, checks file hashes/coverage, contained-file analysis state, required verification code, license fields and references. It did not cover unknown root properties; official schema comparison exposed this remaining gap. |
| 19 | SPDX negative regressions | PASS for both false-with-files packages, missing/wrong verification codes, missing analyzed licenses, wrong exclusions, missing/wrong SHA1, unanalyzed tool with code, and unknown relationship source. Mutated SBOM negatives rebind outer manifest hashes to prove semantic rejection. |
| 20 | Provisional new SBOM | 44046 bytes; SHA-256 `ce90a3652f13cd07e1b0df7f17cc283afb235bba2ee1f6d5c551c33962ecdd49`; 25 packages, 56 files, 81 relationships. Overall schema status FAIL. |
| 21 | Runtime files compared | 52 unchanged package members, including 42 executable/runtime members. Includes every src/ and bin/ file, all 25 authoritative closure files, strict JSON, schema validator, auth/config/server, worker and FINAL limits. |
| 22 | Runtime-byte preservation | PASS against B2 Git blobs. Only six shipped metadata/verifier members changed. API contract minus deployment is identical; schemas 10776 bytes; SHA-256 `dfdf8d6d09c906f3e04aaaf7f053c7f15af284debe88e822e375ebc269467b63`. OpenAPI differs only at the remoteMode extension. |
| 23 | Transitive metadata | Regenerated API/OpenAPI, dependency/source provenance, SBOM, distribution manifest, exact package/archive inventory and conformance inventory. Historical receipts remain unmodified and are preserved under B2; current inventory is BLOCKED with refresh requirements. |
| 24 | Old archive | 189787 bytes; SHA-256 `af99ba13fa96c5b5ded130a871c671243fb3fadd07f74eefa9b6ae2e601d182a`; preserved in .cache/mo1305-phase2d/build/memoryos-rest-0.1.0.tgz. |
| 25 | Provisional new archive | 191830 bytes; SHA-256 `e0a38c0ca83d74e474a45754b6a65dae3d7c6cabf4abbf879f4833a8ec0e442c`; .cache/mo1305-phase3-correction/build/memoryos-rest-0.1.0.tgz. This is NOT an accepted release candidate because of the additional schema blocker. |
| 26 | Package file count | 58; authoritative closure 25; external production dependencies 0; package version 0.1.0. |
| 27 | Reproducibility | PASS: two fresh source roots, separate builder processes, byte-identical archives and source-tree manifests. Clean-a/clean-b results retained. |
| 28 | Offline install | PASS: exactly one fresh isolated npm install, empty explicit cache, --offline --ignore-scripts --no-audit --no-fund. Copied Node/npm/archive/probe/fixtures outside checkout; empty cwd and restricted service environment. Checkout was not hidden by the OS. |
| 29 | Installed smoke | PASS: 8 TLS 1.3 requests over local and explicit same-host RFC1918 starts; authenticated health/readiness/version/contract identities/policy evaluation and unauthenticated refusal; OpenAPI artifact identity, orderly shutdowns, 58-file before/after integrity. Host NORMAL/AVAILABLE; private temporary credentials removed. |
| 30 | Contract tests | 12/12 PASS; 0 failed/skipped. Durable contract-tests.tap and source-bound contract-tests.json. |
| 31 | Distribution tests | 21/21 focused metadata/package checks PASS, including positive archive/inventory checks and negative member tampering, missing/extra files, and wrong trusted archive digest. This limited suite did not cover the newly discovered root field. |
| 32 | SBOM tests | File-analysis tests PASS; official SPDX 2.3 closed-root structural check FAIL for documentComment in both B2 and provisional candidate. No third-party complete SPDX validator was installed; no full-schema validation PASS is claimed. |
| 33 | Workspace verification | Not run: the additional release blocker triggered mandatory stop before pre-commit/final workspace validation. Incomplete runner registrations were removed; the unfinished correction gate is not registered. |
| 34 | git diff --check | PASS at stop/final reporting. |
| 35 | Correction report | docs/mo1305-release-metadata-correction.md (this document); mechanical blocker: evidence/mo1305-phase3-correction/additional-blocker.json and pinned official spdx-2.3-schema.json. |
| 36 | C3 hash | Not created. No staging or commit performed. |
| 37 | C3 parent | Not applicable; required parent remains B2 2fcc588979675462d30c582f24f42fa9ec3ec729. |
| 38 | C3B required | Yes if correction succeeds: Contract Freeze lines 1208-1213 require an explicit implementation/binding correction pair and refreshed dependent evidence. Stop prevented both commits. |
| 39 | C3B hash | Not created. |
| 40 | C3B parent | Not applicable; must be C3 if later authorized and completed. |
| 41 | Final Git status | Main remains at B2. Nine tracked files modified; correction report and new correction tooling/evidence untracked; nothing staged. Deliberately not marked clean or complete after mandatory stop. |
| 42 | Phase 3A refresh | Original PASS preserved; REFRESH_REQUIRED for any corrected archive. Identical runtime bytes may support reuse, but installed artifact identity must be refreshed. |
| 43 | Phase 3B refresh | STOPPED/RELEASE_ARTIFACT_DEFECT preserved. Original filesAnalyzed contradiction corrected locally; additional root schema defect BLOCKS correction. Full Phase 3B refresh required after an accepted candidate exists; no PASS claim. |
| 44 | Phase 3C refresh | STOPPED/RELEASE_BLOCKER preserved. Original stale OpenAPI blocker corrected locally; FINAL_AUDIT_REFRESH_REQUIRED. No Phase 3C PASS claim. |
| 45 | No push | Confirmed; no push performed. |
| 46 | No tag | Confirmed; no tag created; memoryos-1.3-mo1305 absent and predecessor tags unchanged. |
| 47 | Exact next task | MEMORYOS 1.3 MO-1305 REST GATEWAY PHASE 3 TARGETED RECERTIFICATION — NOT READY. Resolve the additional blocker under an explicit scope exception first; do not start recertification from this provisional archive. |

MO-1305 PHASE 3 CORRECTION BLOCKED
