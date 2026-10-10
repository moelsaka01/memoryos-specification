# MO-1309 Phase 2C — security and trust review

Stream `mo1309/phase2c-trust`, created from the bound Phase 1 commit `2da41aca`. This document confirms the
H40/A6 re-review of [Contract Freeze 1](mo1309-contract-freeze-1.md) section 10 against the code written in
Phases 2A and 2B, records the threat model, and defines the data classes and scanner rules. It changes no public
behaviour, shape, identity, error, limit or the accepted risk. It makes **no Windows claim**: the Windows
campaigns are 4A to 4C.

Evidence references name a branch and a commit: Phase 2A `mo1309/phase2a-ui` at `6956c650`; Phase 2B
`mo1309/phase2b-build` at `2d0b66fe`; Phase 2C is this branch. The stream branches are integrated in Phase 3, which
re-runs every cited test on the merged tree.

## 1. Scope and method

Questions answered: (1) does Freeze section 10 still hold for the code as built; (2) what can an attacker, an operator
error or a hosting choice do to the three artefacts (export directory, generator, snapshot) and to a person who relies on
the page; (3) which classes of data may appear in the output and how a scan proves it.

Method: read the Freeze, the MO-1308 H40 text (section 9.4), amendment A6 and the disclosed residual races (section 37.2);
read the 2A and 2B sources; derive each threat from a trust boundary; tie each mitigation to a test; list what is not
mitigated. No finding required a change to the Freeze: **no CONTRACT_DEFECT and no PRODUCT_DEFECT was found.**

## 2. H40 and A6 re-review (Freeze section 10, re-confirmed)

MO-1308 section 9.4 requires the Node-only store's risk acceptance to be re-reviewed before any multi-user,
shared-storage or cloud use, including MO-1309. The decision is re-confirmed as follows.

| Question | Confirmed finding | Evidence |
|---|---|---|
| Does MO-1309 create or use a ledger store? | No. No dashboard file imports a ledger creation, append, tombstone, export-build or store function. The only MO-1308 ledger functions imported are `verifyHistoryExport` and `queryHistoryLedger`; no dashboard file imports the CLI, the SDK, the store or the admission module. Handing the generator a ledger directory is refused (its `.pending`, `records` and `entries` layout has no export manifest and marker, so listing or verification fails) | 2C `memoryos_dashboard_trust_test.mjs` (H40 scan); 2B `memoryos_dashboard_generator_test.mjs` (source scan, unreadable and tamper cases) |
| Does the H40 gap (a directory swap is detected after the fact, not prevented) reach the dashboard? | Only as a swap of the export directory. The generator lists the tree with `lstat`, reads each regular file once through a descriptor whose `fstat` identity and size must match the listing, and requires end of file; verification then runs over those in-memory bytes and the view model is built only from them. A swap after the read cannot change the output (probe in 2B). A swap during the read can only yield a set of files that must itself verify against its own manifest and marker; a self-consistent forged export still verifies (T10) and is disclosed | 2B tests DB02, DB03, unreadable cases |
| Does A6 apply? | Yes, to the generator's output staging file. The exclusive create (`wx`) of the staging name is attempted once; any failure is a typed `DASH_IO_FAILURE`, never retried, and a foreign file at the staging name is left untouched. Publication is a non-replacing hard link; an existing or racing final name is `DASH_OUTPUT_EXISTS`. A6.2 (an unexplained `EPERM` on Windows staging creation) is inherited as a known limitation: the failure is typed, nothing is published, and nothing partial exists | 2B test DB20 |
| Does "cloud-ready" widen a store claim? | No. Hosting a generated file is not a store. It widens the readership of metadata that verification already covered; this is disclosed on the page and must be repeated in the release wording | registry `statement.metadataDisclosure`; trust test (registry makes no store, multi-user, tenancy or hosted-service claim) |
| Resulting claim | The MO-1308 store claim is unchanged: local single-user v1 on native Windows 11 x64. The dashboard adds only an integrity view of one verified export as of generation | this review; 4C wording check (DB28) |

Residual H40 behaviour that the dashboard inherits and does not remove: a swap of the **output directory** between the
generator's early existence check and its publication can redirect the staging file and the link to another directory
(the content written is the snapshot, which holds only metadata the operator chose to publish); a link planted at the
final name between the check and the link loses the race without replacing anything. A multi-user, shared-storage or
hosted-service claim needs a new milestone with its own authority and a full H40 revisit (decision M5, options B and C,
not selected).

## 3. Threat model

**Assets.** (a) Integrity of what the page tells a reader about an export; (b) confidentiality of operator environment
(paths, host and user names, clock); (c) confidentiality of retained member contents; (d) the operator's existing files
(output name); (e) the reader's browser session.

**Actors.** A hostile or careless export author (untrusted strings and layout); a local attacker able to race the export
or output directory; a hosting operator or network observer reading the hosted file; a person relying on the page for a
decision.

**Trust boundaries.** export directory → generator (untrusted input); generator → snapshot file (the only output); snapshot
→ browser (untrusted data inside a fixed page); hosted file → reader.

| ID | Threat | Mitigation | Requirement | Evidence | Residual |
|---|---|---|---|---|---|
| T01 | Script or markup injection through export strings (subjects, workspace identifier, any identifier) | Untrusted strings enter the DOM only through `textContent`; attributes are set only through one helper with a closed name list; no event-handler, address or style attribute; script and style are hash-pinned | DB08 | 2A page and browser tests (adversarial fixture, hostile synthetic model, source scan with negative controls) | None known |
| T02 | A value closes the data block or the document (`</script>`, `<!--`, U+2028, U+2029) | The embedded JSON escapes `<`, `>`, `&`, U+2028, U+2029; the generator refuses a script source containing `</script`; scanner rule D1 | DB09 | 2A, 2B assembler tests; rule D1 | None known |
| T03 | Style injection or CSS-based exfiltration | `style-src` is a hash; no `url(`, `@import` or style attribute; scanner R1 | DB06, DB08 | 2A CSP enforcement test (an injected style does not apply); source scan | None known |
| T04 | The page sends data out (request, beacon, socket, navigation, form) | `default-src 'none'`; none of the forbidden network, storage and navigation APIs exist in the source; zero requests after load, with the network blocked | DB07 | 2A zero-request and CSP tests; 4C-S2 on Windows | A browser defect is out of scope |
| T05 | The generator reaches the network | No network, process, clock or environment API in the generator or assembler; source scan | DB01 | 2B source-scan test | None known |
| T06 | Hostile export layout (symbolic link, junction, device, FIFO, undefined path, oversize file, entry-count flood) | `lstat` refusal of every non-regular entry; only paths the export layout defines; per-path size bound from imported limits; entry count checked before any read | DB21, DASH_EXPORT_UNREADABLE | 2B unreadable and limit tests | Windows reparse-point coverage is a 4C task |
| T07 | Export swapped during or after reading (H40) | Read once with identity and size check; verify the in-memory bytes; build only from them | DB02 | 2B read-once and swap probe | A swap during the read can supply a different export that verifies on its own (T10) |
| T08 | Tampered export (chain, descriptor, member, manifest, marker, extra or missing file) | `verifyHistoryExport` is the sole authority; failure emits nothing and carries the MO-1308 code | DB03 | 2B tamper corpus; 4C-S3 | Integrity only |
| T09 | Tail truncation or rollback to an older valid prefix | Not detectable from the export alone; the page states this, shows the full head digest, copyable, and tells the reader to record it elsewhere | DB15 | registry `statement.anchor`; 2A full-digest test | Undetectable without the external anchor (MO-1308 Q03) |
| T10 | A forged but self-consistent export verifies | The page claims integrity checking only, not authenticity, signature or encryption | DB15 | registry `statement.integrityOnly`, `statement.notAuthenticated` | By design (MO-1308 Q13, H07) |
| T11 | The page misleads: approval-like affordance, state by colour, hostile words in data posing as state | Closed wording registry, forbidden-affordance scan of chrome, closed read-only action set, one presentation for every state, hostile words shown only as inert data | DB13, DB14, DB17 | 2A scanner and adversarial tests; Phase 1 wording tests | A reader may still over-trust a green-looking host page outside MemoryOS |
| T12 | Output overwritten, partially written, or raced | Exclusive staging, fsync, non-replacing hard link, early existence check, staging removed in every outcome | DB20 | 2B DB20 test | See section 2 residuals |
| T13 | A foreign file or link planted at the staging name | `wx` create fails typed and is not retried; the foreign file is left untouched | DB20 (A6) | 2B DB20 test | A6.2 on Windows |
| T14 | Hosted snapshot discloses metadata to every reader; no access control | The page and, at the v1.3.0 step, the release wording state it; access control is the operator's responsibility and is not provided or claimed | DB15, DB28 | registry `statement.metadataDisclosure`; trust test | Operator responsibility |
| T15 | Retained member contents exposed | Contents are read once only for verification, never parsed, embedded or rendered; scanner M1 | DB04 | 2B content-absence test; rule M1; 4C-S6 | None known |
| T16 | The output leaks environment (paths, host, user, environment values, clock) | The generator reads none of them; byte-identical output across time zone, locale, working directory, clock and directory order; scanner F1 to F6 | DB18, DB19 | 2B determinism and process tests; rules F1 to F6 | None known |
| T17 | The hosted file is altered after generation | The footer digest is not a signature and is not claimed as one; a reader can compare the digest with a value recorded when the file was generated | DB15 | registry statements; rule S3 | Not detectable without that record |
| T18 | Resource exhaustion by size or count | Imported limits; the page renders 100 rows per page; 100,000 entries is characterized in 2D with no support claim | DB21, DB22 | 2B limit tests; 2D | A very large snapshot may load slowly |
| T19 | Supply-chain compromise through a dependency or a browser-automation package | No dependency, no build step, browser harness uses Node built-ins only | DB27 | no manifest, lockfile or closure changed by 2A to 2C | A browser binary is host-provided |
| T20 | Clipboard misuse | Copy runs only from an explicit user click, writes only the selected value, and its status is announced | DB13 | 2A copy test | Clipboard permission is browser policy |
| T21 | Framing or clickjacking of a hosted copy | The page has no write action; a policy meta cannot carry `frame-ancestors`, so hosting guidance is to send the same policy plus `frame-ancestors 'none'` as headers | DB06 | Freeze section 5 (documentation, not a MemoryOS guarantee) | Operator responsibility |

## 4. Data classes and scanner rules

The scanner is `web/js/memoryos-dashboard-dataclass.js` (`scanSnapshot`, `DATA_CLASSES`, `DATA_CLASS_RULES`). It is
pure, receives the snapshot text and a caller-supplied context (the paths, host and user names, environment values and
member contents that must not appear), and returns violations that name a rule and a location, never the offending
content.

**Data classes.** DATA: untrusted export-derived values, only inside the data block and only as the closed view model.
REGISTRY_TEXT: the only chrome text. GENERATOR_FIELDS: generator version and snapshot digest. FIXED_SOURCE: the fixed
script, style and markup pinned by the policy. Forbidden classes: FORBIDDEN_PATH, FORBIDDEN_HOST_USER,
FORBIDDEN_ENVIRONMENT, FORBIDDEN_CLOCK, FORBIDDEN_MEMBER_CONTENT, FORBIDDEN_DIAGNOSTIC, FORBIDDEN_REFERENCE.

| Rule | Class | Requirement | Statement |
|---|---|---|---|
| S1 | FIXED_SOURCE | DB05 | Exactly one policy meta, one style, one data block and one script, in that order |
| S2 | FIXED_SOURCE | DB06 | The policy is `default-src 'none'` with the SHA-256 of the actual script and style and no other source |
| S3 | GENERATOR_FIELDS | DB19 | The footer holds a plain generator version and the snapshot digest recomputed over the file with that field blanked |
| D1 | DATA | DB09, DB10 | The data block parses, is the closed `MemoryOSDashboardViewModel`, and contains none of `<`, `>`, `&`, U+2028, U+2029 |
| D2 | DATA | DB19 | The data block is the only place export-derived values occur; outside it, the text is registry text, generator fields and fixed source |
| R1 | FORBIDDEN_REFERENCE | DB05 | Outside the policy meta and data block: no address, `//`, `data:` or `blob:` source, link, frame, object, embed, image, base or form |
| F1 | FORBIDDEN_PATH | DB19 | No path-shaped text (drive, UNC, rooted system directory, home shorthand, file address) outside the data block |
| F2 | FORBIDDEN_CLOCK | DB19 | No date-time, time of day, time zone name or epoch-millisecond number outside the data block |
| F3 | FORBIDDEN_DIAGNOSTIC | DB19 | No stack frame, exception name or error-code line outside the data block and the fixed script |
| F4 | FORBIDDEN_HOST_USER | DB19 | No supplied host or user name anywhere in the file |
| F5 | FORBIDDEN_ENVIRONMENT | DB19 | No supplied environment value anywhere in the file |
| F6 | FORBIDDEN_PATH | DB19 | No supplied path anywhere in the file |
| M1 | FORBIDDEN_MEMBER_CONTENT | DB04 | No sample of any supplied member contents appears anywhere in the file |

Every rule has a negative control in `memoryos_dashboard_trust_test.mjs` that makes it fire, and a clean snapshot of every
fixture, including the adversarial one, passes all of them. Untrusted data inside the data block may say anything (a path,
a time, a script tag); the scanner checks its shape and that it stays inside the block, not its content. The 4C-S6 campaign
runs this scanner on generator output with the real operator context on Windows.

## 5. Residual risks to disclose

1. Integrity only: no authenticity, completeness, currency, signature or encryption (T09, T10, T17).
2. A hosted snapshot discloses entry metadata to its readers; access control is the operator's (T14).
3. Output-directory swap and Windows staging `EPERM` are inherited H40 and A6 limitations (section 2).
4. Hosting headers (`frame-ancestors`) are guidance, not a guarantee (T21).
5. 100,000-entry behaviour is characterized only (T18, Phase 2D).

## 6. Requirement coverage of this stream

DB28 (H40/A6 re-review recorded; the store claim stays local single-user v1) is covered by section 2 and the trust test.
DB19 and DB04 gain the scanner rules F1 to F6 and M1. DB05 and DB06 gain S1, S2 and R1 as scan rules. DB14, DB15 and DB26
are exercised by the registry and import checks in the trust test. Windows-run proof of any of these is Phase 4C.

## 7. Not claimed

No Windows result. No statement about the Standard (CCA-MEMORYOS-1.1). No multi-user, shared-storage or hosted-service
claim. No claim that the snapshot is authentic, complete, current, approved or safe to rely on.
