# MO-1308 Phase 3A harness observer: the NTFS file index of each path argument, read with CreateFile + GetFileInformationByHandle
# (no Node stat involved). Opens each name without following a reparse point. Prints one JSON array. Harness-launched only.
import ctypes
import json
import sys
from ctypes import wintypes

k32 = ctypes.WinDLL('kernel32', use_last_error=True)


class FILETIME(ctypes.Structure):
    _fields_ = [('lo', wintypes.DWORD), ('hi', wintypes.DWORD)]


class INFO(ctypes.Structure):
    _fields_ = [('attributes', wintypes.DWORD), ('created', FILETIME), ('accessed', FILETIME), ('written', FILETIME),
                ('volumeSerial', wintypes.DWORD), ('sizeHigh', wintypes.DWORD), ('sizeLow', wintypes.DWORD),
                ('links', wintypes.DWORD), ('indexHigh', wintypes.DWORD), ('indexLow', wintypes.DWORD)]


k32.CreateFileW.restype = wintypes.HANDLE
k32.CreateFileW.argtypes = [wintypes.LPCWSTR, wintypes.DWORD, wintypes.DWORD, wintypes.LPVOID, wintypes.DWORD, wintypes.DWORD, wintypes.HANDLE]
k32.GetFileInformationByHandle.argtypes = [wintypes.HANDLE, ctypes.POINTER(INFO)]
k32.CloseHandle.argtypes = [wintypes.HANDLE]
INVALID = wintypes.HANDLE(-1).value
FILE_SHARE_ALL = 7
OPEN_EXISTING = 3
BACKUP_AND_NO_FOLLOW = 0x02000000 | 0x00200000

rows = []
for path in sys.argv[1:]:
    handle = k32.CreateFileW(path, 0, FILE_SHARE_ALL, None, OPEN_EXISTING, BACKUP_AND_NO_FOLLOW, None)
    if handle in (None, INVALID):
        rows.append({'path': path, 'error': ctypes.get_last_error()})
        continue
    info = INFO()
    ok = k32.GetFileInformationByHandle(handle, ctypes.byref(info))
    k32.CloseHandle(handle)
    if not ok:
        rows.append({'path': path, 'error': ctypes.get_last_error()})
        continue
    rows.append({
        'path': path, 'attributes': info.attributes, 'reparse': bool(info.attributes & 0x400), 'directory': bool(info.attributes & 0x10),
        'volumeSerial': info.volumeSerial, 'links': info.links, 'size': (info.sizeHigh << 32) | info.sizeLow,
        'fileIndex': str((info.indexHigh << 32) | info.indexLow),
    })
print(json.dumps(rows))
