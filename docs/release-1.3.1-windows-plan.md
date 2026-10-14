# MemoryOS 1.3.1 — plan for the Windows host

Status: **prepared in the cloud (step 3), not run.** Nothing here is a certifying result. The campaign tooling has been rehearsed in the
cloud as non-certifying (receipt under `repositories/cca-conformance/evidence/mo1310/rehearsal/`), and a certifying run is refused anywhere
but the Windows host (`tools/mo1310/campaign.mjs` checks the platform, architecture, Node version, a clean tree, a new output directory under
`evidence/mo1310/campaign/` and one-shot creation). References: sections 12 to 15 of the
[Freeze](mo1310-studio-history-1.3.1.md) and the [handoff](release-1.3.1-handoff.md).

## 0. Preconditions (stop if any is false)

1. Windows 11 x64, the host on which MO-1308 and MO-1309 were certified. Node.js **v24.21.0** exactly (`node --version`). **Microsoft Edge**
   (or another Chromium-family browser); set `MO1309_BROWSER` (the existing harness variable) unless it is in a default install path
   (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe` is found automatically); note its version in the log.
2. A fresh clone with full history **and tags** (the baseline commit `889f99e72a5d41c242572cc052ab97b07cc10a24`, tag `v1.3.0`, must exist),
   checked out at **binding B** (`main` after step 3; `git rev-parse HEAD` is recorded in each receipt). `git status --porcelain` is empty.
   Run every command from **PowerShell** (the MO-1309 Windows record found that Git Bash's tar breaks the closure case).
3. `npm ci --ignore-scripts` is not needed for the campaign; it is needed only for the prepared trees of the differential gate (W3).
4. `git tag --list "memoryos-1.3-*"` and `v1.3.0` exist; **no tag is created by anything below.**

## 1. Order of work (each numbered step is made once; failures are preserved, never rewritten)

| Step | Command (from the repository root, PowerShell) | Output (new, committed as evidence) |
|---|---|---|
| W1 the ONE combined campaign | `node repositories/cca-conformance/tools/mo1310/campaign.mjs --certifying --out repositories/cca-conformance/evidence/mo1310/campaign/gen-1` | `mo1310-campaign-receipt.json` (17 cases: SH-E1 to E7, SH-S1 to S5, SH-C1 to C5) |
| W2 retained regression | `node repositories/cca-conformance/tools/mo1310/run-tests.mjs --out repositories/cca-conformance/evidence/mo1310/regression --run-label windows` | `rows.json` and `logs/` (every suite once; a rerun is its own row and log) |
| W3 differential gate against v1.3.0, Node subset | `node repositories/cca-conformance/tools/mo1309/differential-gate.mjs --out repositories/cca-conformance/evidence/mo1310/differential --base 889f99e72a5d41c242572cc052ab97b07cc10a24 --candidate HEAD --base-tree <fresh tree at 889f99e7> --candidate-tree <fresh tree at HEAD> --scratch <dir>` (prepared trees as in the MO-1309 record: fresh clones at the two commits, `npm ci --ignore-scripts` in the lockfile directories, short paths such as `C:\n8b`, `C:\n8c`) | `receipt.json` (verdict must be `PASS…`), `comparison.json`, logs |
| W4 final | author `docs/mo1310-release-disclosures.md` (every recorded outcome and qualification, including section 4 below), then `node repositories/cca-conformance/tools/mo1310/assemble-final.mjs --candidate <last production commit> --evidence repositories/cca-conformance/evidence/mo1310 --disclosures docs/mo1310-release-disclosures.md --differential repositories/cca-conformance/evidence/mo1310/differential/receipt.json [--qualification <id>]...`, commit it as **I3**; `node repositories/cca-conformance/tools/mo1310/validate.mjs` (expect `I3_VALID_PENDING_BF`); commit the binding-only **BF** (`repositories/cca-conformance/mo1310-final-binding.json` = `{ "i3": "<I3 hash>" }`, nothing else); validate again (expect `CERTIFIED_READY_TO_TAG`); then the human tag review for `v1.3.1` | `mo1310-final-record.json`, `mo1310-final-binding.json` |

The C++ CTest differential is **skipped** only with the recorded proof: case SH-C1 of the accepted receipt (`nativeChangeProof`: baseline
`889f99e7…`, head, the count of changed paths and an empty list of C, C++, CMake and vcpkg paths), which the validator rule SH-D5 checks. If
that proof is absent or non-empty, the CTest differential of MO-1308 Amendment A3.2 is required instead.

## 2. Failure handling

As Freeze section 12: a `HARNESS_DEFECT`, `ENVIRONMENT_BLOCKER` or `INTERRUPTION` gets a new generation (`gen-2`, at most two extra) with a
`disposition.md` bound in the final record; the failed generation is preserved, never promoted. A `CONTRACT_DEFECT`, a `PRODUCT_DEFECT`
needing a public-behaviour change, a new dependency, a limit or scope change, any C/C++ change, any MO-1308 production-byte change or any
MO-1309 change that alters generator output is a **STOP** (owner).

## 3. Windows-only parts (not establishable in the cloud)

The certifying status of every case; SH-E2 to SH-E6 against a CLI export made on NTFS and shown in Edge (the native folder dialog itself is
not automated: the handle code path is exercised with a conforming handle, the directory input with a real folder through the DevTools
protocol); the Edge-rendered DOM scans of SH-S1 to SH-S5; SH-E6 (the download written by Edge equals the generator's file); SH-C3 and SH-C5
under Windows line endings and a fresh checkout; the differential gate on the Windows host; the validator over the real record.

**Operator observation (recorded, not a certifying case):** once, on the reference host, open Studio in Edge, choose **History**, press
**Choose export folder**, pick a real export in the native dialog and note the browser's confirmation prompt and the dashboard shown. Record
it in the disclosures as `Q-NATIVE-PICKER`.

## 4. Qualifications to state in the disclosures

- **Q-SAB-STANDIN.** The released MO-1308 modules test byte arrays with `value.buffer instanceof SharedArrayBuffer` and no `typeof` guard.
  A page that is not cross-origin isolated (Studio, on `http://127.0.0.1`) has no such global, so the released verifier throws a
  `ReferenceError` there. MO-1308 bytes cannot change in 1.3.1, so Studio supplies a scoped stand-in for the duration of the one synchronous
  verification call (`web/js/studio-history-verify.js`; tested with a negative control that shows the released verifier failing without it).
  A guard in the MO-1308 modules is a candidate for a later maintenance item with a byte-identical-behaviour proof.
- **Q-STATIC-FILES.** "No network" means no endpoint, no upload and no request that carries export data; Studio loads its own static files.
- **Q-FOLDER-ACCESS.** Directory-handle access exists in Chromium-family browsers in a secure context; elsewhere the compatibility input is the
  route. The browser mediates the dialog and the permission.
- **Q-MO1309-BASELINE-BOUND.** Two MO-1309 tooling tests audit the whole tree against the MO-1308 BF and fail identically at v1.3.0; their counts
  are pinned (`mo1309-baseline-bound`).
