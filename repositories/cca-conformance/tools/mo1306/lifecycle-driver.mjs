// Engineering-only fault injection. Supervisor/helper source remains unchanged.
import fs from 'node:fs';import path from 'node:path';import {pathToFileURL} from 'node:url';import {performance} from 'node:perf_hooks';
const [mode,packageRoot,fixtureRoot]=process.argv.slice(2);
const {checkPaths}=await import(pathToFileURL(path.join(packageRoot,'src/filesystem.mjs')));
const {supervise}=await import(pathToFileURL(path.join(packageRoot,'src/supervisor.mjs')));
const controller=new AbortController();
const config=JSON.parse(fs.readFileSync(path.join(fixtureRoot,'memoryos-ci.json')));
const request={kind:'MemoryOSCICDWorkerRequest',version:'1.0.0',runId:'12345678-1234-4123-8123-123456789abc',operation:'evaluatePolicy',expectedSemanticDigest:config.policy.expectedSemanticDigest,policyBase64:fs.readFileSync(path.join(fixtureRoot,'policy.json')).toString('base64'),policySetBase64:null,candidateMipBase64:fs.readFileSync(path.join(fixtureRoot,'candidate.mip')).toString('base64'),baselineMipBase64:null};
if(mode==='semantic-failure')request.policyBase64=Buffer.from('{}').toString('base64');
let timer;
try{
 if(mode==='helper-cancel'||mode==='worker-cancel')timer=setTimeout(()=>controller.abort(),150);
 if(mode==='helper-failure'||mode==='helper-cancel')await checkPaths([{path:mode==='helper-failure'?path.join(fixtureRoot,'absent-input'):process.execPath,allowMissingLeaf:false}],{deadline:performance.now()+5000,signal:controller.signal});
 else await supervise(request,{timeoutMs:mode==='worker-timeout'?1000:5000,deadline:performance.now()+7000,signal:controller.signal});
 console.log(JSON.stringify({mode,result:'SUCCESS'}));
}catch(e){console.log(JSON.stringify({mode,result:e.code??'ERROR'}));}
finally{clearTimeout(timer);}
