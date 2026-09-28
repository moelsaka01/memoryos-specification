// One-shot finite engineering campaign. Never writes a source worktree or retries.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { root, evidence, record, check, write } from './common.mjs';
import { packageFiles } from '../mo1307-phase1/package.mjs';

const began = performance.now();
assert.equal(process.platform, 'win32'); assert.equal(process.arch, 'x64'); assert.equal(process.version, 'v24.21.0');
const runtime = record(process.execPath);
assert.equal(runtime.byteLength, 93580104);
assert.equal(runtime.sha256, 'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
assert.equal(process.argv.length, 4); assert.equal(process.argv[2], '--output');
const output = process.argv[3].replaceAll('\\', '/'), absolute = path.resolve(root, output);
assert.ok([evidence + '/semantics/', '.cache/mo1307/phase2d/post-binding/semantics/']
  .some(base => absolute.startsWith(path.resolve(root, base) + path.sep)));
assert.ok(!fs.existsSync(absolute)); fs.mkdirSync(absolute, { recursive: true });
const walk = relative => fs.readdirSync(path.join(root, relative)).sort().flatMap(name => {
  const member = relative + '/' + name, stat = fs.lstatSync(path.join(root, member));
  assert.equal(stat.isSymbolicLink(), false); assert.ok(stat.isDirectory() || stat.isFile());
  return stat.isDirectory() ? walk(member) : [member];
});
const test = 'repositories/cca-conformance/tests/mo1307_phase2d_semantic_test.mjs';
const tools = 'repositories/cca-conformance/tools/';
const names = [...new Set([...packageFiles.map(p => 'repositories/memoryos-readiness/' + p), test,
  ...['semantic-support.mjs', 'semantic-matrices.mjs', 'semantic-campaign.mjs', 'common.mjs'].map(p => tools + 'mo1307-phase2d/' + p),
  tools + 'mo1307-phase1/package.mjs', tools + 'mo1307-phase2b/test-support.mjs',
  'repositories/cca-conformance/evidence/mo1307/phase2a/acceptance/normative-vectors.json',
  'repositories/cca-conformance/evidence/mo1307/phase2b/development/mo1306-source-lineage.json',
  ...walk('repositories/cca-conformance/fixtures/mo1307')])].sort();
const sources = names.map(p => record(p));
write(output + '/campaign.json', { kind: 'MO1307IntegratedSemanticCampaign', version: '1.0.0', startedAt: new Date().toISOString(),
  runtime, sources, expectedTests: 58, engineeringChildTimeoutMs: 120000, retry: false,
  productionNativeOrApiDeadlineChanged: false, nativeHelperLaunch: false, fixedWorkerSemanticFunction: true });
let counts = null, error = null, matrices = [], command = null;
try {
  const args = ['--test', '--test-reporter=tap', '--test-concurrency=1', test];
  const start = performance.now(), child = spawnSync(process.execPath, args,
    { cwd: root, windowsHide: true, encoding: null, timeout: 120000, maxBuffer: 16 * 1024 * 1024 });
  const stdout = child.stdout ?? Buffer.alloc(0), stderr = child.stderr ?? Buffer.alloc(0);
  fs.writeFileSync(path.join(absolute, 'stdout.txt'), stdout, { flag: 'wx' });
  fs.writeFileSync(path.join(absolute, 'stderr.txt'), stderr, { flag: 'wx' });
  const tap = stdout.toString('utf8');
  counts = Object.fromEntries(['tests', 'pass', 'fail', 'cancelled', 'skipped', 'todo']
    .map(key => [key, Number(new RegExp('^# ' + key + ' (\\d+)$', 'm').exec(tap)?.[1] ?? -1)]));
  command = { executable: process.execPath, args, exit: child.status, error: child.error?.code ?? null,
    signal: child.signal, elapsedMs: performance.now() - start,
    stdout: record(output + '/stdout.txt'), stderr: record(output + '/stderr.txt') };
  assert.ifError(child.error); assert.equal(child.status, 0);
  assert.deepEqual(counts, { tests: 58, pass: 58, fail: 0, cancelled: 0, skipped: 0, todo: 0 });
  const names = [...tap.matchAll(/^# Subtest: (.+)$/gm)].map(match => match[1]); assert.equal(names.length, 58);
  const { collectSemanticMatrices } = await import('./semantic-matrices.mjs');
  const collected = collectSemanticMatrices();
  for (const [key, value] of Object.entries(collected)) {
    const target = output + '/' + key + '.json'; write(target, value); matrices.push(record(target));
  }
  const securityTests = names.filter(name => /^D(?:06|10|12|13|14|15|16|18|20|22|24)\b/.test(name));
  assert.ok(securityTests.length >= 24);
  const securityPath = output + '/securityMatrix.json';
  write(securityPath, { kind: 'MO1307IntegratedPureSecurityMatrix', version: '1.0.0', result: 'PASS',
    controls: securityTests.map(name => ({ name, result: 'PASS', observedBy: 'Exact named assertion in retained stdout TAP' })),
    provenance: command.stdout, acceptedProductionPath: 'Actual assessInWorker -> verifyEvidence/verifyResultEvidence -> adaptVerifiedEvidence -> computeReadiness',
    operationalErrorsNotReadiness: true, selfConsistentReadinessTamperRequiresFullRecomputation: true,
    noNativeFilesystemOrHelperClaim: true }); matrices.push(record(securityPath));
} catch (failure) {
  error = { name: failure.name, code: failure.code ?? null, message: failure.message, stack: failure.stack };
}
let sourceStability = true;
try { for (const source of sources) check(source); } catch (failure) {
  sourceStability = false; error ??= { name: failure.name, code: failure.code ?? null, message: failure.message, stack: failure.stack };
}
const result = error === null && sourceStability ? 'PASS' : 'FAIL';
write(output + '/receipt.json', { kind: 'MO1307IntegratedSemanticReceipt', version: '1.0.0', result,
  finishedAt: new Date().toISOString(), elapsedMs: performance.now() - began, runtime, tests: counts,
  command, matrices, sourcesUnchanged: sourceStability, sourceBindings: sources, error,
  scope: 'PURE_INTEGRATED_SEMANTICS_AND_BOUNDED_SECURITY; NATIVE_ACQUISITION_AND_PUBLICATION_COVERED_SEPARATELY' });
console.log(JSON.stringify({ result, tests: counts, matrices: matrices.length, sourceBindings: sources.length,
  elapsedMs: performance.now() - began, error: error?.message ?? null }));
process.exitCode = result === 'PASS' ? 0 : 1;
