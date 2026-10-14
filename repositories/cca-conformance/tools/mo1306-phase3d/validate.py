"""Read-only final integration and post-BF conformance. No execution campaigns."""
from support import *
from package import verify_package, files_of
from sbom import verify_sbom, engine, expected_sbom
from reconcile import dependencies, phase3b, phase3c
from models import history, native, provenance, closure, release_inventory, final_inventory, binding_graph, binding_validation, TERMINAL
DOCUMENT=ROOT/'docs/mo1306-phase3d-qualified-release.md'
PAYLOADS={'package.json','dependency-delta.json','3b-dependency-matrix.json','3c-dependency-matrix.json','history.json','native-binding.json','provenance.json','closure-matrix.json','release-inventory.json','sbom.spdx.json'}
def payloads():return {name:load(name) for name in PAYLOADS}
def expected(e):
    dep=dependencies(e)
    return {'package.json':verify_package(),'dependency-delta.json':dep,'3b-dependency-matrix.json':phase3b(e,dep),'3c-dependency-matrix.json':phase3c(e,dep),'history.json':history(e),'native-binding.json':native(e),'provenance.json':provenance(e),'closure-matrix.json':closure(e),'release-inventory.json':release_inventory(),'sbom.spdx.json':expected_sbom(e,files_of())}
def validate_payloads(values,wanted):
    need(set(values)==PAYLOADS,'CLOSED_PAYLOAD_SET')
    inv=values['release-inventory.json'];validate_policy(inv['policy'])
    need(inv['authority']==CHAIN and inv['productionAuthority']==C3CB and inv['methodologyAuthority']==M3 and inv['scopeAuthority']==S3,'AUTHORITY_IDENTITY')
    need(inv['finalBinding']=='PENDING' and inv['futureCommitSelfReference'] is False and inv['releaseTag']=={'name':'memoryos-1.3-mo1306','state':'ABSENT'},'NO_FUTURE_SELF_REFERENCE')
    need(inv['native']==ref(OUT/'native-binding.json') and values['native-binding.json']['state']=='REAL_EXECUTION_CERTIFIED','GENERIC_REQUIRED')
    need(values['provenance.json']['futureCommitSelfReference'] is False,'PROVENANCE_SELF_REFERENCE')
    need(values['closure-matrix.json']['counts']['BLOCKED']==0,'STOP_BLOCKED_REQUIREMENT')
    for name in sorted(PAYLOADS):need(values[name]==wanted[name],'INVALID_OR_STALE_'+name)
    return True
def tree(rev,prefix):
    rows=git('ls-tree','-r','-z',rev,'--',prefix).split(b'\0')
    return {r.split(b'\t',1)[1].decode():r.split(b'\t',1)[0].decode().split()[2] for r in rows if r}
def preservation(e):
    evidence=e.run();need(evidence==read(E/'scope-correction/evidence-review.json'),'S3_RAW_EVIDENCE_REVIEW')
    old=obj(e,'phase3b-r2/supply-original3b-index.json','3B-R2');raw=blobs([old['originalCommit']+':'+r['path'] for r in old['files']])
    for r in old['files']:need(identity(raw[old['originalCommit']+':'+r['path']])=={k:r[k] for k in ('byteLength','sha256')},'ORIGINAL_3B_BYTES')
    retained=[]
    for rev,prefix in [(B2,'repositories/cca-conformance/evidence/mo1306'),(C3A,'repositories/cca-conformance/evidence/mo1306/phase3-correction'),(C3C,'repositories/cca-conformance/evidence/mo1306/phase3-helper-correction')]:
        before=tree(rev,prefix);after=tree(S3,prefix);need(all(after.get(p)==oid for p,oid in before.items()),'HISTORICAL_GIT_BYTES_CHANGED')
        retained.append({'commit':rev,'scope':prefix,'files':len(before),'status':'PASS'})
    for owner,root in PEERS.items():
        for key,r in e.rows.items():
            if key[0]==owner:need((root/r['originalPath']).read_bytes()==check(r['file']),'PEER_SOURCE_EVIDENCE_CHANGED')
    return {'status':'PASS','S3':s3_snapshot(),'preservedSourceBindings':len(e.rows),'original3BFiles':len(old['files']),'historicalTrees':retained,'generic':'REAL_EXECUTION_CERTIFIED','hosted':'NOT_CERTIFIED','diagnostic':'STILL_UNRESOLVED / HOSTED_DIAGNOSTIC_EXHAUSTED'}
def permitted(p):return p=='ROADMAP.md' or p==DOCUMENT.relative_to(ROOT).as_posix() or p==FINAL.relative_to(ROOT).as_posix() or p.startswith(('repositories/cca-conformance/tools/mo1306-phase3d/','repositories/cca-conformance/evidence/mo1306/phase3d/'))
def references(value):
    if isinstance(value,dict):
        if set(value)=={'path','byteLength','sha256'}:yield value
        else:
            for child in value.values():yield from references(child)
    elif isinstance(value,list):
        for child in value:yield from references(child)
def i3_files_check(i3=None):
    inv=load('i3-files.json');refs=inv['files']
    need(len({r['path'] for r in refs})==len(refs),'I3_DUPLICATE')
    for r in refs:check(r)
    actual={p.relative_to(ROOT).as_posix() for folder in (TOOLS,OUT) for p in folder.rglob('*') if p.is_file() and p.name not in {'i3-files.json','binding.json','binding-graph.json','binding-validation.json'}}|{'ROADMAP.md',DOCUMENT.relative_to(ROOT).as_posix()}
    need({r['path'] for r in refs}==actual,'I3_CLOSED_FILES')
    if i3:
        pairs=git('rev-list','--parents','-n','1',i3).decode().split();need(pairs==[i3,S3],'I3_PARENT')
        need(git('show','-s','--format=%s',i3).decode().strip()==I3_SUBJECT,'I3_SUBJECT')
        allrefs=refs+[ref(OUT/'i3-files.json')]
        raw=blobs([i3+':'+r['path'] for r in allrefs])
        for r in allrefs:need(raw[i3+':'+r['path']]==check(r),'I3_COMMITTED_BYTES')
        need(set(git('diff','--name-only',S3,i3).decode().splitlines())=={r['path'] for r in allrefs},'I3_EXACT_DIFF')
    return {'status':'PASS','files':len(refs)}
def check_bf(i3,post=False):
    need(load('binding-graph.json')==binding_graph(i3),'BF_GRAPH')
    need(read(FINAL)==final_inventory(i3),'BF_FINAL_INVENTORY')
    b=load('binding.json');need(set(b)=={'kind','version','I3','parent','inventory','graph','validation','finalInventory','selfReference'},'BF_BINDING_FIELDS')
    need(b['kind']=='MemoryOSCICDFinalBinding' and b['version']=='1.0.0' and b['I3']==b['parent']==i3 and b['selfReference'] is False,'BF_BINDING_IDENTITY')
    need(b['inventory']==ref(OUT/'release-inventory.json') and b['graph']==ref(OUT/'binding-graph.json') and b['validation']==ref(OUT/'binding-validation.json') and b['finalInventory']==ref(FINAL),'BF_BINDINGS')
    need(load('binding-validation.json')==binding_validation(i3),'BF_VALIDATION')
    if post:
        head=git('rev-parse','HEAD').decode().strip();need(git('rev-list','--parents','-n','1',head).decode().split()==[head,i3],'BF_SINGLE_PARENT')
        need(git('show','-s','--format=%s',head).decode().strip()==BF_SUBJECT,'BF_SUBJECT')
        need(set(git('diff','--name-only',i3,head).decode().splitlines())==set(BF_FILES),'BF_SCOPE')
        need(not git('status','--porcelain=v1').strip(),'CLEAN_MAIN')
    return True
def verify(mode='pre'):
    need(ROOT==Path(r'C:\Users\melsa\Documents\Codex\cca-workspace'),'WORKSPACE_ROOT');need(git('branch','--show-current').decode().strip()=='main','BRANCH')
    baseline=load('baseline.json');need(graph()==baseline['graph'],'AUTHORITY_GRAPH')
    need(not git('diff','--name-only',C3CB,'--','repositories/memoryos-ci').strip(),'STOP_PRODUCTION_CHANGED')
    need(git('rev-parse','HEAD:repositories/memoryos-ci').decode().strip()==baseline['productionTree'],'PRODUCTION_TREE')
    need(git('for-each-ref','--format=%(refname) %(objectname)','refs/tags').decode()==baseline['tags'],'TAGS_CHANGED')
    need(not git('tag','--list','memoryos-1.3-mo1306').strip(),'RELEASE_TAG_MUST_BE_ABSENT')
    for p,original in baseline['peers'].items():need(snapshot(Path(p))==original,'HISTORICAL_WORKTREE_CHANGED '+p)
    changes=git('diff','--name-only',S3).decode().splitlines()+git('ls-files','--others','--exclude-standard').decode().splitlines()
    need(all(permitted(p) for p in changes),'UNAUTHORIZED_FILE_CHANGE')
    e=Evidence();preserved=preservation(e);need(preserved==load('preservation-validation.json'),'PRESERVATION_RECEIPT')
    wanted=expected(e);values=payloads();validate_payloads(values,wanted)
    verified_sbom=verify_sbom(values['sbom.spdx.json'],e,files_of(),engine());verified_sbom['sbom']=ref(OUT/'sbom.spdx.json');need(verified_sbom==load('sbom-validation.json'),'SBOM_VALIDATION_RECEIPT')
    # The generated models bind historical nested paths via their preserved source indexes.
    # Verify current direct integration references; nested historical assertions retain their own roots.
    for name in ('release-inventory.json','closure-matrix.json','3b-dependency-matrix.json','3c-dependency-matrix.json'):
        for r in references(values[name]):check(r)
    from tests import run_tests
    tests=run_tests(values,wanted,e);need(tests==load('tests.json'),'NEGATIVE_CONTROL_RECEIPT')
    need(WORDING in DOCUMENT.read_text(encoding='utf8'),'CANONICAL_RELEASE_WORDING')
    need('MEMORYOS 1.3 MO-1306 RELEASE TAG REVIEW' in (ROOT/'ROADMAP.md').read_text(encoding='utf8'),'ROADMAP_NEXT_ACTION')
    head=git('rev-parse','HEAD').decode().strip();i3=None
    if mode=='pre':need(head==S3,'PRE_I3_BASELINE')
    elif mode in ('i3','binding'):i3=head
    elif mode=='post':i3=git('rev-parse','HEAD^').decode().strip()
    else:raise AssertionError('MODE')
    sealed=i3_files_check(i3)
    if mode in ('binding','post'):check_bf(i3,mode=='post')
    return {'status':'PASS','mode':mode,'head':head,'I3':i3,'productionChanges':0,'authorityGraph':'PASS','package':'PASS','SBOM':'PASS','provenance':'PASS','providerMatrix':'PASS','generic':'REAL_EXECUTION_CERTIFIED','githubHosted':'NOT_CERTIFIED','historicalPreservation':'PASS','peerWorktreesUnchanged':len(baseline['peers']),'phase3bBinding':'PASS','phase3cBinding':'PASS','closureCounts':values['closure-matrix.json']['counts'],'negativeControls':tests['negativeCount'],'positiveChecks':tests['positiveCount'],'conformanceTestCount':tests['totalCount'],'i3Files':sealed['files'],'releaseState':'CERTIFIED_READY_TO_TAG' if mode=='post' else 'FINAL_BINDING_PENDING','tag':'ABSENT','productExecutionCampaigns':0,'hostedExecutions':0,'networkCalls':0}
if __name__=='__main__':print(json.dumps(verify(sys.argv[1] if len(sys.argv)>1 else 'pre')))
