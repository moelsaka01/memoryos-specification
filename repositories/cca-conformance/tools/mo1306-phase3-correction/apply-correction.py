from common import *
r=command([r'C:\Windows\System32\WindowsPowerShell\v1.0\powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',TOOLS/'scan-powershell.ps1','-Root',ROOT],timeout=30)
assert r['exitCode']==0,r
put('powershell-audit.json',json.loads(r['stdout']))
p=PKG/'bin/memoryos-ci.mjs';raw=p.read_bytes();old=b"  const command=args[0],allowed={run:['workspace','config','provider'],generate:['config','deployment','output'],verify:['bundle']}[command];\n  if(!allowed)reject('USAGE');"
new=b"  const command=args[0],commands={run:['workspace','config','provider'],generate:['config','deployment','output'],verify:['bundle']};\n  if(!Object.hasOwn(commands,command))reject('USAGE');\n  const allowed=commands[command];"
assert raw.count(old)==1
p.write_bytes(raw.replace(old,new))
print('Own-property correction applied; PowerShell audit sites:',len(json.loads(r['stdout'])['sites']))
