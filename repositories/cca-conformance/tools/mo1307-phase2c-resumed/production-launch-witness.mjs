// Fresh exact production helper launch; no synthetic response or alternate argv.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes, createHash } from 'node:crypto';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';
import { createSupervisor } from '../../../memoryos-readiness/src/runtime.mjs';
import { createHelperTransport, helperLaunchSpecification } from '../../../memoryos-readiness/src/helper-transport.mjs';
import { encodeHelperRequest, decodeHelperResponse } from '../../../memoryos-readiness/src/helper-protocol.mjs';
const root=fileURLToPath(new URL('../../../../',import.meta.url));
const evidence=path.join(root,'repositories/cca-conformance/evidence/mo1307/phase2c-continuation/production-launch-attempt1');
await fs.mkdir(evidence,{recursive:false});
const request={kind:'MemoryOSReadinessHelperRequest',version:'2.0.0',session:randomBytes(32).toString('hex'),sequence:1,operation:'READ_SET',roots:[{id:'input',path:path.join(root,'repositories/cca-conformance/fixtures/mo1307/bundles/ready')}],files:[{id:'authority',path:'authority.json',root:'input',maxBytes:1048576},{id:'config',path:'configuration.json',root:'input',maxBytes:16384}]};
const frame=encodeHelperRequest(request),supervisor=createSupervisor({kind:'cli'}),started=performance.now();
let result='PASS',failure=null,response=null;
await fs.writeFile(path.join(evidence,'request.bin'),frame);
try {const answer=await createHelperTransport(supervisor).exchange(frame);response=decodeHelperResponse(answer.responseBytes,request);assert.equal(answer.exitConfirmed,true);assert.equal(response.status,'OK');assert.equal(response.files.length,2);await fs.writeFile(path.join(evidence,'response.bin'),answer.responseBytes);for(const row of response.files){const expected=await fs.readFile(path.join(request.roots[0].path,request.files.find(f=>f.id===row.id).path));assert.deepEqual(Buffer.from(row.bytes.join(''),'base64'),expected);}}
catch(error){result='FAIL';failure={code:error.code??null,message:error.message};}
finally{await supervisor.dispose();}
const spec=helperLaunchSpecification(),helper=await fs.readFile(spec.args.at(-1));
const receipt={kind:'MO1307AuthorizedProductionHelperLaunch',result,failure,elapsedMs:performance.now()-started,executable:spec.executable,args:spec.args,options:spec.options,helperSha256:createHash('sha256').update(helper).digest('hex'),requestSession:request.session,responseStatus:response?.status??null,nativeIdentities:response?.roots??[],snapshot:supervisor.snapshot(),syntheticInspection:false,persistentPolicyMutation:false,authority:'EXPLICIT_PROCESS_SCOPED_FIXED_HELPER_ONLY'};
await fs.writeFile(path.join(evidence,'receipt.json'),JSON.stringify(receipt,null,2)+'\n');
process.stdout.write(JSON.stringify({result,elapsedMs:receipt.elapsedMs,helpers:receipt.snapshot.helpers,cleanupConfirmed:receipt.snapshot.cleanupConfirmed,failure})+'\n');process.exitCode=result==='PASS'?0:1;

