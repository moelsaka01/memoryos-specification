"""Prepare candidate or I1-bound closed Phase 1 evidence, never a self-referential B1 hash."""
from pathlib import Path
import sys,json,subprocess
from materialize import ROOT,PKG,j,sha
from conformance import verify,CATEGORIES,F1A,AUTH
BASE=ROOT/'repositories/cca-conformance';E=BASE/'evidence/mo1306'
def ref(p):return {'path':p.relative_to(ROOT).as_posix(),'byteLength':p.stat().st_size,'sha256':sha(p.read_bytes())}
def prepare(candidate=False):
 revision=F1A if candidate else subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip()
 destination=ROOT/'.cache/mo1306/conformance-draft' if candidate else E/'binding';destination.mkdir(exist_ok=True,parents=True)
 environment=json.loads((E/'proofs/environment.json').read_bytes())
 identities={'contractDigest':sha((PKG/'contracts/contract.json').read_bytes()),'distributionDigest':sha((PKG/'distribution-manifest.json').read_bytes()),'runtimeClosureDigest':sha((PKG/'runtime/runtime-closure-manifest.json').read_bytes())}
 groups={'contract':[],'execution':[],'package':[]}
 def add(group,identifier,p):
  record=json.loads(p.read_bytes());assert record.get('status')=='PASS',(identifier,p)
  groups[group].append({'id':identifier,'status':'PASS','command':record['command'],'exitCode':record['exitCode'],'elapsedMs':record['elapsedMs'],'evidencePaths':[p.relative_to(ROOT).as_posix()]})
 for name in ['structural','contracts','security','affected-integrity']:add('contract',name,E/'accepted-cheap'/(name+'.json'))
 for name in ['mo1301-contract','mo1302-contract']:add('contract',name,E/'predecessors'/(name+'.json'))
 for name in ['audit','proof-collection']:add('contract',name,E/'acceptance'/(name+'.json'))
 for name in ['semantic-failure','helper-failure','helper-cancel','worker-timeout','worker-cancel','child-failure','oversized-response']:
  add('execution','lifecycle-'+name,E/'lifecycle-final'/(name+'.json'))
 for row in json.loads((E/'package-v2/cases.json').read_bytes()):add('package','package-'+row['id'],E/'package-v2'/(row['id']+'.json'))
 # Negative execution checks remain unchanged in semantics; exact prior bodies are retained.
 for name in ['negative-unknown-config','negative-missing-input','negative-pin-mismatch','negative-invalid-semantic','negative-oversized-input','negative-traversal','negative-node-options','negative-node-path','operational-metadata']:
  add('execution',name,E/'phase1-negative'/(name+'.json'))
 add('contract','trace-and-topology',E/'acceptance/trace-and-topology.json')
 # Every bound artifact already exists in I1; receipt/inventory files themselves are excluded.
 paths=[]
 for folder in [PKG,E,BASE/'tools/mo1306',BASE/'tools/mo1306-correction-a',BASE/'fixtures/mo1306']:
  paths.extend(p for p in folder.rglob('*') if p.is_file() and 'binding' not in p.relative_to(folder).parts)
 paths.extend([BASE/'schema/mo1306-receipt-1.0.0.json',BASE/'schema/mo1306-inventory-1.0.0.json',BASE/'mo1306-phase2-interfaces.json',BASE/'mo1306-phase1-required-cases.json'])
 paths.extend(ROOT/'docs'/name for name in ['mo1306-contract-freeze-1.md','mo1306-contract-freeze-1-process-correction.md','mo1306-phase1-contract-blocker.md','mo1306-phase1-foundation.md','mo1306-phase1-supply-chain-review.md'])
 artifacts=sorted([ref(p) for p in set(paths)],key=lambda r:r['path'])
 receipts={};refs=[]
 for group,cases in groups.items():
  identifier='mo1306-phase1-'+group
  # Full source/evidence inventory also makes matching-byte retrospective binding explicit.
  receipt={'kind':'MemoryOSCICDConformanceReceipt','version':'1.0.0','id':identifier,'implementationRevision':revision,'harnessRevision':revision,**identities,'scope':{'provider':'generic','platform':'windows-11-x64','validationMode':{'contract':'CONTRACT_VALIDATION','execution':'REAL_EXECUTION','package':'PACKAGE'}[group]},'environment':environment,'cases':sorted(cases,key=lambda r:r['id']),'artifacts':artifacts,'reusedEvidence':[],'limitations':['Harnesses executed before I1 existed. I1 is the subsequent matching-byte binding, not a claimed execution-time revision. Exact earlier changed members and executed harness snapshots are retained.','Only Phase 1 foundation scope passes. Final provider certification, hosted execution and Phase 2 hardening remain future work.','Historical raw oversized traces are binary gzip artifacts; accepted JSON views losslessly dictionary-encode command lines and round-trip original bytes.','Earlier semantic and filesystem subcases are reused only as described in proofs/semantic-parity.json and proofs/filesystem-evidence.json. Current installed outcomes, integrity and child-environment behavior have fresh witnesses.'],'status':'PASS'}
  path=destination/(identifier+'.json');path.write_bytes(j(receipt));receipts[identifier]=receipt;refs.append({'id':identifier,'path':path.relative_to(ROOT).as_posix(),'sha256':sha(path.read_bytes())})
 owner={case['id']:'mo1306-phase1-'+group for group,cases in groups.items() for case in cases}
 mapping={
 'CF-CONTRACT':['structural','contracts','audit'],'CF-CONFIG':['contracts','negative-unknown-config'],
 'CF-GENERIC':['package-installed-evaluate-policy-pass','package-installed-evaluate-policy-fail','package-installed-evaluate-policy-cne'],
 'CF-SEMANTIC':['proof-collection'],'CF-GENERATION':['package-generation-a','package-generation-b','package-generator-overwrite'],
 'CF-FILESYSTEM':['proof-collection','negative-traversal','negative-missing-input'],
 'CF-NETWORK':['security'],'CF-SECRETS':['affected-integrity','negative-node-options','negative-node-path','operational-metadata'],
 'CF-INJECTION':['contracts'],'CF-DETERMINISM':['contracts','package-generation-a','package-generation-b'],
 'CF-ERRORS':['contracts','lifecycle-child-failure'],'CF-PROJECTION':['contracts'],
 'CF-EVIDENCE':['proof-collection'],'CF-RESOURCE':['proof-collection','trace-and-topology'],
 'CF-CANCELLATION':['lifecycle-worker-timeout','lifecycle-worker-cancel','lifecycle-helper-cancel'],
 'CF-CONCURRENCY':['trace-and-topology','lifecycle-worker-timeout'],
 'CF-PACKAGE':['package-pack-a','package-pack-b','package-offline-install','audit'],
 'CF-SUPPLY':['audit','proof-collection'],'CF-CONFORMANCE':['structural','proof-collection']}
 categories=[{'id':name,'status':'PASS' if name in mapping else 'PENDING','requiredCaseIds':sorted(mapping.get(name,[])),'receiptIds':sorted({owner[c] for c in mapping.get(name,[])})} for name in sorted(CATEGORIES)]
 inventory={'kind':'MemoryOSCICDConformanceInventory','version':'1.0.0','contract':{'authorityRevision':AUTH,'freezeRevision':F1A,'contractDigest':identities['contractDigest']},'implementation':{'revision':revision,'distributionDigest':identities['distributionDigest'],'runtimeClosureDigest':identities['runtimeClosureDigest']},'categories':categories,'providers':[{'id':name,'status':'FOUNDATION_IMPLEMENTED' if name=='generic' else 'NOT_IMPLEMENTED','scope':'Phase 1 foundation only; final provider certification excluded','receiptIds':sorted(receipts) if name=='generic' else []} for name in ['azure','generic','github','gitlab','jenkins']],'platforms':[{'id':'windows-11-x64','status':'PASS','scope':'Native Windows 11 x64 Phase 1 foundation','receiptIds':sorted(receipts)},{'id':'windows-2022-x64','status':'NOT_EXECUTED','scope':'Hosted GitHub witness is future Phase 3 scope','receiptIds':[]}],'artifacts':artifacts,'receipts':sorted(refs,key=lambda r:r['id']),'exclusions':['Linux/Ubuntu/WSL/macOS/ARM','Local or administered VM','Live GitLab/Jenkins/Azure services and accounts','Hosted GitHub execution in Phase 1','Final provider certification and release tag'],'releaseState':'IN_PROGRESS'}
 target=destination/'candidate-inventory.json' if candidate else BASE/'mo1306-conformance-inventory.json'
 target.write_bytes(j(inventory))
 result=verify(inventory,receipts,candidate=candidate)
 return inventory,receipts,result
if __name__=='__main__':
 candidate='--candidate' in sys.argv
 inv,receipts,result=prepare(candidate)
 print(json.dumps({**result,'mode':'UNCOMMITTED_CANDIDATE' if candidate else 'I1_BINDING','implementationRevision':inv['implementation']['revision']}))
