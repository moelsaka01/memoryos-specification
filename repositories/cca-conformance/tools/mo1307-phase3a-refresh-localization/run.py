"""One fresh localizing evaluate, with sibling read-only native observer. No retries."""
import hashlib,json,subprocess,sys,time
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[4]
TOOLS=Path(__file__).resolve().parent
E=ROOT/'repositories/cca-conformance/evidence/mo1307/phase3a-refresh-localization'
OUT=E/'diagnostic-1'
NODE=Path(r'C:\Users\melsa\Documents\Codex\cca-workspace\.cache\mo1304-phase3-toolchain\node-v24.21.0-win-x64\node.exe')
assert hashlib.sha256(NODE.read_bytes()).hexdigest()=='ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
assert not OUT.exists()
OUT.mkdir()
ready,stop,log=(OUT/n for n in ['observer.ready.json','observer.stop','process-observation.jsonl'])
env={'SystemRoot':r'C:\Windows','WINDIR':r'C:\Windows'}
started=datetime.now(timezone.utc).isoformat()
ledger={'kind':'MO1307LocalizingExecutionStart','started':started,'execution':1,'maximumInstalledExecutions':2,'certificationRetry':False,'readOnlyObserverIntervalMs':50,'sources':{n:hashlib.sha256((TOOLS/n).read_bytes()).hexdigest() for n in ['run.py','diagnostic.mjs','common.mjs','process-observer.py']},'noRawFileContentsLogged':True}
(OUT/'execution-start.json').write_text(json.dumps(ledger,indent=2)+'\n',encoding='utf-8')
with (OUT/'driver.stdout.txt').open('xb') as out,(OUT/'driver.stderr.txt').open('xb') as err:
    driver=subprocess.Popen([str(NODE),str(TOOLS/'diagnostic.mjs'),str(ready)],cwd=ROOT,env=env,stdin=subprocess.DEVNULL,stdout=out,stderr=err,creationflags=subprocess.CREATE_NO_WINDOW)
    with (OUT/'observer.stdout.txt').open('xb') as obsout,(OUT/'observer.stderr.txt').open('xb') as obserr:
        observer=subprocess.Popen([sys.executable,'-B',str(TOOLS/'process-observer.py'),'--pid',str(driver.pid),'--ready',str(ready),'--output',str(log),'--stop-file',str(stop),'--interval-ms','50','--timeout-seconds','90'],cwd=ROOT,env=env,stdin=subprocess.DEVNULL,stdout=obsout,stderr=obserr,creationflags=subprocess.CREATE_NO_WINDOW)
        driver_code=driver.wait(timeout=75)
        time.sleep(.2)
        stop.write_text('diagnostic finished; finish process object observations\n',encoding='utf-8')
        observer_code=observer.wait(timeout=10)
receipt={'kind':'MO1307LocalizingExecutionWrapper','execution':1,'started':started,'finished':datetime.now(timezone.utc).isoformat(),'driverPid':driver.pid,'driverExit':driver_code,'observerPid':observer.pid,'observerExit':observer_code,'observerIntervalMs':50,'observerDerivative':'Only argument interval acceptance expands10..20 to10..100; invocation uses50ms. Original observer unchanged.','observerOverheadNote':'samplingOverheadMs is sampling-work subtotal excluding serialization/flush; not total scheduling impact.','nativeProductExecutions':1,'automaticRetries':0,'engineeringProductDeadlineChanges':False}
(OUT/'wrapper-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n',encoding='utf-8')
print(json.dumps(receipt))
raise SystemExit(0 if observer_code==0 and (OUT/'receipt.json').exists() else 1)
