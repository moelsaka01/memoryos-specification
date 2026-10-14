#!/usr/bin/env node
// MO-1308 Phase 3: compute and verify the candidate identity (owner decision D1).
//   node candidate-identity.mjs compute [--commit SHA] [--out FILE]
//   node candidate-identity.mjs verify --file FILE [--commit SHA | --worktree]
// `compute` defaults to the recorded base commit B2. `verify` always re-derives the record from git objects at its own base
// commit; --commit or --worktree additionally checks a descendant commit or the working tree against it. Read-only except --out.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANDIDATE_BASE, computeCandidate, verifyCandidate } from './lib/candidate.mjs';
import { repositoryRoot } from './lib/git.mjs';
import { stableBytes } from './lib/stable-json.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = repositoryRoot(here);
const [command, ...rest] = process.argv.slice(2);
const option = (name) => { const index = rest.indexOf(name); return index === -1 ? null : rest[index + 1] ?? null; };

if (command === 'compute') {
  const identity = computeCandidate({ repo, commit: option('--commit') ?? CANDIDATE_BASE });
  const bytes = stableBytes(identity);
  const out = option('--out');
  if (out === null) process.stdout.write(bytes);
  else fs.writeFileSync(path.resolve(out), bytes, { flag: 'wx' });
} else if (command === 'verify') {
  const file = option('--file');
  if (file === null) { console.error('verify needs --file'); process.exit(2); }
  const identity = JSON.parse(fs.readFileSync(path.resolve(file), 'utf8'));
  const problems = verifyCandidate({ repo, identity, against: option('--commit'), worktree: rest.includes('--worktree') });
  console.log(JSON.stringify({ result: problems.length === 0 ? 'PASS' : 'FAIL', baseCommit: identity.baseCommit, productionTreeDigest: identity.productionTreeDigest, problems }, null, 2));
  process.exit(problems.length === 0 ? 0 : 1);
} else {
  console.error('usage: candidate-identity.mjs compute [--commit SHA] [--out FILE] | verify --file FILE [--commit SHA | --worktree]');
  process.exit(2);
}
