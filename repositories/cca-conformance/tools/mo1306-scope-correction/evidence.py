"""Validate preserved raw run/artifact/native/audit evidence; never run a campaign."""
from common import *
import io,zipfile
class Evidence:
    def __init__(self):
        self.preservation=read(OUT/'preservation.json');self.rows={};self.data={}
        for r in self.preservation['files']:
            key=(r['owner'],r['originalPath']);need(key not in self.rows,'DUPLICATE_SOURCE');self.rows[key]=r;self.data[key]=check(r['file'])
        need(len(self.rows)==self.preservation['count']==1646,'PRESERVATION_COUNT')
        expected=set()
        for idx in self.preservation['indexes']:
            b=self.raw(idx['path']);need(sha(b)==idx['sha256'],'ORIGINAL_INDEX');v=json.loads(b);files=v.get('files',v.get('artifacts'));need(len(files)==idx['members'],'INDEX_COUNT');expected.add(idx['path'])
            for r in files:self.bound(r);expected.add(r['path'])
        need(expected=={p for owner,p in self.rows if owner=='3A'},'HISTORICAL_CLOSED_SET')
        committed={r['revision']+':'+r['originalPath']:self.data[key] for key,r in self.rows.items() if r['revision']}
        actual=blobs(list(committed));need(actual==committed,'COMMITTED_AUDIT_CHANGED')
    def raw(self,path,owner='3A'):return self.data[(owner,path)]
    def load(self,name,owner='3A'):return json.loads(self.raw(PREFIX+name,owner))
    def local(self,name,owner='3A'):return self.rows[(owner,PREFIX+name)]['file']
    def bound(self,r,owner='3A'):
        b=self.raw(r['path'],owner);need(len(b)==r['byteLength'] and sha(b)==r['sha256'],'BOUND_HISTORICAL_BYTES');return b
    def run(self):
        d=self.load('phase3a-hosted-diagnostic/execution-receipt.json');resolution=self.load('phase3a-hosted-resolution/resolution-receipt.json')
        need(d['candidate']==C3CB and d['methodology']==M3 and d['diagnosticRunId']==36396330199 and d['historicalRunId']==36357568243,'HOSTED_IDENTITIES')
        need(d['classification']=='STILL_UNRESOLVED' and d['status']=='HOSTED_DIAGNOSTIC_EXHAUSTED' and d['ending']=='MO-1306 PHASE 3A HOSTED DIAGNOSTIC EXHAUSTED','HOSTED_RESTAMP')
        need(d['historicalDisposition']==resolution['status']=='HOSTED_BOOTSTRAP_UNRESOLVED' and resolution['failedHostedRun']==36357568243 and resolution['causeEstablished'] is False,'BOOTSTRAP_RESTAMP')
        need(d['actualFirstProductionRejectingSite'] is None and d['oracleFailureDoesNotProveProductionCause'] is True and d['oldRunReclassified'] is False,'UNSUPPORTED_CAUSAL_CLAIM')
        need(d['certificationDispatches']==[] and d['nativeHostedParity'] is None and d['certificationCommit'] is None and d['phase3DReady'] is False,'HISTORICAL_CERTIFICATION_PROMOTION')
        report=self.raw(PREFIX+'phase3a-hosted-diagnostic/REPORT.md').decode('utf-8-sig')
        for f in d['finalReportAreas']:
            rendered=f['value'].replace('\\','\\\\')
            need(f"{f['number']}. **{f['title']}**: {rendered}" in report,'REPORT_RECEIPT_MISMATCH')
        for r in d['bindings']:self.bound(r)
        base='phase3a-hosted-diagnostic/github/campaign-20260928T081542Z/runs/36396330199/'
        run=self.load(base+'run.json');jobs=self.load(base+'jobs.json');arts=self.load(base+'artifacts.json');summary=self.load(base+'diagnostic/diagnostic-summary.json')
        need(run['id']==36396330199 and run['head_sha']==SCAFFOLD and run['conclusion']=='failure' and run['run_attempt']==1,'DIAGNOSTIC_ACTUAL_RUN')
        need(jobs['total_count']==1 and jobs['jobs'][0]['conclusion']=='failure' and 'windows-2022' in jobs['jobs'][0]['labels'],'DIAGNOSTIC_JOB')
        need(summary['bootstrapOutcome']=='failure' and summary['certification'] is False,'BOOTSTRAP_MASKED_BY_OBSERVER')
        need(arts['total_count']==1 and arts['artifacts'][0]['id']==10957954743,'DIAGNOSTIC_ARTIFACT')
        zipbytes=self.raw(PREFIX+base+'artifact-10957954743.zip');need(sha(zipbytes)==arts['artifacts'][0]['digest'],'DOWNLOADED_ARTIFACT_DIGEST')
        with zipfile.ZipFile(io.BytesIO(zipbytes)) as z:
            need(set(z.namelist())=={'diagnostic-summary.json','observation-before.json','observation-after.json','oracle.json'},'DIAGNOSTIC_ONLY_ARTIFACT_SET')
            for name in z.namelist():need(z.read(name)==self.raw(PREFIX+base+'diagnostic/'+name),'EXTRACTED_BYTES')
        oracle=self.load(base+'diagnostic/oracle.json');need(oracle['outcome']=='FAIL' and oracle['firstFailure']['site']=='checkPaths.helperDeadline' and oracle['productionVerdictOverridden'] is False,'ORACLE_SCOPE')
        q=oracle['requests'][0];need(q['terminal']['atMs']>=q['effectiveDeadlineMs'] and q['close']['atMs']>=q['terminal']['atMs'] and q['killResult'] is True,'ORACLE_TIMING')
        raw=self.load('phase3a-hosted-diagnostic/github/initial-remote/blocked-run.json')['body'];rawarts=self.load('phase3a-hosted-diagnostic/github/initial-remote/blocked-artifacts.json')['body']
        need(raw['id']==36357568243 and raw['conclusion']=='failure' and raw['run_attempt']==1 and rawarts['total_count']==0,'INITIAL_HOSTED_FAILURE')
        final=self.load('phase3a-hosted-diagnostic/github/final-remote-state.json');need(final['defaultBranch']=='main' and final['remoteMain']==REMOTE_MAIN and final['certificationCommit']==SCAFFOLD,'RETAINED_REMOTE_STATE')
        need(d['remoteRestoration']['status']=='PASS' and d['remoteRestoration']['settingsUnchanged'] is True,'RESTORATION_HISTORY')
        native=self.load('phase3a-certification/native-final-gate.json');nv=self.load('phase3a-certification/native-validation.json');w=self.load('phase3a-certification/witness-validation.json');side=self.load('phase3a-certification/methodology-sidecar.json');reuse=self.load('phase3a-certification/reused-evidence.json')
        need(native['status']=='PASS' and native['nativeCertified'] is True and native['genericLabel']=='REAL_EXECUTION_CERTIFIED' and native['finalWitnessExecutions']==1,'GENERIC_CERTIFICATION')
        need(nv['status']=='PASS' and nv['nativeCertified'] is True and nv['productionAuthority']==C3CB and nv['methodologyAuthority']==M3,'NATIVE_AUTHORITY')
        for r in native['independentValidations']:self.bound(r)
        need(w['acceptedFinalWitness'] is True and w['executionCount']==1 and w['additionalExecutionsAllowed']==0 and w['actual']['exitCode']==11 and w['actual']['publication']=='COMPLETE','FINAL_NATIVE_WITNESS')
        need(side['methodologyRevision']==M3 and len(side['attempts'])==1 and side['attempts'][0]['result']=='PASS' and side['attempts'][0]['recurrence'] is False and side['previousFailureRecorded'] is False,'NATIVE_LEDGER')
        need(side['disclosure']['history']['disposition']=='FAIL / UNRESOLVED' and native['historicalCauseResolved'] is False,'NATIVE_HISTORY_RESTAMP')
        need(reuse['status']=='PASS' and reuse['retainedGroupCount']==8 and reuse['rerunCount']==0 and reuse['productionAuthority']==C3CB and reuse['distributionDigest']==DIST,'NATIVE_REUSE')
        files={Path(r['path']).name:self.bound(r) for r in w['bundleFiles']};need(set(files)=={'memoryos-ci-result.json','memoryos-ci-evidence.json','memoryos-ci-artifacts.json','memoryos-ci-complete.json'},'NATIVE_BUNDLE_SET')
        bundle={k:json.loads(v) for k,v in files.items()};need(bundle['memoryos-ci-complete.json']['manifestSha256']==sha(files['memoryos-ci-artifacts.json']),'NATIVE_MARKER_DIGEST')
        for r in bundle['memoryos-ci-artifacts.json']['files']:need(sha(files[r['path']])==r['sha256'] and len(files[r['path']])==r['byteLength'],'NATIVE_BUNDLE_BYTES')
        need(bundle['memoryos-ci-evidence.json']['resultSha256']==sha(files['memoryos-ci-result.json'])==w['actual']['resultSha256'],'NATIVE_RESULT_DIGEST')
        b=self.load('phase3b-r2/certification-receipt.json','3B-R2');c=self.load('phase3cr/audit-validation.json','3C-R');provider=self.load('phase3cr/provider-audit.json','3C-R')
        need(b['releaseReady'] is True and b['actionUpdateRequired'] is False and b['riskAcceptanceGranted'] is False and b['actionPins']==PINS,'3BR2_SCOPE')
        need([x['disposition'] for x in b['findings']]==['NOT_REACHABLE_IN_FROZEN_USAGE','REACHABLE_NOT_ATTACKER_CONTROLLED'],'ADVISORY_REWRITE')
        need(b['candidate']['C3AB']==C3AB and b['archive']['sha256']!=ARCHIVE,'3BR2_OLD_ARTIFACT_REBIND_REQUIRED')
        need(c['status']=='PASS' and c['matrixCounts']=={'BLOCKED':0,'PENDING_3A_REFRESH':5,'PENDING_3B_REFRESH':3,'PENDING_3D':4,'SATISFIED':48} and provider['status']=='PASS','3CR_RESTAMP')
        need(provider['githubNegativeCount']==50 and provider['githubAstNegativeCount']==3,'GITHUB_OFFLINE_EVIDENCE')
        delta=git('diff','--name-only',C3AB,C3CB,'--','repositories/memoryos-ci').decode().splitlines();need(delta==['repositories/memoryos-ci/distribution-manifest.json','repositories/memoryos-ci/src/filesystem.mjs'],'CORRECTION_SCOPE')
        prior=read(OUT/'hosted-historical-validation.json');need(prior['exitCode']==0 and not prior['stderr'],'HISTORICAL_VALIDATION')
        checked=json.loads(prior['stdout']);need(checked['status']=='PASS' and checked['boundFiles']==1216 and checked['negativeControls']==12 and checked['productExecutions']==checked['networkCalls']==0,'FULL_HOSTED_REVIEW')
        return {'status':'PASS','preservedFiles':len(self.rows),'originalIndexes':8,'completeHostedValidation':checked,'historicalHostedRun':{'id':36357568243,'conclusion':'failure','disposition':'HOSTED_BOOTSTRAP_UNRESOLVED'},'diagnosticRun':{'id':36396330199,'conclusion':'failure','classification':'STILL_UNRESOLVED','status':'HOSTED_DIAGNOSTIC_EXHAUSTED'},'generic':'REAL_EXECUTION_CERTIFIED','finalNativeWitness':{'attemptId':w['attemptId'],'runId':w['actual']['runId'],'executions':1,'retainedGroups':8},'githubOffline':{'status':'VALIDATED','negativeFiles':50,'astNegatives':3,'sourceRevision':C3},'advisories':[x['disposition'] for x in b['findings']],'actionUpdateRequired':False,'phase3bArtifactRebindRequired':True,'phase3cDependencyReconciliationRequired':True,'productionDeltaSinceC3AB':delta,'remoteStateEvidenceOnly':{'defaultBranch':'main','main':REMOTE_MAIN,'certification':SCAFFOLD},'productExecutions':0,'networkCalls':0,'supplyChainRecertification':False,'securityAuditRerun':False}
