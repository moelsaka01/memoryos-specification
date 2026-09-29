# MO-1307 native helper deadline characterization

**Engineering recommendation: Model C — RECHARACTERIZE_WHOLE_HELPER_BOUND.** The whole fresh-process lifecycle is explicitly bounded by contract and implemented accordingly. The fixed 25-observation campaign contains one natural timeout and two thin successful margins on representative MO-1306 READ_SET work. No new deadline is selected or applied. Phase 3A-R remains **BLOCKED**.

This is completed engineering characterization, not certification, a certification retry, a product/contract correction or Phase 3D. All 89 shipped package/source members and all frozen limits remain unchanged. The recommendation calls for separately authorized evidence-based bound selection; it does not approve a correction or another certification generation.

## Facts and authority

The initial gate verified clean main at C3RB `defe93989efc6501b1a730b82e79e705884b269b`, subject `conformance(memoryos-1.3): bind MO-1307 READ_SET optimization`, parent `58c98b7eb0aa2d07bab78753ce66b564066aafeb`. Baseline gate time was 2026-09-29 15:39:31 UTC. All new work is in `C:\Users\melsa\Documents\Codex\cca-workspace`. No source worktree was changed.

The read-only authorities are bound by exact bytes, Git state and selected excerpts in [authority-binding.json](../repositories/cca-conformance/evidence/mo1307/helper-deadline-characterization/authority-binding.json). They include the three r3a refresh/localization/final reports and their receipts, the authoritative original READ_SET diagnostic, and the C3RB correction report. Before/after receipts verify 37,396 source files across r3a/r3b/r3c, 128 files in the original B/C/D input roots, and 39 selected authority bindings; dirty r3a remains exactly dirty as found.

Historical final-generation failure remains Step G, post-tag-absent evaluate, request 3 READ_SET, 19 files, MO1307_TIMEOUT / ACQUISITION, exit 29. Transport settlement was **5063.5788 ms**; supervisor terminal was **7.8233 ms after its deadline**. Aggregate helper-active and CLI admission were not limiting. H–O were unexecuted. Its tag vector is POST_TAG_VERIFICATION, cicd@1.0.0, expected tag `memoryos-fixture`, target `3333333333333333333333333333333333333333`, candidate SHA-256 `92f382b3d598cccef126f5a59e29face33c040d952edfa034eec626201678b05`, authority SHA-256 `6d2b93e68a112bbf5e32a6c7d63755efc83e0251e14a946a6f82b6d71a7f76f3`. Expected NOT_READY/3 semantics were precluded by acquisition failure.

Prior successful observations are preserved separately, not pooled into the new statistics:

| Historical source | Request-3 transport ms |
| --- | --- |
| Corrected MO-1306 | 3129.6876, 2945.6094, 2783.4989 |
| Localization | 3659.7774, 4322.5324 |
| Final certification primary MO-1306 | 2766.7818 |
| Final certification READY | 1469.1991 |

These establish observed variance, not a deadline policy. Final 3A-R generation request frame/session bytes were deliberately not retained: only request hashes and lengths survive for those requests. Older diagnostic frames remain separately retained. B/C use declared new engineering sessions with reconstructed authoritative descriptors and unchanged original-root inputs. D is explicitly an original-root workload surrogate, **not exact replay** of the failed frame. Its historical frame hash is `f4673c49789e3ab25b2469d66fd91d75e35fb43c60eaaa839d55e6b37669a34a`, length 2128 bytes. B and D have identical 19 descriptors/content payloads but D has one additional checked ancestor, so they remain distinct native workloads.

## Normative intent and implementation

Classification: **WHOLE_HELPER_LIFECYCLE**. Freeze 1 lines 1202–1204 and 1228–1238 bound each frame exchange at 5000 ms and count startup, inspection, framing/EOF and confirmed process/console termination. The publication/inspection correction explicitly spans before child launch through confirmed quiescence. Exact excerpts and their C3RB hashes are in [contract-intent.json](../repositories/cca-conformance/evidence/mo1307/helper-deadline-characterization/contract-intent.json); implementation does not supply the authority for this interpretation.

In `src/runtime.mjs` lines 105–153, `runOwned` captures `launch = readNow()` at line 112, computes the minimum of admission, launch+5000 and remaining 20000-ms helper aggregate, installs ownership, records start, arms the timer, then invokes child creation. Success requires completion, separately settled close, a strict deadline checkpoint and quiescence. The transport also requires matching frame, exit 0, EOF and closed pipes. A complete frame alone is insufficient.

The separate private sequence in `src/helper-protocol.mjs` lines 181–236 checkpoints before encoding at line 200 and records that earlier origin at line 213; completion/decode and helper exit enforce the same per-helper/aggregate constraints. Real acquisition invokes it in `src/acquisition.mjs` lines 19–28. These standalone samples run the unchanged supervisor and transport but do not execute that surrounding nine-request sequence. They cannot certify full CLI timing.

All of process creation, PowerShell startup, native/helper initialization, request processing, response transport and process settlement are included. Frozen helper/aggregate/CLI values are **5000/20000/30000 ms**; API/worker 10000 ms and cleanup 2000 ms are unchanged. At expiry, the terminal error is fixed and cannot be rescued by late output. Cleanup is separately bounded by terminal+2000, destroys streams and terminates the owned child; absent quiescence proof it records unconfirmed cleanup and fails closed. No premature deadline or normative clock-placement contradiction was established. [deadline-source-analysis.json](../repositories/cca-conformance/evidence/mo1307/helper-deadline-characterization/deadline-source-analysis.json) binds exact source locations and bytes.

## Fixed method and runtime

The plan was created at **2026-09-29T15:57:55.788Z**, before campaign start **2026-09-29T15:58:17.680Z**. Exactly 25 production helper launches ran in this single order, with five fresh processes per case and zero retries:

`01-A 02-B 03-C 04-D 05-E 06-B 07-C 08-D 09-E 10-A 11-C 12-D 13-E 14-A 15-B 16-D 17-E 18-A 19-B 20-C 21-E 22-A 23-B 24-C 25-D`

Campaign end: **2026-09-29T15:59:25.331Z**. No outlier was discarded. The natural timeout was preserved and the remaining declared samples ran because no early-stop condition was established. No helper was launched by statistics, authority audits or closure validation.

The exact C3RB production helper is 30,210 bytes, SHA-256 `35381850f1ef8c322e528156ebd8779071ad3288cdccd4d0ebab51ce6f9c6ac8`. There is no helper copy or instrumentation of helper source. The external spawn-forwarding seam asserts the exact production executable, arguments and options, calls the real spawn, and always returns that owned child. It uses real default supervisor clocks and limits.

Node is trusted v24.21.0 win-x64, SHA-256 `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`. Windows PowerShell is Desktop 5.1.26100.9444, 64-bit, executable SHA-256 `8bb6fa8c283b4d92120b1ef249a9b311b0f804d4cabbe9981159976c8be76a5e`. Fixed launch is powershell.exe -NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -File followed by the fixed production helper. The exact launch object is retained. Windows reports DisplayVersion 25H2, build 26200.9457; raw registry ProductName is Windows 10 Home, retained without inferring a marketing edition from it. C: is fixed NTFS, label OS. Production response identities bind actual volumes, roots and checked path components; the timed-out sample has no response identity claim.

The query-only engineering Python observer uses standard-library Win32 calls and no installation or admin operation. It launches/terminates zero product processes. It retains PID+creation-time+executable identities and exact attributable console handles, polls nominally every 50 ms, has a 300-second total guard and bounded output, and never changes product cleanup state. The original audited query utilities are retained byte-for-byte as engineering source. Runtime and observer provenance are pinned in evidence.

These are **fresh-process observations**, not cold-start measurements. OS caches and normal host activity are uncontrolled. No cache flush, reboot, antivirus change, machine tuning, PowerShell reuse or deliberate warm-up occurred. Inputs were hashed before execution, so filesystem cache warming from integrity checks is possible. Engineering observer overhead and its scheduling effects are part of the limitation.

## Direct observations and derived durations

| Event | Meaning / observability |
| --- | --- |
| T0 | Derived supervisor launch origin = effective per-helper deadline − 5000; start-event timestamp retained separately. |
| T1 | Parent Node timestamp when real spawn returns/PID is available; not an independent kernel CreateProcess timestamp. |
| T2 | Node spawn notification plus native process observations; does not establish PowerShell engine readiness. |
| T3 | NOT_OBSERVABLE: no trusted readiness event in unchanged protocol. |
| T4 | stdin finish: bytes accepted by writable pipe, not proof of helper consumption. |
| T5 | First stdout data event. |
| T6 | Advertised frame length reached; exact protocol/bytes validated independently after settlement. |
| T7 | Node exit notification, distinct from close/all-pipe settlement; native GetProcessTimes exit recorded separately. |
| T8 | Retained attributable conhost exit FILETIME and later signaled-handle observation. T8 precedes T7 here. |

All raw event records, native FILETIME values (exact decimal strings), QPC observations and per-sample context are retained. The table below reports derived whole T0-to-transport-settlement durations, in milliseconds. A timeout includes failure settlement and is right-censored for successful completion; it is not a successful latency.

| Case | Operation / files / input bytes | Request / successful response bytes |
| --- | --- | --- |
| A | READ_SET / 1 / 53 | 387 / 845 |
| B | READ_SET / 19 / 19711 | 2112 / 32035 |
| C | READ_SET / 65 / 2004208 | 7570 / 2693766 |
| D | READ_SET / 19 / 19711 | 2128 / 32355 |
| E | CHECK_OUTPUT / 0 / 0 | 345 / 1905 |

| Case | Raw whole durations, execution order (ms) | Min | Max | Median | Min margin | Class |
| --- | --- | --- | --- | --- | --- | --- |
| A | 1750.4410, 1826.9322, 1519.3801, 2782.1911, 2023.7791 | 1519.3801 | 2782.1911 | 1826.9322 | 2217.8089 | large |
| B | 2134.0171, 1992.9136, 2117.5187, 3020.6389, 2973.9402 | 1992.9136 | 3020.6389 | 2134.0171 | 1979.3611 | large |
| C | 3369.0536, 3416.8165, 4442.3606, 5024.6567 TIMEOUT, 4845.0631 | 3369.0536 | 5024.6567 | 4442.3606 | -24.6567 | violation |
| D | 1862.6918, 1805.6724, 2179.4275, 3703.2261, 2059.0650 | 1805.6724 | 3703.2261 | 2059.0650 | 1296.7739 | moderate |
| E | 1259.9383, 1542.3419, 1320.5131, 3038.6078, 1554.0606 | 1259.9383 | 3038.6078 | 1542.3419 | 1961.3922 | large |

Counts: **24 below 5000 ms; one at/above 5000 ms; one product TIMEOUT**. Predeclared non-normative labels: large margin >=1500; moderate >=750 and <1500; thin >0 and <750; violation <=0. Minimum margin is **-24.6567 ms**; minimum successful margin is **154.9369 ms**. C also has a 557.6394-ms successful margin. No p90 is reported for five observations per case. The median does not erase the timeout.

| Derived interval | n | Minimum ms | Maximum ms | Median ms |
| --- | --- | --- | --- | --- |
| processCreationReturnMs | 25 | 8.5138 | 44.3024 | 11.5369 |
| clockOriginToSpawnReturnMs | 25 | 8.5902 | 44.3590 | 11.6569 |
| requestToFirstByteMs | 24 | 507.5156 | 3744.1082 | 1220.9234 |
| requestToCompleteFrameMs | 24 | 510.9479 | 3748.2597 | 1222.7846 |
| responseToExitMs | 24 | 21.2219 | 59.8536 | 28.1693 |
| launchToCompleteFrameMs | 24 | 1235.5442 | 4772.8885 | 2058.7558 |
| launchToProcessExitMs | 25 | 1259.0786 | 5023.9491 | 2114.9264 |
| launchToTransportSettlementMs | 25 | 1259.9383 | 5024.6567 | 2117.5187 |

Request-to-first-byte and request-to-response include remaining initialization, waiting and request work; they do not isolate trusted execution. Bootstrap duration is **NOT_OBSERVABLE**. E's whole-lifecycle range 1259.9383–3038.6078 ms shows appreciable variance in a lightweight operation, but cannot allocate it to PowerShell startup. First-byte-to-frame and response-to-exit are distinct from decoding/validation and final checkpoint costs; all raw derived values are in statistics.json.

Each sample had one positively attributed helper and one console host. All 50 retained process handles became signaled. Native console lifetime was 671.7369–1575.9175 ms; helper creation to console exit was 681.4987–1596.2991 ms. Console exit preceded helper exit by 549.7011–3985.8174 ms, so observed post-helper console-quiescence wait was zero. These differences use GetProcessTimes FILETIME values within their native clock domain; polling recognized termination later, and independent exclusion of wall-clock adjustment is unavailable. No exact bootstrap endpoint is inferred from console exit.

## CPU, context and measurement limits

| Sample | Whole ms | Helper CPU ms | Native helper elapsed ms | System CPU % | Observer query wall ms | Maximum poll gap ms |
| --- | --- | --- | --- | --- | --- | --- |
| 01-A | 1750.4410 | 1453.1250 | 1726.5219 | 30.6210 | 325.8697 | 67.6006 |
| 02-B | 2134.0171 | 2515.6250 | 2116.6460 | 57.5355 | 453.8158 | 76.8669 |
| 03-C | 3369.0536 | 3781.2500 | 3315.3343 | 41.2607 | 597.6023 | 70.1082 |
| 04-D | 1862.6918 | 2218.7500 | 1844.4732 | 40.0806 | 345.7843 | 66.0059 |
| 05-E | 1259.9383 | 1328.1250 | 1243.2156 | 45.6716 | 229.8449 | 65.0196 |
| 06-B | 1992.9136 | 2578.1250 | 1977.5958 | 52.2388 | 379.4284 | 69.9339 |
| 07-C | 3416.8165 | 3921.8750 | 3357.0926 | 43.8724 | 618.2895 | 71.4587 |
| 08-D | 1805.6724 | 2109.3750 | 1786.3960 | 38.2292 | 336.5560 | 66.7703 |
| 09-E | 1542.3419 | 1562.5000 | 1521.4983 | 77.0433 | 334.3163 | 70.0981 |
| 10-A | 1826.9322 | 1937.5000 | 1803.3873 | 92.7254 | 411.6714 | 70.8891 |
| 11-C | 4442.3606 | 5031.2500 | 4383.7076 | 82.2967 | 926.6762 | 69.2002 |
| 12-D | 2179.4275 | 2531.2500 | 2160.5720 | 49.9150 | 448.5163 | 86.0505 |
| 13-E | 1320.5131 | 1375.0000 | 1305.3586 | 47.8261 | 261.2011 | 67.4838 |
| 14-A | 1519.3801 | 1703.1250 | 1498.3301 | 54.8077 | 325.1911 | 78.6337 |
| 15-B | 2117.5187 | 2406.2500 | 2095.6124 | 49.5471 | 411.6475 | 68.7286 |
| 16-D | 3703.2261 | 4609.3750 | 3674.4703 | 53.5124 | 991.3059 | 82.6854 |
| 17-E | 3038.6078 | 3046.8750 | 2996.9597 | 71.4907 | 980.5185 | 128.3506 |
| 18-A | 2782.1911 | 3046.8750 | 2745.4918 | 66.3043 | 795.6726 | 80.7308 |
| 19-B | 3020.6389 | 3640.6250 | 2998.8275 | 52.4229 | 728.5914 | 77.6040 |
| 20-C | 5024.6567 | 5593.7500 | 5004.5298 | 51.1850 | 1180.0666 | 97.8509 |
| 21-E | 1554.0606 | 1562.5000 | 1534.7444 | 43.4625 | 315.3155 | 67.7035 |
| 22-A | 2023.7791 | 2296.8750 | 1984.6036 | 65.1076 | 480.1317 | 77.8542 |
| 23-B | 2973.9402 | 3437.5000 | 2945.4893 | 65.5305 | 726.2028 | 72.8420 |
| 24-C | 4845.0631 | 5500.0000 | 4782.3344 | 44.9465 | 1035.8475 | 70.7837 |
| 25-D | 2059.0650 | 2437.5000 | 2040.4486 | 38.4406 | 402.6033 | 68.5189 |

Native helper CPU was 1328.1250–5593.7500 ms, versus native elapsed 1243.2156–5004.5298 ms. GetProcessTimes sums all process threads and therefore often exceeds elapsed time. Native elapsed minus aggregate CPU ranged −934.9047 to +273.3969 ms; only the first sample has a positive difference. This does not show a large attributable wait interval or establish scheduler/Defender causation. The recorded host CPU interval utilization was 30.6210–92.7254%; these percentages are derived from system counter differences, with idle subtracted from kernel+user, not point-in-time percentages.

Before/after available memory spanned 3,176,366,080–3,363,565,568 bytes; process count spanned 404–415. Per-sample maximum reported peak helper working sets spanned 116,314,112–163,782,656 bytes. Every sample records UTC, process identities/start/exit, working-set observations, CPU, memory and process-count context. Successful frame identities retain actual root/volume identity. No unsupported filesystem identity is invented for the timeout.

Observer cumulative sampling query wall time was 229.8449–1180.0666 ms/sample; maximum sampling gap across the campaign was 128.3506 ms. This query duration includes the observer's own waits/scheduling and is concurrent with the helper; it is neither observer CPU time nor measured incremental helper delay. Serialization, flush and indirect scheduling costs are not fully captured. The synchronous active-control write inside launch cost 0.4726–1.3220 ms. Observation may perturb this run materially. No observer time is subtracted, and no unobserved uninstrumented latency is claimed. A future design should predeclare a lower-overhead sensitivity comparison.

**Inference:** larger workload correlates with longer observed lifecycle: C's median is 4442.3606 ms versus B 2134.0171, D 2059.0650, A 1826.9322 and E 1542.3419. This small interleaved set does not estimate a causal per-byte/file cost. B/D order and host variance preclude attributing their difference to the extra ancestor. Common lightweight variance is visible, but isolated startup causation is unresolved.

## Natural timeout and cleanup

Sample 20-C received no response bytes. Its supervisor armed a deadline 5000 ms after T0; terminal was observed at T0+5003.4001 ms. Parent exit notification was T0+5023.9491 ms, whole settlement T0+5024.6567 ms, and exchange-call settlement 5026.5788 ms. Cleanup's deadline remained terminal+2000. Original result remains MO1307_TIMEOUT / ACQUISITION; there was no retry or late success.

**Product cleanupConfirmed remains false.** Without a valid response the unchanged transport cannot establish its console-quiescence proof. External held helper and attributable console objects were nevertheless both signaled, with console exit approximately 3985.8174 ms before helper exit and no positive owned survivor at final observation. Complete descendant coverage is not established. This is not certification cleanup success and does not override the product flag or repair any historical cleanup gap. It also does not establish a deterministic required-termination violation or premature timeout that would activate the declared early-stop rule. The observer did not terminate product processes.

## Recommendation and security

Model **C** is best supported for the recorded environment: explicit whole-lifecycle authority matches source, while one naturally censored timeout and two thin C successes fail Model A's credible-margin criterion. Historical Step G's independent failure remains supporting evidence of variance. B is unsupported because whole-lifecycle intent is explicit and pure request execution is unobservable here. This finding does not estimate population failure probability or establish the cause of platform variance.

Security A retains the current fail-closed cap. B would need a separately bounded startup phase and bounded total acquisition; excluding startup without another limit creates unbounded process acquisition. C would enlarge process occupancy and denial-of-service exposure, requiring review against aggregate/admission bounds and bounded cleanup. No option may introduce unbounded execution. Persistent helpers, services, pools, PowerShell reuse/migration, native sidecars and additional product processes are deferred alternatives, not the primary recommendation. The external observer is only engineering instrumentation.

**Future bound-selection method, requiring separate authority:** predeclare a finite, bounded design capable of observing uncensored successful whole-lifecycle times in representative normal-load windows, plus observer-sensitivity controls. Choose reliability/confidence targets before collecting a sufficiently large sample; derive an upper tolerance limit U while retaining censoring/failures. Evaluate a candidate at least U + max(1500 ms, 0.30 × U) + justified measurement/scheduling uncertainty. Review its denial-of-service and aggregate/admission consequences before any correction. This formula is a proposed engineering method, not new normative text.

The largest completed observation, 4845.0631 ms, plus 1500 ms yields **6345.0631 ms only as an arithmetic discussion floor**, not a validated bound or range. Current/historical killed samples leave successful completion unknown; neither 5024.6567 nor 5063.5788 can justify a replacement just above it. **No numeric deadline is selected.** A separately authorized contract correction and corresponding production constant/validation change would be required to adopt a new bound. Neither is performed here.

## Integrity and closure

All 89 package/source members match C3RB before and after. Accepted 3B-R `5cb213eeab8a6deec39a8f8f93ea13a70e053231` and 3C-R `f4ed5873969ab6b627941dc20d5823c5e853b9fe` remain unchanged and applicable to the identical shipped bytes. Phase 3A-R remains BLOCKED regardless of this recommendation. No Linux/Ubuntu/WSL run, VM work, provider-account action, installation, push or tag occurred.

Evidence is in [helper-deadline-characterization](../repositories/cca-conformance/evidence/mo1307/helper-deadline-characterization/). Primary entries are baseline.json, authority-binding.json, authority-source-before/after.json, sample-plan.json, runtime-environment.json, deadline-source-analysis.json, contract-intent.json, campaign-start/campaign.json, requests/, samples/, observer/, statistics.json, margin-analysis.json, security-analysis.json, decision.json and integrity-before/after.json. The checker independently binds and recomputes timing/count/margin evidence. Raw failed engineering environment-probe evidence is retained separately; it did not invoke the product helper.

Closure requires the final-validation receipt to pass source syntax, read-only evidence checking, package integrity, workspace verification and git diff --check. The changed-file inventory and staged-blob check enforce only this report, new engineering evidence/tools and narrowly scoped .gitattributes rules. The single authorized commit subject is `docs(memoryos-1.3): characterize MO-1307 helper deadline`, with sole parent C3RB. No future commit hash is embedded. Postcommit verification writes only ignored cache receipts and rechecks exact committed bytes, evidence, package, workspace, diff and clean main; it launches no helper and creates no second commit.

Time budget: target 45 minutes, normal ceiling 60, hard stop 75 from the 15:39:31 UTC baseline. Final elapsed time and actual commit identity are reported outside this commit after closure. No extension is authorized or used.

**Exact next task:** Request separate authorization for MO-1307 WHOLE-HELPER DEADLINE CONTRACT CORRECTION DESIGN (MODEL C), preserving historical Phase3A-R BLOCKED and all frozen limits until its evidence-based decision. Any new Phase 3A certification generation requires its own subsequent authorization.

MO-1307 HELPER DEADLINE CHARACTERIZATION COMPLETE
MODEL C RECOMMENDED
