from pathlib import Path
import json,shutil
ROOT=Path(__file__).resolve().parents[4]
HERE=Path(__file__).parent
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/correction-a'
initial=OUT/'initial-harness-assertion';initial.mkdir(exist_ok=False)
for n in ['attached.json','detached.json','diagnostic-summary.json']:shutil.copyfile(OUT/n,initial/n)
shutil.copyfile(HERE/'diagnostic.py',initial/'diagnostic.py.txt')
p=HERE/'diagnostic.py';s=p.read_text();s=s.replace("protocol['helperStdout']=='{\"safe\":true}\\n'","json.loads(protocol['helperStdout'])=={'kind':'MemoryOSCICDPathCheck','safe':True,'version':'1.0.0'}")
p.write_text(s,encoding='utf-8')
p=HERE/'probe.mjs';s=p.read_text().replace("const child=spawn", "for(const name of ['HOMEDRIVE','HOMEPATH','LOGONSERVER','PATH','SYSTEMDRIVE','TEMP','USERDOMAIN','USERNAME','USERPROFILE'])delete process.env[name];\nconst child=spawn")
p.write_text(s,encoding='utf-8')
