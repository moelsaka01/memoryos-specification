// Records one scene on the real desktop.
//   node tools/media/record.mjs SCENE GEOMETRY [--no-record] [--shots] [--speed N]
// Writes work131/raw/<scene>-<geometry>.mkv and <scene>-<geometry>.marks.json (wall-clock marks aligned to the capture).
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { startAgent, sleep } from './lib/winauto.mjs';
import { startRecording } from './lib/recorder.mjs';
import { openStudio, GEOMETRY, WORK } from './lib/studio.mjs';
import { openTerminal } from './lib/term.mjs';

const [sceneName, geometry, ...flags] = process.argv.slice(2);
if (!sceneName || !GEOMETRY[geometry]) { console.error('usage: record.mjs SCENE 16x9|1x1|4x5 [--no-record] [--shots] [--speed N]'); process.exit(2); }
const noRecord = flags.includes('--no-record');
const shots = flags.includes('--shots');
const speed = flags.includes('--speed') ? Number(flags[flags.indexOf('--speed') + 1]) : 1;
const here = path.dirname(fileURLToPath(import.meta.url));
const scene = await import(pathToFileURL(path.join(here, 'scenes', `${sceneName}.mjs`)).href);
const g = GEOMETRY[geometry];
const tag = `${sceneName}-${geometry}`;
const out = `${WORK}/raw/${tag}.mkv`;
fs.mkdirSync(`${WORK}/raw`, { recursive: true });
fs.mkdirSync(`${WORK}/shots`, { recursive: true });

const agent = startAgent();
let rec = null;
const early = [];
let n = 0;
const mark = (name, extra = {}) => {
  (rec ?? { mark: (a, b) => early.push({ name: a, epochMs: Date.now(), ...b }) }).mark(name, extra);
  console.log(`  mark ${name}`);
  if (shots) {
    const file = `${WORK}/shots/${tag}-${String(++n).padStart(2, '0')}-${name}.png`;
    spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', `ddagrab=output_idx=0:framerate=1:draw_mouse=1:video_size=${g.w}x${g.h}:offset_x=0:offset_y=0`, '-vf', 'hwdownload,format=bgra', '-frames:v', '1', file]);
  }
};

let session;
let result = null;
try {
  session = scene.kind === 'terminal' ? await openTerminal({ agent, geometry, ...(scene.terminalOptions ?? {}) }) : await openStudio({ agent, geometry });
  if (scene.setup) await scene.setup(session);
  if (!noRecord) { rec = startRecording({ out, w: g.w, h: g.h }); await sleep(4000); }
  await (scene.run ?? scene.default)(session, { mark, speed, agent, geometry });
  await sleep(600);
} finally {
  if (rec) result = await rec.stop();
  if (session?.close) await session.close();
  await agent.close();
  if (result) {
    fs.writeFileSync(`${WORK}/raw/${tag}.marks.json`, JSON.stringify({ scene: sceneName, geometry, startedAt: result.startedAt, stoppedAt: result.stoppedAt, marks: result.marks }, null, 1));
    console.log(`recorded ${out}`);
  }
}
process.exit(0);
