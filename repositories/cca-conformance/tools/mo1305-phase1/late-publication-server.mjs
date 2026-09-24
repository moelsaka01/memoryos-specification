/** Synthetic clock boundary after real worker exit, inside final parent integrity check.
 * Not a performance sample; the installed production bytes remain unchanged. */
import threads from 'node:worker_threads';import crypto from 'node:crypto';import {syncBuiltinESMExports} from 'node:module';
const Actual=threads.Worker,hash=crypto.createHash,clock=process.hrtime.bigint;let afterExit=false,offset=0n;
threads.Worker=class extends Actual{emit(event,...args){const result=super.emit(event,...args);if(event==='exit')afterExit=true;return result;}};
crypto.createHash=function(...args){const result=hash.apply(this,args),digest=result.digest;result.digest=function(...params){const output=digest.apply(this,params);if(afterExit){afterExit=false;offset+=31000000000n;}return output;};return result;};
process.hrtime.bigint=()=>clock()+offset;syncBuiltinESMExports();await import('./measure-server.mjs');
