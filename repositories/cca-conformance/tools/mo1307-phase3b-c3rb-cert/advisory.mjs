// Existing evidence only. No current internet census or governance decision.
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {root,E,S,C3RB,hash,read,json,rec,write} from './common.mjs';
const H='5cb213eeab8a6deec39a8f8f93ea13a70e053231',I='4a1de6f00788e3c52a647d6f25aa1dbd2d5d5d97';
function input(commit,path){const r=spawnSync('C:/Program Files/Git/cmd/git.exe',['-c','safe.directory='+root.replaceAll('\\','/'),'show',commit+':'+path],{cwd:root,windowsHide:true,maxBuffer:16*1024*1024});assert.equal(r.status,0,r.stderr?.toString());return {identity:{commit,path,byteLength:r.stdout.length,sha256:hash(r.stdout)},value:JSON.parse(r.stdout)};}
const carried=input(H,'repositories/cca-conformance/evidence/mo1307/phase3b-refresh/advisory-carry-forward.json');
const original=input('85dea823385e1ccaddcd9997c3918b1312175eba','repositories/cca-conformance/evidence/mo1307/phase3b/certification-receipt.json');
const snapshot=input(I,'repositories/cca-conformance/evidence/mo1305-phase3br/advisory-snapshot.json');
assert.equal(carried.value.nodeHttp2Finding.status,'OPEN_PHASE3D_DISPOSITION_REQUIRED');
assert.equal(carried.value.riskAccepted,false);
const rows=snapshot.value.advisories.filter(r=>r.component==='node'&&r.source.endsWith('/july-2026-security-releases'));
assert.equal(rows.length,11);
const closure=json(E+'/runtime-closure.json'),definitions=json(S+'/contracts/definitions.json');
assert.equal(definitions.topology.network,false);assert.ok(!closure.builtins.some(s=>/^node:(http|http2|https|dns|net|tls|dgram)(\/|$)/.test(s)));
write(E+'/advisory-handoff.json',{
  kind:'MO1307FreshPhase3BAdvisoryHandoff',version:'1.0.0',createdUtc:new Date().toISOString(),source:C3RB,archive:rec(E+'/memoryos-readiness-0.1.0.tgz'),
  result:'OPEN_ADVISORY_HANDOFF',handling:'PASS',reviewScope:'Authorized existing repository evidence only. No new upstream retrieval or current vulnerability census. Prior 2026-09-29 review is historical, not a fresh same-date scan.',
  sources:[carried.identity,original.identity,snapshot.identity],
  historical3BRFinding:carried.value.nodeHttp2Finding,
  earlierMO1305Snapshot:{date:snapshot.value.snapshotDateUtc,sourceRetrieval:snapshot.value.sources.find(r=>r.url.endsWith('/july-2026-security-releases')),records:rows,scope:'These are historical MO-1305 claims. Their fixed-version fields are retained as attributed evidence only; they do not identify the HTTP/2 subset or resolve the later MO-1307 handoff. Full upstream response body was not retained.'},
  exactHttp2CveIdentity:'NOT ESTABLISHED',finalApplicability:'NOT ESTABLISHED',currentAdvisoryCensus:'NOT ESTABLISHED',riskAccepted:false,zeroVulnerabilityClaim:false,
  exactRuntime:json(E+'/supply.json').node,
  packageBoundary:{source:C3RB,topologyNetwork:false,externalProductionDependencies:0,builtins:closure.builtins,closure:rec(E+'/runtime-closure.json'),definitions:rec(S+'/contracts/definitions.json'),limitation:'Static package closure does not establish runtime exploitability, not-affected status or risk acceptance.'},
  phase3DHandoff:'Reconcile the original July 2026 HTTP/2 finding and exact advisory/CVE identity with Node 24.21.0 win-x64 SHA256 ba4e6d110e8c1592a1ecd390f6b05f3da124b13871a5be62b341a07a853c6c32, separately accepted exact-C3RB Phase 3A and Phase 3C evidence, and reachable interfaces. Attribute prior MO-1305 fixed-version claims to their historical scope. Record final applicability and any separate human/governance decision. This handoff accepts no risk and authorizes no release.',
  qualifications:['First-party licensing remains UNLICENSED/NOASSERTION; no product license or publication grant.','Bounded existing-evidence advisory review; exact HTTP/2 identification and final applicability remain open.'],
  notApplicable:['Provider accounts and hosted execution are outside the frozen Phase 3B scope.'],finalReleaseAuthorization:false
});
console.log(JSON.stringify({handling:'PASS',advisory:'OPEN_ADVISORY_HANDOFF',historicalNodeCves:rows.length,exactHttp2Subset:'NOT ESTABLISHED',riskAccepted:false}));
