"""Fail-safe passive observer around exactly one scheduled certification command."""
import argparse,hashlib,json,subprocess,sys,time,traceback
from pathlib import Path
from datetime import datetime,timezone

ROOT=Path(__file__).resolve().parents[4]
TOOLS=Path(__file__).resolve().parent
E=ROOT/'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h3-corrected'
p=argparse.ArgumentParser()
p.add_argument('--output',type=Path,required=True);p.add_argument('--ready',type=Path,required=True)
p.add_argument('--cwd',type=Path,default=ROOT)
p.add_argument('--expected-exit',type=int,required=True);p.add_argument('--expected-helpers',type=int,default=9)
p.add_argument('command',nargs=argparse.REMAINDER)
a=p.parse_args();command=a.command[1:] if a.command and a.command[0]=='--' else a.command
assert len(command)>=2
assert hashlib.sha256(Path(sys.executable).read_bytes()).hexdigest()=='4278cf2a296f31737cae77cafeeb3dc71683094cf3b8fd6f3f02c968687e771c'
assert hashlib.sha256(Path(command[0]).read_bytes()).hexdigest()=='ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
for dest in (a.output.resolve(),a.ready.resolve()):assert dest.is_relative_to(E.resolve())
assert a.cwd.resolve().is_relative_to(ROOT.resolve()) and a.cwd.is_dir()

env={'SystemRoot':r'C:\Windows','WINDIR':r'C:\Windows'}
started=datetime.now(timezone.utc).isoformat();began=time.monotonic();engineering_guards=[]
driver=None;observer=None;code=None;observer_code=None
stop=a.output/'observer.stop';log=a.output/'process-observation.jsonl';receipt_path=a.output/'receipt.json'

def write_once(target,value):
    with target.open('x',encoding='utf-8',newline='\n') as stream:stream.write(json.dumps(value,indent=2)+'\n')

try:
    a.output.mkdir(parents=True,exist_ok=False);assert not a.ready.exists()
    with (a.output/'driver.stdout.data').open('xb') as out,(a.output/'driver.stderr.data').open('xb') as err,(a.output/'observer.stdout.data').open('xb') as oo,(a.output/'observer.stderr.data').open('xb') as oe:
        driver=subprocess.Popen(command,cwd=a.cwd.resolve(),env=env,stdin=subprocess.DEVNULL,stdout=out,stderr=err,creationflags=subprocess.CREATE_NO_WINDOW)
        write_once(a.output/'driver-launch.json',{'kind':'MO1307Phase3AR2FinalCertificationDriverLaunch','pid':driver.pid,'command':command,'cwd':str(a.cwd.resolve()),'semanticInvocations':1,'noRetry':True,'launchedAt':datetime.now(timezone.utc).isoformat()})
        observer=subprocess.Popen([sys.executable,'-I','-S','-B',str(TOOLS/'runtime-controls-observer.py'),'--pid',str(driver.pid),'--ready',str(a.ready),'--output',str(log),'--stop-file',str(stop),'--interval-ms','100','--timeout-seconds','60'],cwd=ROOT,env=env,stdin=subprocess.DEVNULL,stdout=oo,stderr=oe,creationflags=subprocess.CREATE_NO_WINDOW)
        while driver.poll() is None:
            if observer.poll() is not None:
                engineering_guards.append({'reason':'OBSERVER_ENDED_BEFORE_DRIVER','observerExit':observer.returncode,'action':'TERMINATE_EXACT_OWNED_DRIVER_HANDLE','pid':driver.pid})
                driver.kill();break
            if time.monotonic()-began>=45:
                engineering_guards.append({'reason':'ENGINEERING_DRIVER_GUARD','action':'TERMINATE_EXACT_OWNED_DRIVER_HANDLE','pid':driver.pid})
                driver.kill();break
            time.sleep(.05)
        code=driver.wait(timeout=5)
        time.sleep(.15)
        if not stop.exists():stop.write_text('predeclared command completed\n',encoding='utf-8')
        try:observer_code=observer.wait(timeout=10)
        except subprocess.TimeoutExpired:
            engineering_guards.append({'reason':'ENGINEERING_OBSERVER_GUARD','action':'TERMINATE_EXACT_OWNED_OBSERVER_HANDLE','pid':observer.pid})
            observer.kill();observer_code=observer.wait(timeout=5)

    records=[json.loads(line) for line in log.read_text(encoding='utf-8').splitlines()]
    finals=[row for row in records if row.get('event')=='observer_final']
    if not finals:raise RuntimeError('Observer has no final retained-handle receipt')
    final=finals[-1]
    lives=final['lifetimes'];helpers=[row for row in lives if row['role']=='helper'];consoles=[row for row in lives if row['role']=='console_host'];samples=[row for row in records if row['event']=='sample']
    if not samples:raise RuntimeError('Observer has no retained process samples')
    ready_clock=json.loads(a.ready.read_text(encoding='utf-8'))
    bootstrap_cutoff=ready_clock['nativeUtc100ns']
    clock_bridge=final['clockBridge']
    assert clock_bridge and clock_bridge['offsetLowerMs']<=clock_bridge['offsetUpperMs']
    bootstrap=[row for row in lives if row['role']=='other_descendant' and row['identity']['executable'].lower()==r'c:\windows\system32\conhost.exe' and row['parentIdentity']['pid']==driver.pid and row['identity']['creationTime100ns']<bootstrap_cutoff]
    unknown=[row for row in lives if row['role']=='other_descendant' and row not in bootstrap]
    maximum_raw=max(len(row['processes']) for row in samples)
    maximum_product=max(sum(item['role'] in ('supervisor','helper','console_host') for item in row['processes']) for row in samples)
    maximum_helpers=max(sum(item['role']=='helper' for item in row['processes']) for row in samples)
    maximum_consoles=max(sum(item['role']=='console_host' for item in row['processes']) for row in samples)
    max_product_rss=max(sum(item.get('memory',{}).get('workingSetSize',0) for item in row['processes'] if item['role'] in ('supervisor','helper','console_host')) for row in samples)
    max_raw_rss=max(sum(item.get('memory',{}).get('workingSetSize',0) for item in row['processes']) for row in samples)
    metric_unknown=sum(1 for row in samples for item in row['processes'] if item['role'] in ('supervisor','helper','console_host') and 'memory' not in item)
    overlap=[]
    for index,left in enumerate(helpers):
        for right in helpers[index+1:]:
            lt,rt=left['nativeTimes'],right['nativeTimes']
            if max(lt['creationTime100ns'],rt['creationTime100ns'])<min(lt['exitTime100ns'] or 2**63,rt['exitTime100ns'] or 2**63):overlap.append([left['identity'],right['identity']])
    pairs=[{'helper':helper,'consoles':[console for console in consoles if console['parentIdentity']==helper['identity']]} for helper in helpers]
    complete_known=len(helpers)==a.expected_helpers and len(consoles)<=a.expected_helpers and sum(len(row['consoles']) for row in pairs)==len(consoles) and all(len(row['consoles'])<=1 for row in pairs) and all(row['signaledAt'] is not None for row in lives)
    rejected_events=('candidate_identity_unknown','candidate_snapshot_identity_race','candidate_ancestry_unproven','candidate_bound_identity_contradiction','candidate_bound_identity_requery_rejected','candidate_pid_reuse_or_replacement','terminated_known_identity_rejected','snapshot_error','wait_error')
    observation_errors=[row for row in records if row['event'] in rejected_events]
    accepted_post=final['acceptedPostIdentityRequeryUnavailable'];accepted_terminated=final['acceptedTerminatedKnownIdentity']
    accepted_proofs=accepted_post+accepted_terminated
    accepted_consistent=(final['acceptedPostIdentityRequeryUnavailableCount']==len(accepted_post) and final['acceptedTerminatedKnownIdentityCount']==len(accepted_terminated) and all(row['decision']['accepted'] and all(row['decision']['checks'].values()) for row in accepted_proofs))
    passed=not engineering_guards and code==a.expected_exit and observer_code==0 and complete_known and not unknown and not overlap and maximum_product<=3 and maximum_helpers<=1 and maximum_consoles<=1 and metric_unknown==0 and max_product_rss<=536870912 and final['identityPolicy']=='MO1307_TOPOLOGY_IDENTITY_POLICY@1.0.0' and final['identityOrSnapshotFailures']==0 and final['unresolvedIdentityFailures']==0 and accepted_consistent and not observation_errors
    result={'kind':'MO1307Phase3AR2FinalAcceptedLifecycleObservation','result':'PASS' if passed else 'FAIL','started':started,'elapsedSeconds':time.monotonic()-began,'semanticInvocations':1,'driverStarted':True,'driverPid':driver.pid,'driverCwd':str(a.cwd.resolve()),'driverLaunch':'driver-launch.json','engineeringGuards':engineering_guards,'driverExit':code,'expectedExit':a.expected_exit,'observerPid':observer.pid,'observerExit':observer_code,'helperPairs':pairs,'expectedHelpers':a.expected_helpers,'optionalConsolePolicy':{'perHelperMinimum':0,'perHelperMaximum':1,'allIdentifiedMustSignal':True},'allKnownObjectsSignaled':all(row['signaledAt'] is not None for row in lives),'maximumRawProcesses':maximum_raw,'maximumProductRoles':maximum_product,'maximumHelpers':maximum_helpers,'maximumHelperConsoles':maximum_consoles,'engineeringBootstrapConsoles':bootstrap,'bootstrapBeforeProductEntry':True,'bootstrapCutoffNativeUtc100ns':str(bootstrap_cutoff),'clockBridge':clock_bridge,'unexplainedDescendants':unknown,'helperOverlap':overlap,'peakSampledProductWorkingSetBytes':max_product_rss,'peakSampledRawWorkingSetBytes':max_raw_rss,'missingProductMemorySamples':metric_unknown,'engineeringObservedRssCeilingBytes':536870912,'hardOsRssEnforcement':False,'sampleCount':final['sampleCount'],'maximumSampleGapMs':final['maximumSampleGapMs'],'samplingWorkSubtotalMs':final['samplingOverheadMs'],'identityPolicy':final['identityPolicy'],'observerSession':final['observerSession'],'identityOrSnapshotFailures':final['identityOrSnapshotFailures'],'unresolvedIdentityFailures':final['unresolvedIdentityFailures'],'acceptedPostIdentityRequeryUnavailableCount':final['acceptedPostIdentityRequeryUnavailableCount'],'acceptedPostIdentityRequeryUnavailable':accepted_post,'acceptedTerminatedKnownIdentityCount':final['acceptedTerminatedKnownIdentityCount'],'acceptedTerminatedKnownIdentity':accepted_terminated,'acceptedIdentityProofsConsistent':accepted_consistent,'observationErrors':observation_errors,'observerIntervalMs':100,'additionalSemanticExecutions':0,'noAutomaticRetry':True,'scope':'One scheduled final-certification B/ready/evaluate semantic invocation. Exactly one helper and zero or one console host per exchange are permitted by current headless authority; every identified object exit is proved by held handles. Qualified post-identity re-query unavailability is informational only when the exact validated policy proof passes. No process is terminated by observer. Node-parented console born before observer readiness and product entry is reported separately as engineering bootstrap; raw count retained. Worker thread serialization must additionally be verified from production supervisor events. Sampling may miss unknown short-lived descendants; measured overhead excludes serialization/flush.'}
    write_once(receipt_path,result)
    print(json.dumps({'result':result['result'],'semanticInvocations':1,'driverExit':code,'observedHelpers':len(helpers),'maxProductRoles':maximum_product,'maxRawProcesses':maximum_raw,'peakSampledProductRssBytes':max_product_rss}))
    raise SystemExit(0 if passed else 1)
except BaseException as error:
    if isinstance(error,SystemExit):raise
    cleanup=[]
    if driver is not None and driver.poll() is None:
        try:
            driver.kill();cleanup.append({'action':'TERMINATE_EXACT_OWNED_DRIVER_HANDLE','pid':driver.pid,'reason':'WRAPPER_FAILURE'})
        except BaseException as cleanup_error:cleanup.append({'driverKillError':str(cleanup_error)})
        try:driver.wait(timeout=5)
        except BaseException as cleanup_error:cleanup.append({'driverWaitError':str(cleanup_error)})
    if observer is not None and observer.poll() is None:
        try:
            if a.output.exists() and not stop.exists():stop.write_text('wrapper failure; no retry\n',encoding='utf-8')
            observer.wait(timeout=10)
        except subprocess.TimeoutExpired:
            try:
                observer.kill();cleanup.append({'action':'TERMINATE_EXACT_OWNED_OBSERVER_HANDLE','pid':observer.pid,'reason':'WRAPPER_FAILURE'})
            except BaseException as cleanup_error:cleanup.append({'observerKillError':str(cleanup_error)})
            try:observer.wait(timeout=5)
            except BaseException as cleanup_error:cleanup.append({'observerWaitError':str(cleanup_error)})
        except BaseException as cleanup_error:cleanup.append({'observerStopOrWaitError':str(cleanup_error)})
    failure={'kind':'MO1307Phase3AR2FinalAcceptedLifecycleObservation','result':'FAIL','started':started,'elapsedSeconds':time.monotonic()-began,'semanticInvocations':1 if driver is not None else 0,'driverStarted':driver is not None,'driverPid':driver.pid if driver is not None else None,'driverExit':driver.returncode if driver is not None else None,'observerPid':observer.pid if observer is not None else None,'observerExit':observer.returncode if observer is not None else None,'engineeringGuards':engineering_guards,'cleanup':cleanup,'failure':{'type':type(error).__name__,'message':str(error),'traceback':traceback.format_exc()},'additionalSemanticExecutions':0,'noAutomaticRetry':True}
    if a.output.exists() and not receipt_path.exists():write_once(receipt_path,failure)
    print(json.dumps({'result':'FAIL','semanticInvocations':failure['semanticInvocations'],'failure':failure['failure']}))
    raise SystemExit(1)
