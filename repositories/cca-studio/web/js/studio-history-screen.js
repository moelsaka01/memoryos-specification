// MemoryOS 1.3.1 Studio History screen (Freeze sections 5 to 8). Lets the user open a MemoryOS history export folder through the
// browser's user-initiated folder access, reads the files ONCE into memory, verifies them with the MO-1308 verifier (through
// buildDashboardViewModel) and renders the MO-1309 dashboard in a same-origin frame, from the unmodified MO-1309 page behaviour.
// Read-only: no storage, no handle kept, no request other than Studio's own static files. Every string it shows is a registry key;
// export data is written only with textContent.
import { canonicalize } from "./mip-canonical.js";
import { DashboardError } from "./memoryos-dashboard-contract.js";
import { assembleSnapshot } from "./memoryos-dashboard-snapshot.js";
import { buildViewModelInBrowser } from "./studio-history-verify.js";
import { itemsFromDirectoryHandle, itemsFromFileList, readExportItems } from "./studio-history-reader.js";
import { HISTORY_SCREEN_ACTIONS, historyWording as say } from "./studio-history-wording.js";

export const HISTORY_FRAME_PAGE = "history-view.html";
export const HISTORY_FRAME_SCRIPT = "dashboard/page.embedded.js";
export const SNAPSHOT_SOURCE_FILES = Object.freeze(["page.html", "page.css", "page.js"]);
export const SNAPSHOT_DOWNLOAD_NAME = "memoryos-history-dashboard.html";
const DATA_BLOCK_ID = "memoryos-dashboard-data";
const KNOWN_CODES = Object.freeze(["DASH_EXPORT_UNREADABLE", "DASH_EXPORT_INVALID", "DASH_LIMIT_EXCEEDED", "DASH_USAGE", "DASH_IO_FAILURE"]);

const asDashboardError = (error) => (error instanceof DashboardError ? error : new DashboardError("DASH_EXPORT_UNREADABLE"));
const afterPaint = (win) => new Promise((resolve) => { win.requestAnimationFrame(() => win.setTimeout(resolve, 0)); });

// Mounts the screen into `container` (an empty element). `env` is injectable for tests; defaults are the real browser objects.
export function mountHistoryScreen({ container, env = {} }) {
  const doc = env.document ?? container.ownerDocument;
  const win = env.window ?? doc.defaultView;
  const fetchText = env.fetchText ?? (async (url) => {
    const response = await win.fetch(url, { cache: "no-store", credentials: "omit", redirect: "error" });
    if (!response.ok) throw new Error("source");
    return response.text();
  });
  const download = env.download ?? ((bytes, name) => {
    const url = win.URL.createObjectURL(new win.Blob([bytes], { type: "text/html" }));
    const anchor = doc.createElement("a"); // not attached to the page and not a navigation: a download of a document already shown
    anchor.href = url;
    anchor.download = name;
    anchor.click();
    win.setTimeout(() => win.URL.revokeObjectURL(url), 0);
  });

  const SAFE_ATTRIBUTES = new Set(["id", "class", "role", "type", "hidden", "disabled", "title", "for", "data-action", "aria-label", "aria-labelledby", "aria-live", "aria-atomic", "webkitdirectory", "multiple", "tabindex"]);
  const h = (tag, attributes = {}, ...children) => {
    const node = doc.createElement(tag);
    for (const [name, value] of Object.entries(attributes)) {
      if (!SAFE_ATTRIBUTES.has(name)) throw new TypeError("Attribute not allowed.");
      node.setAttribute(name, String(value));
    }
    for (const child of children) node.append(typeof child === "string" ? doc.createTextNode(child) : child);
    return node;
  };
  const w = (tag, key, attributes = {}) => h(tag, attributes, say(key));

  const heading = w("h1", "heading.screen", { id: "history-heading", tabindex: "-1" });
  const intro = w("p", "statement.intro");
  const readOnly = w("p", "statement.readOnly");
  const openButton = w("button", "action.openFolder", { type: "button", "data-action": "open-folder" });
  const compatButton = w("button", "action.openFolderCompat", { type: "button", "data-action": "open-folder-compat" });
  const saveButton = w("button", "action.saveSnapshot", { type: "button", "data-action": "save-snapshot", disabled: "" });
  const clearButton = w("button", "action.clear", { type: "button", "data-action": "clear", disabled: "" });
  const folderInput = h("input", { type: "file", id: "history-folder-input", hidden: "", webkitdirectory: "", "data-action": "open-folder-compat", "aria-label": say("a11y.folderInput"), tabindex: "-1" });
  const controls = h("div", { class: "history-controls", role: "group", "aria-label": say("a11y.controls") }, openButton, compatButton, saveButton, clearButton, folderInput);
  const compatNote = w("p", "statement.compatibility", { class: "history-note" });
  const status = h("p", { id: "history-status", role: "status", "aria-live": "polite", "aria-atomic": "true", class: "history-note" }, say("statement.notChosen"));
  const errorBox = h("section", { id: "history-error", role: "alert", class: "history-error", hidden: "" });
  const stage = h("div", { id: "history-stage" });
  const root = h("section", { id: "history-root", "aria-labelledby": "history-heading" }, heading, intro, readOnly, controls, compatNote, status, errorBox, stage);
  container.replaceChildren(root);
  container.setAttribute("aria-label", say("a11y.landmark.screen"));

  const state = { token: 0, viewModel: null, frame: null };
  const setStatus = (key) => { status.textContent = say(key); };
  const syncButtons = () => { saveButton.disabled = state.viewModel === null; clearButton.disabled = state.viewModel === null && errorBox.hidden; };

  function dropDashboard() {
    state.viewModel = null;
    if (state.frame !== null) { state.frame.remove(); state.frame = null; }
    stage.replaceChildren();
  }
  function hideError() { errorBox.hidden = true; errorBox.replaceChildren(); }
  function showError(error) {
    const known = asDashboardError(error);
    const code = known.code;
    const rows = [[say("label.errorCode"), code]];
    if (known.historyCode !== null) rows.push([say("label.historyCode"), known.historyCode]);
    const list = h("dl");
    for (const [label, value] of rows) {
      const term = h("dt", {}, label);
      const description = h("dd");
      description.textContent = value; // contract constants, still written as text
      list.append(term, description);
    }
    errorBox.replaceChildren(w("h2", "error.heading"), w("p", KNOWN_CODES.includes(code) ? `error.${code}` : "error.DASH_USAGE"), list);
    errorBox.hidden = false;
  }

  async function mountDashboard(viewModel, token) {
    const frame = h("iframe", { id: "history-frame", title: say("a11y.frame"), class: "history-frame" });
    frame.src = HISTORY_FRAME_PAGE;
    const loaded = new Promise((resolve, reject) => { frame.addEventListener("load", resolve, { once: true }); frame.addEventListener("error", reject, { once: true }); });
    stage.replaceChildren(frame);
    state.frame = frame;
    await loaded;
    if (token !== state.token) return false;
    const frameDocument = frame.contentDocument;
    const block = frameDocument.getElementById(DATA_BLOCK_ID);
    if (block === null) throw new DashboardError("DASH_EXPORT_UNREADABLE");
    block.textContent = canonicalize(viewModel); // text, never markup; the page parses it as JSON
    const script = frameDocument.createElement("script");
    script.src = HISTORY_FRAME_SCRIPT;
    const ran = new Promise((resolve, reject) => { script.addEventListener("load", resolve, { once: true }); script.addEventListener("error", reject, { once: true }); });
    frameDocument.body.append(script);
    await ran;
    return token === state.token;
  }

  // The whole job for one selection. `collect` returns the picker's items; everything before the dashboard is in memory only.
  async function open(collect) {
    state.token += 1;
    const token = state.token;
    dropDashboard();
    hideError();
    setStatus("status.reading");
    syncButtons();
    try {
      await afterPaint(win);
      const items = await collect();
      const input = await readExportItems(items); // each file is read exactly once
      if (token !== state.token) return false;
      setStatus("status.checking");
      await afterPaint(win);
      const viewModel = buildViewModelInBrowser(input); // MO-1308 verification over those bytes; throws before anything is shown
      if (token !== state.token) return false;
      state.viewModel = viewModel;
      if (!(await mountDashboard(viewModel, token))) return false;
      setStatus("status.shown");
      const note = w("p", "statement.readOnce", { class: "history-note" });
      stage.prepend(note);
      syncButtons();
      return true;
    } catch (error) {
      if (token !== state.token) return false;
      if (!(error instanceof DashboardError)) win.console?.error?.("studio-history: unexpected defect", error?.name); // never silent; no data is logged
      dropDashboard();
      status.textContent = "";
      showError(error);
      syncButtons();
      return false;
    }
  }

  async function chooseFolder() {
    if (typeof win.showDirectoryPicker !== "function") { setStatus("status.pickerUnavailable"); return false; }
    let handle;
    try { handle = await win.showDirectoryPicker({ mode: "read" }); } catch { setStatus("status.cancelled"); return false; } // cancelled or denied: no state change
    return open(() => itemsFromDirectoryHandle(handle));
  }

  async function saveSnapshot() {
    const viewModel = state.viewModel;
    if (viewModel === null) return false;
    try {
      const [template, style, script] = await Promise.all(SNAPSHOT_SOURCE_FILES.map((name) => fetchText(`dashboard/${name}`)));
      const { bytes } = assembleSnapshot({ viewModel, sources: { template, style, script } });
      download(bytes, SNAPSHOT_DOWNLOAD_NAME);
      setStatus("status.snapshotOffered");
      return true;
    } catch {
      setStatus("status.snapshotUnavailable");
      return false;
    }
  }

  function discard(statusKey) {
    state.token += 1; // an in-flight selection is abandoned
    dropDashboard();
    hideError();
    folderInput.value = "";
    setStatus(statusKey);
    syncButtons();
  }
  const clear = () => discard("status.cleared");
  const reset = () => discard("statement.notChosen"); // leaving the screen: back to the initial state

  openButton.addEventListener("click", () => { void chooseFolder(); });
  compatButton.addEventListener("click", () => folderInput.click());
  folderInput.addEventListener("change", () => {
    const files = folderInput.files;
    if (files === null || files.length === 0) { setStatus("status.cancelled"); return; }
    void open(async () => itemsFromFileList(files)).then(() => { folderInput.value = ""; }); // the list is read; the input keeps nothing
  });
  saveButton.addEventListener("click", () => { void saveSnapshot(); });
  clearButton.addEventListener("click", clear);

  return Object.freeze({
    actions: HISTORY_SCREEN_ACTIONS,
    root,
    open,
    chooseFolder,
    saveSnapshot,
    clear,
    reset,
    focus: () => heading.focus(),
    hasExport: () => state.viewModel !== null,
  });
}
