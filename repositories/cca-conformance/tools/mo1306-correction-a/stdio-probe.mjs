import {spawn} from 'node:child_process';
import path from 'node:path';
for(const name of ['HOMEDRIVE','HOMEPATH','LOGONSERVER','PATH','SYSTEMDRIVE','TEMP','USERDOMAIN','USERNAME','USERPROFILE'])delete process.env[name];
const code="[Console]::Out.Write('MO1306-STDOUT'); [Console]::Error.Write('MO1306-STDERR'); exit 23";
const rows=[];
for(const detached of [false,true]){
 const row=await new Promise(resolve=>{
 const child=spawn(path.join(process.env.SystemRoot,'System32/WindowsPowerShell/v1.0/powershell.exe'),['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(code,'utf16le').toString('base64')],{shell:false,windowsHide:true,detached,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR},stdio:['pipe','pipe','pipe']});
 let stdout='',stderr='';const timer=setTimeout(()=>child.kill(),2000);
 child.stdout.on('data',b=>stdout+=b);child.stderr.on('data',b=>stderr+=b);
 child.stdin.on('error',()=>{});child.stdin.end();
 child.on('close',exitCode=>{clearTimeout(timer);resolve({detached,exitCode,stdout,stderr});});
 });rows.push(row);
}
console.log(JSON.stringify(rows));
