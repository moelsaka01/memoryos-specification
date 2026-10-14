"""Independent read-only validation of the stopped deadline-resolution evidence.

No helper, semantic worker, publication operation, network request, Git mutation,
or historical-evidence rewrite is performed. Negative controls mutate copies in
memory. PASS means the blocking diagnosis is evidenced; it is not certification.
"""
import argparse,base64,copy,hashlib,io,json,math,os,subprocess,sys,tarfile
from pathlib import Path
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[4];HERE=Path(__file__).resolve().parent
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/phase3ar-resolution'
OLD=ROOT/'repositories/cca-conformance/evidence/mo1306/phase3ar'
PKG=ROOT/'.cache/mo1306-phase3ar/install/node_modules/memoryos-ci'
SOURCE=ROOT/'repositories/memoryos-ci'
sys.path.insert(0,str(HERE));import preservation
sys.path.insert(0,str(HERE.parent/'mo1306-phase2d'));from trace_phase2d import validate_trace
PREFIX=OUT.relative_to(ROOT).as_posix()+'/'
CAMPAIGNS=['native/20260927T104635-c3579f/summary.json','native/20260927T105103-04f91c/summary.json','native/20260927T105158-cf9d52/summary.json']
ARCHIVE_SHA='sha256:2f1e9424ce64e44b7b1587ce206fe5f7ae72579652ca1fc891c489bc1a21925d'
NODE_SHA='sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
MANIFEST_SHA='sha256:311927a980bd397ab70b95da77d546e4b212968d05973ecf998817764431d773'
def encode(v):return (json.dumps(v,sort_keys=True,separators=(',',':'))+'\n').encode()
def sha(v):return 'sha256:'+hashlib.sha256(v).hexdigest()
def need(v,message):
 if not v:raise AssertionError(message)
def close(a,b):return math.isclose(a,b,rel_tol=0,abs_tol=1e-7)
def timestamp(v):
 import datetime
 return datetime.datetime.fromisoformat(v.replace('Z','+00:00'))
class Audit:
 def __init__(self,overrides=None):self.overrides=overrides or {};self.checked={};self.cache={}
 def raw(self,name):
  name=str(name).replace('\\','/')
  p=Path(name);p=p if p.is_absolute() else ROOT/p;p.resolve().relative_to(ROOT.resolve())
  key=p.relative_to(ROOT).as_posix()
  if key in self.overrides:return self.overrides[key]
  if key not in self.cache:self.cache[key]=p.read_bytes()
  return self.cache[key]
 def data(self,name):return json.loads(self.raw(name))
 def evidence(self,name):return self.data(PREFIX+name)
 def ref(self,r):
  need(isinstance(r,dict) and {'path','byteLength','sha256'}<=r.keys(),'BAD_FILE_REFERENCE')
  raw=self.raw(r['path']);need(len(raw)==r['byteLength'] and sha(raw)==r['sha256'],'FILE_BYTES_CHANGED: '+r['path'])
  self.checked[r['path']]={'path':r['path'],'byteLength':len(raw),'sha256':sha(raw)}
  return raw
 def walk(self,v):
  if isinstance(v,dict):
   if {'path','byteLength','sha256'}<=v.keys():self.ref(v)
   else:
    for value in v.values():self.walk(value)
  elif isinstance(v,list):
   for value in v:self.walk(value)
 def preserve_bytes(self):
  before=self.evidence('preservation/before.json')
  need(before['checkpointFileCount']==321,'CHECKPOINT_COUNT')
  for r in before['checkpointFiles']:self.ref(r)
  need(sha(encode(before['checkpointFiles']))==before['checkpointInventorySha256'],'CHECKPOINT_INVENTORY_DIGEST')
  return before
 def candidate(self):
  c=self.evidence('candidate.json');self.walk(c)
  need(c['startingHead']==preservation.CHECKPOINT and c['productAuthority']==preservation.C3AB,'AUTHORITY_CHANGED')
  need(c['archive']['sha256']==ARCHIVE_SHA and c['archive']['byteLength']==197172,'ARCHIVE_PIN')
  need(c['nodeIdentity']['sha256']==NODE_SHA,'NODE_PIN')
  need(c['node']['version']=='v24.21.0' and c['node']['architecture']=='x64','NODE_VERSION')
  need(c['rebuildPerformed'] is False and c['oldEvidenceRewritten'] is False,'FORBIDDEN_REBUILD_OR_REWRITE')
  manifest_bytes=self.raw((PKG/'distribution-manifest.json').relative_to(ROOT))
  need(sha(manifest_bytes)==MANIFEST_SHA,'DISTRIBUTION_PIN')
  manifest=json.loads(manifest_bytes)
  expected={r['path'] for r in manifest['files']}|{'distribution-manifest.json'}
  need(len(expected)==94 and c['memberCount']==94,'PACKAGE_MEMBER_COUNT')
  need({p.relative_to(PKG).as_posix() for p in PKG.rglob('*') if p.is_file()}==expected,'INSTALLED_MEMBERS_CHANGED')
  need({str(Path(r['path']).relative_to(PKG.relative_to(ROOT))).replace('\\','/') for r in c['installedMembers']}==expected,'INSTALLED_INVENTORY_SET')
  with tarfile.open(fileobj=io.BytesIO(self.ref(c['archive']))) as archive:
   members=archive.getmembers()
   need(len(members)==94 and len({m.name.casefold() for m in members})==94,'ARCHIVE_MEMBER_COUNT')
   need({m.name for m in members}=={'package/'+name for name in expected},'ARCHIVE_MEMBER_SET')
   for member in members:
    need(member.isfile(),'ARCHIVE_NONFILE')
    name=member.name[8:];b=archive.extractfile(member).read()
    need(b==self.raw((PKG/name).relative_to(ROOT))==self.raw((SOURCE/name).relative_to(ROOT)),'ARCHIVE_SOURCE_INSTALLED_MISMATCH: '+name)
  for row in manifest['files']:
   b=self.raw((PKG/row['path']).relative_to(ROOT));need(len(b)==row['byteLength'] and sha(b)==row['sha256'],'MANIFEST_MEMBER_HASH')
  closure=self.data((PKG/'runtime/runtime-closure-manifest.json').relative_to(ROOT))
  need(len(closure['files'])==25 and c['sdkClosureFiles']==25,'SDK_COUNT')
  for row in closure['files']:
   b=self.raw((PKG/'runtime'/row['path']).relative_to(ROOT));need(len(b)==row['byteLength'] and sha(b)=='sha256:'+row['sha256'],'SDK_HASH')
  metadata=self.data((PKG/'package.json').relative_to(ROOT))
  need(metadata['name']=='memoryos-ci' and metadata['version']=='0.1.0' and not metadata.get('dependencies') and c['productionDependencies']==0,'PRODUCTION_DEPENDENCY')
  limits=self.data((PKG/'contracts/limits.json').relative_to(ROOT))['fixed']
  need(limits['helperMs']==2000 and limits['terminationMs']==2000 and limits['processCount']==3,'FROZEN_LIMIT_CHANGED')
  return c,manifest
 def observation(self,value,trace,manifest):
  need(value['clock']['observation']=='Node performance.now milliseconds; values only comparable within this process','CLOCK_DOMAIN_MIX')
  need(value['clock']['enforcement']=='Node performance.now and native setTimeout monotonic scheduling','ENFORCEMENT_CLOCK_CHANGED')
  events=value['events'];need(all(isinstance(e['atMs'],(float,int)) and math.isfinite(e['atMs']) for e in events),'EVENT_CLOCK_INVALID')
  need(all(a['atMs']<=b['atMs'] for a,b in zip(events,events[1:])),'EVENT_ORDER')
  def all_events(name):return [e for e in events if e['event']==name]
  def one(name):
   found=all_events(name);need(len(found)==1,'EVENT_COUNT: '+name);return found[0]
  arm=all_events('timerArmed')[0];mode=value['mode']
  need(arm['callbackSource']=="()=>stop(remaining<=2000?'OVERALL_TIMEOUT':'FILESYSTEM_BOUNDARY')",'TIMER_CALLBACK_CHANGED')
  delay=arm['requestedDelayMs']
  need(0<delay<=100 if mode=='remaining-overall-100ms' else delay==2000,'DEADLINE_RELAXED')
  need(close(arm['dueLowerMs'],arm['registrationBeforeMs']+delay) and close(arm['dueUpperMs'],arm['registrationAfterMs']+delay),'TIMER_DUE_MISMATCH')
  need(arm['registrationBeforeMs']<=arm['registrationAfterMs']<=arm['atMs'],'TIMER_REGISTRATION_ORDER')
  need(value['actualRequestedDelayMs']==delay,'DELAY_SUMMARY_MISMATCH')
  need(value['deadlineWindow']=={'lowerMs':arm['dueLowerMs'],'upperMs':arm['dueUpperMs']},'DUE_SUMMARY_MISMATCH')
  accepted=value['result']['accepted'];terminal=one('checkPathsResolved' if accepted else 'checkPathsRejected')
  need(value['terminalAtMs']==terminal['atMs'],'TERMINAL_SUMMARY_MISMATCH')
  late=accepted and terminal['atMs']>arm['dueUpperMs'];need(value['lateAccepted']==late,'LATE_SUMMARY_MISMATCH')
  spawn=one('spawnBefore');helper=self.raw((PKG/'scripts/check-paths.ps1').relative_to(ROOT))
  powershell=str(Path(os.environ['SystemRoot'])/'System32/WindowsPowerShell/v1.0/powershell.exe')
  need(spawn['executable'].lower()==powershell.lower(),'HELPER_EXECUTABLE_CHANGED')
  need(spawn['args']==['-NoProfile','-NonInteractive','-EncodedCommand',base64.b64encode(helper.decode().encode('utf-16le')).decode()],'HELPER_COMMAND_CHANGED')
  need(spawn['options']['shell'] is False and spawn['options']['windowsHide'] is True and set(spawn['options']['env'])=={'SystemRoot','WINDIR'},'HELPER_ENVIRONMENT_CHANGED')
  expected=[{'path':str(ROOT/'.cache/mo1306-phase3ar/node-v24.21.0-win-x64/node.exe'),'allowMissingLeaf':False},{'path':str(PKG),'allowMissingLeaf':False}]+[{'path':str(PKG/row['path']),'allowMissingLeaf':False} for row in manifest['files']]
  expected=expected[:48]
  if mode=='original-single-config':expected=[{'path':str(ROOT/'repositories/cca-conformance/fixtures/mo1306/evaluate-policy-pass/memoryos-ci.json'),'allowMissingLeaf':False}]
  need(value['paths']==expected,'ACTUAL_INPUT_CHANGED')
  request=one('stdinEnd');need(request['request']=={'kind':'MemoryOSCICDPathCheckRequest','paths':expected,'version':'1.0.0'},'REQUEST_CHANGED')
  # Production uses canonical sorted JSON and a trailing LF.
  request_bytes=encode(request['request']);need(sha(request_bytes)==request['sha256'] and len(request_bytes)==request['byteLength']<=16384,'REQUEST_HASH')
  closes=[e for e in events if e['event']=='childEventBefore' and e.get('name')=='close'];need(len(closes)==1,'CLOSE_COUNT');real_close=closes[0]
  need(value['closeAfterDue']==(real_close['atMs']>arm['dueUpperMs']),'CLOSE_SUMMARY_MISMATCH')
  need(value['filesystem']['initialNames']==value['filesystem']['settledNames']==[] and value['filesystem']['unchanged'] and not value['filesystem']['completeMarkerPresent'],'PUBLICATION_OR_FILES_CREATED')
  workspace=Path(value['filesystem']['workspace']);workspace.resolve().relative_to((ROOT/'.cache/mo1306-phase3ar-resolution').resolve());need(list(workspace.iterdir())==[],'WORKSPACE_CHANGED_AFTER_OBSERVATION')
  identities={'node':str(ROOT/'.cache/mo1306-phase3ar/node-v24.21.0-win-x64/node.exe'),'powershell':powershell,'conhost':str(Path(os.environ['SystemRoot'])/'System32/conhost.exe')}
  topology=validate_trace(trace,identities,PKG);need(topology['status']=='PASS','PROCESS_TOPOLOGY')
  need(trace['exitCode']==(2 if late else 0),'OBSERVER_EXIT_STATUS')
  need(timestamp(trace['utcStartOperationalOnly'])<=timestamp(trace['utcEndOperationalOnly']),'UTC_LABEL_ORDER')
  need(terminal['atMs']>=real_close['atMs'],'RESULT_BEFORE_CLOSE')
  result={'mode':mode,'accepted':accepted,'lateAccepted':late,'requestedDelayMs':delay,'timerDueUpperMs':arm['dueUpperMs'],'terminalMs':terminal['atMs'],'armThroughTerminalMs':terminal['atMs']-arm['registrationBeforeMs'],'peakProcessCount':trace['observation']['peakProcessCount'],'topology':topology}
  if accepted:
   stdout=''.join(e['text'] for e in all_events('stdoutData'));need(stdout=='{"kind":"MemoryOSCICDPathCheck","safe":true,"version":"1.0.0"}\n' and len(stdout.encode())<=1024,'REAL_HELPER_RESPONSE')
   need(real_close['args']==[0,None] and value['result']['code'] is None,'HELPER_STATUS')
  else:
   fire=[e for e in all_events('timerFire') if e['id']==arm['id']];need(len(fire)==1,'DEADLINE_DID_NOT_FIRE')
   kill=one('killBefore');reap=all_events('timerArmed')[1]
   need(fire[0]['atMs']<=kill['atMs']<=reap['atMs']<=real_close['atMs']<=terminal['atMs'],'TERMINATION_ORDER')
   need(reap['requestedDelayMs']==2000 and real_close['atMs']-kill['atMs']<=2000,'CLEANUP_ALLOWANCE')
   expected_code='MO1306_OVERALL_TIMEOUT' if mode=='remaining-overall-100ms' else 'MO1306_FILESYSTEM_BOUNDARY'
   need(terminal['code']==value['result']['code']==expected_code,'FAIL_CLOSED_CODE')
   result.update(timerCallbackLatenessMs=fire[0]['atMs']-arm['dueUpperMs'],killThroughCloseMs=real_close['atMs']-kill['atMs'])
  if mode=='boundary-close-delay':
   arrival=one('boundaryActualCloseArrived');begin=one('boundaryPauseBegin');end=one('boundaryPauseEnd');forward=one('boundaryCloseForwardedToProduct')
   clear=[e for e in all_events('timerClear') if e['id']==arm['id']];need(len(clear)==1,'BOUNDARY_TIMER_CLEAR')
   need(real_close['atMs']<=arrival['atMs']<=begin['atMs']<arm['dueUpperMs']<end['atMs']<=forward['atMs']<=clear[0]['atMs']<terminal['atMs'],'BOUNDARY_EVENT_ORDER')
   need(arrival['actualArgs']==forward['actualArgs']==real_close['args']==[0,None],'FABRICATED_CLOSE_ARGS')
   need(begin['plannedResumeNotBeforeMs']==arrival['plannedResumeNotBeforeMs']==arm['dueUpperMs']+50,'BOUNDARY_PAUSE_SCOPE')
   need(not all_events('timerFire') and not all_events('killBefore') and accepted and late,'BOUNDARY_NOT_DECISIVE')
   need('original helper may have physically exited before deadline' in value['scope'] and 'not helper kernel-runtime overrun' in value['scope'],'PHYSICAL_RUNTIME_OVERCLAIM')
   result.update(lateAcceptanceBeyondDueUpperMs=terminal['atMs']-arm['dueUpperMs'],actualCloseBeforeDueMs=arm['dueUpperMs']-real_close['atMs'],imposedPauseMs=end['imposedPauseMs'],physicalRuntimeOverrunEstablished=False)
  else:need(not late,'UNEXPECTED_LATE_SUCCESS')
  return result
 def original(self):
  initial=self.evidence('native/initial-audit.json');self.walk(initial)
  provenance=self.evidence('original-probe-transcript/provenance.json');self.walk(provenance)
  old=self.data((OLD/'github/raw-helper-timing.json').relative_to(ROOT))
  need(provenance['productDeadlineTimerPresent'] is False and provenance['historicalEvidenceModified'] is False,'HISTORICAL_TIMER_RESTAMP')
  need(provenance['engineeringSubprocessTimeoutSeconds']==5 and provenance['clock']=='time.monotonic()','ORIGINAL_PROBE_CLOCK')
  raw=self.ref(provenance['source']).decode();need('time.monotonic()' in raw and 'timeout=5' in raw and 'subprocess.run(' in raw,'ORIGINAL_PROBE_SOURCE')
  operation=initial['originalRawOperation']
  need(operation['productSupervisorInvoked'] is False and operation['product2000TimerInvoked'] is False,'ORIGINAL_PRODUCT_TIMER_CLAIM')
  need(operation['engineeringCapMs']==old['engineeringObservationCapMs']==5000 and operation['recordedElapsedMs']==old['elapsedMs'],'ORIGINAL_MEASUREMENT_CHANGED')
  return {'classification':'MEASUREMENT_DEFECT','recordedOuterElapsedMs':old['elapsedMs'],'productTimerInvoked':False,'helperPhysicalRuntimeKnown':False,'harnessOverheadQuantityKnown':False,'windowsCauseEstablished':False}
 def host(self):
  identity=self.evidence('host-events/host-clock-identity.json')
  old_environment=json.loads(self.ref(identity['originalEngineeringEnvironment']))
  need(identity['python']==old_environment['engineeringPython'],'PYTHON_IDENTITY_CHANGED')
  need(sha(Path(identity['python']['path']).read_bytes())==identity['python']['sha256'],'PYTHON_EXECUTABLE_CHANGED')
  need(identity['pythonClocks']['monotonic']['implementation']=='GetTickCount64()' and identity['pythonClocks']['monotonic']['resolution']==0.015625,'ORIGINAL_CLOCK_METADATA')
  need(identity['pythonClocks']['perf_counter']['implementation']=='QueryPerformanceCounter()' and identity['pythonClocks']['perf_counter']['monotonic'],'OBSERVER_CLOCK_METADATA')
  result=[]
  for name in ['host-events/original-native-module-path.json','host-events/focused-seven-observations.json']:
   report=self.evidence(name);self.walk(report);raw=json.loads(self.ref(report['source']))
   need(report['windowsSchedulingTransientProven'] is False,'UNSUPPORTED_WINDOWS_CAUSE')
   need(raw['eventLogsModified'] is False,'EVENT_LOG_MUTATION')
   system=next(log for log in raw['logs'] if log['log']=='System')
   need(system['status']=='READ' and not system['truncated'],'HOST_SYSTEM_COVERAGE')
   need(timestamp(system['oldestUtc'])<=timestamp(raw['queryStartUtc']) and timestamp(raw['collectedUtc'])>=timestamp(raw['queryEndUtc']),'HOST_WINDOW_COVERAGE')
   need(report['systemWindowRetained'] and report['transitionOrClockCandidateCount']==0 and report['candidateEventsIncludingPadding']==[],'HOST_EVENT_DISPOSITION')
   result.append({'report':name,'systemWindowRetained':True,'transitionCandidates':0,'causeEstablished':False,'unavailableOrDisabledLogs':report['unavailableOrDisabledLogs']})
  return result
 def optional_final(self):
  p=OUT/'execution-receipt.json'
  if p.exists():
   v=self.data(p.relative_to(ROOT));self.walk(v)
   need(v.get('status') in ['NATIVE_DEADLINE_BLOCKED','NATIVE DEADLINE BLOCKED'],'FALSE_CERTIFICATION')
   for key in ['releaseReady','nativeCertified','githubHostedCertified','completionCommitCreated']:
    if key in v:need(v[key] is False,'FALSE_SUCCESS_CLAIM: '+key)
  index=OUT/'evidence-index.json'
  if index.exists():
   value=self.data(index.relative_to(ROOT));self.walk(value)
   rows=value.get('files',value.get('entries'));need(isinstance(rows,list),'INDEX_SCHEMA')
   names={r['path'] for r in rows}
   expected={p.relative_to(ROOT).as_posix() for base in [OUT,HERE] for p in base.rglob('*') if p.is_file() and p!=index}
   need(names==expected,'CLOSED_INVENTORY_MISMATCH')
 def run(self):
  before=self.preserve_bytes();candidate,manifest=self.candidate();original=self.original();hosts=self.host()
  observations=[]
  for name in CAMPAIGNS:
   summary=self.evidence(name);self.walk(summary)
   need(summary['failure'] is None and summary['installedUnchanged'] is True,'CAMPAIGN_INCOMPLETE')
   need(summary['observationCount']==len(summary['observations']),'OBSERVATION_COUNT')
   preflight=self.data(str(Path(PREFIX+name).parent/'preflight.json'))
   need(len(preflight['installedBefore'])==94,'PREFLIGHT_MEMBER_COUNT')
   for r in preflight['installedBefore']:
    b=self.raw((PKG/r['path']).relative_to(ROOT));need(len(b)==r['byteLength'] and sha(b)==r['sha256'],'INSTALLED_AFTER_CHANGED')
   for item in summary['observations']:
    value=json.loads(self.ref(item['report']));trace=json.loads(self.ref(item['trace']));self.walk(trace)
    need(value['mode']==item['mode'] and value['result']==item['result'] and value['lateAccepted']==item['lateAccepted'],'OBSERVATION_RECEIPT_MISMATCH')
    observations.append(self.observation(value,trace,manifest))
  need(len(observations)==7,'SEVEN_OBSERVATIONS_REQUIRED')
  need([o['mode'] for o in observations]==['installation-first48']*3+['original-single-config','remaining-overall-100ms','external-supervisor-suspend','boundary-close-delay'],'OBSERVATION_SCOPE')
  need(sum(o['lateAccepted'] for o in observations)==1 and observations[-1]['lateAccepted'],'STOP_CONDITION_MISSING')
  diagnosis=self.evidence('native/timing-diagnosis.json');self.walk(diagnosis)
  validate_diagnosis(diagnosis)
  need(diagnosis['productionAuthority']==preservation.C3AB and diagnosis['blockedCheckpoint']==preservation.CHECKPOINT,'DIAGNOSIS_AUTHORITY')
  need(diagnosis['observationCount']==7 and len(diagnosis['observations'])==7,'DIAGNOSIS_OBSERVATION_COUNT')
  for stated,computed in zip(diagnosis['observations'],observations):
   raw=json.loads(self.ref(stated['rawReport']))
   need(stated['mode']==computed['mode'] and stated['accepted']==computed['accepted'] and stated['lateAccepted']==computed['lateAccepted'],'DIAGNOSIS_OBSERVATION_DRIFT')
   need(stated['requestedDelayMs']==computed['requestedDelayMs'] and stated['deadlineDueUpperMs']==computed['timerDueUpperMs'] and stated['terminalAtMs']==computed['terminalMs'],'DIAGNOSIS_TIMING_DRIFT')
   need(close(stated['terminalAfterDueUpperMs'],computed['terminalMs']-computed['timerDueUpperMs']),'DIAGNOSIS_CLOCK_MIX')
  boundary=diagnosis['boundaryFailure'];raw=json.loads(self.ref(diagnosis['observations'][-1]['rawReport']));events=raw['events']
  mapping={'actualCloseArrived':'boundaryActualCloseArrived','pauseBegin':'boundaryPauseBegin','pauseEnd':'boundaryPauseEnd','closeForwarded':'boundaryCloseForwardedToProduct','promiseResolved':'checkPathsResolved','actualHelperResponse':'stdoutData'}
  for key,event in mapping.items():need(boundary[key]==next(e for e in events if e['event']==event),'BOUNDARY_DIAGNOSIS_DRIFT: '+key)
  need(boundary['timer']==next(e for e in events if e['event']=='timerArmed'),'BOUNDARY_TIMER_DRIFT')
  need(boundary['actualHelperExit']==next(e for e in events if e['event']=='childEventBefore' and e.get('name')=='exit'),'BOUNDARY_EXIT_DRIFT')
  need(boundary['timerCleared']==next(e for e in events if e['event']=='timerClear' and e['id']==1),'BOUNDARY_CLEAR_DRIFT')
  need(close(boundary['observedPromiseAfterDueMs'],observations[-1]['lateAcceptanceBeyondDueUpperMs']),'BOUNDARY_LATE_SUMMARY')
  need(close(boundary['lateAcceptanceLowerBoundMs'],boundary['closeForwarded']['atMs']-boundary['timer']['dueUpperMs']),'BOUNDARY_LOWER_BOUND')
  need(diagnosis['original2032']['elapsedMs']==original['recordedOuterElapsedMs'],'ORIGINAL_DIAGNOSIS_RESTAMP')
  integrity=json.loads(self.ref(diagnosis['installedIntegrity']))
  need(integrity['status']=='PASS' and integrity['memberCount']==94 and len(integrity['members'])==94,'FINAL_INSTALLED_INTEGRITY')
  for r in integrity['members']:
   b=self.raw((PKG/r['path']).relative_to(ROOT));need(len(b)==r['byteLength'] and sha(b)==r['sha256'],'FINAL_INSTALLED_CHANGED')
  self.ref(integrity['before']);self.ref(integrity['distribution'])
  regression=json.loads(self.ref(diagnosis['regressionTests']));self.walk(regression)
  need(regression['status']=='PASS' and regression['testsRun']==9 and regression['failures']==regression['errors']==0,'ANALYSIS_REGRESSIONS')
  self.optional_final()
  return {'kind':'MemoryOSPhase3ARResolutionIndependentValidation','version':'1.0.0','status':'PASS','meaning':'The native blocking diagnosis and preservation are validated; this is not native or hosted certification.','resolutionStatus':'NATIVE_DEADLINE_BLOCKED','candidateAuthority':candidate['productAuthority'],'checkpoint':before['checkpoint'],'checkpointFilesPreserved':321,'packageMembers':94,'sdkClosureFiles':25,'productionDependencies':0,'oldObservation':original,'observations':observations,'hostReview':hosts,'nativeCertification':False,'hostedCertification':False,'completionCommitPermitted':False,'noFurtherBehaviorProbes':True,'validator':{'path':Path(__file__).relative_to(ROOT).as_posix(),'byteLength':len(Path(__file__).read_bytes()),'sha256':sha(Path(__file__).read_bytes())},'checkedFileCount':len(self.checked),'sources':[{'path':PREFIX+n,'byteLength':len(self.raw(PREFIX+n)),'sha256':sha(self.raw(PREFIX+n))} for n in ['candidate.json','preservation/before.json','native/timing-diagnosis.json']+CAMPAIGNS]}
def validate_diagnosis(value):
 need(value.get('classification')=='PRODUCT_DEADLINE_VIOLATION','FALSE_CERTIFICATION_OR_CLASSIFICATION')
 need(value.get('status')=='NATIVE_DEADLINE_BLOCKED' and value.get('certificationAllowed') is False,'FALSE_SUCCESS_STATUS')
 need(value['original2032']['classification']=='MEASUREMENT_DEFECT','ORIGINAL_MEASUREMENT_DISPOSITION_MISSING')
 need(value['original2032']['originalLifecycleTimingKnown'] is False and value['original2032']['productDeadlineCompliance']=='NOT_MEASURED' and value['original2032']['subtractedOverheadMs'] is None and value['original2032']['windowsCauseAttributed'] is False,'ORIGINAL_RUNTIME_OVERCLAIM')
 need(value['boundaryFailure']['helperKernelRuntimeOverrunClaim'] is False and value['boundaryFailure']['timeoutCallbackFired'] is False,'BOUNDARY_RUNTIME_OR_TIMER_OVERCLAIM')
 need(value['controlledPauseIsNotClaimedOriginalInterruption'] is True and value['windowsSchedulingTransientClaim'] is False,'UNSUPPORTED_HOST_ATTRIBUTION')
 need(value['frozenDeadline']['helperExecutionMs']==value['frozenDeadline']['cleanupReserveMs']==2000 and value['frozenDeadline']['valuesUnchanged'],'DEADLINE_CHANGED')
 need(value['productBytesUnchanged'] is True,'PRODUCTION_CHANGED')
 need(value['stopPolicy']=={'applied':True,'deadlineChanged':False,'fullNativeCampaignRun':False,'furtherProductExecutions':0,'productionEdited':False,'triggerObservation':7},'STOP_POLICY_NOT_APPLIED')
 for key in ['nativeCertified','releaseReady','hostedCertified','completionCommitCreated']:
  if key in value:need(value[key] is False,'FALSE_CERTIFICATION: '+key)
def negatives(audit,manifest):
 controls=[]
 def reject(name,fn):
  try:fn()
  except (AssertionError,ValueError,KeyError) as error:controls.append({'name':name,'status':'REJECTED','reason':str(error)});return
  raise AssertionError('NEGATIVE_ACCEPTED: '+name)
 candidate=audit.evidence('candidate.json')
 ref=candidate['archive'];reject('changed-archive-byte',lambda:Audit({ref['path']:audit.raw(ref['path'])[:-1]+b'X'}).ref(ref))
 stale=copy.deepcopy(ref);stale['sha256']='sha256:'+'0'*64;reject('stale-archive-reference',lambda:audit.ref(stale))
 lateitem=audit.evidence(CAMPAIGNS[-1])['observations'][0];value=json.loads(audit.ref(lateitem['report']));trace=json.loads(audit.ref(lateitem['trace']))
 mixed=copy.deepcopy(value);mixed['clock']['observation']='Python time.monotonic outer subprocess duration';reject('mix-python-outer-and-node-enforcement-clocks',lambda:audit.observation(mixed,trace,manifest))
 restated=copy.deepcopy(value);restated['lateAccepted']=False;reject('late-acceptance-restated-as-timely',lambda:audit.observation(restated,trace,manifest))
 delayed=copy.deepcopy(value);next(e for e in delayed['events'] if e['event']=='timerArmed')['requestedDelayMs']=2032;reject('relaxed-helper-deadline',lambda:audit.observation(delayed,trace,manifest))
 scope=copy.deepcopy(value);scope['scope']='Actual helper kernel runtime exceeded 2000ms';reject('controlled-pause-as-kernel-runtime-overrun',lambda:audit.observation(scope,trace,manifest))
 order=copy.deepcopy(value);next(e for e in order['events'] if e['event']=='boundaryCloseForwardedToProduct')['atMs']=0;reject('tampered-boundary-event-order',lambda:audit.observation(order,trace,manifest))
 false=audit.evidence('native/timing-diagnosis.json');false['classification']='FULLY_CERTIFIED';reject('false-certified-diagnosis',lambda:validate_diagnosis(false))
 oldpath=(OLD/'github/raw-helper-timing.json').relative_to(ROOT).as_posix();old=audit.data(oldpath);old['elapsedMs']=1999;reject('restamp-historical-2032-probe',lambda:Audit({oldpath:encode(old)}).preserve_bytes())
 return {'kind':'MemoryOSPhase3ARResolutionIndependentNegativeControls','status':'PASS','controls':controls,'controlCount':len(controls),'method':'All mutations were made in memory only; no evidence, installed file, production file, or process behavior was changed.'}
def main():
 parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
 audit=Audit();report=audit.run()
 # Verify current refs, indexes, graph, peer receipts, original391, and exact checkpoint Git blobs.
 result=subprocess.run([sys.executable,str(HERE/'preservation.py'),'--check'],capture_output=True,check=True,env={**os.environ,'PYTHONDONTWRITEBYTECODE':'1'},timeout=60)
 report['livePreservation']=json.loads(result.stdout);need(preservation.txt(ROOT,'rev-parse','HEAD')==preservation.CHECKPOINT,'FORBIDDEN_COMPLETION_COMMIT')
 need(preservation.git(ROOT,'diff','--name-only',preservation.C3AB,'--','repositories/memoryos-ci','.github/actions/memoryos-policy-gate')==b'','PRODUCTION_CHANGED')
 controls=negatives(audit,audit.data((PKG/'distribution-manifest.json').relative_to(ROOT)))
 if not args.check:
  for name,value in [('validation-negatives.json',controls),('validation.json',report)]:
   path=OUT/name;raw=encode(value)
   if path.exists():need(path.read_bytes()==raw,'IMMUTABLE_VALIDATION_EXISTS: '+name)
   else:path.write_bytes(raw)
 print(json.dumps({'status':'PASS','resolutionStatus':report['resolutionStatus'],'observations':len(report['observations']),'checkedFiles':report['checkedFileCount'],'negativeControls':controls['controlCount'],'readOnlyCheck':args.check}))
if __name__=='__main__':main()

