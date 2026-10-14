"""Pure event-ordering rule for MO-1307 retained-process observations.

The native observer may receive a Toolhelp snapshot entry for a process which
exited after the snapshot was captured.  The held process object's times are
the authoritative lifetime observation.  A snapshot row advances positive
live provenance only while that exact held object still has exitTime100ns=0.
"""

RULE = 'MO1307_OBSERVER_EVENT_ORDERING@1.0.0'


def positive_live_observation(snapshot_entry, observation):
    """Return whether this sample may advance ``lastSeenAt``.

    This function is deliberately fail closed. Missing snapshot identity,
    missing held-object times, non-integer values, or an exited held object do
    not establish a positive-live observation.
    """
    if not isinstance(snapshot_entry, dict):
        return False
    if not isinstance(observation, dict):
        return False
    native_times = observation.get('nativeTimes')
    if not isinstance(native_times, dict):
        return False
    exit_time = native_times.get('exitTime100ns')
    return isinstance(exit_time, int) and not isinstance(exit_time, bool) and exit_time == 0


def corrected_last_seen(prior_last_seen, sample_started, snapshot_entry, observation):
    """Apply the rule without mutating any caller-owned value."""
    return sample_started if positive_live_observation(snapshot_entry, observation) else prior_last_seen
