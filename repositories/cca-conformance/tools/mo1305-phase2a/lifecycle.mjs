/** Focused Windows TCP/TLS/HTTP lifecycle acceptance; no resource characterization. */
import assert from 'node:assert/strict';
import net from 'node:net';
import {spawn} from 'node:child_process';
import {readFileSync,writeFileSync,openSync,closeSync} from 'node:fs';
import {resolve} from 'node:path';
import {setup,root,cache,launch,connect,request,wire,response,until,delay,bounded,clock,vectors,limits} from './harness.mjs';
import {J,sha256,cleanEnvironment} from './setup.mjs';
const stage=await setup(),records=[],started=clock.mono();
const resultPath=resolve(cache,'lifecycle-results.json');
const resumePath=process.argv[2];
const priorBytes=resumePath?readFileSync(resolve(root,resumePath)):null;
const prior=priorBytes?JSON.parse(priorBytes):null,retainedIds=[];
if(prior){assert.equal(prior.staging.distributionManifestSha256,stage.manifestSha256);assert.equal(prior.baseline,'b6c397b99e1f8bfcd04be972f35069f8737a4137');}
let active=null,summaries=[];
const elapsed=start=>Number((clock.mono()-start+999999n)/1000000n);
const states=s=>s.lifecycle.map(x=>x.state);
function persist(state){writeFileSync(resultPath,J({kind:'MemoryOSRESTPhase2ALifecycleResults',version:'1.0.0',state,baseline:'b6c397b99e1f8bfcd04be972f35069f8737a4137',staging:JSON.parse(readFileSync(resolve(stage.directory,'staging.json'))),elapsedMs:elapsed(started)+(prior?.elapsedMs??0),records,...(prior?{reuse:{priorReceipt:{path:resumePath.replaceAll('\\','/'),byteLength:priorBytes.length,sha256:sha256(priorBytes)},retainedIds,reason:'Completed assertions retained from identical product source; only changed or previously incomplete assertions execute, with every prior receipt retained'}}:{})}));}
function checkResources(s,{clean=true}={}){
 for(const row of s.states){
  for(const [key,bound] of [['connections',32],['requestSlots',4],['writeSlots',4],['workers',1],['semanticOwners',1]])assert.ok(row[key]<=bound,key+' exceeded frozen bound');
  for(const [key,bound] of [['heapTotal',limits.measured.parentHeapMiB],['external',limits.measured.parentExternalMiB],['rss',limits.measured.processRssMiB]])assert.ok(row.memory[key]<=bound*1048576,key+' exceeded frozen budget');
 }
 for(const row of s.observations){for(const [key,bound] of [['youngBytes',limits.measured.workerYoungMiB],['oldBytes',limits.measured.workerOldMiB],['externalBytes',limits.measured.workerExternalMiB]])if(row[key]!==undefined)assert.ok(row[key]<=bound*1048576,key+' exceeded frozen budget');}
 if(clean&&s.states.length){const final=s.states.at(-1);for(const key of ['connections','requestSlots','writeSlots','workers','semanticOwners'])assert.equal(final[key],0,key+' leaked');}
 assert.equal(s.stdout,'');assert.ok(!s.stderr.includes(stage.token));
 const countKeys=['connections','requestSlots','writeSlots','workers','semanticOwners'];
 summaries.push({pid:s.child.pid,states:states(s),exitCode:s.exited?.code??s.child.exitCode,
  sampledStateCount:s.states.length,peakCounts:Object.fromEntries(countKeys.map(k=>[k,Math.max(0,...s.states.map(r=>r[k]))])),
  finalCounts:s.states.length?Object.fromEntries(countKeys.map(k=>[k,s.states.at(-1)[k]])):null,
  peakSampledBytes:Object.fromEntries(['heapTotal','external','rss'].map(k=>[k,Math.max(0,...s.states.map(r=>r.memory[k]))])),
  workerCreated:s.messages.filter(x=>x.type==='worker'&&x.record.state==='created').length,workerReaped:s.messages.filter(x=>x.type==='worker'&&x.record.state==='reaped').length,
  sampledBudgetChecks:true,gracefulCleanupChecked:clean});
}
async function run(id,expected,fn){const retained=prior?.records.find(r=>r.id===id&&r.state==='PASS'&&r.expected===expected);if(retained){records.push(retained);retainedIds.push(id);persist('RUNNING');return;}const start=clock.mono();summaries=[];try{const actual=await fn();records.push({id,state:'PASS',expected,actual:{...actual,sessions:summaries},elapsedMs:elapsed(start)});persist('RUNNING');console.log(JSON.stringify(records.at(-1)));}catch(error){records.push({id,state:'FAIL',expected,actual:{failure:error.code??error.name},elapsedMs:elapsed(start)});persist('FAIL');throw error;}}
async function group(options,fn,{expectedCode=0,clean=true}={}){
 const state=active=await launch(stage,options);
 try{const result=await fn(state);await state.stop({expectedCode});checkResources(state,{clean});return result;}
 finally{if(!state.exited){state.child.stdin.end();await bounded(state.exit,17000,'CLEANUP_TIMEOUT',{onTimeout:()=>state.child.kill()});}active=null;}
}
async function noListener(host=stage.host){const c=connect(stage,{host,raw:true});await bounded(c.done,2000,'LISTENER_REMAINED',{onTimeout:()=>c.socket.destroy()});assert.equal(c.connected,false);}
async function rebound(mode='local'){return group({mode},async()=>{assert.equal(response(await wire(stage,request(stage,'getHealth'))).status,200);return {rebound:true};});}
try{
await run('startup-ready-idle-shutdown','INITIALIZING READY DRAINING STOPPED; clean exit and immediate rebind',async()=>{
 const s=active=await launch(stage);assert.deepEqual(states(s),['INITIALIZING','READY']);assert.deepEqual(response(await wire(stage,request(stage,'getReadiness'))).body,{status:'ok',ready:true});
 await s.stop();checkResources(s);assert.deepEqual(states(s),['INITIALIZING','READY','DRAINING','STOPPED']);active=null;await noListener();await rebound();return {states:states(s),exitCode:0};
});
for(const control of ['eof','invalid'])await run('product-control-'+control,'real product entry handles supervisor pipe; exit '+(control==='eof'?0:1),async()=>group({observe:false},async s=>{
 assert.equal(response(await wire(stage,request(stage,'getHealth'))).status,200);
 if(control==='invalid')s.child.stdin.write('invalid control\n');else s.child.stdin.end();
 const result=await bounded(s.exit,17000,'CONTROL_SHUTDOWN_TIMEOUT');assert.equal(result.code,control==='eof'?0:1);return {exitCode:result.code};
},{expectedCode:control==='eof'?0:1}));
await run('product-nonpipe-invalid-control','nonempty regular stdin is invalid control input and exits1',async()=>{
 const file=resolve(stage.directory,'invalid-control.txt');writeFileSync(file,'invalid control\n');const fd=openSync(file,'r');
 const child=spawn(stage.node,[resolve(stage.packageRoot,'bin/memoryos-rest.mjs'),'--config',stage.configPath],{cwd:resolve(stage.directory,'empty'),windowsHide:true,env:cleanEnvironment(),stdio:[fd,'pipe','pipe']});closeSync(fd);
 let stdout='',stderr='';child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 const code=await bounded(new Promise(done=>child.once('close',done)),17000,'REGULAR_INPUT_SHUTDOWN',{onTimeout:()=>child.kill()});
 assert.equal(code,1);assert.equal(stdout,'');assert.ok(stderr.includes('"event":"shutdown"'));assert.ok(!stderr.includes(stage.token));await noListener();return {input:'regularFile',exitCode:1,listenerClosed:true};
});
for(const control of ['eof','invalid'])await run('product-early-control-'+control,'early supervisor control is retained until delivery and completes bounded shutdown',async()=>{
 const s=active=await launch(stage,{observe:false,expectedStartup:false});if(control==='invalid')s.child.stdin.write('invalid control\n');s.child.stdin.end();
 await s.stop({expectedCode:control==='eof'?0:1});assert.ok(s.stderr.includes('"event":"shutdown"'));await noListener();active=null;return {exitCode:s.exited.code,startupObserved:s.stderr.includes('"event":"startup"'),listenerClosed:true};
});
await run('startup-already-aborted','observed shutdown before listen transitions INITIALIZING DRAINING STOPPED without readiness',async()=>{
 const s=active=await launch(stage,{fault:'startup-aborted',expectedStartup:false});await bounded(s.exit,15000,'ABORTED_START_TIMEOUT');await s.stop();assert.deepEqual(states(s),['INITIALIZING','DRAINING','STOPPED']);assert.ok(!s.stderr.includes('"event":"startup"'));checkResources(s);active=null;await noListener();return {states:states(s),listenerStarted:false};
});
await run('startup-listener-conflict','occupied port fails startup exit2 without a watchdog or listener leak',async()=>{
 const holder=net.createServer();await new Promise((done,fail)=>{holder.once('error',fail);holder.listen({host:'127.0.0.1',port:stage.port,exclusive:true},done);});
 try{const s=active=await launch(stage,{observe:false,expectedStartup:false});await bounded(s.exit,15000,'STARTUP_FAILURE_TIMEOUT');await s.stop({expectedCode:2});assert.ok(!s.stderr.includes('"event":"startup"'));active=null;}
 finally{await new Promise(done=>holder.close(done));}await rebound();return {exitCode:2,rebound:true};
});
await run('readiness-worker-busy-cancel','busy readiness and no semantic queue; disconnect reaps worker then ready',async()=>group({fault:'worker-hold'},async s=>{
 const c=connect(stage);assert.equal(await c.ready,true);c.socket.write(request(stage,'getContractIdentities'));
 await until(s,x=>x.states.some(r=>r.workers===1));
 assert.equal(response(await wire(stage,request(stage,'getReadiness'))).body.error.code,'MO1305_BUSY');
 assert.equal(response(await wire(stage,request(stage,'getContractIdentities'))).body.error.code,'MO1305_BUSY');
 assert.equal(response(await wire(stage,request(stage,'getHealth'))).status,200);
 c.socket.destroy();await c.done;s.states.length=0;await until(s,x=>x.states.some(r=>r.workers===0&&r.semanticOwners===0));
 assert.deepEqual(response(await wire(stage,request(stage,'getReadiness'))).body,{status:'ok',ready:true});
 assert.equal(s.observations.filter(r=>r.workerCreated===1).length,1);return {created:1,reaped:s.observations.find(r=>r.workerCreated===1).workerReaped,queued:0};
}));
for(const phase of ['handshake','header','body','semantic'])await run('shutdown-during-'+phase,'unpublished activity cancelled; worker and sockets reaped; port rebind',async()=>{
 await group({},async s=>{
  const c=connect(stage,{raw:phase==='handshake'});assert.equal(await c.ready,true);
  if(phase==='header')c.socket.write('GET /v1/health HTTP/1.1\r\n');
  if(phase==='body'){c.socket.write(request(stage,'preparePolicy',' ',{headers:{'Content-Length':'100'}}));await until(s,x=>x.states.some(r=>r.requestSlots===1));}
  if(phase==='semantic'){const v=vectors().find(x=>x.id==='max-mip-policy');c.socket.write(request(stage,v.operation,v.input));await until(s,x=>x.states.some(r=>r.workers===1));}
  const start=clock.mono();s.child.stdin.end();await s.stop();await bounded(c.done,1000,'SOCKET_LEAK');assert.equal(c.bytes.length,0);assert.ok(elapsed(start)<5000);
  if(phase==='semantic'){const sample=s.observations.find(x=>x.workerCreated===1);assert.ok(sample);assert.equal(sample.workerReaped,1);}return {};
 });await rebound();return {publicationSuppressed:true,cleanup:true,rebound:true};
});
for(const phase of ['reaping','ready'])await run('shutdown-semantic-'+phase,'deterministic owner phase cancellation suppresses stale publication',async()=>group({fault:'shutdown-'+phase},async s=>{
 const bytes=await wire(stage,request(stage,'getContractIdentities'),{allowClose:true});await s.stop();assert.equal(bytes.length,0);assert.ok(s.messages.some(x=>x.type==='owner'&&x.record.state===phase));
 assert.equal(s.messages.filter(x=>x.type==='worker'&&x.record.state==='created').length,1);assert.equal(s.messages.filter(x=>x.type==='worker'&&x.record.state==='reaped').length,1);return {phase,published:false,reaped:1};
}));
await run('shutdown-published-semantic','published semantic response drains without substitute result',async()=>group({fault:'shutdown-published'},async s=>{
 const result=response(await wire(stage,request(stage,'getContractIdentities')));assert.equal(result.status,200);assert.equal(result.body.status,'ok');await s.stop();return {status:200,oneResponse:true};
}));
await run('unexpected-worker-exit','unexpected real worker exit returns internal failure and releases ownership',async()=>group({fault:'worker-exit'},async s=>{
 assert.equal(response(await wire(stage,request(stage,'getContractIdentities'))).body.error.code,'MO1305_INTERNAL_FAILURE');
 assert.deepEqual(response(await wire(stage,request(stage,'getReadiness'))).body,{status:'ok',ready:true});return {error:'MO1305_INTERNAL_FAILURE',ready:true};
}));
await run('stale-worker-result','foreign generation cannot publish a result',async()=>group({fault:'worker-stale'},async()=>{
 assert.equal(response(await wire(stage,request(stage,'getContractIdentities'))).body.error.code,'MO1305_INTERNAL_FAILURE');return {stalePublication:false};
}));
await run('generation-exhaustion','exhausted generation returns UNAVAILABLE and exits automatically before overflow without supervisor EOF',async()=>group({fault:'generation-exhaustion'},async s=>{
 const result=response(await wire(stage,request(stage,'getContractIdentities')));assert.equal(result.body.error.code,'MO1305_UNAVAILABLE');assert.equal((await bounded(s.exit,17000,'GENERATION_AUTO_SHUTDOWN')).code,0);assert.ok(!s.messages.some(x=>x.type==='worker'&&x.record.state==='created'));await noListener();return {error:'MO1305_UNAVAILABLE',workers:0};
}));
await run('runtime-integrity-poison','detected installed-byte mutation closes readiness and cancels owner with automatic exit1 before supervisor EOF',async()=>{
 const file=resolve(stage.packageRoot,'README.md'),original=readFileSync(file);
 try{return await group({fault:'worker-hold'},async s=>{
  const c=connect(stage);await c.ready;c.socket.write(request(stage,'getContractIdentities'));await until(s,x=>x.states.some(r=>r.workers===1));
  const readiness=connect(stage);await readiness.ready;readiness.socket.write('GET /v1/readiness HTTP/1.1\r\n');
  writeFileSync(file,Buffer.concat([original,Buffer.from('\nphase2a controlled mutation\n')]));
  const result=response(await wire(stage,request(stage,'getHealth')));assert.equal(result.body.error.code,'MO1305_RUNTIME_INTEGRITY');assert.equal((await bounded(s.exit,17000,'INTEGRITY_AUTO_SHUTDOWN')).code,1);await Promise.all([c.done,readiness.done]);assert.equal(c.bytes.length,0);assert.equal(readiness.bytes.length,0);assert.ok(states(s).includes('FAILED'));await noListener();
  return {error:'MO1305_RUNTIME_INTEGRITY',semanticPublication:false,exitCode:1};
 },{expectedCode:1});}finally{writeFileSync(file,original);}
});
await run('listener-runtime-error','listener error automatically exits1 without supervisor EOF and reaps pending readiness sockets',async()=>group({},async s=>{
 const c=connect(stage);await c.ready;c.socket.write('GET /v1/readiness HTTP/1.1\r\n');await s.send('listener-error');assert.equal((await bounded(s.exit,17000,'LISTENER_AUTO_SHUTDOWN')).code,1);await c.done;assert.equal(c.bytes.length,0);assert.ok(states(s).includes('FAILED'));await noListener();return {exitCode:1,state:'FAILED'};
},{expectedCode:1}));
for(const fatal of [false,true])await run('published-drain-'+(fatal?'fatal-upgrade':'normal'),'published write drains to 10s bound; no new connection/request/worker admission',async()=>group({fault:'blocked-write'},async s=>{
 const c=connect(stage),pending=connect(stage);await Promise.all([c.ready,pending.ready]);c.socket.write(request(stage,'getHealth'));
 await until(s,x=>x.states.some(r=>r.published===1&&r.writeSlots===1));const start=clock.mono();await s.send('shutdown');await until(s,x=>states(x).includes('DRAINING'));
 if(fatal)await s.send('listener-error');
 pending.socket.write(request(stage,'getReadiness'));await bounded(pending.done,2000,'PENDING_REQUEST_DRAIN');assert.equal(pending.bytes.length,0);
 await noListener();await s.stop({expectedCode:fatal?1:0});await c.done;assert.equal(response(c.bytes).status,200);assert.ok(elapsed(start)>=9000&&elapsed(start)<13000);assert.ok(!s.observations.some(r=>r.workerCreated));
 return {exitCode:fatal?1:0,elapsedMs:elapsed(start),newConnection:false,newRequest:false,workers:0};
},{expectedCode:fatal?1:0}));
await run('worker-termination-deadline','nonterminating real worker forces exit1 at existing 2s termination deadline',async()=>group({fault:'worker-terminate-never'},async s=>{
 const c=connect(stage);await c.ready;c.socket.write(request(stage,'getContractIdentities'));await until(s,x=>x.states.some(r=>r.workers===1));const start=clock.mono();await s.send('shutdown');await s.stop({expectedCode:1});await c.done;assert.equal(c.bytes.length,0);assert.ok(elapsed(start)>=1900&&elapsed(start)<4000);await noListener();return {exitCode:1,elapsedMs:elapsed(start),forced:true};
},{expectedCode:1,clean:false}));
await run('shutdown-deadline-listener-close','close completion stall forces process exit1 at existing 15s shutdown deadline',async()=>{
 const data=await group({fault:'listener-close-stall'},async s=>{
  const c=connect(stage);await c.ready;c.socket.write(request(stage,'getHealth'));await until(s,x=>x.states.some(r=>r.published===1));const start=clock.mono();await s.send('shutdown');await s.stop({expectedCode:1});await c.done;assert.ok(elapsed(start)>=14900&&elapsed(start)<17000);assert.equal(response(c.bytes).status,200);return {exitCode:1,elapsedMs:elapsed(start),forced:true};
 },{expectedCode:1,clean:false});await rebound();return {...data,rebound:true};
});
for(const mode of ['local',...(stage.address?['remote']:[])]){
 await run(mode+'-connection-limit','31 and32 sockets admitted;33rd rejected; zero sockets after drain',async()=>group({mode},async s=>{
  const held=[];
  try{
   for(let i=0;i<32;i++){const c=connect(stage,{raw:true});assert.equal(await c.ready,true);held.push(c);await delay(55);if(i===30)await until(s,x=>x.states.some(r=>r.connections===31));}
   await until(s,x=>x.states.some(r=>r.connections===32));const extra=connect(stage,{raw:true});await bounded(extra.done,2000,'33RD_SOCKET_NOT_REJECTED');
   assert.ok(s.states.every(r=>r.connections<=32));await s.send('shutdown');await s.stop();await Promise.all(held.map(c=>c.done));return {maximum:32,rejected:33,cleanup:0};
  }finally{for(const c of held)c.socket.destroy();}
 }));
 await run(mode+'-connection-one-request','keep-alive closes and pipeline creates no second semantic worker through completed cleanup',async()=>group({mode},async s=>{
  const first=response(await wire(stage,request(stage,'getHealth',null,{headers:{Connection:'keep-alive'}})));assert.equal(first.headers.connection,'close');
  const start=s.messages.length,one=request(stage,'getContractIdentities'),bytes=await wire(stage,Buffer.concat([one,one]),{allowClose:true});
  if(bytes.length)assert.equal(response(bytes).body.error.code,'MO1305_REQUEST_SYNTAX');
  const c=connect(stage);await c.ready;const original=request(stage,'getHealth');c.socket.write(original);await c.done;assert.equal(response(c.bytes).status,200);assert.equal(c.closed,true);
  await s.stop();assert.ok(s.messages.slice(start).filter(x=>x.type==='worker'&&x.record.state==='created').length<=1);
  return {keepAlive:false,pipelinedDispatch:false,oneResponse:true};
 }));
}
await run('semantic-fixed-parity-subset','all six capabilities and three decisions preserve existing independent SDK fixture products',async()=>group({},async()=>{
 const all=vectors(),selected=[];
 for(const operation of ['getContractIdentities','preparePolicy','preparePolicySet','verifyEvaluationIdentity','verifyPolicyOutcome'])selected.push(all.find(v=>v.operation===operation&&v.expected?.status==='ok'));
 for(const decision of ['PASS','FAIL','COULD_NOT_EVALUATE'])for(const kind of ['policy','policySet'])selected.push(all.find(v=>v.operation==='evaluatePolicy'&&v.input?.artifactKind===kind&&v.expected?.decision===decision));
 assert.ok(selected.every(Boolean),'MISSING_FROZEN_VECTOR');
 for(const v of selected){const actual=response(await wire(stage,request(stage,v.operation,v.input),{timeout:35000}));assert.equal(actual.status,200);assert.deepEqual(actual.body,v.expected);}
 return {vectors:selected.map(v=>v.id),equalities:selected.length};
}));
persist('PASS');console.log(JSON.stringify({state:'PASS',cases:records.length,resultPath}));
}catch(error){if(active&&!active.exited){active.child.stdin.end();await bounded(active.exit,17000,'FAILED_TEST_CLEANUP',{onTimeout:()=>active.child.kill()});}persist('FAIL');throw error;}
