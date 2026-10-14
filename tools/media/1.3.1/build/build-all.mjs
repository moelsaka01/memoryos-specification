// Builds every MemoryOS 1.3.1 release-media file from the raw takes (real recordings). Usage: node tools/media/build/build-all.mjs [gif|demo|ads|thumbs|all]
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { AssDoc, COLOR } from '../lib/ass.mjs';
import { render, buildGraph } from '../lib/render.mjs';
import { render as synth, writeWav } from '../make-audio.mjs';
import { take, at, seg, fit, camOn, camCentre, OUT, WORK, ensureDir } from './lib.mjs';

const S = 'studio-main-16x9', E = 'term-export-16x9', L = 'term-live-16x9';
const TMP = ensureDir(`${WORK}/build`);
ensureDir(OUT);
const URL_TEXT = 'github.com/moelsaka01/memoryos-specification';
const errRect = () => [161, 475, 1409, 680];
const ZOOM_TERM = (tag, z = 1.45) => ({ cx: 1920 / z / 2 + 20, cy: 1080 / z / 2 + 10, z });
const cut = (tag, a, b) => ({ tag, a, b });

// ------------------------------------------------------------------ GIF
function buildGif() {
  const W = 1280, H = 720;
  const segments = [
    seg(S, 'home+0.3', 'history-nav-0.3', { speed: 1.6 }),
    seg(S, 'history-nav', 'pick-export', { speed: 1.7 }),
    seg(S, 'pick-export', 'dashboard-shown', { speed: 1.9 }),
    seg(S, 'dashboard-shown+1', 'section-source', { speed: 2.3, trans: { type: 'fade', dur: 0.2 } }),
    seg(S, 'section-source', 'section-counts+1', { speed: 2.4 }),
    seg(S, 'filter-applied-0.5', 'filtered-table+1.5', { speed: 1.8 }),
    seg(S, 'pick-tampered', 't-result+3.5', { speed: 2.0 }),
  ];
  const { timeline } = buildGraph({ w: W, h: H, segments });
  const ass = new AssDoc({ w: W, h: H });
  const caps = [['Studio home', 0], ['History (new in 1.3.1)', 1], ['Choose export folder', 2], ['Read once, integrity-checked, shown read-only', 3], ['Counts and digests', 4], ['Filter by record kind', 5], ['One byte changed: rejected', 6]];
  caps.forEach(([t, i]) => { ass.scrim(timeline[i].start, timeline[i].end, 'bottom', { strength: 140 }); ass.caption(timeline[i].start + 0.2, timeline[i].end - 0.1, t, { y: H * 0.9, size: 34, maxWidth: W * 0.8 }); });
  const assFile = path.join(TMP, 'gif.ass'); fs.writeFileSync(assFile, ass.toString());
  const mp4 = path.join(TMP, 'gif-source.mp4');
  render({ spec: { w: W, h: H, fps: 12, segments }, out: mp4, assFile, workDir: TMP, name: 'gif', crf: 12, preset: 'fast' });
  const pal = path.join(TMP, 'pal.png');
  spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-vf', 'fps=12,palettegen=max_colors=128:stats_mode=diff', pal]);
  const out = `${OUT}/memoryos-1.3-demo.gif`;
  const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', mp4, '-i', pal, '-lavfi', 'fps=12[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=4', '-loop', '0', out], { encoding: 'utf8' });
  if (r.status) throw new Error(r.stderr);
  console.log('gif', (fs.statSync(out).size / 1e6).toFixed(1), 'MB');
}

// ------------------------------------------------------------------ DEMO
function buildDemo() {
  const W = 1920, H = 1080;
  const f = { trans: { type: 'fade', dur: 0.3 } };
  const items = [
    [seg(S, 'home', 'home+6', { speed: 1.2, cam: { from: camCentre(S, 1), to: camCentre(S, 1.06) } }), 'cap', 'MemoryOS 1.3.1: Memory Studio, real home screen', 'Local, read-only History screen. Recorded live; nothing on screen is mocked.'],
    [seg(E, 'start', 'history-start', { speed: 1.5, ...f }), 'live', 'LIVE: pinned Node v24.21.0, SHA-256 ba4e6d11…6c32', 'The released CLI (1.2.0) runs on exactly this runtime'],
    [seg(E, 'history-start', 'ledger-verified', { speed: 3.2 }), 'live', 'LIVE: history init + 12 appends (sped up ×3.2)', 'A local, file-based, append-only, hash-chained ledger (MO-1308)'],
    [seg(E, 'ledger-verified', 'export-listed+1', { speed: 1.6 }), 'live', 'LIVE: verify, tombstone, export, verify-export', 'History writes (append, tombstone) are CLI-only'],
    [seg(E, 'tamper-start', 'end', { speed: 1.2 }), 'live', 'LIVE: one byte changed in a COPY; the CLI rejects it (exit 3)', 'Helper script flips one character of a stored entry digest'],
    [seg(S, 'history-nav-0.4', 'history-open+2', { ...f }), 'cap', 'Back in Studio: the new History screen', 'Studio reads the chosen folder once into memory and keeps nothing'],
    [seg(S, 'pick-export', 'dashboard-shown+0.8', { speed: 1.25 }), 'cap', 'Choose export folder: native dialog, then the browser’s permission prompt', 'Recording note: the dialog was operated by script for this recording'],
    [seg(S, 'dashboard-shown+0.8', 'section-entries', { speed: 1.15 }), 'cap', 'Verified by the released MO-1308 verifier; shown by the MO-1309 dashboard', 'Read-only. Integrity checking only; no approval is claimed'],
    [seg(S, 'filter-start', 'filter-cleared', { speed: 1.35 }), 'cap', 'Filter by record kind, expand an entry', 'The page shows the recorded entries, hashes and links as recorded'],
    [seg(S, 'save-nav-0.2', 'save-nav+3.2', {}), 'cap', 'Save dashboard snapshot: a static HTML file', 'Static and cloud-ready: no hosted service, accounts or multi-user'],
    [seg(S, 'pick-tampered', 't-result+5', { speed: 1.35, cam: { from: camCentre(S, 1), to: camCentre(S, 1) } }), 'bad', 'The one-byte-tampered export is rejected inside Studio', 'Error code DASH_EXPORT_INVALID · history code MO1308_EXPORT_CORRUPT'],
    [seg(L, 'policy-start', 'policy-done', { speed: 1.7, ...f }), 'live', 'LIVE · MO-1301: policy evaluation, decision FAIL (exit 6)', ''],
    [seg(L, 'mcp-start', 'mcp-done', { speed: 1.3 }), 'live', 'LIVE · MO-1304: the MCP server answers real requests', 'tools/list: 6 tools; tools/call: contract identities'],
    [seg(L, 'ci-start', 'ci-done', { speed: 3.2 }), 'live', 'LIVE · MO-1302/1306: CI/CD runner, real bundle, verified (sped up ×3.2)', 'Windows generic runner; GitHub integration is offline-validated only'],
    [seg(L, 'readiness-start', 'readiness-done', { speed: 3.4 }), 'live', 'LIVE · MO-1307: readiness evaluation over fixture inputs (sped up ×3.4)', 'Computed readiness is not human release authorization'],
    [seg(L, 'vscode-file-1', 'vscode-file+2.3', {}), 'file', 'FILE SCENE · MO-1303: shipped VS Code command titles (not a live run)', 'VS Code: macOS not executed'],
    [seg(L, 'rest-file-1.2', 'rest-file+3', {}), 'file', 'FILE SCENE · MO-1305: REST routes from the shipped OpenAPI file (not a live run)', 'REST: certified on Windows 11 x64 host only'],
    [seg(S, 'end-4.5', 'end', { speed: 1, cam: { from: camCentre(S, 1), to: camCentre(S, 1.05) }, hold: 0.6, fadeOut: 0.6 }), 'end'],
  ];
  const segments = items.map((x) => x[0]);
  const { timeline } = buildGraph({ w: W, h: H, segments });
  const ass = new AssDoc({ w: W, h: H });
  items.forEach(([, kind, text, sub], i) => {
    const t0 = timeline[i].start + 0.3, t1 = timeline[i].end - 0.2;
    if (kind === 'end') {
      ass.scrim(t0, t1, 'bottom', { strength: 200, depth: 0.7 });
      ass.hero(t0, t1, 'MemoryOS 1.3.1', { y: H * 0.72, size: 110 });
      ass.caption(t0 + 0.5, t1, URL_TEXT, { y: H * 0.84, size: 44 });
      return;
    }
    ass.scrim(t0, t1, 'bottom', { strength: 175, depth: 0.3 });
    const tagText = kind === 'live' ? 'LIVE RUN' : kind === 'file' ? 'FILE SCENE' : kind === 'bad' ? 'REJECTED' : null;
    if (tagText) ass.tag(t0, t1, tagText, { x: W * 0.1, y: H * 0.1, color: kind === 'bad' ? COLOR.bad : kind === 'file' ? COLOR.amber : COLOR.good });
    ass.caption(t0, t1, text, { y: sub ? H * 0.855 : H * 0.89, size: 42, maxWidth: W * 0.8 });
    if (sub) ass.caption(t0 + 0.25, t1, sub, { y: H * 0.925, size: 30, box: false, color: COLOR.mute, maxWidth: W * 0.8 });
  });
  const assFile = path.join(TMP, 'demo.ass'); fs.writeFileSync(assFile, ass.toString());
  const out = `${OUT}/memoryos-1.3-demo.mp4`;
  const r = render({ spec: { w: W, h: H, fps: 30, segments }, out, assFile, workDir: TMP, name: 'demo', crf: 19, preset: 'medium' });
  console.log('demo', r.duration.toFixed(1), 's');
}

// ------------------------------------------------------------------ ADS
const RATIOS = { '16x9': { w: 1920, h: 1080, contain: false }, '1x1': { w: 1080, h: 1080, contain: true }, '4x5': { w: 1080, h: 1350, contain: true } };

function adStoryboard(len) {
  const hook = { s: fit(S, 't-permission-prompt-0.6', 't-result+1.6', 4.0) };
  const A = (tag, a, b, dur, extra = {}) => fit(tag, a, b, dur, extra);
  const F = { trans: { type: 'fade', dur: 0.2 } };
  const errCam = { from: camCentre(S, 1), to: camOn(S, errRect(), { pad: 1.5 }) };
  const base = {
    hook: { seg: { ...A(S, 't-permission-prompt-0.6', 't-result+1.6', 4.0), cam: errCam, shake: [{ t: 2.5, amp: 9 }] }, dur: 4 },
    title: { seg: A(S, 'home', 'home+4', 4, { cam: { from: camCentre(S, 1), to: camCentre(S, 1.12) }, ...F }), dur: 4 },
    open: { seg: A(S, 'history-nav', 'dashboard-shown', 8, F), dur: 8 },
    dash: { seg: A(S, 'section-source', 'row-expanded+1', 8, { cam: { from: camOn(S, [161, 577, 1855, 1080], { pad: 1.05 }), to: camOn(S, [161, 577, 1855, 1080], { pad: 1.05 }) }, ...F }), dur: 8 },
    cli: { seg: A(E, 'tamper-start', 'tamper-rejected+3', 8, { cam: { from: ZOOM_TERM(E, 1.45), to: ZOOM_TERM(E, 1.45) }, ...F }), dur: 8 },
    mcp: { seg: A(L, 'mcp-start+3', 'mcp-done', 4, { cam: { from: ZOOM_TERM(L, 1.45), to: ZOOM_TERM(L, 1.45) }, ...F }), dur: 4 },
    ci: { seg: A(L, 'ci-run-done-1', 'ci-done', 4, { cam: { from: ZOOM_TERM(L, 1.3), to: ZOOM_TERM(L, 1.3) }, ...F }), dur: 4 },
    ready: { seg: A(L, 'readiness-start+6', 'readiness-done+1', 4, { cam: { from: ZOOM_TERM(L, 1.3), to: ZOOM_TERM(L, 1.3) }, ...F }), dur: 4 },
    snap: { seg: A(S, 'save-nav-0.5', 'save-nav+3.5', 4, F), dur: 4 },
    end: { seg: A(S, 'end-5', 'end', 5, { cam: { from: camCentre(S, 1.08), to: camCentre(S, 1) }, hold: 0, ...F }), dur: 5 },
  };
  void hook;
  const order = { 60: ['hook', 'title', 'open', 'dash', 'cli', 'mcp', 'ci', 'ready', 'snap', 'end'], 30: ['hook', 'title', 'open', 'cli', 'ci', 'end'], 15: ['hook', 'title', 'cli', 'end'] }[len];
  const dur = { 60: { hook: 4, title: 4, open: 10, dash: 10, cli: 10, mcp: 5, ci: 5, ready: 5, snap: 4, end: 4.6 }, 30: { hook: 4, title: 3, open: 7.5, cli: 5.5, ci: 6, end: 4.8 }, 15: { hook: 4, title: 3, cli: 3.4, end: 5 } }[len];
  const list = order.map((k) => { const b = base[k]; const d = dur[k]; const s = { ...b.seg }; const srcLen = s.to - s.from; s.speed = srcLen / d; if (s.shake) s.shake = len === 15 ? [{ t: 2.5, amp: 9 }] : s.shake; return { key: k, seg: s, dur: d }; });
  return list;
}

function adTexts(ass, L_, key, t0, t1) {
  const { w, h, contain } = L_;
  const heroY = contain ? h * (h > w ? 0.15 : 0.13) : h * 0.74;
  const capY = contain ? h * (h > w ? 0.86 : 0.9) : h * 0.905;
  const hs = contain ? Math.round(w * 0.1) : Math.round(h * 0.105);
  const T = (a, b) => [t0 + a, Math.min(t1, t0 + b)];
  const top = (dt0, dt1, lines, colors) => { const [a, b] = T(dt0, dt1); ass.stack(a, b, lines, { y: heroY, size: hs, colors, per: 0.2, maxWidth: w * 0.8 }); };
  const cap = (dt0, dt1, text, o = {}) => { const [a, b] = T(dt0, dt1); ass.caption(a, b, text, { y: capY, size: Math.round(contain ? w * 0.045 : h * 0.04), maxWidth: w * 0.8, ...o }); };
  const tag = (dt0, dt1, text, color) => { const [a, b] = T(dt0, dt1); ass.tag(a, b, text, { x: w * 0.1, y: h * (contain ? 0.045 : 0.1), color }); };
  const wide = !contain;
  if (key === 'hook') {
    if (wide) { ass.scrim(t0, t1, 'bottom', { strength: 150 }); ass.stack(t0 + 0.2, t0 + 2.45, ['One byte changed.'], { y: h * 0.74, size: hs, per: 0.3, maxWidth: w * 0.8 }); ass.stack(t0 + 2.5, t1 - 0.1, ['Rejected.'], { y: h * 0.74, size: Math.round(hs * 1.2), colors: [COLOR.bad], per: 0 }); }
    else { ass.stack(t0 + 0.2, t0 + 2.45, ['One byte changed.'], { y: heroY, size: hs, per: 0.3, maxWidth: w * 0.84 }); ass.stack(t0 + 2.5, t1 - 0.1, ['Rejected.'], { y: heroY, size: Math.round(hs * 1.2), colors: [COLOR.bad], per: 0 }); }
    ass.flash(t0 + 2.5, { alpha: 120 });
    cap(0.4, 4, 'Real software. Real error.');
  } else if (key === 'title') {
    if (wide) ass.scrim(t0, t1, 'bottom', { strength: 150 });
    top(0.1, 3.9, ['MemoryOS 1.3.1'], [COLOR.white]);
    cap(0.7, 3.9, 'Studio now has History.');
  } else if (key === 'open') { top(0.2, 7.8, ['Open a real export.']); cap(2.5, 7.9, 'Integrity-checked inside Studio. Read-only.'); }
  else if (key === 'dash') { top(0.2, 7.8, ['Counts. Digests.', 'Filters.']); cap(2.5, 7.9, 'Save a static snapshot. Nothing written to the history.'); }
  else if (key === 'cli') { top(0.2, 7.8, ['Built by the CLI.', 'One byte. Caught.'], [COLOR.white, COLOR.bad]); tag(0.2, 7.8, 'LIVE RUN', COLOR.good); cap(3, 7.9, 'Verification fails on a changed copy (exit 3).'); }
  else if (key === 'mcp') { tag(0, 4, 'LIVE RUN', COLOR.good); top(0.1, 3.9, ['MCP server']); cap(0.8, 3.9, 'MO-1304 answers real requests.'); }
  else if (key === 'ci') { tag(0, 6, 'LIVE RUN · SPED UP', COLOR.good); top(0.1, 5.9, ['CI/CD runner']); cap(0.8, 5.9, 'MO-1302/1306 real bundle, verified.'); }
  else if (key === 'ready') { tag(0, 4, 'LIVE RUN · FIXTURE INPUTS', COLOR.amber); top(0.1, 3.9, ['Readiness']); cap(0.8, 3.9, 'MO-1307 evaluation. Not an approval.'); }
  else if (key === 'snap') { top(0.1, 3.9, ['Static.', 'Read-only.']); cap(1, 3.9, 'No hosted service. No accounts.'); }
  else if (key === 'end') {
    ass.scrim(t0, t1, 'bottom', { strength: 210, depth: 0.75 }); if (contain) ass.scrim(t0, t1, 'top', { strength: 150, depth: 0.4 });
    ass.stack(t0 + 0.4, t1, ['MemoryOS 1.3.1'], { y: contain ? heroY : h * 0.72, size: contain ? hs : Math.round(h * 0.11), per: 0 });
    cap(1.0, 5, URL_TEXT, { y: contain ? capY : h * 0.84, size: Math.round(contain ? w * 0.04 : h * 0.042) });
  }
}

function buildAd(len, ratio) {
  const L_ = RATIOS[ratio];
  const list = adStoryboard(len);
  const segments = list.map((x) => ({ ...x.seg, contain: L_.contain }));
  const spec = { w: L_.w, h: L_.h, fps: 30, segments, contain: L_.contain };
  const { timeline, duration } = buildGraph(spec);
  const ass = new AssDoc({ w: L_.w, h: L_.h });
  const marks = {};
  list.forEach((x, i) => { marks[x.key] = timeline[i]; adTexts(ass, L_, x.key, timeline[i].start, timeline[i].end); });
  const name = `memoryos-1.3-ad-${len}s-${ratio}`;
  const assFile = path.join(TMP, `${name}.ass`); fs.writeFileSync(assFile, ass.toString());
  // sound bed on the beat grid (120 BPM): hit on the tamper rejection, riser into it, hit on the end frame
  const hookHit = marks.hook.start + 2.5, endStart = marks.end.start + 0.4;
  const aSpec = {
    duration, bpm: 120,
    hits: [{ t: hookHit, kind: 'tamper' }, { t: endStart, kind: 'end' }],
    risers: [{ t0: hookHit - 2.0, t1: hookHit }, { t0: endStart - 2.0, t1: endStart - 0.12 }],
    cuts: timeline.map((t) => t.start).slice(1),
    gaps: [{ t0: hookHit - 0.12, t1: hookHit }, { t0: endStart - 0.12, t1: endStart }],
    sections: [
      { t0: 0, t1: hookHit, layers: ['pad'] },
      { t0: hookHit, t1: marks.title ? marks.title.end : hookHit + 3, layers: ['kick', 'hat', 'bass', 'pad', 'tick'] },
      { t0: marks.title ? marks.title.end : hookHit + 3, t1: endStart - 0.12, layers: ['kick', 'hat', 'bass', 'pad', 'clap', 'arp', 'tick'] },
      { t0: endStart, t1: endStart + 2.0, layers: ['pad', 'kick'] },
    ],
  };
  const specFile = path.join(TMP, `${name}.audio.json`); fs.writeFileSync(specFile, JSON.stringify(aSpec));
  const raw = path.join(TMP, `${name}.raw.wav`), wav = path.join(TMP, `${name}.wav`);
  writeWav(raw, synth(aSpec), duration + 0.3);
  // loudness: two-pass loudnorm to about -14 LUFS integrated, true peak below -1 dBTP
  const meas = spawnSync('ffmpeg', ['-hide_banner', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
  const j = JSON.parse(meas.stderr.slice(meas.stderr.lastIndexOf('{'), meas.stderr.lastIndexOf('}') + 1));
  const ln = `loudnorm=I=-14:TP=-2.2:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,alimiter=limit=0.78:level=false,aresample=48000`;
  const ar = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af', ln, '-ar', '48000', '-ac', '2', wav], { encoding: 'utf8' });
  if (ar.status) throw new Error(ar.stderr);
  const out = `${OUT}/${name}.mp4`;
  render({ spec, out, assFile, audio: wav, workDir: TMP, name, crf: 18, preset: 'medium' });
  console.log(name, duration.toFixed(1), 's', (fs.statSync(out).size / 1e6).toFixed(1), 'MB');
}

function buildThumbs() {
  for (const [ratio, file] of [['16x9', 'memoryos-1.3-ad-thumbnail.png'], ['1x1', 'memoryos-1.3-ad-thumbnail-1x1.png']]) {
    const L_ = RATIOS[ratio];
    const s = { ...fit(S, 't-result+0.9', 't-result+1.9', 1.0), cam: { from: camOn(S, errRect(), { pad: 1.5 }), to: camOn(S, errRect(), { pad: 1.5 }) }, contain: L_.contain };
    const spec = { w: L_.w, h: L_.h, fps: 30, segments: [s], contain: L_.contain };
    const ass = new AssDoc({ w: L_.w, h: L_.h });
    const hs = L_.contain ? Math.round(L_.w * 0.1) : Math.round(L_.h * 0.105);
    ass.scrim(0, 1, 'bottom', { strength: 150 });
    ass.stack(0, 1, ['One byte changed.'], { y: L_.contain ? L_.h * 0.13 : L_.h * 0.74, size: hs, per: 0, maxWidth: L_.w * 0.8 });
    ass.caption(0, 1, 'MemoryOS 1.3.1 · Studio History', { y: L_.h * (L_.contain ? 0.88 : 0.88), size: Math.round(L_.contain ? L_.w * 0.045 : L_.h * 0.04) });
    const assFile = path.join(TMP, `thumb-${ratio}.ass`); fs.writeFileSync(assFile, ass.toString());
    const mp4 = path.join(TMP, `thumb-${ratio}.mp4`);
    render({ spec, out: mp4, assFile, workDir: TMP, name: `thumb-${ratio}`, crf: 12, preset: 'fast' });
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', '0.6', '-i', mp4, '-frames:v', '1', `${OUT}/${file}`]);
    console.log('thumb', file);
  }
}

const what = process.argv[2] ?? 'all';
if (what === 'gif' || what === 'all') buildGif();
if (what === 'demo' || what === 'all') buildDemo();
if (what === 'ads' || what === 'all') { for (const [len, ratios] of [[60, ['16x9', '1x1', '4x5']], [30, ['16x9', '1x1', '4x5']], [15, ['1x1', '4x5']]]) for (const r of ratios) buildAd(len, r); }
if (what === 'thumbs' || what === 'all') buildThumbs();
void take; void at; void cut;
