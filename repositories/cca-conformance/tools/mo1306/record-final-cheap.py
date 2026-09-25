from pathlib import Path
import subprocess,time,json,hashlib,sys,os
from materialize import ROOT,PKG,j,sha
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/accepted-cheap';OUT.mkdir(exist_ok=False)
NODE=ROOT/'.cache/mo1305-phase3br/toolchain/node-v24.21.0-win-x64/node.exe'
python=sys.executable
commands=[
 ('structural',[python,'-B','-X','utf8','repositories/cca-conformance/tools/mo1306/structural.py']),
 ('contracts',[str(NODE),'--test','--test-reporter=tap','repositories/cca-conformance/tools/mo1306/contracts.test.mjs']),
 ('security',[str(NODE),'--test','--test-reporter=tap','repositories/cca-conformance/tools/mo1306/security.test.mjs']),
 ('affected-integrity',[str(NODE),'--max-old-space-size=128','repositories/cca-conformance/tools/mo1306/affected-integrity.mjs',str(ROOT/'.cache/mo1306/affected-integrity-final')]),
 ('predecessors',[str(NODE),'--test','--test-reporter=tap','--test-name-pattern=all sixteen frozen machine|frozen Resource Profile|all 17 final CF6|handoff vectors|Action metadata, bootstrap exports|CLI transport accepts|all six wrong decision/exit','repositories/cca-conformance/tests/mo1301_integration_conformance_test.mjs','repositories/cca-conformance/tests/mo1302_action_foundation_conformance_test.mjs']),
 ('workspace',[python,'-B','-X','utf8','tools/verify_workspace.py','--root','.'])
]
cases=[]
for name,argv in commands:
 start=time.perf_counter();r=subprocess.run(argv,cwd=ROOT,capture_output=True,text=True,encoding='utf-8',timeout=45)
 value={'id':name,'status':'PASS' if r.returncode==0 else 'FAIL','command':argv,'exitCode':r.returncode,'elapsedMs':round((time.perf_counter()-start)*1000),'stdout':r.stdout,'stderr':r.stderr,'harnessSha256':sha(Path(__file__).read_bytes()),'distributionDigest':sha((PKG/'distribution-manifest.json').read_bytes())}
 (OUT/(name+'.json')).write_bytes(j(value));cases.append({'id':name,'status':value['status'],'exitCode':r.returncode,'elapsedMs':value['elapsedMs']})
 print(name,value['status'],flush=True)
 if r.returncode:print(r.stdout,r.stderr,flush=True)
 assert r.returncode==0
(OUT/'cases.json').write_bytes(j(cases))
