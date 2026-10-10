// MO-1309 Phase 2C test support: a minimal snapshot built to the Freeze section 5 layout by hand, so the data-class scanner can
// be exercised with positive and negative controls without the Phase 2A page or the Phase 2B generator. Phase 3 integration
// additionally scans real generator output (4C-S6).
import crypto from "node:crypto";
import { canonicalize } from "../web/js/mip-canonical.js";
import { WORDING } from "../web/js/memoryos-dashboard-wording.js";

const esc = (t) => t.replace(/[&<>"']/gu, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const escJson = (t) => t.replace(/[<>&\u2028\u2029]/gu, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
const hash = (t) => `'sha256-${crypto.createHash("sha256").update(t, "utf8").digest("base64")}'`;

export function miniSnapshot(viewModel, { script = '"use strict";\nvoid 0;\n', style = "body{margin:0}\n", inject = "", dataText = null, generator = "memoryos-dashboard-generator 1.0.0" } = {}) {
  const csp = `default-src 'none'; script-src ${hash(script)}; style-src ${hash(style)}; base-uri 'none'; form-action 'none'`;
  const data = dataText ?? escJson(canonicalize(viewModel));
  const fill = (digest) => `<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1">\n<meta http-equiv="Content-Security-Policy" content="${esc(csp)}">\n<title>${esc(WORDING["document.title"])}</title>\n<style>${style}</style>\n</head>\n<body>\n<noscript>${esc(WORDING["statement.integrityOnly"])}</noscript>\n<div id="app">${inject}</div>\n<footer><dl><dt>${esc(WORDING["label.generator"])}</dt><dd data-cell id="generator-version">${esc(generator)}</dd><dt>${esc(WORDING["label.snapshotDigest"])}</dt><dd data-cell id="snapshot-digest">${digest}</dd></dl></footer>\n<script type="application/json" id="memoryos-dashboard-data">${data}</script>\n<script>${script}</script>\n</body>\n</html>\n`;
  const digest = `sha256:${crypto.createHash("sha256").update(fill(""), "utf8").digest("hex")}`;
  return fill(digest);
}
// Re-seals the footer digest after a mutation, so a negative control triggers only the rule under test.
export function reseal(html) {
  const match = /(<dd data-cell id="snapshot-digest">)(sha256:[0-9a-f]{64})(<\/dd>)/u.exec(html);
  const blanked = html.replace(match[2], "");
  return html.replace(match[2], `sha256:${crypto.createHash("sha256").update(blanked, "utf8").digest("hex")}`);
}
