from pathlib import Path
import shutil
ROOT=Path(__file__).resolve().parents[4]
p=Path(__file__).with_name('execution.py')
shutil.copyfile(p,ROOT/'repositories/cca-conformance/evidence/mo1306/phase1-resume/execution-harness.py.txt')
s=p.read_text()
s=s.replace('from topology import validate as topology_validate','from trace import validate_trace')
s=s.replace("evidence/mo1306/phase1-resume'","evidence/mo1306/phase1-resume-validated'")
a=s.index(' try:\n  assert result[');b=s.index(' except Exception as error:',a)
s=s[:a]+""" try:
  identities={'node':str(NODE),'powershell':str(Path(ENV['SystemRoot'])/'System32/WindowsPowerShell/v1.0/powershell.exe'),'conhost':str(Path(ENV['SystemRoot'])/'System32/conhost.exe')}
  result['topologyValidation']=validate_trace(result,identities,PKG)
"""+s[b:]
s=s.replace(" return record(name,execute("," old=ROOT/'repositories/cca-conformance/evidence/mo1306/phase1-resume'/(name+'.json')\n if old.is_file():\n  prior=json.loads(old.read_bytes());assert prior['distributionSha256']==sha((PKG/'distribution-manifest.json').read_bytes())\n  prior['revalidatedFrom']={'path':old.relative_to(ROOT).as_posix(),'sha256':sha(old.read_bytes()),'reason':'Bounded known-console teardown, no changed production bytes or process ceiling'}\n  return record(name,prior,expected)\n return record(name,execute(")
s=s.replace(" dest.mkdir(parents=True,exist_ok=False)"," if dest.exists():\n  return dest,json.loads((dest/'memoryos-ci.json').read_bytes())\n dest.mkdir(parents=True,exist_ok=False)")
p.write_bytes(s.encode())
