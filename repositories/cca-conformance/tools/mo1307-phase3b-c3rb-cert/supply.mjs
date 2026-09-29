// Fresh Phase 3B supply inventory; historical evidence is read only by exact Git object.
// Execute once from the isolated C3RB worktree after the finite campaign is frozen.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {pathToFileURL} from 'node:url';
import {canonical, packageFiles} from '../mo1307-phase1/package.mjs';
import {root,E,S,C3RB,node,npm,hash,read,json,rec,write,git,walk,command} from './common.mjs';

const HISTORY='5cb213eeab8a6deec39a8f8f93ea13a70e053231';
const H='repositories/cca-conformance/evidence/mo1307/phase3b-refresh';
const P2='repositories/cca-conformance/evidence/mo1307/phase2d/regressions/cheap-attempt2';
const startedUtc=new Date().toISOString();
const historical=new Map();
const ident=bytes=>({byteLength:bytes.length,sha256:hash(bytes)});
const bare=value=>value.replace(/^sha256:/,'');
function loadBlobs(paths){
  const missing=[...new Set(paths)].filter(p=>!historical.has(p));
  if(!missing.length)return;
  for(const p of missing)assert.ok(!/[\r\n]/.test(p),'Unsafe Git path');
  const run=spawnSync('C:/Program Files/Git/cmd/git.exe',['-c','safe.directory='+root.replaceAll('\\','/'),'cat-file','--batch'],{cwd:root,input:missing.map(p=>HISTORY+':'+p+'\n').join(''),encoding:null,windowsHide:true,timeout:120000,maxBuffer:64*1024*1024});
  assert.ifError(run.error);assert.equal(run.status,0,run.stderr?.toString());
  const out=run.stdout;let offset=0;
  for(const p of missing){
    const end=out.indexOf(10,offset);assert.ok(end>=offset,'Incomplete Git header');
    const header=out.subarray(offset,end).toString();
    const match=/^[a-f0-9]{40} blob ([0-9]+)$/.exec(header);assert.ok(match,'Missing historical blob '+p+': '+header);
    const size=Number(match[1]);offset=end+1;assert.ok(offset+size<out.length,'Truncated Git blob');
    historical.set(p,Buffer.from(out.subarray(offset,offset+size)));offset+=size;assert.equal(out[offset++],10);
  }
  assert.equal(offset,out.length,'Unexpected Git batch output');
}
function blob(p){loadBlobs([p]);return historical.get(p);}
function oldJSON(p){return JSON.parse(blob(p));}
function historicalRef(p){return {commit:HISTORY,path:p,...ident(blob(p))};}
function equalHistorical(p){
  const prior=blob(p),current=read(p);assert.ok(current.equals(prior),'Historical dependency changed: '+p);
  return {path:p,historical:ident(prior),current:ident(current),byteEqual:true};
}
function verifyBinding(row,bytes=read(row.path)){
  const current=ident(bytes);assert.equal(current.byteLength,row.byteLength,'Length mismatch '+row.path);
  assert.equal(current.sha256,bare(row.sha256),'Hash mismatch '+row.path);return {path:row.path,...current};
}
assert.equal(git(['rev-parse','HEAD']),C3RB,'Certification baseline differs');
assert.equal(C3RB,'defe93989efc6501b1a730b82e79e705884b269b');
assert.equal(E,'repositories/cca-conformance/evidence/mo1307/phase3b-c3rb-cert','Fresh evidence destination required');
assert.equal(process.platform,'win32');assert.equal(process.arch,'x64');
assert.equal(process.versions.node,'24.21.0');assert.equal(path.resolve(process.execPath),path.resolve(node));
assert.ok(Number(os.release().split('.')[2])>=22000,'Native Windows 11 required');

loadBlobs([H+'/certification-receipt.json',H+'/final-validation.json',H+'/evidence-seal.json',H+'/document-validation.json']);
const accepted=oldJSON(H+'/certification-receipt.json'),final=oldJSON(H+'/final-validation.json');
assert.equal(accepted.baseline.commit,C3RB);assert.equal(accepted.result,'QUALIFIED_PHASE3BR_PASS_PENDING_PHASE3D');
assert.equal(final.result,'PASS');assert.equal(final.source,C3RB);
verifyBinding(final.receipt,blob(final.receipt.path));verifyBinding(final.seal,blob(final.seal.path));
loadBlobs(packageFiles.map(p=>S+'/'+p));
const packageEquality=packageFiles.map(p=>equalHistorical(S+'/'+p));
assert.equal(packageEquality.length,89);

// The prior schema fixture slice is reusable only with every recorded input unchanged.
const schemaAuthorityPaths=['schemas.stdout.txt','schemas.stderr.txt','receipt.json','inputs-before.json','inputs-after.json'].map(p=>P2+'/'+p);
loadBlobs(schemaAuthorityPaths);
const schemaAuthority=schemaAuthorityPaths.map(equalHistorical);
const schemaRun=oldJSON(P2+'/schemas.stdout.txt'),schemaReceipt=oldJSON(P2+'/receipt.json');
assert.equal(schemaRun.result,'PASS');assert.equal(schemaRun.schemas,52);
assert.equal(schemaRun.positiveFixtures,464);assert.equal(schemaRun.negativeFixtures,12);
const schemaCommand=schemaReceipt.commands.find(x=>x.id==='schemas');assert.ok(schemaCommand);
assert.equal(schemaCommand.result,'PASS');assert.equal(schemaCommand.exit,0);
verifyBinding(schemaCommand.stdout);verifyBinding(schemaCommand.stderr);
const schemaDependencyPins=[schemaRun.tool,schemaRun.lock,schemaRun.catalog,...schemaRun.schemaFiles,schemaRun.spdxSBOM.schema];
loadBlobs(schemaDependencyPins.map(r=>r.path));
for(const row of schemaDependencyPins)verifyBinding(row);
const schemaDependencyEquality=schemaDependencyPins.map(r=>equalHistorical(r.path));
const catalog=json(schemaRun.catalog.path),fixtureRoot='repositories/cca-conformance/fixtures/mo1307/';
const fixturePaths=[...new Set(catalog.entries.filter(e=>'schema' in e&&e.schemaValid!==null).map(e=>fixtureRoot+e.path))].sort();
assert.equal(fixturePaths.length,476,'Exact fixture inventory');
assert.equal(catalog.entries.filter(e=>'schema' in e&&e.schemaValid===true).length,464);
assert.equal(catalog.entries.filter(e=>'schema' in e&&e.schemaValid===false).length,12);
const before=new Map(oldJSON(P2+'/inputs-before.json').map(r=>[r.path,r]));
const after=new Map(oldJSON(P2+'/inputs-after.json').map(r=>[r.path,r]));
loadBlobs(fixturePaths);
const fixtureEquality=fixturePaths.map(p=>{
  assert.ok(before.has(p)&&after.has(p),'Incomplete historical input closure '+p);
  verifyBinding(before.get(p));verifyBinding(after.get(p));return equalHistorical(p);
});
const runtimeSchemaPaths=['src/schema.mjs','src/schema-data.mjs','src/constants.mjs','src/canonical.mjs','src/errors.mjs','contracts/definitions.json'].map(p=>S+'/'+p);
loadBlobs(runtimeSchemaPaths);const runtimeSchemaEquality=runtimeSchemaPaths.map(equalHistorical);
const contract=json(S+'/contracts/contract.json');assert.equal(contract.files.length,53);
for(const row of contract.files)verifyBinding({...row,path:S+'/'+row.path});

// Official Node/npm provenance acquisition is historical; all installed bytes are rebound now.
const toolRel='repositories/cca-conformance/evidence/mo1305-phase3br/toolchain.json';
const provenanceRel='repositories/cca-conformance/evidence/mo1305-phase1-aux/toolchain-provenance.json';
loadBlobs([toolRel,provenanceRel]);const tool=json(toolRel),provenance=json(provenanceRel);
const toolchainProvenance=[equalHistorical(toolRel),equalHistorical(provenanceRel)];
const toolRoot=path.dirname(node),toolRows=walk(toolRoot).map(p=>({path:p,...ident(fs.readFileSync(path.join(toolRoot,p)))}));
const toolchainInventorySha256=hash(Buffer.from(canonical(toolRows)));
assert.equal(toolRows.length,tool.toolchainFileCount);assert.equal(toolRows.length,1994);
assert.equal(toolchainInventorySha256,tool.toolchainInventorySha256);
const nodeIdentity=ident(fs.readFileSync(node));assert.deepEqual(nodeIdentity,tool.node);
assert.equal(nodeIdentity.byteLength,93580104);assert.equal(nodeIdentity.sha256,'ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32');
const npmPackage=path.join(toolRoot,'node_modules/npm/package.json');
assert.deepEqual(ident(fs.readFileSync(npm)),tool.npmCli);assert.deepEqual(ident(fs.readFileSync(npmPackage)),tool.npmPackageJson);
assert.equal(JSON.parse(fs.readFileSync(npmPackage)).version,'11.19.0');
const provenancePins=['checksums','signedChecksums','keyring','diagnostic','status'].map(k=>provenance[k]);
loadBlobs(provenancePins.map(r=>r.path));
for(const row of provenancePins){verifyBinding(row);toolchainProvenance.push(equalHistorical(row.path));}
const nodeNotice=toolRows.find(r=>r.path==='LICENSE');assert.ok(nodeNotice);assert.equal(nodeNotice.sha256,bare(provenance.noticeSha256));
write(E+'/toolchain-inventory.json',{result:'PASS',historicalAuthority:historicalRef(toolRel),fileCount:toolRows.length,inventorySha256:toolchainInventorySha256,encoding:'UTF-8 recursively sorted-key compact JSON of sorted relative path rows; no trailing LF',members:toolRows});

const nativeRel='repositories/cca-conformance/evidence/mo1307/phase1/native-environment.json';
loadBlobs([nativeRel]);const priorNative=json(nativeRel);const nativeAuthority=equalHistorical(nativeRel);
const powershellPath=priorNative.systemPowerShellPath,powershellIdentity=ident(fs.readFileSync(powershellPath));
assert.equal(powershellIdentity.sha256,bare(priorNative.systemPowerShellSha256));
const psVersion=command('supply-powershell-version',powershellPath,['-NoLogo','-NoProfile','-NonInteractive','-Command','$PSVersionTable.PSVersion.ToString()'],{env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'}}).output.trim();
assert.match(psVersion,/^5\.1\./);
const {helperLaunchSpecification}=await import(pathToFileURL(path.join(root,S,'src/helper-transport.mjs')));
const launch=helperLaunchSpecification();assert.equal(launch.executable,powershellPath);
assert.equal(path.resolve(launch.args.at(-1)),path.resolve(root,S,'helpers/windows-inspect.ps1'));
assert.deepEqual(Object.keys(launch.options.env).sort(),['SystemRoot','WINDIR']);

// Lock, all seven retained wheels, interpreter and each engineering notice are explicit.
const lock=json(schemaRun.lock.path),priorDocuments=oldJSON(H+'/document-validation.json');
assert.equal(lock.python,'3.12.14');assert.equal(lock.dependencies.length,7);
const pythonPath=priorDocuments.pythonExecutable.path,pythonIdentity=verifyBinding(priorDocuments.pythonExecutable,fs.readFileSync(pythonPath));
assert.equal(pythonIdentity.sha256,bare(schemaRun.pythonExecutable.sha256));
assert.equal(pythonIdentity.byteLength,schemaRun.pythonExecutable.byteLength);
const wheels=[],validatorNotices=[];
loadBlobs(lock.dependencies.flatMap(d=>d.notices));
for(const dependency of lock.dependencies){
  const prior=priorDocuments.wheelChecks.find(w=>w.name===dependency.name),fixturePrior=schemaRun.wheelChecks.find(w=>w.name===dependency.name);
  assert.ok(prior&&fixturePrior,'Missing wheel history '+dependency.name);
  for(const row of [prior,fixturePrior]){assert.equal(row.version,dependency.version);assert.equal(row.byteLength,dependency.byteLength);assert.equal(bare(row.sha256),bare(dependency.sha256));}
  const wheelIdentity=verifyBinding({...dependency,path:prior.path},fs.readFileSync(prior.path));
  wheels.push({name:dependency.name,version:dependency.version,role:'ENGINEERING_ONLY',license:dependency.license,requires:dependency.requires,...wheelIdentity});
  for(const notice of dependency.notices){const equality=equalHistorical(notice);assert.ok(equality.current.byteLength>0);validatorNotices.push({dependency:dependency.name,license:dependency.license,...equality});}
}
const pkg=json(S+'/package.json');assert.deepEqual(pkg.dependencies,{});assert.ok(!Object.hasOwn(pkg,'scripts'));
assert.equal(pkg.license,'UNLICENSED');const sbom=json(S+'/sbom.spdx.json');
assert.equal(sbom.dataLicense,'CC0-1.0');assert.equal(sbom.packages.length,1);
for(const field of ['licenseConcluded','licenseDeclared','copyrightText'])assert.equal(sbom.packages[0][field],'NOASSERTION');
const licenseRows=['LICENSE-NOTICE.md','NOTICES.md','package.json'].map(p=>equalHistorical(S+'/'+p));
const npmNotices=toolRows.filter(r=>/^(?:LICENSE|node_modules\/npm\/(?:LICENSE|docs\/content\/using-npm\/license\.md))$/i.test(r.path));
assert.ok(npmNotices.some(r=>r.path==='node_modules/npm/LICENSE'),'npm notice missing');

const result={
  kind:'MO1307FreshPhase3BSupplyInventory',version:'1.0.0',result:'PASS',state:'PASS',startedUtc,finishedUtc:new Date().toISOString(),source:C3RB,
  historicalAuthority:{commit:HISTORY,receipt:historicalRef(H+'/certification-receipt.json'),finalValidation:historicalRef(H+'/final-validation.json'),seal:historicalRef(H+'/evidence-seal.json'),scope:'Accepted historical exact-C3RB 3B-R, retained unchanged. Reuse below is limited to exact dependency-bound slices.'},
  platform:{platform:process.platform,architecture:process.arch,osRelease:os.release(),nativeWindows11:true},
  packageEquality:{members:89,allExactHistoricalBytes:true,rows:packageEquality},
  node:{classification:'EXACT_DEPENDENCY_REBOUND',path:node,version:process.versions.node,...nodeIdentity,componentVersions:process.versions,provenanceBindings:toolchainProvenance,provenanceAcquisitionRepeated:false},
  npm:{classification:'EXACT_DEPENDENCY_REBOUND',version:'11.19.0',role:'Engineering/offline install only',cli:{path:npm,...tool.npmCli},packageJson:{path:npmPackage,...tool.npmPackageJson},toolchainFileCount:toolRows.length,toolchainInventorySha256,inventory:rec(E+'/toolchain-inventory.json')},
  powershell:{classification:'EXACT_DEPENDENCY_REBOUND',path:powershellPath,version:psVersion,...powershellIdentity,historicalIdentitySource:nativeAuthority,launch,helper:rec(S+'/helpers/windows-inspect.ps1')},
  contract:{classification:'EXACT_DEPENDENCY_REUSE',manifest:rec(S+'/contracts/contract.json'),members:53,allMemberBindingsVerified:true},
  schemas:{classification:'EXACT_DEPENDENCY_REUSE',count:52,authority:schemaAuthority,dependencies:schemaDependencyEquality,runtimeDependencies:runtimeSchemaEquality,fixtureRows:fixtureEquality,completeFixtureValidationReused:{positive:464,negative:12,checked:476,parserFixturesSkipped:schemaRun.parserFixturesSkipped,source:P2+'/schemas.stdout.txt',historicalCommit:HISTORY,scope:'Only unchanged schema/contract and fixture-result slices. Historical distribution/SBOM validation is excluded; fresh package document validation is separate.'}},
  engineeringValidators:{lock:rec(schemaRun.lock.path),python:{version:lock.python,...pythonIdentity},validator:schemaRun.validator,wheels,notices:validatorNotices,retainedCache:'Read-only; no dependency acquisition. The fresh document validator separately verifies all extracted members before any import.',thirdPartyValidatorsExecutedByThisScript:false},
  licenses:{classification:'EXACT_DEPENDENCY_REUSE',rows:licenseRows,firstParty:'UNLICENSED/NOASSERTION; pending licensing, no product or publication grant',spdxDataLicense:'CC0-1.0 metadata only',externalProductionDependencies:0,nodeNotice,npmNotices,engineeringNoticeCount:validatorNotices.length,platformScope:'Node/npm notices bind separately provisioned runtime/tooling; system PowerShell remains an externally provisioned Windows dependency.'},
  productionDependencies:0,lifecycleHooks:0,advisory:{result:'OPEN_ADVISORY_HANDOFF',automaticSameDateReuse:false,scope:'Historical advisory evidence and fresh bounded handoff are handled separately. This tool makes no current vulnerability, CVE, affectedness or risk-acceptance claim.'},
  reuseScope:'Explicit exact dependency and scope checks under Freeze section 8. No archive, assembly, installation, tamper or complete fresh receipt result is inherited.',
  noFixtureCampaignExecuted:true,noProductionChanges:true,noNetworkAcquisition:true,finalReleaseAuthorization:false,
};
assert.equal(git(['rev-parse','HEAD']),C3RB,'Baseline changed during supply review');
write(E+'/supply.json',result);
// Compatibility with the bounded tamper harness; this is the same new generation only.
write(E+'/reuse-details.json',result);
console.log(JSON.stringify({result:'PASS',source:C3RB,historical:HISTORY,packageMembers:89,schemas:52,fixturesReused:476,node:process.versions.node,npm:'11.19.0',toolchainFiles:1994,engineeringWheels:7,powershell:psVersion}));
