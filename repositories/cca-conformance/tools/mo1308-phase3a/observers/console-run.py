# MO-1308 Phase 3A harness launcher: runs one command in a chosen console/stdio/signal setting and reports what happened as one JSON
# object on stdout. Used for 3A-H9 (Ctrl-C and Ctrl-Break), 3A-H10 (closed stdio), 3A-L1 (code pages) and 3A-L2 (console, pipe, file,
# headless). It is started by the harness with a hidden console of its own, so a console control event reaches only the processes it
# starts. Harness only: the product never launches it (R37).
#   python console-run.py <spec.json>
# spec: {mode, exe, args, cwd, env, codePage, event, waitFile, waitTimeoutMs, timeoutMs, stdoutFile}
#   mode  console   child writes to this console; its text is read back from the screen buffer (stdout is then not a pipe)
#         pipe      child writes to a pipe (bytes captured); the console code page is set first when codePage is given
#         file      child's stdout and stderr are files (stdoutFile, stderrFile)
#         headless  DETACHED_PROCESS: no console at all, stdout and stderr piped
#         closed    DETACHED_PROCESS with no standard handles at all (stdin, stdout, stderr closed)
#         signal    like pipe, but waits for waitFile and then delivers `event` (C or BREAK) to the child; BREAK needs its own process group
import base64
import ctypes
import json
import msvcrt
import os
import subprocess
import sys
import time
from ctypes import wintypes

k32 = ctypes.WinDLL('kernel32', use_last_error=True)
spec = json.load(open(sys.argv[1], encoding='utf-8'))
DETACHED_PROCESS = 0x00000008
CREATE_NEW_PROCESS_GROUP = 0x00000200
CTRL_C_EVENT, CTRL_BREAK_EVENT = 0, 1

class COORD(ctypes.Structure):
    _fields_ = [('X', ctypes.c_short), ('Y', ctypes.c_short)]


class SMALL_RECT(ctypes.Structure):
    _fields_ = [('Left', ctypes.c_short), ('Top', ctypes.c_short), ('Right', ctypes.c_short), ('Bottom', ctypes.c_short)]


class CSBI(ctypes.Structure):
    _fields_ = [('size', COORD), ('cursor', COORD), ('attributes', wintypes.WORD), ('window', SMALL_RECT), ('maximumWindowSize', COORD)]


HANDLER = ctypes.WINFUNCTYPE(wintypes.BOOL, wintypes.DWORD)
# a handler routine (not the inheritable "ignore" flag): this process survives the event it sends, its children do not inherit the shield
_handler = HANDLER(lambda event: True)
k32.SetConsoleCtrlHandler(_handler, True)

env = dict(os.environ) if spec.get('inheritEnv') else {}
env.update({k: v for k, v in (spec.get('env') or {}).items()})
cmd = [spec['exe']] + list(spec.get('args', []))
started = time.time()
result = {'mode': spec['mode'], 'eventSent': None, 'timedOut': False}


def finish(**extra):
    result.update(extra)
    result['elapsedMs'] = int((time.time() - started) * 1000)
    print(json.dumps(result))
    sys.stdout.flush()


def b64(data):
    return base64.b64encode(data).decode('ascii')


if spec.get('codePage'):
    k32.SetConsoleOutputCP(spec['codePage'])
    k32.SetConsoleCP(spec['codePage'])
result['codePage'] = k32.GetConsoleOutputCP()

mode = spec['mode']
timeout = spec.get('timeoutMs', 120000) / 1000.0

if mode == 'closed':
    # CreateProcessW without a console and without inheriting any handle: the child has no stdin, stdout or stderr
    class STARTUPINFO(ctypes.Structure):
        _fields_ = [('cb', wintypes.DWORD), ('lpReserved', wintypes.LPWSTR), ('lpDesktop', wintypes.LPWSTR), ('lpTitle', wintypes.LPWSTR),
                    ('dwX', wintypes.DWORD), ('dwY', wintypes.DWORD), ('dwXSize', wintypes.DWORD), ('dwYSize', wintypes.DWORD),
                    ('dwXCountChars', wintypes.DWORD), ('dwYCountChars', wintypes.DWORD), ('dwFillAttribute', wintypes.DWORD),
                    ('dwFlags', wintypes.DWORD), ('wShowWindow', wintypes.WORD), ('cbReserved2', wintypes.WORD), ('lpReserved2', ctypes.c_void_p),
                    ('hStdInput', wintypes.HANDLE), ('hStdOutput', wintypes.HANDLE), ('hStdError', wintypes.HANDLE)]

    class PROCESS_INFORMATION(ctypes.Structure):
        _fields_ = [('hProcess', wintypes.HANDLE), ('hThread', wintypes.HANDLE), ('dwProcessId', wintypes.DWORD), ('dwThreadId', wintypes.DWORD)]

    k32.CreateProcessW.argtypes = [wintypes.LPCWSTR, wintypes.LPWSTR, wintypes.LPVOID, wintypes.LPVOID, wintypes.BOOL, wintypes.DWORD, wintypes.LPVOID, wintypes.LPCWSTR,
                                   ctypes.POINTER(STARTUPINFO), ctypes.POINTER(PROCESS_INFORMATION)]
    block = ''.join('%s=%s\0' % (k, v) for k, v in env.items()) + '\0'
    envbuf = ctypes.create_unicode_buffer(block, len(block))
    startup = STARTUPINFO(); startup.cb = ctypes.sizeof(STARTUPINFO)
    info = PROCESS_INFORMATION()
    line = subprocess.list2cmdline(cmd)
    ok = k32.CreateProcessW(None, ctypes.create_unicode_buffer(line), None, None, False, DETACHED_PROCESS | 0x400, envbuf, spec.get('cwd'), ctypes.byref(startup), ctypes.byref(info))
    if not ok:
        finish(error=ctypes.get_last_error()); sys.exit(0)
    wait = k32.WaitForSingleObject(info.hProcess, int(timeout * 1000))
    code = wintypes.DWORD()
    k32.GetExitCodeProcess(info.hProcess, ctypes.byref(code))
    if wait != 0:
        k32.TerminateProcess(info.hProcess, 99); result['timedOut'] = True
    finish(exitCode=code.value)
    sys.exit(0)

popen = {'cwd': spec.get('cwd'), 'env': env, 'stdin': subprocess.DEVNULL}
console_handle = None
if mode == 'console':
    k32.CreateFileW.restype = wintypes.HANDLE
    out_handle = k32.CreateFileW('CONOUT$', 0xC0000000, 3, None, 3, 0, None)
    in_handle = k32.CreateFileW('CONIN$', 0xC0000000, 3, None, 3, 0, None)
    console_handle = out_handle
    # a wide buffer, so that one line of output is one line of the screen buffer (best effort)
    k32.SetConsoleScreenBufferSize(out_handle, COORD(4000, 3000))
    popen['stdout'] = msvcrt.open_osfhandle(out_handle, os.O_WRONLY)
    popen['stderr'] = popen['stdout']
    popen['stdin'] = msvcrt.open_osfhandle(in_handle, os.O_RDONLY)
elif mode == 'file':
    popen['stdout'] = open(spec['stdoutFile'], 'wb')
    popen['stderr'] = open(spec['stderrFile'], 'wb')
elif mode == 'headless':
    popen['stdout'] = subprocess.PIPE; popen['stderr'] = subprocess.PIPE
    popen['creationflags'] = DETACHED_PROCESS
else:  # pipe, signal
    popen['stdout'] = subprocess.PIPE; popen['stderr'] = subprocess.PIPE
    if spec.get('event') == 'BREAK':
        popen['creationflags'] = CREATE_NEW_PROCESS_GROUP

child = subprocess.Popen(cmd, **popen)
result['pid'] = child.pid

if mode == 'signal':
    wait_file = spec.get('waitFile')
    end = time.time() + spec.get('waitTimeoutMs', 60000) / 1000.0
    while wait_file and not os.path.exists(wait_file) and time.time() < end and child.poll() is None:
        time.sleep(0.01)
    if child.poll() is None and (not wait_file or os.path.exists(wait_file)):
        if spec['event'] == 'BREAK':
            k32.GenerateConsoleCtrlEvent(CTRL_BREAK_EVENT, child.pid)
        else:
            k32.GenerateConsoleCtrlEvent(CTRL_C_EVENT, 0)
        result['eventSent'] = spec['event']

try:
    out, err = child.communicate(timeout=timeout) if mode in ('pipe', 'headless', 'signal') else (None, None)
    if mode not in ('pipe', 'headless', 'signal'):
        child.wait(timeout=timeout)
except subprocess.TimeoutExpired:
    child.kill(); result['timedOut'] = True
    out, err = child.communicate() if mode in ('pipe', 'headless', 'signal') else (None, None)

result['exitCode'] = child.returncode
if mode in ('pipe', 'headless', 'signal'):
    result['stdout'] = b64(out or b''); result['stderr'] = b64(err or b'')
if mode == 'file':
    popen['stdout'].close(); popen['stderr'].close()
if mode == 'console':
    info = CSBI()
    k32.GetConsoleScreenBufferInfo(console_handle, ctypes.byref(info))
    width = info.size.X
    lines = []
    for y in range(0, info.cursor.Y + 1):
        buffer = ctypes.create_unicode_buffer(width + 1)
        read = wintypes.DWORD()
        k32.ReadConsoleOutputCharacterW(console_handle, buffer, width, COORD(0, y), ctypes.byref(read))
        lines.append(buffer.value.rstrip())
    result['consoleWidth'] = width
    result['consoleText'] = '\n'.join(lines).rstrip('\n')
finish()
