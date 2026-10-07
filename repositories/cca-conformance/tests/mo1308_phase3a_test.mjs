import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { impls, hostOnly, makeEnv, STEP3 } from '../tools/mo1308-phase3a/cases.mjs';
import { cleanupEnv, SCRATCH } from '../tools/mo1308-phase3a/env.mjs';
import { failureScenarios, UNREACHABLE, ledgerWith } from '../tools/mo1308-phase3a/cases-cli.mjs';
import { GATE_INPUTS } from '../tools/mo1308-phase3a/cases-host.mjs';
import { POINT, pausedAppend } from '../tools/mo1308-phase3a/cases-ntfs.mjs';
import { contract, fillerBytes, readTree, treeDigest } from '../tools/mo1308-phase3a/support.mjs';
import { HERE, PRELOAD, junction, pathToFileHrefOf, removeTree, snapshot } from '../tools/mo1308-phase3a/win.mjs';
import { checkDefinition } from '../tools/mo1308-phase3/lib/campaign-driver.mjs';
import { repositoryRoot } from '../tools/mo1308-phase3/lib/git.mjs';
import { allCases, loadInventory } from '../tools/mo1308-phase3/lib/inventory.mjs';

// MO-1308 Phase 3A: the stream definition and the Windows harness's own safety properties. The 108 cases run in the campaign (a rehearsal on
// the Windows host, then the certifying generation); these tests check what must hold before any of them is run.
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = repositoryRoot(here);
const TOOLS = 'repositories/cca-conformance/tools/mo1308-phase3a';
const WINDOWS = { skip: process.platform === 'win32' ? false : 'the Windows host harness' };
const inventory = loadInventory(path.join(repo, 'repositories/cca-conformance/mo1308-phase3-inventory.json'));
const unitEnv = async (t, name) => {
  const env = await makeEnv({ root: repo, option: (flag) => (flag === '--generation' ? `unit-${name}-${process.pid}` : null), certifying: false });
  t.after(() => cleanupEnv(env));
  return env;
};

test('A01 every 3A case is implemented, none is declared host-only, none is both', () => {
  assert.deepEqual(checkDefinition({ inventory, stream: '3A', impls, hostOnly }), []);
  assert.deepEqual(Object.keys(hostOnly), [], 'a certifying generation refuses every skip, so no case may be left declared');
});

test('A02 the implemented set is exactly the 108 inventory cases', () => {
  const expected = allCases(inventory).filter((item) => item.stream === '3A').map((item) => item.id).sort();
  assert.equal(expected.length, 108);
  assert.deepEqual(Object.keys(impls).sort(), expected);
  for (const [id, implementation] of Object.entries(impls)) assert.equal(typeof implementation, 'function', id);
});

test('A03 the harness table of the former host-only declarations still names every Windows harness', () => {
  for (const reason of Object.values(STEP3)) assert.equal(typeof reason, 'string');
  assert.equal(Object.keys(STEP3).length, 12);
});

test('A04 every Freeze section 14.1 code is either reached by a CLI scenario or declared unreachable with a reason', async (t) => {
  const env = await unitEnv(t, 'a04');
  const reached = new Set(failureScenarios(env).map((scenario) => scenario.code));
  for (const code of Object.keys(contract.MEMORYOS_HISTORY_ERRORS)) assert.equal(reached.has(code) || UNREACHABLE[code] !== undefined, true, code);
  for (const code of Object.keys(UNREACHABLE)) assert.equal(reached.has(code), false, code);
});

test('A05 a record one byte over a member limit is refused with the limit code and leaves the ledger unchanged', async (t) => {
  const env = await unitEnv(t, 'a05');
  const { run } = await import('../tools/mo1308-phase3a/env.mjs');
  const ledger = ledgerWith(env, 'a05', ['mip-reference']);
  const before = treeDigest(ledger);
  const file = path.join(env.workRoot, 'human-decision.json');
  fs.writeFileSync(file, fillerBytes(contract.RECORD_MEMBER_RULES.HUMAN_DECISION_CLAIM.memberBytes + 1));
  const result = run(env, ['history', 'append', '--ledger', ledger, '--kind', 'HUMAN_DECISION_CLAIM', '--record', file, '--json']);
  assert.equal(result.code, 'MO1308_RESOURCE_LIMIT');
  assert.equal(treeDigest(ledger), before);
  assert.equal(readTree(ledger).size > 0, true);
});

test('A06 removeTree removes a junction as a link, never touches its target, and refuses a path outside its root', WINDOWS, async (t) => {
  const env = await unitEnv(t, 'a06');
  const root = path.join(env.workRoot, 'a06'); fs.mkdirSync(root);
  const outside = path.join(env.sentinelDir, 'outside'); fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'precious.txt'), 'must survive');
  const tree = path.join(root, 'tree'); fs.mkdirSync(path.join(tree, 'sub'), { recursive: true });
  junction(outside, path.join(tree, 'sub', 'link'));
  fs.writeFileSync(path.join(tree, 'file.txt'), 'x');
  removeTree(root, tree);
  assert.equal(fs.existsSync(tree), false);
  assert.equal(fs.readFileSync(path.join(outside, 'precious.txt'), 'utf8'), 'must survive');
  assert.throws(() => removeTree(root, outside), /outside the work root/u);
  assert.equal(fs.existsSync(path.join(outside, 'precious.txt')), true);
});

test('A07 a snapshot records a junction as a link and never follows it', WINDOWS, async (t) => {
  const env = await unitEnv(t, 'a07');
  const root = path.join(env.workRoot, 'a07'); fs.mkdirSync(path.join(root, 'real'), { recursive: true });
  const outside = path.join(env.sentinelDir, 'a07-outside'); fs.mkdirSync(outside);
  fs.writeFileSync(path.join(outside, 'hidden.txt'), 'x');
  junction(outside, path.join(root, 'link'));
  const rows = snapshot(root);
  assert.equal(rows.get('link').kind, 'link');
  assert.equal([...rows.keys()].some((name) => name.startsWith('link/')), false);
  removeTree(root, root);
});

test('A08 the fault-injection preload is a no-op when disarmed and the probe can tell when it is armed', WINDOWS, async (t) => {
  const env = await unitEnv(t, 'a08');
  const probe = path.join(HERE, 'preload-probe.mjs');
  const run = (args, extra = {}) => JSON.parse(spawnSync(process.execPath, args, { encoding: 'utf8', windowsHide: true, env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...extra } }).stdout);
  const plain = run([probe]);
  const disarmed = run(['--import', pathToFileHrefOf(PRELOAD), probe]);
  assert.equal(disarmed.digest, plain.digest);
  const dir = path.join(env.workRoot, 'plan'); fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir, 'plan.json'), JSON.stringify({ id: 'a08', dir, mode: { errors: true, children: true }, points: [] }));
  const armed = run(['--import', pathToFileHrefOf(PRELOAD), probe], { P3A_PLAN: path.join(dir, 'plan.json') });
  assert.notEqual(armed.digest, plain.digest);
});

test('A09 the junction swapper refuses a ledger or an outside directory beyond the work root', WINDOWS, async (t) => {
  const env = await unitEnv(t, 'a09');
  const run = spawnSync(process.execPath, [path.join(HERE, 'swapper.mjs'), env.workRoot, path.join(env.sentinelDir, 'ledger'), path.join(env.workRoot, 'outside'), '1', 'seed', '5'], { encoding: 'utf8', windowsHide: true });
  assert.equal(run.status, 2);
  assert.match(run.stderr, /outside the work root/u);
});

test('A10 a paused append stops at the commit-protocol step, is killed there, and leaves a ledger that verifies', WINDOWS, async (t) => {
  const env = await unitEnv(t, 'a10');
  const ledger = ledgerWith(env, 'a10', ['checkpoint-c00']);
  const { controller } = pausedAppend(env, ledger, 'checkpoint-c01', 'a10', POINT.memberLink);
  assert.equal(await controller.reached('P'), true);
  assert.match(controller.reachedInfo('P').args[0], /member-/u);
  controller.kill();
  await controller.closed;
  const { run } = await import('../tools/mo1308-phase3a/env.mjs');
  const verified = run(env, ['history', 'verify', '--ledger', ledger, '--json']);
  assert.equal(verified.status, 0);
  assert.equal(verified.json.result.entryCount, 1);
  assert.equal(verified.json.result.pendingArtifacts, 1);
});

test('A11 the product never names the harness: no production path mentions a harness file, an observer or the preload (R37)', () => {
  const identity = JSON.parse(fs.readFileSync(path.join(repo, 'repositories/cca-conformance/mo1308-phase3-candidate-identity.json'), 'utf8'));
  const names = fs.readdirSync(path.join(repo, TOOLS), { recursive: true }).map((name) => String(name).replaceAll('\\', '/')).filter((name) => /\.(mjs|py|ps1|cjs)$/u.test(name)).map((name) => path.basename(name));
  assert.ok(names.length >= 20);
  for (const row of identity.productionPaths) {
    const text = fs.readFileSync(path.join(repo, row.path), 'utf8');
    for (const name of names) assert.equal(text.includes(name), false, `${row.path} names ${name}`);
    assert.equal(/fault-preload|P3A_PLAN|console-run|observers\//u.test(text), false, row.path);
  }
});

test('A12 the harness observers are exactly the reviewed set, and the gate inputs are real files', () => {
  assert.deepEqual(fs.readdirSync(path.join(HERE, 'observers')).sort(), ['console-run.py', 'fileindex.py', 'hold.py', 'hostcapture.py', 'proc.py', 'shortpath.py']);
  for (const input of GATE_INPUTS) assert.equal(fs.existsSync(path.join(repo, input)), true, input);
  const receipt = JSON.parse(fs.readFileSync(path.join(repo, GATE_INPUTS[0]), 'utf8'));
  assert.equal(receipt.verdict, 'PASS');
});

test('A13 the scratch area is outside git: the work root of a generation does not make the worktree dirty', async (t) => {
  const env = await unitEnv(t, 'a13');
  fs.writeFileSync(path.join(env.workRoot, 'marker.txt'), 'x');
  const status = spawnSync('git', ['status', '--porcelain', '--', SCRATCH], { cwd: repo, encoding: 'utf8' }).stdout.trim();
  assert.equal(status, '');
  void os;
});
