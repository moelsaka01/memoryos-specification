# MO-1308 Phase 3A harness observer: a census of one live process, for 3A-K1 to K3.
#   python proc.py <pid>
# Prints one JSON object: the process's open handle count, working-set and pagefile figures, and every descendant process (found with a
# Toolhelp snapshot: pid, parent, image name). The harness calls it while the product is stopped at its exit by the preload, so the
# numbers are those of a finished operation that has not yet released its resources. Read-only; harness only.
import ctypes
import json
import sys
from ctypes import wintypes

k32 = ctypes.WinDLL('kernel32', use_last_error=True)
psapi = ctypes.WinDLL('psapi', use_last_error=True)
pid = int(sys.argv[1])


class COUNTERS(ctypes.Structure):
    _fields_ = [('cb', wintypes.DWORD), ('PageFaultCount', wintypes.DWORD), ('PeakWorkingSetSize', ctypes.c_size_t), ('WorkingSetSize', ctypes.c_size_t),
                ('QuotaPeakPagedPoolUsage', ctypes.c_size_t), ('QuotaPagedPoolUsage', ctypes.c_size_t), ('QuotaPeakNonPagedPoolUsage', ctypes.c_size_t),
                ('QuotaNonPagedPoolUsage', ctypes.c_size_t), ('PagefileUsage', ctypes.c_size_t), ('PeakPagefileUsage', ctypes.c_size_t)]


class ENTRY(ctypes.Structure):
    _fields_ = [('dwSize', wintypes.DWORD), ('cntUsage', wintypes.DWORD), ('th32ProcessID', wintypes.DWORD), ('th32DefaultHeapID', ctypes.c_size_t),
                ('th32ModuleID', wintypes.DWORD), ('cntThreads', wintypes.DWORD), ('th32ParentProcessID', wintypes.DWORD), ('pcPriClassBase', ctypes.c_long),
                ('dwFlags', wintypes.DWORD), ('szExeFile', ctypes.c_wchar * 260)]


k32.OpenProcess.restype = wintypes.HANDLE
handle = k32.OpenProcess(0x1000 | 0x0010, False, pid)
out = {'pid': pid, 'opened': bool(handle)}
if handle:
    count = wintypes.DWORD()
    out['handleCount'] = count.value if not k32.GetProcessHandleCount(handle, ctypes.byref(count)) else count.value
    counters = COUNTERS(); counters.cb = ctypes.sizeof(COUNTERS)
    psapi.GetProcessMemoryInfo(handle, ctypes.byref(counters), counters.cb)
    out.update({'workingSetBytes': counters.WorkingSetSize, 'peakWorkingSetBytes': counters.PeakWorkingSetSize, 'pagefileBytes': counters.PagefileUsage, 'peakPagefileBytes': counters.PeakPagefileUsage})
    k32.CloseHandle(handle)

k32.CreateToolhelp32Snapshot.restype = wintypes.HANDLE
snapshot = k32.CreateToolhelp32Snapshot(0x2, 0)
rows = []
entry = ENTRY(); entry.dwSize = ctypes.sizeof(ENTRY)
ok = k32.Process32FirstW(snapshot, ctypes.byref(entry))
while ok:
    rows.append((entry.th32ProcessID, entry.th32ParentProcessID, entry.szExeFile))
    ok = k32.Process32NextW(snapshot, ctypes.byref(entry))
k32.CloseHandle(snapshot)
descendants = []
frontier = {pid}
while frontier:
    found = {row for row in rows if row[1] in frontier and row[0] not in {item[0] for item in descendants} and row[0] != pid}
    descendants.extend(sorted(found))
    frontier = {row[0] for row in found}
out['descendants'] = [{'pid': row[0], 'parent': row[1], 'image': row[2]} for row in descendants]
print(json.dumps(out))
