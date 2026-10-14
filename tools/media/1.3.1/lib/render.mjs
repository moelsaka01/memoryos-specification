// Edit engine for the 1.3.1 release media. An edit is a list of SEGMENTS cut from the raw takes (real recordings), each with an optional camera move
// (a smooth crop/zoom over the real pixels), a speed, a hold and a transition into the next one. The engine writes one FFmpeg filter graph, burns
// an ASS caption file over it (captions and kinetic text only, never full-screen slides), adds a sound bed if given, and encodes.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

export const RAW = 'C:/mos-media/work131/raw';
export const FONTS = 'fonts';   // a junction named fonts next to the ass file points at the Windows fonts folder (no colon to escape)
const num = (n) => Number(n.toFixed(4));
const easeExpr = (u) => `(${u}*${u}*(3-2*${u}))`;   // smoothstep

// ---- sources: a raw take plus its size ----
const sizeOf = {};
export function source(tag) {
  const file = `${RAW}/${tag}.mkv`;
  if (!sizeOf[tag]) {
    const r = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'json', file], { encoding: 'utf8' });
    const s = JSON.parse(r.stdout).streams[0];
    sizeOf[tag] = { w: s.width, h: s.height };
  }
  return { tag, file, ...sizeOf[tag] };
}

// Camera: from/to = { cx, cy, z } in SOURCE pixels (cx, cy = the centre of the visible window, z = extra zoom on top of the fit to the output).
// A missing camera shows the whole source scaled to the output.
function cameraFilter(seg, src, W, H, dur) {
  const base = Math.max(W / src.w, H / src.h);              // cover: the source fills the output window at zoom 1
  const a = seg.cam?.from ?? { cx: src.w / 2, cy: src.h / 2, z: 1 };
  const b = seg.cam?.to ?? a;
  const moving = JSON.stringify(a) !== JSON.stringify(b) || (seg.shake?.length ?? 0) > 0;
  if (!moving) {
    const z = base * a.z;
    if (z === 1 && W === src.w && H === src.h) return '';
    const cw = W / z, ch = H / z;
    const x = Math.max(0, Math.min(src.w - cw, a.cx - cw / 2)), y = Math.max(0, Math.min(src.h - ch, a.cy - ch / 2));
    return `crop=${num(cw)}:${num(ch)}:${num(x)}:${num(y)},scale=${W}:${H}:flags=lanczos`;
  }
  const u = `min(1,max(0,t/${num(dur)}))`;
  const e = easeExpr(u);
  const lerp = (p, q) => `(${num(p)}+(${num(q)}-${num(p)})*${e})`;
  const z = `(${num(base)}*${lerp(a.z, b.z)})`;
  let cx = `(${lerp(a.cx, b.cx)}*${z})`, cy = `(${lerp(a.cy, b.cy)}*${z})`;
  for (const s of seg.shake ?? []) {
    const k = `if(gte(t,${num(s.t)}),${num(s.amp)}*exp(-(t-${num(s.t)})*11)*sin(70*(t-${num(s.t)})),0)`;
    cx += `+${k}`; cy += `+0.6*${k}`;
  }
  // scale per frame, then take a W x H window around the centre (kept inside the picture)
  return `scale=w='ceil(${src.w}*${z}/2)*2':h='ceil(${src.h}*${z}/2)*2':eval=frame:flags=bicubic,`
    + `crop=${W}:${H}:x='max(0,min(in_w-${W},(${cx})-${W}/2))':y='max(0,min(in_h-${H},(${cy})-${H}/2))'`;
}

// segments -> { graph, inputs, timeline } ; timeline[i] = { start, end } on the OUTPUT clock
export function buildGraph(spec) {
  const { w: W, h: H, fps = 30, segments } = spec;
  const inputs = [];
  const parts = [];
  const timeline = [];
  let clock = 0;
  segments.forEach((seg, i) => {
    const src = source(seg.clip);
    const speed = seg.speed ?? 1;
    const srcDur = seg.to - seg.from;
    const outDur = srcDur / speed + (seg.hold ?? 0);
    inputs.push(['-ss', String(Math.max(0, seg.from - 0.05)), '-t', String(srcDur + 0.3), '-i', src.file]);
    const contain = seg.contain ?? spec.contain ?? false;
    const fh = contain ? Math.round(W * 9 / 16 / 2) * 2 : H;
    const cam = cameraFilter(seg, src, W, fh, outDur);
    const chain = [
      `trim=start=0.05:end=${num(srcDur + 0.05)}`,   // (the 0.05 s lead-in absorbs the seek granularity)
      'setpts=PTS-STARTPTS',
      ...(speed !== 1 ? [`setpts=PTS/${speed}`] : []),
      `fps=${fps}`,
      ...(seg.hold ? [`tpad=stop_mode=clone:stop_duration=${num(seg.hold)}`] : []),
      ...(contain ? [] : [...(cam ? [cam] : []), ...(!cam && W !== src.w ? [`scale=${W}:${H}:flags=lanczos`] : [])]),
      ...(seg.fadeIn ? [`fade=t=in:st=0:d=${seg.fadeIn}`] : []),
      ...(seg.fadeOut ? [`fade=t=out:st=${num(outDur - seg.fadeOut)}:d=${seg.fadeOut}`] : []),
      'format=yuv420p', 'setsar=1',
    ];
    if (contain) {
      const pre = chain.slice(0, chain.indexOf('format=yuv420p')).join(',');
      const post = chain.slice(chain.indexOf('format=yuv420p')).join(',');
      parts.push(`[${i}:v]${pre},split[b${i}][f${i}]`);
      parts.push(`[b${i}]scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H},gblur=sigma=28,eq=brightness=-0.22:saturation=0.8[bg${i}]`);
      parts.push(`[f${i}]${cam || `scale=${W}:${fh}:flags=lanczos`}[fg${i}]`);
      parts.push(`[bg${i}][fg${i}]overlay=0:${Math.round((H - fh) / 2)},${post}[s${i}]`);
    } else parts.push(`[${i}:v]${chain.join(',')}[s${i}]`);
    const overlap = i > 0 ? (segments[i - 1].trans?.dur ?? 0) : 0;
    const start = clock - overlap;
    timeline.push({ start: num(start), end: num(start + outDur), outDur: num(outDur) });
    clock = start + outDur;
  });
  // chain them: hard cut = concat, transition = xfade
  let current = 's0';
  let length = timeline[0].outDur;
  for (let i = 1; i < segments.length; i++) {
    const t = segments[i - 1].trans;
    const label = `m${i}`;
    if (t && t.dur > 0) {
      parts.push(`[${current}][s${i}]xfade=transition=${t.type ?? 'fade'}:duration=${t.dur}:offset=${num(length - t.dur)}[${label}]`);
      length = length - t.dur + timeline[i].outDur;
    } else {
      parts.push(`[${current}][s${i}]concat=n=2:v=1:a=0,fps=${spec.fps ?? 30},settb=1/${spec.fps ?? 30}[${label}]`);
      length += timeline[i].outDur;
    }
    current = label;
  }
  return { parts, inputs, timeline, last: current, duration: num(length) };
}

export function render({ spec, out, assFile = null, audio = null, crf = 17, preset = 'slow', workDir, name }) {
  fs.mkdirSync(workDir, { recursive: true });
  const { parts, inputs, last, timeline, duration } = buildGraph(spec);
  let final = last;
  if (assFile) {
    parts.push(`[${last}]ass=${path.basename(assFile)}:fontsdir=${FONTS}[vout]`);
    final = 'vout';
  }
  if (assFile) { const link = path.join(path.dirname(assFile), 'fonts'); if (!fs.existsSync(link)) fs.symlinkSync('C:/Windows/Fonts', link, 'junction'); }
  const graphFile = path.join(workDir, `${name}.graph.txt`);
  fs.writeFileSync(graphFile, parts.join(';\n'));
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-stats'];
  for (const input of inputs) args.push(...input);
  if (audio) args.push('-i', audio);
  args.push('-/filter_complex', graphFile, '-map', `[${final}]`);
  if (audio) args.push('-map', `${inputs.length}:a`);
  args.push('-r', String(spec.fps ?? 30), '-c:v', 'libx264', '-profile:v', 'high', '-preset', preset, '-crf', String(crf), '-pix_fmt', 'yuv420p', '-t', String(duration));
  if (audio) args.push('-c:a', 'aac', '-b:a', '128k', '-ar', '48000', '-ac', '2');
  args.push('-movflags', '+faststart', out);
  const run = spawnSync('ffmpeg', args, { cwd: assFile ? path.dirname(assFile) : workDir, encoding: 'utf8', maxBuffer: 1 << 28 });
  if (run.status !== 0) throw new Error(`ffmpeg failed (${run.status}):\n${run.stderr}\n--- graph:\n${parts.join('\n')}`);
  return { duration, timeline, out };
}
