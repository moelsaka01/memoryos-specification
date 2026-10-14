// Node client for lib/winauto.ps1 (Windows PowerShell 5.1 hosts the Win32 helper). Node built-ins only.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import readline from 'node:readline';

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'winauto.ps1');
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export function startAgent() {
  const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', SCRIPT], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  const queue = [];
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d; });
  const rl = readline.createInterface({ input: child.stdout });
  rl.on('line', (line) => { const waiter = queue.shift(); if (waiter) waiter.resolve(JSON.parse(line)); });
  child.on('exit', () => { while (queue.length) queue.shift().reject(new Error('agent exited: ' + stderr)); });
  const call = (cmd) => new Promise((resolve, reject) => {
    queue.push({ resolve: (r) => (r.ok ? resolve(r) : reject(new Error(r.error))), reject });
    child.stdin.write(JSON.stringify(cmd) + '\n');
  });
  const api = {
    call,
    windows: async () => (await call({ cmd: 'windows' })).windows.map((line) => {
      const [hwnd, pid, cls, rect, ...title] = line.split('\t');
      const [l, t, r, b] = rect.split(',').map(Number);
      return { hwnd: Number(hwnd), pid: Number(pid), cls, rect: [l, t, r, b], title: title.join('\t') };
    }),
    place: (hwnd, x, y, w, h, topmost = true) => call({ cmd: 'place', hwnd, x, y, w, h, topmost }),
    focus: (hwnd) => call({ cmd: 'focus', hwnd }),
    rect: (hwnd) => call({ cmd: 'rect', hwnd }),
    foreground: async () => (await call({ cmd: 'fg' })).foreground,
    move: (x, y, ms = 700) => call({ cmd: 'move', x, y, ms }),
    click: (x, y, ms = 700, extra = {}) => call({ cmd: 'click', x, y, ms, ...extra }),
    wheel: (notches, ms = 600, x, y) => call({ cmd: 'wheel', notches, ms, x, y }),
    type: (text, cps = 22) => call({ cmd: 'type', text, cps }),
    key: (keys) => call({ cmd: 'key', keys }),
    cursor: () => call({ cmd: 'cursor' }),
    uia: async (hwnd, name, type) => (await call({ cmd: 'uia', hwnd, name, type })).found,
    uiaDump: async (hwnd, limit = 80) => (await call({ cmd: 'uiadump', hwnd, limit })).items,
    close: async () => { try { await call({ cmd: 'quit' }); } catch { /* already gone */ } child.kill(); },
  };
  return api;
}
