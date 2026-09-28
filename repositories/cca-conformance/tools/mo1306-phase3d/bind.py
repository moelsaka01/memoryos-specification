"""Create exactly four BF data files after actual I3 read-only validation."""
from support import *
from validate import verify,check_bf
from models import binding_graph,binding_validation,final_inventory
if __name__=='__main__':
    need(not git('status','--porcelain=v1').strip(),'I3_MUST_BE_CLEAN')
    need(all(not (ROOT/p).exists() for p in BF_FILES),'BF_ALREADY_EXISTS')
    result=verify('i3');save(CACHE/'post-i3.json',result);i3=result['head']
    put('binding-graph.json',binding_graph(i3));put('binding-validation.json',binding_validation(i3));save(FINAL,final_inventory(i3))
    put('binding.json',{'kind':'MemoryOSCICDFinalBinding','version':'1.0.0','I3':i3,'parent':i3,'inventory':ref(OUT/'release-inventory.json'),'graph':ref(OUT/'binding-graph.json'),'validation':ref(OUT/'binding-validation.json'),'finalInventory':ref(FINAL),'selfReference':False})
    check_bf(i3);need(set(git('ls-files','--others','--exclude-standard').decode().splitlines())==set(BF_FILES),'BF_EXACT_NEW_FILES')
    need(not git('diff','--name-only').strip(),'I3_MODIFIED')
    print(json.dumps({'status':'PASS','I3':i3,'BF_FILES':BF_FILES,'negativeControls':result['negativeControls'],'positiveChecks':result['positiveChecks']}))
