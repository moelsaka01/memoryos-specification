"""Bounded Phase 2 input reconciliation; final advisory review stays in Phase 3."""
from common import *
import zipfile,platform
node_raw=NODE.read_bytes();assert len(node_raw)==93580104 and sha(node_raw)=='sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
archive=NODE.parent.parent/'node-v24.21.0-win-x64.zip'
assert archive.stat().st_size==37618919 and sha(archive.read_bytes())=='sha256:158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541'
_,raw=command('node-identity',[NODE,'-p','JSON.stringify({version:process.versions.node,architecture:process.arch,platform:process.platform})'])
node=json.loads(raw);assert node=={'version':'24.21.0','architecture':'x64','platform':'win32'}
assert sys.version_info[:3]==(3,12,14)
npm_root=NPM.parents[1];npm=json.loads((npm_root/'package.json').read_bytes());assert npm['version']=='11.19.0'
npm_record=ROOT/'repositories/cca-conformance/evidence/mo1306/npm-closure.json';closure=json.loads(npm_record.read_bytes())
assert closure['fileCount']==len(closure['files'])==1926
assert {p.relative_to(npm_root).as_posix() for p in npm_root.rglob('*') if p.is_file()}=={r['path'] for r in closure['files']}
for item in closure['files']:
 data=(npm_root/item['path']).read_bytes();assert len(data)==item['byteLength'] and sha(data)==item['sha256']
lock_path=ROOT/'repositories/cca-conformance/fixtures/mo1306/engineering-validator-lock.json';lock=json.loads(lock_path.read_bytes());assert len(lock['dependencies'])==7
assert lock_path.read_bytes()==subprocess.check_output(['git','show',B1+':'+lock_path.relative_to(ROOT).as_posix()],cwd=ROOT)
wheels=[]
for entry in lock['dependencies']:
 wheel=ROOT/'.cache/mo1306/wheels'/entry['filename'];raw=wheel.read_bytes();assert len(raw)==entry['byteLength'] and sha(raw)==entry['sha256']
 with zipfile.ZipFile(wheel) as zipped:
  members=[p for p in zipped.namelist() if not p.endswith('/')]
  for member in members:
   assert (ROOT/'.cache/mo1306/validators'/member).read_bytes()==zipped.read(member)
   assert (ROOT/'.cache/mo1306-phase2c/validators'/member).read_bytes()==zipped.read(member)
 wheels.append({**entry,'memberCount':len(members),'status':'PASS'})
 for notice in entry['notices']:assert (ROOT/notice).is_file()
# Exact upstream schema/parser/action inputs are the source-authorized bytes.
fixtures=ROOT/'repositories/cca-conformance/fixtures'
gitlab=fixtures/'mo1306/gitlab-ci-schema-a725331f22234d3078d7300944b9454da103e73c.json'
assert gitlab.stat().st_size==128034
assert sha(gitlab.read_bytes())=='sha256:a4dc2b155aa574575fbfd51dcca99388db5ba1b563ab5e05ce8df005e7eb9ced'
azure=fixtures/'mo1306-phase2c/azure/upstream/service-schema.json';assert azure.stat().st_size==1640523 and sha(azure.read_bytes())=='sha256:f00a9630f6550204148634d9a13f634b5750a225559886effe09a751482f0459'
parser=TOOLS.parent/'mo1306-phase2b/jenkins_validator.py';assert sha(parser.read_bytes())=='sha256:940bf6b9527bfb0da2ef491b057b8cab42e410344d0d8a3c7268fcbca36f5de0'
actions=json.loads((fixtures/'mo1306-phase2c/actions/inventory.json').read_bytes())
assert {(a['action'],a['revision']) for a in actions['actions']}=={('actions/checkout','3d3c42e5aac5ba805825da76410c181273ba90b1'),('actions/upload-artifact','043fb46d1a93c77aae656e7c1c64a875d1fc6a0a')}
for entry in actions['actions']:
 data=(ROOT/entry['path']).read_bytes();assert len(data)==entry['byteLength'] and sha(data).removeprefix('sha256:')==entry['sha256'].removeprefix('sha256:')
product=json.loads((PKG/'package.json').read_bytes());product_lock=json.loads((PKG/'package-lock.json').read_bytes());sbom=json.loads((PKG/'sbom.spdx.json').read_bytes())
assert not any(product.get(k) for k in ['dependencies','optionalDependencies','peerDependencies','scripts']) and list(product_lock['packages'])==['']
assert [(p['name'],p['versionInfo']) for p in sbom['packages']]==[('memoryos-ci','0.1.0'),('MemoryOS JavaScript SDK','1.1.0')]
assert (PKG/'sbom.spdx.json').read_bytes()==subprocess.check_output(['git','show',B1+':repositories/memoryos-ci/sbom.spdx.json'],cwd=ROOT)
rows=[row(p) for p in sorted(PKG.rglob('*')) if p.is_file() and (p.name in ('package.json','package-lock.json','sbom.spdx.json','README.md','NOTICES.md','LICENSE-NOTICE.md','runtime-closure-manifest.json') or 'templates' in p.parts or 'notices' in p.parts)]
put('supply-chain.json',{'status':'PASS','scope':'Bounded Phase 2 pin/closure/license/provenance reconciliation. No zero-vulnerability claim; fresh final reachable-risk/advisory review belongs to Phase 3B.','distributionDigest':sha((PKG/'distribution-manifest.json').read_bytes()),'node':{**node,**row(NODE)},'nodeArchive':row(archive),'npm':{'version':'11.19.0','fileCount':1926,'retainedClosure':row(npm_record)},'python':{'version':platform.python_version(),'executable':sys.executable},'wheels':wheels,'engineeringLock':row(lock_path),'gitlabSchema':{'commit':'a725331f22234d3078d7300944b9454da103e73c',**row(gitlab)},'azureSchema':{'commit':'9e40e814abd20917f273dd587497086f0476a563',**row(azure)},'jenkinsParser':row(parser),'actions':actions,'productInputs':rows,'sbomDisposition':'Unchanged component-level SBOM remains accurate: memoryos-ci 0.1.0 contains SDK 1.1.0, with no new external components. Current exact file identities are the integrated distribution and external Phase 2 inventory.','historicalReview':row(ROOT/'docs/mo1306-phase1-supply-chain-review.md')})
print('Phase 2 supply-chain reconciliation PASS',flush=True)
