import assert from 'node:assert/strict';import net from 'node:net';import {readFileSync,writeFileSync} from 'node:fs';import {resolve} from 'node:path';
import {root,stage,launch,request,response,wire,vectors,delay,api} from './installed.mjs';
const limits=JSON.parse(readFileSync(resolve(stage,'package/contracts/limits.json'))),records=[];
assert.equal(limits.state,'FINAL','FINAL_LIMITS_REQUIRED');
const state=await launch({measurement:true});
try{
 for(const route of api.routes){const n=limits.measured.operations[route.operationId].requestBytes;
  if(route.method==='GET'){for(const x of [0,1]){await delay(60);state.observations.length=0;const result=response(await wire(request(route.operationId,x?' ':null,{headers:{'Content-Length':String(x)}})));assert.equal(result.status,x?400:200);records.push({id:'WIRE-'+route.operationId+'-'+x,state:'PASS',dimension:'requestBytes',limit:n,actual:x,status:result.status,semanticValidity:x?'forbidden GET body':'operational or SDK product'});}continue;}
  const v=vectors().find(v=>v.operation===route.operationId&&v.expected.status==='ok'),base=JSON.stringify(v.input);
  for(const x of [n-1,n,n+1]){await delay(60);state.observations.length=0;const body=base+' '.repeat(x-Buffer.byteLength(base));const result=response(await wire(request(route.operationId,body),{timeout:33000}));assert.equal(result.status,x<=n?200:413);if(x<=n)assert.deepEqual(result.body,v.expected);else assert.equal(result.body.error.code,'MO1305_INPUT_LIMIT');await delay(30);assert.equal(state.observations[0].record.workerCreated??0,x<=n?1:0);records.push({id:'WIRE-'+route.operationId+'-'+x,state:'PASS',dimension:'requestBytes',limit:n,actual:x,status:result.status,semanticValidity:x<=n?'valid SDK input plus transport whitespace':'transport rejection before SDK'});}
 }
 state.child.on('message',value=>{if(value.type==='sample')state.observations.length=0;});
 const sockets=[];state.states.length=0;
 for(let i=0;i<33;i++){const socket=net.connect({host:'127.0.0.1',port:13050});socket.on('error',()=>{});sockets.push(socket);await new Promise(r=>socket.once('connect',r));await delay(60);if(i>=30){const count=Math.max(...state.states.map(s=>s.connections));assert.equal(count,Math.min(i+1,32));if(i===32)assert.equal(socket.destroyed,true);records.push({id:'SOCKETS-'+(i+1),state:'PASS',dimension:'connections',limit:32,actual:i+1,admitted:Math.min(i+1,32)});}}
 for(const socket of sockets)socket.destroy();await delay(100);
 assert.ok(state.states.every(s=>s.connections<=32&&s.workers<=1));
}finally{await state.stop();}
writeFileSync(resolve(root,'.cache/mo1305-resource-review/final-boundaries.json'),JSON.stringify({kind:'MemoryOSRESTFinalWireBoundaries',state:'PASS',records,responseBoundaryNote:'Derived response budgets exceed analytically largest schema-valid compact products. N-1/N/N+1 output rejection is exercised by the same runtime withinBytes publication gate with controlled byte counts; no impossible response is labelled a semantic success.'}));console.log(JSON.stringify({state:'PASS',cases:records.length}));
