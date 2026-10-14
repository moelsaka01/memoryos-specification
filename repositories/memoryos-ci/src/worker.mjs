import { installWorkerBoundary } from './worker-boundary.mjs';
import { parseJSON } from './json.mjs';
import { J } from './serialization.mjs';
import { validate } from './contracts.mjs';
import { errorObject } from './errors.mjs';
import { delegate } from './delegate.mjs';

installWorkerBoundary();
let length=0,chunks=[];
for await (const chunk of process.stdin) {
  length+=chunk.length;
  if(length>1410000){process.exitCode=12;break;}
  chunks.push(chunk);
}
if(!process.exitCode) {
  try {
    const request=parseJSON(Buffer.concat(chunks),1410000,'WORKER_PROTOCOL');chunks=[];
    validate('WorkerRequest',request,'WORKER_PROTOCOL');
    const sdk=await import('../runtime/authoritative/web/js/memoryos-sdk.js');
    const mip=await import('../runtime/authoritative/web/js/memory-investigation-package.js');
    let semantic=null,error=null;
    try {semantic=delegate(request,sdk,mip);} catch(e) {error=errorObject(e);}
    const response={kind:'MemoryOSCICDWorkerResponse',version:'1.0.0',runId:request.runId,semantic,error};
    validate('WorkerResponse',response,'WORKER_PROTOCOL');
    const bytes=J(response);if(Buffer.byteLength(bytes)>24576)throw new Error('response bounds');
    process.stdout.write(bytes);
  } catch {process.exitCode=12;}
}
