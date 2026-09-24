import {scheduleTimeout as setTimeout,cancelTimeout as clearTimeout,bounded} from './clock.mjs';
import {spawn} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import tls from 'node:tls';
import assert from 'node:assert/strict';
const root=resolve(import.meta.dirname,'../../../..');
const stage=readFileSync(resolve(root,'.cache/mo1305-resume/installed-path.txt'),'utf8');
const token=readFileSync(resolve(stage,'private/token'),'ascii'),ca=readFileSync(resolve(stage,'private/cert.pem'));
const child=spawn(process.execPath,[resolve(stage,'package/bin/memoryos-rest.mjs'),'--config',resolve(stage,'private/config.json')],{cwd:resolve(stage,'empty'),windowsHide:true,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR,TEMP:process.env.TEMP,TMP:process.env.TMP},stdio:['pipe','pipe','pipe']});
let stdout='',stderr='';child.stdout.on('data',b=>{stdout+=b;if(stdout.length>65536)child.kill();});child.stderr.on('data',b=>{stderr+=b;if(stderr.length>65536)child.kill();});
await bounded(new Promise((resolve,reject)=>{child.stderr.on('data',()=>{if(stderr.includes('"event":"startup"'))resolve();});child.once('exit',code=>reject(Error('EARLY_EXIT '+code)));}),15000,'HANDOFF_STARTUP_TIMEOUT',{onTimeout:()=>child.kill()});
function wire(chunks){let activeSocket;return bounded(new Promise((resolve,reject)=>{
 const socket=tls.connect({host:'127.0.0.1',port:13050,ca,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',ALPNProtocols:['http/1.1']});let output=Buffer.alloc(0);activeSocket=socket;
 socket.on('error',reject);socket.on('data',b=>{output=Buffer.concat([output,b]);if(output.length>131072)socket.destroy();});socket.once('close',()=>{resolve(output.toString('utf8'));});
 socket.once('secureConnect',async()=>{for(const chunk of chunks){socket.write(chunk);await new Promise(r=>setTimeout(r,2));}});
}),12000,'HANDOFF_RESPONSE_TIMEOUT',{onTimeout:()=>activeSocket?.destroy()});}
const base=(path,extra='')=>`GET ${path} HTTP/1.1\r\nHost: 127.0.0.1:13050\r\nAuthorization: Bearer ${token}\r\nConnection: close\r\n${extra}\r\n`;
try {
 const scenarios=[['health',[base('/v1/health')],200],['fragmented',Array.from(base('/v1/health')),200],['identities',[base('/v1/contract-identities')],200],['duplicate',[base('/v1/health','Host: 127.0.0.1:13050\r\n')],400],['pipeline',[base('/v1/health')+base('/v1/health')],400]];
 for(const [name,chunks,status] of scenarios){const response=await wire(chunks);console.log(JSON.stringify({name,response:response.slice(0,220)}));assert.ok(response.startsWith('HTTP/1.1 '+status+' '),name);assert.equal((response.match(/HTTP\/1\.1/g)??[]).length,1);}
 assert.equal(stdout,'');
}finally{child.stdin.end();await bounded(new Promise(resolve=>child.once('exit',resolve)),17000,'HANDOFF_SHUTDOWN_TIMEOUT',{onTimeout:()=>child.kill()});console.log(JSON.stringify({exitCode:child.exitCode,logs:stderr}));}
