// MO-1309 closure and MO-1308-unchanged audit (DB26, DB27; cases 3-gate and 4B-C1, 4B-C2). Read-only: it runs `git` queries and reads
// source text; it executes no product or test code and writes nothing.
//   node tools/mo1309/audit.mjs [--base <commit>] [--head <rev>] [--repo <dir>]
// Exit 0 when every check holds, 1 otherwise; one JSON object on standard output.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const BASELINE_BF = "bf2fdc87e9b2bfc25588ef61deacac6c04684376";
export const MODIFIABLE_DOCUMENTS = Object.freeze(["ARCHITECTURE.md", "CHANGELOG.md", "ROADMAP.md"]);
// Paths MO-1309 (or the already-accepted post-BF MO-1308 evidence on main) may ADD relative to BF. Anything else is a violation.
export const ADDITION_PREFIXES = Object.freeze([
  "docs/mo1309-",
  "docs/mo1308-3d-d4-deviation-disposition.md",
  "repositories/cca-conformance/evidence/mo1308/phase3d/",
  "repositories/cca-conformance/tools/mo1308-phase3d/regress-as-run.mjs",
  "repositories/cca-conformance/evidence/mo1309/",
  "repositories/cca-conformance/tools/mo1309/",
  "repositories/cca-conformance/tests/mo1309_",
  "repositories/cca-conformance/mo1309-",
  "repositories/cca-studio/web/js/memoryos-dashboard-",
  "repositories/cca-studio/web/dashboard/",
  "repositories/cca-studio/scripts/memoryos-dashboard-",
  "repositories/cca-studio/scripts/generate-memoryos-dashboard-fixtures.mjs",
  "repositories/cca-studio/tests/memoryos_dashboard_",
  "repositories/cca-studio/tests/support-dashboard-",
  "repositories/cca-studio/tests/support-devtools.mjs",
  "repositories/cca-studio/tests/fixtures/memoryos-dashboard/",
]);
const DEPENDENCY_FILES = /(^|\/)(package\.json|package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|vcpkg\.json|requirements[^/]*\.txt|CMakeLists\.txt)$/u;

// `entries`: [{ status: "A"|"M"|"D"|"R"|..., path }] as `git diff --name-status` gives them. Pure.
export function classifyDiff(entries) {
  const violations = [];
  for (const { status, path: file } of entries) {
    if (status === "M" && MODIFIABLE_DOCUMENTS.includes(file)) continue;
    if (status === "A" && ADDITION_PREFIXES.some((prefix) => file.startsWith(prefix))) {
      if (DEPENDENCY_FILES.test(file)) violations.push({ path: file, reason: "a dependency, build or lock file was added" });
      continue;
    }
    violations.push({ path: file, reason: status === "A" ? "an addition outside the MO-1309 paths" : `status ${status} on a released path` });
  }
  return violations;
}

const git = (repo, args) => execFileSync("git", args, { cwd: repo, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 });

export function diffEntries(repo, base, head) {
  return git(repo, ["diff", "--name-status", "--no-renames", `${base}`, head]).split("\n").filter(Boolean).map((line) => {
    const [status, ...rest] = line.split("\t");
    return { status: status[0], path: rest.join("\t") };
  });
}

// DB26: every MO-1308 production path of the candidate identity file has, at `head`, the blob the identity records (and BF had).
export function productionPathCheck(repo, base, head) {
  const identity = JSON.parse(fs.readFileSync(path.join(repo, "repositories/cca-conformance/mo1308-phase3-candidate-identity.json"), "utf8"));
  const problems = [];
  for (const entry of identity.productionPaths) {
    const blobAtHead = git(repo, ["rev-parse", `${head}:${entry.path}`]).trim();
    const blobAtBase = git(repo, ["rev-parse", `${base}:${entry.path}`]).trim();
    if (blobAtHead !== entry.blob || blobAtBase !== entry.blob) problems.push({ path: entry.path, recorded: entry.blob, base: blobAtBase, head: blobAtHead });
  }
  return { count: identity.productionPaths.length, problems };
}

// DB27: no new import specifier in MO-1309 source other than a relative path or a `node:` built-in.
export const importSpecifiers = (text) => [...text.matchAll(/(?:^|[\s;])(?:import|export)\b[^;'"]*?\bfrom\s*["']([^"']+)["']|\bimport\s*["']([^"']+)["']|\bimport\(\s*["']([^"']+)["']\s*\)|\brequire\(\s*["']([^"']+)["']\s*\)/gmu)]
  .map((match) => match[1] ?? match[2] ?? match[3] ?? match[4]);
export const isAllowedSpecifier = (specifier) => specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("node:");

export function importScan(repo, head, files) {
  const offenders = [];
  for (const file of files) {
    for (const specifier of importSpecifiers(git(repo, ["show", `${head}:${file}`]))) if (!isAllowedSpecifier(specifier)) offenders.push({ file, specifier });
  }
  return offenders;
}

export function audit({ repo, base = BASELINE_BF, head = "HEAD" }) {
  const baseCommit = git(repo, ["rev-parse", "--verify", `${base}^{commit}`]).trim();
  const headCommit = git(repo, ["rev-parse", "--verify", `${head}^{commit}`]).trim();
  let baseIsAncestor = true;
  try { git(repo, ["merge-base", "--is-ancestor", baseCommit, headCommit]); } catch { baseIsAncestor = false; }
  const entries = diffEntries(repo, baseCommit, headCommit);
  const violations = classifyDiff(entries);
  const production = productionPathCheck(repo, baseCommit, headCommit);
  const sourceFiles = entries.filter((entry) => entry.status === "A" && /\.(m?js)$/u.test(entry.path) && ADDITION_PREFIXES.some((prefix) => entry.path.startsWith(prefix))
    && /^repositories\/(cca-studio\/(web\/js|web\/dashboard|scripts)|cca-conformance\/tools\/mo1309)\//u.test(entry.path)).map((entry) => entry.path);
  const imports = importScan(repo, headCommit, sourceFiles);
  const ok = baseIsAncestor && violations.length === 0 && production.problems.length === 0 && imports.length === 0;
  return { kind: "MO1309ClosureAudit", version: "1.0.0", base: baseCommit, head: headCommit, baseIsAncestor, changedPaths: entries.length,
    modified: entries.filter((entry) => entry.status !== "A").map((entry) => `${entry.status} ${entry.path}`), violations,
    mo1308Production: { paths: production.count, changed: production.problems }, importScan: { files: sourceFiles.length, offenders: imports }, ok };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  const option = (name, fallback) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args[i + 1] : fallback; };
  const repo = path.resolve(option("repo", path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..")));
  const result = audit({ repo, base: option("base", BASELINE_BF), head: option("head", "HEAD") });
  process.stdout.write(`${JSON.stringify(result)}\n`);
  process.exitCode = result.ok ? 0 : 1;
}
