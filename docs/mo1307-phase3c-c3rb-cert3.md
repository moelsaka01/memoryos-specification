# MO-1307 Phase 3C: third fresh C3RB certification generation

**Phase 3C ACCEPTED.** All 551 fresh primary controls passed, including 426 rejection controls; all 561 required raw witnesses and all 13 stages passed. The campaign ran once, with no mandatory failure, retry, in-campaign repair or adaptive expansion. Product source remains exact C3RB.

## Required final report

| # | Requested item | Result |
|---|---|---|
| 1 | Exact empty-exit cause | Prior validation supplied PATHEXT=.CMD;.EXE while campaign launch omitted PATHEXT. Controlled original-wrapper reproductions showed the PowerShell call operator produced no native output/status without .EXE; the explicitly reset global LASTEXITCODE remained null and concatenation emitted an empty suffix. Adding only PATHEXT=.EXE restored exact stdout and numeric0 through direct, nested, expression, array and pipeline paths. This was not a demonstrated Git exit1 or a scope-shadowing defect. The historical child exit remains unobserved. |
| 2 | Wrapper correction | Exact pinned Git via System.Diagnostics.Process/UseShellExecute=false and explicit Process.ExitCode in PowerShell; spawnSync.status in Node. Separate bounded stdout/stderr bytes, identity checks, immutable capture records, and fail-closed missing/unobserved/capped/error outcomes distinguish Git failure, wrapper failure, outer PowerShell failure and source-review assertions. No PATH/PATHEXT dependence. |
| 3 | Engineering validation | Final finite18/18 PASS_ENGINEERING_ONLY: both implementations captured numeric0,1,6 and exact stdout/stderr; missing/wrong/non-executable tools and output overflow refused; nested call and noPATH/noPATHEXT/poisonedPATH checks passed. A preceding stderr-fixture expectation encountered sandbox ownership refusal; its complete failed preparation receipt remains preserved. No product control was certified by preparation checks. |
| 4 | Exact Git identity | C:/Program Files/Git/cmd/git.exe; git version 2.55.0.windows.3;46920 bytes; SHA-256 7b7971dd13f0c3a284e538601f2f9770b3a87dfaccb5fb52d68141c67ed22364. Core C:/Program Files/Git/mingw64/bin/git.exe; SHA-256 1a0043555d254618f2d56c936c3d9a1fbfb878bc878416a133c346bc7835eda9. Known identity was reused and rechecked, with no discovery, download/install or global PATH change. |
| 5 | Candidate/worktree | C3RB defe93989efc6501b1a730b82e79e705884b269b; tree 54c8ca8acc388d8dcb5d8d76e119b434dcc1a9bb; integration/evidence 4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97. New C:/m7c3; branch codex/mo1307-phase3c-c3rb-cert3. |
| 6 | Sealed corpus | Mechanically recovered551 case-sensitive primary IDs/426 rejection controls from accepted original3C and3CR, including every frozen expected tuple and witness. All238 pre-execution sealed members remained exact. Failed-generation results supplied no current PASS. |
| 7 | Executed controls | 551/551 primary PASS_FRESH;561/561 raw witnesses PASS;13/13 stages PASS. Separate six binding checks and source review passed. Zero NOT_RUN. |
| 8 | Negative controls | 426/426 product rejection controls PASS_FRESH. Preparation refusals remain a separate engineering result. No negative predicate weakened. |
| 9 | Filesystem/native | Native source review and equivalence/negative controls PASS for frozen final paths, identities, held handles, reopens, reparse/junction/symlink, hardlinks and filesystem boundaries. Physical-volume and trusted-host/private-root scope limits remain. |
| 10 | Freshness/TOCTOU | Frozen final-path, same-handle/reopen identity and controlled replacement/TOCTOU witnesses PASS. No cached historical outcome adopted. |
| 11 | Protocol/topology | Frozen wire2.0.0 framing/session/sequence, consumer decoding, one-helper/worker topology and quiescence controls PASS.13 protocol raw witnesses support12 primary controls. |
| 12 | Deadline/cancellation | Required deadline/cancellation witnesses PASS. Helper5000ms; aggregate helper-active20000ms; worker/API10000ms; CLI30000ms; cleanup2000ms. H remains NOT_ESTABLISHED; no redesign or characterization. |
| 13 | Cleanup | Frozen cleanup and targeted process/pipe closure controls PASS. Conservative cleanup flags remain unchanged. Engineering Git guard durations and owned-shim cleanup are separately scoped and do not establish product deadline or full descendant-tree cleanup claims. |
| 14 | Environment/network | Frozen trusted-launch, environment and offline/network controls PASS within their source/finite-test scope. No network acquisition or hosted provider was used; no OS-wide egress firewall claim. |
| 15 | Secrets/logs | Frozen sentinel/log/error-boundary controls PASS. Exact engineering Git output streams retained. Resource controls PASS within frozen caps/representative observation scope; no new hard-RSS guarantee. |
| 16 | Governance | Fresh trust/graph and governance controls PASS, preserving human authority separation. Byte identity is not organizational authentication. Accepted Phase3B 702c1b6381f6112a50ac844831d195275dac3350 was untouched/not rerun. No Phase3A or3D performed. |
| 17 | First failure | No mandatory failure in this campaign. Both earlier failed generations and the separate preparation fixture mismatch remain preserved with their exact results. |
| 18 | Certification receipt | repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert3/certification-receipt.json: PASS / Phase3C ACCEPTED. Finite witnesses, ledger, raw streams, seals, current-control results and preservation records accompany it. |
| 19 | Commit | The containing conformance-only commit has exact C3RB as sole parent; its generated hash is supplied in delivery, avoiding a self-referential future hash. |
| 20 | Phase3C status | **ACCEPTED** for this exact candidate, finite inventory and recorded scope. |
| 21 | Repository status | 12035 preexisting files,238 sealed members, accepted historical3C/3CR evidence and both failed generations rehashed unchanged. Only this generation evidence/tools/report are committed; final clean status is verified after commit and supplied in delivery. |
| 22 | Phase3D handoff | Exact handoff at repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert3/phase3d-handoff.json. Consume this containing commit and receipt against exact C3RB; retain accepted3B and require independently accepted3A before3D. No Phase3D started. |

## Fresh inventory results

| Suite | Primary | Rejection | Raw witnesses | Result |
|---|---:|---:|---:|---|
| root | 157 | 114 | 157 | PASS |
| trust-graph | 96 | 87 | 96 | PASS |
| governance-primary | 97 | 59 | 97 | PASS |
| governance-supplement | 18 | 12 | 18 | PASS |
| protocol | 12 | 11 | 13 | PASS |
| runtime-main | 76 | 71 | 76 | PASS |
| deadline-cleanup | 11 | 9 | 18 | PASS |
| equivalence | 67 | 55 | 69 | PASS |
| runtime-supplement | 15 | 6 | 15 | PASS |
| toctou | 2 | 2 | 2 | PASS |
| Total |551|426|561|PASS|

The 10 additional raw witnesses are mandatory supporting observations, not extra primary controls. In particular, both request-layer and native path-cap witnesses are required for helper-path-count129; reconciliation checks all18 deadline rows. No old PASS or NOT_RUN result was promoted. Each current primary record links to its fresh receipt, expected/actual observation and historical authority provenance.

## Preservation and engineering evidence

Prior failed commits 2fe26d371a394f631d0d1d25d979bfaba7265015 (C:/m7c) and f35dfcbfa99691eda26a9668e43e07914a83df8d (C:/m7c2) remain clean and byte-identical. Their receipts were not rewritten. Original accepted3C and3CR also remain unchanged. Production source/package/helper bindings,583 fixture files and181 reviewed dependencies matched exact authority.

The actual campaign retained 33 explicit Git captures (19 PowerShell and 14 Node). Every capture has numeric child exit0 and complete separate stdout/stderr. The source-review gate emitted PASS after successful capture; outer PowerShell exit0 is recorded independently in the campaign ledger.

Preparation retained its initial sandbox-ownership stderr mismatch before using a repository-independent malformed-regexp fixture. New worktree creation occurred only after final18-check validation passed. Managed creation then failed on retained historical path lengths, so the requested short path was created using command-scoped core.longpaths=true. A preparation assertion initially expected currentStatus while the recovered mapping used status; that stopped before sealing. Normalization added currentStatus=NOT_RUN without changing any ID, predicate or expected result. Both setup observations remain recorded.

Bounded engineering capture is not a product resource sandbox: PowerShell uses60s per call and64MiB per stream with separate2s drain/kill guards; Node uses60s/128MiB bounds. The process handle owns the launched Git shim, and descendant-tree cleanup is not claimed. Successful ordinary captures are complete; partial/capped/unobserved results fail closed.

Evidence: [receipt](../repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert3/certification-receipt.json), [current controls](../repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert3/current-control-results.json), [execution ledger](../repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert3/execution-ledger.json), [wrapper analysis](../repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert3/wrapper-analysis.json), [engineering validation](../repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert3/harness-validation.json), [preservation](../repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert3/preservation.json), [Phase3D handoff](../repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert3/phase3d-handoff.json).
