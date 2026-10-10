// MO-1309 Phase 2A test support: assembles a single-file snapshot from the page sources and a view model, so the page can be
// exercised in a real browser before the Phase 2B generator exists. The production assembler is the Phase 2B generator's;
// Phase 3 integration points these tests at it. This one mirrors Freeze section 5 (hash-pinned inline script and style,
// escaped data block, footer digest over the file with the digest field blanked) and nothing else.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { canonicalViewModelBytes } from "../web/js/memoryos-dashboard-viewmodel.js";
import { WORDING, wording } from "../web/js/memoryos-dashboard-wording.js";

export const DASHBOARD_SOURCE_ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "web", "dashboard");
export const readDashboardSource = (name) => fs.readFileSync(path.join(DASHBOARD_SOURCE_ROOT, name), "utf8");

const escapeText = (text) => text.replace(/[&<>"']/gu, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const escapeJsonForHtml = (json) => json.replace(/[<>&\u2028\u2029]/gu, (c) => `\\u${c.charCodeAt(0).toString(16).padStart(4, "0")}`);
const cspHash = (text) => `'sha256-${crypto.createHash("sha256").update(text, "utf8").digest("base64")}'`;
const WORDING_MARK = "null; /*@@WORDING@@*/";

export function assembleTestSnapshot({ viewModel, generatorVersion = "test-assembler" }) {
  const dataText = new TextDecoder().decode(canonicalViewModelBytes(viewModel)).trimEnd();
  let script = readDashboardSource("page.js");
  if (script.split(WORDING_MARK).length !== 2) throw new Error("wording placeholder must occur exactly once");
  script = script.replace(WORDING_MARK, () => `${escapeJsonForHtml(JSON.stringify(WORDING))};`);
  if (/<\/script/iu.test(script)) throw new Error("script text would close its element");
  const style = readDashboardSource("page.css");
  const csp = `default-src 'none'; script-src ${cspHash(script)}; style-src ${cspHash(style)}; base-uri 'none'; form-action 'none'`;
  const values = {
    CSP: escapeText(csp), TITLE: escapeText(wording("document.title")), STYLE: style, SCRIPT: script, DATA: escapeJsonForHtml(dataText),
    NOSCRIPT: escapeText(wording("statement.scriptRequired")), LABEL_GENERATOR: escapeText(wording("label.generator")),
    LABEL_SNAPSHOT: escapeText(wording("label.snapshotDigest")), GENERATOR: escapeText(generatorVersion), SNAPSHOT_DIGEST: "",
  };
  const fill = (blankDigest) => readDashboardSource("page.html").replace(/@@([A-Z_]+)@@/gu, (_, key) => {
    if (!Object.hasOwn(values, key)) throw new Error(`unknown placeholder ${key}`);
    return key === "SNAPSHOT_DIGEST" ? blankDigest : values[key];
  });
  const blanked = fill("");
  const digest = `sha256:${crypto.createHash("sha256").update(blanked, "utf8").digest("hex")}`;
  const html = fill(digest);
  return { html, csp, script, style, digest, blanked };
}
