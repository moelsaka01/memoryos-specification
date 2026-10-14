**MemoryOS 1.3 — MO-1307 Phase 3A READ_SET diagnosis**

The exact MO-1306 slot-three replay establishes repeated checked-chain identity/final-path validation as the limiting bounded operation class. Per-file initial chains and post-read chains consume 4294.5739 ms, 89.79% of READ_SET. Within identity inspection, final-path validation consumes 2340.6000 ms, 79.66% of its inclusive time. This is enough to select separately authorized implementation optimization with an unchanged contract. No production correction or certification was performed.

Historical product failures remain MO-1306 TIMEOUT/29 at 8465.2111 ms and READY TIMEOUT/29 at 11307.147 ms, both without publication. The previous three certification diagnostics and cleanupConfirmed:false remain authoritative and unchanged. The successful engineering response is not a product pass and cannot replace these receipts.

The copied helper retains every original statement/check/order; 104 marked measurement blocks and one expression split can be inverted to recover all 29771 original bytes. Both copies use 50 timing stages and Windows Stopwatch. The only production launch-authority difference is selecting the engineering copy; PS5.1 arguments, environment, installed-package cwd and piped streams are retained. No input root was moved. Each execution had a 20000 ms observation guard with a bounded 2000 ms cleanup allowance; neither expired. No input or response file contents were logged; response bytes were checked in memory against every input hash.

The exact 65-file request creates 724 initial chain entries (65×11 file components plus 9 root components). Initial identity acquisition and two post-read identity passes produce 2172 Read-Identity calls and 1448 opens. Every identity result runs full-path lexical validation again; global Assert-Root count 2239 also includes 66 Open-Chain validations and one request root validation. Observed timings and call counts localize elapsed cost to this repeated validation work. Serialization is a separate later contributor to response completion; the old 51/65 progress supports incomplete acquisition before serialization; serialization is not a demonstrated immediate historical cause.

All reported stage values are milliseconds. Inclusive parent and child timings overlap and must not be summed. In particular, identity/final-path/root-validation figures overlap initial/post-read chain figures. Direct syscall spans include their unchanged PowerShell expressions/checks and are not pure kernel timings. Stopwatch measures elapsed time; this capture cannot separate interpreter work from host descheduling. Logged write time is 17.1568 ms, and file-log preparation is 35.5215 ms including some of those writes; full timer/counter/wrapper overhead is uncalibrated. The native-helper clock and parent Node clock have separate origins; no absolute values were subtracted across them.

One conditional READY comparison used its historical root and exact 19 manifest entries, with a fresh engineering session because no old READY request frame was retained. It showed the same broad cost pattern but completed below five seconds. Therefore this task does not establish the cause or failing slot of the old READY CLI timeout. Measurement stopped after two executions; no additional MO-1306 replay, third execution or certification campaign followed.

| # | Required field | Result |
|---:|---|---|
| 1 | B2 | 976d4a04d75dadc02e30215dd5a8ddeaa2352df8 |
| 2 | Historical blocker preserved | MO-1307 PHASE 3A CERTIFICATION BLOCKED; all 266 prior blocker files unchanged. Historical cleanupConfirmed:false retained. |
| 3 | Previous diagnostic count | 3, exhausted as certification diagnostics; never restamped. |
| 4 | New diagnostic count | 2: one exact MO-1306 replay and one conditional READY comparison; no third. |
| 5 | Engineering helper identity | MO-1306 SHA-256: 762615cb9bb386eda131c08734385dd03f4dcbdd33eb2c061174b0ba8fb743d4; READY SHA-256: 6cde54480c17b7d022b60951ab2eba85798905586688e4ca8f48a1d5d0beb54b. |
| 6 | Production helper unchanged | 29771 bytes; SHA-256: ba2ffa58f253c3b8135772a880b5d306f20de56efa58e384907122f088b4a21b. |
| 7 | Exact request | Retained MO-1306 attempt1/03.request.bin; 7579 bytes; SHA-256: f880661fdd2efc69b6aa7c8c1f9d8c48512fc5fb941e672cfb296bd8b2d0e9b8; same session,sequence 3,roots,order,descriptors and input bytes. |
| 8 | File count | 65 MO-1306; 19 READY comparison. |
| 9 | Byte count | 2,004,208 MO-1306; 19,711 READY comparison. |
| 10 | Request decode time | 394.7790 ms total: UTF8 5.7122 + depth scan34.5656 + JSON136.8006 + canonical reencode/equality217.7006. Framing/read21.1740 ms. |
| 11 | Path-validation time | 1963.1478 ms total Assert-Root/Assert-Relative inclusive (2239/65 calls); initial per-file semantic/lexical spans71.6152 ms. These overlap request and identity parent spans. |
| 12 | Native-identity time | Read-Identity2938.2227 ms inclusive/2172calls; final-path validation2340.6000 ms nested. Native information58.5251 ms; attributes/GetFileType18.8861 ms; final-path call/buffer/count 208.6812 ms. |
| 13 | File-open/read time | Open-Native172.0771 ms/1448calls (CreateFile+error158.5017 ms); stream reads/disposal23.2219 ms. Initial checked file-chain acquisition1470.7160 ms includes opens+identity. |
| 14 | Post-read verification time | 2823.8579 ms for 65 file chains; final root-chain verification47.2478 ms. Nested Assert-ChainStable call-only total2844.7218 ms. |
| 15 | Encoding time | Base64+chunks28.9810 ms; response UTF8 7.4126 ms; frame header11.5074 ms. |
| 16 | Response-construction time | Per-file5.5533 ms + aggregate2.9733 ms + envelope9.2166 ms =17.7432 ms; excludes identity-object209.4978 ms nested within identity inspection. |
| 17 | Serialization time | Canonical response serialization1349.2988 ms. Secondary completion cost, not the historical immediate timeout stage. |
| 18 | stdout time | Helper Write/Flush27.3330 ms; frame2,694,360 bytes; final parent-observed chunk7688.7283 ms after spawn call. Payloads verified only in memory; no stdout content saved. |
| 19 | Process-exit time | Parent monotonic7734.7833 ms; child-process close event 7734.9310 ms; 46.0550 ms from last stdout chunk to exit. Algorithm complete5734.1341 ms, flushed response7141.2668 ms, exit-ready7141.7573 ms in helper-local clock. |
| 20 | Console-quiescence time | Owned conhost20716 confirmed terminal by held-handle wait; no remaining console processes at 383.8196 ms helper elapsed. ConfirmConsole89.5013 ms inclusive; final native wait6.1272 ms. Before request framing. |
| 21 | Slowest files | 47 history-source.s3:160.9024 ms/16067 B; 61 released.sbom:151.8797 ms/177028 B; 1 authority.methodology:131.6294 ms/12832 B; 52 released.dependency-delta:130.1948 ms/133469 B; 48 released.3b-dependency-matrix:121.7057 ms/90735 B. |
| 22 | Cumulative progress | 65/65 and 2,004,208/2,004,208 completed; 51st fully completed at 4258.0081 ms helper elapsed,1,525,139 B. Historical51 was an earlier read-prefix boundary, not equivalent full completion. |
| 23 | Primary limiting stage | Repeated full-ancestor checked-chain verification, especially post-read held/fresh identity and final-path lexical validation. |
| 24 | Secondary contributors | Initial chain acquisition and canonical response serialization; smaller decode/initialization costs. |
| 25 | Root-cause classification | MULTIPLE_CONTRIBUTORS; primary POST_READ_VERIFICATION / PATH_VALIDATION at bounded operation-class resolution. |
| 26 | Confidence/evidence boundary | Same MO-1306 bytes/checks/order/counts; measured copy has observer overhead. No exact prior timing reconstruction, pure kernel/CPU/scheduler attribution, or proof a future correction meets 5 seconds. |
| 27 | READY comparison | 19 files/19711 B; parent exit1803.0544 ms. READ_SET841.7228 ms, initial+post chains633.4817 ms, serialization46.1519 ms. Same cost shape; historical READY timeout and failing slot remain unlocalized. |
| 28 | Filesystem/environment observations | Original roots retained; reads23.2219 ms and native composite444.5941 ms provide no basis for filesystem tuning. No extra comparison, AV changes, registry changes, admin or tuning. Native Windows/PS5.1; pinned Node 24.21.0. |
| 29 | Product deadline | Unchanged5000 ms/helper,20000 ms aggregate helper-active,30000 ms CLI. Separate20000 ms engineering guard only; neither run hit it. |
| 30 | Contract changed yes/no | No. |
| 31 | Production changed yes/no | No; zero changed production bytes. |
| 32 | B2 integrity | 89/89 source and 89/89 installed members byte-identical; archive binding unchanged; 266/266 prior blocker files preserved. |
| 33 | Correction recommendation | Seek separate IMPLEMENTATION_OPTIMIZATION_WITH_UNCHANGED_CONTRACT authority. Current evidence does not justify limit increases, batching/protocol redesign or environment tuning. |
| 34 | Evidence | [Diagnostic evidence](C:/Users/melsa/Documents/Codex/cca-mo1307-3a/repositories/cca-conformance/evidence/mo1307/phase3a-readset-diagnostic/classification.json); [MO-1306 timings](C:/Users/melsa/Documents/Codex/cca-mo1307-3a/repositories/cca-conformance/evidence/mo1307/phase3a-readset-diagnostic/mo1306-timing-analysis.json); [READY timings](C:/Users/melsa/Documents/Codex/cca-mo1307-3a/repositories/cca-conformance/evidence/mo1307/phase3a-readset-diagnostic/ready-timing-analysis.json); final manifest binds all new evidence/tooling/report. |
| 35 | Report | [This report](C:/Users/melsa/Documents/Codex/cca-mo1307-3a/docs/mo1307-phase3a-readset-diagnostic.md) |
| 36 | Workspace verification | PASS: Python -B tools/verify_workspace.py --root .; native workspace only. |
| 37 | git diff --check | PASS for tracked changes; added diagnostic text also checked with Git no-index whitespace validation. No .gitattributes changes by this task. |
| 38 | Commit state | No commit; HEAD remains B2 on codex/mo1307-phase3a-runtime. Old blocker dirt and new diagnostic artifacts remain uncommitted. |
| 39 | Push | No. |
| 40 | Tag | No. |
| 41 | Linux/Ubuntu/WSL | Not used. |
| 42 | VM | Not used. |
| 43 | Provider accounts | Not used. |
| 44 | Duration | 23.16 minutes; 2026-09-29T10:19:03Z to 2026-09-29T10:42:12.386Z; within the 45 minute target. |
| 45 | Exact next task | MO-1307: separately authorize unchanged-contract optimization of native READ_SET checked-chain final-path validation (Read-Identity/Assert-Root), preserving every native/reopen/post-read check, ordering, rejection behavior, canonical bytes and 5000/20000/30000 ms limits; address serializer overhead as secondary; perform bounded uninstrumented native validation on the original roots and retain all historical failures. Do not restart Phase 3A certification without separate authority. Treat historical READY stage localization as unresolved. |

Package binding: memoryos-readiness@0.1.0; archive SHA-256: f40ba7e7b1f7ad13c6e06283be96d048d7cbf932f8b4c0b03c8fa477e75fdf28; distribution SHA-256: 587a8f27cfb700e91c70bf291bba985459818f6ef20793ecc09c96b3f3524c62; contract SHA-256: 95810fd28917b123b8809ac0677462ab4879635d1b97a5a372047c4e0aaeddc5. Previous blocker receipt SHA-256: 3ad9c150fbb25b40c18eef651e92a58927fd833e12fcde16cb72c217ea244d03.

MO-1307 PHASE 3A READ_SET ROOT CAUSE ESTABLISHED
READY FOR SEPARATELY AUTHORIZED CORRECTION
