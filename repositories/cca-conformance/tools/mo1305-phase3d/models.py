"""Deterministic, acyclic integration and final-binding document models."""
import copy
from common import *
A=SOURCES['3A-R']['receipt'];B=SOURCES['3B-R']['receipt'];C=SOURCES['3C-R']['receipt']
CORRECTION=D+'mo1305-phase3-correction/accepted/'
ADVISORY_LIMIT='The advisory review is bounded. It does not claim an exhaustive vulnerability census, zero vulnerabilities, or independent scanning of the complete npm bundled transitive advisory graph.'

def certifications():
    return {role:{'state':'PASS','commit':s['commit'],'parent':C3B,'receipt':ref(s['receipt']),'report':ref(s['report'])} for role,s in SOURCES.items()}

def overlap():
    sources=read(E+'source-inventory.json');paths={r['role']:{v['path'] for v in r['files']} for r in sources}
    classification=[]
    for role in SOURCES:
        counts=dict.fromkeys(['tooling','evidence','receipts','reports','registrations','sharedConformanceMetadata'],0)
        for name in sorted(paths[role]):
            category='tooling' if '/tools/' in name else 'reports' if name.endswith('.md') else 'receipts' if name.endswith('receipt.json') else 'evidence'
            counts[category]+=1
        classification.append({'role':role,'changedPaths':sorted(paths[role]),'categories':counts})
    return {'kind':'MemoryOSRESTCertificationOverlap','version':'1.0.0','sources':classification,'pairs':[{'left':a,'right':b,'paths':sorted(paths[a]&paths[b])} for a,b in [('3A-R','3B-R'),('3A-R','3C-R'),('3B-R','3C-R')]],'productRuntimeOverlap':[],'strategy':'Import exact disjoint certification blobs; integrate shared registration and inventory deliberately on main; single-parent I3 then binding-only BF.'}

def history():
    return {'kind':'MemoryOSRESTPhase3HistoricalDispositions','version':'1.0.0','attempts':[
        {'id':'3A-original','state':'PASS_B2_REFRESH_REQUIRED','commit':A3,'evidence':ref(CORRECTION+'candidate.json')},
        {'id':'3B-original','state':'STOPPED_RELEASE_ARTIFACT_DEFECT','evidence':ref(D+'mo1305-phase3-correction/phase3b-report.md')},
        {'id':'3C-original','state':'STOPPED_RELEASE_BLOCKER','evidence':ref(D+'mo1305-phase3c-refresh/historical.json')},
        {'id':'C3-C3B','state':'PASS','commits':[C3,C3B],'evidence':ref(CORRECTION+'binding.json')},
        {'id':'3A-R','state':'PASS','commit':SOURCES['3A-R']['commit'],'evidence':ref(A)},
        {'id':'3B-R-first','state':'ENVIRONMENT_BLOCKED','evidence':ref(D+'mo1305-phase3br/history/attempt-1-blocked.md')},
        {'id':'3B-R-long-path','state':'ENVIRONMENT_HARNESS_BLOCKED','evidence':ref(D+'mo1305-phase3br/history/installed-attempt-1/diagnosis.json')},
        {'id':'3B-R-final','state':'PASS','commit':SOURCES['3B-R']['commit'],'evidence':ref(B)},
        {'id':'3C-R','state':'PASS','commit':SOURCES['3C-R']['commit'],'evidence':ref(C)}]}

def matrix():
    original=read(D+'mo1305-phase3c-refresh/closure-matrix.json');value=copy.deepcopy(original)
    value.update(kind='MemoryOSRESTIntegratedReleaseClosureMatrix',state='CERTIFICATIONS_COMPLETE',sourceMatrix=ref(D+'mo1305-phase3c-refresh/closure-matrix.json'),auditCommit=SOURCES['3C-R']['commit'],pendingExternalCertificationCount=0)
    value['externalRefreshes']={k:certifications()[k] for k in ('3A-R','3B-R')}
    for row in value['requirements']:
        if row['status'] in ('PENDING_3A_REFRESH','PENDING_3B_REFRESH'):
            role=row['owner'];row['sourceStatus']=row['status'];row['status']='PASS';row['externalState']='PASS'
            del row['futureCommit'];del row['futureReceipt']
            row.update(commit=SOURCES[role]['commit'],receipt=ref(SOURCES[role]['receipt']),phase3DAction='Exact committed PASS receipt and its evidence validated by the final conformance gate.')
            row['evidenceIdentity'].append(ref(SOURCES[role]['receipt']))
        elif row['id']=='final-receipts':
            row.update(status='PASS',phase3DAction='All three source certification identities integrated without receipt mutation.')
            row['evidenceIdentity'] += [ref(s['receipt']) for s in SOURCES.values()]
        elif row['id']=='final-binding':row.update(status='PENDING_FINAL_BINDING',phase3DAction='BF validates existing I3 and binds this immutable matrix; final resolution is recorded in binding-graph.json.')
        elif row['id']=='release-tag':row.update(status='PENDING_TAG_REVIEW',phase3DAction='Tag remains absent. After BF validation, request review of its exact externally determined hash.')
    return value

def phase3_receipt():
    a=read(A);candidate=read(CORRECTION+'candidate.json')
    return {'kind':'MemoryOSRESTIntegratedPhase3Receipt','version':'1.0.0','state':'PASS','C3':C3,'C3B':C3B,'certifications':certifications(),'candidate':candidate['archive'],'artifacts':candidate['corrected'],'limits':ref(P+'contracts/limits.json'),'package':a['package'],'runtimePreservation':ref(CORRECTION+'runtime-preservation.json'),'windows':a['platform'],'toolchain':a['toolchain'],'closureMatrix':ref(E+'closure-matrix.json'),'history':ref(E+'history.json'),'sourceInventory':ref(E+'source-inventory.json'),'overlap':ref(E+'overlap.json'),'harness':ref(E+'harness.json'),'catalog':ref(E+'catalog.json'),'advisory':{'review':ref(D+'mo1305-phase3br/advisory-review.md'),'snapshot':ref(D+'mo1305-phase3br/advisory-snapshot.json'),'limitation':ADVISORY_LIMIT},'blockedCount':0,'pendingCertificationCount':0,'finalBinding':'PENDING','releaseTag':'ABSENT','scope':'Integrates committed certification evidence. No new runtime or resource campaign.'}

def inventory(i3=None):
    value=read(E+'historical-inventory-c3b.json');value['blockers']=[]
    value['platforms']=[{'target':'windows-11-x64','state':'PASS','receipt':ref(A)}]
    value['dependencies']['review']=ref(D+'mo1305-phase3br/advisory-snapshot.json')
    groups={'resource':[D+'mo1305-phase1/resource.json'],'boundary':[D+'mo1305-phase1/boundary.json'],'stress':[D+'mo1305-phase1/stress.json'],'functional':[CORRECTION+'contract-tests.json'],'http':[A],'installation':[D+'mo1305-phase3a-refresh/installation.json',D+'mo1305-phase3br/installed.json'],'package':[B,E+'phase3-receipt.json'],'parity':[D+'mo1305-phase3a-refresh/probe.json'],'platform':[A],'security':[C],'supplyChain':[B]}
    value['receipts']={k:[ref(p) for p in sorted(v)] for k,v in groups.items()}
    if i3:
        value['implementations']['I3']=i3;value['state']='CERTIFIED_READY_TO_TAG'
        value['finalBinding']={'state':'VALIDATED','validatedEvidenceRevision':i3,'receipt':ref(E+'binding.json')}
        value['releaseTag']['state']='READY_TO_TAG'
    return value

def release_inventory():
    v=read(E+'historical-inventory-c3b.json');a=read(A)
    return {'kind':'MemoryOSRESTFinalReleaseInventory','version':'1.0.0','state':'CERTIFICATIONS_COMPLETE_BINDING_PENDING','authority':{k:v[k] for k in ['authorityRevision','contractFreezeRevision','platformCorrectionRevision','verificationCorrectionRevision']},'implementations':v['implementations'],'corrections':{'C3':C3,'C3B':C3B,'receipt':ref(CORRECTION+'binding.json')},'certifications':certifications(),'phases':{'1':'COMPLETE','2':'COMPLETE','3':'COMPLETE'},'certificationStates':{'windows':'PASS','artifact':'PASS','securityAudit':'PASS','ubuntu':'NOT_REQUIRED','linux':'NOT_REQUIRED','vm':'NOT_REQUIRED','crossPlatformParity':'NOT_REQUIRED'},'package':v['package'],'contracts':v['contracts'],'sbom':v['dependencies']['sbom'],'limits':v['contracts']['limits'],'windows':a['platform'],'toolchain':a['toolchain'],'phase3Receipt':ref(E+'phase3-receipt.json'),'closureMatrix':ref(E+'closure-matrix.json'),'historicalAttempts':ref(E+'history.json'),'i3Inventory':ref(E+'i3-inventory.json'),'finalBinding':'PENDING','releaseTag':'ABSENT','advisoryLimitation':ADVISORY_LIMIT,'laterBinding':'BF resolves I3 and this inventory snapshot externally without changing these evidence bytes.'}

def lineage():
    v=read(E+'historical-inventory-c3b.json')
    roles={k:v[k] for k in ['authorityRevision','contractFreezeRevision','platformCorrectionRevision','verificationCorrectionRevision']}
    roles.update({k:r for k,r in v['implementations'].items() if r});roles.update(C3=C3,C3B=C3B)
    roles.update({role:s['commit'] for role,s in SOURCES.items()})
    return [{'role':role,'commit':rev,'parents':textgit('show','-s','--format=%P',rev).split(),'subject':textgit('show','-s','--format=%s',rev)} for role,rev in roles.items()]

def binding_graph(i3):
    return {'kind':'MemoryOSRESTFinalBindingGraph','version':'1.0.0','lineage':lineage()+[{'role':'I3','commit':i3,'parents':[C3B],'subject':I3_SUBJECT}],'validatedEvidenceRevision':i3,'bindingParent':i3,'bindingSubject':BF_SUBJECT,'bindingScope':BF_PATHS,'closure':{'matrix':ref(E+'closure-matrix.json'),'blockedCount':0,'pendingCertificationCount':0,'finalBinding':'VALIDATED_BY_CONTAINING_COMMIT','remainingAction':'RELEASE_TAG_REVIEW'},'releaseTag':{'name':'memoryos-1.3-mo1305','state':'ABSENT','recommendedTargetRole':'BF'},'selfReference':False}

def binding_receipt(i3):
    v=read(E+'i3-inventory.json');a=read(A);h=read(E+'harness.json');validation=read(E+'binding-validation.json')
    projection={'state':'PASS','caseCount':validation['testCount'],'coldSamples':0,'warmSamples':0,'adverseRepetitions':0,'failures':0}
    receipts=sorted([ref(s['receipt']) for s in SOURCES.values()]+[ref(E+'phase3-receipt.json')],key=lambda r:r['path'])
    artifacts=sorted(receipts+[ref(E+n) for n in ['release-inventory.json','closure-matrix.json','history.json','binding-graph.json','binding-validation.json']],key=lambda r:r['path'])
    return {'kind':'MemoryOSRESTReceipt','version':'2.0.0','type':'finalBinding','state':'PASS',**{k:v[k] for k in ['authorityRevision','contractFreezeRevision','platformCorrectionRevision','verificationCorrectionRevision']},'implementationRevision':i3,'bindingRevision':None,'sourceTreeSha256':h['sha256'],'harness':ref(E+'harness.json'),'artifacts':artifacts,'platform':{'target':'windows-11-x64',**a['platform'],'kernel':None},'toolchain':[{'name':k,'version':a['toolchain'][k]['version'],'sha256':a['toolchain'][k]['sha256']} for k in ('node','npm')],'catalog':ref(E+'catalog.json'),'results':[{'id':'final-conformance','state':'PASS','expected':projection,'actual':projection,'artifactRefs':[ref(E+'binding-validation.json')]}],'payload':{'validatedEvidenceRevision':i3,'inventory':ref(E+'i3-inventory.json'),'receipts':receipts,'graph':ref(E+'binding-graph.json'),'validation':ref(E+'binding-validation.json')}}
