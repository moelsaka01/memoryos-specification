// MemoryOS 1.3.1 ads v2: the 1.3.0 look (animated dark backdrop, kinetic headline words, glowing rounded footage window, beat pulses, progress bar)
// around the SAME real 1.3.1 recordings. Footage frames are cut with the edit engine (lib/render.mjs buildGraph) to the window size; scene/ad2.html
// draws every frame in Edge; frames are piped into FFmpeg together with the generated sound bed.
//   node tools/media/build/build-ads-v2.mjs 30-16x9[,60-1x1,...] [--thumbs]
import fs from 'node:fs';
import path from 'node:path';
import { spawn, spawnSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { buildGraph } from '../lib/render.mjs';
import { launchEdge } from '../lib/edge-headless.mjs';
import { render as synth, writeWav } from '../make-audio.mjs';
import { fit, camOn, camCentre, WORK, ensureDir } from './lib.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT2 = 'C:/mos-media/out-1.3.1/ads-v2';
const S = 'studio-main-16x9', E = 'term-export-16x9', L = 'term-live-16x9';
const URL_TEXT = 'github.com/moelsaka01/memoryos-specification';
const GOOD = '#3ddc97', AMBER = '#ffb347';
const errRect = () => [161, 475, 1409, 680];
const ZT = (tag, z) => ({ cx: 1920 / z / 2 + 20, cy: 1080 / z / 2 + 10, z });
const PANELS = { '16x9': { W: 1920, H: 1080, pw: 1160, ph: 652 }, '1x1': { W: 1080, H: 1080, pw: 960, ph: 560 }, '4x5': { W: 1080, H: 1350, pw: 960, ph: 720 } };
const FADE = { trans: { type: 'fade', dur: 0.2 } };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function storyboard(len, ratio) {
  const termZ = ratio === '16x9' ? 1.45 : ratio === '1x1' ? 1.7 : 1.5, ciZ = ratio === '16x9' ? 1.3 : ratio === '1x1' ? 1.55 : 1.35;
  const c1 = camCentre(S, 1);
  const A = (tag, a, b, dur, extra = {}) => fit(tag, a, b, dur, { cam: { from: c1, to: c1 }, ...extra });
  const T = (tag, z) => ({ from: ZT(tag, z), to: ZT(tag, z) });
  const wide = ratio === '16x9';
  const base = {
    hook: { seg: A(S, 't-permission-prompt-0.6', 't-result+1.6', 4.0, { cam: { from: c1, to: camOn(S, errRect(), { pad: 1.5 }) } }),
      b: { lines: [[{ t: 'One byte', at: 0.15 }], [{ t: 'changed.', at: 0.45 }], [{ t: 'Rejected.', at: 2.5, cls: 'bad', scale: 1.15 }]], tl: [[{ t: 'One byte changed.', at: 0.15 }], [{ t: 'Rejected.', at: 2.5, cls: 'bad', scale: 1.2 }]], hit: 2.5, bad: true, cap: 'Real software. Real error.', capAt: 0.4 } },
    title: { seg: A(S, 'home', 'home+4', 4, { cam: { from: c1, to: camCentre(S, 1.12) }, ...FADE }),
      b: { hex: true, lines: [[{ t: 'MemoryOS', at: 0.1, cls: 'acc' }], [{ t: '1.3.1', at: 0.4 }]], tl: [[{ t: 'MemoryOS', at: 0.1, cls: 'acc' }, { t: '1.3.1', at: 0.4 }]], cap: 'Studio now has History.', capAt: 0.7 } },
    open: { seg: A(S, 'history-nav', 'dashboard-shown', 8, FADE),
      b: { lines: [[{ t: 'Open a', at: 0.2 }], [{ t: 'real', at: 0.45 }], [{ t: 'export.', at: 0.7, cls: 'acc' }]], tl: [[{ t: 'Open a real', at: 0.2 }, { t: 'export.', at: 0.5, cls: 'acc' }]], cap: 'Integrity-checked inside Studio. Read-only.', capAt: 2.5 } },
    dash: { seg: A(S, 'section-source', 'row-expanded+1', 8, { cam: { from: camOn(S, [161, 577, 1855, 1080], { pad: 1.05 }), to: camOn(S, [161, 577, 1855, 1080], { pad: 1.05 }) }, ...FADE }),
      b: { lines: [[{ t: 'Counts.', at: 0.2 }], [{ t: 'Digests.', at: 0.5 }], [{ t: 'Filters.', at: 0.8, cls: 'acc' }]], tl: [[{ t: 'Counts. Digests.', at: 0.2 }], [{ t: 'Filters.', at: 0.8, cls: 'acc' }]], cap: 'Save a static snapshot. Nothing written to the history.', capAt: 2.5 } },
    cli: { seg: A(E, 'tamper-start', 'tamper-rejected+3', 8, { cam: T(E, termZ), ...FADE }),
      b: { tag: 'LIVE RUN', tagColor: GOOD, lines: [[{ t: 'Built by', at: 0.2 }], [{ t: 'the CLI.', at: 0.45 }], [{ t: 'One byte.', at: 1.2 }], [{ t: 'Caught.', at: 1.5, cls: 'bad' }]], tl: [[{ t: 'Built by the CLI.', at: 0.2 }], [{ t: 'One byte. Caught.', at: 1.2, cls: 'bad' }]], cap: 'Verification fails on a changed copy (exit 3).', capAt: 3 } },
    mcp: { seg: A(L, 'mcp-start+3', 'mcp-done', 4, { cam: T(L, termZ), ...FADE }),
      b: { tag: 'LIVE RUN', tagColor: GOOD, lines: [[{ t: 'MCP', at: 0.1, cls: 'acc' }], [{ t: 'server', at: 0.35 }]], tl: [[{ t: 'MCP', at: 0.1, cls: 'acc' }, { t: 'server', at: 0.35 }]], cap: 'MO-1304 answers real requests.', capAt: 0.8 } },
    ci: { seg: A(L, 'ci-run-done-1', 'ci-done', 4, { cam: T(L, ciZ), ...FADE }),
      b: { tag: 'LIVE RUN · SPED UP', tagColor: GOOD, lines: [[{ t: 'CI/CD', at: 0.1, cls: 'acc' }], [{ t: 'runner', at: 0.35 }]], tl: [[{ t: 'CI/CD', at: 0.1, cls: 'acc' }, { t: 'runner', at: 0.35 }]], cap: 'MO-1302/1306 real bundle, verified.', capAt: 0.8 } },
    ready: { seg: A(L, 'readiness-start+6', 'readiness-done+1', 4, { cam: T(L, ciZ), ...FADE }),
      b: { tag: 'LIVE RUN · FIXTURE INPUTS', tagColor: AMBER, lines: [[{ t: 'Readiness', at: 0.1, cls: 'acc' }]], tl: [[{ t: 'Readiness', at: 0.1, cls: 'acc' }]], cap: 'MO-1307 evaluation. Not an approval.', capAt: 0.8 } },
    snap: { seg: A(S, 'save-nav-0.5', 'save-nav+3.5', 4, FADE),
      b: { lines: [[{ t: 'Static.', at: 0.1 }], [{ t: 'Read-only.', at: 0.45, cls: 'acc' }]], tl: [[{ t: 'Static.', at: 0.1 }, { t: 'Read-only.', at: 0.45, cls: 'acc' }]], cap: 'No hosted service. No accounts.', capAt: 1 } },
    end: { seg: A(S, 'end-5', 'end', 5, { cam: { from: camCentre(S, 1.08), to: c1 }, hold: 0, ...FADE }),
      b: { hex: true, lines: [[{ t: 'MemoryOS', at: 0.2, cls: 'acc' }], [{ t: '1.3.1', at: 0.5 }]], tl: [[{ t: 'MemoryOS', at: 0.2, cls: 'acc' }, { t: '1.3.1', at: 0.5 }]], cap: URL_TEXT, capMono: true, capAt: 1.0, fine: 'Local single-user · integrity checks, not approvals' } },
  };
  const order = { 60: ['hook', 'title', 'open', 'dash', 'cli', 'mcp', 'ci', 'ready', 'snap', 'end'], 30: ['hook', 'title', 'open', 'cli', 'ci', 'end'], 15: ['hook', 'title', 'cli', 'end'] }[len];
  const dur = { 60: { hook: 4, title: 4, open: 10, dash: 10, cli: 10, mcp: 5, ci: 5, ready: 5, snap: 4, end: 4.6 }, 30: { hook: 4, title: 3, open: 7.5, cli: 5.5, ci: 6, end: 4.8 }, 15: { hook: 4, title: 3, cli: 3.4, end: 5 } }[len];
  void wide;
  return order.map((k) => { const d = dur[k]; const s = { ...base[k].seg }; s.speed = (s.to - s.from) / d; return { key: k, seg: s, dur: d, b: base[k].b }; });
}

async function build(len, ratio, { thumbOnly = false } = {}) {
  const P = PANELS[ratio];
  const name = `memoryos-1.3-ad-${len}s-${ratio}`;
  const work = ensureDir(`${WORK}/v2/${name}`);
  const frames = path.join(work, 'frames'); fs.rmSync(frames, { recursive: true, force: true }); ensureDir(frames);
  const list = storyboard(len, ratio);
  const spec = { w: P.pw, h: P.ph, fps: 30, segments: list.map((x) => x.seg) };
  const { parts, inputs, last, timeline, duration } = buildGraph(spec);
  // 1. footage frames (real recordings, camera moves over real pixels)
  const graphFile = path.join(work, 'footage.graph.txt'); fs.writeFileSync(graphFile, parts.join(';\n'));
  const fa = ['-y', '-hide_banner', '-loglevel', 'error']; for (const i of inputs) fa.push(...i);
  fa.push('-/filter_complex', graphFile, '-map', `[${last}]`, '-r', '30', '-t', String(duration), '-q:v', '2', path.join(frames, 'f%05d.jpg'));
  const fr = spawnSync('ffmpeg', fa, { encoding: 'utf8', maxBuffer: 1 << 28 });
  if (fr.status) throw new Error('footage: ' + fr.stderr);
  const count = fs.readdirSync(frames).length;
  // 2. sound bed on the beat grid (same synth, loudness and limiter as before)
  const marks = {}; list.forEach((x, i) => { marks[x.key] = timeline[i]; });
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
  const raw = path.join(work, 'raw.wav'), wav = path.join(work, 'bed.wav');
  writeWav(raw, synth(aSpec), duration + 0.3);
  const meas = spawnSync('ffmpeg', ['-hide_banner', '-i', raw, '-af', 'loudnorm=I=-14:TP=-1.5:LRA=11:print_format=json', '-f', 'null', '-'], { encoding: 'utf8' });
  const j = JSON.parse(meas.stderr.slice(meas.stderr.lastIndexOf('{'), meas.stderr.lastIndexOf('}') + 1));
  const ln = `loudnorm=I=-14:TP=-2.2:LRA=11:measured_I=${j.input_i}:measured_TP=${j.input_tp}:measured_LRA=${j.input_lra}:measured_thresh=${j.input_thresh}:offset=${j.target_offset}:linear=true,alimiter=limit=0.78:level=false,aresample=48000`;
  const ar = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', raw, '-af', ln, '-ar', '48000', '-ac', '2', wav], { encoding: 'utf8' });
  if (ar.status) throw new Error(ar.stderr);
  // 3. scene
  const beats = list.map((x, i) => ({ t0: timeline[i].start, t1: timeline[i].end, ...x.b }));
  const cfg = { W: P.W, H: P.H, frames: pathToFileURL(frames).href, count, duration, beats };
  const port = 9400 + Math.floor(Math.random() * 400);
  const edge = await launchEdge({ width: P.W, height: P.H, port });
  const t0 = Date.now();
  try {
    await edge.send('Page.setBypassCSP', { enabled: true });
    await edge.goto(pathToFileURL(path.join(here, '../scene/ad2.html')).href);
    await sleep(300);
    await edge.evaluate(`build(${JSON.stringify(cfg)})`);
    await sleep(400);
    const shot = async (t) => { await edge.evaluate(`renderAt(${t.toFixed(4)})`); const { data } = await edge.send('Page.captureScreenshot', { format: 'jpeg', quality: 94, fromSurface: true }); return Buffer.from(data, 'base64'); };
    // optional preview stills (--at t,t,...): no video
    if (process.env.AD_AT) { for (const a of process.env.AD_AT.split(',')) fs.writeFileSync(path.join(work, `at-${a}.png`), Buffer.from((await (async () => { await edge.evaluate(`renderAt(${Number(a)})`); return edge.send('Page.captureScreenshot', { format: 'png', fromSurface: true }); })()).data, 'base64')); console.log('stills in', work); return; }
    // thumbnail: the tamper rejection frame of the hook, with the brand line
    if (process.env.AD_THUMB) {
      const cfg2 = { ...cfg, cover: true, beats: beats.map((b, i) => (i === 0 ? { ...b, brand: true } : b)) };
      await edge.evaluate(`build(${JSON.stringify(cfg2)})`); await sleep(300);
      await edge.evaluate('renderAt(3.4)'); await sleep(150); await edge.evaluate('renderAt(3.4)');
      const { data } = await edge.send('Page.captureScreenshot', { format: 'png', fromSurface: true });
      fs.writeFileSync(process.env.AD_THUMB, Buffer.from(data, 'base64')); console.log('thumb', process.env.AD_THUMB); return;
    }
    ensureDir(OUT2);
    const out = `${OUT2}/${name}.mp4`;
    const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', '30', '-c:v', 'mjpeg', '-i', '-', '-i', wav,
      '-map', '0:v', '-map', '1:a', '-t', String(duration), '-c:v', 'libx264', '-profile:v', 'high', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-r', '30',
      '-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2', '-movflags', '+faststart', out], { stdio: ['pipe', 'inherit', 'inherit'] });
    const done = new Promise((res, rej) => { ff.on('exit', (c) => (c === 0 ? res() : rej(new Error('ffmpeg ' + c)))); });
    const total = Math.round(duration * 30);
    for (let f = 0; f < total; f += 1) {
      const buf = await shot(f / 30);
      if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    }
    ff.stdin.end(); await done;
    console.log(name, duration.toFixed(1), 's', ((Date.now() - t0) / 1000).toFixed(0), 's render', (fs.statSync(out).size / 1e6).toFixed(1), 'MB');
  } finally { await edge.close(); }
  if (!process.env.AD_AT && !process.env.AD_THUMB) fs.rmSync(frames, { recursive: true, force: true });
}

const [variants] = process.argv.slice(2);
for (const v of variants.split(',')) { const [len, ratio] = v.split('-'); await build(Number(len), ratio); }
