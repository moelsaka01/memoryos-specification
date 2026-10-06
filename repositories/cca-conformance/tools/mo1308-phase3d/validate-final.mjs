#!/usr/bin/env node
// MO-1308 Phase 3D read-only validator. Writes nothing, executes no product. Exit 0 for CERTIFIED_READY_TO_TAG and
// I3_VALID_PENDING_BF, 1 for NOT_READY, 2 for a usage or input error.
//   node validate-final.mjs [--root DIR] [--head REV] [--a32-receipt FILE] [--regression FILE] [--evidence-root DIR]
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { repositoryRoot } from '../mo1308-phase3/lib/git.mjs';
import { validateFinal } from './validate.mjs';

const args = process.argv.slice(2);
const option = (name) => { const index = args.indexOf(name); return index === -1 ? null : args[index + 1] ?? null; };
try {
  const root = path.resolve(option('--root') ?? repositoryRoot(path.dirname(fileURLToPath(import.meta.url))));
  const report = validateFinal({
    root, head: option('--head'), ...(option('--a32-receipt') === null ? {} : { a32ReceiptPath: option('--a32-receipt') }),
    ...(option('--regression') === null ? {} : { regressionPath: option('--regression') }), ...(option('--evidence-root') === null ? {} : { evidenceRoot: option('--evidence-root') }),
  });
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  process.exitCode = report.result === 'NOT_READY' ? 1 : 0;
} catch (error) {
  process.stderr.write(`${JSON.stringify({ error: String(error.message).slice(0, 300) })}\n`);
  process.exitCode = 2;
}
