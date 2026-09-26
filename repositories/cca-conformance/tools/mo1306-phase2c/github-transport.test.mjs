import assert from 'node:assert/strict';
import test from 'node:test';
import { parseSummary,bindVerifiedBundle,outputLines,gatePrerequisite,commonExit } from '../../../memoryos-ci/src/github-transport.mjs';
import { digest } from '../../../memoryos-ci/src/contracts.mjs';
import { J } from '../../../memoryos-ci/src/serialization.mjs';
import { metadata } from '../../../memoryos-ci/src/metadata.mjs';
const runId='c9fa2c73-4874-42e7-8a25-8e1ab93bb121',pin='sha256:'+'a'.repeat(64),other='sha256:'+'b'.repeat(64);
const providerMetadata=metadata('github',{GITHUB_RUN_ID:'123',GITHUB_RUN_ATTEMPT:'1',GITHUB_JOB:'memoryos_ci'});
function bound(classification,exitCode) {
  const result={provider:'github',runId,classification,process:{exitCode},configurationDigest:pin};
  const evidence={distributionSha256:pin,metadata:providerMetadata};
  const summary={kind:'MemoryOSCICDSummary',version:'1.0.0',runId,classification,exitCode,resultSha256:digest(J(result)),publication:'COMPLETE'};
  const expected={runId,exitCode,configurationDigest:pin,distributionDigest:pin,providerMetadata,summary};
  return {bundle:{result,evidence},expected,summary};
}
for(const [classification,code] of [['PASS',0],['FAIL',6],['COULD_NOT_EVALUATE',7],['INPUT_ERROR',11],['CONFIGURATION_ERROR',10],['INTEGRITY_ERROR',15],['TIMEOUT',13],['CANCELLED',14]]) {
  test('verified '+classification+' retains complete and common exit',()=>{
    const {bundle,expected,summary}=bound(classification,code);
    assert.equal(J(parseSummary(Buffer.from(J(summary)),code)),J(summary));
    assert.deepEqual(bindVerifiedBundle(bundle,expected),{complete:true,exitCode:code,runId});
    assert.equal(outputLines(bindVerifiedBundle(bundle,expected)),`complete=true\nexit-code=${code}\nrun-id=${runId}\n`);
  });
}
test('summary NONE is incomplete and never gains completion',()=>{
  const {summary}=bound('INTEGRITY_ERROR',15);summary.publication='NONE';summary.resultSha256=null;
  assert.equal(parseSummary(Buffer.from(J(summary)),15).publication,'NONE');
  assert.equal(outputLines({complete:false,exitCode:15,runId}),`complete=false\nexit-code=15\nrun-id=${runId}\n`);
});
for(const [name,mutate] of [
  ['wrong run',(b,e)=>e.runId='11111111-1111-4111-8111-111111111111'],
  ['traversal run',(b,e)=>e.runId='../secret'],
  ['wrong config',(b,e)=>e.configurationDigest=other],
  ['wrong distribution',(b,e)=>e.distributionDigest=other],
  ['wrong provider',b=>b.result.provider='azure'],
  ['wrong exit',(b,e)=>e.exitCode=6],
  ['wrong result hash',(b,e)=>e.summary.resultSha256=other],
  ['wrong summary outcome',(b,e)=>e.summary.classification='FAIL'],
  ['incomplete summary',(b,e)=>e.summary.publication='NONE'],
  ['wrong provider run',(b,e)=>e.providerMetadata={...providerMetadata,runId:'124'}],
  ['wrong attempt',(b,e)=>e.providerMetadata={...providerMetadata,attempt:2}],
]) test('binding rejects '+name,()=>{const {bundle,expected}=bound('PASS',0);mutate(bundle,expected);assert.throws(()=>bindVerifiedBundle(bundle,expected));});
for(const [name,modify,code] of [
  ['valid pass',x=>x,0],['valid failed gate',x=>({...x,exitCode:'6'}),6],['upload failure',x=>({...x,uploadOutcome:'failure'}),17],
  ['missing upload',x=>({...x,uploadOutcome:undefined}),17],['missing evaluation',x=>({...x,evaluateOutcome:'skipped'}),16],
  ['operational failure',x=>({...x,complete:'false',exitCode:'15'}),15],['incomplete pass',x=>({...x,complete:'false'}),16],
  ['incomplete fail',x=>({...x,complete:'false',exitCode:'6'}),16],['missing run',x=>({...x,runId:''}),16],
  ['injected exit',x=>({...x,exitCode:'0;throw 1'}),16],
]) test('gate '+name,()=>{const input=modify({complete:'true',exitCode:'0',runId,evaluateOutcome:'success',uploadOutcome:'success'});const value=gatePrerequisite(input);assert.equal(value??Number(input.exitCode),code);});
test('transport outputs reject injection and unsupported exit',()=>{
  for(const runId of ['../bad','x\ncomplete=true','C:\\secret','c9fa2c73-4874-42e7-8a25-8e1ab93bb121/child'])assert.throws(()=>outputLines({complete:true,exitCode:0,runId}));
  for(const value of ['00','8','-1','1.0','0\n','15;exit 0'])assert.equal(commonExit(value),null);
});
test('provider run identity is operational and not a result UUID',()=>{
  const first=metadata('github',{GITHUB_RUN_ID:'123'}),second=metadata('github',{GITHUB_RUN_ID:'124'});
  assert.notEqual(first.runId,second.runId);assert.notEqual(first.runId,runId);
  for(const bad of ['../bad','${{ secrets.TOKEN }}','1\r\nRUN=2'])assert.throws(()=>metadata('github',{GITHUB_RUN_ID:bad}));
});
test('summary rejects wrong exit, forged complete, extra keys and trailing data',()=>{
  const {summary}=bound('PASS',0);
  assert.throws(()=>parseSummary(Buffer.from(J(summary)),6));
  assert.throws(()=>parseSummary(Buffer.from(J({...summary,resultSha256:null})),0));
  assert.throws(()=>parseSummary(Buffer.from(J({...summary,extra:true})),0));
  assert.throws(()=>parseSummary(Buffer.from(J(summary)+'\n'),0));
});
