// MemoryOS 1.3.1 release media: the sound bed of the ads, synthesised from nothing (sine, saw, square and noise oscillators, filters and
// envelopes written in this file). No samples, no recordings, no third-party music. The track is built on a beat grid so that the picture cuts
// (which the edit snaps to beats) land on kicks, and it has risers into key moments, a stop-time gap and a hit on the tamper failure and on the end frame.
//   node tools/media/make-audio.mjs SPEC.json OUT.wav
//   SPEC: { duration, bpm, hits: [{ t, kind: "impact" | "tamper" | "end" }], risers: [{ t0, t1 }], cuts: [t...], sections: [{ t0, t1, layers: [...] }], gaps: [{ t0, t1 }] }
//   layers: "kick" "hat" "clap" "bass" "arp" "pad" "tick"
import fs from 'node:fs';

const SR = 48000;
const TAU = Math.PI * 2;

function prng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const rand = prng(20261013);
const noise = () => rand() * 2 - 1;
const hz = (note) => 440 * 2 ** ((note - 69) / 12);

// ---- a stereo buffer and a way to mix mono voices into it ----
function makeBuffer(seconds) { const n = Math.ceil(seconds * SR); return { n, L: new Float32Array(n), R: new Float32Array(n) }; }
function mixIn(buf, startSeconds, voice, gain = 1, pan = 0) {
  const start = Math.round(startSeconds * SR);
  const gl = gain * Math.cos((pan + 1) * Math.PI / 4), gr = gain * Math.sin((pan + 1) * Math.PI / 4);
  for (let i = 0; i < voice.length; i++) {
    const k = start + i;
    if (k < 0 || k >= buf.n) continue;
    buf.L[k] += voice[i] * gl; buf.R[k] += voice[i] * gr;
  }
}

// ---- filters ----
function lowpass(x, cutoff) { const out = new Float32Array(x.length); const a = 1 - Math.exp(-TAU * cutoff / SR); let y = 0; for (let i = 0; i < x.length; i++) { y += a * (x[i] - y); out[i] = y; } return out; }
function highpass(x, cutoff) { const lp = lowpass(x, cutoff); const out = new Float32Array(x.length); for (let i = 0; i < x.length; i++) out[i] = x[i] - lp[i]; return out; }
// state-variable band-pass whose centre frequency may change per sample (for the risers)
function sweptBandpass(x, centreAt, q = 4) {
  const out = new Float32Array(x.length); let low = 0, band = 0;
  for (let i = 0; i < x.length; i++) {
    const f = 2 * Math.sin(Math.PI * Math.min(0.45, centreAt(i / x.length) / SR));
    low += f * band; const high = x[i] - low - band / q; band += f * high; out[i] = band;
  }
  return out;
}
const env = (t, attack, decay) => (t < attack ? t / attack : Math.exp(-(t - attack) / decay));

// ---- voices ----
function kick(len = 0.5) {
  const n = Math.round(len * SR), out = new Float32Array(n); let phase = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const f = 42 + 140 * Math.exp(-t * 28);
    phase += TAU * f / SR;
    out[i] = (Math.sin(phase) * Math.exp(-t * 6.5) + (t < 0.004 ? noise() * 0.45 : 0)) * (t < 0.0015 ? t / 0.0015 : 1);
  }
  return out;
}
function bassNote(freq, len, drive = 2.2) {
  const n = Math.round(len * SR), out = new Float32Array(n); let p1 = 0, p2 = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; p1 += TAU * freq / SR; p2 += TAU * freq * 1.005 / SR;
    const saw = ((p1 / TAU) % 1) * 2 - 1, saw2 = ((p2 / TAU) % 1) * 2 - 1;
    const v = Math.tanh((Math.sin(p1) * 0.8 + (saw + saw2) * 0.25) * drive);
    out[i] = v * env(t, 0.004, Math.min(0.5, len * 0.8)) * Math.min(1, (len - t) / 0.03);
  }
  return lowpass(out, 520);
}
function hat(open = false) {
  const len = open ? 0.22 : 0.05, n = Math.round(len * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = noise() * Math.exp(-(i / SR) / (open ? 0.07 : 0.012));
  return highpass(out, 7000);
}
function clap() {
  const n = Math.round(0.28 * SR), out = new Float32Array(n);
  for (let i = 0; i < n; i++) { const t = i / SR; out[i] = noise() * (Math.exp(-t / 0.09) + 0.8 * [0, 0.011, 0.023].reduce((s, d) => s + (t > d ? Math.exp(-(t - d) / 0.012) : 0), 0) * 0.35); }
  const bp = sweptBandpass(out, () => 1800, 1.4);
  return bp.map((v, i) => v * 3.2 * (i < 12 ? i / 12 : 1));
}
function pluck(freq, len) {
  const n = Math.round(len * SR), out = new Float32Array(n); let p = 0, q = 0;
  for (let i = 0; i < n; i++) {
    const t = i / SR; p += TAU * freq / SR; q += TAU * freq * 1.004 / SR;
    const sq = Math.sign(Math.sin(p)) * 0.5 + (((q / TAU) % 1) * 2 - 1) * 0.5;
    out[i] = sq * env(t, 0.002, 0.07);
  }
  return lowpass(out, 2600 + 2200 * 1);
}
function padChord(freqs, len) {
  const n = Math.round(len * SR), out = new Float32Array(n);
  for (const f of freqs) {
    for (const detune of [-0.006, 0, 0.006]) {
      let p = rand() * TAU; const step = TAU * f * (1 + detune) / SR;
      for (let i = 0; i < n; i++) { p += step; out[i] += (((p / TAU) % 1) * 2 - 1) * 0.12; }
    }
  }
  const a = Math.round(0.12 * SR), r = Math.round(0.25 * SR);
  for (let i = 0; i < n; i++) out[i] *= Math.min(1, i / a) * Math.min(1, (n - i) / r);
  return lowpass(out, 1500);
}
function riser(len) {
  const n = Math.round(len * SR), x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = noise();
  const swept = sweptBandpass(x, (u) => 250 + 9500 * u * u, 2.5);
  const tone = new Float32Array(n); let p = 0;
  for (let i = 0; i < n; i++) { const u = i / n; p += TAU * (110 * 2 ** (u * 4)) / SR; tone[i] = Math.sin(p) * 0.25 * u; }
  return swept.map((v, i) => (v * 1.6 + tone[i]) * (i / n) ** 1.7);
}
function impact(len = 2.4) {
  const n = Math.round(len * SR), out = new Float32Array(n); let p = 0;
  const burst = new Float32Array(n);
  for (let i = 0; i < n; i++) burst[i] = noise() * Math.exp(-(i / SR) / 0.35);
  const body = lowpass(burst, 900);
  for (let i = 0; i < n; i++) {
    const t = i / SR; const f = 34 + 90 * Math.exp(-t * 7); p += TAU * f / SR;
    out[i] = Math.sin(p) * Math.exp(-t / 0.95) * 1.2 + body[i] * 0.55 * Math.exp(-t / 0.4);
  }
  return out;
}
function whoosh(len = 0.3) {
  const n = Math.round(len * SR), x = new Float32Array(n);
  for (let i = 0; i < n; i++) x[i] = noise();
  return sweptBandpass(x, (u) => 400 + 6500 * (1 - u) ** 1.5, 1.8).map((v, i) => v * Math.sin(Math.PI * i / n) * 1.2);
}
// the "failure" glitch: a short tone stuttered, bit-reduced and pitched down
function glitch() {
  const slice = Math.round(0.045 * SR), n = slice * 8, out = new Float32Array(n); let p = 0;
  const src = new Float32Array(slice);
  for (let i = 0; i < slice; i++) { p += TAU * 330 / SR; src[i] = (Math.sign(Math.sin(p)) * 0.5 + Math.sin(p * 2) * 0.3) * Math.sin(Math.PI * i / slice); }
  for (let s = 0; s < 8; s++) {
    const rate = 1 - s * 0.07;
    for (let i = 0; i < slice; i++) { const v = src[Math.floor(i * rate) % slice]; out[s * slice + i] = Math.round(v * (6 - s * 0.5)) / (6 - s * 0.5) * (1 - s * 0.08); }
  }
  return out;
}

// ---- the track ----
const PROGRESSION = [[33, 45], [29, 41], [36, 48], [31, 43]]; // A, F, C, G (MIDI note of the bass root, an octave higher for the pad)
const CHORDS = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]];

export function render(spec) {
  const buf = makeBuffer(spec.duration + 2.5);
  const beat = 60 / spec.bpm, bar = beat * 4;
  const kicks = [];
  const active = (t, layer) => (spec.sections ?? []).some((s) => t >= s.t0 - 1e-9 && t < s.t1 - 1e-9 && s.layers.includes(layer));
  const gap = (t) => (spec.gaps ?? []).some((g) => t >= g.t0 && t < g.t1);
  const k = kick(), c = clap(), ho = hat(true), hc = hat(false);

  for (let step = 0; step * beat < spec.duration; step++) {
    const t = step * beat;
    if (gap(t)) continue;
    if (active(t, 'kick')) { mixIn(buf, t, k, 1.0); kicks.push(t); }
    if (active(t, 'clap') && step % 2 === 1) mixIn(buf, t, c, 0.5, 0.05);
  }
  // eighths and sixteenths
  for (let s = 0; s * beat / 4 < spec.duration; s++) {
    const t = s * beat / 4; const g16 = s % 4, bars = Math.floor(t / bar), chord = bars % 4;
    if (gap(t)) continue;
    if (active(t, 'hat')) { if (g16 === 2) mixIn(buf, t, ((s / 4) | 0) % 8 === 7 ? ho : hc, 0.32, 0.25); else if (g16 % 2 === 1 && active(t, 'arp')) mixIn(buf, t, hc, 0.16, -0.25); }
    if (active(t, 'bass') && (g16 === 2 || g16 === 0 && s % 8 === 4)) mixIn(buf, t, bassNote(hz(PROGRESSION[chord][0]), beat * (g16 === 2 ? 0.46 : 0.9)), 0.62);
    if (active(t, 'arp')) {
      const scale = [0, 3, 5, 7, 10, 12, 15, 12];
      const note = CHORDS[chord][0] + 12 + scale[(s + chord) % 8];
      mixIn(buf, t, pluck(hz(note), beat * 0.45), 0.2, ((s % 8) - 3.5) / 8);
    }
  }
  // pad: one chord per bar where active
  for (let b = 0; b * bar < spec.duration; b++) {
    const t = b * bar;
    if (active(t, 'pad') && !gap(t)) mixIn(buf, t, padChord(CHORDS[b % 4].map(hz), bar * 1.05), 0.26, 0);
  }
  // ticks and whooshes on picture cuts
  for (const cut of spec.cuts ?? []) {
    if (active(cut, 'tick')) { mixIn(buf, cut - 0.22, whoosh(0.26), 0.3, 0.1); mixIn(buf, cut, hat(true), 0.4, -0.1); }
  }
  // risers into key moments
  for (const r of spec.risers ?? []) mixIn(buf, r.t0, riser(r.t1 - r.t0), 0.55, 0);
  // hits
  for (const h of spec.hits ?? []) {
    mixIn(buf, h.t, impact(h.kind === 'end' ? 3.2 : 2.4), h.kind === 'end' ? 0.95 : 0.85, 0);
    if (h.kind === 'tamper') { mixIn(buf, h.t + 0.02, glitch(), 0.6, 0.15); mixIn(buf, h.t + 0.4, glitch(), 0.3, -0.2); }
    mixIn(buf, h.t, k, 0.9);
  }

  // sidechain duck (bass, pad, arp ride under every kick): applied on a copy of the music, not on the drums, by a simple envelope on the whole bed
  const duck = new Float32Array(buf.n).fill(1);
  for (const t of kicks) { const s = Math.round(t * SR); for (let i = 0; i < Math.round(0.2 * SR) && s + i < buf.n; i++) duck[s + i] = Math.min(duck[s + i], 0.72 + 0.28 * (1 - Math.exp(-i / SR / 0.07))); }
  for (let i = 0; i < buf.n; i++) { buf.L[i] *= duck[i]; buf.R[i] *= duck[i]; }

  // master: soft clip, then a gentle bus lift (the final loudness is set later by FFmpeg loudnorm)
  let peak = 0;
  for (let i = 0; i < buf.n; i++) { buf.L[i] = Math.tanh(buf.L[i] * 1.25); buf.R[i] = Math.tanh(buf.R[i] * 1.25); peak = Math.max(peak, Math.abs(buf.L[i]), Math.abs(buf.R[i])); }
  const scale = 0.89 / Math.max(peak, 1e-6);
  for (let i = 0; i < buf.n; i++) { buf.L[i] *= scale; buf.R[i] *= scale; }
  return buf;
}

export function writeWav(file, buf, seconds) {
  const n = Math.min(buf.n, Math.round(seconds * SR));
  const data = Buffer.alloc(n * 4);
  for (let i = 0; i < n; i++) {
    // a 12 ms fade in/out at the very ends avoids clicks
    const f = Math.min(1, i / (SR * 0.012), (n - i) / (SR * 0.04));
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(buf.L[i] * f * 32767))), i * 4);
    data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(buf.R[i] * f * 32767))), i * 4 + 2);
  }
  const header = Buffer.alloc(44);
  header.write('RIFF', 0); header.writeUInt32LE(36 + data.length, 4); header.write('WAVEfmt ', 8); header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20); header.writeUInt16LE(2, 22); header.writeUInt32LE(SR, 24); header.writeUInt32LE(SR * 4, 28); header.writeUInt16LE(4, 32); header.writeUInt16LE(16, 34);
  header.write('data', 36); header.writeUInt32LE(data.length, 40);
  fs.writeFileSync(file, Buffer.concat([header, data]));
}

if (process.argv[1] && process.argv[1].endsWith('make-audio.mjs')) {
  const [specFile, out] = process.argv.slice(2);
  const spec = JSON.parse(fs.readFileSync(specFile, 'utf8'));
  writeWav(out, render(spec), spec.duration + 1.2);
  console.log(`wrote ${out} (${spec.duration} s + tail, ${spec.bpm} BPM)`);
}
