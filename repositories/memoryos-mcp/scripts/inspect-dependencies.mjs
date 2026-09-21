import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { PACKAGE_ROOT, exactFiles, regularBytes, sha256 } from '../src/integrity.mjs';
import { J } from '../src/deterministic.mjs';

const lockBytes = await readFile(resolve(PACKAGE_ROOT, 'package-lock.json'));
const lock = JSON.parse(lockBytes);
if (lock.lockfileVersion !== 3) throw new Error('LOCK_VERSION');
const packages = [];
const productionFiles = [];
const embedded = new Map();
for (const [path, entry] of Object.entries(lock.packages)) {
  if (path === '') continue;
  if (!/^\d+\.\d+\.\d+$/u.test(entry.version) || !entry.resolved?.startsWith('https://registry.npmjs.org/')
    || !/^sha512-[A-Za-z0-9+/]+=*$/u.test(entry.integrity) || entry.optional || entry.hasInstallScript) throw new Error('DEPENDENCY_POLICY');
  const root = resolve(PACKAGE_ROOT, path);
  const manifest = JSON.parse(await regularBytes(root, 'package.json'));
  if (manifest.version !== entry.version || manifest.os || manifest.cpu || manifest.optionalDependencies) throw new Error('DEPENDENCY_POLICY');
  const files = await exactFiles(root);
  if (files.some((file) => /(?:\.node$|binding\.gyp$|(?:^|\/)(?:preinstall|postinstall)(?:\.|$))/iu.test(file))) throw new Error('NATIVE_OR_INSTALLER');
  const hooks = Object.fromEntries(Object.entries(manifest.scripts ?? {}).filter(([key]) =>
    ['preinstall', 'install', 'postinstall', 'prepare', 'prepublish', 'prepublishOnly', 'postpublish', 'prepack', 'postpack'].includes(key)));
  if (['preinstall', 'install', 'postinstall'].some((key) => hooks[key])) throw new Error('INSTALL_HOOK');
  if (hooks.prepare && !(manifest.name === 'eventsource' && manifest.version === '3.0.7' && hooks.prepare === 'npm run build')) throw new Error('UNREVIEWED_PREPARE');
  packages.push({ name: manifest.name, version: entry.version, path, developmentOnly: entry.dev === true,
    resolved: entry.resolved, integrity: entry.integrity, dependencies: manifest.dependencies ?? {}, lifecycleScripts: hooks,
    lifecycleExecution: 'DISABLED', native: false, optional: false, platformDownload: false,
    files: files.length, repository: manifest.repository ?? null });
  for (const file of files) {
    const bytes = await regularBytes(root, file);
    if (!entry.dev) productionFiles.push({ path: `${path}/${file}`, byteLength: bytes.length, sha256: sha256(bytes) });
    if (!entry.dev && file.endsWith('.mjs')) {
      for (const match of bytes.toString('utf8').matchAll(/\.pnpm\/([^/]+)\/node_modules/gu)) {
        const spec = match[1].split('_')[0]; const at = spec.lastIndexOf('@');
        const name = spec.slice(0, at).replace('+', '/'); const version = spec.slice(at + 1);
        if (at > 0 && /^\d+\.\d+\.\d+$/u.test(version)) embedded.set(`${name}@${version}`, { name, version });
      }
    }
  }
}
packages.sort((a, b) => a.path < b.path ? -1 : 1);
productionFiles.sort((a, b) => a.path < b.path ? -1 : 1);
const manifest = { kind: 'MemoryOSMCPDependencyClosure', version: '1.0.0', files: productionFiles,
  packages: packages.filter((entry) => !entry.developmentOnly).map(({ name, version, path }) => ({ name, version, path })) };
const bytes = Buffer.from(`${J(manifest)}\n`);
await mkdir(resolve(PACKAGE_ROOT, 'distribution'), { recursive: true });
await mkdir(resolve(PACKAGE_ROOT, 'measurements'), { recursive: true });
await writeFile(resolve(PACKAGE_ROOT, 'distribution/dependency-closure.json'), bytes);
await writeFile(resolve(PACKAGE_ROOT, 'contracts/dependency-pin.json'), `${J({ byteLength: bytes.length, sha256: sha256(bytes) })}\n`);
await writeFile(resolve(PACKAGE_ROOT, 'distribution/dependency-lock.json'), lockBytes);
const review = { kind: 'MemoryOSMCPDependencyReview', version: '1.0.0', node: process.versions.node,
  npm: '11.19.0', lockfile: { version: 3, byteLength: lockBytes.length, sha256: sha256(lockBytes) },
  directPackageCount: 4, installedPackageCount: packages.length, transitivePackageCount: packages.length - 4,
  productionPackageCount: packages.filter((entry) => !entry.developmentOnly).length,
  lifecycleExecution: 'npm ci --ignore-scripts --no-audit --no-fund', packages,
  embeddedProductionComponents: [...embedded.values()].sort((a, b) => a.name < b.name ? -1 : 1),
  sourceReview: 'Published source maps and modern stdio exports inspected; registry metadata did not supply gitHead.',
  nodeArchive: { name: 'node-v24.21.0-win-x64.zip', sha256: '158f7685b44de51f6c0df1d153526cbcd3e1bc739a8dfc607721cef75de9e541' },
  nodeExecutableSha256: sha256(await readFile(process.execPath)) };
await writeFile(resolve(PACKAGE_ROOT, 'measurements/dependency-review.json'), `${J(review)}\n`);
process.stdout.write(`${J({ installed: packages.length, production: review.productionPackageCount,
  embedded: review.embeddedProductionComponents, lockfile: review.lockfile })}\n`);
