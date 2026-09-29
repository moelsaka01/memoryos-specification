// Final read-only artifact checks then an acyclic immutable evidence closure.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {checkPackage} from '../mo1307-phase1/package.mjs';
import {root,E,S,C3RB,hash,read,json,rec,write,git,walk,inventory,tarMembers} from './common.mjs';
const T='repositories/cca-conformance/tools/mo1307-phase3b-c3rb-cert',D='docs/mo1307-phase3b-c3rb-cert.md';
const H='5cb213eeab8a6deec39a8f8f93ea13a70e053231';
function verify(r){const b=read(r.path);assert.equal(b.length,r.byteLength,r.path);assert.equal(hash(b),r.sha256.replace(/^sha256:/,''),r.path);}
if(fs.existsSync(path.join(root,E,'failure-final.json'))||fs.existsSync(path.join(root,E,'seal-start.json')))throw new Error('NO_SEAL_RETRY');
fs.writeFileSync(path.join(root,E,'seal-start.json'),JSON.stringify({startedUtc:new Date().toISOString(),attempt:1})+'\n',{flag:'wx'});
try{
assert.ok(!fs.existsSync(path.join(root,E,'failure.json')));assert.ok(!fs.existsSync(path.join(root,E,'certification-receipt.json')),'No seal retry');
const execution=json(E+'/execution.json');assert.equal(execution.result,'PASS');assert.equal(execution.mandatoryExecutionComplete,true);
assert.deepEqual(execution.stages.map(r=>r.name),json(T+'/protocol.json').executionStages);assert.ok(execution.stages.every(r=>r.result==='PASS'));
assert.equal(git(['rev-parse','HEAD']),C3RB);assert.equal(git(['branch','--show-current']),'codex/mo1307-phase3b-c3rb-cert');assert.equal(git(['diff',C3RB,'--',S]),'');
assert.ok((Date.now()-Date.parse(execution.startedUtc))/60000<90,'Frozen campaign budget exceeded');
for(const r of json(E+'/campaign-start.json').tooling)verify(r);
const candidate=json(E+'/candidate.json');verify(candidate);const source=json(E+'/source-inventory.json');assert.deepEqual(inventory(path.join(root,S)),source.members);checkPackage(path.join(root,S));
const archive=read(candidate.path),members=tarMembers(archive);for(const m of members)assert.ok(m.data.equals(read(S+'/'+m.path.slice(8))));
for(const r of json(E+'/assemblies.json').assemblies){verify(r.archive);assert.ok(read(r.archive.path).equals(archive));assert.deepEqual(inventory(path.join(r.root,'package')),source.members);}
assert.deepEqual(inventory(json(E+'/offline-install.json').packageDirectory),source.members);
const historical=json(E+'/historical-before.json');assert.equal(git(['rev-parse','HEAD'],historical.root),H);assert.equal(git(['status','--porcelain=v1'],historical.root),'');
for(const r of historical.files){const b=fs.readFileSync(path.join(historical.root,r.path));assert.equal(b.length,r.byteLength);assert.equal(hash(b),r.sha256,r.path);}
for(const p of ['supply','document-validation','distribution','contract','sbom','runtime-closure','assemblies','offline-install','installed-smoke','installed-persistence','source-independence','tamper-controls','historical-preservation'])assert.equal(json(E+'/'+p+'.json').result,'PASS',p);
const advisory=json(E+'/advisory-handoff.json');assert.equal(advisory.handling,'PASS');assert.equal(advisory.result,'OPEN_ADVISORY_HANDOFF');assert.equal(advisory.riskAccepted,false);
const changed=[...git(['diff','--name-only',C3RB]).split('\n'),...git(['ls-files','--others','--exclude-standard']).split('\n')].filter(Boolean);for(const p of changed)assert.ok(p.startsWith(E+'/')||p.startsWith(T+'/')||p===D,p);
git(['diff','--check']);git(['diff','--cached','--check']);
const handoff='Integrate this immutable fresh Phase 3B receipt for exact C3RB with independently accepted exact-C3RB Phase 3A and Phase 3C receipts. Bind the newly generated 89-member archive by its SHA-256 and preserve accepted historical 3B-R 5cb213eeab8a6deec39a8f8f93ea13a70e053231. Resolve the open Node July 2026 HTTP/2 advisory identity/applicability against exact Node bytes, accepted runtime/security evidence and reachable interfaces; preserve attributed MO-1305 assertions without promoting them to MO-1307 conclusions. Keep UNLICENSED/NOASSERTION and bounded advisory qualifications. Risk acceptance and release authorization require separate human/governance authority. No Phase 3D action was performed here.';
const report=[
'# MO-1307 fresh Phase 3B C3RB package certification',
'',
'**Phase 3B ACCEPTED with qualifications and an OPEN ADVISORY HANDOFF only when final-validation.json is PASS and no failure record exists.** This receipt certifies the complete frozen package/artifact/supply inventory. It does not authorize release.',
'',
'| Item | Result |',
'|---|---|',
`| Candidate | C3RB ${C3RB} |`,
'| Integration authority | 4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97 |',
'| Worktree / branch | C:/m7b / codex/mo1307-phase3b-c3rb-cert |',
'| Package / contract | memoryos-readiness@0.1.0 / memoryos.readiness@1.0.0 |',
`| Archive | ${candidate.byteLength} bytes; SHA-256 ${candidate.sha256} |`,
'| Inventory | PASS: 89 regular members, exact C3RB Git/source/archive bytes; no missing, extra, unsafe or nonregular members |',
'| Independent assemblies | PASS: two fresh clean roots, empty npm caches, identical complete archives; historical archive was only a comparison input |',
'| Offline installation | PASS: fresh root and empty cache, npm --offline --ignore-scripts --no-audit --no-fund |',
'| Installed integrity | PASS: all 89 files equal archive before and after bounded smoke; isolated negative helper mutation restored and all files checked |',
'| Runtime closure | PASS: package-local modules, fixed worker and PowerShell helper, permitted Node built-ins; installed-only resolution |',
'| Production dependencies / hooks | PASS: zero external npm dependencies, zero lifecycle hooks |',
'| Schemas / package | PASS: 52 schema meta-validations, 53 contract members, 88 distribution rows, exact generated runtime tables; 476 unchanged fixture results reused only after full dependency binding |',
'| SPDX SBOM | PASS: full pinned SPDX 2.3 schema with format checks; exact semantic recomputation; one package, 87 files, 88 relationships |',
'| Toolchain | PASS: exact Node 24.21.0 win-x64, npm 11.19.0 full 1994-file inventory, PowerShell 5.1, Python 3.12.14, seven pinned offline wheels and extracted validator files |',
'| Licenses / notices | PASS inventory; QUALIFICATION: first-party UNLICENSED/NOASSERTION, no license/publication grant; CC0-1.0 applies to SPDX metadata |',
'| Provenance | PASS: exact source/tree/archive/tooling/evidence bindings; no future commit self-reference |',
'| Tamper controls | PASS: 22 bounded rejection controls, plus final provenance byte and archive-binding controls |',
'| Node advisory | OPEN ADVISORY HANDOFF; exact HTTP/2 CVE subset and final applicability NOT ESTABLISHED; no risk acceptance |',
'| Other platforms / hosted providers | NOT APPLICABLE to this frozen Phase 3B scope; no certification inferred |',
'| Historical 3B-R | Preserved byte-identically at 5cb213eeab8a6deec39a8f8f93ea13a70e053231 |',
'| Repository status | Only new Phase 3B evidence, tooling and this report; zero production changes; no push or tag |',
'| Certification commit | The later commit containing this receipt has exact C3RB as its parent; its own future hash is intentionally not embedded |',
'',
'The managed checkout failed during setup on Windows path length before any certification check. The raw failure is retained in setup-managed-failure.json; the explicit short-path fallback succeeded. Git ownership discovery is also retained as setup, not a certification retry. The finite protocol and executed tool hashes were frozen before the single campaign. No mandatory campaign failed or was retried.',
'',
'The advisory review uses existing repository evidence only. Original MO-1307 evidence lacks individual HTTP/2 identifiers. The older MO-1305 snapshot retains eleven July CVE records and fixed-version assertions with its own scope, but does not establish the HTTP/2 mapping or resolve the later MO-1307 finding. No current upstream census, not-affected claim, or risk acceptance is asserted.',
'',
'The package smoke is the historically scoped Phase 3B API load/one safe byte vector and invalid CLI dispatch. No Phase 3A native campaign or Phase 3C security campaign was performed. The nine historical parser-specific fixture exclusions remain explicit in supply.json.',
'',
`Receipt: [certification-receipt.json](../${E}/certification-receipt.json). Provenance: [provenance.json](../${E}/provenance.json). Seal: [evidence-seal.json](../${E}/evidence-seal.json). Final validation: [final-validation.json](../${E}/final-validation.json).`,
'',
'## Exact later Phase 3D handoff',
'',handoff,''];
write(D,report.join('\n'));
const evidence=walk(path.join(root,E)).map(p=>rec(E+'/'+p));
write(E+'/provenance.json',{kind:'MO1307FreshPhase3BProvenance',version:'1.0.0',result:'PASS',createdUtc:new Date().toISOString(),source:C3RB,sourceTree:git(['rev-parse',C3RB+'^{tree}']),historical3BR:H,candidate,sourceInventory:rec(E+'/source-inventory.json'),distribution:rec(S+'/distribution-manifest.json'),sbom:rec(S+'/sbom.spdx.json'),helper:rec(S+'/helpers/windows-inspect.ps1'),report:rec(D),tooling:walk(path.join(root,T)).map(p=>rec(T+'/'+p)),evidence,noFutureCommitSelfReference:true,cyclePolicy:'Provenance binds prior evidence and report; receipt binds provenance; seal binds both; final validation binds seal. None binds itself or a future commit.'});
const checks=Object.fromEntries(json(T+'/protocol.json').mandatoryInventory.map(n=>[n,'PASS']));
write(E+'/certification-receipt.json',{kind:'MO1307FreshPhase3BCertification',version:'1.0.0',createdUtc:new Date().toISOString(),source:C3RB,integrationAuthority:'4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97',worktree:root,branch:'codex/mo1307-phase3b-c3rb-cert',result:'PHASE3B_ACCEPTED_WITH_QUALIFICATIONS',acceptanceRequires:'final-validation.json PASS with unchanged evidence seal',candidate,checks,qualification:advisory.qualifications,openAdvisoryHandoff:rec(E+'/advisory-handoff.json'),notApplicable:advisory.notApplicable,notEstablished:['Exact Node July 2026 HTTP/2 CVE subset','Final MO-1307 advisory applicability','Current internet-wide advisory census','Release authorization'],riskAccepted:false,historical3BR:{commit:H,preserved:true,scope:'Historical accepted qualified artifact certification pending final integration'},productionChanges:0,provenance:rec(E+'/provenance.json'),phase3DHandoff:handoff,phase3DPerformed:false,phase3APerformed:false,phase3CPerformed:false,noPush:true,noTag:true,noFutureCommitSelfReference:true});
const provenance=read(E+'/provenance.json'),bad=Buffer.from(provenance);bad[Math.floor(bad.length/2)]^=1;assert.throws(()=>assert.equal(hash(bad),hash(provenance)));
const badArchive={...candidate,sha256:'0'.repeat(64)};assert.throws(()=>verify(badArchive));
const sealed=[...walk(path.join(root,E)).map(p=>rec(E+'/'+p)),...walk(path.join(root,T)).map(p=>rec(T+'/'+p)),rec(D)];
write(E+'/evidence-seal.json',{kind:'MO1307FreshPhase3BEvidenceSeal',version:'1.0.0',source:C3RB,members:sealed});for(const r of sealed)verify(r);
write(E+'/final-validation.json',{result:'PASS',checkedUtc:new Date().toISOString(),source:C3RB,seal:rec(E+'/evidence-seal.json'),receipt:rec(E+'/certification-receipt.json'),provenance:rec(E+'/provenance.json'),sealedFiles:sealed.length,finalProvenanceByteTamperDetected:true,finalArchiveBindingTamperDetected:true,mandatoryInventoryComplete:true,productionChanges:0,historicalPreservation:'PASS',firstMandatoryFailure:null,campaignAttempts:1,qualification:advisory.qualifications,advisory:'OPEN_ADVISORY_HANDOFF',phase3DHandoff:handoff,commitParentMustBe:C3RB});
console.log(JSON.stringify({result:'PHASE3B_ACCEPTED_WITH_QUALIFICATIONS',candidate,receipt:rec(E+'/certification-receipt.json'),finalValidation:rec(E+'/final-validation.json'),sealedFiles:sealed.length}));
}catch(error){write(E+'/failure-final.json',{result:'FAILED/INCOMPLETE',source:C3RB,stage:'final-seal',message:error.message,stack:error.stack,retry:false,acceptedHandoff:false});console.error(error.stack);process.exitCode=1;}
