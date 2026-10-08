// MO-1308 Phase 3 shared library: the candidate identity. The candidate is the production path set of the corrected head f4211c8c (b0bf2d56 before Amendment A8.9, B2 before A8.8), by git blob (owner
// decision D1): the static import closure of the CLI entry and of the SDK facade, plus the three non-import files that decide
// how that code runs (the two package.json "type" declarations and the CLI CMake file). Evidence-only descendants are allowed;
// any change to a blob of this set, or to the closure itself, makes a different candidate.
import fs from 'node:fs';
import path from 'node:path';
import { blobIfPresent, git, gitText, revParse, treeEntry, treeOf } from './git.mjs';
import { importClosure } from './closure.mjs';
import { digestOfJson } from './hashing.mjs';
import { stableStringify } from './stable-json.mjs';

export const CANDIDATE_KIND = 'MO1308Phase3CandidateIdentity';
export const PREVIOUS_CANDIDATE_B2 = '47595cc95204307dd43c4772c417b52f0ac8402b';
export const PREVIOUS_CANDIDATE_B0BF = 'b0bf2d5618e76512867bcdf49f805b22a7e12774';
export const CANDIDATE_BASE = 'f4211c8c502f771bc78c2d2ab509c20d2b715676';
export const CANDIDATE_RULES = Object.freeze({
  roots: Object.freeze(['repositories/memoryos-cli/bin/memoryos.js', 'repositories/cca-studio/web/js/memoryos-sdk.js']),
  extras: Object.freeze([
    'repositories/cca-studio/package.json',
    'repositories/memoryos-cli/CMakeLists.txt',
    'repositories/memoryos-cli/package.json',
  ]),
  closure: 'static-import',
});

function closureOf(read) {
  const closure = importClosure(read, CANDIDATE_RULES.roots);
  const errors = [...closure.errors];
  if (closure.externals.length > 0) errors.push({ file: null, code: 'EXTERNAL_IMPORT', specifier: closure.externals.join(',') });
  return { closure, errors };
}

function describe({ closure, errors }, entryOf, extra) {
  const problems = errors.map((error) => `${error.code}${error.file === null ? '' : ` in ${error.file}`}${error.specifier === null ? '' : ` (${error.specifier})`}`);
  const files = [...new Set([...closure.files, ...CANDIDATE_RULES.extras])].sort();
  const productionPaths = files.map((file) => {
    const entry = entryOf(file);
    if (entry === null) { problems.push(`MISSING_PATH ${file}`); return null; }
    return { path: file, mode: entry.mode, blob: entry.blob };
  }).filter((row) => row !== null);
  return { productionPaths, builtins: closure.builtins, problems, extra };
}

// Computes the identity of one commit from git objects only.
export function computeCandidate({ repo, commit }) {
  const resolved = revParse(repo, commit);
  const read = (relative) => { const bytes = blobIfPresent(repo, resolved, relative); return bytes === null ? null : bytes.toString('utf8'); };
  const found = describe(closureOf(read), (file) => treeEntry(repo, resolved, file), null);
  if (found.problems.length > 0) throw new Error(`candidate identity cannot be computed: ${found.problems.join('; ')}`);
  return {
    kind: CANDIDATE_KIND, version: '1.0.0',
    baseCommit: resolved, baseTree: treeOf(repo, resolved),
    rules: { roots: [...CANDIDATE_RULES.roots], extras: [...CANDIDATE_RULES.extras], closure: CANDIDATE_RULES.closure },
    builtins: found.builtins,
    productionPaths: found.productionPaths,
    productionTreeDigest: digestOfJson(found.productionPaths),
  };
}

// The same computation over a working tree. Blob ids are computed with git's own filters (`hash-object --path`), so an
// autocrlf checkout hashes like the committed blob. The file mode is not compared for a working tree.
export function computeWorktreeCandidate({ repo }) {
  const read = (relative) => { try { return fs.readFileSync(path.join(repo, relative), 'utf8'); } catch { return null; } };
  const blobOf = (relative) => {
    try {
      const result = git(repo, ['hash-object', `--path=${relative}`, '--', path.join(repo, relative)], { allowFailure: true });
      return result.status === 0 ? result.stdout.toString('utf8').trim() : null;
    } catch { return null; }
  };
  const found = describe(closureOf(read), (file) => { const blob = blobOf(file); return blob === null ? null : { mode: null, blob }; }, null);
  return { productionPaths: found.productionPaths, problems: found.problems, builtins: found.builtins };
}

// Verifies a recorded identity: first against its own base commit (the record must be exactly reproducible), then, if given,
// against a descendant commit or the working tree (every base blob unchanged and no path added to the set).
export function verifyCandidate({ repo, identity, against = null, worktree = false }) {
  const problems = [];
  if (identity.kind !== CANDIDATE_KIND || identity.version !== '1.0.0') return ['not a candidate identity record'];
  let recomputed;
  try { recomputed = computeCandidate({ repo, commit: identity.baseCommit }); } catch (error) { return [error.message]; }
  if (stableStringify(recomputed) !== stableStringify(identity)) problems.push('the record differs from the identity recomputed at its base commit');
  if (identity.productionTreeDigest !== digestOfJson(identity.productionPaths)) problems.push('productionTreeDigest does not match productionPaths');
  const compare = (candidate, label) => {
    const baseByPath = new Map(identity.productionPaths.map((row) => [row.path, row]));
    for (const row of candidate.productionPaths) {
      const base = baseByPath.get(row.path);
      if (base === undefined) problems.push(`${label}: ${row.path} joined the production set`);
      else if (base.blob !== row.blob) problems.push(`${label}: ${row.path} changed (${base.blob.slice(0, 8)} -> ${row.blob.slice(0, 8)})`);
    }
    const present = new Set(candidate.productionPaths.map((row) => row.path));
    for (const row of identity.productionPaths) if (!present.has(row.path)) problems.push(`${label}: ${row.path} left the production set`);
    for (const message of candidate.problems ?? []) problems.push(`${label}: ${message}`);
  };
  if (against !== null) {
    try {
      const commit = revParse(repo, against);
      const descendant = computeCandidateLoose({ repo, commit });
      compare(descendant, `commit ${commit.slice(0, 8)}`);
    } catch (error) { problems.push(`cannot read commit ${against}: ${error.message}`); }
  }
  if (worktree) compare(computeWorktreeCandidate({ repo }), 'worktree');
  return problems;
}

// Like computeCandidate, but returns problems instead of throwing, so a descendant that broke the closure is reported.
function computeCandidateLoose({ repo, commit }) {
  const read = (relative) => { const bytes = blobIfPresent(repo, commit, relative); return bytes === null ? null : bytes.toString('utf8'); };
  const found = describe(closureOf(read), (file) => treeEntry(repo, commit, file), null);
  return { productionPaths: found.productionPaths, problems: found.problems };
}

export const describeCommit = (repo, commit) => gitText(repo, ['log', '-1', '--format=%H %s', commit]);
