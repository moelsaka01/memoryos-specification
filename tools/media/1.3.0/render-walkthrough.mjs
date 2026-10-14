// Renders the walkthrough to a 1920x1080, 30 fps, H.264 MP4: every frame is a real Microsoft Edge screenshot (CDP, Node built-ins only).
//   node tools/media/render-walkthrough.mjs TRANSCRIPT DEMO_DIRECTORY WORK_DIRECTORY OUTPUT_MP4 [--only BEAT_ID,...]
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { launchEdge } from './lib/edge.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const scriptName = args.includes('--script') ? args[args.indexOf('--script') + 1] : 'walkthrough-script.mjs';
const { BEATS, DASH_TIMELINE } = await import(pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), scriptName)).href);
const only = args.includes('--only') ? args[args.indexOf('--only') + 1].split(',') : null;
const [transcriptFile, demo, work, output] = args.filter((a, i) => !a.startsWith('--') && args[i - 1] !== '--only' && args[i - 1] !== '--script').map((p) => path.resolve(p));
const FPS = 30;
const transcript = JSON.parse(fs.readFileSync(transcriptFile, 'utf8'));
const chromeSource = fs.readFileSync(path.join(here, 'scene/chrome.js'), 'utf8');
fs.mkdirSync(work, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function ffmpeg(argv) {
  const run = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...argv], { encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`ffmpeg failed: ${run.stderr}`);
}
function segmentFromFrames(dir, frames, name) {
  // frames: [{file, duration}] -> mp4 at 30 fps
  const lines = ['ffconcat version 1.0'];
  for (const f of frames) lines.push(`file '${f.file.replace(/\\/g, '/')}'`, `duration ${f.duration.toFixed(5)}`);
  lines.push(`file '${frames[frames.length - 1].file.replace(/\\/g, '/')}'`);
  const list = path.join(dir, `${name}.ffconcat`);
  fs.writeFileSync(list, lines.join('\n'));
  const mp4 = path.join(work, `${name}.mp4`);
  ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-vf', `fps=${FPS},format=yuv420p`, '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-profile:v', 'high', '-r', String(FPS), mp4]);
  return mp4;
}

async function renderTermBeat(edge, beat) {
  const dir = path.join(work, 'frames', beat.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const steps = beat.scene ? transcript.steps.filter((s) => beat.scene.includes(s.scene)) : [];
  const payload = { ...beat, steps };
  const duration = await edge.evaluate(`load(${JSON.stringify(payload)})`);
  const total = Math.round(duration * FPS);
  const frames = [];
  let lastSig = null;
  for (let f = 0; f < total; f += 1) {
    const { sig } = await edge.evaluate(`renderAt(${(f / FPS).toFixed(4)})`);
    if (sig !== lastSig) {
      const file = path.join(dir, `f${String(f).padStart(5, '0')}.png`);
      await edge.screenshot(file);
      frames.push({ file, start: f });
      lastSig = sig;
    } else frames[frames.length - 1].count = (frames[frames.length - 1].count || 0);
  }
  frames.forEach((fr, i) => { fr.duration = ((i + 1 < frames.length ? frames[i + 1].start : total) - fr.start) / FPS; });
  return segmentFromFrames(dir, frames, beat.id);
}

async function renderDashBeat(edge, beat) {
  const dir = path.join(work, 'frames', beat.id);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  await edge.send('Page.setBypassCSP', { enabled: true }); // the overlay (captions) is injected styling; the dashboard's own code is untouched
  await edge.goto(pathToFileURL(path.join(demo, 'dashboard.html')).href);
  await edge.evaluate(chromeSource);
  await edge.evaluate(`(() => {
    MosChrome.install(document);
    const css = document.createElement('style');
    css.textContent = '.mos-hl{outline:5px solid #f5b042 !important;outline-offset:4px;border-radius:6px} html{background:#121212}';
    document.documentElement.appendChild(css);
    document.body.style.zoom = '1.5';
    document.body.style.paddingTop = '48px';
    document.body.style.paddingBottom = '110px';
    window.scrollTo(0, 0);
  })()`);
  await sleep(400);
  await edge.evaluate(`window.__targetY = (spec) => {
    let el = null;
    if (spec.startsWith('h2=')) el = [...document.querySelectorAll('h2')].find((h) => h.textContent.trim() === spec.slice(3));
    else el = document.querySelector(spec);
    return Math.max(0, el.getBoundingClientRect().top + window.scrollY - 72 - 22);
  }`);
  const total = Math.round(DASH_TIMELINE.duration * FPS);
  const steps = DASH_TIMELINE.steps;
  let caption = '';
  let captionAt = 0;
  let scrollAnim = null;
  let hl = null;
  let hlUntil = -1;
  let fired = 0;
  const frames = [];
  let lastSig = null;
  for (let f = 0; f < total; f += 1) {
    const t = f / FPS;
    while (fired < steps.length && steps[fired].t <= t) {
      const s = steps[fired];
      fired += 1;
      if (s.caption) { caption = s.caption; captionAt = s.t; }
      if (s.scroll) {
        const from = await edge.evaluate('window.scrollY');
        const to = await edge.evaluate(`__targetY(${JSON.stringify(s.scroll.to)})`);
        scrollAnim = { t0: s.t, t1: s.t + s.scroll.dur, from, to };
      }
      if (s.clear) await edge.evaluate(`(() => { document.querySelector('[data-action=filter]:not(select):not(input)').click(); })()`);
      if (s.select) {
        await edge.evaluate(`(() => { const el = document.getElementById(${JSON.stringify(s.select.id)}); el.classList.add('mos-hl'); el.value = ${JSON.stringify(s.select.value)}; el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
        hl = s.select.id; hlUntil = s.t + 3;
      }
      if (s.expand) {
        await edge.evaluate(`(() => { const b = document.querySelector('button[data-action=expand]'); b.classList.add('mos-hl'); b.click(); })()`);
        await sleep(100);
      }
    }
    if (hl && t >= hlUntil) { await edge.evaluate(`document.getElementById(${JSON.stringify(hl)})?.classList.remove('mos-hl')`); hl = null; }
    if (scrollAnim) {
      const k = Math.min(1, Math.max(0, (t - scrollAnim.t0) / (scrollAnim.t1 - scrollAnim.t0)));
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      await edge.evaluate(`window.scrollTo(0, ${Math.round(scrollAnim.from + (scrollAnim.to - scrollAnim.from) * e)})`);
      if (k >= 1) scrollAnim = null;
    }
    const age = Math.min(1, (t - captionAt) / 0.3);
    const alpha = (1 - Math.pow(1 - Math.max(0, age), 3)).toFixed(2);
    await edge.evaluate(`MosChrome.set({ chapterCode: ${JSON.stringify(beat.chapter.code)}, chapterTitle: ${JSON.stringify(beat.chapter.title)}, current: ${JSON.stringify(beat.chapter.current)},
      caption: ${JSON.stringify(caption)}, captionAlpha: ${alpha}, captionShift: ${((1 - alpha) * 12).toFixed(1)}, note: ${JSON.stringify(beat.note)} })`);
    const state = await edge.evaluate(`[window.scrollY, document.getElementById('entries')?.innerText.length, document.querySelectorAll('.mos-hl').length].join(',')`);
    const sig = `${state}|${alpha}|${caption}`;
    if (sig !== lastSig) {
      const file = path.join(dir, `f${String(f).padStart(5, '0')}.png`);
      await edge.screenshot(file);
      frames.push({ file, start: f });
      lastSig = sig;
    }
  }
  frames.forEach((fr, i) => { fr.duration = ((i + 1 < frames.length ? frames[i + 1].start : total) - fr.start) / FPS; });
  return segmentFromFrames(dir, frames, beat.id);
}

const edge = await launchEdge({ width: 1920, height: 1080 });
console.log(`Edge ${edge.version}`);
const segments = [];
try {
  let mode = null;
  for (const beat of BEATS) {
    const wanted = !only || only.includes(beat.id);
    const mp4 = path.join(work, `${beat.id}.mp4`);
    if (!wanted) { if (fs.existsSync(mp4)) segments.push(mp4); continue; }
    const t0 = Date.now();
    if (beat.kind === 'dash') {
      segments.push(await renderDashBeat(edge, beat));
      mode = 'dash';
    } else {
      if (mode !== 'scene') { await edge.goto(pathToFileURL(path.join(here, 'scene/walkthrough.html')).href); await sleep(300); mode = 'scene'; }
      segments.push(await renderTermBeat(edge, beat));
    }
    console.log(`${beat.id}: ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  }
} finally { await edge.close(); }

const list = path.join(work, 'segments.ffconcat');
fs.writeFileSync(list, ['ffconcat version 1.0', ...segments.map((s) => `file '${s.replace(/\\/g, '/')}'`)].join('\n'));
ffmpeg(['-f', 'concat', '-safe', '0', '-i', list, '-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100', '-shortest',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-profile:v', 'high', '-pix_fmt', 'yuv420p', '-r', String(FPS), '-c:a', 'aac', '-b:a', '128k', '-ac', '2', '-movflags', '+faststart', output]);
console.log(`wrote ${output}`);
