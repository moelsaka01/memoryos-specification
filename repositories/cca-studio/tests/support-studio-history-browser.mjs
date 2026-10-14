// MemoryOS 1.3.1 browser test support, shared by the Studio History browser tests and the certification campaign: Studio served by its own
// scripts/serve.mjs on an OS-chosen port, and the helpers that drive the History screen over the DevTools protocol (Node built-ins only).
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { HISTORY_WORDING } from "../web/js/studio-history-wording.js";
import { STUDIO_ROOT } from "./support-studio-history.mjs";
import { killTree } from "./support-devtools.mjs";

export const STATUS = "document.querySelector('#history-status')?.textContent";
export const SHOWN = HISTORY_WORDING["status.shown"];
export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function startStudio() {
  const child = spawn(process.execPath, [path.join(STUDIO_ROOT, "scripts", "serve.mjs"), "0"], { stdio: ["ignore", "pipe", "inherit"] });
  const origin = await new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("Studio did not start")), 20000);
    child.stdout.on("data", (chunk) => { const match = /(http:\/\/127\.0\.0\.1:\d+)\//u.exec(String(chunk)); if (match) { clearTimeout(timer); resolve(match[1]); } });
  });
  return { origin, close: () => killTree(child) };
}

export async function waitFor(page, expression, what, timeout = 30000) {
  const deadline = Date.now() + timeout;
  for (;;) {
    if (await page.evaluate(`Boolean(${expression})`)) return;
    if (Date.now() > deadline) throw new Error(`timeout waiting for ${what}`);
    await sleep(50);
  }
}
export const noProblems = (page) => page.messages.filter((m) => /error|warning/u.test(m.kind) || m.kind === "exception");

export async function openHistory(browser, origin, options = {}) {
  const page = await browser.openPage(options);
  await page.navigate(`${origin}/#history`);
  await waitFor(page, "document.querySelector('#history-root')", "the History screen");
  return page;
}
export async function chooseDirectory(page, directory) {
  const { root } = await page.call("DOM.getDocument", {});
  const { nodeId } = await page.call("DOM.querySelector", { nodeId: root.nodeId, selector: "#history-folder-input" });
  await page.call("DOM.setFileInputFiles", { nodeId, files: [directory] });
}
// Chooses an export folder and waits for the NEW outcome: a frame or an error node that is not the one shown before the choice (a
// shown dashboard and its status text are still on screen in the instant after the choice, so the status alone is not a signal).
export async function openExport(page, directory, expectShown = true) {
  await page.evaluate("window.__previousFrame = document.querySelector('#history-frame'); window.__previousError = document.querySelector('#history-error h2')");
  await chooseDirectory(page, directory);
  if (expectShown) {
    await waitFor(page, `${STATUS} === ${JSON.stringify(SHOWN)} && document.querySelector('#history-frame') && document.querySelector('#history-frame') !== window.__previousFrame && document.querySelector('#history-frame').contentDocument?.querySelector('#app main')`, "the dashboard");
  } else {
    await waitFor(page, "!document.querySelector('#history-error').hidden && document.querySelector('#history-error h2') && document.querySelector('#history-error h2') !== window.__previousError", "the error");
  }
}
export const frameText = (page) => page.evaluate("document.querySelector('#history-frame').contentDocument.getElementById('app').innerText");
export const errorState = (page) => page.evaluate(`(() => ({ dd: [...document.querySelectorAll('#history-error dd')].map((d) => d.textContent), frame: Boolean(document.querySelector('#history-frame')),
  save: document.querySelector('[data-action="save-snapshot"]').disabled }))()`);

export function writeFiles(directory, files) {
  for (const f of files) { const target = path.join(directory, ...f.path.split("/")); fs.mkdirSync(path.dirname(target), { recursive: true }); fs.writeFileSync(target, f.bytes); }
  return directory;
}
