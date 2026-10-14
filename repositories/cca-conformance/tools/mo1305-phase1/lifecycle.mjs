import {monoMs,clock,relation} from './clock.mjs';
import assert from 'node:assert/strict';
import tls from 'node:tls';
import net from 'node:net';
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {launch,root,stage,credentials,request,response,wire,vectors,delay} from './installed.mjs';
const records=[],maxBody=JSON.parse(readFileSync(resolve(stage,'package/contracts/limits.json'))).measured.operations.evaluatePolicy.requestBytes;
function socket({raw=false}={}){
 const started=monoMs(),s=raw?net.connect({host:'127.0.0.1',port:13050}):tls.connect({host:'127.0.0.1',port:13050,ca:credentials.ca,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',ALPNProtocols:['http/1.1']});let bytes=Buffer.alloc(0);
 s.on('error',()=>{});s.on('data',b=>{bytes=Buffer.concat([bytes,b]);assert.ok(bytes.length<131072);});
 const ready=new Promise(r=>s.once(raw?'connect':'secureConnect',r));const closed=new Promise(r=>s.once('close',()=>r({ms:Math.ceil(monoMs()-started),bytes})));
 return {s,ready,closed};
}
async function until(state,predicate,timeout=3000){const end=clock.mono()+BigInt(timeout)*1000000n;while(clock.mono()<end){if(state.states.some(predicate))return;await delay(10);}relation('LIFECYCLE_STATE_TIMEOUT','<','observedNs',clock.mono(),'deadlineNs',end,{units:'ns',domain:clock.domain});}
async function group(run,args=null){const state=await launch({measurement:true,args});state.child.on('message',v=>{if(v.type==='sample')state.observations.length=0;});try{await run(state);}finally{await state.stop();}}
function checked(id,value,minimum,maximum,code=null){relation('LIFECYCLE_MINIMUM','>=','elapsedMs',value.ms,'minimumMs',minimum,{units:'ms',domain:clock.domain});relation('LIFECYCLE_MAXIMUM','<','elapsedMs',value.ms,'maximumMs',maximum,{units:'ms',domain:clock.domain});if(code)assert.equal(response(value.bytes).body.error.code,'MO1305_'+code);records.push({id,state:'PASS',elapsedMs:value.ms,minimumMs:minimum,maximumMs:maximum,code});}
await group(async state=>{
 const handshake=socket({raw:true});await handshake.ready;checked('TIME-handshake-absolute',await handshake.closed,9800,12000);
 const header=socket();await header.ready;header.s.write('GET /v1/health HTTP/1.1\r\n');const trickle=setInterval(()=>header.s.write(' '),1000);checked('TIME-header-trickle',await header.closed,9800,12000,'REQUEST_TIMEOUT');clearInterval(trickle);
 const early=socket();await early.ready;early.s.end(request('preparePolicy','{', {headers:{'Content-Length':'20'}}));checked('TIME-body-premature-EOF',await early.closed,0,2000,'REQUEST_TIMEOUT');
 const body=socket();await body.ready;body.s.write(request('preparePolicy',' ',{headers:{'Content-Length':'100'}}));const trickleBody=setInterval(()=>body.s.write(' '),1000);checked('TIME-body-trickle',await body.closed,29800,32000,'REQUEST_TIMEOUT');clearInterval(trickleBody);
 assert.equal(response(await wire(request('getHealth'))).status,200);records.push({id:'TIME-recovery',state:'PASS'});
});
await group(async state=>{
 const held=[];for(let i=0;i<4;i++){const c=socket();await c.ready;c.s.write(request('evaluatePolicy',' ',{headers:{'Content-Length':String(maxBody)}}));held.push(c);await delay(60);}
 await until(state,x=>x.requestSlots===4&&x.bodyBufferBytes===4*maxBody);
 assert.equal(response(await wire(request('getHealth'))).body.error.code,'MO1305_BUSY');
 for(const c of held)c.s.destroy();await Promise.all(held.map(c=>c.closed));await delay(50);state.states.length=0;await until(state,x=>x.requestSlots===0&&x.connections===0);assert.equal(response(await wire(request('getHealth'))).status,200);records.push({id:'LOAD-four-body-slots-release',state:'PASS',peakRequestSlots:4,peakBodyBufferBytes:4*maxBody});
 const maximum=vectors().find(x=>x.id==='max-mip-policy'),c=socket();await c.ready;state.states.length=0;c.s.write(request(maximum.operation,maximum.input));await until(state,x=>x.workers===1);
 assert.equal(response(await wire(request('getReadiness'))).body.error.code,'MO1305_BUSY');assert.equal(response(await wire(request('getHealth'))).status,200);
 assert.equal(response(await wire(request('getContractIdentities'))).body.error.code,'MO1305_BUSY');c.s.destroy();await c.closed;await delay(100);state.states.length=0;await until(state,x=>x.workers===0&&x.semanticOwners===0);assert.equal(response(await wire(request('getReadiness'))).status,200);records.push({id:'LIFECYCLE-worker-cancel-reap-no-queue',state:'PASS'});
});
await group(async state=>{
 const held=[];for(let i=0;i<4;i++){const c=socket();await c.ready;c.s.write(request('getHealth'));held.push(c);await delay(60);}
 await until(state,x=>x.writeSlots===4&&x.published===4);records.push({id:'LOAD-four-blocked-write-slots',state:'PASS',peakWriteSlots:4,mechanism:'controlled TLS Writable completion; actual TCP/TLS/HTTP'});
 const fifth=await wire(request('getHealth'),{allowClose:true});assert.equal(fifth.length,0);records.push({id:'LOAD-fifth-write-rejected',state:'PASS'});
 for(const c of held){const result=await c.closed;checked('TIME-write-'+records.length,result,9800,12000);assert.equal(response(result.bytes).status,200);}
},[resolve(import.meta.dirname,'write-fault-server.mjs'),stage]);
for(const lifecycle of ['idle','handshake','header','body','worker','published']){
 const state=await launch({measurement:true,args:lifecycle==='published'?[resolve(import.meta.dirname,'write-fault-server.mjs'),stage]:null});let c=null;state.child.on('message',v=>{if(v.type==='sample')state.observations.length=0;});
 if(lifecycle!=='idle'){
  c=socket({raw:lifecycle==='handshake'});await c.ready;
  if(lifecycle==='header')c.s.write('GET /v1/health HTTP/1.1\r\n');
  if(lifecycle==='body')c.s.write(request('preparePolicy',' ',{headers:{'Content-Length':'100'}}));
  if(lifecycle==='worker'){const v=vectors().find(x=>x.id==='max-mip-policy');c.s.write(request(v.operation,v.input));await until(state,x=>x.workers===1);}
  if(lifecycle==='published'){c.s.write(request('getHealth'));await until(state,x=>x.writeSlots===1);}
 }
 const start=monoMs();await state.stop();const elapsedMs=Math.ceil(monoMs()-start);relation('SHUTDOWN_MAXIMUM','<','elapsedMs',elapsedMs,'maximumMs',15200,{units:'ms',domain:clock.domain});if(c)await c.closed;
 if(lifecycle==='published')relation('SHUTDOWN_DRAIN_MINIMUM','>=','elapsedMs',elapsedMs,'minimumMs',9500,{units:'ms',domain:clock.domain});records.push({id:'LIFECYCLE-shutdown-'+lifecycle,state:'PASS',elapsedMs});
 const rebound=await launch();assert.equal(response(await wire(request('getHealth'))).status,200);await rebound.stop();
}
writeFileSync(resolve(root,'.cache/mo1305-resource-review/lifecycle.json'),JSON.stringify({kind:'MemoryOSRESTLifecycleTests',state:'PASS',records}));console.log(JSON.stringify({state:'PASS',cases:records.length}));
