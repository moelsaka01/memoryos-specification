"""External Windows process-tree/RSS observer using monotonic time and Win32 APIs."""
import ctypes as C
from ctypes import wintypes as W
import time,subprocess,threading
K=C.WinDLL('kernel32',use_last_error=True);P=C.WinDLL('psapi',use_last_error=True)
class Entry(C.Structure):
 _fields_=[('dwSize',W.DWORD),('cntUsage',W.DWORD),('pid',W.DWORD),('heap',C.c_size_t),('module',W.DWORD),('threads',W.DWORD),('parent',W.DWORD),('priority',W.LONG),('flags',W.DWORD),('name',W.WCHAR*260)]
class Memory(C.Structure):
 _fields_=[('cb',W.DWORD),('faults',W.DWORD),('peak',C.c_size_t),('working',C.c_size_t),('pagedPeak',C.c_size_t),('paged',C.c_size_t),('nonPagedPeak',C.c_size_t),('nonPaged',C.c_size_t),('pagefile',C.c_size_t),('pagefilePeak',C.c_size_t)]
K.CreateToolhelp32Snapshot.argtypes=[W.DWORD,W.DWORD];K.CreateToolhelp32Snapshot.restype=W.HANDLE
K.Process32FirstW.argtypes=[W.HANDLE,C.POINTER(Entry)];K.Process32NextW.argtypes=[W.HANDLE,C.POINTER(Entry)]
K.OpenProcess.argtypes=[W.DWORD,W.BOOL,W.DWORD];K.OpenProcess.restype=W.HANDLE
K.CloseHandle.argtypes=[W.HANDLE];P.GetProcessMemoryInfo.argtypes=[W.HANDLE,C.POINTER(Memory),W.DWORD]
def snapshot(root):
 handle=K.CreateToolhelp32Snapshot(2,0)
 if handle==C.c_void_p(-1).value:raise C.WinError(C.get_last_error())
 entries={};entry=Entry();entry.dwSize=C.sizeof(entry)
 try:
  valid=K.Process32FirstW(handle,C.byref(entry))
  while valid:
   entries[entry.pid]=(entry.parent,entry.name)
   valid=K.Process32NextW(handle,C.byref(entry))
 finally:K.CloseHandle(handle)
 selected={root}
 while True:
  extended=selected|{pid for pid,(parent,name) in entries.items() if parent in selected}
  if extended==selected:break
  selected=extended
 rows=[]
 for pid in sorted(selected):
  handle=K.OpenProcess(0x0400|0x0010,False,pid)
  if not handle:continue
  try:
   info=Memory();info.cb=C.sizeof(info)
   if P.GetProcessMemoryInfo(handle,C.byref(info),C.sizeof(info)):
    rows.append(dict(pid=pid,parent=entries.get(pid,(0,''))[0],name=entries.get(pid,(0,''))[1],rssBytes=info.working))
  finally:K.CloseHandle(handle)
 return rows
def execute(argv,cwd,env=None,timeout=80,interval=.05,creationflags=subprocess.CREATE_NO_WINDOW):
 start=time.perf_counter_ns()
 process=subprocess.Popen(argv,cwd=cwd,env=env,stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=creationflags)
 result={}
 def reader():
  out,err=process.communicate();result.update(stdout=out.decode('utf-8',errors='strict'),stderr=err.decode('utf-8',errors='strict'),exitCode=process.returncode)
 thread=threading.Thread(target=reader);thread.start()
 samples=[];overhead=0
 while thread.is_alive():
  now=time.perf_counter_ns()
  if (now-start)/1e9>timeout:
   process.kill();thread.join(3);raise TimeoutError('Bounded engineering command exceeded timeout')
  before=time.perf_counter_ns();rows=snapshot(process.pid);after=time.perf_counter_ns();overhead+=after-before
  samples.append(dict(elapsedMs=(before-start)//1000000,processes=rows,totalRssBytes=sum(r['rssBytes'] for r in rows)))
  time.sleep(interval)
 thread.join()
 elapsed=(time.perf_counter_ns()-start)//1000000
 gaps=[b['elapsedMs']-a['elapsedMs'] for a,b in zip(samples,samples[1:])]
 result.update(elapsedMs=elapsed,command=argv,observation=dict(clock='Python perf_counter_ns / Windows monotonic performance counter',sampleIntervalMs=round(interval*1000),sampleCount=len(samples),maximumGapMs=max(gaps,default=0),observerOverheadMs=overhead//1000000,peakAggregateRssBytes=max((s['totalRssBytes'] for s in samples),default=0),peakProcessCount=max((len(s['processes']) for s in samples),default=0),samples=samples))
 return result
