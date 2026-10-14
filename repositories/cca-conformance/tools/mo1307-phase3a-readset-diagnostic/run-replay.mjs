// Engineering-only direct helper replay; no production CLI/API or certification execution.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../../',import.meta.url)),E=path.join(root,'repositories/cca-conformance/evidence/mo1307/phase3a-readset-diagnostic');
const args=process.argv.slice(2),opt={};assert.equal(args.length,10);for(let i=0;i<args.length;i+=2){assert.ok(['--case','--request','--helper','--telemetry','--delta'].includes(args[i]));assert.equal(opt[args[i]],undefined);opt[args[i]]=args[i+1];}
const name=opt['--case'];assert.ok(['mo1306-primary','ready-comparison','additional-observation','harness-recovery'].includes(name));
const out=path.join(E,name);assert.equal(fs.existsSync(out),false);fs.mkdirSync(out);
const sha=b=>'sha256:'+createHash('sha256').update(b).digest('hex'),rec=p=>{const b=fs.readFileSync(p);return {path:path.relative(root,p).replaceAll('\\','/'),byteLength:b.length,sha256:sha(b)};};
const write=(n,v)=>fs.writeFileSync(path.join(out,n),JSON.stringify(v,null,2)+'\n',{flag:'wx'});
const baseline=JSON.parse(fs.readFileSync(path.join(E,'baseline.json'))),candidate=baseline.candidate;
const actualPath=p=>path.resolve(root,p);const reqPath=actualPath(opt['--request']),helper=actualPath(opt['--helper']),telemetry=actualPath(opt['--telemetry']),delta=actualPath(opt['--delta']);
assert.ok(helper.startsWith(path.join(root,'repositories/cca-conformance/tools/mo1307-phase3a-readset-diagnostic')+path.sep));assert.ok(telemetry.startsWith(E+path.sep));
assert.equal(fs.existsSync(telemetry),false);
assert.equal(process.version,'v24.21.0');assert.equal(sha(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
for(const m of baseline.preserved){const b=fs.readFileSync(path.join(root,m.path));assert.equal(b.length,m.byteLength);assert.equal(sha(b),m.sha256);}
for(const m of baseline.productionMembers){const b=fs.readFileSync(path.join(root,'repositories/memoryos-readiness',m.path));assert.equal(b.length,m.byteLength);assert.equal(sha(b),m.sha256);}
const frame=fs.readFileSync(reqPath);assert.equal(frame.readUInt32BE(0)+4,frame.length);const req=JSON.parse(frame.subarray(4));
assert.equal(req.operation,'READ_SET');assert.equal(req.sequence,3);
const roots=new Map(req.roots.map(x=>[x.id,x.path])),files=req.files.map((x,i)=>{const p=path.join(roots.get(x.root),...x.path.split('/')),r=rec(p);return {ordinal:i+1,id:x.id,...r};});
const existing=['mo1306-primary','ready-comparison','additional-observation','harness-recovery'].filter(x=>fs.existsSync(path.join(E,x,'receipt.json'))).length;assert.ok(existing<3);
const ps='C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',argv=['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',helper],env={SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'},cwd=candidate.packageRoot;
write('campaign.json',{kind:'MO1307ReadSetEngineeringReplayCampaign',case:name,newExecutionOrdinal:existing+1,maximumNewExecutions:3,createdAt:new Date().toISOString(),B2:baseline.head,candidateArchive:candidate.archive,previousBlocker:baseline.previousBlocker,request:rec(reqPath),requestDataUnchanged:true,engineeringHelper:rec(helper),instrumentationDelta:rec(delta),harness:rec(fileURLToPath(import.meta.url)),launch:{executable:ps,args:argv,cwd,env,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']},inputs:files,fileCount:files.length,byteCount:files.reduce((s,x)=>s+x.byteLength,0),guardMs:20000,guardScope:'Engineering helper observation, not product deadline; forced termination if still active. At most2000ms additional bounded transport/termination cleanup.',frozenProductLimits:{helper:5000,aggregateHelper:20000,cliAdmission:30000},certificationExecution:false,productionCorrection:false,thirdExecutionAuthority:'Only recovery of a defective second observation, not retries for passing outcomes.'});
const events=[],stdout=[],stderr=[];let outBytes=0,errBytes=0,limitFailure=null,exit=null,signal=null,processError=null,guardTriggered=false,cleanupExpired=false,closed=false;
const started=performance.now(),origin=performance.timeOrigin;
const event=(type,fields={})=>events.push({type,elapsedMs:performance.now()-started,nodeMonotonicMs:performance.now(),epochMs:origin+performance.now(),...fields});
event('spawn_call');
const child=spawn(ps,argv,{cwd,env,windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});
event('spawn_return',{pid:child.pid??null});
const stop=()=>{if(!closed){child.stdin.destroy();child.stdout.destroy();child.stderr.destroy();try{child.kill();event('kill_requested',{pid:child.pid});}catch(e){event('kill_error',{code:e.code??null});}}};
let resolveClose;const closePromise=new Promise(r=>resolveClose=r);
child.once('spawn',()=>event('spawn_event',{pid:child.pid}));
child.once('error',e=>{processError={code:e.code??null,message:e.message};event('process_error',processError)});
child.stdout.on('data',b=>{outBytes+=b.length;if(outBytes>16777216){limitFailure='stdout_limit';stop();return;}stdout.push(Buffer.from(b));event('stdout_data',{chunkBytes:b.length,totalBytes:outBytes});});
child.stderr.on('data',b=>{errBytes+=b.length;if(errBytes>65536){limitFailure='stderr_limit';stop();return;}stderr.push(Buffer.from(b));event('stderr_data',{chunkBytes:b.length,totalBytes:errBytes});});
for(const [n,s] of [['stdin',child.stdin],['stdout',child.stdout],['stderr',child.stderr]]){for(const type of ['finish','end','close'])s.once(type,()=>event(n+'_'+type));s.on('error',e=>event(n+'_error',{code:e.code??null}));}
child.once('exit',(c,s)=>{exit=c;signal=s;event('process_exit',{code:c,signal:s})});
child.once('close',(c,s)=>{closed=true;exit=c;signal=s;event('process_close',{code:c,signal:s});resolveClose()});
const guard=setTimeout(()=>{guardTriggered=true;event('engineering_guard_expired',{guardMs:20000});stop();},Math.max(1,20000-(performance.now()-started)));
const absoluteStop=new Promise(resolve=>setTimeout(()=>{if(!closed){cleanupExpired=true;stop();child.unref();event('engineering_cleanup_guard_expired');}resolve();},22000));
child.stdin.end(frame);event('stdin_end_called',{frameBytes:frame.length});
await Promise.race([closePromise,absoluteStop]);clearTimeout(guard);
const elapsedMs=performance.now()-started,reply=Buffer.concat(stdout),err=Buffer.concat(stderr);
write('transport-metadata.json',{stdout:{byteLength:reply.length,sha256:sha(reply)},stderr:{byteLength:err.length,sha256:sha(err)},payloadRetention:'No stdout or stderr contents retained; response verified in memory only.'});
write('lifecycle.json',{nodeTimeOrigin:origin,events,elapsedMs,parentObservedTimes:true,guardTriggered,cleanupExpired,processClosed:closed,helperPid:child.pid??null,consoleObservation:'Read existing native held-handle quiescence telemetry in engineering helper; no high-overhead system sampler.'});
let wire=null,validationError=null;
try{assert.equal(exit,0);assert.equal(signal,null);assert.equal(reply.readUInt32BE(0)+4,reply.length);const response=JSON.parse(reply.subarray(4));assert.equal(response.status,'OK');assert.equal(response.code,null);assert.equal(response.sequence,req.sequence);assert.equal(response.session,req.session);assert.equal(response.operation,req.operation);assert.equal(response.files.length,files.length);for(let i=0;i<files.length;i++){const f=response.files[i],expected=files[i];assert.equal(f.id,expected.id);const bytes=Buffer.from(f.bytes.join(''),'base64');assert.equal(bytes.length,expected.byteLength);assert.equal(sha(bytes),expected.sha256);assert.equal(f.identity.byteLength,expected.byteLength);}wire={result:'PASS',status:response.status,files:response.files.length,exactInputPayloadHashes:true,frameBytes:reply.length};}
catch(e){validationError={name:e.name,message:e.message};}
let telemetryState=null;try{const b=fs.readFileSync(telemetry);const lines=b.toString('utf8').trim().split(/\r?\n/).filter(Boolean).map(x=>JSON.parse(x));telemetryState={binding:rec(telemetry),records:lines.length,kinds:[...new Set(lines.map(x=>x.type??x.kind))]};}catch(e){telemetryState={error:e.message};}
for(const m of baseline.productionMembers){const b=fs.readFileSync(path.join(root,'repositories/memoryos-readiness',m.path));assert.equal(sha(b),m.sha256);}
for(const m of baseline.preserved){const b=fs.readFileSync(path.join(root,m.path));assert.equal(sha(b),m.sha256);}
for(const m of files){const b=fs.readFileSync(path.join(root,m.path));assert.equal(sha(b),m.sha256);}
write('receipt.json',{kind:'MO1307ReadSetEngineeringReplayReceipt',case:name,newExecutionOrdinal:existing+1,result:wire&&!guardTriggered&&!cleanupExpired?'ALGORITHM_COMPLETED':'ENGINEERING_OBSERVATION_INCOMPLETE',exit,signal,processError,limitFailure,guardTriggered,cleanupExpired,processClosed:closed,elapsedMs,wire,validationError,telemetry:telemetryState,request:rec(reqPath),helper:rec(helper),delta:rec(delta),transport:rec(path.join(out,'transport-metadata.json')),lifecycle:rec(path.join(out,'lifecycle.json')),productionMembersUnchanged:89,previousBlockerFilesUnchanged:baseline.preserved.length,inputFilesUnchanged:files.length,certificationClaim:false,productBudgetChanged:false,rootCause:'ANALYSIS_PENDING'});
console.log(JSON.stringify({case:name,result:wire?'ALGORITHM_COMPLETED':'INCOMPLETE',elapsedMs,exit,guardTriggered,frameBytes:reply.length,telemetry:telemetryState}));process.exit(wire&&!guardTriggered?0:1);
