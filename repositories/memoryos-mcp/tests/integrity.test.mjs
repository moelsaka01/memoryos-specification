import test from 'node:test';import assert from 'node:assert/strict';
import { mkdtemp,mkdir,cp,readFile,writeFile,rm,rmdir,unlink,rename,symlink } from 'node:fs/promises';
import { tmpdir } from 'node:os';import { resolve,relative,sep } from 'node:path';
import { PACKAGE_ROOT,verifyRuntime,verifyDependencies,contractIdentityPin,safeMember,validateLaunch,sha256 } from '../src/integrity.mjs';
import { loadLimits } from '../src/limits.mjs';
async function sandbox(t) {
  const base=resolve(tmpdir()),root=await mkdtemp(resolve(base,'memoryos-mo1304-test-'));
  t.after(async()=>{const rel=relative(base,resolve(root));assert.ok(rel.startsWith('memoryos-mo1304-test-')&&!rel.includes(sep));await rm(root,{recursive:true,force:true});});
  await cp(resolve(PACKAGE_ROOT,'contracts'),resolve(root,'contracts'),{recursive:true});return root;
}
test('runtime closure is byte-preserved and pinned to exactly the authoritative source files',async()=>{
  const manifest=await verifyRuntime();assert.equal(manifest.files.length,25);
  for(const entry of manifest.files){const source=await readFile(resolve(PACKAGE_ROOT,'../..',entry.source));const copy=await readFile(resolve(PACKAGE_ROOT,'runtime',entry.path));assert.deepEqual(copy,source);assert.equal(sha256(copy),entry.sha256);assert.equal(copy.length,entry.byteLength);assert.ok(!/test|\.git|memoryos-cli/u.test(entry.path));}
  const identity=await readFile(resolve(PACKAGE_ROOT,'contracts/policy-contract-identities-1.0.0.json'));
  assert.deepEqual(identity,await readFile(resolve(PACKAGE_ROOT,'../memoryos-vscode/contracts/policy-contract-identities-1.0.0.json')));assert.equal(identity.at(-1),10);
});
test('missing/changed/extra runtime payload, changed manifest, contract substitution and path types fail closed',async(t)=>{
  const root=await sandbox(t);await cp(resolve(PACKAGE_ROOT,'runtime'),resolve(root,'runtime'),{recursive:true});
  const manifest=await verifyRuntime(root);const target=resolve(root,'runtime',manifest.files[0].path);const bytes=await readFile(target);
  await writeFile(target,Buffer.concat([bytes,Buffer.from(' ')]));await assert.rejects(verifyRuntime(root));await writeFile(target,bytes);
  await unlink(target);await assert.rejects(verifyRuntime(root));await mkdir(target);await assert.rejects(verifyRuntime(root));await rmdir(target);await writeFile(target,bytes);
  const extra=resolve(root,'runtime','extra.txt');await writeFile(extra,'secret');await assert.rejects(verifyRuntime(root));await unlink(extra);
  const mf=resolve(root,'runtime/runtime-closure-manifest.json'),mb=await readFile(mf);await writeFile(mf,Buffer.concat([mb,Buffer.from(' ')]));await assert.rejects(verifyRuntime(root));await writeFile(mf,mb);
  const pin=resolve(root,'contracts/policy-contract-identities-1.0.0.json'),pb=await readFile(pin);await writeFile(pin,pb.toString().replace('1.0.0','9.0.0'));await assert.rejects(contractIdentityPin(root));await assert.rejects(verifyRuntime(root));await writeFile(pin,pb);
  await verifyRuntime(root);
});
test('junction/symlink runtime root and case-substituted inventory are rejected',async(t)=>{
  const root=await sandbox(t);await symlink(resolve(PACKAGE_ROOT,'runtime'),resolve(root,'runtime'),process.platform==='win32'?'junction':'dir');
  await assert.rejects(verifyRuntime(root));await unlink(resolve(root,'runtime'));
  await cp(resolve(PACKAGE_ROOT,'runtime'),resolve(root,'runtime'),{recursive:true});
  const mf=resolve(root,'runtime/runtime-closure-manifest.json'),manifest=JSON.parse(await readFile(mf));
  manifest.files[0].path=manifest.files[0].path.toUpperCase();const bytes=Buffer.from(JSON.stringify(manifest));await writeFile(mf,bytes);
  await writeFile(resolve(root,'contracts/runtime-pin.json'),JSON.stringify({byteLength:bytes.length,sha256:sha256(bytes)}));await assert.rejects(verifyRuntime(root));
});
test('unsafe member names and environment/preload/runtime substitutions reject without lookup',()=>{
  for(const name of ['../secret','/absolute','C:/private','a\\b','a//b','a/./b','CON.txt','a/NUL','a:stream','a./b',''])assert.throws(()=>safeMember(name));
  for(const version of ['24.14.0','24.21.1','25.0.0'])assert.throws(()=>validateLaunch(version,{},[]));
  for(const env of [{NODE_OPTIONS:'--no-warnings'},{NODE_PATH:'private'}])assert.throws(()=>validateLaunch('24.21.0',env,[]));
  for(const flag of ['--require=x','--import=x','--inspect','--loader=x','--eval=x'])assert.throws(()=>validateLaunch('24.21.0',{},[flag]));
  validateLaunch('24.21.0',{},[]);
});
test('missing resource file and missing finite constant fail startup validation',async(t)=>{
  const root=await sandbox(t);const path=resolve(root,'contracts/limits.json'),value=JSON.parse(await readFile(path));
  await unlink(path);await assert.rejects(loadLimits(root));delete value.values.operationMs;await writeFile(path,JSON.stringify(value));await assert.rejects(loadLimits(root));
});
test('production dependency closure rejects changed, missing and extra package members',async(t)=>{
  const root=await sandbox(t);await mkdir(resolve(root,'distribution'));await cp(resolve(PACKAGE_ROOT,'distribution/dependency-closure.json'),resolve(root,'distribution/dependency-closure.json'));
  const manifest=JSON.parse(await readFile(resolve(root,'distribution/dependency-closure.json')));
  for(const entry of manifest.packages)await cp(resolve(PACKAGE_ROOT,entry.path),resolve(root,entry.path),{recursive:true});
  await verifyDependencies(root);
  const target=resolve(root,manifest.files[0].path),bytes=await readFile(target);await writeFile(target,'substituted');await assert.rejects(verifyDependencies(root));await writeFile(target,bytes);
  await unlink(target);await assert.rejects(verifyDependencies(root));await writeFile(target,bytes);
  const extra=resolve(root,manifest.packages[0].path,'unexpected.mjs');await writeFile(extra,'');await assert.rejects(verifyDependencies(root));
});
