// Engineering workload cap only; never a product rename-settlement bound.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {root,evidence,hash,record,check,json,write} from './common.mjs';
assert.equal(process.argv.length,5);
const [kind,output,outer]=process.argv.slice(2);
assert.equal(kind,'mo1306-diagnostic');
for(const p of [output,outer])assert.ok([evidence+'/native/','.cache/mo1307/phase2d/post-binding/'].some(prefix=>path.resolve(root,p).startsWith(path.resolve(root,prefix)+path.sep)));
assert.equal(fs.existsSync(path.join(root,output)),false);assert.equal(fs.existsSync(path.join(root,outer)),false);
assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');
assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const tool='repositories/cca-conformance/tools/mo1307-phase2d/native-'+kind+'.mjs';
const sources=[tool,'repositories/cca-conformance/tools/mo1307-phase2d/run-diagnostic.mjs','repositories/cca-conformance/tools/mo1307-phase2d/common.mjs',evidence+'/pre-native-authorization.json'].map(p=>record(p));
const timeoutMs=60000;
write(outer+'/campaign.json',{kind:'MO1307NativeEngineeringOuterCampaign',group:kind,sourceBindings:sources,output,timeoutMs,retries:0,finiteProductSettlementClaim:false});
const start=performance.now();
const child=spawnSync(process.execPath,[tool,'--output',output],{cwd:root,windowsHide:true,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'},encoding:null,timeout:timeoutMs,maxBuffer:4*1024*1024});
for(const [n,b] of [['stdout.txt',child.stdout??Buffer.alloc(0)],['stderr.txt',child.stderr??Buffer.alloc(0)]])fs.writeFileSync(path.join(root,outer,n),b,{flag:'wx'});
let result='PASS',failure=null,receipt=null;
try{assert.ifError(child.error);assert.equal(child.status,0);receipt=record(output+'/receipt.json');assert.equal(json(receipt.path).result,'PASS');for(const m of sources)check(m);}
catch(error){result='FAIL';failure={message:error.message,stack:error.stack};}
write(outer+'/receipt.json',{kind:'MO1307NativeEngineeringOuterReceipt',group:kind,result,failure,exit:child.status,error:child.error?.code??null,signal:child.signal,
 elapsedMs:performance.now()-start,sourceBindings:sources,stdout:record(outer+'/stdout.txt'),stderr:record(outer+'/stderr.txt'),innerReceipt:receipt,engineeringTimeoutMs:timeoutMs,finiteProductSettlementClaim:false});
process.stdout.write(child.stdout??Buffer.alloc(0));process.stderr.write(child.stderr??Buffer.alloc(0));console.log(JSON.stringify({outer,result,elapsedMs:performance.now()-start}));process.exitCode=result==='PASS'?0:1;
