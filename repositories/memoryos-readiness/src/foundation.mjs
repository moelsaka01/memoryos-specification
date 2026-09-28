import { DEFINITIONS } from './constants.mjs';
import { canonicalBytes, canonicalDigest, candidateDigest, claimDigest, digest, parseCanonical, snapshotBytes, readinessDigest, proofBindingDigest, blockerId } from './canonical.mjs';
import { fail, operationalError, errorExit, ReadinessError } from './errors.mjs';
import { validateSchema, structurallyEqual } from './schema.mjs';
import { validateRelativeFile } from './windows-paths.mjs';

const L=DEFINITIONS.limits;
export function sortedUnique(rows,key=x=>x,{code='INPUT',stage='INTEGRITY',reference=null}={}) {
  let previous=null;
  for(const row of rows){const next=key(row);if(typeof next!=='string' || (previous!==null && next<=previous))fail(code,stage,reference);previous=next;}
  return rows;
}
const sortKeys={components:'id',semanticContracts:'id',assumptions:'id',grants:'id',slots:'gateId',entries:'id',provenance:'id',dependencies:'componentId',qualifications:'id',records:'id',nodes:'id',gates:'id',blockers:'id',history:'id',inputs:'id',authoritySources:'id',bindings:'grantId',requiredComponents:'id'};
function checkOrder(v,key='',options={}) {
  if(Array.isArray(v)){
    if(key!=='requiredHumanActions' && v.every(x=>typeof x==='string'))sortedUnique(v,x=>x,options);
    if(Object.hasOwn(sortKeys,key))sortedUnique(v,x=>x[sortKeys[key]],options);
    if(key==='providers')sortedUnique(v,x=>x.id??x.provider,options);
    if(key==='edges')sortedUnique(v,x=>[x.from,x.type,x.to].join('\0'),options);
    if(key==='cneReasons')sortedUnique(v,x=>[x.gateId,x.reason,x.checkCode??''].join('\0'),options);
    for(const x of v)checkOrder(x,'',options);
  }else if(v && typeof v==='object')for(const [k,x] of Object.entries(v))checkOrder(x,k,options);
}
function fieldLimits(v,options) {
  if(!v || typeof v!=='object')return;
  if(v.metadata && typeof v.metadata==='object')for(const x of Object.values(v.metadata))if(typeof x==='string' && x.length>L.metadataCodeUnits)fail('RESOURCE_LIMIT',options.stage,options.reference);
  if(v.kind==='MemoryOSReadinessHumanDecision'){
    if((typeof v.reason==='string' && v.reason.length>L.decisionReasonCodeUnits) || (typeof v.actor==='string' && v.actor.length>L.decisionActorCodeUnits))fail('DECISION_MISMATCH',options.stage,options.reference);
    if(typeof v.timestamp==='string'){const d=new Date(v.timestamp);if(!Number.isFinite(d.valueOf()) || d.getUTCFullYear()<1 || d.toISOString().replace('.000Z','Z')!==v.timestamp)fail('DECISION_MISMATCH',options.stage,options.reference);}
  }
  for(const x of Object.values(v))fieldLimits(x,options);
}
const countCaps={components:L.candidateComponents,requiredComponents:L.candidateComponents,entries:L.manifestFiles,grants:L.grants,provenance:L.authoritySources,authoritySources:L.authoritySources,dependencies:L.dependenciesPerClaim,assumptions:L.assumptions,nodes:L.graphNodes,edges:L.graphEdges,gates:L.gates,slots:L.gates,qualifications:L.qualifications,blockers:L.blockers,history:L.historyRecords,records:L.historyRecords,sources:L.manifestFiles,sourceIds:L.manifestFiles,authoritySourceIds:L.authoritySources};
function admission(v,options) {
  if(!v || typeof v!=='object')return;
  for(const [k,x] of Object.entries(v)){
    if(Array.isArray(x) && Object.hasOwn(countCaps,k) && x.length>countCaps[k])fail(k==='nodes'||k==='edges'?'GRAPH_LIMIT':'RESOURCE_LIMIT',options.stage,options.reference);
    admission(x,options);
  }
  if(v.kind==='MemoryOSReadinessManifest' && Array.isArray(v.entries)){
    let total=0,claims=0;
    for(const entry of v.entries){if(!entry||typeof entry!=='object')continue;
      if(Number.isSafeInteger(entry.byteLength)){total+=entry.byteLength;if(entry.byteLength>(entry.type==='ENVELOPE'?L.envelopeBytes:L.rawSourceBytes))fail('RESOURCE_LIMIT',options.stage,options.reference);}
      if(entry.type==='ENVELOPE')claims++;
    }
    if(total>L.aggregateEvidenceBytes||claims>L.claims)fail('RESOURCE_LIMIT',options.stage,options.reference);
  }
}
function versions(v,options) {
  if(v?.claim?.version!==undefined && v.claim.version!=='1.0.0')fail('EVIDENCE_VERSION',options.stage,options.reference);
  if(v?.type==='MemoryOSReadinessQualification' && v.version!=='1.0.0')fail('EVIDENCE_VERSION',options.stage,options.reference);
  if(v && typeof v==='object')for(const x of Object.values(v))if(x && typeof x==='object')versions(x,options);
}
export function validateRecord(definition,value,options={}) {
  const o={stage:'INTEGRITY',reference:null,...options};
  const mismatch=o.stage==='VERIFICATION' && ['RESULT_MISMATCH','DECISION_MISMATCH'].includes(o.code);
  try {
    // Admission ceilings remain operational limits. Within those ceilings,
    // malformed supplied verification records use their dedicated mismatch code
    // even when a nested version or canonical-value check detects the defect.
    canonicalBytes(value,{...o,maxBytes:L.resultBytes});
    admission(value,o);fieldLimits(value,o);versions(value,o);
    if(value && Object.hasOwn(value,'version') && value.version!=='1.0.0')fail('EVIDENCE_VERSION',o.stage,o.reference);
    for(const profile of [value?.profile,value?.assessment?.profile]){
      if(profile && (!['rest','cicd'].includes(profile.id)||profile.version!=='1.0.0'))fail('PROFILE_MISMATCH',o.stage,o.reference);
    }
    validateSchema(definition,value,o);checkOrder(value,'',o);
  } catch(error) {
    if(mismatch && error instanceof ReadinessError && ['MO1307_INPUT','MO1307_INTEGRITY','MO1307_EVIDENCE_VERSION','MO1307_PROFILE_MISMATCH','MO1307_QUALIFICATION_MISMATCH','MO1307_HISTORY_MISMATCH','MO1307_DECISION_MISMATCH'].includes(error.code))fail(o.code,o.stage,o.reference);
    throw error;
  }
  return value;
}
export function validateCandidate(candidate,expectedDigest=null) {
  if(candidate?.profile?.id==='cicd' && candidate?.product?.name==='memoryos-rest' || candidate?.profile?.id==='rest' && candidate?.product?.name==='memoryos-ci')fail('PROFILE_MISMATCH','CONFIGURATION','candidate');
  validateRecord('Candidate',candidate,{stage:'CONFIGURATION',reference:'candidate'});
  const ids=new Map(candidate.components.map(x=>[x.id,x]));
  const singleton=['ARCHIVE','DISTRIBUTION','CONFIGURATION','SBOM','PROVENANCE','RUNTIME_CLOSURE','RUNTIME','TOOLCHAIN'];
  for(const role of singleton)if(candidate.components.filter(x=>x.role===role).length!==1)fail('INPUT','CONFIGURATION','candidate');
  for(const role of ['SOURCE_MEMBER','SCHEMA','SECURITY_CONTROL','DOCUMENTATION'])if(!candidate.components.some(x=>x.role===role))fail('INPUT','CONFIGURATION','candidate');
  if(candidate.profile.id==='rest'){
    if(candidate.product.name!=='memoryos-rest'||candidate.providers.length||candidate.components.some(x=>x.role==='ADAPTER')||candidate.remoteScope!=='SAME_HOST_RFC1918')fail('PROFILE_MISMATCH','CONFIGURATION','candidate');
  }else{
    if(candidate.product.name!=='memoryos-ci'||candidate.remoteScope!=='NOT_APPLICABLE'||candidate.providers.map(x=>x.id).join(',')!=='azure,generic,github,gitlab,jenkins')fail('PROFILE_MISMATCH','CONFIGURATION','candidate');
    if(new Set(candidate.providers.map(x=>x.componentId)).size!==5)fail('INPUT','CONFIGURATION','candidate');
    for(const row of candidate.providers)if(ids.get(row.componentId)?.role!=='ADAPTER')fail('INPUT','CONFIGURATION','candidate');
  }
  const result=candidateDigest(candidate);
  if(expectedDigest!==null && expectedDigest!==result)fail('CANDIDATE_MISMATCH','CONFIGURATION','candidate');
  return result;
}
export function validateManifest(manifest) {
  validateRecord('Manifest',manifest,{reference:'manifest'});
  if(manifest.entries.length>L.manifestFiles)fail('RESOURCE_LIMIT','ACQUISITION','manifest');
  const paths=new Set();let total=0,claims=0;
  for(const e of manifest.entries){
    validateRelativeFile(e.path,{reference:e.id});const lower=e.path.toLowerCase();
    if(paths.has(lower))fail('FILESYSTEM_BOUNDARY','ACQUISITION',e.id);paths.add(lower);
    if(e.byteLength>(e.type==='ENVELOPE'?L.envelopeBytes:L.rawSourceBytes))fail('RESOURCE_LIMIT','ACQUISITION',e.id);
    total+=e.byteLength;if(e.type==='ENVELOPE')claims++;
  }
  if(total>L.aggregateEvidenceBytes||claims>L.claims)fail('RESOURCE_LIMIT','ACQUISITION','manifest');
  return manifest;
}
export function validateEnvelope(envelope,reference=null) {
  const pre=envelope?.claim;
  canonicalBytes(envelope,{reference});
  versions(envelope,{stage:'INTEGRITY',reference});
  if(pre && Object.hasOwn(DEFINITIONS.coverage,pre.type) && ['passed','failed','unevaluable'].every(k=>Array.isArray(pre[k]) && pre[k].every(x=>typeof x==='string'))){
    const union=[...pre.passed,...pre.failed,...pre.unevaluable].sort();
    if(!structurallyEqual(union,[...DEFINITIONS.coverage[pre.type]].sort()) || pre.verdict!==(pre.failed.length?'FAIL':pre.unevaluable.length?'UNEVALUABLE':'PASS'))fail('INTEGRITY','EVALUATION',reference);
  }
  if(pre?.type==='PROVIDER_CERTIFICATION' && pre.detail)validateProviderDetail(pre.detail,reference);
  validateRecord('Evidence',envelope,{reference});
  const c=envelope.claim,expected=DEFINITIONS.coverage[c.type];
  if(!expected)fail('INPUT','INTEGRITY');
  const combined=[...c.passed,...c.failed,...c.unevaluable].sort();
  if(!structurallyEqual(combined,[...expected].sort()))fail('INTEGRITY','EVALUATION');
  if(c.verdict!==(c.failed.length?'FAIL':c.unevaluable.length?'UNEVALUABLE':'PASS'))fail('INTEGRITY','EVALUATION');
  const whole=['FINAL_BINDING','TAG_OBSERVATION'].includes(c.type);
  if(c.binding!==(whole?'WHOLE_CANDIDATE':'DEPENDENCY_SET')||(whole?c.dependencies.length!==0:c.dependencies.length===0))fail('INTEGRITY','AUTHORITY');
  return claimDigest(c);
}

export function validateProviderDetail(value,reference=null) {
  validateRecord('ProviderDetail',value,{stage:'EVALUATION',reference});
  const bad=()=>fail('QUALIFICATION_MISMATCH','EVALUATION',reference);
  if(value.sourceExecutionLabel!==value.execution && !(value.provider==='github' && value.sourceExecutionLabel==='NOT_CERTIFIED' && value.execution==='HOSTED_EXECUTION_NOT_CERTIFIED'))bad();
  if(value.provider==='github'){
    if(value.execution==='HOSTED_EXECUTION_CERTIFIED' && (value.hostedCases===null||!Object.values(value.hostedCases).every(x=>x===true)||value.support!=='SUPPORTED'))bad();
    if(['HOSTED_EXECUTION_NOT_CERTIFIED','NOT_CERTIFIED'].includes(value.execution) && value.implementation==='IMPLEMENTED' && value.validation==='OFFLINE_VALIDATED' && value.support!=='SUPPORTED_WITH_HOSTED_CERTIFICATION_LIMITATION')bad();
  }else if(value.hostedCases!==null)bad();
  return value;
}
export function validateGraphStructure(graph) {
  canonicalBytes(graph,{stage:'GRAPH'});
  if(!graph||typeof graph!=='object'||!Array.isArray(graph.nodes)||!Array.isArray(graph.edges))fail('INPUT','GRAPH');
  if(graph.nodes?.length>L.graphNodes||graph.edges?.length>L.graphEdges)fail('GRAPH_LIMIT','GRAPH');
  for(const n of graph.nodes)validateSchema('GraphNode',n,{stage:'GRAPH'});
  for(const e of graph.edges)if(!e || Object.keys(e).sort().join(',')!=='from,to,type' || !['ASSESSES','ACCEPTS','AUTHORIZES','ROOTED_IN','DEPENDS_ON'].includes(e.type) || typeof e.from!=='string'||typeof e.to!=='string')fail('INPUT','GRAPH');
  const nodes=new Map(graph.nodes.map(n=>[n.id,n]));
  if(nodes.size!==graph.nodes.length)fail('INPUT','GRAPH');
  for(const e of graph.edges)if(!nodes.has(e.from)||!nodes.has(e.to))fail('INPUT','GRAPH');
  // Full graph derivation/authority semantics are owned by 2B. Defensive bounded
  // cycle validation is shared so malformed engineering DAG fixtures fail now.
  const indegree=new Map([...nodes.keys()].map(k=>[k,0])),adj=new Map([...nodes.keys()].map(k=>[k,[]]));
  for(const e of graph.edges){if(e.from===e.to)fail('GRAPH_CYCLE','GRAPH');indegree.set(e.to,indegree.get(e.to)+1);adj.get(e.from).push(e.to);}
  const queue=[...indegree].filter(([,n])=>n===0).map(([id])=>id);let visited=0;
  for(let i=0;i<queue.length;i++){visited++;for(const to of adj.get(queue[i])){indegree.set(to,indegree.get(to)-1);if(indegree.get(to)===0)queue.push(to);}}
  if(visited!==nodes.size)fail('GRAPH_CYCLE','GRAPH');
  validateRecord('Graph',graph,{stage:'GRAPH'});
  return graph;
}
export function validateResultIdentity(result) {
  validateRecord('Result',result,{stage:'VERIFICATION',reference:'result',code:'RESULT_MISMATCH'});
  if(result.assessment.candidateDigest!==candidateDigest(result.assessment.candidate)||result.assessment.graphDigest!==canonicalDigest(result.assessment.graph)||result.readinessDigest!==readinessDigest(result.assessment)||result.proofBindingDigest!==proofBindingDigest(result.readinessDigest,result.audit))fail('RESULT_MISMATCH','VERIFICATION','result');
  // Identity consistency alone is explicitly NOT authority or recomputation.
  return result;
}
export function checkDecisionBinding(decision,result) {
  validateRecord('HumanDecision',decision,{stage:'VERIFICATION',reference:'decision',code:'DECISION_MISMATCH'});
  if(decision.candidateDigest!==result.assessment.candidateDigest||decision.readinessDigest!==result.readinessDigest||decision.proofBindingDigest!==result.proofBindingDigest)fail('DECISION_MISMATCH','VERIFICATION','decision');
  return {decision:decision.decision,consistency:decision.decision==='APPROVE'&&!['READY','READY_WITH_QUALIFICATIONS'].includes(result.assessment.readiness)?'CONTRARY_TO_READINESS':'CONSISTENT',authenticity:'NOT_VERIFIED_BY_MEMORYOS'};
}
export function aggregateReference(input) {
  const {gates,blockers,qualifications,cneReasons,history,providers}=input;
  if(gates.length!==DEFINITIONS.gateDefinitions.length || gates.map(g=>g.id).join(',')!==DEFINITIONS.gateDefinitions.map(g=>g.id).join(','))fail('PROFILE_MISMATCH','EVALUATION');
  for(let i=0;i<gates.length;i++)if(gates[i].mandatory!==DEFINITIONS.gateDefinitions[i].mandatory)fail('PROFILE_MISMATCH','EVALUATION');
  for(const gate of gates)validateRecord('GateResult',gate,{stage:'EVALUATION'});
  for(const blocker of blockers){validateRecord('Blocker',blocker,{stage:'EVALUATION'});if(blocker.id!==blockerId(blocker))fail('INTEGRITY','EVALUATION');}
  for(const q of qualifications)validateRecord('DerivedQualification',q,{stage:'EVALUATION'});
  for(const c of cneReasons)validateRecord('CneReason',c,{stage:'EVALUATION'});
  for(const h of history)validateRecord('HistoryProjection',h,{stage:'EVALUATION'});
  for(const p of providers)validateRecord('ProviderDetail',p,{stage:'EVALUATION'});
  sortedUnique(gates,x=>x.id);sortedUnique(blockers,x=>x.id);sortedUnique(qualifications,x=>x.id);
  sortedUnique(cneReasons,x=>[x.gateId,x.reason,x.checkCode??''].join('\0'));sortedUnique(history,x=>x.id);sortedUnique(providers,x=>x.provider);
  const byId=new Map(gates.map(g=>[g.id,g])),blockIds=new Set(blockers.map(b=>b.id)),qIds=new Set(qualifications.map(q=>q.id));
  for(const gate of gates){
    if(gate.blockerIds.some(id=>!blockIds.has(id))||gate.qualificationIds.some(id=>!qIds.has(id)))fail('INTEGRITY','EVALUATION');
    if(gate.state==='BLOCKED' && !gate.blockerIds.length)fail('INTEGRITY','EVALUATION');
  }
  for(const b of blockers)if(!byId.get(b.gateId)?.blockerIds.includes(b.id))fail('INTEGRITY','EVALUATION');
  for(const c of cneReasons)if(!byId.has(c.gateId))fail('INPUT','EVALUATION');
  const blocked=blockers.length>0||gates.some(g=>g.mandatory&&g.applicable&&g.state==='BLOCKED');
  const cne=cneReasons.some(r=>byId.get(r.gateId)?.mandatory)||gates.some(g=>g.mandatory&&g.applicable&&g.state==='COULD_NOT_EVALUATE');
  const qualified=qualifications.some(q=>q.impact==='RELEASE_IMPACTING');
  const readiness=blocked?'NOT_READY':cne?'COULD_NOT_EVALUATE':qualified?'READY_WITH_QUALIFICATIONS':'READY';
  return {...structuredClone({gates,blockers,qualifications,cneReasons,history,providers}),readiness};
}

export function selectPhaseError(checks,stage) {
  const errors=[];
  for(const check of checks)try{check();}catch(e){errors.push(operationalError(e,stage));}
  if(errors.length){errors.sort((a,b)=>errorExit(a)-errorExit(b)||((a.reference??'')<(b.reference??'')?-1:(a.reference??'')>(b.reference??'')?1:0));throw errors[0];}
}

export function inspectFoundationInputs(input,verify=false) {
  const expected=['configurationBytes','candidateBytes','manifestBytes','authorityBytes','files','expectedCandidateDigest','trustedAuthorityDigest',...(verify?['resultBytes','decisionBytes']:[])].sort();
  assertPlainFields(input,expected,'LAUNCH');
  for(const pin of ['expectedCandidateDigest','trustedAuthorityDigest'])if(typeof input[pin]!=='string'||!/^sha256:[0-9a-f]{64}$/u.test(input[pin]))fail('USAGE','LAUNCH');
  const copies={};
  for(const key of ['configurationBytes','candidateBytes','manifestBytes','authorityBytes'])copies[key]=snapshotBytes(input[key],L[key],'CONFIGURATION',key==='configurationBytes'?'config':key.slice(0,-5));
  const parsed={};
  selectPhaseError([
    ()=>{if(digest(copies.authorityBytes)!==input.trustedAuthorityDigest)fail('EVIDENCE_AUTHORITY','CONFIGURATION','authority');},
    ()=>{if(digest(copies.candidateBytes)!==input.expectedCandidateDigest)fail('CANDIDATE_MISMATCH','CONFIGURATION','candidate');},
    ...['configuration','candidate','manifest','authority'].map(name=>()=>{parsed[name]=parseCanonical(copies[name+'Bytes'],{maxBytes:L[name+'Bytes'],stage:'CONFIGURATION',reference:name==='configuration'?'config':name});}),
  ],'CONFIGURATION');
  selectPhaseError([
    ()=>validateRecord('Configuration',parsed.configuration,{stage:'CONFIGURATION',reference:'config',code:'CONFIGURATION'}),
    ()=>validateCandidate(parsed.candidate,input.expectedCandidateDigest),
    ()=>validateRecord('Manifest',parsed.manifest,{stage:'CONFIGURATION',reference:'manifest'}),
    ()=>validateRecord('Authority',parsed.authority,{stage:'CONFIGURATION',reference:'authority'}),
    ()=>{if(parsed.authority.manifestSha256!==digest(copies.manifestBytes))fail('INTEGRITY','CONFIGURATION','manifest');},
    ()=>{if(!structurallyEqual(parsed.configuration.profile,parsed.candidate.profile)||!structurallyEqual(parsed.configuration.profile,parsed.authority.assessment?.profile))fail('PROFILE_MISMATCH','CONFIGURATION','config');},
    ()=>{if(parsed.configuration.stage!==parsed.authority.assessment?.stage)fail('CONFIGURATION','CONFIGURATION','config');},
  ],'CONFIGURATION');
  if(!Array.isArray(input.files))fail('INPUT','ACQUISITION');
  if(input.files.length>L.manifestFiles)fail('RESOURCE_LIMIT','ACQUISITION');
  if(Object.getOwnPropertySymbols(input.files).length || Object.getOwnPropertyNames(input.files).length!==input.files.length+1)fail('INPUT','ACQUISITION');
  let total=0;
  copies.files=[];
  for(let i=0;i<input.files.length;i++){
    const descriptor=Object.getOwnPropertyDescriptor(input.files,String(i));if(!descriptor||!Object.hasOwn(descriptor,'value'))fail('INPUT','ACQUISITION');
    const file=descriptor.value;assertPlainFields(file,['bytes','id'],'ACQUISITION');
    if(typeof file.id!=='string'||!/^[a-z][a-z0-9._-]{0,63}$/u.test(file.id))fail('INPUT','ACQUISITION');
    total+=file.bytes?.byteLength??0;if(total>L.aggregateEvidenceBytes)fail('RESOURCE_LIMIT','ACQUISITION');
    copies.files.push({id:file.id,bytes:snapshotBytes(file.bytes,L.rawSourceBytes,'ACQUISITION',file.id)});
  }
  sortedUnique(copies.files,x=>x.id,{stage:'ACQUISITION'});
  if(verify){copies.resultBytes=snapshotBytes(input.resultBytes,L.resultBytes,'ACQUISITION','result');copies.decisionBytes=input.decisionBytes===null?null:snapshotBytes(input.decisionBytes,L.decisionBytes,'ACQUISITION','decision');}
  validateManifest(parsed.manifest);
  if(parsed.manifest.candidateDigest!==input.expectedCandidateDigest||parsed.authority.assessment.candidateDigest!==input.expectedCandidateDigest)fail('CANDIDATE_MISMATCH','AUTHORITY','candidate');
  if(parsed.manifest.entries.map(x=>x.id).join(',')!==copies.files.map(x=>x.id).join(','))fail('INPUT','ACQUISITION','manifest');
  selectPhaseError(parsed.manifest.entries.map((entry,i)=>()=>{
    const bytes=copies.files[i].bytes;
    if(bytes.length!==entry.byteLength||digest(bytes)!==entry.sha256)fail('INTEGRITY','INTEGRITY',entry.id);
    if(entry.type==='ENVELOPE')validateEnvelope(parseCanonical(bytes,{maxBytes:L.envelopeBytes,reference:entry.id}),entry.id);
  }),'INTEGRITY');
  return {copies,parsed};
}

export function assertPlainFields(value,fields,stage='LAUNCH',reference=null) {
  if(!value || typeof value!=='object'||Array.isArray(value)||![Object.prototype,null].includes(Object.getPrototypeOf(value))||Object.getOwnPropertySymbols(value).length||Object.getOwnPropertyNames(value).sort().join(',')!==fields.slice().sort().join(','))fail('INPUT',stage,reference);
  for(const d of Object.values(Object.getOwnPropertyDescriptors(value)))if(!d.enumerable||!Object.hasOwn(d,'value'))fail('INPUT',stage,reference);
}
