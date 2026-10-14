// A real Windows Terminal window for the 1.3.1 release media: commands are TYPED with real keyboard input and run for real in Windows
// PowerShell 5.1 (profile: lib/term-init.ps1). The prompt writes a counter to a file, so the scene knows when a command has finished.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import { sleep } from './winauto.mjs';
import { GEOMETRY, WORK } from './studio.mjs';

export const INIT = 'C:/mos-media/repo131/tools/media/lib/term-init.ps1';

export function killMosTerminal() {
  spawnSync('powershell.exe', ['-NoProfile', '-Command', "Get-Process WindowsTerminal -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like 'MemoryOS*' } | Stop-Process -Force"]);
}

export async function openTerminal({ agent, geometry, zoom = geometry === '16x9' ? 4 : 2, startDir = 'C:/mos-demo', title = 'MemoryOS', demo = false }) {
  const g = GEOMETRY[geometry];
  killMosTerminal();
  const sync = `${WORK}/sync/prompt-${process.pid}.txt`;
  fs.mkdirSync(`${WORK}/sync`, { recursive: true });
  try { fs.unlinkSync(sync); } catch { /* none */ }
  const winName = `mos${Date.now()}`;
  spawn('wt.exe', ['-w', winName, '--focus', 'new-tab', '--title', title, 'powershell.exe', '-NoLogo', '-NoProfile', '-NoExit', '-ExecutionPolicy', 'Bypass',
    '-File', INIT, '-SyncFile', sync, '-StartDirectory', startDir, ...(demo ? ['-Demo'] : [])], { detached: true, stdio: 'ignore' }).unref();
  let win;
  for (let i = 0; i < 60; i++) {
    await sleep(300);
    win = (await agent.windows()).find((w) => w.cls === 'CASCADIA_HOSTING_WINDOW_CLASS' && w.title.startsWith(title));
    if (win && fs.existsSync(sync)) break;
  }
  if (!win) throw new Error('terminal window not found');
  await agent.place(win.hwnd, -10, 0, g.w + 20, g.h + 10, true);
  await agent.focus(win.hwnd);
  await sleep(800);
  for (let i = 0; i < zoom; i++) { await agent.key('ctrl+oem_plus'); await sleep(140); }
  await sleep(700);

  const count = () => { try { return Number(fs.readFileSync(sync, 'utf8')); } catch { return 0; } };
  const T = { agent, win, g, geometry };
  T.prompts = count;
  // types the command like a person (cps = characters per second), presses Enter, and waits until the next prompt is shown
  // keyboard input only goes to the foreground window, so focus is re-asserted before typing and before Enter
  const focus = async () => { for (let i = 0; i < 4; i++) { const r = await agent.focus(win.hwnd); if (r.foreground === win.hwnd) return; await sleep(200); } };
  T.run = async (command, { cps = 30, timeoutMs = 120000, before = 500, after = 1100, mark = () => {} } = {}) => {
    const n0 = count();
    await sleep(before);
    await focus();
    mark('typing');
    await agent.type(command, cps);
    await sleep(220);
    await focus();
    mark('enter');
    await agent.key('enter');
    const t0 = Date.now();
    while (count() === n0) {
      if (Date.now() - t0 > timeoutMs) throw new Error(`command did not finish in ${timeoutMs} ms: ${command}`);
      await sleep(120);
    }
    mark('done', { ms: Date.now() - t0 });
    await sleep(after);
    return Date.now() - t0;
  };
  T.clear = async () => { await T.run('clear', { cps: 30, before: 200, after: 300 }); };
  T.close = async () => { killMosTerminal(); };
  return T;
}
