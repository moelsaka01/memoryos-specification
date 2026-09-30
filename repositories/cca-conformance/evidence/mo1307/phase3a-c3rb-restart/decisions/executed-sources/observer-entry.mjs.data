// Measurement adapters execute the exact installed bin. No production source is transformed.
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import childProcess from 'node:child_process';import {registerHooks,syncBuiltinESMExports} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const bootstrapArgv=[...process.argv],bootstrapStarted=performance.now();
const trace=process.argv[2],bin=process.argv[3],args=process.argv.slice(4);
assert.ok(path.isAbsolute(trace)&&path.isAbsolute(bin));assert.equal(process.execArgv.length,0);
let observerReady=null;if(args[0]==='--observer-ready'){observerReady=args.splice(0,2)[1];assert.ok(path.isAbsolute(observerReady));}
const pkg=path.resolve(path.dirname(bin),'..');const url=n=>pathToFileURL(path.join(pkg,'src',n+'.mjs')).href;
const state={urls:{runtime:url('runtime'),transport:url('helper-transport'),errors:url('errors')},requests:[],supervisors:[],errors:[],events:[],hookMatches:[]};
globalThis[Symbol.for('mo1307.final.observer')]=state;
const allowed=[{parent:url('cli'),specifier:'./runtime.mjs',adapter:'runtime-observer.mjs'},{parent:url('cli'),specifier:'./helper-transport.mjs',adapter:'transport-observer.mjs'},{parent:pathToFileURL(bin).href,specifier:'../src/errors.mjs',adapter:'errors-observer.mjs'}];
const hooks=registerHooks({resolve(specifier,context,next){const item=allowed.find(x=>x.parent===context.parentURL&&x.specifier===specifier);if(item){state.hookMatches.push({parent:context.parentURL,specifier,adapter:item.adapter});return {url:new URL(item.adapter,import.meta.url).href,shortCircuit:true};}return next(specifier,context);}});
const originalSpawn=childProcess.spawn;
childProcess.spawn=function(...forward){const row=state.requests.at(-1);const at=performance.now();const child=Reflect.apply(originalSpawn,childProcess,forward);if(!row){state.events.push({type:'unexpected-child',at,pid:child.pid});return child;}Object.assign(row,{spawnAt:at,pid:child.pid,launch:{executable:forward[0],args:forward[1],options:forward[2]},stdoutBytes:0,stderrBytes:0,chunks:[]});const event=(type,detail={})=>state.events.push({ordinal:row.ordinal,type,at:performance.now(),...detail});
for(const [name,stream] of [['stdin',child.stdin],['stdout',child.stdout],['stderr',child.stderr]]){for(const kind of ['finish','end','close'])stream.once(kind,()=>event('stream-'+kind,{stream:name}));stream.once('error',error=>event('stream-error',{stream:name,code:error.code??null}));}
child.stdout.on('data',bytes=>{row.stdoutFirstAt??=performance.now();row.stdoutBytes+=bytes.length;if(row.stdoutBytes<=state.responseLimit)row.chunks.push(bytes);else row.captureOverflow=true;});child.stderr.on('data',bytes=>{row.stderrBytes+=bytes.length;});
child.once('exit',(code,signal)=>{row.exitAt=performance.now();row.exitCode=code;row.exitSignal=signal;event('process-exit',{pid:child.pid,code,signal});});child.once('close',(code,signal)=>{row.closeAt=performance.now();event('process-close',{pid:child.pid,code,signal});});child.once('error',error=>event('process-error',{code:error.code??null}));return child;};
syncBuiltinESMExports();
const {DEFINITIONS}=await import(url('constants'));state.responseLimit=DEFINITIONS.limits.helperResponseBytes;
// This is a disclosed entry adaptation, never removal of Node flags or environment keys.
process.argv=[process.execPath,bin,...args];
if(observerReady){const waitStarted=performance.now();while(!fs.existsSync(observerReady)){assert.ok(performance.now()-waitStarted<15000,'Observer ready timeout');await new Promise(resolve=>setTimeout(resolve,10));}}
let clockBridge=null;if(observerReady){
const readyClock=JSON.parse(fs.readFileSync(observerReady,'utf8')),performanceSeenAt=performance.now();
const bridgeRequest={readyQpc:readyClock.qpc,qpcFrequency:readyClock.qpcFrequency,performanceSeenAt,performanceBeforeWriteAt:performance.now()};
fs.writeFileSync(observerReady+'.clock-bridge.pending',JSON.stringify(bridgeRequest)+'\n',{flag:'wx'});fs.renameSync(observerReady+'.clock-bridge.pending',observerReady+'.clock-bridge.json');
const bridgeWaitStarted=performance.now();while(!fs.existsSync(observerReady+'.clock-bridge-accepted.json')){assert.ok(performance.now()-bridgeWaitStarted<15000,'Clock bridge acknowledgment bound');await new Promise(r=>setTimeout(r,10));}
clockBridge=JSON.parse(fs.readFileSync(observerReady+'.clock-bridge-accepted.json','utf8'));
assert.equal(clockBridge.qpcFrequency,readyClock.qpcFrequency);assert.ok(clockBridge.qpcAcknowledged>=readyClock.qpc);assert.ok(bridgeRequest.performanceBeforeWriteAt>=performanceSeenAt);assert.ok(clockBridge.offsetLowerMs<=clockBridge.offsetUpperMs);
}
const binImportedAt=performance.now();let bootstrapError=null;
try{await import(pathToFileURL(bin).href);}catch(error){bootstrapError=error;}
const binSettledAt=performance.now(),productExit=process.exitCode??0;
childProcess.spawn=originalSpawn;syncBuiltinESMExports();hooks.deregister();
const errorRecord=error=>error?{name:error.name,code:error.code??null,stage:error.stage??null,reference:error.reference??null,message:error.message,stack:error.stack}:null;
const sha=bytes=>'sha256:'+createHash('sha256').update(bytes).digest('hex');
for(const row of state.requests){const request=JSON.parse(row.request.subarray(4));Object.assign(row,{sequence:request.sequence,operation:request.operation,fileCount:request.files.length,rootCount:request.roots.length,requestSha256:sha(row.request),startTime:new Date(performance.timeOrigin+row.enteredAt).toISOString(),terminalTime:new Date(performance.timeOrigin+row.terminalAt).toISOString()});const response=row.response??Buffer.concat(row.chunks??[]);row.responseAcceptedByTransport=row.response!==null;row.responseArrived=row.stdoutBytes>0;row.responseComplete=!row.captureOverflow&&response.length>=4&&response.readUInt32BE(0)+4===response.length;row.responseSha256=response.length?sha(response):null;if(row.responseComplete){try{const parsed=JSON.parse(response.subarray(4));row.responseStatus=parsed.status;row.responseCode=parsed.code;row.responseBindingMatches=parsed.sequence===request.sequence&&parsed.operation===request.operation&&parsed.session===request.session;}catch{row.responseJsonInvalid=true;}}row.error=errorRecord(row.error);row.transportClosed=row.closeAt!==undefined&&['stdin','stdout','stderr'].every(name=>state.events.some(e=>e.ordinal===row.ordinal&&e.stream===name&&e.type==='stream-close'));delete row.request;delete row.response;delete row.chunks;}
const supervisors=state.supervisors.map(s=>({started:s.started,createdAt:s.createdAt,kind:s.kind,snapshot:s.supervisor.snapshot()}));
const receipt={kind:'MO1307FinalCertificationInstalledBinObservation',method:'Unmodified installed bin imported by engineering bootstrap; resolve-only observation adapters; original supervisor object, transport, helper, worker and clocks.',standaloneNodeBinLaunch:false,actualInstalledBinExecuted:true,bootstrapArgv,effectiveProductArgv:[process.execPath,bin,...args],execArgv:[...process.execArgv],environmentKeys:Object.keys(process.env).sort(),bin,pid:process.pid,timeOrigin:performance.timeOrigin,clockBridge,bootstrapStarted,binImportedAt,binSettledAt,bootstrapElapsedMs:binSettledAt-bootstrapStarted,binImportElapsedMs:binSettledAt-binImportedAt,productLifecycleElapsedMs:supervisors.length?binSettledAt-supervisors[0].started:null,productExit,bootstrapError:errorRecord(bootstrapError),requests:state.requests,supervisors,errors:state.errors.map(e=>({...e,error:errorRecord(e.error)})),events:state.events,hookMatches:state.hookMatches,limits:DEFINITIONS.limits,maxRssKiB:process.resourceUsage().maxRSS,contentsLogged:false};
fs.writeFileSync(trace,JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});
if(bootstrapError)process.exitCode=70;
