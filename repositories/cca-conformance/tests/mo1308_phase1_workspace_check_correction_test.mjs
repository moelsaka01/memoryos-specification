import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// WORKSPACE_CHECK_CORRECTION proofs (docs/mo1302-vendored-runtime-check-correction.md).
// Read-only for the workspace: mutations happen only in temporary copies made by the probe.
const workspace = fileURLToPath(new URL('../../../', import.meta.url));
const probe = fileURLToPath(new URL('../tools/mo1308-phase1/workspace_check_probe.py', import.meta.url));
const TAG = 'memoryos-1.3-mo1302', TAG_OBJECT = '773dd03829dd6b3632bf43a45578925b1498515d';
const TAG_COMMIT = '7e07bd0db9ab10146f2e0e0bbd67a4c5850cf41d';
const PRE_CORRECTION = '64e5d52089e14e74d62d9fbd23caf6aa0f250b39';
const ACTION = '.github/actions/memoryos-policy-gate';

function python() {
  const candidates = [process.env.MEMORYOS_CONFORMANCE_PYTHON, 'python3', 'python'].filter(Boolean);
  for (const candidate of candidates) {
    const r = spawnSync(candidate, ['-c', 'import sys; print(sys.version_info[0])'], { encoding: 'utf8', windowsHide: true });
    if (!r.error && r.status === 0 && r.stdout.trim() === '3') return candidate;
  }
  throw new Error('Python 3 is required; set MEMORYOS_CONFORMANCE_PYTHON');
}
function git(...args) {
  const r = spawnSync('git', args, { cwd: workspace, windowsHide: true, maxBuffer: 64 * 1024 * 1024 });
  assert.equal(r.status, 0, `git ${args.join(' ')}: ${r.stderr}`);
  return r.stdout;
}
const sha = bytes => 'sha256:' + createHash('sha256').update(bytes).digest('hex');
let cached;
function results() {
  if (!cached) {
    const r = spawnSync(python(), ['-B', probe, workspace], { encoding: 'utf8', windowsHide: true, maxBuffer: 16 * 1024 * 1024 });
    assert.equal(r.status, 0, r.stderr);
    cached = JSON.parse(r.stdout);
  }
  return cached;
}
const corrected = name => results()[name].corrected;

test('WC01 unchanged Action passes the corrected check', () => {
  assert.deepEqual(corrected('unchanged'), []);
});
test('WC02 one-byte SDK or CLI source edits now pass; the replaced rule rejected them', () => {
  for (const [name, source] of [['sdk_source_one_byte', 'repositories/cca-studio/web/js/memoryos-sdk.js'],
    ['cli_source_one_byte', 'repositories/memoryos-cli/src/commands.js']]) {
    assert.deepEqual(corrected(name), []);
    assert.deepEqual(results()[name].replacedRule, [`MO-1302 vendored runtime source differs from '${source}'`]);
  }
});
test('WC03 any bundled byte change fails', () => {
  assert.ok(corrected('bundled_sdk_one_byte').includes(
    "MO-1302 vendored runtime source differs from released 'repositories/cca-studio/web/js/memoryos-sdk.js'"));
  assert.ok(corrected('bundled_sdk_one_byte').includes(
    "MO-1302 distribution member 'dist/vendor/repositories/cca-studio/web/js/memoryos-sdk.js' digest changed"));
  assert.ok(corrected('bundled_entrypoint_one_byte').includes("MO-1302 distribution member 'dist/index.js' digest changed"));
});
test('WC04 a bundled change with a consistently rewritten manifest still fails on the released manifest', () => {
  const errors = corrected('bundled_sdk_with_consistent_manifest');
  assert.ok(errors.includes('MO-1302 distribution manifest differs from the released manifest'));
  assert.ok(errors.includes("MO-1302 vendored runtime source differs from released 'repositories/cca-studio/web/js/memoryos-sdk.js'"));
});
test('WC05 an added or removed bundled file fails', () => {
  assert.ok(corrected('bundled_file_added').includes('MO-1302 Action root contains unlisted production files: dist/extra.js'));
  assert.ok(corrected('bundled_file_removed').includes('MO-1302 Action root lacks listed production files: dist/cli-driver.mjs'));
});
test('WC06 a manifest that no longer matches the released bytes fails', () => {
  assert.ok(corrected('manifest_one_byte').some(error => error.startsWith('invalid MO-1302 distribution manifest:')));
});

function pins() {
  const text = fs.readFileSync(path.join(workspace, 'tools/verify_workspace.py'), 'utf8');
  const manifest = text.match(/^MO1302_RELEASED_MANIFEST = \((\d+), "(sha256:[0-9a-f]{64})"\)$/m);
  const block = text.slice(text.indexOf('MO1302_RELEASED_VENDOR_SOURCES = {'), text.indexOf('\n}\n', text.indexOf('MO1302_RELEASED_VENDOR_SOURCES = {')));
  const sources = [...block.matchAll(/^ {4}"([^"]+)": \((\d+), "(sha256:[0-9a-f]{64})", "([0-9a-f]{40})"\),$/gm)]
    .map(([, file, length, digest, blob]) => ({ file, length: Number(length), digest, blob }));
  return { manifest: { length: Number(manifest[1]), digest: manifest[2] }, sources };
}
test('WC07 the tag exists, is annotated and peels to the commit the MO-1302 records name', () => {
  assert.equal(git('rev-parse', `refs/tags/${TAG}`).toString().trim(), TAG_OBJECT);
  assert.equal(git('cat-file', '-t', TAG_OBJECT).toString().trim(), 'tag');
  assert.equal(git('rev-parse', `${TAG}^{commit}`).toString().trim(), TAG_COMMIT);
});
test('WC08 every pin equals the exact blob at the release tag', () => {
  const { manifest, sources } = pins();
  const released = git('show', `${TAG_COMMIT}:${ACTION}/distribution-manifest.json`);
  assert.deepEqual(manifest, { length: released.length, digest: sha(released) });
  assert.equal(sources.length, 37);
  for (const { file, length, digest, blob } of sources) {
    const bytes = git('show', `${TAG_COMMIT}:${file}`);
    assert.deepEqual({ length, digest }, { length: bytes.length, digest: sha(bytes) }, file);
    assert.equal(git('rev-parse', `${TAG_COMMIT}:${file}`).toString().trim(), blob, file);
  }
});
test('WC09 the released Action bytes are unchanged since the tag (R32)', () => {
  const r = spawnSync('git', ['diff', '--quiet', TAG_COMMIT, 'HEAD', '--', ACTION], { cwd: workspace, windowsHide: true });
  assert.equal(r.status, 0);
});
test('WC10 the correction replaces only the source comparison', () => {
  const removed = git('diff', '-U0', PRE_CORRECTION, '--', 'tools/verify_workspace.py').toString()
    .split('\n').filter(line => line.startsWith('-') && !line.startsWith('---'));
  assert.deepEqual(removed, [
    '-        original = root.joinpath(*source.split("/"))',
    '-            if original.read_bytes() != vendored.read_bytes():',
    '-                errors.append(f"MO-1302 vendored runtime source differs from \'{source}\'")',
    '-        except OSError as exception:',
  ]);
});
test('WC11 every other verifier check reports exactly as before the correction', () => {
  // The only permitted difference is the replaced rule's own message for edited current source.
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mo1308-wscheck-base-'));
  try {
    const base = path.join(directory, 'verify_workspace_base.py');
    fs.writeFileSync(base, git('show', `${PRE_CORRECTION}:tools/verify_workspace.py`));
    const run = script => {
      const r = spawnSync(python(), ['-B', script, '--root', workspace], { encoding: 'utf8', windowsHide: true });
      return (r.stdout + r.stderr).split(/\r?\n/u).filter(Boolean);
    };
    const replaced = /^error: MO-1302 vendored runtime source differs from '[^']+'$/u;
    const before = run(base), after = run(path.join(workspace, 'tools/verify_workspace.py'));
    // The verifier prints its pass line only when it found no error, so a tree whose current source was
    // edited (the replaced rule fires in `before`) differs there. Compare the error lines exactly and tie
    // the pass line to the absence of errors, on every host.
    const errorLines = lines => lines.filter(line => line.startsWith('error: '));
    const passLines = lines => lines.filter(line => line.startsWith('CCA workspace verification passed: '));
    assert.deepEqual(after.filter(line => replaced.test(line)), []);
    assert.deepEqual(errorLines(after), errorLines(before).filter(line => !replaced.test(line)));
    assert.equal(passLines(after).length, errorLines(after).length === 0 ? 1 : 0);
    assert.deepEqual(after.filter(line => !line.startsWith('error: ') && !line.startsWith('CCA workspace verification passed: ')),
      before.filter(line => !line.startsWith('error: ') && !line.startsWith('CCA workspace verification passed: ')));
  } finally { fs.rmSync(directory, { recursive: true, force: true }); }
});
