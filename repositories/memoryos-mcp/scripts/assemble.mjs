import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { J } from '../src/deterministic.mjs';
import { PACKAGE_ROOT, regularBytes, sha256, exactFiles, verifyRuntime, CONTRACT_PIN_SHA256 } from '../src/integrity.mjs';

const workspace = resolve(PACKAGE_ROOT, '../..');
const studio = resolve(workspace, 'repositories/cca-studio');
export async function assemble() {
  const closure = new Set(['package.json']);
  async function visit(member) {
    if (closure.has(member)) return;
    closure.add(member);
    const bytes = await regularBytes(studio, member);
    const source = bytes.toString('utf8');
    // Inputs are reviewed, pinned predecessor modules; traverse their static imports.
    for (const match of source.matchAll(/^import\s+(?:\{[^}]*\}|[A-Za-z_$][\w$]*|\*\s+as\s+[\w$]+)\s+from\s*["']([^"']+)["']/gmu)) {
      if (!match[1].startsWith('.')) throw new Error('Unexpected non-relative authoritative import');
      const target = relative(studio, resolve(studio, dirname(member), match[1])).replaceAll('\\', '/');
      await visit(target);
    }
  }
  await visit('web/js/memoryos-sdk.js');
  const files = [];
  for (const member of [...closure].sort()) {
    const bytes = await regularBytes(studio, member);
    const path = `authoritative/${member}`;
    const target = resolve(PACKAGE_ROOT, 'runtime', path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, bytes);
    files.push({ path, source: `repositories/cca-studio/${member}`, byteLength: bytes.length, sha256: sha256(bytes) });
  }
  await mkdir(resolve(PACKAGE_ROOT, 'contracts'), { recursive: true });
  const identity = await regularBytes(workspace, 'repositories/memoryos-vscode/contracts/policy-contract-identities-1.0.0.json');
  if (identity.length !== 933 || sha256(identity) !== CONTRACT_PIN_SHA256) throw new Error('Contract identity source mismatch');
  await writeFile(resolve(PACKAGE_ROOT, 'contracts/policy-contract-identities-1.0.0.json'), identity);
  const manifest = { kind: 'MemoryOSMCPRuntimeClosureManifest', version: '1.0.0', files };
  const bytes = Buffer.from(`${J(manifest)}\n`);
  await writeFile(resolve(PACKAGE_ROOT, 'runtime/runtime-closure-manifest.json'), bytes);
  await writeFile(resolve(PACKAGE_ROOT, 'contracts/runtime-pin.json'), `${J({ byteLength: bytes.length, sha256: sha256(bytes) })}\n`);
  await verifyRuntime();
  return manifest;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await assemble();
  process.stdout.write(`${J({ runtimeFiles: result.files.length })}\n`);
}
