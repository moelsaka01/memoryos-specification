import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { impls, hostOnly, makeEnv, STEP3 } from '../tools/mo1308-phase3a/cases.mjs';
import { failureScenarios, UNREACHABLE } from '../tools/mo1308-phase3a/cases-cli.mjs';
import { contract, fillerBytes, readTree, treeDigest } from '../tools/mo1308-phase3a/support.mjs';
import { rehearse, checkDefinition } from '../tools/mo1308-phase3/lib/campaign-driver.mjs';
import { repositoryRoot } from '../tools/mo1308-phase3/lib/git.mjs';
import { allCases, loadInventory } from '../tools/mo1308-phase3/lib/inventory.mjs';
import { sharedToolPaths } from '../tools/mo1308-phase3/lib/seal.mjs';
import { walkRecords } from '../tools/mo1308-phase3/lib/hashing.mjs';

// MO-1308 Phase 3A, platform-neutral part (steps B, C, J, M and the runner wiring). The Windows harness is Step 3.
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = repositoryRoot(here);
const TOOLS = 'repositories/cca-conformance/tools/mo1308-phase3a';
const inventory = loadInventory(path.join(repo, 'repositories/cca-conformance/mo1308-phase3-inventory.json'));
const tmp = (t) => { const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mo1308-p3a-test-')); t.after(() => fs.rmSync(directory, { recursive: true, force: true })); return directory; };

test('A01 every 3A case is implemented or declared host-only, none both', () => {
  assert.deepEqual(checkDefinition({ inventory, stream: '3A', impls, hostOnly }), []);
});

test('A02 the implemented set is exactly steps A3, B, C1-C5, D5, J and M, and nothing implemented needs a Windows API', () => {
  const ids = Object.keys(impls).sort();
  assert.equal(ids.length, 34);
  const expected = allCases(inventory).filter((item) => item.stream === '3A' && /^3A-(A3|B\d+|C[1-5]|D5|J\d+|M\d)$/.test(item.id)).map((item) => item.id).sort();
  assert.deepEqual(ids, expected);
  for (const file of fs.readdirSync(path.join(repo, TOOLS)).filter((name) => name.endsWith('.mjs'))) {
    const text = fs.readFileSync(path.join(repo, TOOLS, file), 'utf8');
    assert.equal(/\b(?:fsutil|mklink|icacls|attrib|powershell|cmd\.exe|win32api)\b/i.test(text.replace(/\/\/.*$/gm, '')), false, `${file} uses a Windows tool`);
  }
});

test('A03 every host-only reason names a Step 3 harness, and the JC ceiling segment is entirely host-only', () => {
  for (const [id, reason] of Object.entries(hostOnly)) assert.match(reason, /^HOST_ONLY: /, id);
  const reasons = new Set(Object.values(hostOnly).map((reason) => reason.replace('HOST_ONLY: ', '')));
  for (const reason of reasons) assert.equal(Object.values(STEP3).includes(reason), true, reason);
  for (let index = 1; index <= 10; index += 1) assert.ok(hostOnly[`3A-JC${index}`], `JC${index}`);
});

test('A04 every Freeze section 14.1 code is either reached by a CLI scenario or declared unreachable with a reason', async (t) => {
  const env = await makeEnv({ root: repo, option: () => null, certifying: false });
  t.after(() => { for (const directory of env.temporary) fs.rmSync(directory, { recursive: true, force: true }); });
  const reached = new Set(failureScenarios(env).map((scenario) => scenario.code));
  for (const code of Object.keys(contract.MEMORYOS_HISTORY_ERRORS)) assert.equal(reached.has(code) || UNREACHABLE[code] !== undefined, true, code);
  for (const code of Object.keys(UNREACHABLE)) assert.equal(reached.has(code), false, code);
});

test('A05 a record one byte over a member limit is refused with the limit code and leaves the ledger unchanged', async (t) => {
  const env = await makeEnv({ root: repo, option: () => null, certifying: false });
  t.after(() => { for (const directory of env.temporary) fs.rmSync(directory, { recursive: true, force: true }); });
  const { ledgerWith } = await import('../tools/mo1308-phase3a/cases-cli.mjs');
  const { run } = await import('../tools/mo1308-phase3a/env.mjs');
  const ledger = ledgerWith(env, 'a05', ['mip-reference']);
  const before = treeDigest(ledger);
  const file = path.join(tmp(t), 'human-decision.json');
  fs.writeFileSync(file, fillerBytes(contract.RECORD_MEMBER_RULES.HUMAN_DECISION_CLAIM.memberBytes + 1));
  const result = run(env, ['history', 'append', '--ledger', ledger, '--kind', 'HUMAN_DECISION_CLAIM', '--record', file, '--json']);
  assert.equal(result.code, 'MO1308_RESOURCE_LIMIT');
  assert.equal(treeDigest(ledger), before);
  assert.equal(readTree(ledger).size > 0, true);
});

test('A06 a complete non-certifying rehearsal: 34 pass, 74 declared host-only, nothing fails, never promotable', async (t) => {
  const directory = path.join(tmp(t), 'r1');
  const env = await makeEnv({ root: repo, option: () => null, certifying: false });
  t.after(() => { for (const dir of env.temporary) fs.rmSync(dir, { recursive: true, force: true }); });
  const toolPaths = [...sharedToolPaths(repo), ...walkRecords(path.join(repo, TOOLS)).map((row) => `${TOOLS}/${row.path}`)].sort();
  const result = await rehearse({ root: repo, stream: '3A', evidenceDir: directory, impls, hostOnly, env, toolPaths });
  assert.equal(result.receipt.result, 'REHEARSAL_PARTIAL', JSON.stringify(result.summary));
  assert.equal(result.summary.executedPass, 34);
  assert.equal(result.summary.skippedHostOnly.length, 74);
  assert.deepEqual(result.summary.failed, []);
  assert.deepEqual(result.problems, []);
  assert.equal(result.receipt.certifying, false);
  assert.equal(result.receipt.promotable, false);
  assert.equal(fs.existsSync(path.join(directory, 'artifacts/raw-log-index.json')), true);
});
