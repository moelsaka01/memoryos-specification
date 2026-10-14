# MO-1307 N17 integrated publication fixture correction

This prospective authority implements the user request preserved at `repositories/cca-conformance/evidence/mo1307/n17-correction/authorization.txt`. It authorizes only the demonstrated N17 fixture setup correction and the gated validation/certification sequence. It does not declare a production candidate or promote prior results.

## Authority and exact defect

Classification: **N17_FIXTURE_SETUP_DEFECT**.

The controlling publication-inspection correction, `docs/mo1307-phase2c-publication-inspection-correction.md:103`, requires CHECK_OUTPUT to establish output-leaf absence beneath a successfully checked **existing parent chain**. Missing ancestors are errors. Freeze 1 section 19 requires exclusive output-root creation, one fixed pending file and one final result, with no overwrite or recursive cleanup. `publication.mjs:163-168` checks the parent then calls `fs.mkdir(root, {recursive:false})`; it cannot create caller ancestors. The caller/test must prepare the private parent while leaving the output root absent.

N17 derives its attempt directory from the selected test process PID, then selects `attempt/cli-integrated-ready`. The original callback read READY pins and launched evaluate without preparing `attempt`. Earlier N15 and runHelper callbacks create it only when they execute in the same test process. Exact-name selection in a fresh process excludes those callbacks. There is no before hook or imported top-level parent creation. This is the first concrete setup divergence: the test omits a contract-required caller prerequisite, while its expected successful publication remains valid.

The retained failure is selector `native-foundation-018`, actual test `N17 native CLI evaluates and publishes exact integrated result`. It expected CLI exit 0 and observed exit 21 with MO1307_OUTPUT, stage PUBLICATION, reference null. The preserved evidence did not capture the inner process PID or helper frames, so it does not establish the exact runtime refusal branch. `acquisition.mjs:24-25` maps a slot-4 CHECK_OUTPUT error to OUTPUT/PUBLICATION before the worker; that path must not be described as necessarily reaching createPublication. The source prerequisite defect is independently proved by the authority and fixture comparison.

The preserved passing READY integrated comparison in `C:/m7a2` prepared its private parent before using an absent output. It returned exact READY result bytes and recorded committed/namespaceVerified success, nine helpers, one worker and cleanup confirmation. All 27 READY fixture members and eight relevant Node publication/acquisition/orchestration modules match current bytes. Its helper belongs to an older generation; this comparator proves the setup difference and unchanged publication path, not current validation or equivalence of all historical runtime dependencies. Exact bindings and caveats are retained in `authority-review.json`.

## Allowed correction and unchanged semantics

Add exactly one line inside N17 after reading pins and before selecting/launching output:

```javascript
await fs.mkdir(attempt, { recursive: true });
```

This creates only the test's required parent. It does not create the output directory, pending file or final result, pre-populate content, change expected bytes, alter assertions, or modify product code. Removing that line reconstructs the exact test bytes at preservation commit `56a3d93a0c7fdb42e93e16ec1f6c13c81770c11b`.

All 89 production members remain byte-identical to the validated N15 correction, source identity `sha256:6e0e5f1984b1de1b835879471c3858897ba30d3206fa504fb7f9a7aa2cfca690`. No metadata rebuild is needed. Headless startup, initial-zero refusal, mandatory self-detachment, no post-detach membership query, corrected CreateFileW metadata, wire 2.0.0, native boundary semantics, readiness/tag/decision behavior and human authority separation remain unchanged. Helper/aggregate/CLI/API-worker/cleanup limits remain 5000/20000/30000/10000/2000 ms. J retains the exact forward cleanup relation; H remains NOT_ESTABLISHED.

Successful publication retains slots 4/5 ABSENT, stable parent/root/pending identities through slots 6-9, exclusive creation, exact staged bytes, native final absence and a single rename. Actual successful rename remains the commit point; the final directory contains only `memoryos-readiness-result.json`, with exact expected result bytes and no pending file. Failure retains owned evidence and does not overwrite, retry, recursively create caller ancestors or recursively clean up. Existing finalization admission/settlement and error mapping remain authoritative.

## Prospective finite validation

Seal current production, the exact fixture delta, authority, harness, inventories and dependencies before N17. Execute its unchanged original selected callback exactly once. The outer Node test process uses documented `--test-isolation=none` so its actual PID identifies the fixture path. Capture actual stdin finish/close, stdout/stderr EOF and close, process exit and process close. Require one selected TAP PASS, original CLI exit/summary/result assertions, exact final result and the one-file finalized namespace. Preserve the result and fixture bindings.

The original inner CLI uses spawnSync. Its completed return, exit and captured-stream assertions plus unchanged production orchestration establish the scoped successful lifecycle evidence. Outer events are directly observed; per-helper or inner CLI event timestamps are not separately captured or invented. No preload, production launch replacement, second valid CLI execution or additional diagnostic invocation is introduced for observation.

If N17 passes, immediately execute a finite publication preservation stage: one direct native CLI READY evaluation with a deliberately missing required parent, requiring exact OUTPUT/PUBLICATION exit 21, empty stdout, closed process/streams and no parent/output creation; four real-filesystem publication primitive negatives (missing parent, wrong output type, unsafe lexical output and existing conflicting output), explicitly labelled as using synthetic admitted inspection fixtures; and twelve unchanged selected publication/finalization/timer callbacks. Current N17 supplies the valid existing-parent publication control. Synthetic primitive controls are not native-helper identity proof.

The complete predeclared 107-callback inventory is accounted for once: current N17 (1), publication preservation callbacks (12), then the remaining 94 fresh callbacks. The five supplemental negatives are separate from that count. This is one new source-bound validation cohort; no historical 99 PASS row is reused. Run fresh native filesystem 35-case/39-invocation regression, the exact 19-category security matrix, remaining callbacks and package integrity, and the two TOCTOU controls. N17 is never rerun as part of the remaining inventory. The source and complete inventory are sealed before the first validation; the remaining-regression stage is admitted only after N17 and publication preservation PASS.

Order: N17 → publication preservation → native filesystem → security → remaining regressions/package integrity → TOCTOU. At the first mandatory failure, stop with no retry or later stage. Controlled security proofs retain their original scope; category A references current N17 success/source gates and does not claim independently captured per-helper telemetry. Existing N15 diagnostic and metadata proofs are preserved and rebound, never reopened as diagnostics.

## Candidate, certification and later streams

Only all required correction validation PASS permits a new candidate commit/tree. Bind exact production89, helper, transport, README/spec, unchanged manifest/SBOM, the changed N17 fixture and new harness, headless/N15/N17 authorities, security and regression evidence. A content hash or preservation commit is not itself an accepted candidate.

Then create a fresh isolated short-path worktree, fresh offline package/install, exact installed-member equality and a sealed full A-O inventory. Execute A through O once, with first-failure stop and no historical PASS promotion. All mandatory cases must pass before creating an accepted Phase3A receipt, evidence commit, candidate binding and Phase3D handoff input.

Accepted historical Phase3B `702c1b6381f6112a50ac844831d195275dac3350` and Phase3C `b02fc0226a1a2d800185a02071674ca80bdf4a1d` remain preserved. The request's section 15 conditionally authorizes new scoped 3B/3C refreshes in parallel after new Phase3A acceptance; it does not authorize replaying or modifying the accepted historical streams before that gate. No push, tag or Phase3D execution is authorized.
