"""In-memory rejection controls; no product execution or altered evidence files."""
import copy
from audit import *
from rule import *
def run_tests():
    e=Evidence();e.run();case=read(OUT/'eligibility.json');negative=[];positive=[]
    def reject(name,fn):
        try:fn()
        except (AssertionError,KeyError,ValueError,TypeError) as x:
            negative.append({'id':name,'result':'REJECTED','reason':str(x)});return
        raise AssertionError('UNSAFE_ACCEPTANCE '+name)
    need(eligible(case)=='ELIGIBLE_FOR_ONE_FINAL_WITNESS','VALID_CASE_REJECTED');positive.append('fully-evidenced-current-eligibility-only')
    for key in FORBIDDEN:
        m=copy.deepcopy(case);m['ineligible'][key]=True;reject(key,lambda m=m:eligible(m))
    for i,key in enumerate(CONDITIONS):
        for state in ['FAIL','NOT_ESTABLISHED']:
            m=copy.deepcopy(case);m['matrix'][i]['status']=state;reject(key+'-'+state,lambda m=m:eligible(m))
    mutations=[('missing-condition',lambda m:m['matrix'].pop()),('duplicate-condition',lambda m:m['matrix'].append(m['matrix'][0])),('condition-without-evidence',lambda m:m['matrix'][0].update(evidence=[])),('unknown-field',lambda m:m.update(waiver=True)),('history-rewritten-pass',lambda m:m['history'].update(disposition='PASS')),('historical-windows-cause',lambda m:m['history'].update(causalCategory='WINDOWS_FAILURE')),('candidate-mismatch',lambda m:m['candidate'].update(productionAuthority='0'*40)),('enhanced-absent',lambda m:m['plan'].update(enhancedId=None)),('evidence-class-missing',lambda m:m['evidenceClasses'].pop('structural')),('reliability-probability',lambda m:m['claims'].update(reliabilityProbability=.99)),('premature-certification',lambda m:m['claims'].update(currentCandidateCertified=True)),('attempt-already-consumed',lambda m:m['plan'].update(finalAttemptsConsumed=1)),('retry-policy',lambda m:m['plan'].update(retryUntilPass=True)),('campaign-reset',lambda m:m['plan'].update(finalCampaign='replacement-campaign')),('no-final-disclosure',lambda m:m['disclosure'].pop('history')),('cause-resolved',lambda m:m['claims'].update(historicalCauseEstablished=True)),('reuse-dependency-drift',lambda m:m['reuse'].update(exactDependenciesRequired=False)),('ineligible-enum-omission',lambda m:m['ineligible'].pop('securityBypass'))]
    for name,mutate in mutations:
        m=copy.deepcopy(case);mutate(m);reject(name,lambda m=m:eligible(m))
    for run_id in [*FAITHFUL,ENHANCED]:
        directory=('phase3a-environment-capture/runs/' if run_id==ENHANCED else 'phase3a-publication-diagnostic/reproductions/')+run_id
        s=e.load(directory+'/summary.json');files={Path(r['path']).name:e.bound(r) for r in s['bundleFiles']};need(bundle_valid(files,s['actual']['runId']),'VALID_BUNDLE_REJECTED');positive.append('real-observed-bundle-'+run_id)
    good=files;rid=s['actual']['runId']
    for name in sorted(BASIC):
        reject('missing-'+name,lambda name=name:bundle_valid({k:v for k,v in good.items() if k!=name},rid))
    reject('extra-bundle-member',lambda:bundle_valid({**good,'sidecar.json':b'{}'},rid))
    wrong=copy.deepcopy(good);wrong['memoryos-ci-result.json']=wrong['memoryos-ci-result.json'].replace(b'INPUT_ERROR',b'PASS')
    reject('actual-normative-result-tamper',lambda:bundle_valid(wrong,rid))
    wrong_marker=copy.deepcopy(good);z=json.loads(wrong_marker['memoryos-ci-complete.json']);z['manifestSha256']='sha256:'+'0'*64;wrong_marker['memoryos-ci-complete.json']=(json.dumps(z,sort_keys=True,separators=(',',':'))+'\n').encode()
    reject('false-marker-digest',lambda:bundle_valid(wrong_marker,rid))
    stale=copy.deepcopy(e.local('phase3a-environment-capture/REPORT.md'));stale['sha256']='sha256:'+'0'*64;reject('historical-copy-byte-tamper',lambda:check_ref(stale))
    # No synthetic final PASS is reported as actual certification. All final
    # transition controls below use a model receipt solely to exercise rejection.
    revision='a'*40
    final={'kind':'MemoryOSBoundedFinalWitness','methodologyRevision':revision,'disclosure':{**copy.deepcopy(case['disclosure']),'methodologyRevision':revision,'receiptState':'FINAL_WITNESS_RECORDED'},'attempts':[{'id':'synthetic-final-control','candidate':case['candidate'],'result':'PASS','recurrence':False,'evidence':[]}],'allAttemptsAccounted':True,'retainedGroupsVerified':True,'previousFailureRecorded':False}
    final_mutations=[('final-repeat-failure',lambda x:x['attempts'][0].update(result='FAIL',recurrence=True)),('final-retry-after-failure',lambda x:x.update(previousFailureRecorded=True)),('final-second-attempt',lambda x:x['attempts'].append(copy.deepcopy(x['attempts'][0]))),('final-incomplete-ledger',lambda x:x.update(allAttemptsAccounted=False)),('final-reuses-diagnostic',lambda x:x['attempts'][0].update(id=ENHANCED)),('final-missing-disclosure',lambda x:x['disclosure'].pop('history')),('final-wrong-methodology',lambda x:x.update(methodologyRevision=BASE)),('final-reuse-not-verified',lambda x:x.update(retainedGroupsVerified=False))]
    for name,mutate in final_mutations:
        m=copy.deepcopy(final);mutate(m);reject(name,lambda m=m:final_transition(case,m,revision,lambda _:True))
    reject('final-real-evidence-not-verified',lambda:final_transition(case,final,revision,lambda _:False))
    return {'status':'PASS','negativeCount':len(negative),'positiveCount':len(positive),'negativeControls':negative,'positiveControls':positive,'productExecutions':0,'finalWitnessExecuted':False,'positiveScope':'One fully supported eligibility case and four actual retained operational bundles; no synthetic final-certification PASS.'}
if __name__=='__main__':
    v=run_tests()
    if '--record' in sys.argv:save(OUT/'tests.json',v)
    print(json.dumps({'status':v['status'],'negative':v['negativeCount'],'positive':v['positiveCount'],'productExecutions':0}))
