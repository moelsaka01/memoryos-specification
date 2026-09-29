import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..');
const oldRoot = 'C:/Users/melsa/Documents/Codex/cca-mo1307-3b';
const C3RB = 'defe93989efc6501b1a730b82e79e705884b269b';
const C3R = '58c98b7eb0aa2d07bab78753ce66b564066aafeb';
const oldCommit = '85dea823385e1ccaddcd9997c3918b1312175eba';
const packageRel = 'repositories/memoryos-readiness/';
const output = path.join(root, 'repositories/cca-conformance/evidence/mo1307/phase3b-refresh');
const oldReceiptRel = 'repositories/cca-conformance/evidence/mo1307/phase3b/certification-receipt.json';
const phase2d = 'repositories/cca-conformance/evidence/mo1307/phase2d/regressions/cheap-attempt2/';
const correction = 'repositories/cca-conformance/evidence/mo1307/phase3a-readset-correction/';
const read = (rel, base=root) => fs.readFileSync(path.join(base, rel));
const json = (rel, base=root) => JSON.parse(read(rel, base));
const digest = data => createHash('sha256').update(data).digest('hex');
const identity = data => ({ byteLength: data.length, sha256: digest(data) });
const ref = (rel, base=root) => ({ path: rel, ...identity(read(rel,base)) });
const stable = value => Array.isArray(value) ? value.map(stable) : value && typeof value === 'object' ? Object.fromEntries(Object.keys(value).sort().map(k=>[k,stable(value[k])])) : value;
const canonical = value => JSON.stringify(stable(value));
function git(base,args) {
  const p=spawnSync('git',['-c',`safe.directory=${base.replaceAll('\\','/')}`,'-C',base,...args],{encoding:'utf8',windowsHide:true});
  assert.equal(p.status,0,p.stderr); return p.stdout.trim();
}
function equal(rel) {
  const oldBytes=read(rel,oldRoot), newBytes=read(rel);
  assert.ok(oldBytes.equals(newBytes),`Old/C3RB dependency changed: ${rel}`);
  return {path:rel,old:identity(oldBytes),current:identity(newBytes),byteEqual:true};
}
function bound(row,base=root) {
  const actual=ref(row.path,base);
  assert.equal(actual.byteLength,row.byteLength,`Length ${row.path}`);
  assert.equal(actual.sha256,row.sha256.replace(/^sha256:/,''),`Hash ${row.path}`);
  return actual;
}
function walk(base,rel='') {
  const result=[];
  for(const entry of fs.readdirSync(path.join(base,rel),{withFileTypes:true})) {
    const name=(rel ? rel+'/' : '')+entry.name;
    assert.ok(!entry.isSymbolicLink(),`Symlink ${name}`);
    if(entry.isDirectory()) result.push(...walk(base,name));
    else {assert.ok(entry.isFile(),`Nonregular ${name}`);result.push(name);}
  }
  return result.sort();
}
function save(name,value) {
  fs.mkdirSync(output,{recursive:true});
  fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n');
}
assert.equal(root.replaceAll('\\','/'),'C:/Users/melsa/Documents/Codex/r3b');
assert.equal(git(root,['rev-parse','HEAD']),C3RB);
assert.equal(git(oldRoot,['rev-parse','HEAD']),oldCommit);
assert.equal(git(oldRoot,['status','--porcelain=v1']),'');
const oldReceipt=json(oldReceiptRel,oldRoot);
const oldAuthority={commit:oldCommit,parent:git(oldRoot,['rev-parse','HEAD^']),report:ref('docs/mo1307-phase3b-package-certification.md',oldRoot),receipt:ref(oldReceiptRel,oldRoot)};
assert.equal(oldAuthority.parent,'976d4a04d75dadc02e30215dd5a8ddeaa2352df8');
const packageJson=json(packageRel+'package.json');
const oldPackage=json(packageRel+'package.json',oldRoot);
assert.deepEqual(packageJson.files,oldPackage.files);
const packageMemberChecks=packageJson.files.map(name=>{
  const before=read(packageRel+name,oldRoot), after=read(packageRel+name);
  return {path:name,old:identity(before),current:identity(after),byteEqual:before.equals(after)};
});
const changed=packageMemberChecks.filter(x=>!x.byteEqual).map(x=>x.path).sort();
assert.deepEqual(changed,['distribution-manifest.json','helpers/windows-inspect.ps1','sbom.spdx.json']);
assert.equal(packageMemberChecks.length,89);
const contract=json(packageRel+'contracts/contract.json');
assert.equal(contract.files.length,53);
const contractRows=contract.files.map(r=>{
  bound({...r,path:packageRel+r.path});
  return equal(packageRel+r.path);
});
const schemaRows=contractRows.filter(x=>x.path.includes('/schemas/'));
assert.equal(schemaRows.length,52);
const contractManifest=equal(packageRel+'contracts/contract.json');
const schemaRun=json(phase2d+'schemas.stdout.txt');
assert.equal(schemaRun.result,'PASS');
assert.equal(schemaRun.schemas,52);assert.equal(schemaRun.positiveFixtures,464);assert.equal(schemaRun.negativeFixtures,12);
const schemaReceipt=json(phase2d+'receipt.json');
const schemaCommand=schemaReceipt.commands.find(x=>x.id==='schemas');
assert.equal(schemaCommand.result,'PASS');bound(schemaCommand.stdout);bound(schemaCommand.stderr);
const inheritedSchemaEvidence=[phase2d+'schemas.stdout.txt',phase2d+'schemas.stderr.txt',phase2d+'receipt.json',phase2d+'inputs-before.json',phase2d+'inputs-after.json'].map(equal);
const schemaTools=[schemaRun.tool.path,schemaRun.lock.path,schemaRun.spdxSBOM.schema.path].map(equal);
[schemaRun.tool,schemaRun.lock,schemaRun.catalog,...schemaRun.schemaFiles,schemaRun.spdxSBOM.schema].forEach(x=>bound(x));
const catalog=json(schemaRun.catalog.path);
const fixtureRoot='repositories/cca-conformance/fixtures/mo1307/';
const fixturePaths=[...new Set(catalog.entries.filter(e=>'schema' in e && e.schemaValid!==null).map(e=>fixtureRoot+e.path))].sort();
const originalInputs=json(phase2d+'inputs-before.json');
const inputIndex=new Map(originalInputs.map(x=>[x.path,x]));
const fixtureRows=fixturePaths.map(rel=>{assert.ok(inputIndex.has(rel),`Historical fixture binding ${rel}`);bound(inputIndex.get(rel));return equal(rel);});
const fixtureCatalog=equal(schemaRun.catalog.path);
assert.equal(catalog.entries.filter(e=>'schema' in e && e.schemaValid===true).length,464);
assert.equal(catalog.entries.filter(e=>'schema' in e && e.schemaValid===false).length,12);
const schemaRuntime=['src/schema.mjs','src/schema-data.mjs','src/constants.mjs','src/canonical.mjs','src/errors.mjs','contracts/definitions.json'].map(p=>equal(packageRel+p));
const validatorLock=json(schemaRun.lock.path);
for(const wheel of schemaRun.wheelChecks){const pin=validatorLock.dependencies.find(x=>x.name===wheel.name);assert.ok(pin);assert.equal(pin.sha256,wheel.sha256);assert.equal(pin.byteLength,wheel.byteLength);assert.equal(pin.version,wheel.version);}
const sanity={state:'PASS',schemasParsed:0,localReferences:0,remoteReferences:0};
const schemaMap=new Map(schemaRows.map(r=>[path.basename(r.path),json(r.path)]));
function visit(value) {
  if(!value || typeof value!=='object')return;
  if(typeof value.$ref==='string'){
    const [url,fragment='']=value.$ref.split('#');
    const target=url ? schemaMap.get(url.split('/').at(-1)) : null;
    if(url){assert.ok(target,`Nonlocal schema reference ${value.$ref}`);sanity.localReferences++;}
    if(target && fragment){let cursor=target;for(const key of fragment.split('/').slice(1)){cursor=cursor[key.replaceAll('~1','/').replaceAll('~0','~')];assert.notEqual(cursor,undefined,`Unresolved ${value.$ref}`);}}
  }
  for(const child of Object.values(value))visit(child);
}
for(const schema of schemaMap.values()){assert.equal(schema.$schema,'https://json-schema.org/draft/2020-12/schema');visit(schema);sanity.schemasParsed++;}

const nodePath=process.execPath, toolRoot=path.dirname(nodePath);
const priorToolRel='repositories/cca-conformance/evidence/mo1305-phase3br/toolchain.json';
const priorTool=json(priorToolRel);
const toolchainRows=walk(toolRoot).map(rel=>({path:rel,...identity(fs.readFileSync(path.join(toolRoot,rel)))}));
const toolchainDigest=digest(Buffer.from(canonical(toolchainRows)));
assert.equal(toolchainRows.length,priorTool.toolchainFileCount);
assert.equal(toolchainDigest,priorTool.toolchainInventorySha256);
const nodeIdentity=identity(fs.readFileSync(nodePath));
assert.deepEqual(nodeIdentity,priorTool.node);
assert.equal(nodeIdentity.sha256,oldReceipt.platform.node.sha256);assert.equal(process.versions.node,'24.21.0');
const npmCli=path.join(toolRoot,'node_modules/npm/bin/npm-cli.js');
const npmPackage=path.join(toolRoot,'node_modules/npm/package.json');
assert.deepEqual(identity(fs.readFileSync(npmCli)),priorTool.npmCli);
assert.deepEqual(identity(fs.readFileSync(npmPackage)),priorTool.npmPackageJson);
assert.equal(JSON.parse(fs.readFileSync(npmPackage)).version,'11.19.0');
const nodeProvenanceRel='repositories/cca-conformance/evidence/mo1305-phase1-aux/toolchain-provenance.json';
const nodeProvenance=json(nodeProvenanceRel);
const provenanceBindings=[equal(priorToolRel),equal(nodeProvenanceRel)];
for(const field of ['checksums','signedChecksums','keyring','diagnostic','status']){const row=nodeProvenance[field];bound(row);provenanceBindings.push(equal(row.path));}
const nodeNotice=toolchainRows.find(r=>r.path==='LICENSE');assert.equal(nodeNotice.sha256,nodeProvenance.noticeSha256);
const powerRel='repositories/cca-conformance/evidence/mo1307/phase1/native-environment.json';
const priorPower=json(powerRel);
const powerIdentity=identity(fs.readFileSync(priorPower.systemPowerShellPath));
assert.equal(powerIdentity.sha256,priorPower.systemPowerShellSha256.replace(/^sha256:/,''));
const powerVersion=spawnSync(priorPower.systemPowerShellPath,['-NoLogo','-NoProfile','-NonInteractive','-Command','$PSVersionTable.PSVersion.ToString()'],{encoding:'utf8',windowsHide:true,cwd:root,env:{SystemRoot:'C:\\Windows',WINDIR:'C:\\Windows'}});
assert.equal(powerVersion.status,0,powerVersion.stderr);assert.match(powerVersion.stdout.trim(),/^5\.1\./);
const launchDependency=equal(packageRel+'src/helper-transport.mjs');
const {helperLaunchSpecification}=await import(pathToFileURL(path.join(root,packageRel+'src/helper-transport.mjs')));
const launch=helperLaunchSpecification();
assert.equal(launch.executable,priorPower.systemPowerShellPath);
assert.equal(path.resolve(launch.args.at(-1)),path.join(root,packageRel+'helpers/windows-inspect.ps1'));
assert.deepEqual(Object.keys(launch.options.env).sort(),['SystemRoot','WINDIR']);
const licenseRows=['LICENSE-NOTICE.md','NOTICES.md','package.json'].map(p=>equal(packageRel+p));
assert.equal(packageJson.license,'UNLICENSED');assert.deepEqual(packageJson.dependencies,{});
const oldSbom=json(packageRel+'sbom.spdx.json',oldRoot),newSbom=json(packageRel+'sbom.spdx.json');
const licenseFields=['licenseConcluded','licenseDeclared','copyrightText'];
const sbomLicenses=licenseFields.map(field=>{assert.equal(newSbom.packages[0][field],oldSbom.packages[0][field]);return {field,value:newSbom.packages[0][field]};});
const networkSources=packageJson.files.filter(x=>x.endsWith('.mjs')).map(p=>({path:p,text:read(packageRel+p).toString()}));
const networkImports=[];
for(const row of networkSources)for(const m of row.text.matchAll(/(?:from\s*|import\s*\(|require\s*\()(['"])([^'"]+)\1/g))if(/^(?:node:)?(?:http|https|http2|net|tls|dgram|dns)(?:\/|$)/.test(m[2]))networkImports.push({path:row.path,specifier:m[2]});
assert.deepEqual(networkImports,[]);
const definitions=json(packageRel+'contracts/definitions.json');assert.equal(definitions.topology.network,false);
const helperText=read(packageRel+'helpers/windows-inspect.ps1').toString();
assert.ok(!/Invoke-WebRequest|Invoke-RestMethod|System\.Net\.|WebClient|TcpClient|DownloadString/.test(helperText));
const now=new Date();const reviewDate=now.toISOString().slice(0,10);
assert.equal(reviewDate,oldReceipt.advisory.date,'Date advanced: advisory refresh scope requires reassessment');
const advisory={kind:'MO1307Phase3BRAdvisoryCarryForward',version:'1.0.0',state:'PASS_WITH_OPEN_PHASE3D_DISPOSITION',createdUtc:now.toISOString(),reviewDate,originalReviewDate:oldReceipt.advisory.date,authority:oldAuthority,sourceAcquisition:'No new current advisory source consulted; original same-date review and sources are preserved.',historicalSourceUrls:oldReceipt.advisory.sources,componentIdentities:[{component:'Node.js',version:process.versions.node,...nodeIdentity},{component:'npm',version:'11.19.0',role:'Engineering/offline install only',toolchainInventorySha256:toolchainDigest},{component:'Windows PowerShell',version:powerVersion.stdout.trim(),...powerIdentity}],changedComponentAssessment:{changedProductionMember:'helpers/windows-inspect.ps1',old:packageMemberChecks.find(x=>x.path==='helpers/windows-inspect.ps1').old,current:packageMemberChecks.find(x=>x.path==='helpers/windows-inspect.ps1').current,correctionAuthority:ref('docs/mo1307-phase3a-readset-correction.md'),claim:'C3R evidence characterizes removal of repeated lexical path validation as performance optimization with contract/security behavior preserved for retained correction cases. Phase 3B-R certifies exact artifact identity and does not certify security equivalence.',newDependencyOrLicense:false,newNetworkAuthority:false},nodeHttp2Finding:{component:'Node.js',version:'24.21.0',advisory:'Original Phase 3B Node July 2026 HTTP/2 findings',url:'https://nodejs.org/en/blog/vulnerability/july-2026-security-releases',identifiers:'Original Phase 3B receipt did not retain individual advisory/CVE identifiers; none are invented here.',productNetworkBoundary:'MemoryOS Readiness declares topology.network=false; the package is offline, has no external production npm dependencies, and does not import Node HTTP/2 or other listed network built-ins.',reachabilityEvidenceAvailable:{definitions:ref(packageRel+'contracts/definitions.json'),runtimeSources:networkSources.map(x=>ref(packageRel+x.path)),networkImports,helper:ref(packageRel+'helpers/windows-inspect.ps1'),inspection:'Static package source boundary only; Node contains HTTP/2 internally. No dynamic exploitability or release-level risk conclusion follows.'},status:'OPEN_PHASE3D_DISPOSITION_REQUIRED',riskAccepted:false,affectsMO1307Claim:false,remainingPhase3DRequirement:'Identify and reconcile the original July 2026 HTTP/2 advisories against exact Node 24.21.0, the accepted Phase 3A-R runtime and Phase 3C-R security inputs, product network boundary and reachable attack surface. Document final applicability/disposition and any necessary authority decision; do not infer affectedness from bundled HTTP/2 or close this item from the helper change.'},otherOpenFindings:['Repository/product licensing remains UNLICENSED/NOASSERTION; notices provide no release or publication grant.','Final cross-phase advisory disposition remains required; the bounded review is not a zero-vulnerability claim.'],finalReleaseAuthorization:false,riskAccepted:false};
save('advisory-carry-forward.json',advisory);
const result={kind:'MO1307Phase3BRReuseDependencyEvidence',version:'1.0.0',state:'PASS',createdUtc:now.toISOString(),C3RB,C3R,oldAuthority,oldPreservation:{clean:true,commitUnchanged:true},originalEvidenceGranularity:'Original Phase 3B has a report, exact archive, archive inventory, installed before/after inventories, tamper record and certification receipt. Toolchain, schemas, licenses, advisory and assembly summaries are receipt fields, not separate retained Phase 3B execution records. Exact ancestor evidence is explicitly identified below.',packageComparison:{members:89,unchanged:86,changed,rows:packageMemberChecks},contract:{classification:'UNCHANGED_REUSABLE',members:53,manifest:contractManifest,rows:contractRows},schemas:{classification:'UNCHANGED_REUSABLE',count:52,rows:schemaRows,completeFixtureValidationReused:{positive:464,negative:12,checked:476,uniqueFixtureFiles:fixtureRows.length,parserFixturesSkipped:schemaRun.parserFixturesSkipped,authority:inheritedSchemaEvidence,fixtureCatalog,fixtureRows,toolDependencies:schemaTools,runtimeSchemaDependencies:schemaRuntime,historicalValidator:{version:schemaRun.validator,python:schemaRun.python,pythonExecutable:schemaRun.pythonExecutable,wheelChecks:schemaRun.wheelChecks,loadedVerifiedModules:schemaRun.loadedVerifiedModules,lockMatches:true},scope:'Reuse of schema definitions, contract validation and fixture-result slices only. Historical distribution/SBOM validation slices have changed inputs and are excluded from reuse. Cached validators are not executed or reacquired for this reuse decision; exact retained lock, tool, receipt and input identities bind historical execution.'},boundedSanity:sanity},node:{classification:'UNCHANGED_REUSABLE',path:nodePath,version:process.versions.node,...nodeIdentity,componentVersions:process.versions,provenanceBindings,provenanceAcquisitionRepeated:false},npm:{classification:'UNCHANGED_REUSABLE',version:'11.19.0',role:'Engineering/offline install only',cli:{path:npmCli,...identity(fs.readFileSync(npmCli))},packageJson:{path:npmPackage,...identity(fs.readFileSync(npmPackage))},historicalIdentitySource:ref(priorToolRel),toolchainFileCount:toolchainRows.length,toolchainInventorySha256:toolchainDigest,inventoryEncoding:'UTF-8 JSON, recursively sorted keys, compact separators, sorted relative paths, no trailing LF',toolchainRows,limitation:'Original Phase 3B retained version only for npm. Full exact npm/toolchain identity is proven against the unchanged retained ancestor official-distribution receipt, not attributed to a missing Phase 3B inventory.'},powershell:{classification:'UNCHANGED_REUSABLE',path:priorPower.systemPowerShellPath,version:powerVersion.stdout.trim(),...powerIdentity,historicalIdentitySource:equal(powerRel),launchDependency,launch,helperBindingClassification:'IDENTITY_REFRESH_REQUIRED',helper:ref(packageRel+'helpers/windows-inspect.ps1'),limitation:'Original Phase 3B retained platform version and helper hash. Exact executable identity is rebound to unchanged Phase 1 native-environment evidence; helper identity is refreshed separately.'},licenses:{classification:'UNCHANGED_REUSABLE',rows:licenseRows,sbomFields:sbomLicenses,firstParty:'UNLICENSED/NOASSERTION; unresolved license status preserved, no grant inferred',externalProductionDependencies:0,nodeNotice,scope:'No newly introduced dependency/license; platform runtime notices remain separately provisioned.'},advisory:{classification:'UNCHANGED_REUSABLE',sameDate:true,evidence:ref('repositories/cca-conformance/evidence/mo1307/phase3b-refresh/advisory-carry-forward.json'),openFinding:'Node July 2026 HTTP/2 finding explicitly remains Phase 3D disposition required'},noProductionChanges:true,noFixtureCampaignExecuted:true};
save('reuse-details.json',result);
console.log(JSON.stringify({state:result.state,schemas:52,contract:53,fixturesReused:476,unchangedMembers:86,changed,toolchainFiles:toolchainRows.length,toolchainDigest,powershell:powerVersion.stdout.trim(),advisoryDate:reviewDate}));
