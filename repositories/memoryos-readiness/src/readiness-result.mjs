import { canonicalBytes, readinessDigest, proofBindingDigest } from './canonical.mjs';
import { DEFINITIONS } from './constants.mjs';
import { aggregateReference, assertPlainFields, validateRecord } from './foundation.mjs';
import { evaluationExit, fail, ReadinessError } from './errors.mjs';
import { summaryProjection, textProjection } from './projections.mjs';

const L=DEFINITIONS.limits;
const options={stage:'EVALUATION',reference:'result'};
const aggregateFields=['gates','blockers','qualifications','cneReasons','history','providers','readiness'];
const digestPlaceholder='sha256:'+'0'.repeat(64);

// Every fragment already passed the shared admission/representation checks at
// the verified-input or aggregation seam. Summing shared J-encoded fragments
// plus a skeleton gives a finite upper bound without another serializer or a
// guessed larger output allowance. Replacing null/[] only makes this bound
// conservative. The whole-result encoder still enforces total values/depth.
function resultSizeBound(result) {
  const a=result.assessment;
  const collections=['gates','blockers','qualifications','cneReasons','history','providers'];
  const skeleton={...result,assessment:{...a,candidate:null,graph:null},audit:null};
  for(const key of collections)skeleton.assessment[key]=[];
  let bound=canonicalBytes(skeleton,options).length;
  for(const fragment of [a.candidate,a.graph,result.audit])bound+=canonicalBytes(fragment,options).length;
  for(const key of collections)for(const row of a[key])bound+=canonicalBytes(row,options).length;
  return bound;
}

// Formatting is selected separately by the caller. A bounded JSON/API result
// must not fail merely because a text representation would exceed its own cap.
export function projectReadinessResult(result,format='json') {
  if(!['json','text'].includes(format))fail('USAGE','EVALUATION','result');
  try {
    return format==='json'?summaryProjection(result):textProjection(result);
  } catch(error) {
    // These shared renderers also serve Phase 2C publication. During pure
    // construction, an output-size failure belongs to EVALUATION (Freeze §15).
    if(error instanceof ReadinessError && error.code==='MO1307_OUTPUT')fail('OUTPUT','EVALUATION','result');
    throw error;
  }
}

// Private Phase 2A seam, deliberately absent from the package root exports.
// `verified` is the detached, already validated projection from readiness-core;
// this function is not a verifier for arbitrary raw evidence or gate vectors.
// The integrated worker connects Phase 2B's authoritative grants, exact source/
// history bindings and derived graph to this projection; Phase 2C owns checked
// acquisition and publication. A self-consistent result/proof does not replace
// those checks. External human decisions remain downstream and outside both
// identities. This module has no filesystem, process, network, clock or env use.
export function constructReadinessResult(verified,aggregate) {
  assertPlainFields(aggregate,aggregateFields,'EVALUATION','result');
  // aggregateReference validates rows but intentionally does not impose these
  // global collection ceilings. Preserve operational count errors before sizing.
  for(const [key,cap] of Object.entries({gates:L.gates,blockers:L.blockers,qualifications:L.qualifications,cneReasons:L.jsonValues,history:L.historyRecords,providers:DEFINITIONS.enums.providers.length})){
    if(!Array.isArray(aggregate[key]))fail('INPUT','EVALUATION','result');
    if(aggregate[key].length>cap)fail('RESOURCE_LIMIT','EVALUATION','result');
  }
  const computed=aggregateReference(aggregate);
  if(aggregate.readiness!==computed.readiness)fail('INTEGRITY','EVALUATION','result');
  const assessment={
    contract:{id:'memoryos.readiness',version:'1.0.0'},
    candidate:structuredClone(verified.candidate),candidateDigest:verified.candidateDigest,
    profile:structuredClone(verified.profile),stage:verified.stage,
    authorityIdentityDigest:verified.authorityIdentityDigest,
    ...computed,graph:structuredClone(verified.graph),graphDigest:verified.graphDigest,
    requiredHumanActions:[...DEFINITIONS.requiredHumanActions],
  };
  const result={kind:'MemoryOSReadinessResult',version:'1.0.0',assessment,
    readinessDigest:digestPlaceholder,audit:structuredClone(verified.audit),proofBindingDigest:digestPlaceholder};
  // Check output size before digest helpers/validateRecord use their shared
  // default 4 MiB cap. Only byte overflow maps to OUTPUT: parser/depth/value
  // failures from the same shared encoder retain RESOURCE_LIMIT unchanged.
  const preview=canonicalBytes(result,{...options,maxBytes:resultSizeBound(result)});
  if(preview.length>L.resultBytes)fail('OUTPUT','EVALUATION','result');
  validateRecord('Result',result,options);
  result.readinessDigest=readinessDigest(assessment);
  result.proofBindingDigest=proofBindingDigest(result.readinessDigest,result.audit);
  const proofInput={kind:'MemoryOSReadinessProofBinding',version:'1.0.0',
    readinessDigest:result.readinessDigest,audit:structuredClone(result.audit)};
  const resultBytes=canonicalBytes(result,options);
  return {result,resultBytes,readinessDigest:result.readinessDigest,
    proofBindingDigest:result.proofBindingDigest,proofInput,
    exitCode:evaluationExit(assessment.readiness)};
}
