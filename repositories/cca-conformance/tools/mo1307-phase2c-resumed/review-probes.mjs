// Engineering audit probes; fail observations are retained for disposition.
import fs from 'node:fs/promises';import path from 'node:path';import {fileURLToPath}from'node:url';
import {spawnSync}from'node:child_process';
import {evaluateReadiness}from'../../../memoryos-readiness/src/index.mjs';
import {runCli}from'../../../memoryos-readiness/src/cli.mjs';
import {createSupervisorForTesting}from'../../../memoryos-readiness/src/runtime.mjs';
import {bundle,launchFor}from'./surface-fixture.mjs';
const here=fileURLToPath(import.meta.url),root=path.resolve(path.dirname(here),'../../../..');
if(process.argv[2]==='--heap-child'){
 const supervisor=createSupervisorForTesting({kind:'api'},{workerURL:new URL('./runtime-worker.mjs',import.meta.url)});
 try{const result=await supervisor.runWorker({mode:'environment'});process.stdout.write(Buffer.from(result.resultBytes));}finally{await supervisor.dispose();}
}else{
 const data=await bundle();const outcomes=[];
 for(const [id,action]of[
  ['api-early-malformed-config-plus-later-oversized-file',()=>evaluateReadiness({...data.input,configurationBytes:Buffer.from('{'),files:[{id:'a',bytes:new Uint8Array(2097153)}]})],
  ['cli-launch-poison-plus-unsafe-config',async()=>{const old=process.env.NODE_OPTIONS;process.env.NODE_OPTIONS='--inspect';try{return await runCli(['evaluate','--input-root','C:\\Input','--config','../bad','--authority','authority.json','--authority-sha256',data.pins.trustedAuthorityDigest,'--candidate-sha256',data.pins.expectedCandidateDigest,'--output-root','C:\\Output']);}finally{if(old===undefined)delete process.env.NODE_OPTIONS;else process.env.NODE_OPTIONS=old;}}],
 ]){try{await action();outcomes.push({id,result:'UNEXPECTED_SUCCESS'});}catch(error){outcomes.push({id,code:error.code,stage:error.stage,reference:error.reference});}}
 const child=spawnSync(process.execPath,['--max-old-space-size=64',here,'--heap-child'],{cwd:root,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'},windowsHide:true,timeout:15000,encoding:'utf8'});
 outcomes.push({id:'api-worker-parent-heap-flag',exit:child.status,stdout:child.stdout,stderr:child.stderr,error:child.error?.code??null});
 await fs.writeFile(path.join(root,'repositories/cca-conformance/evidence/mo1307/phase2c-resumed/review-probes.json'),JSON.stringify({kind:'MO1307OperationalReviewProbes',classification:'READ_ONLY_REVIEW_OBSERVATIONS_REQUIRING_DISPOSITION',outcomes},null,2)+'\n',{flag:'wx'});
 process.stdout.write(JSON.stringify(outcomes)+'\n');
}
