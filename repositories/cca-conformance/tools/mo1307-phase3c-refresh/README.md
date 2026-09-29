# MO-1307 Phase 3C security refresh tools

All tools run from the exact C3RB r3c worktree. Production and the original 3C
checkout are read-only. The accepted execution uses the pinned Node 24.21.0
binary in the original 3C `.cache/mo1307-phase3c-runtime/node.exe`; its exact
hash is asserted by the native equivalence harness. Windows PowerShell 5.1 is
fixed at `C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe`.

Accepted evidence:

- `helper-review.ps1`: mechanical AST/token/native-call review; `-Verify` reads
  and compares the saved source-review receipts.
- `reuse-binding.mjs`: exact package/fixture/semantic dependency and release
  claim audit. No archive assembly or certification is performed.
- `equivalence.mjs --output repositories/cca-conformance/evidence/mo1307/phase3c-refresh/equivalence/<fresh-attempt>`:
  fresh B2/corrected pairs using owned local fixture roots. The guard is an
  engineering observation limit, not the product deadline.
- `protocol.mjs`: response consumer controls against accepted fresh native data.
- `toctou-boundaries.mjs`: reversible engineering mutation witnesses. Its
  accepted output is `toctou-boundaries/attempt2`; existing evidence is not
  overwritten by a rerun.
- `deadline-cleanup.mjs attempt-<n>`: fresh owned-helper transport, cleanup,
  environment and resource controls with external Windows process observations.
- `assemble-corpus.mjs`: read-only input validation and deduplicated corpus
  assembly. Repeated witnesses and failed harness attempts add no controls.
- `preserve-workspace.mjs`: baseline byte preservation and repository workspace
  verification. It does not run runtime or package certification.
- `initialize.mjs` and `prepare-equivalence.mjs` record initial preparation;
  the accepted standalone equivalence harness contains the reviewed final
  additions. Preparation/setup failures are retained in evidence.

Local `.gitattributes` preserves exact executed tool bytes in Git. All
engineering helper copies are under evidence and reverse exactly to old or
corrected production. Never install them as the production helper.
