// One fresh minimum wire smoke. No retry, fallback launch or later security cases.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';
import {spawn,spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {createSupervisor} from '../../../memoryos-readiness/src/runtime.mjs';
import {createHelperTransportForTesting,helperLaunchSpecification} from '../../../memoryos-readiness/src/helper-transport.mjs';
import {encodeHelperRequest,decodeHelperResponse} from '../../../memoryos-readiness/src/helper-protocol.mjs';
import {DEFINITIONS} from '../../../memoryos-readiness/src/constants.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),driver=fileURLToPath(import.meta.url);
const pkg=path.join(root,'repositories/memoryos-readiness');
const E=path.join(root,'repositories/cca-conformance/evidence/mo1307/startup-resolution/minimum-wire-smoke');
const scratch=path.join(root,'.cache/mo1307-startup-resolution-minimum-wire-smoke');
assert.equal(process.argv.length,2);assert.equal(fs.existsSync(E),false,'One fixed append-only smoke generation');
fs.mkdirSync(E,{recursive:true});
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const record=file=>{const b=fs.readFileSync(file);return{path:path.relative(root,file).replaceAll('\\','/'),byteLength:b.length,sha256:hash(b)};};
const put=(name,bytes)=>{const file=path.join(E,name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,bytes,{flag:'wx'});return record(file);};
const write=(name,obj)=>put(name,Buffer.from(JSON.stringify(obj,null,2)+'\n'));
const errorRecord=e=>({name:e.name,code:e.code??null,stage:e.stage??null,message:e.message,stack:e.stack});
const git=(...args)=>{const r=spawnSync('C:/Program Files/Git/cmd/git.exe',['-c','safe.directory='+root.replaceAll('\\','/').replace(/\/$/,''),...args],{cwd:root,windowsHide:true,encoding:'utf8'});assert.ifError(r.error);assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const packageFiles=JSON.parse(fs.readFileSync(path.join(pkg,'package.json'))).files;
const members=()=>packageFiles.map(name=>record(path.join(pkg,name)));
const before=members(),launch=helperLaunchSpecification(),L=DEFINITIONS.limits;
const toolsDirectory=path.dirname(driver),securityManifest=path.join(toolsDirectory,'security-manifest.json');
const declaredMatrix=JSON.parse(fs.readFileSync(securityManifest));
assert.deepEqual(declaredMatrix.items.map(x=>x.id),Array.from({length:15},(_,i)=>String.fromCharCode(65+i)));
const priorDir=path.join(root,'repositories/cca-conformance/evidence/mo1307/headless-cleanup/minimum-wire-smoke');
const prior=JSON.parse(fs.readFileSync(path.join(priorDir,'receipt.json')));
const priorSeal=JSON.parse(fs.readFileSync(path.join(priorDir,'seal.json')));
const base=path.dirname(E),repairPath=path.join(base,'repair-binding.json'),diagnosticPath=path.join(base,'diagnostic/receipt.json');
const governancePaths=['docs/mo1307-headless-cleanup-correction.md','repositories/cca-conformance/evidence/mo1307/startup-resolution/user-request.txt','docs/mo1307-startup-resolution.md'];
let postRepairBindings=[];
const checkPostRepair=()=>{for(const binding of postRepairBindings)assert.deepEqual(record(path.join(root,binding.path)),binding);};
const row={name:'minimum-wire-smoke',kind:'ONE_REAL_FIXED_PRODUCTION_HELPER',result:'FAIL',startedAt:new Date().toISOString(),helperInvocations:0,events:[]};
let failure=null,sourceUnchanged=false,seal=null;
try{
 assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');assert.equal(process.version,'v24.21.0');
 assert.equal(prior.result,'FAIL');assert.equal(prior.helperInvocations,1);
 assert.deepEqual(record(process.execPath),priorSeal.runtime[0]);assert.deepEqual(record(launch.executable),priorSeal.runtime[1]);
 const repair=JSON.parse(fs.readFileSync(repairPath)),diagnostic=JSON.parse(fs.readFileSync(diagnosticPath));
 assert.equal(repair.kind,'MO1307StartupResolutionRepairBinding');assert.equal(repair.result,'READY_FOR_ONE_POST_REPAIR_SMOKE');assert.equal(repair.candidate,null);assert.equal(repair.repairApplied,true);
 assert.deepEqual(repair.source,before);assert.deepEqual(repair.diagnostic,record(diagnosticPath));
 assert.equal(diagnostic.result,'STARTUP_FAILURE_CAPTURED');assert.equal(diagnostic.helperInvocations,1);assert.equal(diagnostic.sourceUnchanged,true);
 assert.ok(['STARTUP_PIPE_DEFECT','STARTUP_NATIVE_BINDING_DEFECT','STARTUP_CONSOLE_MEMBERSHIP_DEFECT','STARTUP_DETACH_DEFECT','STARTUP_POST_DETACH_PROOF_DEFECT','STARTUP_CLEANUP_DEFECT','STARTUP_EXCEPTION_DEFECT'].includes(diagnostic.classification),'Captured mechanical defect required; implementation conflict must stop');
 assert.ok(typeof diagnostic.diagnosis?.firstFailure?.id==='string');
 const governance=governancePaths.map(name=>record(path.join(root,name)));assert.deepEqual(repair.governance,governance);
 postRepairBindings=[record(repairPath),record(diagnosticPath),...governance];
 if(repair.diagnosis){assert.equal(repair.diagnosis.path,'repositories/cca-conformance/evidence/mo1307/startup-resolution/diagnostic/diagnosis.json');postRepairBindings.push(repair.diagnosis);}
 checkPostRepair();
 const candidate=null,packageTree=null,sourceBaseHead=git('rev-parse','HEAD'),sourceBasePackageTree=git('rev-parse','HEAD:repositories/memoryos-readiness');
 const workingProductionDiff=git('diff','HEAD','--','repositories/memoryos-readiness');
 row.candidate=candidate;row.packageTree=packageTree;row.candidateStatus='NOT_YET_CANDIDATE';row.sourceBaseHead=sourceBaseHead;row.sourceBasePackageTree=sourceBasePackageTree;
 const helper=record(path.join(pkg,'helpers/windows-inspect.ps1'));
 assert.equal(before.length,89,'Exact working package inventory');
 assert.equal(launch.options.detached,false);assert.equal(launch.options.windowsHide,true);assert.equal(launch.options.shell,false);
 assert.deepEqual([...launch.options.stdio],['pipe','pipe','pipe']);assert.deepEqual({...launch.options.env},{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'});
 assert.equal(launch.executable,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
 assert.deepEqual([...launch.args],['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(pkg,'helpers/windows-inspect.ps1')]);
 for(const [key,value]of Object.entries({helperDeadlineMs:5000,helperAggregateDeadlineMs:20000,cliDeadlineMs:30000,apiDeadlineMs:10000,cleanupAllowanceMs:2000}))assert.equal(L[key],value);
 assert.equal(fs.existsSync(scratch),false,'Private input must be fresh');fs.mkdirSync(path.join(scratch,'input'),{recursive:true});const input=path.join(scratch,'input/small.bin');fs.writeFileSync(input,'{}\n',{flag:'wx'});
 const request={kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',session:randomBytes(32).toString('hex'),sequence:3,operation:'READ_SET',roots:[{id:'input',path:path.join(scratch,'input')}],files:[{id:'small',maxBytes:2097152,path:'small.bin',root:'input'}]};
 const frame=encodeHelperRequest(request);row.request=put('request.bin',frame);
 write('seal.json',{kind:'MO1307MinimumWireSmokeSeal',sealedAt:new Date().toISOString(),candidate,packageTree,candidateStatus:'NOT_YET_CANDIDATE',sourceBaseHead,sourceBasePackageTree,workingProductionDiff,source:before,driver:record(driver),governance,postRepairBindings,securityManifest:record(securityManifest),securityDrivers:['security.mjs','startup-double.ps1'].map(name=>record(path.join(toolsDirectory,name))),runtime:[record(process.execPath),record(launch.executable)],input:record(input),request:row.request,decodedRequest:request,launch,priorFailedReceipt:record(path.join(priorDir,'receipt.json')),priorRuntimeSeal:record(path.join(priorDir,'seal.json')),limits:{helperMs:5000,aggregateMs:20000,cliMs:30000,apiMs:10000,cleanupMs:2000,nativeHostWaitMs:1000},policy:{once:true,noRetry:true,noFallback:true,stopOnFailure:true,additionalSecurityCases:0,certification:false},expected:{exit:0,stderrBytes:0,status:'OK',exactFileBytes:'{}LF',singleFrame:true,allStreamsSettled:true,cleanupConfirmed:true}});
 seal=record(path.join(E,'seal.json'));row.seal=seal;
 for(const binding of before)assert.deepEqual(record(path.join(root,binding.path)),binding);
 const captured={stdout:[],stderr:[]},totals={stdout:0,stderr:0},retained={stdout:0,stderr:0};
 const state={stdinFinished:false,stdinClosed:false,stdoutEnded:false,stdoutClosed:false,stderrEnded:false,stderrClosed:false,processExited:false,processClosed:false};
 let result=null,problem=null,childCode=null,childSignal=null;
 const at=performance.now();
 const event=(name,detail={})=>row.events.push({event:name,at:performance.now(),elapsedMs:performance.now()-at,...detail});
 const supervisor=createSupervisor({kind:'cli'});
 const transport=createHelperTransportForTesting(supervisor,(executable,args,options)=>{
  assert.equal(executable,launch.executable);assert.deepEqual(args,[...launch.args]);assert.deepEqual(options,{...launch.options,env:{...launch.options.env},stdio:[...launch.options.stdio]});
  assert.equal(row.helperInvocations,0);row.helperInvocations++;const child=spawn(executable,args,options);row.pid=child.pid;
  child.once('spawn',()=>event('spawn'));
  child.stdin.once('finish',()=>{state.stdinFinished=true;event('stdin-finish');});
  for(const label of ['stdout','stderr']){
   child[label].once('end',()=>{state[label+'Ended']=true;event(label+'-end');});
   child[label].on('data',bytes=>{
    totals[label]+=bytes.length;const cap=label==='stdout'?L.helperResponseBytes:L.stderrBytes;
    const keep=bytes.subarray(0,Math.max(0,cap-retained[label]));if(keep.length){captured[label].push(Buffer.from(keep));retained[label]+=keep.length;}
   });
  }
  for(const [label,stream]of [['stdin',child.stdin],['stdout',child.stdout],['stderr',child.stderr]]){
   stream.once('close',()=>{state[label+'Closed']=true;event(label+'-close');});
   stream.on('error',error=>event(label+'-error',{code:error.code??null,message:error.message}));
  }
  child.once('error',error=>event('process-error',{code:error.code??null,message:error.message}));
  child.once('exit',(code,signal)=>{state.processExited=true;event('process-exit',{code,signal});});
  child.once('close',(code,signal)=>{state.processClosed=true;childCode=code;childSignal=signal;event('process-close',{code,signal});});
  return child;
 });
 write('invocation-start.json',{candidate,candidateStatus:'NOT_YET_CANDIDATE',startedAt:new Date().toISOString(),seal,launch,request:row.request,noRetry:true});
 try{result=await transport.exchange(frame);}catch(error){problem=error;}
 finally{
  try{await supervisor.dispose();}catch(error){problem??=error;}
  row.elapsedProductMs=performance.now()-at;row.snapshot=supervisor.snapshot();row.streams=state;row.exitCode=childCode;row.exitSignal=childSignal;
  row.stdout=put('stdout.data',Buffer.concat(captured.stdout));row.stderr=put('stderr.data',Buffer.concat(captured.stderr));row.stdoutTotalBytes=totals.stdout;row.stderrTotalBytes=totals.stderr;row.captureTruncated=totals.stdout>retained.stdout||totals.stderr>retained.stderr;
 }
 if(problem)throw problem;
 assert.equal(row.helperInvocations,1);assert.equal(childCode,0);assert.equal(childSignal,null);assert.equal(result.exitConfirmed,true);assert.equal(totals.stderr,0);assert.equal(row.captureTruncated,false);
 for(const [name,value]of Object.entries(state))assert.equal(value,true,name);
 const output=Buffer.concat(captured.stdout);assert.deepEqual(output,Buffer.from(result.responseBytes));assert.ok(output.length>=4);assert.equal(output.readUInt32BE(0)+4,output.length,'Exactly one framed response');
 const response=decodeHelperResponse(output,request);assert.equal(response.status,'OK');assert.equal(response.code,null);assert.equal(response.files.length,1);assert.equal(response.files[0].id,'small');assert.deepEqual(Buffer.from(response.files[0].bytes.join(''),'base64'),Buffer.from('{}\n'));
 row.response={status:response.status,version:response.version,sequence:response.sequence,operation:response.operation,fileCount:response.files.length,sha256:hash(output),byteLength:output.length};
 assert.equal(row.snapshot.helpers,1);assert.equal(row.snapshot.workers,0);assert.equal(row.snapshot.activeRole,null);assert.equal(row.snapshot.cleanupConfirmed,true);assert.equal(row.snapshot.terminalCode,null);assert.ok(row.snapshot.helperUsedMs<5000);assert.ok(row.elapsedProductMs<5000);
 assert.deepEqual(members(),before);row.result='PASS';
}catch(error){failure=errorRecord(error);row.failure=failure;}
finally{
 try{assert.deepEqual(members(),before);checkPostRepair();sourceUnchanged=true;}catch(error){failure??=errorRecord(error);row.failure??=failure;row.result='FAIL';}
 if(failure)write('stopped.json',{reason:'FIRST_MINIMUM_WIRE_FAILURE',failure,noMoreHelpers:true,noMoreSecurityCases:true,noRetry:true,certificationStarted:false});
 write('receipt.json',{kind:'MO1307MinimumWireSmokeReceipt',result:failure?'FAIL':'PASS',candidateStatus:'NOT_YET_CANDIDATE',candidate:row.candidate??null,packageTree:row.packageTree??null,case:row,failure,seal,sourceUnchanged,source:before,helperInvocations:row.helperInvocations,additionalCasesExecuted:0,noRetry:true,certificationStarted:false,finishedAt:new Date().toISOString(),limitsUnchanged:true,hostProof:'A valid frame establishes successful startup pipe/membership/self-detach checks; supervisor evidence establishes bounded helper/transport quiescence. No host object is identified and no conhost termination is claimed.'});
 console.log(JSON.stringify({result:failure?'FAIL':'PASS',helperInvocations:row.helperInvocations,exit:row.exitCode??null,stdoutBytes:row.stdoutTotalBytes??null,stderrBytes:row.stderrTotalBytes??null,error:failure?.code??null,receipt:path.join(E,'receipt.json')}));
 process.exitCode=failure?1:0;
}
