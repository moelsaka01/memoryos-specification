"""Offline independent closed-schema, artifact and revision graph verifier."""
import json,hashlib,subprocess,sys,copy
from pathlib import Path
ROOT=Path(__file__).resolve().parents[4];PKG=ROOT/'repositories/memoryos-ci';BASE=ROOT/'repositories/cca-conformance'
sys.path.insert(0,str(ROOT/'.cache/mo1306/validators'))
from jsonschema import Draft202012Validator
F1A='769e277966868b819f6640d9456589523ee26ddf';F1='3537b037e4ea70a726a249d7397f1df15daa2167';AUTH='33c0612e9ed03d714568354d2d7b2545344f95c1'
NODE='sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32'
CATEGORIES=['CF-CONTRACT','CF-CONFIG','CF-GENERIC','CF-SEMANTIC','CF-GENERATION','CF-GITLAB','CF-JENKINS','CF-AZURE','CF-GITHUB-REGRESSION','CF-GITHUB-HOSTED','CF-FILESYSTEM','CF-NETWORK','CF-SECRETS','CF-INJECTION','CF-DETERMINISM','CF-ERRORS','CF-PROJECTION','CF-EVIDENCE','CF-RESOURCE','CF-CANCELLATION','CF-CONCURRENCY','CF-PACKAGE','CF-SUPPLY','CF-CONFORMANCE']
def sha(b):return 'sha256:'+hashlib.sha256(b).hexdigest()
def read(p):
 b=p.read_bytes();assert len(b)<=2*1024*1024,'ENGINEERING_RECORD_LIMIT'
 return json.loads(b)
def validate_schema(v,name):
 schema=read(BASE/'schema'/name);Draft202012Validator.check_schema(schema);Draft202012Validator(schema).validate(v)
def revision_exists(rev):
 assert subprocess.run(['git','cat-file','-e',rev+'^{commit}'],cwd=ROOT,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL).returncode==0,'REVISION_MISSING'
def artifact_check(rows):
 assert rows==sorted(rows,key=lambda x:x['path']),'ARTIFACT_ORDER'
 assert len({r['path'].casefold() for r in rows})==len(rows),'ARTIFACT_DUPLICATE'
 for r in rows:
  p=ROOT/r['path'];assert p.is_file() and not p.is_symlink(),'ARTIFACT_MISSING'
  b=p.read_bytes();assert len(b)==r['byteLength'] and sha(b)==r['sha256'],'ARTIFACT_DRIFT'
def verify(inv,receipts,candidate=False):
 validate_schema(inv,'mo1306-inventory-1.0.0.json')
 assert inv['contract']['authorityRevision']==AUTH and inv['contract']['freezeRevision']==F1A,'WRONG_AUTHORITY'
 assert subprocess.check_output(['git','rev-parse',F1A+'^'],cwd=ROOT,text=True).strip()==F1,'F1A_PARENT'
 revision_exists(inv['implementation']['revision'])
 if candidate:
  assert inv['implementation']['revision']==F1A and subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()==F1A,'CANDIDATE_BASELINE'
 else:assert subprocess.check_output(['git','rev-parse',inv['implementation']['revision']+'^'],cwd=ROOT,text=True).strip()==F1A,'I1_PARENT'
 expected=(sha((PKG/'contracts/contract.json').read_bytes()),sha((PKG/'distribution-manifest.json').read_bytes()),sha((PKG/'runtime/runtime-closure-manifest.json').read_bytes()))
 assert (inv['contract']['contractDigest'],inv['implementation']['distributionDigest'],inv['implementation']['runtimeClosureDigest'])==expected,'CURRENT_IDENTITIES'
 artifact_check(inv['artifacts'])
 if not candidate:
  tree=subprocess.check_output(['git','ls-tree','-r',inv['implementation']['revision']],cwd=ROOT,text=True)
  blobs={line.split('\t',1)[1]:line.split('\t',1)[0].split()[2] for line in tree.splitlines()}
  for row in inv['artifacts']:
   b=(ROOT/row['path']).read_bytes();blob=hashlib.sha1(b'blob '+str(len(b)).encode()+b'\0'+b).hexdigest()
   assert blobs.get(row['path'])==blob,'COMMITTED_BYTE_BINDING'
 assert len({r['id'] for r in inv['receipts']})==len(inv['receipts']),'RECEIPT_DUPLICATE'
 assert set(receipts)=={r['id'] for r in inv['receipts']},'MISSING_EXTRA_RECEIPTS'
 available={};graph={};artifact_union={}
 for ref in inv['receipts']:
  path=ROOT/ref['path'];assert sha(path.read_bytes())==ref['sha256'],'RECEIPT_DRIFT'
  receipt=receipts[ref['id']];validate_schema(receipt,'mo1306-receipt-1.0.0.json')
  assert receipt['id']==ref['id'],'RECEIPT_ID'
  assert receipt['implementationRevision']==inv['implementation']['revision'],'IMPLEMENTATION_REVISION'
  for rev in [receipt['implementationRevision'],receipt['harnessRevision']]:revision_exists(rev)
  assert receipt['harnessRevision']==receipt['implementationRevision'],'MATCHING_BYTE_BINDING_REQUIRED'
  assert receipt['environment']['nodeSha256']==NODE,'RUNTIME_SUBSTITUTION'
  assert receipt['environment']['hostedRun'] is None and receipt['scope']['platform']=='windows-11-x64','UNEXECUTED_PLATFORM'
  assert receipt['scope']['validationMode']!='HOSTED_EXECUTION','UNEXECUTED_HOSTED'
  assert receipt['contractDigest']==expected[0] and receipt['distributionDigest']==expected[1] and receipt['runtimeClosureDigest']==expected[2],'RECEIPT_IDENTITIES'
  artifact_check(receipt['artifacts'])
  for row in receipt['artifacts']:artifact_union[row['path']]=row
  assert receipt['environment']==read(BASE/'evidence/mo1306/proofs/environment.json'),'ENVIRONMENT_ASSOCIATION'
  paths={r['path'] for r in receipt['artifacts']}
  ids=[c['id'] for c in receipt['cases']];assert len(set(ids))==len(ids),'CASE_DUPLICATE'
  assert receipt['cases'],'EMPTY_RECEIPT'
  if receipt['status']=='PASS':assert all(c['status']=='PASS' for c in receipt['cases']),'FORGED_PASS'
  for case in receipt['cases']:
   assert case['evidencePaths'] and set(case['evidencePaths'])<=paths,'CASE_EVIDENCE_MISSING'
   assert case['id'] not in available,'CROSS_RECEIPT_CASE_DUPLICATE'
   for evidence in case['evidencePaths']:
    p=ROOT/evidence
    if p.suffix=='.json':
     data=read(p)
     if isinstance(data,dict) and 'exitCode' in data and 'command' in data:
      assert case['exitCode']==data['exitCode'] and case['command']==data['command'] and case['elapsedMs']==data['elapsedMs'],'COMMAND_RECEIPT_MISMATCH'
     if isinstance(data,dict) and data.get('status')=='FAIL':assert case['status']!='PASS','FAILED_EVIDENCE_FORGED'
   available[case['id']]=(ref['id'],case['status'])
  graph[ref['id']]=[r['receiptId'] for r in receipt['reusedEvidence']]
  for reuse in receipt['reusedEvidence']:
   found=[r for r in inv['receipts'] if r['id']==reuse['receiptId']]
   assert len(found)==1 and found[0]['sha256']==reuse['sha256'] and reuse['unchangedArtifactDigests'],'INVALID_REUSE'
   referenced=receipts[reuse['receiptId']]
   hashes={r['sha256'] for r in referenced['artifacts']}
   assert set(reuse['unchangedArtifactDigests'])<=hashes,'FALSE_UNCHANGED_REUSE'
 def visit(n,active,done):
  assert n not in active,'CYCLIC_RECEIPTS'
  if n in done:return
  for child in graph[n]:visit(child,active|{n},done)
  done.add(n)
 done=set()
 for n in graph:visit(n,set(),done)
 assert artifact_union=={r['path']:r for r in inv['artifacts']},'INVENTORY_ARTIFACT_OMISSION_OR_EXTRA'
 assert sorted(c['id'] for c in inv['categories'])==sorted(CATEGORIES),'CATEGORY_OMISSION'
 required={r['id']:r for r in read(BASE/'mo1306-phase1-required-cases.json')['categories']}
 for category in inv['categories']:
  assert category['requiredCaseIds']==required[category['id']]['requiredCaseIds'] and category['status']==required[category['id']]['status'],'REQUIRED_CATALOG_DRIFT'
 for category in inv['categories']:
  assert len(set(category['requiredCaseIds']))==len(category['requiredCaseIds']),'REQUIRED_CASE_DUPLICATE'
  assert set(category['receiptIds'])<=set(receipts),'UNRESOLVED_RECEIPT'
  if category['status']=='PASS':
   assert category['requiredCaseIds'],'NO_REQUIRED_CASES'
   for case in category['requiredCaseIds']:assert case in available and available[case][1]=='PASS' and available[case][0] in category['receiptIds'],'REQUIRED_CASE_OMITTED'
 assert sorted(r['id'] for r in inv['providers'])==['azure','generic','github','gitlab','jenkins'],'PROVIDER_OMISSION'
 for row in inv['providers']:
  assert row['status']==('FOUNDATION_IMPLEMENTED' if row['id']=='generic' else 'NOT_IMPLEMENTED'),'FALSE_PROVIDER_CLAIM'
 assert inv['releaseState']=='IN_PROGRESS','PHASE1_NOT_RELEASE_READY'
 assert any(r['id']=='windows-11-x64' and r['status']=='PASS' for r in inv['platforms']),'WINDOWS_REQUIRED'
 return {'status':'PASS','receipts':len(receipts),'cases':len(available),'categories':len(inv['categories'])}
def main():
 p=BASE/'mo1306-conformance-inventory.json';inv=read(p);receipts={r['id']:read(ROOT/r['path']) for r in inv['receipts']}
 print(json.dumps(verify(inv,receipts)))
if __name__=='__main__':main()
