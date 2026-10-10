import './prepare.mjs';
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile,readdir,stat } from 'node:fs/promises';
import { resolve,relative } from 'node:path';
import { execFileSync } from 'node:child_process';
import { PACKAGE_ROOT,sha256 } from '../src/integrity.mjs';
import { RECEIPT,ARCHIVE,verifyArchive } from '../scripts/distribution.mjs';
import { LOCAL_RECEIPT } from '../scripts/prepare-tests.mjs';
import { npmCli } from '../scripts/npm-cli.mjs';
import { MEASUREMENT_DIR,writeMeasurement } from './phase2-support.mjs';
test('test measurements are written outside the tracked measurements/ directory, to a git-ignored path',async()=>{
 assert.ok(relative(resolve(PACKAGE_ROOT,'measurements'),MEASUREMENT_DIR).startsWith('..'),'measurement dir must not be inside measurements/');
 const written=await writeMeasurement('isolation-probe.json','{}\n');
 execFileSync('git',['check-ignore','--quiet',written],{cwd:PACKAGE_ROOT});
 assert.equal(await readFile(written,'utf8'),'{}\n');
});
test('no test source writes to the tracked measurements/ directory',async()=>{
 for(const name of await readdir(resolve(PACKAGE_ROOT,'tests'))){
  if(name==='measurement-isolation.test.mjs')continue;
  const source=await readFile(resolve(PACKAGE_ROOT,'tests',name),'utf8');
  assert.ok(!/writeFile\([^)]*measurements\//u.test(source),`${name} writes a tracked measurement`);
 }
});
test('tracked integration evidence is the recorded PASS result, not a test-run artifact',async()=>{
 const tracked=JSON.parse(await readFile(resolve(PACKAGE_ROOT,'measurements/phase2-integration.json')));
 assert.equal(tracked.status,'PASS');assert.equal(tracked.results.length,2);
});
test('the packed archive is produced by the documented script and matches the tracked receipt except for the gzip layer',async()=>{
 const tracked=JSON.parse(await readFile(RECEIPT)),local=JSON.parse(await readFile(LOCAL_RECEIPT));
 const {archive:_a,...trackedRest}=tracked,{archive:_b,...localRest}=local;
 assert.deepEqual(localRest,trackedRest);
 const bytes=await readFile(resolve(PACKAGE_ROOT,'out/phase2',ARCHIVE));
 assert.equal(sha256(bytes),local.archive.sha256);assert.equal(bytes.length,local.archive.byteLength);
 verifyArchive(bytes,local);
 assert.throws(()=>verifyArchive(bytes,{...local,archive:{...local.archive,sha256:'0'.repeat(64)}}));
});
test('the npm CLI is located for both Windows and POSIX Node layouts',async()=>{
 assert.ok((await stat(npmCli())).isFile());
 assert.throws(()=>npmCli('/nonexistent/bin/node'),/NPM_CLI_NOT_FOUND/u);
});
