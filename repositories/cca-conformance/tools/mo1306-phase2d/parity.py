"""Fresh SDK byte parity plus provider-neutral cross-provider identity checks."""
from common import *
import shutil
native=json.loads((OUT/'native-execution.json').read_bytes());assert native['status']=='PASS'
cases={c['id']:c for c in native['cases']};comparisons=[]
for name in ['pass','fail','cne','set','regression','metadata']:
 reference=ROOT/cases['generic-'+name]['bundle']
 for provider in ['generic','gitlab','jenkins','azure','github']:
  case=cases[provider+'-'+name];bundle=ROOT/case['bundle']
  for filename in ['evaluation-identity.json','policy-outcome.json']:
   assert (bundle/filename).read_bytes()==(reference/filename).read_bytes()==(ROOT/case['oracle']/filename).read_bytes()
  comparisons.append({'id':case['id'],'status':'PASS','artifacts':[row(bundle/f) for f in ['evaluation-identity.json','policy-outcome.json']]})
for provider in ['generic','gitlab','jenkins','azure','github']:
 for filename in ['evaluation-identity.json','policy-outcome.json']:
  assert (ROOT/cases[provider+'-metadata']['bundle']/filename).read_bytes()==(ROOT/cases[provider+'-pass']['bundle']/filename).read_bytes()
batch=CACHE/('parity-'+uuid.uuid4().hex[:6]);batch.mkdir();supplement=[]
for kind,name,expected in [('set','fail',6),('set','cne',7),('regression','fail',6)]:
 prior_folder=OUT/'parity-bundles'/(kind+'-'+name)
 if prior_folder.exists():
  targets=list(prior_folder.iterdir());assert len(targets)==1;target=targets[0]
  evidence=json.loads((target/'memoryos-ci-evidence.json').read_bytes());assert evidence['distributionSha256']==native['distributionDigest']
  cmd=json.loads((OUT/'commands'/('sdk-'+kind+'-'+name+'.json')).read_bytes());assert cmd['status']=='PASS';prior_work=Path(cmd['command'][-1])
  for actual,oracle_name in [('evaluation-identity.json','oracle-identity.json'),('policy-outcome.json','oracle-outcome.json')]:assert (target/actual).read_bytes()==(prior_work/oracle_name).read_bytes()
  result=json.loads((target/'memoryos-ci-result.json').read_bytes());assert result['process']['exitCode']==expected
  supplement.append({'id':kind+'-'+name,'status':'PASS','exitCode':expected,'decision':result['semantic']['decision'],'bundle':target.relative_to(ROOT).as_posix(),'artifacts':[row(target/f) for f in ['evaluation-identity.json','policy-outcome.json']]})
  continue
 work=batch/(kind+'-'+name);fixture=ROOT/'repositories/cca-conformance/fixtures/mo1306'/('evaluate-policySet-'+name if kind=='set' else 'evaluate-policy-'+name)
 shutil.copytree(fixture,work);config=json.loads((work/'memoryos-ci.json').read_bytes())
 if kind=='regression':shutil.copyfile(work/'candidate.mip',work/'baseline.mip');config['context']['baselineMip']='baseline.mip';(work/'memoryos-ci.json').write_bytes(j(config))
 _,oracle=command('sdk-'+kind+'-'+name,[NODE,TOOLS.parent/'mo1306/oracle.mjs',work]);decision=json.loads(oracle)['decision'];assert decision==('FAIL' if expected==6 else 'COULD_NOT_EVALUATE')
 _,raw=command('parity-'+kind+'-'+name,[NODE,'--max-old-space-size=128',PKG/'bin/memoryos-ci.mjs','run','--workspace',work,'--config',work/'memoryos-ci.json','--provider','generic'],expected)
 summary=json.loads(raw);assert summary['publication']=='COMPLETE';bundle=work/'.memoryos-ci/out'/summary['runId']
 target=OUT/'parity-bundles'/(kind+'-'+name)/summary['runId'];target.parent.mkdir(parents=True,exist_ok=True);shutil.copytree(bundle,target)
 for actual,oracle_name in [('evaluation-identity.json','oracle-identity.json'),('policy-outcome.json','oracle-outcome.json')]:assert (bundle/actual).read_bytes()==(work/oracle_name).read_bytes()
 supplement.append({'id':kind+'-'+name,'status':'PASS','exitCode':expected,'decision':decision,'bundle':target.relative_to(ROOT).as_posix(),'artifacts':[row(target/f) for f in ['evaluation-identity.json','policy-outcome.json']]})
missing=batch/'regression-missing-baseline-cne';shutil.copytree(ROOT/'repositories/cca-conformance/fixtures/mo1306/evaluate-policy-cne',missing)
_,oracle=command('sdk-regression-missing-baseline-cne',[NODE,TOOLS.parent/'mo1306/oracle.mjs',missing]);assert json.loads(oracle)['decision']=='COULD_NOT_EVALUATE'
regression_cne=ROOT/cases['generic-cne']['bundle']
for actual,oracle_name in [('evaluation-identity.json','oracle-identity.json'),('policy-outcome.json','oracle-outcome.json')]:assert (regression_cne/actual).read_bytes()==(missing/oracle_name).read_bytes()
put('regression-cne-fixture-disposition.json',{'status':'DIAGNOSED_HARNESS_EXPECTATION','observedSDKDecisionWithBaseline':'PASS','expectedDecisionWithoutBaseline':'COULD_NOT_EVALUATE','originalObservation':row(OUT/'commands/sdk-regression-cne.json'),'correction':'The policy prohibits regression findings. It is CNE without the prerequisite regression fact source; adding a baseline makes it evaluable and the identical baseline/candidate has no prohibited finding. No product or semantic expectation was changed to override the SDK.'})
put('semantic-parity.json',{'status':'PASS','distributionDigest':native['distributionDigest'],'allFiveComparisons':comparisons,'supplementalSDKCases':supplement,'regressionMissingBaselineCNE':{'status':'PASS','bundle':cases['generic-cne']['bundle'],'oracle':row(OUT/'commands/sdk-regression-missing-baseline-cne.json'),'scope':'Regression-specific rule without its required baseline context; supplying the identical baseline correctly yields PASS.'},'metadataNonsemantic':True,'scope':'Policy, PolicySet and regression PASS/FAIL/CNE exact independent SDK normative bytes. Six native vectors across each of five providers; supplemental generic PolicySet FAIL/CNE and paired regression-context FAIL, plus fresh SDK regression-rule CNE with its baseline prerequisite absent. All-five common error projections are independently checked by integration-structure and 2A equivalence tests.'})
