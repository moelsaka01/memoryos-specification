// MO-1309 data-class scanner (Contract Freeze 1, Phase 2C, sections 9.2, 9.5 and 11; requirements DB05, DB06, DB19, 4C-S6).
// Pure and browser-safe: a generated snapshot (as text) in, a list of violations out. A violation names a rule and a location
// only, never the offending content. The scanner holds no secret itself: the values that must not appear (the operator's paths,
// host and user names, environment values, member contents) are passed in by the caller that knows them.
import { canonicalize, sha256Hex } from "./mip-canonical.js";
import { validateDashboardViewModel } from "./memoryos-dashboard-contract.js";
import { WORDING } from "./memoryos-dashboard-wording.js";

const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) freeze(value[key]);
  }
  return value;
};

// The closed data-class model. Only DATA is untrusted; everything else is fixed text or a generator-computed field.
export const DATA_CLASSES = freeze({
  DATA: "Untrusted export-derived values: only inside the embedded data block, only as the closed view model shape",
  REGISTRY_TEXT: "Wording-registry strings: the only chrome text",
  GENERATOR_FIELDS: "Generator version and snapshot digest in the footer",
  FIXED_SOURCE: "The fixed page script, style and markup, pinned by the policy",
  FORBIDDEN_PATH: "Any input or output path, working directory, home or temporary directory",
  FORBIDDEN_HOST_USER: "Any host or user name",
  FORBIDDEN_ENVIRONMENT: "Any environment value",
  FORBIDDEN_CLOCK: "Any timestamp, date-time or time zone",
  FORBIDDEN_MEMBER_CONTENT: "Any retained member contents",
  FORBIDDEN_DIAGNOSTIC: "Any generator-side diagnostic, stack or error text",
  FORBIDDEN_REFERENCE: "Any external reference (address, data or blob source, link, frame, image)",
});

// The closed rule table. Each scan result names one of these ids.
export const DATA_CLASS_RULES = freeze([
  { id: "S1", class: "FIXED_SOURCE", rule: "Exactly one policy meta, one style, one data block and one script, in that order", requirement: "DB05" },
  { id: "S2", class: "FIXED_SOURCE", rule: "The policy equals default-src 'none' with the SHA-256 of the actual script and style, and no other source", requirement: "DB06" },
  { id: "S3", class: "GENERATOR_FIELDS", rule: "The footer holds a plain generator version and the snapshot digest recomputed over the file with that field blanked", requirement: "DB19" },
  { id: "D1", class: "DATA", rule: "The data block parses, is the closed MemoryOSDashboardViewModel, and contains none of the characters < > & U+2028 U+2029", requirement: "DB09, DB10" },
  { id: "D2", class: "DATA", rule: "The data block is the only place export-derived values occur: outside it, the text is the registry, the generator fields and fixed source", requirement: "DB19" },
  { id: "R1", class: "FORBIDDEN_REFERENCE", rule: "Outside the policy meta and the data block there is no address, //, data: or blob: source, link, frame, object, embed, image, base or form", requirement: "DB05" },
  { id: "F1", class: "FORBIDDEN_PATH", rule: "No path-shaped text (drive path, UNC path, rooted system directory, home shorthand, file address) outside the data block", requirement: "DB19" },
  { id: "F2", class: "FORBIDDEN_CLOCK", rule: "No date-time, time of day, time zone name or epoch-millisecond number outside the data block", requirement: "DB19" },
  { id: "F3", class: "FORBIDDEN_DIAGNOSTIC", rule: "No stack frame, exception name or error-code line outside the data block", requirement: "DB19" },
  { id: "F4", class: "FORBIDDEN_HOST_USER", rule: "No supplied host or user name anywhere in the file", requirement: "DB19" },
  { id: "F5", class: "FORBIDDEN_ENVIRONMENT", rule: "No supplied environment value anywhere in the file", requirement: "DB19" },
  { id: "F6", class: "FORBIDDEN_PATH", rule: "No supplied path anywhere in the file", requirement: "DB19" },
  { id: "M1", class: "FORBIDDEN_MEMBER_CONTENT", rule: "No sample of any supplied member contents appears anywhere in the file", requirement: "DB04" },
]);

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function sha256Base64(text) {
  const hex = sha256Hex(text);
  let out = "";
  const bytes = Array.from({ length: 32 }, (_, i) => Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16));
  for (let i = 0; i < bytes.length; i += 3) {
    const chunk = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    out += BASE64[(chunk >> 18) & 63] + BASE64[(chunk >> 12) & 63] + (i + 1 < bytes.length ? BASE64[(chunk >> 6) & 63] : "=") + (i + 2 < bytes.length ? BASE64[chunk & 63] : "=");
  }
  return out;
}

const META = /<meta http-equiv="Content-Security-Policy" content="([^"]*)">/u;
const DATA_BLOCK = /<script type="application\/json" id="memoryos-dashboard-data">([\s\S]*?)<\/script>/u;
const STYLE = /<style>([\s\S]*?)<\/style>/u;
const SCRIPT = /<script>([\s\S]*?)<\/script>/u;
const FOOTER = /<dt>([^<]*)<\/dt><dd data-cell id="generator-version">([^<]*)<\/dd><dt>([^<]*)<\/dt><dd data-cell id="snapshot-digest">(sha256:[0-9a-f]{64})<\/dd>/u;
const decodeEntities = (text) => text.replace(/&quot;/gu, '"').replace(/&#39;/gu, "'").replace(/&lt;/gu, "<").replace(/&gt;/gu, ">").replace(/&amp;/gu, "&");

// Patterns for text outside the data block. Chosen to have no match in the registry, the fixed page source or the footer.
const PATH_PATTERNS = [/\b[A-Za-z]:\\/u, /\\\\[^\s\\]+\\/u, /(?:^|[\s"'(=:>])\/(?:home|Users|root|tmp|var|etc|mnt|opt|usr|private|proc|dev)\b/u, /(?:^|[\s"'(>])~[/\\]/u, /file:\/\//iu];
const CLOCK_PATTERNS = [/\b\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}/u, /\b\d{1,2}:\d{2}:\d{2}\b/u, /\b(?:GMT|UTC)[+-]?\d{0,4}\b/u, /\b1[0-9]{12}\b/u, /\b(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun),? \d{1,2} (?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}\b/u];
const DIAGNOSTIC_PATTERNS = [/\n\s+at [^\n]*\(?(?:file:|[A-Za-z]:\\|\/)[^\n]*:\d+:\d+/u, /\b(?:TypeError|RangeError|SyntaxError|ReferenceError|EvalError|AssertionError)\b/u, /\b(?:DASH_[A-Z_]+|MO1308_[A-Z_]+)\b/u, /\bENOENT|EEXIST|EACCES|EPERM\b/u];

// `html` is the snapshot text. `context` carries what the caller knows must not appear:
//   paths, hostUserNames, environmentValues: arrays of strings (each at least 3 characters to avoid trivial matches);
//   memberContents: arrays of Uint8Array or strings (retained member bytes).
// Returns { violations: [{ rule, location }] }; an empty list is a clean scan.
export function scanSnapshot(html, { paths = [], hostUserNames = [], environmentValues = [], memberContents = [] } = {}) {
  const violations = [];
  const add = (rule, location) => violations.push({ rule, location });
  if (typeof html !== "string") return { violations: [{ rule: "S1", location: "$" }] };

  // S1 structure and order.
  const meta = META.exec(html);
  const style = STYLE.exec(html);
  const block = DATA_BLOCK.exec(html);
  const script = SCRIPT.exec(html.replace(DATA_BLOCK, ""));
  const count = (pattern) => (html.match(pattern) ?? []).length;
  if (!meta || !style || !block || !script || count(/<meta\b/gu) !== 2 || count(/<style\b/gu) !== 1 || count(/<script\b/gu) !== 2 || count(/<\/script>/gu) !== 2
    || !(meta.index < style.index && style.index < block.index && block.index < html.indexOf("<script>"))) {
    add("S1", "structure");
    return { violations };
  }

  // S2 policy.
  const policy = decodeEntities(meta[1]);
  const expectedPolicy = `default-src 'none'; script-src 'sha256-${sha256Base64(script[1])}'; style-src 'sha256-${sha256Base64(style[1])}'; base-uri 'none'; form-action 'none'`;
  if (policy !== expectedPolicy) add("S2", "policy");

  // D1 the data block.
  if (/[<>&\u2028\u2029]/u.test(block[1])) add("D1", "data-block-characters");
  let viewModel = null;
  try { viewModel = JSON.parse(block[1]); } catch { add("D1", "data-block-parse"); }
  if (viewModel !== null) {
    if (!validateDashboardViewModel(viewModel).ok) add("D1", "data-block-shape");
    else if (canonicalize(JSON.parse(canonicalize(viewModel))) !== canonicalize(viewModel)) add("D1", "data-block-canonical");
  }

  // S3 footer, with the digest recomputed over the file with that one field blanked.
  const footer = FOOTER.exec(html);
  if (!footer || footer[1] !== WORDING["label.generator"] || footer[3] !== WORDING["label.snapshotDigest"] || !/^[A-Za-z0-9][A-Za-z0-9. -]{0,63}$/u.test(footer[2])) add("S3", "footer");
  else if (`sha256:${sha256Hex(html.replace(footer[4], ""))}` !== footer[4] || html.split(footer[4]).length !== 2) add("S3", "snapshot-digest");

  // Everything outside the data block: D2, R1, F1 to F3. The policy meta is removed first (its hashes are base64 and may contain //).
  const frame = html.replace(DATA_BLOCK, "<script type=\"application/json\" id=\"memoryos-dashboard-data\"></script>");
  const outside = frame.replace(META, "<meta>");
  if (/https?:|\/\/|\bdata:|\bblob:|<link\b|<iframe\b|<object\b|<embed\b|<img\b|<base\b|<form\b|<a\b|\bsrc\s*=|\bhref\s*=/iu.test(outside.replace(STYLE, "<style></style>").replace(SCRIPT, "<script></script>"))
    || /https?:|\bdata:|\bblob:|@import|url\(/iu.test(style[1]) || /https?:|\bdata:|\bblob:/iu.test(script[1])) add("R1", "outside-data");
  const markup = outside.replace(STYLE, "<style></style>").replace(SCRIPT, "<script></script>"); /* the fixed script holds registry keys such as error.DASH_USAGE */
  for (const [pattern, rule, label, where] of [[PATH_PATTERNS, "F1", "path", outside], [CLOCK_PATTERNS, "F2", "clock", outside], [DIAGNOSTIC_PATTERNS, "F3", "diagnostic", markup]]) {
    if (pattern.some((p) => p.test(where))) add(rule, `outside-data:${label}`);
  }
  // D2: after removing the fixed source, the footer and the registry, no text remains that is not registry text or a generator field.
  const registry = new Set(Object.values(WORDING));
  const text = outside.replace(STYLE, "").replace(SCRIPT, "").replace(/<[^>]+>/gu, "\n").split("\n").map((line) => decodeEntities(line.trim())).filter(Boolean);
  for (const line of text) if (!registry.has(line) && line !== (footer && footer[2]) && line !== (footer && footer[4])) { add("D2", "foreign-text"); break; }

  // F4 to F6 and M1: supplied literals anywhere in the file, member contents by sample.
  const supplied = (values) => values.filter((value) => typeof value === "string" && value.length >= 3);
  if (supplied(hostUserNames).some((value) => html.includes(value))) add("F4", "supplied");
  if (supplied(environmentValues).some((value) => html.includes(value))) add("F5", "supplied");
  if (supplied(paths).some((value) => html.includes(value) || html.includes(value.replaceAll("\\", "/")) || html.includes(JSON.stringify(value).slice(1, -1)))) add("F6", "supplied");
  for (const member of memberContents) {
    const body = typeof member === "string" ? member : Array.from(member, (byte) => String.fromCharCode(byte)).join("");
    for (const sample of memberSamples(body)) if (html.includes(sample)) { add("M1", "sample"); break; }
  }
  return { violations };
}

// Up to six 32-character samples spread across the contents, skipping windows that are only digest-like (the view model
// legitimately carries digests) or low in variety.
function memberSamples(body) {
  const width = 32;
  const out = [];
  if (body.length < width) return out;
  for (let k = 0; k < 6; k += 1) {
    const start = Math.floor(((body.length - width) * k) / 5);
    const sample = body.slice(start, start + width);
    if (!/[0-9a-f]{16}/u.test(sample) && new Set(sample).size >= 8) out.push(sample);
  }
  return out;
}
