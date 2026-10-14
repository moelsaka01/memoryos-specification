"""Bounded final MO-1305 release conformance; no service or install campaign."""
import argparse, copy, subprocess, sys
from common import *
import models
GATES=['contract','graph','correction','openapi','spdx','package','windows','artifact','audit','closure','receipts','inventory','candidate','historical','tag','tooling','scope','rebuild']

def same(actual,expected,label): need(actual==expected,label)

def candidate_identity(values):
    a,b,c=values
    same(a['archive'],ARCHIVE,'WINDOWS_ARCHIVE')
    same({k:b['archive'][k] for k in ARCHIVE},ARCHIVE,'ARTIFACT_ARCHIVE')
    same({k:c['identities']['archive'][k] for k in ARCHIVE},ARCHIVE,'AUDIT_ARCHIVE')
    for name,key in [('openapi','contracts/openapi.json'),('sbom','sbom.spdx.json')]:
        expected=identity((ROOT/P/key).read_bytes())
        same(a[name],expected,'WINDOWS_'+name)
        same({k:b['artifacts'][key][k] for k in expected},expected,'ARTIFACT_'+name)
        same({k:c['identities'][key][k] for k in expected},expected,'AUDIT_'+name)
    need(all(v['state']=='PASS' for v in values),'CERTIFICATION_PASS')
    same((a['implementationRevision'],a['bindingRevision'],b['C3'],b['C3B'],c['graph']['candidate']),(C3,C3B,C3,C3B,C3B),'CERTIFICATION_LINEAGE')
    same((a['package']['fileCount'],b['package']['files'],a['package']['authoritativeClosureCount'],b['package']['authoritativeRuntimeFiles']),(58,58,25,25),'PACKAGE_COUNTS')
    same((a['package']['externalProductionDependencies'],b['package']['externalProductionNpmDependencies']),(0,0),'DEPENDENCIES')
    same(a['results']['hostInterruptionCount'],0,'HOST_INTERRUPTION')

def graph_values(head,parent,subject,changed,i3):
    if head==C3B:
        same(parent,C3,'BASE_PARENT');return 'PRE_I3'
    if subject==I3_SUBJECT:
        same(parent,C3B,'I3_PARENT');same(changed,read(E+'integration-scope.json'),'I3_SCOPE');return 'I3'
    same(subject,BF_SUBJECT,'BF_SUBJECT');same(parent,i3,'BF_PARENT')
    same(changed,BF_PATHS,'BF_SCOPE');need(i3!=head and i3!=C3B,'BINDING_SELF_REFERENCE')
    same(textgit('show','-s','--format=%P',i3),C3B,'I3_PARENT')
    same(textgit('show','-s','--format=%s',i3),I3_SUBJECT,'I3_SUBJECT')
    same(git('diff','--name-only',C3B,i3).decode().splitlines(),read(E+'integration-scope.json'),'I3_SCOPE')
    return 'BF'

def graph():
    head=textgit('rev-parse','HEAD');parent=textgit('show','-s','--format=%P',head);subject=textgit('show','-s','--format=%s',head)
    inv=read(INVENTORY);i3=inv['implementations']['I3']
    role=graph_values(head,parent,subject,git('diff','--name-only',parent,head).decode().splitlines(),i3)
    if role=='I3':same((ROOT/(E+'i3-inventory.json')).read_bytes(),git('show',head+':'+INVENTORY),'I3_INVENTORY_SNAPSHOT')
    if role=='BF':
        same((ROOT/(E+'i3-inventory.json')).read_bytes(),git('show',i3+':'+INVENTORY),'I3_INVENTORY_SNAPSHOT')
        same(read(E+'binding-graph.json'),models.binding_graph(i3),'BINDING_GRAPH')
        same(read(E+'binding.json'),models.binding_receipt(i3),'BINDING_RECEIPT')
        refs(read(E+'binding.json'))
        validate_binding_validation(read(E+'binding-validation.json'),i3)
    elif inv['finalBinding']['state']=='VALIDATED':
        # Reviewable BF working tree, parent is already committed I3.
        need(role=='I3' and i3==head,'PRE_BINDING_I3')
        same(read(E+'binding.json'),models.binding_receipt(i3),'PRE_BINDING_RECEIPT')
        same(read(E+'binding-graph.json'),models.binding_graph(i3),'PRE_BINDING_GRAPH')
        validate_binding_validation(read(E+'binding-validation.json'),i3)
    return {'state':'PASS','role':role,'head':head,'parent':parent,'I3':i3,'tagTarget':head if role=='BF' else None}

def validate_binding_validation(value,i3):
    same(set(value),{'kind','version','state','validatedEvidenceRevision','testCount','testResult','preBindingValidation','validationTooling','committedEvidenceValidation','workspace','diffCheck'},'BINDING_VALIDATION_FIELDS')
    need(value['kind']=='MemoryOSRESTFinalBindingValidation' and value['version']=='1.0.0' and value['state']=='PASS' and value['validatedEvidenceRevision']==i3,'BINDING_VALIDATION_STATE')
    same(value['testResult'],ref(E+'final-conformance.tap'),'BINDING_TEST_LOG')
    same(value['preBindingValidation'],ref(E+'pre-binding-validation.json'),'BINDING_PRECHECK')
    same(value['validationTooling'],ref(E+'harness.json'),'BINDING_TOOLS')
    observed=value['committedEvidenceValidation']
    need(observed['state']=='PASS' and observed['graph']['role']=='I3' and observed['graph']['head']==i3 and observed['schemaErrors']==0,'COMMITTED_EVIDENCE_VALIDATION')
    need(set(observed['gates'])==set(GATES) and all(g['state']=='PASS' for g in observed['gates'].values()),'COMMITTED_EVIDENCE_GATES')
    need(len(observed['negativeWitnesses'])==22 and all(n['state']=='PASS' for n in observed['negativeWitnesses']),'COMMITTED_EVIDENCE_NEGATIVES')
    need(value['workspace']=='PASS' and value['diffCheck']=='PASS','BINDING_VALIDATION_GATES')
    log=(ROOT/value['testResult']['path']).read_text()
    need(f"# tests {value['testCount']}\n" in log and f"# pass {value['testCount']}\n" in log and '# fail 0\n' in log,'BINDING_TEST_COUNTS')
    for counter in ('skipped','cancelled','todo'):need(f'# {counter} 0\n' in log,'BINDING_TEST_COVERAGE')
    refs(value)

def historical_integrity():
    source_integrity()
    # Existing authority/evidence/tooling remain unchanged except four declared
    # registrations and the current global inventory, whose history is retained.
    changed=git('diff','--name-only',C3B).decode().splitlines()
    baseline=set(git('ls-tree','-r','--name-only',C3B).decode().splitlines())
    need(set(changed)&baseline <= set(REGISTRATION+[INVENTORY]),'HISTORICAL_BASELINE_MUTATION')
    for row in read(E+'source-inventory.json'):
        s=SOURCES[row['role']];same(row,{'role':row['role'],**s,'files':[ref(n) for n in source_paths(s)]},'SOURCE_INVENTORY')
    same(read(E+'historical-inventory-c3b.json'),json.loads(git('show',C3B+':'+INVENTORY)),'HISTORICAL_INVENTORY')
    same(read(E+'history.json'),models.history(),'HISTORICAL_DISPOSITIONS');refs(read(E+'history.json'))

def inventory_check(value):
    same(value,models.inventory(value['implementations']['I3']),'FINAL_INVENTORY')
    need(sum(len(x) for x in value['receipts'].values())<=64,'RECEIPT_BOUND')
    refs(value)

def scope():
    sources={n for s in SOURCES.values() for n in source_paths(s)}
    changed=set(git('diff','--name-only',C3B).decode().splitlines()+git('ls-files','--others','--exclude-standard').decode().splitlines())
    allowed=sources|set(REGISTRATION+[INVENTORY,'docs/mo1305-phase3d-release.md','repositories/cca-conformance/tests/mo1305_phase3_conformance_test.mjs'])
    need(all(n in allowed or n.startswith(T) or n.startswith(E) for n in changed),'INTEGRATION_SCOPE')
    need(not any(n.startswith(P) for n in changed),'RUNTIME_SCOPE')
    if (ROOT/(E+'integration-scope.json')).exists():
        expected=set(read(E+'integration-scope.json'));need(changed-set(BF_PATHS)<=expected,'UNRECORDED_INTEGRATION_PATH')


def run_source(role):
    result=subprocess.run([sys.executable,'-B','-X','utf8',str(ROOT/T/'source_validation.py'),role],cwd=ROOT,capture_output=True,timeout=120)
    need(result.returncode==0,'SOURCE_VALIDATION_'+role+':'+result.stderr.decode(errors='replace')[-3000:])
    value=json.loads(result.stdout);need(value['state']=='PASS','SOURCE_RESULT');return value

def negatives():
    result=[]
    def reject(label,original,change,validator):
        value=copy.deepcopy(original);change(value)
        try:validator(value)
        except (ValueError,AssertionError,KeyError,TypeError):result.append({'id':label,'state':'PASS','outcome':'REJECTED'})
        else:raise ValueError('MUTATION_ACCEPTED:'+label)
    receipts=[read(s['receipt']) for s in SOURCES.values()]
    for index,key in [(0,'archive'),(1,'archive')]:
        reject('candidate-drift-'+str(index),receipts,lambda v,i=index,k=key:v[i][k].update(sha256='0'*64),candidate_identity)
    reject('audit-candidate-drift',receipts,lambda v:v[2]['identities']['archive'].update(sha256='0'*64),candidate_identity)
    reject('false-certification-pass',receipts,lambda v:v[0].update(state='FAIL'),candidate_identity)
    reject('wrong-certification-lineage',receipts,lambda v:v[1].update(C3B='0'*40),candidate_identity)
    reject('host-interruption-hidden',receipts,lambda v:v[0]['results'].update(hostInterruptionCount=1),candidate_identity)
    expected=models.matrix();check=lambda x:same(x,expected,'MATRIX')
    reject('pending-refresh-not-resolved',expected,lambda v:v.update(pendingExternalCertificationCount=1),check)
    reject('missing-closure-requirement',expected,lambda v:v['requirements'].pop(),check)
    reject('forged-closure-proof',expected,lambda v:v['requirements'][0]['evidenceIdentity'][0].update(sha256='0'*64),check)
    reject('wrong-windows-certification-commit',expected,lambda v:v['externalRefreshes']['3A-R'].update(commit='0'*40),check)
    reject('blocked-closure',expected,lambda v:v.update(blockedCount=1),check)
    expected=models.phase3_receipt();check=lambda x:same(x,expected,'PHASE3_RECEIPT')
    reject('unknown-receipt-field',expected,lambda v:v.update(unverified=True),check)
    reject('unbounded-advisory-claim',expected,lambda v:v['advisory'].update(limitation='Zero vulnerabilities'),check)
    reject('receipt-self-reference',expected,lambda v:v.update(selfCommit='f'*40),check)
    value=read(INVENTORY)
    reject('premature-or-wrong-binding',value,lambda v:v['finalBinding'].update(validatedEvidenceRevision='0'*40),inventory_check)
    reject('false-platform-pass',value,lambda v:v['platforms'][0].update(state='FAIL'),inventory_check)
    reject('wrong-final-inventory-archive',value,lambda v:v['package']['archive'].update(sha256='0'*64),inventory_check)
    expected=models.history();check=lambda x:same(x,expected,'HISTORY')
    reject('failed-attempt-promoted',expected,lambda v:v['attempts'][5].update(state='PASS'),check)
    for label,raw in [('duplicate-json',b'{"a":1,"a":2}'),('noncanonical-json',b'{ "a":1}')]:
        try:parse(raw)
        except ValueError:result.append({'id':label,'state':'PASS','outcome':'REJECTED'})
        else:need(False,'INVALID_JSON_ACCEPTED')
    # A product-bearing or wrong-parent final binding cannot pass the graph gate.
    for label,parent,paths in [('binding-runtime-mutation','d'*40,BF_PATHS+[P+'src/server.mjs']),('binding-wrong-parent','0'*40,BF_PATHS)]:
        try:graph_values('e'*40,parent,BF_SUBJECT,paths,'d'*40)
        except ValueError:result.append({'id':label,'state':'PASS','outcome':'REJECTED'})
        else:need(False,'INVALID_GRAPH_ACCEPTED')
    return result

def validate():
    context();scope();historical_integrity()
    sources=[read(s['receipt']) for s in SOURCES.values()];candidate_identity(sources)
    import correction
    correction_result=correction.validate(True)
    from distribution import read_package,verify_archive
    from schema_validation import verify_schema,field_inventory
    from metadata_test import run as metadata_tests
    candidate=read(models.CORRECTION+'candidate.json');verified=verify_archive(ROOT/candidate['archive']['path'],ARCHIVE['sha256'])
    same(verified['archive'],ARCHIVE,'CANDIDATE_ARCHIVE')
    read_package(ROOT)
    same(verify_schema(read(P+'sbom.spdx.json'))['totalErrors'],0,'SCHEMA_ERRORS')
    same(field_inventory(read(P+'sbom.spdx.json')),read(models.CORRECTION+'generated-fields.json'),'GENERATED_FIELDS')
    metadata=metadata_tests(ROOT/candidate['archive']['path']);same(metadata,read(models.CORRECTION+'metadata-tests.json'),'METADATA_NEGATIVES')
    replay={role:run_source(role) for role in SOURCES}
    same(read(E+'overlap.json'),models.overlap(),'OVERLAP')
    same(read(E+'closure-matrix.json'),models.matrix(),'CLOSURE');refs(read(E+'closure-matrix.json'))
    same(read(E+'phase3-receipt.json'),models.phase3_receipt(),'PHASE3_RECEIPT');refs(read(E+'phase3-receipt.json'))
    same(read(E+'release-inventory.json'),models.release_inventory(),'RELEASE_INVENTORY')
    inventory_check(read(INVENTORY));same(read(E+'i3-inventory.json'),models.inventory(),'I3_INVENTORY')
    harness=read(E+'harness.json');refs(harness['files']);same(identity(j(harness['files']))['sha256'],harness['sha256'],'HARNESS_HASH')
    graph_result=graph()
    rebuild=read(E+'rebuild.json');same(rebuild['archive'],ARCHIVE,'REBUILT_ARCHIVE');refs(rebuild['artifact'])
    # Tag absence and all predecessor tag objects/targets are release gates.
    need(not git('tag','--list','memoryos-1.3-mo1305').strip(),'TAG_PRESENT')
    for tag in read(D+'mo1305-phase3-correction/baseline.json')['predecessorTags']:
        same(textgit('rev-parse',tag['name']),tag['object'],'PREDECESSOR_TAG_OBJECT');same(textgit('rev-parse',tag['name']+'^{}'),tag['target'],'PREDECESSOR_TAG_TARGET')
    api=read(P+'contracts/api-contract.json');need(len(api['routes'])==9 and sum(r['category']=='semantic' for r in api['routes'])==6,'CONTRACT_ROUTES')
    return {'state':'PASS','gates':{name:{'state':'PASS'} for name in GATES},'sourceValidation':replay,'graph':graph_result,'archive':ARCHIVE,'schemaErrors':0,'metadataCases':34,'gatewayCampaignsExecuted':0,'negativeWitnesses':negatives()}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--worktrees',action='store_true');a=p.parse_args()
    result=validate()
    if a.worktrees:same(worktrees(),read(E+'source-worktrees.json'),'SOURCE_WORKTREE_CHANGED');result['worktreesPreserved']=9
    print(json.dumps(result,sort_keys=True))
