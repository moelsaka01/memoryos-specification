// Seal only existing Phase 2B bytes; excludes its own binding to avoid a cycle.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { digest } from '../../../memoryos-readiness/src/canonical.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../../../..');
const evidence='repositories/cca-conformance/evidence/mo1307/phase2b';
const baseline='3883ca889911fcc5a6f46c24e569478a8c32648e';
function git(...args){const r=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true});assert.equal(r.status,0,r.stderr);return r.stdout.trim();}
assert.equal(git('rev-parse','HEAD'),baseline);assert.equal(git('branch','--show-current'),'codex/mo1307-phase2b-evidence-graph');
const receipt=JSON.parse(fs.readFileSync(path.join(root,evidence,'acceptance/receipt.json')));assert.equal(receipt.result,'PASS');
const p2=receipt.commands.find(c=>c.id==='phase2b-tests'),p1=receipt.commands.find(c=>c.id==='phase1-tests');
const selectors={trustRoot:/A02|A03/,grants:/A0[679]|A1[012]|A25|A26/,externalEvidence:/A07|A08|A25/,sourceIdentity:/A04|A05|A10|A12|source mutation/,claimIdentity:/A06|claim digest/,candidateBinding:/A13|A14|A15|candidate/,dependencyClosure:/A16|A17|A18|dependency/,selectiveInvalidation:/A21|selective|reuse dispositions/,staleness:/A19|A20|A21|A22/,reuse:/A21|A22|reuse dispositions/,history:/HB|IB|history/,qualifications:/QB|qualification/,providers:/PB|provider/,dag:/graph|DAG/,cycles:/cycle|self-loop/,dangling:/dangling/,limits:/L\d|A28|A34|A35|A36|ceiling|overflow|boundary/,tamper:/tamper|mutation|promotion|rewrit/,determinism:/determin|permut|insertion|order/,verifiedProjection:/projection/,resultVerification:/result evidence|proof material|result support/};
const catalog={kind:'MemoryOSReadinessPhase2BTestCatalog',version:'1.0.0',phase2B:p2.tests,phase1:p1.tests,categories:Object.entries(selectors).map(([category,re])=>({category,tests:p2.testNames.filter(name=>re.test(name))})),parserRegression:'Phase1 C05-C10/C21, exact shared serializer, unchanged frozen limits',scope:'Tests include end-to-end authority, internal defensive graph, and isolated count/byte admission. Boundary admission does not assert authority validity at mutually unattainable maxima.'};
for(const c of catalog.categories)assert.ok(c.tests.length,c.category);
fs.writeFileSync(path.join(root,evidence,'test-catalog.json'),JSON.stringify(catalog,null,2)+'\n');
const tracked=git('diff','--name-only',baseline).split('\n').filter(Boolean);
const untracked=git('ls-files','--others','--exclude-standard').split('\n').filter(Boolean);
const paths=[...new Set([...tracked,...untracked])].filter(p=>p!==evidence+'/binding.json').sort();
const allowed=p=>p==='docs/mo1307-phase2b-evidence-graph.md'||p.startsWith('repositories/memoryos-readiness/')||p.startsWith('repositories/cca-conformance/');
assert.ok(paths.every(allowed),'Unexpected changed path');
const files=paths.map(p=>{const b=fs.readFileSync(path.join(root,p));return {path:p,byteLength:b.length,sha256:digest(b),sharedOverlap:tracked.includes(p)};});
const binding={kind:'MemoryOSReadinessPhase2BBinding',version:'1.0.0',baseline,parent:'7aa5ede6ec52b36d0428273d78c8ca7aa37a39ee',branch:'codex/mo1307-phase2b-evidence-graph',files,sharedFiles:files.filter(f=>f.sharedOverlap).map(f=>f.path),sharedOverlapExplanation:{foundation:'Strengthened reference/envelope admission, dedicated nested mismatch categories and strict phase priority; full original schema checks retained.',fixtures:'Eight original configuration sources explicitly consumed by eleven CONFIGURATION-dependent MO1306 grants; raw bytes and all normalized facts unchanged.',package:'Register three private modules and refresh exact SBOM/distribution hashes; public exports and contracts unchanged.'},acceptance:{path:evidence+'/acceptance/receipt.json',result:'PASS',phase2B:p2.tests,phase1:p1.tests},handoff:{module:'repositories/memoryos-readiness/src/evidence-verifier.mjs',exports:['verifyEvidence','verifyResultEvidence'],consumers:['2A:verified projection','2C:independent original input verification','2D:full recomputation,shared reconciliation and package verification'],fullPublicVerificationImplemented:false,readinessComputed:false,report:'docs/mo1307-phase2b-evidence-graph.md'},noFutureHash:true,excludedSelf:evidence+'/binding.json',network:false,push:false,tag:false};
fs.writeFileSync(path.join(root,evidence,'binding.json'),JSON.stringify(binding,null,2)+'\n');
for(const f of files)assert.equal(digest(fs.readFileSync(path.join(root,f.path))),f.sha256,f.path);
console.log(JSON.stringify({result:'PASS',boundFiles:files.length,sharedFiles:binding.sharedFiles.length,phase2B:p2.tests,phase1:p1.tests}));
