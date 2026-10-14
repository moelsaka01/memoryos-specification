// Renders the social ad variants: every frame is a Microsoft Edge screenshot of scene/ad.html at the target size (deterministic renderAt(t)).
//   node tools/media/render-ad.mjs TRANSCRIPT_AD STILLS_DIR WORK_DIR OUT_DIR VARIANT[,VARIANT] [--audio DIR] [--frames-only] [--limit SECONDS]
// Variants: 30-16x9 | 30-1x1 | 30-4x5 | 15-1x1. Output: memoryos-1.3-ad-<30s|15s>-<ratio>.mp4 (H.264 High, yuv420p, 30 fps, AAC 128 kbps stereo, +faststart).
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchEdge } from './lib/edge.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (name) => (argv.includes(name) ? argv[argv.indexOf(name) + 1] : null);
const positional = argv.filter((a, i) => !a.startsWith('--') && !['--audio', '--limit', '--at'].includes(argv[i - 1]));
const [transcriptFile, stillsDir, work, outDir, variantList] = positional;
const audioDir = opt('--audio');
const limit = opt('--limit') ? Number(opt('--limit')) : null;
const FPS = 30;
const VARIANTS = {
  'cover-16x9': { W: 1920, H: 1080, cut: 30, cover: true, name: 'memoryos-1.3-ad-thumbnail.png' },
  'cover-1x1': { W: 1080, H: 1080, cut: 30, cover: true, name: 'memoryos-1.3-ad-thumbnail-1x1.png' },
  '30-16x9': { W: 1920, H: 1080, cut: 30, name: 'memoryos-1.3-ad-30s-16x9.mp4' },
  '30-1x1': { W: 1080, H: 1080, cut: 30, name: 'memoryos-1.3-ad-30s-1x1.mp4' },
  '30-4x5': { W: 1080, H: 1350, cut: 30, name: 'memoryos-1.3-ad-30s-4x5.mp4' },
  '15-1x1': { W: 1080, H: 1080, cut: 15, name: 'memoryos-1.3-ad-15s-1x1.mp4' },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
fs.mkdirSync(outDir, { recursive: true });

const steps = JSON.parse(fs.readFileSync(transcriptFile, 'utf8')).steps;
const lines = (text, prefixes, err) => text.split('\n').filter((l) => prefixes.some((p) => l.startsWith(p))).map((l) => [l, err]);
const ad = steps.filter((s) => s.scene === 'ad');
const tamper = steps.filter((s) => s.scene === 'tamper');
const DATA = {
  hook: [
    { display: tamper[0].display, lines: lines(tamper[0].stdout, ['changed'], false), exit: tamper[0].exit },
    { display: tamper[1].display, lines: lines(tamper[1].stderr, ['code:', 'exitCode:', 'historyCode:'], true), exit: tamper[1].exit },
  ],
  ledger: [
    { display: ad[0].display, lines: [], exit: ad[0].exit },
    ...ad.slice(1, 5).map((s) => ({ display: s.display, lines: lines(s.stdout, ['index:'], false), exit: s.exit })),
    { display: ad[5].display, lines: lines(ad[5].stdout, ['entryCount:', 'retainedRecords:', 'purgedRecords:'], false), exit: ad[5].exit },
  ],
  query: [
    { display: ad[6].display, lines: lines(ad[6].stdout, ['entryCount:', 'nextIndex:'], false), exit: ad[6].exit },
    { display: ad[7].display, lines: lines(ad[7].stdout, ['entryCount:'], false), exit: ad[7].exit },
  ],
  stills: { top: pathToFileURL(path.join(stillsDir, 'dash-top.png')).href, filtered: pathToFileURL(path.join(stillsDir, 'dash-filtered.png')).href },
};

function ffmpeg(args) {
  const run = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`ffmpeg failed: ${run.stderr}`);
}

for (const key of variantList.split(',')) {
  const v = VARIANTS[key];
  if (!v) throw new Error(`unknown variant ${key}`);
  const frames = path.resolve(work, key);
  fs.rmSync(frames, { recursive: true, force: true });
  fs.mkdirSync(frames, { recursive: true });
  const edge = await launchEdge({ width: v.W, height: v.H });
  const t0 = Date.now();
  try {
    await edge.send('Page.setBypassCSP', { enabled: true });
    await edge.goto(pathToFileURL(path.join(here, 'scene/ad.html')).href);
    await sleep(300);
    const duration = await edge.evaluate(`build(${JSON.stringify({ W: v.W, H: v.H, cut: v.cut, cover: !!v.cover, data: DATA })})`);
    await sleep(500); // let the stills decode
    if (v.cover) {
      await edge.evaluate('renderAt(3.0)');
      await edge.screenshot(path.join(outDir, v.name));
      console.log('wrote ' + path.join(outDir, v.name));
      continue;
    }
    if (opt('--at')) {
      const dir = path.join(work, `${key}-at`);
      fs.mkdirSync(dir, { recursive: true });
      for (const at of opt('--at').split(',')) { await edge.evaluate(`renderAt(${Number(at)})`); await edge.screenshot(path.join(dir, `t${at}.png`)); }
      continue;
    }
    const total = Math.round((limit ?? duration) * FPS);
    for (let f = 0; f < total; f += 1) {
      await edge.evaluate(`renderAt(${(f / FPS).toFixed(4)})`);
      await edge.screenshot(path.join(frames, `f${String(f).padStart(5, '0')}.png`));
    }
  } finally { await edge.close(); }
  if (opt('--at') || v.cover) continue;
  console.log(`${key}: ${((Date.now() - t0) / 1000).toFixed(0)} s of rendering`);
  if (argv.includes('--frames-only')) continue;
  const audio = audioDir ? path.join(audioDir, `ad-${v.cut}s.wav`) : null;
  const out = path.join(outDir, v.name);
  ffmpeg(['-framerate', String(FPS), '-i', path.join(frames, 'f%05d.png'),
    ...(audio ? ['-i', audio] : ['-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100']),
    '-t', String(limit ?? v.cut), '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-profile:v', 'high', '-level', '4.2', '-pix_fmt', 'yuv420p', '-r', String(FPS),
    '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-ar', '44100', '-shortest', '-movflags', '+faststart', out]);
  console.log(`wrote ${out}`);
}
