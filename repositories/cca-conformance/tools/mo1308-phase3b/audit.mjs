// MO-1308 Phase 3B: the audit functions behind the closure and supply cases. Each takes an explicit context, reads git objects only
// (never the working tree, except where a function says so), and returns {problems, observed}: no problem means the property holds.
// Nothing here touches the network or installs anything.
import fs from 'node:fs';
import zlib from 'node:zlib';
import { blobBytes, blobIfPresent, changedPaths, commitsBetween, git, gitText, isAncestor, revParse, treeEntry } from '../mo1308-phase3/lib/git.mjs';
import { importClosure, scanImports, tokenize } from '../mo1308-phase3/lib/closure.mjs';
import { classifyChangedPath } from '../mo1308-phase3/lib/allowed-paths.mjs';
import { computeCandidate, verifyCandidate } from '../mo1308-phase3/lib/candidate.mjs';
import { digestOf, digestOfJson, sha256Hex } from '../mo1308-phase3/lib/hashing.mjs';
import { readTar } from './tar.mjs';

export const FREEZE = 'docs/mo1308-contract-freeze-1.md';
export const B2 = '47595cc95204307dd43c4772c417b52f0ac8402b';
// Commits the Freeze records as anchors of the MO-1308 history: the authority commit and the Freeze proposal.
export const HISTORY_ANCHORS = Object.freeze(['0c1b7d33866c94d41027ebd222cc3dd5cf836508', 'aa3503652e3040f41ecd00a9afbbeea744d24605']);
const result = (problems, observed = {}) => ({ problems, observed });
const text = (repo, commit, file) => { const bytes = blobIfPresent(repo, commit, file); return bytes === null ? null : bytes.toString('utf8'); };
const listFiles = (repo, commit, root) => git(repo, ['ls-tree', '-r', '-z', '--name-only', commit, '--', root]).stdout.toString('utf8').split('\0').filter(Boolean).sort();

// ---- A ----

export function auditIdentity({ repo, commit, identity }) {
  const problems = verifyCandidate({ repo, identity, against: commit });
  if (!isAncestor(repo, identity.baseCommit, commit)) problems.push(`B2 ${identity.baseCommit.slice(0, 8)} is not an ancestor of the audited commit`);
  return result(problems, { commit, baseCommit: identity.baseCommit, productionPaths: identity.productionPaths.length, productionTreeDigest: identity.productionTreeDigest });
}

export function amendmentHeadings(freezeText) {
  return [...freezeText.matchAll(/^## (\d+)\. Amendment (A\d+(?:\.\d+)?)\b/gm)].map((match) => ({ section: Number(match[1]), amendment: match[2] }));
}

export function auditLineage({ repo, commit, bf }) {
  const problems = [];
  if (!isAncestor(repo, bf, B2)) problems.push('BF is not an ancestor of B2');
  if (!isAncestor(repo, B2, commit)) problems.push('B2 is not an ancestor of the audited commit');
  for (const anchor of HISTORY_ANCHORS) if (!isAncestor(repo, anchor, commit)) problems.push(`history anchor ${anchor.slice(0, 8)} is not reachable (history was rewritten)`);
  const commits = commitsBetween(repo, bf, commit);
  const octopus = commits.filter((row) => row.parents.length > 2);
  if (octopus.length > 0) problems.push(`${octopus.length} commit(s) with more than two parents`);
  const base = text(repo, B2, FREEZE);
  const now = text(repo, commit, FREEZE);
  if (base === null || now === null) problems.push('the Freeze is missing');
  else {
    if (!now.startsWith(base)) problems.push('the Freeze at the audited commit does not start with the Freeze at B2 (it is append-only)');
    const headings = amendmentHeadings(now);
    const first = headings.slice(0, 7).map((row) => row.amendment).join(',');
    if (first !== 'A1,A2,A3,A4,A5,A6,A7') problems.push(`amendments A1-A7 are not intact and ordered (${first})`);
    for (let index = 1; index < headings.length; index += 1) if (headings[index].section <= headings[index - 1].section) problems.push(`amendment ${headings[index].amendment} is out of order`);
  }
  return result(problems, { commitsSinceBf: commits.length, merges: commits.filter((row) => row.parents.length === 2).length, amendments: amendmentHeadings(now ?? '').map((row) => `${row.amendment}@${row.section}`) });
}

export function auditChangedPaths({ repo, commit, bf }) {
  const paths = changedPaths(repo, bf, commit);
  const classes = {};
  const outside = [];
  for (const file of paths) {
    const klass = classifyChangedPath(file);
    if (klass === null) outside.push(file); else classes[klass] = (classes[klass] ?? 0) + 1;
  }
  return result(outside.map((file) => `${file} is outside the allowed path set`), { changed: paths.length, classes });
}

// Amendment A9.1: three test files inside released closures were corrected (checks pinned to their release). Each is authorized by
// path, status and blob; a further change to any of them, or any other change inside a released closure, is a finding.
function authorizedCorrection(repo, commit, baseline, file, status) {
  const entry = (baseline.authorizedCorrections ?? []).find((item) => item.path === file);
  if (entry === undefined || entry.status !== status) return false;
  const found = treeEntry(repo, commit, file);
  return found !== null && found.blob === entry.blob;
}

const PROTECTED = [/^docs\/mo1301-/, /^docs\/mo1302-/, /^docs\/mo1303-/, /^docs\/mo1304-/, /^docs\/mo1305-/, /^docs\/mo1306-/, /^docs\/mo1307-/];
const isEvidenceOutsideMo1308 = (file) => file.startsWith('repositories/cca-conformance/evidence/') && !file.startsWith('repositories/cca-conformance/evidence/mo1308/');
export function auditReleasedBytes({ repo, commit, bf, baseline }) {
  const roots = baseline.closures.flatMap((closure) => closure.roots);
  const problems = [];
  const rows = git(repo, ['diff', '--name-status', '-z', '--no-renames', bf, commit]).stdout.toString('utf8').split('\0').filter(Boolean);
  const observed = { additions: [] };
  for (let index = 0; index + 1 < rows.length; index += 2) {
    const [status, file] = [rows[index], rows[index + 1]];
    const inRoot = roots.some((root) => file === root || file.startsWith(`${root}/`));
    const released = inRoot || PROTECTED.some((pattern) => pattern.test(file)) || isEvidenceOutsideMo1308(file);
    if (!released) continue;
    if (authorizedCorrection(repo, commit, baseline, file, status)) { observed.authorized = [...(observed.authorized ?? []), file]; continue; }
    if (status !== 'A') problems.push(`${file}: released content changed (${status})`);
    else if (inRoot) problems.push(`${file}: a file was added to a released closure`);
    else observed.additions.push(file);
  }
  return result(problems, observed);
}

// ---- B ----

export function auditSdkCopies({ repo, commit, baseline }) {
  const problems = [];
  const observed = [];
  for (const copy of baseline.sdkCopies) {
    const entry = treeEntry(repo, commit, copy.path);
    const blob = entry === null ? null : entry.blob;
    if (blob !== copy.blob || blob !== copy.tagBlob) problems.push(`${copy.path}: ${blob} is not the release blob ${copy.tagBlob}`);
    observed.push({ path: copy.path, blob, sha256: blob === null ? null : sha256Hex(blobBytes(repo, commit, copy.path)) });
  }
  const distinct = [...new Set(observed.map((row) => row.sha256))];
  const current = treeEntry(repo, commit, 'repositories/cca-studio/web/js/memoryos-sdk.js');
  return result(problems, { copies: observed, distinctSha256: distinct, currentSdkDiffersFromCopies: current !== null && current.blob !== baseline.sdkCopies[0].blob });
}

function manifestRows(repo, commit, root, manifestPath, hashKey, sizeKey) {
  const manifest = JSON.parse(blobBytes(repo, commit, manifestPath).toString('utf8'));
  const problems = [];
  for (const row of manifest.files) {
    const bytes = blobIfPresent(repo, commit, `${root}/${row.path}`);
    if (bytes === null) { problems.push(`${root}/${row.path}: listed in the manifest but absent`); continue; }
    if (digestOf(bytes) !== row[hashKey] || bytes.length !== row[sizeKey]) problems.push(`${root}/${row.path}: differs from its manifest row`);
  }
  return { problems, rows: manifest.files.length };
}

const treeId = (repo, commit, root) => { const entry = treeEntry(repo, commit, root); return entry === null ? null : entry.blob; };

export function auditClosures({ repo, commit, bf, baseline, only = null }) {
  const problems = [];
  const observed = [];
  for (const closure of baseline.closures.filter((item) => only === null || only.includes(item.id))) {
    const tagCommit = revParse(repo, closure.tag);
    const row = { id: closure.id, roots: closure.roots, equalToBf: true, postTagDifferences: [] };
    for (const root of closure.roots) {
      if (treeId(repo, commit, root) !== treeId(repo, bf, root)) {
        const rows = git(repo, ['diff', '--name-status', '-z', '--no-renames', bf, commit, '--', root]).stdout.toString('utf8').split('\0').filter(Boolean);
        const unauthorized = [];
        for (let index = 0; index + 1 < rows.length; index += 2) if (!authorizedCorrection(repo, commit, baseline, rows[index + 1], rows[index])) unauthorized.push(rows[index + 1]);
        row.equalToBf = unauthorized.length === 0 && rows.length > 0 ? 'EXCEPT_AUTHORIZED_CORRECTIONS' : false;
        if (unauthorized.length > 0) problems.push(`${closure.id}: ${root} differs from BF (${unauthorized.slice(0, 3).join(', ')})`);
      }
      const changed = git(repo, ['diff', '--name-only', '-z', tagCommit, commit, '--', root]).stdout.toString('utf8').split('\0').filter(Boolean).sort();
      row.postTagDifferences.push(...changed);
    }
    row.postTagDifferences.sort();
    const expected = [...closure.postTagDifferences, ...(baseline.authorizedCorrections ?? []).map((item) => item.path).filter((file) => closure.roots.some((root) => file.startsWith(`${root}/`)))].sort();
    if (JSON.stringify(row.postTagDifferences) !== JSON.stringify(expected)) {
      problems.push(`${closure.id}: differences from the release tag are ${JSON.stringify(row.postTagDifferences)}, expected ${JSON.stringify(expected)}`);
    }
    observed.push(row);
  }
  return result(problems, { closures: observed });
}

export function auditActionBundle({ repo, commit, baseline }) {
  const closure = baseline.closures.find((item) => item.id === 'MO-1302-action');
  const problems = auditClosures({ repo, commit, bf: baseline.bf, baseline, only: ['MO-1302-action'] }).problems;
  const manifest = manifestRows(repo, commit, closure.roots[0], `${closure.roots[0]}/distribution-manifest.json`, 'rawSha256', 'byteCount');
  problems.push(...manifest.problems);
  const tagCommit = revParse(repo, closure.tag);
  const tagTrees = closure.roots.map((root) => treeId(repo, tagCommit, root));
  const nowTrees = closure.roots.map((root) => treeId(repo, commit, root));
  if (JSON.stringify(tagTrees) !== JSON.stringify(nowTrees)) problems.push('the Action roots differ from the memoryos-1.3-mo1302 tag trees');
  return result(problems, { manifestRows: manifest.rows, trees: nowTrees });
}

// The MO-1307 package identity: sha256 of the canonical member rows (package.json "files", sorted), as its release records it.
export const canonicalJson = (value) => (value === null || typeof value !== 'object' ? JSON.stringify(value)
  : Array.isArray(value) ? `[${value.map(canonicalJson).join(',')}]`
    : `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(',')}}`);

export function auditReadiness({ repo, commit, baseline }) {
  const root = 'repositories/memoryos-readiness';
  const problems = auditClosures({ repo, commit, bf: baseline.bf, baseline, only: ['MO-1307-readiness'] }).problems;
  const pkg = JSON.parse(blobBytes(repo, commit, `${root}/package.json`).toString('utf8'));
  const members = [...pkg.files].sort();
  if (members.length !== baseline.archive.members) problems.push(`the package lists ${members.length} members, expected ${baseline.archive.members}`);
  const rows = members.map((member) => {
    const bytes = blobIfPresent(repo, commit, `${root}/${member}`);
    if (bytes === null) { problems.push(`${member}: missing`); return null; }
    return { path: member, byteLength: bytes.length, sha256: digestOf(bytes) };
  }).filter((row) => row !== null);
  const identity = digestOf(Buffer.from(`${canonicalJson(rows)}\n`));
  if (identity !== baseline.archive.packageIdentity) problems.push(`package identity ${identity} differs from ${baseline.archive.packageIdentity}`);
  problems.push(...manifestRows(repo, commit, root, `${root}/distribution-manifest.json`, 'sha256', 'byteLength').problems);
  const archiveBytes = blobBytes(repo, commit, baseline.archive.path);
  if (digestOf(archiveBytes) !== baseline.archive.sha256 || archiveBytes.length !== baseline.archive.byteLength) problems.push('the recorded archive differs from its pinned identity');
  const inArchive = new Map(readTar(zlib.gunzipSync(archiveBytes)).map((entry) => [entry.path.replace(/^package\//, ''), entry.bytes]));
  for (const row of rows) {
    const member = inArchive.get(row.path);
    if (member === undefined) problems.push(`${row.path}: not in the archive`);
    else if (digestOf(member) !== row.sha256) problems.push(`${row.path}: differs between the archive and the tree`);
  }
  if (inArchive.size !== members.length) problems.push(`the archive has ${inArchive.size} members, the package ${members.length}`);
  return result(problems, { members: members.length, packageIdentity: identity, archiveSha256: digestOf(archiveBytes), archiveMembers: inArchive.size });
}

export function auditTags({ repo, baseline }) {
  const problems = [];
  const observed = [];
  const present = gitText(repo, ['tag', '--list', 'memoryos-1.3-*']).split('\n').filter(Boolean).sort();
  const expected = baseline.tags.map((tag) => tag.name).sort();
  if (JSON.stringify(present) !== JSON.stringify(expected)) problems.push(`memoryos-1.3-* tags are ${JSON.stringify(present)}, expected ${JSON.stringify(expected)}`);
  for (const tag of baseline.tags) {
    const object = git(repo, ['rev-parse', '--verify', '-q', `refs/tags/${tag.name}`], { allowFailure: true });
    if (object.status !== 0) { problems.push(`${tag.name}: absent`); continue; }
    const id = object.stdout.toString().trim();
    const type = gitText(repo, ['cat-file', '-t', id]);
    const commit = revParse(repo, tag.name);
    if (id !== tag.tagObject) problems.push(`${tag.name}: tag object ${id.slice(0, 8)} is not ${tag.tagObject.slice(0, 8)}`);
    if (type !== 'tag') problems.push(`${tag.name}: not an annotated tag`);
    if (commit !== tag.commit) problems.push(`${tag.name}: peels to ${commit.slice(0, 8)}, expected ${tag.commit.slice(0, 8)}`);
    observed.push({ name: tag.name, tagObject: id, commit, type });
  }
  for (const [name, truth] of Object.entries(baseline.groundTruth)) {
    const row = observed.find((item) => item.name === name);
    if (row === undefined || row.tagObject !== truth.tagObject || row.commit !== truth.commit) problems.push(`${name}: differs from the Freeze record (${truth.source})`);
  }
  return result(problems, { tags: observed, independentlyRecorded: Object.keys(baseline.groundTruth) });
}

// ---- C ----

const MANIFEST_NAMES = new Set(['package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'vcpkg.json', 'vcpkg-configuration.json']);
const ALLOWED_PACKAGE_DIFFERENCES = new Set(['version', 'scripts']);
const allManifests = (repo, commit) => git(repo, ['ls-tree', '-r', '-z', '--name-only', commit]).stdout.toString('utf8').split('\0').filter((file) => file !== '' && MANIFEST_NAMES.has(file.split('/').at(-1)));

export function auditManifests({ repo, commit, bf }) {
  const problems = [];
  const before = new Set(allManifests(repo, bf));
  const after = new Set(allManifests(repo, commit));
  for (const file of after) if (!before.has(file)) problems.push(`${file}: a dependency manifest was added`);
  for (const file of before) if (!after.has(file)) problems.push(`${file}: a dependency manifest was removed`);
  const changed = [];
  for (const file of [...after].filter((item) => before.has(item))) {
    const old = blobBytes(repo, bf, file);
    const now = blobBytes(repo, commit, file);
    if (old.equals(now)) continue;
    const name = file.split('/').at(-1);
    if (name !== 'package.json') { problems.push(`${file}: a lockfile or vcpkg manifest changed`); continue; }
    const a = JSON.parse(old.toString('utf8'));
    const b = JSON.parse(now.toString('utf8'));
    const differing = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((key) => JSON.stringify(a[key]) !== JSON.stringify(b[key])).sort();
    const forbidden = differing.filter((key) => !ALLOWED_PACKAGE_DIFFERENCES.has(key));
    if (forbidden.length > 0) problems.push(`${file}: members changed that can affect dependencies: ${forbidden.join(', ')}`);
    if (differing.includes('version') && b.version !== '1.2.0') problems.push(`${file}: version changed to ${b.version}, expected 1.2.0`);
    changed.push({ file, differing, version: b.version });
  }
  return result(problems, { manifests: after.size, changed });
}

const readFrom = (repo, commit) => (file) => text(repo, commit, file);
export const PRODUCTION_ROOTS = Object.freeze(['repositories/memoryos-cli/bin/memoryos.js', 'repositories/cca-studio/web/js/memoryos-sdk.js']);

export function auditImports({ repo, commit }) {
  const closure = importClosure(readFrom(repo, commit), PRODUCTION_ROOTS);
  const problems = closure.errors.map((error) => `${error.code}${error.file === null ? '' : ` in ${error.file}`}`);
  for (const specifier of closure.externals) problems.push(`external import ${specifier}`);
  for (const builtin of closure.builtins) if (!['node:fs', 'node:path'].includes(builtin)) problems.push(`unexpected built-in ${builtin}`);
  return result(problems, { files: closure.files.length, builtins: closure.builtins, externals: closure.externals });
}

const HISTORY_MODULES = ['contract', 'ledger', 'admission'].map((name) => `repositories/cca-studio/web/js/memoryos-history-${name}.js`);
const JS = 'repositories/cca-studio/web/js/';
export const HISTORY_ALLOWED_IMPORTS = Object.freeze([
  `${JS}mip-canonical.js`, `${JS}memory-investigation-package.js`, `${JS}investigation-policy-engine.js`, `${JS}policy-canonical.js`,
  `${JS}regression-policy-fact-source.js`, `${JS}memoryos-history-contract.js`, `${JS}memoryos-history-ledger.js`,
]);
const FORBIDDEN_DIRECT = [`${JS}memoryos-sdk.js`, `${JS}investigation-core.js`];

export function auditHistoryImports({ repo, commit }) {
  const problems = [];
  const direct = {};
  for (const module of HISTORY_MODULES) {
    const { specifiers, dynamicNonLiteral } = scanImports(text(repo, commit, module));
    if (dynamicNonLiteral > 0) problems.push(`${module}: dynamic import`);
    direct[module] = specifiers;
    for (const specifier of specifiers) {
      if (!specifier.startsWith('./')) { problems.push(`${module}: imports ${specifier}`); continue; }
      const resolved = `${JS}${specifier.slice(2)}`;
      if (FORBIDDEN_DIRECT.includes(resolved) || !HISTORY_ALLOWED_IMPORTS.includes(resolved)) problems.push(`${module}: imports ${resolved}`);
    }
  }
  const transitive = importClosure(readFrom(repo, commit), HISTORY_MODULES);
  return result(problems, { direct, transitiveFiles: transitive.files.length, transitiveReachesCore: transitive.files.includes(`${JS}investigation-core.js`), transitiveReachesSdk: transitive.files.includes(`${JS}memoryos-sdk.js`) });
}

const FORBIDDEN_WORDS = new Set(['process', 'require', 'fetch', 'XMLHttpRequest', 'WebSocket', 'Deno', 'Bun', 'eval', 'child_process', 'readFileSync', 'writeFileSync', 'openSync', 'setTimeout', 'setInterval']);
// Identifiers that perform I/O or reach the host. A word that follows `.` is a property name, one before `:` an object key.
export function forbiddenIdentifiers(source) {
  const tokens = tokenize(source);
  const found = new Set();
  tokens.forEach((token, index) => {
    if (token.type !== 'word' || !FORBIDDEN_WORDS.has(token.value)) return;
    const before = tokens[index - 1];
    const after = tokens[index + 1];
    if (before?.type === 'punct' && before.value === '.') return;
    if (after?.type === 'punct' && after.value === ':') return;
    found.add(token.value);
  });
  return [...found].sort();
}

export function auditNoIo({ repo, commit }) {
  const problems = [];
  const observed = {};
  for (const module of [...HISTORY_MODULES, 'repositories/cca-studio/web/js/memoryos-sdk.js']) {
    const source = text(repo, commit, module);
    const words = forbiddenIdentifiers(source);
    const nodeImports = scanImports(source).specifiers.filter((specifier) => specifier.startsWith('node:'));
    observed[module] = { forbiddenIdentifiers: words, nodeImports };
    for (const word of words) problems.push(`${module}: uses ${word}`);
    for (const specifier of nodeImports) problems.push(`${module}: imports ${specifier}`);
  }
  return result(problems, observed);
}

const LICENSE_FILE = /(^|\/)(LICENSE|NOTICE|NOTICES|LICENSE-NOTICE)(\.[A-Za-z]+)?$/i;
export const SHA256_CONSTANT = '0x428a2f98';
export function auditSupply({ repo, commit, bf }) {
  const problems = [];
  const files = (c) => git(repo, ['ls-tree', '-r', '-z', '--name-only', c]).stdout.toString('utf8').split('\0').filter((file) => file !== '' && (LICENSE_FILE.test(file) || file.includes('/notices/')));
  const before = new Set(files(bf));
  const after = new Set(files(commit));
  for (const file of after) {
    if (!before.has(file)) problems.push(`${file}: a license or notice file was added`);
    else if (!blobBytes(repo, bf, file).equals(blobBytes(repo, commit, file))) problems.push(`${file}: a license or notice file changed`);
  }
  for (const file of before) if (!after.has(file)) problems.push(`${file}: a license or notice file was removed`);
  const closure = importClosure(readFrom(repo, commit), PRODUCTION_ROOTS);
  const handWritten = closure.files.filter((file) => text(repo, commit, file).includes(SHA256_CONSTANT));
  const expected = [`${JS}memoryos-history-admission.js`, `${JS}mip-canonical.js`];
  if (JSON.stringify(handWritten) !== JSON.stringify(expected)) problems.push(`hand-written SHA-256 appears in ${JSON.stringify(handWritten)}, expected ${JSON.stringify(expected)}`);
  if (closure.builtins.includes('node:crypto')) problems.push('the production closure imports node:crypto');
  return result(problems, { licenseAndNoticeFiles: after.size, handWrittenSha256: handWritten, thirdParty: [] });
}

// ---- D ----

export function closureFiles({ repo, commit, root }) {
  return importClosure(readFrom(repo, commit), [root]);
}

export function auditClosureEqualsIdentity({ repo, commit, identity }) {
  const now = computeCandidate({ repo, commit });
  const problems = [];
  if (JSON.stringify(now.productionPaths.map((row) => row.path)) !== JSON.stringify(identity.productionPaths.map((row) => row.path))) problems.push('the production path list differs from the candidate identity');
  if (now.productionTreeDigest !== identity.productionTreeDigest) problems.push('productionTreeDigest differs from the candidate identity');
  return result(problems, { paths: now.productionPaths.length, productionTreeDigest: now.productionTreeDigest });
}

export const manifestDigest = (manifest) => digestOfJson(manifest);
export const emptyLedgerProbe = null;
void fs;
