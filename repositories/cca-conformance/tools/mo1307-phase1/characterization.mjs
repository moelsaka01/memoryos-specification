// Engineering-only finite foundation characterization. Never certification.
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Worker, isMainThread, parentPort, workerData } from 'node:worker_threads';
import { performance } from 'node:perf_hooks';
import assert from 'node:assert/strict';
import { DEFINITIONS } from '../../../memoryos-readiness/src/constants.mjs';
import { canonicalBytes, parseCanonical, digest } from '../../../memoryos-readiness/src/canonical.mjs';
import { inspectFoundationInputs, validateGraphStructure, validateResultIdentity, aggregateReference } from '../../../memoryos-readiness/src/foundation.mjs';
import { summaryProjection, textProjection } from '../../../memoryos-readiness/src/projections.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../../../..');
const L=DEFINITIONS.limits;
const cases={small:'repositories/cca-conformance/fixtures/mo1307/bundles/ready','mo1306-shaped':'repositories/cca-conformance/fixtures/mo1307/bundles/mo1306-qualified',maximum:'.cache/mo1307/phase1/characterization-inputs/maximum'};
assert.equal(process.version,'v24.21.0');assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
if(isMainThread){
  assert.equal(process.argv.length,6);assert.equal(process.argv[2],'--case');assert.equal(process.argv[4],'--run-directory');
  const name=process.argv[3];assert.ok(Object.hasOwn(cases,name));
  const started=performance.now();
  const worker=new Worker(new URL(import.meta.url),{workerData:{name},resourceLimits:{maxOldGenerationSizeMb:L.workerOldHeapMiB,maxYoungGenerationSizeMb:L.workerYoungHeapMiB}});
  let terminal=false;
  const deadlineFailure=()=>{
    if(terminal)return;
    terminal=true;clearTimeout(timer);worker.terminate();
    process.stderr.write('Foundation characterization exceeded frozen API deadline.\n');process.exitCode=1;
  };
  const timer=setTimeout(deadlineFailure,L.apiDeadlineMs);
  worker.once('error',error=>{if(terminal)return;terminal=true;clearTimeout(timer);process.stderr.write(String(error.stack)+'\n');process.exitCode=1;});
  worker.once('message',result=>{
    if(terminal)return;
    if(performance.now()-started>=L.apiDeadlineMs){deadlineFailure();return;}
    terminal=true;clearTimeout(timer);
    const receipt={kind:'MemoryOSReadinessPhase1Characterization',version:'1.0.0',case:name,result:'PASS',foundationOnly:true,productionCertification:false,
      runtime:{node:process.version,platform:process.platform,arch:process.arch},workerResourceLimits:worker.resourceLimits,
      supervisorElapsedMs:Math.round((performance.now()-started)*1000)/1000,worker:result,
      topology:{supervisors:1,workers:1,helpers:0,consoleHosts:null,helperWorkerOverlap:false,processCountsAuthority:'EXTERNAL_OBSERVER'},
      limitations:['Measures Phase 1 structural foundations and supplied result/reference projections, not Phase 2 evaluation or verification.','The external Windows observer reports sampled RSS and actual console-host/process counts; process.memoryUsage is supplementary.','Retained buffers remain alive for 2000 ms after measured operations to improve sample visibility; this engineering hold is excluded from pure duration and remains within the unchanged 10-second enclosing deadline.']};
    process.stdout.write(JSON.stringify(receipt)+'\n');
  });
  worker.once('exit',code=>{clearTimeout(timer);if(code!==0||!terminal){terminal=true;process.exitCode=1;}});
}else{
  const directory=resolve(root,cases[workerData.name]);
  const started=performance.now(),read=name=>readFileSync(resolve(directory,name));
  const pins=JSON.parse(read('pins.json')),manifest=JSON.parse(read('manifest.json'));
  const input={configurationBytes:read('configuration.json'),candidateBytes:read('candidate.json'),manifestBytes:read('manifest.json'),authorityBytes:read('authority.json'),
    expectedCandidateDigest:pins.expectedCandidateDigest,trustedAuthorityDigest:pins.trustedAuthorityDigest,
    files:manifest.entries.map(e=>({id:e.id,bytes:read(e.path)}))};
  const resultBytes=read('expected-result.json');
  const acquired=performance.now();
  const foundation=inspectFoundationInputs(input);
  const result=parseCanonical(resultBytes,{maxBytes:L.resultBytes});
  validateResultIdentity(result);validateGraphStructure(result.assessment.graph);
  const reference=aggregateReference(result.assessment);
  assert.equal(reference.readiness,pins.expectedReadiness);
  assert.deepEqual(canonicalBytes(result),resultBytes);
  const summary=summaryProjection(result),text=textProjection(result);
  const completed=performance.now();
  assert.ok(completed-started<L.apiDeadlineMs);
  const observations={acquisitionMs:Math.round((acquired-started)*1000)/1000,pureDurationMs:Math.round((completed-acquired)*1000)/1000,
    inputAndPureDurationMs:Math.round((completed-started)*1000)/1000,
    sizes:{configuration:input.configurationBytes.length,candidate:input.candidateBytes.length,manifest:input.manifestBytes.length,authority:input.authorityBytes.length,
      aggregateEvidence:input.files.reduce((n,f)=>n+f.bytes.length,0),largestSource:Math.max(...manifest.entries.filter(e=>e.type!=='ENVELOPE').map(e=>e.byteLength)),largestEnvelope:Math.max(...manifest.entries.filter(e=>e.type==='ENVELOPE').map(e=>e.byteLength)),result:resultBytes.length,summary:summary.length,text:text.length},
    counts:{components:foundation.parsed.candidate.components.length,manifestFiles:manifest.entries.length,claims:manifest.entries.filter(e=>e.type==='ENVELOPE').length,graphNodes:result.assessment.graph.nodes.length,graphEdges:result.assessment.graph.edges.length,gates:result.assessment.gates.length,qualifications:result.assessment.qualifications.length,history:result.assessment.history.length},
    identities:{candidate:pins.expectedCandidateDigest,authority:pins.trustedAuthorityDigest,manifest:digest(input.manifestBytes),result:digest(resultBytes),readiness:result.readinessDigest,proof:result.proofBindingDigest},
    memoryAfterOperations:process.memoryUsage(),resourceUsage:process.resourceUsage(),samplingHoldMs:2000};
  await new Promise(r=>setTimeout(r,2000));
  // References deliberately remain live through the observation hold.
  assert.equal(input.files.length,foundation.copies.files.length);assert.ok(resultBytes.length&&text.length&&summary.length);
  parentPort.postMessage(observations);
}
