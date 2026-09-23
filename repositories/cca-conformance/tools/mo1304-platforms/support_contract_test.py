"""In-memory contract fixtures, not Windows execution evidence."""
import copy,json,sys
from pathlib import Path
from support_contract import POLICY,windows_environment,parity_contract
from validate_receipt import read_json,validate
from package_verify import identity
root=Path(sys.argv[1]);path=root/'repositories/cca-conformance/evidence/mo1304-phase3-ubuntu/ubuntu-receipt.json'
u=read_json(path,canonical_required=True)
assert identity(path.read_bytes())=={'byteLength':26935,'sha256':'afbbced0e1035cdacf9eafe26aba9391128e7def3940a569ce40c9b173029be0'}
assert validate(u,path.parent)['status']=='PASS'
w={k:copy.deepcopy(u[k]) for k in POLICY['parityEqualFields']}
w.update(platform='windows-11',supportedPlatform='Windows 11 x64',node={'version':'v24.21.0'},certifiedEnvironment={'os':'Windows 11','release':'25H2','build':'26200.9457','architecture':'x64','detected':{'caption':'Microsoft Windows 11 Pro','displayVersion':'25H2','buildNumber':'26200','ubr':9457,'architecture':'64-bit'}})
assert POLICY['ubuntu']=='Ubuntu 24.04 LTS x64' and POLICY['macos']=='UNSUPPORTED'
windows_environment(w);parity_contract([w,u])
# Different actual Windows 11 releases remain valid; the support family is not 25H2-only.
w24=copy.deepcopy(w);w24['certifiedEnvironment'].update(release='24H2',build='26100.1000');w24['certifiedEnvironment']['detected'].update(displayVersion='24H2',buildNumber='26100',ubr=1000);windows_environment(w24)
cases=[]
def reject(name,fn):
 try: fn()
 except (ValueError,KeyError,TypeError): cases.append(name)
 else: raise AssertionError('ACCEPTED: '+name)
def bad(name,mut):
 v=copy.deepcopy(w);mut(v);reject(name,lambda:windows_environment(v))
bad('Windows10',lambda v:v['certifiedEnvironment'].update(os='Windows 10'))
bad('Windows10 caption',lambda v:v['certifiedEnvironment']['detected'].update(caption='Microsoft Windows 10 Pro'))
bad('arm64',lambda v:v['certifiedEnvironment'].update(architecture='arm64'))
bad('missing release',lambda v:v['certifiedEnvironment'].pop('release'))
bad('empty release',lambda v:v['certifiedEnvironment'].update(release=''))
bad('missing build',lambda v:v['certifiedEnvironment'].pop('build'))
bad('empty build',lambda v:v['certifiedEnvironment'].update(build=''))
bad('mislabel 25H2 as 24H2',lambda v:v['certifiedEnvironment'].update(release='24H2'))
bad('wrong recorded build',lambda v:v['certifiedEnvironment'].update(build='26100.9457'))
bad('missing detected identity',lambda v:v['certifiedEnvironment'].pop('detected'))
bad('wrong Node',lambda v:v['node'].update(version='v24.20.0'))
bad('wrong archive',lambda v:v['candidate']['archive'].update(sha256='0'*64))
bad('obsolete support family',lambda v:v.update(supportedPlatform='Windows 11 24H2 x64'))
reject('missing Ubuntu',lambda:parity_contract([w]));reject('missing Windows',lambda:parity_contract([u]))
reject('duplicate Ubuntu',lambda:parity_contract([u,u]));reject('extra platform',lambda:parity_contract([u,w,w]))
m=copy.deepcopy(w);m['platform']='macos';reject('macOS substitution',lambda:parity_contract([u,m]))
for key in POLICY['parityEqualFields']:
 v=copy.deepcopy(w);v[key]=None;reject('mismatch '+key,lambda:parity_contract([u,v]))
print(json.dumps({'status':'PASS','scope':'SUPPORT_CONTRACT_FIXTURES_ONLY','negativeWitnesses':len(cases),'cases':cases,'ubuntuValidated':True,'windowsEvidenceCreated':False}))
