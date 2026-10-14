"""One owned engineering parent interruption; no helper or console termination."""
import ctypes,json,subprocess,sys,time,traceback
from ctypes import wintypes
from pathlib import Path
assert sys.platform=='win32'
node,parent_script,request_path,case_root=sys.argv[1:]
case_root=Path(case_root)
ready=case_root/'parent-ready.json'
result={'kind':'MO1307DetachedHelperParentInterruption','result':'FAIL','heldHelperHandle':False,'helperTerminatedByObserver':False,'consoleTerminatedByObserver':False,'externalTransportEofObservedAfterParentDeath':False,'independentHostIdentityProof':False,'limitations':['Parent death closes its pipe endpoints; no external stream-event observation is retained after that death.','Held helper exit is supplemental. Console proof and normal three-stream EOF belong to the separate normal native transport case.']}
kernel=ctypes.WinDLL('kernel32',use_last_error=True)
kernel.OpenProcess.argtypes=[wintypes.DWORD,wintypes.BOOL,wintypes.DWORD];kernel.OpenProcess.restype=wintypes.HANDLE
kernel.GetProcessId.argtypes=[wintypes.HANDLE];kernel.GetProcessId.restype=wintypes.DWORD
kernel.WaitForSingleObject.argtypes=[wintypes.HANDLE,wintypes.DWORD];kernel.WaitForSingleObject.restype=wintypes.DWORD
kernel.QueryFullProcessImageNameW.argtypes=[wintypes.HANDLE,wintypes.DWORD,wintypes.LPWSTR,ctypes.POINTER(wintypes.DWORD)];kernel.QueryFullProcessImageNameW.restype=wintypes.BOOL
kernel.GetProcessTimes.argtypes=[wintypes.HANDLE,ctypes.POINTER(wintypes.FILETIME),ctypes.POINTER(wintypes.FILETIME),ctypes.POINTER(wintypes.FILETIME),ctypes.POINTER(wintypes.FILETIME)];kernel.GetProcessTimes.restype=wintypes.BOOL
kernel.CloseHandle.argtypes=[wintypes.HANDLE];kernel.CloseHandle.restype=wintypes.BOOL
env={'SystemRoot':r'C:\Windows','WINDIR':r'C:\Windows'}
helper_handle=None
parent=None
begin=time.perf_counter()
try:
    with (case_root/'parent.stdout.data').open('xb') as out,(case_root/'parent.stderr.data').open('xb') as err:
        parent=subprocess.Popen([node,parent_script,request_path,str(ready),str(case_root/'helper.stdout.partial.data'),str(case_root/'helper.stderr.partial.data')],cwd=Path(parent_script).resolve().parents[4],env=env,stdin=subprocess.DEVNULL,stdout=out,stderr=err,creationflags=subprocess.CREATE_NO_WINDOW)
        result['ownedParentPid']=parent.pid
        while not ready.exists():
            if parent.poll() is not None: raise AssertionError('Engineering parent exited before helper readiness')
            if time.perf_counter()-begin>=4: raise AssertionError('Helper readiness not observed within finite4000ms engineering guard')
            time.sleep(.005)
        reported=json.loads(ready.read_text(encoding='utf-8'))
        assert reported['parentPid']==parent.pid and reported['stdinEofWithheld'] is True
        assert not Path(str(ready)+'.closed.json').exists(),'Helper closed before owned-parent interruption'
        helper_pid=reported['pid']
        helper_handle=kernel.OpenProcess(0x101000,False,helper_pid)
        if not helper_handle: raise ctypes.WinError(ctypes.get_last_error())
        result['heldHelperHandle']=True
        assert kernel.GetProcessId(helper_handle)==helper_pid
        assert kernel.WaitForSingleObject(helper_handle,0)==258,'Helper was not alive during object acquisition'
        image=ctypes.create_unicode_buffer(32768);capacity=wintypes.DWORD(len(image))
        if not kernel.QueryFullProcessImageNameW(helper_handle,0,image,ctypes.byref(capacity)): raise ctypes.WinError(ctypes.get_last_error())
        assert image.value.casefold()==reported['launch']['executable'].casefold()
        created,exited,kernel_time,user_time=(wintypes.FILETIME() for _ in range(4))
        if not kernel.GetProcessTimes(helper_handle,ctypes.byref(created),ctypes.byref(exited),ctypes.byref(kernel_time),ctypes.byref(user_time)): raise ctypes.WinError(ctypes.get_last_error())
        result['helperIdentity']={'pid':helper_pid,'image':image.value,'creationTime100ns':str((created.dwHighDateTime<<32)|created.dwLowDateTime),'access':0x101000}
        assert parent.poll() is None
        assert kernel.WaitForSingleObject(helper_handle,0)==258
        interrupted=time.perf_counter()
        result['interruptionAtMonotonicSeconds']=interrupted
        result['interruptionAction']='Popen.kill on retained owned engineering parent handle only'
        parent.kill()
        remaining_seconds=7-(time.perf_counter()-begin)
        assert remaining_seconds>0,'Supplemental absolute guard expired before parent wait'
        result['ownedParentExit']=parent.wait(timeout=min(2,remaining_seconds))
        remaining_ms=int(7000-(time.perf_counter()-begin)*1000)
        assert remaining_ms>0,'Supplemental absolute guard expired before helper wait'
        result['remainingHelperWaitMs']=remaining_ms
        disposition=kernel.WaitForSingleObject(helper_handle,remaining_ms)
        result['helperWaitResult']=int(disposition)
        result['helperSignaledAfterInterruptionMs']=(time.perf_counter()-interrupted)*1000
        result['helperWholeObservationElapsedMs']=(time.perf_counter()-begin)*1000
        result['finiteWaitMs']=7000
        result['waitScope']='One absolute7000ms supplemental guard starts before engineering parent launch; readiness,parent wait and helper wait all consume it. This is not a new product deadline or allowance.'
        assert disposition==0,'Held helper did not exit after owned-parent interruption'
        assert result['helperWholeObservationElapsedMs']<=7000,'Whole observation exceeded single absolute7000ms supplemental guard'
        result['result']='PASS'
except BaseException as error:
    result['failure']={'type':type(error).__name__,'message':str(error),'traceback':traceback.format_exc()}
finally:
    if parent is not None and parent.poll() is None:
        result['engineeringFinallyParentStop']=True
        parent.kill()
        try: parent.wait(timeout=2)
        except BaseException as error: result['engineeringParentStopError']=str(error)
    if helper_handle:
        result['helperSignalAtHandleRelease']=int(kernel.WaitForSingleObject(helper_handle,0))
        result['helperHandleClosed']=bool(kernel.CloseHandle(helper_handle))
    (case_root/'proof.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
sys.exit(0 if result['result']=='PASS' else 1)
