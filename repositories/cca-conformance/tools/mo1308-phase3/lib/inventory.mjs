// MO-1308 Phase 3 shared library: the case inventory (built from inventory-source.mjs), its validation, and the derived
// requirement matrix. The committed mo1308-phase3-inventory.json must equal buildInventory() byte for byte.
import fs from 'node:fs';
import { QUALIFICATIONS, REQUIREMENT_IDS, STREAMS } from './inventory-source.mjs';
import { stableBytes } from './stable-json.mjs';

export const INVENTORY_KIND = 'MO1308Phase3Inventory';
export const INVENTORY_VERSION = '1.0.0';
export const INVENTORY_FILE = 'repositories/cca-conformance/mo1308-phase3-inventory.json';

const parseFlags = (flags) => {
  const tokens = flags.split(' ').filter(Boolean);
  return {
    record: tokens.includes('record'),
    mandatory: !tokens.includes('nonmandatory'),
    qualifications: tokens.filter((token) => /^Q\d\d$/.test(token)),
  };
};

export function buildInventory() {
  return {
    kind: INVENTORY_KIND,
    version: INVENTORY_VERSION,
    protocol: 'MO1308-PHASE3-PROTOCOL-1 (proposed Freeze Amendment A8)',
    requirements: REQUIREMENT_IDS.map((id) => `MO1308-${id}`),
    qualifications: QUALIFICATIONS.map(([id, statement]) => ({ id, statement })),
    streams: STREAMS.map((stream) => ({
      id: stream.id,
      title: stream.title,
      platform: stream.platform,
      oneShot: stream.oneShot,
      segments: stream.segments.map((segment) => ({ ...segment })),
      steps: stream.steps.map((step) => ({
        id: step.id,
        segment: step.segment,
        title: step.title,
        guardMinutes: step.guardMinutes,
        cases: step.cases.map(([localId, title, requirements, flags]) => {
          const parsed = parseFlags(flags);
          return {
            id: `${stream.id}-${localId}`,
            title,
            requirements: requirements === '' ? [] : requirements.split(',').map((id) => `MO1308-${id}`),
            mode: parsed.record ? 'record' : 'assert',
            mandatory: parsed.mandatory,
            qualifications: parsed.qualifications,
          };
        }),
      })),
    })),
  };
}

export const inventoryBytes = (inventory = buildInventory()) => stableBytes(inventory);
export const loadInventory = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));

export const allCases = (inventory) => inventory.streams.flatMap((stream) =>
  stream.steps.flatMap((step) => step.cases.map((item) => ({ ...item, stream: stream.id, step: step.id, segment: step.segment }))));

export const streamOf = (inventory, id) => {
  const stream = inventory.streams.find((item) => item.id === id);
  if (stream === undefined) throw new Error(`unknown stream ${id}`);
  return stream;
};

// Structural rules: unique case IDs of the form <stream>-<local>, known requirement and qualification IDs, steps that name a
// declared segment, every requirement covered by at least one case, and every qualification characterized by a case.
export function validateInventory(inventory) {
  const problems = [];
  const requirementIds = new Set(inventory.requirements);
  const qualificationIds = new Set(inventory.qualifications.map((item) => item.id));
  const seen = new Set();
  const covered = new Set();
  const characterized = new Set();
  for (const stream of inventory.streams) {
    const segmentIds = new Set(stream.segments.map((segment) => segment.id));
    const stepIds = new Set();
    for (const step of stream.steps) {
      if (stepIds.has(step.id)) problems.push(`${stream.id}: duplicate step ${step.id}`);
      stepIds.add(step.id);
      if (!segmentIds.has(step.segment)) problems.push(`${stream.id}-${step.id}: unknown segment ${step.segment}`);
      if (step.cases.length === 0) problems.push(`${stream.id}-${step.id}: no cases`);
      for (const item of step.cases) {
        if (!item.id.startsWith(`${stream.id}-`)) problems.push(`${item.id}: wrong stream prefix`);
        if (seen.has(item.id)) problems.push(`${item.id}: duplicate case`);
        seen.add(item.id);
        for (const requirement of item.requirements) {
          if (!requirementIds.has(requirement)) problems.push(`${item.id}: unknown requirement ${requirement}`);
          covered.add(requirement);
        }
        for (const qualification of item.qualifications) {
          if (!qualificationIds.has(qualification)) problems.push(`${item.id}: unknown qualification ${qualification}`);
          characterized.add(qualification);
        }
      }
    }
  }
  for (const requirement of requirementIds) {
    if (!covered.has(requirement)) problems.push(`${requirement}: no case covers it`);
  }
  for (const qualification of qualificationIds) {
    if (!characterized.has(qualification)) problems.push(`${qualification}: no case characterizes it`);
  }
  return problems;
}

// requirement -> case IDs (sorted), plus the streams that carry it.
export function requirementMatrix(inventory) {
  const rows = new Map(inventory.requirements.map((id) => [id, []]));
  for (const item of allCases(inventory)) for (const requirement of item.requirements) rows.get(requirement).push(item.id);
  return [...rows].map(([requirement, ids]) => ({ requirement, cases: ids.sort(), streams: [...new Set(ids.map((id) => id.slice(0, 2)))].sort() }));
}
