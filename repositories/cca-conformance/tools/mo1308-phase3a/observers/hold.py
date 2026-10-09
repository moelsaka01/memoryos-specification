# MO-1308 Phase 3A harness observer: holds one file open with a chosen sharing mode until told to release.
#   python hold.py <path> <share>     share: none | read | write | all   (all = read+write+delete)
#   python hold.py <path> pending     read+write+delete sharing, and the file is marked delete-pending with the classic
#                                     (non-POSIX) disposition: the name stays on the volume until this handle closes
# Prints READY when the handle is open (and the disposition is set), then waits for a line on stdin (or end of input) and closes
# the handle. The delete-pending mode is the state of 3A-E6 (Q02, hypothesis 2). Harness only.
import ctypes
import sys
from ctypes import wintypes

k32 = ctypes.WinDLL('kernel32', use_last_error=True)
k32.CreateFileW.restype = wintypes.HANDLE
k32.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, wintypes.LPVOID, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
k32.CloseHandle.argtypes = [wintypes.HANDLE]
k32.SetFileInformationByHandle.argtypes = [wintypes.HANDLE, ctypes.c_int, wintypes.LPVOID, wintypes.DWORD]
INVALID = wintypes.HANDLE(-1).value

SHARE = {'none': 0, 'read': 1, 'write': 2, 'all': 7, 'pending': 7}
GENERIC_READ = 0x80000000
DELETE = 0x00010000
OPEN_EXISTING = 3
BACKUP_SEMANTICS = 0x02000000
FILE_DISPOSITION_INFO = 4

path, share = sys.argv[1], sys.argv[2]
access = GENERIC_READ | (DELETE if share == 'pending' else 0)
handle = k32.CreateFileW(path, access, SHARE[share], None, OPEN_EXISTING, BACKUP_SEMANTICS, None)
if handle in (None, INVALID):
    print('ERROR %d' % ctypes.get_last_error(), flush=True)
    sys.exit(3)
if share == 'pending':
    flag = wintypes.BOOL(True)
    if not k32.SetFileInformationByHandle(handle, FILE_DISPOSITION_INFO, ctypes.byref(flag), ctypes.sizeof(flag)):
        print('ERROR %d' % ctypes.get_last_error(), flush=True)
        sys.exit(4)
print('READY', flush=True)
sys.stdin.readline()
k32.CloseHandle(handle)
