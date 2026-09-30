import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),ps='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe';
const modes=['direct','nested','expression','array','pipeline'];
const rows=[];
const sha=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
for(const mode of modes){
 const args=['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'repro.ps1'),'-Mode',mode];
 const r=spawnSync(ps,args,{cwd:root,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'},windowsHide:true,shell:false,timeout:20000,maxBuffer:65536});
 fs.writeFileSync(path.join(root,mode+'.stdout.txt'),r.stdout??Buffer.alloc(0),{flag:'wx'});fs.writeFileSync(path.join(root,mode+'.stderr.txt'),r.stderr??Buffer.alloc(0),{flag:'wx'});
 rows.push({mode,command:{executable:ps,args,cwd:root,environment:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'}},status:r.status,signal:r.signal,error:r.error?{code:r.error.code,message:r.error.message}:null,stdout:r.stdout?.toString(),stderr:r.stderr?.toString()});
}
fs.writeFileSync(path.join(root,'receipt.json'),JSON.stringify({kind:'EngineeringGitOriginalWrapperScopeReproduction',sourceWrapper:'C:/m7c2/repositories/cca-conformance/tools/mo1307-phase3c-c3rb-cert2/git-toolchain.ps1',sourceSha256:sha(fs.readFileSync('C:/m7c2/repositories/cca-conformance/tools/mo1307-phase3c-c3rb-cert2/git-toolchain.ps1')),productSourceRead:false,certification:false,rows},null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(rows.map(({mode,status,error})=>({mode,status,error}))));
