"""Closed, graph-aware Phase 2 acceptance verification; read-only by default."""
from common import *
import copy,functools,hashlib,re
sys.path.insert(0,str(ROOT/'.cache/mo1306/validators'))
from jsonschema import Draft202012Validator
BASE=ROOT/'repositories/cca-conformance'
INV=BASE/'mo1306-phase2-inventory.json'
BIND=OUT/'binding'
AUTH='33c0612e9ed03d714568354d2d7b2545344f95c1';F1='3537b037e4ea70a726a249d7397f1df15daa2167';F1A='769e277966868b819f6640d9456589523ee26ddf';I1='ff6608c2286a61e49547b3f4e63da91ffc9e82f2'
I2_SUBJECT='feat(memoryos-1.3): integrate MO-1306 CI/CD providers';B2_SUBJECT='conformance(memoryos-1.3): bind MO-1306 phase 2 integration'
LABELS={'generic':['IMPLEMENTED','REAL_EXECUTION_VALIDATED','FINAL_CERTIFICATION_PENDING'],'gitlab':['IMPLEMENTED','CONTRACT_VALIDATED','NOT_LIVE_PROVIDER_CERTIFIED'],'jenkins':['IMPLEMENTED','CONTRACT_VALIDATED','NOT_LIVE_PROVIDER_CERTIFIED'],'azure':['IMPLEMENTED','CONTRACT_VALIDATED','NOT_LIVE_PROVIDER_CERTIFIED'],'github':['IMPLEMENTED','HOSTED_EXECUTION_CERTIFICATION_PENDING']}
# These required gates are code-owned, never inferred from a receipt's claims.
GATES={
 'sources':{'source-graph-preservation':'source-inventory.json','corrected-2c-source-gate':'source-gate.json','historical-B1-conformance':'historical-conformance.json','historical-preservation':'preservation.json'},
 'contracts':{'integrated-cheap-gates':'cheap-gates.json','integrated-structure':'commands/integration-structure.json'},
 'execution':{'native-all-five':'native-execution.json','lifecycle':'lifecycle.json','provider-launchers':'launchers.json','github-wrapper':'github-wrapper.json','semantic-parity':'semantic-parity.json','integrated-security':'security.json','observer-chronology':'observer-correction.json','observer-live-snapshot':'observer-snapshot-test.json','console-owner-pid-reuse':'trace-owner-regression.json'},
 'package':{'package-offline-install':'package.json','supply-chain':'supply-chain.json'},
 'handoff':{'conformance-negatives':'conformance-tests.json','phase3-readiness':'handoff.json'}}
DEPS={'sources':[],'contracts':['sources'],'execution':['contracts'],'package':['contracts'],'handoff':['execution','package']}
SHA={'type':'string','pattern':'^sha256:[a-f0-9]{64}$'};REV={'type':['string','null'],'pattern':'^[a-f0-9]{40}$'}
def obj(properties):return {'type':'object','additionalProperties':False,'required':list(properties),'properties':properties}
def arr(items,minimum=0):return {'type':'array','minItems':minimum,'items':items}
ART=obj({'path':{'type':'string','minLength':1},'byteLength':{'type':'integer','minimum':0},'sha256':SHA})
IDS=obj({k:SHA for k in ['contract','distribution','runtimeClosure','archive']})
REF=obj({'id':{'enum':list(GATES)},'path':{'type':'string'},'sha256':SHA})
RECEIPT=obj({'kind':{'const':'MemoryOSCICDPhase2Receipt'},'version':{'const':'1.0.0'},'id':{'enum':list(GATES)},'status':{'const':'PASS'},'implementationRevision':REV,'identities':IDS,'artifacts':arr(ART,1),'cases':arr(obj({'id':{'type':'string'},'status':{'const':'PASS'},'evidencePaths':arr({'type':'string'},1)}),1),'requires':arr(obj({'receiptId':{'enum':list(GATES)},'sha256':SHA}))})
SCHEMA=obj({'kind':{'const':'MemoryOSCICDPhase2Inventory'},'version':{'const':'1.0.0'},'baseline':{'const':B1},'authorities':{'const':{'roadmap':AUTH,'freeze':F1,'correctionA':F1A,'I1':I1,'B1':B1}},'sources':{'const':SOURCES},'implementation':obj({'state':{'enum':['PRE_I2','BOUND']},'revision':REV,'parent':{'const':B1}}),'releaseState':{'enum':['PHASE_2_ACCEPTED_BINDING_PENDING','PHASE_2_COMPLETE_FINAL_CERTIFICATION_PENDING']},'identities':IDS,'providers':{'const':LABELS},'hostedExecuted':{'const':False},'platform':{'const':'windows-11-x64'},'requiredGates':{'const':GATES},'artifacts':arr(ART,1),'receipts':arr(REF,5),'phase3Interfaces':ART})
for schema in (SCHEMA,RECEIPT):schema['$schema']='https://json-schema.org/draft/2020-12/schema'
@functools.lru_cache(None)
def frozen_git(*args):return git(*args)
@functools.lru_cache(None)
def bytes_at(relative):
 path=Path(relative);assert not path.is_absolute() and '..' not in path.parts and '\\' not in relative,'ARTIFACT_PATH'
 p=ROOT/path;assert p.resolve().is_relative_to(ROOT.resolve()) and p.is_file() and not p.is_symlink(),'ARTIFACT_PATH'
 return p.read_bytes()
def read(relative):
 data=bytes_at(relative);assert len(data)<=2097152,'ENGINEERING_RECORD_LIMIT';return json.loads(data)
def relative(path):return path.relative_to(ROOT).as_posix()
def artifacts(rows):
 assert rows==sorted(rows,key=lambda r:r['path']),'ARTIFACT_ORDER'
 assert len({r['path'].casefold() for r in rows})==len(rows),'ARTIFACT_DUPLICATE'
 for r in rows:
  data=bytes_at(r['path']);assert len(data)==r['byteLength'] and sha(data)==r['sha256'],'ARTIFACT_DRIFT'
def validate(inv,receipts,*,allow_missing_selftest=False,post_b2=False):
 Draft202012Validator(SCHEMA).validate(inv)
 assert set(receipts)==set(GATES) and len(inv['receipts'])==len(GATES),'RECEIPT_SET'
 refs={r['id']:r for r in inv['receipts']};assert len(refs)==len(GATES),'RECEIPT_DUPLICATE'
 implementation=inv['implementation'];revision=implementation['revision']
 if implementation['state']=='PRE_I2':
  assert revision is None and inv['releaseState']=='PHASE_2_ACCEPTED_BINDING_PENDING','CANDIDATE_STATE'
  assert frozen_git('rev-parse','HEAD')==B1,'CANDIDATE_BASELINE'
 else:
  assert revision and frozen_git('show','-s','--format=%P',revision)==B1 and frozen_git('show','-s','--format=%s',revision)==I2_SUBJECT,'I2_GRAPH'
  assert inv['releaseState']=='PHASE_2_COMPLETE_FINAL_CERTIFICATION_PENDING','BOUND_STATE'
 for child,parent in [(F1,AUTH),(F1A,F1),(I1,F1A),(B1,I1),(SOURCES['2a'],B1),(SOURCES['2b-implementation'],B1),(SOURCES['2b'],SOURCES['2b-implementation']),(SOURCES['2c-original'],B1),(SOURCES['2c'],SOURCES['2c-original'])]:assert frozen_git('show','-s','--format=%P',child)==parent,'SOURCE_GRAPH'
 package=read(relative(OUT/'package.json'))
 expected={'contract':sha((PKG/'contracts/contract.json').read_bytes()),'distribution':sha((PKG/'distribution-manifest.json').read_bytes()),'runtimeClosure':sha((PKG/'runtime/runtime-closure-manifest.json').read_bytes()),'archive':package['archive']['sha256']}
 assert inv['identities']==expected,'PRODUCT_IDENTITIES'
 assert expected['runtimeClosure']=='sha256:f00fbd2b654ed3a845bce79334fb422a604d2e51294010c859ac08956330e424','RUNTIME_CLOSURE'
 archive=ROOT/package['archive']['path'];assert archive.is_relative_to(CACHE) and row(archive)==package['archive'],'ARCHIVE_IDENTITY'
 capabilities=read('repositories/cca-conformance/mo1306-phase2-capabilities.json')
 assert capabilities['validationState']=='VALIDATED' and capabilities['labels']==LABELS,'CAPABILITY_CLAIMS'
 assert set(capabilities)=={'kind','version','baseline','phase','providers','validationState','labels'} and capabilities['kind']=='MemoryOSCICDPhase2Capabilities' and capabilities['version']=='1.0.0' and capabilities['baseline']==B1 and capabilities['phase']=='2D','CAPABILITY_AUTHORITY'
 provider_paths={'generic':None,'gitlab':'.gitlab-ci.yml','jenkins':'Jenkinsfile','azure':'azure-pipelines.yml','github':'.github/workflows/memoryos-ci.yml'}
 assert capabilities['providers']=={p:{'artifact':provider_paths[p],'certification':LABELS[p][-1],'implementation':'IMPLEMENTED'} for p in LABELS},'CAPABILITY_PROVIDER_SET'
 required_counts={'contracts':152,'security':37,'2a-ir-equivalence':2,'historical-B1':3,'gitlab-jenkins-api':466,'production-structure':39,'github-transport':33,'mo1302':4,'integration-structure':47,'legacy-launcher-verifier':67}
 for name,count in required_counts.items():
  command_record=read(relative(OUT/'commands'/(name+'.json')))
  assert command_record['status']=='PASS' and command_record['counts']=={'tests':count,'pass':count,'fail':0,'cancelled':0,'skipped':0,'todo':0},'REQUIRED_TAP_COUNTS'

 artifacts(inv['artifacts'])
 if revision:
  required_paths=set(frozen_git('diff','--name-only',B1,revision).splitlines())
 else:
  required_paths=set(git('diff','--name-only',B1).splitlines())|set(git('ls-files','--others','--exclude-standard').splitlines())
 required_paths|={relative(p) for p in PKG.rglob('*') if p.is_file()}
 required_paths|={'docs/mo1306-provider-neutral-cicd.md','docs/mo1306-contract-freeze-1.md','docs/mo1306-contract-freeze-1-process-correction.md','repositories/cca-conformance/mo1306-phase2-interfaces.json'}
 required_paths={p for p in required_paths if p and p!=relative(INV) and not p.startswith(relative(BIND)+'/')}
 assert {r['path'] for r in inv['artifacts']}==required_paths,'INTEGRATION_ARTIFACT_CLOSURE'
 union={};case_count=0
 for identity,receipt in receipts.items():
  Draft202012Validator(RECEIPT).validate(receipt)
  assert receipt['id']==identity and receipt['implementationRevision']==revision and receipt['identities']==expected,'RECEIPT_BINDING'
  assert refs[identity]['path']==relative(BIND/(identity+'.json')),'RECEIPT_PATH'
  assert refs[identity]['sha256']==sha(j(receipt)),'RECEIPT_HASH'
  artifacts(receipt['artifacts']);paths={r['path'] for r in receipt['artifacts']}
  for r in receipt['artifacts']:assert r['path'] not in union or union[r['path']]==r,'ARTIFACT_CONFLICT';union[r['path']]=r
  assert {c['id'] for c in receipt['cases']}==set(GATES[identity]) and len(receipt['cases'])==len(GATES[identity]),'REQUIRED_CASE_OMITTED'
  for case in receipt['cases']:
   expected_path=relative(OUT/GATES[identity][case['id']]);assert case['evidencePaths']==[expected_path] and expected_path in paths,'CASE_EVIDENCE_BINDING'
   if allow_missing_selftest and case['id']=='conformance-negatives':continue
   evidence=read(expected_path);assert evidence['status']=='PASS','FALSE_PASS'
   if 'distributionDigest' in evidence:assert evidence['distributionDigest']==expected['distribution'],'STALE_EVIDENCE'
   case_count+=1
  assert [r['receiptId'] for r in receipt['requires']]==DEPS[identity],'RECEIPT_DEPENDENCIES'
  for dependency in receipt['requires']:assert dependency['sha256']==refs[dependency['receiptId']]['sha256'],'REUSE_HASH'
 assert union=={r['path']:r for r in inv['artifacts']},'INVENTORY_OMISSION_OR_EXTRA'
 # Dependencies are closed above; retain a generic cycle check as well.
 def visit(node,active,done):
  assert node not in active,'CYCLIC_RECEIPTS'
  if node in done:return
  for dependency in receipts[node]['requires']:visit(dependency['receiptId'],active|{node},done)
  done.add(node)
 done=set()
 for node in receipts:visit(node,set(),done)
 sys.path.insert(0,str(TOOLS.parent/'mo1306'))
 from trace_phase2d import validate_trace
 identities={'node':str(NODE),'powershell':str(Path(ENV['SystemRoot'])/'System32/WindowsPowerShell/v1.0/powershell.exe'),'conhost':str(Path(ENV['SystemRoot'])/'System32/conhost.exe')}
 native=read(relative(OUT/'native-execution.json'));assert native['caseCount']==len(native['cases'])==45,'NATIVE_CASE_OMISSION'
 required={p+'-'+c for p in LABELS for c in ['pass','fail','cne','set','regression','metadata','configuration','input','integrity']}
 assert {c['id'] for c in native['cases']}==required and all(c['status']=='PASS' for c in native['cases']),'NATIVE_CASE_SET'
 harnesses={sha(p.read_bytes()) for p in list((OUT/'harness-history').glob('*'))+[TOOLS/'native.py',TOOLS/'observer.py',TOOLS/'trace_phase2d.py']}
 for case in native['cases']:
  trace=read(case['trace']['path']);assert trace['status']=='PASS' and trace['exitCode']==case['exitCode'],'NATIVE_FALSE_PASS'
  assert case['distributionDigest']==trace['distributionDigest']==expected['distribution'] and case['trace']==row(ROOT/case['trace']['path']),'NATIVE_IDENTITY_BINDING'
  assert trace['harnessSha256'] in harnesses and ('observerSha256' not in trace or trace['observerSha256'] in harnesses),'UNBOUND_EXECUTED_HARNESS'
  assert 'traceValidatorSha256' not in trace or trace['traceValidatorSha256'] in harnesses,'UNBOUND_TRACE_VALIDATOR'
  validate_trace(trace,identities,PKG)
  assert trace['observation']['peakProcessCount']<=3 and trace['observation']['peakAggregateRssBytes']<=768*1024*1024 and not trace['cleanup']['remainingPids'],'RESOURCE_OR_ORPHAN'
  bundle=ROOT/case['bundle'];result=json.loads((bundle/'memoryos-ci-result.json').read_bytes());evidence=json.loads((bundle/'memoryos-ci-evidence.json').read_bytes())
  assert bundle.name==case['runId']==result['runId']==evidence['runId'] and result['provider']==case['provider'],'BUNDLE_CROSSLINK'
  assert result['classification']==case['classification'] and result['process']['exitCode']==case['exitCode'] and evidence['distributionSha256']==expected['distribution'],'RESULT_CROSSLINK'
  manifest=json.loads((bundle/'memoryos-ci-artifacts.json').read_bytes());marker=json.loads((bundle/'memoryos-ci-complete.json').read_bytes())
  assert manifest['runId']==marker['runId']==case['runId'] and marker['manifestSha256']==sha((bundle/'memoryos-ci-artifacts.json').read_bytes()),'COMPLETION_BINDING'
  assert evidence['resultSha256']==sha((bundle/'memoryos-ci-result.json').read_bytes()),'RESULT_EVIDENCE_BINDING'
  assert manifest['files']==[row(bundle/name,bundle) for name in sorted(p.name for p in bundle.iterdir() if p.name not in ['memoryos-ci-artifacts.json','memoryos-ci-complete.json'])],'BUNDLE_ARTIFACT_BINDING'

  if case['semanticByteParity']:
   for filename in ('evaluation-identity.json','policy-outcome.json'):assert (bundle/filename).read_bytes()==(ROOT/case['oracle']/filename).read_bytes(),'SEMANTIC_PARITY'
 assert package['status']=='PASS' and package['memberCount']==94 and package['runtimeClosureFiles']==25 and package['productionDependencies']==0 and package['reproducible'] and package['offlineEmptyCache'] and package['installedIntegrityUnchanged'],'PACKAGE_FALSE_PASS'
 assert {r['provider'] for r in package['providers']}==set(LABELS) and all(r['status']=='PASS' and r['noOverwriteExitCode']==17 for r in package['providers']),'PROVIDER_ARTIFACT_SET'
 current_files=sorted((row(p,PKG) for p in PKG.rglob('*') if p.is_file()),key=lambda r:r['path'])
 assert len(current_files)==94 and read(relative(OUT/'installed-before.json'))['files']==read(relative(OUT/'installed-after.json'))['files']==current_files,'INSTALLED_BYTE_IDENTITY'
 import tarfile
 with tarfile.open(archive) as tar:
  members=tar.getmembers();assert len(members)==94 and all(m.isfile() and m.name.startswith('package/') for m in members),'ARCHIVE_MEMBERS'
  actual=sorted(({'path':m.name[8:],'byteLength':m.size,'sha256':sha(tar.extractfile(m).read())} for m in members),key=lambda r:r['path'])
  assert actual==current_files,'ARCHIVE_PRODUCT_BYTE_IDENTITY'
 for provider in package['providers']:
  folder=OUT/'generated'/provider['provider']
  assert provider['files']==[row(folder/r['path'],folder) for r in provider['files']],'GENERATED_ARTIFACT_IDENTITY'

 assert read(relative(OUT/'launchers.json'))['caseCount']==15,'LAUNCHER_CASES'
 wrapper=read(relative(OUT/'github-wrapper.json'));assert wrapper['passed']>=20 and not wrapper['hostedExecuted'] and not wrapper['networkExecuted'],'HOSTED_FALSE_CLAIM'
 assert inv['phase3Interfaces']==row(BASE/'mo1306-phase3-interfaces.json'),'HANDOFF_IDENTITY'
 handoff=read(inv['phase3Interfaces']['path']);assert handoff['distributionDigest']==expected['distribution'] and set(handoff['workstreams'])=={'3A','3B','3C','3D'} and handoff['phase3Started'] is False,'HANDOFF_SCOPE'
 if revision:
  tree=frozen_git('ls-tree','-r',revision);objects={line.split('\t',1)[1]:line.split('\t',1)[0].split()[2] for line in tree.splitlines()}
  for member in inv['artifacts']:
   raw=bytes_at(member['path']);assert objects.get(member['path'])==hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest(),'I2_BYTE_BINDING'
 if post_b2:
  assert implementation['state']=='BOUND' and frozen_git('show','-s','--format=%P','HEAD')==revision and frozen_git('show','-s','--format=%s','HEAD')==B2_SUBJECT,'B2_GRAPH'
  changed=set(frozen_git('diff','--name-only','HEAD^','HEAD').splitlines());allowed={relative(INV)}|{relative(BIND/(key+'.json')) for key in GATES}
  assert changed<=allowed and changed,'B2_BEHAVIOR_CHANGE'
  assert git('status','--porcelain')=='','DIRTY_B2'
 return {'status':'PASS','receipts':len(receipts),'cases':case_count,'artifacts':len(inv['artifacts']),'nativeCases':45,'providers':5,'state':implementation['state'],'postB2':post_b2}
def load():
 inv=json.loads(INV.read_bytes());receipts={r['id']:json.loads((ROOT/r['path']).read_bytes()) for r in inv['receipts']};return inv,receipts
if __name__=='__main__':
 import argparse
 parser=argparse.ArgumentParser();parser.add_argument('--post-b2',action='store_true');args=parser.parse_args();print(json.dumps(validate(*load(),post_b2=args.post_b2),sort_keys=True))
