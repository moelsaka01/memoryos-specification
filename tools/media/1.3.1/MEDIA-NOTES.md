# MemoryOS 1.3.1 release media: notes

Nothing here is uploaded, pushed or published. The earlier 1.3.0 media in `C:\mos-media\out` is untouched. Worktree `C:\mos-media\repo131` (branch `media/v1.3.1` from tag `v1.3.1` = `2781d93f`); scripts under `tools/media/`, **uncommitted**. Large outputs stay out of git. The v1.3.1 GitHub release is still a draft.

## Files (`C:\mos-media\out-1.3.1`)

| File | Resolution | Duration | Size |
|---|---|---|---|
| memoryos-1.3-demo.gif | 1280x720, 12 fps, loops | 28.8 s | 6.4 MB |
| memoryos-1.3-demo.mp4 | 1920x1080, 30 fps, silent | 3:04.7 | 15.6 MB |
| memoryos-1.3-ad-60s-16x9.mp4 | 1920x1080 | 60.0 s | 10.2 MB |
| memoryos-1.3-ad-60s-1x1.mp4 | 1080x1080 | 60.0 s | 5.8 MB |
| memoryos-1.3-ad-60s-4x5.mp4 | 1080x1350 | 60.0 s | 6.0 MB |
| memoryos-1.3-ad-30s-16x9.mp4 | 1920x1080 | 30.0 s | 6.3 MB |
| memoryos-1.3-ad-30s-1x1.mp4 | 1080x1080 | 30.0 s | 3.5 MB |
| memoryos-1.3-ad-30s-4x5.mp4 | 1080x1350 | 30.0 s | 3.5 MB |
| memoryos-1.3-ad-15s-1x1.mp4 | 1080x1080 | 15.0 s | 2.5 MB |
| memoryos-1.3-ad-15s-4x5.mp4 | 1080x1350 | 15.0 s | 2.6 MB |
| memoryos-1.3-ad-thumbnail.png / -1x1.png | 1920x1080 / 1080x1080 | | 0.4 / 0.2 MB |
| SOCIAL-POSTS.md, MEDIA-NOTES.md | | | |

Ads: H.264 High, yuv420p, 30 fps, AAC-LC 48 kHz stereo (about 134 kbps), `+faststart`, CRF 18. Loudness measured with ffmpeg `ebur128`: integrated -14.2 to -14.3 LUFS; peak at or below -1.1 dBFS (sample peak; the two-pass loudnorm targeted TP -2.2 and a limiter follows). The demo MP4 is H.264 High CRF 19, no audio track. GIF: two-pass palette (128 colours, Bayer dither).

## What was recorded, and how (all real)

Takes were recorded on this PC (Windows 11, 1920x1080 at 150% scaling) with FFmpeg `ddagrab` (GPU desktop capture, real pointer) of ONE full-size 1920x1080 window. Everything on screen was driven by real operating-system input (mouse, wheel, keyboard) sent by `tools/media/lib/winauto.ps1`; the DevTools protocol was used only to read where an element is so the real pointer lands on it. Studio is `repositories/cca-studio/scripts/serve.mjs` from the tag, started with the pinned Node, in Microsoft Edge 155.0.4283.45 in app-mode window with a fresh profile.

- `studio-main-16x9` (95 s): Studio home screen -> History (sidebar) -> Choose export folder -> **the native Windows folder dialog** -> the browser's real permission prompt ("Allow this site to view and copy files?") -> verified dashboard in Studio -> Save dashboard snapshot (Edge's real download shelf shows the file) -> scroll sections -> filter by record kind -> expand a row -> clear filter -> Clear -> choose the one-byte-tampered export -> the real error (`DASH_EXPORT_INVALID`, history code `MO1308_EXPORT_CORRUPT`).
- `term-export-16x9` (148 s), a real Windows Terminal typed with real keystrokes: `Get-FileHash` of the pinned Node (`BA4E6D11...6C32`, matches), `memoryos version` (CLI/SDK print 1.2.0), `history init`, 12 `append`s, `verify`, `tombstone`, `export`, `verify-export`, then `flip-one-byte` (a helper script of this media tooling: copies the export and changes ONE character of one stored entry digest) and `verify-export` on the copy, which fails (`VERIFICATION_FAILED`, exit 3).
- `term-live-16x9` (about 150 s): live runs on the pinned Node: MO-1301 `policy evaluate` (decision FAIL, exit 6); MO-1304 the MCP server answering real `tools/list` and `tools/call` (client script `tools/media/mcp-call.mjs`); MO-1302/1306 the CI/CD runner producing a real bundle (PASS, six files) and `verify`; MO-1307 a real readiness evaluation (results READY, over the released fixture inputs, labelled as such). **File scenes (labelled on screen): MO-1303 VS Code command titles and MO-1305 REST routes (shipped `package.json` / `openapi.json`). REST was not run live** (needs TLS material and a trusted launcher; not attempted within the budget).
- Transitions: each cut between Studio and the terminal is an edit between separately recorded takes (the person switching windows); crossfades of 0.2-0.3 s mark them. Speed-ups are labelled on screen (x3.2, x3.4 etc.). The ads re-time the same footage and add camera zooms and punch-ins over real pixels. **1:1 and 4:5 ads show the 16:9 footage full-width over a blurred copy of itself** (no separate narrow-window recordings; no slides). Text appears only as captions or kinetic text over footage; the end frame is name and repository address over a real shot.
- Native dialog: captured honestly. The dialog was operated by script (UI Automation finds "export" and "Select Folder", then real clicks). The release records the picker as an operator observation, not automated; this was done for the media only. The dialog opens in `C:\mos-demo` because the Edge profile's "last picked folder" was set once by an earlier warm-up pick (so no personal folders appear).
- `C:\mos-node` is a directory junction to the pinned toolchain folder; its `node.exe` has SHA-256 `ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32` (verified). The CI runner refuses a runtime reached through the junction (filesystem-boundary check), so the CI command uses the real pinned path. `memoryos` in the terminal is a one-line `.cmd` shim that runs the CLI with the pinned Node.
- MCP runs from a copy (`C:\mos-media\live\memoryos-mcp`) in which dependencies were assembled offline with the repository's own steps (`npm ci --offline --ignore-scripts` from the project's npm cache, then `assemble:dependencies`); nothing was installed on the machine and the worktree stayed clean.
- Records: the 12 appended records are the released MO-1308 test-fixture corpus (`prepare-records.mjs`), not a real release process. The same records always give the same export bytes (checked: identical tree digest on two runs).

## Audio (ads only)

Generated by `tools/media/make-audio.mjs` from nothing: sine, saw, square and noise oscillators, filters and envelopes in plain JavaScript; 120 BPM beat grid, the picture cuts snapped to beats; kick every beat, hats, clap, sub-bass with sidechain duck, detuned-saw pads, plucked arpeggio, noise-sweep risers into key moments, a stop-time gap, an impact plus bit-crushed glitch on the tamper rejection and a bigger impact on the end frame. No samples, recordings or third-party music. Loudness set with ffmpeg `loudnorm` (two passes) to about -14 LUFS, then a limiter.

## Wording and disclosures observed

Dashboard described as static and cloud-ready (no hosted service, accounts or multi-user claim); readiness never presented as approval ("Not an approval", "Computed readiness is not human release authorization"); no scale claim beyond the certified 10,000 entries (not shown); history writes are CLI-only (stated); no "open source" anywhere (the repository is public, no license granted); no third-party logos or stock footage; "Microsoft Edge"/"Windows" are plain text. CLI/SDK print 1.2.0 inside release 1.3.1; the demo says so.

## Product issues found (not fixed; Studio unmodified)

1. **History screen clips its content and does not wheel-scroll in narrow windows; keyboard focus scrolls it.** At 1920x1080 (150% scaling, about 690 CSS px of viewport height) `.studio-shell` and `body` compute `overflow-y: hidden`, so the wheel cannot scroll the page, and the dashboard frame (`min-height: 70vh`) extends below the window (about 150 CSS px hidden at 16:9, much more in 1080x1080 and 864x1080 windows). Tab into the frame scrolls the page (verified); the CSS comment says the History screen is meant to be "an ordinary scrolling page". The recordings use the full-size window and the frame's own scrolling.
2. Edge shows "Allow this site to view and copy files?" with Allow / Don't Allow for this picker (wording recorded here; the release disclosures say the operator did not supply it).
3. The standalone MO-1309 generator and Studio's History screen are separate paths; only Studio was recorded.

## Limitations

Not recorded live: REST (file scene), VS Code (file scene). Takes were not re-recorded for polish: the "LIVE RUN" tag sits over terminal text in a few frames, the end-card words have wide spacing, the first take frames show a download-shelf entry named `memoryos-history-dashboard (10).html` (earlier test downloads in the scratch folder), and 1:1/4:5 terminal footage is small (use the demo or 16:9 ads for readable output). The ads were checked by contact sheets and measurements, not watched in full. Platform limits for LinkedIn and X (length, size, ratios, audio rules) were **not** re-checked; re-check before posting. Each ad adds captions as burned-in text so they read with sound off; text is kept inside about 10% margins in 16:9 and mostly in the blurred bands in 1:1/4:5.

## Tools

Windows 11 10.0.26200; FFmpeg 9.0.2 (gyan.dev full build); Node v24.21.0 (pinned); Microsoft Edge 155.0.4283.45; Windows Terminal; Windows PowerShell 5.1; Git 2.55.0; GitHub CLI 2.102.0. No other installs. Scratch/diagnostic scripts (proto*, diag-*, contact, frames, prepare-rest) are outside `tools/media/`.

## Commands (from the worktree root)

```
node tools/media/prepare-records.mjs C:\mos-demo\records
node tools/media/record.mjs term-export 16x9
node tools/media/record.mjs studio-main 16x9
node tools/media/record.mjs term-live 16x9
node tools/media/build/build-all.mjs all
```

SHA-256 of the files is in `SHA256SUMS.txt` next to them.
