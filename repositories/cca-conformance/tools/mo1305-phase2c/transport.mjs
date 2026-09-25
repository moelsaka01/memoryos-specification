import assert from 'node:assert/strict';
import net from 'node:net';
import tls from 'node:tls';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
import {launch,wire,response,request,vectors,delay,api,credentials,stage,port} from './common.mjs';

/** Real entrypoint, unmodified Node parser, native TLS and semantic workers.
 * Records retain only case identities and bounded observations, never raw input,
 * credentials, response artifacts, or diagnostic prose. */
export async function runTransport() {
  const limits=JSON.parse(readFileSync(resolve(stage,'package/contracts/limits.json')));
  assert.equal(limits.state,'FINAL');
  const fixed=limits.fixed, host='127.0.0.1:'+port, records=[], cases=[];
  const add=(id,category,raw,status,code,options={})=>cases.push({id,category,raw,status,code,...options});
  const health=()=>request('getHealth').toString();
  const post=(body='{}',headers={})=>request('preparePolicy',body,{headers});
  const withHeader=(raw,line)=>raw.toString().replace('\r\n\r\n','\r\n'+line+'\r\n\r\n');
  const withLine=line=>health().replace('GET /v1/health HTTP/1.1',line);
  const pass=(id,category,details={})=>records.push({id,category,state:'PASS',...details});
  const vector=vectors().find(v=>v.id==='prepare-policy-pass');
  assert.ok(vector,'INDEPENDENT_FIXTURE_REQUIRED');

  for(const [name,line] of [
    ['tab','GET\t/v1/health HTTP/1.1'],['extra-space','GET  /v1/health HTTP/1.1'],
    ['lowercase','get /v1/health HTTP/1.1'],['nul','GET /v1/health\0 HTTP/1.1'],
    ['bad-version','GET /v1/health HTTP/one'],['h2-preface','PRI * HTTP/2.0'],
    ['absolute','GET https://'+host+'/v1/health HTTP/1.1'],
    ['authority','CONNECT '+host+' HTTP/1.1'],['asterisk','OPTIONS * HTTP/1.1']
  ])add('line-'+name,'http-framing',withLine(line),400,'REQUEST_SYNTAX');
  for(const version of ['1.0','2.0','9.9'])add('http-version-'+version,'http-framing',withLine('GET /v1/health HTTP/'+version),505,'HTTP_VERSION');
  for(const [name,target] of [['query','/v1/health?x=1'],['fragment','/v1/health#x'],['percent','/v1/%68ealth'],['backslash','/v1\\health'],['dot','/v1/./health'],['dotdot','/v1/../health'],['double-slash','/v1//health']])
    add('target-'+name,'http-framing',request('getHealth',null,{path:target}),400,'REQUEST_SYNTAX');
  for(const n of [fixed.targetBytes-1,fixed.targetBytes,fixed.targetBytes+1])
    add('target-bytes-'+n,'http-framing',request('getHealth',null,{path:'/'+'a'.repeat(n-1)}),n<=fixed.targetBytes?404:414,n<=fixed.targetBytes?'NOT_FOUND':'TARGET_LIMIT',{boundary:{dimension:'targetBytes',limit:fixed.targetBytes,actual:n}});
  for(const n of [fixed.requestLineBytes-1,fixed.requestLineBytes,fixed.requestLineBytes+1]){
    const line='A'.repeat(n-13)+' / HTTP/1.1';assert.equal(line.length+2,n);
    add('request-line-bytes-'+n,'http-framing',withLine(line),n<=fixed.requestLineBytes?400:431,n<=fixed.requestLineBytes?'REQUEST_SYNTAX':'HEADER_LIMIT',{boundary:{dimension:'requestLineBytes',limit:fixed.requestLineBytes,actual:n}});
  }
  for(const [name,value] of [
    ['invalid-name','X@: y'],['space-colon','X : y'],['obs-fold',' X: y'],['tab','X:\ty'],
    ['bare-cr','X: y\rz'],['bare-lf','X: y\nz'],['nul','X: \0'],['control','X: \x1b'],
    ['non-ascii','X: é'],['duplicate-host','hOsT: '+host],
    ['duplicate-authorization','AUTHORIZATION: Bearer '+credentials.token],
    ['duplicate-unknown','Connection: close']
  ])add('header-'+name,'http-framing',withHeader(health(),value),400,'REQUEST_SYNTAX');
  add('header-crlf-injection','http-framing',withHeader(health(),'User-Agent: witness\r\nHost: attacker'),400,'REQUEST_SYNTAX');
  for(const n of [fixed.headerCount-1,fixed.headerCount,fixed.headerCount+1]){
    const raw=health(),count=raw.split('\r\n').length-3;
    const extra=Array.from({length:n-count},(_,i)=>'X-'+i+': x').join('\r\n');
    add('header-count-'+n,'http-framing',withHeader(raw,extra),n<=fixed.headerCount?403:431,n<=fixed.headerCount?'FORBIDDEN':'HEADER_LIMIT',{boundary:{dimension:'headerCount',limit:fixed.headerCount,actual:n}});
  }
  for(const n of [fixed.headerValueBytes-1,fixed.headerValueBytes,fixed.headerValueBytes+1])
    add('header-value-'+n,'http-framing',request('getHealth',null,{headers:{X:'a'.repeat(n)}}),n<=fixed.headerValueBytes?403:431,n<=fixed.headerValueBytes?'FORBIDDEN':'HEADER_LIMIT',{boundary:{dimension:'headerValueBytes',limit:fixed.headerValueBytes,actual:n}});
  for(const n of [fixed.headerBytes-1,fixed.headerBytes,fixed.headerBytes+1]){
    let raw=health().slice(0,-2),index=0;
    while(n-raw.length-2>1035)raw+='X-'+index+++': '+'a'.repeat(1000)+'\r\n';
    raw+='Z: '+'z'.repeat(n-raw.length-7)+'\r\n\r\n';assert.equal(Buffer.byteLength(raw),n);
    add('header-total-'+n,'http-framing',raw,n<=fixed.headerBytes?403:431,n<=fixed.headerBytes?'FORBIDDEN':'HEADER_LIMIT',{boundary:{dimension:'headerBytes',limit:fixed.headerBytes,actual:n}});
  }
  for(const [name,value] of [['combined','2,2'],['signed','+2'],['leading-zero','02'],['negative','-1'],['unsafe','9007199254740992'],['long','9999999999999999999999999']])
    add('content-length-'+name,'http-framing',post('{}',{'Content-Length':value}),400,'REQUEST_SYNTAX');
  for(const [name,line] of [['equal-length','Content-Length: 2'],['conflicting-length','content-length: 3'],['cl-te-chunked','Transfer-Encoding: chunked'],['cl-te-identity','transfer-encoding: identity'],['cl-te-empty','Transfer-Encoding:'],['expect','Expect: 100-continue'],['upgrade','Upgrade: websocket'],['trailer','Trailer: x']])
    add('framing-'+name,'http-framing',withHeader(post(),line),400,'REQUEST_SYNTAX');
  const noLength=post().toString().replace('Content-Length: 2\r\n','');
  add('framing-te-cl-order','http-framing',post().toString().replace('Content-Length: 2','Transfer-Encoding: chunked\r\nContent-Length: 2'),400,'REQUEST_SYNTAX');
  add('framing-te-only-chunks','http-framing',withHeader(noLength.slice(0,-2),'Transfer-Encoding: chunked')+'2\r\n{}\r\n0\r\n\r\n',400,'REQUEST_SYNTAX');
  add('framing-chunk-extension-trailers','http-framing',withHeader(noLength.slice(0,-2),'Transfer-Encoding: chunked')+'2;ext=x\r\n{}\r\n0\r\nX-Trailer: attack\r\n\r\n',400,'REQUEST_SYNTAX');
  add('framing-te-only-unknown','http-framing',withHeader(noLength.slice(0,-2),'Transfer-Encoding: unknown'),400,'REQUEST_SYNTAX');
  add('framing-no-length','http-framing',noLength.slice(0,-2),411,'LENGTH_REQUIRED');
  add('framing-zero-post-length','http-framing',post('',{'Content-Length':'0'}),411,'LENGTH_REQUIRED');
  add('framing-body-excess','http-framing',Buffer.concat([post(),Buffer.from('x')]),400,'REQUEST_SYNTAX');
  add('framing-pipeline-before-publication','http-framing',Buffer.concat([request('getHealth'),request('getContractIdentities')]),400,'REQUEST_SYNTAX');
  add('framing-pipeline-after-rejected-first','http-framing',Buffer.concat([request('getHealth',null,{headers:{Authorization:null}}),request('getHealth')]),400,'REQUEST_SYNTAX');

  for(const route of api.routes)add('auth-absent-'+route.operationId,'authentication',request(route.operationId,null,{headers:{Authorization:null}}),401,'UNAUTHENTICATED');
  const wrong=(credentials.token[0]==='0'?'1':'0')+credentials.token.slice(1);
  for(const [name,value] of [['wrong-scheme','Basic abc'],['scheme-case','bearer '+credentials.token],['double-space','Bearer  '+credentials.token],['empty','Bearer'],['short','Bearer '+'0'.repeat(63)],['long','Bearer '+'0'.repeat(65)],['token-case','Bearer '+'A'.repeat(64)],['not-hex','Bearer '+'g'.repeat(64)],['wrong','Bearer '+wrong],['suffix','Bearer '+credentials.token+' x']])
    add('auth-'+name,'authentication',request('getHealth',null,{headers:{Authorization:value}}),401,'UNAUTHENTICATED');
  add('auth-query-credential','authentication',request('getHealth',null,{path:'/v1/health?token='+credentials.token,headers:{Authorization:null}}),400,'REQUEST_SYNTAX');
  add('auth-cookie-credential','authentication',request('getHealth',null,{headers:{Authorization:null,Cookie:'token='+credentials.token}}),401,'UNAUTHENTICATED');
  add('auth-missing-host-precedence','authentication',request('getHealth',null,{headers:{Authorization:null,Host:null}}),401,'UNAUTHENTICATED');
  add('auth-invalid-before-host','authentication',request('getHealth',null,{headers:{Authorization:'Bearer '+wrong,Host:'attacker'}}),401,'UNAUTHENTICATED');
  add('auth-invalid-no-request-id-echo','authentication',request('getHealth',null,{headers:{Authorization:'Bearer '+wrong,'X-Request-ID':'unauthenticated'}}),401,'UNAUTHENTICATED');

  for(const [name,value] of [['missing',null],['wrong','127.0.0.2:'+port],['alias','localhost:'+port],['no-port','127.0.0.1'],['userinfo','user@'+host],['wrong-port','127.0.0.1:'+(port+1)],['list',host+',evil'],['rebinding','127.0.0.1.evil:'+port],['internal-space','127.0.0.1 :'+port],['ipv6','[::1]:'+port]])
    add('host-'+name,'host-proxy',request('getHealth',null,{headers:{Host:value}}),403,'FORBIDDEN');
  for(const [name,value] of [['Forwarded','for=127.0.0.1;host='+host+';proto=https'],['X-Forwarded-For','127.0.0.1'],['X-Forwarded-Host',host],['X-Forwarded-Proto','https'],['X-Forwarded-Port',String(port)],['X-Forwarded-Authorization','Bearer '+credentials.token],['X-Real-IP','127.0.0.1'],['Proxy-Authorization','Bearer '+credentials.token],['Via','trusted-proxy'],['X-HTTP-Method-Override','GET'],['Origin','https://'+host],['Cookie','token='+credentials.token],['Idempotency-Key','attacker']])
    add('proxy-'+name.toLowerCase(),'host-proxy',request('getHealth',null,{headers:{[name]:value}}),403,'FORBIDDEN');

  for(const [name,value] of [['plain','text/plain'],['wrong-charset','application/json;charset=latin1'],['duplicate-charset','application/json; charset=utf-8; charset=utf-8'],['unknown-parameter','application/json;x=y'],['missing',null]])
    add('media-'+name,'content-negotiation',post().toString().replace('Content-Type: application/json\r\n',value===null?'':'Content-Type: '+value+'\r\n'),415,'UNSUPPORTED_MEDIA');
  for(const value of ['gzip','deflate','br'])add('media-encoding-'+value,'content-negotiation',post('{}',{'Content-Encoding':value}),415,'UNSUPPORTED_MEDIA');
  add('media-actual-gzip-body','content-negotiation',post(gzipSync(Buffer.from(JSON.stringify(vector.input))),{'Content-Encoding':'gzip'}),415,'UNSUPPORTED_MEDIA');
  for(const [name,value] of [['event-stream','text/event-stream'],['quality','application/json;q=1'],['list','application/json, */*'],['empty','']])
    add('accept-'+name,'content-negotiation',request('getHealth',null,{headers:{Accept:value}}),406,'NOT_ACCEPTABLE');
  for(const value of ['gzip','br','*','identity;q=1'])add('accept-encoding-'+value.replace(/[^a-z]/gu,''),'content-negotiation',request('getHealth',null,{headers:{'Accept-Encoding':value}}),406,'NOT_ACCEPTABLE');
  const bodyLimit=limits.measured.operations.preparePolicy.requestBytes;
  add('media-body-over-final-limit','content-negotiation',post(' '.repeat(bodyLimit+1)),413,'INPUT_LIMIT',{boundary:{dimension:'requestBytes',limit:bodyLimit,actual:bodyLimit+1}});
  add('media-get-body','content-negotiation',request('getHealth','x',{headers:{'Content-Length':'1'}}),400,'REQUEST_SCHEMA');

  const marker='PHASE2C_PRIVATE_INPUT_WITNESS';
  add('log-cr-injection','logging-secrets',request('getHealth',null,{headers:{'X-Request-ID':marker+'\rattack'}}),400,'REQUEST_SYNTAX');
  add('log-lf-injection','logging-secrets',request('getHealth',null,{headers:{'X-Request-ID':marker+'\nattack'}}),400,'REQUEST_SYNTAX');
  add('log-control-injection','logging-secrets',request('getHealth',null,{headers:{'User-Agent':marker+'\x1b'}}),400,'REQUEST_SYNTAX');
  add('log-structured-header-discarded','logging-secrets',request('getHealth',null,{headers:{'User-Agent':'{"event":"fatal","secret":"'+marker+'"}'}}),200,null);
  add('log-body-discarded','logging-secrets',post(JSON.stringify({unknown:marker})),400,'REQUEST_SCHEMA');
  add('log-hostile-path-discarded','logging-secrets',request('getHealth',null,{path:'/'+marker}),404,'NOT_FOUND');
  add('log-invalid-id-discarded','logging-secrets',request('getHealth',null,{headers:{'X-Request-ID':'{"event":"fatal"}'}}),400,'REQUEST_SCHEMA');

  const state=await launch();
  try {
    let unauthorized=null;
    for(const item of cases){
      await delay(60);
      const received=await wire(item.raw);let result;try{result=response(received);}catch(error){throw new Error(item.id+' RESPONSE_CONTRACT '+error.message);}
      assert.equal(result.status,item.status,item.id);
      if(item.code){
        assert.deepEqual(result.body,{status:'error',error:{code:'MO1305_'+item.code,semantic:null}},item.id);
        assert.equal(result.bytes.length<=limits.measured.earlyErrorBytes,true,item.id);
      }
      if(item.code==='UNAUTHENTICATED'){
        assert.equal(result.headers['www-authenticate'],'Bearer realm="memoryos-rest"',item.id);
        assert.equal(result.headers['x-request-id'],undefined,item.id);
        unauthorized??=result.bytes;assert.deepEqual(result.bytes,unauthorized,item.id);
      }
      pass(item.id,item.category,{status:result.status,code:item.code?'MO1305_'+item.code:null,...(item.boundary?{boundary:item.boundary}:{})});
    }

    for(const [id,raw] of [['eof-incomplete-header',health().slice(0,-5)],['eof-incomplete-body',post('{}',{'Content-Length':'3'})]]){
      await delay(60);const bytes=await wire(raw,{end:true,allowClose:true});
      if(bytes.length){const result=response(bytes);assert.equal(result.status,408,id);assert.deepEqual(result.body,{status:'error',error:{code:'MO1305_REQUEST_TIMEOUT',semantic:null}},id);}
      pass(id,'http-framing',{status:bytes.length?408:null,code:bytes.length?'MO1305_REQUEST_TIMEOUT':'NO_HTTP_RESPONSE',allowedOutcome:'408_WHEN_WRITABLE_ELSE_CONNECTION_CLOSE'});
    }
    for(const [id,chunks] of [['semantic-coalesced',[request(vector.operation,vector.input)]],['semantic-byte-fragmented',Array.from(request(vector.operation,vector.input),x=>Buffer.from([x]))]]){
      await delay(60);const result=response(await wire(chunks));assert.equal(result.status,200,id);assert.deepEqual(result.body,vector.expected,id);
      pass(id,'http-framing',{status:200,semanticFixture:vector.id,bodySha256:sha(result.bytes),actualSemanticWorker:true});
    }
    for(const [id,headers] of [['media-case-and-quoted-charset',{'Content-Type':'APPLICATION/JSON; charset="UTF-8"',Accept:'APPLICATION/JSON','Accept-Encoding':'IDENTITY','Content-Encoding':'IDENTITY'}],['media-asterisk-accept',{Accept:'*/*'}]]){
      await delay(60);const result=response(await wire(request(vector.operation,vector.input,{headers})));assert.equal(result.status,200,id);assert.deepEqual(result.body,vector.expected,id);
      pass(id,'content-negotiation',{status:200,semanticFixture:vector.id,bodySha256:sha(result.bytes)});
    }
    await delay(60);
    const reused=await tlsProbe({raw:request('getHealth',null,{headers:{Connection:'keep-alive','X-Request-ID':'first_connection_request'}}),afterData:request('getHealth',null,{headers:{'X-Request-ID':'forbidden_second_request'}})});
    assert.equal(reused.secure,true);assert.equal(reused.protocol,'TLSv1.3');assert.equal(reused.alpn,'http/1.1');assert.equal(reused.authorized,true);
    assert.ok(['TLS_AES_256_GCM_SHA384','TLS_AES_128_GCM_SHA256'].includes(reused.cipher));
    assert.equal(reused.secondWriteAttempted,true);assert.equal(response(reused.bytes).status,200);assert.equal(reused.bytes.toString().match(/HTTP\/1\.1/g)?.length,1);
    pass('keep-alive-reuse-post-publication','http-framing',{status:200,responseCount:1,secondWriteAttempted:reused.secondWriteAttempted});
    pass('tls13-trusted-ip-cipher-alpn','tls',{protocol:reused.protocol,alpn:reused.alpn,cipher:reused.cipher,certificateAuthorized:reused.authorized});
    await delay(60);
    const absent=await tlsProbe({raw:request('getHealth'),options:{ALPNProtocols:undefined}});
    assert.equal(absent.secure,true);assert.equal(absent.protocol,'TLSv1.3');assert.equal(absent.alpn,false);assert.equal(response(absent.bytes).status,200);
    pass('tls13-absent-alpn','tls',{protocol:absent.protocol,status:200});
    for(const [id,options,errorCode] of [
      ['tls12-refused',{minVersion:'TLSv1.2',maxVersion:'TLSv1.2'},null],
      ['tls-disallowed-cipher',{ciphers:'TLS_CHACHA20_POLY1305_SHA256'},null],
      ['tls-alpn-h2-refused',{ALPNProtocols:['h2']},null],
      ['tls-untrusted-certificate',{ca:undefined},'DEPTH_ZERO_SELF_SIGNED_CERT'],
      ['tls-certificate-name-mismatch',{servername:'incorrect.invalid'},'ERR_TLS_CERT_ALTNAME_INVALID']
    ]){
      await delay(60);const result=await tlsProbe({raw:request('getHealth'),options});
      assert.equal(result.bytes.length,0,id);assert.equal(result.secure,false,id);assert.ok(result.errorCode,id);
      if(errorCode)assert.equal(result.errorCode,errorCode,id);
      pass(id,'tls',{httpBytes:0,secureConnection:false,clientErrorCode:result.errorCode});
    }
    for(const [id,bytes] of [['tls-plaintext-refused',Buffer.from('GET /v1/health HTTP/1.1\r\nHost: '+host+'\r\n\r\n')],['tls-malformed-record',Buffer.from([0x16,0x03,0x03,0x00,0x05,0xff,0,0,1,0])]]){
      await delay(60);const result=await tcpProbe(bytes);assert.equal(result.includes(Buffer.from('HTTP/')),false,id);
      pass(id,'tls',{httpBytes:0,transportBytes:result.length,closed:true});
    }
    await delay(60);await tcpProbe(null);
    pass('tls-client-aborts-handshake','tls',{httpBytes:0,clientAbort:true});
    await delay(60);const afterAbort=response(await wire(request('getHealth')));assert.equal(afterAbort.status,200);
    pass('tls-adverse-recovery','tls',{status:200});
    await delay(60);const withId=response(await wire(request('getHealth',null,{headers:{'X-Request-ID':'bounded_accepted-id'}})));
    assert.equal(withId.headers['x-request-id'],'bounded_accepted-id');
    pass('log-validated-authenticated-id','logging-secrets',{status:200,validatedIdEchoed:true});
  } finally { await state.stop(); }

  const source=readFileSync(resolve(stage,'package/src/config.mjs'),'utf8');
  assert.match(source,/import\s*\{[^}]*timingSafeEqual[^}]*\}\s*from\s*'node:crypto'/u);
  assert.match(source,/new RegExp\(api\.headers\.values\.authorizationPattern,'u'\)\.test\(header\)\) return false;\s*return timingSafeEqual\(Buffer\.from\(header\.slice\(7\),'hex'\),token\);/u);
  assert.equal(api.headers.values.authorizationPattern,'^Bearer [0-9a-f]{64}$');
  pass('auth-fixed-size-timing-safe-mechanism','authentication',{evidenceType:'SOURCE_MECHANISM',sourceSha256:sha(Buffer.from(source)),decodedOperandBytes:32,timingDistributionClaim:false});

  assert.equal(state.stdout,'');
  for(const sensitive of [credentials.token,'Bearer '+credentials.token,marker,JSON.stringify(vector.input),vector.input.policyBase64,vector.expected.canonicalArtifactBase64])assert.equal(state.stderr.includes(sensitive),false,'SECRET_FREE_STDERR');
  const logs=state.stderr.trim().split('\n').map(line=>{assert.ok(Buffer.byteLength(line+'\n')<=fixed.logRecordBytes);return JSON.parse(line);});
  const events=new Set(['startup','requestCompleted','requestRejected','requestCancelled','shutdown','fatal','logsDropped']);
  for(const row of logs){
    assert.deepEqual(Object.keys(row).sort(),['code','event','operationId','requestId']);assert.ok(events.has(row.event));
    assert.ok(row.code===null||Object.hasOwn(api.errors,row.code));
    assert.ok(row.operationId===null||api.routes.some(r=>r.operationId===row.operationId));
    assert.ok(row.requestId===null||new RegExp(api.headers.requestIdPattern,'u').test(row.requestId));
    assert.notEqual(row.requestId,'forbidden_second_request');assert.notEqual(row.requestId,'unauthenticated');
    assert.notEqual(row.event,'fatal');
  }
  pass('logs-closed-bounded-secret-free','logging-secrets',{recordCount:logs.length,maxRecordBytes:Math.max(...state.stderr.trim().split('\n').map(x=>Buffer.byteLength(x+'\n'))),logSha256:sha(Buffer.from(state.stderr)),rawLogsPersisted:false});
  return {records,limitations:[
    'Fresh manifest-verified staging uses the actual bin/memoryos-rest.mjs process; transport evidence does not recertify npm distribution or Phase 2A remote listening.',
    'Constant-time evidence verifies the fixed 32-byte timingSafeEqual mechanism; it makes no statistical side-channel or constant-latency claim.',
    'Socket observations and closed diagnostics establish rejected transport behavior; no instrumentation-based zero-worker-dispatch count is asserted.',
    'Premature EOF permits exactly frozen HTTP 408 when writable or connection close when no response is possible.',
    'Logging witnesses establish bounded safe records and absence of exercised secrets; Phase 1 retained logging-backpressure evidence covers its separately characterized queue.'
  ]};
}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

function tlsProbe({raw,options={},afterData=null}) {
  return new Promise((resolveProbe,rejectProbe)=>{
    const socket=tls.connect({host:'127.0.0.1',port,ca:credentials.ca,minVersion:'TLSv1.3',maxVersion:'TLSv1.3',ALPNProtocols:['http/1.1'],...options});
    const result={bytes:Buffer.alloc(0),secure:false,protocol:null,alpn:null,cipher:null,authorized:false,errorCode:null,secondWriteAttempted:false};
    const timer=setTimeout(()=>{socket.destroy();rejectProbe(Error('TLS_PROBE_TIMEOUT'));},12000);
    socket.on('error',error=>{result.errorCode=error.code??'TLS_ERROR';});
    socket.on('data',bytes=>{
      result.bytes=Buffer.concat([result.bytes,bytes]);
      if(result.bytes.length>131072){socket.destroy();rejectProbe(Error('TLS_PROBE_RESPONSE_LIMIT'));}
      if(afterData&&!result.secondWriteAttempted){result.secondWriteAttempted=true;socket.write(afterData);}
    });
    socket.once('secureConnect',()=>{result.secure=true;result.protocol=socket.getProtocol();result.alpn=socket.alpnProtocol;result.cipher=socket.getCipher().standardName;result.authorized=socket.authorized;socket.write(raw);});
    socket.once('close',()=>{clearTimeout(timer);resolveProbe(result);});
  });
}
function tcpProbe(bytes) {
  return new Promise((resolveProbe,rejectProbe)=>{
    const socket=net.connect({host:'127.0.0.1',port});let received=Buffer.alloc(0);
    const timer=setTimeout(()=>{socket.destroy();rejectProbe(Error('TCP_PROBE_TIMEOUT'));},12000);
    socket.on('error',()=>{});socket.on('data',chunk=>{received=Buffer.concat([received,chunk]);if(received.length>4096){socket.destroy();rejectProbe(Error('TCP_PROBE_RESPONSE_LIMIT'));}});
    socket.once('connect',()=>{if(bytes===null)socket.destroy();else socket.write(bytes);});
    socket.once('close',()=>{clearTimeout(timer);resolveProbe(received);});
  });
}



