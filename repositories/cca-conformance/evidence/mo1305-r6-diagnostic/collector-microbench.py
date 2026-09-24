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

import subprocess,statistics,uuid
OUT=Path('.cache/mo1305-r6-diagnostic');node=str(Path('.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe').resolve())
child=subprocess.Popen([node,'-e','setInterval(()=>{},1000)'],stdin=subprocess.DEVNULL,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=0x08000000)
handle=k.OpenProcess(0x0410,False,child.pid);assert handle
rows=[];journal=(OUT/'collector-microbench.journal').open('x',encoding='utf-8');raw=(OUT/'collector-microbench-io.jsonl').open('x',encoding='utf-8')
def stamp():return time.perf_counter_ns()
def call(name,fn,steps):
 start=stamp();result=fn();end=stamp();steps.append({'name':name,'startNs':str(start),'endNs':str(end),'durationNs':str(end-start)});return result
try:
 for index in range(20):
  steps=[];capture=stamp();m=Memory();m.cb=c.sizeof(m);handles=w.DWORD()
  assert call('GetProcessMemoryInfo',lambda:p.GetProcessMemoryInfo(handle,c.byref(m),m.cb),steps)
  assert call('GetProcessHandleCount',lambda:k.GetProcessHandleCount(handle,c.byref(handles)),steps)
  snapshot=call('CreateToolhelp32Snapshot',lambda:k.CreateToolhelp32Snapshot(4,0),steps);thread=Thread();thread.dwSize=c.sizeof(thread)
  more=call('Thread32First',lambda:k.Thread32First(snapshot,c.byref(thread)),steps);count=0;target=0;nextTotal=0;nextMax=0;loopStart=stamp()
  while more:
   count+=1;target+=thread.th32OwnerProcessID==child.pid;a=stamp();more=k.Thread32Next(snapshot,c.byref(thread));b=stamp();nextTotal+=b-a;nextMax=max(nextMax,b-a)
  loopEnd=stamp();steps.append({'name':'Thread32Next_loop','startNs':str(loopStart),'endNs':str(loopEnd),'durationNs':str(loopEnd-loopStart),'calls':count,'nativeCallsNs':str(nextTotal),'maximumCallNs':str(nextMax)})
  call('CloseHandle_snapshot',lambda:k.CloseHandle(snapshot),steps);end=stamp()
  row={'index':index,'domain':'MONOTONIC_COLLECTOR_MICROBENCH:'+str(os.getpid()),'captureStartNs':str(capture),'captureEndNs':str(end),'captureNs':str(end-capture),'globalThreads':count,'targetThreads':target,'steps':steps};rows.append(row)
  a=stamp();encoded=json.dumps(row,separators=(',',':'));b=stamp();raw.write(encoded+'\n');d=stamp();raw.flush();e=stamp();os.fsync(raw.fileno());f=stamp()
  row['ioNs']={'encode':str(b-a),'write':str(d-b),'flush':str(e-d),'fsync':str(f-e)};journal.write(json.dumps(row)+'\n');journal.flush();print(json.dumps({'index':index,'captureMs':(end-capture)/1e6,'threads':count}),flush=True)
  if end-capture>1000000000:break
  time.sleep(.02)
 durations=sorted(int(r['captureNs'])/1e6 for r in rows);result={'kind':'DiagnosticCollectorMicrobenchmark','certification':False,'count':len(rows),'maximumCaptures':20,'stopRule':'Stop early if one capture exceeds 1000 ms; outer watchdog 300 s','minMs':min(durations),'medianMs':statistics.median(durations),'p95MsNearestRank':durations[max(0,__import__('math').ceil(.95*len(durations))-1)] if len(durations)>=20 else None,'maxMs':max(durations),'p95Interpretation':'Descriptive only; 20 observations do not establish a population tail estimate.','rows':rows}
 (OUT/'collector-microbench.json').write_text(json.dumps(result,separators=(',',':')),encoding='utf-8')
finally:
 journal.close();raw.close();k.CloseHandle(handle);child.terminate();child.wait(timeout=10)
