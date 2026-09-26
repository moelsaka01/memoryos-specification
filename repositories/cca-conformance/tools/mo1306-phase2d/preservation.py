"""Replay immutable B1 conformance using exact Git blobs; inspect retained history."""
from common import *
import hashlib
invpath='repositories/cca-conformance/mo1306-conformance-inventory.json'
inv=json.loads(subprocess.check_output(['git','show',B1+':'+invpath],cwd=ROOT))
paths={r['path'] for r in inv['artifacts']}|{r['path'] for r in inv['receipts']}|{invpath,'repositories/cca-conformance/mo1306-phase1-required-cases.json','repositories/cca-conformance/schema/mo1306-inventory-1.0.0.json','repositories/cca-conformance/schema/mo1306-receipt-1.0.0.json','repositories/cca-conformance/tools/mo1306/conformance.py','repositories/cca-conformance/evidence/mo1306/proofs/environment.json'}
tree={line.split('\t',1)[1]:line.split('\t',1)[0].split()[2] for line in git('ls-tree','-r',B1).splitlines()}
paths|={p for p in tree if p.startswith('repositories/memoryos-ci/')}
rows=sorted((p,tree[p]) for p in paths);stream=subprocess.check_output(['git','cat-file','--batch'],input=''.join(o+'\n' for _,o in rows).encode(),cwd=ROOT);offset=0
replay=ROOT/'.cache'/('h'+uuid.uuid4().hex[:5]);replay.mkdir()
assert max(len(str(replay/p)) for p,_ in rows)<260,'B1 replay must fit native Windows paths'
for p,oid in rows:
 end=stream.index(b'\n',offset);obj,kind,length=stream[offset:end].decode().split();assert obj==oid and kind=='blob';size=int(length);data=stream[end+1:end+1+size];assert hashlib.sha1(b'blob '+str(size).encode()+b'\0'+data).hexdigest()==oid
 target=replay/p;target.parent.mkdir(parents=True,exist_ok=True);target.write_bytes(data);offset=end+size+2
assert offset==len(stream)
_,raw=command('historical-conformance',[sys.executable,'-B','-X','utf8',replay/'repositories/cca-conformance/tools/mo1306/conformance.py'],env={**os.environ,**ENV,'GIT_DIR':str(ROOT/'.git'),'GIT_WORK_TREE':str(replay)},timeout=90)
result=json.loads(raw);assert result['status']=='PASS'
put('historical-conformance.json',{'status':'PASS','baseline':B1,'replayRoot':replay.relative_to(ROOT).as_posix(),'materializedGitBlobs':len(rows),'result':result,'contractReplay':row(OUT/'commands/historical-B1.json'),'scope':'Exact unmodified B1 validator, inventory, receipts and package replay. Historical B1 contract TAP remains 152/152; historical provider states are preserved.'})
prefixes=['repositories/cca-conformance/evidence/mo1306/','repositories/cca-conformance/tools/mo1306/','.github/','repositories/memoryos-ci/runtime/','repositories/memoryos-ci/schemas/']
fixed=['repositories/memoryos-ci/src/supervisor.mjs','repositories/memoryos-ci/src/filesystem.mjs','repositories/memoryos-ci/src/publication.mjs','repositories/memoryos-ci/src/worker.mjs','repositories/memoryos-ci/scripts/check-paths.ps1','repositories/memoryos-ci/contracts/limits.json','repositories/cca-conformance/tests/mo1302_action_foundation_conformance_test.mjs']
preserved=[]
for p,oid in tree.items():
 if (p in fixed or any(p.startswith(prefix) for prefix in prefixes)) and p!='repositories/cca-conformance/tools/mo1306/contracts.test.mjs':
  raw=(ROOT/p).read_bytes();assert hashlib.sha1(b'blob '+str(len(raw)).encode()+b'\0'+raw).hexdigest()==oid,p;preserved.append({'path':p,'blob':oid})
put('preservation.json',{'status':'PASS','baseline':B1,'unchangedFiles':len(preserved),'files':preserved,'mo1302Regression':row(OUT/'commands/mo1302.json'),'sourceInventory':row(OUT/'source-inventory.json'),'scope':'B1 historical evidence/validators, SDK closure, schemas, lifecycle and MO-1302 surfaces preserve exact Git blob identities. Source workstream preservation is additionally enumerated in source-inventory.'})
