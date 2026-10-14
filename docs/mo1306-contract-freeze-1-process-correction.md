# MO-1306 Contract Freeze 1 — Correction A: Windows process accounting

Status: **CORRECTION A / PHASE 1 RESUME AUTHORIZED**, not Phase 1 certification.

The original freeze is commit 3537b037e4ea70a726a249d7397f1df15daa2167,
under roadmap authority 33c0612e9ed03d714568354d2d7b2545344f95c1.
Its two-process assumption is preserved in Git history and in the original
[blocked-attempt report](mo1306-phase1-contract-blocker.md). That attempt remains
**MO-1306 PHASE 1 CONTRACT BLOCKER**: 152 contract tests, structural validation
and workspace verification passed; process accounting failed. It lasted
46 minutes 31 seconds, created no I1/B1, and pushed/tagged nothing.
Correction A does not relabel that attempt or discard partial implementation.

## Independent evidence and root cause

The correction-only observer uses Windows Toolhelp32, executable paths,
GetProcessTimes creation identity, bounded safe command-line reads and aggregate
working sets. It imports no product implementation. Records contain PID/parent,
first/last observed times, monotonic intervals/gaps/overhead, protocol output
and post-exit checks of every seen PID plus creation identity. Observation is
sampled, not a claim to see every arbitrarily short-lived process.

- [Dirty baseline](../repositories/cca-conformance/evidence/mo1306/correction-a/dirty-baseline.json):
  all 158 original dirty paths, classified and hashed; no unrelated changes.
- [Attached witness](../repositories/cca-conformance/evidence/mo1306/correction-a/attached.json):
  pinned Node supervisor → absolute Windows PowerShell → System32/conhost.exe;
  maximum three, valid closed path-check response, no remaining observed PID.
- [Detached witness](../repositories/cca-conformance/evidence/mo1306/correction-a/detached.json):
  two observed processes, PowerShell exit zero, no protocol bytes; unacceptable.
- [Stdio diagnostic](../repositories/cca-conformance/evidence/mo1306/correction-a/stdio-diagnostic.json):
  a separate fixed command requests stdout/stderr markers and exit 23. Attached
  execution returns all three; detached returns neither stream and exit zero.
  This isolates the failure to the detached Windows PowerShell launch/console
  initialization path before the requested command's observable effects, rather
  than the path-check parser or an accepted empty success response. The exact
  internal PowerShell startup branch is not claimed. No detached workaround is
  authorized or necessary.
- [Identity and order summary](../repositories/cca-conformance/evidence/mo1306/correction-a/diagnostic-summary.json):
  executable paths, byte lengths and SHA-256 values plus process lifetimes.
- [Model](../repositories/cca-conformance/evidence/mo1306/correction-a/process-model.json)
  and [independent validator](../repositories/cca-conformance/tools/mo1306-correction-a/topology.py).

The original four-process full-run observation also included a console host
owned by a CREATE_NO_WINDOW-launched supervisor. Correction A does not conceal
that process: that launch profile fails the three-role rule. The validated
headless Node supervisor uses DETACHED_PROCESS and redirected private pipes.
The PowerShell helper remains non-detached. These are different launch roles.
Public CLI argv, fixed Node flags and helper protocol remain unchanged.

The initial new diagnostic accidentally expected only a safe field rather than
the complete frozen response. The failed harness assertion and exact script
are retained under correction-a/initial-harness-assertion. Correcting that test
expectation yielded the valid closed response; no helper behavior was changed.

## Narrow corrected contract

The active [freeze](mo1306-contract-freeze-1.md), sections 13–14, now permits
at most **three attributable, role-bound Windows processes**:

1. One pinned Node supervisor.
2. One active direct workload child: fixed trusted PowerShell path helper OR
   pinned Node semantic worker, never both concurrently.
3. At most one required Windows System32/conhost.exe owned by that active child.

The observed third helper-phase process is **conhost.exe**, not the semantic
worker. A fourth process fails validation. Three arbitrary executables do not
pass. Executable/command substitution, wrong parent, extra helper, concurrent
worker, extra console host and non-console descendants fail. PIDs are paired
with creation identity to avoid treating a recycled PID as a surviving child.

The helper fixture's exact SHA-256, fixed UTF-16LE/base64 encoded argv, absolute
PowerShell identity, pinned Node identity and allowlisted SystemRoot/WINDIR
environment are checked. No user command, executable selection, PATH lookup,
preload, shell expression, script API or environment-induced process injection
is added. Existing trusted-host/exclusive-write assumptions remain. The external
observer is a validation boundary, not a claim of kernel-enforced process
containment against arbitrary hostile code.

All attributable roles count toward aggregate RSS and wall-clock accounting.
Only fixed processCount changes from 2 to 3. The 768 MiB engineering RSS
acceptance limit, 128/256 MiB V8 old-space limits, 16 MiB worker semi-space,
semantic 1000–60000 ms, overall semantic+15000 ms, 2000 ms helper and 2000 ms
reserved cleanup limits remain unchanged. No Linux/Ubuntu/WSL/VM or external
provider account prerequisite is introduced.

Normal completion, semantic/helper/child failure, timeout and handled
cancellation must leave no observed helper, worker or owned console host.
Safely tested forced parent termination requires external observation; a killed
parent alone never proves clean cancellation. All roles must be checked before
claiming cleanup. No broad process-name kill is permitted.

## Correction gates and Phase 1 resumption

[Cheap correction tests](../repositories/cca-conformance/tools/mo1306-correction-a/contract-tests.py)
cover observed three-role acceptance, arbitrary-three/fourth rejection, helper,
worker, console and runtime substitutions, wrong ownership, command/env
injection, original history, cleanup requirements, unchanged numeric limits
and forbidden Linux/VM prerequisites. These contract witnesses do not substitute
for the remaining real Phase 1 timeout/cancellation/failure/parent-kill tests.

The correction commit stages only correction documentation, independent
diagnostics/tests and their evidence. It must have parent
3537b037e4ea70a726a249d7397f1df15daa2167 and subject
"docs(memoryos-1.3): correct MO-1306 Windows process accounting".
No partial production implementation is included.

After that commit, review and reuse the preserved Phase 1 files. Run cheap
structural gates first, affected real Windows topology/resource tests, and
remaining original Phase 1 acceptance gates. I1/B1 require their full gates;
Correction A itself proves neither. No Phase 2 branch/worktree, push or tag
is authorized. Preserve any further failure and respect this continuation's
90-minute hard stop and the 60-minute measurement-campaign ceiling.
