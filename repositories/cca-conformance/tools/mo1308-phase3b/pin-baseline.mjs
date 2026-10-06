#!/usr/bin/env node
// MO-1308 Phase 3B: pin the released baseline (tags, released closure roots, post-tag differences, the readiness archive) from
// the repository's own fetched tags into baseline.json. Run once at authoring; a certifying run only reads the file.
// Ground truth recorded in the Freeze exists for two tags (MO-1302 in Amendment A1 and MO-1307 in section 1.2); the others are
// pinned from the tags as fetched and are disclosed as trust-on-first-use.
//   node pin-baseline.mjs [--out FILE]     (default: print)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { gitText, git, repositoryRoot } from '../mo1308-phase3/lib/git.mjs';
import { digestOf } from '../mo1308-phase3/lib/hashing.mjs';
import { stableBytes } from '../mo1308-phase3/lib/stable-json.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const repo = repositoryRoot(here);
const BF = '1dd1e8c82fe0ed5a32a894744392f2c279f89d4c';
const TAGS = ['mo1301', 'mo1302', 'mo1303', 'mo1304', 'mo1305', 'mo1306', 'mo1307'].map((id) => `memoryos-1.3-${id}`);
const GROUND_TRUTH = {
  'memoryos-1.3-mo1302': { tagObject: '773dd03829dd6b3632bf43a45578925b1498515d', commit: '7e07bd0db9ab10146f2e0e0bbd67a4c5850cf41d', source: 'Freeze section 24 (Amendment A1)' },
  'memoryos-1.3-mo1307': { tagObject: 'a3042f3bded41ec71deff8dac71691e9a595460b', commit: BF, source: 'Freeze section 1.2' },
};
const CLOSURES = [
  { id: 'MO-1302-action', tag: 'memoryos-1.3-mo1302', roots: ['.github/actions/memoryos-policy-gate', '.github/actions/memoryos-policy-gate-workflow-support'] },
  { id: 'MO-1303-vscode', tag: 'memoryos-1.3-mo1303', roots: ['repositories/memoryos-vscode'] },
  { id: 'MO-1304-mcp', tag: 'memoryos-1.3-mo1304', roots: ['repositories/memoryos-mcp'] },
  { id: 'MO-1305-rest', tag: 'memoryos-1.3-mo1305', roots: ['repositories/memoryos-rest'] },
  { id: 'MO-1306-ci', tag: 'memoryos-1.3-mo1306', roots: ['repositories/memoryos-ci'] },
  { id: 'MO-1307-readiness', tag: 'memoryos-1.3-mo1307', roots: ['repositories/memoryos-readiness'] },
];
const SDK_COPIES = [
  { closure: 'MO-1303-vscode', path: 'repositories/memoryos-vscode/runtime/vendor/repositories/cca-studio/web/js/memoryos-sdk.js' },
  { closure: 'MO-1304-mcp', path: 'repositories/memoryos-mcp/runtime/authoritative/web/js/memoryos-sdk.js' },
  { closure: 'MO-1305-rest', path: 'repositories/memoryos-rest/runtime/authoritative/web/js/memoryos-sdk.js' },
  { closure: 'MO-1306-ci', path: 'repositories/memoryos-ci/runtime/authoritative/web/js/memoryos-sdk.js' },
];
const ARCHIVE = 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h5-corrected/package/memoryos-readiness-0.1.0.tgz';
// The release record names a package identity (sha256 of the canonical member rows), not the archive's own hash.
const PACKAGE_IDENTITY = { value: 'sha256:0890ca4893ef76118eefbb2b5676ad084c60c70408d9e489f92aa33b74ba45b7', members: 89, byteLength: 113247, source: 'docs/mo1307-phase3d-certification.md' };

const peel = (ref) => gitText(repo, ['rev-parse', '--verify', `${ref}^{commit}`]);
const object = (ref) => gitText(repo, ['rev-parse', '--verify', `refs/tags/${ref}`]);
const changed = (from, to, root) => git(repo, ['diff', '--name-only', '-z', from, to, '--', root]).stdout.toString('utf8').split('\0').filter(Boolean).sort();
const blobAt = (commit, file) => gitText(repo, ['rev-parse', '--verify', `${commit}:${file}`]);

export function pin() {
  const tags = TAGS.map((name) => ({ name, tagObject: object(name), commit: peel(name) }));
  for (const [name, truth] of Object.entries(GROUND_TRUTH)) {
    const row = tags.find((item) => item.name === name);
    if (row.tagObject !== truth.tagObject || row.commit !== truth.commit) throw new Error(`${name} differs from the Freeze record`);
  }
  const closures = CLOSURES.map((closure) => {
    const commit = peel(closure.tag);
    const postTagDifferences = closure.roots.flatMap((root) => changed(commit, BF, root));
    return { ...closure, commit, postTagDifferences, bfTrees: closure.roots.map((root) => blobAt(BF, root)) };
  });
  const sdkCopies = SDK_COPIES.map((copy) => ({ ...copy, blob: blobAt(BF, copy.path), tagBlob: blobAt(peel(CLOSURES.find((closure) => closure.id === copy.closure).tag), copy.path) }));
  const archiveBytes = fs.readFileSync(path.join(repo, ARCHIVE));
  if (archiveBytes.length !== PACKAGE_IDENTITY.byteLength) throw new Error('the readiness archive differs in length from its release record');
  const archive = { path: ARCHIVE, byteLength: archiveBytes.length, sha256: digestOf(archiveBytes), members: PACKAGE_IDENTITY.members, packageIdentity: PACKAGE_IDENTITY.value, recordedIn: PACKAGE_IDENTITY.source };
  return {
    kind: 'MO1308Phase3BReleasedBaseline', version: '1.0.0', bf: BF,
    pinnedFrom: 'tags fetched from origin at authoring; independent ground truth exists for memoryos-1.3-mo1302 and memoryos-1.3-mo1307 only',
    groundTruth: GROUND_TRUTH, tags, closures, sdkCopies, archive,
  };
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const bytes = stableBytes(pin());
  const out = process.argv[2] === '--out' ? process.argv[3] : null;
  if (out === null) process.stdout.write(bytes); else fs.writeFileSync(path.resolve(out), bytes, { flag: 'wx' });
}
