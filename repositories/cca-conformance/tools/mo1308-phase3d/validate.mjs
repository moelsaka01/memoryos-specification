// MO-1308 Phase 3D: the read-only final-integration validator. It recomputes every claim from immutable inputs (git objects, the
// sealed evidence directories, the bound receipts) and writes nothing; it executes no product and no test. One check per 3D case.
// Result per case: READY or NOT_READY with the reasons (D7 is PENDING_BF on an I3 tip, which is not READY). The run result is one of
//   NOT_READY               some case is NOT_READY
//   I3_VALID_PENDING_BF     every case is READY except D7, which waits for the binding-only BF child (HEAD is I3)
//   CERTIFIED_READY_TO_TAG  every case is READY and HEAD is the binding-only BF child of a valid I3 (no tag is created or implied)
import fs from 'node:fs';
import path from 'node:path';
import { verifyCandidate } from '../mo1308-phase3/lib/candidate.mjs';
import { checkDisclosure, readOutcomes } from '../mo1308-phase3/lib/disclosure.mjs';
import { validateDisposition } from '../mo1308-phase3/lib/classification.mjs';
import { allCases, loadInventory, requirementMatrix, validateInventory, INVENTORY_FILE } from '../mo1308-phase3/lib/inventory.mjs';
import { verifyEvidence } from '../mo1308-phase3/lib/runner.mjs';
import { EVIDENCE_ROOT, parseGeneration } from '../mo1308-phase3/lib/seal.mjs';
import { changedPaths, commitsBetween, git, gitText, isAncestor, revParse } from '../mo1308-phase3/lib/git.mjs';
import { digestOfJson, sha256Hex, walkRecords } from '../mo1308-phase3/lib/hashing.mjs';
import { stableStringify } from '../mo1308-phase3/lib/stable-json.mjs';

export const CANDIDATE_IDENTITY_FILE = 'repositories/cca-conformance/mo1308-phase3-candidate-identity.json';
export const A32_RECEIPT_FILE = `${EVIDENCE_ROOT}/phase3-precondition-g3/receipt.json`;
export const REGRESSION_FILE = `${EVIDENCE_ROOT}/phase3d/regression.json`;
export const DISCLOSURES_FILE = 'docs/mo1308-release-disclosures.md';
export const FINAL_INVENTORY_FILE = 'repositories/cca-conformance/mo1308-final-release-inventory.json';
export const FINAL_BINDING_FILE = 'repositories/cca-conformance/mo1308-final-binding.json';
export const RELEASE_TAG = 'memoryos-1.3-mo1308';
export const REGRESSION_KIND = 'MO1308Phase3RegressionRecord';
export const REQUIRED_SUITES = Object.freeze(['mo1308', 'cli', 'studio', 'mo1307', 'examples']);
export const MO1307_TESTS = 639;
export const STREAMS = Object.freeze(['3A', '3B', '3C']);

const readJson = (root, relative) => JSON.parse(fs.readFileSync(path.join(root, ...relative.split('/')), 'utf8'));
const fileExists = (root, relative) => fs.existsSync(path.join(root, ...relative.split('/')));
const sha = (root, relative) => sha256Hex(fs.readFileSync(path.join(root, ...relative.split('/'))));

// ---- the evidence set ----

// Every generation directory under the evidence root (those with a seal.json), verified against the inventory.
export function loadGenerations({ root, evidenceRoot = EVIDENCE_ROOT, inventory }) {
  const base = path.join(root, ...evidenceRoot.split('/'));
  if (!fs.existsSync(base)) return [];
  const generations = [];
  for (const name of fs.readdirSync(base, { withFileTypes: true }).filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort()) {
    const directory = path.join(base, name);
    if (!fs.existsSync(path.join(directory, 'seal.json'))) continue;
    const row = { id: name, directory, relative: `${evidenceRoot}/${name}`, problems: [], seal: null, receipt: null, parsed: null };
    try { row.parsed = parseGeneration(name); } catch (error) { row.problems.push(error.message); generations.push(row); continue; }
    const verified = verifyEvidence({ root, evidenceDir: directory, inventory });
    row.problems.push(...verified.problems);
    row.seal = verified.seal ?? null;
    row.receipt = verified.receipt ?? null;
    if (row.seal !== null && row.seal.generation.id !== name) row.problems.push('the seal names another generation');
    if (row.seal !== null && row.seal.certifying !== !row.parsed.rehearsal) row.problems.push('certifying flag and generation id disagree');
    row.evidenceSealSha256 = fileExists(directory, 'evidence-seal.json') ? sha256Hex(fs.readFileSync(path.join(directory, 'evidence-seal.json'))) : null;
    row.accepted = row.problems.length === 0 && row.receipt !== null && row.receipt.certifying === true && row.receipt.promotable === true && row.receipt.result === 'ACCEPTED';
    generations.push(row);
  }
  return generations;
}

// Disposition records anywhere under the evidence root, by file hash.
export function loadDispositions({ root, evidenceRoot = EVIDENCE_ROOT }) {
  const base = path.join(root, ...evidenceRoot.split('/'));
  const found = new Map();
  if (!fs.existsSync(base)) return found;
  for (const row of walkRecords(base).filter((item) => item.path.endsWith('.json') && /disposition/i.test(item.path) && item.byteLength < 1_000_000)) {
    try {
      const value = JSON.parse(fs.readFileSync(path.join(base, ...row.path.split('/')), 'utf8'));
      if (value?.kind === 'MO1308Phase3Disposition') found.set(row.sha256, { path: `${evidenceRoot}/${row.path}`, value });
    } catch { /* not a disposition */ }
  }
  return found;
}

// ---- the cases ----

export function checkD1({ root, repo = root, head, identity }) {
  const problems = [];
  if (!isAncestor(repo, identity.baseCommit, head)) return { problems: [`${head.slice(0, 8)} does not descend from the candidate ${identity.baseCommit.slice(0, 8)}`], observed: {} };
  problems.push(...verifyCandidate({ repo, identity, against: head, worktree: false }));
  // No commit introduces production bytes: at every commit after the candidate the blob of each production path equals the blob in one
  // of its parents (an ordinary commit changes none; a merge takes one side's). The head equals the candidate, checked above.
  const paths = identity.productionPaths.map((row) => row.path);
  const blobs = new Map();
  const blobsAt = (commit) => {
    if (!blobs.has(commit)) {
      const rows = new Map();
      for (const line of git(repo, ['ls-tree', '-r', commit, '--', ...paths]).stdout.toString('utf8').split('\n').filter(Boolean)) { const [meta, file] = line.split('\t'); rows.set(file, meta.split(' ')[2]); }
      blobs.set(commit, rows);
    }
    return blobs.get(commit);
  };
  const commits = commitsBetween(repo, identity.baseCommit, head);
  for (const { commit, parents } of commits) {
    const here = blobsAt(commit);
    for (const file of paths) {
      if (parents.length > 0 && parents.some((parent) => blobsAt(parent).get(file) === here.get(file))) continue;
      problems.push(`${commit.slice(0, 8)} introduces new bytes for production path ${file}`);
      break;
    }
  }
  return { problems, observed: { candidate: identity.baseCommit, productionTreeDigest: identity.productionTreeDigest, commitsChecked: commits.length } };
}

export function checkD2({ root, inventory, generations, dispositions, a32Sha256 }) {
  const problems = [];
  const accepted = {};
  const preserved = [];
  const rehearsals = [];
  for (const row of generations) {
    if (row.problems.length > 0) problems.push(`${row.id}: ${row.problems[0]}`);
    if (row.parsed === null) continue;
    if (row.parsed.rehearsal) {
      rehearsals.push(row.id);
      if (row.receipt?.certifying !== false || row.receipt?.promotable !== false) problems.push(`${row.id}: a rehearsal must be non-certifying and not promotable`);
    }
  }
  for (const stream of STREAMS) {
    const certifying = generations.filter((row) => row.parsed !== null && row.parsed.stream === stream && !row.parsed.rehearsal).sort((a, b) => a.parsed.ordinal - b.parsed.ordinal);
    const accepts = certifying.filter((row) => row.accepted);
    if (accepts.length === 0) { problems.push(`${stream}: no accepted certifying generation`); continue; }
    if (accepts.length > 1) problems.push(`${stream}: more than one accepted generation`);
    const last = certifying.at(-1);
    if (!last.accepted) problems.push(`${stream}: the latest generation ${last.id} is not accepted`);
    accepted[stream] = last.id;
    certifying.forEach((row, index) => {
      if (row.accepted) return;
      preserved.push(row.id);
      if (!['FAILED_PRESERVED', 'ESCALATED_PRESERVED'].includes(row.receipt?.result)) { problems.push(`${row.id}: an unaccepted generation is neither failed nor escalated and preserved`); return; }
      const next = certifying[index + 1];
      if (next === undefined) return;
      const link = next.seal?.generation?.supersedes ?? null;
      if (link === null || link.id !== row.id) { problems.push(`${next.id}: does not supersede ${row.id}`); return; }
      if (link.evidenceSealSha256 !== row.evidenceSealSha256) problems.push(`${next.id}: binds another evidence seal for ${row.id}`);
      const disposition = [...dispositions].find(([hash]) => hash === link.dispositionSha256)?.[1] ?? null;
      if (disposition === null) { problems.push(`${row.id}: the disposition ${link.dispositionSha256.slice(0, 12)} is not present`); return; }
      const shape = validateDisposition(disposition.value);
      if (shape.length > 0) problems.push(`${disposition.path}: ${shape[0]}`);
      if (disposition.value.generation !== row.id || disposition.value.evidenceSealSha256 !== row.evidenceSealSha256) problems.push(`${disposition.path}: is about another generation or seal`);
      if (disposition.value.nextAction !== 'NEW_GENERATION' || disposition.value.rerunOrdinal !== next.parsed.ordinal) problems.push(`${disposition.path}: does not authorize ${next.id}`);
      if (disposition.value.ownerReviewRequired && disposition.value.ownerApprovalReference === null) problems.push(`${disposition.path}: owner review required without an approval reference`);
    });
    // the accepted 3A generation binds the A3.2 receipt that this run is checking (D5)
    if (stream === '3A' && last.seal !== null) {
      const bound = last.seal.inputs.find((item) => item.path.endsWith('phase3-precondition-g3/receipt.json'));
      if (bound === undefined) problems.push('3A: the accepted generation does not bind the A3.2 receipt');
      else if (a32Sha256 !== null && bound.sha256 !== a32Sha256) problems.push('3A: the A3.2 receipt changed since the accepted generation sealed it');
    }
  }
  return { problems, observed: { accepted, preserved, rehearsals, generations: generations.map((row) => ({ id: row.id, result: row.receipt?.result ?? null, evidenceSealSha256: row.evidenceSealSha256 })) } };
}

// Case results (PASS) of the accepted generations, by case id.
export function acceptedPasses({ generations }) {
  const passes = new Map();
  for (const row of generations.filter((item) => item.accepted)) {
    for (const step of row.seal.steps) {
      const receipt = readJson(row.directory, `steps/${step.id}.json`);
      for (const item of receipt.cases) if (item.result === 'PASS') passes.set(item.id, row.id);
    }
  }
  return passes;
}

export function checkD3({ inventory, generations, d4, d5 }) {
  const problems = [];
  const ids = inventory.requirements;
  if (ids.length !== 37 || new Set(ids).size !== 37 || !ids.every((id, index) => id === `MO1308-R${String(index + 1).padStart(2, '0')}`)) problems.push('the inventory does not list exactly R01-R37');
  const passes = acceptedPasses({ generations });
  const uncovered = [];
  const covers = {};
  for (const row of requirementMatrix(inventory)) {
    if (row.cases.length === 0) { problems.push(`${row.requirement}: no case maps to it`); continue; }
    const passing = row.cases.filter((id) => passes.has(id));
    // a requirement whose cases are all 3D cases is proven by the 3D validator run itself (D4 and D5)
    const onlyFinal = row.cases.every((id) => id.startsWith('3D-'));
    const finalOk = onlyFinal && row.cases.every((id) => (id === '3D-D4' ? d4 : id === '3D-D5' ? d5 : false));
    covers[row.requirement] = passing.length > 0 ? passing : finalOk ? row.cases : [];
    if (passing.length === 0 && !finalOk) uncovered.push(row.requirement);
  }
  if (uncovered.length > 0) problems.push(`no PASS in an accepted generation for ${uncovered.length} of ${ids.length} requirements (${uncovered.slice(0, 4).join(', ')}${uncovered.length > 4 ? ', ...' : ''})`);
  return { problems, observed: { requirements: ids.length, uncovered, covers } };
}

export function checkD4({ root, regression, identity, head, repo = root }) {
  const problems = [];
  if (regression === null) return { problems: ['the retained regression record is absent'], observed: {} };
  if (regression.kind !== REGRESSION_KIND || regression.version !== '1.0.0') problems.push('not a regression record');
  if (regression.candidate?.productionTreeDigest !== identity.productionTreeDigest) problems.push('the record is about another production tree');
  if (typeof regression.commit !== 'string' || !/^[0-9a-f]{40}$/.test(regression.commit)) problems.push('the record names no commit');
  else if (regression.commit !== head && !isAncestor(repo, regression.commit, head)) problems.push('the record commit is not an ancestor of HEAD');
  const byName = new Map((regression.suites ?? []).map((suite) => [suite.name, suite]));
  for (const name of REQUIRED_SUITES) {
    const suite = byName.get(name);
    if (suite === undefined) { problems.push(`suite ${name} is absent`); continue; }
    if (suite.exitCode !== 0 || suite.failed !== 0 || !(suite.passed > 0) || suite.total !== suite.passed + suite.failed + suite.skipped) problems.push(`suite ${name}: not a clean pass (${suite.passed}/${suite.total}, ${suite.failed} failed, exit ${suite.exitCode})`);
    if (!/^[0-9a-f]{64}$/.test(suite.logSha256 ?? '')) problems.push(`suite ${name}: no raw log digest`);
  }
  if (byName.get('mo1307') !== undefined && byName.get('mo1307').total !== MO1307_TESTS) problems.push(`suite mo1307: ${byName.get('mo1307').total} tests, expected ${MO1307_TESTS}`);
  return { problems, observed: { suites: [...byName.keys()] } };
}

// The verdict member of the A3.2 receipt is `verdict` (to be confirmed against the first real receipt; see the 3D document).
export function checkD5({ receipt }) {
  const problems = [];
  if (receipt === null) return { problems: ['the A3.2 receipt is absent'], observed: {} };
  if (receipt.verdict !== 'PASS') problems.push(`the A3.2 verdict is ${JSON.stringify(receipt.verdict ?? null)}, not PASS`);
  return { problems, observed: { verdict: receipt.verdict ?? null } };
}

export function checkD6({ root, inventory, generations }) {
  const problems = [];
  const accepted = generations.filter((row) => row.accepted && row.parsed.stream !== '3B');
  const outcomes = readOutcomes(accepted.map((row) => row.directory));
  if (!fileExists(root, DISCLOSURES_FILE)) return { problems: [`${DISCLOSURES_FILE} does not exist`], observed: { recordedOutcomes: outcomes.size } };
  const text = fs.readFileSync(path.join(root, DISCLOSURES_FILE), 'utf8');
  problems.push(...checkDisclosure(text, inventory, outcomes));
  const register = inventory.qualifications.map((item) => item.id);
  if (register.length !== 15 || register[0] !== 'Q01' || register.at(-1) !== 'Q15') problems.push('the register is not Q01-Q15');
  return { problems, observed: { recordedOutcomes: Object.fromEntries(outcomes), disclosuresSha256: sha(root, DISCLOSURES_FILE) } };
}

// I3 is the commit that adds the final inventory; BF is its binding-only child: exactly one added file, nothing edited, and the
// binding names the inventory by hash without containing its own.
export function checkD7({ root, repo = root, head }) {
  const problems = [];
  const observed = { state: 'ABSENT' };
  const tagTarget = git(repo, ['rev-parse', '-q', '--verify', `refs/tags/${RELEASE_TAG}^{commit}`], { allowFailure: true });
  const tagged = tagTarget.status === 0 ? tagTarget.stdout.toString('utf8').trim() : null;
  const parent = git(repo, ['rev-parse', '-q', '--verify', `${head}^`], { allowFailure: true });
  const headParent = parent.status === 0 ? parent.stdout.toString('utf8').trim() : null;
  const hasInventory = git(repo, ['cat-file', '-e', `${head}:${FINAL_INVENTORY_FILE}`], { allowFailure: true }).status === 0;
  const hasBinding = git(repo, ['cat-file', '-e', `${head}:${FINAL_BINDING_FILE}`], { allowFailure: true }).status === 0;
  if (!hasInventory) { problems.push(`${FINAL_INVENTORY_FILE} is not in HEAD: no I3`); return { problems, observed, pendingBf: false, tagged }; }
  observed.state = 'I3';
  let pendingBf = false;
  if (!hasBinding) pendingBf = true;
  else {
    observed.state = 'BF';
    const changes = git(repo, ['diff', '--name-status', '--no-renames', '-z', headParent ?? '', head]).stdout.toString('utf8').split('\0').filter(Boolean);
    if (JSON.stringify(changes) !== JSON.stringify(['A', FINAL_BINDING_FILE])) problems.push(`BF is not binding-only: ${changes.join(' ')}`);
    const parentHasInventory = headParent !== null && git(repo, ['cat-file', '-e', `${headParent}:${FINAL_INVENTORY_FILE}`], { allowFailure: true }).status === 0;
    const parentHasBinding = headParent !== null && git(repo, ['cat-file', '-e', `${headParent}:${FINAL_BINDING_FILE}`], { allowFailure: true }).status === 0;
    if (!parentHasInventory || parentHasBinding) problems.push('the parent of BF is not I3');
    if (!fileExists(root, FINAL_BINDING_FILE)) problems.push('the binding is not in the worktree');
    else {
      const binding = readJson(root, FINAL_BINDING_FILE);
      const bytes = fs.readFileSync(path.join(root, ...FINAL_BINDING_FILE.split('/'))).toString('utf8');
      const inventoryBytes = git(repo, ['show', `${headParent}:${FINAL_INVENTORY_FILE}`]).stdout;
      if (binding.inventory?.sha256 !== sha256Hex(inventoryBytes)) problems.push('the binding names another inventory');
      if (binding.i3 !== headParent) problems.push('the binding names another I3 commit');
      if (bytes.includes(head)) problems.push('the binding embeds its own commit');
    }
  }
  if (tagged !== null && !(observed.state === 'BF' && tagged === head)) problems.push(`the tag ${RELEASE_TAG} exists and does not target the BF commit`);
  return { problems, observed, pendingBf, tagged };
}

// ---- step E: release-claim and disclosure review (formerly 3C-K1 to K3; all case outcomes are known here) ----

const OVERCLAIM = /tamper[- ]?proof|\bencrypt(?:ed|ion)\b|\bsigned\b|\bauthenticat(?:ed|ion)\b|multi-user|shared storage|cloud (?:sync|storage|backup)|CCA-MEMORYOS-1\.0 (?:conformant|compliant)/i;
const NEGATION = /\b(no|not|never|without|does not|cannot|isn't|excluded|out of scope|NOT_VERIFIED_BY_MEMORYOS|re-review|before any)\b/i;
const CLAIM_DOCUMENTS = ['README.md', 'ROADMAP.md', 'RELEASE_NOTES.md', 'KNOWN_ISSUES.md', 'ARCHITECTURE.md', 'repositories/memoryos-cli/README.md'];
const text = (root, relative) => fs.readFileSync(path.join(root, ...relative.split('/')), 'utf8');

export function checkE1({ root, inventory }) {
  const problems = [];
  if (!fileExists(root, DISCLOSURES_FILE)) problems.push(`${DISCLOSURES_FILE} does not exist`);
  else for (const row of inventory.qualifications) if (!new RegExp(`\\b${row.id}\\b`).test(text(root, DISCLOSURES_FILE))) problems.push(`${row.id} is missing from the disclosures`);
  const docsDirectory = path.join(root, 'repositories/memoryos-cli/docs');
  const documents = [...CLAIM_DOCUMENTS, ...(fs.existsSync(docsDirectory) ? fs.readdirSync(docsDirectory).filter((name) => name.endsWith('.md')).map((name) => `repositories/memoryos-cli/docs/${name}`) : [])];
  const overclaims = [];
  for (const file of documents.filter((name) => fileExists(root, name))) {
    text(root, file).split('\n').forEach((line, index) => {
      if (/MO-1308|history ledger|Investigation History|memoryos history/i.test(line) && OVERCLAIM.test(line) && !NEGATION.test(line)) overclaims.push(`${file}:${index + 1}`);
    });
  }
  for (const where of overclaims.slice(0, 5)) problems.push(`${where}: a claim beyond the Freeze`);
  return { problems, observed: { documentsScanned: documents.length, overclaims: overclaims.length } };
}

export function checkE2({ root, generations }) {
  const problems = [];
  const outcomes = readOutcomes(generations.filter((row) => row.accepted && row.parsed.stream === '3C').map((row) => row.directory));
  const outcome = outcomes.get('3C-A6') ?? null;
  if (outcome === null) problems.push('3C-A6 has no recorded outcome in an accepted 3C generation');
  const candidates = ['repositories/memoryos-cli/README.md', 'repositories/memoryos-cli/docs/history-guide.md', DISCLOSURES_FILE].filter((file) => fileExists(root, file));
  const guided = candidates.filter((file) => /headDigest/.test(text(root, file)) && /(outside the ledger|external(ly)?|separate system)/i.test(text(root, file)));
  if (guided.length === 0) problems.push('no document gives the headDigest anchoring guidance');
  for (const file of guided) {
    const states = /3C-A6:\s+(CONFIRMED|NOT_CONFIRMED)/.exec(text(root, file))?.[1] ?? null;
    if (outcome !== null && states !== outcome) problems.push(`${file}: states ${states} for 3C-A6 but the recorded outcome is ${outcome}`);
  }
  return { problems, observed: { guidanceIn: guided, recordedOutcome: outcome } };
}

export function checkE3({ root, inventory, generations }) {
  const outcomes = readOutcomes(generations.filter((row) => row.accepted && row.parsed.stream !== '3B').map((row) => row.directory));
  if (!fileExists(root, DISCLOSURES_FILE)) return { problems: [`${DISCLOSURES_FILE} does not exist`], observed: {} };
  return { problems: checkDisclosure(text(root, DISCLOSURES_FILE), inventory, outcomes).slice(0, 8), observed: { recordedOutcomes: outcomes.size } };
}

// ---- the run ----

export function evaluate({ root, repo = root, head = null, a32ReceiptPath = A32_RECEIPT_FILE, regressionPath = REGRESSION_FILE, evidenceRoot = EVIDENCE_ROOT } = {}) {
  const inventory = loadInventory(path.join(root, INVENTORY_FILE));
  const identity = readJson(root, CANDIDATE_IDENTITY_FILE);
  const headCommit = revParse(repo, head ?? 'HEAD');
  const inventoryProblems = validateInventory(inventory);
  const generations = loadGenerations({ root, evidenceRoot, inventory });
  const dispositions = loadDispositions({ root, evidenceRoot });
  const a32 = fileExists(root, a32ReceiptPath) ? readJson(root, a32ReceiptPath) : null;
  const regression = fileExists(root, regressionPath) ? readJson(root, regressionPath) : null;
  const results = new Map();
  const put = (id, found) => results.set(id, { id, status: found.problems.length > 0 ? 'NOT_READY' : found.pendingBf === true ? 'PENDING_BF' : 'READY', problems: found.problems, observed: found.observed, ...(found.pendingBf === undefined ? {} : { pendingBf: found.pendingBf }) });
  put('3D-D1', checkD1({ root, repo, head: headCommit, identity }));
  put('3D-D2', checkD2({ root, inventory, generations, dispositions, a32Sha256: a32 === null ? null : sha(root, a32ReceiptPath) }));
  put('3D-D4', checkD4({ root, repo, regression, identity, head: headCommit }));
  put('3D-D5', checkD5({ receipt: a32 }));
  put('3D-D3', checkD3({ inventory, generations, d4: results.get('3D-D4').status === 'READY', d5: results.get('3D-D5').status === 'READY' }));
  put('3D-D6', checkD6({ root, inventory, generations }));
  put('3D-D7', checkD7({ root, repo, head: headCommit }));
  put('3D-E1', checkE1({ root, inventory }));
  put('3D-E2', checkE2({ root, generations }));
  put('3D-E3', checkE3({ root, inventory, generations }));
  if (inventoryProblems.length > 0) results.get('3D-D3').problems.unshift(`the inventory is invalid: ${inventoryProblems[0]}`);
  const ordered = allCases(inventory).filter((item) => item.stream === '3D').map((item) => results.get(item.id));
  const d7 = results.get('3D-D7');
  const othersReady = ordered.filter((row) => row.id !== '3D-D7').every((row) => row.status === 'READY');
  let token = 'NOT_READY';
  if (othersReady && d7.status === 'READY') token = 'CERTIFIED_READY_TO_TAG';
  else if (othersReady && d7.status === 'PENDING_BF') token = 'I3_VALID_PENDING_BF';
  const report = { kind: 'MO1308Phase3FinalValidation', version: '1.0.0', result: token, head: headCommit, candidate: identity.baseCommit, cases: ordered, generations: generations.map((row) => row.id) };
  return { report, context: { root, repo, inventory, identity, generations, dispositions, a32, a32ReceiptPath, regression, regressionPath, headCommit } };
}

export const validateFinal = (options) => evaluate(options).report;

export { digestOfJson, gitText, stableStringify };
