# MemoryOS 1.3.0 — social post copy (DRAFT, nothing published)

Every claim below comes from RELEASE_NOTES.md, KNOWN_ISSUES.md, the MO-1308 history guide or the MO-1309 dashboard page.
Repository facts checked with `gh repo view`: the repository is **public**, but it grants **no software license** (LICENSE is a decision
notice; KNOWN_ISSUES.md: "source license pending"). The posts therefore say "public" and never "open source".

Release link: https://github.com/moelsaka01/memoryos-specification/releases/tag/v1.3.0

## LinkedIn (1176 characters, 5 hashtags)

Suggested media: `memoryos-1.3-ad-30s-4x5.mp4` (mobile) or `memoryos-1.3-ad-30s-1x1.mp4`; cover `memoryos-1.3-ad-thumbnail-1x1.png`.

```text
MemoryOS 1.3.0 is released: nine milestones (MO-1301 to MO-1309) over the 1.2.1 baseline. Two are the headline.

• Investigation History (MO-1308): a local, append-only, hash-chained ledger for the records your investigations already produce, with deterministic query and a verifiable export, through the memoryos history CLI.
• Cloud Dashboard (MO-1309): a static, offline, strictly read-only dashboard generated as one HTML file from a verified export. "Cloud" means you can host the file anywhere; MemoryOS ships no hosting, server, accounts or network access.

Also in 1.3: Investigation Policies, a GitHub Actions policy gate, a VS Code extension, an MCP server, a REST gateway, CI/CD integration and evidence-backed release readiness (final authorization stays human).

Limits matter: history verification is an integrity check, not authentication; the claim is local single-user v1 on native Windows 11 x64; the dashboard's certified scale is 10,000 entries. The repository is public; a source license has not been chosen yet.

https://github.com/moelsaka01/memoryos-specification/releases/tag/v1.3.0

#MemoryOS #AIEngineering #DeveloperTools #CICD #SoftwareEngineering
```

## X — primary (258 characters as typed; 209 with the link counted as 23)

Suggested media: `memoryos-1.3-ad-15s-1x1.mp4`.

```text
MemoryOS 1.3.0 is out. New: a local, append-only, hash-chained investigation history (verify, query, export) and a static, offline, read-only dashboard generated from a verified export. https://github.com/moelsaka01/memoryos-specification/releases/tag/v1.3.0
```

## X — alternative (245 characters as typed; 196 with the link counted as 23)

```text
Change one byte in a MemoryOS 1.3 history entry and verification fails. 1.3.0 adds an append-only ledger and a static, read-only dashboard. Integrity checks, not approvals. https://github.com/moelsaka01/memoryos-specification/releases/tag/v1.3.0
```

## Alt text

**memoryos-1.3-ad-30s-16x9.mp4 / -30s-1x1.mp4 / -30s-4x5.mp4** — A 30-second dark-themed product film with on-screen text. A terminal shows a MemoryOS history ledger being verified after one byte of an entry was changed; verification fails with exit code 3. The title "MemoryOS 1.3 — Investigation History" appears, then terminal captures of appending records, verifying, querying and exporting, under the words "Append-only. Hash-chained. Verifiable." and "Query it. Export it." A real static dashboard opens in Microsoft Edge ("A static dashboard. Offline. Read-only."), then nine milestone tiles appear, and a closing card shows "MemoryOS 1.3", the GitHub repository address and "Release v1.3.0 · Local single-user v1 · Integrity checks, not approvals". No speech; a quiet generated sound bed only.

**memoryos-1.3-ad-15s-1x1.mp4** — A 15-second square cut with on-screen text: "Change one byte. Verification fails." over a terminal showing a failed ledger verification (exit 3), the "MemoryOS 1.3" title, a terminal appending records to a ledger, a static read-only dashboard opened in Microsoft Edge, and a closing card with the repository address.

**memoryos-1.3-ad-thumbnail.png (1920x1080) and memoryos-1.3-ad-thumbnail-1x1.png (1080x1080)** — Dark cover image with the MemoryOS 1.3 mark and the headline "Change one byte. Verification fails." beside a terminal that shows a tampered ledger failing verification with code VERIFICATION_FAILED, exit code 3.

**memoryos-1.3-demo.gif** — Looping 35-second screen capture. A terminal creates a MemoryOS history ledger, appends four records, verifies it, queries it, exports it and generates a static dashboard; the dashboard then opens in Microsoft Edge, scrolls to the entries table and filters it by record kind.

**memoryos-1.3-demo.mp4** — A four-minute captioned walkthrough of MemoryOS 1.3.0: policies with PASS, FAIL and COULD_NOT_EVALUATE outcomes, CI/CD, VS Code, MCP and REST contract files, readiness results, then the history ledger (init, append, verify, query, tombstone, export, tamper check) and the static dashboard in Microsoft Edge. Captions describe each step; there is no speech.
