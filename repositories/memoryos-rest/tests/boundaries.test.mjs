import test from 'node:test';
import assert from 'node:assert/strict';
import {TokenBucket,Slots,Ownership} from '../src/admission.mjs';
import {parseHeader,headerPolicy,mediaPolicy} from '../src/raw-gate.mjs';
import {limits,api,validateInput,routeById} from '../src/contracts.mjs';
import {validateBinding,authenticate} from '../src/config.mjs';
import {J} from '../src/serialization.mjs';
import {decodeBase64} from '../src/schema.mjs';
const wire=(line='GET /v1/health HTTP/1.1',headers=['Host: 127.0.0.1:13050'])=>Buffer.from(line+'\r\n'+headers.join('\r\n')+'\r\n\r\n');
const code=(fn,expected)=>assert.throws(fn,error=>error.code==='MO1305_'+expected);
test('token bucket burst, N-1/N/N+1 refill and backward time preserve fixed state',()=>{
 let time=0n;const bucket=new TokenBucket(20,20,()=>time);
 for(let i=0;i<20;i++)assert.equal(bucket.take(),true);assert.equal(bucket.take(),false);
 time=49999999n;assert.equal(bucket.take(),false);time=50000000n;assert.equal(bucket.take(),true);time=50000001n;assert.equal(bucket.take(),false);
 time=0n;assert.equal(bucket.take(),false);time=10n**30n;for(let i=0;i<20;i++)assert.equal(bucket.take(),true);assert.equal(bucket.take(),false);
 assert.equal(Object.keys(bucket).length,5);
});
test('request/write slots never queue and semantic ownership requires both reap and response completion',()=>{
 const slots=new Slots(4),owners=Array.from({length:5},()=>({}));for(let i=0;i<4;i++)assert.equal(slots.acquire(owners[i]),true);assert.equal(slots.acquire(owners[4]),false);
 slots.release(owners[0]);assert.equal(slots.acquire(owners[4]),true);assert.equal(slots.active.size,4);
 const state=new Ownership(),first=state.reserve({});code(()=>state.reserve({}),'BUSY');first.responseDone=true;state.release(first);assert.equal(state.owner,first);
 first.reaped=true;state.release(first);const second=state.reserve({});assert.equal(state.valid(first),false);state.release(first);assert.equal(state.owner,second);
 second.reaped=second.responseDone=true;state.release(second);state.generation=Number.MAX_SAFE_INTEGER;code(()=>state.reserve({}),'UNAVAILABLE');
});
test('raw grammar rejects ambiguous names, duplicate framing, controls and non-origin targets',()=>{
 for(const headers of [['Host : a'],[' Host: a'],['Host:\ta'],['Host: a','host: a'],['Content-Length: 0,0'],['Content-Length: 01'],['Content-Length: +1'],['Transfer-Encoding: chunked'],['Expect: 100-continue'],['Upgrade: websocket'],['Host: a\nb']])code(()=>parseHeader(wire(undefined,headers)),'REQUEST_SYNTAX');
 for(const target of ['*','http://x/','/a//b','/a/../b','/a/./b','/a%2fb','/a?b','/a#b','/a\\b'])code(()=>parseHeader(wire('GET '+target+' HTTP/1.1')),'REQUEST_SYNTAX');
 for(const version of ['1.0','2.0','3.0'])code(()=>parseHeader(wire('GET / HTTP/'+version)),'HTTP_VERSION');
 code(()=>parseHeader(wire('get / HTTP/1.1')),'REQUEST_SYNTAX');
});
test('header count, target and value boundaries include syntactic witnesses that may later fail allowlists',()=>{
 for(const n of [31,32,33]){const fn=()=>parseHeader(wire(undefined,Array.from({length:n},(_,i)=>'X-'+i+': v')));if(n<=32)assert.equal(fn().headerCount,n);else code(fn,'HEADER_LIMIT');}
 for(const n of [255,256,257]){const fn=()=>parseHeader(wire('GET /'+'a'.repeat(n-1)+' HTTP/1.1'));if(n<=256)assert.equal(fn().target.length,n);else code(fn,'TARGET_LIMIT');}
 for(const n of [1023,1024,1025]){const fn=()=>parseHeader(wire(undefined,['X: '+'a'.repeat(n)]));if(n<=1024)fn();else code(fn,'HEADER_LIMIT');}
});
test('authentication is closed and host/proxy/media/schema precedence is explicit',()=>{
 const token=Buffer.alloc(32,1),text=token.toString('hex');assert.equal(authenticate('Bearer '+text,token),true);
 for(const header of [undefined,'bearer '+text,'Bearer  '+text,'Bearer '+text.toUpperCase(),'Bearer '+text+' ','Bearer '+'0'.repeat(64)]){
  if(header==='Bearer '+text)continue;assert.equal(authenticate(header,token),false);
 }
 const config={bindAddress:'127.0.0.1',port:13050};headerPolicy(parseHeader(wire()),config);
 code(()=>headerPolicy(parseHeader(wire(undefined,['Host: localhost:13050'])),config),'FORBIDDEN');
 for(const name of ['Origin','Cookie','Forwarded','X-Forwarded-For','Via','Idempotency-Key'])code(()=>headerPolicy(parseHeader(wire(undefined,['Host: 127.0.0.1:13050',name+': x'])),config),'FORBIDDEN');
 const route=routeById.get('preparePolicy');
 for(const value of ['application/json','Application/JSON; charset="UTF-8"'])mediaPolicy(parseHeader(wire('POST /v1/policies/prepare HTTP/1.1',['Content-Length: 10','Content-Type: '+value])),route);
 for(const value of ['text/json','application/json; x=y','application/json;charset=utf-8;charset=utf-8'])code(()=>mediaPolicy(parseHeader(wire('POST / HTTP/1.1',['Content-Length: 10','Content-Type: '+value])),route),'UNSUPPORTED_MEDIA');
 code(()=>validateInput(route,{policyBase64:Buffer.alloc(2049).toString('base64')}),'INPUT_LIMIT');
 code(()=>validateInput(route,{policyBase64:'https://example.invalid'}),'REQUEST_SCHEMA');
});
test('remote binding checks actual private interface and rejects network/broadcast and /31',()=>{
 const interfaces={test:[{family:'IPv4',internal:false,address:'192.168.1.5',cidr:'192.168.1.5/24'}]};
 validateBinding('local','127.0.0.1',interfaces);validateBinding('remote','192.168.1.5',interfaces);
 for(const address of ['0.0.0.0','127.0.0.1','8.8.8.8','169.254.1.1','192.168.1.6'])code(()=>validateBinding('remote',address,interfaces),'FORBIDDEN');
 for(const address of ['192.168.1.0','192.168.1.255'])code(()=>validateBinding('remote',address,{test:[{family:'IPv4',internal:false,address,cidr:address+'/24'}]}),'FORBIDDEN');
 code(()=>validateBinding('remote','192.168.1.5',{test:[{family:'IPv4',internal:false,address:'192.168.1.5',cidr:'192.168.1.5/31'}]}),'FORBIDDEN');
});
test('serialization rejects sparse arrays even if extra enumerable properties mask length',()=>{
 const value=new Array(1);value.extra=1;assert.throws(()=>J(value));assert.equal(J(['a']),'["a"]');
});
test('all fixed decoded byte envelopes enforce N-1/N/N+1 independently',()=>{
 for(const maximum of [2048,4096,524288,4060])for(const n of [maximum-1,maximum,maximum+1]){
  const text=Buffer.alloc(n,17).toString('base64');if(n<=maximum)assert.equal(decodeBase64(text,maximum).length,n);else code(()=>decodeBase64(text,maximum),'INPUT_LIMIT');
 }
});
