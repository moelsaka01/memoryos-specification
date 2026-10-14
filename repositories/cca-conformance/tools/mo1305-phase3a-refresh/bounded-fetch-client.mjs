/** Bounded adaptation of historical Phase 3A fetch-client.mjs. Credentials arrive only on stdin. */
import assert from 'node:assert/strict';
let input='';
for await(const chunk of process.stdin){input+=chunk;assert.ok(Buffer.byteLength(input)<=1048576,'FETCH_INPUT_BOUND');}
const{host,port,token,cases}=JSON.parse(input);
assert.equal(process.versions.node,'24.21.0');
assert.match(host,/^\d{1,3}(?:\.\d{1,3}){3}$/u);
assert.ok(Number.isInteger(port)&&port>0&&port<65536);assert.match(token,/^[a-f0-9]{64}$/u);
assert.ok(cases.length>=1&&cases.length<=3,'BOUNDED_REFRESH_CASE_COUNT');
const records=[];
for(const item of cases){
  assert.match(item.path,/^\/v1\/[a-z/-]+$/u);assert.ok(['GET','POST'].includes(item.method));
  const response=await fetch('https://'+host+':'+port+item.path,{
    method:item.method,redirect:'error',signal:AbortSignal.timeout(45000),
    headers:{Authorization:'Bearer '+token,'Accept-Encoding':'identity',Connection:'close','X-Request-ID':item.requestId,
      ...(item.body===null?{}:{'Content-Type':'Application/JSON; charset="UTF-8"'})},
    ...(item.body===null?{}:{body:item.body})});
  let bytes=Buffer.alloc(0);
  for await(const chunk of response.body){bytes=Buffer.concat([bytes,chunk]);if(bytes.length>65536)throw Error('FETCH_RESPONSE_BOUND');}
  records.push({id:item.id,status:response.status,headers:Object.fromEntries(response.headers),bodyBase64:bytes.toString('base64')});
  await new Promise(done=>setTimeout(done,70));
}
process.stdout.write(JSON.stringify(records));
