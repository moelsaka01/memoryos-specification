# MemoryOS 1.3.1 — Studio History Screen: Authority and Contract Freeze 1

Status: **FROZEN — CONTRACT FREEZE 1** (owner-decided scope; self-approval rule
applied, section 18). Authority and Freeze are one document by owner decision.

This is the authority and the freeze for the patch release **MemoryOS 1.3.1**
(working name MO-1310). It follows the shape of the
[MO-1309 Contract Freeze 1](mo1309-contract-freeze-1.md), whose standing
pre-authorizations it copies (section 12), and it relies on the
[MO-1308 Contract Freeze 1](mo1308-contract-freeze-1.md) for H06 (the SDK does
no file I/O; the CLI owns the file store) and H40 (the store is Node-only).
After this Freeze, implementation may resolve private details only; any change
to public behaviour, shapes, identities, errors, limits or the accepted risk
returns to owner review (CCA-ENG-2.0).

It is documentation only: no production code, test, fixture, evidence, tag or
pull request, and no change to `moelsaka01/cca-specifications`.

## 1. Baseline (2026-10-13)

| Check | Result |
|---|---|
| Release | tag `v1.3.0` (object `e51ab07836761da2e105f165a9f0144b1c8b591a`) peels to `889f99e72a5d41c242572cc052ab97b07cc10a24` |
| `main` at start | `0e229ba06aa624ff1a623a16aa101e94268e3a72` (`889f99e7` plus one release-description document, `docs/release/v1.3.0-github-release.md`) |
| MO-1308 | tag `memoryos-1.3-mo1308` → BF `bf2fdc87e9b2bfc25588ef61deacac6c04684376` |
| MO-1309 | tag `memoryos-1.3-mo1309` → BF `97d84a1e84d8896d7d883810287c0fb063d6c376` |
| Studio at baseline | `npm test` in `repositories/cca-studio` passes 358/358 (Node v22.22.0, cloud) |

## 2. Scope (owner-decided, final)

**In scope.**

1. Studio's real home screen gains a **History** entry.
2. The History screen lets the user open a MemoryOS history **export** folder
   through the browser's *user-initiated* folder access: the File System Access
   API (`showDirectoryPicker`, read mode; Edge and Chrome), or a read-only
   directory `<input>` fallback.
3. Studio reads the files **once** into memory, verifies them with the MO-1308
   `verifyHistoryExport`, builds the MO-1309 view model, and renders the
   dashboard **inside Studio**, reusing the MO-1309 page modules.
4. Optional, in only because it is trivial (section 7): a **Save dashboard
   snapshot** button that produces the same single-file snapshot the MO-1309
   generator emits, byte for byte.

**Out of scope.** Any append, tombstone, purge, repair, import, merge or other
write UI (the store stays CLI-only, MO-1308 H06/H40); opening, creating,
watching or remembering a ledger *store*; remembering a folder or a file handle
between sessions; drag-and-drop, a typed path or URL, or any automatic open; a
server, hosting, accounts, tenancy, billing, authentication; any network access
beyond section 8; a framework, a build step or any new dependency; changes to
MO-1308 production bytes; changes to the output of the MO-1309 generator;
any C or C++ change; a SDK or CLI surface; retained member contents (they are
never parsed, embedded or rendered, MO-1309 section 9.3); the CCA-MEMORYOS-1.1
Standard.

## 3. Terms

- **Export:** a `MemoryOSHistoryExport` directory exactly as MO-1308 section 12
  defines it.
- **History screen:** the Studio route `#history` (section 5).
- **Dashboard:** the MO-1309 page, driven by the MO-1309 view model.
- **Snapshot:** the one HTML file the MO-1309 generator emits.
- **Studio History registry:** the closed wording table of the History screen's
  own chrome (section 9).
- **Untrusted data:** every string and number that originates in an export,
  and the names of the files the user picked.

## 4. The ARCHITECTURE §5/§13 clause (text to apply)

Applied in the build commit of branch `release-1.3.1/build`, not in this
document. No other ARCHITECTURE change is made (SH22).

1. ARCHITECTURE §5, under `cca-studio`, after the MO-1309 paragraph:

   > MemoryOS 1.3.1 lets Studio present a MO-1308 history export inside the
   > same JavaScript boundary. The user opens an export folder through the
   > browser's user-initiated folder access; Studio reads its files once into
   > memory, verifies them with the MO-1308 verifier, and renders the MO-1309
   > dashboard modules. It is read-only, makes no request other than for
   > Studio's own static files, stores nothing, and never appends, tombstones,
   > approves or re-derives anything.

2. ARCHITECTURE §13, appended after the MO-1309 paragraph:

   > MemoryOS 1.3.1 extends the MO-1309 clause only to a user-initiated,
   > read-only read, by Studio, of an export folder the user selects. It does
   > not authorize Studio to open, create, write, watch or remember a ledger
   > store, a server, hosting, accounts, tenancy, billing, a network service, a
   > database or any write path to a ledger. The store stays CLI-only (MO-1308
   > H06, H40).

Rejected: a full exception for Studio persistence; editing ARCHITECTURE in this
documentation-only Freeze.

## 5. Placement and dependency direction (FROZEN)

All new code is dependency-free ES modules and static files under
`repositories/cca-studio/`. The Studio shell (`web/js/app.js`) gains one route
and one nav entry; it does not otherwise change.

| Unit | Responsibility |
|---|---|
| `web/js/memoryos-dashboard-export-bounds.js` (new, browser-safe) | The export layout path classes and byte bounds that the MO-1309 generator already used privately (`boundFor`, entry/record path patterns, marker and manifest bounds), extracted so the generator and Studio import **one** definition (SH03, SH09) |
| `web/js/studio-history-reader.js` (new, pure) | Takes a list of `{ path, size, read() }` items from a picker, checks path classes, bounds and the imported entry limit, reads each item **once**, returns `{ files: [{ path, bytes }] }` or throws a `DashboardError` |
| `web/js/studio-history-wording.js` (new, pure) | The Studio History registry, its closed action set and its scan helpers (reusing `forbiddenTerms` from the MO-1309 wording unit) |
| `web/js/studio-history-screen.js` (new, DOM) | The History screen: folder access, reading, verification, error display, dashboard mounting, optional snapshot save |
| `web/history-view.html` (new) | A static, same-origin host page for the dashboard, shown in an `<iframe>` of the History screen |
| `web/dashboard/page.embedded.js` (new, **derived**) | `web/dashboard/page.js` with the single wording mark replaced by the registry JSON, exactly as `assembleSnapshot` does (section 6) |
| `scripts/derive-studio-history-page.mjs` (new) | Writes or checks `page.embedded.js` (`--check` exits non-zero when it differs) |
| `scripts/memoryos-dashboard-generator.mjs` (refactor only) | Imports the bounds from the new module instead of defining them; **output byte-identical** (SH09) |
| `scripts/serve.mjs` | The one Studio response header `frame-ancestors` is `'self'` for `/history-view.html` only; every other response is unchanged (section 8) |

Dependency direction:

```text
memoryos-history-contract.js / -ledger.js (MO-1308, unchanged)
   -> memoryos-dashboard-* (MO-1309, unchanged except the bounds extraction)
   -> studio-history-reader.js (pure)  -> studio-history-screen.js (DOM) -> app.js (route)
   -> web/history-view.html + web/dashboard/page.js behaviour (the unmodified MO-1309 page)
```

The History modules import no SDK, Core, readiness, CI, filesystem or network
module. The MO-1309 dashboard modules, `web/dashboard/page.js`, `page.css`,
`page.html` and the MO-1308 modules are **not modified** (the only MO-1309 byte
change is the bounds extraction in the generator script, section 6).

## 6. Reuse of the MO-1309 page (FROZEN)

The MO-1309 `page.js` is a classic script that reads its data from the
document's `memoryos-dashboard-data` block and has the wording registry spliced
in at one mark. Its bytes are part of every snapshot, so it cannot be edited.
Studio runs its **unmodified behaviour** as follows:

1. `page.embedded.js` is `page.js` with the mark `null; /*@@WORDING@@*/`
   replaced by `<registry JSON>;`, using the same escaping as `assembleSnapshot`
   (`escapeJsonForHtml(JSON.stringify(WORDING))`). It is committed so that
   Studio's `script-src 'self'` policy can load it (no inline script, no
   `eval`). A test recomputes it from `page.js` and the registry and requires
   byte equality; a second test requires `page.js`, `page.css`, `page.html`
   and the dashboard modules to equal their v1.3.0 blobs (SH08).
2. `history-view.html` is a static page with `<div id="app">`, an empty
   `<script type="application/json" id="memoryos-dashboard-data">`, a stylesheet
   link to `dashboard/page.css` and **no** script. It carries its own policy
   `<meta http-equiv="Content-Security-Policy">`:
   `default-src 'none'; script-src 'self'; style-src 'self'; base-uri 'none';
   form-action 'none'`.
3. After verification, the History screen creates the `<iframe>` (no `sandbox`
   token is added: the frame is same-origin, trusted Studio code), waits for
   its load, writes the canonical view-model JSON into the data block with
   `textContent`, then appends a `<script src="dashboard/page.embedded.js">`
   element. The page therefore renders exactly as in a snapshot, from the same
   code and the same registry. Untrusted data is only ever written with
   `textContent`.

Rejected: rendering the dashboard markup directly into Studio's DOM (global
selectors in `page.css` would collide with Studio's styles and `page.js` owns
`document.body`); a `srcdoc` iframe (it inherits Studio's policy, which forbids
inline script and style); editing `page.js` (it would change every snapshot).

## 7. Behaviour (FROZEN)

1. **Entry.** The Studio sidebar gains a nav item **History** (route
   `#history`) under its own heading. It is a normal Studio nav item; on the
   History route Studio hides the Mission Control banner, query bar and
   inspector and shows the History screen. All other routes behave as at
   v1.3.0. Leaving the route discards the export (item 7).
2. **Opening.** One button, *Choose export folder*. If
   `window.showDirectoryPicker` exists, the click calls it with
   `{ mode: "read" }` (a user gesture is present); the folder is walked through
   its directory handle. Otherwise (or on the second button, *Choose export
   folder (compatibility)*), a visually available `<input type="file"
   webkitdirectory>` receives the folder; its `webkitRelativePath` supplies the
   paths after the first segment. Neither route writes anything. A cancelled or
   denied picker (`AbortError`, `NotAllowedError`) is a neutral message and no
   state change.
3. **Read once.** The reader lists every file, requires each relative path to
   belong to a class the export layout defines (`bounds.boundFor` ≠ null) and
   each size to be within its bound and the imported entry limit, then reads each
   file **exactly once** into memory, checks the byte count it read equals the
   size it was offered, and never touches the folder again. An unknown path
   (including `.DS_Store`, `Thumbs.db`, any extra file) or an oversize file
   is `DASH_EXPORT_UNREADABLE`; more entry files than the imported limit is
   `DASH_LIMIT_EXCEEDED`. These are the generator's codes and bounds.
   Symbolic links cannot be distinguished by the browser; they are unnecessary
   to refuse, because the bytes read are verified end to end by the next step.
4. **Verify, then build.** `buildDashboardViewModel({ files })` runs the MO-1308
   `verifyHistoryExport` over those in-memory bytes, then builds the view
   model from them only. On any defect nothing is rendered, the previous
   dashboard (if any) is removed, and the screen shows the typed error:
   `DASH_EXPORT_INVALID` **carrying the MO-1308 code** (for example
   `MO1308_CHAIN_BROKEN`), `DASH_EXPORT_UNREADABLE`, `DASH_LIMIT_EXCEEDED`, with
   a registry sentence. Codes are contract constants and are the only
   non-registry, non-export strings the screen shows besides export-derived
   data cells.
5. **Render.** On success the dashboard is mounted as in section 6. The
   dashboard carries every MO-1309 disclosure (integrity only, not
   authenticated, anchoring, as-of scope, anomaly counts) because it is the
   MO-1309 page. The History screen adds its own sentence that the export was
   read once from the folder the user chose, that Studio did not keep the
   folder, and that nothing was written.
6. **Optional: Save dashboard snapshot.** Enabled only while a verified
   dashboard is shown. It fetches `dashboard/page.html`, `page.css`, `page.js`
   (Studio's own static files, on click only), calls `assembleSnapshot({
   viewModel, sources })` with the default generator version, and offers the
   bytes as a download (`Blob` plus an anchor with a `download` attribute). The
   bytes equal those the generator writes for the same export (SH15). This is a
   download chosen by the user of a document already on screen; it is not a
   ledger write. If any part cannot be done simply, the button is dropped by a
   documentation-only correction, with no other change.
7. **Memory and state.** The view model, file bytes and the iframe are dropped
   on *Clear*, on a new selection and when the route changes. Nothing is stored
   (no cookie, `localStorage`, `sessionStorage`, IndexedDB, Cache API,
   service worker) and no handle is kept after the read.

## 8. Security and privacy (FROZEN)

1. **No network, with the Studio static-file clarification.** Studio is itself
   served by a static host (`scripts/serve.mjs`). History adds **no endpoint,
   no upload and no request that carries export data or the folder's names**.
   The only requests History causes are `GET`s of Studio's own static files
   from the Studio origin: `history-view.html`, `dashboard/page.css`,
   `dashboard/page.embedded.js`, and, on *Save dashboard snapshot* only,
   `dashboard/page.html`, `page.css`, `page.js`. A browser test asserts the
   exact set of request URLs from "route open" to "dashboard rendered" and
   after, with all other origins and all other paths absent. The new modules
   use none of `XMLHttpRequest`, `WebSocket`, `EventSource`, `sendBeacon`,
   `import()`, `eval`, `Function`, `innerHTML`, `outerHTML`,
   `insertAdjacentHTML`, `document.write`, `window.open`, `localStorage`,
   `sessionStorage`, `indexedDB`, `caches` or `navigator.serviceWorker`; the one
   permitted `fetch` is the same-origin source load in item 6 of section 7.
2. **Policy.** The Studio response policy is unchanged
   (`default-src 'self'; img-src 'self' data:; style-src 'self'; script-src
   'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'`) except
   that `/history-view.html` is sent with `frame-ancestors 'self'` so that Studio
   can frame it, and that document additionally carries the stricter meta policy
   of section 6. No `unsafe-inline`, `unsafe-eval`, `data:` script or `blob:`
   script source is added. The snapshot download uses a `blob:` *anchor target*,
   which is not a script or fetch source.
3. **Untrusted data.** As MO-1309 section 9.1: export strings enter the DOM
   only through `textContent`; names of picked files are never displayed.
4. **Read once, then verify.** Section 7 items 3 and 4; a swap of the folder
   after the read cannot change what is displayed (SH06).
5. **H40/A6 re-review (as MO-1309 section 10).** The History screen creates or
   uses no ledger store; it reads an export, which MO-1308 produced and
   `verifyHistoryExport` checks. The store claim stays *local single-user v1 on
   native Windows 11 x64*. The screen widens only who can *read an already
   produced export on a machine*, the user's own, in a browser; it discloses
   (through the MO-1309 page) that the history is not authenticated, not signed
   and not encrypted and that tail truncation and rollback are detectable only
   against an externally recorded `headDigest`. No new trust claim is made.
6. **Browser reality.** `showDirectoryPicker` is available in Chromium-family
   browsers in a secure context (`http://127.0.0.1` qualifies) and not in
   Firefox or Safari, where the compatibility input is the route. The browser
   mediates the permission and the dialog; Studio cannot read any folder the
   user did not choose.

## 9. Wording (FROZEN)

The MO-1309 wording rules apply to every string the History screen itself shows
(nav label, headings, button text, tooltips, status and error text, accessible
names, document title). They are a closed table `key → string` in
`studio-history-wording.js` (the MO-1309 registry is not extended: that would
change every snapshot). The same forbidden set as MO-1309 section 7.5
(`forbiddenTerms`) applies, with a closed allow-list of *negating* entries
reviewed here and in the test. No control, label, icon or colour signals
approval, readiness, success, safety, trust, certification or a pass. The
History screen's closed action set is `open-folder`, `open-folder-compat`,
`save-snapshot`, `clear`; every control carries one `data-action` from that set
and none is a link, a form or a navigation (SH10). A test scans the rendered
History screen and the registry, and renders an adversarial export whose data
contains the forbidden words, proving they appear only as inert text inside the
dashboard's data cells.

## 10. Determinism (FROZEN)

The same export bytes produce the same view model, the same embedded data
block and the same rendered dashboard text regardless of the order in which the
browser lists the files (the reader sorts bytewise before reading) and of the
route used (directory handle or input). The saved snapshot is byte-identical to
the generator's. The History screen reads no clock or random value into any
output.

## 11. Errors (FROZEN)

The History screen reuses the MO-1309 codes and their meanings, defined for the
generator in MO-1309 section 13: `DASH_EXPORT_UNREADABLE`, `DASH_EXPORT_INVALID`
(carrying the MO-1308 code), `DASH_LIMIT_EXCEEDED`. `DASH_USAGE`,
`DASH_OUTPUT_EXISTS` and `DASH_IO_FAILURE` have no meaning in the screen
(`DASH_IO_FAILURE` is used for a snapshot save that cannot be offered). No new
code is added and no MO-1308 or MO-1309 error shape changes.

## 12. Standing pre-authorizations (copied from the MO-1309 Freeze section 14)

Standing authority for tooling and reviewers for every MemoryOS 1.3.1 phase,
unless the owner revokes or amends it.

1. **Harness or environment fixes** are allowed inside this envelope: they
   change only test, harness, fixture-generation or tooling files, never
   product bytes, a contract, a limit, a claim or an evidence record. Each one
   needs a **negative control** proving the loosened assertion still fails on a
   real violation, and each is **logged afterwards** in the handoff run log.
2. **New generations after non-product failures.** A failure classified
   `HARNESS_DEFECT`, `ENVIRONMENT_BLOCKER` or `INTERRUPTION` gets a new
   generation without owner review, **capped at two extra generations**. A
   `CONTRACT_DEFECT`, a `PRODUCT_DEFECT` with a public-behaviour change and an
   `ESCALATED_PRESERVED` generation still need the owner.
3. **Fast-forwards of `main`** are allowed at named boundaries: Freeze approval
   and the build/integration binding B. Fast-forward only, after an ancestry
   check, never forced. **Tags stay human; no tag is created in this work.**
4. **Documentation-only corrections** to ROADMAP, CHANGELOG and handoff files
   need no approval.

**Not pre-authorized:** tags; pushes of tags; limit or scope changes; new
dependencies; anything that weakens a product guarantee.

**Stop conditions (this release):** a contract defect or contradiction; a
public-behaviour change to MO-1308; any C or C++ change; a new dependency; an
MO-1309 change that alters generator output; both extra generations exhausted.

## 13. Phase plan, branches and boundaries

| Step | Branch | Content | Boundary |
|---|---|---|---|
| 1 Authority + Freeze | `release-1.3.1/freeze` | This document and `docs/release-1.3.1-handoff.md` (docs only) | `main` fast-forwarded on self-approval (section 18) |
| 2 Build | `release-1.3.1/build` (from the Freeze commit) | ARCHITECTURE clause, Studio entry and History screen, tests | — |
| 3 Integration + binding B | `release-1.3.1/build` | Integrated suite, conformance inventory, retained regression record, prepared one-shot campaign (rehearsed, non-certifying) | Binding B: `main` fast-forwarded to B |
| Later, on Windows | per the certification plan (section 15) | The one campaign, retained regression, differential gate, validator, I3, binding-only BF | Human tag review, then tag `v1.3.1` |

One handoff file, [release-1.3.1-handoff.md](release-1.3.1-handoff.md), in the
fixed template: it opens with State, Last bound commit, Next action and
Decisions needed, and ends with a dated run log.

## 14. Requirement inventory

| ID | Requirement | Phase | Proven by |
|---|---|---|---|
| SH01 | Studio's home gains a History nav entry that opens the History screen; every other route and the 358 existing Studio tests are unchanged | 2 | Unit, browser, existing suite |
| SH02 | The only input is a folder the user chooses through `showDirectoryPicker` (read mode) or the directory `<input>`; no drag-and-drop, path, URL, remembered handle or automatic open | 2 | Unit, browser, source scan |
| SH03 | Path classes, byte bounds and the entry limit come from one shared module, imported by Studio and the generator; unknown paths, oversize files and over-limit exports are refused with the generator's codes | 2 | Unit, differential |
| SH04 | Verification is `verifyHistoryExport` over the in-memory bytes; on any defect nothing is rendered and the typed error carrying the MO-1308 code is shown | 2 | Unit, browser |
| SH05 | Tampered exports (chain, member, manifest, marker, truncated tail) are rejected inside Studio with the carried MO-1308 code | 2 | Browser, campaign |
| SH06 | Each file is read exactly once and the view model is built only from those bytes; a swap after the read changes nothing | 2 | Unit, campaign |
| SH07 | The dashboard renders inside Studio by running the unmodified MO-1309 `page.js` behaviour, `page.css` and registry over the MO-1309 view model | 2 | Browser, campaign |
| SH08 | `page.embedded.js` equals `page.js` with the registry spliced in; `page.js`, `page.css`, `page.html`, the dashboard modules and the MO-1308 modules equal their v1.3.0 blobs | 2 | Derivation test, closure audit |
| SH09 | The standalone generator's output is byte-identical to v1.3.0 on every fixture and corpus | 2 | Differential, golden digests, campaign |
| SH10 | The History screen is strictly read-only: closed action set, no write, append, tombstone, approve or reject control, no storage API, no kept handle | 2 | Unit, browser, source scan |
| SH11 | No request leaves the Studio origin and none carries export data; the request set is the closed allow-list of section 8; the CSP posture of section 8 holds in Chromium | 2 | Browser, campaign |
| SH12 | Every History chrome string is a registry key; the forbidden-affordance scan passes on the registry and the rendered screen; adversarial words in data are inert | 2 | Unit, browser, campaign |
| SH13 | Untrusted strings enter the DOM only as text; hostile strings in subjects and identifiers execute nothing and cause no request | 2 | Browser, campaign |
| SH14 | Same export bytes give the same view model and dashboard text for any file order and for either input route | 2 | Unit, browser |
| SH15 | *Save dashboard snapshot* downloads bytes equal to the generator's snapshot for the same export | 2 | Browser, campaign |
| SH16 | A cancelled or denied picker and a missing `showDirectoryPicker` are neutral and change no state | 2 | Unit, browser |
| SH17 | Clear, a new selection and leaving the route drop the data, the frame and any error | 2 | Browser |
| SH18 | The History screen is keyboard-operable with names from the registry and has no horizontal page scroll at 320, 768 and 1280 px | 2 | Browser, campaign |
| SH19 | No C or C++ file, CMake file or vcpkg manifest changed against v1.3.0 | 2, 3 | Static check, campaign |
| SH20 | No MO-1308 production blob changed | 2, 3 | Closure audit, campaign |
| SH21 | No new dependency, lockfile change or build step; released packages, closures and inventories unchanged | 2, 3 | Closure audit, campaign |
| SH22 | ARCHITECTURE §5/§13 carry the clause of section 4 and no other ARCHITECTURE change | 2 | Static check |
| SH23 | Every suite of the retained regression runs, each rerun as its own row with its own log binding | 3 | Regression record |
| SH24 | The conformance inventory maps every SH requirement to cloud tests or records and to the Windows campaign | 3 | Inventory check |

## 15. Certification plan (executed later on the reference Windows host)

Certifying runs are one-shot: generations are append-only, failed generations
are preserved and never promoted, and failures are classified as in
[MO-1308 Phase 3 protocol section 6](mo1308-phase3-protocol.md) and handled
under section 12. The prepared tooling is authored and rehearsed (non
certifying) in the cloud; a certifying run requires Windows 11 x64, Node
24.21.0, a clean checkout and a new output directory.

**Campaign SH (ONE combined one-shot campaign)** on the reference Windows host
(Edge), command in the handoff:

| Family | Cases | Requirements |
|---|---|---|
| End to end | SH-E1 home → History in Edge; SH-E2 open a **real CLI-produced export** (every record kind, a tombstone and purge) through the directory input and see the verified dashboard; SH-E3 the same export through the `showDirectoryPicker` code path (handle interface); SH-E4 **tampered exports** (chain, member, manifest, marker, truncated tail) rejected with the carried MO-1308 code and nothing rendered; SH-E5 empty and single-entry exports; SH-E6 *Save dashboard snapshot* bytes equal the generator's; SH-E7 keyboard and 320/768/1280 layouts | SH01–SH07, SH14–SH18 |
| Security and wording | SH-S1 CSP and no network: the exact request allow-list, zero foreign requests, forbidden-API source scan; SH-S2 wording registry scan of the rendered screen and of an adversarial export, no approval affordance; SH-S3 injection corpus inert; SH-S4 read-once/swap probe; SH-S5 read-only (no storage, no write control, no kept handle) | SH02, SH06, SH10–SH13 |
| Closure | SH-C1 no C/C++/CMake/vcpkg change against v1.3.0 and no MO-1308 production blob changed; SH-C2 no new dependency or lockfile change, released bundles and inventories unchanged; SH-C3 generator differential against v1.3.0 (`889f99e7`) on every fixture and corpus; SH-C4 MO-1309 page bytes unchanged and the derived page current; SH-C5 the source closure extracted from HEAD equals the committed blobs | SH03, SH08, SH09, SH19–SH22 |

**Retained regression** (Node suites; every suite once, each rerun its own row
with its own log, as MO-1309 DB30): studio (existing and History), cli,
mo1308, mo1309, and the **MO-1307 strict** suite once (25 files, expected
639/639).

**Differential gate against v1.3.0 (`889f99e7`), Node subset.** The C++ CTest
run is **skipped only with recorded proof that no C or C++ file changed**: the
campaign's SH-C1 receipt (the static check of SH19 over `889f99e7..HEAD`) is the
proof, bound with the gate record. If that proof fails, the C++ CTest
differential is required.

**Then:** the validator (read-only), I3, and a binding-only BF; the validator
ends in `NOT_READY`, `I3_VALID_PENDING_BF` or `CERTIFIED_READY_TO_TAG`. The tag
`v1.3.1` is a human decision after review; no tool creates it.

## 16. Decision register

| ID | Decision | Disposition |
|---|---|---|
| S1 | Scope as section 2 | OWNER (final) |
| S2 | Open by browser folder access, read once, verify, MO-1309 view model, dashboard inside Studio | OWNER |
| S3 | Read-only; no network; no server; restrictive CSP; MO-1309 wording applies | OWNER |
| S4 | MO-1308 production bytes unchanged | OWNER |
| S5 | MO-1309 bytes refactored only with a byte-identical generator output differential | OWNER |
| S6 | No C or C++ change (so certification may skip the C++ CTest run) | OWNER |
| S7 | Save dashboard snapshot only if trivial | OWNER; resolved: included, section 7 item 6 |
| T1 | Dashboard hosted by a same-origin frame and a derived page file, not by editing `page.js` | FROZEN technical (section 6) |
| T2 | Studio History wording is its own registry; the MO-1309 registry is not extended | FROZEN technical (section 9) |
| T3 | "No network" means no endpoint, no upload and no request carrying export data; Studio's own static files are fetched | FROZEN clarification (section 8) |
| T4 | One serve.mjs header value changes for one path (`frame-ancestors 'self'`) | FROZEN technical (section 8) |

No entry is OPEN.

## 17. Contradiction audit

| Finding | Classification | Disposition |
|---|---|---|
| "no network; no server" versus Studio being served and fetching its own static files | TENSION | Resolved as T3: the claim is about export data, endpoints and uploads; Studio is a static application and always loads its own files. Not a contradiction of the owner scope |
| "reuse the MO-1309 page modules" versus "output of the generator unchanged" | TENSION | Resolved: `page.js` is not edited; a derived, tested file hosts the same behaviour (section 6) |
| ARCHITECTURE §13 excludes general persistence and networking | CONSISTENT | The clause (section 4) is narrow, read-only, user-initiated and stores nothing |
| MO-1308 H06 (no file I/O in the SDK) | CONSISTENT | Studio's browser read is not the SDK; the History modules import no SDK |
| MO-1308 H40/A6 re-review | CONSISTENT | Section 8 item 5: no store is created or used; the claim is unchanged |
| "a static check that no C/C++ file changed" versus the Studio package containing C++ sources | CONSISTENT | Only files named in section 14 SH19 are checked against v1.3.0; none is touched |
| The existing Studio `serve.mjs` sets `frame-ancestors 'none'` | CONSISTENT | One path is given `'self'` (T4); all others unchanged |
| `docs/release/v1.3.0-github-release.md` after the `v1.3.0` tag | INFORMATIONAL | A document only; the differential baseline is the tag's commit `889f99e7` |

No contradiction remains. Released documents, inventories, evidence, packages
and tags are unchanged.

## 18. Validation, approval and next steps

Validation for this commit: `git diff --check`; every relative link in the
changed documents resolves to a tracked path; the changed-path set is exactly
this document, the handoff and `ROADMAP.md`; a scripted check that section 16
has no OPEN entry.

**Self-approval record (2026-10-13).** The decision register has zero OPEN
items and the contradiction audit finds no unresolved contradiction. Under the
owner's self-approval rule this Freeze is marked FROZEN and `main` is
fast-forwarded to this document's commit after an ancestry check.

Next: step 2 (build) on `release-1.3.1/build`, created from the Freeze commit.
