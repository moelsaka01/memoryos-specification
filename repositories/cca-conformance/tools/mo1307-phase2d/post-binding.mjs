// Post-B2 verification writes only a fresh ignored engineering cache directory.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {root,hash,str,record,check,json,write} from './common.mjs';
assert.equal(process.version,'v24.21.0');assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
assert.equal(process.argv.length,4);assert.equal(process.argv[2],'--output');const output=process.argv[3].replaceAll('\\','/');
assert.ok(path.resolve(root,output).startsWith(path.resolve(root,'.cache/mo1307/phase2d/post-binding')+path.sep));assert.equal(fs.existsSync(path.join(root,output)),false);
const B2=str('rev-parse','HEAD');assert.equal(str('status','--porcelain'),'');assert.equal(str('show','-s','--format=%s','HEAD'),'conformance(memoryos-1.3): bind MO-1307 phase 2 integration');
const I2=str('rev-parse','HEAD^'),start=performance.now(),binding=json('repositories/cca-conformance/evidence/mo1307/phase2d/binding.json');assert.equal(I2,binding.implementation.commit);
write(output+'/campaign.json',{kind:'MO1307Phase2DPostBindingCampaign',B2,I2,source:record('repositories/cca-conformance/tools/mo1307-phase2d/post-binding.mjs'),cacheOnly:true,retries:0});
const rows=[];let result='PASS',failure=null;
function run(id,exe,args,timeout=90000){const at=performance.now(),r=spawnSync(exe,args,{cwd:root,windowsHide:true,encoding:null,timeout,maxBuffer:8*1024*1024});
 for(const [n,b] of [['stdout.txt',r.stdout??Buffer.alloc(0)],['stderr.txt',r.stderr??Buffer.alloc(0)]])fs.writeFileSync(path.join(root,output,id+'.'+n),b,{flag:'wx'});
 const row={id,exe,args,exit:r.status,error:r.error?.code??null,elapsedMs:performance.now()-at,stdout:record(output+'/'+id+'.stdout.txt'),stderr:record(output+'/'+id+'.stderr.txt'),result:r.status===0&&!r.error?'PASS':'FAIL'};rows.push(row);assert.ifError(r.error);assert.equal(r.status,0,(r.stderr??Buffer.alloc(0)).toString());console.log(JSON.stringify({id,result:'PASS',elapsedMs:row.elapsedMs}));}
try{
 run('graph-before',process.execPath,['repositories/cca-conformance/tools/mo1307-phase2d/verify-binding.mjs','--bound']);
 for(const group of ['cheap','phase1','phase2a','phase2b','phase2c']){
  run(group,process.execPath,['repositories/cca-conformance/tools/mo1307-phase2d/regression.mjs','--group',group,'--output',output+'/'+group],group==='phase1'?110000:90000);
  assert.equal(json(output+'/'+group+'/receipt.json').result,'PASS');
 }
 run('semantics',process.execPath,['repositories/cca-conformance/tools/mo1307-phase2d/semantic-campaign.mjs','--output','.cache/mo1307/phase2d/post-binding/semantics/'+path.basename(output)],90000);
 assert.equal(json('.cache/mo1307/phase2d/post-binding/semantics/'+path.basename(output)+'/receipt.json').result,'PASS');
 run('native-smoke',process.execPath,['repositories/cca-conformance/tools/mo1307-phase2d/run-native.mjs','lifecycle',output+'/native-lifecycle',output+'/outer-native-lifecycle'],200000);
 assert.equal(json(output+'/native-lifecycle/receipt.json').result,'PASS');
 run('history',process.execPath,['repositories/cca-conformance/tools/mo1307-phase2d/history-and-source-check.mjs']);
 run('graph-after',process.execPath,['repositories/cca-conformance/tools/mo1307-phase2d/verify-binding.mjs','--bound']);
 run('workspace','C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',['-B','tools/verify_workspace.py','--root','.']);
 run('diff-check','git',['diff','--check','HEAD^','HEAD']);
 assert.equal(str('rev-parse','HEAD'),B2);assert.equal(str('branch','--show-current'),'main');assert.equal(str('status','--porcelain'),'');
 for(const m of binding.members)check(m);
}catch(error){result='FAIL';failure={message:error.message,stack:error.stack};}
write(output+'/receipt.json',{kind:'MO1307Phase2DPostBindingVerification',result,failure,B2,I2,elapsedMs:performance.now()-start,commands:rows,finalStatus:str('status','--porcelain'),cacheOnly:true,
 nativeSmoke:'Actual production orchestrator, native helpers and fixed semantic worker; evaluate/verify/repeat with9/4/9requests and exact result bytes.',push:false,tag:false,phase3Started:false});
console.log(JSON.stringify({result,B2,I2,elapsedMs:performance.now()-start,commands:rows.length,failure}));process.exitCode=result==='PASS'?0:1;
