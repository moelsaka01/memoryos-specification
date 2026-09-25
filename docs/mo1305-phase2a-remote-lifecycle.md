# MO-1305 Phase 2A: remote mode and lifecycle

Phase 2A is an isolated implementation workstream based directly on B1
`b6c397b99e1f8bfcd04be972f35069f8737a4137`, on `mo1305/phase2a` in
`C:\Users\melsa\Documents\Codex\cca-mo1305-2a`. The baseline subject is
`conformance(memoryos-1.3): bind MO-1305 phase 1 foundation`.
The machine-validated results and actual execution counts are in
[`evidence/mo1305-phase2a`](../repositories/cca-conformance/evidence/mo1305-phase2a/).
They are modular workstream evidence, not B2, a release archive, or Phase 3 certification.

## Contract and implementation

The original [freeze](mo1305-contract-freeze-1.md), its
[platform correction](mo1305-contract-freeze-1-platform-correction.md),
[verification correction](mo1305-contract-freeze-1-verification-methodology-correction.md),
and [host-interruption policy](mo1305-host-interruption-validity.md) remain authoritative.
All Phase 1 receipts, the conformance inventory, source closure, API/OpenAPI,
FINAL limits and predecessor sources remain unchanged. Phase 1 retains its
105 functional cases, 20 adverse cases, 15 resource vectors and 450 valid resource
observations. No resource characterization or new limit derivation ran here.
The semantic deadline remains 31,400 ms under the corrected 60,000 ms ceiling;
all final memory and wire budgets remain byte-identical to B1.

Remote mode now accepts the already-frozen explicit `mode: "remote"` configuration.
An explicit canonical IPv4 address must be assigned to a non-loopback interface
within RFC1918; network/broadcast addresses, /31 and /32, wildcard, public,
link-local, DNS, abbreviated literals and IPv6 remain rejected. The default remains
local `127.0.0.1:13050`. Remote failure creates no fallback listener. Networking,
firewall and routing configuration are untouched.

The existing token and TLS prerequisites still complete before listening. The
credential remains 32 random bytes represented by 64 lowercase hexadecimal ASCII
characters, using the existing constant-time decoded-buffer comparison. Every
route requires exactly the frozen bearer header. Tokens and certificates rotate
by restart. TLS remains native TLS 1.3 and HTTP/1.1 with certificate validity,
matching EC P-256 PKCS#8 key and bind-address IP SAN validation. Diagnostics use
fixed gateway codes; no test private key or token is committed.

The internal lifecycle is `INITIALIZING` -> `READY` -> `DRAINING` -> `STOPPED`.
Startup or fatal runtime failures enter `FAILED`; shutdown still performs cleanup.
The state and engineering observers are not HTTP endpoints or configuration flags.
Readiness continues to mean verified startup, no draining/poison, and a free
semantic owner at inspection. An occupied owner yields BUSY and reserves nothing.
Integrity failure suppresses publication and initiates shutdown.

The product installs signal/control handlers before asynchronous startup. On
Windows, Node's anonymous stdin pipe is a `Socket` stream but does not report a
POSIX FIFO file type; the implementation tests the stream type and excludes TTY
EOF. All nonempty stdin remains invalid control input. A control event already
observed before listen prevents readiness/listening; physical pipe closure can
be delivered after startup, and the tests do not invent cross-process event ordering.

Shutdown closes the listener, cancels unpublished work, terminates/reaps its
worker, and drains published responses within the unchanged 10-second write
bound. It maintains a referenced absolute monotonic 15-second deadline through
listener-close completion, forcing exit 1 if cleanup cannot finish. A later fatal
trigger upgrades an already active requested drain. Worker termination retains its
2-second bound. Generation exhaustion produces UNAVAILABLE and orderly shutdown.
No semantic outcome, cancellation owner, or publication boundary is redefined.

## Focused evidence and reproducibility

Run the new tools from the dedicated worktree using the exact pinned Node 24.21.0
executable placed at `.cache/mo1305-phase2a/toolchain/node.exe` (SHA-256
`ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`):

```text
node repositories/cca-conformance/tools/mo1305-phase2a/lifecycle.mjs
node repositories/cca-conformance/tools/mo1305-phase2a/remote.mjs
node repositories/cca-conformance/tools/mo1305-phase2a/setup.mjs
python -B repositories/cca-conformance/tools/mo1305-phase2a/signals.py <pinned-node> <stage-directory>
node repositories/cca-conformance/tools/mo1305-phase2a/regressions.mjs
node --test --test-concurrency=1 repositories/memoryos-rest/tests/*.test.mjs
node repositories/cca-conformance/tools/mo1305-phase2a/evidence.mjs collect
node repositories/cca-conformance/tools/mo1305-phase2a/evidence.mjs verify
node --test repositories/cca-conformance/tools/mo1305-phase2a/evidence.test.mjs
python -B tools/verify_workspace.py --root .
git diff --check
```

`setup.mjs` stages the exact manifest-listed source files under this worktree's
ignored `.cache/mo1305-phase2a`, recomputing only the staged distribution manifest.
It creates fresh private-ACL test credentials and a test certificate, validates the
trusted launcher prerequisites and chooses an unused unprivileged port. These are
source staging fixtures; no npm install, distribution archive or packaging PASS
is claimed. The committed source distribution manifest remains the B1 artifact;
Phase 2D must regenerate package artifacts after integrating 2A/2B/2C.

The lifecycle suite uses separate real gateway processes and real TCP/TLS 1.3/
HTTP/1.1, normal CA/IP verification, actual workers, complete request/response
checks and bounded process/socket cleanup. It covers normal/failed/aborted startup,
pipe and non-pipe control, ready/busy/failed transitions, listener errors,
disconnects, worker exits, stale messages, generation exhaustion, integrity poison,
shutdown during each applicable request phase, and repeated rebind. Both local and
actual assigned private-interface mode test the 32-socket bound, one request per
connection, no keep-alive reuse, and no second pipelined dispatch.

Faults are confined to the non-shipping supervisor: withheld TLS Writable
completion, stalled listener-close completion, malformed/stalled workers, and
shutdown at reaping/ready/published ownership transitions. Actual TLS bytes still
flow for blocked-writer tests. This explicitly distinguishes controlled stream
completion from a naturally full Windows TCP receive buffer. Forced-deadline
witnesses retain the unchanged real 2-, 10- and 15-second bounds. Existing deadline
regressions cover exact N-1/N/N+1 monotonic comparisons. Sampled lifecycle memory
checks are engineering observations, not new characterization, instantaneous OS
containment, or a replacement for Phase 1 resource evidence.

Remote evidence records the actual assigned address/interface and the separate
server process, TLS version, CA verification, authentication and restart checks.
The clients are separate processes on the same Windows host, connecting to its
assigned `192.168.1.53/24` Wi-Fi address; no off-host LAN reachability is claimed.
Loopback is never relabeled remote. Real hidden-console CTRL_C delivery proves
Windows SIGINT shutdown. Windows does not provide native POSIX SIGTERM delivery;
`ChildProcess.kill('SIGTERM')` is not claimed as a graceful signal test.

Final focused coverage is 30 lifecycle cases, 65 remote/bind/TLS/auth cases, and
one native Windows signal case (96 PASS). The lifecycle cases include 11 fixed
semantic parity vectors. Five final assertions were strengthened and re-executed
to prove automatic fatal/generation exit before supervisor EOF and to count
pipelined worker creation through completed cleanup.

Completed assertions were retained only when the product manifest and exact case
identity matched. Immutable prior receipts preserve the earlier failed attempt,
intermediate successful result, and explicit retained-case lineage. The remote
continuation ran only the final two restart/rebind cases after an ACL setup error.
No entire-suite rerun is implied by the aggregate case count.

Development failures were retained separately in the ignored cache: the initial
Windows FIFO classification bug, an over-strong early-control delivery assertion,
observer timing at a controlled ready-state cancellation, and a redundant test ACL
reset. Final results require the corrected source identity. No failed observation
is relabeled PASS. The committed host-interruption policy is unchanged: no unknown
pause is excused as Modern Standby, and no resource observations are replaced here.

The affected REST unit suite passed 27/27. The six frozen predecessor groups
passed all 235 selected cases: MO-1301 SDK 131, Core MIP 60, MO-1302 projections 5,
MO-1303 I/O/inspection 6, MO-1304 semantic/integrity 27, and CLI secondary 6.
MO-1302 coverage combines four completed TAP cases from a harness-timeout run and
its one missing case from a successful focused run; it does not claim a single
successful five-case process. Earlier timeout and missing-dependency setup receipts
remain failures. Missing development packages were supplied by exact offline copies
matching the committed locks/closure, with no source/lock or network changes, then
moved into ignored cache with byte-for-byte relocation records. Reproduction of the
predecessor suite requires these exact locked dependencies in their original module
resolution locations. The evidence verifier itself needs no ignored dependency copy.

The final evidence validator passed 29/29 checks with directly captured TAP
output. Exact executed regression-harness bytes and the pre-normalization receipt
are retained; the validator proves the final runner differs only by LF line endings
and one final newline. The REST unit output, final validator TAP, collection and
verification output, workspace verifier output and file manifest are in [`mo1305-phase2a-validation`](../repositories/cca-conformance/evidence/mo1305-phase2a-validation/).

## Scope and Phase 2D integration

Shared production paths and mechanical reasons:

| Path | Phase 2A reason |
|---|---|
| `repositories/memoryos-rest/src/config.mjs` | Remove the explicit Phase 1 remote prohibition; reject unsupported mode values before binding validation. |
| `repositories/memoryos-rest/src/server.mjs` | Track lifecycle state, handle startup failure/abort, upgrade fatal drains, enforce bounded listener cleanup, shut down on generation exhaustion and canceled-owner integrity poison, and prevent stale socket-close deletion. |
| `repositories/memoryos-rest/bin/memoryos-rest.mjs` | Install startup signal/control handling, recognize Windows supervisor pipes, preserve nonempty-input rejection and remove control handlers after exit. |

All other changes are new Phase 2A harness, documentation and bounded evidence.
No Phase 2B/2C branch or workspace is modified or integrated. Phase 2D owns conflict
resolution, combined candidate review, packaging/provenance regeneration, affected
combined tests and Phase 2 binding. Preserve the exact frozen limits and historical
Phase 1 artifacts. The Phase 1 conformance validator is pinned to I1/B1 subjects
and source identities; applying it to modified Phase 2 bytes is not a valid new
Phase 1 certification. The affected REST regressions and fixed semantic/predecessor
subset are recorded separately instead of rewriting that validator or its receipts.

This workstream creates one direct child of B1 with subject
`feat(memoryos-1.3): complete MO-1305 remote lifecycle`. It creates no B2, merge,
rebase, push, or tag. The externally inspected commit and parent identify the
implementation without a self-referential hash in its receipt.
