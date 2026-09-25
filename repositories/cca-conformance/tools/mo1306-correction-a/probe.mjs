// Correction-only diagnostic. Fixed copied helper bytes, not production implementation.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const helper=fs.readFileSync(new URL('./check-paths.ps1.txt',import.meta.url));
const helperDigest='sha256:'+createHash('sha256').update(helper).digest('hex');
const mode=process.argv[2];
if(!['attached','detached'].includes(mode))throw new Error('fixed diagnostic mode required');
const executable=path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe');
const args=['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(helper.toString('utf8'),'utf16le').toString('base64')];
for(const name of ['HOMEDRIVE','HOMEPATH','LOGONSERVER','PATH','SYSTEMDRIVE','TEMP','USERDOMAIN','USERNAME','USERPROFILE'])delete process.env[name];
const child=spawn(executable,args,{env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR},shell:false,windowsHide:true,detached:mode==='detached',stdio:['pipe','pipe','pipe']});
let stdout='',stderr='';const started=performance.now();
const timer=setTimeout(()=>child.kill(),2000);
child.stdout.on('data',b=>{stdout+=b.toString('utf8');if(stdout.length>1024)child.kill();});
child.stderr.on('data',b=>{stderr+=b.toString('utf8');if(stderr.length>4096)child.kill();});
child.stdin.on('error',()=>{});
child.on('close',code=>{
 clearTimeout(timer);
 process.stdout.write(JSON.stringify({mode,supervisorPid:process.pid,helperPid:child.pid,helperDigest,executable,args,helperExit:code,helperStdout:stdout,helperStderr:stderr,helperElapsedMs:Math.round(performance.now()-started)})+'\n');
});
child.stdin.end(JSON.stringify({kind:'MemoryOSCICDPathCheckRequest',version:'1.0.0',paths:[{path:process.execPath,allowMissingLeaf:false}]})+'\n');
