# MO-1306 Phase 2D constructed integration

This integration combines Phase 2A core hardening, Phase 2B GitLab/Jenkins adapters, and corrected Phase 2C Azure/GitHub adapters on main. The released JavaScript SDK 1.1.0 remains the sole production semantic authority. The graph-aware Phase 2 inventory and receipts determine whether this candidate has completed acceptance and binding.

## Source authority and preservation

The baseline is B1 `dbafc0061aa493da2517ee5564f9ea6adb90f52d`. Sources are 2A `688caf42eff085bbc37d861a61a3948105d2af6e`, 2B implementation `1d43584cef532ebcdf1e87b0cba277d2d7180a63` and completion `7ff57e2a5ec8573dcb2b9624fc5fb3925804d886`, and original 2C `e1c990bf65d0c7925a68eea8222cd304f8ce6db6` plus corrected completion `9ae367fdebbef3c72cc124a803cd00b9b353c2b1`. Source worktrees are read-only. The integration is constructed on B1 without merging or rewriting those histories.

The first failed Phase 2D source gate remains FAIL, with byte-identical copies under `evidence/mo1306/phase2d/first-attempt`. Corrected 2C separately passed its focused source gate before integration. Source inventories contain 7 paths from 2A, 200 from 2B, and 282 from corrected 2C, with 481 unique paths. The exact pairwise/three-way overlaps, classifications, retained source bytes, and resolutions are in `source-inventory.json`. Source evidence and fixtures remain unchanged.

## Deliberate shared-code resolutions

- Core preserves 2A closed provider IR selection inside the failure boundary, metadata normalization, and selected-provider installation verification for exactly five providers.
- Generator preserves corrected 2C closed inputs and nested output handling, while using the common IR and fixed grammar for all five outputs. UTF-8/LF, exact cardinality, deterministic ordering, escaping, pins, and no-overwrite remain enforced.
- Integrity binds every implemented adapter module closure and all four provider templates, including the Jenkins Groovy template. Bundle verification requires the selected adapter digest; there is no stale branch-specific fallback.
- The common launcher combines the bounded one-line canonical summary with full configuration/distribution/bundle verification, explicit native-exit checks, pinned Node, and Node environment cleanup. GitHub captures the common launcher's Console.Out in-process and restores it in a finally block. No new product child process is introduced.
- The explicit current capability authority recognizes generic, GitLab, Jenkins, Azure, and GitHub. Historical B1 package and unmodified 152-test contract suite are replayed directly from B1 Git blobs, preserving its original provider states.

The 11 product schemas, frozen 28 errors plus diagnostic truncation code, exit mappings, SDK closure, supervisor, filesystem helper, publication protocol, and process/resource ceilings remain unchanged. MO-1302 is preserved and receives targeted regression checks.

## Acceptance and evidence boundaries

The acceptance tools under `tools/mo1306-phase2d` write separate integration evidence. They bind the current product identities, source graph, independent provider parsers, real Windows execution, SDK byte parity, security negatives, generation, package/install checks, and bounded supply-chain reconciliation. Required gates and receipt dependencies are code-owned by `conformance.py`; inventory-provided claims cannot remove required cases. Closed schema, graph, hash, receipt, label, and omission mutations are tested independently.

Native acceptance covers all five providers with PASS, FAIL, CNE, PolicySet, regression, nonsemantic metadata changes, and configuration/input/integrity failures. A separate lifecycle harness checks helper cancellation and worker timeout/cancellation with actual children. The external observer applies the unchanged Correction A role checker, exact child command identities, maximum three attributable roles, aggregate RSS ceiling, and cleanup checks. Sampling establishes observed topology, not continuous OS-wide surveillance. Phase 1 resource characterization is reused by exact unchanged identities.

Provider definition checks remain offline: official pinned GitLab schema plus restricted subset; independent bounded Jenkins parser without Groovy execution; exact Azure schema with 698 local references plus restricted subset and PowerShell AST; GitHub grammar, AST, action pins, trust, completion, run-id and artifact checks. GitHub runtime handoff and gate tests execute locally without provider services. No hosted certification is claimed.

The package is `memoryos-ci@0.1.0`, with 94 members, 25 authoritative SDK closure files and zero external production dependencies. The integrated archive is a local build artifact; committed evidence records its exact identity. Two builds must agree, and a fresh install uses an initially empty explicit cache with offline, ignore-scripts, no-audit and no-fund settings. Installed generic outcomes and generation of all five provider definitions are checked between identical before/after file inventories. An AST import audit verifies package-local or Node-builtin imports and no dependency on sibling worktrees, Git, provider tools, or developer modules.

The component-level SBOM remains accurate for memoryos-ci 0.1.0 and SDK 1.1.0. Current exact file identities are maintained in the integrated distribution and external Phase 2 inventory. The bounded supply-chain report verifies the pinned Node/npm closure, seven validator wheels, schemas, parser, action metadata, templates, lockfile, notices and provenance. It makes no zero-vulnerability claim; final advisory/reachable-risk review belongs to Phase 3B.

## Preserved diagnostics and harness corrections

All failed observations remain separate from successful acceptance:

1. Initial corrected-source verification required the pinned jsonschema environment. A later silent source-verifier attempt was terminated by its confirmed task-owned PID; its root cause remains undetermined. An instrumented focused gate passed while writing scratch data only under main.
2. An initial cheap structural check ran before the last integration write completed and rejected the stale distribution manifest. The manifest was regenerated against final bytes and the cheap suite rerun.
3. PID-only ancestry falsely included unrelated processes through a reused console-host PID. Their birth times preceded the supervisor. The engineering observer gained chronological ancestry checks; a later case exposed that its snapshot entry point had not called the filter. That wiring was corrected and tested through snapshot itself. Both original failures remain unchanged in local diagnostics, with hash-bound dispositions. Unrelated processes were never terminated.
4. Two native helper-deadline failures retained their fail-closed outcomes. Package and native campaigns were serialized, and observer sampling changed from 50 to 100 ms to reduce measured observer interference. Frozen product deadlines and limits were not changed. Only affected unfinished cases were rerun.
5. The initial launcher host inherited an open stdin pipe and timed out. The engineering command runner now supplies DEVNULL for commands taking no input. The original command and streams remain in attempts; fresh launcher acceptance is separately required.

6. GitHub wrapper acceptance exposed a double final newline: the captured canonical LF was followed by PowerShell native-pipe CRLF. The wrapper now requires exactly one captured LF and removes only that LF before forwarding. The parser remains strict. The distribution was regenerated and identity-bound acceptance rerun; the prior integrated evidence is preserved under a hash-bound local diagnostic index.

7. A later native trace reused one helper PID within the same run. The historical trace validator selected both lifetimes during console teardown and rejected the otherwise observed owner. The Phase 2D validator disambiguates only through an actual earlier co-observed console/owner pair with both creation times. The historical validator is unchanged. A retained reproducer, four rejection controls, rechecks of 29 prior successful traces and fresh affected native execution bind this engineering correction.

8. A supplemental regression CNE harness incorrectly expected CNE after adding the missing baseline prerequisite. The SDK correctly returned PASS for an identical baseline/candidate pair. That observation is retained; regression-rule CNE is checked with the baseline absent, using a fresh independent SDK invocation and the already validated all-five CNE bundles. Completed supplemental cases are reused by exact current distribution and oracle-byte identity.

Executed harness versions that changed during diagnosis are retained under `harness-history`. Earlier successful traces retain their actual harness identities. Failed records are never relabeled PASS or used as successful gate evidence.

## Binding and Phase 3 handoff

I2 must have exactly B1 as its single parent and subject `feat(memoryos-1.3): integrate MO-1306 CI/CD providers`. It can be created only after all required gates pass. The candidate inventory uses a null implementation revision explicitly marked PRE_I2; it never predicts a future commit hash.

After I2 exists, B2 changes only the Phase 2 inventory and five binding receipts to bind actual I2. All inventoried I2 artifacts must match I2 Git blobs. B2 must have I2 as its single parent and subject `conformance(memoryos-1.3): bind MO-1306 phase 2 integration`. The post-B2 verifier checks this graph, the allowed binding-only delta and clean working tree.

At validated B2, generic is IMPLEMENTED / REAL_EXECUTION_VALIDATED / FINAL_CERTIFICATION_PENDING; GitLab, Jenkins and Azure are IMPLEMENTED / CONTRACT_VALIDATED / NOT_LIVE_PROVIDER_CERTIFIED; GitHub is IMPLEMENTED / HOSTED_EXECUTION_CERTIFICATION_PENDING. `mo1306-phase3-interfaces.json` describes 3A Windows/GitHub certification, 3B package/supply chain, 3C provider/security audit and 3D final integration. Hosted workflow generation must bind actual reviewed integrated source/package identities. Offline source-revision fixtures are not deployable release certification. Phase 3 remains unstarted. No push, tag, external account operation, Linux/Ubuntu operation or VM operation is part of Phase 2D.
