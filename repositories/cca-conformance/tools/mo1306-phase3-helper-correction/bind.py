from conformance import *
c3c=git('rev-parse','HEAD');assert git('show','-s','--format=%P',c3c)==C3AB and git('show','-s','--format=%s',c3c)==SUBJECT
assert git('status','--porcelain=v1')==''
inv=json.loads(INV.read_bytes());validate(inv,committed=c3c)
value={'kind':'MemoryOSHelperDeadlineCorrectionBinding','version':'1.0.0','baseline':C3AB,'correctionCommit':c3c,'correctionParent':C3AB,'inventory':row(INV),'package':inv['package']['archive'],'preservation':row(OUT/'preservation.json'),'regressions':inv['gates'],'recertification':row(OUT/'recertification-impact.json')}
assert not BIND.exists();BIND.write_bytes(j(value));validate_binding(value,inv);print(json.dumps({'binding':'PASS','C3C':c3c,'parent':C3AB}))
