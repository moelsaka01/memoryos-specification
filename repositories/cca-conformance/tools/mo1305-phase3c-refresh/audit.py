"""Independent 3C-R evidence audit, closure matrix and receipt validators.

No service is launched. Historical evidence remains historical; current metadata
and immutable runtime bindings justify explicit reuse. Run create, then validate.
"""
from pathlib import Path
import argparse,copy,hashlib,json,re
from context import *
from distribution import parse
D='repositories/cca-conformance/evidence/'
T='repositories/cca-conformance/tools/mo1305-phase3c-refresh/'
F=D+'mo1305-phase3c-refresh/'
P=PKG_REL+'/'
FREEZE='docs/mo1305-contract-freeze-1.md'
PLATFORM='docs/mo1305-contract-freeze-1-platform-correction.md'
METHOD='docs/mo1305-contract-freeze-1-verification-methodology-correction.md'
REUSE='C3/C3B changes only six shipped metadata/verifier members; 52 package members, including 42 executable/runtime members and all 25 closure files, remain byte-identical to B2. API semantics/schemas and FINAL limits remain unchanged.'
LIMITATIONS=[
 'Remote evidence uses separate processes on the same physical Windows host and assigned RFC1918 IPv4; no off-host LAN, public/wildcard, cloud-hosting or other-platform certification.',
 'Preloads and custom loaders may execute before entrypoint refusal. Environment evidence establishes refusal under the trusted-launcher model, not pre-entry isolation or hostile administrator confinement.',
 'Network sentinels are calibrated bounded loopback observations, not packet-capture/firewall proof. Inline URI/path-like artifact bytes remain opaque; request fields convey no filesystem, fetch, proxy or command authority.',
 'Authentication review verifies the fixed 32-byte timingSafeEqual mechanism, not statistical constant latency.',
 'Memory measurements plus headroom do not establish instantaneous OS containment; write-slot boundaries use the production Slots primitive and retained controlled-backpressure evidence.',
 'Controlled INTERNAL_FAILURE, OPERATION_TIMEOUT, OUTPUT_LIMIT and UNAVAILABLE paths retain their provenance; fault-injected cleanup is not described as a naturally occurring client fault. Native Windows SIGINT is not native graceful SIGTERM evidence.',
 'Historical B2 archive and original 3A PASS are not certifications of the corrected archive. C3 one-install/eight-request smoke supports metadata interaction but does not replace 3A-R or 3B-R.',
 'Original 3C blocker files were uncommitted in its separate worktree; their preserved inventory/report is audited here, not a fresh read of that worktree.'
]
EXTERNAL={
 '3A-R':{'state':'PENDING_EXTERNAL_REFRESH','commit':None,'receipt':None,'requirements':[
  'Existing committed PASS Windows receipt and validator outputs bind C3/C3B and corrected archive 191823 bytes / faac95f7ad8939bcf7bbc33952efabebc1468d0c5654ea3eaac03f40402a7382.',
  'Actual Windows 11 edition, release, full build and x64; actual pinned Node 24.21.0, npm 11.19.0 and client versions/executable hashes.',
  'Genuine isolated offline installation with initially empty cache, scripts/audit/fund disabled; exact installed inventory and post-execution integrity.',
  'Node fetch and curl in local and actual assigned RFC1918 modes, raw TLS/security boundaries, independent SDK exact normative bytes/digests/stable errors across all semantic capabilities and decisions.',
  'FINAL limits, deadline, lifecycle and cleanup; bounded fresh witnesses and explicit source-bound unchanged-evidence reuse; harness/catalog/source identities, regressions, validators, no private credentials.',
  'Original B2 Windows PASS and all failed refresh attempts remain historical; Ubuntu/Linux/VM/cross-platform parity NOT_REQUIRED.'
 ]},
 '3B-R':{'state':'PENDING_EXTERNAL_REFRESH','commit':None,'receipt':None,'requirements':[
  'Existing committed PASS package, installation and supply-chain receipts plus validator outputs bind C3/C3B and exact corrected archive/OpenAPI/SBOM/FINAL limits.',
  'memoryos-rest 0.1.0; exact 58-member allowlist with roles/hashes, 25 authoritative closure files and zero external production npm dependencies.',
  'Two independent clean-root builds in separate builder processes produce identical archive bytes/inventories with complete source provenance.',
  'Isolated initially-empty-cache offline install with scripts/audit/fund disabled; source independence, installed integrity, bounded smoke and cleanup.',
  'Archive adversarial coverage and trusted-anchor substitution/tamper negatives; lock/npm graph, runtime pins, notices/licenses, full zero-error pinned Draft-7 SPDX plus semantic and OpenAPI/distribution validation.',
  'Fresh bounded dated primary-source advisory snapshots with enabled-path applicability and dispositions; no unresolved affected advisory.',
  'Original STOPPED release-artifact report and all failed refresh attempts preserved.'
 ]}}
PHASE3D=[
 'Integrate actual 3A-R PASS, 3B-R PASS and this 3C-R PASS commit; validate their parents, scopes, byte identities, receipts and corrected C3/C3B candidate. Pending external rows cannot be converted to PASS without those commits.',
 'Preserve original 3A B2 PASS/REFRESH_REQUIRED, original 3B STOPPED_RELEASE_ARTIFACT_DEFECT, original 3C STOPPED_RELEASE_BLOCKER and earlier correction failures.',
 'Create the authorized final evidence integration I3 only after all requirements pass; verify final archive identity, graph, clean main, workspace and negative/receipt/inventory gates.',
 'Create pure final binding BF referring to existing I3 evidence revision and I3 inventory bytes, never BF inventory/self/future hashes. Binding must not change production/package/limits/archive/prior receipts.',
 'Require zero blockers, final receipt binding and READY_TO_TAG. A later separately authorized annotated memoryos-1.3-mo1305 tag targets BF; this branch leaves it absent.'
]
# requirement id | requirement | status | authority selector | evidence selectors
SPECS='''baseline|Dedicated clean starting branch and exact C3B parent|PASS_CURRENT|freeze|baseline
cheap|All cheap complete gates precede security witness decision|PASS_CURRENT|freeze|cheap-gates,schema-validation,metadata-tests,correction-conformance
remote-defect|No stale PHASE_2_PENDING; negative rejects recurrence|PASS_CURRENT|api|metadata-tests,cheap-gates
analysis-defect|No filesAnalyzed=false with contained/analyzed files|PASS_CURRENT|spdx|metadata-tests,schema-validation
comment-defect|Root comment replaces documentComment; negative regression|PASS_CURRENT|spdx|metadata-tests,schema-validation
license-defect|All file licenseInfoInFiles fields valid; singular negative rejected|PASS_CURRENT|spdx|metadata-tests,schema-validation
archive|Corrected archive exact identity and all 58 members|PASS_CURRENT|freeze|correction-conformance
openapi-identity|Corrected OpenAPI exact 114491-byte identity|PASS_CURRENT|api|cheap-gates
sbom-identity|Corrected SBOM exact 44094-byte identity|PASS_CURRENT|spdx|schema-validation
spdx|Full pinned Draft-7 and semantics: 25 packages, 56 files, 81 relationships, codes/checksums/licenses/external treatment|PASS_CURRENT|spdx|schema-validation,generated-fields,metadata-tests
release-graph|B2 to C3 to C3B subjects, parents, scope and binding|PASS_CURRENT|freeze|correction-conformance
historical|Preserve original 3A PASS and 3B/3C STOPPED histories honestly|PASS_CURRENT|freeze|historical
routes|Nine routes, six semantic capabilities, API and package versions frozen|PASS_CURRENT|api|contract-tests.log,runtime-preservation
http-tls|HTTP/1.1 and TLS1.3; plaintext and invalid TLS refused|PASS_REUSED|api|transport
bearer|Bearer authentication and unauthenticated precedence|PASS_REUSED|api|transport
authorization|Closed authorization boundary; no unsupported authority|PASS_REUSED|api|authorization,capabilities
strict-json|Strict JSON/schema and content negotiation|PASS_REUSED|api|transport,dispatch
normative|Exact normative bytes/digests and policy identities|PASS_REUSED|api|interop,runtime-preservation
limits-identity|FINAL limits exact bytes and digest|PASS_CURRENT|limits|runtime-preservation
operation-deadline|31400 ms final deadline below 60000 ms absolute ceiling|PASS_REUSED|method|resource,boundary,resources
platform|Windows11 x64 required; Ubuntu/Linux/VM/cross-platform parity NOT_REQUIRED|PASS_CURRENT|platform|support-policy
remote-openapi|Implemented explicit opt-in assigned RFC1918, local default; no broader deployment claim|PASS_CURRENT|api|cheap-gates,remote
framing-host|Framing, Host, missing Host and proxy headers|PASS_REUSED|api|transport
filesystem-ssrf|No filesystem authority, URL fetch, generic proxy or command execution|PASS_REUSED|freeze|filesystem,uri-ssrf,network-authority,authorization,capabilities
environment|NODE_OPTIONS/NODE_PATH/preload/loader/debug and runtime/closure substitution refusal|PASS_REUSED|freeze|environment-runtime,capabilities,startup
logging|No bearer/Authorization/body/stack leakage; CRLF and structured logging safety|PASS_REUSED|freeze|transport
semantic-authority|REST transport only; SDK oracle; no MCP/CLI/shell delegation or duplicate semantic/canonical authority|PASS_REUSED|freeze|interop,runtime-preservation
resources|Memory budgets, admission, connections and rates; no recharacterization|PASS_REUSED|limits|resource,boundary,stress,resources
lifecycle|Startup/readiness/draining/shutdown/worker/socket cleanup/rebind|PASS_REUSED|freeze|lifecycle,remote
package-policy|Complete distribution/install/supply-chain policy; fresh certification assigned to 3B-R|PASS_CURRENT|freeze|correction-conformance,metadata-tests,accepted-installed,accepted-reproducibility
witnesses|Bounded metadata witnesses and justified unchanged-security reuse|PASS_CURRENT|freeze|cheap-gates,runtime-preservation,accepted-installed
windows-refresh|Require future corrected-archive Windows PASS commit|PENDING_3A_REFRESH|platform|external-prerequisites
artifact-refresh|Require future corrected-archive artifact PASS commit|PENDING_3B_REFRESH|freeze|external-prerequisites
final-receipts|Integrate refreshed receipt identities and graph at I3|PHASE3D_BIND|freeze|external-prerequisites
final-binding|BF binds existing I3 and I3 inventory bytes; no self/future identity|PHASE3D_BIND|freeze|external-prerequisites
release-tag|Clean main, all refresh PASS, zero blockers, final binding and READY_TO_TAG before later tag|PHASE3D_BIND|freeze|external-prerequisites'''

def current(name):
    return parse((ROOT/F/name).read_bytes())

def write(name,value):
    (ROOT/F/name).write_bytes(j(value))

def selectors():
    result={n:F+(n if n.endswith('.log') else n+'.json') for n in ['baseline','cheap-gates','schema-validation','generated-fields','metadata-tests','correction-conformance','runtime-preservation','historical','external-prerequisites','contract-tests.log']}
    for m in ['transport','dispatch','interop','startup','resources','lifecycle']:
        result[m]=read(D+'mo1305-phase2d/modules/'+m+'.json')['accepted']['path']
    for m in ['authorization','filesystem','uri-ssrf','network-authority','environment-runtime']:
        result[m]=D+'mo1305-phase2c/categories/'+m+'.json'
    result['capabilities']=read(D+'mo1305-phase2c/capabilities.json')['accepted']['path']
    result.update({m:D+'mo1305-phase1/'+m+'.json' for m in ['resource','boundary','stress']})
    result.update({'remote':D+'mo1305-phase2a/remote.json','accepted-installed':E+'installed.json','accepted-reproducibility':E+'reproducibility.json','support-policy':'repositories/cca-conformance/tools/mo1305-platforms/support-policy.json'})
    return result

def historical():
    original='9bb679532b90016b9cc30bf5e1cdb41d376e2ff7'
    path=D+'mo1305-phase3a/windows-receipt.json'
    data=git('show',original+':'+path)
    assert identity(data)=={'byteLength':9846,'sha256':'638d79cbb37fccc2f770f44198e64c99611c4441f88f0462dab8b5826937dc8f'}
    assert json.loads(data)['state']=='PASS'
    assert git('show','-s','--format=%P',original).decode().strip()==BASELINE
    assert not git('diff','--name-only',BASELINE,C3B,'--',D+'mo1305-phase1',D+'mo1305-phase2a',D+'mo1305-phase2b',D+'mo1305-phase2c',D+'mo1305-phase2d').strip()
    return {'state':'PASS','original3A':{'state':'PASS','currentState':'REFRESH_REQUIRED','commit':original,'parent':BASELINE,'gitObject':original+':'+path,**identity(data),'archiveSha256':'af99ba13fa96c5b5ded130a871c671243fb3fadd07f74eefa9b6ae2e601d182a'},'original3B':{'state':'STOPPED_RELEASE_ARTIFACT_DEFECT','report':reference(H+'phase3b-report.md')},'original3C':{'state':'STOPPED_RELEASE_BLOCKER','evidenceScope':'Historical snapshot of uncommitted original blocker files; no fresh sibling-worktree read','snapshot':reference(H+'parallel-inputs.json')},'dispositions':read(E+'binding.json')['phase3'],'phase1And2EvidenceUnchanged':True}

def observe():
    audit_context();sel=selectors();cheap=current('cheap-gates.json')
    assert cheap['state']=='PASS' and cheap['schemaTotalErrors']==0
    refs(cheap['inputs']);refs([cheap['node']]);refs([r['log'] for r in cheap['commands']])
    api=read(P+'contracts/api-contract.json');limits=read(P+'contracts/limits.json');sbom=read(P+'sbom.spdx.json')
    assert len(api['routes'])==9 and sum(r['category']=='semantic' for r in api['routes'])==6
    assert (api['api'],api['apiVersion'],api['packageVersion'])==('memoryos.rest.v1','1.0.0','0.1.0')
    assert api['protocol']['http']=='1.1' and api['protocol']['tls']=='1.3'
    assert limits['state']=='FINAL' and limits['measured']['operationMs']==31400
    assert reference(P+'contracts/limits.json')['sha256']=='4ad1011f2e0861d28020427f1788026c92c6ff0672c707dab7116da1f568e1fa'
    assert api['deployment']=={'defaultMode':'local','remoteMode':{'mode':'remote','implemented':True,'explicitOptIn':True,'bindAddressPolicy':'assigned RFC1918 IPv4'}}
    assert 'PHASE_2_PENDING' not in (ROOT/P/'contracts/openapi.json').read_text()
    assert 'documentComment' not in sbom and 'comment' in sbom
    assert all('licenseInfoInFiles' in f and 'licenseInfoInFile' not in f for f in sbom['files'])
    assert (len(sbom['packages']),len(sbom['files']),len(sbom['relationships']))==(25,56,81)
    assert sum(not p['filesAnalyzed'] for p in sbom['packages'])==23
    index=read(D+'mo1305-phase2d/index.json');refs(index['modules']);refs(index['historical'])
    assert index['state']=='PASS' and index['resourcePolicy']['ceilingMs']==60000
    modules=[]
    counts={'transport':164,'interop':51,'dispatch':23,'startup':5,'resources':45,'lifecycle':30}
    for name,count in counts.items():
        m=read(D+'mo1305-phase2d/modules/'+name+'.json');refs([m['accepted']]);r=read(m['accepted']['path'])
        assert m['state']==r['state']=='PASS' and r['failure'] is None
        assert r['host']['observation']['classification']=='NORMAL' and r['host']['observation']['evidenceState']=='AVAILABLE'
        assert r['bindingSha256']==index['bindingSha256']
        records=r['result']['result']['records'];assert len(records)==count and all(v['state']=='PASS' for v in records)
        modules.append({'module':name,'recordCount':count,'state':'PASS_REUSED','evidence':m['accepted']})
    parity=read(sel['interop'])['result']['result']['provenance']['oracle']
    assert parity['restAsOracle'] is False and parity['freshlyComputed'] is True
    cap=read(D+'mo1305-phase2c/capabilities.json');refs([cap['accepted']]);assert cap['state']=='PASS' and cap['testCount']==141
    for name in ['resource','boundary','stress']:
        assert read(sel[name])['state']=='PASS'
    # Audit credential payloads only; never print credential content on failure.
    scanned=[]
    for line in git('ls-files','--',P,D+'mo1305-phase2c',D+'mo1305-phase2d',H).decode().splitlines():
        data=(ROOT/line).read_bytes()
        assert not re.search(rb'Bearer [0-9a-fA-F]{64}',data),'PERSISTED_BEARER:'+line
        assert not re.search(rb'-----BEGIN (?:RSA |EC )?PRIVATE KEY-----\r?\n',data),'PERSISTED_PRIVATE_KEY:'+line
        scanned.append(reference(line))
    return {'kind':'MemoryOSRESTPhase3CRefreshAudit','version':'1.0.0','state':'PASS','candidate':C3B,'knownReleaseBlockers':[],
      'correction':reference(F+'cheap-gates.json'),'fourDefectsAbsent':True,'negativeRegressions':reference(F+'metadata-tests.json'),
      'identities':{**read(E+'candidate.json')['corrected'],'archive':read(E+'candidate.json')['archive'],'FINAL_limits':reference(P+'contracts/limits.json')},
      'spdx':{'packages':25,'files':56,'relationships':81,'totalSchemaErrors':0,'externalMetadataPackages':23,'result':read(E+'candidate.json')['spdx']},
      'frozenContract':{'routes':api['routes'],'api':api['api'],'apiVersion':api['apiVersion'],'packageVersion':api['packageVersion'],'protocol':api['protocol'],'deployment':api['deployment'],'limits':limits,'ceilingMs':60000},
      'graph':graph_snapshot(),'history':reference(F+'historical.json'),'securityEvidence':modules,'capabilities':cap['accepted'],'sdkOracle':parity,
      'reuse':{'status':'PASS_REUSED','reason':REUSE,'proof':reference(F+'runtime-preservation.json')},
      'loggingSecretScan':{'state':'PASS','fileCount':len(scanned),'fileInventorySha256':hashlib.sha256(j(scanned)).hexdigest(),'scope':'Tracked REST and retained 2C/2D/correction evidence; literal bearer and PEM private-key payloads'},
      'targetedWitnesses':{'current':'Metadata/package 34; contract/OpenAPI 12; correction conformance 8 (including replayed checks); 12 binding mutations. Counts overlap and are not summed as distinct coverage.','freshRuntimeWitnesses':0,'newCharacterizationObservations':0,'reason':REUSE,'correctedArchiveSmoke':reference(E+'installed.json')},
      'external':EXTERNAL,'phase3D':PHASE3D,'limitations':LIMITATIONS,'references':[reference(p) for p in sorted(set(sel.values()))],
      'reviewedSources':[reference(P+n) for n in ['bin/memoryos-rest.mjs','src/config.mjs','src/server.mjs','src/raw-gate.mjs','src/json.mjs','src/schema.mjs','src/delegate.mjs','src/worker.mjs','src/worker-boundary.mjs','src/integrity.mjs','src/logging.mjs','src/admission.mjs','src/resource-policy.mjs']]}

def matrix():
    sel=selectors();authorities={'freeze':FREEZE,'platform':PLATFORM,'method':METHOD,'api':P+'contracts/api-contract.json','limits':P+'contracts/limits.json','spdx':H+'spdx-2.3-schema.json'}
    rows=[]
    for line in SPECS.splitlines():
        key,requirement,status,authority,evidence=line.split('|')
        owner='3A-R' if status=='PENDING_3A_REFRESH' else '3B-R' if status=='PENDING_3B_REFRESH' else '3D' if status=='PHASE3D_BIND' else '3C-R'
        action='Verify and bind this evidence plus its unchanged-runtime lineage in final I3.'
        if owner in EXTERNAL:action='Integrate the existing future PASS commit and verify every requirement in external-prerequisites.json; never infer PASS from this audit.'
        elif owner=='3D':action='Execute the final integration/binding/tag prerequisites in external-prerequisites.json before claiming release readiness.'
        row={'id':key,'requirement':requirement,'authority':[reference(authorities[authority])],'evidenceIdentity':[reference(sel[n]) for n in evidence.split(',')],'status':status,'owner':owner,'phase3DAction':action}
        if status=='PASS_REUSED':row['reuse']={'reason':REUSE,'binding':reference(F+'runtime-preservation.json')}
        if owner in EXTERNAL:row.update(externalState='PENDING_EXTERNAL_REFRESH',futureCommit=None,futureReceipt=None)
        rows.append(row)
    return {'kind':'MemoryOSRESTReleaseClosureMatrix','version':'1.0.0','candidate':C3B,'audit':reference(F+'audit.json'),'state':'READY_FOR_PHASE3D_INTEGRATION','blockedCount':0,'externalRefreshes':EXTERNAL,'requirements':rows}

def receipt():
    return {'kind':'MemoryOSRESTPhase3CRefreshReceipt','version':'1.0.0','state':'PASS','scope':'Independent security/release audit of corrected candidate; external certification and final binding remain pending',
      'baseline':{'workspace':str(WORKSPACE),'branch':BRANCH,'head':C3B,'initialWorkingTree':'CLEAN','releaseTag':'ABSENT'},'graph':graph_snapshot(),
      'identities':current('audit.json')['identities'],'audit':reference(F+'audit.json'),'closureMatrix':reference(F+'closure-matrix.json'),'history':reference(F+'historical.json'),'cheapGates':reference(F+'cheap-gates.json'),
      'report':reference('docs/mo1305-phase3c-refresh.md'),'externalPrerequisites':reference(F+'external-prerequisites.json'),'external':EXTERNAL,'blockedCount':0,
      'productionUnchanged':True,'runtimePreservation':reference(F+'runtime-preservation.json'),'tools':[reference(p.relative_to(ROOT).as_posix()) for p in sorted((ROOT/T).glob('*')) if p.is_file()],
      'commitProtocol':{'subject':AUDIT_SUBJECT,'parent':C3B,'selfCommit':None,'bindingOwner':'Phase 3D binds the existing audit commit, avoiding self-reference'},'finalBinding':'PENDING','releaseTag':'ABSENT'}

def check_value(actual,expected,label):
    assert actual==expected,label+'_CONTENT_OR_IDENTITY'

def validate_audit(value=None):
    check_value(current('historical.json'),historical(),'HISTORY')
    check_value(current('external-prerequisites.json'),{'kind':'MemoryOSRESTPhase3DPrerequisites','version':'1.0.0','candidate':C3B,'external':EXTERNAL,'actions':PHASE3D},'PREREQUISITES')
    check_value(current('audit.json') if value is None else value,observe(),'AUDIT')
    return {'state':'PASS','knownReleaseBlockers':0}

def validate_matrix(value=None):
    value=current('closure-matrix.json') if value is None else value;check_value(value,matrix(),'MATRIX')
    statuses={'PASS_CURRENT','PASS_REUSED','PENDING_3A_REFRESH','PENDING_3B_REFRESH','PHASE3D_BIND','BLOCKED'}
    assert len({r['id'] for r in value['requirements']})==len(SPECS.splitlines())
    for row in value['requirements']:
        assert row['status'] in statuses and row['status']!='BLOCKED'
        assert all(row[k] for k in ['requirement','authority','evidenceIdentity','owner','phase3DAction'])
        refs(row['authority']+row['evidenceIdentity'])
    return {'state':'PASS','requirements':len(value['requirements']),'blocked':0,'pendingExternal':2}

def validate_receipt(value=None):
    value=current('receipt.json') if value is None else value;check_value(value,receipt(),'RECEIPT')
    refs(value['tools']);assert value['commitProtocol']['selfCommit'] is None
    return {'state':'PASS','candidate':C3B,'parent':C3B,'productionUnchanged':True}

def negatives():
    cases=[]
    for name,key,change in [
      ('missing-requirement','closure-matrix.json',lambda v:v['requirements'].pop()),
      ('false-external-pass','closure-matrix.json',lambda v:next(r for r in v['requirements'] if r['id']=='windows-refresh').update(status='PASS_CURRENT')),
      ('missing-owner','closure-matrix.json',lambda v:v['requirements'][0].update(owner='')),
      ('missing-phase3d-action','closure-matrix.json',lambda v:v['requirements'][0].update(phase3DAction='')),
      ('forged-evidence-digest','closure-matrix.json',lambda v:v['requirements'][0]['evidenceIdentity'][0].update(sha256='0'*64)),
      ('wrong-parent','receipt.json',lambda v:v['commitProtocol'].update(parent='0'*40)),
      ('self-reference','receipt.json',lambda v:v['commitProtocol'].update(selfCommit='f'*40)),
      ('false-spdx-zero','audit.json',lambda v:v['spdx'].update(totalSchemaErrors=1))]:
        expected=current(key);value=copy.deepcopy(expected);change(value)
        try:{'closure-matrix.json':validate_matrix,'receipt.json':validate_receipt,'audit.json':validate_audit}[key](value)
        except AssertionError:cases.append({'name':name,'state':'PASS','outcome':'REJECTED'})
        else:raise AssertionError('NEGATIVE_ACCEPTED:'+name)
    for name,raw in [('noncanonical-json',b'{ \"state\": \"PASS\" }'),('duplicate-json-key',b'{\"state\":\"FAIL\",\"state\":\"PASS\"}')]:
        try:parse(raw)
        except ValueError:cases.append({'name':name,'state':'PASS','outcome':'REJECTED'})
        else:raise AssertionError('INVALID_JSON_ACCEPTED:'+name)
    return {'state':'PASS','cases':cases,'count':len(cases)}

def main():
    p=argparse.ArgumentParser();p.add_argument('command',choices=['create','validate','audit','matrix','receipt','negatives']);args=p.parse_args()
    if args.command=='create':
        write('baseline.json',{'kind':'MemoryOSRESTPhase3CRefreshBaseline','workspace':str(WORKSPACE),'branch':BRANCH,'head':C3B,'initialStatusPorcelain':'','initialReleaseTagMatches':[],
         'cacheProvenance':'Read-only copies of recorded original/accepted archive assemblies and pinned schema runtime/Node from existing engineering cache; all writes confined to this dedicated worktree. No rebuild, reinstall or certification claimed.',
         'productionChanged':False,'otherWorktreeWrites':False})
        write('historical.json',historical());write('external-prerequisites.json',{'kind':'MemoryOSRESTPhase3DPrerequisites','version':'1.0.0','candidate':C3B,'external':EXTERNAL,'actions':PHASE3D})
        write('audit.json',observe());write('closure-matrix.json',matrix());write('receipt.json',receipt())
        print(json.dumps({'state':'CREATED','requirements':len(SPECS.splitlines()),'blocked':0}));return
    if args.command=='validate':
        result={'audit':validate_audit(),'closureMatrix':validate_matrix(),'receipt':validate_receipt(),'negativeWitnesses':negatives()}
        print(json.dumps({'state':'PASS','results':result}));return
    print(json.dumps({'audit':validate_audit,'matrix':validate_matrix,'receipt':validate_receipt,'negatives':negatives}[args.command]()))
if __name__=='__main__':main()
