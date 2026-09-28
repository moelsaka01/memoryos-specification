// Engineering-only startup/framing measurement. The fixed Phase 1 guard returns
// ERROR/MO1307_INTERNAL and supplies no native handles, identities or snapshots.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomBytes } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { DEFINITIONS as D } from '../../../memoryos-readiness/src/constants.mjs';
import { encodeHelperRequest, decodeHelperRequest, decodeHelperResponse } from '../../../memoryos-readiness/src/helper-protocol.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const prefix='repositories/cca-conformance/evidence/mo1307/phase2c-correction/guard-characterization/';
assert.equal(process.argv.length,4);assert.equal(process.argv[2],'--output');
const relative=process.argv[3].replaceAll('\\','/'),output=path.resolve(root,relative);
assert.ok(relative.startsWith(prefix));assert.ok(output.startsWith(path.resolve(root,prefix)+path.sep));assert.ok(!fs.existsSync(output));
fs.mkdirSync(output,{recursive:true});
const sha=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
const record=(member,bytes=fs.readFileSync(path.resolve(root,member)))=>({path:member,byteLength:bytes.length,sha256:sha(bytes)});
const write=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const writeRaw=(name,bytes)=>{fs.writeFileSync(path.join(output,name),bytes,{flag:'wx'});return record(name,bytes);};
const windows='C:\\Windows',powershell=path.win32.join(windows,'System32','WindowsPowerShell','v1.0','powershell.exe');
const helper='repositories/memoryos-readiness/helpers/windows-inspect.ps1';
const args=['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.resolve(root,helper)];
const environment={SystemRoot:windows,WINDIR:windows};
const sources=[helper,'repositories/memoryos-readiness/src/helper-protocol.mjs','repositories/memoryos-readiness/src/constants.mjs',
 'repositories/memoryos-readiness/src/canonical.mjs','repositories/memoryos-readiness/src/errors.mjs','repositories/memoryos-readiness/src/windows-paths.mjs',
 'repositories/memoryos-readiness/contracts/definitions.json',path.relative(root,fileURLToPath(import.meta.url)).replaceAll('\\','/')].map(member=>record(member));
const runtime={node:{...record(process.execPath),version:process.version,platform:process.platform,arch:process.arch},powershell:{...record(powershell),requiredVersionPrefix:'5.1.'}};
const operations=['READ_SET','READ_SET','READ_SET','CHECK_OUTPUT','CHECK_OUTPUT','INSPECT_OUTPUT_ROOT','CHECK_STAGE_ROOT','INSPECT_PENDING','CHECK_FINALIZATION'];
const session=randomBytes(32).toString('hex');
const inputRoot=path.win32.join(root,'.cache','mo1307','guard-characterization-input');
const outputRoot=path.win32.join(root,'.cache','mo1307','guard-characterization-output');
function request(sequence){
 const file=(id,maxBytes)=>({id,maxBytes,path:id+'.json',root:'input'});
 return {kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',session,sequence,operation:operations[sequence-1],
  roots:[{id:sequence<4?'input':'output',path:sequence<4?inputRoot:outputRoot}],
  files:sequence===1?[file('authority',D.limits.authorityBytes),file('config',D.limits.configurationBytes)]
   :sequence===2?[file('candidate',D.limits.candidateBytes),file('manifest',D.limits.manifestBytes)]
    :sequence===3?[file('evidence',D.limits.rawSourceBytes)]:[]};
}
const campaign={kind:'MO1307PublicationGuardCharacterizationCampaign',version:'1.0.0',startedAt:new Date().toISOString(),
 classification:'BOUNDED_FIXED_GUARD_STARTUP_AND_FRAMING_ONLY',expectedInvocations:9,expectedFramesPerInvocation:1,sequences:[1,2,3,4,5,6,7,8,9],operations,
 expectedResponse:{status:'ERROR',code:'MO1307_INTERNAL',exit:0,roots:[],files:[]},runtime,sourceBindings:sources,
 invocation:{executable:powershell,args,environment,windowsHide:true,retries:0},
 thresholds:{eachInvocationStrictlyBelowMs:5000,aggregateHelperActiveStrictlyBelowMs:20000,guardSeriesWallStrictlyBelowMs:20000,cliWallStrictlyBelowMs:30000},
 metadataProbe:{count:1,insideGuardMeasurements:false,purpose:'Read fixed PowerShell runtime version before the nine measured guard invocations'},
 noWorker:true,workerOverlap:false,successfulAssessmentLifecycle:false,nativeAcquisition:false,nativeHandleCertification:false,consoleProcessProof:false,
 retainedSemanticCharacterization:'Prior Phase 1 semantic characterization is unchanged and is not rerun.',
 limitation:'Each guard invocation independently validates one framed request then rejects with MO1307_INTERNAL. ERROR is terminal in a real assessment; these nine independent measurements are not a successful nine-state lifecycle. No supplied path is acquired and no identity is fabricated.'};
write('campaign.json',campaign);
const receipt={kind:'MO1307PublicationGuardCharacterization',version:'1.0.0',campaign:record(relative+'/campaign.json'),runtime,sourceBindings:sources,startedAt:campaign.startedAt,
 classification:campaign.classification,invocations:[],result:'FAIL',nativeAcquisition:false,nativeHandleCertification:false,consoleProcessProof:false,
 successfulAssessmentLifecycle:false,workersStarted:0,maxConcurrentSpawnedGuards:1,processTopologyCertified:false,network:false,retries:0,
 previousSemanticCharacterizationRetained:true,limitation:campaign.limitation};
let seriesStart=null,activeTotal=0;
try {
 assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(runtime.node.sha256,D.runtime.nodeSha256);
 assert.equal(D.limits.helperRequests,9);assert.equal(D.limits.helperDeadlineMs,5000);assert.equal(D.limits.helperAggregateDeadlineMs,20000);assert.equal(D.limits.cliDeadlineMs,30000);
 const versionArgs=['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-Command','$PSVersionTable.PSVersion.ToString()'];
 const probe=spawnSync(powershell,versionArgs,{cwd:root,windowsHide:true,env:environment,encoding:null,timeout:5000,maxBuffer:4096});
 receipt.metadataProbe={executable:powershell,args:versionArgs,exit:probe.status,error:probe.error?.code??null,
  stdout:writeRaw('powershell-version.stdout.txt',probe.stdout??Buffer.alloc(0)),stderr:writeRaw('powershell-version.stderr.txt',probe.stderr??Buffer.alloc(0))};
 assert.ifError(probe.error);assert.equal(probe.status,0);assert.equal(probe.stderr.length,0);
 runtime.powershell.version=probe.stdout.toString('utf8').trim();assert.match(runtime.powershell.version,/^5\.1\.\d+\.\d+$/);
 seriesStart=performance.now();
 for(let sequence=1;sequence<=9;sequence++){
  const value=request(sequence),bytes=encodeHelperRequest(value);assert.deepEqual(encodeHelperRequest(decodeHelperRequest(bytes)),bytes);
  const stem=String(sequence).padStart(2,'0'),requestBinding=writeRaw(stem+'.request.bin',bytes);
  const launch=performance.now();assert.ok(launch-seriesStart<30000);assert.ok(activeTotal<20000);
  const timeRemaining=Math.min(5000,20000-activeTotal,30000-(launch-seriesStart));
  const child=spawnSync(powershell,args,{cwd:root,windowsHide:true,env:environment,input:bytes,encoding:null,timeout:Math.ceil(timeRemaining),maxBuffer:D.limits.helperResponseBytes+D.limits.stderrBytes});
  const exited=performance.now(),elapsed=exited-launch;activeTotal+=elapsed;
  const stdout=child.stdout??Buffer.alloc(0),stderr=child.stderr??Buffer.alloc(0);
  const row={sequence,operation:value.operation,session,pid:child.pid??null,request:requestBinding,
   response:writeRaw(stem+'.response.bin',stdout),stderr:writeRaw(stem+'.stderr.txt',stderr),exit:child.status,signal:child.signal,error:child.error?.code??null,
   helperExitedBeforeNextLaunch:child.status!==null&&!child.error,launchOffsetMs:launch-seriesStart,exitOffsetMs:exited-seriesStart,elapsedMs:elapsed,aggregateActiveMs:activeTotal,
   result:'FAIL'};receipt.invocations.push(row);
  assert.ifError(child.error);assert.equal(child.status,0);assert.equal(child.signal,null);assert.equal(stderr.length,0);
  assert.ok(elapsed<5000);assert.ok(activeTotal<20000);assert.ok(exited-seriesStart<20000);assert.ok(exited-seriesStart<30000);
  const response=decodeHelperResponse(stdout,value);assert.equal(response.status,'ERROR');assert.equal(response.code,'MO1307_INTERNAL');assert.deepEqual(response.roots,[]);assert.deepEqual(response.files,[]);
  assert.equal(response.sequence,sequence);assert.equal(response.session,session);assert.equal(response.operation,value.operation);
  row.protocol={closedFrame:true,matchingSequence:true,matchingSession:true,matchingOperation:true,status:response.status,code:response.code};row.result='PASS';
 }
 receipt.seriesWallMs=performance.now()-seriesStart;receipt.aggregateHelperActiveMs=activeTotal;assert.ok(receipt.seriesWallMs<20000);assert.equal(receipt.invocations.length,9);
 for(const source of sources)assert.deepEqual(record(source.path),source);
 assert.deepEqual(record(process.execPath),{path:runtime.node.path,byteLength:runtime.node.byteLength,sha256:runtime.node.sha256});assert.equal(record(powershell).sha256,runtime.powershell.sha256);
 receipt.result='PASS';
} catch(error){receipt.error={name:error.name,code:error.code??null,message:error.message,stack:error.stack};receipt.seriesWallMs=seriesStart===null?null:performance.now()-seriesStart;receipt.aggregateHelperActiveMs=activeTotal;process.exitCode=1;}
receipt.finishedAt=new Date().toISOString();write('receipt.json',receipt);
process.stdout.write(JSON.stringify({result:receipt.result,invocations:receipt.invocations.length,seriesWallMs:receipt.seriesWallMs,aggregateHelperActiveMs:receipt.aggregateHelperActiveMs,classification:receipt.classification})+'\n');
