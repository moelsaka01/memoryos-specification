# MemoryOS Readiness 0.1.0

This private offline ESM package implements `memoryos.readiness@1.0.0` through
the integrated MO-1307 authority, readiness and Windows orchestration pipeline.
The fixed worker verifies independently pinned raw evidence, grants, candidate
dependencies, reuse and history, derives the normative evidence graph, and then
computes all 22 gates for `rest@1.0.0` or `cicd@1.0.0`. The result includes exact
canonical bytes, readiness identity and a separate proof binding to raw audit
lineage. No engineering fixture or selectable evaluator supplies production
authority. Computed readiness is not human release authorization.

The package root exports only `evaluateReadiness` and `verifyReadiness`. Their
inputs are bounded copied bytes and independent operator pins. The API performs
no path acquisition, helper launch or filesystem publication. The CLI accepts
only the frozen `evaluate` and `verify` flags and explicit private immutable
Windows roots. There is no discovery, stdin authority, URL, environment semantic
override, provider access, Git operation, server, queue, watcher, retry or cache.

Evaluate returns `READY`, `READY_WITH_QUALIFICATIONS`, `NOT_READY` or
`COULD_NOT_EVALUATE`; the CLI projects these as exits 0, 2, 3 and 4. Operational
errors remain errors and cannot become a readiness state. Verify independently
rechecks evidence, recomputes the complete result, compares exact bytes and only
then checks an optional external human decision. Successful CLI verification
exits 0 for every valid readiness state. Human APPROVE, REJECT and DEFER records
bind candidate, readiness and proof identities and never change readiness.
JSON summaries and requested text are projections of the same verified result.

The fixed PowerShell 5.1 helper implements the private 2.0.0 single-frame protocol
and checked native identities. Each request launches a fresh helper. Successful
evaluate needs exactly nine serial requests and one intervening worker thread;
verify needs exactly four requests and one worker. The worker and helper never
overlap. Sessions use 32 random bytes encoded as 64 lowercase hex characters,
serve operational correlation only, and never enter normative result bytes.

The supervisor enforces absolute monotonic API10s/CLI30s/evaluation10s deadlines,
the prospective whole-helper 9s bound and aggregate helper-active28s limit. Before rename admission, failed
cleanup is at most2s, equality is timeout, and cancellation is terminal.
An admitted non-cancellable rename is awaited without a finite settlement claim;
deadline/cancellation observations are recorded until it settles. One shared
2s read-only verification/disposition allowance then applies. No success grace
is granted. The byte-only API retains its12s failed-cleanup ceiling.
Helper response bytes alone do
not admit a transition: process and streams must be closed and the native console
condition established. Worker old/young heap intent is128/16MiB; this does not
claim a hard operating-system aggregate RSS sandbox.

Publication uses a branded inspection capability and single-use opaque token.
It exclusively creates the output directory and fixed pending file, writes,
flushes and checks exact detached bytes, obtains all required native chains,
and renames once to `memoryos-readiness-result.json`. The rename is the sole
commit point. PRE_SUBMISSION, COMMIT_IN_PROGRESS, COMMITTED and FAILED are
private operational states. Post-admission deadline/cancellation cannot return
a terminal timeout while the rename is outstanding. After settlement, final
bytes and pending absence are checked. A committed overrun, failed verification
or rename rejection returns OUTPUT/21 with no success stdout. Timely verified
commits may emit one complete summary under the original deadline. Failures
retain owned evidence; post-commit stdout failure retains the final file. Node Windows rename
is not a kernel no-replace primitive against an excluded privileged concurrent
namespace attacker: nonreplacement relies on the private immutable-root
precondition and native absence/stability checks. Verify never republishes.

Runtime is externally provisioned exact Node24.21.0 win-x64: node.exe93580104
bytes, SHA256 `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`.
Invoke its verified absolute executable and the absolute packaged entry point.
The fixed supported Windows installation is `C:\Windows`; its PowerShell path
is compiled, never selected by PATH or SystemRoot environment input. The helper
receives only SystemRoot/WINDIR and uses the fixed authorized arguments
`-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File <packaged-helper>`.
This is process-scoped only; callers control neither policy nor script, and no
persistent Windows execution policy changes. npm11.19.0 is engineering tooling only.

There are zero external production npm dependencies and no lifecycle hooks.
No account, network service, Linux/Ubuntu/WSL, VM or hosted runner is required.
Supplied tag observations remain evidence. External human decisions remain
unauthenticated (`NOT_VERIFIED_BY_MEMORYOS`) and cannot alter readiness.
REST retains its same-host qualification. The released MO-1306 vector remains
qualified with all ten disclosures: Generic real execution remains certified,
GitHub hosted execution is not certified, and GitLab/Jenkins/Azure retain their
contract-only limitations. Historical failures and unresolved disclosures are
preserved. The package does not authorize a tag or claim Phase 3 certification.

Contracts and schemas remain bound by `contracts/contract.json`; the distribution
manifest enumerates every shipped member except itself. The SPDX2.3 SBOM excludes
itself and distribution metadata to prevent recursive hashes. Package metadata
is not final archive, installed-execution, security or release certification.
Tests, engineering doubles and evidence are excluded from the package allowlist.
Licensing remains pending; see LICENSE-NOTICE.md and NOTICES.md.
