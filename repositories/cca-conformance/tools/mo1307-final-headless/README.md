# MO-1307 final headless correction validation

These engineering tools implement the finite prospective authorization saved in
`evidence/mo1307/final-headless/authorization.txt` and the addendum at
`docs/mo1307-final-headless-correction-addendum.md`. Historical tools, failures,
the sealed prior specification and the T018 diagnostic remain unchanged.

The root operator invokes the pinned Node 24.21.0 Windows executable. No alternate
evidence directory, case selection, retry or fallback launch is supported.
The five files in this validation set must be frozen before the smoke seals them.

1. Run `minimum-wire-smoke.mjs` exactly once after production review and package
   metadata checks. It binds the authorization, addendum, independent production
   review, all 89 current package members, runtime files, request, input, matrix
   and security tooling. Candidate remains null until all validation passes.
2. Only if that receipt is PASS, run `security.mjs` exactly once. It verifies
   current source, actual executing runtime, authority and tooling against the
   smoke seal, then executes the 19 A-S categories in order.
3. Only after security PASS may the root operator run the separate required
   regression adapters. The 107-test campaign uses the exact predeclared test
   names individually and stops at the first mandatory test failure. Native
   filesystem, protocol, TOCTOU, deadline/cancellation, topology and package
   requirements remain mandatory. No full-suite retry or historical PASS
   promotion is admitted.

The smoke is the only real production helper invocation in this smoke/security
pair. Its sole success route requires three valid pipes, positive membership of
exactly its own PID, successful self-FreeConsole and request consumption. A valid
matching frame plus separate process/stream/supervisor observations establishes
the specified helper and transport quiescence. A failed receipt makes no success
claim. No diagnostic helper is launched.

Security reuses that fresh smoke as A. It runs 15 separate engineering PowerShell
processes against the byte-exact extracted production startup function: one
accepted sole-helper case and 14 refusals. Native methods are deterministic
doubles. The FreeConsole false and throw cases exercise the real function's
control flow; they are not forced failures of the live Windows API. The initial
zero cases label error contexts 6, 5 and 203 without setting LastError: the new
function never reads an error value and rejects every zero return. Every proof
records exact call counts; invalid pipes cause no membership query, and no case
permits a second query.

Lifecycle controls use production transport/supervisor code with in-memory child
and stream doubles and injected monotonic clocks. They cover crash, timeout,
late output, delayed closure, quiescence, both helper/helper and helper/worker
exclusion, and exact deadline boundaries. They do not certify real OS timing.

Helper 5000 ms, aggregate 20000 ms, CLI 30000 ms, API/worker 10000 ms and cleanup
2000 ms remain unchanged. Cleanup arithmetic is exact:
`cleanupDeadline === terminalAt + 2000`. There is no host wait, host discovery,
host termination, allocation, reattachment, speculative ownership or claim that
an unidentified console host died.

Every case writes an append-only receipt and bounded raw output. The first
unexpected failure stops all later cases. Partial captures and failure evidence
are preserved. No security failure authorizes another smoke or diagnostic cycle.
