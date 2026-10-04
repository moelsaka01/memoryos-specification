import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { J as mo1306J } from '../../memoryos-ci/src/serialization.mjs';
import { canonicalBytes as mo1307J } from '../../memoryos-readiness/src/canonical.mjs';
import { canonicalize, mipDigest } from '../../cca-studio/web/js/mip-canonical.js';
import { MemoryOS } from '../../cca-studio/web/js/memoryos-sdk.js';
import { InvestigationCore } from '../../cca-studio/web/js/investigation-core.js';
import { referenceSnapshot } from '../../cca-studio/web/data/studio-snapshot.js';
import { cloneDetached } from '../../cca-studio/web/js/studio-model.js';

// MO-1308 Contract Freeze 1 §18.2 Phase 1 entry obligations. Read-only: nothing is written.
const workspace = fileURLToPath(new URL('../../../', import.meta.url));
const conformance = fileURLToPath(new URL('../', import.meta.url));
const decoder = new TextDecoder('utf-8', { fatal: true });

function filesBelow(directory) {
  const result = [];
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) walk(full); else if (entry.isFile()) result.push(full);
    }
  };
  walk(directory);
  return result.sort();
}
function parsedValue(bytes) {
  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) return undefined;
  try { return JSON.parse(decoder.decode(bytes)); } catch { return undefined; }
}
function attempt(fn) { try { return fn(); } catch { return null; } }
const jcsLf = value => attempt(() => canonicalize(value) + '\n');
const j1306 = value => attempt(() => mo1306J(value));
const j1307 = value => attempt(() => mo1307J(value, { maxBytes: 1 << 30 }).toString('utf8'));

// R03 corpus: every MO-1306 and MO-1307 fixture in this repository.
const corpusRoots = ['fixtures/mo1306', 'fixtures/mo1306-phase2c', 'fixtures/mo1307'];

test('EO1 every MO-1306/MO-1307 J-canonical fixture equals JCS plus one trailing LF', () => {
  let files = 0, canonical = 0;
  const mismatches = [];
  for (const root of corpusRoots) {
    for (const file of filesBelow(path.join(conformance, root))) {
      files += 1;
      const bytes = fs.readFileSync(file);
      const value = parsedValue(bytes);
      if (value === undefined) continue;
      const text = bytes.toString('utf8');
      if (j1306(value) !== text && j1307(value) !== text) continue;
      canonical += 1;
      if (jcsLf(value) !== text) mismatches.push(path.relative(workspace, file));
    }
  }
  assert.deepEqual(mismatches, []);
  assert.ok(files >= 662, `corpus files ${files}`);
  assert.ok(canonical >= 553, `J-canonical fixtures ${canonical}`);
});

test('EO1 MO-1306 and MO-1307 J serialize every fixture value in their domain exactly as JCS plus LF', () => {
  let domain1306 = 0, domain1307 = 0;
  const mismatches = [];
  for (const root of corpusRoots) {
    for (const file of filesBelow(path.join(conformance, root))) {
      const value = parsedValue(fs.readFileSync(file));
      if (value === undefined) continue;
      const expected = jcsLf(value);
      const a = j1306(value), b = j1307(value);
      if (a !== null) { domain1306 += 1; if (a !== expected) mismatches.push(['MO-1306', path.relative(workspace, file)]); }
      if (b !== null) { domain1307 += 1; if (b !== expected) mismatches.push(['MO-1307', path.relative(workspace, file)]); }
    }
  }
  assert.deepEqual(mismatches, []);
  assert.ok(domain1306 >= 614 && domain1307 >= 605, `${domain1306}/${domain1307}`);
});

test('EO1 boundary vectors: key order, escapes, integers and nesting agree', () => {
  const vectors = [
    {}, [], { b: 1, a: 0, aa: [], A: null },
    { z: { y: { x: [1, [2, [3, {}]]] } } },
    { s: 'quote " backslash \\ solidus / tab\t newline\n del\u007f' },
    { s: 'é 漢字 😀   ' },
    { '｡': 1, '😀': 2, 'a': 3 },
    { n: [0, 1, 9007199254740991] }, [true, false, null, ''],
  ];
  for (const value of vectors) {
    const expected = jcsLf(value);
    assert.notEqual(expected, null);
    assert.equal(j1306(value), expected, JSON.stringify(value));
    const b = j1307(value);
    if (b !== null) assert.equal(b, expected, JSON.stringify(value));
  }
  // Outside the J domain both J implementations refuse rather than diverge.
  for (const value of [{ n: -1 }, { n: 1.5 }, { n: 2 ** 53 }]) {
    assert.equal(j1306(value), null); assert.equal(j1307(value), null);
  }
});

function changedReport() {
  const core = new InvestigationCore();
  const changed = cloneDetached(referenceSnapshot);
  changed.longTermMemory.entries[0].value = 'MO-1308 entry obligation Regression change.';
  core.create({ identifier: 'mo1308-eo2-baseline', snapshot: referenceSnapshot });
  core.create({ identifier: 'mo1308-eo2-candidate', snapshot: changed });
  return JSON.parse(JSON.stringify(core.regression('mo1308-eo2-baseline', 'mo1308-eo2-candidate')));
}
const reportBytes = report => new TextEncoder().encode(canonicalize(report));
// Independent recomputation from the Standard (cognitive-regression.md, report identity).
const standardIdentifier = report => 'regression:' + mipDigest('INVESTIGATION-CORE-REGRESSION-1.0', canonicalize({
  baseline: report.baseline, candidate: report.candidate, categories: report.categories,
  overall: report.overall, regressionDetected: report.regressionDetected })).slice(7);
const rejectsIdentity = (sdk, report) => assert.throws(() => sdk.inspectRegressionReport(reportBytes(report)),
  error => error.code === 'REGRESSION_REPORT_IDENTITY_MISMATCH');

test('EO2 inspectRegressionReport accepts a genuine report and returns its Standard identity', () => {
  const report = changedReport();
  assert.equal(report.overall, 'regressionDetected');
  assert.equal(report.identifier, standardIdentifier(report));
  const inspection = new MemoryOS().inspectRegressionReport(reportBytes(report));
  assert.equal(inspection.reportIdentifier, report.identifier);
  assert.equal(inspection.authority, 'inspectionOnly');
});

test('EO2 inspectRegressionReport rejects identifier and content tampering', () => {
  const sdk = new MemoryOS(), report = changedReport();
  const changedCategory = report.categories.findIndex(category => category.differences.length > 0);
  assert.notEqual(changedCategory, -1);
  const tampers = [
    r => { r.identifier = 'regression:' + '0'.repeat(64); },
    r => { r.baseline.sourceIdentifier += '-x'; r.candidate.sourceIdentifier += '-x'; },
    r => { r.baseline.workspaceIdentifier += '-x'; r.candidate.workspaceIdentifier += '-x'; },
    r => { r.categories[changedCategory].differences[0].afterDigest = 'sha256:' + 'f'.repeat(64); },
  ];
  for (const tamper of tampers) { const forged = structuredClone(report); tamper(forged); rejectsIdentity(sdk, forged); }
});

test('EO2 identity is integrity, not origin: a self-consistent recomputed forgery is accepted', () => {
  // Recorded limit (Freeze H07): a consumer that recomputes the identifier can forge a report.
  const forged = changedReport();
  forged.baseline.sourceIdentifier += '-forged'; forged.candidate.sourceIdentifier += '-forged';
  forged.identifier = standardIdentifier(forged);
  assert.equal(new MemoryOS().inspectRegressionReport(reportBytes(forged)).reportIdentifier, forged.identifier);
});

const MO1302_VENDOR_ROOT = '.github/actions/memoryos-policy-gate/dist/vendor';
const releasedSdkCopies = [
  '.github/actions/memoryos-policy-gate/dist/vendor/repositories/cca-studio/web/js/memoryos-sdk.js',
  'repositories/memoryos-ci/runtime/authoritative/web/js/memoryos-sdk.js',
  'repositories/memoryos-mcp/runtime/authoritative/web/js/memoryos-sdk.js',
  'repositories/memoryos-rest/runtime/authoritative/web/js/memoryos-sdk.js',
  'repositories/memoryos-vscode/runtime/vendor/repositories/cca-studio/web/js/memoryos-sdk.js',
];

test('EO3 released SDK copies are byte-identical to the current source SDK', () => {
  const source = fs.readFileSync(path.join(workspace, 'repositories/cca-studio/web/js/memoryos-sdk.js'));
  for (const copy of releasedSdkCopies) assert.ok(fs.readFileSync(path.join(workspace, copy)).equals(source), copy);
});

test('EO3 the workspace verifier binds every MO-1302 vendored runtime file to its current source bytes', () => {
  // This released-closure check recomputes current SDK and CLI source bytes (Freeze §18.2 item 4).
  const verifier = fs.readFileSync(path.join(workspace, 'tools/verify_workspace.py'), 'utf8');
  assert.match(verifier, /if original\.read_bytes\(\) != vendored\.read_bytes\(\):/);
  const listed = [...verifier.slice(verifier.indexOf('MO1302_VENDOR_SOURCES = ('),
    verifier.indexOf(')', verifier.indexOf('MO1302_VENDOR_SOURCES = ('))).matchAll(/"([^"]+)"/g)].map(m => m[1]);
  for (const required of ['repositories/cca-studio/web/js/memoryos-sdk.js', 'repositories/memoryos-cli/src/commands.js',
    'repositories/memoryos-cli/src/main.js', 'repositories/memoryos-cli/src/help.js', 'repositories/memoryos-cli/src/version.js',
    'repositories/memoryos-cli/package.json']) assert.ok(listed.includes(required), required);
  for (const source of listed) {
    assert.ok(fs.readFileSync(path.join(workspace, source)).equals(
      fs.readFileSync(path.join(workspace, MO1302_VENDOR_ROOT, source))), source);
  }
});
