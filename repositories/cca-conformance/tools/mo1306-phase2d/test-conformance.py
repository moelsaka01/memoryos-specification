"""Independent mutations of closed graph/receipt/byte bindings."""
from conformance import *
from jsonschema.exceptions import ValidationError
inv,receipts=load()
positive=validate(inv,receipts,allow_missing_selftest=True)
def refresh(i,r):
 for key in GATES:
  for dep in r[key]['requires']:
   if dep['receiptId'] in r:dep['sha256']=sha(j(r[dep['receiptId']]))
  for ref in i['receipts']:
   if ref['id']==key:ref['sha256']=sha(j(r[key]))
def change_receipt(key,fn):
 def run(i,r):fn(r[key]);refresh(i,r)
 return run
def coherent_omission(i,r):
 path='repositories/memoryos-ci/README.md'
 i['artifacts']=[x for x in i['artifacts'] if x['path']!=path]
 for receipt in r.values():receipt['artifacts']=[x for x in receipt['artifacts'] if x['path']!=path]
 refresh(i,r)
mutations=[
 ('coherent-inventory-and-receipt-omission',coherent_omission),
 ('unknown-inventory-field',lambda i,r:i.update(unknown=True)),
 ('wrong-B1',lambda i,r:i.update(baseline='0'*40)),
 ('wrong-authority',lambda i,r:i['authorities'].update(roadmap='0'*40)),
 ('wrong-corrected-2C',lambda i,r:i['sources'].update({'2c':SOURCES['2c-original']})),
 ('fake-I2',lambda i,r:i['implementation'].update(revision='0'*40)),
 ('wrong-I2-parent',lambda i,r:i['implementation'].update(parent='0'*40)),
 ('false-release-state',lambda i,r:i.update(releaseState='PHASE_2_COMPLETE_FINAL_CERTIFICATION_PENDING')),
 ('false-hosted',lambda i,r:i.update(hostedExecuted=True)),
 ('false-platform',lambda i,r:i.update(platform='linux')),
 ('false-label',lambda i,r:i['providers'].update(github=['HOSTED_CERTIFIED'])),
 ('missing-provider',lambda i,r:i['providers'].pop('azure')),
 ('wrong-distribution',lambda i,r:i['identities'].update(distribution='sha256:'+'0'*64)),
 ('wrong-archive',lambda i,r:i['identities'].update(archive='sha256:'+'0'*64)),
 ('wrong-runtime',lambda i,r:i['identities'].update(runtimeClosure='sha256:'+'0'*64)),
 ('artifact-omission',lambda i,r:i['artifacts'].pop()),
 ('artifact-duplicate',lambda i,r:i['artifacts'].append(i['artifacts'][-1])),
 ('artifact-byte-length',lambda i,r:i['artifacts'][0].update(byteLength=0)),
 ('artifact-hash',lambda i,r:i['artifacts'][0].update(sha256='sha256:'+'0'*64)),
 ('artifact-path-escape',lambda i,r:i['artifacts'][0].update(path='../outside')),
 ('receipt-omission',lambda i,r:i['receipts'].pop()),
 ('receipt-duplicate',lambda i,r:i['receipts'].append(i['receipts'][0])),
 ('receipt-wrong-hash',lambda i,r:i['receipts'][0].update(sha256='sha256:'+'0'*64)),
 ('receipt-wrong-path',lambda i,r:i['receipts'][0].update(path='wrong.json')),
 ('required-gate-omission',lambda i,r:i['requiredGates']['sources'].pop('corrected-2c-source-gate')),
 ('handoff-drift',lambda i,r:i['phase3Interfaces'].update(sha256='sha256:'+'0'*64)),
 ('receipt-unknown-field',change_receipt('sources',lambda r:r.update(unknown=True))),
 ('receipt-false-PASS',change_receipt('sources',lambda r:r.update(status='FAIL'))),
 ('receipt-case-omission',change_receipt('sources',lambda r:r['cases'].pop())),
 ('receipt-case-duplicate',change_receipt('sources',lambda r:r['cases'].append(r['cases'][0]))),
 ('case-evidence-substitution',change_receipt('sources',lambda r:r['cases'][0].update(evidencePaths=['wrong.json']))),
 ('receipt-revision',change_receipt('sources',lambda r:r.update(implementationRevision='0'*40))),
 ('receipt-cycle',change_receipt('sources',lambda r:r['requires'].append({'receiptId':'sources','sha256':'sha256:'+'0'*64}))),
 ('receipt-dependency-omission',change_receipt('handoff',lambda r:r['requires'].pop())),
 ('receipt-artifact-omission',change_receipt('package',lambda r:r['artifacts'].pop())),
]
results=[]
for name,mutate in mutations:
 i,r=copy.deepcopy(inv),copy.deepcopy(receipts);mutate(i,r)
 try:validate(i,r,allow_missing_selftest=True)
 except (AssertionError,ValidationError,subprocess.CalledProcessError) as error:results.append({'id':name,'status':'PASS','rejectedBy':type(error).__name__})
 else:raise AssertionError('Accepted invalid conformance: '+name)
report={'status':'PASS','positive':{'receipts':5,'casesExcludingSelfTest':sum(map(len,GATES.values()))-1,'totalRequiredCases':sum(map(len,GATES.values()))},'negativeControls':len(results),'cases':results,'scope':'Closed authority, source graph, provider claims, exact artifacts, receipt dependencies and evidence bindings; all mutations rejected without filesystem edits.'}
put('conformance-tests.json',report);print(json.dumps(report))
