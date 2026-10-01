# MO-1307 prospective helper-bound candidate

Status: **AUTHORITY ADOPTED / CANDIDATE PREPARED FOR SEPARATE PHASE 3**.
This record adopts `PROSPECTIVE_HELPER_BOUND@1.0.0` for C3T and later
candidates. It is governance and pre-certification integration evidence, not a
Phase 3A, Phase 3B, Phase 3C, Phase 3D, release, push, or tag result.

## Normative rule

The prospective whole-helper lifecycle bound is 8,000 ms. A helper succeeds
only when its complete lifecycle finishes at elapsed time `< 8000 ms`; elapsed
time `>= 8000 ms` is `MO1307_TIMEOUT`. The measured interval continues to
include process creation, PowerShell startup, helper and native initialization,
request processing, response framing and writing, EOF, process exit, all pipe
settlement, and required helper/console quiescence.

The 20,000 ms aggregate helper-active budget, 30,000 ms CLI admission deadline,
10,000 ms API/worker limits, and separate 2,000 ms terminal-failure cleanup
allowance remain unchanged. Cleanup begins only after the terminal helper
outcome. There is no retry, deadline grace, or late-success recovery.

This is prospective authority. The historical 5,000 ms rule remains the rule
for its previous candidate generations and every retained timeout remains a
timeout. The abandoned replacement characterization remains
`H = NOT_ESTABLISHED`, as preserved by evidence commit
`2e4ea741143bb70b06c2863ffede863f23639028` and binding
`79ef47e608c67edc70f3e9f51d494b169794f903`. The 8,000 ms value is not H and
does not retroactively rewrite that methodology or its sealed fixture-identity
preparation defect.

## Candidate content

C3T starts from the clean characterization binding. Its production baseline is
the exact 89-member subtree already present there. That subtree includes only
the established final headless/post-detach and initial-zero fail-closed design,
the CreateFileW `SetLastError` correction, and the redundant `Open-Chain`
`Assert-Root` removal. Their dedicated local gates passed; their later stopped
certification generations remain stopped and are not promoted.

The earlier console-owner/host-termination designs, detached wire failure,
second post-detach membership query, diagnostic instrumentation, C3S closed
serializer, request-local buffer experiments, N17 fixture bytes, missing-leaf
diagnostics, and characterization helper copies remain historical only. The
fixed helper stays fresh-process, one-request/one-response wire 2.0.0 with fresh
native observations, checked handles, filesystem boundaries, TOCTOU controls,
byte/path caps, role exclusion, bounded cleanup, and fail-closed timeout.

The authoritative generator changes only `helperDeadlineMs`. Generated
definitions and runtime constants, package documentation, contract binding,
SBOM, and distribution manifest are rebuilt mechanically. Runtime deadline,
transport, and cleanup implementations consume that generated value and remain
byte-identical. All 89 package members remain explicit and the package retains
zero external production dependencies.

## History and handoff boundary

Historical C3RB `defe93989efc6501b1a730b82e79e705884b269b`, accepted Phase 3B
`702c1b6381f6112a50ac844831d195275dac3350`, accepted Phase 3C
`b02fc0226a1a2d800185a02071674ca80bdf4a1d`, and the separate historical
deadline-authority chain ending at
`4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97` are named history; none is
relabeled for C3T.

C3TB is the direct binding-only child of C3T. Separate workstreams must consume
that exact binding: a completely fresh installed Phase 3A A-O certification, a
candidate-bound Phase 3B artifact refresh, and the dependency-selected Phase 3C
refresh. Computed readiness and human release authorization remain separate.
The machine-readable authority, candidate inventory, validation receipt, and
three exact handoffs are under
`repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate/`.
