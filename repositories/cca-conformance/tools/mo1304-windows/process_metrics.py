"""Read-only Windows working-set/thread sampler, outside product process."""
import ctypes as C
from ctypes import wintypes as W
import json,sys
K=C.WinDLL('kernel32',use_last_error=True);P=C.WinDLL('psapi',use_last_error=True)
class Memory(C.Structure):
 _fields_=[('cb',W.DWORD),('PageFaultCount',W.DWORD)]+[(k,C.c_size_t) for k in ['PeakWorkingSetSize','WorkingSetSize','QuotaPeakPagedPoolUsage','QuotaPagedPoolUsage','QuotaPeakNonPagedPoolUsage','QuotaNonPagedPoolUsage','PagefileUsage','PeakPagefileUsage','PrivateUsage']]
class Thread(C.Structure):_fields_=[('dwSize',W.DWORD),('cntUsage',W.DWORD),('th32ThreadID',W.DWORD),('th32OwnerProcessID',W.DWORD),('tpBasePri',W.LONG),('tpDeltaPri',W.LONG),('dwFlags',W.DWORD)]
K.OpenProcess.argtypes=[W.DWORD,W.BOOL,W.DWORD];K.OpenProcess.restype=W.HANDLE
K.CloseHandle.argtypes=[W.HANDLE];P.GetProcessMemoryInfo.argtypes=[W.HANDLE,C.POINTER(Memory),W.DWORD]
K.CreateToolhelp32Snapshot.argtypes=[W.DWORD,W.DWORD];K.CreateToolhelp32Snapshot.restype=W.HANDLE
K.Thread32First.argtypes=[W.HANDLE,C.POINTER(Thread)];K.Thread32Next.argtypes=[W.HANDLE,C.POINTER(Thread)]
for line in sys.stdin:
 try:
  r=json.loads(line);h=K.OpenProcess(0x410,False,r['pid'])
  if not h:raise C.WinError(C.get_last_error())
  try:
   m=Memory();m.cb=C.sizeof(m)
   if not P.GetProcessMemoryInfo(h,C.byref(m),m.cb):raise C.WinError(C.get_last_error())
   result={'rss':m.WorkingSetSize}
  finally:K.CloseHandle(h)
  if r.get('threads'):
   snap=K.CreateToolhelp32Snapshot(4,0)
   if snap==C.c_void_p(-1).value:raise C.WinError(C.get_last_error())
   try:
    t=Thread();t.dwSize=C.sizeof(t);ok=K.Thread32First(snap,C.byref(t));n=0
    while ok:
     if t.th32OwnerProcessID==r['pid']:n+=1
     ok=K.Thread32Next(snap,C.byref(t))
    result['threads']=n
   finally:K.CloseHandle(snap)
  print(json.dumps({'id':r['id'],**result}),flush=True)
 except Exception as e:print(json.dumps({'id':r.get('id'),'error':str(e)}),flush=True)
