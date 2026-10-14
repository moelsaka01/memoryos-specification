# MO-1302 vendored-runtime workspace check correction

Classification: **WORKSPACE_CHECK_CORRECTION** (harness and tooling). It is not
a product change: no production code, released Action byte, tag or released
manifest changes.

Authority: owner decision of 2026-10-04 (Option A) on the MO-1308 Phase 1
AUTHORITY_CONFLICT recorded in
[the Phase 1 entry obligations](mo1308-phase1-entry-obligations.md), amending
[MO-1308 Contract Freeze 1](mo1308-contract-freeze-1.md) (Amendment A1).

## Release identity

| Item | Value |
|---|---|
| Tag | `memoryos-1.3-mo1302` (annotated) |
| Tag object | `773dd03829dd6b3632bf43a45578925b1498515d` |
| Peels to | `7e07bd0db9ab10146f2e0e0bbd67a4c5850cf41d` (`conformance(memoryos-1.3): bind MO-1302 Windows native evidence correction`) |
| Records naming it | [MO-1304 authority](mo1304-mcp-server-agent-integration.md) and [MO-1305 authority](mo1305-rest-gateway.md) tag tables, `evidence/mo1305-phase2d/predecessor-tags.json` |

Verified locally and on the remote before the change. The Action directory
`.github/actions/memoryos-policy-gate` is identical at that commit and at the
correction's parent, and all 37 vendored sources were byte-identical at the
tag, in current source and in the bundle.

## Old rule

`tools/verify_workspace.py`, `validate_mo1302_distribution`, ended with:

```python
for source in MO1302_VENDOR_SOURCES:
    original = root.joinpath(*source.split("/"))
    vendored = action_root.joinpath("dist", "vendor", *source.split("/"))
    ...
    if original.read_bytes() != vendored.read_bytes():
        errors.append(f"MO-1302 vendored runtime source differs from '{source}'")
```

Every bundled file had to equal the **current** source file. Any later change
to the SDK or CLI source therefore failed a released-closure check, even though
the released Action itself was untouched.

## New rule

The released Action is pinned to its release:

1. **Released manifest pin.** `distribution-manifest.json` must equal the
   released manifest byte-for-byte: 8342 bytes,
   `sha256:2e116b6518934c797e9c562670f2292462be11ee982c778b43f1aaf45a8986f9`
   (`MO1302_RELEASED_MANIFEST`).
2. **Released source pins.** Each of the 37 vendored files must equal its
   source blob at the tag: byte length and SHA-256, with the tag's git blob
   recorded for traceability (`MO1302_RELEASED_VENDOR_SOURCES`). The pin set
   must cover exactly `MO1302_VENDOR_SOURCES`.
3. **Unchanged checks.** Canonical manifest bytes, closed shape, kind and
   version; every member's path, role, byte count and digest against the
   manifest; ASCII order and uniqueness; reviewed membership; exactly one
   action metadata and one entrypoint; and the Action tree containing exactly
   the listed files. These lines are untouched.

Only the comparison against current source is replaced. No git access is
needed at verification time: the pins are constants, and a test proves each
constant equals the tag's blob.

## Why

The MO-1302 Action is a released, tagged distribution. Its integrity is
"these are the bytes that were released", not "these equal whatever the source
is today". The old rule implicitly forbade any later SDK or CLI change, which
contradicts MO-1308 Contract Freeze 1 (H06, §13, §18.1). It also had a gap: an
edited bundle plus an identically edited source, with a re-hashed manifest,
passed. The new rule closes that gap through the released-manifest pin.

## Proofs

Test: [`mo1308_phase1_workspace_check_correction_test.mjs`](../repositories/cca-conformance/tests/mo1308_phase1_workspace_check_correction_test.mjs)
with the read-only probe
[`workspace_check_probe.py`](../repositories/cca-conformance/tools/mo1308-phase1/workspace_check_probe.py),
which runs the corrected function on temporary copies, never on the workspace.

| Requirement | Proof | Result here |
|---|---|---|
| Unchanged Action passes | WC01 | PASS |
| One-byte SDK or CLI source edit now passes; the replaced rule rejected it | WC02 | PASS |
| Any bundled byte change fails | WC03 (bundled SDK, entrypoint) | PASS |
| A bundled change with a consistently re-hashed manifest fails | WC04 | PASS |
| An added or removed bundled file fails | WC05 | PASS |
| A manifest that no longer matches fails | WC06 | PASS |
| Tag exists, is annotated and peels to the recorded commit | WC07 | PASS |
| Every pin equals the exact blob at the tag | WC08 | PASS |
| Released Action bytes unchanged since the tag (R32) | WC09 | PASS |
| Only the source comparison was removed | WC10 (diff against `64e5d520`) | PASS |
| Every other check reports exactly as before | WC11 (pre- and post-correction verifiers on the same tree; the only allowed difference is the replaced rule's own message) | PASS |

Real-tree experiment with the full verifier, repeating the experiment that
found the conflict (temporary one-byte edits, each reverted):

| Temporary edit | Before the correction | After the correction |
|---|---|---|
| `repositories/cca-studio/web/js/memoryos-sdk.js` | `MO-1302 vendored runtime source differs from '…memoryos-sdk.js'` | No MO-1302 error |
| `repositories/memoryos-cli/src/commands.js` | `MO-1302 vendored runtime source differs from '…commands.js'` | No MO-1302 error |
| Bundled `dist/vendor/…/memoryos-sdk.js` | Failed | Fails: byte count changed, digest changed, differs from released |

In every run the only other error is the pre-existing Linux
`MO-1304 independent platform/parity validation failed` (`INSTALL_TOOLCHAIN`).

The [entry-obligations test](../repositories/cca-conformance/tests/mo1308_phase1_entry_obligations_test.mjs)
EO3 assertions are updated in the same commit to the decided rule: released
SDK copies and the MO-1302 bundle equal the release-tag bytes, and the
verifier no longer compares against current source.

Binding: this correction is verified and bound as its own named item in the
MO-1308 Phase 1 B1 run on the reference Windows host.
