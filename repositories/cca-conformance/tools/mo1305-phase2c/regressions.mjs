/** Only the fixed semantic/security predecessor subset and affected REST guards. */
import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {readFileSync,writeFileSync,appendFileSync,mkdirSync,readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {root,baseline,nodePath,clean,reference,sha} from './common.mjs';
const outputRoot=resolve(root,'repositories/cca-conformance/evidence/mo1305-phase2c/regressions');
const studio=names=>names.map(n=>'repositories/cca-studio/tests/'+n);
const groups={
 'rest-security':['repositories/memoryos-rest/tests/'+ 'contracts.test.mjs',...['boundaries.test.mjs','runtime-guards.test.mjs','worker-boundary.test.mjs','integrity-race.test.mjs','openapi.test.mjs'].map(n=>'repositories/memoryos-rest/tests/'+n)],
 'host-interruption':['repositories/cca-conformance/tests/mo1305_host_guard_test.mjs'],
 'mo1301-sdk':studio(['memoryos_policy_sdk_test.mjs','investigation_policy_test.mjs','investigation_policy_contracts_test.mjs','investigation_policy_engine_test.mjs','policy_canonical_test.mjs','policy_fact_context_test.mjs','regression_policy_fact_source_test.mjs','memoryos_sdk_test.mjs']),
 'core-mip':[...studio(readdirSync(resolve(root,'repositories/cca-studio/tests')).filter(n=>/^mip_.*test\.mjs$/.test(n)).sort()),'repositories/cca-studio/tests/investigation_core_test.mjs'],
 'mo1302-projections':['--test-name-pattern=CLI transport|real bundled orchestration|valid MO-1301 evaluation failures|artifact verifier rejections|wrong decision/exit','repositories/cca-conformance/tests/mo1302_action_foundation_conformance_test.mjs'],
 'mo1303-io-inspection':['--test-name-pattern=secure input|exact bytes|inspection|Policy|policy|artifact|verification','repositories/memoryos-vscode/tests/runtime_foundation.test.mjs'],
 'mo1304-semantic-integrity':['contracts.test.mjs','delegation.test.mjs','integrity.test.mjs','dispatcher.test.mjs'].map(n=>'repositories/memoryos-mcp/tests/'+n),
 'cli-secondary':['repositories/memoryos-cli/tests/policy-cli.test.mjs']
};
function run(args,path){return new Promise((resolveRun,rejectRun)=>{
 writeFileSync(path,Buffer.alloc(0));
 const child=spawn(nodePath,args,{cwd:root,env:clean,windowsHide:true,stdio:['ignore','pipe','pipe']});let bytes=Buffer.alloc(0),failure=null;
 const terminate=()=>spawnSync('C:/Windows/System32/taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,timeout:15000,stdio:'ignore'});
 const timer=setTimeout(()=>{failure='REGRESSION_TIMEOUT';terminate();},900000);
 for(const stream of [child.stdout,child.stderr])stream.on('data',chunk=>{appendFileSync(path,chunk);bytes=Buffer.concat([bytes,chunk]);if(bytes.length>8388608){failure='REGRESSION_LOG_BOUND';terminate();}});
 child.once('error',error=>{clearTimeout(timer);rejectRun(error);});
 child.once('exit',code=>{clearTimeout(timer);resolveRun({code,bytes,failure});});
});}
export async function runRegressions(){
 const runId=randomUUID(),output=resolve(outputRoot,runId);mkdirSync(output,{recursive:true});const records=[];
 for(const [id,files] of Object.entries(groups)){
  const args=['--test','--test-concurrency=1','--test-reporter=tap',...files],path=resolve(output,id+'.tap'),result=await run(args,path);assert.equal(result.failure,null,'REGRESSION_INTERRUPTED '+id);
  const counts=Object.fromEntries([...result.bytes.toString().matchAll(/^# (tests|pass|fail|skipped) (\d+)$/gm)].map(m=>[m[1],Number(m[2])]));
  assert.equal(result.code,0,'REGRESSION_FAILED '+id);assert.equal(counts.fail,0);assert.ok(counts.pass>0);
  const record={id:'REGRESSION-'+id,category:'security-regressions',state:'PASS',exitCode:result.code,counts,command:['node24.21.0',...args],sources:files.filter(f=>!f.startsWith('--')).map(reference),log:reference('repositories/cca-conformance/evidence/mo1305-phase2c/regressions/'+runId+'/'+id+'.tap')};records.push(record);console.log(JSON.stringify({id,counts}));
 }
 return {records,limitations:['Fixed freeze section 12.3 semantic/security subset only; unrelated lifecycle campaigns, full resource characterization, package/distribution campaigns, UI/C++ and historical hosted workflows were not rerun.'],provenance:{baseline,nodeVersion:'24.21.0',nodeSha256:sha(readFileSync(nodePath)),workerBoundaryProbeCount:27}};
}
