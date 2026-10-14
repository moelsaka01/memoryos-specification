/** Phase 2C uses an exact manifest-only copy and the unmodified production entrypoint. */
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,copyFileSync,existsSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import {createHash,randomBytes} from 'node:crypto';
import tls from 'node:tls';
export const root=resolve(import.meta.dirname,'../../../..');
export const baseline='b6c397b99e1f8bfcd04be972f35069f8737a4137';
export const cache=resolve(root,'.cache/mo1305-phase2c');
export const port=Number(process.env.MO1305_2C_PORT??13251);
assert.ok(Number.isInteger(port)&&port>=13251&&port<=13259);
export const origin=`https://127.0.0.1:${port}`;
export const stage=resolve(cache,`stage-${port}`);
export const packageRoot=resolve(root,'repositories/memoryos-rest');
export const nodePath=resolve(cache,'runtime/node.exe');
export const powershell='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
export const clean={SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,TEMP:resolve(cache,'tmp'),TMP:resolve(cache,'tmp'),PATH:'C:/Windows/System32;C:/Windows/System32/WindowsPowerShell/v1.0'};
export const api=JSON.parse(readFileSync(resolve(packageRoot,'contracts/api-contract.json')));
export const limits=JSON.parse(readFileSync(resolve(packageRoot,'contracts/limits.json')));
export const credentials={token:null,ca:null};
export const launchHistory=[];
export const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export const delay=ms=>new Promise(r=>setTimeout(r,ms));
export const reference=path=>{const bytes=readFileSync(resolve(root,path));return {path:path.replaceAll('\\','/'),byteLength:bytes.length,sha256:sha(bytes)};};
export function bounded(promise,ms,label){let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label)),ms);})]).finally(()=>clearTimeout(timer));}
export function checked(exe,args,options={}){const result=spawnSync(exe,args,{encoding:'utf8',windowsHide:true,timeout:45000,env:clean,...options});assert.equal(result.status,0,`TOOL_FAILED ${result.error?.code??result.status} ${(result.stderr??'').slice(0,512)}`);return result.stdout;}
export function ensureStage(){
 assert.equal(limits.state,'FINAL');assert.equal(sha(readFileSync(nodePath)),'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
 for(const path of [stage,resolve(stage,'private'),resolve(stage,'empty'),clean.TEMP])mkdirSync(path,{recursive:true});
 const manifest=JSON.parse(readFileSync(resolve(packageRoot,'distribution-manifest.json')));
 for(const row of [...manifest.files,{path:'distribution-manifest.json'}]){
  const source=resolve(packageRoot,row.path),target=resolve(stage,'package',row.path),bytes=readFileSync(source);
  if(row.sha256){assert.equal(bytes.length,row.byteLength);assert.equal(sha(bytes),row.sha256);}
  mkdirSync(dirname(target),{recursive:true});copyFileSync(source,target);
 }
 credentials.token=randomBytes(32).toString('hex');writeFileSync(resolve(stage,'private/token'),credentials.token);
 checked('C:/Program Files/Git/usr/bin/openssl.exe',['req','-x509','-newkey','ec','-pkeyopt','ec_paramgen_curve:P-256','-nodes','-keyout',resolve(stage,'private/key.pem'),'-out',resolve(stage,'private/cert.pem'),'-days','3','-subj','/CN=MO1305 Phase2C isolated test','-addext','subjectAltName=IP:127.0.0.1']);
 credentials.ca=readFileSync(resolve(stage,'private/cert.pem'));
 writeFileSync(resolve(stage,'private/config.json'),JSON.stringify({version:'1.0.0',port,tokenFile:resolve(stage,'private/token'),certificateFile:resolve(stage,'private/cert.pem'),privateKeyFile:resolve(stage,'private/key.pem')}));
 const acl=resolve(stage,'set-private-acl.ps1');writeFileSync(acl,`param([string]$PrivateDirectory)\n$ErrorActionPreference='Stop'\n$serviceSid=[System.Security.Principal.WindowsIdentity]::GetCurrent().User\nforeach($name in @('token','key.pem','config.json')){\n$acl=[System.Security.AccessControl.FileSecurity]::new();$acl.SetOwner($serviceSid);$acl.SetAccessRuleProtection($true,$false)\nforeach($sid in @($serviceSid.Value,'S-1-5-18','S-1-5-32-544')){$acl.AddAccessRule([System.Security.AccessControl.FileSystemAccessRule]::new([System.Security.Principal.SecurityIdentifier]::new($sid),'FullControl','Allow'))}\nSet-Acl -LiteralPath (Join-Path $PrivateDirectory $name) -AclObject $acl\n}\n`);
 const precheck=spawnSync(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resolve(root,'repositories/cca-conformance/tools/mo1305-phase1/validate-launch.ps1'),'-NodePath',nodePath,'-ConfigPath',resolve(stage,'private/config.json')],{encoding:'utf8',windowsHide:true,timeout:45000,env:clean});
 if(precheck.status!==0)checked(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',acl,'-PrivateDirectory',resolve(stage,'private')]);
 return {fileCount:manifest.files.length+1,distribution:reference('repositories/memoryos-rest/distribution-manifest.json')};
}
export async function launch({environment={},args=null,packagePath=resolve(stage,'package'),configPath=resolve(stage,'private/config.json')}={}){
 if(!credentials.token){credentials.token=readFileSync(resolve(stage,'private/token'),'ascii');credentials.ca=readFileSync(resolve(stage,'private/cert.pem'));}
 const validation=checked(powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',resolve(root,'repositories/cca-conformance/tools/mo1305-phase1/validate-launch.ps1'),'-NodePath',nodePath,'-ConfigPath',configPath]);
 assert.equal(validation.trim(),'MO1305_TRUSTED_LAUNCH_PRECONDITIONS_PASS');
 const child=spawn(nodePath,args??[resolve(packagePath,'bin/memoryos-rest.mjs'),'--config',configPath],{cwd:resolve(stage,'empty'),env:{...clean,...environment},windowsHide:true,stdio:['pipe','pipe','pipe']});
 const launchRecord={pid:child.pid,entry:'package/bin/memoryos-rest.mjs',launchMode:args===null?'production-entrypoint':'explicit-test-launcher',started:false,exitCode:null,signal:null};launchHistory.push(launchRecord);child.once('exit',(code,signal)=>{launchRecord.exitCode=code;launchRecord.signal=signal;});
 const state={child,stdout:'',stderr:'',port,token:credentials.token,launchMode:'production-entrypoint',observations:[],audit:[],states:[]};
 child.stdout.on('data',bytes=>{state.stdout+=bytes;if(state.stdout.length>65536)child.kill();});
 child.stderr.on('data',bytes=>{state.stderr+=bytes;if(state.stderr.length>1048576)child.kill();});
 state.exit=new Promise((r,j)=>{child.once('error',j);child.once('exit',(code,signal)=>r({code,signal}));});
 state.stop=async()=>{child.stdin.end();let result;try{result=await bounded(state.exit,17000,'SHUTDOWN_TIMEOUT');}catch(e){child.kill();throw e;}assert.equal(result.code,0,`GATEWAY_EXIT ${result.code} ${state.stderr.slice(-512)}`);assert.equal(state.stdout,'');return result;};
 try{await bounded(new Promise((r,j)=>{child.stderr.on('data',()=>{if(state.stderr.includes('"event":"startup"'))r();});state.exit.then(x=>j(Error(`STARTUP_EXIT ${x.code}`)),j);}),15000,'STARTUP_TIMEOUT');}catch(e){child.kill();throw e;}
 launchRecord.started=true;return state;
}
let fixtureCache;
export const vectors=()=>fixtureCache??=(JSON.parse(readFileSync(resolve(root,'repositories/cca-conformance/fixtures/mo1305-phase1/index.json'))).files.map(row=>{const b=readFileSync(resolve(root,'repositories/cca-conformance/fixtures/mo1305-phase1',row.path));assert.equal(b.length,row.byteLength);assert.equal(sha(b),row.sha256);return JSON.parse(b);}));
export function request(operation,input=null,{headers={},method=null,path=null}={}){
 const route=api.routes.find(r=>r.operationId===operation);assert.ok(route,operation);
 const body=input===null?Buffer.alloc(0):Buffer.isBuffer(input)?input:Buffer.from(typeof input==='string'?input:JSON.stringify(input));
 const fields={Host:`127.0.0.1:${port}`,Authorization:'Bearer '+credentials.token,Connection:'close','Accept-Encoding':'identity',...headers};
 if(route.method==='POST'){if(!Object.hasOwn(fields,'Content-Type'))fields['Content-Type']='application/json';if(!Object.hasOwn(fields,'Content-Length'))fields['Content-Length']=String(body.length);}
 return Buffer.concat([Buffer.from(`${method??route.method} ${path??route.path} HTTP/1.1\r\n`+Object.entries(fields).filter(([,v])=>v!==null).map(([k,v])=>k+': '+v).join('\r\n')+'\r\n\r\n'),body]);
}
export function wire(chunks,{end=false,timeout=12000,tlsOptions={},allowClose=false}={}){
 if(!Array.isArray(chunks))chunks=[chunks];
 return new Promise((r,j)=>{
  const socket=tls.connect({host:'127.0.0.1',port,ca:credentials.ca,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',ALPNProtocols:['http/1.1'],...tlsOptions});let result=Buffer.alloc(0),failure=null;
  const timer=setTimeout(()=>{failure=Error('WIRE_TIMEOUT');socket.destroy();},timeout);
  socket.on('error',error=>{failure=error;});
  socket.on('data',bytes=>{result=Buffer.concat([result,bytes]);if(result.length>131072){failure=Error('RESPONSE_LIMIT');socket.destroy();}});
  socket.once('close',()=>{clearTimeout(timer);if(failure&&(!allowClose||failure.message==='WIRE_TIMEOUT'))j(failure);else r(result);});
  socket.once('secureConnect',async()=>{for(const chunk of chunks){if(socket.destroyed)break;socket.write(chunk);if(chunks.length>1)await delay(1);}if(end)socket.end();});
 });
}
export function response(bytes,{head=false}={}){
 const split=bytes.indexOf('\r\n\r\n');assert.ok(split>=0,'MISSING_RESPONSE');
 const lines=bytes.subarray(0,split).toString('ascii').split('\r\n'),status=Number(lines.shift().split(' ')[1]),headers={};
 for(const line of lines){const i=line.indexOf(':');const name=line.slice(0,i).toLowerCase();assert.ok(!Object.hasOwn(headers,name));headers[name]=line.slice(i+1).trim();}
 const body=bytes.subarray(split+4);assert.equal(body.length,head?0:Number(headers['content-length']));
 for(const [name,value] of Object.entries(api.headers.response))assert.equal(headers[name],value);
 for(const key of ['date','server','transfer-encoding','content-encoding','access-control-allow-origin'])assert.ok(!Object.hasOwn(headers,key));
 return {status,headers,body:head?null:JSON.parse(body),bytes:body};
}
