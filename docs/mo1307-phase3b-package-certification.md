# MO-1307 Phase 3B package certification

## Disposition

The exact B2 candidate `976d4a04d75dadc02e30215dd5a8ddeaa2352df8` was certified mechanically as `memoryos-readiness@0.1.0` / `memoryos.readiness@1.0.0`. The Phase 3B result is **QUALIFIED_PHASE3B_PASS_PENDING_PHASE3D**. It is not final release authorization, does not repeat Phase 3A native-runtime certification or Phase 3C security review, and accepts no advisory risk on behalf of a release authority.

## Artifact and package closure

`memoryos-readiness-0.1.0.tgz` is 112,154 bytes, SHA-256 `6335c3ae18d9ab2ba1af3523d3dd4458ca832ed37fdce868729409277533744b`, SHA-512 `3d71acca28fc89b7292bf0ea0024041fe51ee1191c38713a98aeaca8db1dd94cc9068a118a5a5326b2cf0311a8b3a8cff8eeb0e31499dc7260b4d8ea5e4521fe`. It contains 89 regular members, each under `package/`; observed USTAR metadata is uid/gid 0, mode 0644, fixed mtime 499162500 and no PAX fields. Allowlist, canonical package metadata, distribution manifest and contract manifest checks pass. The distribution manifest has 88 bound rows, excluding itself to avoid recursive self-binding. The contract has 53 members.

The embedded SBOM is SPDX 2.3 with one package, 87 files and 88 relationships. Its two explicitly excluded cyclic files are `distribution-manifest.json` and `sbom.spdx.json`; the distribution manifest binds the SBOM bytes. No remote schema retrieval occurred.

## Runtime and supply

The production npm dependency count is zero. Static runtime closure resolves only to approved package members or allowed Node built-ins. Node is `24.21.0` win-x64 with verified SHA-256 `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`; npm `11.19.0` is engineering/install tooling only. Windows PowerShell 5.1 is an external platform dependency. The shipped helper `helpers/windows-inspect.ps1` SHA-256 is `ba2ffa58f253c3b8135772a880b5d306f20de56efa58e384907122f088b4a21b`.

All 52 shipped schemas are included in the canonical package closure. The Phase 2D authority retains the 464 positive and 12 negative schema-fixture relationship; Phase 3B checked package-bound schema identity rather than re-running the Phase 3A runtime campaign. First-party license status is `UNLICENSED`/`NOASSERTION`, with `LICENSE-NOTICE.md` and `NOTICES.md` accounted for; no blanket license was inferred.

## Reproducibility and installed package

Two independently fresh B2-source assembly roots were packed with npm using explicit caches and `--ignore-scripts`. Their archive bytes are identical. A fresh local archive install used `--offline --ignore-scripts --no-audit --no-fund` and an empty explicit cache. From a cwd outside the source worktree with `NODE_PATH` neutralized, the installed public API loaded successfully and the CLI rejected a closed invalid invocation with the expected `MO1307_USAGE` exit 10. The installed 89-file inventory was unchanged before and after smoke.

## Advisory and open findings

The dated 2026-09-29 bounded advisory review covers Node 24.21.0, npm 11.19.0 engineering tooling and Windows PowerShell 5.1. It used the Node release stream, Node’s July 2026 security release publication, and Microsoft’s Windows PowerShell update guidance. No package-specific production npm advisory is unresolved. Node’s July 2026 HTTP/2 findings remain an explicit Phase 3D/runtimescope reconciliation item; the selected Node release postdates that publication. This is not a claim that no vulnerabilities exist.

## Tamper controls and evidence

Observed controls reject archive-byte mismatch, missing and extra members, manifest/SBOM/schema tamper, runtime import/source-worktree dependency, and unexpected production dependencies; installed inventory detects post-install mutation. Unsafe tar paths and non-regular member types were rejected by an independent archive-policy negative; provenance byte tamper and installed inventory mutation were detected. Phase 3D still binds these results with the other Phase 3 streams before final authorization.

Evidence is retained in `repositories/cca-conformance/evidence/mo1307/phase3b/`, including the exact archive, archive inventory, installed inventories, tamper record and certification receipt. No production, package source, schema or dependency file was changed. No push, tag, Linux/Ubuntu/WSL, VM or provider account was used.