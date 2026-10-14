"""Frozen trigger-policy regressions; no historical receipt is modified."""
from pathlib import Path
import hashlib,json,os,re,subprocess
ROOT=Path(__file__).resolve().parents[4];NODE=ROOT/'.cache/mo1304-phase3-toolchain/node-v24.21.0-win-x64/node.exe'
OUT=ROOT/'.cache/mo1305-resource-review/regressions';OUT.mkdir(exist_ok=True)
groups={
 'mo1301-sdk':['repositories/cca-studio/tests/'+x for x in ['memoryos_policy_sdk_test.mjs','investigation_policy_test.mjs','investigation_policy_contracts_test.mjs','investigation_policy_engine_test.mjs','policy_canonical_test.mjs','policy_fact_context_test.mjs','regression_policy_fact_source_test.mjs','memoryos_sdk_test.mjs']],
 'core-mip':[p.relative_to(ROOT).as_posix() for p in sorted((ROOT/'repositories/cca-studio/tests').glob('mip_*test.mjs'))]+['repositories/cca-studio/tests/investigation_core_test.mjs'],
 'mo1302-projections':['--test-name-pattern=CLI transport|real bundled orchestration|valid MO-1301 evaluation failures|artifact verifier rejections|wrong decision/exit','repositories/cca-conformance/tests/mo1302_action_foundation_conformance_test.mjs'],
 'mo1303-io-inspection':['--test-name-pattern=secure input|exact bytes|inspection|Policy|policy|artifact|verification','repositories/memoryos-vscode/tests/runtime_foundation.test.mjs'],
 'mo1304-semantic-integrity':['repositories/memoryos-mcp/tests/'+x for x in ['contracts.test.mjs','delegation.test.mjs','integrity.test.mjs','dispatcher.test.mjs']],
 'cli-secondary':['repositories/memoryos-cli/tests/policy-cli.test.mjs'],
}
results=[]
for name,files in groups.items():
 command=[str(NODE),'--test','--test-concurrency=1','--test-reporter=tap',*files]
 env={k:v for k,v in os.environ.items() if not re.match(r'^(NODE_|OPENSSL_|SSL_CERT_|UV_|HTTP_PROXY$|HTTPS_PROXY$|ALL_PROXY$|NO_PROXY$)',k,re.I)}
 done=subprocess.run(command,cwd=ROOT,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,timeout=900)
 path=OUT/(name+'.tap');path.write_bytes(done.stdout)
 counts={k:int(v) for k,v in re.findall(rb'^# (tests|pass|fail|skipped) (\d+)$',done.stdout,re.M)}
 counts={k.decode():v for k,v in counts.items()}
 row={'id':name,'state':'PASS' if done.returncode==0 else 'FAIL','exitCode':done.returncode,'command':['node',*command[1:]],'counts':counts,'log':{'path':path.relative_to(ROOT).as_posix(),'byteLength':len(done.stdout),'sha256':hashlib.sha256(done.stdout).hexdigest()}}
 results.append(row);print(json.dumps(row),flush=True)
 (OUT/'results.json').write_text(json.dumps({'kind':'MemoryOSRESTPredecessorRegressions','head':subprocess.check_output([r'C:/Program Files/Git/cmd/git.exe','rev-parse','HEAD'],cwd=ROOT,text=True).strip(),'results':results,'excluded':'Unchanged C++/UI and historical hosted/certification workflows; no predecessor source, tooling or evidence changed.'},sort_keys=True,separators=(',',':')),encoding='utf-8')
 if done.returncode:raise SystemExit(done.returncode)
