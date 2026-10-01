import hashlib, json, pathlib, sys

ROOT=pathlib.Path(__file__).resolve().parents[4]
E=ROOT/'repositories/cca-conformance/evidence/mo1307/replacement-helper-bound-characterization'

def load(p): return json.loads(p.read_text(encoding='utf-8'))
def write(p,v):
    with p.open('x',encoding='utf-8',newline='\n') as f: json.dump(v,f,indent=2);f.write('\n')
def files(pattern): return sorted(pattern.parent.glob(pattern.name)) if pattern.parent.exists() else []
def record_ok(rec):
    try:
        p=pathlib.Path(rec['path']); p=p if p.is_absolute() else ROOT/p
        data=p.read_bytes()
        return len(data)==rec['byteLength'] and 'sha256:'+hashlib.sha256(data).hexdigest()==rec['sha256']
    except Exception: return False
def same_plan(actual,expected):
    return all(actual.get(k)==expected.get(k) for k in ('globalOrdinal','phase','phaseOrdinal','round','classId','sampleId'))

plan=load(E/'sample-plan.json');sequence_plan=load(E/'sequence-plan.json');campaign=load(E/'campaign.json')
derivation_paths=files(E/'derivation/*.json');holdout_paths=files(E/'holdout/*.json')
control_receipt_paths=sorted((E/'sequence-controls').glob('*/receipt.json')) if (E/'sequence-controls').exists() else []
control_helper_paths=sorted((E/'sequence-controls').glob('*/helpers/*.json')) if (E/'sequence-controls').exists() else []
derivation=[load(p) for p in derivation_paths];holdout=[load(p) for p in holdout_paths]
control_receipts=[load(p) for p in control_receipt_paths];control_helpers=[load(p) for p in control_helper_paths]
errors=[]

expected_d=[row for row in plan['order'] if row['phase']=='derivation']
expected_h=[row for row in plan['order'] if row['phase']=='holdout']
if len(derivation)>1080: errors.append('DERIVATION_OVERCOUNT')
if len(holdout)>360: errors.append('HOLDOUT_OVERCOUNT')
for i,row in enumerate(derivation):
    if i>=len(expected_d) or not same_plan(row.get('planRef',{}),expected_d[i]): errors.append(f'DERIVATION_ORDER_{i+1}')
for i,row in enumerate(holdout):
    if i>=len(expected_h) or not same_plan(row.get('planRef',{}),expected_h[i]): errors.append(f'HOLDOUT_ORDER_{i+1}')
if len(holdout)>0 and (len(derivation)!=1080 or any(r.get('result')!='PASS' for r in derivation)): errors.append('HOLDOUT_BEFORE_COMPLETE_DERIVATION')

for phase,rows in (('DERIVATION',derivation),('HOLDOUT',holdout)):
    for i,row in enumerate(rows):
        try:
            if phase=='DERIVATION' and int(row['limitNs'])!=20000000000: errors.append(f'DERIVATION_LIMIT_{i+1}')
        except Exception: errors.append(f'{phase}_LIMIT_FORMAT_{i+1}')
        if row.get('result')=='PASS':
            try:
                s=int(row['Sns']);e=int(row['E_ns']);limit=int(row['limitNs'])
                if not (0<=s<limit and 0<=e<limit): errors.append(f'{phase}_BOUND_{i+1}')
                security=row.get('security',{})
                for key in ('freshProcess','oneCanonicalFrame','eofAndAllPipes','stderrZero','noRetry','noOverlap','failClosed','transportSelfDetachAndQuiescence','cleanupWithin2000','humanAuthoritySeparated'):
                    if security.get(key) is not True: errors.append(f'{phase}_SECURITY_{key}_{i+1}')
            except Exception: errors.append(f'{phase}_MEASUREMENT_{i+1}')
        elif i != len(rows)-1: errors.append(f'{phase}_NONFINAL_FAILURE_{i+1}')

derived=None
if len(derivation)==1080 and all(r.get('result')=='PASS' for r in derivation):
    U=max(int(r['Sns']) for r in derivation);L=max(U,5021030400);V=0
    for cid in range(1,19):
        values=[int(r['Sns']) for r in derivation if r['planRef']['classId']==cid]
        if len(values)!=60: errors.append(f'CLASS_{cid}_COUNT')
        else: V=max(V,max(values)-min(values))
    Q=max(max(0,int(r['E_ns'])-int(r['Sns'])) for r in derivation);R=L+V+Q;H=500*((R+499999999)//500000000)
    derived={'U_ns':str(U),'L_ns':str(L),'V_ns':str(V),'Q_ns':str(Q),'R_ns':str(R),'H_ms':H,'formula':'H=500*ceil(Rns/500000000)','historicalFloorNs':'5021030400'}
    freeze=load(E/'h-freeze.json') if (E/'h-freeze.json').exists() else None
    if 5000 < H <= 20000:
        if freeze is None: errors.append('MISSING_H_FREEZE')
        else:
            for k,v in derived.items():
                if freeze.get(k)!=v: errors.append(f'H_FREEZE_{k}')
    elif freeze is not None: errors.append('UNAUTHORIZED_OUT_OF_DOMAIN_FREEZE')
elif (E/'h-freeze.json').exists(): errors.append('H_FREEZE_WITHOUT_COMPLETE_DERIVATION')

if len(holdout):
    if derived is None or not (5000 < derived['H_ms'] <= 20000): errors.append('HOLDOUT_WITHOUT_VALID_H')
    else:
        hns=derived['H_ms']*1000000
        for i,row in enumerate(holdout):
            try:
                if int(row['limitNs'])!=hns: errors.append(f'HOLDOUT_LIMIT_{i+1}')
            except Exception: errors.append(f'HOLDOUT_LIMIT_FORMAT_{i+1}')
            if row.get('result')=='PASS' and not (int(row['Sns'])<hns and int(row['E_ns'])<hns): errors.append(f'HOLDOUT_H_{i+1}')

control_by_id={c['id']:c for c in sequence_plan['controls']}
receipt_by_id={c['id']:c for c in control_receipts}
helpers_by_control={cid:[] for cid in control_by_id}
for row in control_helpers: helpers_by_control.setdefault(row.get('controlId'),[]).append(row)
attempted_ids=[]
planned_ids=[c['id'] for c in sequence_plan['controls']]
receipt_ids=[c.get('id') for c in control_receipts]
if len(receipt_ids)!=len(set(receipt_ids)): errors.append('DUPLICATE_CONTROL_RECEIPT')
if any(cid not in control_by_id for cid in receipt_ids): errors.append('UNKNOWN_CONTROL_RECEIPT')
if receipt_ids != planned_ids[:len(receipt_ids)]: errors.append('CONTROL_RECEIPT_ORDER')
failed_receipt_positions=[i for i,c in enumerate(control_receipts) if c.get('result')!='PASS']
if failed_receipt_positions and failed_receipt_positions != [len(control_receipts)-1]: errors.append('CONTROL_FAILURE_NOT_FINAL')
for control in sequence_plan['controls']:
    cid=control['id'];receipt=receipt_by_id.get(cid);helpers=helpers_by_control.get(cid,[])
    helpers.sort(key=lambda x:x.get('helperOrdinal',0))
    if [h.get('helperOrdinal') for h in helpers] != list(range(1,len(helpers)+1)): errors.append(f'{cid}_HELPER_RECEIPT_ORDER')
    if receipt is None:
        if attempted_ids and receipt_by_id.get(attempted_ids[-1],{}).get('result')!='PASS': pass
        continue
    attempted_ids.append(cid)
    if receipt.get('helperReceipts')!=len(helpers): errors.append(f'{cid}_HELPER_RECEIPT_COUNT')
    for i,row in enumerate(helpers):
        if i>=len(control['helpers']): errors.append(f'{cid}_HELPER_OVERCOUNT');continue
        expected=control['helpers'][i]
        if row.get('helperOrdinal')!=expected['ordinal'] or row.get('sequence')!=expected['sequence'] or row.get('operation')!=expected['operation'] or row.get('request')!=expected['request']: errors.append(f'{cid}_HELPER_ORDER_{i+1}')
        if row.get('result')=='PASS':
            try:
                s=int(row['Sns']);sequence_ns=int(row['sequenceLifecycleNs'])
                if derived is None or not (0<=s<=sequence_ns<derived['H_ms']*1000000): errors.append(f'{cid}_HELPER_H_{i+1}')
                security=row.get('security',{})
                for key in ('freshProcess','oneCanonicalFrame','eofAndAllPipes','stderrZero','noRetry','noOverlap','sameProspectiveSupervisorOwnership','transportSelfDetachAndQuiescence','humanAuthoritySeparated'):
                    if security.get(key) is not True: errors.append(f'{cid}_SECURITY_{key}_{i+1}')
            except Exception: errors.append(f'{cid}_HELPER_MEASUREMENT_{i+1}')
        elif i!=len(helpers)-1: errors.append(f'{cid}_NONFINAL_HELPER_FAILURE_{i+1}')
    if receipt.get('result')=='PASS':
        if len(helpers)!=control['helperLaunches']: errors.append(f'{cid}_PASS_HELPER_COUNT')
        if not (receipt.get('helperAggregateMs',20000)<20000 and receipt.get('sequenceAggregateMs',20000)<20000 and receipt.get('cliMs',30000)<30000 and receipt.get('workerMs',10000)<10000): errors.append(f'{cid}_LIMIT')
        if receipt.get('workerThreads')!=1: errors.append(f'{cid}_WORKER_COUNT')

if control_receipts and (len(holdout)!=360 or any(r.get('result')!='PASS' for r in holdout)): errors.append('CONTROLS_BEFORE_COMPLETE_HOLDOUT')
unknown_helper_controls=sorted(str(cid) for cid in helpers_by_control if cid not in control_by_id)
if unknown_helper_controls: errors.append('UNKNOWN_HELPER_CONTROL_'+','.join(unknown_helper_controls))

actual_receipts=len(derivation)+len(holdout)+len(control_helpers)
counts=campaign.get('counts',{})
if counts.get('actualHelperLaunches')!=actual_receipts: errors.append('ACTUAL_LAUNCH_RECEIPT_COUNT')
if counts.get('derivation')!=len(derivation): errors.append('CAMPAIGN_DERIVATION_COUNT')
if counts.get('holdout')!=len(holdout): errors.append('CAMPAIGN_HOLDOUT_COUNT')
if counts.get('sequenceHelperLaunches')!=len(control_helpers): errors.append('CAMPAIGN_SEQUENCE_HELPER_COUNT')
if counts.get('sequenceControlsAttempted')!=len(control_receipts): errors.append('CAMPAIGN_CONTROL_ATTEMPT_COUNT')
if counts.get('sequenceControlsPassed')!=sum(1 for r in control_receipts if r.get('result')=='PASS'): errors.append('CAMPAIGN_CONTROL_PASS_COUNT')
if counts.get('workerThreads')!=sum(r.get('workerThreads',0) for r in control_receipts): errors.append('CAMPAIGN_WORKER_COUNT')

executed_globals={r.get('planRef',{}).get('globalOrdinal') for r in derivation+holdout}
expected_remaining_samples=[{**row,'status':'NOT_EXECUTED'} for row in plan['order'] if row['globalOrdinal'] not in executed_globals]
expected_remaining_controls=[]
for control in sequence_plan['controls']:
    receipt=receipt_by_id.get(control['id']); done=len(helpers_by_control.get(control['id'],[]))
    if receipt and receipt.get('result')=='PASS': continue
    expected_remaining_controls.append({'id':control['id'],'kind':control['kind'],'status':'STOPPED_AFTER_EXECUTED_PREFIX' if receipt else 'NOT_EXECUTED','executedHelperPrefix':done,
        'helpers':[{'ordinal':h['ordinal'],'sequence':h['sequence'],'operation':h['operation'],'status':'NOT_EXECUTED'} for h in control['helpers'][done:]]})
expected_prefix={'derivation':len(derivation),'holdout':len(holdout),'completedSequenceControls':sum(1 for r in control_receipts if r.get('result')=='PASS'),
    'attemptedSequenceControls':len(control_receipts),'sequenceHelperLaunches':len(control_helpers),'actualHelperLaunches':actual_receipts,'workerThreads':sum(r.get('workerThreads',0) for r in control_receipts)}
expected_remaining={'samples':expected_remaining_samples,'sequenceControls':expected_remaining_controls}

prelaunch=(E/'prelaunch-invalidation.json').exists()
complete=(campaign.get('result')=='CAMPAIGN_COMPLETE_PENDING_INDEPENDENT_RECOMPUTATION')
if complete:
    if not (len(derivation)==1080 and len(holdout)==360 and len(control_helpers)==104 and len(control_receipts)==16 and all(r.get('result')=='PASS' for r in derivation+holdout+control_helpers+control_receipts)): errors.append('SUCCESS_COMPLETENESS')
    if actual_receipts!=1544 or counts.get('workerThreads')!=16: errors.append('SUCCESS_TOTALS')
    if derived is None or not (5000 < derived['H_ms'] <= 20000) or campaign.get('candidateHms')!=derived['H_ms']: errors.append('SUCCESS_H')
    if (E/'generation-stopped.json').exists() or prelaunch: errors.append('SUCCESS_HAS_STOP')
else:
    if campaign.get('result')!='H_NOT_ESTABLISHED': errors.append('UNKNOWN_CAMPAIGN_RESULT')
    if prelaunch:
        if actual_receipts!=0 or counts.get('actualHelperLaunches')!=0: errors.append('PRELAUNCH_EXECUTION')
        pre=load(E/'prelaunch-invalidation.json')
        if pre.get('executedPrefix')!=expected_prefix: errors.append('PRELAUNCH_EXECUTED_PREFIX')
        if pre.get('remaining')!=expected_remaining: errors.append('PRELAUNCH_REMAINING_INVENTORY')
        stop=campaign.get('stop',{})
        if stop.get('executedPrefix')!=expected_prefix or stop.get('remaining')!=expected_remaining: errors.append('CAMPAIGN_PRELAUNCH_INVENTORY')
        if not record_ok(stop.get('evidence',{})): errors.append('PRELAUNCH_EVIDENCE_BINDING')
    elif not (E/'generation-stopped.json').exists(): errors.append('MISSING_STOP_RECEIPT')
    else:
        stopped=load(E/'generation-stopped.json')
        if stopped.get('executedPrefix')!=expected_prefix: errors.append('STOP_EXECUTED_PREFIX')
        if stopped.get('remaining')!=expected_remaining: errors.append('STOP_REMAINING_INVENTORY')
        stop=campaign.get('stop',{})
        if stop.get('reason')!=stopped.get('reason') or stop.get('current')!=stopped.get('current'): errors.append('CAMPAIGN_FIRST_STOP')
        if stop.get('executedPrefix')!=expected_prefix or stop.get('remaining')!=expected_remaining: errors.append('CAMPAIGN_STOP_INVENTORY')
        if not record_ok(stop.get('evidence',{})): errors.append('STOP_EVIDENCE_BINDING')
        failed_samples=[r for r in derivation+holdout if r.get('result')!='PASS']
        failed_controls=[r for r in control_receipts if r.get('result')!='PASS']
        if len(failed_samples)+len(failed_controls)>1: errors.append('MULTIPLE_FIRST_FAILURES')
        elif failed_samples:
            first=failed_samples[0]
            if stop.get('reason')!=first.get('error') or stop.get('current')!=first.get('planRef'): errors.append('FIRST_STOP_SAMPLE_LINK')
        elif failed_controls:
            first=failed_controls[0]
            if stop.get('reason')!=first.get('error') or stop.get('current')!={'controlId':first.get('id')}: errors.append('FIRST_STOP_CONTROL_LINK')
        elif len(derivation)<1080:
            expected_current=expected_d[len(derivation)]
            if stop.get('current')!=expected_current or not isinstance(stop.get('reason'),dict): errors.append('FIRST_STOP_PREATTEMPT_DERIVATION')
        elif derived and not (5000 < derived['H_ms'] <= 20000):
            if stop.get('reason')!={'code':'H_OUTSIDE_AUTHORIZED_DOMAIN','derived':derived} or stop.get('current')!={'phase':'h-derivation'}: errors.append('FIRST_STOP_H_DOMAIN')
        elif len(holdout)<360:
            expected_current=expected_h[len(holdout)]
            if stop.get('current')!=expected_current or not isinstance(stop.get('reason'),dict): errors.append('FIRST_STOP_PREATTEMPT_HOLDOUT')
        elif len(control_receipts)<16:
            errors.append('FIRST_STOP_MISSING_CONTROL_RECEIPT')
        elif actual_receipts==1544 and all(r.get('result')=='PASS' for r in derivation+holdout+control_helpers+control_receipts):
            if stop.get('reason',{}).get('code')!='POST_LAUNCH_INTEGRITY_FAILURE' or stop.get('current')!={'phase':'post-campaign-integrity'}: errors.append('FIRST_STOP_POST_INTEGRITY')
        else: errors.append('UNCLASSIFIED_FIRST_STOP')
    if derived and derived['H_ms']>20000 and (len(holdout)>0 or len(control_helpers)>0): errors.append('OUT_OF_DOMAIN_CONTINUED')

recomputation_result='PASS' if not errors else 'FAIL'
disposition='H_ESTABLISHED' if recomputation_result=='PASS' and complete else 'H_NOT_ESTABLISHED'
out={'kind':'MO1307ReplacementBoundIndependentRecomputation','version':'1.0.0','result':recomputation_result,
     'disposition':disposition,'implementation':'Independent Python standard-library recomputation; no import of the primary JavaScript formula or campaign implementation.',
     'campaignResult':campaign.get('result'),'counts':{'derivation':len(derivation),'holdout':len(holdout),'sequenceHelpers':len(control_helpers),'sequenceControls':len(control_receipts),'actualHelperLaunches':actual_receipts,'workerThreads':sum(r.get('workerThreads',0) for r in control_receipts)},
     'derived':derived,'errors':errors}
if '--verify' in sys.argv:
    if load(E/'independent-recomputation.json')!=out: raise SystemExit('independent recomputation artifact mismatch')
else: write(E/'independent-recomputation.json',out)
print(json.dumps(out,separators=(',',':')))
