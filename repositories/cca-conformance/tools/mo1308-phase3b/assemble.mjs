// MO-1308 Phase 3B: closure assemblers. Three independent ways to obtain the bytes of the candidate's production path set:
// from git objects (A), from `git archive` output parsed by a tar reader (B), and from files checked out into a clean
// worktree under a chosen line-ending setting (C). Each returns entries {path, mode, bytes}; the manifest is computed from the
// bytes alone, including the git blob id (computed here, not asked of git), so agreement is a real cross-check.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { git, treeEntry, blobBytes } from '../mo1308-phase3/lib/git.mjs';
import { digestOfJson, sha256Hex } from '../mo1308-phase3/lib/hashing.mjs';
import { readTar, writeTarA, writeTarB } from './tar.mjs';

export const blobId = (bytes) => crypto.createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
const compare = (a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0);

export function manifestOf(entries) {
  const files = [...entries].sort(compare).map((entry) => ({
    path: entry.path, mode: entry.mode, size: entry.bytes.length, sha256: sha256Hex(entry.bytes), blob: blobId(entry.bytes),
  }));
  return { kind: 'MO1308Phase3BClosureManifest', version: '1.0.0', files, filesDigest: digestOfJson(files) };
}

// A: git object database.
export function assembleFromObjects({ repo, commit, paths }) {
  return paths.map((relative) => {
    const entry = treeEntry(repo, commit, relative);
    if (entry === null || entry.type !== 'blob') throw new Error(`assembler A: ${relative} is not a blob at ${commit.slice(0, 8)}`);
    return { path: relative, mode: entry.mode === '100755' ? '100755' : '100644', bytes: Buffer.from(blobBytes(repo, commit, relative)) };
  });
}

// B: `git archive` (a different code path in git) read back with our own tar reader.
export function assembleFromArchive({ repo, commit, paths }) {
  const archive = git(repo, ['archive', '--format=tar', commit, '--', ...paths]).stdout;
  const entries = readTar(archive);
  const wanted = new Set(paths);
  const got = new Set(entries.map((entry) => entry.path));
  for (const relative of wanted) if (!got.has(relative)) throw new Error(`assembler B: ${relative} missing from the archive`);
  return entries.filter((entry) => wanted.has(entry.path));
}

// C: a clean detached worktree with only the production paths checked out, under core.autocrlf = `autocrlf`.
export function assembleFromWorktree({ repo, commit, paths, autocrlf }) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), `mo1308-p3b-wt-${autocrlf}-`));
  try {
    git(repo, ['worktree', 'add', '--detach', '--no-checkout', directory, commit]);
    // The repository's own attribute rules travel with a real clone, so they are checked out too: .gitattributes (eol=lf)
    // is what keeps the production bytes identical under core.autocrlf=true.
    git(directory, ['-c', `core.autocrlf=${autocrlf}`, 'checkout', commit, '--', '.gitattributes', ...paths]);
    const modes = new Map(git(directory, ['ls-files', '-s', '-z']).stdout.toString('utf8').split('\0').filter(Boolean).map((row) => {
      const [meta, file] = row.split('\t');
      return [file, meta.split(' ')[0]];
    }));
    return paths.map((relative) => ({
      path: relative, mode: modes.get(relative) === '100755' ? '100755' : '100644', bytes: fs.readFileSync(path.join(directory, relative)),
    }));
  } finally {
    git(repo, ['worktree', 'remove', '--force', directory], { allowFailure: true });
    fs.rmSync(directory, { recursive: true, force: true });
    git(repo, ['worktree', 'prune'], { allowFailure: true });
  }
}

export const archiveA = (entries) => writeTarA(entries);
export const archiveB = (entries) => writeTarB(entries);

export function extractEntries(entries, directory) {
  for (const entry of entries) {
    const target = path.join(directory, ...entry.path.split('/'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, entry.bytes, { mode: entry.mode === '100755' ? 0o755 : 0o644 });
  }
}
