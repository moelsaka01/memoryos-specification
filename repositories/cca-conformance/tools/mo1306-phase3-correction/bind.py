"""Only this binding file is written after the actual C3A commit exists."""
from conformance import *
c3a=git('rev-parse','HEAD');assert git('show','-s','--format=%P',c3a)==B2 and git('show','-s','--format=%s',c3a)==SUBJECT
assert git('status','--porcelain=v1')==''
inv=json.loads(INV.read_bytes());validate(inv,committed=c3a)
value={'kind':'MemoryOSCLICommandDispatchCorrectionBinding','version':'1.0.0','baseline':B2,'correctionCommit':c3a,'correctionParent':B2,'inventory':row(INV),'package':inv['package']['archive'],'blocker':inv['originalBlocker'],'regressions':[row(OUT/p) for p in ['dispatch-b2.json','dispatch-corrected.json','cli-negative.json','semantic-native.json','provider-preservation.json']],'recertification':row(OUT/'recertification-impact.json'),'artifacts':inv['artifacts']}
assert not BIND.exists();BIND.write_bytes(j(value));validate_binding(value,inv)
print(json.dumps({'binding':'PASS','C3A':c3a,'parent':B2,'file':str(BIND.relative_to(ROOT))}))
