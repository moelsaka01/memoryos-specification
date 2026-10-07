// MO-1308 Phase 3C Windows harness: link helpers for the host-only cases. Destructive steps are confined to a work root under the
// worktree's scratch area: links are removed with unlink/rmdir before any tree removal, the walk never follows a link, and a path
// outside the root is refused.
import fs from 'node:fs';
import path from 'node:path';

export const SCRATCH = '.p3c-work';
const within = (root, candidate) => {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === '' || (relative !== '..' && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
};
export const junction = (target, at) => fs.symlinkSync(target, at, 'junction');
export const dirSymlink = (target, at) => fs.symlinkSync(target, at, 'dir');
export const fileSymlink = (target, at) => fs.symlinkSync(target, at, 'file');
export const exists = (target) => { try { fs.lstatSync(target); return true; } catch { return false; } };
export function removeLink(target) {
  try { fs.unlinkSync(target); return; } catch { /* a directory link on some hosts */ }
  fs.rmdirSync(target);
}
export function removeTree(root, target) {
  if (!within(root, target)) throw new Error(`refusing a path outside the work root: ${target}`);
  let st;
  try { st = fs.lstatSync(target); } catch { return; }
  if (st.isSymbolicLink()) { removeLink(target); return; }
  if (!st.isDirectory()) { try { fs.chmodSync(target, 0o666); } catch { /* ignore */ } fs.unlinkSync(target); return; }
  for (const name of fs.readdirSync(target)) removeTree(root, path.join(target, name));
  fs.rmdirSync(target);
}
// A link-safe listing of a tree: kind, size and a content digest per name; a link is a link and is never followed.
export function snapshot(root, digest) {
  const rows = new Map();
  const walk = (directory, prefix) => {
    for (const name of fs.readdirSync(directory).sort()) {
      const full = path.join(directory, name);
      const relative = prefix === '' ? name : `${prefix}/${name}`;
      const st = fs.lstatSync(full);
      if (st.isSymbolicLink()) rows.set(relative, `link:${fs.readlinkSync(full)}`);
      else if (st.isDirectory()) { rows.set(relative, 'dir'); walk(full, relative); } else rows.set(relative, `file:${st.size}:${digest(fs.readFileSync(full))}`);
    }
  };
  walk(root, '');
  return rows;
}
export function copyTree(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const source = path.join(from, entry.name);
    if (fs.lstatSync(source).isSymbolicLink()) throw new Error(`copyTree refuses a link: ${source}`);
    if (entry.isDirectory()) copyTree(source, path.join(to, entry.name)); else fs.copyFileSync(source, path.join(to, entry.name), fs.constants.COPYFILE_EXCL);
  }
}
