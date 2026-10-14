"""Cheap integrated gates. Historical source tools and receipts stay immutable."""
from common import *
import shutil
preload=ROOT/'repositories/cca-conformance/tools/mo1306-phase2b/offline-preload.mjs'
suites=[('contracts','mo1306/contracts.test.mjs',152),('security','mo1306/security.test.mjs',37),('2a-ir-equivalence','mo1306/phase2a.test.mjs',2),('historical-B1','mo1306-phase2d/history.test.mjs',3),('gitlab-jenkins-api','mo1306-phase2b/adapters.test.mjs',466),('production-structure','mo1306-phase2c/generated-structure.test.mjs',39),('github-transport','mo1306-phase2c/github-transport.test.mjs',33)]
records=[]
for name,file,count in suites:
 record,_=command(name,[NODE,'--import',preload.as_uri(),'--test','--test-reporter=tap',TOOLS.parent/file],tests=count,timeout=90,env={**os.environ,**ENV});records.append(record)
for name,file in [('azure-github-api','adapter-contract.test.mjs'),('azure-generation','azure-render.mjs')]:
 record,_=command(name,[NODE,'--import',preload.as_uri(),TOOLS.parent/'mo1306-phase2c'/file]);records.append(record)
for name,args in [('structural',[sys.executable,'-B',TOOLS.parent/'mo1306/structural.py']),('workspace',[sys.executable,'-B','-X','utf8',ROOT/'tools/verify_workspace.py','--root',ROOT])]:
 record,_=command(name,args,env={**os.environ,**ENV});records.append(record)
record,_=command('mo1302',[NODE,'--test','--test-reporter=tap','--test-name-pattern=Action metadata, bootstrap exports|CLI transport accepts|PortablePath and action-input|outputs are exactly nineteen',ROOT/'repositories/cca-conformance/tests/mo1302_action_foundation_conformance_test.mjs'],tests=4,timeout=120,env={**os.environ,**ENV});records.append(record)
# Independent retained GitLab/Jenkins parser corpora are cheap and affected by
# the integrated generator/core context; their original evidence is preserved.
for module,count in [('test_gitlab',91),('test_jenkins',110)]:
 env={**os.environ,**ENV,'PYTHONPATH':os.pathsep.join([str(TOOLS.parent/'mo1306-phase2b'),str(ROOT/'.cache/mo1306/validators')])}
 record,stdout=command(module,[sys.executable,'-B','-m','unittest',module],env=env);records.append(record)
 stderr=(OUT/'commands'/(module+'.stderr.txt')).read_text();assert 'Ran '+str(count)+' tests' in stderr and 'OK' in stderr
# The pinned GitHub harness requires its validator path as an explicit authority.
validator=ROOT/'.cache/mo1306-phase2c/validators'
if not validator.exists():shutil.copytree(ROOT/'.cache/mo1306/validators',validator)
for name,args in [('azure-corpus',[sys.executable,'-B',TOOLS.parent/'mo1306-phase2c/test_azure.py']),('github-corpus',[sys.executable,'-B',TOOLS.parent/'mo1306-phase2c/test_github.py','--node',NODE])]:
 env={**os.environ,**ENV,'PYTHONPATH':str(validator)}
 record,_=command(name,args,env=env,timeout=120);records.append(record)
put('cheap-gates.json',{'status':'PASS','distributionDigest':sha((PKG/'distribution-manifest.json').read_bytes()),'gates':[{k:r[k] for k in ('id','status','exitCode','elapsedMs')} for r in records]})
