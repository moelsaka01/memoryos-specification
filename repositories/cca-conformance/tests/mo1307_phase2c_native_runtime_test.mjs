import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
// V2: NRT01 is a one-shot Phase 2C witness. Its preserved receipt is checked against the
// accepted Phase 2C content inventory; the worker is never re-run and nothing is written.
const witnessPath = 'repositories/cca-conformance/evidence/mo1307/phase2c-resumed/runtime/native-worker-deadline.json';
const witness = new URL('../evidence/mo1307/phase2c-resumed/runtime/native-worker-deadline.json', import.meta.url);
const inventory = new URL('../evidence/mo1307/phase2c-final/accepted-content-inventory-v2.json', import.meta.url);
const bound = { byteLength: 1294, sha256: '0013e3067f58da39ff58074035ad920cfe7b4960df470816b1af0d5318a222b4',
  gitBlob: '72e9283fa898ad4dfe11cb366f6f64285af75514' };
test('NRT01 native CPU-bound worker is terminated at fixed 10000ms CLI evaluation deadline', async () => {
  const rows = JSON.parse(await fs.readFile(inventory, 'utf8')).rows.filter(row => row.path === witnessPath);
  assert.equal(rows.length, 1);
  assert.deepEqual({ byteLength: rows[0].byteLength, sha256: rows[0].sha256, gitBlob: rows[0].gitBlob }, bound);
  const bytes = await fs.readFile(witness);
  assert.equal(bytes.length, bound.byteLength);
  assert.equal(createHash('sha256').update(bytes).digest('hex'), bound.sha256);
  assert.equal(createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex'), bound.gitBlob);
  const receipt = JSON.parse(bytes.toString('utf8'));
  assert.equal(receipt.case, 'NRT01'); assert.equal(receipt.runtime, 'v24.21.0'); assert.equal(receipt.platform, 'win32');
  const { elapsedMs, errorCode, snapshot } = receipt;
  assert.equal(errorCode, 'MO1307_TIMEOUT');
  assert.equal(snapshot.workers, 1); assert.equal(snapshot.cleanupConfirmed, true);
  assert.ok(elapsedMs >= 10000 && elapsedMs < 12000, String(elapsedMs));
});
