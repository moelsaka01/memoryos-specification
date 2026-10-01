# MO-1307 Phase 3AR2 native Windows installed-runtime certification

**PHASE3AR2_FAILED_INCOMPLETE.**

Candidate: C3UB `91c07b1e93f65ab6252024984073c171ff5d7648`; production commit C3U `34f42c50abfa1c440416c4cdf7f643f784585588`; production tree `302cf1a506e974b2102a78be1b9c920ac80105b2`.
Authority: `PROSPECTIVE_HELPER_BOUND@2.0.0`. Worktree: `C:\Users\melsa\Documents\Codex\3ar2\`; branch: `codex/mo1307-phase3ar2-c3ub`.

Fresh offline package: `sha256:c194c95ca417372476570cfc58f5a417fab6203b7b45507ce700b8276245d565`, 113229 bytes. Exactly 89 installed members verified byte-for-byte against C3UB before execution; post-run integrity PASS.
Runtime: Node 24.21.0 win-x64, SHA-256 ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32; native Windows PowerShell 5.1.26100.9444.
Mandatory inventory completed: 1/80 cases.

| Step | Result |
|---|---|
| A | PASS |
| B | FAIL |
| C | NOT_RUN |
| D | NOT_RUN |
| E | NOT_RUN |
| F | NOT_RUN |
| G | NOT_RUN |
| H | NOT_RUN |
| I | NOT_RUN |
| J | NOT_RUN |
| K | NOT_RUN |
| L | NOT_RUN |
| M | NOT_RUN |
| N | NOT_RUN |
| O | NOT_RUN |

First mandatory failure: B. Exact expected/actual case, request ordinals, errors, clocks, process state and cleanup state are retained in the step receipt and resource observations.
Completed steps: A. Unexecuted steps: C, D, E, F, G, H, I, J, K, L, M, N, O. Remaining mandatory cases: 79.

Limits: whole-helper lifecycle success <9000 ms; timeout >=9000 ms; helper-active aggregate <=20000 ms; CLI/rename admission <=30000 ms; API/worker <=10000 ms; cleanup <=2000 ms. Historical H remains NOT_ESTABLISHED. No retry, grace, late-success recovery, helper/helper overlap, or helper/worker overlap.

Historical evidence: 5370 files checked, 0 changed; none promoted. No diagnostic campaign, production change, push, tag, Phase 3BR2, Phase 3CR2, or Phase 3D execution.
CLI/API parity and cleanup claims are limited to retained completed observations. Byte determinism stage N: NOT_RUN.

Receipt: [certification-receipt.json](../repositories/cca-conformance/evidence/mo1307/phase3ar2-c3ub/certification-receipt.json).
Sealed inventory: [recovered-inventory.json](../repositories/cca-conformance/evidence/mo1307/phase3ar2-c3ub/recovered-inventory.json).
Resource/cleanup: [resource-and-cleanup-observations.json](../repositories/cca-conformance/evidence/mo1307/phase3ar2-c3ub/resource-and-cleanup-observations.json).

No Phase 3D handoff exists for this failed/incomplete Phase 3AR2 stream.
