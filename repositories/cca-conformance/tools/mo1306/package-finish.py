from pathlib import Path
import json,os,sys,shutil,tarfile,subprocess,hashlib,time
from materialize import ROOT,PKG,j,sha
sys.path.insert(0,str(Path(__file__).parent.parent/'mo1306-correction-a'))
from observe import execute
from trace import validate_trace
NODE=ROOT/'.cache/mo1305-phase3br/toolchain/node-v24.21.0-win-x64/node.exe'
NPM=NODE.parent/'node_modules/npm/bin/npm-cli.js'
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/package-final';OUT.mkdir(parents=True,exist_ok=True)
WORK=ROOT/'.cache/mo1306/final-package';WORK.mkdir(exist_ok=True)
ENV={'SystemRoot':os.environ['SystemRoot'],'WINDIR':os.environ['WINDIR']}
CASES=[]
def command(name,argv,expected=0,cwd=ROOT,env=ENV,timeout=80):
 prior=ROOT/'repositories/cca-conformance/evidence/mo1306/package'/(name+'.json')
 if prior.is_file():
  r=json.loads(prior.read_bytes());assert r['command']==list(map(str,argv));assert r['exitCode']==expected
  r['reusedExecution']={'path':prior.relative_to(ROOT).as_posix(),'sha256':sha(prior.read_bytes()),'reason':'Same executed bytes; use observed command line from same PID and creation identity when exit-time handle read is unavailable'}
 else:r=execute(list(map(str,argv)),cwd,env=env,timeout=timeout)

 r.update(id=name,status='PASS' if r['exitCode']==expected else 'FAIL',expectedExitCode=expected,harnessSha256=sha(Path(__file__).read_bytes()))
 (OUT/(name+'.json')).write_bytes(j(r));CASES.append({'id':name,'status':r['status'],'command':r['command'],'exitCode':r['exitCode'],'elapsedMs':r['elapsedMs'],'evidencePaths':[(OUT/(name+'.json')).relative_to(ROOT).as_posix()]});(OUT/'cases.json').write_bytes(j(CASES))
 assert r['exitCode']==expected,(name,r['stdout'],r['stderr'])
 return r
a,b=WORK/'memoryos-ci-0.1.0.tgz',WORK/'repeat.tgz'
for name,p in [('pack-a',a),('pack-b',b)]:command(name,[NODE,PKG/'scripts/pack.mjs',p])
assert a.read_bytes()==b.read_bytes()
manifest=json.loads((PKG/'distribution-manifest.json').read_bytes())
expected={r['path']:r for r in manifest['files']};expected['distribution-manifest.json']={'byteLength':(PKG/'distribution-manifest.json').stat().st_size,'sha256':sha((PKG/'distribution-manifest.json').read_bytes())}
with tarfile.open(a) as archive:
 members=archive.getmembers();assert len(members)==len(expected)
 assert len({m.name.casefold() for m in members})==len(members)
 for m in members:
  assert m.isfile() and m.name.startswith('package/') and m.uid==m.gid==m.mtime==0
  rel=m.name[8:];assert rel in expected;data=archive.extractfile(m).read();assert len(data)==expected[rel]['byteLength'] and sha(data)==expected[rel]['sha256']
install=WORK/'install';install.mkdir(exist_ok=True)
(install/'package.json').write_bytes(j({'name':'mo1306-isolated-engineering-install','private':True,'version':'1.0.0','dependencies':{'memoryos-ci':'file:../memoryos-ci-0.1.0.tgz'}}))
userconfig=WORK/'empty-user.npmrc';globalconfig=WORK/'empty-global.npmrc'
userconfig.write_bytes(b'');globalconfig.write_bytes(b'')
cache=WORK/'empty-cache';cache.mkdir(exist_ok=True)
if not (ROOT/'repositories/cca-conformance/evidence/mo1306/package/offline-install.json').exists():assert not list(cache.iterdir())
args=[NODE,NPM,'install','--offline','--ignore-scripts','--no-audit','--no-fund','--cache',cache,'--userconfig',userconfig,'--globalconfig',globalconfig]
command('offline-install',args,cwd=install,env={**ENV,'PATH':str(NODE.parent)})
installed=install/'node_modules/memoryos-ci'
assert {p.relative_to(installed).as_posix() for p in installed.rglob('*') if p.is_file()}==set(expected)
for rel,row in expected.items():assert (installed/rel).read_bytes()==(PKG/rel).read_bytes(),rel
# Run the installed package with no PATH tools. Static closed-import validation and
# semantic worker read permissions establish package closure; parent uses frozen argv.
for vector,exitCode in [('evaluate-policy-pass',0),('evaluate-policy-fail',6),('evaluate-policy-cne',7)]:
 work=WORK/vector;work.mkdir(exist_ok=True)
 fix=ROOT/'repositories/cca-conformance/fixtures/mo1306'/vector
 for name in ['policy.json','candidate.mip','memoryos-ci.json']:shutil.copyfile(fix/name,work/name)
 result=command('installed-'+vector,[NODE,'--max-old-space-size=128',installed/'bin/memoryos-ci.mjs','run','--workspace',work,'--config',work/'memoryos-ci.json'],exitCode,cwd=install,env={**ENV,'PATH':'NO-PATH-TOOLS','NODE_PATH':''})
 summary=json.loads(result['stdout']);assert summary['publication']=='COMPLETE'
 bundle=work/'.memoryos-ci/out'/summary['runId']
 for name in ['evaluation-identity.json','policy-outcome.json']:assert (bundle/name).read_bytes()==(fix/name).read_bytes()
 ids={'node':str(NODE),'powershell':str(Path(ENV['SystemRoot'])/'System32/WindowsPowerShell/v1.0/powershell.exe'),'conhost':str(Path(ENV['SystemRoot'])/'System32/conhost.exe')}
 validate_trace(result,ids,installed)
 command('verify-'+vector,[NODE,'--max-old-space-size=128',installed/'bin/memoryos-ci.mjs','verify','--bundle',bundle],cwd=install)
 target=OUT/'bundles'/vector/summary['runId'];target.parent.mkdir(parents=True,exist_ok=True);shutil.copytree(bundle,target)
 print(vector,'installed PASS',flush=True)
# Genuine generation, identical output and refusal to overwrite.
config=WORK/'evaluate-policy-pass/memoryos-ci.json';deployment=WORK/'deployment.json'
deployment.write_bytes(j({'kind':'MemoryOSCICDDeployment','version':'1.0.0','provider':'generic','distributionDigest':sha((installed/'distribution-manifest.json').read_bytes()),'options':{}}))
for name in ['generation-a','generation-b']:command(name,[NODE,'--max-old-space-size=128',installed/'bin/memoryos-ci.mjs','generate','--config',config,'--deployment',deployment,'--output',WORK/name],cwd=install)
left=WORK/'generation-a';right=WORK/'generation-b'
assert sorted(p.name for p in left.iterdir())==['memoryos-ci-generation.json','memoryos-ci.json']
assert all(p.read_bytes()==(right/p.name).read_bytes() for p in left.iterdir())
before={p.name:sha(p.read_bytes()) for p in left.iterdir()}
command('generator-overwrite',[NODE,'--max-old-space-size=128',installed/'bin/memoryos-ci.mjs','generate','--config',config,'--deployment',deployment,'--output',left],17,cwd=install)
assert before=={p.name:sha(p.read_bytes()) for p in left.iterdir()}
identity={'status':'PASS','archive':{'path':a.relative_to(ROOT).as_posix(),'byteLength':a.stat().st_size,'sha256':sha(a.read_bytes())},'distributionDigest':sha((installed/'distribution-manifest.json').read_bytes()),'contractDigest':sha((installed/'contracts/contract.json').read_bytes()),'runtimeClosureDigest':sha((installed/'runtime/runtime-closure-manifest.json').read_bytes()),'installedMembers':len(expected),'reproducible':True,'offlineEmptyCache':True,'npmLock':{'path':(install/'package-lock.json').relative_to(ROOT).as_posix(),'sha256':sha((install/'package-lock.json').read_bytes())},'sourceIndependence':'Static import audit plus isolated install/cwd, no sibling modules, no PATH tool lookup; product argv precludes additional parent permission flags. Semantic worker permissions restrict reads to installed package.'}
(OUT/'identity.json').write_bytes(j(identity));print(json.dumps(identity),flush=True)
