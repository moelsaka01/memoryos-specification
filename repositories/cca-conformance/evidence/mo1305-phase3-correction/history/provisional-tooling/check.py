"""Read-only release metadata, runtime preservation, evidence and correction graph gate."""
from pathlib import Path
import argparse,copy,hashlib,json,os,subprocess
from distribution import verify_archive,verify_files,identity,j,ref,PATHS,ROOT,PKG_REL,BASELINE
from spdx import verify_spdx
HERE=Path(__file__).resolve().parent
E='repositories/cca-conformance/evidence/mo1305-phase3-correction/'
INVENTORY='repositories/cca-conformance/mo1305-conformance-inventory.json'
C3_SUBJECT='fix(memoryos-1.3): correct MO-1305 release metadata'
BIND_SUBJECT='conformance(memoryos-1.3): bind MO-1305 release metadata correction'
CHANGED=['contracts/api-contract.json','contracts/openapi.json','dependency-manifest.json','distribution-manifest.json','sbom.spdx.json','scripts/verify-contracts.mjs']

def git(*args,cwd=ROOT):
    return subprocess.check_output(['git','-c','safe.directory='+cwd.as_posix(),'-C',str(cwd),*args],env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'})
def read(path):return json.loads((ROOT/path).read_bytes())
def reference(path):return ref(path,(ROOT/path).read_bytes())
def refs(rows):
    for row in rows:
        assert not Path(row['path']).is_absolute() and '..' not in Path(row['path']).parts,'UNSAFE_REFERENCE'
        assert reference(row['path'])==row,'REFERENCE_DRIFT:'+row['path']
def blobs(revision,names):
    data=git('cat-file','--batch',cwd=ROOT) if not names else subprocess.check_output(['git','cat-file','--batch'],cwd=ROOT,input=''.join(revision+':'+n+'\n' for n in names).encode(),env={**os.environ,'GIT_OPTIONAL_LOCKS':'0'})
    out={};offset=0
    for name in names:
        end=data.index(b'\n',offset);parts=data[offset:end].split();assert len(parts)==3 and parts[1]==b'blob';size=int(parts[2]);offset=end+1;out[name]=data[offset:offset+size];offset+=size+1
    return out

def runtime_proof():
    names=[PKG_REL+'/'+n for n in PATHS];before=blobs(BASELINE,names);rows=[];changed=[]
    for name in names:
        old=before[name];current=(ROOT/name).read_bytes()
        if old!=current:changed.append(name[len(PKG_REL)+1:])
        else:rows.append(ref(name,current))
    assert sorted(changed)==CHANGED,'UNAUTHORIZED_PRODUCTION_CHANGE'
    old_api=json.loads(before[PKG_REL+'/contracts/api-contract.json']);new_api=read(PKG_REL+'/contracts/api-contract.json');deployment=new_api.pop('deployment')
    assert old_api==new_api,'RUNTIME_CONTRACT_CHANGED'
    assert deployment=={'defaultMode':'local','remoteMode':{'mode':'remote','implemented':True,'explicitOptIn':True,'bindAddressPolicy':'assigned RFC1918 IPv4'}}
    old_openapi=json.loads(before[PKG_REL+'/contracts/openapi.json']);new_openapi=read(PKG_REL+'/contracts/openapi.json')
    old_openapi['x-memoryos-http']['behavior']['remoteMode']=deployment['remoteMode'];assert old_openapi==new_openapi,'UNRELATED_OPENAPI_CHANGE'
    executable=[row for row in rows if row['path'].startswith(PKG_REL+'/src/') or row['path'].startswith(PKG_REL+'/bin/') or row['path'].startswith(PKG_REL+'/runtime/authoritative/')]
    return {'state':'PASS','baseline':BASELINE,'byteIdenticalCount':len(rows),'executableRuntimeCount':len(executable),'byteIdentical':rows,'metadataChanges':CHANGED,'runtimeContractUnchanged':True,'schemas':identity(j(old_api['schemas'])),'onlyOpenAPIChange':'/x-memoryos-http/behavior/remoteMode'}

def parallel_proof():
    for row in read(E+'parallel-inputs.json'):
        w=Path(row['worktree']);assert git('rev-parse','HEAD',cwd=w).decode().strip()==row['head'];assert git('status','--porcelain',cwd=w).decode()==row['status']
        names=sorted(set(filter(None,git('ls-files','-co','--exclude-standard','-z',cwd=w).decode().split('\0'))));files=[ref(n,(w/n).read_bytes()) for n in names if (w/n).is_file()]
        assert len(files)==row['fileCount'] and hashlib.sha256(j(files)).hexdigest()==row['filesSha256'],'PARALLEL_WORKTREE_CHANGED'
    return {'state':'PASS','worktrees':6}

def expected_inventory():
    inventory=read(E+'historical-inventory-b2.json');candidate=read(E+'candidate.json')
    inventory['state']='CERTIFICATION_PENDING';inventory['implementations']['B2']=BASELINE
    inventory['package'].update(archive=candidate['archive'],distributionManifest=reference(PKG_REL+'/distribution-manifest.json'),sourceTreeSha256=read(E+'source-tree.json')['sha256'])
    for key in ['apiSchema','openapi','limits','policyIdentities']:inventory['contracts'][key]=reference(inventory['contracts'][key]['path'])
    for key in ['manifest','sbom']:inventory['dependencies'][key]=reference(inventory['dependencies'][key]['path'])
    inventory['dependencies']['review']=reference(E+'candidate.json')
    inventory['receipts']={key:[] for key in inventory['receipts']}
    inventory['receipts']['package']=[reference(E+'candidate.json'),reference(E+'metadata-tests.json'),reference(E+'reproducibility.json')]
    inventory['receipts']['supplyChain']=[reference(E+'metadata-tests.json')]
    inventory['receipts']['installation']=[reference(E+'execution.json')]
    inventory['receipts']['functional']=[reference(E+'contract-tests.json')]
    inventory['blockers']=['PHASE3A_REFRESH_REQUIRED','PHASE3B_REFRESH_REQUIRED','PHASE3C_REFRESH_REQUIRED']
    return inventory

def binding(c3):
    candidate=read(E+'candidate.json')
    return {'kind':'MemoryOSRESTReleaseMetadataCorrectionBinding','version':'1.0.0','baseline':BASELINE,'implementation':c3,'implementationSubject':C3_SUBJECT,'candidate':reference(E+'candidate.json'),'old':read(E+'baseline.json')['old'],'corrected':candidate['corrected'],'archive':candidate['archive'],'runtimePreservation':reference(E+'runtime-preservation.json'),'evidence':candidate['evidence'],'phase3':candidate['phase3'],'finalBinding':'PENDING','releaseTag':'ABSENT'}

def graph(require_binding=False):
    head=git('rev-parse','HEAD').decode().strip();subject=git('log','-1','--format=%s').decode().strip();path=ROOT/(E+'binding.json')
    if head==BASELINE:
        assert not require_binding and not path.exists();return {'state':'PASS','role':'PRE_C3','head':head}
    value=read(E+'binding.json') if path.exists() else None
    c3=value['implementation'] if value else head
    assert git('show','-s','--format=%P',c3).decode().strip()==BASELINE,'C3_PARENT'
    assert git('show','-s','--format=%s',c3).decode().strip()==C3_SUBJECT,'C3_SUBJECT'
    actual=git('diff','--name-only',BASELINE,c3).decode().splitlines();assert actual==read(E+'c3-scope.json'),'C3_SCOPE'
    if value:assert value==binding(c3),'BINDING_CONTENT'
    if head==c3:
        assert not require_binding;return {'state':'PASS','role':'C3','head':head}
    assert value is not None and subject==BIND_SUBJECT and git('rev-parse','HEAD^').decode().strip()==c3,'C3B_GRAPH'
    assert git('diff','--name-only',c3,head).decode().splitlines()==[E+'binding.json'],'C3B_SCOPE'
    return {'state':'PASS','role':'C3B','head':head,'implementation':c3,'parent':c3}

def validate(require_binding=False,parallel=False):
    base=read(E+'baseline.json');assert git('branch','--show-current').decode().strip()=='main'
    assert not git('tag','--list','memoryos-1.3-mo1305').strip()
    for tag in base['predecessorTags']:
        assert git('rev-parse',tag['name']).decode().strip()==tag['object'];assert git('rev-parse',tag['name']+'^{}').decode().strip()==tag['target']
    old_archive=ROOT/'.cache/mo1305-phase2d/build/memoryos-rest-0.1.0.tgz';assert identity(old_archive.read_bytes())==base['old']['archive']
    candidate=read(E+'candidate.json');refs([candidate['archive'],*candidate['corrected'].values(),*candidate['evidence']])
    verified=verify_archive(ROOT/candidate['archive']['path'],candidate['archive']['sha256']);assert all((ROOT/PKG_REL/n).read_bytes()==b for n,b in verified['files'].items())
    assert candidate['inventory']==verified['inventory'];assert candidate['spdx']==verify_spdx(read(PKG_REL+'/sbom.spdx.json'),verified['files'])
    assert runtime_proof()==read(E+'runtime-preservation.json')
    source=read(E+'source-tree.json');refs(source['files']);assert hashlib.sha256(j(source['files'])).hexdigest()==source['sha256'];assert read(PKG_REL+'/dependency-manifest.json')['sourceTreeSha256']==source['sha256']
    execution=read(E+'execution.json');assert execution['state']=='PASS' and execution['result']['code']==0 and execution['timeout'] is False
    assert execution['host']['observation']['classification']=='NORMAL' and execution['host']['observation']['evidenceState']=='AVAILABLE';refs(execution['inputs']+[execution['log'],execution['installed']])
    installed=read(E+'installed.json');assert installed['state']=='PASS' and installed['archive']=={k:candidate['archive'][k] for k in ['byteLength','sha256']};assert len(installed['installations'])==1
    result=installed['installations'][0];assert result['state']=='PASS' and result['fileCount']==58 and result['everyFileMatchesBeforeAndAfter'];assert len(result['execution']['requests'])==6 and len(result['execution']['remote']['requests'])==2
    assert installed['offline']['installCacheInitiallyEmpty'] and all(installed['offline'][k] for k in ['offlineMode','scriptsDisabled','auditDisabled','fundDisabled','installedPackageMatchesArchive']);assert installed['temporaryCredentialsRemoved']
    tests=read(E+'metadata-tests.json');assert tests['state']=='PASS' and tests['caseCount']==21 and all(c['state']=='PASS' for c in tests['cases'])
    contract=read(E+'contract-tests.json');assert contract['pass']==contract['tests']==12 and contract['fail']==0;refs(contract['sources'])
    repro=read(E+'reproducibility.json');assert repro['byteIdentical'] and repro['independentCleanRoots'] and repro['separateBuilderProcesses'];refs(repro['assemblies']);assert all((ROOT/x['path']).read_bytes()==(ROOT/candidate['archive']['path']).read_bytes() for x in repro['assemblies'])
    assert read(INVENTORY)==expected_inventory(),'CURRENT_INVENTORY'
    report={'state':'PASS','archive':verified['archive'],'fileCount':58,'runtimeUnchanged':52,'metadataCases':21,'contractTests':12,'graph':graph(require_binding)}
    if parallel:report['parallel']=parallel_proof()
    return report

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--require-binding',action='store_true');p.add_argument('--parallel',action='store_true');a=p.parse_args();print(json.dumps(validate(a.require_binding,a.parallel)))
