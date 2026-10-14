"""Windows installed closure verification, including reparse points and named streams."""
import ctypes as C
from ctypes import wintypes as W
import sys,stat
from pathlib import Path
from package_verify import *
K=C.WinDLL('kernel32',use_last_error=True)
class Stream(C.Structure):_fields_=[('StreamSize',C.c_longlong),('cStreamName',W.WCHAR*296)]
K.FindFirstStreamW.argtypes=[W.LPCWSTR,C.c_int,C.POINTER(Stream),W.DWORD];K.FindFirstStreamW.restype=W.HANDLE
K.FindNextStreamW.argtypes=[W.HANDLE,C.POINTER(Stream)];K.FindClose.argtypes=[W.HANDLE]
def streams(path):
 data=Stream();h=K.FindFirstStreamW(str(path),0,C.byref(data),0)
 if h==C.c_void_p(-1).value:
  require(C.get_last_error()==38,'STREAM_ENUMERATION');return []
 try:
  result=[data.cStreamName]
  while K.FindNextStreamW(h,C.byref(data)):
   result.append(data.cStreamName);require(len(result)<=32,'STREAM_COUNT')
  require(C.get_last_error()==38,'STREAM_ENUMERATION');return result
 finally:K.FindClose(h)
def verify_windows_installed(root):
 root=Path(root);members={};folded=set()
 def walk(path,depth=0):
  require(depth<32 and len(folded)<20000,'INSTALL_BOUND')
  info=path.lstat();require(not info.st_file_attributes&0x400,'INSTALL_REPARSE')
  require(not stat.S_ISLNK(info.st_mode),'INSTALL_LINK')
  require(all(s=='::$DATA' for s in streams(path)),'INSTALL_ALTERNATE_DATA_STREAM')
  if stat.S_ISDIR(info.st_mode):
   for child in path.iterdir():
    name=safe(child.relative_to(root).as_posix());require(name.lower() not in folded,'INSTALL_CASE_COLLISION');folded.add(name.lower());walk(child,depth+1)
  else:
   require(stat.S_ISREG(info.st_mode) and info.st_nlink==1 and info.st_size<=16*1024*1024,'INSTALL_FILE')
   members[safe(path.relative_to(root).as_posix())]=path.read_bytes()
 require(root.is_dir(),'INSTALL_ROOT');walk(root);return verify_members(members)
