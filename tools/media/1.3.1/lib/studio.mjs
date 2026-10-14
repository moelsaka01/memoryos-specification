// A Memory Studio session for the 1.3.1 release media. Edge (its own fresh profile, app-mode window) is driven ONLY with real operating-system
// input: the pointer, the wheel and the keyboard. The DevTools protocol is used for one thing, reading where an element is, so that the real
// pointer lands on it. The native folder dialog and the browser's permission prompt are operated the same way (UI Automation finds the buttons).
import { spawnSync } from 'node:child_process';
import { sleep } from './winauto.mjs';
import { launchEdge, cdp, calibrate, toScreen, centreOf, closeBrowser } from './edge.mjs';

export const WORK = 'C:/mos-media/work131';
export const GEOMETRY = { '16x9': { w: 1920, h: 1080 }, '1x1': { w: 1080, h: 1080 }, '4x5': { w: 864, h: 1080 } };

export function killMosEdge() {
  spawnSync('powershell.exe', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process -Filter \"Name='msedge.exe'\" | Where-Object { $_.CommandLine -like '*mos-media*' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"]);
}

const mid = (r) => [Math.round((r[0] + r[2]) / 2), Math.round((r[1] + r[3]) / 2)];

export async function openStudio({ agent, geometry, url = 'http://127.0.0.1:4173/', port = 9333 }) {
  const g = GEOMETRY[geometry];
  killMosEdge();
  await sleep(800);
  const edge = await launchEdge({ profileDir: `${WORK}/edge-run`, template: `${WORK}/edge-warm`, url, appMode: true, port });
  let main;
  for (let i = 0; i < 40 && !main; i++) { await sleep(250); main = (await agent.windows()).find((x) => x.cls === 'Chrome_WidgetWin_1' && /Memory Studio/.test(x.title)); }
  if (!main) throw new Error('Studio window not found');
  // the window is placed so that its VISIBLE area is exactly the capture region (the frame has a 10 px invisible border at left, right and bottom)
  await agent.place(main.hwnd, -10, 0, g.w + 20, g.h + 10, true);
  await agent.focus(main.hwnd);
  await sleep(1500);
  const page = await cdp(edge.port);
  const cal = await calibrate(agent, page, g);
  const narrow = g.w < 1100;

  const S = { agent, edge, page, cal, main, g, narrow, geometry };
  S.pt = async (selector, opts = {}) => {
    const c = await centreOf(page, selector, opts);
    if (!c) throw new Error(`element not found: ${selector}`);
    return { ...c, screen: toScreen(cal, c.x, c.y) };
  };
  S.move = async (selector, { ms = 800, dx = 0, dy = 0, ...opts } = {}) => { const p = await S.pt(selector, opts); await agent.move(p.screen[0] + dx, p.screen[1] + dy, ms); return p; };
  S.click = async (selector, { ms = 800, settle = 350, dx = 0, dy = 0, ...opts } = {}) => {
    const p = await S.pt(selector, opts);
    await agent.click(p.screen[0] + dx, p.screen[1] + dy, ms);
    await sleep(settle);
    return p;
  };
  S.clickRect = async (rect, ms = 700) => { const [x, y] = mid(rect); await agent.click(x, y, ms); };
  S.eval = (js) => page.evaluate(js);
  // screen rectangle (physical pixels of the capture region) of an element, for the edit's camera moves
  S.rect = async (selector, opts = {}) => {
    const c = await centreOf(page, selector, opts);
    if (!c) return null;
    const [x0, y0] = toScreen(cal, c.left, c.top);
    const [x1, y1] = toScreen(cal, c.left + c.w, c.top + c.h);
    return [x0, y0, x1, y1];
  };
  S.waitFor = async (js, timeoutMs = 15000, step = 150) => {
    const t0 = Date.now();
    for (;;) {
      if (await page.evaluate(js)) return true;
      if (Date.now() - t0 > timeoutMs) throw new Error(`timeout waiting for: ${js}`);
      await sleep(step);
    }
  };
  // physical-pixel position of a point in CSS pixels
  S.screenOf = (cssX, cssY) => toScreen(cal, cssX, cssY);

  // Scrolls the page (real wheel, pointer in the left margin outside any frame) until the element is comfortably inside the window.
  S.ensureVisible = async (selector, { top = 110, bottom = 130, opts = {} } = {}) => {
    const viewH = await page.evaluate('innerHeight');
    let last = null;
    for (let i = 0; i < 14; i++) {
      const c = await centreOf(page, selector, opts);
      if (c.y >= top && c.y <= viewH - bottom) return;
      if (last !== null && Math.abs(last - c.y) < 2) return; // the page cannot scroll any further
      last = c.y;
      const dy = c.y < top ? c.y - top : c.y - (viewH - bottom);
      const notches = Math.max(-7, Math.min(7, Math.round(dy / 100) || Math.sign(dy)));
      await agent.wheel(notches, 520, Math.max(10, Math.round(g.w * (narrow ? 0.02 : 0.073))), Math.round(g.h * 0.5));
      await sleep(380);
    }
  };

  // The History page clips its own overflow and cannot be scrolled with the wheel (observed in 1.3.1; see MEDIA-NOTES). Keyboard focus does scroll it:
  // Tab from the History buttons into the dashboard brings the whole dashboard into view; Shift+Tab goes back up. Both are real key presses.
  S.shellMetrics = () => page.evaluate('(() => { const s = document.querySelector(".studio-shell"); return { top: s.scrollTop, max: s.scrollHeight - s.clientHeight }; })()');
  S.revealDashboard = async ({ gap = 520, mark = () => {} } = {}) => {
    for (let i = 0; i < 10; i++) {
      await agent.key('tab'); await sleep(gap);
      const m = await S.shellMetrics();
      if (i === 0) mark('tab-start');
      if (m.max > 0 && m.top >= m.max - 2) { mark('dashboard-revealed'); return; }
    }
  };
  S.backToTop = async ({ gap = 90 } = {}) => {
    // click the note above the dashboard (sets the keyboard starting point), then one Shift+Tab lands on the History buttons and scrolls to them
    // "at the top" = the History buttons are in view below the sticky top bar
    const buttonsVisible = () => S.eval('(() => { const r = document.querySelector("button[data-action=\\"open-folder\\"]").getBoundingClientRect(); return r.top > 90 && r.bottom < innerHeight - 20; })()');
    // (about ten stops: the dashboard's own controls, then the History buttons)
    for (let i = 0; i < 40 && !(await buttonsVisible()); i++) { await agent.key('shift+tab'); await sleep(gap); }
    if (!(await buttonsVisible())) throw new Error(`could not scroll the History page back to the top (${JSON.stringify(await S.shellMetrics())})`);
  };

  // Keyboard input and clicks only reach the foreground window: if something else took the foreground, take it back (no Alt tap when it is not needed)
  S.refocus = async () => { if ((await agent.foreground()) !== main.hwnd) { await agent.focus(main.hwnd); await sleep(400); } };

  // Opens the History screen the way a user does on this window size.
  S.openHistory = async ({ ms = 900 } = {}) => {
    for (let attempt = 0; attempt < 4; attempt++) {
      await S.refocus();
      if (narrow) {
        const open = await S.eval('document.querySelector("#scope-nav").getBoundingClientRect().left >= 0');   // the drawer slides in from the left
        if (!open) await S.click('#menu-toggle', { ms: 700, settle: 700 });
        for (let i = 0; i < 14; i++) {
          const c = await centreOf(page, 'a[data-scope="history"]');
          if (c.y < (g.h / 1.5) - 140) break;
          await agent.wheel(4, 500, Math.round(g.w * 0.2), Math.round(g.h * 0.6));
          await sleep(350);
        }
      }
      await S.click('a[data-scope="history"]', { ms, settle: 900 });
      try { await S.waitFor('document.querySelector("#history-heading") !== null', 4000); return; } catch { /* the click did not land; try again */ }
    }
    throw new Error('the History screen did not open');
  };

  // The real folder route: button, native dialog, folder, "Select Folder", the browser's permission prompt, "Allow".
  S.pickFolder = async (name, { holdDialog = 900, holdItem = 500, holdPrompt = 1100, marks = () => {} } = {}) => {
    let dlg;
    for (let attempt = 0; attempt < 3 && !dlg; attempt++) {
      await S.refocus();
      await S.click('button[data-action="open-folder"]', { ms: attempt === 0 ? 900 : 500, settle: 100 });
      if (attempt === 0) marks('picker-clicked');
      for (let i = 0; i < 16 && !dlg; i++) { await sleep(250); dlg = (await agent.windows()).find((w) => w.cls === '#32770' && /Select a folder/.test(w.title)); }
    }
    if (!dlg) {
      spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `ddagrab=output_idx=0:framerate=1:draw_mouse=1:video_size=${g.w}x${g.h}`, '-vf', 'hwdownload,format=bgra', '-frames:v', '1', `${WORK}/shots/failure-pick.png`]);
      const status = await S.eval('(document.querySelector("#history-status")||{}).textContent + " | active=" + (document.activeElement && document.activeElement.tagName) + " | hasFocus=" + document.hasFocus()');
      const wins = (await agent.windows()).filter((w) => w.title).map((w) => `${w.cls}:${w.title.slice(0, 40)}`).join(' ; ');
      throw new Error(`native folder dialog did not appear (status: ${status}; foreground=${await agent.foreground()} main=${main.hwnd}; windows: ${wins})`);
    }
    // the dialog opens where Windows puts it (960 x 720, top left); only the tall window is narrower than that, so there it is resized to fit
    if (g.w < 960) await agent.place(dlg.hwnd, 12, 60, g.w - 24, 720, true);
    await sleep(holdDialog);
    marks('dialog-open');
    let [item] = await agent.uia(dlg.hwnd, name, 'ListItem');
    // the dialog reopens where the last choice was made (inside that folder); a person goes up one level (Alt+Up) to the folder that holds both exports
    for (let up = 0; !item && up < 2; up++) { await agent.key('alt+up'); await sleep(900); [item] = await agent.uia(dlg.hwnd, name, 'ListItem'); marks('dialog-up'); }
    if (!item) throw new Error(`folder not listed in the dialog: ${name}`);
    await S.clickRect(item.rect, 900);
    await sleep(holdItem);
    const [select] = await agent.uia(dlg.hwnd, 'Select Folder', 'Pane');
    await S.clickRect(select.rect, 700);
    marks('folder-selected');
    let allow;
    for (let i = 0; i < 24 && !allow; i++) { await sleep(250); [allow] = await agent.uia(main.hwnd, 'Allow', 'Button'); }
    if (allow) {
      marks('permission-prompt');
      await sleep(holdPrompt);
      await S.clickRect(allow.rect, 700);
      marks('allowed');
    }
    // finished when the screen either shows the export or the error
    await S.waitFor('(() => { const e = document.querySelector("#history-error"); const s = document.querySelector("#history-status"); return (e && !e.hidden) || (s && s.textContent.startsWith("The export is shown")); })()', 30000);
    const outcome = await S.eval('(() => { const e = document.querySelector("#history-error"); return e && !e.hidden ? "error" : "shown"; })()');
    await sleep(250);
    marks('result', { outcome, rect: await S.rect(outcome === 'error' ? '#history-error' : '#history-frame') });
    return outcome;
  };

  S.close = async () => { try { page.close(); } catch { /* gone */ } await closeBrowser(edge.port); killMosEdge(); };
  return S;
}
