/** Focused Phase 2A remote/configuration/TLS lifecycle witnesses on the physical Windows host. */
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {writeFileSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {networkInterfaces} from 'node:os';
import {randomBytes} from 'node:crypto';
import net from 'node:net';
import {setup,launch,request,wire,response,connect,delay,writeConfig,restrict,cache} from './harness.mjs';

const records=[],started=process.hrtime.bigint(),stage=await setup();
const staging={distributionManifestSha256:stage.manifestSha256,fileCount:stage.stagedFileCount,nodeVersion:process.version,platform:process.platform,architecture:process.arch};
const {validateBinding,loadConfig}=await import(pathToFileURL(resolve(stage.packageRoot,'src/config.mjs')));
const openssl='C:/Program Files/Git/usr/bin/openssl.exe';
// Sequential overwrites preserve this file's already verified owner-only ACL.
const rejectionConfigPath=await writeConfig(stage,'rejection',stage.config);
const duration=()=>Number((process.hrtime.bigint()-started)/1000000n);
const record=(id,actual={})=>{records.push({id,state:'PASS',actual});writeFileSync(resolve(cache,'remote-progress.json'),JSON.stringify({lastCase:id,completed:records.length,elapsedMs:duration()})+'\n');};
const code=(call,expected)=>assert.throws(call,error=>error.code==='MO1305_'+expected);
async function bounded(promise,ms,label){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label)),ms);})]);}finally{clearTimeout(timer);}}
async function cleanup(state){if(!state.exited){state.child.stdin.end();try{await bounded(state.exit,17000,'REMOTE_CLEANUP_TIMEOUT');}catch(error){state.child.kill();await state.exit;throw error;}}}
async function use(options,run){const state=await launch(stage,options);try{await run(state);}finally{await cleanup(state);}}
async function portOpen(host){return await new Promise(resolveProbe=>{const socket=net.connect({host,port:stage.port});let open=false;const timer=setTimeout(()=>socket.destroy(),250);socket.on('connect',()=>{open=true;socket.destroy();});socket.on('error',()=>{});socket.on('close',()=>{clearTimeout(timer);resolveProbe(open);});});}
async function rejected(id,config,{host='127.0.0.1'}={}){
 writeFileSync(rejectionConfigPath,JSON.stringify(config));
 const configPath=rejectionConfigPath,before=process.hrtime.bigint();
 const targets=[...new Set([host,'127.0.0.1',stage.address].filter(Boolean))];
 for(const target of targets)assert.equal(await portOpen(target),false,id+' preexisting listener');
 const state=await launch(stage,{configPath,observe:false,expectedStartup:false,validate:false});let probes=0;
 try{
  while(!state.exited){for(const target of targets){assert.equal(await portOpen(target),false,id+' unexpectedly listening');probes++;}if(Number((process.hrtime.bigint()-before)/1000000n)>10000)throw Error('STARTUP_REJECTION_TIMEOUT');await delay(10);}
  const exit=await state.exit;assert.equal(exit.code,2,id);assert.equal(state.stdout,'',id);for(const target of targets)assert.equal(await portOpen(target),false,id+' listener leak');
  const log=state.stderr.trim().split(/\r?\n/u).filter(Boolean).map(x=>JSON.parse(x));
  assert.deepEqual(log,[{code:'MO1305_UNAVAILABLE',event:'fatal',operationId:null,requestId:null}],id);
  assert.ok(!state.stderr.includes(stage.token));assert.ok(!state.stderr.includes(stage.privateRoot));
  record(id,{exitCode:2,listenerObserved:false,probes,secretSafeDiagnostic:true,elapsedMs:Number((process.hrtime.bigint()-before)/1000000n)});
 }finally{await cleanup(state);}
}
function command(args){const result=spawnSync(openssl,args,{encoding:'utf8',windowsHide:true,timeout:15000});assert.equal(result.status,0,'TLS fixture generation failed');}
async function privateFile(name,value){const path=resolve(stage.privateRoot,name);writeFileSync(path,value);await restrict(stage,[path]);return path;}

try{
 const synthetic=(address,prefix=24,extra={})=>({witness:[{family:'IPv4',internal:false,address,cidr:address+'/'+prefix,...extra}]});
 for(const address of ['10.0.0.1','10.255.255.254','172.16.0.1','172.31.255.254','192.168.0.1','192.168.255.254']){validateBinding('remote',address,synthetic(address));record('BIND-valid-'+address,{mode:'remote',syntheticInterface:true});}
 for(const [id,mode,address,interfaces,expected] of [
  ['unknown-mode','other','192.168.1.5',synthetic('192.168.1.5'),'REQUEST_SCHEMA'],
  ['missing-mode',undefined,'192.168.1.5',synthetic('192.168.1.5'),'REQUEST_SCHEMA'],
  ['local-remote-address','local','192.168.1.5',synthetic('192.168.1.5'),'FORBIDDEN'],
  ['network','remote','192.168.1.0',synthetic('192.168.1.0'),'FORBIDDEN'],
  ['broadcast','remote','192.168.1.255',synthetic('192.168.1.255'),'FORBIDDEN'],
  ['slash31','remote','192.168.1.5',synthetic('192.168.1.5',31),'FORBIDDEN'],
  ['slash32','remote','192.168.1.5',synthetic('192.168.1.5',32),'FORBIDDEN'],
  ['internal','remote','192.168.1.5',synthetic('192.168.1.5',24,{internal:true}),'FORBIDDEN'],
  ['no-cidr','remote','192.168.1.5',synthetic('192.168.1.5',24,{cidr:null}),'FORBIDDEN'],
  ['unassigned','remote','192.168.1.6',synthetic('192.168.1.5'),'FORBIDDEN'],
 ]){code(()=>validateBinding(mode,address,interfaces),expected);record('BIND-'+id,{rejected:true,syntheticInterface:true});}
 const defaults={...stage.config};delete defaults.mode;delete defaults.bindAddress;delete defaults.port;
 const defaultPath=await writeConfig(stage,'defaults.json',defaults),defaultConfig=loadConfig(defaultPath);
 assert.equal(defaultConfig.mode,'local');assert.equal(defaultConfig.bindAddress,'127.0.0.1');assert.equal(defaultConfig.port,13050);record('CONFIG-frozen-local-defaults',{mode:'local',bindAddress:'127.0.0.1',port:13050});
 const privateAddress=stage.address??'192.168.1.53';
 const assigned=new Set(Object.values(networkInterfaces()).flat().filter(x=>x.family==='IPv4').map(x=>x.address));
 const unassigned=Array.from({length:256},(_,i)=>'10.254.'+i+'.254').find(address=>!assigned.has(address));assert.ok(unassigned);
 for(const [id,value] of [
  ['remote-no-bind',{...stage.config,mode:'remote',bindAddress:undefined}],
  ['remote-without-opt-in',{...stage.config,mode:undefined,bindAddress:privateAddress}],
  ['unknown-mode',{...stage.config,mode:'REMOTE',bindAddress:privateAddress}],
  ['wildcard-v4',{...stage.config,mode:'remote',bindAddress:'0.0.0.0'}],
  ['wildcard-v6',{...stage.config,mode:'remote',bindAddress:'::'}],
  ['remote-v6',{...stage.config,mode:'remote',bindAddress:'fd00::1'}],
  ['public-v4',{...stage.config,mode:'remote',bindAddress:'8.8.8.8'}],
  ['loopback-remote',{...stage.config,mode:'remote',bindAddress:'127.0.0.1'}],
  ['unassigned-v4',{...stage.config,mode:'remote',bindAddress:unassigned}],
  ['noncanonical-v4',{...stage.config,mode:'remote',bindAddress:'192.168.001.053'}],
  ['dns',{...stage.config,mode:'remote',bindAddress:'localhost'}],
  ['missing-token',{...stage.config,tokenFile:resolve(stage.privateRoot,'missing.token')}],
  ['missing-certificate',{...stage.config,certificateFile:resolve(stage.privateRoot,'missing.crt')}],
  ['missing-key',{...stage.config,privateKeyFile:resolve(stage.privateRoot,'missing.key')}],
 ])await rejected('STARTUP-'+id,value);
 const badToken=await privateFile('bad-token','A'.repeat(64));await rejected('STARTUP-invalid-token',{...stage.config,tokenFile:badToken});
 const badCert=await privateFile('bad-cert.pem','-----BEGIN CERTIFICATE-----\nINVALID\n-----END CERTIFICATE-----\n');await rejected('TLS-invalid-certificate',{...stage.config,certificateFile:badCert});
 const badKey=await privateFile('bad-key.pem','-----BEGIN PRIVATE KEY-----\nINVALID\n-----END PRIVATE KEY-----\n');await rejected('TLS-invalid-key',{...stage.config,privateKeyFile:badKey});
 assert.ok(existsSync(openssl),'OPENSSL_REQUIRED');
 const mismatch=resolve(stage.privateRoot,'mismatched-key.pem');command(['genpkey','-algorithm','EC','-pkeyopt','ec_paramgen_curve:P-256','-out',mismatch]);await restrict(stage,[mismatch]);await rejected('TLS-mismatched-key',{...stage.config,privateKeyFile:mismatch});
 const noSAN=resolve(stage.privateRoot,'no-san.pem');command(['req','-new','-x509','-key',stage.config.privateKeyFile,'-out',noSAN,'-days','1','-subj','/CN=127.0.0.1']);await rejected('TLS-missing-IP-SAN',{...stage.config,certificateFile:noSAN});
 const wrongSAN=resolve(stage.privateRoot,'wrong-san.pem');command(['req','-new','-x509','-key',stage.config.privateKeyFile,'-out',wrongSAN,'-days','1','-subj','/CN=MO1305 lifecycle negative','-addext','subjectAltName=IP:127.0.0.2']);await rejected('TLS-mismatched-IP-SAN',{...stage.config,certificateFile:wrongSAN});
 const expired=resolve(stage.privateRoot,'expired-cert.pem');command(['x509','-in',stage.config.certificateFile,'-signkey',stage.config.privateKeyFile,'-not_before','20200101000000Z','-not_after','20210101000000Z','-out',expired]);await rejected('TLS-expired-certificate',{...stage.config,certificateFile:expired});
 await use({mode:'local',observe:false},async state=>{
  const result=response(await wire(stage,request(stage,'getReadiness')));assert.equal(result.status,200);assert.equal(result.body.ready,true);
  record('LOCAL-startup-readiness',{status:200,serverPid:state.child.pid,clientPid:process.pid});await state.stop();record('LOCAL-idle-shutdown',{exitCode:0});
 });
 if(!stage.address){records.push({id:'REMOTE-actual-RFC1918',state:'NOT_EXECUTED',actual:{reason:'NO_SUITABLE_ASSIGNED_RFC1918_IPV4',networkConfigurationChanged:false}});}
 else{
  const remoteConfig={...stage.config,mode:'remote',bindAddress:stage.address};
  for(const [id,value] of [['missing-token',{...remoteConfig,tokenFile:resolve(stage.privateRoot,'missing.token')}],['invalid-token',{...remoteConfig,tokenFile:badToken}],['missing-key',{...remoteConfig,privateKeyFile:resolve(stage.privateRoot,'missing.key')}],['invalid-certificate',{...remoteConfig,certificateFile:badCert}],['wrong-SAN',{...remoteConfig,certificateFile:wrongSAN}]])await rejected('REMOTE-STARTUP-'+id,value,{host:stage.address});
  await use({mode:'remote',observe:false},async state=>{
   const socket=connect(stage);assert.equal(await socket.ready,true);assert.equal(socket.socket.authorized,true);assert.equal(socket.socket.getProtocol(),'TLSv1.3');assert.equal(socket.socket.alpnProtocol,'http/1.1');
   const provenance={serverPid:state.child.pid,clientPid:process.pid,localAddress:socket.socket.localAddress,remoteAddress:socket.socket.remoteAddress,bindAddress:stage.address,tlsVersion:socket.socket.getProtocol(),alpn:socket.socket.alpnProtocol,authorized:socket.socket.authorized};
   assert.notEqual(provenance.serverPid,provenance.clientPid);assert.equal(provenance.remoteAddress,stage.address);assert.equal(provenance.localAddress,stage.address);
   socket.socket.write(request(stage,'getHealth'));await socket.done;assert.equal(response(socket.bytes).status,200);record('REMOTE-actual-RFC1918',provenance);
   assert.equal(await portOpen('127.0.0.1'),false);record('REMOTE-no-loopback-fallback',{loopbackListener:false});
   for(const operation of ['getReadiness','getContractIdentities']){const result=response(await wire(stage,request(stage,operation)));assert.equal(result.status,200);assert.equal(result.body.status,'ok');record('REMOTE-'+operation,{status:result.status});await delay(60);}
   for(const route of stage.api.routes){const result=response(await wire(stage,request(stage,route.operationId,route.method==='POST'?{}:null,{headers:{Authorization:null}})));assert.equal(result.status,401,route.operationId);assert.equal(result.body.error.code,'MO1305_UNAUTHENTICATED');record('REMOTE-auth-required-'+route.operationId,{status:401});await delay(60);}
   const alternate=randomBytes(32).toString('hex');assert.notEqual(alternate,stage.token);const unauthorized=response(await wire(stage,request(stage,'getHealth',null,{headers:{Authorization:'Bearer '+alternate}})));assert.equal(unauthorized.status,401);record('REMOTE-wrong-bearer',{status:401});
   const tls12=connect(stage,{tlsOptions:{minVersion:'TLSv1.2',maxVersion:'TLSv1.2'}});assert.equal(await tls12.ready,false);await bounded(tls12.done,3000,'TLS12_CLOSE_TIMEOUT');assert.equal(tls12.bytes.length,0);record('REMOTE-TLS12-refused',{httpBytes:0});
   const plain=connect(stage,{raw:true});assert.equal(await plain.ready,true);plain.socket.write(request(stage,'getHealth'));await bounded(plain.done,3000,'PLAINTEXT_CLOSE_TIMEOUT');assert.equal(plain.bytes.includes(Buffer.from('HTTP/1.1')),false);record('REMOTE-plaintext-refused',{httpResponse:false});
   const before=stage.token;writeFileSync(stage.config.tokenFile,alternate);
   try{
    assert.equal(response(await wire(stage,request(stage,'getHealth'))).status,200);assert.equal(response(await wire(stage,request(stage,'getHealth',null,{headers:{Authorization:'Bearer '+alternate}}))).status,401);record('REMOTE-token-held-until-restart',{oldTokenStatus:200,newTokenStatus:401});
    await state.stop();record('REMOTE-listener-shutdown',{exitCode:0});assert.equal(await portOpen(stage.address),false);
    const restarted=await launch(stage,{mode:'remote',observe:false});
    try{assert.equal(response(await wire(stage,request(stage,'getHealth'))).status,401);assert.equal(response(await wire(stage,request(stage,'getHealth',null,{headers:{Authorization:'Bearer '+alternate}}))).status,200);record('REMOTE-token-rotation-after-restart',{oldTokenStatus:401,newTokenStatus:200});await restarted.stop();}
    finally{await cleanup(restarted);}
   }finally{writeFileSync(stage.config.tokenFile,before);}
  });
  await use({mode:'remote',observe:false},async state=>{assert.equal(response(await wire(stage,request(stage,'getReadiness'))).status,200);await state.stop();record('REMOTE-repeat-rebind',{status:200,exitCode:0});});
 }
 const result={kind:'MemoryOSRESTPhase2ARemoteLifecycleResults',version:'1.0.0',state:'PASS',staging,elapsedMs:duration(),cases:records.length,passed:records.filter(x=>x.state==='PASS').length,notExecuted:records.filter(x=>x.state==='NOT_EXECUTED').length,remoteAddress:stage.address,networkConfigurationChanged:false,records};
 const raw=JSON.stringify(result);assert.ok(!raw.includes(stage.token));assert.ok(raw.length<131072);writeFileSync(resolve(cache,'remote-results.json'),raw+'\n');console.log(JSON.stringify({state:'PASS',cases:result.cases,passed:result.passed,notExecuted:result.notExecuted,elapsedMs:result.elapsedMs}));
}catch(error){writeFileSync(resolve(cache,'remote-failure.json'),JSON.stringify({kind:'MemoryOSRESTPhase2ARemoteLifecycleFailure',state:'FAIL',staging,elapsedMs:duration(),completed:records,code:error.code??null,message:String(error.message).replaceAll(stage.token,'REDACTED').slice(0,1024)})+'\n');throw error;}
