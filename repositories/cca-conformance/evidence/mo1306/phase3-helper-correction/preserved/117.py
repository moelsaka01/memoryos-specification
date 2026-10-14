"""Preserve the blocked checkpoint and inspect peer dispositions read-only."""
import argparse,datetime,hashlib,json,os,subprocess,sys
from pathlib import Path
sys.dont_write_bytecode=True
ROOT=Path(__file__).resolve().parents[4]
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/phase3ar-resolution/preservation'
CHECKPOINT='f236c4a2f94d8cd8e763aaa4bd6c52d703429692'
C3AB='9e1bbff99c23cdbc4c80f11e87eadb89a36e8f44'
C3A='90b9ac914e477fb90fe317d0de9ba310aae37f60'
B2='0e35ffe70919d77b1db530929093826410b805f9'
PEERS={'3B-R2':('cca-mo1306-3b-refresh2','b47f624c26badd54ee5724e8fe384c80ea083952','repositories/cca-conformance/evidence/mo1306/phase3b-r2/certification-receipt.json'),'3C-R':('cca-mo1306-3c-refresh','20aa4e4245643e1c3a7b3f676622c5d2d36015b2','repositories/cca-conformance/evidence/mo1306/phase3cr/audit-validation.json')}
ENV={**os.environ,'GIT_OPTIONAL_LOCKS':'0','PYTHONDONTWRITEBYTECODE':'1'}
def j(v):return (json.dumps(v,sort_keys=True,separators=(',',':'))+'\n').encode()
def sha(b):return 'sha256:'+hashlib.sha256(b).hexdigest()
def ident(b):return {'byteLength':len(b),'sha256':sha(b)}
def row(p,base=ROOT):return {'path':p.relative_to(base).as_posix(),**ident(p.read_bytes())}
def git(root,*args,input=None):return subprocess.check_output(['git','--no-optional-locks','-c','core.quotePath=false',*args],cwd=root,env=ENV,input=input,timeout=60)
def txt(root,*args):return git(root,*args).decode().strip()
def put(name,v):
 p=OUT/name;raw=j(v);p.parent.mkdir(parents=True,exist_ok=True)
 if p.exists():assert p.read_bytes()==raw,'Immutable evidence differs: '+name
 else:p.write_bytes(raw)
 return row(p)
def state(root):
 index=Path(txt(root,'rev-parse','--path-format=absolute','--git-path','index'))
 return {'root':str(root),'head':txt(root,'rev-parse','HEAD'),'branch':txt(root,'branch','--show-current'),'statusPorcelain':git(root,'status','--porcelain=v1','--untracked-files=all').decode(),'index':ident(index.read_bytes())}
def refs():return {'main':txt(ROOT,'rev-parse','refs/heads/main'),'originMain':txt(ROOT,'rev-parse','refs/remotes/origin/main'),'tags':txt(ROOT,'for-each-ref','--format=%(refname) %(objectname)','refs/tags').splitlines()}
def checkpoint_inventory():
 names=txt(ROOT,'diff-tree','--no-commit-id','--name-only','-r',CHECKPOINT).splitlines();assert len(names)==321
 queries=''.join(CHECKPOINT+':'+name+'\n' for name in names).encode()
 packed=git(ROOT,'cat-file','--batch',input=queries);offset=0;rows=[]
 for name in names:
  end=packed.index(b'\n',offset);oid,kind,length=packed[offset:end].split();assert kind==b'blob';length=int(length);start=end+1;raw=packed[start:start+length];assert packed[start+length:start+length+1]==b'\n';offset=start+length+1
  path=ROOT/name;assert path.read_bytes()==raw,'CHECKPOINT_BYTES_CHANGED: '+name
  rows.append({'path':name,'gitBlob':oid.decode(),**ident(raw)})
 assert offset==len(packed)
 return rows

def peer_states():
 result={}
 for name,(folder,commit,relative) in PEERS.items():
  root=ROOT.parent/folder;s=state(root);assert s['head']==commit and s['statusPorcelain']==''
  raw=(root/relative).read_bytes();assert raw==git(root,'show',commit+':'+relative)
  result[name]={'state':s,'receipt':{'root':str(root),**row(root/relative,root)},'receiptBytes':raw}
 return result

def main():
 parser=argparse.ArgumentParser();parser.add_argument('--check',action='store_true');args=parser.parse_args()
 assert ROOT.name=='cca-mo1306-3a-refresh'
 graph={CHECKPOINT:C3AB,C3AB:C3A,C3A:B2}
 for child,parent in graph.items():assert txt(ROOT,'show','-s','--format=%P',child)==parent
 inventory=checkpoint_inventory();protected=refs();peers=peer_states()
 read_only=state(ROOT.parent/'cca-workspace')
 if args.check:
  before=json.loads((OUT/'before.json').read_bytes());assert inventory==before['checkpointFiles'];assert protected==before['protectedRefs']
  assert read_only==before['readOnlyMainWorktree']
  for key,v in peers.items():assert v['state']==before['peers'][key]['state'] and v['receipt']==before['peers'][key]['receipt']
  original=state(ROOT.parent/'cca-mo1306-3a');assert original==before['originalB2Worktree']
  old_inventory=json.loads((ROOT/'repositories/cca-conformance/evidence/mo1306/phase3ar/preservation-before.json').read_bytes())['original3A']['files']
  assert len(old_inventory)==391
  for recorded in old_inventory:
   assert row(ROOT.parent/'cca-mo1306-3a'/recorded['path'],ROOT.parent/'cca-mo1306-3a')==recorded,'ORIGINAL_391_BYTES_CHANGED: '+recorded['path']
  print(json.dumps({'status':'PASS','checkpointFilesUnchanged':321,'originalB2FilesUnchanged':391,'blockedCheckpointPreserved':True,'readOnlyPeersUnchanged':True,'mainOriginMainTagsUnchanged':True,'before':row(OUT/'before.json')}));return
 assert txt(ROOT,'rev-parse','HEAD')==CHECKPOINT
 origin=state(ROOT.parent/'cca-mo1306-3a');assert origin['head']==B2 and len(origin['statusPorcelain'].splitlines())==391
 for name,v in peers.items():
  target=OUT/(name.lower()+'-receipt.json');target.parent.mkdir(parents=True,exist_ok=True)
  if target.exists():assert target.read_bytes()==v['receiptBytes']
  else:target.write_bytes(v['receiptBytes'])
 b=json.loads(peers['3B-R2']['receiptBytes']);c=json.loads(peers['3C-R']['receiptBytes'])
 assert b['releaseReady'] is True and b['actionUpdateRequired'] is False
 assert {f['disposition'] for f in b['findings']}=={'NOT_REACHABLE_IN_FROZEN_USAGE','REACHABLE_NOT_ATTACKER_CONTROLLED'}
 assert c['matrixCounts']['BLOCKED']==0 and c['status']=='PASS'
 authority={'kind':'MemoryOSPhase3ARResolutionPeerDisposition','status':'PASS','inspectionOnly':True,'reruns':False,'3B-R2':{'commit':PEERS['3B-R2'][1],'releaseReady':True,'scope':b['scope'],'actionUpdateRequired':False,'findings':b['findings'],'actionPins':b['actionPins'],'remainingExternalDependencies':b['remainingExternalDependencies'],'retainedReceipt':row(OUT/'3b-r2-receipt.json')},'3C-R':{'commit':PEERS['3C-R'][1],'baseline':c['baseline'],'matrixCounts':c['matrixCounts'],'scope':'Independent audit status only; remaining external dependencies remain assigned to their owners. No 3C campaign rerun.','retainedReceipt':row(OUT/'3c-r-receipt.json')}}
 put('peer-dispositions.json',authority)
 snapshot={'kind':'MemoryOSPhase3ARResolutionPreservation','version':'1.0.0','capturedUtc':datetime.datetime.now(datetime.timezone.utc).isoformat(),'checkpoint':CHECKPOINT,'productionAuthority':C3AB,'graph':graph,'checkpointFileCount':321,'checkpointFiles':inventory,'checkpointInventorySha256':sha(j(inventory)),'startingWorktree':state(ROOT),'protectedRefs':protected,'readOnlyMainWorktree':read_only,'originalB2Worktree':origin,'peers':{k:{'state':v['state'],'receipt':v['receipt']} for k,v in peers.items()},'checkpointDisposition':'CERTIFICATION_BLOCKED','checkpointCommitAmended':False,'peerInspectionScope':'Read commit/status/index and specified receipt bytes only; no test or supply-chain rerun.','peerDispositions':row(OUT/'peer-dispositions.json')}
 put('before.json',snapshot)
 assert checkpoint_inventory()==inventory and refs()==protected
 print(json.dumps({'status':'PASS','checkpointFiles':321,'checkpoint':CHECKPOINT,'peer3BR2ReleaseReadyWithinScope':True,'peer3CRBlockedRequirements':0,'inventorySha256':snapshot['checkpointInventorySha256']}))
if __name__=='__main__':main()
