import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkD4, evaluate, validateFinal, A32_RECEIPT_FILE, DISCLOSURES_FILE, FINAL_BINDING_FILE, FINAL_INVENTORY_FILE, REGRESSION_FILE, REGRESSION_KIND } from '../tools/mo1308-phase3d/validate.mjs';
import { captureRegressionPreconditions, f22DurationMs, mo1307CacheState } from '../tools/mo1308-phase3d/regression-preconditions.mjs';
import { buildI3Inventory } from '../tools/mo1308-phase3d/i3-inventory.mjs';
import { impls, hostOnly } from '../tools/mo1308-phase3d/cases.mjs';
import { checkDefinition } from '../tools/mo1308-phase3/lib/campaign-driver.mjs';
import { git, gitText, repositoryRoot } from '../tools/mo1308-phase3/lib/git.mjs';
import { allCases, buildInventory, loadInventory, streamOf, INVENTORY_FILE } from '../tools/mo1308-phase3/lib/inventory.mjs';
import { qualificationCases, structuralQualifications } from '../tools/mo1308-phase3/lib/disclosure.mjs';
import { closeGeneration } from '../tools/mo1308-phase3/lib/runner.mjs';
import { runSegment } from '../tools/mo1308-phase3/lib/runner.mjs';
import { sealGeneration } from '../tools/mo1308-phase3/lib/seal.mjs';
import { stableBytes } from '../tools/mo1308-phase3/lib/stable-json.mjs';
import { sha256Hex } from '../tools/mo1308-phase3/lib/hashing.mjs';
import { makeTemp, removeTemp, tempBase } from '../tools/mo1308-phase3/short-temp.mjs';

// MO-1308 Phase 3D: the read-only validator and the I3 inventory builder, against the real repository (expected NOT_READY, because
// no certifying evidence exists yet) and against a fabricated, complete, local clone (every state from I3 to the binding-only BF).
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = repositoryRoot(here);
const PROTOCOL = 'docs/mo1308-phase3-protocol.md';
const IDENTITY = 'repositories/cca-conformance/mo1308-phase3-candidate-identity.json';
const MANIFEST = 'repositories/cca-conformance/mo1308-phase3-corpus-manifest.json';
const TOOL = 'repositories/cca-conformance/tools/mo1308-phase3/lib/runner.mjs';
const EVIDENCE = 'repositories/cca-conformance/evidence/mo1308';
const inventory = loadInventory(path.join(repo, INVENTORY_FILE));
// A8.9: temporary checkouts and clones live under the short temporary root (C:/tt/3d-N on Windows), never under the system temp path.
const tmp = (t) => { const directory = makeTemp('3d'); t.after(() => removeTemp(directory)); return directory; };

test('D01 the ten 3D cases (steps D and E) are all implemented and none is host-only', () => {
  assert.deepEqual(checkDefinition({ inventory, stream: '3D', impls, hostOnly }), []);
  assert.equal(Object.keys(impls).length, 10);
});

test('D02 against the real repository: well-formed read-only report, D1 and D5 READY, preserved rehearsals add no D2 problem, nothing is written', () => {
  const before = gitText(repo, ['status', '--porcelain']);
  const report = validateFinal({ root: repo });
  assert.ok(['NOT_READY', 'I3_VALID_PENDING_BF', 'CERTIFIED_READY_TO_TAG'].includes(report.result));
  assert.deepEqual(report.cases.map((row) => row.id), ['3D-D1', '3D-D2', '3D-D3', '3D-D4', '3D-D5', '3D-D6', '3D-D7', '3D-E1', '3D-E2', '3D-E3']);
  const status = Object.fromEntries(report.cases.map((row) => [row.id, row.status]));
  assert.equal(status['3D-D1'], 'READY');
  assert.equal(status['3D-D5'], 'READY');
  assert.equal(report.cases.find((row) => row.id === '3D-D5').observed.verdict, 'PASS', 'the real A3.2 generation 6 receipt is PASS');
  const d2 = report.cases.find((row) => row.id === '3D-D2');
  assert.deepEqual(d2.problems.filter((problem) => /rehearsal/.test(problem)), [], 'a preserved rehearsal (stale or not) is never a D2 problem');
  assert.equal(gitText(repo, ['status', '--porcelain']), before, 'a read-only validator changes nothing');
});

// ---- a complete fabricated clone ----

const PRECONDITIONS = { freshWorktree: true, mo1307CacheBeforeRun: 'ABSENT', loadSample: { cpuPercent: 3.5, sampledMs: 2000, logicalCpus: 8 }, f22DurationMs: 2031.2, retries: 0 };
const clock = () => { let tick = 0; return () => new Date(Date.UTC(2026, 9, 8, 0, 0, tick++)); };
const review = () => ({ kind: 'MO1308Phase3Review', version: '1.0.0', subject: [{ path: TOOL, byteLength: 1, sha256: '1'.repeat(64) }], reviewer: { role: 'INDEPENDENT_SUB_AGENT', identity: 'review-agent-1' }, scope: 'the harness', findings: [], conclusion: 'NO_BLOCKING_FINDINGS', reviewedAt: '2026-10-08T00:00:00.000Z' });

function makeClone(t) {
  const directory = path.join(tmp(t), 'clone');
  const run = (cwd, args) => { const result = spawnSync('git', args, { cwd, encoding: 'utf8' }); if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`); return result.stdout.trim(); };
  run(path.dirname(directory), ['clone', '-q', '--shared', '--no-checkout', repo, directory]);
  run(directory, ['checkout', '-q', '--detach', gitText(repo, ['rev-parse', 'HEAD'])]);
  run(directory, ['config', 'user.name', 'p3d-test']); run(directory, ['config', 'user.email', 'p3d@example.test']); run(directory, ['config', 'commit.gpgsign', 'false']);
  // The real certifying generations (phase3a, phase3b, phase3c) and the regression/disclosure files are in the repository's tree now; the fabricated states below start from a clone without them (A8.12 era: the tests must not depend on the real evidence state).
  const evidenceBase = path.join(directory, ...EVIDENCE.split('/'));
  for (const name of fs.readdirSync(evidenceBase)) if (/^phase3[abcd](-|$)/.test(name)) fs.rmSync(path.join(evidenceBase, name), { recursive: true, force: true });
  fs.rmSync(path.join(directory, ...DISCLOSURES_FILE.split('/')), { force: true });
  fs.rmSync(path.join(directory, ...REGRESSION_FILE.split('/')), { force: true });
  run(directory, ['add', '-A']); run(directory, ['commit', '-q', '--allow-empty', '-m', 'test clone: clean evidence slate']);
  return { directory, run: (...args) => run(directory, args) };
}
const put = (clone, relative, bytes) => { const target = path.join(clone.directory, ...relative.split('/')); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); };
const commit = (clone, message) => { clone.run('add', '-A'); clone.run('commit', '-q', '-m', message); return clone.run('rev-parse', 'HEAD'); };

async function certify(clone, stream, generation, { rehearsal = false, outcome = 'CONFIRMED', inputPaths = [] } = {}) {
  const evidenceDir = path.join(clone.directory, ...EVIDENCE.split('/'), generation);
  const inv = buildInventory();
  const executors = {};
  for (const step of streamOf(inv, stream).steps) {
    executors[step.id] = async (ctx) => { for (const item of step.cases) await ctx.runCase(item.id, async (handle) => { if (item.mode === 'record') handle.observe({ outcome }); }); };
  }
  sealGeneration({
    root: clone.directory, stream, generation, certifying: !rehearsal, protocolPath: PROTOCOL, inventoryPath: INVENTORY_FILE, candidateIdentityPath: IDENTITY,
    corpusManifestPath: stream === '3B' ? null : MANIFEST, toolPaths: [TOOL], inputPaths, harnessReviewPath: rehearsal ? null : 'review.json', evidenceDir, now: clock(),
  });
  for (const segment of streamOf(inv, stream).segments) await runSegment({ root: clone.directory, evidenceDir, segmentId: segment.id, executors, now: clock() });
  return closeGeneration({ root: clone.directory, evidenceDir, inventory: inv, now: clock() });
}

async function completeClone(t, options = {}) {
  const clone = makeClone(t);
  put(clone, 'review.json', stableBytes(review()));
  put(clone, A32_RECEIPT_FILE, JSON.stringify({ verdict: 'PASS' }));
  for (const stream of ['3A', '3B', '3C']) {
    const result = await certify(clone, stream, `phase3${stream[1].toLowerCase()}`, { outcome: options.outcome, inputPaths: stream === '3A' ? [A32_RECEIPT_FILE] : [] });
    assert.equal(result.result, 'ACCEPTED');
  }
  const lines = [...qualificationCases(inventory).map((item) => `${item.id}: ${options.disclosed ?? 'CONFIRMED'} - stated`), ...structuralQualifications(inventory).map((id) => `${id}: DISCLOSED - stated`)];
  put(clone, DISCLOSURES_FILE, `# Disclosures\n\nOperators record the headDigest of every export outside the ledger.\n\nRegister: ${inventory.qualifications.map((item) => item.id).join(' ')}.\n\n${lines.join('\n')}\n`);
  const identity = JSON.parse(fs.readFileSync(path.join(clone.directory, IDENTITY), 'utf8'));
  const suite = (name, total) => ({ name, runner: 'node --test', passed: total, failed: 0, skipped: 0, total, exitCode: 0, logSha256: sha256Hex(Buffer.from(name)) });
  put(clone, REGRESSION_FILE, JSON.stringify({ kind: REGRESSION_KIND, version: '1.0.0', commit: clone.run('rev-parse', 'HEAD'), candidate: { productionTreeDigest: identity.productionTreeDigest }, suites: [suite('mo1308', 120), suite('cli', 40), suite('studio', 90), suite('mo1307', 639), suite('examples', 12)], preconditions: PRECONDITIONS }));
  commit(clone, 'evidence, disclosures and regression record');
  return clone;
}

test('D03 a complete accepted state: I3 is built, then the binding-only BF is certified ready to tag, and nothing is tagged', async (t) => {
  const clone = await completeClone(t);
  const first = evaluate({ root: clone.directory });
  assert.deepEqual(first.report.cases.filter((row) => row.status !== 'READY').map((row) => row.id), ['3D-D7'], JSON.stringify(first.report.cases.filter((row) => row.status !== 'READY')));
  assert.equal(first.report.cases.find((row) => row.id === '3D-D7').status, 'NOT_READY', 'no I3 yet');
  assert.equal(first.report.result, 'NOT_READY');
  const inventoryDocument = buildI3Inventory({ root: clone.directory });
  assert.equal(inventoryDocument.generations.filter((row) => row.certifying).length, 3, 'the committed non-certifying rehearsals are listed too');
  assert.equal(inventoryDocument.requirements.length, 37);
  assert.equal(inventoryDocument.release.created, false);
  const bytes = stableBytes(inventoryDocument);
  put(clone, FINAL_INVENTORY_FILE, bytes);
  const i3 = commit(clone, 'I3');
  const pending = validateFinal({ root: clone.directory });
  assert.equal(pending.result, 'I3_VALID_PENDING_BF', JSON.stringify(pending.cases.filter((row) => row.status !== 'READY')));
  assert.equal(JSON.stringify(inventoryDocument).includes(i3), false, 'I3 does not embed a later hash');
  put(clone, FINAL_BINDING_FILE, JSON.stringify({ kind: 'MO1308FinalBinding', version: '1.0.0', i3, inventory: { path: FINAL_INVENTORY_FILE, sha256: sha256Hex(bytes) } }));
  const bf = commit(clone, 'BF');
  const final = validateFinal({ root: clone.directory });
  assert.equal(final.result, 'CERTIFIED_READY_TO_TAG', JSON.stringify(final.cases.filter((row) => row.status !== 'READY')));
  assert.equal(final.head, bf);
  assert.equal(git(clone.directory, ['tag', '-l', 'memoryos-1.3-mo1308']).stdout.toString().trim(), '', 'the validator creates no tag');
  // a tag that does not target BF is refused
  clone.run('tag', 'memoryos-1.3-mo1308', i3);
  assert.equal(validateFinal({ root: clone.directory }).result, 'NOT_READY');
});

test('D04 a rehearsal is never an accepted input: a stream with only a rehearsal has no accepted generation', async (t) => {
  const clone = makeClone(t);
  const rehearsal = await certify(clone, '3B', 'phase3b-rehearsal-r1', { rehearsal: true });
  assert.equal(rehearsal.certifying, false);
  commit(clone, 'rehearsal');
  const report = validateFinal({ root: clone.directory });
  const d2 = report.cases.find((row) => row.id === '3D-D2');
  assert.ok(d2.problems.includes('3B: no accepted certifying generation'));
  assert.ok(d2.observed.rehearsals.includes('phase3b-rehearsal-r1'), 'the committed 3D rehearsals are in the tree too');
  assert.equal(d2.observed.accepted['3B'], undefined);
});

test('D05 tampering is caught: a changed receipt, a changed step receipt and a wrong disclosure all make the case NOT_READY', async (t) => {
  const clone = await completeClone(t);
  const receiptFile = path.join(clone.directory, ...EVIDENCE.split('/'), 'phase3c', 'stream-receipt.json');
  fs.writeFileSync(receiptFile, fs.readFileSync(receiptFile, 'utf8').replace('"ACCEPTED"', '"FAILED_PRESERVED"'));
  assert.equal(validateFinal({ root: clone.directory }).cases.find((row) => row.id === '3D-D2').status, 'NOT_READY');
  clone.run('checkout', '--', '.');
  const wrong = await completeClone(t, { disclosed: 'NOT_CONFIRMED' });
  assert.match(validateFinal({ root: wrong.directory }).cases.find((row) => row.id === '3D-D6').problems.join(' '), /disclosed NOT_CONFIRMED but recorded CONFIRMED/);
  const mismatch = await completeClone(t, { outcome: 'NOT_CONFIRMED', disclosed: 'CONFIRMED' });
  assert.match(validateFinal({ root: mismatch.directory }).cases.find((row) => row.id === '3D-D6').problems.join(' '), /disclosed CONFIRMED but recorded NOT_CONFIRMED/);
});

test('D06 a commit that changes a production path is caught by D1, and a regression record for another tree or a short suite by D4', async (t) => {
  const clone = await completeClone(t);
  put(clone, 'repositories/memoryos-cli/src/version.js', `${fs.readFileSync(path.join(clone.directory, 'repositories/memoryos-cli/src/version.js'), 'utf8')}\n// changed\n`);
  commit(clone, 'touch production');
  const d1 = validateFinal({ root: clone.directory }).cases.find((row) => row.id === '3D-D1');
  assert.equal(d1.status, 'NOT_READY');
  assert.ok(d1.problems.some((problem) => /production path|changed/.test(problem)));
  const second = await completeClone(t);
  const regression = JSON.parse(fs.readFileSync(path.join(second.directory, ...REGRESSION_FILE.split('/')), 'utf8'));
  regression.suites.find((suite) => suite.name === 'mo1307').total = 638;
  regression.suites.find((suite) => suite.name === 'mo1307').passed = 638;
  fs.writeFileSync(path.join(second.directory, ...REGRESSION_FILE.split('/')), JSON.stringify(regression));
  assert.match(validateFinal({ root: second.directory }).cases.find((row) => row.id === '3D-D4').problems.join(' '), /639/);
});

test('D07 the validator CLI is read-only and its exit code follows the result', () => {
  const run = spawnSync(process.execPath, [path.join(here, '../tools/mo1308-phase3d/validate-final.mjs'), '--root', repo], { encoding: 'utf8' });
  assert.equal(run.status, 1);
  assert.equal(JSON.parse(run.stdout).result, 'NOT_READY');
  const bad = spawnSync(process.execPath, [path.join(here, '../tools/mo1308-phase3d/validate-final.mjs'), '--root', path.join(tempBase(), 'absent-root-p3d')], { encoding: 'utf8' });
  assert.equal(bad.status, 2);
  void allCases;
});

test('D08 the retained regression needs its A8.10 preconditions: fresh worktree, no .cache/mo1307 leftovers, quiet host, F22 timing, no retries', async (t) => {
  const edits = [
    ['no preconditions member', (record) => { delete record.preconditions; }, /no preconditions/u],
    ['not a fresh worktree', (record) => { record.preconditions.freshWorktree = false; }, /fresh worktree/u],
    ['leftovers in .cache/mo1307', (record) => { record.preconditions.mo1307CacheBeforeRun = 'NOT_EMPTY'; }, /not ABSENT or EMPTY/u],
    ['no load sample', (record) => { delete record.preconditions.loadSample; }, /no load sample/u],
    ['a busy host', (record) => { record.preconditions.loadSample.cpuPercent = 75; }, /not quiet/u],
    ['no F22 timing', (record) => { record.preconditions.f22DurationMs = null; }, /F22 timing/u],
    ['a retry', (record) => { record.preconditions.retries = 1; }, /retries/u],
  ];
  const clone = await completeClone(t);
  const file = path.join(clone.directory, ...REGRESSION_FILE.split('/'));
  const original = fs.readFileSync(file, 'utf8');
  const cloneIdentity = JSON.parse(fs.readFileSync(path.join(clone.directory, IDENTITY), 'utf8'));
  const cloneHead = clone.run('rev-parse', 'HEAD');
  assert.equal(validateFinal({ root: clone.directory }).cases.find((row) => row.id === '3D-D4').status, 'READY');
  for (const [label, edit, expected] of edits) {
    const record = JSON.parse(original);
    edit(record);
    assert.match(checkD4({ root: clone.directory, regression: record, identity: cloneIdentity, head: cloneHead }).problems.join(' '), expected, label);
  }
  assert.deepEqual(checkD4({ root: clone.directory, regression: JSON.parse(original), identity: cloneIdentity, head: cloneHead }).problems, []);
});

test('D09 the precondition capture: cache state, load sample, F22 duration from a node:test log, and refusal on leftovers or a busy host', async (t) => {
  const worktree = tmp(t);
  assert.equal(mo1307CacheState(worktree), 'ABSENT');
  fs.mkdirSync(path.join(worktree, '.cache', 'mo1307'), { recursive: true });
  assert.equal(mo1307CacheState(worktree), 'EMPTY');
  const captured = await captureRegressionPreconditions({ worktree, requireQuiet: false });
  assert.deepEqual([captured.freshWorktree, captured.mo1307CacheBeforeRun, captured.retries], [true, 'EMPTY', 0]);
  assert.ok(captured.loadSample.cpuPercent >= 0 && captured.loadSample.sampledMs > 0);
  fs.mkdirSync(path.join(worktree, '.cache', 'mo1307', 'phase2c', 'focused-1'), { recursive: true });
  assert.equal(mo1307CacheState(worktree), 'NOT_EMPTY');
  await assert.rejects(() => captureRegressionPreconditions({ worktree, requireQuiet: false }), /fresh worktree/u);
  assert.equal(f22DurationMs('✔ F21 x (3.1ms)\n✔ F22 read-only verification timeout is bounded and late handle completion only closes (2031.2ms)\n'), 2031.2);
  assert.equal(f22DurationMs('✖ F22 something (12.5ms)\n'), 12.5);
  assert.equal(f22DurationMs('✔ F23 x (1ms)\n'), null);
});

// ---- note A8.12: stale rehearsals ----

const staleOf = (report) => (report.cases.find((row) => row.id === '3D-D2').observed.staleRehearsals ?? []).filter((row) => row.id.startsWith('phase3b-'));
const movedBindings = (clone) => { put(clone, PROTOCOL, `${fs.readFileSync(path.join(clone.directory, PROTOCOL), 'utf8')}\nA later amendment.\n`); put(clone, TOOL, `${fs.readFileSync(path.join(clone.directory, TOOL), 'utf8')}\n// moved\n`); commit(clone, 'bound bytes move'); };

test('D10 an untampered rehearsal sealed against bytes that have since moved is accepted as STALE_REHEARSAL (informational)', async (t) => {
  const clone = makeClone(t);
  await certify(clone, '3B', 'phase3b-rehearsal-r1', { rehearsal: true });
  commit(clone, 'rehearsal');
  assert.deepEqual(staleOf(validateFinal({ root: clone.directory })), [], 'not stale while the bound bytes are unchanged');
  movedBindings(clone);
  const d2 = validateFinal({ root: clone.directory }).cases.find((row) => row.id === '3D-D2');
  assert.deepEqual(d2.problems, ['3A: no accepted certifying generation', '3B: no accepted certifying generation', '3C: no accepted certifying generation'], 'the stale rehearsal itself adds no problem');
  const mine = d2.observed.staleRehearsals.filter((row) => row.id === 'phase3b-rehearsal-r1');
  assert.equal(mine.length, 1);
  assert.equal(mine[0].status, 'STALE_REHEARSAL');
  assert.ok(mine[0].details.some((detail) => /changed since the seal/.test(detail)));
  assert.deepEqual(d2.observed.accepted, {}, 'a rehearsal is still never an accepted input');
});

test('D11 a tampered rehearsal fails, whether or not its bound bytes moved', async (t) => {
  const clone = makeClone(t);
  await certify(clone, '3B', 'phase3b-rehearsal-r1', { rehearsal: true });
  commit(clone, 'rehearsal');
  const file = path.join(clone.directory, ...EVIDENCE.split('/'), 'phase3b-rehearsal-r1', 'stream-receipt.json');
  const original = fs.readFileSync(file, 'utf8');
  for (const moved of [false, true]) {
    if (moved) movedBindings(clone);
    fs.writeFileSync(file, original.replace('"PASS"', '"FAIL"').replace(/"result":\s*"ACCEPTED"/, '"result": "FAILED_PRESERVED"'));
    assert.notEqual(fs.readFileSync(file, 'utf8'), original);
    const d2 = validateFinal({ root: clone.directory }).cases.find((row) => row.id === '3D-D2');
    assert.ok(d2.problems.some((problem) => problem.startsWith('phase3b-rehearsal-r1:')), `moved=${moved}: ${JSON.stringify(d2.problems)}`);
    fs.writeFileSync(file, original);
  }
  // a changed step receipt
  const step = fs.readdirSync(path.join(path.dirname(file), 'steps'))[0];
  const stepFile = path.join(path.dirname(file), 'steps', step);
  fs.writeFileSync(stepFile, `${fs.readFileSync(stepFile, 'utf8')} `);
  assert.ok(validateFinal({ root: clone.directory }).cases.find((row) => row.id === '3D-D2').problems.some((problem) => problem.startsWith('phase3b-rehearsal-r1:')));
});

test('D12 a certifying generation whose bound inputs changed still fails exactly as before', async (t) => {
  const clone = await completeClone(t);
  assert.deepEqual(validateFinal({ root: clone.directory }).cases.find((row) => row.id === '3D-D2').problems, []);
  movedBindings(clone);
  const d2 = validateFinal({ root: clone.directory }).cases.find((row) => row.id === '3D-D2');
  assert.equal(d2.status, 'NOT_READY');
  assert.ok(d2.problems.some((problem) => /^phase3[abc]: .*changed since the seal$/.test(problem)), JSON.stringify(d2.problems));
  assert.deepEqual(d2.observed.staleRehearsals.filter((row) => /^phase3[abc]-[0-9]/.test(row.id) || !row.id.includes('rehearsal')), [], 'a certifying generation is never reported as a stale rehearsal');
});

test('D13 the open certifying 3D generation (sealed, not yet closed) is not an input of its own run: D2 stays READY', async (t) => {
  const clone = await completeClone(t);
  assert.equal(validateFinal({ root: clone.directory }).cases.find((row) => row.id === '3D-D2').status, 'READY');
  sealGeneration({
    root: clone.directory, stream: '3D', generation: 'phase3d', certifying: true, protocolPath: PROTOCOL, inventoryPath: INVENTORY_FILE, candidateIdentityPath: IDENTITY,
    corpusManifestPath: null, toolPaths: [TOOL], inputPaths: [], harnessReviewPath: 'review.json', evidenceDir: path.join(clone.directory, ...EVIDENCE.split('/'), 'phase3d'), now: clock(),
  });
  const d2 = validateFinal({ root: clone.directory }).cases.find((row) => row.id === '3D-D2');
  assert.deepEqual(d2.problems, []);
  assert.equal(d2.status, 'READY');
  assert.equal(d2.observed.accepted['3D'], undefined);
});
