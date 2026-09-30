# MO-1307 Phase 3A native Windows installed-runtime certification

**Phase 3A FAILED/INCOMPLETE.**

Candidate: C3RB `defe93989efc6501b1a730b82e79e705884b269b`. Integration/evidence authority: `4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97`.
Worktree: `C:\m7a2\`; branch: `codex/mo1307-phase3a-c3rb-restart`.

Fresh offline package: `sha256:341f67e821a56cf88133e8b361e8c670849ff9feaf583ae2732cc3ca61d389a2`, 112338 bytes. Exactly 89 installed members verified against C3RB before execution; post-run integrity PASS.
Runtime: Node 24.21.0 win-x64, SHA-256 ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32; native Windows PowerShell 5.1.26100.9444.

| Step | Result |
|---|---|
| A | PASS |
| B | PASS |
| C | PASS |
| D | PASS |
| E | PASS |
| F | PASS |
| G | FAIL |
| H | NOT_RUN |
| I | NOT_RUN |
| J | NOT_RUN |
| K | NOT_RUN |
| L | NOT_RUN |
| M | NOT_RUN |
| N | NOT_RUN |
| O | NOT_RUN |

First mandatory failure: G. Exact expected/actual case, request ordinals, errors and clocks are retained in the step receipt and resource observations.
Completed: A, B, C, D, E, F. Unexecuted: H, I, J, K, L, M, N, O.

Limits preserved: helper lifecycle 5000 ms; helper-active aggregate 20000 ms; CLI/rename admission 30000 ms; API/worker 10000 ms; failure cleanup 2000 ms. Replacement helper bound H remains NOT_ESTABLISHED. Admitted rename settlement has no invented finite bound.

Historical evidence: 2527 files checked, 0 changed; none promoted. No retry, diagnostic campaign, production change, push, tag or Phase 3B/3C/3D execution.
CLI/API parity and cleanup claims are limited to retained completed observations. Byte determinism stage N: NOT_RUN.

Receipt: [certification-receipt.json](../repositories/cca-conformance/evidence/mo1307/phase3a-c3rb-restart/certification-receipt.json).
Sealed inventory: [recovered-inventory.json](../repositories/cca-conformance/evidence/mo1307/phase3a-c3rb-restart/recovered-inventory.json).
Resource/cleanup: [resource-and-cleanup-observations.json](../repositories/cca-conformance/evidence/mo1307/phase3a-c3rb-restart/resource-and-cleanup-observations.json).

No accepted Phase 3A handoff; failed/incomplete stream must be handled separately.
