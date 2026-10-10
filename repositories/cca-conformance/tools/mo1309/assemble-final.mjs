// MO-1309 4D helper: assembles repositories/cca-conformance/mo1309-final-record.json from the evidence directories, so that the validator has one
// record to check. It decides nothing: `accepted` and `certifying` are copied from each receipt, every file is bound by its SHA-256, and a
// preserved (not accepted) generation needs a disposition file. It only writes the record file it is asked to write.
//   node tools/mo1309/assemble-final.mjs --candidate <commit> --evidence <dir under evidence/mo1309> --disclosures <path> [--regression <dir>] [--qualification <id>]... [--out <record path>]
// Evidence layout it reads:  <evidence>/4a|4b|4c/gen-<n>/{4a|4b|4c}-receipt.json [+ disposition.md], <evidence>/regression/{rows.json,logs/}.
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const sha = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
const repoOf = () => path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");

export function assembleFinalRecord({ repo = repoOf(), candidate, evidence, disclosures, qualifications = [], regression = `${evidence}/regression` }) {
  const rel = (full) => path.relative(repo, full).split(path.sep).join("/");
  const bind = (full) => ({ path: rel(full), sha256: sha(fs.readFileSync(full)) });
  const generations = [];
  for (const stream of ["4A", "4B", "4C"]) {
    const root = path.join(repo, evidence, stream.toLowerCase());
    if (!fs.existsSync(root)) continue;
    for (const name of fs.readdirSync(root).filter((n) => /^gen-\d+$/u.test(n)).sort((a, b) => Number(a.slice(4)) - Number(b.slice(4)))) {
      const receiptFile = path.join(root, name, `${stream.toLowerCase()}-receipt.json`);
      const receipt = JSON.parse(fs.readFileSync(receiptFile, "utf8"));
      const disposition = path.join(root, name, "disposition.md");
      generations.push({ stream, id: `${stream}-${name}`, certifying: receipt.certifying === true, accepted: receipt.accepted === true, result: receipt.result, receipt: bind(receiptFile),
        ...(fs.existsSync(disposition) ? { disposition: bind(disposition) } : {}) });
    }
  }
  const rows = path.join(repo, regression, "rows.json");
  return { kind: "MO1309FinalRecord", version: "1.0.0", candidate: { commit: candidate }, generations, regression: { rows: bind(rows) },
    disclosures: bind(path.join(repo, disclosures)), qualifications: qualifications.map((id) => ({ id })) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const option = (name) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : null; };
  const all = (name) => args.flatMap((a, i) => (a === `--${name}` ? [args[i + 1]] : []));
  if (!option("candidate") || !option("evidence") || !option("disclosures")) { process.stderr.write("usage: --candidate <commit> --evidence <dir> --disclosures <path> [--qualification <id>]... [--out <path>]\n"); process.exit(2); }
  const record = assembleFinalRecord({ candidate: option("candidate"), evidence: option("evidence"), disclosures: option("disclosures"), qualifications: all("qualification"), ...(option("regression") ? { regression: option("regression") } : {}) });
  const out = path.resolve(repoOf(), option("out") ?? "repositories/cca-conformance/mo1309-final-record.json");
  fs.writeFileSync(out, `${JSON.stringify(record, null, 2)}\n`, { flag: "wx" });
  process.stdout.write(`${path.relative(repoOf(), out)}\n`);
}
