import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PACKAGE_ROOT, exactFiles, regularBytes, sha256, verifyRuntime, verifyDependencies } from '../src/integrity.mjs';
import { J } from '../src/deterministic.mjs';
export async function foundationInventory() {
  await verifyRuntime(); const dependencies = await verifyDependencies();
  const members = ['package.json', 'package-lock.json', 'README.md', 'NOTICE.md', 'LICENSE', 'THIRD_PARTY_NOTICES.txt'];
  for (const directory of ['bin','src','contracts','runtime','distribution'])
    for (const member of await exactFiles(resolve(PACKAGE_ROOT,directory)))
      if (`${directory}/${member}` !== 'distribution/foundation-inventory.json') members.push(`${directory}/${member}`);
  const files=[];
  for (const path of members.sort()) { const bytes=await regularBytes(PACKAGE_ROOT,path);files.push({path,byteLength:bytes.length,sha256:sha256(bytes)}); }
  return {kind:'MemoryOSMCPDistributionFoundation',version:'1.0.0',status:'PHASE2_SOURCE_INVENTORY',
    selfExcluded:'distribution/foundation-inventory.json',files,
    productionDependencies:dependencies.packages,productionDependencyFileCount:dependencies.files.length,
    archive:{status:'EXTERNAL_PHASE2_RECEIPT',path:'measurements/phase2-package-receipt.json'},developmentDependenciesIncluded:false,
    releaseEvidenceIncluded:false};
}
export async function verifyFoundation() {
  const expected=await foundationInventory();
  const actual=JSON.parse(await readFile(resolve(PACKAGE_ROOT,'distribution/foundation-inventory.json')));
  if(J(expected)!==J(actual))throw new Error('FOUNDATION_INVENTORY_MISMATCH');return actual;
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const value=await foundationInventory();await writeFile(resolve(PACKAGE_ROOT,'distribution/foundation-inventory.json'),J(value)+'\n');
  process.stdout.write(J({files:value.files.length,status:value.status})+'\n');
}
