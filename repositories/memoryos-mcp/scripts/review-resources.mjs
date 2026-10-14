import assert from 'node:assert/strict';
import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PACKAGE_ROOT,sha256 } from '../src/integrity.mjs';
import { loadLimits } from '../src/limits.mjs';
import { J } from '../src/deterministic.mjs';
import { maximumVerificationArtifacts,measurementCorpus } from '../tests/corpus.mjs';
let bytes=await readFile(resolve(PACKAGE_ROOT,'measurements/resource-measurement.json'));
const receipt=JSON.parse(bytes);
const currentRunPath='measurements/resource-measurement-final-run.json';
if(!receipt.reviewEnvelope)await writeFile(resolve(PACKAGE_ROOT,currentRunPath),bytes);
const sourceNames=[currentRunPath,...['provisional','sampling-review','escaping-review'].map(name=>`measurements/resource-measurement-${name}.json`)];
const sources=[];
for(const path of sourceNames){const raw=await readFile(resolve(PACKAGE_ROOT,path));sources.push({path,byteLength:raw.length,sha256:sha256(raw),derivation:JSON.parse(raw).derivation});}
const maxima=Object.fromEntries(['worstHeap','worstExternal','parentAttributable','worstTotalMs'].map(key=>[key,Math.max(...sources.map(x=>x.derivation[key]))]));
const wholeMiB=value=>Math.floor(2*value/1048576)+1;
const deadline=(Math.floor(4*maxima.worstTotalMs/1000)+1)*1000;
receipt.derivation={...receipt.derivation,...maxima};
receipt.limits.values={...receipt.limits.values,workerHeapMiB:wholeMiB(maxima.worstHeap),workerYoungMiB:wholeMiB(maxima.worstHeap),
 workerExternalBytes:wholeMiB(maxima.worstExternal)*1048576,parentAttributableBytes:wholeMiB(maxima.parentAttributable)*1048576,
 operationMs:deadline,partialFrameMs:deadline,outputDrainMs:deadline,shutdownMs:deadline};
receipt.reviewEnvelope={method:'Maximum observed peak/duration across final and preserved review runs; never lower a budget because a later sample happened to be cheaper.',sources};
bytes=Buffer.from(J(receipt)+'\n');
await writeFile(resolve(PACKAGE_ROOT,'measurements/resource-measurement.json'),bytes);
await writeFile(resolve(PACKAGE_ROOT,'contracts/limits.json'),J(receipt.limits)+'\n');
const limits=await loadLimits();
assert.equal(receipt.observations.length,420);assert.equal(receipt.transportObservations.length,60);
assert.equal(receipt.node,'24.21.0');assert.deepEqual(receipt.limits.values,limits);
const currentScript=await readFile(new URL('./measure.mjs',import.meta.url));
if(receipt.measurementScriptFormattingCorrection){
 const correction=receipt.measurementScriptFormattingCorrection;
 assert.equal(correction.line,129);assert.equal(correction.removed,'one trailing ASCII space');assert.equal(correction.behaviorChanged,false);
 assert.equal(correction.currentSha256,sha256(currentScript));assert.equal(correction.executedSha256,receipt.measurementScriptSha256);
 const executedLines=currentScript.toString('utf8').split('\n');executedLines[correction.line-1]+=' ';
 assert.equal(sha256(Buffer.from(executedLines.join('\n'))),receipt.measurementScriptSha256);
}else assert.equal(receipt.measurementScriptSha256,sha256(currentScript));
assert.equal(receipt.integritySourceSha256,sha256(await readFile(new URL('../src/integrity.mjs',import.meta.url))));
assert.equal(receipt.corpusScriptSha256,sha256(await readFile(new URL('../tests/corpus.mjs',import.meta.url))));
for(const mode of ['cold','warm'])for(const entry of receipt.corpus)
  assert.equal(receipt.observations.filter(x=>x.mode===mode&&x.label===entry.label&&x.status==='ok').length,30);
const mib=1048576,next=value=>Math.floor(2*value/mib)+1;
assert.equal(limits.workerHeapMiB,next(receipt.derivation.worstHeap));
assert.equal(limits.workerExternalBytes,next(receipt.derivation.worstExternal)*mib);
assert.equal(limits.parentAttributableBytes,next(receipt.derivation.parentAttributable)*mib);
assert.equal(limits.operationMs,(Math.floor(4*receipt.derivation.worstTotalMs/1000)+1)*1000);
assert.ok(limits.requestFrameBytes>receipt.analytical.wireInputBytes);
assert.ok(limits.parentAttributableBytes>receipt.analytical.parentRetention.conservativeByteBound);
const maximum=maximumVerificationArtifacts();const corpus=await measurementCorpus();
for(const entry of corpus)assert.equal(sha256(Buffer.from(J(entry.args))),receipt.corpus.find(x=>x.label===entry.label).argumentsSha256);
const runtime=JSON.parse(await readFile(resolve(PACKAGE_ROOT,'runtime/runtime-closure-manifest.json')));
const codes=new Set(),identifiers=new Set();
for(const file of runtime.files.filter(x=>x.path.endsWith('.js'))) {
 const source=await readFile(resolve(PACKAGE_ROOT,'runtime',file.path),'utf8');
 for(const match of source.matchAll(/["']((?:POLICY|MIP|MEMORYOS)_[A-Z0-9_]+)["']/gu))codes.add(match[1]);
 for(const match of source.matchAll(/["']((?:policy|policy-set|evaluation|regression-policy-fact-source|policy-fact-context|resource-profile)[a-z0-9.\-]*)["']/gu))identifiers.add(match[1]);
}
const stableStrings=[...codes,...identifiers,'MemoryOSPolicyEvaluationIdentity','MemoryOSPolicyEvaluationOutcome','MemoryOSInvestigationPolicySet','MemoryInvestigationPackage'];
assert.ok(stableStrings.every(x=>x.length<=128));
const review={kind:'MemoryOSMCPResourceReview',version:'1.0.0',status:'REVIEWED_PHASE1',
 measurement:{byteLength:bytes.length,sha256:sha256(bytes)},values:limits,
 maximalValidInputs:{policyRawBytes:1024,policySetRawBytes:2048,candidateMipBytes:524288,
  evaluationIdentityBytes:maximum.identity.canonicalIdentityBytes.length,outcomeBytes:maximum.outcome.canonicalOutcomeBytes.length,
  construction:'Policy/Set maximal admitted raw bytes, largest valid boundary-carrier canonical payload, valid maximal MIP noncritical extension; identity and outcome reproduce authoritative MO-1301 limit-31 maximum. Verification fixture Regression source never enters adapter evaluation.'},
 errorCatalog:{codes:[...codes].sort(),limitAndPhaseIdentifiers:[...identifiers].sort(),maximumEnumeratedLength:Math.max(...stableStrings.map(x=>x.length)),projectionAdmissionCodeUnits:128},
 budgets:{memory:'Next whole MiB strictly above twice observed heap, external and attributable process RSS. Parent RSS is process-wide and includes the worker, not parent heap alone.',
 stack:'8 MiB finite worker stack reservation used by measurement and production; it is an analytical reservation cap, not a sampled stack-use estimate.',
 deadlines:'Next whole second strictly above four times largest observed operation/framing/drain duration; same conservative bound for shutdown and partial frames.',
 rates:'At least two immutable-catalog plus four protocol-control sweeps per second; bounded measured throughput policy, never an unbounded queue.',
 structure:'Depth 16, members 512, nodes 1024, metadata 8192, IDs 128, input reads 65536 are explicit finite admission policies.'},
 retention:receipt.analytical.parentRetention,
 boundaryTests:['contracts.test.mjs','json-limits.test.mjs','dispatcher.test.mjs','protocol.test.mjs','process.test.mjs'],
 limitations:['5 ms samples do not observe every instantaneous allocation peak.','Worker heap is not total-process memory.','Worst escaping and retained-copy bounds cover admission; arbitrary whitespace is limited by the finite frame budget.','Cold means a fresh worker/module graph and SDK owner, not an OS cache flush.','Operational race, package and supported-platform certification remain Phase 2/3.'],
 predecessorReceiptsPreserved:['resource-measurement-provisional.json','limits-provisional.json','resource-measurement-sampling-review.json','limits-sampling-review.json','resource-measurement-escaping-review.json','limits-escaping-review.json','resource-measurement-final-run.json']};
await writeFile(resolve(PACKAGE_ROOT,'measurements/resource-review.json'),J(review)+'\n');
process.stdout.write(J({status:review.status,operations:420,transport:60,maximumErrorString:review.errorCatalog.maximumEnumeratedLength})+'\n');
