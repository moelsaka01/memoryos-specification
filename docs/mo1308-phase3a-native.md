# MO-1308 Phase 3A native campaign: platform-neutral part

Status: **PARTIALLY AUTHORED AND REHEARSED IN THE CLOUD — NOT CERTIFIED**. Stream 3A of the [Phase 3 protocol](mo1308-phase3-protocol.md)
(Freeze Amendment A8, section 34), on branch `mo1308/phase3a-native`. Nothing here is evidence; nothing was committed under
`evidence/`. This branch holds the 34 cases that need no Windows API; the other 74 are declared host-only and are Step 3 scope.

## 1. Implemented (34 cases, `repositories/cca-conformance/tools/mo1308-phase3a/`)

| Files | Cases |
|---|---|
| `cases-cli.mjs` | B1–B10: the CLI contract through real processes (version/help and the unchanged baseline command set, init, append for 7 kinds with CICD 6 and 4 files, decision claims, verify/query, tombstone/export/verify-export including a constructed purgePending, every reachable Freeze 14.1 code with exit category and fixed message in human and JSON form, no leaked paths or content, `session` untouched, SDK ≡ CLI byte equality) |
| `cases-det.mjs` | A3 (production blobs equal the sealed candidate identity), C1–C5 (twin ledgers under other directory, cwd, environment, locale and time zone are byte-identical; layout; no timestamps; one Workspace), M1–M4 (every ledger verifies or is a recorded intentional corruption; identity re-verified; raw-log index; nothing outside the work root) |
| `cases-boundary.mjs` | D5: init and export at or under a link (symlinks, junctions on Windows), and `export --output` inside the ledger in every F4 form plus identity aliases, all expecting `MO1308_FILESYSTEM_BOUNDARY` (exit 4), nothing created, ledger and link target unchanged (Amendment A9.2) |
| `cases-limits.mjs` | J1–J13: limit-1, limit, limit+1 for every member and total limit, descriptor 1,024, entry bytes, 16/17 subjects, query page 1/1000 and 0/1001, the CLI stdout cap (reached with 1,000 valid checkpoints of 5 KB entries), 10,000/10,001 checkpoint transitions with a linearity check, and the 1,000-item anomaly lists |
| `support.mjs`, `env.mjs` | process runner with a raw-log index, SDK twin ledger, independent re-sealing, on-disk layout writer, case environment |
| `cases.mjs`, `campaign.mjs`, `dev-run.mjs` | the case table with the host-only declarations, the command line, an authoring runner |

Findings recorded while authoring (to be disclosed or fixed by the owner, not changed here):

* `history export --output` inside the ledger directory corrupted the ledger (the 3C-F4 finding). It is fixed in the corrected candidate (Amendment A9.2) and 3A-D5 now covers it.
* The CLI grammar shadows `MO1308_QUERY_INVALID` with `MO1308_USAGE` for a bad `--limit`; the SDK still gives `QUERY_INVALID` (J10 asserts both).
* `verify` reports an exact `pendingArtifacts` count but only the first 1,000 `unreferencedRecords` and no total for them (J13 asserts what exists).

## 2. Rehearsal (Linux, cloud, non-certifying)

`REHEARSAL_PARTIAL`: 108 cases, 34 executed and PASS, 0 failed, 74 skipped as declared host-only, about 55 s, on the corrected candidate; all three segments
(`main1`, `main2`, `ceiling`) report PASS. A certifying generation refuses every skip (`SKIP_NOT_ALLOWED`), so the generation cannot
pass until Step 3 supplies the rest.

## 3. Step 3 scope: the Windows harness that does not exist yet

| Harness | Cases |
|---|---|
| Host capture (build, NTFS volume, Node hash, AV, LongPathsEnabled, 8.3, symlink privilege, load) | A1, A2, A6, A7 |
| Gate inputs bound at seal time (A3.2 receipt, tool inventory, harness review) | A4, A5 |
| NTFS file-index reader | C6, E3 |
| Junction and reparse-point planting, name and path forms, ACL and read-only setup (D5 is already done for symlinks and junctions; its drive-letter, UNC and 8.3 spellings stay for the host) | D1–D4, D6–D12, E1, E2, E7 |
| Exclusive-handle holder and delete-pending probe | E4, E5, E6 |
| Process-tree launcher and handle observer (fan-out, repeated census) | F1–F7 |
| Junction swapper racing real operations | G1–G6 |
| Process killer, console and Ctrl-C/Ctrl-Break launcher, closed stdio | H1–H10 |
| Purge on the host with a member held open | I1–I6 |
| Fault-injection preload and process, socket, handle and memory observer | K1–K4 |
| Console code page, headless launch, closed pipe, clock and NODE_OPTIONS | L1–L6 |
| Ceiling generator and the JC segment runner | JC1–JC10 |

I1, I3–I6 and K1–K4 are cheap to promote: the 3C branch already implements the same logic on any host.
