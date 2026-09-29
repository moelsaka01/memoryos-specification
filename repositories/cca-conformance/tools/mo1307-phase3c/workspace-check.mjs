import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
const ev='repositories/cca-conformance/evidence/mo1307/phase3c';
const start=performance.now();const r=spawnSync('C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',['-B','tools/verify_workspace.py','--root','.'],{windowsHide:true,encoding:'utf8',timeout:60000,maxBuffer:8*1024*1024});
fs.writeFileSync(ev+'/workspace-verification.stdout.txt',r.stdout,{flag:'wx'});fs.writeFileSync(ev+'/workspace-verification.stderr.txt',r.stderr,{flag:'wx'});
const receipt={kind:'MO1307Phase3CWorkspaceVerification',result:r.status===0?'PASS':'FAIL',exit:r.status,error:r.error?.code??null,durationMs:performance.now()-start,command:'python.exe -B tools/verify_workspace.py --root .',stdout:ev+'/workspace-verification.stdout.txt',stderr:ev+'/workspace-verification.stderr.txt'};fs.writeFileSync(ev+'/workspace-verification.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));console.log(r.stdout);console.log(r.stderr);
