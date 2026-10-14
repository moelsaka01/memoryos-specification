from common import *
import copy,importlib.util
from trace_phase2d import validate_trace
spec=importlib.util.spec_from_file_location('historical_trace',TOOLS.parent/'mo1306/trace.py');old=importlib.util.module_from_spec(spec);spec.loader.exec_module(old)
p=OUT/'native/azure-cne.json';raw=p.read_bytes();failed=json.loads(raw);assert failed['status']=='FAIL' and failed['exitCode']==7
preserved=OUT/'attempts/azure-cne-console-owner-pid-reuse.json';preserved.write_bytes(raw)
ids={'node':str(NODE),'powershell':str(Path(ENV['SystemRoot'])/'System32/WindowsPowerShell/v1.0/powershell.exe'),'conhost':str(Path(ENV['SystemRoot'])/'System32/conhost.exe')}
try:old.validate_trace(failed,ids,PKG)
except AssertionError as e:assert str(e)=='UNBOUND_CONSOLE_OWNER'
else:raise AssertionError('Original reproducer did not fail')
assert validate_trace(failed,ids,PKG)['status']=='PASS'
last=failed['observation']['samples'][-2] if not failed['observation']['samples'][-1]['processes'] else failed['observation']['samples'][-1]
console=next(r for r in last['processes'] if r['parent']!=failed['rootPid'] and r['pid']!=failed['rootPid'])
owners=[r for r in failed['lifetimes'] if r['pid']==console['parent'] and r['parent']==failed['rootPid'] and r['creationTime100ns']<=console['creationTime100ns']];assert len(owners)==2
newest=max(owners,key=lambda r:r['creationTime100ns'])
mutations=[]
x=copy.deepcopy(failed)
for sample in x['observation']['samples']:sample['processes']=[r for r in sample['processes'] if not(r['pid']==newest['pid'] and r['creationTime100ns']==newest['creationTime100ns'])]
mutations.append(('missing-co-observed-owner',x))
x=copy.deepcopy(failed)
for sample in x['observation']['samples']:
 for r in sample['processes']:
  if r['pid']==console['pid'] and r['creationTime100ns']==console['creationTime100ns']:r['executable']=str(Path(ENV['SystemRoot'])/'System32/cmd.exe')
mutations.append(('substituted-console-image',x))
x=copy.deepcopy(failed);x['observation']['peakProcessCount']=4;mutations.append(('fourth-role',x))
x=copy.deepcopy(failed);x['cleanup']['remainingPids']=[newest['pid']];mutations.append(('orphan',x))
controls=[]
for name,x in mutations:
 try:validate_trace(x,ids,PKG)
 except (AssertionError,ValueError) as e:controls.append({'id':name,'status':'PASS','rejectedBy':str(e)})
 else:raise AssertionError('False topology acceptance: '+name)
prior=json.loads((OUT/'native-execution.json').read_bytes())
for case in prior['cases']:assert validate_trace(json.loads((ROOT/case['trace']['path']).read_bytes()),ids,PKG)['status']=='PASS'
put('trace-owner-regression.json',{'status':'PASS','tests':6,'previousSuccessfulTracesRechecked':len(prior['cases']),'originalFailure':row(preserved),'historicalValidator':row(TOOLS.parent/'mo1306/trace.py'),'correctedValidator':row(TOOLS/'trace_phase2d.py'),'rootPid':failed['rootPid'],'reusedOwnerPid':newest['pid'],'ownerCreationTimes100ns':[r['creationTime100ns'] for r in owners],'consoleCreationTime100ns':console['creationTime100ns'],'controls':controls,'cause':'Two different observed PowerShell processes reused PID 16128 about 16 seconds apart. PID-only lifetime lookup incorrectly treated both as potential owners of the later console teardown.','correction':'Disambiguate duplicate historical PID candidates only with an actual earlier co-observed console/owner pair, matching both creation times. Exact image/command, cleanup, no-overlap, three-role and RSS checks remain unchanged.','productionChanged':False,'policy':'Original FAIL remains unchanged; fresh Azure CNE and remaining native cases are required.'})
print('Trace-owner regression PASS; controls',len(controls),'prior trace rechecks',len(prior['cases']))
