import { parentPort, workerData } from 'node:worker_threads';
import { getHeapSpaceStatistics } from 'node:v8';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import { verifyDistribution } from './integrity.mjs';
import { installWorkerBoundary } from './worker-boundary.mjs';
import { delegate } from './delegate.mjs';
import { api, limits, validate, routeById } from './contracts.mjs';
import { jsonBytes } from './serialization.mjs';
import { errorProduct } from './errors.mjs';
const {generation,root,manifest,operation,input}=workerData;
const metrics={oldBytes:0,youngBytes:0,externalBytes:0,heapBytes:0,integrityUs:0,importUs:0,sdkUs:0,youngAllocatedBytes:0,youngUsedBytes:0,oldAllocatedBytes:0,oldUsedBytes:0,arrayBufferBytes:0};
function sample(){
  const memory=process.memoryUsage();
  let old=0,young=0,oldAllocated=0,youngAllocated=0,oldUsed=0,youngUsed=0;
  for(const space of getHeapSpaceStatistics()){
    if(space.space_name==='new_space'||space.space_name==='new_large_object_space'){young+=space.physical_space_size;youngAllocated+=space.space_size;youngUsed+=space.space_used_size;}
    else{old+=space.physical_space_size;oldAllocated+=space.space_size;oldUsed+=space.space_used_size;}
  }
  metrics.oldBytes=Math.max(metrics.oldBytes,old);metrics.youngBytes=Math.max(metrics.youngBytes,young);
  metrics.externalBytes=Math.max(metrics.externalBytes,memory.external);metrics.heapBytes=Math.max(metrics.heapBytes,memory.heapTotal);
  metrics.youngAllocatedBytes=Math.max(metrics.youngAllocatedBytes,youngAllocated);metrics.youngUsedBytes=Math.max(metrics.youngUsedBytes,youngUsed);
  metrics.oldAllocatedBytes=Math.max(metrics.oldAllocatedBytes,oldAllocated);metrics.oldUsedBytes=Math.max(metrics.oldUsedBytes,oldUsed);metrics.arrayBufferBytes=Math.max(metrics.arrayBufferBytes,memory.arrayBuffers);
  parentPort.postMessage({type:'sample',generation,metrics});
}
const time=()=>process.hrtime.bigint(), us=start=>Number((time()-start)/1000n);
let product;
const timer=setInterval(sample,limits.fixed.sampleMs);
try {
  sample();let started=time();verifyDistribution(root,manifest);metrics.integrityUs+=us(started);
  installWorkerBoundary();started=time();
  const sdk=await import(pathToFileURL(resolve(root,'runtime/authoritative/web/js/memoryos-sdk.js')).href);
  const mip=await import(pathToFileURL(resolve(root,'runtime/authoritative/web/js/memory-investigation-package.js')).href);
  metrics.importUs=us(started);sample();started=time();product=delegate(operation,input,sdk,mip);metrics.sdkUs=us(started);sample();
  started=time();verifyDistribution(root,manifest);metrics.integrityUs+=us(started);
  if(!validate(product.status==='error'?'Error':routeById.get(operation).output,product))product=errorProduct('MO1305_INTERNAL_FAILURE');
  if(jsonBytes(product).length>limits.measured.operations[operation].responseBytes)product=errorProduct('MO1305_OUTPUT_LIMIT');
} catch(error){product=errorProduct(Object.hasOwn(api.errors,error.code)?error.code:'MO1305_INTERNAL_FAILURE');}
finally{clearInterval(timer);sample();}
parentPort.postMessage({type:'result',generation,product,metrics});
parentPort.close();
