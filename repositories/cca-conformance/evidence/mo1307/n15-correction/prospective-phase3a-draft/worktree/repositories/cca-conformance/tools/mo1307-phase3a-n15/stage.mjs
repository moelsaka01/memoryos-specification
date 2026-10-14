// Enforce fixed H-N stage order and stop the generation on first mandatory failure.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';
import {root,E,T,HEAD,startedAt,hardStopAt,env,json,record,walk,write,put,identity} from './common.mjs';
identity();const step=process.argv[2];assert.ok(['H','I','J','K','L','M','N'].includes(step));assert.equal(process.argv.length,3);
assert.equal(fs.existsSync(path.join(E,'generation-stopped.json')),false);const previous=String.fromCharCode(step.charCodeAt(0)-1);assert.equal(json(path.join(E,'steps',previous+'.json')).result,'PASS');assert.equal(fs.existsSync(path.join(E,'steps',step+'-start.json')),false);
const python='C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';let exe=process.execPath,args,guardMs=60000,receipt;
if(step==='H'||step==='I'){exe=python;args=['-B',path.join(T,'runtime-controls-run.py'),step];guardMs=step==='H'?90000:50000;receipt='runtime-'+step+'/external-proof.json';}
if(step==='J'){args=[path.join(T,'cleanup-topology.mjs'),path.join(E,'topology-B/receipt.json'),path.join(E,'semantics/B-ready/evaluate/observation.json')];receipt='cleanup-topology/receipt.json';}
if(step==='K'){args=[path.join(T,'finalization.mjs'),path.join(json(path.join(E,'steps/B.json')).destination,'memoryos-readiness-result.json')];guardMs=240000;receipt='finalization/receipt.json';}
if(step==='L'||step==='M'){args=[path.join(T,'security.mjs'),step];guardMs=240000;receipt='security-'+step+'/receipt.json';}
if(step==='N'){const vectors=['A','B','C','D','E'].map(s=>{const data=json(path.join(E,'steps',s+'.json'));return {name:data.name,cliResult:path.join(data.destination,'memoryos-readiness-result.json'),apiReceipt:path.join(E,'semantics',s+'-'+data.name,'api-parity.json'),expectedResult:path.join(root,'repositories/cca-conformance/fixtures/mo1307/bundles',data.name,'expected-result.json')};});write('determinism-manifest.json',{vectors});args=[path.join(T,'determinism.mjs'),path.join(E,'determinism-manifest.json')];receipt='determinism/receipt.json';}
guardMs=Math.min(guardMs,Date.parse(hardStopAt)-Date.now());assert.ok(guardMs>0);
const sources=walk(T).map(file=>{const source=path.join(T,file.path);return {source:record(source),preserved:put('tool-snapshots/'+step+'/'+file.path+'.data',fs.readFileSync(source))};});
write('steps/'+step+'-start.json',{step,startedAt:new Date().toISOString(),candidate:HEAD,executable:exe,args,env,cwd:root,engineeringGuardMs:guardMs,sourceBindings:sources,noRetry:true,additionalSemanticEvaluations:0});
const at=performance.now(),execution=spawnSync(exe,args,{cwd:root,env,windowsHide:true,shell:false,encoding:null,timeout:guardMs,maxBuffer:4*1024*1024});let failure=null,proof=null;
const stdout=put('steps/'+step+'.stdout.data',execution.stdout??Buffer.alloc(0)),stderr=put('steps/'+step+'.stderr.data',execution.stderr??Buffer.alloc(0));
try{assert.ifError(execution.error);assert.equal(execution.signal,null);assert.equal(execution.status,0,(execution.stderr??Buffer.alloc(0)).toString());proof=json(path.join(E,receipt));assert.equal(proof.result,'PASS');}
catch(error){failure={name:error.name,code:error.code??null,message:error.message,stack:error.stack};write('generation-stopped.json',{step,at:new Date().toISOString(),reason:'FIRST_MANDATORY_FAILURE',failure,noRetry:true,noLaterSteps:true});}
write('steps/'+step+'.json',{step,result:failure?'FAIL':'PASS',failure,exit:execution.status,signal:execution.signal,error:execution.error?.code??null,elapsedMs:performance.now()-at,receipt:fs.existsSync(path.join(E,receipt))?record(path.join(E,receipt)):null,stdout,stderr,finishedAt:new Date().toISOString(),noRetry:true});
console.log(JSON.stringify({step,result:failure?'FAIL':'PASS',exit:execution.status,elapsedMs:performance.now()-at,failure}));process.exitCode=failure?1:0;

