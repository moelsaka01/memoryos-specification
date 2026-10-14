/** Bounded normal Node fetch client. The test CA applies only to this child. */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const [stage,port]=process.argv.slice(2);
const token=readFileSync(resolve(stage,'private/token'),'ascii');
let text='';
for await(const chunk of process.stdin){text+=chunk;if(text.length>1048576)throw Error('CLIENT_INPUT_BOUND');}
const cases=JSON.parse(text),records=[];
for(const item of cases){
  const response=await fetch(`https://127.0.0.1:${port}${item.path}`,{
    method:item.method,redirect:'error',signal:AbortSignal.timeout(45000),
    headers:{Authorization:`Bearer ${token}`,'Accept-Encoding':'identity',Connection:'close',
      'X-Request-ID':`interop-fetch-${records.length}`,
      ...(item.body===null?{}:{'Content-Type':'Application/JSON; charset="UTF-8"'})},
    ...(item.body===null?{}:{body:item.body}),
  });
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>65536)throw Error('CLIENT_RESPONSE_BOUND');
  records.push({id:item.id,status:response.status,headers:Object.fromEntries(response.headers),bodyBase64:bytes.toString('base64')});
}
process.stdout.write(JSON.stringify(records));
