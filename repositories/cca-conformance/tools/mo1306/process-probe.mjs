// Bounded diagnostic only. Never imported by the production distribution.
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
const child=spawn(process.execPath,[fileURLToPath(new URL('./process-probe-child.mjs',import.meta.url))],{
  env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR},
  shell:false,windowsHide:true,detached:process.argv[2]==='detached',
  stdio:['pipe','pipe','pipe']
});
child.stdin.end();
child.stdout.pipe(process.stdout);child.stderr.pipe(process.stderr);
child.on('close',code=>{process.exitCode=code;});
