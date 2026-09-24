"""R5-only complete preflight; preserve logs, use fresh paths, stop at first failure."""
from pathlib import Path
import json,hashlib,os,subprocess,sys,time,uuid
ROOT=Path(__file__).resolve().parents[4];TOOLS=Path(__file__).parent
NODE=ROOT/'.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe'
OUT=ROOT/'.cache/mo1305-resource-review/candidate-preflight-r5';assert not OUT.exists();OUT.mkdir()
def j(v):return json.dumps(v,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()
def ref(p):
 b=p.read_bytes();return {'path':p.relative_to(ROOT).as_posix(),'byteLength':len(b),'sha256':hashlib.sha256(b).hexdigest()}
commands=[('build',[sys.executable,'-B',str(TOOLS/'build.py')]),('install',[sys.executable,'-B',str(TOOLS/'fresh_install.py')]),('clock-synchronization',[str(NODE),'--test','--test-reporter=tap',str(TOOLS.parent/'mo1305-monitor-tests.mjs')]),('ordinary-smoke',[str(NODE),str(TOOLS/'campaign.mjs'),'smoke']),('adverse-smoke',[str(NODE),str(TOOLS/'adverse.mjs'),'smoke']),('validation',[str(NODE),str(TOOLS/'validate-campaign.mjs'),'smoke',str(OUT/'validation.json')]),('outer-native-validation',[str(NODE),str(TOOLS.parent/'mo1305-validate-measurements.mjs'),str(ROOT/'.cache/mo1305-resource-review/campaign-smoke-r5/progress.json')])]
proof_paths=[TOOLS.parent/name for name in ['mo1305-monitor-tests.mjs','mo1305-clock-audit.py','mo1305-evidence.mjs','mo1305-validate-measurements.mjs']]
proof_paths += [ROOT/'repositories/cca-conformance/tests/mo1305_phase1_conformance_test.mjs',ROOT/'docs/mo1305-phase1-clock-model.md']
proof_inputs=[ref(p) for p in proof_paths];(OUT/'test-inputs.json').write_bytes(j(proof_inputs))
records=[];domain='MONOTONIC_ORCHESTRATOR:'+str(uuid.uuid4())
for name,command in commands:
 log=OUT/(name+'.log');env={k:v for k,v in os.environ.items() if k.upper() in ['SYSTEMROOT','WINDIR','TEMP','TMP']};start=time.perf_counter_ns()
 try:
  with log.open('wb') as stream:done=subprocess.run(command,cwd=ROOT,env=env,stdout=stream,stderr=subprocess.STDOUT,timeout=1800)
 except subprocess.TimeoutExpired:
  end=time.perf_counter_ns();(OUT/'timeout-failure.json').write_bytes(j({'state':'FAIL','case':name,'assertionCode':'PREFLIGHT_ORCHESTRATION_TIMEOUT','expectedRelationship':'<','leftOperand':{'name':'elapsedNs','value':str(end-start)},'rightOperand':{'name':'maximumNs','value':str(1800*1000000000)},'units':'ns','clockDomain':domain}));raise
 end=time.perf_counter_ns();row={'id':name,'state':'PASS' if done.returncode==0 else 'FAIL','exitCode':done.returncode,'timing':{'clockDomain':domain,'startNs':str(start),'endNs':str(end),'durationNs':str(end-start)},'log':ref(log)};records.append(row);(OUT/'results.json').write_bytes(j(records));print(json.dumps(row),flush=True)
 if done.returncode:print(log.read_text(errors='replace')[-8000:],flush=True);raise SystemExit(done.returncode)
assert len(records)==len(commands) and all(r['state']=='PASS' for r in records)

assert [ref(p) for p in proof_paths]==proof_inputs,'PREFLIGHT_TEST_INPUT_DRIFT'
