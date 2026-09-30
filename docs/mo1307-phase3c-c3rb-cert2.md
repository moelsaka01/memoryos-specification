# MO-1307 Phase 3C: second fresh C3RB certification generation

**Phase 3C FAILED/INCOMPLETE.** Certification stopped at its first mandatory failed gate. All 551 primary corpus controls, including 426 rejection controls, remain NOT_RUN. No product defect is established and no accepted Phase 3D handoff exists.

Eight separate engineering validation checks passed before sealing. During the single sealed campaign, the authority/dependency binding stage passed six checks. The following native source-review stage failed: expected outer PowerShell exit 0, observed 1. Its wrapper emitted ENGINEERING_GIT_EXIT with no value after the colon at git-toolchain.ps1:22. This does not establish that Git itself exited 1. No diagnosis, repair, retry, replacement case or later certification stage followed the failure.

## Required final report

| # | Requested item | Result |
|---|---|---|
| 1 | Original harness failure | Prior failed commit 2fe26d371a394f631d0d1d25d979bfaba7265015 at C:/m7c is preserved. PowerShell could not resolve bare git at helper-review.ps1:22 (expected 0, actual outer exit 1). Classification: engineering harness/tool-resolution failure; no product defect established. |
| 2 | Exact Git resolution | C:/Program Files/Git/cmd/git.exe; git version 2.55.0.windows.3; 46,920 bytes; SHA-256 7b7971dd13f0c3a284e538601f2f9770b3a87dfaccb5fb52d68141c67ed22364. Resolved before harness edits from the literal path already observed in repository tool inventory; direct file/hash/Authenticode and absolute version/exec-path probes. No ambient lookup, download, network requirement or global PATH change. |
| 3 | Harness correction | Required explicit GitExecutable argument to helper-review.ps1; pinned launcher/core length and SHA-256; safe absolute argument-array invocation; pre/post identity checks and exact version check; shared explicit Node wrapper. Validate-only exits before source review. Certification child environment carries no inherited PATH. Product source is unchanged. The later wrapper failure means full source review remains unverified. |
| 4 | Fail-closed harness validation | 8/8 PASS_ENGINEERING_ONLY: PowerShell and Node each accepted the exact tool and rejected missing path, wrong hash, and correctly hashed non-executable fixture. All six negative checks returned expected failure, with no poisoned-PATH fallback marker and no product/source-review execution. These are separate from the 426 product rejection controls. |
| 5 | Candidate/worktree | C3RB defe93989efc6501b1a730b82e79e705884b269b; tree 54c8ca8acc388d8dcb5d8d76e119b434dcc1a9bb; integration/evidence 4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97. New C:/m7c2 on codex/mo1307-phase3c-c3rb-cert2. |
| 6 | Sealed security inventory | 551 unique primary controls, 426 rejection and 125 behavioral controls. Every control requires fresh execution; zero historical PASS/NOT_RUN rows adopted. New mapping, exact expected outcomes, tool bytes, finite 13-stage order and limits sealed before the campaign. |
| 7 | Executed controls | 1 campaign stage PASS (6 binding checks), 1 mandatory stage FAIL, 11 later stages NOT_RUN. Primary corpus: 0 executed, 0 PASS, 0 FAIL, 551 NOT_RUN. Engineering preparation checks are reported separately. |
| 8 | Negative-control results | Product corpus: 0/426 executed, all 426 NOT_RUN. Engineering preparation: 6/6 expected rejections passed; these do not certify product negatives. |
| 9 | Filesystem/native | Source/package/helper binding passed; native source-review gate INCOMPLETE. Native identities, validated/final paths, held handles, reparse/junction/symlink, hardlink and filesystem-boundary execution NOT_RUN. |
| 10 | Freshness/TOCTOU | All current controls NOT_RUN, including held/reopened/same-handle identity and final-path replacement protections. No defect or PASS inferred. |
| 11 | Protocol/topology | Wire 2.0.0, framing/session/sequence, one-helper and worker topology, and product quiescence NOT_RUN. No product native helper was launched by the stopped campaign. |
| 12 | Deadlines/cancellation | NOT_RUN. Helper 5000 ms; aggregate helper-active 20000 ms; worker/API 10000 ms; CLI 30000 ms; cleanup 2000 ms. H remains NOT_ESTABLISHED; no characterization or redesign. |
| 13 | Cleanup | Product cleanup controls NOT_RUN. Both launched engineering stages returned exit observations; no later campaign stage launched. This is not a product cleanup/quiescence PASS. |
| 14 | Environment/network | Product trusted-launch, environment and offline/network controls NOT_RUN. Toolchain resolution and preparations used existing local tooling; no hosted provider, network acquisition, download or global PATH change. |
| 15 | Secrets/logs | Product secret/log and error-boundary controls NOT_RUN. Raw engineering stdout/stderr retained unchanged; no runtime secret/log certification claim. Resource controls likewise NOT_RUN. |
| 16 | Governance | Fresh governance negatives NOT_RUN. Binding established byte/dependency equality, not organizational authentication or human authorization. Accepted Phase 3B 702c1b6381f6112a50ac844831d195275dac3350 remains untouched and was not rerun; no Phase 3A or 3D performed. |
| 17 | First failure | 02-native-source-review; repositories/cca-conformance/tools/mo1307-phase3c-c3rb-cert2/git-toolchain.ps1:22; ENGINEERING_GIT_EXIT with empty suffix; outer PowerShell expected 0, observed 1; stdout empty, stderr 437 bytes. Underlying cause unconfirmed. |
| 18 | Certification receipt | repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert2/certification-receipt.json: FAILED/INCOMPLETE. Raw failure, complete remaining inventory, ledger, preparation validation and preservation records accompany it. |
| 19 | Certification commit | The containing conformance-only commit has exact C3RB as sole parent. Its generated hash is supplied in the delivery response; no self-referential future hash is embedded here. |
| 20 | Phase 3C status | **FAILED/INCOMPLETE**, not accepted. |
| 21 | Repository status | Post-stop verification: 12035 preexisting checkout files unchanged, 74 pre-execution sealed members unchanged; both accepted historical 3C worktrees and all 57 files of C:/m7c failed generation byte-preserved and clean. Only new generation tools/evidence/report are to be committed. Final clean status is checked after commit and reported in delivery. |
| 22 | Phase 3D handoff | **None accepted.** Do not consume this failed generation as accepted Phase 3C input. Stop after Phase 3C; no Phase 3D started. |

## Tool identity and authorization

The preexisting Git for Windows installation is authorized repository engineering tooling for local worktree and evidence operations under the user request. Authenticode status was Valid, signer CN=Johannes Schindelin, O=Johannes Schindelin, L=Bruehl, C=DE, thumbprint 3E9627155B7A6F29856321EE56D7FC25CF808407. This identity evidence does not authenticate MemoryOS organizational approval.

Git core: C:/Program Files/Git/mingw64/bin/git.exe; 4383048 bytes; SHA-256 1a0043555d254618f2d56c936c3d9a1fbfb878bc878416a133c346bc7835eda9. Reported exec-path: C:/Program Files/Git/mingw64/libexec/git-core. Node v24.21.0 is bound at C:\Users\melsa\Documents\Codex\cca-mo1307-3c\.cache\mo1307-phase3c-runtime\node.exe; SHA-256 ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32. These were existing local tools, with no acquisition.

The missing-path, wrong-identity and non-executable checks ran once per implementation under a poisoned PATH. Validation-only receipts show no fallback and no certification execution. They establish those finite preparation results; they do not establish that the full PowerShell source-review path works. The subsequent sealed failure is retained separately and supersedes any implication of campaign readiness.

## Finite inventory and evidence preservation

The authoritative union was recovered mechanically from accepted original 3C 191f34748141afca2027e8e9db0c6f1b6a9c84c0 and accepted 3C-R f4ed5873969ab6b627941dc20d5823c5e853b9fe. Frozen current primary coverage is listed below; overlapping auxiliary witnesses are not counted again.

| Current suite | Primary controls | Rejection controls | Current result |
|---|---:|---:|---|
| root | 157 | 114 | NOT_RUN |
| trust-graph | 96 | 87 | NOT_RUN |
| governance-primary | 97 | 59 | NOT_RUN |
| governance-supplement | 18 | 12 | NOT_RUN |
| protocol | 12 | 11 | NOT_RUN |
| runtime-main | 76 | 71 | NOT_RUN |
| deadline-cleanup | 11 | 9 | NOT_RUN |
| equivalence | 67 | 55 | NOT_RUN |
| runtime-supplement | 15 | 6 | NOT_RUN |
| toctou | 2 | 2 | NOT_RUN |
| Total | 551 | 426 | NOT_RUN |

Binding verified candidate/runtime identity, exact historical and integration product equality, 89 shipped source members and 88 distribution entries plus helper/SBOM identities, committed historical evidence, 583 fixture files, 181 reviewed dependencies, and the current checkout baseline. These are limited integrity/binding results, not primary corpus results. File names such as reuse-dependencies.json and historical PASS values preserve provenance only; this fresh campaign adopts no historical control outcome.

Managed worktree creation failed on retained historical long paths before certification. The requested new short C:/m7c2 checkout was then created with explicit Git and command-scoped core.longpaths=true. C:/m7c was not overwritten. Preparation records preserve original tool bytes, the narrow Git correction, independent complete fresh runtime mappings, and pre-seal output-name adjustments. No expected negative outcome was weakened.

All post-stop operations are limited to reading preserved observations, rehashing evidence, reporting, and the conformance-only commit. They do not rerun certification. The pre-execution seal remains byte-exact. All 11 unexecuted stages and 551 current controls remain NOT_RUN. The original failed receipt remains byte-identical; accepted historical receipts remain preserved for their own exact scope.

The failure occurred between 2026-09-29T23:56:01.208Z and 2026-09-29T23:56:02.944Z. Raw stderr is the authoritative observation. The wrapper emitted no Git exit value; the classification describes the observed engineering failure without asserting its root cause. Product filesystem, trusted-launch, deadline, TOCTOU and protocol defects are not established.

Evidence: [receipt](../repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert2/certification-receipt.json), [first failure](../repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert2/first-failure.json), [raw stderr](../repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert2/02-native-source-review.stderr.txt), [execution ledger](../repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert2/execution-ledger.json), [all remaining controls](../repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert2/remaining-inventory.json), [harness validation](../repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert2/harness-validation/receipt.json), [tool resolution](../repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert2/git-resolution.json), [binding](../repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert2/binding.json), [preservation](../repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert2/preservation.json), [pre-execution seal](../repositories/cca-conformance/evidence/mo1307/phase3c-c3rb-cert2/pre-execution-seal.json).
