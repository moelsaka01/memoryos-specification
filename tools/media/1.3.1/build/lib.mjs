// Shared helpers for the edit scripts (build-gif.mjs, build-demo.mjs, build-ad.mjs).
import fs from 'node:fs';
import { loadTake } from '../lib/marks.mjs';
import { RAW, source } from '../lib/render.mjs';

export const OUT = 'C:/mos-media/out-1.3.1';
export const WORK = 'C:/mos-media/work131';

const cache = new Map();
export function take(tag) {
  if (!cache.has(tag)) cache.set(tag, { ...loadTake(`${RAW}/${tag}.mkv`, `${RAW}/${tag}.marks.json`), tag, src: source(tag) });
  return cache.get(tag);
}

// "mark" | "mark+1.5" | "mark#2-0.4" | 12.5  ->  seconds in the take's own timeline
export function at(tag, ref) {
  if (typeof ref === 'number') return ref;
  const m = /^(.+?)(?:#(\d+))?([+-]\d+(?:\.\d+)?)?$/.exec(ref);
  if (!m) throw new Error(`bad mark reference ${ref}`);
  return take(tag).at(m[1], m[2] ? Number(m[2]) : 0) + (m[3] ? Number(m[3]) : 0);
}
// extra data stored with a mark (for example screen rectangles)
export function extra(tag, name, occurrence = 0) {
  const hits = take(tag).list.filter((m) => m.name === name);
  return hits[occurrence];
}

// segment from one point of a take to another; `opts` = { speed, cam, hold, trans, shake, fadeIn, fadeOut }
export function seg(tag, from, to, opts = {}) {
  return { clip: tag, from: at(tag, from), to: at(tag, to), ...opts };
}

// the same, but the range is played in exactly `outDur` seconds (the speed is derived: > 1 is faster than real time)
export function fit(tag, from, to, outDur, opts = {}) {
  const a = at(tag, from), b = at(tag, to);
  return { clip: tag, from: a, to: b, speed: (b - a) / outDur, ...opts };
}

// camera presets, in source pixels
export function camOn(tag, rect, { pad = 1.0, z = null } = {}) {
  const { w, h } = take(tag).src;
  const [x0, y0, x1, y1] = rect;
  const zoom = z ?? Math.max(1, Math.min(w / ((x1 - x0) * pad), h / ((y1 - y0) * pad)));
  return { cx: (x0 + x1) / 2, cy: (y0 + y1) / 2, z: zoom };
}
export function camCentre(tag, z = 1, fx = 0.5, fy = 0.5) {
  const { w, h } = take(tag).src;
  return { cx: w * fx, cy: h * fy, z };
}

// snap a time (seconds) to the beat grid
export const beatSnap = (t, bpm = 120) => Math.round(t / (60 / bpm)) * (60 / bpm);

export function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); return dir; }
