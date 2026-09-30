"""Bounded, read-only native process observer for one MO-1307 supervisor.

No product imports, launch interception, command lines, environment reads,
process termination, or product budget changes. Sampling can miss lifetimes;
only waits on a retained, identified process handle prove that object's exit.
"""
import argparse
import ctypes as C
from ctypes import wintypes as W
from datetime import datetime, timezone
import json
import math
import os
from pathlib import Path
import time

K = C.WinDLL('kernel32', use_last_error=True)
P = C.WinDLL('psapi', use_last_error=True)
INVALID = C.c_void_p(-1).value
WAIT_OBJECT_0 = 0
WAIT_TIMEOUT = 258
SYNCHRONIZE_QUERY_LIMITED = 0x00100000 | 0x1000


class ProcessEntry(C.Structure):
    _fields_ = [('size', W.DWORD), ('usage', W.DWORD), ('pid', W.DWORD),
                ('heap', C.c_size_t), ('module', W.DWORD), ('threads', W.DWORD),
                ('parent', W.DWORD), ('priority', W.LONG), ('flags', W.DWORD),
                ('name', W.WCHAR * 260)]


class MemoryCounters(C.Structure):
    _fields_ = [('cb', W.DWORD), ('pageFaultCount', W.DWORD),
                ('peakWorkingSetSize', C.c_size_t), ('workingSetSize', C.c_size_t),
                ('quotaPeakPagedPoolUsage', C.c_size_t), ('quotaPagedPoolUsage', C.c_size_t),
                ('quotaPeakNonPagedPoolUsage', C.c_size_t), ('quotaNonPagedPoolUsage', C.c_size_t),
                ('pagefileUsage', C.c_size_t), ('peakPagefileUsage', C.c_size_t),
                ('privateUsage', C.c_size_t)]


class IoCounters(C.Structure):
    _fields_ = [(n, C.c_uint64) for n in
                ('readOperations', 'writeOperations', 'otherOperations',
                 'readBytes', 'writeBytes', 'otherBytes')]


def signature(name, restype, *args):
    f = getattr(K, name)
    f.restype = restype
    f.argtypes = list(args)
    return f


signature('OpenProcess', W.HANDLE, W.DWORD, W.BOOL, W.DWORD)
signature('CloseHandle', W.BOOL, W.HANDLE)
signature('WaitForSingleObject', W.DWORD, W.HANDLE, W.DWORD)
signature('CreateToolhelp32Snapshot', W.HANDLE, W.DWORD, W.DWORD)
signature('Process32FirstW', W.BOOL, W.HANDLE, C.POINTER(ProcessEntry))
signature('Process32NextW', W.BOOL, W.HANDLE, C.POINTER(ProcessEntry))
signature('QueryFullProcessImageNameW', W.BOOL, W.HANDLE, W.DWORD, W.LPWSTR, C.POINTER(W.DWORD))
signature('GetProcessTimes', W.BOOL, W.HANDLE, *([C.POINTER(W.FILETIME)] * 4))
signature('GetProcessIoCounters', W.BOOL, W.HANDLE, C.POINTER(IoCounters))
signature('GetProcessHandleCount', W.BOOL, W.HANDLE, C.POINTER(W.DWORD))
signature('GetSystemTimePreciseAsFileTime', None, C.POINTER(W.FILETIME))
signature('QueryPerformanceCounter', W.BOOL, C.POINTER(C.c_int64))
signature('QueryPerformanceFrequency', W.BOOL, C.POINTER(C.c_int64))
P.GetProcessMemoryInfo.argtypes = [W.HANDLE, C.POINTER(MemoryCounters), W.DWORD]
P.GetProcessMemoryInfo.restype = W.BOOL

frequency = C.c_int64()
if not K.QueryPerformanceFrequency(C.byref(frequency)):
    raise C.WinError(C.get_last_error())


def clock():
    qpc = C.c_int64()
    if not K.QueryPerformanceCounter(C.byref(qpc)):
        raise C.WinError(C.get_last_error())
    native_utc = W.FILETIME()
    K.GetSystemTimePreciseAsFileTime(C.byref(native_utc))
    return {'qpc': qpc.value, 'nativeUtc100ns': (native_utc.dwHighDateTime << 32) | native_utc.dwLowDateTime, 'utc': datetime.now(timezone.utc).isoformat()}


def filetime(value):
    return (value.dwHighDateTime << 32) | value.dwLowDateTime


def process_times(handle):
    values = [W.FILETIME() for _ in range(4)]
    if not K.GetProcessTimes(handle, *[C.byref(v) for v in values]):
        return None, C.get_last_error()
    return dict(zip(('creationTime100ns', 'exitTime100ns', 'kernelTime100ns', 'userTime100ns'),
                    [filetime(v) for v in values])), None


def snapshot():
    handle = K.CreateToolhelp32Snapshot(2, 0)
    if handle == INVALID:
        return None, {'operation': 'CreateToolhelp32Snapshot', 'winerror': C.get_last_error()}
    snapshot_clock = W.FILETIME()
    K.GetSystemTimePreciseAsFileTime(C.byref(snapshot_clock))
    snapshot_native_time = filetime(snapshot_clock)
    entries = {}
    try:
        entry = ProcessEntry()
        entry.size = C.sizeof(entry)
        valid = K.Process32FirstW(handle, C.byref(entry))
        if not valid:
            return None, {'operation': 'Process32FirstW', 'winerror': C.get_last_error()}
        while valid:
            entries[entry.pid] = {'pid': entry.pid, 'parentPid': entry.parent,
                                  'imageName': entry.name, 'threadCount': entry.threads,
                                  'snapshotTime100ns': snapshot_native_time}
            valid = K.Process32NextW(handle, C.byref(entry))
        error = C.get_last_error()
        if error != 18:
            return None, {'operation': 'Process32NextW', 'winerror': error}
        return entries, None
    finally:
        K.CloseHandle(handle)


class BoundedLog:
    MAX_BYTES = 32 * 1024 * 1024
    MAX_RECORDS = 20000

    def __init__(self, path):
        self.stream = path.open('xb')
        self.byte_count = 0
        self.records = 0
        self.limit_reached = False

    def write(self, event, final=False, **data):
        record = {'event': event, **clock(), **data}
        raw = (json.dumps(record, ensure_ascii=True, separators=(',', ':')) + '\n').encode('utf-8')
        allowance = self.MAX_BYTES if final else self.MAX_BYTES - 16384
        if self.byte_count + len(raw) > allowance or (not final and self.records >= self.MAX_RECORDS - 1):
            self.limit_reached = True
            return False
        self.stream.write(raw)
        self.stream.flush()
        self.byte_count += len(raw)
        self.records += 1
        return True

    def close(self):
        self.stream.close()


def acquire(pid):
    handle = K.OpenProcess(SYNCHRONIZE_QUERY_LIMITED, False, pid)
    if not handle:
        return None, {'operation': 'OpenProcess', 'winerror': C.get_last_error()}
    try:
        times, error = process_times(handle)
        if error is not None:
            return None, {'operation': 'GetProcessTimes', 'winerror': error}
        length = W.DWORD(32768)
        image = C.create_unicode_buffer(length.value)
        if not K.QueryFullProcessImageNameW(handle, 0, image, C.byref(length)):
            return None, {'operation': 'QueryFullProcessImageNameW', 'winerror': C.get_last_error()}
        identity = {'pid': pid, 'creationTime100ns': times['creationTime100ns'], 'executable': image.value}
        # Supplemental metrics are optional. This handle never controls a process.
        metric_handle = K.OpenProcess(0x0400 | 0x0010, False, pid)
        metric_error = C.get_last_error() if not metric_handle else None
        if metric_handle:
            metric_times, metric_error = process_times(metric_handle)
            if metric_times is None or metric_times['creationTime100ns'] != times['creationTime100ns']:
                K.CloseHandle(metric_handle)
                metric_handle = None
                metric_error = metric_error if metric_times is None else 'METRIC_PROCESS_IDENTITY_MISMATCH'
        result = {'handle': handle, 'metricHandle': metric_handle, 'metricAccessError': metric_error,
                  'identity': identity, 'times': times, 'signaledAt': None, 'lastSeenAt': None}
        handle = None
        return result, None
    finally:
        if handle:
            K.CloseHandle(handle)


def release(row):
    for key in ('metricHandle', 'handle'):
        if row.get(key):
            K.CloseHandle(row[key])
            row[key] = None


def wait_record(row, log):
    if row['signaledAt'] is not None:
        return True
    before = clock()
    status = K.WaitForSingleObject(row['handle'], 0)
    wait_error = C.get_last_error()
    after = clock()
    if status == WAIT_OBJECT_0:
        row['signaledAt'] = after
        values, error = process_times(row['handle'])
        if values is not None:
            row['times'] = values
        log.write('process_handle_signaled', identity=row['identity'], role=row['role'],
                  waitStarted=before, waitFinished=after, nativeTimes=values,
                  nativeTimesError=error, proof='HELD_PROCESS_OBJECT_SIGNALED')
        return True
    if status != WAIT_TIMEOUT:
        log.write('wait_error', identity=row['identity'], waitStatus=status,
                  winerror=wait_error, waitStarted=before, waitFinished=after)
    return False


def metrics(row, entry):
    values, error = process_times(row['handle'])
    result = {'identity': row['identity'], 'role': row['role'], 'nativeTimes': values,
              'nativeTimesError': error, 'threadCount': entry.get('threadCount') if entry else None}
    if values is not None:
        row['times'] = values
    counters = IoCounters()
    if K.GetProcessIoCounters(row['handle'], C.byref(counters)):
        result['io'] = {name: getattr(counters, name) for name, _ in IoCounters._fields_}
    else:
        result['ioError'] = C.get_last_error()
    count = W.DWORD()
    if K.GetProcessHandleCount(row['handle'], C.byref(count)):
        result['handleCount'] = count.value
    else:
        result['handleCountError'] = C.get_last_error()
    memory = MemoryCounters()
    memory.cb = C.sizeof(memory)
    if row['metricHandle'] and P.GetProcessMemoryInfo(row['metricHandle'], C.byref(memory), memory.cb):
        result['memory'] = {name: getattr(memory, name) for name in
                            ('workingSetSize', 'peakWorkingSetSize', 'privateUsage', 'pageFaultCount')}
    else:
        result['memoryError'] = C.get_last_error() if row['metricHandle'] else row['metricAccessError']
    return result


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pid', type=int, required=True)
    parser.add_argument('--ready', type=Path, required=True)
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--stop-file', type=Path, required=True)
    parser.add_argument('--interval-ms', type=float, default=10.0)
    parser.add_argument('--timeout-seconds', type=float, default=90.0)
    args = parser.parse_args()
    if args.pid <= 0 or not 10 <= args.interval_ms <= 100 or not 0 < args.timeout_seconds <= 90:
        parser.error('PID must be positive, interval must be 10-100 ms, timeout must be at most 90 seconds')
    paths = [args.ready.resolve(), args.output.resolve(), args.stop_file.resolve()]
    if len(set(paths)) != 3 or any(p.exists() for p in paths):
        parser.error('ready, output and stop-file must be distinct, fresh paths')
    log = BoundedLog(args.output)
    rows = {}
    root = None
    failures = 0
    sample_count = 0
    maximum_gap_qpc = 0
    previous_sample_qpc = None
    overhead_qpc = 0
    reason = 'UNEXPECTED_ERROR'
    clock_bridge = None
    bridge_path = Path(str(args.ready)+'.clock-bridge.json')
    bridge_accepted_path = Path(str(args.ready)+'.clock-bridge-accepted.json')
    if bridge_path.exists() or bridge_accepted_path.exists():
        parser.error('clock bridge files must be fresh')
    start = clock()
    deadline_qpc = start['qpc'] + int(args.timeout_seconds * frequency.value)
    try:
        log.write('observer_start', observerPid=os.getpid(), supervisorPid=args.pid,
                  qpcFrequency=frequency.value, intervalMs=args.interval_ms,
                  timeoutSeconds=args.timeout_seconds, started=start,
                  bounds={'maximumBytes': log.MAX_BYTES, 'maximumRecords': log.MAX_RECORDS},
                  scope='READ_ONLY_SAMPLED_DESCENDANT_PROCESS_OBSERVATION',
                  limitations=['Sampling can miss short-lived descendants.',
                               'Failed or racing identity queries are unknown, not proof of absence.',
                               'Only signaled retained handles prove exit of identified process objects.',
                               'Counters do not identify an inner PowerShell stage.',
                               'Observer overhead is measured and can affect scheduling.'])
        root, error = acquire(args.pid)
        if error:
            log.write('setup_error', supervisorPid=args.pid, error=error)
            reason = 'ROOT_IDENTITY_UNAVAILABLE'
            return 2
        root.update(role='supervisor', parentIdentity=None, firstObservedAt=clock())
        root_key = (args.pid, root['identity']['creationTime100ns'])
        rows[root_key] = root
        log.write('process_discovered', identity=root['identity'], role=root['role'],
                  parentIdentity=None, metricAccessError=root['metricAccessError'])
        if wait_record(root, log):
            reason = 'ROOT_ALREADY_EXITED'
            return 2
        ready = {'kind': 'MO1307ExternalProcessObserverReady', 'version': '1.0.0',
                 'observerPid': os.getpid(), 'rootIdentity': root['identity'],
                 'qpcFrequency': frequency.value, **clock()}
        ready_pending=Path(str(args.ready)+'.pending')
        with ready_pending.open('x', encoding='utf-8', newline='\n') as stream:
            stream.write(json.dumps(ready, separators=(',', ':')) + '\n')
        os.rename(ready_pending,args.ready)
        log.write('ready', rootIdentity=root['identity'])
        while True:
            sample_start = clock()
            if clock_bridge is None and bridge_path.exists():
                request = json.loads(bridge_path.read_text(encoding='utf-8'))
                acknowledged = clock()
                assert request['readyQpc'] == ready['qpc']
                assert request['qpcFrequency'] == frequency.value
                assert request['performanceBeforeWriteAt'] >= request['performanceSeenAt']
                assert acknowledged['qpc'] >= ready['qpc']
                lower = request['performanceBeforeWriteAt'] - acknowledged['qpc']*1000/frequency.value
                upper = math.nextafter(request['performanceSeenAt'] - ready['qpc']*1000/frequency.value, math.inf)
                assert lower <= upper
                clock_bridge = {**request, 'qpcAcknowledged': acknowledged['qpc'],
                                'offsetLowerMs': lower, 'offsetUpperMs': upper,
                                'offsetBracketWidthMs': upper-lower,
                                'method': 'QPC-to-Node-performance offset bounded by ready/read and write/ack ordering; no wall-clock conversion or deadline grace.'}
                accepted_pending=Path(str(bridge_accepted_path)+'.pending')
                with accepted_pending.open('x',encoding='utf-8',newline='\n') as stream:
                    stream.write(json.dumps(clock_bridge,separators=(',',':'))+'\n')
                os.rename(accepted_pending,bridge_accepted_path)
                log.write('clock_bridge_accepted',bridge=clock_bridge)
            if sample_start['qpc'] >= deadline_qpc:
                reason = 'HARD_OBSERVER_TIMEOUT'
                break
            if previous_sample_qpc is not None:
                maximum_gap_qpc = max(maximum_gap_qpc, sample_start['qpc'] - previous_sample_qpc)
            previous_sample_qpc = sample_start['qpc']
            entries, snapshot_error = snapshot()
            if snapshot_error:
                failures += 1
                log.write('snapshot_error', error=snapshot_error)
                entries = {}
            for row in list(rows.values()):
                wait_record(row, log)
            # Historical parent PIDs are admitted only with compatible object birth/exit times.
            # A candidate which races acquisition stays unknown and may be retried next sample.
            attempted = set()
            progress = True
            while progress:
                progress = False
                for pid, entry in entries.items():
                    if pid in attempted or any(k[0] == pid and r['signaledAt'] is None for k, r in rows.items()):
                        continue
                    parents = [r for r in rows.values() if r['identity']['pid'] == entry['parentPid']]
                    if not parents:
                        continue
                    attempted.add(pid)
                    child, error = acquire(pid)
                    if error:
                        failures += 1
                        log.write('candidate_identity_unknown', pid=pid, parentPid=entry['parentPid'], error=error)
                        continue
                    key = (pid, child['identity']['creationTime100ns'])
                    if key in rows:
                        release(child)
                        continue
                    born = key[1]
                    if (born > entry['snapshotTime100ns']
                            or Path(child['identity']['executable']).name.lower() != entry['imageName'].lower()):
                        failures += 1
                        log.write('candidate_snapshot_identity_race', identity=child['identity'], snapshotEntry=entry)
                        release(child)
                        continue
                    possible = [p for p in parents if p['identity']['creationTime100ns'] <= born
                                and (p['times']['exitTime100ns'] == 0 or born <= p['times']['exitTime100ns'])]
                    if len(possible) != 1:
                        log.write('candidate_ancestry_unproven', identity=child['identity'],
                                  parentPid=entry['parentPid'], compatibleKnownParents=len(possible))
                        release(child)
                        continue
                    parent = possible[0]
                    image = child['identity']['executable'].lower()
                    role = ('helper' if image == 'c:\\windows\\system32\\windowspowershell\\v1.0\\powershell.exe'
                            and parent['role'] == 'supervisor' else
                            'console_host' if image == 'c:\\windows\\system32\\conhost.exe'
                            and parent['role'] == 'helper' else 'other_descendant')
                    child.update(role=role, parentIdentity=parent['identity'], firstObservedAt=clock())
                    rows[key] = child
                    progress = True
                    log.write('process_discovered', identity=child['identity'], role=role,
                              parentIdentity=parent['identity'], snapshotEntry=entry,
                              metricAccessError=child['metricAccessError'])
            live = []
            for row in rows.values():
                if not wait_record(row, log):
                    entry = entries.get(row['identity']['pid'])
                    if entry:
                        row['lastSeenAt'] = sample_start
                    live.append(metrics(row, entry))
            sample_end = clock()
            overhead_qpc += sample_end['qpc'] - sample_start['qpc']
            sample_count += 1
            log.write('sample', sampleIndex=sample_count, started=sample_start, finished=sample_end,
                      snapshotSucceeded=snapshot_error is None, processes=live)
            if log.limit_reached:
                reason = 'OBSERVER_OUTPUT_BOUND'
                break
            if args.stop_file.exists():
                reason = 'STOP_FILE_OBSERVED'
                log.write('stop_file_observed')
                break
            remaining = (deadline_qpc - clock()['qpc']) / frequency.value
            if remaining > 0:
                time.sleep(min(args.interval_ms / 1000.0, remaining))
        return 0 if reason == 'STOP_FILE_OBSERVED' else 2
    except Exception as exc:
        log.write('observer_exception', exceptionType=type(exc).__name__, message=str(exc))
        return 2
    finally:
        for row in rows.values():
            wait_record(row, log)
        lifetimes = [{'identity': r['identity'], 'role': r['role'], 'parentIdentity': r['parentIdentity'],
                      'firstObservedAt': r['firstObservedAt'], 'lastSeenAt': r['lastSeenAt'],
                      'signaledAt': r['signaledAt'], 'nativeTimes': r['times']} for r in rows.values()]
        log.write('observer_final', final=True, reason=reason, qpcFrequency=frequency.value,
                  started=start, clockBridge=clock_bridge, sampleCount=sample_count, maximumSampleGapMs=1000 * maximum_gap_qpc / frequency.value,
                  samplingOverheadMs=1000 * overhead_qpc / frequency.value, identityOrSnapshotFailures=failures,
                  lifetimes=lifetimes,
                  allObservedObjectsSignaled=bool(rows) and all(r['signaledAt'] is not None for r in rows.values()),
                  observedHelperAndConsoleObjectsSignaled=all(
                      r['signaledAt'] is not None for r in rows.values() if r['role'] in ('helper', 'console_host')),
                  observedHelperCount=sum(r['role'] == 'helper' for r in rows.values()),
                  observedConsoleHostCount=sum(r['role'] == 'console_host' for r in rows.values()),
                  completeDescendantCoverageEstablished=False,
                  productCleanupFlagModified=False, processTerminationPerformed=False,
                  recordedBytesBeforeFinal=log.byte_count, recordedRecordsBeforeFinal=log.records)
        for row in rows.values():
            release(row)
        log.close()


if __name__ == '__main__':
    raise SystemExit(main())



