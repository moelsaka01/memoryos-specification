import {scheduleTimeout as setTimeout,cancelTimeout as clearTimeout,bounded,clock,armDeadline,relation} from './clock.mjs';
import {spawn,spawnSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import tls from 'node:tls';
import {createInterface} from 'node:readline';
import assert from 'node:assert/strict';
export const root=resolve(import.meta.dirname,'../../../..');
export const stage=readFileSync(resolve(root,'.cache/mo1305-resume/installed-path.txt'),'utf8');
let fixtureCache=null;
export const vectors=()=>fixtureCache??=(JSON.parse(readFileSync(resolve(root,'repositories/cca-conformance/fixtures/mo1305-phase1/index.json'))).files.map(row=>{const bytes=readFileSync(resolve(root,'repositories/cca-conformance/fixtures/mo1305-phase1',row.path));assert.equal(bytes.length,row.byteLength);assert.equal(createHash('sha256').update(bytes).digest('hex'),row.sha256);return JSON.parse(bytes);}));
export const api=JSON.parse(readFileSync(resolve(stage,'package/contracts/api-contract.json'),'utf8'));
export const credentials={token:readFileSync(resolve(stage,'private/token'),'ascii'),ca:readFileSync(resolve(stage,'private/cert.pem'))};
export async function launch({environment={},args=null,measurement=false,auditYoung=null,validationBroker=null}={}){
 const clean={SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,TEMP:process.env.TEMP,TMP:process.env.TMP};
 if(validationBroker){assert.equal(Object.keys(environment).length,0);await validationBroker.check();}else{
 const acl=spawnSync('C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe',['-NoLogo','-NoProfile','-NonInteractive','-File',resolve(import.meta.dirname,'validate-launch.ps1'),'-NodePath',process.execPath,'-ConfigPath',resolve(stage,'private/config.json')],{encoding:'utf8',windowsHide:true,timeout:15000,env:{...clean,...environment}});
 assert.equal(acl.status,0,'TRUSTED_LAUNCH_REFUSED '+acl.stdout);
 }
 const script=measurement?resolve(import.meta.dirname,auditYoung===null?'measure-server.mjs':'audit-server.mjs'):resolve(stage,'package/bin/memoryos-rest.mjs');
 const child=spawn(process.execPath,args??[script,...(measurement?[stage,...(auditYoung===null?[]:[String(auditYoung)])]:['--config',resolve(stage,'private/config.json')])],{cwd:resolve(stage,'empty'),windowsHide:true,
   env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,TEMP:process.env.TEMP,TMP:process.env.TMP,...environment},stdio:['pipe','pipe','pipe',...(measurement?['ipc']:[])]});
 const state={child,stdout:'',stderr:'',observations:[],audit:[],states:[],headers:[],exit:null};
 child.on('message',value=>{if(value.type==='headers'){if(state.headers.length>=1000)throw Error('HEADERS_BACKLOG');state.headers.push(value.record);return;}if(value.type==='state'){if(state.states.length>=20000)throw Error('STATE_BACKLOG');state.states.push(value.record);return;}if(value.type==='audit'){if(state.audit.length>=10000)throw Error('AUDIT_BACKLOG');state.audit.push(value.record);return;}if(state.observations.length>=8)throw Error('MEASUREMENT_BACKLOG');state.observations.push(value);});
 child.stdout.on('data',bytes=>{state.stdout+=bytes;if(state.stdout.length>65536)child.kill();});
 child.stderr.on('data',bytes=>{state.stderr+=bytes;if(state.stderr.length>1048576)child.kill();});
 state.exit=new Promise(resolve=>child.once('exit',(code,signal)=>resolve({code,signal})));
 state.stop=async()=>{child.stdin.end();const result=await bounded(state.exit,17000,'PROCESS_SHUTDOWN_TIMEOUT',{onTimeout:()=>child.kill()});assert.equal(result.code,0,JSON.stringify(result)+' '+state.stderr.slice(-1000));assert.equal(state.stdout,'');return result;};
 await bounded(new Promise((resolve,reject)=>{child.stderr.on('data',()=>{if(state.stderr.includes('"event":"startup"'))resolve();});state.exit.then(({code})=>reject(Error('EARLY_EXIT '+code)));}),15000,'PROCESS_STARTUP_TIMEOUT',{onTimeout:()=>child.kill()});
 return state;
}
export function request(operation,input=null,{headers={},method=null,path=null}={}){
 const route=api.routes.find(r=>r.operationId===operation), body=input===null?'':typeof input==='string'?input:JSON.stringify(input);
 const fields={Host:'127.0.0.1:13050',Authorization:'Bearer '+credentials.token,Connection:'close','Accept-Encoding':'identity',...headers};
 if(route.method==='POST'){fields['Content-Type']??='application/json';fields['Content-Length']??=String(Buffer.byteLength(body));}
 return Buffer.from(`${method??route.method} ${path??route.path} HTTP/1.1\r\n`+Object.entries(fields).filter(([,v])=>v!==null).map(([k,v])=>k+': '+v).join('\r\n')+'\r\n\r\n'+body);
}
export function wire(chunks,{end=false,timeout=12000,tlsOptions={},allowClose=false}={}){
 if(!Array.isArray(chunks))chunks=[chunks];
 return new Promise((resolve,reject)=>{
  const socket=tls.connect({host:'127.0.0.1',port:13050,ca:credentials.ca,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',ALPNProtocols:['http/1.1'],...tlsOptions});let result=Buffer.alloc(0),failure=null;
  const started=clock.stamp(),deadline=BigInt(started.ns)+BigInt(timeout)*1000000n;
  const timer=armDeadline(deadline,()=>{try{relation('WIRE_TIMEOUT','<','observedNs',clock.mono(),'deadlineNs',deadline,{units:'ns',domain:clock.domain});}catch(error){failure=error;}socket.destroy();});
  socket.on('error',error=>{failure=error;});
  socket.on('data',bytes=>{result=Buffer.concat([result,bytes]);if(result.length>131072){failure=Error('UNBOUNDED_RESPONSE');socket.destroy();}});
  socket.once('close',()=>{clearTimeout(timer);if(failure&&!allowClose)return reject(failure);resolve(result);});
  socket.once('secureConnect',async()=>{for(const chunk of chunks){if(socket.destroyed)break;socket.write(chunk);if(chunks.length>1)await new Promise(r=>setTimeout(r,1));}if(end)socket.end();});
 });
}
export function response(bytes,{head=false}={}){
 const split=bytes.indexOf('\r\n\r\n');assert.ok(split>=0,'MISSING_RESPONSE '+bytes.toString());
 const lines=bytes.subarray(0,split).toString('ascii').split('\r\n'), status=Number(lines.shift().split(' ')[1]), headers={};
 for(const line of lines){const i=line.indexOf(':');const name=line.slice(0,i).toLowerCase();assert.ok(!Object.hasOwn(headers,name));headers[name]=line.slice(i+1).trim();}
 const body=bytes.subarray(split+4);assert.equal(body.length,head?0:Number(headers['content-length']));
 for(const [name,value] of Object.entries(api.headers.response))assert.equal(headers[name],value);
 for(const key of ['date','server','transfer-encoding','content-encoding','access-control-allow-origin'])assert.ok(!Object.hasOwn(headers,key));
 return {status,headers,body:head?null:JSON.parse(body),bytes:body};
}
export const delay=ms=>new Promise(r=>setTimeout(r,ms));

/** Persistent trusted checker avoids PowerShell startup per cold sample.
 * Every CHECK re-reads actual ACLs, owner, environment and the full Node hash. */
export function trustedValidationBroker(){
 const clean={SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,TEMP:process.env.TEMP,TMP:process.env.TMP};
 const child=spawn('C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/native/powershell/pwsh.exe',['-NoLogo','-NoProfile','-NonInteractive','-File',resolve(import.meta.dirname,'validate-launch.ps1'),'-NodePath',process.execPath,'-ConfigPath',resolve(stage,'private/config.json'),'-RequestLoop'],{windowsHide:true,env:clean,stdio:['pipe','pipe','pipe']});
 let pending=null,stderr='';child.stderr.on('data',b=>stderr+=b);createInterface({input:child.stdout}).on('line',line=>{if(!pending)throw Error('UNEXPECTED_TRUSTED_LAUNCH_OUTPUT');const {resolve,reject}=pending;pending=null;if(line==='MO1305_TRUSTED_LAUNCH_PRECONDITIONS_PASS')resolve();else reject(Error(line));});
 const exited=new Promise(r=>child.once('exit',code=>{if(pending)pending.reject(Error('TRUSTED_CHECKER_EXIT '+code+' '+stderr));r(code);}));
 return {async check(){assert.equal(pending,null);return bounded(new Promise((resolve,reject)=>{pending={resolve,reject};child.stdin.write('CHECK\n');}),15000,'TRUSTED_CHECKER_TIMEOUT',{onTimeout:()=>child.kill()});},async stop(){child.stdin.end();assert.equal(await bounded(exited,5000,'TRUSTED_CHECKER_SHUTDOWN_TIMEOUT',{onTimeout:()=>child.kill()}),0,stderr);}};
}
