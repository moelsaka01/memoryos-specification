import execution as e
from execution import *
e.EVIDENCE=ROOT/'repositories/cca-conformance/evidence/mo1306/phase1-negative'
EVIDENCE=e.EVIDENCE
EVIDENCE.mkdir(parents=True,exist_ok=True)
started=time.perf_counter()
work=CACHE/'work/phase1-resume/real-maximum-semantic'
r=json.loads((ROOT/'repositories/cca-conformance/evidence/mo1306/phase1-completion/real-maximum-semantic.json').read_bytes())
summary=json.loads(r['stdout']);bundle=work/'.memoryos-ci/out'/summary['runId']
for source,target in [('oracle-identity.json','evaluation-identity.json'),('oracle-outcome.json','policy-outcome.json')]:
 assert (work/source).read_bytes()==(bundle/target).read_bytes()
command('maximum-cli',[ROOT/'repositories/memoryos-cli/bin/memoryos.js','policy','evaluate','--policy-set',work/'policy.json','--package',work/'candidate.mip','--outcome',work/'cli-outcome.json','--identity-output',work/'cli-identity.json','--regression-baseline',work/'baseline.mip'],summary['exitCode'])
assert (work/'cli-identity.json').read_bytes()==(bundle/'evaluation-identity.json').read_bytes()
assert (work/'cli-outcome.json').read_bytes()==(bundle/'policy-outcome.json').read_bytes()
print('maximum SDK/CLI parity PASS; original SDK output reused byte-for-byte',flush=True)
negatives=[
 ('unknown-config',lambda c,w:c.update(unrecognized=True),10),
 ('missing-input',lambda c,w:(w/'candidate.mip').unlink(),11),
 ('pin-mismatch',lambda c,w:c['policy'].update(expectedSemanticDigest='sha256:'+'0'*64),15),
 ('invalid-semantic',lambda c,w:(w/'policy.json').write_bytes(b'{}'),12),
 ('oversized-input',lambda c,w:(w/'candidate.mip').write_bytes(b' '*(524288+1)),11),
 ('traversal',lambda c,w:c['context'].update(candidateMip='../candidate.mip'),11),
]
for suffix,change,expected in negatives:
 name='negative-'+suffix;work,config=workspace(name,'evaluate-policy-pass',change);product(name,work,expected);print(name,'PASS',flush=True)
for suffix,extra in [('node-options',{'NODE_OPTIONS':'--no-warnings'}),('node-path',{'NODE_PATH':'SECRET-SENTINEL'})]:
 name='negative-'+suffix;work,config=workspace(name,'evaluate-policy-pass');assert product(name,work,15,env={**ENV,**extra}) is None
 print(name,'PASS',flush=True)
work,config=workspace('operational-metadata','evaluate-policy-pass')
env={**ENV,'GITHUB_SHA':'A'*40,'GITHUB_RUN_ID':'9999','GITHUB_ACTOR':'SECRET-SENTINEL','GITHUB_REF':'SECRET-SENTINEL','HTTP_PROXY':'http://127.0.0.1:1','GITHUB_TOKEN':'SECRET-SENTINEL','HOME':'SECRET-SENTINEL','TEMP':'SECRET-SENTINEL','PATH':'SECRET-SENTINEL'}
bundle=product('operational-metadata',work,0,env=env);assert bundle
assert (bundle/'evaluation-identity.json').read_bytes()==(FIX/'evaluate-policy-pass/evaluation-identity.json').read_bytes()
assert (bundle/'policy-outcome.json').read_bytes()==(FIX/'evaluate-policy-pass/policy-outcome.json').read_bytes()
assert all(b'SECRET-SENTINEL' not in p.read_bytes() for p in bundle.iterdir())
(EVIDENCE/'execution-summary.json').write_bytes(j(dict(status='PASS',elapsedMs=round((time.perf_counter()-started)*1000),caseCount=len(cases),caseIds=[c['id'] for c in cases],ordinaryValidationTargetMs=1200000)))
print('Execution cases',len(cases),'PASS',flush=True)
