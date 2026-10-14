import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {Logger} from '../src/logging.mjs';
import {limits} from '../src/contracts.mjs';
import {schemaValidator} from '../src/schema.mjs';
import {deadlineReached,ms} from '../src/admission.mjs';
import {parseHeader} from '../src/raw-gate.mjs';
import {parseJSON,requestJSONLimits} from '../src/json.mjs';
const rejection=(call,code)=>assert.throws(call,e=>e.code==='MO1305_'+code);
test('logger backpressure bounds retained bytes and safely coalesces dropped records',()=>{
 class Sink extends EventEmitter{constructor(){super();this.records=[];this.callbacks=[];}write(bytes,done){this.records.push(Buffer.from(bytes));this.callbacks.push(done);return false;}}
 const sink=new Sink(),logger=new Logger(sink);
 for(let i=0;i<10000;i++)logger.emit('requestCompleted',null,'getHealth','a'.repeat(64));
 assert.ok(logger.pending<=limits.fixed.logQueueBytes);assert.ok(logger.dropped>0);
 const pending=logger.pending;logger.emit('requestCompleted','secret\r\nBearer token','unknown','invalid\nsecret');assert.ok(logger.pending<=limits.fixed.logQueueBytes);assert.ok(logger.pending>=pending);
 while(sink.callbacks.length)sink.callbacks.shift()();assert.equal(logger.pending,0);assert.equal(logger.dropped,0);
 for(const bytes of sink.records){assert.ok(bytes.length<=limits.fixed.logRecordBytes);const record=JSON.parse(bytes);assert.deepEqual(Object.keys(record).sort(),['code','event','operationId','requestId']);assert.ok(!bytes.includes('secret'));}
 assert.ok(sink.records.some(x=>JSON.parse(x).event==='logsDropped'));
 sink.emit('error',new Error('test'));const count=sink.records.length;logger.emit('startup');assert.equal(sink.records.length,count);
});
test('schema compiler rejects malformed maps, enums, references and impossible bounds',()=>{
 for(const schema of [{type:'object'},{$ref:''},{$ref:false},{properties:[]},{enum:[]},{enum:[1,1]},{enum:7},{minLength:-1},{minLength:2,maxLength:1}])assert.throws(()=>schemaValidator({$defs:{Witness:schema}}));
});
test('exact header bytes and JSON parser budgets use N-1/N/N+1 fixtures',()=>{
 for(const n of [16383,16384,16385]){
  let text='GET /v1/health HTTP/1.1\r\n';let i=0;
  while(n-text.length-2>1035){text+='X-'+i+++': '+'a'.repeat(1000)+'\r\n';}
  const remaining=n-text.length-2;text+='Z: '+'z'.repeat(remaining-5)+'\r\n\r\n';assert.equal(Buffer.byteLength(text),n);
  if(n<=16384)assert.equal(parseHeader(Buffer.from(text)).headerBytes,n);else rejection(()=>parseHeader(Buffer.from(text)),'HEADER_LIMIT');
 }
 const budget=requestJSONLimits(limits.fixed,1048576);
 for(const n of [127,128,129]){const raw=Buffer.from('['+Array.from({length:n-1},()=>0).join(',')+']');if(n<=128)assert.equal(parseJSON(raw,budget).length,n-1);else rejection(()=>parseJSON(raw,budget),'INPUT_LIMIT');}
 for(const n of [31,32,33]){const raw=Buffer.from(JSON.stringify(Object.fromEntries(Array.from({length:n},(_,i)=>['k'+i,0]))));if(n<=32)parseJSON(raw,budget);else rejection(()=>parseJSON(raw,budget),'INPUT_LIMIT');}
 for(const n of [7,8,9]){const raw=Buffer.from('['.repeat(n)+'0'+']'.repeat(n));if(n<=8)parseJSON(raw,budget);else rejection(()=>parseJSON(raw,budget),'INPUT_LIMIT');}
 for(const n of [699051,699052,699053]){const raw=Buffer.from('"'+'a'.repeat(n)+'"');if(n<=699052)assert.equal(parseJSON(raw,budget).length,n);else rejection(()=>parseJSON(raw,budget),'INPUT_LIMIT');}
 for(const n of [127,128,129]){const raw=Buffer.from('{"'+'a'.repeat(n)+'":0}');if(n<=128)parseJSON(raw,budget);else rejection(()=>parseJSON(raw,budget),'INPUT_LIMIT');}
 for(const n of [709999,710000,710001]){const raw=Buffer.from('["'+'a'.repeat(699052)+'","'+'b'.repeat(n-699052)+'"]');if(n<=710000)parseJSON(raw,budget);else rejection(()=>parseJSON(raw,budget),'INPUT_LIMIT');}
});

test('all fixed and measured deadlines expire at N using a controlled monotonic clock',()=>{
 for(const duration of [limits.fixed.handshakeMs,limits.fixed.headerMs,limits.fixed.bodyMs,limits.fixed.writeMs,limits.fixed.terminationMs,limits.fixed.shutdownMs,limits.measured.operationMs]){
  const start=123456789n,deadline=start+ms(duration);assert.equal(deadlineReached(deadline,start+ms(duration-1)),false);assert.equal(deadlineReached(deadline,start+ms(duration)),true);assert.equal(deadlineReached(deadline,start+ms(duration+1)),true);
 }
});


test('runtime memory watchdog and response publication boundaries use exact bytes',async()=>{
 const {memoryExceeded,withinBytes}=await import('../src/resource-policy.mjs');
 for(const name of ['workerYoungMiB','workerOldMiB','workerExternalMiB','parentHeapMiB','parentExternalMiB','processRssMiB']){
  const n=limits.measured[name]*1048576;for(const x of [n-1,n,n+1])assert.equal(memoryExceeded({[name]:x}),x>n,name);
 }
 for(const n of [limits.measured.earlyErrorBytes,...Object.values(limits.measured.operations).map(x=>x.responseBytes)])for(const x of [n-1,n,n+1])assert.equal(withinBytes(x,n),x<=n);
 assert.equal(memoryExceeded({unrecognized:1}),true);assert.equal(memoryExceeded({workerYoungMiB:NaN}),true);
});


test('early timer wakeups rearm against the actual monotonic deadline and cancellation suppresses stale callbacks',async()=>{
 const {atDeadline}=await import('../src/admission.mjs');
 for(const n of [limits.fixed.handshakeMs,limits.fixed.headerMs,limits.fixed.bodyMs,limits.fixed.writeMs,limits.fixed.terminationMs,limits.fixed.shutdownMs,limits.measured.operationMs]){
  let time=0n,fired=0,scheduled=null;const token=atDeadline(ms(n),()=>fired++,()=>time,(fn,delay)=>{scheduled={fn,delay};return scheduled;},()=>{});
  assert.equal(scheduled.delay,n);time=ms(n-1);scheduled.fn();assert.equal(fired,0);assert.equal(scheduled.delay,1);time=ms(n);scheduled.fn();assert.equal(fired,1);time=ms(n+1);scheduled.fn();assert.equal(fired,1);token.cancel();
  const cancelled=atDeadline(ms(n+2),()=>fired++,()=>time,(fn,delay)=>{scheduled={fn,delay};return scheduled;},()=>{});cancelled.cancel();time=ms(n+3);scheduled.fn();assert.equal(fired,1);
 }
});
