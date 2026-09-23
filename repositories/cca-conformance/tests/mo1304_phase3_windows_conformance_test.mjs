import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdtemp,rm} from 'node:fs/promises';
import {execFileSync,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
const root=fileURLToPath(new URL('../../../',import.meta.url)),base=resolve(root,'repositories/cca-conformance');
const receiptPath=resolve(base,'evidence/mo1304-phase3-windows/windows-receipt.json'),ubuntuPath=resolve(base,'evidence/mo1304-phase3-ubuntu/ubuntu-receipt.json'),parityPath=resolve(base,'evidence/mo1304-phase3-parity.json');
const raw=await readFile(receiptPath),receipt=JSON.parse(raw),inventory=JSON.parse(await readFile(resolve(base,'mo1304-conformance-inventory.json')));
const sha=b=>createHash('sha256').update(b).digest('hex'),python=process.env.MEMORYOS_CONFORMANCE_PYTHON??'python';
const py=(path,args=[])=>JSON.parse(execFileSync(python,['-B',resolve(base,path),...args],{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:4*1024*1024}));
const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'},maxBuffer:4*1024*1024}).trim();
const correction='c29f527f29ec8e267367b3894099bb351c7873f4';
const evidenceSubject='test(memoryos-1.3): certify MO-1304 Windows and platform parity';
const finalSubject='conformance(memoryos-1.3): close MO-1304 MCP server certification';
async function identity(entry){const b=await readFile(resolve(root,entry.path));assert.equal(b.length,entry.byteLength);assert.equal(sha(b),entry.sha256);return b;}
test('Windows actual environment and full installed-package receipt validate independently',()=>{
 const r=py('tools/mo1304-windows/validate_windows.py',[receiptPath]);assert.equal(r.status,'PASS');assert.equal(r.nativePipeTests,88);assert.equal(r.packageTests,39);assert.equal(r.mechanismTests,27);assert.equal(r.windows,'PASS');assert.equal(r.parity,'PENDING');
 assert.equal(receipt.supportedPlatform,'Windows 11 x64');assert.equal(receipt.certifiedEnvironment.release,'25H2');assert.equal(receipt.certifiedEnvironment.build,'26200.9457');
});
test('Windows validator rejects fabricated results, altered identities and overstated OS network denial',()=>{
 const r=py('tools/mo1304-windows/validator_tests.py',[receiptPath,root]);assert.equal(r.status,'PASS');assert.ok(r.negativeWitnesses>=44);assert.equal(new Set(r.cases).size,r.negativeWitnesses);
});
test('two independently validated platforms have exact canonical byte and identity parity',()=>{
 const r=py('tools/mo1304-platforms/validate_parity.py',['validate',receiptPath,ubuntuPath,parityPath]);assert.equal(r.status,'PASS');assert.equal(r.platforms,2);assert.equal(r.semanticVectors,9);
});
test('parity rejects missing platforms, forged PASS and changed normative digests',async()=>{
 const temp=await mkdtemp(resolve(root,'.cache/mo1304-parity-negative-'));
 try{
  const script=resolve(base,'tools/mo1304-platforms/validate_parity.py');
  const fail=(w,u,p)=>assert.notEqual(spawnSync(python,['-B',script,'validate',w,u,p],{cwd:root,windowsHide:true,encoding:'utf8',timeout:60000}).status,0);
  fail(resolve(temp,'windows-receipt.json'),ubuntuPath,parityPath);fail(receiptPath,resolve(temp,'ubuntu-receipt.json'),parityPath);fail(ubuntuPath,ubuntuPath,parityPath);
  const original=JSON.parse(await readFile(parityPath));
  for(const mutate of [v=>{v.semanticVectors[0].sha256='0'.repeat(64);},v=>{delete v.platforms['ubuntu-24.04'];},v=>{v.platforms.macos=v.platforms['windows-11'];delete v.platforms['windows-11'];},v=>{v.candidate.archive.sha256='0'.repeat(64);},v=>{v.independentValidation=[];}]){const value=structuredClone(original);mutate(value);const path=resolve(temp,'parity.json');await writeFile(path,JSON.stringify(value)+'\n');fail(receiptPath,ubuntuPath,path);}
 }finally{await rm(temp,{recursive:true,force:true});}
});
test('Windows/parity evidence and final binding follow exact existing graph edges without self-reference',async()=>{
 assert.equal(git('rev-parse',correction+'^'),'43f07a48774e3ea0ef8509bd5f9ff5071a839b27');
 assert.equal(git('diff','18453aa6d0d347acece20598cf5b1bc3d174c5af','--','repositories/memoryos-mcp'),'');
 assert.deepEqual(await identity(inventory.phase3.windows11_x64.receipt),raw);assert.equal(inventory.phase3.windows11_x64.status,'PASS');await identity(inventory.phase3.platformParity.receipt);assert.equal(inventory.phase3.platformParity.status,'PASS');
 const head=git('rev-parse','HEAD');
 if(head!==correction){
  const commits=git('rev-list','--reverse','--ancestry-path',correction+'..HEAD').split('\n'),evidenceCommit=commits[0];
  assert.equal(git('rev-parse',evidenceCommit+'^'),correction);assert.equal(git('show','-s','--format=%s',evidenceCommit),evidenceSubject);
  const blob=path=>execFileSync('git',['show',evidenceCommit+':repositories/cca-conformance/'+path],{cwd:root,windowsHide:true,maxBuffer:4*1024*1024});
  assert.deepEqual(blob('evidence/mo1304-phase3-windows/windows-receipt.json'),raw);
  assert.deepEqual(blob('evidence/mo1304-phase3-parity.json'),await readFile(parityPath));
  const m=JSON.parse(blob('tools/mo1304-windows/harness-manifest.json'));
  for(const f of m.files){const b=blob('tools/mo1304-windows/'+f.path);assert.equal(b.length,f.byteLength);assert.equal(sha(b),f.sha256);}
  if(inventory.releaseBinding.status==='BOUND'){
   const binding=inventory.releaseBinding;assert.equal(binding.strategy,'postEvidenceConformanceCommit');assert.equal(binding.revision,evidenceCommit);assert.equal(binding.parent,correction);
   assert.equal(inventory.phase3.windows11_x64.harnessBinding.revision,evidenceCommit);assert.equal(inventory.phase3.windows11_x64.harnessBinding.status,'BOUND');
   const validation=JSON.parse(await identity(binding.validationReceipt));assert.equal(validation.evidenceRevision,evidenceCommit);assert.equal(validation.evidenceParent,correction);assert.equal(validation.status,'PASS');assert.equal(validation.archiveSha256,receipt.candidate.archive.sha256);assert.ok(validation.runs.every(r=>r.exitCode===0));assert.ok(validation.runs.some(r=>r.label==='mo1304-all'&&r.pass===32&&r.fail===0&&r.skipped===0));
   // While preparing the binding HEAD is the evidence commit; afterwards the
   // actual first child must be the evidence-only final binding, never a future hash.
   if(head!==evidenceCommit){assert.equal(commits.length,2);assert.equal(git('rev-parse',commits[1]+'^'),evidenceCommit);assert.equal(git('show','-s','--format=%s',commits[1]),finalSubject);assert.deepEqual(git('diff','--name-only',evidenceCommit,commits[1]).split('\n'),['repositories/cca-conformance/evidence/mo1304-final-binding-validation.json','repositories/cca-conformance/mo1304-conformance-inventory.json']);}
   assert.equal(inventory.phase3.status,'PASS');
  }else assert.deepEqual(inventory.releaseBinding,{status:'PENDING',revision:null});
 }
 assert.deepEqual(inventory.tagState,{status:'PENDING',name:'memoryos-1.3-mo1304',object:null});assert.equal(git('tag','--list','memoryos-1.3-mo1304'),'');
});
test('Windows receipt schema and all conformance registrations are valid',async()=>{
 const {AjvJsonSchemaValidator}=await import('../../memoryos-mcp/node_modules/@modelcontextprotocol/server/dist/validators/ajv.mjs');
 const schema=JSON.parse(await readFile(resolve(base,'tools/mo1304-windows/receipt.schema.json')));const ajv=new AjvJsonSchemaValidator();assert.equal(ajv.ajv.validateSchema(schema),true);const check=ajv.getValidator(schema)(receipt);assert.equal(check.valid,true,check.errorMessage);
 const pkg=JSON.parse(await readFile(resolve(base,'package.json')));assert.equal(pkg.scripts['test:mo1304-phase3-windows'],'node --test tests/mo1304_phase3_windows_conformance_test.mjs');
 const cm=await readFile(resolve(base,'CMakeLists.txt'),'utf8');assert.equal(cm.split('tests/mo1304_phase3_windows_conformance_test.mjs').length-1,2);assert.equal(cm.split('conformance_area STREQUAL "mo1304-phase3-windows"').length-1,2);
 const runner=await readFile(resolve(base,'tools/run-js-conformance.mjs'),'utf8');assert.equal(runner.split('"mo1304_phase3_windows_conformance_test.mjs"').length-1,1);
});
