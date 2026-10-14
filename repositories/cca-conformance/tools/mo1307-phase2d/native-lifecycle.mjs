// Observe the actual integrated CLI orchestrator, fixed worker and native helper.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {Writable} from 'node:stream';
import {performance} from 'node:perf_hooks';
import {root,evidence,json,write,record,check,hash} from './common.mjs';
import {packageFiles,checkPackage} from '../mo1307-phase1/package.mjs';
import {loadBundle,inputOf} from '../mo1307-phase2b/test-support.mjs';
import {createSupervisor} from '../../../memoryos-readiness/src/runtime.mjs';
import {createHelperTransport,helperLaunchSpecification} from '../../../memoryos-readiness/src/helper-transport.mjs';
import {decodeHelperRequest,decodeHelperResponse} from '../../../memoryos-readiness/src/helper-protocol.mjs';
import {orchestrateCli} from '../../../memoryos-readiness/src/cli.mjs';
import {parseCliArgs} from '../../../memoryos-readiness/src/cli-args.mjs';
import {canonicalBytes} from '../../../memoryos-readiness/src/canonical.mjs';
import {summaryProjection} from '../../../memoryos-readiness/src/projections.mjs';
assert.equal(process.argv.length,4);assert.equal(process.argv[2],'--output');
assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');
assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const output=process.argv[3].replaceAll('\\','/');assert.ok([evidence+'/native/','.cache/mo1307/phase2d/post-binding/'].some(p=>path.resolve(root,output).startsWith(path.resolve(root,p)+path.sep)));
assert.equal(json(evidence+'/pre-native-authorization.json').result,'PASS');checkPackage();
assert.equal(fs.existsSync(path.join(root,output)),false);fs.mkdirSync(path.join(root,output),{recursive:true});
const scratch=path.join(root,'.cache','m7d-lifecycle-'+process.pid);assert.equal(fs.existsSync(scratch),false);fs.mkdirSync(scratch);
const b=loadBundle('ready'),input=path.join(root,'repositories/cca-conformance/fixtures/mo1307/bundles/ready'),expected=canonicalBytes(b.result);
const names=['evaluate-a','verify-a','evaluate-b'];for(const name of names)fs.mkdirSync(path.join(root,output,name));
const walk=p=>fs.readdirSync(path.join(root,p)).sort().flatMap(n=>{const next=p+'/'+n;return fs.statSync(path.join(root,next)).isDirectory()?walk(next):[next];});
const bindings=[...packageFiles.map(p=>'repositories/memoryos-readiness/'+p),...walk('repositories/cca-conformance/fixtures/mo1307/bundles/ready'),'repositories/cca-conformance/tools/mo1307-phase2d/native-lifecycle.mjs',
 'repositories/cca-conformance/tools/mo1307-phase2d/common.mjs','repositories/cca-conformance/tools/mo1307-phase2b/test-support.mjs'].map(p=>record(p));
write(output+'/campaign.json',{kind:'MO1307IntegratedNativeLifecycleCampaign',version:'1.0.0',sourceBindings:bindings,
 launch:helperLaunchSpecification(),semanticDoubles:false,nativeDoubles:false,workerOverrides:false,retries:0});
const rows=[],started=performance.now();let result='PASS',failure=null;
try{
 for(const name of names){
  const command=name.startsWith('verify')?'verify':'evaluate',destination=path.join(scratch,name==='evaluate-b'?'b':'a');
  const args=[command,'--input-root',input,'--config','configuration.json','--authority','authority.json','--authority-sha256',b.pins.trustedAuthorityDigest,
   '--candidate-sha256',b.pins.expectedCandidateDigest,command==='evaluate'?'--output-root':'--result-root',destination];
  const launch=parseCliArgs(args),supervisor=createSupervisor({kind:'cli'}),transport=createHelperTransport(supervisor),requests=[],chunks=[];
  const stdout=new Writable({write(chunk,_encoding,callback){chunks.push(Buffer.from(chunk));callback();}});
  const exchange=async frame=>{const request=decodeHelperRequest(frame),ordinal=String(request.sequence).padStart(2,'0');
   const observed={sequence:request.sequence,session:request.session,operation:request.operation,status:null,exitConfirmed:false};requests.push(observed);
   fs.writeFileSync(path.join(root,output,name,ordinal+'.request.bin'),frame,{flag:'wx'});
   const answer=await transport.exchange(frame),response=decodeHelperResponse(answer.responseBytes,request);
   fs.writeFileSync(path.join(root,output,name,ordinal+'.response.bin'),answer.responseBytes,{flag:'wx'});
   Object.assign(observed,{status:response.status,exitConfirmed:answer.exitConfirmed});return answer;};
  const before=command==='verify'?record('result',fs.readFileSync(path.join(destination,'memoryos-readiness-result.json'))):null;
  let answer,caseError=null;
  try{answer=await orchestrateCli(launch,{supervisor,exchange,stdout});}catch(error){caseError=error;}
  finally{try{await supervisor.dispose();}catch(error){caseError??=error;}}
  const snapshot=supervisor.snapshot();
  if(caseError){const failed={name,result:'FAIL',command,requests,snapshot,outcome:answer??null,
    failure:{code:caseError.code??null,message:caseError.message},configuredFixedWorker:true,semanticDoubles:false,actualNativeFrames:true};
    rows.push(failed);write(output+'/'+name+'/receipt.json',failed);
    fs.writeFileSync(path.join(root,output,name,'stdout.data'),Buffer.concat(chunks),{flag:'wx'});throw caseError;}
  assert.equal(answer.exitCode,0);assert.equal(answer.committed,command==='evaluate');
  assert.equal(requests.length,command==='evaluate'?9:4);assert.ok(requests.every(r=>r.exitConfirmed));assert.equal(new Set(requests.map(r=>r.session)).size,1);
  assert.equal(snapshot.workers,1);assert.equal(snapshot.helpers,requests.length);assert.equal(snapshot.activeRole,null);assert.equal(snapshot.cleanupConfirmed,true);
  let active=null;for(const event of snapshot.events){if(event.type==='start'){assert.equal(active,null);active=event.role;}if(event.type==='quiescent'||(event.type==='cleanup'&&event.confirmed))active=null;}assert.equal(active,null);
  const bytes=fs.readFileSync(path.join(destination,'memoryos-readiness-result.json'));assert.deepEqual(bytes,expected);assert.deepEqual(fs.readdirSync(destination),['memoryos-readiness-result.json']);
  if(before)check(before,bytes);
  const summary=Buffer.concat(chunks);assert.deepEqual(summary,summaryProjection(b.result,command,null));
  fs.writeFileSync(path.join(root,output,name,'stdout.data'),summary,{flag:'wx'});
  const row={name,result:'PASS',command,requests,snapshot,outcome:answer,session:requests[0].session,stdout:record(output+'/'+name+'/stdout.data'),resultIdentity:record('result',bytes),
   noOverlap:true,actualFixedWorker:true,actual2B2ASemantics:true,actualNativeFrames:true,verifyNoMutation:command==='verify'?true:null};
  rows.push(row);write(output+'/'+name+'/receipt.json',row);console.log(JSON.stringify({name,result:'PASS',helpers:requests.length,workers:snapshot.workers}));
 }
 assert.notEqual(rows[0].session,rows[2].session);assert.equal(rows[0].resultIdentity.sha256,rows[2].resultIdentity.sha256);assert.equal(rows[0].stdout.sha256,rows[2].stdout.sha256);
 for(const m of bindings)check(m);
}catch(error){result='FAIL';failure={code:error.code??null,message:error.message,stack:error.stack};}
write(output+'/receipt.json',{kind:'MO1307IntegratedNativeLifecycle',version:'1.0.0',result,failure,elapsedMs:performance.now()-started,sourceBindings:bindings,cases:rows,
 differentSessionsSameNormativeBytes:result==='PASS',fixedWorker:true,syntheticInspection:false,sourceWorktreeWrites:false,phase3InstalledCertification:false});
console.log(JSON.stringify({result,cases:rows.length,elapsedMs:performance.now()-started,failure}));process.exitCode=result==='PASS'?0:1;
