// One-time engineering correction of the frozen fixture's incomplete raw lineage.
// This script retains the original failure and identities; it changes no product rule.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { canonicalBytes, canonicalDigest, digest, proofBindingDigest } from '../../../memoryos-readiness/src/canonical.mjs';
import { verifyEvidence } from '../../../memoryos-readiness/src/evidence-verifier.mjs';
import { loadBundle, inputOf, fixtureRoot } from './test-support.mjs';

const repo = fileURLToPath(new URL('../../../../', import.meta.url));
const base = 'repositories/cca-conformance/fixtures/mo1307/';
const generatorPath = 'repositories/cca-conformance/tools/mo1307-phase1/generate-fixtures.mjs';
const evidencePath = 'repositories/cca-conformance/evidence/mo1307/phase2b/development/mo1306-source-lineage.json';
const full = path => resolve(repo, path);
assert.equal(fs.existsSync(full(evidencePath)), false, 'Do not overwrite retained correction evidence');
const paths = [...JSON.parse(fs.readFileSync(new URL('catalog.json', fixtureRoot))).files.map(row => base + row.path), base + 'catalog.json', generatorPath];
const originals = new Map(paths.map(path => [path, fs.readFileSync(full(path))]));
const before = loadBundle('mo1306-qualified');
let originalDiagnostic;
try { verifyEvidence(inputOf(before)); assert.fail('Expected original unused-entry rejection'); }
catch (error) {
  assert.equal(error.code, 'MO1307_EVIDENCE_AUTHORITY');
  assert.equal(error.stage, 'AUTHORITY'); assert.equal(error.reference, 'configuration-source.0');
  originalDiagnostic = { code: error.code, stage: error.stage, reference: error.reference };
}
const configurationSources = before.manifest.entries.filter(entry => entry.id.startsWith('configuration-source.'));
assert.equal(configurationSources.length, 8);
assert.ok(configurationSources.every(entry => !before.authority.assessment.grants.some(grant => grant.sourceIds.includes(entry.id))));
let generator = originals.get(generatorPath).toString('utf8');
const sourceLine = "    const claim = { type, version: V, originCandidate:";
assert.equal(generator.split(sourceLine).length, 2);
generator = generator.replace(sourceLine,
  "    // Bind the preserved raw configuration receipts to each claim that depends\n" +
  "    // on their reviewed CONFIGURATION inventory; source lineage is audit-only.\n" +
  "    if (options.released && dependencies.some(d => d.role === 'CONFIGURATION')) {\n" +
  "      sourceIds.push(...sourceRecords.filter(s => s.id.startsWith('configuration-source.')).map(s => s.id));\n" +
  "      sourceIds.sort();\n" +
  "    }\n" + sourceLine);
const oldWrite = '  else { mkdirSync(dirname(full), { recursive: true }); writeFileSync(full, bytes); }';
assert.equal(generator.split(oldWrite).length, 2);
generator = generator.replace(oldWrite, '  else if (!existsSync(full) || !readFileSync(full).equals(bytes)) { mkdirSync(dirname(full), { recursive: true }); writeFileSync(full, bytes); }');
fs.writeFileSync(full(generatorPath), generator);
const generation = execFileSync(process.execPath, [full(generatorPath)], { cwd: repo, encoding: 'utf8' });
const after = loadBundle('mo1306-qualified'), verified = verifyEvidence(inputOf(after));
assert.deepEqual(after.result.assessment, before.result.assessment);
assert.equal(after.pins.expectedReadinessDigest, before.pins.expectedReadinessDigest);
assert.notEqual(after.pins.expectedProofBindingDigest, before.pins.expectedProofBindingDigest);
assert.deepEqual(verified.audit, after.result.audit);
assert.equal(proofBindingDigest(after.result.readinessDigest, verified.audit), after.result.proofBindingDigest);
for (const entry of before.manifest.entries.filter(row => row.type !== 'ENVELOPE')) {
  assert.deepEqual(after.manifest.entries.find(row => row.id === entry.id), entry);
  assert.deepEqual(after.files.get(entry.id), before.files.get(entry.id));
}
for (const [id, envelope] of before.envelopes) assert.deepEqual(after.envelopes.get(id).claim, envelope.claim);
const changed = paths.filter(path => !originals.get(path).equals(fs.readFileSync(full(path))));
for (const path of changed) assert.ok(path === generatorPath || path === base + 'catalog.json' || path === base + 'negative/history-omission.json' || path.startsWith(base + 'bundles/mo1306-qualified/'), 'Unrelated fixture drift: ' + path);
const identity = (path, bytes) => ({ path, byteLength: bytes.length, sha256: digest(bytes) });
const record = {
  kind: 'MO1307Phase2BFixtureLineageCorrection', version: '1.0.0',
  classification: 'PHASE1_FIXTURE_SOURCE_LINEAGE_DEFECT_CORRECTED',
  baseline: '3883ca889911fcc5a6f46c24e569478a8c32648e',
  authority: 'docs/mo1307-contract-freeze-1.md sections 6 and 7',
  originalDiagnostic,
  finding: 'Eight exact configuration-source.0 through configuration-source.7 SOURCE entries were listed in the MO-1306 manifest but unused by any envelope/grant. The complete Phase 2B verifier correctly rejected the original fixture.',
  correction: 'Add all eight raw configuration source IDs to the existing source lineage of each MO-1306 claim whose declared dependencies include CONFIGURATION. Recompute only affected envelope, manifest, raw authority, audit/proof and catalog bindings. Keep unused-entry rejection unchanged.',
  changedPaths: changed,
  before: { pins: before.pins, files: changed.map(path => identity(path, originals.get(path))), normalizedClaims: before.authority.assessment.grants.map(grant => ({ envelopeId: grant.envelopeId, claimDigest: grant.claimDigest })), rawSources: before.manifest.entries.filter(row => row.type !== 'ENVELOPE').map(row => ({ id: row.id, path: base + 'bundles/mo1306-qualified/' + row.path, byteLength: row.byteLength, sha256: row.sha256 })) },
  after: { pins: after.pins, files: changed.map(path => identity(path, fs.readFileSync(full(path)))), consumedConfigurationSourceIds: configurationSources.map(row => row.id), consumingGrants: after.authority.assessment.grants.filter(grant => grant.sourceIds.includes('configuration-source.0')).map(grant => grant.id), completeEvidenceVerification: 'PASS' },
  unchanged: { candidateDigest: before.pins.expectedCandidateDigest, readinessDigest: before.pins.expectedReadinessDigest, graphDigest: before.result.assessment.graphDigest, authorityIdentityDigest: before.result.assessment.authorityIdentityDigest, entireNormativeAssessmentByteIdentical: true, everyNormalizedClaimByteIdentical: true, everyRawSourceAndAuthoritySourceByteIdentical: true, rawHistoryRows: 19, negativeHistoryProjections: 12, providerAxes: before.result.assessment.providers, qualifications: before.result.assessment.qualifications.length },
  generator: JSON.parse(generation),
  scope: 'Engineering fixture correction only. No new predecessor execution, production authority, release certification, schema or product acceptance rule change.',
};
fs.mkdirSync(resolve(full(evidencePath), '..'), { recursive: true });
fs.writeFileSync(full(evidencePath), canonicalBytes(record));
console.log(JSON.stringify({ originalDiagnostic, changedPaths: changed, consumingGrants: record.after.consumingGrants, unchanged: record.unchanged, pins: record.after.pins }));
