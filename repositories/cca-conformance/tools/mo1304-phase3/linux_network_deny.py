"""Rootless Linux seccomp denial inherited by the certification process tree.

Only this process and its descendants are affected; SSH management is outside
the filter. Existing pipes and AF_UNIX socketpair-based child IPC are preserved.
"""
import ctypes
import errno
import os
import platform
import sys

if platform.system() != "Linux" or platform.machine() != "x86_64":
    raise SystemExit("UNSUPPORTED_SECCOMP_PLATFORM")
lib = ctypes.CDLL("libseccomp.so.2", use_errno=True)
lib.seccomp_init.argtypes = [ctypes.c_uint32]
lib.seccomp_init.restype = ctypes.c_void_p
lib.seccomp_syscall_resolve_name.argtypes = [ctypes.c_char_p]
lib.seccomp_syscall_resolve_name.restype = ctypes.c_int
lib.seccomp_rule_add.argtypes = [ctypes.c_void_p, ctypes.c_uint32, ctypes.c_int, ctypes.c_uint]
lib.seccomp_load.argtypes = [ctypes.c_void_p]
lib.seccomp_release.argtypes = [ctypes.c_void_p]
ctx = lib.seccomp_init(0x7FFF0000)  # SCMP_ACT_ALLOW; deny rules are explicit below.
if not ctx:
    raise SystemExit("SECCOMP_INIT_FAILED")
try:
    # io_uring is denied so asynchronous socket operations cannot bypass rules.
    for name in ["socket", "connect", "bind", "listen", "accept", "accept4", "sendto", "sendmmsg", "io_uring_setup"]:
        number = lib.seccomp_syscall_resolve_name(name.encode("ascii"))
        if number < 0 or lib.seccomp_rule_add(ctx, 0x00050000 | errno.EPERM, number, 0) != 0:
            raise SystemExit("SECCOMP_RULE_FAILED:" + name)
    if lib.seccomp_load(ctx) != 0:
        raise SystemExit("SECCOMP_LOAD_FAILED")
finally:
    lib.seccomp_release(ctx)
if len(sys.argv) < 2 or not os.path.isabs(sys.argv[1]):
    raise SystemExit("ABSOLUTE_EXECUTABLE_REQUIRED")
os.execv(sys.argv[1], sys.argv[1:])
