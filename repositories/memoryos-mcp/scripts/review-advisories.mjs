import { readFile,writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PACKAGE_ROOT,sha256 } from '../src/integrity.mjs';
import { J } from '../src/deterministic.mjs';
const read=async path=>JSON.parse(await readFile(resolve(PACKAGE_ROOT,path)));
const sources=await read('measurements/advisory-source-review.json');
const original=await read('measurements/advisory-review.json');
const closure=await read('distribution/dependency-closure.json');
if(sources.advisories.length!==7 || sources.advisories.some(x=>x.severity!=='high'||!x.description))throw Error('INCOMPLETE_ADVISORY_SOURCE');
const occurrences=[];
for(const entry of closure.files.filter(x=>x.path.endsWith('.mjs')||x.path.endsWith('.cjs'))){
  const bytes=await readFile(resolve(PACKAGE_ROOT,entry.path));
  if(bytes.includes(Buffer.from('fast-uri@3.1.0')))occurrences.push({path:entry.path,byteLength:bytes.length,sha256:sha256(bytes)});
}
if(!occurrences.length)throw Error('MISSING_EMBEDDED_COMPONENT');
const patched=sources.registry.find(x=>x.name==='fast-uri').stableVersions.includes('3.1.6');
const sdk=sources.registry.filter(x=>x.name.startsWith('@modelcontextprotocol/'));
if(sdk.some(x=>J(x.stableVersions)!==J(['2.0.0'])))throw Error('NEW_SDK_RELEASE_REQUIRES_REVIEW');
const receipt={kind:'MemoryOSMCPAdvisoryDisposition',version:'1.0.0',component:{name:'fast-uri',version:'3.1.0',affected:true,introducer:'@modelcontextprotocol/server@2.0.0 -> bundled ajv@8.18.0 -> bundled fast-uri@3.1.0',occurrences},
  registrySnapshot:sources.checkedAtUtc,standalonePatchAvailable:patched,standalonePatchVersion:'3.1.6',
  compatiblePatchedPublishedSDKAvailable:false,overrideDisposition:'npm overrides cannot replace code embedded inside published SDK bundles; no SDK fork or byte patch is permitted.',
  records:sources.advisories.map(x=>({ghsaId:x.ghsaId,severity:x.severity,affectedInstalledVersion:true,firstPatchedV3:x.vulnerabilities.find(v=>v.first_patched_version?.startsWith('3.'))?.first_patched_version,
    appliesToFrozenProductPath:false,url:x.url})),
  reachability:{provider:'SDK Node shim selects a lazy AjvJsonSchemaValidator. Low-level Server uses its getValidator only for elicitation form responses. MO-1304 neither sends server requests nor enables elicitation and registers low-level handlers.',
    attackerInputs:'Closed tool arguments are Base64/digests and never schemas or URI policy inputs. Metadata and requested resource URIs are not dereferenced, normalized, routed, or used for authority.',
    tests:'tests/security.test.mjs reproduces vulnerable normalization, then instruments getValidator and the AJV getter to throw on use; all six tools, discovery, listing, URI metadata, rejected URI arguments, resource requests, and subscription inputs complete without provider invocation. Parent and worker network/shell attempts are trapped.',
    productionRuntime:'The MemoryOS worker closure does not import the MCP SDK or fast-uri. It uses Zod for closed argument admission and authoritative MemoryOS artifact parsers.'},
  disposition:'AFFECTED_COMPONENT_PRESENT_NO_APPLICABLE_PATH_IN_FROZEN_SURFACE',
  policy:'Exact published versions and integrity remain unchanged; no lifecycle execution, native addon, optional download, dependency patch, or new authority. The correction requires STOP for an applicable high-severity issue; reviewed exploitation preconditions are absent in this frozen surface.',
  invalidation:'Re-review before enabling arbitrary schemas, elicitation, URL/host/path policy, network transports, resources, remote references, new SDK APIs, or changing dependencies. This is not a claim that fast-uri 3.1.0 is patched or vulnerability-free.',
  sourceEvidence:{path:'measurements/advisory-source-review.json',sha256:sha256(await readFile(resolve(PACKAGE_ROOT,'measurements/advisory-source-review.json')))},
  originalAdvisoryIds:original.response['fast-uri'].map(x=>x.id)};
await writeFile(resolve(PACKAGE_ROOT,'measurements/advisory-disposition.json'),J(receipt)+'\n');
console.log(J({records:receipt.records.length,embeddedFiles:occurrences.length,disposition:receipt.disposition}));
