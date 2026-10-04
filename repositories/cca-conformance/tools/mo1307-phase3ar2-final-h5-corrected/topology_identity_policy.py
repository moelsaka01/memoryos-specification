"""Pure fail-closed identity policy for the MO-1307 topology observer."""
from pathlib import PureWindowsPath

POLICY_IDENTITY = 'MO1307_TOPOLOGY_IDENTITY_POLICY@1.0.0'
QFPI = 'QueryFullProcessImageNameW'


def derive_role(executable, parent_role):
    image = str(executable).lower()
    if image == r'c:\windows\system32\windowspowershell\v1.0\powershell.exe' and parent_role == 'supervisor':
        return 'helper'
    if image == r'c:\windows\system32\conhost.exe' and parent_role == 'helper':
        return 'console_host'
    return 'other_descendant'


def _identity(row):
    return row.get('identity') if isinstance(row, dict) else None


def _same_identity(left, right):
    return isinstance(left, dict) and isinstance(right, dict) and left == right


def _decision(accepted, classification, checks, prior=None):
    return {
        'accepted': accepted,
        'classification': classification,
        'checks': checks,
        'priorIdentity': prior.get('identity') if prior else None,
        'priorRole': prior.get('role') if prior else None,
        'priorParentIdentity': prior.get('parentIdentity') if prior else None,
        'policy': POLICY_IDENTITY,
    }


def classify_identity_query_failure(context):
    """Classify an image-name query failure without performing any OS operation."""
    pid = context.get('pid')
    observer_session = context.get('observerSession')
    entry = context.get('snapshotEntry')
    error = context.get('error')
    rows = context.get('knownRows')
    requery_at = context.get('requeryAt')
    checks = {
        'queryOperationEligible': isinstance(error, dict) and error.get('operation') == QFPI,
        'queryErrorRecorded': isinstance(error, dict) and isinstance(error.get('winerror'), int) and error.get('winerror') != 0,
        'probePidMatchesCandidate': isinstance(error, dict) and error.get('pid') == pid,
        'probeObjectProofPreserved': isinstance(error, dict) and error.get('partialObjectProof') == 'OPEN_PROCESS_HANDLE_AND_GET_PROCESS_TIMES',
    }
    if not all(checks.values()):
        return _decision(False, 'INELIGIBLE_UNRELATED_OBSERVATION_ERROR', checks)
    if not isinstance(rows, list):
        checks['sameSessionRowsPresent'] = False
        return _decision(False, 'NO_PRIOR_POSITIVE_IDENTITY', checks)
    same_pid = [row for row in rows if isinstance(_identity(row), dict) and _identity(row).get('pid') == pid]
    checks['exactlyOnePriorPidBinding'] = len(same_pid) == 1
    if not same_pid:
        return _decision(False, 'NO_PRIOR_POSITIVE_IDENTITY', checks)
    if len(same_pid) != 1:
        return _decision(False, 'PID_REUSE_OR_REPLACEMENT_EVIDENCE', checks)
    prior = same_pid[0]
    checks['sameObserverSession'] = isinstance(observer_session, str) and bool(observer_session) and prior.get('observerSession') == observer_session
    if not checks['sameObserverSession']:
        return _decision(False, 'CROSS_SESSION_IDENTITY_REJECTED', checks, prior)
    identity = prior.get('identity')
    parent_identity = prior.get('parentIdentity')
    native_times = prior.get('times')
    signal = prior.get('signaledAt')
    probe_times = error.get('nativeTimes')
    required_dicts = all(isinstance(value, dict) for value in (identity, parent_identity, native_times, signal, probe_times, entry, requery_at))
    checks['completePriorObjectProof'] = required_dicts
    if not required_dicts:
        return _decision(False, 'INCOMPLETE_PRIOR_IDENTITY_PROOF', checks, prior)
    parent_rows = [row for row in rows if _same_identity(_identity(row), parent_identity) and row.get('observerSession') == observer_session]
    checks['exactBoundParentPresent'] = len(parent_rows) == 1
    checks['pidMatchesPriorBinding'] = entry.get('pid') == pid == identity.get('pid')
    checks['parentMatchesPriorBinding'] = entry.get('parentPid') == parent_identity.get('pid')
    if not checks['parentMatchesPriorBinding'] or not checks['exactBoundParentPresent']:
        return _decision(False, 'PARENT_CONTRADICTION', checks, prior)
    expected_image = PureWindowsPath(str(identity.get('executable', ''))).name.lower()
    checks['imageMatchesPriorBinding'] = str(entry.get('imageName', '')).lower() == expected_image and bool(expected_image)
    if not checks['imageMatchesPriorBinding']:
        return _decision(False, 'IMAGE_CONTRADICTION', checks, prior)
    expected_role = derive_role(identity.get('executable'), parent_rows[0].get('role'))
    checks['roleMatchesPriorBinding'] = prior.get('role') == expected_role
    if not checks['roleMatchesPriorBinding']:
        return _decision(False, 'ROLE_CONTRADICTION', checks, prior)
    creation = identity.get('creationTime100ns')
    retained_creation = native_times.get('creationTime100ns')
    retained_exit = native_times.get('exitTime100ns')
    probe_creation = probe_times.get('creationTime100ns')
    probe_exit = probe_times.get('exitTime100ns')
    snapshot_time = entry.get('snapshotTime100ns')
    signal_native = signal.get('nativeUtc100ns')
    signal_qpc = signal.get('qpc')
    requery_native = requery_at.get('nativeUtc100ns')
    requery_qpc = requery_at.get('qpc')
    numeric = all(isinstance(value, int) for value in (creation, retained_creation, retained_exit, probe_creation, probe_exit, snapshot_time, signal_native, signal_qpc, requery_native, requery_qpc))
    checks['completeNativeTimingProof'] = numeric
    if not numeric:
        return _decision(False, 'INCOMPLETE_PRIOR_IDENTITY_PROOF', checks, prior)
    checks['sameProcessCreationTime'] = creation == retained_creation == probe_creation
    checks['sameProcessExitTime'] = retained_exit != 0 and retained_exit == probe_exit
    checks['retainedHandleSignaled'] = signal_qpc > 0 and signal_native >= retained_exit
    # Toolhelp's recorded snapshot time is taken after CreateToolhelp32Snapshot returns;
    # it can be later than an exit captured by that snapshot. Exact retained/probe object
    # times prove identity, while this check proves only observer operation ordering.
    checks['snapshotConsistentWithBoundLifetime'] = creation <= snapshot_time <= signal_native
    checks['requeryOccurredAfterSignal'] = requery_qpc >= signal_qpc and requery_native >= signal_native
    parent_creation = parent_identity.get('creationTime100ns')
    parent_times = parent_rows[0].get('times') if parent_rows else None
    parent_exit = parent_times.get('exitTime100ns') if isinstance(parent_times, dict) else None
    checks['parentLifetimeCompatible'] = isinstance(parent_creation, int) and parent_creation <= creation and isinstance(parent_exit, int) and (parent_exit == 0 or creation <= parent_exit)
    first = prior.get('firstObservedAt')
    last = prior.get('lastSeenAt')
    first_native = first.get('nativeUtc100ns') if isinstance(first, dict) else None
    last_native = last.get('nativeUtc100ns') if isinstance(last, dict) else None
    first_qpc = first.get('qpc') if isinstance(first, dict) else None
    last_qpc = last.get('qpc') if isinstance(last, dict) else None
    retained_chain = isinstance(first_native, int) and creation <= first_native and (last is None or (isinstance(last_native, int) and first_native <= last_native)) and (last_native if last is not None else first_native) <= retained_exit <= signal_native <= requery_native
    snapshot_chain = creation <= snapshot_time <= signal_native <= requery_native
    qpc_chain = isinstance(first_qpc, int) and (last is None or (isinstance(last_qpc, int) and first_qpc <= last_qpc)) and (last_qpc if last is not None else first_qpc) <= signal_qpc <= requery_qpc
    checks['observationTimingConsistent'] = retained_chain and snapshot_chain and qpc_chain
    if not checks['sameProcessCreationTime'] or not checks['sameProcessExitTime']:
        return _decision(False, 'PID_REUSE_OR_REPLACEMENT_EVIDENCE', checks, prior)
    if not checks['pidMatchesPriorBinding'] or not all((checks['retainedHandleSignaled'], checks['snapshotConsistentWithBoundLifetime'], checks['requeryOccurredAfterSignal'], checks['parentLifetimeCompatible'], checks['observationTimingConsistent'])):
        return _decision(False, 'LIFETIME_CONTRADICTION', checks, prior)
    return _decision(True, 'POST_IDENTITY_REQUERY_UNAVAILABLE', checks, prior)


def classify_terminated_known_identity(context):
    """Classify an already-authenticated, signaled object absent from a later snapshot."""
    prior = context.get('prior')
    rows = context.get('knownRows')
    observed_at = context.get('observedAt')
    observer_session = context.get('observerSession')
    snapshot_succeeded = context.get('snapshotSucceeded')
    snapshot_pids = context.get('snapshotPids')
    checks = {}
    if not isinstance(prior, dict) or not isinstance(rows, list) or not isinstance(observed_at, dict):
        checks['completeContext'] = False
        return _decision(False, 'INCOMPLETE_PRIOR_IDENTITY_PROOF', checks, prior if isinstance(prior, dict) else None)
    identity = prior.get('identity')
    parent_identity = prior.get('parentIdentity')
    times = prior.get('times')
    signal = prior.get('signaledAt')
    same_pid = [row for row in rows if isinstance(_identity(row), dict) and isinstance(identity, dict) and _identity(row).get('pid') == identity.get('pid')]
    checks['exactlyOnePriorPidBinding'] = len(same_pid) == 1 and same_pid[0] == prior
    checks['sameObserverSession'] = isinstance(observer_session, str) and bool(observer_session) and prior.get('observerSession') == observer_session
    checks['completePriorObjectProof'] = all(isinstance(value, dict) for value in (identity, parent_identity, times, signal))
    if not checks['exactlyOnePriorPidBinding']:
        return _decision(False, 'PID_REUSE_OR_REPLACEMENT_EVIDENCE', checks, prior)
    if not checks['sameObserverSession']:
        return _decision(False, 'CROSS_SESSION_IDENTITY_REJECTED', checks, prior)
    if not checks['completePriorObjectProof']:
        return _decision(False, 'INCOMPLETE_PRIOR_IDENTITY_PROOF', checks, prior)
    parent_rows = [row for row in rows if _same_identity(_identity(row), parent_identity) and row.get('observerSession') == observer_session]
    checks['exactBoundParentPresent'] = len(parent_rows) == 1
    if not checks['exactBoundParentPresent']:
        return _decision(False, 'PARENT_CONTRADICTION', checks, prior)
    checks['roleMatchesPriorBinding'] = derive_role(identity.get('executable'), parent_rows[0].get('role')) == prior.get('role')
    if not checks['roleMatchesPriorBinding']:
        return _decision(False, 'ROLE_CONTRADICTION', checks, prior)
    creation = identity.get('creationTime100ns')
    exit_time = times.get('exitTime100ns')
    signal_native = signal.get('nativeUtc100ns')
    observed_native = observed_at.get('nativeUtc100ns')
    checks['retainedObjectTimesMatchIdentity'] = isinstance(creation, int) and creation == times.get('creationTime100ns')
    checks['retainedHandleSignaled'] = isinstance(exit_time, int) and exit_time != 0 and isinstance(signal_native, int) and signal_native >= exit_time
    checks['absenceObservedAfterSignal'] = isinstance(observed_native, int) and isinstance(signal_native, int) and observed_native >= signal_native
    checks['snapshotSucceeded'] = snapshot_succeeded is True
    checks['snapshotProvesPidAbsent'] = isinstance(snapshot_pids, list) and all(isinstance(item, int) for item in snapshot_pids) and identity.get('pid') not in snapshot_pids
    signal_qpc = signal.get('qpc')
    observed_qpc = observed_at.get('qpc')
    checks['qpcOrderingConsistent'] = isinstance(signal_qpc, int) and isinstance(observed_qpc, int) and observed_qpc >= signal_qpc
    first = prior.get('firstObservedAt')
    last = prior.get('lastSeenAt')
    first_native = first.get('nativeUtc100ns') if isinstance(first, dict) else None
    last_native = last.get('nativeUtc100ns') if isinstance(last, dict) else None
    first_qpc = first.get('qpc') if isinstance(first, dict) else None
    last_qpc = last.get('qpc') if isinstance(last, dict) else None
    native_chain = isinstance(first_native, int) and creation <= first_native and (last is None or (isinstance(last_native, int) and first_native <= last_native)) and (last_native if last is not None else first_native) <= exit_time <= signal_native <= observed_native
    qpc_chain = isinstance(first_qpc, int) and (last is None or (isinstance(last_qpc, int) and first_qpc <= last_qpc)) and (last_qpc if last is not None else first_qpc) <= signal_qpc <= observed_qpc
    checks['positiveObservationProvenance'] = native_chain and qpc_chain
    parent_creation = parent_identity.get('creationTime100ns')
    parent_times = parent_rows[0].get('times')
    parent_exit = parent_times.get('exitTime100ns') if isinstance(parent_times, dict) else None
    checks['parentLifetimeCompatible'] = isinstance(parent_creation, int) and parent_creation <= creation and isinstance(parent_exit, int) and (parent_exit == 0 or creation <= parent_exit)
    if not all(checks.values()):
        return _decision(False, 'LIFETIME_CONTRADICTION', checks, prior)
    return _decision(True, 'TERMINATED_KNOWN_IDENTITY', checks, prior)
