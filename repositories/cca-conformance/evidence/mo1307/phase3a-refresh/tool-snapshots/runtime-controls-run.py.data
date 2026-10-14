"""One-shot wrapper: external observer and Node driver are sibling processes.
Fresh evidence paths only; no retries, product edits, network, or process termination."""
import hashlib, json, subprocess, sys, time
from pathlib import Path
from datetime import datetime, timezone
ROOT=Path(__file__).resolve().parents[4]
EVIDENCE=ROOT/'repositories/cca-conformance/evidence/mo1307/phase3a-refresh/runtime-controls'
TOOLS=Path(__file__).resolve().parent
NODE=Path(r'C:\Users\melsa\Documents\Codex\cca-workspace\.cache\mo1304-phase3-toolchain\node-v24.21.0-win-x64\node.exe')
EXPECTED='ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
assert hashlib.sha256(NODE.read_bytes()).hexdigest()==EXPECTED
assert sys.platform=='win32'
EVIDENCE.mkdir(parents=True,exist_ok=False)
ready=EVIDENCE/'observer.ready.json'
stop=EVIDENCE/'observer.stop'
log=EVIDENCE/'process-observation.jsonl'
env={'SystemRoot':r'C:\Windows','WINDIR':r'C:\Windows'}
start=time.monotonic()
started=datetime.now(timezone.utc).isoformat()
with (EVIDENCE/'driver.stdout.data').open('xb') as out,(EVIDENCE/'driver.stderr.data').open('xb') as err:
    driver=subprocess.Popen([str(NODE),str(TOOLS/'runtime-controls.mjs'),str(ready)],cwd=ROOT,env=env,stdin=subprocess.DEVNULL,stdout=out,stderr=err,creationflags=subprocess.CREATE_NO_WINDOW)
    with (EVIDENCE/'observer.stdout.data').open('xb') as obsout,(EVIDENCE/'observer.stderr.data').open('xb') as obserr:
        observer=subprocess.Popen([sys.executable,str(TOOLS/'runtime-controls-observer.py'),'--pid',str(driver.pid),'--ready',str(ready),'--output',str(log),'--stop-file',str(stop),'--interval-ms','10','--timeout-seconds','90'],cwd=ROOT,env=env,stdin=subprocess.DEVNULL,stdout=obsout,stderr=obserr,creationflags=subprocess.CREATE_NO_WINDOW)
        driver_code=driver.wait(timeout=85)
        time.sleep(.1)
        stop.write_text('one-shot driver completed\n',encoding='utf-8')
        observer_code=observer.wait(timeout=10)
records=[json.loads(line) for line in log.read_text(encoding='utf-8').splitlines()]
final=[r for r in records if r['event']=='observer_final'][-1]
receipt=json.loads((EVIDENCE/'receipt.json').read_text(encoding='utf-8-sig'))
lives=final['lifetimes']
helpers=[r for r in lives if r['role']=='helper']
consoles=[r for r in lives if r['role']=='console_host']
unknown=[r for r in lives if r['role']=='other_descendant']
maximum=max(len(r['processes']) for r in records if r['event']=='sample')
helper_proof=[]
for invocation in receipt['invocations']:
    known=[r for r in helpers if r['identity']['pid']==invocation['pid']]
    attached=[r for r in consoles if r['parentIdentity']['pid']==invocation['pid']]
    helper_proof.append({'name':invocation['name'],'ordinal':invocation['ordinal'],'pid':invocation['pid'],'helperObjects':known,'consoleHostObjects':attached,'allObjectsSignaled':len(known)==1 and bool(attached) and all(r['signaledAt'] is not None for r in known+attached),'transportClosed':invocation.get('transportClosed',False),'killRequestedAt':invocation['killRequestedAt']})
helper_overlap=[]
for i,a in enumerate(helpers):
    for b in helpers[i+1:]:
        at,bt=a['nativeTimes'],b['nativeTimes']
        if max(at['creationTime100ns'],bt['creationTime100ns'])<min(at['exitTime100ns'] or 2**63,bt['exitTime100ns'] or 2**63):
            helper_overlap.append([a['identity'],b['identity']])
all_cleanup=all(r['allObjectsSignaled'] and r['transportClosed'] for r in helper_proof)
timeout=next((r for r in helper_proof if r['name']=='helper-timeout'),None)
summary={'kind':'MO1307Phase3ARefreshRuntimeControlProof','started':started,'elapsedSeconds':time.monotonic()-start,'driverExit':driver_code,'observerExit':observer_code,'driverResult':receipt['result'],'result':'PASS' if driver_code==0 and observer_code==0 and all_cleanup and maximum<=3 and not unknown and not helper_overlap and final['identityOrSnapshotFailures']==0 else 'FAIL','nodeSha256':EXPECTED,'observerRuntime':{'executable':sys.executable,'version':sys.version,'sha256':hashlib.sha256(Path(sys.executable).read_bytes()).hexdigest()},'observerSourceSha256':hashlib.sha256((TOOLS/'runtime-controls-observer.py').read_bytes()).hexdigest(),'cleanupProof':{'timeout':timeout,'allInvocations':helper_proof,'allOwnedObjectsSignaled':all(r['signaledAt'] is not None for r in lives),'onlyPidAbsenceUsed':False,'processTerminationPerformedByObserver':False,'productCleanupFlagModified':False},'topology':{'maximumObservedProcessRoles':maximum,'helperCount':len(helpers),'consoleHostCount':len(consoles),'otherDescendants':unknown,'helperOverlap':helper_overlap,'maximumSamplingGapMs':final['maximumSampleGapMs'],'samplingOverheadMs':final['samplingOverheadMs'],'identityOrSnapshotFailures':final['identityOrSnapshotFailures'],'limitation':'Sampling cannot prove absence between samples; held handles prove identified object exit. Installed supervisor snapshots establish serialized helper/worker ownership.'},'noRetry':True}
(EVIDENCE/'external-proof.json').write_text(json.dumps(summary,indent=2)+'\n',encoding='utf-8')
print(json.dumps({'result':summary['result'],'elapsedSeconds':summary['elapsedSeconds'],'maximumRoles':maximum,'helpers':len(helpers),'consoles':len(consoles),'cleanup':all_cleanup}))
raise SystemExit(0 if summary['result']=='PASS' else 1)

