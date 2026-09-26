# MO-1306 Phase 3 CLI dispatch correction

This correction restores the frozen public unknown-command result, `MO1306_USAGE` / exit 10. It is a targeted production correction and preparation for independent recertification, not Phase 3 certification.

The authoritative baseline is clean `main` at B2 `0e35ffe70919d77b1db530929093826410b805f9`, whose single parent is I2 `58b7b8cc90fe798fafe6d09bf04db45ceea29f6d`. The five MO-1301 through MO-1305 predecessor tag objects and peeled commits were verified unchanged.

Phase 3C's four uncommitted audit files were read completely and copied byte-for-byte into `evidence/mo1306/phase3-correction/original-3c`. Their original worktree remains untouched. Its disposition is permanently **BLOCKED / PRODUCTION_DEFECT**. No historical B2 evidence or certification label is rewritten.

## Discovery and root cause

Pinned Node 24.21.0 x64 independently reproduced `constructor`, `toString`, and `__proto__` as internal failure/16; ordinary `invalid-command` returned usage/10. Exact argv, stdout, stderr, runtime/source identities, and exits are retained in `baseline.json`. Output was empty stdout and one fixed-prose diagnostic per invocation.

The ordinary object command table used inherited lookup before its truthiness guard. The inherited values bypassed that guard, then `allowed.filter` threw before `argv` returned. Every handler call occurs after that return. Source-derived parser witnesses independently establish that no handler boundary was reached. No execution bypass, code execution, or prototype pollution was demonstrated. Classification: error-contract violation, prototype-chain dispatch defect and failure-routing issue. The prototype-mutation tests are isolated engineering witnesses, not a claim that public input can mutate prototypes.

The production change introduces `Object.hasOwn(commands, command)` before lookup. The command table and handlers are otherwise unchanged. This matches existing provider/projection ownership checks and the pinned runtime. No individual spelling is special-cased.

## Audit and focused validation

The syntax inventory covers 3076 indexed/membership sites: 114 SAFE, 1 AFFECTED, 25 NOT USER-CONTROLLED, 2761 VALIDATOR-ONLY and 175 HISTORICAL. This broad count includes numeric array/string indices, Python dictionary membership and engineering code. There are 140 production sites: 135 JavaScript computed lookups plus five PowerShell index sites. Exactly one accepts an unsupported public selector through a prototype chain.

Each occurrence has a path, line, expression, classification and rationale in `dispatch-audit.json` or `powershell-audit.json`. The immutable SDK runtime is preserved separately as semantic authority. The audit covers the pre-existing first-party production and validation surface; newly added correction tools are engineering-only. No separate substantive production defect was found.

Provider dispatch and metadata environment selection use own checks. Internal `metadata` calls receive fixed provider literals, not arbitrary public selectors. Schema references are inventoried and validator names pass through `Map`; result/error/projection keys are schema enums or catalog-checked values. Adapter verification uses own membership; generator templates and slot maps are guarded. Python dictionaries and PowerShell dictionaries have no JavaScript prototype fallback.

The exact source parser mechanically enumerates all three commands: `run`, `generate`, `verify`. The same focused suite records 175/191 passes and 16 expected failures against B2, then 191/191 passes after correction. Counts comprise three valid paths, 20 prototype names, 24 general invalid inputs, four isolated inherited additions, three legitimate own-command mutation controls, 23 each provider-selector/environment/core and projection negatives, five provider positives, eleven projection positives, 28 frozen errors and one truncation check. VM descriptors are restored in `finally` and each witness has a fresh context.

The prototype corpus includes every Object.prototype own property plus `prototype`, `name`, `length`, `arguments`, `caller`, `apply`, `call`, and `bind`. General negatives include missing/empty input, ordinary/random names, case variants, Unicode/confusables, controls, a 4096-unit bounded string, options, paths and all five provider names. All 44 direct public CLI cases return exact usage/10 diagnostic bytes, with no stack or raw error leakage. NUL cannot be represented in Windows process argv; no new parser limit is invented.

Syntax, dispatch, errors, providers, projection selectors, nine semantic smoke cases and diff checking passed before rebuilding. All 28 error mappings, messages, truncation behavior, schemas, limits, contract and SDK bytes remain unchanged.

## Semantic and provider preservation

Nine installed cases cover Policy, Policy Set and Regression, each with PASS/0, FAIL/6 and COULD_NOT_EVALUATE/7. Every evaluation identity and outcome byte/digest matches a separately invoked source SDK oracle. The production SDK remains 1.1.0. Regression CNE intentionally lacks its required baseline fact source; paired-context PASS/FAIL cases supply one. Inputs, oracle outputs and installed bundles are retained.

Installed `run`, `generate` and `verify` all execute successfully. All five providers generate byte-identical files under identical B2 inputs. Current generated artifacts differ only through the mechanically updated distribution pin and its dependent manifest digest. Independent GitLab, Jenkins, Azure and GitHub validators accept their output. Adapter/generator closure identities, projections, schemas, capability labels and GitHub workflow semantics remain unchanged. GitHub fixtures still use B2 as a data pin and are not a deployment authorization; recertification must generate from the actual corrected revision.

One engineering setup failure is retained: generation correctly rejected a missing output parent with FILESYSTEM_BOUNDARY/11. The parent was created and only unfinished generation resumed. Already successful semantic executions were retained; read-only bundle verification was repeated to capture receipts that the interrupted harness had not yet persisted. No production behavior was changed for this failure.

## Package identity and binding

Only two package files change: `bin/memoryos-ci.mjs` and `distribution-manifest.json`. The other 92 package members, component-only SBOM, dependencies, runtime closure/source identities, contract, templates and error definitions are byte-identical to B2. Separate current correction provenance/inventory records carry the new identity; B2 conformance inventories remain historical and unchanged.

Two independent clean 94-member assemblies are byte-identical. Corrected `memoryos-ci@0.1.0` archive: `memoryos-ci-0.1.0.tgz`, 197172 bytes, `sha256:2f1e9424ce64e44b7b1587ce206fe5f7ae72579652ca1fc891c489bc1a21925d`. It remains a local build artifact; its identity is committed. A fresh isolated installation used an empty explicit npm cache with `--offline --ignore-scripts --no-audit --no-fund`. Installed files are identical before and after focused execution.

The closed correction inventory binds all evidence, tools, product bytes and this document. Its validator rejects eight altered evidence/inventory cases. C3A has exactly B2 as parent; the separate C3AB binding names the actual existing C3A and changes no production files. No future commit is self-referenced. The local archive/install paths are engineering validation inputs, not committed binary artifacts.

## Recertification impact

3A, 3B and 3C each require **TARGETED_REFRESH_REQUIRED**. Actual 3A candidate/native/hosted-preparation evidence and 3B package/installed/supply receipts bind the old B2 archive or distribution. They cannot certify the changed artifact without refresh. Reuse unchanged source/runtime/dependency evidence only through explicit byte/dependency comparison; retain 3B's advisory findings and any unresolved release-acceptance conditions.

For 3A, refresh corrected artifact-bound Windows checks and reviewed hosted source/distribution pins, then complete outstanding hosted work under separate authorization. For 3B, refresh archive/source/allowlist identities, archive-bound expanded SBOM/provenance, installed smoke and receipt bindings. For 3C, independently verify this correction and resume the unfinished provider/security/release audit; the original blocker stays BLOCKED. No full restart of unchanged evidence is justified solely by this command check.

`recertification-impact.json` records point-in-time exact HEADs, dirty paths, receipt hashes and old-identity dependencies. All three were at B2 when observed; 3A/3B may continue independently. This task never writes to, stops or commits their worktrees. No push, tag, merge, rebase, cherry-pick, Linux/Ubuntu/WSL, VM, provider-account operation or recertification was performed.

The next task is targeted independent Phase 3 recertification against actual C3AB and this corrected archive, followed only afterward by separately authorized Phase 3D integration.
