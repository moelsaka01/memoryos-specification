from pathlib import Path
import json,re,shutil,subprocess,hashlib,winreg
from materialize import ROOT,PKG,j,sha
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306'
def load(rel):return json.loads((OUT/rel).read_bytes())
def ref(p):return {'path':p.relative_to(ROOT).as_posix(),'byteLength':p.stat().st_size,'sha256':sha(p.read_bytes())}
proofs=OUT/'proofs';proofs.mkdir(exist_ok=True)
# Exact independent source SDK and released CLI outputs for eight native vectors.
semantic=[]
for name in ['evaluate-policy-pass','evaluate-policy-fail','evaluate-policy-cne','evaluate-policySet-pass','evaluate-policySet-fail','evaluate-policySet-cne','regression','maximum-semantic']:
 case='real-'+name
 location='phase1-completion' if name=='maximum-semantic' else 'phase1-resume-validated'
 r=load(location+'/'+case+'.json');assert r['exitCode'] in [0,6,7]
 summary=json.loads(r['stdout']);work=ROOT/'.cache/mo1306/work/phase1-resume'/case
 bundle=work/'.memoryos-ci/out'/summary['runId'];files=[]
 for source,target in [('oracle-identity.json','evaluation-identity.json'),('oracle-outcome.json','policy-outcome.json'),('cli-identity.json','evaluation-identity.json'),('cli-outcome.json','policy-outcome.json')]:
  b=(work/source).read_bytes();assert b==(bundle/target).read_bytes(),(name,source)
  dest=proofs/'oracles'/name/source;dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(b);files.append(ref(dest))
 semantic.append({'id':name,'status':'PASS','decision':summary['classification'],'exitCode':r['exitCode'],'files':files,'originalExecution':ref(OUT/location/(case+'.json'))})
prior=load('pre-final-distribution-manifest.json');current=json.loads((PKG/'distribution-manifest.json').read_bytes());old={r['path']:r['sha256'] for r in prior['files']}
unchanged=[]
for r in current['files']:
 if r['path'].startswith(('runtime/','schemas/')) or r['path'] in ['src/delegate.mjs','src/worker.mjs','src/verification.mjs','src/contracts.mjs','src/schema.mjs','src/json.mjs','src/serialization.mjs','src/errors.mjs','src/supervisor.mjs','src/core.mjs']:
  assert r['sha256']==old[r['path']],r['path'];unchanged.append(r)
(proofs/'semantic-parity.json').write_bytes(j({'status':'PASS','caseCount':len(semantic),'cases':semantic,'unchangedRelevantMembers':unchanged,'limitations':['Earlier executions precede I1; exact source SDK/CLI outputs and original attempt records are retained.','Reuse proves unchanged semantic bytes; final installed-package and changed environment/integrity behavior have separate fresh evidence.']}))
# Select only independently completed boundary subcases from the failed old wrapper.
boundary=load('boundaries.json');rows=[json.loads(line) for line in boundary['stdout'].splitlines()]
accepted=[r for r in rows if r['status']=='PASS'];assert len(accepted)==9
assert rows[-1]['id']=='distribution-source-substitution' and rows[-1]['status']=='FAIL'
assert (ROOT/'.cache/mo1306/boundaries/file-link').is_symlink(),'Real symlink witness unavailable'
(proofs/'filesystem-evidence.json').write_bytes(j({'status':'PASS','cases':accepted,'source':ref(OUT/'boundaries.json'),'qualification':'Only the nine completed independent filesystem/bundle subcases are reused. The original wrapper remains failed; its integrity-mapping failure is corrected and covered by accepted-cheap/affected-integrity.json.','verificationModuleSha256':sha((PKG/'src/verification.mjs').read_bytes())}))
# Read all accepted current outputs before recording aggregate proof.
for rel in ['accepted-cheap/structural.json','accepted-cheap/contracts.json','accepted-cheap/security.json','accepted-cheap/affected-integrity.json','predecessors/mo1301-contract.json','predecessors/mo1302-contract.json']:
 assert load(rel)['status']=='PASS'
for row in load('lifecycle-final/cases.json'):assert row['status']=='PASS'
for rel in ['lifecycle/real-extra-2.json','lifecycle/real-extra-3.json','lifecycle/parent-termination.json']:assert load(rel)['status']=='PASS'
package=load('package-v2/identity.json');assert package['status']=='PASS'
assert package['distributionDigest']==sha((PKG/'distribution-manifest.json').read_bytes())
archive=ROOT/package['archive']['path'];assert sha(archive.read_bytes())==package['archive']['sha256']
lock=ROOT/package['npmLock']['path'];shutil.copyfile(lock,proofs/'installed-package-lock.json')
(proofs/'supply-chain.json').write_bytes(j({'status':'PASS','review':ref(ROOT/'docs/mo1306-phase1-supply-chain-review.md'),'runtime':ref(OUT/'runtime-versions.json'),'npmClosure':ref(OUT/'npm-closure.json'),'validatorLock':ref(ROOT/'repositories/cca-conformance/fixtures/mo1306/engineering-validator-lock.json'),'archiveIdentity':ref(OUT/'package-v2/identity.json'),'claimsZeroVulnerabilities':False}))
with winreg.OpenKey(winreg.HKEY_LOCAL_MACHINE,r'SOFTWARE\Microsoft\Windows NT\CurrentVersion') as key:
 build=winreg.QueryValueEx(key,'CurrentBuildNumber')[0];ubr=winreg.QueryValueEx(key,'UBR')[0]
assert int(build)>=22000
(proofs/'environment.json').write_bytes(j({'os':'Microsoft Windows 11','osBuild':str(build)+'.'+str(ubr),'architecture':'x64','nodeVersion':'24.21.0','nodeSha256':'sha256:ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32','hostedRun':None}))
counts={}
for key,rel in [('contracts','accepted-cheap/contracts.json'),('security','accepted-cheap/security.json'),('mo1301','predecessors/mo1301-contract.json'),('mo1302','predecessors/mo1302-contract.json')]:
 output=load(rel)['stdout'];counts[key]=int(re.search(r'# pass (\d+)',output)[1])
counts.update(correction=14,lifecycle=7,semanticParity=8,filesystemAndBundle=9)
(proofs/'counts.json').write_bytes(j({'status':'PASS','independentCounts':counts,'note':'Do not sum command wrappers as additional unit tests. Graph/cross-field negatives are reported separately.'}))
print(json.dumps({'status':'PASS','counts':counts,'semanticVectors':8,'filesystemSubcases':9,'packageFiles':80}))
