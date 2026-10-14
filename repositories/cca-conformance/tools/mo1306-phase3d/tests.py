"""Bounded integration rejection witnesses; never execute the product."""
from support import *
def run_tests(values,wanted,e):
    from validate import validate_payloads
    from sbom import engine,verify_sbom
    from package import files_of
    from models import TERMINAL
    validate_payloads(values,wanted)
    cases=[]
    def add(name,fn):cases.append((name,fn))
    for role in ('C3CB','M3','S3'):
        add('wrong-'+role,lambda v,r=role:v['release-inventory.json']['authority'].update({r:'0'*40}))
    add('old-archive',lambda v:v['package.json']['archive'].update(byteLength=197172,sha256='sha256:2f1e9424ce64e44b7b1587ce206fe5f7ae72579652ca1fc891c489bc1a21925d'))
    add('wrong-distribution',lambda v:v['release-inventory.json']['distribution'].update(sha256='sha256:'+'0'*64))
    add('stale-sbom',lambda v:v['release-inventory.json']['SBOM'].update(sha256='sha256:fb3af7154220cc08fb165f75358166382c2681ef5d2181eea4afbd6179bcd839'))
    add('stale-provenance',lambda v:v['provenance.json'].update(productionAuthority=C3AB))
    add('generic-certificate-missing',lambda v:v['native-binding.json'].update(state='NOT_CERTIFIED'))
    for label in ('HOSTED_EXECUTION_CERTIFIED','LIVE_EXECUTION_CERTIFIED','PARITY_CERTIFIED','HOSTED_PASS_CERTIFIED','HOSTED_FAIL_CERTIFIED','HOSTED_CNE_CERTIFIED'):
        add('false-github-'+label,lambda v,label=label:v['release-inventory.json']['policy']['providers']['github'].update(execution=label))
    add('github-limitation-omitted',lambda v:v['release-inventory.json']['policy']['providers']['github'].update(limitation=None))
    add('historical-hosted-promoted',lambda v:next(r for r in v['history.json']['records'] if r['id']=='hosted-36357568243').update(disposition='PASS'))
    add('diagnostic-promoted',lambda v:next(r for r in v['history.json']['records'] if r['id']=='diagnostic-36396330199').update(disposition='CERTIFIED'))
    add('native-history-resolved',lambda v:v['history.json'].update(nativeHistoricalCause='RESOLVED'))
    add('undici-disposition-changed',lambda v:v['provenance.json']['advisories'][0].update(disposition='SAFE'))
    add('xml-disposition-changed',lambda v:v['provenance.json']['advisories'][1].update(disposition='MITIGATED'))
    add('3c-without-dependency-proof',lambda v:v['3c-dependency-matrix.json']['rows'][0].update(proof=[]))
    add('hidden-dependency-delta',lambda v:v['dependency-delta.json'].update(changedFiles=[]))
    add('forged-reusable-helper',lambda v:next(r for r in v['dependency-delta.json']['rows'] if r['path'].endswith('/src/filesystem.mjs')).update(classification='BYTE_IDENTICAL_REUSABLE'))
    for provider in ('gitlab','jenkins','azure'):
        add('invented-live-'+provider,lambda v,p=provider:v['release-inventory.json']['policy']['providers'][p].update(execution='REAL_EXECUTION_CERTIFIED'))
    add('provider-omitted',lambda v:v['release-inventory.json']['policy']['providers'].pop('github'))
    add('future-self-commit',lambda v:v['release-inventory.json'].update(futureCommitSelfReference=True))
    add('invented-i3-hash',lambda v:v['release-inventory.json'].update(I3='0'*40))
    add('self-provenance-hash',lambda v:v['provenance.json'].update(futureCommitSelfReference=True))
    add('premature-tag',lambda v:v['release-inventory.json']['releaseTag'].update(state='CREATED'))
    add('premature-binding',lambda v:v['release-inventory.json'].update(finalBinding='COMPLETE'))
    add('blocked-release',lambda v:v['closure-matrix.json']['counts'].update(BLOCKED=1))
    add('omitted-requirement',lambda v:v['closure-matrix.json']['rows'].pop())
    add('duplicated-requirement',lambda v:v['closure-matrix.json']['rows'].append(v['closure-matrix.json']['rows'][0]))
    add('unknown-closure-state',lambda v:v['closure-matrix.json']['rows'][0].update(status='WAIVED'))
    add('missing-freeze-coverage',lambda v:v['closure-matrix.json']['freezeSections'].pop())
    add('missing-decision-coverage',lambda v:v['closure-matrix.json']['decisions'].pop())
    add('missing-category-coverage',lambda v:v['closure-matrix.json']['categories'].pop())
    add('missing-native-group',lambda v:v['native-binding.json']['retainedGroups'].pop())
    add('fourth-role-allowed',lambda v:v['native-binding.json']['correctionA'].update(maximumAttributableRoles=4))
    add('deadline-success-grace',lambda v:v['native-binding.json']['correctionB'].update(acceptance='now <= effectiveDeadline + grace'))
    add('changed-action-pin',lambda v:v['provenance.json']['actionPins'].update(checkout='0'*40))
    add('changed-runtime',lambda v:v['native-binding.json']['environment'].update(nodeVersion='24.0.0'))
    add('old-candidate-install',lambda v:v['package.json']['offlineInstall'].update(state='REUSED_OLD_ARCHIVE'))
    add('missing-payload',lambda v:v.pop('history.json'))
    rejected=[]
    for name,mutate in cases:
        v=copy.deepcopy(values);mutate(v)
        try:validate_payloads(v,wanted)
        except (AssertionError,KeyError,ValueError) as ex:rejected.append({'id':name,'status':'PASS','rejection':str(ex)[:200]})
        else:raise AssertionError('NEGATIVE_ACCEPTED '+name)
    schema=engine();files=files_of();valid=values['sbom.spdx.json']
    sbom_cases={
      'sbom-old-filesystem':lambda v:next(f for f in v['files'] if f['fileName']=='./src/filesystem.mjs')['checksums'][1].update(checksumValue='0'*64),
      'sbom-old-archive':lambda v:v['packages'][0]['checksums'][0].update(checksumValue='2f1e9424ce64e44b7b1587ce206fe5f7ae72579652ca1fc891c489bc1a21925d'),
      'sbom-old-verification-code':lambda v:v['packages'][0]['packageVerificationCode'].update(packageVerificationCodeValue='0'*40),
      'sbom-missing-file':lambda v:v['files'].pop(),
      'sbom-sdk-ownership':lambda v:next(r for r in v['relationships'] if r['relationshipType']=='CONTAINS').update(spdxElementId='SPDXRef-UNKNOWN'),
      'sbom-changed-supply':lambda v:v['packages'][2].update(versionInfo='0.0.0'),
      'sbom-missing-relationship':lambda v:v['relationships'].pop(),
      'sbom-unknown-schema-field':lambda v:v.update(unknown=True),
      'sbom-invalid-file-type':lambda v:v['files'][0].update(fileTypes=['INVALID']),
      'sbom-invalid-format':lambda v:v['creationInfo'].update(created='not-a-date')}
    for name,mutate in sbom_cases.items():
        v=copy.deepcopy(valid);mutate(v)
        try:verify_sbom(v,e,files,schema)
        except Exception as ex:rejected.append({'id':name,'status':'PASS','rejection':type(ex).__name__+': '+str(ex).splitlines()[0][:180]})
        else:raise AssertionError('SBOM_NEGATIVE_ACCEPTED '+name)
    inv=values['release-inventory.json'];matrix=values['closure-matrix.json'];p=values['package.json']
    positives={
      'exact-authority-chain':inv['authority']==CHAIN,
      'exact-final-archive':p['archive']['byteLength']==197290 and p['archive']['sha256']==ARCHIVE,
      'package-members':p['members']==94,
      'sdk-closure':p['sdkClosure']==25,
      'zero-production-dependencies':p['productionDependencies']==0,
      'reproduction-same-bytes':p['reproducibility']['sameBytes'],
      'exact-candidate-offline-install':p['offlineInstall']['state']=='REUSED_EXACT_CANDIDATE',
      'generic-required':values['native-binding.json']['state']=='REAL_EXECUTION_CERTIFIED',
      'hosted-limitation':inv['policy']['providers']['github']['execution']=='NOT_CERTIFIED',
      'eight-native-groups':len(values['native-binding.json']['retainedGroups'])==8,
      'matrix-no-blocker':matrix['counts']['BLOCKED']==0,
      'matrix-counts':sum(matrix['counts'].values())==len(matrix['rows']),
      'all-freeze-sections':matrix['freezeSections']==list(range(1,27)),
      'all-decisions':len(matrix['decisions'])==32,
      'all-categories':len(matrix['categories'])==24,
      'no-self-reference':inv['futureCommitSelfReference'] is False,
      'tag-absent':inv['releaseTag']['state']=='ABSENT',
      'no-campaign':inv['executionCampaigns']==0,
      'no-production-change':inv['productionChanges']==0,
      'full-sbom':verify_sbom(valid,e,files,schema)['status']=='PASS'}
    for name,result in positives.items():need(result,'POSITIVE_FAILED '+name)
    return {'status':'PASS','negativeCount':len(rejected),'positiveCount':len(positives),'totalCount':len(rejected)+len(positives),'negatives':rejected,'positives':[{'id':name,'status':'PASS'} for name in positives],'scope':'Current final-integration conformance only; historical campaign counts and the separate S3 85/2 controls are not added.'}
