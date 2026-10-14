import { spawn } from 'node:child_process';
import path from 'node:path';
import { performance } from 'node:perf_hooks';
import { packageRoot,childEnvironment } from './filesystem.mjs';
import { parseJSON } from './json.mjs';
import { J } from './serialization.mjs';
import { validate } from './contracts.mjs';
import { CIError,reject } from './errors.mjs';
import { verifySemantic } from './verification.mjs';

export function workerArguments() {
  return ['--permission','--allow-fs-read='+packageRoot,'--max-old-space-size=256','--max-semi-space-size=16',path.join(packageRoot,'src/worker.mjs')];
}
/** Terminal state is written before termination. No retry and no late-byte recovery. */
export async function supervise(request,{timeoutMs,deadline,signal}) {
  validate('WorkerRequest',request,'WORKER_PROTOCOL');
  if(signal?.aborted)reject('CANCELLED');
  const bytes=J(request);if(Buffer.byteLength(bytes)>1410000)reject('INPUT_LIMIT');
  const remaining=deadline-performance.now();if(remaining<=0)reject('OVERALL_TIMEOUT');
  return new Promise((resolve,rejectPromise)=>{
    let child,terminal=null,output=Buffer.alloc(0),stderrBytes=0,semanticTimer,overallTimer,reapTimer,created=performance.now(),closed=false;
    const finishError=error=>rejectPromise(error);
    function stop(code) {
      if(closed || terminal)return;
      terminal=new CIError(signal?.aborted?'CANCELLED':code);
      child.stdin.destroy();child.kill();
      reapTimer=setTimeout(()=>finishError(new CIError('CLEANUP_FAILED')),2000);
    }
    const cancel=()=>stop('CANCELLED');
    child=spawn(process.execPath,workerArguments(),{cwd:packageRoot,env:childEnvironment(),windowsHide:true,shell:false,stdio:['pipe','pipe','pipe']});
    created=performance.now();
    signal?.addEventListener('abort',cancel,{once:true});
    semanticTimer=setTimeout(()=>stop('TIMEOUT'),timeoutMs);
    overallTimer=setTimeout(()=>stop('OVERALL_TIMEOUT'),remaining);
    child.on('error',()=>stop('WORKER_EXIT'));
    child.stdin.on('error',()=>{});
    child.stdout.on('data',chunk=>{
      if(terminal)return;
      if(output.length+chunk.length>24576){stop('WORKER_PROTOCOL');return;}
      output=Buffer.concat([output,chunk]);
    });
    child.stderr.on('data',chunk=>{stderrBytes+=chunk.length; if(stderrBytes>16384)stop('WORKER_PROTOCOL');});
    child.on('close',async(code)=>{
      closed=true;clearTimeout(reapTimer);signal?.removeEventListener('abort',cancel);
      try {
        if(signal?.aborted && !terminal)terminal=new CIError('CANCELLED');
        if(terminal)throw terminal;
        if(code!==0)reject('WORKER_EXIT');
        if(stderrBytes!==0)reject('WORKER_PROTOCOL');
        const response=validate('WorkerResponse',parseJSON(output,24576,'WORKER_PROTOCOL'),'WORKER_PROTOCOL');
        if(J(response)!==output.toString('utf8')||response.runId!==request.runId||Boolean(response.semantic)===Boolean(response.error))reject('WORKER_PROTOCOL');
        if(response.error)throw new CIError(response.error.code,response.error.semanticCode);
        const semantic=await verifySemantic(response.semantic);
        if(signal?.aborted)reject('CANCELLED');
        if(performance.now()>=deadline)reject('OVERALL_TIMEOUT');
        if(performance.now()-created>=timeoutMs)reject('TIMEOUT');
        resolve(semantic);
      } catch(error) { finishError(error); }
      finally {clearTimeout(semanticTimer);clearTimeout(overallTimer);}
    });
    child.stdin.end(bytes);
  });
}
