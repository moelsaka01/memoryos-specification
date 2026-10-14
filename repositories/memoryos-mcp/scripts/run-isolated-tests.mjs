/*
 * Runs the unmodified memoryos-mcp foundation suite against a scratch copy of the package, so that nothing the
 * suite writes (measurements/phase2-integration.json, phase2-offline.json, the package receipt, out/, the
 * Zod test-file removal in node_modules) can touch the tracked tree. The tracked tests/ and scripts/ bytes and the
 * tracked measurements/ are pinned by frozen evidence (measurements/phase2-validation.json, MO-1304 phase 2),
 * so isolation is done around them, not inside them.
 *
 * Steps, all inside the scratch copy:
 *  1. scripts/assemble-dependencies.mjs  - removes exactly the 198 hash-verified Zod development test files that
 *     `npm ci --ignore-scripts` installs but the pinned production closure excludes.
 *  2. scripts/distribution.mjs           - builds the packed .tgz and its receipt (the gzip layer is not
 *     reproducible across zlib builds, so the receipt in the copy records the locally built archive).
 *  3. node --test tests/*.test.mjs       - the suite itself.
 * Afterwards the tracked measurements/ are checked byte-for-byte; any change fails the run.
 *
 * Usage: node scripts/run-isolated-tests.mjs   (Node 24.21.0; NODE_OPTIONS / NODE_PATH must be unset)
 */
import { createHash } from 'node:crypto';
import { chmodSync, copyFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, rmSync, symlinkSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const PACKAGE = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const WORKSPACE = resolve(PACKAGE, '../..');
const SCRATCH = resolve(WORKSPACE, 'out/mcp-isolated');
const COPY = join(SCRATCH, 'repositories/memoryos-mcp');

function fingerprint(directory) {
  const hash = createHash('sha256');
  const walk = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true }).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const path = join(current, entry.name);
      if (entry.isDirectory()) walk(path);
      else hash.update(path.slice(directory.length)).update(readFileSync(path));
    }
  };
  walk(directory);
  return hash.digest('hex');
}

const before = fingerprint(join(PACKAGE, 'measurements'));
rmSync(SCRATCH, { recursive: true, force: true });
mkdirSync(join(SCRATCH, 'repositories'), { recursive: true });
cpSync(PACKAGE, COPY, { recursive: true, filter: (source) => source !== join(PACKAGE, 'out') });
for (const entry of readdirSync(join(WORKSPACE, 'repositories'), { withFileTypes: true })) {
  if (entry.isDirectory() && entry.name !== 'memoryos-mcp') {
    symlinkSync(join(WORKSPACE, 'repositories', entry.name), join(SCRATCH, 'repositories', entry.name), 'junction');
  }
}

// The pinned scripts and tests locate npm at <dirname(node)>/node_modules/npm (the Windows layout). Give POSIX
// installs (<prefix>/bin/node + <prefix>/lib/node_modules/npm) that layout through a private copy of node.
let node = process.execPath;
if (process.platform !== 'win32' && !existsSync(join(dirname(node), 'node_modules/npm/bin/npm-cli.js'))) {
  const real = realpathSync(node);
  const npmHome = resolve(dirname(real), '../lib/node_modules/npm');
  if (!existsSync(join(npmHome, 'bin/npm-cli.js'))) throw new Error('NPM_CLI_NOT_FOUND');
  const bin = join(SCRATCH, 'node-bin');
  mkdirSync(join(bin, 'node_modules'), { recursive: true });
  node = join(bin, 'node');
  copyFileSync(real, node);
  chmodSync(node, 0o755);
  symlinkSync(npmHome, join(bin, 'node_modules/npm'), 'junction');
}

const env = { ...process.env };
for (const name of ['NODE_OPTIONS', 'NODE_PATH', 'NODE_TEST_CONTEXT']) delete env[name];
const run = (args) => spawnSync(node, args, { cwd: COPY, env, stdio: 'inherit' });

let status = 0;
for (const step of [['scripts/assemble-dependencies.mjs'], ['scripts/distribution.mjs']]) {
  const result = run(step);
  if (result.status !== 0) {
    process.stderr.write(`isolated preparation failed: ${step.join(' ')}\n`);
    status = result.status ?? 1;
    break;
  }
}
if (status === 0) status = run(['--test', '--test-concurrency=1', 'tests/*.test.mjs']).status ?? 1;

if (fingerprint(join(PACKAGE, 'measurements')) !== before) {
  process.stderr.write('tracked measurements/ changed during the isolated run\n');
  status = status || 1;
}
process.exit(status);
