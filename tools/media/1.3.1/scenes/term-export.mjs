// Scene: the developer path to the export that Studio opens. The pinned runtime is shown by its SHA-256, then the released CLI builds a history
// (init, 12 appends, verify, tombstone), exports it, verifies the export, and a one-byte copy is made and rejected by the CLI verifier.
// Every command is typed with real keystrokes and runs for real; the prompt counter says when each one has finished.
import fs from 'node:fs';
import { sleep } from '../lib/winauto.mjs';
import { HISTORY_COMMANDS } from '../make-export.mjs';

export const name = 'term-export';
export const kind = 'terminal';
export const terminalOptions = { startDir: 'C:/mos-demo' };

export async function setup() {
  for (const stale of ['ledger', 'export', 'export-tampered']) fs.rmSync(`C:/mos-demo/${stale}`, { recursive: true, force: true });
}

export default async function run(T, { mark }) {
  const BACKSLASH = String.fromCharCode(92);
  const win = (p) => p.replaceAll('/', BACKSLASH);
  const typed = (command, options = {}) => T.run(command, { mark, ...options });
  mark('start');
  await sleep(1200);
  await typed(`Get-FileHash ${win('C:/mos-node/node.exe')} -Algorithm SHA256 | Format-List Hash`, { cps: 32, after: 1600 });
  mark('pinned-hash');
  await typed(`& ${win('C:/mos-node/node.exe')} --version`, { cps: 32, after: 900 });
  await typed('memoryos version', { cps: 32, after: 1200 });
  await T.clear();
  mark('history-start');
  for (const command of HISTORY_COMMANDS) {
    const isAppend = command.includes(' append ');
    await typed(command.replaceAll('/', BACKSLASH), { cps: isAppend ? 52 : 40, before: isAppend ? 250 : 450, after: isAppend ? 350 : 900 });
    if (command.includes(' verify --')) mark('ledger-verified');
    if (command.includes(' export --ledger')) mark('exported');
    if (command.includes(' verify-export')) mark('export-verified');
  }
  await typed('Get-ChildItem export | Select-Object Name', { cps: 36, after: 1600 });
  mark('export-listed');
  await T.clear();
  mark('tamper-start');
  await typed('flip-one-byte export export-tampered', { cps: 30, after: 1500 });
  mark('tampered');
  await typed('memoryos history verify-export --export export-tampered', { cps: 34, after: 700 });
  mark('tamper-rejected');
  await typed('$LASTEXITCODE', { cps: 30, after: 3500 });
  mark('end');
}
