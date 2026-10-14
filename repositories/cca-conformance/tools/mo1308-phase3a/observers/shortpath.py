# MO-1308 Phase 3A harness observer: the 8.3 short form of a path (GetShortPathNameW), for 3A-D8. Prints {"short": ...}.
import ctypes
import json
import sys

buffer = ctypes.create_unicode_buffer(32768)
length = ctypes.WinDLL('kernel32', use_last_error=True).GetShortPathNameW(sys.argv[1], buffer, 32768)
print(json.dumps({'short': buffer.value if length else None}))
