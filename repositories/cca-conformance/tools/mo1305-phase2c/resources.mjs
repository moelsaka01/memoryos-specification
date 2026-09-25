import assert from 'node:assert/strict';
import net from 'node:net';
import tls from 'node:tls';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {launch,request,response,wire,vectors,delay,api,credentials,limits,root,port,bounded,reference} from './common.mjs';
import {Slots,TokenBucket} from '../../../memoryos-rest/src/admission.mjs';
export async function runResources(){
 const records=[],limitations=[];const add=(id,details)=>records.push({id,category:'resource-abuse',state:'PASS',...details});
 let state=await launch();
 try{
  for(const route of api.routes){const n=limits.measured.operations[route.operationId].requestBytes;
   if(route.method==='GET'){
    for(const x of [0,1]){await delay(60);const result=response(await wire(request(route.operationId,x?' ':null,{headers:{'Content-Length':String(x)}})));assert.equal(result.status,x?400:200);if(x)assert.equal(result.body.error.code,'MO1305_REQUEST_SCHEMA');add('BODY-'+route.operationId+'-'+x,{limit:n,bytes:x,status:result.status,code:result.body.error?.code??null});}continue;
   }
   const v=vectors().find(v=>v.operation===route.operationId&&v.expected.status==='ok'),base=JSON.stringify(v.input);
   for(const x of [n-1,n,n+1]){await delay(60);const body=base+' '.repeat(x-Buffer.byteLength(base));const result=response(await wire(request(route.operationId,body),{timeout:35000}));assert.equal(result.status,x<=n?200:413,route.operationId);if(x<=n)assert.deepEqual(result.body,v.expected);else assert.equal(result.body.error.code,'MO1305_INPUT_LIMIT');add('BODY-'+route.operationId+'-'+x,{limit:n,bytes:x,status:result.status,code:result.body.error?.code??null,admission:x<=n?'valid semantic input with transport whitespace':'body rejected'});}
  }
 }finally{await state.stop();}
 const sockets=[];state=await launch();
 try{
  for(let i=0;i<33;i++){
   const socket=net.connect({host:'127.0.0.1',port});socket.on('error',()=>{});sockets.push(socket);
   await bounded(new Promise(r=>socket.once('connect',r)),2000,'CONNECT_TIMEOUT');await delay(65);
   if(i>=30){const open=sockets.filter(s=>!s.destroyed).length;assert.equal(open,Math.min(i+1,32));add('CONNECTIONS-'+(i+1),{offered:i+1,admitted:open,limit:32,transport:'actual TCP before TLS'});}
  }
 }finally{for(const s of sockets)s.destroy();await delay(100);await state.stop();}
 async function connectTLS(){return bounded(new Promise((r,j)=>{const s=tls.connect({host:'127.0.0.1',port,ca:credentials.ca,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',ALPNProtocols:['http/1.1']});s.on('error',j);s.once('secureConnect',()=>r(s));}),11000,'TLS_CONNECT_TIMEOUT');}
 state=await launch();const partial=[];
 try{
  for(let i=0;i<4;i++){
   const s=await connectTLS();partial.push(s);const bytes=request('preparePolicy','{}');s.write(bytes.subarray(0,bytes.length-1));await delay(70);
   if(i>=2){const r=response(await wire(request('getHealth')));assert.equal(r.status,i===2?200:503);if(i===3){assert.equal(r.body.error.code,'MO1305_BUSY');assert.equal(r.headers['retry-after'],'1');}add('REQUEST-SLOTS-'+(i+1),{held:i+1,probeStatus:r.status,code:r.body.error?.code??null,limit:4});}
  }
  partial[0].destroy();await delay(100);assert.equal(response(await wire(request('getHealth'))).status,200);add('REQUEST-SLOTS-release',{held:3,probeStatus:200,limit:4});
  // Reset an incomplete TLS handshake: no HTTP response can be published.
  const cancelled=net.connect({host:'127.0.0.1',port});cancelled.on('error',()=>{});await new Promise(r=>cancelled.once('connect',r));await delay(50);cancelled.resetAndDestroy();await delay(100);assert.ok(state.stderr.includes('MO1305_CLIENT_CANCELLED'));records.push({id:'ERROR-CLIENT-CANCELLED',category:'error-contract',state:'PASS',code:'MO1305_CLIENT_CANCELLED',status:null,wire:false,evidenceMode:'actual-entrypoint disconnect log'});
 }finally{for(const s of partial)s.destroy();await delay(100);await state.stop();}
 state=await launch();const ready=[];
 try{
  // Preconnect slowly: request-rate exhaustion is isolated from the connection bucket.
  ready.push(...await Promise.all(Array.from({length:32},async(_,i)=>{await delay(i*70);return connectTLS();})));
  const results=ready.map(s=>new Promise((r,j)=>{let bytes=Buffer.alloc(0);s.on('data',b=>bytes=Buffer.concat([bytes,b]));s.once('close',()=>r(bytes));s.on('error',()=>{});}));
  // Bounded waves let early-error write slots release; otherwise rate errors may validly close without a body.
  for(let i=0;i<ready.length;i+=4){for(const s of ready.slice(i,i+4))s.write(request('getHealth',null,{headers:{Authorization:'Bearer '+'0'.repeat(64)}}));await bounded(Promise.all(results.slice(i,i+4)),5000,'RATE_WAVE_TIMEOUT');}
  const raw=await bounded(Promise.all(results),8000,'RATE_RESPONSE_TIMEOUT');const statuses=raw.filter(b=>b.length).map(b=>response(b));
  assert.ok(statuses.some(r=>r.status===401));assert.ok(statuses.some(r=>r.status===429),'RATE_STATUSES '+statuses.map(r=>r.status).join(',')+' CLOSED '+raw.filter(b=>!b.length).length);assert.ok(statuses.every(r=>r.status===401||r.status===429));
  for(const r of statuses.filter(r=>r.status===429)){assert.equal(r.body.error.code,'MO1305_RATE_LIMIT');assert.equal(r.headers['retry-after'],'1');}
  add('REQUEST-RATE-burst',{offered:32,unauthenticated:statuses.filter(r=>r.status===401).length,rateRejected:statuses.filter(r=>r.status===429).length,closedWithoutBody:raw.filter(b=>!b.length).length,rate:20,burst:20,code:'MO1305_RATE_LIMIT',status:429});
  await delay(1100);assert.equal(response(await wire(request('getHealth'))).status,200);add('REQUEST-RATE-refill',{status:200});
 }finally{for(const s of ready)s.destroy();await state.stop();}
 state=await launch();
 try{
  const v=vectors().find(v=>v.id==='max-mip-policySet');assert.ok(v);const active=wire(request(v.operation,v.input),{timeout:35000});let readyStatus=200;for(let i=0;i<20&&readyStatus===200;i++){await delay(60);readyStatus=response(await wire(request('getReadiness'))).status;}assert.equal(readyStatus,503,'SEMANTIC_OWNER_NOT_OBSERVED');
  const busy=response(await wire(request('getContractIdentities')));assert.equal(busy.status,503);assert.equal(busy.body.error.code,'MO1305_BUSY');assert.equal(busy.headers['retry-after'],'1');
  const health=response(await wire(request('getHealth')));assert.equal(health.status,200);const result=response(await active);assert.deepEqual(result.body,v.expected);add('SEMANTIC-BUSY',{status:503,code:'MO1305_BUSY',healthStatus:200,completedStatus:result.status,queue:0});
  await delay(70);assert.equal(response(await wire(request('getReadiness'))).status,200);add('SEMANTIC-RELEASE',{status:200});
 }finally{await state.stop();}
 // Supplement live acceptance with deterministic N-1/N/N+1, never label it wire evidence.
 for(const kind of ['request','write']){const slots=new Slots(4),owners=Array.from({length:5},()=>({}));for(let i=0;i<5;i++){assert.equal(slots.acquire(owners[i]),i<4);if(i>=2)add(kind.toUpperCase()+'-SLOTS-mechanical-'+(i+1),{evidenceMode:'supplemental production primitive',offered:i+1,admitted:Math.min(i+1,4),limit:4});}}
 let time=0n;const bucket=new TokenBucket(20,20,()=>time);for(let i=0;i<20;i++)assert.ok(bucket.take());assert.equal(bucket.take(),false);for(const [n,allowed] of [[49999999n,false],[50000000n,true],[50000001n,false]]){time=n;assert.equal(bucket.take(),allowed);add('RATE-REFILL-'+n,{evidenceMode:'supplemental production primitive',nanoseconds:String(n),admitted:allowed});}
 limitations.push('Pending-write N-1/N/N+1 uses the exact production Slots primitive and retained Phase 1 controlled backpressure evidence; a paused loopback client cannot reliably fill Windows send buffers with the frozen small responses. No new sustained-resource characterization.');
 records.push(...await runConnectionRate());
 return {records,limitations};
}
export function errorCatalog(records){
 const expected={BUSY:503,CLIENT_CANCELLED:null,FORBIDDEN:403,HEADER_LIMIT:431,HTTP_VERSION:505,INPUT_LIMIT:413,INTERNAL_FAILURE:500,LENGTH_REQUIRED:411,METHOD_NOT_ALLOWED:405,NOT_ACCEPTABLE:406,NOT_FOUND:404,OPERATION_TIMEOUT:504,OUTPUT_LIMIT:500,RATE_LIMIT:429,REQUEST_SCHEMA:400,REQUEST_SYNTAX:400,REQUEST_TIMEOUT:408,RUNTIME_INTEGRITY:503,SEMANTIC_REJECTED:422,TARGET_LIMIT:414,UNAUTHENTICATED:401,UNAVAILABLE:503,UNSUPPORTED_MEDIA:415};
 assert.equal(Object.keys(api.errors).length,23);const openapi=JSON.parse(readFileSync(resolve(root,'repositories/memoryos-rest/contracts/openapi.json')));assert.deepEqual(openapi['x-memoryos-http'].errors,api.errors);
 const fault=reference('repositories/cca-conformance/evidence/mo1305-phase1-aux/raw/worker-faults.json'),faultCases=JSON.parse(readFileSync(resolve(root,fault.path)));assert.equal(faultCases.state,'PASS');assert.equal(faultCases.records.length,15);assert.ok(faultCases.records.every(r=>r.state==='PASS'));
 const reused=['repositories/cca-conformance/evidence/mo1305-phase1-aux/security-worker-faults.json','repositories/cca-conformance/tools/mo1305-phase1/faults.mjs','repositories/cca-conformance/tools/mo1305-phase1/fault-server.mjs','repositories/cca-conformance/tools/mo1305-phase1/fault-worker.mjs'].map(reference);
 for(const suffix of ['unavailable','internal-failure','operation-timeout','output-limit']){const ref=reference('repositories/cca-conformance/evidence/mo1305-phase1-resume/functional/projection-'+suffix+'.json');const value=JSON.parse(readFileSync(resolve(root,ref.path)));assert.equal(value.complete,true);assert.ok(value.records.every(r=>r.state==='PASS'&&r.status===expected[suffix.replaceAll('-','_').toUpperCase()]));reused.push(ref);}
 const result=Object.entries(expected).map(([suffix,status])=>{
  const code='MO1305_'+suffix,wire=status!==null;assert.deepEqual(api.errors[code],{status,wire});
  const observed=records.filter(r=>(r.code===code||r.errorCode===code)&&r.state==='PASS');for(const r of observed)assert.equal(r.status??r.httpStatus??null,status,'ERROR_MAPPING '+r.id);const witnesses=observed.map(r=>r.id);
  const exception=['INTERNAL_FAILURE','OPERATION_TIMEOUT','OUTPUT_LIMIT','UNAVAILABLE'].includes(suffix);
  assert.ok(exception||witnesses.length,`MISSING_REAL_ERROR ${code}`);
  return {id:'CATALOG-'+suffix,category:'error-catalog',state:'PASS',code,status,wire,witnesses,evidenceMode:witnesses.length?'current production-entrypoint wire or cancellation log':'frozen mapping plus retained controlled Phase 1 evidence',limitation:exception?'Exceptional fail-closed path; not claimed as an ordinary authenticated-client trigger.':null};
 });
 return {records:result,reused:[fault,...reused],reuseJustification:'Phase 1 controlled worker projections/faults are retained with their original source/archive identities. Current server differs only by requireHostHeader:false and its comment, which delegates missing-Host precedence to frozen authentication/header policy. Semantic worker, error projector, serialization, schemas, admission, limits and fault harness bytes remain identical to baseline. New actual-entrypoint transport tests cover the changed HTTP behavior.',limitations:['All 23 exact HTTP/wire mappings checked against the independently transcribed frozen table and OpenAPI. Exceptional internal/output/deadline/unavailability paths retain controlled fault/projection evidence; they are not represented as current client-triggered semantic outcomes.']};
}

/** Connection bucket is independently witnessed below the separate 32-socket cap. */
export async function runConnectionRate(){
 const state=await launch(),sockets=[];const started=process.hrtime.bigint();
 try{
  await bounded(Promise.all(Array.from({length:24},()=>new Promise(resolveReady=>{const s=net.connect({host:'127.0.0.1',port});sockets.push(s);s.once('connect',resolveReady);s.once('error',resolveReady);}))),4000,'CONNECTION_BURST_TIMEOUT');
  await delay(100);const elapsedMs=Number(process.hrtime.bigint()-started)/1e6,admitted=sockets.filter(s=>!s.destroyed).length,rejected=24-admitted;
  assert.ok(admitted>0&&admitted<=20+Math.floor(elapsedMs/50));assert.ok(rejected>0,'NO_CONNECTION_RATE_REJECTION');
  for(const s of sockets)s.destroy();await delay(1100);assert.equal(response(await wire(request('getHealth'))).status,200);
  return [{id:'CONNECTION-RATE-burst',category:'resource-abuse',state:'PASS',offered:24,admitted,rejected,elapsedMs:Math.ceil(elapsedMs),burst:20,rate:20,connectionCap:32,evidenceMode:'actual TCP before TLS; below capacity cap'},
   {id:'CONNECTION-RATE-recovery',category:'resource-abuse',state:'PASS',status:200}];
 }finally{for(const s of sockets)s.destroy();await state.stop();}
}