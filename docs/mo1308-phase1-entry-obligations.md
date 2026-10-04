# MO-1308 Phase 1 entry obligations

Status: **OBLIGATIONS 1–3 PROVEN; OBLIGATION 4 FAILED — PHASE 1 STOPPED (AUTHORITY_CONFLICT)**.

[Contract Freeze 1](mo1308-contract-freeze-1.md) section 18.2 lists four
obligations that must hold before any Phase 1 binding (B1): "If any fails,
Phase 1 stops and returns to owner review as AUTHORITY_CONFLICT; it is not
worked around." This record gives the result of each. It is development
evidence produced in the cloud container (Linux, Node v22.22.0), not a
certification or binding.

Branch `mo1308/phase1`, base `1c3a4269fe9394de74e2a4a6ad76aed7d076fd19`. The
proofs are the read-only test
[`mo1308_phase1_entry_obligations_test.mjs`](../repositories/cca-conformance/tests/mo1308_phase1_entry_obligations_test.mjs)
(8 tests, 8 pass here).

## Summary

| # | Obligation | Result |
|---|---|---|
| 1 | MO-1306/MO-1307 `J` equals the Standard's JCS plus one trailing LF on every existing fixture (R03) | **PROVEN** |
| 2 | `inspectRegressionReport` verifies a report's identity | **PROVEN** |
| 3 | MO-1307 V2 stale-test correction complete and bound | **SATISFIED** (evidence `32255d7a008b342b7122d94aa35ec9e1c94eeacd`, binding `1c3a4269fe9394de74e2a4a6ad76aed7d076fd19`, PASS_639) |
| 4 | No released inventory check recomputes current `memoryos-sdk.js` bytes | **FAILED** — see below |

## 1. J equivalence (R03)

Three serializers were compared: MO-1306 `J`
(`memoryos-ci/src/serialization.mjs`), MO-1307 `J`
(`memoryos-readiness/src/canonical.mjs` `canonicalBytes`), and the Standard's
JCS (`cca-studio/web/js/mip-canonical.js` `canonicalize`, CCA-MIP-1.0).

| Corpus | Files | J-canonical files | Equal to JCS + LF | Values in MO-1306 / MO-1307 J domain | Value-level mismatches |
|---|---:|---:|---:|---:|---:|
| `cca-conformance/fixtures/mo1306`, `mo1306-phase2c`, `mo1307` (the obligation) | 662 | 553 | 553 | 614 / 605 | 0 |
| `cca-conformance/evidence/mo1306`, `mo1307` (additional coverage, exploratory, not in the test) | 12,264 | 2,881 | 2,881 | 5,160 / 4,765 | 0 |

The 39 non-JSON fixture files (binaries, licences, YAML, MIP packages) are
outside J. Boundary vectors (key order including non-BMP keys, escapes,
controls, maximum safe integer, deep nesting) agree; values outside the J
domain (negative, fractional or unsafe numbers) are refused by both J
implementations rather than serialized differently. Reason: both J
implementations sort keys by UTF-16 code unit, serialize strings with
`JSON.stringify`, accept only non-negative safe integers and append one LF,
which is exactly JCS + LF on that domain.

## 2. Regression report identity

`MemoryOS#inspectRegressionReport` calls
`parseDetachedCognitiveRegressionReport`, which validates the closed shape and
recomputes `identifier = "regression:" + D("INVESTIGATION-CORE-REGRESSION-1.0",
JCS({baseline, candidate, categories, overall, regressionDetected}))`, failing
with `REGRESSION_REPORT_IDENTITY_MISMATCH` on any difference. This is the
Standard's construction (`cognitive-regression.md`: "Validation recomputes
every status and this identifier") and the Core's own (`cognitive-regression.js`
`reportIdentifier`).

Proven through the public SDK with a Core-produced report that has real
differences: the genuine report is accepted and its identifier matches an
independent recomputation; a replaced identifier, changed source identifiers,
changed Workspace identifiers and a changed difference digest are each
rejected with `REGRESSION_REPORT_IDENTITY_MISMATCH`.

Recorded limit (consistent with Freeze H07): identity is integrity, not
origin. A report whose identifier was recomputed after editing is accepted.
REGRESSION_REPORT admission therefore proves the report is internally
consistent, not who produced it.

## 3. V2 dependency

Satisfied. The bound V2 receipt records Node v24.21.0 (`node.exe`
`sha256:ba4e6d11…6c32`), 25 files, 639 tests, 639 pass, exit 0, production
unchanged.

## 4. Released-closure check — FAILED (AUTHORITY_CONFLICT)

`tools/verify_workspace.py` (run by CTest through `tests/CMakeLists.txt`)
contains `validate_mo1302_distribution`, which requires every file in
`MO1302_VENDOR_SOURCES` to be **byte-identical to its current source**:

```python
for source in MO1302_VENDOR_SOURCES:
    original = root.joinpath(*source.split("/"))
    vendored = action_root.joinpath("dist", "vendor", *source.split("/"))
    ...
    if original.read_bytes() != vendored.read_bytes():
        errors.append(f"MO-1302 vendored runtime source differs from '{source}'")
```

The list includes `repositories/cca-studio/web/js/memoryos-sdk.js` and every
existing CLI source file: `memoryos-cli/package.json`, `src/arguments.js`,
`commands.js`, `errors.js`, `help.js`, `main.js`, `output.js`,
`policy-arguments.js`, `policy-commands.js`, `policy-publication.js`,
`session.js`, `version.js`. The vendored copies live in the released MO-1302
GitHub Action (`.github/actions/memoryos-policy-gate/dist/vendor/`, tag
`memoryos-1.3-mo1302`).

Verified empirically in this container with temporary, uncommitted edits that
were reverted:

| Temporary change | Verifier result |
|---|---|
| One byte appended to `cca-studio/web/js/memoryos-sdk.js` | New error: `MO-1302 vendored runtime source differs from 'repositories/cca-studio/web/js/memoryos-sdk.js'` |
| One byte appended to `memoryos-cli/src/commands.js` | New error: `MO-1302 vendored runtime source differs from 'repositories/memoryos-cli/src/commands.js'` |
| New file `cca-studio/web/js/<new>.js` | No new error |

(The pre-existing `MO-1304 independent platform/parity validation failed` error
is the known Linux `INSTALL_TOOLCHAIN` limitation and appears in every run.)

### The contradiction

- Freeze §13, §18.1 and H06 require Phase 1 "guarded SDK signatures" and a
  "guarded CLI grammar", Phase 2C CLI history commands wired into the CLI, and
  Phase 2D SDK forwarding functions and version 1.2.0 (changes to
  `memoryos-sdk.js`, `commands.js`, `main.js`, `help.js`, `version.js`,
  `package.json`).
- Freeze §5.1, §16 and R32 require released packages and vendored closures to
  stay byte-identical, and the workspace verifier binds the released MO-1302
  vendored runtime to the current SDK and CLI source bytes.
- Freeze §5.1 stated that `verify_workspace.py` "checks the recorded revision,
  not current source bytes". That is true for the v1.2.1 Reference
  Implementation revision but incomplete: the MO-1302 vendor check does
  recompute current source bytes. This is the case obligation 4 was written to
  catch.

Any change to the SDK or CLI source therefore either fails the workspace
verifier or requires changing the released MO-1302 Action. Phase 1 cannot
implement its guarded SDK and CLI deliverables without one of these, and the
Freeze forbids working around it.

### Options for the owner

| Option | Description | Consequence |
|---|---|---|
| **A (recommended)** | Correct the verifier: bind each MO-1302 vendored file to the source blob **at the release tag `memoryos-1.3-mo1302`** (and to the Action's own distribution manifest, which is already checked), instead of to the moving current source. A separate, bound tooling correction, like earlier MO-1307 corrections. | Released Action bytes unchanged (R32 holds). The released closure stays pinned to what was released. SDK and CLI source can evolve. Needs owner authorization because it changes a released-closure check. |
| B | Re-vendor the MO-1302 Action whenever the SDK or CLI changes | Changes a released, tagged Action distribution; contradicts R32 and would need an MO-1302 re-release or correction. |
| C | Re-place MO-1308 so no existing SDK or CLI file changes (for example, a separate history SDK module and a separate history executable) | Contradicts H06 and V7 (the history surfaces are the existing JS SDK and the `memoryos` CLI) and ARCHITECTURE §5 (the CLI consumes only the SDK); reopens frozen decisions. |

## What this branch contains

- One docs-only commit recording the bound V2 correction and the ROADMAP
  update.
- The entry-obligation proofs (this record and the test).

Nothing else from Phase 1 was implemented. The contract module
(`memoryos-history-contract.js`) would not itself trip the verifier, but its
placement (H05) and the guarded signatures depend on how this conflict is
resolved, and the Freeze requires Phase 1 to stop rather than proceed
partially.

## Other pre-existing findings

- `repositories/cca-conformance/tools/run-js-conformance.mjs` (`npm test`)
  already fails at the baseline: its closed test-file list has 28 entries,
  while 53 `*_test.mjs` files exist (all MO-1306 and MO-1307 suites are
  unregistered). MO-1307 ran its suites with the glob runner
  `node --test --test-concurrency=1 tests/mo1307_*_test.mjs`; the MO-1308
  proofs follow that precedent (`tests/mo1308_*_test.mjs`).
- The V2 binding binds `docs/mo1307-v2-stale-test-correction.md` at
  `1c3a4269fe9394de74e2a4a6ad76aed7d076fd19` (13387 bytes,
  `sha256:157e6dd1…`). The later status update on this branch is
  documentation and is recorded in that file.
