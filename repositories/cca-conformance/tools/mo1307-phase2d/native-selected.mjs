// Real packaged CLI and byte-only API parity. No semantic/helper/worker doubles.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
import {root,evidence,hash,record,check,write,json} from './common.mjs';
import {packageFiles,checkPackage} from '../mo1307-phase1/package.mjs';
import {loadBundle,inputOf} from '../mo1307-phase2b/test-support.mjs';
import {canonicalBytes} from '../../../memoryos-readiness/src/canonical.mjs';
import {summaryProjection} from '../../../memoryos-readiness/src/projections.mjs';
import {evaluateReadiness,verifyReadiness} from '../../../memoryos-readiness/src/index.mjs';
assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
assert.equal(hash(fs.readFileSync(process.execPath)),'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
assert.equal(process.argv[2],'--output');assert.equal(process.argv.length,5);const selectedCase=process.argv[4];assert.ok(['could-not-evaluate','mo1306-qualified','rest-qualified'].includes(selectedCase));
const output=process.argv[3].replaceAll('\\','/');
assert.ok([evidence+'/native/','.cache/mo1307/phase2d/post-binding/'].some(p=>path.resolve(root,output).startsWith(path.resolve(root,p)+path.sep)));
assert.equal(json(evidence+'/pre-native-authorization.json').result,'PASS');checkPackage();
assert.equal(fs.existsSync(path.join(root,output)),false);fs.mkdirSync(path.join(root,output),{recursive:true});
const scratch=path.join(root,'.cache','m7d-native-'+process.pid);assert.equal(fs.existsSync(scratch),false);fs.mkdirSync(scratch);
const cli=path.join(root,'repositories/memoryos-readiness/bin/memoryos-readiness.mjs'),finalName='memoryos-readiness-result.json';
const selections=[['could-not-evaluate','DEFER'],['mo1306-qualified','REJECT'],['rest-qualified',null]].filter(row=>row[0]===selectedCase);
const cases=selections.map(([name,decision])=>{
 const b=loadBundle(name),directory=path.join(scratch,name),input=path.join(directory,'input'),parent=path.join(directory,'publication');
 fs.mkdirSync(directory);fs.cpSync(path.join(root,'repositories/cca-conformance/fixtures/mo1307/bundles',name),input,{recursive:true});fs.mkdirSync(parent);
 // Prepare every output ancestor and receipt directory before any native inspection.
 fs.writeFileSync(path.join(parent,'owned-parent.txt'),'Phase2D engineering-owned stable parent.\n');
 fs.mkdirSync(path.join(root,output,name));
 let decisionBytes=null;if(decision){decisionBytes=canonicalBytes({kind:'MemoryOSReadinessHumanDecision',version:'1.0.0',candidateDigest:b.result.assessment.candidateDigest,
  readinessDigest:b.result.readinessDigest,proofBindingDigest:b.result.proofBindingDigest,decision,actor:null,timestamp:null,reason:'Phase2D supplied decision binding witness',attestation:null,authenticity:'NOT_VERIFIED_BY_MEMORYOS'});
  fs.writeFileSync(path.join(input,'decision.json'),decisionBytes);}
 return {name,b,input,parent,destination:path.join(parent,'result'),decisionBytes};
});
const walk=p=>fs.readdirSync(path.join(root,p)).sort().flatMap(n=>{const next=p+'/'+n;return fs.statSync(path.join(root,next)).isDirectory()?walk(next):[next];});
const bound=[...packageFiles.map(p=>'repositories/memoryos-readiness/'+p),...walk('repositories/cca-conformance/fixtures/mo1307'),
 'repositories/cca-conformance/tools/mo1307-phase2d/native-selected.mjs','repositories/cca-conformance/tools/mo1307-phase2d/common.mjs',
 'repositories/cca-conformance/tools/mo1307-phase2b/test-support.mjs'].sort().map(p=>record(p));
write(output+'/campaign.json',{kind:'MO1307IntegratedNativeCampaign',version:'1.0.0',sourceBindings:bound,selected:selections,
 runtime:{version:process.version,sha256:hash(fs.readFileSync(process.execPath))},perChildEngineeringTimeoutMs:45000,retries:0,
 semanticDoubles:false,helperDoubles:false,workerOverrides:false,productionAdmissionMs:30000,finiteRenameSettlementClaim:false});
const rows=[],started=performance.now();let result='PASS',failure=null;
function cliRun(c,command,suffix='',destination=c.destination){
 const args=[cli,command,'--input-root',c.input,'--config','configuration.json','--authority','authority.json',
  '--authority-sha256',c.b.pins.trustedAuthorityDigest,'--candidate-sha256',c.b.pins.expectedCandidateDigest,
  command==='evaluate'?'--output-root':'--result-root',destination];
 if(command==='verify'&&c.decisionBytes)args.push('--decision','decision.json');
 const at=performance.now(),answer=spawnSync(process.execPath,args,{cwd:root,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'},windowsHide:true,encoding:null,timeout:45000,maxBuffer:1024*1024});
 const stdout=answer.stdout??Buffer.alloc(0),stderr=answer.stderr??Buffer.alloc(0),name=command+suffix;
 for(const [ext,bytes] of [['stdout.data',stdout],['stderr.data',stderr]])fs.writeFileSync(path.join(root,output,c.name,name+'.'+ext),bytes,{flag:'wx'});
 const row={command,name,exit:answer.status,signal:answer.signal,error:answer.error?.code??null,elapsedMs:performance.now()-at,
  stdout:record(output+'/'+c.name+'/'+name+'.stdout.data'),stderr:record(output+'/'+c.name+'/'+name+'.stderr.data')};
 write(output+'/'+c.name+'/'+name+'.receipt.json',row);
 assert.ifError(answer.error);assert.equal(stderr.length,0,stderr.toString());
 assert.equal(answer.status,command==='verify'?0:({READY:0,READY_WITH_QUALIFICATIONS:2,NOT_READY:3,COULD_NOT_EVALUATE:4}[c.b.result.assessment.readiness]));
 assert.equal(stdout.at(-1),10);return {row,stdout};
}
try {
 for(const c of cases){
  const original=inputOf(c.b),api=await evaluateReadiness(original),expected=canonicalBytes(c.b.result);
  assert.deepEqual(Buffer.from(api.resultBytes),expected);assert.equal(api.readinessDigest,c.b.result.readinessDigest);assert.equal(api.proofBindingDigest,c.b.result.proofBindingDigest);
  const evaluated=cliRun(c,'evaluate');assert.deepEqual(evaluated.stdout,summaryProjection(c.b.result,'evaluate',null));
  const published=fs.readFileSync(path.join(c.destination,finalName));assert.deepEqual(published,expected);assert.deepEqual(fs.readdirSync(c.destination),[finalName]);
  fs.writeFileSync(path.join(root,output,c.name,'result.json'),published,{flag:'wx'});
  const apiVerified=await verifyReadiness({...original,resultBytes:published,decisionBytes:c.decisionBytes});
  assert.deepEqual(Buffer.from(apiVerified.resultBytes),expected);assert.equal(apiVerified.readinessDigest,api.readinessDigest);assert.equal(apiVerified.proofBindingDigest,api.proofBindingDigest);
  const before=record(finalName,published),verified=cliRun(c,'verify');
  assert.deepEqual(verified.stdout,summaryProjection(c.b.result,'verify',apiVerified.decision));
  assert.deepEqual(fs.readdirSync(c.destination),[finalName]);check(before,fs.readFileSync(path.join(c.destination,finalName)));
  const row={name:c.name,result:'PASS',readiness:c.b.result.assessment.readiness,gates:c.b.result.assessment.gates.length,
   exit:evaluated.row.exit,readinessDigest:api.readinessDigest,proofBindingDigest:api.proofBindingDigest,
   resultBytes:record(output+'/'+c.name+'/result.json'),cliEvaluate:evaluated.row,cliVerify:verified.row,decision:apiVerified.decision,
   actualPackagedCli:true,actualFixedWorker:true,actual2BVerification:true,actual2AComputation:true,actualNativePublication:true,
   exactApiCliParity:true,verifyNoPublicationMutation:true};
  if(c.name==='ready'){
   const second=path.join(c.parent,'result-repeat'),again=cliRun(c,'evaluate','-repeat',second);
   assert.deepEqual(fs.readFileSync(path.join(second,finalName)),published);assert.deepEqual(again.stdout,evaluated.stdout);
   row.repeat={...again.row,differentSafeOutputRoot:true,sameNormativeBytes:true,newCliProcess:true};
  }
  rows.push(row);write(output+'/'+c.name+'/receipt.json',row);console.log(JSON.stringify({case:c.name,result:'PASS',readiness:row.readiness,exit:row.exit,verifyExit:verified.row.exit}));
 }
 for(const member of bound)check(member);
}catch(error){result='FAIL';failure={code:error.code??null,message:error.message,stack:error.stack};}
write(output+'/receipt.json',{kind:'MO1307IntegratedNativeAcceptance',version:'1.0.0',result,failure,elapsedMs:performance.now()-started,
 cases:rows,completedCases:rows.length,expectedCases:1,sourceBindings:bound,sourceInputsUnchanged:bound.every(m=>{try{check(m);return true;}catch{return false;}}),
 scope:'REAL_PACKAGED_CLI_NATIVE_WINDOWS_AND_BYTE_API_PARITY',phase3InstalledCertification:false,network:false,sourceWorktreeWrites:false});
console.log(JSON.stringify({result,cases:rows.length,elapsedMs:performance.now()-started,failure}));process.exitCode=result==='PASS'?0:1;
