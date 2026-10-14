/** Client process; extra test CA is scoped here, never to the gateway. */
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
const stage=process.argv[2],api=JSON.parse(readFileSync(resolve(stage,'package/contracts/api-contract.json'))),token=readFileSync(resolve(stage,'private/token'),'ascii');
let input='';for await(const chunk of process.stdin)input+=chunk;
const cases=JSON.parse(input),results=[];
for(const item of cases){const route=api.routes.find(r=>r.operationId===item.operation);const result=await fetch('https://127.0.0.1:13050'+route.path,{method:route.method,headers:{Authorization:'Bearer '+token,'Accept-Encoding':'identity',Connection:'close','X-Request-ID':'client-fetch-1',...(item.input===null?{}:{'Content-Type':'application/json'})},...(item.input===null?{}:{body:JSON.stringify(item.input)})});results.push({id:item.id,status:result.status,body:await result.json()});}
process.stdout.write(JSON.stringify(results));
