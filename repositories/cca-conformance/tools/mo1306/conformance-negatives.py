import copy,json,sys
from pathlib import Path
from binding import prepare
from conformance import verify
from materialize import ROOT,j
candidate='--candidate' in sys.argv
if candidate:inv,receipts,positive=prepare(True)
else:
 from conformance import read,BASE
 inv=read(BASE/'mo1306-conformance-inventory.json');receipts={r['id']:read(ROOT/r['path']) for r in inv['receipts']};positive=verify(inv,receipts)
def first(rs):return rs[sorted(rs)[0]]
mutations=[
 ('inventory-unknown',lambda i,r:i.update(unknown=True)),
 ('receipt-unknown',lambda i,r:first(r).update(unknown=True)),
 ('artifact-missing',lambda i,r:i['artifacts'].pop()),
 ('artifact-extra',lambda i,r:i['artifacts'].append(i['artifacts'][0])),
 ('artifact-hash-drift',lambda i,r:i['artifacts'][0].update(sha256='sha256:'+'0'*64)),
 ('artifact-length-drift',lambda i,r:i['artifacts'][0].update(byteLength=i['artifacts'][0]['byteLength']+1)),
 ('wrong-freeze',lambda i,r:i['contract'].update(freezeRevision='0'*40)),
 ('wrong-implementation',lambda i,r:i['implementation'].update(revision='0'*40)),
 ('wrong-contract',lambda i,r:i['contract'].update(contractDigest='sha256:'+'0'*64)),
 ('wrong-runtime',lambda i,r:first(r)['environment'].update(nodeSha256='sha256:'+'0'*64)),
 ('forged-pass',lambda i,r:first(r)['cases'][0].update(status='FAIL')),
 ('omitted-required-case',lambda i,r:first(r)['cases'].pop(0)),
 ('omitted-required-id',lambda i,r:next(x for x in i['categories'] if x['requiredCaseIds'])['requiredCaseIds'].pop()),
 ('provider-relabel',lambda i,r:next(x for x in i['providers'] if x['id']=='github').update(status='HOSTED_EXECUTION_CERTIFIED')),
 ('platform-relabel',lambda i,r:first(r)['scope'].update(platform='windows-2022-x64')),
 ('stale-hosted-association',lambda i,r:first(r)['environment'].update(hostedRun={'repository':'a/b','revision':'1'*40,'runId':'1','attempt':1,'jobIds':['1']})),
 ('stale-os-association',lambda i,r:first(r)['environment'].update(osBuild='0')),
 ('duplicate-case-id',lambda i,r:first(r)['cases'].append(first(r)['cases'][0])),
 ('duplicate-receipt-id',lambda i,r:i['receipts'].append(i['receipts'][0])),
 ('unresolved-reference',lambda i,r:next(x for x in i['categories'] if x['receiptIds'])['receiptIds'].append('missing')),
 ('cyclic-reference',lambda i,r:first(r)['reusedEvidence'].append({'receiptId':first(r)['id'],'sha256':next(x['sha256'] for x in i['receipts'] if x['id']==first(r)['id']),'reason':'negative','unchangedArtifactDigests':[first(r)['artifacts'][0]['sha256']]})),
 ('false-reuse',lambda i,r:first(r)['reusedEvidence'].append({'receiptId':first(r)['id'],'sha256':'sha256:'+'0'*64,'reason':'negative','unchangedArtifactDigests':['sha256:'+'0'*64]})),
 ('release-ready-with-unmet-hosted',lambda i,r:i.update(releaseState='READY_TO_TAG')),
 ('missing-evidence',lambda i,r:first(r)['cases'][0].update(evidencePaths=[])),
 ('command-exit-mismatch',lambda i,r:first(r)['cases'][0].update(exitCode=99)),
 ('category-omission',lambda i,r:i['categories'].pop()),
 ('receipt-identity-drift',lambda i,r:first(r).update(distributionDigest='sha256:'+'0'*64)),
 ('harness-revision-drift',lambda i,r:first(r).update(harnessRevision='0'*40))
]
results=[]
for name,mutate in mutations:
 i,r=copy.deepcopy(inv),copy.deepcopy(receipts);mutate(i,r)
 try:verify(i,r,candidate=candidate)
 except Exception as e:results.append({'id':name,'status':'PASS','rejection':type(e).__name__+':'+str(e)[:160]})
 else:raise AssertionError('Negative accepted: '+name)
result={'status':'PASS','mode':'UNCOMMITTED_CANDIDATE' if candidate else 'I1_BOUND','positive':positive,'negativeCount':len(results),'cases':results}
if '--write' in sys.argv:
 (ROOT/'repositories/cca-conformance/evidence/mo1306/pre-I1-conformance.json').write_bytes(j(result))
print(json.dumps(result))
