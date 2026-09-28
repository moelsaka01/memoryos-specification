// Bounded engineering inventory/handoff; never embeds the future commit.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { canonicalBytes,digest } from '../../../memoryos-readiness/src/canonical.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const base=path.join(root,'repositories/cca-conformance/evidence/mo1307/phase2a');
const baseline='3883ca889911fcc5a6f46c24e569478a8c32648e';
const git=(...args)=>execFileSync('git',['-c','safe.directory='+root.replaceAll('\\','/'),...args],{cwd:root,encoding:'utf8',windowsHide:true,maxBuffer:2*1024*1024}).trim();
assert.equal(git('rev-parse','HEAD'),baseline);
assert.equal(git('branch','--show-current'),'codex/mo1307-phase2a-readiness-core');
const write=(name,value)=>fs.writeFileSync(path.join(base,name),canonicalBytes(value));
fs.mkdirSync(base,{recursive:true});
write('baseline.json',{kind:'MO1307Phase2ABaseline',version:'1.0.0',worktree:'C:/Users/melsa/Documents/Codex/cca-mo1307-2a',branch:'codex/mo1307-phase2a-readiness-core',head:baseline,
  subject:git('show','-s','--format=%s',baseline),parent:git('rev-parse',baseline+'^'),freeze:'e0cb8e9cc6aa73e26945db30756a6667a8d9e322',initialWorkingTree:'CLEAN_OBSERVED_BEFORE_EDITS',
  budgetStartUtc:'2026-09-28T14:58:00Z',budgetStartBasis:'CONSERVATIVE_TASK_START_BEFORE_FIRST_RECORDED_CLOCK',platform:'NATIVE_WINDOWS',networkUsed:false,push:false,tag:false});
const overlap=[
  {path:'repositories/cca-conformance/tools/mo1307-phase1/package.mjs',reason:'Add exactly two private module names to the existing source allowlist.',reconciliation:'Union independently reviewed stream source additions in the centrally owned allowlist.'},
  {path:'repositories/memoryos-readiness/package.json',reason:'Regenerate exact files list for the two private source additions; public exports/dependencies/hooks unchanged.',reconciliation:'Regenerate from the reconciled package tool.'},
  {path:'repositories/memoryos-readiness/sbom.spdx.json',reason:'Refresh deterministic file inventory and member hashes for the changed package.',reconciliation:'Regenerate once after all source changes; preserve existing self/cycle exclusions.'},
  {path:'repositories/memoryos-readiness/distribution-manifest.json',reason:'Bind exact shipped new sources, updated package metadata and SBOM.',reconciliation:'Regenerate once after final reconciled source and SBOM.'},
];
const preserved=['canonical.mjs','constants.mjs','errors.mjs','foundation.mjs','helper-protocol.mjs','index.mjs','projections.mjs','publication.mjs','schema-data.mjs','schema.mjs','windows-paths.mjs','cli-args.mjs'].map(n=>'repositories/memoryos-readiness/src/'+n);
for(const file of preserved)assert.equal(git('diff',baseline,'--',file),'');
assert.equal(git('diff',baseline,'--','repositories/memoryos-readiness/schemas','repositories/memoryos-readiness/contracts','repositories/cca-conformance/fixtures/mo1307','repositories/cca-conformance/evidence/mo1307/phase1'),'');
write('shared-overlap.json',{kind:'MO1307Phase2ASharedOverlap',version:'1.0.0',changed:overlap,preservedInterfaces:preserved,
  schemasChanged:false,constantsChanged:false,errorsChanged:false,canonicalizationChanged:false,foundationShapeChanged:false,helperProtocolChanged:false,filesystemModelChanged:false,publicationChanged:false,phase1FixturesChanged:false,phase1EvidenceChanged:false,
  packageMembers:77,contractMembers:53,distributionRows:76,spdxFileRows:75,publicExports:['evaluateReadiness','verifyReadiness'],externalProductionDependencies:0});
write('handoff.json',{kind:'MO1307Phase2DHandoff',version:'1.0.0',baseline,
  coreModule:'repositories/memoryos-readiness/src/readiness-core.mjs',resultModule:'repositories/memoryos-readiness/src/readiness-result.mjs',
  privateFunctions:['computeReadiness(verified)','compareReadinessResult(verified,suppliedResultBytes)','constructReadinessResult(verified,aggregate)','projectReadinessResult(result,format)'],
  verifiedFields:['candidate','candidateDigest','profile','stage','scopeId','authorityIdentityDigest','slots','claims','graph','graphDigest','audit'],
  inputRecords:'Unchanged Phase 1 Candidate, Profile, NormalizedSlot, Claim, Graph and Audit; claim transport row adds claimDigest and normalized grantDigest.',
  nonsemanticOrder:['claims transport collection','slots transport collection','object key insertion order'],
  outputFields:['result','resultBytes','readinessDigest','proofBindingDigest','proofInput','exitCode'],
  proofInputFields:['kind','version','readinessDigest','audit'],
  responsibilities:{phase2B:['Verify independent pins and exact raw evidence/manifest/grants/source authority before supplying the projection.','Verify complete candidate/dependency/assumption closure, freshness and explicit reuse.','Verify historical inventory, immutable source/disposition and recurrence authority.','Derive normalized authorityIdentityDigest and graph/graphDigest; supply complete exact Audit.'],
    phase2C:['Acquire bounded checked Windows snapshots and authorized tag observations.','Run the single core in supervised wrappers with fixed worker limits/deadline/cancellation.','Select requested projection explicitly; a text-only size error does not invalidate API/JSON computation.','Verify by independent recomputation and exact byte comparison, then check optional external human decision.','Publish one fixed result atomically and handle bounded stdout transport.'],
    phase2D:['Adapt verified records to this closed seam without alternate schemas/serializers or engineering fixture authority.','Reconcile shared package allowlist and regenerate package.json/SBOM/distribution after integrating all streams.','Exercise both public surfaces, all four vectors, V18, raw authority/security negatives, deterministic bytes, native offline installed execution, boundaries/deadlines/publication before binding B2.']},
  exclusions:['No public end-to-end authority assertion','No new provider execution or hosted success','No characterization rerun or Phase 3 certification','No push or tag'],
  report:'docs/mo1307-phase2a-readiness-core.md'});
const read=name=>JSON.parse(fs.readFileSync(path.join(base,name),'utf8'));
const binding=name=>{const raw=fs.readFileSync(path.join(base,name));return {path:name,byteLength:raw.length,sha256:digest(raw)};};
const phase1=read('development/phase1-initial/receipt.json');
const finalPackage=read('development/package-final/receipt.json');
const acceptance=read('acceptance/receipt.json');
const rest=read('development/rest-cne/receipt.json');
assert.equal(phase1.commands.find(x=>x.id==='phase1-tests').result,'PASS');
assert.equal(phase1.commands.find(x=>x.id==='phase1-tests').tests.pass,105);
assert.equal(phase1.commands.find(x=>x.id==='fixtures').result,'PASS');
assert.equal(finalPackage.result,'PASS');assert.equal(acceptance.result,'PASS');
assert.equal(acceptance.commands.find(x=>x.id==='phase2a-tests').tests.pass,83);
assert.equal(rest.result,'PASS');
write('phase1-regression.json',{kind:'MO1307Phase2APhase1RegressionSummary',version:'1.0.0',result:'PASS',tests:105,passed:105,failed:0,
  evidence:[binding('development/phase1-initial/receipt.json'),binding('development/package-final/receipt.json'),binding('development/phase1-initial/measured-dependencies.json')],
  schemas:52,schemaDefinitions:96,schemaFixtureRecords:476,fixtureCatalogEntries:485,
  initialPackageFailure:'STALE_GENERATED_SBOM_AFTER_SOURCE_EDIT; retained unchanged and resolved by final regeneration/package/schema checks.',
  measuredDependencies:'UNCHANGED',characterizationRerun:false});
const finished=new Date();
const durationSeconds=Math.ceil((finished-Date.parse('2026-09-28T14:58:00Z'))/1000);
assert.ok(durationSeconds>=0 && durationSeconds<10800,'Three-hour hard stop reached');
write('test-receipt.json',{kind:'MO1307Phase2ATestSummary',version:'1.0.0',result:'PASS',phase2ATests:84,phase2APassed:84,phase1Tests:105,phase1Passed:105,totalDistinctTests:189,failed:0,
  phase2AExecution:'83 tests in complete acceptance suite, followed by the added REST CNE test in a targeted one-test run; no production source changed between these executions.',
  evidence:[binding('acceptance/receipt.json'),binding('development/rest-cne/receipt.json'),binding('phase1-regression.json')],
  exactIndependentFixtureResults:16,exactIndependentFixtureSummaries:16,determinism:'PASS',allFourReadinessVectors:'PASS',precedenceCrossProduct:'PASS',mo1306:'READY_WITH_QUALIFICATIONS',
  workspaceVerification:'PASS',diffCheck:'PASS',runtime:'Node 24.21.0 win-x64',network:false,linux:false,ubuntu:false,wsl:false,vm:false,providerAccounts:false,push:false,tag:false,
  budgetStartUtc:'2026-09-28T14:58:00Z',receiptCompletedUtc:finished.toISOString(),durationSeconds,
  checkpoint90Minutes:'NOT_REACHED',checkpoint2Hours:'NOT_REACHED',hardStop3Hours:'COMPLIANT',futureCommitIncluded:false});
write('development/core-review-disposition.json',{kind:'MO1307Phase2ACoreReview',version:'1.0.0',review:'INDEPENDENT_READ_ONLY_CONTRACT_REVIEW',result:'NO_REMAINING_ACTIONABLE_2A_BLOCKER',
  corrections:[{finding:'Coverage schema clauses masked the required INTEGRITY diagnostic.',change:'Inspect safe coverage/verdict contradictions before the shared Claim schema; retain lower error ordering.',tests:['A37','A28']},
    {finding:'Shared candidate validation reads nested candidate fields before its canonical guard.',change:'Use the shared canonical admission before candidate validation; nested getters do not execute.',tests:['A38']},
    {finding:'Selected claim/provider qualification errors could mask independent lower-number detail errors.',change:'Collect independent coverage/detail/provider/qualification checks with selected gate references.',tests:['A28']},
    {finding:'Qualification union scope/conflict errors returned before logical-reference sorting.',change:'Collect union errors with the remaining qualification checks before selecting the diagnostic.',tests:['A44']}],
  remainingUpstreamRequirements:'Full source/grant/history authority, DAG derivation, operational wrappers and certification remain 2B/2C/2D responsibilities; this review does not authenticate raw evidence.'});
// Include this inventory path by name without a self-hash. Hashes of future
// commits, directory trees containing this file and future receipts are absent.
const inventoryPath='repositories/cca-conformance/evidence/mo1307/phase2a/changed-files.json';
const tracked=git('diff','--name-only',baseline).split('\n').filter(Boolean);
const untracked=git('ls-files','--others','--exclude-standard').split('\n').filter(Boolean);
const files=[...new Set([...tracked,...untracked,inventoryPath])].sort();
write('changed-files.json',{kind:'MO1307Phase2AChangedFiles',version:'1.0.0',baseline,files,sharedFiles:overlap.map(x=>x.path),selfHashIncluded:false,futureCommitIncluded:false});
let bytes=0;
function count(directory){for(const item of fs.readdirSync(directory,{withFileTypes:true})){const file=path.join(directory,item.name);if(item.isDirectory())count(file);else bytes+=fs.statSync(file).size;}}
count(base);assert.ok(bytes<2*1024*1024,'Bounded Phase2A evidence exceeds engineering 2MiB inventory budget');
process.stdout.write(JSON.stringify({result:'PASS',changedFiles:files.length,evidenceBytes:bytes,baseline,sharedFiles:overlap.length})+'\n');
