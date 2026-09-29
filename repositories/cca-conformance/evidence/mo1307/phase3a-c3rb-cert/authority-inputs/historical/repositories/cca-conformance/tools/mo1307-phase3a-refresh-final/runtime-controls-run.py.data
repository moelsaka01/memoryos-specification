"""Execute one predeclared H or I control stage. No retry and no semantic evaluation."""
import hashlib,json,subprocess,sys,time
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[4]
TOOLS=Path(__file__).resolve().parent
MODE=sys.argv[1] if len(sys.argv)==2 else None
assert MODE in ('H','I')
E=ROOT/'repositories/cca-conformance/evidence/mo1307/phase3a-refresh-final'
DEST=E/('runtime-'+MODE)
NODE=Path(r'C:\Users\melsa\Documents\Codex\cca-workspace\.cache\mo1304-phase3-toolchain\node-v24.21.0-win-x64\node.exe')
assert hashlib.sha256(NODE.read_bytes()).hexdigest()=='ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
if MODE=='I':
    assert json.loads((E/'runtime-H/external-proof.json').read_text(encoding='utf-8'))['result']=='PASS'
DEST.mkdir(parents=True,exist_ok=False)
ready=DEST/'observer.ready.json';stop=DEST/'observer.stop';log=DEST/'process-observation.jsonl'
env={'SystemRoot':r'C:\Windows','WINDIR':r'C:\Windows'}
started=datetime.now(timezone.utc).isoformat();began=time.monotonic()
if MODE=='I':ready.write_text('{"kind":"NO_EXTERNAL_SAMPLER_FOR_WORKER_STAGE"}\n',encoding='utf-8')
observer=None
with (DEST/'driver.stdout.data').open('xb') as out,(DEST/'driver.stderr.data').open('xb') as err:
    driver=subprocess.Popen([str(NODE),str(TOOLS/'runtime-controls.mjs'),MODE,str(ready)],cwd=ROOT,env=env,stdin=subprocess.DEVNULL,stdout=out,stderr=err,creationflags=subprocess.CREATE_NO_WINDOW)
    if MODE=='H':
        obsout=(DEST/'observer.stdout.data').open('xb');obserr=(DEST/'observer.stderr.data').open('xb')
        observer=subprocess.Popen([sys.executable,'-B',str(TOOLS/'runtime-controls-observer.py'),'--pid',str(driver.pid),'--ready',str(ready),'--output',str(log),'--stop-file',str(stop),'--interval-ms','50','--timeout-seconds','80'],cwd=ROOT,env=env,stdin=subprocess.DEVNULL,stdout=obsout,stderr=obserr,creationflags=subprocess.CREATE_NO_WINDOW)
    driver_code=driver.wait(timeout=70 if MODE=='H' else 35)
    if observer:
        time.sleep(.1);stop.write_text('driver complete\n',encoding='utf-8')
        observer_code=observer.wait(timeout=10);obsout.close();obserr.close()
    else:observer_code=None
receipt=json.loads((DEST/'receipt.json').read_text(encoding='utf-8-sig'))
summary={'kind':'MO1307Phase3AFinalControlWrapper','stage':MODE,'result':'PASS' if driver_code==0 and receipt['result']=='PASS' else 'FAIL','driverExit':driver_code,'observerExit':observer_code,'started':started,'elapsedSeconds':time.monotonic()-began,'driverPid':driver.pid,'noRetry':True,'semanticEvaluations':0}
if MODE=='H':
    records=[json.loads(line) for line in log.read_text(encoding='utf-8').splitlines()]
    final=[r for r in records if r['event']=='observer_final'][-1]
    lives=final['lifetimes'];helpers=[r for r in lives if r['role']=='helper'];consoles=[r for r in lives if r['role']=='console_host']
    first_helper_birth=min(r['identity']['creationTime100ns'] for r in helpers)
    bootstrap=[r for r in lives if r['role']=='other_descendant' and r['identity']['executable'].lower()==r'c:\windows\system32\conhost.exe' and r['parentIdentity']['pid']==driver.pid and r['identity']['creationTime100ns']<first_helper_birth]
    unexplained=[r for r in lives if r['role']=='other_descendant' and r not in bootstrap]
    proof=[]
    for inv in receipt['invocations']:
        h=[r for r in helpers if r['identity']['pid']==inv['pid']]
        c=[r for r in consoles if h and r['parentIdentity']==h[0]['identity']]
        proof.append({'name':inv['name'],'ordinal':inv['ordinal'],'pid':inv['pid'],'helperObjects':h,'consoleObjects':c,'helperObjectSignaled':len(h)==1 and h[0]['signaledAt'] is not None,'consoleObjectSignaled':len(c)==1 and c[0]['signaledAt'] is not None,'transportClosed':inv.get('transportClosed',False),'killRequestedAt':inv['killRequestedAt'],'responseBytes':inv['stdoutBytes']})
    samples=[r for r in records if r['event']=='sample']
    maximum_raw=max(len(r['processes']) for r in samples)
    maximum_product=max(sum(p['role'] in ('supervisor','helper','console_host') for p in r['processes']) for r in samples)
    overlap=[]
    for i,a in enumerate(helpers):
        for b in helpers[i+1:]:
            at,bt=a['nativeTimes'],b['nativeTimes']
            if max(at['creationTime100ns'],bt['creationTime100ns'])<min(at['exitTime100ns'] or 2**63,bt['exitTime100ns'] or 2**63):overlap.append([a['identity'],b['identity']])
    timeout=next(p for p in proof if p['name']=='helper-timeout')
    timeout_case=next(c for c in receipt['cases'] if c['name']=='helper-timeout')
    timeout_invocation=next(i for i in receipt['invocations'] if i['name']=='helper-timeout')
    terminal_ms=timeout_case['snapshot']['terminalAt'];cleanup_deadline_ms=timeout_case['snapshot']['cleanupDeadline']
    assert cleanup_deadline_ms==terminal_ms+2000
    terminal_unix_ms=receipt['timeOrigin']+terminal_ms;deadline_unix_ms=receipt['timeOrigin']+cleanup_deadline_ms
    native_times=[]
    for role,objects in [('helper',timeout['helperObjects']),('console_host',timeout['consoleObjects'])]:
        for obj in objects:
            raw_exit=obj['nativeTimes']['exitTime100ns']
            exit_unix_ms=(raw_exit-116444736000000000)/10000.0
            native_times.append({'role':role,'identity':obj['identity'],'exitTime100ns':str(raw_exit),'exitUnixMs':exit_unix_ms,'exitRelativeToTerminalMs':exit_unix_ms-terminal_unix_ms,'exitBeforeCleanupDeadline':raw_exit>0 and exit_unix_ms<=deadline_unix_ms,'cleanupMarginMs':deadline_unix_ms-exit_unix_ms,'heldHandleSignaled':obj['signaledAt'] is not None})
    closed=timeout_invocation['closedAt']
    stream_timing=[{**event,'beforeCleanupDeadline':event['at']<=cleanup_deadline_ms,'cleanupMarginMs':cleanup_deadline_ms-event['at']} for event in timeout_invocation['streamEvents'] if event['event']=='close']
    streams_within=len(stream_timing)==3 and {event['id'] for event in stream_timing}=={'stdin','stdout','stderr'} and all(event['beforeCleanupDeadline'] for event in stream_timing)
    timeout_timing={'clockBridge':'Node performance.timeOrigin + production performance.now terminal/deadline to Unix ms; native GetProcessTimes FILETIME subtracts116444736000000000 ticks then divides10000. Held handles identify the exact exiting objects.','nodeTimeOriginUnixMs':receipt['timeOrigin'],'terminalAtMs':terminal_ms,'cleanupDeadlineAtMs':cleanup_deadline_ms,'terminalUnixMs':terminal_unix_ms,'cleanupDeadlineUnixMs':deadline_unix_ms,'nativeObjects':native_times,'streamClosures':stream_timing,'allThreeStreamsClosedBeforeCleanupDeadline':streams_within,'transportClosedAtMs':closed,'transportClosedBeforeCleanupDeadline':closed is not None and closed<=cleanup_deadline_ms,'transportCleanupMarginMs':cleanup_deadline_ms-closed if closed is not None else None,'killRequestedAtMs':timeout_invocation['killRequestedAt'],'result':'PASS' if streams_within and len(native_times)==2 and all(t['exitBeforeCleanupDeadline'] and t['heldHandleSignaled'] for t in native_times) and closed is not None and closed<=cleanup_deadline_ms else 'FAIL','wallClockBridgeScope':'Cross-clock comparison uses the recorded performance time origin and native Windows UTC FILETIME; no deadline grace is added.'}
    cleanup_pass=all(p['helperObjectSignaled'] and p['consoleObjectSignaled'] and p['transportClosed'] for p in proof)
    all_signaled=all(r['signaledAt'] is not None for r in lives)
    summary.update({'timeoutCleanup':timeout,'timeoutCleanupTiming':timeout_timing,'allHelperProofs':proof,'allKnownObjectsSignaled':all_signaled,'helperCount':len(helpers),'helperConsoleCount':len(consoles),'maximumRawRoles':maximum_raw,'maximumProductRoles':maximum_product,'engineeringBootstrapConsoles':bootstrap,'bootstrapAttributionScope':'Node-parented consoles created before the first product helper in the engineering waiting driver; retained separately, never silently removed from raw totals. These are not helper descendants.','unexplainedDescendants':unexplained,'helperOverlap':overlap,'sampleCount':final['sampleCount'],'maximumSampleGapMs':final['maximumSampleGapMs'],'samplingWorkSubtotalMs':final['samplingOverheadMs'],'identityOrSnapshotFailures':final['identityOrSnapshotFailures'],'observationErrors':[r for r in records if r['event'] in ('candidate_identity_unknown','candidate_snapshot_identity_race','candidate_ancestry_unproven','snapshot_error','wait_error')],'completeDescendantCoverageEstablished':False,'productCleanupFlagModified':False,'observerProcessTermination':False,'scope':'Held identified object handles prove their exit; production supervisor ownership and fixed-helper launch policy bind launched product roles. Sampling can miss unknown short-lived descendants.'})
    if timeout_timing['result']!='PASS' or observer_code!=0 or not cleanup_pass or not all_signaled or unexplained or overlap or maximum_product>3:summary['result']='FAIL'
(DEST/'external-proof.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'stage':MODE,'result':summary['result'],'elapsedSeconds':summary['elapsedSeconds']}))
raise SystemExit(0 if summary['result']=='PASS' else 1)

