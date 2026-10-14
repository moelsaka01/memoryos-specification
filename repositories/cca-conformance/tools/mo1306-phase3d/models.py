"""Acyclic I3 evidence and BF-only release binding models."""
from support import *
from reconcile import HOSTED
TERMINAL=('SATISFIED','SATISFIED_WITH_QUALIFIED_PROVIDER_LIMITATION','NOT_REQUIRED_BY_S3','HISTORICAL_FAILURE_PRESERVED','BLOCKED')
def history(e):
    b=obj(e,'phase3b-r2/certification-receipt.json','3B-R2')
    records=[
      ('phase1','COMPLETE',ref(ROOT/'repositories/cca-conformance/mo1306-conformance-inventory.json')),
      ('phase2','COMPLETE',ref(ROOT/'repositories/cca-conformance/mo1306-phase2-inventory.json')),
      ('first-2d-source-gate','FAIL',source(e,'phase3cr/authority.json','3C-R')),
      ('original-3a-provisional','PROVISIONAL_RECEIPT_NOT_ACCEPTED',source(e,'phase3ar/historical-b2/receipt-disposition.json')),
      ('original-3a-accepted','ENVIRONMENT_BLOCKED',source(e,'phase3ar/historical-b2/accepted-execution-receipt.json')),
      ('original-3b','COMPLETE_WITH_OPEN_FINDINGS',source(e,'phase3b-r2/certification-receipt.json','3B-R2')),
      ('first-3b-refresh','APPLICABLE_ACCEPTANCE_REQUIRED / releaseReady=false (retained draft; no completed receipt)',source(e,'phase3b-r2/certification-receipt.json','3B-R2')),
      ('original-3c-blocker','BLOCKED / PRODUCTION_DEFECT',source(e,'phase3cr/authority.json','3C-R')),
      ('cli-correction','PASS',ref(ROOT/'repositories/cca-conformance/mo1306-phase3-correction-binding.json')),
      ('3a-deadline-blocker','NATIVE_DEADLINE_BLOCKED / PRODUCT_DEADLINE_VIOLATION',source(e,'phase3ar-resolution/execution-receipt.json')),
      ('correction-b','PASS',ref(ROOT/'repositories/cca-conformance/mo1306-phase3-helper-correction-binding.json')),
      ('native-publication','FAIL / UNRESOLVED',source(e,'phase3a-certification/all-attempt-ledger.json')),
      ('publication-diagnostics','ENVIRONMENT_BLOCKED / ORIGINAL_PUBLICATION_CAUSE_UNRESOLVED',source(e,'phase3a-publication-diagnostic/execution-receipt.json')),
      ('publication-environment-capture','ENVIRONMENT_BLOCKED / UNRESOLVED',source(e,'phase3a-environment-capture/execution-receipt.json')),
      ('m3','AUTHORIZED_METHODOLOGY_WITH_HISTORY_PRESERVED',ref(ROOT/'repositories/cca-conformance/mo1306-unresolved-observation-methodology.json')),
      ('final-native','REAL_EXECUTION_CERTIFIED',source(e,'phase3a-certification/native-final-gate.json')),
      ('hosted-36357568243','FAILURE / HOSTED_BOOTSTRAP_UNRESOLVED',source(e,'phase3a-hosted-resolution/resolution-receipt.json')),
      ('diagnostic-36396330199','FAILURE / STILL_UNRESOLVED / HOSTED_DIAGNOSTIC_EXHAUSTED',source(e,'phase3a-hosted-diagnostic/execution-receipt.json')),
      ('s3','CERTIFICATION_SCOPE_CORRECTED / READY_FOR_QUALIFIED_PHASE_3D',ref(SCOPE))]
    failed={'first-2d-source-gate','original-3a-provisional','original-3a-accepted','original-3b','first-3b-refresh','original-3c-blocker','3a-deadline-blocker','native-publication','publication-diagnostics','publication-environment-capture','hosted-36357568243','diagnostic-36396330199'}
    return {'kind':'MemoryOSCICDFinalHistoricalDispositions','version':'1.0.0','records':[{'id':i,'disposition':d,'evidence':r,'historicalFailureOrUnclosedGate':i in failed,'promoted':False} for i,d,r in records],'historical3BReviewDetails':b['historicalReviews'],'original2032':'MEASUREMENT_DEFECT','nativeHistoricalCause':'UNRESOLVED','hostedHistoricalCause':'STILL_UNRESOLVED','allAttempts':source(e,'phase3a-certification/all-attempt-ledger.json'),'sourcePreservation':ref(E/'scope-correction/preservation.json'),'scope':'Historical outcomes and scope remain immutable; current closure comes from later exact evidence, M3 and S3, never rewritten failures.'}
def native(e):
    v=obj(e,'phase3a-certification/native-receipt.json');reuse=obj(e,'phase3a-certification/reused-evidence.json');env=obj(e,'phase3a-certification/native-environment.json')
    need(v['status']=='PASS' and v['nativeEvidenceComplete'] and v['historicalCauseEstablished'] is False,'NATIVE_SCOPE')
    need(v['productionAuthority']==C3CB and v['methodologyAuthority']==M3,'NATIVE_GRAPH')
    need(env['environment']['nodeVersion']=='24.21.0' and env['environment']['os']=='Windows 11','NATIVE_ENVIRONMENT')
    need(reuse['retainedGroupCount']==8 and reuse['checkedFileCount']==568,'NATIVE_GROUP_BINDINGS')
    model=read(E/'correction-a/process-model.json');need(model['maximumAttributableProcesses']==3 and model['fourthProcess']=='FAIL','CORRECTION_A_BOUNDARY')
    return {'state':'REAL_EXECUTION_CERTIFIED','environment':env['environment'],'receipt':source(e,'phase3a-certification/native-receipt.json'),'finalGate':source(e,'phase3a-certification/native-final-gate.json'),'witness':v['acceptedFinalWitness'],'finalWitnessOutcome':v['finalWitnessOutcome'],'nativeReuse':source(e,'phase3a-certification/reused-evidence.json'),'retainedGroups':[g['id'] for g in reuse['groups']],'dependencyBindings':568,'installedMembers':94,'semanticParity':v['semanticParity'],'correctionA':{'model':ref(E/'correction-a/process-model.json'),'maximumAttributableRoles':3,'fourthDescendant':'FORBIDDEN','cleanupMs':2000},'cliCorrection':{'commits':[C3A,C3AB],'binding':ref(ROOT/'repositories/cca-conformance/mo1306-phase3-correction-binding.json'),'installedCurrentEvidence':ref(E/'phase3-helper-correction/installed-regression.json')},'correctionB':{'commits':[C3C,C3CB],'binding':ref(ROOT/'repositories/cca-conformance/mo1306-phase3-helper-correction-binding.json'),'retainedValidation':ref(OUT/'correction-validation.json'),'acceptance':'now < effectiveDeadline; equality/later rejected; no success grace'},'methodology':ref(ROOT/'repositories/cca-conformance/mo1306-unresolved-observation-methodology.json'),'historicalPublicationFailure':'FAIL / UNRESOLVED','recurrenceRule':v['recurrenceRule'],'newExecutions':0}
def provenance(e):
    prior=obj(e,'phase3b-r2/provenance.json','3B-R2')
    need(read(NPM.parent.parent/'package.json')['version']=='11.19.0','NPM_VERSION')
    need(identity(check(prior['toolchain']['npm']['packageManifest']))==identity((NPM.parent.parent/'package.json').read_bytes()),'NPM_MANIFEST')
    check(prior['toolchain']['npm']['cli']);npm_closure=json.loads(check(prior['toolchain']['npm']['retainedClosure']))
    for row in npm_closure['files']:
        need(identity((NPM.parent.parent/row['path']).read_bytes())=={k:row[k] for k in ('byteLength','sha256')},'NPM_CLOSURE')
    need(len(npm_closure['files'])==1926,'NPM_CLOSURE_COUNT')
    return {'kind':'MemoryOSCICDQualifiedFinalProvenance','version':'1.0.0','authority':CHAIN,'productionAuthority':C3CB,'methodologyAuthority':M3,'scopeAuthority':S3,'productionSourceTree':git('rev-parse',C3CB+':repositories/memoryos-ci').decode().strip(),'candidateSourceTree':git('rev-parse',C3CB+'^{tree}').decode().strip(),'package':ref(OUT/'package.json'),'archive':load('package.json')['archive'],'distribution':ref(PKG/'distribution-manifest.json'),'SDKClosure':ref(PKG/'runtime/runtime-closure-manifest.json'),'toolchain':prior['toolchain'],'nodeUsed':ref(NODE),'npmManifest':ref(NPM.parent.parent/'package.json'),'schemas':prior['schemas'],'engineeringValidators':prior['engineeringValidators'],'currentSBOMValidator':ref(OUT/'validator-runtime.json'),'actionPins':PINS,'advisories':obj(e,'phase3b-r2/certification-receipt.json','3B-R2')['findings'],'prior3B':{'commit':B3,'receipt':source(e,'phase3b-r2/certification-receipt.json','3B-R2'),'provenance':source(e,'phase3b-r2/provenance.json','3B-R2')},'prior3C':{'commit':C3,'audit':source(e,'phase3cr/audit-validation.json','3C-R')},'SBOM':ref(OUT/'sbom.spdx.json'),'SBOMValidation':ref(OUT/'sbom-validation.json'),'dependencyDelta':ref(OUT/'dependency-delta.json'),'supplyReconciliation':ref(OUT/'3b-dependency-matrix.json'),'securityReconciliation':ref(OUT/'3c-dependency-matrix.json'),'native':ref(OUT/'native-binding.json'),'history':ref(OUT/'history.json'),'scopePolicy':ref(SCOPE),'integrationTools':inventory(TOOLS),'futureCommitSelfReference':False,'newResearch':False,'newExecutionCampaigns':0}
def closure(e):
    old=obj(e,'phase3cr/release-closure.json','3C-R');dep={r['id']:r for r in load('3c-dependency-matrix.json')['rows']};rows=[]
    for r in old['rows']:
        state='SATISFIED_WITH_QUALIFIED_PROVIDER_LIMITATION' if r['id'] in HOSTED else 'SATISFIED'
        evidence=dep[r['id']]['originalEvidence']+[ref(OUT/'3c-dependency-matrix.json'),ref(OUT/'native-binding.json'),ref(OUT/'provenance.json'),ref(SCOPE)]
        rows.append({k:copy.deepcopy(r[k]) for k in ('id','requirement','freezeSections','decisions','categories')})
        rows[-1].update(status=state,historicalStatus=r['status'],evidence=evidence,resolution='S3 qualified hosted limitation; NOT_CERTIFIED and unresolved failures retained.' if r['id'] in HOSTED else 'Exact dependency reconciliation plus final native/artifact/scope authority. Final commit identities resolve externally in BF; no future self-reference.')
    for provider in ('gitlab','jenkins','azure'):
        rows.append({'id':provider+'-live-provider-certification','requirement':'Live-provider execution certification','freezeSections':[],'decisions':[],'categories':[],'status':'NOT_REQUIRED_BY_S3','evidence':[ref(SCOPE)],'resolution':'Contract validation remains mandatory; live-provider certification is not claimed.'})
    for h in load('history.json')['records']:
        if h['historicalFailureOrUnclosedGate']:rows.append({'id':'history-'+h['id'],'requirement':'Preserve historical disposition: '+h['disposition'],'freezeSections':[],'decisions':[],'categories':[],'status':'HISTORICAL_FAILURE_PRESERVED','evidence':[h['evidence'],ref(OUT/'history.json')],'resolution':'Historical failure/unclosed gate retained; never relabeled PASS.'})
    need(len({r['id'] for r in rows})==len(rows),'DUPLICATE_CLOSURE')
    return {'kind':'MemoryOSCICDFinalReleaseClosure','version':'1.0.0','sourceMatrix':source(e,'phase3cr/release-closure.json','3C-R'),'scopeAuthority':S3,'rows':rows,'total':len(rows),'counts':{s:sum(r['status']==s for r in rows) for s in TERMINAL},'freezeSections':old['freezeSections'],'decisions':old['decisions'],'categories':old['categories'],'certificationRequirementsClosed':True,'finalBinding':'PENDING_IN_I3_RESOLVED_BY_BF','releaseTag':'ABSENT','remainingActionAfterValidatedBF':'RELEASE_TAG_REVIEW'}
def release_inventory():
    policy=copy.deepcopy(read(SCOPE)['policy']);validate_policy(policy)
    return {'kind':'MemoryOSCICDFinalReleaseInventory','version':'1.0.0','milestone':'MO-1306','state':'CERTIFICATIONS_INTEGRATED_FINAL_BINDING_PENDING','authority':CHAIN,'productionAuthority':C3CB,'methodologyAuthority':M3,'scopeAuthority':S3,'auditAuthorities':{'phase3bR2':B3,'phase3cR':C3},'phases':{'1':'COMPLETE','2':'COMPLETE','3':'INTEGRATED_FINAL_BINDING_PENDING'},'policy':policy,'package':ref(OUT/'package.json'),'archive':load('package.json')['archive'],'distribution':ref(PKG/'distribution-manifest.json'),'SBOM':ref(OUT/'sbom.spdx.json'),'provenance':ref(OUT/'provenance.json'),'native':ref(OUT/'native-binding.json'),'dependencyDelta':ref(OUT/'dependency-delta.json'),'phase3bReconciliation':ref(OUT/'3b-dependency-matrix.json'),'phase3cReconciliation':ref(OUT/'3c-dependency-matrix.json'),'history':ref(OUT/'history.json'),'scopePreservation':ref(E/'scope-correction/preservation.json'),'closureMatrix':ref(OUT/'closure-matrix.json'),'blocked':0,'finalBinding':'PENDING','releaseTag':{'name':'memoryos-1.3-mo1306','state':'ABSENT'},'futureCommitSelfReference':False,'productionChanges':0,'executionCampaigns':0}
def final_inventory(i3):
    v=copy.deepcopy(load('release-inventory.json'))
    v.update(state='CERTIFIED_READY_TO_TAG',phases={'1':'COMPLETE','2':'COMPLETE','3':'COMPLETE'},finalBinding={'state':'VALIDATED_BY_CONTAINING_BF','I3':i3,'immutableInventory':ref(OUT/'release-inventory.json'),'graph':ref(OUT/'binding-graph.json'),'validation':ref(OUT/'binding-validation.json')})
    v['qualification']='Valid only when read-only post-BF validation passes; tag remains absent and requires user review.'
    return v
def binding_graph(i3):
    return {'kind':'MemoryOSCICDFinalBindingGraph','version':'1.0.0','authority':CHAIN,'I3':{'commit':i3,'parent':S3,'subject':I3_SUBJECT},'BF':{'parent':i3,'subject':BF_SUBJECT,'identity':'CONTAINING_COMMIT','allowedPaths':BF_FILES},'immutableInventory':ref(OUT/'release-inventory.json'),'sealedI3Files':ref(OUT/'i3-files.json'),'closure':{'matrix':ref(OUT/'closure-matrix.json'),'blocked':0,'finalBinding':'RESOLVED_BY_CONTAINING_BF'},'releaseTag':{'name':'memoryos-1.3-mo1306','state':'ABSENT','recommendedTargetRole':'BF'},'futureCommitSelfReference':False}
def binding_validation(i3):
    t=load('tests.json')
    return {'kind':'MemoryOSCICDFinalBindingValidation','version':'1.0.0','status':'PASS','I3':i3,'immutableInventory':ref(OUT/'release-inventory.json'),'negativeControls':t['negativeCount'],'positiveChecks':t['positiveCount'],'conformanceTestCount':t['totalCount'],'checks':['authority graph','actual single-parent I3','sealed committed I3 bytes','C3CB production preservation','exact final package/archive/distribution','full SPDX schema and ownership','final provenance','qualified provider matrix','Generic real execution certificate','GitHub hosted limitation and exhaustion','3B-R2 identity reconciliation and advisories','3C-R dependency reconciliation','Corrections A/CLI/B','M3 methodology and history','S3 scope authority','historical failure preservation','75-row closure with zero BLOCKED','conformance negatives','ten historical worktrees unchanged','tag absent'],'bindingState':'RESOLVED_BY_CONTAINING_BF','postBFValidationRequired':True,'selfReference':False}
