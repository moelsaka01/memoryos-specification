// Captures real stills of the generated dashboard in Microsoft Edge (2x device scale) for the ad's product shots.
//   node tools/media/capture-stills.mjs DASHBOARD_HTML OUTPUT_DIRECTORY
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { launchEdge } from './lib/edge.mjs';

const [dashboard, outDir] = process.argv.slice(2).map((p) => path.resolve(p));
fs.mkdirSync(outDir, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const edge = await launchEdge({ width: 1280, height: 720, scale: 2 });
try {
  await edge.goto(pathToFileURL(dashboard).href);
  await sleep(400);
  await edge.screenshot(path.join(outDir, 'dash-top.png'));
  await edge.evaluate(`(() => { const h = [...document.querySelectorAll('h2')].find((x) => x.textContent.trim() === 'Counts'); window.scrollTo(0, h.getBoundingClientRect().top + window.scrollY - 24); })()`);
  await sleep(300);
  await edge.screenshot(path.join(outDir, 'dash-counts.png'));
  await edge.evaluate(`window.scrollTo(0, document.getElementById('entries').getBoundingClientRect().top + window.scrollY - 24)`);
  await sleep(300);
  await edge.screenshot(path.join(outDir, 'dash-entries.png'));
  await edge.evaluate(`(() => { const el = document.getElementById('f-kind'); el.value = 'HUMAN_DECISION_CLAIM'; el.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await sleep(300);
  await edge.screenshot(path.join(outDir, 'dash-filtered.png'));
  console.log(`Edge ${edge.version}: stills in ${outDir}`);
} finally { await edge.close(); }
