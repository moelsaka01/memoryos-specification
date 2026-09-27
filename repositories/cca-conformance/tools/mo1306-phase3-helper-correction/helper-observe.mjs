/** Controlled close-delivery scheduling pause on a real helper result; installed bytes and timer arguments unchanged. */
import fs from 'node:fs';import path from 'node:path';import cp from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';import {pathToFileURL} from 'node:url';import {performance} from 'node:perf_hooks';import {createHash} from 'node:crypto';
const [packageRoot,nodePath,fixture,mode,workspace]=process.argv.slice(2);
const events=[],timers=new Map();let timerSeq=0,activeChild=null;
const now=()=>performance.now();const sha=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const log=(event,details={})=>{events.push({event,atMs:now(),...details});};
const originals={spawn:cp.spawn,setTimeout:globalThis.setTimeout,clearTimeout:globalThis.clearTimeout};
cp.spawn=function(...args){
 log('spawnBefore',{executable:args[0],args:args[1],options:args[2]});
 const child=Reflect.apply(originals.spawn,this,args);activeChild=child;log('spawnReturn',{pid:child.pid??null});
 const emit=child.emit,kill=child.kill,end=child.stdin.end,outEmit=child.stdout.emit,errEmit=child.stderr.emit;
 child.emit=function(event,...rest){if(['spawn','exit','close','error'].includes(event))log('childEventBefore',{name:event,pid:child.pid,args:rest.map(x=>x instanceof Error?{name:x.name,code:x.code,message:x.message}:x)});if(event==='close' && ['late','failure-late','core-late'].includes(mode)){
 const arm=events.find(e=>e.event==='timerArmed');const until=arm.dueUpperMs+50;
 log('boundaryActualCloseArrived',{actualArgs:rest,dueUpperMs:arm.dueUpperMs,plannedResumeNotBeforeMs:until});
 const pauseBegin=now();log('boundaryPauseBegin',{plannedResumeNotBeforeMs:until});
 const waitWord=new Int32Array(new SharedArrayBuffer(4));
 while(now()<until)Atomics.wait(waitWord,0,0,until-now());
 log('boundaryPauseEnd',{imposedPauseMs:now()-pauseBegin});
 log('boundaryCloseForwardedToProduct',{actualArgs:rest});
 }
 const value=Reflect.apply(emit,this,[event,...rest]);if(['exit','close'].includes(event))log('childEventAfter',{name:event});return value;};
 child.kill=function(...rest){log('killBefore',{args:rest});const value=Reflect.apply(kill,this,rest);log('killReturn',{returned:value});return value;};
 child.stdin.end=function(...rest){const raw=Buffer.isBuffer(rest[0])?rest[0]:Buffer.from(rest[0]??'');log('stdinEnd',{byteLength:raw.length,sha256:sha(raw),request:JSON.parse(raw)});if(mode==='timeout')return this;return Reflect.apply(end,this,rest);};
 child.stdout.emit=function(event,...rest){if(event==='data')log('stdoutData',{byteLength:rest[0].length,text:rest[0].toString('utf8')});if(event==='data' && mode==='timer-first-delay'){const arm=events.find(e=>e.event==='timerArmed'),until=arm.dueUpperMs+60,word=new Int32Array(new SharedArrayBuffer(4));log('eventLoopPauseBegin');while(now()<until)Atomics.wait(word,0,0,until-now());log('eventLoopPauseEnd');}return Reflect.apply(outEmit,this,[event,...rest]);};
 child.stderr.emit=function(event,...rest){if(event==='data')log('stderrData',{byteLength:rest[0].length,text:rest[0].toString('utf8')});return Reflect.apply(errEmit,this,[event,...rest]);};
 return child;
};
globalThis.setTimeout=function(callback,delay,...args){const id=++timerSeq,before=now();const wrapped=function(...callbackArgs){log('timerFire',{id,requestedDelayMs:delay});return Reflect.apply(callback,this,callbackArgs);};const handle=Reflect.apply(originals.setTimeout,this,[wrapped,delay,...args]);const after=now();timers.set(handle,id);log('timerArmed',{id,requestedDelayMs:delay,registrationBeforeMs:before,registrationAfterMs:after,dueLowerMs:before+Number(delay),dueUpperMs:after+Number(delay),callbackSource:callback.toString()});return handle;};
globalThis.clearTimeout=function(handle){log('timerClear',{id:timers.get(handle)??null});return Reflect.apply(originals.clearTimeout,this,[handle]);};
syncBuiltinESMExports();
const {checkPaths}=await import(pathToFileURL(path.join(packageRoot,'src/filesystem.mjs')));
const manifest=JSON.parse(fs.readFileSync(path.join(packageRoot,'distribution-manifest.json')));
const exactFirstChunk=[{path:nodePath,allowMissingLeaf:false},{path:packageRoot,allowMissingLeaf:false},...manifest.files.map(row=>({path:path.join(packageRoot,row.path),allowMissingLeaf:false}))].slice(0,48);
const paths=mode==='original-single-config'?[{path:fixture,allowMissingLeaf:false}]:mode==='failure-late'?[{path:path.join(workspace,'missing'),allowMissingLeaf:false}]:exactFirstChunk;
const deadline=now()+(mode==='remaining-overall-100ms'?100:10000);
const controller=new AbortController();if(mode==='cancel')originals.setTimeout(()=>{log('abortRequested');controller.abort();},50);
let result;const initialNames=fs.readdirSync(workspace).sort();
log('checkPathsBefore',{mode,deadlineMs:deadline,pathCount:paths.length});
try{if(mode==='core-late'){const {run}=await import(pathToFileURL(path.join(packageRoot,'src/core.mjs')));const value=await run({workspace,config:fixture});log('coreResult',{summary:value.summary,error:value.error?{code:value.error.code,stage:value.error.stage}:null});if(value.error)throw value.error;throw Error('Unexpected core success');}else await checkPaths(paths,{deadline,signal:controller.signal});log('checkPathsResolved');result={accepted:true,code:null};}catch(error){log('checkPathsRejected',{code:error.code??null,name:error.name});result={accepted:false,code:error.code??null};}
const terminalEvent=events.at(-1);
await new Promise(resolve=>originals.setTimeout(resolve,300));
const settledNames=fs.readdirSync(workspace).sort();
log('settleComplete',{settleMs:300,workspaceNames: settledNames});
cp.spawn=originals.spawn;globalThis.setTimeout=originals.setTimeout;globalThis.clearTimeout=originals.clearTimeout;syncBuiltinESMExports();
const armed=events.find(e=>e.event==='timerArmed');const close=events.find(e=>e.event==='childEventBefore'&&e.name==='close');
const lateAccepted=result.accepted&&terminalEvent.atMs>armed.dueUpperMs;
const report={kind:'MemoryOSPhase3ARResolutionHelperObservation',version:'1.0.0',mode,clock:{enforcement:'Node performance.now and native setTimeout monotonic scheduling',observation:'Node performance.now milliseconds; values only comparable within this process',timeOriginOperationalOnly:performance.timeOrigin},paths,events,result,lateAccepted,terminalAtMs:terminalEvent.atMs,deadlineWindow:armed?{lowerMs:armed.dueLowerMs,upperMs:armed.dueUpperMs}:null,actualRequestedDelayMs:armed?.requestedDelayMs??null,closeAfterDue:close?close.atMs>armed.dueUpperMs:null,filesystem:{workspace,initialNames,settledNames,unchanged:JSON.stringify(initialNames)===JSON.stringify(settledNames),completeMarkerPresent:fs.existsSync(path.join(workspace,'memoryos-ci-complete.json'))},scope:'Exact installed checkPaths with explicit engineering pause immediately before delivering the actual helper close event. No fabricated stdout/exit/result; original helper may have physically exited before deadline. Tests late supervisor acceptance ordering, not helper kernel-runtime overrun. Timer values and production callback code unchanged.'};
process.stdout.write(JSON.stringify(report)+'\n');
if(lateAccepted)process.exitCode=2;
