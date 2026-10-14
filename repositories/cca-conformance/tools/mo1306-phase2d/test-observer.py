"""Regression for stale parent PID attribution; never excludes a real fourth role."""
from common import *
from observer import attributable
import copy
rows=[{'pid':1,'parent':0,'creationTime100ns':100},{'pid':2,'parent':1,'creationTime100ns':110},{'pid':3,'parent':2,'creationTime100ns':111},{'pid':4,'parent':3,'creationTime100ns':40},{'pid':5,'parent':4,'creationTime100ns':50}]
parents={r['pid']:(r['parent'],'') for r in rows}
assert [r['pid'] for r in attributable(rows,parents,1,100)]==[1,2,3]
after=copy.deepcopy(rows);after[3]['creationTime100ns']=105;after[4]['creationTime100ns']=120
assert [r['pid'] for r in attributable(after,parents,1,100)]==[1,2,3]
actual=copy.deepcopy(rows);actual[3]['creationTime100ns']=112;actual[4]['creationTime100ns']=113
assert len(attributable(actual,parents,1,100))==5
assert attributable([rows[0]],parents,1,99)==[]
# Unknown/racing intermediate details must not silently drop a possible child.
assert attributable([rows[0],actual[4]],parents,1,100)==[rows[0],actual[4]]
prior_private=CACHE/'diagnostics/generic-input-original-observer-failure.json'
source=prior_private if prior_private.exists() else OUT/'native/generic-input.json'
raw=source.read_bytes();failed=json.loads(raw)
root=next(r for r in failed['lifetimes'] if r['pid']==failed['rootPid']);born=root['creationTime100ns']
old=[r for r in failed['lifetimes'] if r['creationTime100ns']<born]
assert len(old)==2 and all(r['pid'] in failed['cleanup']['remainingPids'] for r in old)
for sample in failed['observation']['samples']:
 selected=attributable(sample['processes'],{r['pid']:(r['parent'],'') for r in sample['processes']},root['pid'],born,{r['pid']:r for r in failed['lifetimes']})
 assert len(selected)<=3
private=CACHE/'diagnostics/generic-input-original-observer-failure.json';private.parent.mkdir(exist_ok=True);private.write_bytes(raw);assert private.read_bytes()==raw
put('observer-correction.json',{'status':'PASS','tests':6,'productionChanged':False,'originalFailure':{'path':private.relative_to(ROOT).as_posix(),'byteLength':len(raw),'sha256':sha(raw),'status':'FAILED_OBSERVER_ATTRIBUTION'},'rootCreationTime100ns':born,'excludedCreationTimes100ns':[r['creationTime100ns'] for r in old],'cause':'Two unrelated pre-existing processes entered the PID-only ancestry through a recycled console-host PID. Both precede the supervisor; one also precedes its alleged parent.','correction':'Every available parent/child birth-time edge is checked. Unknown chronology remains visible; genuine fourth/fifth processes remain rejected.','originalPeakProcessCount':5,'chronologicallyAttributablePeak':3,'policy':'Original failed observation retained as private local diagnostic. Fresh corrected native witness required; original FAIL is not rewritten as PASS.'})
# Remove only the relocated, untracked engineering output; source history is untouched.
assert (OUT/'native/generic-input.json').resolve().is_relative_to(ROOT.resolve())
if source==OUT/'native/generic-input.json':source.unlink()
print('Observer chronology regression PASS: 6 cases; original failure preserved')

# Exercise the actual snapshot entry point, including Toolhelp enumeration.
import observer
from types import SimpleNamespace
original_kernel,original_details=observer.K,observer.details
index=[0]
def fill(pointer):
 if index[0]>=len(rows):return 0
 r=rows[index[0]];entry=pointer._obj;entry.pid=r['pid'];entry.parent=r['parent'];entry.name='fixture.exe';index[0]+=1;return 1
observer.K=SimpleNamespace(CreateToolhelp32Snapshot=lambda *_:1,Process32FirstW=lambda _,p:fill(p),Process32NextW=lambda _,p:fill(p),CloseHandle=lambda _:None)
observer.details=lambda pid:next(({'creationTime100ns':r['creationTime100ns'],'rssBytes':1} for r in rows if r['pid']==pid),None)
try:assert [r['pid'] for r in observer.snapshot(1,100,{})]==[1,2,3]
finally:observer.K,observer.details=original_kernel,original_details
put('observer-snapshot-test.json',{'status':'PASS','tests':1,'scope':'Actual snapshot entry point with mocked Windows enumeration retains three causal rows and rejects two impossible pre-existing descendants.'})
print('Actual snapshot chronology wiring PASS')
