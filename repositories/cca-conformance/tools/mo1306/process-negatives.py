from pathlib import Path
import sys,json,os,time,subprocess
from materialize import ROOT,PKG,j
sys.path.insert(0,str(Path(__file__).parent.parent/'mo1306-correction-a'))
from observe import execute,snapshot,details
from topology import validate
HERE=Path(__file__).parent;OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/lifecycle'
NODE=ROOT/'.cache/mo1305-phase3br/toolchain/node-v24.21.0-win-x64/node.exe'
env={'SystemRoot':os.environ['SystemRoot'],'WINDIR':os.environ['WINDIR']}
ids={'node':str(NODE),'powershell':str(Path(env['SystemRoot'])/'System32/WindowsPowerShell/v1.0/powershell.exe'),'conhost':str(Path(env['SystemRoot'])/'System32/conhost.exe')}
for count,code in [(3,'FOURTH_ATTRIBUTABLE_PROCESS')]:
 result=execute([str(NODE),str(HERE/'process-negatives.mjs'),str(count)],ROOT,env=env,timeout=10)
 rows=max(result['observation']['samples'],key=lambda s:len(s['processes']))['processes']
 try:validate(rows,result['rootPid'],ids,'semantic');failure=None
 except ValueError as e:failure=str(e)
 result.update(expectedRejection=code,observedRejection=failure,status='PASS' if failure==code and not result['cleanup']['remainingPids'] else 'FAIL')
 (OUT/('real-extra-'+str(count)+'.json')).write_bytes(j(result));print('real extra',count,result['status'],flush=True);assert result['status']=='PASS'
# Safely kill only the supervisor PID we create, while its exact helper is observed.
argv=[str(NODE),'--max-old-space-size=128',str(HERE/'lifecycle-driver.mjs'),'helper-failure',str(PKG),str(ROOT/'repositories/cca-conformance/fixtures/mo1306/evaluate-policy-pass')]
p=subprocess.Popen(argv,cwd=ROOT,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=subprocess.DETACHED_PROCESS|subprocess.CREATE_NEW_PROCESS_GROUP)
start=time.perf_counter();seen={};samples=[];killed=None
while time.perf_counter()-start<10:
 rows=snapshot(p.pid)
 for row in rows:seen[(row['pid'],row['creationTime100ns'])]=row
 samples.append({'elapsedMs':round((time.perf_counter()-start)*1000),'processes':rows})
 if killed is None and len(rows)==3:
  p.kill();killed=time.perf_counter()
 alive=[pid for (pid,created) in seen if (v:=details(pid)) and v['creationTime100ns']==created]
 if killed and not alive:break
 if killed and time.perf_counter()-killed>2:break
 time.sleep(.02)
stdout,stderr=p.communicate(timeout=2)
r={'command':argv,'rootPid':p.pid,'status':'PASS' if killed and not alive else 'FAIL','killedSupervisorOnly':bool(killed),'remainingPids':alive,'cleanupMs':round((time.perf_counter()-killed)*1000) if killed else None,'samples':samples,'stdout':stdout.decode(),'stderr':stderr.decode(),'exitCode':p.returncode,'limitation':'Forced termination externally observed; not a handled cancellation receipt.'}
(OUT/'parent-termination.json').write_bytes(j(r));print('parent termination',r['status'],r['cleanupMs'],alive,flush=True);assert r['status']=='PASS'
