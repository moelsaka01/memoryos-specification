// Final pre-I2 checks, executed once after native/security/report closure.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {root,evidence,hash,record,write,check} from './common.mjs';
import {packageFiles} from '../mo1307-phase1/package.mjs';
assert.equal(process.version,'v24.21.0');assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const output=evidence+'/final-validation';assert.equal(fs.existsSync(path.join(root,output)),false);fs.mkdirSync(path.join(root,output),{recursive:true});
const walk=p=>fs.readdirSync(path.join(root,p)).sort().flatMap(n=>{const next=p+'/'+n;return fs.statSync(path.join(root,next)).isDirectory()?walk(next):[next];});
const bindings=[...packageFiles.map(p=>'repositories/memoryos-readiness/'+p),...walk('repositories/cca-conformance/tools/mo1307-phase2d'),'docs/mo1307-phase2d-integration.md','.gitattributes'].sort().map(p=>record(p));
const rows=[];let result='PASS',failure=null;
function run(id,exe,args,timeout=60000){const start=performance.now(),r=spawnSync(exe,args,{cwd:root,windowsHide:true,encoding:null,timeout,maxBuffer:16*1024*1024});
 for(const [n,b] of [['stdout.txt',r.stdout??Buffer.alloc(0)],['stderr.txt',r.stderr??Buffer.alloc(0)]])fs.writeFileSync(path.join(root,output,id+'.'+n),b,{flag:'wx'});
 const row={id,exe,args,exit:r.status,error:r.error?.code??null,elapsedMs:performance.now()-start,stdout:record(output+'/'+id+'.stdout.txt'),stderr:record(output+'/'+id+'.stderr.txt'),result:r.status===0&&!r.error?'PASS':'FAIL'};rows.push(row);assert.ifError(r.error);assert.equal(r.status,0,(r.stderr??Buffer.alloc(0)).toString());console.log(JSON.stringify({id,result:row.result,elapsedMs:row.elapsedMs}));}
try{
 for(const p of walk('repositories/cca-conformance/tools/mo1307-phase2d').filter(p=>p.endsWith('.mjs')))run('syntax-'+path.basename(p),process.execPath,['--check',p]);
 run('evidence',process.execPath,['repositories/cca-conformance/tools/mo1307-phase2d/check-evidence.mjs']);
 run('package-rebuild',process.execPath,['repositories/cca-conformance/tools/mo1307-phase1/package.mjs','build']);
 for(const m of bindings)check(m);
 run('package-integrity',process.execPath,['repositories/cca-conformance/tools/mo1307-phase1/package.mjs','check']);
 run('history',process.execPath,['repositories/cca-conformance/tools/mo1307-phase2d/history-and-source-check.mjs']);
 run('workspace','C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',['-B','tools/verify_workspace.py','--root','.']);
 run('diff-check','git',['diff','--check']);
 for(const m of bindings)check(m);
}catch(error){result='FAIL';failure={message:error.message,stack:error.stack};}
write(output+'/receipt.json',{kind:'MO1307Phase2DFinalValidation',version:'1.0.0',result,failure,commands:rows,sourceBindings:bindings,packageRebuildByteStable:result==='PASS',normativeBlocker:false});
console.log(JSON.stringify({result,commands:rows.length,failure}));process.exitCode=result==='PASS'?0:1;
