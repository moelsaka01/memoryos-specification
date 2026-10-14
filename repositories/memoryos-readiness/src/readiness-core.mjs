import { DEFINITIONS } from './constants.mjs';
import { canonicalBytes, canonicalDigest, blockerId, snapshotBytes } from './canonical.mjs';
import { validateRecord, validateCandidate, validateProviderDetail, aggregateReference,
  assertPlainFields, selectPhaseError } from './foundation.mjs';
import { structurallyEqual } from './schema.mjs';
import { fail } from './errors.mjs';
import { constructReadinessResult } from './readiness-result.mjs';

// Private Phase 2B -> 2A seam. This function does NOT authenticate evidence.
// The caller must have completed authority, dependency/reuse, history-lineage
// and graph verification. Raw envelopes, files, pins and user-authored gate
// states are deliberately not accepted. The public worker supplies the verified
// projection through the fixed integration adapter.
const L = DEFINITIONS.limits;
const GATES = DEFINITIONS.gateDefinitions;
const OPTIONS = {stage:'EVALUATION'};
const compare = (a,b) => a < b ? -1 : a > b ? 1 : 0;
const sortBy = key => (a,b) => compare(key(a),key(b));
const unique = values => [...new Set(values)].sort();
const record = (name,value,reference=null,code='INPUT') => validateRecord(name,value,{...OPTIONS,reference,code});
const reject = (code,reference=null) => fail(code,'EVALUATION',reference);
const cneKey = row => [row.gateId,row.reason,row.checkCode ?? ''].join('\0');

// Only the two private transport collections have nonsemantic order. All
// embedded Phase 1 records keep their frozen sorted-set order and are rejected
// if reordered. Inspect own data descriptors before touching caller values.
function collection(value,limit,reference=null) {
  if(!Array.isArray(value))reject('INPUT',reference);
  if(value.length>limit)reject('RESOURCE_LIMIT',reference);
  if(Object.getOwnPropertySymbols(value).length || Object.getOwnPropertyNames(value).length!==value.length+1)reject('INPUT',reference);
  for(let i=0;i<value.length;i++) {
    const d=Object.getOwnPropertyDescriptor(value,String(i));
    if(!d || !Object.hasOwn(d,'value') || !d.enumerable)reject('INPUT',reference);
  }
}
function applicable(definition,profile,stage) {
  switch(definition.applicability) {
    case 'ALWAYS': return true;
    case 'REST_ONLY': return profile.id==='rest';
    case 'CICD_ONLY': return profile.id==='cicd';
    case 'PRE_TAG': return stage==='PRE_TAG_READINESS';
    case 'POST_TAG': return stage==='POST_TAG_VERIFICATION';
    default: reject('PROFILE_MISMATCH',definition.id);
  }
}
function validateClaim(selection,candidate,reference) {
  assertPlainFields(selection,['claim','claimDigest','grantDigest'],'EVALUATION');
  record('Digest',selection.claimDigest); record('Digest',selection.grantDigest);
  const c=selection.claim;
  // Shared canonical encoding rejects accessors, prototypes, cycles, controls,
  // excessive depth/values and unsafe primitive values before field access.
  canonicalBytes(c,{...OPTIONS,maxBytes:L.envelopeBytes});
  if(!c || typeof c!=='object' || Array.isArray(c))reject('INPUT');
  if(c.version!=='1.0.0')reject('EVIDENCE_VERSION');
  if(!Object.hasOwn(DEFINITIONS.coverage,c.type))reject('INPUT');
  // Coverage/known semantic contradictions precede the schema's cross-field
  // clauses so they retain INTEGRITY rather than becoming generic INPUT.
  // Inspect all independent safe checks before choosing the phase error.
  selectPhaseError([
    ()=>{
      if(['passed','failed','unevaluable'].every(k=>Array.isArray(c[k]) && c[k].every(x=>typeof x==='string'))) {
        const coverage=[...c.passed,...c.failed,...c.unevaluable].sort();
        if(!structurallyEqual(coverage,DEFINITIONS.coverage[c.type]) ||
           c.verdict!==(c.failed.length?'FAIL':c.unevaluable.length?'UNEVALUABLE':'PASS'))reject('INTEGRITY',reference);
      }
    },
    ()=>{
      if(Array.isArray(c.qualifications)) {
        collection(c.qualifications,L.qualifications,reference);
        selectPhaseError(c.qualifications.map(q=>()=>record('Qualification',q,reference,'QUALIFICATION_MISMATCH')),'EVALUATION');
      }
    },
    ()=>{
      if(c.type==='HISTORICAL_DISPOSITION' && Array.isArray(c.detail?.records)) {
        collection(c.detail.records,L.historyRecords,'history');
        selectPhaseError(c.detail.records.map(h=>()=>record('History',h,'history','HISTORY_MISMATCH')),'EVALUATION');
      }
    },
    ()=>{if(c.type==='PROVIDER_CERTIFICATION')validateProviderDetail(c.detail,reference);},
    ()=>validateDetail(c,candidate,reference),
    ()=>{if(canonicalDigest(c)!==selection.claimDigest)reject('INTEGRITY',reference);},
  ],'EVALUATION');
  record('Claim',c,reference);
}
function inspectVerifiedProjection(input) {
  assertPlainFields(input,['candidate','candidateDigest','profile','stage','scopeId',
    'authorityIdentityDigest','slots','claims','graph','graphDigest','audit'],'EVALUATION');
  // Profile errors have their own frozen code, including unknown profiles.
  canonicalBytes(input.profile,OPTIONS);
  if(!DEFINITIONS.profiles.some(p=>p.id===input.profile?.id && p.version===input.profile?.version))reject('PROFILE_MISMATCH');
  record('Profile',input.profile);record('Stage',input.stage);record('Id',input.scopeId);
  record('Digest',input.candidateDigest);record('Digest',input.authorityIdentityDigest);record('Digest',input.graphDigest);
  canonicalBytes(input.candidate,{...OPTIONS,maxBytes:L.candidateBytes});
  validateCandidate(input.candidate,input.candidateDigest);
  if(!structurallyEqual(input.profile,input.candidate.profile))reject('PROFILE_MISMATCH','candidate');
  collection(input.slots,L.gates);collection(input.claims,L.claims);
  if(input.slots.length!==GATES.length)reject('PROFILE_MISMATCH');
  selectPhaseError(input.slots.map(s=>()=>record('NormalizedSlot',s)),'EVALUATION');
  selectPhaseError(input.claims.map(s=>()=>{
    assertPlainFields(s,['claim','claimDigest','grantDigest'],'EVALUATION');
    const reference=input.slots.filter(slot=>slot.grantDigests.includes(s.grantDigest)).map(slot=>slot.gateId).sort()[0]??null;
    validateClaim(s,input.candidate,reference);
  }),'EVALUATION');
  // The graph and audit are opaque verified bindings from 2B. Shape/hash and
  // selected-claim correspondence here do not establish raw/source authority,
  // derive edges, or reauthenticate historical dispositions.
  record('Graph',input.graph);record('Audit',input.audit);
  if(canonicalDigest(input.graph)!==input.graphDigest)reject('INTEGRITY');
  if(input.audit.candidateFileSha256!==input.candidateDigest)reject('CANDIDATE_MISMATCH','candidate');
  const slots=new Map(input.slots.map(s=>[s.gateId,s]));
  const selections=new Map(input.claims.map(c=>[c.grantDigest,c]));
  if(slots.size!==GATES.length || GATES.some(g=>!slots.has(g.id)))reject('PROFILE_MISMATCH');
  if(selections.size!==input.claims.length || new Set(input.claims.map(c=>c.claimDigest)).size!==input.claims.length)reject('INPUT');
  const selected=new Set();
  for(const d of GATES) {
    const s=slots.get(d.id),active=applicable(d,input.profile,input.stage);
    if(!active) {
      if(s.availability!=='AVAILABLE' || s.grantDigests.length || s.reason!==null)reject('INTEGRITY',d.id);
      continue;
    }
    if(!d.mandatory) {
      const parent=slots.get('provider.'+d.provider);
      if(!structurallyEqual({...s,gateId:parent.gateId},parent))reject('INTEGRITY',d.id);
    }
    if(s.availability==='UNAVAILABLE')continue;
    if(s.grantDigests.length!==1)reject('INPUT',d.id);
    const row=selections.get(s.grantDigests[0]);
    if(!row)reject('INPUT',d.id);
    selected.add(row.grantDigest);
    if(row.claim.type!==d.evidenceType || (d.provider!==null && row.claim.detail.provider!==d.provider))reject('INTEGRITY',d.id);
    if(row.claim.scopeId!==input.scopeId)reject('INTEGRITY',d.id);
    if(['FINAL_BINDING','TAG_OBSERVATION'].includes(row.claim.type) && row.claim.originCandidate!==input.candidateDigest)reject('CANDIDATE_MISMATCH',d.id);
  }
  if(selected.size!==selections.size)reject('INPUT');
  if(input.audit.bindings.length!==selections.size)reject('INTEGRITY');
  const bound=new Set();
  for(const b of input.audit.bindings) {
    const row=selections.get(b.grantDigest);
    if(!row || row.claimDigest!==b.claimDigest || bound.has(b.grantDigest))reject('INTEGRITY',b.grantId);
    bound.add(b.grantDigest);
  }
  // Each admitted embedded record is bounded before cloning. Avoid applying a
  // new whole-projection byte limit to this private in-memory transport.
  const detached=structuredClone(input);
  detached.slots.sort(sortBy(x=>x.gateId));
  detached.claims.sort(sortBy(x=>x.grantDigest));
  return detached;
}

function qualificationsAndHistory(v,selectionByGate) {
  const all=new Map(),checks=[];
  for(const row of v.claims)for(const q of row.claim.qualifications) {
    if(q.scopeId!==v.scopeId)checks.push(()=>reject('QUALIFICATION_MISMATCH',q.id));
    const old=all.get(q.id);
    if(old && !structurallyEqual(old.original,q))checks.push(()=>reject('QUALIFICATION_MISMATCH',q.id));
    if(!old)all.set(q.id,{original:q,claims:[],grants:[]});
    const item=all.get(q.id);item.claims.push(row.claimDigest);item.grants.push(row.grantDigest);
  }
  if(all.size>L.qualifications)reject('RESOURCE_LIMIT');
  const quals=[...all.values()].map(x=>({...x.original,candidateDigest:v.candidateDigest,
    evidenceClaimDigests:unique(x.claims),grantDigests:unique(x.grants)})).sort(sortBy(q=>q.id));
  const historySelection=selectionByGate.get('history');
  const rows=historySelection?.claim.detail.records;
  const scope=selectionByGate.get('scope')?.claim.detail;
  const history=(rows??[]).map(h=>({id:h.id,originalOutcome:h.originalOutcome,
    originalDisposition:h.originalDisposition,conditionId:h.conditionId,disposition:h.disposition,
    affectedGateIds:h.affectedGateIds,recurrence:h.recurrence,
    claimDigest:historySelection.claimDigest,grantDigest:historySelection.grantDigest}));
  if(scope)checks.push(()=>{
    if(!structurallyEqual(scope.qualificationIds,quals.map(q=>q.id)))reject('QUALIFICATION_MISMATCH','scope');
    if(rows && !structurallyEqual(scope.conditionIds,unique(rows.map(h=>h.conditionId))))reject('HISTORY_MISMATCH','scope');
  });
  for(const q of quals)checks.push(()=>{
    if(q.reasonCode==='HISTORICAL_UNRESOLVED_PRESERVED') {
      const condition=q.conditionIds[0];
      if(scope && !scope.conditionIds.includes(condition))reject('QUALIFICATION_MISMATCH',q.id);
      if(rows) {
        const matching=rows.filter(h=>h.conditionId===condition && h.disposition==='PRESERVED_WITH_QUALIFICATION');
        if(!matching.length || matching.some(h=>!structurallyEqual(h.affectedGateIds,q.gateIds)))reject('QUALIFICATION_MISMATCH',q.id);
      }
    }
    if(q.reasonCode==='SAME_HOST_REMOTE_ONLY' && v.profile.id!=='rest')reject('QUALIFICATION_MISMATCH',q.id);
    if(['HOSTED_NOT_CERTIFIED','PROVIDER_NOT_LIVE_CERTIFIED'].includes(q.reasonCode) && v.profile.id!=='cicd')reject('QUALIFICATION_MISMATCH',q.id);
  });
  if(rows)for(const h of rows)checks.push(()=>{
    if(h.disposition==='PRESERVED_WITH_QUALIFICATION') {
      const matches=quals.filter(q=>q.reasonCode==='HISTORICAL_UNRESOLVED_PRESERVED' && q.conditionIds[0]===h.conditionId && structurallyEqual(q.gateIds,h.affectedGateIds));
      if(matches.length!==1)reject('QUALIFICATION_MISMATCH',h.id);
    }
  });
  // Exact cardinality for required predicate disclosures. The authority may
  // repeat an identical record in multiple selected claims, never invent prose
  // or attach several differently named records for one required predicate.
  function requireQualification(code,provider,needed,reference) {
    const matches=quals.filter(q=>q.reasonCode===code && q.provider===provider);
    if(matches.length!==(needed?1:0))reject('QUALIFICATION_MISMATCH',reference);
  }
  const rest=selectionByGate.get('rest.contract');
  if(rest)checks.push(()=>requireQualification('SAME_HOST_REMOTE_ONLY',null,true,'rest.contract'));
  const supply=selectionByGate.get('supply');
  if(supply)checks.push(()=>requireQualification('BOUNDED_ADVISORY_REVIEW',null,supply.claim.detail.reviewScope==='BOUNDED_SNAPSHOT','supply'));
  for(const id of DEFINITIONS.enums.providers) {
    const row=selectionByGate.get('provider.'+id);
    if(!row)continue;
    const p=row.claim.detail;
    checks.push(()=>{
      const minimum=p.implementation==='IMPLEMENTED' && p.validation===(id==='generic'?'REAL_EXECUTION_CERTIFIED':id==='github'?'OFFLINE_VALIDATED':'CONTRACT_VALIDATED');
      const qualified=id==='github'?['HOSTED_EXECUTION_NOT_CERTIFIED','NOT_CERTIFIED'].includes(p.execution):p.execution==='NOT_LIVE_PROVIDER_CERTIFIED';
      if(id!=='generic') {
        requireQualification(id==='github'?'HOSTED_NOT_CERTIFIED':'PROVIDER_NOT_LIVE_CERTIFIED',id,minimum && qualified,'provider.'+id);
        if(minimum && qualified && p.support!==(id==='github'?'SUPPORTED_WITH_HOSTED_CERTIFICATION_LIMITATION':'SUPPORTED_WITH_CONTRACT_VALIDATION_ONLY'))reject('QUALIFICATION_MISMATCH','provider.'+id);
        const certified=p.execution===(id==='github'?'HOSTED_EXECUTION_CERTIFIED':'LIVE_PROVIDER_CERTIFIED');
        if(minimum && certified && p.support!=='SUPPORTED')reject('QUALIFICATION_MISMATCH','provider.'+id);
      }
    });
  }
  selectPhaseError(checks,'EVALUATION');
  return {qualifications:quals,history,historySelection};
}

function providerFailures(p) {
  const id=p.provider,checks=[];
  if(p.implementation!=='IMPLEMENTED')checks.push('IMPLEMENTATION');
  if(p.validation!==(id==='generic'?'REAL_EXECUTION_CERTIFIED':id==='github'?'OFFLINE_VALIDATED':'CONTRACT_VALIDATED'))checks.push('OFFLINE_CONTRACT');
  const execution=id==='generic'?['REAL_EXECUTION_CERTIFIED']:id==='github'?['HOSTED_EXECUTION_CERTIFIED','HOSTED_EXECUTION_NOT_CERTIFIED','NOT_CERTIFIED']:['LIVE_PROVIDER_CERTIFIED','NOT_LIVE_PROVIDER_CERTIFIED'];
  if(!execution.includes(p.execution))checks.push('EXECUTION_SCOPE');
  const support=id==='generic'?'SUPPORTED':id==='github'?(p.execution==='HOSTED_EXECUTION_CERTIFIED'?'SUPPORTED':'SUPPORTED_WITH_HOSTED_CERTIFICATION_LIMITATION'):(p.execution==='LIVE_PROVIDER_CERTIFIED'?'SUPPORTED':'SUPPORTED_WITH_CONTRACT_VALIDATION_ONLY');
  if(p.support!==support)checks.push('SUPPORT_DISPOSITION');
  return checks;
}
function validateDetail(c,candidate,reference) {
  // Cross-fields are inspectable independently of qualification validity. The
  // detailed claim schema remains responsible for malformed member types.
  if(c.type==='SEMANTIC_CONFORMANCE' && Array.isArray(c.detail?.contractIds) && !structurallyEqual(c.detail.contractIds,candidate.semanticContracts.map(x=>x.id)))reject('INTEGRITY',reference);
  if(c.type==='EXECUTION_CERTIFICATION' && typeof c.detail?.runtimeComponent==='string' && !candidate.components.some(x=>x.id===c.detail.runtimeComponent && x.role==='RUNTIME'))reject('INTEGRITY',reference);
  if(c.type==='FINAL_BINDING' && typeof c.detail?.target==='string' && c.detail.target!==candidate.expectedTag.target)reject('INTEGRITY',reference);
  if(c.type==='REST_CONTRACT' && typeof c.detail?.remoteScope==='string' && c.detail.remoteScope!==candidate.remoteScope)reject('INTEGRITY',reference);
}
export function computeReadiness(verified) {
  const v=inspectVerifiedProjection(verified);
  const byGrant=new Map(v.claims.map(x=>[x.grantDigest,x]));
  const bySlot=new Map(v.slots.map(x=>[x.gateId,x]));
  const selectionByGate=new Map(v.slots.filter(x=>x.grantDigests.length).map(x=>[x.gateId,byGrant.get(x.grantDigests[0])]));
  const {qualifications,history,historySelection}=qualificationsAndHistory(v,selectionByGate);

  const findings=new Map(),cne=new Map();
  const reasonRank={CHECK_FAILED:0,TAG_CONDITION_UNMET:1,PROVIDER_MINIMUM_UNMET:2,CONDITION_UNSATISFIED:3};
  function blocker(gateId,reasonCode,checkCode,row,conditionId=null) {
    const key=[gateId,checkCode,conditionId??''].join('\0');
    const old=findings.get(key);
    if(old && reasonRank[old.reasonCode]>=reasonRank[reasonCode])return;
    const value={gateId,reasonCode,checkCode,conditionId,claimDigest:row?.claimDigest??null,
      grantDigest:row?.grantDigest??null,candidateDigest:v.candidateDigest};
    findings.set(key,{id:blockerId(value),...value});
    if(findings.size>L.blockers)reject('RESOURCE_LIMIT',gateId);
  }
  function unavailable(gateId,reason,checkCode=null) {
    const row={gateId,reason,checkCode};cne.set(cneKey(row),row);
  }
  const gates=GATES.map(d=>{
    const active=applicable(d,v.profile,v.stage),row=selectionByGate.get(d.id);
    return {id:d.id,version:d.version,mandatory:d.mandatory,applicable:active,
      state:!active?'NOT_APPLICABLE':!d.mandatory?'NOT_REQUIRED':'SATISFIED',
      claimDigest:row?.claimDigest??null,grantDigest:row?.grantDigest??null,blockerIds:[],
      qualificationIds:active?qualifications.filter(q=>q.gateIds.includes(d.id)).map(q=>q.id):[],cneReasons:[]};
  });
  const gateMap=new Map(gates.map(g=>[g.id,g]));
  for(const d of GATES) {
    const g=gateMap.get(d.id);
    if(!g.applicable || !g.mandatory)continue;
    const s=bySlot.get(d.id),row=selectionByGate.get(d.id);
    if(s.availability==='UNAVAILABLE') { unavailable(d.id,s.reason);continue; }
    for(const code of row.claim.failed)blocker(d.id,'CHECK_FAILED',code,row);
    for(const code of row.claim.unevaluable)unavailable(d.id,'UNEVALUABLE',code);
    if(d.provider!==null)for(const code of providerFailures(row.claim.detail))blocker(d.id,'PROVIDER_MINIMUM_UNMET',code,row);
    if(d.id==='tag') {
      const t=row.claim.detail,expected=v.candidate.expectedTag;
      if(t.name!==expected.name)blocker(d.id,'TAG_CONDITION_UNMET','TAG_NAME',row);
      if(v.stage==='PRE_TAG_READINESS') {
        if(t.presence!=='ABSENT')blocker(d.id,'TAG_CONDITION_UNMET','TAG_PRESENCE',row);
      }else if(t.presence!=='PRESENT')blocker(d.id,'TAG_CONDITION_UNMET','TAG_PRESENCE',row);
      else {
        if(t.annotated!==true)blocker(d.id,'TAG_CONDITION_UNMET','TAG_ANNOTATION',row);
        if(t.peeledTarget!==expected.target)blocker(d.id,'TAG_CONDITION_UNMET','TAG_TARGET',row);
      }
    }
  }
  for(const h of history)if(h.disposition==='CURRENT_APPLICABLE' || h.recurrence==='OBSERVED') {
    for(const id of h.affectedGateIds) {
      const gate=gateMap.get(id);
      if(gate?.applicable && gate.mandatory)blocker(id,'CONDITION_UNSATISFIED','HISTORICAL_CONDITION',historySelection,h.conditionId);
    }
  }
  const blockers=[...findings.values()].sort(sortBy(b=>b.id));
  const cneReasons=[...cne.values()].sort(sortBy(cneKey));
  const qualified=new Set(qualifications.filter(q=>q.impact==='RELEASE_IMPACTING').map(q=>q.id));
  for(const g of gates) {
    if(!g.applicable || !g.mandatory)continue;
    g.blockerIds=blockers.filter(b=>b.gateId===g.id).map(b=>b.id);
    g.cneReasons=cneReasons.filter(c=>c.gateId===g.id);
    g.state=g.blockerIds.length?'BLOCKED':g.cneReasons.length?'COULD_NOT_EVALUATE':
      g.qualificationIds.some(id=>qualified.has(id))?'SATISFIED_WITH_QUALIFICATION':'SATISFIED';
  }
  const providers=GATES.filter(d=>d.provider!==null && d.mandatory && selectionByGate.has(d.id))
    .map(d=>selectionByGate.get(d.id).claim.detail).sort(sortBy(p=>p.provider));
  const aggregate=aggregateReference({gates,blockers,qualifications,cneReasons,history,providers});
  return constructReadinessResult(v,aggregate);
}

// Pure equality seam for 2D/2C after independently verified inputs are supplied.
// This is not the public verify API, nor an assertion that those inputs were
// independently authorized by this module. Self-consistent result hashes alone
// are never used to accept a proposed result.
export function compareReadinessResult(verified,suppliedResultBytes) {
  const bytes=snapshotBytes(suppliedResultBytes,L.resultBytes,'VERIFICATION','result');
  const computed=computeReadiness(verified);
  if(!Buffer.from(computed.resultBytes).equals(bytes))fail('RESULT_MISMATCH','VERIFICATION','result');
  return computed;
}
