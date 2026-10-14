"""Supplemental raw-archive and Windows installed-filesystem attack witnesses."""
import io,json,tarfile,gzip,tempfile,shutil,os,sys,subprocess
from pathlib import Path
from windows_package import archive_members,verify_archive,verify_windows_installed as verify_installed,canonical,identity
root=Path(sys.argv[1]);output=Path(sys.argv[2]);base=root.parents[2]
assert os.environ['MO1304_CERT_ROOT'] in str(base) and base.name.startswith('windows-')
records=[]
def check(name,fn,reject=True):
 try: fn()
 except (ValueError,KeyError,UnicodeError,AssertionError,FileNotFoundError):
  if not reject:raise
 else:
  if reject:raise AssertionError('ATTACK_ACCEPTED:'+name)
 records.append({'id':name,'status':'PASS','expected':'reject' if reject else 'accept'})
def tar(entries):
 stream=io.BytesIO()
 with tarfile.open(fileobj=stream,mode='w',format=tarfile.USTAR_FORMAT) as t:
  for name,kind,mode,link,data in entries:
   h=tarfile.TarInfo(name);h.type=kind;h.mode=mode;h.linkname=link;h.size=len(data)
   t.addfile(h,io.BytesIO(data))
 return gzip.compress(stream.getvalue(),mtime=0)
def entry(name='package/a',kind=tarfile.REGTYPE,mode=0o644,link='',data=b'x'):return (name,kind,mode,link,data)
check('ordinary-raw-member',lambda:archive_members(tar([entry()])),False)
for label,entries in [
 ('traversal',[entry('package/../outside')]),('absolute',[entry('/etc/passwd')]),('wrong-root',[entry('else/a')]),
 ('symlink',[entry(kind=tarfile.SYMTYPE,link='../outside')]),('hardlink',[entry(kind=tarfile.LNKTYPE,link='package/a')]),
 ('fifo',[entry(kind=tarfile.FIFOTYPE)]),('device',[entry(kind=tarfile.CHRTYPE)]),('directory-type',[entry(kind=tarfile.DIRTYPE)]),
 ('wrong-mode',[entry(mode=0o777)]),('duplicate',[entry(),entry()]),('case-collision',[entry('package/A'),entry('package/a')]),
 ('ads-name',[entry('package/a:stream')]),('backslash',[entry('package/a\\b')]),('device-name',[entry('package/CON.txt')]),('dot-path',[entry('package/./a')]),
 ('link-field-on-file',[entry(link='private')]),('long-name-extension',[entry(kind=tarfile.GNUTYPE_LONGNAME)])]:
 check('archive-'+label,lambda entries=entries:archive_members(tar(entries)))
raw=Path(os.environ['MO1304_ARCHIVE']).read_bytes()
for label,data in [('truncation',raw[:-10]),('crc',raw[:-8]+bytes([raw[-8]^1])+raw[-7:]),('concatenated',raw+raw),('trailing',raw+b'x'),('non-gzip',b'not gzip'*3)]:
 check('archive-'+label,lambda data=data:archive_members(data))
check('installed-original',lambda:verify_installed(root),False)
copy=Path(tempfile.mkdtemp(prefix='tamper-',dir=base))/'package';shutil.copytree(root,copy)
try:
 for label,path in [('dependency','node_modules/@modelcontextprotocol/server/dist/index.mjs'),('runtime','runtime/authoritative/web/js/memoryos-sdk.js'),('contract','contracts/policy-contract-identities-1.0.0.json'),('limits','contracts/limits.json'),('lock','distribution/dependency-lock.json'),('manifest','distribution/distribution-manifest.json'),('metadata','package.json')]:
  target=copy/path;original=target.read_bytes();target.write_bytes(original+b' ')
  try:check('installed-changed-'+label,lambda:verify_installed(copy))
  finally:target.write_bytes(original)
 extra=copy/'unexpected.mjs';extra.write_text('export default 1;');check('installed-extra',lambda:verify_installed(copy));extra.unlink()
 target=copy/'NOTICE.md';original=target.read_bytes();target.unlink();check('installed-missing',lambda:verify_installed(copy))
 outside=base/'outside-certification-canary';outside.write_bytes(original)
 os.link(outside,target);check('installed-hardlink',lambda:verify_installed(copy));target.unlink();outside.unlink();target.write_bytes(original)
 case=copy/'notice.md';target.rename(copy/'rename-intermediate');(copy/'rename-intermediate').rename(case);check('installed-case-substitution',lambda:verify_installed(copy));case.rename(copy/'rename-intermediate');(copy/'rename-intermediate').rename(target)
 ads=Path(str(target)+':mo1304-test');ads.write_bytes(b'UNAUTHORIZED_STREAM');check('installed-alternate-data-stream',lambda:verify_installed(copy));ads.unlink()
 junction=copy/'unexpected-junction';subprocess.run([os.environ['MO1304_NODE'],'--input-type=module','-e','import {symlinkSync} from "node:fs";symlinkSync(process.argv[1],process.argv[2],"junction");',str(copy/'contracts'),str(junction)],check=True,capture_output=True)
 try:check('installed-junction-reparse',lambda:verify_installed(copy))
 finally:os.rmdir(junction)
 # A missing local dependency must fail verification before any product launch;
 # no development checkout, global dependency, or registry fallback is permitted.
 dep=copy/'node_modules/@modelcontextprotocol/server/dist/index.mjs';original=dep.read_bytes();dep.unlink();check('installed-source-fallback',lambda:verify_installed(copy));dep.write_bytes(original)
 check('installed-restored',lambda:verify_installed(copy),False)
finally:
 assert copy.parent.parent.resolve()==base.resolve()
 shutil.rmtree(copy.parent)
value={'kind':'MemoryOSMO1304WindowsPackageAdversarial','version':'1.0.0','status':'PASS','archive':identity(raw),'rawArchivePlatformIndependent':True,'filesystemPlatform':'win32','windowsReparseOrADSClaimed':True,'results':records}
output.write_bytes(canonical(value));print(json.dumps({'status':'PASS','tests':len(records),'receipt':identity(output.read_bytes())}))
