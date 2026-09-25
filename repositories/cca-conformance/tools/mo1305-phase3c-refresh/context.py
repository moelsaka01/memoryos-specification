"""Audit-only branch context for the immutable C3 correction validator.

validate() below preserves the original content checks, replacing only its main
branch precondition and HEAD graph lookup with explicit refresh context and C3B.
No historical tool, receipt or production file is modified or monkeypatched.
"""
from pathlib import Path
import sys,json,copy,hashlib
sys.dont_write_bytecode=True
sys.path.insert(0,str(Path(__file__).resolve().parent.parent/'mo1305-phase3-correction'))
from check import *
from distribution import read_package
C3='62a70cafac68e89366740ec197074bd13fbce934'
C3B='4ac43c4368f41ec14ea443aa303bf3a69503f2de'
WORKSPACE=Path('C:/Users/melsa/Documents/Codex/cca-mo1305-3c-refresh')
BRANCH='mo1305/phase3c-refresh'
AUDIT_SUBJECT='audit(memoryos-1.3): refresh MO-1305 REST release review'

def audit_context():
    read_package(ROOT)  # Reject unexpected/ignored members inside shipped roots.
    assert ROOT.resolve()==WORKSPACE.resolve(),'AUDIT_WORKSPACE'
    assert git('branch','--show-current').decode().strip()==BRANCH,'AUDIT_BRANCH'
    head=git('rev-parse','HEAD').decode().strip()
    if head!=C3B:
        assert git('show','-s','--format=%P',head).decode().strip()==C3B,'AUDIT_PARENT'
        assert git('show','-s','--format=%s',head).decode().strip()==AUDIT_SUBJECT,'AUDIT_SUBJECT'
    names=git('diff','--name-only',C3B).decode().splitlines()+git('ls-files','--others','--exclude-standard').decode().splitlines()
    assert all(n.startswith('repositories/cca-conformance/tools/mo1305-phase3c-refresh/') or n.startswith('repositories/cca-conformance/evidence/mo1305-phase3c-refresh/') or n=='docs/mo1305-phase3c-refresh.md' for n in names),'AUDIT_SCOPE'
    assert not git('diff','--name-only',C3B,'--','repositories/memoryos-rest').strip(),'PRODUCTION_CHANGED'
    return {'workspace':str(ROOT),'branch':BRANCH,'head':head}

def graph_snapshot(require_binding=True):
    assert git('show','-s','--format=%P',C3).decode().strip()==BASELINE,'C3_PARENT'
    assert git('show','-s','--format=%s',C3).decode().strip()==C3_SUBJECT,'C3_SUBJECT'
    assert git('diff','--name-only',BASELINE,C3).decode().splitlines()==read(E+'c3-scope.json'),'C3_SCOPE'
    assert git('show','-s','--format=%P',C3B).decode().strip()==C3,'C3B_PARENT'
    assert git('show','-s','--format=%s',C3B).decode().strip()==BIND_SUBJECT,'C3B_SUBJECT'
    assert git('diff','--name-only',C3,C3B).decode().splitlines()==[E+'binding.json'],'C3B_SCOPE'
    check_binding(read(E+'binding.json'),C3)
    committed=blobs(C3,[PKG_REL+'/'+n for n in PATHS])
    assert all(committed[PKG_REL+'/'+n]==(ROOT/PKG_REL/n).read_bytes() for n in PATHS),'C3_PACKAGE_CHANGED'
    rows=[]
    for label,rev in [('B2',BASELINE),('C3',C3),('C3B',C3B)]:
        rows.append({'role':label,'commit':rev,'subject':git('show','-s','--format=%s',rev).decode().strip(),'parents':git('show','-s','--format=%P',rev).decode().strip().split()})
    assert rows[0]['subject']=='conformance(memoryos-1.3): bind MO-1305 phase 2 integration','B2_SUBJECT'
    assert rows[0]['parents']==['05fc7c621af7343538cadee882b875ce7e5e783f'],'B2_PARENT'
    return {'state':'PASS','candidate':C3B,'commits':rows,'binding':reference(E+'binding.json')}

def validate(require_binding=False,parallel=False):
    assert not parallel,'OTHER_WORKTREE_ACCESS_FORBIDDEN';audit_context();base=read(H+'baseline.json')
    assert not git('tag','--list','memoryos-1.3-mo1305').strip()
    for tag in base['predecessorTags']:
        assert git('rev-parse',tag['name']).decode().strip()==tag['object'];assert git('rev-parse',tag['name']+'^{}').decode().strip()==tag['target']
    old_archive=ROOT/'.cache/mo1305-phase2d/build/memoryos-rest-0.1.0.tgz';assert identity(old_archive.read_bytes())==base['old']['archive']
    refs(read(E+'validation-tooling.json')['files'])
    candidate=read(E+'candidate.json');refs([candidate['archive'],*candidate['corrected'].values(),*candidate['evidence']])
    verified=verify_archive(ROOT/candidate['archive']['path'],candidate['archive']['sha256']);assert all((ROOT/PKG_REL/n).read_bytes()==b for n,b in verified['files'].items())
    assert candidate['state']=='TARGETED_VALIDATION_PASS' and candidate['finalBinding']=='PENDING' and candidate['releaseTag']=='ABSENT'
    assert candidate['phase3']=={'A':{'historicalState':'PASS','archive':'af99ba13fa96c5b5ded130a871c671243fb3fadd07f74eefa9b6ae2e601d182a','currentState':'REFRESH_REQUIRED'},'B':{'historicalState':'STOPPED_RELEASE_ARTIFACT_DEFECT','blocker':'RESOLVED_BY_CORRECTION','currentState':'REFRESH_REQUIRED'},'C':{'historicalState':'STOPPED_RELEASE_BLOCKER','blocker':'RESOLVED_BY_CORRECTION','currentState':'FINAL_AUDIT_REFRESH_REQUIRED'}}
    assert candidate['schema']==verify_schema(read(PKG_REL+'/sbom.spdx.json'))
    assert read(E+'generated-fields.json')==field_inventory(read(PKG_REL+'/sbom.spdx.json'))
    assert candidate['inventory']==verified['inventory'];assert candidate['spdx']==verify_spdx(read(PKG_REL+'/sbom.spdx.json'),verified['files'])
    assert runtime_proof()==read(E+'runtime-preservation.json')
    source=read(E+'source-tree.json');refs(source['files']);assert hashlib.sha256(j(source['files'])).hexdigest()==source['sha256'];assert read(PKG_REL+'/dependency-manifest.json')['sourceTreeSha256']==source['sha256']
    execution=read(E+'execution.json');assert execution['state']=='PASS' and execution['result']['code']==0 and execution['timeout'] is False
    assert execution['host']['observation']['classification']=='NORMAL' and execution['host']['observation']['evidenceState']=='AVAILABLE';refs(execution['inputs']+[execution['log'],execution['installed']])
    installed=read(E+'installed.json');assert installed['state']=='PASS' and installed['archive']=={k:candidate['archive'][k] for k in ['byteLength','sha256']};assert len(installed['installations'])==1
    result=installed['installations'][0];assert result['state']=='PASS' and result['fileCount']==58 and result['everyFileMatchesBeforeAndAfter'];assert len(result['execution']['requests'])==6 and len(result['execution']['remote']['requests'])==2
    assert installed['offline']['installCacheInitiallyEmpty'] and all(installed['offline'][k] for k in ['offlineMode','scriptsDisabled','auditDisabled','fundDisabled','installedPackageMatchesArchive']);assert installed['temporaryCredentialsRemoved']
    tests=read(E+'metadata-tests.json');assert tests['state']=='PASS' and tests['caseCount']==34 and all(c['state']=='PASS' for c in tests['cases'])
    contract=read(E+'contract-tests.json');assert contract['pass']==contract['tests']==12 and contract['fail']==0;refs(contract['sources'])
    repro=read(E+'reproducibility.json');assert repro['packageInventoriesIdentical'] and repro['byteIdentical'] and repro['independentCleanRoots'] and repro['separateBuilderProcesses'];refs(repro['assemblies']);assert all((ROOT/x['path']).read_bytes()==(ROOT/candidate['archive']['path']).read_bytes() for x in repro['assemblies'])
    assert read(INVENTORY)==expected_inventory(),'CURRENT_INVENTORY'
    report={'state':'PASS','archive':verified['archive'],'fileCount':58,'runtimeUnchanged':52,'metadataCases':34,'contractTests':12,'graph':graph_snapshot(require_binding)}
    for row in read(E+'starting-audit.json')['paths']:
        if row['path'].startswith(H) and not row['path'].startswith(E):
            assert reference(row['path'])=={k:row[k] for k in ('path','byteLength','sha256')},'HISTORICAL_EVIDENCE_CHANGED'
    provisional=read(H+'final/dirty-tree-audit.json')['provisional']
    refs([provisional['archive']])
    assert identity((ROOT/(H+'history/provisional-sbom.spdx.json')).read_bytes())=={k:provisional['sbom.spdx.json'][k] for k in ('byteLength','sha256')}
    if parallel:report['parallel']=parallel_proof()
    return report


if __name__=='__main__':
    print(json.dumps(validate(True)))
