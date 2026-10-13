// MemoryOS 1.3.1 Studio History wording registry (Freeze section 9). Every string the History screen itself shows (nav label,
// headings, buttons, tooltips, status and error text, accessible names, the route title) is a key of this closed table. The
// MO-1309 forbidden-affordance rule applies unchanged: no approve / ready / green affordance on any technical state. The
// dashboard inside the frame carries the MO-1309 registry; this table is deliberately separate so that the MO-1309 snapshot
// bytes do not change. Pure and browser-safe.
import { forbiddenTerms } from "./memoryos-dashboard-wording.js";

const freeze = (value) => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value)) freeze(value[key]);
  }
  return value;
};

export const HISTORY_SCREEN_ACTIONS = freeze(["open-folder", "open-folder-compat", "save-snapshot", "clear"]);

export const HISTORY_WORDING = freeze({
  "nav.label": "History",
  "nav.heading": "History",
  "nav.tooltip": "Open a MemoryOS history export folder",
  "route.title": "History export view",
  "route.description": "Open a MemoryOS history export folder and read it. Nothing is written.",
  "heading.screen": "MemoryOS history export",
  "statement.intro": "Choose a folder made by the MemoryOS history export command. Studio reads the folder once into memory, checks its integrity data and shows its contents.",
  "statement.readOnly": "This screen only reads. It cannot add, remove or change anything in a history, and it keeps nothing after you clear it or leave this screen.",
  "statement.readOnce": "Studio read this folder once into memory. It holds no link to the folder and wrote nothing to it.",
  "statement.compatibility": "Compatibility mode asks the browser to hand over every file in the folder. The browser may ask you to confirm.",
  "statement.notChosen": "No folder is open.",
  "action.openFolder": "Choose export folder",
  "action.openFolderCompat": "Choose export folder (compatibility mode)",
  "action.saveSnapshot": "Save dashboard snapshot",
  "action.clear": "Clear",
  "status.reading": "Reading the folder.",
  "status.checking": "Checking the integrity data of the export.",
  "status.shown": "The export is shown below.",
  "status.cancelled": "No folder was chosen.",
  "status.cleared": "The export was cleared.",
  "status.snapshotOffered": "A snapshot file was offered for download.",
  "status.snapshotUnavailable": "The snapshot file could not be prepared.",
  "status.pickerUnavailable": "This browser cannot open a folder directly. Use compatibility mode.",
  "error.heading": "This folder was not shown",
  "error.DASH_EXPORT_UNREADABLE": "The folder does not hold a readable history export. A file may be missing, unexpected, too large, or changed while it was read.",
  "error.DASH_EXPORT_INVALID": "The contents of the folder do not match the integrity data recorded in the export.",
  "error.DASH_LIMIT_EXCEEDED": "The folder is larger than a history limit allows.",
  "error.DASH_USAGE": "The folder could not be handled.",
  "error.DASH_IO_FAILURE": "The snapshot file could not be prepared.",
  "label.errorCode": "Error code",
  "label.historyCode": "History code",
  "a11y.landmark.screen": "History export screen",
  "a11y.controls": "History export controls",
  "a11y.frame": "Dashboard for the chosen history export",
  "a11y.folderInput": "Export folder (compatibility mode)",
});

export const HISTORY_WORDING_KEYS = freeze(Object.keys(HISTORY_WORDING).sort());

export function historyWording(key) {
  if (typeof key !== "string" || !Object.hasOwn(HISTORY_WORDING, key)) throw new TypeError("Unknown wording key.");
  return HISTORY_WORDING[key];
}

// Scans (key, text) pairs of chrome strings: each must be a registry key with its registry text and contain no forbidden term.
export function scanHistoryStrings(items) {
  const violations = [];
  for (const { key, text } of items) {
    if (typeof key !== "string" || !Object.hasOwn(HISTORY_WORDING, key)) violations.push({ key, rule: "not-a-registry-key" });
    else if (HISTORY_WORDING[key] !== text) violations.push({ key, rule: "text-differs-from-registry" });
    for (const term of forbiddenTerms(text)) violations.push({ key, rule: "forbidden-term", term });
  }
  return violations;
}

// Every control must carry an action from the closed set, and none may be a link or a form (no navigation).
export function scanHistoryControls(controls) {
  const violations = [];
  for (const control of controls) {
    if (!HISTORY_SCREEN_ACTIONS.includes(control.action)) violations.push({ element: control.element, rule: "action-not-in-closed-set" });
    if (control.element === "a" || control.element === "form") violations.push({ element: control.element, rule: "navigation-or-form" });
  }
  return violations;
}
