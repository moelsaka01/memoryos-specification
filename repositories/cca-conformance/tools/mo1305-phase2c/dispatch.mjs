import assert from 'node:assert/strict';
import tls from 'node:tls';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
import {root,stage,port,nodePath,powershell,clean,checked,bounded,credentials,request,response,wire,vectors,limits,delay,sha,reference,launchHistory} from './common.mjs';

const witnesses=()=>[
  ['dispatch-framing',request('getHealth').toString().replace('GET ','get '),400,'REQUEST_SYNTAX'],
  ['dispatch-duplicate-host',request('getHealth').toString().replace('\r\n\r\n','\r\nHost: attacker\r\n\r\n'),400,'REQUEST_SYNTAX'],
  ['dispatch-transfer-encoding',request('preparePolicy','{}',{headers:{'Transfer-Encoding':'chunked'}}),400,'REQUEST_SYNTAX'],
  ['dispatch-missing-auth',request('preparePolicy','{}',{headers:{Authorization:null}}),401,'UNAUTHENTICATED'],
  ['dispatch-missing-host',request('preparePolicy','{}',{headers:{Host:null}}),403,'FORBIDDEN'],
  ['dispatch-missing-host-and-auth',request('preparePolicy','{}',{headers:{Authorization:null,Host:null}}),401,'UNAUTHENTICATED'],
  ['dispatch-forwarded',request('preparePolicy','{}',{headers:{Forwarded:'for=127.0.0.1'}}),403,'FORBIDDEN'],
  ['dispatch-content-encoding',request('preparePolicy','{}',{headers:{'Content-Encoding':'gzip'}}),415,'UNSUPPORTED_MEDIA'],
  ['dispatch-accept',request('preparePolicy','{}',{headers:{Accept:'text/plain'}}),406,'NOT_ACCEPTABLE'],
  ['dispatch-body-limit',request('preparePolicy',' '.repeat(limits.measured.operations.preparePolicy.requestBytes+1)),413,'INPUT_LIMIT'],
  ['dispatch-json-syntax',request('preparePolicy','{"x":1,"x":2}'),400,'REQUEST_SYNTAX'],
  ['dispatch-json-depth',request('preparePolicy','['.repeat(limits.fixed.jsonDepth+1)+'0'+']'.repeat(limits.fixed.jsonDepth+1)),413,'INPUT_LIMIT'],
  ['dispatch-schema',request('preparePolicy','{"policyBase64":"e30=","unknown":true}'),400,'REQUEST_SCHEMA'],
  ['dispatch-filesystem',request('preparePolicy',{policyPath:'C:\\Windows\\win.ini'}),400,'REQUEST_SCHEMA'],
  ['dispatch-uri',request('preparePolicy',{url:'http://169.254.169.254/latest/meta-data'}),400,'REQUEST_SCHEMA'],
  ['dispatch-base64',request('preparePolicy',{policyBase64:'file:///C:/secret'}),400,'REQUEST_SCHEMA'],
  ['dispatch-route',request('getHealth',null,{path:'/v1/execute'}),404,'NOT_FOUND'],
  ['dispatch-method',request('getHealth',null,{method:'OPTIONS'}),405,'METHOD_NOT_ALLOWED']
];
export const dispatchCaseCatalog=[
  ...['framing','duplicate-host','transfer-encoding','missing-auth','missing-host','missing-host-and-auth','forwarded','content-encoding','accept','body-limit','json-syntax','json-depth','schema','filesystem','uri','base64','route','method'].map(id=>({id:'dispatch-'+id,category:'dispatch-observation'})),
  {id:'dispatch-valid-semantic-positive',category:'dispatch-observation'},
  ...[3,4,5].map(n=>({id:'write-slots-attempt-'+n,category:'resource-abuse'})),
  {id:'write-slots-release-recovery',category:'resource-abuse'}
];
export async function runDispatch(){
  const records=[],pass=(id,category,details)=>records.push({id,category,state:'PASS',...details});
  const state=await observedLaunch('dispatch');
  try{
    assert.equal((await state.snapshot()).created,0);
    for(const [id,raw,status,code] of witnesses()){
      await delay(60);const before=await state.snapshot();
      const result=response(await wire(raw));assert.equal(result.status,status,id);assert.equal(result.body.error.code,'MO1305_'+code,id);
      const after=await state.snapshot();assert.equal(after.created,before.created,id);assert.equal(after.created,0,id);
      pass(id,'dispatch-observation',{status,code:'MO1305_'+code,workerCreations:0,evidenceType:'SUPPLEMENTAL_WORKER_CONSTRUCTOR_OBSERVATION'});
    }
    const vector=vectors().find(v=>v.id==='prepare-policy-pass');
    await delay(60);const result=response(await wire(request(vector.operation,vector.input)));assert.deepEqual(result.body,vector.expected);
    const after=await state.snapshot();assert.equal(after.created,1);assert.equal(after.reaped,1);
    pass('dispatch-valid-semantic-positive','dispatch-observation',{status:200,workerCreations:1,workerReaps:1,semanticFixture:vector.id,bodySha256:sha(result.bytes),evidenceType:'SUPPLEMENTAL_WORKER_CONSTRUCTOR_OBSERVATION'});
  }finally{await state.stop();}

  const writes=await observedLaunch('write-hold'),clients=[];
  try{
    for(let attempt=1;attempt<=limits.fixed.writeSlots+1;attempt++){
      const client=heldClient(request('getHealth',null,{headers:{Authorization:null}}));clients.push(client);
      const outcome=await bounded(client.complete,3000,'CONTROLLED_WRITE_RESPONSE_TIMEOUT');
      const observed=await writes.snapshot();
      if(attempt<=limits.fixed.writeSlots){
        assert.equal(outcome.closed,false);assert.equal(response(outcome.bytes).status,401);assert.equal(client.socket.destroyed,false);
        assert.equal(observed.heldWrites,attempt);
      }else{assert.equal(outcome.closed,true);assert.equal(outcome.bytes.length,0);assert.equal(observed.heldWrites,limits.fixed.writeSlots);}
      assert.equal(observed.created,0);
      if(attempt>=limits.fixed.writeSlots-1)pass('write-slots-attempt-'+attempt,'resource-abuse',{limit:limits.fixed.writeSlots,attempted:attempt,heldWrites:observed.heldWrites,status:attempt<=limits.fixed.writeSlots?401:null,httpBytes:outcome.bytes.length,workerCreations:0,evidenceType:'CONTROLLED_TLS_WRITE_CALLBACK_HOLD'});
      await delay(60);
    }
    const released=await writes.snapshot('release');assert.equal(released.heldWrites,0);assert.equal(released.writeCompletions,limits.fixed.writeSlots);
    await Promise.all(clients.map(c=>bounded(c.closed,2000,'CONTROLLED_WRITE_RELEASE_TIMEOUT')));
    await delay(60);assert.equal(response(await wire(request('getHealth'))).status,200);
    pass('write-slots-release-recovery','resource-abuse',{status:200,released:released.writeCompletions,evidenceType:'CONTROLLED_TLS_WRITE_CALLBACK_HOLD'});
  }finally{for(const client of clients)client.socket.destroy();await writes.stop();}
  assert.deepEqual(records.map(({id,category})=>({id,category})),dispatchCaseCatalog);
  return {records,limitations:[
    'Supplemental instrumentation loads the actual production entrypoint but wraps Worker construction; ordinary uninstrumented transport receipts remain the primary release evidence.',
    'The Worker subclass forwards the identical entry/options to the actual Node Worker; no worker, semantic implementation, permissions, limits, or product bytes are substituted.',
    'Write-slot witnesses hold actual TLS Writable completion callbacks after transmitting unchanged error bytes. This is a controlled stream-boundary test, not a claim that natural Windows socket backpressure deterministically occupies four slots.',
    'Worker creation counters are harness-private IPC integers and never include requests, credentials, bodies, paths, or semantic artifacts.'
  ],provenance:{observer:reference('repositories/cca-conformance/tools/mo1305-phase2c/dispatch-server.mjs'),productionEntrypoint:reference('repositories/memoryos-rest/bin/memoryos-rest.mjs'),workerEntrypoint:reference('repositories/memoryos-rest/src/worker.mjs')}};
}
async function observedLaunch(mode){
  assert.equal(checked(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resolve(root,'repositories/cca-conformance/tools/mo1305-phase1/validate-launch.ps1'),'-NodePath',nodePath,'-ConfigPath',resolve(stage,'private/config.json')]).trim(),'MO1305_TRUSTED_LAUNCH_PRECONDITIONS_PASS');
  const child=spawn(nodePath,[resolve(import.meta.dirname,'dispatch-server.mjs'),stage,mode],{cwd:resolve(stage,'empty'),env:clean,windowsHide:true,stdio:['pipe','pipe','pipe','ipc']});
  const launchRecord={pid:child.pid,entry:'dispatch-server.mjs -> package/bin/memoryos-rest.mjs',launchMode:'production-forwarding-observer',started:false,exitCode:null,signal:null};launchHistory.push(launchRecord);
  child.once('exit',(code,signal)=>{launchRecord.exitCode=code;launchRecord.signal=signal;});
  let stdout='',stderr='',ticket=0,pending=null;
  child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>{stderr+=b;if(stderr.length>65536)child.kill();});
  const exit=new Promise((resolveExit,reject)=>{child.once('error',reject);child.once('exit',(code,signal)=>resolveExit({code,signal}));});
  child.on('message',message=>{assert.equal(message.type,'snapshot');assert.ok(pending);assert.equal(message.ticket,pending.ticket);const resolvePending=pending.resolve;pending=null;resolvePending(message);});
  try{await bounded(new Promise((r,j)=>{child.stderr.on('data',()=>{if(stderr.includes('"event":"startup"'))r();});exit.then(value=>j(Error('OBSERVER_EARLY_EXIT_'+value.code)),j);}),15000,'OBSERVER_STARTUP_TIMEOUT');}catch(error){child.kill();throw error;}
  launchRecord.started=true;
  return {child,async snapshot(type='snapshot'){
    assert.equal(pending,null);const current=++ticket;
    return bounded(new Promise(resolvePending=>{pending={ticket:current,resolve:resolvePending};child.send({type,ticket:current});}),2000,'OBSERVER_SNAPSHOT_TIMEOUT');
  },async stop(){child.stdin.end();let result;try{result=await bounded(exit,17000,'OBSERVER_SHUTDOWN_TIMEOUT');}catch(error){child.kill();throw error;}assert.equal(result.code,0);assert.equal(stdout,'');assert.equal(stderr.includes(credentials.token),false);}};
}
function heldClient(raw){
  const socket=tls.connect({host:'127.0.0.1',port,ca:credentials.ca,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',ALPNProtocols:['http/1.1']});
  let received=Buffer.alloc(0),resolveComplete,finished=false;
  const complete=new Promise(r=>resolveComplete=r),closed=new Promise(r=>socket.once('close',r));
  socket.on('error',()=>{});
  socket.on('data',bytes=>{
    received=Buffer.concat([received,bytes]);assert.ok(received.length<=4096);
    const split=received.indexOf('\r\n\r\n');if(split<0)return;
    const match=/\r\ncontent-length: (\d+)\r\n/iu.exec(received.subarray(0,split+4).toString());
    if(match&&received.length===split+4+Number(match[1])&&!finished){finished=true;resolveComplete({closed:false,bytes:received});}
  });
  socket.once('close',()=>{if(!finished){finished=true;resolveComplete({closed:true,bytes:received});}});
  socket.once('secureConnect',()=>socket.write(raw));
  return {socket,complete,closed};
}
