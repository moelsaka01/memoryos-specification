import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import * as A from '../tools/mo1308-phase3b/audit.mjs';
import { impls, auditToolSources, loadedSet } from '../tools/mo1308-phase3b/cases.mjs';
import { pin } from '../tools/mo1308-phase3b/pin-baseline.mjs';
import { archiveA, archiveB, assembleFromArchive, assembleFromObjects, assembleFromWorktree, blobId, manifestOf } from '../tools/mo1308-phase3b/assemble.mjs';
import { readTar, writeTarA, writeTarB } from '../tools/mo1308-phase3b/tar.mjs';
import { rehearse, checkDefinition } from '../tools/mo1308-phase3/lib/campaign-driver.mjs';
import { git, repositoryRoot } from '../tools/mo1308-phase3/lib/git.mjs';
import { allCases, buildInventory } from '../tools/mo1308-phase3/lib/inventory.mjs';
import { sharedToolPaths } from '../tools/mo1308-phase3/lib/seal.mjs';
import { sha256Hex, walkRecords } from '../tools/mo1308-phase3/lib/hashing.mjs';
import { makeEnv } from '../tools/mo1308-phase3b/cases.mjs';
import { stableStringify } from '../tools/mo1308-phase3/lib/stable-json.mjs';

// MO-1308 Phase 3B (closure and supply audit): the tar writers, the assemblers, every audit function on the real repository and on
// deliberately damaged commits, the pinned baseline, and a complete non-certifying rehearsal. Runs in the cloud and on the host.
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = repositoryRoot(here);
const TOOLS = 'repositories/cca-conformance/tools/mo1308-phase3b';
const BF = '1dd1e8c82fe0ed5a32a894744392f2c279f89d4c';
const baseline = JSON.parse(fs.readFileSync(path.join(repo, TOOLS, 'baseline.json'), 'utf8'));
const identity = JSON.parse(fs.readFileSync(path.join(repo, 'repositories/cca-conformance/mo1308-phase3-candidate-identity.json'), 'utf8'));
const haveTags = baseline.tags.every((tag) => git(repo, ['rev-parse', '-q', '--verify', `refs/tags/${tag.name}`], { allowFailure: true }).status === 0);
const ctx = { repo, commit: 'HEAD', bf: BF, baseline, identity };
const tmp = (t) => { const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mo1308-p3b-test-')); t.after(() => fs.rmSync(directory, { recursive: true, force: true })); return directory; };

// A commit (unreferenced) that descends from HEAD with the given file edits: a Buffer replaces or adds, null removes.
function derive(edits) {
  const index = path.join(os.tmpdir(), `mo1308-p3b-index-${process.pid}-${Math.random().toString(16).slice(2)}`);
  const run = (args, input) => {
    const result = spawnSync('git', args, { cwd: repo, env: { ...process.env, GIT_INDEX_FILE: index }, input, encoding: 'buffer' });
    if (result.status !== 0) throw new Error(`git ${args[0]}: ${result.stderr.toString()}`);
    return result.stdout.toString('utf8').trim();
  };
  try {
    run(['read-tree', 'HEAD']);
    for (const [file, bytes] of Object.entries(edits)) {
      if (bytes === null) run(['update-index', '--force-remove', file]);
      else run(['update-index', '--add', '--cacheinfo', `100644,${run(['hash-object', '-w', '--stdin'], bytes)},${file}`]);
    }
    const tree = run(['write-tree']);
    return run(['-c', 'user.name=t', '-c', 'user.email=t@t', 'commit-tree', tree, '-p', 'HEAD', '-m', 'p3b-test'], Buffer.alloc(0));
  } finally { fs.rmSync(index, { force: true }); }
}
const read = (file, commit = 'HEAD') => git(repo, ['cat-file', 'blob', `${commit}:${file}`]).stdout;
const append = (file, extra) => Buffer.concat([read(file), Buffer.from(extra)]);

// ---------------------------------------------------------------- tar and assemblers

test('T01 the two tar writers are byte-identical and a reader and system tar read the result', () => {
  const entries = [
    { path: 'b/y.txt', mode: '100644', bytes: Buffer.from('hello') }, { path: 'a/x.sh', mode: '100755', bytes: Buffer.alloc(600, 7) },
    { path: `${'z'.repeat(120)}/${'n'.repeat(60)}.js`, mode: '100644', bytes: Buffer.alloc(0) }, { path: 'c', mode: '100644', bytes: Buffer.alloc(512, 1) },
  ];
  const a = writeTarA(entries);
  assert.ok(a.equals(writeTarB(entries)));
  assert.ok(a.equals(writeTarA([...entries].reverse())), 'order of the input does not matter');
  assert.equal(a.length % 512, 0);
  const back = readTar(a);
  assert.deepEqual(back.map((entry) => [entry.path, entry.mode, entry.bytes.length]), [['a/x.sh', '100755', 600], ['b/y.txt', '100644', 5], ['c', '100644', 512], [entries[2].path, '100644', 0]]);
  assert.ok(back.every((entry, index) => entry.bytes.equals(entries.find((item) => item.path === entry.path).bytes)));
  const system = spawnSync('tar', ['-tvf', '-'], { input: a, encoding: 'utf8' });
  if (system.status === 0) assert.equal(system.stdout.trim().split('\n').length, 4);
  assert.throws(() => writeTarA([{ path: 'x'.repeat(300), mode: '100644', bytes: Buffer.alloc(1) }]), /does not fit/);
});

test('T02 tar bytes are canonical: mode, owner and time are fixed', () => {
  const [entry] = [{ path: 'f', mode: '100755', bytes: Buffer.from('x') }];
  const tar = writeTarA([entry]);
  assert.equal(tar.toString('latin1', 100, 107), '0000755');
  assert.equal(tar.toString('latin1', 108, 115), '0000000');
  assert.equal(tar.toString('latin1', 136, 147), '00000000000');
  assert.equal(tar.toString('latin1', 257, 262), 'ustar');
  assert.equal(sha256Hex(writeTarA([entry])), sha256Hex(writeTarB([entry])));
});

test('T03 blob ids are computed without git and match it', () => {
  const bytes = read('LICENSE');
  assert.equal(blobId(bytes), git(repo, ['rev-parse', 'HEAD:LICENSE']).stdout.toString().trim());
  assert.equal(blobId(Buffer.alloc(0)), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
});

test('E01 the object-database, git-archive and clean-worktree assemblies agree, and so do the archives', () => {
  const paths = identity.productionPaths.map((row) => row.path);
  const objects = assembleFromObjects({ repo, commit: 'HEAD', paths });
  const archive = assembleFromArchive({ repo, commit: 'HEAD', paths });
  assert.equal(objects.length, 45);
  assert.equal(manifestOf(objects).filesDigest, manifestOf(archive).filesDigest);
  for (const setting of ['true', 'false']) assert.equal(manifestOf(assembleFromWorktree({ repo, commit: 'HEAD', paths, autocrlf: setting })).filesDigest, manifestOf(objects).filesDigest, `autocrlf=${setting}`);
  assert.ok(archiveA(objects).equals(archiveB(archive)));
  assert.ok(manifestOf(objects).files.every((row, index) => row.blob === identity.productionPaths[index].blob), 'blob ids equal the candidate identity');
  assert.deepEqual(git(repo, ['worktree', 'list']).stdout.toString().trim().split('\n').length, 1, 'no worktree is left behind');
});

// ---------------------------------------------------------------- audits on the real repository

test('A01 lineage, changed paths and released bytes hold for HEAD', () => {
  assert.deepEqual(A.auditIdentity(ctx).problems, []);
  const lineage = A.auditLineage(ctx);
  assert.deepEqual(lineage.problems, []);
  assert.ok(lineage.observed.amendments.includes('A3.3@33') && lineage.observed.amendments.includes('A8@34'));
  const paths = A.auditChangedPaths(ctx);
  assert.deepEqual(paths.problems, []);
  assert.ok(paths.observed.changed >= 186);
  assert.deepEqual(A.auditReleasedBytes(ctx).problems, []);
});

test('B01 released closures, vendored SDK copies, Action manifest and the readiness package hold', { skip: !haveTags }, () => {
  const sdk = A.auditSdkCopies(ctx);
  assert.deepEqual(sdk.problems, []);
  assert.equal(sdk.observed.distinctSha256.length, 1);
  assert.equal(sdk.observed.currentSdkDiffersFromCopies, true);
  const action = A.auditActionBundle(ctx);
  assert.deepEqual(action.problems, []);
  assert.equal(action.observed.manifestRows, 42);
  const closures = A.auditClosures({ ...ctx, only: ['MO-1303-vscode', 'MO-1304-mcp', 'MO-1305-rest', 'MO-1306-ci'] });
  assert.deepEqual(closures.problems, []);
  assert.deepEqual(closures.observed.closures.find((row) => row.id === 'MO-1303-vscode').postTagDifferences, ['repositories/memoryos-vscode/CHANGELOG.md', 'repositories/memoryos-vscode/README.md']);
  const readiness = A.auditReadiness(ctx);
  assert.deepEqual(readiness.problems, []);
  assert.equal(readiness.observed.packageIdentity, 'sha256:0890ca4893ef76118eefbb2b5676ad084c60c70408d9e489f92aa33b74ba45b7');
  assert.equal(readiness.observed.members, 89);
  assert.equal(readiness.observed.archiveMembers, 89);
});

test('B02 the tags are the pinned ones; two are independently recorded in the Freeze', { skip: !haveTags }, () => {
  const tags = A.auditTags(ctx);
  assert.deepEqual(tags.problems, []);
  assert.equal(tags.observed.tags.length, 7);
  assert.deepEqual(tags.observed.independentlyRecorded, ['memoryos-1.3-mo1302', 'memoryos-1.3-mo1307']);
  const wrongObject = JSON.parse(JSON.stringify(baseline));
  wrongObject.tags[2].tagObject = '0'.repeat(40);
  assert.ok(A.auditTags({ repo, baseline: wrongObject }).problems.some((p) => p.includes('memoryos-1.3-mo1303')));
  const extra = JSON.parse(JSON.stringify(baseline));
  extra.tags.push({ name: 'memoryos-1.3-mo9999', tagObject: '1'.repeat(40), commit: '2'.repeat(40) });
  assert.ok(A.auditTags({ repo, baseline: extra }).problems.some((p) => p.includes('memoryos-1.3-mo9999')));
  const truth = JSON.parse(JSON.stringify(baseline));
  truth.groundTruth['memoryos-1.3-mo1302'].commit = '3'.repeat(40);
  assert.ok(A.auditTags({ repo, baseline: truth }).problems.some((p) => p.includes('differs from the Freeze record')));
});

test('B03 the pinned baseline is reproducible from the repository tags', { skip: !haveTags }, () => {
  assert.equal(stableStringify(pin()), stableStringify(baseline));
  assert.equal(baseline.bf, BF);
  assert.equal(baseline.closures.length, 6);
  assert.equal(baseline.sdkCopies.length, 4);
});

test('C01 dependency, import, history-boundary, no-I/O and supply audits hold for HEAD', () => {
  const manifests = A.auditManifests(ctx);
  assert.deepEqual(manifests.problems, []);
  assert.deepEqual(manifests.observed.changed.map((row) => [row.file, row.differing]),
    [['repositories/cca-studio/package.json', ['scripts']], ['repositories/memoryos-cli/package.json', ['version']]]);
  const imports = A.auditImports(ctx);
  assert.deepEqual(imports.problems, []);
  assert.deepEqual(imports.observed.builtins, ['node:fs', 'node:path']);
  const history = A.auditHistoryImports(ctx);
  assert.deepEqual(history.problems, []);
  assert.equal(history.observed.transitiveReachesCore, true, 'disclosed: the owner modules reach the Core, the history modules do not import it');
  assert.equal(history.observed.transitiveReachesSdk, false);
  assert.deepEqual(A.auditNoIo(ctx).problems, []);
  const supply = A.auditSupply(ctx);
  assert.deepEqual(supply.problems, []);
  assert.deepEqual(supply.observed.handWrittenSha256.map((file) => path.basename(file)), ['memoryos-history-admission.js', 'mip-canonical.js']);
  assert.deepEqual(A.auditClosureEqualsIdentity(ctx).problems, []);
});

test('C02 the forbidden-identifier scan ignores strings, comments, properties and object keys', () => {
  assert.deepEqual(A.forbiddenIdentifiers('const a = "process"; // fetch\n/* eval */ const b = x.process.exitCode; const c = { process: 1 };'), []);
  assert.deepEqual(A.forbiddenIdentifiers('const t = process.env; eval("1"); fetch(u); setTimeout(f, 1);'), ['eval', 'fetch', 'process', 'setTimeout']);
});

// ---------------------------------------------------------------- audits on damaged commits

test('N01 a changed production blob breaks the identity and the closure-equals-identity audits', () => {
  const commit = derive({ 'repositories/cca-studio/web/js/mip-canonical.js': append('repositories/cca-studio/web/js/mip-canonical.js', '\n// edit\n') });
  assert.ok(A.auditIdentity({ ...ctx, commit }).problems.some((p) => p.includes('mip-canonical.js changed')));
  assert.ok(A.auditClosureEqualsIdentity({ ...ctx, commit }).problems.length > 0);
});

test('N02 released content is protected: a vendored SDK, a closure file, an addition to a closure, a released document', () => {
  const sdkPath = baseline.sdkCopies[1].path;
  assert.ok(A.auditSdkCopies({ ...ctx, commit: derive({ [sdkPath]: append(sdkPath, '// x\n') }) }).problems.some((p) => p.includes(sdkPath)));
  const mcp = 'repositories/memoryos-mcp/package.json';
  const changed = derive({ [mcp]: append(mcp, '\n') });
  assert.ok(A.auditClosures({ ...ctx, commit: changed, only: ['MO-1304-mcp'] }).problems.length > 0);
  assert.ok(A.auditReleasedBytes({ ...ctx, commit: changed }).problems.some((p) => p.includes('released content changed')));
  const added = derive({ 'repositories/memoryos-rest/NEW.md': Buffer.from('x') });
  assert.ok(A.auditReleasedBytes({ ...ctx, commit: added }).problems.some((p) => p.includes('added to a released closure')));
  const doc = derive({ 'docs/mo1307-phase3d-certification.md': append('docs/mo1307-phase3d-certification.md', '\n') });
  assert.ok(A.auditReleasedBytes({ ...ctx, commit: doc }).problems.some((p) => p.includes('mo1307-phase3d')));
  const evidence = derive({ 'repositories/cca-conformance/evidence/mo1307/phase3d/accepted-inputs/3b/final-validation.json': Buffer.from('{}') });
  assert.ok(A.auditReleasedBytes({ ...ctx, commit: evidence }).problems.length > 0);
  const vscode = 'repositories/memoryos-vscode/runtime/vendor/repositories/cca-studio/web/js/memoryos-sdk.js';
  assert.ok(A.auditClosures({ ...ctx, commit: derive({ [vscode]: append(vscode, '\n') }), only: ['MO-1303-vscode'] }).problems.length > 0);
});

test('N03 the readiness package and the Action bundle detect a changed member', { skip: !haveTags }, () => {
  const member = 'repositories/memoryos-readiness/src/index.mjs';
  const readiness = A.auditReadiness({ ...ctx, commit: derive({ [member]: append(member, '// x\n') }) });
  assert.ok(readiness.problems.some((p) => p.includes('package identity')) && readiness.problems.some((p) => p.includes('src/index.mjs')));
  const action = '.github/actions/memoryos-policy-gate/action.yml';
  const bundle = A.auditActionBundle({ ...ctx, commit: derive({ [action]: append(action, '# x\n') }) });
  assert.ok(bundle.problems.some((p) => p.includes('action.yml')));
});

test('N04 dependency manifests: a new dependency, a changed lockfile, an added manifest and a wrong version are all findings', () => {
  const cli = JSON.parse(read('repositories/memoryos-cli/package.json'));
  const withDependency = derive({ 'repositories/memoryos-cli/package.json': Buffer.from(`${JSON.stringify({ ...cli, dependencies: { left: '1.0.0' } }, null, 2)}\n`) });
  assert.ok(A.auditManifests({ ...ctx, commit: withDependency }).problems.some((p) => p.includes('dependencies')));
  const wrongVersion = derive({ 'repositories/memoryos-cli/package.json': Buffer.from(`${JSON.stringify({ ...cli, version: '9.9.9' }, null, 2)}\n`) });
  assert.ok(A.auditManifests({ ...ctx, commit: wrongVersion }).problems.some((p) => p.includes('expected 1.2.0')));
  assert.ok(A.auditManifests({ ...ctx, commit: derive({ 'repositories/cca-studio/package-lock.json': append('repositories/cca-studio/package-lock.json', ' ') }) }).problems.some((p) => p.includes('lockfile')));
  assert.ok(A.auditManifests({ ...ctx, commit: derive({ 'tools/package.json': Buffer.from('{}') }) }).problems.some((p) => p.includes('added')));
  assert.ok(A.auditManifests({ ...ctx, commit: derive({ 'vcpkg.json': append('vcpkg.json', ' ') }) }).problems.some((p) => p.includes('vcpkg')));
});

test('N05 the history boundary: an SDK import, a node import and process use are findings', () => {
  const ledger = 'repositories/cca-studio/web/js/memoryos-history-ledger.js';
  assert.ok(A.auditHistoryImports({ ...ctx, commit: derive({ [ledger]: Buffer.concat([Buffer.from('import "./memoryos-sdk.js";\n'), read(ledger)]) }) }).problems.some((p) => p.includes('memoryos-sdk.js')));
  assert.ok(A.auditHistoryImports({ ...ctx, commit: derive({ [ledger]: Buffer.concat([Buffer.from('import "./investigation-core.js";\n'), read(ledger)]) }) }).problems.length > 0);
  assert.ok(A.auditNoIo({ ...ctx, commit: derive({ [ledger]: Buffer.concat([Buffer.from('import fs from "node:fs";\n'), read(ledger)]) }) }).problems.some((p) => p.includes('node:fs')));
  assert.ok(A.auditNoIo({ ...ctx, commit: derive({ [ledger]: append(ledger, '\nconst leak = process.env;\n') }) }).problems.some((p) => p.includes('process')));
  assert.ok(A.auditImports({ ...ctx, commit: derive({ [ledger]: Buffer.concat([Buffer.from('import x from "left-pad";\n'), read(ledger)]) }) }).problems.some((p) => p.includes('external import')));
  assert.ok(A.auditImports({ ...ctx, commit: derive({ [ledger]: Buffer.concat([Buffer.from('import "node:crypto";\n'), read(ledger)]) }) }).problems.some((p) => p.includes('node:crypto')));
});

test('N06 supply: a changed license, an added notice and a third copy of the hand-written hash are findings', () => {
  assert.ok(A.auditSupply({ ...ctx, commit: derive({ LICENSE: append('LICENSE', '\n') }) }).problems.some((p) => p.includes('LICENSE')));
  assert.ok(A.auditSupply({ ...ctx, commit: derive({ 'repositories/memoryos-cli/NOTICES.md': Buffer.from('x') }) }).problems.some((p) => p.includes('added')));
  const policy = 'repositories/cca-studio/web/js/policy-canonical.js';
  assert.ok(A.auditSupply({ ...ctx, commit: derive({ [policy]: append(policy, '\nconst K = [0x428a2f98];\n') }) }).problems.some((p) => p.includes('hand-written SHA-256')));
});

test('N07 lineage: a rewritten Freeze, a missing amendment and a path outside the allowed set are findings', () => {
  const freeze = 'docs/mo1308-contract-freeze-1.md';
  const rewritten = derive({ [freeze]: Buffer.from(read(freeze).toString('utf8').replace('FROZEN — CONTRACT FREEZE 1', 'FROZEN - CONTRACT FREEZE 1')) });
  assert.ok(A.auditLineage({ ...ctx, commit: rewritten }).problems.some((p) => p.includes('append-only')));
  const dropped = derive({ [freeze]: Buffer.from(read(freeze).toString('utf8').replace('## 25. Amendment A2', '## 25. Addendum A2')) });
  assert.ok(A.auditLineage({ ...ctx, commit: dropped }).problems.length > 0);
  const outside = derive({ 'repositories/memoryos-readiness/src/new.mjs': Buffer.from('x'), 'package.json': Buffer.from('{}') });
  assert.deepEqual(A.auditChangedPaths({ ...ctx, commit: outside }).problems.map((p) => p.split(' ')[0]).sort(), ['package.json', 'repositories/memoryos-readiness/src/new.mjs']);
  assert.ok(A.auditLineage({ ...ctx, bf: git(repo, ['rev-parse', 'HEAD']).stdout.toString().trim() }).problems.length > 0, 'BF must be an ancestor of B2');
});

// ---------------------------------------------------------------- the campaign

test('S01 the 3B definition covers every case, with nothing host-only', () => {
  const inventory = buildInventory();
  assert.deepEqual(checkDefinition({ inventory, stream: '3B', impls, hostOnly: {} }), []);
  assert.equal(Object.keys(impls).length, allCases(inventory).filter((item) => item.stream === '3B').length);
});

test('S02 the tool sources use no network module and no package manager', () => {
  const result = auditToolSources({ repo });
  assert.deepEqual(result.problems, []);
  assert.ok(result.observed.toolFilesScanned > 20);
});

test('S03 a complete non-certifying rehearsal passes every case, verifies its own evidence, and writes the closure artifacts', { skip: !haveTags, timeout: 240000 }, async (t) => {
  const directory = path.join(tmp(t), 'r1');
  const env = await makeEnv({ root: repo, option: () => null, certifying: false });
  const toolPaths = [...sharedToolPaths(repo), ...walkRecords(path.join(repo, TOOLS)).map((row) => `${TOOLS}/${row.path}`)].sort();
  const result = await rehearse({ root: repo, stream: '3B', evidenceDir: directory, impls, hostOnly: {}, env, toolPaths });
  assert.equal(result.receipt.result, 'REHEARSAL_COMPLETED', JSON.stringify(result.summary));
  assert.equal(result.summary.executedPass, 26);
  assert.deepEqual(result.problems, []);
  assert.equal(result.receipt.certifying, false);
  assert.equal(result.receipt.promotable, false);
  const manifest = JSON.parse(fs.readFileSync(path.join(directory, 'artifacts/closure-manifest.json'), 'utf8'));
  assert.equal(manifest.files.length, 45);
  assert.equal(manifest.productionTreeDigest, identity.productionTreeDigest);
  const statement = JSON.parse(fs.readFileSync(path.join(directory, 'artifacts/license-statement.json'), 'utf8'));
  assert.equal(statement.firstPartyOnly, true);
  assert.deepEqual(statement.thirdParty, []);
  const step = (id) => JSON.parse(fs.readFileSync(path.join(directory, `steps/${id}.json`), 'utf8'));
  assert.equal(step('F').cases[1].observed.identical, true);
  assert.equal(step('C').cases[3].observed.runtime.proof.writeDenied, true);
  assert.equal(step('D').cases[0].observed.loadedEqualsStatic, true);
  assert.equal(step('E').cases[1].observed.worktrees.true, step('E').cases[1].observed.worktrees.false);
  assert.ok(zlib.gzipSync(Buffer.alloc(1)).length > 0);
  void loadedSet;
});

test('S04 a certifying seal needs the pinned Node and native Windows (G1 refuses a rehearsal-grade host)', async () => {
  const env = await makeEnv({ root: repo, option: () => null, certifying: true });
  const run = async () => { const observed = {}; await impls['3B-G1']({ observe: (values) => Object.assign(observed, values) }, env); return observed; };
  if (process.platform === 'win32' && process.version === 'v24.21.0') await run();
  else await assert.rejects(run(), /not the pinned|native Windows/);
  const lenient = await makeEnv({ root: repo, option: () => null, certifying: false });
  const observed = {};
  await impls['3B-G1']({ observe: (values) => Object.assign(observed, values) }, lenient);
  assert.equal(typeof observed.node, 'string');
  assert.equal(typeof observed.pinnedNode, 'boolean');
});
