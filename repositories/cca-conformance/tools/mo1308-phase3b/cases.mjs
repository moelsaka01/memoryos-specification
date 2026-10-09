// MO-1308 Phase 3B: the case implementations (every 3B case is platform-neutral, so there are no host-only declarations).
// Each case takes the audit result of audit.mjs and either records what it observed or throws with the problems it found.
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as A from './audit.mjs';
import { archiveA, archiveB, assembleFromArchive, assembleFromObjects, assembleFromWorktree, extractEntries, listWorktrees, manifestOf } from './assemble.mjs';
import { makeTemp, tempRecord } from '../mo1308-phase3/short-temp.mjs';
import { permissionFlag, runSequence } from './smoke.mjs';
import { corpusRecords } from '../mo1308-phase3/corpus.mjs';
import { git, gitText, revParse, treeEntry, blobBytes } from '../mo1308-phase3/lib/git.mjs';
import { importClosure, scanImports } from '../mo1308-phase3/lib/closure.mjs';
import { verifyCandidate } from '../mo1308-phase3/lib/candidate.mjs';
import { digestOf, sha256Hex, walkRecords } from '../mo1308-phase3/lib/hashing.mjs';
import { stableBytes } from '../mo1308-phase3/lib/stable-json.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
export const PINNED_NODE = Object.freeze({ version: 'v24.21.0', sha256: 'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32' });

export async function makeEnv({ root, option, certifying }) {
  const commit = revParse(root, option('--commit') ?? 'HEAD');
  const read = (relative) => JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'));
  const baseline = JSON.parse(fs.readFileSync(path.join(here, 'baseline.json'), 'utf8'));
  const env = {
    repo: root, commit, bf: baseline.bf, baseline, certifying,
    identity: read('repositories/cca-conformance/mo1308-phase3-candidate-identity.json'),
    evidenceDir: null, cache: {}, temporary: [],
  };
  process.on('exit', () => { for (const directory of env.temporary) fs.rmSync(directory, { recursive: true, force: true }); });
  return env;
}

// A8.9: temporary directories are made under the short temporary root (C:\tt\3b-<n> on Windows), never under the system temp path.
// `purpose` only documents what the directory is for.
const temporary = (env, purpose) => { void purpose; const directory = makeTemp('3b'); env.temporary.push(directory); return directory; };
const productionPaths = (env) => env.identity.productionPaths.map((row) => row.path);
const memo = (env, key, make) => (env.cache[key] ??= make());
const entriesA = (env) => memo(env, 'entriesA', () => assembleFromObjects({ repo: env.repo, commit: env.commit, paths: productionPaths(env) }));
const extracted = (env) => memo(env, 'extracted', () => { const directory = temporary(env, 'mo1308-p3b-closure-'); extractEntries(entriesA(env), directory); return directory; });

function writeArtifact(env, name, bytes) {
  if (env.evidenceDir === null) return null;
  const directory = path.join(env.evidenceDir, 'artifacts');
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, name), bytes, { flag: 'wx' });
  return `artifacts/${name}`;
}

// Records the observation, then fails the case with the first few problems.
function conclude(handle, { problems, observed }) {
  handle.observe(JSON.parse(JSON.stringify(observed)));
  if (problems.length > 0) throw new Error(`${problems.length} problem(s): ${problems.slice(0, 5).join('; ')}`);
}

// The set of repository files Node actually loads when `entry` is imported from an extracted closure.
export function loadedSet(directory, entry, scratch) {
  const log = path.join(scratch, 'loaded.log');
  const hooks = path.join(scratch, 'hooks.mjs');
  const register = path.join(scratch, 'register.mjs');
  const runner = path.join(scratch, `entry-${crypto.randomBytes(4).toString('hex')}.mjs`);
  fs.writeFileSync(hooks, `import fs from 'node:fs';\nexport async function load(url, context, next) { if (url.startsWith('file:')) fs.appendFileSync(process.env.P3B_LOG, url + '\\n'); return next(url, context); }\n`);
  fs.writeFileSync(register, `import { register } from 'node:module';\nregister(${JSON.stringify(pathToFileURL(hooks).href)});\n`);
  fs.writeFileSync(runner, `await import(${JSON.stringify(pathToFileURL(path.join(directory, entry)).href)});\n`);
  fs.rmSync(log, { force: true });
  const run = spawnSync(process.execPath, ['--import', pathToFileURL(register).href, runner], { env: { PATH: process.env.PATH ?? '', P3B_LOG: log }, encoding: 'utf8' });
  if (run.status !== 0) throw new Error(`loading ${entry} failed: ${run.stderr.slice(0, 200)}`);
  return new Set(fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((url) => path.relative(directory, fileURLToPath(url)).split(path.sep).join('/')).filter((relative) => !relative.startsWith('..')));
}

const sorted = (set) => [...set].sort();
function staticVersusLoaded(env, root, loadEntry) {
  const directory = extracted(env);
  const scratch = temporary(env, 'mo1308-p3b-hook-');
  const staticFiles = A.closureFiles({ repo: env.repo, commit: env.commit, root });
  const loaded = loadedSet(directory, loadEntry, scratch);
  loaded.add(root);
  const problems = staticFiles.errors.map((error) => error.code);
  const staticSet = new Set(staticFiles.files);
  for (const file of staticSet) if (!loaded.has(file)) problems.push(`${file}: in the static closure but not loaded`);
  for (const file of loaded) if (!staticSet.has(file)) problems.push(`${file}: loaded but not in the static closure`);
  const rows = staticFiles.files.map((file) => ({ path: file, blob: treeEntry(env.repo, env.commit, file).blob }));
  return { problems, observed: { files: rows.length, builtins: staticFiles.builtins, loadedEqualsStatic: problems.length === 0, closureDigest: digestOf(Buffer.from(JSON.stringify(rows))) } };
}

// Run the SDK history flow in a process that may read only the closure and the script, write nothing and spawn nothing.
function runtimeNoIoProof(env) {
  const flag = permissionFlag();
  if (flag === null) return { problems: ['this Node has no permission model'], observed: {} };
  const directory = extracted(env);
  const scratch = temporary(env, 'mo1308-p3b-perm-');
  const byId = new Map(corpusRecords().map((record) => [record.id, record]));
  const record = byId.get('policy-0');
  const members = record.members.map((member) => ({ name: member.name, base64: Buffer.from(member.bytes).toString('base64') }));
  const sdkUrl = pathToFileURL(path.join(directory, 'repositories/cca-studio/web/js/memoryos-sdk.js')).href;
  const script = path.join(scratch, 'proof.mjs');
  fs.writeFileSync(script, `
import * as sdk from ${JSON.stringify(sdkUrl)};
const input = JSON.parse(process.argv[2]);
const members = input.members.map((m) => ({ name: m.name, bytes: new Uint8Array(Buffer.from(m.base64, 'base64')) }));
const created = sdk.createHistoryLedger({ ledgerName: 'p3b-proof', workspaceIdentifier: 'workspace-investigation' });
let ledger = sdk.verifyHistoryLedger({ descriptorBytes: created.descriptorBytes, entries: [], members: new Map() });
const admission = sdk.admitHistoryRecord({ recordKind: 'POLICY_EVALUATION', members, ledger });
const appended = sdk.appendHistoryEntry({ ledger, admission });
const retained = new Map([[admission.recordDigest, members]]);
ledger = sdk.verifyHistoryLedger({ descriptorBytes: created.descriptorBytes, entries: [appended.entryBytes], members: retained });
const query = sdk.queryHistoryLedger({ descriptorBytes: created.descriptorBytes, entries: [appended.entryBytes], query: { kind: 'MemoryOSHistoryQuery', version: '1.0.0', recordKinds: [], subject: null, retention: 'ANY', fromIndex: 0, limit: 10 } });
const exported = sdk.buildHistoryExport({ descriptorBytes: created.descriptorBytes, entries: [appended.entryBytes], members: retained });
const verified = sdk.verifyHistoryExport({ files: exported.files });
const fs = await import('node:fs');
let writeDenied = false;
try { fs.writeFileSync(${JSON.stringify(path.join(scratch, 'denied.txt'))}, 'x'); } catch (error) { writeDenied = error.code === 'ERR_ACCESS_DENIED'; }
let childDenied = false;
try { (await import('node:child_process')).spawnSync(process.execPath, ['-e', '0']); } catch (error) { childDenied = error.code === 'ERR_ACCESS_DENIED'; }
let readDenied = false;
try { fs.readFileSync(${JSON.stringify(path.join(env.repo, 'LICENSE'))}); } catch (error) { readDenied = error.code === 'ERR_ACCESS_DENIED'; }
console.log(JSON.stringify({ entries: query.entries.length, exportFiles: exported.files.length, verifiedEntries: verified.entryCount, head: ledger.headDigest, writeDenied, childDenied, readDenied }));
`);
  const run = spawnSync(process.execPath, [flag, `--allow-fs-read=${directory}`, `--allow-fs-read=${scratch}`, script, JSON.stringify({ members })],
    { env: { PATH: process.env.PATH ?? '' }, encoding: 'utf8' });
  const problems = [];
  let proof = null;
  if (run.status !== 0) problems.push(`the in-memory history flow failed under the permission model: ${(run.stderr || '').split('\n').find((line) => line.includes('Error')) ?? run.status}`);
  else {
    proof = JSON.parse(run.stdout);
    if (!proof.writeDenied || !proof.childDenied || !proof.readDenied) problems.push(`the permission model did not deny write, child process and out-of-closure read (${JSON.stringify(proof)})`);
    if (proof.entries !== 1 || proof.verifiedEntries !== 1) problems.push('the in-memory flow produced an unexpected result');
  }
  return { problems, observed: { permissionFlag: flag, proof } };
}

function nodeProvenance(env) {
  const exec = fs.readFileSync(process.execPath);
  const python = ['python3', 'python'].map((name) => spawnSync(name, ['--version'], { encoding: 'utf8' })).find((run) => run.status === 0);
  const observed = {
    node: process.version, nodeSha256: sha256Hex(exec), platform: process.platform, arch: process.arch,
    git: gitText(env.repo, ['--version']), python: python === undefined ? null : (python.stdout || python.stderr).trim(),
    pinnedNode: process.version === PINNED_NODE.version && sha256Hex(exec) === PINNED_NODE.sha256,
  };
  const problems = [];
  if (env.certifying) {
    if (!observed.pinnedNode) problems.push(`Node ${observed.node} (${observed.nodeSha256.slice(0, 8)}) is not the pinned ${PINNED_NODE.version}`);
    if (observed.platform !== 'win32' || observed.arch !== 'x64') problems.push(`a certifying run is native Windows x64, not ${observed.platform} ${observed.arch}`);
  }
  return { problems, observed };
}

const BANNED_IMPORTS = new Set(['node:http', 'node:https', 'node:net', 'node:dns', 'node:tls', 'node:dgram', 'node:http2', 'node:worker_threads', 'node:cluster']);
const BANNED_WORDS = /\b(?:npm|npx|pnpm|yarn|pip|pip3|curl|wget)\b/;
export function auditToolSources(env) {
  const files = [
    ...walkRecords(here).map((row) => path.join(here, row.path)),
    ...walkRecords(path.join(here, '..', 'mo1308-phase3', 'lib')).map((row) => path.join(here, '..', 'mo1308-phase3', 'lib', row.path)),
  ].filter((file) => file.endsWith('.mjs'));
  const problems = [];
  for (const file of files) {
    const source = fs.readFileSync(file, 'utf8');
    for (const specifier of scanImports(source).specifiers) if (BANNED_IMPORTS.has(specifier)) problems.push(`${path.relative(env.repo, file)} imports ${specifier}`);
    const stripped = source.split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
    if (/\bfetch\s*\(/.test(stripped)) problems.push(`${path.relative(env.repo, file)} calls fetch`);
    // the words npm, pip, curl... may only appear in comments, strings that describe them and this scanner
    if (!file.endsWith('cases.mjs') && BANNED_WORDS.test(stripped.replace(/'[^'\n]*'|"[^"\n]*"|`[^`]*`/g, ''))) problems.push(`${path.relative(env.repo, file)} names a package manager or downloader`);
  }
  return { problems, observed: { toolFilesScanned: files.length } };
}

export const impls = {
  // A: lineage and path allowlist
  '3B-A1': (h, env) => conclude(h, A.auditIdentity({ repo: env.repo, commit: env.commit, identity: env.identity })),
  '3B-A2': (h, env) => conclude(h, A.auditLineage({ repo: env.repo, commit: env.commit, bf: env.bf })),
  '3B-A3': (h, env) => conclude(h, A.auditChangedPaths({ repo: env.repo, commit: env.commit, bf: env.bf })),
  '3B-A4': (h, env) => conclude(h, A.auditReleasedBytes({ repo: env.repo, commit: env.commit, bf: env.bf, baseline: env.baseline })),
  // B: released closure identity
  '3B-B1': (h, env) => conclude(h, A.auditSdkCopies({ repo: env.repo, commit: env.commit, baseline: env.baseline })),
  '3B-B2': (h, env) => conclude(h, A.auditActionBundle({ repo: env.repo, commit: env.commit, baseline: env.baseline })),
  '3B-B3': (h, env) => conclude(h, A.auditClosures({ repo: env.repo, commit: env.commit, bf: env.bf, baseline: env.baseline, only: ['MO-1303-vscode', 'MO-1304-mcp', 'MO-1305-rest', 'MO-1306-ci'] })),
  '3B-B4': (h, env) => conclude(h, A.auditReadiness({ repo: env.repo, commit: env.commit, baseline: env.baseline })),
  '3B-B5': (h, env) => conclude(h, A.auditTags({ repo: env.repo, baseline: env.baseline })),
  // C: dependency audit
  '3B-C1': (h, env) => conclude(h, A.auditManifests({ repo: env.repo, commit: env.commit, bf: env.bf })),
  '3B-C2': (h, env) => conclude(h, A.auditImports({ repo: env.repo, commit: env.commit })),
  '3B-C3': (h, env) => conclude(h, A.auditHistoryImports({ repo: env.repo, commit: env.commit })),
  '3B-C4': (h, env) => {
    const statics = A.auditNoIo({ repo: env.repo, commit: env.commit });
    const runtime = runtimeNoIoProof(env);
    conclude(h, { problems: [...statics.problems, ...runtime.problems], observed: { static: Object.fromEntries(Object.entries(statics.observed).map(([file, row]) => [path.basename(file), row])), runtime: runtime.observed } });
  },
  '3B-C5': (h, env) => conclude(h, A.auditSupply({ repo: env.repo, commit: env.commit, bf: env.bf })),
  // D: source closure
  '3B-D1': (h, env) => conclude(h, staticVersusLoaded(env, 'repositories/memoryos-cli/bin/memoryos.js', 'repositories/memoryos-cli/src/main.js')),
  '3B-D2': (h, env) => conclude(h, staticVersusLoaded(env, 'repositories/cca-studio/web/js/memoryos-sdk.js', 'repositories/cca-studio/web/js/memoryos-sdk.js')),
  '3B-D3': (h, env) => conclude(h, A.auditClosureEqualsIdentity({ repo: env.repo, commit: env.commit, identity: env.identity })),
  '3B-D4': (h, env) => {
    const manifest = manifestOf(entriesA(env));
    const artifact = writeArtifact(env, 'closure-manifest.json', stableBytes({ ...manifest, commit: env.commit, productionTreeDigest: env.identity.productionTreeDigest }));
    h.observe({ files: manifest.files.length, filesDigest: manifest.filesDigest, artifact });
  },
  // E: reproducibility
  '3B-E1': (h, env) => {
    const a = manifestOf(entriesA(env));
    const b = manifestOf(assembleFromArchive({ repo: env.repo, commit: env.commit, paths: productionPaths(env) }));
    const problems = a.filesDigest === b.filesDigest ? [] : ['the object-database and git-archive assemblies differ'];
    const aFiles = new Map(a.files.map((row) => [row.path, JSON.stringify(row)]));
    for (const row of b.files) if (aFiles.get(row.path) !== JSON.stringify(row)) problems.push(`${row.path}: assemblies differ`);
    conclude(h, { problems, observed: { files: a.files.length, filesDigest: a.filesDigest, equal: problems.length === 0 } });
  },
  '3B-E2': (h, env) => {
    const reference = manifestOf(entriesA(env)).filesDigest;
    // The repository may have any number of other worktrees; the case checks only the ones it makes itself (by path): they are gone afterwards.
    const registeredBefore = listWorktrees(env.repo);
    const digests = Object.fromEntries(['true', 'false'].map((setting) => [setting, manifestOf(assembleFromWorktree({ repo: env.repo, commit: env.commit, paths: productionPaths(env), autocrlf: setting })).filesDigest]));
    const problems = Object.entries(digests).filter(([, digest]) => digest !== reference).map(([setting]) => `a clean worktree with core.autocrlf=${setting} differs from the object assembly`);
    const registeredAfter = listWorktrees(env.repo);
    const left = registeredAfter.filter((worktree) => !registeredBefore.includes(worktree));
    if (left.length > 0) problems.push(`the case left worktrees behind: ${left.join(', ')}`);
    conclude(h, { problems, observed: { reference, worktrees: digests, ownWorktreesLeftBehind: left.length, temporaryRoot: { base: tempRecord().base, maxLength: tempRecord().maxLength } } });
  },
  '3B-E3': (h, env) => {
    const a = archiveA(entriesA(env));
    const b = archiveB(assembleFromArchive({ repo: env.repo, commit: env.commit, paths: productionPaths(env) }));
    const problems = a.equals(b) ? [] : ['the two archive writers produced different bytes'];
    conclude(h, { problems, observed: { archiveBytes: a.length, archiveSha256: digestOf(a), identical: problems.length === 0 } });
  },
  // F: offline smoke
  '3B-F1': (h, env) => {
    const directory = extracted(env);
    const work = temporary(env, 'mo1308-p3b-smoke-closure-');
    const problems = [];
    if (walkRecords(directory).length !== productionPaths(env).length) problems.push('the extracted closure has files other than the production paths');
    const run = runSequence({ cliPath: path.join(directory, 'repositories/memoryos-cli/bin/memoryos.js'), workDirectory: work });
    for (const row of run.results) if (row.status !== 0) problems.push(`${row.command} exited ${row.status}`);
    env.cache.closureRun = run;
    conclude(h, { problems, observed: { commands: run.results.map((row) => [row.command, row.status]), ledgerFiles: run.ledgerFiles.length, exportFiles: run.exportFiles.length } });
  },
  '3B-F2': (h, env) => {
    const closure = env.cache.closureRun;
    if (closure === undefined) throw new Error('3B-F1 has not produced a closure run');
    const problems = verifyCandidate({ repo: env.repo, identity: env.identity, worktree: true });
    const work = temporary(env, 'mo1308-p3b-smoke-tree-');
    const tree = runSequence({ cliPath: path.join(env.repo, 'repositories/memoryos-cli/bin/memoryos.js'), workDirectory: work });
    tree.results.forEach((row, index) => {
      if (row.stdout !== closure.results[index].stdout || row.status !== closure.results[index].status) problems.push(`${row.command}: output differs from the closure run`);
    });
    if (JSON.stringify(tree.ledgerFiles) !== JSON.stringify(closure.ledgerFiles)) problems.push('the ledger directories differ');
    if (JSON.stringify(tree.exportFiles) !== JSON.stringify(closure.exportFiles)) problems.push('the export directories differ');
    conclude(h, { problems, observed: { identical: problems.length === 0, stdoutBytes: tree.results.map((row) => row.stdout.length), ledgerFiles: tree.ledgerFiles.length, exportFiles: tree.exportFiles.length } });
  },
  // G: provenance
  '3B-G1': (h, env) => conclude(h, nodeProvenance(env)),
  '3B-G2': (h, env) => {
    const sources = auditToolSources(env);
    const closure = extracted(env);
    const problems = [...sources.problems];
    const stray = [];
    const find = (directory) => fs.readdirSync(directory, { withFileTypes: true }).forEach((entry) => { if (entry.name === 'node_modules') stray.push(path.join(directory, entry.name)); else if (entry.isDirectory()) find(path.join(directory, entry.name)); });
    find(closure);
    for (const file of stray) problems.push(`${file}: a node_modules directory appeared`);
    conclude(h, { problems, observed: { ...sources.observed, networkImports: 0, packageManagers: 0, nodeModulesDirectories: stray.length } });
  },
  '3B-G3': (h, env) => {
    const manifest = manifestOf(entriesA(env));
    const license = treeEntry(env.repo, env.commit, 'LICENSE');
    const supply = A.auditSupply({ repo: env.repo, commit: env.commit, bf: env.bf });
    const problems = [...supply.problems];
    if (license === null) problems.push('LICENSE is missing');
    if (!manifest.files.every((row) => row.path.startsWith('repositories/'))) problems.push('a closure file is outside repositories/');
    const statement = {
      kind: 'MO1308Phase3BLicenseStatement', version: '1.0.0', commit: env.commit, files: manifest.files.length, firstPartyOnly: problems.length === 0,
      thirdParty: [], sbom: 'none (owner decision D9: closure manifest instead of an SBOM)', licenseBlob: license === null ? null : license.blob,
      handWrittenCryptography: supply.observed.handWrittenSha256, filesDigest: manifest.filesDigest,
    };
    const artifact = writeArtifact(env, 'license-statement.json', stableBytes(statement));
    conclude(h, { problems, observed: { ...statement, artifact } });
  },
};
void git; void blobBytes; void importClosure;
