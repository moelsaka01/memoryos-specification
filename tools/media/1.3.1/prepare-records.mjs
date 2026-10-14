// MemoryOS 1.3.0 release media: materialise the released record corpus as plain files.
// Every byte comes from the repository's released fixtures through the real SDK (the MO-1308 test corpus builder); nothing is invented.
//   node tools/media/prepare-records.mjs OUTPUT_DIRECTORY
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { corpusRecords, CORPUS_WORKSPACE } from '../../repositories/cca-conformance/tools/mo1308-phase3/corpus.mjs';

const output = process.argv[2];
if (!output) { console.error('usage: prepare-records.mjs OUTPUT_DIRECTORY'); process.exit(2); }
const wanted = ['mip-reference', 'checkpoint-c00', 'checkpoint-c01', 'checkpoint-c02', 'policy-0', 'policy-1', 'regression-reference', 'cicd-6',
  'readiness-ready', 'decision-ready-approve', 'readiness-not-ready', 'decision-not-ready-approve'];
const records = new Map(corpusRecords().map((record) => [record.id, record]));
const manifest = [];
for (const id of wanted) {
  const record = records.get(id);
  if (!record) throw new Error(`missing corpus record ${id}`);
  const directory = path.join(output, id);
  fs.mkdirSync(directory, { recursive: true });
  for (const member of record.members) fs.writeFileSync(path.join(directory, member.name), member.bytes);
  manifest.push({ id, recordKind: record.recordKind, files: record.members.map((m) => m.name) });
}
// Policy fixtures (released MO-1306 vectors) laid out under short names for the on-screen commands.
const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../repositories/cca-conformance/fixtures/mo1306');
for (const key of ['pass', 'fail', 'cne']) {
  const target = path.join(path.dirname(output), 'policy', key);
  fs.mkdirSync(target, { recursive: true });
  for (const name of ['policy.json', 'candidate.mip']) fs.copyFileSync(path.join(fixtures, 'evaluate-policy-' + key, name), path.join(target, name));
}
fs.writeFileSync(path.join(output, 'MANIFEST.json'), JSON.stringify({ workspace: CORPUS_WORKSPACE, records: manifest }, null, 2));
console.log(`wrote ${wanted.length} records for ${CORPUS_WORKSPACE} to ${path.resolve(output)}`);
