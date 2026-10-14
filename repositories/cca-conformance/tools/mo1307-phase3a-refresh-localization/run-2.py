"""Second and final installed diagnostic: same metadata trace, external sampler absent."""
import hashlib,json,subprocess,sys
from pathlib import Path
from datetime import datetime,timezone
ROOT=Path(__file__).resolve().parents[4]
TOOLS=Path(__file__).resolve().parent
E=ROOT/'repositories/cca-conformance/evidence/mo1307/phase3a-refresh-localization'
OUT=E/'diagnostic-2'
NODE=Path(r'C:\Users\melsa\Documents\Codex\cca-workspace\.cache\mo1304-phase3-toolchain\node-v24.21.0-win-x64\node.exe')
assert hashlib.sha256(NODE.read_bytes()).hexdigest()=='ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
assert json.loads((E/'diagnostic-1/receipt.json').read_text())['result']=='DIAGNOSTIC_SUCCESS'
assert not OUT.exists()
question={'kind':'MO1307SecondExecutionQuestion','recordedAt':datetime.now(timezone.utc).isoformat(),'question':'Does the acquisition timeout recur, and at which request/clock, when identical metadata tracing remains but the external process sampler is removed to better match the original standalone execution conditions?','reason':'First diagnostic passed all nine requests; original failure request/clock remains unknown. External sampler recorded 4101.9998 ms sampling-work subtotal, excluding serialization/flush. Remove this specific observational difference while retaining request/clock evidence.','changedFactor':'External process sampler removed; metadata-only transport trace remains.','unchanged':['89 installed members','source production bytes','native helper and worker','semantic input root/bytes','native runtime and environment','5000/20000/30000/10000/2000 ms deadlines','same isolated product cwd'],'freshOutputRoot':str(ROOT/'.cache/m7r/vectors/v0/p/l2'),'firstDiagnosticReceiptSha256':hashlib.sha256((E/'diagnostic-1/receipt.json').read_bytes()).hexdigest(),'execution':2,'maximumInstalledEvaluations':2,'thirdExecutionForbidden':True,'certificationRetry':False,'onPass':'Stop at two. Preserve diagnostic successes and original blocked failure; do not infer original request or resume certification.','onFailure':'Use actual trace to identify current terminal request and clock; stop once sufficient for next action.','causationLimit':'One comparison cannot establish sampler or environment causation; cache/scheduling are uncontrolled.'}
with (E/'second-execution-question.json').open('x',encoding='utf-8') as f:f.write(json.dumps(question,indent=2)+'\n')
OUT.mkdir()
start={'kind':'MO1307LocalizingExecutionStart','started':datetime.now(timezone.utc).isoformat(),'execution':2,'externalSampler':False,'questionSha256':hashlib.sha256((E/'second-execution-question.json').read_bytes()).hexdigest(),'sources':{n:hashlib.sha256((TOOLS/n).read_bytes()).hexdigest() for n in ['run-2.py','diagnostic-2.mjs','common.mjs']}}
(OUT/'execution-start.json').write_text(json.dumps(start,indent=2)+'\n',encoding='utf-8')
env={'SystemRoot':r'C:\Windows','WINDIR':r'C:\Windows'}
with (OUT/'driver.stdout.txt').open('xb') as out,(OUT/'driver.stderr.txt').open('xb') as err:
    child=subprocess.Popen([str(NODE),str(TOOLS/'diagnostic-2.mjs')],cwd=ROOT,env=env,stdin=subprocess.DEVNULL,stdout=out,stderr=err,creationflags=subprocess.CREATE_NO_WINDOW)
    code=child.wait(timeout=75)
r={'kind':'MO1307LocalizingExecutionWrapper','execution':2,'started':start['started'],'finished':datetime.now(timezone.utc).isoformat(),'driverPid':child.pid,'driverExit':code,'externalProcessSampler':False,'nativeProductExecutionsThisWrapper':1,'totalInstalledExecutions':2,'automaticRetries':0,'thirdRunAllowed':False}
(OUT/'wrapper-receipt.json').write_text(json.dumps(r,indent=2)+'\n',encoding='utf-8')
print(json.dumps(r))
raise SystemExit(0 if (OUT/'receipt.json').exists() else 1)
