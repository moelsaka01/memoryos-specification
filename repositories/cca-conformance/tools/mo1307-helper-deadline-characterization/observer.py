"""Finite query-only observer; never launches, changes, or terminates a product.

The unchanged predecessor supplies ctypes process-query utilities. Its main
function is not invoked. All activity here is external engineering observation.
"""
import argparse
import ctypes as C
from ctypes import wintypes as W
import hashlib
import importlib.machinery
import importlib.util
import json
import os
from pathlib import Path
import re
import sys
import time

HERE = Path(__file__).resolve().parent
SOURCE = HERE / 'retained-runtime-controls-observer.py.data'
SOURCE_HASH = '0c7fc3b2563ee82ef4e873d889405d2c79381cb63bb34d981ff3d8693b6df1ee'
assert hashlib.sha256(SOURCE.read_bytes()).hexdigest() == SOURCE_HASH
loader = importlib.machinery.SourceFileLoader('deadline_native_queries', str(SOURCE))
spec = importlib.util.spec_from_loader(loader.name, loader)
native = importlib.util.module_from_spec(spec)
loader.exec_module(native)
K = native.K
INTERVAL = 0.05
SETTLE = 2.0
GUARD = 300.0
SAMPLE_LIMIT = 512 * 1024
FIXED_HELPER = r'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe'
FIXED_CONSOLE = r'C:\Windows\System32\conhost.exe'


class MemoryStatus(C.Structure):
    _fields_ = [('length', W.DWORD), ('load', W.DWORD),
                ('totalPhysical', C.c_uint64), ('availablePhysical', C.c_uint64),
                ('totalPageFile', C.c_uint64), ('availablePageFile', C.c_uint64),
                ('totalVirtual', C.c_uint64), ('availableVirtual', C.c_uint64),
                ('availableExtendedVirtual', C.c_uint64)]


native.signature('GlobalMemoryStatusEx', W.BOOL, C.POINTER(MemoryStatus))
native.signature('GetSystemTimes', W.BOOL, *([C.POINTER(W.FILETIME)] * 3))


def safe_numbers(value, key=''):
    if isinstance(value, dict):
        return {k: safe_numbers(v, k) for k, v in value.items()}
    if isinstance(value, list):
        return [safe_numbers(v) for v in value]
    if isinstance(value, int) and not isinstance(value, bool) and key.endswith('100ns'):
        return str(value)
    return value


def raw_json(value):
    return (json.dumps(safe_numbers(value), ensure_ascii=True, separators=(',', ':')) + '\n').encode()


def write(path, value):
    data = raw_json(value)
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('xb') as stream:
        stream.write(data)


def binding(path):
    data = path.read_bytes()
    return {'path': str(path), 'byteLength': len(data), 'sha256': 'sha256:' + hashlib.sha256(data).hexdigest()}


def context():
    began = native.clock()
    entries, error = native.snapshot()
    mem = MemoryStatus()
    mem.length = C.sizeof(mem)
    memory = ({'totalPhysicalBytes': mem.totalPhysical, 'availablePhysicalBytes': mem.availablePhysical,
               'memoryLoadPercent': mem.load} if K.GlobalMemoryStatusEx(C.byref(mem)) else
              {'status': 'NOT_OBSERVABLE', 'winerror': C.get_last_error()})
    cpu = [W.FILETIME() for _ in range(3)]
    cpu_values = ({name: native.filetime(v) for name, v in zip(('idle100ns', 'kernel100ns', 'user100ns'), cpu)}
                  if K.GetSystemTimes(*[C.byref(v) for v in cpu]) else
                  {'status': 'NOT_OBSERVABLE', 'winerror': C.get_last_error()})
    precise = W.FILETIME()
    K.GetSystemTimePreciseAsFileTime(C.byref(precise))
    return {'started': began, 'finished': native.clock(), 'nativeSystemTime100ns': native.filetime(precise),
            'cpuCumulative': cpu_values, 'memory': memory, 'processCount': len(entries) if entries is not None else None,
            'snapshotError': error, 'logicalCpuCount': os.cpu_count(),
            'cpuMeaning': 'Cumulative system counters, kernel includes idle. Utilization requires a later counter difference; this is not a point-in-time percentage.'}


def process_metrics(row, entry):
    times, error = native.process_times(row['handle'])
    if times is not None:
        row['times'] = times
    memory = native.MemoryCounters()
    memory.cb = C.sizeof(memory)
    available = row['metricHandle'] and native.P.GetProcessMemoryInfo(row['metricHandle'], C.byref(memory), memory.cb)
    return {'identity': row['identity'], 'role': row['role'], 'nativeTimes': times, 'nativeTimesError': error,
            'threadCount': entry.get('threadCount') if entry else None,
            'memory': {key: getattr(memory, key) for key in ('workingSetSize', 'peakWorkingSetSize', 'privateUsage')} if available else None,
            'memoryError': None if available else C.get_last_error() if row['metricHandle'] else row['metricAccessError']}


class Sample:
    def __init__(self, sample_id, output):
        self.id = sample_id
        self.output = output
        self.context = context()
        self.started = native.clock()
        self.rows = {}
        self.pid = None
        self.events = []
        self.samples = []
        self.byte_count = 0
        self.output_limited = False
        self.errors = 0
        self.overhead_qpc = 0
        self.last_sample = None
        self.maximum_gap_qpc = 0
        self.settled_at = None
        self.unexpected_children = set()
        self.final_snapshot_succeeded = False

    def write(self, event, **data):
        record = {'event': event, **native.clock(), **data}
        size = len(raw_json(record))
        if self.byte_count + size > SAMPLE_LIMIT - 65536:
            self.output_limited = True
            return False
        self.byte_count += size
        self.events.append(record)
        if 'error' in event or 'unknown' in event or 'race' in event:
            self.errors += 1
        return True

    def poll(self, pid):
        at = native.clock()
        if self.pid is not None and self.pid != pid:
            raise ValueError('helper PID changed within a sample')
        self.pid = pid
        if self.last_sample is not None:
            self.maximum_gap_qpc = max(self.maximum_gap_qpc, at['qpc'] - self.last_sample)
        self.last_sample = at['qpc']
        entries, snapshot_error = native.snapshot()
        self.final_snapshot_succeeded = snapshot_error is None
        if snapshot_error:
            self.write('snapshot_error', error=snapshot_error)
            entries = {}
        root = next((r for r in self.rows.values() if r['role'] == 'helper'), None)
        if root is None:
            acquired, error = native.acquire(pid)
            if error:
                self.write('helper_identity_unknown', pid=pid, error=error)
            else:
                identity = acquired['identity']
                entry = entries.get(pid)
                if (identity['executable'].lower() != FIXED_HELPER.lower()
                        or identity['creationTime100ns'] < self.context['nativeSystemTime100ns']
                        or (entry and identity['creationTime100ns'] > entry['snapshotTime100ns'])):
                    self.write('helper_identity_race', identity=identity, snapshotEntry=entry)
                    native.release(acquired)
                else:
                    acquired.update(role='helper', parentIdentity=None, firstObservedAt=native.clock())
                    self.rows[(pid, identity['creationTime100ns'])] = acquired
                    root = acquired
                    self.write('process_discovered', role='helper', identity=identity)
        for row in self.rows.values():
            native.wait_record(row, self)
        if root is not None:
            for candidate_pid, entry in entries.items():
                if entry['parentPid'] != pid or any(k[0] == candidate_pid for k in self.rows):
                    continue
                if entry['imageName'].lower() != 'conhost.exe':
                    self.unexpected_children.add(candidate_pid)
                    continue
                child, error = native.acquire(candidate_pid)
                if error:
                    self.write('console_identity_unknown', pid=candidate_pid, error=error)
                    continue
                identity = child['identity']
                born = identity['creationTime100ns']
                parent_exit = root['times']['exitTime100ns']
                if (identity['executable'].lower() != FIXED_CONSOLE.lower()
                        or born < root['identity']['creationTime100ns'] or born > entry['snapshotTime100ns']
                        or (parent_exit != 0 and born > parent_exit)):
                    self.write('console_ancestry_race', identity=identity, parentIdentity=root['identity'])
                    native.release(child)
                    continue
                child.update(role='console_host', parentIdentity=root['identity'], firstObservedAt=native.clock())
                self.rows[(candidate_pid, born)] = child
                self.write('process_discovered', role='console_host', identity=identity, parentIdentity=root['identity'])
        values = []
        for row in self.rows.values():
            if not native.wait_record(row, self):
                entry = entries.get(row['identity']['pid'])
                if entry:
                    row['lastSeenAt'] = at
                values.append(process_metrics(row, entry))
        end = native.clock()
        self.overhead_qpc += end['qpc'] - at['qpc']
        if self.write('sample', started=at, finished=end, snapshotSucceeded=snapshot_error is None, processes=values):
            self.samples.append({'started': at, 'finished': end, 'liveProcesses': len(values)})

    def can_finish(self):
        return (bool(self.rows) and self.final_snapshot_succeeded
                and all(r['signaledAt'] is not None for r in self.rows.values()))

    def finish(self, reason):
        try:
            for row in self.rows.values():
                native.wait_record(row, self)
            lifetimes = []
            for row in self.rows.values():
                times, error = native.process_times(row['handle'])
                if times is not None:
                    row['times'] = times
                lifetimes.append({'identity': row['identity'], 'role': row['role'], 'parentIdentity': row['parentIdentity'],
                                  'firstObservedAt': row['firstObservedAt'], 'lastSeenAt': row['lastSeenAt'],
                                  'signaledAt': row['signaledAt'], 'nativeTimes': row['times'], 'finalTimesError': error,
                                  'cpuMs': (row['times']['kernelTime100ns'] + row['times']['userTime100ns']) / 10000})
            helpers = [r for r in lifetimes if r['role'] == 'helper']
            consoles = [r for r in lifetimes if r['role'] == 'console_host']
            settled_elapsed = None if self.settled_at is None else (time.monotonic() - self.settled_at) * 1000
            live_at_final = [row['identity'] for row in self.rows.values()
                             if K.WaitForSingleObject(row['handle'], 0) == native.WAIT_TIMEOUT]
            cleanup_violation = bool(live_at_final) and settled_elapsed is not None and settled_elapsed >= 2000
            result = {'kind': 'MO1307HelperDeadlineProcessObservations', 'version': '1.0.0', 'sampleId': self.id,
                      'result': 'OBSERVED' if helpers and not self.output_limited else 'PARTIAL', 'reason': reason,
                      'contextBefore': self.context, 'contextAfter': context(), 'started': self.started, 'finished': native.clock(),
                      'requestedHelperPid': self.pid, 'lifetimes': lifetimes, 'events': self.events,
                      'sampleCount': len(self.samples), 'qpcFrequency': native.frequency.value,
                      'maximumSampleGapMs': 1000 * self.maximum_gap_qpc / native.frequency.value,
                      'samplingOverheadMs': 1000 * self.overhead_qpc / native.frequency.value,
                      'identityOrSnapshotErrors': self.errors, 'outputLimitReached': self.output_limited,
                      'helperCpuMs': sum(r['cpuMs'] for r in helpers) if helpers else None,
                      'consoleCpuMs': sum(r['cpuMs'] for r in consoles) if consoles else None,
                      'allObservedObjectsSignaled': bool(lifetimes) and all(r['signaledAt'] is not None for r in lifetimes),
                      'observedHelperCount': len(helpers), 'observedConsoleHostCount': len(consoles),
                      'consoleAttributionEstablished': bool(consoles), 'completeDescendantCoverageEstablished': False,
                      'observerSettleElapsedMs': settled_elapsed, 'positivelyObservedLiveAtFinal': live_at_final,
                      'requiredCleanupViolation': cleanup_violation,
                      'unexpectedDirectChildPids': sorted(self.unexpected_children),
                      'productCleanupFlagModified': False, 'processTerminationPerformed': False,
                      'limitations': ['Sampling can miss short-lived consoles; absence of discovery is NOT_OBSERVABLE, not proof of absence.',
                                      'Only signaled retained identified process handles prove exit of those objects.',
                                      'GetProcessTimes includes all process threads; CPU/elapsed differences do not establish scheduler causation.',
                                      '50ms polling and recorded query work can perturb scheduling; overhead excludes serialization, flush and indirect scheduling effects.',
                                      'Observer stops polling at its2000ms settled-control allowance; scheduling/query/serialization overshoot is recorded, not product cleanup grace.',
                                      'Native100ns values are exact decimal strings; noT3/readiness/innerPowerShellstage is observed.']}
            destination = self.output / 'samples' / self.id / 'process-observations.json'
            raw = raw_json(result)
            if len(raw) > SAMPLE_LIMIT:
                raise ValueError('final per-sample observation exceeds512KiB')
            write(destination, result)
            ack = {'kind': 'MO1307HelperDeadlineObserverSettled', 'sampleId': self.id,
                   'result': result['result'], 'observation': binding(destination),
                   'requiredCleanupViolation': cleanup_violation, **native.clock()}
            write(self.output / ('ack-settled-' + self.id + '.json'), ack)
            return ack
        finally:
            for row in self.rows.values():
                native.release(row)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--control', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    root = HERE.parents[3]
    output, control = args.output.resolve(), args.control.resolve()
    for p in (output, control):
        if not p.is_relative_to(root) or p == root:
            parser.error('all observation/control paths must be within the owned workspace')
    output.mkdir(parents=True, exist_ok=True)
    if (output / 'ready.json').exists():
        parser.error('observer output must be single-use')
    started = native.clock()
    deadline = time.monotonic() + GUARD
    completed, current = [], None
    parse_failures = 0
    result, failure = 'PASS', None
    write(output / 'ready.json', {'kind': 'MO1307HelperDeadlineObserverReady', 'version': '1.0.0',
                               'observerPid': os.getpid(), 'qpcFrequency': native.frequency.value,
                               'intervalMs': 50, 'settlementMs': 2000, 'guardSeconds': 300, 'maximumSampleBytes': SAMPLE_LIMIT,
                               'sourceBindings': [binding(Path(__file__).resolve()), binding(SOURCE), binding(Path(sys.executable))],
                               'pythonVersion': sys.version, 'started': started, 'productProcessesLaunched': 0})
    try:
        while time.monotonic() < deadline:
            try:
                with control.open('rb') as stream:
                    raw = stream.read(4097)
                if len(raw) > 4096:
                    raise ValueError('control ceiling')
                command = json.loads(raw)
            except (FileNotFoundError, json.JSONDecodeError, PermissionError):
                parse_failures += 1
                time.sleep(INTERVAL)
                continue
            if (set(command) != {'version', 'phase', 'sampleId', 'pid'} or command['version'] != 1
                    or command['phase'] not in ('prepare', 'active', 'settled', 'done')):
                raise ValueError('invalid closed control record')
            phase, sample_id, pid = command['phase'], command['sampleId'], command['pid']
            if phase == 'done':
                if sample_id is not None or pid is not None or current is not None:
                    raise ValueError('done before sample settled')
                break
            if not isinstance(sample_id, str) or not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._-]{0,63}', sample_id):
                raise ValueError('invalid sampleId')
            if phase == 'prepare':
                if pid is not None:
                    raise ValueError('prepare pid must be null')
                if current is None:
                    if sample_id in [r['sampleId'] for r in completed]:
                        raise ValueError('sample repeat')
                    current = Sample(sample_id, output)
                    write(output / ('ack-' + sample_id + '.json'), {'kind': 'MO1307HelperDeadlineObserverPrepared',
                                                                 'sampleId': sample_id, 'context': current.context, **native.clock()})
                elif current.id != sample_id:
                    raise ValueError('new prepare while previous sample active')
            else:
                if current is None:
                    if phase == 'settled' and sample_id in [r['sampleId'] for r in completed]:
                        time.sleep(INTERVAL)
                        continue
                    raise ValueError('active/settled without prepared sample')
                if current.id != sample_id or not isinstance(pid, int) or isinstance(pid, bool) or pid <= 0:
                    raise ValueError('active/settled identity mismatch')
                if phase == 'settled' and current.settled_at is None:
                    current.settled_at = time.monotonic()
                current.poll(pid)
                if phase == 'settled':
                    if current.can_finish() or time.monotonic() - current.settled_at >= SETTLE:
                        completed.append(current.finish('SETTLED_CONTROL_OBSERVED'))
                        current = None
            remaining = SETTLE - (time.monotonic() - current.settled_at) if current and current.settled_at is not None else INTERVAL
            time.sleep(max(0, min(INTERVAL, remaining)))
        else:
            raise TimeoutError('300-second engineering observer guard')
    except Exception as exc:
        result, failure = 'FAIL', {'type': type(exc).__name__, 'message': str(exc)}
        if current is not None:
            completed.append(current.finish('OBSERVER_FAILED_OR_GUARD_EXPIRED'))
            current = None
    finally:
        write(output / 'receipt.json', {'kind': 'MO1307HelperDeadlineObserverReceipt', 'version': '1.0.0',
                                      'result': result, 'failure': failure, 'started': started, 'finished': native.clock(),
                                      'completedSamples': completed, 'controlReadRetries': parse_failures,
                                      'productProcessesLaunched': 0, 'productProcessesTerminated': 0,
                                      'productionModified': False, 'certification': False})
    return 0 if result == 'PASS' else 2


if __name__ == '__main__':
    raise SystemExit(main())
