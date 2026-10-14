// MemoryOS 1.3.1 final validator (cases SH-D1 to SH-D7). Read-only: it reads files and asks git questions; it executes no product or test code,
// writes nothing and creates no tag. The state is one of NOT_READY, I3_VALID_PENDING_BF, CERTIFIED_READY_TO_TAG.
//   node tools/mo1310/validate.mjs [--repo <dir>] [--record <path relative to the repo>]
// The regression record has ONE ROW PER SUITE RUN (Freeze SH23, as MO-1309 DB30): a rerun is its own numbered row bound to its own log; the
// validator recomputes every log digest and checks each row's commit (HEAD or an ancestor). The MO-1307 strict suite must meet its recorded count.
import { execFileSync } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { matchKnownFailures } from "./known-failures.mjs";

export const RECORD_PATH = "repositories/cca-conformance/mo1310-final-record.json";
export const BINDING_PATH = "repositories/cca-conformance/mo1310-final-binding.json";
export const BASELINE = "889f99e72a5d41c242572cc052ab97b07cc10a24";
export const STATES = Object.freeze(["NOT_READY", "I3_VALID_PENDING_BF", "CERTIFIED_READY_TO_TAG"]);
const sha = (bytes) => `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
const LATE_ALLOWED = [/^repositories\/cca-conformance\/evidence\/mo1310\//u, /^repositories\/cca-conformance\/mo1310-final-/u, /^docs\/mo1310-/u, /^docs\/release-1\.3\.1-/u, /^(CHANGELOG|ROADMAP|RELEASE_NOTES|KNOWN_ISSUES|README)\.md$/u];

export function validate({ repo, recordPath = RECORD_PATH }) {
  const findings = [];
  const git = (args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 }).trim();
  const check = (id, ok, detail) => findings.push({ id, ok: Boolean(ok), detail });
  const read = (relative) => fs.readFileSync(path.join(repo, relative));
  const isAncestorOrSame = (commit, of) => { try { git(["merge-base", "--is-ancestor", commit, of]); return true; } catch { return false; } };
  const fileBound = (ref) => { try { return ref && sha(read(ref.path)) === ref.sha256; } catch { return false; } };

  let record;
  try { record = JSON.parse(read(recordPath).toString("utf8")); } catch { check("record", false, "the final record is missing or unreadable"); return conclude(findings); }
  if (record.kind !== "MO1310FinalRecord") { check("record", false, "not an MO1310FinalRecord"); return conclude(findings); }
  const head = git(["rev-parse", "HEAD"]);

  // SH-D1: candidate identity and no later production bytes.
  const candidate = record.candidate?.commit;
  let d1 = typeof candidate === "string" && /^[0-9a-f]{40}$/u.test(candidate) && isAncestorOrSame(candidate, head);
  let late = [];
  if (d1) { late = git(["diff", "--name-only", candidate, head]).split("\n").filter(Boolean).filter((p) => !LATE_ALLOWED.some((rule) => rule.test(p))); d1 = late.length === 0; }
  check("SH-D1", d1, d1 ? "the candidate is HEAD or an ancestor, and later commits add only evidence and documents" : `candidate missing, not an ancestor, or later production paths: ${late.slice(0, 5).join(", ")}`);

  // SH-D2: exactly one accepted certifying generation of the campaign, on Windows; earlier ones preserved with dispositions.
  const generations = Array.isArray(record.generations) ? record.generations : [];
  const accepted = generations.filter((g) => g.accepted === true && g.certifying === true);
  let d2 = accepted.length === 1; const d2Problems = d2 ? [] : [`${accepted.length} accepted certifying generations`];
  const receipts = {};
  for (const g of generations) {
    if (!fileBound(g.receipt)) { d2 = false; d2Problems.push(`${g.id}: receipt missing or digest differs`); continue; }
    const receipt = JSON.parse(read(g.receipt.path).toString("utf8")); receipts[g.id] = receipt;
    if (receipt.kind !== "MO1310CampaignReceipt" || receipt.accepted !== (g.accepted === true) || receipt.certifying !== (g.certifying === true)) { d2 = false; d2Problems.push(`${g.id}: receipt disagrees with the record`); }
    if (g.accepted !== true && !fileBound(g.disposition)) { d2 = false; d2Problems.push(`${g.id}: preserved generation has no bound disposition`); }
    if (g.accepted === true && g.certifying === true) {
      if (receipt.host?.platform !== "win32" || receipt.host?.arch !== "x64") { d2 = false; d2Problems.push(`${g.id}: not a Windows x64 run`); }
      if (typeof receipt.commit !== "string" || !isAncestorOrSame(receipt.commit, head)) { d2 = false; d2Problems.push(`${g.id}: receipt commit is not an ancestor`); }
    }
  }
  check("SH-D2", d2, d2 ? "exactly one accepted certifying Windows generation; earlier ones bound with dispositions" : d2Problems.join("; "));
  const acceptedReceipt = accepted.length === 1 ? receipts[accepted[0].id] : null;

  // SH-D4 (before D3): the retained regression record.
  const manifest = JSON.parse(read("repositories/cca-conformance/mo1310-test-manifest.json").toString("utf8"));
  const rowsRef = record.regression?.rows; let rows = []; let d4 = true; const d4Problems = [];
  if (!fileBound(rowsRef)) { d4 = false; d4Problems.push("rows file missing or digest differs"); } else rows = JSON.parse(read(rowsRef.path).toString("utf8"));
  const seen = new Set();
  for (const row of rows) {
    const key = `${row.suite}#${row.run}`;
    if (seen.has(key)) { d4 = false; d4Problems.push(`${key}: duplicate row`); }
    seen.add(key);
    try { if (sha(read(path.posix.join(path.posix.dirname(rowsRef.path), row.log ?? ""))) !== row.logSha256) { d4 = false; d4Problems.push(`${key}: log digest differs`); } } catch { d4 = false; d4Problems.push(`${key}: log missing`); }
    if (!(typeof row.commit === "string" && /^[0-9a-f]{40}$/u.test(row.commit) && isAncestorOrSame(row.commit, "HEAD"))) { d4 = false; d4Problems.push(`${key}: row commit is not HEAD or an ancestor`); }
  }
  for (const suite of new Set(rows.map((row) => row.suite))) {
    const runs = rows.filter((r) => r.suite === suite).map((r) => r.run).sort((a, b) => a - b);
    if (runs.some((run, i) => run !== i + 1)) { d4 = false; d4Problems.push(`${suite}: run numbers are not 1..n (a rerun must be its own numbered row)`); }
  }
  const passing = (row) => row.exitCode === 0 && row.fail === 0 && row.pass > 0;
  for (const suite of manifest.suites) {
    const own = rows.filter((r) => r.suite === suite.id);
    if (suite.expectedFailingTests) { // fails by design at the v1.3.0 baseline: exactly these test names fail, no other and none missing
      const outcomes = own.map((r) => { try { return matchKnownFailures({ row: r, logText: read(path.posix.join(path.posix.dirname(rowsRef.path), r.log ?? "")).toString("utf8"), names: suite.expectedFailingTests.names }); } catch { return { ok: false, unexpected: [], missing: ["(log unreadable)"] }; } });
      if (!outcomes.some((o) => o.ok)) { d4 = false; const last = outcomes[outcomes.length - 1] ?? { unexpected: [], missing: ["(no row)"] }; d4Problems.push(`${suite.id}: the failing tests differ from the pinned names (unexpected: ${last.unexpected.join("; ") || "none"}; missing: ${last.missing.join("; ") || "none"})`); }
      continue;
    }
    if (suite.expectedFailing) { // fails identically at the v1.3.0 baseline: exactly the pinned counts, never anything else
      const pinned = suite.expectedFailing;
      if (!own.some((r) => r.tests === pinned.tests && r.pass === pinned.pass && r.fail === pinned.fail && r.exitCode !== 0)) { d4 = false; d4Problems.push(`${suite.id}: pinned baseline counts ${pinned.pass}/${pinned.tests} not met`); }
      continue;
    }
    if (!own.some(passing)) { d4 = false; d4Problems.push(`${suite.id}: no passing row`); }
    if (suite.expect && !own.some((r) => r.tests === suite.expect.tests && r.pass === suite.expect.pass && r.fail === suite.expect.fail && r.exitCode === 0)) { d4 = false; d4Problems.push(`${suite.id}: strict count ${suite.expect.pass}/${suite.expect.tests} not met`); }
  }
  check("SH-D4", d4 && rows.length > 0, d4 && rows.length > 0 ? `${rows.length} suite-run rows, each bound to its own log and commit; every manifest suite has a passing row; the strict suite met its count` : (d4Problems.slice(0, 6).join("; ") || "no rows"));

  // SH-D3: every requirement has a passing case.
  let inventory; try { inventory = JSON.parse(read("repositories/cca-conformance/mo1310-conformance-inventory.json").toString("utf8")); } catch { inventory = null; }
  let d3 = inventory !== null && acceptedReceipt !== null; const d3Problems = [];
  if (d3) {
    const outcome = new Map(acceptedReceipt.cases.map((c) => [c.id, c.outcome]));
    for (const requirement of inventory.requirements) {
      const suitesNeeded = new Set(requirement.cloud.tests.map((t) => t.suite));
      const cloudOk = [...suitesNeeded].every((suite) => rows.filter((r) => r.suite === suite).some(passing));
      const cases = requirement.windows.families.flatMap((family) => inventory.campaign.families[family].cases);
      const windowsOk = cases.every((id) => outcome.get(id) === "PASS" || outcome.get(id) === "RECORDED");
      if (!cloudOk || !windowsOk) { d3 = false; d3Problems.push(requirement.id); }
    }
  } else d3Problems.push("inventory or accepted receipt missing");
  check("SH-D3", d3, d3 ? "all 24 requirements have a passing regression row and, where the campaign covers them, passing campaign cases" : `uncovered: ${d3Problems.join(", ")}`);

  // SH-D5: the differential gate against v1.3.0 and the proof that lets the C++ CTest run be skipped.
  let d5 = false; let d5Detail = "no differential receipt bound";
  if (fileBound(record.differential?.receipt)) {
    const gate = JSON.parse(read(record.differential.receipt.path).toString("utf8"));
    const c1 = acceptedReceipt?.cases?.find((c) => c.id === "SH-C1");
    const proof = c1?.nativeChangeProof;
    const baseOk = gate.baseline === BASELINE && typeof gate.candidate === "string" && isAncestorOrSame(gate.candidate, head);
    const verdictOk = /^PASS/u.test(String(gate.verdict ?? ""));
    const proofOk = c1?.outcome === "PASS" && proof?.baseline === BASELINE && Array.isArray(proof?.nativePaths) && proof.nativePaths.length === 0;
    d5 = baseOk && verdictOk && proofOk;
    d5Detail = d5 ? "the Node differential against v1.3.0 passes and the no-C/C++-change proof (SH-C1) is bound, so the C++ CTest run is skipped with proof" : `differential base ${baseOk ? "ok" : "wrong"}, verdict ${verdictOk ? "ok" : String(gate.verdict)}, native proof ${proofOk ? "ok" : "missing or not empty"}`;
  }
  check("SH-D5", d5, d5Detail);

  // SH-D6: release disclosures state every recorded outcome and qualification.
  let d6 = fileBound(record.disclosures); let missing = [];
  if (d6) { const text = read(record.disclosures.path).toString("utf8"); missing = [...generations.filter((g) => !g.accepted).map((g) => g.id), ...(record.qualifications ?? []).map((q) => q.id)].filter((id) => !text.includes(id)); d6 = missing.length === 0; }
  check("SH-D6", d6, d6 ? "the disclosures name every preserved generation and qualification" : `disclosures missing or lacking: ${missing.join(", ") || "file"}`);

  const core = findings.every((f) => f.ok);
  // SH-D7: I3 is the last commit that touched the final record and is in HEAD; the binding-only BF adds only the binding file and names I3.
  let i3 = null; let bound = false; let detail = "the final record has no commit";
  try { i3 = git(["log", "-1", "--format=%H", "--", recordPath]); } catch { i3 = null; }
  if (core && i3) {
    detail = "I3 is in HEAD; no binding-only BF yet";
    let binding = null; try { binding = JSON.parse(read(BINDING_PATH).toString("utf8")); } catch { binding = null; }
    if (binding) {
      const after = git(["diff", "--name-only", i3, "HEAD"]).split("\n").filter(Boolean);
      bound = binding.i3 === i3 && after.length > 0 && after.every((p) => p === BINDING_PATH);
      detail = bound ? "the binding-only BF names I3 and changes nothing else" : "the binding does not name I3, or HEAD changes more than the binding file";
    }
  }
  if (!core) detail = "not evaluated: an earlier rule failed";
  check("SH-D7", !core || (Boolean(i3) && detail !== "the binding does not name I3, or HEAD changes more than the binding file"), detail);
  return conclude(findings, { head, bound });
}

function conclude(findings, extra = {}) {
  const ok = findings.length > 0 && findings.every((f) => f.ok);
  const state = !ok ? "NOT_READY" : extra.bound ? "CERTIFIED_READY_TO_TAG" : "I3_VALID_PENDING_BF";
  return { kind: "MO1310ValidatorResult", version: "1.0.0", state, findings, tagCreated: false };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
  const repo = path.resolve(option("repo", path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..")));
  const result = validate({ repo, recordPath: option("record", RECORD_PATH) });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  process.exitCode = result.state === "NOT_READY" ? 1 : 0;
}
