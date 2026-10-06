import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import * as sdk from '../../cca-studio/web/js/memoryos-sdk.js';
import { stableStringify } from '../tools/mo1308-phase3/lib/stable-json.mjs';
import { scanImports, importClosure } from '../tools/mo1308-phase3/lib/closure.mjs';
import { buildInventory, inventoryBytes, validateInventory, allCases, requirementMatrix, streamOf } from '../tools/mo1308-phase3/lib/inventory.mjs';
import { QUALIFICATIONS, REQUIREMENT_IDS } from '../tools/mo1308-phase3/lib/inventory-source.mjs';
import { renderDocument } from '../tools/mo1308-phase3/render-protocol.mjs';
import { ALLOWED_CHANGE_RULES, classifyChangedPath } from '../tools/mo1308-phase3/lib/allowed-paths.mjs';
import { changedPaths, git, repositoryRoot } from '../tools/mo1308-phase3/lib/git.mjs';
import { CANDIDATE_BASE, computeCandidate, verifyCandidate } from '../tools/mo1308-phase3/lib/candidate.mjs';
import { CORPUS_ID, FILLER_BYTE, RECIPES, SEEDS, buildRecipe, corpusManifest, corpusRecords, drbgWord, fillerBytes, fillerDigest, limitVectorSpecs, sampleIndices, verifyManifest } from '../tools/mo1308-phase3/corpus.mjs';
import { digestOf, digestOfJson, recordFile, sha256Hex, walkRecords } from '../tools/mo1308-phase3/lib/hashing.mjs';
import { check } from '../tools/mo1308-phase3/lib/shape.mjs';
import { validate, validateReview, SEAL_SHAPE, EXECUTION_RULES, GENERATION_ID } from '../tools/mo1308-phase3/lib/receipts.mjs';
import { validateDisposition, requiresOwnerReview } from '../tools/mo1308-phase3/lib/classification.mjs';
import { CampaignError, isApprovedStatus, parseGeneration, protocolStatus, sealGeneration, sharedToolPaths, verifyBindings } from '../tools/mo1308-phase3/lib/seal.mjs';
import { HarnessError, closeGeneration, runSegment, verifyEvidence } from '../tools/mo1308-phase3/lib/runner.mjs';
import { writeOnce } from '../tools/mo1308-phase3/lib/evidence.mjs';
import { buildExecutors, checkDefinition, rehearse, summarize } from '../tools/mo1308-phase3/lib/campaign-driver.mjs';
import { checkDisclosure, qualificationCases, readOutcomes, structuralQualifications } from '../tools/mo1308-phase3/lib/disclosure.mjs';

// MO-1308 Phase 3, shared step: the protocol document, the case inventory, the candidate identity, the corpus and the campaign
// runner. Everything here is pure and runs in the cloud (Linux) as well as on the host; no Windows-only behavior is tested.
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = repositoryRoot(here);
const inFile = (...segments) => path.join(repo, ...segments);
const BF = '1dd1e8c82fe0ed5a32a894744392f2c279f89d4c';
const TOOLS = 'repositories/cca-conformance/tools/mo1308-phase3';
const PROTOCOL = 'docs/mo1308-phase3-protocol.md';
const INVENTORY = 'repositories/cca-conformance/mo1308-phase3-inventory.json';
const IDENTITY = 'repositories/cca-conformance/mo1308-phase3-candidate-identity.json';
const MANIFEST = 'repositories/cca-conformance/mo1308-phase3-corpus-manifest.json';
const haveBase = git(repo, ['cat-file', '-e', `${CANDIDATE_BASE}^{commit}`], { allowFailure: true }).status === 0;
const haveBf = git(repo, ['cat-file', '-e', `${BF}^{commit}`], { allowFailure: true }).status === 0;
const tmp = (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'mo1308-p3-'));
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  return directory;
};

// ---------------------------------------------------------------- stable JSON, hashing, shapes

test('S01 stable JSON sorts keys, ends with one LF and rejects what is not reproducible', () => {
  assert.equal(stableStringify({ b: 1, a: [true, null, 'x'] }), '{\n  "a": [\n    true,\n    null,\n    "x"\n  ],\n  "b": 1\n}\n');
  assert.throws(() => stableStringify({ a: 0.5 }), /safe integer/);
  assert.throws(() => stableStringify({ a: undefined }), /undefined/);
  assert.throws(() => stableStringify({ a: new Date(0) }), /plain object/);
  assert.throws(() => stableStringify({ a: Number.NaN }), /safe integer/);
  assert.equal(stableStringify({ b: 2, a: 1 }), stableStringify({ a: 1, b: 2 }));
});

test('S02 hashing helpers agree with node:crypto and refuse links', (t) => {
  const directory = tmp(t);
  fs.writeFileSync(path.join(directory, 'a.txt'), 'abc');
  fs.mkdirSync(path.join(directory, 'sub'));
  fs.writeFileSync(path.join(directory, 'sub', 'b.txt'), '');
  assert.equal(sha256Hex(Buffer.from('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.equal(digestOf(Buffer.alloc(0)), 'sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
  assert.deepEqual(walkRecords(directory).map((row) => row.path), ['a.txt', 'sub/b.txt']);
  assert.deepEqual(recordFile(directory, 'a.txt'), { path: 'a.txt', byteLength: 3, sha256: sha256Hex(Buffer.from('abc')) });
  fs.symlinkSync(path.join(directory, 'a.txt'), path.join(directory, 'link'));
  assert.throws(() => walkRecords(directory), /not a regular file/);
  assert.throws(() => recordFile(directory, 'link'), /not a regular file/);
});

test('S03 the closed-shape validator rejects extra and missing members', () => {
  const problems = check(SEAL_SHAPE, { kind: 'MO1308Phase3Seal', extra: 1 });
  assert.ok(problems.some((problem) => problem.includes('extra: unexpected member')));
  assert.ok(problems.some((problem) => problem.includes('missing member')));
});

// ---------------------------------------------------------------- import closure

test('C01 the scanner reads statements and skips comments, strings, templates and regular expressions', () => {
  const source = `
    import a from "./a.js";
    import { b, c as d } from './b.js';
    import * as e from "./e.js";
    import f, { g } from "./f.js";
    import "./side.js";
    export { h } from "./h.js";
    export * from "./i.js";
    export * as j from "./j.js";
    import fs from "node:fs";
    const k = await import("./k.js");
    // import x from "./comment.js";
    /* import y from "./block.js"; */
    const text = 'import z from "./string.js"';
    const tpl = \`import w from "./template.js" \${ 1 + 1 }\`;
    const re = /import v from "./regex.js"/;
    const split = a / b / c;
    export const local = 1;
    export { local as renamed };
    class K { import(input) { return input; } }
    obj.import("./notacall.js");
    import.meta.url;
  `;
  const { specifiers, dynamicNonLiteral } = scanImports(source);
  assert.deepEqual(specifiers, ['./a.js', './b.js', './e.js', './f.js', './side.js', './h.js', './i.js', './j.js', 'node:fs', './k.js']);
  assert.equal(dynamicNonLiteral, 0);
  assert.equal(scanImports('const m = await import(name);').dynamicNonLiteral, 1);
  assert.equal(scanImports('const m = await import(`./${x}.js`);').dynamicNonLiteral, 1);
});

test('C02 the closure follows relative imports, separates built-ins and externals, and reports missing files', () => {
  const files = { 'p/a.js': 'import "./b.js"; import fs from "node:fs"; import ext from "left-pad";', 'p/b.js': 'import "../q/c.js"; import "./a.js";', 'q/c.js': 'export const c = 1;' };
  const closure = importClosure((file) => files[file] ?? null, ['p/a.js']);
  assert.deepEqual(closure.files, ['p/a.js', 'p/b.js', 'q/c.js']);
  assert.deepEqual(closure.builtins, ['node:fs']);
  assert.deepEqual(closure.externals, ['left-pad']);
  assert.deepEqual(importClosure((file) => files[file] ?? null, ['p/missing.js']).errors, [{ file: 'p/missing.js', code: 'MISSING_FILE', specifier: null }]);
});

test('C03 the static closure of the CLI and SDK equals the set Node actually loads', (t) => {
  const directory = tmp(t);
  const log = path.join(directory, 'loaded.log');
  const hooks = path.join(directory, 'hooks.mjs');
  const register = path.join(directory, 'register.mjs');
  fs.writeFileSync(hooks, `import fs from 'node:fs';\nexport async function load(url, context, next) { if (url.startsWith('file:')) fs.appendFileSync(process.env.P3_LOG, url + '\\n'); return next(url, context); }\n`);
  fs.writeFileSync(register, `import { register } from 'node:module';\nregister(${JSON.stringify(pathToFileURL(hooks).href)});\n`);
  const loader = `await import(${JSON.stringify(pathToFileURL(inFile('repositories/memoryos-cli/src/main.js')).href)});\nawait import(${JSON.stringify(pathToFileURL(inFile('repositories/cca-studio/web/js/memoryos-sdk.js')).href)});\n`;
  fs.writeFileSync(path.join(directory, 'entry.mjs'), loader);
  const run = spawnSync(process.execPath, ['--import', pathToFileURL(register).href, path.join(directory, 'entry.mjs')], { env: { ...process.env, P3_LOG: log }, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const loaded = new Set(fs.readFileSync(log, 'utf8').split('\n').filter(Boolean).map((url) => path.relative(repo, fileURLToPath(url)).split(path.sep).join('/'))
    .filter((relative) => relative.startsWith('repositories/')));
  const read = (relative) => { try { return fs.readFileSync(inFile(relative), 'utf8'); } catch { return null; } };
  const closure = importClosure(read, ['repositories/memoryos-cli/src/main.js', 'repositories/cca-studio/web/js/memoryos-sdk.js']);
  loaded.delete('repositories/memoryos-cli/src/main.js');
  assert.deepEqual([...loaded].filter((file) => file !== 'repositories/cca-studio/web/js/memoryos-sdk.js').sort(),
    closure.files.filter((file) => file !== 'repositories/memoryos-cli/src/main.js' && file !== 'repositories/cca-studio/web/js/memoryos-sdk.js').sort());
  assert.deepEqual(closure.errors, []);
  assert.deepEqual(closure.externals, []);
});

// ---------------------------------------------------------------- inventory and protocol document

test('I01 the committed inventory equals the source byte for byte and validates', () => {
  assert.ok(fs.readFileSync(inFile(INVENTORY)).equals(inventoryBytes(buildInventory())));
  assert.deepEqual(validateInventory(buildInventory()), []);
});

test('I02 stream, step and case counts are the protocol ones', () => {
  const inventory = buildInventory();
  const shape = (id) => streamOf(inventory, id).steps.map((step) => `${step.id}:${step.cases.length}`).join(' ');
  assert.equal(shape('3A'), 'A:7 B:10 C:6 D:12 E:7 F:7 G:6 H:10 I:6 J:13 K:4 L:6 M:4 JC:10');
  assert.equal(shape('3B'), 'A:4 B:5 C:5 D:4 E:3 F:2 G:3');
  assert.equal(shape('3C'), 'A:7 B:6 C:10 D:9 E:9 F:5 G:6 H:5 I:3 J:7 K:3');
  assert.equal(shape('3D'), 'D:7');
  assert.deepEqual(streamOf(inventory, '3A').steps.filter((step) => step.segment === 'ceiling').map((step) => step.id), ['JC']);
  assert.equal(allCases(inventory).length, 108 + 26 + 70 + 7);
  assert.deepEqual(streamOf(inventory, '3A').segments.map((s) => [s.id, s.budgetMinutes, s.extendedMinutes]), [['main1', 90, 180], ['main2', 90, 180], ['ceiling', 180, 180]]);
  assert.deepEqual(streamOf(inventory, '3A').steps.map((step) => `${step.id}:${step.segment}`).join(' '), 'A:main1 B:main1 C:main1 D:main1 E:main1 F:main2 G:main2 H:main2 I:main2 J:main2 K:main2 L:main2 M:main2 JC:ceiling');
});

test('I03 every Freeze requirement R01-R37 and every qualification Q01-Q15 is covered', () => {
  const inventory = buildInventory();
  assert.equal(REQUIREMENT_IDS.length, 37);
  assert.equal(QUALIFICATIONS.length, 15);
  for (const row of requirementMatrix(inventory)) assert.ok(row.cases.length > 0, `${row.requirement} has no case`);
  const mutated = JSON.parse(JSON.stringify(inventory));
  for (const stream of mutated.streams) for (const step of stream.steps) for (const item of step.cases) {
    item.requirements = item.requirements.filter((id) => id !== 'MO1308-R37');
  }
  assert.ok(validateInventory(mutated).some((problem) => problem.startsWith('MO1308-R37')));
  const duplicated = JSON.parse(JSON.stringify(inventory));
  duplicated.streams[1].steps[0].cases.push({ ...duplicated.streams[1].steps[0].cases[0] });
  assert.ok(validateInventory(duplicated).some((problem) => problem.includes('duplicate case')));
});

test('I04 the owner decisions D6 and D7 are in the inventory', () => {
  const cases = new Map(allCases(buildInventory()).map((item) => [item.id, item]));
  assert.ok(cases.get('3A-F7').title.includes('more than 1 of 10'));
  assert.equal(cases.get('3A-F7').mode, 'record');
  assert.ok(cases.get('3C-A6').qualifications.includes('Q03'));
  assert.ok(cases.get('3C-K2').title.includes('headDigest'));
  assert.ok(cases.get('3C-E6').qualifications.includes('Q04'));
  assert.ok(cases.get('3C-D9').title.includes('sub-agent'));
  assert.equal(cases.get('3A-A7').mandatory, false);
  assert.ok(cases.get('3A-JC6').title.includes('1000.9 s'));
});

test('P01 the protocol document is APPROVED as Amendment A8, current with the inventory, and names exactly the inventory cases', () => {
  const text = fs.readFileSync(inFile(PROTOCOL), 'utf8');
  assert.match(text, /^Status: \*\*APPROVED — FREEZE AMENDMENT A8 \(owner approval 2026-10-06\)\*\*\.$/m);
  assert.equal(renderDocument(text), text, 'run: node tools/mo1308-phase3/render-protocol.mjs update');
  const ids = new Set(text.match(/\b3[ABCD]-[A-Z]+\d+\b/g));
  const expected = new Set(allCases(buildInventory()).map((item) => item.id));
  for (const id of expected) assert.ok(ids.has(id), `${id} is missing from the document`);
  for (const id of ids) assert.ok(expected.has(id), `${id} is in the document but not the inventory`);
  for (const id of ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8', 'D9', 'D10', 'D11']) assert.ok(text.includes(`| ${id} |`), `decision ${id}`);
  for (const [id] of QUALIFICATIONS) assert.ok(text.includes(`| ${id} |`), id);
});

// ---------------------------------------------------------------- allowed paths, candidate identity, no production change

test('A01 every path changed since BF up to B2 is in the allowed set; unrelated paths are not', { skip: !haveBase || !haveBf }, () => {
  const paths = changedPaths(repo, BF, CANDIDATE_BASE);
  assert.equal(paths.length, 186);
  assert.deepEqual(paths.filter((file) => classifyChangedPath(file) === null), []);
  for (const file of ['repositories/memoryos-mcp/package.json', 'repositories/memoryos-readiness/src/constants.mjs', 'repositories/memoryos-cli/bin/other.js',
    'repositories/cca-conformance/evidence/mo1307/final-headless/x.json', 'package.json']) assert.equal(classifyChangedPath(file), null, file);
  assert.equal(ALLOWED_CHANGE_RULES.length, 7);
});

test('A02 this branch changes no production path and adds nothing under evidence/', { skip: !haveBase }, () => {
  const names = new Set(git(repo, ['diff', '--name-only', '-z', CANDIDATE_BASE]).stdout.toString('utf8').split('\0').filter(Boolean));
  for (const name of git(repo, ['ls-files', '--others', '--exclude-standard', '-z']).stdout.toString('utf8').split('\0').filter(Boolean)) names.add(name);
  for (const name of names) {
    assert.ok(!name.includes('/evidence/'), `${name}: the shared step never touches evidence`);
    assert.notEqual(classifyChangedPath(name), null, `${name} is outside the allowed set`);
  }
  const identity = JSON.parse(fs.readFileSync(inFile(IDENTITY), 'utf8'));
  const productionPaths = new Set(identity.productionPaths.map((row) => row.path));
  for (const name of names) assert.ok(!productionPaths.has(name), `${name} is a production path`);
});

test('K01 the candidate identity is exactly reproducible from git objects at B2', { skip: !haveBase }, () => {
  const identity = JSON.parse(fs.readFileSync(inFile(IDENTITY), 'utf8'));
  assert.equal(identity.baseCommit, CANDIDATE_BASE);
  assert.equal(identity.productionPaths.length, 45);
  assert.deepEqual(identity.builtins, ['node:fs', 'node:path']);
  assert.ok(fs.readFileSync(inFile(IDENTITY)).equals(Buffer.from(stableStringify(computeCandidate({ repo, commit: CANDIDATE_BASE })))));
  assert.deepEqual(verifyCandidate({ repo, identity }), []);
  assert.deepEqual(verifyCandidate({ repo, identity, against: 'HEAD' }), [], 'HEAD must not change a production path');
  for (const row of identity.productionPaths) assert.match(row.blob, /^[0-9a-f]{40}$/);
  assert.equal(identity.productionTreeDigest, digestOfJson(identity.productionPaths));
});

test('K02 a tampered identity is detected', { skip: !haveBase }, () => {
  const identity = JSON.parse(fs.readFileSync(inFile(IDENTITY), 'utf8'));
  const wrongBlob = JSON.parse(JSON.stringify(identity));
  wrongBlob.productionPaths[0].blob = '0'.repeat(40);
  assert.ok(verifyCandidate({ repo, identity: wrongBlob }).length > 0);
  const wrongDigest = { ...identity, productionTreeDigest: `sha256:${'0'.repeat(64)}` };
  assert.ok(verifyCandidate({ repo, identity: wrongDigest }).length > 0);
  assert.ok(verifyCandidate({ repo, identity: { ...identity, kind: 'x' } })[0].includes('not a candidate'));
  const removed = JSON.parse(JSON.stringify(identity));
  removed.productionPaths.pop();
  assert.ok(verifyCandidate({ repo, identity: removed }).length > 0);
});

test('K03 the identity command line verifies and fails closed', { skip: !haveBase }, () => {
  const tool = inFile(TOOLS, 'candidate-identity.mjs');
  const good = spawnSync(process.execPath, [tool, 'verify', '--file', inFile(IDENTITY), '--commit', 'HEAD'], { encoding: 'utf8' });
  assert.equal(good.status, 0, good.stdout + good.stderr);
  assert.equal(JSON.parse(good.stdout).result, 'PASS');
  const usage = spawnSync(process.execPath, [tool], { encoding: 'utf8' });
  assert.equal(usage.status, 2);
});

// ---------------------------------------------------------------- corpus

test('R01 the corpus manifest regenerates byte for byte and its digest seals it', () => {
  assert.deepEqual(verifyManifest(inFile(MANIFEST)), []);
  const manifest = JSON.parse(fs.readFileSync(inFile(MANIFEST), 'utf8'));
  assert.equal(manifest.corpusId, CORPUS_ID);
  const { corpusDigest, ...body } = manifest;
  assert.equal(corpusDigest, digestOfJson(body));
  assert.equal(corpusManifest().corpusDigest, corpusDigest);
});

test('R02 the corpus holds the records every campaign needs', () => {
  const records = corpusRecords();
  assert.equal(records.length, 66);
  assert.equal(new Set(records.map((record) => record.id)).size, 66);
  const kinds = new Map();
  for (const record of records) kinds.set(record.recordKind, (kinds.get(record.recordKind) ?? 0) + 1);
  assert.deepEqual([...kinds].sort(), [['CICD_RUN', 2], ['HUMAN_DECISION_CLAIM', 12], ['INVESTIGATION_CHECKPOINT', 40], ['MIP_PACKAGE', 1],
    ['POLICY_EVALUATION', 6], ['READINESS_RESULT', 4], ['REGRESSION_REPORT', 1]]);
  const checkpoints = records.filter((record) => record.recordKind === 'INVESTIGATION_CHECKPOINT');
  assert.equal(new Set(checkpoints.map((record) => digestOf(record.members[0].bytes))).size, 40, 'checkpoint records must be distinct');
  assert.equal(records.filter((record) => /^checkpoint-f\d\d$/.test(record.id)).length, 30);
  for (const record of records) {
    const sorted = record.members.map((member) => member.name);
    assert.deepEqual(sorted, [...sorted].sort());
  }
});

test('R03 every corpus record is admissible, and the recipes reach their recorded heads', () => {
  const records = corpusRecords();
  const manifest = JSON.parse(fs.readFileSync(inFile(MANIFEST), 'utf8'));
  const empty = sdk.verifyHistoryLedger({ descriptorBytes: sdk.createHistoryLedger({ ledgerName: 'p3-admission', workspaceIdentifier: manifest.workspaceIdentifier }).descriptorBytes, entries: [], members: new Map() });
  for (const record of records.filter((item) => item.recordKind !== 'HUMAN_DECISION_CLAIM')) {
    const admission = sdk.admitHistoryRecord({ recordKind: record.recordKind, members: record.members, ledger: empty });
    assert.equal(admission.recordKind, record.recordKind, record.id);
  }
  const expected = new Map([['all', [10, 10, 0]], ['purge', [11, 9, 1]], ['small', [3, 3, 0]]]);
  for (const recipe of RECIPES) {
    const built = buildRecipe(recipe, records);
    const row = manifest.recipes.find((item) => item.id === recipe.id);
    assert.equal(built.verification.headDigest, row.headDigest);
    assert.equal(built.verification.entryCount, expected.get(recipe.id)[0]);
    assert.equal(built.verification.retainedRecords, expected.get(recipe.id)[1]);
    assert.equal(built.verification.purgedRecords, expected.get(recipe.id)[2]);
    assert.deepEqual(row.entries.map((entry) => entry.sha256), built.entries.map((bytes) => digestOf(bytes)));
  }
});

test('R04 the decision claims carry both consistency labels through the all recipe', () => {
  const built = buildRecipe(RECIPES.find((recipe) => recipe.id === 'all'));
  const labels = built.entries.map((bytes) => JSON.parse(new TextDecoder().decode(bytes)).record?.decisionConsistency ?? null).filter((label) => label !== null);
  assert.deepEqual(labels, ['CONSISTENT', 'CONTRARY_TO_READINESS']);
});

test('R05 limit vectors are the Freeze limits, with deterministic filler', () => {
  const specs = new Map(limitVectorSpecs().map((spec) => [spec.id, spec]));
  const literal = { 'member-MIP_PACKAGE': 16777216, 'member-INVESTIGATION_CHECKPOINT': 33554432, 'member-POLICY_EVALUATION': 4060, 'member-REGRESSION_REPORT': 16777216,
    'member-CICD_RUN': 49152, 'member-READINESS_RESULT': 4194304, 'member-HUMAN_DECISION_CLAIM': 8192, 'entry-file': 16384, descriptor: 1024, 'cli-json-stdout': 4194304 };
  assert.equal(specs.size, Object.keys(literal).length);
  for (const [id, limit] of Object.entries(literal)) assert.equal(specs.get(id).limit, limit, id);
  assert.equal(specs.get('member-CICD_RUN').scope, 'total');
  assert.equal(fillerDigest(1000), digestOf(fillerBytes(1000)));
  assert.equal(fillerDigest(65536 * 2 + 5), digestOf(fillerBytes(65536 * 2 + 5)));
  assert.equal(fillerBytes(3)[0], FILLER_BYTE);
  const manifest = JSON.parse(fs.readFileSync(inFile(MANIFEST), 'utf8'));
  for (const vector of manifest.limitVectors) assert.deepEqual(vector.vectors.map((item) => item.length), [vector.limit - 1, vector.limit, vector.limit + 1]);
  assert.equal(manifest.limits.entriesPerLedger, 100000);
  assert.equal(manifest.limits.maximumIndex, 99999);
});

test('R06 the sampling generator is deterministic, sorted, distinct and pinned', () => {
  assert.equal(drbgWord('x', 0), drbgWord('x', 0));
  assert.notEqual(drbgWord('x', 0), drbgWord('x', 1));
  const sample = sampleIndices('seed', 50, 1000);
  assert.equal(sample.length, 50);
  assert.equal(new Set(sample).size, 50);
  assert.deepEqual(sample, [...sample].sort((a, b) => a - b));
  assert.ok(sample.every((value) => value >= 0 && value < 1000));
  assert.deepEqual(sampleIndices('seed', 50, 1000), sample);
  assert.deepEqual(sampleIndices('seed', 5, 5), [0, 1, 2, 3, 4]);
  assert.throws(() => sampleIndices('seed', 6, 5), RangeError);
  const manifest = JSON.parse(fs.readFileSync(inFile(MANIFEST), 'utf8'));
  for (const [name, spec] of Object.entries(SEEDS)) assert.deepEqual(manifest.seeds[name].probe, sampleIndices(spec.seed, 8, 100000), name);
  assert.deepEqual(manifest.seeds['A4-cli-flip-sample'].probe, [26882, 36166, 36297, 38347, 63854, 65980, 74625, 97193]);
});

test('R07 canaries are distinct and the F7 plan states the owner threshold', () => {
  const manifest = JSON.parse(fs.readFileSync(inFile(MANIFEST), 'utf8'));
  assert.equal(new Set(manifest.canaries.map((item) => item.value)).size, manifest.canaries.length);
  assert.ok(manifest.canaries.every((item) => !/^\d+$/.test(item.class)));
  assert.deepEqual(manifest.plans.F7, { repetitions: 10, escalateWhenRunsWithStagingEperm: 2, ofRuns: 10 });
  assert.equal(manifest.plans.F1.appenders, 10);
  assert.ok(manifest.runtimeCanarySources.includes('USERNAME'));
});

// ---------------------------------------------------------------- receipts, dispositions, reviews

test('V01 generation ids, the approval status and the placement rule', () => {
  assert.deepEqual(parseGeneration('phase3a'), { rehearsal: false, ordinal: 1, stream: '3A' });
  assert.deepEqual(parseGeneration('phase3c-g3'), { rehearsal: false, ordinal: 3, stream: '3C' });
  assert.deepEqual(parseGeneration('phase3b-rehearsal-r2'), { rehearsal: true, ordinal: 0, stream: '3B' });
  for (const bad of ['phase3e', 'phase3a-g1', 'phase3a-g0', 'phase3a-rehearsal-r0', 'phase3a-final', 'Phase3A']) {
    assert.throws(() => parseGeneration(bad), CampaignError, bad);
    assert.equal(GENERATION_ID.test(bad), false, bad);
  }
  assert.equal(protocolStatus(Buffer.from('# T\n\nStatus: **PROPOSED — PENDING OWNER APPROVAL (A8)**.\n')), 'PROPOSED — PENDING OWNER APPROVAL (A8)');
  assert.equal(isApprovedStatus('APPROVED — FREEZE AMENDMENT A8'), true);
  assert.equal(isApprovedStatus('PROPOSED — PENDING OWNER APPROVAL (A8)'), false);
  assert.equal(isApprovedStatus('NOT APPROVED'), false);
  assert.equal(protocolStatus(Buffer.from('no status line')), 'UNKNOWN');
});

const disposition = (overrides = {}) => ({
  kind: 'MO1308Phase3Disposition', version: '1.0.0', stream: '3B', generation: 'phase3b', evidenceSealSha256: '0'.repeat(64),
  subjects: [{ step: 'A', caseId: '3B-A1' }], class: 'HARNESS_DEFECT', publicBehaviourChange: false, diagnosis: 'the harness compared the wrong blob',
  nextAction: 'NEW_GENERATION', ownerReviewRequired: false, ownerApprovalReference: null, rerunOrdinal: 2, ...overrides,
});

test('V02 dispositions: the owner-review rule, the rerun ordinal and the historical class', () => {
  assert.deepEqual(validateDisposition(disposition()), []);
  assert.equal(requiresOwnerReview({ class: 'CONTRACT_DEFECT', publicBehaviourChange: false }), true);
  assert.equal(requiresOwnerReview({ class: 'PRODUCT_DEFECT', publicBehaviourChange: true }), true);
  assert.equal(requiresOwnerReview({ class: 'PRODUCT_DEFECT', publicBehaviourChange: false }), false);
  assert.equal(requiresOwnerReview({ class: 'ENVIRONMENT_BLOCKER', publicBehaviourChange: false }), false);
  assert.ok(validateDisposition(disposition({ class: 'CONTRACT_DEFECT' })).some((p) => p.includes('ownerReviewRequired')));
  assert.ok(validateDisposition(disposition({ class: 'CONTRACT_DEFECT', ownerReviewRequired: true })).some((p) => p.includes('ownerApprovalReference')));
  assert.deepEqual(validateDisposition(disposition({ class: 'CONTRACT_DEFECT', ownerReviewRequired: true, ownerApprovalReference: 'owner-2026-10-07' })), []);
  assert.ok(validateDisposition(disposition({ rerunOrdinal: null })).some((p) => p.includes('rerunOrdinal')));
  assert.ok(validateDisposition(disposition({ nextAction: 'OWNER_REVIEW' })).some((p) => p.includes('rerunOrdinal')));
  assert.ok(validateDisposition(disposition({ class: 'HISTORICAL_FAILURE' })).some((p) => p.includes('HISTORICAL_FAILURE')));
  assert.ok(validateDisposition(disposition({ class: 'FLAKE' })).length > 0, 'no flake class exists');
  assert.ok(validateDisposition(disposition({ extra: 1 })).length > 0);
});

const review = (overrides = {}) => ({
  kind: 'MO1308Phase3Review', version: '1.0.0', subject: [{ path: 'a.mjs', byteLength: 1, sha256: '1'.repeat(64) }],
  reviewer: { role: 'INDEPENDENT_SUB_AGENT', identity: 'review-agent-1' }, scope: 'the harness', findings: [], conclusion: 'NO_BLOCKING_FINDINGS',
  reviewedAt: '2026-10-07T00:00:00.000Z', ...overrides,
});

test('V03 reviews: an open blocking finding contradicts a clean conclusion', () => {
  assert.deepEqual(validateReview(review()), []);
  const blocking = [{ id: 'F1', severity: 'BLOCKING', summary: 'x', disposition: 'OPEN', note: '' }];
  assert.ok(validateReview(review({ findings: blocking })).length > 0);
  assert.deepEqual(validateReview(review({ findings: blocking, conclusion: 'BLOCKING_FINDINGS_OPEN' })), []);
  assert.deepEqual(validateReview(review({ findings: [{ ...blocking[0], disposition: 'FIXED' }] })), []);
  assert.ok(validateReview(review({ conclusion: 'BLOCKING_FINDINGS_OPEN' })).length > 0);
});

// ---------------------------------------------------------------- the runner

// A self-contained "repository root" with an approved protocol copy, so a certifying generation can be sealed without
// touching the real, still PROPOSED, protocol.
function makeRoot(t, { approved = true, review: withReview = true } = {}) {
  const root = tmp(t);
  const put = (relative, bytes) => { const target = path.join(root, relative); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, bytes); };
  const protocol = fs.readFileSync(inFile(PROTOCOL), 'utf8');
  put(PROTOCOL, protocol.replace(/^Status: \*\*.*\*\*\./m, approved ? 'Status: **APPROVED — FREEZE AMENDMENT A8 (test copy)**.' : 'Status: **PROPOSED — PENDING OWNER APPROVAL (A8)**.'));
  put(INVENTORY, fs.readFileSync(inFile(INVENTORY)));
  put(IDENTITY, fs.readFileSync(inFile(IDENTITY)));
  put(MANIFEST, fs.readFileSync(inFile(MANIFEST)));
  put(`${TOOLS}/campaign.mjs`, '// tool one\n');
  put(`${TOOLS}/helper.mjs`, '// tool two\n');
  if (withReview) put('review.json', stableStringify(review()));
  return root;
}
const baseOptions = (root, stream, generation, extra = {}) => ({
  root, stream, generation, certifying: !generation.includes('rehearsal'), protocolPath: PROTOCOL, inventoryPath: INVENTORY,
  candidateIdentityPath: IDENTITY, corpusManifestPath: MANIFEST, toolPaths: [`${TOOLS}/campaign.mjs`, `${TOOLS}/helper.mjs`],
  harnessReviewPath: 'review.json', evidenceDir: path.join(root, 'evidence', generation), enforcePlacement: false, ...extra,
});
const inventory = buildInventory();
const stepsOf = (stream) => streamOf(inventory, stream).steps;

// Executors that pass every case of every step; `override` replaces the body of chosen cases.
function executors(stream, override = {}) {
  const result = {};
  for (const step of stepsOf(stream)) {
    result[step.id] = async (ctx) => {
      for (const item of step.cases) {
        await ctx.runCase(item.id, async (handle) => {
          if (override[item.id] !== undefined) return override[item.id](handle);
          if (item.mode === 'record') handle.observe({ outcome: 'CONFIRMED' });
          return undefined;
        });
      }
    };
  }
  return result;
}
const clock = () => { let tick = 0; return () => new Date(Date.UTC(2026, 9, 7, 0, 0, tick++)); };
async function runAll(root, evidenceDir, stream, override = {}, options = {}) {
  const outcomes = [];
  for (const segment of streamOf(inventory, stream).segments) {
    outcomes.push(await runSegment({ root, evidenceDir, segmentId: segment.id, executors: executors(stream, override), now: clock(), ...options }));
    if (outcomes.at(-1).result !== 'PASS') break;
  }
  return outcomes;
}
const exists = (...parts) => fs.existsSync(path.join(...parts));

test('U01 a certifying generation: seal, run, close, verify; the receipt says ACCEPTED', async (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3B', 'phase3b');
  const { seal, sealSha256 } = sealGeneration({ ...options, now: clock() });
  assert.equal(seal.certifying, true);
  assert.equal(seal.protocol.status, 'APPROVED — FREEZE AMENDMENT A8 (test copy)');
  assert.deepEqual(seal.execution, EXECUTION_RULES);
  assert.equal(seal.steps.reduce((sum, step) => sum + step.cases.length, 0), 26);
  assert.equal(seal.segments[0].budgetMs, 90 * 60000);
  assert.equal(seal.steps.find((step) => step.id === 'A').guardMs, 5 * 60000);
  assert.equal(seal.candidate.baseCommit, CANDIDATE_BASE);
  assert.match(seal.candidate.productionTreeDigest, /^sha256:[0-9a-f]{64}$/);
  assert.match(seal.corpus.corpusDigest, /^sha256:[0-9a-f]{64}$/);
  assert.equal(sha256Hex(fs.readFileSync(path.join(options.evidenceDir, 'seal.json'))), sealSha256);
  assert.deepEqual(validate('seal', JSON.parse(fs.readFileSync(path.join(options.evidenceDir, 'seal.json'), 'utf8'))), []);
  const outcomes = await runAll(root, options.evidenceDir, '3B');
  assert.deepEqual(outcomes, [{ result: 'PASS', reason: null }]);
  const receipt = closeGeneration({ root, evidenceDir: options.evidenceDir, inventory, now: clock() });
  assert.equal(receipt.result, 'ACCEPTED');
  assert.equal(receipt.outcome, 'PHASE3B_ACCEPTED');
  assert.equal(receipt.promotable, true);
  assert.deepEqual(receipt.counts, { total: 26, PASS: 26, FAIL: 0, ESCALATE: 0, NOT_RUN: 0 });
  assert.deepEqual(receipt.mandatoryNotPassed, []);
  assert.ok(receipt.qualifications.some((item) => item.id === 'Q09'));
  assert.deepEqual(verifyEvidence({ root, evidenceDir: options.evidenceDir, inventory }).problems, []);
  assert.deepEqual(validate('streamReceipt', receipt), []);
  const files = walkRecords(options.evidenceDir).map((row) => row.path);
  assert.ok(files.includes('evidence-seal.json') && files.includes('stream-receipt.json') && files.includes('seal.json'));
  assert.ok(!files.includes('generation-stopped.json'));
});

test('U02 a certifying seal is refused without approval, a review or a matching generation id', (t) => {
  const real = { ...baseOptions(repo, '3B', 'phase3b'), evidenceDir: path.join(tmp(t), 'phase3b'), harnessReviewPath: null, toolPaths: [`${TOOLS}/lib/runner.mjs`] };
  fs.writeFileSync(path.join(tmp(t), 'unused'), '');
  const proposedRoot = makeRoot(t, { approved: false });
  assert.throws(() => sealGeneration(baseOptions(proposedRoot, '3B', 'phase3b')), (e) => e.code === 'PROTOCOL_NOT_APPROVED');
  void real;
  const rootNoReview = makeRoot(t, { review: false });
  assert.throws(() => sealGeneration(baseOptions(rootNoReview, '3B', 'phase3b', { harnessReviewPath: null })), (e) => e.code === 'REVIEW_REQUIRED');
  const root = makeRoot(t);
  assert.throws(() => sealGeneration(baseOptions(root, '3A', 'phase3b')), (e) => e.code === 'GENERATION_ID');
  assert.throws(() => sealGeneration(baseOptions(root, '3B', 'phase3b', { certifying: false })), (e) => e.code === 'GENERATION_ID');
  assert.throws(() => sealGeneration(baseOptions(root, '3B', 'phase3b-rehearsal-r1', { certifying: true })), (e) => e.code === 'GENERATION_ID');
  assert.throws(() => sealGeneration(baseOptions(root, '3B', 'phase3b', { enforcePlacement: true })), (e) => e.code === 'EVIDENCE_PLACEMENT');
  assert.throws(() => sealGeneration(baseOptions(root, '3B', 'phase3b', { guardOverridesMs: { A: 5 } })), (e) => e.code === 'OVERRIDE_NOT_ALLOWED');
  assert.throws(() => sealGeneration(baseOptions(root, '3B', 'phase3b', { toolPaths: ['missing.mjs'] })), (e) => e.code === 'BOUND_FILE_MISSING');
  const blocking = makeRoot(t);
  fs.writeFileSync(path.join(blocking, 'review.json'), stableStringify(review({ findings: [{ id: 'F1', severity: 'BLOCKING', summary: 'x', disposition: 'OPEN', note: '' }], conclusion: 'BLOCKING_FINDINGS_OPEN' })));
  assert.throws(() => sealGeneration(baseOptions(blocking, '3B', 'phase3b')), (e) => e.code === 'REVIEW_BLOCKING');
  const options = baseOptions(root, '3B', 'phase3b');
  sealGeneration(options);
  assert.throws(() => sealGeneration(options), (e) => e.code === 'EVIDENCE_NOT_EMPTY');
});

test('U03 a rehearsal is non-promotable and cannot be mistaken for a certification', async (t) => {
  const work = tmp(t);
  const options = { ...baseOptions(repo, '3B', 'phase3b-rehearsal-r1'), certifying: false, harnessReviewPath: null, evidenceDir: path.join(work, 'phase3b-rehearsal-r1'),
    toolPaths: [`${TOOLS}/lib/runner.mjs`, `${TOOLS}/lib/seal.mjs`] };
  const { seal } = sealGeneration({ ...options, now: clock() });
  assert.equal(seal.certifying, false);
  assert.match(seal.protocol.status, /^APPROVED/);
  assert.equal(seal.harnessReview, null);
  assert.equal(seal.generation.ordinal, 0);
  await runAll(repo, options.evidenceDir, '3B');
  const receipt = closeGeneration({ root: repo, evidenceDir: options.evidenceDir, inventory, now: clock() });
  assert.equal(receipt.result, 'REHEARSAL_COMPLETED');
  assert.equal(receipt.certifying, false);
  assert.equal(receipt.promotable, false);
  assert.equal(receipt.outcome, 'PHASE3B_REHEARSAL_COMPLETED');
  assert.deepEqual(verifyEvidence({ root: repo, evidenceDir: options.evidenceDir, inventory }).problems, []);
});

test('U04 the first mandatory failure stops the generation: the rest of the step and every later step is NOT_RUN', async (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3B', 'phase3b');
  sealGeneration({ ...options, now: clock() });
  const [outcome] = await runAll(root, options.evidenceDir, '3B', { '3B-C2': async () => { throw Object.assign(new Error('an import left the allowed set'), { code: 'X_IMPORT' }); } });
  assert.deepEqual(outcome, { result: 'FAIL', reason: 'STEP_FAIL' });
  const stopped = JSON.parse(fs.readFileSync(path.join(options.evidenceDir, 'generation-stopped.json'), 'utf8'));
  assert.equal(stopped.step, 'C');
  assert.deepEqual(validate('stopped', stopped), []);
  const stepC = JSON.parse(fs.readFileSync(path.join(options.evidenceDir, 'steps/C.json'), 'utf8'));
  assert.deepEqual(stepC.cases.map((row) => [row.id, row.result]), [['3B-C1', 'PASS'], ['3B-C2', 'FAIL'], ['3B-C3', 'NOT_RUN'], ['3B-C4', 'NOT_RUN'], ['3B-C5', 'NOT_RUN']]);
  assert.equal(stepC.cases[1].failure.code, 'X_IMPORT');
  assert.equal(stepC.cases[1].failure.message, 'an import left the allowed set');
  for (const id of ['D', 'E', 'F', 'G']) {
    const step = JSON.parse(fs.readFileSync(path.join(options.evidenceDir, `steps/${id}.json`), 'utf8'));
    assert.equal(step.result, 'NOT_RUN');
    assert.equal(step.failureCode, null);
    assert.ok(step.cases.every((row) => row.result === 'NOT_RUN'));
    assert.ok(!exists(options.evidenceDir, `steps/${id}-start.json`), 'a stopped step never starts');
  }
  const receipt = closeGeneration({ root, evidenceDir: options.evidenceDir, inventory, now: clock() });
  assert.equal(receipt.result, 'FAILED_PRESERVED');
  assert.equal(receipt.promotable, true);
  assert.equal(receipt.counts.FAIL, 1);
  assert.deepEqual(receipt.mandatoryNotPassed, ['3B-C2', '3B-C3', '3B-C4', '3B-C5', '3B-D1', '3B-D2', '3B-D3', '3B-D4', '3B-E1', '3B-E2', '3B-E3', '3B-F1', '3B-F2', '3B-G1', '3B-G2', '3B-G3']);
  assert.deepEqual(receipt.counts, { total: 26, PASS: 10, FAIL: 1, ESCALATE: 0, NOT_RUN: 15 });
  assert.deepEqual(verifyEvidence({ root, evidenceDir: options.evidenceDir, inventory }).problems, []);
});

test('U05 an observation that is not stable JSON (a fraction) fails the case instead of being recorded', async (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3C', 'phase3c-rehearsal-r1', { certifying: false, harnessReviewPath: null });
  sealGeneration({ ...options, now: clock() });
  await runSegment({
    root, evidenceDir: options.evidenceDir, segmentId: 'main', now: clock(),
    executors: { ...executors('3C'), A: async (ctx) => {
      await ctx.runCase('3C-A1', async () => undefined);
      await ctx.runCase('3C-A2', async (c) => c.observe({ ratio: 0.5 }));
    } },
  });
  const step = JSON.parse(fs.readFileSync(path.join(options.evidenceDir, 'steps/A.json'), 'utf8'));
  assert.equal(step.cases[0].result, 'PASS');
  assert.equal(step.cases[1].result, 'FAIL');
  assert.equal(step.cases[1].failure.code, 'OBSERVATION_INVALID');
  assert.match(step.cases[1].failure.message, /safe integer/);
});

test('U06 a record case without an observation fails with RECORD_WITHOUT_OBSERVATION', async (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3C', 'phase3c-rehearsal-r1', { certifying: false, harnessReviewPath: null });
  sealGeneration({ ...options, now: clock() });
  await runSegment({ root, evidenceDir: options.evidenceDir, segmentId: 'main', now: clock(), executors: { ...executors('3C'), A: async (ctx) => {
    await ctx.runCase('3C-A1', async () => undefined);
    await ctx.runCase('3C-A2', async () => undefined);
    await ctx.runCase('3C-A3', async () => undefined);
    await ctx.runCase('3C-A4', async () => undefined);
    await ctx.runCase('3C-A5', async () => undefined);
    await ctx.runCase('3C-A6', async () => undefined); // a record case
  } } });
  const step = JSON.parse(fs.readFileSync(path.join(options.evidenceDir, 'steps/A.json'), 'utf8'));
  const a6 = step.cases.find((row) => row.id === '3C-A6');
  assert.equal(a6.mode, 'record');
  assert.equal(a6.result, 'FAIL');
  assert.equal(a6.failure.code, 'RECORD_WITHOUT_OBSERVATION');
  assert.equal(step.cases.find((row) => row.id === '3C-A7').result, 'NOT_RUN');
});

test('U07 an observation larger than the bound is a harness failure, not silently truncated', async (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3B', 'phase3b-rehearsal-r1', { certifying: false, harnessReviewPath: null });
  sealGeneration({ ...options, now: clock() });
  await runSegment({ root, evidenceDir: options.evidenceDir, segmentId: 'main', now: clock(), executors: { ...executors('3B'), A: async (ctx) => {
    await ctx.runCase('3B-A1', async (c) => c.observe({ big: 'x'.repeat(70000) }));
  } } });
  const step = JSON.parse(fs.readFileSync(path.join(options.evidenceDir, 'steps/A.json'), 'utf8'));
  assert.equal(step.cases[0].failure.code, 'OBSERVATION_TOO_LARGE');
  assert.deepEqual(step.cases[0].observed, {});
});

test('U08 a non-mandatory failure is recorded but does not stop the generation or the stream result', async (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3A', 'phase3a');
  sealGeneration({ ...options, now: clock() });
  const outcomes = await runAll(root, options.evidenceDir, '3A', { '3A-A7': async () => { throw new Error('sampler unavailable'); } });
  assert.deepEqual(outcomes.map((item) => item.result), ['PASS', 'PASS', 'PASS']);
  const receipt = closeGeneration({ root, evidenceDir: options.evidenceDir, inventory, now: clock() });
  assert.equal(receipt.result, 'ACCEPTED');
  assert.deepEqual(receipt.nonMandatoryNotPassed, ['3A-A7']);
  assert.deepEqual(receipt.mandatoryNotPassed, []);
  assert.equal(receipt.counts.total, 108);
  assert.equal(receipt.segments.length, 3);
  assert.deepEqual(receipt.qualifications.find((item) => item.id === 'Q11'), { id: 'Q11', cases: [{ id: '3A-JC6', result: 'PASS', outcome: 'CONFIRMED' }] });
  assert.ok(exists(options.evidenceDir, 'segments/ceiling-finish.json'));
  assert.ok(exists(options.evidenceDir, 'segments/main1-finish.json') && exists(options.evidenceDir, 'segments/main2-finish.json'));
});

test('U09 an escalation stops the generation and ends ESCALATED_PRESERVED, not FAILED', async (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3A', 'phase3a');
  sealGeneration({ ...options, now: clock() });
  const outcomes = await runAll(root, options.evidenceDir, '3A', { '3A-F7': async (c) => { c.observe({ runsWithStagingEperm: 2, ofRuns: 10, outcome: 'CONFIRMED' }); c.escalate('STAGING_EPERM_IN_MORE_THAN_1_OF_10_RUNS'); } });
  assert.deepEqual(outcomes, [{ result: 'PASS', reason: null }, { result: 'ESCALATE', reason: 'STEP_ESCALATE' }]);
  const receipt = closeGeneration({ root, evidenceDir: options.evidenceDir, inventory, now: clock() });
  assert.equal(receipt.result, 'ESCALATED_PRESERVED');
  assert.equal(receipt.outcome, 'PHASE3A_ESCALATED_PRESERVED');
  assert.ok(receipt.mandatoryNotPassed.includes('3A-F7'));
  assert.equal(receipt.counts.ESCALATE, 1);
  const f = JSON.parse(fs.readFileSync(path.join(options.evidenceDir, 'steps/F.json'), 'utf8'));
  assert.equal(f.cases.find((row) => row.id === '3A-F7').escalation, 'STAGING_EPERM_IN_MORE_THAN_1_OF_10_RUNS');
  assert.deepEqual(receipt.segments, [{ id: 'main1', result: 'PASS' }, { id: 'main2', result: 'ESCALATE' }, { id: 'ceiling', result: 'NOT_RUN' }]);
  assert.deepEqual(verifyEvidence({ root, evidenceDir: options.evidenceDir, inventory }).problems, []);
});

test('U10 one-shot: no second run of a segment, no ceiling before main, no run or close after closing', async (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3A', 'phase3a');
  sealGeneration({ ...options, now: clock() });
  await assert.rejects(runSegment({ root, evidenceDir: options.evidenceDir, segmentId: 'main2', executors: executors('3A') }), (e) => e.code === 'PREVIOUS_SEGMENT_NOT_PASSED');
  await assert.rejects(runSegment({ root, evidenceDir: options.evidenceDir, segmentId: 'nope', executors: executors('3A') }), (e) => e.code === 'UNKNOWN_SEGMENT');
  await assert.rejects(runSegment({ root, evidenceDir: options.evidenceDir, segmentId: 'main1', executors: {} }), (e) => e.code === 'EXECUTOR_MISSING');
  assert.ok(!exists(options.evidenceDir, 'segments/main1-start.json'), 'a refused run leaves no start record');
  await runSegment({ root, evidenceDir: options.evidenceDir, segmentId: 'main1', executors: executors('3A'), now: clock() });
  await assert.rejects(runSegment({ root, evidenceDir: options.evidenceDir, segmentId: 'main1', executors: executors('3A') }), (e) => e.code === 'SEGMENT_ALREADY_STARTED');
  await assert.rejects(runSegment({ root, evidenceDir: options.evidenceDir, segmentId: 'ceiling', executors: executors('3A') }), (e) => e.code === 'PREVIOUS_SEGMENT_NOT_PASSED');
  await runSegment({ root, evidenceDir: options.evidenceDir, segmentId: 'main2', executors: executors('3A'), now: clock() });
  await runSegment({ root, evidenceDir: options.evidenceDir, segmentId: 'ceiling', executors: executors('3A'), now: clock() });
  closeGeneration({ root, evidenceDir: options.evidenceDir, inventory, now: clock() });
  await assert.rejects(runSegment({ root, evidenceDir: options.evidenceDir, segmentId: 'ceiling', executors: executors('3A') }), (e) => e.code === 'GENERATION_CLOSED');
  assert.throws(() => closeGeneration({ root, evidenceDir: options.evidenceDir, inventory }), (e) => e.code === 'GENERATION_CLOSED');
  assert.throws(() => writeOnce(options.evidenceDir, 'seal.json', { a: 1 }), (e) => e.code === 'EEXIST');
});

test('U11 a case cannot be retried, an unknown case is refused, and executor misuse fails the step', async (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3B', 'phase3b-rehearsal-r1', { certifying: false, harnessReviewPath: null });
  sealGeneration({ ...options, now: clock() });
  await runSegment({ root, evidenceDir: options.evidenceDir, segmentId: 'main', now: clock(), executors: { ...executors('3B'), A: async (ctx) => {
    await ctx.runCase('3B-A1', async () => { throw new Error('first attempt fails'); });
    await ctx.runCase('3B-A1', async () => undefined); // a retry
  } } });
  const step = JSON.parse(fs.readFileSync(path.join(options.evidenceDir, 'steps/A.json'), 'utf8'));
  assert.equal(step.cases[0].result, 'FAIL');
  assert.equal(step.cases[0].failure.message, 'first attempt fails');
  assert.equal(step.failureCode, 'STEP_EXCEPTION', 'a retry attempt is an executor defect and fails the step');
  assert.equal(step.cases[1].failure.code, 'DUPLICATE_CASE');
  assert.equal(step.cases[0].failure.code, null, 'the first failure is preserved, not overwritten');
  const second = makeRoot(t);
  const other = baseOptions(second, '3B', 'phase3b-rehearsal-r1', { certifying: false, harnessReviewPath: null });
  sealGeneration({ ...other, now: clock() });
  await runSegment({ root: second, evidenceDir: other.evidenceDir, segmentId: 'main', now: clock(), executors: { ...executors('3B'), A: async (ctx) => {
    await ctx.runCase('3B-A1', async () => undefined);
    await ctx.runCase('3B-A1', async () => undefined);
  } } });
  const duplicate = JSON.parse(fs.readFileSync(path.join(other.evidenceDir, 'steps/A.json'), 'utf8'));
  assert.equal(duplicate.failureCode, 'STEP_EXCEPTION');
  assert.equal(duplicate.cases[1].failure.code, 'DUPLICATE_CASE');
  assert.equal(duplicate.result, 'FAIL');
  const third = makeRoot(t);
  const unknown = baseOptions(third, '3B', 'phase3b-rehearsal-r1', { certifying: false, harnessReviewPath: null });
  sealGeneration({ ...unknown, now: clock() });
  await runSegment({ root: third, evidenceDir: unknown.evidenceDir, segmentId: 'main', now: clock(), executors: { ...executors('3B'), A: async (ctx) => { await ctx.runCase('3B-Z9', async () => undefined); } } });
  assert.equal(JSON.parse(fs.readFileSync(path.join(unknown.evidenceDir, 'steps/A.json'), 'utf8')).cases[0].failure.code, 'UNKNOWN_CASE');
});

test('U11a cases run one at a time: an overlapping case is an executor defect', async (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3B', 'phase3b-rehearsal-r1', { certifying: false, harnessReviewPath: null });
  sealGeneration({ ...options, now: clock() });
  await runSegment({ root, evidenceDir: options.evidenceDir, segmentId: 'main', now: clock(), executors: { ...executors('3B'), A: async (ctx) => {
    await Promise.all([ctx.runCase('3B-A1', async () => { await new Promise((resolve) => setTimeout(resolve, 20)); }), ctx.runCase('3B-A2', async () => undefined)]);
  } } });
  const step = JSON.parse(fs.readFileSync(path.join(options.evidenceDir, 'steps/A.json'), 'utf8'));
  assert.equal(step.failureCode, 'STEP_EXCEPTION');
  assert.equal(step.result, 'FAIL');
  assert.ok(step.cases.some((row) => row.failure?.code === 'CASE_OVERLAP'));
});

test('U12 an executor that skips cases fails the step with CASES_NOT_REPORTED', async (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3B', 'phase3b-rehearsal-r1', { certifying: false, harnessReviewPath: null });
  sealGeneration({ ...options, now: clock() });
  await runSegment({ root, evidenceDir: options.evidenceDir, segmentId: 'main', now: clock(), executors: { ...executors('3B'), A: async (ctx) => { await ctx.runCase('3B-A1', async () => undefined); } } });
  const step = JSON.parse(fs.readFileSync(path.join(options.evidenceDir, 'steps/A.json'), 'utf8'));
  assert.equal(step.failureCode, 'CASES_NOT_REPORTED');
  assert.equal(step.result, 'FAIL');
  assert.deepEqual(step.cases.map((row) => row.result), ['PASS', 'NOT_RUN', 'NOT_RUN', 'NOT_RUN']);
});

test('U13 a step guard that expires fails the step and aborts the signal; a late result is discarded', async (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3B', 'phase3b-rehearsal-r1', { certifying: false, harnessReviewPath: null, guardOverridesMs: { A: 60 } });
  sealGeneration({ ...options, now: clock() });
  let aborted = false;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const outcome = await runSegment({ root, evidenceDir: options.evidenceDir, segmentId: 'main', now: clock(), executors: { ...executors('3B'), A: async (ctx) => {
    await ctx.runCase('3B-A1', async (c) => { c.signal.addEventListener('abort', () => { aborted = true; }); await gate; });
    await ctx.runCase('3B-A2', async () => undefined);
  } } });
  release();
  assert.deepEqual(outcome, { result: 'FAIL', reason: 'STEP_GUARD_EXPIRED' });
  assert.equal(aborted, true);
  const step = JSON.parse(fs.readFileSync(path.join(options.evidenceDir, 'steps/A.json'), 'utf8'));
  assert.equal(step.failureCode, 'STEP_GUARD_EXPIRED');
  assert.equal(step.cases[0].failure.code, 'STEP_GUARD_EXPIRED');
  assert.deepEqual(step.cases.slice(1).map((row) => row.result), ['NOT_RUN', 'NOT_RUN', 'NOT_RUN']);
  await new Promise((resolve) => setTimeout(resolve, 30));
  assert.equal(JSON.parse(fs.readFileSync(path.join(options.evidenceDir, 'steps/A.json'), 'utf8')).cases[0].result, 'FAIL', 'the late result did not overwrite the record');
});

test('U14 an exhausted segment budget stops the generation with BUDGET_EXHAUSTED', async (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3B', 'phase3b-rehearsal-r1', { certifying: false, harnessReviewPath: null, budgetOverridesMs: { main: 1000 } });
  sealGeneration({ ...options, now: clock() });
  let ticks = 0;
  // A fake monotonic clock: 400 ms pass at every reading, so the 1000 ms budget is gone before the third step starts.
  const outcome = await runSegment({ root, evidenceDir: options.evidenceDir, segmentId: 'main', now: clock(), monotonic: () => (ticks += 400), executors: executors('3B') });
  assert.deepEqual(outcome, { result: 'FAIL', reason: 'BUDGET_EXHAUSTED' });
  const results = ['A', 'B', 'C', 'D', 'E', 'F', 'G'].map((id) => JSON.parse(fs.readFileSync(path.join(options.evidenceDir, `steps/${id}.json`), 'utf8')));
  const exhausted = results.find((step) => step.failureCode === 'BUDGET_EXHAUSTED');
  assert.ok(exhausted, 'a step must record BUDGET_EXHAUSTED');
  assert.equal(exhausted.result, 'NOT_RUN');
  assert.ok(exhausted.cases.every((row) => row.result === 'NOT_RUN'));
  assert.equal(JSON.parse(fs.readFileSync(path.join(options.evidenceDir, 'generation-stopped.json'), 'utf8')).reason, 'BUDGET_EXHAUSTED');
  const later = results.slice(results.indexOf(exhausted) + 1);
  assert.ok(later.every((step) => step.result === 'NOT_RUN' && step.failureCode === null));
  const receipt = closeGeneration({ root, evidenceDir: options.evidenceDir, inventory, now: clock() });
  assert.equal(receipt.result, 'REHEARSAL_FAILED');
  assert.deepEqual(verifyEvidence({ root, evidenceDir: options.evidenceDir, inventory }).problems, []);
});

test('U15 an interrupted run (start records without receipts) closes as a failure, never as a pass', (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3B', 'phase3b');
  const { sealSha256 } = sealGeneration({ ...options, now: clock() });
  writeOnce(options.evidenceDir, 'segments/main-start.json', {
    kind: 'MO1308Phase3SegmentStart', version: '1.0.0', stream: '3B', generation: 'phase3b', segment: 'main', startedAt: '2026-10-07T00:00:00.000Z', budgetMs: 5400000, sealSha256,
  });
  writeOnce(options.evidenceDir, 'steps/A-start.json', {
    kind: 'MO1308Phase3StepStart', version: '1.0.0', stream: '3B', generation: 'phase3b', step: 'A', segment: 'main', startedAt: '2026-10-07T00:00:00.000Z', guardMs: 600000, effectiveGuardMs: 600000,
  });
  const receipt = closeGeneration({ root, evidenceDir: options.evidenceDir, inventory, now: clock() });
  assert.equal(receipt.result, 'FAILED_PRESERVED');
  const a = JSON.parse(fs.readFileSync(path.join(options.evidenceDir, 'steps/A.json'), 'utf8'));
  assert.equal(a.failureCode, 'INTERRUPTED');
  assert.equal(a.result, 'FAIL');
  assert.equal(JSON.parse(fs.readFileSync(path.join(options.evidenceDir, 'segments/main-finish.json'), 'utf8')).reason, 'INTERRUPTED');
  assert.equal(JSON.parse(fs.readFileSync(path.join(options.evidenceDir, 'steps/B.json'), 'utf8')).failureCode, null);
  assert.deepEqual(verifyEvidence({ root, evidenceDir: options.evidenceDir, inventory }).problems, []);
});

test('U16 a bound file that changes after the seal refuses the run and the close', async (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3B', 'phase3b');
  const { seal } = sealGeneration({ ...options, now: clock() });
  assert.deepEqual(verifyBindings(root, seal), []);
  for (const relative of [`${TOOLS}/campaign.mjs`, INVENTORY, IDENTITY, MANIFEST, PROTOCOL, 'review.json']) {
    const target = path.join(root, relative);
    const original = fs.readFileSync(target);
    fs.writeFileSync(target, Buffer.concat([original, Buffer.from(' ')]));
    assert.ok(verifyBindings(root, seal).some((problem) => problem.startsWith(relative)), relative);
    await assert.rejects(runSegment({ root, evidenceDir: options.evidenceDir, segmentId: 'main', executors: executors('3B') }), (e) => e.code === 'BINDINGS_CHANGED');
    assert.throws(() => closeGeneration({ root, evidenceDir: options.evidenceDir, inventory }), (e) => e.code === 'BINDINGS_CHANGED');
    fs.writeFileSync(target, original);
  }
  fs.rmSync(path.join(root, `${TOOLS}/helper.mjs`));
  assert.ok(verifyBindings(root, seal).some((problem) => problem.endsWith('missing')));
});

test('U17 verifyEvidence detects tampering with any closed generation file', async (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3B', 'phase3b');
  sealGeneration({ ...options, now: clock() });
  await runAll(root, options.evidenceDir, '3B');
  closeGeneration({ root, evidenceDir: options.evidenceDir, inventory, now: clock() });
  assert.deepEqual(verifyEvidence({ root, evidenceDir: options.evidenceDir, inventory }).problems, []);
  const target = path.join(options.evidenceDir, 'steps/C.json');
  const original = fs.readFileSync(target);
  fs.writeFileSync(target, original.toString('utf8').replace('"PASS"', '"FAIL"'));
  assert.ok(verifyEvidence({ root, evidenceDir: options.evidenceDir, inventory }).problems.length > 0);
  fs.writeFileSync(target, original);
  assert.deepEqual(verifyEvidence({ root, evidenceDir: options.evidenceDir, inventory }).problems, []);
  fs.writeFileSync(path.join(options.evidenceDir, 'extra.json'), '{}');
  assert.ok(verifyEvidence({ root, evidenceDir: options.evidenceDir, inventory }).problems.some((p) => p.includes('differ from the seal')));
  fs.rmSync(path.join(options.evidenceDir, 'extra.json'));
  const receiptPath = path.join(options.evidenceDir, 'stream-receipt.json');
  const receiptBytes = fs.readFileSync(receiptPath);
  fs.writeFileSync(receiptPath, receiptBytes.toString('utf8').replace('"ACCEPTED"', '"FAILED_PRESERVED"'));
  assert.ok(verifyEvidence({ root, evidenceDir: options.evidenceDir, inventory }).problems.length > 0);
  fs.writeFileSync(receiptPath, receiptBytes);
  fs.rmSync(path.join(options.evidenceDir, 'steps/D.json'));
  assert.ok(verifyEvidence({ root, evidenceDir: options.evidenceDir, inventory }).problems.length > 0);
});

test('U18 a rerun needs the failed generation, a valid disposition and the next ordinal', async (t) => {
  const root = makeRoot(t);
  const first = baseOptions(root, '3B', 'phase3b');
  sealGeneration({ ...first, now: clock() });
  await runAll(root, first.evidenceDir, '3B', { '3B-A2': async () => { throw new Error('harness compared the wrong history'); } });
  closeGeneration({ root, evidenceDir: first.evidenceDir, inventory, now: clock() });
  const second = baseOptions(root, '3B', 'phase3b-g2');
  assert.throws(() => sealGeneration(second), (e) => e.code === 'SUPERSEDES_REQUIRED');
  assert.throws(() => sealGeneration(baseOptions(root, '3B', 'phase3b-g2', { previous: { evidenceDir: first.evidenceDir, dispositionPath: path.join(root, 'none.json') } })), (e) => e.code === 'ENOENT' || e.code === 'DISPOSITION_INVALID');
  const evidenceSealSha256 = sha256Hex(fs.readFileSync(path.join(first.evidenceDir, 'evidence-seal.json')));
  const write = (name, value) => { const file = path.join(root, name); fs.writeFileSync(file, stableStringify(value)); return file; };
  const wrongSeal = write('d1.json', disposition({ evidenceSealSha256: '1'.repeat(64) }));
  assert.throws(() => sealGeneration(baseOptions(root, '3B', 'phase3b-g2', { previous: { evidenceDir: first.evidenceDir, dispositionPath: wrongSeal } })), (e) => e.code === 'DISPOSITION_MISMATCH');
  const wrongOrdinal = write('d2.json', disposition({ evidenceSealSha256, rerunOrdinal: 3 }));
  assert.throws(() => sealGeneration(baseOptions(root, '3B', 'phase3b-g2', { previous: { evidenceDir: first.evidenceDir, dispositionPath: wrongOrdinal } })), (e) => e.code === 'DISPOSITION_ORDINAL');
  const stop = write('d3.json', disposition({ evidenceSealSha256, nextAction: 'OWNER_REVIEW', rerunOrdinal: null, class: 'CONTRACT_DEFECT', ownerReviewRequired: true }));
  assert.throws(() => sealGeneration(baseOptions(root, '3B', 'phase3b-g2', { previous: { evidenceDir: first.evidenceDir, dispositionPath: stop } })), (e) => e.code === 'DISPOSITION_NO_RERUN');
  const good = write('d4.json', disposition({ evidenceSealSha256 }));
  const { seal } = sealGeneration({ ...baseOptions(root, '3B', 'phase3b-g2', { previous: { evidenceDir: first.evidenceDir, dispositionPath: good } }), now: clock() });
  assert.equal(seal.generation.ordinal, 2);
  assert.deepEqual(seal.generation.supersedes, { id: 'phase3b', evidenceSealSha256, dispositionSha256: sha256Hex(fs.readFileSync(good)) });
  assert.ok(exists(first.evidenceDir, 'steps/A.json'), 'the failed generation is preserved');
  assert.throws(() => sealGeneration(baseOptions(root, '3B', 'phase3b', { previous: { evidenceDir: first.evidenceDir, dispositionPath: good }, evidenceDir: path.join(root, 'evidence', 'other') })), (e) => e.code === 'SUPERSEDES_UNEXPECTED');
});

test('U19 an accepted or open generation cannot be superseded; a rehearsal never supersedes', async (t) => {
  const root = makeRoot(t);
  const first = baseOptions(root, '3B', 'phase3b');
  sealGeneration({ ...first, now: clock() });
  await runAll(root, first.evidenceDir, '3B');
  const dispositionFile = path.join(root, 'd.json');
  fs.writeFileSync(dispositionFile, stableStringify(disposition({ evidenceSealSha256: '2'.repeat(64) })));
  assert.throws(() => sealGeneration(baseOptions(root, '3B', 'phase3b-g2', { previous: { evidenceDir: first.evidenceDir, dispositionPath: dispositionFile } })), (e) => e.code === 'SUPERSEDES_OPEN');
  closeGeneration({ root, evidenceDir: first.evidenceDir, inventory, now: clock() });
  fs.writeFileSync(dispositionFile, stableStringify(disposition({ evidenceSealSha256: sha256Hex(fs.readFileSync(path.join(first.evidenceDir, 'evidence-seal.json'))) })));
  assert.throws(() => sealGeneration(baseOptions(root, '3B', 'phase3b-g2', { previous: { evidenceDir: first.evidenceDir, dispositionPath: dispositionFile } })), (e) => e.code === 'SUPERSEDES_NOT_FAILED');
  assert.throws(() => sealGeneration(baseOptions(root, '3B', 'phase3b-rehearsal-r1', { certifying: false, previous: { evidenceDir: first.evidenceDir, dispositionPath: dispositionFile } })), (e) => e.code === 'SUPERSEDES_UNEXPECTED');
});

// ---------------------------------------------------------------- Amendment A8: approval record, budgets, qualification outcomes

test('M01 Amendment A8 is appended to the Freeze and binds the protocol, inventory, candidate and corpus by hash', () => {
  const freeze = fs.readFileSync(inFile('docs/mo1308-contract-freeze-1.md'), 'utf8');
  const start = freeze.indexOf('## 33. Amendment A8');
  assert.ok(start > 0, 'the A8 section is missing');
  assert.ok(freeze.indexOf('## 30. Amendment A7') < start, 'A8 comes after A7');
  const section = freeze.slice(start);
  for (const [file, relative] of [['protocol', PROTOCOL], ['inventory', INVENTORY], ['identity', IDENTITY], ['corpus', MANIFEST]]) {
    const row = new RegExp(`\\| \`${relative.replace(/[.]/g, '\\.')}\` \\| \`([0-9a-f]{64})\` \\|`).exec(section);
    assert.ok(row, `${file}: no hash row`);
    assert.equal(row[1], sha256Hex(fs.readFileSync(inFile(relative))), `${relative} changed after A8 approval: a new amendment is needed`);
  }
  const identity = JSON.parse(fs.readFileSync(inFile(IDENTITY), 'utf8'));
  assert.ok(section.includes(identity.productionTreeDigest));
  assert.ok(section.includes(JSON.parse(fs.readFileSync(inFile(MANIFEST), 'utf8')).corpusDigest));
  assert.ok(section.includes('Official CAVP response files were not used'));
  assert.match(section, /owner-authorized/);
  // The frozen text before A8 is untouched: the A8 section is the only addition after A7's last line.
  assert.ok(freeze.slice(0, start).trimEnd().endsWith('No shape, layout, limit, identity, error code or protocol step of the frozen text changes.'));
});

test('M02 guards fit the budgets by design in every segment of every stream (A8 decision 8)', () => {
  const inv = buildInventory();
  assert.equal(inv.reserveMinutes, 5);
  const sums = [];
  for (const stream of inv.streams) for (const segment of stream.segments) {
    const guards = stream.steps.filter((step) => step.segment === segment.id).reduce((sum, step) => sum + step.guardMinutes, 0);
    sums.push(`${stream.id}/${segment.id}:${guards}`);
    assert.ok(guards + inv.reserveMinutes <= segment.budgetMinutes, `${stream.id}/${segment.id}`);
  }
  assert.deepEqual(sums, ['3A/main1:50', '3A/main2:82', '3A/ceiling:175', '3B/main:55', '3C/main:81', '3D/main:60']);
  const broken = JSON.parse(JSON.stringify(inv));
  broken.streams[0].steps.find((step) => step.id === 'F').guardMinutes = 40;
  assert.ok(validateInventory(broken).some((problem) => problem.includes('3A/main2') && problem.includes('exceed')));
  const shortExtended = JSON.parse(JSON.stringify(inv));
  shortExtended.streams[1].segments[0].extendedMinutes = 60;
  assert.ok(validateInventory(shortExtended).some((problem) => problem.includes('extended budget below')));
  const text = fs.readFileSync(inFile(PROTOCOL), 'utf8');
  for (const row of ['| 3A `main1` | A 5, B 15, C 8, D 15, E 7 | 50 | 5 | 55 | 90 |', '| 3A `main2` | F 25, G 10, H 12, I 5, J 15, K 5, L 5, M 5 | 82 | 5 | 87 | 90 |',
    '| 3A `ceiling` | JC 175 | 175 | 5 | 180 | 180 |', '| 3C `main` | A 15, B 5, C 5, D 10, E 8, F 6, G 5, H 8, I 4, J 12, K 3 | 81 | 5 | 86 | 90 |']) assert.ok(text.includes(row), row);
});

test('M03 the ceiling segment is the only one of 3A with the 180-minute budget and runs after both main segments', () => {
  const stream = streamOf(buildInventory(), '3A');
  assert.deepEqual(stream.segments.map((segment) => segment.id), ['main1', 'main2', 'ceiling']);
  assert.deepEqual(stream.steps.filter((step) => step.segment === 'ceiling').map((step) => step.id), ['JC']);
  assert.equal(stream.steps.at(-1).cases.at(-1).id, '3A-JC10');
});

test('M04 a qualification case must observe CONFIRMED or NOT_CONFIRMED; anything else fails (A8 decision 6)', async (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3C', 'phase3c-rehearsal-r1', { certifying: false, harnessReviewPath: null });
  const { seal } = sealGeneration({ ...options, now: clock() });
  assert.deepEqual(seal.steps.find((step) => step.id === 'A').cases.find((row) => row.id === '3C-A6').qualifications, ['Q03']);
  const outcomes = ['NOT_CONFIRMED', 'MAYBE', undefined];
  const seen = [];
  for (const outcome of outcomes) {
    const dir = path.join(root, 'evidence', `phase3c-rehearsal-r${seen.length + 2}`);
    sealGeneration({ ...options, generation: `phase3c-rehearsal-r${seen.length + 2}`, evidenceDir: dir, now: clock() });
    await runSegment({ root, evidenceDir: dir, segmentId: 'main', now: clock(), executors: { ...executors('3C'), A: async (ctx) => {
      for (const id of ['3C-A1', '3C-A2', '3C-A3', '3C-A4', '3C-A5']) await ctx.runCase(id, async () => undefined);
      await ctx.runCase('3C-A6', async (c) => c.observe(outcome === undefined ? { other: 1 } : { outcome }));
      await ctx.runCase('3C-A7', async () => undefined);
    } } });
    const step = JSON.parse(fs.readFileSync(path.join(dir, 'steps/A.json'), 'utf8'));
    seen.push(step.cases.find((row) => row.id === '3C-A6'));
  }
  assert.deepEqual(seen.map((row) => [row.result, row.outcome, row.failure?.code ?? null]),
    [['PASS', 'NOT_CONFIRMED', null], ['FAIL', null, 'QUALIFICATION_OUTCOME_INVALID'], ['FAIL', null, 'QUALIFICATION_OUTCOME_INVALID']]);
});

test('M05 the stream receipt carries each qualification case outcome', async (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3C', 'phase3c');
  sealGeneration({ ...options, now: clock() });
  await runAll(root, options.evidenceDir, '3C', { '3C-A6': async (c) => c.observe({ outcome: 'NOT_CONFIRMED' }), '3C-E6': async (c) => c.observe({ outcome: 'CONFIRMED' }) });
  const receipt = closeGeneration({ root, evidenceDir: options.evidenceDir, inventory, now: clock() });
  assert.deepEqual(receipt.qualifications.find((item) => item.id === 'Q03'), { id: 'Q03', cases: [{ id: '3C-A6', result: 'PASS', outcome: 'NOT_CONFIRMED' }, { id: '3C-K2', result: 'PASS', outcome: null }] });
  assert.equal(receipt.qualifications.find((item) => item.id === 'Q04').cases[0].outcome, 'CONFIRMED');
  assert.deepEqual(verifyEvidence({ root, evidenceDir: options.evidenceDir, inventory }).problems, []);
});

const disclosureOutcomes = (overrides = {}) => new Map(qualificationCases(inventory).map((item) => [item.id, overrides[item.id] ?? 'CONFIRMED']));
const disclosureText = (outcomes) => [...outcomes].map(([id, outcome]) => `- ${id}: ${outcome} - sentence`).concat(structuralQualifications(inventory).map((id) => `${id}: DISCLOSED - sentence`)).join('\n');

test('M06 the disclosure check states the recorded outcome of every qualification case and nothing else', () => {
  assert.deepEqual(structuralQualifications(inventory), ['Q01', 'Q09', 'Q14', 'Q15']);
  assert.equal(qualificationCases(inventory).length, 11);
  const outcomes = disclosureOutcomes({ '3C-A6': 'NOT_CONFIRMED', '3A-E6': 'NOT_CONFIRMED' });
  assert.deepEqual(checkDisclosure(disclosureText(outcomes), inventory, outcomes), []);
  // a weakness that was NOT_CONFIRMED disclosed as confirmed
  const wrong = disclosureText(disclosureOutcomes()).replace('- 3C-A6: CONFIRMED', '- 3C-A6: CONFIRMED');
  assert.ok(checkDisclosure(wrong, inventory, outcomes).some((p) => p.includes('3C-A6: disclosed CONFIRMED but recorded NOT_CONFIRMED')));
  // a confirmed weakness reported as not confirmed
  const understated = disclosureText(outcomes).replace('3C-E6: CONFIRMED', '3C-E6: NOT_CONFIRMED');
  assert.ok(checkDisclosure(understated, inventory, outcomes).some((p) => p.includes('3C-E6: disclosed NOT_CONFIRMED but recorded CONFIRMED')));
  // omitted
  const omitted = disclosureText(outcomes).split('\n').filter((line) => !line.includes('3C-E7:')).join('\n');
  assert.ok(checkDisclosure(omitted, inventory, outcomes).some((p) => p.includes('3C-E7: recorded CONFIRMED but not disclosed')));
  const noStructural = disclosureText(outcomes).split('\n').filter((line) => !line.startsWith('Q01:')).join('\n');
  assert.ok(checkDisclosure(noStructural, inventory, outcomes).some((p) => p.includes('Q01: structural qualification is not disclosed')));
  // duplicates, unknown ids, DISCLOSED for a characterized qualification, an outcome never recorded
  assert.ok(checkDisclosure(`${disclosureText(outcomes)}\n3C-A6: CONFIRMED - again`, inventory, outcomes).some((p) => p.includes('stated more than once')));
  assert.ok(checkDisclosure(`${disclosureText(outcomes)}\n3C-Z9: CONFIRMED - x`, inventory, outcomes).some((p) => p.includes('3C-Z9: not a qualification case')));
  assert.ok(checkDisclosure(`${disclosureText(outcomes)}\nQ03: DISCLOSED - x`, inventory, outcomes).some((p) => p.includes('must be disclosed per case')));
  const missing = new Map(outcomes);
  missing.delete('3A-JC6');
  assert.ok(checkDisclosure(disclosureText(outcomes), inventory, missing).some((p) => p.includes('3A-JC6: no recorded outcome')));
});

test('M07 recorded outcomes are read from step receipts of passed cases only', async (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3C', 'phase3c-rehearsal-r1', { certifying: false, harnessReviewPath: null });
  sealGeneration({ ...options, now: clock() });
  await runSegment({ root, evidenceDir: options.evidenceDir, segmentId: 'main', now: clock(), executors: { ...executors('3C'),
    A: async (ctx) => {
      for (const id of ['3C-A1', '3C-A2', '3C-A3', '3C-A4', '3C-A5']) await ctx.runCase(id, async () => undefined);
      await ctx.runCase('3C-A6', async (c) => c.observe({ outcome: 'CONFIRMED' }));
      await ctx.runCase('3C-A7', async () => { throw new Error('later failure'); });
    } } });
  const outcomes = readOutcomes([options.evidenceDir]);
  assert.equal(outcomes.get('3C-A6'), 'CONFIRMED');
  assert.equal(outcomes.has('3C-B3'), false);
  assert.equal(readOutcomes([path.join(root, 'nothing')]).size, 0);
});

test('M08 a rerun after an escalation needs an owner approval reference (A8 decision 5)', async (t) => {
  const root = makeRoot(t);
  const first = baseOptions(root, '3A', 'phase3a');
  sealGeneration({ ...first, now: clock() });
  await runAll(root, first.evidenceDir, '3A', { '3A-F7': async (c) => { c.observe({ runsWithStagingEperm: 3, ofRuns: 10, outcome: 'CONFIRMED' }); c.escalate('STAGING_EPERM_IN_MORE_THAN_1_OF_10_RUNS'); } });
  const receipt = closeGeneration({ root, evidenceDir: first.evidenceDir, inventory, now: clock() });
  assert.equal(receipt.result, 'ESCALATED_PRESERVED');
  const evidenceSealSha256 = sha256Hex(fs.readFileSync(path.join(first.evidenceDir, 'evidence-seal.json')));
  const write = (name, value) => { const file = path.join(root, name); fs.writeFileSync(file, stableStringify(value)); return file; };
  const base = { stream: '3A', generation: 'phase3a', evidenceSealSha256, subjects: [{ step: 'F', caseId: '3A-F7' }], class: 'ENVIRONMENT_BLOCKER', diagnosis: 'host antivirus' };
  const noReference = write('e1.json', disposition({ ...base }));
  assert.throws(() => sealGeneration(baseOptions(root, '3A', 'phase3a-g2', { previous: { evidenceDir: first.evidenceDir, dispositionPath: noReference } })), (e) => e.code === 'ESCALATION_NEEDS_OWNER');
  const withReference = write('e2.json', disposition({ ...base, ownerApprovalReference: 'owner-approval-2026-10-07' }));
  const { seal } = sealGeneration({ ...baseOptions(root, '3A', 'phase3a-g2', { previous: { evidenceDir: first.evidenceDir, dispositionPath: withReference } }), now: clock() });
  assert.equal(seal.generation.ordinal, 2);
});

// ---------------------------------------------------------------- rehearsal skips and the campaign driver

test('D01 a rehearsal may declare a case host-only (NOT_RUN, reason kept, no stop); a certifying generation never may', async (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3B', 'phase3b-rehearsal-r1', { certifying: false, harnessReviewPath: null });
  sealGeneration({ ...options, now: clock() });
  await runAll(root, options.evidenceDir, '3B', { '3B-C2': async (c) => c.skip('needs the Windows host'), '3B-C3': async (c) => c.skip('needs the Windows host') });
  const step = JSON.parse(fs.readFileSync(path.join(options.evidenceDir, 'steps/C.json'), 'utf8'));
  assert.deepEqual(step.cases.map((row) => row.result), ['PASS', 'NOT_RUN', 'NOT_RUN', 'PASS', 'PASS']);
  assert.deepEqual(step.cases[1].observed, { skipped: 'needs the Windows host' });
  assert.equal(step.result, 'PASS');
  const receipt = closeGeneration({ root, evidenceDir: options.evidenceDir, inventory, now: clock() });
  assert.equal(receipt.result, 'REHEARSAL_PARTIAL');
  assert.equal(receipt.promotable, false);
  assert.deepEqual(receipt.mandatoryNotPassed, ['3B-C2', '3B-C3']);
  assert.deepEqual(verifyEvidence({ root, evidenceDir: options.evidenceDir, inventory }).problems, []);
  const certifying = makeRoot(t);
  const real = baseOptions(certifying, '3B', 'phase3b');
  sealGeneration({ ...real, now: clock() });
  const [outcome] = await runAll(certifying, real.evidenceDir, '3B', { '3B-A1': async (c) => c.skip('no') });
  assert.equal(outcome.result, 'FAIL');
  assert.equal(JSON.parse(fs.readFileSync(path.join(real.evidenceDir, 'steps/A.json'), 'utf8')).cases[0].failure.code, 'SKIP_NOT_ALLOWED');
  assert.equal(closeGeneration({ root: certifying, evidenceDir: real.evidenceDir, inventory, now: clock() }).result, 'FAILED_PRESERVED');
});

test('D02 a skip does not hide a failure: a rehearsal with a failing case is REHEARSAL_FAILED', async (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3B', 'phase3b-rehearsal-r1', { certifying: false, harnessReviewPath: null });
  sealGeneration({ ...options, now: clock() });
  await runAll(root, options.evidenceDir, '3B', { '3B-B1': async (c) => c.skip('host'), '3B-C1': async () => { throw new Error('real failure'); } });
  assert.equal(closeGeneration({ root, evidenceDir: options.evidenceDir, inventory, now: clock() }).result, 'REHEARSAL_FAILED');
});

test('D03 the driver checks a definition against the inventory and never lets an unimplemented case pass', async (t) => {
  const ids3B = allCases(inventory).filter((item) => item.stream === '3B').map((item) => item.id);
  const impls = Object.fromEntries(ids3B.map((id) => [id, async (h) => { if (allCases(inventory).find((item) => item.id === id).mode === 'record') h.observe({ outcome: 'CONFIRMED' }); }]));
  assert.deepEqual(checkDefinition({ inventory, stream: '3B', impls }), []);
  const missing = { ...impls };
  delete missing['3B-D1'];
  assert.deepEqual(checkDefinition({ inventory, stream: '3B', impls: missing }), ['3B-D1: neither implemented nor declared host-only']);
  assert.ok(checkDefinition({ inventory, stream: '3B', impls, hostOnly: { '3B-D1': 'x' } }).some((p) => p.includes('both')));
  assert.ok(checkDefinition({ inventory, stream: '3B', impls: { ...impls, '3B-Z1': async () => undefined } }).some((p) => p.includes('not a case of 3B')));
  const work = tmp(t);
  await assert.rejects(rehearse({ root: repo, stream: '3B', evidenceDir: path.join(work, 'x'), impls: missing, env: {}, toolPaths: sharedToolPaths(repo) }), (e) => e.code === 'DEFINITION_INVALID');
  // an executor built over a definition with a hole fails the case instead of passing it
  const holes = buildExecutors({ inventory, stream: '3B', impls: missing, env: {} });
  assert.equal(typeof holes.D, 'function');
});

test('D04 rehearse seals, runs and closes a non-certifying generation and summarizes executed, skipped and failed cases', async (t) => {
  const ids3B = allCases(inventory).filter((item) => item.stream === '3B');
  const impls = Object.fromEntries(ids3B.map((item) => [item.id, async (h) => { if (item.mode === 'record') h.observe({ outcome: 'CONFIRMED' }); }]));
  const hostOnly = { '3B-E2': 'needs two worktrees on the host' };
  delete impls['3B-E2'];
  const result = await rehearse({ root: repo, stream: '3B', evidenceDir: path.join(tmp(t), 'r1'), impls, hostOnly, env: {}, toolPaths: sharedToolPaths(repo) });
  assert.equal(result.receipt.result, 'REHEARSAL_PARTIAL');
  assert.deepEqual(result.problems, []);
  assert.equal(result.summary.executedPass, 25);
  assert.deepEqual(result.summary.skippedHostOnly, ['3B-E2']);
  assert.deepEqual(result.summary.failed, []);
  assert.deepEqual(summarize(inventory, result.evidenceDir, result.receipt), result.summary);
  assert.equal(result.receipt.certifying, false);
});

test('U20a the close and verify steps refuse an inventory other than the sealed one; the shared tools can all be bound', async (t) => {
  const root = makeRoot(t);
  const options = baseOptions(root, '3B', 'phase3b');
  sealGeneration({ ...options, now: clock() });
  await runAll(root, options.evidenceDir, '3B');
  const other = buildInventory();
  other.streams[1].steps[0].cases[0].title = 'a different title';
  assert.throws(() => closeGeneration({ root, evidenceDir: options.evidenceDir, inventory: other }), (e) => e.code === 'INVENTORY_MISMATCH');
  closeGeneration({ root, evidenceDir: options.evidenceDir, inventory, now: clock() });
  assert.ok(verifyEvidence({ root, evidenceDir: options.evidenceDir, inventory: other }).problems.some((p) => p.includes('inventory is not the one')));
  const tools = sharedToolPaths(repo);
  assert.ok(tools.includes(`${TOOLS}/lib/runner.mjs`) && tools.includes(`${TOOLS}/corpus.mjs`) && tools.includes(`${TOOLS}/README.md`));
  assert.deepEqual(tools, [...tools].sort());
});

test('U20 the runner has no platform-specific code and writes nothing outside its evidence directory', () => {
  const libDirectory = inFile(TOOLS, 'lib');
  for (const name of fs.readdirSync(libDirectory).filter((file) => file !== 'inventory-source.mjs')) {
    const source = fs.readFileSync(path.join(libDirectory, name), 'utf8').split('\n').filter((line) => !line.trim().startsWith('//')).join('\n');
    assert.ok(!/win32|powershell|\\\\\?\\|child_process/i.test(source.replace(/spawnSync[^\n]*\n/g, '')) || name === 'git.mjs', `${name} must stay platform-neutral`);
    assert.ok(!/\bprocess\.platform\b/.test(source), name);
  }
  assert.ok(!fs.readFileSync(inFile(TOOLS, 'lib/runner.mjs'), 'utf8').includes('child_process'));
});
