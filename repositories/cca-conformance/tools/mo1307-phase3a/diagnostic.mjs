// Engineering-only installed B2 observation; transparent spawn listener, no behavior/limit override.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {Writable} from 'node:stream';
import {performance} from 'node:perf_hooks';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url)), E=path.join(root,'repositories/cca-conformance/evidence/mo1307/phase3a');
const candidate=JSON.parse(fs.readFileSync(path.join(E,'candidate-identity.json'))),pkg=candidate.packageRoot;
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const load=n=>import(pathToFileURL(path.join(pkg,'src',n+'.mjs')));
const [{createSupervisor},{createHelperTransportForTesting,helperLaunchSpecification},{decodeHelperRequest,decodeHelperResponse},{orchestrateCli},{parseCliArgs},{DEFINITIONS}]=await Promise.all(['runtime','helper-transport','helper-protocol','cli','cli-args','constants'].map(load));
const attempt=process.argv[2];assert.equal(attempt,'attempt1');const out=path.join(E,'diagnostic',attempt);fs.mkdirSync(out,{recursive:true});
assert.equal(process.version,'v24.21.0');assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const write=(name,value)=>fs.writeFileSync(path.join(out,name),JSON.stringify(value,null,2)+'\n',{flag:'wx'});
const row=p=>{const b=fs.readFileSync(p);return {path:path.relative(root,p).replaceAll('\\','/'),byteLength:b.length,sha256:hash(b)};};
const scratch=path.join(root,'.cache/m7a-d1');fs.mkdirSync(scratch);
const input=path.join(scratch,'i'),pub=path.join(scratch,'p'),destination=path.join(pub,'r');
fs.cpSync(path.join(root,'repositories/cca-conformance/fixtures/mo1307/bundles/mo1306-qualified'),input,{recursive:true});fs.mkdirSync(pub);fs.writeFileSync(path.join(pub,'owned-parent.txt'),'Phase3A immutable private parent\n',{flag:'wx'});
const pins=JSON.parse(fs.readFileSync(path.join(input,'pins.json'))),manifest=JSON.parse(fs.readFileSync(path.join(input,'manifest.json')));
const installedBefore=JSON.parse(fs.readFileSync(path.join(E,'installed-before.json'))).members;
for(const m of installedBefore)assert.equal(hash(fs.readFileSync(path.join(pkg,m.path))),m.sha256);
const ready=path.join(out,'observer-ready.json'),stop=path.join(out,'observer-stop'),observerLog=path.join(out,'observer.jsonl'),python='C:\\Users\\melsa\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe';
const observerArgs=['-B',path.join(root,'repositories/cca-conformance/tools/mo1307-phase3a/process-observer.py'),'--pid',String(process.pid),'--ready',ready,'--output',observerLog,'--stop-file',stop,'--interval-ms','10','--timeout-seconds','90'];
const observer=spawn(python,observerArgs,{cwd:root,windowsHide:true,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'},stdio:['ignore','pipe','pipe']});
const observerOut=[],observerErr=[];observer.stdout.on('data',b=>observerOut.push(b));observer.stderr.on('data',b=>observerErr.push(b));
let observerExit=null,observerError=null;const observerClosed=new Promise(resolve=>{observer.once('error',e=>{observerError=String(e);resolve()});observer.once('close',code=>{observerExit=code;resolve()});});
const handshakeDeadline=performance.now()+15000;
while(!fs.existsSync(ready)&&observerExit===null&&observerError===null&&performance.now()<handshakeDeadline)await new Promise(r=>setTimeout(r,20));
assert.ok(fs.existsSync(ready),'Observer failed ready handshake');
write('campaign.json',{kind:'MO1307Phase3AInstalledDiagnosticCampaign',attempt,startedAt:new Date().toISOString(),B2:candidate.B2,packageRoot:pkg,packageArchive:candidate.archive,source:row(fileURLToPath(import.meta.url)),observerSource:row(observerArgs[1]),helper:row(path.join(pkg,'helpers/windows-inspect.ps1')),launch:helperLaunchSpecification(),inputManifestFiles:manifest.entries.length,inputManifestBytes:manifest.entries.reduce((s,x)=>s+x.byteLength,0),limits:DEFINITIONS.limits,invocations:1,retries:0,scope:'INSTALLED_ACTUAL_PRIVATE_CLI_ORCHESTRATOR_WITH_TRANSPARENT_LAUNCH_OBSERVER',observerSeam:'createHelperTransportForTesting receives pass-through spawn validating exact frozen launch; no delays, transformed bytes, fake response, worker substitution, or time override',diagnosticNotStandaloneBinAcceptance:true});
let sequence=0;
const transportEvents=[],requests=[],stdoutChunks=[];
const event=(type,data={})=>transportEvents.push({type,at:performance.now(),utcMs:performance.timeOrigin+performance.now(),...data});
const supervisor=createSupervisor({kind:'cli'}),launchSpec=helperLaunchSpecification();
const transport=createHelperTransportForTesting(supervisor,(exe,args,options)=>{
 assert.equal(exe,launchSpec.executable);assert.deepEqual(args,[...launchSpec.args]);assert.deepEqual(options.env,{...launchSpec.options.env});
 const ordinal=sequence;event('spawn_call',{ordinal,exe,args});
 const child=spawn(exe,args,options);event('spawn_return',{ordinal,pid:child.pid??null});
 let bytes=0;child.once('spawn',()=>event('spawn_event',{ordinal,pid:child.pid}));
 for(const [name,stream] of [['stdin',child.stdin],['stdout',child.stdout],['stderr',child.stderr]]){
  for(const kind of ['finish','end','close'])stream.once(kind,()=>event(name+'_'+kind,{ordinal}));
  stream.once('error',e=>event(name+'_error',{ordinal,code:e.code??null}));
 }
 child.stdout.on('data',b=>{bytes+=b.length;event('stdout_data',{ordinal,chunkBytes:b.length,totalBytes:bytes});});
 child.stderr.on('data',b=>event('stderr_data',{ordinal,byteLength:b.length}));
 child.once('exit',(code,signal)=>event('process_exit',{ordinal,pid:child.pid,code,signal}));
 child.once('close',(code,signal)=>event('process_close',{ordinal,pid:child.pid,code,signal}));
 return child;
});
const exchange=async frame=>{
 const req=decodeHelperRequest(frame);sequence=req.sequence;const prefix=String(sequence).padStart(2,'0');
 const r={sequence,operation:req.operation,session:req.session,fileCount:req.files.length,startedAt:performance.now(),utcMs:performance.timeOrigin+performance.now()};requests.push(r);
 fs.writeFileSync(path.join(out,prefix+'.request.bin'),frame,{flag:'wx'});r.request=row(path.join(out,prefix+'.request.bin'));
 try{const answer=await transport.exchange(frame);fs.writeFileSync(path.join(out,prefix+'.response.bin'),answer.responseBytes,{flag:'wx'});r.response=row(path.join(out,prefix+'.response.bin'));const decoded=decodeHelperResponse(answer.responseBytes,req);r.status=decoded.status;r.exitConfirmed=answer.exitConfirmed;return answer;}
 catch(e){r.error={code:e.code,stage:e.stage,message:e.message};throw e;}
 finally{r.finishedAt=performance.now();r.elapsedMs=r.finishedAt-r.startedAt;}
};
const launch=parseCliArgs(['evaluate','--input-root',input,'--config','configuration.json','--authority','authority.json','--authority-sha256',pins.trustedAuthorityDigest,'--candidate-sha256',pins.expectedCandidateDigest,'--output-root',destination]);
const started=performance.now();let outcome=null,failure=null;
const stdout=new Writable({write(b,_e,cb){stdoutChunks.push(Buffer.from(b));cb();}});
try{outcome=await orchestrateCli(launch,{supervisor,exchange,stdout});}
catch(e){failure={code:e.code??null,stage:e.stage??null,message:e.message};}
finally{try{await supervisor.dispose();}catch(e){failure??={code:e.code??null,message:e.message};}}
const productReturnedAt=performance.now(),snapshot=supervisor.snapshot();event('product_return',{snapshotTerminal:snapshot.events.find(e=>e.type==='terminal')??null});
fs.writeFileSync(stop,'product returned; finish direct process-handle observations\n',{flag:'wx'});
await observerClosed;
fs.writeFileSync(path.join(out,'observer.stdout.txt'),Buffer.concat(observerOut),{flag:'wx'});fs.writeFileSync(path.join(out,'observer.stderr.txt'),Buffer.concat(observerErr),{flag:'wx'});
fs.writeFileSync(path.join(out,'stdout.data'),Buffer.concat(stdoutChunks),{flag:'wx'});
write('transport-events.json',{timeOrigin:performance.timeOrigin,events:transportEvents});
const names=fs.existsSync(destination)?fs.readdirSync(destination).sort():[],namespace={outputRootExists:fs.existsSync(destination),names};
let exactResult=false;if(!failure){const actual=fs.readFileSync(path.join(destination,'memoryos-readiness-result.json')),expected=fs.readFileSync(path.join(input,'expected-result.json'));exactResult=actual.equals(expected);assert.equal(outcome.exitCode,2);assert.ok(exactResult);}
const after=installedBefore.map(m=>({...m,sha256:hash(fs.readFileSync(path.join(pkg,m.path)))}));assert.deepEqual(after,installedBefore);
write('receipt.json',{kind:'MO1307Phase3AInstalledDiagnostic',result:failure?'FAIL':'PASS',failure,outcome,scope:'FRESH_INSTALLED_PRIVATE_ORCHESTRATOR_DIAGNOSTIC',standaloneBinCertified:false,attemptCount:1,productionElapsedMs:productReturnedAt-started,observerElapsedMs:performance.now()-started,timeOrigin:performance.timeOrigin,inputSizes:{manifestFiles:manifest.entries.length,manifestBytes:manifest.entries.reduce((s,x)=>s+x.byteLength,0)},requests,snapshot,namespace,exactResult,stdout:row(path.join(out,'stdout.data')),observer:{exit:observerExit,error:observerError,log:row(observerLog),completeProcessCoverageClaim:false},transportEvents:row(path.join(out,'transport-events.json')),installedIntegrityUnchanged:true,sourceBytesChanged:false,frozenLimitsChanged:false,rootCause:'MEASUREMENT_ANALYSIS_REQUIRED',certificationClaim:false});
console.log(JSON.stringify({result:failure?'FAIL':'PASS',failure,helpers:snapshot.helpers,workers:snapshot.workers,cleanupConfirmed:snapshot.cleanupConfirmed,productionElapsedMs:productReturnedAt-started,namespace,observerExit}));process.exitCode=failure?1:0;
