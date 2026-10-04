// Engineering actual worker environment probe; no filesystem/network/subprocess.
import assert from 'node:assert/strict';
import { parentPort, resourceLimits } from 'node:worker_threads';
assert.deepEqual(Object.keys(process.env), []);
assert.deepEqual(process.execArgv, []);
assert.equal(resourceLimits.maxOldGenerationSizeMb,128);
assert.equal(resourceLimits.maxYoungGenerationSizeMb,16);
parentPort.postMessage({status:'OK',value:{resultBytes:Uint8Array.from([10]),readinessDigest:'sha256:'+'1'.repeat(64),proofBindingDigest:'sha256:'+'2'.repeat(64)}});
parentPort.close();

