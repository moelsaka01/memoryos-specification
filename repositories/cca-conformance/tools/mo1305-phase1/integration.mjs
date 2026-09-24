import assert from 'node:assert/strict';
import {writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {launch,wire,request,response,vectors,delay,root} from './installed.mjs';
const state=await launch(),results=[];
try{
 for(const item of vectors()){
  const result=response(await wire(request(item.operation,item.input)));
  assert.equal(result.status,item.expected.status==='ok'?200:422,item.id+JSON.stringify(result.body));
  assert.deepEqual(result.body,item.expected,item.id);results.push({id:item.id,status:'PASS'});
 }
 for(const operation of ['getHealth','getReadiness','getVersion']){const result=response(await wire(request(operation)));assert.equal(result.status,200);results.push({id:operation,status:'PASS'});await delay(55);}
 const bad=[
  ['missing-auth',{headers:{Authorization:null}},401,'UNAUTHENTICATED'],['wrong-auth',{headers:{Authorization:'Bearer '+'0'.repeat(64)}},401,'UNAUTHENTICATED'],
  ['host',{headers:{Host:'localhost:13050'}},403,'FORBIDDEN'],['origin',{headers:{Origin:'https://example.invalid'}},403,'FORBIDDEN'],
  ['cookie',{headers:{Cookie:'a=b'}},403,'FORBIDDEN'],['proxy',{headers:{Forwarded:'for=127.0.0.1'}},403,'FORBIDDEN'],
  ['accept',{headers:{Accept:'text/plain'}},406,'NOT_ACCEPTABLE'],['encoding',{headers:{'Accept-Encoding':'gzip'}},406,'NOT_ACCEPTABLE'],
  ['content-encoding',{headers:{'Content-Encoding':'gzip'}},415,'UNSUPPORTED_MEDIA'],['unknown',{path:'/v2/health'},404,'NOT_FOUND'],
  ['method',{method:'OPTIONS'},405,'METHOD_NOT_ALLOWED'],['query',{path:'/v1/health?a=1'},400,'REQUEST_SYNTAX'],
  ['traversal',{path:'/v1/../health'},400,'REQUEST_SYNTAX'],['request-id',{headers:{'X-Request-ID':'bad value'}},400,'REQUEST_SCHEMA']
 ];
 for(const [id,options,status,code] of bad){await delay(60);const result=response(await wire(request('getHealth',null,options)));assert.equal(result.status,status,id);assert.equal(result.body.error.code,'MO1305_'+code);results.push({id,status:'PASS'});}
 const malformed=['{"policyBase64":"e30=","policyBase64":"e30="}','{"policyBase64":"e30=","po\\u006cicyBase64":"e30="}','\ufeff{}','{"x":1e1}','{"x":-0}','{"x":"\\ud800"}','{} true'];
 for(let i=0;i<malformed.length;i++){await delay(60);const result=response(await wire(request('preparePolicy',malformed[i])));assert.equal(result.status,400);assert.equal(result.body.error.code,'MO1305_REQUEST_SYNTAX');results.push({id:'json-'+i,status:'PASS'});}
 for(const value of ['file:///C:/secret','https://example.invalid','C:\\Windows','..\\secret','\\\\server\\share']){await delay(60);const result=response(await wire(request('preparePolicy',{policyBase64:value})));assert.equal(result.status,400);results.push({id:'acquisition-'+results.length,status:'PASS'});}
 await delay(60);const head=response(await wire(request('getHealth',null,{method:'HEAD'})),{head:true});assert.equal(head.status,405);assert.equal(head.headers.allow,'GET');
 await delay(60);const duplicate=request('getHealth').toString().replace('\r\n\r\n','\r\nContent-Length: 0\r\ncontent-length: 0\r\n\r\n');assert.equal(response(await wire(duplicate)).status,400);
 await delay(60);assert.equal(response(await wire(Buffer.concat([request('getHealth'),request('getHealth')]))).status,400);
 for(let i=0;i<40;i++){await delay(55);assert.equal(response(await wire(request('getHealth'))).status,200,'CONNECTION_LEAK '+i);}
 assert.ok(!state.stderr.includes('Bearer'));assert.ok(!state.stderr.includes('policyBase64'));
}finally{await state.stop();}
writeFileSync(resolve(root,'.cache/mo1305-resume/integration.json'),JSON.stringify({status:'PASS',kind:'Phase1DevelopmentIntegrationResults',releaseCertification:false,results}));
console.log(JSON.stringify({status:'PASS',sdkVectors:vectors().length,otherCases:results.length-vectors().length,connectionCleanupRequests:40,exitCode:state.child.exitCode}));
