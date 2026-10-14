"""Create reviewable I3 evidence or the four-file BF binding, never commits/tags."""
import argparse,re,subprocess
from common import *
import models
from validate import GATES,validate,validate_binding_validation

def integrate():
    need(textgit('rev-parse','HEAD')==C3B,'INTEGRATION_BASELINE')
    context()
    save(E+'catalog.json',{'kind':'MemoryOSRESTFinalConformanceCatalog','version':'1.0.0','gates':GATES,'negativeWitnessCount':22,'nodeSchemaOpenAPIRegistrationTests':3,'expectedTestCount':43,'runtimeCampaigns':0})
    files=sorted([p.relative_to(ROOT).as_posix() for p in (ROOT/T).iterdir() if p.is_file()]+REGISTRATION+['repositories/cca-conformance/tests/mo1305_phase3_conformance_test.mjs',E+'catalog.json'])
    rows=[ref(n) for n in files];save(E+'harness.json',{'kind':'MemoryOSRESTFinalConformanceHarness','version':'1.0.0','files':rows,'sha256':identity(j(rows))['sha256']})
    save(E+'overlap.json',models.overlap());save(E+'history.json',models.history());save(E+'closure-matrix.json',models.matrix())
    save(E+'phase3-receipt.json',models.phase3_receipt());value=models.inventory();save(INVENTORY,value);save(E+'i3-inventory.json',value)
    save(E+'release-inventory.json',models.release_inventory())
    path='.cache/mo1305-phase3d/rebuild/memoryos-rest-0.1.0.tgz';need(identity((ROOT/path).read_bytes())==ARCHIVE,'REBUILD_CHANGED')
    save(E+'rebuild.json',{'state':'PASS','archive':ARCHIVE,'artifact':ref(path),'sourceCandidate':C3B,'purpose':'One integration archive rebuild verifies unchanged candidate bytes; no metadata write and no certification rerun.'})
    paths=sorted(set(git('diff','--name-only',C3B).decode().splitlines()+git('ls-files','--others','--exclude-standard').decode().splitlines()+[E+n for n in ['integration-scope.json','final-conformance.tap','pre-binding-validation.json','workspace.log']]))
    save(E+'integration-scope.json',paths)
    print(json.dumps({'state':'PASS','integrationFiles':len(paths),'blocked':0,'pendingExternal':0}))

def bind():
    i3=textgit('rev-parse','HEAD');need(textgit('show','-s','--format=%s',i3)==I3_SUBJECT and textgit('show','-s','--format=%P',i3)==C3B,'EXISTING_I3_REQUIRED')
    need(not git('status','--porcelain').strip(),'BINDING_REQUIRES_CLEAN_I3')
    committed_validation=validate()
    workspace=subprocess.run([sys.executable,'-B','-X','utf8','tools/verify_workspace.py','--root','.'],cwd=ROOT,capture_output=True,timeout=120)
    need(workspace.returncode==0,'COMMITTED_WORKSPACE_VERIFICATION')
    git('diff','--check','HEAD^','HEAD')
    same=(ROOT/(E+'i3-inventory.json')).read_bytes()==git('show',i3+':'+INVENTORY);need(same,'I3_INVENTORY_BYTES')
    log=(ROOT/(E+'final-conformance.tap')).read_text();count=int(re.search(r'^# tests (\d+)$',log,re.M)[1]);need(count==43,'CONFORMANCE_COUNT')
    value={'kind':'MemoryOSRESTFinalBindingValidation','version':'1.0.0','state':'PASS','validatedEvidenceRevision':i3,'testCount':count,'testResult':ref(E+'final-conformance.tap'),'preBindingValidation':ref(E+'pre-binding-validation.json'),'validationTooling':ref(E+'harness.json'),'committedEvidenceValidation':committed_validation,'workspace':'PASS','diffCheck':'PASS'}
    validate_binding_validation(value,i3)
    save(E+'binding-validation.json',value);save(E+'binding-graph.json',models.binding_graph(i3));save(E+'binding.json',models.binding_receipt(i3));save(INVENTORY,models.inventory(i3))
    print(json.dumps({'state':'PASS','I3':i3,'bindingPaths':BF_PATHS}))

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('command',choices=['integrate','bind']);a=p.parse_args()
    {'integrate':integrate,'bind':bind}[a.command]()
