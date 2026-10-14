"""Closed dependency/delta matrices, with historical outcomes never promoted."""
from collections import Counter
from support import *
CLASSES=('BYTE_IDENTICAL_REUSABLE','IDENTITY_REBIND_REQUIRED','INVALIDATED','NOT_APPLICABLE')
DELTA={'repositories/memoryos-ci/distribution-manifest.json','repositories/memoryos-ci/src/filesystem.mjs'}
CB=E/'phase3-helper-correction'
def counts(rows,key='classification'):return {k:sum(r[key]==k for r in rows) for k in CLASSES}
def correction_bindings():
    names=['cheap-gate.json','boundary-corrected.json','source-focused.json','installed-focused.json','installed-regression.json','semantic-native.json','provider-preservation.json','deadline-audit.json','package.json','final-gates.json','recertification-impact.json']
    refs=[ref(CB/n) for n in names]
    for r in refs:check(r)
    for n in ['source-focused.json','installed-focused.json','installed-regression.json','semantic-native.json','provider-preservation.json','final-gates.json']:need(read(CB/n)['status']=='PASS','CORRECTION_NOT_PASS '+n)
    need(read(CB/'source-focused.json')['count']==10 and read(CB/'installed-focused.json')['count']==7,'CORRECTION_CASE_COUNTS')
    need(read(CB/'semantic-native.json')['count']==9 and read(CB/'semantic-native.json')['normativeBytesEqualIndependentSourceSDK'],'CORRECTION_SEMANTICS')
    need(read(CB/'provider-preservation.json')['workflowSemanticsUnchanged'],'CORRECTION_PROVIDER_CHANGE')
    return refs
def dependencies(e):
    supply=obj(e,'phase3b-r2/supply-identities.json','3B-R2')
    provider=obj(e,'phase3cr/provider-results/byte-dependencies.json','3C-R')
    package=git('ls-tree','-r','--name-only',C3AB,'--','repositories/memoryos-ci').decode().splitlines()
    scopes={'package':package,'3B-R2':[r['path'] for r in supply['trackedDependencies']],'3C-R':[r['path'] for r in provider['identities']]}
    paths=sorted(set(sum(scopes.values(),[])))
    basepaths=set(git('ls-tree','-r','--name-only',C3AB).decode().splitlines())
    ordinary=[p for p in paths if p in basepaths];audit=[p for p in paths if p not in basepaths]
    raw=blobs([rev+':'+p for rev in (C3AB,C3CB) for p in ordinary]+[C3+':'+p for p in audit])
    rows=[]
    for p in paths:
        origin=C3AB if p in basepaths else C3;target=C3CB if p in basepaths else C3
        old=raw[origin+':'+p];new=raw[target+':'+p]
        current=(ROOT/p).read_bytes() if p in basepaths else check(source(e,p,'3C-R'))
        need(current==new,'CURRENT_DEPENDENCY_CHANGED '+p)
        changed=old!=new;need(not changed or p in DELTA,'STOP_UNJUSTIFIED_DEPENDENCY_DELTA '+p)
        rows.append({'path':p,'sourceCommit':origin,'targetCommit':target,'before':identity(old),'after':identity(new),'scopes':[k for k,v in scopes.items() if p in v],'classification':'IDENTITY_REBIND_REQUIRED' if changed else 'BYTE_IDENTICAL_REUSABLE','retainedAuditTool':p not in basepaths})
    need({r['path'] for r in rows if r['classification']=='IDENTITY_REBIND_REQUIRED'}==DELTA,'EXACT_CORRECTION_DELTA')
    for refs in (supply['trackedDependencies'],provider['identities']):
        for r in refs:need(identity(raw[(C3AB if r['path'] in basepaths else C3)+':'+r['path']])=={k:r[k] for k in ('byteLength','sha256')},'OLD_DEPENDENCY_NOT_BOUND')
    return {'status':'PASS','source':C3AB,'target':C3CB,'rows':rows,'counts':counts(rows),'changedFiles':sorted(DELTA),'correctionEvidence':correction_bindings(),'scope':'Every package member and every enumerated 3B supply / 3C provider dependency is compared to immutable Git blobs and the current source. Changed behavior is covered by retained Correction B and final native evidence.'}
def phase3b(e,dep):
    specs=[('receipt','phase3b-r2/certification-receipt.json'),('provenance','phase3b-r2/provenance.json'),('supply','phase3b-r2/supply-identities.json')]
    rebind={'receipt':{'SBOM','archive','artifactCertification','candidate','provenance','remainingExternalDependencies','testResults','releaseReady'},'provenance':{'SBOM','archive','candidate','distribution','inputs'},'supply':{'correctedAuthority','implementationProvenance','trackedDependencies','sourceIndependence','negativeReuse'}}
    meta={'kind','version','scope','reviewIdentity'}
    rows=[]
    for group,suffix in specs:
        v=obj(e,suffix,'3B-R2')
        for key,value in sorted(v.items()):
            state='NOT_APPLICABLE' if key in meta else 'IDENTITY_REBIND_REQUIRED' if key in rebind[group] else 'BYTE_IDENTICAL_REUSABLE'
            proof=[source(e,suffix,'3B-R2'),ref(OUT/'dependency-delta.json')]
            if state=='IDENTITY_REBIND_REQUIRED':proof += [ref(OUT/'package.json'),ref(OUT/'sbom-validation.json'),ref(CB/'installed-regression.json'),source(e,'phase3a-certification/native-receipt.json')]
            rows.append({'id':group+'.'+key,'classification':state,'sourceAssertionSha256':sha(enc(value)),'sourceField':key,'sourceEvidence':source(e,suffix,'3B-R2'),'proof':proof,'disposition':'Historical values remain unchanged. Final artifact identities and affected installed execution are bound by the replacement evidence; historical tests are not represented as new runs.' if state=='IDENTITY_REBIND_REQUIRED' else 'Metadata retained as historical context.' if state=='NOT_APPLICABLE' else 'Exact source assertion and unchanged source/supply inputs retained; no new advisory or execution claim.'})
    need(not any(r['classification']=='INVALIDATED' for r in rows),'STOP_3B_INVALIDATED')
    return {'kind':'MemoryOSCICDPhase3BDependencyReconciliation','status':'PASS','authority':B3,'sourceBaseline':C3AB,'target':C3CB,'rows':rows,'counts':counts(rows),'assertionCoverage':'Every top-level field of the canonical receipt, closed provenance and supply identity proof; composite field values are bound in full.','fileDependencyCounts':counts([r for r in dep['rows'] if '3B-R2' in r['scopes']]),'advisories':read(SCOPE)['advisoryDisposition'],'actionPins':PINS,'newAdvisoryResearch':False,'newSupplyChainCampaign':False}
STATIC_3C={'cli-command-correction','cli-prototype-mutation','repository-dispatch','provider-dispatch','projection-selectors','sdk-authority','serialization-versioning','configuration','normalized-invocation','metadata-classification','network-boundary','process-argv','gitlab-schema-subset','jenkins-parser-grammar','azure-schema-references','provider-launchers','github-workflow','github-transport','mo1302-preservation','injection-corpus','historical-failures','original-partial-reuse','scoped-exclusions'}
HOSTED={'github-hosted-campaign','github-hosted-evidence','release-hosted-disposition'}
def phase3c(e,dep):
    old=obj(e,'phase3cr/release-closure.json','3C-R');need(len(old['rows'])==60,'ORIGINAL_CLOSURE_COUNT')
    need(STATIC_3C|HOSTED <= {r['id'] for r in old['rows']},'UNKNOWN_RECONCILIATION_ROW')
    rows=[]
    for r in old['rows']:
        state='NOT_APPLICABLE' if r['id'] in HOSTED else 'BYTE_IDENTICAL_REUSABLE' if r['id'] in STATIC_3C else 'IDENTITY_REBIND_REQUIRED'
        originals=[]
        for ev in r['evidence']:
            local=source(e,ev['path'],'3C-R');need(identity(check(local))=={k:ev[k] for k in ('byteLength','sha256')},'AUDIT_EVIDENCE_IDENTITY');originals.append(local)
        proof=[ref(OUT/'dependency-delta.json')]
        if state=='IDENTITY_REBIND_REQUIRED':proof+=correction_bindings()+[source(e,'phase3a-certification/native-receipt.json'),ref(OUT/'package.json'),ref(OUT/'sbom-validation.json')]
        if state=='NOT_APPLICABLE':proof+=[ref(SCOPE),source(e,'phase3a-hosted-diagnostic/execution-receipt.json')]
        rows.append({'id':r['id'],'classification':state,'historicalStatus':r['status'],'sourceAssertionSha256':sha(enc(r)),'originalEvidence':originals,'proof':proof,'dependencyScope':'Unchanged static/provider semantic assertion scope only; recorded product execution is historical.' if state=='BYTE_IDENTICAL_REUSABLE' else 'S3 explicitly removes mandatory hosted certification; failure remains unresolved.' if state=='NOT_APPLICABLE' else 'Conservative affected/candidate binding: all 94 product dependencies compared, only helper/distribution changed; Correction B and final native receipt supply affected coverage. Final metadata uses current package/SBOM/provenance.'})
    return {'kind':'MemoryOSCICDPhase3CDependencyReconciliation','status':'PASS','authority':C3,'sourceBaseline':C3AB,'target':C3CB,'sourceMatrix':source(e,'phase3cr/release-closure.json','3C-R'),'rows':rows,'counts':counts(rows),'fileDependencyCounts':counts([r for r in dep['rows'] if '3C-R' in r['scopes']]),'newSecurityCampaign':False,'newProviderValidation':False}
def build():
    e=Evidence();dep=dependencies(e);put('dependency-delta.json',dep)
    b=phase3b(e,dep);put('3b-dependency-matrix.json',b)
    c=phase3c(e,dep);put('3c-dependency-matrix.json',c)
    print(json.dumps({'dependency':dep['counts'],'3B':b['counts'],'3C':c['counts']}))
if __name__=='__main__':build()
