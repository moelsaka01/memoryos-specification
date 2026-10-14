"""External Windows process accounting; never loaded into the measured process."""
import ctypes as c, ctypes.wintypes as w, json,sys,time,queue,threading,os
from pathlib import Path
class Memory(c.Structure):
 _fields_=[('cb',w.DWORD),('PageFaultCount',w.DWORD)]+[(name,c.c_size_t) for name in ['PeakWorkingSetSize','WorkingSetSize','QuotaPeakPagedPoolUsage','QuotaPagedPoolUsage','QuotaPeakNonPagedPoolUsage','QuotaNonPagedPoolUsage','PagefileUsage','PeakPagefileUsage','PrivateUsage']]
class Thread(c.Structure):
 _fields_=[('dwSize',w.DWORD),('cntUsage',w.DWORD),('th32ThreadID',w.DWORD),('th32OwnerProcessID',w.DWORD),('tpBasePri',w.LONG),('tpDeltaPri',w.LONG),('dwFlags',w.DWORD)]
k=c.WinDLL('kernel32',use_last_error=True);p=c.WinDLL('psapi',use_last_error=True)
k.OpenProcess.argtypes=[w.DWORD,w.BOOL,w.DWORD];k.OpenProcess.restype=w.HANDLE
k.CloseHandle.argtypes=[w.HANDLE];k.GetExitCodeProcess.argtypes=[w.HANDLE,c.POINTER(w.DWORD)]
k.GetProcessHandleCount.argtypes=[w.HANDLE,c.POINTER(w.DWORD)]
k.GetProcessTimes.argtypes=[w.HANDLE,c.POINTER(w.FILETIME),c.POINTER(w.FILETIME),c.POINTER(w.FILETIME),c.POINTER(w.FILETIME)]
k.CreateToolhelp32Snapshot.argtypes=[w.DWORD,w.DWORD];k.CreateToolhelp32Snapshot.restype=w.HANDLE
k.Thread32First.argtypes=[w.HANDLE,c.POINTER(Thread)];k.Thread32Next.argtypes=[w.HANDLE,c.POINTER(Thread)]
p.GetProcessMemoryInfo.argtypes=[w.HANDLE,c.POINTER(Memory),w.DWORD]
pid=int(sys.argv[1]);handle=k.OpenProcess(0x0410,False,pid)
if not handle:raise c.WinError(c.get_last_error())
created,exited,kernel,user=w.FILETIME(),w.FILETIME(),w.FILETIME(),w.FILETIME()
if not k.GetProcessTimes(handle,c.byref(created),c.byref(exited),c.byref(kernel),c.byref(user)):raise c.WinError(c.get_last_error())
process_started_ms=((created.dwHighDateTime<<32)+created.dwLowDateTime-116444736000000000)//10000
session_id=sys.argv[sys.argv.index('--session')+1] if '--session' in sys.argv else None
identity=json.loads(sys.argv[sys.argv.index('--identity')+1])
assert identity['sessionId']==session_id
metadata={**identity,'protocolVersion':'2.0.0','monoDomain':'MONOTONIC_COLLECTOR:'+session_id,'pid':pid,'processStartedUtcMs':process_started_ms}
requests=queue.SimpleQueue()
def commands():
 for line in sys.stdin:
  parts=line.strip().split()
  if len(parts)!=2 or parts[0]!='CAPTURE':raise ValueError('BAD_CAPTURE_COMMAND')
  requests.put(int(parts[1]))
threading.Thread(target=commands,daemon=True).start()
ticket=0
journal=Path(sys.argv[2]+'.jsonl').open('x',encoding='utf-8',buffering=1)
journal.write(json.dumps(metadata,sort_keys=True,separators=(',',':'))+'\n')
rows=[]
stream='--stream' in sys.argv
if stream:print('READY',flush=True)
try:
 while len(rows)<200000:
  exit_code=w.DWORD();k.GetExitCodeProcess(handle,c.byref(exit_code))
  if exit_code.value!=259:break
  while not requests.empty():ticket=max(ticket,requests.get_nowait())
  capture_ns=time.perf_counter_ns()
  capture_utc_ms=time.time_ns()//1000000
  m=Memory();m.cb=c.sizeof(m)
  if not p.GetProcessMemoryInfo(handle,c.byref(m),m.cb):raise c.WinError(c.get_last_error())
  handles=w.DWORD();k.GetProcessHandleCount(handle,c.byref(handles))
  snapshot=k.CreateToolhelp32Snapshot(4,0);thread=Thread();thread.dwSize=c.sizeof(thread);count=0
  more=k.Thread32First(snapshot,c.byref(thread))
  while more:
   if thread.th32OwnerProcessID==pid:count+=1
   more=k.Thread32Next(snapshot,c.byref(thread))
  k.CloseHandle(snapshot)
  rows.append(dict(**metadata,ticket=ticket,sequence=len(rows)+1,persistedSequence=len(rows)+1,captureNs=str(capture_ns),completedNs=str(time.perf_counter_ns()),captureUtcMs=capture_utc_ms,utcMs=time.time_ns()//1000000,handles=handles.value,threads=count,**{name:getattr(m,name) for name,_ in m._fields_}))
  encoded=json.dumps(rows[-1],sort_keys=True,separators=(',',':'));journal.write(encoded+'\n');journal.flush();os.fsync(journal.fileno())
  if stream:print(encoded,flush=True)
  time.sleep(.02)
finally:
 journal.close()
 k.CloseHandle(handle)
 Path(sys.argv[2]).write_text(json.dumps({**metadata,'intervalMs':20,'source':'GetProcessMemoryInfo PROCESS_MEMORY_COUNTERS_EX + Toolhelp32 thread snapshot + GetProcessHandleCount','records':rows},sort_keys=True,separators=(',',':')),encoding='utf-8')
