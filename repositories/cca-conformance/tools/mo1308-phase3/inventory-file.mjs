#!/usr/bin/env node
// MO-1308 Phase 3: write or check the committed case inventory (mo1308-phase3-inventory.json).
//   node inventory-file.mjs write     write it from lib/inventory-source.mjs (refuses to overwrite a different file)
//   node inventory-file.mjs check     exit 1 unless the committed file equals the source byte for byte and validates
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildInventory, inventoryBytes, validateInventory } from './lib/inventory.mjs';

const target = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../mo1308-phase3-inventory.json');
const expected = inventoryBytes(buildInventory());
const problems = validateInventory(buildInventory());
if (problems.length > 0) { console.error(problems.join('\n')); process.exit(1); }
const command = process.argv[2];
if (command === 'write') {
  fs.writeFileSync(target, expected);
} else if (command === 'check') {
  const same = fs.existsSync(target) && fs.readFileSync(target).equals(expected);
  console.log(JSON.stringify({ result: same ? 'PASS' : 'FAIL' }));
  process.exit(same ? 0 : 1);
} else { console.error('usage: inventory-file.mjs write|check'); process.exit(2); }
