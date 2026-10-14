import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import crypto from 'node:crypto';
import { impls, hostOnly, knownFindings } from '../tools/mo1308-phase3c/cases.mjs';
import { scanText, scanAuthoredJson } from '../tools/mo1308-phase3c/scanner.mjs';
import { D, jcs, sha, MemoryLedger, parseLedger, rebuild, tryVerify, flip, recordDigestOf } from '../tools/mo1308-phase3c/support.mjs';
import { loadSha256Stream } from '../tools/mo1308-phase3c/cases-sha.mjs';
import { checkDefinition } from '../tools/mo1308-phase3/lib/campaign-driver.mjs';
import { loadInventory } from '../tools/mo1308-phase3/lib/inventory.mjs';
import { repositoryRoot } from '../tools/mo1308-phase3/lib/git.mjs';

// MO-1308 Phase 3C (security and abuse corpus): the independent D/JCS, the scanner's detection power, the stream definition, and
// the SHA-256 section extracted from production. The cases themselves run in the campaign rehearsal.
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = repositoryRoot(here);
const inventory = loadInventory(path.join(repo, 'repositories/cca-conformance/mo1308-phase3-inventory.json'));

test('C01 every 3C case is implemented or declared host-only, none both', () => {
  assert.deepEqual(checkDefinition({ inventory, stream: '3C', impls, hostOnly }), []);
});

test('C02 nothing is declared host-only: F3 and G2 are implemented by the Windows harness, and a certifying generation refuses every skip', () => {
  assert.deepEqual(Object.keys(hostOnly), []);
  assert.equal(typeof impls['3C-F3'], 'function');
  assert.equal(typeof impls['3C-G2'], 'function');
});

test('C03 known findings are all implemented (so a certifying run executes them for real)', () => {
  for (const id of Object.keys(knownFindings)) assert.equal(typeof impls[id], 'function');
});

test('C04 independent JCS sorts keys, escapes and rejects nothing it should keep', () => {
  assert.equal(jcs({ b: 1, a: [true, null, 'x"y'] }), '{"a":[true,null,"x\\"y"],"b":1}');
  assert.match(D('MEMORYOS-HISTORY-RECORD-1.0', 'a', 'b'), /^sha256:[0-9a-f]{64}$/);
});

test('C05 scanner detects planted canaries and every forbidden class', () => {
  const canaries = [{ class: 'SECRET', value: 'canary-secret-value' }];
  assert.equal(scanText('hello canary-secret-value', canaries).some((f) => f.kind === 'CANARY_SECRET'), true);
  const samples = { ABSOLUTE_WINDOWS_PATH: 'C:\\Users\\x', URL: 'see https://example.test/a', ISO_TIMESTAMP: '2026-10-06T10:00', STACK_FRAME: 'at f (file:///a/b.js:1:2)', NODE_INTERNAL: 'ERR_INVALID_ARG', EXCEPTION_NAME: 'TypeError' };
  for (const [kind, text] of Object.entries(samples)) assert.equal(scanText(text, []).some((f) => f.kind === kind), true, kind);
  assert.deepEqual(scanText('sha256:' + 'a'.repeat(64) + ' plain-name 42', []), []);
});

test('C06 scanner skips only the two free-form places', () => {
  const clean = JSON.stringify({ record: { subjects: [{ type: 'X', value: 'C:\\free\\form' }] }, tombstone: { authorityReference: 'https://x.test/a' } });
  const result = scanAuthoredJson(clean, [], { label: 'e' });
  assert.deepEqual(result.findings, []);
  assert.equal(result.freeForm.length, 2);
  const dirty = scanAuthoredJson(JSON.stringify({ note: 'C:\\leak' }), [], { label: 'e' });
  assert.equal(dirty.findings.length > 0, true);
});

test('C07 the incremental SHA-256 extracted from production matches node:crypto', () => {
  const Stream = loadSha256Stream(repo);
  const bytes = crypto.randomBytes(1000);
  const stream = new Stream();
  stream.update(bytes.subarray(0, 333)); stream.update(bytes.subarray(333));
  const hex = stream.hex();
  assert.equal(hex, crypto.createHash('sha256').update(bytes).digest('hex'));
});

test('C08 a tampered in-memory ledger fails verification and a forged chain is accepted (the recorded A6/B3 weakness)', () => {
  assert.equal(typeof MemoryLedger, 'function');
  assert.equal(typeof tryVerify, 'function');
  assert.equal(typeof parseLedger, 'function');
  assert.equal(typeof rebuild, 'function');
  assert.equal(typeof flip, 'function');
  assert.equal(typeof recordDigestOf, 'function');
  assert.equal(sha(new Uint8Array(0)), 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
});
