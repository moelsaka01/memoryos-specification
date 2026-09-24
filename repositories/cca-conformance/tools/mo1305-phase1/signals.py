"""Deliver a real Windows console CTRL_C to a dedicated hidden test console."""
from pathlib import Path
import ctypes,json,os,subprocess,sys,threading,time
if len(sys.argv)>1 and sys.argv[1]=='--send':
 k=ctypes.WinDLL('kernel32',use_last_error=True);k.FreeConsole()
 if not k.AttachConsole(int(sys.argv[2])):raise ctypes.WinError(ctypes.get_last_error())
 k.SetConsoleCtrlHandler(None,True)
 if not k.GenerateConsoleCtrlEvent(0,0):raise ctypes.WinError(ctypes.get_last_error())
 time.sleep(.2);k.FreeConsole();raise SystemExit(0)
ROOT=Path(__file__).resolve().parents[4];NODE=ROOT/'.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe';stage=Path((ROOT/'.cache/mo1305-resume/installed-path.txt').read_text())
clean={k:v for k,v in os.environ.items() if k.upper() in ['SYSTEMROOT','WINDIR','TEMP','TMP']}
info=subprocess.STARTUPINFO();info.dwFlags|=subprocess.STARTF_USESHOWWINDOW;info.wShowWindow=subprocess.SW_HIDE
child=subprocess.Popen([str(NODE),str(stage/'package/bin/memoryos-rest.mjs'),'--config',str(stage/'private/config.json')],env=clean,cwd=stage/'empty',stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.PIPE,creationflags=subprocess.CREATE_NEW_CONSOLE,startupinfo=info)
ready=threading.Event();logs=[]
def drain():
 for line in iter(child.stderr.readline,b''):
  logs.append(line)
  if b'"event":"startup"' in line:ready.set()
thread=threading.Thread(target=drain);thread.start()
try:
 assert ready.wait(15),'SIGNAL_START_TIMEOUT'
 began=time.perf_counter_ns();sender=subprocess.run([sys.executable,'-B',str(Path(__file__)),'--send',str(child.pid)],capture_output=True,env=clean,timeout=5)
 assert sender.returncode==0,sender.stderr
 assert child.wait(timeout=16)==0
 elapsed=(time.perf_counter_ns()-began)//1000000;thread.join(timeout=2);assert child.stdout.read()==b'';assert b'"event":"shutdown"' in b''.join(logs)
 record={'kind':'MemoryOSRESTWindowsSignalTest','state':'PASS','records':[{'id':'LIFECYCLE-Windows-CTRL-C-SIGINT','state':'PASS','elapsedMs':elapsed,'exitCode':child.returncode}],'sigterm':'Windows provides no native POSIX SIGTERM delivery. ChildProcess.kill(SIGTERM) forcibly terminates on Windows; it is not claimed as a delivered handler test. Dedicated supervisor EOF and invalid stdin are separately exercised.'}
 (ROOT/'.cache/mo1305-resource-review/signals.json').write_text(json.dumps(record,sort_keys=True,separators=(',',':')),encoding='utf-8');print(json.dumps(record))
finally:
 if child.poll() is None:child.stdin.close();child.wait(timeout=17)
