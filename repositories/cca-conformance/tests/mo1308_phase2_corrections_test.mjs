import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  RELEASED_MANIFEST, RELEASED_RUNTIME, RELEASED_VENDOR_PINS, verifyReleasedRuntime,
} from '../../memoryos-vscode/tests/support/released-runtime-pins.mjs';

// MO-1308 Amendment A9: the released-bundle correction principle (A1 extended to every released bundle).
// Read-only for the workspace: every mutation happens in a temporary copy.
const workspace = fileURLToPath(new URL('../../../', import.meta.url));
const read = (...parts) => fs.readFileSync(path.join(workspace, ...parts));
const sha = (bytes) => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
function git(...args) {
  const r = spawnSync('git', args, { cwd: workspace, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}
const text = (...args) => git(...args).toString().trim();

// Releasing tag and peeled commit of each bundle that vendors a copy of the SDK or CLI closure.
const RELEASES = [
  { name: 'memoryos-vscode', tag: 'memoryos-1.3-mo1303', object: 'f3891cbac8a6ab804887a3d95a595c7bd1523af9', commit: '49aa80fa76bffc03e36335be8ab805bb5dc38f9c', paths: ['repositories/memoryos-vscode/runtime'] },
  { name: 'memoryos-mcp', tag: 'memoryos-1.3-mo1304', object: '6d877151f0857006fcf12958f8b4c5bc662f43d6', commit: 'ce7b001d911239fa50d904f5f336bb1bd7858ba3', paths: ['repositories/memoryos-mcp/runtime', 'repositories/memoryos-mcp/contracts/runtime-pin.json'] },
  { name: 'memoryos-rest', tag: 'memoryos-1.3-mo1305', object: '741e596454cfbcc908b8bd576b4fa97311139083', commit: '5955af062152a84c10de17860ba0bcabe8b3555f', paths: ['repositories/memoryos-rest/runtime'] },
  { name: 'memoryos-ci', tag: 'memoryos-1.3-mo1306', object: '9dd37b7757314b8cecbfc018ff7cdd8c2aa0cab8', commit: '332ab0d2c35643ea8d155bcbea9c5019b304bbe3', paths: ['repositories/memoryos-ci/runtime'] },
  { name: 'memoryos-policy-gate Action', tag: 'memoryos-1.3-mo1302', object: '773dd03829dd6b3632bf43a45578925b1498515d', commit: '7e07bd0db9ab10146f2e0e0bbd67a4c5850cf41d', paths: ['.github/actions/memoryos-policy-gate'] },
];

function copyTree(from, to) { fs.cpSync(from, to, { recursive: true }); }
const temp = (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mo1308-a9-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
};

test('PC01 every releasing tag exists, is annotated and peels to the commit the records name', () => {
  for (const { tag, object, commit } of RELEASES) {
    assert.equal(text('rev-parse', `refs/tags/${tag}`), object, tag);
    assert.equal(text('cat-file', '-t', object), 'tag', tag);
    assert.equal(text('rev-parse', `${tag}^{commit}`), commit, tag);
  }
  assert.deepEqual({ ...RELEASED_RUNTIME }, { tag: 'memoryos-1.3-mo1303', tagObject: RELEASES[0].object, commit: RELEASES[0].commit });
});

test('PC02 the memoryos-vscode pins equal the exact blobs at memoryos-1.3-mo1303, and the released manifest', () => {
  const { commit } = RELEASES[0];
  const released = git('show', `${commit}:repositories/memoryos-vscode/runtime/${RELEASED_MANIFEST.path}`);
  assert.deepEqual({ byteLength: RELEASED_MANIFEST.byteLength, sha256: RELEASED_MANIFEST.sha256 }, { byteLength: released.length, sha256: sha(released) });
  assert.equal(RELEASED_VENDOR_PINS.length, 37);
  const members = text('ls-tree', '-r', '--name-only', commit, '--', 'repositories/memoryos-vscode/runtime')
    .split('\n').map((name) => name.slice('repositories/memoryos-vscode/runtime/'.length)).sort();
  assert.deepEqual(members, [RELEASED_MANIFEST.path, ...RELEASED_VENDOR_PINS.map(([name]) => name)].sort(), 'the pins cover exactly the released runtime directory');
  for (const [name, byteLength, sha256] of RELEASED_VENDOR_PINS) {
    const bytes = git('show', `${commit}:repositories/memoryos-vscode/runtime/${name}`);
    assert.deepEqual({ byteLength, sha256 }, { byteLength: bytes.length, sha256: sha(bytes) }, name);
  }
  const manifest = JSON.parse(released);
  assert.deepEqual(manifest.files.map(({ path: name, byteLength, sha256 }) => [name, byteLength, sha256]), RELEASED_VENDOR_PINS.map(([name, byteLength, sha256]) => [name, byteLength, sha256]));
});

test('PC03 the released bundles are unchanged since their releasing tags (R32), so no bundle was refreshed', () => {
  for (const { name, tag, commit, paths } of RELEASES) {
    const r = spawnSync('git', ['diff', '--quiet', commit, 'HEAD', '--', ...paths], { cwd: workspace, windowsHide: true });
    assert.equal(r.status, 0, `${name} (${tag}) changed since its release`);
  }
});

test('PC04 the memoryos-vscode check passes on the released closure even though current source has moved on', () => {
  assert.deepEqual(verifyReleasedRuntime(path.join(workspace, 'repositories/memoryos-vscode/runtime')), []);
  // The condition that broke the replaced rule: the vendored copy no longer equals current source.
  assert.notDeepEqual(read('repositories/memoryos-vscode/runtime/vendor/repositories/cca-studio/package.json'), read('repositories/cca-studio/package.json'));
  assert.notDeepEqual(read('repositories/memoryos-vscode/runtime/vendor/repositories/cca-studio/web/js/memoryos-sdk.js'), read('repositories/cca-studio/web/js/memoryos-sdk.js'));
});

test('PC05 the memoryos-vscode check still fails on any vendored byte change, added or removed file, or manifest change', (t) => {
  const source = path.join(workspace, 'repositories/memoryos-vscode/runtime');
  const mutate = (label, edit, expected) => {
    const root = path.join(temp(t), 'runtime');
    copyTree(source, root);
    edit(root);
    const errors = verifyReleasedRuntime(root);
    assert.ok(errors.length > 0, `${label}: rejected`);
    assert.ok(errors.includes(expected), `${label}: ${JSON.stringify(errors)}`);
  };
  const vendored = 'vendor/repositories/cca-studio/web/js/memoryos-sdk.js';
  const flip = (file) => { const bytes = fs.readFileSync(file); bytes[0] ^= 1; fs.writeFileSync(file, bytes); };
  mutate('one byte of a vendored file', (root) => flip(path.join(root, vendored)), `differs from release: ${vendored}`);
  mutate('one appended byte', (root) => fs.appendFileSync(path.join(root, vendored), ' '), `differs from release: ${vendored}`);
  mutate('one byte of the manifest', (root) => flip(path.join(root, RELEASED_MANIFEST.path)), `differs from release: ${RELEASED_MANIFEST.path}`);
  mutate('an added file', (root) => fs.writeFileSync(path.join(root, 'vendor/extra.js'), 'x'), 'added: vendor/extra.js');
  mutate('a removed file', (root) => fs.rmSync(path.join(root, vendored)), `removed: ${vendored}`);
  mutate('an emptied vendored file', (root) => fs.writeFileSync(path.join(root, vendored), ''), `differs from release: ${vendored}`);
  // A vendored change with a consistently re-hashed manifest still fails: the manifest is itself pinned.
  mutate('a changed file with a consistently rewritten manifest', (root) => {
    const file = path.join(root, vendored);
    fs.appendFileSync(file, ' ');
    const manifestFile = path.join(root, RELEASED_MANIFEST.path);
    const manifest = JSON.parse(fs.readFileSync(manifestFile));
    const entry = manifest.files.find(({ path: name }) => name === vendored);
    entry.byteLength += 1;
    entry.sha256 = sha(fs.readFileSync(file));
    fs.writeFileSync(manifestFile, JSON.stringify(manifest));
  }, `differs from release: ${RELEASED_MANIFEST.path}`);
  const link = path.join(temp(t), 'runtime');
  copyTree(source, link);
  fs.rmSync(path.join(link, vendored));
  try { fs.symlinkSync(path.join(workspace, 'repositories/cca-studio/web/js/memoryos-sdk.js'), path.join(link, vendored)); } catch { return; }
  assert.ok(verifyReleasedRuntime(link).length > 0, 'a link standing in for a vendored file is rejected');
});

test('PC06 the memoryos-mcp runtime check is pinned to its released manifest, never to current source, and still fails on any change', async (t) => {
  const mcp = fs.readFileSync(path.join(workspace, 'repositories/memoryos-mcp/tests/integrity.test.mjs'), 'utf8');
  assert.doesNotMatch(mcp, /entry\.source/u, 'the memoryos-mcp test no longer reads current source');
  assert.match(mcp, /0b910e64f40b562d62c9a053c98833b439f78abd195d9604386e74e0d20d961d/u);
  const releasedManifest = git('show', `${RELEASES[1].commit}:repositories/memoryos-mcp/runtime/runtime-closure-manifest.json`);
  assert.equal(releasedManifest.length, 5566);
  assert.equal(sha(releasedManifest), 'sha256:0b910e64f40b562d62c9a053c98833b439f78abd195d9604386e74e0d20d961d');
  // memoryos-mcp startup verification still fails on any change to the released runtime (temporary copy).
  const { verifyRuntime } = await import('../../memoryos-mcp/src/integrity.mjs');
  const make = () => {
    const root = temp(t);
    copyTree(path.join(workspace, 'repositories/memoryos-mcp/runtime'), path.join(root, 'runtime'));
    copyTree(path.join(workspace, 'repositories/memoryos-mcp/contracts'), path.join(root, 'contracts'));
    return root;
  };
  assert.equal((await verifyRuntime(make())).files.length, 25);
  const member = 'authoritative/web/js/memoryos-sdk.js';
  for (const [label, edit] of [
    ['a changed byte', (root) => fs.appendFileSync(path.join(root, 'runtime', member), ' ')],
    ['an added file', (root) => fs.writeFileSync(path.join(root, 'runtime', 'extra.js'), 'x')],
    ['a removed file', (root) => fs.rmSync(path.join(root, 'runtime', member))],
    ['a re-hashed manifest', (root) => {
      const file = path.join(root, 'runtime', member);
      fs.appendFileSync(file, ' ');
      const manifestFile = path.join(root, 'runtime/runtime-closure-manifest.json');
      const manifest = JSON.parse(fs.readFileSync(manifestFile));
      const entry = manifest.files.find(({ path: name }) => name === member);
      entry.byteLength += 1;
      entry.sha256 = sha(fs.readFileSync(file)).slice('sha256:'.length);
      fs.writeFileSync(manifestFile, JSON.stringify(manifest));
    }],
  ]) {
    const root = make();
    edit(root);
    await assert.rejects(() => verifyRuntime(root), undefined, label);
  }
});
