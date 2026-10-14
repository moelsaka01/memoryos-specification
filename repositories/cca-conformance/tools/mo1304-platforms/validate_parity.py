"""Parity is generated only after two independent platform validators succeed."""
import json,subprocess,sys
from pathlib import Path
from support_contract import parity_contract
from package_verify import canonical,identity,require
HERE=Path(__file__).resolve().parent

def certified_pair(windows,ubuntu):
 windows=Path(windows);ubuntu=Path(ubuntu)
 require(windows.name=='windows-receipt.json' and ubuntu.name=='ubuntu-receipt.json','PLATFORM_RECEIPT_NAMES')
 results=[]
 for path,script,platform in [(windows,HERE.parent/'mo1304-windows/validate_windows.py','windows-11'),(ubuntu,HERE.parent/'mo1304-phase3/validate_receipt.py','ubuntu-24.04')]:
  r=subprocess.run([sys.executable,'-B',str(script),str(path)],capture_output=True,timeout=60)
  require(r.returncode==0,'INDEPENDENT_VALIDATION_FAILED:'+platform)
  result=json.loads(r.stdout);require(result['status']=='PASS' and result['platform']==platform,'PLATFORM_VALIDATION');results.append(result)
 w=json.loads(windows.read_bytes());u=json.loads(ubuntu.read_bytes());parity_contract([w,u])
 def catalog(path,receipt):
  execution=json.loads((path.parent/receipt['artifacts']['execution']['file']).read_bytes())
  return next(r for r in execution['results'] if r['id']=='official-protocol-catalog')['details']
 tool=catalog(windows,w);require(tool==catalog(ubuntu,u),'TOOL_CATALOG_PARITY')
 return {'kind':'MemoryOSMO1304CrossPlatformParity','version':'1.0.0','status':'PASS','platforms':{'windows-11':identity(windows.read_bytes()),'ubuntu-24.04':identity(ubuntu.read_bytes())},'supportedWindowsPlatform':w['supportedPlatform'],'certifiedWindowsEnvironment':w['certifiedEnvironment'],'ubuntuTarget':'Ubuntu 24.04 LTS x64','nodeVersion':'24.21.0','implementationRevision':w['implementationRevision'],'phase2Binding':w['phase2Binding'],'candidate':w['candidate'],'toolCatalog':tool,'semanticVectors':w['semanticVectors'],'independentValidation':results,'macos':'UNSUPPORTED','releaseBinding':'PENDING','tag':'ABSENT'}

def main():
 require(len(sys.argv)==5 and sys.argv[1] in ['create','validate'],'USAGE')
 mode,windows,ubuntu,out=sys.argv[1:];expected=canonical(certified_pair(windows,ubuntu));require(len(expected)<=1024*1024,'PARITY_SIZE')
 if mode=='create':
  with Path(out).open('xb') as f:f.write(expected)
 else:require(Path(out).read_bytes()==expected,'PARITY_BYTES_OR_DIGEST_MISMATCH')
 print(json.dumps({'status':'PASS','platforms':2,'semanticVectors':9,**identity(expected)}))
if __name__=='__main__':main()
