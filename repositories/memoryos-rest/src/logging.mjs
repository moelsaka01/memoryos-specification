import { jsonBytes } from './serialization.mjs';
import { api, limits, routeById } from './contracts.mjs';
const events = new Set(['startup','requestCompleted','requestRejected','requestCancelled','shutdown','fatal','logsDropped']);
export class Logger {
  constructor(stream=process.stderr) { this.stream=stream;this.pending=0;this.dropped=0;this.closed=false;stream.on('error',()=>{this.closed=true;}); }
  emit(event,code=null,operationId=null,requestId=null) {
    if(this.closed || !events.has(event)) return;
    if(code!==null && !Object.hasOwn(api.errors,code))code=null;
    if(operationId!==null && !routeById.has(operationId))operationId=null;
    if(requestId!==null && (typeof requestId!=='string'||!new RegExp(api.headers.requestIdPattern,'u').test(requestId)))requestId=null;
    if(event==='logsDropped'){code=null;operationId=null;requestId=null;}
    const bytes=Buffer.concat([jsonBytes({event,code,operationId,requestId}),Buffer.from('\n')]);
    if(bytes.length>limits.fixed.logRecordBytes || this.pending+bytes.length>limits.fixed.logQueueBytes){this.dropped=Math.min(this.dropped+1,Number.MAX_SAFE_INTEGER);return;}
    this.pending+=bytes.length;
    try { this.stream.write(bytes,()=>{this.pending-=bytes.length;if(this.dropped && !this.closed){this.dropped=0;this.emit('logsDropped');}}); }
    catch {this.pending-=bytes.length;this.closed=true;}
  }
}
