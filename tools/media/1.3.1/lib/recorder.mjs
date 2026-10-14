// Screen recorder for the MemoryOS 1.3.1 release media: FFmpeg gdigrab over one region of the real desktop, with the real mouse pointer drawn.
// Marks (named events) are timestamped on the same wall clock as the capture, so the edit can find "the moment of the click" later.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

export function startRecording({ out, w, h, x = 0, y = 0, fps = 30 }) {
  fs.mkdirSync(path.dirname(out), { recursive: true });
  // ddagrab: GPU Desktop Duplication (steady 30 fps; gdigrab dropped about 20% of frames on this host). The pointer is drawn by the capture.
  const source = `ddagrab=output_idx=0:framerate=${fps}:draw_mouse=1:video_size=${w}x${h}:offset_x=${x}:offset_y=${y}`;
  const args = ['-y', '-hide_banner', '-loglevel', 'warning', '-f', 'lavfi', '-use_wallclock_as_timestamps', '1', '-i', source,
    '-vf', 'hwdownload,format=bgra,format=yuv420p', '-c:v', 'libx264', '-preset', 'ultrafast', '-crf', '14', '-g', '30', '-copyts', '-fps_mode', 'passthrough', out];
  const startedAt = Date.now();
  const child = spawn('ffmpeg', args, { stdio: ['pipe', 'ignore', 'pipe'] });
  let stderr = '';
  child.stderr.on('data', (d) => { stderr += d; });
  const marks = [];
  const api = {
    startedAt,
    out,
    mark: (name, extra = {}) => { marks.push({ name, epochMs: Date.now(), ...extra }); },
    marks,
    stop: () => new Promise((resolve) => {
      child.once('exit', (code) => resolve({ code, stderr, marks, startedAt, stoppedAt: Date.now() }));
      child.stdin.write('q');
      setTimeout(() => { try { child.kill(); } catch { /* gone */ } }, 8000);
    }),
  };
  return api;
}
