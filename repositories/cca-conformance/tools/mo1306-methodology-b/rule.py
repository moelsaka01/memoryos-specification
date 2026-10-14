"""Closed review predicate and one-witness state transition; no execution engine."""
from common import need,BASE,DIST,FAITHFUL,ENHANCED,GROUPS
CONDITIONS=[
 'exact-history-preserved','historical-fail-closed','no-false-completion',
 'no-established-current-product-defect','no-established-current-harness-defect',
 'exact-candidate-identity','bounded-faithful-observations','enhanced-observation',
 'current-integrity-and-cleanup','no-unexplained-current-contradiction',
 'operational-not-normative','candidate-limited-claim','receipt-disclosure-obligation',
 'no-historical-causal-claim','stop-on-final-recurrence','predeclared-bounded-protocol',
 'independent-structural-negative-controls','exact-unaffected-evidence-reuse']
FORBIDDEN=['semanticMismatch','wrongNormativeBytes','securityBypass','acceptedLateSuccess',
 'falseCompletion','integrityViolation','reproducibleProductDefect','reproducibleHarnessDefect',
 'finalCampaignRecurrence','unexplainedCurrentAffectedEvidence','insufficientCandidateIdentity',
 'missingHistoricalEvidence','nonFailClosedFailure']
RECURRENCE='Any final-witness failure stops certification immediately; same publication failure invalidates this exception. Preserve the failed attempt. No retries or campaign-ID reset; a new review is required.'
HISTORY={'attemptId':'20260927T120240-b3df86','runId':'e89b8e91-c3c5-402d-9e6f-000bd2a102ba','disposition':'FAIL / UNRESOLVED','originalDisposition':'NATIVE_CERTIFICATION_BLOCKED','stage':'PUBLICATION / manifest finalization','cause':'UNRESOLVED','causalCategory':None}
def eligible(v):
    need(set(v)=={'kind','version','candidate','history','matrix','ineligible','evidenceClasses','plan','claims','disclosure','reuse'},'CASE_FIELDS')
    need(v['kind']=='MemoryOSUnresolvedObservationEligibility' and v['version']=='1.0.0','CASE_KIND')
    need(v['candidate']=={'productionAuthority':BASE,'distributionSha256':DIST,'identityVerified':True},'CANDIDATE_IDENTITY')
    need(v['history']==HISTORY,'HISTORICAL_REWRITE_OR_CAUSE')
    rows=v['matrix'];need([r['id'] for r in rows]==CONDITIONS,'CONDITION_SET')
    for r in rows:
        need(set(r)=={'id','status','basis','evidence'},'CONDITION_FIELDS')
        need(r['status'] in ['PASS','FAIL','NOT_ESTABLISHED'],'CONDITION_STATUS')
        need(r['status']=='PASS','UNSATISFIED '+r['id'])
        need(isinstance(r['basis'],str) and bool(r['basis'].strip()) and isinstance(r['evidence'],list) and len(r['evidence'])>0,'UNBOUND_CONDITION')
    need(set(v['ineligible'])==set(FORBIDDEN),'INELIGIBILITY_SET')
    need(all(x is False for x in v['ineligible'].values()),'INELIGIBLE_OBSERVATION')
    need(v['evidenceClasses']==dict.fromkeys(['structural','faithful','enhanced','identity','negativeControls','failClosed'],'ESTABLISHED'),'EVIDENCE_CLASSES')
    need(v['plan']=={'faithfulIds':FAITHFUL,'enhancedId':ENHANCED,'finalWitnessLimit':1,'finalAttemptsConsumed':0,'finalCampaign':'C3CB-missing-input-final-under-M3','predeclaredBoundedDiagnosticsVerified':True,'allDiagnosticAttemptsRetained':True,'retryUntilPass':False},'BOUNDED_PLAN')
    need(v['claims']=={'scope':'CURRENT_CANDIDATE_ONLY','currentCandidateCertified':False,'historicalCauseEstablished':False,'reliabilityProbability':None,'disposition':'ELIGIBLE_FOR_ONE_FINAL_WITNESS','finalGate':'PENDING','hostedCertified':False},'CLAIM_OVERREACH')
    d=v['disclosure'];need(set(d)=={'history','candidate','faithfulWitnessIds','enhancedObservationId','failClosedEvidence','methodologyRevision','recurrenceRule','receiptState'},'DISCLOSURE_FIELDS')
    need(d['history']==HISTORY and d['candidate']==v['candidate'] and d['faithfulWitnessIds']==FAITHFUL and d['enhancedObservationId']==ENHANCED,'DISCLOSURE_IDENTITY')
    need(d['failClosedEvidence']==rows[1]['evidence'] and d['methodologyRevision']=='REQUIRED_ACTUAL_M3_COMMIT_IN_LATER_FINAL_RECEIPT' and d['recurrenceRule']==RECURRENCE and d['receiptState']=='ELIGIBILITY_ONLY_FINAL_RECEIPT_REQUIRED','DISCLOSURE_OBLIGATIONS')
    need(v['reuse']=={'groups':GROUPS,'exactDependenciesRequired':True,'rerunUnaffectedGroups':False,'retainedEvidenceBound':True},'REUSE_DRIFT')
    return 'ELIGIBLE_FOR_ONE_FINAL_WITNESS'

def final_transition(case,receipt,revision,verify_witness):
    """Validate a later sidecar; caller verifies actual M3 revision and fresh evidence.

    No PASS is inferred from an exit code. verify_witness must verify the frozen
    bundle, identity, protocol, integrity, cleanup and append-only attempt ledger.
    This does not confer hosted or overall release certification.
    """
    eligible(case)
    need(set(receipt)=={'kind','methodologyRevision','disclosure','attempts','allAttemptsAccounted','retainedGroupsVerified','previousFailureRecorded'},'FINAL_FIELDS')
    need(receipt['kind']=='MemoryOSBoundedFinalWitness' and receipt['methodologyRevision']==revision and isinstance(revision,str) and len(revision)==40 and all(c in '0123456789abcdef' for c in revision) and revision!=BASE,'FINAL_REVISION')
    expected={**case['disclosure'],'methodologyRevision':revision,'receiptState':'FINAL_WITNESS_RECORDED'}
    need(receipt['disclosure']==expected,'FINAL_DISCLOSURE')
    need(receipt['allAttemptsAccounted'] is True and receipt['retainedGroupsVerified'] is True and receipt['previousFailureRecorded'] is False,'LEDGER_OR_REUSE')
    need(len(receipt['attempts'])==1,'ONE_FINAL_ATTEMPT_ONLY')
    a=receipt['attempts'][0];need(set(a)=={'id','candidate','result','recurrence','evidence'},'FINAL_ATTEMPT_FIELDS')
    need(isinstance(a['id'],str) and a['id'] and a['id'] not in [*FAITHFUL,ENHANCED,HISTORY['attemptId']],'FRESH_FINAL_WITNESS_REQUIRED')
    need(a['candidate']==case['candidate'] and a['result']=='PASS' and a['recurrence'] is False,'STOP_REOPEN_BLOCKER')
    need(verify_witness(a) is True,'FINAL_EVIDENCE_NOT_VERIFIED')
    return 'NATIVE_MISSING_INPUT_GATE_ACCEPTABLE_HOSTED_STILL_REQUIRED'
