// One uninstrumented product helper invocation with unchanged real supervisor.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {performance} from 'node:perf_hooks';
import {root,evidence,record,check,hash,json,write} from './common.mjs';
import {packageFiles,checkPackage} from '../mo1307-phase1/package.mjs';
import {createSupervisor} from '../../../memoryos-readiness/src/runtime.mjs';
import {createHelperTransport,helperLaunchSpecification} from '../../../memoryos-readiness/src/helper-transport.mjs';
import {decodeHelperRequest,decodeHelperResponse} from '../../../memoryos-readiness/src/helper-protocol.mjs';
assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const args=process.argv.slice(2);assert.equal(args.length,6);assert.equal(args[0],'--case');assert.equal(args[2],'--oracle');assert.equal(args[4],'--output');
const name=args[1],oracle=args[3],output=args[5];assert.ok(['mo1306','ready'].includes(name));
assert.ok(path.resolve(root,output).startsWith(path.resolve(root,evidence+'/performance')+path.sep));assert.ok(path.resolve(root,oracle).startsWith(path.resolve(root,evidence)+path.sep));
assert.equal(fs.existsSync(path.join(root,output)),false);checkPackage();fs.mkdirSync(path.join(root,output),{recursive:true});
const source='C:/Users/melsa/Documents/Codex/cca-mo1307-3a/repositories/cca-conformance/evidence/mo1307/';
const requestPath=source+(name==='mo1306'?'phase3a/diagnostic/attempt1/03.request.bin':'phase3a-readset-diagnostic/ready-request.bin');
const frame=fs.readFileSync(requestPath),request=decodeHelperRequest(frame),expected=fs.readFileSync(path.join(root,oracle));decodeHelperResponse(expected,request);
assert.equal(frame.length,name==='mo1306'?7579:2125);assert.equal(request.files.length,name==='mo1306'?65:19);assert.equal(request.sequence,3);assert.equal(request.operation,'READ_SET');
const inputs=request.files.map(f=>record(path.join(request.roots.find(r=>r.id===f.root).path,...f.path.split('/'))));
assert.equal(inputs.reduce((n,m)=>n+m.byteLength,0),name==='mo1306'?2004208:19711);
const bindings=[...packageFiles.map(p=>record('repositories/memoryos-readiness/'+p)),record('repositories/cca-conformance/tools/mo1307-phase3a-readset-correction/performance.mjs'),record('repositories/cca-conformance/tools/mo1307-phase3a-readset-correction/common.mjs'),record(requestPath),record(oracle),...inputs];
write(output+'/campaign.json',{kind:'MO1307ReadSetProductPerformanceCampaign',case:name,sourceBindings:bindings,launch:helperLaunchSpecification(),
 request:record(requestPath),inputFiles:inputs.length,inputBytes:inputs.reduce((n,m)=>n+m.byteLength,0),originalRoot:request.roots[0].path,
 uninstrumentedProduct:true,realSupervisor:true,deadlineOverrides:false,retries:0,cacheState:'Uncontrolled ordinary OS cache; no cache flush or deliberate warm-up; every retained run counts.',certification:false});
const supervisor=createSupervisor({kind:'cli'}),transport=createHelperTransport(supervisor),started=performance.now();let result='PASS',failure=null,response=null,exchangeMs=null;
try{
 const answer=await transport.exchange(frame);exchangeMs=performance.now()-started;assert.equal(answer.exitConfirmed,true);
 response=record(output+'/response.bin',answer.responseBytes);fs.writeFileSync(path.join(root,response.path),answer.responseBytes,{flag:'wx'});
 assert.deepEqual(answer.responseBytes,expected);assert.equal(decodeHelperResponse(answer.responseBytes,request).status,'OK');assert.ok(exchangeMs<5000,'Whole exchange must complete strictly before5000ms');
}catch(error){exchangeMs??=performance.now()-started;result='FAIL';failure={code:error.code??null,stage:error.stage??null,message:error.message,stack:error.stack};}
finally{try{await supervisor.dispose();}catch(error){result='FAIL';failure??={code:error.code??null,message:error.message};}}
const snapshot=supervisor.snapshot();
try{for(const m of bindings)check(m);if(result==='PASS'){assert.equal(snapshot.helpers,1);assert.equal(snapshot.workers,0);assert.equal(snapshot.activeRole,null);assert.equal(snapshot.cleanupConfirmed,true);assert.ok(snapshot.helperUsedMs<5000);}}
catch(error){result='FAIL';failure??={code:error.code??null,message:error.message};}
write(output+'/receipt.json',{kind:'MO1307ReadSetProductPerformance',case:name,result,failure,sourceBindings:bindings,request:record(requestPath),response,
 exchangeMs,helperActiveMs:snapshot.helperUsedMs,deadlineMs:5000,marginMs:5000-exchangeMs,snapshot,
 exactOracleFrame:result==='PASS',cleanupConfirmed:result==='PASS'&&snapshot.cleanupConfirmed,unchangedProductLimits:true,certification:false});
console.log(JSON.stringify({case:name,result,exchangeMs,helperActiveMs:snapshot.helperUsedMs,marginMs:5000-exchangeMs,cleanupConfirmed:snapshot.cleanupConfirmed,failure}));process.exitCode=result==='PASS'?0:1;
