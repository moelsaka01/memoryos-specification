// Fixed helper diagnostic. Uses exactly its frozen argv and private stdin framing.
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const root=path.resolve(fileURLToPath(new URL('../../../../',import.meta.url)));
const helper=fs.readFileSync(path.join(root,'repositories/memoryos-ci/scripts/check-paths.ps1'),'utf8');
const child=spawn(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),
 ['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(helper,'utf16le').toString('base64')],
 {env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR},cwd:path.join(root,'repositories/memoryos-ci'),shell:false,windowsHide:true,detached:process.argv[2]==='detached',stdio:['pipe','pipe','pipe']});
let stdout='',stderr='';
const timer=setTimeout(()=>child.kill(),2000);
child.stdout.on('data',b=>{stdout+=b.toString('utf8');if(stdout.length>1024)child.kill();});
child.stderr.on('data',b=>{stderr+=b.toString('utf8');if(stderr.length>4096)child.kill();});
child.stdin.on('error',()=>{});
child.on('close',code=>{clearTimeout(timer);process.stdout.write(JSON.stringify({helperExit:code,helperStdout:stdout,helperStderr:stderr})+'\n');});
child.stdin.end(JSON.stringify({kind:'MemoryOSCICDPathCheckRequest',version:'1.0.0',paths:[{path:process.execPath,allowMissingLeaf:false}]})+'\n');
