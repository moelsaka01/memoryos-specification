/** Integrated-byte acceptance. Historical workstream receipts are never overwritten. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {queryEvents,classify} from '../mo1305-host-guard.mjs';
import {bindInputs,canonical,sha,reference,validateAttempt} from '../mo1305-phase2c/evidence.mjs';
import {validateResult} from '../mo1305-phase2a/evidence.mjs';

export const root=resolve(import.meta.dirname,'../../../..');
export const directory='repositories/cca-conformance/evidence/mo1305-phase2d';
export const cache='.cache/mo1305-phase2d';
export const python='C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
export const node=resolve(root,'.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe');
export const npm=resolve(root,'.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node_modules/npm/bin/npm-cli.js');
export const jobs=['lifecycle','transport','dispatch','startup','resources','interop','rest-units','distribution','installation','reproducibility'];
const selectedC=['transport','dispatch','startup','resources','interop'];
const executorNames=['adversarial_test.py','distribution.py','execution.mjs','install.py','installed-probe.mjs','package-allowlist.json'];
const read=path=>JSON.parse(readFileSync(resolve(root,path)));
export function executionBinding(){
 const harness=executorNames.map(name=>reference('repositories/cca-conformance/tools/mo1305-phase2d/'+name));
 for(const group of ['mo1305-phase2a','mo1305-phase1'])for(const name of readdirSync(resolve(root,'repositories/cca-conformance/tools',group)).sort())if(/\.(mjs|py|ps1|json)$/u.test(name))harness.push(reference('repositories/cca-conformance/tools/'+group+'/'+name));
 return {baseline:'b6c397b99e1f8bfcd04be972f35069f8737a4137',archive:reference(cache+'/build/memoryos-rest-0.1.0.tgz'),sourceTree:reference(cache+'/build/source-tree.json'),candidate:bindInputs(),integrationReview:reference(directory+'/integration-review.json'),harness:harness.sort((a,b)=>a.path.localeCompare(b.path,'en'))};
}
function save(path,value){const target=resolve(root,path);mkdirSync(resolve(target,'..'),{recursive:true});writeFileSync(target,canonical(value),{flag:'wx'});return reference(path);}
async function external(id,executable,args,timeout=600000){
 const path=directory+'/logs/'+id+'.log';mkdirSync(resolve(root,directory,'logs'),{recursive:true});
 const child=spawn(executable,args,{cwd:root,windowsHide:true,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'},stdio:['ignore','pipe','pipe']});
 let bytes=Buffer.alloc(0),timedOut=false;
 const append=chunk=>{bytes=Buffer.concat([bytes,chunk]);if(bytes.length>8388608){timedOut=true;child.kill();}};
 child.stdout.on('data',append);child.stderr.on('data',append);
 const timer=setTimeout(()=>{timedOut=true;child.kill();},timeout);
 const status=await new Promise((done,fail)=>{child.once('error',fail);child.once('close',(code,signal)=>done({code,signal}));}).finally(()=>clearTimeout(timer));
 writeFileSync(resolve(root,path),bytes,{flag:'wx'});
 assert.equal(timedOut,false,'EXECUTION_BOUND');assert.equal(status.code,0,'CHILD_FAILED '+path);
 return {command:[executable,...args],exitCode:status.code,signal:status.signal,log:reference(path)};
}
async function perform(job,id){
 if(selectedC.includes(job)){
  const common=await import('../mo1305-phase2c/common.mjs');common.ensureStage();common.launchHistory.length=0;
  const run=(await import('../mo1305-phase2c/'+job+'.mjs'))['run'+job[0].toUpperCase()+job.slice(1)];
  const result=await run();return {type:'security-module',result,processes:structuredClone(common.launchHistory)};
 }
 if(job==='lifecycle'){
  const execution=await external(id,node,['repositories/cca-conformance/tools/mo1305-phase2a/lifecycle.mjs']);
  const result=read('.cache/mo1305-phase2a/lifecycle-results.json');validateResult('lifecycle',result);assert.equal(result.records.length,30);
  assert.equal(result.staging.distributionManifestSha256,reference('repositories/memoryos-rest/distribution-manifest.json').sha256);
  return {type:'lifecycle',execution,result};
 }
 if(job==='rest-units'){
  const files=readdirSync(resolve(root,'repositories/memoryos-rest/tests')).filter(x=>x.endsWith('.test.mjs')).sort().map(x=>'repositories/memoryos-rest/tests/'+x);
  const execution=await external(id,node,['--test','--test-concurrency=1','--test-reporter=tap',...files]);
  const output=readFileSync(resolve(root,execution.log.path),'utf8');for(const value of ['tests 27','pass 27','fail 0','skipped 0'])assert.match(output,new RegExp('^# '+value+'$','m'));
  return {type:'regression',execution,tests:27,pass:27,fail:0,sources:files.map(reference)};
 }
 const archive=resolve(root,cache,'build/memoryos-rest-0.1.0.tgz'),output=directory+'/raw/'+id+'.json';
 if(job==='distribution'){
  const execution=await external(id,python,['-B','-X','utf8','repositories/cca-conformance/tools/mo1305-phase2d/adversarial_test.py','--archive',archive,'--node',node,'--output',resolve(root,output)]);
  const result=read(output);assert.equal(result.state,'PASS');assert.equal(result.caseCount,142);assert.ok(result.cases.every(x=>x.state==='PASS'));
  return {type:'distribution',execution,raw:reference(output),result};
 }
 if(job==='installation'){
  const execution=await external(id,python,['-B','-X','utf8','repositories/cca-conformance/tools/mo1305-phase2d/install.py','--archive',archive,'--node',node,'--npm',npm,'--output',resolve(root,output),'--expected-sha256',reference(cache+'/build/memoryos-rest-0.1.0.tgz').sha256]);
  const result=read(output);assert.equal(result.state,'PASS');assert.equal(result.installations.length,2);
  for(const install of result.installations){assert.equal(install.state,'PASS');assert.equal(install.fileCount,58);assert.equal(install.execution.requests.length,13);assert.equal(install.execution.remote.state,'PASS');assert.equal(install.execution.remote.requests.length,5);}
  return {type:'installation',execution,raw:reference(output),result};
 }
 assert.equal(job,'reproducibility');
 const destination=cache+'/reproduction/'+id;
 const execution=await external(id,python,['-B','-X','utf8','repositories/cca-conformance/tools/mo1305-phase2d/distribution.py','build','--root',root,'--node',node,'--npm',npm,'--output',resolve(root,destination)]);
 const original=reference(cache+'/build/memoryos-rest-0.1.0.tgz'),rebuilt=reference(destination+'/memoryos-rest-0.1.0.tgz');
 assert.deepEqual(readFileSync(resolve(root,original.path)),readFileSync(resolve(root,rebuilt.path)));assert.deepEqual(read(destination+'/source-tree.json'),read(cache+'/build/source-tree.json'));
 return {type:'reproducibility',execution,original,rebuilt,byteIdentical:true};
}
export async function runJob(job){
 assert.ok(jobs.includes(job));assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(process.versions.node,'24.21.0');
 assert.equal(sha(readFileSync(process.execPath)),'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
 process.env.PATH='C:/Windows/System32;C:/Windows/System32/WindowsPowerShell/v1.0';
 const common=await import('../mo1305-phase2c/common.mjs');
 const registry=JSON.parse(common.checked(common.powershell,['-NoProfile','-NonInteractive','-Command',"$v=Get-ItemProperty -LiteralPath 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion'; @{editionId=[string]$v.EditionID;displayVersion=[string]$v.DisplayVersion;productName=[string]$v.ProductName;currentBuild=[string]$v.CurrentBuildNumber;ubr=[int]$v.UBR}|ConvertTo-Json -Compress"]));
 const platform={platform:process.platform,architecture:process.arch,type:os.type(),release:os.release(),version:os.version(),build:os.release().split('.')[2],...registry,fullBuild:os.release()+'.'+registry.ubr};
 const attempts=[];
 for(let index=0;index<4;index++){
  const binding=executionBinding(),bindingSha256=sha(canonical(binding)),id=job+'-'+randomUUID();
  const stamp=()=>({ns:process.hrtime.bigint().toString(),utcMs:Date.now(),domain:'MONOTONIC_PHASE2D_'+process.pid});
  const start=stamp();let result=null,failure=null;
  try{result=await perform(job,id);}catch(error){failure={name:error.name??'Error',code:error.code??'TEST_FAILURE',messageSha256:sha(String(error.message))};console.error(String(error.stack));}
  const end=stamp(),events=await queryEvents(start.utcMs,end.utcMs),observation=classify({start,end,attemptId:id,candidateId:bindingSha256,caseId:job,phase:'phase2d',index,sampleId:id},events);
  assert.deepEqual(executionBinding(),binding,'INTEGRATED_INPUTS_CHANGED');
  const state=observation.classification==='HOST_INTERRUPTED'?'HOST_INTERRUPTED':failure?'FAIL':'PASS';
  if(result?.type==='security-module'&&state==='PASS'){
   const candidate=binding.candidate,hash=sha(canonical(candidate));
   const host={events,observation:classify({start,end,attemptId:id,candidateId:hash,caseId:job,phase:'phase2c',index,sampleId:id},events)};
   const compatible={kind:'MemoryOSRESTPhase2CAttempt',version:'1.0.0',module:job,id,index,state,binding:candidate,bindingSha256:hash,runtime:{version:process.versions.node,sha256:binding.candidate.node.sha256,platform:'win32',architecture:'x64'},platform,host,processes:result.processes,result:result.result,failure:null};
   validateAttempt(compatible);result.validatedLegacyFormat=compatible;
  }
  const attempt={kind:'MemoryOSRESTPhase2DExecution',version:'1.0.0',job,id,index,state,binding,bindingSha256,platform,host:{events,observation},result,failure};
  attempts.push(save(directory+'/runs/'+id+'.json',attempt));
  const indexPath=resolve(root,cache,job+'-attempts.json');writeFileSync(indexPath,canonical({job,attempts}));
  console.log(JSON.stringify({job,state,id,hostEvidence:observation.evidenceState,durationMs:Number((BigInt(end.ns)-BigInt(start.ns))/1000000n)}));
  if(state==='HOST_INTERRUPTED'){assert.ok(index<3,'HOST_REPLACEMENT_CAP');continue;}
  assert.equal(state,'PASS','INTEGRATED_JOB_FAILED '+job);
  save(directory+'/modules/'+job+'.json',{kind:'MemoryOSRESTPhase2DModule',version:'1.0.0',job,state:'PASS',attempts,accepted:attempts.at(-1)});return attempt;
 }
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url))await runJob(process.argv[2]);
