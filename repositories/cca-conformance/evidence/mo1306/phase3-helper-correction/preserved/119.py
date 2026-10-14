"""Offline safety tests: no credentials, subprocesses or network operations."""
from pathlib import Path
from copy import deepcopy
import json
from remote_campaign import PREFIX, BRANCH, MAIN, CANDIDATE, validate_request, restore_main, storage_url, row, write_new, OUT

checks=[]
def ok(name):checks.append({'id':name,'status':'PASS'})
for method,path,payload in [
 ('GET',PREFIX,None),('PATCH',PREFIX,{'default_branch':BRANCH}),
 ('PATCH',PREFIX,{'default_branch':'main'}),
 ('POST',PREFIX+'/actions/workflows/123/dispatches',{'ref':BRANCH})]:
 validate_request(method,path,payload);ok('allowed-'+method+'-'+str(len(checks)))
for name,args in [
 ('write-main-ref',('PATCH',PREFIX+'/git/refs/heads/main',{'sha':'x'})),
 ('delete-branch',('DELETE',PREFIX+'/git/refs/heads/'+BRANCH,None)),
 ('unrelated-setting',('PATCH',PREFIX,{'default_branch':BRANCH,'private':True})),
 ('wrong-default',('PATCH',PREFIX,{'default_branch':'other'})),
 ('dispatch-main',('POST',PREFIX+'/actions/workflows/123/dispatches',{'ref':'main'})),
 ('dispatch-unregistered-name',('POST',PREFIX+'/actions/workflows/a.yml/dispatches',{'ref':BRANCH})),
 ('repository-dispatch',('POST',PREFIX+'/dispatches',{'event_type':'run'})),
 ('token-in-query',('GET','https://other.example',None)),
]:
 try:validate_request(*args)
 except AssertionError:ok(name+'-rejected')
 else:raise AssertionError(name)
for value in ['http://x.blob.core.windows.net/a','https://example.com/a','https://user:pass@x.blob.core.windows.net/a','https://127.0.0.1/a']:
 try:storage_url(value)
 except AssertionError:ok('unsafe-download-url-rejected-'+str(len(checks)))
 else:raise AssertionError('Unsafe storage URL')
for value in ['https://a.blob.core.windows.net/b?sig=opaque','https://objects.githubusercontent.com/a?token=opaque']:
 storage_url(value);ok('signed-storage-host-accepted-'+str(len(checks)))

before={'repository':{'settings':{'default_branch':'main','private':False,'archived':False}},
 'actionsPermissions':{'enabled':True},'rulesets':[],
 'branches':{'main':{'protected':False,'commit':{'sha':MAIN}},BRANCH:{'protected':False,'commit':{'sha':CANDIDATE}}}}
class Fake:
 def __init__(self,mode=None):
  self.default=BRANCH;self.mode=mode;self.patches=[];self.events=[];self.gets=0
 def event(self,label,value):self.events.append((label,deepcopy(value)))
 def get(self,path):
  self.gets+=1
  if self.mode=='get-once' and self.gets==1:raise OSError('simulated GET outage')
  if path==PREFIX:return {'default_branch':self.default,'private':False,'archived':False}
  if path==PREFIX+'/git/ref/heads/main':
   return {'object':{'sha':MAIN if self.mode!='external-main' else '0'*40}}
  if path==PREFIX+'/git/ref/heads/'+BRANCH:return {'object':{'sha':CANDIDATE}}
  if path==PREFIX+'/actions/permissions':return {'enabled':True}
  if path==PREFIX+'/rulesets?includes_parents=true&per_page=100':return []
  for branch in ['main',BRANCH]:
   if path==PREFIX+'/branches/'+branch:return before['branches'][branch]
  raise AssertionError(path)
 def request(self,method,path,payload):
  validate_request(method,path,payload);self.patches.append((method,path,deepcopy(payload)))
  if self.mode=='refused':return ({'status':403},None)
  self.default=payload['default_branch']
  if self.mode=='lost-response' and len(self.patches)==1:raise OSError('simulated lost PATCH response')
  return ({'status':200},None)
for mode in [None,'get-once','lost-response']:
 fake=Fake(mode)
 receipt=restore_main(fake,before,sleep=lambda _:None)
 assert receipt['status']=='PASS' and receipt['independentReadback'] and fake.default=='main'
 assert all(payload=={'default_branch':'main'} for _,_,payload in fake.patches)
 assert len(fake.patches)==1
 assert any(label=='restoration-verified' for label,_ in fake.events)
 ok('restore-'+str(mode))
fake=Fake();fake.default='main'
receipt=restore_main(fake,before,sleep=lambda _:None)
assert receipt['status']=='PASS' and not fake.patches;ok('already-restored-no-write')
for mode in ['refused','external-main']:
 fake=Fake(mode)
 try:restore_main(fake,before,sleep=lambda _:None)
 except RuntimeError:pass
 else:raise AssertionError('Invalid restoration accepted')
 assert any(label=='restoration-blocked' for label,_ in fake.events)
 assert len(fake.patches)<=3
 if mode=='external-main':assert fake.default=='main'
 ok('restore-'+mode+'-blocked')
report={'kind':'MemoryOSPhase3ARRemoteCampaignOfflineValidation','status':'PASS',
 'testCount':len(checks),'tests':checks,'networkOperations':0,'remoteMutations':0,
 'harness':row(Path(__file__)),'campaign':row(Path(__file__).with_name('remote_campaign.py'))}
target=OUT/'remote-campaign-offline-validation.json'
write_new(target,report)
print(json.dumps({'status':'PASS','testCount':len(checks),'report':row(target),'campaign':report['campaign']}))

