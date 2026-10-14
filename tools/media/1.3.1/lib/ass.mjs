// Caption and kinetic-text builder (Advanced SubStation Alpha). Text is only ever drawn OVER real footage by FFmpeg's `ass` filter; nothing here makes a slide.
// PlayRes equals the output size, so every coordinate is an output pixel.

export const rgb = (hex, alpha = 0) => { const n = parseInt(hex.replace('#', ''), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return `&H${alpha.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${r.toString(16).padStart(2, '0')}&`.toUpperCase(); };
export const COLOR = { white: '#FFFFFF', ink: '#0A0F1A', accent: '#58A6FF', cyan: '#4CD1E8', good: '#3DDC97', bad: '#FF6B6B', amber: '#FFC857', mute: '#B8C4D6' };

const stamp = (t) => {
  const cs = Math.max(0, Math.round(t * 100));
  const h = Math.floor(cs / 360000), m = Math.floor((cs % 360000) / 6000), s = Math.floor((cs % 6000) / 100), c = cs % 100;
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(c).padStart(2, '0')}`;
};
const ms = (n) => Math.round(n * 1000);
const esc = (text) => text.replaceAll('\\', '\\\\').replaceAll('{', '(').replaceAll('}', ')');

export class AssDoc {
  constructor({ w, h }) {
    this.w = w; this.h = h; this.styles = []; this.events = [];
    const base = Math.round(h * 0.036);
    this.style({ name: 'Cap', font: 'Segoe UI Semibold', size: base, primary: rgb('#FFFFFF'), outline: rgb('#0A0F1A', 40), border: 3, outlineW: Math.round(base * 0.34), shadow: 0, align: 2 });
    this.style({ name: 'Hero', font: 'Segoe UI Black', size: Math.round(h * 0.09), primary: rgb('#FFFFFF'), outline: rgb('#0A0F1A', 0), border: 1, outlineW: 0, shadow: 0, align: 5 });
    this.style({ name: 'Mono', font: 'Cascadia Mono SemiBold', size: Math.round(h * 0.026), primary: rgb('#FFFFFF'), outline: rgb('#0A0F1A', 0), border: 1, outlineW: 0, shadow: 0, align: 5 });
    this.style({ name: 'Plain', font: 'Segoe UI Semibold', size: base, primary: rgb('#FFFFFF'), outline: rgb('#000000', 255), border: 1, outlineW: 0, shadow: 0, align: 5 });
  }
  style({ name, font, size, primary, outline, back = rgb('#000000', 255), border = 1, outlineW = 0, shadow = 0, align = 2, bold = 0, spacing = 0 }) {
    this.styles.push(`Style: ${name},${font},${size},${primary},${primary},${outline},${back},${bold},0,0,0,100,100,${spacing},0,${border},${outlineW},${shadow},${align},0,0,0,1`);
  }
  // low-level event
  ev(t0, t1, style, text, { layer = 0 } = {}) { this.events.push({ t0, layer, line: `Dialogue: ${layer},${stamp(t0)},${stamp(t1)},${style},,0,0,0,,${text}` }); }

  // a filled shape (rounded rectangle) with optional blur: the backing plates and scrims behind text
  plate(t0, t1, { x, y, w, h, color = COLOR.ink, alpha = 90, blur = 0, radius = 0, layer = 0, fadeIn = 0.15, fadeOut = 0.15 }) {
    const r = Math.min(radius, w / 2, h / 2);
    const path = r > 0
      ? `m ${r} 0 l ${w - r} 0 b ${w} 0 ${w} 0 ${w} ${r} l ${w} ${h - r} b ${w} ${h} ${w} ${h} ${w - r} ${h} l ${r} ${h} b 0 ${h} 0 ${h} 0 ${h - r} l 0 ${r} b 0 0 0 0 ${r} 0`
      : `m 0 0 l ${w} 0 l ${w} ${h} l 0 ${h}`;
    this.ev(t0, t1, 'Plain', `{\\an7\\pos(${Math.round(x)},${Math.round(y)})\\fad(${ms(fadeIn)},${ms(fadeOut)})\\bord0\\shad0${blur ? `\\blur${blur}` : ''}\\1c${rgb(color)}\\1a${rgb('#000000', alpha).replace('&H', '&H').slice(0, 5)}&\\p1}${path}{\\p0}`, { layer });
  }
  // soft dark gradient-like scrims at the bottom / top so text stays legible over any footage
  scrim(t0, t1, where = 'bottom', { strength = 120, layer = 0, fadeIn = 0.3, fadeOut = 0.3, depth = 0.34 } = {}) {
    const h = Math.round(this.h * depth);
    const y = where === 'bottom' ? this.h - h : 0;
    this.plate(t0, t1, { x: -40, y: where === 'bottom' ? y + h * 0.25 : y - h * 0.25, w: this.w + 80, h, color: '#04070D', alpha: 255 - strength, blur: Math.round(h * 0.28), layer, fadeIn, fadeOut });
  }

  // a calm caption over footage: fades in with a small rise, fades out
  caption(t0, t1, text, { x = this.w / 2, y = this.h * 0.9, style = 'Cap', size = null, align = 2, layer = 5, box = true, color = null, maxWidth = null } = {}) {
    const lines = Array.isArray(text) ? text : [text];
    const fs = size ?? fitSize(lines, maxWidth ?? this.w * 0.8, this.styleSize(style), 0.5);
    const body = lines.map(esc).join('\\N');
    const open = `{\\an${align}\\pos(${Math.round(x)},${Math.round(y)})\\fs${fs}${color ? `\\1c${rgb(color)}` : ''}${box ? '' : '\\bord0\\3a&HFF&'}\\fad(180,160)\\move(${Math.round(x)},${Math.round(y + 10)},${Math.round(x)},${Math.round(y)},0,220)}`;
    this.ev(t0, t1, style, open + body, { layer });
  }
  // a hero line popping in word by word (kinetic), over footage
  hero(t0, t1, words, { x = this.w / 2, y = this.h / 2, size = null, color = COLOR.white, accent = null, perWord = 0.12, align = 5, layer = 8, maxWidth = null, popFrom = 128, outFade = 0.16, upper = true } = {}) {
    const list = (Array.isArray(words) ? words : words.split(' ')).map((w) => (upper ? w.toUpperCase() : w));
    const full = list.join(' ');
    const fs = size ?? fitSize([full], maxWidth ?? this.w * 0.8, this.styleSize('Hero'), 0.64);
    // each word is its own event so that it can pop at its own time; positions are computed from an estimated advance width
    const widths = list.map((w) => w.length * fs * 0.64);
    const gap = fs * 0.28;
    const total = widths.reduce((a, b) => a + b, 0) + gap * (list.length - 1);
    let cursor = x - total / 2;
    list.forEach((word, i) => {
      const wx = cursor + widths[i] / 2; cursor += widths[i] + gap;
      const start = t0 + i * perWord;
      const col = accent && accent.includes(i) ? COLOR.accent : color;
      this.ev(start, t1, 'Hero', `{\\an5\\pos(${Math.round(wx)},${Math.round(y)})\\fs${fs}\\1c${rgb(col)}\\fad(60,${ms(outFade)})\\fscx${popFrom}\\fscy${popFrom}\\blur6\\t(0,160,\\fscx100\\fscy100\\blur0)}${esc(word)}`, { layer });
    });
  }
  // a big hero text as ONE block of lines (each line slides/pops in on its own beat)
  stack(t0, t1, lines, { x = this.w / 2, y = this.h / 2, size = null, gapRatio = 1.06, per = 0.16, colors = [], layer = 8, maxWidth = null, align = 5, outFade = 0.14 } = {}) {
    const fs = size ?? fitSize(lines, maxWidth ?? this.w * 0.8, this.styleSize('Hero'), 0.64);
    const lh = fs * gapRatio;
    const top = y - (lh * (lines.length - 1)) / 2;
    lines.forEach((line, i) => {
      const yy = top + i * lh;
      const col = colors[i] ?? COLOR.white;
      this.ev(t0 + i * per, t1, 'Hero', `{\\an${align}\\move(${Math.round(x - this.w * 0.05)},${Math.round(yy)},${Math.round(x)},${Math.round(yy)},0,180)\\fs${fs}\\1c${rgb(col)}\\fad(90,${ms(outFade)})\\blur5\\t(0,200,\\blur0)}${esc(line.toUpperCase())}`, { layer });
    });
    return { fs, lh };
  }
  // a small label (e.g. LIVE, FILE SCENE, 4x faster) as a pill with text
  tag(t0, t1, text, { x, y, color = COLOR.accent, size = null, layer = 6, align = 7 } = {}) {
    const fs = size ?? Math.round(this.h * 0.024);
    const w = text.length * fs * 0.66 + fs * 1.4, h = fs * 1.7;
    const px = align === 9 ? x - w : x;
    this.plate(t0, t1, { x: px, y, w, h, color: '#06101F', alpha: 40, radius: h / 2, layer, fadeIn: 0.12, fadeOut: 0.12 });
    this.ev(t0, t1, 'Mono', `{\\an5\\pos(${Math.round(px + w / 2)},${Math.round(y + h / 2 + 1)})\\fs${fs}\\1c${rgb(color)}\\fad(120,120)}${esc(text)}`, { layer: layer + 1 });
    return { w, h };
  }
  // a full-frame flash (impact) over real footage: white, very short
  flash(t, { dur = 0.18, alpha = 150, color = '#FFFFFF', layer = 20 } = {}) {
    this.plate(t, t + dur, { x: 0, y: 0, w: this.w, h: this.h, color, alpha: 255 - alpha, layer, fadeIn: 0.01, fadeOut: dur - 0.02 });
  }
  styleSize(name) { const m = this.styles.find((s) => s.startsWith(`Style: ${name},`)); return Number(m.split(',')[2]); }
  toString() {
    const head = `[Script Info]\nScriptType: v4.00+\nPlayResX: ${this.w}\nPlayResY: ${this.h}\nWrapStyle: 2\nScaledBorderAndShadow: yes\nYCbCr Matrix: TV.709\n\n`;
    const styles = `[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\n${this.styles.join('\n')}\n\n`;
    const events = `[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n${[...this.events].sort((a, b) => a.t0 - b.t0 || a.layer - b.layer).map((e) => e.line).join('\n')}\n`;
    return head + styles + events;
  }
}

// the largest size (not above `base`) at which the longest line fits `maxWidth` pixels, with `factor` = average glyph width / size
export function fitSize(lines, maxWidth, base, factor) {
  const longest = Math.max(...lines.map((l) => l.length));
  return Math.max(10, Math.min(base, Math.floor(maxWidth / (longest * factor))));
}
