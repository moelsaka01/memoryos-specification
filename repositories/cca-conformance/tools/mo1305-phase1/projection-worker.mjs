/** Engineering-only byte/cost witness for otherwise exceptional error publication.
 * This does not certify the triggering condition; faults/lifecycle suites do that. */
import {parentPort,workerData} from 'node:worker_threads';
import {getHeapSpaceStatistics} from 'node:v8';
const memory=process.memoryUsage(),spaces=getHeapSpaceStatistics();let young=0,old=0;
for(const s of spaces){if(s.space_name==='new_space'||s.space_name==='new_large_object_space')young+=s.physical_space_size;else old+=s.physical_space_size;}
const metrics={oldBytes:old,youngBytes:young,externalBytes:memory.external,heapBytes:memory.heapTotal,integrityUs:0,importUs:0,sdkUs:0,youngAllocatedBytes:young,youngUsedBytes:0,oldAllocatedBytes:old,oldUsedBytes:0,arrayBufferBytes:memory.arrayBuffers};
parentPort.postMessage({type:'result',generation:workerData.generation,product:workerData.projection==='MAX_SEMANTIC'?{status:'error',error:{code:'MO1305_SEMANTIC_REJECTED',semantic:{origin:'memoryos',code:'A'.repeat(128),phase:'\u0001'.repeat(128),artifactKind:'\u0001'.repeat(128),limitIdentifier:'\u0001'.repeat(128),failureClass:'preparation',verificationFailure:false}}}:{status:'error',error:{code:workerData.projection,semantic:null}},metrics});parentPort.close();
