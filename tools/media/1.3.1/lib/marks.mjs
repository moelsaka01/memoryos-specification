// Reads a raw recording and its marks file and answers "at which second of the video did this mark happen".
import fs from 'node:fs';
import { spawnSync } from 'node:child_process';

export function probeStart(file) {
  const r = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=start_time,duration', '-of', 'json', file], { encoding: 'utf8' });
  const f = JSON.parse(r.stdout).format;
  return { start: Number(f.start_time), end: Number(f.duration) };
}

// Returns { startEpoch, duration, at(name, occurrence = 0) -> seconds from the first frame, list: [{name, t}] }
export function loadTake(rawFile, marksFile) {
  const { start, end } = probeStart(rawFile);
  const meta = JSON.parse(fs.readFileSync(marksFile, 'utf8'));
  const list = meta.marks.map((m) => ({ name: m.name, t: m.epochMs / 1000 - start, ...m }));
  return {
    startEpoch: start,
    duration: end - start,
    list,
    at: (name, occurrence = 0) => {
      const hits = list.filter((m) => m.name === name);
      if (!hits[occurrence]) throw new Error(`no mark ${name}#${occurrence}`);
      return hits[occurrence].t;
    },
  };
}
