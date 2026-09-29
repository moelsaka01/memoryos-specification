// Offline engineering judgment, made only after the closed fixed campaign.
import assert from 'node:assert/strict';
import {evidence,baseline,json,record,write} from './common.mjs';
const s=json(evidence+'/statistics.json'),m=json(evidence+'/margin-analysis.json'),c=json(evidence+'/contract-intent.json');
assert.equal(s.sampleCount,25);assert.equal(s.timeoutCount,1);assert.equal(c.classification,'WHOLE_HELPER_LIFECYCLE');
assert.equal(s.rows.find(r=>r.sampleId==='20-C').result,'TIMEOUT');assert.ok(m.minimumSuccessfulMarginMs>0&&m.minimumSuccessfulMarginMs<750);
const successfulMaximumMs=Math.max(...s.rows.filter(r=>r.result==='SUCCESS').map(r=>r.durations.launchToTransportSettlementMs));
write(evidence+'/decision.json',{kind:'MO1307HelperDeadlineDecision',version:'1.0.0',result:'CHARACTERIZATION_COMPLETE',baseline,createdAfterMeasurementsAtUtc:new Date().toISOString(),
 bindings:['statistics.json','margin-analysis.json','contract-intent.json','deadline-source-analysis.json','security-analysis.json','authority-binding.json','authority-source-after.json'].map(n=>record(evidence+'/'+n)),
 recommendedModel:'C',model:'RECHARACTERIZE_WHOLE_HELPER_BOUND',contractIntent:'WHOLE_HELPER_LIFECYCLE',implementationMatchesIntent:true,
 rationale:['Freeze explicitly includes startup through confirmed settlement; implementation agrees. Model B therefore lacks normative support.',
  'The fixed finite sample set contains one natural MO1307_TIMEOUT/ACQUISITION on the 65-file representative workload and successful margins of557.6394ms and154.9369ms on that same workload. Model A credible-margin criterion is not met.',
  'This is evidence of inadequate observed5000ms engineering margin in the recorded environment, not a universal tail estimate or proof of scheduler/bootstrap causation.',
  'Historical Step G failure remains independent supporting evidence of variance; no historical or current censored timeout is treated as a completed latency.'],
 alternatives:{A:'Not supported by this margin/failure evidence; current fail-closed behavior remains in force.',B:'Not supported by explicit whole-lifecycle authority. T3/bootstrap/request-only execution cannot be isolated externally.',C:'Supported as a recommendation for separately authorized bound engineering; no new bound or product change is approved here.'},
 limitations:['Five observations per case; no meaningful p90 or statistical tail guarantee.','No true cold-cache control; normal OS cache and host activity uncontrolled.',
  'Query-only observer can perturb scheduling: cumulative sampling query wall time229.8449–1180.0666ms/sample, maximum sample gap128.3506ms. This is concurrent observer work, not identified delay added to the helper, and cannot be subtracted.',
  'Process CPU sums all threads and usually exceeds elapsed time; no direct scheduler/Defender causation established.',
  'Exact historical session/frame buffers absent; B/C reconstructed, D original-root workload surrogate with identical retained files and one extra ancestor versus B.',
  'Standalone real supervisor/transport samples do not execute private sequence framing clock or full CLI certification.',
  'T3 and isolated bootstrap NOT_OBSERVABLE; no selected future bound follows from the censored samples.'],
 futureBoundMethod:{status:'SEPARATE_AUTHORITY_REQUIRED_NO_NEW_LIMIT_SELECTED',
  steps:['Predeclare a finite uncensored characterization design and stopping budget for the same fresh-process lifecycle, under separately authorized bounded engineering controls. Include low-load and representative normal-load windows and predeclare a lower-overhead comparison to assess observer sensitivity; never subtract observer work from product times.',
   'Choose reliability target and confidence before collecting the larger sample. Estimate an upper tolerance bound U for successful whole-lifecycle settlement; retain failures as right-censored and expand only within the separately approved finite design, never retry until pass.',
   'Evaluate candidate B >= U + max(1500ms,0.30*U) + explicitly justified measurement/scheduling uncertainty. This is a proposed engineering margin method, not normative text or a selected value.',
   'Reconcile any candidate with unchanged aggregate20000ms, CLI30000ms, API/worker10000ms and cleanup2000ms limits, denial-of-service exposure, fail-closed terminal precedence and native cleanup. Any required change needs explicit separate scope.',
   'Authorize a precise contract/production correction only after that evidence review; then obtain separate authority for any certification generation.'],
  observedCompletedMaximumMs:successfulMaximumMs,illustrativeAbsoluteMarginMs:1500,arithmeticLowerFloorMs:successfulMaximumMs+1500,
  floorMeaning:'The completed maximum plus1500ms is an arithmetic lower floor for discussion only. It is not a safe bound, range or selected proposal: timed-out successful completion remains unknown. No6000ms proposal is inferred from5063ms historical settlement.'},
 cleanup:{sample:'20-C',productCleanupConfirmed:false,externalHeldHelperAndConsoleSignaled:true,allDescendantCoverageEstablished:false,requiredCleanupViolationEstablished:false,
  meaning:'No valid response arrived, so unchanged product could not establish its console proof and retained cleanupConfirmed:false. External observations do not upgrade that flag or the certification gate. No positive owned survivor or premature timeout was established, so fixed-plan continuation followed its declared rule.'},
 security:{A:'Retains current fail-closed whole-lifecycle cap.',B:'Would require separately bounded startup and bounded total lifecycle; excluding startup without another cap would permit unbounded acquisition.',C:'A longer whole-helper bound enlarges denial-of-service/process occupancy exposure. Review aggregate/admission constraints and bounded cleanup; no unbounded execution.'},
 contractChangeRequiredToAdoptRecommendation:true,productionChangeRequiredToAdoptRecommendation:true,contractChangedHere:false,productionChangedHere:false,deadlineChangedHere:false,
 phase3AR:'BLOCKED',phase3BR:'UNCHANGED_APPLICABLE',phase3CR:'UNCHANGED_APPLICABLE',certification:false,push:false,tag:false,
 nextAuthority:'MO-1307 WHOLE-HELPER DEADLINE CONTRACT CORRECTION DESIGN (MODEL C): bounded evidence-based limit selection, observer-sensitivity assessment and denial-of-service/aggregate-budget review; no certification and no limit change until separately authorized.',
 exactNextTask:'Request separate authorization for MO-1307 WHOLE-HELPER DEADLINE CONTRACT CORRECTION DESIGN (MODEL C), preserving historical Phase3A-R BLOCKED and all frozen limits until its evidence-based decision.'});
console.log(JSON.stringify({result:'CHARACTERIZATION_COMPLETE',recommendedModel:'C',successfulMaximumMs,arithmeticLowerFloorMs:successfulMaximumMs+1500,selectedDeadline:null}));
