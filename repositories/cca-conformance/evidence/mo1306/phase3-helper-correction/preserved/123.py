"""Engineering timing analysis keeps outer observations distinct from product events."""
import math

def original_measurement(raw,source):
    assert raw['kind']=='MemoryOSPhase3ARRawHelperTimingDiagnostic'
    assert raw['engineeringObservationCapMs']==5000 and raw['frozenProductDeadlineMs']==2000
    assert 'tick=time.monotonic()' in source and 'subprocess.run(' in source and 'timeout=5' in source
    assert 'checkPaths' not in source
    return {'classification':'MEASUREMENT_DEFECT','defect':'The engineering outer subprocess duration was used to infer product deadline behavior despite not invoking or observing product checkPaths or its timer. The elapsed value itself is preserved.','productDeadlineCompliance':'NOT_MEASURED','elapsedMs':raw['elapsedMs'],'subtractedOverheadMs':None,'windowsCauseAttributed':False}

def product_observation(value):
    events=value['events'];times=[e['atMs'] for e in events]
    assert times and all(math.isfinite(t) for t in times) and times==sorted(times),'NON_MONOTONIC_EVENT_RECORD'
    arms=[e for e in events if e['event']=='timerArmed'];assert arms,'MISSING_PRODUCT_TIMER'
    arm=arms[0];delay=arm['requestedDelayMs']
    if value['mode']=='remaining-overall-100ms':assert 0<delay<2000
    else:assert delay==2000,'FROZEN_HELPER_DEADLINE_CHANGED'
    assert arm['registrationBeforeMs']<=arm['registrationAfterMs']
    assert arm['dueLowerMs']==arm['registrationBeforeMs']+delay and arm['dueUpperMs']==arm['registrationAfterMs']+delay
    terminals=[e for e in events if e['event'] in ('checkPathsResolved','checkPathsRejected')];assert len(terminals)==1
    terminal=terminals[0];accepted=terminal['event']=='checkPathsResolved'
    assert accepted==value['result']['accepted'] and terminal['atMs']==value['terminalAtMs']
    late=accepted and terminal['atMs']>arm['dueUpperMs']
    assert late==value['lateAccepted'],'LATE_ACCEPT_FLAG_MISMATCH'
    close=next(e for e in events if e['event']=='childEventBefore' and e['name']=='close')
    fires=[e for e in events if e['event']=='timerFire' and e['id']==arm['id']]
    kills=[e for e in events if e['event']=='killBefore']
    if accepted:
        assert close['args']==[0,None]
        assert any(e['event']=='stdoutData' and '"safe":true' in e['text'] for e in events)
    else:
        assert terminal['code']==value['result']['code']
        assert fires and kills and fires[0]['atMs']<=kills[0]['atMs']<=close['atMs']<=terminal['atMs']
        assert close['atMs']-kills[0]['atMs']<=2000,'CLEANUP_RESERVE_EXCEEDED'
    assert value['filesystem']['unchanged'] and not value['filesystem']['completeMarkerPresent']
    return {'mode':value['mode'],'accepted':accepted,'code':value['result']['code'],'requestedDelayMs':delay,'deadlineDueUpperMs':arm['dueUpperMs'],'terminalAtMs':terminal['atMs'],'terminalAfterDueUpperMs':terminal['atMs']-arm['dueUpperMs'],'timerArmToTerminalMs':terminal['atMs']-arm['registrationAfterMs'],'timerFired':bool(fires),'lateAccepted':late,'classification':'PRODUCT_DEADLINE_VIOLATION' if late else 'OBSERVED_FAIL_CLOSED' if not accepted else 'OBSERVED_WITHIN_DEADLINE','scope':'Acceptance timing from one monotonic Node clock, not helper kernel-runtime attribution.'}
