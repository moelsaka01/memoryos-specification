import assert from 'node:assert/strict';
import { readFile,writeFile,mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKAGE_ROOT,sha256,verifyDependencies } from '../src/integrity.mjs';
import { J } from '../src/deterministic.mjs';
import { ARCHIVE,RECEIPT,buildPackage,verifyArchive } from './distribution.mjs';
/*
 * Test preparation. Imported by every tests/*.test.mjs through tests/prepare.mjs; idempotent; it never
 * rewrites a tracked file (package.json is a member of the pinned archive, so no pretest hook can be added).
 *
 * 1. `npm ci --ignore-scripts` installs every published Zod file (946 for the three production packages).
 *    The pinned production closure (distribution/dependency-closure.json, 748 files) deliberately excludes
 *    198 Zod development test files (scripts/dependency-selection.json). verifyDependencies() is a
 *    production integrity check and is not relaxed: scripts/assemble-dependencies.mjs removes exactly those
 *    hash-verified files, and refuses a partial or altered selection.
 * 2. The packed archive the tests install (out/phase2/memoryos-mcp-0.1.0.tgz, ignored by git) is produced
 *    by scripts/distribution.mjs. Every member, the manifest and the closure are byte-identical to the
 *    tracked measurements/phase2-package-receipt.json, but the gzip layer is not reproducible across
 *    zlib builds (the recorded archive was built on Windows; Linux zlib yields different compressed bytes).
 *    The tests therefore verify against out/test-measurements/phase2-package-receipt.json: the tracked
 *    receipt with only `archive` (byteLength/sha256 of the .tgz) replaced by the locally built archive,
 *    after proving that every other receipt field and every archive member equals the tracked evidence.
 */
export const LOCAL_RECEIPT=resolve(PACKAGE_ROOT,'out/test-measurements/phase2-package-receipt.json');
const identity=(bytes)=>({byteLength:bytes.length,sha256:sha256(bytes)});
async function localReceipt(tracked) {
 const archive=resolve(PACKAGE_ROOT,'out/phase2',ARCHIVE);
 const bytes=await readFile(archive);const receipt={...tracked,archive:identity(bytes)};
 verifyArchive(bytes,receipt);return receipt;
}
export async function prepare() {
 try {await verifyDependencies();} catch {
  await import('./assemble-dependencies.mjs');
  await verifyDependencies();
 }
 const tracked=JSON.parse(await readFile(RECEIPT));
 let receipt;
 try {receipt=await localReceipt(tracked);} catch {
  const built=JSON.parse(await readFile((await buildPackage({receiptPath:resolve(PACKAGE_ROOT,'out/test-measurements/phase2-package-receipt.rebuilt.json')})).receipt));
  const {archive:rebuiltArchive,...rebuiltRest}=built,{archive:trackedArchive,...trackedRest}=tracked;
  assert.equal(J(rebuiltRest),J(trackedRest),'rebuilt package receipt differs from the tracked evidence');
  receipt=await localReceipt(tracked);
 }
 await mkdir(resolve(PACKAGE_ROOT,'out/test-measurements'),{recursive:true});
 await writeFile(LOCAL_RECEIPT,J(receipt)+'\n');
 return {receipt,receiptPath:LOCAL_RECEIPT,archiveIdenticalToTracked:receipt.archive.sha256===tracked.archive.sha256};
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))process.stdout.write(J(await prepare())+'\n');
