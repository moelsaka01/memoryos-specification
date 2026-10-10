// MO-1309 final validator (campaign 4D; cases 4D-D1 to 4D-D7). Read-only: it reads files and asks git questions; it executes no product or
// test code, writes nothing and creates no tag. The state is one of NOT_READY, I3_VALID_PENDING_BF, CERTIFIED_READY_TO_TAG.
//   node tools/mo1309/validate.mjs [--repo <dir>] [--record <path relative to the repo>]
// Follow-up rule of Freeze section 17 / DB30 (owner decision M13): the regression record has ONE ROW PER SUITE RUN, a rerun is its own row bound
// to its own log; the validator recomputes every log digest from the bound log and checks each row's commit (HEAD or an ancestor of HEAD). A
// record-level commit is never accepted in place of the row commits. (The MO-1308 validator and its accepted deviation are not edited.)
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const RECORD_PATH = "repositories/cca-conformance/mo1309-final-record.json";
export const STATES = Object.freeze(["NOT_READY", "I3_VALID_PENDING_BF", "CERTIFIED_READY_TO_TAG"]);
const sha = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
const LATE_ALLOWED = [/^repositories\/cca-conformance\/evidence\/mo1309\//u, /^repositories\/cca-conformance\/mo1309-final-/u, /^docs\/mo1309-/u, /^(CHANGELOG|ROADMAP)\.md$/u];

export function validate({ repo, recordPath = RECORD_PATH }) {
  const findings = [];
  const git = (args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }).trim();
  const check = (id, ok, detail) => findings.push({ id, ok: Boolean(ok), detail });
  const read = (relative) => fs.readFileSync(path.join(repo, relative));
  const isAncestorOrSame = (commit, of) => { try { git(["merge-base", "--is-ancestor", commit, of]); return true; } catch { return false; } };
  const fileBound = (ref) => { try { return ref && sha(read(ref.path)) === ref.sha256; } catch { return false; } };

  let record;
  try { record = JSON.parse(read(recordPath).toString("utf8")); } catch { check("record", false, "the final record is missing or unreadable"); return conclude(findings, null); }
  if (record.kind !== "MO1309FinalRecord") { check("record", false, "not an MO1309FinalRecord"); return conclude(findings, record); }
  const head = git(["rev-parse", "HEAD"]);

  // 4D-D1: candidate identity and no later production bytes.
  const candidate = record.candidate?.commit;
  let d1 = typeof candidate === "string" && /^[0-9a-f]{40}$/u.test(candidate) && isAncestorOrSame(candidate, head);
  let late = [];
  if (d1) { late = git(["diff", "--name-only", candidate, head]).split("\n").filter(Boolean).filter((p) => !LATE_ALLOWED.some((rule) => rule.test(p))); d1 = late.length === 0; }
  check("4D-D1", d1, d1 ? "the candidate is HEAD or an ancestor, and later commits add only evidence and documents" : `candidate missing, not an ancestor, or later production paths: ${late.slice(0, 5).join(", ")}`);

  // 4D-D2: each campaign stream has exactly one accepted certifying generation; earlier ones preserved with dispositions.
  const generations = Array.isArray(record.generations) ? record.generations : [];
  let d2 = true; const d2Problems = [];
  for (const stream of ["4A", "4B", "4C"]) {
    const own = generations.filter((g) => g.stream === stream);
    const accepted = own.filter((g) => g.accepted === true && g.certifying === true);
    if (accepted.length !== 1) { d2 = false; d2Problems.push(`${stream}: ${accepted.length} accepted certifying generations`); continue; }
    for (const g of own) {
      if (!fileBound(g.receipt)) { d2 = false; d2Problems.push(`${stream} ${g.id}: receipt missing or digest differs`); continue; }
      const receipt = JSON.parse(read(g.receipt.path).toString("utf8"));
      if (receipt.accepted !== (g.accepted === true) || receipt.certifying !== (g.certifying === true) || receipt.stream !== stream) { d2 = false; d2Problems.push(`${stream} ${g.id}: receipt disagrees with the record`); }
      if (g.accepted !== true && !fileBound(g.disposition)) { d2 = false; d2Problems.push(`${stream} ${g.id}: preserved generation has no bound disposition`); }
      if (g.accepted === true && g.certifying === true && receipt.commit !== undefined && !isAncestorOrSame(receipt.commit, head)) { d2 = false; d2Problems.push(`${stream} ${g.id}: receipt commit is not an ancestor`); }
    }
  }
  check("4D-D2", d2, d2 ? "each stream has exactly one accepted certifying generation, earlier ones bound with dispositions" : d2Problems.join("; "));

  // 4D-D4 (computed before D3, which depends on the rows): the retained regression record.
  const regression = record.regression ?? {};
  const rowsRef = regression.rows; let rows = []; let d4 = true; const d4Problems = [];
  if (!fileBound(rowsRef)) { d4 = false; d4Problems.push("rows file missing or digest differs"); } else rows = JSON.parse(read(rowsRef.path).toString("utf8"));
  const seen = new Set();
  for (const row of rows) {
    const key = `${row.suite}#${row.run}`;
    if (seen.has(key)) { d4 = false; d4Problems.push(`${key}: duplicate row`); }
    seen.add(key);
    const logPath = path.posix.join(path.posix.dirname(rowsRef.path), row.log ?? "");
    try { if (sha(read(logPath)) !== row.logSha256) { d4 = false; d4Problems.push(`${key}: log digest differs`); } } catch { d4 = false; d4Problems.push(`${key}: log missing`); }
    if (!(typeof row.commit === "string" && /^[0-9a-f]{40}$/u.test(row.commit) && isAncestorOrSame(row.commit, "HEAD"))) { d4 = false; d4Problems.push(`${key}: row commit is not HEAD or an ancestor`); }
  }
  const suiteIds = new Set(rows.map((row) => row.suite));
  for (const [suite, runs] of Object.entries(Object.fromEntries([...suiteIds].map((s) => [s, rows.filter((r) => r.suite === s).map((r) => r.run).sort((a, b) => a - b)])))) {
    if (runs.some((run, i) => run !== i + 1)) { d4 = false; d4Problems.push(`${suite}: run numbers are not 1..n (a rerun must be its own numbered row)`); }
  }
  if (rows.length === 0) { d4 = false; d4Problems.push("no rows"); }
  check("4D-D4", d4, d4 ? `${rows.length} suite-run rows, each bound to its own log, each with a row commit` : d4Problems.slice(0, 6).join("; "));

  // 4D-D3: every requirement has a passing case.
  let inventory; try { inventory = JSON.parse(read("repositories/cca-conformance/mo1309-conformance-inventory.json").toString("utf8")); } catch { inventory = null; }
  let d3 = inventory !== null; const d3Problems = [];
  if (inventory) {
    const latestPassing = (suite) => rows.filter((r) => r.suite === suite).some((r) => r.exitCode === 0 && r.fail === 0 && r.pass > 0);
    const acceptedReceipts = Object.fromEntries(generations.filter((g) => g.accepted && g.certifying && fileBound(g.receipt)).map((g) => [g.stream, JSON.parse(read(g.receipt.path).toString("utf8"))]));
    for (const requirement of inventory.requirements) {
      const suitesNeeded = new Set(requirement.cloud.tests.map((t) => t.suite));
      const cloudOk = (requirement.cloud.status === "COVERED") && [...suitesNeeded].every(latestPassing);
      const streams = requirement.windows.campaigns.filter((c) => c !== "4D");
      const windowsOk = streams.every((stream) => acceptedReceipts[stream]?.cases?.every((c) => c.outcome === "PASS" || c.outcome === "RECORDED"));
      if (!(cloudOk || suitesNeeded.size === 0) || !windowsOk) { d3 = false; d3Problems.push(requirement.id); }
    }
  }
  check("4D-D3", d3, d3 ? "all 32 requirements have a passing case in an accepted generation or a passing regression row" : `uncovered: ${d3Problems.join(", ")}`);

  // 4D-D5: the 4C trust record.
  const trust = generations.find((g) => g.stream === "4C" && g.accepted && g.certifying);
  check("4D-D5", Boolean(trust) && fileBound(trust.receipt), "an accepted certifying 4C receipt is bound");

  // 4D-D6: release disclosures state every recorded outcome and qualification.
  let d6 = fileBound(record.disclosures); let missing = [];
  if (d6) { const text = read(record.disclosures.path).toString("utf8"); missing = [...generations.filter((g) => !g.accepted).map((g) => g.id), ...(record.qualifications ?? []).map((q) => q.id)].filter((id) => !text.includes(id)); d6 = missing.length === 0; }
  check("4D-D6", d6, d6 ? "the disclosures name every preserved generation and qualification" : `disclosures missing or lacking: ${missing.join(", ") || "file"}`);

  const core = findings.every((f) => f.ok);
  // 4D-D7: I3 is the last commit that touched the final record and is in HEAD; the binding-only BF adds only the binding file and names I3.
  const BINDING = "repositories/cca-conformance/mo1309-final-binding.json";
  let i3 = null; let bound = false; let detail = "the final record has no commit";
  try { i3 = git(["log", "-1", "--format=%H", "--", recordPath]); } catch { i3 = null; }
  if (core && i3) {
    detail = "I3 is in HEAD; no binding-only BF yet";
    let binding = null; try { binding = JSON.parse(read(BINDING).toString("utf8")); } catch { binding = null; }
    if (binding) {
      const after = git(["diff", "--name-only", i3, "HEAD"]).split("\n").filter(Boolean);
      bound = binding.i3 === i3 && after.length > 0 && after.every((p) => p === BINDING);
      detail = bound ? "the binding-only BF names I3 and changes nothing else" : "the binding does not name I3, or HEAD changes more than the binding file";
    }
  }
  if (!core) detail = "not evaluated: an earlier rule failed";
  check("4D-D7", !core || (Boolean(i3) && (detail !== "the binding does not name I3, or HEAD changes more than the binding file")), detail);
  return conclude(findings, record, { head, bound });
}

function conclude(findings, record, extra = {}) {
  const ok = findings.length > 0 && findings.every((f) => f.ok);
  const state = !ok ? "NOT_READY" : extra.bound ? "CERTIFIED_READY_TO_TAG" : "I3_VALID_PENDING_BF";
  return { kind: "MO1309ValidatorResult", version: "1.0.0", state, findings, tagCreated: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
  const repo = path.resolve(option("repo", path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..")));
  const result = validate({ repo, recordPath: option("record", RECORD_PATH) });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.state === "NOT_READY" ? 1 : 0;
}
