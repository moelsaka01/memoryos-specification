"""Create the S3 scope companion. Historical inventories remain immutable."""
from evidence import *
from policy import *
e=Evidence();review=e.run();save(OUT/'evidence-review.json',review)
bindings={
 'preservation':ref(OUT/'preservation.json'),'review':ref(OUT/'evidence-review.json'),'ownerRequest':ref(OUT/'owner-request.txt'),
 'nativeFinal':e.local('phase3a-certification/native-final-gate.json'),
 'nativeReceipt':e.local('phase3a-certification/native-receipt.json'),
 'finalWitness':e.local('phase3a-certification/witness-validation.json'),
 'methodologySidecar':e.local('phase3a-certification/methodology-sidecar.json'),
 'nativeReuse':e.local('phase3a-certification/reused-evidence.json'),
 'initialHostedReceipt':e.local('phase3a-certification/execution-receipt.json'),
 'bootstrapResolution':e.local('phase3a-hosted-resolution/resolution-receipt.json'),
 'diagnosticReceipt':e.local('phase3a-hosted-diagnostic/execution-receipt.json'),
 'diagnosticCausalReview':e.local('phase3a-hosted-diagnostic/causal-review.json'),
 'diagnosticReport':e.local('phase3a-hosted-diagnostic/REPORT.md'),
 'phase3bReceipt':e.local('phase3b-r2/certification-receipt.json','3B-R2'),
 'phase3bProvenance':e.local('phase3b-r2/provenance.json','3B-R2'),
 'phase3cAudit':e.local('phase3cr/audit-validation.json','3C-R'),
 'phase3cProviders':e.local('phase3cr/provider-audit.json','3C-R'),
 'phase3cSecurity':e.local('phase3cr/security-audit.json','3C-R')}
frozen_paths=['docs/mo1306-contract-freeze-1.md','docs/mo1306-provider-neutral-cicd.md','docs/mo1306-contract-freeze-1-process-correction.md','docs/mo1306-phase3-helper-deadline-correction.md','docs/mo1306-phase3-unresolved-observation-methodology.md','repositories/cca-conformance/mo1306-unresolved-observation-methodology.json','repositories/cca-conformance/mo1306-conformance-inventory.json','repositories/cca-conformance/mo1306-phase2-inventory.json','repositories/cca-conformance/mo1306-phase3-interfaces.json','repositories/cca-conformance/mo1306-phase3-helper-correction-inventory.json','repositories/cca-conformance/mo1306-phase3-helper-correction-binding.json']
prior=blobs([M3+':'+p for p in frozen_paths])
for p in frozen_paths:need((ROOT/p).read_bytes()==prior[M3+':'+p],'HISTORICAL_AUTHORITY_CHANGED')
v={'kind':'MemoryOSHostedCertificationScopeCorrection','version':'1.0.0','milestone':'MO-1306','releaseScope':'v1','commitRole':'S3','expectedParent':M3,'productionAuthority':C3CB,'methodologyAuthority':M3,'auditAuthorities':{'phase3bR2':B3,'phase3cR':C3},'policy':policy(),'pre3D':pre3d(),'supersession':{'originalRequirement':'Required safely feasible hosted attempt and actual hosted certification evidence, or explicit owner disposition of the named limitation before closure.','correctedRequirement':'GitHub hosted execution OPTIONAL_NON_BLOCKING_V1; implementation/offline validation and Generic native execution remain mandatory.','scope':'Mandatory release-gate status only, including inherited Phase3A/3D and CF-GITHUB-HOSTED completion requirements. Successful hosted claims still require actual evidence.','originalFreezeUnchanged':True,'historicalInventoriesUnchanged':True,'historicalOutcomesRewritten':False,'futureConformanceMustConsumeScopeCompanion':True},'bindings':bindings,'frozenAuthorities':[ref(ROOT/p) for p in frozen_paths],'documents':[ref(DOC),ref(ROOT/'ROADMAP.md')],'archive':{'byteLength':197290,'sha256':ARCHIVE,'distributionSha256':DIST,'changed':False},'actionPins':PINS,'advisoryDisposition':{'undici':'NOT_REACHABLE_IN_FROZEN_USAGE','fastXmlParser':'REACHABLE_NOT_ATTACKER_CONTROLLED','actionUpdateRequired':False,'newResearchPerformed':False,'newSupplyChainCertification':False,'oldArtifactRequiresRebinding':True},'remoteEvidence':{'observation':'RETAINED_FINAL_READBACK_ONLY','observedUtc':'2026-09-28T08:17:26.403246+00:00','defaultBranch':'main','main':REMOTE_MAIN,'certificationBranch':'mo1306-certification','certificationScaffold':SCAFFOLD,'scaffoldIsProductAuthority':False,'deletionRequiredForRelease':False,'newNetworkCalls':0},'taskActions':{'productionChanges':0,'nativeExecutions':0,'hostedExecutions':0,'methodologyReruns':0,'securityAuditReruns':0,'supplyChainRecertifications':0,'pushes':0,'tags':0,'providerAccountUse':0},'futureCommitSelfReference':False}
validate_policy(v['policy']);validate_pre3d(v['pre3D']);save(AUTH,v)
print(json.dumps({'authority':str(AUTH),'status':v['pre3D']['status'],'providerCount':len(v['policy']['providers'])}))
