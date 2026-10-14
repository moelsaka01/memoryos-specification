// Minimal Chrome DevTools Protocol client for Microsoft Edge using only Node built-ins (global fetch and WebSocket, node:child_process).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const EDGE = process.env.MEMORYOS_MEDIA_EDGE ?? 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function launchEdge({ width, height, scale = 1, port = Number(process.env.MEMORYOS_MEDIA_PORT || 9333), headless = true } = {}) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'mos-media-edge-'));
  const args = [`--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--remote-allow-origins=*',
    '--disable-background-networking', '--disable-sync', `--force-device-scale-factor=${scale}`, '--hide-scrollbars', '--allow-file-access-from-files',
    ...(headless ? ['--headless=new'] : []), `--window-size=${width},${height}`, 'about:blank'];
  const child = spawn(EDGE, args, { stdio: 'ignore' });
  let version = null;
  for (let attempt = 0; attempt < 100 && version === null; attempt += 1) {
    try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(100); }
  }
  if (version === null) { child.kill(); throw new Error('Edge did not expose the DevTools endpoint'); }
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = targets.find((target) => target.type === 'page');
  const socket = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();
  socket.onmessage = (message) => {
    const data = JSON.parse(message.data);
    if (data.id !== undefined && pending.has(data.id)) {
      const { resolve, reject } = pending.get(data.id);
      pending.delete(data.id);
      if (data.error) reject(new Error(`${data.error.message}`)); else resolve(data.result);
    } else if (data.method && listeners.has(data.method)) for (const handler of listeners.get(data.method)) handler(data.params);
  };
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = nextId; nextId += 1;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const on = (method, handler) => { if (!listeners.has(method)) listeners.set(method, []); listeners.get(method).push(handler); };
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile: false });
  const api = {
    version: version.Browser,
    send, on,
    async goto(url) {
      const loaded = new Promise((resolve) => on('Page.loadEventFired', resolve));
      await send('Page.navigate', { url });
      await loaded;
    },
    async evaluate(expression) {
      const { result, exceptionDetails } = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
      if (exceptionDetails) throw new Error(exceptionDetails.exception?.description ?? exceptionDetails.text);
      return result.value;
    },
    async screenshot(file, { clip } = {}) {
      const { data } = await send('Page.captureScreenshot', { format: 'png', fromSurface: true, ...(clip ? { clip: { ...clip, scale: 1 } } : {}) });
      fs.writeFileSync(file, Buffer.from(data, 'base64'));
    },
    async click(x, y) {
      await send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
      await send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', clickCount: 1 });
      await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', clickCount: 1 });
    },
    async close() { try { await send('Browser.close'); } catch { /* the browser is already gone */ } socket.close(); child.kill(); await sleep(300); try { fs.rmSync(profile, { recursive: true, force: true, maxRetries: 8, retryDelay: 400 }); } catch { /* a temporary profile; the OS clears it later */ } },
  };
  return api;
}
