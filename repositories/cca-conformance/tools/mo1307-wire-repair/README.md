# Wire repair engineering validation

**STOP — PHASE3A_CONCRETE_IMPLEMENTATION_BLOCKER.** The mandatory minimum
production wire smoke failed: helper exit22, no stdout/stderr or response frame,
MO1307_INTERNAL and unconfirmed cleanup. No `validation-source.json` was
generated. The 107-test, native filesystem and TOCTOU commands below are prepared
but **UNEXECUTED** and must not run in this stopped generation. Their instructions
are retained as preparation history, not authorization to continue or retry.

These prepared drivers do not accept the failed candidate or certify Phase 3A, 3B or 3C. Do not run them until the final launch repair, package metadata, launch assertions, and all engineering tools are finalized and reviewed. Preserve the prior console-correction generation.

Use the provisioned, SHA256-pinned Node 24.21.0 executable from the isolated correction root. The drivers verify its bytes. There are no source, output, deadline or launch overrides.

1. Finish production and test launch edits. Run the existing `mo1307-phase1/package.mjs build` and `check`. Confirm 89 package members, 53 contract members, zero dependencies and unchanged contract bytes.
2. Prepare `node repositories/cca-conformance/tools/mo1307-wire-repair/validation-bindings.mjs prepare` once. This only inventories exact source/tool/test/fixture bytes and short-alias applicability. It creates `evidence/mo1307/wire-repair/validation-source.json`, with `candidate:null` and `VALIDATION_SOURCE_NOT_YET_ACCEPTED_CANDIDATE`.
3. Pass the separately declared smallest native wire exchange, then the finite console/security suite. Stop at the first required failure. These three drivers do not claim to supply those prerequisite results.
4. Run `node repositories/cca-conformance/tools/mo1307-wire-repair/regressions.mjs` once. It runs package consistency then the existing 107 tests: package8, launch13, runtime36, protocol/publication24, timer1, native-foundation25. Failure stops before the next command; original test files retain their own case scheduling.
5. Only after PASS, run `node repositories/cca-conformance/tools/mo1307-wire-repair/native-filesystem.mjs` once. Its 33 mandatory cases contain 36 helper invocations. A predeclared real short-path alias adds one case/two invocations; absence is recorded as not applicable, never PASS. Symlink/junction fixture setup errors fail the generation.
6. Only after PASS, run `node repositories/cca-conformance/tools/mo1307-wire-repair/toctou.mjs` once. The two cases each execute one reversible instrumented copy of the current helper. No historical helper is executed. The original native calls remain, and injected sharing release is explicitly an engineering device.
7. After all mandatory validation passes, create the new candidate commit. Bind that commit/tree to exactly the 89 already-validated `packageMembers` entries and the validation receipts. A source hash is never relabeled a Git candidate identity. Then create fresh isolated Phase 3A packaging/install/certification evidence under the main task's protocol.

All three drivers use fresh single-use evidence subdirectories. Each helper uses the final production `helperLaunchSpecification`; TOCTOU changes only the script path to its bound engineering copy. Direct helper calls preserve the 5000 ms deadline and 16777216-byte response cap. The original helper/aggregate/CLI/API-worker/cleanup/native-wait limits remain 5000/20000/30000/10000/2000/1000 ms. The 60/90-second Node test-command guards are engineering hang guards, not product deadline extensions.

The source-binding module rechecks the manifest and full input inventory before every required command or native exchange and at closure. Prepare only after tooling stops changing. Never overwrite a manifest or evidence directory to retry a failed generation.

Origins: C3RB `defe93989efc6501b1a730b82e79e705884b269b` native filesystem component; accepted 3C `b02fc0226a1a2d800185a02071674ca80bdf4a1d` two TOCTOU definitions. This reuse is engineering source adaptation, not execution or promotion of historical certification results.
