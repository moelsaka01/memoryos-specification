import assert from 'node:assert/strict';
import { Client } from '@modelcontextprotocol/client';
import { StdioClientTransport } from '@modelcontextprotocol/client/stdio';
import { resolve,dirname } from 'node:path';
import { mkdtemp,readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFileSync,spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { PACKAGE_ROOT } from '../src/integrity.mjs';
import { RECEIPT,ARCHIVE,verifyArchive,verifyInstalled } from '../scripts/distribution.mjs';
export const workspace=resolve(PACKAGE_ROOT,'../..');
export const env=()=>Object.fromEntries(['SystemRoot','TEMP','TMP'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
export async function official(root=PACKAGE_ROOT,launch) {
 const transcript=[],errors=[];let stderr='';
 const transport=new StdioClientTransport({command:process.execPath,args:launch??[resolve(root,'bin/memoryos-mcp.mjs')],cwd:root,env:env(),stderr:'pipe',maxBufferSize:24576});
 transport.stderr.on('data',bytes=>{stderr+=bytes;assert.ok(stderr.length<=65536);});
 const send=transport.send.bind(transport);transport.send=message=>{assert.ok(transcript.length<300);transcript.push(structuredClone(message));return send(message);};
 const client=new Client({name:'memoryos-phase2-conformance',version:'1.0.0'},{capabilities:{},versionNegotiation:{mode:{pin:'2026-07-28'}},inputRequired:{autoFulfill:false}});
 client.onerror=error=>errors.push(error.code??error.name);
 try {await client.connect(transport,{timeout:30000});}catch(error){await transport.close();throw error;}
 const pid=transport.pid;
 return {client,transport,transcript,errors,pid,stderr:()=>stderr,async close(){await client.close();for(let i=0;i<100;i++){try{process.kill(pid,0);}catch(error){if(error.code==='ESRCH')return;throw error;}await delay(10);}throw Error('SERVER_PROCESS_NOT_REAPED');}};
}
export async function installArchive() {
 const receipt=JSON.parse(await readFile(RECEIPT)),archive=resolve(PACKAGE_ROOT,'out/phase2',ARCHIVE);
 verifyArchive(await readFile(archive),receipt);
 const destination=await mkdtemp(resolve(tmpdir(),'memoryos-mo1304-phase2-install-'));
 assert.ok(!destination.toLowerCase().startsWith(workspace.toLowerCase()));
 const npm=resolve(dirname(process.execPath),'node_modules/npm/bin/npm-cli.js');
 const output=execFileSync(process.execPath,[npm,'install','--offline','--ignore-scripts','--no-audit','--no-fund','--no-save','--omit=dev','--cache',resolve(destination,'empty-cache'),'--prefix',destination,archive],{env:{...env(),PATH:dirname(process.execPath)},windowsHide:true,encoding:'utf8',timeout:120000});
 const root=resolve(destination,'node_modules/memoryos-mcp');const verified=await verifyInstalled(root,receipt);
 return {root,destination,receipt,verified,installOutput:output};
}
export async function raw(root=PACKAGE_ROOT,options={}) {
 const child=spawn(process.execPath,[...(options.flags??[]),resolve(root,'bin/memoryos-mcp.mjs')],{cwd:root,env:{...env(),...options.env},windowsHide:true,stdio:['pipe','pipe','pipe']});
 const frames=[];let buffer=Buffer.alloc(0),stderr=Buffer.alloc(0),total=0;
 child.stdout.on('data',chunk=>{total+=chunk.length;assert.ok(total<1024*1024);buffer=Buffer.concat([buffer,chunk]);let lf;while((lf=buffer.indexOf(10))>=0){const bytes=buffer.subarray(0,lf);assert.ok(bytes.length<24576);frames.push(JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)));buffer=Buffer.from(buffer.subarray(lf+1));}});
 child.stderr.on('data',chunk=>{stderr=Buffer.concat([stderr,chunk]);assert.ok(stderr.length<=13);});
 child.stdin.on('error',()=>{});
 const exited=new Promise((resolve,reject)=>{child.on('error',reject);child.on('exit',(code,signal)=>resolve({code,signal}));});
 return {child,frames,exited,stderr:()=>stderr.toString(),partial:()=>buffer.length,send(value){child.stdin.write(JSON.stringify(value)+'\n');},
  async next(index=frames.length){for(let i=0;i<6000;i++){if(frames.length>index)return frames[index];if(child.exitCode!==null)throw Error('EARLY_EXIT:'+stderr.toString());await delay(5);}throw Error('PROCESS_RESPONSE_TIMEOUT');},
  async end(){child.stdin.end();const timer=setTimeout(()=>child.kill(),25000);try{return await exited;}finally{clearTimeout(timer);}},
  async stop(){child.kill();await exited;}};
}
