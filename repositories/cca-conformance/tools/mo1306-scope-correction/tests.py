"""In-memory false-claim rejection. These are not certification campaigns."""
import copy
from common import *
from policy import *
def run_tests():
    p=read(AUTH)['policy'];validate_policy(p);validate_pre3d(read(AUTH)['pre3D']);neg=[]
    def reject(name,fn):
        try:fn()
        except (AssertionError,KeyError,ValueError,TypeError) as x:neg.append({'id':name,'result':'REJECTED','reason':str(x)});return
        raise AssertionError('UNSAFE_ACCEPTANCE '+name)
    cases=[
      ('github-hosted-certified',lambda v:v['providers']['github'].update(execution='HOSTED_EXECUTION_CERTIFIED')),
      ('github-parity-certified',lambda v:v['hostedFacts'].update(parity='CERTIFIED')),
      ('github-hosted-pass',lambda v:v['hostedFacts'].update(passCertified=True)),
      ('github-hosted-fail',lambda v:v['hostedFacts'].update(failCertified=True)),
      ('github-hosted-cne',lambda v:v['hostedFacts'].update(cneCertified=True)),
      ('invented-fail-execution',lambda v:v['hostedFacts'].update(failExecuted=True)),
      ('invented-cne-execution',lambda v:v['hostedFacts'].update(cneExecuted=True)),
      ('historical-run-promoted-pass',lambda v:v['hostedFacts']['initialRun'].update(conclusion='success',disposition='PASS')),
      ('diagnostic-as-certificate',lambda v:v['hostedFacts']['diagnosticRun'].update(isCertification=True)),
      ('generic-certificate-removed',lambda v:v['providers']['generic'].update(execution='NOT_CERTIFIED')),
      ('github-limitation-omitted',lambda v:v['providers']['github'].pop('limitation')),
      ('github-unqualified-supported',lambda v:v['providers']['github'].update(releaseStatus='SUPPORTED')),
      ('false-global-github-wording',lambda v:v.update(canonicalReleaseWording='GitHub is certified.')),
      ('unknown-release-claim',lambda v:v.update(allProvidersCertified=True)),
      ('missing-provider',lambda v:v['providers'].pop('jenkins')),
      ('missing-forbidden-claims',lambda v:v['forbiddenClaims'].clear()),
      ('relabeled-transient',lambda v:v['hostedFacts'].update(rootCause='TRANSIENT')),
      ('diagnostic-failure-hidden',lambda v:v['hostedFacts']['diagnosticRun'].update(conclusion='success'))]
    for name,mutate in cases:
        v=copy.deepcopy(p);mutate(v);reject(name,lambda v=v:validate_policy(v))
    for provider in ['gitlab','jenkins','azure']:
        v=copy.deepcopy(p);v['providers'][provider]['execution']='LIVE_PROVIDER_CERTIFIED';reject(provider+'-invented-live-certification',lambda v=v:validate_policy(v))
        v=copy.deepcopy(p);v['providers'][provider]['limitation']=None;reject(provider+'-omitted-limitation',lambda v=v:validate_policy(v))
    for gate,value in GATES.items():
        v=copy.deepcopy(p);v['releaseGates'][gate]='NOT_REQUIRED' if value=='MANDATORY' else 'MANDATORY';reject('changed-gate-'+gate,lambda v=v:validate_policy(v))
    for name in SECURITY:
        v=copy.deepcopy(p);v['securityBoundaries'][name]='OPTIONAL';reject('weakened-'+name,lambda v=v:validate_policy(v))
    for name in ENVIRONMENT:
        v=copy.deepcopy(p);v['environmentPrerequisites'][name]=True;reject('new-prerequisite-'+name,lambda v=v:validate_policy(v))
    for name in NOT_PROVEN:
        v=copy.deepcopy(p);v['unprovenCauses'][name]='PROVEN';reject('invented-cause-'+name,lambda v=v:validate_policy(v))
    for name in STOP:
        v=copy.deepcopy(p);v['diagnosticStop'][name]=True if name=='scopeCorrectionReopensExecution' else 'AUTHORIZED';reject('reopened-'+name,lambda v=v:validate_policy(v))
    for key in ['released','phase3Complete','tagReady','phase3DRequirementsCompleted','executionCampaignsAuthorized']:
        v=pre3d();v[key]=True;reject('premature-'+key,lambda v=v:validate_pre3d(v))
    for name in NEXT:
        v=pre3d();v['phase3DRequirements']=v['phase3DRequirements'][:];v['phase3DRequirements'].remove(name);reject('missing-3D-'+name,lambda v=v:validate_pre3d(v))
    stale=copy.deepcopy(read(AUTH)['bindings']['diagnosticReceipt']);stale['sha256']='sha256:'+'0'*64;reject('tampered-historical-evidence',lambda:check(stale))
    return {'status':'PASS','negativeCount':len(neg),'positiveCount':2,'positive':['exact-five-provider-qualified-scope','exact-pre3D-state-with-all-requirements-pending'],'negative':neg,'productExecutions':0,'networkCalls':0,'scope':'Offline conformance controls only.'}
if __name__=='__main__':
    v=run_tests()
    if '--record' in sys.argv:save(OUT/'tests.json',v)
    print(json.dumps({'status':v['status'],'negativeCount':v['negativeCount'],'positiveCount':v['positiveCount']}))
