import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const root=process.cwd(), ev='repositories/cca-conformance/evidence/mo1307/phase3c';
const hash=b=>'sha256:'+createHash('sha256').update(b).digest('hex');
const read=p=>fs.readFileSync(p), json=p=>JSON.parse(read(p));
const record=p=>{const b=read(p);return {path:p,byteLength:b.length,sha256:hash(b)};};
const git=(...args)=>{const r=spawnSync('git',args,{cwd:root,encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:16*1024*1024});assert.equal(r.status,0,r.stderr);return r.stdout.trim();};
const write=(name,x)=>fs.writeFileSync(ev+'/'+name,JSON.stringify(x,null,2)+'\n',{flag:'wx'});
assert.equal(git('rev-parse','HEAD'),'976d4a04d75dadc02e30215dd5a8ddeaa2352df8');
assert.equal(git('rev-parse','HEAD^'),'198da12a6b67da0104e54f98d2c8fbecbbf4a840');
assert.equal(git('branch','--show-current'),'codex/mo1307-phase3c-security');
const binding=json('repositories/cca-conformance/evidence/mo1307/phase2d/binding.json');
const checks=binding.members.map(m=>({...record(m.path),expectedSha256:m.sha256,expectedByteLength:m.byteLength}));
for(const r of checks){assert.equal(r.sha256,r.expectedSha256,r.path);assert.equal(r.byteLength,r.expectedByteLength,r.path);}
assert.equal(git('rev-parse','HEAD^^'),binding.implementation.parent);
assert.equal(git('rev-parse','HEAD^'+'^{tree}'),binding.implementation.tree);
assert.deepEqual(git('diff-tree','--no-commit-id','--name-only','-r','HEAD').split('\n').sort(),['repositories/cca-conformance/evidence/mo1307/phase2d/binding-verification.json','repositories/cca-conformance/evidence/mo1307/phase2d/binding.json']);
write('b2-byte-verification.json',{result:'PASS',B2:git('rev-parse','HEAD'),I2:binding.implementation.commit,tree:binding.implementation.tree,binding:record('repositories/cca-conformance/evidence/mo1307/phase2d/binding.json'),boundMembers:checks.length,checks});
const manifest=json('repositories/memoryos-readiness/distribution-manifest.json');
const members=manifest.files.map(m=>{const r=record('repositories/memoryos-readiness/'+m.path);assert.equal(r.sha256,m.sha256,m.path);assert.equal(r.byteLength,m.byteLength,m.path);return r;});
const shipped=[...manifest.files.map(m=>m.path),'distribution-manifest.json'].sort();
assert.equal(shipped.length,89);assert.equal(new Set(shipped).size,89);
const prohibited=shipped.filter(p=>/(?:^|\/)(?:tests|fixtures|evidence|tools)(?:\/|$)/.test(p));assert.equal(prohibited.length,0);
const pkg=json('repositories/memoryos-readiness/package.json');
write('package-source-boundary.json',{result:'PASS',scope:'Source manifest member identity and engineering exclusion only; Phase 3B owns archive/install/supply-chain certification',shippedCount:shipped.length,engineeringMembers:prohibited,exports:pkg.exports,package:pkg,manifest:record('repositories/memoryos-readiness/distribution-manifest.json'),members});
const docs=['mo1307-contract-freeze-1','mo1307-phase1-foundation','mo1307-phase2a-readiness-core','mo1307-phase2b-evidence-graph','mo1307-phase2c-publication-inspection-correction','mo1307-phase2c-finalization-boundary-correction','mo1307-phase2c-final','mo1307-phase2d-integration'].map(n=>record('docs/'+n+'.md'));
write('authority-byte-identities.json',{documents:docs,b2Binding:record('repositories/cca-conformance/evidence/mo1307/phase2d/binding.json'),note:'Authority reading coverage is recorded by each reviewer; hashes alone are not a claim of reading.'});
write('production-baseline.json',{kind:'MO1307Phase3CProductionBaseline',members:git('ls-files','repositories/memoryos-readiness').split('\n').map(record),runtime:record('.cache/mo1307-phase3c-runtime/node.exe')});
const surfaces=[
['CLI','Untrusted argv; separate operator trust pins','cli-args.parseCliArgs / validateLaunch'],['Byte API','Untrusted detached input bytes; explicit operator pins','api-input.snapshotApiInput / foundation / fixed worker'],['Configuration','Untrusted, closed profile/stage/file selectors','parseCanonical / Configuration / cross-binding'],['Candidate','Untrusted content; independently pinned digest','Candidate / validateCandidate / authority closure'],['Manifest','Untrusted paths and byte declarations; root-pinned digest','Manifest / validateManifest / native acquisition'],['Authority input','Trusted only through independent exact raw digest pin','authority schema / verifyEvidence'],['Evidence source files','Opaque untrusted bytes; no semantic execution','native handle read / manifest length and hash / lineage'],['Claims','Untrusted normalized assertions','Evidence schema / granted claim digest / semantic cross-fields'],['Grants','Trusted-root-scoped authorization','Grant schema / exact source,scope,dependencies,applicability'],['Dependencies','Untrusted explicit identities','component closure and stale checks'],['History','Authority-pinned immutable outcomes','evidence-history and qualification cross references'],['Qualifications','Closed authority-bound disclosures','qualification schema / seven predicates / union completeness'],['Provider state','Independent assertion axes','provider schemas / exact minima / promotion constraints'],['Human decision','External unauthenticated claim','verifyReadiness / checkDecisionBinding'],['Tag observation','Supplied whole-candidate fact; no live Git authority','TagObservation / stage-specific conditions'],['Helper wire','Private child bytes untrusted until validated','framing / strict J / exact session sequence operation schemas'],['PowerShell launch','Fixed trusted native inspection capability','helper-transport fixed exe and packaged script; restricted env'],['Worker message','Fixed worker result still admitted defensively','runtime message admission and exit settlement'],['Publication token/capability','Private branded single-use authority','WeakMap/WeakSet membership and phase/root/session checks'],['Output filesystem','Exclusive private immutable root; native observations','Windows identity chain / pending stage / one admitted rename'],['stdout/stderr','Unreliable bounded output sink','writeSummary / writeDiagnostic fixed projection'],['Package/runtime boundary','Trusted provisioned runtime and immutable shipped source','package exports / source manifest / launch policy']
].map(([surface,trust,validator],i)=>({id:i+1,surface,trust,validator}));
write('attack-surface-inventory.json',{kind:'MO1307Phase3CClosedAttackSurfaceInventory',count:surfaces.length,surfaces});
console.log(JSON.stringify({result:'PASS',boundMembers:checks.length,packageMembers:shipped.length,surfaces:surfaces.length}));
