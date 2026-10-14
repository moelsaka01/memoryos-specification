// Scene: the main Studio flow, from the real home screen to the tamper rejection. Every action is real OS input (see lib/studio.mjs).
//   home -> History -> Choose export folder (native dialog, permission prompt) -> Save dashboard snapshot -> Tab into the dashboard (the page scrolls)
//   -> scroll the dashboard -> filter -> expand -> clear the filter -> Clear -> choose the one-byte-tampered export -> the real error.
import { sleep } from '../lib/winauto.mjs';

export const name = 'studio-main';
export const kind = 'studio';
export const geometries = ['16x9', '1x1', '4x5'];

// Scrolls with the real wheel until `getDy()` (CSS px still to move, positive = down) is small. `at` is a physical pixel over the scroller.
async function wheelUntil(S, getDy, at, { tol = 30, perNotch = 100, max = 16, ms = 520 } = {}) {
  let previous = null;
  for (let i = 0; i < max; i++) {
    const dy = await getDy();
    if (Math.abs(dy) <= tol) return;
    if (previous !== null && Math.abs(previous - dy) < 2) return; // nothing moved: the scroller is at its end
    previous = dy;
    const notches = Math.max(-7, Math.min(7, Math.round(dy / perNotch)));
    await S.agent.wheel(notches === 0 ? Math.sign(dy) : notches, ms, at[0], at[1]);
    await sleep(380);
  }
}

export default async function run(S, { mark, speed = 1 }) {
  const { agent, g } = S;
  const hold = (ms) => sleep(Math.round(ms * speed));
  const px = (fx, fy) => [Math.round(g.w * fx), Math.round(g.h * fy)];

  // 1. The real home screen
  await agent.move(...px(0.5, 0.55), 0);
  mark('home');
  await hold(1700);
  for (const [fx, fy, ms] of [[0.58, 0.5, 1100], [0.46, 0.58, 1000], [0.55, 0.64, 900]]) { await agent.move(...px(fx, fy), ms); await hold(250); }
  await hold(600);

  // 2. History
  mark('history-nav');
  await S.openHistory();
  mark('history-open', { rects: { controls: await S.rect('.history-controls'), heading: await S.rect('#history-heading') } });
  await hold(2000);

  // 3. Open a real CLI-produced export folder
  mark('pick-export');
  const result = await S.pickFolder('export', { marks: (n, x) => mark(n, x), holdDialog: 1400, holdPrompt: 1500 });
  if (result !== 'shown') throw new Error('expected the export to be shown');
  mark('dashboard-shown', { rects: { frame: await S.rect('#history-frame') } });
  await hold(1600);

  // 4. Save dashboard snapshot (the button is in view at the top of the page)
  mark('save-nav');
  await S.click('button[data-action="save-snapshot"]', { ms: 900, settle: 100 });
  mark('snapshot-saved');
  await hold(3200);
  await agent.move(...px(0.5, 0.45), 600);

  await hold(300);
  const frameBox = async () => S.eval('(() => { const r = document.querySelector("#history-frame").getBoundingClientRect(); return { top: r.top, left: r.left, w: r.width, h: r.height }; })()');
  const fb = await frameBox();
  mark('dashboard-top', { rects: { frame: await S.rect('#history-frame') } });
  const over = S.screenOf(fb.left + fb.w * 0.5, fb.top + fb.h * 0.55);
  await agent.move(over[0], over[1], 700);
  const frameDy = (sel, offset) => async () => S.eval(`(() => { const d = document.querySelector("#history-frame").contentDocument; const e = d.querySelector(${JSON.stringify(sel)}); return e.getBoundingClientRect().top - ${offset}; })()`);
  for (const [sel, markName, holdMs] of [['#h-integrity', 'section-integrity', 1700], ['#h-source', 'section-source', 2600], ['#h-counts', 'section-counts', 2800], ['#h-entries', 'section-entries', 900]]) {
    await wheelUntil(S, frameDy(sel, 16), over);
    mark(markName, { rects: { frame: await S.rect('#history-frame') } });
    await hold(holdMs);
  }

  // 6. Filter: record kind -> human decision claim; expand the first row; clear the filter
  const kindIndex = await S.eval('(() => { const d = document.querySelector("#history-frame").contentDocument; return [...d.querySelector("#f-kind").options].findIndex((x) => /decision/i.test(x.textContent)); })()');
  await wheelUntil(S, frameDy('#f-kind', Math.round(fb.h * 0.14)), over);
  mark('filter-start', { rects: { frame: await S.rect('#history-frame') } });
  await hold(600);
  await S.click('#f-kind', { frame: '#history-frame', ms: 800, settle: 700 });
  for (let i = 0; i < Math.max(1, kindIndex); i++) { await agent.key('down'); await sleep(280); }
  await sleep(350);
  await agent.key('enter');
  await sleep(600);
  mark('filter-applied');
  await hold(1800);
  await wheelUntil(S, frameDy('table[role="table"]', Math.round(fb.h * 0.12)), over);
  mark('filtered-table', { rects: { frame: await S.rect('#history-frame') } });
  await hold(2000);
  await S.click('button[data-action="expand"]', { frame: '#history-frame', ms: 800, settle: 600 });
  mark('row-expanded');
  await hold(2400);
  await agent.wheel(3, 700, over[0], over[1]);
  await hold(2200);
  await wheelUntil(S, frameDy('#f-kind', Math.round(fb.h * 0.14)), over);
  const afterExpand = await frameBox();
  void afterExpand;
  await S.click('button[data-action="filter"]', { frame: '#history-frame', ms: 800, settle: 600 });
  mark('filter-cleared');
  await hold(1400);

  await S.click('button[data-action="clear"]', { ms: 900, settle: 600 });
  mark('cleared');
  await hold(1500);

  // 8. The one-byte tamper
  mark('pick-tampered');
  const bad = await S.pickFolder('export-tampered', { marks: (n, x) => mark('t-' + n, x), holdDialog: 1100, holdPrompt: 1000 });
  if (bad !== 'error') throw new Error('expected the tampered export to be rejected');
  mark('tamper-rejected', { rects: { error: await S.rect('#history-error') } });
  await hold(5200);
  mark('end');
}
