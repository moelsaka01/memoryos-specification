# MO-1308 Phase 3A harness observer: host identity and configuration for 3A-A1 and 3A-A6, read without PowerShell where possible.
#   python hostcapture.py <directory-on-the-volume-to-describe>
# Prints one JSON object: Windows build and revision, the volume (file system name, serial, flags, free space), registry settings
# (LongPathsEnabled, NtfsDisable8dot3NameCreation), whether a long name gets an 8.3 alias on that volume, and the Smart App
# Control and Defender settings that are readable without elevation. Harness-launched only; the product never runs it.
import ctypes
import json
import os
import sys
import tempfile
import winreg
from ctypes import wintypes

k32 = ctypes.WinDLL('kernel32', use_last_error=True)
target = os.path.abspath(sys.argv[1])
root = os.path.splitdrive(target)[0] + '\\'

name_buffer = ctypes.create_unicode_buffer(261)
fs_buffer = ctypes.create_unicode_buffer(261)
serial = wintypes.DWORD()
max_component = wintypes.DWORD()
flags = wintypes.DWORD()
ok = k32.GetVolumeInformationW(root, name_buffer, 261, ctypes.byref(serial), ctypes.byref(max_component), ctypes.byref(flags), fs_buffer, 261)
volume = {'root': root, 'ok': bool(ok), 'fileSystem': fs_buffer.value, 'serial': '%08X' % serial.value, 'flags': flags.value, 'maxComponentLength': max_component.value}
free = ctypes.c_ulonglong(); total = ctypes.c_ulonglong(); avail = ctypes.c_ulonglong()
k32.GetDiskFreeSpaceExW(root, ctypes.byref(avail), ctypes.byref(total), ctypes.byref(free))
volume.update({'totalBytes': total.value, 'freeBytes': free.value, 'availableToUserBytes': avail.value})


def registry(hive, path, value):
    try:
        with winreg.OpenKey(hive, path) as key:
            return winreg.QueryValueEx(key, value)[0]
    except OSError:
        return None


version = {
    'productName': registry(winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Microsoft\Windows NT\CurrentVersion', 'ProductName'),
    'displayVersion': registry(winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Microsoft\Windows NT\CurrentVersion', 'DisplayVersion'),
    'currentBuild': registry(winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Microsoft\Windows NT\CurrentVersion', 'CurrentBuildNumber'),
    'ubr': registry(winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Microsoft\Windows NT\CurrentVersion', 'UBR'),
    'buildLab': registry(winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Microsoft\Windows NT\CurrentVersion', 'BuildLabEx'),
}
filesystem = {
    'LongPathsEnabled': registry(winreg.HKEY_LOCAL_MACHINE, r'SYSTEM\CurrentControlSet\Control\FileSystem', 'LongPathsEnabled'),
    'NtfsDisable8dot3NameCreation': registry(winreg.HKEY_LOCAL_MACHINE, r'SYSTEM\CurrentControlSet\Control\FileSystem', 'NtfsDisable8dot3NameCreation'),
}
security = {
    'VerifiedAndReputablePolicyState': registry(winreg.HKEY_LOCAL_MACHINE, r'SYSTEM\CurrentControlSet\Control\CI\Policy', 'VerifiedAndReputablePolicyState'),
    'developerModeAllowDevelopmentWithoutDevLicense': registry(winreg.HKEY_LOCAL_MACHINE, r'SOFTWARE\Microsoft\Windows\CurrentVersion\AppModelUnlock', 'AllowDevelopmentWithoutDevLicense'),
}

# Does a long name created on this volume (inside `target`) get an 8.3 alias?
short = None
try:
    probe_dir = tempfile.mkdtemp(prefix='p3a-8dot3-', dir=target)
    long_name = os.path.join(probe_dir, 'ALongDirectoryNameThatNeedsAShortAlias')
    os.mkdir(long_name)
    buffer = ctypes.create_unicode_buffer(1024)
    k32.GetShortPathNameW(long_name, buffer, 1024)
    short = {'alias': buffer.value != long_name and buffer.value.lower() != long_name.lower(), 'shortName': os.path.basename(buffer.value)}
    os.rmdir(long_name)
    os.rmdir(probe_dir)
except OSError as error:
    short = {'error': str(error)}

print(json.dumps({'volume': volume, 'version': version, 'fileSystemSettings': filesystem, 'security': security, 'shortNames': short,
                  'python': sys.version.split()[0], 'processorCount': os.cpu_count()}))
