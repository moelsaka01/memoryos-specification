import { memoryExceeded, withinBytes } from './resource-policy.mjs';
import tls from 'node:tls';
import http from 'node:http';
import { limits, api, validate, validateInput, versionProduct } from './contracts.mjs';
import { parseJSON, requestJSONLimits } from './json.mjs';
import { parseHeader, parserAgrees, headerPolicy, mediaPolicy } from './raw-gate.mjs';
import { authenticate } from './config.mjs';
import { TokenBucket, Slots, Ownership, now, ms, deadlineReached, atDeadline, cancelDeadline } from './admission.mjs';
import { jsonBytes } from './serialization.mjs';
import { errorProduct, reject } from './errors.mjs';
import { verifyDistribution, packageRoot } from './integrity.mjs';
import { runSemantic } from './semantic.mjs';
import { Logger } from './logging.mjs';

/** Same installed implementation for normal entry point and isolated measurement launcher.
 * observe receives bounded numeric timing/memory records, never input/products/secrets.
 * The normal service supplies no observer and exposes no metrics protocol. */
export async function startGateway(config, manifest, {logger=new Logger(), observe=null, observeState=null, observeLifecycle=null, signal=null}={}) {
  const fixed=limits.fixed, connections=new Map(), requests=new Slots(fixed.requestSlots), writes=new Slots(fixed.writeSlots), semantic=new Ownership();
  const connectionBucket=new TokenBucket(fixed.connectionRate,fixed.connectionBurst), requestBucket=new TokenBucket(fixed.requestRate,fixed.requestBurst);
  let draining=false,poisoned=false,exitCode=0,shutdownPromise=null,resolveClosed,watchdog=null;
  let state='INITIALIZING';
  function transition(next){state=next;if(observeLifecycle)observeLifecycle(next);}
  transition(state);
  const closed=new Promise(resolve=>{resolveClosed=resolve;});
  // Keep missing-Host errors inside the authenticated frozen header policy.
  const httpServer=http.createServer({requireHostHeader:false,insecureHTTPParser:false,maxHeaderSize:fixed.headerBytes,highWaterMark:fixed.streamHighWaterMark,headersTimeout:0,requestTimeout:0,keepAliveTimeout:0,connectionsCheckingInterval:1000},handle);
  httpServer.maxHeadersCount=0;httpServer.maxRequestsPerSocket=1;httpServer.timeout=0;httpServer.keepAliveTimeoutBuffer=0;
  let server;
  try { server=tls.createServer({key:config.key,cert:config.cert,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',
    ciphers:'TLS_AES_256_GCM_SHA384:TLS_AES_128_GCM_SHA256',ALPNProtocols:['http/1.1'],requestCert:false,
    rejectUnauthorized:false,handshakeTimeout:fixed.handshakeMs,highWaterMark:fixed.streamHighWaterMark,allowHalfOpen:true},secure); } catch(error){transition('FAILED');throw error;}
  const key=socket=>socket.remoteAddress+':'+socket.remotePort;
  function captureMemory(context) {
    const memory=process.memoryUsage();
    if(context.metrics.parentBaselineHeapBytes===undefined){context.metrics.parentBaselineHeapBytes=memory.heapTotal;context.metrics.parentBaselineExternalBytes=memory.external;context.metrics.processBaselineRssBytes=memory.rss;}
    context.metrics.parentHeapBytes=Math.max(context.metrics.parentHeapBytes,memory.heapTotal);
    context.metrics.parentExternalBytes=Math.max(context.metrics.parentExternalBytes,memory.external);
    context.metrics.processRssBytes=Math.max(context.metrics.processRssBytes,memory.rss);
  }
  function report(context) {
    if(!observe || context.reported)return;context.reported=true;captureMemory(context);
    try{observe({...context.metrics,connections:connections.size,requestSlots:requests.active.size,writeSlots:writes.active.size,workers:semantic.owner?.worker?1:0});}catch{}
  }
  function release(context) {
    context.bodyBufferBytes=0;cancelDeadline(context.timer);cancelDeadline(context.writeTimer);requests.release(context);writes.release(context);
    if(context.owner){context.owner.responseDone=true;semantic.release(context.owner);}
    if(context.writeStart)context.metrics.writeUs=Number((now()-context.writeStart)/1000n);
    if(!context.owner||context.owner.reaped)report(context);
  }
  function failedCode(error){return Object.hasOwn(api.errors,error?.code)?error.code:'MO1305_INTERNAL_FAILURE';}
  function poison(code){if(!poisoned){poisoned=true;exitCode=Math.max(exitCode,1);transition('FAILED');logger.emit('fatal',code);}}
  function fatal(code){poison(code);void shutdown(1);}
  function send(context,product,status=null,extra={}) {
    if(context.published||context.socket.destroyed||!context.socket.writable||context.cancelled)return;
    if(context.owner && (!semantic.valid(context.owner)||!context.owner.reaped))return;
    if(context.owner && deadlineReached(context.owner.deadline) && !poisoned)product=errorProduct('MO1305_OPERATION_TIMEOUT');
    if(product.status==='ok'){
      const integrityStart=now();try{verifyDistribution(packageRoot,manifest);}catch{poison('MO1305_RUNTIME_INTEGRITY');product=errorProduct('MO1305_RUNTIME_INTEGRITY');}
      if(context.owner)context.metrics.integrityUs+=Number((now()-integrityStart)/1000n);
      if(product.status==='ok'&&(poisoned||draining)){product=errorProduct('MO1305_UNAVAILABLE');}
    }
    const error=product.status==='error', code=error?product.error.code:null;
    status=status??(error?api.errors[code]?.status:200);
    if(status===null || !Number.isInteger(status)){context.socket.destroy();return;}
    let bytes;
    try{bytes=jsonBytes(product);}catch{product=errorProduct('MO1305_INTERNAL_FAILURE');bytes=jsonBytes(product);status=500;}
    const maximum=context.route?limits.measured.operations[context.route.operationId].responseBytes:limits.measured.earlyErrorBytes;
    if(!withinBytes(bytes.length,maximum)){product=errorProduct('MO1305_OUTPUT_LIMIT');bytes=jsonBytes(product);status=500;}
    if(!writes.acquire(context)){context.socket.destroy();return;}
    const headers={...api.headers.response,'content-length':String(bytes.length),...extra};
    if(status===401)headers['www-authenticate']='Bearer realm="memoryos-rest"';
    if(status===429||product.error?.code==='MO1305_BUSY')headers['retry-after']='1';
    if(context.requestId!==null)headers['x-request-id']=context.requestId;
    captureMemory(context);context.metrics.outputBytes=bytes.length;context.writeStart=now();context.writeDeadline=context.writeStart+ms(fixed.writeMs);
    cancelDeadline(context.timer);
    context.writeTimer=atDeadline(context.writeDeadline,()=>context.socket.destroy());
    // Ownership, integrity and cancellation checks occur in this same synchronous turn before end().
    if(context.cancelled||context.socket.destroyed||(context.owner&&!semantic.valid(context.owner))){context.socket.destroy();return;}
    if(context.owner){
      if(!poisoned&&deadlineReached(context.owner.deadline)){product=errorProduct('MO1305_OPERATION_TIMEOUT');bytes=jsonBytes(product);status=504;headers['content-length']=String(bytes.length);delete headers['retry-after'];context.metrics.outputBytes=bytes.length;}
      context.metrics.operationUs=Number((now()-context.owner.started+999n)/1000n);
    }
    context.published=true;if(context.owner)context.owner.state='published';
    logger.emit(product.status==='error'?'requestRejected':'requestCompleted',product.error?.code??null,context.route?.operationId??null,context.requestId);
    if(context.response){
      context.response.sendDate=false;context.response.shouldKeepAlive=false;
      context.response.writeHead(status,headers);context.response.end(bytes);
    }else{
      const head=Buffer.from('HTTP/1.1 '+status+' '+http.STATUS_CODES[status]+'\r\n'+Object.entries(headers).map(([k,v])=>k+': '+v).join('\r\n')+'\r\n\r\n','ascii');
      context.socket.end(context.method==='HEAD'?head:Buffer.concat([head,bytes]),()=>release(context));
    }
    if(poisoned)void shutdown(1);
  }
  function fail(context,code,extra={}) {
    if(context.published){context.socket.destroy();return;}
    if(context.owner && !context.owner.reaped){context.pendingError=code;context.owner.cancel(code);return;}
    send(context,errorProduct(code),null,extra);
  }
  function cancel(context) {
    if(!context.cancelled && !context.published){context.cancelled=true;logger.emit('requestCancelled','MO1305_CLIENT_CANCELLED',context.route?.operationId??null,context.requestId);}
    if(context.owner&&!context.owner.reaped)context.owner.cancel('MO1305_CLIENT_CANCELLED');
    release(context);
  }
  function timeout(context,deadline,code) {
    cancelDeadline(context.timer);context.deadline=deadline;
    context.timer=atDeadline(deadline,()=>fail(context,code));
  }
  server.on('connection',socket=>{
    if(draining||connections.size>=fixed.connections||!connectionBucket.take()){socket.destroy();return;}
    const context={rawSocket:socket,socket,created:now(),timer:null,writeTimer:null,gate:null,route:null,owner:null,response:null,requestId:null,
      published:false,cancelled:false,seenRequest:false,method:null,pendingError:null,metrics:{inputBytes:0,outputBytes:0,headerBytes:0,headerCount:0,gateRetainedBytes:0,parseUs:0,validationUs:0,bufferUs:0,writeUs:0,parentHeapBytes:0,parentExternalBytes:0,processRssBytes:0}};
    context.key=key(socket);connections.set(context.key,context);captureMemory(context);
    context.timer=atDeadline(context.created+ms(fixed.handshakeMs),()=>socket.destroy());
    socket.on('error',()=>socket.destroy());
    socket.once('close',()=>{if(connections.get(context.key)===context)connections.delete(context.key);cancel(context);});
  });
  server.on('tlsClientError',(_error,socket)=>socket.destroy());
  server.on('error',()=>{if(state==='INITIALIZING')return;fatal('MO1305_UNAVAILABLE');});
  function secure(socket) {
    const context=connections.get(key(socket));
    if(!context||draining||deadlineReached(context.created+ms(fixed.handshakeMs))||socket.getProtocol()!=='TLSv1.3'||(socket.alpnProtocol&&socket.alpnProtocol!=='http/1.1')){socket.destroy();return;}
    context.socket=socket;socket.pause();socket.setNoDelay(true);
    socket.on('error',()=>socket.destroy());socket.once('close',()=>{if(connections.get(context.key)===context)connections.delete(context.key);cancel(context);});
    timeout(context,now()+ms(fixed.headerMs),'MO1305_REQUEST_TIMEOUT');
    let retained=Buffer.alloc(0);
    function gate(chunk){
      if(context.published||context.cancelled)return;
      if(deadlineReached(context.deadline)){fail(context,'MO1305_REQUEST_TIMEOUT');return;}
      if(chunk.length>fixed.gateReadChunkBytes){fail(context,'MO1305_INPUT_LIMIT');return;}
      retained=Buffer.concat([retained,chunk]);context.metrics.gateRetainedBytes=Math.max(context.metrics.gateRetainedBytes,retained.length);
      const end=retained.indexOf('\r\n\r\n');
      if(end<0){if(retained.length>fixed.headerBytes)fail(context,'MO1305_HEADER_LIMIT');return;}
      try{
        if(retained.subarray(0,5).toString('ascii')==='HEAD ')context.method='HEAD';
        context.gate=parseHeader(retained.subarray(0,end+4));context.method=context.gate.method;
        context.headersComplete=now();context.metrics.headerBytes=end+4;context.metrics.headerCount=context.gate.headerCount;
      }catch(error){fail(context,failedCode(error));return;}
      socket.pause();socket.off('data',gate);socket.off('end',headerEnd);
      // Count unchanged parser input, including any coalesced body/second request.
      let received=0;
      socket.on('data',chunk=>{
        received+=chunk.length;
        if(received>context.gate.headerBytes+context.gate.length)fail(context,'MO1305_REQUEST_SYNTAX');
        if(!context.published&&context.deadline&&deadlineReached(context.deadline))fail(context,'MO1305_REQUEST_TIMEOUT');
        if(context.published&&context.writeDeadline&&deadlineReached(context.writeDeadline))socket.destroy();
      });
      socket.unshift(retained);retained=null;
      httpServer.emit('connection',socket);socket.resume();
    }
    function headerEnd(){fail(context,'MO1305_REQUEST_TIMEOUT');}
    socket.on('data',gate);socket.once('end',headerEnd);socket.resume();
  }
  httpServer.on('clientError',(error,socket)=>{
    const context=connections.get(key(socket));if(!context){socket.destroy();return;}
    fail(context,error.code==='HPE_HEADER_OVERFLOW'?'MO1305_HEADER_LIMIT':error.code==='HPE_INVALID_EOF_STATE'?'MO1305_REQUEST_TIMEOUT':'MO1305_REQUEST_SYNTAX');
  });
  for(const event of ['upgrade','connect'])httpServer.on(event,(request,socket)=>{const c=connections.get(key(socket));if(c)fail(c,'MO1305_REQUEST_SYNTAX');else socket.destroy();});
  httpServer.on('checkContinue',(_request,response)=>{const c=connections.get(key(response.socket));if(c)fail(c,'MO1305_REQUEST_SYNTAX');else response.destroy();});
  httpServer.on('dropRequest',(_request,socket)=>{const c=connections.get(key(socket));if(c)fail(c,'MO1305_REQUEST_SYNTAX');socket.destroy();});
  async function handle(request,response) {
    const context=connections.get(key(request.socket));
    if(!context||context.seenRequest){request.socket.destroy();return;}
    context.seenRequest=true;context.response=response;
    response.sendDate=false;response.on('error',()=>request.socket.destroy());response.once('finish',()=>release(context));
    request.once('aborted',()=>{if(!context.published)fail(context,'MO1305_REQUEST_TIMEOUT');});
    request.on('error',()=>{if(!context.published)fail(context,'MO1305_REQUEST_SYNTAX');});
    try{
      if(context.published||context.cancelled)return;
      if(!parserAgrees(request,context.gate))reject('REQUEST_SYNTAX');
      if(deadlineReached(context.deadline))reject('REQUEST_TIMEOUT');
      if(!requestBucket.take())reject('RATE_LIMIT');
      if(!authenticate(context.gate.headers.authorization,config.token))reject('UNAUTHENTICATED');
      const id=context.gate.headers['x-request-id'];
      if(typeof id==='string'&&new RegExp(api.headers.requestIdPattern,'u').test(id))context.requestId=id;
      headerPolicy(context.gate,config);
      const route=api.routes.find(r=>r.path===request.url);
      if(!route)reject('NOT_FOUND');
      if(route.method!==request.method){fail(context,'MO1305_METHOD_NOT_ALLOWED',{allow:route.method});return;}
      context.route=route;mediaPolicy(context.gate,route);
      if(draining||poisoned)reject('UNAVAILABLE');
      if(!requests.acquire(context))reject('BUSY');
      const started=now();timeout(context,context.headersComplete+ms(fixed.bodyMs),'MO1305_REQUEST_TIMEOUT');
      const length=context.gate.length, body=Buffer.alloc(length);context.bodyBufferBytes=length;let offset=0;
      await new Promise((resolve,rejectBody)=>{
        request.on('data',chunk=>{
          if(context.published||context.cancelled){rejectBody(new Error('CANCELLED'));return;}
          if(deadlineReached(context.deadline)){rejectBody({code:'MO1305_REQUEST_TIMEOUT'});return;}
          if(offset+chunk.length>length){rejectBody({code:'MO1305_REQUEST_SYNTAX'});return;}
          chunk.copy(body,offset);offset+=chunk.length;
        });
        request.once('end',()=>offset===length?resolve():rejectBody({code:'MO1305_REQUEST_TIMEOUT'}));
        request.once('aborted',()=>rejectBody({code:'MO1305_REQUEST_TIMEOUT'}));
        request.once('error',()=>rejectBody({code:'MO1305_REQUEST_SYNTAX'}));
      });
      cancelDeadline(context.timer);context.deadline=null;context.metrics.bufferUs=Number((now()-started)/1000n);context.metrics.inputBytes=body.length;
      if(context.published||context.cancelled)return;
      let input=null;
      if(route.input){
        let phase=now();input=parseJSON(body,requestJSONLimits(fixed,limits.measured.operations[route.operationId].requestBytes));context.metrics.parseUs=Number((now()-phase)/1000n);
        phase=now();validateInput(route,input);context.metrics.validationUs=Number((now()-phase)/1000n);
      }
      let product;
      if(route.category==='semantic'){
        try{context.owner=semantic.reserve(request.socket);}catch(error){
          if(error?.code!=='MO1305_UNAVAILABLE')throw error;
          fail(context,error.code);void shutdown(0);return;
        }
        const result=await runSemantic(context.owner,route.operationId,input,manifest,poison);Object.assign(context.metrics,result.metrics);
        if(context.pendingError){context.owner.cancelled=false;product=errorProduct(context.pendingError);}
        else product=result.product;
        if(context.cancelled){context.owner.responseDone=true;semantic.release(context.owner);report(context);if(poisoned)void shutdown(1);return;}
      }else if(route.operationId==='getHealth')product={status:'ok',live:true};
      else if(route.operationId==='getReadiness')product=semantic.owner?errorProduct('MO1305_BUSY'):{status:'ok',ready:true};
      else product=versionProduct;
      if(!validate(product.status==='error'?'Error':route.output,product))reject('INTERNAL_FAILURE');
      send(context,product);
    }catch(error){fail(context,failedCode(error));}
  }
  function reportState(){if(observeState)observeState({utcMs:Date.now(),memory:process.memoryUsage(),connections:connections.size,requestSlots:requests.active.size,writeSlots:writes.active.size,workers:semantic.owner?.worker?1:0,bodyBuffers:Array.from(connections.values()).filter(c=>c.bodyBufferBytes).length,bodyBufferBytes:Array.from(connections.values()).reduce((sum,c)=>sum+(c.bodyBufferBytes??0),0),published:Array.from(connections.values()).filter(c=>c.published).length,semanticOwners:semantic.owner?1:0,draining:draining?1:0});}
  function sample(){
    reportState();
    const memory=process.memoryUsage(),heap=memory.heapTotal,external=memory.external;
    for(const context of connections.values()){
      context.metrics.parentHeapBytes=Math.max(context.metrics.parentHeapBytes,heap);context.metrics.parentExternalBytes=Math.max(context.metrics.parentExternalBytes,external);context.metrics.processRssBytes=Math.max(context.metrics.processRssBytes,memory.rss);
    }
    if(memoryExceeded({parentHeapMiB:heap,parentExternalMiB:external,processRssMiB:memory.rss}))fatal('MO1305_OUTPUT_LIMIT');
  }
  function shutdown(code=0) {
    // A later fatal trigger must upgrade an already running requested drain.
    exitCode=Math.max(exitCode,code);
    if(code!==0&&state!=='FAILED')transition('FAILED');
    if(shutdownPromise)return shutdownPromise;
    draining=true;if(state!=='FAILED')transition('DRAINING');logger.emit('shutdown');
    const deadline=now()+ms(fixed.shutdownMs);
    shutdownPromise=Promise.resolve().then(async()=>{
      // This bound also covers a close callback that never arrives. It cannot
      // leave a successful closed promise with live listener/process handles.
      const force=atDeadline(deadline,()=>{exitCode=1;transition('FAILED');for(const context of connections.values()){context.socket.destroy();context.rawSocket.destroy();}process.exit(1);});
      const stopped=new Promise(resolve=>server.close(resolve));
      for(const context of connections.values())if(!context.published){cancel(context);context.socket.destroy();context.rawSocket.destroy();}
      while(semantic.owner||connections.size){
        if(semantic.owner)semantic.release(semantic.owner);
        if(semantic.owner||connections.size)await new Promise(resolve=>setTimeout(resolve,10));
      }
      await stopped;
      cancelDeadline(force);clearInterval(watchdog);
      signal?.removeEventListener('abort',abort);
      if(state!=='FAILED')transition(exitCode===0?'STOPPED':'FAILED');
      reportState();resolveClosed(exitCode);return exitCode;
    });return shutdownPromise;
  }
  function abort(){void shutdown(signal.reason===1?1:0);}
  const gateway={closed,shutdown,address:()=>server.address(),get state(){return state;}};
  if(signal?.aborted){await shutdown(signal.reason===1?1:0);return gateway;}
  signal?.addEventListener('abort',abort,{once:true});
  try {
    await new Promise((resolve,rejectListen)=>{
      const failed=error=>{server.off('listening',listening);rejectListen(error);};
      const listening=()=>{server.off('error',failed);resolve();};
      server.once('error',failed);server.once('listening',listening);
      closed.then(()=>{server.off('error',failed);server.off('listening',listening);resolve();});
      server.listen({host:config.bindAddress,port:config.port,exclusive:true,...(signal?{signal}:{})});
    });
  } catch(error){transition('FAILED');await shutdown(2);throw error;}
  if(draining){await shutdownPromise;return gateway;}
  watchdog=setInterval(sample,fixed.sampleMs);
  transition('READY');reportState();logger.emit('startup');
  return gateway;
}
