# MemoryOS 1.3 MO-1309 — Contract Freeze 1: Cloud Dashboard

## 1. Authority, status, baseline and scope

Status: **FROZEN — CONTRACT FREEZE 1** (owner pre-approved under the decisions
M1–M15; self-approval rule applied, section 24).

This Freeze follows the [MO-1309 authority](mo1309-cloud-dashboard.md) and its
decision register (zero OPEN). Resolutions below are of two kinds: **OWNER**
records an owner decision from the register; **FROZEN** records a technical
resolution that follows from those decisions and from the
[MO-1308 Contract Freeze 1](mo1308-contract-freeze-1.md), which this document
models wherever the owner's report is silent. After this Freeze, implementation
may resolve private details only; any change to public behaviour, shapes,
identities, errors, limits or the accepted risk returns to owner review
(CCA-ENG-2.0).

It is documentation only: no production code, schema, package, fixture,
evidence, tag, pull request, or change to `moelsaka01/cca-specifications`.

### 1.1 Baseline (2026-10-10)

| Check | Result |
|---|---|
| Authority commit | `eeef2eed56c27916241cf3194f974b731064a5d7` on `mo1309/authority`, created from `origin/main` `8412823132279215cda1eae4364f4f412a0e6fad` |
| MO-1308 release | tag `memoryos-1.3-mo1308` → BF `bf2fdc87e9b2bfc25588ef61deacac6c04684376` (verified to peel exactly; ancestor of `main`) |
| Standard | `moelsaka01/cca-specifications` `bdf8fd465c1a402879911c1166179b41e72ca290`, read-only; the clone was checked out in this session (authority section 1.1) |

## 2. Scope (M1–M4)

**In scope (OWNER).** A deterministic generator that reads one MO-1308
`MemoryOSHistoryExport` directory and emits one static, self-contained HTML
snapshot with embedded interactivity, and a strictly read-only page over a pure
view model. The snapshot is "cloud-ready": an operator may host the file
anywhere; MemoryOS ships no hosting.

**Out of scope (OWNER / FROZEN).** A server or hosted service; accounts,
tenancy, billing, authentication; any network access by the generator or the
page; import, merge, append, tombstone, purge, repair or any ledger write;
approve, reject or acknowledge controls; direct policy-evaluation, readiness
or regression inputs (they reach the dashboard only as ledger entries); parsing,
embedding or rendering retained member contents (section 9.3); a framework, a
build step or any dependency; an SDK or CLI surface (section 4.3); live
refresh; cross-ledger views (MO-1308 H28 stays excluded); the CCA-MEMORYOS-1.1
Standard (M11).

## 3. Terms

- **Export:** a `MemoryOSHistoryExport` directory exactly as MO-1308 section 12
  defines it.
- **View model:** the closed, canonical value `MemoryOSDashboardViewModel`
  (section 6).
- **Snapshot:** the one HTML file the generator emits (section 5).
- **Wording registry:** the closed table of every string the page chrome may
  show (section 7).
- **Untrusted data:** every string and number that originates in an export,
  including identifiers, subjects, reasons and the tombstone authority
  reference.

## 4. Placement, imports and dependency direction

### 4.1 Placement (FROZEN)

Modelled on MO-1308 section 5.1. Dependency-free ES modules in
`repositories/cca-studio/web/js/` (browser-safe, no filesystem, network or
clock), plus one Node tool for file transport:

| Unit (proposed name) | Responsibility |
|---|---|
| `memoryos-dashboard-contract.js` | Closed constants, shape validators, limits; **imports** enums and limits from `memoryos-history-contract.js` |
| `memoryos-dashboard-viewmodel.js` | Pure: verified export bytes in, `MemoryOSDashboardViewModel` out |
| `memoryos-dashboard-wording.js` | The wording registry and the forbidden-affordance rule |
| `repositories/cca-studio/web/dashboard/` | Static page source: markup template, stylesheet, page script |
| `repositories/cca-studio/scripts/` generator | Node tool: reads the export once, calls the pure units, writes the snapshot |

### 4.2 Imports from MO-1308, never copies (FROZEN)

The dashboard imports, and never redefines or copies: record-kind, retention,
entry-type and `decisionConsistency` enums; the limits in MO-1308 section 14.2;
`verifyHistoryExport` as the sole verification authority; and the query
filter semantics. A source scan and a differential test enforce this
(DB11, DB12). The generator verifies; it does not reimplement chain,
digest, manifest or marker logic. MO-1308 modules, SDK, CLI, schemas and
fixtures are not modified by MO-1309 (DB26).

### 4.3 No SDK or CLI surface (FROZEN)

v1 adds no SDK function, CLI command or version change. The generator is a
repository script invoked as `node <generator> <export-directory>
<output-file>`. Promoting it to a CLI command is a scope change and returns to
owner review.

### 4.4 Dependency direction

```text
memoryos-history-contract.js / -ledger.js (MO-1308, unchanged)
        -> memoryos-dashboard-* (pure; no SDK, Core, readiness, CI, fs or network import)
        -> generator script (reads once, verifies, builds, writes one file)
        -> dashboard page (reads only its embedded data)
```

## 5. Delivery: the snapshot (M3, M6; FROZEN)

The snapshot is **one HTML file** containing the markup, one inline stylesheet,
one inline script and one embedded data block
(`<script type="application/json" id="memoryos-dashboard-data">`). It makes no
external reference of any kind. A restrictive policy is set by `<meta
http-equiv="Content-Security-Policy">`:

```text
default-src 'none'; script-src 'sha256-<script>'; style-src 'sha256-<style>';
base-uri 'none'; form-action 'none'
```

with the two hashes computed at generation. There is no `unsafe-inline`,
`unsafe-eval`, `data:` or `blob:` source, and the page uses no `eval`,
`Function`, `innerHTML`, `outerHTML`, `insertAdjacentHTML`, `document.write`,
`javascript:` URL, `setTimeout`/`setInterval` with a string, `import()`,
`fetch`, `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`, form,
`window.open`, cookie, `localStorage`, `sessionStorage` or `indexedDB`. A
hosting operator should additionally send the same policy plus
`frame-ancestors 'none'` as headers; that guidance is documentation, not a
MemoryOS guarantee.

The snapshot footer shows the generator version and the snapshot digest
(SHA-256 of the file's bytes with that one footer field blanked, a
non-self-referential definition fixed in Phase 1).

Rejected: a served application, an interactive local app loading an export at
runtime (the file API would have to be trusted), an external script or
stylesheet (a `file://` origin makes `'self'` unreliable), a framework or build
step (M6).

## 6. View model contract (FROZEN)

```text
MemoryOSDashboardViewModel {
  kind: "MemoryOSDashboardViewModel", version: "1.0.0",
  source: { ledgerIdentifier, workspaceIdentifier, entryCount, headDigest,
            manifestSha256 },
  verification: { retainedRecords, purgedRecords, tombstones,
                  purgePending: [Index], unreferencedRecords: [Digest],
                  pendingArtifacts: Integer },
  summary: { byRecordKind: [{recordKind, count}],
             byRetention: [{retention, count}],
             byDecisionConsistency: [{value, count}] },
  entries: [{ index, entryDigest, entryType, recordKind|null,
              recordDigest|null, admission|null, workspaceAssociation|null,
              subjects: [{type, value}], retention: "RETAINED"|"PURGED"|null,
              tombstoneIndex: Index|null,
              decisionConsistency: null|"CONSISTENT"|"CONTRARY_TO_READINESS",
              members: [{name, byteLength, sha256}] }]
}
```

Rules:

1. The shape is closed: an unknown or missing member, a wrong type or a value
   outside an imported enum is rejected (DB10).
2. `entries` is index-ascending and contiguous from 0; `entryCount` equals its
   length; arrays inside summary sort by the imported enum order.
3. The view model contains no timestamp, path, host, user, clock, locale or
   generation time (section 11).
4. Every field that MO-1308 query returns keeps its MO-1308 meaning; the view
   model adds only `members` (names, lengths, digests), `summary` and the
   verification counts, all of which MO-1308 verification already computes.
5. Retained member contents are never part of the view model (section 9.3).
6. Canonical form is RFC 8785 JCS plus one trailing newline, as MO-1308.

`members` for a purged entry is the list MO-1308 retains after a purge; for a
retained entry it is the verified names, lengths and digests.

## 7. Wording registry contract (OWNER M14; FROZEN)

1. The registry is a closed table `key → string`. Every string the page chrome
   (labels, headings, button text, tooltips, status text, error text,
   accessible names) shows is a registry key. The page script has no string
   literal for display outside the registry (DB14).
2. **No approve / ready / green affordance on any technical state.** The page
   shows no control, label, icon, colour or ordering that signals approval,
   readiness, success, safety, trust, certification or a pass for any
   verification, admission, retention, consistency or anomaly state. States
   are described neutrally, with the same visual weight, and never by colour
   alone.
3. `CONTRARY_TO_READINESS` is displayed as a neutral, disclosed observation,
   with the registry text stating that the dashboard does not decide and that a
   human decision claim is not a MemoryOS approval.
4. Mandatory registry content: that verification is integrity only; that the
   history is not authenticated, encrypted or signed; that tail truncation and
   rollback are detectable only against an externally recorded `headDigest`,
   with the `headDigest` shown in full and copyable; that the snapshot shows one
   export as of generation, not a current store; and that anomalies (pending
   purges, unreferenced records, pending artifacts) are disclosed counts.
5. **Scanner.** A test renders the page for every fixture, extracts every
   rendered string (text nodes, attributes, `title`, `aria-*`, `alt`, the
   document title) outside the untrusted-data cells, and fails if any matches
   the forbidden set `approve*`, `reject*`, `ready`, `green`, `certif*`,
   `pass*`, `fail*` as a state label, `safe`, `trusted`, `authentic*`,
   `signed`, `encrypted`, `verified` unqualified by "integrity", `OK`, `success`
   or the check-mark and cross characters, except for registry entries that
   *negate* a claim and are listed in a closed allow-list reviewed in Phase 1
   (for example "not authenticated, not signed, not encrypted"). The scan also
   fails on a button, link or input whose action is not in the closed
   read-only action set (filter, sort order, page, expand/collapse, copy,
   select entry).
6. The same test renders adversarial fixtures whose untrusted data contains
   those words, and proves they appear only as inert text in data cells and
   never change a state, class, label or control.

## 8. Page behaviour and quality (FROZEN)

1. **Interactivity** is embedded and client-side only: filter by record kind,
   retention, subject and decision consistency; sort index ascending or
   descending; page; expand an entry to see its members; copy a digest. Filtering
   by record kind, subject and retention gives the same entries as
   MO-1308 `query` with the same arguments (DB12).
2. **Paging:** a fixed page size of 100 rows (a presentation constant that is at
   most the MO-1308 query maximum of 1,000). Rendering touches only the current
   page.
3. **Accessibility:** keyboard-operable, visible focus, semantic landmarks and
   table markup, accessible names from the registry, contrast of at least 4.5:1,
   no meaning by colour alone, no motion, honours reduced-motion and forced
   colours, supports 200% zoom.
4. **Responsive:** no horizontal page scroll at 320 CSS px; tested at 320, 768
   and 1280 px widths.
5. **Hosting-neutral:** identical behaviour from `file://` and from any static
   HTTP host (DB25).

## 9. Security and privacy (M2, M4, M6; FROZEN)

### 9.1 Untrusted data and escaping

All export-derived strings are untrusted (section 3). They are never
interpreted as markup, script, style, URL or key. The page writes them only
with `textContent`/`createTextNode`; attributes derived from them are set with
`setAttribute` on a closed set of safe attribute names and never on event
handler, `href`, `src` or `style` attributes. Embedded data is serialized so
that `<`, `>`, `&`, U+2028 and U+2029 are escaped, so no value can close the
data block or the document. Very long values are truncated for display with the
full value available through copy; truncation is announced in text.

### 9.2 No network (OWNER M1)

The generator opens no socket and resolves no name. The page issues zero
requests after load. A test loads the snapshot with all network blocked and
asserts zero attempted requests, and a source scan asserts the forbidden APIs
of section 5 are absent. The snapshot contains no `http:`, `https:`, `//`,
`data:` or `blob:` reference outside the untrusted data block.

### 9.3 Retained members are untrusted and never rendered

Retained members may hold arbitrary bytes. The generator reads each one
exactly once, only to let `verifyHistoryExport` check length and digest. It
never parses, embeds or renders member contents. Displaying member contents is
a scope change.

### 9.4 Read once, then verify

1. The generator `lstat`s each export path, rejects anything that is not a
   regular file or directory (symbolic link, junction, device), and reads every
   file **once**, bounded by the size recorded in the manifest and by the
   MO-1308 limits, into memory.
2. `verifyHistoryExport` runs over those in-memory bytes. On any failure the
   generator emits nothing and exits with a typed error.
3. The view model is built **only** from the verified in-memory bytes; the
   export directory is never read again. A swap after reading cannot change what
   is displayed.
4. The output is written to an exclusive staging name and published with a
   non-replacing hard link, so a partial file never appears under the final
   name and an existing file is never overwritten. A failed exclusive create is
   a typed IO failure, not retried (modelled on MO-1308 A6).

### 9.5 Data classes and privacy

The snapshot contains only view-model fields (section 6). It contains no input
or output path, host or user name, environment value, clock, member contents or
generator-side diagnostics. Because the history is not encrypted (MO-1308
Q-class H08), a hosted snapshot discloses entry metadata (identifiers,
subjects, digests, tombstone reasons and authority references) to whoever can
read it. The registry states this in the page and the release wording states it
at the v1.3.0 step. Access control for a hosted snapshot is the operator's
responsibility and is not provided or claimed by MemoryOS.

### 9.6 No new trust claim

The snapshot is an integrity view of one verified export. It is not evidence of
authenticity, completeness, currency or approval (MO-1308 Q13, Q03).

## 10. H40 / A6 re-review (OWNER M5)

MO-1308 section 9.4 requires the Node-only store's risk acceptance to be
re-reviewed before any multi-user, shared-storage or cloud use, including
MO-1309. The re-review, recorded here and re-confirmed in Phase 2C:

| Question | Finding |
|---|---|
| Does MO-1309 create or use a ledger store? | No. It never opens a ledger directory; it reads an export, which MO-1308 produced and `verifyHistoryExport` checks |
| Does the H40 gap (a concurrent directory swap is detected after the fact, not prevented) reach the dashboard? | Only as a swap of the export directory before reading. Read-once-then-verify (9.4) makes a swap after reading irrelevant to what is displayed; a swap before reading yields a different export that must itself verify, and a self-consistent forged export still verifies (Q13), which the page discloses |
| Does A6 (a failed exclusive create of a staging file is a typed, unretried IO failure) apply? | Yes, to the generator's output staging file; the same discipline is adopted (9.4) |
| Does "cloud-ready" widen a store claim? | No. Under M1 = A, hosting the generated file is not a store. It widens the readership of already-verified metadata (9.5), which is disclosed |
| Resulting claim | The MO-1308 store claim is unchanged: local single-user v1 on native Windows 11 x64. The dashboard adds only: an integrity view of one verified export as of generation |

A multi-user, shared-storage or hosted-service claim needs a new milestone with
its own authority and a full H40 revisit (decision M5, option B/C, not
selected).

## 11. Determinism (FROZEN)

The same export bytes and the same generator version produce a byte-identical
snapshot on every run. The generator reads no clock, random source, locale,
timezone, environment value or directory enumeration order (it processes entries
by index and sorts any listing bytewise). Embedded data is canonical JCS. Line
endings are LF. The page displays no time. A test generates twice, and from
directories listed in permuted orders, and requires identical bytes (DB18, DB19).
The rendered DOM for a fixed fixture, viewport and interaction script is also
compared byte for byte.

## 12. Limits and the certification scale (M7; FROZEN)

| Limit | Value | Basis |
|---|---|---|
| Entries per export accepted | 100,000 | MO-1308 section 14.2, imported, unchanged |
| Entry file, descriptor, member limits | MO-1308 section 14.2, imported | |
| Page size in the page | 100 rows | Section 8 |
| Subjects per entry | 16 | Imported |
| Generator input read | Bounded by the manifest sizes and the imported limits | 9.4 |

**Certification scale (OWNER M7).** MO-1308 took about 16 minutes to export
100,000 entries (Q11), and export performance is separate maintenance outside
MO-1309 (section 18). MO-1309 therefore certifies at a **measured smaller
scale**: Phase 2D measures view-model build, snapshot generation, snapshot size
and page load at 1,000, 10,000 and 100,000 entries on the reference host. The
certified scale is the largest of **1,000 and 10,000** entries at which the
Phase 2D measurement shows generation and load completing; its time and size
budgets are recorded in the Phase 2D binding from that measurement. They are
then fixed: raising a budget or the certified scale after that binding returns
to owner review. The 100,000-entry result is **characterized only**: recorded
with no pass, fail or support claim, and disclosed as a known performance
characteristic. No MO-1309 limit changes an MO-1308 limit.

## 13. Errors (FROZEN)

| Code | Meaning |
|---|---|
| `DASH_USAGE` | Wrong arguments |
| `DASH_EXPORT_UNREADABLE` | Missing, non-regular or oversize file, or an IO failure while reading |
| `DASH_EXPORT_INVALID` | `verifyHistoryExport` failed; the MO-1308 error code is carried and nothing is emitted |
| `DASH_LIMIT_EXCEEDED` | An imported limit is exceeded |
| `DASH_OUTPUT_EXISTS` | The output name exists; nothing is overwritten |
| `DASH_IO_FAILURE` | Staging or publication failed; not retried |

Exit status is 0 on success and non-zero on any listed code; the code is the
first token of the single line on standard error. Output is never partial.

## 14. Standing pre-authorizations (OWNER M9)

Adopted as drafted. This section is standing authority for tooling and
reviewers for every MO-1309 phase and the maintenance item, unless the owner
revokes or amends it.

1. **Harness or environment fixes** are allowed inside this envelope: they
   change only test, harness, fixture-generation or tooling files, never
   product bytes, a contract, a limit, a claim or an evidence record. Each one
   needs a **negative control** proving the loosened assertion still fails on a
   real violation, and each is **logged afterwards** in the phase handoff run
   log.
2. **New generations after non-product failures.** A failure classified
   `HARNESS_DEFECT`, `ENVIRONMENT_BLOCKER` or `INTERRUPTION` gets a new
   generation without owner review, **capped at two extra generations per
   stream**. A `CONTRACT_DEFECT`, a `PRODUCT_DEFECT` with a public-behaviour
   change, and an `ESCALATED_PRESERVED` generation still need the owner, as in
   [MO-1308 Phase 3 protocol section 6](mo1308-phase3-protocol.md).
3. **Fast-forwards of `main`** are allowed at named boundaries: Freeze approval,
   each phase binding, I3/BF and evidence commits. Fast-forward only, after an
   ancestry check, never forced. **Tags stay human.**
4. **Documentation-only corrections** to ROADMAP, CHANGELOG and handoff files
   need no approval.

**Not pre-authorized:** tags; pushes of tags; limit or scope changes; new
dependencies; anything that weakens a product guarantee.

## 15. Phase plan and branches (OWNER M8, M10; report §J)

| Phase | Branch | Scope | Where |
|---|---|---|---|
| 0A Authority | `mo1309/authority` | Authority, decision register, ROADMAP correction, CHANGELOG, handoff. Docs only | Cloud (complete) |
| 0B Freeze | `mo1309/freeze` | This document | Cloud; self-approval (section 24) |
| PM maintenance (independent) | `maint/pre-1.3-release` | Items 1 to 5 of the carry-over table. Test and CI only, no product semantics (section 18) | Cloud for test fixes; GitHub Windows runners for C++ |
| 1 Contract + view model | `mo1309/phase1` | Pure module importing MO-1308 enums, wording registry, fixtures from real small exports, determinism and separation tests, ARCHITECTURE text (section 20) | Cloud |
| 2A UI | `mo1309/phase2a-ui` | Static, dependency-free, CSP-safe, responsive, accessible page over the view model; browser tests with the preinstalled Chromium | Cloud |
| 2B Generator/loader | `mo1309/phase2b-build` | Reads an export once into memory, verifies via `verifyHistoryExport`, emits the snapshot or feeds the UI | Cloud |
| 2C Security/trust review | `mo1309/phase2c-trust` | H40/A6 re-review confirmation, threat model, data-class scanner rules. Mostly docs | Cloud |
| 2D Performance | `mo1309/phase2d-perf` | Characterize build and load at 1,000, 10,000 and 100,000 entries; fix the certified scale and budgets (section 12) | Cloud, then a Windows run |
| 3 Integration | `mo1309/phase3` | Merge streams, integrated suite, `mo1309-conformance-inventory.json`, binding B2 | Cloud |
| 4A / 4B / 4C | `mo1309/phase4a…` (`phase4a-e2e`, `phase4b-closure`, `phase4c-trust`) | One-shot Windows campaigns (section 17) | Local Windows |
| 4D Final | `mo1309/phase4d` | I3 and binding-only BF, read-only validator run, human tag review for `memoryos-1.3-mo1309` | Cloud authoring, Windows run |

```text
0B → 1 ─┬─ 2A ─┐
        ├─ 2B ─┼─ 3 ─┬─ 4A ─┐
        ├─ 2C ─┤     ├─ 4B ─┼─ 4D → human tag review
        └─ 2D ─┘     └─ 4C ─┘
PM (maint/pre-1.3-release) is independent of every phase above.
```

2A, 2B, 2C and 2D are genuinely parallel: they own disjoint files and depend
only on Phase 1's frozen view model. If Phase 1 cannot freeze the view model,
the dependent streams wait. PM is independent of everything and does not gate
or follow any MO-1309 phase. MO-1308's shape is not carried over: there is no
store, so there is no concurrency, interruption or filesystem campaign.

One handoff file per phase, `docs/mo1309-phaseN-handoff.md` (phases 0A and 0B
use [the handoff](mo1309-handoff.md)), in the fixed template: it opens with
State, Last bound commit, Next action and Decisions needed, and ends with a
dated run log. Handoffs are structured, never unstructured appended logs.

Owner round-trips: three gates only — the M-decisions (done), Freeze approval
(the self-approval rule), and human tag review.

## 16. Requirement inventory

| ID | Requirement | Phase | Proven by |
|---|---|---|---|
| DB01 | The only input is a MO-1308 export directory; no other input source | 2B | 2B unit, 4A |
| DB02 | Each export file is read once into memory; `verifyHistoryExport` runs over those bytes; the view model is built only from them | 2B | 2B, 4C swap probe |
| DB03 | A verification failure emits nothing and returns `DASH_EXPORT_INVALID` carrying the MO-1308 code | 2B | 2B, 4C tamper corpus |
| DB04 | Retained member contents are never parsed, embedded or rendered | 1, 2B | 1 shape, 4C scan |
| DB05 | The snapshot is one self-contained HTML file with no external reference | 2A, 2B | 2B, 4B scan |
| DB06 | The CSP meta is `default-src 'none'` with hash-pinned script and style; no `unsafe-inline`/`unsafe-eval` | 2A, 2B | 2A, 4C browser |
| DB07 | The page issues zero requests and uses none of the forbidden network, storage and navigation APIs | 2A | 2A, 4C browser with network blocked |
| DB08 | Untrusted strings are written only as text; forbidden DOM sinks are absent | 2A | 2A source scan, 4C injection corpus |
| DB09 | Embedded data is escaped so no value can close the data block or the document | 2B | 2B, 4C injection corpus |
| DB10 | The view model is closed and rejects unknown, missing or mistyped members | 1 | 1 |
| DB11 | Enums and limits are imported from the MO-1308 contract and never redefined | 1 | 1 source scan and equality test |
| DB12 | Page filtering equals MO-1308 `query` for record kind, subject and retention | 2A | 2A differential test |
| DB13 | The page is strictly read-only: closed action set, no write, approve, reject, append or tombstone control, no storage | 2A | 2A, 4C |
| DB14 | Every chrome string is a registry key; the forbidden-affordance scan passes on every fixture | 1, 2A | 1, 2A, 4C |
| DB15 | The page states integrity-only verification, not authenticated/encrypted/signed, shows the full `headDigest` with anchoring guidance, and states the as-of-generation scope | 2A | 2A, 4C |
| DB16 | Anomaly counts (purge pending, unreferenced records, pending artifacts) are disclosed | 2A | 2A |
| DB17 | `CONTRARY_TO_READINESS` is a neutral observation without success or failure styling | 1, 2A | 1, 2A |
| DB18 | Same export and version give a byte-identical snapshot, across runs and enumeration orders | 2B | 2B, 4A |
| DB19 | The output contains no clock, locale, random value, path, host or user | 2B | 2B, 2C scanner, 4C |
| DB20 | Output creation is exclusive, never overwrites, and a failed exclusive create is a typed, unretried IO failure | 2B | 2B, 4A |
| DB21 | Imported limits are enforced; over-limit input is `DASH_LIMIT_EXCEEDED` | 2B | 2B |
| DB22 | The certified scale (1,000 or 10,000) is measured; 100,000 is characterized with no claim | 2D | 2D, 4A |
| DB23 | Accessibility: keyboard, names, contrast, no colour-only meaning, 200% zoom | 2A | 2A, 4A |
| DB24 | No horizontal page scroll at 320 px; layouts at 320, 768, 1280 | 2A | 2A, 4A |
| DB25 | Identical behaviour from `file://` and a static HTTP host | 2A | 2A, 4A |
| DB26 | Dashboard modules import no SDK, Core, readiness, CI, network or filesystem module; MO-1308 files unchanged | 1, 3 | 1, 3, 4B |
| DB27 | Released packages, closures and inventories unchanged; no new dependency; no build step | 3 | 4B |
| DB28 | The H40/A6 re-review is recorded and the store claim stays local single-user v1 | 2C | 2C, 4C wording |
| DB29 | Certification runs on Windows 11 x64, Node 24.21.0 and a Chromium-family browser | 4A | 4A, 4D |
| DB30 | Any rerun inside a retained regression is its own suite row with its own log binding; the validator recomputes log digests and checks each row's commit | 3, 4D | 4D validator |
| DB31 | ARCHITECTURE §5/§13 carry the narrow clause (section 20) and no other ARCHITECTURE change | 1 | 1 |
| DB32 | Export-performance work, if done, is separate maintenance with a byte-identical-output proof and is not part of MO-1309 | — | Section 18 |

## 17. Certification plan

Certifying campaigns are one-shot: generations are append-only, failed
generations are preserved and never promoted. Failures are classified as in
MO-1308 Phase 3 protocol section 6 and handled under section 14.

| Campaign | Scope | Cases (families) | Requirements |
|---|---|---|---|
| **4A** End to end | Real MO-1308 exports on Windows 11 x64, Node 24.21.0, a Chromium-family browser | 4A-E1 an export from the MO-1308 CLI with every record kind; 4A-E2 an export with tombstones and a purge; 4A-E3 empty and single-entry exports; 4A-E4 the certified-scale export; 4A-E5 generation twice and byte comparison; 4A-E6 `file://` and a static HTTP host; 4A-E7 keyboard, zoom and 320/768/1280 layouts; 4A-E8 the 100,000-entry characterization (no claim); 4A-E9 exclusive output and failure paths | DB01, 03, 18, 20, 22–25, 29 |
| **4B** Closure and supply | Audit; no package is produced | 4B-C1 released closures, inventories and MO-1308 bytes unchanged; 4B-C2 no new dependency, no build step, no network module; 4B-C3 the snapshot has no external reference; 4B-C4 source closure is reproducible | DB05, 26, 27 |
| **4C** Security and trust wording | Hostile inputs and wording | 4C-S1 injection corpus (markup, script, style, URL, `</script>`, U+2028/2029, very long and control-character strings) in subjects, reasons, authority references and identifiers; 4C-S2 CSP enforced in the browser, network blocked, zero requests; 4C-S3 tamper corpus (chain, member, manifest, marker, truncated tail with and without the anchor guidance); 4C-S4 forbidden-affordance scan of the rendered DOM and adversarial words in data; 4C-S5 swap-after-read probe; 4C-S6 data-class scan of the output | DB02–04, 06–09, 13–15, 17, 19, 28 |
| **4D** Final | `cca-conformance` | 4D-D1 candidate identity and no later production bytes; 4D-D2 each stream has exactly one accepted certifying generation, earlier ones preserved with dispositions; 4D-D3 every requirement has a passing case; 4D-D4 a retained regression record (below); 4D-D5 the 4C trust record; 4D-D6 release disclosures state every recorded outcome and qualification; 4D-D7 I3 in HEAD and, after the binding-only BF, the binding; no tag is created | all |

**4D-D4 follow-up (OWNER M13).** The regression record has one suite row per
suite run, and any rerun inside a retained regression is **its own row** with
its own log binding. The validator recomputes every log digest from the bound
log and checks each row's commit (HEAD or an ancestor of it) rather than
accepting a record-level commit. The MO-1308 validator and its accepted
[deviation disposition](mo1308-3d-d4-deviation-disposition.md) are not edited;
the MO-1309 validator is built to this rule.

The final validator is read-only, executes no product or test, and ends in
`NOT_READY`, `I3_VALID_PENDING_BF` or `CERTIFIED_READY_TO_TAG`. A tag is a
human decision after review (section 19).

## 18. Maintenance item and export performance (OWNER M7, M8)

**PM** (`maint/pre-1.3-release`) is one parallel item: items 1 to 5 of the
carry-over table, test and CI only, no product semantics, with the three
differential-gate items first: MCP side effects, the v1.2.1 pin, and
tag-absence and path tests. It is independent of every MO-1309 phase and does
not gate MO-1309 certification; it is a precondition of the `v1.3.0` release
step (section 19). The five items are enumerated in the first commit of the PM
branch under this scope. A change of scope, or a product-behaviour change,
returns to owner review.

**Export performance** (the 100,000-entry export duration, Q11) is a *separate*
maintenance item, not part of PM items 1–5 and not part of MO-1309. It would
change released MO-1308 product bytes, so it needs its own authorization and a
byte-identical-output proof against the released exporter. MO-1309 neither
depends on it nor includes it (DB32).

## 19. Release closure (OWNER M11)

The annotated tag `memoryos-1.3-mo1309` closes the milestone after the 4D
validator reports `CERTIFIED_READY_TO_TAG` and a human tag review. `v1.3.0` is a
**separate release step** after MO-1309 and PM; RELEASE_NOTES and KNOWN_ISSUES
are written there. UI composition is outside the Standard (authority P8), so
CCA-MEMORYOS-1.1 is out of scope.

## 20. ARCHITECTURE §13 / §5 text to apply in Phase 1 (OWNER M12)

Proposed here; applied in the Phase 1 commit, not in this document.

1. ARCHITECTURE §5, under `cca-studio`, after the MO-1308 paragraph: "MO-1309
   adds a downstream presentation of MO-1308 history exports inside the same
   JavaScript boundary: a pure view model, a wording registry, a static
   dependency-free snapshot generator and a read-only page. It reads a verified
   export once, performs no network access, writes only an operator-named
   output file, owns no state, and never re-derives record semantics or appends,
   tombstones or approves anything."
2. ARCHITECTURE §13, appended after the MO-1308 paragraph: "MO-1309 is a narrow
   downstream-presentation clause for a generated static page that presents a
   verified MO-1308 export. It is not an exception for hosting: it does not
   authorize a server, hosting, accounts, tenancy, billing, a network service, a
   database or any write path to a ledger. An operator who hosts the generated
   file does so outside MemoryOS."

Rejected: a full exception (decision M12, option B/C); editing ARCHITECTURE in
this documentation-only Freeze.

## 21. Decision register disposition

Every register entry of the [authority](mo1309-cloud-dashboard.md) is resolved
and carried here: M1 and M2 sections 2 and 6; M3 section 5; M4 sections 2, 7 and
8; M5 section 10; M6 sections 5 and 9; M7 sections 12 and 18; M8 sections 15 and
18; M9 section 14; M10 sections 15 and 17; M11 section 19; M12 section 20; M13
section 17; M14 section 7; M15 section 24; P1–P8 sections 2, 4, 9, 10 and 12;
C1–C4 sections 1, 14 and 15. None is OPEN.

## 22. Testing strategy

Pure units and the generator are tested with `node --test`, with fixtures
generated from real small exports produced by the released MO-1308 CLI and
checked in as bytes. Browser tests use a harness that drives a Chromium-family
browser over the DevTools protocol using only Node built-ins; no
browser-automation package is added to any manifest, lockfile or closure. In
cloud sessions the preinstalled Chromium is the browser. Differential tests
compare page filtering with MO-1308 `query`. Scanners run on source, on the
generated snapshot and on the rendered DOM.

## 23. Contradiction audit

| Finding | Classification | Disposition |
|---|---|---|
| M7 names export performance as separate maintenance while M8 limits the one parallel PM item to test and CI | TENSION | Resolved: two different items. PM is test/CI only; export performance is a separate, later, product-touching item with its own authority and a byte-identical proof (section 18) |
| ARCHITECTURE §13 excludes databases, networking and general persistence | CONSISTENT | The dashboard needs none; the narrow clause (section 20) is applied in Phase 1 |
| "Cloud" in the title versus no cloud component | TERMINOLOGY TENSION | Defined in the authority section 1.2; the page and release wording state it |
| MO-1308 H40 re-review requirement for MO-1309 | CONSISTENT | Section 10: the claim is unchanged |
| Report: "inline CSP-safe with no build step" versus `'self'` CSP in the served Studio | CONSISTENT | Studio serves separate files with a header; a hosting-neutral single file uses hash-pinned inline script and style, with the same prohibitions (section 5) |
| Browser tests need a browser driver but no dependency may be added | CONSISTENT | A Node-built-in DevTools-protocol harness (section 22) |
| MO-1308 validator accepts a record-level regression commit | CONSISTENT WITH M13 | Not edited; the MO-1309 validator is built to the follow-up rule (section 17) |
| Authority audit did not list the M7/M8 tension | INFORMATIONAL | Added to the authority audit in the same commit |

No contradiction remains. Released documents, inventories, evidence, packages
and tags are unchanged.

## 24. Validation, approval and exact next tasks

Validation for this commit: `git diff --check`; every relative link in the
changed documents resolves to a tracked path; the changed-path set is exactly
the Freeze, the handoff, the authority document and ROADMAP.md; a scripted check that the
authority register has no OPEN entry and this Freeze marks none as awaiting a
decision.

**Self-approval record (2026-10-10).** The decision register has zero OPEN
items and the contradiction audits find no unresolved contradiction. Under the
owner's self-approval rule this Freeze is marked FROZEN, `main` is
fast-forwarded to this document's commit after an ancestry check, and the
handoff is updated. The owner's rule overrides the report's own "approval
before fast-forward" step.

The exact next tasks, in parallel where stated:

1. **MEMORYOS 1.3 MO-1309 PHASE 1 — CONTRACT AND VIEW MODEL** on
   `mo1309/phase1`, from this Freeze commit.
2. **MEMORYOS 1.3 PRE-RELEASE MAINTENANCE** on `maint/pre-1.3-release`
   (independent; section 18).
