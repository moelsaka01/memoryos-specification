import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';
const workspace=fileURLToPath(new URL('../../../',import.meta.url));
const base=resolve(workspace,'repositories/cca-conformance');
const folder=resolve(base,'evidence/mo1304-phase3-ubuntu');
const receiptPath=resolve(folder,'ubuntu-receipt.json');
const raw=await readFile(receiptPath),receipt=JSON.parse(raw);
const inventory=JSON.parse(await readFile(resolve(base,'mo1304-conformance-inventory.json')));
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',args,{cwd:workspace,encoding:'utf8',windowsHide:true,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'},maxBuffer:4*1024*1024}).trim();
const python=process.env.MEMORYOS_CONFORMANCE_PYTHON??'python';
const py=(name,args)=>JSON.parse(execFileSync(python,['-B',resolve(base,'tools/mo1304-phase3',name),...args],{cwd:workspace,encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024}));
const B2='461a67f3dbb7a32132f9c76e0ea40358e6776583';
test('Ubuntu receipt validates against exact execution artifacts, semantic bytes, package and harness',()=>{
 const result=py('validate_receipt.py',[receiptPath]);assert.equal(result.status,'PASS');assert.equal(result.nativePipeTests,87);assert.equal(result.packageTests,38);assert.equal(result.mechanismTests,27);assert.equal(result.windows,'PENDING');assert.equal(result.parity,'PENDING');
});
test('strict validator rejects fabricated PASS, missing/failed tests, changed bytes and unsupported release states',()=>{
 const result=py('validator_tests.py',[receiptPath,workspace]);assert.equal(result.status,'PASS');assert.ok(result.negativeWitnesses>=30);assert.equal(new Set(result.cases).size,result.negativeWitnesses);
});
test('Ubuntu evidence binds B2 and the actual descendant harness commit without self-reference',async()=>{
 const graph=['ed4632fc81a6e90835233a848a9a3a118184c02e','9d12ea46c6971efd01619bcfdba804431b4149f3','6ab8ed0abb105f90cf44220b1798341133f2716d','0c8b8a35ff0f92a28fe4be85d60ee460208443de','18453aa6d0d347acece20598cf5b1bc3d174c5af',B2];
 for(let i=1;i<graph.length;i++)assert.equal(git('rev-parse',graph[i]+'^'),graph[i-1]);assert.equal(receipt.implementationRevision,graph[4]);assert.equal(receipt.phase2Binding,B2);assert.equal(git('show','-s','--format=%s',B2),'conformance(memoryos-1.3): bind MO-1304 phase 2 integration');
 assert.equal(git('diff',B2,'--','repositories/memoryos-mcp'),'');
 // B2 is allowed while preparing this surface. Once committed, inspect the
 // actual first descendant instead of placing a future commit hash in a receipt.
 const head=git('rev-parse','HEAD');
 if(head!==B2){
  const harnessCommit=git('rev-list','--reverse','--ancestry-path',B2+'..'+head).split('\n')[0];
  assert.match(harnessCommit,/^[0-9a-f]{40}$/);assert.equal(git('rev-parse',harnessCommit+'^'),B2);
  assert.equal(inventory.phase3.ubuntu24_04_x64.harnessBinding.revision,harnessCommit);
  assert.equal(git('show','-s','--format=%s',harnessCommit),'test(memoryos-1.3): add MO-1304 supported-platform certification harness');
  const blob=path=>execFileSync('git',['show',harnessCommit+':repositories/cca-conformance/'+path],{cwd:workspace,windowsHide:true,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'},maxBuffer:4*1024*1024});
  assert.deepEqual(blob('evidence/mo1304-phase3-ubuntu/ubuntu-receipt.json'),raw);
  const manifestBytes=blob('tools/mo1304-phase3/harness-manifest.json');assert.deepEqual({byteLength:manifestBytes.length,sha256:sha(manifestBytes)},receipt.harness);
  for(const entry of JSON.parse(manifestBytes).files){const bytes=blob('tools/mo1304-phase3/'+entry.path);assert.equal(bytes.length,entry.byteLength);assert.equal(sha(bytes),entry.sha256);}
 }
 const historical=JSON.parse(git('show',B2+':repositories/cca-conformance/mo1304-conformance-inventory.json'));
 assert.deepEqual(inventory.phase2,historical.phase2);assert.deepEqual(inventory.identities,historical.identities);assert.deepEqual(inventory.phase1Snapshot,historical.phase1Snapshot);
});
test('inventory binds only actual Ubuntu evidence while Windows, parity, release and tag remain pending',()=>{
 const entry=inventory.phase3.ubuntu24_04_x64;assert.deepEqual(entry.harnessBinding,{status:'BOUND',strategy:'postCommitConformanceCommit',revision:'b95822625f8e7be2cd353b42a8fd185264e9a8bf',parent:B2,subject:'test(memoryos-1.3): add MO-1304 supported-platform certification harness'});assert.equal(entry.status,'PASS');assert.deepEqual(entry.receipt,{path:'repositories/cca-conformance/evidence/mo1304-phase3-ubuntu/ubuntu-receipt.json',byteLength:raw.length,sha256:sha(raw)});
 assert.deepEqual({...inventory.phase3,ubuntu24_04_x64:null},{status:'PENDING',windows11_24H2_x64:null,ubuntu24_04_x64:null,node:'24.21.0',macos:'UNSUPPORTED',platformParity:null});
 assert.deepEqual(inventory.releaseBinding,{status:'PENDING',revision:null});assert.deepEqual(inventory.tagState,{status:'PENDING',name:'memoryos-1.3-mo1304',object:null});assert.equal(git('tag','--list','memoryos-1.3-mo1304'),'');
});
test('Ubuntu actual environment and residual risk are preserved without Windows or zero-vulnerability claims',()=>{
 assert.equal(receipt.platform,'ubuntu-24.04');assert.equal(receipt.architecture,'x64');assert.equal(receipt.os.prettyName,'Ubuntu 24.04.5 LTS');assert.equal(receipt.node.version,'v24.21.0');assert.equal(receipt.npm,'11.19.0');assert.equal(receipt.nonNormative.virtualBoxProduct,'VirtualBox');
 assert.equal(receipt.supplyChain.patched,false);assert.equal(receipt.supplyChain.affectedHigh,8);assert.equal(receipt.supplyChain.affectedModerate,1);assert.equal(receipt.supplyChain.applicableHigh,0);assert.equal(receipt.pending.windowsReceipt,null);assert.equal(receipt.pending.parityReceipt,null);assert.equal(receipt.pending.macos,'UNSUPPORTED');
});
test('Ubuntu-only conformance surface is registered in npm, CMake and the exact JS test inventory',async()=>{
 const pkg=JSON.parse(await readFile(resolve(base,'package.json')));assert.equal(pkg.scripts['test:mo1304-phase3-ubuntu'],'node --test tests/mo1304_phase3_ubuntu_conformance_test.mjs');
 const cmake=await readFile(resolve(base,'CMakeLists.txt'),'utf8');assert.equal(cmake.split('tests/mo1304_phase3_ubuntu_conformance_test.mjs').length-1,2);assert.equal(cmake.split('conformance_area STREQUAL "mo1304-phase3-ubuntu"').length-1,2);
 const runner=await readFile(resolve(base,'tools/run-js-conformance.mjs'),'utf8');assert.equal(runner.split('"mo1304_phase3_ubuntu_conformance_test.mjs"').length-1,1);
});
