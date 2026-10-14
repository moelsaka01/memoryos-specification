"""Execute one predeclared H or I control stage. No retry and no semantic evaluation."""
import hashlib,json,subprocess,sys,time,traceback
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[4]
TOOLS=Path(__file__).resolve().parent
MODE=sys.argv[1] if len(sys.argv)==2 else None
assert MODE in ('H','I')
E=ROOT/'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h5-corrected'
DEST=E/('runtime-'+MODE)
CONFIG=json.loads((E/'campaign-config.json').read_text(encoding='utf-8'))
NODE=Path(CONFIG['nodeExecutable'])
assert hashlib.sha256(Path(sys.executable).read_bytes()).hexdigest()=='4278cf2a296f31737cae77cafeeb3dc71683094cf3b8fd6f3f02c968687e771c'
assert hashlib.sha256(NODE.read_bytes()).hexdigest()=='ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
if MODE=='I':
    assert json.loads((E/'runtime-H/external-proof.json').read_text(encoding='utf-8'))['result']=='PASS'
DEST.mkdir(parents=True,exist_ok=False)
ready=DEST/'observer.ready.json';stop=DEST/'observer.stop';log=DEST/'process-observation.jsonl'
env={'SystemRoot':r'C:\Windows','WINDIR':r'C:\Windows'}
started=datetime.now(timezone.utc).isoformat();began=time.monotonic()
if MODE=='I':ready.write_text('{"kind":"NO_EXTERNAL_SAMPLER_FOR_WORKER_STAGE"}\n',encoding='utf-8')
observer=None
driver=None
summary=None
try:
    with (DEST/'driver.stdout.data').open('xb') as out,(DEST/'driver.stderr.data').open('xb') as err:
        driver=subprocess.Popen([str(NODE),str(TOOLS/'runtime-controls.mjs'),MODE,str(ready)],cwd=ROOT,env=env,stdin=subprocess.DEVNULL,stdout=out,stderr=err,creationflags=subprocess.CREATE_NO_WINDOW)
        if MODE=='H':
            obsout=(DEST/'observer.stdout.data').open('xb');obserr=(DEST/'observer.stderr.data').open('xb')
            observer=subprocess.Popen([sys.executable,'-I','-S','-B',str(TOOLS/'runtime-controls-observer.py'),'--pid',str(driver.pid),'--ready',str(ready),'--output',str(log),'--stop-file',str(stop),'--interval-ms','50','--timeout-seconds','90'],cwd=ROOT,env=env,stdin=subprocess.DEVNULL,stdout=obsout,stderr=obserr,creationflags=subprocess.CREATE_NO_WINDOW)
        driver_bound=85 if MODE=='H' else 35
        while driver.poll() is None:
            if observer is not None and observer.poll() is not None:
                raise RuntimeError('Mandatory process observer ended before driver: '+str(observer.returncode))
            if time.monotonic()-began>=driver_bound:
                raise TimeoutError('Engineering control driver guard exceeded')
            time.sleep(.05)
        driver_code=driver.wait(timeout=5)
        if observer:
            time.sleep(.1);stop.write_text('driver complete\n',encoding='utf-8')
            observer_code=observer.wait(timeout=10);obsout.close();obserr.close()
        else:observer_code=None
    receipt=json.loads((DEST/'receipt.json').read_text(encoding='utf-8-sig'))
    summary={'kind':'MO1307Phase3AR2FinalControlWrapper','stage':MODE,'result':'PASS' if driver_code==0 and receipt['result']=='PASS' else 'FAIL','driverExit':driver_code,'observerExit':observer_code,'started':started,'elapsedSeconds':time.monotonic()-began,'driverPid':driver.pid,'noRetry':True,'semanticEvaluations':0}
    if MODE=='H':
        records=[json.loads(line) for line in log.read_text(encoding='utf-8').splitlines()]
        final=[r for r in records if r['event']=='observer_final'][-1]
        lives=final['lifetimes'];helpers=[r for r in lives if r['role']=='helper'];consoles=[r for r in lives if r['role']=='console_host']
        ready_clock=json.loads(ready.read_text(encoding='utf-8'))
        bootstrap_cutoff=ready_clock['nativeUtc100ns']
        bridge=final['clockBridge']
        assert bridge and bridge==receipt['clockBridge'] and bridge['offsetLowerMs']<=bridge['offsetUpperMs']
        bootstrap=[r for r in lives if r['role']=='other_descendant' and r['identity']['executable'].lower()==r'c:\windows\system32\conhost.exe' and r['parentIdentity']['pid']==driver.pid and r['identity']['creationTime100ns']<bootstrap_cutoff]
        unexplained=[r for r in lives if r['role']=='other_descendant' and r not in bootstrap]
        proof=[]
        for inv in receipt['invocations']:
            h=[r for r in helpers if r['identity']['pid']==inv['pid']]
            c=[r for r in consoles if h and r['parentIdentity']==h[0]['identity']]
            proof.append({'name':inv['name'],'ordinal':inv['ordinal'],'pid':inv['pid'],'protocolSequence':inv['protocolSequence'],'operation':inv['operation'],'fileCount':inv['fileCount'],'requestSha256':inv['requestSha256'],'responseSha256':inv.get('responseSha256'),'helperObjects':h,'consoleObjects':c,'helperObjectSignaled':len(h)==1 and h[0]['signaledAt'] is not None,'consoleObjectCount':len(c),'consoleObjectsWithinPolicy':len(c)<=1,'allIdentifiedConsoleObjectsSignaled':len(c)<=1 and all(x['signaledAt'] is not None for x in c),'transportClosed':inv.get('transportClosed',False),'killRequestedAt':inv['killRequestedAt'],'responseBytes':inv['stdoutBytes']})
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
                signaled_upper_ms=obj['signaledAt']['qpc']*1000/bridge['qpcFrequency']+bridge['offsetUpperMs'] if obj['signaledAt'] is not None else None
                native_times.append({'heldHandleSignaledUpperNodeMs':signaled_upper_ms,'role':role,'identity':obj['identity'],'exitTime100ns':str(raw_exit),'exitUnixMs':exit_unix_ms,'exitRelativeToTerminalMs':exit_unix_ms-terminal_unix_ms,'exitBeforeCleanupDeadline':raw_exit>0 and signaled_upper_ms is not None and signaled_upper_ms<=cleanup_deadline_ms,'cleanupMarginMs':cleanup_deadline_ms-signaled_upper_ms if signaled_upper_ms is not None else None,'heldHandleSignaled':obj['signaledAt'] is not None})
        closed=timeout_invocation['closedAt']
        stream_timing=[{**event,'beforeCleanupDeadline':event['at']<=cleanup_deadline_ms,'cleanupMarginMs':cleanup_deadline_ms-event['at']} for event in timeout_invocation['streamEvents'] if event['event']=='close']
        streams_within=len(stream_timing)==3 and {event['id'] for event in stream_timing}=={'stdin','stdout','stderr'} and all(event['beforeCleanupDeadline'] for event in stream_timing)
        timeout_native_policy=len(timeout['helperObjects'])==1 and len(timeout['consoleObjects'])<=1 and len(native_times) in (1,2)
        timeout_timing={'clockBridge':bridge,'nodeTimeOriginUnixMs':receipt['timeOrigin'],'terminalAtMs':terminal_ms,'cleanupDeadlineAtMs':cleanup_deadline_ms,'terminalUnixMs':terminal_unix_ms,'cleanupDeadlineUnixMs':deadline_unix_ms,'nativeObjects':native_times,'helperObjectCount':len(timeout['helperObjects']),'consoleObjectCount':len(timeout['consoleObjects']),'optionalConsolePolicy':{'minimum':0,'maximum':1,'allIdentifiedMustSignal':True},'streamClosures':stream_timing,'allThreeStreamsClosedBeforeCleanupDeadline':streams_within,'transportClosedAtMs':closed,'transportClosedBeforeCleanupDeadline':closed is not None and closed<=cleanup_deadline_ms,'transportCleanupMarginMs':cleanup_deadline_ms-closed if closed is not None else None,'killRequestedAtMs':timeout_invocation['killRequestedAt'],'result':'PASS' if streams_within and timeout_native_policy and all(t['exitBeforeCleanupDeadline'] and t['heldHandleSignaled'] for t in native_times) and closed is not None and closed<=cleanup_deadline_ms else 'FAIL','wallClockBridgeScope':'Acceptance uses conservative QPC held-handle signal upper bound mapped to Node performance via the measured ready/ack bracket. FILETIME/Unix fields are supplemental only; no UTC-clock acceptance or deadline grace.'}
        complete_product_assignment=len(helpers)==len(receipt['invocations']) and sum(len(p['consoleObjects']) for p in proof)==len(consoles)
        cleanup_pass=complete_product_assignment and all(p['helperObjectSignaled'] and p['consoleObjectsWithinPolicy'] and p['allIdentifiedConsoleObjectsSignaled'] and p['transportClosed'] for p in proof)
        all_signaled=all(r['signaledAt'] is not None for r in lives)
        rejected_events=('candidate_identity_unknown','candidate_snapshot_identity_race','candidate_ancestry_unproven','candidate_bound_identity_contradiction','candidate_bound_identity_requery_rejected','candidate_pid_reuse_or_replacement','terminated_known_identity_rejected','snapshot_error','wait_error')
        observation_errors=[r for r in records if r['event'] in rejected_events]
        accepted_post=final['acceptedPostIdentityRequeryUnavailable'];accepted_terminated=final['acceptedTerminatedKnownIdentity'];accepted_proofs=accepted_post+accepted_terminated
        accepted_consistent=(final['acceptedPostIdentityRequeryUnavailableCount']==len(accepted_post) and final['acceptedTerminatedKnownIdentityCount']==len(accepted_terminated) and all(r['decision']['accepted'] and all(r['decision']['checks'].values()) for r in accepted_proofs))
        summary.update({'timeoutCleanup':timeout,'timeoutCleanupTiming':timeout_timing,'allHelperProofs':proof,'completeProductObjectAssignment':complete_product_assignment,'optionalConsolePolicy':{'perHelperMinimum':0,'perHelperMaximum':1,'allIdentifiedMustSignal':True},'allKnownObjectsSignaled':all_signaled,'helperCount':len(helpers),'helperConsoleCount':len(consoles),'maximumRawRoles':maximum_raw,'maximumProductRoles':maximum_product,'engineeringBootstrapConsoles':bootstrap,'bootstrapBeforeProductEntry':True,'bootstrapCutoffNativeUtc100ns':str(bootstrap_cutoff),'clockBridge':bridge,'bootstrapAttributionScope':'Node-parented consoles created before observer readiness and any product supervisor or helper in the engineering waiting driver; retained separately, never silently removed from raw totals. These are not helper descendants.','unexplainedDescendants':unexplained,'helperOverlap':overlap,'sampleCount':final['sampleCount'],'maximumSampleGapMs':final['maximumSampleGapMs'],'samplingWorkSubtotalMs':final['samplingOverheadMs'],'identityPolicy':final['identityPolicy'],'observerSession':final['observerSession'],'identityOrSnapshotFailures':final['identityOrSnapshotFailures'],'unresolvedIdentityFailures':final['unresolvedIdentityFailures'],'acceptedPostIdentityRequeryUnavailableCount':final['acceptedPostIdentityRequeryUnavailableCount'],'acceptedPostIdentityRequeryUnavailable':accepted_post,'acceptedTerminatedKnownIdentityCount':final['acceptedTerminatedKnownIdentityCount'],'acceptedTerminatedKnownIdentity':accepted_terminated,'acceptedIdentityProofsConsistent':accepted_consistent,'observationErrors':observation_errors,'completeDescendantCoverageEstablished':False,'productCleanupFlagModified':False,'observerProcessTermination':False,'scope':'Held identified helper and optional console-host object handles prove their exit. Qualified post-identity re-query unavailability is informational only when every validated policy check passes; unresolved or contradictory identity evidence remains fail-closed. Production supervisor ownership and fixed-helper launch policy bind launched product roles. Sampling can miss unknown short-lived descendants.'})
        if timeout_timing['result']!='PASS' or observer_code!=0 or not cleanup_pass or not all_signaled or unexplained or overlap or maximum_product>3 or final['identityPolicy']!='MO1307_TOPOLOGY_IDENTITY_POLICY@1.0.0' or final['identityOrSnapshotFailures']!=0 or final['unresolvedIdentityFailures']!=0 or not accepted_consistent or observation_errors:summary['result']='FAIL'
    (DEST/'external-proof.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'stage':MODE,'result':summary['result'],'elapsedSeconds':summary['elapsedSeconds']}))
    raise SystemExit(0 if summary['result']=='PASS' else 1)


except Exception as error:
    guards=[]
    if driver is not None and driver.poll() is None:
        driver.kill()
        guards.append({'action':'TERMINATE_EXACT_OWNED_DRIVER_HANDLE','pid':driver.pid,'reason':'WRAPPER_FAILURE'})
        try:driver.wait(timeout=5)
        except Exception as cleanup_error:guards.append({'cleanupError':str(cleanup_error)})
    if observer is not None and observer.poll() is None:
        if not stop.exists():stop.write_text('driver or wrapper failed; no retry\n',encoding='utf-8')
        try:observer.wait(timeout=10)
        except subprocess.TimeoutExpired:
            observer.kill();guards.append({'action':'TERMINATE_EXACT_OWNED_OBSERVER_HANDLE','pid':observer.pid,'reason':'OBSERVER_CLEANUP_GUARD'})
            try:observer.wait(timeout=5)
            except Exception as cleanup_error:guards.append({'cleanupError':str(cleanup_error)})
    partial={'kind':'MO1307Phase3AR2C3VBPartialControlWrapper','stage':MODE,'result':'FAIL','failure':{'type':type(error).__name__,'message':str(error),'traceback':traceback.format_exc()},'driverPid':driver.pid if driver is not None else None,'driverExit':driver.returncode if driver is not None else None,'observerExit':observer.returncode if observer is not None else None,'elapsedSeconds':time.monotonic()-began,'engineeringGuards':guards,'noRetry':True,'semanticEvaluations':0,'partialSummary':summary}
    target=DEST/'external-proof.json'
    if not target.exists():
        with target.open('x',encoding='utf-8',newline='\n') as stream:stream.write(json.dumps(partial,indent=2)+'\n')
    else:
        with (DEST/'wrapper-failure.json').open('x',encoding='utf-8',newline='\n') as stream:stream.write(json.dumps(partial,indent=2)+'\n')
    print(json.dumps({'stage':MODE,'result':'FAIL','failure':str(error)}))
    raise SystemExit(1)
