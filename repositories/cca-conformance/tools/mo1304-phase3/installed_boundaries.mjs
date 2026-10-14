// Supplemental tests of installed modules; primary MCP evidence uses native pipes.
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
const installed=process.env.MO1304_INSTALLED_ROOT;
if(!installed?.startsWith('/home/mo1304/mo1304-cert/runs/'))throw Error('INSTALLED_ROOT_REQUIRED');
const installedImport=path=>import(pathToFileURL(resolve(installed,path)));
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';
import { setImmediate as turn, setTimeout as delay } from 'node:timers/promises';
const { Dispatcher, CANCELLED, PUBLICATION_TOKEN } = await installedImport('src/dispatcher.mjs');
const { BoundedStdioTransport } = await installedImport('src/transport.mjs');
const { loadLimits } = await installedImport('src/limits.mjs');
const { contractIdentityPin } = await installedImport('src/integrity.mjs');
const { J } = await installedImport('src/deterministic.mjs');
const { toolResult } = await installedImport('src/contracts.mjs');
const limits=await loadLimits(),identities=await contractIdentityPin(),product={status:'ok',identities};
const meta={'io.modelcontextprotocol/protocolVersion':'2026-07-28','io.modelcontextprotocol/clientCapabilities':{}};
const request=id=>({jsonrpc:'2.0',id,method:'tools/call',params:{_meta:meta,name:'memoryos_contract_identities',arguments:{}}});
async function until(predicate){for(let i=0;i<400;i++){if(predicate())return;await delay(5);}throw Error('TEST_TIMEOUT');}
class Worker extends EventEmitter {
 stdout=new PassThrough();stderr=new PassThrough();reaped=0;
 terminate(){this.reaped++;return this.reapGate??Promise.resolve(0);}
}
function rig(changes={}) {
 const workers=[];let fatal=0;
 const dispatcher=new Dispatcher({...limits,...changes},identities,(_url,options)=>{const worker=new Worker();worker.options=options;workers.push(worker);return worker;},()=>fatal++);
 return {dispatcher,workers,fatals:()=>fatal,finish(index=workers.length-1){const w=workers[index];w.emit('message',{generation:w.options.workerData.generation,text:J(product)});}};
}
for(const stage of ['pre-aborted','running','worker-settled','publication-ready','publication-handed-off'])test(`supervisor cancellation at ${stage} has one winner and bounded cleanup`,async()=>{
 const r=rig(),d=r.dispatcher,a=new AbortController();if(stage==='pre-aborted')a.abort();
 const pending=d.call('memoryos_contract_identities',{},1,a.signal);
 if(stage==='pre-aborted'){assert.equal(await pending,CANCELLED);assert.equal(r.workers.length,0);return;}
 assert.equal(d.state.phase,'running');let release;
 if(stage==='worker-settled')r.workers[0].reapGate=new Promise(resolve=>{release=resolve;});
 if(stage!=='running')r.finish();
 if(stage==='worker-settled')assert.equal(d.state.phase,'worker-settled');
 if(['publication-ready','publication-handed-off'].includes(stage)){assert.deepEqual(await pending,product);assert.equal(d.state.phase,'publication-ready');}
 if(stage==='publication-handed-off'){assert.equal(d.handoff(1,1),true);assert.equal(d.state.phase,stage);}
 a.abort();const cancelled=d.cancel(1);release?.(0);await cancelled;
 if(stage==='publication-handed-off'){assert.equal(d.active,true);assert.equal(await d.cancel(1),false);d.publish(1,1);}
 else {if(!['publication-ready'].includes(stage))assert.equal(await pending,CANCELLED);assert.equal(d.active,false);}
 const w=r.workers[0];assert.equal(w.reaped,1);assert.equal(w.eventNames().length,0);assert.equal(w.stdout.listenerCount('data'),0);assert.equal(w.stderr.listenerCount('data'),0);
 assert.equal(await d.cancel(1),false);assert.equal(await d.cancel('unknown'),false);assert.equal(r.fatals(),0);
});
test('termination must finish before ID reuse; stale generation and duplicate publication cannot win',async()=>{
 const r=rig(),d=r.dispatcher;let release;
 const pending=d.call('memoryos_contract_identities',{},'same');r.workers[0].reapGate=new Promise(resolve=>{release=resolve;});
 const cancellation=d.cancel('same');await turn();
 assert.equal((await d.call('memoryos_contract_identities',{},'next')).error.code,'MO1304_BUSY');assert.equal(r.workers.length,1);
 release();await cancellation;assert.equal(await pending,CANCELLED);
 const second=d.call('memoryos_contract_identities',{},'same');r.finish();await second;
 assert.equal(d.canPublish('same',1),false);assert.equal(d.handoff('same',1),false);assert.equal(d.handoff('same',2),true);assert.equal(d.handoff('same',2),false);
 d.publish('same',1);assert.equal(d.active,true);d.publish('same',2);assert.equal(d.active,false);d.publish('same',2);
});
for(const race of ['timeout-before-cancel','cancel-before-timeout','exit-before-cancel','shutdown-before-result','factory-abort'])test(`cleanup race: ${race}`,async()=>{
 const r=rig({operationMs:15}),d=r.dispatcher;
 if(race==='factory-abort'){
  const a=new AbortController();let worker;
  const custom=new Dispatcher(limits,identities,()=>{worker=new Worker();a.abort();return worker;});
  const value=await custom.call('memoryos_contract_identities',{},1,a.signal);assert.equal(value,CANCELLED);assert.equal(worker.reaped,1);assert.equal(custom.active,false);return;
 }
 const pending=d.call('memoryos_contract_identities',{},1);
 if(race==='timeout-before-cancel'){const value=await pending;assert.equal(value.error.code,'MO1304_OPERATION_TIMEOUT');await d.cancel(1);}
 if(race==='cancel-before-timeout'){await d.cancel(1);await delay(25);assert.equal(await pending,CANCELLED);}
 if(race==='exit-before-cancel'){r.workers[0].emit('exit',1);await d.cancel(1);assert.equal(await pending,CANCELLED);}
 if(race==='shutdown-before-result'){await d.close();r.finish();assert.equal(await pending,CANCELLED);}
 assert.equal(d.active,false);assert.equal(r.workers[0].reaped,1);assert.equal(r.fatals(),0);
});
async function transportRig(blocked=true) {
 const r=rig(),input=new PassThrough(),frames=[],callbacks=[];let fatal=0;
 const output=new Writable({highWaterMark:1,write(bytes,_encoding,callback){frames.push(Buffer.from(bytes));if(blocked)callbacks.push(callback);else callback();}});
 const t=new BoundedStdioTransport(input,output,limits,r.dispatcher,()=>fatal++);
 const sends=[];t.onmessage=message=>{
  if(message.method==='notifications/cancelled')return;
  const pending=r.dispatcher.call(message.params.name,message.params.arguments,message.id);
  const token=r.dispatcher.token(message.id);
  sends.push(pending.then(value=>{if(value===CANCELLED)return;const result=toolResult(value);if(token!==undefined)result._meta={...result._meta,[PUBLICATION_TOKEN]:token};return t.send({jsonrpc:'2.0',id:message.id,result});}));
 };
 await t.start();
 return {...r,input,output,frames,callbacks,t,sends,fatal:()=>fatal,async close(){await t.close();input.destroy();output.destroy();await Promise.allSettled(sends);}};
}
for(const stage of ['projection-turn','waiting-writer','after-handoff'])test(`wire publication cancellation: ${stage}`,async()=>{
 const r=await transportRig();try{
  if(stage==='waiting-writer'){void r.t.send({jsonrpc:'2.0',id:'control',result:{}});await until(()=>r.frames.length===1);}
  r.input.write(J(request(1))+'\n');await until(()=>r.workers.length===1);r.finish();
  if(stage!=='projection-turn')await until(()=>r.dispatcher.state?.phase==='publication-ready'||r.dispatcher.state?.phase==='publication-handed-off');
  if(stage==='after-handoff')await until(()=>r.frames.some(f=>JSON.parse(f).id===1));
  r.input.write(J({jsonrpc:'2.0',method:'notifications/cancelled',params:{requestId:1}})+'\n');
  if(stage!=='after-handoff')await until(()=>!r.dispatcher.active);
  while(r.callbacks.length)r.callbacks.shift()();await turn();await turn();
  const responses=r.frames.map(f=>JSON.parse(f)).filter(f=>f.id===1);
  assert.equal(responses.length,stage==='after-handoff'?1:0);assert.equal(r.fatal(),0);
 }finally{await r.close();}
});
test('EOF abandons blocked writer timers, cancels ready work, and settles without fatal or retained slot',async()=>{
 const r=await transportRig();
 void r.t.send({jsonrpc:'2.0',id:'control',result:{}});await until(()=>r.frames.length===1);
 r.input.write(J(request(1))+'\n');await until(()=>r.workers.length===1);r.finish();await turn();
 r.input.end();await until(()=>!r.dispatcher.active);await r.close();assert.equal(r.fatal(),0);
 assert.equal(r.workers[0].eventNames().length,0);
});

test('writer requires both callback and drain before releasing publication ownership',async()=>{
 const input=new PassThrough(),output=new EventEmitter();let callback,completed=false;
 output.write=(_frame,cb)=>{callback=cb;return false;};
 const d={async close(){},async cancel(){}};
 const transport=new BoundedStdioTransport(input,output,limits,d);
 await transport.start();const pending=transport.send({jsonrpc:'2.0',id:1,result:{}}).then(()=>{completed=true;});
 await until(()=>callback);callback();await turn();assert.equal(completed,false);
 output.emit('drain');await pending;assert.equal(completed,true);assert.equal(output.listenerCount('drain'),0);
 await transport.close();input.destroy();
});

test('cancellation raised during synchronous projection suppresses the complete frame before handoff',async()=>{
 const r=rig(),input=new PassThrough(),frames=[];
 const output=new Writable({write(bytes,_encoding,callback){frames.push(bytes);callback();}});
 const t=new BoundedStdioTransport(input,output,limits,r.dispatcher);await t.start();
 const pending=r.dispatcher.call('memoryos_contract_identities',{},'projection');r.finish();await pending;
 const result={_meta:{[PUBLICATION_TOKEN]:1},get content(){void r.dispatcher.cancel('projection');return [];}};
 await t.send({jsonrpc:'2.0',id:'projection',result});assert.equal(frames.length,0);assert.equal(r.dispatcher.active,false);
 await t.close();input.destroy();output.destroy();
});

for(const tail of ['','{'])test(`EOF interrupts control admission behind blocked stdout; partial tail=${Boolean(tail)}`,async()=>{
 const input=new PassThrough(),output=new Writable({highWaterMark:1,write(_bytes,_encoding,_callback){}});let fatal=0,closed=0,admitted=0;
 const t=new BoundedStdioTransport(input,output,{...limits,outputDrainMs:500},{async close(){closed++;},async cancel(){}},()=>fatal++);
 t.onmessage=m=>{admitted++;void t.send({jsonrpc:'2.0',id:m.id,result:{}}).catch(()=>{});};await t.start();
 const control=id=>J({jsonrpc:'2.0',id,method:'server/discover',params:{_meta:meta}})+'\n';
 input.write(control(1)+control(2)+tail);await until(()=>admitted===1);await delay(20);input.end();
 await until(()=>closed===1);assert.equal(admitted,1);assert.equal(fatal,tail?1:0);
 await delay(550);assert.equal(fatal,tail?1:0);await t.close();input.destroy();output.destroy();
});


test('frozen response frame and worker product bytes enforce actual N-1/N/N+1',async()=>{
 for(const offset of [-1,0,1]){
  const input=new PassThrough(),frames=[];let fatal=0;
  const output=new Writable({write(bytes,_enc,callback){frames.push(bytes);callback();}});
  const t=new BoundedStdioTransport(input,output,limits,{async close(){},async cancel(){}},()=>fatal++);await t.start();
  const value={jsonrpc:'2.0',id:1,result:{padding:''}};value.result.padding='x'.repeat(limits.responseFrameBytes-Buffer.byteLength(J(value))-1+offset);assert.equal(Buffer.byteLength(J(value))+1,limits.responseFrameBytes+offset);
  await t.send(value);assert.equal(frames.length,offset<=0?1:0);assert.equal(fatal,offset>0?1:0);await t.close();input.destroy();output.destroy();
  const r=rig(),pending=r.dispatcher.call('memoryos_contract_identities',{},1),w=r.workers[0],text=J(product)+' '.repeat(limits.productBytes-Buffer.byteLength(J(product))+offset);
  w.emit('message',{generation:1,text});const result=await pending;assert.equal(result.status,offset<=0?'ok':'error');if(offset>0)assert.equal(result.error.code,'MO1304_INTERNAL_FAILURE');r.dispatcher.publish(1);
 }
});
test('frozen worker options and external-memory N-1/N/N+1 are enforced by installed supervisor',async()=>{
 for(const offset of [-1,0,1]){
  const r=rig(),pending=r.dispatcher.call('memoryos_contract_identities',{},1),w=r.workers[0];
  assert.deepEqual(w.options.resourceLimits,{maxOldGenerationSizeMb:366,maxYoungGenerationSizeMb:366,stackSizeMb:8});assert.deepEqual(w.options.env,{});assert.deepEqual(w.options.execArgv,[]);
  w.getHeapStatistics=async()=>({external_memory:limits.workerExternalBytes+offset});await delay(40);if(offset<=0)r.finish();const result=await pending;assert.equal(result.status,offset<=0?'ok':'error');if(offset>0)assert.equal(result.error.code,'MO1304_OUTPUT_LIMIT');assert.equal(w.reaped,1);r.dispatcher.publish(1);
 }
});
test('frozen parent-attributable memory N-1/N/N+1 is enforced by installed supervisor',async(t)=>{
 const real=process.memoryUsage.bind(process);let rss=0;t.mock.method(process,'memoryUsage',()=>({...real(),rss}));
 for(const offset of [-1,0,1]){
  rss=0;const r=rig(),pending=r.dispatcher.call('memoryos_contract_identities',{},1);rss=limits.parentAttributableBytes+offset;await delay(40);if(offset<=0)r.finish();const result=await pending;assert.equal(result.status,offset<=0?'ok':'error');if(offset>0)assert.equal(result.error.code,'MO1304_OUTPUT_LIMIT');r.dispatcher.publish(1);
 }
});
test('frozen request and control rate N-1/N/N+1 with deterministic time window',async(t)=>{
 t.mock.method(performance,'now',()=>1000);
 for(const kind of ['request','control'])for(const offset of [-1,0,1]){
  const input=new PassThrough(),output=new Writable({write(_b,_e,cb){cb();}});let fatal=0;
  const t=new BoundedStdioTransport(input,output,limits,{async close(){},async cancel(){}},()=>fatal++);await t.start();
  const value=kind==='request'?{jsonrpc:'2.0',method:'tools/call',params:{}}:{jsonrpc:'2.0',method:'notifications/ignored'};
  input.write((JSON.stringify(value)+'\n').repeat(20+offset));await delay(80);assert.equal(fatal,offset>0?1:0);await t.close();input.destroy();output.destroy();
 }
});
test('frozen operation deadline reaps a real live worker',async()=>{
 const {Worker}=await import('node:worker_threads');let worker;
 const d=new Dispatcher(limits,identities,(_url,options)=>{worker=new Worker(new URL('./idle_worker.mjs',import.meta.url),options);return worker;});
 const start=performance.now();const result=await d.call('memoryos_contract_identities',{},1);const elapsed=performance.now()-start;
 assert.equal(result.error.code,'MO1304_OPERATION_TIMEOUT');assert.ok(elapsed>=limits.operationMs-100&&elapsed<limits.operationMs+3000);assert.equal(worker.threadId,-1);d.publish(1);await d.close();
});
test('frozen shutdown deadline poisons a non-reaping supervisor',async()=>{
 const r=rig(),pending=r.dispatcher.call('memoryos_contract_identities',{},1);r.workers[0].terminate=()=>new Promise(()=>{});
 const start=performance.now();await r.dispatcher.cancel(1);const elapsed=performance.now()-start;
 assert.equal(await pending,CANCELLED);assert.ok(elapsed>=limits.shutdownMs-100&&elapsed<limits.shutdownMs+3000);assert.equal(r.fatals(),1);assert.equal((await r.dispatcher.call('memoryos_contract_identities',{},2)).error.code,'MO1304_BUSY');
});


test('real V8 worker exhausts the frozen heap budget and is reaped',async()=>{
 const {Worker}=await import('node:worker_threads');let code;
 const worker=new Worker(new URL('./allocation_worker.mjs',import.meta.url),{workerData:{mode:'heap'},execArgv:[],env:{},stdout:true,stderr:true,resourceLimits:{maxOldGenerationSizeMb:limits.workerHeapMiB,maxYoungGenerationSizeMb:limits.workerYoungMiB,stackSizeMb:limits.workerStackMiB}});
 worker.on('error',e=>{code=e.code;});let timer;try{await Promise.race([new Promise(done=>worker.once('exit',done)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('HEAP_TEST_TIMEOUT')),60000);})]);assert.equal(code,'ERR_WORKER_OUT_OF_MEMORY');assert.equal(worker.threadId,-1);}finally{clearTimeout(timer);await worker.terminate();}
});
test('real external-memory excess is detected by the installed frozen supervisor',async()=>{
 const {Worker}=await import('node:worker_threads');let worker;
 const d=new Dispatcher(limits,identities,(_url,options)=>{worker=new Worker(new URL('./allocation_worker.mjs',import.meta.url),{...options,workerData:{...options.workerData,mode:'external',bytes:limits.workerExternalBytes+1}});return worker;});
 const result=await d.call('memoryos_contract_identities',{},1);assert.equal(result.error.code,'MO1304_OUTPUT_LIMIT');assert.equal(result.error.phase,'memory');assert.equal(worker.threadId,-1);d.publish(1);await d.close();
});
