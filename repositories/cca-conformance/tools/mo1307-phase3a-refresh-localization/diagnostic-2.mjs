// Exactly one diagnostic invocation; exact installed production flow and clocks.
// Metadata is buffered during live clocks. No request/response content is logged.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';import {Writable} from 'node:stream';import {performance} from 'node:perf_hooks';import {pathToFileURL} from 'node:url';
import {root,E,T,pkg,oldE,env,HEAD,read,json,record,check,walk,write,hash,identity} from './common.mjs';
identity();const base=json(path.join(E,'baseline.json'));base.outputRoot=path.join(root,'.cache/m7r/vectors/v0/p/l2');const before=walk(pkg);assert.deepEqual(before,base.installed);
assert.equal(process.argv.length,2);assert.equal(json(path.join(E,'diagnostic-1/receipt.json')).result,'DIAGNOSTIC_SUCCESS');
const dir='diagnostic-2';const load=n=>import(pathToFileURL(path.join(pkg,'src',n+'.mjs')).href);
const [{createSupervisor},{createHelperTransportForTesting,helperLaunchSpecification},{orchestrateCli},{validateLaunch,parseCliArgs},{errorExit,operationalError},{DEFINITIONS}]=await Promise.all(['runtime','helper-transport','cli','cli-args','errors','constants'].map(load));
const failed=json(path.join(oldE,'semantics/core/mo1306-qualified/evaluate/receipt.json'));const argv=failed.args.slice(1);argv[argv.indexOf('--output-root')+1]=base.outputRoot;assert.equal(fs.existsSync(base.outputRoot),false);
write(dir+'/campaign.json',{kind:'MO1307InstalledC3RBLocalizingDiagnostic',C3RB:HEAD,argv,inputRoot:base.inputRoot,outputRoot:base.outputRoot,packageRoot:pkg,workingDirectory:failed.cwd,limits:DEFINITIONS.limits,launch:helperLaunchSpecification(),productionOrchestrator:record(path.join(pkg,'src/cli.mjs')),sources:['common.mjs','diagnostic-2.mjs','run-2.py'].map(n=>record(path.join(T,n))),count:1,execution:2,externalProcessSampler:false,questionBinding:record(path.join(E,'second-execution-question.json')),certificationRetry:false,clocksOverridden:false,helperModified:false,workerModified:false,spawnSeam:'Transparent exact forwarding with metadata listeners only; no bytes transformed, no scheduling delays introduced.',supervisorFacade:'Only terminate records original error object and pre-termination snapshot before forwarding unchanged.',contentLogging:false,responseDecodingAddedDuringLiveClocks:false,observationScope:'Installed production orchestrateCli under normal launch validation and original supervisors; not standalone bin invocation.'});
process.chdir(failed.cwd);
// Second run deliberately has no external sampler or sampler handshake.
const requests=[],events=[],buffers=[],terminations=[];let current=null;
const event=(type,detail={})=>events.push({type,at:performance.now(),...detail});
const started=performance.now(),controller=new AbortController();
const cancel=()=>controller.abort();process.once('SIGINT',cancel);process.once('SIGTERM',cancel);
validateLaunch({platform:process.platform,arch:process.arch,version:process.version,execArgv:process.execArgv,environment:process.env});
const launch=parseCliArgs(argv),supervisor=createSupervisor({kind:'cli',signal:controller.signal,started});supervisor.checkpoint('LAUNCH');
const facade=Object.freeze({...supervisor,terminate(error){terminations.push({at:performance.now(),error,before:supervisor.snapshot()});return supervisor.terminate(error);}});
const spec=helperLaunchSpecification();
const transport=createHelperTransportForTesting(supervisor,(exe,args,options)=>{
 assert.equal(exe,spec.executable);assert.deepEqual(args,[...spec.args]);assert.deepEqual(options,{...spec.options,env:{...spec.options.env},stdio:[...spec.options.stdio]});
 const ordinal=current.ordinal,spawnAt=performance.now();const child=spawn(exe,args,options);const row=current;row.spawnAt=spawnAt;row.spawnReturnedAt=performance.now();row.pid=child.pid??null;row.stdoutBytes=0;row.stderrBytes=0;row._chunks=[];
 event('spawn-return',{ordinal,pid:child.pid});
 child.once('spawn',()=>event('spawn',{ordinal,pid:child.pid}));
 for(const [streamName,stream] of [['stdin',child.stdin],['stdout',child.stdout],['stderr',child.stderr]]){
  for(const kind of ['finish','end','close'])stream.once(kind,()=>event('stream-'+kind,{ordinal,stream:streamName}));
  stream.once('error',e=>event('stream-error',{ordinal,stream:streamName,code:e.code??null}));
 }
 child.stdout.on('data',b=>{row.stdoutFirstDataAt??=performance.now();row.stdoutLastDataAt=performance.now();row.stdoutBytes+=b.length;if(row.stdoutBytes<=DEFINITIONS.limits.helperResponseBytes)row._chunks.push(b);else row.observerCaptureOverflow=true;});
 child.stderr.on('data',b=>{row.stderrBytes+=b.length;});
 child.once('error',e=>event('child-error',{ordinal,code:e.code??null}));
 child.once('exit',(code,signal)=>{row.processExitAt=performance.now();row.processExitCode=code;row.processExitSignal=signal;event('process-exit',{ordinal,pid:child.pid,code,signal});});
 child.once('close',(code,signal)=>{row.processCloseAt=performance.now();event('process-close',{ordinal,pid:child.pid,code,signal});queueMicrotask(()=>{row.afterCloseListenersAt=performance.now();});});
 return child;
});
const exchange=async frame=>{
 const row={ordinal:requests.length+1,exchangeEnteredAt:performance.now(),priorHelperUsedMs:supervisor.snapshot().helperUsedMs,cliDeadline:supervisor.deadline,requestBytes:frame.length};requests.push(row);current=row;const capture={row,request:frame,response:null};buffers.push(capture);
 try{const answer=await transport.exchange(frame);row.exchangeResolvedAt=performance.now();row.exchangeDisposition='RESOLVED';row.exitConfirmed=answer.exitConfirmed;row.responseBytes=answer.responseBytes.length;capture.response=answer.responseBytes;return answer;}
 catch(e){row.exchangeRejectedAt=performance.now();row.exchangeDisposition='REJECTED';row.errorObject=e;throw e;}
 finally{row.exchangeSettledAt=performance.now();row.exchangeDurationMs=row.exchangeSettledAt-row.exchangeEnteredAt;}
};
const output=[];const stdout=new Writable({write(b,_encoding,done){output.push(Buffer.from(b));done();}});let result=null,error=null,caughtAt=null;
try{result=await orchestrateCli(launch,{supervisor:facade,exchange,stdout});}
catch(e){caughtAt=performance.now();error=e;}
finally{await supervisor.dispose();process.off('SIGINT',cancel);process.off('SIGTERM',cancel);}
const finished=performance.now(),snapshot=supervisor.snapshot();
// Clocks are no longer live: bounded metadata decoding/hashing and file writes follow.
const errorRecord=e=>e?{name:e.name,code:e.code??null,stage:e.stage??null,reference:e.reference??null,message:e.message,stack:e.stack}:null;
for(const capture of buffers){const {row}=capture,q=JSON.parse(capture.request.subarray(4).toString());Object.assign(row,{sequence:q.sequence,operation:q.operation,rootCount:q.roots.length,fileCount:q.files.length,totalDeclaredFileCap:q.files.reduce((a,f)=>a+f.maxBytes,0),requestSha256:hash(capture.request),sessionSha256:hash(Buffer.from(q.session)),responseArrived:row.stdoutBytes>0,responseAcceptedByTransport:!!capture.response});
 const captured=capture.response??Buffer.concat(row._chunks??[]);delete row._chunks;
 row.responseComplete=!row.observerCaptureOverflow&&captured.length>=4&&captured.readUInt32BE(0)+4===captured.length;
 row.responseSha256=captured.length?hash(captured):null;
 row.responseCapturedBytes=captured.length;
 if(row.responseComplete){try{const response=JSON.parse(captured.subarray(4).toString());row.responseJsonParsed=true;row.responseStatus=['OK','ABSENT','FINAL_ABSENT','ERROR'].includes(response.status)?response.status:'UNRECOGNIZED';row.responseCode=response.code===null?null:['MO1307_INPUT','MO1307_FILESYSTEM_BOUNDARY','MO1307_RESOURCE_LIMIT','MO1307_INTERNAL'].includes(response.code)?response.code:'UNRECOGNIZED';row.responseFileCount=Array.isArray(response.files)?response.files.length:null;row.responseRootCount=Array.isArray(response.roots)?response.roots.length:null;row.responseBindingMatches=response.sequence===q.sequence&&response.operation===q.operation&&response.session===q.session;}catch{row.responseJsonParsed=false;}}
 row.error=errorRecord(row.errorObject);delete row.errorObject;row.streamClosures=['stdin','stdout','stderr'].map(stream=>({stream,event:events.find(e=>e.ordinal===row.ordinal&&e.stream===stream&&e.type==='stream-close')??null}));row.transportClosed=row.processCloseAt!=null&&row.streamClosures.every(x=>x.event);row.nativeProcessDurationMs=row.processExitAt!=null?row.processExitAt-row.spawnAt:null;
}
const expectation=read('repositories/cca-conformance/fixtures/mo1307/bundles/mo1306-qualified/expected-result.json');let publication=null;const final=path.join(base.outputRoot,'memoryos-readiness-result.json');if(fs.existsSync(final)){const bytes=fs.readFileSync(final);publication={byteLength:bytes.length,sha256:hash(bytes),equalsExpected:bytes.equals(expectation)};}
const after=walk(pkg);assert.deepEqual(after,before);const productExit=error?errorExit(operationalError(error,'ACQUISITION')):result.exitCode;
const receipt={kind:'MO1307InstalledC3RBLocalizingDiagnosticReceipt',C3RB:HEAD,diagnosticOnly:true,certification:false,execution:2,startedAt:new Date(performance.timeOrigin+started).toISOString(),timeOrigin:performance.timeOrigin,started,caughtAt,finished,elapsedMs:finished-started,result:error?'DIAGNOSTIC_FAILURE':'DIAGNOSTIC_SUCCESS',productExit,outcome:result,error:errorRecord(error),originalErrorPreserved:true,requests,terminations:terminations.map(t=>({...t,error:errorRecord(t.error)})),supervisor:snapshot,events,stdout:{byteLength:Buffer.concat(output).length,sha256:hash(Buffer.concat(output))},publication,outputRootExists:fs.existsSync(base.outputRoot),installedUnchanged:true,limits:DEFINITIONS.limits,contentLogging:false,originalBlockerRestamped:false};
write(dir+'/receipt.json',receipt);console.log(JSON.stringify({diagnosticOnly:true,result:receipt.result,productExit,elapsedMs:receipt.elapsedMs,requests:requests.map(q=>({sequence:q.sequence,operation:q.operation,exchangeMs:q.exchangeDurationMs,result:q.exchangeDisposition,stdoutBytes:q.stdoutBytes})),error:receipt.error,cleanupConfirmed:snapshot.cleanupConfirmed}));process.exitCode=productExit;
