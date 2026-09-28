"""Offline S3 closure validation. No M3/native/provider/security campaign rerun."""
from evidence import *
from policy import *
from tests import run_tests
AUTH_KEYS={'kind','version','milestone','releaseScope','commitRole','expectedParent','productionAuthority','methodologyAuthority','auditAuthorities','policy','pre3D','supersession','bindings','frozenAuthorities','documents','archive','actionPins','advisoryDisposition','remoteEvidence','taskActions','futureCommitSelfReference'}
BINDINGS={'preservation','review','ownerRequest','nativeFinal','nativeReceipt','finalWitness','methodologySidecar','nativeReuse','initialHostedReceipt','bootstrapResolution','diagnosticReceipt','diagnosticCausalReview','diagnosticReport','phase3bReceipt','phase3bProvenance','phase3cAudit','phase3cProviders','phase3cSecurity'}
def verify(post=False):
    need(ROOT==Path(r'C:\Users\melsa\Documents\Codex\cca-workspace'),'WORKSPACE_ROOT')
    head=git('rev-parse','HEAD').decode().strip();need(git('branch','--show-current').decode().strip()=='main','BRANCH')
    need(git('rev-list','--parents','-n','1',M3).decode().split()==[M3,C3CB],'M3_PARENT')
    for rev in [B3,C3]:need(git('rev-list','--parents','-n','1',rev).decode().split()==[rev,C3AB],'AUDIT_PARENT')
    if post:
        need(git('rev-list','--parents','-n','1','HEAD').decode().split()==[head,M3],'S3_SINGLE_PARENT')
        need(git('show','-s','--format=%s','HEAD').decode().strip()=='conformance(memoryos-1.3): qualify MO-1306 hosted certification scope','S3_SUBJECT')
        need(not git('status','--porcelain=v1').strip(),'CLEAN_MAIN')
    else:need(head==M3,'BASELINE')
    changed=git('diff','--name-status',M3).decode().splitlines()
    for line in changed:
        state,p=line.split('\t');need(permitted(p) and state==('M' if p=='ROADMAP.md' else 'A'),'UNAUTHORIZED_CHANGE '+line)
    for p in git('ls-files','--others','--exclude-standard').decode().splitlines():need(permitted(p),'UNTRACKED_SCOPE '+p)
    need(not git('diff','--name-only',C3CB,'--','repositories/memoryos-ci').strip(),'PRODUCTION_CHANGED')
    baseline=read(OUT/'baseline.json');need(git('rev-parse','HEAD:repositories/memoryos-ci').decode().strip()==baseline['productionTree']==git('rev-parse',C3CB+':repositories/memoryos-ci').decode().strip(),'PRODUCTION_TREE')
    need(git('for-each-ref','--format=%(refname) %(objectname)','refs/tags').decode()==baseline['tags'],'TAGS_CHANGED')
    for name,root in PEERS.items():need(snapshot(root)==baseline['peers'][name],'PEER_CHANGED '+name)
    e=Evidence();evidence=e.run();need(evidence==read(OUT/'evidence-review.json'),'REVIEW_STALE')
    for key,row in e.rows.items():need((PEERS[row['owner']]/row['originalPath']).read_bytes()==e.data[key],'PEER_EVIDENCE_CHANGED')
    v=read(AUTH);need(set(v)==AUTH_KEYS,'AUTHORITY_FIELDS')
    need((v['kind'],v['version'],v['milestone'],v['releaseScope'],v['commitRole'])==('MemoryOSHostedCertificationScopeCorrection','1.0.0','MO-1306','v1','S3'),'AUTHORITY_IDENTITY')
    need(v['expectedParent']==v['methodologyAuthority']==M3 and v['productionAuthority']==C3CB and v['auditAuthorities']=={'phase3bR2':B3,'phase3cR':C3},'AUTHORITY_GRAPH')
    validate_policy(v['policy']);validate_pre3d(v['pre3D'])
    need(set(v['bindings'])==BINDINGS,'AUTHORITY_BINDING_SET')
    for r in v['bindings'].values():check(r)
    for r in v['documents']:check(r)
    need({r['path'] for r in v['documents']}=={DOC.relative_to(ROOT).as_posix(),'ROADMAP.md'},'DOCUMENT_SET')
    old=blobs([M3+':'+r['path'] for r in v['frozenAuthorities']])
    need(len(v['frozenAuthorities'])==11 and len(old)==11,'FROZEN_AUTHORITY_SET')
    for r in v['frozenAuthorities']:need(check(r)==old[M3+':'+r['path']],'FROZEN_AUTHORITY_MODIFIED')
    expected={
      'nativeFinal':e.local('phase3a-certification/native-final-gate.json'),
      'nativeReceipt':e.local('phase3a-certification/native-receipt.json'),
      'finalWitness':e.local('phase3a-certification/witness-validation.json'),
      'methodologySidecar':e.local('phase3a-certification/methodology-sidecar.json'),
      'nativeReuse':e.local('phase3a-certification/reused-evidence.json'),
      'initialHostedReceipt':e.local('phase3a-certification/execution-receipt.json'),
      'bootstrapResolution':e.local('phase3a-hosted-resolution/resolution-receipt.json'),
      'diagnosticReceipt':e.local('phase3a-hosted-diagnostic/execution-receipt.json'),
      'diagnosticCausalReview':e.local('phase3a-hosted-diagnostic/causal-review.json'),
      'diagnosticReport':e.local('phase3a-hosted-diagnostic/REPORT.md'),
      'phase3bReceipt':e.local('phase3b-r2/certification-receipt.json','3B-R2'),
      'phase3bProvenance':e.local('phase3b-r2/provenance.json','3B-R2'),
      'phase3cAudit':e.local('phase3cr/audit-validation.json','3C-R'),
      'phase3cProviders':e.local('phase3cr/provider-audit.json','3C-R'),
      'phase3cSecurity':e.local('phase3cr/security-audit.json','3C-R'),
      'preservation':ref(OUT/'preservation.json'),'review':ref(OUT/'evidence-review.json'),'ownerRequest':ref(OUT/'owner-request.txt')}
    need(v['bindings']==expected,'MISBOUND_EVIDENCE_ROLE')
    need(v['actionPins']==PINS and v['futureCommitSelfReference'] is False,'PIN_OR_SELF_REFERENCE')
    need(v['advisoryDisposition']=={'undici':'NOT_REACHABLE_IN_FROZEN_USAGE','fastXmlParser':'REACHABLE_NOT_ATTACKER_CONTROLLED','actionUpdateRequired':False,'newResearchPerformed':False,'newSupplyChainCertification':False,'oldArtifactRequiresRebinding':True},'ADVISORY_SCOPE')
    need(v['archive']=={'byteLength':197290,'sha256':ARCHIVE,'distributionSha256':DIST,'changed':False},'ARCHIVE_SCOPE')
    archive=ROOT/'.cache/c3c/assembly-a/memoryos-ci-0.1.0.tgz';need(archive.stat().st_size==197290 and sha(archive.read_bytes())==ARCHIVE,'LOCAL_ARCHIVE_CHANGED')
    need(v['taskActions']==dict.fromkeys(['productionChanges','nativeExecutions','hostedExecutions','methodologyReruns','securityAuditReruns','supplyChainRecertifications','pushes','tags','providerAccountUse'],0),'UNAUTHORIZED_TASK_ACTION')
    need(v['remoteEvidence']=={'observation':'RETAINED_FINAL_READBACK_ONLY','observedUtc':'2026-09-28T08:17:26.403246+00:00','defaultBranch':'main','main':REMOTE_MAIN,'certificationBranch':'mo1306-certification','certificationScaffold':SCAFFOLD,'scaffoldIsProductAuthority':False,'deletionRequiredForRelease':False,'newNetworkCalls':0},'REMOTE_OVERCLAIM')
    need(set(v['supersession'])=={'originalRequirement','correctedRequirement','scope','originalFreezeUnchanged','historicalInventoriesUnchanged','historicalOutcomesRewritten','futureConformanceMustConsumeScopeCompanion'},'SUPERSESSION_FIELDS')
    for k in ['originalFreezeUnchanged','historicalInventoriesUnchanged','futureConformanceMustConsumeScopeCompanion']:need(v['supersession'][k] is True,'SUPERSESSION_SCOPE')
    need(v['supersession']['historicalOutcomesRewritten'] is False,'HISTORICAL_REWRITE')
    need('OPTIONAL_NON_BLOCKING_V1' in v['supersession']['correctedRequirement'] and 'CF-GITHUB-HOSTED' in v['supersession']['scope'],'GATE_SUPERSESSION')
    roadmap=(ROOT/'ROADMAP.md').read_text(encoding='utf-8');doc=DOC.read_text(encoding='utf-8')
    need('CERTIFICATION_SCOPE_CORRECTED / READY_FOR_QUALIFIED_PHASE_3D' in roadmap and 'MO-1306 QUALIFIED PHASE 3D FINAL CERTIFICATION INTEGRATION' in roadmap,'ROADMAP_STATE')
    need(WORDING in doc and 'MO-1306 is not released' in doc and 'not a fresh remote' in doc,'QUALIFIED_DOCUMENTATION')
    tests=run_tests();need(tests==read(OUT/'tests.json'),'TEST_RECEIPT')
    if (OUT/'inventory.json').exists():
        inv=read(OUT/'inventory.json');paths={r['path'] for r in inv['files']};need(len(paths)==len(inv['files']),'CLOSURE_DUPLICATE')
        for r in inv['files']:check(r)
        expected={p.relative_to(ROOT).as_posix() for folder in [TOOLS,OUT] for p in folder.rglob('*') if p.is_file() and p!=OUT/'inventory.json'}|{AUTH.relative_to(ROOT).as_posix(),DOC.relative_to(ROOT).as_posix(),'ROADMAP.md'}
        need(paths==expected,'CLOSED_FILE_SET')
        if post:need({x.split('\t')[1] for x in changed}==expected|{(OUT/'inventory.json').relative_to(ROOT).as_posix()},'EXACT_COMMIT_SCOPE')
    elif post:raise AssertionError('UNSEALED_S3')
    return {'status':'PASS','head':head,'parent':M3 if post else None,'post':post,'productionTreeUnchangedFromC3CB':True,'providerMatrix':'PASS','history':'PASS','phase3bBinding':'PASS','phase3cBinding':'PASS','negativeControls':tests['negativeCount'],'positiveControls':tests['positiveCount'],'preservedSourceFiles':len(e.rows),'peerReadOnly':'PASS','pre3D':v['pre3D']['readiness'],'released':False,'tagReady':False,'productExecutions':0,'networkCalls':0}
if __name__=='__main__':print(json.dumps(verify('--post' in sys.argv)))
