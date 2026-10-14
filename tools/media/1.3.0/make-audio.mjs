// Self-generated sound bed for the ad (no samples, no third-party audio): a soft pad, low hits on the cuts and short ticks on text beats.
//   node tools/media/make-audio.mjs OUT_DIRECTORY   -> ad-30s.wav, ad-15s.wav (44.1 kHz, 16-bit stereo)
import fs from 'node:fs';
import path from 'node:path';

const SR = 44100;
const out = process.argv[2];
fs.mkdirSync(out, { recursive: true });
const SPEC = {
  30: { dur: 30, cuts: [3.1, 6.1, 11.4, 15.9, 23.0, 27.0], ticks: [0.1, 0.35, 0.6, 1.55, 1.8, 6.3, 7.45, 8.6, 11.6, 13.0, 16.1, 17.3, 23.3, 23.66, 24.02, 24.38, 24.74, 25.1, 25.46, 25.82, 26.18, 27.15, 27.35, 28.2], error: 2.15, riser: [24.5, 27.0] },
  15: { dur: 15, cuts: [3.0, 5.2, 8.7, 12.0], ticks: [0.1, 0.35, 0.6, 1.55, 1.8, 5.4, 6.0, 6.8, 9.0, 12.15, 12.35, 13.2], error: 2.15, riser: [10.0, 12.0] },
};
const rng = (() => { let s = 0x9e3779b9; return () => { s ^= s << 13; s ^= s >>> 17; s ^= s << 5; return ((s >>> 0) / 4294967296) * 2 - 1; }; })();

for (const [key, spec] of Object.entries(SPEC)) {
  const n = Math.round(spec.dur * SR);
  const L = new Float32Array(n);
  const R = new Float32Array(n);
  const add = (i, l, r) => { L[i] += l; R[i] += r; };
  // pad: A minor add9, slow tremolo, gentle swell
  const notes = [110, 164.81, 261.63, 329.63, 493.88];
  for (let i = 0; i < n; i += 1) {
    const t = i / SR;
    let s = 0;
    notes.forEach((f, k) => { s += Math.sin(2 * Math.PI * f * t + k) * (0.5 + 0.5 * Math.sin(2 * Math.PI * (0.07 + 0.013 * k) * t + k)) * (k === 0 ? 0.9 : 0.4); });
    const env = Math.min(1, t / 1.2) * Math.min(1, (spec.dur - t) / 1.2);
    add(i, s * 0.05 * env, s * 0.05 * env * (0.9 + 0.1 * Math.sin(t)));
  }
  // low hits on cuts, a dissonant hit on the failure
  const hit = (t0, freq, amp, decay) => {
    for (let i = Math.round(t0 * SR); i < Math.min(n, Math.round((t0 + decay * 5) * SR)); i += 1) {
      const t = i / SR - t0;
      const e = Math.exp(-t / decay);
      const v = Math.sin(2 * Math.PI * (freq + 40 * Math.exp(-t * 18)) * t) * e * amp;
      add(i, v, v);
    }
  };
  spec.cuts.forEach((c) => hit(c, 55, 0.32, 0.18));
  hit(0.05, 48, 0.4, 0.22);
  hit(spec.error, 62, 0.34, 0.3);
  hit(spec.error, 65.4, 0.2, 0.3);
  // ticks: short filtered noise clicks
  for (const t0 of spec.ticks) {
    let lp = 0;
    for (let i = Math.round(t0 * SR); i < Math.min(n, Math.round((t0 + 0.05) * SR)); i += 1) {
      const t = i / SR - t0;
      const x = rng();
      lp += 0.35 * (x - lp);
      const v = (x - lp) * Math.exp(-t / 0.008) * 0.12;
      add(i, v * 0.9, v);
    }
  }
  // riser before the closing card
  const [r0, r1] = spec.riser;
  let lp = 0;
  for (let i = Math.round(r0 * SR); i < Math.min(n, Math.round(r1 * SR)); i += 1) {
    const k = (i / SR - r0) / (r1 - r0);
    const x = rng();
    lp += (0.02 + 0.5 * k * k) * (x - lp);
    const v = lp * 0.5 * k * k;
    add(i, v, v);
  }
  // normalise to -3 dBFS, fade the tail
  let peak = 0;
  for (let i = 0; i < n; i += 1) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
  const g = 0.7 / peak;
  const buf = Buffer.alloc(44 + n * 4);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + n * 4, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(2, 22);
  buf.writeUInt32LE(SR, 24); buf.writeUInt32LE(SR * 4, 28); buf.writeUInt16LE(4, 32); buf.writeUInt16LE(16, 34); buf.write('data', 36); buf.writeUInt32LE(n * 4, 40);
  for (let i = 0; i < n; i += 1) {
    const fade = Math.min(1, (n - i) / (SR * 0.6));
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[i] * g * fade)) * 32767), 44 + i * 4);
    buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[i] * g * fade)) * 32767), 46 + i * 4);
  }
  fs.writeFileSync(path.join(out, `ad-${key}s.wav`), buf);
  console.log(`wrote ad-${key}s.wav (${(buf.length / 1e6).toFixed(1)} MB)`);
}
