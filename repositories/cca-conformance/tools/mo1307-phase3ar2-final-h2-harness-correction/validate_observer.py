"""Zero-product data replay of the MO-1307 H2 observer event-ordering correction.

Reads the consumed Phase 3AR2 H-corrected runtime-H observation log as data and
the pure identity policy and event-ordering rule. It performs no process, file
write, network, product, helper, worker, or native observer operation. Output is
one JSON document on stdout.
"""
import copy
import importlib.util
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[4]
HERE = Path(__file__).resolve().parent
POLICY_PATH = ROOT / 'repositories/cca-conformance/tools/mo1307-phase3ar2-final-h2-corrected/topology_identity_policy.py'
RULE_PATH = HERE / 'observer_event_ordering.py'
LOG_PATH = ROOT / 'repositories/cca-conformance/evidence/mo1307/phase3ar2-final-h-corrected/runtime-H/process-observation.jsonl'


def load(name, path):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module


POLICY = load('mo1307_topology_identity_policy', POLICY_PATH)
RULE = load('mo1307_observer_event_ordering', RULE_PATH)


def old_last_seen(prior, sample_started, entry, observation):
    """The consumed observer's rule: any snapshot row advanced lastSeenAt."""
    return sample_started if entry else prior


EVENTS = [json.loads(line) for line in LOG_PATH.read_text(encoding='utf-8').splitlines() if line.strip()]
FINAL = [event for event in EVENTS if event['event'] == 'observer_final']
assert len(FINAL) == 1
FINAL = FINAL[0]
SESSION = FINAL['observerSession']
LIFETIMES = FINAL['lifetimes']
SAMPLES = [event for event in EVENTS if event['event'] == 'sample']


def key(identity):
    return (identity['pid'], identity['creationTime100ns'])


def last_seen_until(identity, before_qpc, rule):
    """Recompute lastSeenAt from logged samples strictly before before_qpc."""
    value = None
    for sample in SAMPLES:
        if sample['qpc'] >= before_qpc:
            break
        for observation in sample['processes']:
            if key(observation['identity']) != key(identity):
                continue
            entry = {'threadCount': observation['threadCount']} if observation.get('threadCount') is not None else None
            value = rule(value, sample['started'], entry, observation)
    return value


def rows_at(event_qpc, rule):
    rows = []
    for life in LIFETIMES:
        if life['firstObservedAt']['qpc'] >= event_qpc:
            continue
        signaled = life['signaledAt'] if life['signaledAt'] and life['signaledAt']['qpc'] < event_qpc else None
        rows.append({'identity': life['identity'], 'role': life['role'], 'parentIdentity': life['parentIdentity'],
                     'firstObservedAt': life['firstObservedAt'],
                     'lastSeenAt': last_seen_until(life['identity'], event_qpc, rule) if life['role'] != 'supervisor' else life['lastSeenAt'],
                     'signaledAt': signaled, 'times': life['nativeTimes'], 'observerSession': life['observerSession']})
    return rows


def terminated_context(event, rule):
    rows = rows_at(event['qpc'], rule)
    prior = [row for row in rows if row['identity']['pid'] == event['pid']]
    assert len(prior) == 1, event['pid']
    return {'prior': prior[0], 'knownRows': rows, 'observedAt': event['observedAt'], 'observerSession': SESSION,
            'snapshotSucceeded': event['snapshotSucceeded'], 'snapshotPids': event['snapshotPids']}


def requery_context(event, rule):
    return {'pid': event['pid'], 'snapshotEntry': event['snapshotEntry'], 'error': event['error'],
            'knownRows': rows_at(event['qpc'], rule), 'requeryAt': event['requeryAt'], 'observerSession': SESSION}


def summary(decision):
    return {'accepted': decision['accepted'], 'classification': decision['classification']}


results = {'rule': RULE.RULE, 'policy': POLICY.POLICY_IDENTITY, 'cases': {}, 'replay': {}}

# Replay fidelity: the old rule reproduces every consumed lastSeenAt exactly.
mismatches = []
for life in LIFETIMES:
    if life['role'] == 'supervisor':
        continue
    recomputed = last_seen_until(life['identity'], FINAL['qpc'], old_last_seen)
    if recomputed != life['lastSeenAt']:
        mismatches.append(life['identity'])
assert not mismatches, mismatches
results['replay']['oldRuleReproducesAllConsumedLastSeenAt'] = {'rows': sum(1 for life in LIFETIMES if life['role'] != 'supervisor'), 'mismatches': 0}

terminated = [event for event in EVENTS if event['event'] in ('terminated_known_identity', 'terminated_known_identity_rejected')]
requeries = [event for event in EVENTS if event['event'] == 'post_identity_requery_unavailable']
assert len(terminated) == 21 and len(requeries) == 1
replayed = []
for event in terminated:
    old = POLICY.classify_terminated_known_identity(terminated_context(event, old_last_seen))
    assert old['accepted'] == event['decision']['accepted'] and old['classification'] == event['decision']['classification'] and old['checks'] == event['decision']['checks'], event['pid']
    new = POLICY.classify_terminated_known_identity(terminated_context(event, RULE.corrected_last_seen))
    replayed.append({'pid': event['pid'], 'consumed': summary(event['decision']), 'oldRuleReplay': summary(old), 'correctedRuleReplay': summary(new)})
results['replay']['terminatedKnownIdentity'] = replayed
assert sum(1 for row in replayed if not row['consumed']['accepted']) == 1
assert all(row['correctedRuleReplay'] == {'accepted': True, 'classification': 'TERMINATED_KNOWN_IDENTITY'} for row in replayed)

# Exact PID 2124 sequence.
pid2124 = [event for event in terminated if event['pid'] == 2124]
assert len(pid2124) == 1 and pid2124[0]['event'] == 'terminated_known_identity_rejected'
event2124 = pid2124[0]
life2124 = [life for life in LIFETIMES if life['identity']['pid'] == 2124][0]
exit2124 = life2124['nativeTimes']['exitTime100ns']
samples2124 = []
for sample in SAMPLES:
    for observation in sample['processes']:
        if key(observation['identity']) == key(life2124['identity']):
            samples2124.append({'sampleIndex': sample['sampleIndex'], 'startedNativeUtc100ns': sample['started']['nativeUtc100ns'], 'startedQpc': sample['started']['qpc'],
                                'snapshotEntryPresent': observation.get('threadCount') is not None, 'threadCount': observation.get('threadCount'),
                                'heldObjectExitTime100ns': (observation.get('nativeTimes') or {}).get('exitTime100ns')})
old2124 = terminated_context(event2124, old_last_seen)['prior']['lastSeenAt']
new2124 = terminated_context(event2124, RULE.corrected_last_seen)['prior']['lastSeenAt']
assert old2124['nativeUtc100ns'] > exit2124 and new2124['nativeUtc100ns'] < exit2124
results['pid2124'] = {
    'identity': life2124['identity'], 'role': life2124['role'], 'parentIdentity': life2124['parentIdentity'],
    'exitTime100ns': exit2124, 'signaledAt': life2124['signaledAt'], 'absenceObservedAt': event2124['observedAt'],
    'finalSamples': samples2124[-3:],
    'consumedLastSeenAt': old2124, 'consumedLastSeenMinusExit100ns': old2124['nativeUtc100ns'] - exit2124,
    'correctedLastSeenAt': new2124, 'exitMinusCorrectedLastSeen100ns': exit2124 - new2124['nativeUtc100ns'],
    'consumedDecision': summary(event2124['decision']),
    'consumedFailedCheck': sorted(name for name, value in event2124['decision']['checks'].items() if value is not True),
    'diagnosis': 'The consumed observer advanced lastSeenAt to a sample start taken after the held process object had already recorded its exit time (snapshot row still present, handle not yet signaled). The corrected rule advances lastSeenAt only while the exact held object reports exitTime100ns == 0.',
}


def case(case_id, title, expected, decision, extra=None):
    actual = 'PASS' if decision['accepted'] else 'FAIL'
    row = {'id': case_id, 'title': title, 'expected': expected, 'actual': actual, 'classification': decision['classification'],
           'checks': decision['checks'], 'result': 'PASS' if actual == expected else 'MISMATCH'}
    if extra:
        row.update(extra)
    results['cases'][case_id] = row


# E: known process with consistent termination provenance (exact PID 2124 replay).
context_e = terminated_context(event2124, RULE.corrected_last_seen)
case('E', 'known process with consistent termination provenance (PID 2124 replay)', 'PASS', POLICY.classify_terminated_known_identity(context_e))

# F: contradictory lifetime: a positive-live observation after the bound exit time.
context_f = copy.deepcopy(context_e)
prior_f = context_f['prior']
prior_f['lastSeenAt'] = {'qpc': prior_f['signaledAt']['qpc'] - 1, 'nativeUtc100ns': exit2124 + 1, 'utc': prior_f['signaledAt']['utc']}
context_f['knownRows'] = [prior_f if row['identity'] == prior_f['identity'] else row for row in context_f['knownRows']]
case('F', 'known process with contradictory lifetime', 'FAIL', POLICY.classify_terminated_known_identity(context_f))
assert results['cases']['F']['classification'] == 'LIFETIME_CONTRADICTION'

# G: PID reuse: a second same-PID identity with a different creation time.
context_g = copy.deepcopy(context_e)
reused = copy.deepcopy(context_g['prior'])
reused['identity'] = dict(reused['identity'], creationTime100ns=exit2124 + 10)
reused['times'] = dict(reused['times'], creationTime100ns=exit2124 + 10, exitTime100ns=0)
reused['signaledAt'] = None
reused['lastSeenAt'] = None
context_g['knownRows'] = context_g['knownRows'] + [reused]
case('G', 'PID reuse', 'FAIL', POLICY.classify_terminated_known_identity(context_g))
assert results['cases']['G']['classification'] == 'PID_REUSE_OR_REPLACEMENT_EVIDENCE'
requery_event = requeries[0]
context_g2 = requery_context(requery_event, RULE.corrected_last_seen)
context_g2['error'] = copy.deepcopy(context_g2['error'])
context_g2['error']['nativeTimes'] = dict(context_g2['error']['nativeTimes'], creationTime100ns=context_g2['error']['nativeTimes']['creationTime100ns'] + 1)
decision_g2 = POLICY.classify_identity_query_failure(context_g2)
assert decision_g2['accepted'] is False and decision_g2['classification'] == 'PID_REUSE_OR_REPLACEMENT_EVIDENCE'
results['cases']['G']['requeryVariant'] = summary(decision_g2)

# H: unknown process: no same-session prior positive identity.
context_h = requery_context(requery_event, RULE.corrected_last_seen)
context_h['knownRows'] = [row for row in context_h['knownRows'] if row['identity']['pid'] != requery_event['pid']]
case('H', 'unknown process (initial identity failure)', 'FAIL', POLICY.classify_identity_query_failure(context_h))
assert results['cases']['H']['classification'] == 'NO_PRIOR_POSITIVE_IDENTITY'
context_h2 = copy.deepcopy(context_e)
context_h2['observerSession'] = 'different-session'
decision_h2 = POLICY.classify_terminated_known_identity(context_h2)
assert decision_h2['accepted'] is False and decision_h2['classification'] == 'CROSS_SESSION_IDENTITY_REJECTED'
results['cases']['H']['crossSessionVariant'] = summary(decision_h2)

# I: authorized post-termination unavailable requery with exact provenance.
old_i = POLICY.classify_identity_query_failure(requery_context(requery_event, old_last_seen))
assert old_i['accepted'] == requery_event['decision']['accepted'] and old_i['classification'] == requery_event['decision']['classification'] and old_i['checks'] == requery_event['decision']['checks']
case('I', 'authorized post-termination unavailable requery with exact provenance', 'PASS',
     POLICY.classify_identity_query_failure(requery_context(requery_event, RULE.corrected_last_seen)),
     {'pid': requery_event['pid'], 'consumedDecision': summary(requery_event['decision']), 'oldRuleReplay': summary(old_i)})

# Pure rule unit cases (fail closed).
base_entry = {'threadCount': 1}
unit = {
    'liveHeldObjectAdvances': RULE.positive_live_observation(base_entry, {'nativeTimes': {'exitTime100ns': 0}}) is True,
    'exitedHeldObjectDoesNotAdvance': RULE.positive_live_observation(base_entry, {'nativeTimes': {'exitTime100ns': exit2124}}) is False,
    'missingSnapshotEntryDoesNotAdvance': RULE.positive_live_observation(None, {'nativeTimes': {'exitTime100ns': 0}}) is False,
    'missingNativeTimesDoesNotAdvance': RULE.positive_live_observation(base_entry, {'nativeTimes': None}) is False,
    'boolExitTimeDoesNotAdvance': RULE.positive_live_observation(base_entry, {'nativeTimes': {'exitTime100ns': False}}) is False,
    'nonIntegerExitTimeDoesNotAdvance': RULE.positive_live_observation(base_entry, {'nativeTimes': {'exitTime100ns': '0'}}) is False,
    'priorValuePreservedWhenNotLive': RULE.corrected_last_seen({'qpc': 1}, {'qpc': 2}, base_entry, {'nativeTimes': {'exitTime100ns': 5}}) == {'qpc': 1},
}
assert all(unit.values()), unit
results['ruleUnitCases'] = unit
results['expectedMatrix'] = {'E': 'PASS', 'F': 'FAIL', 'G': 'FAIL', 'H': 'FAIL', 'I': 'PASS'}
results['allCasesMatchExpected'] = all(row['result'] == 'PASS' for row in results['cases'].values())
assert results['allCasesMatchExpected'], results['cases']
results['security'] = {
    'initialUnknownIdentityFailsClosed': results['cases']['H']['actual'] == 'FAIL',
    'pidReuseFailsClosed': results['cases']['G']['actual'] == 'FAIL',
    'contradictoryLifetimeFailsClosed': results['cases']['F']['actual'] == 'FAIL',
    'crossSessionFailsClosed': decision_h2['accepted'] is False,
    'lifetimeContradictionGloballySuppressed': False,
    'policyModified': False,
}
results['execution'] = {'processOperations': 0, 'fileWrites': 0, 'productRuns': 0, 'helperRuns': 0, 'workerRuns': 0, 'nativeObserverRuns': 0}
results['result'] = 'PASS'
sys.stdout.write(json.dumps(results, indent=2, sort_keys=True) + '\n')
