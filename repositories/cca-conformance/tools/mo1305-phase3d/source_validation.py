"""Read-only replay of source validators with explicit integration context.

No source worktree is used. Source blobs/parents/scopes are verified first.
Only dedicated-branch context checks are replaced by actual main validation.
A's preflight is anchored as immutable historical evidence; current structure,
correction, metadata negatives and graph are rechecked by the integration gate.
"""
import argparse, sys
from common import *

def windows():
    sys.path.insert(0,str(ROOT/'repositories/cca-conformance/tools/mo1305-phase3a-refresh'))
    import validator as windows_gate
    data,expected=windows_gate.validate_all(NODE,recheck_preflight=False)
    preflight=data['preflight']
    need(preflight['state']=='PASS' and preflight['schema']['totalErrors']==0,'WINDOWS_PREFLIGHT')
    # Validate all original A3 receipt references against their committed bytes.
    historical=preflight['historicalEvidence']
    for row in historical['files']:
        need(row['revision']==A3 and identity(blobs(A3,[row['path']])[row['path']])=={k:row[k] for k in ('byteLength','sha256')},'HISTORICAL_A3_FILE')
    receipt=historical['receipt'];old=json.loads(blobs(A3,[receipt['path']])[receipt['path']])
    rows=[]
    def collect(v):
        if isinstance(v,dict):
            if {'path','byteLength','sha256'}<=set(v):rows.append({k:v[k] for k in ('path','byteLength','sha256')})
            for x in v.values():collect(x)
        elif isinstance(v,list):
            for x in v:collect(x)
    collect(old);frozen=blobs(A3,sorted({r['path'] for r in rows}))
    for row in rows:need(identity(frozen[row['path']])=={k:row[k] for k in ('byteLength','sha256')},'HISTORICAL_A3_RECEIPT_LINK')
    need(old['state']=='PASS' and all(r['state']=='PASS' and r['actual']==r['expected'] for r in old['results']),'HISTORICAL_A3_PASS')
    need(preflight['runtimeEquivalence']['byteIdenticalCount']==52 and preflight['runtimeEquivalence']['executableRuntimeCount']==42 and preflight['runtimeEquivalence']['authoritativeClosureCount']==25,'RUNTIME_EQUIVALENCE')
    return {'state':'PASS','records':51,'historicalReceiptReferences':len(rows),'spdxErrors':0,'gatewayCampaignsExecuted':0}

def artifact():
    sys.path.insert(0,str(ROOT/'repositories/cca-conformance/tools/mo1305-phase3br'))
    import receipt, wrapper, advisory_snapshot
    # Replace the dedicated workspace/branch guard only. No Git output is altered.
    wrapper.validate_context=context
    value=read(SOURCES['3B-R']['receipt']);result=receipt.validate(value)
    advisory=advisory_snapshot.validate_saved()
    result['advisory']={'date':advisory['snapshotDateUtc'],'components':len(advisory['scope']),'records':len(advisory['advisories']),'sources':len(advisory['sources']),'zeroVulnerabilityClaim':False}
    return result

def audit():
    sys.path.insert(0,str(ROOT/'repositories/cca-conformance/tools/mo1305-phase3c-refresh'))
    import audit as audit_gate
    # Preserve historical baseline fields; validate the actual integration context.
    audit_gate.audit_context=context
    return {'state':'PASS','audit':audit_gate.validate_audit(),'matrix':audit_gate.validate_matrix(),'receipt':audit_gate.validate_receipt()}

if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('role',choices=SOURCES);a=p.parse_args()
    context()
    result={'3A-R':windows,'3B-R':artifact,'3C-R':audit}[a.role]()
    print(json.dumps(result,sort_keys=True))
