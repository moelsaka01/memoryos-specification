import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {launch,root,wire,response,request,vectors,delay,api,credentials} from './installed.mjs';
const state=await launch({measurement:true,auditYoung:0}),records=[];
const cases=[];
function add(id,raw,status,code,head=false,options={}){cases.push({id,raw,status,code,head,options});}
const health=()=>request('getHealth').toString();
const post=(body='{}',headers={})=>request('preparePolicy',body,{headers});
const replaceLine=line=>health().replace('GET /v1/health HTTP/1.1',line);
for(const [suffix,line] of [['tab','GET\t/v1/health HTTP/1.1'],['two-space','GET  /v1/health HTTP/1.1'],['lowercase','get /v1/health HTTP/1.1'],['nul','GET /v1/health\0 HTTP/1.1'],['h2','PRI * HTTP/2.0'],['absolute','GET https://127.0.0.1/v1/health HTTP/1.1'],['authority','CONNECT 127.0.0.1:13050 HTTP/1.1'],['asterisk','OPTIONS * HTTP/1.1']])add('HTTP-LINE-'+suffix,replaceLine(line),400,'REQUEST_SYNTAX');
for(const version of ['1.0','2.0'])add('HTTP-LINE-version-'+version,replaceLine('GET /v1/health HTTP/'+version),505,'HTTP_VERSION');
for(const [suffix,target] of [['query','/v1/health?x=1'],['fragment','/v1/health#x'],['percent','/v1/%68ealth'],['backslash','/v1\\health'],['dot','/v1/./health'],['dotdot','/v1/../health'],['double','/v1//health']])add('HTTP-LINE-'+suffix,request('getHealth',null,{path:target}),400,'REQUEST_SYNTAX');
for(const n of [255,256,257])add('HTTP-LINE-target-'+n,request('getHealth',null,{path:'/'+'a'.repeat(n-1)}),n<=256?404:414,n<=256?'NOT_FOUND':'TARGET_LIMIT');
for(const n of [511,512,513]){const line='A'.repeat(n-13)+' / HTTP/1.1';assert.equal(line.length+2,n);add('HTTP-LINE-size-'+n,replaceLine(line),n<=512?400:431,n<=512?'REQUEST_SYNTAX':'HEADER_LIMIT');}
for(const [suffix,header] of [['space-colon','X : y'],['fold',' X: y'],['tab','X:\ty'],['lone-cr','X: y\rz'],['lone-lf','X: y\nz'],['nul','X: \0'],['unicode','X: é'],['host-duplicate','hOsT: 127.0.0.1:13050'],['auth-duplicate','AUTHORIZATION: Bearer '+credentials.token]])add('HTTP-HEADERS-'+suffix,health().replace('\r\n\r\n','\r\n'+header+'\r\n\r\n'),400,'REQUEST_SYNTAX');
for(const n of [31,32,33]){const base=health();const count=base.split('\r\n').length-3;const extra=Array.from({length:n-count},(_,i)=>'X-'+i+': x').join('\r\n');add('HTTP-HEADERS-count-'+n,base.replace('\r\n\r\n','\r\n'+extra+'\r\n\r\n'),n<=32?403:431,n<=32?'FORBIDDEN':'HEADER_LIMIT');}
for(const n of [1023,1024,1025])add('HTTP-HEADERS-value-'+n,request('getHealth',null,{headers:{X:'a'.repeat(n)}}),n<=1024?403:431,n<=1024?'FORBIDDEN':'HEADER_LIMIT');
for(const n of [16383,16384,16385]){let text=health().slice(0,-2),i=0;while(n-text.length-2>1035)text+='X-'+i+++': '+'a'.repeat(1000)+'\r\n';const left=n-text.length-2;text+='Z: '+'z'.repeat(left-5)+'\r\n\r\n';assert.equal(text.length,n);add('HTTP-HEADERS-bytes-'+n,text,n<=16384?403:431,n<=16384?'FORBIDDEN':'HEADER_LIMIT');}
for(const value of ['2,2','+2','02','-1','9007199254740992','9999999999999999999999999'])add('HTTP-FRAMING-cl-'+cases.length,post('{}',{'Content-Length':value}),400,'REQUEST_SYNTAX');
for(const h of ['Content-Length: 2','content-length: 3','Transfer-Encoding: chunked','transfer-encoding: identity','Transfer-Encoding:','Expect: 100-continue','Upgrade: websocket','Trailer: x'])add('HTTP-FRAMING-'+cases.length,post().toString().replace('\r\n\r\n','\r\n'+h+'\r\n\r\n'),400,'REQUEST_SYNTAX');
add('HTTP-FRAMING-no-length',post().toString().replace(/Content-Length: 2\r\n/u,'').slice(0,-2),411,'LENGTH_REQUIRED');
add('HTTP-FRAMING-body-excess',Buffer.concat([post(),Buffer.from('x')]),400,'REQUEST_SYNTAX');
add('HTTP-FRAMING-pipeline',Buffer.concat([request('getHealth'),request('getContractIdentities')]),400,'REQUEST_SYNTAX');
for(const value of ['text/plain','application/json;charset=latin1','application/json; charset=utf-8; charset=utf-8','application/json;x=y'])add('HTTP-MEDIA-'+cases.length,post('{}',{'Content-Type':value}),415,'UNSUPPORTED_MEDIA');
add('HTTP-MEDIA-no-type',post().toString().replace('Content-Type: application/json\r\n',''),415,'UNSUPPORTED_MEDIA');
for(const [header,value,status,code] of [['Content-Encoding','gzip',415,'UNSUPPORTED_MEDIA'],['Accept','text/event-stream',406,'NOT_ACCEPTABLE'],['Accept-Encoding','br',406,'NOT_ACCEPTABLE']])add('HTTP-MEDIA-'+header,request('getHealth',null,{headers:{[header]:value}}),status,code);
for(const path of ['/','/v2/health','/v1/health/','/V1/health','/openapi.json','/metrics','/admin','/favicon.ico'])add('HTTP-ROUTING-'+cases.length,request('getHealth',null,{path}),404,'NOT_FOUND');
for(const route of api.routes)for(const method of ['HEAD','OPTIONS'])add('HTTP-ROUTING-'+route.operationId+'-'+method,request(route.operationId,null,{method}),405,'METHOD_NOT_ALLOWED',method==='HEAD');
const malformed=[Buffer.from([0xc0,0xaf]),Buffer.from([0xe2,0x82]),Buffer.from([0xef,0xbb,0xbf,123,125]),Buffer.from('{"x":"\\ud800"}'),Buffer.from('{"x":1,"\\u0078":2}'),Buffer.from('{"x":9007199254740992}'),Buffer.from('{"x":-0}'),Buffer.from('{"x":1e0}'),Buffer.from('{}true')];
for(const body of malformed){let header=post('x').toString();header=header.slice(0,header.indexOf('\r\n\r\n')+4).replace('Content-Length: 1','Content-Length: '+body.length);add('HTTP-JSON-'+cases.length,Buffer.concat([Buffer.from(header),body]),400,'REQUEST_SYNTAX');}
for(const value of [null,true,4,[],{},'text',{__proto__:null,policyBase64:'e30=',constructor:1},{policyBase64:'e30=',prototype:1},{policyBase64:'e30=',unknown:1}])add('HTTP-JSON-schema-'+cases.length,post(JSON.stringify(value)),400,'REQUEST_SCHEMA');
for(const value of ['', 'e30','e30===','e31=','e3_=','e30=\n','===='])add('HTTP-BYTES-'+cases.length,post(JSON.stringify({policyBase64:value})),400,'REQUEST_SCHEMA');
for(const route of api.routes)add('SEC-AUTH-'+route.operationId,request(route.operationId,null,{headers:{Authorization:null}}),401,'UNAUTHENTICATED');
for(const value of ['bearer '+credentials.token,'Bearer  '+credentials.token,'Bearer '+'0'.repeat(64),'Basic abc','Bearer '+credentials.token+' x'])add('SEC-AUTH-syntax-'+cases.length,request('getHealth',null,{headers:{Authorization:value}}),401,'UNAUTHENTICATED');
for(const name of ['Forwarded','X-Forwarded-For','X-Forwarded-Host','X-Forwarded-Proto','X-HTTP-Method-Override','Origin','Cookie','Via','Idempotency-Key'])add('SEC-HOST-PROXY-'+name,request('getHealth',null,{headers:{[name]:'attacker'}}),403,'FORBIDDEN');
for(const host of ['localhost:13050','127.0.0.1','user@127.0.0.1:13050','127.0.0.1:13051','127.0.0.1:13050,evil','127.0.0.1.evil:13050'])add('SEC-HOST-PROXY-'+cases.length,request('getHealth',null,{headers:{Host:host}}),403,'FORBIDDEN');
for(const value of ['C:/secret','../secret','\\\\host\\share','\\\\?\\C:\\secret','~/secret','file:///C:/secret','http://169.254.169.254/latest/meta-data','https://localhost/redirect'])for(const field of ['policyBase64','policyPath','url'])add('SEC-ACQUISITION-'+cases.length,post(JSON.stringify({[field]:value})),400,'REQUEST_SCHEMA');
try{
 for(const item of cases){await delay(60);const before=state.audit.filter(x=>x.event==='workerCreated').length;const raw=await wire(item.raw,item.options);const result=response(raw,{head:item.head});assert.equal(result.status,item.status,item.id);if(!item.head)assert.equal(result.body.error.code,'MO1305_'+item.code,item.id);assert.equal(state.audit.filter(x=>x.event==='workerCreated').length,before,item.id+' dispatched worker');records.push({id:item.id,state:'PASS',status:result.status,code:item.code,workerDispatches:0});state.observations.length=0;state.states.length=0;state.audit.length=0;}
 const vector=vectors().find(v=>v.id==='prepare-policy-pass');const fragmented=request(vector.operation,vector.input);assert.deepEqual(response(await wire(Array.from(fragmented,x=>Buffer.from([x])))).body,vector.expected);records.push({id:'HTTP-LINE-byte-fragmented-semantic',state:'PASS',status:200,code:null,workerDispatches:1});
 for(const tlsOptions of [{minVersion:'TLSv1.2',maxVersion:'TLSv1.2'},{ALPNProtocols:['h2']},{ca:undefined,rejectUnauthorized:true}]){const bytes=await wire(request('getHealth'),{tlsOptions,allowClose:true});assert.equal(bytes.length,0);records.push({id:'SEC-TLS-'+records.length,state:'PASS',status:0,code:null,workerDispatches:0});}
 assert.ok(!state.stderr.includes(credentials.token));assert.ok(!state.stderr.includes('policyBase64'));
}finally{await state.stop();}
writeFileSync(resolve(root,'.cache/mo1305-resource-review/adversarial.json'),JSON.stringify({kind:'MemoryOSRESTAdversarialResults',state:'PASS',records,exitCode:state.child.exitCode}));console.log(JSON.stringify({state:'PASS',cases:records.length}));
