// Pure Phase 2B verification. No filesystem, process, environment, network or clock.
// Only the independently supplied root pin authorizes reviewed normalization.
import { DEFINITIONS } from './constants.mjs';
import { canonicalBytes, canonicalDigest, candidateDigest, claimDigest, digest, parseCanonical } from './canonical.mjs';
import { inspectFoundationInputs, selectPhaseError, validateEnvelope, validateRecord, validateResultIdentity, assertPlainFields, sortedUnique } from './foundation.mjs';
import { structurallyEqual as equal } from './schema.mjs';
import { fail } from './errors.mjs';
import { deriveEvidenceGraph, normalizeEvidenceGrant } from './evidence-graph.mjs';
import { verifyHistoryQualificationsProviders } from './evidence-history.mjs';

const L=DEFINITIONS.limits;
const lexical=(a,b)=>a<b?-1:a>b?1:0;
const sorted=(rows,key)=>rows.sort((a,b)=>lexical(key(a),key(b)));
const active=(definition,profile)=>definition.applicability==='ALWAYS' || definition.applicability===(profile==='rest'?'REST_ONLY':'CICD_ONLY');
const dependencyRecord=d=>({id:d.componentId,role:d.role,byteLength:d.byteLength,sha256:d.sha256});
function immutable(value) {
  if(value && typeof value==='object'){for(const child of Object.values(value))immutable(child);Object.freeze(value);}
  return value;
}
function verifyAuthority({candidate,manifest,authority},envelopes,root) {
  const a=authority.assessment,entries=new Map(manifest.entries.map(e=>[e.id,e]));
  const grants=new Map(a.grants.map(g=>[g.id,g])),components=new Map(candidate.components.map(c=>[c.id,c]));
  const provenance=new Map(authority.provenance.map(p=>[p.id,p]));
  const slots=new Map(a.slots.map(s=>[s.gateId,s])),checks=[];
  const check=(fn)=>checks.push(fn);
  const requireEntry=(id,type,ref)=>{const e=entries.get(id);if(!e)fail('INPUT','AUTHORITY',id);if(e.type!==type)fail('EVIDENCE_AUTHORITY','AUTHORITY',ref);return e;};
  check(()=>{
    if(manifest.candidateDigest!==root || a.candidateDigest!==root || !equal(candidate.components,a.requiredComponents) || !equal(candidate.semanticContracts,a.semanticContracts))fail('CANDIDATE_MISMATCH','AUTHORITY','candidate');
    if(!equal(candidate.profile,a.profile))fail('PROFILE_MISMATCH','AUTHORITY','candidate');
  });
  check(()=>{if(!equal(a.slots.map(s=>s.gateId),DEFINITIONS.gateDefinitions.map(d=>d.id)))fail('PROFILE_MISMATCH','AUTHORITY','authority');});
  const usedEntries=new Set(authority.provenance.map(p=>p.id));
  for(const source of authority.provenance)check(()=>{
    const e=requireEntry(source.id,'AUTHORITY_SOURCE',source.id);
    const git={revision:source.revision,tree:source.tree,blob:source.blob,path:source.path};
    if(e.authorityClass!==source.classification || e.byteLength!==source.byteLength || e.sha256!==source.sha256 || !equal(e.git,git))fail('EVIDENCE_AUTHORITY','AUTHORITY',source.id);
    if(source.classification==='RELEASED_BINDING' && source.releaseTag.target!==source.revision)fail('EVIDENCE_AUTHORITY','AUTHORITY',source.id);
  });
  check(()=>{
    const identities=new Map();
    for(const source of authority.provenance){
      const key=source.revision+'\0'+source.path.toLowerCase();
      const {id,...identity}=source;
      if(identities.has(key) && !equal(identities.get(key),identity))fail('INPUT','AUTHORITY',id);
      identities.set(key,identity);
    }
  });
  const consumed=new Map(a.grants.map(g=>[g.id,[]]));
  for(const definition of DEFINITIONS.gateDefinitions)check(()=>{
    const slot=slots.get(definition.id);if(!slot)fail('INPUT','AUTHORITY',definition.id);
    if(!active(definition,candidate.profile.id)){
      if(slot.availability!=='AVAILABLE'||slot.reason!==null||slot.grantIds.length)fail('EVIDENCE_AUTHORITY','AUTHORITY',definition.id);
      return;
    }
    if(slot.availability==='AVAILABLE' && slot.grantIds.length!==1)fail('EVIDENCE_AUTHORITY','AUTHORITY',definition.id);
    if(!definition.mandatory){
      const parent=slots.get('provider.'+definition.provider);
      if(!parent||!equal({availability:slot.availability,reason:slot.reason,grantIds:slot.grantIds},{availability:parent.availability,reason:parent.reason,grantIds:parent.grantIds}))fail('EVIDENCE_AUTHORITY','AUTHORITY',definition.id);
    }
    for(const id of slot.grantIds){
      const grant=grants.get(id);if(!grant)fail('INPUT','AUTHORITY',id);
      consumed.get(id).push(definition.id);
      const envelope=envelopes.get(grant.envelopeId);if(!envelope)fail('INPUT','AUTHORITY',grant.envelopeId);
      if(envelope.claim.type!==definition.evidenceType || (definition.provider!==null && envelope.claim.detail.provider!==definition.provider))fail('EVIDENCE_AUTHORITY','AUTHORITY',definition.id);
    }
  });
  // Grant references and exact raw/normalized identities are independent checks:
  // a self-consistent envelope digest cannot replace a reviewed claim or source.
  for(const grant of a.grants){
    usedEntries.add(grant.envelopeId);
    for(const id of [...grant.sourceIds,...grant.authoritySourceIds])usedEntries.add(id);
    check(()=>{
      const entry=requireEntry(grant.envelopeId,'ENVELOPE',grant.id),envelope=envelopes.get(grant.envelopeId);
      if(!envelope)fail('INPUT','AUTHORITY',grant.envelopeId);
      if(grant.envelopeSha256!==entry.sha256 || grant.claimDigest!==claimDigest(envelope.claim) || !equal(envelope.sources,grant.sourceIds))fail('EVIDENCE_AUTHORITY','AUTHORITY',grant.id);
      const c=envelope.claim,ids=c.dependencies.map(d=>d.componentId);
      if(entry.candidateBinding!==c.originCandidate || !equal(entry.dependencyIds,ids))fail('INTEGRITY','AUTHORITY',entry.id);
      if(!equal(grant.dependencyIds,ids))fail('EVIDENCE_AUTHORITY','AUTHORITY',grant.id);
    });
    for(const id of grant.sourceIds)check(()=>{requireEntry(id,'SOURCE',grant.id);});
    for(const id of grant.authoritySourceIds)check(()=>{
      requireEntry(id,'AUTHORITY_SOURCE',grant.id);
      if(!provenance.has(id))fail('INPUT','AUTHORITY',id);
    });
    check(()=>{
      const envelope=envelopes.get(grant.envelopeId);if(!envelope)return;
      const c=envelope.claim,whole=['FINAL_BINDING','TAG_OBSERVATION'].includes(c.type);
      if(c.binding!==(whole?'WHOLE_CANDIDATE':'DEPENDENCY_SET') || (whole?c.dependencies.length!==0:c.dependencies.length===0))fail('INTEGRITY','AUTHORITY',grant.envelopeId);
      if(whole && (c.originCandidate!==root || grant.applicability!=='CURRENT'))fail('CANDIDATE_MISMATCH','AUTHORITY',grant.envelopeId);
      if(grant.applicability==='CURRENT' && c.originCandidate!==root)fail('CANDIDATE_MISMATCH','AUTHORITY',grant.envelopeId);
      if(grant.applicability==='REUSED' && (c.binding!=='DEPENDENCY_SET'||c.originCandidate===root))fail('STALE_EVIDENCE','AUTHORITY',grant.envelopeId);
    });
    check(()=>{
      const c=envelopes.get(grant.envelopeId)?.claim;if(!c)return;
      if(c.scopeId!==grant.scopeId || grant.scopeId!==a.scopeId || !equal(c.assumptions,grant.assumptions) || grant.assumptions.some(pair=>!a.assumptions.some(rootPair=>equal(pair,rootPair))))fail('STALE_EVIDENCE','AUTHORITY',grant.envelopeId);
    });
    for(const dependency of envelopes.get(grant.envelopeId)?.claim.dependencies??[])check(()=>{
      const current=components.get(dependency.componentId);
      if(!current)fail('INPUT','AUTHORITY',dependency.componentId);
      if(!equal(current,dependencyRecord(dependency)))fail('STALE_EVIDENCE','AUTHORITY',grant.envelopeId);
    });
    check(()=>{
      const c=envelopes.get(grant.envelopeId)?.claim;if(!c)return;
      const definition=DEFINITIONS.gateDefinitions.find(d=>d.evidenceType===c.type);
      if(!definition)fail('EVIDENCE_AUTHORITY','AUTHORITY',grant.envelopeId);
      const provider=c.type==='PROVIDER_CERTIFICATION'?candidate.providers.find(p=>p.id===c.detail.provider):null;
      if(c.type==='PROVIDER_CERTIFICATION' && !provider)fail('EVIDENCE_AUTHORITY','AUTHORITY',grant.envelopeId);
      const required=candidate.components.filter(component=>definition.minimumRoles.includes(component.role) && (component.role!=='ADAPTER'||component.id===provider?.componentId));
      if(required.some(component=>!grant.dependencyIds.includes(component.id)))fail('EVIDENCE_AUTHORITY','AUTHORITY',grant.id);
    });
  }
  check(()=>{
    for(const [id,gates] of consumed){
      if(!gates.length)fail('EVIDENCE_AUTHORITY','AUTHORITY',id);
      if(gates.length>1){const allowed=DEFINITIONS.gateDefinitions.filter(d=>d.evidenceType==='PROVIDER_CERTIFICATION' && d.provider!==null && d.provider===DEFINITIONS.gateDefinitions.find(g=>g.id===gates[0])?.provider).map(d=>d.id);if(!equal(gates,allowed))fail('EVIDENCE_AUTHORITY','AUTHORITY',id);}
    }
  });
  for(const entry of manifest.entries)check(()=>{
    if(!usedEntries.has(entry.id))fail('EVIDENCE_AUTHORITY','AUTHORITY',entry.id);
    if(entry.type==='AUTHORITY_SOURCE' && !provenance.has(entry.id))fail('INPUT','AUTHORITY',entry.id);
  });
  check(()=>{
    const normalized=new Set(),claims=new Set(),envelopeIds=new Set();
    for(const grant of a.grants){
      // Missing authority references are diagnosed separately, before normalization.
      if(grant.authoritySourceIds.some(id=>!provenance.has(id)))continue;
      const id=canonicalDigest(normalizeEvidenceGrant(grant,authority.provenance));
      if(normalized.has(id)||claims.has(grant.claimDigest)||envelopeIds.has(grant.envelopeId))fail('INPUT','AUTHORITY',grant.id);
      normalized.add(id);claims.add(grant.claimDigest);envelopeIds.add(grant.envelopeId);
    }
  });
  selectPhaseError(checks,'AUTHORITY');
}
function verifyClaimFacts(candidate,selections) {
  const checks=[];
  for(const {claim:c,grant} of selections)checks.push(()=>{
    const ref=grant.envelopeId;
    if(c.type==='SEMANTIC_CONFORMANCE' && !equal(c.detail.contractIds,candidate.semanticContracts.map(s=>s.id)))fail('INTEGRITY','EVALUATION',ref);
    if(c.type==='EXECUTION_CERTIFICATION'){
      const runtime=candidate.components.find(x=>x.id===c.detail.runtimeComponent);
      if(!runtime || runtime.role!=='RUNTIME' || !c.dependencies.some(x=>x.componentId===runtime.id))fail('INTEGRITY','EVALUATION',ref);
    }
    if(c.type==='FINAL_BINDING' && c.detail.target!==candidate.expectedTag.target)fail('INTEGRITY','EVALUATION',ref);
    if(c.type==='REST_CONTRACT' && c.detail.remoteScope!==candidate.remoteScope)fail('INTEGRITY','EVALUATION',ref);
  });
  selectPhaseError(checks,'EVALUATION');
}

// Failure-only phase diagnosis. Every input rejected by the strict foundation
// remains rejected: this function has no return path and cannot produce facts.
// Authority-consumed fields retain their full closed validation before diagnosis;
// invalid semantic records remain rejected even when an earlier fault is found.
function diagnoseRejectedEvidence(input,originalError) {
  if(originalError.stage!=='EVALUATION')throw originalError;
  let parsed,envelopes,fullShapes=true;
  try {
    parsed=Object.fromEntries(['configuration','candidate','manifest','authority'].map(name=>[name,parseCanonical(input[name+'Bytes'],{maxBytes:L[name+'Bytes'],stage:'CONFIGURATION'})]));
    for(const [name,record] of Object.entries(parsed))validateRecord(name[0].toUpperCase()+name.slice(1),record,{stage:'CONFIGURATION'});
    envelopes=new Map();
    const files=new Map(input.files.map(file=>[file.id,file.bytes]));
    for(const entry of parsed.manifest.entries){
      const bytes=files.get(entry.id);
      if(!bytes || bytes.length!==entry.byteLength || digest(bytes)!==entry.sha256)throw originalError;
      if(entry.type==='ENVELOPE'){
        const envelope=parseCanonical(bytes,{maxBytes:L.envelopeBytes,reference:entry.id});
        assertPlainFields(envelope,['claim','kind','metadata','sources','version'],'INTEGRITY',entry.id);
        const c=envelope.claim;
        assertPlainFields(c,['assumptions','binding','dependencies','detail','failed','originCandidate','passed','qualifications','scopeId','type','unevaluable','verdict','version'],'INTEGRITY',entry.id);
        validateRecord('Digest',c.originCandidate);validateRecord('Id',c.scopeId);
        if(!Object.hasOwn(DEFINITIONS.coverage,c.type)||c.version!=='1.0.0'||!['WHOLE_CANDIDATE','DEPENDENCY_SET'].includes(c.binding))throw originalError;
        if(!Array.isArray(c.dependencies)||c.dependencies.length>L.dependenciesPerClaim||!Array.isArray(c.assumptions)||c.assumptions.length>L.assumptions||!Array.isArray(envelope.sources))throw originalError;
        for(const d of c.dependencies)validateRecord('Dependency',d);
        for(const a of c.assumptions)validateRecord('Assumption',a);
        for(const id of envelope.sources)validateRecord('Id',id);
        sortedUnique(c.dependencies,d=>d.componentId);sortedUnique(c.assumptions,a=>a.id);sortedUnique(envelope.sources);
        if(c.type==='PROVIDER_CERTIFICATION')validateRecord('Provider',c.detail?.provider);
        try { validateRecord('Evidence',envelope,{reference:entry.id}); } catch { fullShapes=false; }
        envelopes.set(entry.id,envelope);
      }
    }
  } catch { throw originalError; }
  // These checks can only replace one rejection with the frozen earlier error.
  verifyAuthority(parsed,envelopes,candidateDigest(parsed.candidate));
  if(fullShapes)deriveEvidenceGraph({candidate:parsed.candidate,authority:parsed.authority,claims:[...envelopes].map(([envelopeId,e])=>({envelopeId,claim:e.claim}))});
  throw originalError;
}
// Private seam for 2A/2C/2D. This proves evidence authority, never readiness.
// Every call takes original independently pinned byte snapshots, without a cache.
export function verifyEvidence(input) {
  let foundation;
  try { foundation=inspectFoundationInputs(input); }
  catch(error) { diagnoseRejectedEvidence(input,error); }
  const {copies,parsed}=foundation;
  const {candidate,manifest,authority,configuration}=parsed,root=candidateDigest(candidate);
  const files=new Map(copies.files.map(f=>[f.id,f.bytes]));
  const envelopes=new Map(manifest.entries.filter(e=>e.type==='ENVELOPE').map(e=>[e.id,parseCanonical(files.get(e.id),{maxBytes:L.envelopeBytes,reference:e.id})]));
  verifyAuthority(parsed,envelopes,root);
  const derived=deriveEvidenceGraph({candidate,authority,claims:[...envelopes].map(([envelopeId,e])=>({envelopeId,claim:e.claim}))});
  const bindingById=new Map(derived.bindings.map(b=>[b.grantId,b]));
  const selections=authority.assessment.grants.map(grant=>({grant,grantDigest:bindingById.get(grant.id).grantDigest,claim:envelopes.get(grant.envelopeId).claim,claimDigest:grant.claimDigest}));
  let semantics;
  selectPhaseError([
    ...[...envelopes].map(([id,envelope])=>()=>validateEnvelope(envelope,id)),
    ()=>verifyClaimFacts(candidate,selections),
    ()=>{semantics=verifyHistoryQualificationsProviders({candidate,candidateDigest:root,authority,selections});},
  ],'EVALUATION');
  const slotRows=authority.assessment.slots.map(slot=>{
    const binding=slot.grantIds.length?bindingById.get(slot.grantIds[0]):null;
    return {gateId:slot.gateId,availability:slot.availability,reason:slot.reason,claimDigest:binding?.claimDigest??null,grantDigest:binding?.grantDigest??null};
  });
  const claims=sorted(selections.map(s=>({claimDigest:s.claimDigest,grantDigest:s.grantDigest,claim:s.claim})),s=>s.claimDigest);
  const reuse=sorted(selections.map(s=>({claimDigest:s.claimDigest,grantDigest:s.grantDigest,originCandidate:s.claim.originCandidate,candidateDigest:root,binding:s.claim.binding,dependencyIds:s.grant.dependencyIds,disposition:s.grant.applicability})),s=>s.claimDigest);
  const audit={trustedAuthorityDigest:input.trustedAuthorityDigest,manifestSha256:digest(copies.manifestBytes),candidateFileSha256:digest(copies.candidateBytes),configurationSha256:digest(copies.configurationBytes),inputs:manifest.entries,authoritySources:authority.provenance,bindings:derived.bindings};
  validateRecord('Audit',audit,{stage:'EVALUATION'});
  const projection={candidate,candidateDigest:root,profile:configuration.profile,stage:configuration.stage,authorityIdentityDigest:derived.authorityIdentityDigest,normalizedAuthority:derived.normalizedAuthority,claims,slots:slotRows,...semantics,graph:derived.graph,graphDigest:derived.graphDigest,reuse};
  // Opaque metadata is audit-bound by envelope hashes, but never enters the
  // normalized decision projection or an age-based staleness predicate.
  const diagnostics=sorted([...envelopes].map(([envelopeId,e])=>({envelopeId,metadata:e.metadata})),d=>d.envelopeId);
  return immutable(structuredClone({projection,audit,diagnostics}));
}

// Result-verification SUPPORT ONLY. 2A must recompute gates/readiness and 2C
// must compare the complete canonical result before public verify succeeds.
// This independently checks every 2B-owned field against original trusted bytes;
// self-consistent result hashes, cached projections or caller graphs do not suffice.
export function verifyResultEvidence(input,resultBytes) {
  const verified=verifyEvidence(input),p=verified.projection;
  let result;
  try{result=parseCanonical(resultBytes,{maxBytes:L.resultBytes,stage:'VERIFICATION',reference:'result'});validateResultIdentity(result);}
  catch(error){if(['MO1307_RESOURCE_LIMIT','MO1307_GRAPH_LIMIT'].includes(error.code))throw error;fail('RESULT_MISMATCH','VERIFICATION','result');}
  const a=result.assessment;
  for(const field of ['candidate','candidateDigest','profile','stage','authorityIdentityDigest','qualifications','history','providers','graph','graphDigest'])if(!equal(a[field],p[field]))fail('RESULT_MISMATCH','VERIFICATION','result');
  if(!equal(result.audit,verified.audit)||!equal(a.gates.map(g=>g.id),p.slots.map(s=>s.gateId)))fail('RESULT_MISMATCH','VERIFICATION','result');
  for(let i=0;i<a.gates.length;i++)if(a.gates[i].claimDigest!==p.slots[i].claimDigest || a.gates[i].grantDigest!==p.slots[i].grantDigest)fail('RESULT_MISMATCH','VERIFICATION','result');
  return verified;
}
