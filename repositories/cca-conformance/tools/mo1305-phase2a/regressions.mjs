/** The six unchanged predecessor groups frozen by the Phase 1 trigger policy. */
import assert from 'node:assert/strict';
import {spawn, spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve, relative} from 'node:path';
const root = resolve(import.meta.dirname, '../../../..');
const node = resolve(root, '.cache/mo1305-phase2a/toolchain/node.exe');
const output = resolve(root, '.cache/mo1305-phase2a/regressions');
const git = 'C:/Program Files/Git/cmd/git.exe';
const limitBytes = 2 * 1024 * 1024;
const timeoutMs = 450000;
const overallMs = 1200000;
const partial = process.argv.slice(2).includes('--complete');
const afterTypescript = process.argv.slice(2).includes('--after-typescript');
const continueAfterSetup = afterTypescript || process.argv.slice(2).includes('--continue');
const afterMcp = process.argv.slice(2).includes('--after-mcp');
const resume = afterMcp || continueAfterSetup || partial || process.argv.slice(2).includes('--resume');
assert.ok(process.argv.length === 2 || (process.argv.length === 3 && resume), 'ARGUMENTS');
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const canonical = value => JSON.stringify(value, (_, value) => value && !Array.isArray(value) && typeof value === 'object' ? Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)) : value);
const groups = [
 ['mo1301-sdk', ['memoryos_policy_sdk_test.mjs', 'investigation_policy_test.mjs', 'investigation_policy_contracts_test.mjs', 'investigation_policy_engine_test.mjs', 'policy_canonical_test.mjs', 'policy_fact_context_test.mjs', 'regression_policy_fact_source_test.mjs', 'memoryos_sdk_test.mjs'].map(file => 'repositories/cca-studio/tests/' + file)],
 ['core-mip', ['mip_adversarial_conformance_test.mjs', 'mip_canonical_test.mjs', 'mip_derived_edge_conformance_test.mjs', 'mip_ordering_conformance_test.mjs', 'mip_pipeline_conformance_test.mjs', 'mip_schema_conformance_test.mjs', 'investigation_core_test.mjs'].map(file => 'repositories/cca-studio/tests/' + file)],
 ['mo1302-projections', ['--test-name-pattern=CLI transport|real bundled orchestration|valid MO-1301 evaluation failures|artifact verifier rejections|wrong decision/exit', 'repositories/cca-conformance/tests/mo1302_action_foundation_conformance_test.mjs']],
 ['mo1303-io-inspection', ['--test-name-pattern=secure input|exact bytes|inspection|Policy|policy|artifact|verification', 'repositories/memoryos-vscode/tests/runtime_foundation.test.mjs']],
 ['mo1304-semantic-integrity', ['contracts.test.mjs', 'delegation.test.mjs', 'integrity.test.mjs', 'dispatcher.test.mjs'].map(file => 'repositories/memoryos-mcp/tests/' + file)],
 ['cli-secondary', ['repositories/memoryos-cli/tests/policy-cli.test.mjs']],
];
const testPaths = groups.flatMap(([, files]) => files.filter(file => !file.startsWith('--')));
const inputs = () => testPaths.map(path => ({path, byteLength: readFileSync(resolve(root, path)).length, sha256: hash(readFileSync(resolve(root, path)))}));
const gitRead = args => { const result = spawnSync(git, args, {cwd: root, encoding: 'utf8', windowsHide: true, timeout: 15000, maxBuffer: 1048576, env: {...process.env, GIT_OPTIONAL_LOCKS: '0'}}); assert.equal(result.status, 0, result.stderr); return result.stdout.trim(); };
const clean = Object.fromEntries(Object.entries(process.env).filter(([key]) => !/^(NODE_|OPENSSL_|SSL_CERT_|UV_|HTTP_PROXY$|HTTPS_PROXY$|ALL_PROXY$|NO_PROXY$)/i.test(key)));
clean.PATH = [resolve(root, '.cache/mo1305-phase2a/toolchain'), 'C:/Program Files/Git/cmd', process.env.PATH ?? ''].join(';');
mkdirSync(output, {recursive: true});
const started = process.hrtime.bigint();
const originalInputs = inputs();
const receipt = {kind: 'MemoryOSRESTPhase2APredecessorRegressions', version: '1.0.0', state: 'RUNNING', startedUtc: new Date().toISOString(), head: gitRead(['rev-parse', 'HEAD']), authority: 'repositories/cca-conformance/tools/mo1305-phase1/regressions.py', runtime: {path: relative(root, node).replaceAll('\\', '/'), sha256: hash(readFileSync(node))}, bounds: {maximumOutputBytesPerGroup: limitBytes, timeoutMsPerGroup: timeoutMs, maximumTotalMs: overallMs}, inputs: originalInputs, results: [], excluded: 'Unchanged C++/UI and historical hosted/certification suites. Historical Phase 1 binding tests require exact I1 working-tree artifact bytes and are not applicable to changed Phase 2 source.'};
receipt.harness = {path: 'repositories/cca-conformance/tools/mo1305-phase2a/regressions.mjs', sha256: hash(readFileSync(new URL(import.meta.url)))};
if (resume) {
 const priorBytes = readFileSync(resolve(output, 'results.json'));
 const prior = JSON.parse(priorBytes);
 assert.equal(prior.state, 'FAIL', 'RESUME_REQUIRES_FAILED_ATTEMPT');
 if (prior.environmentCorrection) receipt.environmentCorrection = prior.environmentCorrection;
 if (afterMcp) {
  const failed = prior.results.at(-1); assert.equal(failed.id, 'mo1304-semantic-integrity'); assert.equal(failed.exitCode, 1); assert.equal(failed.timedOut, false);
  const failureBytes = readFileSync(resolve(root, failed.log.path)); assert.equal(hash(failureBytes), failed.log.sha256);
  assert.match(failureBytes.toString('utf8'), /Cannot find package '@modelcontextprotocol\/server'/);
  const prerequisitePath = '.cache/mo1305-phase2a/regressions/mcp-prerequisites.json';
  const prerequisiteBytes = readFileSync(resolve(root, prerequisitePath)), prerequisite = JSON.parse(prerequisiteBytes);
  assert.equal(prerequisite.state, 'PASS'); assert.equal(prerequisite.networkUsed, false);
  for (const ref of [prerequisite.lock, prerequisite.closure, ...prerequisite.files]) { const bytes = readFileSync(resolve(root, ref.path)); assert.equal(bytes.length, ref.byteLength); assert.equal(hash(bytes), ref.sha256); }
  receipt.prerequisites = {path: prerequisitePath, byteLength: prerequisiteBytes.length, sha256: hash(prerequisiteBytes)};
 } else if (continueAfterSetup) {
  const failed = prior.results.at(-1);
  assert.equal(failed.id, 'mo1303-io-inspection'); assert.equal(failed.exitCode, 1); assert.equal(failed.timedOut, false);
  const failureBytes = readFileSync(resolve(root, failed.log.path)); assert.equal(hash(failureBytes), failed.log.sha256);
  assert.match(failureBytes.toString('utf8'), afterTypescript ? /Cannot find package 'typescript'/ : /Cannot find package 'esbuild'/);
  const dependencyPath = '.cache/mo1305-phase2a/regressions/dependency-setup' + (afterTypescript ? '-typescript' : '') + '.json';
  const dependencyBytes = readFileSync(resolve(root, dependencyPath)), dependency = JSON.parse(dependencyBytes);
  assert.equal(dependency.state, 'PASS'); assert.equal(dependency.networkUsed, false);
  assert.equal(hash(readFileSync(resolve(root, dependency.lock.path))), dependency.lock.sha256);
  const locked = JSON.parse(readFileSync(resolve(root, dependency.lock.path)));
  for (const pkg of dependency.packages) { assert.equal(pkg.version, locked.packages['node_modules/' + pkg.name].version); for (const file of pkg.files) { const bytes = readFileSync(resolve(root, file.path)); assert.equal(bytes.length, file.byteLength); assert.equal(hash(bytes), file.sha256); } }
  receipt.environmentCorrection = {path: dependencyPath, byteLength: dependencyBytes.length, sha256: hash(dependencyBytes)};
 } else assert.ok(prior.failure === 'TOTAL_TIME_LIMIT' || prior.results.at(-1)?.timedOut, 'RESUME_REQUIRES_HARNESS_TIMEOUT');
 assert.deepEqual(prior.inputs, originalInputs, 'RESUME_TEST_INPUT_CHANGED');
 assert.deepEqual(prior.runtime, receipt.runtime, 'RESUME_RUNTIME_CHANGED');
 assert.equal(prior.head, receipt.head, 'RESUME_HEAD_CHANGED');
 const priorPath = '.cache/mo1305-phase2a/regressions/attempt-' + (afterMcp ? '5' : afterTypescript ? '4' : continueAfterSetup ? '3' : partial ? '2' : '1') + '-results.json';
 writeFileSync(resolve(root, priorPath), priorBytes, {flag: 'wx'});
 const oldHarnessPath = '.cache/mo1305-phase2a/regressions/attempt-' + (afterMcp ? '5' : afterTypescript ? '4' : continueAfterSetup ? '3' : partial ? '2' : '1') + '-runner.mjs';
 const oldHarness = readFileSync(resolve(root, oldHarnessPath));
 receipt.priorAttempts = [...(prior.priorAttempts ?? []), {path: priorPath, byteLength: priorBytes.length, sha256: hash(priorBytes)}];
 receipt.priorHarness = {path: oldHarnessPath, byteLength: oldHarness.length, sha256: hash(oldHarness)};
 receipt.reusePolicy = 'Reuse complete PASS groups and explicit completed TAP cases with unchanged test bytes, Node executable and HEAD; run only missing MO1302 case. Both timed-out group exits and raw logs remain FAIL. Split case coverage does not claim a single complete MO1302 process run.';
 receipt.results = prior.results.filter(row => row.state === 'PASS');
 if (partial) {
  const oldRun = prior.results.find(row => row.id === 'mo1302-projections');
  assert.ok(oldRun?.timedOut && oldRun.state === 'FAIL' && oldRun.exitCode === null, 'PARTIAL_RUN_IDENTITY');
  const bytes = readFileSync(resolve(root, oldRun.log.path));
  assert.equal(bytes.length, oldRun.log.byteLength); assert.equal(hash(bytes), oldRun.log.sha256);
  const expected = [
   'CLI transport accepts only one exact stdout envelope and propagates MO-1301 projections',
   'real bundled orchestration verifies PASS, FAIL, CNE, Policy Set, and trusted Regression',
   'valid MO-1301 evaluation failures propagate unchanged and publish no generation',
   'artifact verifier rejections remain MO-1301 failures and reconstruction contradictions are Action failures',
  ];
  const text = bytes.toString('utf8');
  assert.doesNotMatch(text, /^not ok /m);
  assert.deepEqual([...text.matchAll(/^ok \d+ - (.*)$/gm)].map(match => match[1].trim()), expected);
  receipt.partialCoverage = {id: 'mo1302-projections', run: oldRun, cases: expected.map(name => ({name, state: 'PASS', sourceLog: oldRun.log})), missing: 'all six wrong decision/exit pairings are rejected after full verification'};
 }
 for (const row of receipt.results) {
  const log = readFileSync(resolve(root, row.log.path));
  assert.equal(log.length, row.log.byteLength); assert.equal(hash(log), row.log.sha256);
  const group = groups.find(([id]) => id === row.id); assert.ok(group);
  assert.deepEqual(row.executionMode === 'split-case-coverage' ? row.originalGroupCommand : row.command, [receipt.runtime.path, '--test', '--test-concurrency=1', '--test-reporter=tap', ...group[1]]);
  if (row.executionMode === 'split-case-coverage') {
   assert.equal(row.exitCode, null); assert.equal(row.caseCoverage.length, 5);
   assert.equal(new Set(row.caseCoverage.map(entry => entry.name)).size, 5);
   for (const entry of row.caseCoverage) {
    const bytes = readFileSync(resolve(root, entry.sourceLog.path)); assert.equal(bytes.length, entry.sourceLog.byteLength); assert.equal(hash(bytes), entry.sourceLog.sha256);
    assert.ok([...bytes.toString('utf8').matchAll(/^ok \d+ - (.*)$/gm)].some(match => match[1].trim() === entry.name));
   }
   assert.equal(row.executionRuns[0].timedOut, true); assert.equal(row.executionRuns[1].exitCode, 0);
  }
 }
}
function save() { writeFileSync(resolve(output, 'results.json'), canonical(receipt)); }
save();
async function execute(args) {
 const begin = process.hrtime.bigint();
 const child = spawn(node, args, {cwd: root, env: clean, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe']});
 let bytes = 0, exceeded = false, expired = false;
 const chunks = [];
 function collect(chunk) { const remaining = limitBytes - bytes; if (remaining > 0) chunks.push(chunk.subarray(0, remaining)); bytes += chunk.length; if (bytes > limitBytes && !exceeded) { exceeded = true; child.kill(); } }
 child.stdout.on('data', collect); child.stderr.on('data', collect);
 const remainingMs = Math.max(1, Math.min(timeoutMs, overallMs - Number((process.hrtime.bigint() - started) / 1000000n)));
 const timer = setTimeout(() => { expired = true; child.kill(); }, remainingMs);
 const result = await new Promise(resolve => { let error = null; child.on('error', value => { error = value.message; }); child.on('close', (code, signal) => resolve({code, signal, error})); });
 clearTimeout(timer);
 return {...result, bytes: Buffer.concat(chunks), exceeded, expired, elapsedMs: Number((process.hrtime.bigint() - begin) / 1000000n)};
}
try {
 for (const [id, files] of groups) {
  if (receipt.results.some(row => row.id === id)) continue;
  assert.ok(Number((process.hrtime.bigint() - started) / 1000000n) < overallMs, 'TOTAL_TIME_LIMIT');
  const selectedFiles = partial && id === 'mo1302-projections' ? ['--test-name-pattern=^all six wrong decision/exit pairings are rejected after full verification$', files.at(-1)] : files;
  const args = ['--test', '--test-concurrency=1', '--test-reporter=tap', ...selectedFiles];
  const result = await execute(args);
  const path = '.cache/mo1305-phase2a/regressions/' + id + (afterMcp ? '-after-mcp' : afterTypescript ? '-after-typescript' : continueAfterSetup ? '-after-setup' : partial ? '-completion' : resume ? '-attempt-2' : '') + '.tap';
  writeFileSync(resolve(root, path), result.bytes);
  const counts = Object.fromEntries([...result.bytes.toString('utf8').matchAll(/^# (tests|pass|fail|skipped) (\d+)$/gm)].map(match => [match[1], Number(match[2])]));
  const pass = result.code === 0 && !result.exceeded && !result.expired && !result.error && counts.tests > 0 && counts.fail === 0 && counts.skipped === 0 && counts.tests === counts.pass;
  const row = {id, state: pass ? 'PASS' : 'FAIL', command: [receipt.runtime.path, ...args], exitCode: result.code, signal: result.signal, error: result.error, outputExceeded: result.exceeded, timedOut: result.expired, elapsedMs: result.elapsedMs, counts, log: {path, byteLength: result.bytes.length, sha256: hash(result.bytes)}};
  if (partial && id === 'mo1302-projections' && pass) {
   assert.deepEqual(counts, {tests: 1, pass: 1, fail: 0, skipped: 0}, 'FOCUSED_CASE_COUNTS');
   const names = [...result.bytes.toString('utf8').matchAll(/^ok \d+ - (.*)$/gm)].map(match => match[1].trim());
   assert.deepEqual(names, [receipt.partialCoverage.missing], 'FOCUSED_CASE_IDENTITY');
   const focusedRun = structuredClone(row);
   row.executionMode = 'split-case-coverage'; row.aggregateOnly = true;
   row.originalGroupCommand = [receipt.runtime.path, '--test', '--test-concurrency=1', '--test-reporter=tap', ...files];
   row.focusedRunCounts = counts;
   row.executionRuns = [receipt.partialCoverage.run, focusedRun];
   row.caseCoverage = [...receipt.partialCoverage.cases, {name: receipt.partialCoverage.missing, state: 'PASS', sourceLog: row.log}];
   row.counts = {tests: 5, pass: 5, fail: 0, skipped: 0};
   row.exitCode = null; row.signal = null;
   row.note = 'Five exact completed TAP cases across two runs; the first run was killed by the harness during its fifth case, and only that missing case was then completed in a successful focused process. This row is coverage aggregation, not a single process exit.';
  }
  receipt.results.push(row); save(); console.log(canonical(row));
  assert.ok(pass, 'REGRESSION_FAILED ' + id);
 }
 assert.deepEqual(inputs(), originalInputs, 'TEST_INPUT_CHANGED_DURING_EXECUTION');
 receipt.state = 'PASS';
 receipt.counts = receipt.results.reduce((all, row) => { for (const [key, value] of Object.entries(row.counts)) all[key] = (all[key] ?? 0) + value; return all; }, {});
} catch (error) { receipt.state = 'FAIL'; receipt.failure = error.message; process.exitCode = 1; }
receipt.elapsedMs = Number((process.hrtime.bigint() - started) / 1000000n);
receipt.finishedUtc = new Date().toISOString(); save(); console.log(canonical({state: receipt.state, counts: receipt.counts ?? null, elapsedMs: receipt.elapsedMs, receipt: '.cache/mo1305-phase2a/regressions/results.json'}));
