import test from 'node:test';
import assert from 'node:assert/strict';
import { measurementCorpus } from './corpus.mjs';
import { Worker } from 'node:worker_threads';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { Dispatcher, CANCELLED } from '../src/dispatcher.mjs';
import { loadLimits } from '../src/limits.mjs';
import { contractIdentityPin } from '../src/integrity.mjs';
import { J } from '../src/deterministic.mjs';
const limits = await loadLimits();
const identities = await contractIdentityPin();
const product = {status:'ok',identities};
class FakeWorker extends EventEmitter {
  stdout = new PassThrough(); stderr = new PassThrough(); reaped = 0;
  terminate() { this.reaped++; return Promise.resolve(1); }
}
function rig(changes = {}) {
  const workers=[]; let fatal=0;
  const dispatcher = new Dispatcher({...limits,...changes},identities,(url,options)=> {
    const worker = new FakeWorker(); worker.options=options; workers.push(worker); return worker;
  },()=>fatal++);
  return {dispatcher,workers,fatals:()=>fatal};
}
test('one semantic slot, zero queue, ready result owns slot until publication, fresh generation', async () => {
  const {dispatcher:d,workers:w}=rig();
  const first=d.call('memoryos_contract_identities',{},'a');
  assert.equal(w.length,1); assert.deepEqual(w[0].options.execArgv,[]); assert.deepEqual(w[0].options.env,{});
  assert.equal((await d.call('memoryos_contract_identities',{},'b')).error.code,'MO1304_BUSY');
  assert.equal(w.length,1);
  w[0].emit('message',{generation:1,text:J(product)});
  assert.deepEqual(await first,product); assert.equal(w[0].reaped,1); assert.equal(d.active,true);
  assert.equal((await d.call('memoryos_contract_identities',{},'b')).error.code,'MO1304_BUSY');
  d.publish('a'); const next=d.call('memoryos_contract_identities',{},'a');
  assert.equal(w.length,2); assert.notEqual(w[0],w[1]);
  w[0].emit('message',{generation:1,text:J(product)});
  w[1].emit('message',{generation:2,text:J(product)});
  assert.deepEqual(await next,product); d.publish('a'); await d.close();
});
test('cancellation marks/reaps/suppresses stale generation including same ID reuse', async () => {
  const {dispatcher:d,workers:w}=rig(); const abort=new AbortController();
  const result=d.call('memoryos_contract_identities',{},1,abort.signal);
  abort.abort(); await d.cancel(1); assert.equal(await result,CANCELLED); assert.equal(w[0].reaped,1);
  w[0].emit('message',{generation:1,text:J(product)});
  const next=d.call('memoryos_contract_identities',{},1);
  w[1].emit('message',{generation:1,text:J(product)});
  assert.equal((await next).error.code,'MO1304_INTERNAL_FAILURE'); d.publish(1);
  const ready=d.call('memoryos_contract_identities',{},2); w[2].emit('message',{generation:3,text:J(product)});
  await ready; await d.cancel(2); assert.equal(d.active,false);
});
test('stdout/stderr, unknown exceptions, oversized IPC, malformed products and timeouts normalize', async () => {
  for (const action of [w=>w.stdout.write('secret'),w=>w.stderr.write('secret'),w=>w.emit('error',new Error('secret C:/private')),
    w=>w.emit('message',{generation:1,text:'x'.repeat(limits.productBytes+1)}),
    w=>w.emit('message',{generation:1,text:J({...product,extra:'secret'})}),w=>w.emit('exit',1)]) {
    const {dispatcher:d,workers:w}=rig(); const result=d.call('memoryos_contract_identities',{},1); action(w[0]);
    const value=await result; assert.equal(value.error.code,'MO1304_INTERNAL_FAILURE'); assert.ok(!J(value).includes('secret'));
    assert.equal(w[0].reaped,1); d.publish(1);
  }
  const {dispatcher:d}=rig({operationMs:20});
  assert.equal((await d.call('memoryos_contract_identities',{},1)).error.code,'MO1304_OPERATION_TIMEOUT'); d.publish(1);
});
test('failed or hung reaping poisons admission and reports fatal within finite deadline', async () => {
  for (const terminate of [()=>Promise.reject(new Error('private')),()=>new Promise(()=>{})]) {
    const r=rig({shutdownMs:20}); const result=r.dispatcher.call('memoryos_contract_identities',{},1);
    r.workers[0].terminate=terminate; await r.dispatcher.cancel(1);
    assert.equal(await result,CANCELLED); assert.equal(r.fatals(),1);
    assert.equal((await r.dispatcher.call('memoryos_contract_identities',{},2)).error.code,'MO1304_BUSY');
    assert.equal(r.workers.length,1);
  }
});
test('real workers are fresh, terminated, bounded, and repeated operation memory plateaus', async () => {
  const d=new Dispatcher(limits,identities); const rss=[];
  for (let i=0;i<30;i++) {
    assert.deepEqual(await d.call('memoryos_contract_identities',{},i),product);
    d.publish(i); rss.push(process.memoryUsage().rss);
  }
  assert.equal(d.generation,30); assert.equal(d.active,false);
  const early=Math.max(...rss.slice(5,15)); const late=Math.max(...rss.slice(20));
  assert.ok(late-early < limits.parentAttributableBytes,`growth ${late-early}`);
  await d.close();
});

test('argument and product byte admission exercise N-1/N/N+1',async()=>{
  const args={policyBase64:'e30='};const n=Buffer.byteLength(J(args));
  for(const budget of [n+1,n,n-1]) {
    const r=rig({argumentsBytes:budget});const pending=r.dispatcher.call('memoryos_prepare_policy',args,1);
    if(budget<n){assert.equal((await pending).error.code,'MO1304_INVALID_TOOL_INPUT');assert.equal(r.workers.length,0);}
    else {assert.equal(r.workers.length,1);await r.dispatcher.cancel(1);assert.equal(await pending,CANCELLED);}
  }
  const text=J(product),bytes=Buffer.byteLength(text);
  for(const budget of [bytes+1,bytes,bytes-1]) {
    const r=rig({productBytes:budget});const pending=r.dispatcher.call('memoryos_contract_identities',{},1);
    r.workers[0].emit('message',{generation:1,text});const result=await pending;
    if(budget>=bytes)assert.deepEqual(result,product);else assert.equal(result.error.code,'MO1304_INTERNAL_FAILURE');
    r.dispatcher.publish(1);
  }
});
test('worker external memory ceiling exercises N-1/N/N+1 and reaps on excess',async()=>{
  for(const offset of [-1,0,1]) {
    const r=rig({workerExternalBytes:1024});const pending=r.dispatcher.call('memoryos_contract_identities',{},1);
    r.workers[0].getHeapStatistics=async()=>({external_memory:1024+offset});
    await new Promise(resolve=>setTimeout(resolve,20));
    if(offset<=0)r.workers[0].emit('message',{generation:1,text:J(product)});
    const result=await pending;
    assert.equal(result.status,offset<=0?'ok':'error');if(offset>0)assert.equal(result.error.code,'MO1304_OUTPUT_LIMIT');
    assert.equal(r.workers[0].reaped,1);r.dispatcher.publish(1);
  }
});

test('a real V8 worker heap exhaustion is contained and normalized',async()=>{
  let worker;
  const d=new Dispatcher({...limits,workerHeapMiB:8,workerYoungMiB:1},identities,(_url,options)=>{
    worker=new Worker(new URL('./heap-worker.mjs',import.meta.url),options);return worker;
  });
  const result=await d.call('memoryos_contract_identities',{},'heap');
  assert.equal(result.status,'error');assert.equal(result.error.code,'MO1304_INTERNAL_FAILURE');
  assert.equal(worker.threadId,-1);d.publish('heap');assert.equal(d.active,false);await d.close();
});

test('every maximal valid path completes inside the final production worker budgets',async()=>{
  const d=new Dispatcher(limits,identities);let id=0;
  try {for(const entry of await measurementCorpus()){
    const result=await d.call(entry.name,entry.args,++id);
    assert.equal(result.status,'ok',entry.label+':'+J(result));d.publish(id);
  }}finally{await d.close();}
});
