"""Read-only pre/post methodology gates. Run workspace verification separately."""
from audit import *
from rule import *
from tests import run_tests
def validate(post=False):
    need(ROOT==Path(r'C:\Users\melsa\Documents\Codex\cca-workspace'),'WORKSPACE_ROOT')
    need(git('branch','--show-current').decode().strip()=='main','BRANCH')
    head=git('rev-parse','HEAD').decode().strip()
    if post:
        need(git('rev-list','--parents','-n','1','HEAD').decode().split()==[head,BASE],'M3_EXACT_SINGLE_PARENT')
        need(git('show','-s','--format=%s','HEAD').decode().strip()=='conformance(memoryos-1.3): define unresolved observation certification rule','M3_SUBJECT')
        need(not git('status','--porcelain=v1').strip(),'CLEAN_MAIN')
    else:need(head==BASE,'BASELINE')
    for child,parent in zip(GRAPH[1:],GRAPH):need(git('rev-list','--parents','-n','1',child).decode().split()==[child,parent],'PRODUCTION_GRAPH')
    need(git('rev-parse',GRAPH[0]+'^').decode().strip()=='0e35ffe70919d77b1db530929093826410b805f9','C3A_PARENT')
    changed=git('diff','--name-status',BASE).decode().splitlines()
    for line in changed:
        state,path=line.split('\t');need(state=='A' and permitted(path),'NON_METHODOLOGY_CHANGE '+line)
    for path in git('ls-files','--others','--exclude-standard').decode().splitlines():need(permitted(path),'UNRELATED_UNTRACKED '+path)
    need(git('for-each-ref','--format=%(refname) %(objectname)','refs/tags').decode()==read(OUT/'baseline.json')['protectedTags'],'TAG_CHANGE')
    authority=read(AUTHORITY)
    need(set(authority)=={'kind','version','correction','commitRole','expectedParent','productionGraph','decision','permissionTiming','conditions','ineligible','evidenceClasses','caseThreshold','recurrenceRule','authorities','historicalPreservation','authorityReview','mechanicalReview','eligibility','documentation','productExecutions','productionChanges','nativeCertified','hostedCertified','selfReference'},'AUTHORITY_FIELDS')
    need(authority['kind']=='MemoryOSUnresolvedObservationMethodology' and authority['version']=='1.0.0' and authority['correction']=='B' and authority['commitRole']=='M3','AUTHORITY_KIND')
    need(authority['expectedParent']==BASE and authority['productionGraph']==GRAPH and authority['decision']=='A' and authority['permissionTiming']=='PROSPECTIVE_AFTER_M3_POST_VALIDATION','AUTHORITY_SCOPE')
    need(authority['conditions']==CONDITIONS and authority['ineligible']==FORBIDDEN and authority['recurrenceRule']==RECURRENCE,'AUTHORITY_CLOSED_SETS')
    need(authority['productExecutions']==0 and all(authority[k] is False for k in ['productionChanges','nativeCertified','hostedCertified','selfReference']),'AUTHORITY_FALSE_CLAIM')
    for r in authority['authorities']:
        need(check_ref(r)==git('show',BASE+':'+r['path']),'FROZEN_AUTHORITY_DRIFT')
    for k in ['historicalPreservation','authorityReview','mechanicalReview','eligibility','documentation']:check_ref(authority[k])
    e=Evidence();mechanical=e.run();need(mechanical==read(OUT/'mechanical-review.json'),'MECHANICAL_REVIEW_STALE')
    case=read(OUT/'eligibility.json');decision=eligible(case)
    need(len(authority['evidenceClasses'])==6 and set(authority['evidenceClasses'])==set(case['evidenceClasses']),'AUTHORITY_EVIDENCE_CLASSES')
    t=authority['caseThreshold'];need(set(t)=={'faithful','enhanced','final','universalRepetitionCount','rationale'} and t['faithful']==3 and t['enhanced']==1 and t['final']==1 and t['universalRepetitionCount'] is False and bool(t['rationale']),'THRESHOLD')
    for row in case['matrix']:
        for r in row['evidence']:check_ref(r)
    review=read(OUT/'authority-review.json');need(review['decision']=='A' and review['justified'] is True and review['historicalCriterion10']=='NOT_ESTABLISHED' and review['currentCertification']=='PENDING_FINAL_WITNESS','REVIEW_DISPOSITION')
    archive=ROOT/'.cache/c3c/assembly-a/memoryos-ci-0.1.0.tgz';need(archive.stat().st_size==197290 and sha(archive.read_bytes())==ARCHIVE_SHA,'ARCHIVE_CHANGED')
    node=PEER/'.cache/mo1306-phase3a-final/node-v24.21.0-win-x64/node.exe';need(sha(node.read_bytes())==NODE_SHA,'PINNED_RUNTIME_CHANGED')
    tests=run_tests();need(tests==read(OUT/'tests.json'),'TEST_RECEIPT_STALE')
    if (OUT/'inventory.json').exists():
        inv=read(OUT/'inventory.json');rows=inv['files'];need(len(rows)==len({r['path'] for r in rows}),'INVENTORY_DUPLICATES')
        for r in rows:check_ref(r)
        expected={p.relative_to(ROOT).as_posix() for base in [TOOLS,OUT] for p in base.rglob('*') if p.is_file() and p!=OUT/'inventory.json'}|{AUTHORITY.relative_to(ROOT).as_posix(),DOC.relative_to(ROOT).as_posix()}
        need({r['path'] for r in rows}==expected,'INVENTORY_EXACT_SET')
        if post:
            need({line.split('\t')[1] for line in changed}==expected|{(OUT/'inventory.json').relative_to(ROOT).as_posix()},'COMMIT_EXACT_CLOSURE')
    elif post:raise AssertionError('MISSING_INVENTORY')
    return {'status':'PASS','head':head,'parent':BASE if post else None,'post':post,'decision':decision,'eligibility':{'PASS':18,'FAIL':0,'NOT_ESTABLISHED':0},'negativeControls':tests['negativeCount'],'positiveControls':tests['positiveCount'],'historicalFiles':758,'productFilesChanged':0,'productExecutions':0,'archiveUnchanged':True,'frozenAuthorityBindings':len(authority['authorities']),'historicalCause':'UNRESOLVED','finalWitness':'NOT_EXECUTED'}
if __name__=='__main__':print(json.dumps(validate('--post' in sys.argv)))
