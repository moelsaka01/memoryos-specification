// Finite, offline Phase 2A engineering evidence. Not acquisition, authority
// verification, installed certification, characterization or public runtime.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';
import { canonicalBytes, digest } from '../../../memoryos-readiness/src/canonical.mjs';
import { computeReadiness } from '../../../memoryos-readiness/src/readiness-core.mjs';
import { projectReadinessResult } from '../../../memoryos-readiness/src/readiness-result.mjs';
const computeWithProjections=verified=>{const computed=computeReadiness(verified);return {...computed,jsonSummary:projectReadinessResult(computed.result,'json'),text:projectReadinessResult(computed.result,'text')};};
import { bundleNames, loadProjection } from './fixture-projection.mjs';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const base='repositories/cca-conformance/evidence/mo1307/phase2a';
const baseline='3883ca889911fcc5a6f46c24e569478a8c32648e';
const nodePin='sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32';
assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
assert.equal(fs.statSync(process.execPath).size,93580104);assert.equal(digest(fs.readFileSync(process.execPath)),nodePin);
assert.equal(process.argv.length,4);assert.equal(process.argv[2],'--output');
const directory=path.resolve(root,process.argv[3]);
assert.ok(directory.startsWith(path.resolve(root,base)+path.sep));
assert.ok(!fs.existsSync(directory),'Receipt directory is single use');fs.mkdirSync(directory,{recursive:true});
const write=(name,value)=>fs.writeFileSync(path.join(directory,name),canonicalBytes(value));
const rows=[];
const python='C:/Users/melsa/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
function run(id,exe,args) {
  const start=performance.now();
  const result=spawnSync(exe,args,{cwd:root,windowsHide:true,encoding:null,timeout:60000,maxBuffer:2*1024*1024});
  const stdout=result.stdout??Buffer.alloc(0),stderr=result.stderr??Buffer.alloc(0);
  fs.writeFileSync(path.join(directory,id+'.stdout.txt'),stdout);fs.writeFileSync(path.join(directory,id+'.stderr.txt'),stderr);
  const row={id,executable:exe,args,exit:result.status,error:result.error?.code??null,elapsedMs:Math.ceil(performance.now()-start),
    stdout:{byteLength:stdout.length,sha256:digest(stdout)},stderr:{byteLength:stderr.length,sha256:digest(stderr)},result:result.status===0&&!result.error?'PASS':'FAIL'};
  if(id==='phase2a-tests') {
    const output=stdout.toString('utf8'),count=name=>Number(new RegExp('^# '+name+' (\\d+)$','m').exec(output)?.[1]??0);
    row.tests=Object.fromEntries(['tests','pass','fail','cancelled','skipped','todo'].map(name=>[name,count(name)]));
    if(!row.tests.tests || row.tests.pass!==row.tests.tests || row.tests.fail || row.tests.cancelled || row.tests.skipped || row.tests.todo)row.result='FAIL';
  }
  rows.push(row);process.stdout.write(JSON.stringify(row)+'\n');return row.result==='PASS';
}
let okay=true;
for(const file of ['readiness-core','readiness-result'])okay=run('syntax-'+file,process.execPath,['--check','repositories/memoryos-readiness/src/'+file+'.mjs'])&&okay;
if(okay)okay=run('phase2a-tests',process.execPath,['--test','--test-reporter=tap','--test-concurrency=1','repositories/cca-conformance/tests/mo1307_phase2a_core_test.mjs','repositories/cca-conformance/tests/mo1307_phase2a_result_test.mjs']);
if(okay)okay=run('package',process.execPath,['repositories/cca-conformance/tools/mo1307-phase1/package.mjs','check']);
if(okay)okay=run('workspace',python,['-B','tools/verify_workspace.py','--root','.']);
if(okay)okay=run('diff-check','git',['-c','safe.directory='+root.replaceAll('\\','/'),'diff','--check']);
const vectors=[],determinism=[];
if(okay) {
  fs.mkdirSync(path.join(directory,'vectors'));
  for(const name of bundleNames) {
    const fixture=loadProjection(name),out=computeWithProjections(fixture.verified);
    assert.deepEqual(out.resultBytes,fixture.expectedBytes);assert.deepEqual(out.jsonSummary,fixture.summaryBytes);
    const reordered=structuredClone(fixture.verified);reordered.claims.reverse();reordered.slots.reverse();
    const other=computeWithProjections(reordered),again=computeWithProjections(fixture.verified);
    for(const second of [other,again]) {
      for(const key of ['resultBytes','jsonSummary','text'])assert.deepEqual(second[key],out[key]);
      for(const key of ['readinessDigest','proofBindingDigest','exitCode'])assert.equal(second[key],out[key]);
      for(const key of ['gates','blockers','qualifications','cneReasons','history','providers','readiness'])assert.deepEqual(second.result.assessment[key],out.result.assessment[key]);
    }
    const a=out.result.assessment;
    const identity={name,readiness:a.readiness,exit:out.exitCode,gates:a.gates.length,blockers:a.blockers.length,qualifications:a.qualifications.length,cne:a.cneReasons.length,history:a.history.length,providers:a.providers.length,
      result:{byteLength:out.resultBytes.length,sha256:digest(out.resultBytes)},jsonSummary:{byteLength:out.jsonSummary.length,sha256:digest(out.jsonSummary)},text:{byteLength:out.text.length,sha256:digest(out.text)},readinessDigest:out.readinessDigest,proofBindingDigest:out.proofBindingDigest};
    vectors.push(identity);
    determinism.push({name,repetitions:2,privateCollectionPermutation:true,exactResult:true,exactGates:true,exactBlockers:true,exactQualifications:true,exactCne:true,exactHistory:true,exactProviders:true,exactJsonSummary:true,exactText:true,readinessDigest:out.readinessDigest,proofBindingDigest:out.proofBindingDigest});
    if(['ready','qualified','not-ready','could-not-evaluate','rest-qualified','mo1306-qualified'].includes(name)) {
      fs.writeFileSync(path.join(directory,'vectors',name+'.result.json'),out.resultBytes);
      fs.writeFileSync(path.join(directory,'vectors',name+'.summary.json'),out.jsonSummary);
      fs.writeFileSync(path.join(directory,'vectors',name+'.txt'),out.text);
    }
    if(name==='mo1306-qualified')write('mo1306-vector.json',{kind:'MO1307Phase2AMO1306Vector',version:'1.0.0',classification:'COMPUTED_FROM_ASSUMED_VERIFIED_FROZEN_FIXTURE',productionAuthorityVerification:false,
      ...identity,providerProjection:a.providers,disclosures:a.qualifications,historyProjection:a.history,sourceHistoryRows:19,hostedSuccessClaim:false});
  }
  write('normative-vectors.json',{kind:'MO1307Phase2ANormativeVectors',version:'1.0.0',classification:'PURE_COMPUTATION_ENGINEERING_VECTORS',independentOracle:'UNCHANGED_PHASE1_FIXTURES',vectors});
  write('determinism.json',{kind:'MO1307Phase2ADeterminism',version:'1.0.0',result:'PASS',cases:determinism});
}
write('receipt.json',{kind:'MO1307Phase2AAcceptance',version:'1.0.0',baseline,classification:'PURE_CORE_AND_CHEAP_REGRESSION_ONLY',productionCertification:false,
  runtime:{node:process.version,platform:process.platform,arch:process.arch,sha256:nodePin},commands:rows,exactFixtureVectors:vectors.length,result:okay?'PASS':'FAIL',characterizationRun:false,networkUsed:false});
process.exitCode=okay?0:1;
