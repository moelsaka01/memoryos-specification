from pathlib import Path
import subprocess,json,time,sys
from materialize import ROOT,j,sha
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/predecessors';OUT.mkdir(exist_ok=True,parents=True)
NODE=ROOT/'.cache/mo1305-phase3br/toolchain/node-v24.21.0-win-x64/node.exe'
pins=[
 ('memoryos-1.3-mo1301','2cda15d8ab056ac8f2971c5cd9a22cb89fc4821e','af6a405b3cd9097ce469b16a854a0568b8acee1f'),
 ('memoryos-1.3-mo1302','773dd03829dd6b3632bf43a45578925b1498515d','7e07bd0db9ab10146f2e0e0bbd67a4c5850cf41d'),
 ('memoryos-1.3-mo1303','f3891cbac8a6ab804887a3d95a595c7bd1523af9','49aa80fa76bffc03e36335be8ab805bb5dc38f9c'),
 ('memoryos-1.3-mo1304','6d877151f0857006fcf12958f8b4c5bc662f43d6','ce7b001d911239fa50d904f5f336bb1bd7858ba3'),
 ('memoryos-1.3-mo1305','741e596454cfbcc908b8bd576b4fa97311139083','5955af062152a84c10de17860ba0bcabe8b3555f')]
for tag,obj,commit in pins:
 assert subprocess.check_output(['git','rev-parse',tag],cwd=ROOT,text=True).strip()==obj
 assert subprocess.check_output(['git','rev-parse',tag+'^{}'],cwd=ROOT,text=True).strip()==commit
paths=['.github/actions/memoryos-policy-gate','repositories/cca-studio','repositories/memoryos-cli','repositories/memoryos-mcp','repositories/memoryos-rest','repositories/cca-conformance/mo1301-conformance-inventory.json','repositories/cca-conformance/mo1305-conformance-inventory.json']
assert subprocess.check_output(['git','diff','3537b037e4ea70a726a249d7397f1df15daa2167','--',*paths],cwd=ROOT)==b''
(OUT/'immutable.json').write_bytes(j({'status':'PASS','tags':[{'tag':a,'object':b,'commit':c} for a,b,c in pins],'unchangedPaths':paths,'reuse':'Existing immutable predecessor artifacts retained. No claim that their old certification certifies MO-1306.'}))
(OUT/'initial-selection-timeout.json').write_bytes(j({'status':'INCOMPLETE','elapsedLimitMs':45000,'reason':'Initial combined selected test command exceeded the engineering deadline; subprocess.run terminated it. Partial stdout was not retained by that initial wrapper. No test PASS is inferred.','followUp':'Run only two small unaffected metadata/contract checks and reuse exact unchanged predecessor artifacts.'}))
for name,file,pattern in [
 ('mo1301-contract','mo1301_integration_conformance_test.mjs','all sixteen frozen machine|frozen Resource Profile|all 17 final CF6'),
 ('mo1302-contract','mo1302_action_foundation_conformance_test.mjs','Action metadata, bootstrap exports|CLI transport accepts')
]:
 argv=[str(NODE),'--test','--test-reporter=tap','--test-name-pattern='+pattern,str(ROOT/'repositories/cca-conformance/tests'/file)]
 start=time.perf_counter()
 try:
  r=subprocess.run(argv,cwd=ROOT,capture_output=True,text=True,encoding='utf-8',timeout=60)
  value={'id':name,'status':'PASS' if r.returncode==0 else 'FAIL','command':argv,'exitCode':r.returncode,'elapsedMs':round((time.perf_counter()-start)*1000),'stdout':r.stdout,'stderr':r.stderr}
 except subprocess.TimeoutExpired as e:
  value={'id':name,'status':'FAIL','command':argv,'exitCode':None,'elapsedMs':60000,'stdout':(e.stdout or b'').decode() if isinstance(e.stdout,bytes) else e.stdout,'stderr':'Bounded selected-test timeout'}
 (OUT/(name+'.json')).write_bytes(j(value));print(name,value['status'],flush=True);assert value['status']=='PASS'
