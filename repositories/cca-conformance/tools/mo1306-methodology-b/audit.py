"""Independently recheck copied raw evidence without executing historical tools."""
from common import *
import math
BASIC={'memoryos-ci-artifacts.json','memoryos-ci-complete.json','memoryos-ci-evidence.json','memoryos-ci-result.json'}
def bundle_valid(files,run_id):
    need(set(files)==BASIC,'BUNDLE_EXTRA_OR_MISSING_FILE')
    v={k:json.loads(b) for k,b in files.items()}
    for name,x in v.items():
        need(files[name]==(json.dumps(x,sort_keys=True,separators=(',',':'),ensure_ascii=False)+'\n').encode(),'NONCANONICAL_BUNDLE')
        need(x['runId']==run_id and x['version']=='1.0.0','BUNDLE_RUN_ID')
    r=v['memoryos-ci-result.json'];e=v['memoryos-ci-evidence.json'];m=v['memoryos-ci-artifacts.json'];c=v['memoryos-ci-complete.json']
    need(r['classification']=='INPUT_ERROR' and r['process']['exitCode']==11 and r['semantic'] is None and r['inputDigest'] is None,'FALSE_SEMANTIC_SUCCESS')
    need(r['error']=={'code':'MO1306_INPUT_READ','semanticCode':None,'stage':'ACQUISITION'} and r['provider']=='generic','WRONG_OPERATIONAL_RESULT')
    need(c['manifestSha256']==sha(files['memoryos-ci-artifacts.json']) and e['resultSha256']==sha(files['memoryos-ci-result.json']),'BUNDLE_DIGEST')
    need([x['path'] for x in m['files']]==['memoryos-ci-evidence.json','memoryos-ci-result.json'],'MANIFEST_SET')
    for x in m['files']:need(len(files[x['path']])==x['byteLength'] and sha(files[x['path']])==x['sha256'],'MANIFEST_BYTES')
    need(e['distributionSha256']==DIST and e['runtime']['nodeSha256']==NODE_SHA,'BUNDLE_CANDIDATE')
    return True

class Evidence:
    def __init__(self):
        self.inventory=read(OUT/'preservation.json');self.files={}
        for r in self.inventory['files']:
            need(r['originalPath'] not in self.files,'DUPLICATE_HISTORY')
            self.files[r['originalPath']]=check_ref(r['copy'])
        need(len(self.files)==self.inventory['count']==758,'HISTORY_COUNT')
        expected=set()
        for idx in self.inventory['indexes']:
            b=self.files[idx['path']];need(sha(b)==idx['sha256'],'HISTORY_INDEX_HASH');v=json.loads(b);rows=v.get('files',v.get('artifacts'))
            need(len(rows)==idx['memberCount'],'INDEX_MEMBER_COUNT');expected.add(idx['path'])
            for r in rows:self.bound(r);expected.add(r['path'])
        need(expected==set(self.files),'HISTORY_EXACT_SET')
        need(self.inventory['historicalDispositionChanged'] is False,'RESTAMPED_HISTORY')
    def bound(self,r):
        b=self.files[r['path']];need(len(b)==r['byteLength'] and sha(b)==r['sha256'],'HISTORICAL_BOUND_BYTES');return b
    def load(self,name):return json.loads(self.files[PREFIX+name])
    def value(self,r):return json.loads(self.bound(r))
    def local(self,name):return next(r['copy'] for r in self.inventory['files'] if r['originalPath']==PREFIX+name)
    def witness(self,directory):
        v=self.load(directory+'/summary.json');pre=self.value(v['preflight']);trace=self.value(v['trace']);events=self.value(v['events']);actual=v['actual']
        need(actual==json.loads(self.bound(v['stdout'])) and trace['exitCode']==actual['exitCode']==11 and actual['publication']=='COMPLETE','WITNESS_RAW_SUMMARY')
        need(pre['authority']==BASE and pre['distributionSha256']==DIST and pre['node']['sha256']==NODE_SHA,'WITNESS_CANDIDATE')
        need(pre['freshWorkspaceCreatedExclusive'] and pre['initialOutputAbsent'] and pre['sameWorkspaceLengthAsHistorical'] and pre['maximumPublicationOperandLength']==207,'FAITHFUL_SETUP')
        old=pre['originalArgv'];new=pre['productCommand'];need(len(old)==len(new) and all(a==b for i,(a,b) in enumerate(zip(old,new)) if i not in [5,7]),'FAITHFUL_COMMAND')
        integrity=self.value(v['installedIntegrity']);need(integrity['count']==94 and integrity['members']==pre['installedMembersBefore'],'WITNESS_INTEGRITY')
        for r in integrity['members']:
            b=(ROOT/'repositories/memoryos-ci'/r['path']).read_bytes();need(len(b)==r['byteLength'] and sha(b)==r['sha256'],'INSTALLED_PRODUCTION_IDENTITY')
        need(events['remainingTrackedFileDescriptors']==[] and trace['cleanup']['remainingPids']==[] and trace['cleanup']['elapsedMs']<=2000,'WITNESS_CLEANUP')
        need(events['environment']==pre['environment'] and set(events['environment'])=={'SystemRoot','WINDIR'} and events['execArgvAtExit']==events['originalExecArgv']==['--max-old-space-size=128'],'WITNESS_ENVIRONMENT')
        ev=events['events'];need([e['sequence'] for e in ev]==list(range(1,len(ev)+1)) and all(math.isfinite(e['atMs']) for e in ev) and all(a['atMs']<=b['atMs'] for a,b in zip(ev,ev[1:])),'EVENT_ORDER')
        need(not any(e['event'] in ['timerFireBefore','helperKillBefore'] for e in ev),'TERMINAL_CONTRADICTION')
        for i in range(1,21):
            arms=[e for e in ev if e['event']=='timerArmed' and e['ordinal']==i];closes=[e for e in ev if e['event']=='helperEventBefore' and e['eventName']=='close' and e['ordinal']==i]
            need(len(arms)==len(closes)==1 and closes[0]['args']==[0,None] and closes[0]['atMs']<arms[0]['dueLowerMs'],'ACCEPTED_LATE_HELPER')
        need(events['helperCount']==v['helperCount']==20,'HELPER_COUNT')
        need(not any(e['event']=='fsError' and any(isinstance(x,str) and '.memoryos-ci' in x for x in e['operands']) for e in ev),'PUBLICATION_CONTRADICTION')
        files={Path(r['path']).name:self.bound(r) for r in v['bundleFiles']};bundle_valid(files,actual['runId'])
        need(sha(files['memoryos-ci-result.json'])==actual['resultSha256'],'RESULT_SUMMARY_DIGEST')
        renames=[e for e in ev if e['event']=='fsAfter' and e.get('method')=='renameSync' and e['operands'][-1].endswith('memoryos-ci-artifacts.json')]
        markers=[e for e in ev if e['event']=='fsBefore' and e.get('method')=='writeFileSync' and e['operands'][0].endswith('memoryos-ci-complete.json')]
        need(len(renames)==len(markers)==1 and renames[0]['sequence']<markers[0]['sequence'],'LINEARIZATION_ORDER')
        writes=[e for e in ev if e['event']=='fsBefore' and e.get('method') in ['writeFileSync','renameSync','unlinkSync','rmdirSync']]
        need(writes[-1]==markers[0] and markers[0]['arguments'][-1]=={'flag':'wx'},'MARKER_NOT_LAST')
        return {'id':v['id'],'runId':actual['runId'],'resultSha256':actual['resultSha256'],'summary':self.local(directory+'/summary.json'),'helpers':20,'integrity':'PASS','cleanup':'PASS','bundle':'PASS','manifestBeforeMarker':True}
    def run(self):
        failure=self.load(HIST+'failure-review.json');a=failure['actual']
        need(a['classification']=='ARTIFACT_ERROR' and a['exitCode']==17 and a['publication']=='NONE' and a['resultSha256'] is None,'HISTORICAL_DISPOSITION')
        partial={Path(r['path']).name:self.bound(r) for r in failure['retainedFiles']}
        need(set(partial)=={'memoryos-ci-evidence.json','memoryos-ci-result.json'} and failure['completeMarkerPresent'] is False and failure['pendingEmpty'] is True,'FAIL_CLOSED_STATE')
        try:bundle_valid(partial,a['runId'])
        except AssertionError as e:need(str(e)=='BUNDLE_EXTRA_OR_MISSING_FILE','WRONG_PARTIAL_REJECTION')
        else:raise AssertionError('PARTIAL_ACCEPTED')
        result=json.loads(partial['memoryos-ci-result.json']);need(result['classification']=='INPUT_ERROR' and result['semantic'] is None and result['process']['exitCode']==11,'HISTORICAL_FALSE_SUCCESS')
        native=self.load('phase3a-final/native-summary.json');cases=[self.value(r) for r in native['cases']]
        need(sorted(c['id'] for c in cases if c['status']=='PASS')==GROUPS and [c['id'] for c in cases if c['status']=='FAIL']==['error-input'],'RETAINED_GROUPS')
        need(native['status']=='NATIVE_CERTIFICATION_BLOCKED','HISTORICAL_CERTIFICATION_REWRITE')
        faithful=[self.witness('phase3a-publication-diagnostic/reproductions/'+x) for x in FAITHFUL]
        enhanced=self.witness('phase3a-environment-capture/runs/'+ENHANCED)
        prior=self.load('phase3a-publication-diagnostic/reproduction-summary.json');need(prior['maximumReproductions']==prior['reproductionCount']==3 and prior['resolved'] is False,'BOUNDED_DIAGNOSTICS')
        section=self.load('phase3a-environment-capture/section20-assessment.json');need(section['criteria'][-1]['number']==10 and section['criteria'][-1]['status']=='NOT_ESTABLISHED' and section['classification']=='UNRESOLVED','PROSPECTIVE_PERMISSION_GAP')
        capture=self.load('phase3a-environment-capture/capture-summary.json');need(capture['newRunCount']==1 and capture['historicalCauseEstablished'] is False and capture['nativeCertified'] is False,'NO_RETROACTIVE_CERTIFICATION')
        saved=read(OUT/'historical-validator-checked.json');need(saved['exitCode']==0 and saved['stderr']=='' and saved['productExecutions']==0,'COMPLETE_HISTORICAL_REVIEW')
        checked=json.loads(saved['stdout']);need(checked['historicalFiles']==698 and checked['boundFiles']==914 and checked['negativeControls']==13 and checked['classification']=='UNRESOLVED','COMPLETE_REVIEW_SCOPE')
        publication=(ROOT/'repositories/memoryos-ci/src/publication.mjs').read_text();freeze=(ROOT/'docs/mo1306-contract-freeze-1.md').read_text(encoding='utf-8')
        need("fs.writeFileSync(target,marker,{flag:'wx'}); // Publication linearization point." in publication and publication.index('fs.renameSync(source,target)')<publication.index('fs.writeFileSync(target,marker'),'FROZEN_SOURCE_LINEARIZATION')
        need('sole commit point' in freeze or 'linearization' in freeze or 'commit/completion point' in freeze,'FROZEN_MARKER_AUTHORITY')
        return {'status':'PASS','historicalFilesPreserved':758,'completeHistoricalValidator':checked,'historicalPartialRejected':True,'historicalDisposition':'FAIL / UNRESOLVED','historicalCauseEstablished':False,'frozenLinearization':'completion-marker','faithful':faithful,'enhanced':enhanced,'retainedGroups':GROUPS,'oldMethodologyCriterion10':'NOT_ESTABLISHED','productExecutions':0,'certificationExecuted':False}
