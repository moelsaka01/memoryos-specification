"""Closed correction inventory validation and actual-commit binding; read-only."""
from common import *
import copy,tarfile,collections
INV=ROOT/'repositories/cca-conformance/mo1306-phase3-correction-inventory.json'
BIND=ROOT/'repositories/cca-conformance/mo1306-phase3-correction-binding.json'
DOC=ROOT/'docs/mo1306-phase3-cli-dispatch-correction.md'
SUBJECT='fix(memoryos-1.3): harden MO-1306 CLI command dispatch'
BIND_SUBJECT='conformance(memoryos-1.3): bind MO-1306 CLI dispatch correction'
GATES={'audit':'dispatch-audit.json','powershell':'powershell-audit.json','cheap':'cheap-gate.json','package':'package.json','installed':'installed-regression.json','semantic':'semantic-native.json','providers':'provider-preservation.json','recertification':'recertification-impact.json'}
def closure():
 files=[*PKG.rglob('*'),*TOOLS.rglob('*'),*OUT.rglob('*'),DOC]
 return sorted((row(p) for p in files if p.is_file()),key=lambda x:x['path'])
def read(name):return json.loads((OUT/name).read_bytes())
def blob(commit,p):return subprocess.check_output(['git','-c','core.longpaths=true','show',commit+':'+p],cwd=ROOT,stdin=subprocess.DEVNULL)
def validate(inv,committed=None):
 assert set(inv)=={'kind','version','baseline','baselineParent','sourceBefore','sourceAfter','package','artifacts','gates','originalBlocker','recertification','productionChanges'}
 assert inv['kind']=='MemoryOSCLICommandDispatchCorrection' and inv['version']=='1.0.0'
 assert inv['baseline']==B2 and inv['baselineParent']==I2 and git('rev-parse',B2+'^')==I2
 assert inv['artifacts']==closure(),'artifact closure mismatch'
 assert inv['sourceBefore']==read('baseline.json')['source']
 source='repositories/memoryos-ci/bin/memoryos-ci.mjs';old=blob(B2,source)
 assert inv['sourceBefore']=={'path':source,'byteLength':len(old),'sha256':sha(old)}
 assert inv['sourceAfter']==row(ROOT/source)
 oldline=b"  const command=args[0],allowed={run:['workspace','config','provider'],generate:['config','deployment','output'],verify:['bundle']}[command];\n  if(!allowed)reject('USAGE');"
 newline=b"  const command=args[0],commands={run:['workspace','config','provider'],generate:['config','deployment','output'],verify:['bundle']};\n  if(!Object.hasOwn(commands,command))reject('USAGE');\n  const allowed=commands[command];"
 assert old.count(oldline)==1 and (ROOT/source).read_bytes()==old.replace(oldline,newline),'unexpected production correction'
 assert inv['productionChanges']==['bin/memoryos-ci.mjs','distribution-manifest.json']
 assert sorted(git('diff','--name-only',B2,'--','repositories/memoryos-ci').splitlines())==['repositories/memoryos-ci/'+p for p in inv['productionChanges']]
 manifest=json.loads((PKG/'distribution-manifest.json').read_bytes());prior=json.loads(blob(B2,'repositories/memoryos-ci/distribution-manifest.json'))
 assert len(manifest['files'])==93 and len(inventory(PKG))==94
 changes=[]
 for a,b in zip(prior['files'],manifest['files']):
  assert b==row(PKG/b['path'],PKG)
  if a!=b:changes.append(b['path'])
 assert changes==['bin/memoryos-ci.mjs']
 assert inv['package']==read('package.json')
 archive=ROOT/inv['package']['archive']['path'];assert row(archive)==inv['package']['archive']
 assert archive.stat().st_size==197172 and sha(archive.read_bytes())=='sha256:2f1e9424ce64e44b7b1587ce206fe5f7ae72579652ca1fc891c489bc1a21925d'
 assert len(inv['package']['assemblies'])==2 and inv['package']['byteIdentical'] is True
 for a in inv['package']['assemblies']:assert row(ROOT/a['archive']['path'])==a['archive'] and a['archive']['sha256']==inv['package']['archive']['sha256']
 with tarfile.open(archive) as tar:
  assert len(tar.getmembers())==94
  for m in tar.getmembers():assert m.isfile() and m.name.startswith('package/') and tar.extractfile(m).read()==(PKG/m.name[8:]).read_bytes()
 assert inv['gates']=={k:row(OUT/v) for k,v in GATES.items()}
 for k,p in GATES.items():
  value=read(p)
  if k!='powershell':assert value['status']=='PASS'
 audit=read('dispatch-audit.json');assert audit['affectedCount']==1 and audit['productionSites']==135
 assert audit['counts']==dict(collections.Counter(s['classification'] for s in audit['sites']))
 before=json.loads(read('dispatch-b2.json')['stdout']);after=json.loads(read('dispatch-corrected.json')['stdout'])
 assert before['counts']=={'tests':191,'pass':175,'fail':16} and after['counts']=={'tests':191,'pass':191,'fail':0}
 assert set(after['commands'])=={'run','generate','verify'}
 required={'constructor','toString','__proto__','valueOf','hasOwnProperty','isPrototypeOf','propertyIsEnumerable','toLocaleString','__defineGetter__','__defineSetter__','__lookupGetter__','__lookupSetter__','prototype'}
 assert required<=set(after['prototypeNames'])
 assert all(r['status']=='PASS' for r in after['results'])
 negative=read('cli-negative.json');assert negative['count']==len(negative['cases'])==44
 for r in negative['cases']:assert r['exitCode']==10 and not r['stdout'] and json.loads(r['stderr'])['code']=='MO1306_USAGE' and not r['handlerInvoked'] and not r['executionBypass']
 base=read('baseline.json');assert base['blockerDisposition']=='BLOCKED / PRODUCTION_DEFECT'
 assert [r['exitCode'] for r in base['cases']]==[16,16,16,10]
 assert inv['originalBlocker']==base['blockerFiles']
 wt=ROOT.parent/'cca-mo1306-3c'
 for entry in inv['originalBlocker']:
  assert row(wt/entry['path'],wt)==entry
  assert (OUT/'original-3c'/entry['path']).read_bytes()==(wt/entry['path']).read_bytes()
 assert read('original-3c/repositories/cca-conformance/evidence/mo1306/phase3c/command-selector-blocker.json')['status']=='BLOCKED'
 sem=read('semantic-native.json');assert sem['count']==len(sem['cases'])==9
 assert {c['id'] for c in sem['cases']}=={k+'-'+v for k in ['policy','policySet','regression'] for v in ['pass','fail','cne']}
 smoke={c['id']:c for c in read('semantic-smoke.json')['cases']}
 for c in sem['cases']:
  bundle=ROOT/c['bundle'];result=json.loads((bundle/'memoryos-ci-result.json').read_bytes())
  assert result['semantic']['decision']==c['decision'] and result['process']['exitCode']==c['exitCode']
  evidence=json.loads((bundle/'memoryos-ci-evidence.json').read_bytes());assert evidence['distributionSha256']==sha((PKG/'distribution-manifest.json').read_bytes())
  for filename,oracle in [('evaluation-identity.json','oracle-identity.json'),('policy-outcome.json','oracle-outcome.json')]:assert (bundle/filename).read_bytes()==(OUT/'oracles'/c['id']/oracle).read_bytes()
 assert read('installed-before.json')['files']==read('installed-after.json')['files']==inventory(Path(inv['package']['installRoot']))
 providers=read('provider-preservation.json');assert {p['provider'] for p in providers['providers']}=={'generic','gitlab','jenkins','azure','github'} and providers['workflowSemanticsUnchanged'] is True
 assert inv['recertification']==read('recertification-impact.json')
 assert inv['recertification']['recertificationExecuted'] is False
 assert all(s['disposition']=='TARGETED_REFRESH_REQUIRED' for s in inv['recertification']['workstreams'])
 assert inv['recertification']['workstreams'][2]['originalDisposition']=='BLOCKED / PRODUCTION_DEFECT'
 for tag in base['tags']:
  assert git('rev-parse',tag['tag'])==tag['object'] and git('rev-parse',tag['tag']+'^{}')==tag['commit']
 if committed:
  assert git('show','-s','--format=%P',committed)==B2 and git('show','-s','--format=%s',committed)==SUBJECT
  # Compare every new authority/tool/evidence byte against the actual C3A blobs.
  for entry in inv['artifacts']:
   raw=blob(committed,entry['path']);assert sha(raw)==entry['sha256'] and len(raw)==entry['byteLength']
  assert blob(committed,INV.relative_to(ROOT).as_posix())==j(inv)
 return True

def negatives(inv):
 cases=[('forged-baseline',lambda v:v.update(baseline='0'*40)),('omitted-artifact',lambda v:v['artifacts'].pop()),('changed-source',lambda v:v['sourceAfter'].update(sha256='sha256:'+'0'*64)),('old-archive',lambda v:v['package']['archive'].update(sha256='sha256:6541e2a935f7bd0d5580b32fc9f17a07d471bc16486fd2a044ecef7628d2458b')),('hidden-blocker',lambda v:v.update(originalBlocker=[])),('unsafe-recertification',lambda v:v['recertification'].update(recertificationExecuted=True)),('missing-gate',lambda v:v['gates'].pop('providers')),('unknown-field',lambda v:v.update(futureCommit='0'*40))]
 rejected=[]
 for name,mutate in cases:
  value=copy.deepcopy(inv);mutate(value)
  try:validate(value)
  except (AssertionError,KeyError,ValueError):rejected.append(name)
  else:raise AssertionError('Conformance mutation accepted: '+name)
 return rejected

def validate_binding(binding,inv,post=False):
 assert set(binding)=={'kind','version','baseline','correctionCommit','correctionParent','inventory','package','blocker','regressions','recertification','artifacts'}
 assert binding['kind']=='MemoryOSCLICommandDispatchCorrectionBinding' and binding['version']=='1.0.0' and binding['baseline']==B2
 c3a=binding['correctionCommit'];assert binding['correctionParent']==B2
 validate(inv,committed=c3a)
 assert binding['inventory']==row(INV) and binding['package']==inv['package']['archive'] and binding['blocker']==inv['originalBlocker']
 assert binding['regressions']==[row(OUT/p) for p in ['dispatch-b2.json','dispatch-corrected.json','cli-negative.json','semantic-native.json','provider-preservation.json']]
 assert binding['recertification']==row(OUT/'recertification-impact.json') and binding['artifacts']==inv['artifacts']
 if post:
  assert git('show','-s','--format=%P','HEAD')==c3a and git('show','-s','--format=%s','HEAD')==BIND_SUBJECT
  assert git('diff','--name-only','HEAD^','HEAD')==BIND.relative_to(ROOT).as_posix()
 return True

if __name__=='__main__':
 inv=json.loads(INV.read_bytes());mode=sys.argv[1] if len(sys.argv)>1 else 'pre'
 validate(inv);rejected=negatives(inv)
 if mode in ['binding','post']:validate_binding(json.loads(BIND.read_bytes()),inv,post=mode=='post')
 print(json.dumps({'correctionConformance':'PASS','mode':mode,'artifacts':len(inv['artifacts']),'negativeControls':len(rejected),'rejected':rejected,'original3C':'BLOCKED / PRODUCTION_DEFECT'}))
