import fs from 'node:fs';import path from 'node:path';import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),exe='C:/Windows/System32/WindowsPowerShell/v1.0/powershell.exe',args=['-NoLogo','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(root,'capture-probe.ps1')];
const r=spawnSync(exe,args,{cwd:root,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'},windowsHide:true,shell:false,timeout:20000,maxBuffer:65536});
fs.writeFileSync(path.join(root,'capture-probe.stdout.txt'),r.stdout??Buffer.alloc(0),{flag:'wx'});fs.writeFileSync(path.join(root,'capture-probe.stderr.txt'),r.stderr??Buffer.alloc(0),{flag:'wx'});
fs.writeFileSync(path.join(root,'capture-probe.receipt.json'),JSON.stringify({command:{exe,args},status:r.status,error:r.error?{code:r.error.code,message:r.error.message}:null,stdout:r.stdout?.toString(),stderr:r.stderr?.toString(),engineeringOnly:true,productSourceRead:false},null,2)+'\n',{flag:'wx'});
console.log(r.stdout?.toString());console.error(r.stderr?.toString());
