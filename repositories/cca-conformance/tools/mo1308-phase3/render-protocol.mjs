#!/usr/bin/env node
// MO-1308 Phase 3: render the generated tables of docs/mo1308-phase3-protocol.md from the case inventory, so the document and
// the inventory cannot disagree.
//   node render-protocol.mjs update     rewrite every generated block in the document
//   node render-protocol.mjs check      exit 1 unless every generated block is current
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ALLOWED_CHANGE_RULES } from './lib/allowed-paths.mjs';
import { allCases, buildInventory, requirementMatrix } from './lib/inventory.mjs';
import { STREAMS } from './lib/inventory-source.mjs';

const doc = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../docs/mo1308-phase3-protocol.md');
const cell = (text) => text.replace(/\|/g, '\\|');

export function blocks(inventory = buildInventory()) {
  const out = {};
  for (const stream of inventory.streams) {
    const lines = [];
    for (const segment of stream.segments) {
      lines.push(`Segment \`${segment.id}\`: ${segment.title}. Budget ${segment.budgetMinutes} min, extended ${segment.extendedMinutes} min.`, '');
    }
    for (const step of stream.steps) {
      lines.push(`#### ${stream.id} step ${step.id}: ${step.title} (segment \`${step.segment}\`, guard ${step.guardMinutes} min, ${step.cases.length} cases)`, '');
      lines.push('| Case | What is established | Requirements | Mode | Qualifications |', '|---|---|---|---|---|');
      for (const item of step.cases) {
        const mode = `${item.mode}${item.mandatory ? '' : ', not mandatory'}`;
        lines.push(`| ${item.id} | ${cell(item.title)} | ${item.requirements.map((id) => id.replace('MO1308-', '')).join(', ') || '-'} | ${mode} | ${item.qualifications.join(', ') || '-'} |`);
      }
      lines.push('');
    }
    out[`inventory-${stream.id}`] = lines.join('\n').trimEnd();
  }
  const counts = inventory.streams.map((stream) => {
    const total = stream.steps.reduce((sum, step) => sum + step.cases.length, 0);
    return `| ${stream.id} | ${stream.title} | ${stream.steps.length} | ${total} | ${stream.oneShot ? 'yes' : 'validator run'} |`;
  });
  out.counts = ['| Stream | Title | Steps | Cases | One-shot |', '|---|---|---:|---:|---|', ...counts].join('\n');
  const matrix = requirementMatrix(inventory).map((row) => `| MO1308-${row.requirement.replace('MO1308-', '')} | ${row.streams.join(', ')} | ${row.cases.join(', ')} |`);
  out.matrix = ['| Requirement | Streams | Cases |', '|---|---|---|', ...matrix].join('\n');
  out.qualifications = ['| ID | Qualification | Characterized by |', '|---|---|---|', ...inventory.qualifications.map((item) => {
    const by = allCases(inventory).filter((row) => row.qualifications.includes(item.id)).map((row) => row.id).join(', ');
    return `| ${item.id} | ${cell(item.statement)} | ${by} |`;
  })].join('\n');
  out.allowed = ['| Class | Allowed paths |', '|---|---|', ...ALLOWED_CHANGE_RULES.map((rule) => `| ${rule.class} | ${rule.patterns.map((p) => `\`${p}\``).join(', ')} |`)].join('\n');
  out.steps = ['| Stream | Step | Segment | Guard (min) | Cases |', '|---|---|---|---:|---|',
    ...STREAMS.flatMap((stream) => stream.steps.map((step) => `| ${stream.id} | ${step.id} | ${step.segment} | ${step.guardMinutes} | ${step.cases.map(([id]) => id).join(', ')} |`))].join('\n');
  return out;
}

const marker = (name, edge) => `<!-- GENERATED:${edge} ${name} -->`;
export function renderDocument(text, generated = blocks()) {
  let result = text;
  for (const [name, body] of Object.entries(generated)) {
    const begin = marker(name, 'BEGIN');
    const end = marker(name, 'END');
    const from = result.indexOf(begin);
    const to = result.indexOf(end);
    if (from === -1 || to === -1 || to < from) throw new Error(`protocol document lacks the generated block ${name}`);
    result = `${result.slice(0, from + begin.length)}\n${body}\n${result.slice(to)}`;
  }
  return result;
}

if (process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const text = fs.readFileSync(doc, 'utf8');
  const rendered = renderDocument(text);
  if (process.argv[2] === 'update') fs.writeFileSync(doc, rendered);
  else if (process.argv[2] === 'check') { console.log(JSON.stringify({ result: rendered === text ? 'PASS' : 'FAIL' })); process.exit(rendered === text ? 0 : 1); }
  else { console.error('usage: render-protocol.mjs update|check'); process.exit(2); }
}
