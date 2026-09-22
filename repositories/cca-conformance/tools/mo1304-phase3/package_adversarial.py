"""Supplemental raw-archive and Linux installed-filesystem attack witnesses."""
import io,json,tarfile,gzip,tempfile,shutil,os,sys
from pathlib import Path
from package_verify import archive_members,verify_archive,verify_installed,canonical,identity
root=Path(sys.argv[1]);output=Path(sys.argv[2]);base=root.parents[2]
assert str(base).startswith('/home/mo1304/mo1304-cert/runs/')
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
 ('backslash',[entry('package/a\\b')]),('device-name',[entry('package/CON.txt')]),('dot-path',[entry('package/./a')]),
 ('link-field-on-file',[entry(link='private')]),('long-name-extension',[entry(kind=tarfile.GNUTYPE_LONGNAME)])]:
 check('archive-'+label,lambda entries=entries:archive_members(tar(entries)))
raw=Path('/home/mo1304/mo1304-cert/incoming/memoryos-mcp-0.1.0.tgz').read_bytes()
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
 target.symlink_to(outside);check('installed-symlink',lambda:verify_installed(copy));target.unlink()
 os.link(outside,target);check('installed-hardlink',lambda:verify_installed(copy));target.unlink();outside.unlink();target.write_bytes(original)
 case=copy/'notice.md';case.write_bytes(original);check('installed-case-collision',lambda:verify_installed(copy));case.unlink()
 special=copy/'fifo';os.mkfifo(special);check('installed-special-file',lambda:verify_installed(copy));special.unlink()
 # A missing local dependency must fail verification before any product launch;
 # no development checkout, global dependency, or registry fallback is permitted.
 dep=copy/'node_modules/@modelcontextprotocol/server/dist/index.mjs';original=dep.read_bytes();dep.unlink();check('installed-source-fallback',lambda:verify_installed(copy));dep.write_bytes(original)
 check('installed-restored',lambda:verify_installed(copy),False)
finally:
 assert copy.parent.parent.resolve()==base.resolve()
 shutil.rmtree(copy.parent)
value={'kind':'MemoryOSMO1304UbuntuPackageAdversarial','version':'1.0.0','status':'PASS','archive':identity(raw),'rawArchivePlatformIndependent':True,'filesystemPlatform':'linux','windowsReparseOrADSClaimed':False,'results':records}
output.write_bytes(canonical(value));print(json.dumps({'status':'PASS','tests':len(records),'receipt':identity(output.read_bytes())}))
