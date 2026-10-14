"""Closed correction evidence validation; no writes, network, or phase campaigns."""
from common import *
import copy,tarfile
INV=ROOT/'repositories/cca-conformance/mo1306-phase3-helper-correction-inventory.json'
BIND=ROOT/'repositories/cca-conformance/mo1306-phase3-helper-correction-binding.json'
DOC=ROOT/'docs/mo1306-phase3-helper-deadline-correction.md'
SUBJECT='fix(memoryos-1.3): reject late MO-1306 helper success'
BIND_SUBJECT='conformance(memoryos-1.3): bind MO-1306 helper deadline correction'
GATES=['reproduction.json','deadline-audit.json','cheap-gate.json','source-focused.json','installed-focused.json','package.json','installed-regression.json','semantic-native.json','provider-preservation.json','recertification-impact.json','final-gates.json']
def read(name):return json.loads((OUT/name).read_bytes())
def closure():return sorted((row(p) for p in [*PKG.rglob('*'),*TOOLS.rglob('*'),*OUT.rglob('*'),DOC] if p.is_file()),key=lambda x:x['path'])
def blob(ref,p):return subprocess.check_output(['git','-c','core.longpaths=true','show',ref+':'+p],cwd=ROOT,stdin=subprocess.DEVNULL)
def committed_rows(ref,entries):
 args=['git','-c','core.longpaths=true','cat-file','--batch'];requests=''.join(ref+':'+e['path']+'\n' for e in entries).encode()
 p=subprocess.run(args,input=requests,cwd=ROOT,capture_output=True,check=True,env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'},creationflags=subprocess.CREATE_NO_WINDOW)
 raw=p.stdout;at=0
 for e in entries:
  end=raw.index(b'\n',at);header=raw[at:end].split();assert len(header)==3 and header[1]==b'blob';size=int(header[2]);data=raw[end+1:end+1+size];at=end+size+2
  assert len(data)==e['byteLength'] and sha(data)==e['sha256'],e['path']
 assert at==len(raw)
def validate(inv,committed=None):
 assert set(inv)=={'kind','version','baseline','C3A','productionChanges','sourceBefore','sourceAfter','artifacts','gates','package','preservation','recertification'}
 assert inv['kind']=='MemoryOSHelperDeadlineCorrection' and inv['version']=='1.0.0' and inv['baseline']==C3AB and inv['C3A']==C3A
 assert git('rev-parse',C3AB+'^')==C3A and git('rev-parse',C3A+'^')==B2
 assert inv['artifacts']==closure(),'CLOSED_ARTIFACT_INVENTORY'
 source='repositories/memoryos-ci/src/filesystem.mjs';before=blob(C3AB,source)
 assert inv['sourceBefore']=={'path':source,'byteLength':len(before),'sha256':sha(before)} and inv['sourceAfter']==row(ROOT/source)
 expected=before.decode().replace('      const child=spawn(exe,',"      const helperDeadline=performance.now()+2000;\n      const effectiveDeadline=Math.min(deadline,helperDeadline);\n      const timeoutCode=deadline<=helperDeadline?'OVERALL_TIMEOUT':'FILESYSTEM_BOUNDARY';\n      if(performance.now()>=effectiveDeadline)reject(timeoutCode);\n      const child=spawn(exe,").replace("timer=setTimeout(()=>stop(remaining<=2000?'OVERALL_TIMEOUT':'FILESYSTEM_BOUNDARY'),Math.min(2000,remaining));","timer=setTimeout(()=>stop(timeoutCode),Math.max(0,effectiveDeadline-performance.now()));").replace("        try {\n          const response=parseJSON", "        try {\n          // Timer delivery can lag real close delivery. Cleanup is never success grace.\n          if(performance.now()>=effectiveDeadline)reject(timeoutCode);\n          const response=parseJSON").replace("          resolve();", "          if(signal?.aborted)reject('CANCELLED');\n          if(performance.now()>=effectiveDeadline)reject(timeoutCode);\n          resolve();")
 assert (ROOT/source).read_bytes()==expected.encode(),'NARROW_PRODUCT_CHANGE'
 assert inv['productionChanges']==['distribution-manifest.json','src/filesystem.mjs']
 assert git('diff','--name-only',C3AB,'--','repositories/memoryos-ci').splitlines()==['repositories/memoryos-ci/'+p for p in inv['productionChanges']]
 assert len(inventory(PKG))==94
 manifest=json.loads((PKG/'distribution-manifest.json').read_bytes());old=json.loads(blob(C3AB,'repositories/memoryos-ci/distribution-manifest.json'))
 assert len(manifest['files'])==93 and [b['path'] for a,b in zip(old['files'],manifest['files']) if a!=b]==['src/filesystem.mjs']
 for e in manifest['files']:assert e==row(PKG/e['path'],PKG)
 assert inv['gates']=={p:row(OUT/p) for p in GATES}
 for p in GATES:assert read(p)['status']=='PASS',p
 assert read('reproduction.json')['classification']=='PRODUCT_DEADLINE_VIOLATION' and not read('reproduction.json')['timerFired']
 audit=read('deadline-audit.json');assert not audit['additionalIndependentDefect'] and audit['counts']['TIMER_ONLY_AFFECTED']==1
 assert inv['preservation']==read('preservation.json')
 for entry in inv['preservation']['files']:
  original=ROOT.parent/'cca-mo1306-3a-refresh'/entry['original']['path'];assert row(original,ROOT.parent/'cca-mo1306-3a-refresh')==entry['original'];assert (ROOT/entry['copy']['path']).read_bytes()==original.read_bytes()
 assert inv['preservation']['original2032']=='MEASUREMENT_DEFECT'
 for name in ['corrected','baseline']:
  data=json.loads(read('boundary-'+name+'.json')['stdout']);assert data['count']==22
  if name=='corrected':assert data['failedCount']==0 and all(r['pass'] and r['settlements']==1 for r in data['results'])
  else:assert any(r['name']=='success-before-delivery-after' and r['actual'] is None for r in data['results'])
 for phase,count in [('source',10),('installed',7)]:
  focused=read(phase+'-focused.json');assert focused['count']==count
  for e in focused['cases']:
   evidence=json.loads((ROOT/e['report']['path']).read_bytes());report=evidence['report'];trace=evidence['trace']
   assert not report['lateAccepted'] and report['filesystem']['unchanged'] and not report['filesystem']['completeMarkerPresent']
   assert trace['topologyValidation']['status']=='PASS' and trace['observation']['peakProcessCount']<=3 and not trace['cleanup']['remainingPids'] and trace['cleanup']['elapsedMs']<=2000
   assert report['result']==e['result']
 core=read('native/installed-core-late.json')['report'];ce=next(e for e in core['events'] if e['event']=='coreResult');assert ce['summary']['publication']=='NONE' and ce['summary']['exitCode']==11 and ce['summary']['resultSha256'] is None
 assert len([e for e in core['events'] if e['event']=='spawnBefore'])==1
 fscheck=read('native/source-filesystem-preflight.json')['report'];assert {r['name'] for r in fscheck['cases']}=={'contained','traversal','UNC','device','ADS','junction','symlink'} and all(r['status']=='PASS' for r in fscheck['cases'])
 assert json.loads(read('dispatch-corrected.json')['stdout'])['counts']=={'tests':191,'pass':191,'fail':0}
 assert read('cli-negative.json')['count']==44
 sem=read('semantic-native.json');assert sem['count']==9
 for c in sem['cases']:
  bundle=ROOT/c['bundle'];assert inventory(bundle)==c['files']
  for fn,oracle in [('evaluation-identity.json','oracle-identity.json'),('policy-outcome.json','oracle-outcome.json')]:assert (bundle/fn).read_bytes()==(OUT/'oracles'/c['id']/oracle).read_bytes()
  assert json.loads((bundle/'memoryos-ci-evidence.json').read_bytes())['distributionSha256']==sha((PKG/'distribution-manifest.json').read_bytes())
 providers=read('provider-preservation.json');assert {p['provider'] for p in providers['providers']}=={'generic','gitlab','jenkins','azure','github'} and providers['workflowSemanticsUnchanged']
 assert inv['package']==read('package.json');package=inv['package'];assert package['byteIdentical'] and package['initialExplicitCacheEmpty']
 archive=ROOT/package['archive']['path'];assert row(archive)==package['archive']
 for a in package['assemblies']:assert (ROOT/a['archive']['path']).read_bytes()==archive.read_bytes()
 with tarfile.open(archive) as tar:
  members=tar.getmembers();assert len(members)==94 and len({m.name.casefold() for m in members})==94
  for m in members:assert m.isfile() and m.uid==m.gid==m.mtime==0 and tar.extractfile(m).read()==(PKG/m.name[8:]).read_bytes()
 assert read('installed-before.json')['files']==read('installed-after.json')['files']==inventory(Path(package['installRoot']))
 assert inv['recertification']==read('recertification-impact.json') and not inv['recertification']['recertificationStarted']
 assert inv['recertification']['3B-R2']['disposition']=='TARGETED_IDENTITY_REFRESH_REQUIRED'
 assert inv['recertification']['3A-R']['disposition']==inv['recertification']['3C-R']['disposition']=='TARGETED_REFRESH_REQUIRED'
 if committed:
  assert git('show','-s','--format=%P',committed)==C3AB and git('show','-s','--format=%s',committed)==SUBJECT
  committed_rows(committed,inv['artifacts']+[row(INV)])
 return True

def negatives(inv):
 cases=[('wrong-baseline',lambda x:x.update(baseline='0'*40)),('hidden-history',lambda x:x.update(preservation={})),('omitted-artifact',lambda x:x['artifacts'].pop()),('changed-source',lambda x:x['sourceAfter'].update(sha256='sha256:'+'0'*64)),('widened-production',lambda x:x['productionChanges'].append('bin/memoryos-ci.mjs')),('missing-gate',lambda x:x['gates'].pop('installed-focused.json')),('old-archive',lambda x:x['package']['archive'].update(sha256='sha256:2f1e9424ce64e44b7b1587ce206fe5f7ae72579652ca1fc891c489bc1a21925d')),('unsafe-recertification',lambda x:x['recertification'].update(recertificationStarted=True)),('unknown-field',lambda x:x.update(futureCommit='0'*40))]
 rejected=[]
 for name,mutate in cases:
  value=copy.deepcopy(inv);mutate(value)
  try:validate(value)
  except (AssertionError,KeyError,ValueError):rejected.append(name)
  else:raise AssertionError('Accepted '+name)
 return rejected

def validate_binding(binding,inv,post=False):
 assert set(binding)=={'kind','version','baseline','correctionCommit','correctionParent','inventory','package','preservation','regressions','recertification'}
 assert binding['kind']=='MemoryOSHelperDeadlineCorrectionBinding' and binding['version']=='1.0.0' and binding['baseline']==C3AB and binding['correctionParent']==C3AB
 c3c=binding['correctionCommit'];validate(inv,committed=c3c)
 assert binding['inventory']==row(INV) and binding['package']==inv['package']['archive'] and binding['preservation']==row(OUT/'preservation.json')
 assert binding['regressions']==inv['gates'] and binding['recertification']==row(OUT/'recertification-impact.json')
 if post:
  assert git('show','-s','--format=%P','HEAD')==c3c and git('show','-s','--format=%s','HEAD')==BIND_SUBJECT
  assert git('diff','--name-only','HEAD^','HEAD')==BIND.relative_to(ROOT).as_posix()
 return True
if __name__=='__main__':
 inv=json.loads(INV.read_bytes());mode=sys.argv[1] if len(sys.argv)>1 else 'pre';validate(inv);rejects=negatives(inv)
 if mode in ['binding','post']:validate_binding(json.loads(BIND.read_bytes()),inv,post=mode=='post')
 print(json.dumps({'status':'PASS','mode':mode,'artifacts':len(inv['artifacts']),'negativeControls':rejects}))
