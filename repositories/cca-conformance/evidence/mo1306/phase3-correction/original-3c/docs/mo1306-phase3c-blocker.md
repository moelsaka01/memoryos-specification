# MO-1306 Phase 3C: stopped on exact-B2 command selector defect

Status: **BLOCKED. NOT READY FOR PHASE 3D INTEGRATION.**

Baseline: clean `mo1306/phase3c`, HEAD `0e35ffe70919d77b1db530929093826410b805f9`, verified before audit. All new files are confined to `C:\Users\melsa\Documents\Codex\cca-mo1306-3c`. Production and historical evidence remain unchanged. No release-ready certification or binding commit is created after the mandatory stop.

## Confirmed blocker: MO1306-3C-001

The public command selector in `repositories/memoryos-ci/bin/memoryos-ci.mjs:19` indexes an ordinary object without requiring an own property. The inherited names `constructor`, `toString`, and `__proto__` bypass the unknown-command rejection and reach `allowed.filter(...)` at line 26. The resulting TypeError is projected by the top-level handler as `MO1306_INTERNAL_FAILURE`, stage `INTERNAL`, exit 16.

Freeze section 4 closes the public command set to `run`, `generate`, and `verify`. Section 18 and the frozen error catalog require invalid usage to be `MO1306_USAGE`, stage `LAUNCH`, classification `CONFIGURATION_ERROR`, exit 10. The ordinary invalid-command control follows this mapping; the three inherited names do not.

| Selector | Required | Observed | Conforms |
| --- | --- | --- | --- |
| invalid-command | USAGE / LAUNCH / 10 | USAGE / LAUNCH / 10 | Yes |
| constructor | USAGE / LAUNCH / 10 | INTERNAL_FAILURE / INTERNAL / 16 | No |
| toString | USAGE / LAUNCH / 10 | INTERNAL_FAILURE / INTERNAL / 16 | No |
| __proto__ | USAGE / LAUNCH / 10 | INTERNAL_FAILURE / INTERNAL / 16 | No |

This is a frozen public launch/error-model defect. No command execution, semantic-policy bypass, credential exposure, or security exploit was demonstrated. All four invocations returned empty stdout and one canonical fixed-prose diagnostic on stderr.

The exact-B2 witness uses pinned Node 24.21.0, 93,580,104 bytes, SHA-256 `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`, direct argv, closed stdin, a ten-second per-case deadline, and only SystemRoot/WINDIR in the child environment. It needs no provider account or network. Runtime and source digests, expected/actual outcomes, separate streams and command arrays are retained in [command-selector-blocker.json](../repositories/cca-conformance/evidence/mo1306/phase3c/command-selector-blocker.json).

Reproduce with the pinned runtime from the worktree root:

```text
.cache/mo1305-phase3br/toolchain/node-v24.21.0-win-x64/node.exe --max-old-space-size=128 repositories/memoryos-ci/bin/memoryos-ci.mjs constructor
```

[blocked-command-audit.py](../repositories/cca-conformance/tools/mo1306-phase3c/blocked-command-audit.py) has a `record` mode that refuses to overwrite the retained witness and a read-only `verify` mode. Verification checks the exact source identities and rejects eight evidence mutations: forged PASS, wrong baseline, hidden blocker, unsafe integration authorization, omitted case, altered outcome, wrong runtime identity and source drift. A successful evidence-validator result validates the blocked observation, never the candidate.

## Stop disposition and partial audit

The owner's section 23 requires STOP on a substantive candidate defect, forbids silent production fixes and forbids 3D binding a defective candidate. Further certification campaigns were stopped after confirmation; two already-running offline provider suites were allowed to finish. No production fix was attempted. The requested success footer would misrepresent this result and is not issued.

| Requested area | Actual disposition at stop |
| --- | --- |
| Baseline | Exact clean B2 and branch independently verified. |
| Semantic authority | Common/delegate/worker and adapter inspection found SDK 1.1.0 delegation, with no provider policy evaluator. Full closure/identity verification not completed. |
| Generic/result/errors | Confirmed blocker MO1306-3C-001; frozen public usage error mapping fails for inherited selectors. |
| GitLab/Jenkins | Read-only retained-fixture tests: 91 GitLab and 110 Jenkins, all 201 passed. Independent official-schema/restricted-parser code inspected; no Groovy execution. These tests are partial evidence, not final exact-B2 certification. |
| Azure | Read-only retained fixture passed official-schema/subset/PowerShell AST validation; 59 mutations rejected. Full independent traversal of all 698 local reference targets and exact-B2 generation were not completed. |
| GitHub | Offline transport suite on pinned Node: 33/33 passed. Workflow, windows-2022, manual trust, bootstrap, action pins, permissions, run UUID, completion and basename allowlist inspected. Full evidence validation and hosted execution not performed. Initial 33-test ambient-Node run is diagnostic only and excluded from certification totals. |
| MO-1302 preservation | Preservation documentation and retained records inspected; complete fresh blob verification and regression replay not completed. No MO-1302 file changed. |
| Provider equivalence | Partial common projection/transport review; all-five full classification/evidence closure not completed. |
| Filesystem/network/environment/process/shell | Common implementation and Correction A inspected; audit stopped before complete independent boundary/lifecycle verification. Blocker witness uses direct argv and a two-variable environment. No OS-wide denial or process-isolation claim. |
| Injection/secrets/trust | Provider parser and GitHub transport negatives partially executed; public selector conformance defect confirmed. No credential or provider service operation. |
| Evidence/determinism | Blocker evidence is source/runtime-bound and canonical UTF-8/LF. Fresh all-five deterministic generation and full result/evidence digest verification not completed. |
| Historical preservation | No prior failure, stop, receipt or production file changed. B1 replay and full I2/B2/source graph checks not completed. |
| Provider labels | B2 labels unchanged. No generic/GitHub certification promotion and no live GitLab/Jenkins/Azure claim. |
| Release closure matrix | Not completed after mandatory STOP; no SATISFIED or release-ready row counts asserted. One confirmed candidate blocker; remaining audit requirements unclosed. |
| Pending 3A | Windows generic final certification and GitHub hosted certification remain owned by 3A; no result inferred. |
| Pending 3B | Final package, distribution and supply-chain certification remain owned by 3B; no result inferred. |
| Pending 3D | Final integration/binding cannot proceed while MO1306-3C-001 remains in the candidate. |
| Negative witnesses and counts | Recorded selector witness: 4 cases, 1 conforms and 3 fail; evidence verification: 1 positive and 8 mutation rejection checks. Independent partial suites: 201 provider unit tests, 33 pinned GitHub transport tests and 59 Azure mutation checks. These heterogeneous counts are not combined or relabeled as complete certification. |
| Workspace and whitespace verification | See [stop-validation.json](../repositories/cca-conformance/evidence/mo1306/phase3c/stop-validation.json). |
| Commit | No new commit under mandatory stop; HEAD remains exact B2. Requested certification commit and parent relationship not created. |
| Push/tag/merge | None. |
| Linux/Ubuntu/WSL/VM | None. |
| Provider accounts | None. |

## Phase 3D integration notes

Do not bind exact B2 as a release-ready candidate or treat the passed partial suites as final 3C acceptance. The defect requires a separately authorized production correction with closed command selection and regression cases for inherited Object.prototype names. Any corrected candidate will have new distribution/contract-dependent identities and must receive the required affected validation, new immutable binding and resumed independent audit. Retain this failed B2 witness unchanged. Do not silently relabel it PASS or reuse exact-B2 certification against changed production bytes.

No expensive campaign was rerun. The audit began at approximately 2026-09-26 18:12 UTC; the final validation receipt records elapsed wall time. It stopped well before the 90-minute target and three-hour hard limit.
