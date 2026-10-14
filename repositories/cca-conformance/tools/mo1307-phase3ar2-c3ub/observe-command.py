"""Passive sibling process observer around exactly one predeclared native command."""
import argparse,hashlib,json,subprocess,sys,time
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[4]
TOOLS=Path(__file__).resolve().parent
E=ROOT/'repositories/cca-conformance/evidence/mo1307/phase3ar2-c3ub'
p=argparse.ArgumentParser()
p.add_argument('--output',type=Path,required=True);p.add_argument('--ready',type=Path,required=True)
p.add_argument('--cwd',type=Path,default=ROOT)
p.add_argument('--expected-exit',type=int,required=True);p.add_argument('--expected-helpers',type=int,default=9)
p.add_argument('command',nargs=argparse.REMAINDER)
a=p.parse_args();command=a.command[1:] if a.command and a.command[0]=='--' else a.command
assert len(command)>=2
assert hashlib.sha256(Path(command[0]).read_bytes()).hexdigest()=='ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
for dest in (a.output.resolve(),a.ready.resolve()):assert dest.is_relative_to(E.resolve())
a.output.mkdir(parents=True,exist_ok=False);assert not a.ready.exists()
stop=a.output/'observer.stop';log=a.output/'process-observation.jsonl'
env={'SystemRoot':r'C:\Windows','WINDIR':r'C:\Windows'}
assert a.cwd.resolve().is_relative_to(ROOT.resolve()) and a.cwd.is_dir()
started=datetime.now(timezone.utc).isoformat();began=time.monotonic();engineeringGuards=[]
with (a.output/'driver.stdout.data').open('xb') as out,(a.output/'driver.stderr.data').open('xb') as err,(a.output/'observer.stdout.data').open('xb') as oo,(a.output/'observer.stderr.data').open('xb') as oe:
    driver=subprocess.Popen(command,cwd=a.cwd.resolve(),env=env,stdin=subprocess.DEVNULL,stdout=out,stderr=err,creationflags=subprocess.CREATE_NO_WINDOW)
    observer=subprocess.Popen([sys.executable,'-B',str(TOOLS/'runtime-controls-observer.py'),'--pid',str(driver.pid),'--ready',str(a.ready),'--output',str(log),'--stop-file',str(stop),'--interval-ms','100','--timeout-seconds','60'],cwd=ROOT,env=env,stdin=subprocess.DEVNULL,stdout=oo,stderr=oe,creationflags=subprocess.CREATE_NO_WINDOW)
    while driver.poll() is None:
        if observer.poll() is not None:
            engineeringGuards.append({'reason':'OBSERVER_ENDED_BEFORE_DRIVER','observerExit':observer.returncode,'action':'TERMINATE_EXACT_OWNED_DRIVER_HANDLE','pid':driver.pid})
            driver.kill();break
        if time.monotonic()-began>=45:
            engineeringGuards.append({'reason':'ENGINEERING_DRIVER_GUARD','action':'TERMINATE_EXACT_OWNED_DRIVER_HANDLE','pid':driver.pid})
            driver.kill();break
        time.sleep(.05)
    code=driver.wait(timeout=5)
    time.sleep(.15);stop.write_text('predeclared command completed\n',encoding='utf-8')
    try:observer_code=observer.wait(timeout=10)
    except subprocess.TimeoutExpired:
        engineeringGuards.append({'reason':'ENGINEERING_OBSERVER_GUARD','action':'TERMINATE_EXACT_OWNED_OBSERVER_HANDLE','pid':observer.pid})
        observer.kill();observer_code=observer.wait(timeout=5)
records=[json.loads(line) for line in log.read_text(encoding='utf-8').splitlines()] if log.exists() else []
if not any(r.get('event')=='observer_final' for r in records):
    failure={'kind':'MO1307Phase3AR2FinalAcceptedLifecycleObservation','result':'FAIL','driverPid':driver.pid,'driverExit':code,'observerPid':observer.pid,'observerExit':observer_code,'engineeringGuards':engineeringGuards,'failure':'Observer has no final retained-handle receipt','additionalSemanticExecutions':0,'noAutomaticRetry':True}
    (a.output/'receipt.json').write_text(json.dumps(failure,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(failure));raise SystemExit(1)
final=[r for r in records if r['event']=='observer_final'][-1]
lives=final['lifetimes'];helpers=[r for r in lives if r['role']=='helper'];consoles=[r for r in lives if r['role']=='console_host'];samples=[r for r in records if r['event']=='sample']
ready_clock=json.loads(a.ready.read_text(encoding='utf-8'))
bootstrap_cutoff=ready_clock['nativeUtc100ns']
clock_bridge=final['clockBridge']
assert clock_bridge and clock_bridge['offsetLowerMs']<=clock_bridge['offsetUpperMs']
bootstrap=[r for r in lives if r['role']=='other_descendant' and r['identity']['executable'].lower()==r'c:\windows\system32\conhost.exe' and r['parentIdentity']['pid']==driver.pid and r['identity']['creationTime100ns']<bootstrap_cutoff]
unknown=[r for r in lives if r['role']=='other_descendant' and r not in bootstrap]
maximum_raw=max(len(r['processes']) for r in samples)
maximum_product=max(sum(x['role'] in ('supervisor','helper','console_host') for x in r['processes']) for r in samples)
maximum_helpers=max(sum(x['role']=='helper' for x in r['processes']) for r in samples)
maximum_consoles=max(sum(x['role']=='console_host' for x in r['processes']) for r in samples)
max_product_rss=max(sum(x.get('memory',{}).get('workingSetSize',0) for x in r['processes'] if x['role'] in ('supervisor','helper','console_host')) for r in samples)
max_raw_rss=max(sum(x.get('memory',{}).get('workingSetSize',0) for x in r['processes']) for r in samples)
metric_unknown=sum(1 for r in samples for x in r['processes'] if x['role'] in ('supervisor','helper','console_host') and 'memory' not in x)
overlap=[]
for i,x in enumerate(helpers):
    for y in helpers[i+1:]:
        xt,yt=x['nativeTimes'],y['nativeTimes']
        if max(xt['creationTime100ns'],yt['creationTime100ns'])<min(xt['exitTime100ns'] or 2**63,yt['exitTime100ns'] or 2**63):overlap.append([x['identity'],y['identity']])
pairs=[{'helper':h,'consoles':[c for c in consoles if c['parentIdentity']==h['identity']]} for h in helpers]
complete_known=len(helpers)==a.expected_helpers and len(consoles)<=a.expected_helpers and sum(len(r['consoles']) for r in pairs)==len(consoles) and all(len(r['consoles'])<=1 for r in pairs) and all(r['signaledAt'] is not None for r in lives)
observation_errors=[r for r in records if r['event'] in ('candidate_identity_unknown','candidate_snapshot_identity_race','candidate_ancestry_unproven','snapshot_error','wait_error')]
passed=not engineeringGuards and code==a.expected_exit and observer_code==0 and complete_known and not unknown and not overlap and maximum_product<=3 and maximum_helpers<=1 and maximum_consoles<=1 and metric_unknown==0 and max_product_rss<=536870912 and final['identityOrSnapshotFailures']==0 and not observation_errors
result={'kind':'MO1307Phase3AR2FinalAcceptedLifecycleObservation','result':'PASS' if passed else 'FAIL','started':started,'elapsedSeconds':time.monotonic()-began,'driverPid':driver.pid,'driverCwd':str(a.cwd.resolve()),'engineeringGuards':engineeringGuards,'driverExit':code,'expectedExit':a.expected_exit,'observerPid':observer.pid,'observerExit':observer_code,'helperPairs':pairs,'expectedHelpers':a.expected_helpers,'optionalConsolePolicy':{'perHelperMinimum':0,'perHelperMaximum':1,'allIdentifiedMustSignal':True},'allKnownObjectsSignaled':all(r['signaledAt'] is not None for r in lives),'maximumRawProcesses':maximum_raw,'maximumProductRoles':maximum_product,'maximumHelpers':maximum_helpers,'maximumHelperConsoles':maximum_consoles,'engineeringBootstrapConsoles':bootstrap,'bootstrapBeforeProductEntry':True,'bootstrapCutoffNativeUtc100ns':str(bootstrap_cutoff),'clockBridge':clock_bridge,'unexplainedDescendants':unknown,'helperOverlap':overlap,'peakSampledProductWorkingSetBytes':max_product_rss,'peakSampledRawWorkingSetBytes':max_raw_rss,'missingProductMemorySamples':metric_unknown,'engineeringObservedRssCeilingBytes':536870912,'hardOsRssEnforcement':False,'sampleCount':final['sampleCount'],'maximumSampleGapMs':final['maximumSampleGapMs'],'samplingWorkSubtotalMs':final['samplingOverheadMs'],'identityOrSnapshotFailures':final['identityOrSnapshotFailures'],'observationErrors':observation_errors,'observerIntervalMs':100,'additionalSemanticExecutions':0,'noAutomaticRetry':True,'scope':'One already-authorized semantic invocation. Exactly one helper and zero or one console host per exchange are permitted by current headless authority; every identified object exit is proved by held handles. No process is terminated by observer. Node-parented console born before observer readiness and product entry is reported separately as engineering bootstrap; raw count retained. Worker thread serialization must additionally be verified from production supervisor events. Sampling may miss unknown short-lived descendants; measured overhead excludes serialization/flush.'}
(a.output/'receipt.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'result':result['result'],'driverExit':code,'observedHelpers':len(helpers),'maxProductRoles':maximum_product,'maxRawProcesses':maximum_raw,'peakSampledProductRssBytes':max_product_rss}))
raise SystemExit(0 if passed else 1)
