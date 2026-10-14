# MemoryOS 1.3.1: draft posts (nothing posted)

Sources for every claim: the v1.3.1 release notes (draft release body on GitHub), `docs/mo1310-release-disclosures.md`, `RELEASE_NOTES.md` (the v1.3.0 milestone list that v1.3.1 builds on) and `KNOWN_ISSUES.md`. Note: `RELEASE_NOTES.md` at tag v1.3.1 is still the v1.3.0 file; the 1.3.1 text is in the release body. Release link (works once the release is published): https://github.com/moelsaka01/memoryos-specification/releases/tag/v1.3.1

## LinkedIn (about 1,000 characters)

MemoryOS 1.3.1 adds a History screen to Memory Studio.

You pick a MemoryOS history export folder, made by the memoryos history export command. Studio reads it once into memory, verifies it with the released MO-1308 verifier and shows the MO-1309 dashboard inside Studio. It is read-only and stores nothing: no endpoint, no upload and no request carrying export data.

The video shows it on a real Windows 11 machine, from Studio's home screen to the dashboard, and what happens when one byte of an export is changed: Studio refuses to show it and reports the integrity error.

The recording also runs, live, the policy evaluation, the MCP server, the CI/CD runner and a readiness evaluation (on fixture inputs; computed readiness is not release approval).

Qualifications are published with the release: Chromium-family browsers for folder access, Windows 11 x64 reference host, the history is not authenticated or signed, and the certified scale is 10,000 entries. The repository is public; no license is granted.

Release: https://github.com/moelsaka01/memoryos-specification/releases/tag/v1.3.1

#MemoryOS #DeveloperTools #IntegrityChecking #Windows

## X (one post, under 280 characters)

MemoryOS 1.3.1: Studio gets a History screen. Open an export folder, it is verified and shown read-only. Change one byte and Studio refuses it. Recorded live on Windows 11. https://github.com/moelsaka01/memoryos-specification/releases/tag/v1.3.1

## X (alternative)

Change one byte of a MemoryOS history export and Studio rejects it with a real integrity error. New in 1.3.1: the History screen (read-only, nothing stored). https://github.com/moelsaka01/memoryos-specification/releases/tag/v1.3.1

## Alt text

- **memoryos-1.3-demo.gif**: Screen recording of Memory Studio: the home screen, the History screen, a folder dialog, the integrity-checked dashboard with counts and filters, and a tampered export rejected with an error message.
- **memoryos-1.3-demo.mp4**: Captioned walkthrough: Studio's home screen, a terminal building and exporting a MemoryOS history, Studio's History screen opening the export through the native folder dialog, dashboard filtering, a snapshot download, a one-byte-changed export rejected, then live terminal runs of policy evaluation, the MCP server, the CI/CD runner and a readiness evaluation.
- **memoryos-1.3-ad-60s-16x9 / 1x1 / 4x5**: Fast-cut product film: a changed export rejected in Studio, the 1.3.1 History screen, the dashboard, the CLI catching a changed byte, live MCP, CI/CD and readiness runs, closing with the name and repository address. Text on screen repeats the message; the sound is a generated music bed.
- **memoryos-1.3-ad-30s-... / 15s-...**: Shorter cuts of the same film: the rejection, Studio History, the CLI check, and the closing name and address.
- **memoryos-1.3-ad-thumbnail.png / -1x1.png**: A real Studio screen showing "This folder was not shown", error code DASH_EXPORT_INVALID, with the words "One byte changed."
