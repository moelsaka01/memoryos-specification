import {clock,monoMs,elapsedNs,wallObservation,failureEvidence,relation,protocolVersion} from './clock.mjs';
import {projectBarrier} from './sample-proof.mjs';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import tls from 'node:tls';import net from 'node:net';
import {mkdirSync,writeFileSync,readFileSync,existsSync} from 'node:fs';import {resolve} from 'node:path';
import {trustedValidationBroker,launch,stage,root,credentials,request,response,wire,delay,vectors} from './installed.mjs';
import {monitor,osSummary,stateSummary} from './monitor.mjs';import {J} from '../../../memoryos-rest/src/serialization.mjs';
const campaignId=randomUUID();
const identity=path=>{const bytes=readFileSync(path);return {path:path.replace(root+'\\','').replaceAll('\\','/'),byteLength:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};};
const binding={sourceTreeSha256:JSON.parse(readFileSync(resolve(stage,'package/dependency-manifest.json'))).sourceTreeSha256,archive:identity(resolve(root,'.cache/mo1305-resume/build/memoryos-rest-0.1.0.tgz'))};
const validationBroker=trustedValidationBroker();
assert.equal(process.argv[2],'bounded','OBSOLETE_LONG_ADVERSE_CAMPAIGN_DISABLED');
const plan=JSON.parse(readFileSync(resolve(root,process.argv[3])));assert.equal(plan.kind,'MemoryOSRESTBoundedAdversePlan');
const full=plan.layer==='stress',duration=plan.durationMs,repetitions=plan.repetitions;
assert.ok(['adverse-functional','stress','stress-confirmation'].includes(plan.layer));assert.ok(duration>=3000&&duration<=20000&&repetitions>=1&&repetitions<=3);
if(plan.layer==='adverse-functional'){assert.equal(duration,3000);assert.equal(repetitions,1);assert.equal(plan.cases.length,20);}else{assert.ok(plan.cases.length<=10);}
assert.ok(plan.output.startsWith('repositories/cca-conformance/evidence/mo1305-phase1-r6/')&&!plan.output.includes('..'));
const output=resolve(root,plan.output);assert.ok(!existsSync(output),'ADVERSE_OUTPUT_ALREADY_EXISTS');mkdirSync(output,{recursive:true});
const rawOutput=resolve(root,'.cache/mo1305-bounded-r6',plan.layer+'-raw');mkdirSync(rawOutput,{recursive:true});
const limits=JSON.parse(readFileSync(resolve(stage,'package/contracts/limits.json'))),maximum=vectors().find(v=>v.id==='max-mip-policy');
const completeCatalog=['idle-tls-32','handshaking-32','slow-header-32','body-buffers-4','worker-and-operational-3','request-flood','connection-flood','slow-body','blocked-writers-4','paused-readers-4',...['handshake','header','body','running','published'].flatMap(x=>['cancel-'+x,'shutdown-'+x])];
const catalog=completeCatalog.filter(name=>plan.cases.includes(name));assert.equal(catalog.length,plan.cases.length);assert.equal(new Set(plan.cases).size,plan.cases.length);
const executionDeadline=clock.mono()+BigInt(plan.maximumRunMs)*1000000n;
let id=0;
function connect(raw=false){const transport=net.connect({host:'127.0.0.1',port:13050});transport.on('error',()=>{});const socket=raw?transport:tls.connect({socket:transport,host:'127.0.0.1',ca:credentials.ca,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',ALPNProtocols:['http/1.1']});const result={socket,transport,created:monoMs(),closed:false,bytes:Buffer.alloc(0),id:id++};socket.on('error',()=>{});socket.on('data',b=>{result.bytes=Buffer.concat([result.bytes,b]);assert.ok(result.bytes.length<131072);});result.ready=new Promise(r=>{socket.once(raw?'connect':'secureConnect',()=>r(true));socket.once('close',()=>r(false));});result.done=new Promise(r=>socket.once('close',()=>{result.closed=true;r();}));return result;}
function retain(record,state){if(record.type==='sample'){state.observations.length=0;}}
async function open(kind){const c=connect(kind==='handshake');if(!await c.ready)return c;
 if(kind==='header')c.socket.write('GET /v1/health HTTP/1.1\r\n');
 if(kind==='body')c.socket.write(request('evaluatePolicy',' ',{headers:{'Content-Length':String(limits.measured.operations.evaluatePolicy.requestBytes)}}));
 if(kind==='running')c.socket.write(request(maximum.operation,maximum.input));
 if(kind==='published')c.socket.write(request('getHealth'));return c;
}
async function observe(state,predicate,ms=3000){const deadline=clock.mono()+BigInt(ms)*1000000n;while(clock.mono()<deadline){if(state.states.some(predicate))return true;await delay(10);}relation('ADVERSE_STATE_TIMEOUT','<','observedNs',clock.mono(),'deadlineNs',deadline,{units:'ns',domain:clock.domain});}
async function execute(name,repeat){
 relation('TASK_STRESS_BUDGET','<','nowNs',clock.mono(),'stopNs',executionDeadline-65000000000n,{units:'ns',domain:clock.domain});
 const started=clock.stamp(),cycles=[],runs=[],allSamples=[],allStates=[],allOS=[],counts={requests:0,rejected:0,cancelled:0,cycles:0};let current=null,os=null,pre=null,post=null,held=[];
 async function start(){current=await launch({validationBroker,measurement:true,args:name.includes('published')||name==='blocked-writers-4'?[resolve(import.meta.dirname,'write-fault-server.mjs'),stage]:null});current.child.on('message',value=>{if(value.type==='sample'){allSamples.push({...value.record,operationTiming:value.operationTiming??null,provenance:{campaignId,sessionId:os.identity.sessionId,pid:current.child.pid,observed:clock.stamp()}});current.observations.length=0;}});os=await monitor(current.child,resolve(rawOutput,name+'-'+repeat+'-'+counts.cycles+'.json'),{candidateId:binding.sourceTreeSha256,archiveSha256:binding.archive.sha256,campaignId});pre=await os.barrier();post=null;}
 async function recordRun(){await os.stop();const {sessionId,pid,collectorPid,rawPath,candidateId,archiveSha256,campaignId}=os.identity;const native=JSON.parse(readFileSync(rawPath));runs.push({sessionId,pid,collectorPid,candidateId,archiveSha256,campaignId,pre:projectBarrier(pre),post:projectBarrier(post),processStartedUtcMs:native.processStartedUtcMs,exitCode:0,collectorExitCode:0,raw:identity(rawPath)});}
 async function cleanup(){for(const c of held)c.socket.destroy();await Promise.all(held.map(c=>c.done));held=[];await delay(100);if(current){post=await os.barrier();await current.stop();await recordRun();allStates.push(...current.states);allOS.push(...os.rows);current=null;os=null;}}
 try{
  await start();const adverseStart=clock.stamp(),deadline=BigInt(adverseStart.ns)+BigInt(duration)*1000000n;
  if(name.startsWith('cancel-')||name.startsWith('shutdown-')){
   const action=name.split('-')[0],kind=name.slice(action.length+1);
   while(clock.mono()<deadline){if(!current)await start();allStates.push(...current.states);current.states.length=0;const c=await open(kind);held.push(c);counts.requests++;
    if(kind==='running')assert.ok(await observe(current,s=>s.workers===1));else if(kind==='published')assert.ok(await observe(current,s=>s.writeSlots===1));else await delay(50);
    if(action==='cancel'){c.transport.resetAndDestroy();await c.done;counts.cancelled++;await delay(100);}
    else{post=await os.barrier();const before=monoMs();await current.stop();const exitMs=Math.ceil(monoMs()-before);relation('ADVERSE_SHUTDOWN_BOUND','<','exitMs',exitMs,'maximumMs',15200,{units:'ms',domain:clock.domain});cycles.push({exitMs,state:'PASS'});await recordRun();allStates.push(...current.states);allOS.push(...os.rows);current=null;os=null;await c.done;held=[];}
    counts.cycles++;await delay(60);
   }
  }else if(name==='worker-and-operational-3'){
   while(clock.mono()<deadline){current.states.length=0;const c=await open('running');held.push(c);assert.ok(await observe(current,s=>s.workers===1));
    const results=await Promise.all(['getHealth','getVersion','getReadiness'].map(async operation=>response(await wire(request(operation)))));
    assert.equal(results[0].status,200);assert.equal(results[1].status,200);assert.equal(results[2].body.error.code,'MO1305_BUSY');await c.done;assert.deepEqual(response(c.bytes).body,maximum.expected);counts.requests+=4;held=[];counts.cycles++;allStates.push(...current.states);current.states.length=0;await delay(60);
   }
  }else if(name==='request-flood'){
   while(clock.mono()<deadline){for(let i=0;i<32;i++){const c=connect();await c.ready;held.push(c);await delay(55);}for(let offset=0;offset<held.length;offset+=4){const batch=held.slice(offset,offset+4);for(const c of batch)if(!c.closed)c.socket.write(request('getHealth',null,{headers:{Authorization:null}}));await Promise.all(batch.map(c=>c.done));}for(const c of held)if(c.bytes.length){const r=response(c.bytes);assert.ok([401,429].includes(r.status));if(r.status===429)counts.rejected++;}counts.requests+=held.length;held=[];counts.cycles++;}
  }else if(name==='connection-flood'){
   while(clock.mono()<deadline){const clients=Array.from({length:48},()=>connect(true));await Promise.all(clients.map(c=>c.ready));for(const c of clients)c.socket.destroy();await Promise.all(clients.map(c=>c.done));counts.requests+=48;counts.cycles++;await delay(50);}
  }else{
   const maximumHeld=name.endsWith('-32')?32:name==='slow-body'?1:4;
   while(clock.mono()<deadline){held=held.filter(c=>!c.closed);if(held.length<maximumHeld){const kind=name==='handshaking-32'?'handshake':name==='slow-header-32'?'header':name==='body-buffers-4'||name==='slow-body'?'body':name.includes('writers')||name.includes('readers')?'published':'idle';const c=await open(kind);if(name==='paused-readers-4')c.socket.pause();held.push(c);counts.requests++;await delay(55);}
    else await delay(50);
    for(const c of held){const age=monoMs()-c.created;if(name==='slow-body'||name==='slow-header-32'){const second=Math.floor(age/1000);if(second>(c.lastSecond??0)){c.lastSecond=second;c.socket.write(' ');}}if(name==='paused-readers-4'&&age>11000){c.socket.destroy();counts.cancelled++;}}
   }
  }
  const adverseEnd=clock.stamp(),adverseElapsedMs=Number((elapsedNs(adverseStart,adverseEnd)+999999n)/1000000n);relation('ADVERSE_DURATION_MINIMUM','>=','adverseElapsedMs',adverseElapsedMs,'requiredMs',duration,{units:'ms',domain:clock.domain});await cleanup();const parent=stateSummary(allStates),native=osSummary(allOS);
  assert.ok(parent.peak.workers<=1);assert.ok(parent.peak.semanticOwners<=1);assert.ok(parent.peak.connections<=32);assert.ok(parent.peak.requestSlots<=4);assert.ok(parent.peak.writeSlots<=4);
  if(full){if(name.endsWith('-32'))assert.equal(parent.peak.connections,32);if(name==='body-buffers-4')assert.equal(parent.peak.bodyBufferBytes,4*limits.measured.operations.evaluatePolicy.requestBytes);if(name==='blocked-writers-4')assert.equal(parent.peak.writeSlots,4);if(name==='request-flood')assert.ok(counts.rejected>0);}
  const record={kind:'MemoryOSRESTAdverseRepetition',protocolVersion,campaignId,binding,runs,name,repeat,timing:{start:adverseStart,end:adverseEnd,wall:wallObservation(adverseStart,adverseEnd)},state:'PASS',requiredMs:duration,adverseElapsedMs,totalElapsedMs:Number((elapsedNs(started,clock.stamp())+999999n)/1000000n),counts,cycles,parent,native,operationSamples:allSamples,mechanism:name.includes('published')||name==='blocked-writers-4'?'actual TLS with controlled Writable completion withholding':'actual TCP/TLS clients',lifecycleAtomicBoundaryNote:'reserved and ready are synchronous non-yielding phases; controlled Ownership unit witnesses supplement asynchronous socket races'};
  const bytes=Buffer.from(J(record));assert.ok(bytes.length<=2097152);writeFileSync(resolve(output,name+'-'+repeat+'.json'),bytes);console.log(JSON.stringify({name,repeat,state:'PASS',adverseElapsedMs,requests:counts.requests,peak:parent.peak}));return record;
 }catch(error){const failure=failureEvidence(error,{case:name,phase:'adverse',index:repeat,candidateId:binding.sourceTreeSha256,campaignId,runId:os?.identity.sessionId??null,pid:current?.child.pid??null,captureTicket:os?.rows.at(-1)?.ticket??null,sequence:os?.rows.at(-1)?.sequence??null,pre,post,observed:clock.stamp(),counts,cycles,runs,operationSamples:allSamples});writeFileSync(resolve(output,name+'-'+repeat+'-failed.json'),J(failure));try{if(current)await cleanup();}catch(cleanupError){writeFileSync(resolve(output,name+'-'+repeat+'-cleanup-failed.json'),J(failureEvidence(cleanupError,{case:name,phase:'adverse',index:repeat})));}throw error;}
}
try{const records=[];for(const name of catalog)for(let repeat=0;repeat<repetitions;repeat++){records.push(await execute(name,repeat));writeFileSync(resolve(output,'index.json'),J({kind:'MemoryOSRESTAdverseCampaign',campaignId,binding,mode:plan.layer,methodologyVersion:'2.0.0',state:'RUNNING',requiredRepetitions:repetitions,requiredMs:duration,catalog,completed:records.map(r=>({name:r.name,repeat:r.repeat,state:r.state}))}));}
writeFileSync(resolve(output,'index.json'),J({kind:'MemoryOSRESTAdverseCampaign',campaignId,binding,mode:plan.layer,methodologyVersion:'2.0.0',state:'PASS',requiredRepetitions:repetitions,requiredMs:duration,catalog,completed:records.map(r=>({name:r.name,repeat:r.repeat,state:r.state}))}));

}catch(error){const previous=existsSync(resolve(output,'index.json'))?JSON.parse(readFileSync(resolve(output,'index.json'))):{campaignId,binding,catalog,completed:[]};writeFileSync(resolve(output,'index.json'),J({...previous,state:'FAIL',failure:failureEvidence(error)}));throw error;}finally{await validationBroker.stop();}
