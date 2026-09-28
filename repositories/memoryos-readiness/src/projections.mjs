import { canonicalBytes } from './canonical.mjs';
import { DEFINITIONS } from './constants.mjs';
import { validateRecord } from './foundation.mjs';
import { fail } from './errors.mjs';

// Pure projection of an already supplied result; never evaluates or authorizes it.
export function summaryProjection(result,operation='evaluate',decision=null) {
  if(!['evaluate','verify'].includes(operation))fail('USAGE','PUBLICATION');
  const a=result.assessment;
  const summary={kind:'MemoryOSReadinessSummary',version:'1.0.0',operation,readiness:a.readiness,readinessDigest:result.readinessDigest,proofBindingDigest:result.proofBindingDigest,blockerCount:a.blockers.length,qualificationCount:a.qualifications.length,cneCount:a.cneReasons.length,decision};
  validateRecord('Summary',summary,{stage:'PUBLICATION'});
  const bytes=canonicalBytes(summary);
  if(bytes.length>DEFINITIONS.limits.jsonSummaryBytes)fail('OUTPUT','PUBLICATION');
  return bytes;
}
export function textProjection(result,decision=null) {
  validateRecord('Result',result,{stage:'PUBLICATION'});
  const a=result.assessment, set=x=>x.length?x.join(','):'[]';
  const lines=[`readiness=${a.readiness} readinessDigest=${result.readinessDigest} proofBindingDigest=${result.proofBindingDigest}`];
  for(const g of a.gates)lines.push(`gate=${g.id} state=${g.state}`);
  for(const b of a.blockers)lines.push(`blocker=${b.id} gate=${b.gateId} reason=${b.reasonCode} check=${b.checkCode} condition=${b.conditionId}`);
  for(const c of a.cneReasons)lines.push(`cne=${c.gateId} reason=${c.reason} check=${c.checkCode}`);
  for(const q of a.qualifications)lines.push(`qualification=${q.id} reason=${q.reasonCode} impact=${q.impact} provider=${q.provider} gates=${set(q.gateIds)} conditions=${set(q.conditionIds)}`);
  for(const h of a.history)lines.push(`history=${h.id} outcome=${h.originalOutcome} disposition=${h.disposition} recurrence=${h.recurrence}`);
  for(const p of a.providers)lines.push(`provider=${p.provider} implementation=${p.implementation} validation=${p.validation} execution=${p.execution} sourceExecutionLabel=${p.sourceExecutionLabel} support=${p.support} hostedPass=${p.hostedCases?.pass??null} hostedFail=${p.hostedCases?.fail??null} hostedCne=${p.hostedCases?.cne??null} hostedParity=${p.hostedCases?.parity??null}`);
  for(const action of a.requiredHumanActions)lines.push(`humanAction=${action}`);
  if(decision!==null){validateRecord('DecisionVerification',decision,{stage:'PUBLICATION'});lines.push(`decision=${decision.decision} consistency=${decision.consistency} authenticity=NOT_VERIFIED_BY_MEMORYOS`);}
  const bytes=Buffer.from(lines.join('\n')+'\n','utf8');
  if(bytes.length>DEFINITIONS.limits.textStdoutBytes)fail('OUTPUT','PUBLICATION');
  return bytes;
}
