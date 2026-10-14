"""One actual optional-host boundary: same helper/argv, explicit new-console test mode."""
import json,subprocess,sys,time,traceback
from pathlib import Path
assert sys.platform=='win32'
launch_path,request_path,case_root=sys.argv[1:]
launch=json.loads(Path(launch_path).read_text(encoding='utf-8'))
case_root=Path(case_root)
result={'kind':'MO1307ActualOptionalConsoleBoundary','result':'FAIL','testOnlyLaunchMode':True,'productionLaunchClaim':False,'creationFlags':subprocess.CREATE_NEW_CONSOLE,'showWindow':0,'hostTerminationByObserver':False,'helperTerminationByObserver':False,'independentHostIdentityProof':False}
child=None
out=b'';err=b'';begin=time.perf_counter()
try:
    start=subprocess.STARTUPINFO()
    start.dwFlags|=subprocess.STARTF_USESHOWWINDOW
    start.wShowWindow=0
    child=subprocess.Popen([launch['executable'],*launch['args']],cwd=launch['options']['cwd'],env=launch['options']['env'],stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=subprocess.CREATE_NEW_CONSOLE,startupinfo=start)
    result['pid']=child.pid
    frame=Path(request_path).read_bytes()
    remaining=begin+5-time.perf_counter()
    if remaining<=0: raise subprocess.TimeoutExpired(child.args,5)
    out,err=child.communicate(frame,timeout=remaining)
    result['elapsedMs']=(time.perf_counter()-begin)*1000
    result['exit']=child.returncode
    result['processWaitCompleted']=True
    result['stdoutEof']=True;result['stderrEof']=True;result['stdinClosed']=child.stdin.closed
    assert child.returncode==0,'Unmodified helper failed under explicit optional-host launch'
    assert len(err)==0
    assert result['elapsedMs']<5000,'Whole helper lifecycle exceeded unchanged5000ms ceiling'
    result['result']='PASS'
except BaseException as error:
    if isinstance(error,subprocess.TimeoutExpired):
        if error.output is not None: out=error.output
        if error.stderr is not None: err=error.stderr
    result['failure']={'type':type(error).__name__,'message':str(error),'traceback':traceback.format_exc()}
finally:
    if child is not None and child.poll() is None:
        result['helperTerminationByObserver']=True
        result['cleanupAction']='Popen.kill exact owned validation-helper handle after failure; never a console host or PID sweep'
        cleanup=time.perf_counter()
        child.kill()
        try:
            cleanup_remaining=cleanup+2-time.perf_counter()
            if cleanup_remaining<=0: raise subprocess.TimeoutExpired(child.args,2)
            out,err=child.communicate(timeout=cleanup_remaining)
        except BaseException as error:
            if isinstance(error,subprocess.TimeoutExpired):
                if error.output is not None: out=error.output
                if error.stderr is not None: err=error.stderr
            result['cleanupFailure']=str(error)
        result['cleanupElapsedMs']=(time.perf_counter()-cleanup)*1000
    result['elapsedTotalMs']=(time.perf_counter()-begin)*1000
    if child is not None: result['exit']=child.returncode
    (case_root/'stdout.data').write_bytes(out)
    (case_root/'stderr.data').write_bytes(err)
    (case_root/'proof.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf-8')
sys.exit(0 if result['result']=='PASS' else 1)
