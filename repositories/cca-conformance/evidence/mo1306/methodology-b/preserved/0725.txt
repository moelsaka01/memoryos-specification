"""Close native diagnosis after the mandatory stop; data validation only."""
import hashlib,io,json,sys,unittest
from pathlib import Path
sys.dont_write_bytecode=True
from timing_analysis import original_measurement,product_observation
import test_timing_analysis
ROOT=Path(__file__).resolve().parents[4];HERE=Path(__file__).resolve().parent
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/phase3ar-resolution/native';OLD=ROOT/'repositories/cca-conformance/evidence/mo1306/phase3ar'
read=lambda p:json.loads(p.read_bytes())
def row(p):
 b=p.read_bytes();return {'path':p.relative_to(ROOT).as_posix(),'byteLength':len(b),'sha256':'sha256:'+hashlib.sha256(b).hexdigest()}
def put(p,v):
 with p.open('x',encoding='utf-8',newline='\n') as f:json.dump(v,f,sort_keys=True,separators=(',',':'));f.write('\n')
 return row(p)
summaries=[OUT/n/'summary.json' for n in ['20260927T104635-c3579f','20260927T105103-04f91c','20260927T105158-cf9d52']]
observations=[];traces=[]
for summary in summaries:
 record=read(summary);assert record['failure'] is None and record['installedUnchanged']
 for observed in record['observations']:
  p=ROOT/observed['report']['path'];trace=ROOT/observed['trace']['path'];value=read(p);analysis=product_observation(value)
  analysis.update(rawReport=row(p),trace=row(trace),campaign=row(summary));observations.append(analysis);traces.append(read(trace))
assert len(observations)==7
assert [x['lateAccepted'] for x in observations]==[False]*6+[True]
assert observations[-1]['classification']=='PRODUCT_DEADLINE_VIOLATION'
boundary=read(ROOT/observations[-1]['rawReport']['path']);events=boundary['events'];pick=lambda key:next(e for e in events if e['event']==key)
assert not any(e['event']=='timerFire' for e in events)
raw=read(OLD/'github/raw-helper-timing.json');transcript=OUT.parent/'original-probe-transcript/raw-helper-probe.py.txt'
original=original_measurement(raw,transcript.read_text());original.update(receipt=row(OLD/'github/raw-helper-timing.json'),sourceTranscript=row(transcript),transcriptProvenance=row(transcript.with_name('provenance.json')),safeTrueMeaning='Fixed read-only path validation returned safe:true and exit0 for one config path. No semantic evaluation, product deadline timer, or publication was part of this raw probe.',originalLifecycleTimingKnown=False,originalCliFailurePreserved=row(OLD/'native/20260926T192747-a09e20/summary.json'))
stream=io.StringIO();suite=unittest.defaultTestLoader.loadTestsFromModule(test_timing_analysis);result=unittest.TextTestRunner(stream=stream,verbosity=2).run(suite)
assert result.wasSuccessful() and result.testsRun==9
with (OUT/'measurement-regression.stdout.txt').open('x',encoding='utf-8',newline='\n') as f:f.write(stream.getvalue())
regression=put(OUT/'measurement-regression.json',{'kind':'MemoryOSPhase3ARResolutionMeasurementRegression','version':'1.0.0','status':'PASS','testsRun':result.testsRun,'failures':0,'errors':0,'source':row(HERE/'test_timing_analysis.py'),'analyzer':row(HERE/'timing_analysis.py'),'output':row(OUT/'measurement-regression.stdout.txt'),'scope':'Retained-data analysis and explicitly synthetic negative mutations only; no further product process or helper invocation.'})
preflight=read(summaries[0].parent/'preflight.json');pkg=ROOT/'.cache/mo1306-phase3ar/install/node_modules/memoryos-ci'
after=[{'path':p.relative_to(pkg).as_posix(),'sha256':'sha256:'+hashlib.sha256(p.read_bytes()).hexdigest(),'byteLength':p.stat().st_size} for p in sorted(pkg.rglob('*')) if p.is_file()]
assert after==preflight['installedBefore'] and len(after)==94
integrity=put(OUT/'installed-integrity-after.json',{'status':'PASS','members':after,'memberCount':94,'before':row(summaries[0].parent/'preflight.json'),'distribution':row(pkg/'distribution-manifest.json')})
assert all(t['topologyValidation']['status']=='PASS' and t['observation']['peakProcessCount']<=3 and not t['cleanup']['remainingPids'] for t in traces)
host=OUT.parent/'host-events/focused-seven-observations.json';assert read(host)['status']=='REVIEWED'
report={
 'kind':'MemoryOSPhase3ARResolutionNativeTimingDiagnosis','version':'1.0.0','status':'NATIVE_DEADLINE_BLOCKED','classification':'PRODUCT_DEADLINE_VIOLATION','requiredDisposition':'MO-1306 PHASE 3A NATIVE DEADLINE BLOCKED','certificationAllowed':False,
 'blockedCheckpoint':'f236c4a2f94d8cd8e763aaa4bd6c52d703429692','productionAuthority':'9e1bbff99c23cdbc4c80f11e87eadb89a36e8f44','initialAudit':row(OUT/'initial-audit.json'),'original2032':original,
 'frozenDeadline':{'helperExecutionMs':2000,'cleanupReserveMs':2000,'valuesUnchanged':True,'requirementSource':row(ROOT/'docs/mo1306-contract-freeze-1.md'),'limits':row(pkg/'contracts/limits.json'),'contractInterpretation':'The helper has <=2000ms execution; a deadline marks the generation terminal first, closes input, kills the direct child, and awaits close/reap within the separately reserved2000ms. Successful acceptance after a deadline is not authorized by the cleanup reserve. User blocker-resolution requirement16 explicitly requires no accepted late semantic/helper success.'},
 'observationCount':7,'maximumAuthorizedWithoutMoreEvidence':10,'observations':observations,
 'boundaryFailure':{'control':'Explicit engineering scheduling pause before forwarding an actual child close event; no synthesized response or exit status.','actualHelperResponse':pick('stdoutData'),'actualHelperExit':next(e for e in events if e['event']=='childEventBefore' and e['name']=='exit'),'actualCloseArrived':pick('boundaryActualCloseArrived'),'pauseBegin':pick('boundaryPauseBegin'),'pauseEnd':pick('boundaryPauseEnd'),'closeForwarded':pick('boundaryCloseForwardedToProduct'),'timer':pick('timerArmed'),'timerCleared':next(e for e in events if e['event']=='timerClear' and e['id']==1),'promiseResolved':pick('checkPathsResolved'),'lateAcceptanceLowerBoundMs':pick('boundaryCloseForwardedToProduct')['atMs']-boundary['deadlineWindow']['upperMs'],'observedPromiseAfterDueMs':boundary['terminalAtMs']-boundary['deadlineWindow']['upperMs'],'timeoutCallbackFired':False,'helperKernelRuntimeOverrunClaim':False,'actualProductGap':'The actual installed close callback clears the pending timer and checks only terminal, without checking the monotonic deadline. When real close is delivered after deadline before timeout callback execution, valid safe:true/exit0 is accepted late.','resultState':'checkPaths promise resolved success; full CLI continuation intentionally not executed.','filesystem':boundary['filesystem']},
 'clockDomains':{'originalPython':preflight['clocks']['monotonic'],'externalObserver':preflight['clocks']['perf_counter'],'productEvents':'Node performance.now; same-process time coordinates only. Timer-registration before/after bracket the due point; no cross-process absolute comparison.','utcUsage':'Operational event-log correlation only; never enforcement.','noRoundingGraceOrOverheadSubtraction':True},
 'hostInterruptionReview':row(host),'windowsSchedulingTransientClaim':False,'controlledPauseIsNotClaimedOriginalInterruption':True,
 'topology':{'status':'PASS','maximumObservedRoles':max(t['observation']['peakProcessCount'] for t in traces),'helperWorkerOverlapObserved':False,'remainingPids':[],'scope':'All seven external sampled role-bound process traces; no kernel containment claim.'},
 'productBytesUnchanged':True,'installedIntegrity':integrity,'regressionTests':regression,
 'stopPolicy':{'applied':True,'triggerObservation':7,'furtherProductExecutions':0,'fullNativeCampaignRun':False,'productionEdited':False,'deadlineChanged':False},
 'remainingGates':['Native corrected CLI FAIL','Native corrected CLI COULD_NOT_EVALUATE','Successful installed CLI generate','Directly dependent publication completion','Native and hosted full certification'],
 'scopeLimitations':['Original2032 is classified as an engineering measurement/inference defect; its exact child lifecycle cannot be reconstructed from the old outer stopwatch. This finding does not retroactively turn the blocked checkpoint into PASS.','The new product violation is late supervisor acceptance under a deliberately imposed scheduling fault. The actual helper exited early; no helper physical execution overrun is claimed.','No unexpected host interruption is inferred. Accessible retained event logs contain no candidate transition/time-change in the focused window, which does not exclude unlogged scheduler stalls.','No further product run followed the decisive observation. Any production correction requires separately authorized work and a new corrected authority.'],
 'harness':row(Path(__file__))}
put(OUT/'timing-diagnosis.json',report)
print(json.dumps({'status':report['status'],'classification':report['classification'],'original2032Classification':original['classification'],'observations':7,'regressionTests':9,'lateAcceptanceLowerBoundMs':report['boundaryFailure']['lateAcceptanceLowerBoundMs'],'promiseAfterDueMs':report['boundaryFailure']['observedPromiseAfterDueMs'],'report':str(OUT/'timing-diagnosis.json')}))
