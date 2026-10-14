// Finite final-generation human-decision/tag witnesses. Every installed CLI call is observed from its first helper.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { root,E,T,cache,packageRoot,HEAD,env,hash,json,record,walk,write,put,identity,canonical } from './common.mjs';
identity();
const step=process.argv[2];
assert.ok(['F','G'].includes(step));assert.equal(process.argv.length,3);
assert.equal(fs.existsSync(path.join(E,'generation-stopped.json')),false,'Generation already stopped');
assert.equal(json(path.join(E,'steps',step==='F'?'E.json':'F.json')).result,'PASS');
assert.equal(fs.existsSync(path.join(E,'steps',step+'.json')),false);
assert.equal(fs.existsSync(path.join(E,'steps',step+'-start.json')),false,'This finite step was already started');
const prepared=json(path.join(E,'vectors-prepared.json')).vectors;
const installedBefore=walk(packageRoot);assert.deepEqual(installedBefore,json(path.join(E,'baseline.json')).installed);
const prefix=step==='F'?'decisions':'tags',work=path.join(cache,step);
assert.equal(fs.existsSync(work),false);fs.mkdirSync(work);
const rows=[],cases=[],sourceFiles=['common.mjs','decisions-tags.mjs','observer-entry.mjs','runtime-observer.mjs','transport-observer.mjs','errors-observer.mjs'];
const sourceBindings=sourceFiles.map(name=>{const source=path.join(T,name);return {source:record(source),preserved:put(prefix+'/executed-sources/'+name+'.data',fs.readFileSync(source))};});
const errorRecord=e=>({name:e.name,code:e.code??null,stage:e.stage??null,reference:e.reference??null,message:e.message,stack:e.stack});
const api=await import(pathToFileURL(path.join(packageRoot,'src/index.mjs')).href);
const readinessExit={READY:0,READY_WITH_QUALIFICATIONS:2,NOT_READY:3,COULD_NOT_EVALUATE:4};
const fixtureRoot=path.join(root,'repositories/cca-conformance/fixtures/mo1307/bundles');
function bytes(file){return fs.readFileSync(file);}
function fixture(name){const directory=path.join(fixtureRoot,name),expected=bytes(path.join(directory,'expected-result.json'));return {name,directory,expected,result:JSON.parse(expected),pins:json(path.join(directory,'pins.json'))};}
function byteInput(directory,pins){
  const read=name=>bytes(path.join(directory,name)),manifest=JSON.parse(read('manifest.json'));
  return {configurationBytes:read('configuration.json'),candidateBytes:read('candidate.json'),authorityBytes:read('authority.json'),
    manifestBytes:read('manifest.json'),files:manifest.entries.map(entry=>({id:entry.id,bytes:read(entry.path)})),
    expectedCandidateDigest:pins.expectedCandidateDigest,trustedAuthorityDigest:pins.trustedAuthorityDigest};
}
function parity(actual,expected){
  assert.deepEqual(actual,expected);assert.deepEqual(actual,canonical(JSON.parse(actual)));
  const result=JSON.parse(actual);assert.equal(result.assessment.gates.length,22);
  return {result:'PASS',byteLength:actual.length,sha256:hash(actual),gates:22,readiness:result.assessment.readiness,
    readinessDigest:result.readinessDigest,proofBindingDigest:result.proofBindingDigest,
    exactFields:['candidate','candidateDigest','profile','stage','gates','blockers','cneReasons','qualifications','history','providers','readiness','readinessDigest','proofBindingDigest','canonicalResultBytes']};
}
function observationChecks(observation,operation,expectedError=null){
  assert.equal(observation.bootstrapError,null);assert.equal(observation.actualInstalledBinExecuted,true);
  assert.equal(observation.supervisors.length,1);assert.equal(observation.hookMatches.length,3);
  const s=observation.supervisors[0].snapshot;
  assert.equal(s.helpers,operation==='evaluate'?9:4);assert.equal(s.workers,1);
  assert.equal(observation.requests.length,s.helpers);
  assert.deepEqual(observation.requests.map(x=>x.sequence),Array.from({length:s.helpers},(_,i)=>i+1));
  assert.deepEqual(observation.requests.map(x=>x.operation),operation==='evaluate'
    ?['READ_SET','READ_SET','READ_SET','CHECK_OUTPUT','CHECK_OUTPUT','INSPECT_OUTPUT_ROOT','CHECK_STAGE_ROOT','INSPECT_PENDING','CHECK_FINALIZATION']
    :['READ_SET','READ_SET','READ_SET','READ_SET']);
  assert.equal(s.cleanupConfirmed,true);assert.equal(s.activeRole,null);assert.equal(s.terminalCode,expectedError);
  assert.ok(s.helperUsedMs<28000);assert.ok(observation.productLifecycleElapsedMs<30000);
  assert.ok(observation.maxRssKiB*1024<=512*1024*1024,'Necessary single-process bound; aggregate ceiling has separate observer witness');
  for(const q of observation.requests){
    assert.equal(q.disposition,'RESOLVED');assert.ok(q.durationMs<9000);assert.ok(q.chargedThisExchangeMs<9000);
    assert.equal(q.exitCode,0);assert.equal(q.transportClosed,true);assert.equal(q.responseAcceptedByTransport,true);
    assert.equal(q.responseComplete,true);assert.equal(q.responseBindingMatches,true);
  }
  if(operation==='evaluate'){assert.equal(s.publication.phase,'COMMITTED');assert.equal(s.publication.namespaceVerified,true);
    assert.equal(s.publication.deadlineExpiredAfterAdmission,false);assert.equal(s.publication.cancelledAfterAdmission,false);}
  else assert.equal(s.publication,null);
  return s;
}
function invoke(testCase,operation){
  const scope=prefix+'/'+testCase.name+'/'+operation,folder=path.join(E,scope);
  fs.mkdirSync(folder,{recursive:true});
  const trace=path.join(folder,'observation.json'),bin=path.join(packageRoot,'bin/memoryos-readiness.mjs');
  const args=[operation,'--input-root',testCase.inputRoot,'--config','configuration.json','--authority','authority.json',
    '--authority-sha256',testCase.pins.trustedAuthorityDigest,'--candidate-sha256',testCase.pins.expectedCandidateDigest,
    operation==='evaluate'?'--output-root':'--result-root',testCase.destination,...(testCase.decisionName?['--decision',testCase.decisionName]:[])];
  const command=[path.join(T,'observer-entry.mjs'),trace,bin,...args];
  const expectedError=testCase.expectedError??null;
  const expectedExit=expectedError?27:operation==='evaluate'?readinessExit[testCase.result.assessment.readiness]:0;
  write(scope+'/invocation.json',{generation:'FINAL_FINITE_CERTIFICATION',step,name:testCase.name,operation,startedAt:new Date().toISOString(),
    executable:process.execPath,args:command,installedBin:bin,productArgs:args,cwd:path.join(cache,'cwd'),env,expectedExit,expectedError,
    engineeringGuardMs:45000,noRetry:true,sourceBindings});
  const start=performance.now(),r=spawnSync(process.execPath,command,{cwd:path.join(cache,'cwd'),env,windowsHide:true,shell:false,
    encoding:null,timeout:45000,maxBuffer:1024*1024});
  const row={name:testCase.name,operation,elapsedMs:performance.now()-start,exit:r.status,signal:r.signal,error:r.error?.code??null,
    stdout:put(scope+'/stdout.data',r.stdout??Buffer.alloc(0)),stderr:put(scope+'/stderr.data',r.stderr??Buffer.alloc(0)),result:'FAIL'};
  try{
    assert.ifError(r.error);assert.equal(r.signal,null);assert.equal(r.status,expectedExit,(r.stderr??Buffer.alloc(0)).toString());
    const observation=json(trace);row.observation=record(trace);assert.equal(observation.productExit,r.status);
    const snapshot=observationChecks(observation,operation,expectedError);
    row.helperUsedMs=snapshot.helperUsedMs;row.productLifecycleElapsedMs=observation.productLifecycleElapsedMs;
    if(expectedError){
      assert.equal(r.stdout.length,0);const diagnostic=JSON.parse(r.stderr);assert.equal(diagnostic.code,expectedError);
      assert.equal(diagnostic.stage,'VERIFICATION');assert.equal(diagnostic.reference,'decision');row.diagnostic=diagnostic;
    }else{
      assert.equal(r.stderr.length,0);const summary=JSON.parse(r.stdout);
      assert.equal(summary.operation,operation);assert.equal(summary.readiness,testCase.result.assessment.readiness);
      assert.equal(summary.readinessDigest,testCase.result.readinessDigest);assert.equal(summary.proofBindingDigest,testCase.result.proofBindingDigest);
      assert.deepEqual(summary.decision,testCase.expectedDecision??null);row.summary=summary;
    }
    row.preservedResult=parity(bytes(path.join(testCase.destination,'memoryos-readiness-result.json')),testCase.expected);
    assert.deepEqual(fs.readdirSync(testCase.destination),['memoryos-readiness-result.json']);
    row.result='PASS';return row;
  }catch(error){row.failure=errorRecord(error);throw error;}
  finally{rows.push(row);write(scope+'/receipt.json',row);}
}
async function apiVerify(testCase){
  const input={...byteInput(testCase.inputRoot,testCase.pins),resultBytes:testCase.expected,decisionBytes:testCase.decisionBytes??null};
  const start=performance.now();let value=null,error=null;
  try{value=await api.verifyReadiness(input);}catch(e){error=e;}
  const elapsedMs=performance.now()-start,row={name:testCase.name,operation:'public-api-verify',elapsedMs,result:'FAIL'};
  try{
    assert.ok(elapsedMs<10000);
    if(testCase.expectedError){assert.equal(error?.code,testCase.expectedError);assert.equal(error.stage,'VERIFICATION');
      row.error=errorRecord(error);}
    else{assert.equal(error,null);row.parity=parity(Buffer.from(value.resultBytes),testCase.expected);row.resultBytes=put(prefix+'/'+testCase.name+'/api-verify-result.data',Buffer.from(value.resultBytes));
      assert.deepEqual(value.decision,testCase.expectedDecision??null);row.decision=value.decision;}
    row.result='PASS';return row;
  }catch(e){row.failure=errorRecord(e);throw e;}
  finally{rows.push(row);write(prefix+'/'+testCase.name+'/api-verify.json',row);}
}
async function apiTagParity(testCase){
  const input=byteInput(testCase.inputRoot,testCase.pins),row={name:testCase.name,operation:'public-api-evaluate',result:'FAIL'};
  const start=performance.now();
  try{const value=await api.evaluateReadiness(input);row.elapsedMs=performance.now()-start;assert.ok(row.elapsedMs<10000);
    row.parity=parity(Buffer.from(value.resultBytes),testCase.expected);row.resultBytes=put(prefix+'/'+testCase.name+'/api-evaluate-result.data',Buffer.from(value.resultBytes));row.result='PASS';}
  catch(error){row.elapsedMs=performance.now()-start;row.failure=errorRecord(error);throw error;}
  finally{rows.push(row);write(prefix+'/'+testCase.name+'/api-evaluate.json',row);}
  await apiVerify(testCase);
}
const definitionsF=[
  {name:'ready-approve',base:'B',decision:'APPROVE',consistency:'CONSISTENT'},
  {name:'ready-reject',base:'B',decision:'REJECT',consistency:'CONSISTENT'},
  {name:'qualified-approve',base:'A',decision:'APPROVE',consistency:'CONSISTENT'},
  {name:'not-ready-attempted-approve',base:'C',decision:'APPROVE',consistency:'CONTRARY_TO_READINESS'},
  {name:'candidate-mismatch',base:'B',decision:'APPROVE',mutation:'candidateDigest'},
  {name:'readiness-mismatch',base:'B',decision:'APPROVE',mutation:'readinessDigest'},
  {name:'proof-mismatch',base:'B',decision:'APPROVE',mutation:'proofBindingDigest'}
];
const preTagAbsentDefinition={name:'pre-tag-absent',stage:'PRE_TAG_READINESS',readiness:'READY',checkCode:null,reusedFreshPrimary:'B'};
const definitionsG=[
  {name:'post-tag-ready',stage:'POST_TAG_VERIFICATION',readiness:'READY',checkCode:null},
  {name:'pre-tag-present',stage:'PRE_TAG_READINESS',readiness:'NOT_READY',checkCode:'TAG_PRESENCE'},
  {name:'post-tag-absent',stage:'POST_TAG_VERIFICATION',readiness:'NOT_READY',checkCode:'TAG_PRESENCE'},
  {name:'post-tag-lightweight',stage:'POST_TAG_VERIFICATION',readiness:'NOT_READY',checkCode:'TAG_ANNOTATION'},
  {name:'post-tag-wrong-target',stage:'POST_TAG_VERIFICATION',readiness:'NOT_READY',checkCode:'TAG_TARGET'},
  {name:'post-tag-wrong-name',stage:'POST_TAG_VERIFICATION',readiness:'NOT_READY',checkCode:'TAG_NAME',derivedD11:true}
];
let failure=null;
try{
  write('steps/'+step+'-start.json',{step,generation:'FINAL_FINITE_CERTIFICATION',startedAt:new Date().toISOString(),
    planned:step==='F'?definitionsF:[preTagAbsentDefinition,...definitionsG],noRetry:true,sourceBindings,
    qualifiedChoice:'MO1306 primary A is authoritative qualified result; no additional qualified evaluate.',
    preTagReadyChoice:'Accepted READY primary B supplies fresh PRE_TAG_READINESS with missing-tag success; no duplicate evaluate.',
    noGitSubprocessForTagObservation:true});
  if(step==='F'){
    const primaryPins=new Map();
    for(const definition of definitionsF){
      const primary=json(path.join(E,'steps',definition.base+'.json'));assert.equal(primary.result,'PASS');
      const vector=prepared.find(v=>v.name===primary.name);assert.ok(vector);
      const baseFixture=fixture(primary.name),expected=bytes(path.join(primary.destination,'memoryos-readiness-result.json'));
      assert.deepEqual(expected,baseFixture.expected);const result=JSON.parse(expected);
      if(definition.base==='A')assert.equal(result.assessment.readiness,'READY_WITH_QUALIFICATIONS');
      const primaryBefore=walk(primary.destination);primaryPins.set(primary.destination,primaryBefore);
      const parent=path.join(work,definition.name),inputRoot=path.join(parent,'i');fs.mkdirSync(parent);fs.cpSync(vector.inputRoot,inputRoot,{recursive:true});
      const decision={kind:'MemoryOSReadinessHumanDecision',version:'1.0.0',candidateDigest:result.assessment.candidateDigest,
        readinessDigest:result.readinessDigest,proofBindingDigest:result.proofBindingDigest,decision:definition.decision,
        authenticity:'NOT_VERIFIED_BY_MEMORYOS',actor:null,attestation:null,
        reason:'Engineering binding control; no human release authorization.',timestamp:null};
      if(definition.mutation){assert.notEqual(decision[definition.mutation],'sha256:'+'f'.repeat(64));decision[definition.mutation]='sha256:'+'f'.repeat(64);}
      const decisionBytes=canonical(decision),decisionName='final-decision.json';fs.writeFileSync(path.join(inputRoot,decisionName),decisionBytes,{flag:'wx'});
      const testCase={...definition,inputRoot,destination:primary.destination,pins:baseFixture.pins,expected,result,decisionBytes,decisionName,
        expectedError:definition.mutation?'MO1307_DECISION_MISMATCH':null,
        expectedDecision:definition.mutation?null:{decision:definition.decision,consistency:definition.consistency,authenticity:'NOT_VERIFIED_BY_MEMORYOS'}};
      write(prefix+'/'+definition.name+'/fixture.json',{definition,inputRoot,primaryStep:definition.base,primaryReceipt:record(path.join(E,'steps',definition.base+'.json')),
        originalResult:record(path.join(primary.destination,'memoryos-readiness-result.json')),decision:record(path.join(inputRoot,decisionName)),input:walk(inputRoot)});
      invoke(testCase,'verify');await apiVerify(testCase);
      assert.deepEqual(walk(primary.destination),primaryBefore,'Computed readiness or publication changed by human decision');
      cases.push({name:definition.name,result:'PASS',nativeVerifyExit:definition.mutation?27:0,expectedError:testCase.expectedError,
        decision:testCase.expectedDecision,computedReadinessUnchanged:true,primaryStep:definition.base});
    }
    for(const [directory,pins]of primaryPins)assert.deepEqual(walk(directory),pins);
  }else{
    const ready=json(path.join(E,'steps/B.json'));assert.equal(ready.result,'PASS');
    const readyResult=JSON.parse(bytes(path.join(ready.destination,'memoryos-readiness-result.json')));
    assert.equal(readyResult.assessment.stage,'PRE_TAG_READINESS');assert.equal(readyResult.assessment.readiness,'READY');
    write('tags/pre-tag-absent-reuse.json',{result:'PASS',source:record(path.join(E,'steps/B.json')),resultFile:record(path.join(ready.destination,'memoryos-readiness-result.json')),
      reason:'This same final generation already executed canonical PRE_TAG_READINESS/READY evaluate+verify with API parity; explicitly reused to avoid an undeclared duplicate.'});
    cases.push({name:'pre-tag-absent',result:'PASS',stage:'PRE_TAG_READINESS',readiness:'READY',checkCode:null,reusedFreshSameGeneration:true,sourceStep:'B'});
    for(const definition of definitionsG){
      const parent=path.join(work,definition.name),inputRoot=path.join(parent,'i'),outputParent=path.join(parent,'p'),destination=path.join(outputParent,'result');
      fs.mkdirSync(parent);fs.mkdirSync(outputParent);fs.writeFileSync(path.join(outputParent,'owned-parent.txt'),'Private final tag fixture parent.\n',{flag:'wx'});
      let testCase;
      if(!definition.derivedD11){
        const source=fixture(definition.name);fs.cpSync(source.directory,inputRoot,{recursive:true});
        testCase={...definition,...source,inputRoot,destination};
      }else{
        const preparedWrongName=json(path.join(E,'wrong-name-prepared.json'));
        assert.ok(preparedWrongName.inputRoot&&preparedWrongName.expectedPath&&preparedWrongName.pins&&preparedWrongName.result);
        fs.cpSync(preparedWrongName.inputRoot,inputRoot,{recursive:true});
        const expected=bytes(preparedWrongName.expectedPath),result=JSON.parse(expected);
        assert.deepEqual(result,preparedWrongName.result);
        testCase={...definition,inputRoot,destination,expected,result,pins:preparedWrongName.pins};
        put('tags/'+definition.name+'/expected-result.json',expected);
        write('tags/'+definition.name+'/derivation.json',{method:'Sealed before A; exact accepted D11 wrong-name mutation and repin; test-owned fixture only',prepared:record(path.join(E,'wrong-name-prepared.json')),expected:record(preparedWrongName.expectedPath),pins:testCase.pins});
      }
      assert.equal(testCase.result.assessment.stage,definition.stage);assert.equal(testCase.result.assessment.readiness,definition.readiness);
      if(definition.checkCode)assert.ok(testCase.result.assessment.blockers.some(x=>x.gateId==='tag'&&x.checkCode===definition.checkCode));
      write('tags/'+definition.name+'/fixture.json',{definition,inputRoot,destination,pins:testCase.pins,input:walk(inputRoot),
        expectedResult:{byteLength:testCase.expected.length,sha256:hash(testCase.expected)},expectedExit:readinessExit[definition.readiness],
        suppliedObservationOnly:true,noGitSubprocess:true,noTagMutation:true});
      invoke(testCase,'evaluate');invoke(testCase,'verify');await apiTagParity(testCase);
      cases.push({name:definition.name,result:'PASS',stage:definition.stage,readiness:definition.readiness,checkCode:definition.checkCode,
        nativeEvaluateExit:readinessExit[definition.readiness],nativeVerifyExit:0,exactApiParity:true});
    }
  }
  assert.deepEqual(cases.map(row=>row.name),step==='F'?definitionsF.map(row=>row.name):[preTagAbsentDefinition,...definitionsG].map(row=>row.name));
  assert.ok(cases.every(row=>row.result==='PASS'));
}catch(error){
  failure=errorRecord(error);
  if(!fs.existsSync(path.join(E,'generation-stopped.json')))write('generation-stopped.json',{step,at:new Date().toISOString(),reason:'FIRST_MANDATORY_FAILURE',failure,noRetry:true,noLaterSteps:true});
}finally{
  let integrityError=null;const after=walk(packageRoot);
  try{assert.deepEqual(after,installedBefore);}catch(error){integrityError=errorRecord(error);failure??=integrityError;
    if(!fs.existsSync(path.join(E,'generation-stopped.json')))write('generation-stopped.json',{step,at:new Date().toISOString(),reason:'INSTALLED_INTEGRITY_FAILURE',failure,noRetry:true,noLaterSteps:true});}
  const receipt={step,result:failure?'FAIL':'PASS',failure,cases,rows,installedUnchanged:integrityError===null,finishedAt:new Date().toISOString(),
    actualInstalledBinObserved:true,noRetry:true,sourceBindings,noGitSubprocessForTagObservation:true,noTagMutation:true,noNetwork:true};
  write('steps/'+step+'.json',receipt);write(prefix+'/receipt.json',receipt);
  console.log(JSON.stringify({step,result:receipt.result,cases:cases.length,nativeInvocations:rows.filter(x=>['evaluate','verify'].includes(x.operation)).length,failure}));
  process.exitCode=failure?1:0;
}
