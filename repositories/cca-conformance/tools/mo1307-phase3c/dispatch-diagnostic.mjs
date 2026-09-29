import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
import {performance} from 'node:perf_hooks';
const ev='repositories/cca-conformance/evidence/mo1307/phase3c';
const start=performance.now();const r=spawnSync(process.execPath,['repositories/memoryos-readiness/bin/memoryos-readiness.mjs','Verify'],{encoding:'utf8',windowsHide:true,timeout:35000,env:{SystemRoot:process.env.SystemRoot,WINDIR:process.env.WINDIR}});
const receipt={kind:'MO1307Phase3CDispatchDiagnostic',original:'root-corpus-results.json#dispatch-native-Verify',originalDisposition:'HARNESS_OBSERVATION_INSUFFICIENT: original used a five-second process wait and retained an assertion without child transport/error details. No false accept or normative result observed. Original FAIL retained.',boundedFollowup:'One case only, a 35000 ms outer process observation; product deadlines/source unchanged.',command:'Verify',status:r.status,signal:r.signal,error:r.error?{code:r.error.code,message:r.error.message}:null,stdout:r.stdout,stderr:r.stderr,durationMs:performance.now()-start,result:r.status===10&&r.stdout===''&&JSON.parse(r.stderr).code==='MO1307_USAGE'?'PASS':'FAIL'};
fs.writeFileSync(ev+'/dispatch-native-diagnostic.json',JSON.stringify(receipt,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify(receipt));
