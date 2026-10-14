// Scene for the portrait and square ads: short, live terminal beats at the narrow window sizes. The commands are the same real ones as in the demo
// (the long forms are typed in term-export / term-live); here the CLI is typed as is and the three live runs use short wrapper functions defined by
// lib/term-init.ps1 -Demo (demo-mcp, demo-ci, demo-readiness). Each run is real and the output is exactly what the program printed.
import fs from 'node:fs';
import { sleep } from '../lib/winauto.mjs';

export const name = 'term-ad';
export const kind = 'terminal';
export const terminalOptions = { startDir: 'C:/mos-demo', demo: true };
const FIXTURE = 'C:/mos-media/repo131/repositories/cca-conformance/fixtures';

export async function setup() {
  fs.rmSync('C:/mos-demo/export-tampered', { recursive: true, force: true });
  fs.rmSync('C:/mos-media/live/ci/work', { recursive: true, force: true });
  fs.cpSync(`${FIXTURE}/mo1306/evaluate-policy-pass`, 'C:/mos-media/live/ci/work', { recursive: true });
  fs.rmSync('C:/mos-media/live/readiness/out', { recursive: true, force: true });
}

export default async function run(T, { mark }) {
  const typed = (command, options = {}) => T.run(command, { mark, ...options });
  mark('start');
  await sleep(900);
  await typed('memoryos history verify-export --export export', { cps: 34, after: 2200 });
  mark('export-verified');
  await T.clear();
  await typed('flip-one-byte export export-tampered', { cps: 30, after: 1500 });
  mark('tampered');
  await typed('memoryos history verify-export --export export-tampered', { cps: 34, after: 2600 });
  mark('tamper-rejected');
  await T.clear();
  mark('mcp-start');
  await typed('demo-mcp', { cps: 14, after: 2600 });
  mark('mcp-done');
  await T.clear();
  mark('ci-start');
  await typed('demo-ci', { cps: 14, after: 2200, timeoutMs: 180000 });
  mark('ci-done');
  await T.clear();
  mark('readiness-start');
  await typed('demo-readiness', { cps: 14, after: 2400, timeoutMs: 180000 });
  mark('readiness-done');
  mark('end');
}
