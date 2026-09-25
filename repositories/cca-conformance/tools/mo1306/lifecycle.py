from pathlib import Path
import json,sys,shutil,os
from materialize import ROOT,PKG,j,sha
sys.path.insert(0,str(Path(__file__).parent.parent/'mo1306-correction-a'))
from observe import execute
from trace import validate_trace
NODE=ROOT/'.cache/mo1305-phase3br/toolchain/node-v24.21.0-win-x64/node.exe'
HERE=Path(__file__).parent;OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/lifecycle';OUT.mkdir(exist_ok=True,parents=True)
WORK=ROOT/'.cache/mo1306/lifecycle';WORK.mkdir(exist_ok=False)
FIX=ROOT/'repositories/cca-conformance/fixtures/mo1306/evaluate-policy-pass'
env={'SystemRoot':os.environ['SystemRoot'],'WINDIR':os.environ['WINDIR']}
ids={'node':str(NODE),'powershell':str(Path(env['SystemRoot'])/'System32/WindowsPowerShell/v1.0/powershell.exe'),'conhost':str(Path(env['SystemRoot'])/'System32/conhost.exe')}
cases=[]
for mode,expected,worker in [
 ('semantic-failure','MO1306_SEMANTIC_VALIDATION',None),
 ('helper-failure','MO1306_FILESYSTEM_BOUNDARY',None),
 ('helper-cancel','MO1306_CANCELLED',None),
 ('worker-timeout','MO1306_TIMEOUT',"process.stdin.resume();setInterval(()=>{},1000);"),
 ('worker-cancel','MO1306_CANCELLED',"process.stdin.resume();setInterval(()=>{},1000);"),
 ('child-failure','MO1306_WORKER_EXIT',"process.exit(23);"),
 ('oversized-response','MO1306_WORKER_PROTOCOL',"process.stdin.resume();process.stdout.write('x'.repeat(24577));"),
]:
 package=PKG
 if worker:
  package=WORK/mode;shutil.copytree(PKG,package)
  (package/'src/worker.mjs').write_bytes(worker.encode())
  assert (package/'src/supervisor.mjs').read_bytes()==(PKG/'src/supervisor.mjs').read_bytes()
 result=execute([str(NODE),'--max-old-space-size=128',str(HERE/'lifecycle-driver.mjs'),mode,str(package),str(FIX)],ROOT,env=env,timeout=12)
 result['expected']=expected;result['faultInjection']=worker;result['supervisorSha256']=sha((PKG/'src/supervisor.mjs').read_bytes());result['helperBoundarySha256']=sha((PKG/'src/filesystem.mjs').read_bytes())
 try:
  assert result['exitCode']==0,result['stderr'];assert json.loads(result['stdout'])['result']==expected,result['stdout']
  result['topologyValidation']=validate_trace(result,ids,package)
  result['status']='PASS'
 except Exception as e:result['status']='FAIL';result['validationError']=str(e)
 (OUT/(mode+'.json')).write_bytes(j(result));cases.append({'id':mode,'status':result['status'],'expected':expected,'faultInjection':bool(worker),'elapsedMs':result['elapsedMs']})
 (OUT/'cases.json').write_bytes(j(cases));print(mode,result['status'],result.get('validationError',''),flush=True)
 assert result['status']=='PASS'
