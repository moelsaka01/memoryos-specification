"""Reproducible archive, fresh offline install and installed provider generation."""
from common import *
import shutil,tarfile,socket
sys.path[:0]=[str(TOOLS.parent/'mo1306-phase2b'),str(TOOLS.parent/'mo1306-phase2c'),str(ROOT/'.cache/mo1306/validators')]
from gitlab_validator import validate_gitlab
from jenkins_validator import validate_jenkins
from azure_validator import validate as validate_azure
from github_validator import validate_workflow
socket.create_connection=lambda *a,**kw:(_ for _ in ()).throw(AssertionError('offline provider validation'))
socket.socket.connect=socket.create_connection
FIX=ROOT/'repositories/cca-conformance/fixtures/mo1306'
work=CACHE/('package-'+uuid.uuid4().hex[:6]);work.mkdir()
archive=work/'memoryos-ci-0.1.0.tgz';repeat=work/'repeat.tgz'
for name,target in [('archive-a',archive),('archive-b',repeat)]:command(name,[NODE,PKG/'scripts/pack.mjs',target])
assert archive.read_bytes()==repeat.read_bytes()
expected={p.relative_to(PKG).as_posix():row(p,PKG) for p in PKG.rglob('*') if p.is_file()}
with tarfile.open(archive) as tar:
 members=tar.getmembers();assert len(members)==len(expected) and len({m.name.casefold() for m in members})==len(members)
 for member in members:
  assert member.isfile() and member.uid==member.gid==member.mtime==0 and member.name.startswith('package/')
  relative=member.name[8:];data=tar.extractfile(member).read();assert len(data)==expected[relative]['byteLength'] and sha(data)==expected[relative]['sha256']
install=work/'install';install.mkdir();cache=work/'empty-cache';cache.mkdir();assert not list(cache.iterdir())
(install/'package.json').write_bytes(j({'name':'mo1306-phase2d-offline-witness','version':'1.0.0','private':True,'dependencies':{'memoryos-ci':'file:../memoryos-ci-0.1.0.tgz'}}))
user=work/'user.npmrc';global_file=work/'global.npmrc';user.write_bytes(b'');global_file.write_bytes(b'')
command('offline-install',[NODE,NPM,'install','--offline','--ignore-scripts','--no-audit','--no-fund','--cache',cache,'--userconfig',user,'--globalconfig',global_file],cwd=install,env={**ENV,'PATH':str(NODE.parent)},timeout=120)
installed=install/'node_modules/memoryos-ci'
def inventory():return sorted((row(p,installed) for p in installed.rglob('*') if p.is_file()),key=lambda x:x['path'])
before=inventory();assert before==sorted(expected.values(),key=lambda x:x['path'])
put('installed-before.json',{'files':before,'packageRoot':str(installed)})
for vector,exit_code in [('evaluate-policy-pass',0),('evaluate-policy-fail',6),('evaluate-policy-cne',7)]:
 data=work/vector;data.mkdir()
 for filename in ('policy.json','candidate.mip','memoryos-ci.json'):shutil.copyfile(FIX/vector/filename,data/filename)
 record,output=command('installed-'+vector,[NODE,'--max-old-space-size=128',installed/'bin/memoryos-ci.mjs','run','--workspace',data,'--config',data/'memoryos-ci.json'],expected=exit_code,cwd=install,env={**ENV,'PATH':'NO-PATH-TOOLS'})
 summary=json.loads(output);assert summary['publication']=='COMPLETE' and summary['exitCode']==exit_code
 bundle=data/'.memoryos-ci/out'/summary['runId']
 for filename in ('evaluation-identity.json','policy-outcome.json'):assert (bundle/filename).read_bytes()==(FIX/vector/filename).read_bytes()
 command('installed-verify-'+vector,[NODE,'--max-old-space-size=128',installed/'bin/memoryos-ci.mjs','verify','--bundle',bundle],cwd=install,env={**ENV,'PATH':'NO-PATH-TOOLS'})
 target=OUT/'installed-bundles'/vector/summary['runId'];target.parent.mkdir(parents=True,exist_ok=True);shutil.copytree(bundle,target)
config=work/'evaluate-policy-pass/memoryos-ci.json';distribution=sha((installed/'distribution-manifest.json').read_bytes())
options={'generic':{},'gitlab':{'runnerTag':'MemoryOS_Windows'},'jenkins':{'agentLabel':'MemoryOS_Windows'},'azure':{'pool':'MemoryOS_Windows'},'github':{'repository':'moelsaka01/cca-workspace','toolRevision':SOURCES['2c'],'configPath':'repositories/cca-conformance/fixtures/mo1306/evaluate-policy-pass/memoryos-ci.json'}}
paths={'generic':None,'gitlab':'.gitlab-ci.yml','jenkins':'Jenkinsfile','azure':'azure-pipelines.yml','github':'.github/workflows/memoryos-ci.yml'}
providers=[]
for provider,settings in options.items():
 deployment={'kind':'MemoryOSCICDDeployment','version':'1.0.0','provider':provider,'distributionDigest':distribution,'options':settings}
 deploy=work/(provider+'-deployment.json');deploy.write_bytes(j(deployment));outputs=[]
 for index in (1,2):
  target=work/(provider+'-'+str(index))
  command('installed-generation-'+provider+'-'+str(index),[NODE,'--max-old-space-size=128',installed/'bin/memoryos-ci.mjs','generate','--config',config,'--deployment',deploy,'--output',target],cwd=install,env={**ENV,'PATH':'NO-PATH-TOOLS'})
  outputs.append({p.relative_to(target).as_posix():p.read_bytes() for p in target.rglob('*') if p.is_file()})
 assert outputs[0]==outputs[1]
 command('installed-no-overwrite-'+provider,[NODE,'--max-old-space-size=128',installed/'bin/memoryos-ci.mjs','generate','--config',config,'--deployment',deploy,'--output',work/(provider+'-1')],expected=17,cwd=install,env={**ENV,'PATH':'NO-PATH-TOOLS'})
 assert outputs[0]=={p.relative_to(work/(provider+'-1')).as_posix():p.read_bytes() for p in (work/(provider+'-1')).rglob('*') if p.is_file()}
 assert set(outputs[0])=={'memoryos-ci.json','memoryos-ci-generation.json'}|({paths[provider]} if paths[provider] else set())
 assert all(b'\r' not in data and data.endswith(b'\n') and not data.startswith(b'\xef\xbb\xbf') and data.decode('utf8').encode('utf8')==data for data in outputs[0].values())
 manifest=json.loads(outputs[0]['memoryos-ci-generation.json']);pin=manifest['configurationSha256'];artifact=outputs[0].get(paths[provider])
 if provider=='gitlab':validation=validate_gitlab(artifact,settings['runnerTag'],pin,distribution)
 elif provider=='jenkins':validation=validate_jenkins(artifact,settings['agentLabel'],pin,distribution)
 elif provider=='azure':validation=validate_azure(artifact,pin,distribution,settings['pool'])
 elif provider=='github':validation=validate_workflow(artifact,{'configurationDigest':pin,'deployment':deployment})
 else:validation={'provider':'generic','fileCount':2,'status':'PASS'}
 folder=OUT/'generated'/provider
 for filename,raw in outputs[0].items():
  target=folder/filename;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(raw)
 (folder/'deployment.fixture.json').write_bytes(j(deployment))
 providers.append({'provider':provider,'status':'PASS','deterministicFreshRoots':2,'noOverwriteExitCode':17,'validation':validation,'files':[row(folder/name,folder) for name in sorted(outputs[0])]})
after=inventory();assert before==after;put('installed-after.json',{'files':after,'packageRoot':str(installed)})
record,stdout=command('installed-import-audit',[NODE,TOOLS.parent/'mo1306/imports.mjs',installed],cwd=install,env={**ENV,'PATH':'NO-PATH-TOOLS'})
parsed=json.loads(stdout)
for entry in parsed['imports']:
 spec=entry['specifier']
 if spec.startswith('node:'):continue
 assert spec.startswith('.')
 target=(installed/entry['module']).parent/spec;assert target.resolve().is_relative_to(installed.resolve()) and target.is_file()
 assert not any(x in spec for x in ['.git','memoryos-cli','memoryos-rest','memoryos-mcp'])
put('package.json',{'status':'PASS','name':'memoryos-ci','version':'0.1.0','archive':row(archive),'memberCount':len(members),'productionDependencies':0,'runtimeClosureFiles':25,'reproducible':True,'offlineEmptyCache':True,'installRoot':str(install),'installedIntegrityUnchanged':True,'distributionDigest':distribution,'contractDigest':sha((PKG/'contracts/contract.json').read_bytes()),'runtimeClosureDigest':sha((PKG/'runtime/runtime-closure-manifest.json').read_bytes()),'providers':providers,'sourceIndependence':{'status':'PASS','imports':len(parsed['imports']),'scope':'Complete AST import audit and fresh isolated install/cwd with explicit verified Node and unavailable PATH tools; no checkout/sibling/developer module dependency. Semantic worker read permission remains installed package only.'},'lock':row(install/'package-lock.json'),'deploymentScope':'Generated GitHub definition is an offline contract fixture pinned to an existing source revision. Phase 3 must generate from the actual reviewed integrated I2/B2 tool revision and matching package pins; no fixture is claimed ready for hosted deployment.'})
print('Offline package/install/generation PASS',len(members),'members',flush=True)
