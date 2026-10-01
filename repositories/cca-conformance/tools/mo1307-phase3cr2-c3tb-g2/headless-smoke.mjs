// One fresh C3TB minimum wire smoke. No retry, fallback launch or later security cases.
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
const evidenceRoot=path.join(root,'repositories/cca-conformance/evidence/mo1307/phase3cr2-c3tb-g2'),E=path.join(evidenceRoot,'headless-smoke');
const scratch=path.join(root,'.cache/mo1307-phase3cr2-c3tb-g2-headless-smoke');
const C3TB='119e68bdcf0ffc906b4ca03a912aadcb25908346',C3T='65e24b2debdd70ecb8e52fbccbd6c101621f1917',PRODUCTION_TREE='324bf600b6cbfaa8564db27fce2d999711270cb8';
const expectedNode={version:'v24.21.0',platform:'win32',arch:'x64',byteLength:93580104,sha256:'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'};
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
assert.deepEqual(declaredMatrix.items.map(x=>x.id),Array.from({length:19},(_,i)=>String.fromCharCode(65+i)));
const bindingBase='repositories/cca-conformance/evidence/mo1307/prospective-helper-bound-candidate';
const authorityBindings=[
 {path:bindingBase+'/authority.json',byteLength:1934,sha256:'sha256:ba8f9f085d8339348f69bd777fd0619b4d7594b9566b72cd0e5af6a3ed39b9b0'},
 {path:bindingBase+'/candidate.json',byteLength:20084,sha256:'sha256:38a20eecd128be0407b926ad3064d6e3f5e66ec62f96787c3a634e7992faf76d'},
 {path:bindingBase+'/binding.json',byteLength:27189,sha256:'sha256:dde0766b80e65bc3426a6c2bdc3208bdd1b8ecd7ca17aa2594449cfe6ccb7175'},
 {path:bindingBase+'/binding-verification.json',byteLength:1155,sha256:'sha256:f322d1ba53a9ab18fc3638b367fb770b5c2d47a1dd5ffbe7ae06ad82373555d1'},
 {path:bindingBase+'/consistency-validation.json',byteLength:2567,sha256:'sha256:8362dbf4418fe234226c773758a3e490f6d9d67738447940ce96c9dd1ca00346'},
 {path:bindingBase+'/phase3c-refresh-map.json',byteLength:21293,sha256:'sha256:ada9532c868c69d7b6b951535f8f4a501c728a24057da6423308d5540192c16b'}
];
const readAuthority=name=>JSON.parse(fs.readFileSync(path.join(root,bindingBase,name)));
const checkAuthority=()=>{for(const binding of authorityBindings)assert.deepEqual(record(path.join(root,binding.path)),binding);};
const row={name:'headless-smoke',kind:'ONE_REAL_FIXED_C3TB_PRODUCTION_HELPER',result:'FAIL',candidate:C3TB,productionTree:PRODUCTION_TREE,startedAt:new Date().toISOString(),helperInvocations:0,events:[]};
let failure=null,sourceUnchanged=false,seal=null;
try{
 assert.equal(process.platform,expectedNode.platform);assert.equal(process.arch,expectedNode.arch);assert.equal(process.version,expectedNode.version);
 const nodeRuntime=record(process.execPath);assert.equal(nodeRuntime.byteLength,expectedNode.byteLength);assert.equal(nodeRuntime.sha256,expectedNode.sha256);
 checkAuthority();
 const candidateEvidence=readAuthority('candidate.json'),candidateBinding=readAuthority('binding.json'),bindingVerification=readAuthority('binding-verification.json'),consistency=readAuthority('consistency-validation.json'),refreshMap=readAuthority('phase3c-refresh-map.json');
 assert.equal(bindingVerification.result,'PASS');assert.equal(bindingVerification.candidateCommit,C3T);assert.equal(bindingVerification.productionTree,PRODUCTION_TREE);assert.equal(bindingVerification.productionChangesInBindingCommit,false);assert.ok(bindingVerification.checks.includes('C3TB_BINDING_ONLY'));
 assert.equal(candidateBinding.package.productionTree,PRODUCTION_TREE);assert.equal(candidateBinding.package.memberCount,89);assert.equal(candidateBinding.limits.helperMs,8000);
 assert.equal(consistency.result,'PASS');assert.equal(consistency.limits.helperMs,8000);assert.deepEqual(consistency.strictBoundary,{equalityFailsClosed:true,success:'<8000',timeout:'>=8000'});
 assert.equal(refreshMap.consumeRule,'EXACT_C3TB_HEAD_AFTER_BINDING_VERIFICATION');assert.equal(refreshMap.status,'PENDING_SEPARATE_EXECUTION');assert.deepEqual(refreshMap.accounting,{dependencyReuseCandidates:462,historicalInventory:551,omitted:0,selectedFreshHistoricalControls:89});assert.deepEqual(refreshMap.additionalHeadlessCases,Array.from({length:19},(_,i)=>String.fromCharCode(65+i)));
 const helperSource=fs.readFileSync(path.join(pkg,'helpers/windows-inspect.ps1'),'utf8');
 const consoleStart=helperSource.indexOf('function Confirm-ConsoleQuiescence {'),consoleEnd=helperSource.indexOf('function Open-Native(',consoleStart);
 assert.ok(consoleStart>=0&&consoleEnd>consoleStart);
 const consoleBody=helperSource.slice(consoleStart,consoleEnd);
 assert.equal((consoleBody.match(/\$script:native::GetConsoleProcessList\(/g)??[]).length,1);
 assert.equal((consoleBody.match(/\$script:native::FreeConsole\(\)/g)??[]).length,1);
 assert.ok(/\$count -ne 1 -or \[Runtime.InteropServices.Marshal\]::ReadInt32\(\$buffer\) -ne \$PID/.test(consoleBody));
 assert.ok(/if \(-not \$script:native::FreeConsole\(\)\) \{ Reject-Protocol 'MO1307_INTERNAL' \}/.test(consoleBody));
 assert.equal(/GetLastWin32Error|\{\s*return\s*\}|AllocConsole|AttachConsole|GetConsoleWindow|OpenProcess|TerminateProcess/.test(consoleBody),false);
 row.startupGate={basis:'EXACT_SOURCE_AND_VALID_MATCHING_FRAME',functionSha256:hash(Buffer.from(consoleBody)),sourceMembershipCallSites:1,postDetachMembershipQuery:false,initialZeroSuccess:false,unidentifiedHostExitClaim:false};
 const candidate=C3TB,packageTree=PRODUCTION_TREE,candidateStatus='BOUND_C3TB',sourceBaseHead=git('rev-parse','HEAD'),sourceParent=git('rev-parse','HEAD^'),sourceBasePackageTree=git('rev-parse','HEAD:repositories/memoryos-readiness');
 const workingProductionDiff=git('diff','HEAD','--','repositories/memoryos-readiness');
 assert.equal(sourceBaseHead,C3TB);assert.equal(sourceParent,C3T);assert.equal(sourceBasePackageTree,PRODUCTION_TREE);assert.equal(workingProductionDiff,'');
 assert.equal(candidateEvidence.package.name,'memoryos-readiness');assert.equal(candidateEvidence.package.version,'0.1.0');assert.equal(candidateEvidence.package.contract,'memoryos.readiness@1.0.0');assert.equal(candidateEvidence.package.packageMemberCount,89);
 const expectedPackage=candidateEvidence.package.members.map(member=>({...member,path:'repositories/memoryos-readiness/'+member.path}));assert.deepEqual(before,expectedPackage);
 row.candidate=candidate;row.packageTree=packageTree;row.packageIdentity=candidateEvidence.package.packageIdentity;row.candidateStatus=candidateStatus;row.sourceBaseHead=sourceBaseHead;row.sourceParent=sourceParent;row.sourceBasePackageTree=sourceBasePackageTree;
 const helper=record(path.join(pkg,'helpers/windows-inspect.ps1'));
 assert.equal(before.length,89,'Exact working package inventory');
 assert.equal(launch.options.detached,false);assert.equal(launch.options.windowsHide,true);assert.equal(launch.options.shell,false);
 assert.deepEqual([...launch.options.stdio],['pipe','pipe','pipe']);assert.deepEqual({...launch.options.env},{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'});
 assert.equal(launch.executable,'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe');
 assert.deepEqual([...launch.args],['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(pkg,'helpers/windows-inspect.ps1')]);
 for(const [key,value]of Object.entries({helperDeadlineMs:8000,helperAggregateDeadlineMs:20000,cliDeadlineMs:30000,apiDeadlineMs:10000,cleanupAllowanceMs:2000}))assert.equal(L[key],value);
 assert.equal(fs.existsSync(scratch),false,'Private input must be fresh');fs.mkdirSync(path.join(scratch,'input'),{recursive:true});const input=path.join(scratch,'input/small.bin');fs.writeFileSync(input,'{}\n',{flag:'wx'});
 const request={kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',session:randomBytes(32).toString('hex'),sequence:3,operation:'READ_SET',roots:[{id:'input',path:path.join(scratch,'input')}],files:[{id:'small',maxBytes:2097152,path:'small.bin',root:'input'}]};
 const frame=encodeHelperRequest(request);row.request=put('request.bin',frame);
 write('seal.json',{kind:'MO1307Phase3CR2HeadlessSmokeSeal',sealedAt:new Date().toISOString(),candidate,productionCandidate:C3T,packageTree,packageIdentity:candidateEvidence.package.packageIdentity,candidateStatus,sourceBaseHead,sourceParent,sourceBasePackageTree,workingProductionDiff,source:before,driver:record(driver),authorityBindings,bindingVerification:{result:bindingVerification.result,checks:bindingVerification.checks},refreshMap:{status:refreshMap.status,accounting:refreshMap.accounting,additionalHeadlessCases:refreshMap.additionalHeadlessCases},securityManifest:record(securityManifest),securityDrivers:['headless-security.mjs','startup-double.ps1','README.md'].map(name=>record(path.join(toolsDirectory,name))),runtime:[nodeRuntime,record(launch.executable)],runtimeExpectation:expectedNode,input:record(input),request:row.request,decodedRequest:request,launch,limits:{helperMs:8000,aggregateMs:20000,cliMs:30000,apiMs:10000,cleanupMs:2000,nativeHostWait:'NOT_APPLICABLE_NO_HOST_HANDLE'},policy:{once:true,noRetry:true,noFallback:true,stopOnFailure:true,additionalSecurityCases:0,certification:true},expected:{exit:0,stderrBytes:0,status:'OK',exactFileBytes:'{}LF',singleFrame:true,allStreamsSettled:true,cleanupConfirmed:true}});
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
 write('invocation-start.json',{candidate,candidateStatus,productionTree:packageTree,startedAt:new Date().toISOString(),seal,launch,request:row.request,noRetry:true});
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
 row.startupGate.positiveSoleHelperMembership=true;row.startupGate.selfFreeConsoleSucceeded=true;row.startupGate.firstRequestReadAndConsumption=true;
 row.response={status:response.status,version:response.version,sequence:response.sequence,operation:response.operation,fileCount:response.files.length,sha256:hash(output),byteLength:output.length};
 assert.equal(row.snapshot.helpers,1);assert.equal(row.snapshot.workers,0);assert.equal(row.snapshot.activeRole,null);assert.equal(row.snapshot.cleanupConfirmed,true);assert.equal(row.snapshot.terminalCode,null);assert.ok(row.snapshot.helperUsedMs<8000);assert.ok(row.elapsedProductMs<8000);
 assert.deepEqual(members(),before);row.result='PASS';
}catch(error){failure=errorRecord(error);row.failure=failure;}
finally{
 try{assert.deepEqual(members(),before);checkAuthority();sourceUnchanged=true;}catch(error){failure??=errorRecord(error);row.failure??=failure;row.result='FAIL';}
 if(failure)write('stopped.json',{reason:'FIRST_C3TB_HEADLESS_SMOKE_FAILURE',failure,noMoreHelpers:true,noMoreSecurityCases:true,noRetry:true,certificationStarted:true});
 write('receipt.json',{kind:'MO1307Phase3CR2HeadlessSmokeReceipt',result:failure?'FAIL':'PASS',candidateStatus:'BOUND_C3TB',candidate:row.candidate??C3TB,packageTree:row.packageTree??PRODUCTION_TREE,case:row,failure,seal,sourceUnchanged,source:before,helperInvocations:row.helperInvocations,additionalCasesExecuted:0,noRetry:true,certificationStarted:true,finishedAt:new Date().toISOString(),limitsVerified:true,hostProof:'Only PASS with a validated matching response and completed supervisor checks establishes the sole exact source success route, positive sole-helper membership, self-detachment, and helper/process/pipe quiescence. A FAIL receipt establishes none of those success claims. No host object or host death is claimed.'});
 console.log(JSON.stringify({result:failure?'FAIL':'PASS',helperInvocations:row.helperInvocations,exit:row.exitCode??null,stdoutBytes:row.stdoutTotalBytes??null,stderrBytes:row.stderrTotalBytes??null,error:failure?.code??null,receipt:path.join(E,'receipt.json')}));
 process.exitCode=failure?1:0;
}
