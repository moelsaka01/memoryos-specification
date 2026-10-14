// MO-1308 Phase 3 shared library: release disclosures must state the actual outcome of every qualification case (A8 decision 6).
// A qualification case is a record-mode case that carries a Qnn tag; its observed outcome is CONFIRMED (the limitation behaves as
// the register says) or NOT_CONFIRMED (the product is better). A disclosure document states each outcome on its own line:
//
//   3C-A6: CONFIRMED - <sentence>        (or NOT_CONFIRMED)
//   Q01: DISCLOSED - <sentence>          (a structural qualification: no record case characterizes it)
//
// The check refuses a weakness that was NOT_CONFIRMED disclosed as confirmed, a CONFIRMED one that is omitted or reported as
// NOT_CONFIRMED, a duplicated or unknown line, and an outcome that was never recorded.
import fs from 'node:fs';
import path from 'node:path';
import { allCases } from './inventory.mjs';

export const CASE_LINE = /^\s*(?:[-*]\s+)?(3[AC]-[A-Z]+\d+):\s+(CONFIRMED|NOT_CONFIRMED)\b/;
export const STRUCTURAL_LINE = /^\s*(?:[-*]\s+)?(Q\d\d):\s+DISCLOSED\b/;

export function qualificationCases(inventory) {
  return allCases(inventory).filter((item) => (item.stream === '3A' || item.stream === '3C') && item.mode === 'record' && item.qualifications.length > 0);
}

export function structuralQualifications(inventory) {
  const recorded = new Set(qualificationCases(inventory).flatMap((item) => item.qualifications));
  return inventory.qualifications.map((item) => item.id).filter((id) => !recorded.has(id));
}

// Outcomes recorded in the step receipts of generation evidence directories (steps that did not run contribute nothing).
export function readOutcomes(evidenceDirs) {
  const outcomes = new Map();
  for (const directory of evidenceDirs) {
    const steps = path.join(directory, 'steps');
    if (!fs.existsSync(steps)) continue;
    for (const name of fs.readdirSync(steps).filter((file) => /^[A-Z]+\.json$/.test(file))) {
      const receipt = JSON.parse(fs.readFileSync(path.join(steps, name), 'utf8'));
      for (const row of receipt.cases) if (row.outcome !== null && row.result === 'PASS') outcomes.set(row.id, row.outcome);
    }
  }
  return outcomes;
}

export function checkDisclosure(text, inventory, outcomes) {
  const problems = [];
  const required = new Map(qualificationCases(inventory).map((item) => [item.id, item]));
  const structural = new Set(structuralQualifications(inventory));
  const seenCases = new Map();
  const seenStructural = new Set();
  for (const line of text.split('\n')) {
    const caseMatch = CASE_LINE.exec(line);
    const structuralMatch = STRUCTURAL_LINE.exec(line);
    if (caseMatch !== null) {
      const [, id, outcome] = caseMatch;
      if (seenCases.has(id)) problems.push(`${id}: stated more than once`);
      seenCases.set(id, outcome);
      if (!required.has(id)) problems.push(`${id}: not a qualification case`);
    } else if (structuralMatch !== null) {
      const id = structuralMatch[1];
      if (seenStructural.has(id)) problems.push(`${id}: stated more than once`);
      seenStructural.add(id);
      if (!structural.has(id)) problems.push(`${id}: is characterized by recorded cases and must be disclosed per case, not as DISCLOSED`);
    }
  }
  for (const id of required.keys()) {
    const recorded = outcomes.get(id) ?? null;
    if (recorded === null) problems.push(`${id}: no recorded outcome (the case did not run or did not pass)`);
    else if (!seenCases.has(id)) problems.push(`${id}: recorded ${recorded} but not disclosed`);
    else if (seenCases.get(id) !== recorded) problems.push(`${id}: disclosed ${seenCases.get(id)} but recorded ${recorded}`);
  }
  for (const id of structural) if (!seenStructural.has(id)) problems.push(`${id}: structural qualification is not disclosed`);
  return problems;
}
