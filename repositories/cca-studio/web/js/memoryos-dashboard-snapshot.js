// MO-1309 Cloud Dashboard snapshot assembly (Contract Freeze 1, Phase 2B, sections 5, 9.1 and 11).
// Pure: a view model plus the three page sources in, one HTML string out. No filesystem, clock, random source, locale or
// environment is read. The output holds one inline stylesheet, one inline script and one embedded data block; the policy
// meta pins the script and style by SHA-256 and has no unsafe source. Browser-safe like the other dashboard units.
import { canonicalize, sha256Hex, utf8Encode } from "./mip-canonical.js";
import { DashboardError, validateDashboardViewModel } from "./memoryos-dashboard-contract.js";
import { wording, WORDING } from "./memoryos-dashboard-wording.js";

export const DASHBOARD_GENERATOR_VERSION = "memoryos-dashboard-generator 1.0.0";

// The contract between the page sources and the generator: the template placeholders and the single wording mark.
export const TEMPLATE_PLACEHOLDERS = Object.freeze(["CSP", "TITLE", "STYLE", "NOSCRIPT", "LABEL_GENERATOR", "GENERATOR", "LABEL_SNAPSHOT",
  "SNAPSHOT_DIGEST", "DATA", "SCRIPT"]);
export const WORDING_MARK = "null; /*@@WORDING@@*/";
export const DATA_BLOCK_ID = "memoryos-dashboard-data";

const BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function base64OfHex(hex) {
  const bytes = [];
  for (let index = 0; index < hex.length; index += 2) bytes.push(Number.parseInt(hex.slice(index, index + 2), 16));
  let out = "";
  for (let index = 0; index < bytes.length; index += 3) {
    const chunk = (bytes[index] << 16) | ((bytes[index + 1] ?? 0) << 8) | (bytes[index + 2] ?? 0);
    out += BASE64[(chunk >> 18) & 63] + BASE64[(chunk >> 12) & 63];
    out += index + 1 < bytes.length ? BASE64[(chunk >> 6) & 63] : "=";
    out += index + 2 < bytes.length ? BASE64[chunk & 63] : "=";
  }
  return out;
}
export const cspSourceOf = (text) => `'sha256-${base64OfHex(sha256Hex(text))}'`;

const escapeText = (text) => text.replace(/[&<>"']/gu, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
// JSON text for an HTML script element: `<`, `>`, `&`, U+2028 and U+2029 can occur only inside strings, so escaping them keeps the value.
export const escapeJsonForHtml = (json) => json.replace(/[<>&\u2028\u2029]/gu, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);

const VERSION_PATTERN = /^[A-Za-z0-9][A-Za-z0-9. -]{0,63}$/u;

// `sources` is { template, style, script }: the text of the page files. Throws DashboardError(DASH_USAGE) for a malformed
// argument or a page source that does not meet the contract above; never returns a partial result.
export function assembleSnapshot({ viewModel, sources, generatorVersion = DASHBOARD_GENERATOR_VERSION }) {
  if (sources === null || typeof sources !== "object" || ![sources.template, sources.style, sources.script].every((text) => typeof text === "string" && text.isWellFormed())
    || typeof generatorVersion !== "string" || !VERSION_PATTERN.test(generatorVersion) || !validateDashboardViewModel(viewModel).ok) throw new DashboardError("DASH_USAGE");
  const lf = (text) => text.replace(/\r\n?/gu, "\n"); /* line endings are LF whatever the checkout converted them to */
  const template = lf(sources.template);
  const style = lf(sources.style);
  sources = { script: lf(sources.script) };
  if (sources.script.split(WORDING_MARK).length !== 2 || /<\/script/iu.test(sources.script) || /<\/style/iu.test(style)) throw new DashboardError("DASH_USAGE");
  const script = sources.script.replace(WORDING_MARK, () => `${escapeJsonForHtml(JSON.stringify(WORDING))};`);
  if (/<\/script/iu.test(script) || !/^[\x20-\x7e\n\t\r\u0080-\u{10ffff}]*$/u.test(script)) throw new DashboardError("DASH_USAGE");

  const found = [...template.matchAll(/@@([A-Z_]+)@@/gu)].map((match) => match[1]);
  if (found.length !== TEMPLATE_PLACEHOLDERS.length || [...found].sort().join() !== [...TEMPLATE_PLACEHOLDERS].sort().join()) throw new DashboardError("DASH_USAGE");

  const dataText = canonicalize(viewModel); // RFC 8785 JCS; the trailing newline of the canonical form is not part of the block
  const csp = `default-src 'none'; script-src ${cspSourceOf(script)}; style-src ${cspSourceOf(style)}; base-uri 'none'; form-action 'none'`;
  const values = {
    CSP: escapeText(csp), TITLE: escapeText(wording("document.title")), STYLE: style, SCRIPT: script, DATA: escapeJsonForHtml(dataText),
    NOSCRIPT: escapeText(wording("statement.scriptRequired")), LABEL_GENERATOR: escapeText(wording("label.generator")),
    LABEL_SNAPSHOT: escapeText(wording("label.snapshotDigest")), GENERATOR: escapeText(generatorVersion), SNAPSHOT_DIGEST: "",
  };
  const fill = (digestText) => template.replace(/@@([A-Z_]+)@@/gu, (_, key) => (key === "SNAPSHOT_DIGEST" ? digestText : values[key])); 
  const digest = `sha256:${sha256Hex(fill(""))}`; // SHA-256 of the file with that one footer field blanked
  const html = fill(digest);
  return { html, bytes: utf8Encode(html), digest, csp };
}
