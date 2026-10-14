/** Harness-only malformed-worker witnesses. Never part of the installed package. */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {parentPort,workerData} from 'node:worker_threads';
const {fault,generation}=workerData;
const limits=JSON.parse(readFileSync(resolve(workerData.root,'contracts/limits.json')));
const metrics=Object.fromEntries(['oldBytes','youngBytes','externalBytes','heapBytes','integrityUs','importUs','sdkUs','youngAllocatedBytes','youngUsedBytes','oldAllocatedBytes','oldUsedBytes','arrayBufferBytes'].map(k=>[k,0]));
if(fault==='throw')throw Error('INJECTED_WORKER_FAILURE');
else if(fault==='exit')process.exit(0);
else if(fault==='stdout')process.stdout.write('INJECTED_WORKER_OUTPUT');
else if(fault==='stderr')process.stderr.write('INJECTED_WORKER_OUTPUT');
else if(fault==='stale')parentPort.postMessage({type:'result',generation:generation+1,product:{status:'ok'},metrics});
else if(fault==='duplicate'){
 const product={status:'error',error:{code:'MO1305_SEMANTIC_REJECTED',semantic:null}};
 parentPort.postMessage({type:'result',generation,product,metrics});parentPort.postMessage({type:'result',generation,product,metrics});
}else if(fault==='external')parentPort.postMessage({type:'sample',generation,metrics:{...metrics,externalBytes:limits.measured.workerExternalMiB*1048576+1}});
else if(fault==='young')parentPort.postMessage({type:'sample',generation,metrics:{...metrics,youngBytes:limits.measured.workerYoungMiB*1048576+1}});
else if(fault==='old')parentPort.postMessage({type:'sample',generation,metrics:{...metrics,oldBytes:limits.measured.workerOldMiB*1048576+1}});
else if(fault==='timeout'){}
else if(fault==='metric-keys'){const replacement={...metrics};delete replacement.sdkUs;replacement.operationUs=0;parentPort.postMessage({type:'sample',generation,metrics:replacement});}
else parentPort.postMessage({type:'unexpected',generation,metrics});
if(fault.startsWith('terminate-')||fault==='timeout')setInterval(()=>{},1000);else parentPort.close();
