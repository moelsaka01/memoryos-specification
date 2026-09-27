from conformance import *
source='repositories/memoryos-ci/src/filesystem.mjs';raw=blob(C3AB,source)
value={'kind':'MemoryOSHelperDeadlineCorrection','version':'1.0.0','baseline':C3AB,'C3A':C3A,'productionChanges':['distribution-manifest.json','src/filesystem.mjs'],'sourceBefore':{'path':source,'byteLength':len(raw),'sha256':sha(raw)},'sourceAfter':row(ROOT/source),'artifacts':closure(),'gates':{p:row(OUT/p) for p in GATES},'package':read('package.json'),'preservation':read('preservation.json'),'recertification':read('recertification-impact.json')}
assert not INV.exists();INV.write_bytes(j(value));validate(value);print(json.dumps({'inventory':'PASS','artifacts':len(value['artifacts'])}))
