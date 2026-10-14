// Engineering parent for ONE intentional parent interruption. Never a CLI/API case.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {helperLaunchSpecification} from '../../../memoryos-readiness/src/helper-transport.mjs';
const [requestPath,readyPath,stdoutPath,stderrPath]=process.argv.slice(2);
assert.ok(requestPath&&readyPath&&stdoutPath&&stderrPath);
const launch=helperLaunchSpecification();
assert.equal(launch.options.detached,true);assert.equal(launch.options.shell,false);
const out=fs.openSync(stdoutPath,'wx'),err=fs.openSync(stderrPath,'wx');
const child=spawn(launch.executable,[...launch.args],{...launch.options,env:{...launch.options.env},stdio:[...launch.options.stdio]});
let stdoutBytes=0,stderrBytes=0;
child.stdout.on('data',bytes=>{stdoutBytes+=bytes.length;if(stdoutBytes<=16777216)fs.writeSync(out,bytes);});
child.stderr.on('data',bytes=>{stderrBytes+=bytes.length;if(stderrBytes<=4096)fs.writeSync(err,bytes);});
child.on('error',error=>{fs.writeFileSync(readyPath+'.error.json',JSON.stringify({name:error.name,message:error.message}),{flag:'wx'});process.exitCode=1;});
child.on('close',(code,signal)=>{fs.writeFileSync(readyPath+'.closed.json',JSON.stringify({code,signal,stdoutBytes,stderrBytes}),{flag:'wx'});process.exitCode=1;});
child.stdin.on('error',()=>{});
child.once('spawn',()=>{
 child.stdin.write(fs.readFileSync(requestPath),()=>{
  // Intentionally withhold EOF. Parent interruption closes the pipe endpoints.
  fs.writeFileSync(readyPath,JSON.stringify({kind:'EngineeringParentHelperReady',pid:child.pid,parentPid:process.pid,launch,stdinEofWithheld:true})+'\n',{flag:'wx'});
 });
});
