// MemoryOS 1.3.1: derives web/dashboard/page.embedded.js, the MO-1309 dashboard page script with its wording registry spliced in,
// exactly as the snapshot assembler splices it (Freeze section 6). Studio's `script-src 'self'` policy cannot run an inline script,
// so the History screen loads this file into its same-origin frame. page.js itself is never edited (its bytes are in every snapshot).
//   node scripts/derive-studio-history-page.mjs          write the file
//   node scripts/derive-studio-history-page.mjs --check  exit 1 (and write nothing) when the committed file differs
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { WORDING_MARK, escapeJsonForHtml } from "../web/js/memoryos-dashboard-snapshot.js";
import { WORDING } from "../web/js/memoryos-dashboard-wording.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const PAGE_SCRIPT = path.join(here, "..", "web", "dashboard", "page.js");
export const EMBEDDED_PAGE_SCRIPT = path.join(here, "..", "web", "dashboard", "page.embedded.js");

// Same steps as assembleSnapshot: LF line endings, exactly one mark, the registry as escaped JSON.
export function deriveEmbeddedPage(scriptText) {
  const script = scriptText.replace(/\r\n?/gu, "\n");
  if (script.split(WORDING_MARK).length !== 2 || /<\/script/iu.test(script)) throw new Error("page.js does not meet the page-source contract");
  return script.replace(WORDING_MARK, () => `${escapeJsonForHtml(JSON.stringify(WORDING))};`);
}

export function main(argv) {
  const derived = deriveEmbeddedPage(fs.readFileSync(PAGE_SCRIPT, "utf8"));
  if (argv.includes("--check")) {
    const same = fs.existsSync(EMBEDDED_PAGE_SCRIPT) && fs.readFileSync(EMBEDDED_PAGE_SCRIPT, "utf8") === derived;
    process.stdout.write(same ? "page.embedded.js is current\n" : "page.embedded.js differs from its derivation\n");
    return same ? 0 : 1;
  }
  fs.writeFileSync(EMBEDDED_PAGE_SCRIPT, derived);
  process.stdout.write("page.embedded.js written\n");
  return 0;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) process.exitCode = main(process.argv.slice(2));
