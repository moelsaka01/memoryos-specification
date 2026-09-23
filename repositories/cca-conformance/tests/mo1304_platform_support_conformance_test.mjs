import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../../',import.meta.url));
const git=(...a)=>execFileSync('git',a,{cwd:root,encoding:'utf8',windowsHide:true,env:{...process.env,GIT_OPTIONAL_LOCKS:'0'}}).trim();
const baseline='43f07a48774e3ea0ef8509bd5f9ff5071a839b27';
test('corrected support contract rejects wrong platform, missing actual environment and mismatched parity',()=>{
 const r=JSON.parse(execFileSync(process.env.MEMORYOS_CONFORMANCE_PYTHON??'python',['-B',root+'/repositories/cca-conformance/tools/mo1304-platforms/support_contract_test.py',root],{cwd:root,encoding:'utf8',windowsHide:true}));
 assert.equal(r.status,'PASS');assert.equal(r.scope,'SUPPORT_CONTRACT_FIXTURES_ONLY');assert.ok(r.negativeWitnesses>=22);assert.equal(r.ubuntuValidated,true);assert.equal(r.windowsEvidenceCreated,false);
});
test('correction preserves production, Ubuntu evidence and the exact correction parent without future self-reference',()=>{
 assert.equal(git('diff',baseline,'--','repositories/memoryos-mcp','repositories/cca-conformance/evidence/mo1304-phase3-ubuntu','repositories/cca-conformance/tools/mo1304-phase3'),'');
 if(git('rev-parse','HEAD')!==baseline){
  const commit=git('rev-list','--reverse','--ancestry-path',baseline+'..HEAD').split('\n')[0];
  assert.equal(git('rev-parse',commit+'^'),baseline);assert.equal(git('show','-s','--format=%s',commit),'docs(memoryos-1.3): correct MO-1304 Windows support target');
  const inv=JSON.parse(git('show',commit+':repositories/cca-conformance/mo1304-conformance-inventory.json'));
  assert.equal(inv.phase3.windows11_x64,null);assert.equal(inv.phase3.platformParity,null);assert.equal(inv.releaseBinding.status,'PENDING');
  const files=git('diff','--name-only',baseline,commit).split('\n');assert.ok(files.every(p=>p.startsWith('docs/')||p.startsWith('repositories/cca-conformance/')));assert.ok(files.every(p=>!p.includes('/evidence/')));
 }
});
test('support policy is registered and linked from authority',async()=>{
 const read=p=>readFile(root+'/'+p,'utf8');
 assert.match(await read('docs/mo1304-mcp-server-agent-integration.md'),/mo1304-contract-freeze-windows-support-correction.md/);
 const pkg=JSON.parse(await read('repositories/cca-conformance/package.json'));assert.equal(pkg.scripts['test:mo1304-platform-support'],'node --test tests/mo1304_platform_support_conformance_test.mjs');
 const cm=await read('repositories/cca-conformance/CMakeLists.txt');assert.equal(cm.split('tests/mo1304_platform_support_conformance_test.mjs').length-1,2);
 const runner=await read('repositories/cca-conformance/tools/run-js-conformance.mjs');assert.equal(runner.split('"mo1304_platform_support_conformance_test.mjs"').length-1,1);
});
