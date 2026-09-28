import test from 'node:test';
import assert from 'node:assert/strict';
import { constructReadinessResult, projectReadinessResult } from '../../memoryos-readiness/src/readiness-result.mjs';
import { aggregateReference, validateRecord } from '../../memoryos-readiness/src/foundation.mjs';
import { canonicalBytes, canonicalDigest } from '../../memoryos-readiness/src/canonical.mjs';
import { DEFINITIONS } from '../../memoryos-readiness/src/constants.mjs';
import { loadProjection, clone } from '../tools/mo1307-phase2a/fixture-projection.mjs';

const L=DEFINITIONS.limits;
const digest=n=>'sha256:'+n.toString(16).padStart(64,'0');
const compare=(a,b)=>a<b?-1:a>b?1:0;
const aggregate=assessment=>aggregateReference(assessment);
const operational=(code,stage='EVALUATION')=>error=>error.code==='MO1307_'+code&&error.stage===stage;

// These private-seam vectors test representation ceilings only. Their synthetic
// audit references and graph are not an assertion of accepted source authority,
// dependency closure or a graph derived by Phase 2B. Individual embedded records
// satisfy the unchanged Phase 1 schemas and bounded shared encoders.
function resultBoundary() {
  const {verified,expected}=loadProjection('ready');
  const claims=Array.from({length:64},(_,i)=>({id:'CLAIM:'+digest(i+1),type:'CLAIM',digest:digest(i+1)}));
  const dependencies=Array.from({length:128},(_,i)=>({id:'DEPENDENCY:'+digest(i+65),type:'DEPENDENCY',digest:digest(i+65)}));
  verified.graph={kind:'MemoryOSReadinessGraph',version:'1.0.0',nodes:[...claims,...dependencies].sort((a,b)=>compare(a.id,b.id)),
    edges:claims.flatMap(c=>dependencies.map(d=>({from:c.id,type:'DEPENDS_ON',to:d.id})))};
  verified.graphDigest=canonicalDigest(verified.graph);
  verified.audit.inputs=Array.from({length:128},(_,i)=>({id:'audit'+String(i).padStart(3,'0'),type:i<64?'ENVELOPE':'SOURCE',
    sourceKind:i<64?'memoryos-readiness-evidence':'x',sourceVersion:i<64?'1.0.0':'x',path:'audit/'+String(i).padStart(3,'0')+'.json',
    byteLength:1,sha256:digest(i+1000),candidateBinding:i<64?verified.candidateDigest:null,dependencyIds:[],
    authorityClass:i<64?'GRANTED_CLAIM':'UNTRUSTED_SOURCE',git:null}));
  const a=aggregate(expected.assessment);
  const draft={...expected,assessment:{...expected.assessment,graph:verified.graph,graphDigest:verified.graphDigest},audit:verified.audit};
  let remaining=L.resultBytes-canonicalBytes(draft).length;
  for(const entry of verified.audit.inputs.slice(0,64)){
    for(let i=0;i<L.dependenciesPerClaim&&remaining>=67;i++){
      entry.dependencyIds.push('d'+String(i).padStart(4,'0')+'x'.repeat(59));
      remaining-=entry.dependencyIds.length===1?66:67;
    }
  }
  assert.ok(remaining>=0&&remaining<67);
  verified.audit.inputs[64].sourceKind+='x'.repeat(remaining);
  assert.equal(canonicalBytes(draft).length,L.resultBytes);
  validateRecord('Audit',verified.audit);validateRecord('Graph',verified.graph);
  assert.ok(canonicalBytes(verified.audit).length<L.resultBytes);
  assert.ok(canonicalBytes(verified.graph).length<L.resultBytes);
  return {verified,a};
}

test('result boundary: exactly 4 MiB is retained and +1 is OUTPUT/EVALUATION',()=>{
  const {verified,a}=resultBoundary();
  const exact=constructReadinessResult(verified,a);
  assert.equal(exact.resultBytes.length,L.resultBytes);
  assert.equal(exact.result.assessment.readiness,'READY');
  verified.audit.inputs[64].sourceKind+='x';
  assert.throws(()=>constructReadinessResult(verified,a),operational('OUTPUT'));
});

test('text boundary: exactly 128 KiB is complete and +1 is OUTPUT/EVALUATION',()=>{
  const {verified,expected}=loadProjection('ready');
  const rows=Array.from({length:1400},(_,i)=>({gateId:'scope',reason:'UNEVALUABLE',checkCode:'C'+String(i).padStart(4,'0')}));
  function computed(){
    const a=clone(expected.assessment),gate=a.gates.find(g=>g.id==='scope');
    gate.state='COULD_NOT_EVALUATE';gate.cneReasons=clone(rows);a.cneReasons=clone(rows);
    return aggregate(a);
  }
  const initial=constructReadinessResult(verified,computed());
  let remaining=L.textStdoutBytes-projectReadinessResult(initial.result,'text').length;
  assert.ok(remaining>0&&remaining<rows.length*59);
  for(const row of rows){const add=Math.min(59,remaining);row.checkCode+='X'.repeat(add);remaining-=add;}
  assert.equal(remaining,0);
  const exact=constructReadinessResult(verified,computed());
  assert.equal(projectReadinessResult(exact.result,'text').length,L.textStdoutBytes);
  assert.equal(exact.result.assessment.cneReasons.length,rows.length);
  const grow=rows.find(row=>row.checkCode.length<64);assert.ok(grow);grow.checkCode+='X';
  const jsonOnly=constructReadinessResult(verified,computed());
  assert.ok(jsonOnly.resultBytes.length<L.resultBytes);
  assert.ok(projectReadinessResult(jsonOnly.result).length<L.jsonSummaryBytes);
  assert.throws(()=>projectReadinessResult(jsonOnly.result,'text'),operational('OUTPUT'));
});

test('result/proof/input snapshots do not share mutable output objects',()=>{
  const {verified,expected}=loadProjection('ready');
  const a=aggregate(expected.assessment),original=clone(verified),computed=constructReadinessResult(verified,a);
  assert.deepEqual(computed.resultBytes,canonicalBytes(computed.result));
  assert.notEqual(computed.result.assessment.candidate,verified.candidate);
  assert.notEqual(computed.result.assessment.gates,a.gates);
  assert.notEqual(computed.proofInput.audit,computed.result.audit);
  const originalBytes=Buffer.from(computed.resultBytes),manifest=computed.result.audit.manifestSha256;
  computed.proofInput.audit.manifestSha256=digest(991);
  computed.result.assessment.candidate.product.version='9.9.9';
  assert.equal(computed.result.audit.manifestSha256,manifest);
  assert.deepEqual(verified,original);assert.deepEqual(computed.resultBytes,originalBytes);
});

test('global derived counts reject 128+1 before malformed rows or byte sizing',()=>{
  const {verified,expected}=loadProjection('ready');
  for(const key of ['blockers','qualifications','history']){
    const a=aggregate(expected.assessment);a[key]=Array.from({length:129},()=>null);
    assert.throws(()=>constructReadinessResult(verified,a),operational('RESOURCE_LIMIT'));
  }
  const a=aggregate(expected.assessment);a.providers=Array.from({length:6},()=>null);
  assert.throws(()=>constructReadinessResult(verified,a),operational('RESOURCE_LIMIT'));
});

test('result construction cannot promote a blocked aggregate to READY',()=>{
  const {verified,expected}=loadProjection('not-ready');
  const a=aggregate(expected.assessment);a.readiness='READY';
  assert.throws(()=>constructReadinessResult(verified,a),operational('INTEGRITY'));
});
