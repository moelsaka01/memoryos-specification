from pathlib import Path
import subprocess,time,sys,json,datetime
from materialize import ROOT,PKG,j,sha
OUT=ROOT/'repositories/cca-conformance/evidence/mo1306/acceptance';OUT.mkdir(exist_ok=True)
for name,script in [('audit','audit.py'),('proof-collection','collect-proof.py'),('trace-and-topology','check-traces.py')]:
 argv=[sys.executable,'-B','-X','utf8',str(Path(__file__).with_name(script))]
 start=time.perf_counter();r=subprocess.run(argv,cwd=ROOT,capture_output=True,text=True,encoding='utf-8',timeout=30)
 value={'id':name,'status':'PASS' if r.returncode==0 else 'FAIL','command':argv,'exitCode':r.returncode,'elapsedMs':round((time.perf_counter()-start)*1000),'stdout':r.stdout,'stderr':r.stderr,'harnessSha256':sha(Path(__file__).read_bytes()),'scriptSha256':sha(Path(__file__).with_name(script).read_bytes()),'distributionDigest':sha((PKG/'distribution-manifest.json').read_bytes())}
 (OUT/(name+'.json')).write_bytes(j(value));print(name,value['status'],flush=True)
 if r.returncode:print(r.stdout,r.stderr)
 assert r.returncode==0
now=datetime.datetime.now(datetime.timezone.utc)
(OUT/'measurement-closeout.json').write_bytes(j({'status':'PASS','conservativeCampaignStartUtc':'2026-09-25T19:46:33Z','closedUtc':now.isoformat(),'elapsedMs':round((now-datetime.datetime(2026,9,25,19,46,33,tzinfo=datetime.timezone.utc)).total_seconds()*1000),'maximumCampaignMs':3600000,'ordinaryTargetMs':1200000,'ordinaryTargetMet':False,'reason':'Contract correction, targeted implementation/harness diagnoses and final affected witnesses exceeded the ordinary target; the 60-minute maximum is preserved. No further resource measurement is required.','hardTaskStopUtc':'2026-09-25T21:16:33Z'}))
assert (now-datetime.datetime(2026,9,25,19,46,33,tzinfo=datetime.timezone.utc)).total_seconds()<3600
