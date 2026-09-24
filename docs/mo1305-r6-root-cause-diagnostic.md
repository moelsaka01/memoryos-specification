# MO-1305 R6 HTTP 504 root-cause diagnostic

**MO-1305 HOST TRANSIENT IDENTIFIED**  
**READY FOR BOUNDED RESOURCE RESUME**

Classification **C — HOST TRANSIENT / ENVIRONMENTAL STALL**. Windows Modern
Standby interrupted the measurement host. R6 remains **FAIL**, with every
original observation, identity and log unchanged. Readiness here means a
separate bounded task can add the interruption guard defined below and resume;
this diagnostic does not start R7 or establish Phase 1 acceptance.

1. **Baseline.** Workspace `C:\Users\melsa\Documents\Codex\cca-workspace`,
   branch `main`, HEAD `75cee55784c590bab52feaf8f2214e4d1b9e657f`, subject
   `docs(memoryos-1.3): bound MO-1305 phase 1 verification`; parent
   `c2e3835b852fd966046ac9e984538fdcaf8b26bf`. Expected dirty work was preserved.
2. **R6 evidence validation.** Recomputed from the original failure and native
   records: `maximum-permitted-headers`, warm index 2; HTTP 504; operation
   60,443,611 us; client round trip 60,496,188 us; collector sequence 103 capture
   56,254,381,600 ns. The response-body hash exactly matches the frozen
   `MO1305_OPERATION_TIMEOUT` projection. The 342 successful observations and
   failed request remain historical R6 evidence, not new certification data.
3. **Timeout source.** The semantic ownership deadline in
   `repositories/memoryos-rest/src/semantic.mjs`, `runSemantic`, starts at
   `owner.started`, sets `owner.deadline = owner.started + 60000 ms`, and arms
   `atDeadline(..., () => stop('MO1305_OPERATION_TIMEOUT'))` at line 21.
   `admission.mjs:36–40` checks the absolute monotonic deadline before firing.
   The same deadline is enforced when receiving a worker message, on worker
   exit, and immediately before publication in `server.mjs:52,76`.
   Start: **159886386776300 ns**; deadline: **159946386776300 ns**; publication:
   **159946830387300 ns**, 443,611 us after the deadline. These are all in the
   original parent process domain. The exact winning callback/guard and its
   firing timestamp were not recorded. It would be false precision to select
   one of those equivalent deadline checks. This was not the HTTP body deadline,
   response-write deadline, or a collector-generated HTTP response. One worker
   was created and reaped; no completed SDK timing reached the final report.
4. **Monotonic failure timeline.** The causal timeline below retains separate
   clock domains; independent absolute epochs are not subtracted. Unrecorded
   events remain explicitly unknown. UTC is used only to locate corroborating
   OS records, not to compute request or capture durations.

   | Event | Domain and recorded evidence |
   |---|---|
   | Pre-capture request | Orchestrator cutoff `159886235170800`; ticket 5, after sequence 92 |
   | Persisted pre-capture | Collector sequence 94: `159886259909500` → `159886332674100` ns |
   | Collector acknowledgement | Orchestrator `159886334491200` ns; causal ticket/sequence match |
   | Request start | Orchestrator `159886336390400` ns, after acknowledgement |
   | Request admission / worker construction | Exact original instants absent; worker-created metric is 1 |
   | Semantic ownership starts | Parent `159886386776300` ns, generation 3 |
   | Worker import / SDK entry | Last received metrics show import 56,142 us; exact entry timestamp absent |
   | Parallel native capture stall | Collector sequence 103, ticket 5: `159886954236500` → `159943208618100` ns |
   | Semantic deadline | Parent `159946386776300` ns; actual winning callback timestamp absent |
   | Termination request / worker exit | Exact original timestamps absent; reported reap interval 17,500 us, worker-reaped metric 1 |
   | Response creation/publication | Parent operation endpoint `159946830387300` ns; error body identified by hash |
   | Response completion | Orchestrator `159946832579100` ns; HTTP 504; write metric 1,608 us |
   | Failure observed | Orchestrator `159946836485100` ns, last delivered sequence 122 |
   | Post-capture | No requested post-response ticket: HTTP assertion failed first. Final native row 123 is retained but is not relabelled a post-capture proof |
   | Process cleanup | Service and collector exit codes 0; exact exit instants absent |

5. **Time breakdown.** The 60.443611-second operation metric is the complete
   parent-owned operation window, not isolated SDK execution.

   | Measurement | Duration | Interpretation |
   |---|---:|---|
   | Client round trip | 60.496188 s | Encloses transport and operation |
   | Parent operation window | 60.443611 s | Includes worker lifecycle, checks, waiting and host interruption |
   | Recorded integrity checks | 0.615828 s | Received worker metrics plus parent checks; not a complete profile of interrupted work |
   | Recorded worker import | 0.056142 s | Last reported worker metric |
   | Recorded reap | 0.017500 s | Termination/result-to-exit interval reported by parent |
   | Unattributed operation remainder | 59.754141 s | Arithmetic remainder after those three labelled metrics; not an SDK-time estimate |
   | Body buffering / parsing / validation | 0.002093 / 0.008009 / 0.034499 s | Separate request preparation metrics |
   | Response write | 0.001608 s | Separate publication-to-release metric |
   | Pre-capture synchronization | 0.0993204 s | Orchestrator cutoff-to-acknowledgement, before request dispatch |
   | Parallel collector capture | 56.2543816 s | Independent process; not added to request duration |
   | OS-reported sleep | 55.776717 s | Independent Kernel-Power duration; not subtracted to manufacture a valid semantic sample |

   Worker startup, original IPC delivery latency, serialization alone and
   process cleanup duration were not separately recorded. These categories
   cannot be reconstructed exactly from aggregate metrics.
6. **Semantic worker duration.** R6's failed `sdkUs=0` means no completed SDK
   duration was accepted, not zero work. The worker may have been suspended
   during synchronous work or its completion message may have arrived after
   expiry. No genuine valid isolated SDK execution exceeding 60 seconds is
   demonstrated. Focused successful executions reported SDK durations
   1,222,970–1,502,254 us.
7. **HTTP parent wait.** Its operation ownership window is 60.443611 seconds.
   A pure asynchronous waiting total is unobserved. Publication follows worker
   exit; the parent does not await a collector inside `runSemantic` or `send`.
8. **Collector duration.** Sequence 103 is exactly 56.2543816 seconds; sequence
   53 is 9.7303106 seconds. Both spans start before the native queries and end
   before JSON encoding, journal write, flush, fsync and pipe output. The
   original collector has no internal sub-step timestamps, so the exact API
   active during suspension cannot be identified retrospectively.
9. **Collector blocking relationship.** The test orchestrator spawns a gateway
   Node process and an independent Python collector process. The semantic
   Worker is a thread in the gateway process. Python's separate command-reading
   thread receives capture tickets; its main thread queries memory/handles and
   enumerates a system-wide Toolhelp thread snapshot. The orchestrator waits for
   a persisted pre-ticket before sending HTTP and requests a post-ticket after
   completion. During HTTP execution, there is no collector await or synchronous
   collector call in the gateway, worker or worker IPC path. Collector pipe
   backpressure can delay the collector, and pre/post barriers can delay the
   test driver. All processes still share host CPU, kernel, memory and storage;
   process separation does not eliminate contention. No evidence identifies a
   collector-induced gateway deadlock.
10. **Collector microbenchmark.** Twenty captures against an owned idle Node
    process completed in 3.832 seconds. Min **33.5975 ms**, median **37.20345 ms**,
    nearest-rank p95 **49.1875 ms**, max **50.6703 ms**. P95 is descriptive only.
    Median sub-steps: memory query 0.02645 ms, handle query 0.00695 ms, snapshot
    creation 5.7394 ms, thread enumeration 31.9063 ms, first-thread call 0.022 ms,
    snapshot close 0.02375 ms. About 4,079–4,104 system threads were enumerated.
    No extreme delay recurred; no additional collector-only captures ran.
11. **Focused reproduction.** Only `maximum-permitted-headers` ran: 3 cold +
    5 warm with the normal collector; 1 cold + 3 warm without it. All 12 returned
    HTTP 200 and exact expected bodies. Total reproduction time was 39.637137 s.
    Each process used the unchanged installed R6 distribution. Diagnostic
    wrappers recorded lifecycle/timer/heartbeat events outside production files.
    These are explicitly non-certification executions, not R7 or PASS receipts.
12. **With-collector timings.** Operation min/median/max:
    **1.996473 / 2.1077745 / 2.276400 s**. Round trip:
    **2.051556 / 2.151919 / 2.311743 s**. Eight observations.
13. **Without-collector timings.** Operation min/median/max:
    **1.897652 / 1.9921665 / 2.086236 s**. Round trip:
    **1.947660 / 2.051756 / 2.141999 s**. Four observations. Unequal small samples
    do not support a statistical estimate of collector overhead.
14. **Event loop.** The diagnostic parent heartbeat was nominally 100 ms; the
    largest observed gap was 379.6124 ms. Synchronous integrity checks remain
    visible: worker exit to publication took 239.520–325.201 ms. No minute-long
    event-loop stall recurred. R6 had no heartbeat trace, so its exact event-loop
    schedule is unknown.
15. **Worker IPC.** All 12 diagnostic workers emitted accepted results and
    exited without a termination request. Constructor-to-online intervals were
    31.017–49.749 ms; received-result-to-exit intervals 5.059–8.255 ms. Worker
    result send-to-receive latency is not separately timestamped. No IPC failure
    appeared in the allowed reproduction; R6's precise IPC schedule remains
    unrecorded.
16. **Host evidence.** Correct UTC XPath queries found the following independent
    Kernel-Power records on BootId 83:

    | Record | Event | Corroborating payload |
    |---|---|---|
    | 130875 | 506, entering Modern Standby, 16:16:48.8886202Z | Reason Lid; `LidOpenState=false`; scenario 31 |
    | 130884 / 130885 | 507 / 566, 16:16:58.3787564Z | `SleepEntered=true`; sleep/session duration **9,397,350 us** |
    | 130886 / 130887 | 506 / 566 | Next standby episode; sleep session 34 begins |
    | 130893 / 130894 | 507 / 566, 16:17:59.2013833Z | `SleepEntered=true`; sleep/session duration **55,776,717 us**; scenario 33; lid closed |

    This independently corroborates both collector stalls. Raw XML, record IDs,
    boot/session identifiers and OS duration fields are preserved. UTC labels
    locate the events; the stated sleep durations come from OS payload fields.
    The earlier FilterHashtable query returned local-time events four hours
    before R6; its empty System result was not evidence of no standby.
    The corrected interval also contains McAfee service installation events and
    a Defender configuration notification; neither proves a security scan caused
    the delay. No Windows Update event was found. Historical CPU saturation,
    disk pressure and system paging telemetry were not captured. Current readings
    showed about 278 processes, 4,100 threads and 3.7–3.8 GiB available physical
    memory; they do not reconstruct past pressure. No personal files were scanned
    and no system setting or unrelated process was changed.
17. **R6 comparison.** Same-vector cold operation durations were 2.067219–4.061195 s;
    warm 0 was 3.265222 s. Warm 1 rose to 14.008944 s, including **10.838003 s
    integrity time**, versus SDK time **2.782437 s**, and its collector capture
    took 9.7303106 s. This is consistent with the independently recorded
    9.397350-second sleep episode. The failed warm 2 interval then overlaps the
    separate 55.776717-second sleep episode and 56.2543816-second capture.
    Its last received memory metrics are incomplete, not new memory maxima.
18. **Classification.** Exactly **C — HOST TRANSIENT / ENVIRONMENTAL STALL**.
19. **Confidence.** High that Modern Standby externally compromised the R6
    measurement interval: paired OS events explicitly report sleep, independently
    matching two anomalous collector intervals, and all allowed awake
    reproductions succeed. Limited confidence about the exact paused instruction
    and winning timeout callback because R6 did not record them. No evidence
    establishes a valid isolated semantic workload needing a larger deadline.
20. **Required correction and objective rule.** Keep the preliminary 60,000 ms
    ceiling, 4x derivation and all memory limits unchanged. Before a new bounded
    attempt, add a measurement-side host-interruption guard under this rule:

    - A slow sample or large collector gap alone is never invalidation evidence.
      Without independent proof, retain it as a valid slow observation or an
      unresolved failure, according to the existing checks.
    - Retain independent Windows power records with matching host/BootId,
      enter/exit session identity, `SleepEntered=true` and positive reported
      sleep duration. Preserve raw XML, record IDs, hashes and query bounds.
    - A separate observer must timestamp power notifications and sample
      begin/end acknowledgements in its own monotonic domain, using unique
      campaign/sample/ticket identifiers and increasing sequences. Its causal
      brackets must prove that the sample interval intersects the power
      interruption. Require a corroborating independently measured progress gap.
      UTC proximity alone, a wall-clock correction, missing messages or an
      application timeout is insufficient.
    - If proof is complete, classify the interval `INVALID_HOST_INTERRUPTION`,
      preserve all raw results including any HTTP failure, and stop the attempt.
      Do not silently drop the observation, subtract sleep from its duration,
      lower maxima, retry it in place, or convert that campaign to PASS.
    - Start a separately identified bounded attempt only after an awake-host
      preflight and within its explicit task budget. Keep the lid open and avoid
      standby; any temporary campaign-specific awake guard must be scoped and
      removed on exit, without modifying persistent power/security policy.

    R6 is not retroactively reclassified or repaired by this prospective rule.
    No product implementation correction is indicated by the present evidence.
21. **Focused validation / regression test.** Diagnostic assertions verified the
    original failure operands/error identity, UTC XML bounds and record IDs,
    20-capture limit, exact 3/5 and 1/3 reproduction caps, expected response bodies,
    and zero service/collector exit codes. No production code changed, so no
    production regression test was added. No broad suite ran.
22. **Files changed.** This new report and new diagnostic artifacts under
    `repositories/cca-conformance/evidence/mo1305-r6-diagnostic/`; scratch
    runners/traces under `.cache/mo1305-r6-diagnostic/`. Existing R6 files,
    production source, limits, frozen inputs and tracked repository files were
    not edited by this diagnostic. The artifact manifest identifies each new
    diagnostic file by length and SHA-256.
23. **Git whitespace check.** **PASS**, `git diff --check`, exit code 0.
    Workspace verification is not rerun: no tracked repository file changed.
24. **Diagnostic duration.** Approximately **11 minutes**. Exact monotonic
    seconds are recorded in the completion record, including a conservative
    30-second startup allowance.
25. **Thirty-minute limit.** **Confirmed within 30 minutes** by the completion
    check; no extended
    campaign or additional repetition is authorized by this result.
26. **I1.** ABSENT.
27. **B1.** ABSENT. No final limits, inventory or PASS receipts were created.
28. **Push.** None.
29. **Tag.** None; `memoryos-1.3-mo1305` remains absent.
30. **Exact next action.** In a separate bounded Phase 1 resume task, implement
    and test the host-interruption guard above, perform an awake-host preflight,
    then run a newly identified bounded resource attempt under V. Preserve R6
    FAIL; do not start Phase 2 or raise resource limits from this diagnostic.

The machine-readable analysis, original power-event XML, collector sub-step
timings, all 12 diagnostic observations, parent traces and original-collector
captures are listed in
`repositories/cca-conformance/evidence/mo1305-r6-diagnostic/artifact-manifest.json`.
