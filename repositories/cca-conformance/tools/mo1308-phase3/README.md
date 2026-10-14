# MO-1308 Phase 3 shared tooling

Shared, platform-independent tooling for the Phase 3 certification campaigns, authored under
[the Phase 3 protocol](../../../../docs/mo1308-phase3-protocol.md) (proposed Freeze Amendment A8). Nothing here runs a
campaign: the Windows-only harnesses of 3A, 3B and 3C come in later steps and plug into `lib/runner.mjs`.

| Command | What it does |
|---|---|
| `node candidate-identity.mjs compute [--commit SHA] [--out FILE]` | compute the candidate identity (default: B2) from git objects |
| `node candidate-identity.mjs verify --file FILE [--commit SHA \| --worktree]` | re-derive it, and check a descendant commit or the working tree |
| `node corpus.mjs write --out FILE` / `verify --file FILE` | generate or check the sealed shared corpus manifest |
| `node inventory-file.mjs write` / `check` | write or check `mo1308-phase3-inventory.json` from `lib/inventory-source.mjs` |
| `node render-protocol.mjs update` / `check` | rewrite or check the generated tables of the protocol document |
| `short-temp.mjs` (`makeTemp`, `tempRecord`) | the short temporary root of A8.9: `C:\tt\<stream>-<n>` on Windows, override with `MO1308_P3_TEMP_ROOT` (at most 24 characters) |

After editing `lib/inventory-source.mjs` run `inventory-file.mjs write`, then `render-protocol.mjs update`.

`lib/` holds the pieces: `runner.mjs` (seal / run / close with first-mandatory-failure stop, guards, budgets, write-once
evidence), `seal.mjs`, `receipts.mjs`, `classification.mjs`, `evidence.mjs`, `shape.mjs`, `stable-json.mjs`, `hashing.mjs`,
`git.mjs`, `closure.mjs`, `candidate.mjs`, `inventory.mjs`, `inventory-source.mjs`, `allowed-paths.mjs`.

Tests: `node --test tests/mo1308_phase3_shared_test.mjs` from `repositories/cca-conformance`.
The runner never writes outside the evidence directory it is given, and this step commits nothing under `evidence/`.
