// MO-1308 Phase 3 shared library: read-only git access. Every function reads objects; none writes to the repository.
import { spawnSync } from 'node:child_process';

export function git(cwd, args, { allowFailure = false } = {}) {
  const result = spawnSync('git', args, { cwd, maxBuffer: 1 << 30, windowsHide: true, shell: false });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`git ${args[0]} failed (${result.status}): ${result.stderr.toString().trim().slice(0, 300)}`);
  }
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

export const gitText = (cwd, args) => git(cwd, args).stdout.toString('utf8').trim();
export const repositoryRoot = (cwd) => gitText(cwd, ['rev-parse', '--show-toplevel']);
export const revParse = (cwd, rev) => gitText(cwd, ['rev-parse', '--verify', `${rev}^{commit}`]);
export const treeOf = (cwd, commit) => gitText(cwd, ['rev-parse', '--verify', `${commit}^{tree}`]);
export const isAncestor = (cwd, ancestor, descendant) =>
  git(cwd, ['merge-base', '--is-ancestor', ancestor, descendant], { allowFailure: true }).status === 0;

// Entries of one path at a commit: {mode, type, blob, path} or null when the path is absent.
export function treeEntry(cwd, commit, relative) {
  const out = git(cwd, ['ls-tree', '-z', commit, '--', relative]).stdout.toString('utf8');
  const row = out.split('\0').filter(Boolean)[0];
  if (row === undefined) return null;
  const [meta, entryPath] = row.split('\t');
  const [mode, type, blob] = meta.split(' ');
  return { mode, type, blob, path: entryPath };
}

export const blobBytes = (cwd, commit, relative) => git(cwd, ['cat-file', 'blob', `${commit}:${relative}`]).stdout;
export const blobIfPresent = (cwd, commit, relative) => {
  const entry = treeEntry(cwd, commit, relative);
  return entry === null || entry.type !== 'blob' ? null : blobBytes(cwd, commit, relative);
};

// First-parent-agnostic list of commits in (base, head], oldest first, with their parent lists.
export function commitsBetween(cwd, base, head) {
  const out = gitText(cwd, ['rev-list', '--topo-order', '--reverse', '--parents', `${base}..${head}`]);
  return out === '' ? [] : out.split('\n').map((line) => { const [commit, ...parents] = line.split(' '); return { commit, parents }; });
}

export const changedPaths = (cwd, base, head) =>
  git(cwd, ['diff', '--name-only', '-z', '--no-renames', base, head]).stdout.toString('utf8').split('\0').filter(Boolean).sort();
