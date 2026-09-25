/** Reusable real-socket harness for focused Phase 2A lifecycle evidence. */
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import net from 'node:net';
import tls from 'node:tls';
import {root,cache,setup,writeConfig,restrict,trustedValidate,cleanEnvironment,sha256} from './setup.mjs';
import {clock,bounded,delay,armDeadline,cancelTimeout} from '../mo1305-phase1/clock.mjs';
export {root,cache,setup,writeConfig,restrict,trustedValidate,delay,bounded,clock};
export const api=JSON.parse(readFileSync(resolve(root,'repositories/memoryos-rest/contracts/api-contract.json'),'utf8'));
export const limits=JSON.parse(readFileSync(resolve(root,'repositories/memoryos-rest/contracts/limits.json'),'utf8'));
let fixtureCache;
export function vectors(){
 return fixtureCache??=JSON.parse(readFileSync(resolve(root,'repositories/cca-conformance/fixtures/mo1305-phase1/index.json'),'utf8')).files.map(row=>{
  const bytes=readFileSync(resolve(root,'repositories/cca-conformance/fixtures/mo1305-phase1',row.path));
  assert.equal(bytes.length,row.byteLength);assert.equal(sha256(bytes),row.sha256);return JSON.parse(bytes);
 });
}
export async function until(state,predicate,{timeout=15000,label='STATE_TIMEOUT'}={}){
 const deadline=clock.mono()+BigInt(timeout)*1000000n;
 while(!predicate(state)){if(state?.exited)throw Error('EARLY_EXIT '+JSON.stringify(state.exited));if(clock.mono()>=deadline)throw Error(label);await delay(10);}return state;
}
export async function launch(stage,{mode='local',observe=true,fault=null,configPath=null,entry=null,expectedStartup=true,validate=true}={}){
 if(configPath===null){
  assert.ok(mode==='local'||mode==='remote');if(mode==='remote')assert.ok(stage.address,'NO_ASSIGNED_RFC1918_ADDRESS');
  const config={...stage.config,...(mode==='remote'?{mode:'remote',bindAddress:stage.address}:{})};
  configPath=mode==='remote'?writeConfig(stage,'remote',config):stage.configPath;
 }
 // A malformed or missing config is deliberately left to product startup tests.
 try{const value=JSON.parse(readFileSync(configPath,'utf8'));stage.host=value.bindAddress??'127.0.0.1';stage.port=value.port??13050;}catch{stage.host=mode==='remote'?stage.address:'127.0.0.1';}
 if(validate)trustedValidate(stage,configPath);
 const script=entry??(observe?resolve(import.meta.dirname,'supervisor.mjs'):resolve(stage.packageRoot,'bin/memoryos-rest.mjs'));
 const args=observe?[script,stage.directory,configPath,fault??'none']:[script,'--config',configPath];
 const child=spawn(stage.node,args,{cwd:resolve(stage.directory,'empty'),windowsHide:true,env:cleanEnvironment(),stdio:['pipe','pipe','pipe',...(observe?['ipc']:[])]});
 const state={child,stdout:'',stderr:'',states:[],lifecycle:[],observations:[],messages:[],exited:null,launchError:null,startedNs:clock.mono().toString()};
 let overflow=null;
 const retain=(list,value)=>{if(list.length>=10000){overflow='OBSERVER_BACKLOG';child.kill();return;}list.push(value);};
 child.on('message',value=>{
  if(value?.type==='state')retain(state.states,value.record);
  else if(value?.type==='lifecycle')retain(state.lifecycle,value.record);
  else if(value?.type==='sample')retain(state.observations,value.record??value);
  else retain(state.messages,value);
 });
 child.stdout.on('data',bytes=>{state.stdout+=bytes;if(state.stdout.length>65536){overflow='STDOUT_BACKLOG';child.kill();}});
 child.stderr.on('data',bytes=>{state.stderr+=bytes;if(state.stderr.length>1048576){overflow='STDERR_BACKLOG';child.kill();}});
 child.on('error',error=>{state.launchError=error;});
 // "close" waits for both output streams, preserving the final shutdown diagnostics.
 state.exit=new Promise(done=>child.once('close',(code,signal)=>{state.exited={code,signal};state.closedNs=clock.mono().toString();done(state.exited);}));
 state.stop=async({expectedCode=0,timeout=17000}={})=>{
  child.stdin.end();
  const result=await bounded(state.exit,timeout,'PROCESS_SHUTDOWN_TIMEOUT',{onTimeout:()=>child.kill()});
  assert.equal(overflow,null);assert.equal(state.launchError,null);if(expectedCode!==null)assert.equal(result.code,expectedCode,'PROCESS_EXIT '+JSON.stringify(result)+' '+state.stderr.slice(-1000));
  assert.equal(state.stdout,'');return result;
 };
 state.send=message=>new Promise((done,fail)=>child.send(message,error=>error?fail(error):done()));
 if(expectedStartup){
  try{await until(state,s=>s.stderr.includes('"event":"startup"'),{timeout:15000,label:'PROCESS_STARTUP_TIMEOUT'});}
  catch(error){child.stdin.end();child.kill();await bounded(state.exit,5000,'STARTUP_CLEANUP_TIMEOUT');throw error;}
 }
 return state;
}
export function request(stage,operation,input=null,{headers={},method=null,path=null,host=stage.host}={}){
 const route=(stage.api??api).routes.find(r=>r.operationId===operation);assert.ok(route,'UNKNOWN_OPERATION');
 const body=input===null?'':Buffer.isBuffer(input)?input:typeof input==='string'?Buffer.from(input):Buffer.from(JSON.stringify(input));
 const fields={Host:host+':'+stage.port,Authorization:'Bearer '+stage.token,Connection:'close','Accept-Encoding':'identity',...headers};
 if(route.method==='POST'){fields['Content-Type']??='application/json';fields['Content-Length']??=String(Buffer.byteLength(body));}
 const head=Buffer.from(`${method??route.method} ${path??route.path} HTTP/1.1\r\n`+Object.entries(fields).filter(([,v])=>v!==null).map(([k,v])=>k+': '+v).join('\r\n')+'\r\n\r\n');
 return Buffer.concat([head,Buffer.from(body)]);
}
export function connect(stage,{host=stage.host,raw=false,tlsOptions={},collect=true,maximumBytes=131072}={}){
 const transport=net.connect({host,port:stage.port});transport.on('error',()=>{});
 const socket=raw?transport:tls.connect({socket:transport,host,ca:stage.ca,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',ALPNProtocols:['http/1.1'],...tlsOptions});
 const result={socket,transport,bytes:Buffer.alloc(0),closed:false,error:null,connected:false,protocol:null};
 socket.on('error',error=>{result.error=error;});
 if(collect)socket.on('data',bytes=>{result.bytes=Buffer.concat([result.bytes,bytes]);if(result.bytes.length>maximumBytes){result.error=Error('UNBOUNDED_RESPONSE');socket.destroy();}});
 result.ready=new Promise(done=>{socket.once(raw?'connect':'secureConnect',()=>{result.connected=true;result.protocol=raw?null:socket.getProtocol();done(true);});socket.once('close',()=>done(false));});
 result.done=new Promise(done=>socket.once('close',()=>{result.closed=true;done();}));
 return result;
}
export function wire(stage,chunks,{host=stage.host,end=false,timeout=12000,tlsOptions={},allowClose=false,raw=false}={}){
 if(!Array.isArray(chunks))chunks=[chunks];
 return new Promise((done,fail)=>{
  const connection=connect(stage,{host,raw,tlsOptions});let failure=null;
  const deadline=clock.mono()+BigInt(timeout)*1000000n;
  const timer=armDeadline(deadline,()=>{failure=Error('WIRE_TIMEOUT');connection.socket.destroy();});
  connection.done.then(()=>{cancelTimeout(timer);if(failure)fail(failure);else if(connection.error&&!allowClose)fail(connection.error);else done(connection.bytes);});
  connection.ready.then(async ready=>{
   if(!ready)return;
   try{for(const chunk of chunks){if(connection.closed)break;connection.socket.write(chunk);if(chunks.length>1)await delay(1);}if(end)connection.socket.end();}
   catch(error){failure=error;connection.socket.destroy();}
  });
 });
}
export function response(bytes,{head=false}={}){
 const split=bytes.indexOf('\r\n\r\n');assert.ok(split>=0,'MISSING_RESPONSE');
 const lines=bytes.subarray(0,split).toString('ascii').split('\r\n'),first=lines.shift(),status=Number(first.split(' ')[1]),headers={};
 assert.match(first,/^HTTP\/1\.1 [0-9]{3} /u);
 for(const line of lines){const colon=line.indexOf(':');assert.ok(colon>0);const name=line.slice(0,colon).toLowerCase();assert.ok(!Object.hasOwn(headers,name));headers[name]=line.slice(colon+1).trim();}
 const body=bytes.subarray(split+4);assert.equal(body.length,head?0:Number(headers['content-length']));
 for(const [name,value] of Object.entries(api.headers.response))assert.equal(headers[name],value);
 for(const name of ['date','server','transfer-encoding','content-encoding','access-control-allow-origin'])assert.ok(!Object.hasOwn(headers,name));
 return {status,headers,body:head?null:JSON.parse(body),bytes:body};
}
