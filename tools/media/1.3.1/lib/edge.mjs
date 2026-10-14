// Launches Microsoft Edge with a fresh, isolated profile and drives it only for READING page geometry through the DevTools protocol
// (element rectangles, so that real OS mouse clicks land on the right pixel). Node built-ins only (global fetch / WebSocket).
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export const EDGE = 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launchEdge({ profileDir, port = 9333, url, downloadDir, appMode = true, fresh = true, template = null, extraArgs = [] }) {
  if (fresh) fs.rmSync(profileDir, { recursive: true, force: true });
  if (template) { fs.rmSync(profileDir, { recursive: true, force: true }); fs.cpSync(template, profileDir, { recursive: true }); }
  fs.mkdirSync(path.join(profileDir, 'Default'), { recursive: true });
  if (downloadDir && fresh) {
    fs.mkdirSync(downloadDir, { recursive: true });
    // the profile is new: seed only the download location, so the snapshot download lands in a scratch folder
    fs.writeFileSync(path.join(profileDir, 'Default', 'Preferences'), JSON.stringify({
      download: { default_directory: downloadDir.replaceAll('/', '\\'), prompt_for_download: false },
      savefile: { default_directory: downloadDir.replaceAll('/', '\\') },
      browser: { has_seen_welcome_page: true },
      profile: { default_content_setting_values: { notifications: 2 } },
    }));
  }
  const args = [`--user-data-dir=${profileDir}`, `--remote-debugging-port=${port}`, '--remote-allow-origins=*', '--no-first-run', '--no-default-browser-check',
    '--disable-sync', '--disable-features=msEdgeSidebarV2,EdgeEntraSignin,msShoppingTrigger,msEdgeShoppingUI,Translate,EdgeFRE,msUndersideButton,msEdgeEnableNurturingFramework',
    '--hide-crash-restore-bubble', '--disable-session-crashed-bubble', ...extraArgs, appMode ? `--app=${url}` : url];
  const child = spawn(EDGE, args, { stdio: 'ignore', detached: false });
  for (let i = 0; i < 100; i++) {
    try { const r = await fetch(`http://127.0.0.1:${port}/json/version`); if (r.ok) break; } catch { /* not up yet */ }
    await sleep(150);
  }
  return { child, port, close: () => { try { child.kill(); } catch { /* gone */ } } };
}

// A minimal CDP session on the first page target.
export async function cdp(port) {
  let targets = [];
  for (let i = 0; i < 60; i++) {
    targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
    if (targets.some((t) => t.type === 'page')) break;
    await sleep(150);
  }
  const target = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  let id = 0; const pending = new Map();
  ws.addEventListener('message', (m) => { const d = JSON.parse(m.data); if (d.id && pending.has(d.id)) { pending.get(d.id)(d); pending.delete(d.id); } });
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id; pending.set(n, (d) => (d.error ? reject(new Error(JSON.stringify(d.error))) : resolve(d.result)));
    ws.send(JSON.stringify({ id: n, method, params }));
  });
  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.text + ' ' + (r.exceptionDetails.exception?.description ?? ''));
    return r.result.value;
  };
  return { send, evaluate, close: () => ws.close(), target };
}

// Maps page (CSS pixel) coordinates to physical screen pixels for one Edge window. It moves the real pointer to two points and reads
// back where the page saw it: no assumptions about the window frame, DPI scale or title bar height.
export async function calibrate(agent, page, { w = 1920, h = 1080 } = {}) {
  const p1 = [Math.round(w * 0.25), Math.round(h * 0.35)];
  const p2 = [Math.round(w * 0.7), Math.round(h * 0.75)];
  await page.evaluate(`window.__mos = { last: null }; addEventListener('mousemove', (e) => { window.__mos.last = [e.clientX, e.clientY]; }, true); 0`);
  const probe = async (x, y) => {
    await page.evaluate("window.__mos.last = null");
    await agent.move(x + 7, y + 5, 0); await agent.move(x, y, 0);
    for (let i = 0; i < 40; i++) {
      await new Promise((r) => setTimeout(r, 100));
      const v = await page.evaluate("window.__mos.last");
      if (v && Math.abs(v[0] - (x - 0)) >= 0 && v.length === 2) { await new Promise((r) => setTimeout(r, 150)); return page.evaluate("window.__mos.last"); }
    }
    throw new Error("calibration: the page did not see the pointer");
  };
  const dpr = await page.evaluate('devicePixelRatio');
  const a = await probe(p1[0], p1[1]);
  const b = await probe(p2[0], p2[1]);
  const sx = (p2[0] - p1[0]) / (b[0] - a[0]);   // physical pixels per CSS pixel horizontally
  const sy = (p2[1] - p1[1]) / (b[1] - a[1]);
  return { dpr, scaleX: sx, scaleY: sy, originX: p1[0] - a[0] * sx, originY: p1[1] - a[1] * sy };
}

export const toScreen = (cal, cssX, cssY) => [Math.round(cal.originX + cssX * cal.scaleX), Math.round(cal.originY + cssY * cal.scaleY)];

// Centre (CSS px, top-level viewport) of the first element matching `selector`, optionally inside a same-origin iframe.
export async function centreOf(page, selector, { frame = null, scrollIntoView = false } = {}) {
  return page.evaluate(`(() => {
    const f = ${JSON.stringify(frame)};
    let doc = document; let ox = 0; let oy = 0;
    if (f) { const fe = document.querySelector(f); const r = fe.getBoundingClientRect(); ox = r.left; oy = r.top; doc = fe.contentDocument; }
    const el = doc.querySelector(${JSON.stringify(selector)});
    if (!el) return null;
    ${scrollIntoView ? 'el.scrollIntoView({ block: "center", inline: "nearest" });' : ''}
    const r = el.getBoundingClientRect();
    return { x: ox + r.left + r.width / 2, y: oy + r.top + r.height / 2, w: r.width, h: r.height, left: ox + r.left, top: oy + r.top };
  })()`);
}

// Closes the browser through the DevTools protocol (a clean shutdown, so the profile flushes its preferences to disk).
export async function closeBrowser(port) {
  try {
    const info = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
    const ws = new WebSocket(info.webSocketDebuggerUrl);
    await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
    ws.send(JSON.stringify({ id: 1, method: 'Browser.close' }));
    await sleep(2500);
  } catch { /* already closed */ }
}
