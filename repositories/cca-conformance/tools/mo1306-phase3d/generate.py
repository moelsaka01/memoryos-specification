"""Generate only final integration metadata; never rebuild or execute campaigns."""
from support import *
import models
from reconcile import build as reconcile
from validate import preservation, expected, payloads, validate_payloads, DOCUMENT
from tests import run_tests
def seal():
    excluded={'i3-files.json','binding.json','binding-graph.json','binding-validation.json'}
    files=sorted([ref(p) for folder in (TOOLS,OUT) for p in folder.rglob('*') if p.is_file() and p.name not in excluded]+[ref(ROOT/'ROADMAP.md'),ref(DOCUMENT)],key=lambda r:r['path'])
    put('i3-files.json',{'kind':'MemoryOSCICDI3FileInventory','version':'1.0.0','expectedParent':S3,'files':files,'selfReference':False,'strategy':'The containing I3 commit binds this inventory. BF names actual I3 and this immutable snapshot; neither embeds its own future hash.'})
def generate():
    e=Evidence();reconcile();put('history.json',models.history(e));put('native-binding.json',models.native(e));put('preservation-validation.json',preservation(e))
    put('provenance.json',models.provenance(e));put('closure-matrix.json',models.closure(e));put('release-inventory.json',models.release_inventory())
    values=payloads();wanted=expected(e);validate_payloads(values,wanted)
    test=run_tests(values,wanted,e);put('tests.json',test);seal()
    print(json.dumps({'status':'PASS','closure':load('closure-matrix.json')['counts'],'tests':{k:test[k] for k in ('negativeCount','positiveCount','totalCount')},'sealedFiles':len(load('i3-files.json')['files'])}))
if __name__=='__main__':generate()
