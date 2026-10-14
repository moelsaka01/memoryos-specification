# MO-1306 Phase 2B GitLab and Jenkins validation

This record explains the Phase 1-to-Phase 2 generation transition and the
offline validation scope under [Contract Freeze 1](mo1306-contract-freeze-1.md),
including Correction A. It is not an independent acceptance receipt.

Acceptance source:
[evidence/mo1306/phase2b/acceptance.json](../repositories/cca-conformance/evidence/mo1306/phase2b/acceptance.json)
(gate-controlled finalizer). Only that completed, identity-bound record may
establish all-gates PASS and the GitLab/Jenkins `CONTRACT_VALIDATED` claims.
An absent or failing acceptance record leaves those claims unestablished.
Native execution, final suite totals, workspace verification, completion commit
and final Git state must be taken from the final receipts and closeout report.

## Baseline and ownership

The exclusive worktree is `C:\Users\melsa\Documents\Codex\cca-mo1306-2b`, branch
`mo1306/phase2b`. B1 is `dbafc0061aa493da2517ee5564f9ea6adb90f52d`.
Initial adapter implementation `1d43584cef532ebcdf1e87b0cba277d2d7180a63`
has exactly that parent. The completion commit must have the initial
implementation as its parent and the subject
`test(memoryos-1.3): validate MO-1306 GitLab and Jenkins adapters`.
No amend, merge, rebase, cherry-pick, push or tag belongs to this continuation.
No worktree or branch for main, Phase 2A or Phase 2C is changed.

The preserved GitLab schema was an expected uncommitted input, classified
`VALID_PRESERVED_PHASE2B_INPUT`; it was not a reason to reset or clean.

## CF-GENERATION audit and phase-aware transition

The prior 151/152 result was caused by the final loop in
`repositories/cca-conformance/tools/mo1306/contracts.test.mjs`, in
`CF-GENERATION golden and deterministic ordering`. The B1 test expected all
four nongeneric provider generators to throw `MO1306_PROVIDER_UNSUPPORTED`.
That was correct for B1's four `NOT_IMPLEMENTED` providers. Commit `1d43584`
implemented GitLab/Jenkins generation, so the current checkout could no longer
satisfy that historical rejection expectation.

The audit distinguishes the following authorities; it does not globally
replace `NOT_IMPLEMENTED` or infer support from an enum or adapter filename.

| Surface | Classification and disposition |
| --- | --- |
| Current `tools/mo1306/contracts.test.mjs` | Current validator with an explicit Phase 2B capability fixture; CF-GENERATION stays enabled and checks accepted GitLab/Jenkins artifacts and rejected unsupported providers. |
| B1 Git object for that test and retained earlier harness snapshots | Historical immutable evidence; replay original test bytes with the original B1 package. |
| `tools/mo1306/audit.py`, `binding.py`, `conformance.py` | Phase 1/B1 generation and validation authorities; their historical provider-state assertions stay unchanged. |
| `mo1306-conformance-inventory.json`, `mo1306-phase2-interfaces.json`, required-case inventory and existing B1 receipts | Historical immutable evidence/interfaces; retain B1 provider states and identities. |
| `memoryos-ci/README.md` and Phase 1 foundation records | B1 package documentation. Its provider-stub and generic-only statements describe that historical distribution, not this Phase 2B engineering stage; Phase 2D reconciles integrated package documentation. |
| New `fixtures/mo1306/phase2b/generation-capabilities.json` | Current Phase 2B validation input, explicitly pinned to B1 and `1d43584`; generation support is separate from acceptance/certification. |
| Independent provider goldens and negative mutation files | Engineering fixtures/examples with synthetic pins, not provider status authorities or deployed package identities. |

The capability fixture admits generic, GitLab and Jenkins generation. GitLab
must produce `.gitlab-ci.yml`; Jenkins must produce `Jenkinsfile`; each also
produces canonical `memoryos-ci.json` and `memoryos-ci-generation.json`.
GitHub and Azure remain unsupported in this branch, pending their independent
Phase 2C integration. Unknown names, case variants and prototype-like names
must fail closed. Existing-target generation must reject without changing
the target, including empty directories, dirty directories, generated bundles
and occupied files.

## Historical B1 preservation

`tools/mo1306-phase2b/history.test.mjs` pins B1's complete tree
`0dfc97058c5d5f060c2dbb5a31fd66a706a7786d`, evidence tree
`e5e606f918fe19fe40fc799ba6c0178089c4b2d3` and package tree
`a3db70be7c37fa0fb74d13f41dd0f2b8cc356f86`. The original cheap-suite blob is
`ded32e1c738389272ec51f3c7dd5d3f4555d9a5a`, SHA-256
`ce87d84971a749ae1d932891039e7137a9a24b98226e7cbc2e475c28d2c5da78`.

The checks verify the implementation-parent graph, read B1 inventories from
Git, and compare every retained historical evidence/validator member against
its B1 Git blob. The only current harness transition is the explicitly
classified `contracts.test.mjs` change. New Phase 2B evidence is additive.

For an actual historical regression, the test extracts the exact committed
B1 package, original test and required config fixture into a fresh cache
directory using Git blob reads. It verifies each extracted blob and executes
that original suite: the required result is 152 tests, 152 passes, zero
failures and zero skips, including the original CF-GENERATION rejection loop.
This is a fresh replay with explicit B1 source binding; it does not rewrite
or relabel an earlier historical execution receipt.

## GitLab validation

The official Draft-07 schema is retained at
`fixtures/mo1306/gitlab-ci-schema-a725331f22234d3078d7300944b9454da103e73c.json`.
Source is `gitlabhq/gitlabhq@a725331f22234d3078d7300944b9454da103e73c`,
`app/assets/javascripts/editor/schema/ci.json`; its identity is
`https://gitlab.com/.gitlab-ci.yml`, length 128034 and SHA-256
`a4dc2b155aa574575fbfd51dcca99388db5ba1b563ab5e05ce8df005e7eb9ced`.
The previously verified bytes are reused. Provenance, upstream MIT notice and
schema vocabulary/reference audit are retained in the Phase 2B fixtures.

The independent validator bounds and scans bytes, uses PyYAML token/AST
parsing without object construction, rejects duplicate keys and unsafe YAML
features, and checks scalar kinds independently of YAML-1.1 coercion. Full
`jsonschema.Draft7Validator` validation and the stricter MO-1306 subset are
separate required gates. All 141 schema references are local; a retrieval
callback rejects network access. Unknown assertions fail the schema audit.
Editor annotations are recorded; optional format annotations on excluded
instance fields are not represented as checked format assertions.

The subset requires the ordered single test job, quoted ordinary strings,
manual execution, one bounded Windows tag, false allow-failure, five-minute
timeout, zero retry and one fixed PowerShell block. It independently decodes
the launcher, workspace capability, digest pins and common exit propagation.
The retained corpus contains 79 named negative cases plus 12 parser/schema
controls, giving 91 tests. The enclosing acceptance receipt records actual
results and identities; see the detailed
[GitLab validator record](../repositories/cca-conformance/fixtures/mo1306/phase2b/gitlab-validation.md).

## Jenkins validation

`tools/mo1306-phase2b/jenkins_validator.py` implements
`memoryos.conformance.jenkins.restricted-parser` version `1.0.0` using only
Python's standard library. It imports no generator/product implementation.
A bounded character lexer recognizes punctuation, identifiers, decimal
integers, single-quoted strings and triple-single-quoted scripts. A recursive
descent parser builds immutable Agent, Options, Stage, Checkout, PowerShell
and Pipeline nodes and requires the closed ordering and newline delimiters.
Semantic checks close every literal/data slot to frozen section 16.3.

A separate token recognizer decodes the protected launcher and literal digest
arguments, immediate `$LASTEXITCODE` capture and `finally` exit. The returned
descriptor is independently compared with the common launch contract.
No submitted Groovy is executed; there is no general interpreter, regex-only
pipeline checker or claimed Jenkins/plugin schema. The retained EBNF and
independent golden bind the grammar and parser scope.

The retained corpus contains 104 named negative cases, covering Groovy/script
blocks, calls and expressions, quotes/interpolation, PowerShell and multiline
injection, control/encoding defects, paths, metadata, secret placeholders,
stages/steps, argv and digest substitution. Six additional tests cover positive
AST/descriptor behavior, boundaries, trusted input pins and every truncated
prefix of the golden: 110 tests total. `test_jenkins.py --report` provides
per-case rejection diagnostics, byte hashes, category counts and the current
parser/grammar/golden/corpus identities.

## Common contract and native execution scope

Both generated files call the protected common launcher; neither supplies a
second semantic implementation. Provider metadata is operational association
only. The equivalence oracle reads the unchanged B1 projection contract from
Git and checks every classification, including PASS, FAIL,
COULD_NOT_EVALUATE, configuration/input/integrity failures, timeout and
cancellation. Dynamic metadata and invalid object/type cases receive separate
negative checks. Native Policy/Policy Set/Regression and operational-error
witnesses compare actual bundles and normative bytes; the acceptance receipt
controls which completed witnesses establish PASS.

Windows PowerShell 5.1 is used in parse-only mode for the extracted script AST.
Actual reviewed fixed launch scripts use the available PowerShell 7.6.5 under
the existing `RemoteSigned` policy. No execution-policy changes are made.
Initial Windows PowerShell 5.1 script-policy failures remain diagnostic
failures, not a requirement to install a provider or change host policy.

The headless engineering harness uses `CREATE_NO_WINDOW` for its outer
PowerShell process. A controlled diagnostic found that missing `PATHEXT`
prevented native Node invocation and left `$LASTEXITCODE` null, explaining an
empty apparent exit 0. The outer shell environment now supplies fixed
`PATHEXT=.EXE`; null native exit statuses are rejected by the launcher. This
does not add `PATHEXT` to the semantic child's strict environment. Retained
diagnostic failures are not promoted into successful semantic witnesses.

The fixed launcher validates protected paths and pins, removes Node preload
and search variables, delegates the common runner, verifies the bounded
summary and local complete bundle, and propagates the original common code.
The summary is transported as data to the verifier, not executable text.
PowerShell parse-only checks and exact script-token checks supplement each
other; neither alone claims real GitLab/Jenkins execution.

## Determinism, offline stage and dependencies

The real CLI generation suite exercises fresh output roots, reversed input
key ordering, omitted/defaulted fields and an alternate locale. It checks
exact UTF-8/LF bytes, ordering, digest pins, file cardinality and manifest
cross-links, and independently parses the resulting provider files. Its
designed matrix is six successful generations, eight no-overwrite rejections
and three unsupported-provider rejections. Final results belong to
`evidence/mo1306/phase2b/cli-generation.json` and acceptance.

The selected engineering stage is `install-v9p3k1ba`, distribution SHA-256
`816852914f943bee7465e7d8fd0bce754f885c78777738666810dc0ec748709e`.
`stage.json` binds source members, staged members, Node and validator-lock
identities. This is an offline conformance install, not a final released
distribution. Shared source contract/distribution/package/SBOM manifests and
the B1 package documentation are not finalized here; Phase 2D must reconcile
all branches and regenerate their integrated release identities.

Production adds zero external dependencies. Engineering reuses exactly seven
locked Phase 1 wheels: PyYAML 6.0.3, jsonschema 4.26.0, attrs 26.1.0,
jsonschema-specifications 2025.9.1, referencing 0.37.0, rpds-py 2026.6.3 and
typing-extensions 4.16.0. Preparation verifies retained wheel bytes and
extracted members against the unchanged engineering lock and licenses. The
Jenkins parser adds no library dependency. Node 24.21.0 is the pinned native
runtime, SHA-256
`ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32`.

The final launcher preserves the common summary's exact UTF-8/LF bytes rather
than converting LF to the Windows console's CRLF. The native harness requires
canonical summary bytes, exact classification/exit, complete semantic bundles,
provider-specific metadata and identities, and unchanged B1 normative bytes.
The pre-LF 26-case matrix is retained only as a diagnostic predecessor; final
acceptance requires a new matrix against the selected stage above.

The complete Draft 2020-12 engine independently checks 116 actual generated,
summary and bundle JSON instances across eight CI schemas, with eight
unknown-field rejection controls and local-only reference resolution. These
checks supplement, not replace, the product's cross-field verification.
The independent standard-library evidence checker verifies manifest coverage,
current bytes, stage identities, graph, status claims and raw test receipts;
its retained negative suite tests altered/missing/colliding members and false
claims. It never runs a provider or changes evidence.

During this authorized precommit continuation, the execution order after
restoring the pinned local validator cache is
`prepare.py`, `execution.py`, `cli-generation.py`, `validation.py`,
`validation.py --finalize`, then `verify-evidence.py`, all under
`repositories/cca-conformance/tools/mo1306-phase2b`. Run native suites serially:
the unchanged common filesystem helper has a strict two-second deadline.
The finalizer requires unchanged staged source bytes and the continuation's
90-minute budget; no timeout or integrity limit is relaxed by these tests.
After the completion commit, run `verify-evidence.py` to recheck these retained
receipts and their Git blobs. A later fresh campaign needs its own authorized
budget/receipts; the continuation-specific finalizer must not rewrite this
completed acceptance record or claim a new run under the old time window.

Validation uses local material with engineering socket/DNS denial and the
product's existing network boundary. There are no GitLab/Jenkins network
calls, accounts, runners, servers, installations or plugin prerequisites.
There is no Linux, Ubuntu, WSL or VM fallback. Both providers remain
`NOT LIVE-PROVIDER CERTIFIED`, even after offline `CONTRACT_VALIDATED` gates.

## Phase 2D integration notes

The shared-file overlaps requiring reconciliation are explicit:

| File/surface | Phase 2B change and integration responsibility |
| --- | --- |
| `src/core.mjs` | Admit only generic/GitLab/Jenkins dispatch; use selected adapter metadata, identity and evidence. Reconcile with Phase 2A core/lifecycle work and Phase 2C providers. |
| `src/integrity.mjs` | Bind selected adapter closures and templates and the generator template closure. Recompute integrated identities after reconciliation. |
| `src/verification.mjs` | Verify bundles against their implemented provider's adapter digest. Keep provider/result/evidence cross-links closed. |
| `src/errors.mjs` | Reject nonstring projection selectors before property lookup. Preserve the B1 projection table and numeric exits. |
| `scripts/Invoke-MemoryOSCI.ps1` | Add GitLab/Jenkins allowlist, native-exit checks, Node-variable cleanup and verified local result/summary propagation. Reconcile other provider launchers without broadening execution scope. |
| `src/generator.mjs` | Initial `1d43584` GitLab/Jenkins dispatch remains part of the 2B branch delta even if unchanged by the completion commit. Reconcile Phase 2C registration explicitly. |
| Current `tools/mo1306/contracts.test.mjs` | Phase-aware generation expectations; preserve original B1 replay and extend only to actually integrated provider capabilities. |
| Source release manifests and package README | Remain historical B1 material. Phase 2D owns integrated regeneration and documentation; staged 2B identities must not masquerade as final package identities. |

The GitLab/Jenkins adapter modules, new renderer/templates and fixed
`verify-launch-result.mjs` helper are 2B implementation inputs to that
integration. No Phase 2A/2C branch bytes are predicted or copied.

Optional consumers must provision the exact trusted Node, package and common
configuration outside the data checkout, on a protected trusted branch.
`MEMORYOS_CI_NODE`, `MEMORYOS_CI_HOME` and `MEMORYOS_CI_CONFIG` are ordinary
nonsecret absolute bootstrap capabilities. Generated digest pins must match
that reviewed installation/configuration. GitLab supplies `CI_PROJECT_DIR`;
Jenkins supplies `WORKSPACE`. A consumer's Windows runner/agent and existing
Jenkins Declarative/checkout/PowerShell capabilities are deployment conditions,
not offline validation prerequisites. Provider scheduling, protections,
plugin compatibility and service behavior remain unexecuted.
