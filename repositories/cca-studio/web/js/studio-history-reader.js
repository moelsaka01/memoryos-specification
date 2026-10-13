// MemoryOS 1.3.1 Studio History reader (Freeze sections 5 and 7). Turns the files a browser hands over for a folder the user chose
// into the in-memory export `verifyHistoryExport` takes. Pure over abstract items: no DOM, filesystem or network access here.
//   item = { path: "entries/00000000000000000000.json", size: Number, read: () => Promise<ArrayBuffer | Uint8Array> }
// Every path class and byte bound is the one the MO-1309 generator applies (memoryos-dashboard-export-bounds.js). The listing is
// checked completely BEFORE any file is read; each file is then read exactly once, in bytewise path order. Failures are
// DashboardError(DASH_EXPORT_UNREADABLE | DASH_LIMIT_EXCEEDED) and nothing partial is returned.
import { DashboardError } from "./memoryos-dashboard-contract.js";
import { ENTRY_LIMIT, boundFor, byteOrder, isEntryFile } from "./memoryos-dashboard-export-bounds.js";

const unreadable = () => new DashboardError("DASH_EXPORT_UNREADABLE");
const KNOWN_DIRECTORY = /^(?:|entries|records|records\/[0-9a-f]{64})$/u;
const MAXIMUM_DEPTH = 3; // records/<digest>/<member>
// An export holds at most one file per entry, at most six members per record and three top-level files; more is not an export.
export const ITEM_LIMIT = ENTRY_LIMIT * 7 + 3;

const safePath = (path) => typeof path === "string" && path !== "" && path.isWellFormed() && !path.includes("\\")
  && path.split("/").every((segment) => segment !== "" && segment !== "." && segment !== "..");

// Checks the whole listing, then reads each item once. Returns { files: [{ path, bytes }] } in bytewise path order.
export async function readExportItems(items) {
  if (!Array.isArray(items)) throw new DashboardError("DASH_USAGE");
  const listed = [];
  const seen = new Set();
  for (const item of items) {
    if (item === null || typeof item !== "object" || !safePath(item.path) || !Number.isSafeInteger(item.size) || item.size < 0 || typeof item.read !== "function") throw unreadable();
    if (seen.has(item.path)) throw unreadable();
    seen.add(item.path);
    listed.push(item);
  }
  listed.sort((a, b) => byteOrder(a.path, b.path));
  let entryFiles = 0;
  for (const item of listed) {
    if (isEntryFile(item.path)) {
      entryFiles += 1;
      if (entryFiles > ENTRY_LIMIT) throw new DashboardError("DASH_LIMIT_EXCEEDED");
    }
    const bound = boundFor(item.path);
    if (bound === null || item.size > bound) throw unreadable(); // a path the layout does not define, or an oversize file
  }
  const files = [];
  for (const item of listed) {
    let bytes;
    try {
      const data = await item.read(); // the only read of this file
      bytes = new Uint8Array(data); // a Uint8Array is copied (later changes to the source cannot reach it); an ArrayBuffer from a File is fresh
    } catch { throw unreadable(); }
    if (bytes.byteLength !== item.size) throw unreadable(); // the file changed between listing and reading
    files.push({ path: item.path, bytes });
  }
  return { files };
}

// ---- Collectors: the two folder routes of the browser, as items ----

// A FileSystemDirectoryHandle (File System Access API, read mode). Walks only the directories the export layout defines, so a
// wrongly chosen folder is refused at once instead of being enumerated.
export async function itemsFromDirectoryHandle(root) {
  const items = [];
  const walk = async (handle, prefix, depth) => {
    if (depth > MAXIMUM_DEPTH || !KNOWN_DIRECTORY.test(prefix)) throw unreadable();
    for await (const entry of handle.values()) {
      const path = prefix === "" ? entry.name : `${prefix}/${entry.name}`;
      if (entry.kind === "directory") await walk(entry, path, depth + 1);
      else if (entry.kind === "file") {
        if (items.length >= ITEM_LIMIT) throw new DashboardError("DASH_LIMIT_EXCEEDED");
        let file;
        try { file = await entry.getFile(); } catch { throw unreadable(); }
        items.push({ path, size: file.size, read: () => file.arrayBuffer() });
      } else throw unreadable();
    }
  };
  await walk(root, "", 0);
  return items;
}

// A FileList from `<input type="file" webkitdirectory>`: the first segment of webkitRelativePath is the chosen folder's own name.
export function itemsFromFileList(fileList) {
  const items = [];
  for (const file of Array.from(fileList ?? [])) {
    const relative = typeof file.webkitRelativePath === "string" ? file.webkitRelativePath : "";
    const cut = relative.indexOf("/");
    if (cut <= 0) throw unreadable();
    if (items.length >= ITEM_LIMIT) throw new DashboardError("DASH_LIMIT_EXCEEDED");
    items.push({ path: relative.slice(cut + 1), size: file.size, read: () => file.arrayBuffer() });
  }
  return items;
}
