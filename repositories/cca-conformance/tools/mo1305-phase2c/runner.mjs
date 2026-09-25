/** Run only selected bounded modules; verify consumes committed evidence offline. */
import assert from 'node:assert/strict';
import os from 'node:os';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {queryEvents,classify} from '../mo1305-host-guard.mjs';
import {modules,sha,canonical,nodeSha256,bindInputs,persistAttempt,publishModule,aggregate,verifyAll} from './evidence.mjs';
const command=process.argv[2]??'all';
if(command==='verify'){console.log(JSON.stringify(await verifyAll()));}
else if(command==='aggregate'){console.log(JSON.stringify(await aggregate()));}
else{
  assert.ok(command==='all'||modules.includes(command),'Expected transport|capabilities|interop|resources|dispatch|startup|regressions|all|aggregate|verify');
  assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(process.versions.node,'24.21.0');assert.equal(sha(readFileSync(process.execPath)),nodeSha256);
  const common=await import('./common.mjs');process.env.PATH=common.clean.PATH;
const platformScript="$v=Get-ItemProperty -LiteralPath 'HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion'; @{editionId=[string]$v.EditionID;displayVersion=[string]$v.DisplayVersion;productName=[string]$v.ProductName;currentBuild=[string]$v.CurrentBuildNumber;ubr=[int]$v.UBR}|ConvertTo-Json -Compress";
  const registry=JSON.parse(common.checked(common.powershell,['-NoProfile','-NonInteractive','-Command',platformScript]));
  const platform={platform:process.platform,architecture:process.arch,type:os.type(),release:os.release(),version:os.version(),build:os.release().split('.')[2],...registry,fullBuild:os.release()+'.'+registry.ubr};
  const selected=command==='all'?modules:[command];
  for(const module of selected){
    const run=(await import(`./${module}.mjs`))['run'+module[0].toUpperCase()+module.slice(1)];assert.equal(typeof run,'function');
    const attempts=[];
    for(let index=0;index<4;index++){
      common.ensureStage();const binding=bindInputs(),bindingSha256=sha(canonical(binding)),id=module+'-'+randomUUID();
      const stamp=()=>({ns:process.hrtime.bigint().toString(),domain:'MONOTONIC_PHASE2C_'+process.pid,utcMs:Date.now()});
      if(common.launchHistory)common.launchHistory.length=0;
      const start=stamp();let result=null,failure=null;
      try{result=await run();}catch(error){failure={name:error.name??'Error',code:typeof error.code==='string'?error.code:'TEST_FAILURE',messageSha256:sha(String(error.message))};console.error(JSON.stringify({module,state:'ASSERTION_OR_RUNTIME_FAILURE',name:failure.name,code:failure.code,messageSha256:failure.messageSha256}));}
      const end=stamp(),events=await queryEvents(start.utcMs,end.utcMs),observation=classify({start,end,attemptId:id,candidateId:bindingSha256,caseId:module,phase:'phase2c',index,sampleId:id},events);
      const state=observation.classification==='HOST_INTERRUPTED'?'HOST_INTERRUPTED':failure?'FAIL':'PASS';
      const processes=structuredClone(common.launchHistory??result?.processes??[]);
      const attempt={kind:'MemoryOSRESTPhase2CAttempt',version:'1.0.0',module,id,index,state,binding,bindingSha256,runtime:{version:process.versions.node,sha256:nodeSha256,platform:process.platform,architecture:process.arch},platform,host:{events,observation},processes,result,failure};
      // Binding must remain stable across actual execution and cleanup.
      assert.deepEqual(bindInputs(),binding,'INPUTS_CHANGED_DURING_EXECUTION');
      attempts.push(persistAttempt(attempt));publishModule(module,attempts);
      console.log(JSON.stringify({module,state,cases:result?.records.length??0,attempt:index,hostEvidence:observation.evidenceState}));
      if(state==='HOST_INTERRUPTED'){if(index===3)throw Error('HOST_INSTABILITY_REPLACEMENTS_EXHAUSTED');continue;}
      if(state!=='PASS')throw Error('MODULE_FAILED_'+module);break;
    }
  }
  if(command==='all')console.log(JSON.stringify(await aggregate()));
}
