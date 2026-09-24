import { memoryExceeded } from './resource-policy.mjs';
import { Worker } from 'node:worker_threads';
import { limits, api, validate, routeById } from './contracts.mjs';
import { now, ms, deadlineReached, atDeadline, cancelDeadline } from './admission.mjs';
import { errorProduct } from './errors.mjs';
import { verifyDistribution, packageRoot } from './integrity.mjs';
/** Resolves only after a real worker exit. Ownership remains reserved until response completion. */
export function runSemantic(owner,operation,input,manifest,onFatal) {
  owner.started=now();owner.deadline=owner.started+ms(limits.measured.operationMs);owner.state='running';
  return new Promise(resolve=>{
    let result=null,gotResult=false,failed=null,terminated=false,reapTimer=null;
    let worker;
    const metrics={oldBytes:0,youngBytes:0,externalBytes:0,heapBytes:0,integrityUs:0,importUs:0,sdkUs:0,reapUs:0,operationUs:0,youngAllocatedBytes:0,youngUsedBytes:0,oldAllocatedBytes:0,oldUsedBytes:0,arrayBufferBytes:0,workerCreated:0,workerReaped:0};
    function stop(code){
      if(failed===null)failed=code;
      if(terminated)return;terminated=true;owner.state='reaping';owner.reapStart=now();
      if(worker){worker.terminate().catch(()=>onFatal('MO1305_INTERNAL_FAILURE'));
        reapTimer=atDeadline(owner.reapStart+ms(limits.fixed.terminationMs),()=>{onFatal('MO1305_UNAVAILABLE');process.exit(1);});}
    }
    owner.cancel=code=>{owner.cancelled=true;stop(code??'MO1305_CLIENT_CANCELLED');};
    const deadline=atDeadline(owner.deadline,()=>stop('MO1305_OPERATION_TIMEOUT'));
    try {
      // Node 24.21.0 V8 divides by three, then rounds each semispace upward to a power of two.
      // 24 MiB requests two 8 MiB semispaces plus the 8 MiB new-large-object allowance.
      // This allocation control is intentionally separate from the measured committed-memory budget.
      worker=new Worker(new URL('./worker.mjs',import.meta.url),{env:{},execArgv:[],stdin:false,stdout:true,stderr:true,
        resourceLimits:{maxOldGenerationSizeMb:limits.measured.workerOldMiB,maxYoungGenerationSizeMb:24,stackSizeMb:limits.fixed.workerStackMiB},
        workerData:{generation:owner.generation,root:packageRoot,manifest,operation,input}});
      owner.worker=worker;metrics.workerCreated=1;
      worker.stdout.on('data',()=>stop('MO1305_INTERNAL_FAILURE'));worker.stderr.on('data',()=>stop('MO1305_INTERNAL_FAILURE'));
      worker.on('message',message=>{
        if(owner.cancelled || failed || message?.generation!==owner.generation)return;
        if(deadlineReached(owner.deadline)){stop('MO1305_OPERATION_TIMEOUT');return;}
        if(message.type!=='sample'&&message.type!=='result'){stop('MO1305_INTERNAL_FAILURE');return;}
        if(!message.metrics || Object.keys(message.metrics).sort().join(',')!=='arrayBufferBytes,externalBytes,heapBytes,importUs,integrityUs,oldAllocatedBytes,oldBytes,oldUsedBytes,sdkUs,youngAllocatedBytes,youngBytes,youngUsedBytes'){stop('MO1305_INTERNAL_FAILURE');return;}
        for(const [key,value] of Object.entries(message.metrics)){
          if(!Object.hasOwn(metrics,key)||!Number.isSafeInteger(value)||value<0){stop('MO1305_INTERNAL_FAILURE');return;}
          metrics[key]=Math.max(metrics[key],value);
        }
        if(memoryExceeded({workerYoungMiB:metrics.youngBytes,workerOldMiB:metrics.oldBytes,workerExternalMiB:metrics.externalBytes})){stop('MO1305_OUTPUT_LIMIT');onFatal('MO1305_OUTPUT_LIMIT');return;}
        if(message.type==='result'){
          if(gotResult){stop('MO1305_INTERNAL_FAILURE');return;}gotResult=true;result=message.product;
          owner.state='reaping';owner.reapStart=now();
        }
      });
      worker.on('error',error=>{if(error.code==='ERR_WORKER_OUT_OF_MEMORY'){stop('MO1305_OUTPUT_LIMIT');onFatal('MO1305_OUTPUT_LIMIT');}else stop('MO1305_INTERNAL_FAILURE');});
      worker.once('exit',code=>{
        cancelDeadline(deadline);cancelDeadline(reapTimer);owner.reaped=true;owner.worker=null;metrics.workerReaped=1;
        if(owner.reapStart)metrics.reapUs=Number((now()-owner.reapStart)/1000n);
        if(!failed && deadlineReached(owner.deadline))failed='MO1305_OPERATION_TIMEOUT';
        if(!failed && (code!==0||!gotResult||!result||!validate(result.status==='error'?'Error':routeById.get(operation).output,result)))failed='MO1305_INTERNAL_FAILURE';
        const integrityStart=now();try{verifyDistribution(packageRoot,manifest);}catch{failed='MO1305_RUNTIME_INTEGRITY';onFatal(failed);}
        metrics.integrityUs+=Number((now()-integrityStart)/1000n);
        metrics.operationUs=Number((now()-owner.started+999n)/1000n);
        if(!failed&&deadlineReached(owner.deadline))failed='MO1305_OPERATION_TIMEOUT';
        if(failed)result=errorProduct(Object.hasOwn(api.errors,failed)?failed:'MO1305_INTERNAL_FAILURE');
        owner.state=owner.cancelled?'aborted':'ready';resolve({product:result,metrics});
      });
    }catch{
      cancelDeadline(deadline);owner.reaped=true;owner.state='aborted';resolve({product:errorProduct('MO1305_INTERNAL_FAILURE'),metrics});
    }
  });
}
