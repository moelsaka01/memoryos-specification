import test from 'node:test';
import assert from 'node:assert/strict';
import { PassThrough, Writable } from 'node:stream';
import { setTimeout as delay } from 'node:timers/promises';
import { startServer } from '../src/server.mjs';
import { BoundedStdioTransport } from '../src/transport.mjs';
import { contractIdentityPin } from '../src/integrity.mjs';
import { loadLimits } from '../src/limits.mjs';
import { PROTOCOL, META, names, catalog, listingResult } from '../src/contracts.mjs';
const limits = await loadLimits();
const meta={'io.modelcontextprotocol/protocolVersion':PROTOCOL,'io.modelcontextprotocol/clientCapabilities':{}};
const request=(id,method,params={})=>({jsonrpc:'2.0',id,method,params:{_meta:meta,...params}});
async function until(predicate, timeout=limits.operationMs+2000) {
  const start=performance.now(); while (!predicate()) { if(performance.now()-start>timeout) throw new Error('TEST_TIMEOUT'); await delay(5); }
}
async function harness() {
  const input=new PassThrough(); const output=new PassThrough(); const messages=[]; let buffer=''; let fatals=0;
  output.on('data',bytes=>{buffer+=bytes.toString('utf8'); let lf; while((lf=buffer.indexOf('\n'))>=0){ const frame=buffer.slice(0,lf); buffer=buffer.slice(lf+1); assert.ok(!frame.includes('\r')); messages.push(JSON.parse(frame)); }});
  // Strip only the node:test runner flags in this in-process harness; launch rejection is tested separately.
  const runnerFlags=process.execArgv; process.execArgv=[]; let server;
  try { server=await startServer({input,output,fatal:()=>fatals++}); } finally { process.execArgv=runnerFlags; }
  return {input,output,messages,fatals:()=>fatals,send(value,delimiter='\n'){input.write(JSON.stringify(value)+delimiter);},
    async next(index=messages.length){await until(()=>messages.length>index);return messages[index];},
    async close(){await server.close();input.destroy();output.destroy();}};
}
test('modern metadata, exact discovery/catalog and normal semantic result through official SDK', async()=>{
  const h=await harness(); try {
    h.send(request(1,'server/discover'),'\r\n'); const discovery=await h.next(0);
    assert.deepEqual(discovery,{jsonrpc:'2.0',id:1,result:{resultType:'complete',ttlMs:0,cacheScope:'private',supportedVersions:[PROTOCOL],capabilities:{tools:{listChanged:false}},_meta:META}});
    h.send(request(2,'tools/list')); const listing=await h.next(1);
    assert.deepEqual(listing.result,listingResult(catalog(await contractIdentityPin()))); assert.deepEqual(listing.result.tools.map(x=>x.name),names);
    h.send(request(3,'tools/call',{name:names[0],arguments:{}})); const call=await h.next(2);
    assert.equal(call.result.structuredContent.status,'ok'); assert.equal(call.result.isError,false);
    assert.deepEqual(JSON.parse(call.result.content[0].text),call.result.structuredContent); assert.equal(h.fatals(),0);
  } finally {await h.close();}
});
test('missing metadata, legacy, unknown method/tool and invalid known arguments have distinct errors',async()=>{
  const cases=[
    [{jsonrpc:'2.0',id:1,method:'server/discover',params:{}},-32602],
    [request(1,'server/discover',{_meta:{...meta,'io.modelcontextprotocol/clientCapabilities':null}}),-32602],
    [request(1,'server/discover',{_meta:{...meta,'io.modelcontextprotocol/protocolVersion':'2025-11-25'}}),-32022],
    [request(1,'initialize'),-32022],[request(1,'resources/list'),-32601],
    [request(1,'tools/call',{name:'unknown',arguments:{}}),-32602],
    [request(1,'tools/list',{cursor:'x'}),-32602],
    [request(1.5,'server/discover'),-32600],[request(null,'server/discover'),-32600],
    [request(Number.MAX_SAFE_INTEGER+1,'server/discover'),-32600],
  ];
  const h=await harness();try {
    for(let i=0;i<cases.length;i++){h.send(cases[i][0]);const response=await h.next(i);assert.equal(response.error.code,cases[i][1],JSON.stringify(response));}
    for(const args of [null,undefined,{extra:true}]) {
      const index=h.messages.length;h.send(request(20+index,'tools/call',{name:names[0],...(args===undefined?{}:{arguments:args})}));
      const response=await h.next(index);assert.equal(response.result.structuredContent.error.code,'MO1304_INVALID_TOOL_INPUT');
    }
  }finally{await h.close();}
});
test('scalar/batch/duplicate JSON and unsafe IDs never enter semantic dispatch',async()=>{
  const h=await harness();try{
    const frames=['null','[]','42','{"jsonrpc":"2.0","id":1,"id":2,"method":"tools/list"}','{"a":1,}',JSON.stringify(request('x'.repeat(129),'server/discover'))];
    for(let i=0;i<frames.length;i++){h.input.write(frames[i]+'\n');const response=await h.next(i);assert.ok([-32700,-32600].includes(response.error.code));}
  }finally{await h.close();}
});
test('mandatory single subscription acknowledges empty filter, emits no feature events, cancellation removes it',async()=>{
  const h=await harness();try{
    h.send(request('s','subscriptions/listen',{notifications:{}})); const ack=await h.next(0);
    assert.deepEqual(ack,{jsonrpc:'2.0',method:'notifications/subscriptions/acknowledged',params:{_meta:{'io.modelcontextprotocol/subscriptionId':'s'},notifications:{}}});
    h.send(request('second','subscriptions/listen',{notifications:{}}));assert.ok((await h.next(1)).error);
    h.send({jsonrpc:'2.0',method:'notifications/cancelled',params:{requestId:'s',reason:'secret'}});
    await delay(30);assert.equal(h.messages.length,2);
    h.send(request('s','subscriptions/listen',{notifications:{}}));assert.equal((await h.next(2)).method,'notifications/subscriptions/acknowledged');
    await h.close(); assert.equal(h.messages.at(-1).method,'notifications/cancelled');
  }finally{await h.close();}
});
test('semantic cancellation emits no tool reply, permits ID reuse, suppresses stale work',async()=>{
  const h=await harness();try{
    h.send(request(1,'tools/call',{name:names[0],arguments:{}}));
    h.send({jsonrpc:'2.0',method:'notifications/cancelled',params:{requestId:1}});
    await delay(100);
    h.send(request(1,'server/discover'));const reply=await h.next(0);assert.ok(reply.result.supportedVersions);
    await delay(100);assert.equal(h.messages.length,1);
  }finally{await h.close();}
});
function boundary(changes={},blocked=false) {
  const input=new PassThrough();const writes=[];let fatal=0;let closed=0;const dispatched=[];
  const output=new Writable({highWaterMark:1,write(bytes,encoding,callback){writes.push(Buffer.from(bytes));if(!blocked)callback();}});
  const dispatcher={async cancel(){},async close(){closed++;},publish(){}};
  const transport=new BoundedStdioTransport(input,output,{...limits,...changes},dispatcher,()=>fatal++);
  transport.onmessage=value=>dispatched.push(value);
  return {input,output,writes,dispatched,transport,fatals:()=>fatal,closed:()=>closed,
    async close(){await transport.close();input.destroy();output.destroy();}};
}
test('frame N-1/N/N+1, unterminated overflow, partial deadline, UTF-8, flooding and blocked output are bounded',async()=>{
  const body=JSON.stringify(request(1,'server/discover'));
  for(const delta of [-1,0,1]) {
    const h=boundary({requestFrameBytes:body.length+2,inputChunkBytes:1024});await h.transport.start();
    h.input.write(body+' '.repeat(delta+1)+'\n');await delay(30);
    assert.equal(h.dispatched.length,delta<=0?1:0);assert.equal(h.fatals(),delta>0?1:0);await h.close();
  }
  for(const [changes,bytes] of [[{requestFrameBytes:32},Buffer.alloc(32,32)],[{partialFrameMs:20},Buffer.from('{')],[{},Buffer.from([0xc0,0xaf,10])]]) {
    const h=boundary(changes);await h.transport.start();h.input.write(bytes);await until(()=>h.fatals()>0,500);assert.equal(h.closed(),1);await h.close();
  }
  const flood=boundary({requestsPerSecond:2});await flood.transport.start();flood.input.write('{}\n'.repeat(3));await until(()=>flood.fatals()>0,500);await flood.close();
  const blocked=boundary({outputDrainMs:20},true);await blocked.transport.start();
  await assert.rejects(blocked.transport.send({jsonrpc:'2.0',id:1,result:{}}));await until(()=>blocked.fatals()>0,500);await blocked.close();
});
test('output frame N-1/N/N+1 and two-frame queue are finite',async()=>{
  const value={jsonrpc:'2.0',id:1,result:{}};const bytes=Buffer.byteLength(JSON.stringify(value))+1;
  for(const ceiling of [bytes+1,bytes,bytes-1]){
    const h=boundary({responseFrameBytes:ceiling});await h.transport.start();await h.transport.send(value);
    assert.equal(h.writes.length,ceiling>=bytes?1:0);assert.equal(h.fatals(),ceiling<bytes?1:0);await h.close();
  }
  const h=boundary({outputDrainMs:30},true);await h.transport.start();
  const first=h.transport.send(value).catch(()=>{});const second=h.transport.send({...value,id:2}).catch(()=>{});
  await h.transport.send({...value,id:3});assert.equal(h.fatals(),1);await Promise.all([first,second]);await h.close();
});

test('owned discovery/list projections fail closed on missing, wrong-type or incorrect cache fields',async()=>{
  for(const field of ['tools','supportedVersions']) for(const mutation of [{ttlMs:1},{ttlMs:-1},{ttlMs:'0'},{ttlMs:null},{ttlMs:undefined},{cacheScope:'public'},{cacheScope:null},{cacheScope:undefined}]) {
    const h=boundary();await h.transport.start();
    await h.transport.send({jsonrpc:'2.0',id:1,result:{resultType:'complete',ttlMs:0,cacheScope:'private',[field]:[],...mutation}});
    assert.equal(h.fatals(),1);assert.equal(h.writes.length,0);await h.close();
  }
});

test('metadata bytes and request ID code units enforce actual N-1/N/N+1',async()=>{
  for(const offset of [-1,0,1]) {
    const h=boundary();await h.transport.start();
    const padded={...meta,padding:''};padded.padding='x'.repeat(limits.metadataBytes-Buffer.byteLength(JSON.stringify(padded))+offset);
    h.input.write(JSON.stringify(request(1,'server/discover',{_meta:padded}))+'\n');await delay(30);
    assert.equal(h.dispatched.length,offset<=0?1:0);if(offset>0)assert.equal(JSON.parse(h.writes[0]).error.code,-32602);await h.close();
  }
  for(const offset of [-1,0,1]) {
    const h=boundary();await h.transport.start();h.input.write(JSON.stringify(request('r'.repeat(limits.requestIdCodeUnits+offset),'server/discover'))+'\n');await delay(30);
    assert.equal(h.dispatched.length,offset<=0?1:0);if(offset>0)assert.equal(JSON.parse(h.writes[0]).error.code,-32600);await h.close();
  }
});
test('input read chunk size is a per-read bound and does not reject larger producer chunks',async()=>{
  for(const delta of [-1,0,1]) {
    const h=boundary();await h.transport.start();const body=JSON.stringify(request(1,'server/discover'));
    const bytes=Buffer.from(body+' '.repeat(limits.inputChunkBytes+delta-body.length-1)+'\n');
    h.input.write(bytes);await delay(30);assert.equal(h.dispatched.length,1);assert.equal(h.fatals(),0);await h.close();
  }
});
test('actual request and control rate counts have N-1/N/N+1 flood witnesses',async(t)=>{
  t.mock.method(performance,'now',()=>1000);
  for(const name of ['requestsPerSecond','controlsPerSecond'])for(const delta of [-1,0,1]) {
    const changes={requestsPerSecond:1000,controlsPerSecond:1000,[name]:limits[name]};
    const h=boundary(changes);await h.transport.start();
    h.input.write((JSON.stringify({jsonrpc:'2.0',method:'notifications/ignored'})+'\n').repeat(limits[name]+delta));
    await delay(50);assert.equal(h.fatals(),delta>0?1:0);assert.equal(h.writes.length,0);await h.close();
  }
});

test('a second outstanding control request cannot consume a second control slot',async()=>{
  const h=boundary();await h.transport.start();
  h.input.write(JSON.stringify(request('first','server/discover'))+'\n');await delay(20);
  assert.equal(h.dispatched.length,1);
  h.input.write(JSON.stringify(request('second','tools/list'))+'\n');await delay(20);
  assert.equal(h.dispatched.length,1);assert.equal(h.fatals(),1);await h.close();
});
