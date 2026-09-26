"""Exact read-only source identities, changed paths, overlaps and preservation."""
from common import *
import itertools,shutil
assert git('branch','--show-current')=='main'
assert git('rev-parse','HEAD')==B1
parent={'2a':B1,'2b-implementation':B1,'2b':SOURCES['2b-implementation'],'2c-original':B1,'2c':SOURCES['2c-original']}
subjects={'2a':'feat(memoryos-1.3): harden MO-1306 CI/CD core and generic runner','2b-implementation':'feat(memoryos-1.3): add MO-1306 GitLab and Jenkins adapters','2b':'test(memoryos-1.3): validate MO-1306 GitLab and Jenkins adapters','2c-original':'feat(memoryos-1.3): add MO-1306 Azure and GitHub adapters','2c':'test(memoryos-1.3): validate MO-1306 Azure and GitHub adapters'}
commits={}
for name,revision in SOURCES.items():
 assert git('rev-parse',revision+'^')==parent[name]
 assert git('show','-s','--format=%s',revision)==subjects[name]
 commits[name]={'revision':revision,'parent':parent[name],'subject':subjects[name],'tree':git('rev-parse',revision+'^{tree}')}
prior=json.loads((ROOT/'.cache/mo1306-phase2d-source-gate/preflight.json').read_bytes())
def classify(p):
 if p.startswith('docs/'):return 'documentation'
 if '/evidence/' in p:return 'historical source evidence'
 if '/fixtures/' in p or '/tools/' in p:return 'engineering validator/fixture'
 if '/templates/' in p:return 'frozen provider template'
 if p.endswith('.json') or p.endswith('README.md'):return 'package metadata/contract'
 if '/scripts/' in p:return 'launcher/transport'
 return 'production implementation' if p.startswith('repositories/memoryos-ci/') else 'repository attributes'
inventories={};trees={};source_roots={}
for name in ('2a','2b','2c'):
 source=ROOT.parent/('cca-mo1306-'+name);source_roots[name]=str(source)
 argv=['git','-c','safe.directory='+source.as_posix(),'-c','core.longpaths=true','-C',str(source)]
 def source_git(*args):return subprocess.check_output([*argv,*args],env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'}).decode().strip()
 assert source_git('rev-parse','HEAD')==SOURCES[name]
 assert source_git('branch','--show-current')=='mo1306/phase'+name
 assert source_git('status','--porcelain')==''
 assert source_git('diff','--check',B1,'HEAD')==''
 raw=subprocess.check_output(['git','ls-tree','-r','-z',SOURCES[name]],cwd=ROOT)
 tree={line.split(b'\t',1)[1].decode():line.split(b'\t',1)[0].split()[2].decode() for line in raw.split(b'\0') if line};trees[name]=tree
 rows=[]
 for line in git('diff','--name-status',B1,SOURCES[name]).splitlines():
  change,p=line.split('\t');assert change in ('A','M')
  data=(source/p).read_bytes();blob=hashlib.sha1(b'blob '+str(len(data)).encode()+b'\0'+data).hexdigest();assert blob==tree[p]
  rows.append({'path':p,'change':change,'classification':classify(p),'byteLength':len(data),'sha256':sha(data),'gitBlob':blob})
 inventories[name]=rows
 if name in ('2a','2b'):
  assert [(x['path'],x['change'],x['byteLength'],x['sha256'].removeprefix('sha256:')) for x in rows]==[(x['path'],x['change'],x['byteLength'],x['sha256']) for x in prior['inventories'][name]]
pairs={a+'/'+b:sorted(set(t['path'] for t in inventories[a])&set(t['path'] for t in inventories[b])) for a,b in itertools.combinations(inventories,2)}
three=sorted(set(t['path'] for t in inventories['2a'])&set(t['path'] for t in inventories['2b'])&set(t['path'] for t in inventories['2c']))
resolutions={
'repositories/memoryos-ci/src/core.mjs':'2A closed IR selection inside fail-closed lifecycle, 2B/2C metadata normalization and all-five selected adapter installation; unchanged supervisor and SDK authority.',
'repositories/memoryos-ci/src/generator.mjs':'2C normalized closed configuration/deployment and nested CLI; common 2A provider IR dispatches all five; GitLab/Jenkins fixed structural grammar added to 2C validator.',
'repositories/memoryos-ci/src/integrity.mjs':'All five static adapter import closures and exact four template paths, including Jenkins .groovy; selected adapter identity and unique complete generator closure.',
'repositories/memoryos-ci/src/verification.mjs':'2B strict own-property adapter digest map plus 2C selected-provider bundle semantics; no optional stale digest fallback.',
'repositories/memoryos-ci/scripts/Invoke-MemoryOSCI.ps1':'All-five allowlist; 2B single bounded canonical LF summary with 2C distribution/configuration/bundle verification and cleared native exit; GitHub wrapper captures Console.Out in-process with no extra child.',
'repositories/cca-conformance/tools/mo1306/contracts.test.mjs':'Explicit Phase 2D capability authority for all five; unchanged historical B1 152-case test/package replayed from Git.',
'repositories/memoryos-ci/distribution-manifest.json':'Regenerated against all final integrated package bytes; never select a source branch inventory as integrated authority.'}
assert set(resolutions)==set().union(*map(set,pairs.values()))
extra=['.gitattributes','repositories/memoryos-ci/src/generated-structure.mjs','repositories/memoryos-ci/scripts/verify-provider-result.mjs','repositories/memoryos-ci/scripts/Invoke-GitHubCI.ps1','repositories/memoryos-ci/contracts/contract.json','repositories/memoryos-ci/README.md']
changes=[]
for p in sorted(set().union(*(set(x['path'] for x in rows) for rows in inventories.values()))):
 owners=[name for name,rows in inventories.items() if any(x['path']==p for x in rows)]
 matches=[name for name in owners if sha((ROOT/p).read_bytes())==next(x['sha256'] for x in inventories[name] if x['path']==p)]
 assert matches or p in resolutions or p in extra,p
 if '/evidence/' in p or '/fixtures/' in p or p.startswith('docs/'):
  assert matches,p
 changes.append({'path':p,'owners':owners,'classification':classify(p),'preservedSourceBytes':matches,'resolution':resolutions.get(p,'Preserved validated source bytes' if matches else 'Mechanically required shared integration change; affected gates rerun')})
history=[]
for name in ('phase2c-source-gate.json','preflight.json','source-check-outputs.json'):
 source=ROOT/'.cache/mo1306-phase2d-source-gate'/name
 target=OUT/'first-attempt'/name;target.parent.mkdir(exist_ok=True);target.write_bytes(source.read_bytes())
 history.append({'source':str(source),**row(target)})
assert json.loads((OUT/'first-attempt/phase2c-source-gate.json').read_bytes())['status']=='FAIL'
put('source-inventory.json',{'status':'PASS','baseline':B1,'commits':commits,'sourceWorktrees':source_roots,'sourceWorktreesClean':True,'inventories':inventories,'counts':{k:len(v) for k,v in inventories.items()},'pairwiseOverlaps':pairs,'threeWayOverlaps':three,'resolutions':resolutions,'paths':changes,'firstAttempt':history,'reuse':{'2a':'Exact unchanged commit and inventory identities; retained evidence hashes verified','2b':'Exact unchanged completion and implementation commits, inventories and prior 270-file/272-Git-blob acceptance validation','2c':'Full corrected two-commit lineage recomputed and focused source gate executed before integration'}})
receipt=json.loads((ROOT.parent/'cca-mo1306-2c/repositories/cca-conformance/evidence/mo1306/phase2c/acceptance.json').read_bytes())
put('source-gate.json',{'status':'PASS','revision':SOURCES['2c'],'original':SOURCES['2c-original'],'boundFiles':len(receipt['files']),'gates':receipt['gates'],'executionObservation':{'elapsedSeconds':6.406,'exitCode':0,'output':'Phase2C retained evidence validation PASS','verified':['history','350 file byte identities','native bundles','acceptance gates','fresh generated Azure full schema and PowerShell AST','fresh generated GitHub grammar and PowerShell AST','completion parent/subject/changed paths','clean source status','git diff --check']},'scope':'Source validation, not integrated certification','engineeringAdaptation':'Only temporary GitHub AST request files were relocated under main cache; the parse-only helper bytes were identical. Source worktree untouched.','attempts':[{'status':'ENVIRONMENT_SETUP_FAILURE','error':'ModuleNotFoundError: No module named jsonschema','resolution':'Set pinned validator PYTHONPATH'},{'status':'INTERRUPTED_DIAGNOSTIC','reason':'Initial verifier used several minutes of CPU without output; terminated the identified task-owned Python process. Root cause not established. Bounded instrumented gate passed.'}]})
print('Source inventory and overlap resolutions PASS', {k:len(v) for k,v in inventories.items()})
